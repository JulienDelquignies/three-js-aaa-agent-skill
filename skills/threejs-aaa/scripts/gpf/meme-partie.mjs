// L'A/B EST-IL PROPRE ? La même graine avec et sans ?gpf=1 doit jouer la MÊME partie (la sim ne lit pas les specs des gestes
// réactifs) : on compare la suite des événements et l'état du ballon et des joueurs, image par image (empreinte), sur N secondes.
// Usage : node meme-partie.mjs <url sans gpf> [secondes=120] [graine=1]
import { chromium } from '../../../../examples/showcase/node_modules/playwright/index.mjs';
const [URL, SECS = '120', SEED = '1'] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const run = async (extra) => {
  const pg = await b.newPage({ viewport: { width: 320, height: 180 } });
  await pg.goto(`${URL}${URL.includes('?') ? '&' : '?'}seed=${SEED}${extra}`, { waitUntil: 'load', timeout: 240000 });
  await pg.waitForFunction(() => !!window.__scene && window.__scene.players?.length >= 2, null, { timeout: 240000 });
  const r = await pg.evaluate((SECS) => { const sc = window.__scene, st = sc.state, prints = []; const names = [];
    for (const pl of sc.players) { const L = pl.gestureLayer, beg = L.begin.bind(L); L.begin = (spec, ...a) => { names.push(`${st.t.toFixed(2)}:${spec?.name}`); return beg(spec, ...a); }; }
    for (let i = 0; i < SECS * 60; i++) { sc.update(1 / 60); if (i % 60 === 0) prints.push([st.ball.p, ...st.players.map((p) => p.p)].flat().map((v) => v.toFixed(4)).join(',')); }
    return { prints, ev: st.events.map((e) => `${e.t}:${e.type}:${e.by ?? ''}`), names, gpf: sc._gpf ?? null }; }, +SECS);
  await pg.close(); return r;
};
const A = await run(''), B = await run('&gpf=1');
await b.close();
const firstDiff = A.prints.findIndex((p, i) => p !== B.prints[i]);
const evDiff = A.ev.findIndex((e, i) => e !== B.ev[i]);
console.log(`gpf installé : ${JSON.stringify(B.gpf)} · empreintes : ${A.prints.length} / ${B.prints.length}, première différence à ${firstDiff < 0 ? 'aucune' : firstDiff + ' s'} · événements ${A.ev.length} / ${B.ev.length}, premier écart ${evDiff < 0 ? 'aucun' : A.ev[evDiff] + ' ≠ ' + B.ev[evDiff]}`);
const clipsGpf = B.names.filter((n) => /controleInterieur|controleOriente|tacle$/.test(n));
console.log(`gestes remplacés joués : ${clipsGpf.length} (${clipsGpf.slice(0, 8).join(' ')})`);
