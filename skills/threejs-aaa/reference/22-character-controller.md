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

Also: `ctrl.setSprint(bool)` (speed ×`sprintMult`), `ctrl.jump()` (vertical velocity + gravity, lands on
`groundY`; foot-lock auto-disables while airborne). Read `ctrl.pos`, `ctrl.yaw`, `ctrl.speed`,
`ctrl.forward()`, `ctrl.airborne` to attach a camera, a dribbled ball, UI, etc.

## Native input + camera (the rest of "controls")

Two more native modules complete a real control scheme — don't hand-roll these:

- **`engine/input.js` `Input`** — one abstraction over **keyboard + gamepad + mouse-look + touch**. It
  builds an on-screen joystick + action buttons on touch devices automatically. Read intent, not devices:
  ```js
  const input = new Input(document.body);
  // each frame:
  input.update();                         // polls the gamepad
  const mv   = input.move();              // {x,z} on the unit disk (keys / left stick / touch stick)
  const look = input.consumeLook();       // {dx,dy} mouse drag / right stick / right-side touch
  const zoom = input.consumeZoom();       // wheel / pinch
  input.down('sprint');                   // held (Shift / RB / stick-to-rim)
  if (input.pressed('jump'))  ctrl.jump();   // edge (J / gamepad B)
  if (input.pressed('shoot')) shoot();       // edge (Space / gamepad A)
  if (input.pressed('cross')) cross();       // edge (E / gamepad X)
  input.endFrame();                       // clears edge-triggers
  ```
- **`engine/third-person-camera.js` `ThirdPersonCamera`** — a follow camera the player can also steer
  (`orbit(dx,dy)`, `zoom(d)`), damped behind the target. Its `heading` (yaw) is what makes movement
  camera-relative:
  ```js
  tpc.orbit(look.dx, look.dy); tpc.zoom(zoom);
  const yaw = tpc.yaw, fx = Math.sin(yaw), fz = Math.cos(yaw);   // camera forward on the ground
  ctrl.setMoveWorld(fx*mv.z - fz*mv.x, fz*mv.z + fx*mv.x);       // right = (−fz, fx)
  ctrl.update(dt);
  tpc.update(ctrl.pos, dt);                                       // follow (optionally auto-swing behind facing)
  ```

The **Contrôles** scene (`showcase/src/scenes/Controls.js`) wires all of it: run, look, zoom, sprint,
jump, dribble (knock the ball ahead when you run onto it), `Space` shoots along `forward()`, `E` crosses
low, goal detection + net ripple — playable on keyboard, gamepad, and phone.

## Checklist for "the controls feel right"
1. Model faces where it moves — `dot(forward, velocity) > 0` (no moonwalk); shots use `forward()`.
2. Legs cadence-synced + foot-locked (no slide) — reference/21.
3. Movement is **camera-relative** (via the camera's `heading`); gamepad axes have a deadzone; run/idle
   blends on start/stop; sprint/jump available.
4. Third-person camera is **steerable** (mouse/right-stick/touch look + zoom) and damped, not a rigid rig.
5. **Touch**: an on-screen joystick + buttons exist so it's playable on a phone (`Input` adds them).
