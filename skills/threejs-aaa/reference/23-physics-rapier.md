# Physics & collisions — Rapier

For real runtime collisions (a character that can't walk through walls, pushes crates, climbs steps; a ball
that bounces and gets kicked), the skill wraps **Rapier** (WASM, deterministic) in `engine/physics.js`.
Playable demo: `examples/showcase` → **Physique**. Requires `@dimforge/rapier3d-compat` (in the starter's
deps; it ships the WASM inline so no bundler config is needed).

## The wrapper

```js
import { Physics } from './engine/physics.js';
const phys = await Physics.create({ gravity: [0, -20, 0] });   // awaits RAPIER.init() once

phys.addGround(35, 25);                                         // fixed floor
phys.addStaticBox([0, 1.2, -12], [18, 1.2, 0.4]);              // a wall (half-extents); optional rot quat
phys.addStaticBox([-9, 0.5, 6], [3, 0.25, 2.2], rampQuat);     // a ramp
const crate = phys.addDynamicBox([-2, 0.4, 2], [0.4, 0.4, 0.4]);
const ball  = phys.addDynamicBall([2, 0.16, 1], 0.16, { density: 22, restitution: 0.55 });

// each frame, AFTER moving the character (below):
phys.step();
phys.sync(crate, crateMesh);                                   // copy body transform → THREE.Object3D
phys.sync(ball,  ballMesh);
```

## Character = CharacterController + a `collide` hook

Keep facing / animation / cadence in `CharacterController` (reference/22) and let Rapier resolve movement.
`phys.addCharacter(feetPos, {radius, height})` builds a kinematic capsule + Rapier's
`KinematicCharacterController` (auto-step, snap-to-ground, and **pushing dynamic bodies**), and returns a
`move(dx,dy,dz) → {dx,dy,dz,grounded}`. Wire it as the controller's collision resolver:

```js
const char = phys.addCharacter([-8, 0, 0], { radius: 0.32, height: 1.8 });
ctrl.collide = (dx, dy, dz) => char.move(dx, dy, dz);   // controller now resolves against the world
// per frame: ctrl.setMoveWorld(...); ctrl.update(dt); phys.step(); sync meshes.
```

With `collide` set, `CharacterController.update` applies gravity every frame, hands the desired
`(horizontal, vertical)` delta to `move()`, applies the **corrected** delta (so walls stop it, ramps lift
it), and reads `grounded` back (resets fall speed, gates jump and foot-lock). Cadence uses the *corrected*
horizontal distance, so the legs slow when the body is blocked — no skating into a wall.

## Kicking / shooting

Set a **velocity** for a predictable launch (mass-independent), rather than an impulse (which depends on the
body's mass — a light ball + a fixed impulse rockets off at 1000 m/s):

```js
if (near && input.pressed('shoot')) ball.setLinvel({ x: fwd.x*12, y: 4.5, z: fwd.z*12 }, true);
```

Contact "dribbling" is free: `setApplyImpulsesToDynamicBodies(true)` (on by default in the wrapper) means
walking the capsule into the ball/crates pushes them.

## Gotchas
- **Order per frame**: read input → `ctrl.update(dt)` (calls `move()`, which queues the kinematic step) →
  `phys.step()` → `phys.sync()` meshes. The character's visual follows `ctrl.pos`; the body advances at step.
- **Feet vs body**: `addCharacter` takes the FEET position; the capsule body centre sits `height/2` above.
  The model's grounded origin and the controller share the same corrected deltas, so they stay aligned.
- **Mass**: tune dynamic-body `density` for feel (a football ≈ 0.4 kg → density ~22 at r=0.16). Use
  `setLinvel` for deterministic kicks; reserve `applyImpulse` for when you actually want mass to matter.
- Rapier is ~1–2 MB of WASM. Load it only in scenes that need physics (it's a separate module/chunk).
