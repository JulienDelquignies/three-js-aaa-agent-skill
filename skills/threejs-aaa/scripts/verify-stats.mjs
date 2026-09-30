#!/usr/bin/env node
// verify-stats.mjs — LE MODULE DE STATS EST UN LECTEUR, ET IL COMPTE JUSTE (engine/stats.js, 30/09).
// Ce qu'on prouve : (1) il n'écrit rien dans le monde — l'empreinte du match est la même, stats branchées ou non ; (2) le score des stats
// est celui du match ; (3) les mi-temps s'additionnent au match entier (passes, tirs, buts) ; (4) chaque tir a une issue nommée, les
// cadrés sont au plus les tirs, les buts sont des tirs ; (5) chaque joueur de champ a une heatmap, des minutes, une distance ; (6) la note
// est bornée [3 ; 10] ; (7) les passes réussies sont au plus les passes, et courtes + moyennes + longues = passes.
import { makeMatch, matchCfg, matchStep } from '../assets/starter/src/engine/match-sim.js';
import { makeStats, statsStep, statsReport } from '../assets/starter/src/engine/stats.js';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log(`✓ ${m}`); } else { fail++; console.log(`✗ ${m}`); } };
const fnv = (s) => { let h = 0xcbf29ce484222325n; for (const c of s) { h ^= BigInt(c.charCodeAt(0)); h = (h * 0x100000001b3n) & 0xffffffffffffffffn; } return h.toString(16); };
const dump = (st) => JSON.stringify({ p: st.players.map((q) => [q.p[0].toFixed(4), q.p[2].toFixed(4), q.yaw.toFixed(3)]), b: st.ball.p.map((x) => x.toFixed(4)), s: st.score, e: st.events.length });
const jouer = (avec, DUR = 900) => { const st = makeMatch({ full: true, seed: 11 }), cfg = matchCfg({ chrono: { periodes: 2, duree: DUR / 2, pause: 5 } }), S = avec ? makeStats(st) : null;
  for (let i = 0; i < DUR * 60 * 1.3; i++) { matchStep(st, 1 / 60, cfg); if (S) statsStep(S, st); if (st.restart?.type === 'fin') break; }
  return { st, S }; };
const A = jouer(false), B = jouer(true);
ok(fnv(dump(A.st)) === fnv(dump(B.st)), `(1) lecture seule : l'empreinte est la même avec et sans stats (${fnv(dump(B.st))})`);
const { st, S } = B, R = statsReport(S, st), R1 = statsReport(S, st, { per: 1 }), R2 = statsReport(S, st, { per: 2 });
ok(R.score[0] === st.score[0] && R.score[1] === st.score[1], `(2) le score des stats ${R.score} = le score du match ${st.score}`);
const add = (k) => [0, 1].every((t) => R1.equipes[t][k] + R2.equipes[t][k] === R.equipes[t][k]);
ok(add('passes') && add('tirs') && add('buts') && add('fautes'), `(3) mi-temps 1 + 2 = match (passes ${R1.equipes[0].passes}+${R2.equipes[0].passes}=${R.equipes[0].passes}, tirs, buts, fautes)`);
const issues = new Set(['but', 'arrete', 'contre', 'cadre', 'hors-cadre', 'frole', 'autre']);
ok(R.tirs.every((t) => issues.has(t.issue)) && R.equipes.every((E) => E.cadres <= E.tirs && E.buts <= E.tirs + 1), `(4) ${R.tirs.length} tirs, chacun avec une issue nommée ; cadrés ≤ tirs, buts ≤ tirs (+ contre son camp)`);
const champ = R.joueurs.filter((j) => !j.keeper && j.minutes > 1);
ok(champ.length >= 20 && champ.every((j) => j.heat.reduce((a, b) => a + b, 0) > 0 && j.distance > 0), `(5) ${champ.length} joueurs de champ avec heatmap, minutes et distance`);
ok(R.joueurs.every((j) => j.note == null || (j.note >= 3 && j.note <= 10)), `(6) notes bornées [3 ; 10] (${R.joueurs.filter((j) => j.note != null).map((j) => j.note).sort((a, b) => b - a).slice(0, 3).join(', ')}…)`);
ok(R.equipes.every((E) => E.passesReussies <= E.passes && E.courtes + E.moyennes + E.longues === E.passes), `(7) passes réussies ≤ passes ; courtes + moyennes + longues = passes (${R.equipes[0].courtes}/${R.equipes[0].moyennes}/${R.equipes[0].longues})`);
console.log(`\n${pass} ✓ / ${fail} ✗`); process.exit(fail ? 1 : 0);
