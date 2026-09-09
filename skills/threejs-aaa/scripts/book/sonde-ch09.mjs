// sonde ch09 (Bible 09, le 9) — T1 taux de service, T2bis types de course, T4 distance du 9 au porteur en pressing, T7 récupérations hautes → tir, T8 hors-jeu du 9, T13 buts dedans/dehors + conversion, T13bis golden zone, T14 buts en une touche, T17 corps à la finition d'un contre, T19 pinCount, T24 touches du 9. 4-3-3, le 9 = ST(C) poste 8.
import { makeMatch, matchStep, matchCfg } from '../../assets/starter/src/engine/match-sim.js';
import { momentDuJeu } from '../../assets/starter/src/engine/phases.js';
const seeds = (process.argv[2] ?? '3,7').split(',').map(Number);
const o = { n: 0, courses: 0, servies: 0, types: {}, pressD: [], recupHautes: 0, recupTir: 0, horsJeu9: 0, tirs: 0, tirsBoite: 0, buts: 0, butsBoite: 0, tirsGZ: 0, butsGZ: 0, butsUneTouche: 0, contreFin: [], pin: [], imgsBas: 0, touches9: 0, jeu: 0 };
for (const seed of seeds) {
  const st = makeMatch({ full: true, seed }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: 2700, pause: 10 } }); o.n++;
  const neuf = [0, 1].map((t) => st.players.find((p) => p.team === t && p.post === 8));
  let seen = 0; const pendRun = [], pendShot = [], pendRec = []; let prevOwner = -1, prevPoss = -1, possStart = -1, possStartX = 0, lastTouchT = {};
  for (let i = 0; i < 5400 * 60; i++) {
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break; if (!st.restart) o.jeu++;
    const ow = st.ball.owner ?? -1; if (ow !== prevOwner) { if (ow >= 0 && neuf.some((n) => n && n.id === ow)) o.touches9++; prevOwner = ow; }
    const poss = st.possession.team; if (poss !== prevPoss && poss >= 0) { const og = st.pitch.attackGoal(poss); const dOpp = Math.abs(st.ball.p[0] - og.x); if (prevPoss >= 0 && !st.restart && dOpp < 40) { o.recupHautes++; pendRec.push({ t: st.t, team: poss, seen: seen, done: false }); } possStart = st.t; prevPoss = poss; }
    for (const r of pendRec) if (!r.done) { if (st.possession.team !== r.team) r.done = true; else if (st.events.slice(r.seen).some((e) => e.type === 'shot' && st.players[e.by]?.team === r.team)) { r.done = true; o.recupTir++; } }
    for (const r of pendRun) if (!r.done && st.t - r.t > 3) { r.done = true; }
    for (const s of pendShot) if (!s.done) { const sc = st.score[0] + st.score[1]; if (sc > s.sc) { s.done = true; o.buts++; if (s.boite) o.butsBoite++; if (s.gz) o.butsGZ++; if (s.uneTouche) o.butsUneTouche++; if (s.contre) o.contreFin.push(s.corps); } else if (st.t - s.t > 3) s.done = true; }
    for (; seen < st.events.length; seen++) { const e = st.events[seen]; const by = st.players[e.by ?? e.from];
      if (e.type === 'burst' && by && neuf.some((n) => n && n.id === by.id)) { o.courses++; o.types[e.kind] = (o.types[e.kind] ?? 0) + 1; pendRun.push({ t: st.t, id: by.id }); }
      if (e.type === 'pass' && st.players[e.to] && neuf.some((n) => n && n.id === e.to)) { const r = pendRun.find((x) => !x.done && x.id === e.to && st.t - x.t <= 3); if (r) { r.done = true; o.servies++; } }
      if (e.type === 'hors-jeu' && neuf.some((n) => n && n.id === (e.by ?? e.joueur))) o.horsJeu9++;
      if (e.type === 'shot' && by) { o.tirs++; const g = st.pitch.attackGoal(by.team); const dx = Math.abs(by.p[0] - g.x), dz = Math.abs(by.p[2]); const boite = dx < 16.5 && dz < 20.16, gz = dx < 16.5 && dz <= 9.16; if (boite) o.tirsBoite++; if (gz) o.tirsGZ++; const lastCtl = [...st.events].reverse().find((x) => x.type === 'control' && x.by === by.id); const uneTouche = !lastCtl || st.t - lastCtl.t > 1.5 || (lastTouchT[by.id] != null && st.t - lastTouchT[by.id] < 0.25); const contre = momentDuJeu(st, by.team, 6) === 'transition-off'; const corps = st.players.filter((p) => p.team === by.team && !p.keeper && Math.abs(p.p[0] - g.x) < 20 && Math.abs(p.p[2]) < 22).length; pendShot.push({ t: st.t, sc: st.score[0] + st.score[1], boite, gz, uneTouche, contre, corps }); }
      if (e.type === 'control' && by) lastTouchT[by.id] = st.t;
    }
    if (st.restart || i % 15 || poss < 0) continue;
    const def = 1 - poss; const n9 = neuf[def]; if (n9 && n9.job === 'press') { const c = st.possession.carrier >= 0 ? st.players[st.possession.carrier] : null; if (c) o.pressD.push(Math.hypot(n9.p[0] - c.p[0], n9.p[2] - c.p[2])); }
    if (n9 && momentDuJeu(st, def, 6) === 'défense-placée') { const ogD = st.pitch.ownGoal(def); if (Math.abs(st.ball.p[0] - ogD.x) < 35) { o.imgsBas++; o.pin.push(st.players.filter((p) => p.team === poss && !p.keeper && Math.hypot(p.p[0] - n9.p[0], p.p[2] - n9.p[2]) < 8).length); } }
  }
}
const q = (a, x) => { a = [...a].sort((u, v) => u - v); return a.length ? a[Math.floor(x * a.length)] : NaN; }; const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN; const pct = (a, b) => (100 * a / Math.max(1, b)).toFixed(0);
console.log(`${o.n} × 90 min, 4-3-3 — bursts du 9 par type : ${JSON.stringify(o.types)}`);
console.log(`T1  taux de service des courses du 9 (passe vers lui ≤ 3 s) : ${pct(o.servies, o.courses)} % (15-40) sur ${o.courses} bursts`);
console.log(`T4  distance du 9 au porteur quand il presse : 3-5 m dans ${pct(o.pressD.filter((d) => d >= 3 && d <= 5).length, o.pressD.length)} % des images (≥ 70), p50 ${q(o.pressD, 0.5).toFixed(1)} m`);
console.log(`T7  récupérations hautes (< 40 m du but adverse) : ${(o.recupHautes / o.n).toFixed(1)} / match (7-8,5), dont → tir ${pct(o.recupTir, o.recupHautes)} % (12-22)`);
console.log(`T8  hors-jeu du 9 : ${(o.horsJeu9 / o.n).toFixed(1)} / 90 (0,3-1,2) ; T24 touches du 9 : ${(o.touches9 / (o.jeu / 3600) * 90).toFixed(0)} / 90 (18-28 surface, 45-65 liaison)`);
console.log(`T13 buts dans la surface ${pct(o.butsBoite, o.buts)} % (84-88) ; conversion dedans ${pct(o.butsBoite, o.tirsBoite)} % (14-16), dehors ${pct(o.buts - o.butsBoite, o.tirs - o.tirsBoite)} % (3-5) ; T13bis golden zone : ${pct(o.tirsGZ, o.tirs)} % des tirs (≈ 50), ${pct(o.butsGZ, o.buts)} % des buts (≈ 82) — ${o.tirs} tirs, ${o.buts} buts`);
console.log(`T14 buts en une touche : ${pct(o.butsUneTouche, o.buts)} % (50-75) ; T17 corps aux abords à la finition d'un contre : moyenne ${mean(o.contreFin).toFixed(1)} (3-5) sur ${o.contreFin.length}`);
console.log(`T19 pinCount du 9 en bloc bas (adversaires à < 8 m) : moyenne ${mean(o.pin).toFixed(2)} (1,5-2,4)`);
