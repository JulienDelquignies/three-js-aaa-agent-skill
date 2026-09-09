// sonde ch10b — reprise de T5 (déjà en mouvement ? changement de cap), T12 (épisodes et part du temps), T17 (fenêtres 1 s), T18 (fenêtres 2 s).
import { makeMatch, matchStep, matchCfg } from '../../assets/starter/src/engine/match-sim.js';
import { momentDuJeu } from '../../assets/starter/src/engine/phases.js';
const seeds = (process.argv[2] ?? '3,7').split(',').map(Number);
const o = { n: 0, dejaMouv: 0, dejaN: 0, cap: [], episodes: 0, imgsCasse: 0, imgsDef: 0, vMonte: [], vRecule: [], kxLibre: [], kxAccro: [], durCasse: [] };
for (const seed of seeds) {
  const st = makeMatch({ full: true, seed }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: 2700, pause: 10 } }); o.n++;
  let seen = 0; const prevP = new Map(), pending = [], casse = [null, null], hist = [[], []];
  for (let i = 0; i < 5400 * 60; i++) {
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break;
    const vel = new Map(); for (const p of st.players) { const pv = prevP.get(p.id); vel.set(p.id, pv ? [(p.p[0] - pv[0]) * 60, (p.p[2] - pv[1]) * 60] : [0, 0]); prevP.set(p.id, [p.p[0], p.p[2]]); }
    for (; seen < st.events.length; seen++) { const e = st.events[seen]; if (e.type === 'pass' && st.players[e.by] && st.players[e.to]) { const a = st.players[e.by], b = st.players[e.to]; if (Math.abs(a.p[2] - b.p[2]) > 15) { const def = 1 - a.team; const v0 = new Map(); for (const p of st.players) if (p.team === def && !p.keeper) { const v = vel.get(p.id); v0.set(p.id, v); o.dejaN++; if (Math.hypot(v[0], v[1]) > 1) o.dejaMouv++; } pending.push({ t0: st.t, def, v0, first: null, last: null, done: new Set() }); } } }
    for (const w of pending) { if (st.t - w.t0 > 3) continue; for (const [id, v0] of w.v0) { if (w.done.has(id)) continue; const v = vel.get(id); const s0 = Math.hypot(v0[0], v0[1]), s1 = Math.hypot(v[0], v[1]); const cos = s0 > 0.3 && s1 > 0.3 ? (v0[0] * v[0] + v0[1] * v[1]) / (s0 * s1) : 1; if (cos < 0.7 || (s0 < 0.5 && s1 > 1)) { w.done.add(id); if (w.first == null) w.first = st.t; w.last = st.t; } } }
    while (pending.length && st.t - pending[0].t0 > 3) { const w = pending.shift(); if (w.done.size >= 6) o.cap.push(w.last - w.first); }
    if (st.restart || i % 6) continue; const poss = st.possession.team; if (poss < 0) continue; const def = 1 - poss; const c = st.possession.carrier >= 0 ? st.players[st.possession.carrier] : null; if (!c) continue;
    if (momentDuJeu(st, def, 6) !== 'défense-placée') continue; o.imgsDef++;
    const og = st.pitch.ownGoal(def), sg = og.sign; const xb = (c.p[0] - og.x) * -sg;
    const D = st.players.filter((p) => p.team === def && !p.keeper && p.post < 4 && p.down <= 0); if (D.length < 4) continue;
    const dxs = D.map((p) => (p.p[0] - og.x) * -sg).sort((a, b) => a - b); const desync = dxs[3] - dxs[0], lineX = dxs[1];
    if (desync > 4) { o.imgsCasse++; if (casse[def] == null) casse[def] = st.t; } else if (casse[def] != null) { if (st.t - casse[def] > 0.5) { o.episodes++; o.durCasse.push(st.t - casse[def]); } casse[def] = null; }
    const H = hist[def]; H.push({ t: st.t, x: lineX, xb }); while (H.length && st.t - H[0].t > 2.05) H.shift();
    const h1 = H.find((h) => st.t - h.t >= 0.95 && st.t - h.t <= 1.05), h2 = H.find((h) => st.t - h.t >= 1.95);
    if (h1) { const v = (lineX - h1.x) / (st.t - h1.t); if (v > 0.5) o.vMonte.push(v); if (v < -0.5) o.vRecule.push(-v); }
    if (h2 && Math.abs(xb - h2.xb) > 3) (h2.xb - 12 > 30 ? o.kxLibre : o.kxAccro).push([xb - h2.xb, lineX - h2.x]);
  }
}
const q = (a, x) => { a = [...a].sort((u, v) => u - v); return a.length ? a[Math.floor(x * a.length)] : NaN; }; const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
const slope = (pairs) => { const n = pairs.length; if (n < 10) return NaN; const mx = mean(pairs.map((p) => p[0])), my = mean(pairs.map((p) => p[1])); let sxy = 0, sxx = 0; for (const [x, y] of pairs) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; } return sxy / sxx; };
const n = o.n;
console.log(`T5b déjà en mouvement (> 1 m/s) à l'instant d'une passe latérale > 15 m : ${(100 * o.dejaMouv / o.dejaN).toFixed(0)} % des défenseurs ; décalage 1er → dernier changement de cap (> 45°) : p50 ${q(o.cap, 0.5).toFixed(2)} s, p90 ${q(o.cap, 0.9).toFixed(2)} (cible 0,6-1,2) sur ${o.cap.length}`);
console.log(`T12b ligne cassée (desync > 4 m) : ${(100 * o.imgsCasse / o.imgsDef).toFixed(0)} % des images de défense placée ; épisodes > 0,5 s : ${(o.episodes / 2 / n).toFixed(0)} / match / équipe (cible 1-3), durée p50 ${q(o.durCasse, 0.5).toFixed(1)} s`);
console.log(`T17b ligne DEF sur 1 s : montée p50 ${q(o.vMonte, 0.5).toFixed(2)} m/s, p90 ${q(o.vMonte, 0.9).toFixed(2)} (cible 4,0-5,5) ; recul p50 ${q(o.vRecule, 0.5).toFixed(2)}, p90 ${q(o.vRecule, 0.9).toFixed(2)} (3,5-4,4) ; ratio p50 ${(q(o.vRecule, 0.5) / q(o.vMonte, 0.5)).toFixed(2)} (0,50-0,65)`);
console.log(`T18b k_x sur 2 s (|Δx_ballon| > 3 m) : libre ${slope(o.kxLibre).toFixed(2)} (≈ 0, ${o.kxLibre.length}), accroché ${slope(o.kxAccro).toFixed(2)} (≈ 1, ${o.kxAccro.length})`);
