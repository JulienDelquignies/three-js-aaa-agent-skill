// sonde 289c — L'ANATOMIE DE LA DÉPOSSESSION (sonde 289b : ~45 tacles piqués réussis par équipe et par match, ~90 dépossessions au
// total contre 20-25 au réel — la passe n'a pas le temps de naître). À chaque pique / duel gagné sur un porteur : depuis combien de
// temps il tenait le ballon, sa vitesse, l'écart pied-ballon (la touche de conduite), depuis combien de temps un adversaire était à
// ≤ 3 m (le presseur VISIBLE), s'il avait une INTENTION de passe adoptée (et depuis quand), les refus nommés dans la seconde d'avant
// (pourquoi la passe n'est pas partie), le tiers ; et le TEMPS DE TENUE des passes jouées (réception → frappe) pour comparaison.
import { makeMatch, matchStep, matchCfg } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/match-sim.js';
const seeds = (process.argv[2] ?? '3,7').split(',').map(Number), over = JSON.parse(process.argv[3] ?? '{}'), DUR = +(process.argv[4] ?? 2700);
const hyp = Math.hypot, pc = (a, b) => (b ? (100 * a / b).toFixed(1) : '—'), q = (a, x) => { a = [...a].sort((u, v) => u - v); return a.length ? a[Math.min(a.length - 1, Math.floor(x * a.length))] : NaN; };
const O = { matchs: 0, n: 0, kinds: {}, tenue: [], vit: [], ecart: [], presse: [], intent: 0, intentAge: [], sansIntent: 0, deny: {}, tiers: [0, 0, 0], tenuePasse: [], tenuePassePresse: [], ballAvant: 0, recupPoke: 0, pokes: 0, pokesRegain: 0 };
for (const seed of seeds) {
  const st = makeMatch({ full: true, seed }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: DUR, pause: 10 }, ...over }); O.matchs++;
  let seen = 0, pris = {}, presseDepuis = {}, intentDepuis = {}, pend = []; const denyHist = [];
  for (let i = 0; i < DUR * 60 * 2.4; i++) {
    const d0 = { ...(st.deny ?? {}) };
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break;
    const dd = {}; for (const k in st.deny ?? {}) { const v = (st.deny[k] ?? 0) - (d0[k] ?? 0); if (v > 0) dd[k] = v; } denyHist.push({ t: st.t, dd }); while (denyHist.length && st.t - denyHist[0].t > 1) denyHist.shift();
    const c = st.possession.carrier >= 0 ? st.players[st.possession.carrier] : null;
    if (c && st.phase === 'carry') { const foe = Math.min(...st.players.filter((x) => x.team !== c.team && x.down <= 0 && !x.keeper).map((x) => hyp(x.p[0] - c.p[0], x.p[2] - c.p[2])), 99);
      if (foe <= 3) presseDepuis[c.id] ??= st.t; else delete presseDepuis[c.id];
      if (c.intent) intentDepuis[c.id] ??= st.t; else delete intentDepuis[c.id]; }
    for (; seen < st.events.length; seen++) { const e = st.events[seen];
      if ((e.type === 'control' || e.type === 'receive' || e.type === 'loose-kept') && e.by != null) pris[e.by] = st.t;
      if (e.type === 'pass' && !e.clear && e.by != null && pris[e.by] != null) { const tn = st.t - pris[e.by]; O.tenuePasse.push(tn); if (presseDepuis[e.by] != null) O.tenuePassePresse.push(tn); }
      const poke = e.type === 'tacle-pique', duel = e.type === 'duel' && e.kind !== 'aérien' && e.won;
      if (!poke && !duel) continue;
      const victime = poke ? st.players[e.sur] : (st.possession.carrier >= 0 ? null : null);
      const cv = poke ? victime : null; if (poke) O.pokes++;
      const v = cv ?? (e.sur != null ? st.players[e.sur] : null); if (!v) { O.kinds[e.type] = (O.kinds[e.type] ?? 0) + 1; continue; }
      O.n++; O.kinds[e.type] = (O.kinds[e.type] ?? 0) + 1;
      O.tenue.push(pris[v.id] != null ? st.t - pris[v.id] : 99); O.vit.push(hyp(v.v[0], v.v[1])); O.ecart.push(hyp(st.ball.p[0] - v.p[0], st.ball.p[2] - v.p[2]));
      O.presse.push(presseDepuis[v.id] != null ? st.t - presseDepuis[v.id] : 0);
      if (intentDepuis[v.id] != null) { O.intent++; O.intentAge.push(st.t - intentDepuis[v.id]); } else O.sansIntent++;
      for (const h of denyHist) for (const k in h.dd) O.deny[k] = (O.deny[k] ?? 0) + h.dd[k];
      const s = Math.sign(st.pitch.attackGoal(v.team).x || 1), z = (v.p[0] * s + st.pitch.hx) / (2 * st.pitch.hx); O.tiers[z < 1 / 3 ? 0 : z < 2 / 3 ? 1 : 2]++;
      if (poke) pend.push({ t: st.t, team: v.team });
    }
    for (let k = pend.length - 1; k >= 0; k--) { if (st.t - pend[k].t < 2.5) continue; const car = st.possession.carrier >= 0 ? st.players[st.possession.carrier] : null; if (st.possession.team !== pend[k].team) O.pokesRegain++; pend.splice(k, 1); }
  }
}
const n = O.matchs;
console.log(`${n} matchs de 2 × ${(DUR / 60).toFixed(0)} min ${JSON.stringify(over)} — ${O.n} dépossessions de porteur analysées (${(O.n / n / 2).toFixed(0)} par équipe et par match) : ${Object.entries(O.kinds).map(([k, v]) => `${k} ${v}`).join(', ')} ; piques ${(O.pokes / n / 2).toFixed(0)} par équipe, possession adverse 2,5 s après ${pc(O.pokesRegain, O.pokes)} %`);
console.log(`  le porteur tenait le ballon depuis p25/p50/p75 ${q(O.tenue, 0.25).toFixed(1)}/${q(O.tenue, 0.5).toFixed(1)}/${q(O.tenue, 0.75).toFixed(1)} s ; vitesse p50 ${q(O.vit, 0.5).toFixed(1)} m/s ; écart pied-ballon p50 ${q(O.ecart, 0.5).toFixed(2)} m (p75 ${q(O.ecart, 0.75).toFixed(2)})`);
console.log(`  un adversaire à ≤ 3 m depuis p25/p50/p75 ${q(O.presse, 0.25).toFixed(2)}/${q(O.presse, 0.5).toFixed(2)}/${q(O.presse, 0.75).toFixed(2)} s avant la perte (0 = arrivé à l'image même) ; INTENTION de passe adoptée ${pc(O.intent, O.n)} % (depuis p50 ${q(O.intentAge, 0.5).toFixed(2)} s), aucune ${pc(O.sansIntent, O.n)} %`);
console.log(`  refus nommés dans la seconde d'avant (cumul) : ${Object.entries(O.deny).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${k} ${v}`).join(', ')}`);
console.log(`  par tiers : défensif ${pc(O.tiers[0], O.n)} %, médian ${pc(O.tiers[1], O.n)} %, offensif ${pc(O.tiers[2], O.n)} %`);
console.log(`  TENUE des passes jouées (réception → frappe) p25/p50/p75 ${q(O.tenuePasse, 0.25).toFixed(2)}/${q(O.tenuePasse, 0.5).toFixed(2)}/${q(O.tenuePasse, 0.75).toFixed(2)} s ; sous presseur à ≤ 3 m ${q(O.tenuePassePresse, 0.25).toFixed(2)}/${q(O.tenuePassePresse, 0.5).toFixed(2)}/${q(O.tenuePassePresse, 0.75).toFixed(2)} s`);
