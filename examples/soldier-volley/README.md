# Example — Soldier Volley (two real rigged characters + validation)

A runnable example that composes much of the `threejs-aaa` skill into one animated scene, using **two
real rigged Mixamo characters** (the second cloned with `SkeletonUtils`): a **dribbler** carries the ball
down the wing and **crosses**, a **striker** runs onto it and **volleys** into the net. Each player
**faces where it runs** (no moonwalk) and the shots go toward their targets — asserted by validation.

It exists to prove the skill's pieces work together on real characters, not just synthetic data.

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
- **Correctness validation** (`reference/20`/`22`) — `window.__volleyReport` asserts:
  - `players_face_travel_not_moonwalk` — each player's forward · velocity > 0 (the Mixamo Soldier faces
    −Z, so a naive facing moonwalks; this catches it),
  - `cross_goes_toward_striker` and `volley_goes_toward_goal` — the shots fire the right way (not "à
    l'envers"),
  - `ball_no_pops` — the ball trajectory is continuous (no teleport between frames).

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
