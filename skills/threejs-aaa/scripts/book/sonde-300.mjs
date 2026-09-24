// sonde 300 — LA PASSE OU LE RECEVEUR ? (la question du 24/09 : « ça veut plutôt dire que la passe n'est pas assez bonne ? ou que le
// destinataire se déplace mal ? » — le balayage 421 : la portée de prise gouverne la continuité ; le ballon à 0,9-1,4 m d'un joueur
// qui ne le prend pas). Pour chaque PASSE de jeu vers un receveur désigné : l'approche la plus proche du ballon (au sol, < 1 m de haut)
// et, à cet instant, l'écart BALLON → POINT VISÉ (la mène, st.pass.lead : l'erreur du PASSEUR) et l'écart RECEVEUR → POINT VISÉ
// (l'erreur du RECEVEUR) ; l'issue (prise par lui, par un coéquipier, par l'adversaire, libre). Les passes « frôlées » (approche
// 0,85-1,4 m sans prise) sont décomposées : qui des deux était loin du point ? Et hors passes : les ballons LIBRES qui passent à
// 0,85-1,4 m d'un joueur de l'équipe qui les a perdus sans qu'il les prenne (le rebond, le contrôle qui file).
import { makeMatch, matchStep, matchCfg } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/match-sim.js';
const seeds = (process.argv[2] ?? '3').split(',').map(Number), over = JSON.parse(process.argv[3] ?? '{}'), DUR = +(process.argv[4] ?? 2700);
const hyp = Math.hypot, pc = (a, b) => (b ? (100 * a / b).toFixed(1) : '—'), q = (a, x) => { a = [...a].sort((u, v) => u - v); return a.length ? a[Math.min(a.length - 1, Math.floor(x * a.length))] : NaN; };
const qs = (a) => [0.25, 0.5, 0.75].map((x) => q(a, x).toFixed(2)).join('/');
const O = { matchs: 0, passes: 0, issue: {}, approche: [], frole: 0, froleBallLead: [], froleRecLead: [], froleFaute: { passeur: 0, receveur: 0, deux: 0, aucun: 0 }, prisBallLead: [], prisRecLead: [], froleVitesse: [], froleRecV: [], froleCourt: 0, libreFrole: 0 };
for (const seed of seeds) {
  const st = makeMatch({ full: true, seed }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: DUR, pause: 10 }, ...over }); O.matchs++;
  let seen = 0, cur = null;
  const clore = (issue) => { if (!cur) return; O.passes++; O.issue[issue] = (O.issue[issue] ?? 0) + 1; O.approche.push(cur.dMin);
    if (issue === 'receveur') { O.prisBallLead.push(cur.bl); O.prisRecLead.push(cur.rl); }
    else if (cur.dMin > 0.85 && cur.dMin < 1.4) { O.frole++; O.froleBallLead.push(cur.bl); O.froleRecLead.push(cur.rl); O.froleVitesse.push(cur.vb); O.froleRecV.push(cur.vr); if (cur.court) O.froleCourt++;
      const P = cur.bl > 1, R = cur.rl > 1; O.froleFaute[P && R ? 'deux' : P ? 'passeur' : R ? 'receveur' : 'aucun']++; }
    cur = null; };
  for (let i = 0; i < DUR * 60 * 2.4; i++) {
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break;
    if (cur && st.pass && st.pass.to === cur.to && st.ball.p[1] < 1) { const r = st.players[cur.to], d = hyp(st.ball.p[0] - r.p[0], st.ball.p[2] - r.p[2]);
      if (d < cur.dMin) { const L = st.pass.lead ?? cur.lead; cur.dMin = d; cur.bl = hyp(st.ball.p[0] - L[0], st.ball.p[2] - L[2]); cur.rl = hyp(r.p[0] - L[0], r.p[2] - L[2]); cur.vb = hyp(st.ball.v[0], st.ball.v[2]); cur.vr = hyp(r.v[0], r.v[1]);
        // la passe COURTE du point : le ballon s'arrête avant le point visé (plus près du passeur que la mène)
        cur.court = hyp(st.ball.p[0] - cur.o[0], st.ball.p[2] - cur.o[2]) < hyp(L[0] - cur.o[0], L[2] - cur.o[2]) - 1; } }
    for (; seen < st.events.length; seen++) { const e = st.events[seen], p = e.by != null ? st.players[e.by] : null;
      if (e.type === 'pass' && !e.clear && !e.mains && e.to >= 0 && p && !p.keeper) { clore('remplacée'); cur = { to: e.to, team: p.team, t: st.t, dMin: 99, bl: NaN, rl: NaN, lead: st.pass?.lead ?? [0, 0, 0], o: [p.p[0], p.p[1], p.p[2]] }; continue; }
      if (!cur) continue;
      if ((e.type === 'control' || e.type === 'receive' || e.type === 'loose-kept') && p) clore(e.by === cur.to ? 'receveur' : p.team === cur.team ? 'coéquipier' : 'adversaire');
      else if (e.type === 'turnover') clore('adversaire'); else if (e.type === 'restart-pris' || e.type === 'shot') clore('arrêt'); }
    if (cur && st.t - cur.t > 6) clore('libre > 6 s');
  }
}
const n = O.matchs, N = O.passes, eq = (x) => (x / n / 2).toFixed(1), F = O.frole;
console.log(`${n} match(s) de 2 × ${(DUR / 60).toFixed(0)} min ${JSON.stringify(over)} — ${eq(N)} passes par équipe ; issue : ${Object.entries(O.issue).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pc(v, N)} %`).join(', ')}`);
console.log(`  approche la plus proche ballon → receveur p25/p50/p75 ${qs(O.approche)} m ; PRISES par le receveur : ballon → point visé ${qs(O.prisBallLead)} m, receveur → point visé ${qs(O.prisRecLead)} m`);
console.log(`  FRÔLÉES (0,85-1,4 m, pas prises par lui) : ${eq(F)} par équipe (${pc(F, N)} % des passes) — ballon → point visé ${qs(O.froleBallLead)} m, receveur → point visé ${qs(O.froleRecLead)} m ; la faute (> 1 m du point) : PASSEUR ${pc(O.froleFaute.passeur, F)} %, RECEVEUR ${pc(O.froleFaute.receveur, F)} %, les deux ${pc(O.froleFaute.deux, F)} %, aucun ${pc(O.froleFaute.aucun, F)} % ; passe COURTE du point ${pc(O.froleCourt, F)} % ; ballon à ${qs(O.froleVitesse)} m/s, receveur à ${qs(O.froleRecV)} m/s`);
