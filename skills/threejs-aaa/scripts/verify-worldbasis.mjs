#!/usr/bin/env node
// verify-worldbasis.mjs — self-test for engine/world-basis.js (the single source of truth for gameplay
// direction ↔ world axis transforms). Dependency-free. Proves the transforms round-trip and, crucially,
// that a model facing its travel direction does NOT moonwalk.  Run:  node verify-worldbasis.mjs
import { WORLD } from '../assets/starter/src/engine/world-basis.js';

let pass = 0, fail = 0;
const approx = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
const veq = (a, b, e = 1e-9) => approx(a[0], b[0], e) && approx(a[1], b[1], e);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const check = (n, ok, d = '') => { (ok ? pass++ : fail++); console.log(`${ok ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`); };

// 1) heading ↔ direction round-trips; heading 0 = +Z, +π/2 = +X
check('heading 0 → +Z', veq(WORLD.direction(0), [0, 1]));
check('heading +π/2 → +X', veq(WORLD.direction(Math.PI / 2), [1, 0], 1e-12));
for (const d of [[1, 0], [0, 1], [-1, 0], [0.6, -0.8], [-0.3, 0.95]]) {
  const n = WORLD.normalizePlanar(d[0], d[1]);
  check(`direction(heading(${d})) round-trips`, veq(WORLD.direction(WORLD.heading(d[0], d[1])), n, 1e-9));
}

// 2) right is orthogonal to forward and 90° clockwise
const h = 0.7, f = WORLD.direction(h), r = WORLD.right(h);
check('right ⟂ forward', approx(dot(f, r), 0, 1e-12));

// 3) facing round-trip for several model forward axes
for (const fwd of [[0, 0, -1], [0, 0, 1], [1, 0, 0], [-1, 0, 0]]) {
  const fa = WORLD.forwardAngle(fwd);
  for (const dir of [[1, 0], [0, 1], [-0.7, 0.7]]) {
    const nd = WORLD.normalizePlanar(dir[0], dir[1]);
    const yaw = WORLD.yawToFace(nd[0], nd[1], fa);
    check(`fwd ${fwd} faces ${dir}`, veq(WORLD.facingDir(yaw, fa), nd, 1e-9));
  }
}

// 4) THE moonwalk test: Mixamo Soldier forward is −Z. Facing +X via the basis must point +X (dot≈1);
//    the naive rotation.y=+π/2 points −X (dot≈−1) — exactly the bug the basis prevents.
const fa = WORLD.forwardAngle([0, 0, -1]);
const good = WORLD.facingDir(WORLD.yawToFace(1, 0, fa), fa);
const naive = WORLD.facingDir(Math.PI / 2, fa);
check('no moonwalk: basis facing +X has dot≈+1', approx(dot(good, [1, 0]), 1, 1e-9), `dot=${dot(good, [1, 0]).toFixed(3)}`);
check('naive rotation would moonwalk (dot≈−1)', dot(naive, [1, 0]) < -0.9, `dot=${dot(naive, [1, 0]).toFixed(3)}`);

// 5) camera-relative move: forward input goes along the camera heading; right input goes 90° right; magnitude kept
const rh = Math.PI / 2;                    // camera looking +X
check('forward input → camera forward (+X)', veq(WORLD.moveFromInput(0, 1, rh), [1, 0], 1e-12));
check('right input → +Z (screen-right)', veq(WORLD.moveFromInput(1, 0, rh), [0, 1], 1e-12));
const m = WORLD.moveFromInput(0.6, 0.8, 1.3); check('move preserves magnitude', approx(Math.hypot(m[0], m[1]), 1, 1e-9));

// 6) shortestTurn wraps across ±π
check('shortestTurn 3.0→−3.0 is small +', approx(WORLD.shortestTurn(3.0, -3.0), (-3.0 - 3.0) + 2 * Math.PI, 1e-9));
check('turnToward clamps to maxStep', approx(WORLD.turnToward(0, 1, 0.1), 0.1, 1e-9));

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
