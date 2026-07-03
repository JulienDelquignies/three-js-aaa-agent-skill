import * as THREE from 'three/webgpu';

// furniture-kit — compact procedural meshes for furnish.js items (no imported models). Each kind is a
// small assembly of boxes/cylinders in LOCAL space (x=width, z=depth, front=+z, floor=y0), returned as a
// group positioned/rotated from the item, plus ONE footprint collider box for physics. Readable
// silhouettes over detail — materials are simple PBR with a per-kind palette.
const C = { wood: 0x8a6a48, woodDark: 0x5f4630, fabric: 0x4a5d78, fabric2: 0x6d4a52, white: 0xe7e5df, metal: 0x9aa1ab, metalDark: 0x565d66, green: 0x4e7a4a, screen: 0x10131a, red: 0x9c3f38 };

export function buildFurnitureItem(item, cache = {}) {
  const g = new THREE.Group();
  const mat = (hex) => (cache[hex] ||= new THREE.MeshStandardNodeMaterial({ color: hex, roughness: 0.8, metalness: hex === C.metal || hex === C.metalDark ? 0.6 : 0.05 }));
  const box = (w, h, d, x, y, z, hex) => { const m = new THREE.Mesh((cache[`b${w}|${h}|${d}`] ||= new THREE.BoxGeometry(w, h, d)), mat(hex)); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m); return m; };
  const cyl = (r, h, x, y, z, hex) => { const m = new THREE.Mesh((cache[`c${r}|${h}`] ||= new THREE.CylinderGeometry(r, r, h, 12)), mat(hex)); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  const legs = (w, d, h, hex = C.woodDark) => { for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(0.03, h, sx * (w / 2 - 0.06), h / 2, sz * (d / 2 - 0.06), hex); };
  const { w, d, h } = item;
  switch (item.kind) {
    case 'bed': box(w, 0.25, d, 0, 0.25, 0, C.woodDark); box(w - 0.08, 0.18, d - 0.12, 0, 0.44, -0.02, C.white); box(w - 0.3, 0.1, 0.4, 0, 0.56, -d / 2 + 0.32, 0xd8dbe4); box(w, h + 0.35, 0.09, 0, (h + 0.35) / 2, -d / 2 + 0.045, C.wood); break;
    case 'nightstand': box(w, 0.5, d, 0, 0.25, 0, C.wood); box(0.12, 0.04, 0.12, 0, 0.54, 0, C.metalDark); break;
    case 'wardrobe': box(w, h, d, 0, h / 2, 0, C.wood); box(0.02, h - 0.2, 0.02, 0, h / 2, d / 2 + 0.005, C.woodDark); break;
    case 'sofa': box(w, 0.42, d, 0, 0.24, 0.06, C.fabric); box(w, 0.55, 0.22, 0, 0.6, -d / 2 + 0.11, C.fabric); for (const s of [-1, 1]) box(0.2, 0.32, d, s * (w / 2 - 0.1), 0.55, 0, C.fabric); break;
    case 'coffee-table': box(w, 0.05, d, 0, 0.4, 0, C.wood); legs(w, d, 0.38); break;
    case 'tv-stand': box(w, 0.45, d, 0, 0.225, 0, C.woodDark); box(w * 0.85, 0.72, 0.06, 0, 0.45 + 0.42, 0, C.screen); break;
    case 'counter': box(w, 0.9, d, 0, 0.45, 0, C.white); box(w, 0.04, d, 0, 0.92, 0, C.woodDark); break;
    case 'fridge': box(w, h, d, 0, h / 2, 0, C.white); box(0.03, 0.5, 0.03, w / 2 - 0.08, h * 0.6, d / 2 + 0.01, C.metal); break;
    case 'table': box(w, 0.05, d, 0, 0.73, 0, C.wood); legs(w, d, 0.71); break;
    case 'chair': box(w, 0.05, d * 0.9, 0, 0.45, 0, C.wood); box(w, 0.5, 0.05, 0, 0.72, -d / 2 + 0.05, C.wood); legs(w, d * 0.9, 0.43); break;
    case 'office-chair': cyl(0.26, 0.06, 0, 0.47, 0, C.screen); box(0.44, 0.5, 0.08, 0, 0.78, -d / 2 + 0.1, C.screen); cyl(0.04, 0.4, 0, 0.25, 0, C.metalDark); cyl(0.24, 0.04, 0, 0.04, 0, C.metalDark); break;
    case 'desk': box(w, 0.05, d, 0, 0.73, 0, C.woodDark); legs(w, d, 0.71, C.metalDark); box(0.35, 0.25, 0.04, -w / 4, 0.88, -d / 2 + 0.2, C.screen); break;
    case 'bookshelf': case 'shelf': case 'cabinet': { box(w, h, 0.04, 0, h / 2, -d / 2 + 0.02, C.wood); for (const s of [-1, 1]) box(0.04, h, d, s * (w / 2 - 0.02), h / 2, 0, C.wood); for (let i = 0; i <= 3; i++) box(w, 0.03, d, 0, 0.1 + (h - 0.2) * i / 3, 0, C.wood); break; }
    case 'locker': box(w, h, d, 0, h / 2, 0, C.metal); for (let i = 1; i < 4; i++) box(0.015, h - 0.1, 0.015, -w / 2 + w * i / 4, h / 2, d / 2 + 0.005, C.metalDark); break;
    case 'bench': box(w, 0.06, d, 0, 0.42, 0, C.wood); legs(w, d, 0.4, C.metalDark); break;
    case 'treadmill': box(w * 0.9, 0.14, d * 0.8, 0, 0.1, 0.12, C.screen); for (const s of [-1, 1]) box(0.05, 1.1, 0.05, s * (w / 2 - 0.06), 0.6, -d / 2 + 0.15, C.metalDark); box(w, 0.24, 0.06, 0, 1.2, -d / 2 + 0.15, C.screen); break;
    case 'rack': for (const s of [-1, 1]) box(0.08, h, 0.08, s * (w / 2 - 0.06), h / 2, 0, C.metalDark); box(w, 0.05, 0.05, 0, h * 0.75, 0, C.metal); box(w, 0.05, 0.05, 0, h * 0.45, 0, C.metal); break;
    case 'bench-press': box(0.4, 0.08, d, 0, 0.45, 0, C.red); legs(0.4, d, 0.42, C.metalDark); box(w + 0.7, 0.04, 0.04, 0, 1.0, -d / 4, C.metal); break;
    case 'mat': box(w, 0.05, d, 0, 0.03, 0, C.fabric2); break;
    case 'exam-table': box(w, 0.12, d, 0, 0.72, 0, C.white); box(w - 0.1, 0.6, d - 0.3, 0, 0.35, 0, C.metal); break;
    case 'sink': cyl(0.14, 0.72, 0, 0.36, 0, C.white); box(w, 0.12, d, 0, 0.78, 0, C.white); break;
    case 'toilet': box(w, 0.4, d * 0.65, 0, 0.2, 0.1, C.white); box(w, 0.5, 0.16, 0, 0.53, -d / 2 + 0.1, C.white); break;
    case 'shower': box(w, 0.06, d, 0, 0.03, 0, C.white); for (const s of [[-1, 0], [0, -1]]) box(s[0] ? 0.03 : w, h, s[1] ? 0.03 : d, s[0] * (w / 2), h / 2, s[1] * (d / 2), 0xbfd4dd); cyl(0.02, h * 0.9, w / 2 - 0.08, h * 0.45, -d / 2 + 0.08, C.metal); break;
    case 'plant': cyl(0.16, 0.3, 0, 0.15, 0, 0x8a5a3a); { const m = new THREE.Mesh((cache.cone ||= new THREE.ConeGeometry(0.24, 0.9, 8)), mat(C.green)); m.position.set(0, 0.85, 0); m.castShadow = true; g.add(m); } break;
    case 'screen': box(w, h * 0.8, d, 0, h * 0.55, 0, C.screen); box(w + 0.2, 0.06, d + 0.05, 0, h * 0.96, 0, C.metalDark); break;
    default: box(w, h, d, 0, h / 2, 0, C.wood);
  }
  g.rotation.y = item.yaw;
  return g;
}

/** Build ALL items of a furnishing into a parent group + physics collider boxes. */
export function buildFurnishing(items, model, { at = [0, 0, 0] } = {}) {
  const group = new THREE.Group(); group.position.set(at[0], at[1], at[2]);
  const cache = {}; const colliders = [];
  for (const it of items) {
    const y = model.floors[it.floor].y;
    const sub = buildFurnitureItem(it, cache);
    sub.position.set(it.x, y, it.z); group.add(sub);
    const swap = Math.abs(Math.sin(it.yaw)) > 0.5;
    colliders.push({ pos: [at[0] + it.x, at[1] + y + it.h / 2, at[2] + it.z], half: [swap ? it.d / 2 : it.w / 2, it.h / 2, swap ? it.w / 2 : it.d / 2] });
  }
  return { group, colliders, dispose: () => Object.values(cache).forEach((o) => o.dispose?.()) };
}
