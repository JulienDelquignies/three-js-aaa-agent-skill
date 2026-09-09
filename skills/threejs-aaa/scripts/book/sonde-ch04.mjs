// sonde ch04 (Bible 04, latéraux) — tests 1, 8, 9, 10, 14, 15, 16, 17-18, 21, 23, 24, 31 sur 2 × 90 min.
import { makeMatch, matchStep, matchCfg } from '../../assets/starter/src/engine/match-sim.js';
import { momentDuJeu } from '../../assets/starter/src/engine/phases.js';
const seeds = (process.argv[2] ?? '3,7').split(',').map(Number);
const o = { n: 0, distFB: 0, distCB: 0, d8: [], y9: [[], []], larg10: [], stepOut2: 0, imgsDef: 0, centres: 0, centresOk: 0, cutbacks: 0, buts: 0, butsCentre: 0, x23: [[], []], derriere24: [], sansBallon: 0, imgs: 0 };
for (const seed of seeds) {
  const st = makeMatch({ full: true, seed }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: 2700, pause: 10 } }); o.n++;
  let seen = 0; const prevP = new Map(); const pendC = []; let lastCentreT = -99, lastCentreTeam = -1, prevPoss = -1;
  for (let i = 0; i < 5400 * 60; i++) {
    const possAvant = st.possession.team, carrierAvant = st.possession.carrier;
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break;
    for (const p of st.players) { if (p.keeper || p.post > 3) continue; const pv = prevP.get(p.id); if (pv) { const d = Math.hypot(p.p[0] - pv[0], p.p[2] - pv[1]); if (p.post === 0 || p.post === 3) o.distFB += d; else o.distCB += d; } prevP.set(p.id, [p.p[0], p.p[2]]); }
    for (; seen < st.events.length; seen++) { const e = st.events[seen]; if (e.type === 'centre') { o.centres++; if (e.bas) o.cutbacks++; pendC.push({ t: st.t, team: st.players[e.by].team, seen: seen + 1 }); lastCentreT = st.t; lastCentreTeam = st.players[e.by].team; } if (e.type === 'but') { o.buts++; if (st.t - lastCentreT < 6 && e.team === lastCentreTeam) o.butsCentre++; } }
    for (const c of pendC) if (!c.done) { const ow = st.ball.owner ?? -1; if (ow >= 0 && st.t - c.t > 0.2) { c.done = true; if (st.players[ow].team === c.team) o.centresOk++; } else if (st.t - c.t > 5 || st.events.slice(c.seen).some((e) => e.type === 'sortie')) c.done = true; }
    // 24 : joueurs derrière le ballon à l'instant de la perte en attaque placée
    if (possAvant >= 0 && st.possession.team >= 0 && st.possession.team !== possAvant && momentDuJeu(st, possAvant, 6) !== 'transition-off') { const og = st.pitch.ownGoal(possAvant), sg = Math.sign(og.x || 1); const n = st.players.filter((p) => p.team === possAvant && !p.keeper && (p.p[0] - st.ball.p[0]) * sg > 0).length; if (Math.abs(st.ball.p[0] - og.x) > 55) o.derriere24.push(n); }
    if (st.restart || i % 15) continue; const poss = st.possession.team; if (poss < 0) continue; o.imgs++;
    if ((st.ball.owner ?? -1) < 0 || true) { for (const p of st.players) if (!p.keeper && (p.post === 0 || p.post === 3)) { if (st.ball.owner !== p.id) o.sansBallon++; } }
    const def = 1 - poss, og = st.pitch.ownGoal(def), sg = Math.sign(og.x || 1);
    const fbs = st.players.filter((p) => p.team === def && (p.post === 0 || p.post === 3)), cbs = st.players.filter((p) => p.team === def && (p.post === 1 || p.post === 2));
    const D = [...fbs, ...cbs].filter((p) => p.down <= 0);
    if (fbs.length === 2) { const faible = Math.sign(st.ball.p[2]) === Math.sign(fbs[0].p[2]) ? fbs[1] : fbs[0]; const cbN = cbs.reduce((b, c) => (!b || Math.abs(c.p[2] - faible.p[2]) < Math.abs(b.p[2] - faible.p[2]) ? c : b), null); if (cbN && momentDuJeu(st, def, 6) === 'défense-placée') { if (Math.abs(st.ball.p[0] - og.x) < 40) o.d8.push(Math.abs(faible.p[2] - cbN.p[2])); o.y9[0].push(faible.p[2]); o.y9[1].push(st.ball.p[2]); const ail = st.players.filter((p) => p.team === poss && !p.keeper && Math.sign(p.p[2]) === Math.sign(faible.p[2]) && Math.abs(p.p[2]) > 12).sort((a, b) => Math.abs(b.p[2]) - Math.abs(a.p[2]))[0]; if (ail) o.larg10.push(Math.abs(ail.p[2] - faible.p[2])); } }
    if (D.length === 4 && momentDuJeu(st, def, 6) === 'défense-placée') { o.imgsDef++; const xs = D.map((p) => Math.abs(p.p[0] - og.x)); const ligne = [...xs].sort((a, b) => a - b)[1]; if (xs.filter((x) => x < ligne - 2.5).length >= 2) o.stepOut2++; }
    const atkFBs = st.players.filter((p) => p.team === poss && (p.post === 0 || p.post === 3)); if (atkFBs.length === 2) { const og2 = st.pitch.ownGoal(poss); o.x23[0].push(Math.abs(atkFBs[0].p[0] - og2.x)); o.x23[1].push(Math.abs(atkFBs[1].p[0] - og2.x)); }
  }
}
const q = (arr, x) => { arr = [...arr].sort((u, v) => u - v); return arr.length ? arr[Math.floor(x * arr.length)] : NaN; }; const mean = (arr) => arr.length ? arr.reduce((x, y) => x + y, 0) / arr.length : NaN;
const corr = (a, b) => { const ma = mean(a), mb = mean(b); let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < a.length; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; } return sab / Math.sqrt(saa * sbb); };
console.log(`${o.n} × 90 min`);
console.log(`1   distance d'un latéral : ${(o.distFB / 4 / o.n).toFixed(0)} m / match (cible 10-11 km ; centraux ${(o.distCB / 4 / o.n).toFixed(0)})`);
console.log(`8   latéral côté faible ↔ central le plus proche, bloc bas : p50 ${q(o.d8, 0.5).toFixed(1)} m (cible 5-11)`);
console.log(`9   corrélation y latéral côté faible / y ballon : r = ${corr(o.y9[0], o.y9[1]).toFixed(2)} (cible > 0,6)`);
console.log(`10  largeur concédée à l'ailier côté faible : p50 ${q(o.larg10, 0.5).toFixed(1)} m (cible 16-26)`);
console.log(`14  deux sorties simultanées de la ligne (≥ 2 défenseurs à > 2,5 m devant le 2e plus bas) : ${(100 * o.stepOut2 / Math.max(1, o.imgsDef)).toFixed(1)} % des images de défense placée (cible 0)`);
console.log(`15  centres du jeu / équipe / match : ${(o.centres / 2 / o.n).toFixed(1)} (cible ≈ 11) ; 16 réussite (contact partenaire) ${(100 * o.centresOk / Math.max(1, o.centres)).toFixed(0)} % (cible 20-24) ; 21 cutbacks / équipe / match ${(o.cutbacks / 2 / o.n).toFixed(2)} (cible 1,56)`);
console.log(`17-18 buts ${o.buts}, dont < 6 s après un centre ${o.butsCentre} = ${(100 * o.butsCentre / Math.max(1, o.buts)).toFixed(0)} % (cible ≈ 23 %) ; buts par centre ${(100 * o.butsCentre / Math.max(1, o.centres)).toFixed(1)} % (cible 1,1-1,8)`);
console.log(`23  corrélation hauteur latéral / latéral opposé (attaque) : r = ${corr(o.x23[0], o.x23[1]).toFixed(2)} (cible < −0,25)`);
console.log(`24  joueurs de champ derrière le ballon à la perte en attaque placée (ballon > 55 m) : moyenne ${mean(o.derriere24).toFixed(1)} sur ${o.derriere24.length} pertes (cible 4-5)`);
console.log(`31  part du temps sans ballon (latéraux) : ${(100 * o.sansBallon / Math.max(1, 4 * o.imgs)).toFixed(1)} % (cible ≈ 95 ±3)`);
