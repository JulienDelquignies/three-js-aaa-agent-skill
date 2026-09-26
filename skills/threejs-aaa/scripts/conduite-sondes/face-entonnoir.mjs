// L'ENTONNOIR DU FACE-À-FACE, IMAGE PAR IMAGE (face.js) : chaque image où le défenseur de champ est côté but à ≤ 7 m — face-à-face, approche,
// envie refusée, ou la PORTE qui bloque (par bande de distance ; sous 2 m, la porte d'entrée) ; la fermeture du défenseur quand le porteur lui
// tourne le dos à 2-4 m. Usage : node face-entonnoir.mjs [graines=8] [secondes=120]
import { makeDuel, duelCfg } from '../../assets/starter/src/engine/duel-1v1.js';
import { matchStep } from '../../assets/starter/src/engine/match-sim.js';
const [NG = '8', SECS = '120'] = process.argv.slice(2); const R = {}, FERME = []; let n = 0; const add = (k) => { R[k] = (R[k] ?? 0) + 1; n++; };
for (let seed = 1; seed <= +NG; seed++) { const st = makeDuel({ seed }), cfg = duelCfg(), K = cfg.face, A = K.approche, E = K.entree;
  for (let i = 0; i < +SECS * 60; i++) { matchStep(st, 1 / 60, cfg);
    const c = st.players[st.possession?.carrier ?? -1]; if (!c || c.keeper || st.phase !== 'carry' || st.restart) continue;
    const g = st.pitch.attackGoal(c.team), gx = g.x - c.p[0], gz = -c.p[2], gl = Math.hypot(gx, gz), q = st.players.find((p) => p.team !== c.team && !p.keeper), dx = q.p[0] - c.p[0], dz = q.p[2] - c.p[2], d = Math.hypot(dx, dz);
    if (d > 7 || (dx * gx + dz * gz) / (d * gl) < Math.cos(50 * Math.PI / 180)) continue;
    if (c._face) { add('FACE'); continue; } if (c._faceApp?.go) { add('APPROCHE'); continue; } if (c._faceApp && !c._faceApp.go) { add('envie-refusee'); continue; }
    const hx = c.speed > 0.5 ? c.v[0] / c.speed : Math.cos(c.yaw), hz = c.speed > 0.5 ? c.v[1] / c.speed : Math.sin(c.yaw), cf = (dx * hx + dz * hz) / d, ferme = -(q.v[0] * dx + q.v[1] * dz) / d, dB = Math.hypot(st.ball.p[0] - c.p[0], st.ball.p[2] - c.p[2]);
    const band = d < 2 ? '<2' : d < 4 ? '2-4' : '4-7';
    const why = c.act ? 'geste:' + (c.act.payload?.skill ?? c.act.payload?.kind ?? c.act.id) : c.down > 0 ? 'au-sol' : (c._faceCd ?? -1) > st.t ? 'cooldown' : gl < E.but ? 'zone-tir' : dB > A.ballon ? 'ballon-loin' : (st.ball.owner != null && st.ball.owner !== c.id) ? 'ballon-autre' : d < A.d[0] ? 'deja-pres' : cf >= Math.cos(A.dos * Math.PI / 180) ? 'OUVERTE-vers' : d < A.tourne ? 'dos-trop-pres' : (d - 1.5) / Math.max(0.5, ferme) < A.temps ? 'dos-pas-le-temps' : 'OUVERTE-dos';
    let w2 = why;
    if (why === 'deja-pres') { const bx = st.ball.p[0] - c.p[0], bz = st.ball.p[2] - c.p[2], vB = Math.hypot(st.ball.v[0], st.ball.v[2]), df = d - E.frein * c.speed;
      w2 = c.speed > E.vMax ? 'E:vite' : dB > E.ballon + E.frein * c.speed ? 'E:ballon-loin' : vB > E.vBallon ? 'E:ballon-vif' : bx * Math.cos(c.yaw) + bz * Math.sin(c.yaw) < 0.05 ? 'E:ballon-derriere' : q.act ? 'E:def-geste' : (q._bite ?? -1) > st.t ? 'E:def-mordu' : cf < Math.cos(E.face * Math.PI / 180) ? (cf < 0 ? 'E:dos' : 'E:pas-face') : ferme > (E.charge ?? 3) ? 'E:charge' : df < E.foe[0] ? 'E:trop-pres' : df > E.foe[1] ? 'E:trop-loin' : 'E:OUVERTE'; }
    if (why === 'dos-trop-pres') FERME.push(ferme);
    add(`${band}:${w2}`); } }
console.log(n, 'images défenseur côté but ≤ 7 m :'); for (const [k, v] of Object.entries(R).sort((a, b) => b[1] - a[1]).slice(0, 22)) console.log(`  ${k.padEnd(28)} ${(100 * v / n).toFixed(1)} %`);
const q2 = (xs, f) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(f * (s.length - 1))]; };
console.log('fermeture du défenseur, porteur dos à 2-4 m :', q2(FERME, 0.1).toFixed(1), q2(FERME, 0.5).toFixed(1), q2(FERME, 0.9).toFixed(1), 'm/s (p10/p50/p90)');
