#!/usr/bin/env node
// verify-retarget.mjs — the cross-rig animation transport (engine/rig-retarget.js). The ground
// truths this harness pins down:
//   IDENTITY   retargeting a clip onto a structural clone reproduces the SAME world motion
//   CROSS      a rig with the same bind POSTURE but a totally different parent-frame decomposition
//              (no −90° armature, metres instead of centimetres) still reproduces the world motion
//   CONTRACT   checkRetarget flags the named sabotages (foreign-bone position track, unnormalized
//              quaternion, hips teleported, track on a missing bone)
//   DEQUANT    normalized quantized attributes become plain float32 with identical decoded values
// Run from anywhere: three is resolved through examples/showcase/node_modules.
import * as THREE from '../../../examples/showcase/node_modules/three/build/three.webgpu.js';
import { retargetClip, checkRetarget, dequantizeSkinned } from '../../../examples/showcase/src/engine/rig-retarget.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };

// ---------- a synthetic "classic Mixamo" source rig: armature −90° X, centimetres
const CHAIN = [
  ['Hips', [0, 96, 2], [0.05, 0.1, 0]],
  ['Spine', [0, 10, 1], [-0.1, 0, 0.04]],
  ['Head', [0, 14, 1], [0.08, 0.05, 0]],
  ['LeftArm', [12, 12, 0], [0, 0, 1.05]],
  ['LeftForeArm', [26, 0, 0], [0, 0.2, 0.2]],
  ['LeftUpLeg', [9, -5, 0], [0.03, 0, 3.1]],
  ['LeftLeg', [0, 38, 0], [0.1, 0, 0]],
];
const PARENT = { Hips: null, Spine: 'Hips', Head: 'Spine', LeftArm: 'Spine', LeftForeArm: 'LeftArm', LeftUpLeg: 'Hips', LeftLeg: 'LeftUpLeg' };
function makeSrc() {
  const root = new THREE.Group();
  const arm = new THREE.Object3D(); arm.name = 'Armature'; arm.rotation.x = -Math.PI / 2; arm.scale.setScalar(0.01);
  root.add(arm);
  const bones = {};
  for (const [suf, p, e] of CHAIN) {
    const b = new THREE.Bone(); b.name = 'mixamorig' + suf;
    b.position.set(...p); b.rotation.set(...e);
    (PARENT[suf] ? bones[PARENT[suf]] : arm).add(b);
    bones[suf] = b;
  }
  root.updateMatrixWorld(true);
  return { root, bones };
}
// destination rig DERIVED numerically: identical bind WORLD posture, but flat metre-scale frames
// (armature = identity) — every bind LOCAL is therefore different from the source's.
function makeDstFrom(src) {
  const root = new THREE.Group();
  const armNode = new THREE.Object3D(); armNode.name = 'RootNode'; root.add(armNode);
  const bones = {}, srcRootInv = new THREE.Matrix4().copy(src.root.matrixWorld).invert();
  const wq = {}, wp = {};
  for (const [suf] of CHAIN) {
    const m = new THREE.Matrix4().copy(srcRootInv).multiply(src.bones[suf].matrixWorld);
    const q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
    m.decompose(v, q, s); wq[suf] = q; wp[suf] = v;
  }
  for (const [suf] of CHAIN) {
    const b = new THREE.Bone(); b.name = 'mixamorig5' + suf;
    const par = PARENT[suf];
    if (!par) { b.position.copy(wp[suf]); b.quaternion.copy(wq[suf]); armNode.add(b); }
    else {
      b.position.copy(wp[suf]).sub(wp[par]).applyQuaternion(wq[par].clone().invert());
      b.quaternion.copy(wq[par]).invert().multiply(wq[suf]);
      bones[par].add(b);
    }
    bones[suf] = b;
  }
  root.updateMatrixWorld(true);
  return { root, bones };
}
// a small dance: hips sway + arm/leg swings, 1s, keyed at 0/0.5/1 (+ hips position bob in cm)
function makeClip(src) {
  const q = (e) => new THREE.Quaternion().setFromEuler(new THREE.Euler(...e)).toArray();
  const tr = (suf, keys) => new THREE.QuaternionKeyframeTrack(`mixamorig${suf}.quaternion`,
    keys.map((k) => k.t), keys.flatMap((k) => q(k.e)));
  const rest = src.bones.Hips.position;
  return new THREE.AnimationClip('dance', 1, [
    tr('Hips', [{ t: 0, e: [0.05, 0.1, 0] }, { t: 0.5, e: [0.15, -0.2, 0.1] }, { t: 1, e: [0.05, 0.1, 0] }]),
    tr('Spine', [{ t: 0, e: [-0.1, 0, 0.04] }, { t: 0.5, e: [0.25, 0.3, -0.1] }, { t: 1, e: [-0.1, 0, 0.04] }]),
    tr('LeftArm', [{ t: 0, e: [0, 0, 1.05] }, { t: 0.5, e: [0.9, 0.4, 0.3] }, { t: 1, e: [0, 0, 1.05] }]),
    tr('LeftForeArm', [{ t: 0, e: [0, 0.2, 0.2] }, { t: 0.5, e: [0, 1.4, 0.2] }, { t: 1, e: [0, 0.2, 0.2] }]),
    tr('LeftUpLeg', [{ t: 0, e: [0.03, 0, 3.1] }, { t: 0.5, e: [0.6, 0, 3.0] }, { t: 1, e: [0.03, 0, 3.1] }]),
    tr('LeftLeg', [{ t: 0, e: [0.1, 0, 0] }, { t: 0.5, e: [1.1, 0, 0] }, { t: 1, e: [0.1, 0, 0] }]),
    new THREE.VectorKeyframeTrack('mixamorigHips.position',
      [0, 0.5, 1], [rest.x, rest.y, rest.z, rest.x + 3, rest.y - 8, rest.z + 12, rest.x, rest.y, rest.z]),
  ]);
}
const poseWith = (root, clip, t) => {
  const by = {}; root.traverse((o) => { if (o.isBone) by[o.name.replace(/^mixamorig\d*/, '')] = o; });
  for (const track of clip.tracks) {
    const dot = track.name.lastIndexOf('.');
    const b = by[track.name.slice(0, dot).replace(/^mixamorig\d*/, '')];
    if (!b) continue;
    const v = track.createInterpolant().evaluate(t);
    if (track.name.endsWith('quaternion')) b.quaternion.set(v[0], v[1], v[2], v[3]);
    else b.position.set(v[0], v[1], v[2]);
  }
  root.updateMatrixWorld(true);
  return by;
};
const worldOf = (root, by, suf) => {
  const m = new THREE.Matrix4().copy(root.matrixWorld).invert().multiply(by[suf].matrixWorld);
  const q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
  m.decompose(v, q, s); return { q, v };
};
// max angular error (rad) + hips position error (m) between two rigs playing their clips
function motionError(a, clipA, b, clipB) {
  let ang = 0, pos = 0;
  for (const t of [0, 0.2, 0.35, 0.5, 0.75, 1]) {
    const A = poseWith(a, clipA, t), B = poseWith(b, clipB, t);
    for (const [suf] of CHAIN) {
      const wa = worldOf(a, A, suf), wb = worldOf(b, B, suf);
      ang = Math.max(ang, wa.q.angleTo(wb.q));
    }
    const ha = worldOf(a, A, 'Hips').v, hb = worldOf(b, B, 'Hips').v;
    pos = Math.max(pos, ha.distanceTo(hb));
  }
  return { ang, pos };
}

// ---------- IDENTITY: onto a same-frames clone (renamed bones)
{
  const src = makeSrc(), clip = makeClip(src);
  const clone = makeSrc();
  clone.root.traverse((o) => { if (o.isBone) o.name = o.name.replace('mixamorig', 'mixamorig5'); });
  const out = retargetClip(clip, src.root, clone.root);
  const err = motionError(src.root, clip, clone.root, out);
  ok(`identité : même mouvement monde (Δang ${(err.ang * 180 / Math.PI).toFixed(2)}°, Δhanches ${(err.pos * 100).toFixed(1)}cm)`, err.ang < 0.02 && err.pos < 0.01);
  const c = checkRetarget(out, clone.root);
  ok('identité : contrat OK', c.ok, c.issues[0] || '');
}
// ---------- CROSS: different parent-frame decomposition, same bind posture
{
  const src = makeSrc(), clip = makeClip(src);
  const dst = makeDstFrom(src);
  const out = retargetClip(clip, src.root, dst.root);
  const err = motionError(src.root, clip, dst.root, out);
  ok(`cross-rig : même mouvement monde (Δang ${(err.ang * 180 / Math.PI).toFixed(2)}°, Δhanches ${(err.pos * 100).toFixed(1)}cm)`, err.ang < 0.02 && err.pos < 0.01);
  const c = checkRetarget(out, dst.root);
  ok('cross-rig : contrat OK', c.ok, c.issues[0] || '');
  ok('cross-rig : la track hanches est en unités DESTINATION (mètres, pas cm)', (() => {
    const h = out.tracks.find((t) => t.name.endsWith('Hips.position'));
    let max = 0; for (const v of h.values) max = Math.max(max, Math.abs(v));
    return max < 2;                                       // cm leak would put values near 100
  })());
  // src pose restored after the bake
  ok('source restaurée après le bake', Math.abs(src.bones.Hips.rotation.x - 0.05) < 1e-6);
}
// ---------- src bind via a TPose-style clip
{
  const src = makeSrc(), clip = makeClip(src);
  // scramble src's CURRENT pose (as if mid-idle), hand the true bind as a clip
  const bindClip = makeClip(src); bindClip.duration = 0.03;   // t=0 keys ARE the bind pose here
  src.bones.Spine.rotation.set(0.7, 0.5, 0.3);
  src.root.updateMatrixWorld(true);
  const dst = makeDstFrom(makeSrc());
  const out = retargetClip(clip, src.root, dst.root, { srcBindClip: bindClip });
  const err = motionError(makeSrc().root, clip, dst.root, out);
  ok(`bind par clip TPose malgré une pose courante brouillée (Δang ${(err.ang * 180 / Math.PI).toFixed(2)}°)`, err.ang < 0.02);
}
// ---------- contract sabotages
{
  const src = makeSrc(), clip = makeClip(src);
  const dst = makeDstFrom(src);
  const out = retargetClip(clip, src.root, dst.root);
  const sab = (name, mutate, needle) => {
    const bad = out.clone(); mutate(bad);
    const c = checkRetarget(bad, dst.root);
    ok(`sabotage « ${name} » attrapé`, !c.ok && c.issues.some((i) => i.includes(needle)), c.issues[0] || 'RIEN');
  };
  sab('track position sur un autre os', (b) => b.tracks.push(new THREE.VectorKeyframeTrack('mixamorig5Spine.position', [0], [0, 0.1, 0])), 'hors hanches');
  sab('quaternion dénormalisé', (b) => { const t = b.tracks.find((x) => x.name.endsWith('Spine.quaternion')); t.values[0] = 4; }, 'normalisé');
  sab('hanches téléportées', (b) => { const t = b.tracks.find((x) => x.name.endsWith('Hips.position')); for (let i = 0; i < t.values.length; i += 3) t.values[i] += 30; }, 'du repos');
  sab('os inconnu', (b) => b.tracks.push(new THREE.QuaternionKeyframeTrack('fantome.quaternion', [0], [0, 0, 0, 1])), 'absent');
}
// ---------- dequantize
{
  const geo = new THREE.BufferGeometry();
  const w = new Uint16Array([65535, 0, 0, 0, 32768, 32767, 0, 0]);
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(w, 4, true));         // normalized
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(new Uint8Array([1, 2, 0, 0, 3, 4, 0, 0]), 4, false));
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3, false));
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
  const n = dequantizeSkinned(mesh);
  const sw = mesh.geometry.attributes.skinWeight, si = mesh.geometry.attributes.skinIndex;
  ok('déquantifié : skinWeight → float32 aux valeurs décodées', n === 1 && sw.array instanceof Float32Array && Math.abs(sw.array[0] - 1) < 1e-4 && Math.abs(sw.array[4] - 0.50001) < 1e-3);
  ok('déquantifié : skinIndex reste ENTIER brut', si.array instanceof Uint8Array && si.array[0] === 1);
}

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
