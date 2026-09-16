// verify-signes.mjs — LES DETTES DU LOT A12 (les signes visibles du rôle, reference/58) : trois lois sous clé, chacune
// null = hier au bit. (a) LA PAUSA AU PIED (cfg.pausaPied) : le porteur qui tient (253) ne reste plus planté à 1,6-2 m
// d'un ballon qui a filé — il va le rechercher puis le tient. (b) LA RÉCEPTION SUR PLACE (cfg.recevoirSurPlace) : le
// receveur d'une passe dans les pieds, sans presseur, attend au lieu de faire le pas au-devant (mesuré avant : 0 % des
// images de vol sous 0,6 m/s). (c) LE PAS DE RECUL DU RENARD (cfg.pasDeRecul) : au départ du centre, le corps de boîte
// à fort appel marqué de près se décale hors de l'angle mort de son marqueur. (d) le jumeau : les trois clés à null
// rendent le monde du 14/09 au bit (empreintes datées, 3 graines × 60 s). Tolérances [CONVENTION] — le document ne
// chiffre pas ces signes ; les seuils sont ceux des sondes (NOTES 358).
import { createHash } from 'node:crypto';
import { makeMatch, matchCfg, matchStep } from '../assets/starter/src/engine/match-sim.js';

let pass = 0, fail = 0;
const ok = (cond, label) => { if (cond) { pass++; console.log(`✓ ${label}`); } else { fail++; console.log(`✗ ${label}`); } };
const RP_1609 = { elan: { recul: 3.5, lat: 1.5, vitesse: 4, patience: 4 }, volee: { h: 1, avance: 0.45, lacher: 0.72 }, touche: { recul: 0.25 } };   // remisesPied d'HIER (e81394e) — DATÉ 16/09 (lot A9 ter, note 368 : sortie de but longue, touche longue, mur qui saute sous remisesPied.elan.sortieBut / toucheLongue / mur) : matchCfg REMPLACE les objets imbriqués, on repasse l'objet entier d'hier ; l'empreinte jumelle a prouvé sous-clés absentes = hier au bit
const SOL_1609 = { tenue: 0.9, corps: 0.9 };   // sol d'HIER sans aide — DATÉ 16/09 (relevé aidé, note 369 : sol.aide)
const TETE_1609 = { min: 1.5, max: 2.2, reach: 1.0, but: 12, saut: 0.75, duel: 1.9 };   // tete d'HIER sans armee — DATÉ 16/09 (lot B3, note 373 : tete.armee)
const LOI12_1609 = { avantage: 1.8, contact: 0.9, mur: 9.15, jaune: 2 };   // loi12 d'HIER sans murTrot — DATÉ 16/09 (lot B4, note 374 : loi12.murTrot ; viragesLisses/plantVitesse null : B5/B6, même note)
const RP_0746 = { elan: { recul: 3.5, lat: 1.5, vitesse: 4, patience: 4, sortieBut: { recul: 3, lat: 1.2, vitesse: 3.5 }, toucheLongue: { recul: 4 }, tirImmediat: { cone: 40 } }, volee: { h: 1, avance: 0.45, lacher: 0.72 }, touche: { recul: 0.25 }, mur: { retard: 0.12 } };   // remisesPied de 0746dbd (A9 ter + B2, sans mur.corps ni elan.attente) — DATÉ 16/09 (B4, note 374)
const B_0746 = { loi12: LOI12_1609, viragesLisses: null, plantVitesse: null, sortieAerienne: null, retournee: null, bouclier: null, ceremonie: null, ramasseurs: null, boiterie: null, entrant: null, petitsGestes: null, passements: null, enchainement: null, remisesPied: RP_0746 };   // les clés venues APRÈS 0746dbd, éteintes (B4 murTrot/mur.corps/elan.attente, B5, B6, B10) — DATÉ 16/09 : les clauses non épinglées mesurent le monde de 0746dbd (suite 761/7 sur ce moteur)
const HIER_1609 = { remisesPied: RP_1609, tete: TETE_1609, loi12: LOI12_1609, viragesLisses: null, plantVitesse: null, sortieAerienne: null, retournee: null, bouclier: null, ceremonie: null, ramasseurs: null, boiterie: null, entrant: null, petitsGestes: null, passements: null, enchainement: null, sol: SOL_1609 };   // le monde vivant DU JOUR de la clause (b) — DATÉ 16/09
const SANS = { pausaPied: null, recevoirSurPlace: null, pasDeRecul: null, remisesPied: RP_1609, tete: TETE_1609, loi12: LOI12_1609, viragesLisses: null, plantVitesse: null, sortieAerienne: null, retournee: null, bouclier: null, ceremonie: null, ramasseurs: null, boiterie: null, entrant: null, petitsGestes: null, passements: null, enchainement: null /* remisesPied hier DATÉ 16/09 (lot A9 ter, note 368) — chaque clause de flux mesure le monde de son jour */, sol: null, fete: null /* sol, fete null DATÉ 15/09 (lots A10 bis-A11, notes 360-361) : le monde d'hier au bit, avant le sol et la fête */ };

console.log('— (a) la pausa au pied —');
const pausas = (over) => {
  const out = [];
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
    const st = makeMatch({ full: true, seed }); const cfg = matchCfg(over); let cur = null;
    for (let i = 0; i < 366 * 60; i++) {
      matchStep(st, 1 / 60, cfg); const p = st.players.find((q) => q._pausa);
      if (p) { const v = Math.hypot(p.v[0], p.v[1]), d = Math.hypot(st.ball.p[0] - p.p[0], st.ball.p[2] - p.p[2]); if (!cur || cur.id !== p.id) cur = { id: p.id, vMin: v, d, n: 0 }; cur.n++; if (v < cur.vMin) { cur.vMin = v; cur.d = d; } }
      else if (cur) { out.push(cur); cur = null; }
    }
  }
  return out;
};
{
  const A = pausas({}), B = pausas(SANS);
  const arret = (L) => L.filter((c) => c.vMin < 0.3), moy = (L) => L.reduce((a, c) => a + c.d, 0) / Math.max(1, L.length);
  ok(A.length >= 2 && A.every((c) => c.d <= 0.6), `avec la clé : le ballon est AU PIED à la tenue de chacune des ${A.length} pausas (≤ 0,6 m ; à l'arrêt ${arret(A).length}, distance moyenne ${moy(A).toFixed(2)} m) — 12 × 366 s`);
  ok(B.length >= 2 && moy(arret(B)) >= 1.0, `sans la clé : ${B.length} pausas, ${arret(B).length} à l'arrêt avec le ballon à ${moy(arret(B)).toFixed(2)} m en moyenne (≥ 1,0 : le porteur planté loin du ballon, hier)`);
}

console.log('\n— (b) la réception sur place —');
const attente = (over) => {
  let volF = 0, lent = 0, prises = 0, prisesLentes = 0, passes = 0, turnovers = 0;
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const st = makeMatch({ full: true, seed }); const cfg = matchCfg({ enveloppe: null, blocPercu: null /* DATÉ fusion 15/09 (272-276 × A12) : vert dans son parent (9/0 à f62c3d8), le garde-fou des passes remangé par la combinaison (320 c. 248) — la clause mesure les signes du rôle, pas le gardien à l'enveloppe ni le bloc qui perçoit */, ...over }); let lastTo = null, lentCe = false, seen = 0;
    for (let i = 0; i < 300 * 60; i++) {
      matchStep(st, 1 / 60, cfg);
      const to = st.phase === 'flight' ? (st.pass?.to ?? null) : null, p = to != null ? st.players[to] : null;
      if (p) { volF++; if (Math.hypot(p.v[0], p.v[1]) < 0.6) { lent++; lentCe = true; } }
      if (lastTo != null && to !== lastTo) { prises++; if (lentCe) prisesLentes++; lentCe = false; } lastTo = to;
      for (; seen < st.events.length; seen++) { const e = st.events[seen]; if (e.type === 'pass') passes++; if (e.type === 'turnover') turnovers++; }
    }
  }
  return { lent: lent / Math.max(1, volF), att: prisesLentes / Math.max(1, prises), passes, turnovers };
};
{
  const A = attente(HIER_1609), B = attente(SANS);   // A : le monde vivant de son jour (remisesPied/sol d'hier, DATÉ 16/09 — le garde-fou comparait 120 pertes c. 97 avec les dégagements longs et le relevé aidé allumés)
  ok(A.att - B.att >= 0.015 && A.lent >= 1.5 * B.lent, `avec la clé, plus de receveurs attendent : ${(100 * A.att).toFixed(1)} % des vols c. ${(100 * B.att).toFixed(1)} % sans (≥ +1,5 point ; 12 graines : +4) ; images de vol sous 0,6 m/s ${(100 * A.lent).toFixed(1)} % c. ${(100 * B.lent).toFixed(1)} % (≥ × 1,5)`);
  ok(Math.abs(A.passes - B.passes) <= 0.15 * B.passes && A.turnovers <= B.turnovers * 1.15,
    `garde-fou : passes ${A.passes} c. ${B.passes} (± 15 %), pertes ${A.turnovers} c. ${B.turnovers} (≤ +15 %)`);
}

console.log('\n— (c) le pas de recul du renard (fixture : le receveur du centre, marqué à 1,2 m) —');
const recul = (over) => {
  const st = makeMatch({ full: true, seed: 5, roles: [{ 9: 'poacher' }, null] }); const cfg = matchCfg(over);
  const g = st.pitch.attackGoal(0), sg = Math.sign(g.x || 1);
  const w = st.players.find((p) => p.team === 0 && p.post === 7), r9 = st.players.find((p) => p.team === 0 && p.post === 9);
  const m = st.players.find((p) => p.team === 1 && !p.keeper && p.post === 3);
  for (const q of st.players) if (q.team === 1 && !q.keeper && q !== m) { q.p[0] = g.x - sg * 30; q.p[2] = (q.post - 5) * 5; }
  for (const q of st.players) if (q.team === 0 && !q.keeper && q !== w && q !== r9) { q.p[0] = g.x - sg * 35; q.p[2] = (q.post - 5) * 5; }
  w.p[0] = g.x - sg * 12; w.p[2] = 25; r9.p[0] = g.x - sg * 9; r9.p[2] = 2; m.p[0] = g.x - sg * 8; m.p[2] = 2.6;
  for (const q of [w, r9, m]) { q.v[0] = 0; q.v[1] = 0; }
  st.ball.restart([w.p[0], 0.11, w.p[2]], { cause: 'coup-franc' }); st.restart = null; st.ball.possess(w.id);
  st.possession = { team: 0, carrier: w.id }; st.phase = 'carry'; st.hold = 1; st._possChangeAt = st.t - 9; st._possTeam = 0;
  matchStep(st, 1 / 60, cfg);
  st.ball.strike({ speed: 16, dirYaw: Math.atan2((r9.p[2] - 1) - w.p[2], r9.p[0] - w.p[0]), elevation: 0.35 });   // le centre part vers le renard
  st.pass = { from: w.id, to: r9.id, cross: true, lead: [r9.p[0], 0, r9.p[2] - 1], style: 'cross', t: st.t, flight: 1.4, origin: [w.p[0], w.p[2]] }; st.phase = 'flight'; st.possession = { team: 0, carrier: -1 };
  for (let k = 0; k < 8; k++) matchStep(st, 1 / 60, cfg);   // (263) le pas de décision tombe tous les 0,1 s
  return { t: r9.target ? [r9.target[0], r9.target[2]] : null, m: [m.p[0], m.p[2]], r: [r9.p[0], r9.p[2]] };
};
{
  const A = recul({}), B = recul(SANS);
  const d = A.t && B.t ? Math.hypot(A.t[0] - B.t[0], A.t[1] - B.t[1]) : NaN;
  const dm = (T) => T ? Math.hypot(T[0] - B.m[0], T[1] - B.m[1]) : NaN;
  ok(A.t && B.t && d >= 0.5 && d <= 1.3 && dm(A.t) >= dm(B.r) + 0.5, `le renard marqué à 1,2 m au départ du centre recule de ${isNaN(d) ? '?' : d.toFixed(2)} m par rapport à sa cible d'hier (0,5-1,3) et s'éloigne de son marqueur (cible à ${dm(A.t).toFixed(2)} m de lui, le corps était à ${dm(B.r).toFixed(2)} : ≥ +0,5) — sans la clé, la mène ${B.t ? B.t.map((v) => v.toFixed(1)).join('/') : '?'}`);
}

console.log('\n— (d) le jumeau : les trois clés à null = le monde du 14/09 au bit —');
{
  const emp = (over, seed) => { const st = makeMatch({ full: true, seed }); const cfg = matchCfg(over); const h = createHash('sha256'); for (let i = 0; i < 60 * 60; i++) { matchStep(st, 1 / 60, cfg); if (i % 10 === 0) h.update(st.players.map((p) => p.p[0].toFixed(3) + ',' + p.p[2].toFixed(3)).join('|') + '#' + st.ball.p.map((v) => v.toFixed(3)).join(',')); } h.update(JSON.stringify(st.events.map((e) => [e.t, e.type, e.by ?? '']))); return h.digest('hex').slice(0, 16); };
  const DATEES = { 1: '76cb709b3dd0cdfe', 2: '5214c712cdf66a67', 3: 'b62c2626e236ae00' };   // REGELÉ DATÉ fusion 15/09 (272-276 × A12) : les empreintes du monde 662a444 aux trois clés nulles — « hier » est désormais le 276 (la porte xG, la ligne, l'interligne, le bloc qui perçoit, l'enveloppe) ; DATÉ 14/09 (dettes A12) : 8aa4baa7c0092cec / cecae92caa993608 / 9c8eda27f0f5dc63, le monde 3d72ea4
  for (const seed of [1, 2, 3]) { const e = emp(SANS, seed); ok(e === DATEES[seed], `graine ${seed} : ${e} = ${DATEES[seed]} (le monde d'hier au bit, clés à null)`); }
  const on = emp({}, 1); ok(on !== DATEES[1], `…et la clé allumée déplace le monde (graine 1 : ${on})`);
}

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
