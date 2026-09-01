// WorldBasis — the single source of truth for how GAMEPLAY-space directions map onto WORLD axes.
//
// Every "which way is forward / how do I turn to face there / where does this input go" question routes
// through here, so a project can't drift into inconsistent sign conventions — the class of bug that makes
// a character MOONWALK (face one way, travel the other) or shoot backward. Dependency-free (plain numbers
// and [x,y,z] arrays), so it is node-testable (scripts/verify-worldbasis.mjs).
//
// Convention (default up = +Y): the ground is the XZ plane. A HEADING is the angle of a ground direction,
// heading = atan2(x, z) — so heading 0 points +Z and increases toward +X. A model has its own FORWARD axis
// (e.g. the Mixamo Soldier faces −Z); give its ground angle to the facing helpers and everything lines up.
const TAU = Math.PI * 2;

export class WorldBasis {
  constructor({ up = [0, 1, 0] } = {}) {
    this.up = up;
    if (up[1] !== 1 || up[0] !== 0 || up[2] !== 0) console.warn('[WorldBasis] only +Y up is implemented; planar helpers assume the XZ ground plane.');
  }

  // ---- headings ↔ ground directions ----
  heading(dx, dz) { return Math.atan2(dx, dz); }             // angle of a world ground direction
  direction(h) { return [Math.sin(h), Math.cos(h)]; }        // unit world ground dir (x,z) for a heading
  right(h) { return [Math.cos(h), -Math.sin(h)]; }           // 90° right of the heading, on the ground
  planar(v) { return [v[0], 0, v[2]]; }                      // drop the up component
  normalizePlanar(dx, dz) { const l = hyp(dx, dz) || 1; return [dx / l, dz / l]; }

  // ---- model facing (no moonwalk) ----
  // Ground angle of a model's own forward axis, e.g. [0,0,-1] → atan2(0,-1) = π.
  forwardAngle(forwardLocal) { return Math.atan2(forwardLocal[0], forwardLocal[2]); }
  // Yaw (rotation about up) so a model whose forward has ground-angle `fa` points along world dir (dx,dz).
  yawToFace(dx, dz, fa = 0) { return this.heading(dx, dz) - fa; }
  // The world ground direction a model faces, given its yaw and its forward-axis angle. Inverse of yawToFace.
  facingDir(yaw, fa = 0) { return this.direction(yaw + fa); }

  // ---- control-signal transform ----
  // Input on the unit disk (ix = right, iz = forward) taken RELATIVE to `refHeading` (e.g. the camera's
  // heading) → a world ground move vector (x,z). This is what makes WASD / a stick camera-relative.
  moveFromInput(ix, iz, refHeading) {
    const [fx, fz] = this.direction(refHeading);
    const rx = -fz, rz = fx;                                 // screen-right on the ground
    return [fx * iz + rx * ix, fz * iz + rz * ix];
  }

  // ---- turning ----
  // Signed shortest angular difference from → to, in (−π, π]. Feed to a rate-limited turn.
  shortestTurn(from, to) { let d = ((to - from + Math.PI) % TAU) - Math.PI; if (d < -Math.PI) d += TAU; return d; }
  turnToward(from, to, maxStep) { const d = this.shortestTurn(from, to); return from + Math.max(-maxStep, Math.min(maxStep, d)); }
}

// Default gameplay basis (+Y up, XZ ground). Import { WORLD } for the common case.
export const WORLD = new WorldBasis();
import { hyp } from './hyp.js';
