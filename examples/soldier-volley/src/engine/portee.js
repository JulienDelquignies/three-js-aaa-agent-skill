/** LA PORTÉE EST CELLE D'UN PIED (lot 296, cfg.porteePasse — Référentiel 02 : ballons longs Opta (≥ 32 m) 45-50 par équipe et par
 *  match, ~11 % des passes, réussis à 47 % ; la passe moyenne 20-22 m). Le moteur hérite du RONDO une portée de passe de 13 m
 *  (rondo-config passRange) : en match, toute passe plus longue exige une porte nommée (le renversement 38, le couloir 24, l'écart
 *  32, le gardien 26, la profondeur 30, l'appel) — mesuré (sonde-289, 4 × 90 min) : 15-18 ballons longs par équipe réussis à 66-71 %
 *  (le moteur ne joue long que quand c'est sûr), la passe p50 12,2 m, moyenne 14,3 ; et 1 duel aérien par match (réel 40-50).
 *
 *  La loi : en plein format, tout coéquipier jusqu'à `max` m (× visionF : vision et passe, 0,85-1,15, 1 exact à 50) est une OPTION — le barème
 *  d'hier la juge (la ligne, la pression à l'arrivée, P_succ calé par classe du 267, le sens du jeu) ; au-delà de `leve` m la passe
 *  se LÈVE (le ballon long du vrai football vole ; la ligne au sol ouverte à 40 m n'existe presque pas). Les portes nommées gardent
 *  leurs bonus. Attributs : vision et passe (visionF, la portée) ; la précision (passSigma) joue à l'exécution. Tactique : le style direct la favorise déjà au barème.
 *  Clé absente : la portée de 13 m d'hier au bit. */
export function porteePasseDe(rMax, m, c, K) {
  return Math.max(rMax, (K.max ?? 45) * (c.skill?.visionF ?? 1));
}
