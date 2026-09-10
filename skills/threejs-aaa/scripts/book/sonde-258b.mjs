// sonde 258b — le corps qui contre : à chaque tir, la géométrie des défenseurs (au corps < 3 m devant, dans le couloir de tir < 1,5 m sur 5 m) et les contres ; le délai armé → frappe.
import { makeMatch, matchStep, matchCfg } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/match-sim.js';
const seeds = (process.argv[2] ?? '3,7,11,13').split(',').map(Number), over = JSON.parse(process.argv[3] ?? '{}'), DUR = +(process.argv[4] ?? 2700);
const o = { n: 0, shots: 0, contres: 0, devant3: 0, couloir: 0, couloirEtContre: 0, devantEtContre: 0, nDevant: [], dLane: [], windupDelay: [], contreDist: [], buts: 0, cadres: 0 };
for (const seed of seeds) {
  const st = makeMatch({ full: true, seed }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: 2700, pause: 10 }, ...over }); o.n++;
  let seen = 0; const pend = []; const windups = new Map();
  for (let i = 0; i < DUR * 60; i++) {
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break;
    for (; seen < st.events.length; seen++) { const e = st.events[seen]; const by = st.players[e.by];
      if (e.type === 'windup' && by && !by.keeper) windups.set(e.by, st.t);
      if (e.type === 'shot' && by) { o.shots++; const g = st.pitch.ownGoal(1 - by.team); const ux = g.x - by.p[0], uz = (e.tz ?? 0) - by.p[2], ul = Math.hypot(ux, uz) || 1; let nd = 0, lane = false, dl = 99;
        for (const q of st.players) { if (q.team === by.team || q.keeper || q.down > 0) continue; const dx = q.p[0] - by.p[0], dz = q.p[2] - by.p[2]; const along = (dx * ux + dz * uz) / ul, perp = Math.abs(dx * uz - dz * ux) / ul; const d = Math.hypot(dx, dz); if (d < 3 && along > 0) nd++; if (along > 0 && along < 5 && perp < 1.5) { lane = true; dl = Math.min(dl, perp); } }
        o.nDevant.push(nd); if (nd > 0) o.devant3++; if (lane) { o.couloir++; o.dLane.push(dl); } const w = windups.get(e.by); if (w != null) o.windupDelay.push(st.t - w);
        pend.push({ t: st.t, team: by.team, nd, lane, done: false }); }
      const last = pend.slice().reverse().find((w) => !w.done && st.t - w.t < 3);
      if (e.type === 'contre' && last) { o.contres++; last.done = true; if (last.lane) o.couloirEtContre++; if (last.nd > 0) o.devantEtContre++; const q = st.players[e.by], s = st.players[e.sur]; if (q && s) o.contreDist.push(Math.hypot(q.p[0] - s.p[0], q.p[2] - s.p[2])); }
      if (e.type === 'but' && last && e.team === last.team) { o.buts++; o.cadres++; last.done = true; }
      if (e.type === 'arrêt' && last && st.players[e.by]?.team !== last.team) { o.cadres++; last.done = true; }
    }
  }
}
const q = (a, x) => { a = [...a].sort((u, v) => u - v); return a.length ? a[Math.floor(x * a.length)] : NaN; }; const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN; const n = o.n; const pct = (a, b) => (100 * a / Math.max(1, b)).toFixed(1);
console.log(`${n} × ${(DUR / 60).toFixed(0)} min ${JSON.stringify(over)} — tirs ${o.shots} (${(o.shots / n).toFixed(1)} / match), contrés ${pct(o.contres, o.shots)} % (réel 27), cadrés ${pct(o.cadres, o.shots)} %, buts ${o.buts}`);
console.log(`défenseur(s) à < 3 m devant le tireur à la frappe : ${pct(o.devant3, o.shots)} % des tirs (moyenne ${mean(o.nDevant).toFixed(2)} corps) ; un corps dans le couloir (< 1,5 m de la ligne, 0-5 m devant) : ${pct(o.couloir, o.shots)} % (écart p50 ${q(o.dLane, 0.5).toFixed(2)} m)`);
console.log(`contres : ${o.contres} dont couloir occupé ${o.couloirEtContre}, corps devant ${o.devantEtContre} ; distance contreur → tireur p50 ${q(o.contreDist, 0.5).toFixed(1)} m ; délai armé → frappe p50 ${q(o.windupDelay, 0.5).toFixed(2)} s (${o.windupDelay.length})`);
