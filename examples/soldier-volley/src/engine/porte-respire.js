// porte-respire.js — LE PORTÉ RESPIRE (324, cfg.porteRespire && st.full — l'atelier conduite & contrôle, note 448).
// Mesuré (atelier ?atelier=conduite, sonde-conduite) : 36-50 % du temps de conduite, le ballon est PORTÉ (servo ball-body : il converge vers
// le point du pied, footPoint — un point FIXE devant le corps) : l'intention de passe formée, le rassemblement. Il glisse alors avec le corps
// sans une touche pendant que les jambes courent — le « ballon soudé » que l'œil lit immédiatement (retour utilisateur : « les joueurs ne sont
// pas amis avec le ballon »). Ici, en course (≥ vMin m/s), le point du servo RESPIRE au rythme de la foulée : à chaque cycle de période
// T = periode × (2 − gesteF) s (le technicien touche plus souvent), une TOUCHE s'inscrit (le rendu joue le pied) et le point avance de A m
// (A = amp × min(1, espace / 4) × dribbleLeadF — serré sous pression, plus long lancé seul, le mauvais dribbleur pousse plus loin) puis
// revient au pied sur le reste du cycle. Le servo reste la loi (une vitesse, jamais une position — ball-body). Absente : le point fixe d'hier.
import { hyp } from './hyp.js';
import { strideLaw } from './gait.js';

/** Le point du servo qui respire, et la touche du cycle (rend { pt, touche }). */
export function respireDe(st, c, K, pt, espace = 99) {
  if (!K || c.speed < (K.vMin ?? 1.5)) { c._resp = null; return { pt, touche: false }; }
  // (329, K.foulee) LA RESPIRATION AU PAS — la référence (Football Manager, extrait « soliste » regardé au 1/15 s) : le ballon vit SERRÉ (0,3-0,5 m devant le pied
  // qui joue, décalé de son côté), touché à chaque cycle de foulée du MÊME pied ; la période est celle de la foulée (gait.strideLaw — la loi que le rendu anime),
  // l'amplitude courte, le ballon décalé vers le pied fort (cote m) : l'autre pied ne se pose jamais dessus. Absente : la période fixe d'hier.
  const F = K.foulee, T = F ? 1 / Math.max(0.6, strideLaw(c.speed)) : (K.periode ?? 0.7) * (2 - (c.skill?.gesteF ?? 1)) * (c.speed >= (K.vSprint ?? 5) ? (K.sprintF ?? 1.4) : 1);
  let touche = false;
  if (!c._resp || st.t - c._resp.t0 >= c._resp.T) { c._resp = { t0: st.t, T }; touche = true; }
  const ph = (st.t - c._resp.t0) / c._resp.T, mont = K.montee ?? 0.3;
  const f = ph < mont ? ph / mont : 1 - (ph - mont) / (1 - mont);
  const A = (F ? F.amp ?? 0.25 : K.amp ?? 0.6) * Math.min(1, espace / 4) * (c.skill?.dribbleLeadF ?? 1) * (c.speed >= (K.vSprint ?? 5) ? (F ? F.sprintA ?? 1.3 : K.sprintA ?? 1.8) : 1);
  const v = hyp(c.v[0], c.v[1]) || 1, ux = c.v[0] / v, uz = c.v[1] / v;
  const sd = F && c.strongFoot && c.strongFoot !== 'both' ? (c.strongFoot === 'left' ? 1 : -1) * (F.cote ?? 0.06) : 0;   // à gauche du sens de course : (uz, −ux) — la convention de footPoint
  const bx = pt[0], bz = pt[1];
  return { pt: [bx + ux * A * f + uz * sd, bz + uz * A * f - ux * sd], touche };
}
