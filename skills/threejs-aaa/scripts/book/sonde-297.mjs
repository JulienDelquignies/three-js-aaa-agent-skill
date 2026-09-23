// sonde 297 (lot 296) — LA RÉCEPTION QUI SE PERD (sonde-296 au monde du 294 : les pertes en conduite tombent tôt — la moitié avant
// 0,47 s de tenue, un quart dans les 0,02 s ; la conduite qui contourne le presseur (295) n'y peut rien, retirée). À chaque PRISE
// (control / receive, joueur de champ, jeu courant) : le défenseur le plus proche (distance, fermeture), la direction de la PREMIÈRE
// TOUCHE (la vitesse du ballon relatif au porteur 0,1 s après — vers le défenseur si cos > 0,5, à l'opposé si < −0,3), la vitesse de
// cette touche, la technique ; puis l'ISSUE à 1,5 s : perdu (changement de possession sans passe ni tir) ou gardé. Les deux
// populations comparées : qu'est-ce qui distingue la réception perdue de la réception gardée ?
import { makeMatch, matchStep, matchCfg } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/match-sim.js';
const seeds = (process.argv[2] ?? '3,7').split(',').map(Number), over = JSON.parse(process.argv[3] ?? '{}'), DUR = +(process.argv[4] ?? 2700);
const hyp = Math.hypot, pc = (a, b) => (b ? (100 * a / b).toFixed(1) : '—'), q = (a, x) => { a = [...a].sort((u, v) => u - v); return a.length ? a[Math.min(a.length - 1, Math.floor(x * a.length))] : NaN; };
const qs = (a) => [0.25, 0.5, 0.75].map((x) => q(a, x).toFixed(2)).join('/');
const mk = () => ({ n: 0, d: [], ferme: [], vers: 0, oppose: 0, vT: [], ecart: [], tech: {} });
const L = mk(), K = mk(); let matchs = 0;
for (const seed of seeds) {
  const st = makeMatch({ full: true, seed }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: DUR, pause: 10 }, ...over }); matchs++;
  let seen = 0; const pend = [];
  for (let i = 0; i < DUR * 60 * 2.4; i++) {
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break;
    for (; seen < st.events.length; seen++) { const e = st.events[seen], p = e.by != null ? st.players[e.by] : null;
      if ((e.type === 'control' || e.type === 'receive') && p && !p.keeper && !st.restart && !e.miss) {
        let D = null, dm = 99; for (const Q of st.players) if (Q.team !== p.team && !Q.keeper && Q.down <= 0) { const d = hyp(Q.p[0] - p.p[0], Q.p[2] - p.p[2]); if (d < dm) { dm = d; D = Q; } }
        const ux = (p.p[0] - D.p[0]) / (dm || 1), uz = (p.p[2] - D.p[2]) / (dm || 1);
        pend.push({ t: st.t, id: p.id, team: p.team, D, dm, ferme: D.v[0] * ux + D.v[1] * uz, tech: e.tech ?? e.type, dir: null }); }
      for (let k = pend.length - 1; k >= 0; k--) { const r = pend[k];
        if ((e.type === 'pass' || e.type === 'shot') && e.by === r.id) { r.issue = 'garde'; }
        else if (e.type === 'turnover' && e.equipe !== r.team) r.issue = 'perdu'; } }
    for (let k = pend.length - 1; k >= 0; k--) { const r = pend[k], p = st.players[r.id];
      if (!r.dir && st.t - r.t >= 0.1) { const bvx = st.ball.v[0] - p.v[0], bvz = st.ball.v[2] - p.v[1], bv = hyp(bvx, bvz), dx = r.D.p[0] - p.p[0], dz = r.D.p[2] - p.p[2], dl = hyp(dx, dz) || 1;
        r.dir = { cos: bv > 0.3 ? (bvx * dx + bvz * dz) / (bv * dl) : 0, v: hyp(st.ball.v[0], st.ball.v[2]), ecart: hyp(st.ball.p[0] - p.p[0], st.ball.p[2] - p.p[2]) }; }
      if (r.issue || st.t - r.t > 1.5) { const A = r.issue === 'perdu' ? L : K; if (r.dir) { A.n++; A.d.push(r.dm); A.ferme.push(r.ferme); if (r.dir.cos > 0.5) A.vers++; if (r.dir.cos < -0.3) A.oppose++; A.vT.push(r.dir.v); A.ecart.push(r.dir.ecart); A.tech[r.tech] = (A.tech[r.tech] ?? 0) + 1; } pend.splice(k, 1); } }
  }
}
const eq = (x) => (x / matchs / 2).toFixed(1);
for (const [nm, A] of [['RÉCEPTIONS PERDUES dans les 1,5 s', L], ['réceptions gardées', K]]) {
  const N = A.n, tt = Object.entries(A.tech).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k} ${pc(v, N)} %`).join(', ');
  console.log(`${nm} — ${eq(N)} par équipe et par match : défenseur à ${qs(A.d)} m, fermeture ${qs(A.ferme)} m/s ; première touche VERS lui ${pc(A.vers, N)} %, à l'opposé ${pc(A.oppose, N)} % ; vitesse du ballon à 0,1 s ${qs(A.vT)} m/s, écart pied-ballon ${qs(A.ecart)} m ; techniques : ${tt}`);
}
