// appui.js — L'APPUI PLANTÉ (lot 336, cfg.appui && st.full — retour du 26/09 : « le demi-tour ou le virage ça va pas, c'est trop
// handicapant ; en vrai un changement d'appui brusque pour tourner ça se fait beaucoup, le foot est un sport d'appui »).
// MESURÉ avant (banc virages, un joueur lancé à 6,25 m/s, la cible tourne) : repartir à ≥ 3 m/s dans le nouvel axe prenait 0,45 s à
// 45°, 0,98 s à 90°, 1,20 s à 135°, 1,73 s au demi-tour ; le 505 en 4,58 s (élite 2,2-2,3). Le corps tournait en ARC freiné (la
// part latérale de l'accélération plafonnée, turnAccel/v : 52 °/s à 6,6 m/s ; le cap lissé ; le demi-tour en freinage complet).
// Le book (Modèle 02, §4.2-4.3) : au-delà de θ_cont = 40° un changement de direction n'est pas une trajectoire, c'est un ÉVÉNEMENT
// D'APPUI — le joueur plante, perd sa propulsion t_plant(θ) = t0 + cθ·θ (0,23 s à 45°, 0,33 à 90°, 0,43 à 135°, 0,52 à 180° : les
// temps de contact mesurés, Dos'Santos), et ressort à ρ(θ)·v, ρ = ρmin + (1 − ρmin) cos²(θ/2) (0,91 / 0,70 / 0,49 / 0,40). L'EXÉCUTABILITÉ :
// au-delà de v_allow(θ) (7,0 / 5,5 / 5,0 / 4,5 m/s) l'appui ne se prend pas à pleine vitesse — il s'allonge du freinage qui manque
// ((v − v_allow)/Dmax) et la sortie se calcule sur v_allow : arriver plus vite ne fait jamais sortir plus vite.
// Pendant l'appui la vitesse passe LINÉAIREMENT de l'entrée (son axe) à la sortie (le nouvel axe) — le demi-tour passe par l'arrêt,
// le crochet à 90° garde un reste d'élan — et le lacet du corps tourne à `lacet` rad/s (movement.js). L'AGILITÉ entre (attributes :
// appuiF × la durée [1,15 ; 0,85], appuiRhoF × la vitesse gardée [0,93 ; 1,07], 1 exact à 50). Clé absente : l'arc d'hier au bit.

const hyp = Math.hypot;
export const APPUI = { cont: 40, t0: 0.13, c: 0.125, rhoMin: 0.40, allow: [[40, 99], [45, 7.0], [90, 5.5], [135, 5.0], [180, 4.5]], dMax: 6.0, vMin: 2.0, repos: 0.25, arrivee: 1.5, lacet: 9, tenue: 0.12 };

/** La vitesse d'approche exécutable pour un virage de `deg` degrés (table interpolée du book). */
export function vAllow(deg, A = APPUI) {
  const T = A.allow ?? APPUI.allow;
  if (deg <= T[0][0]) return Infinity;
  for (let i = 1; i < T.length; i++) if (deg <= T[i][0]) { const [a, va] = T[i - 1], [b, vb] = T[i]; return va + (vb - va) * (deg - a) / (b - a); }
  return T[T.length - 1][1];
}

/** Le plan d'un appui (pur) : durée, vitesse de sortie. */
export function planAppui(deg, vIn, vWant, A = APPUI, skill = {}) {
  const th = deg * Math.PI / 180, va = vAllow(deg, A), trop = Math.max(0, vIn - va);
  const dur = ((A.t0 ?? 0.13) + (A.c ?? 0.125) * th) * (skill.appuiF ?? 1) + trop / (A.dMax ?? 6);
  const rho = (A.rhoMin ?? 0.4) + (1 - (A.rhoMin ?? 0.4)) * Math.cos(th / 2) ** 2;
  return { dur, vo: Math.min(vWant, rho * Math.min(vIn, va) * (skill.appuiRhoF ?? 1)), rho };
}

/** Un pas de l'appui : rend true si l'appui POSSÈDE la vitesse de cette image (p.v écrit) — movement.js saute alors l'arc et le cap
 *  lissé. (wx, wz) : la demande de vitesse du joueur ; dTgt : la distance à sa cible ; libre : false si un autre régime le tient. */
export function appuiPas(st, p, wx, wz, dTgt, A, dt, libre) {
  const PL = p._appui;
  if (PL) {
    if (st.t < PL.fin && libre) {
      const k = Math.min(1, (st.t + dt - PL.t0) / (PL.fin - PL.t0));
      p.v[0] = PL.vi * (1 - k) * PL.ui[0] + PL.vo * k * PL.uo[0];
      p.v[1] = PL.vi * (1 - k) * PL.ui[1] + PL.vo * k * PL.uo[1];
      return true;
    }
    p._appui = null; p._appuiFin = st.t;
    return false;
  }
  if (!libre) return false;
  const sp = hyp(p.v[0], p.v[1]), wm = hyp(wx, wz), vMin = A.vMin ?? 2;
  if (sp < vMin || wm < vMin || dTgt <= (A.arrivee ?? 1.5) || st.t - (p._appuiFin ?? -9) < (A.repos ?? 0.25)) return false;
  const c = (p.v[0] * wx + p.v[1] * wz) / (sp * wm), deg = Math.acos(Math.max(-1, Math.min(1, c))) * 180 / Math.PI;
  if (deg <= (A.cont ?? 40)) { p._appuiVeut = null; return false; }
  // LA DEMANDE DOIT TENIR (mesuré : sans cette clause, 3 006 appuis en 42 s pour 22 joueurs — la cible des rôles sans ballon tremble
  // d'une image à l'autre, B5) : le cap voulu reste au-delà de cont pendant `tenue` s avant que le pied ne se plante
  if (p._appuiVeut == null || st.t - p._appuiVeut.t > 2 * dt + 1e-6 && p._appuiVeut.last < st.t - 2 * dt) p._appuiVeut = { t: st.t, last: st.t };
  p._appuiVeut.last = st.t;
  if (st.t - p._appuiVeut.t < (A.tenue ?? 0.12)) return false;
  p._appuiVeut = null;
  const P = planAppui(deg, sp, wm, A, p.skill ?? {});
  p._appui = { t0: st.t, fin: st.t + P.dur, vi: sp, ui: [p.v[0] / sp, p.v[1] / sp], vo: P.vo, uo: [wx / wm, wz / wm], deg };
  p._appuiN = (p._appuiN ?? 0) + 1;
  return appuiPas(st, p, wx, wz, dTgt, A, dt, libre);
}
