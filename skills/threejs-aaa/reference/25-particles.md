# Particles — game "juice"

Small effects sell a game: run dust, kick sparks, impact bursts, muzzle flashes, trails. `engine/particles.js`
`ParticleSystem` is a **pooled** GPU particle system — one `InstancedMesh` of camera-facing soft additive
quads, a fixed pool reused across bursts (no per-frame allocation, one draw call). Native/reusable.

```js
import { ParticleSystem } from './engine/particles.js';
const fx = new ParticleSystem(scene, { max: 500 });

// spawn a burst (all fields optional):
fx.emit([x, y, z], { count: 22, speed: 6, spread: 1.2, gravity: -14, ttl: 0.4, size: 0.13, color: 0xffe08a, up: 0.7, drag: 0.6 });

// once per frame, AFTER the camera is positioned (so quads billboard correctly):
fx.update(dt, camera);
```

Each particle fades (shrinks + dims toward invisible on the additive blend) over its `ttl`; `gravity`,
`drag`, `up` (upward bias), and `spread` shape the burst. Pool exhaustion is graceful — extra requests are
dropped, never allocated.

## Recipes (from the **Physique** demo)
- **Kick sparks** — warm burst at the ball on shot: `emit(ballPos, {count:22, speed:6, color:0xffe08a, up:0.7})`.
- **Run dust** — a few grey puffs at the feet each ~60 ms while grounded and `speed > 2.5`:
  `emit([x,0.05,z], {count:3, speed:1.2, color:0x9aa2b0, drag:1.2})`.
- **Landing puff** — a bigger burst on the airborne→grounded transition (`ctrl.airborne` edge).
- **Trail** — call `emit(pos, {count:1, speed:0})` each frame at a moving object.
- **Impact/muzzle** — a short, fast, high-`drag` burst along the surface normal / aim direction.

## Notes
- Update order: move things → position the camera (`tpc.update`) → `fx.update(dt, camera)` so billboards
  face the final camera pose.
- Additive + `toneMapped:false` keeps sparks bright; they also feed the bloom pass (reference/04) nicely.
- Keep `max` sized to the worst-case simultaneous particles; the pool caps cost. For thousands of long-lived
  particles, prefer a TSL compute/GPU system, but this covers gameplay juice cheaply.
