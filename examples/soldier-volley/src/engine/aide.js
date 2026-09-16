// aide.js — LE RELEVÉ AIDÉ (lot A10 quater, cfg.sol.aide) : quand le jeu est arrêté (un coup franc posé, ou le ballon loin), un
// coéquipier du fauché vient se poster à côté de lui pendant qu'il est au sol et lui TEND LA MAIN au moment du relevé — le geste
// 'mainTendue' (motion-emotion, le haut du corps : le buste se penche, le bras se tend devant, bas). Le fauteur ne vient pas, le
// porteur ni le preneur non plus, un gardien pas davantage ; un seul aidant par fauché, un fauché par aidant. Les événements :
// 'aide' { by, pour, d } quand l'aidant est élu, 'windup' (skill 'aide', move 'mainTendue') quand la main se tend. Le corps du
// fauché se relève comme hier (motion-contact, à l'heure de la sim) : la main est un CORPS DE PLUS, pas une physique. Clé absente :
// le relevé solitaire d'hier, au bit.
import { hyp } from './hyp.js';
import { startGesture } from './gesture.js';
import { MOVE_TIMING } from './skills-sim.js';

export function aideStep(st, dt, cfg) {
  const A = st.full && cfg.sol?.aide; if (!A) return;
  for (const f of st.players) {
    const auSol = f.down > 0 && f.down < 100 && !f.expulse && !f._sub && !!f._chute;
    if (!auSol) { if (f._aide) { const h = st.players[f._aide.by]; if (h && h._aidant === f.id) h._aidant = null; f._aide = null; } continue; }
    const arret = !!st.restart || hyp(st.ball.p[0] - f.p[0], st.ball.p[2] - f.p[2]) > (A.loin ?? 15);   // le jeu est arrêté, ou loin
    if (!f._aide) {
      if (!arret || f.down < (A.avant ?? 0.7) + 0.3) continue;                                        // trop tard pour venir
      let best = null, bd = A.rayon ?? 10;
      for (const h of st.players) {
        if (h.team !== f.team || h === f || h.keeper || h.down > 0 || h.act || h._aidant != null || h.id === st.possession.carrier || h.id === st.restart?.taker || h.id === f._chute.by) continue;
        const d = hyp(h.p[0] - f.p[0], h.p[2] - f.p[2]); if (d < bd && d / (A.trot ?? 3.5) < f.down - (A.avant ?? 0.7) + 0.4) { bd = d; best = h; }   // il doit pouvoir arriver avant le relevé (trot m/s)
      }
      if (!best) continue;
      f._aide = { by: best.id, t: st.t, geste: false }; best._aidant = f.id;
      st.events.push({ t: +st.t.toFixed(2), type: 'aide', by: best.id, pour: f.id, d: +bd.toFixed(2) });
    }
    const h = st.players[f._aide.by];
    if (!h || h.down > 0 || h._aidant !== f.id) { f._aide = null; continue; }
    // l'aidant vient se poster à dist m du fauché, du côté d'où il vient (hors du corps couché : cfg.sol.corps), face à lui
    const dx = h.p[0] - f.p[0], dz = h.p[2] - f.p[2], L = hyp(dx, dz) || 1, dist = A.dist ?? 1.0;
    if (!h.act) { h.job = L > dist + 1.5 ? 'receive' : 'walk'; h.target = [f.p[0] + dx / L * dist, 0, f.p[2] + dz / L * dist]; h.intent = null; }   // il trotte de loin, marche les derniers pas
    h.yawWant = Math.atan2(f.p[2] - h.p[2], f.p[0] - h.p[0]);
    // la main se tend quand le relevé approche et qu'il est là
    if (!f._aide.geste && f.down <= (A.avant ?? 0.7) && L < dist + 0.5 && !h.act) {
      const mv = MOVE_TIMING.mainTendue || { duration: 1.4, contact: 0.5 };
      startGesture(h, { id: 'mainTendue', ...mv }, { payload: { kind: 'aide', pour: f.id, ownsBody: true }, log: st.gestures });
      st.events.push({ t: +st.t.toFixed(2), type: 'windup', by: h.id, move: 'mainTendue', skill: 'aide', anticipation: mv.contact });
      f._aide.geste = true;
    }
  }
}
