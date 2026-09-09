// sonde MC01 (Modèle 01, boucle) — test 3 insensibilité au pas (1/60 c. 1/30), test 5 autocorrélation des vitesses, test 9 budget CPU par tick, test 10 conservation du temps.
import { makeMatch, matchStep, matchCfg } from '../../assets/starter/src/engine/match-sim.js';
const seeds = (process.argv[2] ?? '3,7,11,13').split(',').map(Number), DUR = +(process.argv[3] ?? 600);
const res = {};
for (const dt of [1 / 60, 1 / 30]) {
  const R = res[dt.toFixed(4)] = { shots: 0, passes: 0, poss: [], buts: 0, jeu: 0, tot: 0, us: [], acf: null, arrets: 0 };
  for (const seed of seeds) {
    const st = makeMatch({ full: true, seed }), cfg = matchCfg({ shotRange: 20 });
    let seen = 0, carrier = -1, c0 = 0; const vhist = []; const n = Math.round(DUR / dt);
    for (let i = 0; i < n; i++) {
      const t0 = process.hrtime.bigint(); matchStep(st, dt, cfg); R.us.push(Number(process.hrtime.bigint() - t0) / 1000);
      R.tot += dt; if (st.restart) R.arrets += dt; else R.jeu += dt;
      const ow = st.ball.owner ?? -1; if (ow !== carrier) { if (carrier >= 0) R.poss.push(st.t - c0); carrier = ow; c0 = st.t; }
      for (; seen < st.events.length; seen++) { const e = st.events[seen]; if (e.type === 'shot') R.shots++; if (e.type === 'pass') R.passes++; if (e.type === 'but') R.buts++; }
      if (dt < 0.02 && i % 6 === 0) vhist.push(st.players.filter((p) => !p.keeper).map((p) => [p.p[0], p.p[2]]));
    }
    if (vhist.length > 100) { // vitesses à 10 Hz, autocorrélation par joueur
      const V = []; for (let k = 1; k < vhist.length; k++) V.push(vhist[k].map((q, j) => [(q[0] - vhist[k - 1][j][0]) * 10, (q[1] - vhist[k - 1][j][1]) * 10]));
      const lags = [1, 2, 5, 10, 20]; const acf = lags.map((L) => { let num = 0, den = 0; for (let k = L; k < V.length; k++) for (let j = 0; j < 20; j++) { num += V[k][j][0] * V[k - L][j][0] + V[k][j][1] * V[k - L][j][1]; den += V[k][j][0] ** 2 + V[k][j][1] ** 2; } return num / den; });
      R.acf = R.acf ? R.acf.map((a, i) => a + acf[i] / seeds.length) : acf.map((a) => a / seeds.length);
    }
  }
}
const q = (a, x) => { a = [...a].sort((u, v) => u - v); return a.length ? a[Math.floor(x * a.length)] : NaN; }; const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
const ks = (a, b) => { const A = [...a].sort((x, y) => x - y), B = [...b].sort((x, y) => x - y); let i = 0, j = 0, d = 0; while (i < A.length && j < B.length) { if (A[i] <= B[j]) i++; else j++; d = Math.max(d, Math.abs(i / A.length - j / B.length)); } return d; };
const a = res['0.0167'], b = res['0.0333']; const M = seeds.length * DUR / 90 / 60;
console.log(`${seeds.length} × ${DUR} s par pas de temps`);
console.log(`T3  insensibilité au pas : dt 1/60 → tirs ${(a.shots / M).toFixed(1)} / 90, passes ${(a.passes / M).toFixed(0)}, buts ${a.buts}, possession p50 ${q(a.poss, 0.5).toFixed(2)} s ; dt 1/30 → tirs ${(b.shots / M).toFixed(1)}, passes ${(b.passes / M).toFixed(0)}, buts ${b.buts}, p50 ${q(b.poss, 0.5).toFixed(2)} ; D_KS(possession) ${ks(a.poss, b.poss).toFixed(3)} (cible < 0,03), écart de moyenne passes ${(100 * (b.passes / a.passes - 1)).toFixed(1)} % (cible < 5)`);
console.log(`T5  autocorrélation des vitesses (10 Hz) à 0,1 / 0,2 / 0,5 / 1,0 / 2,0 s : ${a.acf.map((x) => x.toFixed(2)).join(' / ')} (à comparer au tracking ; < 0,05 d'écart)`);
console.log(`T9  budget CPU par tick (dt 1/60, 22 joueurs) : p50 ${q(a.us, 0.5).toFixed(0)} µs, p99 ${q(a.us, 0.99).toFixed(0)} µs (cible p50 < 40, p99 < 120 ; 2 s par match ⇒ 52 µs / tick à 10 Hz — ici 60 Hz : ${(mean(a.us) * 60 * 5400 / 1e6).toFixed(0)} s par match)`);
console.log(`T10 conservation du temps : jeu ${a.jeu.toFixed(0)} + arrêts ${a.arrets.toFixed(0)} = ${(a.jeu + a.arrets).toFixed(0)} c. ${a.tot.toFixed(0)} (invariant dur) ; fraction en jeu ${(a.jeu / a.tot).toFixed(3)} (cible 0,547 ± 0,02)`);
