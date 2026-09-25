// LA SÉLECTION CALIBRÉE DU PASSEUR (267, cfg.selection && st.full — Modèle 09 lot 2, tests 2 et 9 ; Modèle 07 §4-5).
// Hier le barème de choosePass jugeait la passe en MÈTRES (le couloir, la liberté du receveur, la distance) sans jamais
// nommer sa PROBABILITÉ : le même score pour un couloir de 2 m à 8 m et à 30 m, une dette d'ordre (la tranche 15-30 yd
// à 71-75 %, réel 82-87, dans tous les mondes du 266). La loi : (1) LA CLASSE NOMMÉE — la passe est un type somme (douze
// classes du book, chacune sa cible de complétion) ; (2) P_succ PRÉDIT par la factorisation physique du book, avec ce
// que le moteur possède déjà : P_rel (la sortie de balle sous la pression du porteur) × S (la survie du ballon en vol —
// le processus de risque de Spearman : par défenseur, la logistique σ du temps d'arrivée à la plus courte approche et le
// taux de prise λ sur une fenêtre, niveau I-B) × PPCF_r (la compétition terminale au point de chute, l'avantage du
// receveur qui est servi) × P_ctrl (le contrôle du 265 : d_touch à la vitesse d'arrivée, Weibull) ; (3) LE CALAGE
// log-odds par classe (α_c, β_c : les 24 nombres, la totalité de la triche, localisée dans cfg.selection.calage) ;
// (4) LE TERME AU BARÈME : poids × ρ × (logit P̂ − logit p0) — ρ l'aversion au risque, par la CONSIGNE (l'axe mentalité :
// défensif 1,5, offensif 0,5, identité 1) et par la note décisions (decF) ; la passe à 0,8 ne bouge pas, la sûre gagne,
// la risquée paie. (5) LE JOURNAL : l'événement pass porte cls et pSucc — la fiabilité (ECE, log-loss) se mesure.
// Clé absente : le barème d'hier au bit. Ce que le lot nomme : q̂_k (le défenseur a-t-il VU la passe — la croyance du
// passeur sur lui, 266), le softmax T_soft/decisions, ρ par rôle (le book : DC prudent 0,8, meneur offensif 0,35), la
// carte de valeur V (Modèle 06) — le barème métrique d'hier tient lieu de V.
import { hyp } from './hyp.js';
import { etaCourse } from './ball-predict.js';
import { toucheDe, pFailDe } from './reception.js';
import { tac, axe } from './tactics.js';

export const CLASSES = ['SHORT_GROUND', 'MID_GROUND', 'LONG_GROUND', 'CHANNEL', 'THROUGH', 'CHIP_THROUGH', 'SWITCH', 'CROSS', 'CUTBACK', 'LAY_OFF', 'ONE_TWO_RETURN', 'BACK_SAFE'];
export const logit = (p) => Math.log(p / (1 - p)), sig = (x) => 1 / (1 + Math.exp(-x));
const KS = Math.PI / Math.sqrt(3);

/** La classe nommée d'une passe : { cross, bas, through, derriere, chip, bascule, unDeux, remise }, d (m), dxAvant (m, signé vers le but). Pure. */
export function classeNommee(f, d, dxAvant, K = {}) {
  if (f.cross) return f.bas && dxAvant < -2 ? 'CUTBACK' : 'CROSS';
  if (f.through) return f.chip ? 'CHIP_THROUGH' : f.derriere ? 'THROUGH' : 'CHANNEL';
  if (f.bascule) return 'SWITCH';
  if (f.unDeux) return 'ONE_TWO_RETURN';
  if (f.remise) return 'LAY_OFF';
  if (dxAvant < -(K.dArriere ?? 2) && d <= (K.dSafe ?? 25)) return 'BACK_SAFE';
  return d < (K.dCourt ?? 15) ? 'SHORT_GROUND' : d <= (K.dLong ?? 28) ? 'MID_GROUND' : 'LONG_GROUND';
}

/** La survie du ballon en vol de o à l pendant T s face aux foes (I-B : plus courte approche) : { prod, max }. Pure, une allocation. */
export function survieDe(o, l, T, foesL, K, cfg) {
  const ex = l[0] - o[0], ez = l[2] - o[2], L2 = ex * ex + ez * ez || 1e-6, sg = KS / (K.sigma ?? 0.45), fen = K.fenetre ?? 0.25;
  let S = 1, lMax = 0; const dbg = K.debug ? [] : null;
  for (const q of foesL) {
    if (q.down > 0 || q.expulse || q._sub) continue;
    const u = Math.max(0, Math.min(1, ((q.p[0] - o[0]) * ex + (q.p[2] - o[2]) * ez) / L2));
    const px = o[0] + u * ex, pz = o[2] + u * ez, tauR = (K.tauR ?? 0.25) * (2 - (q.skill?.anticipF ?? 1));
    const tk = tauR + etaCourse(q.p, q.v, [px, 0, pz], { accel: (cfg.accel ?? 7.5) * (q.skill?.accelF ?? 1), top: (cfg.speeds?.chase ?? 6.4) * (q.skill?.topF ?? 1) });
    const f = sig((u * T - tk) * sg), lam = q.keeper ? (K.lambdaGk ?? 12.9) : (K.lambda ?? 4.3);
    const L = f * (1 - Math.exp(-lam * fen)); S *= 1 - L; if (L > lMax) lMax = L;
    if (dbg) dbg.push([+(u * T - tk).toFixed(3), q.keeper ? 1 : 0]);   // (K.debug — la sonde d'étalonnage de σ, λ, fenêtre sur les données du moteur, Modèle 07 test 10)
  }
  return { prod: S, max: 1 - lMax, dbg };   // prod : tous chassent (le produit de Spearman) ; max : le seul défenseur affecté (K.survie)
}

/** P_succ d'un candidat : { cls, p, pHat, S, ppcf, pCtrl, pRel }. Pc : la pression du porteur (P ∈ [0 ; 1]). Pure. */
export function pSuccDe(st, c, m, o, lead, d, style, f, foesL, K, cfg, Pc) {
  const gS = Math.sign(st.pitch.attackGoal(c.team).x || 1), aer = style === 'lofted' || style === 'chip';
  const cls = classeNommee(f, d, (lead[0] - o[0]) * gS, K), T = d / (K.vBallon ?? 9) * (aer ? (K.lentAer ?? 1.3) : 1);
  const SS = survieDe(o, lead, T, foesL, K, cfg), S = K.survie === 'prod' ? SS.prod : SS.max, Salt = K.survie === 'prod' ? SS.max : SS.prod;
  const tRec = etaCourse(m.p, m.v, lead, { accel: (cfg.accel ?? 7.5) * (m.skill?.accelF ?? 1), top: (cfg.speeds?.chase ?? 6.4) * (m.skill?.topF ?? 1) });
  let tDef = 99;
  for (const q of foesL) { if (q.keeper || q.down > 0 || q.expulse || q._sub) continue; const t = (K.tauR ?? 0.25) * (2 - (q.skill?.anticipF ?? 1)) + etaCourse(q.p, q.v, lead, { accel: (cfg.accel ?? 7.5) * (q.skill?.accelF ?? 1), top: (cfg.speeds?.chase ?? 6.4) * (q.skill?.topF ?? 1) }); if (t < tDef) tDef = t; }
  const ppcf = sig((Math.max(tDef, T) - Math.max(tRec, T) + (K.avantage ?? 0.3)) * KS / (K.sigma ?? 0.45));
  const KP = cfg.passe ?? {}, Prec = Math.max(0, Math.min(1, 1 - Math.max(0, tDef - T) / (KP.pressT ?? 1.5)));
  const pCtrl = 1 - pFailDe(toucheDe(aer ? (K.vArrAer ?? 9) : (K.vArr ?? 6.5), Prec, m, aer, KP), KP);
  const pRel = 1 - (K.bloc ?? 0.06) * Pc;
  const p = Math.max(K.pMin ?? 0.02, Math.min(K.pMax ?? 0.995, pRel * S * ppcf * pCtrl)), cal = K.calage?.[cls] ?? [0, 1];
  return { cls, p, pHat: sig(cal[0] + cal[1] * logit(p)), S, ppcf, pCtrl, pRel, pAlt: Math.max(K.pMin ?? 0.02, Math.min(K.pMax ?? 0.995, pRel * Salt * ppcf * pCtrl)), ...(SS.dbg ? { dbg: { sl: SS.dbg, tRec: +tRec.toFixed(3), tDef: +tDef.toFixed(3), T: +T.toFixed(3), pCtrl: +pCtrl.toFixed(3), pRel: +pRel.toFixed(3), aer: aer ? 1 : 0, Prec: +Prec.toFixed(3), vRel: aer ? (K.vArrAer ?? 9) : (K.vArr ?? 6.5) } } : {}) };
}

/** Le terme au barème : poids × ρ(consigne, décisions) × (logit P̂ − logit p0). Pure. */
export function termeDe(sel, c, st, K) {
  let rho = axe(tac(st, c.team).mentalite ?? 0.5, K.rhoDef ?? 1.5, K.rhoOff ?? 0.5) * (c.skill?.decF ?? 1);
  // (320) LE RISQUE A UNE ADRESSE (K.zone — le chantier des échappées, note 447) : la passe perdue devant son but coûte un but, au milieu une
  // possession — l'aversion croît vers sa ligne : ρ × (1 + gain × max(0, 1 − d_but_propre / portee)). Absente : le ρ d'hier au bit.
  if (K.zone && st.pitch) { const og = st.pitch.ownGoal(c.team), dO = hyp(og.x - c.p[0], c.p[2]); rho *= 1 + (K.zone.gain ?? 2) * Math.max(0, 1 - dO / (K.zone.portee ?? 35)); }
  return (K.poids ?? 2.5) * rho * (logit(sel.pHat) - logit(K.p0 ?? 0.8));
}
