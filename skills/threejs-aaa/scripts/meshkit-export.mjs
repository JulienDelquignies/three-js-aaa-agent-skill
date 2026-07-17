#!/usr/bin/env node
// meshkit-export.mjs — meshkit spec (JSON) → standard .glb (glTF 2.0 binary), ZERO dependencies:
// the writer emits the JSON chunk + BIN chunk by hand. The output loads in three.js, Blender, Unity,
// PlayCanvas — meshkit models are not locked to this engine. Every part is checked against
// checkMesh() before export (a broken mesh never leaves the pipeline).
//   node meshkit-export.mjs --spec vase.json --out vase.glb
//   node meshkit-export.mjs --demo trophy --out trophy.glb     (built-in demo specs: vase|trophy|rock)
import { readFile, writeFile } from 'node:fs/promises';
import { runSpec, checkMesh } from '../assets/starter/src/engine/meshkit.js';

const DEMOS = {
  vase: { parts: [{ name: 'vase', color: [0.7, 0.33, 0.22, 1], roughness: 0.55, ops: [{ op: 'lathe', profile: [[0, 0], [0.16, 0], [0.2, 0.04], [0.14, 0.28], [0.26, 0.62], [0.18, 0.86], [0.2, 0.96], [0.19, 1.0], [0, 1.0]], segments: 40 }] }] },
  trophy: {
    parts: [
      { name: 'coupe', color: [0.85, 0.66, 0.2, 1], metalness: 1, roughness: 0.25, ops: [
        { op: 'lathe', profile: [[0, 0], [0.09, 0], [0.11, 0.03], [0.09, 0.1], [0.2, 0.42], [0.24, 0.56], [0.23, 0.6], [0, 0.6]], segments: 36 },
        { op: 'transform', at: [0, 0.3, 0] },
        { op: 'sweep', shape: [[0.025, 0], [0.018, 0.018], [0, 0.025], [-0.018, 0.018], [-0.025, 0], [-0.018, -0.018], [0, -0.025], [0.018, -0.018]], path: Array.from({ length: 19 }, (_, i) => { const a = (i / 18) * Math.PI; return [0.2 + Math.sin(a) * 0.21, 0.6 - Math.cos(a) * 0.24, 0]; }) },
        { op: 'mirrorX' },
        { op: 'lathe', profile: [[0, 0], [0.2, 0], [0.2, 0.06], [0.07, 0.1], [0.05, 0.32], [0, 0.32]], segments: 24 },
        { op: 'merge' }] },
    ],
  },
  rock: { parts: [{ name: 'rocher', color: [0.45, 0.42, 0.39, 1], roughness: 0.95, ops: [{ op: 'sphere', radius: 0.5, segments: 24, rings: 16 }, { op: 'displaceNoise', seed: 7, amp: 0.14, freq: 3 }, { op: 'smooth', passes: 1 }] }] },
};

// the football boot from the staged sculpt workflow (reference/43) — sections computed here
const bootSecs = [];
for (const [z, w, h] of [[-0.135, 0.040, 0.052], [-0.08, 0.046, 0.056], [-0.01, 0.047, 0.048], [0.06, 0.043, 0.034], [0.11, 0.034, 0.020], [0.142, 0.022, 0.010]]) {
  const ring = [];
  for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; ring.push([Math.cos(a) * w, 0.026 + h + Math.sin(a) * h * 0.85, z]); }
  bootSecs.push(ring);
}
const bootOutline = [[-0.045, 0], [-0.05, 0.05], [-0.04, 0.10], [-0.035, 0.155], [-0.045, 0.21], [-0.035, 0.26], [0, 0.285], [0.04, 0.265], [0.05, 0.21], [0.042, 0.15], [0.045, 0.09], [0.04, 0.04], [0, -0.01]].map((p2) => [p2[0] * 1.15, p2[1] - 0.14]);
DEMOS.crampon = {
  parts: [
    { name: 'semelle', color: [0.94, 0.93, 0.9, 1], roughness: 0.5, ops: [{ op: 'extrudePoly', outline: bootOutline, depth: 0.022, bevel: 0.006 }] },
    { name: 'tige', color: [0.09, 0.095, 0.11, 1], roughness: 0.55, ops: [{ op: 'loft', sections: bootSecs }, { op: 'smooth', passes: 1 }] },
  ],
};

const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
if (process.argv.includes('--help') || (!arg('--spec') && !arg('--demo'))) {
  console.log('usage: meshkit-export.mjs (--spec model.json | --demo vase|trophy|rock|crampon) --out model.glb');
  process.exit(0);
}
const spec = arg('--spec') ? JSON.parse(await readFile(arg('--spec'), 'utf8')) : DEMOS[arg('--demo')];
if (!spec) { console.error(`démo inconnue: ${arg('--demo')} (choix: ${Object.keys(DEMOS).join(', ')})`); process.exit(1); }
const out = arg('--out') || 'model.glb';

const parts = runSpec(spec);
for (const p of parts) {
  const r = checkMesh(p.mesh, { maxTris: 200000, closed: p.closed !== false });
  if (!r.ok) { console.error(`✗ ${p.name || 'part'} : ${r.issues[0]} — export refusé`); process.exit(1); }
}

// ---- glTF 2.0 writer
const bin = [], views = [], accessors = [];
let byteLen = 0;
const pushView = (buf, target) => {
  const pad = (4 - (byteLen % 4)) % 4;
  if (pad) { bin.push(new Uint8Array(pad)); byteLen += pad; }
  views.push({ buffer: 0, byteOffset: byteLen, byteLength: buf.byteLength, ...(target ? { target } : {}) });
  bin.push(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)); byteLen += buf.byteLength;
  return views.length - 1;
};
const meshes = [], nodes = [], materials = [];
parts.forEach((p, i) => {
  const m = p.mesh, nv = m.positions.length / 3;
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (let v = 0; v < m.positions.length; v += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], m.positions[v + k]); mx[k] = Math.max(mx[k], m.positions[v + k]); }
  const ap = accessors.push({ bufferView: pushView(m.positions, 34962), componentType: 5126, count: nv, type: 'VEC3', min: mn, max: mx }) - 1;
  const an = accessors.push({ bufferView: pushView(m.normals, 34962), componentType: 5126, count: nv, type: 'VEC3' }) - 1;
  const ai = accessors.push({ bufferView: pushView(m.indices, 34963), componentType: 5125, count: m.indices.length, type: 'SCALAR' }) - 1;
  const mat = materials.push({ name: p.name || `part${i}`, pbrMetallicRoughness: { baseColorFactor: p.color || [0.72, 0.7, 0.65, 1], metallicFactor: p.metalness ?? 0, roughnessFactor: p.roughness ?? 0.7 } }) - 1;
  const mesh = meshes.push({ name: p.name || `part${i}`, primitives: [{ attributes: { POSITION: ap, NORMAL: an }, indices: ai, material: mat }] }) - 1;
  nodes.push({ mesh, name: p.name || `part${i}` });
});
const gltf = {
  asset: { version: '2.0', generator: 'threejs-aaa meshkit' },
  scene: 0, scenes: [{ nodes: nodes.map((_, i) => i) }], nodes, meshes, materials,
  buffers: [{ byteLength: byteLen }], bufferViews: views, accessors,
};
let json = Buffer.from(JSON.stringify(gltf));
if (json.length % 4) json = Buffer.concat([json, Buffer.alloc(4 - (json.length % 4), 0x20)]);
const binBuf = Buffer.concat([...bin.map((b) => Buffer.from(b)), Buffer.alloc((4 - (byteLen % 4)) % 4)]);
const total = 12 + 8 + json.length + 8 + binBuf.length;
const head = Buffer.alloc(12 + 8); head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(total, 8);
head.writeUInt32LE(json.length, 12); head.writeUInt32LE(0x4e4f534a, 16);
const binHead = Buffer.alloc(8); binHead.writeUInt32LE(binBuf.length, 0); binHead.writeUInt32LE(0x004e4942, 4);
await writeFile(out, Buffer.concat([head, json, binHead, binBuf]));
const tris = parts.reduce((a, p) => a + p.mesh.indices.length / 3, 0);
console.log(`✓ ${out} — ${parts.length} partie(s), ${tris} tris, ${((total) / 1024).toFixed(1)} ko`);
