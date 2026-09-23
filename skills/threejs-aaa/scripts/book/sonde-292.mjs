// sonde 292 — L'ÉCHAPPÉE DE CONDUITE (sonde 289e au monde du 291 : ~43 passages conduite → libre SANS geste par équipe et par match,
// l'écart pied-ballon p50 2,1 m — le plafond du lot 37 : un porteur en course dont le ballon est DEVANT perd l'étiquette à 2,2 m ;
// ~22 de ces ballons repris par l'adversaire). À chaque échappée : l'écart, le ballon devant / derrière, la vitesse du porteur et celle
// du ballon (le ballon le distance-t-il ?), le porteur ralentit-il (vitesse 0,5 s avant), depuis quand la dernière touche, son
// intention (passe adoptée), son geste en cours ; le défenseur le plus proche du BALLON et son avance sur le porteur ; puis l'issue
// (gardé par l'équipe / repris par l'adversaire / sorti) et, s'il est repris, par qui : le défenseur qui était déjà le plus près ?
import { makeMatch, matchStep, matchCfg } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/match-sim.js';
const seeds = (process.argv[2] ?? '3,7').split(',').map(Number), over = JSON.parse(process.argv[3] ?? '{}'), DUR = +(process.argv[4] ?? 2700);
const hyp = Math.hypot, pc = (a, b) => (b ? (100 * a / b).toFixed(1) : '—'), q = (a, x) => { a = [...a].sort((u, v) => u - v); return a.length ? a[Math.min(a.length - 1, Math.floor(x * a.length))] : NaN; };
const qs = (a) => [0.25, 0.5, 0.75].map((x) => q(a, x).toFixed(2)).join('/');
const O = { matchs: 0, n: 0, devant: 0, ecart: [], vC: [], vB: [], vC05: [], ralentit: 0, depuisTouche: [], intent: 0, geste: 0, foeBall: [], foeAvance: [], foeProche: 0,
  issue: { garde: 0, perdu: 0, sortie: 0 }, perduParProche: 0, perduFoeBall: [], gardeFoeBall: [], perduVB: [], gardeVB: [] };
for (const seed of seeds) {
  const st = makeMatch({ full: true, seed }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: DUR, pause: 10 }, ...over }); O.matchs++;
  let seen = 0, phase0 = st.phase; const hist = {}, lastTouch = {}; const pend = [];
  for (let i = 0; i < DUR * 60 * 2.4; i++) {
    const c0 = st.possession.carrier >= 0 ? st.players[st.possession.carrier] : null;
    const snap = c0 && st.phase === 'carry' ? { id: c0.id, team: c0.team, p: [...c0.p], v: [...c0.v], intent: !!c0.intent, act: !!c0.act } : null;
    const nEv = st.events.length;
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break;
    for (const P of st.players) { (hist[P.id] ??= []).push({ t: st.t, v: hyp(P.v[0], P.v[1]) }); if (hist[P.id].length > 40) hist[P.id].shift(); }
    const evs = st.events.slice(nEv);
    for (const e of evs) if (e.type === 'touche' && e.by != null) lastTouch[e.by] = st.t;
    const geste = evs.some((e) => ['tacle-pique', 'slide', 'control', 'pass', 'shot', 'faute', 'chute'].includes(e.type) || e.type.startsWith('duel') || e.type.startsWith('tête'));
    if (snap && st.phase === 'loose' && phase0 === 'carry' && !st.restart && !geste) {
      const c = st.players[snap.id], b = st.ball, bx = b.p[0] - c.p[0], bz = b.p[2] - c.p[2], ec = hyp(bx, bz), vc = hyp(c.v[0], c.v[1]), vb = hyp(b.v[0], b.v[2]);
      const devant = vc > 0.5 && (bx * c.v[0] + bz * c.v[1]) > 0; const h = hist[c.id], v05 = h.length > 30 ? h[h.length - 31].v : vc;
      let fb = 99, fid = -1; for (const P of st.players) if (P.team !== c.team && P.down <= 0) { const d = hyp(P.p[0] - b.p[0], P.p[2] - b.p[2]); if (d < fb) { fb = d; fid = P.id; } }
      O.n++; if (devant) O.devant++; O.ecart.push(ec); O.vC.push(vc); O.vB.push(vb); O.vC05.push(v05); if (vc < v05 - 0.5) O.ralentit++;
      O.depuisTouche.push(lastTouch[c.id] != null ? st.t - lastTouch[c.id] : 9); if (snap.intent) O.intent++; if (snap.act) O.geste++;
      O.foeBall.push(fb); O.foeAvance.push(ec - fb); if (fb < ec) O.foeProche++;
      pend.push({ t: st.t, team: c.team, fid, fb, vb });
    }
    for (; seen < st.events.length; seen++) { const e = st.events[seen];
      for (let k = pend.length - 1; k >= 0; k--) { const p = pend[k];
        if ((e.type === 'loose-kept' || e.type === 'control' || e.type === 'receive') && e.by != null) {
          const P = st.players[e.by]; if (P.team === p.team) { O.issue.garde++; O.gardeFoeBall.push(p.fb); O.gardeVB.push(p.vb); } else { O.issue.perdu++; O.perduFoeBall.push(p.fb); O.perduVB.push(p.vb); if (e.by === p.fid) O.perduParProche++; }
          pend.splice(k, 1); }
        else if (e.type === 'turnover' && e.why === 'récupération') { O.issue.perdu++; O.perduFoeBall.push(p.fb); O.perduVB.push(p.vb); if (e.by === p.fid) O.perduParProche++; pend.splice(k, 1); } } }
    for (let k = pend.length - 1; k >= 0; k--) if (st.restart) { O.issue.sortie++; pend.splice(k, 1); } else if (st.t - pend[k].t > 4) pend.splice(k, 1);
    phase0 = st.phase;
  }
}
const n = O.matchs, N = O.n, eq = (x) => (x / n / 2).toFixed(1);
console.log(`${n} matchs de 2 × ${(DUR / 60).toFixed(0)} min ${JSON.stringify(over)} — ${eq(N)} échappées de conduite sans geste par équipe et par match ; ballon DEVANT le porteur en course ${pc(O.devant, N)} %`);
console.log(`  écart pied-ballon p25/p50/p75 ${qs(O.ecart)} m ; vitesse du porteur ${qs(O.vC)} m/s (0,5 s avant ${qs(O.vC05)}) — il RALENTIT (≥ 0,5 m/s) ${pc(O.ralentit, N)} % ; vitesse du ballon ${qs(O.vB)} m/s`);
console.log(`  dernière touche il y a ${qs(O.depuisTouche)} s ; intention de passe adoptée ${pc(O.intent, N)} % ; un geste en cours ${pc(O.geste, N)} %`);
console.log(`  défenseur le plus proche du BALLON ${qs(O.foeBall)} m ; plus près que le porteur ${pc(O.foeProche, N)} % ; avance sur le porteur ${qs(O.foeAvance)} m`);
const I = O.issue, T = I.garde + I.perdu + I.sortie;
console.log(`  ISSUE : gardé ${pc(I.garde, T)} % (${eq(I.garde)}/éq.), repris par l'adversaire ${pc(I.perdu, T)} % (${eq(I.perdu)}/éq.) — par le défenseur déjà le plus proche ${pc(O.perduParProche, I.perdu)} % —, sorti ${pc(I.sortie, T)} %`);
console.log(`  défenseur-ballon à l'échappée : perdus ${qs(O.perduFoeBall)} m, gardés ${qs(O.gardeFoeBall)} m ; vitesse du ballon : perdus ${qs(O.perduVB)}, gardés ${qs(O.gardeVB)} m/s`);
