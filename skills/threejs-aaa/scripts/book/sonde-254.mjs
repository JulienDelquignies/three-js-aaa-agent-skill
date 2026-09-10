// sonde 254 — la familiarité comme mécanisme relationnel : l'équipe 0 (ligneHaute) avec la familiarité donnée (squads) c. l'équilibre. La ligne au piège : alignement (écart-type x des corps marqués) au départ du ballon, désynchronisation (max des délais) ; hors-jeu provoqués, ballons reçus derrière, buts encaissés ; les motifs à deux et trois (un-deux, troisième homme) par match ; η(t) après un choc (informatif).
import { makeMatch, matchStep, matchCfg } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/match-sim.js';
import { offsideLine } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/offside.js';
const seeds = (process.argv[2] ?? '3,7').split(',').map(Number), fam = process.argv[3] != null && process.argv[3] !== 'null' && process.argv[3] !== 'defaut' ? +process.argv[3] : null, over = JSON.parse(process.argv[4] ?? '{}'), DUR = +(process.argv[5] ?? 5400);
const o = { n: 0, pieges: 0, align: [], desync: [], hjProv: 0, derriereRecu: 0, butsC: 0, unDeux: 0, trois: 0, chocs: 0, etas: [] };
const q = (a, x) => { a = [...a].sort((u, v) => u - v); return a.length ? a[Math.floor(x * a.length)] : NaN; };
for (const seed of seeds) {
  const squads = fam != null ? [Array.from({ length: 11 }, () => ({ familiarite: fam })), null] : null;
  const st = makeMatch({ full: true, seed, tactics: ['ligneHaute', 'equilibre'], ...(squads ? { squads } : {}) }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: 2700, pause: 10 }, ...over }); o.n++;
  let seen = 0; let piegeArme = null; const pend = new Map();
  for (let i = 0; i < DUR * 60; i++) {
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break;
    if (piegeArme && st.pass && st.pass.t >= piegeArme.t && st.phase === 'flight') { const xs = piegeArme.ids.map((id) => st.players[id].p[0]); const m = xs.reduce((a, b) => a + b, 0) / xs.length; o.align.push(Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / xs.length)); piegeArme = null; }
    if (piegeArme && st.t - piegeArme.t > 2) piegeArme = null;
    for (const [id, w] of pend) { if (st.ball.owner === id && st.t - w.t < 3) { const p = st.players[id]; if (p.p[0] * w.sgn > w.adv + 0.05) o.derriereRecu++; pend.delete(id); } else if (st.t - w.t >= 3) pend.delete(id); }
    if (i % 600 === 0 && st.fam?.[0]) o.etas.push([+st.t.toFixed(0), +(st.fam[0].eta ?? 1).toFixed(2)]);
    for (; seen < st.events.length; seen++) { const e = st.events[seen];
      if (e.type === 'piege' && e.team === 0) { o.pieges++; if (e.desync != null) o.desync.push(e.desync); piegeArme = { t: st.t, ids: st.players.filter((p) => p.team === 0 && p._piege && p._piege.until > st.t).map((p) => p.id) }; if (!piegeArme.ids.length) piegeArme = null; }
      if (e.type === 'hors-jeu' && st.players[e.by]?.team === 1) o.hjProv++;
      if (e.type === 'pass' && e.to >= 0 && st.players[e.by]?.team === 1 && st.players[e.to]) { const L = offsideLine(st, 1); const lead = st.pass?.lead; if (lead && lead[0] * L.sgn > L.adv + 0.05 && !st.pass?.off?.[e.to]) pend.set(e.to, { t: st.t, adv: L.adv, sgn: L.sgn }); }
      if (e.type === 'but' && e.team === 1) o.butsC++;
      if (e.type === 'un-deux' && st.players[e.a]?.team === 0) o.unDeux++;
      if ((e.type === 'troisieme' || e.type === 'troisième' || e.type === 'troisieme-homme') && st.players[e.by ?? e.a]?.team === 0) o.trois++;
      if (e.type === 'familiarite') o.chocs++;
    }
  }
}
const n = o.n, f = (x) => (x / n).toFixed(2);
console.log(`${n} × ${(DUR / 60).toFixed(0)} min familiarité ${fam ?? 'défaut'} ${JSON.stringify(over)} — pièges ${f(o.pieges)} / match, ALIGNEMENT de la ligne au départ du ballon σx p50 ${q(o.align, 0.5).toFixed(2)} m (p90 ${q(o.align, 0.9).toFixed(2)}), désynchronisation p50 ${q(o.desync, 0.5).toFixed(2)} s (p90 ${q(o.desync, 0.9).toFixed(2)}) ; hors-jeu provoqués ${f(o.hjProv)}, reçus derrière ${f(o.derriereRecu)}, buts encaissés ${f(o.butsC)} ; motifs : un-deux ${f(o.unDeux)}, troisième homme ${f(o.trois)} ; chocs ${f(o.chocs)}`);
if (o.etas.length) console.log(`η(t) équipe 0 : ${o.etas.slice(0, 12).map(([t, e]) => t + 's ' + e).join(', ')}`);
