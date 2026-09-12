// reception.js — LA PASSE QUI SE MANQUE À LA BONNE DISTANCE (265, cfg.passe && st.full — la carte du book : Modèle 09 lot 1,
// Modèle 07 lot 2, Modèle 03 §5.2 et §8.1). Sondé à HEAD (2 × 45 min) : 39 % des passes n'atteignent JAMAIS leur receveur,
// et le gradient est INVERSÉ — la courte de 5-15 yd est reçue 68 % (réel 88-92), la longue de 30+ 63 % (réel 55-65) ; la
// courte se perd à l'ARRIVÉE (interceptée 20 %, contestée 17 % avec un presseur à 3,4 m) parce que la réception n'avait pas
// de FENÊTRE : le porté était contestable à l'image même du contrôle ; et la dispersion du geste (σ 3,25° à 50) valait deux
// fois la base du book. Deux lois, une clé :
//  (1) LA RÉCEPTION À QUATRE ISSUES (Modèle 09 §6.1, Modèle 03 §8.1) — la distance de fuite du premier contact d_touch =
//      d0 (v_rel/10)^0,8 (1 + 0,5 P) χ_aérien ÷ controlF (le bon contrôleur la raccourcit ; v_rel RELATIVE ballon-joueur :
//      recevoir en courant dans le sens du ballon est plus facile), la pression P = 1 − TTP/pressT du presseur le plus
//      proche (son temps d'arrivée, etaCourse — pas une distance) ; MANQUÉ au tirage de Weibull p = 1 − e^{−(d/dLoss)^κ}
//      (2,6 % au cas nominal, 2-4 % en mélange — la forme exponentielle rejetée par le book donnait 31 %) : ballon libre ;
//      CONTESTÉ si le presseur arrive avant la fin du contrôle (TTP < t_ctrl) : un 50/50 pesé par la force (chargeF) ;
//      PROPRE (d < dHeavy) : le receveur POSSÈDE et le ballon est SIEN pendant tClean (p._protege — le porté n'est plus
//      contestable à l'image même) ; LOURDE (d ≥ dHeavy) : la touche part à 1-2 m, contestable — la matière du contre-pressing.
//  (2) L'ERREUR DE GESTE PAR CLASSE ET DISTANCE (Modèle 09 §4.2-4.3, Modèle 03 §5.2) — σ_ψ = sigma0 (1,4°) × la note (passSigma
//      ÷ sa valeur à 50 : le facteur, identité 1) × m_c (courte 0,8 / moyenne 1,0 / longue, piquée, renversement 1,3 / centre,
//      cloche 1,7) × (1 + κ_P P) avec κ_P × composureF (le sang-froid encaisse la pression) × (1 + 0,012 (d − 12)⁺) ; et le
//      SOUS-DOSAGE : la vitesse × e^{μ_v + μ_P P + σ_v ξ} (un bruit centré fait autant de passes trop longues que trop
//      courtes — c'est faux et ça se voit : les passes ratées sous pression sont trop courtes).
// Les attributs : control (d_touch), strength (le 50/50), passing (σ), composure (la pression) — identité à 50. Clé
// absente : le contrôle manqué au-dessus de 10 m/s et la dispersion d'hier au bit. Ce que le lot nomme : l'interception
// PROBABILISTE en vol (Modèle 07 §4 : la logistique σ 0,45 s, λ 4,3, la croyance du défenseur), le cône de ±40° du
// ballon fou, l'issue lourde qui pousse vraiment le ballon à d_touch.
import { hyp } from './hyp.js';
import { etaCourse } from './ball-predict.js';

/** La pression sur un corps à l'instant : le temps d'arrivée du presseur le plus proche (s) et P ∈ [0 ; 1]. Pure. */
export function pressionDe(st, p, K, cfg, cible = null) {
  let ttp = 99; const cx = cible ? cible[0] : p.p[0], cz = cible ? cible[2] : p.p[2];
  for (const q of st.players) {
    if (q.team === p.team || q.keeper || q.down > 0 || q.expulse || q._sub) continue;
    let t = etaCourse(q.p, q.v, [cx, 0, cz], { accel: (cfg.accel ?? 7.5) * (q.skill?.accelF ?? 1), top: (cfg.speeds?.chase ?? 6.4) * (q.skill?.topF ?? 1) });
    // LE CORPS PROTÈGE (Modèle 11) : le presseur de l'autre côté du receveur (le ballon entre eux deux, lui derrière) contourne — il paie contourne s
    if (cible && (cx - p.p[0]) * (q.p[0] - p.p[0]) + (cz - p.p[2]) * (q.p[2] - p.p[2]) < 0) t += K.contourne ?? 0.35;
    if (t < ttp) ttp = t;
  }
  return { ttp, P: Math.max(0, Math.min(1, 1 - ttp / (K.pressT ?? 1.5))) };
}

/** La distance de fuite du premier contact (m). Pure. */
export function toucheDe(vRel, P, p, aerien, K) {
  return (K.d0 ?? 0.85) * Math.pow(Math.max(0, vRel) / 10, 0.8) * (1 + 0.5 * P) * (aerien ? (K.chiAer ?? 1.55) : 1) / (p.skill?.controlF ?? 1);
}

/** La probabilité de perdre le contrôle : Weibull sur d_touch (le book rejette l'exponentielle). Pure. */
export function pFailDe(dTouch, K) { return 1 - Math.exp(-Math.pow(dTouch / (K.dLoss ?? 2.8), K.kappa ?? 3)); }

/** Le budget du contrôle (s) selon la touche : propre tClean, lourde de tHeavyMin à tHeavyMax. Pure. */
export function budgetDe(dTouch, K) {
  const dH = K.dHeavy ?? 0.9, dM = K.dHeavyMax ?? 2.0;
  if (dTouch < dH) return K.tClean ?? 0.25;
  const u = Math.min(1, (dTouch - dH) / Math.max(1e-6, dM - dH));
  return (K.tHeavyMin ?? 0.55) + u * ((K.tHeavyMax ?? 0.8) - (K.tHeavyMin ?? 0.55));
}

/** L'issue de la réception de p (le ballon arrive à v_ball) : { issue, dTouch, P, ttp, pFail, protege }. rnd : le flux passe. */
export function issueDe(st, p, K, cfg, rnd) {
  const vRel = hyp(st.ball.v[0] - p.v[0], st.ball.v[2] - p.v[1]);
  const { ttp, P } = pressionDe(st, p, K, cfg, st.ball.p);   // la pression se mesure au BALLON, le corps du receveur entre le presseur et lui
  const dTouch = toucheDe(vRel, P, p, st.ball.p[1] > (K.hAer ?? 0.6), K), pFail = pFailDe(dTouch, K), tCtrl = budgetDe(dTouch, K);
  if (rnd() < pFail) return { issue: 'manque', dTouch, P, ttp, pFail, protege: 0 };
  if (ttp < tCtrl) {
    let foe = null, dm = 99; for (const q of st.players) if (q.team !== p.team && !q.keeper && q.down <= 0) { const d = hyp(q.p[0] - p.p[0], q.p[2] - p.p[2]); if (d < dm) { dm = d; foe = q; } }
    const edge = Math.max(-0.35, Math.min(0.35, ((p.skill?.chargeF ?? 1) - (foe?.skill?.chargeF ?? 1)) * 0.5 * (K.edgeF ?? 1)));
    return rnd() < 0.5 + edge ? { issue: 'conteste-gagne', dTouch, P, ttp, pFail, protege: K.tClean ?? 0.25 } : { issue: 'conteste-perdu', dTouch, P, ttp, pFail, protege: 0 };
  }
  return dTouch < (K.dHeavy ?? 0.9) ? { issue: 'propre', dTouch, P, ttp, pFail, protege: K.tClean ?? 0.25 } : { issue: 'lourde', dTouch, P, ttp, pFail, protege: 0 };
}

/** La classe de la passe pour le multiplicateur de σ (Modèle 09 §4.2). Pure. */
export function classeDe(choice, dP, K) {
  if (choice.cross || choice.style === 'chip') return K.mcCentre ?? 1.7;
  if (choice.through || choice.style === 'lofted' || dP > (K.dLong ?? 25)) return K.mcLong ?? 1.3;
  return dP < (K.dCourt ?? 12) ? (K.mcCourt ?? 0.8) : 1;
}

/** σ_ψ (rad) de la passe : base × note × classe × pression × distance. Pure. */
export function sigmaPasse(c, choice, dP, P, K, sigma50) {
  const note = c.skill?.passSigma != null ? c.skill.passSigma / sigma50 : 1;
  return (K.sigma0 ?? 1.4) * Math.PI / 180 * note * classeDe(choice, dP, K) * (1 + (K.kappaP ?? 1.2) * (c.skill?.composureF ?? 1) * P) * (1 + (K.fDist ?? 0.012) * Math.max(0, dP - (K.dRef ?? 12)));
}
