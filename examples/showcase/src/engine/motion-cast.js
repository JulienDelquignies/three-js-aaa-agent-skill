// motion-cast — LE CASTING DES GESTES GÉNÉRÉS : un joueur, son rig, son style, ses gestes — et le
// REGISTRE des générateurs (quelle famille dessine quel geste).
//
// La scène spawn des corps depuis un ROSTER (squad.js) ; les gestes générés ne sont plus des specs
// de la table, ils sont CALCULÉS (motion-strike, motion-control, motion-aerial, motion-skill) contre le squelette
// RÉEL de chaque template — ses orientations bind, ses longueurs, l'échelle du squad — et non contre
// le profil de référence baké (motion-profile-shanon, qui ne sert qu'aux MOVES par défaut et au banc).
// Un autre rig (?rig=) a ses propres jambes : la sonde des signes (checkProfile) le prouve au
// chargement, et un rig aux axes inconnus se DIT dans le rapport au lieu de frapper de travers.
//
// LE STYLE (retour utilisateur : « différents types de geste pour le même geste, quelques
// détails par joueur ») est une fonction pure de l'identité du joueur et de la graine du monde :
// le même joueur frappe toujours pareil, deux joueurs jamais tout à fait pareil. Les gestes se
// génèrent à la PREMIÈRE demande (quelques ms — pas 22 corps × 20 espèces au coup d'envoi) et se
// gardent sur le joueur. Pur : aucune dépendance rendu — le parent de Hips est lu par sa matrice
// monde (16 nombres), pas par three.

import { profileFromBones, checkProfile } from './motion-rig.js';
import { KINDS as STRIKE_KINDS, generateStrike, checkStrikeGen, styleFromSeed } from './motion-strike.js';
import { CONTROL_KINDS, generateControl, checkControlGen } from './motion-control.js';
import { AERIAL_KINDS, generateAerial, checkAerialGen } from './motion-aerial.js';
import { SKILL_KINDS, generateSkill, checkSkillGen } from './motion-skill.js';
import { GROUND_KINDS, generateGround, checkGroundGen } from './motion-ground.js';
import { KEEPER_KINDS, generateKeeper, checkKeeperGen } from './motion-keeper.js';
import { RESTART_KINDS, generateRestart, checkRestartGen } from './motion-restart.js';

/** LE REGISTRE : geste → { family, generate(P, opts), check(spec, P, opts) }. */
export const GENERATORS = {};
for (const k of Object.keys(STRIKE_KINDS)) GENERATORS[k] = { family: 'strike', generate: (P, o) => generateStrike(k, P, o), check: (spec, P, o) => checkStrikeGen(spec, P, k, o) };
for (const k of Object.keys(CONTROL_KINDS)) GENERATORS[k] = { family: 'control', generate: (P, o) => generateControl(k, P, o), check: (spec, P, o) => checkControlGen(spec, P, k, o) };
for (const k of Object.keys(AERIAL_KINDS)) GENERATORS[k] = { family: 'aerial', generate: (P, o) => generateAerial(k, P, o), check: (spec, P) => checkAerialGen(spec, P, k) };
for (const k of Object.keys(SKILL_KINDS)) GENERATORS[k] = { family: 'skill', generate: (P, o) => generateSkill(k, P, o), check: (spec, P) => checkSkillGen(spec, P, k) };
for (const k of Object.keys(GROUND_KINDS)) GENERATORS[k] = { family: 'ground', generate: (P, o) => generateGround(k, P, o), check: (spec, P) => checkGroundGen(spec, P, k) };
for (const k of Object.keys(KEEPER_KINDS)) GENERATORS[k] = { family: 'keeper', generate: (P, o) => generateKeeper(k, P, o), check: (spec, P) => checkKeeperGen(spec, P, k) };
for (const k of Object.keys(RESTART_KINDS)) GENERATORS[k] = { family: 'restart', generate: (P, o) => generateRestart(k, P, o), check: (spec, P) => checkRestartGen(spec, P, k) };
export const GENERATED_KINDS = Object.keys(GENERATORS);

/** Générer un geste par son nom (null si le geste n'est pas généré). */
export function generateMove(name, P, opts = {}) {
  const g = GENERATORS[name];
  return g ? g.generate(P, opts) : null;
}

/** Rotation (quaternion) et échelle uniforme d'une matrice 4×4 colonne-major (three.js). */
function decomposeElements(e) {
  const sx = Math.hypot(e[0], e[1], e[2]) || 1, sy = Math.hypot(e[4], e[5], e[6]) || 1, sz = Math.hypot(e[8], e[9], e[10]) || 1;
  const m = [[e[0] / sx, e[4] / sy, e[8] / sz], [e[1] / sx, e[5] / sy, e[9] / sz], [e[2] / sx, e[6] / sy, e[10] / sz]];
  const tr = m[0][0] + m[1][1] + m[2][2];
  let q;
  if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; q = [(m[2][1] - m[1][2]) / s, (m[0][2] - m[2][0]) / s, (m[1][0] - m[0][1]) / s, s / 4]; }
  else if (m[0][0] > m[1][1] && m[0][0] > m[2][2]) { const s = Math.sqrt(1 + m[0][0] - m[1][1] - m[2][2]) * 2; q = [s / 4, (m[0][1] + m[1][0]) / s, (m[0][2] + m[2][0]) / s, (m[2][1] - m[1][2]) / s]; }
  else if (m[1][1] > m[2][2]) { const s = Math.sqrt(1 + m[1][1] - m[0][0] - m[2][2]) * 2; q = [(m[0][1] + m[1][0]) / s, s / 4, (m[1][2] + m[2][1]) / s, (m[0][2] - m[2][0]) / s]; }
  else { const s = Math.sqrt(1 + m[2][2] - m[0][0] - m[1][1]) * 2; q = [(m[0][2] + m[2][0]) / s, (m[1][2] + m[2][1]) / s, s / 4, (m[1][0] - m[0][1]) / s]; }
  return { q, s: sy, p: [e[12], e[13], e[14]] };
}

/**
 * Le profil de mouvement d'un template de squad (calculé une fois, gardé sur l'entrée).
 * @param entry  { bones: Map canonique → os three (template, jamais animé), scale }
 * @param report tableau où déposer les défauts du profil (le rapport de la scène)
 */
export function motionProfileOf(entry, report = null) {
  if (entry.motionProfile) return entry.motionProfile;
  const par = entry.bones.get('Hips')?.parent;
  let rootQ = [0, 0, 0, 1], rootP = [0, 0, 0], scale = entry.scale ?? 1;
  if (par) {
    par.updateWorldMatrix?.(true, false);
    const d = decomposeElements(par.matrixWorld.elements);
    rootQ = d.q; rootP = d.p.map((v) => v * (entry.scale ?? 1)); scale = (entry.scale ?? 1) * d.s;
  }
  entry.motionProfile = profileFromBones(entry.bones, { rootQ, rootP, scale });
  const cp = checkProfile(entry.motionProfile);
  if (!cp.ok && report) report.push(`profil du rig ${entry.spec?.name || entry.spec?.url || '?'} : ${cp.issues.join(' ; ')}`);
  return entry.motionProfile;
}

/** Ce que la scène accroche au joueur : { profile, style, moves } — `moves` se remplit à la demande. */
export function castStrikes(entry, player, seed = 7, report = null) {
  return { profile: motionProfileOf(entry, report), style: styleFromSeed(player.id * 7919 + seed), moves: {} };
}

/** Le geste GÉNÉRÉ de ce joueur (frappe, contrôle, tête…) — null si le geste n'est pas généré.
 *  (Le nom reste `strikeSpec` : c'est la ligne de la scène, qui vit au plafond de volumétrie.) */
export function strikeSpec(pl, move) {
  if (!GENERATORS[move] || !pl.profile) return null;
  return (pl.moves[move] ??= GENERATORS[move].generate(pl.profile, { style: pl.style }));
}
