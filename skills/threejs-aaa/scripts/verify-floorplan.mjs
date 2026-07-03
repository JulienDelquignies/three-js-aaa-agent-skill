#!/usr/bin/env node
// verify-floorplan.mjs — THE no-regression harness for procedural places. Generates every (type × tier)
// across many seeds and asserts the full correctness contract via checkModel(): rooms tile the footprint
// without overlaps, every room is reachable from outside through DERIVED doors (BFS), doors are wide
// enough for the character capsule and never in a corner, windows only on exterior walls, stairs obey
// riser/going rules and land inside both hubs, hubs stay passable — plus determinism (same seed → same
// model; different seed → different model). Dependency-free.   node verify-floorplan.mjs [--seeds 20]
import { generatePlace, checkModel, wallBoxes } from '../assets/starter/src/engine/floorplan.js';

const N = Number(process.argv[process.argv.indexOf('--seeds') + 1]) || 20;
let pass = 0, fail = 0; const failures = [];
for (const type of ['club', 'home', 'restaurant', 'concession']) for (let tier = 1; tier <= 5; tier++) {
  let ok = true; const msgs = [];
  for (let seed = 0; seed < N; seed++) {
    const m = generatePlace({ type, tier, seed });
    const r = checkModel(m);
    if (!r.ok) { ok = false; msgs.push(`seed ${seed}: ${r.issues.join(' | ')}`); }
    // wallBoxes must reconstruct solid walls (no zero/negative boxes, lintels over every door)
    for (const f of m.floors) for (const w of f.walls) for (const b of wallBoxes(w))
      if (b.h[0] <= 0 || b.h[1] <= 0 || b.h[2] <= 0) { ok = false; msgs.push(`seed ${seed}: degenerate wall box`); }
  }
  // determinism
  const a = JSON.stringify(generatePlace({ type, tier, seed: 3 })), b = JSON.stringify(generatePlace({ type, tier, seed: 3 })), c = JSON.stringify(generatePlace({ type, tier, seed: 4 }));
  if (a !== b) { ok = false; msgs.push('non-deterministic for same seed'); }
  if (a === c) { ok = false; msgs.push('seed has no effect'); }
  (ok ? pass++ : fail++);
  console.log(`${ok ? '✓' : '✗'} ${type} tier ${tier} (${N} seeds)${msgs.length ? ' — ' + msgs[0] : ''}`);
  if (msgs.length) failures.push(...msgs.slice(0, 3).map((s) => `  ${type} t${tier} ${s}`));
}
if (failures.length) console.log('\n' + failures.join('\n'));
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}: ${pass}/20 programs green across ${N} seeds (${N * 20} models)`);
process.exit(fail === 0 ? 0 : 1);
