# The staged sculpt workflow — blockout → form → lookdev, gated

Adopted from the excellent `vinhhien112/Three.js-Object-Sculptor-Codex-Plugin` (MIT, 1.1k ⭐) —
their insight is DISCIPLINE, not ops: our meshkit already speaks the same vocabulary (lathe, sweep,
loft, extrusion, displace), but a complex organic object needs STAGED passes with an acceptance gate
at each one. Where their gate is AI vision only, ours is DOUBLE: `checkMesh` proves the geometry
(closed, outward, sane) AND the play-mode screenshot judges the look — the contract catches what the
eye misses (11 inside-out studs at once), the eye catches what the contract can't (studs trailing
past the sole).

## The passes

1. **BLOCKOUT** — primitive masses only (no smoothing, no detail): the silhouette must read as the
   object from a three-quarter view. GATE: if the silhouette is wrong, STOP and fix proportions —
   detail never rescues a bad blockout. (The demo boot's first blockout read as a shark fin: heel
   too tall, mass too short. One proportion pass fixed it before any stud existed.)
2. **FORM** — the validated blockout sections get densified and smoothed (Loop on the same loft
   sections), hard parts stay hard (the sole keeps its bevel). GATE: contract (every part closed,
   positive volume) + screenshot.
3. **LOOKDEV** — materials, small parts (laces = thin sweeps, studs = little lathes, accent bands),
   PBR values. GATE: contract on every added part + screenshot from the presentation angle.
   (The boot's stud row extended past the sole footprint — pure lookdev-gate catch.)

## Practical rules (learned shipping the boot)

- Work LIVE through the play-mode (`window.__meshkit` + `play_eval` + `play_screenshot`): one
  iteration ≈ seconds, and every part goes through `checkMesh` before it is added to the scene.
- Lathe profiles ascend bottom→top — a downward profile makes an inside-out solid (the contract
  names it: "non-positive volume").
- Reuse the blockout's data in the form pass (same section arrays, more segments + smooth) — the
  gate you passed stays passed.
- Keepers graduate: freeze the final part list as a `runSpec` spec → `meshkit-export.mjs` demo
  (`--demo crampon`) → standard GLB, loadable in Blender/Unity/anything.

## Where they are ahead of us (backlog)

Reference-image-driven reconstruction: their pipeline STARTS from a photo and scores renders against
it. Ours starts from memory/description. Adopting that means: reference image in the repo →
side-by-side compare at each gate (the play-mode screenshot next to the reference) — the mechanics
already exist; the missing piece is only the habit of pinning a reference first. Their module
caching (hash-validated reusable parts) maps to our demo-spec library growing per object.
