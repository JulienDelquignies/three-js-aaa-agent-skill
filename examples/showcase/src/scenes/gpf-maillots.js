import * as THREE from 'three/webgpu';
import { texture, uv, vec2, vec3, vec4, float, step, smoothstep, mix, clamp, dot, length, abs, max, min, fract, fwidth, normalize, normalMap, normalView, materialReference, luminance, select } from 'three/tsl';
import { drawCrest } from '../engine/club-theme.js';

// gpf-maillots.js — LES TENUES de /match11 (lot L5, EX-27 : des tenues « hyper complètes » — motifs de maillot, de short, de chaussettes,
// chaussures, manches courtes ou longues ou sous-maillot, maillot dans ou hors du short, chaussettes basses, moyennes ou hautes,
// antidérapantes, strap, cuissard, bandage de la main, strap des poignets, gants, brassard, nom et numéro floqués). Les footballeurs
// Rocketbox (n° 18, n° 10) portent leur tenue DANS leur texture : on la repeint, en deux couches.
//
// 1. LA TENUE D'ÉQUIPE (peindreTenue, un canevas par corps et par tenue) : le motif du maillot dans l'espace du corps (rayures, cerceaux,
//    moitiés, écharpe, damier, chevron…), le liseré, le motif du short et des chaussettes, l'écusson et le sponsor du club. La carte du maillot
//    (public/rocketbox/maillot-zones.png, maillot-carte.json — tools/maillot-carte.py) dit, texel par texel, ce qui est maillot, liseré,
//    short, chaussette, peau du bras, main, peau de la jambe, chaussure ; LA FORME de chaque corps (où ce texel est sur le corps au repos, le
//    relief des plis) est tirée de son maillage au chargement (formeDuCorps), en flottants.
// 2. LE JOUEUR (le shader, UN programme pour les 22) : ce qui change d'un joueur à l'autre, sans aucune texture par joueur — des réglages
//    du matériau lus par RÉFÉRENCE (materialReference) dans un graphe construit une fois. Tout se mesure sur le corps au repos (la carte
//    de forme) : la hauteur (la chaussette, la ceinture), la distance le long du bras depuis l'épaule (la manche, le poignet, le brassard),
//    la distance au poignet (le bandage). Mesuré sur la carte (3 octobre) : la manche courte s'arrête à 0,22 m de l'épaule, le bras fait
//    0,557 m jusqu'au poignet ; le haut du short est à 0,953 m, l'ourlet du maillot à 0,86 m, celui du short à 0,575 m ; la chaussette
//    monte à 0,442 m, le genou est à 0,497 m, la chaussure s'arrête à 0,12 m.
//    LE FLOCAGE est léger : UN alphabet en champ de distance (SDF, 384 × 512, pour tous les joueurs), le nom et le numéro de chaque joueur
//    passés en indices de glyphes et en positions (une chasse proportionnelle) ; dessinés à leur TAILLE RÉELLE (les zones d'impression
//    sont mesurées en mètres), centrés sur la colonne vertébrale, bords nets de près, un contour fin.
// three identifie chaque nœud de shader par son id (Node.customCacheKey) : vingt-deux graphes construits à part feraient vingt-deux
// programmes ; et la passe d'ombre dérive une variante par matériau de sa `map` et de son `colorNode` — le matériau de tenue n'expose ni
// l'un ni l'autre hors de la construction de son rendu (MateriauTenue).

/** LES TENUES D'ÉQUIPE toutes faites (fictives) — l'identifiant sert à l'adresse (?tenue0=rouge-blanc-raye) et à la sauvegarde. Champs : motif
 *  du maillot, c1 (dominante), c2 (seconde), liseré, short et son motif (shortB : sa seconde couleur), chaussettes, leur bande et leur motif,
 *  numéro (couleur, contour). */
export const TENUES = {
  'raye-noir-blanc': { nom: 'rayé noir et blanc', motif: 'rayures', c1: 0xf2f2f2, c2: 0x161616, lisere: 0x161616, short: 0x161616, motifShort: 'uni', shortB: 0xf2f2f2, chaussettes: 0x161616, bande: 0xf2f2f2, motifChaussettes: 'bande', num: 0x161616, numBord: 0xf2f2f2 },
  'bleu-ciel': { nom: 'bleu ciel', motif: 'uni', c1: 0x8fcbef, c2: 0xffffff, lisere: 0xffffff, short: 0xffffff, motifShort: 'bande', shortB: 0x8fcbef, chaussettes: 0x8fcbef, bande: 0xffffff, motifChaussettes: 'revers', num: 0x0f2a44, numBord: 0xffffff },
  'rouge-blanc-raye': { nom: 'rouge et blanc rayé', motif: 'rayures', c1: 0xd0202e, c2: 0xf4f4f4, lisere: 0xf4f4f4, short: 0x111111, motifShort: 'uni', shortB: 0xd0202e, chaussettes: 0x111111, bande: 0xd0202e, motifChaussettes: 'deux-bandes', num: 0x111111, numBord: 0xf4f4f4 },
  'vert-blanc-cercle': { nom: 'vert et blanc cerclé', motif: 'cerceaux', c1: 0x0f8a4c, c2: 0xf4f4f4, lisere: 0xf4f4f4, short: 0xf4f4f4, motifShort: 'uni', shortB: 0x0f8a4c, chaussettes: 0xf4f4f4, bande: 0x0f8a4c, motifChaussettes: 'cerceaux', num: 0x0f8a4c, numBord: 0xf4f4f4 },
  'bleu-roi': { nom: 'bleu roi', motif: 'uni', c1: 0x1f3aa8, c2: 0xffffff, lisere: 0xffffff, short: 0xffffff, motifShort: 'bas', shortB: 0x1f3aa8, chaussettes: 0x1f3aa8, bande: 0xffffff, motifChaussettes: 'bande', num: 0xffffff, numBord: 0x0d1a52 },
  'orange': { nom: 'orange', motif: 'uni', c1: 0xf07a12, c2: 0x111111, lisere: 0x111111, short: 0x111111, motifShort: 'bande', shortB: 0xf07a12, chaussettes: 0xf07a12, bande: 0x111111, motifChaussettes: 'bande', num: 0x111111, numBord: 0xf07a12 },
  'blanc-a-echarpe-rouge': { nom: 'blanc à écharpe rouge', motif: 'echarpe', c1: 0xf6f6f6, c2: 0xc8102e, lisere: 0xc8102e, short: 0xf6f6f6, motifShort: 'bas', shortB: 0xc8102e, chaussettes: 0xf6f6f6, bande: 0xc8102e, motifChaussettes: 'revers', num: 0x111111, numBord: 0xf6f6f6 },
  'grenat-bleu-moities': { nom: 'grenat et bleu, moitiés', motif: 'moities', c1: 0x8e1b3a, c2: 0x1a3c8c, lisere: 0xf0c419, short: 0x1a3c8c, motifShort: 'deux-tons', shortB: 0x8e1b3a, chaussettes: 0x8e1b3a, bande: 0xf0c419, motifChaussettes: 'deux-bandes', num: 0xf0c419, numBord: 0x2a0e18 },
  'blanc-a-bande-rouge': { nom: 'blanc à bande rouge', motif: 'bande', c1: 0xf6f6f6, c2: 0xc8102e, lisere: 0xc8102e, short: 0xf6f6f6, motifShort: 'bande', shortB: 0xc8102e, chaussettes: 0xf6f6f6, bande: 0xc8102e, motifChaussettes: 'bande', num: 0x111111, numBord: 0xf6f6f6 },
  'jaune-vert': { nom: 'jaune et vert', motif: 'uni', c1: 0xf6d01a, c2: 0x0f7a3a, lisere: 0x0f7a3a, short: 0x1f3aa8, motifShort: 'uni', shortB: 0xf6d01a, chaussettes: 0xf6f6f6, bande: 0x0f7a3a, motifChaussettes: 'revers', num: 0x0f7a3a, numBord: 0xf6d01a },
  'violet': { nom: 'violet', motif: 'uni', c1: 0x5b2a86, c2: 0xf4f4f4, lisere: 0xf4f4f4, short: 0x5b2a86, motifShort: 'bande', shortB: 0xf4f4f4, chaussettes: 0x5b2a86, bande: 0xf4f4f4, motifChaussettes: 'bande', num: 0xf4f4f4, numBord: 0x2a1040 },
  'noir-or': { nom: 'noir et or', motif: 'uni', c1: 0x151515, c2: 0xd4a017, lisere: 0xd4a017, short: 0x151515, motifShort: 'bande', shortB: 0xd4a017, chaussettes: 0x151515, bande: 0xd4a017, motifChaussettes: 'deux-bandes', num: 0xd4a017, numBord: 0x151515 },
  'bleu-blanc-raye': { nom: 'bleu et blanc rayé', motif: 'rayures', c1: 0x1e5bb8, c2: 0xf4f4f4, lisere: 0xf4f4f4, short: 0xf4f4f4, motifShort: 'uni', shortB: 0x1e5bb8, chaussettes: 0x1e5bb8, bande: 0xf4f4f4, motifChaussettes: 'bande', num: 0x0e2a5a, numBord: 0xf4f4f4 },
  'rouge': { nom: 'rouge', motif: 'uni', c1: 0xc8202f, c2: 0xf4f4f4, lisere: 0xf4f4f4, short: 0xf4f4f4, motifShort: 'uni', shortB: 0xc8202f, chaussettes: 0xc8202f, bande: 0xf4f4f4, motifChaussettes: 'bande', num: 0xf4f4f4, numBord: 0x5a0d14 },
  'vert': { nom: 'vert', motif: 'uni', c1: 0x11843f, c2: 0xf4f4f4, lisere: 0xf4f4f4, short: 0xf4f4f4, motifShort: 'uni', shortB: 0x11843f, chaussettes: 0x11843f, bande: 0xf4f4f4, motifChaussettes: 'uni', num: 0xf4f4f4, numBord: 0x063a1b },
  'blanc': { nom: 'blanc', motif: 'uni', c1: 0xf4f4f4, c2: 0x101820, lisere: 0x101820, short: 0x101820, motifShort: 'uni', shortB: 0xf4f4f4, chaussettes: 0xf4f4f4, bande: 0x101820, motifChaussettes: 'uni', num: 0x101820, numBord: 0xf4f4f4 },
  'damier-rouge-blanc': { nom: 'damier rouge et blanc', motif: 'damier', c1: 0xd51f2f, c2: 0xf6f6f6, lisere: 0x1f3aa8, short: 0xf6f6f6, motifShort: 'uni', shortB: 0xd51f2f, chaussettes: 0x1f3aa8, bande: 0xf6f6f6, motifChaussettes: 'bande', num: 0x1f3aa8, numBord: 0xf6f6f6 },
  'blanc-chevron-noir': { nom: 'blanc à chevron noir', motif: 'chevron', c1: 0xf6f6f6, c2: 0x141414, lisere: 0x141414, short: 0x141414, motifShort: 'bas', shortB: 0xf6f6f6, chaussettes: 0xf6f6f6, bande: 0x141414, motifChaussettes: 'revers', num: 0x141414, numBord: 0xf6f6f6 },
  'bleu-fines-rayures': { nom: 'bleu marine à fines rayures', motif: 'fines', c1: 0x13234f, c2: 0x6a8fd8, lisere: 0xf2f2f2, short: 0x13234f, motifShort: 'bande', shortB: 0xf2f2f2, chaussettes: 0x13234f, bande: 0xf2f2f2, motifChaussettes: 'deux-bandes', num: 0xf2f2f2, numBord: 0x13234f },
  'jaune-manches-noires': { nom: 'jaune, manches noires', motif: 'raglan', c1: 0xf6c81a, c2: 0x151515, lisere: 0x151515, short: 0x151515, motifShort: 'uni', shortB: 0xf6c81a, chaussettes: 0xf6c81a, bande: 0x151515, motifChaussettes: 'bande', num: 0x151515, numBord: 0xf6c81a },
};
export const MOTIFS = { uni: 'Uni', rayures: 'Rayures', fines: 'Fines rayures', cerceaux: 'Cerceaux', moities: 'Moitiés', quartiers: 'Quartiers', echarpe: 'Écharpe', bande: 'Bande centrale', poitrine: 'Bande de poitrine', chevron: 'Chevron', damier: 'Damier', raglan: 'Manches contrastées' };
export const MOTIFS_SHORT = { uni: 'Uni', bande: 'Bande sur le côté', bas: 'Bas contrasté', 'deux-tons': 'Deux tons' };
export const MOTIFS_CHAUSSETTES = { uni: 'Unies', bande: 'Bande en haut', 'deux-bandes': 'Deux bandes', revers: 'Revers', cerceaux: 'Cerclées' };
const CODE_SHORT = { uni: 0, bande: 1, bas: 2, 'deux-tons': 3 }, CODE_CHAUSSETTES = { uni: 0, bande: 1, 'deux-bandes': 2, revers: 3, cerceaux: 4 };
/** LES CHAUSSURES : deux couleurs posées sur le dessin de la chaussure d'origine (la dominante ; le détail : semelle, crampons, logo). */
export const CHAUSSURES = {
  noire: { nom: 'noires', c1: 0x161616, c2: 0xf0f0f0 }, blanche: { nom: 'blanches', c1: 0xf2f2f2, c2: 0x161616 },
  orange: { nom: 'orange fluo', c1: 0xff6a13, c2: 0x161616 }, jaune: { nom: 'jaune fluo', c1: 0xe6f018, c2: 0x161616 },
  rose: { nom: 'roses', c1: 0xff4fa3, c2: 0x161616 }, bleue: { nom: 'bleu électrique', c1: 0x1e6bff, c2: 0xf2f2f2 },
  verte: { nom: 'vert fluo', c1: 0x3cf26a, c2: 0x161616 }, argent: { nom: 'argent', c1: 0xc8ccd2, c2: 0x2a2a2a },
  rouge: { nom: 'rouges', c1: 0xd81e2c, c2: 0xf2f2f2 }, 'noire-or': { nom: 'noir et or', c1: 0x161616, c2: 0xd4a017 },
  cyan: { nom: 'cyan', c1: 0x18d4e8, c2: 0x161616 }, violette: { nom: 'violettes', c1: 0x7a3cff, c2: 0xf2f2f2 },
};
/** L'ÉQUIPEMENT D'UN JOUEUR : les options à plusieurs choix et leurs libellés (les autres sont des cases : antidérapantes, strap des
 *  chaussettes, cuissard, gants, brassard). */
export const EQUIPEMENT = {
  manches: { courtes: 'Courtes', longues: 'Longues', 'sous-maillot': 'Courtes sur un sous-maillot' },
  chaussettes: { moyennes: 'Sous le genou', hautes: 'Au-dessus du genou', basses: 'Basses (à la Hamšík)' },
  maillot: { dehors: 'Hors du short', rentre: 'Dans le short' },
  bandage: { aucun: 'Aucun', droite: 'Main droite (à la Benzema)', gauche: 'Main gauche', deux: 'Les deux mains' },
  poignets: { aucun: 'Aucun', droit: 'Poignet droit', gauche: 'Poignet gauche', deux: 'Les deux poignets' },
};
/** Les couleurs des accessoires (sous-maillot, antidérapantes, cuissard, gants) : 'equipe' prend la couleur de la tenue. */
export const TEINTES = { noir: { nom: 'noir', hex: 0x151515 }, blanc: { nom: 'blanc', hex: 0xf2f2f2 }, equipe: { nom: 'de l’équipe', hex: null } };
/** Les couleurs du gardien, dans l'ordre de préférence : la plus éloignée des deux équipes l'emporte. */
const GARDIENS = [0xf5cc29, 0x3cc35a, 0xf28c28, 0xe8508f, 0x8a4fd6, 0x25c5d6, 0x9aa0a6, 0x111111];

const rgbDe = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
/** L'écart perçu entre deux couleurs (une distance pondérée, « redmean ») — 0 à ~765. */
export function ecart(a, b) {
  const [r1, g1, b1] = rgbDe(a), [r2, g2, b2] = rgbDe(b), rm = (r1 + r2) / 2, dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
}
/** LE CONFLIT DE COULEURS (EX-27) : deux maillots trop proches (couleur dominante) — l'équipe qui se déplace change. */
export function conflit(A, B) { return ecart(A.c1, B.c1) < 120 || (A.motif !== 'uni' && ecart(A.c1, B.c2) < 90 && ecart(A.c2, B.c1) < 90); }
/** Le gardien d'une équipe : la couleur la plus éloignée des deux tenues (et de l'autre gardien). */
export function gardienPour(A, B, autre = null) {
  let best = GARDIENS[0], bestD = -1;
  for (const c of GARDIENS) {
    if (autre != null && ecart(c, autre) < 140) continue;
    const d = Math.min(ecart(c, A.c1), ecart(c, A.c2), ecart(c, B.c1), ecart(c, B.c2));
    if (d > bestD) { bestD = d; best = c; }
  }
  const sombre = ecart(best, 0) < 260, contraste = sombre ? 0xf2f2f2 : 0x161616;
  return { nom: 'gardien', motif: 'uni', c1: best, c2: contraste, lisere: contraste, short: best, motifShort: 'uni', shortB: contraste, chaussettes: best, bande: contraste, motifChaussettes: 'bande', num: contraste, numBord: best };
}
/** Compléter une tenue d'avant (gardée par le navigateur) ou sur mesure : les champs ajoutés depuis. */
export function completer(T) {
  return { motifShort: 'uni', shortB: T.c1, motifChaussettes: 'bande', bande: T.c2, ...T };
}

/** La carte du maillot : les zones (2048², une par texel, communes aux deux corps) et sa description (JSON : boîte, articulations, zones
 *  d'impression et leur taille réelle, écusson, sponsor). */
export async function chargerCarte(base) {
  const im = new Image(); im.src = base + 'maillot-zones.png';
  const [desc] = await Promise.all([fetch(base + 'maillot-carte.json').then((r) => r.json()), im.decode()]);
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0);
  const d = g.getImageData(0, 0, im.width, im.height).data, zones = new Uint8Array(im.width * im.width);
  for (let i = 0; i < zones.length; i++) zones[i] = d[i * 4];
  return { N: im.width, zones, desc };
}

/**
 * LA FORME D'UN CORPS, tirée de son maillage au chargement : pour chaque texel de l'atlas (NF², 1024), la position au repos (m) du point du
 * corps qui le porte — les triangles tramés dans l'espace des UV, comme tools/maillot-carte.py — et le relief des plis (la carte de normales :
 * 0,62 dans un pli profond, 1 à plat). En flottants : la ceinture d'un maillot rentré, la manche longue, le haut d'une chaussette se dessinent
 * au pixel près (une forme sur 8 bits faisait des pas de 6,5 mm en hauteur, et ses marches se voyaient de près — 3 octobre). Une marge de
 * 6 texels autour des îlots (le voisin couvert le plus proche) pour le filtrage. Rend un Float32Array (x, y, z, relief) par texel.
 */
export function formeDuCorps(geometrie, imageNormales, NF = 1024) {
  const pos = geometrie.attributes.position, tc = geometrie.attributes.uv, idx = geometrie.index;
  const F = new Float32Array(NF * NF * 4), couv = new Uint8Array(NF * NF), n = idx ? idx.count : pos.count;
  const sommet = (t) => (idx ? idx.getX(t) : t);
  for (let t = 0; t + 2 < n; t += 3) {
    const i0 = sommet(t), i1 = sommet(t + 1), i2 = sommet(t + 2);
    const ax = tc.getX(i0) * NF - 0.5, ay = tc.getY(i0) * NF - 0.5, bx = tc.getX(i1) * NF - 0.5, by = tc.getY(i1) * NF - 0.5, cx = tc.getX(i2) * NF - 0.5, cy = tc.getY(i2) * NF - 0.5;
    const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy); if (Math.abs(d) < 1e-12) continue;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), x1 = Math.min(NF - 1, Math.ceil(Math.max(ax, bx, cx)));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), y1 = Math.min(NF - 1, Math.ceil(Math.max(ay, by, cy)));
    const Ax = pos.getX(i0), Ay = pos.getY(i0), Az = pos.getZ(i0), Bx = pos.getX(i1), By = pos.getY(i1), Bz = pos.getZ(i1), Cx = pos.getX(i2), Cy = pos.getY(i2), Cz = pos.getZ(i2);
    for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) {
      const l0 = ((by - cy) * (gx - cx) + (cx - bx) * (gy - cy)) / d, l1 = ((cy - ay) * (gx - cx) + (ax - cx) * (gy - cy)) / d, l2 = 1 - l0 - l1;
      if (l0 < -1e-4 || l1 < -1e-4 || l2 < -1e-4) continue;
      const o = (gy * NF + gx) * 4;
      F[o] = l0 * Ax + l1 * Bx + l2 * Cx; F[o + 1] = l0 * Ay + l1 * By + l2 * Cy; F[o + 2] = l0 * Az + l1 * Bz + l2 * Cz;
      couv[gy * NF + gx] = 1;
    }
  }
  for (let pas = 0; pas < 6; pas++) {   // la marge
    const neuf = [];
    for (let i = 0; i < NF * NF; i++) {
      if (couv[i]) continue;
      const x = i % NF, y = (i - x) / NF;
      const v = x > 0 && couv[i - 1] ? i - 1 : x < NF - 1 && couv[i + 1] ? i + 1 : y > 0 && couv[i - NF] ? i - NF : y < NF - 1 && couv[i + NF] ? i + NF : -1;
      if (v >= 0) neuf.push(i, v);
    }
    for (let j = 0; j < neuf.length; j += 2) { const i = neuf[j] * 4, v = neuf[j + 1] * 4; F[i] = F[v]; F[i + 1] = F[v + 1]; F[i + 2] = F[v + 2]; couv[neuf[j]] = 1; }
  }
  // le relief : le bleu de la carte de normales (espace tangent) — le même calcul que l'outil
  let nz = null;
  if (imageNormales) {
    const c = document.createElement('canvas'); c.width = c.height = NF;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(imageNormales, 0, 0, NF, NF); nz = g.getImageData(0, 0, NF, NF).data;
  }
  for (let i = 0; i < NF * NF; i++) {
    const t = nz ? Math.min(1, Math.max(0, ((nz[i * 4 + 2] / 255) * 2 - 1 - 0.55) / 0.43)) : 1;
    F[i * 4 + 3] = 0.62 + 0.38 * t * t * (3 - 2 * t);
  }
  F.NF = NF;
  return F;
}

/**
 * PEINDRE UNE TENUE D'ÉQUIPE sur la texture d'un corps : le motif du maillot (dans l'espace du corps), le liseré, le short et son motif, les
 * chaussettes (à hauteur moyenne) et leur motif, le relief des plis ; puis l'écusson et le sponsor. La peau, les mains, les chaussures restent
 * celles du corps (le shader du joueur s'en charge). Rend un canevas (taille × taille) — réutilise `canevas` s'il est donné.
 */
export function peindreTenue(corps, carte, forme, T0, { taille = 2048, canevas = null, club = null } = {}) {
  const T = completer(T0);
  const c = canevas ?? document.createElement('canvas'); c.width = c.height = taille;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(corps, 0, 0, taille, taille);
  const img = g.getImageData(0, 0, taille, taille), px = img.data;
  const { N, zones } = carte, NF = forme.NF, k = N / taille, kf = NF / taille;
  const C1 = rgbDe(T.c1), C2 = rgbDe(T.c2), LI = rgbDe(T.lisere), SH = rgbDe(T.short), SB = rgbDe(T.shortB), CH = rgbDe(T.chaussettes), BA = rgbDe(T.bande);
  // LA POSITION SUR LE CORPS, LUE EN BILINÉAIRE (les bords des motifs nets : lue au plus proche, elle dessinait des marches d'escalier) ; un
  // voisin d'un autre îlot (plus de 7 cm d'écart) est remplacé par le plus proche — on ne mélange pas à travers une couture
  const P = new Float32Array(3);
  const bilin = (u, v) => {
    const x0 = Math.max(0, Math.min(NF - 2, Math.floor(u))), y0 = Math.max(0, Math.min(NF - 2, Math.floor(v))), tx = Math.min(1, Math.max(0, u - x0)), ty = Math.min(1, Math.max(0, v - y0));
    const i00 = (y0 * NF + x0) * 4, i10 = i00 + 4, i01 = i00 + NF * 4, i11 = i01 + 4;
    const ref = tx < 0.5 ? (ty < 0.5 ? i00 : i01) : (ty < 0.5 ? i10 : i11);
    const pr = (i) => (Math.abs(forme[i] - forme[ref]) + Math.abs(forme[i + 1] - forme[ref + 1]) + Math.abs(forme[i + 2] - forme[ref + 2]) > 0.07 ? ref : i);
    const a = pr(i00), b = pr(i10), cc = pr(i01), d = pr(i11);
    for (let ch = 0; ch < 3; ch++) P[ch] = (forme[a + ch] * (1 - tx) + forme[b + ch] * tx) * (1 - ty) + (forme[cc + ch] * (1 - tx) + forme[d + ch] * tx) * ty;
  };
  for (let py = 0; py < taille; py++) {
    const zy = Math.floor(py * k) * N, fy = Math.floor(py * kf) * NF;
    for (let qx = 0; qx < taille; qx++) {
      const zone = zones[zy + Math.floor(qx * k)]; if (!zone || zone > 5) continue;   // 6-9 : peau, mains, chaussures — au joueur
      const fi = (fy + Math.floor(qx * kf)) * 4;
      let x = forme[fi], y = forme[fi + 1], z = forme[fi + 2];
      const ao = forme[fi + 3];
      if (zone === 1 || zone === 3 || zone === 5) { bilin((qx + 0.5) * kf - 0.5, (py + 0.5) * kf - 0.5); x = P[0]; y = P[1]; z = P[2]; }
      let col;
      if (zone === 1) col = motif(T.motif, x, y, z) ? C2 : C1;
      else if (zone === 2 || zone === 4) col = LI;
      else if (zone === 3) col = motifShort(T.motifShort, x, y) ? SB : SH;
      else col = motifChaussette(T.motifChaussettes, y) ? BA : CH;
      const o = (py * taille + qx) * 4;
      px[o] = col[0] * ao; px[o + 1] = col[1] * ao; px[o + 2] = col[2] * ao;
    }
  }
  g.putImageData(img, 0, 0);
  // l'écusson du club (à droite de la poitrine) et son sponsor (au milieu) — l'avant du maillot est droit dans l'atlas
  const s = taille / 2048, E = carte.desc.ecusson, S = carte.desc.sponsor;
  if (club) {
    g.drawImage(drawCrest(club, 128), (E.x - E.d / 2) * s, (E.y - E.d / 2) * s, E.d * s, E.d * s);
    const sp = club.sponsors?.[0];
    if (sp) {
      // la couleur du sponsor : la plus lisible sur la dominante (blanc ou noir), un contour de l'autre — lisible aussi sur des rayures
      const blanc = ecart(T.c1, 0xffffff) > ecart(T.c1, 0x000000);
      g.save(); g.translate(S.x * s, S.y * s); g.textAlign = 'center'; g.textBaseline = 'middle';
      let fs = S.h * 0.55 * s; g.font = `800 ${fs}px "Barlow Condensed", "Arial Narrow", Impact, sans-serif`;
      const w = g.measureText(sp).width; if (w > S.w * s) { fs *= (S.w * s) / w; g.font = `800 ${fs}px "Barlow Condensed", "Arial Narrow", Impact, sans-serif`; }
      g.lineJoin = 'round'; g.lineWidth = Math.max(1.5, fs * 0.08); g.strokeStyle = blanc ? '#141414' : '#f6f6f6'; g.strokeText(sp, 0, 0);
      g.fillStyle = blanc ? '#f6f6f6' : '#141414'; g.fillText(sp, 0, 0); g.restore();
    }
  }
  return c;
}
/** Vrai : la couleur 2 à ce point du maillot (x latéral, y hauteur, z avant ; m). Le torse fait ~0,36 m de large ; au-delà de 0,21 m, la
 *  manche (unie, sauf pour les cerceaux, les moitiés, les quartiers, le damier ; contrastée pour le raglan). */
export function motif(m, x, y, z) {
  const manche = Math.abs(x) > 0.21;
  switch (m) {
    case 'rayures': return !manche && (Math.floor((x + 0.03) / 0.06) & 1) === 1;
    case 'fines': return !manche && Math.abs((((x + 0.5) / 0.05) % 1) - 0.5) < 0.09;   // un filet de 9 mm tous les 5 cm
    case 'cerceaux': return (Math.floor((y - 0.92) / 0.085) & 1) === 1;
    case 'moities': return x < 0;
    case 'quartiers': return (x < 0) !== (y > 1.17);
    case 'echarpe': { if (manche) return false; const d = (z >= 0 ? x : -x) * 0.766 + (y - 1.18) * 0.643; return Math.abs(d) < 0.075; }
    case 'bande': return !manche && Math.abs(x) < 0.075;
    case 'poitrine': return !manche && y > 1.2 && y < 1.3;
    case 'chevron': return !manche && Math.abs(y - (1.3 - Math.abs(x) * 0.9)) < 0.045;
    case 'damier': return ((Math.floor((x + 1) / 0.075) + Math.floor((y + 1) / 0.075)) & 1) === 1;
    case 'raglan': return manche;
    default: return false;
  }
}
/** Vrai : la seconde couleur du short (x latéral, y hauteur) — le même dessin que le shader (le maillot rentré le prolonge). */
function motifShort(m, x, y) {
  switch (m) {
    case 'bande': return Math.abs(x) > 0.135 && Math.abs(x) < 0.165;   // une bande sur le côté de la cuisse
    case 'bas': return y < 0.635;
    case 'deux-tons': return x <= 0;
    default: return false;
  }
}
/** Vrai : la bande de la chaussette (y hauteur ; la chaussette moyenne monte à 0,442 m) — le même dessin que le shader (la chaussette haute
 *  le remonte). */
function motifChaussette(m, y) {
  switch (m) {
    case 'bande': return y > 0.385;
    case 'deux-bandes': return (y > 0.36 && y < 0.375) || (y > 0.395 && y < 0.41);
    case 'revers': return y > 0.395 || (y > 0.37 && y < 0.38);
    case 'cerceaux': return y > 0.18 && (Math.floor((y - 0.18) / 0.03) & 1) === 1;
    default: return false;
  }
}

/** Une texture de données (pas de prémultiplication : les quatre canaux restent des données), dans la convention des textures glTF. */
function textureDonnees(data, n, { mips = false } = {}) {
  const t = new THREE.DataTexture(data, n, n, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.flipY = false; t.colorSpace = THREE.NoColorSpace; t.magFilter = THREE.LinearFilter;
  t.minFilter = mips ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter; t.generateMipmaps = mips; t.needsUpdate = true;
  return t;
}
/** LES MASQUES (pour le shader du joueur) : les zones en couches (1024², la part de chaque zone dans les 2 × 2 texels de la carte) —
 *  A : peau du bras, main, peau de la jambe, chaussure ; B : maillot (avec son liseré), short, chaussette. */
export function masquesDe(carte, taille = 1024) {
  const { N, zones } = carte, k = N / taille, n2 = k * k;
  const fabriquer = (couches) => {
    const lut = new Uint8Array(256 * 4); couches.forEach((zs, ch) => { for (const z of zs) lut[z * 4 + ch] = 1; });
    const d = new Uint8Array(taille * taille * 4);
    for (let y = 0; y < taille; y++) for (let x = 0; x < taille; x++) {
      let a0 = 0, a1 = 0, a2 = 0, a3 = 0;
      for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) { const z = zones[(y * k + j) * N + x * k + i] * 4; a0 += lut[z]; a1 += lut[z + 1]; a2 += lut[z + 2]; a3 += lut[z + 3]; }
      const o = (y * taille + x) * 4; d[o] = (255 * a0) / n2; d[o + 1] = (255 * a1) / n2; d[o + 2] = (255 * a2) / n2; d[o + 3] = (255 * a3) / n2;
    }
    return textureDonnees(d, taille, { mips: true });
  };
  return { A: fabriquer([[6], [7], [8], [9]]), B: fabriquer([[1, 2], [3, 4], [5], []]) };
}
/** La forme d'un corps en texture pour le shader : des demi-flottants (x, y, z en mètres, au demi-millimètre ; le relief), filtrés, sans
 *  niveaux réduits (une moyenne de positions à travers une couture n'est la position de rien). 8 Mo par corps. */
export function textureForme(forme) {
  const h = new Uint16Array(forme.length); for (let i = 0; i < forme.length; i++) h[i] = THREE.DataUtils.toHalfFloat(forme[i]);
  const t = new THREE.DataTexture(h, forme.NF, forme.NF, THREE.RGBAFormat, THREE.HalfFloatType);
  t.flipY = false; t.colorSpace = THREE.NoColorSpace; t.magFilter = t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; t.needsUpdate = true;
  return t;
}
/** La couleur de peau d'un corps, pour une jambe nue au-dessus d'une chaussette basse : la peau de la jambe juste au-dessus de la chaussette
 *  (zone 8, entre 0,45 et 0,53 m : le genou et le haut du mollet — toute la jambe, cuisse ombrée comprise, sortait trop brune), la moyenne des
 *  texels entre le 30e et le 50e centile de luminance. */
export function peauDe(image, carte, forme) {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(image, 0, 0, 512, 512);
  const d = g.getImageData(0, 0, 512, 512).data, k = carte.N / 512, kf = forme.NF / 512, r = [], gg = [], bb = [];
  for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
    if (carte.zones[y * k * carte.N + x * k] !== 8) continue;
    const h = forme[(Math.floor(y * kf) * forme.NF + Math.floor(x * kf)) * 4 + 1]; if (h < 0.45 || h > 0.53) continue;
    const o = (y * 512 + x) * 4; r.push(d[o]); gg.push(d[o + 1]); bb.push(d[o + 2]);
  }
  if (!r.length) return new THREE.Color().setRGB(0.8, 0.6, 0.48, THREE.SRGBColorSpace);
  // le texel au 40e centile de luminance (la médiane canal par canal sortait plus claire et plus orangée que le genou, vu le 3 octobre)
  const ordre = r.map((_, i) => i).sort((i, j) => (0.2126 * r[i] + 0.7152 * gg[i] + 0.0722 * bb[i]) - (0.2126 * r[j] + 0.7152 * gg[j] + 0.0722 * bb[j]));
  const lot = ordre.slice(Math.floor(ordre.length * 0.3), Math.floor(ordre.length * 0.5)), moy = (a) => lot.reduce((s2, i) => s2 + a[i], 0) / lot.length;
  return new THREE.Color().setRGB(moy(r) / 255, moy(gg) / 255, moy(bb) / 255, THREE.SRGBColorSpace);
}

/**
 * LA CHAUSSETTE BASSE EN VOLUME : une cible de morphing du corps (dans la pose de repos, avant le skinning — les ombres suivent), réglée par
 * joueur (`mesh.morphTargetInfluences[0]`). La chaussette moyenne du maillage, protège-tibia compris, est un fourreau plus gros que la jambe,
 * fermé en haut par un bord : peinte en peau, elle faisait un mollet gonflé sous une marche (vu de près le 3 octobre). Chaque sommet de la
 * chaussette (zone 5, par ses UV) s'écarte de l'axe cheville-genou de sa jambe (le squelette au repos, maillot-carte.json) ; son rayon est mis
 * à l'échelle selon sa hauteur — × 1,06 sur la chaussette roulée (0,13-0,18 m), × 0,9 sur le mollet, et le bord (0,42-0,47 m) jusqu'au
 * rapport mesuré sur le maillage entre la peau juste au-dessus et ce bord.
 */
export function morphChaussetteBasse(geometrie, carte) {
  const pos = geometrie.attributes.position, tc = geometrie.attributes.uv, n = pos.count, N = carte.N, Z = carte.zones;
  const { genou: G, cheville: C } = carte.desc.articulations;
  const zone = (i) => Z[Math.min(N - 1, Math.max(0, Math.floor(tc.getY(i) * N))) * N + Math.min(N - 1, Math.max(0, Math.floor(tc.getX(i) * N)))];
  const r = [0, 0, 0];
  const rayon = (i) => {   // le vecteur de l'axe de la jambe au sommet (dans r), et sa longueur
    const sg = pos.getX(i) >= 0 ? 1 : -1, ax = sg * C[0], ay = C[1], az = C[2], dx = sg * G[0] - ax, dy = G[1] - ay, dz = G[2] - az;
    const px = pos.getX(i) - ax, py = pos.getY(i) - ay, pz = pos.getZ(i) - az, t = (px * dx + py * dy + pz * dz) / (dx * dx + dy * dy + dz * dz);
    r[0] = px - t * dx; r[1] = py - t * dy; r[2] = pz - t * dz; return Math.hypot(r[0], r[1], r[2]);
  };
  let sP = 0, nP = 0, sB = 0, nB = 0;
  for (let i = 0; i < n; i++) {
    const y = pos.getY(i), z = zone(i);
    if (z === 8 && y > 0.455 && y < 0.48) { sP += rayon(i); nP++; }
    if (z === 5 && y > 0.43 && y < 0.455) { sB += rayon(i); nB++; }
  }
  const fBord = nP && nB ? Math.min(1, sP / nP / (sB / nB)) : 0.85, MOLLET = 0.9;
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const d = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const y = pos.getY(i); if (y < 0.12 || y > 0.47 || zone(i) !== 5) continue;
    let f = y < 0.178 ? 1 + 0.06 * ss(0.128, 0.138, y) * (1 - ss(0.168, 0.178, y)) : 1 + (MOLLET - 1) * ss(0.178, 0.2, y);
    f += (fBord - MOLLET) * ss(0.42, 0.45, y);
    rayon(i); d[i * 3] = r[0] * (f - 1); d[i * 3 + 1] = r[1] * (f - 1); d[i * 3 + 2] = r[2] * (f - 1);
  }
  // LES NORMALES SUIVENT : le haut du bord de la chaussette, une couronne tournée vers le ciel, restait éclairé comme une marche une fois
  // rentré. Les normales recalculées sur la forme amincie, moins celles recalculées sur la forme d'origine (les coutures des UV s'annulent),
  // s'ajoutent aux normales du modèle
  const normalesDe = (P) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); if (geometrie.index) g.setIndex(geometrie.index); g.computeVertexNormals(); return g.attributes.normal.array; };
  const P0 = new Float32Array(n * 3); for (let i = 0; i < n; i++) { P0[i * 3] = pos.getX(i); P0[i * 3 + 1] = pos.getY(i); P0[i * 3 + 2] = pos.getZ(i); }
  const P1 = P0.map((v, i) => v + d[i]), N0 = normalesDe(P0), N1 = normalesDe(P1), dn = new Float32Array(n * 3);
  for (let i = 0; i < n * 3; i++) dn[i] = N1[i] - N0[i];
  geometrie.morphAttributes.position = [new THREE.Float32BufferAttribute(d, 3)];
  geometrie.morphAttributes.normal = [new THREE.Float32BufferAttribute(dn, 3)];
  geometrie.morphTargetsRelative = true;
  return { fBord };
}

// ———————————————————————————— le flocage : un alphabet en champ de distance ————————————————————————————
// 8 × 8 cases de 48 × 64 px : les chiffres, les lettres, les accents des noms (les autres ramenés à leur lettre de base), l'apostrophe, le
// tiret, le point. Dans une case, la hauteur des capitales fait 40 px (de la rangée 12 à la ligne de base, rangée 52) ; un glyphe trop large
// est resserré. La valeur d'un texel : 0,5 sur le bord du glyphe, ± la distance (8 px d'étendue) — le shader en tire un bord net et un
// contour à n'importe quelle taille.
const CARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZÀÂÄÇÉÈÊËÎÏÔÖÙÛÜÑĆČŠŽŁØÅÆ'-.";
const CW = 48, CH = 64, CAP = 40, HAUT = 12, ETENDUE = 8;
const INTER = 0.07, ESPACE = 0.4;   // l'interlettre et l'espace entre deux mots, en largeurs de case
const LOIN = 1e4;                   // une borne inutilisée
/** L'indice de glyphe d'un caractère (−1 : aucun) — majuscules, les accents inconnus ramenés à la lettre de base. */
export function glypheDe(ch) {
  const C = ch.toUpperCase(); let i = CARS.indexOf(C);
  if (i < 0) i = CARS.indexOf(C.normalize('NFD').replace(/[̀-ͯ]/g, ''));
  return i;
}
/** Fabriquer l'alphabet (attend la police du flocage) : la texture et la place de l'encre de chaque glyphe dans sa case (pour la chasse). */
export async function alphabetSDF({ poids = 600 } = {}) {
  const police = (px) => `${poids} ${px}px "Barlow Condensed", "Roboto Condensed", "Arial Narrow", sans-serif`;
  try { await document.fonts.load(police(40)); } catch { /* police de repli */ }
  const W = 8 * CW, H = 8 * CH, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), out = g.createImageData(W, H);
  const tmp = document.createElement('canvas'); tmp.width = CW; tmp.height = CH; const tg = tmp.getContext('2d', { willReadFrequently: true });
  tg.font = police(100); const capH = tg.measureText('H').actualBoundingBoxAscent || 70, fs = (100 * CAP) / capH;
  const INF = 1e9, edt1 = (f, n) => {   // la transformée de distance 1D (Felzenszwalb) : des distances au carré
    const d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1); let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
    for (let q = 1; q < n; q++) {
      let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
      k++; v[k] = q; z[k] = s; z[k + 1] = INF;
    }
    k = 0; for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
    return d;
  };
  const edt = (dans) => {   // la distance au carré de chaque texel à l'ensemble `dans`
    const f = new Float64Array(CW * CH); for (let i = 0; i < f.length; i++) f[i] = dans[i] ? 0 : INF;
    const col = new Float64Array(CH);
    for (let x = 0; x < CW; x++) { for (let y = 0; y < CH; y++) col[y] = f[y * CW + x]; const r = edt1(col, CH); for (let y = 0; y < CH; y++) f[y * CW + x] = r[y]; }
    const row = new Float64Array(CW);
    for (let y = 0; y < CH; y++) { for (let x = 0; x < CW; x++) row[x] = f[y * CW + x]; const r = edt1(row, CW); for (let x = 0; x < CW; x++) f[y * CW + x] = r[x]; }
    return f;
  };
  const metriques = [];
  for (let i = 0; i < CARS.length; i++) {
    tg.setTransform(1, 0, 0, 1, 0, 0); tg.clearRect(0, 0, CW, CH); tg.font = police(fs); tg.fillStyle = '#fff'; tg.textAlign = 'center'; tg.textBaseline = 'alphabetic';
    const m = tg.measureText(CARS[i]), large = (m.actualBoundingBoxLeft ?? 0) + (m.actualBoundingBoxRight ?? m.width), maxL = CW - 2 * ETENDUE + 8;
    const sx = large > maxL ? maxL / large : 1;
    tg.setTransform(sx, 0, 0, 1, CW / 2, HAUT + CAP); tg.fillText(CARS[i], 0, 0);
    const a = tg.getImageData(0, 0, CW, CH).data, dans = new Uint8Array(CW * CH), dehors = new Uint8Array(CW * CH);
    let l = CW, r = 0;
    for (let j = 0; j < CW * CH; j++) { dans[j] = a[j * 4 + 3] > 127 ? 1 : 0; dehors[j] = 1 - dans[j]; if (dans[j]) { const x = j % CW; if (x < l) l = x; if (x + 1 > r) r = x + 1; } }
    metriques.push(r > l ? { l: l / CW, r: r / CW } : { l: 0.4, r: 0.6 });
    const dIn = edt(dehors), dOut = edt(dans);   // la distance au dehors (pour un texel dedans), au dedans (pour un texel dehors)
    const ox = (i % 8) * CW, oy = Math.floor(i / 8) * CH;
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
      const j = y * CW + x, sd = dans[j] ? Math.sqrt(dIn[j]) - 0.5 : -(Math.sqrt(dOut[j]) - 0.5);
      const v = Math.max(0, Math.min(255, Math.round(255 * (0.5 + sd / (2 * ETENDUE))))), o = ((oy + y) * W + ox + x) * 4;
      out.data[o] = v; out.data[o + 1] = v; out.data[o + 2] = v; out.data[o + 3] = 255;
    }
  }
  g.putImageData(out, 0, 0);
  // sans niveaux réduits : à la frontière de deux glyphes les coordonnées sautent d'une case à l'autre, la carte graphique y prendrait le
  // plus petit niveau (une moyenne de tout l'alphabet)
  const tex = new THREE.CanvasTexture(c); tex.flipY = false; tex.colorSpace = THREE.NoColorSpace; tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.needsUpdate = true;
  return { canevas: c, tex, metriques };
}
/** LA MISE EN PAGE d'un texte (le nom, le numéro) : les glyphes, le centre de leur case et les bornes entre eux — en largeurs de case,
 *  centrés sur 0 — et la largeur de l'encre. La chasse est proportionnelle (un I n'est pas un W). */
export function mettreEnPage(texte, alphabet, max = 16) {
  const g = [], c = [], b = []; let fin = null, espace = false;
  for (const ch of String(texte ?? '').toUpperCase()) {
    if (/\s/.test(ch)) { espace = fin != null; continue; }
    const i = glypheDe(ch); if (i < 0 || g.length >= max) continue;
    const { l, r } = alphabet.metriques[i], pas = espace ? ESPACE : INTER;
    const x = fin == null ? 0 : fin + pas; if (fin != null) b.push(fin + pas / 2);
    g.push(i); c.push(x - l + 0.5); fin = x + (r - l); espace = false;
  }
  const L = fin ?? 0;
  return { g, c: c.map((v) => v - L / 2), b: b.map((v) => v - L / 2), L };
}

// ———————————————————————————— le shader du joueur ————————————————————————————
// LES OPTIONS D'UN JOUEUR, regroupées par quatre dans des vec4 du matériau (o0-o4) : three range chaque NOMBRE d'un matériau dans la clé de
// son programme (0 ou « non nul » : RenderObject.getMaterialCacheKey) — dix-neuf options à 0 ou 1, c'étaient autant de programmes que de
// combinaisons portées (mesuré le 3 octobre : 110 programmes au lieu de 70) ; un objet, lui, compte pour « {} » quelles que soient ses valeurs
const OPTIONS = ['rentre', 'longues', 'garder', 'cuissard', 'hautes', 'basses', 'antider', 'strapC', 'bandageG', 'bandageD', 'gants', 'brassard', 'poignetG', 'poignetD', 'bottesClaires', 'motifShort', 'motifChaussettes', 'nomL', 'chifL'];
const OPT = Object.fromEntries(OPTIONS.map((n, i) => [n, [`o${i >> 2}`, 'xyzw'[i & 3]]]));
const N_OPT = Math.ceil(OPTIONS.length / 4);
const sous = (a, b, x) => float(1).sub(smoothstep(a, b, x));   // 1 sous a, 0 au-dessus de b
const dans = (x, a, b) => step(a, x).mul(step(x, b));
const est = (v, k) => step(abs(v.sub(k)), 0.5);
/** LE GRAPHE DE COULEUR, construit une fois pour les 22 (voir l'en-tête) : la tenue d'équipe (`tenue`), puis l'équipement du joueur, puis son
 *  flocage. Les entrées partagées : les masques, l'alphabet, la description de la carte ; du matériau : la tenue, la forme de son corps
 *  (`forme` : position au repos, relief), les options (o0-o4), les couleurs, le nom et le numéro. */
export function couleurTenue({ masques, alphabet, desc }) {
  const U = uv(), O = Array.from({ length: N_OPT }, (_, i) => materialReference(`o${i}`, 'vec4'));
  const f = (n) => O[Number(OPT[n][0].slice(1))][OPT[n][1]], c = (n) => materialReference(n, 'color'), un = (x) => float(1).sub(x);
  const base = materialReference('tenue', 'texture').rgb;
  const mA = texture(masques.A, U), mB = texture(masques.B, U), F = materialReference('forme', 'texture');
  const P = F.xyz, ao = F.w;   // (en mètres : la forme du corps du joueur, formeDuCorps)
  // LE BRAS : la distance le long du bras depuis l'épaule (la projection sur le bras, puis sur l'avant-bras, le segment le plus proche), la
  // distance à son axe, la distance au poignet ; x > 0 : le côté gauche du joueur
  const art = desc.articulations, gauche = step(0, P.x), cote = gauche.mul(2).sub(1);
  const pt = (a) => vec3(cote.mul(a[0]), a[1], a[2]);
  const E = pt(art.epaule), C = pt(art.coude), W = pt(art.poignet);
  const L1 = Math.hypot(art.coude[0] - art.epaule[0], art.coude[1] - art.epaule[1], art.coude[2] - art.epaule[2]);
  const L2 = Math.hypot(art.poignet[0] - art.coude[0], art.poignet[1] - art.coude[1], art.poignet[2] - art.coude[2]);
  const ec = C.sub(E), cw = W.sub(C);
  const t1 = clamp(dot(P.sub(E), ec).div(L1 * L1), 0, 1), t2 = clamp(dot(P.sub(C), cw).div(L2 * L2), 0, 1);
  const d1 = length(P.sub(E.add(ec.mul(t1)))), d2 = length(P.sub(C.add(cw.mul(t2))));
  const tBras = select(d1.lessThan(d2), t1.mul(L1), t2.mul(L2).add(L1)), dBras = min(d1, d2), dPoignet = length(P.sub(W));
  const surBras = step(0.215, abs(P.x)).mul(sous(0.09, 0.1, dBras));   // sur le bras (pas le flanc du torse, sous l'aisselle)
  const coteJ = (g, d) => g.mul(gauche).add(d.mul(un(gauche)));         // l'option du côté de ce texel
  let col = base;
  // 1. LE MAILLOT RENTRÉ : le bas du maillot, sous la ceinture du short (0,953 m), prend le short — et son motif
  const ms = f('motifShort');
  const shortB = est(ms, 1).mul(dans(abs(P.x), 0.135, 0.165)).add(est(ms, 2).mul(step(P.y, 0.635))).add(est(ms, 3).mul(step(P.x, 0)));
  const rentre = mB.r.mul(f('rentre'));
  col = mix(col, mix(c('cShort'), c('cShortB'), shortB).mul(ao), rentre.mul(sous(0.95, 0.958, P.y)));
  col = col.mul(float(1).sub(rentre.mul(smoothstep(0.932, 0.944, P.y)).mul(sous(0.948, 0.955, P.y)).mul(0.3)));   // l'ombre du pli de la ceinture
  // 2. LES MANCHES : longues — la peau du bras devient manche jusqu'au poignet, le revers au liseré, le liseré de la manche courte disparaît ;
  //    sous-maillot — la manche courte garde son liseré, le bras prend la couleur du sous-maillot
  const longues = f('longues'), cManche = mix(c('cMancheD'), c('cMancheG'), gauche);
  col = mix(col, cManche.mul(ao), mB.r.mul(longues).mul(un(f('garder'))).mul(surBras).mul(smoothstep(0.17, 0.18, tBras)));
  col = mix(col, mix(cManche, c('cRevers'), smoothstep(0.512, 0.518, tBras)).mul(ao), mA.r.mul(longues));
  // 3. LE CUISSARD : sous le short, jusqu'à 5 cm sous son ourlet (0,575 m)
  col = mix(col, c('cCuissard').mul(ao), mA.b.mul(f('cuissard')).mul(smoothstep(0.522, 0.528, P.y)));
  // 4. LES CHAUSSETTES. Hautes : la peau de la jambe monte en chaussette au-dessus du genou (0,548 m), son motif remonté d'autant (0,106 m).
  //    Basses (à la Hamšík) : roulées sur la cheville (0,13-0,18 m), la jambe nue au-dessus. Les antidérapantes : la chaussette coupée au-
  //    dessus de la cheville, l'antidérapante visible sous elle ; le strap : un tour de bande sur le haut du protège-tibia
  const hautes = f('hautes'), basses = f('basses'), yS = P.y.sub(hautes.mul(0.106)), mc = f('motifChaussettes');
  const bandeC = est(mc, 1).mul(step(0.385, yS))
    .add(est(mc, 2).mul(max(dans(yS, 0.36, 0.375), dans(yS, 0.395, 0.41))))
    .add(est(mc, 3).mul(max(step(0.395, yS), dans(yS, 0.37, 0.38))))
    .add(est(mc, 4).mul(step(0.18, P.y)).mul(P.y.sub(0.18).div(0.03).floor().mod(2)));
  col = mix(col, mix(c('cChaussette'), c('cBande'), bandeC).mul(ao), max(mB.b, mA.b.mul(sous(0.543, 0.549, P.y))).mul(hautes));
  // la jambe nue : sans le relief tricoté de la chaussette ; son masque élargi (× 2) couvre le bord de la zone, où la bande de la chaussette
  // peinte transparaissait en liseré clair sous le genou (vu de près le 3 octobre)
  const nue = clamp(mB.b.mul(2), 0, 1).mul(basses).mul(smoothstep(0.172, 0.18, P.y));
  col = mix(col, c('cPeau').mul(mix(float(1), ao, 0.25)), nue);
  col = mix(col, c('cChaussette').mul(ao).mul(0.8), mB.b.mul(basses).mul(smoothstep(0.128, 0.134, P.y)).mul(sous(0.172, 0.18, P.y)));
  col = mix(col, c('cAntider').mul(ao), mB.b.mul(f('antider')).mul(un(basses)).mul(sous(0.163, 0.17, P.y)));
  const blancBande = vec3(0.8, 0.79, 0.75);   // (linéaire) une bande de sport, blanc cassé
  col = mix(col, blancBande.mul(ao), mB.b.mul(f('strapC')).mul(un(basses)).mul(dans(P.y, 0.312, 0.33)));   // le haut du protège-tibia
  // 5. LES CHAUSSURES : deux couleurs posées sur le dessin d'origine — la dominante où la chaussure d'origine l'est (claire pour le n° 18,
  //    sombre pour le n° 10 ; luminance linéaire), le détail ailleurs (semelle, crampons, logo)
  const L = luminance(base), dominante = mix(sous(0.03, 0.17, L), smoothstep(0.1, 0.45, L), f('bottesClaires'));
  col = mix(col, mix(c('cChaussure2'), c('cChaussure'), dominante).mul(ao.mul(0.4).add(0.6)), mA.a);
  // 6. LES MAINS : le bandage (à la Benzema : la paume et le poignet, des tours de bande tous les 14 mm), les gants
  const tours = float(0.9).add(smoothstep(0, 0.2, fract(dPoignet.div(0.014))).mul(0.1));
  const bandage = clamp(mA.g.mul(sous(0.088, 0.098, dPoignet)).add(mA.r.mul(un(longues)).mul(smoothstep(0.522, 0.528, tBras))), 0, 1);
  col = mix(col, blancBande.mul(tours).mul(ao), bandage.mul(coteJ(f('bandageG'), f('bandageD'))));
  col = mix(col, c('cGants').mul(ao), mA.g.mul(f('gants')));
  // 7. LE STRAP DES POIGNETS (sur la peau, sous une manche longue il ne se voit pas) et LE BRASSARD du capitaine (le haut du bras gauche)
  col = mix(col, blancBande.mul(ao), mA.r.mul(un(longues)).mul(coteJ(f('poignetG'), f('poignetD'))).mul(smoothstep(0.497, 0.503, tBras)).mul(sous(0.54, 0.546, tBras)));
  col = mix(col, c('cBrassard').mul(ao), max(mB.r, mA.r).mul(surBras).mul(f('brassard')).mul(gauche).mul(smoothstep(0.085, 0.091, tBras)).mul(sous(0.144, 0.15, tBras)));
  // 8. LE FLOCAGE
  col = flocage(col, U, alphabet.tex, desc, f);
  // LA NORMALE : celle de la carte du corps, sauf sur la jambe nue d'une chaussette basse (le tricot de la chaussette n'est pas de la peau)
  const normale = normalize(mix(normalMap(materialReference('normalMap', 'texture'), materialReference('normalScale', 'vec2')), normalView, nue));
  // (la silhouette d'une chaussette basse — le mollet nu sans le volume de la chaussette — est une cible de morphing : morphChaussetteBasse)
  return { couleur: col, normale };
}

/** Une ligne de texte : Xr (m, depuis le centre de la ligne), Y (m, depuis le haut de la zone), la hauteur des capitales `cap` (m) et leur
 *  haut `capHaut` (m) ; T : les glyphes, centres, bornes (des vec4 du matériau). Rend la valeur SDF (0 : rien). */
function ligne(Xr, Y, cap, capHaut, T, alphabetTex) {
  const xc = Xr.div(cap.mul(CW / CAP)), v = Y.sub(capHaut.sub(cap.mul(HAUT / CAP))).div(cap.mul(CH / CAP));
  let k = float(0);
  for (const b of T.b) k = k.add(dot(step(b, vec4(xc)), vec4(1)));
  let gi = float(0), cc = float(0);
  T.g.forEach((g, j) => { const oh = vec4(est(k, 4 * j), est(k, 4 * j + 1), est(k, 4 * j + 2), est(k, 4 * j + 3)); gi = gi.add(dot(g, oh)); cc = cc.add(dot(T.c[j], oh)); });
  const u = xc.sub(cc).add(0.5), ok = step(0, gi).mul(dans(u, 0, 1)).mul(dans(v, 0, 1));
  const d = texture(alphabetTex, vec2(gi.mod(8).add(clamp(u, 0, 1)).div(8), gi.div(8).floor().add(clamp(v, 0, 1)).div(8))).r;
  return d.mul(ok);
}
/** Le flocage sur les trois zones mesurées (en mètres : maillot-carte.json « mesures ») : au dos, le nom (5 cm de capitales, moins s'il est
 *  long) et le numéro (16,5 cm), centrés sur la colonne vertébrale ; le numéro de la poitrine (4,8 cm) et du short (7,8 cm). */
function flocage(col, U, alphabetTex, desc, f) {
  const r4 = (p) => [0, 1, 2, 3].map((i) => materialReference(`${p}${i}`, 'vec4'));
  const nom = { g: r4('nom'), c: r4('nomC'), b: r4('nomB'), L: f('nomL') };
  const num = { g: [materialReference('chif', 'vec4')], c: [materialReference('chifC', 'vec4')], b: [materialReference('chifB', 'vec4')], L: f('chifL') };
  const cNum = materialReference('cNum', 'color'), cBord = materialReference('cNumBord', 'color');
  const encre = (d) => {   // le bord net (la largeur d'un pixel à l'écran) et un contour fin (1,3 px de la case : 3 % des capitales)
    const w = max(fwidth(d), 0.01);
    return { plein: smoothstep(float(0.5).sub(w), float(0.5).add(w), d), contour: smoothstep(float(0.42).sub(w), float(0.42).add(w), d) };
  };
  for (const [zone, R] of Object.entries(desc.impression)) {
    const M = desc.mesures?.[zone] ?? { largeur: 0.2, hauteur: 0.2, centre: 0.5 };
    const [x0, y0, x1, y1] = R.map((v) => v / 2048), tete = zone === 'dos';
    const dedans = dans(U.x, x0, x1).mul(dans(U.y, y0, y1));
    // le dos est tête-bêche dans l'atlas : (x1 − u, y1 − v) — X de gauche à droite pour qui regarde le dos, Y vers le bas du corps
    const X = (tete ? float(x1).sub(U.x) : U.x.sub(x0)).mul(M.largeur / (x1 - x0)), Y = (tete ? float(y1).sub(U.y) : U.y.sub(y0)).mul(M.hauteur / (y1 - y0));
    const Xr = X.sub(M.centre * M.largeur), largeurMax = 2 * Math.min(M.centre, 1 - M.centre) * M.largeur * 0.94;
    const ajuste = (T, capMax, capMin) => clamp(float(largeurMax / (CW / CAP)).div(max(T.L, 0.01)), capMin, capMax);   // la ligne tient
    let d;
    if (tete) d = max(ligne(Xr, Y, ajuste(nom, 0.05, 0.022), float(0.02), nom, alphabetTex), ligne(Xr, Y, ajuste(num, 0.165, 0.05), float(0.095), num, alphabetTex));
    else { const cap = ajuste(num, zone === 'poitrine' ? 0.048 : 0.078, 0.02); d = ligne(Xr, Y, cap, float(M.hauteur / 2).sub(cap.mul(0.5)), num, alphabetTex); }
    const e = encre(d);
    col = mix(col, mix(cBord, cNum, e.plein), e.contour.mul(dedans));
  }
  return col;
}

/** LE MATÉRIAU DE TENUE : un matériau standard dont la couleur et la normale sont le graphe partagé — la couleur posée le temps de construire
 *  son rendu principal (setupDiffuseColor), absente sinon : la passe d'ombre ne voit ni `map` ni `colorNode` et garde son matériau commun (un
 *  `positionNode` y serait repris, lui aussi : la silhouette passe donc par une cible de morphing). La clé de programme porte le graphe. Les
 *  réglages du joueur sont des propriétés du matériau, lues par référence. */
const COULEURS = ['cShort', 'cShortB', 'cMancheG', 'cMancheD', 'cRevers', 'cCuissard', 'cChaussette', 'cBande', 'cPeau', 'cAntider', 'cChaussure', 'cChaussure2', 'cGants', 'cBrassard', 'cNum', 'cNumBord'];
const VECTEURS = ['nom0', 'nom1', 'nom2', 'nom3', 'nomC0', 'nomC1', 'nomC2', 'nomC3', 'nomB0', 'nomB1', 'nomB2', 'nomB3', 'chif', 'chifC', 'chifB'];
class MateriauTenue extends THREE.MeshStandardNodeMaterial {
  static get type() { return 'MateriauTenue'; }
  constructor(graphe) {
    super(); this.couleurTenue = graphe.couleur; this.normalNode = graphe.normale; this.tenue = null; this.forme = null;
    for (const k of COULEURS) this[k] = new THREE.Color();
    for (let i = 0; i < N_OPT; i++) this[`o${i}`] = new THREE.Vector4();
    for (const k of VECTEURS) this[k] = new THREE.Vector4(-1, -1, -1, -1);
  }
  setupDiffuseColor(builder) { this.colorNode = this.couleurTenue; try { super.setupDiffuseColor(builder); } finally { this.colorNode = null; } }
  customProgramCacheKey() { return `${super.customProgramCacheKey()}:tenue:${this.couleurTenue.getCacheKey()}:${this.normalNode?.getCacheKey()}`; }
}
/** LE MATÉRIAU D'UN JOUEUR : celui de son corps (relief, rugosité, double face) ; sa couleur et sa normale, le graphe partagé. */
export function materiauTenue(origine, graphe) {
  const m = new MateriauTenue(graphe);
  m.name = 'body-tenue'; m.side = origine.side; m.normalMap = origine.normalMap; if (origine.normalScale) m.normalScale.copy(origine.normalScale);
  m.roughnessMap = origine.roughnessMap; m.metalnessMap = origine.metalnessMap; m.roughness = origine.roughness; m.metalness = origine.metalness;
  return m;
}
/** La couleur d'un accessoire : 'noir', 'blanc', 'equipe' (la couleur de la tenue donnée), ou un nombre. */
const teinte = (t, equipe) => (typeof t === 'number' ? t : TEINTES[t]?.hex ?? equipe);
/**
 * POSER UN JOUEUR sur son matériau : sa tenue d'équipe (texture, couleurs), son corps (peau, chaussures claires ou sombres), son équipement,
 * son nom et son numéro (mis en page sur l'alphabet). Rien n'est recompilé : des valeurs.
 */
export function poserJoueur(m, { tenueTex, forme, T0, peau, bottesClaires, equip: q, nom, numero, alphabet }) {
  const T = completer(T0), set = (k, hex) => m[k].setHex(hex, THREE.SRGBColorSpace), o = (n, v) => { const [k, c] = OPT[n]; m[k][c] = +v; };
  m.tenue = tenueTex; m.forme = forme;
  set('cShort', T.short); set('cShortB', T.shortB); set('cChaussette', T.chaussettes); set('cBande', T.bande); set('cNum', T.num); set('cNumBord', T.numBord);
  o('motifShort', CODE_SHORT[T.motifShort] ?? 0); o('motifChaussettes', CODE_CHAUSSETTES[T.motifChaussettes] ?? 0);
  m.cPeau.copy(peau); o('bottesClaires', bottesClaires ? 1 : 0);
  // les manches : la longue prend la couleur de la manche courte, de son côté (les moitiés, les quartiers, le raglan) ; le sous-maillot la sienne
  const sousM = q.manches === 'sous-maillot', manche = (x) => (T.motif === 'cerceaux' || T.motif === 'damier' ? T.c1 : motif(T.motif, x, 1.25, 0) ? T.c2 : T.c1);
  const cs = teinte(q.couleurSous ?? 'noir', T.c1);
  set('cMancheG', sousM ? cs : manche(0.35)); set('cMancheD', sousM ? cs : manche(-0.35)); set('cRevers', sousM ? cs : T.lisere);
  o('longues', q.manches === 'longues' || sousM ? 1 : 0); o('garder', sousM ? 1 : 0);
  o('rentre', q.maillot === 'rentre' ? 1 : 0);
  o('cuissard', q.cuissard ? 1 : 0); set('cCuissard', teinte(q.couleurCuissard ?? 'equipe', T.short));
  o('hautes', q.chaussettes === 'hautes' ? 1 : 0); o('basses', q.chaussettes === 'basses' ? 1 : 0);
  o('antider', q.antiderapantes ? 1 : 0); set('cAntider', teinte(q.couleurAntider ?? 'blanc', T.chaussettes)); o('strapC', q.strapChaussettes ? 1 : 0);
  const ch = CHAUSSURES[q.chaussures] ?? CHAUSSURES.noire; set('cChaussure', ch.c1); set('cChaussure2', ch.c2);
  o('bandageG', q.bandage === 'gauche' || q.bandage === 'deux' ? 1 : 0); o('bandageD', q.bandage === 'droite' || q.bandage === 'deux' ? 1 : 0);
  o('poignetG', q.poignets === 'gauche' || q.poignets === 'deux' ? 1 : 0); o('poignetD', q.poignets === 'droit' || q.poignets === 'deux' ? 1 : 0);
  o('gants', q.gants ? 1 : 0); set('cGants', teinte(q.couleurGants ?? 'noir', T.c1));
  o('brassard', q.brassard ? 1 : 0); set('cBrassard', q.couleurBrassard ?? 0xffc81e);
  // le nom (16 glyphes au plus) et le numéro (2 chiffres), mis en page
  const poser = (P, gs, cs2, bs, n) => {
    for (let i = 0; i < n * 4; i++) { gs[i >> 2].setComponent(i & 3, P.g[i] ?? -1); cs2[i >> 2].setComponent(i & 3, P.c[i] ?? 0); bs[i >> 2].setComponent(i & 3, P.b[i] ?? LOIN); }
  };
  const N = mettreEnPage(nom, alphabet, 16), C = mettreEnPage(String(numero ?? '').slice(0, 2), alphabet, 2);
  poser(N, [m.nom0, m.nom1, m.nom2, m.nom3], [m.nomC0, m.nomC1, m.nomC2, m.nomC3], [m.nomB0, m.nomB1, m.nomB2, m.nomB3], 4); o('nomL', N.L);
  poser(C, [m.chif], [m.chifC], [m.chifB], 1); o('chifL', C.L);
}

/** L'ÉQUIPEMENT PAR DÉFAUT d'un joueur, tiré par une graine (le même à chaque chargement). Des fréquences d'observateur, pas des statistiques :
 *  manches longues 12 % (le gardien 60 %), sous-maillot 5 % ; chaussettes au-dessus du genou 12 %, basses 6 % ; antidérapantes visibles 30 %,
 *  strap des chaussettes 20 % ; maillot rentré 55 % ; cuissard visible 12 % ; bandage de la main 4 %, strap des poignets 12 %, gants 6 % (le
 *  gardien en porte toujours) ; les chaussures au hasard. */
export function equipementDe(graine, id, { gardien = false } = {}) {
  let s = ((graine * 7919 + id * 104729 + 13) >>> 0) || 1; const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  r(); r();
  const chs = Object.keys(CHAUSSURES), pick = (a) => a[Math.floor(r() * a.length)];
  const m = r(), c = r(), b = r(), p = r();
  return {
    manches: m < (gardien ? 0.6 : 0.12) ? 'longues' : m < (gardien ? 0.6 : 0.17) ? 'sous-maillot' : 'courtes', couleurSous: pick(['noir', 'noir', 'blanc', 'equipe']),
    chaussettes: c < 0.06 ? 'basses' : c < 0.18 ? 'hautes' : 'moyennes',
    antiderapantes: r() < 0.3, couleurAntider: pick(['blanc', 'blanc', 'blanc', 'noir', 'equipe']), strapChaussettes: r() < 0.2,
    maillot: r() < 0.55 ? 'rentre' : 'dehors',
    cuissard: r() < 0.12, couleurCuissard: pick(['equipe', 'equipe', 'noir', 'blanc']),
    chaussures: pick(chs),
    bandage: b < 0.03 ? 'droite' : b < 0.04 ? 'gauche' : 'aucun',
    poignets: p < 0.05 ? 'deux' : p < 0.09 ? 'droit' : p < 0.12 ? 'gauche' : 'aucun',
    gants: gardien || r() < 0.06, couleurGants: gardien ? 'blanc' : 'noir',
    brassard: false,
  };
}

/** Une texture de canevas, dans la convention des textures glTF (pas de retournement : la ligne 0 = v 0). */
export function textureDe(canevas, { anisotropy = 4 } = {}) {
  const t = new THREE.CanvasTexture(canevas); t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = anisotropy; t.needsUpdate = true;
  return t;
}

/** LES NUMÉROS selon le rôle du corps (e_PlayerRole : 0 G, 1 DC, 2 DG, 3 DD, 4 MDC, 5 MC, 6 MG, 7 MD, 8 MOC, 9 BU) — la numérotation classique ;
 *  les doublons d'une équipe prennent les numéros suivants libres. */
export function numerosDe(roles) {
  const pref = { 0: [1], 1: [4, 5, 15], 2: [3], 3: [2], 4: [6], 5: [8, 6, 10, 14], 6: [11], 7: [7], 8: [10], 9: [9] };
  const pris = new Set(), out = [];
  for (const r of roles) { let n = (pref[r] ?? []).find((x) => !pris.has(x)); if (n == null) { n = 12; while (pris.has(n)) n++; } pris.add(n); out.push(n); }
  return out;
}
