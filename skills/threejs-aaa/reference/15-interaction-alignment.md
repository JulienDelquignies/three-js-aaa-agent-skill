# Character ↔ Object Interaction & Verification

Making a character interact *correctly* with an object — grab a lever, sit on a chair, climb a
ladder, open a door — means matching **position AND orientation** at an attach point, then
**verifying** the result (in reach? facing it? hand on the grip? feet planted? no interpenetration?).
The starter ships tested implementations in `assets/starter/src/engine/interaction.js`; run
`scripts/verify-interaction.mjs --selftest` to see the checks proven, or `--spec file.json` to
validate a real interaction (exit 0 = valid, 1 = invalid).

Table of contents
- [Sockets / attach points](#sockets--attach-points)
- [Aligning a character to a socket](#aligning-a-character-to-a-socket)
- [Reaching with hand IK](#reaching-with-hand-ik)
- [Verifying correctness](#verifying-correctness)
- [The checks](#the-checks)
- [The verify-interaction script](#the-verify-interaction-script)
- [Runtime vs authoring-time](#runtime-vs-authoring-time)

## Sockets / attach points

A **socket** is an attach point in a parent's local space: `{ pos:[x,y,z], quat:[x,y,z,w] }`.
- On the **object**: where/how the character should connect (a lever's grip, a chair's seat, a
  ladder's rung), with an orientation the hand/body must match.
- On the **character**: the corresponding attach point (right-hand grip, pelvis for sitting).

`socketWorld(parentXf, socket)` returns the socket's world transform (position + orientation).
"Forward" is the object's local **+Z** rotated by its world quaternion (`forwardOf(xf)`).

## Aligning a character to a socket

`alignToSocket` computes the character world transform so its attach point exactly coincides
(position + orientation) with the object socket — the basis for snap-to-interact:

```js
import { alignToSocket } from './engine/interaction.js';
const objectXf = { pos: chair.position.toArray(), quat: chair.quaternion.toArray() };
const seatSocket = { pos: [0, 0.45, 0], quat: [0,0,0,1] };      // seat, in chair-local space
const pelvisAttach = { pos: [0, 0.9, 0], quat: [0,0,0,1] };     // character pelvis, char-local
const { pos, quat } = alignToSocket(objectXf, seatSocket, pelvisAttach);
character.position.fromArray(pos);
character.quaternion.fromArray(quat);
```

The self-test proves that after alignment the character's attach point world transform equals the
object socket to < 1e-4 (position) and < 0.06° (orientation).

## Reaching with hand IK

For "grab" interactions, align the body loosely (or leave it walking), then IK the hand onto the
grip socket and match the wrist orientation:

```js
import { twoBoneIK } from './engine/procedural.js';
import { socketWorld } from './engine/interaction.js';
const grip = socketWorld(objectXf, gripSocket);                 // world target for the hand
const { mid, end, reachable } = twoBoneIK(shoulderPos, grip.pos, upperLen, foreLen, elbowPole);
// pose upper arm toward `mid`, forearm toward `end`, then set the hand quaternion to grip.quat
```

If `reachable` is false, the character must step closer first — gate the interaction on it.

## Verifying correctness

`validateInteraction(spec)` runs every applicable check and returns
`{ ok, checks:[{name, ok, value, tolerance, detail}], failed:[names] }`. This is the "is the
interaction correct — orientation etc." answer, as structured data you can assert on, log, or gate
gameplay with.

```js
import { validateInteraction } from './engine/interaction.js';
const report = validateInteraction({
  actor:    { pos: character.position.toArray(), quat: character.quaternion.toArray(), radius: 0.35 },
  object:   { pos: lever.position.toArray(), quat: lever.quaternion.toArray(), radius: 0.15,
              socket: { pos: [0,0,-0.05], quat: [0,0,0,1] } },
  effector: { pos: handWorldPos.toArray(), quat: handWorldQuat.toArray() },
  feet:     [leftFoot.toArray(), rightFoot.toArray()],
  groundY:  0,
  tolerances: { pos: 0.05, facingDeg: 30, orientDeg: 20, reach: 1.4, ground: 0.03 },
});
if (!report.ok) console.warn('bad interaction:', report.failed, report.checks);
```

Only checks whose inputs are present in the spec run, so you can validate partial interactions.

## The checks

| Check | Passes when | Tolerance |
|---|---|---|
| `onTarget` | hand/effector is at the target | `pos` (m) |
| `facing` | actor's **heading** (XZ plane) points at the target | `facingDeg` |
| `orientation` | effector orientation matches the socket orientation | `orientDeg` |
| `reach` | target is within interaction range of the actor | `reach` / `minReach` (m) |
| `groundContact` | each foot is on the ground plane | `ground` (m) |
| `noPenetration` | actor & object bounding spheres don't overlap | `penetration` (m) |

`facing` is measured on the **horizontal plane** (a character's heading is a ground direction
regardless of the target's height). `orientation` uses the true angular difference between
quaternions. Each check is also exported individually for custom logic.

## The verify-interaction script

```bash
# Prove the IK / alignment / validation math (CI-friendly, exit code)
node ${CLAUDE_SKILL_DIR}/scripts/verify-interaction.mjs --selftest

# Validate a concrete interaction captured to JSON (exit 0 = valid, 1 = invalid)
node ${CLAUDE_SKILL_DIR}/scripts/verify-interaction.mjs --spec ./interaction.json

# Print an example spec to start from
node ${CLAUDE_SKILL_DIR}/scripts/verify-interaction.mjs --example
```

Capture a spec at runtime (dump the actor/object/hand/feet transforms to JSON) and validate it
headlessly — a regression test for your interaction system.

## Runtime vs authoring-time

- **Runtime**: call `validateInteraction` before committing to an interaction (gate "press E to
  grab" on `report.ok`), or each frame to detect drift (hand slipped off the grip → re-IK).
- **Authoring/CI**: export interaction snapshots and run `--spec` in tests, so a bad animation or
  mis-placed socket fails the build instead of shipping a hand floating next to a lever.
- **Tuning tolerances**: tight (`pos 0.02`, `orientDeg 8`) for hero close-ups; loose for background
  NPCs. The `detail` string on each check tells you exactly how far off a failure was.
