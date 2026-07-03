#!/usr/bin/env node
// verify-city.mjs — no-regression harness for the derived CITY layer (engine/city.js). For every club
// level × seed: checkCity() must hold — curb stops on a street, a route exists for EVERY travel pair
// (entirely on streets, joining the stops), streets never cross a site footprint, buildings never sit
// on a street or a site, the street graph connects every stop, the city isn't empty. Plus determinism
// and named sabotages (the contract must bite when the city data is hand-broken).
import { generateCareer } from '../assets/starter/src/engine/career.js';
import { generateCity, checkCity } from '../assets/starter/src/engine/city.js';

const N = Number(process.argv[process.argv.indexOf('--seeds') + 1]) || 6;
let pass = 0, fail = 0;
for (let level = 1; level <= 4; level++) {
  let ok = true; const msgs = []; let nb = 0;
  for (let seed = 1; seed <= N; seed++) {
    const career = generateCareer({ level, seed });
    const city = generateCity({ career, seed });
    nb = city.buildings.length;
    const r = checkCity(city, career);
    if (!r.ok) { ok = false; msgs.push(`seed ${seed}: ${r.issues[0]}`); }
  }
  const c1 = generateCareer({ level, seed: 3 });
  if (JSON.stringify(generateCity({ career: c1, seed: 3 })) !== JSON.stringify(generateCity({ career: generateCareer({ level, seed: 3 }), seed: 3 }))) { ok = false; msgs.push('non-deterministic'); }
  (ok ? pass++ : fail++);
  console.log(`${ok ? '✓' : '✗'} ville niveau ${level} (${N} seeds, ~${nb} immeubles)${msgs.length ? ' — ' + msgs[0] : ''}`);
}

// densité croissante avec le niveau (bourg → métropole)
{
  const nb = (lvl) => generateCity({ career: generateCareer({ level: lvl, seed: 2 }), seed: 2 }).buildings.length;
  const okd = nb(1) < nb(2) && nb(2) < nb(4);
  (okd ? pass++ : fail++);
  console.log(`${okd ? '✓' : '✗'} densité croissante avec le niveau (${nb(1)} → ${nb(2)} → ${nb(4)} immeubles)`);
}

// sabotages — hand-break the city, the contract must catch it by name
const sab = (name, mutate, expect) => {
  const career = generateCareer({ level: 3, seed: 1 });
  const city = generateCity({ career, seed: 1 }); mutate(city, career);
  const r = checkCity(city, career); const hit = !r.ok && r.issues.some((i) => i.includes(expect));
  (hit ? pass++ : fail++);
  console.log(`${hit ? '✓' : '✗'} sabotage « ${name} » attrapé${hit ? '' : ` — issues: ${r.issues.join('; ') || '(aucune)'}`}`);
};
sab('arrêt déplacé hors de la rue (dans le club)', (c) => { const r = c.rects.club; c.stops.club.pos = [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2]; }, 'off the road');
sab('itinéraire club→stade supprimé', (c) => { c.paths['club->stadium'] = null; }, 'no route');
sab('itinéraire dévié hors des rues', (c) => { const p = c.paths['club->home']; p[1] = [p[1][0] + 50, p[1][1] + 50]; }, 'leaves the road');
sab('immeuble posé sur la rue', (c) => { const cell = c.road.findIndex((v) => v); c.buildings[0].x = c.bounds[0] + ((cell % c.nx) + 0.5) * c.cell; c.buildings[0].z = c.bounds[1] + ((((cell / c.nx) | 0)) + 0.5) * c.cell; }, 'building sits on a street');
sab('rue coupée (le graphe se déconnecte)', (c) => {
  // wall off the stadium stop: clear every road cell in the band 2 cells above it
  const [si, sj] = c.stops.stadium.cell;
  for (let i = 0; i < c.nx; i++) for (let dj = 1; dj <= 3; dj++) if (sj - dj >= 0) c.road[(sj - dj) * c.nx + i] = 0;
}, 'unreachable by street');

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);
