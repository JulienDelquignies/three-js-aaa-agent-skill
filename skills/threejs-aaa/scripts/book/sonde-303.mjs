// sonde 303 — LE TABLEAU DE LA BASE DU JEU (25/09 : « la priorité c'est de régler les passes, les contrôles, les réceptions, les
// séquences — sans ça la base du jeu est cassée » ; douze leviers locaux se sont compensés, la calibration devient CONJOINTE). En un
// passage, par équipe et par match : les passes de jeu, la complétion (première touche d'un coéquipier), les POSSESSIONS au sens Opta
// (l'effleurement adverse < 2 s sans passe ne coupe pas ; les suites de la même équipe fusionnées) et leurs passes, les PERTES au
// sens du book (le changement en jeu dont l'équipe qui perd a agi dans les 6 s, hors tir et dégagement), les ballons longs (≥ 32 m),
// la une-touche (frappée < 0,35 s après la prise), les contrôles, les MANQUÉS (miss) et parmi eux les CONTESTÉS perdus, les tirs.
// Dernière ligne : un JSON pour le chercheur (book/calibre.mjs). Cibles (Référentiel 02, Modèle 09) : passes 420-475, complétion
// 82,5 ± 1,5, passes par possession 3,5-4,5, pertes 110-140, longs 45-50, une-touche 15-25, contrôle manqué 2-4 %.
import { makeMatch, matchStep, matchCfg } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/match-sim.js';
const seeds = (process.argv[2] ?? '3').split(',').map(Number), over = JSON.parse(process.argv[3] ?? '{}'), DUR = +(process.argv[4] ?? 2700);
const hyp = Math.hypot;
const T = { matchs: 0, passes: 0, ok: 0, n: 0, poss: 0, possP: 0, pertes: 0, longs: 0, un: 0, ctrl: 0, miss: 0, cont: 0, tirs: 0 };
for (const seed of seeds) {
  const st = makeMatch({ full: true, seed }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: DUR, pause: 10 }, ...over }); T.matchs++;
  let seen = 0, pend = null, seq = null; const last = [null, null], pris = {}, S = [];
  const fin = () => { if (seq) { S.push({ ...seq, d: st.t - seq.t0 }); seq = null; } };
  const debut = (team, restart) => { if (seq && seq.team === team) return; fin(); seq = { team, t0: st.t, p: 0, restart }; };
  for (let i = 0; i < DUR * 60 * 2.4; i++) {
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break;
    for (; seen < st.events.length; seen++) { const e = st.events[seen], p = e.by != null ? st.players[e.by] : null, tm = p?.team;
      const note = (t, k) => { if (t === 0 || t === 1) last[t] = { k, t: st.t }; };
      if (e.type === 'restart-pris' && p) { fin(); seq = { team: tm, t0: st.t, p: 0, restart: true }; continue; }
      if (e.type === 'shot') { T.tirs++; note(tm, 'tir'); fin(); continue; }
      if (e.type === 'turnover') { const perd = 1 - e.equipe, L = last[perd]; if (L && st.t - L.t < 6 && L.k !== 'tir' && L.k !== 'dégagement') T.pertes++; if (pend) { T.n++; pend = null; } debut(e.equipe, false); continue; }
      if ((e.type === 'control' || e.type === 'receive' || e.type === 'loose-kept') && p && !p.keeper) { note(tm, 'contrôle'); pris[p.id] = st.t;
        if (e.type === 'control' && !st.restart) { T.ctrl++; if (e.miss) { T.miss++; if (e.issue === 'conteste-perdu') T.cont++; } }
        if (pend && p.team === pend.team) { T.n++; T.ok++; pend = null; } if (!seq) debut(tm, false); continue; }
      if (e.type === 'pass' && p) { note(tm, e.clear ? 'dégagement' : 'passe');
        if (!e.clear && !e.mains && e.to >= 0 && !p.keeper) { T.passes++; if (seq && seq.team === tm) seq.p++; if (pend) { T.n++; if (p.team === pend.team) T.ok++; } pend = { team: tm, t: st.t };
          const r = st.players[e.to]; if (r && hyp(r.p[0] - p.p[0], r.p[2] - p.p[2]) >= 32) T.longs++; if (pris[p.id] != null && st.t - pris[p.id] < 0.35) T.un++; } continue; }
      if (e.type === 'touche') note(tm, 'conduite'); }
    if (pend && st.t - pend.t > 6) pend = null;
  }
  fin();
  const M = []; for (let k = 0; k < S.length; k++) { const s2 = S[k], prev = M[M.length - 1], nx = S[k + 1];
    if (prev && s2.p === 0 && s2.d < 2 && nx && nx.team === prev.team && s2.team !== prev.team) { prev.p += nx.p; k++; continue; }
    if (prev && s2.team === prev.team && !s2.restart) { prev.p += s2.p; continue; } M.push({ ...s2 }); }
  T.poss += M.length; T.possP += M.reduce((a, s2) => a + s2.p, 0);
}
const e2 = (x) => x / T.matchs / 2;
const R = { passes: e2(T.passes), completion: 100 * T.ok / Math.max(1, T.n), passesParPossession: T.possP / Math.max(1, T.poss), possessions: e2(T.poss), pertes: e2(T.pertes), longs: e2(T.longs), uneTouche: e2(T.un), manquesPct: 100 * T.miss / Math.max(1, T.ctrl), contestesPerdus: e2(T.cont), tirs: T.tirs / T.matchs };
console.log(`${T.matchs} match(s) ${JSON.stringify(over)} — passes ${R.passes.toFixed(0)} (420-475), complétion ${R.completion.toFixed(1)} % (82,5), passes par possession ${R.passesParPossession.toFixed(2)} (3,5-4,5) sur ${R.possessions.toFixed(0)} possessions, pertes ${R.pertes.toFixed(0)} (110-140), longs ${R.longs.toFixed(0)} (45-50), une-touche ${R.uneTouche.toFixed(0)} (15-25), contrôles manqués ${R.manquesPct.toFixed(1)} % (2-4) dont contestés perdus ${R.contestesPerdus.toFixed(0)}, tirs ${R.tirs.toFixed(0)} par match`);
console.log('JSON ' + JSON.stringify(R));
