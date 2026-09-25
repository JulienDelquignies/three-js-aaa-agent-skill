const E = decodeURI(new URL('../../../../examples/showcase/src/engine/', import.meta.url).pathname);
const { makeDuel, duelCfg } = await import(E + 'duel-1v1.js'); const { matchStep } = await import(E + 'match-sim.js');
for (const pas of [false, true]) { const tot = { buts: 0, tirs: 0, touches: 0, carry: 0, pertes: 0, duels: 0, gestes: 0, piques: 0 };
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) { const st = makeDuel({ seed }), cfg = duelCfg({ pas }), dt = 1 / 60; let ne = 0, carrierPrev = -1;
    for (let i = 0; i < 120 * 60; i++) { matchStep(st, dt, cfg); if (st.phase === 'carry') tot.carry += dt;
      while (ne < st.events.length) { const e = st.events[ne++]; if (e.type === 'touche') tot.touches++; if (e.type === 'but' || e.type === 'goal') tot.buts++; if (/tir|shot/.test(e.type)) tot.tirs++; if (e.type === 'duel') tot.duels++; if (e.type === 'skill') tot.gestes++; if (e.type === 'tacle-pique') tot.piques++; }
      const cr = st.phase === 'carry' ? st.players[st.possession.carrier]?.team : -1; if (carrierPrev >= 0 && cr >= 0 && cr !== carrierPrev) tot.pertes++; if (cr >= 0) carrierPrev = cr; }
    tot.buts2 = (tot.buts2 ?? 0) + st.score[0] + st.score[1]; }
  console.log(`pas ${pas} (8 graines × 120 s) :`, JSON.stringify({ ...tot, carry: +tot.carry.toFixed(0) })); }
