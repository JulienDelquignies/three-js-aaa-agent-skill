// LA FUITE, À SA NAISSANCE (face.js) : chaque épisode où le porteur tourne le dos au défenseur côté but à 2-4 m (0,5 s tenu), les 1,8 s d'avant
// toutes les 0,1 s — cap, poussée et ballon rapportés à la direction du défenseur, touches, duels. C'est elle qui a montré le verrou : la
// poussée tournée vers le défenseur, chaque touche renvoyait le ballon dans la course (le cône du porté). Usage : node face-fuite.mjs [graine=1] [épisodes=3]
import { makeDuel, duelCfg } from '../../assets/starter/src/engine/duel-1v1.js';
import { matchStep } from '../../assets/starter/src/engine/match-sim.js';
const seed = +(process.argv[2] ?? 1), MAX = +(process.argv[3] ?? 3); const st = makeDuel({ seed }), cfg = duelCfg(); let ne = 0, shown = 0, dosT = 0, hist = [];
const angDef = (c, q, vx, vz) => { const dx = q.p[0] - c.p[0], dz = q.p[2] - c.p[2], d = Math.hypot(dx, dz), v = Math.hypot(vx, vz); return v < 1e-3 ? null : Math.round(Math.acos(Math.max(-1, Math.min(1, (dx * vx + dz * vz) / (d * v)))) * 180 / Math.PI); };
for (let i = 0; i < 120 * 60 && shown < MAX; i++) { matchStep(st, 1 / 60, cfg); const evs = []; while (ne < st.events.length) evs.push(st.events[ne++]);
  const c = st.players[st.possession?.carrier ?? -1]; const q = c ? st.players.find((p) => p.team !== c.team && !p.keeper) : null;
  if (c && !c.keeper && st.phase === 'carry') { const d = Math.hypot(q.p[0] - c.p[0], q.p[2] - c.p[2]);
    hist.push(`${st.t.toFixed(2)} d=${d.toFixed(1)} v=${c.speed.toFixed(1)} cap∠déf=${angDef(c, q, c.v[0], c.v[1])} poussée∠déf=${c.push ? angDef(c, q, c.push[0], c.push[1]) : '-'} ballon∠déf=${angDef(c, q, st.ball.p[0] - c.p[0], st.ball.p[2] - c.p[2])} déf v=${Math.hypot(...q.v).toFixed(1)} ${evs.filter((e) => e.type !== 'moment').map((e) => e.type + (e.kind ? ':' + e.kind : '') + (e.by === c.id ? '(A)' : e.by === q.id ? '(D)' : '')).join(' ')}`);
    if (hist.length > 110) hist.shift();
    const g = st.pitch.attackGoal(c.team), gx = g.x - c.p[0], gz = -c.p[2], gl = Math.hypot(gx, gz), dx = q.p[0] - c.p[0], dz = q.p[2] - c.p[2];
    const dos = d >= 2 && d <= 4 && (dx * gx + dz * gz) / (d * gl) >= Math.cos(50 * Math.PI / 180) && c.speed >= 0.5 && (dx * c.v[0] + dz * c.v[1]) / (d * c.speed) < Math.cos(110 * Math.PI / 180);
    dosT = dos ? dosT + 1 : 0;
    if (dosT === 30) { shown++; console.log(`=== s${seed} épisode DOS installé à t=${st.t.toFixed(2)} (porteur ${c.id}) — les 1,8 s d'avant, toutes les 0,1 s :`); hist.filter((_, k) => k % 6 === 0 || /touche|duel|skill|control|turnover|windup|face/.test(_)).forEach((h) => console.log('  ' + h)); hist = []; } } else { hist = []; dosT = 0; } }
