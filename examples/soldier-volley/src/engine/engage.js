// engage.js — LA TOUCHE QUI ENGAGE (286, cfg.toucheEngage && st.full — retour du 17/09 : « trop de mauvais contrôles où le ballon
// reste dans les pieds du joueur qui s'emmêle et doit faire demi-tour pour le récupérer »). Mesuré avant (sonde-286, 4 × 90 min) :
// 30 % des contrôles en course et 38 % des contrôles posés sont suivis d'un DEMI-TOUR de plus de 120° dans les 2 s — un tiers de ces
// demi-tours tournent VERS SON PROPRE BUT, un tiers se font le ballon soudé au pied (le corps pivote sur le ballon : l'œil lit « il
// s'emmêle »), un tiers finissent sans action (le ballon parti). Le book : Modèle 09 §6.2 (l'orientation à la réception — le
// receveur reçoit demi-tourné, il ne se retourne pas après), ch. 8 §6 (l'ENGAGEMENT : une décision prise tient son T_commit, on ne
// change pas d'avis pendant l'acte). Ici, après un contrôle, tant que le porteur n'est pas pressé (aucun adversaire à < presse m),
// pendant commit × (2 − decF) × axe(tempo, lent, vif) s : une passe à plus de angle° de son regard coûte malus au barème (la passe
// dans le dos attend une touche), et la conduite garde son cap (la poussée se rabat à ± angle du regard) — une touche vers l'avant
// d'abord, le demi-tour se fait après, ou sous la pression (le pressé a le droit de se retourner tout de suite : c'est son salut).
// Attributs en facteurs : decisions (le bon décideur engage court — il a décidé avant de recevoir) ; tactique : l'axe tempo (le
// direct engage court), 0,5 identité ; le 50 vaut 1. Clé absente : le pivot d'hier au bit.
import { axe } from './tactics.js';

/** La fenêtre d'engagement (s) : commit × (2 − decF) × axe(tempo, lent, vif). Pure. */
export function fenetreDe(K, x = {}) { return (K.commit ?? 0.5) * (2 - (x.decF ?? 1)) * axe(x.tempo ?? 0.5, K.lent ?? 1.2, K.vif ?? 0.8); }

/** L'engagement d'un porteur à dt s de son contrôle : { actif, fenetre } — actif si dt est dans la fenêtre et que personne ne presse. Pure. */
export function engageDe(K, x = {}) {
  const fenetre = fenetreDe(K, x);
  return { actif: x.dt != null && x.dt >= 0 && x.dt < fenetre && !(x.foe != null && x.foe < (K.presse ?? 2.5)), fenetre };
}

/** L'écart (rad, ≥ 0) entre une direction [dx, dz] et le regard yaw. Pure. */
export function ecartDe(dx, dz, yaw) { const a = Math.atan2(dz, dx) - yaw; return Math.abs(Math.atan2(Math.sin(a), Math.cos(a))); }

/** Le malus au barème d'une passe à plus de angle° du regard pendant l'engagement. Pure. */
export function malusDe(K, actif, dev) { return actif && dev > (K.angle ?? 100) * Math.PI / 180 ? (K.malus ?? 8) : 0; }

/** La poussée rabattue à ± angle du regard (vecteur unitaire) — le cap de conduite pendant l'engagement. Pure. */
export function rabatDe(push, yaw, angleDeg) {
  const a = Math.atan2(push[1], push[0]), d = Math.atan2(Math.sin(a - yaw), Math.cos(a - yaw)), lim = angleDeg * Math.PI / 180;
  if (Math.abs(d) <= lim) return push;
  const b = yaw + Math.sign(d) * lim; return [Math.cos(b), Math.sin(b)];
}
