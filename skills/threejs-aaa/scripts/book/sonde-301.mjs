// sonde 301 — L'ANATOMIE DU BALLON LIBRE (sonde-300 : le gain du grand rayon de prise ne vient pas des passes — 3-4 % frôlées — mais des
// ballons LIBRES ; 147-151 passages au libre par équipe et par match, sonde-289e). À chaque passage au ballon libre en jeu : l'équipe
// qui l'avait, l'origine (le dernier événement), et pour CHAQUE équipe le joueur de champ qui l'atteint le PREMIER — le temps d'atteinte
// sur la trajectoire prédite (roulement ~1,2 m/s² + traînée, sous 1 m de haut) à la pointe de course (6,4 m/s × topF, départ lancé
// depuis sa vitesse) ; puis QUI le prend (l'équipe, le joueur prévu ou un autre), en combien de temps. Quand l'équipe qui avait
// l'AVANTAGE (le plus court temps d'atteinte) le perd : ce que faisait son joueur le plus prompt (son job, court-il VERS le ballon ?
// sa vitesse), les refus nommés du moment (controle-dos, …), et l'avance qu'il avait.
import { makeMatch, matchStep, matchCfg } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/match-sim.js';
const seeds = (process.argv[2] ?? '3').split(',').map(Number), over = JSON.parse(process.argv[3] ?? '{}'), DUR = +(process.argv[4] ?? 2700);
const hyp = Math.hypot, pc = (a, b) => (b ? (100 * a / b).toFixed(1) : '—'), q = (a, x) => { a = [...a].sort((u, v) => u - v); return a.length ? a[Math.min(a.length - 1, Math.floor(x * a.length))] : NaN; };
const qs = (a) => [0.25, 0.5, 0.75].map((x) => q(a, x).toFixed(2)).join('/');
// le temps d'atteinte : le premier t où le joueur (pointe vmax, parti de sa vitesse, accélération 4 m/s²) est à ≤ 0,85 m du ballon prédit
const atteinte = (P, b, vmax) => { let bx = b.p[0], bz = b.p[2], vx = b.v[0], vz = b.v[2]; const v0 = hyp(P.v[0], P.v[1]);
  for (let t = 0; t <= 4; t += 0.05) { const sp = hyp(vx, vz); if (sp > 0.01) { const dec = Math.min(sp, (1.2 + 0.013 * sp * sp) * 0.05); vx -= (vx / sp) * dec; vz -= (vz / sp) * dec; } bx += vx * 0.05; bz += vz * 0.05;
    const tA = Math.max(0, (vmax - v0) / 4), dRun = t <= tA ? v0 * t + 2 * t * t : v0 * tA + 2 * tA * tA + vmax * (t - tA);
    if (hyp(bx - P.p[0], bz - P.p[2]) - 0.85 <= dRun) return t; }
  return 9; };
const O = { matchs: 0, n: 0, orig: {}, gagneParAvance: 0, perduAvecAvance: 0, egal: 0, avance: [], perdusJob: {}, perdusVers: 0, perdusV: [], perdusDeny: {}, perdusAvance: [], prisParPrevu: 0, tPrise: [], perdusOrig: {} };
for (const seed of seeds) {
  const st = makeMatch({ full: true, seed }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: DUR, pause: 10 }, ...over }); O.matchs++;
  let seen = 0, ph0 = st.phase, cur = null, lastEv = null, team0 = st.possession.team;
  for (let i = 0; i < DUR * 60 * 2.4; i++) {
    const d0 = { ...(st.deny ?? {}) };
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break;
    const dd = {}; for (const k in st.deny ?? {}) { const v = (st.deny[k] ?? 0) - (d0[k] ?? 0); if (v > 0) dd[k] = v; }
    let prise = null;
    for (; seen < st.events.length; seen++) { const e = st.events[seen]; if (!['moment', 'window', 'burst', 'geste', 'skill-end'].includes(e.type)) lastEv = e.type + (e.kind ? ':' + e.kind : '');
      if (cur && (e.type === 'control' || e.type === 'receive' || e.type === 'loose-kept') && e.by != null) prise = e.by; }
    if (cur) { for (const k in dd) cur.deny[k] = (cur.deny[k] ?? 0) + dd[k];
      if (prise != null || st.restart || st.phase === 'flight' || st.t - cur.t > 6) { const P = prise != null ? st.players[prise] : null;
        if (P) { O.n++; O.tPrise.push(st.t - cur.t); const av = cur.best[cur.av]; const gagne = P.team === cur.av;
          if (P.id === av.id) O.prisParPrevu++;
          if (Math.abs(cur.best[0].t - cur.best[1].t) < 0.1) O.egal++;
          else if (gagne) O.gagneParAvance++;
          else { O.perduAvecAvance++; O.perdusJob[cur.job] = (O.perdusJob[cur.job] ?? 0) + 1; if (cur.vers) O.perdusVers++; O.perdusV.push(cur.v); O.perdusAvance.push(cur.best[1 - cur.av].t - cur.best[cur.av].t);
            O.perdusOrig[cur.o] = (O.perdusOrig[cur.o] ?? 0) + 1; for (const k in cur.deny) O.perdusDeny[k] = (O.perdusDeny[k] ?? 0) + cur.deny[k]; } }
        cur = null; } }
    if (!cur && st.phase === 'loose' && ph0 !== 'loose' && !st.restart) {
      const best = [0, 1].map((tm) => { let b = { t: 9, id: -1 }; for (const P of st.players) { if (P.team !== tm || P.keeper || P.down > 0) continue; const t = atteinte(P, st.ball, 6.4 * (P.skill?.topF ?? 1)); if (t < b.t) b = { t, id: P.id }; } return b; });
      const av = best[0].t <= best[1].t ? 0 : 1, A = st.players[best[av].id]; if (!A) { ph0 = st.phase; continue; } const bx = st.ball.p[0] - A.p[0], bz = st.ball.p[2] - A.p[2], vA = hyp(A.v[0], A.v[1]);
      const o = (ph0 === 'carry' ? 'conduite' : ph0 === 'flight' ? 'vol' : ph0) + ' → ' + (lastEv ?? '?'); O.orig[o] = (O.orig[o] ?? 0) + 1;
      cur = { t: st.t, best, av, job: A.job, v: vA, vers: vA > 1 && (A.v[0] * bx + A.v[1] * bz) / (vA * (hyp(bx, bz) || 1)) > 0.7, deny: {}, o, eqAvant: team0 };
    }
    ph0 = st.phase; if (st.possession.team >= 0) team0 = st.possession.team;
  }
}
const n = O.matchs, N = O.n, eq = (x) => (x / n / 2).toFixed(1), L = O.perduAvecAvance;
console.log(`${n} match(s) de 2 × ${(DUR / 60).toFixed(0)} min ${JSON.stringify(over)} — ${eq(N)} ballons libres PRIS par équipe et par match, en ${qs(O.tPrise)} s ; pris par le joueur prévu (le plus prompt de l'équipe qui avait l'avantage) ${pc(O.prisParPrevu, N)} %`);
console.log(`  l'équipe qui avait l'AVANTAGE (temps d'atteinte) le prend ${pc(O.gagneParAvance, N)} % ; le PERD ${pc(L, N)} % (${eq(L)} par équipe) ; à égalité (< 0,1 s) ${pc(O.egal, N)} %`);
console.log(`  PERDUS AVEC L'AVANTAGE : avance ${qs(O.perdusAvance)} s ; le plus prompt courait VERS le ballon ${pc(O.perdusVers, L)} %, à ${qs(O.perdusV)} m/s ; son job : ${Object.entries(O.perdusJob).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pc(v, L)} %`).join(', ')}`);
console.log(`  …leurs origines : ${Object.entries(O.perdusOrig).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k} ${eq(v)}`).join(' ; ')}`);
console.log(`  …les refus nommés pendant qu'ils étaient libres : ${Object.entries(O.perdusDeny).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => `${k} ${v}`).join(', ')}`);
