#!/usr/bin/env node
// verify-dealership.mjs — the dealership catalogue (engine/dealership.js) + the personal-money side of
// game-state: catalogue grows with the club level, prices strictly ascending, ALWAYS something
// affordable, the supercar appears at level 3 (window-shopping) and is affordable at level 4; buyCar
// debits the cash, swaps the owned car, pushes a message, and refuses what can't be paid. Sabotages.
import { makeCatalog, checkCatalog } from '../assets/starter/src/engine/dealership.js';
import { makeGameState } from '../assets/starter/src/engine/game-state.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };

for (let level = 1; level <= 4; level++) {
  const cat = makeCatalog({ level });
  const st = makeGameState({ seed: 3, level });
  const r = checkCatalog(cat, st);
  ok(`catalogue niveau ${level} sous contrat (${cat.length} modèles, cash ${st.cash} k€)`, r.ok, r.issues[0] || '');
}
ok('le catalogue grandit avec le niveau', makeCatalog({ level: 1 }).length < makeCatalog({ level: 4 }).length);
ok('la supercar apparaît au niveau 3', !makeCatalog({ level: 2 }).some((m) => m.kind === 'ferrari') && makeCatalog({ level: 3 }).some((m) => m.kind === 'ferrari'));
ok('supercar inabordable au niveau 3, abordable au niveau 4',
  makeCatalog({ level: 3 }).find((m) => m.kind === 'ferrari').price > makeGameState({ seed: 1, level: 3 }).cash &&
  makeCatalog({ level: 4 }).find((m) => m.kind === 'ferrari').price <= makeGameState({ seed: 1, level: 4 }).cash);
{
  const st = makeGameState({ seed: 2, level: 2 });
  const cat = makeCatalog({ level: 2 });
  const cash0 = st.cash, suv = cat.find((m) => m.kind === 'suv');
  const r = st.buyCar(suv, 0x1f3a93);
  ok('achat : débit + voiture changée + message', r.ok && st.cash === cash0 - suv.price && st.car.kind === 'suv' && st.messages[0].from === 'Concessionnaire');
  const ferrari = { kind: 'ferrari', name: 'F', price: 99999 };
  ok('achat refusé si trop cher', !st.buyCar(ferrari, 0).ok && st.car.kind === 'suv');
}
const sab = (name, mutate, expect) => {
  const cat = makeCatalog({ level: 3 }); mutate(cat);
  const r = checkCatalog(cat, makeGameState({ seed: 1, level: 3 }));
  const hit = !r.ok && r.issues.some((i) => i.includes(expect));
  (hit ? pass++ : fail++);
  console.log(`${hit ? '✓' : '✗'} sabotage « ${name} » attrapé${hit ? '' : ` — issues: ${r.issues.join('; ') || '(aucune)'}`}`);
};
sab('prix mélangés', (c) => { c[0].price = 9999; }, 'not strictly ascending');
sab('modèle dupliqué', (c) => { c[1].kind = c[0].kind; }, 'duplicate');
sab('tout inabordable', (c) => { for (const m of c) m.price = 99999; }, 'nothing affordable');
sab('modèle sans couleurs', (c) => { c[0].colors = []; }, 'no display colors');

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);
