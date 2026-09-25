// LA TENUE DOS AU PRESSEUR (bouclier.js) DANS LE DUEL : combien, combien de temps, comment elle finit, la vitesse du porteur pendant, la
// distance presseur-ballon. Usage : node bouclier-tenue.mjs [moteur file:// …/engine/] [graines, 16]. Mesuré 2026-09-25, 40 graines × 120 s :
// plantée (hier) vitesse p10 0,00 m/s, le porteur gelait 1-1,7 s (verify-duel graine 2) ; au pas (cfg.bouclier.pas 0,8) p10 0,78, issues voisines.
const E = process.argv[2] || new URL('../../assets/starter/src/engine/', import.meta.url).href;
const { makeDuel, duelCfg } = await import(E + 'duel-1v1.js'); const { matchStep } = await import(E + 'match-sim.js');
const R = { n: 0, issue: {}, dur: [], v: [], gelMax: 0 };
for (const seed of Array.from({ length: Number(process.argv[3] ?? 16) }, (_, i) => i + 1)) { const st = makeDuel({ seed }), cfg = duelCfg(), dt = 1 / 60; let ne = 0; const gel = {};
  for (let i = 0; i < 120 * 60; i++) { matchStep(st, dt, cfg);
    for (const p of st.players) { if (p._bouclier) { R.v.push(p.speed); const q = st.players[p._bouclier.par]; (R.qb ??= []).push(Math.hypot(q.p[0] - st.ball.p[0], q.p[2] - st.ball.p[2])); (R.cb ??= []).push(Math.hypot(p.p[0] - st.ball.p[0], p.p[2] - st.ball.p[2])); } gel[p.id] = (p.speed < 0.05 && !st.restart) ? (gel[p.id] ?? 0) + dt : 0; R.gelMax = Math.max(R.gelMax, gel[p.id]); }
    while (ne < st.events.length) { const e = st.events[ne++]; if (e.type === 'bouclier') { R.n++; const c = st.players[e.by], q = st.players[e.par]; (R.dFin ??= []).push(Math.hypot(c.p[0] - q.p[0], c.p[2] - q.p[2])); R.issue[e.issue] = (R.issue[e.issue] ?? 0) + 1; R.dur.push(e.duree); } } } }
const q = (xs, f) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(f * (s.length - 1))].toFixed(2) : '-'; };
console.log(`boucliers ${R.n} issues ${JSON.stringify(R.issue)} durée p50 ${q(R.dur, .5)} p90 ${q(R.dur, .9)} | vitesse en tenue p10 ${q(R.v, .1)} p50 ${q(R.v, .5)} p90 ${q(R.v, .9)} | presseur à la sortie p50 ${q(R.dFin ?? [], .5)} | presseur-ballon min ${q(R.qb ?? [], 0)} p10 ${q(R.qb ?? [], .1)} | porteur-ballon p90 ${q(R.cb ?? [], .9)}`);
