import * as THREE from 'three/webgpu';
import { texture, uv, vec3, vec4, float, step, smoothstep, mix, clamp, dot, abs, max, min, fract, sin, length, fwidth, materialReference, luminance } from 'three/tsl';
import { formeDuCorps } from './gpf-maillots.js';

// gpf-apparence.js — L'APPARENCE DES JOUEURS de /match11 (lot L5, EX-26 « apparence pilotée par les données : peau, cheveux, visage ») : la
// couleur de peau, les cheveux (couleur et coupe), la barbe et la calvitie de chaque joueur, dessinées sur les deux têtes Rocketbox — sans
// texture par joueur : un graphe de couleur partagé par les 22 têtes (comme les tenues), des réglages par référence au matériau.
//
// LES DEUX TÊTES (le même squelette, les mêmes matrices de liaison : chacune se pose sur n'importe quel corps) :
//   A — le n° 18 : une tête complète, les cheveux courts PEINTS sur le crâne ; toutes les coupes peintes (courte, rasée, chauve, dégarnie) ;
//   B — le n° 10 : un volume de cheveux à part (deux calottes, des mèches derrière) et des dreadlocks en cartes transparentes : les dreadlocks.
// LA PEAU : la couleur visée, portée par le DÉTAIL de la texture d'origine (sa luminance rapportée à celle de sa peau : pores, ombres, rides
// restent) ; LES CHEVEUX : de même, sur les texels sombres (cheveux, sourcils, barbe peinte) ; LA BARBE : peinte par régions du visage
// mesurées sur la tête au repos (moustache, bouc, barbe pleine, barbe naissante), les poils en bruit fin qui se fond au loin.

// ———————————————————————————— le visage de la carrière (foot, src/data/visage.ts — porté à l'identique) ————————————————————————————
// La carrière tire le visage de ses fiches (la carte du joueur, en 2D) de son id, de son ORIGINE et de son ÂGE : la teinte de peau dans la
// palette de l'origine, la couleur des cheveux pondérée, la coupe (les communes et celles de l'origine, doublées), la calvitie (42 % des
// joueurs, de 24 à 38 ans), les cheveux gris (dès 32 ans), la pilosité selon l'âge. Rien n'y est stocké : le même joueur retrouve le même
// visage partout. La 3D de la carrière en tire un autre, au hasard (characterAppearance.ts) : c'est celui des fiches que l'on suit ici.
function hashString(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const unite = (id, sel) => (hashString(`${sel}-${id}`) % 100000) / 100000;
const CHATAIN = '#5a4030', BRUN = '#3a2a1e', NOIR = '#1c1512', BLOND = '#b89a5c', ROUX = '#8a4526', GRIS = '#8d8880';
const BLEU = '#5b7fa6', VERT = '#5d7a52', NOISETTE = '#7a5c38', MARRON = '#3f2c1c';
export const TEINTS = ['#f5d9c0', '#eecaa8', '#e3b48d', '#d9a679', '#c68f63', '#a9714a', '#8a5738', '#6d422a', '#52301e', '#3d2417'];
export const COULEURS_CHEVEUX = { [NOIR]: 'noirs', [BRUN]: 'bruns', [CHATAIN]: 'châtains', [BLOND]: 'blonds', [ROUX]: 'roux', [GRIS]: 'gris' };
const COUPES_COMMUNES = ['rase', 'court', 'brosse', 'raie', 'mi_long'];
export const ORIGINES = {
  fr: { peaux: TEINTS.slice(0, 5), cheveux: [[CHATAIN, 4], [BRUN, 3], [BLOND, 2], [NOIR, 1], [ROUX, 1]], coupes: ['court', 'raie'], yeux: [[MARRON, 4], [BLEU, 3], [VERT, 2], [NOISETTE, 2]] },
  es: { peaux: TEINTS.slice(1, 6), cheveux: [[BRUN, 5], [NOIR, 3], [CHATAIN, 2]], coupes: ['court', 'mi_long'], yeux: [[MARRON, 6], [NOISETTE, 2], [VERT, 1]] },
  it: { peaux: TEINTS.slice(1, 6), cheveux: [[BRUN, 5], [NOIR, 3], [CHATAIN, 2]], coupes: ['court', 'chignon'], yeux: [[MARRON, 6], [NOISETTE, 2], [VERT, 1]] },
  de: { peaux: TEINTS.slice(0, 4), cheveux: [[BLOND, 4], [CHATAIN, 4], [BRUN, 2]], coupes: ['brosse', 'court'], yeux: [[BLEU, 5], [MARRON, 2], [VERT, 2]] },
  en: { peaux: TEINTS.slice(0, 5), cheveux: [[CHATAIN, 4], [BLOND, 3], [BRUN, 2], [ROUX, 1]], coupes: ['rase', 'court'], yeux: [[BLEU, 4], [MARRON, 3], [VERT, 2]] },
  nl: { peaux: TEINTS.slice(0, 4), cheveux: [[BLOND, 5], [CHATAIN, 3], [BRUN, 1]], coupes: ['court', 'chignon'], yeux: [[BLEU, 6], [VERT, 2], [MARRON, 1]] },
  scandi: { peaux: TEINTS.slice(0, 3), cheveux: [[BLOND, 6], [CHATAIN, 2], [ROUX, 1]], coupes: ['mi_long', 'chignon'], yeux: [[BLEU, 7], [VERT, 2], [MARRON, 1]] },
  slav: { peaux: TEINTS.slice(0, 4), cheveux: [[CHATAIN, 4], [BLOND, 3], [BRUN, 2]], coupes: ['brosse', 'court'], yeux: [[BLEU, 4], [VERT, 3], [MARRON, 2]] },
  greek: { peaux: TEINTS.slice(2, 6), cheveux: [[NOIR, 5], [BRUN, 4]], coupes: ['court', 'boucles'], yeux: [[MARRON, 6], [NOISETTE, 2], [VERT, 1]] },
  pt: { peaux: TEINTS.slice(1, 7), cheveux: [[BRUN, 4], [NOIR, 4], [CHATAIN, 1]], coupes: ['court', 'boucles'], yeux: [[MARRON, 7], [NOISETTE, 2]] },
  maghreb: { peaux: TEINTS.slice(2, 7), cheveux: [[NOIR, 6], [BRUN, 3]], coupes: ['court', 'boucles', 'rase'], yeux: [[MARRON, 7], [NOISETTE, 2], [VERT, 1]] },
  ouest_afrique: { peaux: TEINTS.slice(5, 10), cheveux: [[NOIR, 9]], coupes: ['rase', 'afro', 'tresses'], yeux: [[MARRON, 8], [NOISETTE, 1]] },
  afrique_centrale: { peaux: TEINTS.slice(5, 10), cheveux: [[NOIR, 9]], coupes: ['rase', 'afro', 'tresses'], yeux: [[MARRON, 8], [NOISETTE, 1]] },
};
export const NOMS_ORIGINES = { fr: 'France', es: 'Espagne', it: 'Italie', de: 'Allemagne', en: 'Angleterre', nl: 'Pays-Bas', scandi: 'Scandinavie', slav: 'Europe slave', greek: 'Grèce', pt: 'Portugal, Brésil', maghreb: 'Maghreb', ouest_afrique: 'Afrique de l’Ouest', afrique_centrale: 'Afrique centrale' };
function pondere(choix, u) { const total = choix.reduce((s, [, p]) => s + p, 0); let seuil = u * total; for (const [v, p] of choix) { seuil -= p; if (seuil <= 0) return v; } return choix[choix.length - 1][0]; }
const entre = (id, sel, a, b) => a + unite(id, sel) * (b - a);
const AGE_DES_PREMIERS_DEGARNIS = 24, AGE_DE_LA_CALVITIE_FAITE = 38, PART_DES_DEGARNIS = 0.42;
export function assombrir(hex, k) { const n = Number.parseInt(hex.slice(1), 16), f = (d) => Math.max(0, Math.round(((n >> d) & 255) * k)); return `#${[f(16), f(8), f(0)].map((v) => v.toString(16).padStart(2, '0')).join('')}`; }
/** LE VISAGE DE LA CARRIÈRE (visage.ts, visageDuJoueur) : à l'identique. */
export function visageDuJoueur(id, origine, age) {
  const o = ORIGINES[origine] ?? ORIGINES.fr;
  const peau = o.peaux[Math.floor(unite(id, 'teint') * o.peaux.length)];
  const cheveux = pondere(o.cheveux, unite(id, 'cheveux'));
  const touche = unite(id, 'degarni') < PART_DES_DEGARNIS;
  const avancee = Math.max(0, Math.min(1, (age - AGE_DES_PREMIERS_DEGARNIS) / (AGE_DE_LA_CALVITIE_FAITE - AGE_DES_PREMIERS_DEGARNIS)));
  const calvitie = touche ? avancee * entre(id, 'calvitie', 0.5, 1) : 0;
  const catalogue = [...COUPES_COMMUNES.map((c) => [c, 1]), ...o.coupes.map((c) => [c, 2])];
  const coupe = calvitie > 0.75 ? 'rase' : pondere(catalogue, unite(id, 'coupe'));
  const pilosite = pondere([['glabre', Math.max(1, 30 - age)], ['barbe_naissante', 10], ['bouc', 4 + Math.max(0, age - 20) * 0.3], ['barbe', 3 + Math.max(0, age - 20) * 0.5], ['moustache', 1]], unite(id, 'pilosite'));
  const teinteCheveux = age >= 32 && unite(id, 'grisonne') < (age - 30) / 18 ? GRIS : cheveux;
  return {
    peau, peauOmbre: assombrir(peau, 0.86), cheveux: teinteCheveux, poil: assombrir(teinteCheveux, 0.74), coupe, calvitie, pilosite,
    largeur: entre(id, 'largeur', 0.9, 1.1), machoire: entre(id, 'machoire', 0.9, 1.1), yeux: pondere(o.yeux, unite(id, 'yeux')), ecartYeux: entre(id, 'ecart', 0.92, 1.08),
    sourcils: entre(id, 'sourcils', 0.7, 1.3), bouche: entre(id, 'bouche', 0.85, 1.15), usure: Math.max(0, Math.min(1, (age - 22) / 16)),
  };
}

// ———————————————————————————— de la carrière à nos têtes ————————————————————————————
/** L'ORIGINE d'un de nos joueurs (fictifs) : celle de son patronyme (feuille.mjs — la carrière tire ses noms par origine, noms/<locale>.ts). */
const ORIGINE_DU_NOM = {};
for (const [loc, noms] of Object.entries({
  es: 'Ortega Navarro Molina Delgado Castro Rubio Serrano', pt: 'Ferreira Carvalho Mendes Pinto', it: 'Bianchi Romano Colombo Ricci Marino Greco Gallo',
  ouest_afrique: 'Diallo Traoré Koné Camara Ndiaye Mensah Owusu Sylla Cissé Keita Sow', afrique_centrale: 'Bakari', scandi: 'Hansen Larsen Berg Lindqvist',
  de: 'Vogel Becker Koch', slav: 'Novak Horvat Kowalski Petrov', nl: 'Janssen',
})) for (const n of noms.split(' ')) ORIGINE_DU_NOM[n] = loc;
export const origineDuNom = (nom) => ORIGINE_DU_NOM[String(nom ?? '').replace(/^[^.]*\.\s*/, '')] ?? 'fr';
/** L'âge d'un de nos joueurs (fictifs), tiré par son id : 18 à 35 ans, autour de 26. */
export const ageDe = (id) => 18 + Math.round(((unite(id, 'age1') + unite(id, 'age2')) / 2) * 17);
/**
 * LES COUPES de la carrière sur nos deux têtes : la tête A (cheveux courts peints) les prend presque toutes — rase (rasée ; chauve quand la
 * calvitie passe 0,9), court, brosse, raie, mi-long, chignon, boucles (courtes, faute de volume) ; la tête B (son volume de cheveux) l'afro
 * (sans ses mèches) et les tresses (ses dreadlocks). Le volume d'un mi-long, d'un chignon, de boucles demande un maillage (la carrière les a
 * en Blender : scripts/blender/coiffures.py).
 */
export const COUPE_3D = { rase: 'rasee', court: 'courte', brosse: 'courte', raie: 'courte', mi_long: 'courte', chignon: 'courte', boucles: 'courte', afro: 'afro', tresses: 'dreadlocks' };
export const NOMS_COUPES = { rase: 'Rasée', court: 'Courte', brosse: 'En brosse', raie: 'Avec une raie', mi_long: 'Mi-longue', chignon: 'Chignon', boucles: 'Bouclée', afro: 'Afro', tresses: 'Tresses (dreadlocks)' };
export const NOMS_PILOSITES = { glabre: 'Glabre', barbe_naissante: 'Barbe naissante', bouc: 'Bouc', barbe: 'Barbe', moustache: 'Moustache' };
const PILOSITE_3D = { glabre: 'glabre', barbe_naissante: 'naissante', bouc: 'bouc', barbe: 'barbe', moustache: 'moustache' };
/**
 * LA PEAU EN 3D. Les teintes de la carrière sont des aplats d'illustration (la carte en 2D, des pastels) : prises pour l'albédo d'une peau
 * éclairée, les claires sortaient blanc-gris, sans le rouge d'une peau (vu le 3 octobre). À chacune des dix teintes répond un albédo de peau,
 * calé sur les deux peaux d'origine des Rocketbox — celle du n° 18 (≈ 195, 132, 103) vers la 3e, celle du n° 10 (≈ 160, 105, 70) vers la
 * 6e ; les foncées gardent assez de clarté pour que le détail se lise. Une teinte hors palette (réglage) : sa luminance ramenée à celle d'une
 * peau (L₃ = 0,42 · L₂^0,62), sa saturation relevée.
 */
const PEAUX_3D = [0xdcaa8c, 0xd29b7a, 0xc68c6a, 0xbc7f5d, 0xaa714f, 0x956243, 0x7e5136, 0x66412a, 0x523421, 0x40291a];
const versLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4), versSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
export function peau3D(hex) {
  const i = TEINTS.indexOf(String(hex).toLowerCase()); if (i >= 0) return PEAUX_3D[i];
  const n = Number.parseInt(String(hex).slice(1), 16), c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => versLin(v / 255));
  const L = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2], k = L > 0 ? (0.42 * L ** 0.62) / L : 1, L3 = L * k;
  return c.map((v) => Math.round(Math.max(0, Math.min(1, versSrgb(L3 + (v * k - L3) * 1.6))) * 255)).reduce((h, v) => (h << 8) | v, 0);
}
/** L'APPARENCE 3D d'un visage de la carrière : la tête (A, B), la coupe dessinée, les couleurs (peau, cheveux, poils), la calvitie, la barbe. */
export function apparenceDe(V) {
  const c3 = V.calvitie >= 0.9 && V.coupe === 'rase' ? 'chauve' : COUPE_3D[V.coupe] ?? 'courte';
  const hex = (h) => Number.parseInt(String(h).slice(1), 16);
  return { tete: c3 === 'afro' || c3 === 'dreadlocks' ? 'B' : 'A', coupe: c3, peau: peau3D(V.peau), cheveux: hex(V.cheveux), barbe: hex(V.poil), calvitie: V.calvitie, pilosite: PILOSITE_3D[V.pilosite] ?? 'glabre' };
}

// ———————————————————————————— l'analyse d'une tête (au chargement) ————————————————————————————
/** Les îlots de dépliage d'un maillage (sommets partagés), et ceux de l'INTÉRIEUR du visage : les yeux, l'intérieur de la bouche, les dents
 *  (petits îlots entre 1,59 et 1,715 m, devant, à moins de 6 cm de l'axe) — ni peau ni cheveux, on n'y touche pas. */
function ilotsInterieurs(geo) {
  const pos = geo.attributes.position, idx = geo.index, n = pos.count, par = new Int32Array(n).map((_, i) => i);
  const rac = (i) => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; };
  const T = idx ? idx.count : n, s = (t) => (idx ? idx.getX(t) : t);
  for (let t = 0; t + 2 < T; t += 3) { const a = rac(s(t)), b = rac(s(t + 1)), c = rac(s(t + 2)); par[b] = a; par[rac(c)] = a; }
  const B = new Map();
  for (let i = 0; i < n; i++) {
    const r = rac(i), x = Math.abs(pos.getX(i)), y = pos.getY(i), z = pos.getZ(i);
    const b = B.get(r) ?? { n: 0, x: 0, y0: 9, y1: -9, z0: 9 }; b.n++; b.x = Math.max(b.x, x); b.y0 = Math.min(b.y0, y); b.y1 = Math.max(b.y1, y); b.z0 = Math.min(b.z0, z); B.set(r, b);
  }
  const dedans = new Set(); for (const [r, b] of B) if (b.n < 150 && b.x < 0.06 && b.y0 > 1.59 && b.y1 < 1.715 && b.z0 > 0.04) dedans.add(r);
  return { rac, dedans };
}
/** Tramer dans l'espace des UV les triangles retenus : un masque (NF²). */
function tramerMasque(geo, NF, garder) {
  const pos = geo.attributes.position, tc = geo.attributes.uv, idx = geo.index, T = idx ? idx.count : pos.count, s = (t) => (idx ? idx.getX(t) : t);
  const M = new Uint8Array(NF * NF);
  for (let t = 0; t + 2 < T; t += 3) {
    const i0 = s(t), i1 = s(t + 1), i2 = s(t + 2); if (!garder(i0)) continue;
    const ax = tc.getX(i0) * NF - 0.5, ay = tc.getY(i0) * NF - 0.5, bx = tc.getX(i1) * NF - 0.5, by = tc.getY(i1) * NF - 0.5, cx = tc.getX(i2) * NF - 0.5, cy = tc.getY(i2) * NF - 0.5;
    const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy); if (Math.abs(d) < 1e-12) continue;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx)) - 1), x1 = Math.min(NF - 1, Math.ceil(Math.max(ax, bx, cx)) + 1);
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy)) - 1), y1 = Math.min(NF - 1, Math.ceil(Math.max(ay, by, cy)) + 1);
    for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) {
      const l0 = ((by - cy) * (gx - cx) + (cx - bx) * (gy - cy)) / d, l1 = ((cy - ay) * (gx - cx) + (ax - cx) * (gy - cy)) / d, l2 = 1 - l0 - l1;
      if (l0 > -0.05 && l1 > -0.05 && l2 > -0.05) M[gy * NF + gx] = 255;   // (un peu débordé : le filtrage lit la marge)
    }
  }
  return M;
}
const lin = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);   // sRGB → linéaire (le shader lit la texture en linéaire)
/**
 * ANALYSER UNE TÊTE : sa forme (position au repos et relief de chaque texel, formeDuCorps), le masque de l'intérieur du visage, et les
 * références de sa texture, en LINÉAIRE comme le shader les lira — la luminance de sa peau (le texel au 40e centile des teintes de peau), celle
 * de ses cheveux (la médiane des texels sombres du crâne), et les deux seuils qui séparent cheveux et peau.
 */
export function analyserTete(mesh, NF = 512) {
  const geo = mesh.geometry, mat = [].concat(mesh.material)[0], img = mat.map?.image;
  const forme = formeDuCorps(geo, mat.normalMap?.image ?? null, NF);
  const { rac, dedans } = ilotsInterieurs(geo), interieur = tramerMasque(geo, NF, (i) => dedans.has(rac(i)));
  // les références : la texture lue à NF², chaque texel classé par sa position (le crâne, le visage) et sa couleur
  const c = document.createElement('canvas'); c.width = c.height = NF;
  const g = c.getContext('2d', { willReadFrequently: true }); if (img) g.drawImage(img, 0, 0, NF, NF);
  const px = g.getImageData(0, 0, NF, NF).data, Lpeau = [], Lchev = [];
  for (let i = 0; i < NF * NF; i++) {
    if (interieur[i] || forme[i * 4 + 1] === 0) continue;
    const r = lin(px[i * 4] / 255), gg = lin(px[i * 4 + 1] / 255), b = lin(px[i * 4 + 2] / 255), L = 0.2126 * r + 0.7152 * gg + 0.0722 * b;
    const y = forme[i * 4 + 1], z = forme[i * 4 + 2], mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), sat = mx > 1e-4 ? (mx - mn) / mx : 0;
    if (y > 1.74 && L < 0.08) Lchev.push(L);                                                  // le crâne, sombre : les cheveux
    else if (y > 1.56 && y < 1.73 && z > 0.07 && sat > 0.3 && r > gg && gg > b) Lpeau.push(L);  // le visage, une teinte chaude : la peau
  }
  const q = (a, f) => { a.sort((u, v) => u - v); return a.length ? a[Math.floor(a.length * f)] : 0.2; };
  const lp = q(Lpeau, 0.6), lc = Math.max(0.004, q(Lchev, 0.5));
  return {
    forme, NF,
    formeTex: texDonnees(forme, NF, true), masqueTex: texDonnees(etaler(interieur, NF), NF, false),
    refs: new THREE.Vector4(lc + 0.22 * (lp - lc), lc + 0.5 * (lp - lc), lp, lc),
  };
}
/**
 * LA TÊTE B SANS SES MÈCHES (l'afro) : une cible de morphing qui ramène chaque mèche pendante — les îlots du volume de cheveux hors du visage,
 * des deux calottes (le volume autour du crâne) et de l'intérieur du visage — à un point au centre de la tête : des triangles sans aire,
 * invisibles, et les ombres suivent. Rend l'indice de la cible (null : rien à rentrer).
 */
export function morphSansMeches(geo) {
  const pos = geo.attributes.position, n = pos.count, { rac, dedans } = ilotsInterieurs(geo), taille = new Map();
  for (let i = 0; i < n; i++) { const r = rac(i); taille.set(r, (taille.get(r) ?? 0) + 1); }
  const rangs = [...taille.entries()].sort((a, b) => b[1] - a[1]), garde = new Set(rangs.slice(0, 3).map(([r]) => r));   // le visage, les deux calottes
  const d = new Float32Array(n * 3); let m = 0;
  for (let i = 0; i < n; i++) {
    const r = rac(i); if (garde.has(r) || dedans.has(r) || taille.get(r) < 6) continue;
    d[i * 3] = -pos.getX(i); d[i * 3 + 1] = 1.70 - pos.getY(i); d[i * 3 + 2] = -0.01 - pos.getZ(i); m++;
  }
  if (!m) return null;
  (geo.morphAttributes.position ??= []).push(new THREE.Float32BufferAttribute(d, 3));
  (geo.morphAttributes.normal ??= []).push(new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
  geo.morphTargetsRelative = true;
  return geo.morphAttributes.position.length - 1;
}
/** Un masque (un octet par texel) en RGBA (le masque dans le rouge). */
function etaler(M, NF) { const d = new Uint8Array(NF * NF * 4); for (let i = 0; i < NF * NF; i++) { d[i * 4] = M[i]; d[i * 4 + 3] = 255; } return d; }
function texDonnees(data, NF, flottant) {
  let t;
  if (flottant) { const h = new Uint16Array(data.length); for (let i = 0; i < data.length; i++) h[i] = THREE.DataUtils.toHalfFloat(data[i]); t = new THREE.DataTexture(h, NF, NF, THREE.RGBAFormat, THREE.HalfFloatType); }
  else t = new THREE.DataTexture(data, NF, NF, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.flipY = false; t.colorSpace = THREE.NoColorSpace; t.magFilter = t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; t.needsUpdate = true;
  return t;
}

// ———————————————————————————— le shader de la tête ————————————————————————————
const CODE_COUPE = { courte: 0, rasee: 1, chauve: 2, afro: 0, dreadlocks: 0 }, CODE_BARBE = { glabre: 0, naissante: 1, moustache: 2, bouc: 3, barbe: 4 };
const sous = (a, b, x) => float(1).sub(smoothstep(a, b, x));
const est = (v, k) => step(abs(v.sub(k)), 0.5);
/**
 * LE GRAPHE DE LA TÊTE, construit une fois pour les 22 : la texture de sa tête (`tete`), sa forme (`formeTete` : position au repos, relief) et
 * son masque (`masqueTete`), ses références (`refsTete` : seuils cheveux/peau, luminances de sa peau et de ses cheveux) ; du joueur : la peau,
 * les cheveux, la barbe (couleurs), la coupe, la barbe, la calvitie (`optsTete`).
 */
export function grapheTete() {
  const base = materialReference('tete', 'texture').rgb, F = materialReference('formeTete', 'texture'), P = F.xyz, ao = F.w;
  const interieur = materialReference('masqueTete', 'texture').r, R = materialReference('refsTete', 'vec4'), O = materialReference('optsTete', 'vec4');
  const cPeau = materialReference('cPeau', 'color'), cChev = materialReference('cCheveux', 'color'), cBarbe = materialReference('cBarbe', 'color');
  const L = luminance(base), dehors = float(1).sub(interieur), un = (x) => float(1).sub(x);
  const chev = un(smoothstep(R.x, R.y, L)).mul(dehors), peau = un(chev).mul(dehors);
  const detailPeau = clamp(L.div(R.z), 0.35, 1.5), lisse = ao.mul(0.25).add(0.75);
  // 1. LA PEAU et LES CHEVEUX (sourcils et barbe peinte compris) : la couleur visée, le détail de la texture
  let col = mix(base, cPeau.mul(detailPeau), peau);
  col = mix(col, cChev.mul(clamp(L.div(R.w), 0.45, 1.7)), chev);
  // les régions du visage, mesurées sur les deux têtes au repos (le nez à 1,65 m, la bouche à 1,614, les yeux à 1,686, le haut du crâne à 1,80)
  const ax = abs(P.x), y = P.y, z = P.z, coupe = O.x, calv = O.y, teteB = O.w;
  const bruit = (k) => fract(sin(dot(P.mul(k), vec3(12.9898, 78.233, 37.719))).mul(43758.5453));
  const loin = smoothstep(0.0004, 0.0016, length(fwidth(P)));                                   // au loin : la densité moyenne, sans scintiller
  // 2. LE CRÂNE : au-dessus du front (1,722 m, au-dessus des sourcils), l'arrière et la nuque, les côtés au-dessus des oreilles
  const crane = max(max(smoothstep(1.718, 1.726, y), sous(0.012, 0.022, z).mul(smoothstep(1.59, 1.60, y))), smoothstep(0.058, 0.066, ax).mul(smoothstep(1.685, 1.695, y)).mul(sous(0.06, 0.075, z)));
  //    la tête B : le haut du crâne que couvraient ses mèches (une calotte de peau entre ses deux volumes) prend les cheveux
  const dessus = teteB.mul(smoothstep(1.748, 1.758, y)).mul(est(coupe, 0)).mul(dehors);
  col = mix(col, cChev.mul(clamp(L.div(R.w), 0.45, 1.7)).mul(0.9), dessus.mul(un(chev)));
  //    LA CALVITIE (visage.ts : de 0, la tête pleine, à 1) : la ligne du front recule — d'abord aux tempes (le « M »), puis au milieu —, la
  //    couronne s'éclaircit au-delà de la moitié ; une lisière irrégulière, quelques cheveux épars
  const lisiere = bruit(900).sub(0.5).mul(0.004);
  const front = float(1.732).add(calv.mul(0.055)).add(calv.mul(0.03).mul(smoothstep(0.012, 0.045, ax))).add(lisiere);
  const recul = sous(front.sub(0.002), front.add(0.002), y).mul(smoothstep(0.01, 0.03, z)).mul(step(0.0001, calv));
  const couronne = sous(calv.sub(0.5).mul(0.13).sub(0.006), calv.sub(0.5).mul(0.13).add(0.006), length(P.sub(vec3(0, 1.795, -0.035)))).mul(step(0.5, calv));
  const dessusChauve = smoothstep(0.86, 0.92, calv).mul(smoothstep(1.735, 1.75, y));
  const chauve = crane.mul(chev).mul(max(max(est(coupe, 2), max(recul, couronne)), dessusChauve)).mul(un(teteB));
  col = mix(col, cPeau.mul(lisse).mul(1.03), chauve);                                           // la peau du crâne, un peu plus brillante
  const ras = crane.mul(chev).mul(est(coupe, 1)).mul(un(chauve));
  col = mix(col, mix(cPeau.mul(lisse), cChev.mul(0.85), mix(bruit(2400).mul(0.5).add(0.3), float(0.55), loin)), ras);
  // 3. LA BARBE (visage.ts, Visage.tsx : la barbe = le bandeau de la mâchoire + la moustache ; le bouc = sous la bouche ; la naissante = le
  //    bandeau, à 42 %) — des formes douces sur la tête au repos : les lèvres (une ellipse autour de la bouche), la moustache (sous le nez, ses
  //    coins qui tombent), le bouc (une ellipse sur le menton), le bandeau (sous la ligne des joues, qui monte vers les pattes, jusque sous le
  //    menton, pas derrière la mâchoire)
  const devant = smoothstep(0.075, 0.095, z);
  const eL = ax.div(0.027).pow(2).add(y.sub(1.6135).div(0.0105).pow(2)), levres = sous(0.75, 1.0, eL).mul(devant);
  const moustache = sous(0.026, 0.032, ax).mul(smoothstep(0.0, 0.0025, y.sub(float(1.6225).sub(ax.sub(0.014).max(0).mul(0.35))))).mul(sous(1.636, 1.64, y)).mul(devant);
  const eB = ax.div(0.023).pow(2).add(y.sub(1.578).div(0.027).pow(2)), bouc = sous(0.7, 1.0, eB).mul(smoothstep(0.05, 0.07, z));
  const lisiereB = bruit(700).sub(0.5).mul(0.005);
  const joue = sous(-0.002, 0.005, y.sub(ax.mul(0.75).sub(ax.mul(ax).mul(4.2)).add(1.627)).add(lisiereB));   // la ligne des joues : courbe, montant vers les pattes
  const bandeau = joue.mul(smoothstep(1.53, 1.54, y.add(ax.mul(-0.3)))).mul(smoothstep(-0.018, -0.008, z)).mul(sous(0.078, 0.086, ax));
  const b = O.z, ouv = un(levres).mul(dehors);
  const region = max(max(moustache.mul(max(est(b, 2), est(b, 4))), bouc.mul(est(b, 3))), bandeau.mul(max(est(b, 4), est(b, 1)))).mul(ouv);
  //    la barbe peinte d'origine (la tête B) hors de la région voulue redevient peau
  const sombre = un(smoothstep(0.55, 0.92, L.div(R.z)));
  col = mix(col, cPeau.mul(lisse), max(bandeau, max(bouc, moustache)).mul(sombre).mul(un(region)).mul(ouv));
  //    (la barbe pleine et le bouc couvrent, leurs poils serrés ; la naissante laisse voir la peau)
  const naiss = est(b, 1), dense = mix(float(0.95), float(0.38), naiss), poils = mix(mix(bruit(3000).mul(0.35).add(0.65), bruit(3000).mul(0.7).add(0.3), naiss), float(0.8), loin);
  col = mix(col, cBarbe.mul(lisse), region.mul(dense).mul(poils));
  return col;
}
/** LE GRAPHE DES CARTES DE CHEVEUX (les dreadlocks de la tête B, transparentes) : la couleur des cheveux, le détail de la texture, son alpha. */
export function grapheCartes() {
  const t = materialReference('cartes', 'texture'), R = materialReference('refsCartes', 'vec4'), cChev = materialReference('cCheveux', 'color');
  return vec4(cChev.mul(clamp(luminance(t.rgb).div(R.w), 0.45, 1.7)), t.a);
}

/** LE MATÉRIAU DE TÊTE (et de cartes) : la couleur posée le temps du rendu principal (la passe d'ombre garde son matériau commun : ni `map`, ni
 *  `colorNode` visibles) ; les réglages en objets (une couleur, un vec4 : rien ne se range dans la clé de programme). */
class MateriauTete extends THREE.MeshStandardNodeMaterial {
  static get type() { return 'MateriauTete'; }
  constructor(graphe) {
    super(); this.grapheTete = graphe; this.tete = null; this.cartes = null; this.formeTete = null; this.masqueTete = null;
    this.refsTete = new THREE.Vector4(); this.refsCartes = new THREE.Vector4(); this.optsTete = new THREE.Vector4();
    this.cPeau = new THREE.Color(); this.cCheveux = new THREE.Color(); this.cBarbe = new THREE.Color();
  }
  setupDiffuseColor(builder) { this.colorNode = this.grapheTete; try { super.setupDiffuseColor(builder); } finally { this.colorNode = null; } }
  customProgramCacheKey() { return `${super.customProgramCacheKey()}:tete:${this.grapheTete.getCacheKey()}`; }
}
/** Un matériau de tête (ou de cartes) pour un joueur, sur celui d'origine (relief, rugosité, transparence). */
export function materiauTete(origine, graphe, { cartes = false } = {}) {
  const m = new MateriauTete(graphe);
  m.name = cartes ? 'cartes-apparence' : 'tete-apparence'; m.side = origine.side; m.normalMap = origine.normalMap; if (origine.normalScale) m.normalScale.copy(origine.normalScale);
  m.roughnessMap = origine.roughnessMap; m.metalnessMap = origine.metalnessMap; m.roughness = origine.roughness; m.metalness = origine.metalness;
  if (cartes) { m.transparent = true; m.depthWrite = origine.depthWrite; m.alphaTest = origine.alphaTest; m.cartes = origine.map; }
  else m.tete = origine.map;
  return m;
}
/** Poser l'apparence d'un joueur sur ses matériaux de tête (et de cartes). */
export function poserApparence(m, A, { tete, cartes = null }) {
  m.cPeau.setHex(A.peau, THREE.SRGBColorSpace); m.cCheveux.setHex(A.cheveux, THREE.SRGBColorSpace); m.cBarbe.setHex(A.barbe ?? A.cheveux, THREE.SRGBColorSpace);
  if (tete) { m.formeTete = tete.formeTex; m.masqueTete = tete.masqueTex; m.refsTete.copy(tete.refs); }
  if (cartes) m.refsCartes.copy(cartes);
  m.optsTete.set(CODE_COUPE[A.coupe] ?? 0, A.calvitie ?? 0, CODE_BARBE[A.pilosite] ?? 0, tete?.estB ? 1 : 0);   // (w : la tête B)
}
/** La luminance linéaire moyenne des cartes de cheveux (texels opaques). */
export function refsCartesDe(image) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(image, 0, 0, 256, 256);
  const d = g.getImageData(0, 0, 256, 256).data; let s = 0, n = 0;
  for (let i = 0; i < 256 * 256; i++) if (d[i * 4 + 3] > 128) { s += 0.2126 * lin(d[i * 4] / 255) + 0.7152 * lin(d[i * 4 + 1] / 255) + 0.0722 * lin(d[i * 4 + 2] / 255); n++; }
  return new THREE.Vector4(0, 0, 0, n ? s / n : 0.02);
}
