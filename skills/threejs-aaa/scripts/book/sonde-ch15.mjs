// sonde ch15 (Bible 15, duels et seconds ballons) — D1 duels aériens, D2 duels au sol, D3 gagnés par poste, D7/D10/D12 second ballon, D14/D15/D17 jeu long, D20-D24 tacles/fautes/cartons, D30 touches, D33 passes longues.
import { makeMatch, matchStep, matchCfg } from '../../assets/starter/src/engine/match-sim.js';
const seeds = (process.argv[2] ?? '3,7').split(',').map(Number);
const famDe = (post) => post < 4 ? 'DF' : post < 7 ? 'MD' : 'FW';
const o = { n: 0, aer: 0, tetes: 0, aerWon: {}, sol: 0, dRep: [], winRec: [0, 0], delai: [], launch: 0, launchKept: 0, gain: [], lens: { longue: [], degagement: [], six: [] }, slides: 0, slideFaute: 0, debout: 0, deboutFaute: 0, fautes: 0, jaunes: 0, rouges: 0, touches: 0, passes: 0, longues: 0, fautesTiers: {} };
for (const seed of seeds) {
  const st = makeMatch({ full: true, seed }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: 2700, pause: 10 } }); o.n++;
  let seen = 0; const pendTete = [], pendLaunch = []; let sixT = -9;
  for (let i = 0; i < 5400 * 60; i++) {
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break;
    const ow = st.ball.owner ?? -1;
    for (const w of pendTete) { if (w.done) continue; if (ow >= 0 && st.t - w.t > 0.3) { w.done = true; o.dRep.push(Math.hypot(st.ball.p[0] - w.p[0], st.ball.p[2] - w.p[2])); o.delai.push(st.t - w.t); o.winRec[1]++; if (st.players[ow].team === w.team) o.winRec[0]++; } else if (st.t - w.t > 8) w.done = true; }
    for (const w of pendLaunch) { if (w.done) continue; if (st.t - w.t >= 8 && w.gain == null) { const og = st.pitch.ownGoal(w.team); w.gain = Math.abs(st.ball.p[0] - og.x) - w.x0; o.gain.push(w.gain); } if (st.t - w.t >= 10) { w.done = true; if (st.possession.team === w.team) o.launchKept++; } }
    for (; seen < st.events.length; seen++) { const e = st.events[seen]; const by = st.players[e.by];
      if (e.type === 'duel' && e.kind === 'aérien') { o.aer++; if (by) { const f = famDe(by.post); (o.aerWon[f] ??= [0, 0])[1]++; if (e.won) o.aerWon[f][0]++; const c = st.players[e.contre]; if (c) { const g = famDe(c.post); (o.aerWon[g] ??= [0, 0])[1]++; if (!e.won) o.aerWon[g][0]++; } } }
      if (e.type === 'tête' && by) { o.tetes++; pendTete.push({ t: st.t, p: [by.p[0], by.p[2]], team: by.team, done: false }); if (e.mode === 'dégagement') o.lens.degagement.push(0); }
      if (e.type === 'duel' && e.kind === 'épaule') { o.sol++; o.debout++; }
      if (e.type === 'tacle-pique') { o.sol++; o.debout++; }
      if (e.type === 'slide') { o.sol++; o.slides++; if (e.faute) o.slideFaute++; }
      if (e.type === 'faute') { o.fautes++; if (e.kind && !e.kind.startsWith('tacle-gliss')) o.deboutFaute++; if (by) { const og = st.pitch.ownGoal(by.team); const x = Math.abs((e.p?.[0] ?? by.p[0]) - og.x); const tier = x < 35 ? 'def' : x < 70 ? 'mil' : 'off'; o.fautesTiers[tier] = (o.fautesTiers[tier] ?? 0) + 1; } }
      if (e.type === 'carton') { if (e.couleur === 'jaune') o.jaunes++; else o.rouges++; }
      if (e.type === 'sortie' && e.out === 'touche') o.touches++;
      if (e.type === 'sortie' && e.out === 'sortie-de-but') sixT = st.t;
      if (e.type === 'rentrée' && e.genre === 'longue') o.lens.longue.push(e.range);
      if (e.type === 'pass' && by) { o.passes++; const to = st.players[e.to]; const d = to ? Math.hypot(to.p[0] - by.p[0], to.p[2] - by.p[2]) : 0; if (by.keeper && st.t - sixT < 30 && st.t - sixT > 0) { o.lens.six.push(d); sixT = -9; } if (d >= 32 && e.style !== 'centre' && e.style !== 'cross') { o.longues++; o.launch++; const og = st.pitch.ownGoal(by.team); pendLaunch.push({ t: st.t, team: by.team, x0: Math.abs(by.p[0] - og.x), done: false, gain: null }); } }
    }
  }
}
const q = (a, x) => { a = [...a].sort((u, v) => u - v); return a.length ? a[Math.floor(x * a.length)] : NaN; }; const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN; const n = o.n;
console.log(`${n} × 90 min`);
console.log(`D1  duels aériens contestés / match : ${(o.aer / n).toFixed(0)} (cible 43 ±20 %), têtes jouées ${(o.tetes / n).toFixed(0)} ; D2 duels au sol (épaule + tacle-pique + glissés) : ${(o.sol / n).toFixed(0)} (cible 39 ±25 %)`);
console.log(`D3  P(aérien gagné) par poste : ${Object.entries(o.aerWon).map(([f, c]) => `${f} ${(100 * c[0] / Math.max(1, c[1])).toFixed(0)} % (${c[1]})`).join(', ')} (cible DF 55,7 / MD 41,8 / FW 35,9)`);
console.log(`D7  distance tête → reprise : p50 ${q(o.dRep, 0.5).toFixed(1)} m, p90 ${q(o.dRep, 0.9).toFixed(1)} (cible 12,2 / 25,8) ; D10 P(l'équipe du frappeur récupère) ${(100 * o.winRec[0] / Math.max(1, o.winRec[1])).toFixed(0)} % (cible 45,1 au milieu) ; D12 délai tête → contrôle p50 ${q(o.delai, 0.5).toFixed(2)} s, p90 ${q(o.delai, 0.9).toFixed(2)} (cible 2,25 / 4,46)`);
console.log(`D14 possession conservée 10 s après une passe ≥ 32 m : ${(100 * o.launchKept / Math.max(1, o.launch)).toFixed(0)} % (cible 28,6) sur ${o.launch} ; D15 gain territorial à 8 s : p50 ${q(o.gain, 0.5).toFixed(1)} m (cible +35,7)`);
console.log(`D17 longueur médiane : rentrée longue ${q(o.lens.longue, 0.5).toFixed(1)} m (${o.lens.longue.length}), six mètres (première passe du gardien) ${q(o.lens.six, 0.5).toFixed(1)} m (${o.lens.six.length}) (cible 43,6 / 65,6) ; dégagements de la tête ${o.lens.degagement.length}`);
console.log(`D20 tacles glissés / match : ${(o.slides / n).toFixed(1)} (cible 6,7) ; D21 P(faute) glissé ${(100 * o.slideFaute / Math.max(1, o.slides)).toFixed(0)} % (24,2) / debout ${(100 * o.deboutFaute / Math.max(1, o.debout)).toFixed(0)} % (14,0) ; D24 fautes ${(o.fautes / n).toFixed(1)} (26,3), jaunes ${(o.jaunes / n).toFixed(1)} (3,9-4,4), rouges ${(o.rouges / n).toFixed(2)} (0,10-0,20)`);
const ft = o.fautesTiers; const tot = Object.values(ft).reduce((a, b) => a + b, 0); console.log(`D23 fautes par tiers du fautif (def / mil / off) : ${['def', 'mil', 'off'].map((k) => (100 * (ft[k] ?? 0) / Math.max(1, tot)).toFixed(0) + ' %').join(' / ')} (cible P(faute) 8,5 / 18,9 / 22,0 — part, pas probabilité)`);
console.log(`D30 touches / match : ${(o.touches / n).toFixed(0)} (cible 44 ±20 %) ; D33 part des passes ≥ 32 m : ${(100 * o.longues / Math.max(1, o.passes)).toFixed(1)} % (cible 7,9-19,7, médiane 13,8)`);
