// sonde ch02 (Bible 02, gardien) — tests 1, 2, 4-5, 7, 13-14, 15, 18, 20, 21-22, 24 sur le moteur d'aujourd'hui, matchs de 90 min.
import { makeMatch, matchStep, matchCfg } from '../../assets/starter/src/engine/match-sim.js';
const seeds = (process.argv[2] ?? '3,7').split(',').map(Number);
const o = { n: 0, dLine: [], gap: [], gkX: [], lineX: [], horsSurface: 0, horsSurfD: [], shots: 0, buts: 0, arrets: 0, unContreUn: 0, uCuArret: 0, sixM: 0, sixMCourts: 0, gkPass: { c: 0, cOk: 0, m: 0, mOk: 0, l: 0, lOk: 0 }, holdMax: 0, pen: 0, penPlonge: 0, penArret: 0, dist: 0, marche: 0, imgs: 0, jeuS: 0 };
for (const seed of seeds) {
  const st = makeMatch({ full: true, seed }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: 2700, pause: 10 } }); o.n++;
  let seen = 0; const pend = []; let hold = null; const gkPend = []; let lastRestart = null; let penPend = null;
  const gks = [0, 1].map((t) => st.players.find((p) => p.team === t && p.keeper));
  for (let i = 0; i < 5400 * 60; i++) {
    const prevP = gks.map((g) => [g.p[0], g.p[2]]);
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break;
    const enJeu = !st.restart; if (enJeu) o.jeuS += 1 / 60;
    for (const [t, g] of gks.entries()) { const d = Math.hypot(g.p[0] - prevP[t][0], g.p[2] - prevP[t][1]); o.dist += d; if (enJeu) { o.imgs++; if (d * 60 < 2) o.marche++; } }
    if (enJeu && i % 30 === 0) for (const [t, g] of gks.entries()) { const og = st.pitch.ownGoal(t), sg = Math.sign(og.x || 1); const dl = Math.abs(g.p[0] - og.x); o.dLine.push(dl); const defs = st.players.filter((p) => p.team === t && !p.keeper && p.post < 4 && p.down <= 0); if (defs.length) { const xs = defs.map((p) => Math.abs(p.p[0] - og.x)).sort((a, b) => a - b); const med = xs[Math.floor(xs.length / 2)]; o.gap.push(med - dl); o.gkX.push(dl); o.lineX.push(med); } }
    // tenue du ballon aux gants (test 20)
    const ow = st.ball.owner ?? -1; const gkOw = ow >= 0 && st.players[ow].keeper ? ow : -1;
    if (gkOw >= 0) { if (!hold || hold.id !== gkOw) hold = { id: gkOw, t0: st.t }; o.holdMax = Math.max(o.holdMax, st.t - hold.t0); } else hold = null;
    // actions hors surface (test 4-5) : le gardien touche le ballon hors de sa surface
    for (const [t, g] of gks.entries()) { const og = st.pitch.ownGoal(t); if (ow === g.id && Math.abs(g.p[0] - og.x) > st.pitch.dims.box.depth && !(g._horsS)) { g._horsS = true; o.horsSurface++; o.horsSurfD.push(Math.abs(g.p[0] - og.x)); } if (ow !== g.id) g._horsS = false; }
    for (const s of pend) if (!s.done) { const sc = st.score[0] + st.score[1]; const so = st.events.slice(s.seen).find((e) => e.type === 'sortie'); if (sc > s.sc) { s.done = 'but'; o.buts++; if (s.uCu) o.unContreUn++; } else if (gkOw >= 0 && st.players[gkOw].team !== s.team) { s.done = 'arret'; o.arrets++; if (s.uCu) { o.unContreUn++; o.uCuArret++; } } else if (so) s.done = 'sortie'; else if (ow >= 0 && st.t - s.t > 0.3) s.done = 'corps'; else if (st.t - s.t > 4) s.done = 'perdu'; }
    for (const s of gkPend) if (!s.done) { if (ow >= 0 && st.t - s.t > 0.2) { s.done = true; const okP = st.players[ow].team === s.team; const k = s.d < 20 ? 'c' : s.d < 40 ? 'm' : 'l'; o.gkPass[k]++; if (okP) o.gkPass[k + 'Ok']++; } else if (st.events.slice(s.seen).some((e) => e.type === 'sortie') || st.t - s.t > 6) { s.done = true; const k = s.d < 20 ? 'c' : s.d < 40 ? 'm' : 'l'; o.gkPass[k]++; } }
    if (penPend && !penPend.done) { const e = st.events.slice(penPend.seen); if (e.some((x) => x.type === 'dive' && st.players[x.by]?.keeper)) penPend.plonge = true; const sc = st.score[0] + st.score[1]; if (sc > penPend.sc) { penPend.done = true; if (penPend.plonge) o.penPlonge++; } else if (st.t - penPend.t > 3) { penPend.done = true; if (penPend.plonge) o.penPlonge++; if (gkOw >= 0 || e.some((x) => x.type === 'sortie')) o.penArret++; } }
    for (; seen < st.events.length; seen++) { const e = st.events[seen];
      if (e.type === 'shot') { o.shots++; const by = st.players[e.by]; const gk = gks[1 - by.team]; const defsEntre = st.players.filter((p) => p.team !== by.team && !p.keeper && p.down <= 0 && Math.abs(p.p[0] - st.pitch.ownGoal(p.team).x) < Math.abs(by.p[0] - st.pitch.ownGoal(p.team).x)).length; pend.push({ t: st.t, seen: seen + 1, sc: st.score[0] + st.score[1], team: by.team, uCu: defsEntre === 0 && Math.hypot(by.p[0] - gk.p[0], by.p[2] - gk.p[2]) < 14 }); }
      if ((e.type === 'pass' || e.type === 'relance-main') && st.players[e.by]?.keeper) { const g = st.players[e.by]; const r = st.players[e.to]; const d = r ? Math.hypot(r.p[0] - g.p[0], r.p[2] - g.p[2]) : 45; gkPend.push({ t: st.t, seen: seen + 1, team: g.team, d }); if (lastRestart === 'sortie-de-but' && st.t - lastRestartT < 3) { o.sixM++; if (d < 25) o.sixMCourts++; } }
      if (e.type === 'restart-pris' || e.type === 'sortie') { lastRestart = e.out ?? e.kind ?? e.restart ?? lastRestart; var lastRestartT = st.t; if (/penalty/.test(JSON.stringify(e)) && e.type === 'sortie') { o.pen++; penPend = { t: st.t, seen: seen + 1, sc: st.score[0] + st.score[1] }; } }
    }
  }
}
const q = (a, x) => { a = [...a].sort((u, v) => u - v); return a.length ? a[Math.floor(x * a.length)] : NaN; }; const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
const corr = (a, b) => { const ma = mean(a), mb = mean(b); let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < a.length; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; } return sab / Math.sqrt(saa * sbb); };
console.log(`${o.n} matchs de 90 min, ${(o.jeuS / 60 / o.n).toFixed(0)} s de jeu par match`);
console.log(`1   distance moyenne gardien-ligne : ${mean(o.dLine).toFixed(1)} m (cible 13,1 ±1,5 ; < 8 = scotché)`);
console.log(`2   X_backline − X_gk : ${mean(o.gap).toFixed(1)} m (cible 20,4 ±2,5) ; corrélation gardien/ligne r = ${corr(o.gkX, o.lineX).toFixed(2)} (cible ≥ 0,5)`);
console.log(`4-5 actions du gardien hors surface : ${(o.horsSurface / o.n).toFixed(1)} / match (cible 0,4-2,0) à ${mean(o.horsSurfD).toFixed(1)} m du but (cible 14-17)`);
console.log(`7   tirs ${o.shots}, buts ${o.buts}, arrêts ${o.arrets} → save % ${(100 * o.arrets / Math.max(1, o.arrets + o.buts)).toFixed(0)} (cible 68-72) ; cadrées ${(100 * (o.arrets + o.buts) / Math.max(1, o.shots)).toFixed(0)} % des tirs`);
console.log(`13-14 1v1 (aucun défenseur entre tireur et but, gardien < 14 m) : ${o.unContreUn} → arrêt ${(100 * o.uCuArret / Math.max(1, o.unContreUn)).toFixed(0)} % (cible 42-50) ; ${(o.unContreUn / (o.jeuS / 3600) * 60).toFixed(1)} / 60 min de jeu (cible 1,0)`);
console.log(`15  six mètres courts (< 25 m) : ${o.sixMCourts}/${o.sixM} = ${(100 * o.sixMCourts / Math.max(1, o.sixM)).toFixed(0)} % (cible 50-80)`);
console.log(`18  réussite des passes du gardien : < 20 m ${o.gkPass.cOk}/${o.gkPass.c}, 20-40 ${o.gkPass.mOk}/${o.gkPass.m}, > 40 ${o.gkPass.lOk}/${o.gkPass.l} (cibles 90-95 / ? / 45-60 %)`);
console.log(`20  tenue max aux gants : ${o.holdMax.toFixed(1)} s (règle 2025/26 : < 8 s, corner dès l'infraction ; le moteur : gkRelease 3 s)`);
console.log(`21-22 penalties : ${o.pen}, plongeons ${o.penPlonge}, arrêts ${o.penArret} (cibles 93,7 % de plongeons, 15-21 % d'arrêts)`);
console.log(`24  distance parcourue par gardien : ${(o.dist / (2 * o.n)).toFixed(0)} m / match (cible 4 800-5 600) ; marche (< 2 m/s) ${(100 * o.marche / o.imgs).toFixed(0)} % (cible 68-73)`);
