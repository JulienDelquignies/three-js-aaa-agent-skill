// Le répertoire du 1c1 dans la cage : quels gestes partent (dans la foulée ou non), la vitesse du corps pendant, le ballon gardé 1,5 s après.
const E = decodeURI(new URL('../../../../examples/showcase/src/engine/', import.meta.url).pathname);
const { makeDuel, duelCfg } = await import(E + 'duel-1v1.js'); const { matchStep } = await import(E + 'match-sim.js');
const R = {}, errs = [];
for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) { const st = makeDuel({ seed }), cfg = duelCfg(), dt = 1 / 60; let ne = 0; const open = {}, garde = [];
  try { for (let i = 0; i < 120 * 60; i++) { matchStep(st, dt, cfg);
    while (ne < st.events.length) { const e = st.events[ne++]; if (e.type !== 'skill' || /-vendu|-end/.test(e.kind)) continue; const k = `${e.kind}${e.foulee ? ' (foulée' + (e.chasseur ? ', chasseur' : '') + ')' : ''}`;
      (R[k] ??= { n: 0, vMin: [], garde: 0, dur: [] }).n++; open[e.by] = { k, vs: [], t0: st.t }; garde.push({ by: e.by, k, t: st.t + 1.5, ev0: st.events.length }); }
    for (const [id, o] of Object.entries(open)) { const p = st.players[id]; if (p.act?.payload?.kind === 'skill') o.vs.push(p.speed); else { if (o.vs.length) { R[o.k].vMin.push(Math.min(...o.vs)); R[o.k].dur.push(st.t - o.t0); } delete open[id]; } }
    for (let g = garde.length - 1; g >= 0; g--) if (st.t >= garde[g].t) { const x = garde[g]; if (st.phase === "carry" && st.possession.carrier === x.by || st.ball.owner === x.by || st.events.slice(x.ev0).some((e) => e.type === "shot" && e.by === x.by)) R[x.k].garde++; else { const evs = st.events.slice(x.ev0).map((e) => e.type + (e.by != null ? (e.by === x.by ? '(lui)' : '(adv)') : '')).filter((t) => !/touche|windup|skill|burst/.test(t)); (R[x.k].pertes ??= []).push(`${st.phase}: ${[...new Set(evs)].join(',')}`); } garde.splice(g, 1); } } } catch (e) { errs.push(`graine ${seed} : ${e.message}`); } }
const q = (xs, f) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(f * (s.length - 1))] : NaN; };
for (const [k, r] of Object.entries(R).sort((a, b) => b[1].n - a[1].n)) console.log(`${k.padEnd(34)} ${String(r.n).padStart(3)}  corps au plus bas p50 ${q(r.vMin, 0.5).toFixed(1)} m/s  durée p50 ${q(r.dur, 0.5).toFixed(2)} s  gardé ou tir à +1,5 s ${(100 * r.garde / r.n).toFixed(0)} %`);
for (const [k, r] of Object.entries(R)) if (r.pertes) console.log(`  ${k} — perdus : ${r.pertes.slice(0, 5).join(' | ')}`);
console.log(errs.length ? errs : 'aucune erreur');
