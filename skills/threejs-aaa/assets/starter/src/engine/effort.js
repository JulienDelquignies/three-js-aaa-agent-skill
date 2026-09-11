// effort.js — L'INTENTION D'EFFORT AU CERVEAU (261, cfg.effort && st.full — le transversal n° 2 de la carte du book : Modèle 02
// §3.5 « la capacité n'est pas le comportement », Bible 10 §4.3 les trois régimes du coulissement, Bible 16 « le contexte change
// le seuil de déclenchement, pas la capacité », Référentiel 05 §3 l'histogramme des zones de vitesse). Le 260 a donné au corps un
// profil qui FREINE le volume ; le volume restant est COMMANDÉ par les métiers — sondé à HEAD : 46 % de la distance dans la bande
// course 12-19,8 km/h (réel 30 %), 7,8 % en marche (réel 30 %) : chaque suiveur de bloc trottait vers un slot qui frémit à chaque
// image ; le presseur élu courait à sa pointe depuis 30 m ; l'appel se tirait à 24 m du ballon, 107 fois par joueur et par match.
// Une INTENTION porte sa vitesse voulue et son effort ε — c'est la SITUATION qui commande, pas la table des métiers :
//  (1) LES TROIS RÉGIMES DU SUIVEUR (support / mark / cover — Bible 10 §4.3) : sondé, les slots sont IMMOBILES 64-89 % des
//      images et SAUTENT à la passe (le bloc coulisse par pas) ; le corps, à 6-11 m de son slot, le poursuivait sans jamais
//      l'atteindre. Le SAUT du slot (≥ saut m d'un coup) déclenche le COULISSEMENT ACTIF (vActif, epsActif) pour actifDur s
//      (× workF ; le marqueur × axe marquage 0,7…1,3) ou jusqu'à l'arrivée (tolOff) ; le reste du temps on ENTRETIENT : on
//      suit son slot à SA vitesse (× 1,15 + 0,4), plancher vEnt avec le ballon (la MARCHE — pas le trot d'hier, 2,1 m/s = le
//      jogging du Référentiel) et vEntDef sans lui (la marche rapide du bloc, Bible 10 : 1,8-2,6) ; quand l'intention parle,
//      l'économie de course d'hier (allure) se tait — son plancher interdisait la marche ET son plafond le coulissement ; au-delà de gRecup, en transition défensive près du ballon (rayonTrans), dans la fenêtre de pressing des
//      miens ou à moins de chaud m du ballon, on RÉCUPÈRE : le plafond du métier, la course entière — l'urgence reste l'urgence.
//  (2) LE RAYON D'ATTEIGNABILITÉ DU PRESSEUR (Modèle 02 : « le rayon de pressing devient un rayon d'atteignabilité ») : hors
//      fenêtre collective et hors rupture, le presseur dont la cible est à plus de tAtt s de course (etaCourse) FERME l'espace au
//      régime actif — il ne sprinte que ce qu'il peut atteindre ; la chasse (burst) reste une chasse.
//  (3) L'APPEL PERTINENT : la rupture d'appel d'un soutien ne se tire qu'à portée de passe du porteur (appelPortee) — le soutien
//      du côté opposé ne claque pas 3 m tous les 8 s pour personne (le book : le contexte module le SEUIL, pas la pointe).
// Les AXES : pressing × tAtt (0,7…1,3 — l'école de la chasse accepte la longue course), marquage × la tolérance du marqueur
// (1,3…0,7 — l'homme à homme ne lâche pas son slot), transition × rayonTrans (0,6…1,4) ; le RÔLE : press × tAtt (0,8…1,2) ; les
// ATTRIBUTS : workRate → tAtt × workF, tolérance × (2 − workF) (le travailleur chasse de plus loin et tient son slot de plus
// près) — identité exacte à 50, au polyvalent et à l'équilibre. Le score ne branche RIEN ici : le coach déplace les axes (Bible
// 16). Le corps garde le dernier mot (locomoteur : ε lu depuis p._effort). Clé absente : l'hier au bit.
import { hyp } from './hyp.js';
import { tac, axe } from './tactics.js';
import { role } from './roles.js';
import { etaCourse } from './ball-predict.js';
import { momentDuJeu } from './phases.js';

/** La durée du pas de coulissement (s) : le travailleur glisse plus longtemps, le marqueur d'homme selon l'axe marquage. Pure. */
export function pasDe(p, st, K) {
  return (K.actifDur ?? 2.5) * (p.skill?.workF ?? 1) * (p.job === 'mark' ? axe(tac(st, p.team).marquage, 0.7, 1.3) : 1);
}

/** L'horizon d'atteignabilité du presseur (s) : la tactique, le rôle et la note composent sur l'identité. Pure. */
export function horizonDe(p, st, K) {
  return (K.tAtt ?? 2.5) * axe(tac(st, p.team).pressing, 0.7, 1.3) * axe(role(p).press, 0.8, 1.2) * (p.skill?.workF ?? 1);
}

/** L'intention du corps pour cette image : null = le plafond du métier (la course entière), sinon { v, eps, reg }.
 *  Écrit p._reg (le régime, pour la mesure), p._efT (le slot d'hier) et p._efAct (la fin du pas de coulissement). */
export function intentionDe(p, st, cfg, K, bursting) {
  if (p.keeper || p.down > 0 || st.restart || !p.target) { p._reg = null; return null; }
  if (bursting) {   // (4) LE REPLI EST UN SPRINT DE TRANSITION : passé repliSprint s depuis la perte, celui qui rentre encore RÉCUPÈRE (vRecup — Bible 10 : le recul de récupération 4-6 m/s), il ne sprinte plus (sondé : 138 sprints de repli par joueur et par match, 55 % de la haute intensité, la moitié en défense placée)
    p._reg = null;
    return p._pace?.kind === 'repli' && st.t - (st._possChangeAt ?? -99) > (K.repliSprint ?? 5) ? { v: K.vRecup ?? 5.0, eps: K.epsRecup ?? 0.7, reg: 'rentre' } : null;
  }
  const dB = hyp(p.p[0] - st.ball.p[0], p.p[2] - st.ball.p[2]);
  const enPress = !!(st._press && st._press.until > st.t && st._press.team === p.team);
  if (p.job === 'press') {
    p._reg = null;
    if (enPress) return null;
    const eta = etaCourse(p.p, p.v, p.target, { accel: (cfg.accel ?? 7.5) * (p.skill?.accelF ?? 1), top: (cfg.speeds?.chase ?? 6.4) * (p.skill?.topF ?? 1) });
    return eta > horizonDe(p, st, K) ? { v: K.vActif ?? 4.2, eps: K.epsActif ?? 0.6, reg: 'ferme' } : null;
  }
  if (p.job !== 'support' && p.job !== 'mark' && p.job !== 'cover') { p._reg = null; return null; }
  // le slot d'hier : sa vitesse (il suit un homme, le bloc respire) ou son SAUT (le bloc coulisse par pas)
  const pv = p._efT; let tSpd = 0;
  if (pv && pv.t < st.t) { const d = hyp(p.target[0] - pv.x, p.target[2] - pv.z); tSpd = d / (st.t - pv.t); if (tSpd > (K.sautV ?? 9)) { tSpd = 0; if (d >= (K.saut ?? 3)) p._efAct = st.t + pasDe(p, st, K); } }
  p._efT = { x: p.target[0], z: p.target[2], t: st.t };
  const g = hyp(p.target[0] - p.p[0], p.target[2] - p.p[2]);
  if (enPress) { p._reg = 'recup-press'; return null; }
  if (dB < (K.chaud ?? 10)) { p._reg = 'recup-chaud'; return null; }
  if (g > (K.gRecup ?? 12)) { p._reg = 'recup-loin'; return null; }
  if (momentDuJeu(st, p.team, K.fenetre ?? 5) === 'transition-def' && dB < (K.rayonTrans ?? 20) * axe(tac(st, p.team).transition, 0.6, 1.4)) { p._reg = 'recup-trans'; return null; }
  if ((p._efAct ?? -1) > st.t && g > (K.tolOff ?? 1.2)) { p._reg = 'actif'; return { v: K.vActif ?? 4.2, eps: K.epsActif ?? 0.6, reg: 'actif' }; }
  p._reg = 'ent';
  const vEnt = st.possession?.team === p.team ? (K.vEnt ?? 1.4) : (K.vEntDef ?? K.vEnt ?? 1.4);   // l'entretien du bloc SANS ballon est une marche rapide (Bible 10 : 1,8-2,6 m/s), celui du soutien AVEC ballon une marche
  return { v: Math.max(vEnt, Math.min(K.vActif ?? 4.2, tSpd * 1.15 + 0.4)), eps: K.epsEnt ?? 0.45, reg: 'ent' };
}

/** L'appel d'un soutien est pertinent à portée de passe du ballon. Pure. */
export function appelPertinent(p, st, K) {
  return hyp(p.p[0] - st.ball.p[0], p.p[2] - st.ball.p[2]) < (K.appelPortee ?? 22);
}
