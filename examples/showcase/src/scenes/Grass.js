import * as THREE from 'three/webgpu';
import { createNoise2D } from 'simplex-noise';
import alea from 'alea';

// Instanced grass — thousands of blades scattered on a rolling ground as a single InstancedMesh, bending
// in a travelling wind. One draw call for the whole field. Demonstrates reference/08 (InstancedMesh,
// surface scatter). Wind is a per-instance bend recomposed each frame (deterministic).
export class Grass {
  constructor(scene) {
    this.scene = scene; this.disposables = [];
    const prng = alea('grass'); const noise = createNoise2D(prng);
    const SIZE = 30; const ground = (x, z) => noise(x * 0.06, z * 0.06) * 1.2 + noise(x * 0.15, z * 0.15) * 0.4;

    const gGeo = new THREE.PlaneGeometry(SIZE, SIZE, 80, 80); gGeo.rotateX(-Math.PI / 2);
    const gp = gGeo.attributes.position; for (let i = 0; i < gp.count; i++) gp.setY(i, ground(gp.getX(i), gp.getZ(i))); gGeo.computeVertexNormals();
    const gMat = new THREE.MeshStandardNodeMaterial({ color: 0x2c4a22, roughness: 1 });
    const groundMesh = new THREE.Mesh(gGeo, gMat); groundMesh.receiveShadow = true; scene.add(groundMesh); this.disposables.push(gGeo, gMat);

    // blade: a thin tapered cone, base at y=0
    const blade = new THREE.ConeGeometry(0.035, 0.62, 4, 1); blade.translate(0, 0.31, 0); this.disposables.push(blade);
    const bMat = new THREE.MeshStandardNodeMaterial({ color: 0x6db83a, roughness: 0.85, metalness: 0 }); bMat.vertexColors = true; this.disposables.push(bMat);
    const N = 6000;
    this.mesh = new THREE.InstancedMesh(blade, bMat, N); this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    // per-blade tint (lighter at the tip via a subtle instance color) + base data for wind
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
    this.blades = [];
    const rng = alea('blades'); const col = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const x = (rng() - 0.5) * SIZE * 0.96, z = (rng() - 0.5) * SIZE * 0.96; const y = ground(x, z);
      this.blades.push({ x, y, z, yaw: rng() * Math.PI * 2, h: 0.7 + rng() * 0.7, phase: rng() * Math.PI * 2, lean: 0.05 + rng() * 0.05 });
      col.setHSL(0.28 + rng() * 0.06, 0.5, 0.35 + rng() * 0.2); this.mesh.instanceColor.setXYZ(i, col.r, col.g, col.b);
    }
    scene.add(this.mesh);

    // a few flowers for colour
    const fGeo = new THREE.SphereGeometry(0.09, 8, 6); this.disposables.push(fGeo);
    const fMat = new THREE.MeshStandardNodeMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.7 }); this.disposables.push(fMat);
    const F = 240; this.flowers = new THREE.InstancedMesh(fGeo, fMat, F); this.flowers.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(F * 3), 3);
    const m = new THREE.Matrix4(); const fc = new THREE.Color();
    for (let i = 0; i < F; i++) { const x = (rng() - 0.5) * SIZE * 0.9, z = (rng() - 0.5) * SIZE * 0.9; const y = ground(x, z) + 0.55; m.makeTranslation(x, y, z); this.flowers.setMatrixAt(i, m); fc.setHSL(rng(), 0.8, 0.6); this.flowers.instanceColor.setXYZ(i, fc.r, fc.g, fc.b); }
    this.flowers.instanceColor.needsUpdate = true; scene.add(this.flowers);

    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3();
    this.t = 0; this._wind(0);
  }

  _wind(t) {
    const m = this._m, q = this._q, e = this._e, p = this._p, s = this._s;
    for (let i = 0; i < this.blades.length; i++) {
      const b = this.blades[i];
      const gust = Math.sin(t * 1.6 + b.x * 0.35 + b.z * 0.2 + b.phase) * 0.5 + 0.5;
      const bend = b.lean + gust * 0.5;                       // radians, sway toward +x/+z
      e.set(bend, b.yaw, bend * 0.4); q.setFromEuler(e);
      p.set(b.x, b.y, b.z); s.set(1, b.h, 1); m.compose(p, q, s);
      this.mesh.setMatrixAt(i, m);
    }
    this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceColor.needsUpdate = true;
  }

  camera(cam, controls) {
    cam.position.set(0, 2.2, 8); cam.lookAt(0, 0.8, -2);
    if (controls) { controls.target.set(0, 0.8, -2); controls.minDistance = 3; controls.maxDistance = 24; controls.maxPolarAngle = Math.PI * 0.49; controls.update(); }
  }

  update(dt) { this.t += Math.min(dt, 0.05); this._wind(this.t); }
  dispose() { for (const d of this.disposables) d.dispose?.(); }
}
