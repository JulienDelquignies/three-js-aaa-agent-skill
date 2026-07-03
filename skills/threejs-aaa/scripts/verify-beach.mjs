#!/usr/bin/env node
// verify-beach.mjs — the vacation resort (engine/beach.js): for levels 3–4 × seeds the layout must
// pass checkBeach() — the villa under the home contract, the sea strictly beyond the sand, every
// transat ON the sand and FACING THE SEA, palms clear of villa and loungers, spawn walkable and a
// return pad next to it. Plus determinism and named sabotages.
import { generateBeach, checkBeach } from '../assets/starter/src/engine/beach.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };

for (const level of [3, 4]) {
  for (const seed of [1, 2, 3, 7, 11]) {
    const b = generateBeach({ level, seed });
    const r = checkBeach(b);
    ok(`station niveau ${level} seed ${seed} sous contrat (${b.transats.length} transats, ${b.palms.length} palmiers)`, r.ok, r.issues[0] || '');
  }
}
const b1 = generateBeach({ level: 3, seed: 5 });
ok('génération déterministe', JSON.stringify(generateBeach({ level: 3, seed: 5 })) === JSON.stringify(b1));
ok('au niveau 4 la station est plus fournie', generateBeach({ level: 4, seed: 5 }).transats.length > generateBeach({ level: 3, seed: 5 }).transats.length);

const sab = (name, mutate, expect) => {
  const b = generateBeach({ level: 3, seed: 2 }); mutate(b);
  const r = checkBeach(b); const hit = !r.ok && r.issues.some((i) => i.includes(expect));
  (hit ? pass++ : fail++);
  console.log(`${hit ? '✓' : '✗'} sabotage « ${name} » attrapé${hit ? '' : ` — issues: ${r.issues.join('; ') || '(aucune)'}`}`);
};
sab('transat tourné dos à la mer', (b) => { b.transats[0].yaw = Math.PI; }, 'does not face the sea');
sab('transat dans l’eau', (b) => { b.transats[1].z = b.sand[3] + 2; }, 'in the water');
sab('palmier à travers la villa', (b) => { b.palms.push([(b.villa && 0) + 1, 1, 1]); }, 'through the villa');
sab('la mer inonde la plage', (b) => { b.sea[1] = b.sand[3] - 10; }, 'floods the beach');
sab('transat posé sur la terrasse de la villa', (b) => { b.transats[2].x = 1; b.transats[2].z = 1; }, 'clips the villa');
sab('spawn muré dans la villa', (b) => { b.spawn = [1, 0, 1]; }, 'inside the villa');

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);
