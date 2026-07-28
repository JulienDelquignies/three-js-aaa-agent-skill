import { Engine } from './engine/Engine.js';

// Boot the engine and run a scene. Two kinds:
//   • cinematic  — the scene exposes setTime(t, camera); we drive a deterministic timeline (and
//                  window.__seekFrame for headless capture). Orbit is disabled.
//   • interactive — the scene has update(dt) and/or a fixed camera; OrbitControls let you look around.
// A ?capture flag renders a single deterministic frame (for thumbnails), never starting the RAF loop.
export async function run(SceneClass, opts = {}) {
  const app = document.getElementById('app');
  const engine = new Engine(app);
  await engine.boot();
  if (engine.stats?.dom) engine.stats.dom.style.display = 'none';

  const scene = new SceneClass(engine.scene, engine.renderer);
  if (scene.ready) await scene.ready;
  if (scene.camera) scene.camera(engine.camera, engine.controls); // let the scene frame itself
  // a scene may own its RENDER PIPELINE (it knows its own lighting and quality needs); it can only
  // build one once it has the real camera, which is why this comes after scene.camera()
  if (scene.postfx?.render) { engine.postfx?.dispose?.(); engine.postfx = scene.postfx; }

  const capture = new URLSearchParams(location.search).has('capture');
  if (capture) document.querySelectorAll('.hud').forEach((e) => { e.style.display = 'none'; }); // clean thumbnails
  const render = async () => {
    if (engine.postfx) await engine.postfx.render();
    else engine.renderer.render(engine.scene, engine.camera);
  };

  if (typeof scene.setTime === 'function') {                 // cinematic
    engine.controls.enabled = false;
    const duration = scene.duration || opts.duration || 6;
    window.__duration = duration;
    const frame = async (t) => { scene.setTime(t, engine.camera); await render(); };
    window.__seekFrame = async (t) => { await frame(t); return true; };
    await frame(opts.thumbTime ?? 0);
    if (!capture) engine.renderer.setAnimationLoop(async () => { await frame((performance.now() / 1000) % duration); });
  } else {                                                    // interactive (orbit)
    engine.add(scene);
    window.__seekFrame = async () => { engine.controls.update(); await render(); return true; };
    if (capture) { engine.controls.update(); await render(); }
    else engine.start();
  }

  document.getElementById('loading')?.classList.add('hidden');
  window.__engine = engine; window.__scene = scene;
  return engine;
}
