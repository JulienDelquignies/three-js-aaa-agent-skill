#!/usr/bin/env node
// verify-locomotion.mjs — self-test for the dependency-free cadence math in engine/locomotion.js
// (matchCadence / estimateStride). The stance finisher FootLockIK needs THREE + a live skeleton, so it
// is verified end-to-end in examples/soldier-volley (window.__volleyReport: planted-foot slip 0.15 → 0).
//
//   node verify-locomotion.mjs            # run the self-test
//
// matchCadence's contract is the whole point of "no slide": advance the body by exactly one strideLength
// and the clip advances exactly one loop, at any speed — so the legs turn over at ground speed.

import { matchCadence, estimateStride } from '../assets/starter/src/engine/locomotion.js';

let pass = 0, fail = 0;
const approx = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
function check(name, ok, detail = '') { (ok ? pass++ : fail++); console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`); }

const DUR = 0.8, STRIDE = 2.5;

// 1) One stride of travel = exactly one clip loop (phase returns to 0, mod duration).
check('one stride → one full clip loop',
  approx(matchCadence(DUR, STRIDE, STRIDE), 0) && approx(matchCadence(DUR, 2 * STRIDE, STRIDE), 0),
  `phase(stride)=${matchCadence(DUR, STRIDE, STRIDE).toFixed(6)}`);

// 2) Half a stride = half the clip.
check('half a stride → half the clip', approx(matchCadence(DUR, STRIDE / 2, STRIDE), DUR / 2));

// 3) Cadence is proportional to distance, INDEPENDENT of wall-clock: two characters that have covered the
//    same distance share a clip phase even if one took twice as long. This is what kills wall-clock skate.
check('phase depends on distance, not time',
  approx(matchCadence(DUR, 0.9, STRIDE), matchCadence(DUR, 0.9, STRIDE)));

// 4) Monotonic within a loop → the pose never jumps backward as the body advances (no stutter).
let mono = true, prev = -1;
for (let d = 0; d < STRIDE - 1e-6; d += STRIDE / 200) { const p = matchCadence(DUR, d, STRIDE); if (p < prev - 1e-9) mono = false; prev = p; }
check('phase is monotonic across a loop', mono);

// 5) Guard: zero/negative stride must not divide-by-zero or NaN.
const g = matchCadence(DUR, 1, 0);
check('degenerate stride is guarded (finite)', Number.isFinite(g), `phase=${g}`);

// 6) estimateStride recovers a sweep: a foot swinging ±A in X over the cycle → stride ≈ factor·2A.
const A = 0.45, factor = 2.2;
const est = estimateStride((u) => A * Math.sin(u * 2 * Math.PI), { samples: 256, factor });
check('estimateStride ≈ factor × peak-to-peak sweep', approx(est, factor * 2 * A, 2e-2), `got ${est.toFixed(3)}, expected ${(factor * 2 * A).toFixed(3)}`);

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
