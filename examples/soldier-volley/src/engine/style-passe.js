// style-passe.js — LE STYLE CHANGE LE CHOIX DE PASSE (lot 371, cfg.stylePasse — T3 du chantier tactique ; 01/10 : « le style qui change
// le rythme, c'est par rapport à des paramètres de tempo et de choix de passes en entrée du moteur non ? »). Audit des 7 presets : le
// style (possession ↔ direct) pesait les OPTIONS (passe / conduite / centre / tir), la sortie au gardien, le renversement et le marqué —
// mais PAS la passe elle-même : la longueur idéale valait 10 m pour tout le monde (|d − 10| × 0,32), la passe en l'air coûtait 2,2 à
// tout le monde, le gain vers l'avant pesait pareil. Mesuré : direct speed 1,6-1,8 m/s pour TOUS (livre 1,4 possession · 2,1 direct),
// ballons longs 12-16 % pour tous (livre 8-20 % selon l'école), passes vers l'arrière ≈ 30 % pour tous (40-42 possession, 24-28 direct).
// La loi — un terme ADDITIF au barème de rondo.choosePass, NUL au neutre (style 0,5 et mentalité 0,5 : l'identité exacte) :
//   (1) la LONGUEUR idéale : 8 m (possession) … 10 (neutre) … 18 (direct) — le terme corrige |d − 10| × 0,32 vers |d − dOpt| × 0,32 ;
//   (2) la passe EN L'AIR : son coût × 1,3 (possession) … × 1 … × 0,3 (direct) ;
//   (3) la VERTICALITÉ : en direct le gain vers l'avant paie et le retrait coûte (± 0,12 / m, bornés −10 … +25 m) ; en possession le
//       retrait qui recycle est toléré (la moitié de la pente, de signe inverse) ; la MENTALITÉ ajoute son goût du risque vers l'avant ;
//   (4) le JEU LONG sur la pointe : en direct, la passe de plus de 22 m vers un attaquant reçoit une prime (bonusLong × l'écart au neutre).
// Les attributs restent les modulateurs (la vision et la passe du passeur font le reste dans le barème). Absente : le barème d'hier, au bit.
const pente = (v) => (v ?? 0.5) - 0.5;   // −0,5 … +0,5, nul au neutre

/** Le terme de style pour une passe candidate. d : longueur (m), gain : progression vers le but adverse (m), lofted : en l'air,
 *  pointe : le receveur est une pointe de la formation. tq : la tactique du passeur. Pur. */
export function termeStyle(K, tq, { d, gain, lofted, pointe, bascule = false, servi = false }) {
  const s = pente(tq?.style), m = pente(tq?.mentalite);
  if (!s && !m) return 0;
  let t = 0;
  if (!bascule && !servi && s) {
    const dOpt = s < 0 ? 10 + s * (K.dPoss ?? 4) : 10 + s * (K.dDirect ?? 16);   // 8 … 10 … 18 m
    t += 0.32 * (Math.abs(d - 10) - Math.abs(d - dOpt));
  }
  if (lofted && !bascule && s) t += 2.2 * (s < 0 ? s * (K.airPoss ?? 0.6) : s * (K.airDirect ?? 1.4));   // le coût d'hier × (1 − …)
  const g = Math.max(-10, Math.min(25, gain));
  if (s > 0) t += s * 2 * (K.vert ?? 0.12) * g;
  else if (s < 0 && g < 0) t += -s * 2 * (K.vert ?? 0.12) * 0.5 * -g;   // la possession recycle sans honte
  if (m) t += m * 2 * (K.risque ?? 0.08) * Math.max(0, g);
  if (s > 0 && pointe && d > (K.dLong ?? 22) && g > 10) t += s * 2 * (K.bonusLong ?? 1.5);
  return t;
}
