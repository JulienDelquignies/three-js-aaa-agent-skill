#!/usr/bin/env node
// verify-furnish.mjs — no-regression harness for rule-based furnishing. For every generated place
// (type × tier × seeds), furnishPlace() must produce items that pass checkFurnishing(): inside their
// room, no overlaps, no door/stair clearance blocked, facing constraints hold (chair→desk, tv→sofa).
// Also asserts recipes actually produce furniture (rooms aren't left empty) + determinism.
import { generatePlace } from '../assets/starter/src/engine/floorplan.js';
import { furnishPlace, checkFurnishing } from '../assets/starter/src/engine/furnish.js';

const N = Number(process.argv[process.argv.indexOf('--seeds') + 1]) || 20;
let pass = 0, fail = 0; const failures = [];
for (const type of ['club', 'home', 'restaurant']) for (let tier = 1; tier <= 5; tier++) {
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
function model_min(type, tier) { return type === 'club' ? 4 + tier : type === 'restaurant' ? 6 : 3; }

// salle de presse : clubs t2+ — pupitre + fond sponsors + rangées face au pupitre, et le contrat mord
{
  const model = generatePlace({ type: 'club', tier: 3, seed: 2 });
  const items = furnishPlace(model);
  const desk = items.find((i) => i.kind === 'press-desk');
  const okp = !!desk && items.some((i) => i.kind === 'press-wall') && items.filter((i) => i.faces === desk?.id && i.kind === 'chair').length >= 2;
  (okp ? pass++ : fail++);
  console.log(`${okp ? '✓' : '✗'} salle de presse équipée (pupitre + fond sponsors + rangées face au pupitre)`);
  const sab = (name, mutate, expect) => {
    const m = generatePlace({ type: 'club', tier: 3, seed: 2 });
    const its = furnishPlace(m); mutate(its);
    const r = checkFurnishing(m, its); const hit = !r.ok && r.issues.some((i) => i.includes(expect));
    (hit ? pass++ : fail++);
    console.log(`${hit ? '✓' : '✗'} sabotage « ${name} » attrapé${hit ? '' : ` — issues: ${r.issues.join('; ') || '(aucune)'}`}`);
  };
  // cafétéria + cuisines et espace kiné : présents et équipés dans les clubs t2+
  const kine = items.filter((i) => i.room === 'salle-kine');
  const okk = kine.filter((i) => i.kind === 'massage-table').length >= 2 && kine.some((i) => i.kind === 'sink');
  (okk ? pass++ : fail++);
  console.log(`${okk ? '✓' : '✗'} espace kiné équipé (≥2 tables de massage + lavabo)`);
  const okc = items.some((i) => i.room === 'cafeteria' && i.kind === 'table') && items.some((i) => i.room === 'cuisine-cafet' && i.kind === 'counter') && items.some((i) => i.room === 'cuisine-cafet' && i.kind === 'fridge');
  (okc ? pass++ : fail++);
  console.log(`${okc ? '✓' : '✗'} cafétéria (tables) + cuisines attenantes (plans de travail, frigo)`);
  sab('chaise de presse tournée dos au pupitre', (its) => { const c = its.find((i) => i.kind === 'chair' && i.faces); c.yaw += Math.PI; }, 'does not face');
  sab('fond sponsors déplacé DEVANT le pupitre', (its) => { const w = its.find((i) => i.kind === 'press-wall'); const d = its.find((i) => i.kind === 'press-desk'); w.x = d.x + Math.sin(d.yaw) * 0.8; w.z = d.z + Math.cos(d.yaw) * 0.8; }, 'in FRONT of the podium');
  sab('fond sponsors supprimé', (its) => { its.splice(its.findIndex((i) => i.kind === 'press-wall'), 1); }, 'no sponsor backdrop');
}

// salon privé du restaurant : la table de rencontre (2 places face à face) + sabotages
{
  const m = generatePlace({ type: 'restaurant', tier: 3, seed: 2 });
  const items = furnishPlace(m);
  const sp = items.filter((i) => i.room === 'salon-prive');
  const okm = sp.some((i) => i.kind === 'table') && sp.filter((i) => i.kind === 'chair').length >= 2;
  (okm ? pass++ : fail++);
  console.log(`${okm ? '✓' : '✗'} salon privé équipé (table de rencontre + 2 places face à face)`);
  const sab2 = (name, mutate, expect) => {
    const mm = generatePlace({ type: 'restaurant', tier: 3, seed: 2 });
    const its = furnishPlace(mm); mutate(its);
    const r = checkFurnishing(mm, its); const hit = !r.ok && r.issues.some((i) => i.includes(expect));
    (hit ? pass++ : fail++);
    console.log(`${hit ? '✓' : '✗'} sabotage « ${name} » attrapé${hit ? '' : ` — issues: ${r.issues.join('; ') || '(aucune)'}`}`);
  };
  sab2('une place du salon privé supprimée', (its) => { its.splice(its.findIndex((i) => i.room === 'salon-prive' && i.kind === 'chair'), 1); }, 'lacks 2 seats facing each other');
  sab2('table du salon privé supprimée', (its) => { its.splice(its.findIndex((i) => i.room === 'salon-prive' && i.kind === 'table'), 1); }, 'no meeting table');
}

if (failures.length) console.log('\n' + failures.join('\n'));
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}: ${pass}/${pass + fail} green (15 programs × ${N} seeds + presse + rencontre)`);
process.exit(fail === 0 ? 0 : 1);
