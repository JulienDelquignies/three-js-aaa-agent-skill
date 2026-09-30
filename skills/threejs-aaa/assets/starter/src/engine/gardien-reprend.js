// gardien-reprend.js — LE GARDIEN N'EST PAS FIGÉ PAR SA RELANCE (cfg.gkReprise && st.full — registre des règles irréalistes, lot 359 :
// « le gardien ne peut pas réagir pendant l'accompagnement de sa relance »). Mesuré (diag-A, seed 11 t=684.93) : la volée du gardien
// repartait sur un attaquant, revenait vers le but — le gardien restait 0,35 s dans l'accompagnement de son geste (match-sim : busy(gk)
// → continue), ne plongeait pas, et c'était but. Le réel : l'accompagnement d'une frappe n'enchaîne pas le corps — le pied se repose et
// le gardien réagit au ballon qui revient. Ici : après le contact (fired), hors plongeon, un ballon qui revient VERS son but (cos ≥ cos,
// vitesse ≥ vMin m/s, à ≤ portee m du but) interrompt le geste — cause nommée « reprise ». Clé absente : l'hier au bit.
import { abortGesture } from './gesture.js';
import { hyp } from './hyp.js';

/** Interrompt l'accompagnement du gardien si le ballon revient sur son but ; true quand il est rendu à lui-même. */
export function gardienReprend(st, gk, cfg) {
  const K = st.full && cfg.gkReprise; const a = gk.act; if (!K || !a || !a.fired || a.payload?.skill === 'plongeon' || a.payload?.ownsBody) return false;
  const g = st.pitch.ownGoal(gk.team), b = st.ball.p, v = st.ball.v, sp = hyp(v[0], v[2]); if (sp < (K.vMin ?? 3)) return false;
  const dx = g.x - b[0], dz = -b[2], d = hyp(dx, dz) || 1; if (d > (K.portee ?? 35)) return false;
  if ((v[0] * dx + v[2] * dz) / (sp * d) < (K.cos ?? 0.6)) return false;
  abortGesture(gk, 'reprise', { log: st.gestures });
  st.events.push({ t: +st.t.toFixed(2), type: 'gk-reprise', by: gk.id, v: +sp.toFixed(1) });
  return true;
}
