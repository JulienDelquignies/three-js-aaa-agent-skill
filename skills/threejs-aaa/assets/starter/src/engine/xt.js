// xt.js — LA VALEUR DE POSITION xT (283, cfg.xt && st.full — Modèle 06 §3 : « embarquer la grille 12 × 8 publiée, lue par
// interpolation bilinéaire » ; §8.1 : le terme de valeur ΔV = V(arrivée) − V(départ) au barème, × P_succ). Mesuré avant
// (sonde-283, 4 × 90 min) : depuis la surface la meilleure passe menait HORS du danger (EV_cont p50 0,024 — la porte du 272
// comparait le tir à une continuation petite), le barème de choosePass n'avait aucune valeur de position : la latérale sûre et
// la remise arrière valaient une remise en retrait sur le point de penalty. La grille est celle de Karun Singh (open_xt_12x8_v1,
// relue par le book à la quatrième décimale sur huit colonnes : x = 4,4 / 21,9 / 39,4 / 56,9 / 74,4 / 83,1 / 91,9 / 100,6 m
// et les quatre bandes axe / demi-espace / intermédiaire / couloir, symétriques) ; les colonnes que le book ne cite pas
// (x = 13,1 / 30,6 / 65,6) sont la moyenne géométrique de leurs voisines, celle de 48,1 dans l'axe est citée (0,0148) — les
// trois faits du book tiennent : le champ est plat sur 75 m (× 2,5) puis explose (× 10,8 sur 26 m), l'anisotropie latérale
// n'existe qu'à la surface (axe / couloir 1,15 à 57 m, 6,8 à 100 m), la passe reculée coûte peu (−0,02 c. +0,04 la pénétration).
// Attributs en facteurs : visionF (vision / passing — le passeur qui VOIT la valeur), le 50 vaut 1 exact ; tactique : l'axe
// style (le direct pèse la pénétration, la possession la conservation), 0,5 identité. Clé absente : le barème d'hier au bit.
import { axe } from './tactics.js';

const g = (a, b) => Math.sqrt(a * b);
/** Les quatre bandes (couloir → axe), 12 colonnes de 8,75 m (x du but défendu vers le but attaqué). */
const COULOIR = [0.0064, g(0.0064, 0.0084), 0.0084, g(0.0084, 0.0113), 0.0113, g(0.0113, 0.0147), 0.0147, g(0.0147, 0.0212), 0.0212, 0.0276, 0.0349, 0.0379];
const INTER = [0.0075, g(0.0075, 0.0094), 0.0094, g(0.0094, 0.0121), 0.0121, g(0.0121, 0.0161), 0.0161, g(0.0161, 0.0240), 0.0240, 0.0295, 0.0407, 0.0465];
const DEMI = [0.0089, g(0.0089, 0.0100), 0.0100, g(0.0100, 0.0127), 0.0127, g(0.0127, 0.0169), 0.0169, g(0.0169, 0.0241), 0.0241, 0.0286, 0.0549, 0.0644];
const AXE = [0.0094, g(0.0094, 0.0102), 0.0102, g(0.0102, 0.0126), 0.0126, 0.0148, 0.0169, g(0.0169, 0.0239), 0.0239, 0.0351, 0.1081, 0.2575];
/** XT[row][col] : 8 rangées de 8,5 m (y = 0 → 68, couloir / intermédiaire / demi-espace / axe / axe / …), 12 colonnes. */
export const XT = [COULOIR, INTER, DEMI, AXE, AXE, DEMI, INTER, COULOIR];
export const CELL = { dx: 105 / 12, dy: 68 / 8 };

/** La valeur bilinéaire au point (xB, yB) du terrain du book (x ∈ [0 ; 105] vers le but attaqué, y ∈ [0 ; 68]). Pure. */
export function xtAt(xB, yB) {
  const cx = Math.max(0, Math.min(11, xB / CELL.dx - 0.5)), cy = Math.max(0, Math.min(7, yB / CELL.dy - 0.5));
  const i0 = Math.floor(cx), j0 = Math.floor(cy), i1 = Math.min(11, i0 + 1), j1 = Math.min(7, j0 + 1), fx = cx - i0, fy = cy - j0;
  return XT[j0][i0] * (1 - fx) * (1 - fy) + XT[j0][i1] * fx * (1 - fy) + XT[j1][i0] * (1 - fx) * fy + XT[j1][i1] * fx * fy;
}

/** Le point moteur (x, z) de l'équipe qui attaque le but goal (x = ±hx), ramené au terrain du book. Pure. */
export function versBook(pitch, goal, p) {
  const s = Math.sign(goal.x || 1);
  return [(p[0] * s / pitch.hx + 1) * 52.5, ((p[2] ?? p[1]) / pitch.hz + 1) * 34];
}

/** La valeur de position d'un point moteur pour l'équipe qui attaque goal. Pure. */
export function xtDe(pitch, goal, p) { const [xB, yB] = versBook(pitch, goal, p); return xtAt(xB, yB); }

/** Le terme de valeur au barème : poids × P_succ × ΔV × visionF × axe(style, possession, direct) ; ΔV = V(arrivée) − V(départ). Pure. */
export function termeXt(dV, pSucc, K, x = {}) {
  return (K.poids ?? 20) * pSucc * dV * (x.visionF ?? 1) * axe(x.style ?? 0.5, K.possession ?? 0.8, K.direct ?? 1.2);
}
