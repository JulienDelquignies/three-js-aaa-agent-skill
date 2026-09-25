// LE TAPIS : un joueur de la page duel mené À RECULONS (ou en avant) en ligne droite à v m/s — le contrôleur tel que Rondo le mène (vitesse,
// racine finale, update, verrou de pieds en dernier), sans la sim ; caméra de côté qui suit. JPEG image par image dans <dossier>.
// Usage : node tapis-video.mjs <url> <dossier> <v (m/s, < 0 = à reculons)> <durée s> [i=0] [montée s=1]
import { chromium } from '../../../../examples/showcase/node_modules/playwright/index.mjs';
import { mkdirSync } from 'node:fs';
const [URL, OUT, V, DUR, I = '0', RAMP = '1'] = process.argv.slice(2); mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const pg = await b.newPage({ viewport: { width: 960, height: 540 } });
await pg.goto(URL, { waitUntil: 'load', timeout: 240000 });
await pg.waitForFunction(() => !!window.__scene && !!window.__seekFrame, null, { timeout: 240000 });
await pg.evaluate(({ i }) => {
  const sc = window.__scene; for (let t = 0; t < 2; t += 1 / 60) sc.update(1 / 60);   // la scène s'installe
  const pl = sc.players[i], other = sc.players[1 - i];
  if (other) { other.model.position.set(0, other.model.position.y, 6.5); other.model.updateMatrixWorld(true); }
  pl.ctrl.gestureHold = false; pl.ctrl.plantHold = false; pl.ctrl.idleCtx = {}; if (pl.sim) pl.sim.act = null;   // hors geste : la foulée seule
  if (pl.gestureLayer) { try { pl.gestureLayer.stop?.(); } catch {} pl.gestureLayer.active = false; }
  const top = pl.ctrl.runSpeed; window.__tapis = { pl, x: 6, z: 0, yaw: pl.ctrl.yawFor(1, 0), top, t: 0 };   // regarde vers +X
  pl.model.position.set(6, pl.model.position.y, 0); pl.ctrl.pos.set(6, pl.groundY, 0); pl.ctrl._lastW = null; pl.ctrl.yaw = window.__tapis.yaw; pl.model.rotation.y = pl.ctrl.yaw;
  if (sc.ball?.mesh) sc.ball.mesh.position.set(0, 0.11, -6);
}, { i: Number(I) });
const step = (v, ramp) => pg.evaluate(async ({ v, ramp }) => {
  const T = window.__tapis, pl = T.pl, dt = 1 / 60; T.t += dt;
  const vv = v * Math.min(1, T.t / ramp), vx = vv, vz = 0;          // v < 0 : vers −X, le regard reste vers +X
  T.x += vx * dt; T.z += vz * dt;
  pl.ctrl.setMoveWorld(vx / T.top, vz / T.top); pl.ctrl.rootFinal = [T.x, T.z, T.yaw];
  pl.ctrl.update(dt);
  pl.ctrl.pos.set(T.x, pl.groundY, T.z); pl.model.position.copy(pl.ctrl.pos); pl.ctrl.yaw = T.yaw; pl.model.rotation.y = T.yaw;
  if (pl.ctrl.footLock) pl.ctrl.footLock.solve(dt, [true, true], Math.atan2(0, 1), pl.ctrl.groundSpeed ?? 0);
  const e = window.__engine; e.camera.position.set(T.x - 0.2, 1.05, T.z + 4.2); e.controls.target.set(T.x - 0.2, 0.8, T.z); e.camera.fov = 40; e.camera.updateProjectionMatrix();
  await window.__seekFrame();
}, { v, ramp });
const N = Math.round(Number(DUR) * 60);
for (let f = 0; f < N; f++) { await step(Number(V), Number(RAMP)); await pg.screenshot({ path: `${OUT}/f${String(f).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 92 }); if (f % 60 === 0) console.log(OUT.split('/').pop(), f, '/', N); }
await b.close();
