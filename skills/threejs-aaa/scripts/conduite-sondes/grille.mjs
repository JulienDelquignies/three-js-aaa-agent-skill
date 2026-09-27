// LA GRILLE DE LA CAGE (duel-1v1.sortieCage : le ballon rebondit, le jeu continue) — « les parois font mal au jeu : ils perdent le ballon quand ça
// touche ». Chaque rebond (événement 'grille') : l'équipe qui avait le ballon (le porteur, ou le dernier à l'avoir touché), la phase (conduite,
// passe, ballon libre, tir), la vitesse du ballon, le porteur à quelle distance du ballon et de la grille au moment du rebond ; puis QUI le reprend
// (la même équipe / l'adversaire / personne en 2 s) et en combien de temps ; et comment le ballon est arrivé sur la grille pendant une
// conduite (la touche de conduite qui l'y envoie : son cap par rapport à la grille). Usage : node grille.mjs [graines=16] [s=120] [cle=JSON …]
import { makeDuel, duelCfg } from '../../assets/starter/src/engine/duel-1v1.js';
import { matchStep } from '../../assets/starter/src/engine/match-sim.js';
const [NG = '16', SECS = '120', ...KV] = process.argv.slice(2);
const over = Object.fromEntries(KV.map((s) => { const i = s.indexOf('='); return [s.slice(0, i), JSON.parse(s.slice(i + 1))]; }));
const q = (xs, f) => { const s = [...xs].filter((x) => x != null && !isNaN(x)).sort((a, b) => a - b); return s.length ? s[Math.floor(f * (s.length - 1))] : NaN; };
const m = (xs, d = 2) => `${q(xs, 0.5).toFixed(d)} [${q(xs, 0.1).toFixed(d)}–${q(xs, 0.9).toFixed(d)}]`;
const G = []; let minutes = 0, poss = 0;
for (let seed = 1; seed <= Number(NG); seed++) {
  const st = makeDuel({ seed }), cfg = duelCfg(over); let ne = 0, lastCar = null, lastTouche = null, prevCar = -1; const open = [];
  for (let i = 0; i < Number(SECS) * 60; i++) {
    const phase0 = st.phase, car0 = st.possession?.carrier ?? -1;
    if (car0 >= 0) lastCar = { id: car0, team: st.players[car0].team, t: st.t };
    matchStep(st, 1 / 60, cfg);
    const car = st.possession?.carrier ?? -1; if (car >= 0 && car !== prevCar) poss++; prevCar = car;
    while (ne < st.events.length) { const e = st.events[ne++];
      if (e.type === 'touche' && e.by != null) { const p = st.players[e.by], hz = st.pitch.hz, hx = st.pitch.hx, bv = st.ball.v, sp = Math.hypot(bv[0], bv[2]) || 1;
        // la paroi la plus proche du porteur, sa distance, l'angle de la course et du ballon vers elle (+ = vers la paroi)
        const dL = hz - Math.abs(p.p[2]), dF = hx - Math.abs(p.p[0]), long = dL < dF, n = long ? [0, Math.sign(p.p[2])] : [Math.sign(p.p[0]), 0];
        const vp = Math.hypot(p.v[0], p.v[1]) || 1;
        lastTouche = { t: st.t, by: e.by, spd: e.spd, dMur: Math.min(dL, dF), capMur: Math.asin(Math.max(-1, Math.min(1, (p.v[0] * n[0] + p.v[1] * n[1]) / vp))) * 180 / Math.PI, balleMur: Math.asin(Math.max(-1, Math.min(1, (bv[0] * n[0] + bv[2] * n[1]) / sp))) * 180 / Math.PI, bMur: long ? hz - Math.abs(st.ball.p[2]) : hx - Math.abs(st.ball.p[0]) }; }
      if (e.type === 'grille') { const L = lastCar && st.t - lastCar.t < 1.0 ? lastCar : null, p = L ? st.players[L.id] : null;
        const o = { seed, t: st.t, phase: phase0, team: L?.team ?? st.lastTouch, keeper: p?.keeper, v: e.v, dB: p ? Math.hypot(st.ball.p[0] - p.p[0], st.ball.p[2] - p.p[2]) : null, vP: p?.speed, cote: Math.abs(e.p[1]) > st.pitch.hz - 0.4 ? 'longueur' : 'fond', tireur: st.events.slice(-40).some((x) => x.type === 'shot' && st.t - x.t < 1.2), touche: lastTouche && st.t - lastTouche.t < 0.6 ? lastTouche : null, suite: null, tS: null };
        if (p && o.touche?.by === p.id) { const fx = Math.cos(p.yaw), fz = Math.sin(p.yaw); o.capGrille = e.p; }
        G.push(o); open.push(o); } }
    for (let k = open.length - 1; k >= 0; k--) { const o = open[k], c = st.possession?.carrier ?? -1;
      o.id0 ??= lastCar && st.t - lastCar.t < 1.0 ? lastCar.id : -1; const p0 = st.players[o.id0];
      if (p0 && st.t - o.t <= 1.0) o.dMax = Math.max(o.dMax ?? 0, Math.hypot(st.ball.p[0] - p0.p[0], st.ball.p[2] - p0.p[2]));
      if (c >= 0 && st.phase === 'carry' && c !== o.id0) { o.suite = st.players[c].team === o.team ? 'repris-equipe' : 'perdu'; o.tS = st.t - o.t; o.par = st.players[c].keeper ? 'gardien' : 'champ'; open.splice(k, 1); }
      else if (st.t - o.t > 2) { const pp = st.players[c]; o.suite = st.restart ? 'arret' : c === o.id0 && pp && Math.hypot(st.ball.p[0] - pp.p[0], st.ball.p[2] - pp.p[2]) < 1.0 ? 'gardé' : 'libre-2s'; open.splice(k, 1); } }
  }
  minutes += Number(SECS) / 60;
}
const pc = (a, b) => (100 * a / Math.max(1, b)).toFixed(0) + ' %', tally = (Y, f) => { const T = {}; for (const o of Y) { const k = f(o); T[k] = (T[k] ?? 0) + 1; } return Object.entries(T).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pc(v, Y.length)}`).join(', '); };
console.log(`${G.length} rebonds sur la grille (${(G.length / minutes).toFixed(1)}/min) — phase au rebond : ${tally(G, (o) => o.tireur ? 'tir' : o.phase)} ; côté : ${tally(G, (o) => o.cote)}`);
console.log(`  la suite (2 s) : ${tally(G, (o) => o.suite)} ; changement de porteur en ${m(G.filter((o) => o.tS != null).map((o) => o.tS))} s ; le ballon s'éloigne du porteur jusqu'à ${m(G.map((o) => o.dMax))} m dans la seconde`);
for (const ph of ['carry', 'loose', 'flight']) { const Y = G.filter((o) => o.phase === ph && !o.tireur); if (Y.length) console.log(`  ${ph.padEnd(6)} (${Y.length}) : ${tally(Y, (o) => o.suite)} ; ballon à ${m(Y.map((o) => o.v), 1)} m/s, jusqu'à ${m(Y.map((o) => o.dMax))} m du porteur ; le porteur à ${m(Y.map((o) => o.dB))} m du ballon, à ${m(Y.map((o) => o.vP), 1)} m/s ; une touche de conduite < 0,6 s avant : ${pc(Y.filter((o) => o.touche).length, Y.length)} (à ${m(Y.filter((o) => o.touche).map((o) => o.touche.spd), 1)} m/s)`);
  const T = Y.filter((o) => o.touche && o.touche.dMur != null); if (T.length) console.log(`    à cette touche : porteur à ${m(T.map((o) => o.touche.dMur))} m de la paroi, sa course vers elle ${m(T.map((o) => o.touche.capMur), 0)}°, le ballon part vers elle à ${m(T.map((o) => o.touche.balleMur), 0)}°, ballon à ${m(T.map((o) => o.touche.bMur))} m d'elle`); }
console.log(`  possessions : ${poss} (${(poss / minutes).toFixed(1)}/min) — rebonds perdus pendant une conduite : ${G.filter((o) => o.phase === 'carry' && o.suite === 'perdu').length} (${(G.filter((o) => o.phase === 'carry' && o.suite === 'perdu').length / minutes).toFixed(2)}/min)`);
