import * as THREE from 'three/webgpu';
import { FootLockIK } from './foot-lock.js';
import { WORLD } from './world-basis.js';

// CharacterController — turn input into believable, correct movement. This is the point of the skill:
// good controls. It couples player intent (a world-space move vector, 0..1) to:
//   • facing        — the model turns to face where it moves (shortest-arc, rate-limited) so it never
//                      moonwalks. `forwardLocal` is the model's own "front" axis (Mixamo Soldier = −Z).
//   • locomotion    — run/idle blend by speed, and clip cadence tied to ground speed via timeScale
//                      (= the live form of matchCadence) so the legs turn over as fast as it moves.
//   • no foot-skate — FootLockIK pins the planted foot while running (see reference/21).
// The controller owns position + yaw; read `.model`, `.pos`, `.forward()` to attach a camera, ball, etc.
const FWD = new THREE.Vector3(0, 0, -1);

export class CharacterController {
  constructor(model, { mixer, runClip, idleClip, legs = null, stride = 2.6, runSpeed = 5.5, sprintMult = 1.6, jumpSpeed = 5.5, gravity = 18, accel = 14, turnRate = 12, forwardLocal = FWD } = {}) {
    this.model = model; this.mixer = mixer; this.runDur = runClip.duration;
    this.actRun = mixer.clipAction(runClip); this.actRun.play(); this.actRun.weight = 0;
    this.actIdle = idleClip ? mixer.clipAction(idleClip) : null;
    if (this.actIdle) { this.actIdle.play(); this.actIdle.weight = 1; }
    this.stride = stride; this.runSpeed = runSpeed; this.sprintMult = sprintMult; this.jumpSpeed = jumpSpeed; this.gravity = gravity;
    this.accel = accel; this.turnRate = turnRate;
    // optional physics resolver: collide(dx,dy,dz) → {dx,dy,dz,grounded}. If set, movement is resolved
    // against the physics world (Rapier) instead of moving freely + clamping to a flat groundY.
    this.collide = null;
    this.fwd = forwardLocal.clone().normalize();
    this.fa = WORLD.forwardAngle([this.fwd.x, this.fwd.y, this.fwd.z]); // ground angle of the model's forward axis
    this.pos = model.position.clone(); this.yaw = model.rotation.y; this.dist = 0; this.speed = 0;
    this.groundY = this.pos.y; this.vy = 0; this.airborne = false; this._sprint = false;
    this._move = new THREE.Vector2(); this._cur = new THREE.Vector2();  // desired / smoothed move
    this.footLock = legs ? new FootLockIK(legs, {
      contactBand: 0.05,
      sampleClip: (p) => { this.mixer.setTime(p * this.runDur); this.model.updateWorldMatrix(true, true); },
    }) : null;
  }

  // Desired move in world XZ (e.g. from camera-relative WASD / left stick). Magnitude 0..1 = walk..run.
  setMoveWorld(x, z) { this._move.set(x, z); if (this._move.lengthSq() > 1) this._move.normalize(); }
  setSprint(on) { this._sprint = !!on; }
  jump() { if (!this.airborne) { this.vy = this.jumpSpeed; this.airborne = true; } }

  // Yaw that turns the model's forward axis onto world dir (dx,dz) — via the WorldBasis, so facing is
  // always consistent (no moonwalk). For forward=−Z this resolves to atan2(dx,dz)−π.
  yawFor(dx, dz) { return WORLD.yawToFace(dx, dz, this.fa); }
  faceInstant(dx, dz) { this.yaw = this.yawFor(dx, dz); this.model.rotation.y = this.yaw; }
  // The world direction the model currently faces (unit XZ) — where a shot/pass would go.
  forward(out = new THREE.Vector3()) { const [dx, dz] = WORLD.facingDir(this.yaw, this.fa); return out.set(dx, 0, dz); }

  update(dt) {
    // smooth the input so starts/stops ease instead of snapping
    const k = 1 - Math.exp(-this.accel * dt);
    this._cur.lerp(this._move, k);
    const mag = this._cur.length(); this.speed = mag * this.runSpeed * (this._sprint ? this.sprintMult : 1);
    let ddx = 0, ddz = 0;                                    // desired horizontal delta this frame
    if (mag > 0.02) {
      const dx = this._cur.x / mag, dz = this._cur.y / mag;
      this.yaw = WORLD.turnToward(this.yaw, this.yawFor(dx, dz), this.turnRate * dt);
      const adv = this.speed * dt; ddx = dx * adv; ddz = dz * adv;
    }
    if (this.collide) {
      // physics-resolved: gravity always applies; the resolver reports contact with the ground
      this.vy -= this.gravity * dt;
      const r = this.collide(ddx, this.vy * dt, ddz);
      this.pos.x += r.dx; this.pos.y += r.dy; this.pos.z += r.dz;
      if (r.grounded) { if (this.vy < 0) this.vy = 0; this.airborne = false; } else this.airborne = true;
      this.dist += Math.hypot(r.dx, r.dz);                  // cadence tracks ACTUAL movement (blocked → legs slow)
    } else {
      this.pos.x += ddx; this.pos.z += ddz; this.dist += Math.hypot(ddx, ddz);
      if (this.airborne || this.vy !== 0) { this.vy -= this.gravity * dt; this.pos.y += this.vy * dt; if (this.pos.y <= this.groundY) { this.pos.y = this.groundY; this.vy = 0; this.airborne = false; } }
    }
    this.model.position.copy(this.pos); this.model.rotation.y = this.yaw;

    const runRef = this.runSpeed * (this._sprint ? this.sprintMult : 1);
    const run01 = Math.min(1, this.speed / runRef);
    this.actRun.weight = run01; if (this.actIdle) this.actIdle.weight = 1 - run01;
    this.actRun.timeScale = Math.max(0.001, (this.speed / this.stride) * this.runDur); // cadence = ground speed
    this.mixer.update(dt);
    this.model.updateWorldMatrix(true, true);
    if (this.footLock && run01 > 0.25 && !this.airborne) this.footLock.solve();
  }
}
