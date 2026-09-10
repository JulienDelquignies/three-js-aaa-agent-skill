// sonde 253 — la pausa : fenêtres du porteur où le ballon (< 1 m/s) et le corps (< 1,5 m/s) sont quasi immobiles (0,6-2,5 s, ≥ 1,5 s = pausa au sens du book, 3-6 par match), la tenue au lâcher (st.hold), la zone, les adversaires engagés et les courses en cours pendant ces fenêtres.
import { makeMatch, matchStep, matchCfg } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/match-sim.js';
const seeds = (process.argv[2] ?? '3,7').split(',').map(Number), over = JSON.parse(process.argv[3] ?? '{}'), DUR = +(process.argv[4] ?? 5400);
const o = { n: 0, issues: {}, durIssue: {}, vPausa: [], vBallPausa: [], fen: [], holds: [], pausas: 0, pausaEv: 0, pausaDur: [], engages: [], courses: [], zone: {} };
const q = (a, x) => { a = [...a].sort((u, v) => u - v); return a.length ? a[Math.floor(x * a.length)] : NaN; };
for (const seed of seeds) {
  const st = makeMatch({ full: true, seed }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: 2700, pause: 10 }, ...over }); o.n++;
  let seen = 0, win = null, lastCarrier = -1, lastHold = 0;
  for (let i = 0; i < DUR * 60; i++) {
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break;
    const c = st.possession.carrier >= 0 && st.phase === 'carry' ? st.players[st.possession.carrier] : null;
    if (c) { lastCarrier = c.id; lastHold = st.hold; }
    else if (lastCarrier >= 0) { o.holds.push(lastHold); lastCarrier = -1; }
    if (c && c._pausa) { o.vPausa.push(Math.hypot(c.v[0], c.v[1])); o.vBallPausa.push(Math.hypot(st.ball.v[0], st.ball.v[2])); }
    const still = c && !c.keeper && Math.hypot(st.ball.v[0], st.ball.v[2]) < 1.0 && Math.hypot(c.v[0], c.v[1]) < 1.5 && !st.restart;
    if (still && (!win || win.id !== c.id)) { const sgn = -st.pitch.ownGoal(c.team).sign; const adv = (c.p[0] * sgn + st.pitch.hx) / (2 * st.pitch.hx) * 100;
      let eng = 0; for (const d of st.players) { if (d.team === c.team || d.keeper) continue; const dx = st.ball.p[0] - d.p[0], dz = st.ball.p[2] - d.p[2], dl = Math.hypot(dx, dz) || 1; if ((d.v[0] * dx + d.v[1] * dz) / dl > 2.0) eng++; }
      const courses = st.players.filter((m) => m.team === c.team && m.id !== c.id && (m._runT ?? -1) > st.t).length;
      win = { id: c.id, t0: st.t, adv, eng, courses }; }
    if (!still && win) { const d = st.t - win.t0; if (d >= 0.6 && d <= 2.5) { o.fen.push(d); if (d >= 1.5) { o.pausas++; o.engages.push(win.eng); o.courses.push(win.courses); const z = win.adv < 33 ? 'bas' : win.adv < 66 ? 'milieu' : 'haut'; o.zone[z] = (o.zone[z] ?? 0) + 1; } } win = null; }
    for (; seen < st.events.length; seen++) { const e = st.events[seen]; if (e.type === 'pausa') { o.pausaEv++; if (e.duree != null) o.pausaDur.push(e.duree); o.issues[e.issue] = (o.issues[e.issue] ?? 0) + 1; (o.durIssue[e.issue] ??= []).push(e.duree); } }
  }
}
const n = o.n, f = (x) => (x / n).toFixed(2);
console.log(`${n} × ${(DUR / 60).toFixed(0)} min ${JSON.stringify(over)} — fenêtres immobiles du porteur 0,6-2,5 s : ${f(o.fen.length)} / match (p50 ${q(o.fen, 0.5).toFixed(2)} s) ; PAUSAS (≥ 1,5 s) ${f(o.pausas)} / match (réel 3-6 de 1,5-3,5 s) — zone ${JSON.stringify(o.zone)}, adversaires engagés p50 ${q(o.engages, 0.5)}, courses en cours p50 ${q(o.courses, 0.5)} ; événements pausa ${f(o.pausaEv)} (durée p50 ${q(o.pausaDur, 0.5).toFixed(2)} s)`);
console.log(`issues des pausas : ${JSON.stringify(o.issues)} ; durée p50 par issue : ${Object.entries(o.durIssue).map(([k, a]) => k + ' ' + q(a, 0.5).toFixed(2)).join(', ')} ; vitesse du porteur pendant la pausa p50 ${q(o.vPausa, 0.5).toFixed(2)} m/s (p90 ${q(o.vPausa, 0.9).toFixed(2)}), ballon p50 ${q(o.vBallPausa, 0.5).toFixed(2)}`);
console.log(`tenue du porteur au lâcher (st.hold) : p10 ${q(o.holds, 0.1).toFixed(2)} p50 ${q(o.holds, 0.5).toFixed(2)} p90 ${q(o.holds, 0.9).toFixed(2)} s (${o.holds.length} possessions)`);
