// Locomotion — move a clip-driven character over ground WITHOUT foot-skate ("ice-skating").
//
// This file is the DEPENDENCY-FREE half: cadence math (pure functions, node-testable via
// scripts/verify-locomotion.mjs). The stance finisher — FootLockIK, which poses real bones with two-bone
// IK — lives in ./foot-lock.js because it needs THREE. You usually want BOTH: matchCadence ties leg
// cadence to ground speed, FootLockIK pins the planted foot. See reference/21; verified end-to-end on a
// real Mixamo rig in examples/soldier-volley (window.__volleyReport: planted-foot slip 0.15 → 0 m/frame).

/**
 * Phase (in clip seconds) for a character that has travelled `traveled` metres, given the clip covers
 * `strideLength` metres of ground per loop. Feed to mixer.setTime / action.time. Because phase is driven
 * by DISTANCE, not wall-clock, the legs turn over at ground speed at any speed (incl. accel/decel) — the
 * fix for the gross slide from a fixed clip rate. strideLength is a property of the CLIP; tune once.
 */
export function matchCadence(clipDuration, traveled, strideLength) {
  const s = Math.max(1e-3, strideLength);
  return ((traveled / s) * clipDuration) % clipDuration;
}

/** Estimate a clip's natural stride from the peak-to-peak sweep of a foot bone over one cycle.
 *  Heuristic (in-place clips have no ground truth): fullCycleStride ≈ factor × foot X-sweep.
 *  Returns a starting value to TUNE, not a guarantee — verify with the temporal noFootSkate check. */
export function estimateStride(sampleFootWorldX, { samples = 48, factor = 2.2 } = {}) {
  let mn = Infinity, mx = -Infinity;
  for (let i = 0; i < samples; i++) { const x = sampleFootWorldX(i / samples); mn = Math.min(mn, x); mx = Math.max(mx, x); }
  return Math.max(0.6, (mx - mn) * factor);
}
