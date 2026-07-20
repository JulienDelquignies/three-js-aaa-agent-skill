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

## The wardrobe — outfits as styles

`outfit.js` grew into a wardrobe: `buildLongCoat` (manteau long, contract: hem BELOW the knee) and
`buildJeansSweat` (casual: sweat + capuche baissée + jean droit, contract: a sweat ENDS at the hips
— the "sweat-robe" sabotage — and a jean REACHES the ankles). Same machinery, garment-true
contracts (`checkOutfit` / `checkCasual` over shared `skinIssues`). Scene selection is a URL param
(`?tenue=casual|manteau`, casual default) — outfits are DATA, adding one is a builder + a contract.
**Tailoring, not guessing** (the bonhomme-Michelin lesson): garment rings are FITTED to the body —
`bodyCloud` samples the character's skinned vertices at bind (force `skeleton.update()`, no render
has happened yet), and `fitRing` takes, per angular sector, the body's max radial extent in a slab
around the station + a clearance (1–3 cm). Guessed radii inflate the character; measured radii give
clothes. The fit rules that took screenshots to learn:
- clearance must exceed the DEFORMATION MISMATCH, not just the cloth thickness — the body deforms
  with its authored weights, the garment with proximity weights; where flexion is extreme (hip
  crease at full stride) no reasonable clearance suffices and the fix is WEIGHTS: give the hem and
  yoke a share of the nearest thigh so the fabric sweeps with the leg.
- exclude foreign skin from a ring's slab: arms out of torso rings (beyond ~12 cm from the shoulder
  joint), the OTHER leg out of a jean leg's rings (thighs almost touch at the crotch).
- fitted vertical rings share ring()'s basis/phase so fitted and analytic sections can mix in one
  loft without twisting; bones-only rigs (test harnesses) fall back to analytic radii.
- leave under-layers visible at the seams on purpose (the shirt's white cuffs past the sweat
  sleeves read as real layering).

**Fabric, not flat colour** (`fabric.js`): cloth materials are PROCEDURAL in the shader (TSL) —
zero texture files. The pattern is computed from `attribute('position')` (bind space, pre-skinning)
so it is glued to the cloth instead of swimming through it; kinds: denim (wash + twill hint),
heather knit, wool nap. Two probe-won rules:
- modulate the tint MULTIPLICATIVELY (`color(tint).mul(1 + noise)`) — mixing between
  lerped-to-white/black endpoints happens in linear space, where +0.07 on a dark channel doubles
  it and the jean turns powder (proved with a two-spheres A/B render).
- keep frequencies LOW: procedural patterns have no mips — high-frequency sin/noise renders as
  chainmail moiré (first close-up).
Also matte the CHARACTER's own materials: Mixamo "Glossiness"-converted metal/rough maps render as
shiny plastic — strip them (metalness 0, roughness ~0.88, keep the normal map).

**Construction detail is what reads as AAA** — smooth tubes with noise still look like tubes. The
casual outfit grew from 7 to 11 pieces: ribbed waistband + cuffs (a tight ring under a wider one),
a rolled-collar hood (a tube swept on a short arc TUCKED behind the neck — a squashed sphere read
as a backpack, and an arc reaching the shoulders spiked over them), drawstrings, a kangaroo pocket
and two back pockets (thin `extrudePoly` slabs `orient()`ed onto the body surface), and a knee-
crease pinch. SEG went 14→24 for a smooth silhouette. Lessons: keep the armhole overlap SMALL
(a deep sleeve-cap overlap balloons into a shoulder pad); draw hem/waistband edges as clean
ellipses from the fitted MEAN (a per-sector fitted hem comes out scalloped).

**Shader seams are a trap without a debug pass.** The denim seam material (`denimSeamMaterial`)
localises angle around the leg with `cos(vertexAngle − seamAngle)` dot-math (no `atan` wrap). Two
bugs cost a rebuild each: TSL's `x.smoothstep(a,b)` maps to `smoothstep(x,a,b)` (x becomes edge0),
painting the whole leg gold — use explicit `clamp` math instead; and a topstitch `mix()` toward a
bright thread colour is fragile (any mask leak floods the garment). The robust win was
MULTIPLICATIVE-only seam shading: a dark crease valley flanked by a light felled-ridge — a shadow
can never wash the base colour out. Debugging: output the raw mask as grayscale (`vec3(mask)`) on
ONE piece and read it in play-mode — the gradient told us the angle math was right and the mix was
the culprit, which no amount of static reasoning had settled.

**Hide the layers the outfit replaces.** A persistent "blob" on one shoulder survived every hood
and sleeve tweak. Guessing wasted three rebuilds; RAYCASTING through the defect pixel
(`Raycaster.setFromCamera(ndc)` against the skinned meshes) named it in one shot: `Ch38_Shirt` —
the character's own football jersey, poking through the armhole. The outfit REPLACES the strip, so
hide the meshes it covers (`/Shirt|Shorts|Socks/` → `visible = false`). Two consequences fell out:
the blob vanished, and the earlier "sleeve cap ball" that had forced a shallow armhole overlap was
*also* the jersey — with it hidden, the sleeve can overlap the shoulder DEEPLY (closing the armhole
gap between the two separately-lofted tubes) with no bulge. Lesson: when a layered garment shows a
lump or a seam gap, first raycast to check it isn't the under-layer, before reshaping the garment.

## Play-mode caveats (learned the hard way)

- **Adding/removing SkinnedMeshes live** (play_eval) corrupts the fallback renderer's skinning of
  OTHER models — triangle-soup explosions that look like data bugs. The shipped load path (built
  before first render) is unaffected. After such experiments: reload the page, and judge skinning
  by the CPU ground truth (`mesh.getVertexPosition` + `skeleton.update()`), not the frame.
- **Free camera**: pass `camera` with `frames: 0` — advance the sim in a separate call first.
  With frames > 0 the third-person camera fights the free pose.
