// elan-conduite.js — L'ÉLAN DANS L'ESPACE (312, cfg.elanConduite && st.full — retour du 26/09 : « le même travail pour les passes en
// profondeur » ; filmé à l'atelier ?atelier=prof : le receveur lancé à 6,2 m/s retombait à 3,2 en 0,5 s). Tracé (sonde-312, 77 prises
// à > 4,5 m/s, l'adversaire le plus proche DEVANT à 13 m p50) : la poussée voulue partait à 62° p50 de sa course dès la prise, 80-100°
// ensuite — la direction de conduite mélangeait le but (wGoal) et l'évasion, SANS l'élan : le lancé tournait (et freinait) au lieu de
// continuer. Le vrai joueur lancé dans l'espace garde sa course et l'infléchit. La loi : en course (≥ v m/s), sans adversaire à moins
// de espace m dans le cône avant (60°), la poussée se mélange à la direction de course (poids k, × la marge d'espace), jamais quand
// il court vers son propre but (cos course / attaque < plancher). Pur. Clé absente : la poussée d'hier au bit.
import { hyp } from './hyp.js';

/** La poussée [px, pz] (non normée) infléchie par l'élan du porteur `p` ; rend [px, pz] inchangé hors de la loi. */
export function elanConduite(st, p, K, px, pz, sgnG) {
  const sp = p.speed ?? hyp(p.v[0], p.v[1]);
  if (!K || sp < (K.v ?? 3.5)) return [px, pz];
  const ux = p.v[0] / sp, uz = p.v[1] / sp;
  if (ux * sgnG < (K.plancher ?? -0.2)) return [px, pz];                     // il court vers son but : la course ne fait pas foi
  let foe = Infinity;
  for (const q of st.players) {
    if (q.team === p.team || q.down > 0) continue;
    const qx = q.p[0] - p.p[0], qz = q.p[2] - p.p[2], d = hyp(qx, qz);
    if ((qx * ux + qz * uz) > d * 0.5) foe = Math.min(foe, d);
  }
  const E = K.espace ?? 8; if (foe < E * 0.5) return [px, pz];
  const k = (K.k ?? 0.7) * Math.min(1, (foe - E * 0.5) / (E * 0.5));
  const pl = hyp(px, pz) || 1;
  return [(px / pl) * (1 - k) + ux * k, (pz / pl) * (1 - k) + uz * k];
}
