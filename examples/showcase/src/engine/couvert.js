// couvert.js — BALLON COUVERT / BALLON DÉCOUVERT (236). La règle cardinale de la défense placée (Comment regarder,
// « Coulisser en bloc », l. 4862-4880) : « c'est le ballon qui déclenche la montée, si le porteur est cadré ou pas »
// (Guy Lacombe) ; « si le porteur est libre, l'ensemble du bloc doit reculer pour se prémunir d'un ballon par-dessus ;
// s'il est bien pressé, le bloc peut remonter » (Stéphane Moulin). Mesuré AVANT (film-couvert, 6 × 300 s) : la ligne
// arrière était INDIFFÉRENTE à l'état du porteur (24,8 m du but couvert / 26,6 découvert) et RECULAIT quand le porteur
// était cadré (−1,5 m/s : elle suivait le ballon qui avance) — l'inverse de la doctrine.
// La loi : l'état du porteur adverse — COUVERT (le premier défenseur à ≤ pres m, ou porteur dos au jeu), DÉCOUVERT
// (aucun à < libre m et porteur face au jeu), entre-deux sinon — donne une CIBLE de profondeur de ligne : + monte m
// (couvert : le pas en avant, le bloc se compacte et met les pointes hors-jeu), − recule m (découvert : le recul-frein),
// 0 entre-deux ; × axe(hauteurBloc, 0,6, 1,4) sur la montée et (1,4, 0,6) sur le recul (le bloc bas recule plus qu'il
// ne monte) × la moyenne d'anticipF de la ligne (le bloc qui lit, 161). Le delta suit sa cible avec une constante tau s
// (l'amorce ≤ 200 ms du brief) et s'applique à la profondeur des postés de la ligne (st._bCouvertDx — un delta que le
// consommateur nommé applique, jamais un buffer muté : le patron 228). Le piège (149) garde le dernier mot sur la montée.
// Absente : la ligne d'hier au bit.

/** Calcule et lisse le delta de profondeur de la ligne défendante ; rend { etat, cible, dx }. */
export function couvertStep(st, cfg, { defTeam, carrier, presseur, sgnAtk, anticipMoy, tac, axe }) {
  const K = cfg.couvert; if (!K || !st.full) return null;
  const T = tac(st, defTeam);
  let etat = 'entre-deux', cible = 0;
  if (carrier && !carrier.keeper) {
    const dP = presseur ? Math.hypot(presseur.p[0] - carrier.p[0], presseur.p[2] - carrier.p[2]) : 99;
    const face = Math.cos(carrier.yaw) * sgnAtk > (K.face ?? 0.3);
    if (dP <= (K.pres ?? 2) || !face) { etat = 'couvert'; cible = (K.monte ?? 3) * axe(T.hauteurBloc, 0.6, 1.4) * anticipMoy; }
    else if (dP > (K.libre ?? 3.5) && face) { etat = 'découvert'; cible = -(K.recule ?? 5) * axe(T.hauteurBloc, 1.4, 0.6) * anticipMoy; }
  }
  const M = (st._bCouvert ??= {}); const prev = M[defTeam] ?? { dx: 0, t: st.t };
  const dt = Math.max(0, Math.min(0.2, st.t - prev.t)), k = 1 - Math.exp(-dt / (K.tau ?? 0.2));
  const dx = prev.dx + (cible - prev.dx) * k;
  M[defTeam] = { dx, t: st.t, etat };
  (st._bCouvertDx ??= {})[defTeam] = dx * sgnAtk * -1;   // en coordonnées monde : + vers le but adverse de la défense = vers le ballon
  return { etat, cible, dx };
}
