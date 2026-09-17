// prefiltre.js — LE PRÉ-FILTRE DE LA PORTE DU TIR (282, cfg.prefiltreTir && st.full — Modèle 10 §1.4 : « la porte n'est pas
// évaluée à chaque tick : elle l'est à 10 Hz, et seulement si un pré-filtre O(1) passe : ballon contrôlé, distance au but
// < 35 m (la borne du clamp du §2.2), angle visible > 4°, corps orienté à moins de 110° de la cible »). Mesuré avant
// (sonde-282, 4 × 90 min) : 0,50 tir par touche dans la surface pour 0,32 réel — la porte du 272 compare le xG à la
// continuation, mais elle ne regarde ni le corps ni l'angle : le porteur dos au but frappait en se retournant, l'aile
// au ras de la ligne canonnait un cadre de 2°. Ici les quatre tests sont PURS et nommés (contrôle, distance, angle,
// corps) ; le corps tolère × pivotF (technique / agilité — le pivot qui se retourne en une touche : 93° pour le raide,
// 127° pour le souple, 110° exacts à 50). Ni le tir de la tête ni la volée (tete.js) n'y passent : ce sont des reprises,
// pas des tirs contrôlés. Clé absente : la porte d'hier au bit.
import { angleVisible } from './xg.js';

/** Le pré-filtre : rend { ouvert, raison, corps (°), angle (°), d }. K : cfg.prefiltreTir ; x : { d (m au centre du but), X, C
 *  (la géométrie de Sumpter), yaw (le corps), cap (la direction du but), pivotF, hold, holdMin, W }. Pure. */
export function prefiltreDe(K, x) {
  const deg = 180 / Math.PI, W = x.W ?? 7.32;
  const angle = angleVisible(Math.max(0.1, x.X), x.C, W) * deg;
  const corps = x.yaw == null ? 0 : Math.abs(((x.yaw - x.cap + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) * deg;
  const tol = (K.corps ?? 110) * (x.pivotF ?? 1);
  const raison = (x.hold ?? 1) < (x.holdMin ?? 0) ? 'contrôle' : x.d > (K.dMax ?? 35) ? 'distance' : angle < (K.angleMin ?? 4) ? 'angle' : corps > tol ? 'corps' : null;
  return { ouvert: raison == null, raison, corps: +corps.toFixed(1), angle: +angle.toFixed(1), tol: +tol.toFixed(1), d: +x.d.toFixed(1) };
}

/** Les entrées du pré-filtre pour un porteur c face au but goal (le cap au centre du but). Pure. */
export function entreesPrefiltre(c, goal) {
  const s = Math.sign(goal.x || 1), X = (goal.x - c.p[0]) * s, C = Math.abs(c.p[2]);
  return { d: Math.hypot(goal.x - c.p[0], c.p[2]), X, C, yaw: c.yaw, cap: Math.atan2(0 - c.p[2], goal.x - c.p[0]), pivotF: c.skill?.pivotF ?? 1 };
}
