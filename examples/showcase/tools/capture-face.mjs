// capture-face.mjs — La capture d'un face-à-face sur la page : l'avance rapide jusqu'au premier (?face=saut), puis image par image (?capture), 30 images/s.
//   node capture-face.mjs <url> <dossier> [secondes=7] [ralenti=1] [avance=0 : secondes jouées avant de filmer, après l'entrée] [rang=1 : le combientième face-à-face] [debut=0 : le numéro de la première image]
import { chromium } from '../node_modules/playwright/index.mjs';
const [URL, DOSSIER, SEC = '7', RALENTI = '1', AVANCE = '0', RANG = '1', DEBUT = '0'] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const pg = await b.newPage({ viewport: { width: 1280, height: 720 } });
pg.on('pageerror', (e) => console.log('pageerror', String(e).slice(0, 300)));
await pg.goto(URL, { waitUntil: 'load', timeout: 240000 });
await pg.waitForFunction(() => window.__gpf?.players?.length === 22 && window.__seekFrame, null, { timeout: 240000 });
const debut = await pg.evaluate(([AVANCE, RANG]) => {
  const g = window.__gpf; let i = 0;
  for (let r = 1; r <= RANG; r++) {
    g.sauter();
    while (!g.cerveau.face && i++ < 80000) g.update(1 / 30);
    if (r < RANG) while (g.cerveau.face && i++ < 80000) g.update(1 / 30);
  }
  const F = g.cerveau.face, t0 = new Float32Array(g.M.HEAPF32.buffer, g.M._gf_frame(), 1)[0];
  for (let k = 0; k < AVANCE * 30; k++) g.update(1 / 30);
  return { t: t0, face: F };
}, [Number(AVANCE), Number(RANG)]);
console.log('face-à-face', JSON.stringify(debut));
const N = Math.round(Number(SEC) * 30);
for (let f = 0; f < N; f++) {
  const info = await pg.evaluate(async (dt) => { const g = window.__gpf; g.update(dt); await window.__seekFrame(); const cam = g.camRef.position, F = g.cerveau.face, pj = (id) => { const m = id != null ? g._joueur(id) : null; return m ? [+m.position.x.toFixed(1), +m.position.z.toFixed(1)] : null; }; return { face: F, der: g.cerveau.faceDerniere, hud: document.getElementById('gpfHud')?.textContent, cam: [+cam.x.toFixed(1), +cam.y.toFixed(1), +cam.z.toFixed(1)], vu: g._faceVu ? [+g._faceVu.x.toFixed(1), +g._faceVu.z.toFixed(1)] : null, zf: +g.zf.toFixed(2), c: pj(F?.porteur), d: pj(F?.defenseur), b: [+g.ball.position.x.toFixed(1), +g.ball.position.z.toFixed(1)] }; }, 1 / 30 / Number(RALENTI));
  await pg.screenshot({ path: `${DOSSIER}/f${String(Number(DEBUT) + f).padStart(4, '0')}.png` });
  if (f % 15 === 0) console.log(f, JSON.stringify({ cam: info.cam, vu: info.vu, zf: info.zf, c: info.c, d: info.d, b: info.b }), info.hud?.slice(0, 90));
}
await b.close();
