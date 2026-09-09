// sonde ch14 (Bible 14, micro-comportements) — T1/T2/T3 scan (saccades du moteur), T12 orientation à la réception sous pression, T15/T15bis take-ons, T24 ballon en jeu, T25 durées de reprise.
import { makeMatch, matchStep, matchCfg } from '../../assets/starter/src/engine/match-sim.js';
const seeds = (process.argv[2] ?? '3,7').split(',').map(Number);
const famDe = (post) => post < 4 ? (post === 0 || post === 3 ? 'LAT' : 'DC') : post < 7 ? 'MC' : post === 8 ? 'ATT' : 'AIL';
const o = { n: 0, scans: 0, scanT: 0, scanPres: [0, 0], scanLoin: [0, 0], scanFam: {}, back: 0, backN: 0, takeon: {}, takeOk: 0, takeN: 0, jeu: 0, tot: 0, reprise: {} };
for (const seed of seeds) {
  const st = makeMatch({ full: true, seed }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: 2700, pause: 10 } }); o.n++;
  let seen = 0; const lastAt = new Map(); const pend = []; let sortieT = null, sortieOut = null;
  for (let i = 0; i < 5400 * 60; i++) {
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break; o.tot++; if (!st.restart) o.jeu++;
    if (st.restart && sortieT != null && st.restart.at > 0) { const d = st.restart.at - sortieT; (o.reprise[sortieOut] ??= []).push(d); sortieT = null; }
    for (const p of st.players) { if (p.keeper || p.down > 0 || !p.scan) continue; if (p.scan.at > (lastAt.get(p.id) ?? -1)) { lastAt.set(p.id, p.scan.at); o.scans++; let bd = 99; for (const q of st.players) if (q.team !== p.team && !q.keeper) bd = Math.min(bd, Math.hypot(q.p[0] - p.p[0], q.p[2] - p.p[2])); (bd < 1.5 ? o.scanPres : bd > 10 ? o.scanLoin : [0, 0])[0]++; (o.scanFam[famDe(p.post)] ??= [0, 0])[0]++; } if (!st.restart && i % 60 === 0) { o.scanT++; let bd = 99; for (const q of st.players) if (q.team !== p.team && !q.keeper) bd = Math.min(bd, Math.hypot(q.p[0] - p.p[0], q.p[2] - p.p[2])); (bd < 1.5 ? o.scanPres : bd > 10 ? o.scanLoin : [0, 0])[1]++; (o.scanFam[famDe(p.post)] ??= [0, 0])[1]++; } }
    for (const w of pend) if (!w.done && st.t - w.t >= 1.5) { w.done = true; if (st.ball.owner === w.by || (st.possession.team === w.team && st.possession.carrier >= 0)) o.takeOk++; }
    for (; seen < st.events.length; seen++) { const e = st.events[seen]; const by = st.players[e.by];
      if (e.type === 'sortie') { sortieT = st.t; sortieOut = e.out; }
      if (e.type === 'skill' && by && !by.keeper) { o.takeN++; o.takeon[e.by] = (o.takeon[e.by] ?? 0) + 1; pend.push({ t: st.t, by: e.by, team: by.team, done: false }); }
      if (e.type === 'receive' && by && !by.keeper) { let bd = 99; for (const q of st.players) if (q.team !== by.team && !q.keeper) bd = Math.min(bd, Math.hypot(q.p[0] - by.p[0], q.p[2] - by.p[2])); if (bd < 2.5) { o.backN++; const g = st.pitch.ownGoal(by.team); const face = Math.cos(by.yaw) * -g.sign; if (face < -0.3) o.back++; } }
    }
  }
}
const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN; const n = o.n;
const rate = (c) => c[1] ? (c[0] / c[1]).toFixed(2) : 'NaN';
console.log(`${n} × 90 min`);
console.log(`T1  saccades du moteur (cfg.scan) par joueur de champ et par seconde de jeu : ${(o.scans / o.scanT).toFixed(2)} /s (cible 0,44 ±0,08 — attention : le moteur ne scanne qu'en vol de passe adoptée + hors ballon 1,5-4 s)`);
console.log(`T2  rapport scan(adversaire < 1,5 m) / scan(> 10 m) : ${rate(o.scanPres)} / ${rate(o.scanLoin)} = ${(o.scanPres[0] / Math.max(1, o.scanPres[1]) / (o.scanLoin[0] / Math.max(1, o.scanLoin[1]))).toFixed(2)} (cible ≈ 0,67)`);
console.log(`T3  par poste : ${Object.entries(o.scanFam).map(([f, c]) => `${f} ${rate(c)}`).join(', ')} (cible MC > DC > LAT > AIL > ATT, d ≈ 0,55)`);
console.log(`T12 orientation à la réception sous pression (< 2,5 m) : dos au jeu ${(100 * o.back / Math.max(1, o.backN)).toFixed(0)} % (cible 35-55) sur ${o.backN} réceptions`);
const tk = Object.values(o.takeon).sort((a, b) => b - a); console.log(`T15 take-ons (événements 'skill') : ${(o.takeN / n).toFixed(0)} / match, réussite (ballon gardé à +1,5 s) ${(100 * o.takeOk / Math.max(1, o.takeN)).toFixed(0)} % (cible 41-54 pour les spécialistes) ; T15bis rapport meilleur / médian : ${tk[0]} / ${tk[Math.floor(tk.length / 2)]} = ${(tk[0] / Math.max(1, tk[Math.floor(tk.length / 2)])).toFixed(1)} (cible ≥ 5)`);
console.log(`T24 ballon en jeu : ${(100 * o.jeu / o.tot).toFixed(0)} % du temps total (cible 54-58)`);
console.log(`T25 durées de reprise (sortie → remise en jeu) : ${Object.entries(o.reprise).map(([k, a]) => `${k} ${mean(a).toFixed(1)} s (${a.length})`).join(', ')} (cible touche 17,7 / six mètres 30,3 / corner 36,9)`);
