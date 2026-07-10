#!/usr/bin/env node
// verify-circuit.mjs — the track day (engine/circuit.js): for levels × seeds the generated loop must
// pass checkCircuit (drivable bends, no self-crossing, paddock off track, grid on track), stay
// deterministic, and the LAP TIMER must fire exactly on a full lap driven around the centreline.
// Plus named sabotages: the contract must bite when the track data is hand-broken.
import { generateCircuit, checkCircuit, makeLapTimer } from '../assets/starter/src/engine/circuit.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };

for (const level of [1, 2, 3, 4]) {
  for (const seed of [1, 2, 5, 9]) {
    const c = generateCircuit({ level, seed });
    const r = checkCircuit(c);
    ok(`circuit niveau ${level} seed ${seed} drivable (Rmin=${r.minRadius.toFixed(0)} m, ${c.pts.length} pts)`, r.ok, r.issues[0] || '');
  }
}
ok('déterministe (même seed → même tracé)', JSON.stringify(generateCircuit({ level: 3, seed: 4 })) === JSON.stringify(generateCircuit({ level: 3, seed: 4 })));
ok('le seed change le tracé', JSON.stringify(generateCircuit({ level: 3, seed: 4 }).pts) !== JSON.stringify(generateCircuit({ level: 3, seed: 6 }).pts));

// the lap timer fires exactly once per full tour of the centreline (driven at 60 fps)
{
  const c = generateCircuit({ level: 2, seed: 3 });
  const timer = makeLapTimer(c);
  let laps = [];
  for (let tour = 0; tour < 2; tour++) {
    for (let i = 0; i <= c.pts.length; i++) {
      const p = c.pts[i % c.pts.length];
      const r = timer.update(0.15, p[0], p[1]);                    // realistic pace (~23 s per tour)
      if (r.lap) laps.push(r.lap);
    }
  }
  ok('chrono : 1 tour complet = 1 temps (pas de double détection)', laps.length === 1, `laps=${JSON.stringify(laps.map((l) => l.toFixed(1)))}`);
  ok('temps au tour plausible (> 15 s)', laps[0] > 15, `${laps[0]?.toFixed(1)} s`);
}

const sab = (name, mutate, expect) => {
  const c = generateCircuit({ level: 2, seed: 1 }); mutate(c);
  const r = checkCircuit(c); const hit = !r.ok && r.issues.some((i) => i.includes(expect));
  (hit ? pass++ : fail++);
  console.log(`${hit ? '✓' : '✗'} sabotage « ${name} » attrapé${hit ? '' : ` — issues: ${r.issues.join('; ') || '(aucune)'}`}`);
};
sab('épingle plus serrée que le braquage', (c) => {
  const i = (c.pts.length / 2) | 0, a = c.pts[i - 1], b = c.pts[i + 1];
  const tx = b[0] - a[0], tz = b[1] - a[1], l = Math.hypot(tx, tz);
  c.pts[i] = [c.pts[i][0] - (tz / l) * 2.5, c.pts[i][1] + (tx / l) * 2.5];   // kink ⟂ to the tangent
}, 'tighter than the car can turn');
sab('le tracé se croise (huit)', (c) => { const n = c.pts.length; for (let i = 0; i < n / 4; i++) c.pts[i] = [-c.pts[i][0], c.pts[i][1]]; }, 'crosses or pinches');
sab('paddock posé sur la piste', (c) => { c.paddock.spawn = [...c.pts[10]]; }, 'paddock sits on the track');
sab('grille de départ hors piste', (c) => { c.grid = [c.pts[0][0] + 60, c.pts[0][1] + 60]; }, 'grid is off the track');

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);
