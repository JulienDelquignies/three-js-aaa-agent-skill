// OÙ FILMER : les instants où la couche de geste joue chacun des gestes remplacés, dans le CONTEXTE DE CAPTURE (les drapeaux
// &webgl&capture de capture-geste.mjs décalent la partie par rapport à la page nue), par graine. Usage : node occurrences.mjs <url> [graines] [s=180]
import { chromium } from '../../../../examples/showcase/node_modules/playwright/index.mjs';
const [URL, GR = '1,2,3,4,5,6', SECS = '180'] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const seed of GR.split(',').map(Number)) {
  const pg = await b.newPage({ viewport: { width: 960, height: 540 } });
  await pg.goto(`${URL}${URL.includes('?') ? '&' : '?'}seed=${seed}&webgl&capture`, { waitUntil: 'load', timeout: 240000 });
  await pg.waitForFunction(() => !!window.__scene && !!window.__seekFrame, null, { timeout: 240000 });
  const r = await pg.evaluate((SECS) => { const sc = window.__scene, st = sc.state, out = [];
    for (const pl of sc.players) { const G = pl.gestureLayer, beg = G.begin.bind(G); G.begin = (spec, ...a) => { const n = String(spec?.name ?? ''); if (/^(controleInterieur|controleOriente|tacle)(-gauche)?$/.test(n)) out.push({ n, t: +st.t.toFixed(2), j: sc.players.indexOf(pl), keeper: !!pl.sim.keeper, v: +Math.hypot(...pl.sim.v).toFixed(1) }); return beg(spec, ...a); }; }
    while (st.t < SECS) sc.update(1 / 60);
    return out; }, +SECS);
  const by = (re) => r.filter((x) => re.test(x.n));
  console.log(`graine ${seed} : tacle ${JSON.stringify(by(/^tacle/))}`);
  console.log(`   orienté (champ) ${JSON.stringify(by(/^controleOriente/).map((x, k) => ({ k, ...x })).filter((x) => !x.keeper))}`);
  console.log(`   intérieur (champ) ${JSON.stringify(by(/^controleInterieur/).map((x, k) => ({ k, ...x })).filter((x) => !x.keeper).slice(0, 8))}`);
  await pg.close();
}
await b.close();
