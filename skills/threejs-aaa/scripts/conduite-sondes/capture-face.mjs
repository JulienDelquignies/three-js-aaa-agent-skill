// Capture d'une fenêtre du duel image par image (60 i/s de simulation), caméra LATÉRALE lissée qui suit le joueur i — calculée sur la
// SIMULATION (identique d'une version à l'autre) ; JPEG dans <dossier>/f00000.jpg…  Usage : node capture-video.mjs <url> <dossier> <t0> <durée> [i=0]
import { chromium } from '../../../../examples/showcase/node_modules/playwright/index.mjs';
import { mkdirSync } from 'node:fs';
const [URL, OUT, T0, DUR, I = '0'] = process.argv.slice(2); mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const pg = await b.newPage({ viewport: { width: 960, height: 540 } });
await pg.goto(URL, { waitUntil: 'load', timeout: 240000 });
await pg.waitForFunction(() => !!window.__scene && !!window.__seekFrame, null, { timeout: 240000 });
await pg.evaluate(({ T, i }) => { const sc = window.__scene; window.__cam = null;
  for (let t = 0; t < T - 1e-6; t += 1 / 60) { sc.update(1 / 60); const s = sc.players[i].sim; if (t > T - 1.5) window.__majCam?.(s, 1 / 60); }
}, { T: Number(T0), i: Number(I) }).catch(() => {});
await pg.evaluate(({ i }) => {
  // la caméra : direction de course lissée (τ 0,6 s), caméra à 4,6 m sur le côté, 1,25 m de haut, position lissée (τ 0,25 s)
  window.__majCam = (s, dt) => { const c = window.__cam ??= { dir: [s.v[0], s.v[1]], pos: null, sign: null };
    const k = 1 - Math.exp(-dt / 0.6), vx = s.v[0], vz = s.v[1]; if (Math.hypot(vx, vz) > 0.5) { c.dir[0] += (vx - c.dir[0]) * k; c.dir[1] += (vz - c.dir[1]) * k; }
    const n = Math.hypot(c.dir[0], c.dir[1]) || 1, px = -c.dir[1] / n, pz = c.dir[0] / n;
    if (c.sign == null) c.sign = Math.hypot(s.p[0] + px * 3.2, s.p[2] + pz * 3.2) < Math.hypot(s.p[0] - px * 3.2, s.p[2] - pz * 3.2) ? 1 : -1;
    const want = [s.p[0] + c.sign * px * 2.6 + c.dir[0] / n * 1.8, 0.95, s.p[2] + c.sign * pz * 2.6 + c.dir[1] / n * 1.8], kp = 1 - Math.exp(-dt / 0.25);
    c.pos = c.pos ? c.pos.map((x, j) => x + (want[j] - x) * kp) : want; c.tgt = c.tgt ? c.tgt.map((x, j) => x + ([s.p[0], 0.5, s.p[2]][j] - x) * kp) : [s.p[0], 0.5, s.p[2]]; };
  const sc = window.__scene; for (let t = 0; t < 1.5; t += 1 / 60) window.__majCam(sc.players[i].sim, 1 / 60);   // amorce du lissage
}, { i: Number(I) });
const N = Math.round(Number(DUR) * 60);
for (let f = 0; f < N; f++) {
  await pg.evaluate(async ({ i }) => { const sc = window.__scene, e = window.__engine; sc.update(1 / 60); window.__majCam(sc.players[i].sim, 1 / 60); const c = window.__cam;
    e.camera.position.set(...c.pos); e.controls.target.set(...c.tgt); e.camera.fov = 40; e.camera.updateProjectionMatrix(); await window.__seekFrame(); }, { i: Number(I) });
  await pg.screenshot({ path: `${OUT}/f${String(f).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 92 });
  if (f % 60 === 0) console.log(OUT.split('/').pop(), f, '/', N);
}
await b.close();
