// sonde 296 (lot 295) — LE PORTEUR QUI PERD EN CONDUISANT (sonde-295 : les pertes en jeu au sens du book sont justes sur la passe et le
// take-on ; l'excès ~30 par équipe est chez le porteur qui conduit — conduite 25, pique subie 14-18, charge subie 3-4 ≈ 45 c. ~15 ;
// la possession individuelle 1,08 s c. 2,14). À chaque perte d'un porteur EN CONDUITE (le changement de possession dans la seconde qui
// suit une image où il portait, sans passe ni tir entre les deux) : dans la seconde d'avant — le porteur COURAIT-IL VERS le défenseur
// le plus proche (cos(vitesse, direction du défenseur) > 0,5 : il conduit dans le presseur), à quelle vitesse, le défenseur était-il
// DEVANT (entre lui et le but visé), de FLANC ou DERRIÈRE, à quelle distance ; le bouclier (A10 ter) était-il actif ; une INTENTION de
// passe adoptée ; depuis combien de temps il tenait ; où (tiers). Et, pour comparaison, les mêmes grandeurs sur toutes les images de
// conduite avec un défenseur à moins de 3 m (le porteur pressé qui ne perd pas).
import { makeMatch, matchStep, matchCfg } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/match-sim.js';
const seeds = (process.argv[2] ?? '3,7').split(',').map(Number), over = JSON.parse(process.argv[3] ?? '{}'), DUR = +(process.argv[4] ?? 2700);
const hyp = Math.hypot, pc = (a, b) => (b ? (100 * a / b).toFixed(1) : '—'), q = (a, x) => { a = [...a].sort((u, v) => u - v); return a.length ? a[Math.min(a.length - 1, Math.floor(x * a.length))] : NaN; };
const qs = (a) => [0.25, 0.5, 0.75].map((x) => q(a, x).toFixed(2)).join('/');
const mk = () => ({ n: 0, vers: 0, v: [], devant: 0, flanc: 0, derriere: 0, d: [], bouclier: 0, intent: 0, tenue: [], tiers: [0, 0, 0] });
const P = mk(), R = mk(); let matchs = 0;
const obs = (A, f) => { A.n++; if (f.vers) A.vers++; A.v.push(f.v); A[f.cote]++; A.d.push(f.d); if (f.bouclier) A.bouclier++; if (f.intent) A.intent++; A.tenue.push(f.tenue); A.tiers[f.tiers]++; };
for (const seed of seeds) {
  const st = makeMatch({ full: true, seed }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: DUR, pause: 10 }, ...over }); matchs++;
  let seen = 0; const H = [];
  for (let i = 0; i < DUR * 60 * 2.4; i++) {
    const c = st.possession.carrier >= 0 && st.phase === 'carry' && !st.restart ? st.players[st.possession.carrier] : null;
    if (c && !c.keeper) {
      let D = null, dm = 99; for (const Q of st.players) if (Q.team !== c.team && !Q.keeper && Q.down <= 0) { const d = hyp(Q.p[0] - c.p[0], Q.p[2] - c.p[2]); if (d < dm) { dm = d; D = Q; } }
      const vx = c.v[0], vz = c.v[1], v = hyp(vx, vz), dx = D.p[0] - c.p[0], dz = D.p[2] - c.p[2];
      const g = st.pitch.attackGoal(c.team), gx = g.x - c.p[0], gz = -c.p[2], gl = hyp(gx, gz) || 1, cg = (dx * gx + dz * gz) / ((dm || 1) * gl);
      const z = Math.abs(c.p[0] - st.pitch.ownGoal(c.team).x) / (2 * st.pitch.hx);
      const f = { t: st.t, id: c.id, team: c.team, vers: v > 1 && (vx * dx + vz * dz) / (v * (dm || 1)) > 0.5, v, cote: cg > 0.5 ? 'devant' : cg < -0.3 ? 'derriere' : 'flanc', d: dm, bouclier: !!c._bouclier, intent: !!c.intent, tenue: st.hold, tiers: z < 1 / 3 ? 0 : z < 2 / 3 ? 1 : 2 };
      H.push(f); if (dm < 3 && i % 6 === 0) obs(R, f);
    }
    while (H.length && st.t - H[0].t > 1) H.shift();
    const nEv = st.events.length; matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break;
    for (; seen < st.events.length; seen++) { const e = st.events[seen];
      if (e.type === 'pass' || e.type === 'shot') { H.length = 0; continue; }
      if (e.type === 'turnover') { const perd = 1 - e.equipe, h = H.filter((x) => x.team === perd); if (h.length) obs(P, h[Math.max(0, h.length - 30)]); H.length = 0; } }
  }
}
const eq = (x) => (x / matchs / 2).toFixed(1);
for (const [nm, A] of [['PERTES EN CONDUITE (0,5 s avant)', P], ['porteur pressé à < 3 m, toutes images', R]]) {
  const N = A.n;
  console.log(`${nm} — ${nm.startsWith('P') ? eq(N) + ' par équipe et par match' : N + ' images'} : conduit VERS le défenseur ${pc(A.vers, N)} % ; vitesse ${qs(A.v)} m/s ; défenseur devant ${pc(A.devant, N)} %, de flanc ${pc(A.flanc, N)} %, derrière ${pc(A.derriere, N)} %, à ${qs(A.d)} m ; bouclier actif ${pc(A.bouclier, N)} % ; intention de passe ${pc(A.intent, N)} % ; tenait depuis ${qs(A.tenue)} s ; tiers déf./médian/off. ${A.tiers.map((x) => pc(x, N)).join('/')} %`);
}
