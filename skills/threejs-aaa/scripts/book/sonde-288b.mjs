// sonde 288b — LES MODES D'ÉCHEC des passes rapides après contrôle (< 0,6 s) c. posées : interception par le PRESSEUR du passeur (le
// gagnant était à ≤ 2,5 m du passeur à la frappe), interception par un AUTRE, contrôle MANQUÉ du receveur, ballon repris APRÈS la
// touche du receveur (tackle / récupération), sortie ; le tout aussi pour la classe BACK_SAFE et pour |bearing| > 60°.
import { makeMatch, matchStep, matchCfg } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/match-sim.js';
const seeds = (process.argv[2] ?? '3,7').split(',').map(Number), over = JSON.parse(process.argv[3] ?? '{}'), DUR = +(process.argv[4] ?? 2700);
const hyp = Math.hypot, pc = (a, b) => (100 * a / Math.max(1, b)).toFixed(0);
const M = ['presseur', 'autre-intercepte', 'controle-manque', 'repris-apres-touche', 'sortie', 'autre'], mk = () => ({ n: 0, ok: 0, m: M.map(() => 0), dPres: [] });
const o = { n: 0, r: mk(), l: mk(), rB: mk(), lB: mk(), rBr: mk(), lBr: mk(), rP: mk(), lP: mk() };
for (const seed of seeds) {
  const st = makeMatch({ full: true, seed }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: DUR, pause: 10 }, ...over }); o.n++;
  let seen = 0, pend = null; const ctrl = {};
  for (let i = 0; i < DUR * 60 * 2.4; i++) {
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break;
    for (; seen < st.events.length; seen++) { const e = st.events[seen];
      if (e.type === 'control' && !e.miss) ctrl[e.by] = st.t;
      if (pend) {
        if (e.type === 'control' && e.by === pend.to && e.miss) pend.miss = true;
        if (e.type === 'control' && e.by === pend.to && !e.miss) pend.touche = true;
        if (e.type === 'turnover' && e.equipe !== pend.team) { const w = st.players[e.by]; const dP = w ? hyp(w.p[0] - pend.pP[0], w.p[2] - pend.pP[2]) : 99; const dw = pend.foeAt[e.by] ?? 99;
          const mode = e.why === 'out' ? 4 : pend.touche ? 3 : pend.miss ? 2 : e.why === 'interception' ? (dw <= 2.5 ? 0 : 1) : (dw <= 2.5 ? 0 : 5);
          pend.slots.forEach((g) => { g.n++; g.m[mode]++; if (mode === 0) g.dPres.push(dw); }); pend = null; continue; }
        continue; }
      if (e.type !== 'pass' || e.clear || e.style === 'une-touche' || e.to < 0) continue;
      const p = st.players[e.by], m = st.players[e.to]; if (!p || !m) continue;
      const c = ctrl[p.id], dtc = c != null ? st.t - c : 99, rapide = dtc < 0.6, br = Math.abs(e.bearing ?? 0);
      const foeAt = {}; for (const x of st.players) if (x.team !== p.team) foeAt[x.id] = hyp(x.p[0] - p.p[0], x.p[2] - p.p[2]);
      const pres = Math.min(...Object.entries(foeAt).filter(([id]) => !st.players[id].keeper).map(([, d]) => d), 99);
      const slots = [rapide ? o.r : o.l]; if (e.cls === 'BACK_SAFE') slots.push(rapide ? o.rB : o.lB); if (br > 60) slots.push(rapide ? o.rBr : o.lBr); if (pres < 2) slots.push(rapide ? o.rP : o.lP);
      pend = { to: e.to, team: p.team, t: st.t, pP: [p.p[0], p.p[2]], foeAt, slots, touche: false, miss: false }; }
    if (pend) { const dt = st.t - pend.t, car = st.possession.carrier >= 0 ? st.players[st.possession.carrier] : null;
      if (pend.touche && dt > 2 && car && car.team === pend.team) { pend.slots.forEach((g) => { g.n++; g.ok++; }); pend = null; }
      else if (dt > 4) { pend.slots.forEach((g) => { g.n++; if (pend.touche || (car && car.team === pend.team)) g.ok++; else g.m[5]++; }); pend = null; } }
  }
}
const q = (a, x) => { a = [...a].sort((u, v) => u - v); return a.length ? a[Math.floor(x * a.length)] : NaN; };
const R = (g) => `${pc(g.ok, g.n)} % de ${g.n} — échecs : ${M.map((k, i) => `${k} ${g.m[i]}`).join(', ')}${g.dPres.length ? ` (presseur à p50 ${q(g.dPres, 0.5).toFixed(1)} m)` : ''}`;
console.log(`${o.n} × ${(DUR / 60).toFixed(0)} min ${JSON.stringify(over)} — RAPIDES après contrôle : ${R(o.r)}`);
console.log(`  posées : ${R(o.l)}`);
console.log(`  BACK_SAFE rapides : ${R(o.rB)}`);
console.log(`  BACK_SAFE posées : ${R(o.lB)}`);
console.log(`  |bearing| > 60° rapides : ${R(o.rBr)}`);
console.log(`  |bearing| > 60° posées : ${R(o.lBr)}`);
console.log(`  presseur < 2 m rapides : ${R(o.rP)}`);
console.log(`  presseur < 2 m posées : ${R(o.lP)}`);
