# AI opponents — steering behaviours

Simple, readable NPC/opponent movement without a planner: `engine/steering.js` provides the classic
Reynolds behaviours (seek / flee / arrive / pursue / wander) as pure functions on planar `[x, z]` vectors.
Compose them into a desired velocity, convert to a controller input, and drive the SAME
`CharacterController` you use for the player — so the AI gets correct facing, no foot-skate, and (with
`.collide`) physics collisions for free. Dependency-free → node-testable (`scripts/verify-steering.mjs`).
Mirrors the behaviour blocks in [GameBlocks](https://github.com/xt4d/GameBlocks); pairs with reference/22–23.

## Usage — an opponent that contests the ball

```js
import { pursue, seek, toMoveInput } from './engine/steering.js';

// build the opponent exactly like the player (own CharacterController + physics character), then per frame:
const aiPos = [ai.pos.x, ai.pos.z], ball = [b.x, b.z], player = [p.pos.x, p.pos.z];
let vel;
if (dist(aiPos, ball) > 1.0) {
  vel = pursue(aiPos, ball, ballVelXZ, ai.runSpeed, 0.35);        // intercept the ball's PREDICTED position
} else {
  const away = normalize(sub(ball, player));                      // has the ball → shield/clear it from the player
  vel = seek(aiPos, add(ball, scale(away, 2.5)), ai.runSpeed);
  if (kickReady) ball.setLinvel({ x: away[0]*9, y: 3, z: away[1]*9 }, true);
}
const [mx, mz] = toMoveInput(vel, ai.runSpeed);                   // desired velocity → move input (dir × 0..1)
ai.setMoveWorld(mx, mz); ai.update(dt);                           // same controller as the player
```

Playable demo: `examples/showcase` → **Physique** (a red-tinted opponent chases and boots the ball away;
both are physics capsules, so they also bump each other). Verified headless: the AI closes to 0.5 m of the
ball and displaces it ~9 m while the idle player doesn't move.

## The behaviours
- **seek(pos, target, maxSpeed)** — full-speed straight at a point.
- **flee(pos, target, maxSpeed)** — full-speed away (evade).
- **arrive(pos, target, maxSpeed, slowRadius)** — seek that eases to a stop on the target (no orbiting).
- **pursue(pos, targetPos, targetVel, maxSpeed, predict)** — seek the target's future position (intercept).
- **wander(baseHeading, t, maxSpeed, jitter)** — meandering idle patrol.
- **toMoveInput(vel, maxSpeed)** — desired velocity → `CharacterController.setMoveWorld` input.

## Notes
- **Order per frame** with physics: drive the player, then each AI (`ai.update(dt)` queues its kinematic
  move), then a single `phys.step()`, then sync meshes. Two kinematic capsules collide, so opponents block
  each other and the player.
- Blend behaviours by summing their velocities (e.g. `pursue(ball) + flee(nearestFoe)*0.5`), then clamp with
  `toMoveInput`. For routes/obstacles, layer waypoints or a grid path on top (a natural next block).
- Give opponents a slightly lower `runSpeed` (or reaction delay) so the player can win.
