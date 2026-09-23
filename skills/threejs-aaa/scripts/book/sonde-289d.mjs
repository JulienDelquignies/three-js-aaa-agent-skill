// sonde 289d — POURQUOI LA PASSE N'EST PAS ADOPTÉE SOUS LE PRESSEUR VISIBLE (sonde 289c : 82-87 % des porteurs piqués n'avaient aucune
// intention de passe, un adversaire à ≤ 3 m depuis 1,3 s p50). Dans la seconde qui précède chaque dépossession (pique / duel), à 10 Hz :
// le porteur est-il « au calme » au sens du moteur (le plus proche adversaire > calmFoe = 1,8 m) ? la meilleure passe (choosePass,
// l'état du monde restauré après l'appel) dépasse-t-elle la barre qui s'appliquait (calme 4,8 × tempo, pressé 3,2, presseur qui arrive
// 1,2) ? la tenue était-elle servie (calme : le tirage holdCalm ; pressé : settleMin) ? la pause (pausa), le bouclier, le retournement
// attendaient-ils ? Et la pression au TEMPS D'ARRIVÉE (pressionDe du 265, P = 1 − TTP/1,5 s) à ces mêmes instants.
import { makeMatch, matchStep, matchCfg } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/match-sim.js';
import { choosePass } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/rondo.js';
import { pressionDe } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/reception.js';
import { presseurArrive } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/pression.js';
const seeds = (process.argv[2] ?? '3,7').split(',').map(Number), over = JSON.parse(process.argv[3] ?? '{}'), DUR = +(process.argv[4] ?? 2700);
const hyp = Math.hypot, pc = (a, b) => (b ? (100 * a / b).toFixed(1) : '—'), q = (a, x) => { a = [...a].sort((u, v) => u - v); return a.length ? a[Math.min(a.length - 1, Math.floor(x * a.length))] : NaN; };
const O = { matchs: 0, pertes: 0, echant: 0, calme: 0, bat: 0, batPresse: 0, sansChoix: 0, scores: [], barres: {}, tenueNon: 0, pausa: 0, bouclier: 0, retour: 0, intent: 0, P: [], pCalme: [], foe: [], pressCall: 0 };
for (const seed of seeds) {
  const st = makeMatch({ full: true, seed }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: DUR, pause: 10 }, ...over }); O.matchs++;
  let seen = 0, hist = [], tick = 0;
  for (let i = 0; i < DUR * 60 * 2.4; i++) {
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break;
    const c = st.possession.carrier >= 0 ? st.players[st.possession.carrier] : null;
    if (c && st.phase === 'carry' && !c.keeper && ++tick % 6 === 0) {
      const foe = Math.min(...st.players.filter((x) => x.team !== c.team && x.down <= 0 && !x.keeper).map((x) => hyp(x.p[0] - c.p[0], x.p[2] - c.p[2])), 99);
      if (foe <= 3.5) {
        const sv = st._jeteAt, ch = choosePass(st, cfg); st._jeteAt = sv;
        const K = cfg.passe ?? {}, P = pressionDe(st, c, K, cfg).P, AC = cfg.avantContact, pc2 = !!(AC && ch && presseurArrive(st, c, AC, cfg.gardeTiers ? (cfg.gardeTiers.lireCible ?? 2.5) : 0));
        hist.push({ t: st.t, id: c.id, foe, calm: foe > (cfg.calmFoe ?? 1.8), score: ch ? ch.score : null, hold: st.hold, calmHold: st._calmHold, P, pressCall: pc2, pausa: !!c._pausa, bouclier: !!c._bouclier, retour: !!c._retour, intent: !!c.intent });
      }
    }
    while (hist.length && st.t - hist[0].t > 1.2) hist.shift();
    for (; seen < st.events.length; seen++) { const e = st.events[seen]; const poke = e.type === 'tacle-pique'; if (!poke) continue;
      O.pertes++; const H = hist.filter((h) => h.id === e.sur && st.t - h.t <= 1.0);
      for (const h of H) { O.echant++; O.foe.push(h.foe); O.P.push(h.P); if (h.calm) { O.calme++; O.pCalme.push(h.P); } if (h.pressCall) O.pressCall++;
        const bar = h.calm ? 4.8 : 3.2, barE = h.pressCall ? Math.min(bar, 1.2) : bar; O.barres[barE] = (O.barres[barE] ?? 0) + 1;
        if (h.score == null) O.sansChoix++; else { O.scores.push(h.score); if (h.score > barE) O.bat++; if (h.score > 3.2) O.batPresse++; }
        if (h.calm && h.hold < (h.calmHold ?? 0)) O.tenueNon++; if (h.pausa) O.pausa++; if (h.bouclier) O.bouclier++; if (h.retour) O.retour++; if (h.intent) O.intent++; }
    }
  }
}
const E = O.echant;
console.log(`${O.matchs} matchs de 2 × ${(DUR / 60).toFixed(0)} min ${JSON.stringify(over)} — ${O.pertes} tacles piqués ; ${E} instants (10 Hz) de la seconde qui précède, porteur sous un adversaire à ≤ 3,5 m`);
console.log(`  le moteur le croit AU CALME (plus proche > 1,8 m) ${pc(O.calme, E)} % des instants ; adversaire p25/p50/p75 ${q(O.foe, 0.25).toFixed(2)}/${q(O.foe, 0.5).toFixed(2)}/${q(O.foe, 0.75).toFixed(2)} m ; la pression au temps d'arrivée P p50 ${q(O.P, 0.5).toFixed(2)} (instants « calmes » : p25/p50 ${q(O.pCalme, 0.25).toFixed(2)}/${q(O.pCalme, 0.5).toFixed(2)})`);
console.log(`  la meilleure passe : aucune ${pc(O.sansChoix, E)} % ; score p25/p50/p75 ${q(O.scores, 0.25).toFixed(2)}/${q(O.scores, 0.5).toFixed(2)}/${q(O.scores, 0.75).toFixed(2)} ; bat la barre qui s'appliquait ${pc(O.bat, E)} % (barres : ${Object.entries(O.barres).map(([k, v]) => `${k} ${pc(v, E)} %`).join(', ')}) ; battrait la barre pressée 3,2 ${pc(O.batPresse, E)} % ; presseur qui arrive (1,2) ${pc(O.pressCall, E)} %`);
console.log(`  la tenue calme non servie ${pc(O.tenueNon, E)} % ; pausa ${pc(O.pausa, E)} %, bouclier ${pc(O.bouclier, E)} %, retournement ${pc(O.retour, E)} % ; intention déjà adoptée ${pc(O.intent, E)} %`);
