import * as THREE from 'three/webgpu';
import { Timer } from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import Stats from 'stats-gl';
import { createRenderer } from './Renderer.js';
import { setupLighting } from './Lighting.js';
import { createPostFX } from './PostFX.js';

/**
 * Engine: owns the renderer, scene, camera, clock, render loop, resize, and the
 * post-processing stack. Game content registers `update(dt)` callbacks via add().
 *
 * Lifecycle:
 *   const engine = new Engine(document.getElementById('app'));
 *   await engine.boot();          // awaits renderer.init() + post-processing
 *   engine.add(myUpdatable);      // anything with an update(dt) method
 *   engine.start();
 */
export class Engine {
  constructor(parent) {
    this.parent = parent;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(6, 4, 9);
    this.timer = new Timer();
    this.updatables = [];
    this.perf = { upd: new Float32Array(900), ren: new Float32Array(900), at: new Float64Array(900), i: 0, n: 0 };   // 15 s à 60 ips
    this._onResize = this.resize.bind(this);
  }

  async boot({ stats = true } = {}) {
    const forceWebGL = new URLSearchParams(location.search).has('webgl');
    this.renderer = createRenderer(this.parent, { forceWebGL });
    await this.renderer.init();                 // MANDATORY for WebGPU

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.target.set(0, 1, 0);

    this.lighting = await setupLighting(this.scene, this.renderer);
    this.postfx = await createPostFX(this.renderer, this.scene, this.camera);

    // LE COMPTEUR NE TOURNE QUE S'IL SE VOIT (perf lot 4 — mesuré : runner masquait son DOM mais begin/end/update et
    // les requêtes de temps GPU tournaient à chaque image, −16,7 ms/image pour un panneau que personne ne regarde) :
    // sans ?fps, aucun Stats n'est créé — ni requête GPU, ni panneau. this.stats reste undefined, start() le sait.
    if (stats) {
      this.stats = new Stats({ trackGPU: true });
      await this.stats.init?.(this.renderer);
      this.parent.appendChild(this.stats.dom);
    }

    window.addEventListener('resize', this._onResize);
    return this;
  }

  add(updatable) { if (updatable?.update) this.updatables.push(updatable); return updatable; }

  start() {
    this.renderer.setAnimationLoop(async () => {
      this.timer.update();
      const dt = Math.min(this.timer.getDelta(), 0.1); // clamp to avoid huge steps after stalls
      this.controls.update();
      // LE JOURNAL DES DEUX CANAUX (perf lot 0) : la logique de jeu (updatables : sim, animation, IK) et
      // l'appel de rendu, en ms mur, dans un anneau borné — le compteur stats-gl ne voit que le rendu.
      const t0 = performance.now();
      for (const u of this.updatables) u.update(dt);
      const t1 = performance.now();
      this.stats?.begin?.();
      if (this.postfx) await this.postfx.render();
      else this.renderer.render(this.scene, this.camera);
      this.stats?.end?.();
      this.stats?.update?.();
      const t2 = performance.now();
      const J = this.perf; J.upd[J.i] = t1 - t0; J.ren[J.i] = t2 - t1; J.at[J.i] = t2; J.i = (J.i + 1) % J.upd.length; J.n = Math.min(J.n + 1, J.upd.length);
    });
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    if (!w || !h) return;      // onglet caché/minimisé : 0×0 écrirait aspect NaN — définitif faute de resize au retour
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.postfx?.setSize?.(w, h);
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    window.removeEventListener('resize', this._onResize);
    this.lighting?.dispose?.();
    this.controls.dispose();
    this.renderer.dispose();
  }
}
