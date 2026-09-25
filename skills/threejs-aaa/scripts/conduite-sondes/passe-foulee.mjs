const E = decodeURI(new URL('../../../../examples/showcase/src/engine/', import.meta.url).pathname);
const { makeDuel, duelCfg } = await import(E + 'duel-1v1.js'); const { matchStep } = await import(E + 'match-sim.js');
const res = { foulee: 0, cale: 0, crochet: 0, vendu: 0, vMin: [], vMoy: [], ballonMax: [], perdus: 0 };
for (const seed of [1, 2, 3, 4, 5, 6]) { const st = makeDuel({ seed }), cfg = duelCfg(), dt = 1 / 60; let ne = 0; const open = {};
  for (let i = 0; i < 120 * 60; i++) { matchStep(st, dt, cfg);
    while (ne < st.events.length) { const e = st.events[ne++]; if (e.type === 'skill' && e.kind === 'passement') { if (e.foulee) res.foulee++; else res.cale++; open[e.by] = { vs: [], bm: 0, foulee: !!e.foulee }; } if (e.type === 'skill' && e.kind === 'crochet') res.crochet++; if (e.type === 'skill' && e.kind === 'passement-vendu') res.vendu++; }
    for (const [id, o] of Object.entries(open)) { const p = st.players[id]; if (p.act?.payload?.skill === 'passement') { o.vs.push(p.speed); o.bm = Math.max(o.bm, Math.hypot(st.ball.p[0] - p.p[0], st.ball.p[2] - p.p[2])); } else { if (o.foulee && o.vs.length) { res.vMin.push(Math.min(...o.vs)); res.vMoy.push(o.vs.reduce((a, b) => a + b, 0) / o.vs.length); res.ballonMax.push(o.bm); if (st.ball.owner !== +id && st.possession.carrier !== +id) res.perdus++; } delete open[id]; } } } }
const f = (a) => a.length ? `${Math.min(...a).toFixed(1)}…${Math.max(...a).toFixed(1)} (p50 ${[...a].sort((x, y) => x - y)[a.length >> 1].toFixed(2)})` : '-';
console.log(`passements dans la foulée ${res.foulee}, calés ${res.cale}, vendus ${res.vendu}, crochets ${res.crochet} | vitesse pendant : min ${f(res.vMin)}, moyenne ${f(res.vMoy)} | ballon au plus loin ${f(res.ballonMax)} m | perdus au bout ${res.perdus}`);
