// LES FACE-À-FACE DU DUEL (sans navigateur, moteur STARTER) — « faire tenter plus de gestes dans les face-à-face » : un FACE-À-FACE est un
// épisode où le porteur de champ a le ballon au pied (≤ 0,7 m), sans geste en cours, avec le défenseur de champ DEVANT lui (relèvement
// ≤ 55° dans son regard) à 1,1-3,5 m. Pour chaque épisode (≥ 0,2 s) : son issue — un GESTE tenté (lequel), un tir, le défenseur dépassé
// sans geste (il finit derrière), la balle perdue, ou l'épisode qui s'éteint (le défenseur sort du cône, le porteur recule) — et, image par
// image, les refus nommés des gestes (st.deny) pendant l'épisode. Usage : node face-a-face.mjs [graines=8] [secondes=120] [cle=JSON …]
import { makeDuel, duelCfg } from '../../assets/starter/src/engine/duel-1v1.js';
import { matchStep } from '../../assets/starter/src/engine/match-sim.js';
const [NG = '8', SECS = '120', ...KV] = process.argv.slice(2);
const over = Object.fromEntries(KV.map((s) => { const i = s.indexOf('='); return [s.slice(0, i), JSON.parse(s.slice(i + 1))]; }));
const q = (xs, f) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(f * (s.length - 1))] : NaN; };
const brg = (c, p) => { const a = Math.atan2(p[2] - c.p[2], p[0] - c.p[0]) - c.yaw; return Math.abs(((a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI) * 180 / Math.PI; };
const R = { portes: {}, ep: 0, issues: {}, gestes: {}, dur: [], dist: [], v: [], refus: {}, tMin: 0 };
for (let seed = 1; seed <= Number(NG); seed++) {
  const base = duelCfg(), cfg = duelCfg({ ...over, ...(over.dribble1c1 ? { dribble1c1: { ...base.dribble1c1, ...over.dribble1c1 } } : {}) }), st = makeDuel({ seed }), dt = 1 / 60;
  let ne = 0, ep = null;
  const clore = (issue) => { if (ep && st.t - ep.t0 >= 0.2) { R.ep++; R.issues[issue] = (R.issues[issue] ?? 0) + 1; R.dur.push(st.t - ep.t0); R.dist.push(ep.d0); R.v.push(ep.v0); for (const [k, v] of Object.entries(ep.refus)) R.refus[k] = (R.refus[k] ?? 0) + v; for (const [k, v] of Object.entries(ep.portes)) R.portes[k] = (R.portes[k] ?? 0) + v; } ep = null; };
  for (let i = 0; i < Number(SECS) * 60; i++) {
    const deny0 = { ...(st.deny ?? {}) };
    matchStep(st, dt, cfg);
    const evs = []; while (ne < st.events.length) evs.push(st.events[ne++]);
    const car = st.players[st.possession?.carrier ?? -1];
    if (ep) {   // les refus nommés pendant l'épisode (les compteurs de st.deny qui montent à cette image)
      for (const [k, v] of Object.entries(st.deny ?? {})) if (v > (deny0[k] ?? 0) && /feinte|passement|crochet|double|croqueta|rateau|roulette|semelle|geste|petit|sans-issue|hors-carr/.test(k)) ep.refus[k] = (ep.refus[k] ?? 0) + (v - (deny0[k] ?? 0));
      const g = evs.find((e) => e.type === 'skill' || (e.type === 'windup' && e.skill)); if (g && g.by === ep.by) { R.gestes[g.skill ?? g.kind] = (R.gestes[g.skill ?? g.kind] ?? 0) + 1; clore('GESTE'); continue; }
      if (evs.some((e) => e.type === 'shot' && e.by === ep.by)) { clore('tir'); continue; }
      if (!car || car.id !== ep.by || st.phase !== 'carry') { clore('balle-perdue'); continue; }
      const def = st.players.find((p) => p.team !== car.team && !p.keeper), dd = Math.hypot(def.p[0] - car.p[0], def.p[2] - car.p[2]), b = brg(car, def.p);
      if (b > 100) { clore('dépassé-sans-geste'); continue; }
      // la raison de l'extinction, et image par image les portes de la feinte de corps (allure, ballon, distance, cône, délai)
      if (b > 55 || dd > 3.5 || dd < 0.6 || car.act) { clore('éteint:' + (car.act ? 'acte-' + (car.act.payload?.kind ?? car.act.id) : dd < 0.6 ? 'au-contact' : dd > 3.5 ? 'distance' : 'hors-cône')); continue; }
      const P = (k) => { ep.portes[k] = (ep.portes[k] ?? 0) + 1; };
      if (car.speed < (cfg.dribble1c1?.feinteV ?? 1.4)) P('allure<feinteV'); else if (Math.hypot(st.ball.p[0] - car.p[0], st.ball.p[2] - car.p[2]) > 0.7) P('ballon>0,7'); else if (dd < 1.1 || dd > 3.0) P('distance-hors-1,1-3'); else if ((car._skillCd?.feinteCorps ?? -1) > st.t) P('délai-feinte'); else P('fenêtre-OUVERTE');
      continue;
    }
    if (!car || car.keeper || st.phase !== 'carry' || st.restart || car.act) continue;
    if (Math.hypot(st.ball.p[0] - car.p[0], st.ball.p[2] - car.p[2]) > 0.7) continue;
    const def = st.players.find((p) => p.team !== car.team && !p.keeper); if (!def || def.down > 0) continue;
    const dd = Math.hypot(def.p[0] - car.p[0], def.p[2] - car.p[2]);
    if (dd >= 1.1 && dd <= 3.5 && brg(car, def.p) <= 55) ep = { by: car.id, t0: st.t, d0: dd, v0: car.speed, refus: {}, portes: {} };
  }
  R.tMin += Number(SECS) / 60;
}
const pc = (n) => (100 * n / Math.max(1, R.ep)).toFixed(0) + ' %';
console.log(`${R.ep} face-à-face (${(R.ep / R.tMin).toFixed(1)}/min) — durée ${q(R.dur, 0.5).toFixed(2)} [${q(R.dur, 0.1).toFixed(2)}–${q(R.dur, 0.9).toFixed(2)}] s, défenseur à ${q(R.dist, 0.5).toFixed(1)} m au début, porteur à ${q(R.v, 0.5).toFixed(1)} m/s`);
console.log(`  issues : ${Object.entries(R.issues).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pc(v)}`).join(', ')}`);
console.log(`  gestes tentés : ${Object.entries(R.gestes).map(([k, v]) => `${k} ${v}`).join(', ') || '—'}`);
console.log(`  refus nommés pendant les face-à-face : ${Object.entries(R.refus).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${k} ${v}`).join(', ') || '—'}`);
{ const T = Object.values(R.portes).reduce((a, b) => a + b, 0); console.log(`  portes de la feinte de corps (images de face-à-face) : ${Object.entries(R.portes).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(100 * v / Math.max(1, T)).toFixed(0)} %`).join(', ')}`); }
