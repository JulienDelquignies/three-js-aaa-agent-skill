import * as THREE from 'three/webgpu';
import { extrudePoly, roundedRect, smooth } from './meshkit.js';
import { toGeometry } from './meshkit-builder.js';

// laptop-prop — the DS's LAPTOP as a real object in his hand (the computer half of the diegetic UI,
// reference/35): two meshkit rounded slabs on an animated HINGE. Folded, it rides in the left hand
// while walking; press O and the lid opens (eased) as the DS-OS overlay comes up (engine/laptop.js).
// attachToHand() parents it to the rig's LeftHand bone — offsets are LOCAL to that bone and were
// tuned live through the play-mode (the bone's frame is nothing like world axes; see reference/42).
export function buildLaptopProp() {
  const group = new THREE.Group();
  const disposables = [];
  const mat = (o) => { const m = new THREE.MeshStandardNodeMaterial(o); disposables.push(m); return m; };
  const shellM = mat({ color: 0x3c4048, roughness: 0.4, metalness: 0.7 });
  const slabMesh = smooth(extrudePoly(roundedRect(0.32, 0.225, 0.02, { cornerSegments: 2 }), { depth: 0.014, bevel: 0.004 }), 1);
  const slabGeo = toGeometry(slabMesh); disposables.push(slabGeo);

  const base = new THREE.Mesh(slabGeo, shellM); base.castShadow = true;
  group.add(base);
  const kbGeo = new THREE.PlaneGeometry(0.28, 0.17); kbGeo.rotateX(-Math.PI / 2); disposables.push(kbGeo);
  const kb = new THREE.Mesh(kbGeo, mat({ color: 0x181b20, roughness: 0.75 }));
  kb.rotation.z = Math.PI; kb.rotateX(Math.PI);                       // face UP
  kb.position.set(0, 0.0155, 0.01); group.add(kb);

  const lid = new THREE.Group();
  lid.position.set(0, 0.016, -0.105);                                 // hinge line at the rear edge
  const lidShell = new THREE.Mesh(slabGeo, shellM); lidShell.castShadow = true;
  lidShell.position.set(0, 0, 0.105);
  lid.add(lidShell);
  const scrGeo = new THREE.PlaneGeometry(0.285, 0.18); disposables.push(scrGeo);
  const scrM = mat({ color: 0x101722, roughness: 0.3, emissive: 0x9fc4ff, emissiveIntensity: 0 });
  const screen = new THREE.Mesh(scrGeo, scrM);
  screen.rotation.x = -Math.PI / 2;                                    // lies on the lid, faces the keyboard
  screen.position.set(0, -0.009, 0.105);
  lid.add(screen);
  group.add(lid);

  const state = { t: 0 };                                              // 0 = folded, 1 = open
  const apply = () => {
    lid.rotation.x = -state.t * 1.95;                                  // ~112° open
    scrM.emissiveIntensity = state.t > 0.75 ? (state.t - 0.75) * 4 * 1.1 : 0;   // screen lights late
  };
  apply();
  return {
    group,
    /** ease the hinge toward open (1) or folded (0); call each frame. Returns true while moving. */
    update(dt, targetOpen) {
      const target = targetOpen ? 1 : 0;
      if (Math.abs(state.t - target) < 1e-3) { state.t = target; apply(); return false; }
      state.t += Math.sign(target - state.t) * Math.min(Math.abs(target - state.t), dt * 3.2);
      apply(); return true;
    },
    /** parent to the rig's left hand with a live-tuned local pose. */
    attachToHand(model) {
      let hand = null;
      model.traverse((o) => { if (o.isBone && /LeftHand$/i.test(o.name) && !hand) hand = o; });
      if (!hand) return false;
      hand.add(group);
      const s = 1 / (hand.getWorldScale(new THREE.Vector3()).x || 1);  // counter the rig's cm scale
      group.scale.setScalar(s);
      group.position.set(0, 9, 3);                                     // hand-local (rig units ≈ cm)
      group.rotation.set(-0.5, 0, 1.5);
      return true;
    },
    dispose: () => disposables.forEach((d) => d.dispose?.()),
  };
}
