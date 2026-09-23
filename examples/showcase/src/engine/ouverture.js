// ouverture.js — LE BALLON QUI DOUBLE SE PREND DEVANT (288, cfg.ouverture && st.full — les retours du 17/09, la passe qui
// n'arrive à personne). Sondé (sonde-288c/d, 4 × 45 min) : 33 % des passes au sol se perdent SANS la touche du receveur ; sur ces
// 700 passes le ballon passe à 1,4 m p50 du receveur (35 % à portée, ≤ 0,85 m), il vient dans son DOS 56 % du temps, à 7 m/s
// contre 3 m/s pour un receveur en course vers son rendez-vous — et le cône de prise (lot 70, 100°) le REFUSE à l'image même où
// il entre dans le rayon, encore derrière (controle-dos 108 refus nommés) : la passe devient un ballon LIBRE, alors que dix
// images plus tard le même ballon serait DEVANT lui, dans le cône, à portée du pied. Le vrai receveur en foulée laisse le
// ballon qui le double venir à son pied avant (Modèle 03 § 8.1 : le contrôle orienté prend le ballon là où il sera ; Modèle 09
// § 6.3 : recevoir en mouvement). TENTÉ ET RÉFUTÉ d'abord (v1 de ce lot) : l'ouverture du corps + le pas d'arrêt du receveur
// en course (yaw au ballon, cible = sa position) — mesuré 3 × 600 s : perdues sans touche 32 → 43 %, controle-dos 167 → 331,
// réussite 61 → 50 % (le corps tourné vers l'arrière, le ballon le dépasse et se retrouve dans son nouveau dos). La loi :
// (1) l'ATTENTE — hors cône, si le ballon DOUBLE le corps dans le sens du regard (sa vitesse le long du regard dépasse celle
// du corps de `double` m/s), passe à ≤ lateral × controlF de la ligne du corps (le bon contrôleur allonge le pied) et sera
// devant dans ≤ tMax s, la prise ATTEND (refus nommé 'controle-attend', la passe reste une passe) ; (2) sinon le cône d'hier
// (controle-dos : le ballon court). Attribut : control (controlF sur la portée latérale, 1 exact à 50). Clé absente : le
// refus d'hier au bit. (3) L'OUVERTURE EN COURSE — sondé (sonde-288e, 4 × 45 min) : 122 refus controle-dos par match du receveur
// visé, l'équipe ne garde le ballon que 33 % ensuite ; le ballon DOUBLE dans le sens du regard 31 % (l'attente ci-dessus), CROISE
// le dos 47 %, s'en va derrière 22 % (le receveur l'a dépassé) — à 2,9 m/s p50, le corps tourné vers son rendez-vous, le ballon à
// 114° du regard. Le lot 70 n'ouvrait le corps que du receveur quasi statique. Ici le receveur EN COURSE dont le ballon est derrière
// et ne double pas devant tourne le corps AU BALLON (movement.js : l'autorité du cap passe de la dérive au ballon, le demi-corps du
// 170 reste sa loi, la course continue — pas de pas d'arrêt, c'est lui qui a été réfuté) dès qu'il est à ≤ dOuvre m.
import { hyp } from './hyp.js';

/** Le ballon derrière le corps va-t-il le doubler devant, à portée ? Pure. r : { yaw, p: [x, y, z], v: [vx, vz] }, b : { p, v },
 *  K : cfg.ouverture, controlF : le facteur. → { attend, tDevant, lat }. */
export function attendDe(r, b, K, controlF = 1) {
  const ux = Math.cos(r.yaw), uz = Math.sin(r.yaw), rvx = (r.v?.[0] ?? 0), rvz = (r.v?.[1] ?? 0);
  const vBa = b.v[0] * ux + b.v[2] * uz, vRa = rvx * ux + rvz * uz, dbl = vBa - vRa;
  if (dbl < (K.double ?? 0.5) || b.p[1] > (K.h ?? 0.9)) return { attend: false, tDevant: 99, lat: 99 };
  const dx = b.p[0] - r.p[0], dz = b.p[2] - r.p[2], wx = b.v[0] - rvx, wz = b.v[2] - rvz, w = hyp(wx, wz) || 1;
  const lat = Math.abs(dx * (-wz / w) + dz * (wx / w));                 // l'écart de la ligne du ballon (relative) au corps
  const along = dx * ux + dz * uz, tDevant = along >= 0 ? 0 : -along / dbl;   // quand il sera devant, le long du regard
  return { attend: lat <= (K.lateral ?? 0.8) * controlF && tDevant <= (K.tMax ?? 0.6), tDevant, lat };
}

/** Le receveur en course s'ouvre-t-il au ballon ? Derrière le regard (au-delà du relèvement cone − marge), pas en train de doubler devant, bas,
 *  à ≤ dOuvre m. Pure. → { ouvre, dos (rad) }. */
export function ouvreDe(r, b, K, controlF = 1) {
  const dx = b.p[0] - r.p[0], dz = b.p[2] - r.p[2], d = hyp(dx, dz);
  if (b.p[1] > (K.h ?? 0.9) || d > (K.dOuvre ?? 6)) return { ouvre: false, dos: 0 };
  let dos = Math.atan2(dz, dx) - r.yaw; while (dos > Math.PI) dos -= 2 * Math.PI; while (dos < -Math.PI) dos += 2 * Math.PI; dos = Math.abs(dos);
  if (dos <= ((K.cone ?? 100) - (K.marge ?? 10)) * Math.PI / 180) return { ouvre: false, dos };   // le cône du lot 70 est un relèvement (± cone°) : on s'ouvre à ce qui serait refusé, moins la marge
  return { ouvre: !attendDe(r, b, K, controlF).attend, dos };
}
