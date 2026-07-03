# Venues & encounters — the restaurant, the meeting table, the seated NPC

First social brick of the DS-game vision: places you go to MEET someone, and a staged face-to-face
encounter with an NPC. Everything derived + contract-checked, playable in **Carrière** (site Restaurant).

## The `restaurant` place type (grammar)

`generatePlace({ type: 'restaurant', tier: 1..5, seed })` — t1 bistrot → t5 gastronomique. The dining
room IS the hub (`salle-resto`: bar counter + stools, tables of two with chairs FACING EACH OTHER),
kitchen and toilets attached, and from t3 up: **`salon-prive`** — the private dining room where the
confidential meetings happen. Same solver, same `checkModel()` contract, same harness
(verify-floorplan: 15 programs now).

Furnishing archetypes (`furnish.js`):
- `dining` — bar (counter + 3 stools facing it) + up to 4 two-seat tables, chairs opposed, plants.
- `meeting` — THE meeting table: placement searched for the WHOLE ensemble (table + both chairs,
  both orientations) — searching for the table alone can pin it to a wall so the second chair never
  fits; the contract caught exactly that. Plus sideboard + plant.

Named contract in `checkFurnishing()`: every `salon-prive*` must contain a table with **2 seats facing
each other across it** (opposed yaws). Sabotages proven: a seat deleted, the table deleted → caught.

## The seated NPC + the encounter loop

The NPC is the same rig + the same `CharacterController` as the player (steering/AI reuse it too):

```js
const npc = new CharacterController(npcModel, { mixer, runClip, idleClip, walkClip, legs });
npc.sitAt({ pos: chairWorld, yaw: npc.yawFor(Math.sin(chair.yaw), Math.cos(chair.yaw)), seatH: 0.45 });
// each frame: npc.update(dt)  (seated pose + idle anim, no input needed)
```

The opposite chair carries the encounter interactable: sit → E advances placeholder dialogue lines
(shown in a `#dialog` HUD bubble) → last E stands up and closes the bubble. The dialogue CONTENT is a
placeholder for the diegetic-UI layer (phone/computer) — the staging (who sits where, facing whom) is
the reusable part.

## The yaw-convention trap (bug found by the face-to-face check)

**Furniture yaw and character yaw are different conventions.** Furniture: `yaw 0 = faces +z`
(`dir = [sin(yaw), cos(yaw)]`, what `checkFurnishing` verifies). Character: yaw turns the model's OWN
forward axis (Mixamo Soldier = −Z) onto the target — offset by π for this rig. Passing a chair's yaw
straight into `sitAt()` seats the model BACKWARDS (it passed every hip-height check — only a
facing assertion caught it). Always convert through the WorldBasis:

```js
ctrl.sitAt({ pos, yaw: ctrl.yawFor(Math.sin(item.yaw), Math.cos(item.yaw)), seatH });
```

Headless proof (Carrière): player and NPC seated 1.6 m apart with `dot(forward, toOther) = 1.00` both
ways. Also fixed alongside: after `standUp()`, re-seat the physics capsule on the controller position
(`_syncBody`) — sitting teleports the visual model but the capsule kept its pre-sit position.
