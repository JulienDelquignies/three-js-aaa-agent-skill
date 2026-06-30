import * as THREE from 'three/webgpu';
import { createNoise2D } from 'simplex-noise';
import alea from 'alea';
import { subRng } from '../engine/rng.js';

/**
 * Demo world: a procedurally displaced ground, a PBR material showcase row, and a field of
 * instanced props scattered with a seeded PRNG. Replace this with your game content; the
 * engine (renderer/IBL/shadows/post) is reused as-is.
 */
export class World {
  constructor(scene, { seed = 'aaa-starter' } = {}) {
    this.scene = scene;
    this.seed = seed;
    this.disposables = [];
    this._build();
  }

  _build() {
    this._buildGround();
    this._buildMaterialShowcase();
    this._buildScatter();
  }

  // Procedural heightmap ground via simplex fBm. PlaneGeometry is XY, so we displace Z
  // before rotating it flat; height becomes world Y after rotateX(-PI/2).
  _buildGround() {
    const size = 60, seg = 200, maxHeight = 1.6;
    const noise2D = createNoise2D(alea(`${this.seed}:terrain`));
    const fbm = (x, y) => {
      let amp = 1, freq = 0.04, sum = 0, norm = 0;
      for (let o = 0; o < 5; o++) { sum += amp * noise2D(x * freq, y * freq); norm += amp; amp *= 0.5; freq *= 2; }
      return sum / norm;
    };

    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const h = fbm(pos.getX(i), pos.getZ(i)) * maxHeight;
      pos.setY(i, h - 1.2); // sink slightly so the showcase sits near y=0
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();      // REQUIRED after displacement
    geo.computeBoundingSphere();

    const mat = new THREE.MeshStandardNodeMaterial({ color: 0x4a5240, roughness: 0.95, metalness: 0.0 });
    const ground = new THREE.Mesh(geo, mat);
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.disposables.push(geo, mat);
    this.ground = ground;
  }

  // A 5×2 grid of spheres sweeping roughness × metalness to show PBR + IBL response.
  _buildMaterialShowcase() {
    const geo = new THREE.SphereGeometry(0.6, 48, 32);
    this.disposables.push(geo);
    for (let m = 0; m < 2; m++) {
      for (let r = 0; r < 5; r++) {
        const mat = new THREE.MeshStandardNodeMaterial({
          color: m ? 0xffd9a0 : 0x88a0c0,
          metalness: m,
          roughness: 0.05 + r * 0.22,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set((r - 2) * 1.6, 1.0 + m * 1.6, 0);
        mesh.castShadow = true;
        this.scene.add(mesh);
        this.disposables.push(mat);
      }
    }
  }

  // Instanced props scattered with a seeded PRNG → reproducible, one draw call.
  _buildScatter() {
    const count = 200;
    const geo = new THREE.IcosahedronGeometry(0.25, 0);
    const mat = new THREE.MeshStandardNodeMaterial({ color: 0x6b6f76, roughness: 0.8, flatShading: true });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const rng = subRng(this.seed, 'scatter');
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const a = rng() * Math.PI * 2;
      const rad = 6 + rng() * 22;
      dummy.position.set(Math.cos(a) * rad, -0.9 + rng() * 0.4, Math.sin(a) * rad);
      dummy.rotation.set(rng() * 6.28, rng() * 6.28, rng() * 6.28);
      dummy.scale.setScalar(0.5 + rng() * 1.2);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    this.scene.add(mesh);
    this.disposables.push(geo, mat, mesh);
    this.scatter = mesh;
  }

  update(dt) {
    // Gentle rotation on the scatter field to show the loop is live.
    if (this.scatter) this.scatter.rotation.y += dt * 0.05;
  }

  dispose() {
    for (const d of this.disposables) d.dispose?.();
  }
}
