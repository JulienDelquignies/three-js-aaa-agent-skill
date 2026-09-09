// sonde ch07 (Bible 07, le 10) — T1 poche h, T2 réceptions dans la poche, T3 repositionnements, T5 courses HI, T6 distance, T7 orientation à la réception, T11 profondeur précédée d'un appel, T13 duplication de slot, T14 pausa, T21 invariant de bloc, T23 contre-press après perte du 10. 4-2-3-1, le 10 = AM(C) poste 7.
import { makeMatch, matchStep, matchCfg } from '../../assets/starter/src/engine/match-sim.js';
import { momentDuJeu } from '../../assets/starter/src/engine/phases.js';
const seeds = (process.argv[2] ?? '3,7').split(',').map(Number), tacAdv = JSON.parse(process.argv[3] ?? 'null');
const o = { n: 0, h: [], rec: 0, recPoche: 0, repos: [], hi: 0, dist: 0, orient: { ouvert: 0, troisQuarts: 0, dos: 0 }, prof: 0, profAppel: 0, dup: 0, centres: 0, pausa: 0, bloc25: 0, imgsDef: 0, pertes10: 0, recup5: 0 };
for (const seed of seeds) {
  const T0 = { formation: 4231 }, T1 = { formation: 4231, ...(tacAdv ?? {}) }; const st = makeMatch({ full: true, seed, tactics: [T0, T1] }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: 2700, pause: 10 } }); o.n++;
  const dix = st.players.find((p) => p.team === 0 && p.post === 7); let seen = 0, prevTgt = null, prevP = null, hiOn = false, holdT0 = -1, pausaW = null, lastAppelT = -99, prevOwner = -1, perteAt = -1;
  for (let i = 0; i < 5400 * 60; i++) {
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break;
    if (prevP) o.dist += Math.hypot(dix.p[0] - prevP[0], dix.p[2] - prevP[1]); prevP = [dix.p[0], dix.p[2]];
    const v = Math.hypot(dix.v?.[0] ?? 0, dix.v?.[1] ?? 0); if (v > 5.83 && !hiOn) { hiOn = true; o.hi++; } if (v < 5.0) hiOn = false;
    const ow = st.ball.owner ?? -1;
    if (ow === dix.id) { const vb = Math.hypot(st.ball.v[0], st.ball.v[2]); if (vb < 1.0 && v < 1.5) { pausaW = pausaW ?? st.t; } else { if (pausaW != null && st.t - pausaW >= 0.6 && st.t - pausaW <= 2.5) o.pausa++; pausaW = null; } } else { if (pausaW != null && st.t - pausaW >= 0.6 && st.t - pausaW <= 2.5) o.pausa++; pausaW = null; }
    if (prevOwner === dix.id && ow >= 0 && st.players[ow].team === 1) { o.pertes10++; perteAt = st.t; } if (perteAt >= 0 && st.t - perteAt <= 5 && ow >= 0 && st.players[ow].team === 0) { o.recup5++; perteAt = -1; } if (perteAt >= 0 && st.t - perteAt > 5) perteAt = -1; if (ow >= 0) prevOwner = ow;
    for (; seen < st.events.length; seen++) { const e = st.events[seen];
      if (e.type === 'burst' && (e.kind === 'appel' || e.kind === 'contre-appel' || e.kind === 'deborde') && st.players[e.by]?.team === 0) lastAppelT = st.t;
      if ((e.type === 'piqué' || (e.type === 'pass' && e.through)) && st.players[e.by]?.team === 0) { o.prof++; if (st.t - lastAppelT <= 2.0) o.profAppel++; }
      if (e.type === 'control' && e.by === dix.id && !e.miss) { o.rec++; const g = st.pitch.attackGoal(0); const a = Math.atan2(-dix.p[2], g.x - dix.p[0]); let d = Math.abs(((dix.yaw - a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI) * 180 / Math.PI; if (d <= 45) o.orient.ouvert++; else if (d <= 110) o.orient.troisQuarts++; else o.orient.dos++;
        const ogA = st.pitch.ownGoal(1); const D = st.players.filter((p) => p.team === 1 && !p.keeper && p.post < 4), M = st.players.filter((p) => p.team === 1 && (p.post === 4 || p.post === 5)); if (D.length && M.length) { const xF = Math.max(...D.map((p) => Math.abs(p.p[0] - ogA.x))), xB = Math.min(...M.map((p) => Math.abs(p.p[0] - ogA.x))); const x10 = Math.abs(dix.p[0] - ogA.x); if (x10 > xF && x10 < xB) o.recPoche++; } }
      if (e.type === 'centre' && st.players[e.by]?.team === 0) { o.centres++; const g = st.pitch.attackGoal(0); const box = st.players.filter((p) => p.team === 0 && !p.keeper && Math.abs(p.p[0] - g.x) < 16.5 && Math.abs(p.p[2]) < 20.16); let dup = false; for (let a = 0; a < box.length; a++) for (let b = a + 1; b < box.length; b++) if (Math.hypot(box[a].p[0] - box[b].p[0], box[a].p[2] - box[b].p[2]) < 3) dup = true; if (dup) o.dup++; }
    }
    if (st.restart || i % 15) continue;
    if (dix.target && dix.job === "support") { if (prevTgt) { const d = Math.hypot(dix.target[0] - prevTgt[0], dix.target[2] - prevTgt[2]); if (d > 0.5) o.repos.push(d); } prevTgt = [dix.target[0], dix.target[2]]; }
    if (st.possession.team === 0 && momentDuJeu(st, 1, 6) === 'défense-placée') { o.imgsDef++; const ogA = st.pitch.ownGoal(1); const D = st.players.filter((p) => p.team === 1 && !p.keeper && p.post < 4), M = st.players.filter((p) => p.team === 1 && (p.post === 4 || p.post === 5)), A = st.players.filter((p) => p.team === 1 && p.post >= 6); if (D.length && M.length && A.length) { const xF = Math.max(...D.map((p) => Math.abs(p.p[0] - ogA.x))), xD0 = Math.min(...D.map((p) => Math.abs(p.p[0] - ogA.x))), xB = Math.min(...M.map((p) => Math.abs(p.p[0] - ogA.x))), xA = Math.max(...A.map((p) => Math.abs(p.p[0] - ogA.x))); o.h.push(xB - xF); if (xA - xD0 <= 25) o.bloc25++; } }
  }
}
const q = (a, x) => { a = [...a].sort((u, v) => u - v); return a.length ? a[Math.floor(x * a.length)] : NaN; }; const pct = (a, b) => (100 * a / Math.max(1, b)).toFixed(0);
console.log(`adversaire ${JSON.stringify(tacAdv)} — ${o.n} × 90 min, 4-2-3-1`);
console.log(`T1  poche h (ligne des milieux − ligne des D adverses, défense placée) : p50 ${q(o.h, 0.5).toFixed(1)} m (10-15 médian / 5-8 bas)`);
console.log(`T2  réceptions du 10 : ${(o.rec / o.n).toFixed(0)} / match, dont dans la poche ${(o.recPoche / o.n).toFixed(0)} (rapport médian/bas ≥ 3:1 attendu entre les deux mondes)`);
console.log(`T3  repositionnements hors course : amplitude p50 ${q(o.repos, 0.5).toFixed(1)} m (2-5), < 8 m dans ${pct(o.repos.filter((d) => d < 8).length, o.repos.length)} % (≥ 90) ; T4 ratio micro / HI ${(o.repos.filter((d) => d < 8).length / Math.max(1, o.hi)).toFixed(1)} (6-10)`);
console.log(`T5  courses HI (> 5,83 m/s) : ${(o.hi / o.n).toFixed(0)} / match (15-25) ; T6 distance ${(o.dist / o.n).toFixed(0)} m (11 494 ±765)`);
console.log(`T7  orientation à la réception : ouvert ${pct(o.orient.ouvert, o.rec)} % (20-35), trois-quarts ${pct(o.orient.troisQuarts, o.rec)} % (45-60), dos ${pct(o.orient.dos, o.rec)} % (15-30)`);
console.log(`T11 passes en profondeur de l'équipe précédées d'un appel (≤ 2 s) : ${o.profAppel}/${o.prof} = ${pct(o.profAppel, o.prof)} % (> 92) ; T13 duplication de slot au centre : ${pct(o.dup, o.centres)} % des centres (≤ 17)`);
console.log(`T14 pausa (ballon < 1 m/s, joueur < 1,5 m/s, 0,6-2,5 s) : ${(o.pausa / o.n).toFixed(1)} / match ; T21 bloc adverse ≤ 25 m en défense placée : ${pct(o.bloc25, o.imgsDef)} % des images (> 90)`);
console.log(`T23 pertes du 10 : ${o.pertes10}, récupérées en ≤ 5 s ${pct(o.recup5, o.pertes10)} % (14-24)`);
