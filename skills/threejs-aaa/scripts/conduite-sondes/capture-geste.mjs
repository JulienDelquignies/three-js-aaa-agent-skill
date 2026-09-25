// Capture d'un geste du duel, CORPS ENTIERS : caméra latérale lissée qui suit le porteur i (à `dist` m sur le côté de sa course, 1,15 m de haut,
// visée au bassin, fov 40 — les deux joueurs de la tête aux pieds), au ralenti si `lent` < 1 (le pas de simulation par image = lent / 60 s).
// Le rendu logiciel (SwiftShader, sans GPU) sort par moments un sol GRIS (le gazon absent, 26 % des images mesurées ; le GPU n'a pas ce
// défaut) : chaque image est vérifiée sur une bande du sol et RE-RENDUE (sans avancer la sim) tant qu'elle est grise, 6 essais au plus.
// Usage : node capture-geste.mjs <url> <dossier> <graine> <t0> <durée s> [joueur=0] [lent=1] [dist=4]   (CAM=face : trois quarts face)   → JPEG <dossier>/f00000.jpg…
import { chromium } from '../../../../examples/showcase/node_modules/playwright/index.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
const [URL, OUT, SEED, T0, DUR, I = '0', LENT = '1', DIST = '4'] = process.argv.slice(2); mkdirSync(OUT, { recursive: true });

// un décodeur PNG minimal (8 bits, RGB/RGBA, filtres 0-4) : la bande du sol se juge à la couleur
function png(buf) {
  let o = 8, w = 0, h = 0, ct = 0; const idat = [];
  while (o < buf.length) { const n = buf.readUInt32BE(o), t = buf.toString('ascii', o + 4, o + 8), d = buf.subarray(o + 8, o + 8 + n);
    if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; } else if (t === 'IDAT') idat.push(d); else if (t === 'IEND') break; o += 12 + n; }
  const bpp = ct === 6 ? 4 : 3, raw = inflateSync(Buffer.concat(idat)), out = Buffer.alloc(w * h * bpp), st = w * bpp;
  for (let y = 0; y < h; y++) { const f = raw[y * (st + 1)], src = raw.subarray(y * (st + 1) + 1, (y + 1) * (st + 1));
    for (let x = 0; x < st; x++) { const a = x >= bpp ? out[y * st + x - bpp] : 0, b = y ? out[(y - 1) * st + x] : 0, c = x >= bpp && y ? out[(y - 1) * st + x - bpp] : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c), pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      out[y * st + x] = (src[x] + (f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : f === 4 ? pr : 0)) & 255; } }
  return { w, h, bpp, px: out };
}
const vert = (b) => { const { w, h, bpp, px } = png(b); let s = 0; for (let i = 0; i < w * h; i++) s += px[i * bpp + 1] - (px[i * bpp] + px[i * bpp + 2]) / 2; return s / (w * h); };

const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const pg = await b.newPage({ viewport: { width: 960, height: 540 } });
await pg.goto(`${URL}${URL.includes('?') ? '&' : '?'}seed=${SEED}&webgl&capture`, { waitUntil: 'load', timeout: 240000 });
await pg.waitForFunction(() => !!window.__scene && !!window.__seekFrame, null, { timeout: 240000 });
const P = { T: Number(T0), i: Number(I), dist: Number(DIST), cam: process.env.CAM ?? 'cote' };
await pg.evaluate((P) => {
  window.__majCam = (s, dt) => { const c = window.__cam ??= { dir: Math.hypot(s.v[0], s.v[1]) > 0.5 ? [s.v[0], s.v[1]] : [Math.cos(s.yaw), Math.sin(s.yaw)], pos: null, sign: null };   // arrêté : son regard
    const k = 1 - Math.exp(-dt / 0.8), vx = s.v[0], vz = s.v[1]; if (Math.hypot(vx, vz) > 0.5) { c.dir[0] += (vx - c.dir[0]) * k; c.dir[1] += (vz - c.dir[1]) * k; }
    const n = Math.hypot(c.dir[0], c.dir[1]) || 1, px = -c.dir[1] / n, pz = c.dir[0] / n;
    if (c.sign == null) c.sign = Math.hypot(s.p[0] + px * P.dist, s.p[2] + pz * P.dist) < Math.hypot(s.p[0] - px * P.dist, s.p[2] - pz * P.dist) ? 1 : -1;   // le côté de la cage le plus ouvert
    // CAM=face : de trois quarts FACE (40° de l'axe de course, devant le porteur) — l'arc latéral d'une jambe (le passement) se lit de face, pas de côté
    const fwd = [c.dir[0] / n, c.dir[1] / n], face = P.cam === 'face', ux = face ? fwd[0] * 0.77 + c.sign * px * 0.64 : c.sign * px, uz = face ? fwd[1] * 0.77 + c.sign * pz * 0.64 : c.sign * pz;
    const want = [s.p[0] + ux * P.dist, 1.15, s.p[2] + uz * P.dist], kp = 1 - Math.exp(-dt / 0.3), tg = [s.p[0], 0.9, s.p[2]];
    c.pos = c.pos ? c.pos.map((x, j) => x + (want[j] - x) * kp) : want; c.tgt = c.tgt ? c.tgt.map((x, j) => x + (tg[j] - x) * kp) : tg; };
  const sc = window.__scene; window.__cam = null;
  for (let t = 0; t < P.T - 1e-6; t += 1 / 60) { sc.update(1 / 60); if (t > P.T - 2) window.__majCam(sc.players[P.i].sim, 1 / 60); }
}, P);
const N = Math.round(Number(DUR) * 60 / Number(LENT)); let refaits = 0;
for (let f = 0; f < N; f++) {
  await pg.evaluate(async ({ i, dt }) => { const sc = window.__scene, e = window.__engine; sc.update(dt); window.__majCam(sc.players[i].sim, dt); const c = window.__cam;
    e.camera.position.set(...c.pos); e.controls.target.set(...c.tgt); e.camera.fov = 40; e.camera.updateProjectionMatrix(); await window.__seekFrame(); }, { i: P.i, dt: Number(LENT) / 60 });
  for (let k = 0; k < 6; k++) {   // la bande du sol sous les joueurs : verte, ou l'image est refaite
    if (vert(await pg.screenshot({ type: 'png', clip: { x: 80, y: 470, width: 800, height: 50 } })) > 12) break;
    refaits++; await pg.evaluate(async () => { await window.__seekFrame(); });
  }
  writeFileSync(`${OUT}/f${String(f).padStart(5, '0')}.jpg`, await pg.screenshot({ type: 'jpeg', quality: 92 }));
  if (f % 60 === 0) console.log(OUT.split('/').pop(), f, '/', N, 'refaits', refaits);
}
console.log('images refaites (sol gris) :', refaits, '/', N);
await b.close();
