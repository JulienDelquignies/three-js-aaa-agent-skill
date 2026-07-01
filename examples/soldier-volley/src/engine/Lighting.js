import * as THREE from 'three/webgpu';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

/**
 * Image-based lighting + a key sun + atmospheric depth. IBL does most of the realism work.
 *
 * Asset path: if a CC0 HDRI is present at public/env/environment.hdr (fetch it for free with
 *   node scripts/fetch-cc0.mjs --hdri <id> --res 2k --out public/env/environment.hdr
 * ) it is used for both lighting and background — the single biggest visual upgrade. Otherwise the
 * scene falls back to a procedural RoomEnvironment + a gradient sky, so the starter still runs with
 * ZERO external assets.
 */
export async function setupLighting(scene, renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  let envTex;
  let disposeExtra = () => {};

  try {
    // Real captured HDRI (true-HDR) → best IBL, real reflections, real horizon.
    const hdr = await new RGBELoader().loadAsync('env/environment.hdr');
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    envTex = pmrem.fromEquirectangular(hdr).texture;
    scene.background = hdr;
    scene.backgroundBlurriness = 0.3;
    disposeExtra = () => hdr.dispose();
  } catch {
    // Zero-asset fallback: procedural room IBL + a vertical gradient sky.
    envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.background = gradientSky();
  }

  scene.environment = envTex;
  scene.environmentIntensity = 1.0;
  scene.fog = new THREE.FogExp2(0x9aa7b4, 0.014); // subtle aerial perspective for depth

  // Key sun: the one shadow-casting light. Keep ≤3 dynamic lights total.
  const sun = new THREE.DirectionalLight(0xfff2e0, 2.4);
  sun.position.set(40, 60, 25);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  const cam = sun.shadow.camera;
  cam.near = 1; cam.far = 200;
  cam.left = -40; cam.right = 40; cam.top = 40; cam.bottom = -40;
  cam.updateProjectionMatrix();
  scene.add(sun);
  scene.add(sun.target);

  return { sun, envTex, dispose: () => { envTex.dispose(); pmrem.dispose(); disposeExtra(); } };
}

/** Asset-free vertical gradient sky as an equirect background texture. */
function gradientSky() {
  const c = document.createElement('canvas');
  c.width = 16; c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0.0, '#243a5e');   // zenith
  g.addColorStop(0.55, '#5c6b7a');  // mid
  g.addColorStop(1.0, '#b9bfc2');   // horizon
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 16, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
