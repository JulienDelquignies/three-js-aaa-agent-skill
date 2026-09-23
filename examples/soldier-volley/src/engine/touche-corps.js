/** LA TOUCHE SUIT LE CORPS (lot 292, cfg.toucheCorps). Sondé (sonde-292, 4 × 90 min, au monde du 291) : ~43 échappées de conduite SANS
 *  geste par équipe et par match — le ballon passe à 2,2 m (le plafond du lot 37 : le porteur en course perd l'étiquette) et ~21 sont
 *  reprises par l'adversaire, qui partait deux fois plus loin (défenseur-ballon p50 4,6 m) ; à l'échappée le porteur RALENTIT (86 % :
 *  4,1-4,5 → 2,9-3,0 m/s en 0,5 s) et son corps court à 104° (p50) de son ballon. La cause : la touche se dose sur la vitesse du corps
 *  (pushSpeed) mais part dans la direction VOULUE (l'évasion) — le raccourcissement de la touche qui tourne (turnRate, dribble.js) lit
 *  un taux que le match passe à 0 : une touche à 90° de la course part aussi fort qu'une touche droite, le corps qui vire perd sa
 *  vitesse, le ballon file. RÉFUTÉ avant elle (le même lot) : « le porteur suit sa touche » (la cible derrière le ballon qui roule, la
 *  reprise à + 0,3 m/s) — active avant 16 échappées sur 17, sans effet (43 → 43) : ce n'est pas la cible, c'est le virage.
 *
 *  La loi : la vitesse de la touche × k(angle entre sa direction et la course du corps) — dans l'axe k = 1 (la poussée d'hier), sur le
 *  côté k = kMin, derrière k = kMin : k = kMin + (1 − kMin)·max(0, cos θ)^pow ; plancher vMin (le ballon roule toujours) ; sous vCorps
 *  (le corps presque arrêté tourne avec sa semelle) : la touche d'hier. Le vrai geste : on pousse loin DEVANT soi, on crochète COURT.
 *  Attributs : le dribble (la note entre déjà dans la mène, leadF). Tactique, rôles : rien. Clé absente : la touche d'hier au bit.
 *
 *  RÉFUTÉE À LA MESURE (éteinte par défaut, le précédent du 286 et du 290) : kMin 0,5 — les échappées 43 → 29-31 par équipe (4 × 90 min),
 *  celles reprises par l'adversaire 21 → 16-20, mais les PERTES totales ne bougent pas (222 c. 215-222) ; au banc (4 × 900 s) les passes
 *  479 → 440 et les changements de possession par passe 0,511 → 0,577. kMin 0,7 : 37 échappées, complétion 81-82 %. Les échappées qui
 *  restent ont un ballon LENT (2 m/s) laissé à côté du corps qui file : la perte change de canal. Ce que les trois lots 290-292 disent
 *  ensemble : chaque canal corrigé baisse, le total se conserve — la cause est en amont (la défense collée : 73-75 % des passes sous un
 *  défenseur à moins de 0,7 s, le réel ~12 %). */
export function toucheCorpsDe(sp, dx, dz, corps, speed, K) {
  if (!corps || !(speed > (K.vCorps ?? 2))) return sp;
  const c = Math.max(0, dx * corps[0] + dz * corps[1]), kMin = K.kMin ?? 0.5;
  return Math.max(Math.min(sp, K.vMin ?? 2), sp * (kMin + (1 - kMin) * Math.pow(c, K.pow ?? 1)));
}
