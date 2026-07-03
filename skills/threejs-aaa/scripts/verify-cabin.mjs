#!/usr/bin/env node
// verify-cabin.mjs — vehicle interiors (engine/cabin.js): for each kind (bus/train/jet) the layout
// must pass checkCabin() — seats inside the shell, no overlaps, the AISLE unobstructed over the full
// length (capsule-passable), clear door bay, forward seats facing forward, table pairs facing each
// other. Plus determinism and named sabotages.
import { generateCabin, checkCabin } from '../assets/starter/src/engine/cabin.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };

for (const kind of ['bus', 'train', 'jet']) {
  const c = generateCabin({ kind });
  const r = checkCabin(c);
  ok(`cabine ${kind} sous contrat (${c.seats.length} sièges${c.tables.length ? `, ${c.tables.length} tables` : ''})`, r.ok, r.issues[0] || '');
  ok(`cabine ${kind} déterministe`, JSON.stringify(generateCabin({ kind })) === JSON.stringify(c));
}
ok('le bus embarque l’équipe (≥ 20 places + conducteur)', generateCabin({ kind: 'bus' }).seats.length >= 21);
ok('le jet est un salon (tables face-à-face, sièges club)', generateCabin({ kind: 'jet' }).tables.length === 2 && generateCabin({ kind: 'jet' }).seats.every((s) => s.vip || s.driver));

const sab = (name, kind, mutate, expect) => {
  const c = generateCabin({ kind }); mutate(c);
  const r = checkCabin(c); const hit = !r.ok && r.issues.some((i) => i.includes(expect));
  (hit ? pass++ : fail++);
  console.log(`${hit ? '✓' : '✗'} sabotage « ${name} » attrapé${hit ? '' : ` — issues: ${r.issues.join('; ') || '(aucune)'}`}`);
};
sab('siège déplacé dans l’allée', 'bus', (c) => { c.seats[3].x = 0; }, 'aisle is obstructed');
sab('siège hors de la carlingue', 'jet', (c) => { c.seats[0].x = 2.5; }, 'outside the shell');
sab('deux sièges superposés', 'train', (c) => { c.seats[1].x = c.seats[0].x; c.seats[1].z = c.seats[0].z; }, 'overlap');
sab('allée rétrécie sous le gabarit capsule', 'bus', (c) => { c.aisle = { x0: -0.2, x1: 0.2 }; }, 'too narrow');
sab('rangée retournée dos à la route', 'bus', (c) => { for (const s of c.seats) if (!s.driver) s.yaw = Math.PI; }, 'does not face the front');
sab('face-à-face du salon jet cassé', 'jet', (c) => { for (const s of c.seats) s.yaw = 0; }, 'lacks its face-to-face pair');

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);
