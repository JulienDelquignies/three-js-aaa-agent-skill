// sonde 284 — LE TEMPS DE JEU (retours du 17/09 : « la cérémonie empiète, les touches sont trop longues, le receveur remet de la tête au
// lanceur en permanence, aux coups de pied arrêtés tout le monde est à l'arrêt ») : la cérémonie (durée), les durées de reprise par espèce
// (moyenne, p10, p50, p90 — réel Opta : touche 17,7 [12,7-21,7], six mètres 30,3, corner 36,9, coup franc 26-42), la part de touches jouées
// en ≤ 8 s, la réception de la touche (première action ≤ 2,5 s après le jet : tête remise AU LANCEUR / tête ailleurs / contrôle / perdue ;
// la hauteur du ballon à la première action), et le corps pendant l'attente (la vitesse des 20 joueurs de champ au milieu de l'attente,
// la part figée < 0,25 m/s) — la sonde du lot 284.
import { makeMatch, matchStep, matchCfg } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/match-sim.js';
const seeds = (process.argv[2] ?? '3,7').split(',').map(Number), over = JSON.parse(process.argv[3] ?? '{}'), DUR = +(process.argv[4] ?? 2700);
const hyp = Math.hypot, q = (a, x) => { a = [...a].sort((u, v) => u - v); return a.length ? a[Math.floor(x * a.length)] : NaN; }, moy = (a) => a.length ? a.reduce((u, v) => u + v, 0) / a.length : NaN;
const o = { n: 0, ceremonie: [], reprise: {}, toucheRapide: 0, touches: 0, rec: { lanceur: 0, teteAutre: 0, controle: 0, perdue: 0, autre: 0, h: [], n: 0 }, attente: { v: [], fige: 0, n: 0, parType: {} } };
for (const seed of seeds) {
  const st = makeMatch({ full: true, seed }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: DUR, pause: 10 }, ...over }); o.n++;
  let seen = 0, sortieT = null, sortieOut = null, cur = null, jet = null;
  for (let i = 0; i < DUR * 60 * 2.4; i++) {
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break;
    const r = st.restart;
    if (r && r.at > 0 && r.type !== 'fin' && r.type !== 'engagement') { if (!cur || cur.at !== r.at) cur = { at: r.at, type: r.type, t0: st.t, mesure: false };
      if (!cur.mesure && st.t >= (cur.t0 + r.at) / 2 && r.at - cur.t0 > 3) { cur.mesure = true; const vs = st.players.filter((p) => !p.keeper && p.id !== r.taker).map((p) => hyp(p.v[0], p.v[1])); o.attente.v.push(moy(vs)); o.attente.fige += vs.filter((v) => v < 0.25).length; o.attente.n += vs.length; (o.attente.parType[r.type] ??= []).push(moy(vs)); } }
    if (!r) cur = null;
    if (r && sortieT != null && r.at > 0 && r.type !== 'fin') { const d = r.at - sortieT; (o.reprise[sortieOut] ??= []).push(d); if (sortieOut === 'touche') { o.touches++; if (d <= 8) o.toucheRapide++; } sortieT = null; }
    if (jet && st.t - jet.t > 2.5) { o.rec.autre++; o.rec.n++; jet = null; }
    for (; seen < st.events.length; seen++) { const e = st.events[seen];
      if (e.type === 'sortie') { sortieT = st.t; sortieOut = e.out; }
      if (e.type === 'ceremonie' && e.kind === 'places') o.ceremonie.push(e.duree);
      if (e.type === 'rentrée') { jet = { t: st.t, by: e.by, to: e.to, team: st.players[e.by].team }; continue; }
      if (jet && st.t - jet.t <= 2.5) {
        if (e.type === 'tête') { o.rec.n++; o.rec.h.push(e.h); if (e.mode === 'remise' && e.to === jet.by) o.rec.lanceur++; else o.rec.teteAutre++; jet = null; }
        else if (e.type === 'control') { o.rec.n++; o.rec.h.push(st.ball.p[1]); if (st.players[e.by]?.team === jet.team) o.rec.controle++; else o.rec.perdue++; jet = null; }
        else if (e.type === 'duel' || e.type === 'interception') { o.rec.n++; o.rec.perdue++; jet = null; }
      }
    }
  }
}
const n = o.n, R = o.reprise;
console.log(`${n} × ${(DUR / 60).toFixed(0)} min ${JSON.stringify(over)}`);
console.log(`la CÉRÉMONIE d'avant-match : ${o.ceremonie.map((d) => d.toFixed(0)).join(' / ')} s (elle empiète sur le match ; à rendre sautable)`);
console.log(`durées de reprise : ${Object.entries(R).sort().map(([k, a]) => `${k} ${moy(a).toFixed(1)} s [p10 ${q(a, 0.1).toFixed(1)} p50 ${q(a, 0.5).toFixed(1)} p90 ${q(a, 0.9).toFixed(1)}] (${(a.length / n).toFixed(0)}/match)`).join(' ; ')} — réel touche 17,7 [12,7-21,7], six mètres 30,3, corner 36,9, coup franc 26-42`);
console.log(`touches jouées VITE (≤ 8 s) ${(100 * o.toucheRapide / Math.max(1, o.touches)).toFixed(0)} % de ${o.touches} (le foot en joue vite : le réel en a une queue basse à 3-8 s)`);
console.log(`la RÉCEPTION de la touche (${o.rec.n}) : tête remise AU LANCEUR ${(100 * o.rec.lanceur / Math.max(1, o.rec.n)).toFixed(0)} %, tête ailleurs ${(100 * o.rec.teteAutre / Math.max(1, o.rec.n)).toFixed(0)} %, contrôle ${(100 * o.rec.controle / Math.max(1, o.rec.n)).toFixed(0)} %, perdue ${(100 * o.rec.perdue / Math.max(1, o.rec.n)).toFixed(0)} %, rien en 2,5 s ${(100 * o.rec.autre / Math.max(1, o.rec.n)).toFixed(0)} % ; hauteur du ballon à la première action p50 ${q(o.rec.h, 0.5).toFixed(2)} m`);
console.log(`le CORPS pendant l'attente (au milieu des attentes > 3 s, ${o.attente.v.length} attentes) : vitesse moyenne des joueurs de champ ${moy(o.attente.v).toFixed(2)} m/s, figés (< 0,25 m/s) ${(100 * o.attente.fige / Math.max(1, o.attente.n)).toFixed(0)} % ; par espèce ${Object.entries(o.attente.parType).map(([k, a]) => `${k} ${moy(a).toFixed(2)}`).join(', ')}`);
