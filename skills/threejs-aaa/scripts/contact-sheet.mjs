#!/usr/bin/env node
// contact-sheet.mjs — LA PLANCHE-CONTACT D'UN GESTE : le même instrument pour l'agent et pour
// l'humain. Un geste se juge à l'œil sur des phases nommées et des angles fixes, pas sur une
// capture prise au hasard d'un match. La planche pose UN joueur de la scène Rondo (build requis :
// npm run build dans examples/showcase), joue le geste à poids plein par la couche de geste (la
// sémantique du jeu : rest ⊗ q_spec, canal hanches, pas de warp — c'est le CLIP qu'on juge), place
// le ballon à la stance DÉRIVÉE du clip, et rend 3 caméras × 6 phases dans une seule PNG.
//
//   node contact-sheet.mjs --move frappe [--variant before|after|both] [--seed 7] [--out dir]
//                          [--page rondo.html] [--cell 300]
//
// « before » = le spec authoré (animkit-data), « after » = le spec GÉNÉRÉ (motion-strike, style
// neutre ou par graine). Les phases sont relatives au contact : −0,25 s, −0,15, −0,03, 0, +0,08,
// +0,20. Les caméras : côté frappeur, face trois-quarts, dos trois-quarts bas.
import http from 'node:http';
import { readFile, readFileSync, mkdir, writeFile } from 'node:fs';
import { promises as fsp } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { MOVES, AUTHORED } from '../assets/starter/src/engine/animkit-data.js';
import { profileFromGltf } from '../assets/starter/src/engine/motion-rig.js';
import { KINDS, solveStrike, strikePortrait, styleFromSeed, NEUTRAL_STYLE } from '../assets/starter/src/engine/motion-strike.js';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => a.startsWith('--') ? [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : '1'] : []).filter(Boolean));
const MOVE = args.move || 'frappe';
const VARIANT = args.variant || 'both';
const SEED = args.seed != null ? +args.seed : null;
const CELL = +(args.cell || 300);
const REPO = join(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const SHOW = join(REPO, 'examples', 'showcase');
const OUT = resolve(args.out || join(REPO, 'playmode-shots', 'planches'));
const require = createRequire(import.meta.url);
const { chromium } = require(require.resolve('playwright', { paths: [SHOW] }));

// ---- les specs : authoré (before) et généré (after), plus leur ballon (stance dérivée)
const raw = readFileSync(join(SHOW, 'public', 'shanon.glb'));
const glbLen = raw.readUInt32LE(12);
const P = profileFromGltf(JSON.parse(raw.subarray(20, 20 + glbLen).toString()), { faces: '+Z' });
const variants = [];
if (VARIANT !== 'after') {
  const spec = AUTHORED[MOVE] || MOVES[MOVE];
  if (!spec) { console.error(`geste inconnu : ${MOVE}`); process.exit(1); }
  const p = strikePortrait(spec, P);
  variants.push({ label: `AVANT — ${MOVE} authoré (${spec.keys.length} clés) · pied ${p.vContact.toFixed(1)} m/s au contact · stance {${p.stance.dist.toFixed(2)} m, ${p.stance.bearing.toFixed(0)}°}`, spec, ball: p.S });
}
if (VARIANT !== 'before') {
  if (!KINDS[MOVE]) { console.error(`pas de générateur pour : ${MOVE} (espèces : ${Object.keys(KINDS).join(', ')})`); process.exit(1); }
  const style = SEED != null ? styleFromSeed(SEED) : NEUTRAL_STYLE;
  const sol = solveStrike(MOVE, P, { style });
  const p = strikePortrait(sol.spec, P);
  variants.push({ label: `APRÈS — ${MOVE} généré${SEED != null ? ` (style graine ${SEED})` : ' (style neutre)'} · pied ${p.vContact.toFixed(1)} m/s · genou ${(p.kneePeak.w * 180 / Math.PI).toFixed(0)}°/s · stance {${p.stance.dist.toFixed(2)} m, ${p.stance.bearing.toFixed(0)}°}`, spec: sol.spec, ball: p.S });
}
const PHASES = [-0.25, -0.15, -0.03, 0, 0.08, 0.2];
const CAMS = [
  { name: 'côté frappeur', pos: [3.1, 1.15, -0.3], look: [0, 0.95, -0.15] },
  { name: 'face ¾', pos: [2.1, 1.3, -2.7], look: [0, 0.9, 0] },
  { name: 'dos ¾ bas', pos: [-1.7, 0.55, 2.5], look: [0, 0.8, -0.2] },
];

// ---- le serveur statique + Chromium headless (même recette que audit-membres)
const root = join(SHOW, 'dist');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.glb': 'model/gltf-binary', '.hdr': 'application/octet-stream', '.wasm': 'application/wasm', '.css': 'text/css' };
const server = http.createServer(async (req, res) => {
  try { const p = join(root, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html')); const d = await fsp.readFile(p); res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' }); res.end(d); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ executablePath: process.env.PLAYMODE_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
page.on('pageerror', (e) => console.log('THROW', String(e).slice(0, 200)));
const url = `http://127.0.0.1:${server.address().port}/${args.page || 'rondo.html'}?q=low&seed=3&capture&webgl`;
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => (window.__scene || window.__rondo) && window.__engine, null, { timeout: 240000 });

await fsp.mkdir(OUT, { recursive: true });
// Le canvas WebGL ne se relit pas par drawImage entre deux rendus dans la même tâche (le tampon
// présenté est celui du compositeur) : chaque cellule est une CAPTURE Playwright, recomposée dans
// un canvas 2D de la page (polices, libellés) — même vérité que les captures de play-mode.
for (const v of variants) {
  await page.evaluate(async ({ spec, ball, phases, cams, cell, label }) => {
    const S = window.__scene || window.__rondo;
    const pl = S.players[0];
    // un seul corps sur la pelouse, à l'origine, face à −Z (la convention du wrapper)
    for (const o of S.players) if (o !== pl) o.model.visible = false;
    if (S.arbitre3d?.model) S.arbitre3d.model.visible = false;
    pl.ctrl.setMoveWorld(0, 0);
    for (let i = 0; i < 40; i++) pl.ctrl.update(1 / 60);          // la base : l'idle, poids 1
    pl.model.position.set(0, pl.groundY, 0); pl.model.rotation.y = 0;
    pl.ctrl.pos.set(0, pl.groundY, 0);
    S.ball.position.set(ball[0], 0.11, ball[2]);
    const r = pl.gestureLayer.begin(spec);
    const sheet = document.createElement('canvas');
    const W = cell, H = cell, top = 34, left = 120;
    sheet.width = left + W * phases.length; sheet.height = top + H * cams.length;
    const g = sheet.getContext('2d');
    g.fillStyle = '#0a0a0c'; g.fillRect(0, 0, sheet.width, sheet.height);
    g.fillStyle = '#e8ebf2'; g.font = '600 15px system-ui, sans-serif';
    g.fillText(label + (r.missing.length ? `  — os absents : ${r.missing.join(', ')}` : ''), 10, 22);
    for (let ci = 0; ci < cams.length; ci++) {
      g.save(); g.translate(14, top + H * ci + H / 2); g.rotate(-Math.PI / 2); g.fillStyle = '#9aa2b1'; g.font = '500 13px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(cams[ci].name, 0, 0); g.restore();
    }
    window.__sheet = { sheet, g, W, H, top, left };
  }, { spec: v.spec, ball: v.ball, phases: PHASES, cams: CAMS, cell: CELL, label: v.label });
  for (let ci = 0; ci < CAMS.length; ci++) {
    for (let pi = 0; pi < PHASES.length; pi++) {
      const t = await page.evaluate(async ({ cam, dt }) => {
        const S = window.__scene || window.__rondo, E = window.__engine;
        const pl = S.players[0], spec = pl.gestureLayer.spec;
        const t = Math.max(0, Math.min(spec.duration, spec.contact + dt));
        pl.mixer.update(0);
        pl.gestureLayer.apply(t, 1, 1);
        pl.model.updateMatrixWorld(true);
        E.camera.position.set(...cam.pos); E.camera.lookAt(...cam.look); E.camera.updateMatrixWorld(true);
        if (E.postfx?.render) await E.postfx.render(); else E.renderer.render(E.scene, E.camera);
        return t;
      }, { cam: CAMS[ci], dt: PHASES[pi] });
      const png = await page.screenshot({ type: 'png' });
      await page.evaluate(async ({ b64, ci, pi, t, dt }) => {
        const { g, W, H, top, left } = window.__sheet;
        const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode();
        g.drawImage(img, left + W * pi, top + H * ci, W, H);
        if (ci === 0) { g.fillStyle = '#cfd3dc'; g.font = '500 13px system-ui, sans-serif'; g.textAlign = 'left'; g.fillText(`t = ${t.toFixed(2)} s (${dt >= 0 ? '+' : ''}${dt.toFixed(2)} vs contact)`, left + W * pi + 6, top + 16); }
      }, { b64: png.toString('base64'), ci, pi, t, dt: PHASES[pi] });
    }
  }
  const dataUrl = await page.evaluate(() => {
    const S = window.__scene || window.__rondo;
    S.players[0].gestureLayer.end();
    for (const o of S.players) o.model.visible = true;
    if (S.arbitre3d?.model) S.arbitre3d.model.visible = true;
    return window.__sheet.sheet.toDataURL('image/png');
  });
  const tag = v.label.startsWith('AVANT') ? 'avant' : SEED != null ? `apres-s${SEED}` : 'apres';
  const file = join(OUT, `${MOVE}-${tag}.png`);
  await fsp.writeFile(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log(file);
}
await browser.close(); server.close();
