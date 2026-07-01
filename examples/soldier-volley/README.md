# Example — Soldier Volley (real rigged character + validation)

A runnable example that composes much of the `threejs-aaa` skill into one animated scene, using a
**real rigged Mixamo character**: a footballer runs in, a **procedural right-leg kick** strikes the
ball, and it arcs into the goal net — with **temporal correctness validation** on the real bones.

It exists to prove the skill's pieces work together on a real character, not just synthetic data.

## What it demonstrates

- **Real Mixamo rig** — `Soldier.glb` (a Mixamo-rigged humanoid: bones `mixamorig…`), loaded with
  `GLTFLoader`, normalized, grounded, and animated with its **Run** clip via `AnimationMixer`.
- **Locomotion without foot-skate** (`reference/21`) — `matchCadence()` drives the clip's phase from
  distance travelled so the legs turn over at ground speed (no "sliding on ice"), and `FootLockIK`
  pins whichever foot is planted (this Run was authored for root-motion, so its feet barely push and
  cadence alone still smears). Measured: planted-foot slip **0.15 → 0 m/frame**.
- **Ball possession → release** — the ball rolls ahead as a dribble and the striker chases it; it is
  at the foot only at contact, then it's struck (not glued to the boot).
- **Broadcast camera** — a follow rig dollies alongside the run, then eases continuously into a
  goal-watching wide as the ball is struck (no cut at contact).
- **Procedural animation layered on a clip** — a right-leg kick (`procedural.js` style leg override)
  blended on top of the Mixamo Run pose at contact (`reference/14`).
- **Deterministic cinematic** — `setTime(t, camera)` drives the run-up → plant → volley → net-ripple
  and a keyframed broadcast camera, seekable frame-by-frame for capture (`reference/16`).
- **Zero-cost / zero paid API** — procedural pitch + goal + ball, HDRI sky from CC0 (drop one into
  `public/env/`), Soldier.glb from the three.js examples. Nothing billable (`reference/13`).
- **Temporal correctness** (`reference/20`) — samples the real foot bone and the ball across the
  run-up and asserts:
  - `locomotion_no_slide` — the planted (lower) foot's per-frame world slip falls from **0.15 m/frame**
    (old fixed clip rate) to **0 m/frame** with `matchCadence` + `FootLockIK`, i.e. at or below the
    ground's per-frame travel: the foot grips the pitch instead of skating,
  - `noPops` — the ball trajectory is continuous (no teleport between frames).
  The report is logged and exposed on `window.__volleyReport`.

## Run

```bash
npm install
npm run dev        # open the printed localhost URL
# or: npm run build && open the visual-QA loop from the skill (scripts/capture.mjs)
```

Open the console to see the temporal validation summary, or read `window.__volleyReport`.

## Notes

- Rendered headless it falls back to software WebGL (append `?webgl`); on a real GPU it's sharper
  with the full post stack.
- `Soldier.glb` is from the [three.js examples](https://github.com/mrdoob/three.js) (a Mixamo
  character) and is included here for demonstration only. For your own game, export your character
  from Mixamo and run it through `scripts/convert-character.mjs` — the pipeline (bone names
  `mixamorig*`, `SkeletonUtils`, `AnimationMixer`, foot sampling) is identical.
- The kick is procedural because the base Mixamo clips here are Idle/Walk/Run only; swap in a real
  kick/volley clip if you have one and blend it the same way.
