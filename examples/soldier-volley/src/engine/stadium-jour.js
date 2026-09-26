import * as THREE from 'three/webgpu';
import { fitShadowToPitch } from './stadium-night.js';

// stadium-jour — LE MATCH DE JOUR ET DE FIN D'APRÈS-MIDI (26/09 : « l'éclairage » — tout match se jouait de nuit). Même contrat que
// setupStadiumNight (group, sun, spots, light, baked, dispose) pour que la scène les échange sans rien savoir d'autre :
//   jour — un soleil haut (~55°), blanc chaud, le ciel bleu dégradé vers une horizon pâle ; l'ombre est courte et nette ;
//   soir — le soleil bas (~16°) orangé qui rase la pelouse : les ombres longues des joueurs, le ciel qui vire du bleu nuit à l'orange.
// Pas de masquage par calque (keyLayer 0) : le soleil éclaire tout le monde, le stade compris — c'est le jour. L'ombre reste AJUSTÉE à
// la pelouse (fitShadowToPitch : le texel au centimètre, pas un frustum de 300 m). Les lumières déjà présentes sont éteintes et rendues.

const HEURES = {
  jour: { ciel: [[0, 0x3a6fc0], [0.55, 0x78a9e0], [0.9, 0xcfe2f2], [1, 0x9a9486]], soleil: 0xfff3e0, iSoleil: 2.1, elev: 0.96, azim: 0.62, hemi: [0xc4dbff, 0x4f6040, 0.45], env: 0.45, brume: [0xb8cde0, 0.0006] },
  soir: { ciel: [[0, 0x1b2a55], [0.5, 0x5d5a8a], [0.82, 0xe99a5c], [0.92, 0xf6c27a], [1, 0x5a4232]], soleil: 0xffb676, iSoleil: 3.1, elev: 0.36, azim: 0.35, hemi: [0x9aa0d0, 0x4a3a28, 0.55], env: 0.42, brume: [0xc99a78, 0.0012] },
};

function ciel(stops) {
  const H = 256, W = 8, data = new Uint8Array(W * H * 4), c0 = new THREE.Color(), c1 = new THREE.Color();
  for (let y = 0; y < H; y++) {
    const t = 1 - y / (H - 1);   // ligne 0 d'une DataTexture = le BAS de l'équirectangulaire (écrit à l'envers, cf. stadium-night)
    let i = 0; while (i < stops.length - 2 && t > stops[i + 1][0]) i++;
    const [ta, a] = stops[i], [tb, b] = stops[i + 1], k = tb === ta ? 0 : Math.min(1, Math.max(0, (t - ta) / (tb - ta)));
    c0.setHex(a); c1.setHex(b); c0.lerp(c1, k);
    for (let x = 0; x < W; x++) { const o = (y * W + x) * 4; data[o] = c0.r * 255; data[o + 1] = c0.g * 255; data[o + 2] = c0.b * 255; data[o + 3] = 255; }
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  tex.mapping = THREE.EquirectangularReflectionMapping; tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = tex.magFilter = THREE.LinearFilter; tex.needsUpdate = true;
  return tex;
}

/** @param {{ at?: number[], model: object, heure?: 'jour'|'soir', shadowMapSize?: number }} o */
export function setupStadiumJour(scene, renderer, { at = [0, 0, 0], model, heure = 'jour', shadowMapSize = 2048 } = {}) {
  const H = HEURES[heure] ?? HEURES.jour, L = model?.pitch?.L ?? 105, W = model?.pitch?.W ?? 68;
  const group = new THREE.Group(); group.name = 'stadium-jour'; group.position.set(at[0], at[1], at[2]); scene.add(group);
  const disposables = [], prev = { bg: scene.background, blur: scene.backgroundBlurriness, env: scene.environment, envI: scene.environmentIntensity, fog: scene.fog };
  const doused = []; scene.traverse((o) => { if (o.isLight && o.visible) { let dans = false; for (let p = o; p; p = p.parent) if (p === group) dans = true; if (!dans) { doused.push(o); o.visible = false; } } });
  const sky = ciel(H.ciel); disposables.push(sky);
  const pmrem = renderer ? new THREE.PMREMGenerator(renderer) : null, envTex = pmrem ? pmrem.fromEquirectangular(sky).texture : null;
  if (envTex) disposables.push(envTex);
  scene.background = sky; scene.backgroundBlurriness = 0; scene.environment = envTex; scene.environmentIntensity = H.env;
  scene.fog = new THREE.FogExp2(H.brume[0], H.brume[1]);
  if (renderer) renderer.shadowMap.enabled = true;
  const hemi = new THREE.HemisphereLight(H.hemi[0], H.hemi[1], H.hemi[2]); hemi.position.set(0, 40, 0); group.add(hemi);
  // le soleil : de biais sur la longueur (une ombre parallèle à la touche se lit comme un plateau tournant), élévation de l'heure
  const D = 90, r = D * Math.cos(H.elev), sun = new THREE.DirectionalLight(H.soleil, H.iSoleil);
  sun.position.set(Math.cos(H.azim) * r, D * Math.sin(H.elev), -Math.sin(H.azim) * r);
  sun.castShadow = true; sun.shadow.mapSize.set(shadowMapSize, shadowMapSize);
  group.add(sun); group.add(sun.target); fitShadowToPitch(sun, L, W);
  return {
    group, sun, spots: [], scene, doused, baked: false, heure, keyLayer: 0, light: () => {},
    dispose() {
      scene.remove(group); for (const l of doused) l.visible = true;
      scene.background = prev.bg; scene.backgroundBlurriness = prev.blur; scene.environment = prev.env; scene.environmentIntensity = prev.envI; scene.fog = prev.fog;
      sun.shadow.dispose?.(); pmrem?.dispose(); for (const d of disposables) d.dispose?.();
    },
  };
}
