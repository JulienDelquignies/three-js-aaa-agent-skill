#!/usr/bin/env node
// verify-kit.mjs — L'EMPLACEMENT DE TEXTURE DU MAILLOT (lot 214, demande projet aval). Trois
// contrats : (1) la carte SHANON_UV recouvre ≥ 95 % des texels UV de chaque pièce de l'asset
// (rastérisation du GLB — si l'asset change, cette clause parle) ; (2) tintPart({ map }) ne
// monte la texture que sur le CLONE de la pièce visée (corps intact, checkTint vert) ; (3)
// checkTint refuse une texture hors contrat glTF (flipY true, colorSpace non sRGB).
import { readFileSync } from 'node:fs';
import * as THREE from 'three/webgpu';
import { SHANON_UV, uvCoverage } from '../assets/starter/src/engine/kit-uv.js';
import { tintPart, checkTint } from '../assets/starter/src/engine/part-tint.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };

// ---- 1. la carte contre l'asset
{
  const buf = readFileSync(new URL('../../../examples/showcase/public/shanon.glb', import.meta.url));
  const jsonLen = buf.readUInt32LE(12); const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
  const bin = buf.subarray(20 + jsonLen + 8);
  const acc = (i) => { const a = json.accessors[i], bv = json.bufferViews[a.bufferView]; const off = (bv.byteOffset ?? 0) + (a.byteOffset ?? 0); const comp = { 5126: Float32Array, 5123: Uint16Array, 5125: Uint32Array, 5121: Uint8Array }[a.componentType]; const nc = { SCALAR: 1, VEC2: 2, VEC3: 3 }[a.type]; const bpc = comp.BYTES_PER_ELEMENT, stride = bv.byteStride; const out = new Float64Array(a.count * nc); for (let k = 0; k < a.count; k++) { const base = off + (stride ? k * stride : k * nc * bpc); for (let c = 0; c < nc; c++) { const v = new comp(bin.buffer, bin.byteOffset + base + c * bpc, 1)[0]; out[k * nc + c] = a.normalized ? v / (comp === Uint16Array ? 65535 : 255) : v; } } return out; };
  const pieces = { shirt: Object.values(SHANON_UV.shirt), shorts: Object.values(SHANON_UV.shorts), socks: Object.values(SHANON_UV.socks) };
  const res = {};
  for (const [k, name] of Object.entries(SHANON_UV.atlas.meshes)) {
    const mesh = json.meshes.find((m) => m.name === name);
    const prim = mesh.primitives[0];
    res[k] = uvCoverage(acc(prim.attributes.TEXCOORD_0), acc(prim.indices), pieces[k]);
  }
  const mat = json.materials.find((m) => m.name === SHANON_UV.atlas.material);
  const img = json.textures[mat.pbrMetallicRoughness.baseColorTexture.index].extensions?.EXT_texture_webp?.source;
  ok(`lot 214 — LA CARTE SHANON_UV recouvre l'asset (maillot ${(100 * res.shirt.fraction).toFixed(1)} %, short ${(100 * res.shorts.fraction).toFixed(1)} %, chaussettes ${(100 * res.socks.fraction).toFixed(1)} % ≥ 95 — rastérisé sur shanon.glb ; l'atlas du corps est l'image ${img} = carte.atlas.image ${SHANON_UV.atlas.image})`,
    res.shirt.fraction >= 0.95 && res.shorts.fraction >= 0.95 && res.socks.fraction >= 0.95 && img === SHANON_UV.atlas.image);
}

// ---- 2. tintPart({ map }) sur un personnage synthétique : un atlas partagé, trois pièces + corps
const fakeMap = (flipY = false, cs = THREE.SRGBColorSpace) => { const t = new THREE.Texture(); t.flipY = flipY; t.colorSpace = cs; return t; };
const perso = (shared = null) => {   // `shared` : le matériau chargé du GLB que TOUS les clones SkeletonUtils partagent — la clé du cache
  const atlas = shared?.map ?? fakeMap();
  const mat = shared ?? new THREE.MeshStandardMaterial({ map: atlas, name: 'Ch38_body' });
  const g = new THREE.Group();
  for (const n of ['Ch38_Shirt', 'Ch38_Shorts', 'Ch38_Socks', 'Ch38_Body', 'Ch38_Shoes']) { const m = new THREE.Mesh(new THREE.BufferGeometry(), mat); m.name = n; g.add(m); }
  return { g, mat, atlas };
};
{
  const { g, mat, atlas } = perso();
  const kit = fakeMap();
  const r = tintPart(g, { match: /Shirt|Shorts|Socks/i, color: 0xffffff, map: kit });
  const shirt = g.getObjectByName('Ch38_Shirt'), body = g.getObjectByName('Ch38_Body'), shoes = g.getObjectByName('Ch38_Shoes');
  ok(`lot 214 — tintPart({ map }) monte la texture sur le CLONE de la pièce (maillot → kit ${shirt.material.map === kit}, corps → atlas ${body.material.map === atlas && body.material === mat}, chaussures intactes ${shoes.material === mat}, checkTint ${r.check.ok ? 'vert' : r.check.issues.join(' ; ')})`,
    shirt.material.map === kit && shirt.material !== mat && body.material === mat && body.material.map === atlas && shoes.material === mat && r.check.ok);
  // le cache : la même (map, couleur) rend le même matériau — deux joueurs d'une équipe coûtent un matériau
  const { g: g2 } = perso(mat);   // le second joueur clone du MÊME matériau source (SkeletonUtils)
  const r2 = tintPart(g2, { match: /Shirt/i, color: 0xffffff, map: kit });
  ok(`lot 214 — deux joueurs, même tenue : ${r2.parts[0].material === shirt.material ? 'un seul' : 'deux'} matériau(x) (le cache par texture ET couleur)`, r2.parts[0].material === shirt.material);
}
// ---- 3. le contrat glTF de la texture
{
  const { g } = perso();
  const bad = tintPart(g, { match: /Shirt/i, color: 0xffffff, map: fakeMap(true, THREE.LinearSRGBColorSpace) });
  ok(`lot 214 — checkTint REFUSE une texture hors contrat (flipY true, colorSpace linéaire : ${bad.check.issues.length} griefs — « ${bad.check.issues[0]?.slice(0, 70)} »)`,
    !bad.check.ok && bad.check.issues.some((s) => /flipY/.test(s)) && bad.check.issues.some((s) => /colorSpace/.test(s)));
  // …et sans map, l'hier au bit : la teinte multiplicative garde la texture d'origine
  const { g: g3, atlas: a3 } = perso();
  const t3 = tintPart(g3, { match: /Shirt/i, color: 0x1f3a93 });
  ok(`lot 214 — sans map, la teinte d'hier (color multiplicatif, texture d'origine gardée : ${t3.parts[0].material.map === a3}, checkTint ${t3.check.ok ? 'vert' : 'rouge'})`, t3.parts[0].material.map === a3 && t3.check.ok);
}
console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
