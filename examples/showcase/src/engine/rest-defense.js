// rest-defense.js — L'ATTAQUE S'ENGAGE, LA GARDE RESTE (lot 373, cfg.restDefense — T2 du chantier tactique ; B11 X19 : la rest defense
// 3,7 joueurs derrière le ballon à la perte, ~44 m de son but ; 4-5 en attaque placée — B04 #24). Sondé (30 min, attaque installée,
// ballon à ~79 m de son but) : 9 joueurs derrière le ballon, latéraux à 50-55 m, centraux 44-48, milieux 61-66 ; la formation en
// possession PLAFONNE (ballon à 79 ou à 88 m : centraux 53, latéraux 55, milieux 68-72) — l'équipe n'accompagne pas son attaque : la
// surface vide, les centres sans arrivées, le contre-pressing impossible, et 7,5 joueurs derrière le ballon à chaque perte.
// La loi : en ATTAQUE (possession depuis plus de `tenue` s, ballon au-delà de `des` m de la ligne médiane), les GARDES (les deux centraux, la
// sentinelle de la formation, et le latéral opposé quand la mentalité est prudente) tiennent ; les AUTRES montent — le latéral à `lat` m
// du ballon (sa largeur garde le couloir), le milieu à `mil` m — × la MENTALITÉ (prudente : ×0,7 de la montée ; offensive : ×1,3).
// Absente : la formation plafonnée d'hier, au bit.
import { LIGNES, pivotDe } from './formation.js';
const ax = (v, lo, hi) => lo + Math.max(0, Math.min(1, v ?? 0.5)) * (hi - lo);

/** Dans la boucle de mouvement, pour le soutien de l'équipe en possession : relève la cible x si la loi le demande. */
export function restDefenseCorps(st, p, K) {
  if (p.job !== 'support' || !p.target || p.keeper || st.restart || st.possession?.team !== p.team) return;
  if (st.t - (st._possChangeAt ?? st.t) < (K.tenue ?? 3)) return;
  const sg = Math.sign(st.pitch.attackGoal(p.team).x || 1), bx = st.ball.p[0] * sg;
  if (bx < (K.des ?? -5)) return;                                                    // dès la ligne médiane (le dernier tiers d'abord essayé : les séquences y sont trop courtes, le corps n'arrivait jamais)
  const T = st.tactics?.[p.team], f = T?.formation ?? '433', lg = LIGNES[f] ?? LIGNES[433], nDef = lg[0], k = p.post ?? 0;
  if (k === pivotDe(f)) return;                                                       // la sentinelle garde
  const m = T?.mentalite ?? 0.5;
  if (k < nDef) {
    const lateral = k === 0 || k === nDef - 1; if (!lateral) return;                  // les centraux gardent
    if (m < 0.5 && Math.sign(p.p[2] || 1) !== Math.sign(st.ball.p[2] || 1)) return;   // prudent : le latéral opposé garde aussi
  }
  const avance = (k < nDef ? K.lat ?? 5 : K.mil ?? 9) / ax(m, 0.7, 1.3);
  const tx = p.target[0] * sg, cible = bx - avance;
  if (cible > tx) p.target = [cible * sg, p.target[1] ?? 0, p.target[2]];
}
