#!/usr/bin/env node
/**
 * procgen.mjs — generate a procedural prop as a .glb from a JSON spec.
 *
 * Zero dependencies: builds primitive geometry (box/cylinder/sphere), optional random
 * "greebles" (small surface boxes) with a seeded PRNG, merges everything into one mesh,
 * and writes a valid binary glTF (GLB) by hand. Runs anywhere Node ≥18 is available — no
 * `npm install`, no Three.js, no WebGL. For boolean CSG (carving), use three-bvh-csg inside
 * the app instead (see reference/06-procedural-geometry.md).
 *
 * Usage:
 *   node procgen.mjs --spec <spec.json> --out <out.glb>
 *   node procgen.mjs --demo crate --out crate.glb        # built-in demo specs
 *
 * Spec format:
 * {
 *   "name": "crate",
 *   "material": { "color": [0.55,0.4,0.25], "metalness": 0.0, "roughness": 0.8 },
 *   "parts": [
 *     { "type": "box", "size": [1,1,1], "position": [0,0,0], "rotation": [0,0,0] },
 *     { "type": "cylinder", "radius": 0.5, "height": 2, "radialSegments": 24, "position": [0,1,0] },
 *     { "type": "sphere", "radius": 0.4, "widthSegments": 24, "heightSegments": 16 }
 *   ],
 *   "greebles": { "count": 40, "minSize": 0.04, "maxSize": 0.12, "seed": 7 }
 * }
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ---------- args ----------
function parseArgs(argv) {
  const a = { spec: null, out: null, demo: null };
  for (let i = 0; i < argv.length; i++) {
    const f = argv[i];
    if (f === '--spec') a.spec = argv[++i];
    else if (f === '--out') a.out = argv[++i];
    else if (f === '--demo') a.demo = argv[++i];
    else if (f === '-h' || f === '--help') a.help = true;
  }
  return a;
}

function usage() {
  console.log(`procgen.mjs — generate a procedural prop GLB from a JSON spec.

Usage:
  node procgen.mjs --spec <spec.json> --out <out.glb>
  node procgen.mjs --demo <crate|pillar|rock> --out <out.glb>

Parts: box {size:[x,y,z]}, cylinder {radius,height,radialSegments},
       sphere {radius,widthSegments,heightSegments}. Each takes position/rotation/scale.
Greebles: {count, minSize, maxSize, seed} scatters small boxes over the bounding box faces.`);
}

// ---------- seeded PRNG (mulberry32) ----------
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- math helpers ----------
function eulerToMatrix([rx, ry, rz]) {
  const cx = Math.cos(rx), sx = Math.sin(rx);
  const cy = Math.cos(ry), sy = Math.sin(ry);
  const cz = Math.cos(rz), sz = Math.sin(rz);
  // R = Rz * Ry * Rx (row-major 3x3)
  return [
    cy * cz, cz * sx * sy - cx * sz, cx * cz * sy + sx * sz,
    cy * sz, cx * cz + sx * sy * sz, cx * sy * sz - cz * sx,
    -sy,     cy * sx,                cx * cy,
  ];
}
function applyTRS(v, m3, scale, pos) {
  const x = v[0] * scale[0], y = v[1] * scale[1], z = v[2] * scale[2];
  return [
    m3[0] * x + m3[1] * y + m3[2] * z + pos[0],
    m3[3] * x + m3[4] * y + m3[5] * z + pos[1],
    m3[6] * x + m3[7] * y + m3[8] * z + pos[2],
  ];
}
function applyRot(n, m3) {
  return [
    m3[0] * n[0] + m3[1] * n[1] + m3[2] * n[2],
    m3[3] * n[0] + m3[4] * n[1] + m3[5] * n[2],
    m3[6] * n[0] + m3[7] * n[1] + m3[8] * n[2],
  ];
}

// ---------- primitive generators: return {positions:[], normals:[], indices:[]} (local space) ----------
function boxGeo(sx, sy, sz) {
  const hx = sx / 2, hy = sy / 2, hz = sz / 2;
  const faces = [
    { n: [0, 0, 1],  v: [[-hx,-hy, hz],[ hx,-hy, hz],[ hx, hy, hz],[-hx, hy, hz]] },
    { n: [0, 0,-1],  v: [[ hx,-hy,-hz],[-hx,-hy,-hz],[-hx, hy,-hz],[ hx, hy,-hz]] },
    { n: [0, 1, 0],  v: [[-hx, hy, hz],[ hx, hy, hz],[ hx, hy,-hz],[-hx, hy,-hz]] },
    { n: [0,-1, 0],  v: [[-hx,-hy,-hz],[ hx,-hy,-hz],[ hx,-hy, hz],[-hx,-hy, hz]] },
    { n: [1, 0, 0],  v: [[ hx,-hy, hz],[ hx,-hy,-hz],[ hx, hy,-hz],[ hx, hy, hz]] },
    { n: [-1,0, 0],  v: [[-hx,-hy,-hz],[-hx,-hy, hz],[-hx, hy, hz],[-hx, hy,-hz]] },
  ];
  const positions = [], normals = [], indices = [];
  for (const f of faces) {
    const base = positions.length / 3;
    for (const vert of f.v) { positions.push(...vert); normals.push(...f.n); }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return { positions, normals, indices };
}

function cylinderGeo(radius, height, radialSegments) {
  radialSegments = Math.max(3, radialSegments | 0);
  const hh = height / 2;
  const positions = [], normals = [], indices = [];
  // side
  for (let i = 0; i <= radialSegments; i++) {
    const t = (i / radialSegments) * Math.PI * 2;
    const cx = Math.cos(t), cz = Math.sin(t);
    positions.push(radius * cx, -hh, radius * cz); normals.push(cx, 0, cz);
    positions.push(radius * cx,  hh, radius * cz); normals.push(cx, 0, cz);
  }
  for (let i = 0; i < radialSegments; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    indices.push(a, c, b, b, c, d);
  }
  // caps
  for (const [sign, ny] of [[hh, 1], [-hh, -1]]) {
    const center = positions.length / 3;
    positions.push(0, sign, 0); normals.push(0, ny, 0);
    const ringStart = positions.length / 3;
    for (let i = 0; i <= radialSegments; i++) {
      const t = (i / radialSegments) * Math.PI * 2;
      positions.push(radius * Math.cos(t), sign, radius * Math.sin(t)); normals.push(0, ny, 0);
    }
    for (let i = 0; i < radialSegments; i++) {
      if (ny > 0) indices.push(center, ringStart + i, ringStart + i + 1);
      else indices.push(center, ringStart + i + 1, ringStart + i);
    }
  }
  return { positions, normals, indices };
}

function sphereGeo(radius, widthSeg, heightSeg) {
  widthSeg = Math.max(3, widthSeg | 0); heightSeg = Math.max(2, heightSeg | 0);
  const positions = [], normals = [], indices = [];
  for (let y = 0; y <= heightSeg; y++) {
    const v = y / heightSeg, phi = v * Math.PI;
    for (let x = 0; x <= widthSeg; x++) {
      const u = x / widthSeg, theta = u * Math.PI * 2;
      const nx = -Math.cos(theta) * Math.sin(phi);
      const ny = Math.cos(phi);
      const nz = Math.sin(theta) * Math.sin(phi);
      positions.push(radius * nx, radius * ny, radius * nz); normals.push(nx, ny, nz);
    }
  }
  const row = widthSeg + 1;
  for (let y = 0; y < heightSeg; y++) {
    for (let x = 0; x < widthSeg; x++) {
      const a = y * row + x, b = a + row;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  return { positions, normals, indices };
}

function makePart(part) {
  const p = part.position || [0, 0, 0];
  const r = part.rotation || [0, 0, 0];
  const s = Array.isArray(part.scale) ? part.scale : [part.scale || 1, part.scale || 1, part.scale || 1];
  let g;
  switch (part.type) {
    case 'box': { const [x, y, z] = part.size || [1, 1, 1]; g = boxGeo(x, y, z); break; }
    case 'cylinder': g = cylinderGeo(part.radius ?? 0.5, part.height ?? 1, part.radialSegments ?? 16); break;
    case 'sphere': g = sphereGeo(part.radius ?? 0.5, part.widthSegments ?? 24, part.heightSegments ?? 16); break;
    default: throw new Error(`unknown part type "${part.type}" (box|cylinder|sphere)`);
  }
  const m3 = eulerToMatrix(r);
  const out = { positions: [], normals: [], indices: g.indices.slice() };
  for (let i = 0; i < g.positions.length; i += 3) {
    const tp = applyTRS([g.positions[i], g.positions[i + 1], g.positions[i + 2]], m3, s, p);
    out.positions.push(tp[0], tp[1], tp[2]);
    const tn = applyRot([g.normals[i], g.normals[i + 1], g.normals[i + 2]], m3);
    const len = Math.hypot(tn[0], tn[1], tn[2]) || 1;
    out.normals.push(tn[0] / len, tn[1] / len, tn[2] / len);
  }
  return out;
}

function mergeGeos(geos) {
  const merged = { positions: [], normals: [], indices: [] };
  let offset = 0;
  for (const g of geos) {
    merged.positions.push(...g.positions);
    merged.normals.push(...g.normals);
    for (const idx of g.indices) merged.indices.push(idx + offset);
    offset += g.positions.length / 3;
  }
  return merged;
}

function addGreebles(parts, cfg) {
  // Scatter small boxes over the spec's bounding box faces for surface detail.
  const all = mergeGeos(parts.map(makePart));
  let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < all.positions.length; i += 3) {
    minX = Math.min(minX, all.positions[i]);     maxX = Math.max(maxX, all.positions[i]);
    minY = Math.min(minY, all.positions[i + 1]); maxY = Math.max(maxY, all.positions[i + 1]);
    minZ = Math.min(minZ, all.positions[i + 2]); maxZ = Math.max(maxZ, all.positions[i + 2]);
  }
  const rng = mulberry32(cfg.seed ?? 1);
  const lerp = (a, b, t) => a + (b - a) * t;
  const out = [];
  for (let i = 0; i < (cfg.count || 0); i++) {
    const size = lerp(cfg.minSize ?? 0.05, cfg.maxSize ?? 0.15, rng());
    const face = Math.floor(rng() * 6);
    let pos;
    const px = lerp(minX, maxX, rng()), py = lerp(minY, maxY, rng()), pz = lerp(minZ, maxZ, rng());
    if (face === 0) pos = [px, py, maxZ];
    else if (face === 1) pos = [px, py, minZ];
    else if (face === 2) pos = [px, maxY, pz];
    else if (face === 3) pos = [px, minY, pz];
    else if (face === 4) pos = [maxX, py, pz];
    else pos = [minX, py, pz];
    out.push(makePart({ type: 'box', size: [size, size, size], position: pos,
      rotation: [rng() * 0.5, rng() * 0.5, rng() * 0.5] }));
  }
  return out;
}

// ---------- GLB writer ----------
function writeGLB(geo, material, name, outPath) {
  const positions = new Float32Array(geo.positions);
  const normals = new Float32Array(geo.normals);
  const maxIndex = geo.positions.length / 3;
  const useUint32 = maxIndex > 65535;
  const indices = useUint32 ? new Uint32Array(geo.indices) : new Uint16Array(geo.indices);

  // pad each buffer view to 4 bytes
  function pad4(n) { return (n + 3) & ~3; }
  const posBytes = positions.byteLength;
  const nrmBytes = normals.byteLength;
  const idxBytes = indices.byteLength;
  const posOff = 0;
  const nrmOff = pad4(posOff + posBytes);
  const idxOff = pad4(nrmOff + nrmBytes);
  const binLen = pad4(idxOff + idxBytes);

  const bin = new Uint8Array(binLen);
  bin.set(new Uint8Array(positions.buffer), posOff);
  bin.set(new Uint8Array(normals.buffer), nrmOff);
  bin.set(new Uint8Array(indices.buffer), idxOff);

  // position min/max (required by glTF spec)
  let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      mn[k] = Math.min(mn[k], positions[i + k]);
      mx[k] = Math.max(mx[k], positions[i + k]);
    }
  }

  const col = material.color || [0.8, 0.8, 0.8];
  const gltf = {
    asset: { version: '2.0', generator: 'threejs-aaa procgen.mjs' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: name || 'Prop' }],
    meshes: [{ name: name || 'Prop', primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: 0 }] }],
    materials: [{
      name: 'ProcMaterial',
      pbrMetallicRoughness: {
        baseColorFactor: [col[0], col[1], col[2], 1],
        metallicFactor: material.metalness ?? 0,
        roughnessFactor: material.roughness ?? 0.8,
      },
    }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: positions.length / 3, type: 'VEC3', min: mn, max: mx },
      { bufferView: 1, componentType: 5126, count: normals.length / 3, type: 'VEC3' },
      { bufferView: 2, componentType: useUint32 ? 5125 : 5123, count: indices.length, type: 'SCALAR' },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: posOff, byteLength: posBytes, target: 34962 },
      { buffer: 0, byteOffset: nrmOff, byteLength: nrmBytes, target: 34962 },
      { buffer: 0, byteOffset: idxOff, byteLength: idxBytes, target: 34963 },
    ],
    buffers: [{ byteLength: binLen }],
  };

  // JSON chunk (pad with spaces to 4 bytes)
  let json = JSON.stringify(gltf);
  while (json.length % 4 !== 0) json += ' ';
  const jsonBytes = new TextEncoder().encode(json);

  const totalLen = 12 + 8 + jsonBytes.length + 8 + bin.length;
  const out = new Uint8Array(totalLen);
  const dv = new DataView(out.buffer);
  let o = 0;
  dv.setUint32(o, 0x46546c67, true); o += 4;   // magic "glTF"
  dv.setUint32(o, 2, true); o += 4;             // version
  dv.setUint32(o, totalLen, true); o += 4;      // total length
  dv.setUint32(o, jsonBytes.length, true); o += 4;
  dv.setUint32(o, 0x4e4f534a, true); o += 4;    // "JSON"
  out.set(jsonBytes, o); o += jsonBytes.length;
  dv.setUint32(o, bin.length, true); o += 4;
  dv.setUint32(o, 0x004e4942, true); o += 4;    // "BIN\0"
  out.set(bin, o);

  writeFileSync(outPath, out);
}

// ---------- demo specs ----------
const DEMOS = {
  crate: {
    name: 'Crate',
    material: { color: [0.55, 0.4, 0.25], metalness: 0.0, roughness: 0.85 },
    parts: [{ type: 'box', size: [1, 1, 1] }],
    greebles: { count: 24, minSize: 0.06, maxSize: 0.12, seed: 7 },
  },
  pillar: {
    name: 'Pillar',
    material: { color: [0.7, 0.7, 0.72], metalness: 0.1, roughness: 0.6 },
    parts: [
      { type: 'box', size: [1.2, 0.2, 1.2], position: [0, -1.4, 0] },
      { type: 'cylinder', radius: 0.4, height: 2.6, radialSegments: 24 },
      { type: 'box', size: [1.2, 0.2, 1.2], position: [0, 1.4, 0] },
    ],
  },
  rock: {
    name: 'Rock',
    material: { color: [0.35, 0.34, 0.32], metalness: 0.0, roughness: 0.95 },
    parts: [
      { type: 'sphere', radius: 0.8, widthSegments: 12, heightSegments: 8 },
      { type: 'sphere', radius: 0.5, widthSegments: 10, heightSegments: 6, position: [0.6, 0.2, 0.3] },
      { type: 'sphere', radius: 0.4, widthSegments: 10, heightSegments: 6, position: [-0.5, 0.1, -0.4] },
    ],
    greebles: { count: 40, minSize: 0.05, maxSize: 0.18, seed: 3 },
  },
};

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.out || (!args.spec && !args.demo)) { usage(); process.exit(args.help ? 0 : 1); }

  let spec;
  if (args.demo) {
    spec = DEMOS[args.demo];
    if (!spec) { console.error(`error: unknown demo "${args.demo}" (crate|pillar|rock)`); process.exit(1); }
  } else {
    try { spec = JSON.parse(readFileSync(resolve(args.spec), 'utf8')); }
    catch (e) { console.error(`error: cannot read/parse spec: ${e.message}`); process.exit(1); }
  }

  if (!Array.isArray(spec.parts) || spec.parts.length === 0) {
    console.error('error: spec must contain a non-empty "parts" array'); process.exit(1);
  }

  let geos;
  try {
    geos = spec.parts.map(makePart);
    if (spec.greebles && spec.greebles.count > 0) geos = geos.concat(addGreebles(spec.parts, spec.greebles));
  } catch (e) { console.error(`error: ${e.message}`); process.exit(1); }

  const merged = mergeGeos(geos);
  const outPath = resolve(args.out);
  writeGLB(merged, spec.material || {}, spec.name, outPath);

  const tris = merged.indices.length / 3;
  console.log(`✓ Wrote ${outPath}`);
  console.log(`  ${geos.length} parts, ${merged.positions.length / 3} verts, ${tris} triangles`);
  console.log('  Load with GLTFLoader. For booleans/carving, use three-bvh-csg in-app (reference/06).');
}

main();
