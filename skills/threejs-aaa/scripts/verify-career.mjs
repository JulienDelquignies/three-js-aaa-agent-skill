#!/usr/bin/env node
// verify-career.mjs — no-regression harness for the CAREER WORLD (engine/career.js): for every club
// level × seed, the whole derived world must pass checkCareer() — each site passes its own contract
// (floorplan ×2, stadium), the site footprints keep clear ground between them, the travel graph makes
// every site reachable from home, the pads land where the player can stand (outside the entrance /
// inside the loge, clear of its furniture), and spawns are on-site. Plus determinism and sabotages
// (the contract must bite when the world is hand-broken).
import { generateCareer, checkCareer } from '../assets/starter/src/engine/career.js';

const N = Number(process.argv[process.argv.indexOf('--seeds') + 1]) || 8;
let pass = 0, fail = 0;
for (let level = 1; level <= 4; level++) {
  let ok = true; const msgs = [];
  for (let seed = 1; seed <= N; seed++) {
    const c = generateCareer({ level, seed });
    const r = checkCareer(c);
    if (!r.ok) { ok = false; msgs.push(`seed ${seed}: ${r.issues[0]}`); }
  }
  if (JSON.stringify(generateCareer({ level, seed: 3 })) !== JSON.stringify(generateCareer({ level, seed: 3 }))) { ok = false; msgs.push('non-deterministic'); }
  (ok ? pass++ : fail++);
  console.log(`${ok ? '✓' : '✗'} carrière niveau ${level} (${N} seeds)${msgs.length ? ' — ' + msgs[0] : ''}`);
}

// sabotages — hand-break the world, the contract must catch it by name
const sab = (name, mutate, expect) => {
  const c = generateCareer({ level: 3, seed: 1 }); mutate(c);
  const r = checkCareer(c); const hit = !r.ok && r.issues.some((i) => i.includes(expect));
  (hit ? pass++ : fail++);
  console.log(`${hit ? '✓' : '✗'} sabotage « ${name} » attrapé${hit ? '' : ` — issues: ${r.issues.join('; ') || '(aucune)'}`}`);
};
sab('stade déplacé sur le club', (c) => { c.sites.stadium.at = [0, 0, 0]; }, 'overlap');
sab('trajet club→stade supprimé', (c) => { c.travels = c.travels.filter((t) => !(t.from === 'club' && t.to === 'stadium')); }, 'unreachable');
sab('pad de trajet déplacé dans le bâtiment', (c) => { c.travels[0].pos = [...c.sites.home.spawn]; }, 'inside the building');
sab('porte de terrasse de la loge supprimée', (c) => { delete c.sites.stadium.model.loge.door; }, 'no doorway from the loge');
sab('spawn stade hors de la loge', (c) => { c.sites.stadium.spawn[1] = 0; }, 'spawn not in the loge');
// gating transport par paliers
{
  const c3 = generateCareer({ level: 3, seed: 1 }), c1 = generateCareer({ level: 1, seed: 1 }), c4 = generateCareer({ level: 4, seed: 1 });
  const okg = !!c3.sites.gare && !c1.sites.gare && !!c4.sites.aeroport && !c3.sites.aeroport;
  (okg ? pass++ : fail++);
  console.log(`${okg ? '✓' : '✗'} paliers transport : gare dès le niveau 3, aéroport au niveau 4`);
}
sab('gare supprimée au niveau 3', (c) => { delete c.sites.gare; c.travels = c.travels.filter((t) => t.from !== 'gare' && t.to !== 'gare'); }, 'lacks its train station');

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);
