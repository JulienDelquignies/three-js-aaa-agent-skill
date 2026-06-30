import * as THREE from 'three/webgpu';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/**
 * Image-based lighting + a key sun. IBL does most of the realism work.
 *
 * This starter generates an environment from RoomEnvironment so it runs with ZERO external
 * assets. For a production AAA look, replace `scene.environment` with a real HDRI:
 *
 *   import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
 *   const hdr = await new RGBELoader().loadAsync('/env/studio_2k.hdr');
 *   const pmrem = new THREE.PMREMGenerator(renderer);
 *   scene.environment = pmrem.fromEquirectangular(hdr).texture;
 *   scene.background = hdr; hdr.mapping = THREE.EquirectangularReflectionMapping;
 *
 * Source CC0 HDRIs from Poly Haven.
 */
export function setupLighting(scene, renderer) {
  // --- IBL from a procedural room environment (no asset needed) ---
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;            // lights all PBR materials at once
  scene.environmentIntensity = 1.0;

  // Subtle gradient background (swap for an HDRI or Sky for outdoor scenes).
  scene.background = new THREE.Color(0x12151c);

  // --- Key sun: the one shadow-casting light. Keep ≤3 dynamic lights total. ---
  const sun = new THREE.DirectionalLight(0xfff4e6, 3.0);
  sun.position.set(40, 60, 25);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  // Tighten the shadow frustum to the visible area for sharper shadows.
  const cam = sun.shadow.camera;
  cam.near = 1; cam.far = 200;
  cam.left = -40; cam.right = 40; cam.top = 40; cam.bottom = -40;
  cam.updateProjectionMatrix();
  scene.add(sun);
  scene.add(sun.target);

  return { sun, envTex, dispose: () => { envTex.dispose(); pmrem.dispose(); } };
}
