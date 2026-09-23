// sonde 288d — POURQUOI LE BALLON PASSE SANS ÊTRE TOUCHÉ (sonde 288c : 33 % des passes au sol perdues sans touche du receveur, le
// ballon à 1,4 m p50). Sur ces échecs : l'approche minimale ≤ 0,85 m (à portée : receiveRadius) / 0,85-1,5 / > 1,5 ; les REFUS
// nommés pendant le vol (st.deny : controle-dos, contrôle-manqué, autres) ; à l'approche minimale : la vitesse et la hauteur du
// ballon, le ballon dans le CÔNE du regard (100°) ou dans le dos, la vitesse du receveur et s'il s'éloigne ; son job (receive ?)
// et la distance de sa cible au point d'approche ; la phase au moment de l'approche (flight / loose / carry).
import { makeMatch, matchStep, matchCfg } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/match-sim.js';
const seeds = (process.argv[2] ?? '3,7').split(',').map(Number), over = JSON.parse(process.argv[3] ?? '{}'), DUR = +(process.argv[4] ?? 2700);
const hyp = Math.hypot, pc = (a, b) => (100 * a / Math.max(1, b)).toFixed(0);
const q = (a, x) => { a = [...a].sort((u, v) => u - v); return a.length ? a[Math.floor(x * a.length)] : NaN; };
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const o = { n: 0, sans: 0, portee: 0, proche: 0, loin: 0, deny: {}, vB: [], hB: [], cone: 0, dos: 0, vR: [], eloigne: 0, jobRec: 0, dTgt: [], phase: {}, denyPortee: {}, coneP: 0, dosP: 0, hP: [], vBP: [], loosePortee: 0 };
for (const seed of seeds) {
  const st = makeMatch({ full: true, seed }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: DUR, pause: 10 }, ...over }); o.n++;
  let seen = 0, pend = null;
  for (let i = 0; i < DUR * 60 * 2.4; i++) {
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break;
    if (pend) { const m = st.players[pend.to]; const dm = hyp(st.ball.p[0] - m.p[0], st.ball.p[2] - m.p[2]);
      if (dm < pend.appro) { pend.appro = dm; const vm = m.v ? hyp(m.v[0], m.v[1]) : 0; const ang = Math.abs(wrap(Math.atan2(st.ball.p[2] - m.p[2], st.ball.p[0] - m.p[0]) - m.yaw)) * 180 / Math.PI;
        pend.at = { vB: hyp(st.ball.v[0], st.ball.v[2]), hB: st.ball.p[1], cone: ang <= 50, vR: vm, eloigne: vm > 1.5 && ((st.ball.p[0] - m.p[0]) * m.v[0] + (st.ball.p[2] - m.p[2]) * m.v[1]) < 0, job: m.job, dTgt: m.target ? hyp(m.target[0] - st.ball.p[0], m.target[2] - st.ball.p[2]) : NaN, phase: st.phase }; }
      for (const k in st.deny ?? {}) { const d = (st.deny[k] ?? 0) - (pend.deny0[k] ?? 0); if (d > 0) pend.denyD[k] = d; } }
    for (; seen < st.events.length; seen++) { const e = st.events[seen];
      if (pend) { if (e.type === 'control' && e.by === pend.to) pend.touche = true; if (e.type === 'turnover' && e.equipe !== pend.team) { fin(pend); pend = null; continue; } continue; }
      if (e.type !== 'pass' || e.clear || e.style === 'une-touche' || e.to < 0 || e.through || e.cross) continue;
      const p = st.players[e.by], m = st.players[e.to]; if (!p || !m) continue;
      pend = { to: e.to, team: p.team, t: st.t, appro: 99, at: null, touche: false, deny0: { ...(st.deny ?? {}) }, denyD: {} }; }
    if (pend) { const dt = st.t - pend.t, car = st.possession.carrier >= 0 ? st.players[st.possession.carrier] : null;
      if (pend.touche && dt > 2 && car && car.team === pend.team) pend = null;
      else if (dt > 4) { if (!pend.touche && !(car && car.team === pend.team)) fin(pend); pend = null; } }
  }
}
function fin(P) { if (P.touche) return; o.sans++; const a = P.at; if (!a) return;
  const port = P.appro <= 0.85; if (port) o.portee++; else if (P.appro <= 1.5) o.proche++; else o.loin++;
  for (const k in P.denyD) { o.deny[k] = (o.deny[k] ?? 0) + 1; if (port) o.denyPortee[k] = (o.denyPortee[k] ?? 0) + 1; }
  o.vB.push(a.vB); o.hB.push(a.hB); if (a.cone) o.cone++; else o.dos++; o.vR.push(a.vR); if (a.eloigne) o.eloigne++; if (a.job === 'receive') o.jobRec++; if (!isNaN(a.dTgt)) o.dTgt.push(a.dTgt); o.phase[a.phase] = (o.phase[a.phase] ?? 0) + 1;
  if (port) { if (a.cone) o.coneP++; else o.dosP++; o.hP.push(a.hB); o.vBP.push(a.vB); if (a.phase === 'loose') o.loosePortee++; } }
const top = (D) => Object.entries(D).sort((a, b) => b[1] - a[1]).slice(0, 7).map(([k, v]) => `${k} ${v}`).join(', ');
console.log(`${o.n} × ${(DUR / 60).toFixed(0)} min ${JSON.stringify(over)} — ${o.sans} passes au sol perdues SANS touche : approche ≤ 0,85 m (À PORTÉE) ${pc(o.portee, o.sans)} %, 0,85-1,5 ${pc(o.proche, o.sans)} %, > 1,5 m ${pc(o.loin, o.sans)} %`);
console.log(`  refus nommés pendant le vol (nombre de passes concernées) : ${top(o.deny)} | à portée : ${top(o.denyPortee)}`);
console.log(`  à l'approche minimale : ballon ${q(o.vB, 0.5).toFixed(1)} m/s p50 (p90 ${q(o.vB, 0.9).toFixed(1)}), hauteur p50 ${q(o.hB, 0.5).toFixed(2)} m (p90 ${q(o.hB, 0.9).toFixed(2)}) ; dans le CÔNE (≤ 50° du regard) ${pc(o.cone, o.cone + o.dos)} %, dans le DOS ${pc(o.dos, o.cone + o.dos)} % ; receveur ${q(o.vR, 0.5).toFixed(1)} m/s p50, s'éloigne ${pc(o.eloigne, o.sans)} % ; job receive ${pc(o.jobRec, o.sans)} % ; cible → ballon p50 ${q(o.dTgt, 0.5).toFixed(1)} m ; phase ${top(o.phase)}`);
console.log(`  à PORTÉE (≤ 0,85 m) : cône ${pc(o.coneP, o.portee)} % / dos ${pc(o.dosP, o.portee)} %, hauteur p50 ${q(o.hP, 0.5).toFixed(2)} m (p90 ${q(o.hP, 0.9).toFixed(2)}), ballon p50 ${q(o.vBP, 0.5).toFixed(1)} m/s (p90 ${q(o.vBP, 0.9).toFixed(1)}), phase loose ${pc(o.loosePortee, o.portee)} %`);
