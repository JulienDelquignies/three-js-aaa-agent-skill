import * as THREE from 'three/webgpu';

// rondo-props — the two small props the possession scene needs: the grid painted on the grass and
// the match ball. Kept out of Rondo.js so the scene file stays about the GAME.

/** The training grid, painted in cones and a chalk outline, sitting just above the grass. */
export function buildRondoGrid([w, d]) {
  const group = new THREE.Group();
  const disposables = [];

  // chalk outline: four thin strips, lifted 1 cm so they never z-fight with the pitch plane
  const chalk = new THREE.MeshStandardNodeMaterial({ color: 0xf2f6f2, roughness: 0.95, metalness: 0 });
  disposables.push(chalk);
  const strip = (sx, sz, x, z) => {
    const g = new THREE.PlaneGeometry(sx, sz); g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, chalk); m.position.set(x, 0.011, z); m.receiveShadow = false;
    group.add(m); disposables.push(g);
  };
  strip(w, 0.12, 0, -d / 2); strip(w, 0.12, 0, d / 2);
  strip(0.12, d, -w / 2, 0); strip(0.12, d, w / 2, 0);

  // training cones on the corners and mid-sides — instanced, one draw call
  const cone = new THREE.ConeGeometry(0.16, 0.3, 10);
  const coneMat = new THREE.MeshStandardNodeMaterial({ color: 0xff7a1a, roughness: 0.6, emissive: 0x2a0f00 });
  const spots = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) spots.push([sx * w / 2, sz * d / 2]);
  for (const sx of [-1, 1]) spots.push([sx * w / 2, 0]);
  for (const sz of [-1, 1]) spots.push([0, sz * d / 2]);
  const inst = new THREE.InstancedMesh(cone, coneMat, spots.length);
  const m4 = new THREE.Matrix4();
  spots.forEach(([x, z], i) => { m4.makeTranslation(x, 0.15, z); inst.setMatrixAt(i, m4); });
  inst.castShadow = true;
  group.add(inst); disposables.push(cone, coneMat);

  return { group, dispose: () => { for (const d2 of disposables) d2.dispose?.(); } };
}

/** A match ball: FIFA radius, classic panel look, and it casts a shadow (the contact shadow under
 *  a ball is most of what tells you how high it is). */
export function ballMesh(radius = 0.11) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#f4f5f7'; g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#15171c';
  for (let i = 0; i < 12; i++) {
    const x = (i % 4) * 64 + 32, y = ((i / 4) | 0) * 85 + 42;
    g.beginPath();
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
      const px = x + Math.cos(a) * 19, py = y + Math.sin(a) * 19;
      k ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.closePath(); g.fill();
  }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const geo = new THREE.SphereGeometry(radius, 32, 24);
  const mat = new THREE.MeshStandardNodeMaterial({ map: tex, roughness: 0.42, metalness: 0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.dispose = () => { geo.dispose(); mat.dispose(); tex.dispose(); };
  return mesh;
}
