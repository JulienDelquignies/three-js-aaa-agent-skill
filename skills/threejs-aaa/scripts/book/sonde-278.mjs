// sonde 278 — L'ELLIPSE DE FINITION (sonde-277 + le PLAN NOMINAL : la trajectoire de chaque tir intégrée sans obstacle (predictPath) jusqu'au plan du but — cadre / au-dessus / à côté / montant, et σvert / σhoriz autour du point visé) — LE TIR CONTRE LE MODÈLE 10 : tirs / match (25,3), distance p50 (16) et moyenne (14,8), part dans la surface (64 %), cadrés (33), contrés (27,5), buts / tirs (0,11), buts / match (2,85), arrêts / cadrés dedans / dehors / total (60 / 85 / 69), sorties de but et corners nés d'un tir, têtes (16,9 % des tirs à 9,6 %), espèces ; et le xG en forme close (Sumpter, § 2.2) de CHAQUE tir tenté : moyenne (0,105), médiane (0,06), somme par match c. buts — ce que la porte d'hier laisse passer.
import { makeMatch, matchStep, matchCfg } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/match-sim.js';
import { predictPath } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/ball-predict.js';
const ZMODE = { 'lucarne-ouvert': 3.0, 'bas-ouvert': 2.9, 'mi-ouvert': 2.7, 'bas-ferme': 2.6, 'mi-ferme': 2.4, 'barre-axial': 0, 'axial-bas': 0, 'premier-poteau': 3.3, cadre: 1.5 };   // le z des modes du 277 (le côté se lit sur le franchissement : l'event porte le tz d'hier)
const N = { n: 0, cadre: 0, dessus: 0, cote: 0, deux: 0, montant: 0, dy: [], dz: [], noPlan: 0 };
const seeds = (process.argv[2] ?? '3,7').split(',').map(Number), over = JSON.parse(process.argv[3] ?? '{}'), DUR = +(process.argv[4] ?? 2700);
const o = { n: 0, visee: {}, dessus: 0, cote: 0, shots: 0, buts: 0, arrets: 0, hors: 0, contres: 0, montants: 0, dist: [], xg: [], boite: 0, cadreIn: 0, arrIn: 0, cadreOut: 0, arrOut: 0, sdb: 0, corner: 0, tetes: 0, tetesBut: 0, kinds: {}, deny: {}, parGraine: [], bands: {}, press: 0 };
const hyp = Math.hypot, bandOf = (d) => d < 5 ? '0-5' : d < 8 ? '5-8' : d < 14 ? '8-14' : d < 18 ? '14-18' : d < 23 ? '18-23' : '23+';
const xg0 = (X, C) => { X = Math.min(35, X); C = Math.min(20, C); const A = Math.atan2(7.32 * X, X * X + C * C - 3.66 * 3.66), D = hyp(X, C); const l = 0.5103 + 0.6338 * A - 0.2798 * D + 0.1243 * X - 0.03 * C + 0.0014 * X * X + 0.0041 * C * C - 0.1251 * A * X; return 1 / (1 + Math.exp(-l)); };
for (const seed of seeds) {
  const { _tactics, ...overC } = over; for (const k of ['xg', 'qualiteTir', 'finition', 'ellipse']) if (overC[k] && matchCfg({})[k]) overC[k] = { ...matchCfg({})[k], ...overC[k] };
  const st = makeMatch({ full: true, seed, tactics: _tactics ?? null }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: DUR, pause: 10 }, ...overC }); o.n++;
  let seen = 0; const pend = []; let g0 = 0, s0 = 0, x0 = 0;
  let prevB = null;
  for (let i = 0; i < DUR * 60 * 2.4; i++) {
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break;
    const last0 = pend.slice().reverse().find((w) => !w.done && st.t - w.t < 3);
    if (last0 && prevB) { const g = st.pitch.ownGoal(1 - last0.team); const x0 = prevB[0] - g.x, x1 = st.ball.p[0] - g.x; if (Math.sign(x0) !== Math.sign(x1) && Math.abs(x0) < 3 && !last0.plan) { last0.plan = true; const zz = Math.abs(st.ball.p[2]), yy = st.ball.p[1]; if (zz > 3.66 || yy > 2.44) { if (zz <= 3.66 + 0.6 && yy > 2.44) o.dessus++; else if (zz > 3.66 && yy <= 2.44 + 0.6) o.cote++; } } }
    prevB = [st.ball.p[0], st.ball.p[1], st.ball.p[2]];
    for (const w of pend) { if (w.done) continue; if (st.t - w.t > 4) { w.done = true; if (!w.issue) { w.issue = 'hors'; o.hors++; } } }
    for (; seen < st.events.length; seen++) { const e = st.events[seen]; const by = st.players[e.by];
      if (e.type === 'shot' && by) {
        const g = st.pitch.ownGoal(1 - by.team), X = Math.abs(by.p[0] - g.x), C = Math.abs(by.p[2]), d = hyp(X, C), x = xg0(X, C);
        { const path = predictPath({ p: st.ball.p, v: st.ball.v, w: st.ball.w ?? [0, 0, 0] }, { maxT: 4 }); let cr = null; for (let k = 1; k < path.length; k++) { const a = path[k - 1].p[0] - g.x, b = path[k].p[0] - g.x; if (a * b <= 0 && a !== b) { const u = a / (a - b); cr = [0, 1, 2].map((j) => path[k - 1].p[j] + (path[k].p[j] - path[k - 1].p[j]) * u); break; } }
          if (!cr) N.noPlan++; else { N.n++; const zz = Math.abs(cr[2]), yy = cr[1]; const post = Math.abs(zz - 3.66) <= 0.17 && yy <= 2.44 + 0.17, bar = Math.abs(yy - 2.44) <= 0.17 && zz <= 3.66 + 0.17; if (post || bar) N.montant++; if (zz <= 3.66 && yy <= 2.44) N.cadre++; else if (yy > 2.44 && zz <= 3.66 + 1) N.dessus++; else if (zz > 3.66 && yy <= 2.44 + 1) N.cote++; else N.deux++;
            if (e.yVisee != null && e.kind !== 'tête' && (e.zVisee != null || ZMODE[e.visee] != null)) { N.dy.push(yy - e.yVisee); const zA = e.zVisee ?? Math.sign(cr[2] || 1) * ZMODE[e.visee]; N.dz.push((cr[2] - zA) * Math.sign(zA || 1)); }   /* dz > 0 : vers l'extérieur du poteau visé (zVisee, 278 ; à défaut le z du mode, côté lu sur le franchissement) */ } }
        o.shots++; s0++; x0 += x; o.dist.push(d); o.xg.push(x); const band = bandOf(d), B = (o.bands[band] ??= { n: 0, but: 0, cadre: 0 }); B.n++;
        const boite = X <= st.pitch.dims.box.depth && C <= st.pitch.dims.box.width / 2; if (boite) o.boite++;
        o.kinds[e.kind ?? '?'] = (o.kinds[e.kind ?? '?'] ?? 0) + 1; if (e.kind === 'tête') o.tetes++; o.visee[e.visee ?? '—'] = (o.visee[e.visee ?? '—'] ?? 0) + 1;
        if (st.players.some((q) => q.team !== by.team && !q.keeper && q.down <= 0 && hyp(q.p[0] - by.p[0], q.p[2] - by.p[2]) < 2)) o.press++;
        pend.push({ t: st.t, team: by.team, band, boite, tete: e.kind === 'tête', done: false, issue: null }); continue;
      }
      const last = pend.slice().reverse().find((w) => !w.done && !w.issue && st.t - w.t < 4);
      if (!last) continue;
      if (e.type === 'arrêt' && st.players[e.by].team !== last.team) { last.issue = 'arrêt'; o.arrets++; o.bands[last.band].cadre++; if (last.boite) { o.cadreIn++; o.arrIn++; } else { o.cadreOut++; o.arrOut++; } }
      if (e.type === 'but' && e.team === last.team) { last.issue = 'but'; o.buts++; g0++; o.bands[last.band].but++; o.bands[last.band].cadre++; if (last.boite) o.cadreIn++; else o.cadreOut++; if (last.tete) o.tetesBut++; }
      if (e.type === 'contre') { last.issue = 'contre'; o.contres++; }
      if (e.type === 'pylon' || e.type === 'roof') { last.issue = 'montant'; o.montants++; }
      if (e.type === 'sortie' && (e.out === 'sortie-de-but' || e.out === 'corner')) { last.issue = 'hors'; o.hors++; if (e.out === 'sortie-de-but') o.sdb++; else o.corner++; }
    }
  }
  for (const [k, v] of Object.entries(st.deny ?? {})) o.deny[k] = (o.deny[k] ?? 0) + v;
  o.parGraine.push(`${seed}: ${s0} tirs, ${g0} buts, ΣxG ${x0.toFixed(2)}`);
}
const q = (a, x) => { a = [...a].sort((u, v) => u - v); return a.length ? a[Math.floor(x * a.length)] : NaN; }, n = o.n, pct = (a, b) => (100 * a / Math.max(1, b)).toFixed(1), moy = (a) => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
console.log(`${n} × ${(DUR / 60).toFixed(0)} min ${JSON.stringify(over)} — ${o.parGraine.join(' ; ')}`);
console.log(`tirs / match ${(o.shots / n).toFixed(1)} (25,3) ; buts / match ${(o.buts / n).toFixed(2)} (2,85) ; buts / tirs ${pct(o.buts, o.shots)} % (11) ; distance p50 ${q(o.dist, 0.5).toFixed(1)} m (16), moyenne ${moy(o.dist).toFixed(1)} (14,8) ; dans la surface ${pct(o.boite, o.shots)} % (64) ; sous pression < 2 m ${pct(o.press, o.shots)} %`);
console.log(`cadrés ${pct(o.buts + o.arrets, o.shots)} % (33) ; hors cadre ${pct(o.hors, o.shots)} % (36-38 ; dont sortie de but ${(o.sdb / n).toFixed(1)} / match, corner ${(o.corner / n).toFixed(1)}) ; contrés ${pct(o.contres, o.shots)} % (27,5) ; montants ${pct(o.montants, o.shots)} % (2,3)`);
console.log(`arrêts / cadrés : total ${pct(o.arrets, o.buts + o.arrets)} % (69) ; dedans ${pct(o.arrIn, o.cadreIn)} % (60, ${o.cadreIn} cadrés) ; dehors ${pct(o.arrOut, o.cadreOut)} % (85, ${o.cadreOut} cadrés) ; buts / cadrés ${pct(o.buts, o.buts + o.arrets)} % (32)`);
console.log(`xG (Sumpter, forme close) des tirs tentés : moyenne ${moy(o.xg).toFixed(3)} (0,105), médiane ${q(o.xg, 0.5).toFixed(3)} (0,06), ΣxG / match ${(o.xg.reduce((s, v) => s + v, 0) / n).toFixed(2)} c. ${(o.buts / n).toFixed(2)} buts ; part des tirs à xG < 0,04 ${pct(o.xg.filter((v) => v < 0.04).length, o.shots)} %, > 0,3 ${pct(o.xg.filter((v) => v > 0.3).length, o.shots)} %`);
console.log(`têtes ${pct(o.tetes, o.shots)} % des tirs (16,9), converties ${pct(o.tetesBut, o.tetes)} % (9,6) ; espèces : ${Object.entries(o.kinds).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(v / n).toFixed(1)}`).join(', ')}`);
console.log(`conversion par bande : ${['0-5', '5-8', '8-14', '14-18', '18-23', '23+'].map((b) => { const B = o.bands[b]; return B ? `${b} m ${pct(B.but, B.n)} % (${(B.n / n).toFixed(1)} / match, cadré ${pct(B.cadre, B.n)} %)` : `${b} —`; }).join(' ; ')} (cibles 45 / 21 / 12 / 10 / 3,6 / 2,2)`);
console.log(`point visé : ${Object.entries(o.visee).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pct(v, o.shots)} %`).join(', ')} (book : bas-ouvert 26, mi-ouvert 17, bas-fermé 14, premier-poteau 10, axial-bas 9, mi-fermé 8, cadre 7, lucarne 5, barre 4) ; hors cadre au plan du but : au-dessus ${o.dessus} / à côté ${o.cote} → ratio ${(o.dessus / Math.max(1, o.cote)).toFixed(2)} (cible ≈ 1,5, ≥ 1,1)`);
const sd = (a) => { const m = moy(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) * (v - m), 0) / Math.max(1, a.length - 1)); };
console.log(`plan nominal (predictPath, sans obstacle) sur ${N.n} tirs (${N.noPlan} sans plan) : cadre ${pct(N.cadre, N.n)} % (cible ≈ 46 du non-contré), au-dessus ${pct(N.dessus, N.n)} % / à côté ${pct(N.cote, N.n)} % → ratio ${(N.dessus / Math.max(1, N.cote)).toFixed(2)} (≈ 1,5 ; ≥ 1,1), les deux ${pct(N.deux, N.n)} %, sur le montant ${pct(N.montant, N.n)} % (2,3) ; autour du point visé (${N.dy.length}) : σvert ${sd(N.dy).toFixed(2)} m / σhoriz ${sd(N.dz).toFixed(2)} m → ${(sd(N.dy) / Math.max(0.01, sd(N.dz))).toFixed(2)} (1,6-2,5), biais dy ${moy(N.dy).toFixed(2)} dz ${moy(N.dz).toFixed(2)} ; le sol tronque le bas : σvert du côté haut (demi-normale) ${Math.sqrt(N.dy.filter((v) => v > 0).reduce((a, v) => a + v * v, 0) / Math.max(1, N.dy.filter((v) => v > 0).length)).toFixed(2)} m → ${(Math.sqrt(N.dy.filter((v) => v > 0).reduce((a, v) => a + v * v, 0) / Math.max(1, N.dy.filter((v) => v > 0).length)) / Math.max(0.01, sd(N.dz))).toFixed(2)} ; quantiles dy p10 ${q(N.dy, 0.1).toFixed(2)} p50 ${q(N.dy, 0.5).toFixed(2)} p90 ${q(N.dy, 0.9).toFixed(2)}, dz p10 ${q(N.dz, 0.1).toFixed(2)} p50 ${q(N.dz, 0.5).toFixed(2)} p90 ${q(N.dz, 0.9).toFixed(2)}`);
console.log(`refus nommés / match : ${Object.entries(o.deny).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k} ${(v / n).toFixed(0)}`).join(', ')}`);
