import * as THREE from 'three/webgpu';
import { texture, uv, vec2, float, step, mix, materialReference } from 'three/tsl';
import { drawCrest } from '../engine/club-theme.js';

// gpf-maillots.js — LES MAILLOTS de /match11 (lot L5, EX-27 : motifs, couleurs, numéros et noms floqués, sponsor, conflits de couleurs). Les
// footballeurs Rocketbox (n° 18, n° 10) portent leur tenue DANS leur texture : on la repeint. La carte du maillot (public/rocketbox/maillot-
// zones.png, maillot-forme.png — tools/maillot-carte.py, lue une fois sur le n° 18 : les deux corps partagent le dépliage) dit, texel par
// texel, ce qui est maillot, liseré, short, chaussette, et où ce texel est sur le corps : le motif se dessine DANS L'ESPACE DU CORPS (les
// rayures verticales sur le torse, les cerceaux à hauteur égale devant et derrière, l'écharpe en diagonale), le relief des plis est gardé ;
// la peau, les chaussures et le visage ne bougent pas. Puis l'écusson du club et son sponsor sur la poitrine.
// LE FLOCAGE est par joueur : sa case dans UN atlas commun (le nom et le grand numéro du dos, le numéro de la poitrine et du short), posée
// par le shader sur les zones mesurées de l'atlas du corps (le dos y est imprimé tête-bêche : on le retourne). UN SEUL PROGRAMME pour les
// 22 : three identifie chaque nœud de shader par son id (Node.customCacheKey) — vingt-deux graphes construits à part faisaient vingt-deux
// programmes (mesuré : 135 au lieu de 59). Le graphe de couleur est donc construit une fois et partagé ; ce qui change d'un joueur à l'autre
// passe par des RÉFÉRENCES au matériau (materialReference : la tenue dans `tenue`, la case du flocage dans `cellule`). Et la passe d'OMBRE
// reste commune : three dérive l'ombre d'un matériau de sa `map` et de son `colorNode` (un nœud par matériau, donc une variante d'ombre
// par matériau — les « 7 variantes » mesurées, et 22 avec un matériau par joueur) ; le matériau de tenue n'a ni l'un ni l'autre hors de la
// construction de son rendu (MateriauTenue) : ses ombres prennent le matériau d'ombre partagé.

/** LES TENUES PROPOSÉES (fictives) — l'identifiant sert à l'adresse (?tenue0=rouge-blanc-raye) et à la sauvegarde : motif, deux couleurs,
 *  liseré, short, chaussettes (et leur bande), numéro (couleur, contour). */
export const TENUES = {
  'raye-noir-blanc': { nom: 'rayé noir et blanc', motif: 'rayures', c1: 0xf2f2f2, c2: 0x161616, lisere: 0x161616, short: 0x161616, chaussettes: 0x161616, bande: 0xf2f2f2, num: 0x161616, numBord: 0xf2f2f2 },
  'bleu-ciel': { nom: 'bleu ciel', motif: 'uni', c1: 0x8fcbef, c2: 0xffffff, lisere: 0xffffff, short: 0xffffff, chaussettes: 0x8fcbef, bande: 0xffffff, num: 0x0f2a44, numBord: 0xffffff },
  'rouge-blanc-raye': { nom: 'rouge et blanc rayé', motif: 'rayures', c1: 0xd0202e, c2: 0xf4f4f4, lisere: 0xf4f4f4, short: 0x111111, chaussettes: 0x111111, bande: 0xd0202e, num: 0x111111, numBord: 0xf4f4f4 },
  'vert-blanc-cercle': { nom: 'vert et blanc cerclé', motif: 'cerceaux', c1: 0x0f8a4c, c2: 0xf4f4f4, lisere: 0xf4f4f4, short: 0xf4f4f4, chaussettes: 0xf4f4f4, bande: 0x0f8a4c, num: 0x0f8a4c, numBord: 0xf4f4f4 },
  'bleu-roi': { nom: 'bleu roi', motif: 'uni', c1: 0x1f3aa8, c2: 0xffffff, lisere: 0xffffff, short: 0xffffff, chaussettes: 0x1f3aa8, bande: 0xffffff, num: 0xffffff, numBord: 0x0d1a52 },
  'orange': { nom: 'orange', motif: 'uni', c1: 0xf07a12, c2: 0x111111, lisere: 0x111111, short: 0x111111, chaussettes: 0xf07a12, bande: 0x111111, num: 0x111111, numBord: 0xf07a12 },
  'blanc-a-echarpe-rouge': { nom: 'blanc à écharpe rouge', motif: 'echarpe', c1: 0xf6f6f6, c2: 0xc8102e, lisere: 0xc8102e, short: 0xf6f6f6, chaussettes: 0xf6f6f6, bande: 0xc8102e, num: 0x111111, numBord: 0xf6f6f6 },
  'grenat-bleu-moities': { nom: 'grenat et bleu, moitiés', motif: 'moities', c1: 0x8e1b3a, c2: 0x1a3c8c, lisere: 0xf0c419, short: 0x1a3c8c, chaussettes: 0x8e1b3a, bande: 0xf0c419, num: 0xf0c419, numBord: 0x2a0e18 },
  'blanc-a-bande-rouge': { nom: 'blanc à bande rouge', motif: 'bande', c1: 0xf6f6f6, c2: 0xc8102e, lisere: 0xc8102e, short: 0xf6f6f6, chaussettes: 0xf6f6f6, bande: 0xc8102e, num: 0x111111, numBord: 0xf6f6f6 },
  'jaune-vert': { nom: 'jaune et vert', motif: 'uni', c1: 0xf6d01a, c2: 0x0f7a3a, lisere: 0x0f7a3a, short: 0x1f3aa8, chaussettes: 0xf6f6f6, bande: 0x0f7a3a, num: 0x0f7a3a, numBord: 0xf6d01a },
  'violet': { nom: 'violet', motif: 'uni', c1: 0x5b2a86, c2: 0xf4f4f4, lisere: 0xf4f4f4, short: 0x5b2a86, chaussettes: 0x5b2a86, bande: 0xf4f4f4, num: 0xf4f4f4, numBord: 0x2a1040 },
  'noir-or': { nom: 'noir et or', motif: 'uni', c1: 0x151515, c2: 0xd4a017, lisere: 0xd4a017, short: 0x151515, chaussettes: 0x151515, bande: 0xd4a017, num: 0xd4a017, numBord: 0x151515 },
  'bleu-blanc-raye': { nom: 'bleu et blanc rayé', motif: 'rayures', c1: 0x1e5bb8, c2: 0xf4f4f4, lisere: 0xf4f4f4, short: 0xf4f4f4, chaussettes: 0x1e5bb8, bande: 0xf4f4f4, num: 0x0e2a5a, numBord: 0xf4f4f4 },
  'rouge': { nom: 'rouge', motif: 'uni', c1: 0xc8202f, c2: 0xf4f4f4, lisere: 0xf4f4f4, short: 0xf4f4f4, chaussettes: 0xc8202f, bande: 0xf4f4f4, num: 0xf4f4f4, numBord: 0x5a0d14 },
  'vert': { nom: 'vert', motif: 'uni', c1: 0x11843f, c2: 0xf4f4f4, lisere: 0xf4f4f4, short: 0xf4f4f4, chaussettes: 0x11843f, bande: 0xf4f4f4, num: 0xf4f4f4, numBord: 0x063a1b },
  'blanc': { nom: 'blanc', motif: 'uni', c1: 0xf4f4f4, c2: 0x101820, lisere: 0x101820, short: 0x101820, chaussettes: 0xf4f4f4, bande: 0x101820, num: 0x101820, numBord: 0xf4f4f4 },
};
export const MOTIFS = { uni: 'Uni', rayures: 'Rayures', cerceaux: 'Cerceaux', moities: 'Moitiés', echarpe: 'Écharpe', bande: 'Bande centrale' };
/** Les couleurs du gardien, dans l'ordre de préférence : la plus éloignée des deux équipes l'emporte. */
const GARDIENS = [0xf5cc29, 0x3cc35a, 0xf28c28, 0xe8508f, 0x8a4fd6, 0x25c5d6, 0x9aa0a6, 0x111111];

// la carte : la boîte du corps au repos (m) — la même que tools/maillot-carte.py
const BOITE = [[-0.70, -0.05, -0.20], [0.70, 1.60, 0.25]];
// LES ZONES D'IMPRESSION, mesurées sur l'atlas 2048 (tools/maillot-carte.py, la texture du n° 18) : [x0, y0, x1, y1] en px
const IMPRESSION = {
  dos: [845, 390, 1145, 805],      // le nom et le grand numéro — TÊTE-BÊCHE dans l'atlas (le haut du dos est vers le bas de l'image)
  poitrine: [958, 1100, 1022, 1172], // le petit numéro, au milieu de la poitrine (entre le logo et l'écusson)
  short: [262, 262, 392, 386],     // le numéro du short (jambe gauche)
};
const ECUSSON = { x: 1065, y: 1146, d: 86 }, SPONSOR = { x: 995, y: 1252, w: 236, h: 92 };

const rgbDe = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
const hexCss = (hex) => `#${(hex >>> 0).toString(16).padStart(6, '0')}`;
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
  const sombre = ecart(best, 0) < 260;
  return { motif: 'uni', c1: best, c2: sombre ? 0xf2f2f2 : 0x161616, lisere: sombre ? 0xf2f2f2 : 0x161616, short: best, chaussettes: best, bande: sombre ? 0xf2f2f2 : 0x161616, num: sombre ? 0xf2f2f2 : 0x161616, numBord: best };
}

/** La carte du maillot : les zones (2048², une par texel) et la forme (1024², position sur le corps et relief). */
export async function chargerCarte(base) {
  const lire = async (nom) => {
    const im = new Image(); im.src = base + nom; await im.decode();
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0);
    return { w: im.width, d: g.getImageData(0, 0, im.width, im.height).data };
  };
  const [z, f] = await Promise.all([lire('maillot-zones.png'), lire('maillot-forme.png')]);
  const zones = new Uint8Array(z.w * z.w); for (let i = 0; i < zones.length; i++) zones[i] = z.d[i * 4];
  return { N: z.w, NF: f.w, zones, forme: f.d };
}

/**
 * PEINDRE UNE TENUE sur la texture d'un corps : le motif (dans l'espace du corps), le liseré, le short, les chaussettes et leur bande, le
 * relief des plis ; puis l'écusson et le sponsor. Rend un canevas (taille × taille) — réutilise `canevas` s'il est donné.
 * @param {ImageBitmap|HTMLImageElement|HTMLCanvasElement} corps la texture d'origine du corps (la peau, les chaussures restent les siennes)
 */
export function peindreTenue(corps, carte, T, { taille = 2048, canevas = null, club = null } = {}) {
  const c = canevas ?? document.createElement('canvas'); c.width = c.height = taille;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(corps, 0, 0, taille, taille);
  const img = g.getImageData(0, 0, taille, taille), px = img.data;
  const { N, NF, zones, forme } = carte, k = N / taille, kf = NF / taille;
  const C1 = rgbDe(T.c1), C2 = rgbDe(T.c2), LI = rgbDe(T.lisere), SH = rgbDe(T.short), CH = rgbDe(T.chaussettes), BA = rgbDe(T.bande);
  const bx = BOITE[0][0], sx = BOITE[1][0] - bx, by = BOITE[0][1], sy = BOITE[1][1] - by, bz = BOITE[0][2], sz = BOITE[1][2] - bz;
  // LA POSITION SUR LE CORPS, LUE EN BILINÉAIRE pour le maillot (les bords des rayures, des cerceaux, de l'écharpe) : stockée sur 8 bits
  // (des pas de 5-6 mm), lue au plus proche elle dessinait des marches d'escalier ; un voisin d'un autre îlot (plus de ~6 cm d'écart) est
  // remplacé par le plus proche — on ne mélange pas à travers une couture
  const P = new Float32Array(3);
  const bilin = (u, v) => {
    const x0 = Math.max(0, Math.min(NF - 2, Math.floor(u))), y0 = Math.max(0, Math.min(NF - 2, Math.floor(v))), tx = Math.min(1, Math.max(0, u - x0)), ty = Math.min(1, Math.max(0, v - y0));
    const i00 = (y0 * NF + x0) * 4, i10 = i00 + 4, i01 = i00 + NF * 4, i11 = i01 + 4;
    const ref = tx < 0.5 ? (ty < 0.5 ? i00 : i01) : (ty < 0.5 ? i10 : i11);
    const pr = (i) => (Math.abs(forme[i] - forme[ref]) + Math.abs(forme[i + 1] - forme[ref + 1]) + Math.abs(forme[i + 2] - forme[ref + 2]) > 12 ? ref : i);
    const a = pr(i00), b = pr(i10), c = pr(i01), d = pr(i11);
    for (let ch = 0; ch < 3; ch++) P[ch] = (forme[a + ch] * (1 - tx) + forme[b + ch] * tx) * (1 - ty) + (forme[c + ch] * (1 - tx) + forme[d + ch] * tx) * ty;
  };
  for (let py = 0; py < taille; py++) {
    const zy = Math.floor(py * k) * N, fy = Math.floor(py * kf) * NF;
    for (let qx = 0; qx < taille; qx++) {
      const zone = zones[zy + Math.floor(qx * k)]; if (!zone) continue;
      const fi = (fy + Math.floor(qx * kf)) * 4;
      let x = bx + (forme[fi] / 255) * sx, y = by + (forme[fi + 1] / 255) * sy, z = bz + (forme[fi + 2] / 255) * sz;
      const ao = forme[fi + 3] / 255;
      if (zone === 1) { bilin((qx + 0.5) * kf - 0.5, (py + 0.5) * kf - 0.5); x = bx + (P[0] / 255) * sx; y = by + (P[1] / 255) * sy; z = bz + (P[2] / 255) * sz; }
      let col;
      if (zone === 1) col = motif(T.motif, x, y, z) ? C2 : C1;
      else if (zone === 2) col = LI;
      else if (zone === 3) col = SH;
      else if (zone === 4) col = LI;
      else col = y > 0.385 ? BA : CH;   // la chaussette : sa bande sous le genou (elle monte à ~0,44 m)
      const o = (py * taille + qx) * 4;
      px[o] = col[0] * ao; px[o + 1] = col[1] * ao; px[o + 2] = col[2] * ao;
    }
  }
  g.putImageData(img, 0, 0);
  // l'écusson du club (à droite de la poitrine) et son sponsor (au milieu) — l'avant du maillot est droit dans l'atlas
  const s = taille / 2048;
  if (club) {
    const cr = drawCrest(club, 128);
    g.drawImage(cr, (ECUSSON.x - ECUSSON.d / 2) * s, (ECUSSON.y - ECUSSON.d / 2) * s, ECUSSON.d * s, ECUSSON.d * s);
    const sp = club.sponsors?.[0];
    if (sp) {
      // la couleur du sponsor : la plus lisible sur la couleur dominante (blanc ou noir), un contour de l'autre — lisible sur des rayures
      const blanc = ecart(T.c1, 0xffffff) > ecart(T.c1, 0x000000);
      g.save(); g.translate(SPONSOR.x * s, SPONSOR.y * s); g.textAlign = 'center'; g.textBaseline = 'middle';
      let fs = SPONSOR.h * 0.55 * s; g.font = `800 ${fs}px "Barlow Condensed", "Arial Narrow", Impact, sans-serif`;
      const w = g.measureText(sp).width; if (w > SPONSOR.w * s) { fs *= (SPONSOR.w * s) / w; g.font = `800 ${fs}px "Barlow Condensed", "Arial Narrow", Impact, sans-serif`; }
      g.lineJoin = 'round'; g.lineWidth = Math.max(1.5, fs * 0.08); g.strokeStyle = blanc ? '#141414' : '#f6f6f6'; g.strokeText(sp, 0, 0);
      g.fillStyle = blanc ? '#f6f6f6' : '#141414'; g.fillText(sp, 0, 0); g.restore();
    }
  }
  return c;
}
/** Vrai : la couleur 2 à ce point du corps (x latéral, y hauteur, z avant). Le torse fait ~0,36 m de large ; les manches (|x| > 0,21) restent
 *  unies (couleur 1), sauf pour les cerceaux et les moitiés. */
function motif(m, x, y, z) {
  const manche = Math.abs(x) > 0.21;
  switch (m) {
    case 'rayures': return !manche && (Math.floor((x + 0.03) / 0.06) & 1) === 1;
    case 'cerceaux': return (Math.floor((y - 0.92) / 0.085) & 1) === 1;
    case 'moities': return x < 0;
    case 'echarpe': { if (manche) return false; const d = (z >= 0 ? x : -x) * 0.766 + (y - 1.18) * 0.643; return Math.abs(d) < 0.075; }
    case 'bande': return !manche && Math.abs(x) < 0.075;
    default: return false;
  }
}

/** LE FLOCAGE : un atlas de cases (colonnes × rangées), une par joueur. Dans une case (fraction de la case) : le dos [0, 0, 0.72, 1], la
 *  poitrine [0.76, 0, 1, 0.24], le short [0.76, 0.30, 1, 0.54] — des marges vides entre les cases (le filtrage lit les voisins). */
export const ATLAS = { cols: 6, rangs: 4 };
export function creerAtlasFlocage({ cellule = 384 } = {}) {
  const c = document.createElement('canvas'); c.width = ATLAS.cols * cellule; c.height = ATLAS.rangs * cellule;
  const tex = textureDe(c);
  return {
    canevas: c, tex, cellule,
    /** La case `i` (0-23) : son décalage dans l'atlas (uv), à poser dans le matériau du joueur (`cellule`). */
    decalage(i) { return new THREE.Vector2((i % ATLAS.cols) / ATLAS.cols, Math.floor(i / ATLAS.cols) / ATLAS.rangs); },
    /** Dessiner le flocage du joueur `i` : son nom, son numéro, aux couleurs de sa tenue. */
    dessiner(i, { nom, numero }, T) {
      const g = c.getContext('2d'), x0 = (i % ATLAS.cols) * cellule, y0 = Math.floor(i / ATLAS.cols) * cellule, S = cellule;
      g.save(); g.clearRect(x0, y0, S, S); g.translate(x0, y0);
      const F = (poids, px) => `${poids} ${px}px "Barlow Condensed", "Roboto Condensed", "Arial Narrow", Impact, sans-serif`;
      const ecrire = (txt, cx, cy, h, maxW, poids = 800) => {
        let fs = h; g.font = F(poids, fs);
        const w = g.measureText(txt).width; if (w > maxW) { fs *= maxW / w; g.font = F(poids, fs); }
        g.lineJoin = 'round'; g.lineWidth = Math.max(2, fs * 0.09); g.strokeStyle = hexCss(T.numBord); g.strokeText(txt, cx, cy);
        g.fillStyle = hexCss(T.num); g.fillText(txt, cx, cy);
      };
      g.textAlign = 'center'; g.textBaseline = 'middle';
      const W = S * 0.72;
      if (nom) ecrire(nom.toUpperCase(), W / 2, S * 0.16, S * 0.12, W * 0.88, 700);
      ecrire(String(numero), W / 2, S * 0.58, S * 0.62, W * 0.9);
      ecrire(String(numero), S * 0.88, S * 0.12, S * 0.2, S * 0.2);
      ecrire(String(numero), S * 0.88, S * 0.42, S * 0.2, S * 0.2);
      g.restore(); tex.needsUpdate = true;
    },
  };
}

const CASES = { dos: [0, 0, 0.72, 1], poitrine: [0.76, 0, 1, 0.24], short: [0.76, 0.30, 1, 0.54] };
/** LE GRAPHE DE COULEUR, construit une fois pour les 22 : la tenue du matériau (`tenue`, par référence), et par-dessus, sur les trois
 *  zones d'impression, sa case de l'atlas du flocage (`cellule`, par référence). */
export function couleurFloquee(atlasTex) {
  const U = uv(), base = materialReference('tenue', 'texture'), cellule = materialReference('cellule', 'vec2');
  let col = base.rgb;
  for (const [zone, R] of Object.entries(IMPRESSION)) {
    const [x0, y0, x1, y1] = R.map((v) => v / 2048), [s0, t0, s1, t1] = CASES[zone], tete = zone === 'dos';
    const dedans = step(x0, U.x).mul(step(U.x, x1)).mul(step(y0, U.y)).mul(step(U.y, y1));
    const lx = tete ? float(x1).sub(U.x).div(x1 - x0) : U.x.sub(x0).div(x1 - x0);   // tête-bêche : (x1 − u) / largeur
    const ly = tete ? float(y1).sub(U.y).div(y1 - y0) : U.y.sub(y0).div(y1 - y0);
    const dansCase = vec2(lx.mul(s1 - s0).add(s0).div(ATLAS.cols), ly.mul(t1 - t0).add(t0).div(ATLAS.rangs));
    const p = texture(atlasTex, dansCase.add(cellule));
    col = mix(col, p.rgb, p.a.mul(dedans));
  }
  return col;
}

/** LE MATÉRIAU DE TENUE : un matériau standard dont la couleur est le graphe partagé — posé le temps de construire son rendu principal
 *  (setupDiffuseColor), absent sinon : la passe d'ombre ne voit ni `map` ni `colorNode` et garde son matériau commun. La clé de programme
 *  porte le graphe (sinon un matériau standard sans carte pourrait prendre le même programme). */
class MateriauTenue extends THREE.MeshStandardNodeMaterial {
  static get type() { return 'MateriauTenue'; }
  constructor(couleur) { super(); this.couleurTenue = couleur; this.tenue = null; this.cellule = new THREE.Vector2(); }
  setupDiffuseColor(builder) { this.colorNode = this.couleurTenue; try { super.setupDiffuseColor(builder); } finally { this.colorNode = null; } }
  customProgramCacheKey() { return `${super.customProgramCacheKey()}:tenue:${this.couleurTenue.getCacheKey()}`; }
}
/** LE MATÉRIAU D'UN JOUEUR : celui de son corps (relief, rugosité, double face) ; sa couleur, le graphe partagé — la tenue de son équipe
 *  (`tenue`) et sa case du flocage (`cellule`). */
export function materiauTenue(origine, tenueTex, cellule, couleur) {
  const m = new MateriauTenue(couleur);
  m.name = 'body-tenue'; m.side = origine.side; m.normalMap = origine.normalMap; if (origine.normalScale) m.normalScale.copy(origine.normalScale);
  m.roughnessMap = origine.roughnessMap; m.metalnessMap = origine.metalnessMap; m.roughness = origine.roughness; m.metalness = origine.metalness;
  m.tenue = tenueTex; m.cellule.copy(cellule);
  return m;
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
