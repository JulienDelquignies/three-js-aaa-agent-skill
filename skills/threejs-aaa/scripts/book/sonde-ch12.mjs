// sonde ch12 (Bible 12, marquage) — T1/T2/T3 distance au plus proche adversaire, T4 doubles prises, T5 orphelins, T7 taux de commutation, T10 corners, T17 invariant, T18 distance d'intervention.
import { makeMatch, matchStep, matchCfg } from '../../assets/starter/src/engine/match-sim.js';
import { momentDuJeu } from '../../assets/starter/src/engine/phases.js';
const seeds = (process.argv[2] ?? '3,7').split(',').map(Number);
const famDe = (post) => post < 4 ? (post === 0 || post === 3 ? 'LAT' : 'DC') : post < 7 ? (post === 5 ? 'MDC' : 'MIL') : 'ATT';
const o = { n: 0, dNear: [], parFam: {}, parMin: {}, double: 0, orph: 0, orphImgs: 0, imgs: 0, commut: 0, minutesMark: 0, corners: 0, butsCorner: 0, buts: 0, invar: 0, interv: [], dMark: [] };
for (const seed of seeds) {
  const st = makeMatch({ full: true, seed }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: 2700, pause: 10 } }); o.n++;
  let seen = 0; const prevA = new Map(); let orphSince = new Map(); const cornerT = [];
  for (let i = 0; i < 5400 * 60; i++) {
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break;
    for (; seen < st.events.length; seen++) { const e = st.events[seen]; if (e.type === 'corner-joué') { o.corners++; cornerT.push({ t: st.t, team: st.players[e.by]?.team }); } if (e.type === 'but') { o.buts++; if (cornerT.some((c) => c.team === e.team && st.t - c.t <= 15)) o.butsCorner++; } }
    // T7 / T4 / T17 : l'affectation de marquage (st._bAssign : marqueur → homme) — lue à chaque image
    const A = st._bAssign; if (A && !st.restart) { const seenA = new Set(); for (const [q, a] of A) { if (seenA.has(a.id)) o.double++; seenA.add(a.id); const pv = prevA.get(q); if (pv != null && pv !== a.id) o.commut++; } prevA.clear(); for (const [q, a] of A) prevA.set(q, a.id); const marks = st._bMarks ?? []; for (const a of marks) { if (!seenA.has(a.id)) { if (!orphSince.has(a.id)) orphSince.set(a.id, st.t); } else orphSince.delete(a.id); } for (const [id, t0] of orphSince) if (st.t - t0 > 0.8) { o.orph++; orphSince.set(id, st.t + 99); } }
    if (st.restart || i % 15) continue; o.imgs++; const minute = st.t / 60;
    for (const p of st.players) { if (p.keeper || p.down > 0) continue; let bd = 99; for (const q of st.players) { if (q.team === p.team || q.keeper) continue; const d = Math.hypot(q.p[0] - p.p[0], q.p[2] - p.p[2]); if (d < bd) bd = d; } o.dNear.push(bd); (o.parFam[famDe(p.post)] ??= []).push(bd); const band = minute < 45 ? '0-45' : minute < 60 ? '45-60' : minute < 75 ? '60-75' : '75-90'; (o.parMin[band] ??= []).push(bd); }
    if (A) for (const [q, a] of A) { const m = st.players[q]; if (m) o.dMark.push(Math.hypot(m.p[0] - a.p[0], m.p[2] - a.p[2])); }
    if (st.possession.carrier >= 0 && momentDuJeu(st, 1 - st.possession.team, 6) === 'défense-placée') { const c = st.players[st.possession.carrier]; if (!c.keeper) { let bd = 99; for (const q of st.players) if (q.team !== c.team && !q.keeper && q.down <= 0) bd = Math.min(bd, Math.hypot(q.p[0] - c.p[0], q.p[2] - c.p[2])); const og = st.pitch.ownGoal(1 - c.team); if (Math.abs(c.p[0] - og.x) > 35) o.interv.push(bd); } }
  }
}
const q = (a, x) => { a = [...a].sort((u, v) => u - v); return a.length ? a[Math.floor(x * a.length)] : NaN; }; const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
const n = o.n;
console.log(`${n} × 90 min`);
console.log(`T1  distance moyenne au plus proche adversaire (joueurs de champ, jeu ouvert) : ${mean(o.dNear).toFixed(2)} m, p50 ${q(o.dNear, 0.5).toFixed(2)} (cible 5,16 ±0,6)`);
console.log(`T2  par poste : ${Object.entries(o.parFam).map(([f, a]) => `${f} ${mean(a).toFixed(2)}`).join(', ')} (cible LAT 6,36 > MIL 5,62 > DC 5,46 > MDC 5,21 > ATT 5,11)`);
console.log(`T3  par tranche : ${Object.entries(o.parMin).sort().map(([b, a]) => `${b} ${mean(a).toFixed(2)}`).join(', ')} (cible 5,37 → 5,73 (75e) → 6,04 (90e), dérive progressive)`);
console.log(`T4  doubles prises (deux marqueurs sur le même homme, images) : ${o.double} (cible 2-6 / match en zone mixte) ; T17 invariant (un marqueur, un homme) : ${o.double === 0 ? 'tenu par construction (st._bAssign, glouton avec pris)' : 'violé'}`);
console.log(`T5  orphelins (candidat au marquage sans marqueur > 0,8 s) : ${(o.orph / 2 / n).toFixed(0)} / match / équipe (cible 3-8 avec menace > 0,5 — ici sans filtre de menace)`);
console.log(`T7  taux de commutation (changement d'homme d'un marqueur) : ${(o.commut / (o.imgs * 15 / 3600) / 2).toFixed(1)} / min / équipe (cible 0,8-2,5 ; > 6 clignotement) ; distance marqueur-homme p50 ${q(o.dMark, 0.5).toFixed(1)} m`);
console.log(`T10 corners ${(o.corners / n).toFixed(1)} / match, buts sur corner (≤ 15 s) ${o.butsCorner} / ${o.corners} = ${(100 * o.butsCorner / Math.max(1, o.corners)).toFixed(1)} % (cible 2,0-4,2) ; part des buts ${(100 * o.butsCorner / Math.max(1, o.buts)).toFixed(0)} % (cible 7-11) sur ${o.buts} buts`);
console.log(`T18 distance d'intervention avant sortie (défense placée, ballon > 35 m) : p50 ${q(o.interv, 0.5).toFixed(1)} m (cible 10-15)`);
