import * as THREE from 'three/webgpu';

// city-builder — turn a city model (engine/city.js, pure data) into the world: asphalt street strips
// (merged cell runs, dashed centre lines), INSTANCED buildings with per-instance color (one draw call
// for the whole skyline), instanced trees and streetlights, a crosswalk at every curb stop. Returns
// colliders for the buildings (the player can't walk through the city) — streets/trees stay open.
export function buildCity(city, { at = [0, 0, 0] } = {}) {
  const group = new THREE.Group(); group.position.set(at[0], at[1], at[2]);
  const disposables = [], colliders = [];
  const mat = (o) => { const m = new THREE.MeshStandardNodeMaterial(o); disposables.push(m); return m; };
  const { nx, nz, cell: C, bounds, road } = city;
  const id = (i, j) => j * nx + i;
  const centre = (i, j) => [bounds[0] + (i + 0.5) * C, bounds[1] + (j + 0.5) * C];

  // streets: merge per-row runs of road cells into strips (each road cell rendered exactly once)
  const asphalt = mat({ color: 0x3d4045, roughness: 0.95 });
  const runs = [];
  for (let j = 0; j < nz; j++) {
    let i = 0;
    while (i < nx) {
      if (!road[id(i, j)]) { i++; continue; }
      let e = i; while (e < nx && road[id(e, j)]) e++;
      runs.push([i, j, e - i]); i = e;
    }
  }
  for (const [i, j, len] of runs) {
    const g = new THREE.PlaneGeometry(len * C, C); g.rotateX(-Math.PI / 2); disposables.push(g);
    const m = new THREE.Mesh(g, asphalt);
    m.position.set(bounds[0] + (i + len / 2) * C, 0.015, bounds[1] + (j + 0.5) * C);
    m.receiveShadow = true; group.add(m);
  }
  // dashed centre lines on straight stretches (both orientations), instanced
  const dashes = [];
  for (const [i, j, len] of runs) if (len >= 3) for (let k = 0; k < len * 2 - 1; k++) dashes.push([bounds[0] + i * C + (k + 0.5) * C / 2, bounds[1] + (j + 0.5) * C, 0]);
  for (let i = 0; i < nx; i++) {                                    // column runs → vertical dashes
    let j = 0;
    while (j < nz) {
      if (!road[id(i, j)]) { j++; continue; }
      let e = j; while (e < nz && road[id(i, e)]) e++;
      if (e - j >= 3) for (let k = 0; k < (e - j) * 2 - 1; k++) dashes.push([bounds[0] + (i + 0.5) * C, bounds[1] + j * C + (k + 0.5) * C / 2, 1]);
      j = e;
    }
  }
  if (dashes.length) {
    const dg = new THREE.PlaneGeometry(1.3, 0.16); dg.rotateX(-Math.PI / 2); disposables.push(dg);
    const dm = new THREE.InstancedMesh(dg, mat({ color: 0xe8eaee, roughness: 0.8 }), dashes.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    dashes.forEach(([x, z, vert], k) => {
      q.setFromAxisAngle(up, vert ? Math.PI / 2 : 0);
      m4.compose(new THREE.Vector3(x, 0.03, z), q, new THREE.Vector3(1, 1, 1));
      dm.setMatrixAt(k, m4);
    });
    dm.instanceMatrix.needsUpdate = true; group.add(dm); disposables.push(dm);
  }
  // pavement: sidewalk/plaza concrete on every derived pavement cell (merged row runs) — a curb-step
  // above the asphalt, below the dashes. This kills the boxes-on-a-lawn look: parcels are PAVED.
  if (city.pavement?.length) {
    const paveM = mat({ color: 0x7f7c74, roughness: 0.95 });
    const inPave = new Set(city.pavement.map(([i, j]) => id(i, j)));
    for (let j = 0; j < nz; j++) {
      let i = 0;
      while (i < nx) {
        if (!inPave.has(id(i, j))) { i++; continue; }
        let e = i; while (e < nx && inPave.has(id(e, j))) e++;
        const g = new THREE.PlaneGeometry((e - i) * C, C); g.rotateX(-Math.PI / 2); disposables.push(g);
        const m = new THREE.Mesh(g, paveM);
        m.position.set(bounds[0] + (i + (e - i) / 2) * C, 0.022, bounds[1] + (j + 0.5) * C);
        m.receiveShadow = true; group.add(m);
        i = e;
      }
    }
  }
  // crosswalk stripes at every curb stop
  const cwg = new THREE.PlaneGeometry(0.5, 3.4); cwg.rotateX(-Math.PI / 2); disposables.push(cwg);
  const cwm = mat({ color: 0xdde1e6, roughness: 0.8 });
  for (const k of Object.keys(city.stops)) {
    const [x, z] = city.stops[k].pos;
    for (let s = -2; s <= 2; s++) { const m = new THREE.Mesh(cwg, cwm); m.position.set(x + s * 1.0, 0.025, z); group.add(m); }
  }

  // buildings: instanced FAÇADES with real windows — instances are BUCKETED by floor count so the
  // window texture has the right number of rows for the height class (one shared texture would
  // stretch: a 22 m tower would wear 4 giant windows). Each bucket = one InstancedMesh with a
  // material ARRAY (sides = façade albedo + emissive lit-window map, top/bottom = dark roof) and
  // per-instance color tinting the walls. Deterministic canvas textures (no Math.random).
  if (city.buildings.length) {
    const roofM = mat({ color: 0x44423e, roughness: 0.95 });
    const floorsOf = (h) => Math.max(1, Math.min(12, Math.round(h / 3)));
    const buckets = new Map();
    city.buildings.forEach((b, k) => {
      const f = floorsOf(b.h);
      if (!buckets.has(f)) buckets.set(f, []);
      buckets.get(f).push(b);
      colliders.push({ pos: [at[0] + b.x, at[1] + b.h / 2, at[2] + b.z], half: [b.w / 2, b.h / 2, b.d / 2] });
    });
    const facadeTex = (floors) => {
      const W = 96, RH = 40, H = floors * RH;
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const ec = document.createElement('canvas'); ec.width = W; ec.height = H;
      const g = cv.getContext('2d'), e = ec.getContext('2d');
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H);                      // wall = white, tinted per instance
      e.fillStyle = '#000000'; e.fillRect(0, 0, W, H);
      let s = floors * 2654435761 >>> 0;                                    // deterministic per bucket
      const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
      for (let r = 0; r < floors; r++) {
        for (let c = 0; c < 3; c++) {
          const x = 8 + c * 30, y = H - (r + 1) * RH + 9, w = 20, h = 22;   // row 0 at the BOTTOM
          const lit = rnd() < 0.30;
          g.fillStyle = lit ? '#ffedc4' : (rnd() < 0.5 ? '#232b36' : '#2e3946'); g.fillRect(x, y, w, h);
          if (lit) { e.fillStyle = '#ffd9a0'; e.fillRect(x, y, w, h); }
        }
        g.fillStyle = 'rgba(0,0,0,0.13)'; g.fillRect(0, H - r * RH - 2, W, 2);   // floor slab shadow line
      }
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
      const et = new THREE.CanvasTexture(ec); et.colorSpace = THREE.SRGBColorSpace;
      disposables.push(t, et);
      return { map: t, emissiveMap: et };
    };
    const m4 = new THREE.Matrix4(), col = new THREE.Color();
    for (const [floors, list] of buckets) {
      const bg = new THREE.BoxGeometry(1, 1, 1); disposables.push(bg);
      const { map, emissiveMap } = facadeTex(floors);
      const sideM = mat({ map, emissiveMap, emissive: 0xffffff, emissiveIntensity: 0.5, roughness: 0.85 });
      const bm = new THREE.InstancedMesh(bg, [sideM, sideM, roofM, roofM, sideM, sideM], list.length);
      bm.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(list.length * 3), 3);
      list.forEach((b, k) => {
        m4.makeScale(b.w, b.h, b.d); m4.setPosition(b.x, b.h / 2, b.z);
        bm.setMatrixAt(k, m4);
        col.set(b.color); bm.instanceColor.setXYZ(k, col.r, col.g, col.b);
      });
      bm.instanceMatrix.needsUpdate = true; bm.instanceColor.needsUpdate = true;
      bm.castShadow = bm.receiveShadow = true; group.add(bm); disposables.push(bm);
    }
  }
  // trees: instanced trunk + foliage
  if (city.trees.length) {
    const tg = new THREE.CylinderGeometry(0.09, 0.13, 1.1, 6), fg = new THREE.ConeGeometry(1.15, 2.6, 7);
    disposables.push(tg, fg);
    const tm = new THREE.InstancedMesh(tg, mat({ color: 0x6b4a2f, roughness: 0.9 }), city.trees.length);
    const fm = new THREE.InstancedMesh(fg, mat({ roughness: 0.85 }), city.trees.length);
    fm.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(city.trees.length * 3), 3);
    const m4 = new THREE.Matrix4(), col = new THREE.Color();
    city.trees.forEach(([x, z], k) => {
      m4.identity(); m4.setPosition(x, 0.55, z); tm.setMatrixAt(k, m4);
      const s = 0.8 + ((x * 13 + z * 7) % 10) / 18;
      m4.makeScale(s, s, s); m4.setPosition(x, 1.0 + 1.3 * s, z); fm.setMatrixAt(k, m4);
      col.setHSL(0.29 + ((x + z * 3) % 8) / 90, 0.42, 0.3); fm.instanceColor.setXYZ(k, col.r, col.g, col.b);
    });
    tm.instanceMatrix.needsUpdate = fm.instanceMatrix.needsUpdate = true; fm.instanceColor.needsUpdate = true;
    fm.castShadow = true; group.add(tm, fm); disposables.push(tm, fm);
  }
  // streetlights: instanced pole + warm emissive head
  if (city.lights.length) {
    const pg = new THREE.CylinderGeometry(0.05, 0.07, 4.2, 6), hg = new THREE.BoxGeometry(0.35, 0.14, 0.2);
    disposables.push(pg, hg);
    const pm = new THREE.InstancedMesh(pg, mat({ color: 0x3a3f46, roughness: 0.6, metalness: 0.5 }), city.lights.length);
    const hm = new THREE.InstancedMesh(hg, mat({ color: 0xfff2d0, emissive: 0xffe6b0, emissiveIntensity: 1.4, roughness: 0.4 }), city.lights.length);
    const m4 = new THREE.Matrix4();
    city.lights.forEach(([x, z], k) => {
      m4.identity(); m4.setPosition(x, 2.1, z); pm.setMatrixAt(k, m4);
      m4.identity(); m4.setPosition(x, 4.25, z); hm.setMatrixAt(k, m4);
    });
    pm.instanceMatrix.needsUpdate = hm.instanceMatrix.needsUpdate = true;
    group.add(pm, hm); disposables.push(pm, hm);
  }
  return { group, colliders, dispose: () => disposables.forEach((d) => d.dispose?.()) };
}
