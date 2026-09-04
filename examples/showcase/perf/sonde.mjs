// LA SONDE EMBARQUÉE (?probe=1) lue en headless : quatre configurations de 4 s, le verdict en fps.
import { chromium } from 'playwright';
const [url, dsf = '1.5', w = '1200', h = '800'] = process.argv.slice(2);
const exe = process.env.CHROME || undefined;   // CHROME=/chemin/chrome pour un Chromium hors Playwright
const browser = await chromium.launch({ executablePath: exe, headless: process.env.HEADFUL ? false : true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: +dsf });
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden'), null, { timeout: 120000 });
await page.waitForFunction(() => [...document.querySelectorAll('div')].some((d) => /verdict/.test(d.textContent)), null, { timeout: 120000 });
console.log(await page.evaluate(() => [...document.querySelectorAll('div')].find((d) => /verdict/.test(d.textContent)).textContent));
await browser.close();
