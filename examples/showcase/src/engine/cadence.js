// cadence.js — LE PAS DE DÉCISION SÉPARÉ DU PAS PHYSIQUE (lot 263 — Modèle 01 §1 « le choix du pas de temps »,
// §1.4 le tableau de décision : « deux horloges : décision 0,10 s / physique 0,02 s », §5.2 la répartition par
// sous-système et fréquence, le test 3 « insensibilité au pas »).
//
// Ce que le chapitre demande : un pas de décision Δt_dec = 0,10 s (Google Research Football expose l'agent à 10 Hz ;
// les jeux de données de tracking vivent à 6,25-10 Hz ; « un agent qui réévalue son intention 25 fois par seconde
// oscille bien plus qu'il ne décide ») et un sous-pas physique pour le ballon (Δt_phys = Δt_dec / K, K = 5). Et la
// clause qui juge : « un décalage de moyenne > 5 % [entre deux pas de temps] prouve que des constantes du moteur sont
// exprimées en TICKS au lieu de SECONDES ».
//
// Ce que le moteur faisait : un seul pas — décision, locomotion, ballon au même 60 Hz (matchStep(st, 1/60)). Mesuré
// AVANT (sonde-mc01, 2 × 45 min, graines 3 et 7) : D_KS(durée de possession) 0,177 entre dt 1/60 et 1/30 (cible < 0,03),
// p50 436 µs par pas (183 s par match).
//
// LA LOI : le cerveau ne parle qu'aux TICKS DE DÉCISION. `pasDecision(st, dt, C)` accumule le temps physique et rend
// vrai toutes les C.dec s (le premier pas décide ; la phase se conserve d'un tick à l'autre). rondoStep n'appelle
// assignJobs (les postes de champ, le marquage, le pressing) et le CHOIX du porteur (choosePass, l'adoption d'une
// intention, les niches du 1c1) que sur un tick ; le corps (movePlayers), le ballon, les gestes, la perception (croyance :
// sa propre cadence dtObs), le contact, l'arbitre et son administration (le sifflet, le chrono, les Lois 3 et 12), les
// remises et LE GARDIEN (sa décision est une réaction de corps au vol du ballon, comme le contre et la jambe tendue —
// mesuré au tick : buts 4,3 → 6,3 par match, les prises tombaient) vivent à chaque pas physique (assignMatchJobs rend la
// main à la frontière quand st._decide est faux). Les gâchettes
// d'EXÉCUTION restent au pas physique — tryShot pose sa touche puis arme à la touche suivante, tryCross, beginPass
// d'une intention adoptée — : une intention se décide à 10 Hz, elle s'exécute quand le ballon est au pied.
// Le sous-pas du ballon est déjà plus fin que le K du book : stepBall découpe chaque pas en n = ⌈|v| dt / (r/2)⌉
// sous-pas (jamais plus d'un demi-rayon, 0,055 m — à 30 m/s et dt 1/60, 9 sous-pas ; le book : 0,6 m par sous-pas).
// L'inventaire des constantes du cerveau dites en IMAGES, réécrites en secondes sous la clé (hzDecision) : l'EMA de la
// poussée du porteur (τ 0,35 s, match-sim), la vitesse de tour du retournement (rad/s), le compteur du vol mort
// (18 images = 0,3 s). Sans la clé (cfg.cadence null) : hzDecision rend 60 et chaque image décide — hier au bit.

/** Le tick de décision : vrai quand C.dec s de temps physique se sont accumulées depuis le dernier (le premier pas décide). */
export function pasDecision(st, dt, C) {
  const dec = C.dec ?? 0.1;
  st._decAcc = (st._decAcc ?? dec - dt) + dt;   // le premier pas décide (l'accumulateur naît plein), puis toutes les dec s
  if (st._decAcc < dec - 1e-9) return false;
  st._decAcc = Math.min(st._decAcc - dec, dec);   // la phase se conserve ; un pas plus long que dec ne crée pas de dette
  st._decN = (st._decN ?? 0) + 1;
  return true;
}

/** Combien de fois par seconde le cerveau est appelé : 1 / dec sous la clé, 60 sans elle (l'image d'hier). */
export const hzDecision = (cfg) => (cfg?.cadence ? 1 / (cfg.cadence.dec ?? 0.1) : 60);

/** Loi pure pour le banc : les ticks de décision produits par T secondes à pas physique dt (un état neuf). */
export function ticksDecision(T, dt, C) {
  const st = {}; let n = 0;
  for (let t = 0; t < T - 1e-9; t += dt) if (pasDecision(st, dt, C)) n++;
  return n;
}
