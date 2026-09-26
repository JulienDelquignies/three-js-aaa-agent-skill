// LES BALLONS REPERDUS JUSTE APRÈS UNE PRISE AU CONTACT (sans navigateur, moteur STARTER). Une prise AU CONTACT : un joueur de champ devient
// porteur avec le défenseur adverse à < 1,5 m. Dans les 1,5 s : le ballon est-il reperdu, COMMENT (le geste du nouveau défenseur qui le reprend :
// pique, tacle debout, épaule, glissé ; ou un ballon LIBRE gagné — et pourquoi il était libre : touche du porteur, conteste, rebond), en combien
// de temps, et à cet instant la géométrie : ballon → porteur, ballon → défenseur, allure et cap du porteur, le défenseur (acte, mordu, au sol) ;
// ce que le porteur a fait entre la prise et la perte (touches, gestes, tenue). Usage : node reperte.mjs [graines=16] [secondes=120] [cle=JSON …]
import { makeDuel, duelCfg } from '../../assets/starter/src/engine/duel-1v1.js';
import { matchStep } from '../../assets/starter/src/engine/match-sim.js';
const [NG = '16', SECS = '120', ...KV] = process.argv.slice(2);
const over = Object.fromEntries(KV.map((s) => { const i = s.indexOf('='); return [s.slice(0, i), JSON.parse(s.slice(i + 1))]; }));
const q = (xs, f) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(f * (s.length - 1))] : NaN; };
const ang = (ax, az, bx, bz) => { const la = Math.hypot(ax, az), lb = Math.hypot(bx, bz); return la < 1e-6 || lb < 1e-6 ? null : Math.acos(Math.max(-1, Math.min(1, (ax * bx + az * bz) / (la * lb)))) * 180 / Math.PI; };
const P = [];
for (let seed = 1; seed <= Number(NG); seed++) {
  const st = makeDuel({ seed }), cfg = duelCfg(over); let ne = 0, prev = -1, cur = null, looseWhy = null, lastEv = null;
  for (let i = 0; i < Number(SECS) * 60; i++) {
    const pre = cur ? { phase: st.phase, owner: st.ball.owner } : null;
    matchStep(st, 1 / 60, cfg);
    const evs = []; while (ne < st.events.length) evs.push(st.events[ne++]);
    for (const e of evs) if (/control|loose-kept|duel|turnover|tacle-pique|slide|receive/.test(e.type)) lastEv = e;
    const cid = st.possession?.carrier ?? -1, c = st.players[cid];
    if (cur) {
      const p = st.players[cur.by], d = st.players[cur.def];
      for (const e of evs) { if (e.by === cur.by && /touche|windup|skill|shot|pass/.test(e.type)) cur.actions.push(`${(st.t - cur.t).toFixed(2)}:${e.type}${e.skill ? ':' + e.skill : e.kind ? ':' + e.kind : ''}`);
        if (e.by === cur.def && /duel|tacle-pique|slide|windup|control|loose-kept/.test(e.type)) { cur.defActs.push(`${(st.t - cur.t).toFixed(2)}:${e.type}${e.kind ? ':' + e.kind : ''}${e.won != null ? (e.won ? '+' : '-') : ''}`); if (cur.react == null) cur.react = st.t - cur.t; }
        if (e.by === cur.by && /shot|pass/.test(e.type)) cur.choix = true; }
      if (!cur.looseAt && st.phase === 'loose' && pre?.phase !== 'loose') { cur.looseAt = st.t - cur.t; const lastTouch = cur.actions.filter((a) => /touche/.test(a)).pop(); cur.looseWhy = evs.some((e) => e.type === 'tacle-pique') ? 'pique' : evs.some((e) => e.type === 'duel') ? 'duel' : lastTouch && st.t - cur.t - parseFloat(lastTouch) < 0.6 ? 'touche-longue' : 'autre';
        cur.geoLoose = { bP: Math.hypot(st.ball.p[0] - p.p[0], st.ball.p[2] - p.p[2]), bD: Math.hypot(st.ball.p[0] - d.p[0], st.ball.p[2] - d.p[2]) }; }
      const fini = st.t - cur.t > 1.5 || (c && c.team !== p.team);
      if (fini || (c && c.id !== cur.by && c.team === p.team)) {
        if (c && c.team !== p.team && st.t - cur.t <= 1.5) {
          cur.perdu = true; cur.tPerte = st.t - cur.t;
          const how = evs.find((e) => e.by === c.id && /duel|tacle-pique|slide|control|loose-kept|turnover|receive/.test(e.type));
          cur.comment = lastEv && lastEv.by === c.id ? `${lastEv.type}${lastEv.kind ? ':' + lastEv.kind : ''}${lastEv.tech ? ':' + lastEv.tech : ''}` : how ? how.type : '?';
          cur.viaLibre = cur.looseAt != null; cur.pourquoiLibre = cur.looseWhy;
          cur.geo = { bP: Math.hypot(st.ball.p[0] - p.p[0], st.ball.p[2] - p.p[2]), bD: Math.hypot(st.ball.p[0] - d.p[0], st.ball.p[2] - d.p[2]), vP: p.speed, capD: p.speed > 0.5 ? ang(p.v[0], p.v[1], d.p[0] - p.p[0], d.p[2] - p.p[2]) : null };
        }
        P.push(cur); cur = null;
      }
    }
    if (!cur && cid !== prev && c && !c.keeper && !st.restart) {
      const d = st.players.find((x) => x.team !== c.team && !x.keeper), dd = Math.hypot(d.p[0] - c.p[0], d.p[2] - c.p[2]);
      if (dd < 1.5) cur = { t: st.t, by: c.id, def: d.id, d0: dd, k: lastEv ? `${lastEv.type}${lastEv.tech ? ':' + lastEv.tech : ''}${lastEv.kind ? ':' + lastEv.kind : ''}` : '?', actions: [], defActs: [], perdu: false,
        g0: { bP: Math.hypot(st.ball.p[0] - c.p[0], st.ball.p[2] - c.p[2]), bD: Math.hypot(st.ball.p[0] - d.p[0], st.ball.p[2] - d.p[2]), vP: c.speed, vD: d.speed, dDown: d.down > 0, dAct: d.act?.payload?.kind ?? d.act?.id ?? null, dBite: (d._bite ?? -1) > st.t,
          bRegard: ang(st.ball.p[0] - c.p[0], st.ball.p[2] - c.p[2], Math.cos(c.yaw), Math.sin(c.yaw)), dRegard: ang(d.p[0] - c.p[0], d.p[2] - c.p[2], Math.cos(c.yaw), Math.sin(c.yaw)), owner: st.ball.owner === c.id }, reaction: d.skill?.reaction ?? 0.2 };
    }
    prev = cid;
  }
}
const n = P.length, L = P.filter((o) => o.perdu), pc = (a, b) => (100 * a / Math.max(1, b)).toFixed(0) + ' %';
console.log(`${n} prises au contact (défenseur < 1,5 m) — reperdues en 1,5 s : ${pc(L.length, n)} (en ${q(L.map((o) => o.tPerte), 0.5).toFixed(2)} s [${q(L.map((o) => o.tPerte), 0.1).toFixed(2)}–${q(L.map((o) => o.tPerte), 0.9).toFixed(2)}])`);
const tally = (X, f) => { const T = {}; for (const o of X) { const k = f(o); T[k] = (T[k] ?? 0) + 1; } return Object.entries(T).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pc(v, X.length)}`).join(', '); };
console.log(`  COMMENT (le dernier événement du reprenant) : ${tally(L, (o) => o.comment)}`);
console.log(`  par un ballon LIBRE : ${pc(L.filter((o) => o.viaLibre).length, L.length)} — libre parce que : ${tally(L.filter((o) => o.viaLibre), (o) => o.pourquoiLibre ?? '?')}`);
console.log(`  à la perte : ballon → porteur ${q(L.map((o) => o.geo.bP), 0.5).toFixed(2)} m, ballon → défenseur ${q(L.map((o) => o.geo.bD), 0.5).toFixed(2)} m, porteur à ${q(L.map((o) => o.geo.vP), 0.5).toFixed(1)} m/s, cap ∠défenseur ${q(L.filter((o) => o.geo.capD != null).map((o) => o.geo.capD), 0.5).toFixed(0)}°`);
console.log(`  prises : ${tally(P, (o) => o.k)}`);
console.log(`  reperte selon l'espèce de prise : ${Object.entries(P.reduce((a, o) => ((a[o.k] ??= []).push(o), a), {})).sort((a, b) => b[1].length - a[1].length).slice(0, 6).map(([k, X]) => `${k} ${pc(X.filter((o) => o.perdu).length, X.length)} (${X.length})`).join(', ')}`);
const g = (X, f, d = 2) => `${q(X.map(f), 0.5).toFixed(d)}`;
for (const [nom, X] of [['reperdues', L], ['gardées', P.filter((o) => !o.perdu)]]) console.log(`  à la PRISE (${nom}, ${X.length}) : défenseur à ${g(X, (o) => o.d0)} m, ballon → porteur ${g(X, (o) => o.g0.bP)} m / → défenseur ${g(X, (o) => o.g0.bD)} m, ballon soudé ${pc(X.filter((o) => o.g0.owner).length, X.length)}, porteur ${g(X, (o) => o.g0.vP, 1)} m/s, défenseur ${g(X, (o) => o.g0.vD, 1)} m/s, défenseur dans le regard ${g(X, (o) => o.g0.dRegard ?? 0, 0)}°, ballon dans le regard ${g(X, (o) => o.g0.bRegard ?? 0, 0)}°, défenseur au sol ${pc(X.filter((o) => o.g0.dDown).length, X.length)}, en geste ${pc(X.filter((o) => o.g0.dAct).length, X.length)}, mordu ${pc(X.filter((o) => o.g0.dBite).length, X.length)}`);
if (process.env.BRUT) for (const o of L.slice(0, +process.env.BRUT)) console.log(`  · t${o.t.toFixed(1)} prise ${o.k} d0 ${o.d0.toFixed(2)} → perdu à +${o.tPerte.toFixed(2)} par ${o.comment}${o.viaLibre ? ' (libre : ' + o.pourquoiLibre + ' à +' + o.looseAt.toFixed(2) + ')' : ''} | porteur : ${o.actions.join(' ') || '—'} | défenseur : ${o.defActs.join(' ') || '—'}`);
{ const S = L.filter((o) => !o.choix), R = S.filter((o) => o.react != null);
  console.log(`REPERTE SUBIE (sans tir ni passe du porteur) : ${S.length}/${n} = ${pc(S.length, n)} ; délai du perdant à sa 1re action sur le ballon ${q(R.map((o) => o.react), 0.5).toFixed(2)} s [p10 ${q(R.map((o) => o.react), 0.1).toFixed(2)}] ; sous son temps de réaction (skill.reaction, ${q(R.map((o) => o.reaction), 0.5).toFixed(2)} s) : ${R.filter((o) => o.react < o.reaction).length}/${R.length}, sous 0,25 s : ${R.filter((o) => o.react < 0.25).length}/${R.length}`);
  const A = P.filter((o) => o.react != null); console.log(`  toutes prises au contact : 1re action du perdant sur le ballon en ${q(A.map((o) => o.react), 0.5).toFixed(2)} s, sous 0,25 s : ${pc(A.filter((o) => o.react < 0.25).length, A.length)} (${A.length} prises où il agit)`); }
