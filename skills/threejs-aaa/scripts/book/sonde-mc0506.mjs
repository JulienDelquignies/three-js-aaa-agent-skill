// sonde MC05/06 — M05 test 2 (zone atteignable à 1 s depuis l'arrêt), test 4 (changements de cible / joueur / min) ; M06 test 2 (passes vers l'arrière, possession c. direct), calibration (réussite 82,5 %, ballons longs ≥ 32 m 10,5-11,7 %), test 5 (effet de score : passes avant, mené c. 0-0).
import { makeMatch, matchStep, matchCfg } from '../../assets/starter/src/engine/match-sim.js';
const seeds = (process.argv[2] ?? '3,7').split(',').map(Number);
const run = (tacName) => {
  const o = { n: 0, r1: [], retarget: 0, minutes: 0, passes: 0, arriere: 0, ok: 0, longues: 0, avantMene: [0, 0], avantNul: [0, 0] };
  for (const seed of seeds) {
    const tac = tacName ? { preset: tacName } : null;
    const st = makeMatch({ full: true, seed, tactics: tac ? [tac, tac] : null }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: 2700, pause: 10 } }); o.n++;
    let seen = 0; const rest = new Map(), prevT = new Map(); const pend = [];
    for (let i = 0; i < 5400 * 60; i++) {
      matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break; if (st.restart) continue; o.minutes += 1 / 3600;
      for (const p of st.players) { if (p.keeper) continue;
        const r = rest.get(p.id); if (!r && p.speed < 0.3) rest.set(p.id, { t: st.t, x: p.p[0], z: p.p[2] }); else if (r && p.speed >= 0.3 && !r.go) { r.go = st.t; } if (r && r.go && st.t - r.go >= 1.0) { o.r1.push(Math.hypot(p.p[0] - r.x, p.p[2] - r.z)); rest.delete(p.id); } if (r && !r.go && p.speed < 0.3) { r.x = p.p[0]; r.z = p.p[2]; }
        if (p.target && i % 6 === 0) { const pv = prevT.get(p.id); if (pv && Math.hypot(p.target[0] - pv[0], p.target[2] - pv[1]) > 0.8) o.retarget++; prevT.set(p.id, [p.target[0], p.target[2]]); } }
      for (const w of pend) if (!w.done && st.t - w.t > 0.2) { const ow = st.ball.owner ?? -1; if (ow >= 0) { w.done = true; if (st.players[ow].team === w.team) o.ok++; } else if (st.t - w.t > 4) { w.done = true; } }
      for (; seen < st.events.length; seen++) { const e = st.events[seen]; if (e.type !== 'pass') continue; const by = st.players[e.by], to = st.players[e.to]; if (!by || by.keeper) continue; o.passes++; const og = st.pitch.ownGoal(by.team); const sg = -og.sign; const dx = to ? (to.p[0] - by.p[0]) * sg : 0; if (to && dx < -1) o.arriere++; const d = to ? Math.hypot(to.p[0] - by.p[0], to.p[2] - by.p[2]) : 0; if (d >= 32) o.longues++; pend.push({ t: st.t, team: by.team, done: false });
        if (st.t > 2710 + 2700 - 600) { const diff = st.score[by.team] - st.score[1 - by.team]; if (diff === -1) { o.avantMene[1]++; if (dx > 1) o.avantMene[0]++; } if (diff === 0) { o.avantNul[1]++; if (dx > 1) o.avantNul[0]++; } } }
    }
  }
  return o;
};
const q = (a, x) => { a = [...a].sort((u, v) => u - v); return a.length ? a[Math.floor(x * a.length)] : NaN; };
const E = run(null), P = run('possession'), D = run('direct');
console.log(`${E.n} × 90 min par tactique`);
console.log(`M05-2 distance parcourue 1,0 s après le départ de l'arrêt : p50 ${q(E.r1, 0.5).toFixed(2)} m, p90 ${q(E.r1, 0.9).toFixed(2)} (cible R(1) = 8,8 × (1 − 1,17 (1 − e^(−1/1,17))) = 2,9 m pour une intention pleine ; accel moteur 7,5 → 3,75 m)`);
console.log(`M05-4 changements de cible (> 0,8 m) par joueur et par minute : ${(E.retarget / 20 / E.minutes).toFixed(1)} (cible 12-25 ; < 4 engagement figé, pic > 1,5 Hz oscillation)`);
const pct = (a, b) => (100 * a / Math.max(1, b)).toFixed(1);
console.log(`M06-2 passes vers l'arrière : équilibre ${pct(E.arriere, E.passes)} %, possession ${pct(P.arriere, P.passes)} % (cible 40-42), direct ${pct(D.arriere, D.passes)} % (cible 24-28)`);
console.log(`M06-cal réussite des passes : ${pct(E.ok, E.passes)} % (cible 82,5 ±1,5) ; ballons longs ≥ 32 m : ${pct(E.longues, E.passes)} % (cible 10,5-11,7) ; ${(E.passes / E.n).toFixed(0)} passes / match (réel ≈ 900 pour les deux équipes)`);
console.log(`M06-5 effet de score (10 dernières minutes) : passes vers l'avant mené d'un but ${pct(E.avantMene[0], E.avantMene[1])} % (${E.avantMene[1]}) c. 0-0 ${pct(E.avantNul[0], E.avantNul[1])} % (${E.avantNul[1]}) (cible : écart relatif ≥ 15 %)`);
