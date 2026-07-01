import * as THREE from 'three/webgpu';

// Post-processing showcase — a dark set of emissive "neon" shapes so the bloom pass (engine/PostFX.js,
// TSL BloomNode) reads clearly: bright emissive areas bleed light, everything else stays crisp.
// Demonstrates reference/04 (bloom, HDR, tone mapping). The scene dims the IBL/fog it inherits.
export class Neon {
  constructor(scene) {
    this.scene = scene; this.disposables = [];
    this._prevBg = scene.background; this._prevFog = scene.fog; this._prevEnv = scene.environmentIntensity;
    scene.background = new THREE.Color(0x05060a);
    scene.environmentIntensity = 0.12;                 // let emissive dominate
    scene.fog = new THREE.FogExp2(0x05060a, 0.03);

    const grp = new THREE.Group(); scene.add(this.grp = grp);
    const floorG = new THREE.PlaneGeometry(80, 80); floorG.rotateX(-Math.PI / 2);
    const floorM = new THREE.MeshStandardNodeMaterial({ color: 0x05070c, roughness: 0.12, metalness: 0.85 });
    const floor = new THREE.Mesh(floorG, floorM); floor.position.y = -1.2; grp.add(floor); this.disposables.push(floorG, floorM);

    const neon = (hex) => new THREE.MeshStandardNodeMaterial({ color: new THREE.Color(hex), emissive: new THREE.Color(hex), emissiveIntensity: 4.0, roughness: 0.4, metalness: 0 });
    const mk = (geo, hex) => { this.disposables.push(geo); const m = neon(hex); this.disposables.push(m); const mesh = new THREE.Mesh(geo, m); grp.add(mesh); return mesh; };

    this.spin = [];
    const ring = mk(new THREE.TorusGeometry(2.2, 0.09, 20, 128), 0x18f0ff); ring.rotation.x = Math.PI / 2; this.spin.push([ring, 0.4, 'z']);
    const ring2 = mk(new THREE.TorusGeometry(3.0, 0.06, 16, 128), 0xff3bd0); ring2.rotation.x = Math.PI / 2.4; this.spin.push([ring2, -0.25, 'y']);
    const knot = mk(new THREE.TorusKnotGeometry(1.0, 0.14, 200, 24, 2, 5), 0x9b7bff); knot.position.y = 0.4; this.spin.push([knot, 0.5, 'y']);

    // a scatter of glowing orbs
    const orbGeo = new THREE.SphereGeometry(0.16, 20, 14); this.disposables.push(orbGeo);
    const palette = [0x18f0ff, 0xff3bd0, 0x6cff8a, 0xffd83b, 0x9b7bff];
    this.orbs = [];
    for (let i = 0; i < 40; i++) {
      const m = neon(palette[i % palette.length]); this.disposables.push(m);
      const orb = new THREE.Mesh(orbGeo, m);
      const a = i * 2.399, r = 3.4 + (i % 5) * 0.5;
      orb.position.set(Math.cos(a) * r, -0.6 + (i % 7) * 0.35, Math.sin(a) * r);
      orb.userData = { a, r, y: orb.position.y, ph: i };
      grp.add(orb); this.orbs.push(orb);
    }
    this.t = 0;
  }

  camera(cam, controls) {
    cam.position.set(0, 1.6, 8.5); cam.lookAt(0, 0.3, 0);
    if (controls) { controls.target.set(0, 0.2, 0); controls.minDistance = 4; controls.maxDistance = 22; controls.update(); }
  }

  update(dt) {
    this.t += dt;
    for (const [m, sp, ax] of this.spin) m.rotation[ax] += dt * sp;
    for (const orb of this.orbs) { const u = orb.userData; orb.position.y = u.y + Math.sin(this.t * 1.2 + u.ph) * 0.35; }
  }

  dispose() {
    this.scene.background = this._prevBg; this.scene.fog = this._prevFog; this.scene.environmentIntensity = this._prevEnv;
    for (const d of this.disposables) d.dispose?.();
  }
}
