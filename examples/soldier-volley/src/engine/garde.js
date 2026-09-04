// LA GARDE PAR TIERS (238, cfg.gardeTiers && cfg.garde && st.full — Moulin : « on ne presse pas à 80 m de son but » ;
// brief 2.3 : rayon d'intervention 1,2-1,8 m au contact, 4-8 m de cadrage dans le tiers adverse). La garde 222 posait
// déjà une distance par tiers (loin 6, milieu 3) mais seul le JOCKEY la lisait — et l'ombre de couverture (coverShadow,
// avant lui dans l'ordre du presseur) posait la cible à 1,15 m du porteur dès 2,6 m : mesuré, le premier défenseur à
// 2,6 m dans le tiers loin comme dans le tiers proche. Ici UNE distance, lue par l'ombre ET le jockey : tiers depuis le
// but défendu (loin > 2L/3 : 6 m ; milieu > L/3 : gardeTiers.milieu 4 — le 3 du 222 rendait 2,9 m de corps, cible 3-5 ;
// proche : gardeTiers.proche 2 m — hier le pas du jockey, 1 m ; chaque tiers surchargeable dans gardeTiers) × fenêtre
// de pressing (garde.fenetre 0,5 : en fenêtre on va au contact) × axe tactique pressing (1,4 → 0,6 : le bloc qui
// presse haut cadre court) × (2 − aggrF) (l'agressif colle, le placide garde — la note est un facteur, 1 à 50). La
// morsure (mord, 1,6 m) reste : elle ne se déclenche que si le porteur VIENT dans la garde. Absente : l'hier au bit.
export function gardeDist(st, cfg, { p, anchor, press, ogx, L, tac, axe }) {
  const G = cfg.garde, T = cfg.gardeTiers;
  const dMon = Math.abs(anchor[0] - ogx);
  const base = dMon > L * (2 / 3) ? (T.loin ?? G.loin ?? 6) : dMon > L / 3 ? (T.milieu ?? G.milieu ?? 3) : (T.proche ?? 2);
  return base * (press ? (G.fenetre ?? 0.5) : 1) * axe(tac(st, p.team).pressing, 1.4, 0.6) * (2 - (p.skill?.aggrF ?? 1));
}
