// LA ROULETTE EN COURSE, SA FENÊTRE (sans navigateur, moteur STARTER) — 0 roulette en course sur 40 graines × 120 s de duel : pourquoi ?
// À chaque image où le porteur de champ a le ballon, les portes de maybeRoulette (skills-sim) une à une — lancé (≥ rouletteV), ballon au pied
// (≤ 0,6 m), un adversaire à rouletteFoe m qui FERME (≥ rouletteClosing m/s) dans la diagonale-dos (bearing rouletteBear) — et, quand toutes
// passent, la probabilité du tirage (dribM × (0,032 + 0,1 flair) × gesteF³ × (2 − getupF)). Par porte : la part des images où elle bloque
// quand les autres passeraient (le goulot) ; et chaque roulette en course RÉALISÉE (cfg.skill.rouletteCourse) : le verdict du noyau au contact,
// à +2 s le ballon gardé ou perdu, le poursuivant laissé derrière (> 1 m en arrière du porteur sur le cap de sortie). Usage : node roulette-fenetre.mjs [graines=16] [s=120]
import { makeDuel, duelCfg } from '../../assets/starter/src/engine/duel-1v1.js';
import { matchStep } from '../../assets/starter/src/engine/match-sim.js';
import { situation } from '../../assets/starter/src/engine/technique.js';
import { dribM } from '../../assets/starter/src/engine/skills-sim.js';
const [NG = '16', SECS = '120'] = process.argv.slice(2); const R = [];
const G = { v: 0, ballon: 0, adv: 0, ferme: 0, dos: 0, face: 0, occupe: 0 }, seul = { v: 0, ballon: 0, adv: 0, ferme: 0, dos: 0 }; let img = 0, ouvertes = 0, pSum = 0, ep = 0; const bear = [], clos = [], vit = [];
for (let seed = 1; seed <= Number(NG); seed++) {
  const st = makeDuel({ seed }), cfg = duelCfg(), K = cfg.skill; let prevOpen = false, ne = 0;
  for (let i = 0; i < Number(SECS) * 60; i++) {
    matchStep(st, 1 / 60, cfg);
    while (ne < st.events.length) { const e = st.events[ne++]; if (e.type === 'skill' && e.kind === 'rouletteCourse') { const p = st.players[e.by]; R.push({ seed, t: st.t, by: e.by, foe: p.act?.payload?.foeId, yaw: p.yaw, issue: null, suite: null }); }
      if (e.type === 'duel' && e.geste === 'rouletteCourse' && R.length) R[R.length - 1].issue = e.issue; }
    for (const o of R) if (o.seed === seed && o.suite == null && st.t - o.t >= 2) { const c = st.players[o.by], q = st.players[o.foe], car = st.players[st.possession?.carrier ?? -1];
      o.suite = car && car.team !== c.team ? 'perdu' : car?.id === c.id || (car && car.team === c.team) ? (q && ((q.p[0] - c.p[0]) * Math.cos(o.yaw) + (q.p[2] - c.p[2]) * Math.sin(o.yaw)) < -1 ? 'gardé, poursuivant derrière' : 'gardé') : 'libre/autre'; }
    const c = st.players[st.possession?.carrier ?? -1]; if (!c || c.keeper || st.phase !== 'carry' || st.restart) { prevOpen = false; continue; }
    img++;
    const t = { occupe: !!c.act, face: !!(c._face || c._faceApp?.go), v: c.speed < (K.rouletteV ?? 1.5), ballon: Math.hypot(c.p[0] - st.ball.p[0], c.p[2] - st.ball.p[2]) > 0.6 };
    let best = null;
    for (const q of st.players) { if (q.team === c.team || q.down > 0) continue; const d = Math.hypot(q.p[0] - c.p[0], q.p[2] - c.p[2]); if (d < K.rouletteFoe[0] || d > K.rouletteFoe[1]) continue;
      const closing = ((c.p[0] - q.p[0]) * q.v[0] + (c.p[2] - q.p[2]) * q.v[1]) / Math.max(1e-4, d), b = situation(c.p, c.yaw, q.p, [0, 0], 0.11).bearing;
      const s = (closing >= (K.rouletteClosing ?? 0.8) ? 1 : 0) + (b >= K.rouletteBear[0] && b <= K.rouletteBear[1] ? 1 : 0); if (!best || s > best.s) best = { s, closing, b }; }
    t.adv = !best; t.ferme = !!best && best.closing < (K.rouletteClosing ?? 0.8); t.dos = !!best && !(best.b >= K.rouletteBear[0] && best.b <= K.rouletteBear[1]);
    if (best) { bear.push(best.b); clos.push(best.closing); vit.push(c.speed); }
    for (const k of Object.keys(G)) if (t[k]) G[k]++;
    const bloque = Object.entries(t).filter(([, v]) => v).map(([k]) => k); if (bloque.length === 1 && seul[bloque[0]] != null) seul[bloque[0]]++;
    const open = bloque.length === 0; if (open) { ouvertes++; const p = dribM(st, c, cfg) * ((0.032 + 0.1 * (c.persona?.flair ?? 0.5)) * ((c.skill?.gesteF ?? 1) ** 3) * (2 - (c.skill?.getupF ?? 1))); pSum += p; (globalThis.DM ??= []).push(dribM(st, c, cfg)); (globalThis.FL ??= []).push((0.032 + 0.1 * (c.persona?.flair ?? 0.5)) * ((c.skill?.gesteF ?? 1) ** 3) * (2 - (c.skill?.getupF ?? 1))); (globalThis.CAD ??= []).push(st.t - (c._dribAt ?? -99)); if (!prevOpen) ep++; } prevOpen = open;
  }
}
const pc = (a) => (100 * a / Math.max(1, img)).toFixed(1) + ' %', q = (xs, f) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(f * (s.length - 1))] : NaN; };
console.log(`${img} images de porteur de champ ; fenêtre OUVERTE (toutes les portes) : ${ouvertes} images, ${ep} épisodes — probabilité moyenne du tirage par image décidée ${(pSum / Math.max(1, ouvertes)).toFixed(3)}`);
console.log(`  bloque (toutes causes) : ${Object.entries(G).map(([k, v]) => `${k} ${pc(v)}`).join(', ')}`);
console.log(`  SEULE porte fermée (le goulot) : ${Object.entries(seul).map(([k, v]) => `${k} ${v}`).join(', ')}`);
console.log(`  adversaire à portée : bearing ${q(bear, 0.1).toFixed(0)}/${q(bear, 0.5).toFixed(0)}/${q(bear, 0.9).toFixed(0)}° (porte ${duelCfg().skill.rouletteBear.join('-')}), fermeture ${q(clos, 0.1).toFixed(1)}/${q(clos, 0.5).toFixed(1)}/${q(clos, 0.9).toFixed(1)} m/s, allure du porteur ${q(vit, 0.5).toFixed(1)} m/s`);
{ const D = globalThis.DM ?? [], F = globalThis.FL ?? [], C = globalThis.CAD ?? []; console.log(`  aux fenêtres ouvertes : dribM = 0 dans ${(100 * D.filter((x) => x === 0).length / Math.max(1, D.length)).toFixed(0)} % (sinon p50 ${q(D.filter((x) => x > 0), 0.5)?.toFixed(2)}), facteur flair×note ${q(F, 0.5).toFixed(3)}, dernier dribble il y a ${q(C, 0.5).toFixed(1)} s (p10 ${q(C, 0.1).toFixed(1)}) — cadence ${JSON.stringify(duelCfg().dribble?.cadence)}`); }
{ const T = {}, I = {}; for (const o of R) { T[o.suite ?? '?'] = (T[o.suite ?? '?'] ?? 0) + 1; I[o.issue ?? '—'] = (I[o.issue ?? '—'] ?? 0) + 1; }
  console.log(`ROULETTES EN COURSE réalisées : ${R.length} (${(R.length / (Number(NG) * Number(SECS) / 60)).toFixed(2)}/min, ${(100 * R.length / Math.max(1, ep)).toFixed(1)} % des fenêtres) — noyau au contact : ${Object.entries(I).map(([k, v]) => `${k} ${v}`).join(', ')} ; à +2 s : ${Object.entries(T).map(([k, v]) => `${k} ${v}`).join(', ')}`); }
