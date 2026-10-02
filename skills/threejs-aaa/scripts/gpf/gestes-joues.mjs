// LES GESTES QUE LE DUEL JOUE VRAIMENT : chaque spec passée à la couche de geste (gestureLayer.begin), par nom, compté sur
// plusieurs graines — pour savoir quelles espèces une conversion remplace en jeu. Usage : node gestes-joues.mjs <url> [secondes=180] [graines=1,2,3]
import { chromium } from '../../../../examples/showcase/node_modules/playwright/index.mjs';
const [URL, SECS = '180', GR = '1,2,3'] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const tot = {};
for (const seed of GR.split(',').map(Number)) {
  const pg = await b.newPage({ viewport: { width: 320, height: 180 } });
  await pg.goto(`${URL}${URL.includes('?') ? '&' : '?'}seed=${seed}`, { waitUntil: 'load', timeout: 240000 });
  await pg.waitForFunction(() => !!window.__scene && window.__scene.players?.length >= 2, null, { timeout: 240000 });
  const r = await pg.evaluate((SECS) => {
    const sc = window.__scene, out = {}, ex = {};
    for (const pl of sc.players) { const L = pl.gestureLayer, beg = L.begin.bind(L);
      L.begin = (spec, ...a) => { const n = String(spec?.name ?? '?').replace(/-gauche$/, ''); out[n] = (out[n] ?? 0) + 1; (ex[n] ??= []).length < 4 && ex[n].push(+sc.state.t.toFixed(2)); return beg(spec, ...a); }; }
    for (let i = 0; i < SECS * 60; i++) sc.update(1 / 60);
    return { out, ex };
  }, +SECS);
  for (const [k, v] of Object.entries(r.out)) tot[k] = (tot[k] ?? 0) + v;
  console.log(`graine ${seed} :`, JSON.stringify(Object.fromEntries(Object.entries(r.out).sort((a, b) => b[1] - a[1]))));
  console.log('   premiers instants :', JSON.stringify(r.ex));
  await pg.close();
}
console.log('TOTAL', JSON.stringify(Object.fromEntries(Object.entries(tot).sort((a, b) => b[1] - a[1]))));
await b.close();
