import * as THREE from 'three/webgpu';
import { pass } from 'three/tsl';

/**
 * TSL node-based post-processing for WebGPURenderer.
 *
 * The bloom node lives in an addon whose import path has shifted across Three.js releases.
 * To keep the starter robust, we import it dynamically and DEGRADE GRACEFULLY: if the path
 * doesn't resolve, post-processing is disabled and the Engine renders the scene directly
 * (no black screen). If bloom is missing after an upgrade, check the real path with:
 *   ls node_modules/three/examples/jsm/tsl/display/
 */
export async function createPostFX(renderer, scene, camera) {
  let bloom;
  try {
    ({ bloom } = await import('three/addons/tsl/display/BloomNode.js'));
  } catch (err) {
    console.warn('[PostFX] bloom node not found — rendering without post-processing.', err);
    return null;
  }

  // r185 renamed PostProcessing → RenderPipeline; support both for forward/backward compat.
  const Pipeline = THREE.RenderPipeline ?? THREE.PostProcessing;
  const postProcessing = new Pipeline(renderer);
  const scenePass = pass(scene, camera);
  const color = scenePass.getTextureNode();

  // Bloom from HDR/emissive areas. strength, radius, threshold. Higher threshold + lower strength
  // keeps bloom to genuinely bright areas instead of a blown haze over the whole frame.
  const bloomPass = bloom(color, 0.35, 0.5, 1.0);
  postProcessing.outputNode = color.add(bloomPass);

  return {
    postProcessing,
    bloomPass,
    async render() {
      // render() is current; renderAsync() is the deprecated fallback for older three.
      if (typeof postProcessing.render === 'function') postProcessing.render();
      else await postProcessing.renderAsync();
    },
    setSize(w, h) { postProcessing.setSize?.(w, h); },
  };
}
