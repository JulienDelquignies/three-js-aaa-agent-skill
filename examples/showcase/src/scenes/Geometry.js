import * as THREE from 'three/webgpu';

// Procedural geometry — a museum of meshes authored by code (no imported models): a lathe vase, an
// extruded gear, a tube along a curve, a torus knot, a faceted gem, a parametric shell. Each on a
// pedestal, gently turning. Demonstrates reference/06 (BufferGeometry, lathe, extrude, tube).
export class Geometry {
  constructor(scene) {
    this.scene = scene; this.disposables = [];
    const grp = new THREE.Group(); scene.add(this.grp = grp);

    const floorG = new THREE.PlaneGeometry(40, 24); floorG.rotateX(-Math.PI / 2);
    const floorM = new THREE.MeshStandardNodeMaterial({ color: 0x12151b, roughness: 0.35, metalness: 0.1 });
    const floor = new THREE.Mesh(floorG, floorM); floor.receiveShadow = true; grp.add(floor); this.disposables.push(floorG, floorM);

    const mk = (geo, mat) => { this.disposables.push(geo, mat); const m = new THREE.Mesh(geo, mat); m.castShadow = true; return m; };
    const mat = (o) => new THREE.MeshPhysicalNodeMaterial(o);

    // 1) Lathe vase from a hand-authored profile
    const prof = []; for (let i = 0; i <= 20; i++) { const v = i / 20; const r = 0.5 + 0.35 * Math.sin(v * Math.PI * 1.1) - 0.15 * v; prof.push(new THREE.Vector2(Math.max(0.05, r), v * 1.6)); }
    const vase = mk(new THREE.LatheGeometry(prof, 48), mat({ color: 0x2e7d9a, roughness: 0.25, metalness: 0.1, clearcoat: 1 }));

    // 2) Extruded gear (a disc with teeth + a bore hole)
    const gearShape = new THREE.Shape(); const teeth = 12, ro = 0.9, ri = 0.72;
    for (let i = 0; i <= teeth * 2; i++) { const a = (i / (teeth * 2)) * Math.PI * 2; const r = i % 2 ? ri : ro; const x = Math.cos(a) * r, y = Math.sin(a) * r; i ? gearShape.lineTo(x, y) : gearShape.moveTo(x, y); }
    const hole = new THREE.Path(); hole.absarc(0, 0, 0.32, 0, Math.PI * 2, true); gearShape.holes.push(hole);
    const gear = mk(new THREE.ExtrudeGeometry(gearShape, { depth: 0.35, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2 }), mat({ color: 0xb98a2e, metalness: 1, roughness: 0.35 }));
    gear.rotation.x = -Math.PI / 2;

    // 3) Tube along a 3D curve
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.8, 0, 0), new THREE.Vector3(-0.3, 0.9, 0.4), new THREE.Vector3(0.4, 0.3, -0.5),
      new THREE.Vector3(0.8, 1.2, 0.2), new THREE.Vector3(0.2, 1.7, -0.2),
    ], false, 'catmullrom', 0.6);
    const tube = mk(new THREE.TubeGeometry(curve, 120, 0.16, 16, false), mat({ color: 0xd94f7a, roughness: 0.3, metalness: 0.2, sheen: 1, sheenColor: new THREE.Color(0xffd0e2) }));

    // 4) Torus knot
    const knot = mk(new THREE.TorusKnotGeometry(0.7, 0.22, 160, 24, 2, 3), mat({ color: 0x8f7dff, roughness: 0.2, metalness: 0.6, iridescence: 1, iridescenceIOR: 1.8 }));

    // 5) Faceted gem
    const gem = mk(new THREE.IcosahedronGeometry(0.9, 0), mat({ color: 0xffffff, transmission: 1, roughness: 0.03, ior: 2.2, thickness: 0.9, metalness: 0 }));

    // 6) Parametric-ish shell: a squashed, twisted torus
    const shellGeo = new THREE.TorusGeometry(0.7, 0.32, 24, 80); const p = shellGeo.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const tw = x * 1.2; p.setXYZ(i, x, y * Math.cos(tw) - z * Math.sin(tw), y * Math.sin(tw) + z * Math.cos(tw)); }
    shellGeo.computeVertexNormals();
    const shell = mk(shellGeo, mat({ color: 0x36d1a0, roughness: 0.3, metalness: 0.3, clearcoat: 0.6 }));

    this.items = [vase, gear, tube, knot, gem, shell];
    const n = this.items.length, gap = 3.0, x0 = -((n - 1) * gap) / 2;
    const pedG = new THREE.CylinderGeometry(0.95, 1.05, 0.5, 32); this.disposables.push(pedG);
    const pedM = new THREE.MeshStandardNodeMaterial({ color: 0x1a1f28, roughness: 0.7, metalness: 0.1 }); this.disposables.push(pedM);
    this.items.forEach((it, i) => {
      const x = x0 + i * gap; const ped = new THREE.Mesh(pedG, pedM); ped.position.set(x, 0.25, 0); ped.receiveShadow = true; grp.add(ped);
      const holder = new THREE.Group(); holder.position.set(x, 1.4, 0); holder.add(it); grp.add(holder); it._holder = holder;
    });
    this.t = 0;
  }

  camera(cam, controls) {
    cam.position.set(0, 3.2, 11); cam.lookAt(0, 1.3, 0);
    if (controls) { controls.target.set(0, 1.2, 0); controls.minDistance = 5; controls.maxDistance = 26; controls.update(); }
  }

  update(dt) { this.t += dt; this.items.forEach((it, i) => { it._holder.rotation.y += dt * (0.3 + i * 0.05); }); }
  dispose() { for (const d of this.disposables) d.dispose?.(); }
}
