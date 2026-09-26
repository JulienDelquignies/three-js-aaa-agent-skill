// Capture d'un geste du duel, CORPS ENTIERS : caméra latérale lissée qui suit le porteur i (à `dist` m sur le côté de sa course, 1,15 m de haut,
// visée au bassin, fov 40 — les deux joueurs de la tête aux pieds), au ralenti si `lent` < 1 (le pas de simulation par image = lent / 60 s).
// Le rendu logiciel (SwiftShader, sans GPU) sort par moments un sol GRIS (le gazon absent, 26 % des images mesurées ; le GPU n'a pas ce
// défaut) : chaque image est vérifiée sur une bande du sol et RE-RENDUE (sans avancer la sim) tant qu'elle est grise, 6 essais au plus.
// La caméra garde le soleil dans le dos et reste dans la cage (bornée, elle monte). Usage : node capture-geste.mjs <url> <dossier> <graine> <t0 | conduite> <durée s> [joueur=0 | porteur] [lent=1] [dist=4]   (CAM=face : trois quarts face)   → JPEG <dossier>/f00000.jpg…
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
let pg = await b.newPage({ viewport: { width: 960, height: 540 } });
const ouvre = async () => { await pg.goto(`${URL}${URL.includes('?') ? '&' : '?'}seed=${SEED}&webgl&capture`, { waitUntil: 'load', timeout: 240000 });
  await pg.waitForFunction(() => !!window.__scene && !!window.__seekFrame, null, { timeout: 240000 }); };
await ouvre();
// T0 = 'conduite' : la partie de CETTE page (la même config que le film) est d'abord parcourue sans rendu jusqu'à 90 s ; la plus longue conduite en
// course (≥ 1,8 m/s, au moins une touche) est retenue, la page rechargée, la fenêtre filmée de 0,6 s avant son début.
let T0n = Number(T0);
if (T0 === 'conduite') {
  const best = await pg.evaluate(() => { const sc = window.__scene, st = sc.state; let cur = null, best = null, ne = 0; const tch = [];
    while (st.t < 90) { sc.update(1 / 60); while (ne < st.events.length) { const e = st.events[ne++]; if (e.type === 'touche') tch.push([e.t, e.by]); }
      const car = st.possession?.carrier ?? -1, c = st.players[car], ok = c && st.phase === 'carry' && !st.restart && Math.hypot(...c.v) >= 1.8;
      if (ok && cur && cur.by === car) cur.t1 = st.t; else if (ok) cur = { by: car, t0: st.t, t1: st.t }; else cur = null;
      if (cur && cur.t1 - cur.t0 > 1.5) { const n = tch.filter(([t, by]) => by === cur.by && t >= cur.t0 && t <= cur.t1).length; if (n >= 1 && (!best || cur.t1 - cur.t0 > best.t1 - best.t0)) best = { ...cur, n }; } }
    return best; });
  console.log('conduite retenue :', JSON.stringify(best));
  if (!best) { console.log('aucune conduite trouvée'); process.exit(1); }
  T0n = Math.max(0.05, best.t0 - 0.6); await ouvre();
}
// T0 = 'recup[:k]' : la k-ième prise d'un ballon LIBRE (au sol, par un joueur lancé ≥ 1,5 m/s, le ballon à plus de 1 m de lui 0,8 s avant) — filmée
// de 1,2 s avant la prise ; `I = porteur` suit alors le RÉCUPÉRATEUR dès la première image (pas l'ancien porteur qu'il va chercher).
let suitId = null;
if (String(T0).startsWith('recup')) {
  const k = Number(String(T0).split(':')[1] ?? 0);
  const L = await pg.evaluate(() => { const sc = window.__scene, st = sc.state, out = [], hist = []; let ne = 0;
    while (st.t < 90) { const libre = st.phase === 'loose'; sc.update(1 / 60); hist.push({ t: st.t, b: [...st.ball.p], p: st.players.map((q) => [q.p[0], q.p[2]]) }); if (hist.length > 60) hist.shift();
      while (ne < st.events.length) { const e = st.events[ne++]; if ((e.type === 'control' || e.type === 'loose-kept') && libre && !st.restart && st.ball.p[1] < 0.3) { const q = st.players[e.by], h0 = hist[0];
        if (Math.hypot(...q.v) >= 1.5 && h0 && Math.hypot(h0.b[0] - h0.p[e.by][0], h0.b[2] - h0.p[e.by][1]) > 1) out.push({ t: st.t, by: e.by, v: +Math.hypot(...q.v).toFixed(1) }); } } }
    return out; });
  console.log('récupérations trouvées :', L.length, JSON.stringify(L.slice(0, 6)));
  if (!L[k]) { console.log('pas de récupération n°', k); process.exit(1); }
  T0n = Math.max(0.05, L[k].t - 1.2); suitId = L[k].by; await ouvre();
}
// T0 = 'arret[:k]' : le k-ième ARRÊT du gardien (événement 'arrêt') — filmé de 3 s avant (le dribble et le tir qui l'amènent)
if (String(T0).startsWith('arret')) {
  const parts = String(T0).split(':'), espece = isNaN(Number(parts[1])) ? parts[1] : null, k = Number(espece ? parts[2] ?? 0 : parts[1] ?? 0);   // 'arret:bloc:k' : la k-ième de cette espèce
  const L = (await pg.evaluate(() => { const sc = window.__scene, st = sc.state, out = []; let ne = 0;
    while (st.t < 90) { sc.update(1 / 60); while (ne < st.events.length) { const e = st.events[ne++]; if (e.type === 'arrêt') out.push({ t: st.t, kind: e.kind ?? e.mode ?? '?' }); } }
    return out; })).filter((x) => !espece || x.kind === espece);
  console.log('arrêts trouvés :', L.length, JSON.stringify(L.slice(0, 8)));
  if (!L[k]) { console.log("pas d'arrêt n°", k); process.exit(1); }
  T0n = Math.max(0.05, L[k].t - 3); await ouvre();
}
// T0 = 'geste[:k]' : le k-ième GESTE de dribble dans la foulée (feinte de corps, passement, crochet, croqueta — l'événement 'windup' d'un
// geste) — filmé de 1,5 s avant ; `I = porteur` suit alors le dribbleur
if (String(T0).startsWith('geste')) {
  const k = Number(String(T0).split(':')[1] ?? 0);
  const L = await pg.evaluate(() => { const sc = window.__scene, st = sc.state, out = []; let ne = 0;
    while (st.t < 90) { sc.update(1 / 60); while (ne < st.events.length) { const e = st.events[ne++]; if (e.type === 'windup' && e.foulee && e.skill) out.push({ t: st.t, by: e.by, skill: e.skill }); } }
    return out; });
  console.log('gestes trouvés :', L.length, JSON.stringify(L.slice(0, 10)));
  if (!L[k]) { console.log('pas de geste n°', k); process.exit(1); }
  T0n = Math.max(0.05, L[k].t - 1.5); suitId = L[k].by; await ouvre();
}
// T0 = 'face[:issue][:k]' : le k-ième FACE-À-FACE AU PAS (face.js : événements 'face' entre → fin), de cette issue si donnée (mordu, fente-lue,
// fente-manquee, perdu…) — filmé de 1,0 s avant l'entrée ; `I = porteur` suit le porteur du face-à-face
if (String(T0).startsWith('face')) {
  const parts = String(T0).split(':'), issue = parts[1] && isNaN(Number(parts[1])) ? parts[1] : null, k = Number(issue ? parts[2] ?? 0 : parts[1] ?? 0);
  const L = (await pg.evaluate(() => { const sc = window.__scene, st = sc.state, out = []; let ne = 0, cur = null;
    while (st.t < 90) { sc.update(1 / 60); while (ne < st.events.length) { const e = st.events[ne++]; if (e.type !== 'face') continue;
      if (e.phase === 'entre') cur = { t: e.t, by: e.by }; else if (e.phase === 'fin' && cur) { out.push({ ...cur, issue: e.issue, duree: e.duree, feintes: e.feintes, fente: e.fente }); cur = null; } } }
    return out; })).filter((x) => !issue || x.issue === issue);
  console.log('face-à-face trouvés :', L.length, JSON.stringify(L.slice(0, 8)));
  if (!L[k]) { console.log('pas de face-à-face n°', k); process.exit(1); }
  T0n = Math.max(0.05, L[k].t - 1.0); suitId = L[k].by; await ouvre();
}
const P = { T: T0n, i: I === 'porteur' ? -1 : Number(I), suitId, dist: Number(DIST), cam: process.env.CAM ?? 'cote' };   // I = 'porteur' : la caméra suit le porteur du moment
await pg.evaluate((P) => {
  window.__majCam = (s, dt) => { const c = window.__cam ??= { dir: Math.hypot(s.v[0], s.v[1]) > 0.5 ? [s.v[0], s.v[1]] : [Math.cos(s.yaw), Math.sin(s.yaw)], pos: null, sign: null };   // arrêté : son regard
    const k = 1 - Math.exp(-dt / 0.8), vx = s.v[0], vz = s.v[1]; if (Math.hypot(vx, vz) > 0.5) { c.dir[0] += (vx - c.dir[0]) * k; c.dir[1] += (vz - c.dir[1]) * k; }
    const n = Math.hypot(c.dir[0], c.dir[1]) || 1, px = -c.dir[1] / n, pz = c.dir[0] / n;
    // LE SOLEIL DANS LE DOS (le soleil rasant de la cage, lumière directionnelle la plus forte) : face à lui, le rendu sature en blanc (voile, bloom)
    // — le côté de la caméra est celui qui regarde le moins vers lui ; il ne change (coupe) que si le côté tenu finit à contre-jour franc
    const fwd = [c.dir[0] / n, c.dir[1] / n], face = P.cam === 'face';
    const U = (sg) => (face ? [fwd[0] * 0.77 + sg * px * 0.64, fwd[1] * 0.77 + sg * pz * 0.64] : [sg * px, sg * pz]), sol = window.__soleilH ?? [0, 0];
    const ds = (sg) => { const u = U(sg); return u[0] * sol[0] + u[1] * sol[1]; };
    // …et DANS la cage, du côté qui a de la PLACE : bornée contre la grille la caméra se rapprochait et montait (vue de dessus) — le coût d'un côté
    // = la distance perdue à la borne + le contre-jour ; on change de côté (coupe) seulement si l'autre est nettement meilleur
    const A = window.__cage ?? [99, 99], place = (sg) => { const u = U(sg), wx = s.p[0] + u[0] * P.dist, wz = s.p[2] + u[1] * P.dist; return Math.hypot(wx - Math.max(-A[0], Math.min(A[0], wx)), wz - Math.max(-A[1], Math.min(A[1], wz))); };
    const cout = (sg) => place(sg) + 2 * Math.max(0, -ds(sg) - 0.2);
    if (c.sign == null) c.sign = cout(1) <= cout(-1) ? 1 : -1; else if (cout(-c.sign) + 1.0 < cout(c.sign)) { c.sign = -c.sign; c.pos = null; c.tgt = null; }
    const [ux, uz] = U(c.sign);
    let wx = s.p[0] + ux * P.dist, wz = s.p[2] + uz * P.dist; const bx = Math.max(-A[0], Math.min(A[0], wx)), bz = Math.max(-A[1], Math.min(A[1], wz)), perdu = Math.hypot(wx - bx, wz - bz);
    const want = [bx, Math.min(2.2, 1.15 + 0.5 * perdu), bz], kp = 1 - Math.exp(-dt / 0.3), tg = [s.p[0], 0.9, s.p[2]];
    c.pos = c.pos ? c.pos.map((x, j) => x + (want[j] - x) * kp) : want; c.tgt = c.tgt ? c.tgt.map((x, j) => x + (tg[j] - x) * kp) : tg; };
  const sc = window.__scene; window.__cam = null; window.__camPage = P.cam === 'page';
  { let best = null; window.__engine.scene.traverse((o) => { if (o.isDirectionalLight && (!best || o.intensity > best.intensity)) best = o; });   // le soleil
    if (best) { best.updateMatrixWorld(); const a = best.getWorldPosition(best.position.clone()), t = best.target.getWorldPosition(best.position.clone()), h = Math.hypot(a.x - t.x, a.z - t.z) || 1; window.__soleilH = [(a.x - t.x) / h, (a.z - t.z) / h]; }
    const ar = sc.state.area; if (ar) window.__cage = [ar[0] / 2 - 0.4, ar[1] / 2 - 0.4]; }
  window.__suivi = (sc) => { if (P.i >= 0) return sc.players[P.i].sim; if (P.suitId != null) return sc.players.find((q) => q.sim.id === P.suitId).sim; const c = sc.state.possession?.carrier; const pl = sc.players.find((q) => q.sim.id === c); if (pl) window.__dernier = pl.sim; return window.__dernier ?? sc.players[0].sim; };
  for (let t = 0; t < P.T - 1e-6; t += 1 / 60) { sc.update(1 / 60); if (t > P.T - 2) { if (P.cam === 'page') sc._broadcast(1 / 60); else window.__majCam(window.__suivi(sc), 1 / 60); } }
}, P);
const N = Math.round(Number(DUR) * 60 / Number(LENT)); let refaits = 0;   // DUR : la durée filmée (avec T0 = 'conduite', à partir de 0,6 s avant la conduite)
for (let f = 0; f < N; f++) {
  await pg.evaluate(async ({ i, dt }) => { const sc = window.__scene, e = window.__engine; sc.update(dt); window.__majCam(window.__suivi(sc), dt); const c = window.__cam;
    if (window.__camPage) { sc._broadcast(dt); e.controls.target.copy(sc._look); await window.__seekFrame(); return; }   // CAM=page : la régie de la page (ce que voit l'utilisateur)
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
