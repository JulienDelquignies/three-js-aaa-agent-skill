// page-determinisme.mjs — LA PAGE ET LES BANCS JOUENT-ILS LE MÊME MATCH ? La page (navigateur ; ?capture : elle n'avance que quand on le lui
// demande) avance N images de 0,05 s sans rendu ; Node rejoue les mêmes pas avec le cerveau EMPAQUETÉ (out/cerveau.mjs, celui de la page),
// au même tick ; on compare l'empreinte des positions des 22 joueurs.
//   node bancs/page-determinisme.mjs '<url de la page>?capture&webgl&seed=11' [capture.png] [images=3200]
//   PAGE=<dossier de la vitrine> : où trouver playwright (défaut : ~/DelkIT/skill-l2page/examples/showcase).
// La page doit être construite avec le même paquet (outils : vite.gpf-match.config.mjs de la vitrine) et servie (python3 -m http.server).
// Attendu (3 octobre, cerveau 4b3eea2) : graine 11, 3 200 images → 15 999 pas, h = −1908051876, « MÊME MATCH AU BIT ».
const PAGE = process.env.PAGE ?? '/home/delkit/DelkIT/skill-l2page/examples/showcase';   // la vitrine (le worktree de la page) : son playwright
const { chromium } = await import(PAGE + '/node_modules/playwright/index.mjs');
import { chargerLeCorps } from '../corps.mjs';
import { creerCerveau } from '../out/cerveau.mjs';
const [URL, SHOT, IMAGES = '1200'] = process.argv.slice(2);   // IMAGES : le nombre d'images de 0,05 s (5 pas chacune) ; la graine vient de l'URL
const GRAINE = Number(new globalThis.URL(URL).searchParams.get('seed')) || 7;
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const pg = await b.newPage({ viewport: { width: 960, height: 540 } });
pg.on('pageerror', (e) => console.log('pageerror', String(e).slice(0, 300)));
await pg.goto(URL, { waitUntil: 'load', timeout: 240000 });
await pg.waitForFunction(() => window.__gpf?.players?.length === 22, null, { timeout: 240000 });
const page = await pg.evaluate((IMAGES) => {
  const g = window.__gpf, t0 = performance.now();
  for (let i = 0; i < IMAGES; i++) g.update(0.05);
  const e = g.C.lireEtat(g.M, g.HEAD, g.PER);
  const h = e.joueurs.reduce((h, j) => ((h * 31 + Math.round(j.x * 1000)) * 31 + Math.round(j.y * 1000)) | 0, 0);
  return { pas: g.pas, h, score: e.score, t: e.t, ms: performance.now() - t0, cerveau: g.cerveauN ? g.cerveauMs / g.cerveauN : null, face: g.cerveau?.stats?.().face?.entrees ?? null };
}, Number(IMAGES));
console.log('page', JSON.stringify(page));
if (SHOT) await pg.screenshot({ path: SHOT, timeout: 180000 }).catch(() => {});
await b.close();
// Node : les mêmes pas
const corps = await chargerLeCorps();
corps.lancer({ graine: GRAINE, intentions: true });
const cerveau = creerCerveau({ graine: GRAINE, options: { face: !/[?&]face=0/.test(URL) } });   // les options de la page (le face-à-face, sauf ?face=0)
for (let pas = 0; pas < page.pas;) {
  if (pas % 10 === 0) { const e = corps.etat(); if (e.enJeu && !e.cpa) { const d = cerveau.decider(e); for (const i of d) corps.intention(i.id, i); corps.fautes(d.fautes); } }
  const k = Math.min(page.pas - pas, 10 - (pas % 10));
  corps.avancer(k); pas += k; cerveau.observer(corps.journal());
}
const e = corps.etat();
const h = e.joueurs.reduce((h, j) => ((h * 31 + Math.round(j.x * 1000)) * 31 + Math.round(j.y * 1000)) | 0, 0);
console.log('node', JSON.stringify({ pas: page.pas, h, score: e.score, t: e.t, face: cerveau.stats().face?.entrees ?? null }), h === page.h ? '→ MÊME MATCH AU BIT' : '→ DIFFÉRENT');
