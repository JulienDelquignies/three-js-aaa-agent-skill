#!/usr/bin/env node
// verify-furnish.mjs — no-regression harness for rule-based furnishing. For every generated place
// (type × tier × seeds), furnishPlace() must produce items that pass checkFurnishing(): inside their
// room, no overlaps, no door/stair clearance blocked, facing constraints hold (chair→desk, tv→sofa).
// Also asserts recipes actually produce furniture (rooms aren't left empty) + determinism.
import { generatePlace } from '../assets/starter/src/engine/floorplan.js';
import { furnishPlace, checkFurnishing } from '../assets/starter/src/engine/furnish.js';

const N = Number(process.argv[process.argv.indexOf('--seeds') + 1]) || 20;
let pass = 0, fail = 0; const failures = [];
for (const type of ['club', 'home']) for (let tier = 1; tier <= 5; tier++) {
  let ok = true; const msgs = []; let minItems = Infinity;
  for (let seed = 0; seed < N; seed++) {
    const model = generatePlace({ type, tier, seed });
    const items = furnishPlace(model);
    minItems = Math.min(minItems, items.length);
    const r = checkFurnishing(model, items);
    if (!r.ok) { ok = false; msgs.push(`seed ${seed}: ${r.issues.slice(0, 2).join(' | ')}`); }
  }
  if (minItems < model_min(type, tier)) { ok = false; msgs.push(`too few items (min ${minItems})`); }
  const a = JSON.stringify(furnishPlace(generatePlace({ type, tier, seed: 3 })));
  const b = JSON.stringify(furnishPlace(generatePlace({ type, tier, seed: 3 })));
  if (a !== b) { ok = false; msgs.push('non-deterministic'); }
  (ok ? pass++ : fail++);
  console.log(`${ok ? '✓' : '✗'} ${type} tier ${tier} (${N} seeds, ≥${minItems} items)${msgs.length ? ' — ' + msgs[0] : ''}`);
  if (msgs.length) failures.push(...msgs.slice(0, 3).map((s) => `  ${type} t${tier} ${s}`));
}
function model_min(type, tier) { return type === 'club' ? 4 + tier : 3; }
if (failures.length) console.log('\n' + failures.join('\n'));
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}: ${pass}/10 programs furnished correctly across ${N} seeds`);
process.exit(fail === 0 ? 0 : 1);
