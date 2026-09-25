// Les fenêtres de CONDUITE EN VIRAGE dans la page (porteur, lacet ≥ 2 rad/s pendant ≥ 0,3 s, hors geste) — pour les filmer.
import { chromium } from '../../../../examples/showcase/node_modules/playwright/index.mjs';
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const pg = await b.newPage({ viewport: { width: 320, height: 180 } });
await pg.goto(process.argv[2], { waitUntil: 'load', timeout: 240000 });
await pg.waitForFunction(() => !!window.__scene, null, { timeout: 240000 });
console.log(await pg.evaluate((S) => { const sc = window.__scene, st = sc.state, out = []; let o = null;
  for (let i = 0; i < S * 60; i++) { sc.update(1 / 60); const c = st.possession?.carrier, p = c >= 0 ? st.players[c] : null, yr = Math.abs(p?._pas?.yawRate ?? 0);
    const ok = st.phase === 'carry' && p && !p.act && yr >= 2 && p.speed >= 1.5;
    if (ok && !o) o = { t0: st.t, j: c, yMax: yr }; else if (ok) o.yMax = Math.max(o.yMax, yr);
    else if (o) { if (st.t - o.t0 >= 0.3) out.push(`t ${o.t0.toFixed(2)} → ${st.t.toFixed(2)} joueur ${o.j} lacet max ${o.yMax.toFixed(1)} rad/s`); o = null; } }
  return out.join('\n'); }, +(process.argv[3] ?? 60)));
await b.close();
