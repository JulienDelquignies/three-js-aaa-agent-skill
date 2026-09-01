// drive — FREE DRIVING as a first-class control mode (the DS takes the wheel of his own car): an
// arcade bicycle-model controller, dependency-free like character-controller (physics injected via
// `collide`, so it is node-testable). Convention matches the vehicles everywhere in this engine:
// yaw 0 faces +z, forward = [sin(yaw), cos(yaw)], group.rotation.y = yaw.
//   const drv = new DriveController({ pos: [x, z], yaw });
//   drv.collide = (dx, dz) => ({ dx, dz });            // resolved delta (kinematic capsule move)
//   const s = drv.update(dt, { throttle: -1..1, steer: -1..1, brake: bool });
//   car.position.set(s.x, 0, s.z); car.rotation.y = s.yaw; wheels.rotation.x += s.wheelSpin * dt;
// Bicycle model: yaw' = (v / wheelBase) * tan(steerAngle); the steering angle tightens at low speed
// and relaxes at high speed (speed-sensitive), reverse steering comes out right through v's sign.
export class DriveController {
  constructor({ pos = [0, 0], yaw = 0, maxSpeed = 30, maxReverse = 7, accel = 13, brakeDecel = 28, drag = 0.55, steerMax = 0.62, wheelBase = 2.6, wheelRadius = 0.33 } = {}) {
    this.pos = [pos[0], pos[1]]; this.yaw = yaw; this.speed = 0;
    Object.assign(this, { maxSpeed, maxReverse, accel, brakeDecel, drag, steerMax, wheelBase, wheelRadius });
    this.collide = null;                                     // (dx, dz) => {dx, dz} resolved by physics
    this.blocked = false;
  }

  update(dt, { throttle = 0, steer = 0, brake = false } = {}) {
    // longitudinal: throttle drives, brake bleeds hard toward 0, drag coasts down
    if (brake) this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), this.brakeDecel * dt);
    else this.speed += this.accel * throttle * dt;
    this.speed -= this.speed * this.drag * dt;
    this.speed = Math.max(-this.maxReverse, Math.min(this.maxSpeed, this.speed));
    if (Math.abs(this.speed) < 0.01 && !throttle) this.speed = 0;

    // lateral: speed-sensitive steering angle, bicycle-model yaw rate (reverse inverts via v's sign)
    const sa = steer * this.steerMax / (1 + Math.abs(this.speed) * 0.055);
    if (Math.abs(this.speed) > 0.05) this.yaw += (this.speed / this.wheelBase) * Math.tan(sa) * dt;

    // integrate + resolve against the world; a hard block scrubs speed (you hit the wall, not clip it)
    const want = [Math.sin(this.yaw) * this.speed * dt, Math.cos(this.yaw) * this.speed * dt];
    let moved = want;
    if (this.collide && (want[0] || want[1])) {
      const r = this.collide(want[0], want[1]);
      moved = [r.dx, r.dz];
      const askLen = hyp(...want), gotLen = hyp(...moved);
      this.blocked = askLen > 1e-4 && gotLen < askLen * 0.45;
      if (this.blocked) this.speed *= 0.25;
    } else this.blocked = false;
    this.pos[0] += moved[0]; this.pos[1] += moved[1];
    return { x: this.pos[0], z: this.pos[1], yaw: this.yaw, speed: this.speed, wheelSpin: this.speed / this.wheelRadius, blocked: this.blocked };
  }
}
import { hyp } from './hyp.js';
