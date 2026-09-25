// porte-respire.js — LE PORTÉ RESPIRE (324, cfg.porteRespire && st.full — l'atelier conduite & contrôle, note 448).
// Mesuré (atelier ?atelier=conduite, sonde-conduite) : 36-50 % du temps de conduite, le ballon est PORTÉ (servo ball-body : il converge vers
// le point du pied, footPoint — un point FIXE devant le corps) : l'intention de passe formée, le rassemblement. Il glisse alors avec le corps
// sans une touche pendant que les jambes courent — le « ballon soudé » que l'œil lit immédiatement (retour utilisateur : « les joueurs ne sont
// pas amis avec le ballon »). Ici, en course (≥ vMin m/s), le point du servo RESPIRE au rythme de la foulée : à chaque cycle de période
// T = periode × (2 − gesteF) s (le technicien touche plus souvent), une TOUCHE s'inscrit (le rendu joue le pied) et le point avance de A m
// (A = amp × min(1, espace / 4) × dribbleLeadF — serré sous pression, plus long lancé seul, le mauvais dribbleur pousse plus loin) puis
// revient au pied sur le reste du cycle. Le servo reste la loi (une vitesse, jamais une position — ball-body). Absente : le point fixe d'hier.
import { hyp } from './hyp.js';

/** Le point du servo qui respire, et la touche du cycle (rend { pt, touche }). */
export function respireDe(st, c, K, pt, espace = 99) {
  if (!K || c.speed < (K.vMin ?? 1.5)) { c._resp = null; return { pt, touche: false }; }
  const T = (K.periode ?? 0.7) * (2 - (c.skill?.gesteF ?? 1)) * (c.speed >= (K.vSprint ?? 5) ? (K.sprintF ?? 1.4) : 1);
  let touche = false;
  if (!c._resp || st.t - c._resp.t0 >= c._resp.T) { c._resp = { t0: st.t, T }; touche = true; }
  const ph = (st.t - c._resp.t0) / c._resp.T, mont = K.montee ?? 0.3;
  const f = ph < mont ? ph / mont : 1 - (ph - mont) / (1 - mont);
  const A = (K.amp ?? 0.6) * Math.min(1, espace / 4) * (c.skill?.dribbleLeadF ?? 1) * (c.speed >= (K.vSprint ?? 5) ? (K.sprintA ?? 1.8) : 1);
  const v = hyp(c.v[0], c.v[1]) || 1, ux = c.v[0] / v, uz = c.v[1] / v;
  return { pt: [pt[0] + ux * A * f, pt[1] + uz * A * f], touche };
}
