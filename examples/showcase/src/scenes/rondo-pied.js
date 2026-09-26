// rondo-pied.js — LE PIED DU CONTRÔLE (26/09, « commence par les contrôles de balle »). MESURÉ en match (atelier, 43 contrôles au sol,
// os du pied rendu ↔ ballon rendu sur 0,35 s après la prise) : dans 27 cas l'AUTRE pied passait plus près du ballon que celui qui
// jouait le geste — le joueur levait la jambe du côté vide. Deux causes : l'événement de contrôle de la sim porte le pied FORT du joueur
// (p.foot), pas le pied du côté du ballon ; et le contrôle orienté prenait son pied au sens du virage seul. Et dans 19 cas la réception
// ('receive', déjà du bon côté) était aussitôt rejouée par le contrôle au mauvais pied.
// Ici, au rendu seul (la sim ne bouge pas) : un contrôle au SOL se joue du pied du côté où le ballon se trouve par rapport au corps ;
// le pied fort ne décide que si le ballon arrive dans l'axe (|lat| < AXE). Le contrôle orienté garde son intérieur quand le virage
// part À L'OPPOSÉ du ballon (l'intérieur le fait traverser devant soi) ; quand le virage part DU CÔTÉ du ballon, c'est l'extérieur du
// même pied qui l'emmène (controleExterieur) — plus la jambe croisée devant l'autre. ?pied-libre : hier.

import * as THREE from 'three/webgpu';

const AXE = 0.06, HAUT = 0.55, _v = new THREE.Vector3();

/** Le côté du ballon par rapport au corps (convention de la scène : lat > 0 = à gauche). Lu sur le corps RENDU quand il existe : autour
 *  de la prise, le corps affiché n'a ni la position ni le lacet du corps sim (le décalage de contact le tire vers le ballon, le lacet
 *  rendu suit à sa vitesse) — mesuré : ballon « à gauche » pour la sim (lat 0,48) et à 0,19 m du pied DROIT rendu, 0,55 m du gauche.
 *  Repère du modèle Mixamo : la gauche du joueur est −x local. */
export function latBallon(st, q, pl, ballObj) {
  if (pl?.model && ballObj?.getWorldPosition) { pl.model.updateMatrixWorld(true); ballObj.getWorldPosition(_v); pl.model.worldToLocal(_v); return -_v.x; }
  const b = st.ball.p; return (b[0] - q.p[0]) * Math.sin(q.yaw) - (b[2] - q.p[2]) * Math.cos(q.yaw);
}

/** L'événement de geste x (déjà résolu : orienté, ramassage…) corrigé pour que le pied qui joue soit celui du ballon. */
export function piedDuControle(scene, pl, x) {
  if (scene._piedLibre || !x || x.move === 'ramassage' || x.tech === 'prise-gardien' || pl.sim.keeper && x.tech?.startsWith('prise')) return x;
  const st = scene.state; if (st.ball.p[1] > HAUT) return x;
  const lat = latBallon(st, pl.sim, pl, scene.ball), cote = Math.abs(lat) < AXE ? null : lat > 0 ? 'left' : 'right';
  const y = !cote || x.foot === cote ? x : x.move === 'controleOriente' ? { ...x, move: 'controleExterieur', foot: cote } : { ...x, foot: cote };
  // LE PIED DU GESTE EST CELUI QUI VA AU BALLON. Mesuré (même match, mêmes 22 contrôles au sol, avec / sans ce module) : le warp de touche
  // (rondo-touche) prend le pied LIBRE le plus proche, sans savoir quelle jambe joue le clip — dans 12 cas sur 22 la jambe du geste
  // s'ouvrait dans le vide pendant que l'autre était tirée au ballon ; le seul choix du côté n'en corrigeait que 2. Le warp lit le pied
  // nommé par le GESTE (_gestePied, prioritaire — le canal de la foulée, _touchFootPlan, est remis à zéro à chaque image hors conduite),
  // centré sur la fenêtre de la touche (0,3 s) ; sauf quand la foulée, qui tourne sous le geste, le tient EN APPUI (le warp garde alors le
  // pied libre). Mesuré : cohérence geste ↔ pied au ballon 10/22 → 26/35. Forcer aussi le pied en appui (arbitre visuel, 150 s, même
  // match) faisait GLISSER l'appui — glisses du porteur à la touche 4 → 35 % des images — et choisir l'autre pied quand l'appui est
  // déclaré à la prise n'y changeait rien (25/35 : l'appui change deux fois en 0,3 s). Dette : la foulée devrait lever la jambe du geste.
  if (y.foot === 'left' || y.foot === 'right') { pl._gestePied = y.foot; pl._gestePiedT = scene._t + 0.15; }
  return y;
}
