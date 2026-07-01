# Character controller — turning input into correct, good-feeling movement

Controls are the point of a game. `engine/character-controller.js` is the native, reusable controller the
skill ships: it couples player intent (a world-space move vector) to **facing**, **locomotion**, and
**no foot-skate**, so a character moves the way players expect. Proven live in the `showcase` gallery's
**Contrôles** scene (drive the Soldier with keyboard/gamepad, dribble, shoot) and reused by the two-player
volley cinematic.

## The one bug that ruins everything: facing (moonwalk)

A model has its own "forward" axis. The three.js **Mixamo Soldier faces −Z** (verified by rendering it
from +Z and seeing its back). If you rotate it to move +X with the naive `rotation.y = π/2`, it ends up
**facing −X while travelling +X → moonwalk**, and anything it "kicks forward" fires backward. The fix is to
turn the model so its forward axis maps onto the travel direction:

```
yaw = atan2(dir.x, dir.z) − atan2(forwardLocal.x, forwardLocal.z)   // forwardLocal = (0,0,−1) for Soldier
```

The controller does this for you (`yawFor`, `faceInstant`, and a rate-limited turn each frame). `forward()`
returns the world direction the model currently faces — use it to aim a shot/pass so it goes where the
player looks. **Always verify**: `dot(forward, velocity) > 0`. The volley scene asserts exactly this
(`players_face_travel_not_moonwalk`), which is what caught the original bug.

## Usage

```js
import { CharacterController } from './engine/character-controller.js';

const ctrl = new CharacterController(model, {
  mixer, runClip, idleClip,
  legs: [ {up,knee,foot}/*L*/, {up,knee,foot}/*R*/ ],   // for foot-lock; omit to skip
  stride: 2.6, runSpeed: 6, turnRate: 12,
  forwardLocal: new THREE.Vector3(0, 0, -1),            // the model's own front axis
});

// each frame:
ctrl.setMoveWorld(mx, mz);   // desired move in world XZ, magnitude 0..1 (walk..run); 0 = idle
ctrl.update(dt);             // moves + turns + blends run/idle + cadence-syncs + foot-locks
```

What `update(dt)` guarantees:
- **Faces travel** — turns toward the move direction (shortest arc, `turnRate` rad/s). No moonwalk.
- **Cadence = ground speed** — `actRun.timeScale = (speed/stride)·runDur` (the live form of `matchCadence`,
  reference/21), so legs turn over as fast as the body moves.
- **Run/idle blend** — by speed, so stopping eases to idle.
- **No foot-skate** — `FootLockIK` pins the planted foot while running (reference/21).

Read `ctrl.pos` (position), `ctrl.yaw`, `ctrl.speed`, `ctrl.forward()` to attach a camera, a dribbled ball,
UI, etc.

## Input → move vector (camera-relative)

Map keys/stick to a **camera-relative** move so "up" always means "away from the camera":

```js
let ix = 0, iz = 0;                                   // from WASD/ZQSD/arrows or gamepad axes (deadzone!)
const fwd = player.pos.clone().sub(cam.position); fwd.y = 0; fwd.normalize();  // camera→player on ground
const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
const move = fwd.multiplyScalar(iz).addScaledVector(right, ix);
ctrl.setMoveWorld(move.x, move.z);
```

Support a gamepad via `navigator.getGamepads()` (left stick = axes 0/1, apply a ~0.18 deadzone; buttons for
shoot/pass). Prefer camera-relative movement + a **third-person follow camera** that trails behind the
player's facing (damp the camera position so it lags and settles — use `Spring`/`damp` from
`procedural.js`). See `showcase/src/scenes/Controls.js` for the full playable example: dribble (knock the
ball ahead when you run onto it), `Space` to shoot along `forward()`, `Shift` for a low cross, goal detect.

## Checklist for "the controls feel right"
1. Model faces where it moves — `dot(forward, velocity) > 0` (no moonwalk); shots use `forward()`.
2. Legs cadence-synced + foot-locked (no slide) — reference/21.
3. Input is camera-relative; gamepad has a deadzone; run/idle blends on start/stop.
4. Third-person camera trails the facing and is damped (no rigid snap).
