// LE RYTHME DU PORTEUR (sans navigateur, moteur STARTER) — « pas assez de changements de vitesse ». Pendant chaque possession d'un joueur de champ :
// la vitesse du corps image par image — sa répartition (arrêt < 1, marche 1-2, trot 2-4, course 4-6, sprint > 6 m/s), les CHANGEMENTS D'ALLURE
// (une variation de ≥ 1,5 m/s en ≤ 0,6 s, montée ou descente : l'accélération / le freinage francs), les accélérations au-delà de 3 m/s² (et leur
// cause : _pace — sortie de geste, départ — ou la course voulue), la vitesse au plus haut par possession, et la même chose pour le défenseur.
// Usage : node rythme.mjs [graines=16] [s=120] [cle=JSON …]
import { makeDuel, duelCfg } from '../../assets/starter/src/engine/duel-1v1.js';
import { matchStep } from '../../assets/starter/src/engine/match-sim.js';
const [NG = '16', SECS = '120', ...KV] = process.argv.slice(2);
const over = Object.fromEntries(KV.map((s) => { const i = s.indexOf('='); return [s.slice(0, i), JSON.parse(s.slice(i + 1))]; }));
const q = (xs, f) => { const s = [...xs].filter((x) => x != null && !isNaN(x)).sort((a, b) => a - b); return s.length ? s[Math.floor(f * (s.length - 1))] : NaN; };
const m = (xs, d = 2) => `${q(xs, 0.5).toFixed(d)} [${q(xs, 0.1).toFixed(d)}–${q(xs, 0.9).toFixed(d)}]`;
const R = { car: { v: [], chg: 0, up: 0, down: 0, T: 0, acc: 0, pace: {}, vmax: [] }, def: { v: [], chg: 0, up: 0, down: 0, T: 0, acc: 0, pace: {}, vmax: [] } };
const ALL = [];
for (let seed = 1; seed <= Number(NG); seed++) {
  const st = makeDuel({ seed }), cfg = duelCfg(over); const H = {}; let prevCar = -1, curMax = 0, ne = 0; const RO = [];
  for (let i = 0; i < Number(SECS) * 60; i++) {
    matchStep(st, 1 / 60, cfg);
    while (ne < st.events.length) { const e = st.events[ne++]; if (e.type === 'skill' && e.kind === 'rythme') { const p = st.players[e.by]; RO.push({ by: e.by, t0: st.t, v0: p.speed, vMin: p.speed, vMax: 0, tMin: 0, tRel: null, mord: null, d0: e.foe, suite: null, def: st.players.find((x) => x.team !== p.team && !x.keeper).id }); } }
    for (const o of RO) { if (o.suite) continue; const p = st.players[o.by], d = st.players[o.def], A = p.act?.payload;
      if (A?.skill === 'rythme') { if (p.speed < o.vMin) { o.vMin = p.speed; o.tMin = st.t - o.t0; } if (o.tRel == null && A.foulee.beats.some((b) => b.type === 'touche' && b.joue)) o.tRel = st.t - o.t0; if (o.mord == null && (d._bite ?? -1) > st.t) o.mord = true; }
      if (o.tRel != null && st.t - o.t0 - o.tRel < 1.2) o.vMax = Math.max(o.vMax, p.speed);
      const car2 = st.players[st.possession?.carrier ?? -1], g = st.pitch.attackGoal(p.team);
      if (car2 && car2.team !== p.team) o.suite = 'perdu'; else if (st.events.slice(-4).some((e) => e.type === 'shot' && e.by === p.id)) o.suite = 'tir';
      else if (((d.p[0] - p.p[0]) * (g.x - p.p[0]) + (d.p[2] - p.p[2]) * -p.p[2]) < -1.0 * Math.hypot(g.x - p.p[0], p.p[2])) o.suite = 'passé';
      else if (st.t - o.t0 > 2.5) o.suite = 'gardé'; }
    const cid = st.possession?.carrier ?? -1, c = st.players[cid];
    if (cid !== prevCar) { if (prevCar >= 0 && curMax > 0) R.car.vmax.push(curMax); curMax = 0; prevCar = cid; for (const k in H) delete H[k]; }
    if (!c || c.keeper || st.phase !== 'carry' || st.restart) continue;
    const d = st.players.find((x) => x.team !== c.team && !x.keeper);
    for (const [role, p] of [['car', c], ['def', d]]) { const Rr = R[role], h = (H[role] ??= []); h.push({ t: st.t, v: p.speed }); while (h.length && st.t - h[0].t > 0.6) h.shift();
      Rr.v.push(p.speed); Rr.T += 1 / 60; if (role === 'car') curMax = Math.max(curMax, p.speed);
      // un changement d'allure : dans la fenêtre de 0,6 s, l'écart max-min ≥ 1,5 m/s — compté une fois (réarmé quand la fenêtre retombe sous 0,5)
      const vs = h.map((x) => x.v), amp = Math.max(...vs) - Math.min(...vs), iMax = vs.indexOf(Math.max(...vs)), iMin = vs.indexOf(Math.min(...vs));
      if (amp >= 1.5 && !h.arme) { h.arme = true; Rr.chg++; if (iMax > iMin) Rr.up++; else Rr.down++; } else if (amp < 0.5) h.arme = false;
      if (h.length > 2) { const a = (h[h.length - 1].v - h[h.length - 3].v) / (h[h.length - 1].t - h[h.length - 3].t); if (a > 3) { Rr.acc += 1 / 60; const k = p._pace && p._pace.until > st.t ? p._pace.kind ?? 'pace' : p.act ? 'geste' : 'course'; Rr.pace[k] = (Rr.pace[k] ?? 0) + 1; } } }
  }
  ALL.push(...RO);
}
const pc = (a, b) => (100 * a / Math.max(1e-9, b)).toFixed(0) + ' %';
for (const [role, Rr] of Object.entries(R)) { const min = Rr.T / 60, bands = [[0, 1, 'arrêt'], [1, 2, 'marche'], [2, 4, 'trot'], [4, 6, 'course'], [6, 99, 'sprint']];
  console.log(`${role === 'car' ? 'PORTEUR' : 'DÉFENSEUR'} (${min.toFixed(1)} min de conduite) : vitesse ${m(Rr.v, 1)} m/s — ${bands.map(([a, b, n]) => `${n} ${pc(Rr.v.filter((v) => v >= a && v < b).length, Rr.v.length)}`).join(', ')}`);
  console.log(`  changements d'allure (≥ 1,5 m/s en ≤ 0,6 s) : ${(Rr.chg / min).toFixed(1)}/min (accélérations ${(Rr.up / min).toFixed(1)}, freinages ${(Rr.down / min).toFixed(1)}) ; accélération > 3 m/s² ${pc(Rr.acc, Rr.T)} du temps — ${Object.entries(Rr.pace).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}${role === 'car' ? ` ; vitesse au plus haut par possession ${m(Rr.vmax, 1)} m/s` : ''}`); }
if (ALL.length) { const tally = (Y, f) => { const T = {}; for (const o of Y) { const k = f(o); T[k] = (T[k] ?? 0) + 1; } return Object.entries(T).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pc(v, Y.length)}`).join(', '); };
  console.log(`FEINTES D'ARRÊT (maybeRythme) : ${ALL.length} (${(ALL.length / (R.car.T / 60)).toFixed(2)}/min de conduite) — allure ${m(ALL.map((o) => o.v0), 1)} → au plus bas ${m(ALL.map((o) => o.vMin), 1)} (à +${m(ALL.map((o) => o.tMin))} s) → relance à +${m(ALL.filter((o) => o.tRel != null).map((o) => o.tRel))} s → au plus haut ${m(ALL.filter((o) => o.tRel != null).map((o) => o.vMax), 1)} m/s ; défenseur à ${m(ALL.map((o) => o.d0))} m ; mordu ${pc(ALL.filter((o) => o.mord).length, ALL.length)} ; à +2,5 s : ${tally(ALL, (o) => o.suite ?? '?')}`); }
