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

// (378, cfg.liberteStyle — T3 du chantier ; 01/10 : « oui vas-y », le style qui change le rythme) LA POSSESSION CHERCHE L'HOMME LIBRE.
// Mesuré (possession c. direct, 2 × 30 min) : l'équipe de POSSESSION servait PLUS souvent un receveur marqué à < 3 m (18 % de ses passes,
// gardées à 63 %) que l'équipe directe (10 %) — la longueur courte et le soutien rapproché l'envoyaient dans la foule, le malus de l'homme
// libre (233) ne pesait que sous 2,5 m. Ses séquences mouraient à 3 passes (livre 5-6). La loi : plus le style penche vers la possession,
// plus le passeur EXIGE d'espace au receveur — le seuil de liberté monte de `seuil` m (neutre) à `seuilPoss` m, le malus jusqu'à `malus`,
// × la vision et les décisions du passeur (le meneur voit l'homme libre, le médiocre joue le plus proche) et × son RÔLE (l'axe tenue :
// le regista, le meneur reculé gardent le ballon, le destroyer joue simple ; polyvalent × 1). Nul au style neutre et en direct. Absente : hier, au bit.
export function malusLiberteStyle(K, tq, liberte, { visionF = 1, decF = 1, tenue = 0.5 } = {}) {
  const s = -pente(tq?.style); if (s <= 0) return 0;   // 0 … 0,5 (possession pure)
  const seuil = (K.seuil ?? 2.5) + s * 2 * ((K.seuilPoss ?? 6) - (K.seuil ?? 2.5));
  return s * 2 * (K.malus ?? 5) * Math.max(0, 1 - liberte / seuil) * visionF * decF * (0.6 + 1.6 * Math.max(0, Math.min(1, tenue)) * (K.role ?? 0.5));   // × le RÔLE (tenue : le regista garde ×1,2, le destroyer joue simple ×0,76)
}

// (379, cfg.recyclage — T3 du chantier ; 01/10 : « il faudrait aussi savoir entre quels joueurs sont ces séquences ») LA RELANCE EST UNE
// CIRCULATION. Mesuré (2 × 90 min) : la structure de passes était INVERSÉE — ailiers et avant-centre recevaient le plus (8-9 ballons par
// joueur et par 10 min), centraux 2,4-3,5, gardien 2-3 (livre B01 T7 : MC > DC > LAT > AIL > CF > GB) ; passes entre défenseurs 5-13 %
// (livre R13 : 38 %) ; les ailiers faisaient le plus de passes (59 % vers l'arrière, aux milieux), les centraux se passaient le ballon à
// 8 %. Cause : la longueur idéale de 10 m du barème (|d − 10| × 0,32) — le recyclage de 25 m vers un central libre coûtait 5-6 points,
// plus le sens de jeu ; la sécurité par l'arrière n'était jamais choisie. Séquences : 10+ passes 2 par équipe et par match (livre 17-24
// en possession), maximum 12-17. La loi : la passe vers l'ARRIÈRE (plus de `arriere` m) à un coéquipier LIBRE (≥ `libre` m à l'arrivée)
// dont le rôle est une GARDE (profondeur ≤ `garde` : central, sentinelle — le rôle naturel du poste à défaut) reçoit un bonus × le STYLE
// (possession × poss … direct × direct), × la PRESSION sur le porteur (pressé à < 4 m : × presse), × le RÔLE du receveur (l'axe ressort :
// le relanceur, le regista, le meneur reculé sont des plaques tournantes, le stoppeur et le destroyer moins) ; et la longueur au-delà de
// 10 m lui est en partie remise. Le gardien a sa propre loi (136). Absente : le barème d'hier, au bit.
export function termeRecyclage(K, tq, { d, gain, liberte, presse = false, garde = false, ressort = 0.5 }) {
  if (!garde || gain > -(K.arriere ?? 3) || liberte < (K.libre ?? 5)) return 0;
  const sty = Math.max(0, Math.min(1, tq?.style ?? 0.5)), f = (K.poss ?? 1.6) + sty * ((K.direct ?? 0.4) - (K.poss ?? 1.6));
  const b = (K.bonus ?? 2.5) * f * (presse ? K.presse ?? 1.6 : 1) * (0.6 + 0.8 * Math.max(0, Math.min(1, ressort)));
  return b + 0.32 * Math.max(0, d - 10) * Math.min(1, f * (K.longueur ?? 0.5));
}
