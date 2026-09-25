const E = decodeURI(new URL('../../../../examples/showcase/src/engine/', import.meta.url).pathname);
const { makeDuel, duelCfg } = await import(E + 'duel-1v1.js'); const { matchStep } = await import(E + 'match-sim.js');
const paires = {}, ex = [];
for (const seed of [1, 2, 3, 4]) { const st = makeDuel({ seed }), cfg = duelCfg(), dt = 1 / 60; let ne = 0; const der = {};
  for (let i = 0; i < 120 * 60; i++) { matchStep(st, dt, cfg);
    while (ne < st.events.length) { const e = st.events[ne++]; if (e.type !== 'touche' || !e.foot) continue; const c = st.players[e.by], k = `${e.by}${e.foot}`;
      if (der[k] && c._pas && st.t - der[k].t < 0.5 * c._pas.T) { const key = `${der[k].pas}→${e.pas}`; paires[key] = (paires[key] ?? 0) + 1; if (ex.length < 8) ex.push({ seed, t: +st.t.toFixed(2), dt: +(st.t - der[k].t).toFixed(3), T: +c._pas.T.toFixed(2), v: +c.speed.toFixed(1), key, owner: st.ball.owner }); }
      der[k] = { t: st.t, pas: e.pas ?? '-' }; } } }
console.log(paires); for (const x of ex) console.log(JSON.stringify(x));
