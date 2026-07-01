// Scene correctness validation — the semantic/spatial rules a AAA scene must satisfy, and that
// the agent must CHECK and auto-correct (not the user): support (rests ON, not through),
// non-penetration (furniture through wall), orientation/facing (chair faces desk), containment
// (door in a wall opening), attachment (ball at the foot, not through the body), and sit poses.
//
// Dependency-free (uses vecmath) so it runs in the browser at runtime AND headless in CI.
// Objects are oriented bounding boxes: obb = { c:[x,y,z] center, e:[hx,hy,hz] half-extents,
// q:[x,y,z,w] orientation }. Each check returns { name, ok, value, tolerance, detail, fix? }
// where `fix` is a concrete correction (e.g. a corrected position) the caller can apply.

import { add, sub, dot, cross, applyQuat, norm, len, dist, quatAngle, clamp, DEG } from './vecmath.js';

const R = (name, ok, value, tolerance, detail, fix) => ({ name, ok, value, tolerance, detail, ...(fix ? { fix } : {}) });

export const obbAxes = (q) => [applyQuat([1, 0, 0], q), applyQuat([0, 1, 0], q), applyQuat([0, 0, 1], q)];

/** World-axis-aligned box that encloses an OBB (min/max corners). */
export function worldAABB(o) {
  const ax = obbAxes(o.q);
  const r = [0, 1, 2].map((k) => Math.abs(ax[0][k]) * o.e[0] + Math.abs(ax[1][k]) * o.e[1] + Math.abs(ax[2][k]) * o.e[2]);
  return { min: sub(o.c, r), max: add(o.c, r) };
}

/** Distance from a point to an OBB surface (0 if inside). */
export function pointOBBDistance(p, o) {
  const ax = obbAxes(o.q), d = sub(p, o.c);
  let inside = true, sq = 0;
  for (let i = 0; i < 3; i++) {
    const proj = dot(d, ax[i]);
    const excess = Math.abs(proj) - o.e[i];
    if (excess > 0) { inside = false; sq += excess * excess; }
  }
  return inside ? 0 : Math.sqrt(sq);
}

/** Separating-Axis-Theorem OBB overlap. Returns { overlap, depth?, axis? } (depth on face axes). */
export function obbOverlap(A, B, tol = 0) {
  const a = obbAxes(A.q), b = obbAxes(B.q);
  const Rm = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], Ab = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { Rm[i][j] = dot(a[i], b[j]); Ab[i][j] = Math.abs(Rm[i][j]) + 1e-9; }
  const tv = sub(B.c, A.c), t = [dot(tv, a[0]), dot(tv, a[1]), dot(tv, a[2])];
  let minPen = Infinity, axis = null;
  // face axes of A
  for (let i = 0; i < 3; i++) {
    const ra = A.e[i], rb = B.e[0] * Ab[i][0] + B.e[1] * Ab[i][1] + B.e[2] * Ab[i][2];
    const ov = ra + rb - Math.abs(t[i]);
    if (ov <= tol) return { overlap: false };
    if (ov < minPen) { minPen = ov; axis = a[i]; }
  }
  // face axes of B
  for (let j = 0; j < 3; j++) {
    const ra = A.e[0] * Ab[0][j] + A.e[1] * Ab[1][j] + A.e[2] * Ab[2][j], rb = B.e[j];
    const tt = t[0] * Rm[0][j] + t[1] * Rm[1][j] + t[2] * Rm[2][j];
    const ov = ra + rb - Math.abs(tt);
    if (ov <= tol) return { overlap: false };
    if (ov < minPen) { minPen = ov; axis = b[j]; }
  }
  // 9 edge cross-axes (separation only — completes the SAT so we never miss a gap)
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    const ra = A.e[(i + 1) % 3] * Ab[(i + 2) % 3][j] + A.e[(i + 2) % 3] * Ab[(i + 1) % 3][j];
    const rb = B.e[(j + 1) % 3] * Ab[i][(j + 2) % 3] + B.e[(j + 2) % 3] * Ab[i][(j + 1) % 3];
    const tt = t[(i + 2) % 3] * Rm[(i + 1) % 3][j] - t[(i + 1) % 3] * Rm[(i + 2) % 3][j];
    if (Math.abs(tt) > ra + rb + tol) return { overlap: false };
  }
  return { overlap: true, depth: minPen, axis };
}

// ---------- predicates ----------

/** Object rests ON a support surface: its underside touches the support top, within its footprint,
 * and does not sink through it. Covers "plant on table (not through)", "box on floor". */
export function restsOn(obj, support, tol = 0.03) {
  const o = worldAABB(obj), s = worldAABB(support);
  const gap = o.min[1] - s.max[1];                 // +: floating, -: penetrating
  const overX = o.min[0] <= s.max[0] + tol && o.max[0] >= s.min[0] - tol;
  const overZ = o.min[2] <= s.max[2] + tol && o.max[2] >= s.min[2] - tol;
  const contact = Math.abs(gap) <= tol;
  const ok = contact && overX && overZ;
  const detail = !overX || !overZ ? 'object is not above the support footprint'
    : gap > tol ? `floating ${gap.toFixed(3)}m above support`
    : gap < -tol ? `penetrating ${(-gap).toFixed(3)}m into support`
    : 'resting on support';
  // fix: snap Y so underside sits on the support top
  const fix = ok ? undefined : { position: [obj.c[0], obj.c[1] - gap, obj.c[2]] };
  return R('restsOn', ok, +gap.toFixed(4), tol, detail, fix);
}

/** Two objects must NOT interpenetrate (furniture vs wall, prop vs prop). */
export function noPenetration(a, b, tol = 0.01) {
  const r = obbOverlap(a, b, tol);
  if (!r.overlap) return R('noPenetration', true, 0, tol, 'no overlap');
  // fix: push A out of B along the minimum-penetration axis (away from B)
  const dir = dot(sub(a.c, b.c), r.axis) < 0 ? [-r.axis[0], -r.axis[1], -r.axis[2]] : r.axis;
  const push = (r.depth + tol);
  const fix = { position: add(a.c, [dir[0] * push, dir[1] * push, dir[2] * push]) };
  return R('noPenetration', false, +r.depth.toFixed(4), tol, `overlapping by ${r.depth.toFixed(3)}m`, fix);
}

const flat = (v) => [v[0], 0, v[2]];
/** Forward of an OBB (local +Z rotated to world). */
export const forwardOf = (o) => norm(applyQuat([0, 0, 1], o.q));

/** A faces B on the horizontal plane within a tolerance (chair faces desk, actor faces object). */
export function facing(a, bPos, maxAngleDeg = 20) {
  const f = flat(forwardOf(a)), to = flat(sub(bPos, a.c));
  const ang = len(to) < 1e-6 ? 0 : Math.acos(clamp(dot(norm(f), norm(to)), -1, 1)) * DEG;
  return R('facing', ang <= maxAngleDeg, +ang.toFixed(2), maxAngleDeg, `heading off by ${ang.toFixed(1)}°`);
}

/** Two orientations match within a tolerance (sit orientation = chair orientation, door ∥ wall). */
export function orientationMatch(qa, qb, maxAngleDeg = 15) {
  const ang = quatAngle(qa, qb) * DEG;
  return R('orientation', ang <= maxAngleDeg, +ang.toFixed(2), maxAngleDeg, `orientation off by ${ang.toFixed(1)}°`);
}

/**
 * A panel (door/window) is correctly set into a wall opening: coplanar with the wall (within its
 * thickness), its face aligned with the wall normal, and contained within the opening rectangle.
 * wall = { c, normal:[x,y,z], halfThickness, tU:[x,y,z], tV:[x,y,z], openCenter:[x,y,z], openHalf:[u,v] }
 */
export function insideOpening(door, wall, tol = 0.03) {
  const n = norm(wall.normal), u = norm(wall.tU), v = norm(wall.tV);
  const rel = sub(door.c, wall.openCenter);
  const offN = Math.abs(dot(rel, n));                    // distance off the wall plane
  const coplanar = offN <= wall.halfThickness + tol;
  // door face normal ≈ wall normal (or opposite)
  const df = forwardOf(door);
  const align = Math.max(Math.abs(dot(df, n)));          // 1 = aligned
  const aligned = align >= Math.cos((tol + 0.26));       // ~15° tolerance
  // door tangent-plane extents (project OBB half-extents onto u and v)
  const dax = obbAxes(door.q);
  const eu = Math.abs(dot(dax[0], u)) * door.e[0] + Math.abs(dot(dax[1], u)) * door.e[1] + Math.abs(dot(dax[2], u)) * door.e[2];
  const ev = Math.abs(dot(dax[0], v)) * door.e[0] + Math.abs(dot(dax[1], v)) * door.e[1] + Math.abs(dot(dax[2], v)) * door.e[2];
  const du = Math.abs(dot(rel, u)), dv = Math.abs(dot(rel, v));
  const contained = du + eu <= wall.openHalf[0] + tol && dv + ev <= wall.openHalf[1] + tol;
  const ok = coplanar && aligned && contained;
  const detail = !coplanar ? `off the wall plane by ${offN.toFixed(3)}m (sticks through)`
    : !aligned ? `door face not aligned with the wall (${(Math.acos(clamp(align, -1, 1)) * DEG).toFixed(0)}° off)`
    : !contained ? 'door does not fit within the opening' : 'door correctly set in the opening';
  // fix: pull door onto the wall plane, centered under the opening if it fits
  const onPlane = sub(door.c, [n[0] * dot(rel, n), n[1] * dot(rel, n), n[2] * dot(rel, n)]);
  return R('insideOpening', ok, +offN.toFixed(4), wall.halfThickness + tol, detail, ok ? undefined : { position: onPlane });
}

/**
 * Attachment: an object (ball) is at an attach point (foot tip) AND does not pass through a body.
 * ball = { c, radius }; footTip = [x,y,z]; body = OBB (capsule approximated as a box).
 */
export function attachment(ball, footTip, body, maxGap = 0.08) {
  const d = dist(ball.c, footTip);
  const atFoot = d <= ball.radius + maxGap;
  const bodyDist = pointOBBDistance(ball.c, body);      // 0 = center inside body
  const clear = bodyDist >= ball.radius - 0.02;         // ball surface not inside the body
  const ok = atFoot && clear;
  const detail = !atFoot ? `ball ${d.toFixed(3)}m from foot (need ≤ ${(ball.radius + maxGap).toFixed(2)}m)`
    : !clear ? `ball passes through the body (surface ${(ball.radius - bodyDist).toFixed(3)}m inside)`
    : 'ball at the foot, clear of the body';
  return R('attachment', ok, +d.toFixed(4), ball.radius + maxGap, detail);
}

/** Sit pose: pelvis rests on the seat AND the character is oriented like the chair. */
export function sitPose(pelvis, seat, characterQuat, chairQuat, opts = {}) {
  return [
    { ...restsOn(pelvis, seat, opts.seatTol ?? 0.05), name: 'seatContact' },
    { ...orientationMatch(characterQuat, chairQuat, opts.orientDeg ?? 20), name: 'sitOrientation' },
  ];
}

/** Object held in a hand: grip point at the hand socket AND object clear of the body/arm. */
export function heldInHand(obj, gripWorld, handWorld, body, maxGap = 0.06) {
  const d = dist(gripWorld, handWorld);
  const atHand = d <= maxGap;
  const clear = !obbOverlap(obj, body, 0.02).overlap;
  return [
    R('gripAtHand', atHand, +d.toFixed(4), maxGap, atHand ? 'grip at the hand' : `grip ${d.toFixed(3)}m from the hand`),
    R('clearOfBody', clear, 0, 0, clear ? 'object clear of the body' : 'held object clips the body/arm'),
  ];
}

/** Nothing floats: object rests on the ground or one of its supports, or it's flagged floating. */
export function supported(obj, { supports = [], groundY = null, tol = 0.03 } = {}) {
  const o = worldAABB(obj);
  if (groundY != null && Math.abs(o.min[1] - groundY) <= tol) return R('supported', true, +(o.min[1] - groundY).toFixed(4), tol, 'resting on ground');
  for (const s of supports) if (restsOn(obj, s, tol).ok) return R('supported', true, 0, tol, 'resting on a support');
  const gap = groundY != null ? o.min[1] - groundY : o.min[1];
  const fix = groundY != null ? { position: [obj.c[0], obj.c[1] - (o.min[1] - groundY), obj.c[2]] } : undefined;
  return R('supported', false, +gap.toFixed(4), tol, 'floating — nothing supports it', fix);
}

/** Object that should stand upright has its local +Y within a tilt tolerance of world up. */
export function upright(obj, maxTiltDeg = 8) {
  const up = norm(applyQuat([0, 1, 0], obj.q));
  const tilt = Math.acos(clamp(dot(up, [0, 1, 0]), -1, 1)) * DEG;
  return R('upright', tilt <= maxTiltDeg, +tilt.toFixed(2), maxTiltDeg, `tilted ${tilt.toFixed(1)}° from vertical`);
}

/** Won't topple: the object's centre (approx. centre of mass) sits over its support footprint. */
export function stableOnBase(obj, support, margin = 0.0) {
  const s = worldAABB(support);
  const inX = obj.c[0] >= s.min[0] - margin && obj.c[0] <= s.max[0] + margin;
  const inZ = obj.c[2] >= s.min[2] - margin && obj.c[2] <= s.max[2] + margin;
  const ok = inX && inZ;
  return R('stable', ok, 0, margin, ok ? 'centre of mass over the base' : 'centre of mass past the base — topples');
}

/** Plausible real-world size for an object archetype (see SIZE_TABLE). */
export const SIZE_TABLE = {
  human: { h: [1.4, 2.1] }, door: { h: [1.9, 2.3], foot: [[0.03, 0.15], [0.6, 1.2]] },
  chair: { h: [0.7, 1.2], foot: [[0.35, 0.6], [0.35, 0.6]] }, stool: { h: [0.4, 0.8] },
  table: { h: [0.68, 0.78], foot: [[0.5, 1.4], [0.7, 2.4]] }, desk: { h: [0.7, 0.8], foot: [[0.5, 0.9], [1.0, 2.0]] },
  sofa: { h: [0.7, 1.1], foot: [[0.8, 1.05], [1.4, 2.8]] }, bed: { h: [0.4, 1.4], foot: [[0.9, 1.9], [1.9, 2.2]] },
  bookshelf: { h: [0.8, 2.2] }, lamp_floor: { h: [1.2, 1.8] }, bottle: { h: [0.18, 0.35] }, cup: { h: [0.06, 0.14] },
  car: { h: [1.3, 1.9], foot: [[1.6, 2.1], [3.6, 5.4]] }, window: { h: [0.6, 1.8] }, step: { h: [0.14, 0.20] },
  ball_football: { h: [0.20, 0.24] }, goal_football: { h: [2.3, 2.6], foot: [[0.5, 2.5], [6.8, 7.7]] },
};
export function withinScale(obj, archetype, table = SIZE_TABLE) {
  const spec = table[archetype];
  if (!spec) return R('scale', true, 0, 0, `no size reference for "${archetype}"`);
  const a = worldAABB(obj), size = [a.max[0] - a.min[0], a.max[1] - a.min[1], a.max[2] - a.min[2]];
  const h = size[1], foot = [size[0], size[2]].sort((x, y) => x - y);
  const okH = h >= spec.h[0] - 1e-6 && h <= spec.h[1] + 1e-6;
  const okF = !spec.foot || (foot[0] >= spec.foot[0][0] - 1e-6 && foot[0] <= spec.foot[0][1] + 1e-6 && foot[1] >= spec.foot[1][0] - 1e-6 && foot[1] <= spec.foot[1][1] + 1e-6);
  const ok = okH && okF;
  return R('scale', ok, +h.toFixed(3), spec.h[1], ok ? `plausible ${archetype} size` : `implausible ${archetype} size (h=${h.toFixed(2)}m, expected ${spec.h[0]}–${spec.h[1]}m)`);
}

/** Continuity: two segment endpoints coincide (road/pipe/rail/fence runs, terrain seams). */
export function connected(pA, pB, tol = 0.05) {
  const d = dist(pA, pB);
  return R('connected', d <= tol, +d.toFixed(4), tol, d <= tol ? 'endpoints connected' : `gap of ${d.toFixed(3)}m between segments`, d <= tol ? undefined : { position: [(pA[0] + pB[0]) / 2, (pA[1] + pB[1]) / 2, (pA[2] + pB[2]) / 2] });
}

/** Containment: object fully inside a container/room bounds. */
export function containedWithin(obj, container, tol = 0.02) {
  const o = worldAABB(obj), c = worldAABB(container);
  const inside = [0, 1, 2].every((k) => o.min[k] >= c.min[k] - tol && o.max[k] <= c.max[k] + tol);
  return R('contained', inside, 0, tol, inside ? 'fully inside the container' : 'sticks outside the container');
}

/** Flush against a wall plane: touching, not gapped, not sunk in. */
export function flushAgainst(obj, plane, tol = 0.03) {
  const n = norm(plane.normal);
  const eN = obbAxes(obj.q).reduce((s, ax, i) => s + Math.abs(dot(ax, n)) * obj.e[i], 0);
  const distC = dot(sub(obj.c, plane.point), n);      // signed distance of centre to plane
  const gap = Math.abs(distC) - eN;                    // +: gapped, -: overlapping
  const ok = Math.abs(gap) <= tol && distC > 0;
  // fix: slide the centre along the normal so the near face just touches the plane (in front of it)
  const inPlane = sub(obj.c, [n[0] * distC, n[1] * distC, n[2] * distC]);
  const fix = ok ? undefined : { position: add(inPlane, [n[0] * eN, n[1] * eN, n[2] * eN]) };
  return R('flush', ok, +gap.toFixed(4), tol, ok ? 'flush against the wall' : gap > 0 ? `gap of ${gap.toFixed(3)}m from wall` : `sunk ${(-gap).toFixed(3)}m into wall`, fix);
}

/** Minimum clearance between two objects (headroom, path width, spacing). */
export function clearance(a, b, minGap) {
  const A = worldAABB(a), B = worldAABB(b);
  const sep = Math.max(A.min[0] - B.max[0], B.min[0] - A.max[0], A.min[1] - B.max[1], B.min[1] - A.max[1], A.min[2] - B.max[2], B.min[2] - A.max[2]);
  return R('clearance', sep >= minGap, +sep.toFixed(4), minGap, sep >= minGap ? `clearance ${sep.toFixed(2)}m` : `only ${sep.toFixed(2)}m clearance (need ${minGap}m)`);
}

/**
 * Run a declared set of constraints and return a pass/fail report with fixes.
 * spec = { objects: { id: obb|{...} }, constraints: [ {type, ...refs} ] }
 * Supported types: restsOn{obj,support}, noPenetration{a,b}, facing{a,target}, orientation{a,b},
 * insideOpening{door,wall}, attachment{ball,footTip,body}, sit{pelvis,seat,character,chair}.
 */
export function validateScene(spec) {
  const O = spec.objects || {};
  const g = (id) => O[id] ?? id;                         // allow inline obb or id reference
  const checks = [];
  for (const cst of spec.constraints || []) {
    switch (cst.type) {
      case 'restsOn': checks.push({ ref: cst, ...restsOn(g(cst.obj), g(cst.support), cst.tol) }); break;
      case 'noPenetration': checks.push({ ref: cst, ...noPenetration(g(cst.a), g(cst.b), cst.tol) }); break;
      case 'facing': checks.push({ ref: cst, ...facing(g(cst.a), cst.target ?? g(cst.b).c, cst.maxAngleDeg) }); break;
      case 'orientation': checks.push({ ref: cst, ...orientationMatch(g(cst.a).q, g(cst.b).q, cst.maxAngleDeg) }); break;
      case 'insideOpening': checks.push({ ref: cst, ...insideOpening(g(cst.door), cst.wall, cst.tol) }); break;
      case 'attachment': checks.push({ ref: cst, ...attachment(g(cst.ball), cst.footTip, g(cst.body), cst.maxGap) }); break;
      case 'sit': for (const c of sitPose(g(cst.pelvis), g(cst.seat), g(cst.character).q, g(cst.chair).q, cst)) checks.push({ ref: cst, ...c }); break;
      case 'held': for (const c of heldInHand(g(cst.obj), cst.gripWorld, cst.handWorld, g(cst.body), cst.maxGap)) checks.push({ ref: cst, ...c }); break;
      case 'supported': checks.push({ ref: cst, ...supported(g(cst.obj), { supports: (cst.supports || []).map(g), groundY: cst.groundY, tol: cst.tol }) }); break;
      case 'upright': checks.push({ ref: cst, ...upright(g(cst.obj), cst.maxTiltDeg) }); break;
      case 'stable': checks.push({ ref: cst, ...stableOnBase(g(cst.obj), g(cst.support), cst.margin) }); break;
      case 'scale': checks.push({ ref: cst, ...withinScale(g(cst.obj), cst.archetype, cst.table) }); break;
      case 'connected': checks.push({ ref: cst, ...connected(cst.a, cst.b, cst.tol) }); break;
      case 'contained': checks.push({ ref: cst, ...containedWithin(g(cst.obj), g(cst.container), cst.tol) }); break;
      case 'flush': checks.push({ ref: cst, ...flushAgainst(g(cst.obj), cst.plane, cst.tol) }); break;
      case 'clearance': checks.push({ ref: cst, ...clearance(g(cst.a), g(cst.b), cst.minGap) }); break;
      default: checks.push(R(`unknown:${cst.type}`, false, 0, 0, 'unknown constraint type'));
    }
  }
  const failed = checks.filter((c) => !c.ok);
  return { ok: failed.length === 0, checks, failed: failed.map((c) => c.name), fixes: failed.filter((c) => c.fix).map((c) => ({ constraint: c.ref, fix: c.fix })) };
}
