// sonde 290 — LA TOUCHE DE CONDUITE SOUS PRESSION (le 289 a nommé : ~50 pertes par équipe et par match sur des piques et des touches qui
// s'échappent vers un défenseur, le ballon à 1,0-1,25 m du pied au pique). Pour chaque touche de conduite : la pression lue au temps
// d'arrivée (P, presse-lue.js), la vitesse du porteur et du ballon poussé, l'écart pied-ballon MAXIMAL avant la touche suivante, et
// l'issue dans la fenêtre (touche suivante, passe, tir, pique adverse, perte) — par bande de P.
import { makeMatch, matchStep, matchCfg } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/match-sim.js';
import { presseLueDe } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/presse-lue.js';
import { tac } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/tactics.js';
const seeds = (process.argv[2] ?? '3,7').split(',').map(Number), over = JSON.parse(process.argv[3] ?? '{}'), DUR = +(process.argv[4] ?? 2700);
const hyp = Math.hypot, pc = (a, b) => (b ? (100 * a / b).toFixed(1) : '—'), q = (a, x) => { a = [...a].sort((u, v) => u - v); return a.length ? a[Math.min(a.length - 1, Math.floor(x * a.length))] : NaN; };
const B = ['P < 0,3', '0,3-0,55', '0,55-0,75', '≥ 0,75'], mk = () => ({ n: 0, ecart: [], spd: [], vit: [], pique: 0, perte: 0, passe: 0 });
const O = { matchs: 0, b: B.map(mk), touches: 0 };
for (const seed of seeds) {
  const st = makeMatch({ full: true, seed }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: DUR, pause: 10 }, ...over }); O.matchs++;
  const K = matchCfg({}).presseLue; let seen = 0, cur = null;
  const ferme = (res) => { if (!cur) return; const g = O.b[cur.bi]; g.n++; g.ecart.push(cur.ecart); g.spd.push(cur.spd); g.vit.push(cur.vit); if (res === 'pique') g.pique++; if (res === 'perte' || res === 'pique') g.perte++; if (res === 'passe') g.passe++; cur = null; };
  for (let i = 0; i < DUR * 60 * 2.4; i++) {
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break;
    if (cur) { const c = st.players[cur.by]; cur.ecart = Math.max(cur.ecart, hyp(st.ball.p[0] - c.p[0], st.ball.p[2] - c.p[2])); if (st.t - cur.t > 1.5) ferme('fenêtre'); }
    for (; seen < st.events.length; seen++) { const e = st.events[seen];
      if (cur && e.type === 'tacle-pique' && e.sur === cur.by) { ferme('pique'); continue; }
      if (cur && e.type === 'turnover' && st.players[cur.by]?.team !== e.equipe) { ferme('perte'); continue; }
      if (cur && (e.type === 'pass' || e.type === 'shot') && e.by === cur.by) { ferme('passe'); continue; }
      if (e.type === 'touche' && e.by != null && st.players[e.by] && st.possession.carrier === e.by) { ferme('touche'); const c = st.players[e.by]; if (c.keeper) continue;
        const P = presseLueDe(st, c, K, cfg, tac(st, c.team).tempo).P; O.touches++;
        cur = { by: e.by, t: st.t, bi: P < 0.3 ? 0 : P < 0.55 ? 1 : P < 0.75 ? 2 : 3, ecart: hyp(st.ball.p[0] - c.p[0], st.ball.p[2] - c.p[2]), spd: e.spd ?? hyp(st.ball.v[0], st.ball.v[2]), vit: c.speed ?? hyp(c.v[0], c.v[1]) }; }
    }
  }
}
const n = O.matchs;
console.log(`${n} matchs ${JSON.stringify(over)} — ${O.touches} touches de conduite (${(O.touches / n / 2).toFixed(0)} par équipe et par match)`);
for (let k = 0; k < 4; k++) { const g = O.b[k]; console.log(`  ${B[k]} : ${g.n} touches (${(g.n / n / 2).toFixed(0)}/éq.) ; écart pied-ballon max p50 ${q(g.ecart, 0.5).toFixed(2)} m p90 ${q(g.ecart, 0.9).toFixed(2)} ; ballon poussé p50 ${q(g.spd, 0.5).toFixed(1)} m/s, porteur ${q(g.vit, 0.5).toFixed(1)} m/s ; suivie d'un PIQUE ${pc(g.pique, g.n)} %, d'une PERTE ${pc(g.perte, g.n)} % (${(g.perte / n / 2).toFixed(0)}/éq.), d'une passe/tir ${pc(g.passe, g.n)} %`); }
