#!/usr/bin/env node
// verify-anim-fsm.mjs — self-test for the pure 1D blend-weight math in engine/anim-state-machine.js
// (the AnimationStateMachine itself needs a live AnimationMixer; it's exercised in examples/showcase).
// Only the pure helper is imported so this runs without three (dependency-free).  node verify-anim-fsm.mjs
import { blend1dWeights } from '../assets/starter/src/engine/anim-blend.js';

let pass = 0, fail = 0;
const approx = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
const sum = (a) => a.reduce((s, x) => s + x, 0);
const check = (n, ok, d = '') => { (ok ? pass++ : fail++); console.log(`${ok ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`); };

const A = [{ at: 0 }, { at: 1.8 }, { at: 5.5 }];   // idle / walk / run

check('at 0 → full idle', JSON.stringify(blend1dWeights(A, 0)) === JSON.stringify([1, 0, 0]));
check('at walk anchor → full walk', JSON.stringify(blend1dWeights(A, 1.8)) === JSON.stringify([0, 1, 0]));
check('at run anchor → full run', JSON.stringify(blend1dWeights(A, 5.5)) === JSON.stringify([0, 0, 1]));
check('below range clamps to idle', JSON.stringify(blend1dWeights(A, -3)) === JSON.stringify([1, 0, 0]));
check('above range clamps to run', JSON.stringify(blend1dWeights(A, 99)) === JSON.stringify([0, 0, 1]));

const mid = blend1dWeights(A, 0.9);   // halfway idle→walk
check('idle/walk midpoint splits 50/50', approx(mid[0], 0.5) && approx(mid[1], 0.5) && mid[2] === 0, JSON.stringify(mid));
const w = blend1dWeights(A, 3.65);    // halfway walk→run
check('walk/run midpoint splits 50/50', approx(w[1], 0.5, 1e-9) && approx(w[2], 0.5, 1e-9) && w[0] === 0, JSON.stringify(w));

// always a partition of unity, only ever 2 non-zero neighbours
for (const v of [-1, 0, 0.3, 1.8, 2.0, 4.9, 5.5, 8]) {
  const ww = blend1dWeights(A, v); const nz = ww.filter((x) => x > 1e-9).length;
  check(`sum=1 & ≤2 active at v=${v}`, approx(sum(ww), 1) && nz <= 2, JSON.stringify(ww));
}

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
