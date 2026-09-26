// LE DUEL FACE À FACE, ENTIER (sans navigateur, moteur STARTER) — le chantier « face-à-face au pas » façon Taarabt. Un DUEL commence quand le
// porteur de champ, ballon au pied (≤ 0,7 m), a le défenseur de champ DEVANT lui (≤ 55°) à ≤ 3,5 m ; il dure — gestes compris — jusqu'à
// son issue : BATTU (le défenseur finit derrière le porteur, > 110°, ou à > 4 m derrière), PERDU (la balle change de camp), TIR, ou ÉTEINT
// (le défenseur à > 5 m sans être battu). Pour chaque duel : la durée, la distance ballon-défenseur tenue (médiane), l'oscillation latérale du
// porteur dans l'axe du défenseur (p90 − p10), l'allure du porteur (médiane), le nombre de gestes ENCHAÎNÉS, le défenseur qui s'engage
// (tacle, pique, glissé) et qui tombe. Cibles : Headrick (thèse QUT, 1c1 de jeunes) — distance ballon-défenseur au face-à-face stable
// 1,15-1,69 m, atteint en ~2,1 s ; durée du 1c1 3,3 s (risque) à 5,0 s (prudent) ; oscillation latérale de l'attaquant 0,6-0,9 m ;
// Taarabt (vidéo de référence) : 2-4 feintes par duel, le porteur quasi arrêté, le défenseur qui se jette et tombe.
// Usage : node duel-face.mjs [graines=8] [secondes=120] [cle=JSON …]
import { makeDuel, duelCfg } from '../../assets/starter/src/engine/duel-1v1.js';
import { matchStep } from '../../assets/starter/src/engine/match-sim.js';
const [NG = '8', SECS = '120', ...KV] = process.argv.slice(2);
const over = Object.fromEntries(KV.map((s) => { const i = s.indexOf('='); return [s.slice(0, i), JSON.parse(s.slice(i + 1))]; }));
const q = (xs, f) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(f * (s.length - 1))] : NaN; };
const brg = (c, p) => { const a = Math.atan2(p[2] - c.p[2], p[0] - c.p[0]) - c.yaw; return Math.abs(((a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI) * 180 / Math.PI; };
const D = [], FA = [];   // FA : les face-à-face au pas (face.js), de l'entrée à la fin — et les 2 s qui suivent (le ballon gardé ? le défenseur passé ?)
for (let seed = 1; seed <= Number(NG); seed++) {
  const base = duelCfg(), cfg = duelCfg({ ...over, ...(over.dribble1c1 ? { dribble1c1: { ...base.dribble1c1, ...over.dribble1c1 } } : {}) }), st = makeDuel({ seed }), dt = 1 / 60;
  let ne = 0, du = null;
  const clore = (issue) => { if (du && st.t - du.t0 >= 0.2) D.push({ ...du, issue, dur: st.t - du.t0 }); du = null; };
  for (let i = 0; i < Number(SECS) * 60; i++) {
    matchStep(st, dt, cfg);
    const evs = []; while (ne < st.events.length) evs.push(st.events[ne++]);
    const car = st.players[st.possession?.carrier ?? -1];
    for (const e of evs) { if (e.type === 'face' && e.phase === 'fin') FA.push({ ...e, seed, suite: null, tFin: st.t }); if (e.type === 'geste' && e.face) (FA.feintes ??= 0), FA.feintes++; }
    for (const f of FA) if (f.seed === seed && f.suite == null && st.t - f.tFin > 0) { const c = st.players[f.by], q = st.players[f.par], g = st.pitch.attackGoal(c.team);
      const perdu = st.possession?.team !== undefined ? (st.players[st.possession.carrier ?? -1]?.team ?? (st.phase === 'loose' ? null : c.team)) : null;
      if (car && car.team !== c.team) f.suite = 'perdu'; else if (evs.some((e) => e.type === 'shot' && e.by === c.id)) f.suite = 'tir';
      else if (((q.p[0] - c.p[0]) * (g.x - c.p[0]) + (q.p[2] - c.p[2]) * -c.p[2]) < -1.5 * Math.hypot(g.x - c.p[0], c.p[2])) f.suite = 'passé';
      else if (st.t - f.tFin > 2) f.suite = 'tenu'; void perdu; }
    if (du) {
      for (const e of evs) { if (e.by === du.by && (e.type === 'skill' || (e.type === 'windup' && e.skill))) du.gestes.push(e.skill ?? e.kind); if (/^(duel|slide|tacle-pique)$/.test(e.type) && e.by === du.def && e.kind !== 'aérien') du.engage++; if (e.type === 'chute' && e.by === du.def) du.chute++; }
      { const def = st.players[du.def], m = (def._bite ?? -1) > st.t; if (m && !du.mord0) du.mords++; du.mord0 = m; }
      if (evs.some((e) => e.type === 'shot' && e.by === du.by)) { clore('tir'); continue; }
      const def = st.players[du.def];
      if (!car || car.team !== st.players[du.by].team || st.phase === 'loose' && st.lastTouch !== st.players[du.by].team) { clore('perdu'); continue; }
      const c = st.players[du.by], dd = Math.hypot(def.p[0] - c.p[0], def.p[2] - c.p[2]), g = st.pitch.attackGoal(c.team), gx = g.x - c.p[0], gz = -c.p[2], gl = Math.hypot(gx, gz) || 1;
      const along = ((def.p[0] - c.p[0]) * gx + (def.p[2] - c.p[2]) * gz) / gl;   // le défenseur devant (+) ou derrière (−) le porteur, vers le but
      if (along < -1.5 || (brg(c, def.p) > 110 && dd > 1.2)) { clore('BATTU'); continue; }
      if (dd > 5) { clore('éteint'); continue; }
      if (car === c) { du.bd.push(Math.hypot(def.p[0] - st.ball.p[0], def.p[2] - st.ball.p[2])); du.v.push(c.speed); du.lat.push((-(c.p[0] - du.ref[0]) * du.u[1] + (c.p[2] - du.ref[1]) * du.u[0])); }
      continue;
    }
    if (!car || car.keeper || st.phase !== 'carry' || st.restart) continue;
    if (Math.hypot(st.ball.p[0] - car.p[0], st.ball.p[2] - car.p[2]) > 0.7) continue;
    const def = st.players.find((p) => p.team !== car.team && !p.keeper); if (!def || def.down > 0) continue;
    const dd = Math.hypot(def.p[0] - car.p[0], def.p[2] - car.p[2]);
    if (dd <= 3.5 && brg(car, def.p) <= 55) { const ux = (def.p[0] - car.p[0]) / dd, uz = (def.p[2] - car.p[2]) / dd; du = { by: car.id, def: def.id, t0: st.t, ref: [car.p[0], car.p[2]], u: [ux, uz], bd: [], v: [], lat: [], gestes: [], engage: 0, chute: 0, mords: 0, mord0: false }; }
  }
}
const m = (X, f, d = 2) => X.length ? `${q(X.map(f), 0.5).toFixed(d)} [${q(X.map(f), 0.1).toFixed(d)}–${q(X.map(f), 0.9).toFixed(d)}]` : '—';
const pc = (n) => (100 * n / Math.max(1, D.length)).toFixed(0) + ' %';
const iss = {}; for (const x of D) iss[x.issue] = (iss[x.issue] ?? 0) + 1;
console.log(`${D.length} duels face à face (${(D.length / (Number(NG) * Number(SECS) / 60)).toFixed(1)}/min) — issues : ${Object.entries(iss).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pc(v)}`).join(', ')}`);
console.log(`  durée ${m(D, (x) => x.dur, 1)} s (réf. 3,3-5,0) ; distance ballon-défenseur tenue ${m(D.filter((x) => x.bd.length), (x) => q(x.bd, 0.5))} m (réf. 1,15-1,69) ; oscillation latérale ${m(D.filter((x) => x.lat.length > 5), (x) => q(x.lat, 0.9) - q(x.lat, 0.1))} m (réf. 0,6-0,9) ; allure du porteur ${m(D.filter((x) => x.v.length), (x) => q(x.v, 0.5), 1)} m/s`);
console.log(`  gestes enchaînés par duel ${m(D, (x) => x.gestes.length, 0)} (Taarabt 2-4) — ${[0, 1, 2, 3].map((k) => `${k}${k === 3 ? '+' : ''} : ${pc(D.filter((x) => (k === 3 ? x.gestes.length >= 3 : x.gestes.length === k)).length)}`).join(', ')} ; le défenseur s'engage dans ${pc(D.filter((x) => x.engage).length)} des duels, tombe dans ${pc(D.filter((x) => x.chute).length)}, mord (au moins une fois) dans ${pc(D.filter((x) => x.mords).length)}`);
const G = {}; for (const x of D) for (const g of x.gestes) G[g] = (G[g] ?? 0) + 1; console.log(`  gestes : ${Object.entries(G).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}`);
{ const fins = {}, fen = {}, sui = {}; for (const f of FA) { fins[f.issue] = (fins[f.issue] ?? 0) + 1; if (f.fente) fen[f.fente] = (fen[f.fente] ?? 0) + 1; sui[f.suite ?? '?'] = (sui[f.suite ?? '?'] ?? 0) + 1; }
  const p2 = (n) => (100 * n / Math.max(1, FA.length)).toFixed(0) + ' %', q2 = (f, d = 1) => `${q(FA.map(f), 0.5).toFixed(d)} [${q(FA.map(f), 0.1).toFixed(d)}–${q(FA.map(f), 0.9).toFixed(d)}]`;
  console.log(`FACE-À-FACE AU PAS : ${FA.length} (${(FA.length / (Number(NG) * Number(SECS) / 60)).toFixed(1)}/min) — fins : ${Object.entries(fins).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${p2(v)}`).join(', ')}`);
  console.log(`  durée ${q2((f) => f.duree)} s ; feintes ${q2((f) => f.feintes, 0)} (${FA.feintes ?? 0} en tout) ; morsures ${q2((f) => f.mords, 0)} ; fentes : ${Object.entries(fen).map(([k, v]) => `${k} ${v}`).join(', ') || '—'} ; dans les 2 s : ${Object.entries(sui).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${p2(v)}`).join(', ')}`); }
