const E = decodeURI(new URL('../../../../examples/showcase/src/engine/', import.meta.url).pathname);
const { makeDuel, duelCfg } = await import(E + 'duel-1v1.js'); const { matchStep } = await import(E + 'match-sim.js');
const deny = {}, skills = {};
for (const seed of [1, 2, 3, 4, 5, 6]) { const st = makeDuel({ seed }), cfg = duelCfg(), dt = 1 / 60; let ne = 0;
  for (let i = 0; i < 120 * 60; i++) { matchStep(st, dt, cfg); while (ne < st.events.length) { const e = st.events[ne++]; if (e.type === 'skill') skills[e.kind] = (skills[e.kind] ?? 0) + 1; } }
  for (const [k, v] of Object.entries(st.deny ?? {})) deny[k] = (deny[k] ?? 0) + v; }
console.log('gestes (6 × 120 s) :', skills);
console.log('refus nommés (top 40) :'); for (const [k, v] of Object.entries(deny).sort((a, b) => b[1] - a[1]).slice(0, 40)) console.log(`  ${k.padEnd(40)} ${v}`);
const cfg = duelCfg(); console.log('clés skill :', Object.keys(cfg.skill ?? {}).join(' ').slice(0, 1500));
