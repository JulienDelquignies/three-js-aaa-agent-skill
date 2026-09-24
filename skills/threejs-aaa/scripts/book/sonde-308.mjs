// sonde 308 — LA LOCOMOTION SUR UN MATCH (distances par bande de vitesse, pointes, accélérations et freinages par minute, contre les études GPS du book). usage : node sonde-308.mjs [graine]
const { makeMatch, matchStep, matchCfg } = await import('/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/match-sim.js');
const seed = +(process.argv[2] ?? 3), DUR = 2700; const st = makeMatch({ full: true, seed }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: DUR, pause: 10 } });
const N = st.players.length, B = [2, 4, 5.5, 7, 99], dist = st.players.map(() => B.map(() => 0)), vmax = st.players.map(() => 0), acc = st.players.map(() => 0), dec = st.players.map(() => 0), A = [];
const vPrev = st.players.map(() => 0), aF = st.players.map(() => 0); let jeu = 0, i = 0; const hz = 60, win = 30; const hist = st.players.map(() => []);
for (; i < DUR * 60 * 2.4; i++) { matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break; jeu += 1 / 60;
  st.players.forEach((p, k) => { const v = Math.hypot(p.v[0], p.v[1]); const d = v / 60; let b = 0; while (v >= B[b]) b++; dist[k][b] += d; if (v > vmax[k]) vmax[k] = v;
    const h = hist[k]; h.push(v); if (h.length > 30) h.shift(); if (h.length === 30) { const a = (h[29] - h[0]) / 0.5; A.push(a); // accélération moyenne sur 0,5 s
      if (a > 3 && !(aF[k] > 0)) { acc[k]++; aF[k] = 1; } else if (a < -3 && !(aF[k] < 0)) { dec[k]++; aF[k] = -1; } else if (Math.abs(a) < 1) aF[k] = 0; } }); }
const min = jeu / 60, out = st.players.filter(p => !p.keeper).map((p) => p.id);
const tot = out.map(k => dist[k].reduce((a, x) => a + x, 0) * 90 / min), q = (a, f) => [...a].sort((x, y) => x - y)[Math.floor(f * (a.length - 1))];
const band = (b) => out.map(k => dist[k][b] * 90 / min);
console.log(`temps simulé ${min.toFixed(1)} min (horloge de match, arrêts compris) — par joueur de champ, ramené à 90 min :`);
console.log(`  distance totale p10/50/90 : ${(q(tot, .1) / 1000).toFixed(2)} / ${(q(tot, .5) / 1000).toFixed(2)} / ${(q(tot, .9) / 1000).toFixed(2)} km`);
const nm = ['marche < 2 m/s', 'trot 2-4', 'course 4-5,5', 'haute vitesse 5,5-7', 'sprint > 7'];
nm.forEach((n, b) => console.log(`  ${n.padEnd(22)} p50 ${q(band(b), .5).toFixed(0)} m (p10 ${q(band(b), .1).toFixed(0)}, p90 ${q(band(b), .9).toFixed(0)})`));
const vm = out.map(k => vmax[k]); console.log(`  vitesse de pointe du match p10/50/90/max : ${q(vm, .1).toFixed(2)} / ${q(vm, .5).toFixed(2)} / ${q(vm, .9).toFixed(2)} / ${Math.max(...vm).toFixed(2)} m/s`);
console.log(`  accélérations > 3 m/s² (sur 0,5 s) par minute p50 : ${q(out.map(k => acc[k] / min), .5).toFixed(2)} ; décélérations < −3 : ${q(out.map(k => dec[k] / min), .5).toFixed(2)}`);
console.log(`  accélération p99 / p1 (sur 0,5 s) : ${q(A, .99).toFixed(2)} / ${q(A, .01).toFixed(2)} m/s²`);
