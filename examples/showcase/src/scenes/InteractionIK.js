import * as THREE from 'three/webgpu';
import { twoBoneIK } from '../engine/procedural.js';

// IK & interaction — an articulated two-bone arm tracks a moving target with analytic two-bone IK
// (engine/procedural.js). The effector turns green when it actually reaches the target, red when the
// target is out of reach — the runtime "is the interaction correct?" check from reference/14–15.
const UP = new THREE.Vector3(0, 1, 0);

export class InteractionIK {
  constructor(scene) {
    this.scene = scene; this.disposables = [];
    const grp = new THREE.Group(); scene.add(this.grp = grp);

    const floorG = new THREE.CylinderGeometry(6, 6, 0.3, 64);
    const floorM = new THREE.MeshStandardNodeMaterial({ color: 0x14181f, roughness: 0.5, metalness: 0.2 });
    const floor = new THREE.Mesh(floorG, floorM); floor.position.y = -0.15; floor.receiveShadow = true; grp.add(floor); this.disposables.push(floorG, floorM);

    this.root = new THREE.Vector3(0, 0.6, 0);
    this.lenA = 1.7; this.lenB = 1.5;
    const baseG = new THREE.CylinderGeometry(0.5, 0.6, 0.6, 32);
    const baseM = new THREE.MeshStandardNodeMaterial({ color: 0x2a3140, roughness: 0.4, metalness: 0.6 });
    const base = new THREE.Mesh(baseG, baseM); base.position.set(0, 0.3, 0); base.castShadow = true; grp.add(base); this.disposables.push(baseG, baseM);

    const boneMat = new THREE.MeshStandardNodeMaterial({ color: 0xc7ced9, roughness: 0.35, metalness: 0.8 });
    const jointMat = new THREE.MeshStandardNodeMaterial({ color: 0x3b4658, roughness: 0.3, metalness: 0.7 });
    this.disposables.push(boneMat, jointMat);
    const cyl = (r) => { const g = new THREE.CylinderGeometry(r, r, 1, 20); this.disposables.push(g); const m = new THREE.Mesh(g, boneMat); m.castShadow = true; grp.add(m); return m; };
    const ball = (r, mat) => { const g = new THREE.SphereGeometry(r, 24, 16); this.disposables.push(g); const m = new THREE.Mesh(g, mat); m.castShadow = true; grp.add(m); return m; };
    this.upper = cyl(0.16); this.fore = cyl(0.13);
    this.jRoot = ball(0.22, jointMat); this.jMid = ball(0.2, jointMat); this.jEnd = ball(0.18, jointMat);

    this.reachMat = new THREE.MeshStandardNodeMaterial({ color: 0x2fe08a, emissive: new THREE.Color(0x2fe08a), emissiveIntensity: 1.2, roughness: 0.4 });
    this.missMat = new THREE.MeshStandardNodeMaterial({ color: 0xe0503f, emissive: new THREE.Color(0xe0503f), emissiveIntensity: 1.2, roughness: 0.4 });
    this.disposables.push(this.reachMat, this.missMat);
    const tg = new THREE.SphereGeometry(0.24, 24, 16); this.disposables.push(tg);
    this.target = new THREE.Mesh(tg, this.reachMat); this.target.castShadow = true; grp.add(this.target);

    this.t = 0; this._update(0);
  }

  _orient(mesh, a, b) {
    const dir = new THREE.Vector3().subVectors(b, a); const len = dir.length() || 1e-4;
    mesh.position.copy(a).addScaledVector(dir, 0.5);
    mesh.quaternion.setFromUnitVectors(UP, dir.multiplyScalar(1 / len));
    mesh.scale.set(1, len, 1);
  }

  _update(t) {
    // target weaves through and beyond the arm's reach so you see both states
    const reach = this.lenA + this.lenB;
    const rad = reach * (0.62 + 0.5 * (0.5 + 0.5 * Math.sin(t * 0.7)));
    const tx = Math.cos(t * 0.9) * rad, ty = this.root.y + Math.sin(t * 1.3) * 1.6 + 0.4, tz = Math.sin(t * 0.6) * rad * 0.5 + 1.2;
    const tgt = new THREE.Vector3(tx, ty, tz);
    this.target.position.copy(tgt);

    const pole = [this.root.x, this.root.y + 3, this.root.z + 2]; // knee/elbow hint: up & forward
    const sol = twoBoneIK(this.root.toArray(), tgt.toArray(), this.lenA, this.lenB, pole);
    const rootP = new THREE.Vector3().fromArray(sol.root), midP = new THREE.Vector3().fromArray(sol.mid), endP = new THREE.Vector3().fromArray(sol.end);
    this._orient(this.upper, rootP, midP); this._orient(this.fore, midP, endP);
    this.jRoot.position.copy(rootP); this.jMid.position.copy(midP); this.jEnd.position.copy(endP);
    const reached = endP.distanceTo(tgt) < 0.05;
    this.target.material = reached ? this.reachMat : this.missMat;
    this.jEnd.material = reached ? this.reachMat : this.missMat;
  }

  camera(cam, controls) {
    cam.position.set(5.5, 3.4, 6.5); cam.lookAt(0, 1.6, 0.5);
    if (controls) { controls.target.set(0, 1.6, 0.5); controls.minDistance = 4; controls.maxDistance = 18; controls.update(); }
  }

  update(dt) { this.t += dt; this._update(this.t); }
  dispose() { for (const d of this.disposables) d.dispose?.(); }
}
