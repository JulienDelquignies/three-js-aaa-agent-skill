# Swapping in a real character — retarget, quantized GLBs, layered clothing

The player can be ANY Mixamo-rigged GLB (here: an uploaded character replacing the three.js
Soldier), with the Soldier kept aboard as CLIP DONOR — its idle/walk/run keep driving the game.
Three engine modules make that native: `rig-retarget.js` (cross-rig animation transport +
`dequantizeSkinned`), `outfit.js` (layered clothing skinned onto the rig), and the existing
`animkit-builder` grown an `{ additive: false }` option so gestures survive the trip.

## Cross-rig retarget (`retargetClip`) — the world-delta transport

Copying local quaternions across rigs fails TWICE (probed live: the target crumples into a ball):
the hips parent frames differ (classic Mixamo armature: −90° X, centimetres) and every bone's bind
orientation is its own. The correct transport, for each bone, root-relative:

    srcWorld(t) = D(t) · srcBindWorld   ⇒   dstWorld(t) = D(t) · dstBindWorld

then locals are peeled off top-down (`local = parentWorld⁻¹ · world`). Verified by TWO harness
invariants (verify-retarget.mjs): IDENTITY (clip onto a renamed clone = same world motion, <0.01°)
and CROSS (a rig with the same bind posture but flat metre-scale frames = same world motion).

Rules that came out of shipping it:
- **Position tracks are dropped except the hips** — they carry the SOURCE body's proportions
  (checkRetarget names the sabotage). The hips track is basis-transformed into destination-local
  units (a cm-rig value near 100 landing on a metre rig is the named "échelle ratée" failure).
- **Bind-to-bind assumes the same posture AND the same facing.** Mixamo characters face +Z, the
  Soldier faces −Z: wrap the new model in a Group and yaw the INNER scene by π. Root-relative,
  both binds now agree; the controller keeps `forwardLocal −Z`, animkit root motion keeps its
  `−Z = forward` convention — nothing else changes.
- The src bind comes from the donor's `TPose` clip (`srcBindClip`) — the live model may be
  mid-idle when you bake.
- **Gestures**: compile animkit moves ABSOLUTE on the donor (`toClip(spec, donor, { additive:
  false })`), retarget, THEN `makeClipAdditive` — an additive delta clip cannot be transported
  (deltas are not orientations). NPC/extras still on the donor rig use the direct build.

## Quantized GLBs (`dequantizeSkinned`)

glTF-Transform exports (KHR_mesh_quantization) store position/normal/uv/skinWeight as NORMALIZED
int16/uint16. The WebGPU renderer's skinning path reads some of these raw — skinWeight ×65535 ⇒
vertices explode into sails across the screen (the harness guards this numerically: every CPU-
skinned vertex ≤ 2 m from the hips mid-run). Fix at load: de-normalize those attributes to plain
float32 — **but `skinIndex` stays an integer attribute** (converting it breaks the GPU read the
other way; both sabotages are in verify-retarget). Same helper forces alpha-0 materials visible
(this export ships hair with `baseColorFactor` alpha 0).

## Layered clothing (`outfit.js`) — the long coat

`buildLongCoat(model)` generates a manteau long AROUND the rig it is handed — every measurement
(shoulder width, hip/knee/ankle heights, wrist reach) is read from bone world positions at bind:
- meshkit geometry in WORLD space: lofted corps (flared hem → carrure ring at real shoulder
  height → closed over the shoulders), collar band, sleeve tubes along each arm. Per-part meshkit
  gate (closed manifold, positive volume — inside-out lofts self-flip, extrudePoly-style).
- skinning by PROXIMITY to bone capsules: torso → two nearest spine links; sleeves →
  shoulder/arm/forearm; skirt → hips grip fading to the hem, and ADAPTIVE: fabric within ~14 cm
  of a leg follows that leg (else the knee pokes through the hem at full stride — caught on the
  first run screenshot).
- the mesh binds to a FRESH `THREE.Skeleton` over the same bones (inverses computed at today's
  world pose), identity bindMatrix, `bindMode 'attached'` — the skinned result is pure world-space
  bone motion, so the coat lives INSIDE the model wrapper and every visibility toggle (hide the
  player while driving) carries it.
- `checkOutfit` is the double gate: weights normalized onto real bones, hem BELOW the knee
  (« vêtements longs », literally contract-tested), sleeves to the wrists + screenshots.

## Play-mode caveats (learned the hard way)

- **Adding/removing SkinnedMeshes live** (play_eval) corrupts the fallback renderer's skinning of
  OTHER models — triangle-soup explosions that look like data bugs. The shipped load path (built
  before first render) is unaffected. After such experiments: reload the page, and judge skinning
  by the CPU ground truth (`mesh.getVertexPosition` + `skeleton.update()`), not the frame.
- **Free camera**: pass `camera` with `frames: 0` — advance the sim in a separate call first.
  With frames > 0 the third-person camera fights the free pose.
