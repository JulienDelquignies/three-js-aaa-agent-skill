# Temporal Correctness (Animation-Time Validation)

The snapshot passes (`18`, `15`) check a single frozen frame. Many bugs only exist **over time**:
a foot that skates, an object that detaches mid-swing, a bone that pops/teleports, a loop that
hitches at the seam, an impossible instantaneous speed, a "walk" where both feet float. The temporal
pass catches these by **sampling** the animation and running per-frame checks over the sequence.
Implementation: `assets/starter/src/engine/temporal-validate.js`; proven by `scripts/verify-temporal.mjs
--selftest`.

Table of contents
- [The principle](#the-principle)
- [Sampling an animation](#sampling-an-animation)
- [The checks](#the-checks)
- [Validating a sequence](#validating-a-sequence)
- [Worked example: the volley](#worked-example-the-volley)
- [Integration](#integration)

## The principle

Temporal correctness = a non-temporal predicate that must hold **across a window of frames**, plus
frame-to-frame continuity. You record per-frame arrays (positions, quaternions, grounded flags) while
stepping the animation, then the predicates reduce the sequence to a pass/fail with the first
offending frame. This is the "temporal" branch of the bug taxonomy (`19`); everything else is the
non-temporal snapshot.

## Sampling an animation

Step the `AnimationMixer` at a fixed dt and record world transforms each frame:

```js
const dt = 1 / 30, frames = Math.round(clip.duration * 30);
const footPos = [], ballPos = [], grounded = [];
const p = new THREE.Vector3();
mixer.setTime(0);
for (let i = 0; i < frames; i++) {
  mixer.setTime(i * dt);                 // deterministic seek (or mixer.update(dt))
  scene.updateMatrixWorld(true);
  footBone.getWorldPosition(p); footPos.push(p.toArray());
  ball.getWorldPosition(p);     ballPos.push(p.toArray());
  grounded.push(footBone.getWorldPosition(p).y <= groundY + 0.03);
}
```

For a scripted cinematic (like the football demo), seek your own `setTime(t)` instead of the mixer —
the same deterministic sampling used for capture (`16`).

## The checks

| Check | Catches | Inputs |
|---|---|---|
| `attachmentThroughout` / `heldThroughout` | object detaching mid-motion (ball leaves foot, weapon slips) | anchor vs target positions per frame |
| `noFootSkate` | planted foot sliding | foot positions + grounded flags |
| `noPops` | teleport/jump in position or a rotation flip (non-shortest slerp) | positions (+ quaternions), dt |
| `withinMotionLimits` | impossible speed/acceleration (supersonic hand) | positions, dt |
| `loopSeam` | a looping clip that hitches at the seam | first-frame vs last-frame pose |
| `footPlantPhase` | floating walk (both feet airborne) / double-planted skate | left/right grounded flags + root positions |
| `interactionMeet` | two characters' hands miss (handshake/pass/high-five) | both effectors' positions + window |

Each returns `{ name, ok, value, tolerance, detail }`; `detail` names the offending frame.

## Validating a sequence

```js
import { validateSequence } from './engine/temporal-validate.js';
const report = validateSequence({
  constraints: [
    { type: 'attachedThroughout', anchorPos: ballPos, targetPos: footTipPos, maxGap: 0.12 },
    { type: 'noFootSkate', footPos, grounded, maxPerFrame: 0.02 },
    { type: 'noPops', positions: ballPos, dt: 1/30, maxSpeed: 40 },
    { type: 'footPhase', leftGrounded, rightGrounded, rootPos },
  ],
});
if (!report.ok) console.warn('temporal issues:', report.failed);
```

Or capture the arrays to JSON and run `verify-temporal.mjs --spec seq.json` in CI.

## Worked example: the volley

For the dribble→cross→volley cinematic, the temporal pass asserts what a still frame can't:
- **`attachedThroughout`** — during the dribble window the ball stays within a foot-length of the
  striker's foot every frame (it never floats away or clips through the shin between frames).
- **`noPops`** on the ball — the cross/volley trajectory has no teleport between frames (the parabola
  is continuous), and the strike is a fast-but-finite speed, not an instantaneous jump.
- **`noFootSkate`** — the planted foot at the plant/strike doesn't slide while grounded.
- **`interactionMeet`** — the ball and the striker's foot actually coincide at the contact frame
  (the volley connects), not a near-miss.

The self-test encodes exactly the first case (ball-stays-at-foot vs ball-detaches-mid-contact).

## Integration

Add the temporal pass to the autonomous loop (`17`) for any scene with animation: after the snapshot
placement pass and before/with the render, sample each authored or scripted animation and run
`validateSequence`. A temporal regression (a retarget that introduced foot-skate, an edit that made
the ball detach) then fails CI via `verify-temporal.mjs --spec`. Pair with `05` (Mixamo/retargeting)
and `14`/`15` (procedural animation & interaction) — those produce the motion; this verifies it holds
up over time.
