// menace.js — L'ARBITRE DE MENACE ON-BALL : le cerveau du porteur est un CONTRAT, pas un ordre
// figé. Avant lui, le porteur vivait sur trois heuristiques séparées évaluées dans un ordre
// écrit en dur (tir, puis centre, puis passe, sinon conduite) — chacune avec ses seuils, aucune
// ne sachant ce que les autres valaient. Ici : QUATRE options notées sur UNE échelle (la menace
// — « qu'est-ce qui rapproche du but adverse ? »), un gagnant, et le POURQUOI sur chaque note.
//
// Le patron moteur (Unity/Unreal) : le moteur possède l'EXÉCUTION (gestes, balistique, duels,
// portes nommées des exécuteurs — tryShot garde ses refus, choosePass ses couloirs) ; la
// POLITIQUE est remplaçable — `cfg.decide` injecte un arbitre aval complet (même contrat de
// retour : { meilleure: 'tir'|'centre'|'passe'|'conduite', … }), et le moteur l'écoute sans
// rien perdre de ses lois. PAS DE SECONDE VÉRITÉ : chaque note se calcule avec les MÊMES
// primitives que l'exécuteur qu'elle représente (laneClearance, le vrai choosePass, les mêmes
// seuils de position) — un arbitre qui inventerait sa propre géométrie divergerait du monde.
//
// Pur : un état entre, des notes sorent — testable au banc (verify-menace), sans navigateur.
// Clé absente (rondo, réduit futsal) : l'ancien ordre, au bit près (la consommation est gardée
// par cfg.menace && st.full dans le loop).

import { laneClearance } from './ball-predict.js';
import { choosePass } from './rondo.js';

/** LE TIR — proximité × couloir réel vers le meilleur coin (les mêmes lois que tryShot : portée,
 *  moitié, angle fermé, coin choisi contre le gardien, trafic toléré à bout portant). */
export function menaceTir(st, c, cfg) {
  const { pitch } = st;
  const goal = pitch.attackGoal(c.team);
  const d = Math.hypot(goal.x - c.p[0], c.p[2]);
  const R = cfg.shotRange ?? 15;
  if (c.keeper || d > R) return { score: 0, d: +d.toFixed(1), pourquoi: 'hors-portée' };
  if (Math.sign(c.p[0] || goal.x) !== Math.sign(goal.x) && d > R * 0.75) return { score: 0, d: +d.toFixed(1), pourquoi: 'sa-moitié' };
  if (Math.abs(c.p[2]) > pitch.goalHalf + 3 && d > 8.5) return { score: 0, d: +d.toFixed(1), pourquoi: 'angle-fermé' };
  const gk = st.players.find((p) => p.keeper && p.team !== c.team);
  const corners = [pitch.goalHalf - 0.55, -(pitch.goalHalf - 0.55)]
    .sort((a, b) => (gk ? Math.abs(b - gk.p[2]) - Math.abs(a - gk.p[2]) : 0));
  const blockers = st.players.filter((q) => q.team !== c.team && !q.keeper && q.down <= 0).map((q) => q.p);
  const need = d < 9 ? Math.min(cfg.shotClear ?? 0.45, 0.3) : (cfg.shotClear ?? 0.45);
  let margin = -1, tz = corners[0];
  for (const cz of corners) {
    const m = laneClearance([st.ball.p[0], 0, st.ball.p[2]], [goal.x, 0, cz], blockers).margin;
    if (m > margin) { margin = m; tz = cz; }
  }
  const laneF = Math.max(0, Math.min(1, margin / (need * 2)));      // 2× le besoin = pleine confiance
  const nearF = 1 - d / (R + 2);
  return {
    score: +((0.30 + 0.62 * nearF) * (0.25 + 0.75 * laneF)).toFixed(3),
    d: +d.toFixed(1), marge: +margin.toFixed(2), tz: +tz.toFixed(1),
    pourquoi: margin < need ? 'couloir-serré' : 'cadre-en-vue',
  };
}

/** LE CENTRE — les portes de position de tryCross (haut, large, boîte peuplée, cooldown), la
 *  note montant avec les cibles de surface. */
export function menaceCentre(st, c, cfg) {
  const { pitch } = st;
  const goal = pitch.attackGoal(c.team);
  const sgn = Math.sign(goal.x || 1);
  if (c.keeper) return { score: 0, pourquoi: 'gardien' };
  if ((st._crossCd?.[c.team] ?? -1) > st.t) return { score: 0, pourquoi: 'cooldown' };
  if (c.p[0] * sgn < pitch.hx - pitch.dims.box.depth - 9 || Math.abs(c.p[2]) < pitch.hz * 0.38) {
    return { score: 0, pourquoi: 'pas-en-position' };
  }
  const boxX = pitch.hx - pitch.dims.box.depth;
  const cibles = st.players.filter((q) => q.team === c.team && !q.keeper && q.id !== c.id && q.down <= 0
    && q.p[0] * sgn > boxX - 1.5 && Math.abs(q.p[2]) < pitch.dims.box.width / 2 + 1.5).length;
  if (!cibles) return { score: 0.05, pourquoi: 'boîte-vide' };
  return { score: +(0.34 + 0.14 * Math.min(2, cibles)).toFixed(3), cibles, pourquoi: 'surface-servie' };
}

/** LA PASSE — le VRAI cerveau de passe choisit (choosePass, pas une copie) ; la menace note ce
 *  que son élu VAUT : la progression vers le but, la liberté du couloir, la profondeur atteinte. */
export function menacePasse(st, c, cfg) {
  const best = choosePass(st, cfg);
  if (!best) return { score: 0.08, pourquoi: 'aucune-ligne' };
  const { pitch } = st;
  const goal = pitch.attackGoal(c.team);
  const dRec = Math.hypot(goal.x - best.to.p[0], best.to.p[2]);
  const dMoi = Math.hypot(goal.x - c.p[0], c.p[2]);
  const prog = Math.max(-1, Math.min(1, (dMoi - dRec) / 14));
  const libre = Math.min(1, (best.lane?.margin ?? 0) / 3);
  return {
    score: +(0.30 + 0.22 * prog + 0.18 * libre + 0.16 * Math.max(0, 1 - dRec / 30)).toFixed(3),
    vers: best.to.id, prog: +prog.toFixed(2),
    pourquoi: prog > 0.2 ? 'ligne-qui-progresse' : 'circulation',
  };
}

/** LA CONDUITE — l'espace RÉEL devant, dans le cône vers le but (~±35° sur 9 m) ; porter vaut
 *  plus loin du but (près, le tir et la passe doivent gagner — porter dans la surface est
 *  l'empalement déjà mesuré). */
export function menaceConduite(st, c, cfg) {
  const { pitch } = st;
  const goal = pitch.attackGoal(c.team);
  const gx = goal.x - c.p[0], gz = -c.p[2];
  const gl = Math.hypot(gx, gz) || 1;
  const ux = gx / gl, uz = gz / gl;
  let espace = 9;
  for (const q of st.players) {
    if (q.team === c.team || q.down > 0 || q.keeper) continue;
    const vx = q.p[0] - c.p[0], vz = q.p[2] - c.p[2];
    const along = vx * ux + vz * uz;
    if (along < 0 || along > 9) continue;
    if (Math.abs(vx * uz - vz * ux) < 1.4 + along * 0.7) espace = Math.min(espace, along);
  }
  const farF = Math.min(1, gl / pitch.hx);
  return {
    score: +(0.14 + 0.5 * (espace / 9) * (0.55 + 0.45 * farF)).toFixed(3),
    espace: +espace.toFixed(1),
    pourquoi: espace < 3 ? 'fermé-devant' : 'champ-devant',
  };
}

/**
 * L'ARBITRE — les quatre notes, pondérées par cfg.menace ({ tir, centre, passe, conduite } —
 * multiplicateurs, 1 par défaut), un gagnant, et chaque option porte son pourquoi. C'est LUI
 * que `cfg.decide` remplace chez un projet aval (même contrat de retour).
 */
export function arbitre(st, c, cfg) {
  const w = typeof cfg.menace === 'object' && cfg.menace ? cfg.menace : {};
  const o = {
    tir: menaceTir(st, c, cfg),
    centre: menaceCentre(st, c, cfg),
    passe: menacePasse(st, c, cfg),
    conduite: menaceConduite(st, c, cfg),
  };
  let meilleure = 'conduite', sMax = -Infinity;
  for (const k of ['tir', 'centre', 'passe', 'conduite']) {
    const s = o[k].score * (w[k] ?? 1);
    if (s > sMax) { sMax = s; meilleure = k; }
  }
  return { ...o, meilleure, score: +sMax.toFixed(3) };
}
