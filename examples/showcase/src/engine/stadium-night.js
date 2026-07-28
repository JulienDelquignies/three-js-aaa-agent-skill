import * as THREE from 'three/webgpu';

// stadium-night — NIGHT lighting for a generated stadium (engine/stadium.js + stadium-builder.js).
// Lighting.js has no night path (hard-wired to one 0xfff2e0 sun at 2.4 from (40,60,25) plus a room-IBL
// fallback), so this REPLACES it for a floodlit match instead of stacking on top: it takes over
// scene.background / environment / fog and hands them back on dispose(). A daylight IBL left
// underneath is exactly what makes a "night" scene read as an overcast afternoon with lamps in it.
//
// CONVENTION — everything is in the stadium's LOCAL frame, hung off a group placed at `at`.
// buildStadium() places the stadium group at `at` with NO rotation and NO scale and the grass top is
// exactly at[1], so local (0,0,0) is the centre spot and world = local + at. The pitch LONG AXIS IS
// X: the painted field is x ∈ [-L/2, L/2], z ∈ [-W/2, W/2] (105 × 68 ⇒ ±52.5 × ±34).
//
// WHY ONE DIRECTIONAL + FOUR NON-SHADOW SPOTS, and not four shadow-casting spots: godrays
// (three/addons/tsl/display/GodraysNode.js — the addon family PostFX.js pulls bloom from) throws
// 'Unsupported light type' for anything that is not a DirectionalLight or a PointLight, and samples
// light.shadow.map.depthTexture directly, so the light feeding the shafts HAS to be a shadow-casting
// directional — hence `sun` in the return. And four shadow-casting spots would mean four extra full
// depth passes over a ~13k-seat stadium per frame plus four overlapping penumbrae under every player,
// which reads as mud rather than as four shadows; broadcast football shows ONE dominant shadow anyway,
// the banks wash the rest out. So the directional owns the shadow and the godrays, and the spots own
// the visible pools on the grass and the glow at the mast heads and cast nothing.

const KEY_DIST = 90;    // m — a directional light has no falloff and no position in the shading maths;
const KEY_ELEV = 0.62;  // this pair only fixes its DIRECTION (≈35° up) and where the frustum sits.
const PITCH_PAD = 4;    // m of grass past the painted line — players and the ball live out there
const SHADOW_TOP = 10;  // m — goals (2.44), players, headers. A ball 20 m up casts nothing anyone reads.
// THE NIGHT BUDGET, and why these numbers and not bigger ones. A floodlit pitch is ~1 500 lux; open
// daylight is ~100 000. Nothing about "night" is in the colour of the sky — it is in the RATIO between
// the key and everything else. The engine's daytime rig is directional 2.4 + environment 1.0; a night
// rig that keeps a key of 2.0 renders an afternoon no matter how dark the background texture is, which
// is exactly what shipped the first time (measured: mean frame luminance 0.40, broadcast night sits
// near 0.15). So the key comes down to floodlight level and the AMBIENT terms come down much further —
// dark stands around a bright pitch is the entire read.
const KEY_I = 0.95;     // the dominant bank: bright enough to carry a crisp shadow, not a sun
const HEMI_I = 0.10;    // just enough that the underside of the roof is not pure black
const ENV_I = 0.12;     // night IBL: it exists so glass and metal have something to reflect
const POOL_E = 1.6;     // target irradiance under a mast's aim point — ABOVE the key, so the pools read
                        // as the source of the light on the grass instead of as faint decoration
const UP = new THREE.Vector3(0, 1, 0);

/** Is `o` inside the night rig's own group? (Used to tell OUR lights from the scene's.) */
const isUnder = (o, root) => { for (let p = o; p; p = p.parent) if (p === root) return true; return false; };

/**
 * The four mast heads in stadium-local metres. model.lights is AUTHORITATIVE: tiers 1-3 publish real
 * pylon coordinates as [x, z] PAIRS (not [x, y, z]) plus one height `h`; tiers 4-5 publish
 * { type:'roof' } with no coordinates because the rig hangs off the roof rims. Inventing positions
 * when the model already has them is how a light ends up 20 m from the pylon you can see.
 */
function mastPositions(model, L, W) {
  const lt = model?.lights;
  if (lt?.type === 'pylon' && Array.isArray(lt.at) && lt.at.length >= 4) {
    return lt.at.map(([x, z]) => ({ x, y: lt.h + 0.7, z }));   // +0.7 = the head above the pole top (stadium-builder)
  }
  // Roof rig (or a model with no lighting data at all): four corners just outside the pitch, at the
  // rim height stadium-builder gives the roof slab — (rows [+ deck 2] + 1)·rowH + 3 — plus 1.2 m so
  // the fixture hangs under the slab instead of inside it.
  const main = model?.stands?.[0];
  const rows = main ? (main.deck2 ? main.rows + 2 + main.deck2 : main.rows) : 12;
  const y = (rows + 1) * (model?.rowH ?? 0.45) + 4.2;
  const hx = L / 2 + (model?.apron ?? 6) / 2, hz = W / 2 + (model?.apron ?? 6) / 2;
  return [[-hx, -hz], [hx, -hz], [-hx, hz], [hx, hz]].map(([x, z]) => ({ x, y, z }));
}

/**
 * Fit the orthographic shadow frustum to the PITCH. The frustum lives in the LIGHT'S axes, not in
 * world X/Z, so the obvious `left = -L/2 … top = W/2` is wrong for any light not arriving along an
 * axis: the corners fall out of frustum and half the players lose their shadow. Widening it "to be
 * safe" is the other half of the trap — at 2048² a 113 m frustum costs 5.5 cm/texel, the whole bowl
 * at 300 m costs 15 cm and a boot shadow becomes three texels of grey mush. So: project the pitch
 * AABB into LIGHT VIEW SPACE and bound it there. Local coordinates are exact here because the group
 * is a pure translation — rotations, and every extent measured off the light, are translation-invariant.
 */
function fitShadowToPitch(sun, L, W) {
  const view = new THREE.Matrix4().lookAt(sun.position, sun.target.position, UP)
    .setPosition(sun.position).invert();
  const hx = L / 2 + PITCH_PAD, hz = W / 2 + PITCH_PAD, p = new THREE.Vector3();
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, n = Infinity, f = -Infinity;
  for (const px of [-hx, hx]) for (const py of [-0.5, SHADOW_TOP]) for (const pz of [-hz, hz]) {
    p.set(px, py, pz).applyMatrix4(view);
    x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x);
    y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
    n = Math.min(n, -p.z); f = Math.max(f, -p.z);        // view space looks down -Z ⇒ depth = -z
  }
  const c = sun.shadow.camera;
  c.left = x0; c.right = x1; c.bottom = y0; c.top = y1;
  c.near = Math.max(0.5, n - 2); c.far = f + 2; c.updateProjectionMatrix();
}

/**
 * Deep-night sky as an equirect gradient — background AND IBL. Some environment is mandatory: keep
 * the daytime map and everything stays washed out; null it and every metal rail and pane of loge
 * glass goes matte black, with nothing left to reflect. Warm at the bottom = sodium off the car park.
 */
// A DataTexture rather than a canvas gradient: the module then has NO DOM dependency, so the whole
// night rig builds in node and its contract is checked on the real lights (a canvas would drag
// `document` in and force the harness onto a hand-built replica).
const SKY_STOPS = [
  [0.00, 0x03, 0x06, 0x0f],   // zenith
  [0.62, 0x0a, 0x13, 0x26],   // upper sky
  [0.90, 0x1b, 0x24, 0x34],   // horizon haze
  [1.00, 0x2c, 0x28, 0x22],   // sodium spill off the car park
];
function nightSky() {
  const H = 256, W = 16, data = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    // row 0 of a DataTexture is v = 0 = the BOTTOM of the equirect (flipY is ignored for data
    // textures, unlike a CanvasTexture where row 0 is the top), so the ramp is written upside down.
    const t = 1 - y / (H - 1);
    let a = SKY_STOPS[0], b = SKY_STOPS[SKY_STOPS.length - 1];
    for (let i = 0; i < SKY_STOPS.length - 1; i++) if (t >= SKY_STOPS[i][0] && t <= SKY_STOPS[i + 1][0]) { a = SKY_STOPS[i]; b = SKY_STOPS[i + 1]; break; }
    const k = b[0] === a[0] ? 0 : (t - a[0]) / (b[0] - a[0]);
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4;
      for (let c = 0; c < 3; c++) data[o + c] = Math.round(a[c + 1] + (b[c + 1] - a[c + 1]) * k);
      data[o + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Light a built stadium for a night match. `at` MUST be the same array passed to buildStadium() and
 * `model` the generateStadium() output; `renderer` bakes the night IBL and gets shadows forced on.
 * @returns {{group:THREE.Group, sun:THREE.DirectionalLight, spots:THREE.SpotLight[], dispose:Function}}
 */
export function setupStadiumNight(scene, renderer, { at = [0, 0, 0], model, intensity = 1, shadowMapSize = 2048 } = {}) {
  const L = model?.pitch?.L ?? 105, W = model?.pitch?.W ?? 68;
  const group = new THREE.Group(); group.name = 'stadium-night';
  group.position.set(at[0], at[1], at[2]);
  scene.add(group);
  const disposables = [];

  // Remember the daytime ambience so dispose() hands the scene back instead of leaving a black hole.
  const prev = { bg: scene.background, blur: scene.backgroundBlurriness, env: scene.environment, envI: scene.environmentIntensity, fog: scene.fog };

  // TAKE OVER THE DAY. Swapping background/environment is not enough: the engine's own boot lighting
  // adds an ANALYTIC sun straight to the scene (Lighting.js: DirectionalLight 0xfff2e0 at 2.4), and an
  // analytic light does not care what the IBL says. Left on, it out-lights the whole floodlight rig and
  // the "night match" renders as a bright afternoon with four lamps in it — with every contract still
  // green, because a contract that only looks inside its own group cannot see it. So: hide every light
  // already in the scene, and hand them back on dispose().
  const doused = [];
  scene.traverse((o) => { if (o.isLight && o.visible && !isUnder(o, group)) { doused.push([o, o.visible]); o.visible = false; } });
  const sky = nightSky(); disposables.push(sky);
  // The IBL is the one thing here that needs a live GPU (PMREMGenerator renders the convolution).
  // Skipping it when there is no renderer is what makes the whole rig constructible in node, so the
  // contract below can be run on the REAL lights in the harness instead of on a hand-built replica —
  // a replica only ever proves that the replica is right.
  const pmrem = renderer ? new THREE.PMREMGenerator(renderer) : null;
  const envTex = pmrem ? pmrem.fromEquirectangular(sky).texture : null;
  if (envTex) disposables.push(envTex);
  scene.background = sky; scene.backgroundBlurriness = 0;
  scene.environment = envTex; scene.environmentIntensity = ENV_I * intensity;
  // Thin haze, not soup: dense night fog erases the far stand and flattens the depth contrast the
  // godrays pass raymarches against.
  scene.fog = new THREE.FogExp2(0x070c16, 0.0035);
  // Idempotent, cheap insurance: a night scene whose only crisp read is the player's shadow is broken
  // if the renderer happened to be built with shadows off.
  if (renderer) renderer.shadowMap.enabled = true;

  // NIGHT AMBIENT — a hemisphere, not an AmbientLight: the stands must stay readable but still darker
  // underneath than on top, or the bowl flattens into one grey card. Sky is the real deep blue above,
  // ground the desaturated warm bounce coming back off the floodlit grass. Its position means nothing
  // to the shading, but it is kept above the grass so the contract's "no light underground" sweep stays honest.
  const hemi = new THREE.HemisphereLight(0x2b3f66, 0x1a2015, HEMI_I * intensity);
  hemi.position.set(0, 40, 0); group.add(hemi);

  const masts = mastPositions(model, L, W);

  // KEY LIGHT — aimed DOWN THE PITCH (long axis = X) from the end that already carries a mast, tilted
  // ~19° off that axis: a shadow running exactly parallel to the touchline reads as a CG turntable.
  const sx = Math.sign(masts[0].x) || -1, sz = Math.sign(masts[0].z) || -1;
  const hx = sx, hz = sz * 0.34, hl = Math.hypot(hx, hz), r = KEY_DIST * Math.cos(KEY_ELEV);
  const sun = new THREE.DirectionalLight(0xdfe9ff, KEY_I * intensity);   // metal-halide: distinctly cool
  sun.position.set((hx / hl) * r, KEY_DIST * Math.sin(KEY_ELEV), (hz / hl) * r);
  sun.castShadow = true;
  sun.shadow.mapSize.set(shadowMapSize, shadowMapSize);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;   // grass and roof slabs are huge flat quads — normalBias kills the acne
  group.add(sun); group.add(sun.target);   // the target stays at local (0,0,0) = the centre spot
  fitShadowToPitch(sun, L, W);

  // FOUR FLOODLIGHT BANKS — visible pools + mast glow, no shadows (see the header).
  const spots = [];
  const headGeo = new THREE.PlaneGeometry(2.0, 1.15); disposables.push(headGeo);
  const headMat = new THREE.MeshStandardNodeMaterial({
    color: 0x0b0d12, emissive: new THREE.Color(0xeaf2ff), emissiveIntensity: 7 * intensity,
    roughness: 0.35, side: THREE.DoubleSide,
  });
  disposables.push(headMat);
  for (const m of masts) {
    // Each mast washes ITS OWN quadrant. Four corner masts all aimed at the centre spot stack one hot
    // spot on the halfway line and leave the four corner flags in the dark.
    const ax = Math.sign(m.x || 1) * L * 0.3, az = Math.sign(m.z || 1) * W * 0.25;
    const d = Math.hypot(m.x - ax, m.y, m.z - az);
    // distance 0 = no cutoff: a finite `distance` draws a visible ring across the grass where the
    // window function reaches zero, and at these ranges that ring always lands mid-pitch.
    const spot = new THREE.SpotLight(0xf0f5ff, 1, 0, 0.62, 0.55, 2);
    // Intensity is CANDELA and decay is 2, so irradiance at the aim point is I/d². Deriving I from the
    // real mast distance is what keeps a tier-1 pylon (14.5 m, close in) and a tier-5 roof rig at the
    // same level on the grass instead of one of them being a white hole.
    spot.intensity = POOL_E * d * d * intensity;
    spot.position.set(m.x, m.y, m.z);
    spot.target.position.set(ax, 0, az);
    spot.castShadow = false;
    group.add(spot); group.add(spot.target); spots.push(spot);
    // Emissive lens face so the mast reads as the source of its own pool, and so bloom (threshold 1.0
    // in PostFX.js) has something over 1 to bleed. Nudged 0.25 m toward the pitch so it never z-fights
    // the head box stadium-builder already puts at exactly this point on 'pylon' tiers.
    const head = new THREE.Mesh(headGeo, headMat);
    const k = 0.25 / (Math.hypot(m.x, m.z) || 1);
    head.position.set(m.x * (1 - k), m.y, m.z * (1 - k));
    group.add(head);
    // lookAt() resolves its argument in WORLD space and reads the mesh's own WORLD position — hence
    // add() first, and `at` added to the aim. The other order points every head at the world origin
    // as soon as the stadium is not at [0,0,0].
    head.lookAt(at[0] + ax, at[1], at[2] + az);
  }

  return {
    group, sun, spots, scene, doused: doused.map(([l]) => l),
    dispose() {
      scene.remove(group);
      for (const [l, v] of doused) l.visible = v;
      scene.background = prev.bg; scene.backgroundBlurriness = prev.blur;
      scene.environment = prev.env; scene.environmentIntensity = prev.envI; scene.fog = prev.fog;
      sun.shadow.dispose?.();      // the depth target: a leaked 2048² map per scene switch adds up fast
      pmrem?.dispose();
      for (const d of disposables) d.dispose?.();
    },
  };
}

/** Contract: the night rig is actually lighting the PITCH. Run after setup and after any re-aim. */
export function checkStadiumNight(result, model) {
  const issues = [];
  if (!result?.group) return { ok: false, issues: ['aucun groupe de nuit (setupStadiumNight n\'a rien renvoyé)'] };
  const L = model?.pitch?.L ?? 105, W = model?.pitch?.W ?? 68, sun = result.sun;
  result.group.updateMatrixWorld(true);
  const g = result.group.position, grassY = g.y;          // grass top = at[1] = the group's own Y
  const lights = [];
  result.group.traverse((o) => { if (o.isLight) lights.push(o); });

  // 1. something must cast a shadow — a night pitch with no hard shadow under the player reads as an
  //    unlit turntable render, and GodraysNode needs the shadow map to raymarch at all.
  if (!lights.some((l) => l.castShadow && l.visible && l.intensity > 0)) issues.push('aucune lumière projetant des ombres (le joueur flotte sans ombre)');
  if (sun && !sun.castShadow) issues.push('la lumière `sun` renvoyée ne projette pas d\'ombre — les godrays n\'auront pas de shadow map à échantillonner');
  if (sun && !(sun.isDirectionalLight || sun.isPointLight)) issues.push('`sun` n\'est ni directionnelle ni ponctuelle — GodraysNode rejette ce type de lumière');

  // 2. the shadow frustum must really contain the pitch, corners included
  if (sun?.castShadow) {
    sun.updateWorldMatrix(true, false); sun.target.updateWorldMatrix(true, false);
    sun.shadow.updateMatrices(sun);                        // rebuilds the shadow camera from the light
    const cam = sun.shadow.camera, v = new THREE.Vector3();
    let out = 0;
    // Tested in VIEW space, never in NDC: the orthographic z range differs between the WebGL and the
    // WebGPU coordinate systems, so a ±1 clip test silently passes on one backend and fails on the other.
    for (const px of [-L / 2, L / 2]) for (const pz of [-W / 2, W / 2]) for (const py of [0, 2.5]) {
      v.set(g.x + px, grassY + py, g.z + pz).applyMatrix4(cam.matrixWorldInverse);
      const depth = -v.z;
      if (v.x < cam.left || v.x > cam.right || v.y < cam.bottom || v.y > cam.top || depth < cam.near || depth > cam.far) out++;
    }
    if (out) issues.push(`la shadow camera ne couvre pas la pelouse (${out}/8 coins hors du frustum) — ombres tronquées en bord de terrain`);
    const span = Math.max(cam.right - cam.left, cam.top - cam.bottom);
    if (span > (L + 2 * PITCH_PAD) * 2.2) issues.push(`frustum d'ombre trop large (${span.toFixed(0)} m) — il englobe le stade au lieu du terrain, les ombres seront floues`);
  }

  // 3. four visible BEAMS (hemisphere/ambient don't count — they light nothing in particular)
  const beams = lights.filter((l) => l.visible && l.intensity > 0 && !l.isAmbientLight && !l.isHemisphereLight);
  if (beams.length < 4) issues.push(`seulement ${beams.length} source(s) dirigée(s) visible(s) — il en faut au moins 4 (les quatre mâts)`);

  // 4. nothing underground: a floodlight below the grass lights the stands from beneath
  const w = new THREE.Vector3();
  for (const l of lights) {
    l.getWorldPosition(w);
    if (w.y < grassY - 1e-3) issues.push(`${l.type} sous la pelouse (y=${w.y.toFixed(2)} < ${grassY.toFixed(2)})`);
  }

  // 5. NOBODY ELSE IS LIGHTING THIS SCENE. The check that was missing, and the reason a "night match"
  //    rendered as a bright afternoon with every other assertion green: the engine's boot lighting had
  //    left an analytic daytime sun in the scene, outside this group, where a contract scoped to its own
  //    group is blind to it. Swapping the IBL does nothing to an analytic light. A single unhidden
  //    DirectionalLight at 2.4 out-lights the entire floodlight rig.
  //    Hemisphere/ambient fills are tolerated below a token intensity — they cost nothing and some
  //    scenes add one; a directional or a spot is never innocent here.
  const outside = [];
  result.scene?.traverse((o) => {
    if (!o.isLight || !o.visible || o.intensity <= 0 || isUnder(o, result.group)) return;
    if ((o.isAmbientLight || o.isHemisphereLight) && o.intensity <= 0.15) return;
    outside.push(o);
  });
  if (outside.length) issues.push(`${outside.length} lumière(s) hors du rig de nuit encore allumée(s) (${outside.map((l) => `${l.type}@${l.intensity}`).join(', ')}) — la nuit sera lavée en plein jour`);

  // 6. LE BUDGET DE NUIT. Ce qui fait la nuit n'est pas la couleur du ciel, c'est le RAPPORT entre la
  //    clé et l'ambiance : un stade éclairé fait ~1 500 lux, le plein jour ~100 000. Le premier rig
  //    livré gardait une clé à 2,0 (le soleil du moteur est à 2,4) et rendait un après-midi malgré un
  //    ciel noir et tous les autres contrats verts. Mesuré sur l'image : luminance moyenne mesurée 0,40, là où
  //    une image de match en nocturne se tient vers 0,15. D'où une assertion sur les niveaux eux-mêmes.
  if (sun && sun.intensity > 1.4) issues.push(`clé à ${sun.intensity.toFixed(2)} : c'est un niveau de SOLEIL (le rig de jour est à 2,4), la scène rendra un après-midi`);
  const envI = result.scene?.environmentIntensity;
  if (envI != null && envI > 0.3) issues.push(`environmentIntensity ${envI.toFixed(2)} : IBL de jour sur une scène de nuit, les tribunes seront lavées`);
  const fill = lights.filter((l) => l.isAmbientLight || l.isHemisphereLight).reduce((s, l) => s + (l.visible ? l.intensity : 0), 0);
  if (sun && fill > sun.intensity * 0.35) issues.push(`ambiance ${fill.toFixed(2)} contre une clé de ${sun.intensity.toFixed(2)} : trop plate, l'ombre ne se lira plus`);
  return { ok: issues.length === 0, issues };
}
