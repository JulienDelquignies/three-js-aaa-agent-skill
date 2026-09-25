const E = decodeURI(new URL('../../../../examples/showcase/src/engine/', import.meta.url).pathname);
const { makeDuel, duelCfg } = await import(E + 'duel-1v1.js'); const { matchStep } = await import(E + 'match-sim.js');
const cas = {}; let n = 0;
for (const seed of [1, 2, 3, 4, 5, 6]) { const st = makeDuel({ seed }), cfg = duelCfg(), dt = 1 / 60; let ne = 0; const prev = {};
  for (let i = 0; i < 120 * 60; i++) { matchStep(st, dt, cfg);
    while (ne < st.events.length) { const e = st.events[ne++]; if (e.type !== 'touche') continue; const c = st.players[e.by];
      if (e.pas === 'fin') { n++; const pv = prev[e.by], dtp = pv ? st.t - pv.t : 99, yr = Math.abs(c._pas?.yawRate ?? 0);
        const k = `${yr >= 1 ? 'virage' : 'droit'} | précédente ${dtp > 1.5 ? 'aucune (>1,5 s)' : pv.pas} | rdv ${e.rdvEcart == null ? 'aucun' : e.rdvEcart > 0.15 ? 'dépassé' : e.rdvEcart < -0.2 ? 'trop tôt' : 'à l\'heure'}${e.rdvPied && e.rdvPied !== e.foot ? ' (autre pied)' : ''}`; cas[k] = (cas[k] ?? 0) + 1; }
      prev[e.by] = { t: st.t, pas: e.pas }; } } }
console.log(n, 'touches « fin »'); for (const [k, v] of Object.entries(cas).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(3)}  ${k}`);
