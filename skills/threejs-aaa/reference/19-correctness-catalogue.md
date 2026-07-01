# The Correctness Catalogue & How to Reach Exhaustiveness

`18-scene-correctness.md` covers the core checks and the workflow. This file answers the harder
question: **how do you make the rule list as exhaustive as possible?** You don't brainstorm rules —
you **generate** them from a small set of orthogonal axes, so completeness is *checkable*, not
guessed. Below: the generator, the full rule catalogue derived from it (with what's implemented in
`scene-validate.js` vs extensible), the severity/review-pass model, and how to add rules.

Grounded in the two canonical academic bug taxonomies — Lewis, Whitehead & Wardrip-Fruin, *"What
Went Wrong: A Taxonomy of Video Game Bugs"* (FDG 2010; temporal vs non-temporal, Invalid Position,
out-of-bounds) and *"Deriving and Evaluating a Detailed Taxonomy of Game Bugs"* (arXiv 2311.16645;
63 categories / 8 tiers) — plus standard studio environment-art/level-design review passes.

Table of contents
- [The exhaustiveness generator](#the-exhaustiveness-generator)
- [Axis 1 — relationship types](#axis-1--relationship-types)
- [Axis 2 — failure modes](#axis-2--failure-modes)
- [Axis 3 — per-archetype constraints](#axis-3--per-archetype-constraints)
- [The catalogue (by relationship)](#the-catalogue-by-relationship)
- [Implemented vs extensible](#implemented-vs-extensible)
- [Severity & review passes](#severity--review-passes)
- [Shared primitives & auto-fix ordering](#shared-primitives--auto-fix-ordering)
- [How to add a rule](#how-to-add-a-rule)

## The exhaustiveness generator

> **RULE = (relationship type) × (failure mode) × (per-archetype constraint)**

Enumerate the three finite axes once. Every correctness rule is a cell in their Cartesian product.
Sweep every relationship × every failure mode, instantiate with the archetype's numbers, and:
- a cell you can fill = a rule to implement,
- a cell that's genuinely impossible = fine,
- a cell you *skipped* = a **gap in your rule set** — that's how you find what's missing.

Almost everything a static validator checks is **non-temporal** (detectable in a single frozen
frame). The **temporal** branch (drift over time, foot-skate, pops, loop seams, interaction sync) is
checked by sampling the non-temporal predicate across animation frames — see `05`, `14`, `15`.

## Axis 1 — relationship types

The finite set of spatial/semantic relations between one or more entities:

1. **Self** — an object's own dimensions/proportions/transform sanity.
2. **Support / contact** — A rests on / is held by / attached to B (gravity).
3. **Containment** — A inside B (object in room, contents in vessel, within world bounds).
4. **Adjacency / seam** — A meets B edge-to-edge (tiles, modular kit, wall panels, floors).
5. **Connection / continuity** — A's endpoint = B's endpoint (roads, pipes, rails, wires, fences).
6. **Clearance / negative space** — the empty volume between A and B (corridors, headroom, doorways).
7. **Relative scale** — A's size vs B's size (chair vs table vs human).
8. **Orientation / alignment** — A's axis vs a reference (up/gravity, facing, insertion axis).
9. **Global field consistency** — everything shares one convention (units, up, light direction, scale).
10. **Reachability / topology** — graph connectivity of walkable space.

## Axis 2 — failure modes

The finite verbs of "what's wrong" (the studio art-bug taxonomy, stable across every real checklist):

`floating` · `sinking/clipping/interpenetration` · `gap/seam/crack/hole` · `disconnection` ·
`z-fighting` · `scale error` · `orientation error` · `blocked/unreachable` · `out of bounds` ·
`missing/placeholder` · `inconsistent field (unit/light/scale drift)` · `LOD/pop/culling` (dynamic).

## Axis 3 — per-archetype constraints

Each object type carries numbers: plausible bounding-box range, canonical up-axis, expected support
surface, and relative-scale ratios to related types. These live in `SIZE_TABLE` (`scene-validate.js`)
and drive `withinScale`. Anchor everything to the **human (~1.7–1.9 m)**; derive door/ceiling/chair/
table from human ratios. Extend the table as new archetypes appear — each new row is one more axis-3
constraint feeding the generator.

## The catalogue (by relationship)

Compact enumeration of the rule families produced by the generator (from architecture, props/physics,
character, and scale/QA passes). `✓` = a predicate exists in `scene-validate.js`; `○` = documented,
extend as needed. Each is: *id — correct meaning — geometric check*.

### R1 Self
- ✓ `withinScale` — dimensions within the archetype envelope — AABB size vs `SIZE_TABLE`.
- ○ `transform_sane` — uniform positive finite scale, no NaN/mirror — decompose `matrixWorld`; `det>0`.
- ○ `upright` (✓ predicate) — local +Y ≈ world up for standing objects — `dot(up, worldUp)`.
- ○ `not_inverted` — not upside-down — `dot(up, worldUp) > 0`.
- ○ `normals_outward` / `not_degenerate` — valid winding, no zero-area faces, no NaN verts.
- ○ `pivot_sane` — pivot at base for props / hinge for doors.

### R2 Support / contact
- ✓ `supported` — rests on ground/support else floating — down-AABB gap / raycast.
- ✓ `restsOn` + not-sunk — underside on surface top, within footprint, not penetrating.
- ✓ `stableOnBase` — centre of mass over the support footprint (topple) — point-in-polygon.
- ✓ `heldInHand` — grip at hand socket + object clear of body.
- ✓ `attachment` — object at an attach point + not through a body (ball at foot).
- ○ `legs_all_contact` — every designed foot touches (no tilt from one hovering leg).
- ○ `stack_contact/aligned` — stacked items touch + COM over the one below.
- ○ `wall_flush` (✓ `flushAgainst`) + `hangs_downward` + `anchor_on_surface` — wall/ceiling mounts.
- ○ `foundation_on_ground` — building base conforms to terrain (no floating corner / half-buried).
- ○ `foot_planted` / `foot_ik_normal` (chars) — feet on terrain, sole aligned to ground normal (`05`,`14`).

### R3 Containment
- ✓ `containedWithin` — object AABB inside container/room bounds.
- ✓ `insideOpening` — door/window coplanar, aligned, and contained in a wall aperture.
- ○ `contents_contained/not_overfilled/liquid_surface` — vessel contents inside & below rim, liquid level horizontal.
- ○ `within_world_bounds` / `above_floor` — inside the play volume; not fallen below the floor.
- ○ `insert_depth/aligned` — key/plug/drawer inserted to correct depth along the socket axis.
- ○ `room_watertight` (leak test) — flood-fill/ray-fan from interior escapes only through real openings.

### R4 Adjacency / seam
- ○ `coplanar_seam` / `seam_gap` / `floor_step` — adjacent panels flush & touching, equal height.
- ○ `no_overlap_double_wall` / `no_zfight` (see R-global) — one surface per location.
- ○ `t_junction` — no vertex mid-edge of another face without a shared vertex.
- ○ `hole_in_shell` — surface set is 2-manifold/closed (edge used by exactly 2 faces).
- ○ `snap_to_grid` (pos/rot) — kit pieces on the modular grid & angular step.
- ○ `texel_density` / `trim_continuity` — matching UV scale & continuous baseboards/crown/pipes.

### R5 Connection / continuity
- ✓ `connected` — segment endpoints coincide (roads/pipes/rails/wires/fences).
- ○ `tangent_continuity` — directions align at joints (no kink), gauge/width matches.
- ○ `run_continuity` — fence/wall runs unbroken, shared baseline height.
- ○ `terrain_seam_match` — neighbor tiles share edge heights/normals (no cliff/crack; skirts for LOD).
- ○ `no_floating_islands` — every chunk connects to the landmass or has support beneath.

### R6 Clearance / negative space
- ✓ `clearance` — min gap between two objects (spacing / headroom / path width).
- ○ `path_width` — corridor ≥ player width + margin (medial-axis clearance).
- ○ `headroom` — walkable clearance ≥ player height (up-ray).
- ○ `doorway_passable` — clear opening ≥ ~0.8×2.0 m, swing arc unobstructed.
- ○ `swing_clearance` — door doesn't clip frame/wall through its arc (SAT sweep).
- ○ `no_blocking_prop` — critical lanes clear of collidable clutter (capsule sweep).

### R7 Relative scale
- ○ `relative_scale` — related pairs keep ratios (table/seat, door/human, human/ceiling, held/hand).
- ○ `scale_drift_cluster` — no spatial cluster off the scene-median scale regime.

### R8 Orientation / alignment
- ✓ `facing` — A's heading points at B (horizontal) — chair→desk, structure→pitch (the goal bug).
- ✓ `orientationMatch` — two orientations agree (sit = chair, picture ∥ wall).
- ○ `up_consistent` — canonical-up objects aligned to global up (catch Z-up imports).
- ○ `grip_orientation` / `tool_direction` — held object oriented naturally, muzzle/blade away from self.
- ○ `wall_orientation` — mounted item's back normal anti-parallel to wall normal.
- ○ `hinge_rotation_valid` — door differs from closed only by rotation about its hinge axis.
- ○ `look_at` — head/eyes toward the POI within neck ROM (chars).

### R9 Global field consistency
- ○ `unit_consistency` — one unit system (detect 100×/2.54×/… clusters).
- ○ `gravity_axis_consistent` — one world-down; all support checks use it.
- ○ `lighting_direction` — one dominant sun; contact shadows agree with support.
- ○ `no_coincident_dupes` — no duplicate mesh at the same transform.
- ○ `missing_placeholder` — no default-material/grey-box/magenta-texture assets in a final scene.

### R10 Reachability / topology
- ○ `reachable` — required locations connected to spawn within jump/step limits (nav graph).
- ○ `no_softlock` — no dead-end region with only inbound edges.
- ○ `navmesh_coverage` — walkable floor covered; no holes/impassable seams.
- ○ `fall_through_prevention` — solid collider under every standing point.

### Character & animation (relationship-typed subset — see `05`,`14`,`15`)
Ground contact (R2), sitting (R2+R8, ✓ `sitPose`), reach/grab (R6+R8, ✓ interaction checks), object/
weapon in hand (R2+R8, ✓ `heldInHand`), carrying/leaning (R2), self-intersection & joint ROM (R1/R2),
two-character meet/face/spacing (R6+R8), mounts (seat/wheel/pedals — R2+R8), climbing holds (R2+R6),
plus **temporal** (sample per frame): contact continuity, no-pop, foot-plant phase, loop seam,
interaction sync.

## Implemented vs extensible

`scene-validate.js` ships tested predicates across every relationship type, all proven by
`verify-scene.mjs --selftest`:
- **Self/scale (R1/R7):** `withinScale`, `upright`, `relativeScale`, `unitSanity`
- **Support (R2):** `supported`, `restsOn`, `stableOnBase`, `heldInHand`, `attachment`, `flushAgainst`
- **Containment (R3):** `containedWithin`, `insideOpening`
- **Adjacency/continuity (R4/R5):** `connected`, `tangentContinuity`, `runContinuity`, `seamHeightsMatch`
- **Clearance/nav (R6/R10):** `clearance`, `headroom`, `doorwayPassable`, `stepsTraversable`, `reachable`
- **Orientation (R8):** `facing`, `orientationMatch`
- **Non-penetration/global (R2/R9):** `noPenetration` (OBB SAT), `noCoincidentDupe`
- **Composite:** `sitPose`, `validateScene` (runs a declared constraint list, returns fixes)

Everything still marked `○` above is a documented cell of the generator you implement when a scene
needs it; the module grows one tested predicate at a time.

## Severity & review passes

Attach a severity to every finding so fixes are prioritized (studio A/B/C):
- **A / Critical** — breaks the world: fall-through hole, unreachable objective, soft-lock, out-of-bounds.
- **B / High** — clearly wrong but playable: floating building, scale error, disconnected road, backwards goal.
- **C / Low** — cosmetic: minor z-fight, small seam, slight overhang.

Run the checks as **passes**, each owning a slice of the failure-mode column (mirrors real level-design
review): blockout/**metrics** → **collision** → **navigation/reachability** → **lighting** →
**art/placement polish** → final sweep. In the autonomous loop (`17`), placement passes run **before**
the visual-QA render.

## Shared primitives & auto-fix ordering

Most rules reduce to five primitives — build once, reuse everywhere: **point-to-plane distance**,
**normal dot product**, **AABB/OBB SAT overlap (with MTV/penetration depth)**, **downward raycast
support probe**, and **2D XZ footprint ops (containment/overlap/coverage)**. Two probes cover ~40%:
the **down-ray grounded/penetration probe** (support, foundation, headroom) and the **flood-fill/ray-fan
leak test** (watertight room, out-of-bounds, light leak). Use `three-mesh-bvh` for fast ray/surface
queries (`08`).

Apply auto-fixes in an order that converges (avoids oscillation): **orientation → insertion/attachment
→ drop-to-support → footprint/COM slide → separate interpenetration → re-verify support**. Fix
orientation before dropping; re-run support after any horizontal move. Read world transforms with
`updateWorldMatrix()` first; derive OBBs from `Box3.setFromObject` + `getWorldQuaternion` (don't read
`object.scale` — it ignores parent transforms).

## How to add a rule

1. Locate the empty cell: pick a **relationship type** and a **failure mode** not yet covered for an
   archetype that appears in your scenes.
2. Write a predicate in `scene-validate.js` returning `{ name, ok, value, tolerance, detail, fix? }`,
   built from the shared primitives.
3. Add a `validateScene` switch case and a `verify-scene.mjs --selftest` assertion (a passing case + a
   failing case) — prove it before relying on it.
4. Give it a severity and slot it into the right review pass.

That process, applied cell by cell across the generator, is how the list becomes exhaustive — and
stays checkable rather than a guess.
