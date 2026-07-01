import * as THREE from 'three/webgpu';
import { createNoise2D } from 'simplex-noise';
import alea from 'alea';

// Procedural world — a seeded fBm-noise terrain with height-based coloring and instanced scatter (rocks
// + low-poly trees) sampled on its surface. Deterministic from a seed. Demonstrates reference/06–08.
export class Procedural {
  constructor(scene) {
    this.scene = scene; this.disposables = [];
    this.world = new THREE.Group(); scene.add(this.world);
    const prng = alea('threejs-aaa');
    const noise = createNoise2D(prng);
    const SIZE = 40, SEG = 140, H = 6;
    const fbm = (x, z) => { let a = 1, f = 0.04, v = 0; for (let o = 0; o < 5; o++) { v += a * noise(x * f, z * f); a *= 0.5; f *= 2; } return v; };
    const height = (x, z) => { const ridge = Math.pow(Math.max(0, fbm(x, z)), 1.2); return ridge * H - 1.2; };

    // terrain
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG); geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position; const colors = new Float32Array(pos.count * 3);
    const low = new THREE.Color(0x22303a), mid = new THREE.Color(0x3f7d3a), hi = new THREE.Color(0x9aa6b2), snow = new THREE.Color(0xf2f6fb);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i); const y = height(x, z); pos.setY(i, y);
      const h = THREE.MathUtils.clamp((y + 1.5) / (H), 0, 1);
      if (h < 0.28) c.copy(low).lerp(mid, h / 0.28);
      else if (h < 0.62) c.copy(mid).lerp(hi, (h - 0.28) / 0.34);
      else c.copy(hi).lerp(snow, (h - 0.62) / 0.38);
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3)); geo.computeVertexNormals();
    const tmat = new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
    const terrain = new THREE.Mesh(geo, tmat); terrain.receiveShadow = true; terrain.castShadow = true;
    this.world.add(terrain); this.disposables.push(geo, tmat);

    // water plane
    const wgeo = new THREE.PlaneGeometry(SIZE, SIZE); wgeo.rotateX(-Math.PI / 2);
    const wmat = new THREE.MeshPhysicalNodeMaterial({ color: 0x2a5b7a, roughness: 0.08, metalness: 0, transmission: 0.4, ior: 1.33 });
    const water = new THREE.Mesh(wgeo, wmat); water.position.y = -0.35; this.world.add(water); this.disposables.push(wgeo, wmat);

    // instanced scatter: rocks on mid slopes, trees on green band
    const rng = alea('scatter');
    const rockGeo = new THREE.DodecahedronGeometry(0.28, 0); const rockMat = new THREE.MeshStandardNodeMaterial({ color: 0x6b6f76, roughness: 1, flatShading: true });
    const trunkGeo = new THREE.CylinderGeometry(0.06, 0.09, 0.6, 6); const trunkMat = new THREE.MeshStandardNodeMaterial({ color: 0x5a3d24, roughness: 1 });
    const leafGeo = new THREE.ConeGeometry(0.4, 1.0, 7); const leafMat = new THREE.MeshStandardNodeMaterial({ color: 0x2f6b34, roughness: 1, flatShading: true });
    this.disposables.push(rockGeo, rockMat, trunkGeo, trunkMat, leafGeo, leafMat);
    const rocks = new THREE.InstancedMesh(rockGeo, rockMat, 220);
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, 160);
    const leaves = new THREE.InstancedMesh(leafGeo, leafMat, 160);
    rocks.castShadow = trunks.castShadow = leaves.castShadow = true;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sV = new THREE.Vector3();
    let ri = 0, ti = 0;
    for (let n = 0; n < 1400 && (ri < 220 || ti < 160); n++) {
      const x = (rng() - 0.5) * SIZE * 0.92, z = (rng() - 0.5) * SIZE * 0.92; const y = height(x, z);
      const h = (y + 1.5) / H;
      if (h > 0.3 && h < 0.6 && ti < 160 && rng() > 0.35) {
        const s = 0.7 + rng() * 0.8;
        m.compose(new THREE.Vector3(x, y + 0.3 * s, z), q.setFromAxisAngle(sV.set(0, 1, 0), rng() * 6.28), sV.set(s, s, s)); trunks.setMatrixAt(ti, m);
        m.compose(new THREE.Vector3(x, y + 0.9 * s, z), q, sV.set(s, s, s)); leaves.setMatrixAt(ti, m); ti++;
      } else if (ri < 220 && h > 0.15) {
        const s = 0.5 + rng() * 1.3;
        m.compose(new THREE.Vector3(x, y + 0.1 * s, z), q.setFromEuler(new THREE.Euler(rng() * 6.28, rng() * 6.28, rng() * 6.28)), sV.set(s, s, s)); rocks.setMatrixAt(ri, m); ri++;
      }
    }
    rocks.count = ri; trunks.count = ti; leaves.count = ti;
    rocks.instanceMatrix.needsUpdate = trunks.instanceMatrix.needsUpdate = leaves.instanceMatrix.needsUpdate = true;
    this.world.add(rocks, trunks, leaves);
    this.t = 0;
  }

  camera(cam, controls) {
    cam.position.set(16, 12, 20); cam.lookAt(0, 1, 0);
    if (controls) { controls.target.set(0, 1.5, 0); controls.minDistance = 8; controls.maxDistance = 60; controls.update(); }
  }

  update(dt) { this.t += dt; this.world.rotation.y += dt * 0.05; }
  dispose() { for (const d of this.disposables) d.dispose?.(); }
}
