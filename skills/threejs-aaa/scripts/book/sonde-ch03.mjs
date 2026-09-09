// sonde ch03 (Bible 03, centraux) — T1 hauteur de ligne, T3 hors-jeu, T4/T5 dLat/dLong par zone, T7 bascules de stoppeur, T8 lineDesync, T10 aérien des centraux, T16 distance.
import { makeMatch, matchStep, matchCfg } from '../../assets/starter/src/engine/match-sim.js';
import { momentDuJeu } from '../../assets/starter/src/engine/phases.js';
const seeds = (process.argv[2] ?? '3,7').split(',').map(Number), tac = JSON.parse(process.argv[3] ?? 'null');
const o = { n: 0, ligne: [], horsJeu: 0, dLatAx: [], dLatCentre: [], dLongAile: [], dLongSigneOk: 0, dLongAileN: 0, stopSwitch: 0, desync: [], tetes: 0, tetesGagnees: 0, distCB: 0, distCBDef: 0, imgsDef: 0, imgs: 0 };
for (const seed of seeds) {
  const st = makeMatch({ full: true, seed, tactics: tac ? [tac, tac] : null }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: 2700, pause: 10 } }); o.n++;
  let seen = 0; const prevStop = [null, null];
  const cbs = [0, 1].map((t) => st.players.filter((p) => p.team === t && (p.post === 1 || p.post === 2)));
  const prevP = new Map();
  for (let i = 0; i < 5400 * 60; i++) {
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break;
    for (const t of [0, 1]) for (const p of cbs[t]) { const pv = prevP.get(p.id); if (pv) { const d = Math.hypot(p.p[0] - pv[0], p.p[2] - pv[1]); o.distCB += d; if (st.possession.team === 1 - t) o.distCBDef += d; } prevP.set(p.id, [p.p[0], p.p[2]]); }
    for (; seen < st.events.length; seen++) { const e = st.events[seen]; if (e.type === 'hors-jeu') o.horsJeu++; if (e.type === 'tête' && st.players[e.by] && (st.players[e.by].post === 1 || st.players[e.by].post === 2)) { o.tetes++; if (e.gagne !== false && e.mode !== 'perdu') o.tetesGagnees++; } }
    if (st.restart || i % 15) continue; const poss = st.possession.team; if (poss < 0) continue; const def = 1 - poss; o.imgs++;
    const og = st.pitch.ownGoal(def), sg = Math.sign(og.x || 1); const c = st.possession.carrier >= 0 ? st.players[st.possession.carrier] : null;
    const D = st.players.filter((p) => p.team === def && !p.keeper && p.post < 4 && p.down <= 0);
    if (D.length >= 4) { const xs = D.map((p) => Math.abs(p.p[0] - og.x)); o.ligne.push(Math.min(...xs)); if (momentDuJeu(st, def, 6) === 'défense-placée') { o.desync.push(Math.max(...xs) - Math.min(...xs)); o.imgsDef++; } }
    const [a, b] = cbs[def]; if (!a || !b || !c) continue;
    const dLat = Math.abs(a.p[2] - b.p[2]); const dBut = Math.abs(c.p[0] - og.x), zAbs = Math.abs(c.p[2]);
    if (zAbs < 12 && dBut > 22 && dBut < 38) o.dLatAx.push(dLat);
    if (zAbs > 22 && dBut < 22) { o.dLatCentre.push(dLat); const cote = Math.sign(c.p[2]); const ballSide = a.p[2] * cote > b.p[2] * cote ? a : b, opp = ballSide === a ? b : a; const dLong = (Math.abs(opp.p[0] - og.x) - Math.abs(ballSide.p[0] - og.x)); o.dLongAile.push(dLong); o.dLongAileN++; if (dLong < 0) o.dLongSigneOk++; }
    const stop = Math.hypot(a.p[0] - c.p[0], a.p[2] - c.p[2]) < Math.hypot(b.p[0] - c.p[0], b.p[2] - c.p[2]) ? a.id : b.id; if (prevStop[def] != null && stop !== prevStop[def]) o.stopSwitch++; prevStop[def] = stop;
  }
}
const q = (arr, x) => { arr = [...arr].sort((u, v) => u - v); return arr.length ? arr[Math.floor(x * arr.length)] : NaN; }; const mean = (arr) => arr.length ? arr.reduce((x, y) => x + y, 0) / arr.length : NaN;
console.log(`tactique ${JSON.stringify(tac)} — ${o.n} × 90 min`);
console.log(`T1  hauteur de ligne (dernier défenseur, hors possession) : moyenne ${mean(o.ligne).toFixed(1)} m, p50 ${q(o.ligne, 0.5).toFixed(1)} (cibles : 33-35 haut, 24-27 bas ; Real 34,6 / Barça 33,8 / Atlético 32,6)`);
console.log(`T3  hors-jeu sifflés / match : ${(o.horsJeu / o.n).toFixed(1)} (cibles : ordinaire 1,5-2,5, Barça 4,8)`);
console.log(`T4  dLat centraux : ballon axial 22-38 m p50 ${q(o.dLatAx, 0.5).toFixed(1)} m (cible 8-12) ; ballon en centre p50 ${q(o.dLatCentre, 0.5).toFixed(1)} m (cible 5-8)`);
console.log(`T5  dLong sur centre (opposé − côté ballon, négatif = couvreur plus bas) : p50 ${q(o.dLongAile, 0.5).toFixed(1)} m (cible −3 à −6), signe correct ${(100 * o.dLongSigneOk / Math.max(1, o.dLongAileN)).toFixed(0)} % (cible > 80)`);
console.log(`T7  bascules de stoppeur / match (central le plus proche du porteur) : ${(o.stopSwitch / 2 / o.n).toFixed(0)} par équipe (cible 40-90, > 250 échec)`);
console.log(`T8  lineDesync (max − min x des 4 défenseurs, défense placée) : p50 ${q(o.desync, 0.5).toFixed(1)} m, p90 ${q(o.desync, 0.9).toFixed(1)} (cible 0,8-1,8 ; pic ≤ 3,5)`);
console.log(`T10 têtes des centraux : ${o.tetes} (${(o.tetes / o.n).toFixed(0)} / match) — issue non lue par l'événement (à instrumenter) ; T16 distance d'un central ${(o.distCB / 4 / o.n).toFixed(0)} m / match (cible 9-11 km), dont en phase défensive ${(o.distCBDef / 4 / o.n).toFixed(0)} m`);
