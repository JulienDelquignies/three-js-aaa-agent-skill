import * as THREE from 'three/webgpu';
import { drawCrest, drawJersey, drawPressWall } from './club-theme.js';
import { lathe, sphere, displace, smooth, extrudePoly, roundedRect, noise } from './meshkit.js';
import { toGeometry } from './meshkit-builder.js';

// furniture-kit — compact procedural meshes for furnish.js items (no imported models). Each kind is a
// small assembly of boxes/cylinders in LOCAL space (x=width, z=depth, front=+z, floor=y0), returned as a
// group positioned/rotated from the item, plus ONE footprint collider box for physics. Readable
// silhouettes over detail — materials are simple PBR with a per-kind palette.
// Soft parts (cushions, pots, basins, foliage) come from MESHKIT (reference/40): rounded-rect cages
// put through Loop subdivision, lathe profiles, displaced spheres — geometries cached per dimension
// so N chairs share one pad. Boxes remain for what IS boxy (frames, shelves, lockers).
const C = { wood: 0x8a6a48, woodDark: 0x5f4630, fabric: 0x4a5d78, fabric2: 0x6d4a52, white: 0xe7e5df, metal: 0x9aa1ab, metalDark: 0x565d66, green: 0x4e7a4a, screen: 0x10131a, red: 0x9c3f38 };

export function buildFurnitureItem(item, cache = {}, theme = null) {
  const g = new THREE.Group();
  const mat = (hex) => (cache[hex] ||= new THREE.MeshStandardNodeMaterial({ color: hex, roughness: 0.8, metalness: hex === C.metal || hex === C.metalDark ? 0.6 : 0.05 }));
  const box = (w, h, d, x, y, z, hex) => { const m = new THREE.Mesh((cache[`b${w}|${h}|${d}`] ||= new THREE.BoxGeometry(w, h, d)), mat(hex)); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m); return m; };
  const cyl = (r, h, x, y, z, hex) => { const m = new THREE.Mesh((cache[`c${r}|${h}`] ||= new THREE.CylinderGeometry(r, r, h, 12)), mat(hex)); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  const legs = (w, d, h, hex = C.woodDark) => { for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(0.03, h, sx * (w / 2 - 0.06), h / 2, sz * (d / 2 - 0.06), hex); };
  // meshkit soft parts — geometry cached by key, so every same-size cushion/pot shares one mesh
  const soft = (key, make) => (cache[key] ||= toGeometry(make()));
  const pad = (pw, ph, pd, x, y, z, hex, rx = 0) => {              // rounded cushion (cage → Loop ×1)
    const r = Math.min(0.09, pw / 3.2, pd / 3.2);
    const geo = soft(`pad${pw.toFixed(2)}|${ph.toFixed(2)}|${pd.toFixed(2)}`,
      () => smooth(extrudePoly(roundedRect(pw, pd, r, { cornerSegments: 2 }), { depth: ph, bevel: Math.min(0.03, ph / 3) }), 1));
    const m = new THREE.Mesh(geo, mat(hex)); m.position.set(x, y, z); m.rotation.x = rx;
    m.castShadow = m.receiveShadow = true; g.add(m); return m;
  };
  const turned = (key, profile, x, y, z, hex, segments = 24) => {  // lathe part (pots, basins, seats)
    const m = new THREE.Mesh(soft(key, () => lathe(profile, { segments })), mat(hex));
    m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m); return m;
  };
  const { w, d, h } = item;
  switch (item.kind) {
    case 'bed':
      box(w, 0.25, d, 0, 0.25, 0, C.woodDark);
      pad(w - 0.08, 0.16, d - 0.12, 0, 0.37, -0.02, C.white);                       // mattress
      pad(w - 0.14, 0.12, d * 0.58, 0, 0.5, d / 2 - d * 0.31 - 0.04, 0xbfc7d6);     // duvet, foot half
      for (const s of [-1, 1]) pad(w / 2 - 0.22, 0.1, 0.34, s * (w / 4 - 0.05), 0.53, -d / 2 + 0.3, 0xe6e9f0);   // pillows
      box(w, h + 0.35, 0.09, 0, (h + 0.35) / 2, -d / 2 + 0.045, C.wood); break;
    case 'nightstand': box(w, 0.5, d, 0, 0.25, 0, C.wood); box(0.12, 0.04, 0.12, 0, 0.54, 0, C.metalDark); break;
    case 'wardrobe': box(w, h, d, 0, h / 2, 0, C.wood); box(0.02, h - 0.2, 0.02, 0, h / 2, d / 2 + 0.005, C.woodDark); break;
    case 'sofa': {                                          // meshkit: rounded cushions + soft arms
      box(w - 0.1, 0.2, d - 0.08, 0, 0.12, 0.03, C.woodDark);                       // low base
      pad(w - 0.42, 0.2, 0.24, 0, 0.22, -d / 2 + 0.16, C.fabric);                   // back seat rail
      const cw = (w - 0.5) / 2;
      for (const s of [-1, 1]) {
        pad(cw, 0.17, d - 0.5, s * (cw / 2 + 0.02), 0.23, 0.1, C.fabric);           // seat cushions
        pad(cw, 0.42, 0.16, s * (cw / 2 + 0.02), 0.35, -d / 2 + 0.13, C.fabric2, -0.16);   // back cushions
      }
      for (const s of [-1, 1]) pad(0.19, 0.5, d - 0.14, s * (w / 2 - 0.11), 0.13, 0, C.fabric);   // arms
      break;
    }
    case 'coffee-table': box(w, 0.05, d, 0, 0.4, 0, C.wood); legs(w, d, 0.38); break;
    case 'tv-stand': box(w, 0.45, d, 0, 0.225, 0, C.woodDark); box(w * 0.85, 0.72, 0.06, 0, 0.45 + 0.42, 0, C.screen); break;
    case 'counter': box(w, 0.9, d, 0, 0.45, 0, C.white); box(w, 0.04, d, 0, 0.92, 0, C.woodDark); break;
    case 'fridge': box(w, h, d, 0, h / 2, 0, C.white); box(0.03, 0.5, 0.03, w / 2 - 0.08, h * 0.6, d / 2 + 0.01, C.metal); break;
    case 'table': box(w, 0.05, d, 0, 0.73, 0, C.wood); legs(w, d, 0.71); break;
    case 'chair': box(w, 0.04, d * 0.9, 0, 0.43, 0, C.wood); pad(w - 0.04, 0.06, d * 0.82, 0, 0.45, 0, C.fabric2); box(w, 0.5, 0.05, 0, 0.72, -d / 2 + 0.05, C.wood); legs(w, d * 0.9, 0.43); break;
    case 'office-chair': pad(0.46, 0.09, 0.46, 0, 0.44, 0, C.screen); pad(0.44, 0.5, 0.09, 0, 0.56, -d / 2 + 0.1, C.screen, -0.08); cyl(0.04, 0.4, 0, 0.25, 0, C.metalDark); cyl(0.24, 0.04, 0, 0.04, 0, C.metalDark); break;
    case 'desk': box(w, 0.05, d, 0, 0.73, 0, C.woodDark); legs(w, d, 0.71, C.metalDark); box(0.35, 0.25, 0.04, -w / 4, 0.88, -d / 2 + 0.2, C.screen); break;
    case 'bookshelf': case 'shelf': case 'cabinet': { box(w, h, 0.04, 0, h / 2, -d / 2 + 0.02, C.wood); for (const s of [-1, 1]) box(0.04, h, d, s * (w / 2 - 0.02), h / 2, 0, C.wood); for (let i = 0; i <= 3; i++) box(w, 0.03, d, 0, 0.1 + (h - 0.2) * i / 3, 0, C.wood); break; }
    case 'locker': box(w, h, d, 0, h / 2, 0, C.metal); for (let i = 1; i < 4; i++) box(0.015, h - 0.1, 0.015, -w / 2 + w * i / 4, h / 2, d / 2 + 0.005, C.metalDark); break;
    case 'bench': box(w, 0.06, d, 0, 0.42, 0, C.wood); legs(w, d, 0.4, C.metalDark); break;
    case 'treadmill': box(w * 0.9, 0.14, d * 0.8, 0, 0.1, 0.12, C.screen); for (const s of [-1, 1]) box(0.05, 1.1, 0.05, s * (w / 2 - 0.06), 0.6, -d / 2 + 0.15, C.metalDark); box(w, 0.24, 0.06, 0, 1.2, -d / 2 + 0.15, C.screen); break;
    case 'rack': for (const s of [-1, 1]) box(0.08, h, 0.08, s * (w / 2 - 0.06), h / 2, 0, C.metalDark); box(w, 0.05, 0.05, 0, h * 0.75, 0, C.metal); box(w, 0.05, 0.05, 0, h * 0.45, 0, C.metal); break;
    case 'bench-press': box(0.4, 0.08, d, 0, 0.45, 0, C.red); legs(0.4, d, 0.42, C.metalDark); box(w + 0.7, 0.04, 0.04, 0, 1.0, -d / 4, C.metal); break;
    case 'mat': box(w, 0.05, d, 0, 0.03, 0, C.fabric2); break;
    case 'exam-table': box(w, 0.12, d, 0, 0.72, 0, C.white); box(w - 0.1, 0.6, d - 0.3, 0, 0.35, 0, C.metal); break;
    case 'massage-table': pad(w, 0.12, d, 0, 0.7, 0, C.white); pad(0.32, 0.07, 0.34, 0, 0.82, -d / 2 + 0.2, C.white); legs(w, d, 0.7, C.metalDark); break;
    case 'car-podium': {                                   // showroom display dais with a lit rim
      box(w, h, d, 0, h / 2, 0, C.white);
      const rim = new THREE.Mesh((cache[`rb${w}|${d}`] ||= new THREE.BoxGeometry(w + 0.1, 0.03, d + 0.1)),
        (cache.rimM ||= new THREE.MeshStandardNodeMaterial({ color: 0xdfeef6, emissive: 0x9fd4ff, emissiveIntensity: 1.1, roughness: 0.4 })));
      rim.position.set(0, h + 0.015, 0); g.add(rim); break;
    }
    case 'sink': turned('sinkP', [[0, 0], [0.07, 0], [0.05, 0.3], [0.06, 0.55], [0.2, 0.68], [0.22, 0.76], [0.2, 0.8], [0, 0.8]], 0, 0, 0, C.white, 28); break;
    case 'toilet': box(w, 0.4, d * 0.65, 0, 0.2, 0.1, C.white); box(w, 0.5, 0.16, 0, 0.53, -d / 2 + 0.1, C.white); break;
    case 'shower': box(w, 0.06, d, 0, 0.03, 0, C.white); for (const s of [[-1, 0], [0, -1]]) box(s[0] ? 0.03 : w, h, s[1] ? 0.03 : d, s[0] * (w / 2), h / 2, s[1] * (d / 2), 0xbfd4dd); cyl(0.02, h * 0.9, w / 2 - 0.08, h * 0.45, -d / 2 + 0.08, C.metal); break;
    case 'stool': turned('stoolP', [[0, 0.62], [0.17, 0.62], [0.2, 0.66], [0.17, 0.72], [0, 0.72]], 0, 0, 0, C.fabric, 20); cyl(0.035, 0.62, 0, 0.31, 0, C.metalDark); cyl(0.16, 0.03, 0, 0.02, 0, C.metalDark); break;
    case 'plant': {                                         // meshkit: turned pot + displaced foliage
      turned('potP', [[0, 0], [0.12, 0], [0.15, 0.05], [0.13, 0.26], [0.16, 0.3], [0.15, 0.33], [0, 0.33]], 0, 0, 0, 0x8a5a3a, 20);
      const fol = soft('folP', () => { const f = noise(11); return displace(sphere(0.3, { segments: 16, rings: 11 }), (x, y, z) => f(x * 5, y * 5, z * 5) * 0.12); });
      for (const [fx, fy, fz, fs, hex] of [[0, 0.62, 0, 1, C.green], [0.1, 0.86, 0.04, 0.72, 0x5c8a54], [-0.11, 0.8, -0.05, 0.6, 0x466e42]]) {
        const m = new THREE.Mesh(fol, mat(hex)); m.position.set(fx, fy, fz); m.scale.setScalar(fs); m.castShadow = true; g.add(m);
      }
      break;
    }
    case 'screen': box(w, h * 0.8, d, 0, h * 0.55, 0, C.screen); box(w + 0.2, 0.06, d + 0.05, 0, h * 0.96, 0, C.metalDark); break;
    case 'press-wall': {                                   // sponsor backdrop (the TV wall), themed canvas
      const key = 'press-wall' + (theme?.name || '');
      if (!cache[key]) { const tex = new THREE.CanvasTexture(drawPressWall(theme || { primary: 0x444, secondary: 0xddd, initials: 'FC', sponsors: ['SPONSOR'] })); tex.colorSpace = THREE.SRGBColorSpace; cache[key] = new THREE.MeshStandardNodeMaterial({ map: tex, roughness: 0.85 }); }
      box(w, h, 0.06, 0, h / 2, -0.02, C.metalDark);
      const pg = (cache[`pw${w}|${h}`] ||= new THREE.PlaneGeometry(w - 0.06, h - 0.12));
      const pm = new THREE.Mesh(pg, cache[key]); pm.position.set(0, h / 2, 0.015); g.add(pm);
      for (const s of [-1, 1]) box(0.07, 0.07, 0.5, s * (w / 2 - 0.1), 0.035, 0.12, C.metalDark);   // feet
      break;
    }
    case 'press-desk': {                                   // podium desk: club-cloth skirt, top, 3 mics
      const skirtKey = 'skirt' + (theme?.primary ?? '');
      if (!cache[skirtKey]) cache[skirtKey] = new THREE.MeshStandardNodeMaterial({ color: theme?.primary ?? C.fabric, roughness: 0.9 });
      const sk = new THREE.Mesh((cache[`b${w}|0.72|${d}`] ||= new THREE.BoxGeometry(w, 0.72, d)), cache[skirtKey]);
      sk.position.set(0, 0.36, 0); sk.castShadow = sk.receiveShadow = true; g.add(sk);
      box(w + 0.06, 0.05, d + 0.06, 0, 0.75, 0, C.white);
      for (const s of [-1, 0, 1]) { cyl(0.012, 0.22, s * w / 4, 0.88, 0.08, C.metalDark); box(0.05, 0.05, 0.05, s * w / 4, 1.0, 0.11, C.screen); }
      break;
    }
    case 'tripod-cam': {                                   // TV camera on a tripod, at the back of the room
      for (const a of [0, 2.1, -2.1]) cyl(0.02, 1.15, Math.sin(a) * 0.2, 0.55, Math.cos(a) * 0.2, C.metalDark);
      box(0.22, 0.2, 0.4, 0, 1.25, 0, C.screen); cyl(0.07, 0.16, 0, 1.25, 0.26, C.metalDark);
      break;
    }
    case 'jersey-frame': case 'crest-panel': {
      const key = item.kind + (theme?.name || '');
      if (!cache[key]) { const tex = new THREE.CanvasTexture(item.kind === 'jersey-frame' ? drawJersey(theme || { primary: 0x444, secondary: 0xddd, accent: 0xfff, initials: 'FC' }) : drawCrest(theme || { primary: 0x444, secondary: 0xddd, accent: 0xfff, initials: 'FC' })); tex.colorSpace = THREE.SRGBColorSpace; cache[key] = new THREE.MeshStandardNodeMaterial({ map: tex, roughness: 0.7 }); }
      box(w, w, 0.05, 0, 1.55, 0.01, C.woodDark);
      const pg = (cache[`pg${w}`] ||= new THREE.PlaneGeometry(w - 0.1, w - 0.1));
      const pm = new THREE.Mesh(pg, cache[key]); pm.position.set(0, 1.55, 0.045); g.add(pm); break;
    }
    default: box(w, h, d, 0, h / 2, 0, C.wood);
  }
  g.rotation.y = item.yaw;
  return g;
}

/** Build ALL items of a furnishing into a parent group + physics collider boxes. */
export function buildFurnishing(items, model, { at = [0, 0, 0], theme = null } = {}) {
  const group = new THREE.Group(); group.position.set(at[0], at[1], at[2]);
  const cache = {}; const colliders = [];
  for (const it of items) {
    const y = model.floors[it.floor].y;
    const sub = buildFurnitureItem(it, cache, theme);
    sub.position.set(it.x, y, it.z); group.add(sub);
    const swap = Math.abs(Math.sin(it.yaw)) > 0.5;
    colliders.push({ pos: [at[0] + it.x, at[1] + y + it.h / 2, at[2] + it.z], half: [swap ? it.d / 2 : it.w / 2, it.h / 2, swap ? it.w / 2 : it.d / 2] });
  }
  return { group, colliders, dispose: () => Object.values(cache).forEach((o) => o.dispose?.()) };
}
