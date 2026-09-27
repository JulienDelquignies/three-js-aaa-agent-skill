// rondo-pied.js — LE GESTE ET LE PIED DU CONTRÔLE, au rendu (la sim ne bouge pas ; ?pied-libre : hier ; ?controles-hier : les espèces
// d'hier, seul le pied corrigé).
// (26/09, « commence par les contrôles de balle ») MESURÉ en match (atelier, os du pied rendu ↔ ballon rendu) : le geste prenait le
// pied FORT porté par l'événement sim (p.foot), le contrôle orienté son pied au sens du virage seul, jamais le côté du ballon ; et le
// warp de touche (rondo-touche) amenait au ballon le pied LIBRE le plus proche sans savoir quelle jambe jouait le clip.
// (26/09, « les positions de réception ne sont jamais les mêmes ») : l'espèce elle-même se choisit sur la SITUATION décrite dans le
// repère du corps rendu — hauteur et vitesse du ballon avant la prise, d'où il arrive, la course du receveur, l'adversaire le plus
// proche, le virage voulu — par engine/controle-situation.js (générique). Les techniques que la sim NOMME pour de bon (semelle, prise
// du gardien) restent les siennes.

import * as THREE from 'three/webgpu';
import { choisirControle } from '../engine/controle-situation.js';

const HAUT = 0.55, _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _b = new THREE.Vector3();
const NOMMEES = /^(controle-semelle|arret-semelle|quart-de-touche|prise-gardien)$/;

/** Le côté d'un point monde par rapport au corps RENDU (> 0 = à gauche). Autour de la prise le corps affiché n'a ni la position ni le
 *  lacet du corps sim — mesuré : ballon « à gauche » pour la sim (lat 0,48), à 0,19 m du pied DROIT rendu. Mixamo : gauche = −x local. */
function latRendu(pl, x, y, z) { _v.set(x, y, z); pl.model.worldToLocal(_v); return -_v.x; }

/** La situation de la prise, dans le repère du corps rendu (voir controle-situation.js). */
export function situationPrise(scene, pl) {
  const st = scene.state, s = pl.sim, b = st.ball.p, v = scene._bvAvant ?? st.ball.v;
  pl.model.updateMatrixWorld(true);
  if (scene.ball?.getWorldPosition) scene.ball.getWorldPosition(_b); else _b.set(b[0], b[1], b[2]);
  const vb = Math.hypot(v[0], v[2]);
  let arrivee = null;
  if (vb > 0.5) { pl.model.getWorldQuaternion(_q); _v.set(-v[0] / vb, 0, -v[2] / vb).applyQuaternion(_q.invert()); arrivee = Math.acos(Math.max(-1, Math.min(1, -_v.z))) * 180 / Math.PI; }   // d'où vient le ballon, contre l'avant du corps (−z local)
  let adv = null, pa = null;
  for (const q of st.players) { if (q.team === s.team || q.keeper || (q.down ?? 0) > 0) continue; const d = Math.hypot(q.p[0] - s.p[0], q.p[2] - s.p[2]); if (adv == null || d < adv) { adv = d; pa = q.p; } }
  const lat = latRendu(pl, _b.x, _b.y, _b.z);
  const advLat = pa ? latRendu(pl, pa[0] + pl.model.position.x - s.p[0], 0, pa[2] + pl.model.position.z - s.p[2]) : null;
  const virage = s.yawWant != null ? Math.atan2(Math.sin(s.yawWant - s.yaw), Math.cos(s.yawWant - s.yaw)) * 180 / Math.PI : null;
  return { h: b[1], vb, arrivee, lat, vr: Math.hypot(s.v[0], s.v[1]), adv, advLat, virage };
}

/** L'événement de geste x (déjà résolu par la scène : orienté, ramassage…) → le geste de la situation, joué du bon pied. */
export function piedDuControle(scene, pl, x) {
  if (x?.tech === 'amorti-tete' && !scene._aerienHier) { if (pl.gestureLayer?.active) return null; pl._ctlT = scene._t; return x; }   // (347) l'amorti de la tête s'est armé (windup amortiTete) : il ne se rejoue pas au contact
  if (!scene._controlesHier && !scene._piedLibre && x && x.tech !== 'prise-gardien' && !pl.sim.keeper && pl._ctlT != null && scene._t - pl._ctlT < 0.3 && pl.gestureLayer?.active) return null;   // (voir plus bas : un contrôle, un geste — les techniques nommées aussi)
  if (scene._piedLibre || !x || x.move === 'ramassage' || NOMMEES.test(x.tech ?? '') || pl.sim.keeper) { if (x && !pl.sim.keeper && x.tech !== 'prise-gardien') pl._ctlT = scene._t; return x; }
  // (26/09) UN CONTRÔLE, UN GESTE : la réception ('receive') et le contrôle ('control') arrivent sur deux images — le second relançait le
  // geste, parfois de l'autre pied (mesuré : 4 des 11 gestes coupés en 40 s, « controlePivot-gauche → controlePivot »). Dans les 0,3 s
  // d'un contrôle lancé, le suivant ne rejoue rien (null : _playTech l'ignore). ?controles-hier : hier.
  if (!scene._controlesHier && pl._ctlT != null && scene._t - pl._ctlT < 0.3 && pl.gestureLayer?.active) return null;
  let y = x;
  if (!scene._controlesHier) {
    const sit = situationPrise(scene, pl), c = choisirControle(sit, scene._aerienHier ? { poitrine: 0.9, tete: 99 } : {});   /* (347) ?aerien-hier : les seuils d'hier */
    y = { ...x, move: c.move, foot: c.foot ?? (/^(left|right)$/.test(x.foot ?? '') ? x.foot : sit.lat > 0 ? 'left' : 'right'), situation: c.pourquoi };
    (scene._controles ??= {})[c.pourquoi] = (scene._controles[c.pourquoi] ?? 0) + 1;   // le relevé (atelier, bancs)
    const L = (scene._controlesLog ??= []); if (L.length < 400) L.push({ ...sit, tech: x.tech ?? x.type, move: c.move, foot: y.foot });
  } else if (scene.state.ball.p[1] <= HAUT) {   // les espèces d'hier, le pied du côté du ballon
    pl.model.updateMatrixWorld(true); scene.ball.getWorldPosition(_b);
    const lat = latRendu(pl, _b.x, _b.y, _b.z), cote = Math.abs(lat) < 0.06 ? null : lat > 0 ? 'left' : 'right';
    if (cote && x.foot !== cote) y = x.move === 'controleOriente' ? { ...x, move: 'controleExterieur', foot: cote } : { ...x, foot: cote };
  }
  // LE PIED DU GESTE EST CELUI QUI VA AU BALLON : le warp de touche (rondo-touche) et la fente lisent _gestePied, prioritaire sur le
  // pied libre le plus proche, sauf si la foulée le tient EN APPUI. Mesuré (même match, mêmes 22 contrôles au sol) : jambe du geste
  // dans le vide pendant que l'autre va au ballon 12 → 6. Rejeté (mesuré) : forcer le pied en appui (glisses du porteur à la touche
  // 4 → 35 % des images) ; prendre l'autre pied quand l'appui est déclaré à la prise (aucun gain : l'appui change deux fois en 0,3 s).
  if (y.foot === 'left' || y.foot === 'right') { pl._gestePied = y.foot; pl._gestePiedT = scene._t + 0.15; }
  pl._ctlT = scene._t;
  return y;
}
