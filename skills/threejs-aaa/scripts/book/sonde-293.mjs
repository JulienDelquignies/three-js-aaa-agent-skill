// sonde 293 — LA DÉFENSE COLLÉE (la leçon des lots 290-292 : chaque canal de perte corrigé baisse, le total se conserve ~215-225 par
// équipe — la cause nommée est en amont : 73-75 % des passes jouées sous un défenseur à moins de 0,7 s, le réel ~12 %). Contre le
// Référentiel 02 : les PASSES SOUS PRESSION (~55 par équipe et par match, § 1.5 et reco 2 : un adversaire à moins de X m qui s'approche)
// et la PPDA (§ 8.1 : passes adverses hors du tiers défensif de l'équipe qui presse / ses actions défensives dans la même zone — tacles,
// interceptions, contres, fautes ; big-5 7,3-17, médiane ~11-12, hors [6 ; 20] = alarme). Et la forme du pressing : la distance du plus
// proche adversaire au porteur pendant la conduite, le nombre d'adversaires à moins de 5 m, le nombre de presseurs ('press') par image.
import { makeMatch, matchStep, matchCfg } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/match-sim.js';
const seeds = (process.argv[2] ?? '3,7').split(',').map(Number), over = JSON.parse(process.argv[3] ?? '{}'), DUR = +(process.argv[4] ?? 2700);
const hyp = Math.hypot, pc = (a, b) => (b ? (100 * a / b).toFixed(1) : '—'), q = (a, x) => { a = [...a].sort((u, v) => u - v); return a.length ? a[Math.min(a.length - 1, Math.floor(x * a.length))] : NaN; };
const qs = (a) => [0.25, 0.5, 0.75].map((x) => q(a, x).toFixed(2)).join('/');
const R = [1.5, 2, 3, 4, 5];
const O = { matchs: 0, passes: 0, sous: R.map(() => 0), dP: [], ppdaPasses: [0, 0], ppdaAct: [0, 0], carryD: [], a5: [0, 0, 0, 0], carryN: 0, press: [], cover: [] };
for (const seed of seeds) {
  const st = makeMatch({ full: true, seed }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: DUR, pause: 10 }, ...over }); O.matchs++;
  let seen = 0;
  // la zone PPDA de l'équipe qui presse : hors de SON tiers défensif (à plus de 35 m de son but)
  const horsTiers = (x, presse) => Math.abs(x - st.pitch.ownGoal(presse).x) > 35;
  for (let i = 0; i < DUR * 60 * 2.4; i++) {
    const cd0 = st.players.map((x) => x._pokeCd ?? -1);
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break;
    for (let k = 0; k < st.players.length; k++) { const P = st.players[k], cd = P._pokeCd ?? -1;
      if (cd !== cd0[k] && Math.abs(cd - (st.t + 0.9)) < 0.02 && horsTiers(P.p[0], P.team)) O.ppdaAct[P.team]++; }   // la pique manquée : un « contre »
    const c = st.possession.carrier >= 0 && st.phase === 'carry' && !st.restart ? st.players[st.possession.carrier] : null;
    if (c && !c.keeper && i % 6 === 0) { O.carryN++; let dm = 99, n5 = 0;
      for (const P of st.players) if (P.team !== c.team && P.down <= 0 && !P.keeper) { const d = hyp(P.p[0] - c.p[0], P.p[2] - c.p[2]); dm = Math.min(dm, d); if (d < 5) n5++; }
      O.carryD.push(dm); O.a5[Math.min(3, n5)]++;
      const def = 1 - c.team; O.press.push(st.players.filter((P) => P.team === def && P.job === 'press').length); O.cover.push(st.players.filter((P) => P.team === def && P.job === 'cover').length); }
    for (; seen < st.events.length; seen++) { const e = st.events[seen], p = e.by != null ? st.players[e.by] : null;
      if (e.type === 'pass' && !e.clear && !e.mains && e.to >= 0 && p && !st.restart) { O.passes++;
        let best = 99, app = false; for (const Q of st.players) if (Q.team !== p.team && Q.down <= 0 && !Q.keeper) { const dx = p.p[0] - Q.p[0], dz = p.p[2] - Q.p[2], d = hyp(dx, dz);
          if (d < best) { best = d; app = d > 0 && (Q.v[0] * dx + Q.v[1] * dz) / d > 0; } }
        O.dP.push(best); R.forEach((r, k) => { if (best < r && (app || best < 1.5)) O.sous[k]++; });
        if (horsTiers(p.p[0], 1 - p.team)) O.ppdaPasses[1 - p.team]++; }
      const def = e.type === 'tacle-pique' || e.type === 'slide' || e.type === 'faute' || (e.type === 'duel' && e.kind === 'épaule') ? p
        : e.type === 'duel' && e.kind === 'take-on' && e.contre != null ? st.players[e.contre] : e.type === 'turnover' && /intercept/.test(e.why ?? '') && p ? p : null;
      if (def && horsTiers(def.p[0], def.team)) O.ppdaAct[def.team]++; }
  }
}
const n = O.matchs, eq = (x) => (x / n / 2).toFixed(0);
console.log(`${n} matchs de 2 × ${(DUR / 60).toFixed(0)} min ${JSON.stringify(over)} — ${eq(O.passes)} passes par équipe et par match`);
console.log(`  PASSES SOUS PRESSION (un adversaire à moins de X m qui s'approche ; le réel ~55 par équipe, ~12 %) : ${R.map((r, k) => `${r} m ${eq(O.sous[k])} (${pc(O.sous[k], O.passes)} %)`).join(' ; ')} ; plus proche adversaire du passeur à la frappe p25/p50/p75 ${qs(O.dP)} m`);
const ppda = [0, 1].map((t) => O.ppdaPasses[t] / Math.max(1, O.ppdaAct[t]));
console.log(`  PPDA (big-5 7,3-17, médiane ~11-12 ; alarme hors [6 ; 20]) : équipe 0 ${ppda[0].toFixed(1)} (${O.ppdaPasses[0]} passes / ${O.ppdaAct[0]} actions), équipe 1 ${ppda[1].toFixed(1)} (${O.ppdaPasses[1]} / ${O.ppdaAct[1]})`);
const N = O.carryN;
console.log(`  PENDANT LA CONDUITE : plus proche adversaire p25/p50/p75 ${qs(O.carryD)} m ; adversaires à moins de 5 m : 0 ${pc(O.a5[0], N)} %, 1 ${pc(O.a5[1], N)} %, 2 ${pc(O.a5[2], N)} %, 3+ ${pc(O.a5[3], N)} % ; presseurs ('press') par image p50 ${q(O.press, 0.5)} (moyenne ${(O.press.reduce((a, b) => a + b, 0) / Math.max(1, O.press.length)).toFixed(2)}), couvreurs ${(O.cover.reduce((a, b) => a + b, 0) / Math.max(1, O.cover.length)).toFixed(2)}`);
