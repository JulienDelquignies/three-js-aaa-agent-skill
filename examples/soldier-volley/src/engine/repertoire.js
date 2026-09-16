// repertoire.js — LE RÉPERTOIRE DU BOOK (279, cfg.repertoire && st.full — Modèle 10 §3.1, ch. 3 §4 : « sept gestes, chacun un
// triplet (vitesse, dispersion, effet) »). Les espèces du moteur frappaient à 16,5-21,5 m/s (le 258 les avait calées sur un
// gardien à seuil dur) ; le book donne les vitesses SOURCÉES — intérieur placé 20 [15-25], coup de pied 28 [22-33], enroulé 24
// [20-28], pointu 16 [13-20], volée et demi-volée 26 [20-31], tête 13 [8-18] — et deux colonnes [À CALIBRER] dont seul l'ORDRE
// est contraint : σψ relatif (pointu ≪ intérieur < instep < volée) et σθ/σψ par geste. Mesuré au 278 : le ballon lent (16-19
// m/s après sous-dose) n'a que 7-9 m/rad de sensibilité verticale et donne au gardien du 276 un budget temps d'un tiers trop
// long (le calage R0 1,5 / Rmax 1,9 / marge 1,25 compensait). Ici : la vitesse d'un geste = v̄ du book × powF (l'attribut
// shotPower, identité 1 à 50) × la bride du bout portant (l'instep à D < boutPortant cadre plutôt qu'il ne frappe — §3.3 :
// « à bout portant, cadrer suffit »), bornée à la plage du book × powF ; la borne physiologique vMax de l'échelle de finition
// devient un ATTRIBUT ([33 ; 38] m/s, ch. 3 §4 : « à fixer par attribut plutôt que par un record ») ; les colonnes de
// dispersion multiplient l'ellipse du 278 (σψ × sigma, σθ/σψ × aniso / anisoRef). Les espèces propres du moteur se rattachent
// à un geste (FAMILLE) ; les gestes exacts (lob, piqué, coup franc direct) gardent leur balistique. Clé absente : les vitesses
// d'hier, au bit.
export const GESTES = Object.freeze({
  'placé': { v: 20, lo: 15, hi: 25, sigma: 0.70, aniso: 1.5 }, puissance: { v: 28, lo: 22, hi: 33, sigma: 1.0, aniso: 2.0 },
  'enroulée': { v: 24, lo: 20, hi: 28, sigma: 0.85, aniso: 1.7 }, pointu: { v: 16, lo: 13, hi: 20, sigma: 0.55, aniso: 1.1 },
  'volée': { v: 26, lo: 20, hi: 31, sigma: 1.55, aniso: 2.3 }, 'demi-volée': { v: 26, lo: 20, hi: 31, sigma: 1.25, aniso: 2.1 },
  'tête': { v: 13, lo: 8, hi: 18, sigma: 1.1, aniso: 1.8 },
});
/** Les espèces du moteur rattachées à un geste du book (la famille décide la vitesse et les colonnes de dispersion). */
export const FAMILLE = Object.freeze({ 'croisé': 'placé', 'ras-de-terre': 'puissance', flottante: 'puissance', 'mi-hauteur': 'puissance', lucarne: 'enroulée' });
export function gesteDe(id) { return GESTES[FAMILLE[id] ?? id] ?? null; }
/** La vitesse de frappe d'un geste : v̄ × powF × la bride du bout portant, bornée à la plage du book × powF. Pure. */
export function vitesseGeste(id, K, c, x = {}) {
  const g = gesteDe(id); if (!g) return null;
  const pow = c?.skill?.powF ?? 1, fam = FAMILLE[id] ?? id;
  const bride = fam === 'puissance' && (x.dGoal ?? 99) < (K.boutPortant ?? 8) ? (K.bride ?? 0.9) : 1;
  return Math.max(g.lo * pow, Math.min(g.hi * pow, g.v * pow * bride));
}
/** La borne physiologique de l'échelle de finition (f_v = (v / vMax)^γ) : vMax × vMaxF (l'attribut, [33 ; 38] m/s). Pure. */
export function vMaxDe(c, K) { return (K.vMax ?? 35.5) * (c?.skill?.vMaxF ?? 1); }
/** Les colonnes de dispersion du geste, relatives à l'instep (sigma × σψ, aniso / anisoRef × σθ/σψ). Pure. */
export function dispersionGeste(id, K) { const g = gesteDe(id); return g ? { sigma: g.sigma, aniso: g.aniso / (K.anisoRef ?? 2) } : { sigma: 1, aniso: 1 }; }
