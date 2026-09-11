// sonde 261 — l'intention d'effort au cerveau : la sonde 260 + l'HISTOGRAMME des zones de vitesse (Référentiel 05 §3 : marche < 6 km/h 30 %, jogging 6-12 34 %, course 12-19,8 ~30 %, haute intensité > 19,8 < 7 %, sprint > 25,2 < 2 %), et la distance HI par MÉTIER et par MOMENT (qui court vite ?).
import { makeMatch, matchStep, matchCfg } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/match-sim.js';
import { momentDuJeu } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/phases.js';
const seeds = (process.argv[2] ?? '3,7').split(',').map(Number), over = JSON.parse(process.argv[3] ?? '{}'), DUR = +(process.argv[4] ?? 5400);
const acc = { n: 0, dist: 0, hi: 0, sprint: 0, sprints: 0, accels: 0, decels: 0, pics: [], minutes: 0, bands: [0, 0, 0, 0, 0], hiJob: {}, dJob: {}, hiMom: {}, dMom: {}, tirs: 0, dGk: 0 };
const B = [1.667, 3.333, 5.5, 7.0];
for (const seed of seeds) {
  const st = makeMatch({ full: true, seed }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: 2700, pause: 10 }, ...over }); acc.n++;
  const P = st.players.filter((p) => !p.keeper), GK = st.players.filter((p) => p.keeper); const prev = new Map(st.players.map((p) => [p.id, { v: 0, inSprint: false, sprintT: 0, pic: 0, dist: 0, hi: 0, sp: 0, acc: 0, dec: 0, hist: [] }]));
  let frames = 0, n0 = st.events.length;
  for (let i = 0; i < DUR * 60; i++) {
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break; frames++;
    for (const p of GK) { const v = Math.hypot(p.v[0], p.v[1]); acc.dGk += v / 60; }
    for (const p of P) { const r = prev.get(p.id); const v = Math.hypot(p.v[0], p.v[1]); r.hist.push(v); if (r.hist.length > 12) r.hist.shift(); const a = r.hist.length >= 12 ? (r.hist[11] - r.hist[0]) * 60 / 11 : 0; r.v = v; const dd = v / 60; r.dist += dd; if (v > 5.5) r.hi += dd; if (v > 7) r.sp += dd; if (v > r.pic) r.pic = v;
      let b = 0; while (b < 4 && v > B[b]) b++; acc.bands[b] += dd;
      const j = (p._pace?.until ?? -1) > st.t ? 'burst' : (p.job ?? '?'); acc.dJob[j] = (acc.dJob[j] ?? 0) + dd; if (v > 5.5) acc.hiJob[j] = (acc.hiJob[j] ?? 0) + dd;
      const m = momentDuJeu(st, p.team, 5); acc.dMom[m] = (acc.dMom[m] ?? 0) + dd; if (v > 5.5) acc.hiMom[m] = (acc.hiMom[m] ?? 0) + dd;
      if (v > 7) { r.sprintT += 1 / 60; if (!r.inSprint && r.sprintT >= 1) { r.inSprint = true; acc.sprints++; } } else { r.inSprint = false; r.sprintT = 0; }
      if (a > 3) { r.accT = (r.accT ?? 0) + 1 / 60; if (!r.accOn && r.accT >= 0.3) { r.accOn = true; r.acc++; } } else { r.accOn = false; r.accT = 0; }
      if (a < -3) { r.decT = (r.decT ?? 0) + 1 / 60; if (!r.decOn && r.decT >= 0.3) { r.decOn = true; r.dec++; } } else { r.decOn = false; r.decT = 0; } }
  }
  acc.minutes += frames / 3600; acc.tirs += st.events.slice(n0).filter((e) => e.type === 'shot').length;
  for (const p of P) { const r = prev.get(p.id); acc.dist += r.dist; acc.hi += r.hi; acc.sprint += r.sp; acc.accels += r.acc; acc.decels += r.dec; acc.pics.push(r.pic); }
}
const nJ = acc.n * 20, min = acc.minutes / acc.n, q = (a, x) => { a = [...a].sort((u, v) => u - v); return a.length ? a[Math.floor(x * a.length)] : NaN; }, pc = (x) => (100 * x / acc.dist).toFixed(1) + ' %';
console.log(`${acc.n} × ${min.toFixed(0)} min ${JSON.stringify(over)} — par joueur de champ : ${(acc.dist / nJ / 1000).toFixed(2)} km (réel 10,5) ; HI > 5,5 ${(acc.hi / nJ).toFixed(0)} m (686) ; sprint > 7 ${(acc.sprint / nJ).toFixed(0)} m (166) ; sprints ${(acc.sprints / nJ).toFixed(1)} (10,3) ; accel ${(acc.accels / nJ / min).toFixed(2)}/min (0,9), décel ${(acc.decels / nJ / min).toFixed(2)}, ratio ${(acc.decels / Math.max(1, acc.accels)).toFixed(2)} ; pic p50 ${q(acc.pics, 0.5).toFixed(2)} (p90 ${q(acc.pics, 0.9).toFixed(2)}) ; tirs ${(acc.tirs / acc.n).toFixed(1)} / match ; gardien ${(acc.dGk / acc.n / 2 / 1000).toFixed(2)} km (4,7)`);
console.log(`zones (part de la distance ; réel 30 / 34 / 30 / 5 / 1,7) : marche ${pc(acc.bands[0])}, jog ${pc(acc.bands[1])}, course ${pc(acc.bands[2])}, HI ${pc(acc.bands[3])}, sprint ${pc(acc.bands[4])}`);
console.log('par métier (distance % / HI m par joueur) : ' + Object.entries(acc.dJob).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pc(v)} / ${((acc.hiJob[k] ?? 0) / nJ).toFixed(0)}`).join(' ; '));
console.log('par moment (distance % / HI m par joueur) : ' + Object.entries(acc.dMom).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pc(v)} / ${((acc.hiMom[k] ?? 0) / nJ).toFixed(0)}`).join(' ; '));
