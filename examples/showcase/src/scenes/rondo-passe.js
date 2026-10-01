// rondo-passe.js — LA PASSE SELON LA SITUATION, au rendu (26/09 : « améliore les passes en une touche et les passes normales — ajoute
// plein d'animations pour répondre à toutes les situations »). La sim arme la passe (le geste parent : passe, passeRapide, deviation —
// sa durée et son contact sont ceux de la frappe sim) ; la scène joue la VARIANTE de situation du même parent (motion-strike,
// VARIANTES_PASSE — même durée, même contact : le pied reste au ballon). Recensement (2 matchs, 1 106 passes) : 51 % à ≥ 70° du regard,
// 43 % en course, 24 % adversaire collé, 12 % levées, 50 % tendues, 8 % en une touche. La situation se lit sur le CORPS RENDU :
//   levee     la passe levée (style lofted) ;
//   protegee  l'adversaire à < 1,5 m ;
//   ouverte   la cible à 50-135° du regard, du côté où l'intérieur du pied l'envoie (pied droit : à gauche) ;
//   exterieur la cible à 40-120° du côté NON naturel : l'extérieur du pied (A-387 ; la passe pressée garde son geste : pas de variante sous contrat) ;
//   course    le passeur lancé (≥ 3 m/s) ;
//   tendue    la passe tendue (driven) de ≥ 18 m ;
// sinon le parent. ?passes-hier : le parent toujours.
import * as THREE from 'three/webgpu';
import { byId as TECHNIQUES_BY_ID } from '../engine/technique.js';
import { KINDS } from '../engine/motion-strike.js';

const PARENTS = new Set(['passe', 'passeRapide', 'deviation']), _v = new THREE.Vector3();

/** Le côté (> 0 : à gauche) et l'avant (> 0) d'un point monde dans le repère du corps rendu (Mixamo : gauche = −x, avant = −z). */
function repere(pl, x, z) { _v.set(x, pl.model.position.y, z); pl.model.worldToLocal(_v); return [-_v.x, -_v.z]; }

/** La situation d'une passe armée (pure lecture). */
export function situationPasse(scene, pl, e) {
  const st = scene.state, s = pl.sim, pay = s.act?.payload, ch = pay?.choice ?? pay;
  const L = ch?.lead ?? pay?.target ?? null, tx = L ? L[0] : null, tz = L ? (L.length > 2 ? L[2] : L[1]) : null;
  let dir = null, dist = null;
  if (tx != null && Number.isFinite(tx) && Number.isFinite(tz)) { pl.model.updateMatrixWorld(true); const [lat, av] = repere(pl, tx, tz); dir = Math.atan2(lat, av) * 180 / Math.PI; dist = Math.hypot(tx - s.p[0], tz - s.p[2]); }
  let adv = null; for (const q of st.players) { if (q.team === s.team || q.keeper || (q.down ?? 0) > 0) continue; const d = Math.hypot(q.p[0] - s.p[0], q.p[2] - s.p[2]); if (adv == null || d < adv) adv = d; }
  return { style: ch?.style ?? e.style ?? null, dir, dist, vr: Math.hypot(s.v[0], s.v[1]), adv, foot: e.foot === 'left' ? 'left' : 'right' };
}

/** La variante (nom de geste) pour un parent et une situation — rend le parent si aucune ne s'applique. */
export function varianteDe(parent, sit) {
  const ok = (v) => KINDS[`${parent}_${v}`] ? `${parent}_${v}` : null;
  const naturel = sit.dir != null && (sit.foot === 'right' ? sit.dir > 0 : sit.dir < 0), ang = sit.dir == null ? 0 : Math.abs(sit.dir);
  if (sit.style === 'lofted') { const v = ok('levee'); if (v) return v; }
  if (sit.adv != null && sit.adv < 1.5) { const v = ok('protegee'); if (v) return v; }
  if (naturel && ang >= 50 && ang <= 135) { const v = ok('ouverte'); if (v) return v; }
  if (!naturel && sit.dir != null && ang >= 40 && ang <= 120) { const v = ok('exterieur'); if (v) return v; }   // (A-387) le côté NON naturel : l'extérieur du pied (hier la passe de face, 50 % des passes latérales)
  if (sit.vr >= 3) { const v = ok('course'); if (v) return v; }
  if (sit.style === 'driven' && (sit.dist ?? 0) >= 18) { const v = ok('tendue'); if (v) return v; }
  return parent;
}

/** L'événement d'armé → le même, joué avec la variante de situation. */
export function passeDeSituation(scene, pl, e) {
  if (scene._passesHier || !pl || !e) return e;
  const parent = e.move || (e.tech && TECHNIQUES_BY_ID[e.tech]?.clip);
  if (!PARENTS.has(parent)) return e;
  const sit = situationPasse(scene, pl, e), move = varianteDe(parent, sit);
  (scene._passes ??= {})[move] = (scene._passes[move] ?? 0) + 1;
  return move === parent ? e : { ...e, move };
}
