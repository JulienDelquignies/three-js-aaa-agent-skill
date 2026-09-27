// LA SÉRIE DE PASSEMENTS ALTERNÉS DU FACE-À-FACE (face.js — Mancini contre Réveillère) : chaque série de la tenue (sans navigateur, moteur
// STARTER) — combien de passements joués sur n, la morsure (à quel passage, de quel côté vendu), la fin de la série (menée au bout → la tenue
// reprend ; coupée par la SORTIE sur la morsure, par la fente lue ; perdue), et le face-à-face jugé à +2 s de la fin de la série (passé, tenu,
// perdu, tir). Le ballon pendant la série : son écart au point du clip (le ballon quasi immobile entre les pieds). Usage : node face-serie.mjs [graines=24] [s=120] [cle=JSON …]
import { makeDuel, duelCfg } from '../../assets/starter/src/engine/duel-1v1.js';
import { matchStep } from '../../assets/starter/src/engine/match-sim.js';
const [NG = '24', SECS = '120', ...KV] = process.argv.slice(2);
const over = Object.fromEntries(KV.map((s) => { const i = s.indexOf('='); return [s.slice(0, i), JSON.parse(s.slice(i + 1))]; }));
const q = (xs, f) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(f * (s.length - 1))] : NaN; };
const Sx = [];
for (let seed = 1; seed <= Number(NG); seed++) {
  const st = makeDuel({ seed }), cfg = duelCfg(over); let ne = 0; const cur = {};
  for (let i = 0; i < Number(SECS) * 60; i++) {
    matchStep(st, 1 / 60, cfg);
    while (ne < st.events.length) { const e = st.events[ne++];
      if (e.type === 'windup' && /^passementSerie/.test(e.move ?? '')) { const o = { seed, t0: st.t, by: e.by, n: +e.move.slice(-1), joues: 0, mord: null, fin: null, suite: null, tFin: null, dBall: [] }; cur[e.by] = o; Sx.push(o); }
      const o = cur[e.by];
      if (o && !o.fin) {
        if (e.type === 'skill' && e.kind === 'passementSerie') o.joues = e.passage;
        if (e.type === 'face' && e.phase === 'fin') { o.fin = e.sortie ? `sortie:${e.issue}` : e.issue; o.tFin = st.t; }
      }
    }
    for (const o of Object.values(cur)) { if (!o || o.suite) continue; const c = st.players[o.by], F = c._face;
      if (!o.fin && F?.mordu && o.mord == null && F.mordu.t >= o.t0) o.mord = o.joues;
      if (!o.fin && c.act?.payload?.skill?.startsWith?.('passementSerie')) { const fx = Math.cos(c.yaw), fz = Math.sin(c.yaw), bx = (st.ball.p[0] - c.p[0]) * -fz + (st.ball.p[2] - c.p[2]) * fx, bz = (st.ball.p[0] - c.p[0]) * fx + (st.ball.p[2] - c.p[2]) * fz;
        const t = c.act.t; if (t > 0.22 && t < 0.22 + 0.3 * o.n) o.dBall.push(Math.hypot(bx, bz - 0.28)); }
      if (!o.fin && !c.act?.payload?.skill?.startsWith?.('passementSerie') && st.t - o.t0 > 0.05) { o.fin = st.possession?.carrier !== o.by ? 'perdu' : c._face ? 'menee' : 'autre'; o.tFin = st.t; }
      if (o.fin && !o.suite) { const qd = st.players.find((x) => x.team !== c.team && !x.keeper), g = st.pitch.attackGoal(c.team), car = st.players[st.possession?.carrier ?? -1];
        if (car && car.team !== c.team) o.suite = 'perdu'; else if (st.events.slice(-4).some((e) => e.type === 'shot' && e.by === c.id)) o.suite = 'tir';
        else if (((qd.p[0] - c.p[0]) * (g.x - c.p[0]) + (qd.p[2] - c.p[2]) * -c.p[2]) < -1.5 * Math.hypot(g.x - c.p[0], c.p[2])) o.suite = 'passé';
        else if (st.t - o.tFin > 2) o.suite = 'tenu'; } }
  }
}
const pc = (a, b) => (100 * a / Math.max(1, b)).toFixed(0) + ' %', tally = (X, f) => { const T = {}; for (const o of X) { const k = f(o); T[k] = (T[k] ?? 0) + 1; } return Object.entries(T).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pc(v, X.length)}`).join(', '); };
console.log(`${Sx.length} séries (${tally(Sx, (o) => 'n' + o.n)}) — mordues ${pc(Sx.filter((o) => o.mord != null).length, Sx.length)} (au passage ${tally(Sx.filter((o) => o.mord != null), (o) => o.mord)})`);
console.log(`  fin de la série : ${tally(Sx, (o) => o.fin ?? '?')}`);
console.log(`  à +2 s : ${tally(Sx, (o) => o.suite ?? '?')}`);
for (const n of [2, 3, 4]) { const X = Sx.filter((o) => o.n === n); if (X.length) console.log(`  n${n} (${X.length}) : mordues ${pc(X.filter((o) => o.mord != null).length, X.length)}, passées ${pc(X.filter((o) => o.suite === 'passé').length, X.length)}, perdues ${pc(X.filter((o) => o.suite === 'perdu').length, X.length)}`); }
const D = Sx.flatMap((o) => o.dBall); console.log(`  le ballon pendant les passements : à ${(100 * q(D, 0.5)).toFixed(1)} cm du point du clip (p90 ${(100 * q(D, 0.9)).toFixed(1)}, max ${(100 * q(D, 1)).toFixed(1)})`);
if (process.env.BRUT) for (const o of Sx) console.log(`  · g${o.seed} t${o.t0.toFixed(2)} n${o.n} joués ${o.joues} mordu ${o.mord ?? '—'} fin ${o.fin} → ${o.suite}`);
