// prise-suivie.js — LE JOUEUR NE QUITTE PAS SON BALLON (cfg.priseSuivie && st.full — retour utilisateur du 28/09 : « des contrôles où le
// joueur contrôle puis part d'un côté mais le ballon est resté à l'endroit du contrôle »). Mesuré (diag-B, 4 × 900 s, 915 contrôles) :
// 3,8 % des contrôles (4-13 par match) — le ballon assis puis lâché MORT (< 0,2 m/s dans 46 % des lâchers), la poussée du porteur à > 90°
// du ballon (62 %), et trois portes qui refusaient la seule touche qui l'aurait gardé : sous 0,85 m la cible du porteur ignorait le
// ballon (match-sim : p + push × 3), la foulée minimale (0,55 m courus depuis la dernière touche — un dribbleur neuf part de 0) et la fuite
// lue EN RELATIF (le joueur qui s'éloigne d'un ballon arrêté le voit « fuir »). La touche orientée était reprise par le ramassage l'image
// d'après (55 %). Le réel : le joueur joue le ballon qu'il vient de contrôler, il ne s'en va pas sans lui.
// Trois branchements (clé absente : l'hier au bit) :
//   match-sim (la cible du porteur)   — ballon libre à moins de 0,85 m mais hors du cône de sa poussée (> cone °) : la cible est le ballon
//                                       + over m dans la poussée — il CONTOURNE son ballon au lieu de le laisser ;
//   dribble.dribbleStep (player.mortOk) — un ballon quasi arrêté (< vMort m/s) au pied se rejoue : pas de foulée minimale, sa fuite se lit
//                                       à sa propre vitesse ;
//   rondo-sim (le ramassage)          — pas de reprise de sa propre touche orientée pendant garde s.
import { hyp } from './hyp.js';

/** La cible du porteur proche d'un ballon libre hors de sa poussée, ou null (la cible d'hier). Pure. */
export function cibleViaBalle(st, p, cfg, dBall) {
  const K = st.full && cfg.priseSuivie; if (!K || !p.push || st.ball.owner === p.id || dBall < 0.05) return null;
  const bx = (st.ball.p[0] - p.p[0]) / dBall, bz = (st.ball.p[2] - p.p[2]) / dBall;
  if (bx * p.push[0] + bz * p.push[1] >= Math.cos((K.cone ?? 60) * Math.PI / 180)) return null;
  const over = K.over ?? 0.3; return [st.ball.p[0] + p.push[0] * over, 0, st.ball.p[2] + p.push[1] * over];
}

/** Le ramassage se tait-il sur la touche orientée de c ? Pure. */
export function gardeTouche(st, c, cfg) { const K = st.full && cfg.priseSuivie; return !!K && K.garde != null && (c._toT ?? -99) + K.garde > st.t; }

/** Le seuil de ballon mort pour dribbleStep (player.mortOk), ou undefined. Pure. */
export function mortDe(st, cfg) { const K = st.full && cfg.priseSuivie; return K ? (K.vMort ?? 0.3) : undefined; }
