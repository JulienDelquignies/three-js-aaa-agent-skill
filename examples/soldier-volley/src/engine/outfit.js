import * as THREE from 'three/webgpu';
import { loft, sphere, transform, checkMesh } from './meshkit.js';

// outfit — LAYERED CLOTHING over a skinned character: a long coat (manteau long) built with
// meshkit in WORLD space around the rig's bind pose, then SKINNED by proximity so it follows
// hips, legs and arms. No mesh editing tools needed: the coat is generated around whatever rig
// it is handed (bone world positions drive every measurement).
//
// The skinning trick: a fresh THREE.Skeleton over the SAME bone objects with boneInverses
// computed from the CURRENT world matrices (bind = now). Geometry authored in world space +
// bindMode 'attached' (bindMatrixInverse tracks matrixWorld each frame) means the skinned result
// is pure world-space bone motion — the mesh can live INSIDE the model wrapper (so visibility
// toggles like "hide the player while driving" carry the coat) at any transform.

const SEG = 14;                                                    // ring segments (low-poly AAA)

/** ellipse ring around y axis at centre c, radii rx/rz — order matches an ascending lathe */
const ring = (c, rx, rz) => {
  const pts = [];
  for (let i = 0; i < SEG; i++) {
    const a = (i / SEG) * Math.PI * 2;
    pts.push([c[0] + Math.cos(a) * rx, c[1], c[2] + Math.sin(a) * rz]);
  }
  return pts;
};
/** ring perpendicular to axis d at centre c (for sleeves) */
const ringAxis = (c, d, r) => {
  const up = Math.abs(d[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = norm(cross(d, up)), v = norm(cross(d, u));
  const pts = [];
  for (let i = 0; i < SEG; i++) {
    const a = (i / SEG) * Math.PI * 2;
    pts.push([c[0] + (u[0] * Math.cos(a) + v[0] * Math.sin(a)) * r,
              c[1] + (u[1] * Math.cos(a) + v[1] * Math.sin(a)) * r,
              c[2] + (u[2] * Math.cos(a) + v[2] * Math.sin(a)) * r]);
  }
  return pts;
};
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** distance from point p to segment ab */
function segDist(p, a, b) {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
  const t = Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / ((ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2) || 1)));
  return Math.hypot(p[0] - a[0] - ab[0] * t, p[1] - a[1] - ab[1] * t, p[2] - a[2] - ab[2] * t);
}

function findBones(model) {
  const by = new Map();
  model.traverse((o) => { if (o.isBone) { const suf = o.name.replace(/^mixamorig\d*/i, ''); if (!by.has(suf)) by.set(suf, o); } });
  return by;
}
const wpos = (b) => { const v = new THREE.Vector3(); b.getWorldPosition(v); return [v.x, v.y, v.z]; };

/**
 * Build the long coat over a rig standing in bind pose (call at load, after scale/placement).
 * Returns { group, meshes, check } — add group under the model wrapper.
 */
export function buildLongCoat(model, { color = 0x2a3140, collar = 0x1e242f, roughness = 0.78, hem = null } = {}) {
  model.updateMatrixWorld(true);
  const by = findBones(model);
  const need = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightArm', 'RightForeArm', 'RightHand', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot', 'LeftShoulder', 'RightShoulder'];
  for (const n of need) if (!by.has(n)) return { group: null, meshes: [], check: { ok: false, issues: [`os manquant: ${n}`] } };
  const P = Object.fromEntries(need.map((n) => [n, wpos(by.get(n))]));

  // ---- key measurements from the rig itself
  const neckY = P.Neck[1], hipsY = P.Hips[1];
  const kneeY = (P.LeftLeg[1] + P.RightLeg[1]) / 2, ankleY = (P.LeftFoot[1] + P.RightFoot[1]) / 2;
  const hemY = hem ?? (kneeY + ankleY) / 2 + 0.06;                 // mid-calf: LONG
  const shoulderHalf = Math.abs(P.LeftArm[0] - P.RightArm[0]) / 2; // ≈ torso half width
  const cx = (P.LeftArm[0] + P.RightArm[0]) / 2;
  const cz = P.Hips[2];

  // ---- CORPS: lofted bottom→top (ascending, like a lathe profile — reference/43)
  const w = shoulderHalf + 0.07;                                   // coat sits OVER the shirt
  const shoulderY = (P.LeftArm[1] + P.RightArm[1]) / 2;
  const sections = [
    ring([cx, hemY, cz], w * 1.55, w * 1.28),                      // flared hem
    ring([cx, hemY + (hipsY - hemY) * 0.45, cz], w * 1.32, w * 1.06),
    ring([cx, hipsY - 0.06, cz], w * 1.12, w * 0.86),
    ring([cx, (hipsY + neckY) / 2, cz], w * 1.06, w * 0.76),
    ring([cx, shoulderY - 0.02, cz], w * 1.18, w * 0.8),           // real carrure at shoulder height
    ring([cx, shoulderY + 0.07, cz], w * 0.9, w * 0.66),
    ring([cx, neckY + 0.02, cz], w * 0.5, w * 0.46),               // close over the shoulders
  ];
  const corps = loft(sections);
  // ---- COL: a short flared band around the neck
  const colR = w * 0.42;
  const col = loft([
    ring([cx, neckY - 0.005, cz], colR, colR * 0.92),
    ring([cx, neckY + 0.038, cz], colR * 1.16, colR * 1.06),
    ring([cx, neckY + 0.058, cz], colR * 1.0, colR * 0.92),
  ]);
  // ---- MANCHES: tubes shoulder→wrist along each arm (long sleeves)
  const sleeve = (side) => {
    const a = P[`${side}Arm`], f = P[`${side}ForeArm`], h = P[`${side}Hand`];
    const d1 = norm([f[0] - a[0], f[1] - a[1], f[2] - a[2]]);
    const d2 = norm([h[0] - f[0], h[1] - f[1], h[2] - f[2]]);
    const start = lerp3(a, f, -0.32);                              // overlap the shoulder deeply
    const wrist = lerp3(f, h, 0.82);
    return loft([
      ringAxis(start, d1, 0.085), ringAxis(lerp3(a, f, 0.5), d1, 0.075),
      ringAxis(f, norm([d1[0] + d2[0], d1[1] + d2[1], d1[2] + d2[2]]), 0.068),
      ringAxis(lerp3(f, h, 0.45), d2, 0.06), ringAxis(wrist, d2, 0.056),
    ]);
  };
  const parts = [
    { name: 'corps', mesh: corps, color, flip: false },
    { name: 'col', mesh: col, color: collar, flip: false },
    { name: 'mancheG', mesh: sleeve('Left'), color, flip: false },
    { name: 'mancheD', mesh: sleeve('Right'), color, flip: false },
  ];
  // orientation self-check (extrudePoly-style): a lofted solid wound inside-out reports
  // non-positive volume — flip its triangles rather than fail
  for (const p of parts) {
    let c = checkMesh(p.mesh, { maxTris: 4000 });
    if (!c.ok && c.issues.some((i) => /volume/.test(i))) {
      for (let i = 0; i < p.mesh.indices.length; i += 3) { const t = p.mesh.indices[i + 1]; p.mesh.indices[i + 1] = p.mesh.indices[i + 2]; p.mesh.indices[i + 2] = t; }
      if (p.mesh.normals) for (let i = 0; i < p.mesh.normals.length; i++) p.mesh.normals[i] *= -1;
      c = checkMesh(p.mesh, { maxTris: 4000 });
    }
    p.contract = c;
  }

  // ---- the shared skeleton: fresh inverses at TODAY's world pose
  const bones = []; model.traverse((o) => { if (o.isBone) bones.push(o); });
  const skeleton = new THREE.Skeleton(bones);                      // computes boneInverses from matrixWorld
  const idx = new Map(bones.map((b, i) => [b, i]));
  const B = (suf) => idx.get(by.get(suf));

  // ---- per-vertex weights
  const seg = {
    torso: [
      { b: 'Hips', a: P.Hips, c: lerp3(P.Hips, P.Neck, 0.25) },
      { b: 'Spine', a: lerp3(P.Hips, P.Neck, 0.2), c: lerp3(P.Hips, P.Neck, 0.5) },
      { b: 'Spine1', a: lerp3(P.Hips, P.Neck, 0.45), c: lerp3(P.Hips, P.Neck, 0.75) },
      { b: 'Spine2', a: lerp3(P.Hips, P.Neck, 0.7), c: P.Neck },
    ],
    legs: [
      { b: 'LeftUpLeg', a: P.LeftUpLeg, c: P.LeftLeg }, { b: 'RightUpLeg', a: P.RightUpLeg, c: P.RightLeg },
      { b: 'LeftLeg', a: P.LeftLeg, c: P.LeftFoot }, { b: 'RightLeg', a: P.RightLeg, c: P.RightFoot },
    ],
  };
  const weigh = (p, kind) => {
    if (kind === 'sleeveL' || kind === 'sleeveR') {
      const s = kind === 'sleeveL' ? 'Left' : 'Right';
      const cands = [
        { i: B(`${s}Shoulder`), d: segDist(p, P[`${s}Shoulder`], P[`${s}Arm`]) },
        { i: B(`${s}Arm`), d: segDist(p, P[`${s}Arm`], P[`${s}ForeArm`]) },
        { i: B(`${s}ForeArm`), d: segDist(p, P[`${s}ForeArm`], P[`${s}Hand`]) },
      ];
      return top4(cands);
    }
    if (p[1] >= hipsY - 0.08) {                                    // torso: two nearest spine links
      const cands = seg.torso.map((s) => ({ i: B(s.b), d: segDist(p, s.a, s.c) + 1e-4 }));
      return top4(cands, 2);
    }
    // skirt: hips keep a grip that fades toward the hem; thighs/shins take over near the legs —
    // and ADAPTIVELY: fabric sitting right on a leg follows that leg (else the knee pokes through
    // the hem at full stride, caught on the first run screenshot)
    const t = Math.min(1, Math.max(0, (hipsY - p[1]) / Math.max(0.001, hipsY - hemY)));   // 0 hip → 1 hem
    const cands = seg.legs.map((s) => ({ i: B(s.b), d: segDist(p, s.a, s.c) + 1e-4 }));
    const legTop = top4(cands, 2);
    const mind = Math.min(...cands.map((c) => c.d));
    const hipW = (0.75 - 0.55 * t) * Math.min(1, Math.max(0.3, mind / 0.14));
    const out = [[B('Hips'), hipW]];
    const rest = 1 - hipW, sum = legTop.reduce((a, x) => a + x[1], 0) || 1;
    for (const [i, ww] of legTop) out.push([i, (ww / sum) * rest]);
    return out;
  };
  const top4 = (cands, keep = 3) => {
    cands.sort((a, b) => a.d - b.d);
    const kept = cands.slice(0, keep).map((c) => ({ i: c.i, w: 1 / (c.d * c.d + 1e-5) }));
    const sum = kept.reduce((a, c) => a + c.w, 0);
    return kept.map((c) => [c.i, c.w / sum]);
  };

  // ---- assemble SkinnedMeshes
  const group = new THREE.Group(); group.name = 'manteau';
  const meshes = [];
  for (const p of parts) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(p.mesh.positions, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(p.mesh.normals, 3));
    geo.setIndex(new THREE.BufferAttribute(p.mesh.indices, 1));
    const n = p.mesh.positions.length / 3;
    const si = new Float32Array(n * 4), sw = new Float32Array(n * 4);
    const kind = p.name === 'mancheG' ? 'sleeveL' : p.name === 'mancheD' ? 'sleeveR' : p.name === 'col' ? 'collar' : 'torso';
    for (let i = 0; i < n; i++) {
      const pt = [p.mesh.positions[i * 3], p.mesh.positions[i * 3 + 1], p.mesh.positions[i * 3 + 2]];
      const ws = kind === 'collar' ? [[B('Neck'), 0.55], [B('Spine2'), 0.45]] : weigh(pt, kind);
      for (let k = 0; k < 4; k++) { si[i * 4 + k] = ws[k] ? ws[k][0] : 0; sw[i * 4 + k] = ws[k] ? ws[k][1] : 0; }
    }
    geo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
    geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    const mat = new THREE.MeshStandardNodeMaterial({ color: p.color, roughness, metalness: 0.04 });
    const mesh = new THREE.SkinnedMesh(geo, mat);
    mesh.name = `manteau_${p.name}`;
    mesh.castShadow = true; mesh.frustumCulled = false;
    mesh.bind(skeleton, new THREE.Matrix4());                      // identity bind + 'attached' mode
    group.add(mesh);
    meshes.push({ name: p.name, mesh, contract: p.contract });
  }
  const measures = { hemY, kneeY, ankleY, neckY, wristX: Math.abs(P.LeftHand[0] - cx) };
  const check = checkOutfit(meshes, model, measures);
  return { group, meshes, check, measures };
}

/**
 * Build the CASUAL outfit — sweat à capuche (baissée) + jean droit — over a rig in bind pose.
 * Same machinery as the coat (world-space meshkit parts, proximity weights, fresh-inverse
 * skeleton, 'attached' bind inside the wrapper), different garments and a different contract:
 * a sweat STOPS at the hips and a jean REACHES the ankles — literally tested by checkCasual.
 */
export function buildJeansSweat(model, { sweat = 0x8d939c, jeans = 0x3d5a80, hood = 0x7d838d, roughness = 0.85, sweatHem = null } = {}) {
  model.updateMatrixWorld(true);
  const by = findBones(model);
  const need = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightArm', 'RightForeArm', 'RightHand', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot', 'LeftShoulder', 'RightShoulder'];
  for (const n of need) if (!by.has(n)) return { group: null, meshes: [], check: { ok: false, issues: [`os manquant: ${n}`] } };
  const P = Object.fromEntries(need.map((n) => [n, wpos(by.get(n))]));

  const neckY = P.Neck[1], hipsY = P.Hips[1];
  const kneeY = (P.LeftLeg[1] + P.RightLeg[1]) / 2, ankleY = (P.LeftFoot[1] + P.RightFoot[1]) / 2;
  const shoulderY = (P.LeftArm[1] + P.RightArm[1]) / 2;
  const shoulderHalf = Math.abs(P.LeftArm[0] - P.RightArm[0]) / 2;
  const cx = (P.LeftArm[0] + P.RightArm[0]) / 2, cz = P.Hips[2];
  const w = shoulderHalf + 0.06;
  const hemY = sweatHem ?? hipsY - 0.05;
  // facing, derived from the rig (never assumed): forward = left-shoulder-axis × up
  const left = norm([P.LeftArm[0] - P.RightArm[0], 0, P.LeftArm[2] - P.RightArm[2]]);
  const back = norm(cross([0, 1, 0], left));                     // -forward

  // ---- SWEAT: loose torso, ribbed hem at the hips
  const storso = loft([
    ring([cx, hemY, cz], w * 1.0, w * 0.78),
    ring([cx, hipsY + 0.09, cz], w * 1.08, w * 0.84),
    ring([cx, (hipsY + neckY) / 2, cz], w * 1.1, w * 0.82),
    ring([cx, shoulderY - 0.02, cz], w * 1.2, w * 0.84),
    ring([cx, shoulderY + 0.07, cz], w * 0.92, w * 0.68),
    ring([cx, neckY + 0.02, cz], w * 0.52, w * 0.48),
  ]);
  const ssleeve = (side) => {
    const a = P[`${side}Arm`], f = P[`${side}ForeArm`], h = P[`${side}Hand`];
    const d1 = norm([f[0] - a[0], f[1] - a[1], f[2] - a[2]]);
    const d2 = norm([h[0] - f[0], h[1] - f[1], h[2] - f[2]]);
    return loft([
      ringAxis(lerp3(a, f, -0.3), d1, 0.088), ringAxis(lerp3(a, f, 0.5), d1, 0.08),
      ringAxis(f, norm([d1[0] + d2[0], d1[1] + d2[1], d1[2] + d2[2]]), 0.07),
      ringAxis(lerp3(f, h, 0.5), d2, 0.062), ringAxis(lerp3(f, h, 0.82), d2, 0.05),   // ribbed cuff
    ]);
  };
  // ---- CAPUCHE BAISSÉE: a soft lump resting on the upper back, behind the neck
  const hoodC = [P.Neck[0] + back[0] * 0.085, neckY, P.Neck[2] + back[2] * 0.085];
  const hoodMesh = transform(sphere(1, { segments: 14, rings: 9 }), { at: hoodC, rotY: Math.atan2(back[0], back[2]), scale: [w * 0.6, 0.08, 0.1] });
  // ---- JEAN: hip yoke + one straight tube per leg, down to the ankles (wider than the shorts
  // underneath — the white kit poked through the first fitting, caught on screenshot)
  const yoke = loft([
    ring([cx, hipsY - 0.17, cz], w * 1.0, w * 0.8),
    ring([cx, hipsY + 0.02, cz], w * 1.08, w * 0.86),
    ring([cx, hipsY + 0.11, cz], w * 0.98, w * 0.76),
  ]);
  const jeanLeg = (side) => {
    const u = P[`${side}UpLeg`], k = P[`${side}Leg`], f = P[`${side}Foot`];
    const d1 = norm([k[0] - u[0], k[1] - u[1], k[2] - u[2]]);
    const d2 = norm([f[0] - k[0], f[1] - k[1], f[2] - k[2]]);
    return loft([
      ringAxis(lerp3(u, k, -0.18), d1, 0.108),
      ringAxis(lerp3(u, k, 0.5), d1, 0.1),
      ringAxis(k, norm([d1[0] + d2[0], d1[1] + d2[1], d1[2] + d2[2]]), 0.09),
      ringAxis(lerp3(k, f, 0.55), d2, 0.08),
      ringAxis(lerp3(k, f, 0.9), d2, 0.075),                     // ankle, straight cut
    ]);
  };
  const parts = [
    { name: 'sweat', mesh: storso, color: sweat },
    { name: 'capuche', mesh: hoodMesh, color: hood },
    { name: 'mancheG', mesh: ssleeve('Left'), color: sweat },
    { name: 'mancheD', mesh: ssleeve('Right'), color: sweat },
    { name: 'jeanBassin', mesh: yoke, color: jeans },
    { name: 'jeanG', mesh: jeanLeg('Left'), color: jeans },
    { name: 'jeanD', mesh: jeanLeg('Right'), color: jeans },
  ];
  for (const p of parts) {
    let c = checkMesh(p.mesh, { maxTris: 4000 });
    if (!c.ok && c.issues.some((i) => /volume/.test(i))) {
      for (let i = 0; i < p.mesh.indices.length; i += 3) { const t = p.mesh.indices[i + 1]; p.mesh.indices[i + 1] = p.mesh.indices[i + 2]; p.mesh.indices[i + 2] = t; }
      if (p.mesh.normals) for (let i = 0; i < p.mesh.normals.length; i++) p.mesh.normals[i] *= -1;
      c = checkMesh(p.mesh, { maxTris: 4000 });
    }
    p.contract = c;
  }

  const bones = []; model.traverse((o) => { if (o.isBone) bones.push(o); });
  const skeleton = new THREE.Skeleton(bones);
  const idx = new Map(bones.map((b, i) => [b, i]));
  const B = (suf) => idx.get(by.get(suf));
  const torsoSeg = [
    { b: 'Hips', a: P.Hips, c: lerp3(P.Hips, P.Neck, 0.25) },
    { b: 'Spine', a: lerp3(P.Hips, P.Neck, 0.2), c: lerp3(P.Hips, P.Neck, 0.5) },
    { b: 'Spine1', a: lerp3(P.Hips, P.Neck, 0.45), c: lerp3(P.Hips, P.Neck, 0.75) },
    { b: 'Spine2', a: lerp3(P.Hips, P.Neck, 0.7), c: P.Neck },
  ];
  const top = (cands, keep = 2) => {
    cands.sort((a, b) => a.d - b.d);
    const kept = cands.slice(0, keep).map((c) => ({ i: c.i, w: 1 / (c.d * c.d + 1e-5) }));
    const sum = kept.reduce((a, c) => a + c.w, 0);
    return kept.map((c) => [c.i, c.w / sum]);
  };
  const weigh = (p, kind) => {
    if (kind === 'sleeveL' || kind === 'sleeveR') {
      const s = kind === 'sleeveL' ? 'Left' : 'Right';
      return top([
        { i: B(`${s}Shoulder`), d: segDist(p, P[`${s}Shoulder`], P[`${s}Arm`]) },
        { i: B(`${s}Arm`), d: segDist(p, P[`${s}Arm`], P[`${s}ForeArm`]) },
        { i: B(`${s}ForeArm`), d: segDist(p, P[`${s}ForeArm`], P[`${s}Hand`]) },
      ], 3);
    }
    if (kind === 'jeanL' || kind === 'jeanR') {
      const s = kind === 'jeanL' ? 'Left' : 'Right';
      return top([
        { i: B('Hips'), d: segDist(p, P.Hips, P[`${s}UpLeg`]) + 0.03 },
        { i: B(`${s}UpLeg`), d: segDist(p, P[`${s}UpLeg`], P[`${s}Leg`]) },
        { i: B(`${s}Leg`), d: segDist(p, P[`${s}Leg`], P[`${s}Foot`]) },
      ]);
    }
    if (kind === 'yoke') {
      return top([
        { i: B('Hips'), d: 0.04 },
        { i: B('LeftUpLeg'), d: segDist(p, P.LeftUpLeg, P.LeftLeg) + 0.05 },
        { i: B('RightUpLeg'), d: segDist(p, P.RightUpLeg, P.RightLeg) + 0.05 },
      ]);
    }
    if (kind === 'hood') return [[B('Neck'), 0.5], [B('Spine2'), 0.5]];
    return top(torsoSeg.map((s) => ({ i: B(s.b), d: segDist(p, s.a, s.c) + 1e-4 })));   // torso
  };

  const group = new THREE.Group(); group.name = 'tenue';
  const meshes = [];
  const KIND = { sweat: 'torso', capuche: 'hood', mancheG: 'sleeveL', mancheD: 'sleeveR', jeanBassin: 'yoke', jeanG: 'jeanL', jeanD: 'jeanR' };
  for (const p of parts) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(p.mesh.positions, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(p.mesh.normals, 3));
    geo.setIndex(new THREE.BufferAttribute(p.mesh.indices, 1));
    const n = p.mesh.positions.length / 3;
    const si = new Float32Array(n * 4), sw = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      const ws = weigh([p.mesh.positions[i * 3], p.mesh.positions[i * 3 + 1], p.mesh.positions[i * 3 + 2]], KIND[p.name]);
      for (let k = 0; k < 4; k++) { si[i * 4 + k] = ws[k] ? ws[k][0] : 0; sw[i * 4 + k] = ws[k] ? ws[k][1] : 0; }
    }
    geo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
    geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshStandardNodeMaterial({ color: p.color, roughness, metalness: 0.02 }));
    mesh.name = `tenue_${p.name}`;
    mesh.castShadow = true; mesh.frustumCulled = false;
    mesh.bind(skeleton, new THREE.Matrix4());
    group.add(mesh);
    meshes.push({ name: p.name, mesh, contract: p.contract });
  }
  const measures = { style: 'casual', hemY, hipsY, kneeY, ankleY, neckY, wristX: Math.abs(P.LeftHand[0] - cx) };
  const check = checkCasual(meshes, model, measures);
  return { group, meshes, check, measures };
}

/** Contract for the casual outfit: generic skinning gates + garment-true coverage —
 *  a sweat ENDS at the hips (not a dress), a jean REACHES the ankles, sleeves the wrists. */
export function checkCasual(meshes, model, m = {}) {
  const issues = skinIssues(meshes, model);
  const sweat = meshes.find((p) => p.name === 'sweat');
  if (sweat && m.hipsY != null) {
    let minY = Infinity, maxY = -Infinity;
    const pos = sweat.mesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); if (y < minY) minY = y; if (y > maxY) maxY = y; }
    if (minY < m.hipsY - 0.14) issues.push(`sweat: ourlet à ${minY.toFixed(2)} — c'est une robe, pas un sweat (hanches ${m.hipsY.toFixed(2)})`);
    if (minY > m.hipsY + 0.12) issues.push('sweat: ourlet au-dessus des hanches (crop-top)');
    if (maxY < m.neckY - 0.12) issues.push('sweat: ne monte pas aux épaules');
  }
  const manche = meshes.find((p) => p.name === 'mancheG');
  if (manche && m.wristX) {
    const pos = manche.mesh.geometry.attributes.position;
    let maxR = 0;
    for (let i = 0; i < pos.count; i++) maxR = Math.max(maxR, Math.abs(pos.getX(i)));
    if (maxR < m.wristX * 0.78) issues.push(`manche trop courte (${maxR.toFixed(2)} < poignet ${m.wristX.toFixed(2)})`);
  }
  for (const legName of ['jeanG', 'jeanD']) {
    const leg = meshes.find((p) => p.name === legName);
    if (!leg || m.ankleY == null) continue;
    const pos = leg.mesh.geometry.attributes.position;
    let minY = Infinity;
    for (let i = 0; i < pos.count; i++) minY = Math.min(minY, pos.getY(i));
    if (minY > m.ankleY + 0.1) issues.push(`${legName}: coupé à ${minY.toFixed(2)}, n'atteint pas la cheville (${m.ankleY.toFixed(2)})`);
  }
  const capuche = meshes.find((p) => p.name === 'capuche');
  if (capuche && m.neckY != null) {
    const pos = capuche.mesh.geometry.attributes.position;
    let cy = 0; for (let i = 0; i < pos.count; i++) cy += pos.getY(i); cy /= pos.count;
    if (Math.abs(cy - m.neckY) > 0.2) issues.push('capuche loin de la nuque');
  }
  return { ok: issues.length === 0, issues };
}

/** Generic skinning gates shared by every outfit: per-part meshkit contract, normalized
 *  weights, valid bone indices. */
function skinIssues(meshes, model) {
  const issues = [];
  let nBones = 0; model.traverse((o) => { if (o.isBone) nBones++; });
  for (const part of meshes) {
    if (part.contract && !part.contract.ok) issues.push(`${part.name}: ${part.contract.issues[0]}`);
    const g = part.mesh.geometry;
    const sw = g.attributes.skinWeight, si = g.attributes.skinIndex;
    if (!sw || !si) { issues.push(`${part.name}: attributs de skin manquants`); continue; }
    for (let i = 0; i < sw.count; i++) {
      const s = sw.getX(i) + sw.getY(i) + sw.getZ(i) + sw.getW(i);
      if (Math.abs(s - 1) > 0.02) { issues.push(`${part.name}: poids non normalisés (v${i}: ${s.toFixed(3)})`); break; }
    }
    for (let i = 0; i < si.count * 4; i++) {
      const v = si.array[i];
      if (v < 0 || v >= nBones || !Number.isFinite(v)) { issues.push(`${part.name}: index d'os invalide (${v})`); break; }
    }
  }
  return issues;
}

/** Contract: coat geometry sane (per-part meshkit gate), weights normalized onto real bones,
 *  and the COVERAGE is really "vêtements longs" — hem below the knee, sleeves to the wrists. */
export function checkOutfit(meshes, model, m = {}) {
  const issues = [];
  let nBones = 0; model.traverse((o) => { if (o.isBone) nBones++; });
  for (const part of meshes) {
    if (part.contract && !part.contract.ok) issues.push(`${part.name}: ${part.contract.issues[0]}`);
    const g = part.mesh.geometry;
    const sw = g.attributes.skinWeight, si = g.attributes.skinIndex;
    if (!sw || !si) { issues.push(`${part.name}: attributs de skin manquants`); continue; }
    for (let i = 0; i < sw.count; i++) {
      const s = sw.getX(i) + sw.getY(i) + sw.getZ(i) + sw.getW(i);
      if (Math.abs(s - 1) > 0.02) { issues.push(`${part.name}: poids non normalisés (v${i}: ${s.toFixed(3)})`); break; }
    }
    for (let i = 0; i < si.count * 4; i++) {
      const v = si.array[i];
      if (v < 0 || v >= nBones || !Number.isFinite(v)) { issues.push(`${part.name}: index d'os invalide (${v})`); break; }
    }
  }
  const corps = meshes.find((p) => p.name === 'corps');
  if (corps && m.kneeY != null) {
    const pos = corps.mesh.geometry.attributes.position;
    let minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); if (y < minY) minY = y; if (y > maxY) maxY = y; }
    if (minY > m.kneeY - 0.02) issues.push(`ourlet à ${minY.toFixed(2)} au-dessus du genou (${m.kneeY.toFixed(2)}) — pas un manteau LONG`);
    if (maxY < m.neckY - 0.12) issues.push('le manteau ne monte pas aux épaules');
  }
  const manche = meshes.find((p) => p.name === 'mancheG');
  if (manche && m.wristX) {
    const pos = manche.mesh.geometry.attributes.position;
    let maxR = 0;
    for (let i = 0; i < pos.count; i++) maxR = Math.max(maxR, Math.abs(pos.getX(i)));
    if (maxR < m.wristX * 0.8) issues.push(`manche trop courte (${maxR.toFixed(2)} < poignet ${m.wristX.toFixed(2)})`);
  }
  return { ok: issues.length === 0, issues };
}
