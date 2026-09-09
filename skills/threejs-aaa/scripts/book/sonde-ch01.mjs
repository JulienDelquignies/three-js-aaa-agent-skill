// sonde ch01 (Bible 01, cadre général) — les tests T1, T6, T6b, T7, T10, T11, T12, T15, T21 sur le moteur d'aujourd'hui, 2 matchs de 90 min.
import { makeMatch, matchStep, matchCfg } from '../../assets/starter/src/engine/match-sim.js';
import { momentDuJeu } from '../../assets/starter/src/engine/phases.js';
import { LIGNES } from '../../assets/starter/src/engine/formation.js';
const seeds = (process.argv[2] ?? '3,7').split(',').map(Number), W = +(process.argv[3] ?? 6);
const o = { tot: 0, jeu: 0, trans: 0, bascules: 0, poss: [], ctrlTot: {}, nPoss: {}, fam: {}, interv: [], intervBas: [], retargets: [], ppda: { passesA: 0, defB: 0 }, minutesJeu: 0 };
const famDe = (post) => post === 10 ? 'GK' : post < 4 ? (post === 0 || post === 3 ? 'LAT' : 'DC') : post < 7 ? (post === 5 ? 'MC' : 'M') : post === 8 ? 'CF' : 'AIL';
for (const seed of seeds) {
  const st = makeMatch({ full: true, seed }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: 2700, pause: 10 } });
  let seen = 0, prevMoment = [null, null], carrier = -1, carrierT0 = 0; const prevT = new Map(), lastRetarget = new Map(); const winT = []; let lastWin = -1;
  for (let i = 0; i < 5400 * 60; i++) {
    matchStep(st, 1 / 60, cfg); o.tot++; if (st.restart?.type === 'fin') break;
    const enJeu = !st.restart; if (enJeu) o.jeu++;
    // T6/T6b/T7 : possessions individuelles (ballon possédé : st.ball.owner)
    const ow = st.ball.owner ?? -1;
    if (ow !== carrier) { if (carrier >= 0) { const d = st.t - carrierT0; o.poss.push(d); const p = st.players[carrier]; const k = p.team + ':' + p.post; o.ctrlTot[k] = (o.ctrlTot[k] ?? 0) + d; o.nPoss[k] = (o.nPoss[k] ?? 0) + 1; } carrier = ow; carrierT0 = st.t; }
    if (!enJeu) continue;
    for (const team of [0, 1]) { const m = momentDuJeu(st, team, W); if (prevMoment[team] && m !== prevMoment[team] && m !== 'arrêt' && prevMoment[team] !== 'arrêt') o.bascules++; prevMoment[team] = m; if (team === 0 && (m === 'transition-off' || m === 'transition-def')) o.trans++; }
    // T12 : distance d'intervention = distance du défenseur le plus proche au porteur (hors gardien), en défense placée
    if (i % 15 === 0 && st.possession.carrier >= 0 && momentDuJeu(st, 1 - st.possession.team, W) === 'défense-placée') { const c = st.players[st.possession.carrier]; if (!c.keeper) { let bd = 99; for (const q of st.players) if (q.team !== c.team && !q.keeper && q.down <= 0) bd = Math.min(bd, Math.hypot(q.p[0] - c.p[0], q.p[2] - c.p[2])); const og = st.pitch.ownGoal(1 - c.team); const dBut = Math.abs(c.p[0] - og.x); (dBut < 35 ? o.intervBas : o.interv).push(bd); } }
    // T15 : instants de re-décision (changement de cible > 0,8 m) par fenêtre de 1 s : écart-type des instants des 10 joueurs de champ
    for (const p of st.players) { if (p.keeper || !p.target) continue; const pv = prevT.get(p.id); if (pv && Math.hypot(p.target[0] - pv[0], p.target[2] - pv[2]) > 0.8) lastRetarget.set(p.id, st.t); prevT.set(p.id, [p.target[0], p.target[2]]); }
    if (Math.floor(st.t) !== lastWin) { lastWin = Math.floor(st.t); const ts = [...lastRetarget.values()].filter((t) => t > st.t - 1); if (ts.length >= 6) { const m = ts.reduce((a, b) => a + b, 0) / ts.length; o.retargets.push(Math.sqrt(ts.reduce((a, t) => a + (t - m) ** 2, 0) / ts.length)); } }
    // T21 : PPDA (approx.) — passes de l'équipe 1 hors de son tiers défensif / actions défensives de l'équipe 0 hors de son tiers défensif
    for (; seen < st.events.length; seen++) { const e = st.events[seen]; const by = st.players[e.by]; if (!by) continue; const ogB = st.pitch.ownGoal(by.team); const horsTiers = Math.abs(by.p[0] - ogB.x) > st.pitch.hx * 2 / 3; if (e.type === 'pass' && by.team === 1 && horsTiers) o.ppda.passesA++; if (['duel', 'slide', 'tacle-pique'].includes(e.type) && by.team === 0 && horsTiers) o.ppda.defB++; }
  }
  o.minutesJeu += o.jeu / 3600;
}
const q = (a, x) => { a = [...a].sort((u, v) => u - v); return a.length ? a[Math.floor(x * a.length)] : NaN; }; const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
const n = seeds.length, netMin = o.jeu / 3600;
console.log(`${n} matchs de 90 min (fenêtre de transition W = ${W} s)`);
console.log(`T1  ballon en jeu : ${(o.jeu / 60 / n).toFixed(0)} s / match (cible 3 419 ±10 %)`);
console.log(`T6  possession individuelle : moyenne ${mean(o.poss).toFixed(2)} s, p50 ${q(o.poss, 0.5).toFixed(2)} (cible ≈ 1,1 s ±0,25) ; T6b contrôle total par joueur ${(Object.values(o.ctrlTot).reduce((a, b) => a + b, 0) / (22 * n)).toFixed(0)} s (cible 81 ±73) ; intervalles de contrôle ${(o.poss.length / n).toFixed(0)} / match (cible 836 ±424)`);
const parFam = {}; for (const [k, v] of Object.entries(o.nPoss)) { const f = famDe(+k.split(':')[1]); (parFam[f] ??= []).push(v / netMin * 10 * n / n); }
console.log(`T7  possessions / joueur / 10 min nets : ${Object.entries(parFam).map(([f, a]) => `${f} ${mean(a).toFixed(1)}`).join(', ')} (cible 13,3 ; CM 16,5, DC 15,5, LAT 14,8, AIL 11,9, CF 10,1, GK 9,8)`);
console.log(`T10 part du temps en transition (équipe 0) : ${(100 * o.trans / o.jeu).toFixed(0)} % (garde-fou 15-30) ; T11 bascules de moment / match / équipe : ${(o.bascules / 2 / n).toFixed(0)} (garde-fou 90-160)`);
console.log(`T12 distance d'intervention (défenseur le plus proche du porteur, défense placée) : bloc médian p50 ${q(o.interv, 0.5).toFixed(1)} m (cible 10-15), près du but (< 35 m) p50 ${q(o.intervBas, 0.5).toFixed(1)} m (cible ≈ 6)`);
console.log(`T15 écart-type des instants de re-décision des joueurs de champ sur 1 s : p50 ${(1000 * q(o.retargets, 0.5)).toFixed(0)} ms (cible ≥ 120)`);
console.log(`T21 PPDA (approx. passes adverses hors tiers défensif / duels+tacles) : ${(o.ppda.passesA / Math.max(1, o.ppda.defB)).toFixed(1)} (échelle 7,3 pressing → 17 bloc bas)`);
