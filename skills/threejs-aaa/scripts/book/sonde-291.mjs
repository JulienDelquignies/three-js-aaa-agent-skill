// sonde 291 — L'ANATOMIE DE LA PIQUE (le 290 a réfuté la conduite serrée : les piqués tombent sur des touches prises avant le
// presseur ; le levier nommé est la pique elle-même, Modèle 11 § 4). Chaque TENTATIVE de pique (réussie : l'événement 'tacle-pique' ;
// manquée : le cooldown court q._pokeCd = t + 0,9 posé à l'image) : le relèvement du ballon depuis le buste du piqueur (le book : le
// pied balaie un cône de ± 55° DEVANT le buste), l'approche (angle entre la vitesse du piqueur et celle du porteur : > 120° = de
// dos), la distance pied-ballon, l'avance sur le porteur ; et l'ISSUE à 2 s des piques réussies (récupérée par l'équipe du piqueur,
// gardée par l'équipe du porteur, sortie, libre) contre le tableau du book § 4.2 (tacle debout : récupération 21 %, déviation neutre
// 29 %, battu 49 % des tentatives).
import { makeMatch, matchStep, matchCfg } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/match-sim.js';
const seeds = (process.argv[2] ?? '3,7,11,13').split(',').map(Number), over = JSON.parse(process.argv[3] ?? '{}'), DUR = +(process.argv[4] ?? 2700);
const hyp = Math.hypot, pc = (a, b) => (b ? (100 * a / b).toFixed(1) : '—'), q = (a, x) => { a = [...a].sort((u, v) => u - v); return a.length ? a[Math.min(a.length - 1, Math.floor(x * a.length))] : NaN; };
const rel = (yaw, px, pz, bx, bz) => { const a = Math.atan2(bz - pz, bx - px) - yaw; return Math.abs(((a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI) * 180 / Math.PI; };
const O = { matchs: 0, tent: 0, reus: 0, rate: 0, relR: [], relM: [], horsCone: 0, horsConeR: 0, dos: 0, dosR: 0, dist: [], avance: [], issue: { recup: 0, garde: 0, sortie: 0, libre: 0 }, parCone: { in: { r: 0, recup: 0 }, out: { r: 0, recup: 0 } }, pertes: 0 };
for (const seed of seeds) {
  const st = makeMatch({ full: true, seed }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: DUR, pause: 10 }, ...over }); O.matchs++;
  let seen = 0; const pend = []; let snap = null;
  for (let i = 0; i < DUR * 60 * 2.4; i++) {
    const c0 = st.possession.carrier >= 0 && st.phase === 'carry' ? st.players[st.possession.carrier] : null;
    snap = c0 ? { c: { id: c0.id, p: [...c0.p], v: [...c0.v], team: c0.team }, b: [...st.ball.p], q: st.players.map((x) => ({ yaw: x.yaw, p: [...x.p], v: [...x.v], cd: x._pokeCd ?? -1 })) } : null;
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break;
    const tentative = (qi, reussie) => { if (!snap) return; const x = snap.q[qi], P = st.players[qi], c = snap.c;
      const r = rel(x.yaw, x.p[0], x.p[2], snap.b[0], snap.b[2]), vq = hyp(x.v[0], x.v[2]), vc = hyp(c.v[0], c.v[2]);
      const dos = vq > 1 && vc > 1 && Math.acos(Math.max(-1, Math.min(1, (x.v[0] * c.v[0] + x.v[2] * c.v[2]) / (vq * vc)))) * 180 / Math.PI < 60;   // même sens que le porteur = il le suit, arrive de DOS
      O.tent++; (reussie ? O.relR : O.relM).push(r); if (r > 55) { O.horsCone++; if (reussie) O.horsConeR++; } if (dos) { O.dos++; if (reussie) O.dosR++; }
      const dq = hyp(x.p[0] - snap.b[0], x.p[2] - snap.b[2]), dc = hyp(c.p[0] - snap.b[0], c.p[2] - snap.b[2]); O.dist.push(dq); O.avance.push(dc - dq);
      if (reussie) { O.reus++; pend.push({ t: st.t, team: P.team, cone: r <= 55 ? 'in' : 'out' }); } else O.rate++; };
    for (; seen < st.events.length; seen++) { const e = st.events[seen]; if (e.type === 'tacle-pique') tentative(e.by, true); }
    if (snap) for (let k = 0; k < st.players.length; k++) { const P = st.players[k]; if (P.team === snap.c.team) continue; const cd = P._pokeCd ?? -1;
      if (cd !== snap.q[k].cd && Math.abs(cd - (st.t + 0.9)) < 0.02) tentative(k, false); }
    for (let k = pend.length - 1; k >= 0; k--) { const p = pend[k]; if (st.t - p.t < 2) continue;
      const is = st.restart ? 'sortie' : st.possession.carrier >= 0 ? (st.possession.team === p.team ? 'recup' : 'garde') : 'libre';
      O.issue[is]++; O.parCone[p.cone].r++; if (is === 'recup') O.parCone[p.cone].recup++; pend.splice(k, 1); }
  }
}
const n = O.matchs, t = O.tent, eq = (x) => (x / n / 2).toFixed(1);
console.log(`${n} matchs de 2 × ${(DUR / 60).toFixed(0)} min ${JSON.stringify(over)} — ${eq(t)} tentatives de pique par équipe et par match : réussies ${eq(O.reus)} (${pc(O.reus, t)} %), manquées ${eq(O.rate)}`);
console.log(`  relèvement du ballon depuis le buste du piqueur : réussies p25/p50/p75/p90 ${[0.25, 0.5, 0.75, 0.9].map((x) => q(O.relR, x).toFixed(0)).join('/')}° ; manquées ${[0.25, 0.5, 0.75, 0.9].map((x) => q(O.relM, x).toFixed(0)).join('/')}°`);
console.log(`  HORS du cône ± 55° (le pied ne balaie pas là) : ${pc(O.horsCone, t)} % des tentatives, ${pc(O.horsConeR, O.reus)} % des réussies ; de DOS (le piqueur suit le porteur) : ${pc(O.dos, t)} % des tentatives, ${pc(O.dosR, O.reus)} % des réussies`);
console.log(`  pied-ballon p50 ${q(O.dist, 0.5).toFixed(2)} m (p90 ${q(O.dist, 0.9).toFixed(2)}) ; avance sur le porteur p50 ${q(O.avance, 0.5).toFixed(2)} m`);
const I = O.issue, R = O.reus;
console.log(`  ISSUE à 2 s des réussies : récupérée ${pc(I.recup, R)} %, gardée par le porteur ${pc(I.garde, R)} %, sortie ${pc(I.sortie, R)} %, libre ${pc(I.libre, R)} % ; récupérée dans le cône ${pc(O.parCone.in.recup, O.parCone.in.r)} %, hors cône ${pc(O.parCone.out.recup, O.parCone.out.r)} %`);
console.log(`  EN TENTATIVES (le book § 4.2, tacle debout : récupération 21 %, déviation neutre 29 %, battu 49 %) : récupération ${pc(I.recup, t)} %, neutre ${pc(I.garde + I.sortie + I.libre, t)} %, battu (manqué) ${pc(O.rate, t)} %`);
