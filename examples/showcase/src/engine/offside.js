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
/** L'ORTEIL (259, cfg.horsJeu — la carte du book, Modèle 12 §1.2 « le point du corps sans squelette ») : la Loi 11 se
 *  juge sur la partie du corps la plus avancée (tête, tronc, pieds — pas les bras), pas sur le centre. Sans rig, une
 *  CAPSULE : le tronc (rayon tronc m) + l'extension du pied avant, ℓ(v) × |sin φ| avec φ la phase de foulée intégrée
 *  analytiquement (2π f t, f la cadence de foulée — jamais reconstruite de deux ticks : le piège de Nyquist). L'attaquant
 *  (sens +1) porte son point VERS le but adverse quand il y court ; le défenseur (sens −1) porte le sien vers son but
 *  quand il y recule. C'est cette oscillation qui fabrique les hors-jeu « d'un orteil » du réel — sans bruit artificiel. */
export function pointCorps(st, q, sgn, K, sens) {
  const vx = (q.v?.[0] ?? 0) * sgn * sens, v = Math.hypot(q.v?.[0] ?? 0, q.v?.[1] ?? 0);
  const court = vx > 0.5 ? Math.min(1, v / 8) : 0;
  const phi = 2 * Math.PI * (K.freq ?? 2.2) * (st.t ?? 0) + (q.id ?? 0) * 1.7;
  return (K.tronc ?? 0.2) + (K.foulee ?? 0.3) * court * Math.abs(Math.sin(phi));
}

export function offsideLine(st, team, K = null) {
  const sgn = -st.pitch.ownGoal(team).sign;
  let last = -Infinity, second = -Infinity;
  for (const q of st.players) {
    if (q.team === team || q.expulse) continue;
    const v = q.p[0] * sgn - (K ? pointCorps(st, q, sgn, K, -1) : 0);   // (259) la partie du corps la plus proche de SA ligne de but
    if (v > last) { second = last; last = v; }
    else if (v > second) second = v;
  }
  return { sgn, adv: Math.max(second, st.ball.p[0] * sgn, 0) };
}

/** `p` (position monde, [x, …, z]) est-il en position de hors-jeu pour l'attaque de `team` ?
 *  La tolérance rend à l'attaquant le bénéfice du doute — c'est un jeu, pas une VAR au millimètre. */
export function isOffside(st, team, p, tol = 0.05, K = null, q = null) {
  const L = offsideLine(st, team, K);
  return p[0] * L.sgn + (K && q ? pointCorps(st, q, L.sgn, K, +1) : 0) > L.adv + tol;
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

/** LA TENTATIVE (259, cfg.horsJeu.tente — Loi 11 (b) : l'infraction n'est pas seulement le toucher, c'est INTERFÉRER —
 *  jouer ou tenter de jouer un ballon proche). Le photographié qui arrive à ≤ tente m du ballon en vol est sifflé
 *  sans attendre son pied : le drapeau se lève, la remise suit (st._whistle, le même chemin que receive). */
export function horsJeuTente(st, cfg) {
  const K = st.full && cfg.offside ? cfg.horsJeu : null;
  if (!K || !st.pass?.off || st.ball.owner != null || st.restart || st._whistle) return;
  for (const id of Object.keys(st.pass.off)) {
    const p = st.players[id];
    if (!p || p.down > 0 || Math.hypot(p.p[0] - st.ball.p[0], p.p[2] - st.ball.p[2]) > (K.tente ?? 1.5)) continue;
    st.events.push({ t: +st.t.toFixed(2), type: 'hors-jeu', by: p.id, at: st.pass.off[id], p: [+p.p[0].toFixed(2), +p.p[2].toFixed(2)], tente: true });
    st._whistle = { p: [p.p[0], p.p[2]], team: p.team === 0 ? 1 : 0 };
    st.pass.off = null;
    return;
  }
}
