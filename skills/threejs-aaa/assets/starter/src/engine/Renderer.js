import * as THREE from 'three/webgpu';

/**
 * Create a configured WebGPURenderer (auto WebGL2 fallback) with AAA defaults:
 * correct color management, AgX tone mapping, soft shadows, capped pixel ratio.
 *
 * IMPORTANT: the caller MUST `await renderer.init()` before the first render — done in
 * Engine.boot(). Without it WebGPU produces silent black frames.
 */
export function createRenderer(canvasParent, { forceWebGL = false } = {}) {
  // Global color management — keep ON. Wrong color space = washed-out / muddy scenes.
  THREE.ColorManagement.enabled = true;

  // WebGPURenderer auto-falls-back to WebGL2 when WebGPU is unavailable. `forceWebGL`
  // also covers environments where WebGPU is present but broken (old Dawn builds, some
  // headless browsers). Append ?webgl to the URL to force it without a code change.
  const renderer = new THREE.WebGPURenderer({ antialias: true, forceWebGL });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // 3× DPR quadruples fragment cost
  renderer.setSize(window.innerWidth, window.innerHeight);

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping;   // realism; try ACESFilmicToneMapping for cinematic
  renderer.toneMappingExposure = 0.9;            // slightly under 1 to protect highlights from blowing out

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  canvasParent.appendChild(renderer.domElement);
  return renderer;
}
