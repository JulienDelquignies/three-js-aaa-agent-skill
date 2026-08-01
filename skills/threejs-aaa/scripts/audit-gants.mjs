#!/usr/bin/env node
// audit-gants.mjs — LE GANT SUR LE BALLON, DANS LE MONDE COMPOSÉ (charte, loi 8 : une clause qui
// ne mesure pas le résultat composé mesure une ombre).
//
// La sim résolvait des arrêts VRAIS (prise/claquette au registre) pendant que le rendu montrait
// un gant à 1,0-2,1 m du ballon (p50 mesuré AVANT : 1,67 m) — l'arrêt était vrai en sim, faux
// aux gants. La chaîne qui l'a fermé : warp de contact 3D (planWarp3, mêmes quatre lois que la
// frappe), warp de RACINE (le bassin complète la détente quand l'épaule est hors de portée de
// bras), jambes du plongeon à poids plein (un corps balistique n'est pas un corps qui court),
// et l'acte ownsBody qui garde son clip (la prise émettait une réception → « amorti » écrasait
// la détente, le gardien se REDRESSAIT à l'instant de l'arrêt).
//
// Cet instrument rejoue le match réduit en navigateur headless (comme audit-membres) et mesure,
// À L'IMAGE de chaque événement d'arrêt, la distance du gant le plus proche au centre du ballon.
// Sabotage nommé : window.__sabotage = 'warp-gant' coupe le warp du gant ET de la racine dans la
// scène — la clause doit mordre, sinon elle ne mesure rien.
//
// Exécution : build requis (cd examples/showcase && npm run build), puis node audit-gants.mjs
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const REPO = join(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const SHOW = join(REPO, 'examples', 'showcase');
const { chromium } = require(require.resolve('playwright', { paths: [SHOW] }));

const root = join(SHOW, 'dist');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.glb': 'model/gltf-binary', '.hdr': 'application/octet-stream', '.wasm': 'application/wasm', '.css': 'text/css' };
const server = http.createServer(async (req, res) => {
  try {
    const p = join(root, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
    const d = await readFile(p);
    res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
    res.end(d);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });

/** Rejouer `secs` de match (seed donnée) et rendre une ligne par arrêt du gardien :
 *  { mode, d (gant-ballon, m), at (horloge du plongeon à l'arrêt), hipsY (hauteur des hanches) }. */
async function mesurer(seed, secs, sabotage) {
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  if (sabotage) await page.addInitScript((s) => { window.__sabotage = s; }, sabotage);
  await page.goto(`http://127.0.0.1:${server.address().port}/match.html?q=low&seed=${seed}&capture&webgl`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__rondo && window.__engine, null, { timeout: 240000 });
  const rows = await page.evaluate(async (frames) => {
    const S = window.__rondo;
    const out = [];
    const touches = [];
    let nEv = 0;
    for (let f = 0; f < frames; f++) {
      S.update(1 / 60);
      const evs = S.state.events;
      // …les TOUCHES DE CONDUITE : mesurer le pied 0,1 s après l'événement (pic de l'enveloppe)
      for (const pl of S.players) {
        if (pl._auditTouchAt === f) {
          const b = S.state.ball.p;
          let best = 99;
          pl.model.traverse((o) => { if (o.isBone && /Foot$/i.test(o.name)) { const w = new (Object.getPrototypeOf(pl.model.position).constructor)(); o.getWorldPosition(w); best = Math.min(best, Math.hypot(w.x - b[0], w.y - b[1], w.z - b[2])); } });
          touches.push(+best.toFixed(2));
          pl._auditTouchAt = null;
        }
      }
      for (; nEv < evs.length; nEv++) {
        const e = evs[nEv];
        if (e.type === 'touche') {
          const pl = S.players.find((q) => q.sim.id === e.by);
          if (pl) pl._auditTouchAt = f + 6;
          continue;
        }
        if (e.type !== 'arrêt' || (e.mode !== 'prise' && e.mode !== 'claquette')) continue;
        const pl = S.players.find((q) => q.sim.id === e.by);
        if (!pl) continue;
        const b = S.state.ball.p;
        let d = 99;
        pl.model.traverse((o) => {
          if (!o.isBone || !/Hand$/i.test(o.name)) return;
          const w = new (Object.getPrototypeOf(pl.model.position).constructor)();
          o.getWorldPosition(w);
          d = Math.min(d, Math.hypot(w.x - b[0], w.y - b[1], w.z - b[2]));
        });
        let hipsY = null;
        pl.model.traverse((o) => { if (o.isBone && /Hips$/i.test(o.name) && hipsY == null) { const v = new (Object.getPrototypeOf(pl.model.position).constructor)(); o.getWorldPosition(v); hipsY = v.y; } });
        out.push({ mode: e.mode, d: +d.toFixed(2), at: pl.sim.act ? +pl.sim.act.t.toFixed(2) : null, hipsY: hipsY != null ? +hipsY.toFixed(2) : null });
      }
    }
    return { rows: out, touches };
  }, Math.round(secs * 60));
  await page.close();
  return rows;
}

const p50 = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length * 0.5)] : null; };

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };

// ---- le monde vrai : 4 graines × 120 s (les mêmes que la sonde de développement)
const vrais = []; const touchesV = [];
for (const seed of [3, 7, 11, 1]) { const m = await mesurer(seed, 120, null); vrais.push(...m.rows); touchesV.push(...m.touches); }
const dsV = vrais.map((r) => r.d);
console.log(`monde vrai : ${vrais.length} arrêts — ${JSON.stringify(vrais)}`);

// 1. EXISTENCE : l'instrument a vu des arrêts (sinon toutes les clauses suivantes jugent le vide)
ok('des arrêts du gardien se produisent et se mesurent (≥ 4 sur 4 graines × 120 s)', vrais.length >= 4, `${vrais.length}`);

// 2. LE GANT EST SUR LE BALLON : p50 ≤ 0,6 m (mesuré 0,27 — standoff 0,16 + rayon 0,11 = contact ;
//    la bande absorbe le bruit de re-distribution, l'arrêt-réflexe résolu en 2 images reste un
//    résiduel connu et la médiane y est robuste)
ok('à l\'instant de l\'arrêt, le gant le plus proche touche le ballon (p50 ≤ 0,6 m)', p50(dsV) != null && p50(dsV) <= 0.6, `p50 ${p50(dsV)}`);

// 3. LE CORPS SE COUCHE SUR LES ARRÊTS DÉVELOPPÉS : sur toute détente qui a eu le temps de vivre
//    (arrêt à t ≥ 0,3 de l'acte), les hanches sont DESCENDUES (p50 ≤ 0,7 m — debout = 0,9 ;
//    mesuré 0,2-0,3). C'est la clause anti-régression du canal hanches : wLegs éteint ou clip
//    écrasé par l'amorti = gardien debout, elle vire au rouge.
const devs = vrais.filter((r) => (r.at ?? 0) >= 0.3 && r.hipsY != null);
ok('sur les arrêts développés (t ≥ 0,3), le corps est couché (hanches p50 ≤ 0,7 m)', devs.length === 0 || p50(devs.map((r) => r.hipsY)) <= 0.7, `p50 ${devs.length ? p50(devs.map((r) => r.hipsY)) : '—'} sur ${devs.length}`);

// ---- LE PIED DE CONDUITE TOUCHE SON BALLON (le warp de touche — quatrième consommateur ;
// retour utilisateur : « il ne touche jamais le ballon », le contact sim était invisible)
ok(`aux touches de conduite, le pied le plus proche est AU ballon (p50 ${p50(touchesV)} ≤ 0,45 m sur ${touchesV.length})`,
  touchesV.length >= 30 && p50(touchesV) <= 0.45);
{
  const tSab = [];
  for (const seed of [3, 7]) tSab.push(...(await mesurer(seed, 120, 'warp-touche')).touches);
  ok(`sabotage « warp-touche » : sans lui le pied re-flotte (p50 ${p50(tSab)} ≥ ${(p50(touchesV) + 0.06).toFixed(2)})`,
    p50(tSab) != null && p50(tSab) >= p50(touchesV) + 0.06);
}

// ---- SABOTAGE NOMMÉ 'warp-gant' : couper le warp (gant + racine) doit ROUVRIR l'écart
const sab = [];
for (const seed of [3, 7]) sab.push(...(await mesurer(seed, 120, 'warp-gant')).rows);
const dsS = sab.map((r) => r.d);
console.log(`monde saboté : ${sab.length} arrêts — p50 ${p50(dsS)}`);
ok('sabotage « warp-gant » : sans le warp, le gant re-flotte loin du ballon (p50 ≥ p50 vrai + 0,25)',
  p50(dsS) != null && p50(dsV) != null && p50(dsS) >= p50(dsV) + 0.25, `saboté ${p50(dsS)} vs vrai ${p50(dsV)}`);

await browser.close();
server.close();
console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
