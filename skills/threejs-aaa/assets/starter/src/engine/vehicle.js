import * as THREE from 'three/webgpu';

// vehicle — a compact procedural car + a PathDriver that drives it along a street polyline
// (engine/city.js routes). ONE system, several skins later (personal car, team bus, taxi): the driver
// only cares about the path. Forward is +z; yaw damps through corners; wheels spin with ground speed.
const DIMS = {                                            // per-kind body proportions (metres)
  citadine: { L: 3.4, W: 1.62, bodyH: 0.5, cabL: 1.7, cabH: 0.52, cabZ: 0.05, wheel: 0.3 },
  berline: { L: 4.1, W: 1.75, bodyH: 0.52, cabL: 2.0, cabH: 0.5, cabZ: -0.25, wheel: 0.34 },
  suv: { L: 4.4, W: 1.9, bodyH: 0.72, cabL: 2.5, cabH: 0.55, cabZ: -0.2, wheel: 0.4 },
};

export function buildCar({ kind = 'berline', color = 0xb3252f } = {}) {
  const d = DIMS[kind] || DIMS.berline;
  const group = new THREE.Group();
  const disposables = [];
  const mat = (o) => { const m = new THREE.MeshStandardNodeMaterial(o); disposables.push(m); return m; };
  const paint = mat({ color, roughness: 0.35, metalness: 0.6 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(d.W, d.bodyH, d.L), paint);
  body.position.y = d.wheel + d.bodyH / 2 - 0.08; body.castShadow = true; group.add(body); disposables.push(body.geometry);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(d.W - 0.2, d.cabH, d.cabL), mat({ color: 0x1c242e, roughness: 0.1, metalness: 0.4 }));
  cabin.position.set(0, d.wheel + d.bodyH - 0.08 + d.cabH / 2 - 0.02, d.cabZ); cabin.castShadow = true; group.add(cabin); disposables.push(cabin.geometry);
  const wg = new THREE.CylinderGeometry(d.wheel, d.wheel, 0.26, 14); wg.rotateZ(Math.PI / 2); disposables.push(wg);
  const wm = mat({ color: 0x14161a, roughness: 0.8 });
  const wheels = [];
  const az = d.L / 2 - d.wheel - 0.28;
  for (const [sx, sz] of [[-1, az], [1, az], [-1, -az], [1, -az]]) {
    const w = new THREE.Mesh(wg, wm); w.position.set(sx * (d.W / 2 - 0.06), d.wheel, sz); w.castShadow = true; group.add(w); wheels.push(w);
  }
  const hg = new THREE.BoxGeometry(0.3, 0.12, 0.06); disposables.push(hg);
  const hm = mat({ color: 0xfff6da, emissive: 0xffedb8, emissiveIntensity: 2.2, roughness: 0.3 });
  for (const s of [-1, 1]) { const h = new THREE.Mesh(hg, hm); h.position.set(s * (d.W / 2 - 0.32), d.wheel + d.bodyH * 0.55, d.L / 2 + 0.01); group.add(h); }
  return { group, wheels, dispose: () => disposables.forEach((d) => d.dispose?.()) };
}

/** Repaint a car: GLB like ferrari.glb names the body OBJECT (and/or material) 'body' — the official
 *  three.js car demo swaps that mesh's material; procedural cars fall back to the first mesh. */
export function paintCar(group, color) {
  let done = false;
  group.traverse((o) => {
    if (done || !o.isMesh || !o.material) return;
    if (o.name === 'body' || o.material.name === 'body') { o.material.color.set(color); done = true; }
  });
  if (!done) { const first = group.children.find((c) => c.isMesh); first?.material?.color?.set(color); }
}

/** Wheel meshes of a loaded car GLB (ferrari.glb convention: wheel_fl/fr/rl/rr). */
export function findWheels(group) {
  const out = [];
  for (const n of ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr']) { const w = group.getObjectByName(n); if (w) out.push(w); }
  return out;
}

/** Drive along a polyline [[x,z],…]: eased speed, damped yaw through corners, spinning wheels. */
export class PathDriver {
  constructor(path, { speed = 15 } = {}) {
    this.pts = path; this.speed = speed; this.t = 0;
    this.len = [0];
    for (let i = 1; i < path.length; i++) this.len.push(this.len[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
    this.total = this.len[this.len.length - 1];
    this.pos = [...path[0]]; this.yaw = this._headingAt(0.5); this.done = false;
  }
  _sample(t) {
    let i = 1; while (i < this.len.length - 1 && this.len[i] < t) i++;
    const a = this.pts[i - 1], b = this.pts[i], seg = this.len[i] - this.len[i - 1] || 1e-6;
    const u = (t - this.len[i - 1]) / seg;
    return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
  }
  _headingAt(t) {
    const a = this._sample(Math.max(0, t - 0.4)), b = this._sample(Math.min(this.total, t + 0.6));
    return Math.atan2(b[0] - a[0], b[1] - a[1]);
  }
  finish() { this.t = this.total; }
  /** → { x, z, yaw, wheelSpin, done } */
  update(dt) {
    const ease = Math.min(1, Math.min(this.t / 8 + 0.25, (this.total - this.t) / 10 + 0.2));
    const v = this.speed * Math.min(1, ease);
    this.t = Math.min(this.total, this.t + v * dt);
    this.pos = this._sample(this.t);
    const want = this._headingAt(this.t);
    let d = want - this.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    this.yaw += d * Math.min(1, 6 * dt);
    this.done = this.t >= this.total - 1e-3;
    return { x: this.pos[0], z: this.pos[1], yaw: this.yaw, wheelSpin: v / 0.34, done: this.done };
  }
}
