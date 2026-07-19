import * as THREE from 'three/webgpu';

// rig-retarget — play one rig's AnimationClips on ANOTHER rig (Mixamo → Mixamo), bind-to-bind.
// Copying local quaternions across rigs FAILS twice: the hips parent frames differ (the classic
// Mixamo armature is rotated −90° X and in centimetres) and every bone's bind orientation is its
// own (probed live: the naive copy crumples the target into a ball). The correct transport is the
// WORLD-space delta: for each bone, srcWorld(t) = D(t)·srcBindWorld  ⇒  dstWorld(t) = D(t)·dstBindWorld,
// then locals are peeled off top-down (local = parentWorld⁻¹ · world). All world rotations are
// ROOT-RELATIVE, so each model's own yaw/scale/position never leaks into the tracks.
// Assumption (same as three's SkeletonUtils): both binds are the SAME posture (Mixamo T-pose).
//
// Quantized GLBs (glTF-Transform / KHR_mesh_quantization) additionally need dequantizeSkinned():
// normalized int16/uint16 vertex attributes explode under the WebGPU renderer's skinning path
// (weights read raw ⇒ vertices at ×65535) — probed live, fragments scattered across the screen.

const suffixOf = (name) => name.replace(/^mixamorig\d*/i, '');
const _m4 = new THREE.Matrix4(), _v = new THREE.Vector3(), _s = new THREE.Vector3();

/** Root-relative world rotation of a node (scale-safe: full decompose). */
function rrq(rootInv, node, out) {
  _m4.copy(rootInv).multiply(node.matrixWorld);
  _m4.decompose(_v, out, _s);
  return out;
}

/** Pose a model's bones directly from a clip's tracks at time t (no mixer, no binding cache). */
function poseFromClip(model, clip, t, bySuffix) {
  for (const tr of clip.tracks) {
    const dot = tr.name.lastIndexOf('.');
    const bone = bySuffix.get(suffixOf(tr.name.slice(0, dot)));
    if (!bone) continue;
    const v = (tr.__rtIt || (tr.__rtIt = tr.createInterpolant())).evaluate(t);
    const prop = tr.name.slice(dot + 1);
    if (prop === 'quaternion') bone.quaternion.set(v[0], v[1], v[2], v[3]);
    else if (prop === 'position') bone.position.set(v[0], v[1], v[2]);
  }
  model.updateMatrixWorld(true);
}

const boneMap = (model) => {
  const m = new Map();
  model.traverse((o) => { if (o.isBone && !m.has(suffixOf(o.name))) m.set(suffixOf(o.name), o); });
  return m;
};

/**
 * Retarget `clip` from the `src` rig onto the `dst` rig. `dst` must currently STAND IN ITS BIND
 * POSE (a freshly loaded model does). `src` is posed temporarily and restored afterwards.
 * @param {THREE.AnimationClip} clip     source clip (local tracks on src bone names)
 * @param {THREE.Object3D} src           source model root
 * @param {THREE.Object3D} dst           destination model root (in bind pose)
 * @param {object} opts  {fps=30, srcBindClip=null} — srcBindClip: a clip whose t=0 IS the src bind
 *                       pose (Mixamo exports ship a "TPose" clip); default: src's current pose.
 */
export function retargetClip(clip, src, dst, { fps = 30, srcBindClip = null } = {}) {
  const srcBones = boneMap(src), dstBones = boneMap(dst);
  const saved = [];
  src.traverse((o) => { if (o.isBone) saved.push({ o, q: o.quaternion.clone(), p: o.position.clone() }); });

  src.updateMatrixWorld(true); dst.updateMatrixWorld(true);
  const srcRootInv = _m4.copy(src.matrixWorld).invert().clone();
  const dstRootInv = new THREE.Matrix4().copy(dst.matrixWorld).invert();

  // ---- bind capture
  if (srcBindClip) poseFromClip(src, srcBindClip, 0, srcBones);
  const srcBind = new Map(), q0 = new THREE.Quaternion();
  for (const [suf, b] of srcBones) srcBind.set(suf, rrq(srcRootInv, b, new THREE.Quaternion()).invert());
  const srcHips = srcBones.get('Hips'), dstHips = dstBones.get('Hips');
  const srcHipsRest = srcHips.position.clone(), dstHipsRest = dstHips.position.clone();
  const srcBasis = new THREE.Matrix3().setFromMatrix4(_m4.copy(srcRootInv).multiply(srcHips.parent.matrixWorld));
  const dstBasisInv = new THREE.Matrix3().setFromMatrix4(_m4.copy(dstRootInv).multiply(dstHips.parent.matrixWorld)).invert();

  // ---- dst hierarchy, top-down: bind world rotation, static parent rotations for non-bone parents
  const order = [];
  const dstBind = new Map(), dstParentStatic = new Map();
  dst.traverse((o) => {
    if (!o.isBone) return;
    const suf = suffixOf(o.name);
    if (dstBones.get(suf) !== o) return;                       // duplicate suffix: first one wins
    let p = o.parent; while (p && !p.isBone) p = p.parent;
    order.push({ suf, name: o.name, parentSuf: p ? suffixOf(p.name) : null });
    dstBind.set(suf, rrq(dstRootInv, o, new THREE.Quaternion()));
    if (!p) dstParentStatic.set(suf, rrq(dstRootInv, o.parent, new THREE.Quaternion()));
  });

  // ---- bake
  const n = Math.max(2, Math.round(clip.duration * fps) + 1);
  const times = new Float32Array(n);
  const qOut = new Map(order.filter((o) => srcBones.has(o.suf)).map((o) => [o.suf, new Float32Array(n * 4)]));
  const pOut = new Float32Array(n * 3);
  const world = new Map(order.map((o) => [o.suf, new THREE.Quaternion()]));
  const wq = new THREE.Quaternion(), lq = new THREE.Quaternion(), d = new THREE.Vector3();
  for (let f = 0; f < n; f++) {
    const t = Math.min(clip.duration, f / fps); times[f] = t;
    poseFromClip(src, clip, t, srcBones);
    for (const o of order) {
      const parentW = o.parentSuf ? world.get(o.parentSuf) : dstParentStatic.get(o.suf);
      if (srcBones.has(o.suf)) {
        rrq(srcRootInv, srcBones.get(o.suf), wq);
        wq.multiply(srcBind.get(o.suf)).multiply(dstBind.get(o.suf));   // D(t)·dstBindWorld
        lq.copy(parentW).invert().multiply(wq);
        world.get(o.suf).copy(wq);
        const a = qOut.get(o.suf);
        a[f * 4] = lq.x; a[f * 4 + 1] = lq.y; a[f * 4 + 2] = lq.z; a[f * 4 + 3] = lq.w;
      } else {
        world.get(o.suf).copy(parentW).multiply(dstBones.get(o.suf).quaternion);
      }
    }
    d.copy(srcHips.position).sub(srcHipsRest).applyMatrix3(srcBasis).applyMatrix3(dstBasisInv).add(dstHipsRest);
    pOut[f * 3] = d.x; pOut[f * 3 + 1] = d.y; pOut[f * 3 + 2] = d.z;
  }

  for (const s of saved) { s.o.quaternion.copy(s.q); s.o.position.copy(s.p); }
  src.updateMatrixWorld(true);

  const tracks = [];
  for (const o of order) if (qOut.has(o.suf)) tracks.push(new THREE.QuaternionKeyframeTrack(`${o.name}.quaternion`, times, qOut.get(o.suf)));
  tracks.push(new THREE.VectorKeyframeTrack(`${dstHips.name}.position`, times, pOut));
  const out = new THREE.AnimationClip(clip.name, clip.duration, tracks);
  if (clip.userData) out.userData = { ...clip.userData };
  return out;
}

/** Contract: a retargeted clip is playable on this model and physically sane. */
export function checkRetarget(clip, dst) {
  const issues = [];
  const names = new Set(); dst.traverse((o) => names.add(o.name));
  let posTracks = 0;
  for (const tr of clip.tracks) {
    const dot = tr.name.lastIndexOf('.');
    const node = tr.name.slice(0, dot), prop = tr.name.slice(dot + 1);
    if (!names.has(node)) issues.push(`track sur un os absent du rig: ${node}`);
    for (let i = 0; i < tr.values.length; i++) if (!Number.isFinite(tr.values[i])) { issues.push(`valeurs non finies: ${tr.name}`); break; }
    for (let i = 1; i < tr.times.length; i++) if (tr.times[i] <= tr.times[i - 1]) { issues.push(`temps non croissants: ${tr.name}`); break; }
    if (prop === 'quaternion') {
      for (let i = 0; i < tr.values.length; i += 4) {
        const l = Math.hypot(tr.values[i], tr.values[i + 1], tr.values[i + 2], tr.values[i + 3]);
        if (Math.abs(l - 1) > 0.01) { issues.push(`quaternion non normalisé: ${tr.name}`); break; }
      }
    }
    if (prop === 'position') {
      posTracks++;
      if (!/Hips\.position$/.test(tr.name)) issues.push(`track position hors hanches: ${tr.name} (les proportions du rig source fuient)`);
    }
  }
  if (posTracks !== 1) issues.push(`${posTracks} tracks position (attendu: 1, les hanches)`);
  const hips = clip.tracks.find((t) => /Hips\.position$/.test(t.name));
  if (hips) {
    const dstBones = boneMap(dst), dh = dstBones.get('Hips');
    if (dh) {
      dst.updateMatrixWorld(true);
      const basis = new THREE.Matrix3().setFromMatrix4(_m4.copy(dst.matrixWorld).invert().multiply(dh.parent.matrixWorld));
      const rest = dh.position, dd = new THREE.Vector3();
      for (let i = 0; i < hips.times.length; i++) {
        dd.fromArray(hips.values, i * 3).sub(rest).applyMatrix3(basis);
        if (dd.length() > 1.6) { issues.push(`hanches à ${dd.length().toFixed(2)}m du repos (max 1.6m) — retarget d'échelle raté`); break; }
      }
    }
  }
  if (!(clip.duration > 0)) issues.push('durée nulle');
  return { ok: issues.length === 0, issues };
}

/** De-normalize quantized vertex attributes (KHR_mesh_quantization) to plain float32 and force
 *  alpha-0 materials visible. Run once on a freshly loaded quantized character GLB. */
export function dequantizeSkinned(model) {
  let converted = 0;
  model.traverse((o) => {
    if (!o.isMesh) return;
    for (const [name, att] of Object.entries(o.geometry.attributes)) {
      if (!att.normalized) continue;                            // skinIndex stays integer, raw floats stay
      const sz = att.itemSize, out = new Float32Array(att.count * sz);
      for (let i = 0; i < att.count; i++) for (let c = 0; c < sz; c++) out[i * sz + c] = att.getComponent(i, c);
      o.geometry.setAttribute(name, new THREE.BufferAttribute(out, sz, false));
      converted++;
    }
    if (o.material?.opacity === 0) { o.material.opacity = 1; o.material.transparent = true; }
  });
  return converted;
}
