// sonde ch05 (Bible 05, le 6) — T1 dLine, T2 pente y6/yBallon, T4 interceptions/tacles, T6 pressions subies, T8 tenue, T9 passes avant tiers propre, T12-14 double pivot, T15/T17 fautes, T18 distance, T27 renversements.
import { makeMatch, matchStep, matchCfg } from '../../assets/starter/src/engine/match-sim.js';
import { momentDuJeu } from '../../assets/starter/src/engine/phases.js';
import { pivotDe, LIGNES, formationPour } from '../../assets/starter/src/engine/formation.js';
const seeds = (process.argv[2] ?? '3,7').split(',').map(Number), form = +(process.argv[3] ?? 433), tac = JSON.parse(process.argv[4] ?? 'null');
const o = { n: 0, dLine: [], y6: [], yB: [], intercept: 0, tacles: 0, press: 0, hold: [], avantTiers: 0, passesTiers: 0, swaps: 0, deuxDevant: 0, imgsPoss: 0, dSep: [], fautes6: 0, fautesTot: 0, dist6: 0, distDef6: 0, renv: 0, possessions: 0, imgs: 0 };
for (const seed of seeds) {
  const T = { formation: form, ...(tac ?? {}) }; const st = makeMatch({ full: true, seed, tactics: [T, T] }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: 2700, pause: 10 } }); o.n++;
  const piv = pivotDe(form), nD = LIGNES[formationPour(form, false)][0]; const pivots = [0, 1].map((t) => st.players.filter((p) => p.team === t && (p.post === piv || (form === 4231 && (p.post === 4 || p.post === 5)))));
  let seen = 0, prevAdv = [null, null], prevPoss = -1, carrierPrev = -1, holdT0 = 0; const prevP = new Map(); let lastSide = null;
  for (let i = 0; i < 5400 * 60; i++) {
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break;
    for (const t of [0, 1]) for (const p of pivots[t]) { const pv = prevP.get(p.id); if (pv) { const d = Math.hypot(p.p[0] - pv[0], p.p[2] - pv[1]); o.dist6 += d; if (st.possession.team === 1 - t) o.distDef6 += d; } prevP.set(p.id, [p.p[0], p.p[2]]); }
    const ow = st.ball.owner ?? -1; if (ow !== carrierPrev) { if (carrierPrev >= 0 && pivots.flat().some((p) => p.id === carrierPrev)) o.hold.push(st.t - holdT0); carrierPrev = ow; holdT0 = st.t; }
    if (st.possession.team !== prevPoss) { if (st.possession.team >= 0) o.possessions++; prevPoss = st.possession.team; lastSide = null; }
    for (; seen < st.events.length; seen++) { const e = st.events[seen]; const by = st.players[e.by]; const est6 = by && pivots[by.team].some((p) => p.id === by.id);
      if (e.type === 'faute') { o.fautesTot++; if (st.players[e.par] && pivots[st.players[e.par].team]?.some((p) => p.id === e.par)) o.fautes6++; }
      if (est6 && (e.type === 'slide' || e.type === 'tacle-pique' || e.type === 'duel')) o.tacles++;
      if (est6 && e.type === 'control' && st.lastTouch !== by.team) o.intercept++;
      if (est6 && e.type === 'pass') { const og = st.pitch.ownGoal(by.team); if (Math.abs(by.p[0] - og.x) < 35) { o.passesTiers++; const r = st.players[e.to]; if (r && Math.abs(r.p[0] - og.x) > Math.abs(by.p[0] - og.x) + 3) o.avantTiers++; } }
      if (e.type === 'pass' || e.type === 'receive') { const p = st.players[e.by]; if (p) { const side = p.p[2] > 8 ? 1 : p.p[2] < -8 ? -1 : 0; if (side && lastSide && side !== lastSide && e.type === 'pass') { const r = st.players[e.to]; if (r && Math.hypot(r.p[0] - p.p[0], r.p[2] - p.p[2]) > 30) o.renv++; } if (side) lastSide = side; } }
    }
    if (st.restart || i % 15) continue; const poss = st.possession.team; if (poss < 0) continue; o.imgs++;
    const def = 1 - poss, og = st.pitch.ownGoal(def), sg = Math.sign(og.x || 1);
    if (momentDuJeu(st, def, 6) === 'défense-placée') { const D = st.players.filter((p) => p.team === def && !p.keeper && p.post < nD && p.down <= 0); const six = pivots[def][0]; if (D.length && six) { const ligne = Math.min(...D.map((p) => Math.abs(p.p[0] - og.x))); o.dLine.push(Math.abs(six.p[0] - og.x) - ligne); o.y6.push(six.p[2] * sg); o.yB.push(st.ball.p[2] * sg); if (pivots[def].length === 2) o.dSep.push(Math.hypot(pivots[def][0].p[0] - pivots[def][1].p[0], pivots[def][0].p[2] - pivots[def][1].p[2])); }
      const c = st.possession.carrier >= 0 ? st.players[st.possession.carrier] : null; if (six && c && Math.hypot(c.p[0] - six.p[0], c.p[2] - six.p[2]) < 2 && !pivots[poss].some((p) => p.id === c.id) && momentDuJeu(st, poss, 6) === 'attaque-placée') {} }
    for (const p of pivots[poss]) { if (st.ball.owner === p.id) { let bd = 99; for (const q of st.players) if (q.team !== poss && !q.keeper) bd = Math.min(bd, Math.hypot(q.p[0] - p.p[0], q.p[2] - p.p[2])); if (bd < 2) o.press++; } }
    if (pivots[poss].length === 2) { o.imgsPoss++; const ogA = st.pitch.ownGoal(poss), sgA = Math.sign(ogA.x || 1); const devant = pivots[poss].filter((p) => (p.p[0] - st.ball.p[0]) * sgA < -1); if (devant.length === 2) o.deuxDevant++; const adv = pivots[poss].reduce((b, p) => (!b || (p.p[0] - b.p[0]) * sgA < 0 ? p : b), null); if (prevAdv[poss] && adv.id !== prevAdv[poss]) o.swaps++; prevAdv[poss] = adv.id; }
  }
}
const q = (arr, x) => { arr = [...arr].sort((u, v) => u - v); return arr.length ? arr[Math.floor(x * arr.length)] : NaN; }; const mean = (arr) => arr.length ? arr.reduce((x, y) => x + y, 0) / arr.length : NaN;
const slope = (x, y) => { const mx = mean(x), my = mean(y); let sxy = 0, sxx = 0; for (let i = 0; i < x.length; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; } return sxy / sxx; };
console.log(`formation ${form} ${JSON.stringify(tac)} — ${o.n} × 90 min`);
console.log(`T1  dLine (6 → dernier défenseur, défense placée) : p50 ${q(o.dLine, 0.5).toFixed(1)} m (cibles 10-15 médian, 5-8 bas)`);
console.log(`T2  pente y(6) sur y(ballon) : ${slope(o.yB, o.y6).toFixed(2)} (cible 0,30-0,45, jamais > 0,7)`);
console.log(`T4  interceptions / tacles du 6 : ${o.intercept} / ${o.tacles} = ${(o.intercept / Math.max(1, o.tacles)).toFixed(2)} (Alonso > 1,2 ; destructeur < 0,7)`);
console.log(`T6  images du 6 porteur avec adversaire < 2 m : ${(o.press / o.n).toFixed(0)} / match (× 0,25 s) ; T8 tenue du 6 : p50 ${q(o.hold, 0.5).toFixed(2)} s, p90 ${q(o.hold, 0.9).toFixed(2)} (ACCEL ≤ 0,6 / SETTLE 1,2-2,5)`);
console.log(`T9  passes du 6 vers l'avant dans le tiers propre : ${o.avantTiers}/${o.passesTiers} = ${(o.avantTiers / Math.max(1, o.passesTiers)).toFixed(2)} (possession 0,20-0,30 / direct 0,45-0,60)`);
if (form === 4231) console.log(`T12 bascules du pivot avancé / match / équipe : ${(o.swaps / 2 / o.n).toFixed(0)} (25-70, > 200 échec) ; T13 les deux devant le ballon : ${(100 * o.deuxDevant / Math.max(1, o.imgsPoss)).toFixed(1)} % (cible < 4) ; T14 dSep p50 ${q(o.dSep, 0.5).toFixed(1)} m (9-13)`);
console.log(`T15 fautes du 6 / 90 : ${(o.fautes6 / 2 / o.n).toFixed(1)} (encouragée 1,3-2,0 / interdite 0,4-0,9) ; T17 fautes totales / match : ${(o.fautesTot / o.n).toFixed(1)} (PL 20,9 … Liga 27,0)`);
console.log(`T18 distance du 6 : ${(o.dist6 / (form === 4231 ? 4 : 2) / o.n).toFixed(0)} m / match (≤ 10,6 km), hors possession ${(o.distDef6 / (form === 4231 ? 4 : 2) / o.n).toFixed(0)}`);
console.log(`T27 renversements (> 30 m, changement de côté) : 1 toutes les ${(o.possessions / Math.max(1, o.renv)).toFixed(1)} possessions (cible 8-14)`);
