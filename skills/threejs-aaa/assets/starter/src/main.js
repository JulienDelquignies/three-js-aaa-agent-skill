import { Engine } from './engine/Engine.js';
import { World } from './game/World.js';

/**
 * Entry point. Boot order matters:
 *   1. build the Engine (renderer/scene/camera)
 *   2. await engine.boot()  → awaits renderer.init() (WebGPU) + post-processing setup
 *   3. add game content (anything with update(dt))
 *   4. start the loop and hide the loading overlay
 */
async function main() {
  const app = document.getElementById('app');
  const loading = document.getElementById('loading');

  const engine = new Engine(app);
  await engine.boot();

  const world = new World(engine.scene, { seed: 'aaa-starter' });
  engine.add(world);

  engine.start();
  loading.classList.add('hidden');

  // Expose for quick console debugging (renderer.info.render.calls, etc.).
  window.__engine = engine;
}

main().catch((err) => {
  console.error(err);
  const loading = document.getElementById('loading');
  if (loading) loading.textContent = 'FAILED TO START — see console';
});
