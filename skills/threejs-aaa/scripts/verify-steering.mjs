#!/usr/bin/env node
// verify-steering.mjs — self-test for engine/steering.js (Reynolds steering behaviours). Dependency-free.
import { seek, flee, arrive, pursue, wander, toMoveInput } from '../assets/starter/src/engine/steering.js';
let pass = 0, fail = 0;
const approx = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
const len = (v) => Math.hypot(v[0], v[1]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const check = (n, ok, d = '') => { (ok ? pass++ : fail++); console.log(`${ok ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`); };

const S = 5;
// seek points toward the target at full speed
const sv = seek([0, 0], [10, 0], S); check('seek → toward target', approx(sv[0], S) && approx(sv[1], 0), JSON.stringify(sv));
// flee points away
const fv = flee([0, 0], [10, 0], S); check('flee → away from target', fv[0] < 0);
// arrive: full speed far, reduced within slowRadius
check('arrive full speed far', approx(len(arrive([0, 0], [10, 0], S, 2)), S));
check('arrive slows near', len(arrive([0, 0], [1, 0], S, 2)) < S, `speed=${len(arrive([0, 0], [1, 0], S, 2)).toFixed(2)}`);
check('arrive zero on target', len(arrive([5, 5], [5, 5], S, 2)) === 0);
// pursue leads a moving target: aims ahead of its current position
const target = [10, 0], tvel = [0, 6];
const pv = pursue([0, 0], target, tvel, S, 0.5), sv2 = seek([0, 0], target, S);
check('pursue leads a mover (more +z than plain seek)', pv[1] > sv2[1], `pursue.z=${pv[1].toFixed(2)} seek.z=${sv2[1].toFixed(2)}`);
// toMoveInput clamps magnitude to ≤1 and keeps direction
const mi = toMoveInput([S * 2, 0], S); check('toMoveInput clamps to 1', approx(len(mi), 1) && mi[0] > 0);
const mi2 = toMoveInput([S / 2, 0], S); check('toMoveInput scales below max', approx(len(mi2), 0.5, 1e-9));
check('toMoveInput zero for zero vel', len(toMoveInput([0, 0], S)) === 0);
// wander returns a bounded-speed vector
check('wander is a maxSpeed vector', approx(len(wander(0, 1.3, S)), S, 1e-9));

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
