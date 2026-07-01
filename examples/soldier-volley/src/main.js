import { Engine } from './engine/Engine.js';
import { SoldierVolley } from './game/SoldierVolley.js';

async function main() {
  const app = document.getElementById('app');
  const engine = new Engine(app);
  await engine.boot();
  engine.controls.enabled = false;
  if (engine.stats?.dom) engine.stats.dom.style.display = 'none';

  const scene = new SoldierVolley(engine.scene, engine.renderer);
  await scene.ready;
  window.__duration = scene.duration;

  const render = async (t) => {
    scene.setTime(t, engine.camera);
    if (engine.postfx) await engine.postfx.render();
    else engine.renderer.render(engine.scene, engine.camera);
  };
  window.__seekFrame = async (t) => { await render(t); return true; };
  window.__engine = engine;

  await render(0);
  document.getElementById('loading')?.classList.add('hidden');

  if (!new URLSearchParams(location.search).has('capture')) {
    engine.renderer.setAnimationLoop(async () => { await render((performance.now() / 1000) % scene.duration); });
  }
}

main().catch((e) => { console.error(e); const l = document.getElementById('loading'); if (l) l.textContent = 'FAILED — see console'; });
