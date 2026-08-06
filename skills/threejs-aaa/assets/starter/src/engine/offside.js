// offside.js — LA LOI 11, pure. Le hors-jeu n'est pas une géométrie compliquée : c'est UNE ligne
// et UN instant. La ligne : l'avant-dernier adversaire (le dernier est presque toujours le
// gardien), tenue par le ballon s'il est plus profond que lui, et jamais dans sa propre moitié.
// L'instant : LE DÉPART DU BALLON (strikeNow), pas la réception — c'est ce qui rend l'appel timé
// possible : un coureur lancé est en jeu si la passe part pendant qu'il l'est encore.
//
// Quatre consommateurs, une seule loi :
//   — le CERVEAU (choosePass / beginPass) refuse de servir une position illicite (refus nommé) ;
//   — la PHOTO (strikeNow) marque les coupables à l'instant de la frappe (st.pass.off) ;
//   — le SIFFLET (receive → st._whistle → match) fait de leur premier toucher un coup franc ;
//   — le CALAGE (assignMatchJobs) tient les pointes SUR la ligne, d'où l'appel jaillit.
// Le format réduit reste sans hors-jeu (loi du futsal) : tout est gardé par cfg.offside && st.full.
//
// Pur : un état entre, des mètres sortent — testable au banc sans navigateur (checkOffside).

/**
 * La ligne de hors-jeu de l'équipe QUI ATTAQUE `team`, dans l'espace d'attaque (adv = mètres
 * vers le but adverse depuis la médiane ; sgn ramène au monde : x_monde = adv · sgn).
 * Un défenseur au sol COMPTE (loi réelle — tomber ne remet personne en jeu). Un défenseur
 * EXPULSÉ ne compte PAS (loi réelle aussi — il n'est plus sur le terrain : un rouge posté
 * derrière sa ligne de touche qui ferait la ligne serait un fantôme de Loi 11).
 */
export function offsideLine(st, team) {
  const sgn = -st.pitch.ownGoal(team).sign;
  let last = -Infinity, second = -Infinity;
  for (const q of st.players) {
    if (q.team === team || q.expulse) continue;
    const v = q.p[0] * sgn;
    if (v > last) { second = last; last = v; }
    else if (v > second) second = v;
  }
  return { sgn, adv: Math.max(second, st.ball.p[0] * sgn, 0) };
}

/** `p` (position monde, [x, …, z]) est-il en position de hors-jeu pour l'attaque de `team` ?
 *  La tolérance rend à l'attaquant le bénéfice du doute — c'est un jeu, pas une VAR au millimètre. */
export function isOffside(st, team, p, tol = 0.05) {
  const L = offsideLine(st, team);
  return p[0] * L.sgn > L.adv + tol;
}

/** Le contrat de la loi — les pièges classiques, jugés sur un monde synthétique. */
export function checkOffside(pitch) {
  const issues = [];
  const mk = (defAdv, ballAdv, atkAdv) => {
    const sgn = -pitch.ownGoal(0).sign;                            // l'équipe 0 attaque vers +adv
    return {
      pitch,
      ball: { p: [ballAdv * sgn, 0.11, 0] },
      players: [
        { id: 0, team: 0, keeper: false, p: [atkAdv * sgn, 0, 2] },
        ...defAdv.map((a, i) => ({ id: 1 + i, team: 1, keeper: i === 0, p: [a * sgn, 0, -2] })),
      ],
    };
  };
  // (1) la ligne est l'AVANT-dernier : gardien à 50 m, dernier défenseur de champ à 12 → ligne 12
  let st = mk([50, 12, 8], 0, 14);
  if (!isOffside(st, 0, st.players[0].p)) issues.push('avant-dernier ignoré : attaquant à 14 m derrière une ligne à 12 m jugé en jeu');
  st = mk([50, 12, 8], 0, 11);
  if (isOffside(st, 0, st.players[0].p)) issues.push('attaquant à 11 m devant une ligne à 12 m jugé hors-jeu');
  // (2) le BALLON tient la ligne : ballon à 20 m, défense à 12 — un attaquant à 18 est en jeu
  st = mk([50, 12, 8], 20, 18);
  if (isOffside(st, 0, st.players[0].p)) issues.push('le ballon (20 m) ne tient pas la ligne — attaquant à 18 m sifflé');
  // (3) sa PROPRE MOITIÉ immunise : défense montée à −3 m (ligne au-delà de la médiane), attaquant
  // à −1 m — sans le plancher médian il serait hors-jeu dans son propre camp
  st = mk([50, -3, -4], -5, -1);
  if (isOffside(st, 0, st.players[0].p)) issues.push('hors-jeu sifflé dans sa propre moitié (le plancher médian ne tient pas)');
  // (4) la tolérance : à un cheveu (ligne + 3 cm), le doute profite à l'attaquant
  st = mk([50, 12, 8], 0, 12.03);
  if (isOffside(st, 0, st.players[0].p)) issues.push('VAR au millimètre : ligne + 3 cm sifflé malgré la tolérance');
  return { ok: issues.length === 0, issues };
}
