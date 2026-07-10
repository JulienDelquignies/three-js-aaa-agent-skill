import * as THREE from 'three/webgpu';

// circuit-builder — turn a circuit model (engine/circuit.js) into the track day: the asphalt RIBBON
// triangulated from the centreline, red/white kerbs at the edges (instanced), white barriers offset
// outside both edges (instanced + physics colliders with per-segment yaw — the car bounces off, it
// doesn't fly into the fields), the start gantry with a checkered banner, and the paddock slab.
// LOCAL circuit space — place the group at the resort-style world offset, add colliders with it.
export function buildCircuit(circuit, { theme = null } = {}) {
  const group = new THREE.Group();
  const disposables = [], colliders = [];
  const mat = (o) => { const m = new THREE.MeshStandardNodeMaterial(o); disposables.push(m); return m; };
  const { pts, width } = circuit, n = pts.length;
  const normal = (i) => {
    const a = pts[(i + n - 1) % n], b = pts[(i + 1) % n];
    const tx = b[0] - a[0], tz = b[1] - a[1], l = Math.hypot(tx, tz) || 1;
    return [-tz / l, tx / l];
  };

  // the asphalt ribbon (one BufferGeometry, closed)
  const pos = [], idx = [];
  for (let i = 0; i < n; i++) {
    const [nx, nz] = normal(i), [x, z] = pts[i];
    pos.push(x + nx * width / 2, 0.03, z + nz * width / 2, x - nx * width / 2, 0.03, z - nz * width / 2);
  }
  for (let i = 0; i < n; i++) {
    const a = i * 2, b = ((i + 1) % n) * 2;
    idx.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const rg = new THREE.BufferGeometry();
  rg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  rg.setIndex(idx); rg.computeVertexNormals();
  const ribbon = new THREE.Mesh(rg, mat({ color: 0x33363c, roughness: 0.95, side: THREE.DoubleSide }));
  ribbon.receiveShadow = true; group.add(ribbon); disposables.push(rg);

  // kerbs: short red/white slabs alternating along both edges (instanced)
  const kg = new THREE.BoxGeometry(0.55, 0.05, 2.4); disposables.push(kg);
  const reds = [], whites = [];
  for (let i = 0; i < n; i += 2) {
    const [nx, nz] = normal(i), [x, z] = pts[i];
    const yaw = Math.atan2(pts[(i + 1) % n][0] - x, pts[(i + 1) % n][1] - z);
    for (const s of [1, -1]) (((i / 2) | 0) % 2 ? reds : whites).push([x + nx * s * (width / 2 + 0.25), z + nz * s * (width / 2 + 0.25), yaw]);
  }
  for (const [list, color] of [[reds, 0xc9403a], [whites, 0xe8e6e0]]) {
    if (!list.length) continue;
    const im = new THREE.InstancedMesh(kg, mat({ color, roughness: 0.8 }), list.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    list.forEach(([x, z, yaw], k) => { q.setFromAxisAngle(up, yaw); m4.compose(new THREE.Vector3(x, 0.035, z), q, new THREE.Vector3(1, 1, 1)); im.setMatrixAt(k, m4); });
    im.instanceMatrix.needsUpdate = true; group.add(im); disposables.push(im);
  }

  // barriers: white rails offset 3 m outside both edges, one per sample pair — SOLID (yaw colliders)
  const bg = new THREE.BoxGeometry(0.18, 0.8, 6.2); disposables.push(bg);
  const rails = [];
  for (let i = 0; i < n; i += 2) {
    const [nx, nz] = normal(i), [x, z] = pts[i];
    const j = (i + 2) % n;
    const yaw = Math.atan2(pts[j][0] - x, pts[j][1] - z);
    for (const s of [1, -1]) rails.push([x + nx * s * (width / 2 + 3), z + nz * s * (width / 2 + 3), yaw]);
  }
  const rim = new THREE.InstancedMesh(bg, mat({ color: 0xf2f1ec, roughness: 0.6 }), rails.length);
  {
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    rails.forEach(([x, z, yaw], k) => {
      q.setFromAxisAngle(up, yaw); m4.compose(new THREE.Vector3(x, 0.4, z), q, new THREE.Vector3(1, 1, 1));
      rim.setMatrixAt(k, m4);
      colliders.push({ pos: [x, 0.4, z], half: [0.09, 0.4, 3.1], yaw });
    });
    rim.instanceMatrix.needsUpdate = true; group.add(rim); disposables.push(rim);
  }

  // start gantry: posts + beam + checkered banner across the line
  {
    const { pos: sp, dir } = circuit.start;
    const nx = -dir[1], nz = dir[0];
    const pg = new THREE.CylinderGeometry(0.12, 0.12, 5.2, 10); disposables.push(pg);
    const pm = mat({ color: 0x3a3f46, roughness: 0.6, metalness: 0.4 });
    for (const s of [1, -1]) { const p = new THREE.Mesh(pg, pm); p.position.set(sp[0] + nx * s * (width / 2 + 1), 2.6, sp[1] + nz * s * (width / 2 + 1)); p.castShadow = true; group.add(p); }
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 32;
    const g2 = cv.getContext('2d');
    for (let i = 0; i < 16; i++) for (let j = 0; j < 4; j++) { g2.fillStyle = (i + j) % 2 ? '#111' : '#fff'; g2.fillRect(i * 8, j * 8, 8, 8); }
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; disposables.push(tex);
    const bg2 = new THREE.BoxGeometry(width + 2, 0.9, 0.1); disposables.push(bg2);
    const banner = new THREE.Mesh(bg2, mat({ map: tex, roughness: 0.7 }));
    banner.position.set(sp[0], 4.7, sp[1]);
    banner.rotation.y = Math.atan2(nx, nz);
    group.add(banner);
  }

  // paddock slab (spawn + return pad live in the data; the scene wires the interactables)
  const pk = circuit.paddock;
  const sg = new THREE.PlaneGeometry(14, 10); sg.rotateX(-Math.PI / 2); disposables.push(sg);
  const slab = new THREE.Mesh(sg, mat({ color: 0x7d7a72, roughness: 0.95 }));
  slab.position.set((pk.spawn[0] + pk.returnPad[0]) / 2, 0.02, (pk.spawn[1] + pk.returnPad[1]) / 2);
  slab.receiveShadow = true; group.add(slab);

  return { group, colliders, dispose: () => disposables.forEach((d) => d.dispose?.()) };
}
