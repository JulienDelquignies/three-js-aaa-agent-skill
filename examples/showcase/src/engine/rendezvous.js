// rendezvous.js — LA PASSE AU RENDEZ-VOUS (281, cfg.rendezVous && st.full — Modèle 09 §3.1-3.3 : « le rendez-vous est la racine
// de g(t) = ‖r(t) − p‖ − s(t) » ; §3.3 le biais de sécurité ; §6.3 recevoir en mouvement). Mesuré avant (sonde-281, 2 × 15 min,
// retour utilisateur « des passes dans le dos du receveur, des demi-tours ») : 37 % des passes reçues faisaient faire un
// DEMI-TOUR (> 120°) au receveur AVANT la réception, 74 sur 91 à un receveur EN COURSE, 69 sur 91 à un ballon parti dans son
// dos — la mène d'hier (leadTime : 0,85 × min(0,4 + d/9, 1) s de la vitesse du receveur) ne rejoignait pas le coureur au bout
// de l'armé et du vol : le ballon arrivait où il ÉTAIT, il se retournait pour le prendre. Ici le point visé est le
// RENDEZ-VOUS : la position prédite du receveur sous son plan de course (r + v × T) à la date T où le ballon y arrive — le
// point fixe T = vol(r + v T) (deux ou trois itérations, la balistique réelle du solveur, pas le germe exponentiel) —,
// puis le BIAIS DE SÉCURITÉ dans le sens de la course (b = κ_b × σ⊥, σ⊥ = ℓ × σψ du passeur, borné biaisMax : 30 cm trop
// long ne coûte rien, 30 cm trop court coûte le ballon). Deux contraintes d'admissibilité (§3.1) : la vitesse demandée ≤ la
// frappe du joueur (vMax), le ballon arrive VIVANT (≥ arriveeMin) — sinon le rendez-vous se rapproche (le coureur reçoit
// plus tôt, plus fort). Attributs en facteurs : σψ (passing) dans le biais, topF (pace) borne la vitesse prédite du
// coureur ; le through (courseServie, 167) garde sa loi. Clé absente : la mène d'hier au bit.
import { hyp } from './hyp.js';

/** Le rendez-vous d'une passe : rend { lead, T, v0, iters, biais } ou null (receveur trop lent : la mène d'hier). Pure — le
 *  solveur (solvePass) est injecté. from : le pied ; rP, rV : position et vitesse (crues ou crues) du receveur ; K : cfg ;
 *  x : { sigPsi (rad), topF, solve(from, lead) → { speed, flightTime } | null, arrival }. */
export function rendezVousDe(from, rP, rV, K, x) {
  const v = hyp(rV[0], rV[1]);
  if (!(v >= (K.vMin ?? 1.5))) return null;
  const vCap = Math.min(v, (K.vCourse ?? 7.5) * (x.topF ?? 1)), ux = rV[0] / v, uz = rV[1] / v;
  let T = (K.armee ?? 0) + hyp(rP[0] - from[0], rP[2] - from[2]) / (K.vBallon ?? 12), sol = null, lead = null;
  for (let it = 0; it < (K.iters ?? 3); it++) {
    lead = [rP[0] + ux * vCap * T, 0, rP[2] + uz * vCap * T];
    sol = x.solve(from, lead); if (!sol) return null;
    const T2 = (K.armee ?? 0) + sol.flightTime; if (Math.abs(T2 - T) < 0.02) { T = T2; break; } T = T2;
  }
  if (!sol) return null;
  if (sol.speed > (K.vMax ?? 26) || T > (K.tMax ?? 2.5)) { T = Math.min(T, K.tMax ?? 2.5) * (K.repli ?? 0.6); lead = [rP[0] + ux * vCap * T, 0, rP[2] + uz * vCap * T]; sol = x.solve(from, lead); if (!sol) return null; }   /* trop loin, trop fort : le rendez-vous se rapproche */
  const l = hyp(lead[0] - from[0], lead[2] - from[2]);
  const biais = Math.min(K.biaisMax ?? 2.5, (K.kb ?? 0.8) * l * (x.sigPsi ?? 0.035));
  return { lead: [lead[0] + ux * biais, 0, lead[2] + uz * biais], T, v0: sol.speed, biais, iters: K.iters ?? 3 };
}
