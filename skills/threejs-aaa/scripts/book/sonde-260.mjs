// sonde locomotrice — le budget de course : par joueur de champ et par match, distance totale, haute intensité (> 5,5 m/s), sprint (> 7 m/s), nombre de sprints (bouts > 7 m/s ≥ 1 s), accélérations et décélérations > 3 m/s² tenues ≥ 0,3 s (lissées sur 0,2 s) par minute, pic de vitesse ; par poste. Réel (Référentiel 05) : 10,5 km, HI 686 m, sprint 166 m, 10 sprints, 0,9 accel/min, ratio décel/accel > 1,15.
import { makeMatch, matchStep, matchCfg } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/match-sim.js';
const seeds = (process.argv[2] ?? '3,7').split(',').map(Number), over = JSON.parse(process.argv[3] ?? '{}'), DUR = +(process.argv[4] ?? 5400);
const acc = { n: 0, dist: 0, hi: 0, sprint: 0, sprints: 0, accels: 0, decels: 0, pics: [], byPost: {}, minutes: 0, vmaxT: [] };
for (const seed of seeds) {
  const st = makeMatch({ full: true, seed }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: 2700, pause: 10 }, ...over }); acc.n++;
  const P = st.players.filter((p) => !p.keeper); const prev = new Map(P.map((p) => [p.id, { v: 0, inSprint: false, sprintT: 0, pic: 0, dist: 0, hi: 0, sp: 0, acc: 0, dec: 0 }]));
  let frames = 0;
  for (let i = 0; i < DUR * 60; i++) {
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break; frames++;
    for (const p of P) { const r = prev.get(p.id); const v = Math.hypot(p.v[0], p.v[1]); (r.hist ??= []).push(v); if (r.hist.length > 12) r.hist.shift(); const a = r.hist.length >= 12 ? (r.hist[11] - r.hist[0]) * 60 / 11 : 0; r.v = v; /* accélération lissée sur 0,2 s (12 images) */ r.dist += v / 60; if (v > 5.5) r.hi += v / 60; if (v > 7) r.sp += v / 60; if (v > r.pic) r.pic = v;
      if (v > 7) { r.sprintT += 1 / 60; if (!r.inSprint && r.sprintT >= 1) { r.inSprint = true; acc.sprints++; } } else { r.inSprint = false; r.sprintT = 0; }
      if (a > 3) { r.accT = (r.accT ?? 0) + 1 / 60; if (!r.accOn && r.accT >= 0.3) { r.accOn = true; r.acc++; } } else { r.accOn = false; r.accT = 0; }
      if (a < -3) { r.decT = (r.decT ?? 0) + 1 / 60; if (!r.decOn && r.decT >= 0.3) { r.decOn = true; r.dec++; } } else { r.decOn = false; r.decT = 0; } }
  }
  acc.minutes += frames / 3600;
  for (const p of P) { const r = prev.get(p.id); acc.dist += r.dist; acc.hi += r.hi; acc.sprint += r.sp; acc.accels += r.acc; acc.decels += r.dec; acc.pics.push(r.pic); const k = p.post ?? 0; (acc.byPost[k] ??= { d: 0, pic: 0, n: 0 }); acc.byPost[k].d += r.dist; acc.byPost[k].pic = Math.max(acc.byPost[k].pic, r.pic); acc.byPost[k].n++; }
}
const nJ = acc.n * 20, min = acc.minutes / acc.n;
const q = (a, x) => { a = [...a].sort((u, v) => u - v); return a.length ? a[Math.floor(x * a.length)] : NaN; };
console.log(`${acc.n} × ${(min).toFixed(0)} min ${JSON.stringify(over)} — par joueur de champ : distance ${(acc.dist / nJ / 1000).toFixed(2)} km (réel 10,5 ; équipe ${(acc.dist / acc.n / 1000).toFixed(0)} km c. 108) ; HI > 5,5 m/s ${(acc.hi / nJ).toFixed(0)} m (686) ; sprint > 7 m/s ${(acc.sprint / nJ).toFixed(0)} m (166) ; sprints ${(acc.sprints / nJ).toFixed(1)} (10,3) ; accélérations > 3 m/s² ${(acc.accels / nJ / min).toFixed(2)} / min (0,81-0,97), décélérations ${(acc.decels / nJ / min).toFixed(2)} / min (0,86-1,17), ratio ${(acc.decels / Math.max(1, acc.accels)).toFixed(2)} (> 1,15) ; pic de vitesse p50 ${q(acc.pics, 0.5).toFixed(2)} m/s (p90 ${q(acc.pics, 0.9).toFixed(2)})`);
console.log('par poste (km, pic) : ' + Object.entries(acc.byPost).map(([k, v]) => `${k}: ${(v.d / v.n / 1000).toFixed(1)}/${v.pic.toFixed(1)}`).join(' '));
