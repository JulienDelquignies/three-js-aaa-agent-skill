import * as THREE from 'three/webgpu';
import { retargetClip, checkRetarget, dequantizeSkinned } from './rig-retarget.js';

// squad — a ROSTER of characters from arbitrary Mixamo GLBs, made interchangeable so a scene can put
// eleven of them on a pitch without knowing anything about the files.
//
// A scene that hard-codes one GLB is a scene that cannot cast anybody else, and every real rig differs
// on the four things that break a crowd:
//
//   FACING     Mixamo exports face +Z or −Z depending on the source FBX. The CharacterController is
//              written against one forward (−Z); the fix is not to special-case the controller but to
//              yaw the model INSIDE a wrapper so every rig's wrapper-relative bind is the same posture.
//   SCALE      GLBs come in metres, centimetres or "Mixamo units". Normalising to a target height keeps
//              one team from towering over the other and keeps `stride` (a metres-per-cycle constant)
//              meaningful for everyone.
//   CLIPS      Most character GLBs ship with no animation at all. One rig acts as DONOR and its
//              locomotion is transported onto each roster rig with rig-retarget's world-delta method.
//   ATTRIBUTES KHR_mesh_quantization geometry has normalized integer attributes that skinning maths
//              silently reads as garbage; dequantizeSkinned converts them once, on the template.
//
// THE ORDER IS THE WHOLE MODULE. Retarget in bind pose, before any scale or placement; measure the
// SOURCE bounding box once, before any clone (Box3.setFromObject on a fresh SkinnedMesh clone returns
// a degenerate box because its skeleton has not been resolved — measuring per clone scaled a player by
// 405×, which reads on screen as "the players are missing"); only then clone, scale and place.

const NEED_BONES = [                                    // what the controller and kit.js both require
  'Hips', 'Spine', 'Spine1', 'Spine2', 'Neck',
  'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand',
  'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot',
];
const suffix = (n) => n.replace(/^mixamorig\d*:?/i, '');

/** Bones present on a rig, by Mixamo suffix (the prefix varies per export: mixamorig, mixamorig5…). */
export function rigBones(model) {
  const by = new Map();
  model.traverse((o) => { if (o.isBone) { const s = suffix(o.name); if (!by.has(s)) by.set(s, o); } });
  return by;
}

/**
 * Load a roster.
 * @param loader a GLTFLoader
 * @param spec.rigs   [{ url, faces:'+Z'|'-Z', dequantize?, matte?, hide?:RegExp, name? }]
 * @param spec.donor  url of the GLB carrying idle/walk/run (+ a TPose track for the bind capture)
 * @param spec.height target height in metres (every rig is scaled to it)
 */
export async function loadSquad(loader, { rigs, donor, height = 1.8 } = {}) {
  const donorGltf = await loader.loadAsync(donor);
  const tpose = donorGltf.animations.find((a) => /tpose/i.test(a.name));
  const donorClips = donorGltf.animations.filter((a) => !/tpose/i.test(a.name));

  const entries = [];
  for (const spec of rigs) {
    // the donor can double as a roster rig without being fetched twice
    const gltf = spec.url === donor ? donorGltf : await loader.loadAsync(spec.url);
    const root = gltf.scene;
    if (spec.dequantize) dequantizeSkinned(root);
    if (spec.matte) {
      // Glossiness-converted PBR from a Mixamo export renders as shiny plastic under floodlights:
      // the metalness map is the specular map's leftovers, not metal.
      root.traverse((o) => {
        if (!o.isMesh || !o.material) return;
        o.material.metalness = 0; o.material.metalnessMap = null;
        o.material.roughnessMap = null; o.material.roughness = 0.88;
      });
    }
    if (spec.hide) root.traverse((o) => { if (o.isMesh && spec.hide.test(o.name || '')) o.visible = false; });

    // WRAPPER: the model rides inside a group, yawed so that wrapper-forward is always −Z. Doing it
    // here rather than in the controller means root motion, gestures and facing all agree for free.
    const template = new THREE.Group();
    template.name = `rig:${spec.name || spec.url}`;
    root.rotation.y = spec.faces === '+Z' ? Math.PI : 0;
    template.add(root);
    template.updateMatrixWorld(true);

    // RETARGET IN BIND POSE — before scale, before placement, on the template only. Clip tracks address
    // bones BY NAME, so a clip retargeted here plays on every clone of this template.
    const clips = spec.url === donor
      ? donorClips
      : donorClips.map((c) => retargetClip(c, donorGltf.scene, template, { srcBindClip: tpose }));
    const checks = spec.url === donor ? [] : clips.map((c) => ({ name: c.name, ...checkRetarget(c, template) }));

    // MEASURE THE SOURCE ONCE (see the header)
    template.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(template);
    const size = box.getSize(new THREE.Vector3());
    const scale = size.y > 1e-6 ? height / size.y : 1;
    entries.push({ spec, template, clips, checks, scale, groundY: -box.min.y * scale, srcHeight: size.y, bones: rigBones(template) });
  }

  let n = 0;
  const squad = {
    entries,
    /** One player. `i` picks the rig round-robin, so a mixed roster alternates without any bookkeeping. */
    spawn(i = n++) {
      const e = entries[i % entries.length];
      const model = cloneRig(e.template);
      model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
      model.scale.setScalar(e.scale);
      return { model, groundY: e.groundY, clips: e.clips, rig: e.spec.name || e.spec.url };
    },
    dispose() { entries.length = 0; },
  };
  squad.check = checkSquad(squad, height);
  return squad;
}

// SkeletonUtils.clone is imported by the caller in the scenes; keeping the dependency here local and
// lazy avoids forcing every consumer of squad.js to pull the addon.
let _clone = null;
export function setCloner(fn) { _clone = fn; }
function cloneRig(t) {
  if (!_clone) throw new Error('squad: appeler setCloner(SkeletonUtils.clone) avant spawn() — un clone naïf partage le squelette et les 10 joueurs bougent ensemble');
  return _clone(t);
}

/**
 * Contract: the roster is castable. Every failure here shows up on screen as something subtle and
 * hard to attribute — a player who never blends out of idle, a team that is a head taller, a rig that
 * moonwalks — so each is checked rather than assumed.
 */
export function checkSquad(squad, height = 1.8) {
  const issues = [];
  const es = squad?.entries ?? [];
  if (!es.length) return { ok: false, issues: ['aucun rig chargé'] };
  for (const e of es) {
    const who = e.spec.name || e.spec.url;
    for (const b of NEED_BONES) if (!e.bones.has(b)) issues.push(`${who}: os manquant « ${b} » — le kit et le contrôleur en dépendent`);
    if (!(e.scale > 0) || !Number.isFinite(e.scale)) issues.push(`${who}: échelle non finie (${e.scale})`);
    if (Math.abs(e.srcHeight * e.scale - height) > 0.02) issues.push(`${who}: mis à l'échelle à ${(e.srcHeight * e.scale).toFixed(2)} m au lieu de ${height} m`);
    // 1 mm, pas l'epsilon flottant : un vrai rig a rarement min.y exactement nul, et refuser un
    // −2·10⁻⁸ c'est faire échouer un contrat sur du bruit de virgule flottante au lieu d'un défaut.
    if (!(e.groundY >= -1e-3)) issues.push(`${who}: groundY négatif (${e.groundY.toFixed(4)}) — le personnage s'enfoncerait dans la pelouse`);
    for (const c of e.checks) if (!c.ok) issues.push(`${who}/${c.name}: retarget — ${c.issues[0]}`);
    if (!e.clips.some((c) => /idle/i.test(c.name)) || !e.clips.some((c) => /run/i.test(c.name)))
      issues.push(`${who}: locomotion incomplète (idle et run sont requis pour le blend 1D)`);
    // FACING: after the wrapper yaw every rig must present the same forward, or half the squad
    // moonwalks. MEASURED off the shoulders rather than trusting the `faces` flag — the flag is the
    // thing most likely to be wrong, since it is a human's reading of a file. With `across` running
    // right→left, the chest normal is across × up (up × across points backwards; the sign is the whole
    // check, so it is derived here rather than remembered: for a rig whose left arm sits at +X the
    // character faces +Z, and (1,0,0) × (0,1,0) = (0,0,1) — which is that same +Z).
    const l = e.bones.get('LeftArm'), r = e.bones.get('RightArm');
    if (l && r) {
      const a = l.getWorldPosition(new THREE.Vector3()), b = r.getWorldPosition(new THREE.Vector3());
      const across = a.sub(b).setY(0).normalize();
      const fwd = across.clone().cross(new THREE.Vector3(0, 1, 0)).normalize();
      if (fwd.z > -0.5) issues.push(`${who}: après le wrapper le rig regarde (${fwd.x.toFixed(2)}, ${fwd.z.toFixed(2)}) au lieu de −Z — il marchera à reculons`);
    }
  }
  return { ok: issues.length === 0, issues };
}
