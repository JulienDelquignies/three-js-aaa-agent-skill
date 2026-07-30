#!/usr/bin/env node
// audit-membres.mjs — LE MONDE COMPOSÉ, MEMBRE PAR MEMBRE (charte, loi 8 : une clause qui ne
// regarde pas le résultat monde composé mesure une ombre).
//
// Capture 3 gestes complets (approche + armé + contact + accompagnement) dans la scène Rondo
// réelle (build requis : npm run build dans examples/showcase), articulations à 60 Hz, puis juge :
//   DURES (le moteur) : pas de GLISSADE (corps en mouvement ⇒ un pied décolle), modèle sur la sim
//   (≤ 0,15 m), appui POSÉ au contact (≤ 0,15 m de haut), le genou frappeur a une amplitude.
//   INFO (les clips — chantier « re-calage du swing ») : vitesse du pied au contact, distance
//   pied→point de frappe, mains vs cou, bras d'équilibre — imprimées, pas bloquantes, pour que le
//   chantier ait ses chiffres à chaque exécution.
// Né de l'audit qui a attrapé le patin à glace : appui en translation 100 % des images de l'armé
// (pic 7,5 m/s) sous un corps déplacé à 5,2 m/s par le glissement, sur des jambes d'idle forcé.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
import { fileURLToPath } from 'node:url';
const REPO = join(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const SHOW = join(REPO, 'examples', 'showcase');
const { chromium } = require(require.resolve('playwright', { paths: [SHOW] }));
const root = join(SHOW, 'dist');
const MIME = { '.html':'text/html','.js':'text/javascript','.png':'image/png','.glb':'model/gltf-binary','.hdr':'application/octet-stream','.wasm':'application/wasm','.css':'text/css' };
const server = http.createServer(async (req, res) => {
  try { const p = join(root, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
    const d = await readFile(p); res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' }); res.end(d);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 900, height: 620 } });
page.on('pageerror', (e) => console.log('THROW', String(e).slice(0, 160)));
await page.goto(`http://127.0.0.1:${server.address().port}/rondo.html?q=low&seed=3&capture&webgl&free`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__rondo && window.__engine, null, { timeout: 240000 });

const episodes = await page.evaluate(async () => {
  const S = window.__rondo;
  const WANT = ['Hips','Spine','Spine1','Spine2','Neck','Head','LeftUpLeg','LeftLeg','LeftFoot','LeftToeBase','RightUpLeg','RightLeg','RightFoot','RightToeBase','LeftShoulder','LeftArm','LeftForeArm','LeftHand','RightShoulder','RightArm','RightForeArm','RightHand'];
  const snap = (by) => {
    const pl = S.players[by];
    pl.model.updateWorldMatrix(true, true);
    const bones = {};
    pl.model.traverse((o) => {
      if (!o.isBone) return;
      const suf = o.name.replace(/^mixamorig\d*/i, '');
      if (WANT.includes(suf) && !bones[suf]) {
        const wp = o.getWorldPosition(new (o.position.constructor)());
        bones[suf] = [+wp.x.toFixed(3), +wp.y.toFixed(3), +wp.z.toFixed(3)];
      }
    });
    const sim = S.state.players[by];
    return { t: +S.state.t.toFixed(3), bones, ball: S.state.ball.p.map((v) => +v.toFixed(3)),
      simP: [+sim.p[0].toFixed(3), +sim.p[2].toFixed(3)], yaw: +sim.yaw.toFixed(3), speed: +sim.speed.toFixed(2),
      act: sim.act ? { id: sim.act.id, t: +sim.act.t.toFixed(3), fired: !!sim.act.fired, antic: sim.act.anticipation } : null,
      hold: +S.state.hold.toFixed(2) };
  };
  const episodes = [];
  // tampon roulant par joueur : on snapshotte le PORTEUR à chaque image
  let ring = [];
  let ringBy = -1;
  let current = null;
  for (let i = 0; i < 60 * 200 && episodes.length < 3; i++) {
    const nEv = S.state.events.length;
    S.update(1 / 60);
    const carrier = S.state.possession.carrier;
    if (carrier >= 0 && !current) {
      if (carrier !== ringBy) { ring = []; ringBy = carrier; }
      ring.push(snap(carrier));
      if (ring.length > 40) ring.shift();
      const w = S.state.events.slice(nEv).find((x) => x.type === 'windup');
      if (w && i > 300) {
        current = { by: w.by, move: w.move, foot: w.foot, antic: w.anticipation, frames: [...ring], post: 0 };
      }
    } else if (current) {
      current.frames.push(snap(current.by));
      current.post++;
      if (current.post > 54) { episodes.push(current); current = null; ring = []; }
    }
    if (carrier < 0) ring = [];
  }
  return episodes;
});
console.log('episodes:', episodes.map((e) => `${e.move}/${e.foot} n=${e.frames.length}`).join(' | '));
await browser.close(); server.close();

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };
const H = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const ang = (a, b, c) => {
  const u = [a[0]-b[0], a[1]-b[1], a[2]-b[2]], v = [c[0]-b[0], c[1]-b[1], c[2]-b[2]];
  const du = Math.hypot(...u), dv = Math.hypot(...v);
  return Math.acos(Math.max(-1, Math.min(1, (u[0]*v[0]+u[1]*v[1]+u[2]*v[2])/(du*dv||1)))) * 180 / Math.PI;
};
ok(`3 épisodes capturés (${episodes.length})`, episodes.length >= 3);
for (const [ei, ep] of episodes.entries()) {
  const F = ep.frames, dt = 1/60;
  const iStart = F.findIndex((f) => f.act);
  const iFire = F.findIndex((f) => f.act && f.act.fired);
  const strike = ep.foot === 'right' ? 'RightFoot' : 'LeftFoot';
  const support = ep.foot === 'right' ? 'LeftFoot' : 'RightFoot';
  const phase = (i) => i < iStart ? 'approche' : (iFire < 0 || i < iFire) ? 'armé' : 'suite';
  console.log(`— épisode ${ei}: ${ep.move} pied ${ep.foot} —`);
  let lagMax = 0;
  F.forEach((f) => { lagMax = Math.max(lagMax, H(f.bones.Hips, [f.simP[0], 0, f.simP[1]])); });
  ok(`  le modèle est SUR la sim (écart Hips max ${lagMax.toFixed(2)} m ≤ 0,15)`, lagMax <= 0.15);
  {
    const W = Math.round(0.4 / dt); let glisse = 0, n = 0;
    for (let i = W; i < F.length; i++) {
      if (phase(i) === 'approche') continue;
      let disp = 0, lift = 0;
      for (let j = i - W + 1; j <= i; j++) {
        disp += H(F[j-1].bones.Hips, F[j].bones.Hips);
        lift = Math.max(lift, F[j].bones.LeftFoot[1], F[j].bones.RightFoot[1]);
      }
      if (disp / (W * dt) > 0.8) { n++; if (lift < 0.10) glisse++; }
    }
    ok(`  AUCUNE glissade armé/suite (corps en mouvement ⇒ un pied décolle) : ${glisse}/${n} fenêtres`, glisse === 0);
  }
  if (iFire > 0) {
    const c = F[iFire-1];
    ok(`  l'appui est POSÉ au contact (hauteur ${c.bones[support][1].toFixed(2)} m ≤ 0,15)`, c.bones[support][1] <= 0.15);
    const angles = [];
    for (let i = iStart; i < F.length; i++) angles.push(ang(F[i].bones[ep.foot === 'right' ? 'RightUpLeg' : 'LeftUpLeg'], F[i].bones[ep.foot === 'right' ? 'RightLeg' : 'LeftLeg'], F[i].bones[strike]));
    const amp = Math.max(...angles) - Math.min(...angles);
    ok(`  le genou frappeur a une amplitude (${amp.toFixed(0)}° ≥ 40)`, amp >= 40);
    // INFO — les chiffres du chantier clips (re-calage du swing), imprimés à chaque exécution
    const bAt = c.ball;
    let minD = 9; for (let i = iStart; i < Math.min(F.length, iFire + 6); i++) minD = Math.min(minD, H(F[i].bones[strike], bAt));
    const vC = H(F[iFire-1].bones[strike], F[iFire].bones[strike]) / dt;
    let above = 0, nn = 0;
    for (let i = iStart; i < F.length; i++) { nn++; const b = F[i].bones; if (b.LeftHand[1] > b.Neck[1] || b.RightHand[1] > b.Neck[1]) above++; }
    console.log(`  INFO clips: pied→frappe min ${minD.toFixed(2)} m | vitesse pied au contact ${vC.toFixed(1)} m/s (réel: 15-25) | appui→ballon ${H(c.bones[support], bAt).toFixed(2)} m (stance ~0,30) | mains>cou ${(100*above/nn).toFixed(0)}%`);
  }
}
console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
