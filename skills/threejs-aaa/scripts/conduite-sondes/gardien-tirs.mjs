// LE GARDIEN FACE AUX TIRS, ET SES SORTIES (sans navigateur, moteur STARTER) — « renforcer le gardien (sorties, conversion) ». Pour chaque
// tir : la portée, l'angle, le xG ; le gardien à l'instant du tir — sa profondeur (distance à sa ligne), son écart latéral à la BISSECTRICE
// de l'angle de tir (le placement juste), sa distance au tireur, debout ou au sol ; l'issue dans les 2,5 s (but, arrêt, à côté/grille,
// contré). Les sorties : la part du temps hors de sa surface (> 6 m de sa ligne ou > 7,6 m du centre du but), la profondeur p90/max, le
// gardien DANS LES COINS (|z| > demi-but + 3 m), les buts marqués but vide (gardien à > 4 m de sa ligne ou au sol loin du ballon).
// Référence : en futsal d'élite 76,5 % des tirs cadrés finissent sur une intervention du gardien (analyse des conduites du gardien,
// Mondiaux/Euro/UEFA Futsal Cup 2012-2015). Usage : node gardien-tirs.mjs [graines=8] [secondes=120] [cle=JSON …]
import { makeDuel, duelCfg } from '../../assets/starter/src/engine/duel-1v1.js';
import { matchStep } from '../../assets/starter/src/engine/match-sim.js';
const [NG = '8', SECS = '120', ...KV] = process.argv.slice(2);
const over = Object.fromEntries(KV.map((s) => { const i = s.indexOf('='); return [s.slice(0, i), JSON.parse(s.slice(i + 1))]; }));
const q = (xs, f) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(f * (s.length - 1))] : NaN; };
const T = [], S = { frames: 0, hors: 0, coin: 0, prof: [], butVide: 0, gkFrames: 0, modes: {} };
for (let seed = 1; seed <= Number(NG); seed++) {
  const st = makeDuel({ seed }), cfg = duelCfg(over), dt = 1 / 60; let ne = 0; const ouverts = [];
  for (let i = 0; i < Number(SECS) * 60; i++) {
    matchStep(st, dt, cfg);
    const evs = []; while (ne < st.events.length) evs.push(st.events[ne++]);
    for (const e of evs) {
      if (e.type === 'shot') {
        const c = st.players[e.by], gk = st.players.find((p) => p.keeper && p.team !== c.team), g = st.pitch.attackGoal(c.team), h = st.pitch.goalHalf;
        const u = (pz) => { const ux = g.x - c.p[0], uz = pz - c.p[2], l = Math.hypot(ux, uz) || 1; return [ux / l, uz / l]; }, u1 = u(h), u2 = u(-h), bx = u1[0] + u2[0], bz = u1[1] + u2[1];
        const zBis = c.p[2] + (bz / bx) * (gk.p[0] - c.p[0]), depth = Math.abs(gk.p[0] - g.x);
        const ang = Math.abs(Math.atan2(c.p[2], Math.abs(g.x - c.p[0])) * 180 / Math.PI);
        ouverts.push({ t: st.t, by: e.by, range: Math.hypot(g.x - c.p[0], c.p[2]), ang, xg: e.xg ?? null, depth, bis: Math.abs(gk.p[2] - zBis), dGk: Math.hypot(gk.p[0] - c.p[0], gk.p[2] - c.p[2]), bas: gk.down > 0, issue: null, speed: e.speed, kind: e.kind });
      }
      for (const o of ouverts) if (!o.issue) {
        if (e.type === 'but') o.issue = 'BUT';
        else if (e.type === 'arrêt') o.issue = 'arrêt:' + (e.kind ?? '?');
        else if (e.type === 'grille') o.issue = 'à-côté';
        else if (e.type === 'contre') o.issue = 'contré';
      }
      if (e.type === 'but') { const tm = e.team, gk = st.players.find((p) => p.keeper && p.team !== tm); if (gk && Math.abs(gk.p[0] - st.pitch.ownGoal(gk.team).x) > 4) S.butVide++; }
    }
    for (let k = ouverts.length - 1; k >= 0; k--) { const o = ouverts[k]; if (o.issue || st.t - o.t > 2.5) { if (!o.issue) o.issue = 'autre'; T.push(o); ouverts.splice(k, 1); } }
    if (!st.restart) for (const gk of st.players.filter((p) => p.keeper)) {
      const g = st.pitch.ownGoal(gk.team), depth = Math.abs(gk.p[0] - g.x), dC = Math.hypot(gk.p[0] - g.x, gk.p[2]);
      S.gkFrames++; S.prof.push(depth); if (depth > 6 || dC > 7.6) S.hors++; if (Math.abs(gk.p[2]) > st.pitch.goalHalf + 3) { S.coin++; const car2 = st.players[st.possession?.carrier ?? -1], m2 = car2 === gk ? 'porte-le-ballon' : gk.act ? 'acte-' + (gk.act.payload?.skill ?? gk.act.id) : st.ball.owner === gk.id ? 'ballon-en-main' : car2 && car2.team === gk.team ? 'son-équipe' : car2 ? 'adversaire' : 'ballon-libre'; (S.coinM ??= {})[m2] = (S.coinM[m2] ?? 0) + 1; }
      const car = st.players[st.possession?.carrier ?? -1]; const m = car === gk ? 'porte-le-ballon' : car && car.team === gk.team ? 'son-équipe-a-le-ballon' : car ? 'adversaire-a-le-ballon' : 'ballon-libre';
      if (depth > 6 || dC > 7.6) S.modes[m] = (S.modes[m] ?? 0) + 1;
    }
  }
}
const n = T.length, cnt = (f) => T.filter(f).length, pc = (a, b) => (100 * a / Math.max(1, b)).toFixed(0) + ' %';
const buts = cnt((x) => x.issue === 'BUT'), arr = cnt((x) => /^arrêt/.test(x.issue)), cot = cnt((x) => x.issue === 'à-côté');
console.log(`${n} tirs : BUTS ${buts} (${pc(buts, n)}), arrêts ${arr}, à côté ${cot}, contrés ${cnt((x) => x.issue === 'contré')}, autre ${cnt((x) => x.issue === 'autre')} — cadrés ≈ ${buts + arr} : le gardien en arrête ${pc(arr, buts + arr)} (réf. futsal d'élite ≈ 76,5 %)`);
const m = (X, f, d = 1) => `${q(X.map(f), 0.5).toFixed(d)} [${q(X.map(f), 0.1).toFixed(d)}–${q(X.map(f), 0.9).toFixed(d)}]`;
for (const [nom, X] of [['buts', T.filter((x) => x.issue === 'BUT')], ['arrêts', T.filter((x) => /^arrêt/.test(x.issue))]]) if (X.length)
  console.log(`  ${nom.padEnd(7)} : portée ${m(X, (x) => x.range)} m, angle ${m(X, (x) => x.ang, 0)}°, gardien à ${m(X, (x) => x.depth)} m de sa ligne, écart à la bissectrice ${m(X, (x) => x.bis, 2)} m, à ${m(X, (x) => x.dGk)} m du tireur, au sol ${X.filter((x) => x.bas).length}/${X.length}`);
console.log(`  par portée : ${[[0, 5], [5, 8], [8, 12], [12, 40]].map(([a, b]) => { const X = T.filter((x) => x.range >= a && x.range < b); return `${a}-${b} m ${X.filter((x) => x.issue === 'BUT').length}/${X.length}`; }).join(', ')}`);
console.log(`SORTIES : hors de sa surface ${pc(S.hors, S.gkFrames)} du temps (${Object.entries(S.modes).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pc(v, S.hors)}`).join(', ')}), profondeur p50 ${q(S.prof, 0.5).toFixed(1)} / p90 ${q(S.prof, 0.9).toFixed(1)} / max ${Math.max(...S.prof).toFixed(1)} m, dans les coins ${pc(S.coin, S.gkFrames)} (${Object.entries(S.coinM ?? {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pc(v, S.coin)}`).join(', ')}), buts but vide ${S.butVide}`);
