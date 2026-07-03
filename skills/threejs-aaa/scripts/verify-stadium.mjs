#!/usr/bin/env node
// verify-stadium.mjs — no-regression harness for the parametric stadium (tier 1 champêtre → tier 5
// ultra-moderne). Asserts checkStadium() for every tier × seed: stands clear of the pitch, the loge above
// the rows, an UNOBSTRUCTED SIGHTLINE from the directors' terrace to the pitch centre — plus capacity
// strictly increasing with tier and determinism.
import { generateStadium, checkStadium } from '../assets/starter/src/engine/stadium.js';

const N = Number(process.argv[process.argv.indexOf('--seeds') + 1]) || 10;
let pass = 0, fail = 0; let prevCap = 0;
for (let tier = 1; tier <= 5; tier++) {
  let ok = true; const msgs = []; let cap = 0;
  for (let seed = 0; seed < N; seed++) {
    const m = generateStadium({ tier, seed }); cap = m.capacity;
    const r = checkStadium(m);
    if (!r.ok) { ok = false; msgs.push(`seed ${seed}: ${r.issues[0]}`); }
  }
  if (cap <= prevCap) { ok = false; msgs.push(`capacity not increasing (t${tier}: ${cap} ≤ ${prevCap})`); }
  prevCap = cap;
  if (JSON.stringify(generateStadium({ tier, seed: 2 })) !== JSON.stringify(generateStadium({ tier, seed: 2 }))) { ok = false; msgs.push('non-deterministic'); }
  (ok ? pass++ : fail++);
  console.log(`${ok ? '✓' : '✗'} stade tier ${tier} (~${cap.toLocaleString('fr')} places)${msgs.length ? ' — ' + msgs[0] : ''}`);
}
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}: ${pass}/5 tiers green`);
process.exit(fail === 0 ? 0 : 1);
