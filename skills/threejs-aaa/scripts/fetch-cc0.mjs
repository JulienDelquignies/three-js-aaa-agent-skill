#!/usr/bin/env node
/**
 * fetch-cc0.mjs — download FREE, CC0, no-API-key assets for a Three.js game.
 *
 * Zero cost, zero paid API, zero dependencies. Uses Poly Haven's free public API
 * (api.polyhaven.com — CC0, no key) for HDRIs and full PBR texture sets. This is the
 * default asset path for a "full Claude Code, 0 surcharge" workflow: Claude writes the
 * procedural code and wires CC0 assets fetched here — nothing billable.
 *
 * Usage:
 *   node fetch-cc0.mjs --list hdris [--search sunset]
 *   node fetch-cc0.mjs --hdri <id> --res 2k --out ./public/env.hdr
 *   node fetch-cc0.mjs --hdri random --res 2k --out ./public/env.hdr
 *   node fetch-cc0.mjs --texture <id> --res 2k --out-dir ./public/textures/rock
 *   node fetch-cc0.mjs --model <id>                 # prints CC0 model download URLs
 *
 * Everything from Poly Haven is CC0 (public domain, no attribution required).
 * Requires Node ≥18 (global fetch).
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';

const PH = 'https://api.polyhaven.com';

function parseArgs(argv) {
  const a = { res: '2k', format: null };
  for (let i = 0; i < argv.length; i++) {
    const f = argv[i];
    if (f === '--list') a.list = argv[++i];
    else if (f === '--search') a.search = (argv[++i] || '').toLowerCase();
    else if (f === '--hdri') a.hdri = argv[++i];
    else if (f === '--texture') a.texture = argv[++i];
    else if (f === '--model') a.model = argv[++i];
    else if (f === '--res') a.res = argv[++i];
    else if (f === '--format') a.format = argv[++i];
    else if (f === '--out') a.out = argv[++i];
    else if (f === '--out-dir') a.outDir = argv[++i];
    else if (f === '-h' || f === '--help') a.help = true;
  }
  return a;
}

function usage() {
  console.log(`fetch-cc0.mjs — free CC0 HDRIs & PBR textures (Poly Haven, no API key).

Usage:
  node fetch-cc0.mjs --list hdris|textures|models [--search <term>]
  node fetch-cc0.mjs --hdri <id|random> --res 1k|2k|4k|8k --out ./public/env.hdr
  node fetch-cc0.mjs --texture <id> --res 1k|2k|4k --out-dir ./public/textures/<name>
  node fetch-cc0.mjs --model <id>          # prints CC0 model file URLs

All assets are CC0 (public domain). Other free CC0 sources: ambientCG (api v2),
Kenney.nl, Quaternius, Mixamo (rig+animate, free). See reference/13-zero-cost-assets.md.`);
}

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} → HTTP ${res.status}`);
  return res.json();
}

async function download(url, outPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${url} → HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, buf);
  return buf.length;
}

// Pick requested resolution, else the closest available (numeric compare on the "Nk" key).
function pickRes(resObj, want) {
  if (resObj[want]) return want;
  const num = (r) => parseFloat(r);
  const avail = Object.keys(resObj).sort((a, b) => num(a) - num(b));
  const wn = num(want);
  let best = avail[0];
  for (const r of avail) if (Math.abs(num(r) - wn) < Math.abs(num(best) - wn)) best = r;
  return best;
}

async function listAssets(type, search) {
  const data = await getJSON(`${PH}/assets?type=${type}`);
  let ids = Object.keys(data);
  if (search) {
    ids = ids.filter((id) => {
      const a = data[id];
      const hay = `${id} ${a.name || ''} ${(a.tags || []).join(' ')} ${(a.categories || []).join(' ')}`.toLowerCase();
      return hay.includes(search);
    });
  }
  console.log(`${ids.length} ${type}${search ? ` matching "${search}"` : ''} (CC0):\n`);
  for (const id of ids.slice(0, 40)) console.log(`  ${id}  —  ${data[id].name || ''}`);
  if (ids.length > 40) console.log(`  … and ${ids.length - 40} more`);
  return ids;
}

async function fetchHdri(id, res, format, out) {
  if (id === 'random') {
    const ids = Object.keys(await getJSON(`${PH}/assets?type=hdris`));
    // Deterministic-ish pick without Math.random dependency: first id (or pass a specific id).
    id = ids[0];
    console.log(`(random) picked HDRI: ${id}`);
  }
  const files = await getJSON(`${PH}/files/${id}`);
  if (!files.hdri) throw new Error(`"${id}" has no HDRI files (is it a texture/model id?)`);
  const r = pickRes(files.hdri, res);
  const fmt = format || (files.hdri[r].hdr ? 'hdr' : 'exr');
  const entry = files.hdri[r][fmt];
  if (!entry) throw new Error(`no ${fmt} at ${r} for ${id} (have: ${Object.keys(files.hdri[r]).join(',')})`);
  const outPath = resolve(out || `./${id}_${r}.${fmt}`);
  const bytes = await download(entry.url, outPath);
  console.log(`✓ ${id} @ ${r} → ${outPath} (${(bytes / 1e6).toFixed(1)} MB)`);
  console.log('Load: new RGBELoader().load(url, hdr => { hdr.mapping = THREE.EquirectangularReflectionMapping; scene.environment = pmrem.fromEquirectangular(hdr).texture; })');
}

// Poly Haven map slug → Three.js material slot + color space.
const TEX_MAPS = [
  { slug: 'Diffuse', file: 'albedo', srgb: true },
  { slug: 'nor_gl', file: 'normal', srgb: false },   // OpenGL normal (what Three.js wants)
  { slug: 'Rough', file: 'roughness', srgb: false },
  { slug: 'AO', file: 'ao', srgb: false },
  { slug: 'Displacement', file: 'height', srgb: false },
  { slug: 'Metal', file: 'metalness', srgb: false },
];

async function fetchTexture(id, res, format, outDir) {
  const files = await getJSON(`${PH}/files/${id}`);
  const dir = resolve(outDir || `./${id}`);
  const got = [];
  for (const m of TEX_MAPS) {
    const slot = files[m.slug];
    if (!slot) continue;
    const r = pickRes(slot, res);
    const formats = slot[r];
    const fmt = format && formats[format] ? format : (formats.jpg ? 'jpg' : Object.keys(formats)[0]);
    const entry = formats[fmt];
    if (!entry?.url) continue;
    const outPath = join(dir, `${m.file}.${fmt}`);
    const bytes = await download(entry.url, outPath);
    got.push({ ...m, path: outPath, res: r });
    console.log(`  ✓ ${m.file} (${m.slug}) @ ${r} → ${(bytes / 1e6).toFixed(1)} MB`);
  }
  if (!got.length) throw new Error(`"${id}" has no texture maps (is it an HDRI/model id?)`);
  console.log(`\n✓ ${got.length} PBR maps in ${dir}`);
  console.log('\nWire-up (correct color spaces — only albedo is sRGB):');
  console.log(`  const load = (f) => new THREE.TextureLoader().load('${dir}/' + f);`);
  console.log('  const mat = new THREE.MeshStandardNodeMaterial({');
  for (const m of got) console.log(`    ${m.file === 'albedo' ? 'map' : m.file === 'height' ? 'displacementMap' : m.file + 'Map'}: load('${m.file}.${m.path.split('.').pop()}'),`);
  console.log('  });');
  console.log('  mat.map.colorSpace = THREE.SRGBColorSpace; // data maps stay linear (NoColorSpace)');
}

async function showModel(id) {
  const files = await getJSON(`${PH}/files/${id}`);
  const kinds = Object.keys(files).filter((k) => ['gltf', 'blend', 'fbx', 'usd'].includes(k));
  if (!kinds.length) throw new Error(`"${id}" has no model files (is it an HDRI/texture id?)`);
  console.log(`CC0 model "${id}" — download URLs (models bundle multiple files; grab the gltf set):\n`);
  for (const kind of kinds) {
    const resObj = files[kind];
    for (const r of Object.keys(resObj)) {
      for (const fmt of Object.keys(resObj[r])) {
        const e = resObj[r][fmt];
        if (e?.url) console.log(`  [${kind} ${r} ${fmt}] ${e.url}`);
      }
    }
  }
  console.log('\nPrefer the gltf/glb set for Three.js; then optimize with gltf-transform (see reference/10).');
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  if (a.help || (!a.list && !a.hdri && !a.texture && !a.model)) { usage(); process.exit(a.help ? 0 : 1); }
  try {
    if (a.list) await listAssets(a.list, a.search);
    else if (a.hdri) await fetchHdri(a.hdri, a.res, a.format, a.out);
    else if (a.texture) await fetchTexture(a.texture, a.res, a.format, a.outDir);
    else if (a.model) await showModel(a.model);
  } catch (err) {
    console.error(`error: ${err.message}`);
    process.exit(1);
  }
}

main();
