#!/usr/bin/env node
// playmode-mcp.mjs — the PLAY MODE of the agent editor as an MCP server (stdio, zero-dep JSON-RPC:
// the MCP protocol is JSON-RPC 2.0). It keeps ONE game session alive in headless Chromium and gives
// the agent live tools — no rebuild/relaunch between questions, iteration drops from ~a minute to
// seconds:
//   play_open       start/replace the session on a built dist (?debug=1 gizmos included by default)
//   play_state      site, character position, phone/game-state summary
//   play_screenshot render N sim frames, save a PNG (optional free camera pose), return the path
//   play_eval       run JS in the page against window.__carriere / __engine (the escape hatch)
//   play_perf       renderer.info snapshot (draw calls, triangles)
//   play_close      shut the session down
// Env: PLAYMODE_DIST (default dist), PLAYMODE_OUT (screenshot dir), PLAYWRIGHT chromium at
// /opt/pw-browsers/chromium (the Claude Code env default) or PLAYMODE_CHROMIUM.
// Register in .mcp.json:  { "mcpServers": { "playmode": { "command": "node", "args": ["skills/threejs-aaa/scripts/playmode-mcp.mjs"] } } }
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const OUT = process.env.PLAYMODE_OUT || resolve('playmode-shots');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.glb': 'model/gltf-binary', '.hdr': 'application/octet-stream', '.wasm': 'application/wasm' };
let server = null, browser = null, page = null, opened = null;

async function ensureServer(root) {
  if (server) { server.close(); server = null; }
  server = http.createServer(async (req, res) => {
    try {
      const p = join(root, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
      const d = await readFile(p);
      res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' }); res.end(d);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return server.address().port;
}

async function ensureBrowser() {
  if (browser) return browser;
  const require = createRequire(import.meta.url);
  let chromium;
  for (const base of [process.cwd(), resolve(process.cwd(), 'examples/showcase'), import.meta.dirname]) {
    try { ({ chromium } = require(require.resolve('playwright', { paths: [base] }))); break; } catch {}
  }
  if (!chromium) throw new Error('playwright introuvable — npm i -D playwright dans le projet');
  browser = await chromium.launch({
    executablePath: process.env.PLAYMODE_CHROMIUM || '/opt/pw-browsers/chromium',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
  });
  return browser;
}

const TOOLS = [
  { name: 'play_open', description: 'Ouvre (ou remplace) la session de jeu persistante sur un build. args: {dist?: string (dossier dist), page?: string (défaut carriere.html), params?: string (défaut "niveau=3&debug=1"), width?, height?}. Toujours ?capture&webgl (boucle pilotée par play_screenshot).', inputSchema: { type: 'object', properties: { dist: { type: 'string' }, page: { type: 'string' }, params: { type: 'string' }, width: { type: 'number' }, height: { type: 'number' } } } },
  { name: 'play_state', description: 'État de la partie en cours : site, position du personnage, forme/cash, assis ou non, scène prête.', inputSchema: { type: 'object', properties: {} } },
  { name: 'play_screenshot', description: 'Avance la simulation de N frames (défaut 5) puis capture un PNG. args: {name?, frames?, camera?: {pos:[x,y,z], look:[x,y,z]} pour une caméra libre (sinon caméra du jeu)}. Retourne le chemin du PNG (à lire avec Read).', inputSchema: { type: 'object', properties: { name: { type: 'string' }, frames: { type: 'number' }, camera: { type: 'object', properties: { pos: { type: 'array', items: { type: 'number' } }, look: { type: 'array', items: { type: 'number' } } } } } } },
  { name: 'play_eval', description: 'Exécute du JS dans la page (async supporté) avec S=window.__carriere, E=window.__engine déjà liés. Retourne le résultat JSON. Ex: "S.travelTo(\'club\'); return S.site". L\'échappatoire universelle : téléporter, interagir (S.sys.interact()), lire les contrats, régler un paramètre.', inputSchema: { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] } },
  { name: 'play_perf', description: 'Instantané perf du renderer : draw calls, triangles, géométries/textures en mémoire.', inputSchema: { type: 'object', properties: {} } },
  { name: 'play_close', description: 'Ferme la session (navigateur + serveur).', inputSchema: { type: 'object', properties: {} } },
];

const needPage = () => { if (!page) throw new Error('aucune session — appeler play_open d’abord'); };

async function callTool(name, a = {}) {
  if (name === 'play_open') {
    const dist = resolve(a.dist || process.env.PLAYMODE_DIST || 'examples/showcase/dist');
    const port = await ensureServer(dist);
    await ensureBrowser();
    if (page) await page.close().catch(() => {});
    page = await browser.newPage({ viewport: { width: a.width || 1024, height: a.height || 576 } });
    const params = a.params ?? 'niveau=3&debug=1';
    const url = `http://127.0.0.1:${port}/${a.page || 'carriere.html'}?${params}&capture&webgl`;
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__carriere?.ctrl && window.__engine, null, { timeout: 120000 });
    opened = { url, dist };
    return { ok: true, url, dist };
  }
  needPage();
  if (name === 'play_state') {
    return page.evaluate(() => {
      const S = window.__carriere;
      return {
        site: S.site, pos: [S.ctrl.pos.x, S.ctrl.pos.y, S.ctrl.pos.z].map((v) => +v.toFixed(2)),
        seated: !!S.ctrl.seated, driving: !!S._drive, phoneOpen: !!S.phone?.isOpen, cityView: !!S.cityView?.active,
        forme: S.state?.forme, cash: S.state?.cash, car: S.state?.car?.name, unread: S.state?.unread,
      };
    });
  }
  if (name === 'play_screenshot') {
    await mkdir(OUT, { recursive: true });
    const file = join(OUT, `${a.name || 'shot'}.png`);
    await page.evaluate(async ({ frames, camera }) => {
      const S = window.__carriere, E = window.__engine;
      for (let i = 0; i < (frames ?? 5); i++) S.update(1 / 60);
      if (camera?.pos) { E.camera.position.set(...camera.pos); E.camera.lookAt(...(camera.look || [0, 0, 0])); }
      if (E.postfx) await E.postfx.render(); else E.renderer.render(E.scene, E.camera);
      S.gizmos?.update(E.renderer);
    }, { frames: a.frames, camera: a.camera || null });
    await page.screenshot({ path: file });
    return { ok: true, path: file };
  }
  if (name === 'play_eval') {
    const r = await page.evaluate(async (code) => {
      const S = window.__carriere, E = window.__engine;
      const f = new Function('S', 'E', `return (async () => { ${code} })()`);
      try { const v = await f(S, E); return { ok: true, value: v === undefined ? null : JSON.parse(JSON.stringify(v ?? null)) }; }
      catch (e) { return { ok: false, error: String(e) }; }
    }, a.code);
    return r;
  }
  if (name === 'play_perf') {
    return page.evaluate(() => {
      const i = window.__engine.renderer.info;
      return { calls: i.render.calls, triangles: i.render.triangles, geometries: i.memory?.geometries, textures: i.memory?.textures };
    });
  }
  if (name === 'play_close') {
    await page?.close().catch(() => {}); page = null;
    await browser?.close().catch(() => {}); browser = null;
    server?.close(); server = null; opened = null;
    return { ok: true };
  }
  throw new Error(`outil inconnu: ${name}`);
}

// ---- MCP over stdio (JSON-RPC 2.0, newline-delimited)
const send = (m) => process.stdout.write(JSON.stringify(m) + '\n');
let buf = '';
process.stdin.on('data', async (chunk) => {
  buf += chunk;
  let nl;
  while ((nl = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
    if (!line) continue;
    let msg; try { msg = JSON.parse(line); } catch { continue; }
    const { id, method, params } = msg;
    try {
      if (method === 'initialize') {
        send({ jsonrpc: '2.0', id, result: { protocolVersion: params?.protocolVersion || '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'playmode', version: '1.0.0' } } });
      } else if (method === 'notifications/initialized') {
        // notification — no reply
      } else if (method === 'tools/list') {
        send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
      } else if (method === 'tools/call') {
        const r = await callTool(params.name, params.arguments || {});
        send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(r) }] } });
      } else if (id !== undefined) {
        send({ jsonrpc: '2.0', id, error: { code: -32601, message: `méthode inconnue: ${method}` } });
      }
    } catch (e) {
      if (id !== undefined) send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify({ ok: false, error: String(e.message || e) }) }], isError: true } });
    }
  }
});
process.stdin.on('end', () => { callTool('play_close').finally(() => process.exit(0)); });
