import * as THREE from 'three/webgpu';

// vehicle — a compact procedural car + a PathDriver that drives it along a street polyline
// (engine/city.js routes). ONE system, several skins later (personal car, team bus, taxi): the driver
// only cares about the path. Forward is +z; yaw damps through corners; wheels spin with ground speed.
export function buildCar({ color = 0xb3252f } = {}) {
  const group = new THREE.Group();
  const disposables = [];
  const mat = (o) => { const m = new THREE.MeshStandardNodeMaterial(o); disposables.push(m); return m; };
  const paint = mat({ color, roughness: 0.35, metalness: 0.6 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.52, 4.1), paint);
  body.position.y = 0.55; body.castShadow = true; group.add(body); disposables.push(body.geometry);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.5, 2.0), mat({ color: 0x1c242e, roughness: 0.1, metalness: 0.4 }));
  cabin.position.set(0, 1.02, -0.25); cabin.castShadow = true; group.add(cabin); disposables.push(cabin.geometry);
  const wg = new THREE.CylinderGeometry(0.34, 0.34, 0.26, 14); wg.rotateZ(Math.PI / 2); disposables.push(wg);
  const wm = mat({ color: 0x14161a, roughness: 0.8 });
  const wheels = [];
  for (const [sx, sz] of [[-1, 1.3], [1, 1.3], [-1, -1.35], [1, -1.35]]) {
    const w = new THREE.Mesh(wg, wm); w.position.set(sx * 0.82, 0.34, sz); w.castShadow = true; group.add(w); wheels.push(w);
  }
  const hg = new THREE.BoxGeometry(0.3, 0.12, 0.06); disposables.push(hg);
  const hm = mat({ color: 0xfff6da, emissive: 0xffedb8, emissiveIntensity: 2.2, roughness: 0.3 });
  for (const s of [-1, 1]) { const h = new THREE.Mesh(hg, hm); h.position.set(s * 0.55, 0.58, 2.06); group.add(h); }
  return { group, wheels, dispose: () => disposables.forEach((d) => d.dispose?.()) };
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
