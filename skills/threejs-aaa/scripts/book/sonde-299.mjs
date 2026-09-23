// sonde 299 — LE PORTEUR QUI PERD AVAIT-IL UNE PASSE ? (la demande « augmenter les passes par séquence » ; sonde-298 : ~203 séquences
// par équipe, 1,86-2,06 passe, finies surtout par une passe ratée ~54 — le volume réel —, la conduite ~29, le take-on ~18, le contrôle
// ~17, la pique ~12). Une passe OUVERTE : un coéquipier de champ à 5-45 m, aucun défenseur à moins de 1,5 m du segment porteur →
// coéquipier, aucun défenseur à moins de 3 m de lui. Comptées dans la demi-seconde d'avant chaque PERTE SANS PASSE (changement de
// possession sans passe ni tir depuis la prise) et, pour comparaison, au moment de chaque PASSE jouée. Si le porteur qui perd avait
// des passes ouvertes, c'est sa DÉCISION (il garde, conduit, tente) ; sinon c'est le SOUTIEN (personne ne s'offre).
import { makeMatch, matchStep, matchCfg } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/match-sim.js';
const seeds = (process.argv[2] ?? '3').split(',').map(Number), over = JSON.parse(process.argv[3] ?? '{}'), DUR = +(process.argv[4] ?? 2700);
const hyp = Math.hypot, pc = (a, b) => (b ? (100 * a / b).toFixed(1) : '—'), q = (a, x) => { a = [...a].sort((u, v) => u - v); return a.length ? a[Math.min(a.length - 1, Math.floor(x * a.length))] : NaN; };
const ouvertes = (st, c) => { let n = 0, nAv = 0; const foes = st.players.filter((Q) => Q.team !== c.team && Q.down <= 0 && !Q.keeper), sg = Math.sign(st.pitch.attackGoal(c.team).x || 1);
  for (const m of st.players) { if (m.team !== c.team || m.id === c.id || m.keeper || m.down > 0) continue;
    const dx = m.p[0] - c.p[0], dz = m.p[2] - c.p[2], d = hyp(dx, dz); if (d < 5 || d > 45) continue;
    let ok = true; for (const Q of foes) { if (hyp(Q.p[0] - m.p[0], Q.p[2] - m.p[2]) < 3) { ok = false; break; }
      const t = Math.max(0, Math.min(1, ((Q.p[0] - c.p[0]) * dx + (Q.p[2] - c.p[2]) * dz) / (d * d))); if (hyp(c.p[0] + dx * t - Q.p[0], c.p[2] + dz * t - Q.p[2]) < 1.5) { ok = false; break; } }
    if (ok) { n++; if (dx * sg > 0) nAv++; } }
  return { n, nAv }; };
const O = { pertes: [], pertesAv: [], passes: [], passesAv: [], matchs: 0, kinds: {}, deny: {}, denyN: 0, intent: 0, hold: [] };
for (const seed of seeds) {
  const st = makeMatch({ full: true, seed }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: DUR, pause: 10 }, ...over }); O.matchs++;
  let seen = 0; const H = []; let lastAct = [null, null];
  for (let i = 0; i < DUR * 60 * 2.4; i++) {
    const c = st.possession.carrier >= 0 && st.phase === 'carry' && !st.restart ? st.players[st.possession.carrier] : null;
    const d0 = { ...(st.deny ?? {}) };
    if (c && !c.keeper && i % 3 === 0) { const o = ouvertes(st, c); H.push({ t: st.t, team: c.team, ...o, intent: !!c.intent, hold: st.hold, dd: {} }); }
    while (H.length && st.t - H[0].t > 0.5) H.shift();
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break;
    if (H.length) { const L = H[H.length - 1]; for (const k in st.deny ?? {}) { const v = (st.deny[k] ?? 0) - (d0[k] ?? 0); if (v > 0) L.dd[k] = (L.dd[k] ?? 0) + v; } }
    for (; seen < st.events.length; seen++) { const e = st.events[seen], p = e.by != null ? st.players[e.by] : null;
      if (e.type === 'pass' && p && !p.keeper && !e.clear && !e.mains) { const o = ouvertes(st, p); O.passes.push(o.n); O.passesAv.push(o.nAv); lastAct[p.team] = 'passe'; H.length = 0; }
      else if (e.type === 'shot' && p) { lastAct[p.team] = 'tir'; H.length = 0; }
      else if (e.type === 'turnover') { const perd = 1 - e.equipe, h = H.filter((x) => x.team === perd);
        if (h.length) { const o = h[0]; O.pertes.push(o.n); O.pertesAv.push(o.nAv); if (o.n >= 3) { O.denyN++; if (h.some((x) => x.intent)) O.intent++; O.hold.push(h[h.length - 1].hold); for (const x of h) for (const k in x.dd) O.deny[k] = (O.deny[k] ?? 0) + x.dd[k]; } } H.length = 0; } }
  }
}
const n = O.matchs, P = O.pertes, eq = (x) => (x / n / 2).toFixed(1);
const dist = (a) => [0, 1, 2, 3].map((k) => `${k === 3 ? '3+' : k} ${pc(a.filter((x) => (k === 3 ? x >= 3 : x === k)).length, a.length)} %`).join(', ');
console.log(`${n} match(s) de 2 × ${(DUR / 60).toFixed(0)} min ${JSON.stringify(over)} — ${eq(P.length)} pertes sans passe par équipe`);
console.log(`  PASSES OUVERTES 0,5 s avant la perte : ${dist(P)} ; p50 ${q(P, 0.5)} ; dont VERS L'AVANT ${dist(O.pertesAv)}`);
console.log(`  au moment d'une PASSE jouée : ${dist(O.passes)} ; p50 ${q(O.passes, 0.5)} ; vers l'avant ${dist(O.passesAv)}`);
console.log(`  PERTES AVEC ≥ 3 PASSES OUVERTES (${O.denyN}) : une intention de passe adoptée dans la demi-seconde ${pc(O.intent, O.denyN)} % ; tenue au moment de la perte p25/p50/p75 ${[0.25, 0.5, 0.75].map((x) => q(O.hold, x).toFixed(2)).join('/')} s ; refus nommés (cumul) : ${Object.entries(O.deny).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => `${k} ${v}`).join(', ')}`);
