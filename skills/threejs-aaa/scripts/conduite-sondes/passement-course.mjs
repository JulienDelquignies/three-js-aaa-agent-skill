// LE PASSEMENT EN COURSE DU DUEL (skills-sim.maybePassement, la branche dans la foulée — pas.gesteFouleeStep) : chaque passement lancé (sans
// navigateur, moteur STARTER) — le nombre d'arcs, la cadence (un arc par vol ? l'écart entre deux arcs), l'allure du porteur (au départ, au plus
// bas, en moyenne pendant les arcs), la distance au défenseur (au départ, à la fin), le défenseur qui RECULE ou charge, la morsure (le défenseur
// décalé), la sortie ; à +1,5 s : passé / gardé / perdu / tir. Et les OCCASIONS : les images où le porteur, lancé (≥ 1,5 m/s), a le défenseur
// devant lui (≤ 45° de sa course) à 1,5-4 m — combien d'occasions par minute, combien donnent un passement en course. Usage : node
// passement-course.mjs [graines=16] [s=120] [cle=JSON …]
import { makeDuel, duelCfg } from '../../assets/starter/src/engine/duel-1v1.js';
import { matchStep } from '../../assets/starter/src/engine/match-sim.js';
const [NG = '16', SECS = '120', ...KV] = process.argv.slice(2);
const over = Object.fromEntries(KV.map((s) => { const i = s.indexOf('='); return [s.slice(0, i), JSON.parse(s.slice(i + 1))]; }));
const q = (xs, f) => { const s = [...xs].filter((x) => x != null && !isNaN(x)).sort((a, b) => a - b); return s.length ? s[Math.floor(f * (s.length - 1))] : NaN; };
const m = (xs, d = 2) => `${q(xs, 0.5).toFixed(d)} [${q(xs, 0.1).toFixed(d)}–${q(xs, 0.9).toFixed(d)}]`;
const X = []; let occ = 0, occT = 0, minutes = 0;
for (let seed = 1; seed <= Number(NG); seed++) {
  const st = makeDuel({ seed }), cfg = duelCfg(over); let ne = 0; const cur = {}; let occOuverte = null;
  for (let i = 0; i < Number(SECS) * 60; i++) {
    matchStep(st, 1 / 60, cfg);
    const courseEv = {}; for (let k = ne; k < st.events.length; k++) if (st.events[k].type === 'face' && st.events[k].phase === 'course') courseEv[st.events[k].by] = st.events[k];
    while (ne < st.events.length) { const e = st.events[ne++];
      if (e.type === 'skill' && e.kind === 'passement' && e.foulee) { const c = st.players[e.by], d = st.players.find((x) => x.team !== c.team && !x.keeper);
        const o = { seed, t0: st.t, by: e.by, def: d.id, tours: e.tours, sortie: e.sortie, v0: c.speed, d0: Math.hypot(d.p[0] - c.p[0], d.p[2] - c.p[2]), vs: [], arcs: [], mord: null, face: !!courseEv[e.by], suite: null, fin: null };
        o.ferme0 = -((d.v[0] * (d.p[0] - c.p[0]) + d.v[1] * (d.p[2] - c.p[2])) / Math.max(0.01, o.d0)); cur[e.by] = o; X.push(o); if (occOuverte) occOuverte.pris = true; } }
    const car = st.players[st.possession?.carrier ?? -1];
    // les occasions : lancé, le défenseur devant à 1,5-4 m
    if (car && !car.keeper && st.phase === 'carry' && car.speed >= 1.5) { const d = st.players.find((x) => x.team !== car.team && !x.keeper), dx = d.p[0] - car.p[0], dz = d.p[2] - car.p[2], dd = Math.hypot(dx, dz);
      const ang = Math.acos(Math.max(-1, Math.min(1, (dx * car.v[0] + dz * car.v[1]) / (dd * car.speed)))) * 180 / Math.PI;
      if (dd >= 1.5 && dd <= 4 && ang <= 45) { occT += 1 / 60; if (!occOuverte || st.t - occOuverte.t > 0.1) { if (!occOuverte || st.t - occOuverte.last > 1.0) { occ++; occOuverte = { t: st.t, last: st.t, pris: false }; } } occOuverte.last = st.t; } }
    for (const o of Object.values(cur)) { if (!o || o.suite) continue; const c = st.players[o.by], d = st.players[o.def], A = c.act?.payload;
      if (!o.fin && A?.foulee && A.skill === 'passement') { o.vs.push(c.speed); for (const b of A.foulee.beats) if (b.type === 'arc' && b.t0 != null && !o.arcs.includes(b.t0)) o.arcs.push(b.t0);
        if (o.mord == null && (d._bite ?? -1) > st.t) o.mord = st.t - o.t0;
        const dd = Math.hypot(d.p[0] - c.p[0], d.p[2] - c.p[2]), db = Math.hypot(d.p[0] - st.ball.p[0], d.p[2] - st.ball.p[2]); if (o.mord == null) { o.dMinAv = Math.min(o.dMinAv ?? 9, dd); o.dbMinAv = Math.min(o.dbMinAv ?? 9, db); }
        if (d.act && !o.defActs?.includes(d.act.id)) (o.defActs ??= []).push(d.act.id); if ((d._bite ?? -1) <= st.t && d.job) o.defJob = d.job; }
      else if (!o.fin) { o.fin = st.t; o.d1 = Math.hypot(d.p[0] - c.p[0], d.p[2] - c.p[2]); o.v1 = c.speed; }
      if (o.fin) { const g = st.pitch.attackGoal(c.team), car2 = st.players[st.possession?.carrier ?? -1];
        if (car2 && car2.team !== c.team) o.suite = 'perdu'; else if (st.events.slice(-4).some((e) => e.type === 'shot' && e.by === c.id)) o.suite = 'tir';
        else if (((d.p[0] - c.p[0]) * (g.x - c.p[0]) + (d.p[2] - c.p[2]) * -c.p[2]) < -1.0 * Math.hypot(g.x - c.p[0], c.p[2])) o.suite = 'passé';
        else if (st.t - o.fin > 1.5) o.suite = 'gardé'; } }
  }
  minutes += Number(SECS) / 60;
}
const pc = (a, b) => (100 * a / Math.max(1, b)).toFixed(0) + ' %', tally = (Y, f) => { const T = {}; for (const o of Y) { const k = f(o); T[k] = (T[k] ?? 0) + 1; } return Object.entries(T).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pc(v, Y.length)}`).join(', '); };
const G = X.filter((o) => o.face);
for (const n of [1, 2, 3, 4]) { const Y = X.filter((o) => o.tours === n); if (Y.length) console.log(`  ${n} arc${n > 1 ? 's' : ''} (${Y.length}) : défenseur ${m(Y.map((o) => o.d0))} → au plus près ${m(Y.map((o) => o.dMinAv))} m ; mordu ${pc(Y.filter((o) => o.mord != null).length, Y.length)} ; à +1,5 s : ${tally(Y, (o) => o.suite ?? '?')}`); }
console.log(`${X.length} passements en course (${(X.length / minutes).toFixed(2)}/min) — arcs : ${tally(X, (o) => o.tours)} ; pendant un face-à-face approché ${pc(X.filter((o) => o.face).length, X.length)}`);
const gaps = X.flatMap((o) => o.arcs.slice(1).map((t, i) => t - o.arcs[i]));
console.log(`  écart entre deux arcs ${m(gaps)} s (Mancini 0,30) ; allure au départ ${m(X.map((o) => o.v0), 1)} m/s, pendant (moyenne) ${m(X.map((o) => o.vs.reduce((a, b) => a + b, 0) / Math.max(1, o.vs.length)), 1)}, au plus bas ${m(X.map((o) => Math.min(...o.vs)), 1)}, à la fin ${m(X.map((o) => o.v1), 1)} (Taga : 2,2 → 2,9 → 4,3)`);
console.log(`  défenseur au départ à ${m(X.map((o) => o.d0))} m (il ferme à ${m(X.map((o) => o.ferme0), 1)} m/s), à la fin ${m(X.map((o) => o.d1))} m ; durée ${m(X.map((o) => o.fin - o.t0))} s`);
console.log(`  mordu ${pc(X.filter((o) => o.mord != null).length, X.length)} ; sortie : ${tally(X, (o) => o.sortie)} ; à +1,5 s : ${tally(X, (o) => o.suite ?? '?')}`);
console.log(`OCCASIONS (lancé ≥ 1,5 m/s, le défenseur devant ≤ 45° à 1,5-4 m) : ${occ} (${(occ / minutes).toFixed(1)}/min, ${(occT / minutes * 60 / 60).toFixed(1)} s/min) — suivies d'un passement en course ${pc(X.length, occ)}`);
if (G.length) { console.log(`SÉRIES EN COURSE DE L'APPROCHE (face.course) : ${G.length} (${(G.length / minutes).toFixed(2)}/min) — arcs : ${tally(G, (o) => o.tours)} ; écart entre arcs ${m(G.flatMap((o) => o.arcs.slice(1).map((t, i) => t - o.arcs[i])))} s ; allure ${m(G.map((o) => o.v0), 1)} → pendant ${m(G.map((o) => o.vs.reduce((a, b) => a + b, 0) / Math.max(1, o.vs.length)), 1)} → fin ${m(G.map((o) => o.v1), 1)} m/s`);
  console.log(`  avant la morsure : défenseur au plus près ${m(G.map((o) => o.dMinAv))} m du porteur, ${m(G.map((o) => o.dbMinAv))} m du ballon ; gestes du défenseur pendant : ${tally(G, (o) => (o.defActs ?? ['—']).join('+'))}`);
  console.log(`  défenseur ${m(G.map((o) => o.d0))} → ${m(G.map((o) => o.d1))} m ; mordu ${pc(G.filter((o) => o.mord != null).length, G.length)} ; à +1,5 s : ${tally(G, (o) => o.suite ?? '?')}`); }
if (process.env.BRUT) for (const o of (process.env.FACE ? G : X).slice(0, +process.env.BRUT)) console.log(`  · g${o.seed} t${o.t0.toFixed(2)} ${o.tours} arcs v ${o.v0.toFixed(1)}→${Math.min(...o.vs).toFixed(1)}→${o.v1?.toFixed(1)} d ${o.d0.toFixed(2)}→${o.d1?.toFixed(2)} mord ${o.mord?.toFixed(2) ?? '—'} ${o.sortie} → ${o.suite} | dMin ${o.dMinAv?.toFixed(2)} bMin ${o.dbMinAv?.toFixed(2)} déf ${(o.defActs ?? []).join('+')}`);
