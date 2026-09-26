// effectif.js — LE GÉNÉRATEUR D'EFFECTIFS (26/09, retour au football : « sans oublier la tactique et leurs attributs » — mesuré : sans
// `squads`, makeMatch ne donne AUCUN p.skill, le match du produit et les bancs jouaient 22 joueurs identiques, notés 50 partout ; les 40
// notes du moteur (attributes.js) et leurs ~48 facteurs n'avaient rien à lire). Un effectif = 11 fiches { ratings, postes, name } dans
// l'ordre des postes de la formation, le DERNIER = le gardien (le contrat de makeMatch({ squads })). Chaque note = le NIVEAU de l'équipe
// + la QUALITÉ du joueur (± écart) + le PROFIL de son poste (le central marque et joue de la tête, l'ailier va vite et dribble, le 9 finit)
// + l'accent de son RÔLE (roles.js : le renard finit encore mieux, le meneur voit plus loin, le récupérateur tacle) + un bruit par note.
// Graine fixe → le même effectif. Moteur générique : aucune équipe réelle, aucun nom imposé (le projet passe les siens).
import { posteNom, litPoste } from './formation.js';

/** Les profils de poste : décalages (points) autour du niveau. Les clés = le vocabulaire d'attributes.js (+ flair). */
export const PROFILS = {
  GK: { keeping: 22, reactions: 18, handling: 18, aerialReach: 15, oneOnOnes: 12, command: 10, positioning: 10, composure: 5, kicking: 5, throwing: 5, pace: -15, acceleration: -12, dribbling: -25, finishing: -35, longShots: -30, passing: -10, crossing: -30, tackling: -30, heading: -20, flair: -20 },
  D:  { tackling: 18, marking: 18, positioning: 15, heading: 15, strength: 12, jumping: 12, concentration: 8, aggression: 5, anticipation: 6, dribbling: -12, finishing: -25, longShots: -15, crossing: -10, vision: -8, technique: -8, flair: -15 },
  DL: { pace: 12, acceleration: 10, stamina: 14, crossing: 12, tackling: 10, marking: 8, workRate: 10, heading: -4, finishing: -18, flair: -5 },
  WB: { pace: 14, acceleration: 12, stamina: 16, crossing: 14, workRate: 12, dribbling: 4, tackling: 4, finishing: -14 },
  DM: { tackling: 14, positioning: 14, anticipation: 12, teamwork: 10, workRate: 10, marking: 8, passing: 8, stamina: 8, decisions: 8, strength: 6, finishing: -15, flair: -8 },
  M:  { passing: 12, vision: 10, stamina: 12, workRate: 10, control: 8, decisions: 8, teamwork: 8, technique: 6, scanning: 6 },
  ML: { pace: 12, acceleration: 10, crossing: 12, dribbling: 10, stamina: 10, workRate: 6, tackling: -6 },
  AM: { vision: 14, technique: 14, dribbling: 12, passing: 10, offTheBall: 10, flair: 15, longShots: 8, finishing: 5, control: 8, tackling: -15, marking: -15, strength: -6 },
  AL: { pace: 15, acceleration: 14, dribbling: 15, flair: 15, crossing: 8, finishing: 5, offTheBall: 8, tackling: -15, marking: -12 },
  ST: { finishing: 20, offTheBall: 16, movement: 10, composure: 12, heading: 8, pace: 8, acceleration: 8, strength: 5, tackling: -20, marking: -20, passing: -5, positioning: -8 },
};
/** L'accent du rôle (roles.js, les noms historiques et FM) — ajouté au profil de poste. */
export const ACCENTS = {
  neufDeSurface: { finishing: 8, offTheBall: 8, heading: 5, passing: -6 }, poacher: { finishing: 10, offTheBall: 10, composure: 5, passing: -8, workRate: -8 },
  target_man: { heading: 12, strength: 12, jumping: 10, pace: -8 }, false_9: { vision: 10, passing: 10, technique: 8, finishing: -4 },
  pressing_striker: { workRate: 14, aggression: 8, stamina: 8, teamwork: 6 },
  meneur: { vision: 10, passing: 10, decisions: 6, technique: 6 }, regista: { passing: 12, vision: 12, composure: 8, tackling: -6 },
  half_space_playmaker: { vision: 10, technique: 8, passing: 8 }, box_to_box: { stamina: 12, workRate: 12, tackling: 6, finishing: 4 },
  recuperateur: { tackling: 10, workRate: 10, aggression: 8, anticipation: 6, passing: -4 }, anchor: { positioning: 12, anticipation: 10, tackling: 6 },
  piston: { stamina: 10, crossing: 8, pace: 6, workRate: 6 }, wing_back: { stamina: 10, crossing: 8, pace: 6 },
  ailierDePercussion: { dribbling: 10, pace: 6, flair: 8, acceleration: 6 }, winger: { crossing: 10, pace: 8, dribbling: 6 },
  inside_forward: { finishing: 8, dribbling: 8, longShots: 6 }, stopper: { aggression: 10, tackling: 8, strength: 6 },
};

/** La famille de profil d'un poste nommé (formation.js : 'D(G)', 'ST(C)', 'GK(C)'…). */
export function familleDe(nom) {
  const p = litPoste(nom); if (!p) return 'M';
  const lat = p.cote === 'G' || p.cote === 'D';
  switch (p.strate) {
    case 'GK': return 'GK';
    case 'D': return lat ? 'DL' : 'D';
    case 'WB': return 'WB';
    case 'DM': return 'DM';
    case 'M': return lat ? 'ML' : 'M';
    case 'AM': return lat ? 'AL' : 'AM';
    default: return 'ST';
  }
}

/** Les notes du seul métier de gardien : un joueur de champ n'y vaut rien (−25). */
const GARDIEN = ['keeping', 'handling', 'aerialReach', 'oneOnOnes', 'command', 'throwing'];
const NOTES = ['pace', 'acceleration', 'passing', 'control', 'dribbling', 'finishing', 'longShots', 'shotPower', 'tackling', 'teamwork', 'anticipation', 'aerialReach', 'oneOnOnes', 'command', 'reactions', 'composure', 'keeping', 'agility', 'stamina', 'strength', 'jumping', 'vision', 'technique', 'handling', 'heading', 'crossing', 'weakFoot', 'kicking', 'throwing', 'decisions', 'offTheBall', 'scanning', 'movement', 'positioning', 'workRate', 'aggression', 'concentration', 'marking', 'flair'];

/**
 * genererEffectif — 11 fiches pour une formation et ses rôles.
 * @param {{ formation?: string|number, roles?: Record<number,string>, niveau?: number, ecart?: number, bruit?: number, graine?: number, noms?: string[] }} o
 *   niveau : la note moyenne de l'équipe (50 = le joueur moyen du moteur, l'identité) ; ecart : l'écart-type de QUALITÉ entre joueurs ;
 *   bruit : l'écart-type de chaque note autour de son profil.
 */
export function genererEffectif({ formation = '433', roles = {}, niveau = 60, ecart = 6, bruit = 7, graine = 1, noms = null } = {}) {
  let s = (graine * 2654435761 + 97) >>> 0; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const gauss = () => { const u = Math.max(1e-9, rnd()), v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const out = [];
  for (let k = 0; k <= 10; k++) {
    const nom = posteNom(formation, k), fam = familleDe(nom), P = PROFILS[fam], A = ACCENTS[roles?.[k]] ?? {};
    const qualite = niveau + gauss() * ecart, ratings = {};
    for (const n of NOTES) ratings[n] = Math.round(Math.max(20, Math.min(97, qualite + (P[n] ?? 0) + (A[n] ?? 0) + (fam !== 'GK' && GARDIEN.includes(n) ? -25 : 0) + gauss() * bruit)));
    out.push({ ratings, postes: [nom], ...(noms?.[k] ? { name: noms[k] } : {}) });
  }
  return out;
}

/** CONTRAT — les profils se lisent : le 9 finit mieux que le central, le central marque mieux que le 9, le gardien garde ; graine fixe → même effectif. */
export function checkEffectif() {
  const issues = [], moy = (E, idx, n) => idx.reduce((a, i) => a + E[i].ratings[n], 0) / idx.length;
  const L = []; for (let g = 1; g <= 20; g++) L.push(genererEffectif({ formation: '433', graine: g }));
  const m = (idx, n) => L.reduce((a, E) => a + moy(E, idx, n), 0) / L.length;
  if (!(m([8], 'finishing') > m([1, 2], 'finishing') + 25)) issues.push('le 9 ne finit pas mieux que les centraux');
  if (!(m([1, 2], 'marking') > m([8], 'marking') + 25)) issues.push('les centraux ne marquent pas mieux que le 9');
  if (!(m([10], 'keeping') > m([5], 'keeping') + 30)) issues.push('le gardien ne garde pas');
  if (JSON.stringify(genererEffectif({ graine: 7 })) !== JSON.stringify(genererEffectif({ graine: 7 }))) issues.push('graine fixe, effectifs différents');
  const avg = L.reduce((a, E) => a + E.reduce((b, f) => b + Object.values(f.ratings).reduce((c, v) => c + v, 0) / NOTES.length, 0) / 11, 0) / L.length;
  if (Math.abs(avg - 60) > 6) issues.push(`niveau moyen ${avg.toFixed(1)} loin du niveau demandé 60`);
  return { ok: issues.length === 0, issues };
}
