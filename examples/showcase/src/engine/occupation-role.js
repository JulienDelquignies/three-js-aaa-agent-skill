// occupation-role.js — L'ATTAQUE OCCUPE LE TERRAIN SELON LES RÔLES (lot 377, cfg.occupationRole — T2 du chantier tactique ; 01/10 :
// « oui mais tout dépend des rôles des joueurs »). Mesuré (2 × 20 min, ballon dans la moitié adverse, attaque installée) : l'équipe en
// possession n'a que 4 joueurs à moins de 15 m de la ligne adverse et 6 sur 10 derrière le ballon (livre B11 X19 : 3,7) ; ses centraux à
// 33 m derrière le ballon ; contre un bloc bas, l'avant-centre à 10 m devant la ligne (il siégeait au comité de soutien). Conséquence :
// la consigne de marquage, la compacité et les notes des défenseurs ne mordaient pas — personne n'entrait dans la zone des centraux.
// Cause : le rôle ne nuançait le poste que de ± 2,5 m (roles.profondeur), et sans rôle posé les vingt joueurs de champ sont
// « polyvalents » (profondeur 0,5) — le latéral, le central et le milieu avaient le même profil.
// La loi : en ATTAQUE INSTALLÉE (possession depuis plus de `tenue` s, ballon au-delà de `des` m de la ligne médiane), le posté vit à la
// HAUTEUR DE SON RÔLE, entre trois repères : f = 0 → `arriere` m derrière le ballon (la garde : centraux, sentinelle), f = 0,5 → à hauteur
// du ballon (le box-to-box, la mezzala), f = 1 → sur la ligne adverse (la pointe, l'attaquant intérieur) — f suit la profondeur du rôle
// (p0 → 0, p1 → 1), décalée par la MENTALITÉ (± mental). Le joueur sans rôle prend le rôle NATUREL de son poste (central 0,1, latéral
// 0,42, sentinelle 0,2, milieu 0,45, ailier 0,6, pointe 0,8). La cible glisse de `w` vers cette hauteur (jamais au-delà de la ligne).
// Et la pointe devant le ballon ne siège plus au comité de soutien selon son rôle (match-sim, l'élection : × decroche … fixe) — le faux 9
// décroche, le renard fixe. Absente : la formation et le comité d'hier, au bit.
import { LIGNES, pivotDe } from './formation.js';
import { offsideLine } from './offside.js';
const ax = (v, lo, hi) => lo + Math.max(0, Math.min(1, v ?? 0.5)) * (hi - lo);

/** La profondeur du rôle de p (0 garde … 1 pointe) : son rôle posé, sinon le rôle naturel de son poste. Pure. */
export function profondeurRole(st, p, K) {
  if (p.role && p.role.profondeur != null) return p.role.profondeur;
  const f = st.tactics?.[p.team]?.formation ?? '433', lg = LIGNES[f] ?? LIGNES[433], k = p.post ?? 0, D = K.defaut ?? {};
  const nDef = lg[0], nAtt = lg[lg.length - 1], dAtt = lg.reduce((a, b) => a + b, 0) - nAtt;
  if (k < nDef) return (k === 0 || k === nDef - 1) && nDef >= 4 ? D.lat ?? 0.3 : D.dc ?? 0.1;
  if (k === pivotDe(f)) return D.pivot ?? 0.2;
  if (k < dAtt) return D.mil ?? 0.45;
  return nAtt >= 3 && (k === dAtt || k === dAtt + nAtt - 1) ? D.ail ?? 0.6 : D.att ?? 0.8;
}

/** Dans la boucle de mouvement : le posté de l'équipe en possession glisse vers la hauteur de son rôle. */
export function occupationCorps(st, p, K) {
  if (p.job !== 'support' || !p._poste || !p.target || p.keeper || st.restart || st.possession?.team !== p.team) return;
  if (st.t - (st._possChangeAt ?? st.t) < (K.tenue ?? 3)) return;
  const off = offsideLine(st, p.team), sg = off.sgn, bx = st.ball.p[0] * sg;
  if (bx < (K.des ?? -5)) return;
  const pr = profondeurRole(st, p, K), m = st.tactics?.[p.team]?.mentalite ?? 0.5;
  const f = Math.max(0, Math.min(1, (pr - (K.p0 ?? 0.1)) / ((K.p1 ?? 0.8) - (K.p0 ?? 0.1)) + (m - 0.5) * 2 * (K.mental ?? 0.15)));
  const ligne = off.adv - (K.marge ?? 1.5), haut = Math.max(bx, ligne);
  const x = f < 0.5 ? bx - (K.arriere ?? 26) * (1 - 2 * f) : bx + (haut - bx) * (2 * f - 1);
  const tx = p.target[0] * sg, w = K.w ?? 0.8, nx = Math.min(tx + (x - tx) * w, Math.max(tx, ligne));
  p.target = [nx * sg, p.target[1] ?? 0, p.target[2]];
}

/** (377) L'ALLURE DE L'OCCUPATION : le posté dont la cible de rôle est DEVANT lui de plus de `rejoint` m y monte à l'allure de son rôle
 *  (la garde au trot vGarde, la pointe en course vPointe) × workRate — hier, sous 8 m d'écart (montee-offensive), la marche : le latéral
 *  offensif visait le ballon − 1 m et vivait à − 12 m. Renvoie { v, eps } ou null. */
export function occupationAllure(st, p, K) {
  if (p.job !== 'support' || !p._poste || !p.target || p.keeper || st.restart || st.possession?.team !== p.team) return null;
  if (st.t - (st._possChangeAt ?? st.t) < (K.tenue ?? 3)) return null;
  const sg = -st.pitch.ownGoal(p.team).sign; if ((p.target[0] - p.p[0]) * sg < (K.rejoint ?? 4)) return null;
  const r = Math.max(0, Math.min(1, profondeurRole(st, p, K) / (K.p1 ?? 0.8)));
  return { v: ax(r, K.vGarde ?? 3.6, K.vPointe ?? 5.5) * (p.skill?.workF ?? 1), eps: ax(r, K.epsGarde ?? 0.6, K.epsPointe ?? 0.85) };
}
