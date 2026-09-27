// rondo-virage.js — LE VIRAGE DU PORTEUR A UN GESTE, au rendu (339, 27/09 : « en conduite est-ce qu'un joueur peut faire un 60°, un 90°
// voire complètement se retourner avec un râteau ou une feinte de frappe ? est-ce qu'il y a assez de diversité ? »). MESURÉ (2 × 900 s) :
// par match 510 virages de 60-90°, 315 de 90-150°, 90 demi-tours (le cap de course en 0,8 s) — et 65 % SANS AUCUNE TOUCHE : le ballon
// collé au pied, le corps pivotait sur la foulée et l'appui, sans geste de balle (4 clips de touche, dont aucun ne tourne de plus de 26°).
// Ici, au moment où la conduite voulue par la sim (s.push) s'écarte du cap de ≥ 60°, le porteur JOUE un geste de virage de la machine
// des gestes techniques (motion-skill), choisi par l'angle, le côté du ballon, la vitesse, l'adversaire et la technique (gesteF) :
//   60-110°   le ballon du côté du virage : l'EXTÉRIEUR de ce pied (crochetExterieur) ; sinon l'INTÉRIEUR de l'autre (crochet, court
//             lancé ≥ 3 m/s ; chaloupé face à un adversaire à < 3 m si technique ≥ 0,9) ;
//   110-150°  lent (< 1,5 m/s) : la SEMELLE qui tire le ballon sous le corps (rateau) ; lancé : le crochet (intérieur / extérieur) ;
//   ≥ 150°    face à un adversaire à < 4 m devant : le CRUYFF (fausse frappe, le ballon derrière l'appui — le pied opposé au virage) ;
//             arrêté (< 1,2 m/s) le râteau ; très technique (≥ 1,0) et lancé : la ROULETTE ; sinon Cruyff et râteau en alternance.
// La sim ne change pas (le corps est tourné par elle) ; le clip porte le pied et le buste. Cadencé (0,9 s par porteur, 0,35 s après
// toute autre touche jouée). ?virages-hier : rien.
import { SKILL_KINDS } from '../engine/motion-skill.js';

const D = 180 / Math.PI;
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

/** Le geste d'un virage (pure) : { move, foot } ou null. th > 0 : virage à droite (la convention de conduiteNommee). */
export function gesteDeVirage(th, { lat, v, foe, foeFront, gesteF, alterne = false }) {
  const a = Math.abs(th), droite = th > 0, balleCote = lat > 0 ? 'left' : 'right', pieds = droite ? { ext: 'right', int: 'left' } : { ext: 'left', int: 'right' };
  if (a < 60) return null;
  if (a < 110) {
    if (balleCote === pieds.ext) return { move: 'crochetExterieur', foot: pieds.ext };
    if (foe < 3 && foeFront && gesteF >= 0.9) return { move: 'crochetChaloupe', foot: pieds.int };
    return { move: v >= 3 ? 'crochetCourt' : 'crochet', foot: pieds.int };
  }
  if (a < 150) {
    if (v < 1.5) return { move: 'rateau', foot: balleCote };
    return balleCote === pieds.ext ? { move: 'crochetExterieur', foot: pieds.ext } : { move: 'crochet', foot: pieds.int };
  }
  if (foe < 4 && foeFront) return { move: 'cruyff', foot: pieds.int };   // le Cruyff du pied droit tourne à GAUCHE
  if (v < 1.2) return { move: 'rateau', foot: balleCote };
  if (gesteF >= 1.0 && v >= 2) return { move: 'roulette', foot: balleCote };
  return alterne ? { move: 'cruyff', foot: pieds.int } : { move: 'rateau', foot: balleCote };
}

/** Chaque image, pour chaque joueur (après les événements de la frame). */
export function virageGeste(scene, pl) {
  if (scene._viragesHier) return;
  const st = scene.state, s = pl.sim;
  const v = Math.hypot(s.v[0], s.v[1]), cap = v > 0.8 ? Math.atan2(s.v[1], s.v[0]) : s.yaw;
  // le cap d'il y a 0,4 s : la poussée voulue est lissée (τ 0,35 s) et le corps la suit — l'écart INSTANTANÉ ne dépasse presque jamais 60°
  // dans un virage à 90° (mesuré : 10 % des images porteur ≥ 60°, presque toutes sous un geste de contrôle) ; le virage se lit sur la durée
  const H = (pl._capH ??= []); H.push([scene._t, cap]); while (H.length > 1 && scene._t - H[0][0] > 0.4) H.shift();
  if (st.possession?.carrier !== s.id || st.phase !== 'carry' || s.act || s.keeper || (s.down ?? 0) > 0 || !s.push) { pl._capH = []; return; }
  if (pl.gestureLayer?.active || scene._t - (pl._swingT ?? -9) < 0.35 || scene._t - (pl._virT ?? -9) < 0.9 || scene._t - H[0][0] < 0.25) return;
  const b = st.ball.p; if (Math.hypot(b[0] - s.p[0], b[2] - s.p[2]) > 1.0 || b[1] > 0.4) return;
  const voulu = Math.atan2(s.push[1], s.push[0]), th = wrap(voulu - H[0][1]) * D;
  if (Math.abs(th) < 60 || Math.abs(wrap(voulu - cap)) * D < 20) return;   // un virage de ≥ 60° depuis 0,4 s, ENCORE en cours (≥ 20° à faire)
  let foe = 99, foeFront = false;
  for (const q of st.players) { if (q.team === s.team || q.keeper || (q.down ?? 0) > 0) continue; const dx = q.p[0] - s.p[0], dz = q.p[2] - s.p[2], d = Math.hypot(dx, dz);
    if (d < foe) { foe = d; foeFront = Math.abs(wrap(Math.atan2(dz, dx) - cap)) < Math.PI / 3; } }
  const lat = (b[0] - s.p[0]) * Math.sin(s.yaw) - (b[2] - s.p[2]) * Math.cos(s.yaw);   // > 0 : le ballon à gauche (conduiteNommee)
  const g = gesteDeVirage(th, { lat, v, foe, foeFront, gesteF: s.skill?.gesteF ?? 1, alterne: ((pl._virN = (pl._virN ?? 0) + 1) & 1) === 1 });
  if (!g) return;
  scene._playTech(pl, { type: 'virage', by: s.id, move: g.move, foot: g.foot });
  pl._swingT = pl._virT = pl._switchT = scene._t;   // _switchT : le garde-fou des sauts d'os (rondo-lisse) couvre aussi le DÉPART du virage (sur la foulée)
  // le pied du geste va au VRAI ballon (le clip le croit à sa place de planche, 0,24-0,34 m devant ; en match la sim le tient où elle l'a mis —
  // filmé : la semelle du râteau se posait dans le vide à 50 cm du ballon) : le warp de touche (rondo-touche) centré sur le contact du clip
  const tc = SKILL_KINDS[g.move]?.contact ?? 0.2; pl._lisseJusqua = scene._t + (SKILL_KINDS[g.move]?.duration ?? 0.7) + 0.1;
  pl._touchT = scene._t + tc - 0.15; pl._touchPre = null; pl._touchFoot = g.foot; pl._gestePied = g.foot; pl._gestePiedT = scene._t + tc;
  (scene._virages ??= {})[g.move] = (scene._virages[g.move] ?? 0) + 1; (scene._virLog ??= []).push([Math.round(th), Math.round(Math.abs(wrap(voulu - cap)) * D), +v.toFixed(1), +foe.toFixed(1), g.move]);
}
