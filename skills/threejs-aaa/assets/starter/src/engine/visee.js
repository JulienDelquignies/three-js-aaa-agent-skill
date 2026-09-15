// visee.js — LE POINT VISÉ (277, cfg.visee && st.full — Modèle 10 §3.4 : « le point visé n'est pas “le coin” : c'est un
// tirage dans un mélange » — Baron, Sandholtz, Pleuler & Chan, Miss It Like Messi, JQAS 2024 : un mélange hiérarchique de
// gaussiennes tronquées sur le point de franchissement du plan de but (y, z), 77 315 tirs StatsBomb). Le tireur d'hier
// visait TOUJOURS le coin loin du gardien à 0,55 m du poteau (tz contre gk.z), et sa hauteur au tirage du 258 : à ρ 3,9 m
// p50 du gardien, aucune enveloppe du book ne l'atteignait (276), et 47-50 % des tirs étaient cadrés (réel 33). Ici le
// mélange à NEUF MODES du book (les poids [À CALIBRER] contraints par 36-38 % hors cadre, au-dessus / à côté ≈ 1,5, 2,2-2,5 %
// sur le cadre) : lucarne côté ouvert (± 3,0 ; 1,95 — composure élevée, gardien avancé), bas côté ouvert (± 2,9 ; 0,35 —
// le mode dominant), mi-hauteur côté ouvert (± 2,7 ; 1,0), bas côté fermé — le contre-pied (∓ 2,6 ; 0,35 — gardien engagé,
// flair), mi-hauteur côté fermé (∓ 2,4 ; 1,0), sous la barre axial (0 ; 2,05 — le lob), axial bas (0 ; 0,35 — urgence, bout
// portant), premier poteau ras (± 3,3 ; 0,2 — angle fermé), « vers le cadre » (± 1,5 ; 0,9 — pression). Le CÔTÉ OUVERT est
// déterminé par le décentrage du gardien η (le tireur vise le côté où l'enveloppe est la plus loin) ; sous forte pression
// le mélange S'EFFONDRE vers « vers le cadre » (le rétrécissement du panier, ch. 6 §9.2) ; la troncature z ≥ 0 est
// obligatoire. Attributs en facteurs : composure (la lucarne, 1 au 50), flair (le contre-pied, persona), la finition par
// la dispersion du 258 qui s'ajoute au point visé. Un tirage seedé au flux 'tir'. Clé absente : le coin d'hier au bit.
import { pressionDe } from './reception.js';
import { tirage } from './rng.js';

export const MODES = [
  { id: 'lucarne-ouvert', z: 3.0, y: 1.95, w: 0.05, cote: 'ouvert' },
  { id: 'bas-ouvert', z: 2.9, y: 0.35, w: 0.26, cote: 'ouvert' },
  { id: 'mi-ouvert', z: 2.7, y: 1.0, w: 0.17, cote: 'ouvert' },
  { id: 'bas-ferme', z: 2.6, y: 0.35, w: 0.14, cote: 'ferme' },
  { id: 'mi-ferme', z: 2.4, y: 1.0, w: 0.08, cote: 'ferme' },
  { id: 'barre-axial', z: 0, y: 2.05, w: 0.04, cote: 'axe' },
  { id: 'axial-bas', z: 0, y: 0.35, w: 0.09, cote: 'axe' },
  { id: 'premier-poteau', z: 3.3, y: 0.2, w: 0.10, cote: 'premier' },
  { id: 'cadre', z: 1.5, y: 0.9, w: 0.07, cote: 'ouvert' },
];

/** LES POIDS CONDITIONNÉS (§ 3.4, la colonne « conditionnement ») : composure → la lucarne, flair et gardien engagé → le
 *  contre-pied, gardien avancé → lucarne et lob, angle fermé → le premier poteau, bout portant → l'axial bas ; puis la
 *  pression P effondre le mélange vers « vers le cadre » (s = (P − p0) / largeur). Rend les poids normalisés. Pure. */
export function poidsDe({ composure = 0.5, flair = 0.5, gAvance = 0, angle = 0, D = 15, P = 0 }, K) {
  const F = K.facteurs ?? {};
  const w = MODES.map((m) => {
    let f = 1;
    if (m.id === 'lucarne-ouvert') f *= (0.5 + composure) * (gAvance >= (F.gAvance ?? 3) ? (F.lucarneAvance ?? 1.5) : 1);
    if (m.id === 'barre-axial') f *= gAvance >= (F.gAvance ?? 3) ? (F.lobAvance ?? 2) : 1;
    if (m.cote === 'ferme') f *= (0.5 + flair) * (gAvance >= (F.gEngage ?? 1.5) ? (F.contrePied ?? 1.3) : 1);
    if (m.id === 'premier-poteau') f *= angle >= (F.angleFerme ?? 0.6) ? (F.premierPoteau ?? 2) : 1;
    if (m.cote === 'ouvert' && m.id !== 'cadre') f *= angle >= (F.angleFerme ?? 0.6) ? (F.ouvertFerme ?? 0.7) : 1;
    if (m.id === 'axial-bas') f *= D <= (F.boutPortant ?? 8) ? (F.axialPres ?? 2) : 1;
    return m.w * f;
  });
  const tot = w.reduce((a, b) => a + b, 0), s = Math.max(0, Math.min(1, (P - (K.pression?.p0 ?? 0.5)) / (K.pression?.largeur ?? 0.4)));
  return w.map((v, i) => (1 - s) * v / tot + s * (MODES[i].id === 'cadre' ? 1 : 0));
}

/** LE POINT VISÉ d'un tireur : { id, z, y, cote } sur le plan du but (z signé dans le monde, y en m), le côté ouvert lu du
 *  décentrage du gardien, le premier poteau du côté du tireur, tronqué au cadre. Un tirage au flux 'tir'. */
export function viseeDe(st, c, cfg, { goal, gk, dGoal }) {
  const K = cfg.visee, W2 = st.pitch.goalHalf ?? 3.66, s = Math.sign(goal.x || 1);
  const X = Math.max(0.3, (goal.x - c.p[0]) * s), cz = c.p[2];
  const zb = cz + X * Math.tan((Math.atan2(-W2 - cz, X) + Math.atan2(W2 - cz, X)) / 2);   // la bissectrice du cône au plan du but
  const ouvert = gk ? (gk.p[2] - zb > 0 ? -1 : 1) : (cz > 0 ? -1 : 1), premier = Math.sign(cz) || ouvert;
  const gAvance = gk ? Math.abs(gk.p[0] - goal.x) : 0;
  const composure = c.skill?.composureF != null ? Math.max(0, Math.min(1, (1.30 - c.skill.composureF) / 0.45)) : 0.5;
  const flair = c.persona?.flair != null ? Math.max(0, Math.min(1, (c.persona.flair - 0.15) / 0.85)) : 0.5;
  const P = pressionDe(st, c, { pressT: K.pressT ?? 1.5 }, cfg).P;
  const w = poidsDe({ composure, flair, gAvance, angle: Math.abs(cz) / X, D: dGoal, P }, K);
  const u = tirage(st, 'tir', c.id, st.rnd ?? (() => 0.5))();
  let acc = 0, m = MODES[MODES.length - 1];
  for (let i = 0; i < MODES.length; i++) { acc += w[i]; if (u < acc) { m = MODES[i]; break; } }
  const side = m.cote === 'ouvert' ? ouvert : m.cote === 'ferme' ? -ouvert : m.cote === 'premier' ? premier : 0;
  const z = Math.max(-(W2 - (K.bord ?? 0.1)), Math.min(W2 - (K.bord ?? 0.1), side * m.z)), y = Math.max(K.yMin ?? 0.1, m.y);
  return { id: m.id, z, y, cote: m.cote, P, ouvert, w };
}
