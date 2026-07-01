// Character ↔ object interaction: alignment onto attach points (sockets) and correctness
// validation (is the character in reach, facing the object, hand on target, feet on ground,
// orientation matched — within tolerances). Dependency-free so it runs both in the browser
// (runtime) and in Node (headless verification / CI).
//
// Transform convention: an object/character has a world position `pos` [x,y,z] and world
// orientation `quat` [x,y,z,w]. A "socket" is an attach point expressed in the parent's LOCAL
// space as { pos, quat } (quat optional, defaults to identity). "Forward" is the local +Z axis
// (THREE's convention for objects), rotated by the world quaternion.

import {
  sub, add, dist, norm, angleBetween, applyQuat, quatMul, quatConjugate,
  quatIdentity, quatAngle, DEG,
} from './vecmath.js';

/** World transform of a socket defined in a parent's local space. */
export function socketWorld(parent, socket) {
  const q = socket.quat || quatIdentity();
  return {
    pos: add(parent.pos, applyQuat(socket.pos, parent.quat)),
    quat: quatMul(parent.quat, q),
  };
}

/** Local +Z forward of a transform, in world space. */
export const forwardOf = (t) => norm(applyQuat([0, 0, 1], t.quat));

/**
 * Compute the character world transform so its attach point (character-local socket) coincides
 * with an object socket (position AND orientation). Use this to snap a character into a "sit on
 * chair", "grab handle", "climb ladder" pose, then IK the limbs from there.
 *
 *   const { pos, quat } = alignToSocket(objectXf, objSocket, charAttachSocket);
 *   character.position.fromArray(pos); character.quaternion.fromArray(quat);
 */
export function alignToSocket(objectXf, objectSocket, charAttach) {
  const target = socketWorld(objectXf, objectSocket);          // where the attach point must land
  const cq = charAttach.quat || quatIdentity();
  const charQuat = quatMul(target.quat, quatConjugate(cq));     // charQuat * cq = target.quat
  const charPos = sub(target.pos, applyQuat(charAttach.pos, charQuat));
  return { pos: charPos, quat: charQuat };
}

// ---------- individual checks (each returns a structured result) ----------
const result = (name, ok, value, tolerance, detail) => ({ name, ok, value, tolerance, detail });

/** Hand (or effector) is at the target within a position tolerance (meters). */
export function checkOnTarget(effectorPos, targetPos, posTol = 0.05) {
  const d = dist(effectorPos, targetPos);
  return result('onTarget', d <= posTol, +d.toFixed(4), posTol, `distance ${d.toFixed(3)}m ≤ ${posTol}m`);
}

/**
 * Actor is facing the target within an angular tolerance (degrees). Measured on the horizontal
 * (XZ) plane — a character's heading is a ground-plane direction regardless of the target's height.
 */
export function checkFacing(actorXf, targetPos, maxAngleDeg = 25) {
  const flat = (v) => [v[0], 0, v[2]];
  const fwd = flat(forwardOf(actorXf));
  const toTarget = flat(sub(targetPos, actorXf.pos));
  const angle = angleBetween(fwd, toTarget) * DEG;
  return result('facing', angle <= maxAngleDeg, +angle.toFixed(2), maxAngleDeg, `heading off by ${angle.toFixed(1)}°`);
}

/** Effector orientation matches the socket orientation within a tolerance (degrees). */
export function checkOrientation(effectorQuat, socketQuat, maxAngleDeg = 20) {
  const angle = quatAngle(effectorQuat, socketQuat) * DEG;
  return result('orientation', angle <= maxAngleDeg, +angle.toFixed(2), maxAngleDeg, `orientation off by ${angle.toFixed(1)}°`);
}

/** Target is within the actor's reach (interaction range), and not absurdly close. */
export function checkReach(actorPos, targetPos, maxReach, minReach = 0) {
  const d = dist(actorPos, targetPos);
  return result('reach', d <= maxReach && d >= minReach, +d.toFixed(3), maxReach, `range ${d.toFixed(2)}m (allowed ${minReach}–${maxReach}m)`);
}

/** A foot (or both) is on the ground plane within a tolerance (meters). */
export function checkGroundContact(footPos, groundY = 0, tol = 0.03) {
  const dy = Math.abs(footPos[1] - groundY);
  return result('groundContact', dy <= tol, +dy.toFixed(4), tol, `foot ${dy.toFixed(3)}m from ground`);
}

/** No interpenetration: actor and object bounding spheres don't overlap beyond a small tolerance. */
export function checkNoPenetration(actorPos, actorRadius, objectPos, objectRadius, tol = 0.02) {
  const d = dist(actorPos, objectPos);
  const minAllowed = actorRadius + objectRadius - tol;
  return result('noPenetration', d >= minAllowed, +d.toFixed(3), minAllowed, `centers ${d.toFixed(2)}m apart, need ≥ ${minAllowed.toFixed(2)}m`);
}

/**
 * Run all applicable checks from a single spec and return a pass/fail report.
 * Only the checks whose inputs are present in the spec are run.
 *
 * spec = {
 *   actor:  { pos:[x,y,z], quat:[x,y,z,w], radius? },
 *   object: { pos, quat, radius?, socket:{ pos, quat } },
 *   effector: { pos, quat },              // e.g. the hand
 *   target:   { pos },                    // usually the object socket world pos
 *   feet:   [ [x,y,z], ... ],             // foot positions to ground-check
 *   groundY, tolerances:{ pos, facingDeg, orientDeg, reach, minReach, ground }
 * }
 */
export function validateInteraction(spec) {
  const tol = spec.tolerances || {};
  const checks = [];

  // Resolve the world target (explicit, or the object socket).
  let targetPos = spec.target?.pos;
  let socketQuat = spec.target?.quat;
  if (!targetPos && spec.object?.socket) {
    const sw = socketWorld(spec.object, spec.object.socket);
    targetPos = sw.pos; socketQuat = socketQuat || sw.quat;
  }

  if (spec.effector?.pos && targetPos) checks.push(checkOnTarget(spec.effector.pos, targetPos, tol.pos));
  if (spec.actor && targetPos) checks.push(checkFacing(spec.actor, targetPos, tol.facingDeg));
  if (spec.effector?.quat && socketQuat) checks.push(checkOrientation(spec.effector.quat, socketQuat, tol.orientDeg));
  if (spec.actor && targetPos && tol.reach != null) checks.push(checkReach(spec.actor.pos, targetPos, tol.reach, tol.minReach || 0));
  for (const foot of spec.feet || []) checks.push(checkGroundContact(foot, spec.groundY || 0, tol.ground));
  if (spec.actor?.radius != null && spec.object?.radius != null)
    checks.push(checkNoPenetration(spec.actor.pos, spec.actor.radius, spec.object.pos, spec.object.radius, tol.penetration));

  const failed = checks.filter((c) => !c.ok);
  return { ok: failed.length === 0, checks, failed: failed.map((c) => c.name) };
}
