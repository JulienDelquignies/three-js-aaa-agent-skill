// sonde 289f — LES EFFETS DE BORD DE LA PRESSION LUE : la part des passes frappées PRESSÉ (le réel StatsBomb : ~55 passes sous pression
// par équipe et par match, ~12 % des passes), la tenue des porteurs LIBRES (le 211 : le libre porte, réel 2-4 s) et des pressés, et le
// seuil franchi (P au moment de la passe).
import { makeMatch, matchStep, matchCfg } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/match-sim.js';
import { presseLueDe } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/presse-lue.js';
import { tac } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/tactics.js';
const seeds = (process.argv[2] ?? '3,7').split(',').map(Number), over = JSON.parse(process.argv[3] ?? '{}'), DUR = +(process.argv[4] ?? 2700);
const pc = (a, b) => (b ? (100 * a / b).toFixed(1) : '—'), q = (a, x) => { a = [...a].sort((u, v) => u - v); return a.length ? a[Math.min(a.length - 1, Math.floor(x * a.length))] : NaN; };
const O = { matchs: 0, passes: 0, presses: 0, tLibre: [], tPresse: [], P: [] };
for (const seed of seeds) {
  const st = makeMatch({ full: true, seed }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: DUR, pause: 10 }, ...over }); O.matchs++;
  const K = matchCfg({}).presseLue; let seen = 0; const pris = {};
  for (let i = 0; i < DUR * 60 * 2.4; i++) {
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break;
    for (; seen < st.events.length; seen++) { const e = st.events[seen];
      if ((e.type === 'control' || e.type === 'receive' || e.type === 'loose-kept') && e.by != null) pris[e.by] = st.t;
      if (e.type !== 'pass' || e.clear || e.mains || !(e.to >= 0)) continue; const c = st.players[e.by]; if (!c || c.keeper) continue;
      const L = presseLueDe(st, c, K, cfg, tac(st, c.team).tempo); O.passes++; O.P.push(L.P); if (L.presse) O.presses++;
      if (pris[e.by] != null) (L.presse ? O.tPresse : O.tLibre).push(st.t - pris[e.by]); }
  }
}
const n = O.matchs;
console.log(`${n} matchs ${JSON.stringify(over)} — ${O.passes} passes de champ : frappées PRESSÉ (P ≥ seuil, lu à la frappe) ${pc(O.presses, O.passes)} % = ${(O.presses / n / 2).toFixed(0)} par équipe et par match (réel ~55, ~12 %) ; P p50 ${q(O.P, 0.5).toFixed(2)}, p75 ${q(O.P, 0.75).toFixed(2)}`);
console.log(`  tenue réception → frappe : libres p25/p50/p75 ${q(O.tLibre, 0.25).toFixed(2)}/${q(O.tLibre, 0.5).toFixed(2)}/${q(O.tLibre, 0.75).toFixed(2)} s ; pressés ${q(O.tPresse, 0.25).toFixed(2)}/${q(O.tPresse, 0.5).toFixed(2)}/${q(O.tPresse, 0.75).toFixed(2)} s`);
