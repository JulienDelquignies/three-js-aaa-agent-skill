# Interactables — doors that open, sitting, picking up (the playable side)

The validators (reference/15/18/20) CHECK interactions; `engine/interactables.js` makes them PLAYABLE:
a proximity system with prompts, hinged doors with animated physics colliders, carry-in-hand helpers —
plus `CharacterController.sitAt()/standUp()` for seats. Demo: `examples/showcase` → **Intérieur**
(a generated club: open doors, sit on the locker bench, carry the ball). All headless-verified.

## Proximity + prompts

```js
import { InteractableSystem } from './engine/interactables.js';
const sys = new InteractableSystem();
sys.add({ label: () => 'E — Ouvrir la porte', pos: () => door.centre(), radius: 1.6, onInteract: () => door.toggle() });
// per frame: sys.update(ctrl.pos); promptEl.textContent = sys.promptText;
// on the interact action (Input keymap {e:'interact'}, gamepad padmap {2:'interact'}): sys.interact();
```

## Doors (really block until opened)

`doorsFromFloorplan(scene, phys, model, floorIdx, {at})` builds a `Door` for every doorway of a generated
place (reference/27): hinged visual panel + **kinematic Rapier collider** driven with the panel
(`setNextKinematicTranslation/Rotation`), damped swing (~93°). Verified: character advance through the
doorway 0.54 m closed (blocked by the panel) vs 4.5 m open; collider displaced 0.73 m.
`phys.addKinematicBox()` is the primitive (any animated obstacle: doors, platforms).

## Sitting (procedural pose, hips ON the seat)

```js
ctrl.sitAt({ pos: seatXZ, yaw: seatYaw, seatH: 0.45 });   // freezes locomotion, poses the legs
ctrl.standUp();                                            // restores rests, steps off the seat
```
No sit clip needed: the controller lowers the model so the **hips rest at seatH** (+8 cm) and bends
thighs/shins procedurally (rest rotations captured at init). Verified: hips at 0.50 m on a 0.45 m bench,
exactly the `sitPose` rule from reference/18. Seat heights per furniture kind: bench/chair 0.45,
office-chair 0.5, sofa 0.42, stool 0.7.

## Carrying (attach to the hand bone)

```js
if (carrying) carryFollow(rightHandBone, ballMesh, ballBody);   // per frame; body disabled while carried
```
Pickup = `body.setEnabled(false)` + follow the hand (verified: ball ≤0.13 m from the hand — the
`heldInHand` rule); drop = re-enable, place ahead, small forward velocity.

## Input mapping
`Input` now takes `{ keymap, padmap }` per instance — the demo maps `e → 'interact'` and gamepad X.
Touch gets its buttons automatically.

## Gotchas
- Scene `update()` overwrites `setMoveWorld` from input each frame — in headless tests drive
  `ctrl.update()` + `door.update()` + `phys.step()` directly instead of calling scene.update.
- Interior third-person camera: a steep pitch (~0.9 rad, minPitch 0.6) keeps the camera ABOVE roofless
  walls (Sims-style) — no wall clipping without camera-collision code. Street-level view needs camera
  collision (roadmap).
- Doors swing to +normal side; in rare tight layouts a panel can sweep near furniture — the furnish
  door-clearance zones (reference/28) keep the swing area free by construction.
