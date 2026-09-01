import * as THREE from 'three/webgpu';
import { loft, merge, computeNormals, checkMesh } from './meshkit.js';
import { fabricMaterial } from './fabric.js';

// kit — the FOOTBALL STRIP (maillot manches courtes + short + chaussettes) generated over a Mixamo
// rig and skinned to it, so two teams of five can be dressed in contrasting colours from one call
// per player. Same machinery as outfit.js: meshkit parts authored in WORLD space around the bind
// pose, TAILORED against a measured body cloud (guessed radii give a bonhomme Michelin), weighted
// by proximity onto a fresh THREE.Skeleton whose inverses are taken NOW, bound with an identity
// matrix in 'attached' mode so the group rides INSIDE the model wrapper at any transform.
//
// What makes it a strip and not a tracksuit is three lengths, and only three: the sleeve dies on
// the upper arm, the short hem is above the knee, the sock top reaches it. checkKit tests exactly
// those — a "sleeve" that crept to the wrist is silent on screen but loud in the contract.
// Build PER MODEL, never share: skinIndex values index THIS model's traverse order of bones.

const SEG = 24;                                                     // ring segments — smooth silhouette
const SLEEVE_T = 0.55;                                              // sleeve end, fraction of Arm→ForeArm (mid-upper-arm)
const THIGH_T = 0.5;                                                // short hem, fraction of UpLeg→Leg
const SOCK_T = -0.06;                                               // sock top, fraction of Leg→Foot — negative = just OVER the knee

const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = hyp(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const len3 = (a, b) => hyp(...sub3(a, b));

/** distance from p to segment ab — the proximity metric behind every skin weight here */
function segDist(p, a, b) {
  const ab = sub3(b, a), t = Math.max(0, Math.min(1, dot3(sub3(p, a), ab) / (dot3(ab, ab) || 1)));
  return hyp(p[0] - a[0] - ab[0] * t, p[1] - a[1] - ab[1] * t, p[2] - a[2] - ab[2] * t);
}

/** Ring basis ⊥ d. The vertical case is PINNED to (+x,+z) so analytic and fitted rings share one
 *  phase and can sit in the same loft — mismatched phases twist the tube into a candy wrapper.
 *  Limbs reference +z: no arm or leg points along z in a Mixamo bind pose. */
const basisOf = (d) => {
  if (d[1] > 0.999) return [[1, 0, 0], [0, 0, 1]];
  const u = norm(cross(d, [0, 0, 1]));
  return [u, norm(cross(d, u))];
};
const ringPts = (c, u, v, ru, rv) => {
  const pts = [];
  for (let i = 0; i < SEG; i++) {
    const a = (i / SEG) * Math.PI * 2, cu = Math.cos(a) * (Array.isArray(ru) ? ru[i] : ru), cv = Math.sin(a) * (Array.isArray(rv) ? rv[i] : rv);
    pts.push([c[0] + u[0] * cu + v[0] * cv, c[1] + u[1] * cu + v[1] * cv, c[2] + u[2] * cu + v[2] * cv]);
  }
  return pts;
};
/** analytic ring ⊥ d — for BANDS (collar, cuff, sock top), whose edge must read as a clean ellipse
 *  instead of following every bump of the body underneath */
const ringAt = (c, d, ru, rv = ru) => { const [u, v] = basisOf(d); return ringPts(c, u, v, ru, rv); };

function findBones(model) {                                          // Mixamo suffixes only — the prefix is stripped
  const by = new Map();
  model.traverse((o) => { if (o.isBone) { const s = o.name.replace(/^mixamorig\d*/i, ''); if (!by.has(s)) by.set(s, o); } });
  return by;
}
const wpos = (b) => { const v = new THREE.Vector3(); b.getWorldPosition(v); return [v.x, v.y, v.z]; };

/** World-space cloud of the character's SKIN at bind (skeletons force-updated — no frame has been
 *  rendered yet at build time). Garments already built are skipped: measuring our own kit would
 *  inflate every ring on a rebuild. */
function bodyCloud(model) {
  model.updateMatrixWorld(true);
  const seen = new Set(), pts = [], v = new THREE.Vector3();
  model.traverse((o) => {
    if (!o.isSkinnedMesh || /^(kit|tenue|manteau)_/.test(o.name)) return;
    if (o.skeleton && !seen.has(o.skeleton)) { seen.add(o.skeleton); o.skeleton.update(); }
    for (let i = 0; i < o.geometry.attributes.position.count; i += 2) { o.getVertexPosition(i, v).applyMatrix4(o.matrixWorld); pts.push(v.x, v.y, v.z); }
  });
  return pts;
}

/** A ring FITTED to the body: per angular sector, the body's max radial extent in a slab around the
 *  station, plus a clearance — a garment must be WIDER than what it covers or the skin pokes
 *  through. Empty sectors borrow neighbours; a bones-only rig falls back to the analytic radius. */
function fitRing(cloud, c, d, { clear = 0.02, slab = 0.05, maxR = 0.3, cap = Infinity, fallback = 0.08, exclude = null } = {}) {
  const [u, v] = basisOf(d), r = new Array(SEG).fill(0);
  for (let i = 0; i < cloud.length; i += 3) {
    const q = [cloud[i] - c[0], cloud[i + 1] - c[1], cloud[i + 2] - c[2]], along = dot3(q, d);
    if (Math.abs(along) > slab || (exclude && exclude(cloud[i], cloud[i + 1], cloud[i + 2]))) continue;
    const w = [q[0] - d[0] * along, q[1] - d[1] * along, q[2] - d[2] * along];
    const ru = dot3(w, u), rv = dot3(w, v), rad = hyp(ru, rv);
    if (rad > maxR || rad < 1e-4) continue;
    const s = (Math.floor((Math.atan2(rv, ru) / (Math.PI * 2)) * SEG) + SEG * 2) % SEG;
    if (rad > r[s]) r[s] = rad;
  }
  for (let pass = 0; pass < SEG && r.some((x) => !x); pass++)
    for (let i = 0; i < SEG; i++) if (!r[i]) r[i] = Math.max(r[(i + 1) % SEG], r[(i - 1 + SEG) % SEG]) * 0.96;
  const has = r.some((x) => x > 0), rr = [];
  let mean = 0;
  for (let i = 0; i < SEG; i++) {
    rr.push(Math.min(cap, (has ? Math.max(r[i], ((r[(i + 1) % SEG] + r[(i - 1 + SEG) % SEG]) / 2) * 0.92) : fallback) + clear));
    mean += rr[i] / SEG;
  }
  return { pts: ringPts(c, u, v, rr, rr), mean };
}

// SQUAD NUMBER as a seven-segment glyph: no canvas and no font file, so the module stays
// node-testable and a number costs nothing at load — and a segmented block face is what a printed
// shirt number reads as from 20 m, the only distance that matters here.
const SEVEN = ['1111110', '0110000', '1101101', '1111001', '0110011', '1011011', '1011111', '1110000', '1111111', '1111011'];
const DW = 0.075, DH = 0.12, TH = 0.019;                             // digit box + bar thickness, metres
const BARS = [[0, DH / 2, DW, TH], [DW / 2, DH / 4, TH, DH / 2], [DW / 2, -DH / 4, TH, DH / 2], [0, -DH / 2, DW, TH],
  [-DW / 2, -DH / 4, TH, DH / 2], [-DW / 2, DH / 4, TH, DH / 2], [0, 0, DW, TH]];   // [dx, dy, w, h] per segment

/**
 * Dress a rig standing in bind pose. Call AFTER the model is scaled, placed and
 * updateMatrixWorld(true)'d — the skeleton built here means "bind = now".
 * Returns { group, meshes, check, measures }; add `group` under the model wrapper.
 */
export function buildKit(model, { shirt = 0xffffff, shorts = 0x101418, socks = 0xffffff, trim = 0x101418, number = null, roughness = 0.72 } = {}) {
  model.updateMatrixWorld(true);
  const by = findBones(model);
  const need = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot'];
  for (const n of need) if (!by.has(n)) return { group: null, meshes: [], check: { ok: false, issues: [`os manquant: ${n}`] }, measures: {} };
  const P = Object.fromEntries(need.map((n) => [n, wpos(by.get(n))]));

  const neckY = P.Neck[1], hipsY = P.Hips[1], chestY = (hipsY + neckY) / 2;
  const kneeY = (P.LeftLeg[1] + P.RightLeg[1]) / 2, ankleY = (P.LeftFoot[1] + P.RightFoot[1]) / 2;
  const shoulderY = (P.LeftArm[1] + P.RightArm[1]) / 2, shoulderHalf = Math.abs(P.LeftArm[0] - P.RightArm[0]) / 2;
  const cx = (P.LeftArm[0] + P.RightArm[0]) / 2, cz = P.Hips[2], w = shoulderHalf + 0.05;
  const hemY = hipsY - 0.085;                                        // untucked: the jersey covers the waistband
  const V = [0, 1, 0];
  const left = norm([P.LeftArm[0] - P.RightArm[0], 0, P.LeftArm[2] - P.RightArm[2]]);   // facing read off the rig,
  const back = norm(cross(V, left));                                 // never assumed — the wrapper may be rotated
  const cloud = bodyCloud(model);
  // torso rings must drop skin belonging to the ARMS (past ~12 cm down the arm), else the forearms
  // hanging in the slab blow the carrure out into a barrel
  const armSkin = (x, y, z) => ['Left', 'Right'].some((s) => {
    const a = P[`${s}Arm`], h = P[`${s}Hand`], ab = sub3(h, a);
    return dot3(sub3([x, y, z], a), ab) / (hyp(...ab) || 1) > 0.12 && segDist([x, y, z], a, h) < 0.09;
  });
  const notMine = (s) => {                                           // thighs almost touch: drop the other leg's skin
    const o = s === 'Left' ? 'Right' : 'Left';
    return (x, y, z) => segDist([x, y, z], P[`${o}UpLeg`], P[`${o}Foot`]) < segDist([x, y, z], P[`${s}UpLeg`], P[`${s}Foot`]);
  };
  const dirArm = (s) => norm(sub3(P[`${s}ForeArm`], P[`${s}Arm`])), dirShin = (s) => norm(sub3(P[`${s}Foot`], P[`${s}Leg`]));
  /** trim band: three analytic rings hugging a limb/neck axis, sized to sit PROUD of the piece it
   *  finishes (a cuff level with its sleeve z-fights it) */
  const band = (a, b, d, r) => loft([ringAt(a, d, r * 0.97), ringAt(lerp3(a, b, 0.5), d, r * 1.05), ringAt(b, d, r * 0.97)]);

  // ---- MAILLOT: fitted torso, hem at the hips. The waistband is measured FIRST so the hem can be
  // sized to clear it — a jersey narrower than the shorts shows the strip's colour in a ragged line.
  const rWaist = fitRing(cloud, [cx, hipsY + 0.05, cz], V, { clear: 0.03, cap: w * 1.06, fallback: w * 0.94 });
  const rHip = fitRing(cloud, [cx, hipsY + 0.02, cz], V, { clear: 0.05, cap: w * 1.12, fallback: w, exclude: armSkin });
  const rChest = fitRing(cloud, [cx, chestY, cz], V, { clear: 0.026, cap: w * 1.06, fallback: w * 0.96, exclude: armSkin });
  const rCarrure = fitRing(cloud, [cx, shoulderY - 0.02, cz], V, { clear: 0.022, cap: shoulderHalf + 0.05, fallback: w * 1.05, exclude: armSkin });
  const rCollar = fitRing(cloud, [cx, neckY + 0.03, cz], V, { clear: 0.013, cap: 0.09, fallback: 0.07, exclude: armSkin });
  const hemR = Math.max(rHip.mean, rWaist.mean + 0.014), tR = rCarrure.mean;
  const sections = [                                                  // [height, ring] bottom→top
    [hemY, ringAt([cx, hemY, cz], V, hemR * 0.99, hemR * 0.9)],       // clean elliptical hem, not scalloped
    [hipsY + 0.02, rHip.pts], [chestY, rChest.pts], [shoulderY - 0.02, rCarrure.pts],
    [shoulderY + 0.065, ringAt([cx, shoulderY + 0.065, cz], V, tR * 0.82, tR * 0.66)],
    [neckY + 0.03, rCollar.pts],                                      // closes around the neck
  ];
  const jersey = loft(sections.map((s) => s[1]));
  const collar = band([cx, neckY + 0.012, cz], [cx, neckY + 0.072, cz], V, rCollar.mean + 0.008);
  // ---- MANCHES COURTES: deep shoulder overlap (closes the armhole) → mid-upper-arm, flaring at
  // the hem, because a football sleeve hangs loose instead of gripping like a sweat cuff
  const sleeve = (s) => {
    const a = P[`${s}Arm`], f = P[`${s}ForeArm`], d = dirArm(s);
    const st = (t, clear, fallback) => fitRing(cloud, lerp3(a, f, t), d, { clear, slab: 0.04, maxR: 0.14, fallback });
    const end = st(SLEEVE_T, 0.032, 0.076);
    return { mesh: loft([st(-0.3, 0.028, 0.1).pts, st(0.02, 0.024, 0.085).pts, st(0.3, 0.026, 0.078).pts, end.pts]), r: end.mean };
  };
  // trim is sized off the piece's OWN end ring, never re-measured on the limb: two independent fits
  // a few centimetres apart read different radii and the sleeve pokes through its own cuff
  const cuff = (s, r) => band(lerp3(P[`${s}Arm`], P[`${s}ForeArm`], SLEEVE_T - 0.08), lerp3(P[`${s}Arm`], P[`${s}ForeArm`], SLEEVE_T + 0.02), dirArm(s), r + 0.012);
  // ---- SHORT: hip yoke + one tube per leg down to mid-thigh
  const yoke = loft([
    fitRing(cloud, [cx, hipsY - 0.16, cz], V, { clear: 0.045, cap: w * 1.12, fallback: w * 0.92 }).pts,
    fitRing(cloud, [cx, hipsY - 0.05, cz], V, { clear: 0.04, cap: w * 1.1, fallback: w * 0.96 }).pts,
    fitRing(cloud, [cx, hipsY + 0.02, cz], V, { clear: 0.034, cap: w * 1.06, fallback: w * 0.94 }).pts,
    rWaist.pts,
  ]);
  const shortLeg = (s) => {
    const u = P[`${s}UpLeg`], k = P[`${s}Leg`], d = norm(sub3(k, u)), exclude = notMine(s);
    const st = (t, clear, fallback) => fitRing(cloud, lerp3(u, k, t), d, { clear, slab: 0.045, maxR: 0.14, fallback, exclude }).pts;
    return loft([st(-0.16, 0.036, 0.105), st(0.18, 0.03, 0.098), st(THIGH_T, 0.05, 0.092)]);   // hem flares like real shorts
  };
  // ---- CHAUSSETTES: shin tubes from the ankle up OVER the knee, finished by a turnover band
  const sock = (s) => {
    const k = P[`${s}Leg`], f = P[`${s}Foot`], d = dirShin(s), exclude = notMine(s);
    const st = (t, clear, fallback) => fitRing(cloud, lerp3(k, f, t), d, { clear, slab: 0.04, maxR: 0.12, fallback, exclude });
    const top = st(SOCK_T, 0.022, 0.072);
    return { mesh: loft([top.pts, st(0.15, 0.016, 0.068).pts, st(0.55, 0.014, 0.056).pts, st(0.88, 0.016, 0.05).pts]), r: top.mean };
  };
  const sockTop = (s, r) => band(lerp3(P[`${s}Leg`], P[`${s}Foot`], SOCK_T - 0.01), lerp3(P[`${s}Leg`], P[`${s}Foot`], SOCK_T + 0.13), dirShin(s), r + 0.008);
  // ---- NUMÉRO: a seven-segment glyph printed ON the jersey. Each bar is a PATCH whose corners
  // are placed on the shirt's own surface, not a flat slab laid tangent to it: a slab is a chord,
  // and on a back that curves into the flank its ends stood 35 mm off the cloth (measured) while a
  // smaller offset buried them. A patch cannot do either — every corner is 4 mm above the cloth.
  const digits = number == null ? null : (String(number).replace(/\D/g, '').slice(0, 2) || null);
  const numY = chestY + 0.055;                                       // upper back, between the shoulder blades
  const U0 = [-left[0], 0, -left[2]];                                // reader's right, seen from behind
  const dirAt = (a) => norm([back[0] * Math.cos(a) + U0[0] * Math.sin(a), 0, back[2] * Math.cos(a) + U0[2] * Math.sin(a)]);
  /** Radius of the jersey at (height y, angle a from the back). The shirt is a loft of horizontal
   *  rings sharing one phase, so its section at y is the lerp of the two rings bracketing y — the
   *  radius is where the ray at angle a crosses that polygon. */
  const radAt = (y, a) => {
    let i = 0;
    while (i < sections.length - 2 && sections[i + 1][0] < y) i++;
    const t = Math.max(0, Math.min(1, (y - sections[i][0]) / (sections[i + 1][0] - sections[i][0])));
    const d = dirAt(a), sec = (k) => {
      const p = sections[i][1][k % SEG], q = sections[i + 1][1][k % SEG];
      return [p[0] + (q[0] - p[0]) * t - cx, p[2] + (q[2] - p[2]) * t - cz];
    };
    let r = 0, prev = sec(0);
    for (let k = 1; k <= SEG; k++) {                                  // ray from the torso axis vs each edge
      const cur = sec(k), ex = cur[0] - prev[0], ez = cur[1] - prev[1], det = ex * d[2] - d[0] * ez;
      const u = (d[0] * prev[1] - d[2] * prev[0]) / det, q = (ex * prev[1] - prev[0] * ez) / det;
      if (Math.abs(det) > 1e-9 && u >= 0 && u <= 1 && q > 0) r = Math.max(r, q);
      prev = cur;
    }
    return r;
  };
  const PN = 3;                                                       // patch subdivisions per bar
  const numberMesh = () => {
    const R = radAt(numY, 0), bars = [];                              // back-pole radius: metres → angle
    for (let di = 0; di < digits.length; di++) {
      const mask = SEVEN[+digits[di]], ox = (di - (digits.length - 1) / 2) * (DW + 0.026);
      for (let g = 0; g < 7; g++) {
        if (mask[g] !== '1') continue;
        const [sx, sy, bw, bh] = BARS[g], a0 = (ox + sx - bw / 2) / R, a1 = (ox + sx + bw / 2) / R;
        const pos = [], idx = [];
        for (let i = 0; i <= PN; i++) for (let j = 0; j <= PN; j++) {
          const a = a0 + (a1 - a0) * (i / PN), y = numY + sy + bh * (j / PN - 0.5), d = dirAt(a), r = radAt(y, a) + 0.004;
          pos.push(cx + d[0] * r, y, cz + d[2] * r);
        }
        // winding: (tangent × up) is the outward normal for this frame, so a cell runs angle-first
        for (let i = 0; i < PN; i++) for (let j = 0; j < PN; j++) {
          const k = i * (PN + 1) + j;
          idx.push(k, k + PN + 1, k + 1, k + 1, k + PN + 1, k + PN + 2);
        }
        bars.push(computeNormals({ positions: new Float32Array(pos), indices: new Uint32Array(idx) }));
      }
    }
    return merge(bars);
  };

  const sl = { Left: sleeve('Left'), Right: sleeve('Right') }, sk = { Left: sock('Left'), Right: sock('Right') };
  const parts = [
    { name: 'maillot', mesh: jersey, color: shirt, kind: 'torso' },
    { name: 'col', mesh: collar, color: trim, kind: 'collar' },
    { name: 'mancheG', mesh: sl.Left.mesh, color: shirt, kind: 'sleeveL' },
    { name: 'mancheD', mesh: sl.Right.mesh, color: shirt, kind: 'sleeveR' },
    { name: 'poignetG', mesh: cuff('Left', sl.Left.r), color: trim, kind: 'sleeveL' },
    { name: 'poignetD', mesh: cuff('Right', sl.Right.r), color: trim, kind: 'sleeveR' },
    { name: 'shortBassin', mesh: yoke, color: shorts, kind: 'yoke' },
    { name: 'shortG', mesh: shortLeg('Left'), color: shorts, kind: 'legL' },
    { name: 'shortD', mesh: shortLeg('Right'), color: shorts, kind: 'legR' },
    { name: 'chaussetteG', mesh: sk.Left.mesh, color: socks, kind: 'shinL' },
    { name: 'chaussetteD', mesh: sk.Right.mesh, color: socks, kind: 'shinR' },
    { name: 'bandeG', mesh: sockTop('Left', sk.Left.r), color: trim, kind: 'shinL' },
    { name: 'bandeD', mesh: sockTop('Right', sk.Right.r), color: trim, kind: 'shinR' },
  ];
  if (digits) parts.push({ name: 'numero', mesh: numberMesh(), color: trim, kind: 'torso', open: true });
  for (const p of parts) {
    // a loft whose rings descend, or a slab on a left-handed basis, comes out inside-out: SIGNED
    // VOLUME is the truth, not the authoring convention — flip the winding rather than fail
    const opts = { maxTris: 4000, closed: !p.open };                  // the number is a printed patch, not a solid
    let c = checkMesh(p.mesh, opts);
    if (!c.ok && c.issues.some((i) => /volume/.test(i))) {
      for (let i = 0; i < p.mesh.indices.length; i += 3) { const t = p.mesh.indices[i + 1]; p.mesh.indices[i + 1] = p.mesh.indices[i + 2]; p.mesh.indices[i + 2] = t; }
      for (let i = 0; i < p.mesh.normals.length; i++) p.mesh.normals[i] *= -1;
      c = checkMesh(p.mesh, opts);
    }
    p.contract = c;
  }

  // ---- the skeleton: the SAME bone objects, inverses computed from the CURRENT world matrices
  const bones = []; model.traverse((o) => { if (o.isBone) bones.push(o); });
  const skeleton = new THREE.Skeleton(bones);
  const idx = new Map(bones.map((b, i) => [b, i]));
  const B = (suf) => idx.get(by.get(suf));
  const spine = [['Hips', 0, 0.25], ['Spine', 0.2, 0.5], ['Spine1', 0.45, 0.75], ['Spine2', 0.7, 1]]
    .map(([b, t0, t1]) => ({ b, a: lerp3(P.Hips, P.Neck, t0), c: lerp3(P.Hips, P.Neck, t1) }));
  const top = (cands, keep = 2) => {
    cands.sort((a, b) => a.d - b.d);
    const kept = cands.slice(0, keep).map((c) => ({ i: c.i, w: 1 / (c.d * c.d + 1e-5) }));
    const sum = kept.reduce((a, c) => a + c.w, 0);
    return kept.map((c) => [c.i, c.w / sum]);
  };
  const weigh = (p, kind) => {
    const s = kind.endsWith('L') ? 'Left' : 'Right', k = kind.slice(0, -1);
    const seg = (b, a, c, bias = 0) => ({ i: B(b), d: segDist(p, a, c) + bias });
    if (kind === 'collar') return [[B('Neck'), 0.55], [B('Spine2'), 0.45]];
    if (k === 'sleeve') return top([seg(`${s}Shoulder`, P[`${s}Shoulder`], P[`${s}Arm`]), seg(`${s}Arm`, P[`${s}Arm`], P[`${s}ForeArm`]),
      seg(`${s}ForeArm`, P[`${s}ForeArm`], P[`${s}Hand`])], 3);
    if (k === 'leg') return top([seg('Hips', P.Hips, P[`${s}UpLeg`], 0.03), seg(`${s}UpLeg`, P[`${s}UpLeg`], P[`${s}Leg`]),
      seg(`${s}Leg`, P[`${s}Leg`], P[`${s}Foot`])]);
    // sock: shin bone dominates, the foot only wins at the ankle (more and it stretches on a step)
    if (k === 'shin') return top([seg(`${s}UpLeg`, P[`${s}UpLeg`], P[`${s}Leg`], 0.02), seg(`${s}Leg`, P[`${s}Leg`], P[`${s}Foot`]),
      { i: B(`${s}Foot`), d: len3(p, P[`${s}Foot`]) + 0.03 }]);
    if (kind === 'yoke') return top([{ i: B('Hips'), d: 0.055 }, seg('LeftUpLeg', P.LeftUpLeg, P.LeftLeg, 0.02), seg('RightUpLeg', P.RightUpLeg, P.RightLeg, 0.02)], 3);
    // torso: spine links, plus a share of the nearest thigh near the hem so the jersey SWEEPS with
    // a flexing leg instead of staying a stiff skirt at full stride
    const cands = spine.map((x) => seg(x.b, x.a, x.c, 1e-4));
    if (p[1] >= hipsY + 0.02) return top(cands);
    cands.push(seg('LeftUpLeg', P.LeftUpLeg, P.LeftLeg, 0.025), seg('RightUpLeg', P.RightUpLeg, P.RightLeg, 0.025));
    return top(cands, 3);
  };

  const group = new THREE.Group(); group.name = 'kit';
  const meshes = [];
  for (const p of parts) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(p.mesh.positions, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(p.mesh.normals, 3));
    geo.setIndex(new THREE.BufferAttribute(p.mesh.indices, 1));
    const n = p.mesh.positions.length / 3;
    const si = new Float32Array(n * 4), sw = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      const ws = weigh([p.mesh.positions[i * 3], p.mesh.positions[i * 3 + 1], p.mesh.positions[i * 3 + 2]], p.kind);
      for (let k = 0; k < 4; k++) { si[i * 4 + k] = ws[k] ? ws[k][0] : 0; sw[i * 4 + k] = ws[k] ? ws[k][1] : 0; }
    }
    geo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
    geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    const mesh = new THREE.SkinnedMesh(geo, fabricMaterial({ kind: 'knit', tint: p.color, roughness }));
    mesh.name = `kit_${p.name}`;
    mesh.castShadow = true; mesh.frustumCulled = false;               // world-space bind: the bounding sphere lies
    mesh.bind(skeleton, new THREE.Matrix4());                         // identity bind + 'attached' mode
    group.add(mesh);
    meshes.push({ name: p.name, mesh, contract: p.contract });
  }
  const arm = (s) => ({ o: P[`${s}Arm`], d: dirArm(s), upper: len3(P[`${s}ForeArm`], P[`${s}Arm`]), full: len3(P[`${s}Hand`], P[`${s}Arm`]) });
  const measures = { style: 'kit', hipsY, hemY, chestY, neckY, kneeY, ankleY, number: digits, armL: arm('Left'), armR: arm('Right') };
  return { group, meshes, check: checkKit(meshes, model, measures), measures };
}

/** Contract: per-part meshkit gate, weights normalised onto real bones, and the coverage a STRIP
 *  actually has — sleeves dying on the upper arm, shorts above the knee, socks up to it. */
export function checkKit(meshes, model, m = {}) {
  const issues = [];
  let nBones = 0; model.traverse((o) => { if (o.isBone) nBones++; });
  for (const part of meshes) {
    if (part.contract && !part.contract.ok) issues.push(`${part.name}: ${part.contract.issues[0]}`);
    const g = part.mesh.geometry, sw = g.attributes.skinWeight, si = g.attributes.skinIndex;
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
  const find = (n) => meshes.find((p) => p.name === n);
  const span = (n) => {                                               // geometry is WORLD space at bind, so Y compares straight to the rig's
    const part = find(n);
    if (!part) return null;
    const pos = part.mesh.geometry.attributes.position;
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); if (y < lo) lo = y; if (y > hi) hi = y; }
    return { lo, hi, pos };
  };
  const j = m.hipsY != null && span('maillot');
  if (j) {                                                            // a jersey ends AT the hips: not a dress, not a crop-top
    if (j.lo < m.hipsY - 0.2) issues.push(`maillot: ourlet à ${j.lo.toFixed(2)} — longueur de robe (hanches ${m.hipsY.toFixed(2)})`);
    if (j.lo > m.hipsY + 0.06) issues.push(`maillot: ourlet à ${j.lo.toFixed(2)}, au-dessus des hanches (crop-top)`);
    if (j.hi < m.neckY - 0.12) issues.push('maillot: ne monte pas aux épaules');
  }
  for (const [n, a] of [['mancheG', m.armL], ['mancheD', m.armR]]) {   // SHORT sleeves: they must die on the upper arm
    const s = a && span(n);
    if (!s) continue;
    let far = -Infinity;                                              // reach along the arm axis, from the shoulder joint
    for (let i = 0; i < s.pos.count; i++) far = Math.max(far, dot3([s.pos.getX(i) - a.o[0], s.pos.getY(i) - a.o[1], s.pos.getZ(i) - a.o[2]], a.d));
    if (far > a.upper * 0.85) issues.push(`${n}: finit à ${far.toFixed(2)} m de l'épaule — manche longue, pas un maillot de foot (bras ${a.upper.toFixed(2)})`);
    if (far > a.full * 0.5) issues.push(`${n}: dépasse le coude`);
    if (far < a.upper * 0.25) issues.push(`${n}: manche quasi inexistante (${far.toFixed(2)} m)`);
  }
  for (const n of m.kneeY == null ? [] : ['shortG', 'shortD', 'chaussetteG', 'chaussetteD']) {
    const s = span(n);
    if (!s) continue;
    if (n[0] === 's') {                                               // short: hem ABOVE the knee, and it still covers the thigh
      if (s.lo < m.kneeY + 0.03) issues.push(`${n}: ourlet à ${s.lo.toFixed(2)}, au genou (${m.kneeY.toFixed(2)}) — bermuda, pas un short`);
      if (s.lo > m.hipsY - 0.08) issues.push(`${n}: ne couvre pas la cuisse`);
    } else {                                                          // chaussette: knee-high, and down to the ankle
      if (s.hi < m.kneeY - 0.02) issues.push(`${n}: haut à ${s.hi.toFixed(2)}, n'atteint pas le genou (${m.kneeY.toFixed(2)})`);
      if (s.lo > m.ankleY + 0.09) issues.push(`${n}: ne descend pas à la cheville (${m.ankleY.toFixed(2)})`);
    }
  }
  return { ok: issues.length === 0, issues };
}
import { hyp } from './hyp.js';
