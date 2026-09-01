// Temporal correctness — the animation-time pass. Non-temporal predicates (scene-validate.js,
// interaction.js) check a single frozen frame; these check a SEQUENCE of frames sampled over an
// animation, catching bugs a snapshot can't: foot-skate, an object detaching mid-motion, pops/
// teleports, loop-seam hitches, impossible speeds, and foot-plant phase errors.
//
// Dependency-free (uses vecmath). Inputs are per-frame arrays: positions [[x,y,z],…], quaternions
// [[x,y,z,w],…], booleans [true,false,…], or precomputed distances [d,…]. Sample your animation by
// stepping the mixer/clip and reading bone/object world transforms each frame (see reference/20).

import { dist, quatAngle, DEG } from './vecmath.js';

const R = (name, ok, value, tolerance, detail) => ({ name, ok, value, tolerance, detail });
const horiz = (a, b) => hyp(a[0] - b[0], a[2] - b[2]);

/** A contact/attachment must hold every frame of its window (per-frame gaps ≤ maxGap). */
export function heldThroughout(distances, maxGap = 0.06) {
  let worst = 0, at = -1;
  distances.forEach((d, i) => { if (d > worst) { worst = d; at = i; } });
  const ok = worst <= maxGap;
  return R('heldThroughout', ok, +worst.toFixed(4), maxGap, ok ? 'contact maintained every frame' : `detached at frame ${at} (gap ${worst.toFixed(3)}m)`);
}

/** An attached object's anchor stays at its target across frames (no detachment mid-swing). */
export function attachmentThroughout(anchorPos, targetPos, maxGap = 0.06) {
  const distances = anchorPos.map((a, i) => dist(a, targetPos[i] || targetPos[targetPos.length - 1]));
  return { ...heldThroughout(distances, maxGap), name: 'attachedThroughout' };
}

/** A planted foot's world XZ stays fixed while grounded (no skating/sliding). */
export function noFootSkate(footPos, grounded, maxPerFrame = 0.02) {
  let worst = 0, at = -1;
  for (let i = 1; i < footPos.length; i++) {
    if (grounded[i] && grounded[i - 1]) { const d = horiz(footPos[i], footPos[i - 1]); if (d > worst) { worst = d; at = i; } }
  }
  const ok = worst <= maxPerFrame;
  return R('noFootSkate', ok, +worst.toFixed(4), maxPerFrame, ok ? 'planted foot stays put' : `foot skates ${worst.toFixed(3)}m/frame at frame ${at}`);
}

/** No teleport pops: per-frame position speed and rotation step stay within limits. */
export function noPops(positions, quats = null, { dt = 1 / 30, maxSpeed = 8, maxAngleStepDeg = 45 } = {}) {
  for (let i = 1; i < positions.length; i++) {
    const v = dist(positions[i], positions[i - 1]) / dt;
    if (v > maxSpeed) return R('noPops', false, +v.toFixed(2), maxSpeed, `position pop ${v.toFixed(1)}m/s at frame ${i}`);
    if (quats) { const ang = quatAngle(quats[i], quats[i - 1]) * DEG; if (ang > maxAngleStepDeg) return R('noPops', false, +ang.toFixed(1), maxAngleStepDeg, `rotation pop ${ang.toFixed(0)}° at frame ${i}`); }
  }
  return R('noPops', true, 0, maxSpeed, 'continuous motion (no pops)');
}

/** Effector/root speed and acceleration stay physically plausible. */
export function withinMotionLimits(positions, { dt = 1 / 30, maxSpeed = 12, maxAccel = 300 } = {}) {
  const vel = []; for (let i = 1; i < positions.length; i++) vel.push(dist(positions[i], positions[i - 1]) / dt);
  const maxV = Math.max(0, ...vel);
  let maxA = 0; for (let i = 1; i < vel.length; i++) maxA = Math.max(maxA, Math.abs(vel[i] - vel[i - 1]) / dt);
  const ok = maxV <= maxSpeed && maxA <= maxAccel;
  return R('motionLimits', ok, +maxV.toFixed(2), maxSpeed, ok ? `peak ${maxV.toFixed(1)}m/s` : `impossible motion (v=${maxV.toFixed(1)}m/s, a=${maxA.toFixed(0)}m/s²)`);
}

/** A looping clip matches pose at the seam (last frame ≈ first frame). */
export function loopSeam(firstPos, lastPos, { posTol = 0.02, quatFirst = null, quatLast = null, angTolDeg = 5 } = {}) {
  let worst = 0; const n = Math.min(firstPos.length, lastPos.length);
  for (let i = 0; i < n; i++) worst = Math.max(worst, dist(firstPos[i], lastPos[i]));
  let angOk = true;
  if (quatFirst && quatLast) for (let i = 0; i < Math.min(quatFirst.length, quatLast.length); i++) if (quatAngle(quatFirst[i], quatLast[i]) * DEG > angTolDeg) angOk = false;
  const ok = worst <= posTol && angOk;
  return R('loopSeam', ok, +worst.toFixed(4), posTol, ok ? 'loops seamlessly' : `loop hitch: ${worst.toFixed(3)}m pose mismatch at the seam`);
}

/** Foot-plant phase: no sustained double-float (floating walk); no root travel while both feet planted (skate). */
export function footPlantPhase(leftGrounded, rightGrounded, rootPos, { maxAirFrames = 3, skateTol = 0.03 } = {}) {
  let air = 0, maxAir = 0;
  for (let i = 0; i < leftGrounded.length; i++) { if (!leftGrounded[i] && !rightGrounded[i]) { air++; maxAir = Math.max(maxAir, air); } else air = 0; }
  let skate = 0;
  for (let i = 1; i < rootPos.length; i++) if (leftGrounded[i] && rightGrounded[i] && leftGrounded[i - 1] && rightGrounded[i - 1]) skate = Math.max(skate, horiz(rootPos[i], rootPos[i - 1]));
  const ok = maxAir <= maxAirFrames && skate <= skateTol;
  const detail = maxAir > maxAirFrames ? `both feet airborne ${maxAir} frames (floating walk)` : skate > skateTol ? `root moves ${skate.toFixed(3)}m/frame with both feet planted (skate)` : 'foot phases consistent';
  return R('footPhase', ok, maxAir, maxAirFrames, detail);
}

/** Two characters' effectors actually meet within the interaction window (handshake/pass/high-five). */
export function interactionMeet(effA, effB, { meetTol = 0.05, window = null } = {}) {
  const range = window || [0, effA.length - 1];
  let best = Infinity, at = -1;
  for (let i = range[0]; i <= range[1] && i < effA.length; i++) { const d = dist(effA[i], effB[i]); if (d < best) { best = d; at = i; } }
  const ok = best <= meetTol;
  return R('interactionMeet', ok, +best.toFixed(4), meetTol, ok ? `effectors meet at frame ${at}` : `effectors miss by ${best.toFixed(3)}m`);
}

/** Run a declared set of temporal constraints; returns a pass/fail report. */
export function validateSequence(spec) {
  const checks = [];
  for (const c of spec.constraints || []) {
    switch (c.type) {
      case 'heldThroughout': checks.push({ ref: c, ...heldThroughout(c.distances, c.maxGap) }); break;
      case 'attachedThroughout': checks.push({ ref: c, ...attachmentThroughout(c.anchorPos, c.targetPos, c.maxGap) }); break;
      case 'noFootSkate': checks.push({ ref: c, ...noFootSkate(c.footPos, c.grounded, c.maxPerFrame) }); break;
      case 'noPops': checks.push({ ref: c, ...noPops(c.positions, c.quats, c) }); break;
      case 'motionLimits': checks.push({ ref: c, ...withinMotionLimits(c.positions, c) }); break;
      case 'loopSeam': checks.push({ ref: c, ...loopSeam(c.firstPos, c.lastPos, c) }); break;
      case 'footPhase': checks.push({ ref: c, ...footPlantPhase(c.leftGrounded, c.rightGrounded, c.rootPos, c) }); break;
      case 'interactionMeet': checks.push({ ref: c, ...interactionMeet(c.effA, c.effB, c) }); break;
      default: checks.push(R(`unknown:${c.type}`, false, 0, 0, 'unknown temporal constraint'));
    }
  }
  const failed = checks.filter((c) => !c.ok);
  return { ok: failed.length === 0, checks, failed: failed.map((c) => c.name) };
}
import { hyp } from './hyp.js';
