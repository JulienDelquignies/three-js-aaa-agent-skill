// La conduite planifiée, sans rendu : par touche, le mode (contact / fin / lent) ; après une touche planifiée, la suivante tient-elle le
// rendez-vous (même pied, à ±0,1 s) ; sinon pourquoi (le porteur a changé de vitesse / de cap, le ballon a été repris au servo, perdu…).
const E = decodeURI(new URL('../../../../examples/showcase/src/engine/', import.meta.url).pathname);
const { makeDuel, duelCfg } = await import(E + 'duel-1v1.js'); const { matchStep } = await import(E + 'match-sim.js');
const modes = {}, suites = {}; let n = 0;
for (const seed of [1, 2, 3, 4, 5, 6]) {
  const st = makeDuel({ seed }), cfg = duelCfg(), dt = 1 / 60; let ne = 0, last = null;
  for (let i = 0; i < 120 * 60; i++) { matchStep(st, dt, cfg);
    while (ne < st.events.length) { const e = st.events[ne++]; if (e.type !== 'touche') continue; n++;
      const c = st.players[e.by], k = `${e.pas ?? '-'}${c.speed >= 1 ? '' : ' (<1 m/s)'}`; modes[k] = (modes[k] ?? 0) + 1;
      if (last && last.by === e.by && st.t - last.t < 2) { const s = `${last.pas}→${e.pas} ${e.foot === last.foot ? 'même pied' : 'autre pied'}`; suites[s] = (suites[s] ?? 0) + 1; }
      last = { by: e.by, t: st.t, pas: e.pas, foot: e.foot, owner: st.ball.owner };
    }
    if (last && st.phase !== 'carry') last = null;
  }
}
console.log(n, 'touches (6 graines × 120 s)'); console.log('modes', modes); console.log('enchaînements', Object.entries(suites).sort((a, b) => b[1] - a[1]).slice(0, 12));
