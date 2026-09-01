// Tiny dependency-free vec3 / quaternion helpers.
// Canonical types: vec3 = [x,y,z], quat = [x,y,z,w] (same layout as THREE.Quaternion).
// Works in the browser AND in plain Node (so the same logic powers runtime animation and
// headless interaction validation). Bridge to Three.js with v.toArray() / v.fromArray(result).

export const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
export const DEG = 180 / Math.PI;
export const RAD = Math.PI / 180;

// --- vec3 ---
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const len = (a) => hyp(a[0], a[1], a[2]);
export const dist = (a, b) => len(sub(a, b));
export function norm(a) {
  const l = len(a);
  return l > 1e-9 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 0];
}
export const lerp = (a, b, t) => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
/** Angle (radians) between two vectors. */
export function angleBetween(a, b) {
  const na = norm(a), nb = norm(b);
  return Math.acos(clamp(dot(na, nb), -1, 1));
}

// --- quat [x,y,z,w] ---
export const quatIdentity = () => [0, 0, 0, 1];
export function quatMul(a, b) {
  const [ax, ay, az, aw] = a, [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}
export const quatConjugate = (q) => [-q[0], -q[1], -q[2], q[3]];
export function quatNormalize(q) {
  const l = hyp(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
}
export function quatFromAxisAngle(axis, angle) {
  const a = norm(axis), h = angle / 2, s = Math.sin(h);
  return [a[0] * s, a[1] * s, a[2] * s, Math.cos(h)];
}
/** Rotate a vec3 by a quat. */
export function applyQuat(v, q) {
  const [x, y, z] = v, [qx, qy, qz, qw] = q;
  const ix = qw * x + qy * z - qz * y;
  const iy = qw * y + qz * x - qx * z;
  const iz = qw * z + qx * y - qy * x;
  const iw = -qx * x - qy * y - qz * z;
  return [
    ix * qw + iw * -qx + iy * -qz - iz * -qy,
    iy * qw + iw * -qy + iz * -qx - ix * -qz,
    iz * qw + iw * -qz + ix * -qy - iy * -qx,
  ];
}
/** Shortest-arc quaternion rotating unit vector `from` onto unit vector `to`. */
export function quatFromTo(from, to) {
  const f = norm(from), t = norm(to);
  const d = clamp(dot(f, t), -1, 1);
  if (d > 0.999999) return quatIdentity();
  if (d < -0.999999) {
    // 180°: pick any orthogonal axis
    let axis = cross([1, 0, 0], f);
    if (len(axis) < 1e-6) axis = cross([0, 1, 0], f);
    return quatNormalize(quatFromAxisAngle(axis, Math.PI));
  }
  const axis = cross(f, t);
  return quatNormalize([axis[0], axis[1], axis[2], 1 + d]);
}
/** Look rotation: orient local -Z (or a chosen forward axis) toward `forward`, keeping `up`. */
export function quatLookRotation(forward, up = [0, 1, 0]) {
  const f = norm(forward);
  let r = cross(up, f);
  if (len(r) < 1e-6) r = cross([1, 0, 0], f);
  r = norm(r);
  const u = cross(f, r);
  // Column-major basis (r, u, f) → quaternion. THREE's default object forward is +Z here.
  const m00 = r[0], m01 = u[0], m02 = f[0];
  const m10 = r[1], m11 = u[1], m12 = f[1];
  const m20 = r[2], m21 = u[2], m22 = f[2];
  const tr = m00 + m11 + m22;
  let q;
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    q = [(m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, s / 4];
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    q = [s / 4, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s];
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    q = [(m01 + m10) / s, s / 4, (m12 + m21) / s, (m02 - m20) / s];
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    q = [(m02 + m20) / s, (m12 + m21) / s, s / 4, (m10 - m01) / s];
  }
  return quatNormalize(q);
}
/** Angle (radians) between two orientations. */
export function quatAngle(a, b) {
  const d = Math.abs(clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3], -1, 1));
  return 2 * Math.acos(d);
}
import { hyp } from './hyp.js';
