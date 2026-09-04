// L'INSTRUMENT AVANT/APRÈS : ouvre une page du build (serveur preview), attend le chargement, jette 3 s, puis lit 10 s
// d'images : intervalles rAF (mur) et le journal moteur (logique ms / rendu ms) — p50 / p95 / p99, jamais de moyenne.
// usage : node mesure.mjs <url> [dsf=1.5] [w=1200] [h=800] [secs=10]
import { chromium } from 'playwright';
const [url, dsf = '1.5', w = '1200', h = '800', secs = '10'] = process.argv.slice(2);
const q = (a, p) => { const b = [...a].sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(p * (b.length - 1)))] ?? 0; };
const exe = process.env.CHROME || undefined;   // CHROME=/chemin/chrome pour un Chromium hors Playwright
const browser = await chromium.launch({ executablePath: exe, headless: process.env.HEADFUL ? false : true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: +dsf });
const logs = []; page.on('console', (m) => { const t = m.text(); if (/Shader Error|ERROR: 0:|pipeline|tier|marche|dynres|WebGL|WebGPU|backend/i.test(t)) logs.push(t.slice(0, 220)); });
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden') && window.__engine, null, { timeout: 120000 });
await page.waitForTimeout(3000);
const t0 = await page.evaluate(() => performance.now());
const stamps = await page.evaluate((ms) => new Promise((res) => { const a = []; const f = (t) => { a.push(t); if (t - a[0] < ms) requestAnimationFrame(f); else res(a); }; requestAnimationFrame(f); }), +secs * 1000);
const J = await page.evaluate((from) => { const J = window.__engine.perf ?? { n: 0, at: [], upd: [], ren: [] }; const upd = [], ren = []; for (let k = 0; k < J.n; k++) if (J.at[k] >= from) { upd.push(J.upd[k]); ren.push(J.ren[k]); } const e = window.__engine; const r = e.renderer;
  return { upd, ren, dpr: r.getPixelRatio?.(), backend: r.backend?.isWebGPUBackend ? 'WebGPU' : 'WebGL2', tier: window.__scene?._tier, marche: window.__scene?._ladder?.rung ?? null, declared: window.__scene?.pipeline?.declared ?? null, pipe: window.__scene?._reports?.pipeline ?? null, errs: (r.userData?.shaderErrors ?? []).length, log: window.__scene?._drLog ?? null }; }, t0);
const iv = stamps.slice(1).map((t, i) => t - stamps[i]);
const fmt = (a) => `p50 ${q(a, .5).toFixed(1)} / p95 ${q(a, .95).toFixed(1)} / p99 ${q(a, .99).toFixed(1)} ms`;
console.log(`${url}\n  backend ${J.backend} | tier ${J.tier} | marche ${J.marche} | dpr ${J.dpr} | passes ${JSON.stringify(J.declared)} | shaders refusés ${J.errs} | contrôle ${J.pipe ? (J.pipe.ok ? 'ok' : 'ROUGE : ' + J.pipe.issues.join(' ; ').slice(0, 200)) : '-'}\n  image (rAF, ${iv.length} img) : ${fmt(iv)}  → fps p50 ${(1000 / q(iv, .5)).toFixed(1)}, fps@p95 ${(1000 / q(iv, .95)).toFixed(1)}\n  canal CPU logique : ${fmt(J.upd)} (${J.upd.length} img)\n  canal rendu (mur) : ${fmt(J.ren)}`);
if (J.log) console.log('  journal dynres :', JSON.stringify(J.log).slice(0, 400));
if (logs.length) console.log('  console :', logs.slice(0, 8).join('\n            '));
await browser.close();
