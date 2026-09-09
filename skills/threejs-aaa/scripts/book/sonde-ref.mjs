// sonde REF (Référentiel 01 macro, C1-C36) — un portrait chiffré du match moteur, 2 × 90 min.
import { makeMatch, matchStep, matchCfg } from '../../assets/starter/src/engine/match-sim.js';
const seeds = (process.argv[2] ?? '3,7').split(',').map(Number);
const o = { n: 0, buts: [], tirs: 0, cadres: 0, tirsIn: 0, tirsOut: 0, butsIn: 0, butsOut: 0, dist: [], passes: 0, passesOk: 0, longueurs: [], seqs: [], corners: 0, butsCorner: 0, butsCPA: 0, fautes: 0, jaunes: 0, rouges: 0, horsJeu: 0, touches: 0, sixM: 0, arretsGK: 0, jeu: 0, tot: 0, arrets: 0, arretsDur: [], butsH2: 0, buts76: 0, buts15: 0, butsTot: 0, butsEquipe: [] };
for (const seed of seeds) {
  const st = makeMatch({ full: true, seed }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: 2700, pause: 10 } }); o.n++;
  let seen = 0; const pend = []; let seq = null; let lastRestart = null, r0 = null, lastRestartT = -9;
  for (let i = 0; i < 5400 * 60; i++) {
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break; o.tot += 1 / 60;
    if (st.restart) { if (!lastRestart) { lastRestart = st.restart; r0 = st.t; } } else { o.jeu += 1 / 60; if (lastRestart) { o.arrets++; o.arretsDur.push(st.t - r0); lastRestartT = st.t; lastRestart = null; } }
    const team = st.possession.team;
    if (!st.restart && team >= 0 && (!seq || seq.team !== team)) { if (seq) { seq.dur = st.t - seq.t0; const og = st.pitch.ownGoal(seq.team); seq.prog = Math.abs(st.ball.p[0] - og.x) - seq.x0; o.seqs.push(seq); } const og = st.pitch.ownGoal(team); seq = { team, t0: st.t, x0: Math.abs(st.ball.p[0] - og.x), passes: 0, cpa: st.t - lastRestartT < 0.5 }; }
    for (const w of pend) if (!w.done && st.t - w.t > 0.15) { const ow = st.ball.owner ?? -1; if (ow >= 0) { w.done = true; if (st.players[ow].team === w.team) o.passesOk++; } else if (st.t - w.t > 4) w.done = true; }
    for (; seen < st.events.length; seen++) { const e = st.events[seen]; const by = st.players[e.by];
      if (e.type === 'pass' && by && !e.mains) { const to = st.players[e.to]; if (!to) continue; o.passes++; o.longueurs.push(Math.hypot(to.p[0] - by.p[0], to.p[2] - by.p[2])); pend.push({ t: st.t, team: by.team, done: false }); if (seq && seq.team === by.team) seq.passes++; }
      if (e.type === 'shot' && by) { o.tirs++; const g = st.pitch.ownGoal(1 - by.team); const inBox = Math.abs(by.p[0] - g.x) <= 16.5 && Math.abs(by.p[2]) <= 20.16; if (inBox) o.tirsIn++; else o.tirsOut++; o.dist.push(Math.hypot(by.p[0] - g.x, by.p[2])); pend.lastShot = { t: st.t, team: by.team, inBox }; }
      if (e.type === 'arrêt' && by) { o.arretsGK++; o.cadres++; }
      if (e.type === 'but') { o.butsTot++; o.cadres++; const ls = pend.lastShot; if (ls && st.t - ls.t < 3) { if (ls.inBox) o.butsIn++; else o.butsOut++; } if (st.t - lastRestartT < 15 && lastRestart === null) o.butsCPA++; if (seq && seq.cpa && st.t - seq.t0 < 15) {} const m = st.t / 60; if (st.t > 2710) o.butsH2++; if (m >= 75) o.buts76++; if (m < 15) o.buts15++; }
      if (e.type === 'corner-joué') { o.corners++; pend.lastCorner = { t: st.t, team: by?.team }; }
      if (e.type === 'but' && pend.lastCorner && st.t - pend.lastCorner.t < 15 && pend.lastCorner.team === e.team) o.butsCorner++;
      if (e.type === 'faute') o.fautes++; if (e.type === 'carton') { if (e.couleur === 'jaune') o.jaunes++; else o.rouges++; }
      if (e.type === 'hors-jeu') o.horsJeu++;
      if (e.type === 'sortie' && e.out === 'touche') o.touches++; if (e.type === 'sortie' && e.out === 'sortie-de-but') o.sixM++;
    }
  }
  o.butsEquipe.push(st.score[0], st.score[1]); o.buts.push(st.score[0] + st.score[1]);
}
const q = (a, x) => { a = [...a].sort((u, v) => u - v); return a.length ? a[Math.floor(x * a.length)] : NaN; }; const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN; const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); }; const n = o.n;
const S = o.seqs.filter((s) => s.dur > 0.5);
console.log(`${n} × 90 min`);
console.log(`C1  buts / match ${mean(o.buts).toFixed(2)} (2,90 ±0,25) ; C2 écart-type par équipe ${sd(o.butsEquipe).toFixed(2)} (0,44) ; C3 tirs / match ${(o.tirs / n).toFixed(1)} (25,5 ±3) ; C4 cadrés / équipe ${(o.cadres / 2 / n).toFixed(1)} (4,5 ±0,8)`);
console.log(`C7  tirs hors surface ${(100 * o.tirsOut / Math.max(1, o.tirs)).toFixed(0)} % (32 ±5) ; C8 conversion dedans ${(100 * o.butsIn / Math.max(1, o.tirsIn)).toFixed(1)} % / dehors ${(100 * o.butsOut / Math.max(1, o.tirsOut)).toFixed(1)} % (14,7 / 4,2) ; C9 distance médiane ${q(o.dist, 0.5).toFixed(1)} m (15 ±2)`);
console.log(`C10 passes / match ${(o.passes / n).toFixed(0)} (890 ±70) ; C11 précision ${(100 * o.passesOk / Math.max(1, o.passes)).toFixed(0)} % (83 ±3) ; C12 longueur ${mean(o.longueurs).toFixed(1)} ± ${sd(o.longueurs).toFixed(1)} m (21 ± 14)`);
console.log(`C13 séquences / équipe / match ${(S.length / 2 / n).toFixed(0)} (105 ±25) ; C14 passes / séquence ${mean(S.map((s) => s.passes)).toFixed(2)} (3,5) ; C15 durée ${mean(S.map((s) => s.dur)).toFixed(1)} s (9,8) ; C16 progression ${mean(S.map((s) => s.prog)).toFixed(1)} m (12,3) ; C17 séquences 0-2 passes ${(100 * S.filter((s) => s.passes <= 2).length / S.length).toFixed(0)} % (55) ; C18 10+ passes / équipe ${(S.filter((s) => s.passes >= 10).length / 2 / n).toFixed(1)} (7)`);
console.log(`C20 corners / match ${(o.corners / n).toFixed(1)} (10,2) ; C21 conversion ${(100 * o.butsCorner / Math.max(1, o.corners)).toFixed(1)} % (2,8) ; C22 buts sur CPA (≤ 15 s d'une remise) ${(100 * o.butsCPA / Math.max(1, o.butsTot)).toFixed(0)} % (22)`);
console.log(`C23 fautes / match ${(o.fautes / n).toFixed(1)} (24 ±4) ; C24 jaunes ${(o.jaunes / n).toFixed(1)} (4,0) ; C25 rouges ${(o.rouges / n).toFixed(2)} (0,17) ; C26 hors-jeu ${(o.horsJeu / n).toFixed(1)} (4,0) ; C27 touches ${(o.touches / n).toFixed(0)} (35) ; C28 dégagements de but ${(o.sixM / n).toFixed(0)} (16) ; C29 arrêts / équipe ${(o.arretsGK / 2 / n).toFixed(1)} (3,0)`);
console.log(`C30 temps effectif ${(o.jeu / 60 / n).toFixed(0)} min (56 ±3) sur ${(o.tot / 60 / n).toFixed(0)} ; C31 arrêts / match ${(o.arrets / n).toFixed(0)} (95 ±12) ; C32 durée ${mean(o.arretsDur).toFixed(1)} s (28 ±5)`);
console.log(`C34 buts en 2e période ${(100 * o.butsH2 / Math.max(1, o.butsTot)).toFixed(0)} % (56) ; C35 76-90+ ${(100 * o.buts76 / Math.max(1, o.butsTot)).toFixed(0)} % (22) ; C36 1-15 ${(100 * o.buts15 / Math.max(1, o.butsTot)).toFixed(0)} % (12,5) — ${o.butsTot} buts, indicatif`);
