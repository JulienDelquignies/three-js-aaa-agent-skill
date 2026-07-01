# Locomotion — moving a clip-driven character without foot-skate

**The correctness property:** a character that runs/walks over ground must not *slide* ("ice-skating") —
the planted foot stays put on the pitch while the body moves; only the swing foot travels. This is a
first-class AAA requirement, not a per-game trick, so the skill ships it as a native engine module:
`engine/locomotion.js`, verified by the temporal `noFootSkate` check (`reference/20`) and demonstrated
on a **real Mixamo rig** in `examples/soldier-volley/`.

Foot-skate has **two independent causes**, each fixed by one piece of the module. You usually need both.

## Cause 1 — cadence mismatch → `matchCadence()`

If you slide a clip along a path at a speed unrelated to the clip's playback rate, the legs turn over at
the wrong rate and the planted foot smears. The fix is to drive the **clip phase from distance travelled**,
not wall-clock, so the legs always cycle at ground speed:

```js
import { matchCadence } from './engine/locomotion.js';
// strideLength = metres of ground one clip loop should cover (a property of the CLIP; tune once).
mixer.setTime(matchCadence(runClip.duration, distanceTravelled, strideLength));
```

Guarantee: advance the body by exactly `strideLength` and the clip advances exactly one loop — cadence is
locked to ground speed at any speed, including through acceleration/deceleration. This alone removes the
gross skate you get from a fixed clip rate.

`estimateStride(sampleFootWorldX)` gives a starting `strideLength` from a foot bone's peak-to-peak sweep —
a value to **tune**, then verify with `noFootSkate`. (In-place clips carry no ground truth for stride.)

## Cause 2 — the clip's feet barely push → `FootLockIK`

Many clips (especially Mixamo clips authored for **root-motion**) have almost no in-place foot travel — the
engine was expected to move the character. Cadence-matched or not, the stance foot then still creeps,
because the clip itself doesn't plant it. Measured on `Soldier.glb`'s Run: **no** playback speed makes the
foot grip — in deepest stance it still slides faster than the ground. The exact fix is to pin it:

```js
import { FootLockIK } from './engine/foot-lock.js';
const footLock = new FootLockIK(
  [ { up: lUpLeg, knee: lLeg, foot: lFoot }, { up: rUpLeg, knee: rLeg, foot: rFoot } ],
  { contactBand: 0.05,
    // sweep the clip once so each foot's true ground height is known (feet often rest at different Ys)
    sampleClip: (p) => { model.position.set(0,0,0); mixer.setTime(p * runClip.duration); scene.updateMatrixWorld(true); } },
);
// each frame, AFTER the clip poses the skeleton and the model is placed:
scene.updateMatrixWorld(true);
footLock.solve();   // pins whichever foot is in contact to its touchdown spot via analytic two-bone IK
```

How it works: when a foot enters its ground band it captures the world **XZ** where it touched down and holds
it there (the clip still drives foot **height**), solving the hip→knee→foot chain with `twoBoneIK`
(`reference/14`) to keep the leg natural; on toe-off it releases back to the clip. It's axis-agnostic
(fits bone rotations in world space) so it works on any rig — Mixamo, Ready Player Me, etc. — with no
bind-pose assumptions. If a locked target goes out of reach it releases instead of splaying.

**Result on the real rig** (`window.__volleyReport` in the example): planted-foot slip **0.15 m/frame →
0 m/frame**. The foot grips; `noFootSkate` passes.

### Gotchas
- Call `footLock.solve()` **last** in the frame — after the clip pose, any procedural layers, and
  `updateMatrixWorld(true)`. It reads and rewrites bone rotations.
- Don't foot-lock a leg you're **also** driving procedurally that frame (e.g. a kick) — they fight. In the
  example, foot-lock runs only during the run-up and hands the right leg to the kick near contact.
- Give it the **true** per-foot ground height via `sampleClip`; a wrong floor makes swing frames count as
  "grounded", which captures a lock mid-air and yanks the leg. This was the one bug to get right.
- Feet-locked locomotion is a **stance** fix; combine with `matchCadence` so the cadence is right too.

## Camera — a follow rig that doesn't feel static

"The camera isn't great" usually means it's a fixed keyframe track while the action moves. For moving
action, dolly **with** the subject, then hand off to a keyframed/goal-watching pose — continuously, so
there's no cut. In `SoldierVolley.setTime(t, camera)`: during the run the camera trucks alongside the
striker (`pos = subject + sideOffset`, `lookAt = subject + lookAhead`); at the strike it eases from that
exact follow pose into a wide that watches the ball into the net (see the file for the full rig). Use the
`Spring`/`damp` helpers in `procedural.js` for a real-time follow camera that lags and settles naturally.

## Checklist for "my character runs, it doesn't slide"
1. Drive the clip with `matchCadence(clipDur, distance, strideLength)` — cadence tracks ground speed.
2. Add `FootLockIK` with per-foot `sampleClip` calibration; `solve()` last each frame.
3. Verify with `noFootSkate` (`scripts/verify-temporal.mjs`) — planted foot ≤ ground travel per frame.
4. For the camera, track the subject during motion; ease into keyframes for beats.
