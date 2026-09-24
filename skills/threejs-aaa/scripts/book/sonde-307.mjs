// sonde 307 — usage : node sonde-307.mjs [graine] [json des réglages] [durée par période, 900]
// LES FREINAGES : chaque décélération < −3 m/s² (moyenne sur 0,5 s, le seuil des études GPS) d'un joueur de champ, classée par sa cause probable.
const { makeMatch, matchStep, matchCfg } = await import('/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/match-sim.js');
const seed = +(process.argv[2] ?? 3), over = JSON.parse(process.argv[3] ?? '{}'), DUR = +(process.argv[4] ?? 900);
const st = makeMatch({ full: true, seed }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: DUR, pause: 10 }, ...over });
const H = st.players.map(() => []), etat = st.players.map(() => 0), C = {}, V = [], J = {}; let jeu = 0, nAcc = 0;
for (let i = 0; i < DUR * 60 * 2.4; i++) { const poss0 = st.possession.team; matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break; jeu += 1 / 60;
  st.players.forEach((p, k) => { if (p.keeper) return; const v = Math.hypot(p.v[0], p.v[1]);
    H[k].push({ v, job: p.job, tg: p.target ? [p.target[0], p.target[2]] : null, pos: [p.p[0], p.p[2]], poss: st.possession.team, restart: !!st.restart, pace: (p._pace?.until ?? -1) > st.t ? p._pace.kind : null }); if (H[k].length > 31) H[k].shift();
    if (H[k].length < 31) return; const a = (H[k][30].v - H[k][0].v) / 0.5;
    if (a < -3 && etat[k] !== -1) { etat[k] = -1; const h0 = H[k][0], h1 = H[k][30];
      const saut = h0.tg && h1.tg ? Math.hypot(h1.tg[0] - h0.tg[0], h1.tg[1] - h0.tg[1]) : 0, dTg0 = h0.tg ? Math.hypot(h0.tg[0] - h0.pos[0], h0.tg[1] - h0.pos[1]) : 99;
      const cause = h1.restart && !h0.restart ? 'arrêt de jeu' : h0.poss !== h1.poss ? 'changement de possession' : h0.job !== h1.job ? `rôle ${h0.job} → ${h1.job}` : h0.pace && !h1.pace ? `fin d'accélération (${h0.pace})` : saut > 3 ? `cible qui saute (même rôle ${h1.job})` : dTg0 < 3 ? `arrivée à la cible (${h1.job})` : `autre (${h1.job})`;
      C[cause] = (C[cause] ?? 0) + 1; V.push(h0.v); J[h1.job] = (J[h1.job] ?? 0) + 1; }
    else if (a > 3 && etat[k] !== 1) { etat[k] = 1; nAcc++; } else if (Math.abs(a) < 1) etat[k] = 0; }); }
const n = Object.values(C).reduce((a, x) => a + x, 0), min = jeu / 60 * 20;
console.log(`décélérations < −3 m/s² : ${n} → ${(n / min).toFixed(2)} par joueur-minute (réel 0,86-1,17) ; accélérations > 3 : ${(nAcc / min).toFixed(2)} (réel 0,81-0,97)`);
console.log(`vitesse au départ du freinage p25/50/75 : ${[.25, .5, .75].map(f => [...V].sort((x, y) => x - y)[Math.floor(f * (V.length - 1))].toFixed(1)).join(' / ')} m/s`);
for (const [k, v] of Object.entries(C).sort((a, b) => b[1] - a[1]).slice(0, 14)) console.log(`  ${(100 * v / n).toFixed(0).padStart(3)} %  ${k}`);
