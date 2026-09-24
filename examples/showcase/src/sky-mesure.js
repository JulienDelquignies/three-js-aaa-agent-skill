// L'INSTRUMENT DU CIEL DU DUEL (page de dev, hors build — `npx vite` puis /sky-mesure.html dans un navigateur WebGPU ;
// le résultat est dans window.__m). C'est lui qui a produit les constantes de duel-ciel.js :
//   • les relectures GPU du ciel de tidewater (irradiance E/π, transmittance du soleil, horizon) à l'heure ?h= ;
//   • la transmittance CPU (sunTransmittanceCPU) contre la table GPU — l'instrument du soleil, validé à 0,5 % ;
//   • le recalage du repli WebGL2 : la radiance de SkyMesh (Preetham) contre celle de tidewater sur 9 directions, pour
//     chaque réglage de ?sets=[{tu,ray,mie,g}] — gain par canal (kc), dispersion log (spreadLog), trié du meilleur au pire.
// En linéaire : NoToneMapping, cible float, pixel central d'une caméra à 1°.
import * as THREE from 'three/webgpu';
import { Fn, vec4, normalize, normalWorldGeometry } from 'three/tsl';
import { Atmosphere, DuelSky, sunDirectionFromTime, sunTransmittanceCPU, SUN_ILLUMINANCE } from './scenes/duel-ciel.js';
import { SkyMesh } from 'three/addons/objects/SkyMesh.js';
const q = new URLSearchParams(location.search), hours = Number(q.get('h') || 17.2);
const renderer = new THREE.WebGPURenderer({ antialias: false });
renderer.setSize(64, 64); renderer.toneMapping = THREE.NoToneMapping; renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
document.body.appendChild(renderer.domElement);
await renderer.init();
const sunDir = sunDirectionFromTime(hours);
const atmo = new Atmosphere(renderer); atmo.sunDir.value.copy(sunDir);
const got = new Promise((res) => { atmo.onIrradiance = res; });
atmo.update(1 / 60, 2);
await got;
// radiance le long d'une direction : caméra fov 1°, cible float 4×4, pixel central
const rt = new THREE.RenderTarget(4, 4, { type: THREE.FloatType });
const cam = new THREE.PerspectiveCamera(1, 1, 0.1, 10000);
const sky = new DuelSky(atmo);
const sA = new THREE.Scene(); sA.backgroundNode = Fn(() => vec4(sky.radiance(normalize(normalWorldGeometry), false), 1))();
const sB = new THREE.Scene(); const sm = new SkyMesh(); sm.scale.setScalar(1000); sm.sunPosition.value.copy(sunDir);
sm.turbidity.value = 4; sm.rayleigh.value = 1.6; sm.mieCoefficient.value = 0.004; sm.mieDirectionalG.value = 0.82; sm.cloudCoverage.value = 0; sm.showSunDisc.value = 0; sB.add(sm);
const az0 = Math.atan2(sunDir.z, sunDir.x);
const dirs = { zenith: [0, 89], 'horizon anti-soleil': [180, 3], 'horizon 90°': [90, 3], 'horizon soleil': [0, 3], 'côté 90° 20°': [90, 20], 'soleil +10°': [0, 25.5], 'soleil +25°': [0, 40], 'anti-soleil 30°': [180, 30], 'côté 45°': [45, 50] };
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const read = async (s, d) => { cam.position.set(0, 0, 0); cam.up.set(0, 1, 0); if (d.y > 0.99) cam.up.set(1, 0, 0); cam.lookAt(d); renderer.setRenderTarget(rt); renderer.render(s, cam); renderer.setRenderTarget(null); const px = await renderer.readRenderTargetPixelsAsync(rt, 1, 1, 1, 1); return [px[0], px[1], px[2]]; };
const D = Object.entries(dirs).map(([n, [daz, el]]) => { const a = az0 + daz * Math.PI / 180, e = el * Math.PI / 180; return [n, new THREE.Vector3(Math.cos(e) * Math.cos(a), Math.sin(e), Math.cos(e) * Math.sin(a))]; });
const TW = {}; for (const [n, d] of D) TW[n] = await read(sA, d);
const sets = JSON.parse(q.get('sets') || '[{"tu":2,"ray":1.3,"mie":0.001,"g":0.7},{"tu":4,"ray":1.6,"mie":0.004,"g":0.82}]');   // le repli retenu, et celui d'avant
const out = [];
for (const S of sets) {
  sm.turbidity.value = S.tu; sm.rayleigh.value = S.ray; sm.mieCoefficient.value = S.mie; sm.mieDirectionalG.value = S.g;
  const lr = [], bl = [], lc = [[], [], []]; const per = {};
  for (const [n, d] of D) { const v = await read(sB, d), t = TW[n]; const r = lum(t) / lum(v); lr.push(Math.log(r)); bl.push(Math.log((t[2] / t[0]) / (v[2] / v[0]))); per[n] = +r.toFixed(3); for (let c = 0; c < 3; c++) lc[c].push(Math.log(t[c] / v[c])); }
  const m = lr.reduce((a, b) => a + b) / lr.length, sd = Math.sqrt(lr.reduce((a, b) => a + (b - m) ** 2, 0) / lr.length), mb = bl.reduce((a, b) => a + b) / bl.length;
  const kc = lc.map((a) => +Math.exp(a.reduce((x, y) => x + y) / a.length).toFixed(3));
  out.push({ S, kc, k: +Math.exp(m).toFixed(3), spreadLog: +sd.toFixed(3), hueLog: +mb.toFixed(3), per });
}
out.sort((a, b) => a.spreadLog - b.spreadLog);
const r3 = (a) => a.map((v) => +v.toFixed(4));
window.__m = { hours, sunDir: r3(sunDir.toArray()), elevDeg: +(Math.asin(sunDir.y) * 180 / Math.PI).toFixed(2), gpu: { skyIrr: r3(atmo.skyIrradiance), sunT: r3(atmo.sunTransmittance), horizon: r3(atmo.horizon) }, cpuT: r3(sunTransmittanceCPU(sunDir)), sunE: r3(atmo.sunTransmittance.map((t) => t * SUN_ILLUMINANCE)), tw: Object.fromEntries(Object.entries(TW).map(([n, c]) => [n, r3(c)])), fits: out };
