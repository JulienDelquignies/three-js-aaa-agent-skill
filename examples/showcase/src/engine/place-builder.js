import * as THREE from 'three/webgpu';
import { wallBoxes, WALL_H, SLAB_T } from './floorplan.js';

// place-builder — turn a floorplan model (engine/floorplan.js, pure data) into the world: wall meshes with
// real door/window holes (from wallBoxes), per-room floor slabs, stairs steps, upper slabs with a stairwell
// hole, pool/terrace — and the SAME boxes as physics colliders (feed to Physics.addStaticBox). Dollhouse
// mode (no ceilings) so an orbit camera can look inside; a game can add ceilings per room later.
const ROOM_COLORS = {
  couloir: 0x8b93a3, hall: 0x8b93a3, palier: 0x8b93a3,
  vestiaire: 0x4f7a99, vestiaire2: 0x4f7a99, gym: 0x996d4f, spa: 0x4f9987, infirmerie: 0x99a3ad,
  'salle-video': 0x5d5f8f, cafeteria: 0xa38a4f, bureau: 0x7a7f8c, 'bureaux-staff': 0x7a7f8c, stockage: 0x6b7078, auditorium: 0x8f5d70,
  sejour: 0xa3865f, 'sejour-cuisine': 0xa3865f, cuisine: 0x9c9c55, chambre: 0x5f7aa3, chambre2: 0x5f7aa3, chambre3: 0x5f7aa3,
  suite: 0x5f7aa3, sdb: 0x5fa39c, 'sdb-suite': 0x5fa39c, sdb2: 0x5fa39c,
};
const rectMinus = (r, hole) => {                        // rect minus hole → up to 4 rects (for slab holes)
  const out = []; const [x0, z0, x1, z1] = r, [hx0, hz0, hx1, hz1] = hole;
  if (hx0 <= x0 && hx1 >= x1 && hz0 <= z0 && hz1 >= z1) return out;
  if (hx1 <= x0 || hx0 >= x1 || hz1 <= z0 || hz0 >= z1) return [r];
  if (hz0 > z0) out.push([x0, z0, x1, hz0]);
  if (hz1 < z1) out.push([x0, hz1, x1, z1]);
  out.push([x0, Math.max(z0, hz0), hx0, Math.min(z1, hz1)]);
  out.push([hx1, Math.max(z0, hz0), x1, Math.min(z1, hz1)]);
  return out.filter((q) => q[2] - q[0] > 0.01 && q[3] - q[1] > 0.01);
};

export function buildPlace(model, { at = [0, 0, 0], theme = null } = {}) {
  const group = new THREE.Group(); group.position.set(at[0], at[1], at[2]);
  const disposables = [], colliders = [];
  const wallMat = new THREE.MeshStandardNodeMaterial({ color: 0xb9b3a6, roughness: 0.95 });
  const slabMat = (hex) => { const m = new THREE.MeshStandardNodeMaterial({ color: hex, roughness: 0.85 }); disposables.push(m); return m; };
  disposables.push(wallMat);
  const addBox = (c, h, mat, solid = true) => {
    const g = new THREE.BoxGeometry(h[0] * 2, h[1] * 2, h[2] * 2); disposables.push(g);
    const mesh = new THREE.Mesh(g, mat); mesh.position.set(c[0], c[1], c[2]); mesh.castShadow = mesh.receiveShadow = true; group.add(mesh);
    if (solid) colliders.push({ pos: [at[0] + c[0], at[1] + c[1], at[2] + c[2]], half: [h[0], h[1], h[2]] });
    return mesh;
  };

  for (const [fi, f] of model.floors.entries()) {
    const y = f.y;
    // floor slabs per room (upper floors get a stairwell hole in the hub slab)
    for (const r of f.rooms) {
      let rects = [r.rect];
      if (fi > 0 && model.stairs && r.id === f.hubId) rects = rectMinus(r.rect, model.stairs.rect);
      for (const [x0, z0, x1, z1] of rects)
        addBox([(x0 + x1) / 2, y - SLAB_T / 2, (z0 + z1) / 2], [(x1 - x0) / 2, SLAB_T / 2, (z1 - z0) / 2],
          slabMat(theme && r.id === f.hubId ? theme.primary : ROOM_COLORS[r.id] ?? 0x777d88));
    }
    for (const w of f.walls) for (const b of wallBoxes(w, { y })) addBox(b.c, b.h, wallMat);
    // translucent panes in window/glass openings (visual only, no collider)
    const glassMat = (this && null) || null;
    for (const w of f.walls) for (const o of w.openings) {
      if (o.type !== 'window' && o.type !== 'glass') continue;
      const ux = Math.sign(w.b[0] - w.a[0]), uz = Math.sign(w.b[1] - w.a[1]);
      const cx = w.a[0] + ux * o.at, cz = w.a[1] + uz * o.at;
      const gm = new THREE.MeshPhysicalNodeMaterial({ color: 0xcfe6f0, roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.28 }); disposables.push(gm);
      const gg = new THREE.BoxGeometry(ux ? o.w : 0.03, o.h, uz ? o.w : 0.03); disposables.push(gg);
      const pane = new THREE.Mesh(gg, gm); pane.position.set(cx, y + o.sill + o.h / 2, cz); group.add(pane);
    }
  }
  if (model.stairs) {                                    // straight run of steps up the hub
    const s = model.stairs; const stepMat = slabMat(0xb9b2a5);
    for (let i = 0; i < s.risers; i++) {
      const x0 = s.rect[0] + i * s.going;
      addBox([x0 + s.going / 2, (i + 1) * s.riser - s.riser / 2, (s.rect[1] + s.rect[3]) / 2], [s.going / 2, s.riser / 2, s.width / 2], stepMat);
    }
  }
  if (model.outdoor?.pitches) {                          // club training pitches (north side, facing the glass offices)
    for (const r of model.outdoor.pitches) {
      const pgeo = new THREE.PlaneGeometry(r[2] - r[0], r[3] - r[1]); pgeo.rotateX(-Math.PI / 2); disposables.push(pgeo);
      const c = document.createElement('canvas'); c.width = 256; c.height = 176; const g2 = c.getContext('2d');
      for (let i = 0; i < 8; i++) { g2.fillStyle = i % 2 ? '#3f9a3f' : '#368636'; g2.fillRect(i / 8 * 256, 0, 32, 176); }
      g2.strokeStyle = '#eef4ee'; g2.lineWidth = 3; g2.strokeRect(8, 8, 240, 160); g2.beginPath(); g2.moveTo(128, 8); g2.lineTo(128, 168); g2.stroke();
      const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; disposables.push(tx);
      const pm = new THREE.Mesh(pgeo, slabMat(0xffffff)); pm.material.map = tx; pm.receiveShadow = true;
      pm.position.set((r[0] + r[2]) / 2, -0.02, (r[1] + r[3]) / 2); group.add(pm);
    }
  }
  if (model.outdoor?.pool) {                             // terrace + pool basin
    const t = model.outdoor.terrace, p = model.outdoor.pool;
    addBox([(t[0] + t[2]) / 2, -SLAB_T / 2, (t[1] + t[3]) / 2], [(t[2] - t[0]) / 2, SLAB_T / 2, (t[3] - t[1]) / 2], slabMat(0xcfc6b8));
    const water = new THREE.MeshPhysicalNodeMaterial({ color: 0x2d7fa8, roughness: 0.05, transmission: 0.5, ior: 1.33 }); disposables.push(water);
    const g = new THREE.BoxGeometry(p[2] - p[0], 0.5, p[3] - p[1]); disposables.push(g);
    const pool = new THREE.Mesh(g, water); pool.position.set((p[0] + p[2]) / 2, -0.3, (p[1] + p[3]) / 2); group.add(pool);
  }
  return { group, colliders, dispose: () => disposables.forEach((d) => d.dispose?.()) };
}
export { WALL_H };
