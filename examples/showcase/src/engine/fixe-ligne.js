// fixe-ligne.js — LES POINTES FIXENT LA LIGNE (lot 369, cfg.fixeLigne — T2 du chantier tactique ; B09 l'avant-centre, B08 les ailiers,
// B12 le marquage). Mesuré (30 min, ballon au milieu) : l'avant-centre de l'équipe en possession vivait à 9 m DEVANT la ligne de
// hors-jeu adverse (médiane), les ailiers à 11-13 m, le plus avancé à 6 m — 71-74 % du temps en « soutien » de leur slot. Conséquence
// lue par la télémétrie du T1 : les centraux et les latéraux défendants n'avaient PERSONNE dans leur zone (12-14 m du plus proche
// adversaire, livre 5,5-6,4), la surface restait vide, le centre n'avait pas de cible ; le livre demande un pinCount 1,5-2,4.
// La loi : hors appel, la pointe tient la HAUTEUR de la ligne adverse (marge m en deçà, côté jeu — le calage Loi 11 garde le dernier
// mot) ; le poids suit le RÔLE (profondeur : le 9 de surface fixe, le faux 9 / le meneur décroche) et la MENTALITÉ de la tactique.
// Le ballon déjà dans la ligne (dernier tiers profond) : la loi s'efface (la surface a ses propres lois). Absente : le slot d'hier.
const ax = (v, lo, hi) => lo + Math.max(0, Math.min(1, v ?? 0.5)) * (hi - lo);
/** La cible x (monde) de la pointe `p` dont le slot vise tx ; off = offsideLine (adv : la ligne en coordonnées d'attaque, sgn). */
export function fixeLigneX(p, tx, off, R, K, tq, ballX) {
  const ligne = off.adv - (K.marge ?? 1.2), xa = tx * off.sgn;
  if (xa >= ligne || ballX * off.sgn > off.adv - (K.ballonDans ?? 6)) return tx;
  const w = Math.min(1, (K.w ?? 0.85) * ax(R?.profondeur, 0.55, 1.25) * ax(tq?.mentalite, 0.85, 1.15));
  return (xa + (ligne - xa) * w) * off.sgn;
}
