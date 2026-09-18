// layoff.js — LA REMISE EN UNE TOUCHE JUGÉE PAR SON ANGLE (287, cfg.layoff && st.full — retour du 17/09 : « les passes en une touche
// ne sont pas dans des bons angles, elles ne ciblent pas les bons joueurs et sont souvent ratées »). Mesuré avant (sonde-287, 4 × 90
// min) : 15 une-touche par match (3 % des passes, réel 15-25), déviation p50 53° mais p90 165° — la réussite s'effondre avec l'angle
// (0-45° 56 %, 45-90° 39 %, au-delà de 90° 25-27 %), la cible dans le DOS du regard réussit 29 % contre 50 % de face, et la dispersion
// du geste ne lisait pas l'angle (× 1,3 calme / × 1,6 pressé, quel que soit le renvoi). Le book : Modèle 03 § 8.1 (la remise première
// touche : 0,10 s, l'intention engagée avant l'arrivée), Modèle 09 § 6.4 (le LAY_OFF) — une redirection est un contact sur la
// bissectrice, sa précision se paie à l'angle et à la vitesse du ballon qui arrive. TROIS LOIS PURES : (1) la DISPERSION de la
// une-touche croît avec l'angle de déviation (× (1 + kDev × dev / 90°)) et avec la vitesse d'arrivée au-delà de v0 (× (1 + kV ×
// (arr − v0) / vRef)), ÷ layoffF (technique / control : le 50 vaut 1) ; (2) le BARÈME du choix de la cible paie l'angle (kDev2 par
// 90°), la cible marquée (kFoe × (foeRef − foe)+) et prime la cible DE FACE (face) — la marge du couloir reste la base ; (3) l'ANGLE
// IMPOSSIBLE se contrôle : au-delà de devMax, hors pression, la une-touche n'est pas tentée (le contrôle reprend ses droits). Clé
// absente : la une-touche d'hier au bit.

/** Le facteur de dispersion d'une une-touche : angle de déviation dev (rad), vitesse d'arrivée arr (m/s), layoffF (attribut). Pure. */
export function sigmaLayoffF(dev, arr, K, layoffF = 1) {
  return (1 + (K.kDev ?? 0.8) * dev / (Math.PI / 2)) * (1 + (K.kV ?? 0.5) * Math.max(0, arr - (K.v0 ?? 5)) / (K.vRef ?? 5)) * layoffF;
}

/** Le score d'une cible de une-touche : la marge du couloir (la base d'hier, PLAFONNÉE à margeMax — sans bloqueur elle vaut 99 et écrasait tout) − l'angle − la cible marquée + de face. Pure. */
export function scoreLayoffDe(x, K) {
  return Math.min(x.marge ?? 0, K.margeMax ?? 4) - (K.kDev2 ?? 2) * (x.dev ?? 0) / (Math.PI / 2) - (K.kFoe ?? 1) * Math.max(0, (K.foeRef ?? 3) - (x.foe ?? 99)) + (x.face ? (K.face ?? 1) : 0);
}

/** L'angle impossible : true si la une-touche vers cette cible ne se tente pas (dev > devMax, hors pression). Pure. */
export function impossibleDe(dev, presse, K) { return !presse && dev > (K.devMax ?? 135) * Math.PI / 180; }
