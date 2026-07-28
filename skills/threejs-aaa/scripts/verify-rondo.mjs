#!/usr/bin/env node
// verify-rondo.mjs — the 5 v 5 possession game (engine/rondo.js + rondo-sim.js), played headless.
// The assertions are the things that make AI football look stupid when they are missing: the
// BEEHIVE (everyone on the ball), a defence that never wins it, an attack that never strings a
// pass, a compact blob instead of a shape, and passes played into covered lanes.
import { makeRondo, choosePass, strikingFoot, assignJobs, RONDO } from '../assets/starter/src/engine/rondo.js';
import { rondoStep, playRondo, checkRondo } from '../assets/starter/src/engine/rondo-sim.js';
import { laneClearance } from '../assets/starter/src/engine/ball-predict.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };

// ---------- a full game
const { st, trace } = playRondo(makeRondo({ perTeam: 5, seed: 7 }), 120);
const r = checkRondo(st, trace);
ok(`120 s de jeu : contrat complet — record ${r.stats.best} passes, ${r.stats.turnovers} pertes de balle`, r.ok, r.issues.join(' | '));
ok(`l'attaque ENCHAÎNE (record ${st.best} passes consécutives)`, st.best >= 4, `best=${st.best}`);
ok(`la défense RÉCUPÈRE (${st.turnovers} récupérations)`, st.turnovers >= 2);
ok(`pas d'essaim (pic ${r.stats.swarm} défenseurs, mais seulement ${r.stats.crowdPct}% du temps)`, r.stats.crowdPct <= 25);
// le seuil suit la TAILLE DU CARRÉ, comme dans le contrat : 5 m absolus n'avaient de sens que pour
// l'ancien carré de 34 x 26, et c'est ce genre de seuil figé qui empêchait de le resserrer
{
  const seuil = RONDO.spreadFrac * Math.min(...RONDO.area);
  ok(`le bloc en possession reste ÉCARTÉ (${r.stats.spread} m ≥ ${seuil.toFixed(1)}, à l'échelle du carré)`, r.stats.spread >= seuil);
}

// ---------- LE PORTEUR S'ÉCHAPPE (la clause que les compteurs d'essaim ne voient pas)
ok(`le porteur n'est pas collé en permanence (${r.stats.harried}% du temps de conduite ≤ ${(RONDO.harriedMax * 100).toFixed(0)}%)`, r.stats.harried <= RONDO.harriedMax * 100);
{
  // UN SEUL défenseur collé au porteur : aucune clause d'essaim ne bronche (un homme n'est pas une
  // foule) et pourtant c'est exactement ce qui se lit comme une fourmilière. C'est la raison d'être
  // de la clause : elle attrape ce que les compteurs manquent.
  const t2 = JSON.parse(JSON.stringify(trace));
  for (const s2 of t2) {
    if (s2.phase !== 'carry') continue;
    const d = s2.players.find((p) => p.team !== s2.team);
    if (d) d.p = [s2.ball[0] + 0.3, s2.ball[2]];
  }
  const c = checkRondo(st, t2);
  ok('sabotage « un défenseur collé au porteur » attrapé', !c.ok && c.issues.some((i) => i.includes('collé')), c.issues[0] || 'RIEN');
  const crowd = c.issues.filter((i) => i.includes('ESSAIM'));
  ok('  …et AUCUNE clause d\'essaim ne le voit (un homme n\'est pas une foule)', crowd.length === 0, crowd[0] || '');
}
{
  // l'inertie : sans elle un défenseur lancé fait demi-tour comme un joueur à l'arrêt, et l'esquive
  // ne peut pas payer. Mesuré : séparation 1,67 → 2,33 m, essaim 1,28 → 0,70 défenseur.
  const iso = playRondo(makeRondo({ perTeam: 5, seed: 4 }), 60, { cfg: { ...RONDO, turnAccel: RONDO.accel } });
  const mom = playRondo(makeRondo({ perTeam: 5, seed: 4 }), 60);
  const sep = (g) => {
    const c = g.trace.filter((s2) => s2.phase === 'carry');
    return c.reduce((a, s2) => a + Math.min(...s2.players.filter((p) => p.team !== s2.team)
      .map((p) => Math.hypot(p.p[0] - s2.ball[0], p.p[1] - s2.ball[2]))), 0) / c.length;
  };
  ok(`l'inertie fait gagner de la séparation au porteur (${sep(iso).toFixed(2)} m → ${sep(mom).toFixed(2)} m)`, sep(mom) > sep(iso) * 1.15);
  ok(`  le taux de virage est bien borné par la vitesse (turnAccel ${RONDO.turnAccel} < accel ${RONDO.accel})`, RONDO.turnAccel < RONDO.accel);
}

// ---------- possession really changes hands, both ways
{
  const byTeam = trace.reduce((a, s) => { a[s.team] = (a[s.team] || 0) + 1; return a; }, {});
  const share = Math.min(byTeam[0] || 0, byTeam[1] || 0) / trace.length;
  ok(`les deux équipes jouent (partage ${(share * 100).toFixed(0)}% pour la moins servie)`, share > 0.08);
  const kinds = new Set(st.events.filter((e) => e.type === 'turnover').map((e) => e.why));
  ok(`récupérations variées (${[...kinds].join(', ')})`, kinds.size >= 1);
}
// ---------- every pass was played into a lane that was OPEN at the moment of the pass
{
  const g = playRondo(makeRondo({ perTeam: 5, seed: 3 }), 90);
  const passes = g.st.events.filter((e) => e.type === 'pass');
  const ground = passes.filter((e) => e.style === 'ground');
  const bad = ground.filter((e) => e.margin < RONDO.corridor);
  ok(`${passes.length} passes jouées, dont ${bad.length} au sol dans un couloir bouché`, passes.length > 10 && bad.length === 0,
    bad.length ? `marges fautives : ${bad.slice(0, 3).map((e) => e.margin).join(', ')}` : '');
  const lofted = passes.filter((e) => e.style === 'lofted' || e.style === 'chip');
  ok(`le lob est réservé aux couloirs fermés (${lofted.length} ballons aériens)`, lofted.every((e) => e.margin < RONDO.corridor * 1.6));
}
// ---------- the correct foot is chosen
{
  ok('pied droit pour une cible à droite', strikingFoot(0, [0, 0, 0], [5, 0, 5]) === 'right');
  ok('pied gauche pour une cible à gauche', strikingFoot(0, [0, 0, 0], [5, 0, -5]) === 'left');
  const feet = new Set(st.events.filter((e) => e.type === 'pass').map((e) => e.foot));
  ok(`les deux pieds servent en match (${[...feet].join('/')})`, feet.size === 2);
}
// ---------- jobs are differentiated (the anti-beehive layer really assigns roles)
{
  const s3 = makeRondo({ perTeam: 5, seed: 11 });
  for (let i = 0; i < 200; i++) rondoStep(s3, 1 / 60);
  assignJobs(s3);
  const def = s3.players.filter((p) => p.team !== s3.possession.team).map((p) => p.job);
  const atk = s3.players.filter((p) => p.team === s3.possession.team).map((p) => p.job);
  ok(`défense structurée : ${def.join(', ')}`, def.includes('press') && (def.includes('cover') || def.includes('intercept')) && def.includes('mark'));
  ok(`attaque structurée : ${atk.join(', ')}`, atk.filter((j) => j === 'support').length >= 3);
}
// ---------- determinism and stability across seeds
{
  const a = playRondo(makeRondo({ seed: 5 }), 20).st;
  const b = playRondo(makeRondo({ seed: 5 }), 20).st;
  ok('déterministe (même graine → même partie)', a.best === b.best && a.turnovers === b.turnovers && a.events.length === b.events.length);
  let allOk = true; const per = [];
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const g = playRondo(makeRondo({ seed }), 60);
    const c = checkRondo(g.st, g.trace);
    per.push(`${seed}:${g.st.best}p/${g.st.turnovers}t`);
    if (!c.ok) { allOk = false; console.log(`   graine ${seed} : ${c.issues.join(' | ')}`); }
  }
  ok(`6 graines, 60 s chacune, toutes sous contrat (${per.join(' ')})`, allOk);
}
// ---------- sabotages of the contract
{
  const sab = (name, mutate, needle) => {
    const t2 = JSON.parse(JSON.stringify(trace)); mutate(t2);
    const c = checkRondo(st, t2);
    ok(`sabotage « ${name} » attrapé`, !c.ok && c.issues.some((i) => i.includes(needle)), c.issues[0] || 'RIEN');
  };
  sab('essaim de défenseurs sur le ballon', (t) => {
    for (const s of t) for (const p of s.players) if (p.team !== s.team) { p.p = [s.ball[0], s.ball[2]]; }
  }, 'ESSAIM');
  sab('bloc massé', (t) => { for (const s of t) for (const p of s.players) p.p = [0, 0]; }, 'compact');
  sab('joueur qui téléporte', (t) => { t[10].players[0].speed = 40; }, 'm/s');
  sab('ballon hors du carré', (t) => { t[10].ball = [90, 0.11, 0]; }, 'hors du carré');
}

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
