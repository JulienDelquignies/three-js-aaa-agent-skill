// sonde 288c — LA PASSE QUI N'ARRIVE À PERSONNE : la sonde 288b montre que la moitié des passes perdues (rapides ou posées) le sont
// SANS la touche du receveur et sans interception du presseur. Ici : sur ces échecs, l'APPROCHE minimale ballon → receveur pendant le
// vol (le ballon est-il passé à portée ?), le ballon passé DERRIÈRE la cible (surdosé) ou mort AVANT (sous-dosé), le receveur qui
// s'ÉLOIGNE ou VIENT, le gagnant (le MARQUEUR du receveur à ≤ 3 m à la frappe, un autre), la classe, la distance.
import { makeMatch, matchStep, matchCfg } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/match-sim.js';
const seeds = (process.argv[2] ?? '3,7').split(',').map(Number), over = JSON.parse(process.argv[3] ?? '{}'), DUR = +(process.argv[4] ?? 2700);
const hyp = Math.hypot, pc = (a, b) => (100 * a / Math.max(1, b)).toFixed(0);
const q = (a, x) => { a = [...a].sort((u, v) => u - v); return a.length ? a[Math.floor(x * a.length)] : NaN; };
const o = { n: 0, passes: 0, ok: 0, touche: 0, sans: 0, appro: [], aPortee: 0, sur: 0, sous: 0, eloigne: 0, vient: 0, marqueur: 0, autreG: 0, cls: {}, d: [], dOk: [], vRec: [], gainRec: 0, chase: 0 };
for (const seed of seeds) {
  const st = makeMatch({ full: true, seed }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: DUR, pause: 10 }, ...over }); o.n++;
  let seen = 0, pend = null;
  for (let i = 0; i < DUR * 60 * 2.4; i++) {
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break;
    if (pend) { const m = st.players[pend.to]; const dm = hyp(st.ball.p[0] - m.p[0], st.ball.p[2] - m.p[2]); pend.appro = Math.min(pend.appro, dm);
      const along = ((st.ball.p[0] - pend.from[0]) * pend.u[0] + (st.ball.p[2] - pend.from[2]) * pend.u[1]); pend.alongMax = Math.max(pend.alongMax, along);
      if (m.v && hyp(m.v[0], m.v[1]) > 1.5 && ((st.ball.p[0] - m.p[0]) * m.v[0] + (st.ball.p[2] - m.p[2]) * m.v[1]) > 0) pend.chase++; pend.frames++; }
    for (; seen < st.events.length; seen++) { const e = st.events[seen];
      if (pend) {
        if (e.type === 'control' && e.by === pend.to) pend.touche = true;
        if (e.type === 'turnover' && e.equipe !== pend.team) { fin(pend, false, e); pend = null; continue; }
        continue; }
      if (e.type !== 'pass' || e.clear || e.style === 'une-touche' || e.to < 0 || e.through || e.cross) continue;
      const p = st.players[e.by], m = st.players[e.to]; if (!p || !m) continue;
      const dx = m.p[0] - st.ball.p[0], dz = m.p[2] - st.ball.p[2], d = hyp(dx, dz) || 1;
      const marq = st.players.filter((x) => x.team !== p.team && x.down <= 0).map((x) => [x.id, hyp(x.p[0] - m.p[0], x.p[2] - m.p[2])]).filter(([, dd]) => dd <= 3).map(([id]) => id);
      const vm = m.v ? hyp(m.v[0], m.v[1]) : 0, vers = m.v ? -((m.v[0] * dx + m.v[1] * dz) / (d * (vm || 1))) : 0;   // > 0 : le receveur VIENT au ballon
      pend = { to: e.to, team: p.team, t: st.t, from: [st.ball.p[0], st.ball.p[2]], u: [dx / d, dz / d], d, appro: 99, alongMax: 0, touche: false, marq, vm, vers, cls: e.cls, chase: 0, frames: 0 }; }
    if (pend) { const dt = st.t - pend.t, car = st.possession.carrier >= 0 ? st.players[st.possession.carrier] : null;
      if (pend.touche && dt > 2 && car && car.team === pend.team) { fin(pend, true, null); pend = null; }
      else if (dt > 4) { fin(pend, pend.touche || !!(car && car.team === pend.team), null); pend = null; } }
  }
}
function fin(P, ok, e) { o.passes++; if (ok) { o.ok++; o.dOk.push(P.d); return; } if (P.touche) { o.touche++; return; }
  o.sans++; o.appro.push(P.appro); if (P.appro <= 1.5) o.aPortee++; if (P.alongMax > P.d + 2) o.sur++; else if (P.alongMax < P.d - 2) o.sous++;
  if (P.vers < -0.5 && P.vm > 1.5) o.eloigne++; else if (P.vers > 0.5 && P.vm > 1.5) o.vient++; if (P.chase / Math.max(1, P.frames) > 0.5) o.chase++;
  if (e && P.marq.includes(e.by)) o.marqueur++; else if (e) o.autreG++; (o.cls[P.cls ?? '?'] ??= { n: 0 }).n++; o.d.push(P.d); o.vRec.push(P.vm); }
const top = Object.entries(o.cls).sort((a, b) => b[1].n - a[1].n).slice(0, 5).map(([k, g]) => `${k} ${g.n}`).join(', ');
console.log(`${o.n} × ${(DUR / 60).toFixed(0)} min ${JSON.stringify(over)} — ${o.passes} passes au sol (hors through / centre / dégagement / une-touche) : réussies ${pc(o.ok, o.passes)} %, perdues APRÈS la touche du receveur ${pc(o.touche, o.passes)} %, perdues SANS touche du receveur ${pc(o.sans, o.passes)} % (${o.sans})`);
console.log(`  sur les ${o.sans} sans touche : approche minimale ballon → receveur p50 ${q(o.appro, 0.5).toFixed(1)} m (p25 ${q(o.appro, 0.25).toFixed(1)}, p75 ${q(o.appro, 0.75).toFixed(1)}) ; passées à ≤ 1,5 m ${pc(o.aPortee, o.sans)} % ; SURDOSÉES (ballon > 2 m derrière la cible) ${pc(o.sur, o.sans)} %, SOUS-DOSÉES (mort > 2 m avant) ${pc(o.sous, o.sans)} %`);
console.log(`  le receveur : s'ÉLOIGNE ${pc(o.eloigne, o.sans)} %, VIENT ${pc(o.vient, o.sans)} % (vitesse p50 ${q(o.vRec, 0.5).toFixed(1)} m/s) ; court APRÈS le ballon plus de la moitié du vol ${pc(o.chase, o.sans)} % ; le gagnant est le MARQUEUR du receveur (≤ 3 m à la frappe) ${pc(o.marqueur, o.sans)} %, un autre ${pc(o.autreG, o.sans)} %`);
console.log(`  distance des perdues sans touche p50 ${q(o.d, 0.5).toFixed(1)} m (réussies p50 ${q(o.dOk, 0.5).toFixed(1)}) ; classes : ${top}`);
