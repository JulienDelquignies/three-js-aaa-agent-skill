// sonde ch08 (Bible 08, ailiers) — 1 largeur d'équipe, 2 dyT côté ballon en sortie basse, 3 écart opposé − côté ballon, 4 surnombre au couloir, 5-6 dribbles, 10 ailier opposé au centre, 12-14 centres/cutbacks, 15 distance, 17 sprints, 21 délai de pressing, 23 deux à la craie, 27 touches. 4-3-3, ailiers = 7 et 9.
import { makeMatch, matchStep, matchCfg } from '../../assets/starter/src/engine/match-sim.js';
import { momentDuJeu } from '../../assets/starter/src/engine/phases.js';
const seeds = (process.argv[2] ?? '3,7').split(',').map(Number);
const o = { n: 0, larg: [], dyTBallon: [], ecart: [], surn: 0, surnN: 0, dribbles: 0, dribOk: 0, opp10: 0, centres: 0, centresAil: 0, cutbacks: 0, dist: 0, sprints: 0, pressDelai: [], deuxCraie: 0, imgsPoss: 0, touches: 0 };
for (const seed of seeds) {
  const st = makeMatch({ full: true, seed }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: 2700, pause: 10 } }); o.n++;
  const ail = [0, 1].map((t) => st.players.filter((p) => p.team === t && (p.post === 7 || p.post === 9))); const hz = st.pitch.hz;
  let seen = 0; const prevP = new Map(), sprintOn = new Map(); const pendCoul = [], pendDrib = [], pendPress = [];
  for (let i = 0; i < 5400 * 60; i++) {
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break;
    for (const t of [0, 1]) for (const p of ail[t]) { const pv = prevP.get(p.id); if (pv) o.dist += Math.hypot(p.p[0] - pv[0], p.p[2] - pv[1]); prevP.set(p.id, [p.p[0], p.p[2]]); const v = Math.hypot(p.v?.[0] ?? 0, p.v?.[1] ?? 0); if (v > 7.0 && !sprintOn.get(p.id)) { sprintOn.set(p.id, true); o.sprints++; } if (v < 6) sprintOn.set(p.id, false); }
    for (const c of pendCoul) if (!c.done && st.t >= c.at) { c.done = true; const n = st.players.filter((p) => p.team === c.team && !p.keeper && Math.hypot(p.p[0] - st.ball.p[0], p.p[2] - st.ball.p[2]) < 18).length; o.surnN++; if (n >= 3) o.surn++; }
    for (const d of pendDrib) if (!d.done && st.t - d.t > 1.5) { d.done = true; const ow = st.ball.owner ?? -1; if (ow >= 0 && st.players[ow].team === d.team) o.dribOk++; }
    for (const pr of pendPress) if (!pr.done) { const p = pr.p; if (p.job === 'press' && p.target && Math.hypot(p.target[0] - pr.lat.p[0], p.target[2] - pr.lat.p[2]) < 4) { pr.done = true; o.pressDelai.push(st.t - pr.t); } else if (st.t - pr.t > 2) pr.done = true; }
    for (; seen < st.events.length; seen++) { const e = st.events[seen]; const by = st.players[e.by]; if (!by) continue; const estAil = ail[by.team].some((p) => p.id === by.id);
      if (e.type === 'skill' && estAil) { o.dribbles++; pendDrib.push({ t: st.t, team: by.team }); }
      if (e.type === 'centre') { o.centres++; if (estAil) o.centresAil++; if (e.bas) o.cutbacks++; const other = ail[by.team].find((p) => p.id !== by.id && Math.sign(p.p[2]) !== Math.sign(by.p[2])) ?? ail[by.team].find((p) => p.id !== by.id); const g = st.pitch.attackGoal(by.team); if (other && hz - Math.abs(other.p[2]) >= 10 && hz - Math.abs(other.p[2]) <= 18 && Math.abs(other.p[0] - g.x) <= 10) o.opp10++; }
      if (e.type === 'pass' && !estAil) { const r = st.players[e.to]; if (r && (r.post === 0 || r.post === 3) && r.team === by.team) { const ogR = st.pitch.ownGoal(r.team); if (Math.abs(r.p[0] - ogR.x) < 40) { const a = ail[1 - r.team].find((p) => Math.sign(p.p[2]) === Math.sign(r.p[2])); if (a) pendPress.push({ t: st.t, p: a, lat: r }); } } }
      if (e.type === 'sortie' && e.out === 'touche') o.touches++;
      if (e.type === 'pass') { const r = st.players[e.to]; if (r && Math.abs(r.p[2]) > hz * 0.6) { const g = st.pitch.attackGoal(by.team); if (Math.abs(r.p[0] - g.x) < 45) pendCoul.push({ at: st.t + 3, team: by.team }); } }
    }
    if (st.restart || i % 15) continue; const poss = st.possession.team; if (poss < 0) continue; o.imgsPoss++;
    const att = st.players.filter((p) => p.team === poss && !p.keeper && p.down <= 0); const zs = att.map((p) => p.p[2]); o.larg.push(Math.max(...zs) - Math.min(...zs));
    const og = st.pitch.ownGoal(poss); const xB = Math.abs(st.ball.p[0] - og.x); const cote = Math.sign(st.ball.p[2] || 1);
    const aB = ail[poss].find((p) => Math.sign(p.p[2]) === cote), aO = ail[poss].find((p) => Math.sign(p.p[2]) !== cote);
    if (aB && aO) { const dB = hz - Math.abs(aB.p[2]), dO = hz - Math.abs(aO.p[2]); if (xB < 30) o.dyTBallon.push(dB); if (momentDuJeu(st, poss, 6) === 'attaque-placée') o.ecart.push(dO - dB); }
    for (const s of [1, -1]) { const n = att.filter((p) => Math.sign(p.p[2]) === s && hz - Math.abs(p.p[2]) < 4 && Math.abs(p.p[0] - og.x) > 55).length; if (n >= 2) { o.deuxCraie++; break; } }
  }
}
const q = (a, x) => { a = [...a].sort((u, v) => u - v); return a.length ? a[Math.floor(x * a.length)] : NaN; }; const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN; const pct = (a, b) => (100 * a / Math.max(1, b)).toFixed(0);
console.log(`${o.n} × 90 min, 4-3-3`);
console.log(`1   largeur d'équipe en possession : moyenne ${mean(o.larg).toFixed(1)} m (41-47), P10 ${q(o.larg, 0.1).toFixed(1)} (≤ 34), P90 ${q(o.larg, 0.9).toFixed(1)} (≥ 58)`);
console.log(`2   dyT de l'ailier côté ballon en sortie basse (< 30 m) : p50 ${q(o.dyTBallon, 0.5).toFixed(1)} m (1-2,5 ; > 6 = dérive) ; 3 écart opposé − côté ballon en attaque placée : p50 ${q(o.ecart, 0.5).toFixed(1)} m (+8 à +16)`);
console.log(`4   ≥ 3 coéquipiers à < 18 m du ballon 3 s après une entrée dans le couloir haut : ${pct(o.surn, o.surnN)} % (≥ 70)`);
console.log(`5-6 dribbles par ailier : ${(o.dribbles / 4 / o.n).toFixed(1)} / match (4,3 ±3,7), réussite (ballon gardé à +1,5 s) ${pct(o.dribOk, o.dribbles)} % (40-50)`);
console.log(`10  ailier opposé à dyT 10-18 m et x ≤ 10 m du but au centre : ${pct(o.opp10, o.centres)} % des centres (≥ 60) ; 12 centres par ailier ${(o.centresAil / 4 / o.n).toFixed(1)} (3,8 ±2,4) ; 14 cutbacks / équipe ${(o.cutbacks / 2 / o.n).toFixed(1)} (1,5 ±0,8)`);
console.log(`15  distance d'un ailier : ${(o.dist / 4 / o.n).toFixed(0)} m (10,0-10,9 km) ; 17 sprints > 7 m/s : ${(o.sprints / 4 / o.n).toFixed(0)} / ailier / match (13 ±5)`);
console.log(`21  délai passe vers le latéral adverse → l'ailier presse le latéral : p50 ${q(o.pressDelai, 0.5).toFixed(2)} s (0-0,25) sur ${o.pressDelai.length} ; 23 deux coéquipiers à dyT < 4 m sur le même flanc haut : ${pct(o.deuxCraie, o.imgsPoss)} % (< 3)`);
console.log(`27  touches par match : ${(o.touches / o.n).toFixed(0)} (35-45)`);
