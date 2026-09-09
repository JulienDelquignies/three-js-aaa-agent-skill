// sonde ch16 (Bible 16, contexte) — T1/T2 buts par tranche, T5/T6 tirs selon le score, T10 jeu effectif, T11/T12b/T13/T14/T15 distances et vitesses par quart d'heure, T17 passes, T19 désynchronisation 85' vs 20', T23 temps additionnel.
import { makeMatch, matchStep, matchCfg } from '../../assets/starter/src/engine/match-sim.js';
const seeds = (process.argv[2] ?? '3,7').split(',').map(Number);
const o = { n: 0, butsBande: {}, tirsStatut: { mene: [0, 0], egal: [0, 0], menant: [0, 0] }, jeuQ: {}, distQ: {}, hiQ: {}, sprQ: {}, topQ: {}, passesQ: {}, desyncQ: {}, addl: [], distTot: 0, hiTot: 0, sprTot: 0 };
for (const seed of seeds) {
  const st = makeMatch({ full: true, seed }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: 2700, pause: 10 } }); o.n++;
  let seen = 0; const prevP = new Map(); let lastSec = -1;
  for (let i = 0; i < 5400 * 60; i++) {
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break;
    const min = st.t / 60, Q = 'Q' + Math.min(6, Math.floor(min / 15) + 1);   // 6 quarts d'heure (mi-temps comprise dans le temps)
    const enJeu = !st.restart; o.jeuQ[Q] ??= [0, 0]; o.jeuQ[Q][1]++; if (enJeu) o.jeuQ[Q][0]++;
    for (const p of st.players) { const pv = prevP.get(p.id); if (pv && !p.keeper) { const d = Math.hypot(p.p[0] - pv[0], p.p[2] - pv[1]); const v = d * 60; o.distQ[Q] = (o.distQ[Q] ?? 0) + d; o.distTot += d; if (v > 5.56) { o.hiQ[Q] = (o.hiQ[Q] ?? 0) + d; o.hiTot += d; } if (v > 6.94) { o.sprQ[Q] = (o.sprQ[Q] ?? 0) + d; o.sprTot += d; } o.topQ[Q] = Math.max(o.topQ[Q] ?? 0, v); } prevP.set(p.id, [p.p[0], p.p[2]]); }
    const sec = Math.floor(st.t); if (sec !== lastSec) { lastSec = sec; if (enJeu) for (const t of [0, 1]) { const og = st.pitch.ownGoal(t); const D = st.players.filter((p) => p.team === t && !p.keeper && p.post < 4 && p.down <= 0); if (D.length >= 4) { const xs = D.map((p) => Math.abs(p.p[0] - og.x)); (o.desyncQ[Q] ??= []).push(Math.max(...xs) - Math.min(...xs)); } } }
    for (; seen < st.events.length; seen++) { const e = st.events[seen]; const by = st.players[e.by];
      if (e.type === 'but') { const b = Math.min(6, Math.floor(min / 15) + 1); o.butsBande[b] = (o.butsBande[b] ?? 0) + 1; }
      if (e.type === 'shot' && by) { const d = st.score[by.team] - st.score[1 - by.team]; const k = d < 0 ? 'mene' : d > 0 ? 'menant' : 'egal'; o.tirsStatut[k][0]++; }
      if (e.type === 'pass' && by) o.passesQ[Q] = (o.passesQ[Q] ?? 0) + 1;
      if (e.type === 'temps-additionnel') o.addl.push({ sec: e.sec, ecart: Math.abs(st.score[0] - st.score[1]) });
    }
    if (i % 60 === 0 && enJeu) { const d = st.score[0] - st.score[1]; for (const t of [0, 1]) { const dd = t === 0 ? d : -d; const k = dd < 0 ? 'mene' : dd > 0 ? 'menant' : 'egal'; o.tirsStatut[k][1]++; } }
  }
}
const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN; const q = (a, x) => { a = [...a].sort((u, v) => u - v); return a.length ? a[Math.floor(x * a.length)] : NaN; }; const n = o.n;
const Qs = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6']; const tot = Object.values(o.butsBande).reduce((a, b) => a + b, 0);
console.log(`${n} × 90 min`);
console.log(`T1  buts par tranche de 15 min : ${[1, 2, 3, 4, 5, 6].map((b) => o.butsBande[b] ?? 0).join(' / ')} (${tot} buts) ; part 76-90 ${(100 * (o.butsBande[6] ?? 0) / Math.max(1, tot)).toFixed(0)} % (cible 22-25) ; T2 rapport 76-90 / 1-15 : ${((o.butsBande[6] ?? 0) / Math.max(1, o.butsBande[1] ?? 0)).toFixed(2)} (1,6-1,9) — 2 matchs : indicatif`);
const ts = o.tirsStatut; const r = (k) => ts[k][1] ? ts[k][0] / (ts[k][1] / 60) : NaN; console.log(`T5  tirs / min mené ${r('mene').toFixed(2)}, égalité ${r('egal').toFixed(2)}, menant ${r('menant').toFixed(2)} → mené/égalité ${(r('mene') / r('egal')).toFixed(2)} (cible 1,11-1,43) ; T6 menant/égalité ${(r('menant') / r('egal')).toFixed(2)} (0,57-0,91)`);
console.log(`T10 jeu effectif : Q1 ${(100 * o.jeuQ.Q1[0] / o.jeuQ.Q1[1]).toFixed(0)} % → Q6 ${(100 * o.jeuQ.Q6[0] / o.jeuQ.Q6[1]).toFixed(0)} % (cible 66 → 56)`);
console.log(`T11 distance par quart d'heure (20 joueurs, m) : ${Qs.map((k) => (o.distQ[k] / n / 20).toFixed(0)).join(' / ')} ; Q6 vs Q1 ${(100 * (o.distQ.Q6 / o.distQ.Q1 - 1)).toFixed(0)} % (cible −21 nominal / −6,6 effectif) ; T12b sprint > 25 km/h Q6 vs Q1 ${(100 * ((o.sprQ.Q6 ?? 0) / Math.max(1, o.sprQ.Q1 ?? 1) - 1)).toFixed(0)} % (cible −27,6 / −13,6)`);
console.log(`T13 distance totale par équipe et par match : ${(o.distTot / 2 / n / 1000).toFixed(1)} km (cible 108,1 ±3,6, joueurs de champ ≈ 100) ; T14 > 20 km/h ${(o.hiTot / 2 / n / 1000).toFixed(1)} km (9,0 ±0,9), > 25 km/h ${(o.sprTot / 2 / n / 1000).toFixed(1)} km (2,3 ±0,3)`);
console.log(`T15 vitesse de pointe Q6 vs Q1 : ${(o.topQ.Q6 ?? 0).toFixed(2)} vs ${(o.topQ.Q1 ?? 0).toFixed(2)} m/s (${(100 * (o.topQ.Q6 / o.topQ.Q1 - 1)).toFixed(1)} %, cible −2 à −5) ; T17 passes Q6 vs Q1 : ${o.passesQ.Q6 ?? 0} vs ${o.passesQ.Q1 ?? 0} (${(100 * ((o.passesQ.Q6 ?? 0) / Math.max(1, o.passesQ.Q1 ?? 1) - 1)).toFixed(0)} %, cible −12 à −20)`);
console.log(`T19 désynchronisation de la ligne (max − min x des 4 D, m) : Q2 p50 ${q(o.desyncQ.Q2 ?? [], 0.5).toFixed(1)} → Q6 p50 ${q(o.desyncQ.Q6 ?? [], 0.5).toFixed(1)} (cible : dispersion temporelle +0,4-0,7 s ; ici en mètres)`);
console.log(`T23 temps additionnel : ${o.addl.map((a) => `${a.sec.toFixed(0)} s (écart ${a.ecart})`).join(', ')} (cible ≥ +60 s quand l'écart ≤ 1)`);
