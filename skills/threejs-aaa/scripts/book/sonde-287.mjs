// sonde 287 — LES PASSES EN UNE TOUCHE (retour du 17/09 : « la plupart du temps elles ne sont pas dans des bons angles, elles ne ciblent
// pas les bons joueurs et sont souvent ratées ») : par match, les une-touche (part des passes), leur RÉUSSITE (reçue par un coéquipier)
// contre celle des passes après contrôle, par ANGLE DE DÉVIATION (l'angle entre le ballon qui arrive et la passe qui part : 0-45 / 45-90 /
// 90-135 / > 135°), par VITESSE d'arrivée, la CIBLE (distance, adversaire le plus proche de la cible, de face ou dans le dos du regard,
// vers l'avant ou l'arrière), pressée ou calme — la sonde du lot 287.
import { makeMatch, matchStep, matchCfg } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/match-sim.js';
const seeds = (process.argv[2] ?? '3,7').split(',').map(Number), over = JSON.parse(process.argv[3] ?? '{}'), DUR = +(process.argv[4] ?? 2700);
const hyp = Math.hypot, q = (a, x) => { a = [...a].sort((u, v) => u - v); return a.length ? a[Math.floor(x * a.length)] : NaN; }, pc = (a, b) => (100 * a / Math.max(1, b)).toFixed(0);
const B = ['0-45°', '45-90°', '90-135°', '> 135°'], mk = () => ({ n: 0, ok: 0 });
const o = { n: 0, ut: mk(), deux: mk(), rapide: mk(), rapideAngle: B.map(mk), rapideDev: [], lente: mk(), angle: B.map(mk), vit: [mk(), mk(), mk()], calme: mk(), presse: mk(), dos: mk(), face: mk(), arriere: mk(), avant: mk(), cibleFoe: [], cibleFoePerdu: [], d: [], dev: [], arr: [] };
for (const seed of seeds) {
  const st = makeMatch({ full: true, seed }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: DUR, pause: 10 }, ...over }); o.n++;
  let seen = 0, prevV = [0, 0], pend = null; const ctrl = {};
  for (let i = 0; i < DUR * 60 * 2.4; i++) {
    const vAv = [st.ball.v[0], st.ball.v[2]];
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break;
    if (pend) { const dt = st.t - pend.t, car = st.possession.carrier >= 0 ? st.players[st.possession.carrier] : null, own = st.ball.owner != null ? st.players[st.ball.owner] : (car && st.phase === 'carry' ? car : null);
      if (own && own.id === pend.to) pend.touche = true;
      let res = null;
      if (own && own.team !== pend.team && dt > 0.1) res = false; else if (pend.touche && dt > 2 && own && own.team === pend.team) res = true; else if (st.restart && dt > 0.2) res = !!pend.touche; else if (dt > 4) res = !!pend.touche || !!(own && own.team === pend.team);
      if (res != null) { pend.slots.forEach((g) => { g.n++; if (res) g.ok++; }); if (!res) o.cibleFoePerdu.push(pend.foe); pend = null; } }
    for (; seen < st.events.length; seen++) { const e = st.events[seen]; if (e.type === 'control' && !e.miss) { ctrl[e.by] = { t: st.t, v: [prevV[0], prevV[1]] }; continue; } if (e.type !== 'pass' || pend) continue; const p = st.players[e.by], m = st.players[e.to]; if (!p || !m || p.keeper) continue;
      const g = st.pitch.attackGoal(p.team), s = Math.sign(g.x || 1), ut = e.style === 'une-touche';
      const dx = m.p[0] - p.p[0], dz = m.p[2] - p.p[2], d = hyp(dx, dz) || 1, arr = hyp(prevV[0], prevV[1]);
      const dev = arr > 0.5 ? Math.acos(Math.max(-1, Math.min(1, (dx * prevV[0] + dz * prevV[1]) / (d * arr)))) * 180 / Math.PI : 0;
      const foe = Math.min(...st.players.filter((x) => x.team !== p.team && x.down <= 0).map((x) => hyp(x.p[0] - m.p[0], x.p[2] - m.p[2])), 99);
      const slots = [ut ? o.ut : o.deux]; const c = ctrl[p.id]; if (!ut && c && st.t - c.t < 0.6) { const ca = hyp(c.v[0], c.v[1]), dv = ca > 0.5 ? Math.acos(Math.max(-1, Math.min(1, (dx * c.v[0] + dz * c.v[1]) / (d * ca)))) * 180 / Math.PI : 0; slots.push(o.rapide, o.rapideAngle[dv < 45 ? 0 : dv < 90 ? 1 : dv < 135 ? 2 : 3]); o.rapideDev.push(dv); } else if (!ut) slots.push(o.lente);
      if (ut) { slots.push(o.angle[dev < 45 ? 0 : dev < 90 ? 1 : dev < 135 ? 2 : 3], o.vit[arr < 6 ? 0 : arr < 9 ? 1 : 2], e.calme ? o.calme : o.presse, (dx * Math.cos(p.yaw) + dz * Math.sin(p.yaw)) > 0 ? o.face : o.dos, dx * s < -1 ? o.arriere : o.avant); o.cibleFoe.push(foe); o.d.push(d); o.dev.push(dev); o.arr.push(arr); }
      pend = { by: p.id, to: e.to, team: p.team, t: st.t, slots, foe, touche: false }; }
    prevV = vAv;
  }
}
const n = o.n, R = (g) => `${pc(g.ok, g.n)} % (${g.n})`;
console.log(`${n} × ${(DUR / 60).toFixed(0)} min ${JSON.stringify(over)} — passes en UNE TOUCHE ${(o.ut.n / n).toFixed(0)} / match = ${pc(o.ut.n, o.ut.n + o.deux.n)} % des passes (réel 15-25) ; réussite ${R(o.ut)} contre ${R(o.deux)} après contrôle`);
console.log(`  par angle de déviation : ${B.map((b, i) => `${b} ${R(o.angle[i])}`).join(' ; ')} — déviation p50 ${q(o.dev, 0.5).toFixed(0)}° p90 ${q(o.dev, 0.9).toFixed(0)}°`);
console.log(`  par vitesse d'arrivée : < 6 m/s ${R(o.vit[0])} ; 6-9 ${R(o.vit[1])} ; ≥ 9 ${R(o.vit[2])} — arrivée p50 ${q(o.arr, 0.5).toFixed(1)} m/s`);
console.log(`  calme ${R(o.calme)} c. pressée ${R(o.presse)} ; cible DE FACE ${R(o.face)} c. dans le DOS ${R(o.dos)} ; vers l'avant ${R(o.avant)} c. l'arrière ${R(o.arriere)} ; distance p50 ${q(o.d, 0.5).toFixed(1)} m`);
console.log(`  la CIBLE : adversaire le plus proche p50 ${q(o.cibleFoe, 0.5).toFixed(1)} m (p25 ${q(o.cibleFoe, 0.25).toFixed(1)}) ; sur les une-touche PERDUES p50 ${q(o.cibleFoePerdu, 0.5).toFixed(1)} m`);
console.log(`  les passes RAPIDES après contrôle (frappées < 0,6 s après la prise) : ${(o.rapide.n / n).toFixed(0)} / match, réussite ${R(o.rapide)} c. ${R(o.lente)} pour les passes posées ; par angle entre le ballon reçu et la passe : ${B.map((b, i) => `${b} ${R(o.rapideAngle[i])}`).join(' ; ')} — angle p50 ${q(o.rapideDev, 0.5).toFixed(0)}° p90 ${q(o.rapideDev, 0.9).toFixed(0)}°`);
