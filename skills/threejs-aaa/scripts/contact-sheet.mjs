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
import { KINDS, solveStrike, strikePortrait, styleFromSeed, NEUTRAL_STYLE, denseSampler } from '../assets/starter/src/engine/motion-strike.js';
import { GENERATORS } from '../assets/starter/src/engine/motion-cast.js';
import { CONTROL_KINDS, controlPortrait } from '../assets/starter/src/engine/motion-control.js';
import { AERIAL_KINDS, aerialPortrait } from '../assets/starter/src/engine/motion-aerial.js';
import { SKILL_KINDS, skillPortrait } from '../assets/starter/src/engine/motion-skill.js';
import { GROUND_KINDS, groundPortrait } from '../assets/starter/src/engine/motion-ground.js';
import { KEEPER_KINDS, keeperPortrait } from '../assets/starter/src/engine/motion-keeper.js';
import { gaitParams, gaitStyleFromSeed, NEUTRAL_GAIT_STYLE } from '../assets/starter/src/engine/motion-gait.js';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => a.startsWith('--') ? [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : '1'] : []).filter(Boolean));
// --gait <vF> [--lat <vR>] : LA FOULÉE (lot A7) — huit phases d'un cycle, avant (clips du donneur) / après (générée), posées par le contrôleur
const GAIT = args.gait != null ? { vF: +args.gait, vR: +(args.lat || 0) } : null;
const MOVE = GAIT ? `foulee-${GAIT.vF}-${GAIT.vR}` : (args.move || 'frappe');
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
// LE BALLON de la planche : à la stance dérivée (frappe), au pied / sous la semelle / sur la cuisse /
// devant la poitrine (contrôles), au front (tête) — lu par FK au contact du spec, quelle que soit sa
// provenance (authoré ou généré)
function ballFor(move, spec) {
  const at = denseSampler(spec, P);
  const w = at(spec.contact);
  const K = CONTROL_KINDS[move];
  if (SKILL_KINDS[move]) return [...SKILL_KINDS[move].ball];   // le geste technique DÉCLARE où est son ballon (il ne part pas)
  if (GROUND_KINDS[move]) return [...GROUND_KINDS[move].ball];
  if (KEEPER_KINDS[move]) return [...KEEPER_KINDS[move].ball];
  if (AERIAL_KINDS[move]) { const h = w.Head.p; return [h[0], h[1] + 0.02, h[2] - 0.2]; }
  if (K?.chest) { const c = w.Spine2.p; return [c[0], c[1] + 0.05, c[2] - 0.24]; }
  if (K?.thigh) { const k = w.RightLeg.p, hp = w.RightUpLeg.p; return [(k[0] + hp[0]) / 2 + 0.02, (k[1] + hp[1]) / 2 + 0.11, (k[2] + hp[2]) / 2 - 0.02]; }
  if (K?.sole) { const f = w.RightFoot.p; return [f[0], 0.11, f[2] - 0.12]; }
  if (K) { const f = w.RightFoot.p, h = w.Hips.p; const d = Math.hypot(f[0] - h[0], f[2] - h[2]) || 1; return [f[0] + 0.14 * (f[0] - h[0]) / d, 0.11, f[2] + 0.14 * (f[2] - h[2]) / d]; }
  return strikePortrait(spec, P).S;
}
function describe(move, spec) {
  if (KEEPER_KINDS[move]) { const p = keeperPortrait(spec, P), K = KEEPER_KINDS[move]; return K.dive ? `bassin ${p.hC[0].toFixed(2)} m de côté, ${(100 * p.hC[1]).toFixed(0)} cm de haut au contact, gants à ${p.handReach.toFixed(2)} m` : K.jump ? `bassin +${(100 * p.hC[1]).toFixed(0)} cm, mains ${(100 * p.handsAboveHead).toFixed(0)} cm au-dessus de la tête` : K.kick ? `pied à ${p.footOutC.toFixed(2)} m de côté` : `tête ${(100 * p.headBackMax).toFixed(0)} cm derrière le bassin`; }
  if (GROUND_KINDS[move]) { const p = groundPortrait(spec, P); return `pied à ${(p.footAheadC * 100).toFixed(0)} cm devant, bassin couché à ${(p.pelvisL * 100).toFixed(0)} cm`; }
  if (SKILL_KINDS[move]) { const p = skillPortrait(spec, P), K = SKILL_KINDS[move]; return K.sole ? `cheville à ${(p.hC * 100).toFixed(0)} cm, ${(p.distBallC * 100).toFixed(0)} cm du ballon` : K.circle ? `pied à ${(p.peakH * 100).toFixed(0)} cm, ${(p.minBall * 100).toFixed(0)} cm du ballon` : K.croqueta ? `balaie ${(p.sweepL * 100).toFixed(0)} cm, pousse ${(p.pushL * 100).toFixed(0)} cm` : `pied ${p.vFootC.toFixed(1)} m/s au contact`; }
  if (AERIAL_KINDS[move]) { const p = aerialPortrait(spec, P); return AERIAL_KINDS[move].upperOnly ? `tête ${p.headC.toFixed(0)}° au contact` : `bassin +${(p.apex * 100).toFixed(0)} cm à l'apex · tête ${p.headC.toFixed(0)}°`; }
  if (CONTROL_KINDS[move]) { const p = controlPortrait(spec, P); return CONTROL_KINDS[move].chest ? `tête ${(p.headBack * 100).toFixed(0)} cm derrière le bassin` : CONTROL_KINDS[move].thigh ? `genou à ${(p.kneeH * 100).toFixed(0)} cm` : `pied à ${(p.excC * 100).toFixed(0)} cm au contact`; }
  const p = strikePortrait(spec, P);
  return `pied ${p.vContact.toFixed(1)} m/s · genou ${(p.kneePeak.w * 180 / Math.PI).toFixed(0)}°/s · stance {${p.stance.dist.toFixed(2)} m, ${p.stance.bearing.toFixed(0)}°}`;
}
if (GAIT) {
  const v = Math.hypot(GAIT.vF, GAIT.vR), style = SEED != null ? gaitStyleFromSeed(SEED) : NEUTRAL_GAIT_STYLE;
  const pg = gaitParams(GAIT.vF, GAIT.vR, style);
  const dir = `${v.toFixed(1)} m/s (avant ${GAIT.vF}, droite ${GAIT.vR})`;
  if (VARIANT !== 'after') variants.push({ label: `AVANT — les clips du donneur (Soldier) à ${dir}`, mode: 'clips', gait: { ...GAIT, seed: SEED }, spec: null, ball: [2.5, 0.11, 4] });
  if (VARIANT !== 'before') variants.push({ label: `APRÈS — la foulée générée à ${dir}${SEED != null ? ` (signature graine ${SEED})` : ''} · appui ${(pg.s * 100).toFixed(0)} %, cycle ${pg.T.toFixed(2)} s`, mode: 'generee', gait: { ...GAIT, seed: SEED }, spec: null, ball: [2.5, 0.11, 4] });
}
if (!GAIT && VARIANT !== 'after') {
  const spec = AUTHORED[MOVE] || MOVES[MOVE];
  if (!spec) { console.error(`geste inconnu : ${MOVE}`); process.exit(1); }
  variants.push({ label: `AVANT — ${MOVE} authoré (${spec.keys.length} clés) · ${describe(MOVE, spec)}`, spec, ball: ballFor(MOVE, spec) });
}
if (!GAIT && VARIANT !== 'before') {
  if (!GENERATORS[MOVE]) { console.error(`pas de générateur pour : ${MOVE} (espèces : ${Object.keys(GENERATORS).join(', ')})`); process.exit(1); }
  const style = SEED != null ? styleFromSeed(SEED) : NEUTRAL_STYLE;
  const spec = KINDS[MOVE] && !KINDS[MOVE].feint ? solveStrike(MOVE, P, { style }).spec : GENERATORS[MOVE].generate(P, { style });
  variants.push({ label: `APRÈS — ${MOVE} généré${SEED != null ? ` (style graine ${SEED})` : ' (style neutre)'} · ${describe(MOVE, spec)}`, spec, ball: ballFor(MOVE, spec) });
}
const PHASES = GAIT ? [0, 1, 2, 3, 4, 5, 6, 7].map((i) => i / 8) : [-0.25, -0.15, -0.03, 0, 0.08, 0.2];
const HIGH = !!AERIAL_KINDS[MOVE] || !!CONTROL_KINDS[MOVE]?.chest || !!KEEPER_KINDS[MOVE]?.jump;   // une tête, une poitrine ou une prise se regarde plus haut
const up = HIGH ? 0.4 : 0;
const side = KEEPER_KINDS[MOVE]?.lateral ? KEEPER_KINDS[MOVE].lateral * 0.55 : 0;   // un plongeon part de côté : les caméras suivent à mi-course
const CAMS = [
  { name: 'côté frappeur', pos: [3.1 + side, 1.15 + up, -0.3], look: [side, 0.95 + up, -0.15] },
  { name: 'face ¾', pos: [2.1 + side, 1.3 + up, -2.7 - 0.6 * side], look: [side, 0.9 + up, 0] },
  { name: 'dos ¾ bas', pos: [-1.7 + side, 0.55 + up, 2.5 + 0.6 * side], look: [side, 0.8 + up, -0.2] },
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
    S.ball.position.set(ball[0], ball[1], ball[2]);
    const r = spec ? pl.gestureLayer.begin(spec) : { missing: [] };
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
      const t = await page.evaluate(async ({ cam, dt, gait, mode }) => {
        const S = window.__scene || window.__rondo, E = window.__engine;
        const pl = S.players[0], spec = pl.gestureLayer.spec;
        let t;
        if (gait) {
          // LA FOULÉE : posée par le CONTRÔLEUR (l'écrivain du jeu), à la phase φ = dt, vitesse corps (vF, vR)
          const v = Math.hypot(gait.vF, gait.vR);
          if (gait.seed != null && pl.ctrl._gaitGen) pl.ctrl.setGaitStyle(gait.seed);
          pl.ctrl.locomotion = mode; pl.ctrl.gait.phi = dt;
          pl.ctrl._cur.set(gait.vR / v, -gait.vF / v); pl.ctrl._yawIn = pl.ctrl.yaw;
          pl.ctrl.groundSpeed = v; pl.ctrl.speed = v; pl.ctrl._vAnim = v;
          pl.ctrl.anim.set('speed', v).update(0);
          pl.ctrl._applyGaitLayer(v);
          t = dt;
        } else {
          t = Math.max(0, Math.min(spec.duration, spec.contact + dt));
          pl.mixer.update(0);
          pl.gestureLayer.apply(t, 1, 1);
        }
        pl.model.updateMatrixWorld(true);
        E.camera.position.set(...cam.pos); E.camera.lookAt(...cam.look); E.camera.updateMatrixWorld(true);
        if (E.postfx?.render) await E.postfx.render(); else E.renderer.render(E.scene, E.camera);
        return t;
      }, { cam: CAMS[ci], dt: PHASES[pi], gait: v.gait || null, mode: v.mode || null });
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
