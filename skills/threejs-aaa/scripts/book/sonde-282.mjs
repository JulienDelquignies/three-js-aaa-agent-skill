// sonde 282 — LA PORTE DU TIR DANS LA SURFACE (le pré-filtre du Modèle 10 §1.4) : la sonde-280 + le CORPS et l'ANGLE au moment de chaque tir (dos au but > 110°, cadre < 4°), les refus nommés du pré-filtre, les choix de l'arbitre 'pré-filtre-*'.
// sonde 280 — LE VOLUME DES TIRS : d'où viennent 42 tirs pour 25 ? Par match : touches dans la surface adverse (réel 25,5 / équipe, PL 2024-25),
// entrées en surface (séquences de possession qui y touchent), tirs par touche en surface, possessions, tirs par possession, tirs dedans /
// dehors, tirs sur rebond (< 5 s après un arrêt / contre / montant : réel 10 %), tirs par espèce d'origine (jeu ouvert / CPA), et la porte
// (événements 'arbitre' : tir gagnant c. passe / centre / conduite) — la sonde du lot 280.
import { angleVisible } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/xg.js';
import { makeMatch, matchStep, matchCfg } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/match-sim.js';
const seeds = (process.argv[2] ?? '3,7').split(',').map(Number), over = JSON.parse(process.argv[3] ?? '{}'), DUR = +(process.argv[4] ?? 2700);
const hyp = Math.hypot; const o = { corps: [], angle: [], dosIn: 0, cadreIn: 0, deny: {}, arbPF: {}, n: 0, touches: 0, entrees: 0, shots: 0, shotsIn: 0, shotsOut: 0, poss: 0, possBox: 0, rebond: 0, cpa: 0, arb: { tir: 0, autre: 0, tirBox: 0, autreBox: 0 }, contres: 0, xg: 0, tetes: 0, centres: 0, centresIn: 0, dist: [], possLen: [] };
for (const seed of seeds) {
  const { _tactics, ...overC } = over; for (const k of ['xg', 'ligneAccrochee', 'prefiltreTir']) if (overC[k] && matchCfg({})[k]) overC[k] = { ...matchCfg({})[k], ...overC[k], ...(overC[k].theta && matchCfg({})[k].theta ? { theta: { ...matchCfg({})[k].theta, ...overC[k].theta } } : {}), ...(overC[k].marge && matchCfg({})[k].marge ? { marge: { ...matchCfg({})[k].marge, ...overC[k].marge } } : {}) };
  const st = makeMatch({ full: true, seed, tactics: _tactics ?? null }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: DUR, pause: 10 }, ...overC }); o.n++;
  let seen = 0, prevOwner = null, prevTeam = null, inBoxPrev = false, possStart = st.t, possTouchedBox = false, lastStop = -99;
  for (let i = 0; i < DUR * 60 * 2.4; i++) {
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break;
    const ow = st.ball.owner, q = ow != null ? st.players[ow] : null;
    if (q && !q.keeper) { const g = st.pitch.attackGoal(q.team), s = Math.sign(g.x || 1); const inBox = st.pitch.inBox(q.p[0], q.p[2], s);
      if (ow !== prevOwner) { if (inBox) o.touches++; if (q.team !== prevTeam) { if (prevTeam != null) { o.poss++; o.possLen.push(st.t - possStart); if (possTouchedBox) o.possBox++; } possStart = st.t; possTouchedBox = false; } }
      if (inBox && !inBoxPrev) { o.entrees++; } if (inBox) possTouchedBox = true; inBoxPrev = inBox; prevTeam = q.team; } else if (q?.keeper) { inBoxPrev = false; }
    prevOwner = ow;
    for (; seen < st.events.length; seen++) { const e = st.events[seen];
      if (e.type === 'arrêt' || e.type === 'contre') lastStop = e.t;
      if (e.type === 'arbitre') { if (typeof e.pourquoi === 'string' && e.pourquoi.startsWith('pré-filtre')) o.arbPF[e.pourquoi] = (o.arbPF[e.pourquoi] ?? 0) + 1; if (e.tir?.pourquoi?.startsWith?.('pré-filtre')) o.arbPF['tir:' + e.tir.pourquoi] = (o.arbPF['tir:' + e.tir.pourquoi] ?? 0) + 1; const by = st.players[e.by]; const g = st.pitch.attackGoal(by.team); const inB = st.pitch.inBox(by.p[0], by.p[2], Math.sign(g.x || 1)); if (e.choix === 'tir') { o.arb.tir++; if (inB) o.arb.tirBox++; } else { o.arb.autre++; if (inB) o.arb.autreBox++; } }
      if (e.type === 'centre') { o.centres++; }
      if (e.type === 'contre') o.contres++;
      if (e.type === 'shot') { const by = st.players[e.by]; if (!by) continue; const g = st.pitch.attackGoal(by.team), s = Math.sign(g.x || 1); o.shots++; const d = hyp(g.x - by.p[0], by.p[2]); o.dist.push(d);
        if (st.pitch.inBox(by.p[0], by.p[2], s)) o.shotsIn++; else o.shotsOut++; { const cap = Math.atan2(0 - by.p[2], g.x - by.p[0]), corps = by.yaw == null ? 0 : Math.abs(((by.yaw - cap + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) * 180 / Math.PI, ang = angleVisible(Math.max(0.1, (g.x - by.p[0]) * s), Math.abs(by.p[2])) * 180 / Math.PI; if (!['tête', 'volée', 'demi-volée', 'retournée'].includes(e.kind) && st.pitch.inBox(by.p[0], by.p[2], s)) { o.corps.push(corps); o.angle.push(ang); if (corps > 110) o.dosIn++; if (ang < 4) o.cadreIn++; } } if (e.t - lastStop < 5) o.rebond++; if (e.kind === 'coup-franc-direct' || (st.restart && st.t - (st.restart.at ?? -99) < 3)) o.cpa++; if (e.kind === 'tête') o.tetes++; if (e.xg != null) o.xg += e.xg; }
    }
  }
  for (const [k, v] of Object.entries(st.deny ?? {})) if (k.startsWith('pré-filtre')) o.deny[k] = (o.deny[k] ?? 0) + v;
}
const n = o.n, q = (a, x) => { a = [...a].sort((u, v) => u - v); return a.length ? a[Math.floor(x * a.length)] : NaN; };
console.log(`${n} × ${(DUR / 60).toFixed(0)} min ${JSON.stringify(over)}`);
console.log(`tirs / match ${(o.shots / n).toFixed(1)} (25,3) — dedans ${(o.shotsIn / n).toFixed(1)} (16,2), dehors ${(o.shotsOut / n).toFixed(1)} (9,1) ; distance p50 ${q(o.dist, 0.5).toFixed(1)} m (16) ; têtes ${(o.tetes / n).toFixed(1)} (4,3) ; contres ${(o.contres / n).toFixed(1)} (7) ; ΣxG ${(o.xg / n).toFixed(2)} (2,6)`);
console.log(`touches en surface adverse / match (les deux équipes) ${(o.touches / n).toFixed(1)} (≈ 51 : 25,5 / équipe) ; entrées en surface ${(o.entrees / n).toFixed(1)} ; tirs par touche en surface ${(o.shotsIn / Math.max(1, o.touches)).toFixed(2)} (≈ 0,32) ; tirs par entrée ${(o.shotsIn / Math.max(1, o.entrees)).toFixed(2)}`);
console.log(`possessions / match ${(o.poss / n).toFixed(0)} (≈ 200-250 les deux équipes), durée p50 ${q(o.possLen, 0.5).toFixed(1)} s ; possessions qui touchent la surface ${(o.possBox / n).toFixed(1)} (${(100 * o.possBox / Math.max(1, o.poss)).toFixed(1)} %) ; tirs par possession ${(o.shots / Math.max(1, o.poss)).toFixed(3)} (≈ 0,11)`);
console.log(`tirs sur rebond (< 5 s après arrêt / contre) ${(100 * o.rebond / Math.max(1, o.shots)).toFixed(1)} % (10) ; sur CPA ${(100 * o.cpa / Math.max(1, o.shots)).toFixed(1)} % ; centres ${(o.centres / n).toFixed(1)} / match`);
console.log(`la porte (événements 'arbitre') : tir gagnant ${(o.arb.tir / n).toFixed(1)} / match c. autre ${(o.arb.autre / n).toFixed(1)} ; en surface : tir ${(o.arb.tirBox / n).toFixed(1)} c. autre ${(o.arb.autreBox / n).toFixed(1)} (${(100 * o.arb.tirBox / Math.max(1, o.arb.tirBox + o.arb.autreBox)).toFixed(0)} % de tirs)`);

console.log(`le CORPS au tir contrôlé en surface (hors tête, volée, retournée) : p50 ${q(o.corps, 0.5).toFixed(0)}° p90 ${q(o.corps, 0.9).toFixed(0)}°, dos au but (> 110°) ${(100 * o.dosIn / Math.max(1, o.corps.length)).toFixed(1)} % de ${o.corps.length} ; l'ANGLE visible p10 ${q(o.angle, 0.1).toFixed(1)}° p50 ${q(o.angle, 0.5).toFixed(1)}°, cadre < 4° ${(100 * o.cadreIn / Math.max(1, o.angle.length)).toFixed(1)} %`);
console.log(`refus du pré-filtre / match ${JSON.stringify(Object.fromEntries(Object.entries(o.deny).map(([k, v]) => [k, +(v / n).toFixed(1)])))} ; arbitre ${JSON.stringify(Object.fromEntries(Object.entries(o.arbPF).map(([k, v]) => [k, +(v / n).toFixed(1)])))}`);
