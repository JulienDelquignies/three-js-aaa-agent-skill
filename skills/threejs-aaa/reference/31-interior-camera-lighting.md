# Indoor playability — camera occlusion + interior lighting & switches

Two things make interiors playable at street level: a third-person camera that NEVER clips through walls,
and per-room lighting the player can control. Both native; wired in `examples/showcase` → **Intérieur**.

## Camera occlusion (no more walls between you and your character)

`ThirdPersonCamera.update(target, dt, obstruct)` now takes an occlusion callback — give it a physics
raycast that EXCLUDES the player capsule:

```js
tpc.update(ctrl.pos, dt, (from, dir, max) => phys.raycast(from, dir, max, char.body));
```

When a wall occludes the desired pose, the camera **snaps in front of it** (never through) and **eases
back out** when clear (asymmetric smoothing: instant in, damped out). `Physics.raycast(from, dir, maxDist,
excludeBody)` is the new primitive. Verified headless: desired 8.5 m → clamped to 0.36 m in front of a
wall, with the head→camera segment clear.

Notes:
- Windows/glass panes have **no collider** → the camera sees through them (a feature; add thin colliders
  if you want glass to block the camera).
- In narrow corridors a grazing camera has nowhere to back off — it rides close. Steeper pitch or the
  Sims-style top view (reference/30) are the comfortable defaults indoors; low pitch is now SAFE, just
  intimate.

## Interior lighting + switches

```js
import { lightPlace, switchPositions } from './engine/interior-lighting.js';
const lighting = lightPlace(scene, model, { at });        // pendant fixture + PointLight per room
for (const sw of switchPositions(model, { at }))          // a wall switch beside each room's door
  sys.add({ label: () => (lighting.byId(sw.roomId).on ? 'E — Éteindre' : 'E — Allumer'),
            pos: () => sw.pos, radius: 1.3, onInteract: () => lighting.byId(sw.roomId).toggle() });
```

- Budgeted: no shadow-casting, distance-limited (a room's light stays in its room). ~1 light/room is fine
  in WebGPU forward rendering at house/club scale.
- **Evening ambience** makes it read: dim the sun (~0.5) and `scene.environmentIntensity` (~0.3) so the
  warm room lights carry the interior — and toggling a switch visibly matters.
- Switch placement is derived (beside the room's door, hinge side, 1.1 m up) — same philosophy as doors:
  never hand-placed.
