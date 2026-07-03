import * as THREE from 'three/webgpu';
import { drawSponsorStrip, drawCrest } from './club-theme.js';

// vehicle — a compact procedural car + a PathDriver that drives it along a street polyline
// (engine/city.js routes). ONE system, several skins later (personal car, team bus, taxi): the driver
// only cares about the path. Forward is +z; yaw damps through corners; wheels spin with ground speed.
// Per-kind proportions. The BODY is a 2D side profile (real car silhouette: bumper, hood, raked
// windshield, roof, decklid) EXTRUDED across the width with a bevel → rounded shoulders, not a box.
// Profile points are [z-fraction of L, height in m] from the NOSE (+z) to the tail, over the top.
const DIMS = {
  citadine: { L: 3.5, W: 1.66, wheel: 0.3, profile: [[0.5, 0.34], [0.5, 0.56], [0.42, 0.64], [0.16, 0.74], [-0.34, 0.78], [-0.5, 0.72], [-0.5, 0.34]] },
  berline: { L: 4.35, W: 1.8, wheel: 0.33, profile: [[0.5, 0.36], [0.5, 0.58], [0.44, 0.66], [0.2, 0.76], [-0.28, 0.8], [-0.5, 0.74], [-0.5, 0.36]] },
  suv: { L: 4.55, W: 1.92, wheel: 0.4, profile: [[0.5, 0.42], [0.5, 0.7], [0.38, 0.82], [0.14, 0.92], [-0.4, 0.96], [-0.5, 0.9], [-0.5, 0.42]] },
};
// glass canopy = the greenhouse SITTING ON the beltline (windshield → roof → rear glass) — the
// paint-shell/greenhouse contrast is what makes the silhouette read as a real car
const CANOPY = {
  citadine: [[0.14, 0.73], [0.04, 1.14], [-0.3, 1.2], [-0.46, 0.75]],
  berline: [[0.16, 0.75], [0.02, 1.12], [-0.24, 1.15], [-0.4, 0.78]],
  suv: [[0.1, 0.91], [0.02, 1.3], [-0.36, 1.34], [-0.46, 0.92]],
};

function extrudeProfile(pts, L, width, bevel) {
  const shape = new THREE.Shape();
  shape.moveTo(pts[0][0] * L, pts[0][1]);
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0] * L, pts[i][1]);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: width - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 6 });
  geo.translate(0, 0, -(width - bevel * 2) / 2);
  geo.rotateY(-Math.PI / 2);                              // profile x (length) → world +z, extrusion → width
  return geo;
}

export function buildCar({ kind = 'berline', color = 0xb3252f } = {}) {
  const d = DIMS[kind] || DIMS.berline;
  const group = new THREE.Group();
  const disposables = [];
  const matP = (o) => { const m = new THREE.MeshPhysicalNodeMaterial(o); disposables.push(m); return m; };
  const mat = (o) => { const m = new THREE.MeshStandardNodeMaterial(o); disposables.push(m); return m; };

  // BODY: profile-extruded shell with clearcoat paint (the "car paint" look is the material's job)
  const paint = matP({ color, metalness: 0.55, roughness: 0.42, clearcoat: 0.7, clearcoatRoughness: 0.28 });
  paint.name = 'body';
  const bodyGeo = extrudeProfile(d.profile, d.L, d.W, 0.09); disposables.push(bodyGeo);
  const body = new THREE.Mesh(bodyGeo, paint); body.castShadow = true; group.add(body);
  // GREENHOUSE: tinted glass canopy, slightly inset
  const glassGeo = extrudeProfile(CANOPY[kind] || CANOPY.berline, d.L, d.W - 0.18, 0.05); disposables.push(glassGeo);
  const glass = new THREE.Mesh(glassGeo, matP({ color: 0x0c1018, metalness: 0.0, roughness: 0.38, clearcoat: 0.12, clearcoatRoughness: 0.3 }));
  glass.scale.set(1.002, 1.002, 1.002); group.add(glass);

  // WHEELS: tire torus + brushed rim + spokes; wells suggested by a dark rocker band
  const tireGeo = new THREE.TorusGeometry(d.wheel - 0.06, 0.095, 10, 20); tireGeo.rotateY(Math.PI / 2); disposables.push(tireGeo);
  const rimGeo = new THREE.CylinderGeometry(d.wheel - 0.12, d.wheel - 0.12, 0.14, 16); rimGeo.rotateZ(Math.PI / 2); disposables.push(rimGeo);
  const spokeGeo = new THREE.BoxGeometry(0.02, 0.045, (d.wheel - 0.13) * 2); disposables.push(spokeGeo);
  const tireMat = mat({ color: 0x15171a, roughness: 0.92 });
  const rimMat = mat({ color: 0xc9ced6, metalness: 1, roughness: 0.28 });
  const wheels = [];
  const az = d.L / 2 - d.wheel - 0.32;
  for (const [sx, sz] of [[-1, az], [1, az], [-1, -az], [1, -az]]) {
    const w = new THREE.Group();
    const t = new THREE.Mesh(tireGeo, tireMat); t.castShadow = true; w.add(t);
    w.add(new THREE.Mesh(rimGeo, rimMat));
    for (const a of [0, Math.PI / 3, (2 * Math.PI) / 3]) { const s = new THREE.Mesh(spokeGeo, rimMat); s.rotation.x = a; w.add(s); }
    w.position.set(sx * (d.W / 2 - 0.03), d.wheel, sz);
    group.add(w); wheels.push(w);
  }
  const rocker = new THREE.Mesh(new THREE.BoxGeometry(d.W - 0.06, 0.13, d.L * 0.94), mat({ color: 0x121418, roughness: 0.9 }));
  rocker.position.y = d.profile[0][1] - 0.045; group.add(rocker); disposables.push(rocker.geometry);

  // face: grille + headlights (emissive), tail-lights, mirrors, plates
  const noseY = (d.profile[1][1] + d.profile[0][1]) / 2;
  const grille = new THREE.Mesh(new THREE.BoxGeometry(d.W * 0.5, 0.12, 0.05), mat({ color: 0x0c0e12, roughness: 0.5, metalness: 0.6 }));
  grille.position.set(0, noseY, d.L / 2 + 0.015); group.add(grille); disposables.push(grille.geometry);
  const hlGeo = new THREE.BoxGeometry(0.3, 0.09, 0.05); disposables.push(hlGeo);
  const hlMat = mat({ color: 0xfff6da, emissive: 0xffedb8, emissiveIntensity: 0.55, roughness: 0.2 });
  const tlGeo = new THREE.BoxGeometry(0.34, 0.08, 0.05); disposables.push(tlGeo);
  const tlMat = mat({ color: 0x7a1016, emissive: 0xd91c25, emissiveIntensity: 0.5, roughness: 0.3 });
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(hlGeo, hlMat); h.position.set(s * (d.W / 2 - 0.3), noseY + 0.1, d.L / 2 + 0.012); h.rotation.y = s * 0.06; group.add(h);
    const t = new THREE.Mesh(tlGeo, tlMat); t.position.set(s * (d.W / 2 - 0.32), d.profile[d.profile.length - 2][1] - 0.07, -d.L / 2 - 0.012); group.add(t);
    const mr = new THREE.Mesh((disposables[disposables.push(new THREE.BoxGeometry(0.16, 0.09, 0.05)) - 1]), paint);
    mr.position.set(s * (d.W / 2 + 0.06), (CANOPY[kind] || CANOPY.berline)[0][1] + 0.06, d.L * ((CANOPY[kind] || CANOPY.berline)[0][0]) + 0.1); group.add(mr);
  }
  const plateGeo = new THREE.BoxGeometry(0.42, 0.11, 0.02); disposables.push(plateGeo);
  const plateMat = mat({ color: 0xe9ecef, roughness: 0.5 });
  for (const s of [1, -1]) { const p = new THREE.Mesh(plateGeo, plateMat); p.position.set(0, d.profile[0][1] + 0.02, s * (d.L / 2 + 0.02)); group.add(p); }

  return { group, wheels, dispose: () => disposables.forEach((x) => x.dispose?.()) };
}

/** The TEAM BUS — same profile-extrusion technique, in the CLUB LIVERY: primary paint, dark window
 *  band, the sponsor strip along both flanks (drawSponsorStrip) and the crest at the front. One drive
 *  system, several skins: give this to the same PathDriver as the car. */
export function buildBus({ theme } = {}) {
  const L = 10.5, W = 2.5;
  const group = new THREE.Group();
  const disposables = [];
  const matP = (o) => { const m = new THREE.MeshPhysicalNodeMaterial(o); disposables.push(m); return m; };
  const mat = (o) => { const m = new THREE.MeshStandardNodeMaterial(o); disposables.push(m); return m; };
  const paint = matP({ color: theme?.primary ?? 0x1f3a93, metalness: 0.5, roughness: 0.4, clearcoat: 0.5, clearcoatRoughness: 0.3 });
  paint.name = 'body';
  const bodyGeo = extrudeProfile([[0.5, 0.42], [0.5, 2.7], [0.46, 2.95], [-0.46, 2.95], [-0.5, 2.7], [-0.5, 0.42]], L, W, 0.1);
  disposables.push(bodyGeo);
  const body = new THREE.Mesh(bodyGeo, paint); body.castShadow = true; group.add(body);
  const winGeo = new THREE.BoxGeometry(W + 0.04, 0.72, L * 0.78); disposables.push(winGeo);
  const win = new THREE.Mesh(winGeo, mat({ color: 0x0c1018, roughness: 0.35 }));
  win.position.set(0, 2.2, -L * 0.06); group.add(win);
  const shieldGeo = new THREE.BoxGeometry(W - 0.5, 0.8, 0.06); disposables.push(shieldGeo);
  const shield = new THREE.Mesh(shieldGeo, mat({ color: 0x0c1018, roughness: 0.3 }));
  shield.position.set(0, 2.15, L / 2 + 0.03); group.add(shield);
  if (theme) {                                                     // sponsor strip + crest, both flanks
    const stex = new THREE.CanvasTexture(drawSponsorStrip(theme)); stex.colorSpace = THREE.SRGBColorSpace; disposables.push(stex);
    const sg = new THREE.PlaneGeometry(L * 0.72, 0.5); disposables.push(sg);
    const sm = mat({ map: stex, roughness: 0.6 });
    const ctex = new THREE.CanvasTexture(drawCrest(theme)); ctex.colorSpace = THREE.SRGBColorSpace; disposables.push(ctex);
    const cg = new THREE.PlaneGeometry(0.9, 0.9); disposables.push(cg);
    const cm = mat({ map: ctex, roughness: 0.7, transparent: true });
    for (const s of [-1, 1]) {
      const strip = new THREE.Mesh(sg, sm);
      strip.position.set(s * (W / 2 + 0.06), 1.15, -L * 0.04); strip.rotation.y = s * Math.PI / 2; group.add(strip);
      const crest = new THREE.Mesh(cg, cm);
      crest.position.set(s * (W / 2 + 0.06), 1.9, L * 0.37); crest.rotation.y = s * Math.PI / 2; group.add(crest);
    }
  }
  const wg = new THREE.CylinderGeometry(0.5, 0.5, 0.34, 16); wg.rotateZ(Math.PI / 2); disposables.push(wg);
  const wm = mat({ color: 0x14161a, roughness: 0.9 });
  const wheels = [];
  for (const [sx, sz] of [[-1, L / 2 - 1.5], [1, L / 2 - 1.5], [-1, -L / 2 + 1.7], [1, -L / 2 + 1.7]]) {
    const w = new THREE.Mesh(wg, wm); w.position.set(sx * (W / 2 - 0.2), 0.5, sz); w.castShadow = true; group.add(w); wheels.push(w);
  }
  const hg = new THREE.BoxGeometry(0.34, 0.16, 0.06); disposables.push(hg);
  const hm = mat({ color: 0xfff6da, emissive: 0xffedb8, emissiveIntensity: 0.5, roughness: 0.2 });
  for (const s of [-1, 1]) { const h = new THREE.Mesh(hg, hm); h.position.set(s * (W / 2 - 0.4), 0.85, L / 2 + 0.04); group.add(h); }
  return { group, wheels, dispose: () => disposables.forEach((x) => x.dispose?.()) };
}

/** A parked regional train (two coaches) for the station platform — static dressing. */
export function buildTrain({ accent = 0xb3252f, length = 18 } = {}) {
  const group = new THREE.Group();
  const disposables = [];
  const mat = (o) => { const m = new THREE.MeshStandardNodeMaterial(o); disposables.push(m); return m; };
  const bodyM = mat({ color: 0xd6d9de, metalness: 0.4, roughness: 0.35 });
  const winM = mat({ color: 0x0c1018, roughness: 0.3 });
  const accM = mat({ color: accent, roughness: 0.5 });
  const carL = (length - 0.6) / 2;
  for (const s of [-1, 1]) {
    const cz = s * (carL / 2 + 0.3);
    const geo = extrudeProfile([[0.5, 0.5], [0.5, 2.6], [0.42, 2.95], [-0.42, 2.95], [-0.5, 2.6], [-0.5, 0.5]], carL, 2.9, 0.12);
    disposables.push(geo);
    const car = new THREE.Mesh(geo, bodyM); car.position.z = cz; car.castShadow = true; group.add(car);
    const wg = new THREE.BoxGeometry(2.96, 0.6, carL * 0.72); disposables.push(wg);
    const wb = new THREE.Mesh(wg, winM); wb.position.set(0, 2.1, cz); group.add(wb);
    const ag = new THREE.BoxGeometry(2.96, 0.34, carL * 0.94); disposables.push(ag);
    const ab = new THREE.Mesh(ag, accM); ab.position.set(0, 1.15, cz); group.add(ab);
    const bg = new THREE.BoxGeometry(2.2, 0.5, 1.6); disposables.push(bg);
    for (const bz of [cz - carL / 3, cz + carL / 3]) { const b = new THREE.Mesh(bg, winM); b.position.set(0, 0.25, bz); group.add(b); }
  }
  return { group, dispose: () => disposables.forEach((x) => x.dispose?.()) };
}

/** A parked business jet for the airport apron — static dressing. */
export function buildJet({ accent = 0x1f3a93 } = {}) {
  const group = new THREE.Group();
  const disposables = [];
  const mat = (o) => { const m = new THREE.MeshStandardNodeMaterial(o); disposables.push(m); return m; };
  const bodyM = mat({ color: 0xeef0f3, metalness: 0.5, roughness: 0.25 });
  const accM = mat({ color: accent, roughness: 0.4, metalness: 0.4 });
  const fus = new THREE.CylinderGeometry(0.85, 0.85, 10.5, 16); fus.rotateX(Math.PI / 2); disposables.push(fus);
  const f = new THREE.Mesh(fus, bodyM); f.position.y = 1.7; f.castShadow = true; group.add(f);
  const nose = new THREE.SphereGeometry(0.85, 14, 10); disposables.push(nose);
  const nm2 = new THREE.Mesh(nose, bodyM); nm2.position.set(0, 1.7, 5.25); group.add(nm2);
  const cone = new THREE.ConeGeometry(0.85, 2.4, 14); cone.rotateX(-Math.PI / 2); disposables.push(cone);
  const tc = new THREE.Mesh(cone, bodyM); tc.position.set(0, 1.7, -6.45); group.add(tc);
  const wingG = new THREE.BoxGeometry(11.5, 0.14, 2.2); disposables.push(wingG);
  const wing = new THREE.Mesh(wingG, bodyM); wing.position.set(0, 1.25, -0.4); wing.rotation.y = 0.12; wing.castShadow = true; group.add(wing);
  const finG = new THREE.BoxGeometry(0.14, 2.4, 1.7); disposables.push(finG);
  const fin = new THREE.Mesh(finG, accM); fin.position.set(0, 3.1, -6.1); group.add(fin);
  const stabG = new THREE.BoxGeometry(4.2, 0.12, 1.2); disposables.push(stabG);
  const stab = new THREE.Mesh(stabG, accM); stab.position.set(0, 3.9, -6.3); group.add(stab);
  const engG = new THREE.CylinderGeometry(0.42, 0.42, 1.7, 12); engG.rotateX(Math.PI / 2); disposables.push(engG);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(engG, accM); e.position.set(s * 1.25, 1.85, -4.4); group.add(e); }
  const gearG = new THREE.CylinderGeometry(0.09, 0.09, 0.9, 8); disposables.push(gearG);
  for (const [gx, gz] of [[0, 4.2], [-1, -0.4], [1, -0.4]]) { const g2 = new THREE.Mesh(gearG, accM); g2.position.set(gx, 0.45, gz); group.add(g2); }
  const stripeG = new THREE.BoxGeometry(1.72, 0.16, 10.4); disposables.push(stripeG);
  const stripe = new THREE.Mesh(stripeG, accM); stripe.position.set(0, 1.95, -0.2); group.add(stripe);
  return { group, dispose: () => disposables.forEach((x) => x.dispose?.()) };
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
