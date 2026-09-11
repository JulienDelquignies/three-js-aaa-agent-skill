// sonde 262 — la couche de croyance : (1) test 1 du Modèle 04 : l'erreur du passeur sur son receveur (|vrai − cru| à la frappe) par tranche d'ÂGE de la croyance — non nulle, croissante ; (2) le prix : passes conservées, tirs, buts ; (3) le marqueur : distance à son homme p50/p90 ; (4) la sonde d'attribut : scanning/vision 90 c. 10 sur les passes conservées.
import { makeMatch, matchStep, matchCfg } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/match-sim.js';
const seeds = (process.argv[2] ?? '3,7').split(',').map(Number), over = JSON.parse(process.argv[3] ?? '{}'), DUR = +(process.argv[4] ?? 2700), squads = process.argv[5] ? JSON.parse(process.argv[5]) : null;
const bins = [[0, 0.3], [0.3, 1], [1, 2.5], [2.5, 99]], E = bins.map(() => []), S = bins.map(() => []);
let passes = 0, gardees = 0, tirs = 0, buts = 0, n = 0; const dM = [];
for (const seed of seeds) {
  const st = makeMatch({ full: true, seed, ...(squads ? { squads: [Array.from({ length: 11 }, () => ({ ratings: squads })), []] } : {}) }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: DUR, pause: 10 }, ...over }); n++;
  let n0 = 0, enVol = null;
  for (let i = 0; i < DUR * 60 + 600; i++) {
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break;
    for (; n0 < st.events.length; n0++) { const e = st.events[n0]; if (e.type === 'pass' && e.to >= 0) { passes++; enVol = { team: st.players[e.by].team, to: e.to }; if (e.croyAge != null) { const b = bins.findIndex(([a, c]) => e.croyAge >= a && e.croyAge < c); if (b >= 0) { E[b].push(e.croyErr); S[b].push(e.croySigma); } } } if (e.type === 'shot') tirs++; if (e.type === 'but' || e.type === 'goal') buts++; }
    if (enVol && st.phase !== 'flight' && st.possession.team >= 0 && st.ball.owner != null) { if (st.possession.team === enVol.team) gardees++; enVol = null; }
    if (i % 30 === 0 && st._bAssign) for (const [id, m] of st._bAssign) { const q = st.players[id]; if (q && m) dM.push(Math.hypot(q.p[0] - m.p[0], q.p[2] - m.p[2])); }
  }
  buts += 0; const sc = st.score ?? [0, 0]; buts = buts || 0;
}
const q = (a, x) => { a = [...a].sort((u, v) => u - v); return a.length ? a[Math.floor(x * a.length)] : NaN; }, moy = (a) => a.length ? a.reduce((u, v) => u + v, 0) / a.length : NaN;
console.log(`${n} × ${DUR / 60} min ${JSON.stringify(over)}${squads ? ' ' + JSON.stringify(squads) : ''} — passes ${passes} (${(passes / n).toFixed(0)} / match), conservées ${(100 * gardees / Math.max(1, passes)).toFixed(1)} % ; tirs ${(tirs / n).toFixed(1)} / match ; marqueur → homme p50 ${q(dM, 0.5).toFixed(2)} p90 ${q(dM, 0.9).toFixed(2)} m`);
console.log('erreur du passeur sur le receveur par âge de la croyance (n, err moyenne m, σ crue moyenne) : ' + bins.map(([a, c], k) => `[${a};${c === 99 ? '∞' : c}[ ${E[k].length} / ${moy(E[k]).toFixed(2)} / ${moy(S[k]).toFixed(2)}`).join(' ; '));
