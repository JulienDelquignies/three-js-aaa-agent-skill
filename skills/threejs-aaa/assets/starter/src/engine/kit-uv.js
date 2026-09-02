// kit-uv.js — L'EMPLACEMENT DE TEXTURE DU MAILLOT (lot 214, 6e demande formelle du projet aval :
// « un emplacement où brancher le nôtre, et la carte qui le rend stable »).
//
// LA CARTE EST UNE PROPRIÉTÉ DE L'ASSET : shanon.glb porte UN atlas 512×512 (image 2, webp,
// matériau Ch38_body) partagé par le maillot, le short, les chaussettes, le corps et les
// chaussures ; les îlots UV des pièces d'habillement sont des zones plates disjointes du visage
// et des mains. Relevé rastérisé (256², origine glTF en HAUT à gauche, flipY = false) — le
// projet aval l'a mesuré, le moteur l'a re-mesuré au pixel près (couverture des boîtes : maillot
// 97,9 %, short 99,9 %, chaussettes 96,6 %) : si l'asset change, la carte change dans le même
// lot et sa clause parle (verify-kit).
//
// Devant et manche A se touchent dans l'atlas (aucune colonne vide entre u 0,26 et 0,34) : la
// coupe à u = 0,30 est une convention de peinture, pas une frontière de géométrie.
export const SHANON_UV = {
  shirt: {
    front:   [0.004, 0.148, 0.301, 0.527],   // l'écusson peint de Mixamo vit ici
    back:    [0.398, 0.613, 0.695, 1.000],   // le « 7 » peint de Mixamo vit ici
    sleeveA: [0.301, 0.301, 0.500, 0.660],
    sleeveB: [0.793, 0.531, 0.992, 0.816],
  },
  shorts: { body: [0.004, 0.531, 0.418, 0.980] },
  socks:  { a: [0.652, 0.871, 0.848, 1.000], b: [0.668, 0.750, 0.855, 0.871], tops: [0.004, 0.004, 0.191, 0.164] },
  atlas:  { size: 512, origin: 'top-left', image: 2, material: 'Ch38_body', meshes: { shirt: 'Ch38_Shirt', shorts: 'Ch38_Shorts', socks: 'Ch38_Socks' } },
};

/** La couverture d'une géométrie par des boîtes UV — le juge de la carte (rastérisation 256²
 *  des triangles ; retourne la fraction des texels du mesh qui tombent dans une boîte). */
export function uvCoverage(uv, index, boxes, N = 256) {
  const grid = new Uint8Array(N * N);
  const tri = index ? index.length : uv.length / 2;
  for (let t = 0; t < tri; t += 3) {
    const P = [0, 1, 2].map((k) => { const i = index ? index[t + k] : t + k; return [uv[i * 2] * N, uv[i * 2 + 1] * N]; });
    const minx = Math.max(0, Math.floor(Math.min(P[0][0], P[1][0], P[2][0]))), maxx = Math.min(N - 1, Math.ceil(Math.max(P[0][0], P[1][0], P[2][0])));
    const miny = Math.max(0, Math.floor(Math.min(P[0][1], P[1][1], P[2][1]))), maxy = Math.min(N - 1, Math.ceil(Math.max(P[0][1], P[1][1], P[2][1])));
    for (let y = miny; y <= maxy; y++) for (let x = minx; x <= maxx; x++) {
      const px = x + 0.5, py = y + 0.5;
      const s = (a, b) => (b[0] - a[0]) * (py - a[1]) - (b[1] - a[1]) * (px - a[0]);
      const d1 = s(P[0], P[1]), d2 = s(P[1], P[2]), d3 = s(P[2], P[0]);
      if ((d1 >= 0 && d2 >= 0 && d3 >= 0) || (d1 <= 0 && d2 <= 0 && d3 <= 0)) grid[y * N + x] = 1;
    }
  }
  let tot = 0, cov = 0;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (grid[y * N + x]) { tot++; const u = (x + 0.5) / N, v = (y + 0.5) / N; if (boxes.some((b) => u >= b[0] && u <= b[2] && v >= b[1] && v <= b[3])) cov++; }
  return { total: tot, covered: cov, fraction: tot ? cov / tot : 0 };
}

const hex = (c) => '#' + (c >>> 0).toString(16).padStart(6, '0');
const px = (b, size) => [b[0] * size, b[1] * size, (b[2] - b[0]) * size, (b[3] - b[1]) * size];

/**
 * LE PEINTRE MINIMAL. Rend un canvas 512×512 : copie l'atlas d'origine (les zones hors îlots —
 * visage, mains, chaussures — restent intactes), remplit devant/dos/manches en `primary`, les
 * ourlets en `secondary`, le short et les chaussettes en leurs couleurs, écrit `number` dans la
 * boîte `back` et `initials` dans la boîte `front` en `accent`. Le « 7 » et l'écusson peints de
 * Mixamo disparaissent sous la peinture. Le canvas est à l'appelant : une texture par tenue.
 * @param theme { primary, secondary, accent, shorts?, socks?, initials? } (le contrat des clubs)
 */
export function drawKit(theme, { number = null, name = null, initials = null, uv = SHANON_UV, atlas = null, size = 512 } = {}) {
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : new OffscreenCanvas(size, size);
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (atlas) ctx.drawImage(atlas, 0, 0, size, size);
  else { ctx.fillStyle = '#c1bdbd'; ctx.fillRect(0, 0, size, size); }   // l'albédo neutre de l'atlas (sRGB 193,189,189)
  const fill = (b, color) => { const [x, y, w, h] = px(b, size); ctx.fillStyle = hex(color); ctx.fillRect(x, y, w, h); };
  const hem = (b, color, frac = 0.07) => { const [x, y, w, h] = px(b, size); ctx.fillStyle = hex(color); ctx.fillRect(x, y + h * (1 - frac), w, h * frac); };
  const primary = theme.primary ?? 0xffffff, secondary = theme.secondary ?? 0xffffff, accent = theme.accent ?? 0x111111;
  for (const b of Object.values(uv.shirt)) { fill(b, primary); hem(b, secondary); }
  fill(uv.shorts.body, theme.shorts ?? secondary); hem(uv.shorts.body, primary, 0.05);
  for (const b of Object.values(uv.socks)) fill(b, theme.socks ?? primary);
  ctx.fillStyle = hex(accent); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  // LE DOS AU RÉEL (214b, retour utilisateur « le numéro est un peu gros — et le nom au-dessus ? ») : le
  // numéro fait ~35-40 % de la hauteur du dos (0,52 était trop), le NOM en capitales espacées
  // au-dessus, ARQUÉ (chaque lettre tournée sur un arc — le flocage du vrai maillot).
  if (number != null) { const [x, y, w, h] = px(uv.shirt.back, size); ctx.font = `bold ${Math.round(h * 0.38)}px system-ui, sans-serif`; ctx.fillText(String(number), x + w / 2, y + h * 0.58); }
  if (name) {
    const [x, y, w, h] = px(uv.shirt.back, size);
    const txt = String(name).toUpperCase().slice(0, 14);
    let fs = Math.round(h * 0.11);
    ctx.font = `bold ${fs}px system-ui, sans-serif`;
    let widths = [...txt].map((ch) => ctx.measureText(ch).width + fs * 0.1), total = widths.reduce((a, b) => a + b, 0);
    if (total > w * 0.7) {   // le nom tient dans 70 % de la boîte : le panneau du dos s'ENROULE sur le côté avant le bord UV (mesuré au pixel : 85 % frôlait la couture)
      fs = Math.max(8, Math.floor(fs * (w * 0.7) / total)); ctx.font = `bold ${fs}px system-ui, sans-serif`;
      widths = [...txt].map((ch) => ctx.measureText(ch).width + fs * 0.1); total = widths.reduce((a, b) => a + b, 0);
    }
    const r = w * 0.62, cx = x + w / 2, cy = y + h * 0.30 + r;   // le centre de l'arc sous le nom
    let a = -total / 2 / r;
    for (let i = 0; i < txt.length; i++) {
      const half = widths[i] / 2 / r; a += half;
      ctx.save(); ctx.translate(cx + Math.sin(a) * r, cy - Math.cos(a) * r); ctx.rotate(a); ctx.fillText(txt[i], 0, 0); ctx.restore();
      a += half;
    }
  }
  if (initials) { const [x, y, w, h] = px(uv.shirt.front, size); ctx.font = `bold ${Math.round(h * 0.16)}px system-ui, sans-serif`; ctx.fillText(String(initials).slice(0, 3), x + w * 0.5, y + h * 0.30); }
  return canvas;
}

import * as THREE from 'three/webgpu';
import { tintPart } from './part-tint.js';

/** Le canvas devient une texture au contrat glTF de l'asset : flipY false, sRGB. */
export function kitTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.flipY = false; tex.colorSpace = THREE.SRGBColorSpace; tex.needsUpdate = true;
  return tex;
}

const kitCache = new Map();   // une texture par (tenue, numéro) — 2 à 4 tenues par match, un calque numéro par joueur

/**
 * LE MATCH S'HABILLE : peint la tenue (drawKit), la monte en texture, l'applique aux trois pièces
 * d'habillement via tintPart({ map }) — color 0xffffff, la texture porte la couleur. L'atlas
 * d'origine est lu sur le matériau du maillot du modèle (image 2). Retourne le contrat checkTint.
 */
export function applyKit(model, { theme, number = null, name = null, initials = null, uv = SHANON_UV, match = /Shirt|Shorts|Socks/i } = {}) {
  const shirt = model.getObjectByName?.(uv.atlas.meshes.shirt) ?? null;
  const atlas = shirt?.material?.map?.image ?? null;
  const key = `${theme.primary}|${theme.secondary}|${theme.accent}|${theme.shorts ?? ''}|${theme.socks ?? ''}|${number ?? ''}|${name ?? ''}|${initials ?? ''}`;
  let map = kitCache.get(key);
  if (!map) { map = kitTexture(drawKit(theme, { number, name, initials, uv, atlas })); kitCache.set(key, map); }
  return tintPart(model, { match, color: 0xffffff, map });
}
