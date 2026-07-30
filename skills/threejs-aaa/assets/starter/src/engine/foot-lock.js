// FootLockIK — the stance finisher for foot-skate. Pairs with matchCadence (./locomotion.js): cadence
// ties the legs to ground speed, this pins whichever foot is in contact so it doesn't smear across the
// ground. Needed whenever a clip's authored foot push is smaller than the distance you move it over
// (very common with Mixamo clips meant for root-motion — measured on Soldier.glb, NO playback speed makes
// its Run grip). Fits bone rotations in world space, so it's rig-agnostic (Mixamo, RPM, …). See reference/21.
//
// Requires THREE (poses real bones) + twoBoneIK (analytic, from procedural.js). Per frame call order:
//   place the model → mixer/clip pose → (procedural layers) → updateMatrixWorld(true) → footLock.solve().

import * as THREE from 'three/webgpu';
import { twoBoneIK } from './procedural.js';

const _hip = new THREE.Vector3(), _knee = new THREE.Vector3(), _foot = new THREE.Vector3();
const _tgt = new THREE.Vector3(), _cur = new THREE.Vector3(), _des = new THREE.Vector3();
const _mid = new THREE.Vector3(), _end = new THREE.Vector3();
const _q = new THREE.Quaternion(), _wq = new THREE.Quaternion(), _pw = new THREE.Quaternion();

// Rotate `bone` (in world space) so that its `child` joint aims from the bone toward `worldTarget`.
// Axis-agnostic: it measures the current world aim and rotates it onto the desired aim, so it works
// for any rig's local bone orientation. Caller must updateMatrixWorld after.
// Exported: strike-warp (the gesture-window leg authority) applies its IK with the SAME primitive —
// one way to pose a leg in this engine, not two.
export function aimChildAt(bone, child, worldTarget) {
  bone.getWorldPosition(_hip); child.getWorldPosition(_knee);
  _cur.copy(_knee).sub(_hip); _des.copy(worldTarget).sub(_hip);
  if (_cur.lengthSq() < 1e-10 || _des.lengthSq() < 1e-10) return;
  _cur.normalize(); _des.normalize();
  _q.setFromUnitVectors(_cur, _des);              // world-space delta
  bone.getWorldQuaternion(_wq);
  _wq.premultiply(_q);                             // new world = delta * current
  bone.parent.getWorldQuaternion(_pw).invert();
  bone.quaternion.copy(_pw.multiply(_wq));         // back to local
  bone.updateMatrixWorld(true);
}

/**
 * Foot-lock IK. Construct with leg chains, each { up, knee, foot } (e.g. mixamorigRightUpLeg / RightLeg /
 * RightFoot), then call solve() every frame AFTER the clip has posed the skeleton and the model is placed.
 * Detecting "grounded" needs the foot's true resting height, which differs per foot on stylized clips —
 * pass a `sampleClip(phase01)` that poses the skeleton at a normalized clip phase (the ctor sweeps it once
 * to find each foot's floor). Without it, the floor is learned online (less robust on the first cycle).
 */
export class FootLockIK {
  constructor(legs, { contactBand = 0.05, sampleClip = null, samples = 40 } = {}) {
    this.legs = legs; this.contactBand = contactBand;
    this.state = legs.map(() => ({ grounded: false, lock: new THREE.Vector3(), floor: Infinity, online: true }));
    this.lens = legs.map((l) => {
      l.up.getWorldPosition(_hip); l.knee.getWorldPosition(_knee); l.foot.getWorldPosition(_foot);
      return { A: _hip.distanceTo(_knee), B: _knee.distanceTo(_foot) };
    });
    if (sampleClip) {                                    // calibrate each foot's true ground height once
      for (let s = 0; s < samples; s++) {
        sampleClip(s / samples);
        legs.forEach((l, i) => { l.foot.getWorldPosition(_foot); this.state[i].floor = Math.min(this.state[i].floor, _foot.y); this.state[i].online = false; });
      }
    }
  }

  solve() {
    for (let i = 0; i < this.legs.length; i++) {
      const l = this.legs[i], st = this.state[i], { A, B } = this.lens[i];
      l.foot.getWorldPosition(_foot);
      if (st.online) st.floor = Math.min(st.floor, _foot.y);
      const grounded = _foot.y <= st.floor + this.contactBand;
      if (!grounded) { st.grounded = false; continue; }                  // swing: leave the clip pose
      if (!st.grounded) { st.grounded = true; st.lock.copy(_foot); }     // touchdown: capture world XZ
      _tgt.set(st.lock.x, _foot.y, st.lock.z);                           // hold XZ, clip drives foot height
      l.up.getWorldPosition(_hip); l.knee.getWorldPosition(_knee);
      if (_hip.distanceTo(_tgt) > (A + B) * 0.995) { st.grounded = false; continue; } // out of reach → release, no splay
      const pole = [_knee.x - _hip.x, _knee.y - _hip.y, _knee.z - _hip.z]; // keep the clip's natural knee bend
      const sol = twoBoneIK(_hip.toArray(), _tgt.toArray(), A, B, pole);
      aimChildAt(l.up, l.knee, _mid.fromArray(sol.mid));
      aimChildAt(l.knee, l.foot, _end.fromArray(sol.end));
    }
  }
}
