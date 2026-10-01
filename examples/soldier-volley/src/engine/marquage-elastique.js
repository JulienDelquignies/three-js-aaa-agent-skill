// marquage-elastique.js — LE MARQUAGE ÉLASTIQUE ET LA ZONE QUI PREND SON HOMME (lot 368, cfg.marquageElastique — T1 du chantier
// tactique, B12 du livre). Mesuré (télémétrie tactique, 4 × 90 min) : les défenseurs vivaient à 12-14 m du plus proche adversaire
// (livre : LAT 6,4 > MIL 5,6 > DC 5,5 — l'ordre était INVERSÉ, les défenseurs les plus loin de tout) et 2 défenseurs seulement à
// moins de 10 m du ballon (livre 4,9). Deux causes : (1) les défenseurs « postés » du bloc (les plus loin du ballon par construction)
// tenaient leur SLOT en ignorant l'attaquant de leur zone — un central à 14,8 m de l'avant-centre ; (2) le marqueur se tenait à une
// distance CONSTANTE (1,4 m, 0,95 en fenêtre) quel que soit l'éloignement du ballon.
// La loi du livre (B12 § 1, markDistance) : la distance au porteur potentiel est ÉLASTIQUE — 0,5 m quand le ballon est à 6 m, 12 m
// quand il est à 30 m —, côté but (le point d'ancrage entre l'adversaire et le but), et la zone mixte fait PRENDRE l'homme qui entre
// dans la zone : le posté se rapproche de l'attaquant le plus proche de son slot (≤ zone m), sans quitter son slot de plus de laisse m.
// L'axe tactique marquage (zone ↔ homme) dose l'attraction (zone 0,6 → homme 1). Absente : les slots et la constante d'hier, au bit.

const hyp = Math.hypot;
const ax = (v, lo, hi) => lo + Math.max(0, Math.min(1, v ?? 0.5)) * (hi - lo);

/** La distance de marquage élastique (m) selon la distance de l'homme au ballon. Pure. */
export function distanceElastique(dBall, K) {
  const d0 = K.d0 ?? 6, d1 = K.d1 ?? 30, m0 = K.m0 ?? 0.5, m1 = K.m1 ?? 12;
  return m0 + Math.max(0, Math.min(1, (dBall - d0) / (d1 - d0))) * (m1 - m0);
}

/** Le posté du bloc prend l'homme de sa zone : renvoie la cible [x, z] corrigée (ou le slot tel quel). */
export function zonePrendHomme(st, p, slot, attackers, anchor, defGoal, K, tq) {
  let a = null, da = K.zone ?? 12;
  for (const q of attackers) { if (q.keeper || q.down > 0 || q.expulse) continue; const d = hyp(q.p[0] - slot[0], q.p[2] - slot[1]); if (d < da) { da = d; a = q; } }
  if (!a) return slot;
  const gx = defGoal.x - a.p[0], gz = 0 - a.p[2], gl = hyp(gx, gz) || 1;
  const dE = distanceElastique(hyp(a.p[0] - anchor[0], a.p[2] - anchor[2]), K);
  const ancre = [a.p[0] + (gx / gl) * dE, a.p[2] + (gz / gl) * dE];
  const w = ax(tq?.marquage, K.wZone ?? 0.6, 1);
  let tx = slot[0] + (ancre[0] - slot[0]) * w, tz = slot[1] + (ancre[1] - slot[1]) * w;
  const dl = hyp(tx - slot[0], tz - slot[1]), lai = K.laisse ?? 8;
  if (dl > lai) { tx = slot[0] + (tx - slot[0]) * lai / dl; tz = slot[1] + (tz - slot[1]) * lai / dl; }
  return [tx, tz];
}
