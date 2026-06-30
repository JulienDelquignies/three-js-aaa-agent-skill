#!/usr/bin/env node
/**
 * gen-asset.mjs — orchestrate AI 3D generation → download GLB → (optionally) make game-ready.
 *
 * Implemented adapter: MESHY (text-to-3D and image-to-3D), the verified async REST API.
 *   Submit → poll → (refine for PBR) → download model_urls.glb → optional gltf-transform optimize.
 * Every hosted 3D service (Tripo, Rodin/Hyper3D, Replicate, fal.ai) follows the same
 * submit/poll/download shape — see ADAPTERS note at the bottom to add one.
 *
 * Usage:
 *   export MESHY_API_KEY=msy_xxxxx
 *   node gen-asset.mjs --prompt "a mossy stone well" --out ./public/well.glb [--optimize]
 *   node gen-asset.mjs --image https://host/photo.png --out ./public/thing.glb [--optimize]
 *
 * Options:
 *   --prompt <text>     Text-to-3D prompt (or use --image)
 *   --image <url>       Image-to-3D source URL (public or data URI)
 *   --out <file.glb>    Output path (required)
 *   --polycount <n>     Target polycount (default 30000)
 *   --topology <t>      "quad" | "triangle" (default quad — better for games)
 *   --no-pbr            Skip the PBR texture refine pass (geometry only, cheaper)
 *   --optimize          Run gltf-transform game-ready optimization on the result
 *   --poll <sec>        Poll interval seconds (default 5)
 *   --timeout <sec>     Max wait per stage (default 600)
 *
 * No network calls happen without MESHY_API_KEY — the script prints setup steps and exits.
 * Requires Node ≥18 (global fetch). --optimize requires @gltf-transform/cli on PATH.
 */
import { spawnSync } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const MESHY_BASE = 'https://api.meshy.ai';

function parseArgs(argv) {
  const a = { polycount: 30000, topology: 'quad', pbr: true, optimize: false, poll: 5, timeout: 600 };
  for (let i = 0; i < argv.length; i++) {
    const f = argv[i];
    if (f === '--prompt') a.prompt = argv[++i];
    else if (f === '--image') a.image = argv[++i];
    else if (f === '--out') a.out = argv[++i];
    else if (f === '--polycount') a.polycount = parseInt(argv[++i], 10);
    else if (f === '--topology') a.topology = argv[++i];
    else if (f === '--no-pbr') a.pbr = false;
    else if (f === '--optimize') a.optimize = true;
    else if (f === '--poll') a.poll = parseFloat(argv[++i]);
    else if (f === '--timeout') a.timeout = parseFloat(argv[++i]);
    else if (f === '-h' || f === '--help') a.help = true;
  }
  return a;
}

function usage() {
  console.log(`gen-asset.mjs — AI text/image-to-3D → game-ready GLB (Meshy adapter).

Usage:
  export MESHY_API_KEY=msy_xxxxx
  node gen-asset.mjs --prompt "a mossy stone well" --out ./public/well.glb [--optimize]
  node gen-asset.mjs --image https://host/photo.png --out ./out.glb [--optimize]

Options: --prompt | --image, --out (req), --polycount, --topology quad|triangle,
         --no-pbr, --optimize, --poll <sec>, --timeout <sec>
Get a key (Pro tier) at https://www.meshy.ai/settings/api. Docs: https://docs.meshy.ai`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function meshyFetch(path, key, init = {}) {
  const res = await fetch(`${MESHY_BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  const text = await res.text();
  let body;
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  if (!res.ok) {
    const msg = body?.message || body?.error || text || res.statusText;
    throw new Error(`Meshy ${path} → HTTP ${res.status}: ${msg}`);
  }
  return body;
}

// Submit returns a task id in either { result } or { id } depending on endpoint/version.
const taskId = (b) => b.result || b.id || b.task_id || (b.data && (b.data.result || b.data.id));

async function pollTask(endpoint, id, key, { poll, timeout }) {
  const deadline = Date.now() + timeout * 1000;
  // Date.now is fine here (runtime CLI, not a resumable workflow).
  for (;;) {
    const t = await meshyFetch(`${endpoint}/${id}`, key);
    const status = t.status || t.state;
    if (status === 'SUCCEEDED') return t;
    if (status === 'FAILED' || status === 'CANCELED') {
      throw new Error(`task ${id} ${status}: ${t.task_error?.message || JSON.stringify(t.task_error || {})}`);
    }
    process.stdout.write(`\r  ${endpoint.split('/').pop()} ${status || 'PENDING'} ${t.progress ?? 0}%   `);
    if (Date.now() > deadline) throw new Error(`timeout waiting for task ${id}`);
    await sleep(poll * 1000);
  }
}

async function generateMeshy(args, key) {
  let previewEndpoint, createBody, createPath;
  if (args.image) {
    createPath = '/openapi/v1/image-to-3d';
    previewEndpoint = '/openapi/v1/image-to-3d';
    createBody = {
      image_url: args.image, ai_model: 'latest', enable_pbr: args.pbr,
      should_remesh: true, topology: args.topology, target_polycount: args.polycount,
    };
  } else {
    createPath = '/openapi/v2/text-to-3d';
    previewEndpoint = '/openapi/v2/text-to-3d';
    createBody = {
      mode: 'preview', prompt: args.prompt, ai_model: 'latest',
      topology: args.topology, target_polycount: args.polycount,
    };
  }

  console.log(`Submitting ${args.image ? 'image' : 'text'}-to-3D job…`);
  const created = await meshyFetch(createPath, key, { method: 'POST', body: JSON.stringify(createBody) });
  const id = taskId(created);
  if (!id) throw new Error(`no task id in create response: ${JSON.stringify(created)}`);
  let task = await pollTask(previewEndpoint, id, key, args);
  process.stdout.write('\n');

  // Text-to-3D needs a separate refine pass for PBR textures; image-to-3D textures in one shot.
  if (!args.image && args.pbr) {
    console.log('Refining (PBR textures)…');
    const refine = await meshyFetch('/openapi/v2/text-to-3d', key, {
      method: 'POST',
      body: JSON.stringify({ mode: 'refine', preview_task_id: id, enable_pbr: true, hd_texture: true }),
    });
    const rid = taskId(refine);
    task = await pollTask('/openapi/v2/text-to-3d', rid, key, args);
    process.stdout.write('\n');
  }

  const glb = task.model_urls?.glb;
  if (!glb) throw new Error(`no GLB in result model_urls: ${JSON.stringify(task.model_urls || {})}`);
  return glb;
}

async function download(url, outPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, buf);
  return buf.length;
}

function optimize(glbPath) {
  const probe = process.platform === 'win32' ? 'where' : 'which';
  if (spawnSync(probe, ['gltf-transform'], { stdio: 'ignore' }).status !== 0) {
    console.warn('\nnote: gltf-transform not found — skipping --optimize. Install: npm i -g @gltf-transform/cli');
    return;
  }
  const tmp = glbPath.replace(/\.glb$/i, '.opt.glb');
  console.log('Optimizing (gltf-transform: meshopt + KTX2)…');
  const r = spawnSync('gltf-transform',
    ['optimize', glbPath, tmp, '--compress', 'meshopt', '--texture-compress', 'ktx2'],
    { stdio: 'inherit' });
  if (r.status === 0) {
    spawnSync(process.platform === 'win32' ? 'move' : 'mv', [tmp, glbPath], { stdio: 'ignore', shell: true });
    console.log(`✓ Optimized in place: ${glbPath}`);
  } else {
    console.warn('note: optimize failed; keeping the raw GLB.');
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { usage(); process.exit(0); }
  if (!args.out || (!args.prompt && !args.image)) { usage(); process.exit(1); }
  if (!['quad', 'triangle'].includes(args.topology)) {
    console.error(`error: --topology must be quad|triangle`); process.exit(1);
  }

  const key = process.env.MESHY_API_KEY;
  if (!key) {
    console.error('error: MESHY_API_KEY is not set.\n');
    console.error('  1. Get a key (Pro tier) at https://www.meshy.ai/settings/api');
    console.error('  2. export MESHY_API_KEY=msy_xxxxx');
    console.error('  3. re-run this command.\n');
    console.error('Prefer open models / no vendor lock? See reference/10-ai-asset-generation.md');
    console.error('(TRELLIS/TripoSR via Replicate/fal, or self-hosted) — same submit/poll/download shape.');
    process.exit(1);
  }

  const out = resolve(args.out);
  try {
    const glbUrl = await generateMeshy(args, key);
    const bytes = await download(glbUrl, out);
    console.log(`✓ Downloaded GLB: ${out} (${(bytes / 1024).toFixed(0)} KB)`);
    if (args.optimize) optimize(out);
    console.log('\nLoad with GLTFLoader (+ MeshoptDecoder/KTX2Loader if optimized).');
    console.log('See reference/10-ai-asset-generation.md and 01-project-setup.md.');
  } catch (err) {
    console.error(`\nerror: ${err.message}`);
    process.exit(1);
  }
}

main();

/*
 * ADAPTERS — to add another provider, implement the same three steps with its endpoints:
 *   • Rodin/Hyper3D: POST https://api.hyper3d.com/api/v2/rodin → poll /check-status → POST /download
 *   • Tripo:         POST {platform.tripo3d.ai task} type text_to_model → GET task/{id} → output.pbr_model
 *   • Replicate:     POST https://api.replicate.com/v1/predictions {version,input} → poll → output url
 *   • fal.ai:        POST https://queue.fal.run/{model} (Authorization: Key ...) → poll → result url
 * All return a downloadable GLB URL; reuse download() + optimize() unchanged.
 */
