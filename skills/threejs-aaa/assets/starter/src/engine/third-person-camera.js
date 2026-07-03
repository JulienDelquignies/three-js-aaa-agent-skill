import * as THREE from 'three/webgpu';

// ThirdPersonCamera — a follow camera the player can also steer. Holds its own yaw/pitch/distance; the
// game feeds it look deltas (mouse drag / right stick / touch) and zoom, and each frame it damps to a
// pose behind the target. `heading` is the world yaw the camera looks along — use it to make WASD
// camera-relative. Native, reusable (reference/22). Pair with CharacterController.
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export class ThirdPersonCamera {
  constructor(camera, { distance = 7, height = 1.5, lookHeight = 1.2, pitch = 0.35, minPitch = -0.15, maxPitch = 1.15, minDist = 3.5, maxDist = 14, damp = 10 } = {}) {
    this.cam = camera; this.yaw = 0; this.pitch = pitch; this.distance = distance;
    this.height = height; this.lookHeight = lookHeight; this.minPitch = minPitch; this.maxPitch = maxPitch;
    this.minDist = minDist; this.maxDist = maxDist; this.dampK = damp;
    this._pos = new THREE.Vector3(); this._want = new THREE.Vector3(); this._look = new THREE.Vector3(); this._init = false;
    this._occDist = Infinity;                              // smoothed occlusion distance (snap in, ease out)
  }
  orbit(dYaw, dPitch) { this.yaw -= dYaw; this.pitch = clamp(this.pitch - dPitch, this.minPitch, this.maxPitch); }
  zoom(d) { this.distance = clamp(this.distance + d, this.minDist, this.maxDist); }
  get heading() { return this.yaw; }                       // world yaw the camera faces along (for camera-relative move)
  setYaw(y) { this.yaw = y; }

  /** obstruct(from, dir, maxDist) → hit distance | null (e.g. Physics.raycast, excluding the player).
   *  When a wall occludes the desired pose, the camera SNAPS in front of it and eases back out. */
  update(target, dt, obstruct = null) {
    const cp = Math.cos(this.pitch);
    // direction FROM target TO camera (behind, raised by pitch)
    const dx = Math.sin(this.yaw + Math.PI) * cp, dz = Math.cos(this.yaw + Math.PI) * cp, dy = Math.sin(this.pitch);
    this._want.set(target.x + dx * this.distance, target.y + this.height + dy * this.distance, target.z + dz * this.distance);
    if (obstruct) {
      const fx = target.x, fy = target.y + this.lookHeight, fz = target.z;
      const vx = this._want.x - fx, vy = this._want.y - fy, vz = this._want.z - fz;
      const full = Math.hypot(vx, vy, vz) || 1e-6;
      const hit = obstruct([fx, fy, fz], [vx / full, vy / full, vz / full], full);
      const allowed = hit != null ? Math.max(0.35, hit - 0.3) : full;
      this._occDist = allowed < this._occDist ? allowed : this._occDist + (allowed - this._occDist) * (1 - Math.exp(-4 * dt));
      const t = Math.min(1, this._occDist / full);
      this._want.set(fx + vx * t, fy + vy * t, fz + vz * t);
    }
    if (!this._init) { this._pos.copy(this._want); this._init = true; }
    const k = 1 - Math.exp(-this.dampK * dt); this._pos.lerp(this._want, k);
    this.cam.position.copy(this._pos);
    this._look.set(target.x, target.y + this.lookHeight, target.z);
    this.cam.lookAt(this._look);
  }
}
