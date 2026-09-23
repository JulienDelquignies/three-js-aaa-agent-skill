// sonde 288e — LA POPULATION DES REFUS controle-dos du receveur visé : à chaque refus (le cône, lot 70), la géométrie de l'image d'avant —
// l'angle du ballon au regard, l'angle de la vitesse RELATIVE du ballon au regard (double dans le sens du regard / croise / vient de face),
// l'écart latéral de sa ligne au corps, le temps avant qu'il soit devant, la vitesse du ballon et du corps ; et l'issue (l'équipe garde le
// ballon dans les 3 s ?). Dit quelle part des refus est un ballon qui DOUBLE (la loi 288 v2), un ballon qui CROISE, un receveur arrêté.
import { makeMatch, matchStep, matchCfg } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/match-sim.js';
import { attendDe } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/ouverture.js';
const seeds = (process.argv[2] ?? '3,7').split(',').map(Number), over = JSON.parse(process.argv[3] ?? '{}'), DUR = +(process.argv[4] ?? 2700);
const hyp = Math.hypot, pc = (a, b) => (100 * a / Math.max(1, b)).toFixed(0), wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const q = (a, x) => { a = [...a].sort((u, v) => u - v); return a.length ? a[Math.floor(x * a.length)] : NaN; };
const o = { n: 0, refus: 0, attend: 0, dir: { double: 0, croise: 0, face: 0 }, dosA: [], lat: [], tDev: [], vB: [], vR: [], arrete: 0, garde: 0, perdu: 0, gardeAttend: 0, gardeDouble: 0, perduDouble: 0, byDir: {} };
for (const seed of seeds) {
  const st = makeMatch({ full: true, seed }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: DUR, pause: 10 }, ...over }); o.n++;
  let prev = null, dos0 = 0; const pend = [];
  for (let i = 0; i < DUR * 60 * 2.4; i++) {
    const rec = st.phase === 'flight' && st.pass && st.pass.to >= 0 ? st.players[st.pass.to] : null;
    const snap = rec ? { id: rec.id, team: rec.team, yaw: rec.yaw, p: [rec.p[0], rec.p[1], rec.p[2]], v: [rec.v[0], rec.v[1]], speed: rec.speed ?? hyp(rec.v[0], rec.v[1]) } : null;
    const ball0 = { p: [st.ball.p[0], st.ball.p[1], st.ball.p[2]], v: [st.ball.v[0], st.ball.v[1], st.ball.v[2]] };
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break;
    const dos1 = st.deny?.['controle-dos'] ?? 0;
    if (dos1 > dos0 && snap && st.possession.carrier < 0) { o.refus++;
      const a = attendDe(snap, ball0, cfg.ouverture ?? { }, 1); if (a.attend) o.attend++;
      const ux = Math.cos(snap.yaw), uz = Math.sin(snap.yaw), wx = ball0.v[0] - snap.v[0], wz = ball0.v[2] - snap.v[1], w = hyp(wx, wz) || 1;
      const cosD = (wx * ux + wz * uz) / w, dir = cosD > 0.5 ? 'double' : cosD < -0.5 ? 'face' : 'croise'; o.dir[dir]++;
      o.dosA.push(Math.abs(wrap(Math.atan2(ball0.p[2] - snap.p[2], ball0.p[0] - snap.p[0]) - snap.yaw)) * 180 / Math.PI); o.lat.push(a.lat); o.tDev.push(a.tDevant); o.vB.push(hyp(ball0.v[0], ball0.v[2])); o.vR.push(snap.speed); if (snap.speed < 1) o.arrete++;
      pend.push({ t: st.t, team: snap.team, attend: a.attend, dir }); }
    dos0 = dos1;
    for (let k = pend.length - 1; k >= 0; k--) { const P = pend[k]; if (st.t - P.t < 3) continue; const car = st.possession.carrier >= 0 ? st.players[st.possession.carrier] : null; const garde = !!(car && car.team === P.team);
      if (garde) o.garde++; else o.perdu++; if (P.attend && garde) o.gardeAttend++; if (P.dir === 'double') { if (garde) o.gardeDouble++; else o.perduDouble++; } (o.byDir[P.dir] ??= { n: 0, g: 0 }).n++; if (garde) o.byDir[P.dir].g++; pend.splice(k, 1); }
  }
}
console.log(`${o.n} × ${(DUR / 60).toFixed(0)} min ${JSON.stringify(over)} — ${o.refus} refus controle-dos du receveur visé (${(o.refus / o.n).toFixed(0)} / match) : la loi 288 v2 (attend) en couvre ${pc(o.attend, o.refus)} % ; le ballon DOUBLE dans le sens du regard ${pc(o.dir.double, o.refus)} %, CROISE ${pc(o.dir.croise, o.refus)} %, vient DE FACE (regard dans le mauvais sens) ${pc(o.dir.face, o.refus)} % ; receveur arrêté (< 1 m/s) ${pc(o.arrete, o.refus)} %`);
console.log(`  angle du ballon au regard p50 ${q(o.dosA, 0.5).toFixed(0)}° (p25 ${q(o.dosA, 0.25).toFixed(0)}) ; écart latéral de la ligne p50 ${q(o.lat, 0.5).toFixed(2)} m (p75 ${q(o.lat, 0.75).toFixed(2)}) ; devant dans p50 ${q(o.tDev, 0.5).toFixed(2)} s ; ballon p50 ${q(o.vB, 0.5).toFixed(1)} m/s, corps p50 ${q(o.vR, 0.5).toFixed(1)} m/s`);
console.log(`  l'issue à 3 s : l'équipe GARDE ${pc(o.garde, o.garde + o.perdu)} % (${o.garde + o.perdu}) ; par direction : ${Object.entries(o.byDir).map(([k, g]) => `${k} garde ${pc(g.g, g.n)} % de ${g.n}`).join(', ')}`);
