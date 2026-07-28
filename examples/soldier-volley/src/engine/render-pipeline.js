// render-pipeline — the AAA post chain in the only order that is physically defensible: everything
// that IS light (AO/GI, reflections, godrays, bloom) is composited in LINEAR HDR, the image is
// TONEMAPPED EXACTLY ONCE, then display-space filters (FXAA, RCAS sharpen, LUT grade) run. Invert
// that and it reads "video-gamey": bloom on tonemapped pixels can never blow out, and FXAA on HDR
// floats measures luminance in the wrong perceptual space.
//
// Six measured traps this module exists to neutralise (each is commented where it bites):
//   1. Renderer.js asks for antialias:true → renderer.samples === 4. MSAA is INCOMPATIBLE with
//      TRAA/TAAU, which need the raw per-frame jittered sample, not an already-resolved pixel.
//   2. SSGINode.setup() RETURNS ITS AO NODE. `ssgi(...)` used directly gives occlusion, not GI.
//   3. GTAO and SSGI both output AO — multiplying both double-darkens every contact. One source.
//   4. SSGI has no resolutionScale (updateBefore() hardcodes renderer.getDrawingBufferSize()), so it
//      always runs full-res. It is the most expensive pass and is banned from the low tier.
//   5. GodraysNode only supports Directional/Point lights and needs a real shadow setup — and
//      PostFX.js has no access to any light, hence the explicit `sun` argument.
//   6. Tonemap once, at the end, with AgX (or ACES).

import * as THREE from 'three/webgpu';
import { pass, mrt, output, transformedNormalView, velocity, metalness, roughness, vec3, vec4, renderOutput } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { fxaa } from 'three/addons/tsl/display/FXAANode.js';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { ssgi } from 'three/addons/tsl/display/SSGINode.js';
import { ssr } from 'three/addons/tsl/display/SSRNode.js';
import { godrays } from 'three/addons/tsl/display/GodraysNode.js';
import { traa } from 'three/addons/tsl/display/TRAANode.js';
import { taau } from 'three/addons/tsl/display/TAAUNode.js';
import { sharpen } from 'three/addons/tsl/display/SharpenNode.js';
import { lut3D } from 'three/addons/tsl/display/Lut3DNode.js';
import { dof } from 'three/addons/tsl/display/DepthOfFieldNode.js';

/** What each tier promises. `ao` is a SINGLE source on purpose — see trap 3. */
const TIERS = {
  low:   { ao: null,   ssr: false, godrays: false, temporal: null,   fxaa: true,  sharpen: false, lut: false },
  high:  { ao: 'gtao', ssr: true,  godrays: false, temporal: 'traa', fxaa: false, sharpen: true,  lut: false },
  ultra: { ao: 'ssgi', ssr: true,  godrays: true,  temporal: 'taau', fxaa: false, sharpen: true,  lut: true },
};

/**
 * TRAP 1. `renderer.samples` is a GETTER ONLY in r185 — `renderer.samples = 0` throws a TypeError
 * under ES-module strict mode, which is why the naive fix never ships. Clearing the backing field is
 * the only handle; the scene pass additionally forces `{ samples: 0 }` on its own render target
 * (PassNode honours options.samples over renderer.samples).
 */
function forceNoMSAA(renderer) {
  try { renderer._samples = 0; } catch { /* frozen renderer: the contract reports it below */ }
}

/** Godrays refuses SpotLights (throws 'Unsupported light type') and needs the light to cast shadows. */
const usableSun = (l) => !!l && (l.isDirectionalLight === true || l.isPointLight === true) && l.castShadow === true;

/**
 * Build the node graph for one tier. Returns the passes actually created plus the names the tier
 * PROMISED — the contract compares the two, so a godrays skipped for lack of a sun surfaces as an
 * issue instead of an effect nobody notices is missing.
 */
function buildGraph(renderer, scene, camera, state) {
  const cfg = TIERS[state.tier], passes = {}, declared = ['bloom'];

  // MSAA must die BEFORE the pass is constructed: the sample count is baked into its render target.
  if (cfg.temporal) forceNoMSAA(renderer);
  const scenePass = cfg.temporal ? pass(scene, camera, { samples: 0 }) : pass(scene, camera);

  // G-buffer. Every attachment is RGBA16F = 8 bytes/sample and WebGPU's default
  // maxColorAttachmentBytesPerSample is 32 — so FOUR attachments is the hard ceiling. That is why
  // metalness+roughness share one packed attachment instead of taking one each.
  const attachments = { output };
  if (cfg.ao || cfg.ssr) attachments.normal = transformedNormalView; // transformed, not normalView: AO/SSR then follow normal-mapped detail
  if (cfg.temporal) attachments.velocity = velocity;                 // motion vectors: no velocity, no history reprojection
  if (cfg.ssr) attachments.material = vec4(metalness, roughness, 0, 1);
  if (Object.keys(attachments).length > 1) scenePass.setMRT(mrt(attachments));

  const color = scenePass.getTextureNode('output');
  const depth = scenePass.getTextureNode('depth');
  const normal = attachments.normal ? scenePass.getTextureNode('normal') : null;
  let hdr = color;

  if (cfg.ao === 'gtao') {
    declared.push('gtao');
    passes.gtao = ao(depth, normal, camera);
    passes.gtao.resolutionScale = 0.5;   // AO is low-frequency: half-res costs a quarter and reads identical
    // Modulating the whole beauty rather than only its diffuse part is three's documented composite —
    // the G-buffer carries no diffuse/specular split to occlude selectively.
    hdr = hdr.mul(vec4(vec3(passes.gtao.getTextureNode().r), 1));
  } else if (cfg.ao === 'ssgi') {
    declared.push('ssgi');
    const gi = ssgi(color, depth, normal, camera);
    gi.useTemporalFiltering = true;      // legitimate only because a temporal pass runs downstream; halves the sample budget
    gi.sliceCount.value = 2;             // 2×8×2 = 32 samples/px — the "medium, with temporal filtering" preset
    gi.stepCount.value = 8;
    passes.ssgi = gi;
    // TRAP 2: getGINode(). `gi` itself resolves to the AO attachment, because setup() returns _aoNode.
    // TRAP 3: getAONode() is deliberately NOT multiplied in — the gathered radiance already carries
    // the occlusion, and stacking both crushes every crease to black.
    hdr = hdr.add(gi.getGINode());
  }

  if (cfg.ssr) {
    declared.push('ssr');
    const material = scenePass.getTextureNode('material');
    // colorNode MUST stay the raw pass texture: SSRNode calls .sample(uv) on it to fetch the hit
    // colour, which a composited expression node cannot answer. AO wraps SSR, it never feeds it.
    passes.ssr = ssr(color, depth, normal, { camera, metalnessNode: material.r, roughnessNode: material.g });
    passes.ssr.resolutionScale = 0.5;    // roughness blurs reflections anyway; full-res is wasted rays
    hdr = hdr.add(vec4(passes.ssr.rgb, 0)); // reflection is ADDITIVE radiance; its alpha is ray length, drop it
  }

  // TRAP 5: no usable light, no godrays. Declared regardless so the contract says why it is missing.
  if (cfg.godrays) {
    declared.push('godrays');
    if (usableSun(state.sun)) {
      passes.godrays = godrays(depth, camera, state.sun);
      hdr = hdr.add(vec4(passes.godrays.getTextureNode().rgb, 0)); // in-scattering is emissive: add in linear HDR
    }
  }

  // DOF is wired but OFF by default: bokeh over a temporally upscaled image amplifies its own ghosting.
  if (state.dof) {
    declared.push('dof');
    const { focusDistance = 10, focalLength = 0.1, bokehScale = 3 } = state.dof; // focusDistance in metres
    passes.dof = dof(hdr, scenePass.getViewZNode(), focusDistance, focalLength, bokehScale);
    hdr = passes.dof;
  }

  // Temporal resolve BEFORE bloom: bloom over unresolved jitter smears the glow.
  if (cfg.temporal === 'traa') {
    declared.push('traa');
    passes.traa = traa(hdr, depth, scenePass.getTextureNode('velocity'), camera);
    hdr = passes.traa;
  } else if (cfg.temporal === 'taau') {
    declared.push('taau');
    // TAAU is an upscaler: the pass renders at 0.75× and the resolve reconstructs full res from the
    // jitter history. TRAP 4 — SSGI ignores this scale, so ultra banks the saving on the scene pass only.
    scenePass.setResolutionScale(0.75);
    passes.taau = taau(hdr, depth, scenePass.getTextureNode('velocity'), camera);
    hdr = passes.taau;
  }

  // Threshold 1.0 keeps bloom on genuinely over-white HDR values instead of hazing the whole frame.
  passes.bloom = bloom(hdr, 0.35, 0.5, 1.0);
  hdr = hdr.add(passes.bloom);

  // TRAP 6 — the single tonemap. AgX unless the renderer was explicitly set to something else;
  // NoToneMapping would ship raw HDR floats to an sRGB buffer, i.e. a blown-out image.
  const toneMapping = renderer.toneMapping === THREE.NoToneMapping ? THREE.AgXToneMapping : renderer.toneMapping;
  let ldr = renderOutput(hdr, toneMapping, renderer.outputColorSpace);

  // Display-space tail: FXAA reads luminance and RCAS sharpens perceptually — both are LDR filters
  // that misjudge edges when fed linear floats.
  if (cfg.fxaa) { declared.push('fxaa'); passes.fxaa = fxaa(ldr); ldr = passes.fxaa; }
  if (cfg.sharpen) {                     // sharpness 0 = maximum, 2 = none; buys back what TAA/TAAU softens
    declared.push('sharpen');
    passes.sharpen = sharpen(ldr, 0.35);
    ldr = passes.sharpen;
  }
  if (cfg.lut && state.lut) {            // LUT hook: a creative grade belongs after the tonemap, last
    declared.push('lut');
    passes.lut = lut3D(ldr, state.lut.texture, state.lut.size ?? 32, state.lut.intensity ?? 1);
    ldr = passes.lut;
  }

  return { scenePass, passes, declared, outputNode: ldr, toneMapping };
}

/**
 * Create the post-processing pipeline. Drop-in compatible with createPostFX()'s return shape, so
 * Engine.start() can await render() unchanged. `sun` is required by the ultra tier (godrays).
 *
 * @param {{tier?:'low'|'high'|'ultra', sun?:THREE.Light, lut?:{texture:THREE.Data3DTexture,size?:number,intensity?:number}, dof?:object}} [options]
 */
export function createRenderPipeline(renderer, scene, camera, { tier = 'high', sun = null, lut = null, dof: dofOptions = null } = {}) {
  const Pipeline = THREE.RenderPipeline ?? THREE.PostProcessing; // r185 renamed PostProcessing → RenderPipeline
  const postProcessing = new Pipeline(renderer);
  // The pipeline applies renderOutput() itself when this is true — with our own explicit tonemap in
  // the graph that would tonemap the image TWICE (washed-out, crushed blacks). Ours is the only one.
  postProcessing.outputColorTransform = false;

  const state = { tier: TIERS[tier] ? tier : 'high', sun, lut, dof: dofOptions };
  const api = { postProcessing, passes: {}, declared: [], tier: state.tier, toneMapping: THREE.NoToneMapping };
  const free = () => { for (const p of Object.values(api.passes)) p?.dispose?.(); api.scenePass?.dispose?.(); };

  const rebuild = () => {
    free();                                                    // GPU targets of the previous tier
    Object.assign(api, buildGraph(renderer, scene, camera, state), { tier: state.tier });
    postProcessing.outputNode = api.outputNode;
    postProcessing.needsUpdate = true;
  };
  rebuild();

  api.setTier = (t) => { if (TIERS[t] && t !== state.tier) { state.tier = t; rebuild(); } return api.tier; };
  api.setLUT = (l) => { state.lut = l; rebuild(); };           // LUT hook: swapping the grade rebuilds the tail
  api.render = async () => {
    if (typeof postProcessing.render === 'function') postProcessing.render();
    else await postProcessing.renderAsync();                    // deprecated fallback for older three
  };
  // No-op: every node re-reads renderer.getDrawingBufferSize() in its own updateBefore(), so nothing
  // needs resizing. Kept only because Engine.resize() calls postfx.setSize?.().
  api.setSize = () => {};
  api.dispose = () => { free(); postProcessing.dispose?.(); };
  return api;
}

/**
 * Contract: the four failure modes that produce a picture that looks *almost* right and costs a day
 * to diagnose — MSAA silently eating the temporal jitter, two AO terms multiplying, a double
 * tonemap, and a tier promising a pass that was never built.
 */
export function checkRenderPipeline(pipeline, renderer) {
  const issues = [], p = pipeline?.passes ?? {};
  if (!pipeline?.postProcessing) issues.push('pipeline invalide : aucun RenderPipeline construit');
  for (const name of pipeline?.declared ?? []) {
    if (!p[name]) issues.push(`passe déclarée « ${name} » absente du graphe (godrays exige une DirectionalLight/PointLight avec castShadow, un LUT exige une texture 3D)`);
  }

  const temporal = !!(p.traa || p.taau), tm = pipeline?.toneMapping;
  if (temporal && renderer?.samples !== 0) issues.push(`MSAA actif (samples=${renderer?.samples}) avec une passe temporelle : TRAA/TAAU exigent les échantillons jitterés bruts, le MSAA les résout avant`);
  if (p.gtao && p.ssgi) issues.push('double occlusion ambiante (GTAO + SSGI) : les deux termes se multiplient et écrasent les contacts');
  if (pipeline?.tier === 'low' && p.ssgi) issues.push('SSGI actif sur le tier low : sans resolutionScale il tourne en pleine résolution, c’est la passe la plus chère');
  if (pipeline?.tier !== 'low' && !temporal) issues.push(`tier « ${pipeline?.tier} » sans passe temporelle : SSR et SSGI sont bruités et exigent un débruitage temporel`);
  if (pipeline?.postProcessing?.outputColorTransform !== false) issues.push('outputColorTransform laissé à true : le RenderPipeline retonemappe une image déjà tonemappée');
  if (tm !== THREE.AgXToneMapping && tm !== THREE.ACESFilmicToneMapping) issues.push(`tone mapping ${tm} : utiliser AgX (réalisme) ou ACES (cinéma), sinon le HDR est écrêté brutalement`);
  return { ok: issues.length === 0, issues };
}
