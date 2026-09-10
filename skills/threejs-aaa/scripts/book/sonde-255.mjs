// sonde 255 — le preset ligne haute et ses deux faces : l'équipe 0 joue la tactique donnée, l'équipe 1 l'équilibre. Face 1 : hors-jeu PROVOQUÉS (sifflés contre l'adversaire), hauteur de la ligne (avant-dernier défenseur, hors possession), tirs concédés et leur distance. Face 2 (le prix) : ballons reçus DERRIÈRE la ligne par l'adversaire (passe légale dont la réception est au-delà de la ligne au départ), buts encaissés (dont sur réception derrière la ligne).
import { makeMatch, matchStep, matchCfg } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/match-sim.js';
import { offsideLine } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/offside.js';
const seeds = (process.argv[2] ?? '3,7').split(',').map(Number), tac = process.argv[3] ? JSON.parse(process.argv[3]) : 'equilibre', over = JSON.parse(process.argv[4] ?? '{}'), DUR = +(process.argv[5] ?? 5400);
const o = { n: 0, hjProv: 0, hjSubis: 0, ligne: [], tirsC: 0, distC: [], derriere: 0, derriereRecu: 0, butsC: 0, butsCDerriere: 0, butsP: 0, tirsP: 0, poss: 0, img: 0 };
const q = (a, x) => { a = [...a].sort((u, v) => u - v); return a.length ? a[Math.floor(x * a.length)] : NaN; };
for (const seed of seeds) {
  const st = makeMatch({ full: true, seed, tactics: [tac, 'equilibre'] }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: 2700, pause: 10 }, ...over }); o.n++;
  let seen = 0; const pend = new Map(); let lastDerriere = -99;
  for (let i = 0; i < DUR * 60; i++) {
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break;
    if (i % 30 === 0 && !st.restart) { o.img++; if (st.possession.team === 0) o.poss++; if (st.possession.team === 1 && st.phase === 'carry') { const L = offsideLine(st, 1); const own = st.pitch.ownGoal(0); o.ligne.push(Math.abs(L.adv * L.sgn - own.x)); } }
    for (const [id, w] of pend) { if (st.ball.owner === id && st.t - w.t < 3) { const p = st.players[id]; if (p.p[0] * w.sgn > w.adv + 0.05) { o.derriereRecu++; lastDerriere = st.t; } pend.delete(id); } else if (st.t - w.t >= 3) pend.delete(id); }
    for (; seen < st.events.length; seen++) { const e = st.events[seen];
      if (e.type === 'hors-jeu') { const t = st.players[e.by]?.team; if (t === 1) o.hjProv++; else o.hjSubis++; }
      if (e.type === 'pass' && e.to >= 0 && st.players[e.by]?.team === 1 && st.players[e.to]) { const L = offsideLine(st, 1); const lead = st.pass?.lead; if (lead && lead[0] * L.sgn > L.adv + 0.05 && !st.pass?.off?.[e.to]) { o.derriere++; pend.set(e.to, { t: st.t, adv: L.adv, sgn: L.sgn }); } }
      if (e.type === 'shot') { const t = st.players[e.by]?.team; if (t === 1) { o.tirsC++; if (e.range != null) o.distC.push(e.range); } else o.tirsP++; }
      if (e.type === 'but') { if (e.team === 1) { o.butsC++; if (st.t - lastDerriere < 6) o.butsCDerriere++; } else o.butsP++; }
    }
  }
}
const n = o.n, f = (x) => (x / n).toFixed(2);
console.log(`${n} × ${(DUR / 60).toFixed(0)} min tactique ${JSON.stringify(tac)} c. équilibre — FACE 1 : hors-jeu PROVOQUÉS ${f(o.hjProv)} / match (réel 1,5-2,5 ordinaire, 4,8 ligne haute synchrone), subis ${f(o.hjSubis)} ; ligne défensive hors possession p50 ${q(o.ligne, 0.5).toFixed(1)} m du but (Opta 31,6-34,6 pour les hautes) ; tirs concédés ${f(o.tirsC)} (distance p50 ${q(o.distC, 0.5).toFixed(1)} m) ; possession ${(100 * o.poss / Math.max(1, o.img)).toFixed(0)} %`);
console.log(`FACE 2 (le prix) : passes adverses visant DERRIÈRE la ligne (légales au départ) ${f(o.derriere)} / match, reçues derrière ${f(o.derriereRecu)} ; buts encaissés ${f(o.butsC)} (dont ≤ 6 s après une réception derrière la ligne ${f(o.butsCDerriere)}) ; buts marqués ${f(o.butsP)}, tirs ${f(o.tirsP)}`);
