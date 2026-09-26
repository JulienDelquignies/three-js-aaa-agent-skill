// LES FEINTES DU FACE-À-FACE, UNE PAR UNE (sans navigateur, moteur STARTER) — « ajouter d'autres feintes plantées ». Pour chaque feinte de la
// tenue (face.js : le roulé, la feinte de corps semelle dessus, le passement de la tenue) : jugée au contact ? le défenseur a-t-il MORDU ?
// qu'est-ce qui la suit (la sortie sur la morsure, la fente, une autre feinte, la perte) ; et pour chaque face-à-face PERDU : la feinte en cours
// (ou la dernière), son âge, le geste du porteur et celui du défenseur à la perte ; et chaque SORTIE (croqueta, râteau, roulette — par issue :
// mordu, fente lue…) jugée à +2 s : défenseur PASSÉ (derrière le porteur de 1,5 m vers le but), ballon tenu, perdu, tir ; la fente du
// défenseur pendant la sortie (touchée, dans le vide, au sol). Usage : node face-feintes.mjs [graines=16] [s=120] [cle=JSON …]
import { makeDuel, duelCfg } from '../../assets/starter/src/engine/duel-1v1.js';
import { matchStep } from '../../assets/starter/src/engine/match-sim.js';
const [NG = '16', SECS = '120', ...KV] = process.argv.slice(2);
const over = Object.fromEntries(KV.map((s) => { const i = s.indexOf('='); return [s.slice(0, i), JSON.parse(s.slice(i + 1))]; }));
const Fe = [], Pe = [], So = [];
for (let seed = 1; seed <= Number(NG); seed++) {
  const st = makeDuel({ seed }), cfg = duelCfg(over); let ne = 0; const cur = {};
  for (let i = 0; i < Number(SECS) * 60; i++) {
    const avant = st.players.map((p) => p._face ? { mords: p._face.mords, roule: p._face.roule, act: p.act?.payload?.skill ?? p.act?.id, t: p.act?.t } : null);
    matchStep(st, 1 / 60, cfg);
    for (const p of st.players) { const F = p._face, o = cur[p.id]; if (!F || !o || o.roule !== F.roule) continue; if (F.roule.juge && o.juge == null) { o.juge = st.t - o.t0; const q = st.players[F.par]; o.bloque = F.fente ? 'fente' : q.act ? 'défenseur-en-geste:' + (q.act.payload?.kind ?? q.act.id) : q.down > 0 ? 'au-sol' : null; o.n = F.feintes; } if (F.mords > o.mords0 && o.mord == null) o.mord = st.t - o.t0; }
    while (ne < st.events.length) { const e = st.events[ne++];
      if (e.type === 'skill' && e.face != null && typeof e.face === 'number') { const p = st.players[e.by], F = p._face; const o = { kind: F.roule.kind, t0: st.t, roule: F.roule, mords0: F.mords - 0, juge: null, mord: null, suite: null, seed }; if (cur[p.id] && !cur[p.id].suite) cur[p.id].suite = 'feinte'; cur[p.id] = o; Fe.push(o); }
      if (e.type === 'face' && e.phase === 'charge') { const o = cur[e.by]; if (o && !o.suite) o.suite = 'fente-' + e.fente; }
      if (e.type === 'face' && e.phase === 'fin' && e.sortie) So.push({ seed, t: st.t, by: e.by, par: e.par, sortie: e.sortie, issue: e.issue, suite: null, fente: null });
      if (e.type === 'chute' && So.length && So[So.length - 1].seed === seed && st.t - So[So.length - 1].t < 1.2 && e.by === So[So.length - 1].par) So[So.length - 1].fente = 'au-sol';
      if (e.type === 'face' && e.phase === 'fin') { const o = cur[e.by]; if (o && !o.suite) o.suite = e.issue; if (e.issue === 'perdu') { const a = avant[e.by]; const q = st.players[e.par]; Pe.push({ seed, t: st.t, feinte: o?.kind ?? '—', age: o ? st.t - o.t0 : null, porteur: a?.act ?? '—', tAct: a?.t, def: q.act?.payload?.kind ?? q.act?.id ?? (q.down > 0 ? 'au-sol' : '—'), fente: e.fente }); } cur[e.by] = null; }
    }
    for (const o of So) if (o.seed === seed && o.suite == null && st.t > o.t) { const c = st.players[o.by], q = st.players[o.par], g = st.pitch.attackGoal(c.team), car = st.players[st.possession?.carrier ?? -1];
      if (process.env.TRACE && o.suite == null) { (o.log ??= []); for (const e of st.events.slice(o.ne ?? st.events.length - 1)) if (e.t > o.t - 0.01 && !o.log.includes(e)) o.log.push(e); o.bd = Math.max(o.bd ?? 0, Math.hypot(st.ball.p[0] - c.p[0], st.ball.p[2] - c.p[2])); }
      if (car && car.team !== c.team) o.suite = 'perdu'; else if (st.events.slice(-4).some((e) => e.type === 'shot' && e.by === c.id)) o.suite = 'tir';
      else if (((q.p[0] - c.p[0]) * (g.x - c.p[0]) + (q.p[2] - c.p[2]) * -c.p[2]) < -1.5 * Math.hypot(g.x - c.p[0], c.p[2])) o.suite = 'passé';
      else if (st.t - o.t > 2) o.suite = 'tenu'; }
  }
}
const pc = (a, b) => (100 * a / Math.max(1, b)).toFixed(0) + ' %';
for (const k of [...new Set(Fe.map((o) => o.kind))]) { const X = Fe.filter((o) => o.kind === k), J = X.filter((o) => o.juge != null), M = X.filter((o) => o.mord != null), T = {};
  for (const o of X) T[o.suite ?? '?'] = (T[o.suite ?? '?'] ?? 0) + 1;
  const B = J.filter((o) => o.bloque), L = J.filter((o) => !o.bloque);
  console.log(`${k.padEnd(16)} ${String(X.length).padStart(4)} : jugée ${pc(J.length, X.length)}, MORDUE ${pc(M.length, J.length)} des jugées — morsure IMPOSSIBLE au contact ${pc(B.length, J.length)} (${Object.entries(B.reduce((a, o) => ((a[o.bloque] = (a[o.bloque] ?? 0) + 1), a), {})).map(([k, v]) => `${k} ${v}`).join(', ') || '—'}), mordue quand possible ${pc(L.filter((o) => o.mord != null).length, L.length)} (rang ${(L.reduce((a, o) => a + o.n, 0) / Math.max(1, L.length)).toFixed(1)}) ; suite : ${Object.entries(T).sort((a, b) => b[1] - a[1]).map(([s, v]) => `${s} ${pc(v, X.length)}`).join(', ')}`); }
console.log(`${Pe.length} face-à-face PERDUS — feinte en cours : ${Object.entries(Pe.reduce((a, o) => ((a[o.feinte] = (a[o.feinte] ?? 0) + 1), a), {})).map(([k, v]) => `${k} ${v}`).join(', ')}`);
if (process.env.BRUT) for (const o of Pe) console.log(`  · g${o.seed} t${o.t.toFixed(1)} feinte ${o.feinte} (+${o.age?.toFixed(2)} s) porteur ${o.porteur}@${o.tAct?.toFixed(2)} défenseur ${o.def} fente ${o.fente}`);
{ const G = {}; for (const o of So) (G[o.sortie] ??= []).push(o);
  for (const [k, X] of Object.entries(G)) { const T = {}; for (const o of X) T[o.suite ?? '?'] = (T[o.suite ?? '?'] ?? 0) + 1;
    console.log(`SORTIE ${k.padEnd(9)} ${String(X.length).padStart(4)} (issues : ${Object.entries(X.reduce((a, o) => ((a[o.issue] = (a[o.issue] ?? 0) + 1), a), {})).map(([i, v]) => `${i} ${v}`).join(', ')}) — à +2 s : ${Object.entries(T).sort((a, b) => b[1] - a[1]).map(([s2, v]) => `${s2} ${pc(v, X.length)}`).join(', ')}${X.some((o) => o.fente) ? ` ; le défenseur au sol ${X.filter((o) => o.fente).length}` : ''}`); }
  const L = So.filter((o) => /fente-lue|rateau-fente|roulette-fente/.test(o.issue)); const T = {}; for (const o of L) T[o.suite ?? '?'] = (T[o.suite ?? '?'] ?? 0) + 1;
  console.log(`LA FENTE LUE (toutes réponses, ${L.length}) — à +2 s : ${Object.entries(T).sort((a, b) => b[1] - a[1]).map(([s2, v]) => `${s2} ${pc(v, L.length)}`).join(', ')}`); }
if (process.env.TRACE) for (const o of So.filter((x) => x.suite === 'perdu' && x.sortie === process.env.TRACE)) console.log(`  · g${o.seed} t${o.t.toFixed(2)} ${o.sortie} (${o.issue}) ballon au plus loin ${o.bd?.toFixed(2)} m : ${(o.log ?? []).filter((e) => !/^(touche|pas|foot)/.test(e.type)).slice(0, 14).map((e) => `${(e.t - o.t).toFixed(2)} ${e.type}${e.kind ? ':' + e.kind : ''}${e.move ? ':' + e.move : ''}${e.won != null ? (e.won ? '+' : '-') : ''} (${e.by})`).join(' | ')}`);
