// ellipse.js — L'ELLIPSE DE FINITION (278, cfg.ellipse && st.full — Modèle 03 §5.1-5.2, Modèle 10 §3.4 : « l'erreur est tirée
// une fois, à la frappe, et la trajectoire perturbée est intégrée »). Le 258 tirait trois bruits INDÉPENDANTS et centrés (cap,
// élévation, vitesse) autour d'un point visé qui n'existait pas encore ; le 277 a posé le point visé (neuf modes) et mesuré
// ce que l'écart d'hier laissait : 45-46 % de tirs cadrés (réel 33), 0 au-dessus pour 13 à côté (réel ≈ 1,5 au-dessus pour 1),
// 0 sur les montants (2,3 %). Ici l'erreur d'exécution du book : (Δψ, Δθ) une normale BIVARIÉE de corrélation ρψθ (0,2), la
// vitesse log-normale CORRÉLÉE à Δθ (« une frappe précipitée est simultanément trop levée et trop molle » : ρθv < 0), tronquée
// au plafond physiologique (vPlafond, ch. 3 §4 : 33-38 m/s) et à queue basse ÉPAISSE (le ballon mal frappé, queue × sur les
// ξ < 0) ; et des BIAIS non nuls sous pression : la sous-dose du 258 (μv) et le pied qui S'OUVRE (μψ = biaisPsi° × P vers
// l'extérieur du pied qui frappe — un bruit purement centré rend les ratés statistiquement neutres, ce qui est faux). σ0 (2,0°,
// la borne haute du book) et l'anisotropie (4,5 EN ANGLE DE DÉPART : la sensibilité verticale du ballon lent, 16-19 m/s, n'est que
// 7-9 m/rad et non 1,2 D) sont RECALIBRÉS sur le point visé — test 6 du Modèle 03 : σvert/σhoriz AU PLAN DU BUT ∈ [1,6 ; 2,5]
// (mesuré 1,7-2,4, côté haut : le sol tronque le bas), au-dessus / à côté ≥ 1,1 (mesuré 0,83-0,93 — dette nommée). Les attributs restent des FACTEURS (finF, composureF, weakF — identité à 50, lus par
// finitionSigma), la pression P ∈ [0 ; 1] un axe : rien de câblé au poste. Le gauss du moteur (somme de trois uniformes ×
// 1,4142) a un σ de 0,707 et AUCUNE queue au-delà de ±2,1 : c'est lui qui interdisait le tir au-dessus — l'ellipse tire une
// VRAIE normale par inversion (Acklam 2003, pas de Box-Muller : ch. 3 §5.3), tronquée à ±xiMax (3,5). Clé absente : les trois
// tirages d'hier, au bit.

const A = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
const B = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
const C = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
const D = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
/** L'inverse de la normale standard (Acklam, erreur relative 1,15e-9) — un tirage N(0, 1) à VRAIES queues, seedé, tronqué. */
export function normale(rnd, xiMax = 3.5) {
  const u = Math.min(1 - 1e-12, Math.max(1e-12, rnd()));
  let x;
  if (u < 0.02425) { const q = Math.sqrt(-2 * Math.log(u)); x = (((((C[0] * q + C[1]) * q + C[2]) * q + C[3]) * q + C[4]) * q + C[5]) / ((((D[0] * q + D[1]) * q + D[2]) * q + D[3]) * q + 1); }
  else if (u > 1 - 0.02425) { const q = Math.sqrt(-2 * Math.log(1 - u)); x = -(((((C[0] * q + C[1]) * q + C[2]) * q + C[3]) * q + C[4]) * q + C[5]) / ((((D[0] * q + D[1]) * q + D[2]) * q + D[3]) * q + 1); }
  else { const q = u - 0.5, r = q * q; x = (((((A[0] * r + A[1]) * r + A[2]) * r + A[3]) * r + A[4]) * r + A[5]) * q / (((((B[0] * r + B[1]) * r + B[2]) * r + B[3]) * r + B[4]) * r + 1); }
  return Math.max(-xiMax, Math.min(xiMax, x));
}

/** Les écarts d'exécution d'UN tir : Δψ (rad, biais compris), Δθ (rad), lnV (le logarithme du facteur de vitesse, sous-dose
 *  comprise). rnd : le flux seedé du tir (trois gaussiennes, dans cet ordre) ; L : { sigPsi, sigTheta, sigV, muV } du 258
 *  (finitionSigma) ; K : cfg.ellipse ; x : { P (pression 0..1), cote (±1 : l'extérieur du pied qui frappe, +1 = +yaw) }. */
export function ecartDe(rnd, L, K, x) {
  const xm = K.xiMax ?? 3.5, g1 = normale(rnd, xm), g2 = normale(rnd, xm), g3 = normale(rnd, xm);
  const r = Math.max(-0.99, Math.min(0.99, K.rhoPsiTheta ?? 0.2)), rv = Math.max(-0.99, Math.min(0.99, K.rhoThetaV ?? -0.35));
  const zPsi = g1, zTheta = r * g1 + Math.sqrt(1 - r * r) * g2;
  let zV = rv * zTheta + Math.sqrt(1 - rv * rv) * g3;
  if (zV < 0) zV *= K.queue ?? 1.6;                                                    /* la queue basse épaisse (ch. 3 §4) */
  const P = Math.max(0, Math.min(1, x.P ?? 0));
  return { dPsi: (K.biaisPsi ?? 1.5) * Math.PI / 180 * P * (x.cote ?? 1) + zPsi * L.sigPsi, dTheta: zTheta * L.sigTheta, lnV: L.muV + zV * L.sigV, zPsi, zTheta, zV };
}

/** Le facteur de vitesse borné : la log-normale TRONQUÉE au plafond physiologique et au plancher du geste. */
export function vitesseDe(spd, lnV, K) { return Math.max(K.vPlancher ?? 10, Math.min(K.vPlafond ?? 33, spd * Math.exp(lnV))); }
