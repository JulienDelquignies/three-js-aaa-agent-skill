#!/usr/bin/env node
/**
 * capture.mjs — run a Three.js build in a headless browser, screenshot it, and read back a
 * performance snapshot. This closes the perception loop: an agent can SEE its render, critique it
 * against a rubric (reference/16-visual-qa.md), fix, and repeat — plus gate on a draw-call budget.
 *
 * Usage:
 *   node capture.mjs --url http://localhost:5173 --out shot.png [--webgl] [--wait 4000]
 *   node capture.mjs --dir ./dist --out shot.png [--webgl] [--max-draws 100]
 *
 * Options:
 *   --url <url>        URL of a running dev/preview server
 *   --dir <dist>       Static build dir to serve locally (zero-dep server) and capture
 *   --out <file.png>   Screenshot path (default ./capture.png)
 *   --webgl            Append ?webgl (force WebGL2 path — use where headless WebGPU is broken)
 *   --wait <ms>        Settle time after boot before the shot (default 4000)
 *   --viewport <WxH>   Viewport size (default 1280x720)
 *   --max-draws <n>    Fail (exit 1) if renderer.info.render.calls exceeds n (perf gate)
 *   --expr <js>        Optional JS evaluated in page; result printed (e.g. custom probes)
 *
 * Reads the page's window.__engine.renderer.info if present. Playwright + a Chromium are required
 * (pre-installed in the Claude Code remote environment at /opt/pw-browsers/chromium).
 */
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

function parseArgs(argv) {
  const a = { out: './capture.png', wait: 4000, viewport: '1280x720' };
  for (let i = 0; i < argv.length; i++) {
    const f = argv[i];
    if (f === '--url') a.url = argv[++i];
    else if (f === '--dir') a.dir = argv[++i];
    else if (f === '--out') a.out = argv[++i];
    else if (f === '--webgl') a.webgl = true;
    else if (f === '--wait') a.wait = parseInt(argv[++i], 10);
    else if (f === '--viewport') a.viewport = argv[++i];
    else if (f === '--max-draws') a.maxDraws = parseInt(argv[++i], 10);
    else if (f === '--expr') a.expr = argv[++i];
    else if (f === '-h' || f === '--help') a.help = true;
  }
  return a;
}

function usage() {
  console.log(`capture.mjs — screenshot a Three.js build + read a perf snapshot (visual QA loop).

Usage:
  node capture.mjs --url http://localhost:5173 --out shot.png [--webgl]
  node capture.mjs --dir ./dist --out shot.png [--webgl] [--max-draws 100]

See reference/16-visual-qa.md for the screenshot → critique → fix rubric.`);
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.hdr': 'application/octet-stream',
  '.glb': 'model/gltf-binary', '.ktx2': 'image/ktx2', '.svg': 'image/svg+xml' };

function serveDir(dir) {
  return new Promise((res) => {
    const server = createServer(async (req, resp) => {
      try {
        let p = decodeURIComponent(req.url.split('?')[0]);
        if (p === '/' || p.endsWith('/')) p += 'index.html';
        const file = join(dir, p);
        if (!file.startsWith(resolve(dir)) || !existsSync(file)) { resp.writeHead(404).end('not found'); return; }
        const body = await readFile(file);
        resp.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' }).end(body);
      } catch (e) { resp.writeHead(500).end(String(e)); }
    });
    server.listen(0, '127.0.0.1', () => res({ server, port: server.address().port }));
  });
}

async function loadPlaywright() {
  const candidates = ['playwright', '/opt/node22/lib/node_modules/playwright/index.js'];
  for (const c of candidates) {
    try { const m = await import(c); return m.chromium || m.default?.chromium; } catch { /* next */ }
  }
  throw new Error('Playwright not found. In the Claude Code remote env it is pre-installed; else: npm i -D playwright');
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  if (a.help || (!a.url && !a.dir)) { usage(); process.exit(a.help ? 0 : 1); }
  const [vw, vh] = a.viewport.split('x').map(Number);

  let served = null;
  let url = a.url;
  if (a.dir) {
    if (!existsSync(a.dir)) { console.error(`error: dir not found: ${a.dir} (run "npm run build" first?)`); process.exit(1); }
    served = await serveDir(resolve(a.dir));
    url = `http://127.0.0.1:${served.port}/`;
  }
  if (a.webgl) url += (url.includes('?') ? '&' : '?') + 'webgl';

  const chromium = await loadPlaywright();
  const exe = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
  const browser = await chromium.launch({
    executablePath: exe,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist',
      '--enable-unsafe-swiftshader', '--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: vw, height: vh } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    // Wait for the engine to boot if the starter exposes it; otherwise just settle.
    await page.waitForFunction(() => !window.__engine || (window.__engine && window.__engine.renderer), { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(a.wait);

    const info = await page.evaluate(() => {
      const e = window.__engine;
      if (!e?.renderer) return null;
      const r = e.renderer;
      return {
        backend: r.backend?.constructor?.name || null,
        calls: r.info?.render?.calls ?? null,
        triangles: r.info?.render?.triangles ?? null,
        geometries: r.info?.memory?.geometries ?? null,
        textures: r.info?.memory?.textures ?? null,
      };
    });

    await page.screenshot({ path: resolve(a.out) });
    console.log(`✓ screenshot → ${resolve(a.out)} (${vw}x${vh})`);

    if (errors.length) console.log(`\npage errors:\n  ${errors.join('\n  ')}`);
    if (info) {
      console.log(`\nrender snapshot:`);
      console.log(`  backend    ${info.backend}`);
      console.log(`  draw calls ${info.calls}`);
      console.log(`  triangles  ${info.triangles}`);
      console.log(`  geometries ${info.geometries}   textures ${info.textures}`);
      await writeFile(resolve(a.out).replace(/\.png$/i, '.perf.json'), JSON.stringify(info, null, 2));
    } else {
      console.log('\n(no window.__engine.renderer found — perf snapshot skipped)');
    }
    if (a.expr) {
      const r = await page.evaluate((code) => eval(code), a.expr).catch((e) => `expr error: ${e.message}`);
      console.log(`\nexpr → ${JSON.stringify(r)}`);
    }

    let code = 0;
    if (errors.length) { console.log('\n✗ page had runtime errors'); code = 1; }
    if (a.maxDraws != null && info?.calls != null && info.calls > a.maxDraws) {
      console.log(`\n✗ perf gate: ${info.calls} draw calls > budget ${a.maxDraws}`); code = 1;
    } else if (a.maxDraws != null && info?.calls != null) {
      console.log(`\n✓ perf gate: ${info.calls} ≤ ${a.maxDraws} draw calls`);
    }
    await browser.close();
    served?.server.close();
    process.exit(code);
  } catch (err) {
    console.error(`error: ${err.message}`);
    await browser.close().catch(() => {});
    served?.server.close();
    process.exit(1);
  }
}

main();
