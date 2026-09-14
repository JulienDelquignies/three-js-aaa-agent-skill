// sonde 270 — LE TEMPS DU MATCH (Bible 14 lot 3 : T24 ballon en jeu 54-58 %, T25 durées de reprise 17,7 / 30,3 / 36,9 s ; Bible 16 : T10 jeu effectif 66 → 56 % (15 premières c. 15 dernières minutes), T23 temps additionnel ≥ +60 s si écart ≤ 1 ; Modèle 12 : 85-105 arrêts de 26-32 s ; la règle des 8 s du gardien).
import { makeMatch, matchStep, matchCfg } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/match-sim.js';
const seeds = (process.argv[2] ?? '3,7').split(',').map(Number), over = JSON.parse(process.argv[3] ?? '{}'), DUR = +(process.argv[4] ?? 2700);
const o = { n: 0, tot: 0, jeu: 0, reprise: {}, arrets: 0, add: [], addSerre: [], addLarge: [], debut: [0, 0], fin: [0, 0], gkHold: [], gk8: 0, huit: 0, total: [], score: [] };
for (const seed of seeds) {
  const { _tactics, ...overC } = over; if (overC.temps) overC.temps = { ...matchCfg({}).temps, ...overC.temps };
  const st = makeMatch({ full: true, seed, tactics: _tactics ?? null }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: DUR, pause: 10 }, ...overC }); o.n++;
  let seen = 0, sortieT = null, sortieOut = null, lastRestart = null, gkSince = null, gkId = null;
  for (let i = 0; i < DUR * 60 * 2.4; i++) {
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break;
    o.tot++; const enJeu = !st.restart; if (enJeu) o.jeu++;
    const half = st._chrono?.periode ?? 1, tp = st.t - (half === 1 ? 0 : DUR + 10);
    if (half === 1 && tp < 900) { o.debut[1]++; if (enJeu) o.debut[0]++; }
    if (half === 2 && tp >= DUR - 900 && tp < DUR) { o.fin[1]++; if (enJeu) o.fin[0]++; }
    if (st.restart && !lastRestart) { o.arrets++; lastRestart = st.restart; } if (!st.restart && lastRestart) lastRestart = null;
    if (st.restart && sortieT != null && st.restart.at > 0 && st.restart.type !== 'fin') { (o.reprise[sortieOut] ??= []).push(st.restart.at - sortieT); sortieT = null; }
    const ow = st.ball.owner; const g = ow != null ? st.players[ow] : null;
    if (g && g.keeper && !st.restart) { if (gkId !== ow) { gkId = ow; gkSince = st.t; } } else if (gkId != null) { const h = st.t - gkSince; o.gkHold.push(h); if (h > 8) o.gk8++; gkId = null; }
    for (; seen < st.events.length; seen++) { const e = st.events[seen];
      if (e.type === 'sortie') { sortieT = st.t; sortieOut = e.out; }
      if (e.type === 'temps-additionnel') { o.add.push(e.sec); if (e.periode === 2) (Math.abs(st.score[0] - st.score[1]) <= 1 ? o.addSerre : o.addLarge).push(e.sec); }
      if (e.type === 'huit-secondes') o.huit++;
    }
  }
  o.total.push(st.t); o.score.push(`${st.score[0]}-${st.score[1]}`);
}
const mean = (a) => a.length ? (a.reduce((x, y) => x + y, 0) / a.length) : NaN, n = o.n;
console.log(`${n} × ${DUR / 60} min ${JSON.stringify(over)} — ballon en jeu ${(100 * o.jeu / o.tot).toFixed(0) } % (réel 54-58) ; arrêts ${(o.arrets / n).toFixed(0)} / match (réel 85-105) de ${(mean([].concat(...Object.values(o.reprise)))).toFixed(1)} s (26-32) ; durée totale ${(mean(o.total) / 60).toFixed(1)} min (réel 100,6) ; scores ${o.score.join(' ')}`);
console.log(`  durées de reprise : ${Object.entries(o.reprise).sort().map(([k, a]) => `${k} ${mean(a).toFixed(1)} s (${a.length})`).join(', ')} (réel touche 17,7 [12,7-21,7], six mètres 30,3 [26,2-36,7], corner 36,9 [30-50], coup franc 26-42)`);
console.log(`  jeu effectif 15 premières min ${(100 * o.debut[0] / Math.max(1, o.debut[1])).toFixed(0)} % → 15 dernières ${(100 * o.fin[0] / Math.max(1, o.fin[1])).toFixed(0)} % (réel 66 → 56) ; temps additionnel par période ${o.add.map((x) => x.toFixed(0)).join(' / ')} s — 2e période écart ≤ 1 : ${mean(o.addSerre).toFixed(0)} s (${o.addSerre.length}), écart ≥ 2 : ${mean(o.addLarge).toFixed(0)} s (${o.addLarge.length}) (réel ≥ +60 s) ; gardien : tenue p50 ${o.gkHold.length ? [...o.gkHold].sort((a, b) => a - b)[Math.floor(o.gkHold.length / 2)].toFixed(1) : '—'} s, max ${o.gkHold.length ? Math.max(...o.gkHold).toFixed(1) : '—'}, > 8 s ${o.gk8}, sanctions huit-secondes ${o.huit}`);
