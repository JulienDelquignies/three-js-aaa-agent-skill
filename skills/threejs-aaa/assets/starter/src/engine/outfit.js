import * as THREE from 'three/webgpu';
import { loft, sphere, sweep, extrudePoly, roundedRect, transform, merge, checkMesh } from './meshkit.js';
import { fabricMaterial, denimSeamMaterial } from './fabric.js';

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

const SEG = 24;                                                    // ring segments — smooth silhouette

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
const mergeMeshes = (arr) => merge(arr);
const mixHex = (hex, toward, t) => new THREE.Color(hex).lerp(new THREE.Color(toward), t).getHex();

/** Orient a meshkit mesh built in the XZ plane (thin along +Y, as extrudePoly makes it) onto a
 *  surface: local x→U, local y→N (surface normal, the thin/depth axis), local z→V, then translate
 *  to `at`. Used to lay flat pocket slabs onto the vertical body surface. */
function orient(mesh, at, U, N, V) {
  const p = mesh.positions, n = mesh.normals;
  for (let i = 0; i < p.length; i += 3) {
    const x = p[i], y = p[i + 1], z = p[i + 2];
    p[i] = at[0] + U[0] * x + N[0] * y + V[0] * z;
    p[i + 1] = at[1] + U[1] * x + N[1] * y + V[1] * z;
    p[i + 2] = at[2] + U[2] * x + N[2] * y + V[2] * z;
    if (n) { const nx = n[i], ny = n[i + 1], nz = n[i + 2];
      n[i] = U[0] * nx + N[0] * ny + V[0] * nz;
      n[i + 1] = U[1] * nx + N[1] * ny + V[1] * nz;
      n[i + 2] = U[2] * nx + N[2] * ny + V[2] * nz; }
  }
  return mesh;
}

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

/** World-space point cloud of the character's SKIN at bind (skeletons force-updated — no render
 *  has happened yet at build time). This is what garments are TAILORED against: guessing radii
 *  makes a bonhomme Michelin; measuring the body makes clothes. */
function bodyCloud(model) {
  model.updateMatrixWorld(true);
  const seen = new Set(), pts = [];
  const v = new THREE.Vector3();
  model.traverse((o) => {
    if (!o.isSkinnedMesh || /^(manteau|tenue)_/.test(o.name)) return;
    if (o.skeleton && !seen.has(o.skeleton)) { seen.add(o.skeleton); o.skeleton.update(); }
    const n = o.geometry.attributes.position.count;
    for (let i = 0; i < n; i += 2) { o.getVertexPosition(i, v).applyMatrix4(o.matrixWorld); pts.push(v.x, v.y, v.z); }
  });
  return pts;
}

/** A garment ring FITTED to the body: per angular sector, the body's max radial extent in a slab
 *  around the station, plus a clearance. Empty sectors borrow neighbours; no body data at all
 *  (e.g. a bones-only test rig) falls back to the analytic radius. */
function fitRing(cloud, c, d, u, v, { clear = 0.02, slab = 0.05, maxR = 0.3, cap = Infinity, fallback = 0.08, exclude = null } = {}) {
  const r = new Array(SEG).fill(0);
  for (let i = 0; i < cloud.length; i += 3) {
    const px = cloud[i] - c[0], py = cloud[i + 1] - c[1], pz = cloud[i + 2] - c[2];
    const along = px * d[0] + py * d[1] + pz * d[2];
    if (Math.abs(along) > slab) continue;
    const rx = px - d[0] * along, ry = py - d[1] * along, rz = pz - d[2] * along;
    const ru = rx * u[0] + ry * u[1] + rz * u[2], rv = rx * v[0] + ry * v[1] + rz * v[2];
    const rad = Math.hypot(ru, rv);
    if (rad > maxR || rad < 1e-4) continue;
    if (exclude && exclude(cloud[i], cloud[i + 1], cloud[i + 2])) continue;
    const sect = (Math.floor((Math.atan2(rv, ru) / (Math.PI * 2)) * SEG) + SEG * 2) % SEG;
    if (rad > r[sect]) r[sect] = rad;
  }
  for (let pass = 0; pass < SEG; pass++) {
    let empty = false;
    for (let i = 0; i < SEG; i++) if (!r[i]) { const a = r[(i + 1) % SEG], b = r[(i - 1 + SEG) % SEG]; if (a || b) r[i] = Math.max(a, b) * 0.96; else empty = true; }
    if (!empty) break;
  }
  const has = r.some((x) => x > 0);
  const pts = []; let mean = 0;
  for (let i = 0; i < SEG; i++) {
    const smoothed = has ? Math.max(r[i], ((r[(i + 1) % SEG] + r[(i - 1 + SEG) % SEG]) / 2) * 0.92) : fallback;
    const rr = Math.min(cap, smoothed + clear);
    mean += rr / SEG;
    const a = (i / SEG) * Math.PI * 2;
    pts.push([c[0] + (u[0] * Math.cos(a) + v[0] * Math.sin(a)) * rr,
              c[1] + (u[1] * Math.cos(a) + v[1] * Math.sin(a)) * rr,
              c[2] + (u[2] * Math.cos(a) + v[2] * Math.sin(a)) * rr]);
  }
  return { pts, mean };
}
/** fitted VERTICAL ring in the same basis/phase as ring() — the two can share a loft */
const fitRingY = (cloud, c, opts) => fitRing(cloud, c, [0, 1, 0], [1, 0, 0], [0, 0, 1], opts);
/** fitted ring ⊥ an axis, same basis rule as ringAxis() */
function fitRingAx(cloud, c, d, opts) {
  const up = Math.abs(d[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = norm(cross(d, up)), v = norm(cross(d, u));
  return fitRing(cloud, c, d, u, v, opts);
}

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
    const mesh = new THREE.SkinnedMesh(geo, fabricMaterial({ kind: 'wool', tint: p.color, roughness }));
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
  const hemY = sweatHem ?? hipsY - 0.1;                          // drapes lower, fully over the waistband
  // facing, derived from the rig (never assumed): forward = left-shoulder-axis × up
  const left = norm([P.LeftArm[0] - P.RightArm[0], 0, P.LeftArm[2] - P.RightArm[2]]);
  const back = norm(cross([0, 1, 0], left));                     // -forward

  // ---- TAILORING: every ring is FITTED to the measured body + a small clearance (bodyCloud) —
  // analytic radii only survive as fallbacks for bones-only rigs. Guessed radii = Michelin man.
  const cloud = bodyCloud(model);
  const armSegs = [[P.LeftArm, P.LeftHand], [P.RightArm, P.RightHand]];
  // for torso rings: ignore skin that belongs to the ARMS (beyond ~12 cm from the shoulder joint
  // along the arm — keeps the deltoids in the carrure, drops forearms/hands hanging in the slab)
  const armSkin = (x, y, z) => {
    for (const [a, h] of armSegs) {
      const ab = [h[0] - a[0], h[1] - a[1], h[2] - a[2]];
      const L = Math.hypot(...ab) || 1;
      const t = ((x - a[0]) * ab[0] + (y - a[1]) * ab[1] + (z - a[2]) * ab[2]) / (L * L);
      if (t * L > 0.12 && segDist([x, y, z], a, h) < 0.09) return true;
    }
    return false;
  };

  const forward = [-back[0], -back[1], -back[2]];
  const up = [0, 1, 0];
  const angleIn = (wv, U, V) => Math.atan2(wv[0] * V[0] + wv[1] * V[1] + wv[2] * V[2], wv[0] * U[0] + wv[1] * U[1] + wv[2] * U[2]);

  // ---- SWEAT: fitted torso with a RIBBED WAISTBAND (the hem pulls in then blouses) + fitted
  // carrure. The tight edge under a wider band reads as elastic ribbing.
  // the sweat's LOWER rings carry extra clearance so the grey ALWAYS covers the denim waistband
  // underneath (blue was poking through in a ragged line — the worst defect on the close-up).
  const rHip = fitRingY(cloud, [cx, hipsY + 0.02, cz], { clear: 0.05, cap: w * 1.12, fallback: w * 1.0, exclude: armSkin });
  const rChest = fitRingY(cloud, [cx, (hipsY + neckY) / 2, cz], { clear: 0.03, cap: w * 1.08, fallback: w * 0.98, exclude: armSkin });
  const rCarrure = fitRingY(cloud, [cx, shoulderY - 0.02, cz], { clear: 0.024, cap: shoulderHalf + 0.055, fallback: w * 1.07, exclude: armSkin });
  const rCollar = fitRingY(cloud, [cx, neckY + 0.035, cz], { clear: 0.014, cap: 0.09, fallback: 0.07, exclude: armSkin });   // crew collar hugs the neck (closes the gap)
  const topR = rCarrure.mean;
  // hem/band rings drawn as CLEAN ellipses (fitted MEAN) so the bottom edge is a straight ribbed
  // band, not scalloped; sized ≥ the hip so grey drapes over the denim.
  const hemR = rHip.mean * 0.98, hemZ = hemR * 0.84;
  const storso = loft([
    ring([cx, hemY, cz], hemR * 0.94, hemZ * 0.94),             // tight ribbed edge
    ring([cx, hemY + 0.05, cz], hemR, hemZ),                    // band blouses
    rHip.pts, rChest.pts, rCarrure.pts,
    ring([cx, shoulderY + 0.07, cz], topR * 0.82, topR * 0.66),
    rCollar.pts,                                                 // closes around the neck
  ]);
  const ssleeve = (side) => {
    const a = P[`${side}Arm`], f = P[`${side}ForeArm`], h = P[`${side}Hand`];
    const d1 = norm([f[0] - a[0], f[1] - a[1], f[2] - a[2]]);
    const d2 = norm([h[0] - f[0], h[1] - f[1], h[2] - f[2]]);
    const st = (c, d, clear, fallback) => fitRingAx(cloud, c, d, { clear, slab: 0.04, maxR: 0.14, fallback }).pts;
    return loft([
      st(lerp3(a, f, -0.32), d1, 0.03, 0.098),                   // DEEP overlap onto the shoulder — closes the armhole gap (the old 'cap ball' was the hidden jersey, not the sleeve)
      st(lerp3(a, f, 0.02), d1, 0.022, 0.082),
      st(lerp3(a, f, 0.45), d1, 0.018, 0.074),
      st(f, norm([d1[0] + d2[0], d1[1] + d2[1], d1[2] + d2[2]]), 0.016, 0.064),
      st(lerp3(f, h, 0.5), d2, 0.015, 0.057),
      st(lerp3(f, h, 0.84), d2, 0.02, 0.052),                    // sleeve blouses just before the cuff
      st(lerp3(f, h, 0.93), d2, 0.006, 0.046),                   // tight ribbed cuff edge
    ]);
  };
  // ---- CAPUCHE ROULÉE: a real rolled hood collar — a tube swept on an arc behind the neck,
  // dipping at the back, rising onto the shoulders. (A squashed sphere read as a backpack.)
  // a fat rolled COLLAR wrapping the back of the neck (a down hood bunches into a roll at the
  // collar). Hugs the neck base, wider arc, oval profile — the thin flat version read as a pill.
  const hoodPath = [];
  const rCol = fitRingY(cloud, [cx, neckY - 0.02, cz], { clear: 0.02, cap: 0.1, fallback: 0.075 }).mean;
  for (let i = 0; i <= 14; i++) {
    const th = -0.72 + (i / 14) * 1.44;                          // the NAPE only (a down hood bunches here)
    const dir = [back[0] * Math.cos(th) + left[0] * Math.sin(th), 0, back[2] * Math.cos(th) + left[2] * Math.sin(th)];
    const r = rCol + 0.02;
    hoodPath.push([P.Neck[0] + dir[0] * r, neckY - 0.075 - 0.03 * Math.cos(th), P.Neck[2] + dir[2] * r]);
  }
  const hoodProfile = []; for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; hoodProfile.push([Math.cos(a) * 0.055, Math.sin(a) * 0.05]); }
  // …but TAPER the tube to nothing at the ends so it melts into the shoulder seams instead of
  // bulging into a lump on the shoulder (the persistent blob — isolated by hiding the piece).
  const hoodMesh = sweep(hoodProfile, hoodPath, { caps: true, scaleFn: (t) => 0.12 + 0.88 * Math.sin(t * Math.PI) });
  // ---- CORDONS: two drawstrings hanging from the front of the collar down the chest
  const cordAt = (dx) => {
    const c0 = [P.Neck[0] + forward[0] * (rCol + 0.01) + left[0] * dx, neckY - 0.04, P.Neck[2] + forward[2] * (rCol + 0.01) + left[2] * dx];
    const path = [c0, [c0[0] + forward[0] * 0.015, c0[1] - 0.1, c0[2] + forward[2] * 0.015], [c0[0] + forward[0] * 0.01, c0[1] - 0.2, c0[2] + forward[2] * 0.01]];
    const prof = []; for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; prof.push([Math.cos(a) * 0.008, Math.sin(a) * 0.008]); }
    return sweep(prof, path, { caps: true });
  };
  const cordons = mergeMeshes([cordAt(0.028), cordAt(-0.028)]);
  // ---- POCHE KANGOUROU: a slab laid JUST PROUD of the sweat's front surface (frontD must clear
  // the front z-radius, else it sinks inside the sweat — that's why it read as a buried patch).
  const frontD = rChest.mean * 0.86 + 0.008;
  const pocketOutline = roundedRect(0.17, 0.11, 0.03, { cornerSegments: 3 });
  const pocket = orient(extrudePoly(pocketOutline, { depth: 0.014, bevel: 0.004 }),
    [cx + forward[0] * frontD, hipsY + 0.02, cz + forward[2] * frontD], left, forward, up);
  // ---- JEAN: fitted hip yoke (with a waistband band on top) + one fitted tube per leg. A leg's
  // rings ignore skin belonging to the OTHER leg (the thighs almost touch at the crotch).
  const legSegs = { Left: [P.LeftUpLeg, P.LeftFoot], Right: [P.RightUpLeg, P.RightFoot] };
  const yoke = loft([
    fitRingY(cloud, [cx, hipsY - 0.17, cz], { clear: 0.032, cap: w * 1.06, fallback: w * 0.9 }).pts,
    fitRingY(cloud, [cx, hipsY - 0.06, cz], { clear: 0.028, cap: w * 1.05, fallback: w * 0.95 }).pts,
    fitRingY(cloud, [cx, hipsY + 0.015, cz], { clear: 0.024, cap: w * 1.02, fallback: w * 0.92 }).pts,
    fitRingY(cloud, [cx, hipsY + 0.045, cz], { clear: 0.03, cap: w * 1.04, fallback: w * 0.94 }).pts,   // waistband at the hip, NOT the navel
  ]);
  const yokeFrame = { c: [cx, hipsY, cz], u: [1, 0, 0], v: [0, 0, 1] };
  const jeanLeg = (side) => {
    const u = P[`${side}UpLeg`], k = P[`${side}Leg`], f = P[`${side}Foot`];
    const other = side === 'Left' ? 'Right' : 'Left';
    const mine = (x, y, z) => segDist([x, y, z], legSegs[other][0], legSegs[other][1]) < segDist([x, y, z], legSegs[side][0], legSegs[side][1]);
    const d1 = norm([k[0] - u[0], k[1] - u[1], k[2] - u[2]]);
    const d2 = norm([f[0] - k[0], f[1] - k[1], f[2] - k[2]]);
    const st = (c, d, clear, fallback) => fitRingAx(cloud, c, d, { clear, slab: 0.045, maxR: 0.13, fallback, exclude: mine }).pts;
    const mesh = loft([
      st(lerp3(u, k, -0.18), d1, 0.03, 0.1),
      st(lerp3(u, k, 0.5), d1, 0.022, 0.092),
      st(lerp3(u, k, 0.9), d1, 0.014, 0.078),                    // knee crease pinch (fold shadow)
      st(k, norm([d1[0] + d2[0], d1[1] + d2[1], d1[2] + d2[2]]), 0.02, 0.084),
      st(lerp3(k, f, 0.55), d2, 0.018, 0.076),
      st(lerp3(k, f, 0.92), d2, 0.016, 0.072),                   // ankle, straight cut
    ]);
    // seam frame: knee as origin, ring basis of the (nearly vertical) leg axis
    const d = norm([f[0] - u[0], f[1] - u[1], f[2] - u[2]]);
    const upv = Math.abs(d[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    const U = norm(cross(d, upv)), V = norm(cross(d, U));
    const lat = side === 'Left' ? [1, 0, 0] : [-1, 0, 0];
    const seams = [
      { angle: angleIn(lat, U, V), stitch: true },               // outseam (side, felled + topstitch)
      { angle: angleIn([-lat[0], 0, 0], U, V), stitch: true },   // inseam
      { angle: angleIn(forward, U, V), stitch: false },          // pressed front crease
    ];
    return { mesh, frame: { c: k, u: U, v: V }, seams };
  };
  const jg = jeanLeg('Left'), jd = jeanLeg('Right');
  // ---- POCHES ARRIÈRE: two slabs on the seat, facing back
  const backPocket = (dx) => orient(extrudePoly(roundedRect(0.11, 0.125, 0.02, { cornerSegments: 2 }), { depth: 0.014, bevel: 0.004 }),
    [cx + left[0] * dx + back[0] * frontD * 0.95, hipsY - 0.12, cz + left[2] * dx + back[2] * frontD * 0.95], left, back, up);
  const parts = [
    { name: 'sweat', mesh: storso, color: sweat },
    { name: 'poche', mesh: pocket, color: mixHex(sweat, 0x000000, 0.1), closed: false },
    { name: 'capuche', mesh: hoodMesh, color: mixHex(sweat, 0x000000, 0.06), closed: false },
    { name: 'cordons', mesh: cordons, color: 0xf0efe9, closed: false },
    { name: 'mancheG', mesh: ssleeve('Left'), color: sweat },
    { name: 'mancheD', mesh: ssleeve('Right'), color: sweat },
    { name: 'jeanBassin', mesh: yoke, color: jeans, denimFrame: yokeFrame, denimSeams: [{ angle: angleIn(forward, yokeFrame.u, yokeFrame.v), stitch: true }] },
    { name: 'pocheArrG', mesh: backPocket(0.07), color: mixHex(jeans, 0xffffff, 0.06), closed: false },
    { name: 'pocheArrD', mesh: backPocket(-0.07), color: mixHex(jeans, 0xffffff, 0.06), closed: false },
    { name: 'jeanG', mesh: jg.mesh, color: jeans, denimFrame: jg.frame, denimSeams: jg.seams },
    { name: 'jeanD', mesh: jd.mesh, color: jeans, denimFrame: jd.frame, denimSeams: jd.seams },
  ];
  for (const p of parts) {
    const opts = { maxTris: 4000, closed: p.closed !== false };
    let c = checkMesh(p.mesh, opts);
    if (!c.ok && c.issues.some((i) => /volume/.test(i))) {
      for (let i = 0; i < p.mesh.indices.length; i += 3) { const t = p.mesh.indices[i + 1]; p.mesh.indices[i + 1] = p.mesh.indices[i + 2]; p.mesh.indices[i + 2] = t; }
      if (p.mesh.normals) for (let i = 0; i < p.mesh.normals.length; i++) p.mesh.normals[i] *= -1;
      c = checkMesh(p.mesh, opts);
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
        { i: B('Hips'), d: 0.055 },
        { i: B('LeftUpLeg'), d: segDist(p, P.LeftUpLeg, P.LeftLeg) + 0.02 },
        { i: B('RightUpLeg'), d: segDist(p, P.RightUpLeg, P.RightLeg) + 0.02 },
      ], 3);
    }
    if (kind === 'hood') return [[B('Neck'), 0.5], [B('Spine2'), 0.5]];
    // torso: spine links — and near the hem, a share of the nearest thigh so the fabric SWEEPS
    // with a flexing leg (the kit's tail poked out at full stride, caught on screenshot)
    const cands = torsoSeg.map((s) => ({ i: B(s.b), d: segDist(p, s.a, s.c) + 1e-4 }));
    if (p[1] < hipsY + 0.02) {
      cands.push({ i: B('LeftUpLeg'), d: segDist(p, P.LeftUpLeg, P.LeftLeg) + 0.025 });
      cands.push({ i: B('RightUpLeg'), d: segDist(p, P.RightUpLeg, P.RightLeg) + 0.025 });
      return top(cands, 3);
    }
    return top(cands);
  };

  const group = new THREE.Group(); group.name = 'tenue';
  const meshes = [];
  const KIND = { sweat: 'torso', poche: 'torso', capuche: 'hood', cordons: 'hood', mancheG: 'sleeveL', mancheD: 'sleeveR',
    jeanBassin: 'yoke', pocheArrG: 'yoke', pocheArrD: 'yoke', jeanG: 'jeanL', jeanD: 'jeanR' };
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
    const mat = p.denimFrame
      ? denimSeamMaterial({ tint: p.color, roughness, frame: p.denimFrame, seams: p.denimSeams || [] })
      : fabricMaterial({ kind: p.name.startsWith('jean') || p.name.startsWith('pocheArr') ? 'denim' : 'knit', tint: p.color, roughness });
    const mesh = new THREE.SkinnedMesh(geo, mat);
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
