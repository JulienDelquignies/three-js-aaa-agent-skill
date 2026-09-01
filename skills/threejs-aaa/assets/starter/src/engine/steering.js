// Steering — classic Reynolds steering behaviours for simple, readable AI (chase, flee, intercept,
// wander). Dependency-free: all vectors are planar [x, z], speeds/distances in world units. Feed the
// returned desired velocity to a CharacterController via toMoveInput() → setMoveWorld(). Node-testable
// (scripts/verify-steering.mjs). Mirrors the behaviour blocks in GameBlocks; pairs with reference/22–23.
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const scale = (a, s) => [a[0] * s, a[1] * s];
const len = (a) => hyp(a[0], a[1]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l]; };

/** Desired velocity straight at the target, at full speed. */
export function seek(pos, target, maxSpeed) { return scale(norm(sub(target, pos)), maxSpeed); }
/** Desired velocity directly away from the target. */
export function flee(pos, target, maxSpeed) { return scale(norm(sub(pos, target)), maxSpeed); }
/** Seek that eases down inside `slowRadius` so the agent stops on the target instead of orbiting it. */
export function arrive(pos, target, maxSpeed, slowRadius = 2) {
  const to = sub(target, pos), d = len(to); if (d < 1e-4) return [0, 0];
  return scale(scale(to, 1 / d), d < slowRadius ? maxSpeed * d / slowRadius : maxSpeed);
}
/** Intercept a moving target by seeking its predicted position `predict` seconds ahead. */
export function pursue(pos, targetPos, targetVel, maxSpeed, predict = 0.4) {
  return seek(pos, add(targetPos, scale(targetVel, predict)), maxSpeed);
}
/** Meandering wander around a base heading; vary `t` per frame and by agent for variety. */
export function wander(baseHeading, t, maxSpeed, jitter = 1) {
  const a = baseHeading + Math.sin(t * jitter) * 0.9; return scale([Math.sin(a), Math.cos(a)], maxSpeed);
}
/** Convert a desired velocity into a CharacterController move input: unit direction × magnitude 0..1. */
export function toMoveInput(vel, maxSpeed) {
  const l = len(vel); if (l < 1e-4) return [0, 0];
  const m = Math.min(1, l / maxSpeed); return [vel[0] / l * m, vel[1] / l * m];
}
import { hyp } from './hyp.js';
