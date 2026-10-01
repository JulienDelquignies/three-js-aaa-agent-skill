// repli-consigne.js — LE BLOC SE REFORME SELON LA CONSIGNE (lot 376, cfg.repliConsigne — T4 du chantier tactique ; 01/10 : « une équipe
// qui presse moins doit réformer son bloc plus rapidement ? » ; B11 X15-17 : bloc reformé en 8-12 s, le DC revient en 1,3 s, le 6 en 2,4 s,
// l'ailier opposé en 5,4-9,0 s). Audit (7 presets × 4 × 90 min) : le centre de gravité du perdant ne reculait que de 0,2 à 1,9 m dans les 3 s
// qui suivent la perte — l'entretien et le « rejoint au trot » (338) gouvernaient le retour.
// La loi : pendant `fenetre` s après la perte, le joueur qui ne chasse pas (ni presse, ni intercepte, ni meute) et dont la cible est DERRIÈRE
// lui (vers son but, de plus de `des` m) y court à une vitesse et un effort de CONSIGNE : pressing faible → le sprint de repli ; pressing
// fort → le trot (l'équipe préfère contre-presser) ; × workRate. Absente : l'allure d'hier, au bit.
const ax = (v, lo, hi) => lo + Math.max(0, Math.min(1, v ?? 0.5)) * (hi - lo);
/** La vitesse plancher et l'effort du repli pour p, ou null. */
export function repliDe(st, p, K) {
  if (!p.target || p.keeper || st.restart || p.job === 'press' || p.job === 'intercept' || p.job === 'receive' || p.job === 'carry') return null;
  if (!(st.possession?.team >= 0) || st.possession.team === p.team) return null;
  if (st.t - (st._possChangeAt ?? -99) > (K.fenetre ?? 4)) return null;
  if (st._cp?.team === p.team && st._cp.hunters?.some((h) => h.id === p.id && h.until > st.t)) return null;   // la meute chasse
  const sg = -st.pitch.ownGoal(p.team).sign; if ((p.p[0] - p.target[0]) * sg < (K.des ?? 3)) return null;   // la cible est derrière lui
  const T = st.tactics?.[p.team], pr = T?.pressing ?? 0.5;
  return { v: ax(pr, K.vSprint ?? 6.6, K.vTrot ?? 3.6) * (p.skill?.workF ?? 1), eps: ax(pr, K.epsSprint ?? 1, K.epsTrot ?? 0.6) };
}
