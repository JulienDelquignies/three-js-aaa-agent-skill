import RAPIER from '@dimforge/rapier3d-compat';

// Physics — a thin native wrapper over Rapier for real runtime collisions (roadmap #2). Gives the parts a
// game actually needs: a ground, static/dynamic boxes, a dynamic ball, and a KINEMATIC CHARACTER built on
// Rapier's character controller (slopes, steps, snap-to-ground, and pushing dynamic bodies). The character
// exposes a `move(dx,dy,dz) → {dx,dy,dz,grounded}` that plugs straight into CharacterController.collide,
// so facing/animation/cadence stay in engine/character-controller.js and collision lives here.
//
// Rapier ships as WASM; `Physics.create()` awaits `RAPIER.init()` once.
let _ready = null;
export function initPhysics() { return (_ready ||= RAPIER.init().then(() => RAPIER)); }

export class Physics {
  static async create({ gravity = [0, -18, 0] } = {}) {
    await initPhysics();
    return new Physics(new RAPIER.World({ x: gravity[0], y: gravity[1], z: gravity[2] }));
  }
  constructor(world) { this.world = world; this.R = RAPIER; }
  step() { this.world.step(); }

  addGround(hx = 60, hz = 60, y = 0) {
    const b = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, y - 0.5, 0));
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(hx, 0.5, hz).setFriction(1), b);
    return b;
  }
  // static box; optional quaternion rotation [x,y,z,w] (e.g. a ramp)
  addStaticBox(pos, half, rot = null) {
    let d = RAPIER.RigidBodyDesc.fixed().setTranslation(pos[0], pos[1], pos[2]);
    if (rot) d = d.setRotation({ x: rot[0], y: rot[1], z: rot[2], w: rot[3] });
    const b = this.world.createRigidBody(d);
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(half[0], half[1], half[2]).setFriction(0.9), b);
    return b;
  }
  // kinematic box (animated obstacles: doors, platforms) — drive with setNextKinematicTranslation/Rotation
  addKinematicBox(pos, half) {
    const b = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(pos[0], pos[1], pos[2]));
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(half[0], half[1], half[2]).setFriction(0.6), b);
    return b;
  }
  addDynamicBox(pos, half, { density = 0.5, friction = 0.9 } = {}) {
    const b = this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(pos[0], pos[1], pos[2]).setLinearDamping(0.2).setAngularDamping(0.4));
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(half[0], half[1], half[2]).setDensity(density).setFriction(friction), b);
    return b;
  }
  addDynamicBall(pos, radius, { density = 0.4, restitution = 0.5, friction = 0.6 } = {}) {
    const b = this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(pos[0], pos[1], pos[2]).setLinearDamping(0.35).setAngularDamping(0.7));
    this.world.createCollider(RAPIER.ColliderDesc.ball(radius).setDensity(density).setRestitution(restitution).setFriction(friction), b);
    return b;
  }

  // Kinematic capsule character. `pos` is the FEET position. Returns a handle whose move() resolves a
  // desired feet-space delta against the world and returns the corrected delta + grounded flag.
  addCharacter(pos, { radius = 0.3, height = 1.8, offset = 0.02 } = {}) {
    const halfH = Math.max(0.05, height / 2 - radius);       // capsule cylinder half-height (caps add `radius`)
    const center = height / 2;                               // body origin sits `center` above the feet
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(pos[0], pos[1] + center, pos[2]));
    const col = this.world.createCollider(RAPIER.ColliderDesc.capsule(halfH, radius), body);
    const ctrl = this.world.createCharacterController(offset);
    ctrl.enableAutostep(0.4, 0.15, true);                   // climb small steps
    ctrl.enableSnapToGround(0.3);                           // stick to the ground on descents
    ctrl.setApplyImpulsesToDynamicBodies(true);             // push crates / the ball by walking into them
    ctrl.setCharacterMass(75);
    ctrl.setSlideEnabled(true);
    return {
      body, col, ctrl, center,
      move(dx, dy, dz) {
        ctrl.computeColliderMovement(col, { x: dx, y: dy, z: dz });
        const m = ctrl.computedMovement(); const t = body.translation();
        body.setNextKinematicTranslation({ x: t.x + m.x, y: t.y + m.y, z: t.z + m.z });
        return { dx: m.x, dy: m.y, dz: m.z, grounded: ctrl.computedGrounded() };
      },
      feet() { const t = body.translation(); return [t.x, t.y - center, t.z]; },
    };
  }

  /** First hit distance along a ray, or null. Excludes `excludeBody` (e.g. the player capsule). */
  raycast(from, dir, maxDist, excludeBody = null) {
    const ray = new RAPIER.Ray({ x: from[0], y: from[1], z: from[2] }, { x: dir[0], y: dir[1], z: dir[2] });
    const hit = this.world.castRay(ray, maxDist, true, undefined, undefined, undefined, excludeBody || undefined);
    return hit ? (hit.timeOfImpact ?? hit.toi) : null;
  }

  // Copy a Rapier body's transform onto a THREE.Object3D (call after step()).
  sync(body, obj) { const t = body.translation(), q = body.rotation(); obj.position.set(t.x, t.y, t.z); obj.quaternion.set(q.x, q.y, q.z, q.w); }
}
