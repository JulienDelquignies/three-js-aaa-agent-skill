// sonde 286 — LE CONTRÔLE ET CE QUI SUIT (retour du 17/09 : « trop de mauvais contrôles où le ballon reste dans les pieds du joueur qui
// s'emmêle et doit faire demi-tour pour le récupérer ») : à chaque contrôle réussi (le receveur possède), le ballon 0,3 s après
// relativement au corps (devant / aux pieds < 0,35 m / DERRIÈRE le regard), le plus grand virage du receveur dans les 2 s (le DEMI-TOUR
// > 120°), la perte-reprise (il lâche le ballon à < 2,5 m puis le reprend : « il s'emmêle »), l'arrêt net (vitesse à 1 s ÷ vitesse au
// contact), par régime (en course ≥ 2 m/s c. posé) et par pression ; les issues du 265 (propre / lourde / manqué / contesté) et le
// settle p50 — la sonde du lot 286.
import { makeMatch, matchStep, matchCfg } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/match-sim.js';
const seeds = (process.argv[2] ?? '3,7').split(',').map(Number), over = JSON.parse(process.argv[3] ?? '{}'), DUR = +(process.argv[4] ?? 2700);
const hyp = Math.hypot, wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a)), q = (a, x) => { a = [...a].sort((u, v) => u - v); return a.length ? a[Math.floor(x * a.length)] : NaN; }, moy = (a) => a.length ? a.reduce((u, v) => u + v, 0) / a.length : NaN;
const R = { course: { n: 0, derriere: 0, pieds: 0, devant: 0, demi: 0, emmele: 0, dos: 0, dosTurn: 0, arret: [], settle: [], demiVersBut: 0, demiVersSoi: 0, demiAvecBallon: 0, apres: {}, yawIn: [] }, pose: { n: 0, derriere: 0, pieds: 0, devant: 0, demi: 0, emmele: 0, dos: 0, dosTurn: 0, arret: [], settle: [], demiVersBut: 0, demiVersSoi: 0, demiAvecBallon: 0, apres: {}, yawIn: [] } };
const o = { n: 0, ctrl: 0, miss: 0, issues: {}, pend: [] };
for (const seed of seeds) {
  const st = makeMatch({ full: true, seed }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: DUR, pause: 10 }, ...over }); o.n++;
  let seen = 0; const suivis = [];
  for (let i = 0; i < DUR * 60 * 2.4; i++) {
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break;
    for (; seen < st.events.length; seen++) { const e = st.events[seen]; if (e.type !== 'control') continue; o.ctrl++; if (e.issue) o.issues[e.issue] = (o.issues[e.issue] ?? 0) + 1; if (e.miss) { o.miss++; continue; }
      const p = st.players[e.by]; if (!p || p.keeper || st.ball.owner !== p.id) continue;
      suivis.push({ p, t0: st.t, v0: hyp(p.v[0], p.v[1]), yaw0: p.yaw, maxTurn: 0, lost: false, retaken: false, dos: false, dosRetaken: false, v1: null, rel: null, done: false, ev0: st.events.length, turnOwner: true, gS: Math.sign(st.pitch.attackGoal(p.team).x || 1) }); }
    for (const s of suivis) { if (s.done) continue; const dt = st.t - s.t0, p = s.p;
      if (s.rel == null && dt >= 0.3) { const bx = st.ball.p[0] - p.p[0], bz = st.ball.p[2] - p.p[2], d = hyp(bx, bz); s.rel = d < 0.35 ? 'pieds' : (bx * Math.cos(p.yaw) + bz * Math.sin(p.yaw)) < -0.2 ? 'derriere' : 'devant'; s.settle = d; }
      { const tr = Math.abs(wrap(p.yaw - s.yaw0)) * 180 / Math.PI; if (tr > s.maxTurn) { s.maxTurn = tr; s.turnOwner = st.ball.owner === p.id; s.yawTurn = p.yaw; } }
      if (st.ball.owner !== p.id && hyp(st.ball.p[0] - p.p[0], st.ball.p[2] - p.p[2]) < 2.5 && !st.restart) s.lost = true; else if (s.lost && st.ball.owner === p.id) s.retaken = true;
      if (st.ball.owner !== p.id && !st.restart) { const bx = st.ball.p[0] - p.p[0], bz = st.ball.p[2] - p.p[2], d = hyp(bx, bz); if (d < 2.5 && d > 0.2 && (bx * Math.cos(p.yaw) + bz * Math.sin(p.yaw)) / d < -0.3) s.dos = true; } else if (s.dos && st.ball.owner === p.id) s.dosRetaken = true;
      if (s.v1 == null && dt >= 1) s.v1 = hyp(p.v[0], p.v[1]);
      if (dt >= 2) { s.done = true; const g = s.v0 >= 2 ? R.course : R.pose; g.n++; g[s.rel ?? 'devant']++; if (s.maxTurn > 120) g.demi++; if (s.retaken) g.emmele++; if (s.dosRetaken) { g.dos++; if (s.maxTurn > 90) g.dosTurn++; } g.yawIn.push(Math.abs(wrap(s.yaw0 - Math.atan2(0, s.gS))) * 180 / Math.PI); if (s.maxTurn > 120) { if (Math.cos(s.yawTurn) * s.gS > 0.3) g.demiVersBut++; else if (Math.cos(s.yawTurn) * s.gS < -0.3) g.demiVersSoi++; if (s.turnOwner) g.demiAvecBallon++; const nxt = st.events.slice(s.ev0).find((e) => e.by === p.id && ['pass', 'shot', 'centre', 'arbitre'].includes(e.type)); const k = nxt ? (nxt.type === 'arbitre' ? 'arbitre:' + nxt.choix : nxt.type) : 'aucune'; g.apres[k] = (g.apres[k] ?? 0) + 1; } if (s.v0 > 0.5) g.arret.push(s.v1 / s.v0); if (s.settle != null) g.settle.push(s.settle); } }
    if (suivis.length > 200) suivis.splice(0, suivis.length - 200);
  }
}
const n = o.n, L = (g, k) => `${k} : ${(g.n / n).toFixed(0)} / match — le ballon à 0,3 s : devant ${(100 * g.devant / Math.max(1, g.n)).toFixed(0)} %, aux pieds ${(100 * g.pieds / Math.max(1, g.n)).toFixed(0)} %, DERRIÈRE ${(100 * g.derriere / Math.max(1, g.n)).toFixed(0)} % ; demi-tour > 120° en 2 s ${(100 * g.demi / Math.max(1, g.n)).toFixed(0)} % ; lâche-reprend (la conduite normale comprise) ${(100 * g.emmele / Math.max(1, g.n)).toFixed(0)} % ; LE BALLON DANS LE DOS puis repris ${(100 * g.dos / Math.max(1, g.n)).toFixed(0)} % (dont avec un virage > 90° ${(100 * g.dosTurn / Math.max(1, g.n)).toFixed(0)} %) ; vitesse à 1 s ÷ au contact p50 ${q(g.arret, 0.5).toFixed(2)} ; settle p50 ${q(g.settle, 0.5).toFixed(2)} m ; le regard au contact vs le but adverse p50 ${q(g.yawIn, 0.5).toFixed(0)}° ; les demi-tours : vers le but adverse ${g.demiVersBut}, vers son but ${g.demiVersSoi}, ballon au pied pendant ${g.demiAvecBallon}, la décision qui suit ${JSON.stringify(g.apres)}`;
console.log(`${n} × ${(DUR / 60).toFixed(0)} min ${JSON.stringify(over)} — contrôles ${(o.ctrl / n).toFixed(0)} / match, manqués ${(100 * o.miss / Math.max(1, o.ctrl)).toFixed(1)} % ; issues du 265 ${JSON.stringify(o.issues)}`);
console.log(L(R.course, 'EN COURSE (≥ 2 m/s au contact)'));
console.log(L(R.pose, 'POSÉ (< 2 m/s)'));
