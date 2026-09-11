// sonde 263 — le pas de décision séparé du pas physique (Modèle 01 test 3 : « simuler à Δt_dec 0,05 et 0,10, mêmes tactiques —
// D_KS < 0,03 sur buts, tirs, passes réussies, durée de possession ; un décalage de moyenne > 5 % prouve des constantes en ticks »).
// Une variante par exécution (le pas physique fixe, 1/60 par défaut) : tirs, passes, conservées, buts, plongeons, hors-jeu, durée
// de possession d'équipe, appels du cerveau par seconde, CPU par pas ; les durées de possession se déposent en JSON pour le D_KS
// entre variantes (ks-263.mjs). usage : node sonde-263.mjs [graines] [over JSON] [durée s] [dt physique] [json de sortie]
import { makeMatch, matchStep, matchCfg } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/match-sim.js';
import { writeFileSync } from 'node:fs';
const seeds = (process.argv[2] ?? '3,7').split(',').map(Number), over = JSON.parse(process.argv[3] ?? '{}'), DUR = +(process.argv[4] ?? 2700), dt = process.argv[5] ? eval(process.argv[5]) : 1 / 60, out = process.argv[6];
const q = (a, x) => { a = [...a].sort((u, v) => u - v); return a.length ? a[Math.floor(x * a.length)] : NaN; }, moy = (a) => a.length ? a.reduce((u, v) => u + v, 0) / a.length : NaN;
const r = { tirs: 0, passes: 0, gardees: 0, buts: 0, plongeons: 0, hj: 0, poss: [], us: [], dec: 0, t: 0, parMatch: [] };
for (const seed of seeds) {
  const st = makeMatch({ full: true, seed }), cfg = matchCfg({ shotRange: 20, ...over });
  let appels = 0; const base = cfg.assignJobs; cfg.assignJobs = (s, c) => { appels++; return base(s, c); };
  let n0 = 0, enVol = null, pTeam = -1, p0 = 0, tirs = 0, passes = 0, gardees = 0; const n = Math.round(DUR / dt);
  for (let i = 0; i < n; i++) {
    const t0 = process.hrtime.bigint(); matchStep(st, dt, cfg); r.us.push(Number(process.hrtime.bigint() - t0) / 1000);
    for (; n0 < st.events.length; n0++) { const e = st.events[n0]; if (e.type === 'shot') tirs++; if (e.type === 'dive') r.plongeons++; if (e.type === 'hors-jeu') r.hj++; if (e.type === 'pass' && e.to >= 0) { passes++; enVol = { team: st.players[e.by].team, to: e.to }; } }
    if (enVol && st.phase !== 'flight' && st.possession.team >= 0 && st.ball.owner != null) { if (st.possession.team === enVol.team) gardees++; enVol = null; }
    const pt = st.restart ? -1 : st.possession.team;
    if (pt !== pTeam) { if (pTeam >= 0) r.poss.push(+(st.t - p0).toFixed(3)); pTeam = pt; p0 = st.t; }
  }
  const buts = (st.score?.[0] ?? 0) + (st.score?.[1] ?? 0);
  r.dec += cfg.cadence ? (st._decN ?? 0) : appels; r.tirs += tirs; r.passes += passes; r.gardees += gardees; r.buts += buts; r.t += DUR; r.parMatch.push({ seed, tirs, passes, gardees, buts });
}
const M = seeds.length * DUR / 5400;
console.log(`dt 1/${Math.round(1 / dt)} ${JSON.stringify(over)} ${seeds.length} × ${DUR / 60} min : tirs ${(r.tirs / M).toFixed(1)} / 90, passes ${(r.passes / M).toFixed(0)}, conservées ${(100 * r.gardees / Math.max(1, r.passes)).toFixed(1)} %, buts ${(r.buts / M).toFixed(1)} / 90, plongeons ${(r.plongeons / M).toFixed(1)}, hors-jeu ${(r.hj / M).toFixed(1)}, possession d'équipe p50 ${q(r.poss, 0.5).toFixed(1)} s (n ${r.poss.length}), cerveau ${(r.dec / r.t).toFixed(1)} appels/s, CPU p50 ${q(r.us, 0.5).toFixed(0)} µs / p99 ${q(r.us, 0.99).toFixed(0)} — ${(moy(r.us) * (1 / dt) * 5400 / 1e6).toFixed(0)} s par match ; par match ${r.parMatch.map((m) => `${m.seed}: ${m.tirs} t / ${m.passes} p / ${m.gardees} g / ${m.buts} b`).join(', ')}`);
if (out) writeFileSync(out, JSON.stringify({ over, dt, poss: r.poss, parMatch: r.parMatch, tirs: r.tirs, passes: r.passes, gardees: r.gardees, buts: r.buts }));
