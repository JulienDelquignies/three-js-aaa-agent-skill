// OÙ LE RENDEZ-VOUS SE TROMPE (sans navigateur, moteur STARTER) : à la POSE du pied du rendez-vous (sa fin de vol), trois distances au point
// visé par la touche (d.rdv.cible) — le BALLON (le modèle de roulement), le PIED réel (cou-de-pied du générateur, le modèle du corps : allure,
// virage, couloir × 1,25), et le ballon au pied (le raté). Par allure et par lacet. Usage : node rdv-erreur.mjs [graines=8] [secondes=120]
import { makeDuel, duelCfg } from '../../assets/starter/src/engine/duel-1v1.js';
import { matchStep } from '../../assets/starter/src/engine/match-sim.js';
import { pasPositions } from '../../assets/starter/src/engine/pas.js';
const [NG = '8', SECS = '120'] = process.argv.slice(2);
const q = (xs, f) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(f * (s.length - 1))] : NaN; };
const L = [], E = [];
for (let seed = 1; seed <= Number(NG); seed++) {
  const st = makeDuel({ seed }), cfg = duelCfg(), dt = 1 / 60; let suivi = null;
  for (let i = 0; i < Number(SECS) * 60; i++) {
    matchStep(st, dt, cfg);
    const car = st.possession?.carrier ?? -1, c = st.players[car], d = st._drb;
    if (d?.rdv?.cible && (!suivi || suivi.r !== d.rdv)) suivi = { r: d.rdv, by: car, v0: c?.speed ?? 0, lac0: Math.abs(c?._pas?.yawRate ?? 0), t0: st.t, due: st.t + (d.rdv.t - d.horloge), ne0: st.events.length };
    if (suivi && (st.possession.carrier !== suivi.by || st.t - suivi.t0 > 1.5)) suivi = null;
    // À L'ÉCHÉANCE EXACTE, sans autre touche entre-temps : le ballon contre la cible (le roulement), le corps contre le corps prédit (l'allure, le virage)
    if (suivi && !suivi.lu && st.t >= suivi.due) { suivi.lu = true; const touche = st.events.slice(suivi.ne0).some((e) => e.type === 'touche' || e.type === 'tacle-pique' || e.type === 'grille');
      if (c && !touche && !c.act) E.push({ ballon: Math.hypot(st.ball.p[0] - suivi.r.cible[0], st.ball.p[2] - suivi.r.cible[1]), corps: Math.hypot(c.p[0] - suivi.r.corps[0], c.p[2] - suivi.r.corps[1]), v: suivi.v0, dtv: c.speed - suivi.v0, lac: suivi.lac0,
        // le corps prédit : dans l'axe (avance/retard) et de côté
        av: ((c.p[0] - suivi.r.corps[0]) * Math.cos(c.yaw) + (c.p[2] - suivi.r.corps[1]) * Math.sin(c.yaw)), bav: ((st.ball.p[0] - suivi.r.cible[0]) * Math.cos(c.yaw) + (st.ball.p[2] - suivi.r.cible[1]) * Math.sin(c.yaw)) }); }
    if (suivi && st.t >= suivi.due - 0.1 && c?._pas?.evt?.[suivi.r.pied] === 'fin') {   // la pose VISÉE (pas une pose plus tôt du même pied)
      const P = pasPositions(c), f = P[suivi.r.pied], fx = Math.cos(c.yaw), fz = Math.sin(c.yaw), a = (f.ch[0] + f.or[0]) / 2, dd = (f.ch[1] + f.or[1]) / 2;
      const pied = [c.p[0] + fx * a - fz * dd, c.p[2] + fz * a + fx * dd], ci = suivi.r.cible, b = [st.ball.p[0], st.ball.p[2]], h = (u, w) => Math.hypot(u[0] - w[0], u[1] - w[1]);
      L.push({ ballon: h(b, ci), pied: h(pied, ci), rate: h(b, pied), v: suivi.v0, lac: suivi.lac0, dtv: c.speed - suivi.v0, act: !!c.act, t: st.t - suivi.t0, retard: st.t - suivi.due });
      suivi = null;
    }
  }
}
const m = (X, f) => `${q(X.map(f), 0.5).toFixed(2)} [${q(X.map(f), 0.1).toFixed(2)}–${q(X.map(f), 0.9).toFixed(2)}]`;
const X = L.filter((x) => !x.act);
console.log(`${X.length} rendez-vous lus à la pose de leur pied : ballon au point visé ${m(X, (x) => x.ballon)} m ; PIED au point visé ${m(X, (x) => x.pied)} m ; ballon au pied ${m(X, (x) => x.rate)} m (${X.filter((x) => x.rate <= 0.4).length}/${X.length} ≤ 0,4 m) ; échéance ${m(X, (x) => x.t)} s, pose − échéance ${m(X, (x) => x.retard)} s`);
for (const [nom, F] of [['< 2,5 m/s', (x) => x.v < 2.5], ['2,5-4 m/s', (x) => x.v >= 2.5 && x.v < 4], ['≥ 4 m/s', (x) => x.v >= 4], ['lacet ≥ 1,5 rad/s', (x) => x.lac >= 1.5], ['allure changée > 0,8 m/s', (x) => Math.abs(x.dtv) > 0.8]]) {
  const Y = X.filter(F); if (Y.length < 5) continue; console.log(`  ${nom.padEnd(24)} (${Y.length}) : ballon ${m(Y, (x) => x.ballon)} ; pied ${m(Y, (x) => x.pied)} ; raté ${m(Y, (x) => x.rate)}`); }
console.log(`À L'ÉCHÉANCE, sans autre touche (${E.length}) : ballon à la cible ${m(E, (x) => x.ballon)} m (dans l'axe ${m(E, (x) => x.bav)}) ; corps au corps prédit ${m(E, (x) => x.corps)} m (dans l'axe ${m(E, (x) => x.av)} : + = en avance)`);
for (const [nom, F] of [['allure changée > 0,8 m/s', (x) => Math.abs(x.dtv) > 0.8], ['allure stable', (x) => Math.abs(x.dtv) <= 0.3], ['lacet ≥ 1,5 rad/s', (x) => x.lac >= 1.5]]) { const Y = E.filter(F); if (Y.length >= 5) console.log(`  ${nom.padEnd(24)} (${Y.length}) : ballon ${m(Y, (x) => x.ballon)} ; corps ${m(Y, (x) => x.corps)} (axe ${m(Y, (x) => x.av)})`); }
