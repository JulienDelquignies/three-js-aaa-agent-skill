# Animkit — moves for the Mixamo rig as data (the meshkit of movement)

"Can you author animations the way meshkit authors models?" Yes, same recipe: a move is DATA (named
poses in degrees per bone on a timeline), a CONTRACT proves it anatomically sane, the play-mode
screenshot judges the gesture, and the keepers ship as a library. `engine/animkit.js` is dep-free
(inline quaternion math → node-tested); `animkit-builder.js` compiles against a real rig.

## Authoring model

`spec = { name, duration, loop?, keys: [{ t, pose: { RightArm: [x°,y°,z°], … } }] }` — poses are
ABSOLUTE local rotations (XYZ order). All-zero = the Mixamo T-POSE, so `BASE_POSE` (arms lowered) is
merged under every key: author only what moves. `resolveTracks(spec)` → per-bone quaternion keys;
the builder emits `QuaternionKeyframeTrack`s with bone names resolved by SUFFIX against the actual
rig (GLB exports rename — `mixamorigLeftArm`, `LeftArm`, `mixamorig:LeftArm` all match).

## The contract (`checkClip`)

Known Mixamo bones only (a typo'd bone is silence, not an error, without this), strictly sorted keys
in [0, duration], normalized quaternions, **bounded angular velocity** (a limb that "teleports"
> 14 rad/s between keys is the classic broken-generated-anim tell), **loop-seam continuity** (a
looping move must land where it starts — reference/20's pop, caught at data level), and hinge range
where the axis is unambiguous on this rig (knees flex +x ∈ [−8°, 150°], hips x ∈ [−130°, 40°]).
Sabotages: unknown bone, unsorted keys, 180° in 30 ms, broken seam, backwards knee.

## THE hard-won axis map (Soldier.glb / Mixamo)

Discovered live through the play-mode (probe the actual bone rotations, don't trust intuition):

- **Upper arms are NOT mirrored** on this rig: idle holds BOTH arms at local z ≈ **+60°**.
- Arm z: **0 = T-pose** (horizontal), **+60 = lowered**, **−70 = raised to the sky**,
  **+160 = crossed in front of the chest** (adduction past vertical). The first celebration went to
  +160 on both sides and hugged itself; the second raised one arm only (the −100° delta from a
  wrongly-mirrored base landed at −37°). Author raised arms NEGATIVE, both sides.
- Knees flex +x, hips −x (consistent with the seated-teammates code).

## Additive playback (`playGesture`)

Gestures must play OVER locomotion. Two normal-blend actions on the same bones **average 50/50**
(the first live screenshot showed a half-raised celebration) — so `toClip` converts every clip with
`AnimationUtils.makeClipAdditive` (deltas vs frame 0 = BASE) and `playGesture` sets
`AdditiveAnimationBlendMode`, LoopOnce with fade-in/out (self-removing 'finished' listener) or
LoopRepeat for waves/applause. The legs keep walking; the gesture rides on top and settles back to
idle (headless proof: Δ 2.27 rad at peak, Δ 0.02 rad after the fade).

## Library + game wiring

`MOVES`: **frappe** (football kick — plant, load, swing-through, arm counter), **passe** (side-foot),
**celebration** (both arms to the sky), **salut** (wave, loop), **poignee** (handshake, two pumps),
**applaudir** (clap, loop). In Carrière: the agent meeting's final 🤝 line plays `poignee` on BOTH
the player and the NPC (each has a mixer — same clip, both rigs), and a new lap record at the circuit
plays `celebration` when you step out of the car. Pattern for a new move: author the spec →
`checkClip` in the harness → screenshot the PEAK pose live (freeze mid-clip) → adjust degrees →
wire with `this._gesture('name')`.

## Root motion (v2): dives, jumps, bicycle kicks

Acrobatic moves need the PELVIS to travel. Keys accept `hips: [right, up, forward]` in CHARACTER
metres; contract additions: dy ∈ [−0.85, 1.1] (a standing hip ≈ 0.95 m, a lying hip ≈ 0.2 m — no
floor clipping, no rocket jump), linear speed ≤ 6.5 m/s, looping moves bring the pelvis home.

The axis trap, one level deeper than the arms: probed live, the Mixamo armature node comes ROTATED
(−90° X) and in centimetres — the hips bone's parent world basis had **scaleY = 0** (bone-local Y
points HORIZONTAL in the world). Authored deltas must therefore be transformed
character-space → world (model root basis, forward = −Z) → hips-parent local (INVERSE parent basis,
which absorbs both the rotation and the cm scale) before keying. The first dive "played" with the
pelvis frozen at 0.98 m — rotations made it LOOK airborne while the root never moved; the numeric
probe (hips world-Y over time), not the screenshot, is what caught it.

New library moves: **talonnade** (backheel flick), **amorti** (chest control, arch + soft knees),
**plongeon** (goalkeeper dive: crouch → lateral flight → laid out on the ground → spring up; hips
world-Y measured 0.96 → 1.06 → 0.30 → 0.97), **retournee** (bicycle kick: launch, lay back mid-air,
right leg scissors overhead). All under checkClip; sabotages: pelvis through the floor, rocket jump,
hips teleport.
