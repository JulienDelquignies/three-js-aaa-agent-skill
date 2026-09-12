// sonde 265 — la passe qui se manque à la bonne distance : réussite par DISTANCE (5-15 / 15-30 / 30+ yd ; réel 88-92 / 82-87 / 55-65 %) et par direction, la cause de la perte (en vol : interceptée ; au contact : le receveur n'a jamais possédé ; après contrôle : perdue < 2 s ; sortie), la pression sur le receveur à l'arrivée (adversaire le plus proche), le style.
import { makeMatch, matchStep, matchCfg } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/match-sim.js';
const seeds = (process.argv[2] ?? '3,7').split(',').map(Number), over = JSON.parse(process.argv[3] ?? '{}'), DUR = +(process.argv[4] ?? 2700);
const bins = [[0, 9.14], [9.14, 13.7], [13.7, 27.4], [27.4, 999]], names = ['< 10 yd', '5-15 yd', '15-30 yd', '30+ yd'];
const R = bins.map(() => ({ n: 0, ok: 0, vol: 0, contact: 0, apres: 0, sortie: 0, pres: [], sol: 0, solOk: 0, air: 0, airOk: 0, arr: 0, arrOk: 0 }));
let n = 0, tot = 0, totOk = 0, bloq = 0;
const hyp = Math.hypot;
for (const seed of seeds) {
  const st = makeMatch({ full: true, seed }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: DUR, pause: 10 }, ...over }); n++;
  let n0 = 0; const suivis = [];
  for (let i = 0; i < DUR * 60 + 600; i++) {
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break;
    for (; n0 < st.events.length; n0++) { const e = st.events[n0]; if (e.type === 'pass' && e.to >= 0 && st.pass && st.pass.to === e.to && !e.sansCible) { const P = st.pass, d = hyp(P.lead[0] - P.origin[0], P.lead[2] - P.origin[1]); const from = st.players[e.by], to = st.players[e.to]; const g = st.pitch.attackGoal(from.team); const arriere = (P.lead[0] - P.origin[0]) * Math.sign(g.x - P.origin[0] || 1) < -2; suivis.push({ t0: st.t, team: from.team, from: e.by, to: e.to, ev: n0, d, style: P.style, cross: !!P.cross, arriere, touche: false, arrive: false, pres: null, done: false, bloque: false }); } }
    for (const s of suivis) { if (s.done) continue; const dt = st.t - s.t0;
      if (!s.arrive && st.phase !== 'flight') { s.arrive = true; const rec = st.players[s.to]; let dm = 99; for (const q of st.players) if (q.team !== s.team && !q.keeper) dm = Math.min(dm, hyp(q.p[0] - rec.p[0], q.p[2] - rec.p[2])); s.pres = dm; }
      const car = st.possession.carrier >= 0 ? st.players[st.possession.carrier] : null;
      if (st.ball.owner === s.to || (car && car.id === s.to && st.phase === 'carry')) s.touche = true;
      if (s.arrive && s.tArr == null) s.tArr = st.t;
      for (; s.ev < st.events.length; s.ev++) { const e = st.events[s.ev]; if (e.type === 'control' && e.by === s.to && e.miss) s.miss = true;
        if (s.premiere == null && e.t > s.t0 + 0.05 && e.by != null && e.by !== s.from && ['receive', 'control', 'loose-kept', 'pass', 'shot', 'centre', 'clearance', 'tacle-pique', 'duel', 'un-deux', 'troisieme'].includes(e.type) && !(e.type === 'control' && e.miss)) { s.premiere = st.players[e.by]?.team; if (s.premiere === s.team) s.recu = true; else { const rec = st.players[s.to]; s.dRec = Math.hypot(rec.p[0] - st.ball.p[0], rec.p[2] - st.ball.p[2]); } s.done = true; s.res = s.recu ? 'ok' : s.miss ? 'controle' : s.dRec >= 1.5 ? 'vol' : 'contest'; } }
      if (s.done) { const b = bins.findIndex(([a, c]) => s.d >= a && s.d < c); const r = R[b]; r.n++; tot++; if (s.res === 'ok') { r.ok++; totOk++; } if (s.res === 'vol') r.vol++; if (s.res === 'contest') r.contact++; if (s.res === 'controle') r.ctrl = (r.ctrl ?? 0) + 1; if (s.recu) r.recu = (r.recu ?? 0) + 1; if (s.pres != null) r.pres.push(s.pres); const air = s.style !== 'ground' && s.style !== 'touche'; if (air) { r.air++; if (s.res === 'ok') r.airOk++; } else { r.sol++; if (s.res === 'ok') r.solOk++; } if (s.arriere) { r.arr++; if (s.res === 'ok') r.arrOk++; } continue; }
      const own = st.ball.owner != null ? st.players[st.ball.owner] : (car && st.phase === 'carry' ? car : null);
      if (own && own.team !== s.team && dt > 0.1) { s.done = true; s.res = s.touche ? 'apres' : s.miss ? 'controle' : (s.arrive && st.t - s.tArr < 0.12 ? 'vol' : 'contest'); }
      else if (s.touche && dt > 2.0 && own && own.team === s.team) { s.done = true; s.res = 'ok'; }
      else if (st.restart && dt > 0.2) { s.done = true; s.res = s.touche ? 'ok' : 'sortie'; }
      else if (dt > 4) { s.done = true; s.res = s.touche ? 'ok' : (own && own.team === s.team ? 'ok' : 'contest'); }
      if (s.done) { const b = bins.findIndex(([a, c]) => s.d >= a && s.d < c); const r = R[b]; r.n++; tot++; if (s.res === 'ok') { r.ok++; totOk++; } if (s.res === 'vol') r.vol++; if (s.res === 'contest') r.contact++; if (s.res === 'controle') r.ctrl = (r.ctrl ?? 0) + 1; if (s.recu) r.recu = (r.recu ?? 0) + 1; if (s.res === 'apres') r.apres++; if (s.res === 'sortie') r.sortie++; if (s.pres != null) r.pres.push(s.pres); const air = s.style !== 'ground' && s.style !== 'touche'; if (air) { r.air++; if (s.res === 'ok') r.airOk++; } else { r.sol++; if (s.res === 'ok') r.solOk++; } if (s.arriere) { r.arr++; if (s.res === 'ok') r.arrOk++; } }
    }
  }
}
const pc = (a, b) => b ? (100 * a / b).toFixed(0) + ' %' : '—', q = (a, x) => { a = [...a].sort((u, v) => u - v); return a.length ? a[Math.floor(x * a.length)].toFixed(1) : '—'; };
console.log(`${n} × ${DUR / 60} min ${JSON.stringify(over)} — ${(tot / n).toFixed(0)} passes suivies / match, réussie (première touche d'un coéquipier) ${pc(totOk, tot)} (réel 80-83)`);
for (let b = 0; b < bins.length; b++) { const r = R[b]; console.log(`  ${names[b].padEnd(9)} n ${String(r.n).padStart(4)} réussie ${pc(r.ok, r.n).padStart(5)} — interceptée (receveur ≥ 1,5 m) ${pc(r.vol, r.n)}, perdue au pied ${pc(r.contact, r.n)}, contrôle manqué ${pc(r.ctrl ?? 0, r.n)}, sortie / autre ${pc(r.n - r.ok - r.vol - r.contact - (r.ctrl ?? 0), r.n)} ; presseur du receveur à l'arrivée p50 ${q(r.pres, 0.5)} m ; sol ${pc(r.solOk, r.sol)} (${r.sol}) / aérien ${pc(r.airOk, r.air)} (${r.air}) ; arrière ${pc(r.arrOk, r.arr)} (${r.arr})`); }
