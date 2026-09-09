// sonde 258 — l'échelle de finition : conversion par bande de distance (T9-T14), cadré / hors cadre / contré, arrêts, buts / match, angle de sortie du tir, par graine.
import { makeMatch, matchStep, matchCfg } from '../../assets/starter/src/engine/match-sim.js';
const seeds = (process.argv[2] ?? '3,7,11,13').split(',').map(Number), over = JSON.parse(process.argv[3] ?? 'null'), DUR = +(process.argv[4] ?? 5400);
const o = { n: 0, bands: {}, shots: 0, buts: 0, arrets: 0, hors: 0, contres: 0, montants: 0, dist: [], dev: [], parGraine: [], dessus: 0, cote: 0 };
const bandOf = (d) => d < 5 ? '0-5' : d < 8 ? '5-8' : d < 14 ? '8-14' : d < 18 ? '14-18' : d < 23 ? '18-23' : '23+';
for (const seed of seeds) {
  const st = makeMatch({ full: true, seed }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: 2700, pause: 10 }, ...(over ?? {}) }); o.n++;
  let seen = 0; const pend = []; let g0 = 0, s0 = 0; let prevB = null;
  for (let i = 0; i < DUR * 60; i++) {
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break;
    // le plan du but : classer le hors-cadre AU-DESSUS (barre) c. À CÔTÉ (poteau) au franchissement de la ligne
    const last0 = pend.slice().reverse().find((w) => !w.done && st.t - w.t < 3);
    if (last0 && prevB) { const g = st.pitch.ownGoal(1 - last0.team); const x0 = prevB[0] - g.x, x1 = st.ball.p[0] - g.x; if (Math.sign(x0) !== Math.sign(x1) && Math.abs(x0) < 3 && !last0.plan) { last0.plan = true; const zz = Math.abs(st.ball.p[2]), yy = st.ball.p[1]; if (zz > 3.66 || yy > 2.44) { if (zz <= 3.66 + 0.6 && yy > 2.44) o.dessus++; else if (zz > 3.66 && yy <= 2.44 + 0.6) o.cote++; } } }
    prevB = [st.ball.p[0], st.ball.p[1], st.ball.p[2]];
    for (const w of pend) { if (w.done) continue; if (st.t - w.t > 4) { w.done = true; if (!w.issue) { w.issue = 'hors'; o.hors++; } (o.bands[w.band] ??= { n: 0, but: 0, cadre: 0 }); } }
    for (; seen < st.events.length; seen++) { const e = st.events[seen]; const by = st.players[e.by];
      if (e.type === 'shot' && by) { o.shots++; s0++; const g = st.pitch.ownGoal(1 - by.team); const d = Math.hypot(by.p[0] - g.x, by.p[2]); o.dist.push(d); const band = bandOf(d); const B = (o.bands[band] ??= { n: 0, but: 0, cadre: 0 }); B.n++; pend.push({ t: st.t, team: by.team, band, done: false, issue: null }); }
      const last = pend.slice().reverse().find((w) => !w.done && !w.issue && st.t - w.t < 4);
      if (e.type === 'arrêt' && last && st.players[e.by].team !== last.team) { last.issue = 'arrêt'; o.arrets++; o.bands[last.band].cadre++; }
      if (e.type === 'but' && last && e.team === last.team) { last.issue = 'but'; o.buts++; g0++; o.bands[last.band].but++; o.bands[last.band].cadre++; }
      if (e.type === 'contre' && last) { last.issue = 'contre'; o.contres++; }
      if ((e.type === 'pylon' || e.type === 'roof') && last) { last.issue = 'montant'; o.montants++; }
      if (e.type === 'sortie' && last && (e.out === 'sortie-de-but' || e.out === 'corner')) { last.issue = 'hors'; o.hors++; }
    }
  }
  o.parGraine.push(`${seed}: ${s0} tirs, ${g0} buts`);
}
const q = (a, x) => { a = [...a].sort((u, v) => u - v); return a.length ? a[Math.floor(x * a.length)] : NaN; }; const n = o.n; const pct = (a, b) => (100 * a / Math.max(1, b)).toFixed(1);
console.log(`${n} × ${(DUR / 60).toFixed(0)} min ${over ? JSON.stringify(over) : '(défaut)'} — ${o.parGraine.join(' ; ')}`);
console.log(`tirs / match ${(o.shots / n).toFixed(1)} (25) ; buts / match ${(o.buts / n).toFixed(2)} (2,85) ; buts / tirs ${pct(o.buts, o.shots)} % (11) ; distance p50 ${q(o.dist, 0.5).toFixed(1)} m (15)`);
console.log(`cadrés (but + arrêt) ${pct(o.buts + o.arrets, o.shots)} % (33) ; hors cadre ${pct(o.hors, o.shots)} % (36-38) ; contrés ${pct(o.contres, o.shots)} % (27) ; montants ${pct(o.montants, o.shots)} % (2,3) ; arrêts / cadrés ${pct(o.arrets, o.buts + o.arrets)} % (69)`);
console.log(`hors-cadre au plan du but : au-dessus ${o.dessus} / à côté ${o.cote} → ratio ${(o.dessus / Math.max(1, o.cote)).toFixed(2)} (cible ≈ 1,5, ≥ 1,1)`);
console.log(`conversion par bande : ${['0-5', '5-8', '8-14', '14-18', '18-23', '23+'].map((b) => { const B = o.bands[b]; return B ? `${b} m ${pct(B.but, B.n)} % (${B.n}, cadré ${pct(B.cadre, B.n)} %)` : `${b} —`; }).join(' ; ')} (cibles 45 / 21 / 12 / 10 / 3,6 / 2,2)`);
