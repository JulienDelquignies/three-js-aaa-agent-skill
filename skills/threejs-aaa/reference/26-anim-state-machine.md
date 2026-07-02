# Animation state machine — Idle→Walk→Run blends + transitions

`engine/anim-state-machine.js` gives clean state/transition control over an `AnimationMixer`: a **1D blend
space** (e.g. Idle→Walk→Run driven by speed) plus **discrete states** (Jump, a celebration, a one-shot),
with crossfades. It owns action weights + timeScales and calls `mixer.update(dt)`. The pure blend math is
split into `engine/anim-blend.js` (dependency-free) and self-tested (`scripts/verify-anim-fsm.mjs`).

## Two state kinds

```js
import { AnimationStateMachine } from './engine/anim-state-machine.js';
const anim = new AnimationStateMachine(mixer);

// 1D blend space: crossfade the two bracketing anchors by a parameter; each anchor's clip is cadence-
// synced to ground speed via its `stride` (so legs turn over at the right rate at ANY blend → no skate)
anim.blend1d('locomotion', 'speed', [
  { clip: idle, at: 0 },
  { clip: walk, at: 1.9, stride: 1.5 },
  { clip: run,  at: 5.5, stride: 2.6 },
]);
// discrete states (loop:false = one-shot, clamps on the last frame)
anim.clip('jump', jumpClip, { loop: false });

anim.play('locomotion');
// per frame: anim.set('speed', ctrl.speed).update(dt);
// on an event: anim.play('jump', 0.1);   // 0.1 s crossfade
```

Weights are always a **partition of unity** with only the two neighbouring clips active (verified), so the
character reads as walking, running, or a clean blend between them — never a muddy average of all three.

## It's built into the CharacterController

Pass a `walkClip` (with `idleClip`/`runClip`) and the controller drives an Idle→Walk→Run blend by its own
speed automatically — no wiring:

```js
new CharacterController(model, { mixer, runClip, idleClip, walkClip, legs,
  stride: 2.6, walkStride: 1.5, walkSpeed: 1.9, runSpeed: 5.5, forwardLocal: new THREE.Vector3(0,0,-1) });
```

Without a `walkClip` it falls back to a binary run/idle crossfade. Measured on the Soldier rig (which ships
Idle/Walk/Run): speed 0 → idle `[1,0,0]`; 1.8 m/s → walk `[0.05,0.95,0]` (walk clip cadence ×1.24);
6 m/s → run `[0,0,1]` (run ×1.62). Foot-lock (reference/21) still runs, so no skate at any blend.

## Notes
- Drive the blend by the SAME `speed` you move at, and give each anchor a `stride` so cadence tracks
  ground speed — otherwise a fast blend of slow-cadence clips over-strides (foot-lock hides it, but tune it).
- For actions layered ON TOP of locomotion (a wave while running), use an **additive** clip on a separate
  track rather than a state transition. This FSM is for whole-body state changes.
- `anim.play(name, fade)` is a no-op if already in `name`; `anim.state` is the current state's name.
- Reach it via `ctrl.anim` to add game-specific states (e.g. a goal celebration) on top of locomotion.
