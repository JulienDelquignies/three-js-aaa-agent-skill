// phases.js — LES QUATRE MOMENTS DU JEU, en pur. Le football collectif ne se lit pas sur la
// phase du BALLON (carry/flight/loose — le moteur l'a depuis le rondo) mais sur le moment de
// l'ÉQUIPE : attaque placée, défense placée, transition offensive, transition défensive — plus
// l'arrêt de jeu. C'est le SOCLE de la tactique : une tactique sans moments n'a pas de
// « quand », un rôle sans moments n'a pas de « pendant quoi ».
//
// La dérivation est VOLONTAIREMENT simple (v1) : qui a le ballon, et depuis combien de temps.
// Une transition est jeune (< win s depuis le changement de possession — les 5-6 secondes où le
// football se joue : le bloc adverse est déformé) ; passé la fenêtre, le jeu est PLACÉ. Le
// raffinement par la géométrie (une transition murée redevient placée tôt) est une dette nommée.
//
// L'horloge du regain (st._possChangeAt, st._possTeam) est TENUE par le match (assignMatchJobs,
// cfg.moments) — la dérivation, elle, est pure : un état entre, un moment sort, testable au banc.

/**
 * Le moment de `team`, du point de vue du football collectif.
 * @returns 'attaque-placée' | 'transition-off' | 'défense-placée' | 'transition-def' | 'arrêt'
 */
export function momentDuJeu(st, team, win = 5) {
  if (st.restart) return 'arrêt';
  const poss = st.possession.team >= 0 ? st.possession.team : st.lastTouch;
  if (poss !== 0 && poss !== 1) return 'arrêt';
  const depuis = st.t - (st._possChangeAt ?? -99);
  if (poss === team) return depuis < win ? 'transition-off' : 'attaque-placée';
  return depuis < win ? 'transition-def' : 'défense-placée';
}

/** Le contrat des moments — les symétries qui ne peuvent pas mentir. */
export function checkMoments() {
  const issues = [];
  const mk = (poss, depuis, restart = null) => ({
    restart, possession: { team: poss }, lastTouch: Math.max(0, poss), t: 100, _possChangeAt: 100 - depuis,
  });
  if (momentDuJeu(mk(0, 1), 0) !== 'transition-off') issues.push('un regain d\'une seconde n\'est pas une transition offensive');
  if (momentDuJeu(mk(0, 1), 1) !== 'transition-def') issues.push('la perte MIROIR n\'est pas une transition défensive');
  if (momentDuJeu(mk(0, 9), 0) !== 'attaque-placée') issues.push('9 s de possession ne sont pas une attaque placée');
  if (momentDuJeu(mk(0, 9), 1) !== 'défense-placée') issues.push('le miroir placé ne tient pas');
  if (momentDuJeu(mk(0, 1, { type: 'touche' }), 0) !== 'arrêt') issues.push('une remise en jeu n\'est pas un arrêt');
  // la fenêtre est un PARAMÈTRE, pas une constante cachée
  if (momentDuJeu(mk(0, 4), 0, 3) !== 'attaque-placée') issues.push('la fenêtre win n\'est pas honorée');
  return { ok: issues.length === 0, issues };
}
