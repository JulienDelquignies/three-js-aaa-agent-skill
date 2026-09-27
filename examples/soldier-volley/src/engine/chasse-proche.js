// chasse-proche.js — LE CHASSEUR PROCHE VA AU BALLON, PAS DEVANT LUI (cfg.chasseProche && st.full — retour utilisateur 27/09, capture :
// « le 10 est parti sans ballon »). L'élu du ballon libre (match-sim, hunter) visait le point de MÈNE : le ballon + sa direction × min(6,
// 0,7 × vitesse). Mesuré (graine 11, t 399,9, contrôle jambe-tendue raté) : l'élu à 0,8 m courait vers ce point 1,2 m DEVANT le ballon,
// DANS le sens du roulement, dos au ballon — la prise était refusée à chaque image (controle-dos : le ballon hors du cône avant) et il
// s'éloignait à 1,5-2,2 m/s pendant 1-2 s, jusqu'à ce que le ballon s'arrête. Le vrai joueur se RETOURNE sur un ballon à ses pieds, et
// VA AU-DEVANT d'un ballon qui roule vers lui.
// Ici : l'élu à ≤ portee m du ballon et pas derrière lui (à ≥ −recul m le long du roulement — le ballon revient sur lui ou le dépasse),
// ou (devant, off par défaut) devant sa trajectoire à ≤ devant m, écart latéral ≤ couloir m :
// la cible est le BALLON (il se tourne vers lui, face, la prise dans le cône). Sinon : la mène, l'hier. Clé absente : l'hier au bit.
import { hyp } from './hyp.js';

/** La cible [x, 0, z] de l'élu du ballon libre. Pure. */
export function cibleChasse(st, p, leadP, cfg) {
  const K = st.full && cfg.chasseProche, b = st.ball.p;
  if (!K) return [leadP[0], 0, leadP[1]];
  const dx = p.p[0] - b[0], dz = p.p[2] - b[2], d = hyp(dx, dz);
  const vb = hyp(st.ball.v[0], st.ball.v[2]), ux = vb > 0.5 ? st.ball.v[0] / vb : 0, uz = vb > 0.5 ? st.ball.v[2] / vb : 0, av = dx * ux + dz * uz;
  // (banc 16 matchs) seulement s'il n'est PAS derrière le ballon : le coureur qui suit un ballon joué dans la course garde la mène
  // (la première version — ballon ciblé à ≤ 2,5 m quel que soit le côté, et devant la trajectoire jusqu'à 6 m — faisait revenir les appels :
  // tirs 22,5 → 19,0, centres 10,5 → 6,7 par match)
  if (d <= (K.portee ?? 2.5) && (vb <= 0.5 || av > -(K.recul ?? 0.3))) return [b[0], 0, b[2]];
  if (vb > 0.5 && K.devant) { const lat = Math.abs(-dx * uz + dz * ux);
    if (av > 0 && d <= K.devant && lat <= (K.couloir ?? 1.5)) return [b[0], 0, b[2]]; }
  return [leadP[0], 0, leadP[1]];
}

/** LE GARDIEN PREND LE BALLON MORT À SES PIEDS (même clé, K.gardien m). Les gardiens ne sont pas des candidats du ballon libre
 *  (match-sim : attackers/defenders sont des joueurs de champ ; la loi 89 : il chassait à 20-30 m puis portait au coin des six). Mesuré
 *  (graine 11, t 663,6) : une passe morte à 2,9 m de SON gardien, dans SA surface, restait 3 s sans personne (le gardien planté sur son
 *  spot, le coéquipier le plus proche à 46 m). Ici, dans la boucle des gardiens : ballon libre au sol, lent (≤ vMax m/s), dans la surface d'un
 *  gardien debout, à ≤ gardien m de lui, et aucun coéquipier plus près → il y VA (job receive, cible le ballon). Le prendre aux mains
 *  reste l'affaire de ses lois (Loi 12.2 : le retrait se joue au pied). Clé absente : l'hier. */
export function gardienPrend(st, p, cfg) {
  const K = st.full && cfg.chasseProche, g = K?.gardien; if (!g || !st.pitch || !p.keeper || p.down > 0 || p.expulse || p._sub) return false;
  const b = st.ball.p, box = st.pitch.dims?.box, d = hyp(b[0] - p.p[0], b[2] - p.p[2]); if (!box || d > g) return false;
  const sg = Math.sign(st.pitch.ownGoal(p.team).x || 1);
  if (!(b[0] * sg > st.pitch.hx - box.depth && Math.abs(b[2]) < box.width / 2)) return false;
  for (const q of st.players) if (q !== p && q.team === p.team && !q.expulse && !q._sub && q.down <= 0 && hyp(b[0] - q.p[0], b[2] - q.p[2]) < d) return false;
  return true;
}

/** L'étape (la boucle des gardiens de match-sim, après son spot) : le gardien éligible va au ballon mort. Mutateur. */
export function gardienSort(st, cfg, gk) {
  const K = st.full && cfg.chasseProche; if (!K?.gardien || st.restart || st.ball.owner != null || st.ball.p[1] > 0.5) return;
  if (st.possession?.carrier >= 0 || hyp(st.ball.v[0], st.ball.v[2]) > (K.vMax ?? 3)) return;
  if (gardienPrend(st, gk, cfg)) { gk.job = 'receive'; gk.target = [st.ball.p[0], 0, st.ball.p[2]]; }
}
