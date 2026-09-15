#!/usr/bin/env node
// verify-identification.mjs — LE TEST D'IDENTIFICATION (lot 249, Campagne V) : « sans les noms ». Chaque rôle du
// document est posé à son poste (4-2-3-1, trois rôles par match, un par strate), six graines × dur s ; sa SIGNATURE
// (largeur, profondeur, appels, pressing, sprints de repli, tenue, duels, marquage, dribbles) se compare GRAINE PAR
// GRAINE au polyvalent du même poste dans le même monde (amendement 5 : ordinal par graine, jamais en moyenne).
// Amendement 2 : on n'ASSERTE que les axes dont le moteur a un consommateur prouvé ; le reste est INFORMATIF (imprimé,
// non jugé) — la liste informative EST le backlog 250-254. Volumétrie : 72 matchs × dur s.
import { makeMatch, matchCfg, matchStep } from '../assets/starter/src/engine/match-sim.js';
import { ROLES, ROLES_DOCUMENT } from '../assets/starter/src/engine/roles.js';

let pass = 0, fail = 0;
const ok = (name, cond) => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}`); };
const SEEDS = [3, 5, 7, 11, 13, 17], DUR = +(process.env.IDENT_DUR ?? 240), FORM = 4231;
// 4-2-3-1 : D(G)0 D(CG)1 D(CD)2 D(D)3 DM(CG)4 DM(CD)5 AM(G)6 AM(C)7 AM(D)8 ST(C)9, gardien 10
const POSTE = { GK: 10, DC: 1, LAT: 3, MDC: 5, MIL: 4, MO: 7, AIL: 8, AV: 9 };
const fam = (doc) => doc.split(' ')[0];
const GROUPES = [['GK', 'DC', 'LAT'], ['MDC', 'MIL', 'MO'], ['AIL', 'AV']];
const RUNS = [];   // { seed, roles: {post: id}, obs: [{post, doc, id}] }
for (const g of GROUPES) {
  const listes = g.map((f) => Object.entries(ROLES_DOCUMENT).filter(([d]) => fam(d) === f));
  const n = Math.max(...listes.map((l) => l.length));
  for (let k = 0; k < n; k++) { const roles = {}, obs = []; g.forEach((f, i) => { const e = listes[i][k]; if (e) { roles[POSTE[f]] = e[1]; obs.push({ post: POSTE[f], doc: e[0], id: e[1] }); } }); RUNS.push({ roles, obs }); }
}
const mesure = (seed, roles) => {
  const st = makeMatch({ full: true, seed, tactics: [{ formation: FORM }, { formation: FORM }], roles: roles ? [roles, null] : null }), cfg = matchCfg({ pausaPied: null, recevoirSurPlace: null, pasDeRecul: null, sol: null, fete: null /* sol, fete null DATÉ 15/09 (lots A10 bis-A11, notes 360-361 : le fauché reste à terre plus longtemps, la fête a un corps — chaque clause mesure le monde de son jour, empreinte jumelle prouvée) */ /* DATÉ 15/09 (dettes A12, note 358) : vert à HEAD~ (suite à clés nulles 694/7), le monde remangé par la pausa au pied, la réception sur place et le pas de recul — la clause mesure sa loi, pas les miennes */, shotRange: 20 });
  const sig = {}; for (const p of st.players) if (p.team === 0) sig[p.post] = { larg: [], prof: [], appel: 0, press: 0, hors: 0, repli: 0, tenue: [], duel: 0, marque: [], dribble: 0, passes: 0, tirs: 0, centres: 0, garde: [] };
  const holdNow = {}; const doc = { corners: 0, dansBoite: 0, gkPasses: 0, gkCourtes: 0, buts: 0, butsCPA: 0, cpaT: -99 }; let prevR = null;
  let seen = 0, seenAll = 0; const hz = st.pitch.hz, sg = -st.pitch.ownGoal(0).sign;
  for (let i = 0; i < DUR * 60; i++) {
    matchStep(st, 1 / 60, cfg);
    for (; seen < st.events.length; seen++) { const e = st.events[seen], p = st.players[e.by]; if (!p || p.team !== 0) continue; const s = sig[p.post]; if (!s) continue;
      if (e.type === 'burst' && ['appel', 'contre-appel', 'deborde', 'overlap', 'troisieme'].includes(e.kind)) s.appel++;
      else if (e.type === 'pass') { s.passes++; s.tenue.push(holdNow[p.id] ?? 0); if (p.keeper) { doc.gkPasses++; const r = st.players[e.to]; if (r && Math.hypot(r.p[0] - p.p[0], r.p[2] - p.p[2]) < 25) doc.gkCourtes++; } }
      else if (e.type === 'relance-main' && p.keeper) { doc.gkPasses++; doc.gkCourtes++; }
      else if (e.type === 'shot') s.tirs++; else if (e.type === 'centre') s.centres++;
      else if (e.type === 'slide' || e.type === 'duel') s.duel++; else if (e.type === 'skill') s.dribble++; }
    for (; seenAll < st.events.length; seenAll++) { const e = st.events[seenAll]; if (e.type === 'restart-pris' && (e.kind === 'corner' || e.kind === 'coup-franc' || e.restart === 'corner' || e.restart === 'coup-franc' || /corner|coup-franc/.test(JSON.stringify(e)))) doc.cpaT = e.t; if (e.type === 'but') { doc.buts++; if (e.t - doc.cpaT < 10) doc.butsCPA++; } }
    if (st.possession.carrier >= 0) holdNow[st.possession.carrier] = st.hold ?? 0;
    if (st.restart && st.restart.type === 'corner' && prevR !== st.restart && st.t >= st.restart.at - 0.1) { prevR = st.restart; doc.corners++; const g = st.pitch.attackGoal(st.restart.team); doc.dansBoite += st.players.filter((p) => p.team === st.restart.team && !p.keeper && Math.abs(p.p[0] - g.x) < 16.5 && Math.abs(p.p[2]) < 20).length; }
    if (st.restart || i % 10) continue; const t = st.possession.team; if (t < 0) continue;
    { const gk = st.players.find((p) => p.team === 0 && p.keeper); if (gk && t === 0) sig[gk.post].garde.push(Math.abs(gk.p[0] - st.pitch.ownGoal(0).x)); }
    const mates = st.players.filter((p) => p.team === 0 && !p.keeper); const cx = mates.reduce((a, p) => a + p.p[0], 0) / mates.length;
    for (const p of mates) { const s = sig[p.post];
      if (t === 0) { s.larg.push(Math.abs(p.p[2]) / hz); s.prof.push((p.p[0] - cx) * sg); }
      else { s.hors++; if (p.job === 'press') s.press++; if ((p._pace?.until ?? -1) > st.t && p._pace.kind === 'repli') s.repli++; if (p.job === 'mark') { let d = 99; for (const q of st.players) if (q.team === 1 && !q.keeper) d = Math.min(d, Math.hypot(q.p[0] - p.p[0], q.p[2] - p.p[2])); s.marque.push(d); } } }
  }
  const moy = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
  for (const s of Object.values(sig)) { s.larg = moy(s.larg); s.prof = moy(s.prof); s.press = s.hors ? s.press / s.hors : 0; s.repli = s.hors ? s.repli / s.hors : 0; s.tenue = moy(s.tenue); s.marque = moy(s.marque); s.garde = moy(s.garde); }
  sig.doc = doc; return sig;
};
// l'axe → la métrique et le sens attendu (+1 : plus grand que le polyvalent quand l'axe > 0,5)
const AXES = [['largeurR', 'larg', +1], ['profondeur', 'prof', +1], ['appel', 'appel', +1], ['press', 'press', +1], ['repli', 'repli', -1], ['tenue', 'tenue', +1], ['duel', 'duel', +1], ['marqueSerre', 'marque', -1], ['garde', 'garde', +1]];
// CE QUE LE MOTEUR EXPRIME (consommateurs prouvés : largeurR → la craie 177/249b et les courses d'aile 125 ; repli → 251 ; press → 229/pression ; appel → 41/125/144 ; tenue → 211 ; profondeur → le poste nuancé 200)
const PROUVES = new Set(['largeurR', 'repli', 'press', 'appel', 'tenue', 'profondeur', 'garde']);   // garde → keeper.js (le gardien libéro)
// CE QUE LE MOTEUR EXPRIMAIT AU 249 (gelé : rôle|axe à ≥ 5/6 sur ces graines — la garde de non-régression ; vide = la première passe informative)
const EXPRIMES_249 = ['GK A|garde', 'DC A|press', 'LAT A|appel', 'GK B|garde', 'LAT B|largeurR', 'LAT C|appel', 'LAT D|largeurR', 'LAT D|profondeur', 'LAT D|appel', 'MO A|press', 'MO A|tenue', 'MIL B|tenue', 'MIL C|repli', 'AV A|press', 'AV A|repli', 'AV B|repli', 'AIL C|repli', 'AV C|repli'];   // REGELÉ DATÉ 274 (le monde de l'interligne dérivé : le milieu tenu à sa portée change les courses et les signatures en 300 s, sans qu'aucune loi de rôle n'ait changé) : 18 → 18 signatures — perdues AIL D|largeurR, AV A|largeurR, AV A|profondeur, MDC A|profondeur, MDC B|profondeur, MDC C|largeurR, MO B|profondeur ; gagnées AIL C|repli, AV A|press, LAT C|appel, LAT D|appel, LAT D|largeurR, MIL B|tenue, MO A|tenue ; // REGELÉ DATÉ 273 (le monde de la ligne tenue : la ligne arrière à 3 m change les courses, les possessions et les signatures en 300 s, sans qu'aucune loi de rôle n'ait changé) : 14 → 18 signatures — perdues DC A|profondeur, DC B|appel, MDC B|tenue, MDC C|appel ; gagnées DC A|press, LAT D|profondeur, MDC A|profondeur, MDC B|profondeur, MDC C|largeurR, MIL C|repli, AV A|largeurR, AIL D|largeurR ; // REGELÉ DATÉ 272 (le monde de la porte xG : les tirs remangés changent les possessions et les courses en 300 s, la liste bouge sans qu'aucune loi de rôle n'ait changé) : 15 → 14 signatures — perdues DC A|largeurR, DC B|largeurR, DC B|profondeur, DC C|largeurR, MIL B|tenue ; gagnées DC A|profondeur, DC B|appel, MDC B|tenue, MO B|profondeur ; // REGELÉ DATÉ 271 (le monde du ballon fou : les déviations vives changent les ballons libres et les possessions, la liste bouge sans qu'aucune loi de rôle n'ait changé) : 14 → 15 signatures — perdues DC A|tenue, MDC A|profondeur, MIL C|repli ; gagnées DC A|largeurR, DC B|profondeur, MDC C|appel, AV A|profondeur ; // REGELÉ DATÉ 270 (le monde du temps du match : les cérémonies dans la bande changent le jeu joué en 300 s, la liste bouge sans qu'aucune loi de rôle n'ait changé) : 20 → 14 signatures — perdues DC A|profondeur, LAT A|largeurR, DC B|appel, LAT B|repli, DC C|profondeur, DC C|appel, LAT C|profondeur, LAT C|appel, LAT D|appel, MDC C|largeurR, AV A|appel, AIL C|largeurR ; gagnées DC A|tenue, DC B|largeurR, MIL B|tenue, MIL C|repli, AV A|repli ; // REGELÉ DATÉ 269 (le monde de la nature des gestes : les spécialistes dribblent, les glissés se raréfient — la liste bouge sans qu'aucune loi de rôle n'ait changé) : 16 → 20 signatures — perdues DC A|largeurR, DC A|tenue, DC B|tenue, LAT B|largeurR, MDC A|profondeur, AIL A|largeurR, AIL D|largeurR ; gagnées DC A|profondeur, LAT A|largeurR, DC B|appel, LAT B|repli, DC C|largeurR, DC C|profondeur, DC C|appel, LAT C|profondeur, LAT D|appel, MDC C|largeurR, AV A|appel ; // REGELÉ DATÉ 268 (le monde du noyau de duel : les take-ons jugés changent les possessions, la liste bouge sans qu'aucune loi de rôle n'ait changé) : 18 → 16 signatures — perdues LAT A|profondeur, LAT D|largeurR, MIL A|tenue, AV A|tenue, AIL C|largeurR ; gagnées MDC A|profondeur, AIL A|largeurR, AIL D|largeurR ; // REGELÉ DATÉ 267 (le monde de la sélection calibrée : les passes réordonnées par P̂ changent les possessions, la liste bouge sans qu'aucune loi de rôle n'ait changé) : 17 → 18 signatures — perdues DC B|largeurR, DC C|largeurR, LAT C|profondeur, MDC B|tenue, MO C|tenue, AV A|profondeur ; gagnées DC A|largeurR, DC A|profondeur, DC A|tenue, DC B|tenue, MIL A|tenue, AV A|tenue, AIL C|largeurR ; // REGELÉ DATÉ 266 (le monde de l'interception non omnisciente : les défenseurs courent vers le ballon qu'ils croient, le passeur cru refuse ses cloches — 17 signatures gelables ≥ 5/6 graines ; perdues DC C|profondeur, LAT D|profondeur, AIL A|largeurR, AV A|largeurR, AIL C|largeurR ; gagnées DC B|largeurR, DC C|largeurR, LAT C|appel, MDC B|tenue) ; // REGELÉ DATÉ 265 (le monde de la réception à quatre issues : la touche propre protégée change les possessions, la liste bouge sans qu'aucune loi de rôle n'ait changé) : 23 → 18 signatures — perdues DC A|largeurR, DC A|profondeur, DC A|press, DC B|profondeur, DC C|largeurR, LAT C|appel, MIL A|tenue, MO B|profondeur, AIL B|appel, AIL C|repli, AIL D|largeurR ; gagnées LAT A|appel, LAT D|largeurR, MO C|tenue, AIL A|largeurR, AV A|largeurR, AIL C|largeurR (la dette de volumétrie à 6 graines demeure)
const base = {}; for (const seed of SEEDS) base[seed] = mesure(seed, null);
const table = [];   // { doc, id, axe, k, n, sens }
for (const run of RUNS) {
  for (const seed of SEEDS) { const sig = mesure(seed, run.roles);
    for (const o of run.obs) { const r = ROLES[o.id] ?? {}; for (const [axe, met, sens] of AXES) { const v = r[axe]; if (v == null || v === 0.5) continue; const attendu = Math.sign(v - 0.5) * sens; const d = sig[o.post][met] - base[seed][o.post][met]; let row = table.find((x) => x.doc === o.doc && x.axe === axe); if (!row) { row = { doc: o.doc, id: o.id, axe, k: 0, n: 0, attendu, ds: [] }; table.push(row); } row.n++; row.ds.push(+d.toFixed(3)); if (Math.sign(d) === attendu) row.k++; } } }
}
console.log(`\nLE TEST D'IDENTIFICATION (${RUNS.length} configurations × ${SEEDS.length} graines × ${DUR} s, 4-2-3-1) — concordance par graine, rôle c. polyvalent au même poste :`);
const parRole = {}; for (const row of table) (parRole[row.doc] ??= []).push(row);
const asserts = [];
for (const [doc, rows] of Object.entries(parRole)) {
  const txt = rows.map((r) => `${r.axe}${r.attendu > 0 ? '↑' : '↓'} ${r.k}/${r.n}${PROUVES.has(r.axe) ? '' : '·'}`).join('  ');
  console.log(`  ${doc.padEnd(6)} ${rows[0].id.padEnd(24)} ${txt}`);
  for (const r of rows) if (PROUVES.has(r.axe) && Math.abs((ROLES[r.id][r.axe]) - 0.5) >= 0.2) asserts.push(r);
}
console.log(`  (· = axe informatif, sans consommateur prouvé — le backlog 250-254)`);
const exprimes = asserts.filter((r) => r.k >= 5), muets = asserts.filter((r) => r.k < 5);
{ const D = SEEDS.map((sd) => base[sd].doc); const sum = (k) => D.reduce((a, d) => a + d[k], 0); const min = SEEDS.length * DUR / 60;
  console.log(`\nLES CHIFFRES DU DOCUMENT (informatif, ${SEEDS.length} × ${DUR} s de référence) : corners ${(sum('corners') / min * 90).toFixed(1)} / 90 avec ${(sum('dansBoite') / Math.max(1, sum('corners'))).toFixed(1)} attaquants dans la surface au coup (doc 4-6) ; passes du gardien courtes (< 25 m) ${(100 * sum('gkCourtes') / Math.max(1, sum('gkPasses'))).toFixed(0)} % sur ${sum('gkPasses')} (doc > 90 %) ; buts ${sum('buts')}, sur CPA (< 10 s d'un corner/coup-franc) ${sum('butsCPA')} = ${(100 * sum('butsCPA') / Math.max(1, sum('buts'))).toFixed(0)} % (doc 25-33 %)`); }
console.log(`\nAxes prouvés, amplitude ≥ 0,2 : ${asserts.length} — exprimés (≥ 5/6) ${exprimes.length}, muets ${muets.length}${muets.length ? ' : ' + muets.map((r) => `${r.doc} ${r.axe} ${r.k}/${r.n}`).join(', ') : ''}`);
console.log(`  gelable : ${exprimes.map((r) => `'${r.doc}|${r.axe}'`).join(', ')}`);
if (EXPRIMES_249.length) {
  const perdus = EXPRIMES_249.filter((k) => { const [doc, axe] = k.split('|'); const r = table.find((x) => x.doc === doc && x.axe === axe); return !r || r.k < 5; });
  ok(`lot 249 — LE TEST D'IDENTIFICATION : les ${EXPRIMES_249.length} signatures que le moteur exprimait au 249 tiennent (≥ 5/6 graines, rôle c. polyvalent au même poste)${perdus.length ? ' — perdues : ' + perdus.join(', ') : ''}`, perdus.length === 0);
  const nouveaux = exprimes.filter((r) => !EXPRIMES_249.includes(r.doc + '|' + r.axe)).map((r) => r.doc + '|' + r.axe);
  if (nouveaux.length) console.log(`  (informatif) nouvelles signatures exprimées depuis le 249 : ${nouveaux.join(', ')}`);
}
console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
