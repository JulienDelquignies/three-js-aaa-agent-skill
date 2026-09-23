// sonde 288 — LES PASSES RAPIDES APRÈS CONTRÔLE (le levier nommé au 287 : 42-45 / match, réussite 49-53 % c. 53-59 % posées ; la sonde
// du 287 a montré que l'ANGLE du ballon reçu n'explique PAS le déficit — > 135° réussit le mieux). Ici la dissection : par délai depuis
// la prise (0-0,2 / 0,2-0,4 / 0,4-0,6 | 0,6-1 / 1-2 / > 2 s), par PRESSION du passeur (adversaire le plus proche < 2 / 2-4 / > 4 m), par
// LIBERTÉ du receveur (< 2 / 2-4 / > 4 m), par distance (< 8 / 8-15 / > 15 m), par sens (arrière / latérale / avant), par |bearing|
// (le ballon devant le corps ou de côté à la frappe), par classe (P_succ prédit c. réalisé), et le HOLD du porteur.
import { makeMatch, matchStep, matchCfg } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/match-sim.js';
const seeds = (process.argv[2] ?? '3,7').split(',').map(Number), over = JSON.parse(process.argv[3] ?? '{}'), DUR = +(process.argv[4] ?? 2700);
const hyp = Math.hypot, pc = (a, b) => (100 * a / Math.max(1, b)).toFixed(0), mk = () => ({ n: 0, ok: 0, pS: 0 });
const DT = ['0-0,2', '0,2-0,4', '0,4-0,6', '0,6-1', '1-2', '> 2 s'], P3 = ['< 2', '2-4', '> 4 m'], D3 = ['< 8', '8-15', '> 15 m'], S3 = ['arrière', 'latérale', 'avant'], BR = ['|bearing| < 30°', '30-60°', '> 60°'];
const o = { n: 0, rapide: mk(), lente: mk(), dt: DT.map(mk), rP: P3.map(mk), lP: P3.map(mk), rL: P3.map(mk), lL: P3.map(mk), rD: D3.map(mk), lD: D3.map(mk), rS: S3.map(mk), lS: S3.map(mk), rB: BR.map(mk), lB: BR.map(mk), rC: {}, lC: {}, rBr: [], lBr: [] };
const b3 = (x, a, b) => (x < a ? 0 : x < b ? 1 : 2);
for (const seed of seeds) {
  const st = makeMatch({ full: true, seed }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: DUR, pause: 10 }, ...over }); o.n++;
  let seen = 0, pend = null; const ctrl = {};
  for (let i = 0; i < DUR * 60 * 2.4; i++) {
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break;
    if (pend) { const dt = st.t - pend.t, car = st.possession.carrier >= 0 ? st.players[st.possession.carrier] : null, own = st.ball.owner != null ? st.players[st.ball.owner] : (car && st.phase === 'carry' ? car : null);
      if (own && own.id === pend.to) pend.touche = true;
      let res = null;
      if (own && own.team !== pend.team && dt > 0.1) res = false; else if (pend.touche && dt > 2 && own && own.team === pend.team) res = true; else if (st.restart && dt > 0.2) res = !!pend.touche; else if (dt > 4) res = !!pend.touche || !!(own && own.team === pend.team);
      if (res != null) { pend.slots.forEach((g) => { g.n++; if (res) g.ok++; g.pS += pend.pS ?? 0; }); pend = null; } }
    for (; seen < st.events.length; seen++) { const e = st.events[seen]; if (e.type === 'control' && !e.miss) { ctrl[e.by] = st.t; continue; } if (e.type !== 'pass' || pend || e.clear || e.style === 'une-touche' || e.to < 0) continue;
      const p = st.players[e.by], m = st.players[e.to]; if (!p || !m) continue;
      const g = st.pitch.attackGoal(p.team), s = Math.sign(g.x || 1), c = ctrl[p.id], dtc = c != null ? st.t - c : 99, rapide = dtc < 0.6;
      const dx = m.p[0] - p.p[0], dz = m.p[2] - p.p[2], d = hyp(dx, dz);
      const foeP = Math.min(...st.players.filter((x) => x.team !== p.team && x.down <= 0 && !x.keeper).map((x) => hyp(x.p[0] - p.p[0], x.p[2] - p.p[2])), 99);
      const foeM = Math.min(...st.players.filter((x) => x.team !== p.team && x.down <= 0).map((x) => hyp(x.p[0] - m.p[0], x.p[2] - m.p[2])), 99);
      const sens = dx * s < -2 ? 0 : dx * s > 2 ? 2 : 1, br = Math.abs(e.bearing ?? 0), brI = b3(br, 30, 60);
      const slots = [rapide ? o.rapide : o.lente, o.dt[dtc < 0.2 ? 0 : dtc < 0.4 ? 1 : dtc < 0.6 ? 2 : dtc < 1 ? 3 : dtc < 2 ? 4 : 5], (rapide ? o.rP : o.lP)[b3(foeP, 2, 4)], (rapide ? o.rL : o.lL)[b3(foeM, 2, 4)], (rapide ? o.rD : o.lD)[b3(d, 8, 15)], (rapide ? o.rS : o.lS)[sens], (rapide ? o.rB : o.lB)[brI]];
      if (e.cls) { const C = rapide ? o.rC : o.lC; slots.push(C[e.cls] ??= mk()); }
      (rapide ? o.rBr : o.lBr).push(br);
      pend = { by: p.id, to: e.to, team: p.team, t: st.t, slots, touche: false, pS: e.pSucc }; }
  }
}
const n = o.n, R = (g) => `${pc(g.ok, g.n)} % (${g.n})`, RP = (g) => `${pc(g.ok, g.n)} % de ${g.n} (prédit ${pc(g.pS, g.n)})`;
const q = (a, x) => { a = [...a].sort((u, v) => u - v); return a.length ? a[Math.floor(x * a.length)] : NaN; };
console.log(`${n} × ${(DUR / 60).toFixed(0)} min ${JSON.stringify(over)} — passes RAPIDES après contrôle (< 0,6 s) ${(o.rapide.n / n).toFixed(0)} / match : ${RP(o.rapide)} c. posées ${RP(o.lente)}`);
console.log(`  par délai depuis la prise : ${DT.map((b, i) => `${b} ${R(o.dt[i])}`).join(' ; ')}`);
console.log(`  PRESSION du passeur — rapides : ${P3.map((b, i) => `${b} ${R(o.rP[i])}`).join(' ; ')} | posées : ${P3.map((b, i) => `${b} ${R(o.lP[i])}`).join(' ; ')}`);
console.log(`  LIBERTÉ du receveur — rapides : ${P3.map((b, i) => `${b} ${R(o.rL[i])}`).join(' ; ')} | posées : ${P3.map((b, i) => `${b} ${R(o.lL[i])}`).join(' ; ')}`);
console.log(`  DISTANCE — rapides : ${D3.map((b, i) => `${b} ${R(o.rD[i])}`).join(' ; ')} | posées : ${D3.map((b, i) => `${b} ${R(o.lD[i])}`).join(' ; ')}`);
console.log(`  SENS — rapides : ${S3.map((b, i) => `${b} ${R(o.rS[i])}`).join(' ; ')} | posées : ${S3.map((b, i) => `${b} ${R(o.lS[i])}`).join(' ; ')}`);
console.log(`  BEARING à la frappe — rapides : ${BR.map((b, i) => `${b} ${R(o.rB[i])}`).join(' ; ')} (p50 ${q(o.rBr, 0.5).toFixed(0)}°) | posées : ${BR.map((b, i) => `${b} ${R(o.lB[i])}`).join(' ; ')} (p50 ${q(o.lBr, 0.5).toFixed(0)}°)`);
const top = (C) => Object.entries(C).sort((a, b) => b[1].n - a[1].n).slice(0, 5).map(([k, g]) => `${k} ${RP(g)}`).join(' ; ');
console.log(`  CLASSES — rapides : ${top(o.rC)} | posées : ${top(o.lC)}`);
