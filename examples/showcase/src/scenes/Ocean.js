import * as THREE from 'three/webgpu';

// Ocean — a plane displaced on the CPU by a sum of Gerstner waves (deterministic, animated), with a
// physical water material (low roughness + transmission) and a buoy bobbing on the surface. Demonstrates
// procedural vertex animation + PBR water (reference/03/07). Recomputes normals each frame.
const WAVES = [
  { dir: [1, 0], amp: 0.28, len: 7.0, speed: 1.1, steep: 0.7 },
  { dir: [0.6, 0.8], amp: 0.16, len: 3.4, speed: 1.6, steep: 0.6 },
  { dir: [-0.8, 0.5], amp: 0.09, len: 1.7, speed: 2.2, steep: 0.5 },
  { dir: [0.2, -1], amp: 0.05, len: 0.9, speed: 2.8, steep: 0.4 },
];

export class Ocean {
  constructor(scene) {
    this.scene = scene; this.disposables = [];
    this._prevFog = scene.fog; scene.fog = new THREE.FogExp2(0x9fb8c8, 0.02);

    const SEG = 120, SIZE = 60;
    this.geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG); this.geo.rotateX(-Math.PI / 2);
    this.base = this.geo.attributes.position.array.slice();     // rest positions (x,z fixed; y=0)
    const mat = new THREE.MeshPhysicalNodeMaterial({ color: 0x1f5c82, roughness: 0.06, metalness: 0, transmission: 0.25, ior: 1.33, thickness: 2, clearcoat: 0.4 });
    this.water = new THREE.Mesh(this.geo, mat); this.water.receiveShadow = true; scene.add(this.water); this.disposables.push(this.geo, mat);

    // a simple buoy that rides the surface
    const buoy = new THREE.Group();
    const bodyG = new THREE.CylinderGeometry(0.35, 0.5, 0.9, 20);
    const bodyM = new THREE.MeshStandardNodeMaterial({ color: 0xe04a3a, roughness: 0.5, metalness: 0.1 });
    const body = new THREE.Mesh(bodyG, bodyM); body.castShadow = true; buoy.add(body);
    const topG = new THREE.ConeGeometry(0.28, 0.5, 20); const topM = new THREE.MeshStandardNodeMaterial({ color: 0xf4d23a, emissive: new THREE.Color(0xffcc22), emissiveIntensity: 1.6, roughness: 0.4 });
    const top = new THREE.Mesh(topG, topM); top.position.y = 0.7; buoy.add(top);
    scene.add(buoy); this.buoy = buoy; this.disposables.push(bodyG, bodyM, topG, topM);
    this.t = 0; this._displace(0);
  }

  _sample(x, z, t, out) {                          // Gerstner: returns world y and horizontal shift
    let dx = 0, dy = 0, dz = 0;
    for (const w of WAVES) {
      const k = (2 * Math.PI) / w.len; const dlen = Math.hypot(w.dir[0], w.dir[1]) || 1;
      const dirx = w.dir[0] / dlen, dirz = w.dir[1] / dlen;
      const phase = k * (dirx * x + dirz * z) + t * w.speed * k;
      const a = w.amp, c = Math.cos(phase), s = Math.sin(phase); const q = w.steep / (k * a * WAVES.length);
      dx += q * a * dirx * c; dz += q * a * dirz * c; dy += a * s;
    }
    out[0] = dx; out[1] = dy; out[2] = dz;
  }

  _displace(t) {
    const p = this.geo.attributes.position.array; const b = this.base; const o = [0, 0, 0];
    for (let i = 0; i < p.length; i += 3) { const x = b[i], z = b[i + 2]; this._sample(x, z, t, o); p[i] = x + o[0]; p[i + 1] = o[1]; p[i + 2] = z + o[2]; }
    this.geo.attributes.position.needsUpdate = true; this.geo.computeVertexNormals();
    // ride the buoy on the surface at (0,0)
    this._sample(0, 0, t, o); this.buoy.position.set(o[0], o[1] + 0.15, o[2]);
    this.buoy.rotation.z = -o[0] * 0.5; this.buoy.rotation.x = o[2] * 0.5;
  }

  camera(cam, controls) {
    cam.position.set(0, 3.2, 9); cam.lookAt(0, 0, -4);
    if (controls) { controls.target.set(0, 0, -3); controls.minDistance = 4; controls.maxDistance = 30; controls.maxPolarAngle = Math.PI * 0.495; controls.update(); }
  }

  update(dt) { this.t += Math.min(dt, 0.05); this._displace(this.t); }
  dispose() { this.scene.fog = this._prevFog; for (const d of this.disposables) d.dispose?.(); }
}
