import * as THREE from 'three/webgpu';

// Particles — a small pooled GPU particle system for game "juice": run dust, kick sparks, impact bursts,
// trails. One InstancedMesh of camera-facing soft quads (additive), a fixed pool reused across bursts —
// no per-frame allocation. Native/reusable. Call emit() to spawn, update(dt, camera) each frame.
//
//   const fx = new ParticleSystem(scene, { max: 400 });
//   fx.emit([x,y,z], { count: 18, speed: 4, spread: 0.6, gravity: -9, ttl: 0.5, color: 0xffd27f, size: 0.14 });
//   // per frame (after the camera is positioned): fx.update(dt, camera);
export class ParticleSystem {
  constructor(scene, { max = 400, blending = THREE.AdditiveBlending } = {}) {
    this.scene = scene; this.max = max;
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32); grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.4, 'rgba(255,255,255,0.6)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    this.tex = new THREE.CanvasTexture(c); this.tex.colorSpace = THREE.SRGBColorSpace;
    const geo = new THREE.PlaneGeometry(1, 1);
    const mat = new THREE.MeshBasicNodeMaterial({ map: this.tex, transparent: true, blending, depthWrite: false, toneMapped: false });
    this.mesh = new THREE.InstancedMesh(geo, mat, max); this.mesh.frustumCulled = false; this.mesh.count = 0;
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    scene.add(this.mesh); this._geo = geo; this._mat = mat;
    // pool
    this.p = Array.from({ length: max }, () => ({ life: 0, ttl: 1, size: 0.1, g: 0, pos: new THREE.Vector3(), vel: new THREE.Vector3(), col: new THREE.Color() }));
    this._m = new THREE.Matrix4(); this._s = new THREE.Vector3(); this._col = new THREE.Color();
  }

  emit(pos, { count = 12, speed = 3, spread = 0.5, gravity = -9, ttl = 0.5, size = 0.12, color = 0xffffff, up = 0.5, drag = 0.6 } = {}) {
    for (let n = 0; n < count; n++) {
      const q = this.p.find((x) => x.life <= 0); if (!q) break;
      q.life = ttl * (0.7 + Math.random() * 0.3); q.ttl = q.life; q.size = size * (0.6 + Math.random() * 0.8); q.g = gravity; q.drag = drag;
      q.pos.set(pos[0], pos[1], pos[2]);
      const a = Math.random() * Math.PI * 2, e = (Math.random() - 0.5) * spread;
      const sp = speed * (0.5 + Math.random() * 0.7);
      q.vel.set(Math.cos(a) * sp, (up + e) * sp, Math.sin(a) * sp);
      q.col.set(color);
    }
  }

  update(dt, camera) {
    let count = 0; const q4 = camera ? camera.quaternion : null;
    for (const q of this.p) {
      if (q.life <= 0) continue;
      q.life -= dt; if (q.life <= 0) continue;
      const f = Math.exp(-q.drag * dt); q.vel.x *= f; q.vel.z *= f; q.vel.y += q.g * dt;
      q.pos.addScaledVector(q.vel, dt);
      const t = q.life / q.ttl;                                 // 1 → 0
      this._s.setScalar(q.size * (0.4 + 0.6 * t));              // shrink as it dies
      this._m.compose(q.pos, q4 || _IDENT, this._s);           // billboard toward the camera
      this.mesh.setMatrixAt(count, this._m);
      this._col.copy(q.col).multiplyScalar(t * t);             // fade out (additive → toward invisible)
      this.mesh.instanceColor.setXYZ(count, this._col.r, this._col.g, this._col.b);
      count++;
    }
    this.mesh.count = count;
    if (count > 0) { this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceColor.needsUpdate = true; }
  }

  dispose() { this._geo.dispose(); this._mat.dispose(); this.tex.dispose(); }
}
const _IDENT = new THREE.Quaternion();
