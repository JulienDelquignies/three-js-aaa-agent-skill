// bloc-percu.js — LE BLOC QUI PERÇOIT (275, cfg.blocPercu && cfg.croyance && st.full — Bible 10 §4.4 « le décalage temporel entre
// les lignes : la variable que les moteurs oublient et qui produit tout le réalisme », lot 1 de la fiche ; Modèle 04). Le
// bloc d'hier lisait l'ÉTAT VRAI du ballon : formationSpots à l'ancre réelle, une fois par image, pour les onze — les onze
// partaient au même tick, le bloc était « artificiellement imperméable » (mesuré : décalage 1er → dernier 0,00 s, fenêtre W
// du renversement 0,02 s pour 1,5-2,5 réels, 91 % des défenseurs déjà en mouvement à l'instant de la passe). Ici la cible
// de bloc de chaque corps se dérive de SA CROYANCE du ballon (croyance.js, 262 : le champ visuel à deux canaux, le dos au
// ballon qui ne voit pas, la prédiction saturée) relue avec la LATENCE DE DÉCLENCHEMENT du book : (base 0,22 s en vision
// centrale + parM × d) × (1 − 0,15·anticipation centrée) × (1 + fatigue × (1 − stamina)) — le presseur à 5 m part en 0,26 s,
// la ligne opposée à 40 m en 0,5-0,6 s, le dos au ballon attend son scan (la croyance ne se met pas à jour). Le slot posté
// se DÉCALE de la réponse du bloc à l'écart d'ancre (perçue − vraie) : k_x (1 en régime accroché — la ligne chaînée au
// ballon —, 0 au plafond du rond central : la saturation du §3.4) et k_y (le gain latéral du bloc, bloc.lateral). Les
// attributs : anticipation, stamina, vision et scanning par la croyance ; l'identité au 50. Clé absente : l'omniscience
// du bloc d'hier au bit — le renversement ne paie pas.
import { croyanceDe } from './croyance.js';

/** La latence de déclenchement d'un corps (s) — Bible 10 §4.4 : (base + parM × d) × anticipation × fatigue. Pure. */
export function latenceDe(p, d, K) {
  const rA = p.skill?.anticipF != null ? Math.max(0, Math.min(1, (p.skill.anticipF - 0.85) / 0.3)) : 0.5;
  return ((K.base ?? 0.22) + (K.parM ?? 0.008) * d) * (1 - (K.anticipation ?? 0.15) * (rA - 0.5)) * (1 + (K.fatigue ?? 0.3) * (1 - (p.stam ?? 1)));
}

/** Le régime longitudinal du bloc chaîné (§3.4) : 1 si la ligne suit le ballon (ligneF strictement entre ses bornes), 0 au plafond. Pure. */
export function kxDe(anchorX, sgn, L, ligne, K) {
  const ballF = Math.max(0, Math.min(1, (anchorX * sgn) / L + 0.5)), lf = ballF - ligne / L;
  return lf > 0.05 && lf < 0.5 ? (K.kx ?? 1) : 0;
}

/** L'ancre PERÇUE d'un corps : sa croyance du ballon, relue à sa latence de déclenchement (p._blocVu), extrapolée entre deux
 *  relectures à la vitesse crue. Rend [x, z]. */
export function anchorPercu(st, p, cfg, anchor) {
  const K = cfg.blocPercu;
  const d = Math.hypot(anchor[0] - p.p[0], anchor[2] - p.p[2]);
  const B = p._blocVu;
  if (!B || st.t - B.t >= latenceDe(p, d, K)) {
    const c = croyanceDe(p, st.ball, st, cfg);
    p._blocVu = { t: st.t, a: [c.p[0], c.p[2]], v: [c.v?.[0] ?? 0, c.v?.[1] ?? 0], age: c.age ?? 0 };
    return p._blocVu.a;
  }
  // entre deux relectures, l'ancre crue avance à la vitesse CRUE (celle d'avant la passe : le porteur, pas le vol) — la
  // latence est un retard de réaction, pas un gel ; l'extrapolation sature à extrap m (la prédiction du Modèle 04 §4.2)
  const dt = st.t - B.t, ex = Math.max(-(K.extrap ?? 6), Math.min(K.extrap ?? 6, B.v[0] * dt)), ez = Math.max(-(K.extrap ?? 6), Math.min(K.extrap ?? 6, B.v[1] * dt));
  return [B.a[0] + ex, B.a[1] + ez];
}

/** Le décalage du slot posté (m) : la réponse du bloc à l'écart d'ancre perçue − vraie, [k_x × Δx, k_y × Δz], borné. */
export function decalageDe(st, p, cfg, { anchor, kx, ky }) {
  const K = cfg.blocPercu, a = anchorPercu(st, p, cfg, anchor), max = K.max ?? 12;
  const dx = Math.max(-max, Math.min(max, (a[0] - anchor[0]) * kx)), dz = Math.max(-max, Math.min(max, (a[1] - anchor[2]) * ky));
  return [dx, dz];
}
