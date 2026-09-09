// sonde ch10 (Bible 10, bloc collectif) — T1 bimodalité, T2 interligne, T3 gain k, T4 signature angulaire, T5 décalage, T6 fenêtre W, T7 densité, T8 bord, T11 hors-jeu, T12 ligne cassée, T13 dérive, T15 rest defense, T17 asymétrie, T18 k_x, T20 loi de possession.
import { makeMatch, matchStep, matchCfg } from '../../assets/starter/src/engine/match-sim.js';
import { momentDuJeu } from '../../assets/starter/src/engine/phases.js';
const seeds = (process.argv[2] ?? '3,7').split(',').map(Number);
const o = { n: 0, lenDef: [], lenAtk: [], inter: [], interDebut: [], interFin: [], kMid: [], kDef: [], ang: { DEF: [], MID: [], ATT: [] }, decal: [], W: [], dens: [], densBord: [], densLoin: [], horsJeu: 0, casse: 0, restN: [], restX: [], restW: [], vMonte: [], vRecule: [], kxLibre: [], kxAccro: [], poss: [], renv: 0 };
const ligneDe = (p) => p.post < 4 ? 'DEF' : p.post < 7 ? 'MID' : 'ATT';
for (const seed of seeds) {
  const st = makeMatch({ full: true, seed }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: 2700, pause: 10 } }); o.n++;
  let seen = 0, carrier = -1, carrierT0 = 0, casseDepuis = [-1, -1], lineXPrev = [null, null];
  const prevP = new Map(); const pending = []; // { t0, def, moving:Set, first, last, y0 }
  const renvs = []; // { t0, def, recv }
  for (let i = 0; i < 5400 * 60; i++) {
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break;
    const vel = new Map(); for (const p of st.players) { const pv = prevP.get(p.id); vel.set(p.id, pv ? [(p.p[0] - pv[0]) * 60, (p.p[2] - pv[1]) * 60] : [0, 0]); prevP.set(p.id, [p.p[0], p.p[2]]); }
    const ow = st.ball.owner ?? -1; if (ow !== carrier) { if (carrier >= 0 && !st.players[carrier].keeper) o.poss.push(st.t - carrierT0); carrier = ow; carrierT0 = st.t; }
    for (; seen < st.events.length; seen++) { const e = st.events[seen]; if (e.type === 'hors-jeu') o.horsJeu++; if (e.type === 'renversement') o.renv++;
      if (e.type === 'pass' && st.players[e.by] && st.players[e.to]) { const a = st.players[e.by], b = st.players[e.to]; const dz = Math.abs(a.p[2] - b.p[2]), d = Math.hypot(a.p[0] - b.p[0], dz); if (dz > 15) pending.push({ t0: st.t, def: 1 - a.team, moving: new Set(), first: null, last: null }); if (d > 35 && dz > 25) renvs.push({ t0: st.t, def: 1 - a.team, recv: b.id, arrive: null }); } }
    // T5 : après une passe latérale > 15 m, instants où chaque défenseur de champ atteint 1 m/s
    for (const w of pending) { if (st.t - w.t0 > 3) continue; for (const p of st.players) { if (p.team !== w.def || p.keeper || w.moving.has(p.id)) continue; const v = vel.get(p.id); if (Math.hypot(v[0], v[1]) > 1) { w.moving.add(p.id); if (w.first == null) w.first = st.t; w.last = st.t; } } }
    while (pending.length && st.t - pending[0].t0 > 3) { const w = pending.shift(); if (w.first != null && w.moving.size >= 6) o.decal.push(w.last - w.first); }
    // T6 : renversement > 35 m : de la réception opposée à la première pression < 4 m
    for (const r of renvs) { if (r.arrive === null) { if (st.ball.owner === r.recv) r.arrive = st.t; continue; } if (r.done) continue; const b = st.players[r.recv]; let bd = 99; for (const q of st.players) if (q.team === r.def && !q.keeper) bd = Math.min(bd, Math.hypot(q.p[0] - b.p[0], q.p[2] - b.p[2])); if (bd < 4) { o.W.push(st.t - r.arrive); r.done = true; } else if (st.t - r.arrive > 6) { o.W.push(6); r.done = true; } }
    if (st.restart || i % 12) continue; const poss = st.possession.team; if (poss < 0) continue; const def = 1 - poss;
    const c = st.possession.carrier >= 0 ? st.players[st.possession.carrier] : null; if (!c) continue;
    const og = st.pitch.ownGoal(def), sg = og.sign; const xb = (c.p[0] - og.x) * -sg; // xb : distance du ballon au but défendu
    const champ = (t) => st.players.filter((p) => p.team === t && !p.keeper && p.down <= 0);
    const D = champ(def).filter((p) => p.post < 4), M = champ(def).filter((p) => p.post >= 4 && p.post < 7);
    const dxs = D.map((p) => (p.p[0] - og.x) * -sg), mxs = M.map((p) => (p.p[0] - og.x) * -sg);
    // T1 : longueur du bloc (10 de champ) — défensive (défense placée) / possession (attaque placée)
    const mDef = momentDuJeu(st, def, 6), mAtk = momentDuJeu(st, poss, 6);
    const lenOf = (t) => { const xs = champ(t).map((p) => p.p[0]); return Math.max(...xs) - Math.min(...xs); };
    if (mDef === 'défense-placée') o.lenDef.push(lenOf(def)); if (mAtk === 'attaque-placée') o.lenAtk.push(lenOf(poss));
    if (mDef === 'défense-placée' && D.length >= 4 && M.length >= 2) {
      const bar = (a) => a.reduce((x, y) => x + y, 0) / a.length; const inter = bar(mxs) - bar(dxs); o.inter.push(inter);
      if (st.t < 900) o.interDebut.push(inter); const tRel = st.t - (st.chrono?.periode === 2 || st.t > 2700 + 10 ? 2710 : 0); if (st.t > 2710 + 2700 - 900) o.interFin.push(inter);
      // T3 : gain k — y de ligne vs y ballon (z du moteur), signé côté ballon
      const zM = M.reduce((x, p) => x + p.p[2], 0) / M.length, zD = D.reduce((x, p) => x + p.p[2], 0) / D.length; o.kMid.push([c.p[2], zM]); o.kDef.push([c.p[2], zD]);
      // T4 : signature angulaire (vitesse / direction vers le ballon), joueurs en mouvement > 1 m/s
      for (const p of champ(def)) { const v = vel.get(p.id); const sp = Math.hypot(v[0], v[1]); if (sp < 1) continue; const dx = c.p[0] - p.p[0], dz = c.p[2] - p.p[2], dn = Math.hypot(dx, dz); if (dn < 1) continue; const cos = (v[0] * dx + v[1] * dz) / (sp * dn); o.ang[ligneDe(p)].push(Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI); }
      // T7/T8 : densité à 10 m du ballon (ballon dans la moitié défendue)
      if (xb < 52.5) { let nd = 0; for (const p of champ(def)) if (Math.hypot(p.p[0] - c.p[0], p.p[2] - c.p[2]) < 10) nd++; const dyT = 34 - Math.abs(c.p[2]); if (dyT > 10) { o.dens.push(nd); o.densLoin.push(nd); } else if (dyT <= 4) o.densBord.push(nd); }
      // T12 : ligne cassée (desync > 4 m pendant > 0,5 s)
      const desync = Math.max(...dxs) - Math.min(...dxs); if (desync > 4) { if (casseDepuis[def] < 0) casseDepuis[def] = st.t; else if (st.t - casseDepuis[def] > 0.5 && casseDepuis[def] > 0) { o.casse++; casseDepuis[def] = -2; } } else casseDepuis[def] = -1;
      // T17/T18 : hauteur de ligne (2e plus reculé) — vitesse longitudinale et régime k_x
      const sorted = [...dxs].sort((a, b) => a - b); const lineX = sorted[1]; const pv = lineXPrev[def];
      if (pv && st.t - pv.t < 0.3) { const v = (lineX - pv.x) / (st.t - pv.t); if (v > 0.5) o.vMonte.push(v); if (v < -0.5) o.vRecule.push(-v); (pv.xb - 12 > 30 ? o.kxLibre : o.kxAccro).push([xb - pv.xb, lineX - pv.x]); }
      lineXPrev[def] = { t: st.t, x: lineX, xb };
    }
    // T15 : rest defense — joueurs de l'équipe en possession derrière le ballon (attaque placée, ballon dans le camp adverse)
    if (mAtk === 'attaque-placée') { const ogA = st.pitch.ownGoal(poss), sA = ogA.sign; const xbA = (c.p[0] - ogA.x) * -sA; if (xbA > 52.5) { const behind = champ(poss).filter((p) => (p.p[0] - ogA.x) * -sA < xbA - 1 && p.id !== c.id); o.restN.push(behind.length); if (behind.length) { o.restX.push(behind.reduce((x, p) => x + (p.p[0] - ogA.x) * -sA, 0) / behind.length); const zs = behind.map((p) => p.p[2]); o.restW.push(Math.max(...zs) - Math.min(...zs)); } } }
  }
}
const q = (a, x) => { a = [...a].sort((u, v) => u - v); return a.length ? a[Math.floor(x * a.length)] : NaN; }; const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
const slope = (pairs) => { const n = pairs.length; if (n < 10) return NaN; const mx = mean(pairs.map((p) => p[0])), my = mean(pairs.map((p) => p[1])); let sxy = 0, sxx = 0; for (const [x, y] of pairs) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; } return sxy / sxx; };
const hist = (a, lo, hi, w) => { const b = []; for (let x = lo; x < hi; x += w) b.push(`${x}-${x + w}:${(100 * a.filter((v) => v >= x && v < x + w).length / a.length).toFixed(0)}%`); return b.join(' '); };
const n = o.n;
console.log(`${n} × 90 min`);
console.log(`T1  longueur du bloc (10 de champ) : défense placée p50 ${q(o.lenDef, 0.5).toFixed(1)} m (cible 26-32, pic ≤ 34) ; attaque placée p50 ${q(o.lenAtk, 0.5).toFixed(1)} (cible 38-46) ; écart des modes ${(q(o.lenAtk, 0.5) - q(o.lenDef, 0.5)).toFixed(1)} (≥ 8)\n    histogramme défense : ${hist(o.lenDef, 10, 60, 5)}`);
console.log(`T2  interligne DEF↔MID (barycentres, défense placée) : moyenne ${mean(o.inter).toFixed(1)} m, p95 ${q(o.inter, 0.95).toFixed(1)} (cible 10-15, P95 ≤ 19) ; > 16 m ${(100 * o.inter.filter((v) => v > 16).length / o.inter.length).toFixed(0)} % du temps (< 8)`);
console.log(`T3  gain de coulissement k (régression y_ligne / y_ballon) : MID ${slope(o.kMid).toFixed(2)} (cible 0,55-0,75), DEF ${slope(o.kDef).toFixed(2)} (0,35-0,50) — ordre MID > DEF obligatoire`);
console.log(`T4  signature angulaire vitesse/ballon (défense placée, > 1 m/s) : DEF ${mean(o.ang.DEF).toFixed(0)}° (cible 90 ±8), MID ${mean(o.ang.MID).toFixed(0)}° (78), ATT ${mean(o.ang.ATT).toFixed(0)}° (69)`);
console.log(`T5  décalage 1er → dernier défenseur à 1 m/s après passe latérale > 15 m : p50 ${q(o.decal, 0.5).toFixed(2)} s (cible 0,6-1,2 ; > 0,3 obligatoire) sur ${o.decal.length} passes`);
console.log(`T6  fenêtre W après renversement > 35 m (réception → pression < 4 m) : p50 ${q(o.W, 0.5).toFixed(2)} s (cible 1,5-2,5) sur ${o.W.length} renversements ; événements 'renversement' ${o.renv}`);
console.log(`T7  densité à 10 m du ballon (moitié défendue, dyT > 10) : ${mean(o.dens).toFixed(1)} (cible 4,9 médian / 6,3 bas / 4,2 haut) ; T8 bord : dens(dyT ≤ 4) ${mean(o.densBord).toFixed(1)} / dens(dyT ≥ 10) ${mean(o.densLoin).toFixed(1)} = ${(mean(o.densBord) / mean(o.densLoin)).toFixed(2)} (cible 1,34-2,00)`);
console.log(`T11 hors-jeu / match / équipe : ${(o.horsJeu / 2 / n).toFixed(1)} (cible 1,5 → 4,8) ; T12 ligne cassée (desync > 4 m > 0,5 s) : ${(o.casse / 2 / n).toFixed(1)} / match / équipe (cible 1-3)`);
console.log(`T13 dérive de l'interligne : minutes 0-15 ${mean(o.interDebut).toFixed(1)} m → 75-90 ${mean(o.interFin).toFixed(1)} (cible +3 à +6, ≥ +2)`);
console.log(`T15 rest defense (attaque placée, ballon en camp adverse) : ${mean(o.restN).toFixed(1)} corps derrière (cible 3,7 ±0,8), à ${mean(o.restX).toFixed(0)} m du but (43,6 ±10), largeur ${mean(o.restW).toFixed(0)} m (28,2 ±7,4)`);
console.log(`T17 ligne DEF : montée p50 ${q(o.vMonte, 0.5).toFixed(2)} m/s (cible 4,0-5,5), recul p50 ${q(o.vRecule, 0.5).toFixed(2)} (3,5-4,4), ratio ${(q(o.vRecule, 0.5) / q(o.vMonte, 0.5)).toFixed(2)} (cible 0,50-0,65)`);
console.log(`T18 k_x (Δx_ligne / Δx_ballon) : régime libre (ballon > 42 m) ${slope(o.kxLibre).toFixed(2)} (cible ≈ 0), accroché ${slope(o.kxAccro).toFixed(2)} (cible ≈ 1)`);
const m = mean(o.poss), v = mean(o.poss.map((x) => (x - m) ** 2)); console.log(`T20 durée de possession individuelle (hors gardien) : moyenne ${m.toFixed(2)} s, p50 ${q(o.poss, 0.5).toFixed(2)}, forme Gamma (moments) ${(m * m / v).toFixed(2)} (cible 1,8-2,8 ; ≈ 1 = exponentielle)`);
