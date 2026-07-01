import * as THREE from 'three/webgpu';

// PBR material showcase — a lineup of spheres under image-based lighting, each a distinct advanced
// physical material (clearcoat, glass/transmission, metal, sheen, iridescence, anisotropy). Interactive:
// orbit to inspect; the group rocks gently so highlights move. Demonstrates reference/02 + 03.
export class Materials {
  constructor(scene) {
    this.scene = scene; this.disposables = [];
    this.group = new THREE.Group(); scene.add(this.group);

    // reflective studio floor
    const fgeo = new THREE.PlaneGeometry(60, 60); fgeo.rotateX(-Math.PI / 2);
    const fmat = new THREE.MeshStandardNodeMaterial({ color: 0x0e1116, roughness: 0.18, metalness: 0.0 });
    const floor = new THREE.Mesh(fgeo, fmat); floor.receiveShadow = true; scene.add(floor); this.disposables.push(fgeo, fmat);

    const P = THREE.MeshPhysicalNodeMaterial;
    const specs = [
      { name: 'Clearcoat',   mat: new P({ color: 0xb01818, roughness: 0.45, clearcoat: 1, clearcoatRoughness: 0.06 }) },
      { name: 'Glass',       mat: new P({ color: 0xffffff, roughness: 0.02, transmission: 1, ior: 1.5, thickness: 0.6, metalness: 0 }) },
      { name: 'Brushed metal', mat: new P({ color: 0xd8dee9, metalness: 1, roughness: 0.28, anisotropy: 0.8 }) },
      { name: 'Gold',        mat: new P({ color: 0xffc65c, metalness: 1, roughness: 0.22 }) },
      { name: 'Iridescent',  mat: new P({ color: 0x101018, metalness: 1, roughness: 0.15, iridescence: 1, iridescenceIOR: 2.0 }) },
      { name: 'Velvet (sheen)', mat: new P({ color: 0x3a2352, roughness: 0.9, sheen: 1, sheenColor: new THREE.Color(0xff7bd5) }) },
    ];
    const geo = new THREE.SphereGeometry(0.7, 64, 48); this.disposables.push(geo);
    const n = specs.length, gap = 2.0, x0 = -((n - 1) * gap) / 2;
    specs.forEach((s, i) => {
      const m = new THREE.Mesh(geo, s.mat); m.castShadow = true; m.position.set(x0 + i * gap, 0.7, 0);
      this.group.add(m); this.disposables.push(s.mat);
      // small pedestal
      const pg = new THREE.CylinderGeometry(0.5, 0.55, 0.2, 32);
      const pm = new THREE.MeshStandardNodeMaterial({ color: 0x1b2029, roughness: 0.6, metalness: 0.1 });
      const ped = new THREE.Mesh(pg, pm); ped.position.set(x0 + i * gap, 0.1, 0); ped.receiveShadow = true;
      this.group.add(ped); this.disposables.push(pg, pm);
    });
    this.t = 0;
  }

  camera(cam, controls) {
    cam.position.set(0, 2.6, 9.5); cam.lookAt(0, 1, 0);
    if (controls) { controls.target.set(0, 0.9, 0); controls.minDistance = 4; controls.maxDistance = 20; controls.update(); }
  }

  update(dt) { this.t += dt; this.group.rotation.y = Math.sin(this.t * 0.25) * 0.35; }
  dispose() { for (const d of this.disposables) d.dispose?.(); }
}
