import * as THREE from 'three/webgpu';
import { adaptBip01, prepareRocketboxMaterials } from '../engine/rig-bip01.js';

// LE CASTING DU DUEL — deux footballeurs Rocketbox (MIT : public/rocketbox, SOURCE.md) : le n° 18 dans la tenue d'origine
// (rayée noir et blanc), le n° 10 dans la même tenue passée en BLEU CIEL (tools/rocketbox-textures.py --ciel) — un par camp
// (squad.spawn(team)). Leur tenue est leur texture : pas de maillot peint par-dessus (ownKit). Taille NATIVE (le fichier est
// en mètres réels). Le rig Biped se présente comme la référence (engine/rig-bip01.js) : tous les gestes générés du moteur
// tombent juste sur lui. ?rig=ville rend joe et marta (vêtements de ville), ?rig=shanon la distribution d'avant.
const rocketbox = (file, name = file) => ({
  url: `rocketbox/${file}.glb`, faces: '+Z', name, height: 'natif', ownKit: true,
  prepare: (root) => ({ ...adaptBip01(root, { faces: '+Z' }), materiaux: prepareRocketboxMaterials(root) }),
});

export const DUEL_CAST = [rocketbox('foot-18', 'n18'), rocketbox('foot-10-ciel', 'n10')];
export const DUEL_CAST_VILLE = [rocketbox('joe'), rocketbox('marta')];

/** LES GARDIENS (2026-09-26, « mets des gardiens ») : le corps du n° 18 (squad.spawn(0), tenue rayée noir et blanc) dont les BLANCS passent à
 *  la couleur du gardien — la même transformation que tools/rocketbox-textures.py --ciel (clair ET peu saturé → la teinte, ombrage conservé ;
 *  la peau, saturée, et les noirs ne bougent pas), faite au chargement sur une COPIE du matériau « body » (les joueurs de champ gardent le leur).
 *  Jaune pour le camp 0, vert pour le camp 1 : le métier se lit avant le maillot. */
export const TENUE_GARDIEN = [[0.96, 0.80, 0.16], [0.30, 0.78, 0.38]];
const TENUES = new Map();
export function tenueGardien(root, rgb) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const out = mats.map((m) => {
      if (m.name !== 'body' || !m.map?.image) return m;
      const k = rgb.join(','); if (!TENUES.has(k)) TENUES.set(k, recolore(m.map, rgb));
      const c = m.clone(); c.map = TENUES.get(k); return c;
    });
    o.material = Array.isArray(o.material) ? out : out[0];
  });
}
function recolore(tex, rgb) {
  const img = tex.image, w = img.width, h = img.height, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d'); g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, w, h), a = d.data;
  const sm = (x, e0, e1) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
  for (let i = 0; i < a.length; i += 4) {
    const r = a[i] / 255, gv = a[i + 1] / 255, b = a[i + 2] / 255, mx = Math.max(r, gv, b), mn = Math.min(r, gv, b), s = mx > 1e-4 ? (mx - mn) / mx : 0;
    const wb = sm(mx, 0.38, 0.72) * (1 - sm(s, 0.10, 0.22)); if (wb <= 0) continue;
    const v = Math.min(1.15, mx / 0.86);
    a[i] = 255 * (r * (1 - wb) + Math.min(1, rgb[0] * v) * wb); a[i + 1] = 255 * (gv * (1 - wb) + Math.min(1, rgb[1] * v) * wb); a[i + 2] = 255 * (b * (1 - wb) + Math.min(1, rgb[2] * v) * wb);
  }
  g.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.flipY = tex.flipY; t.colorSpace = tex.colorSpace; t.wrapS = tex.wrapS; t.wrapT = tex.wrapT; t.channel = tex.channel; t.anisotropy = tex.anisotropy; t.needsUpdate = true;
  return t;
}
