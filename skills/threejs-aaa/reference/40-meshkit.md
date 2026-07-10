# Meshkit — Blender's operations as data (AI models beyond boxes)

"Why is everything a box?" Because boxes are what you get when you stop at primitives. Blender's
answer is operators (spin, screw, extrude-along-curve, skin, displace); an agent's Blender is the
same operators as **pure functions over data**, composed in code, proved by a contract, judged on a
screenshot. `engine/meshkit.js` is dep-free (typed arrays in, typed arrays out → node-tested by
`scripts/verify-meshkit.mjs`); only `meshkit-builder.js` touches three.js.

## The operators

- `lathe(profile, {segments, caps})` — surface of revolution around Y. `profile` = `[[r, y], …]`
  bottom→top; `r ≈ 0` endpoints become poles. Vases, bottles, cups, lamp feet, pedestals, wheels.
- `sweep(shape, path, {caps, scaleFn})` — a closed 2D section extruded along a 3D polyline with
  **parallel-transport frames** (no twist; Rodrigues rotation between tangents). Pipes, rails,
  trophy handles, curved furniture. `scaleFn(t)` tapers (horns, branches).
- `loft(sections)` — skin ring sections of equal point count (hulls, fuselages, transitions).
- `sphere(r)` + `displace(mesh, fn)` — offset along normals with a SEEDED field → rocks, dunes;
  never `Math.random()` (determinism is a contract everywhere in this skill).
- `transform / mirrorX / merge` — assembly. `mirrorX` flips triangle winding (else the mirror is
  inside-out — the volume check catches it).
- `computeNormals` — smooth area-weighted normals: the ORGANIC look; flat facets are the box
  aesthetic showing through.

All grid-based ops share one skinning core with a fixed convention: rings CCW around the +tangent,
outward winding, pole fans at closed ends. Get a fan's order wrong and the contract fails with
"non-positive volume".

## The contract (`checkMesh`)

A generated model must be a REAL object, not a triangle soup: finite coordinates, indices in range,
no degenerate triangles, triangle budget, and for solids **closed manifold topology** (every
undirected edge shared by exactly 2 triangles) with **positive signed volume** (outward winding,
computed by the divergence theorem). Open surfaces (lampshades, awnings) opt out with
`closed: false`. Sabotages: injected NaN, out-of-range index, open seam, inside-out winding,
degenerate triangle — all caught by name.

## The QA loop is the play-mode MCP (reference/39)

Contracts prove sanity, not beauty. Shape iteration runs against the LIVE session: build → 
`play_screenshot` at the prop → critique → adjust the profile → repeat in seconds. Shipping example:
the loge trophy read as a golden MUG (bulbous cup, buried handles) on the first screenshot; two
profile edits later it's a slim cup with looping swept handles. And when its hardcoded corner turned
out occupied (the loge bar, then the fridge), the fix was to DERIVE the spot — the clearest x along
the loge's back wall, max-min distance to the loge items — which landed it centred under the club
crest. Rule: coordinates are guesses; derivations are decisions.

## In-game uses (Carrière)

The loge trophy (lathe cup + swept mirrored handles + lathe pedestal, gold `metalness: 1`), the
meeting-table vase (terracotta amphora), beach rocks (seeded displaced spheres, solid colliders).
Pattern for adding one: compose ops → `checkMesh` in the harness library → `buildParts`/`toGeometry`
→ place by derivation → `play_screenshot` to judge.

## v2 — cages, polygons, noise, specs, GLB export

- `extrudePoly(outline, {depth, bevel})` — any simple polygon (CONCAVE included: L-shapes, brackets)
  extruded up with mitred edge bevel; caps ear-clipped and vertex-shared with the walls (manifold).
  Orientation is self-correcting: the outline's 2D handedness vs the ring convention can leave the
  solid inside-out, so the op checks its own signed volume and flips windings if negative — *the
  volume sign is the truth, not the convention* (the harness proves the L's volume EXACTLY:
  0.72 m² × 0.5 m = 0.36 m³).
- `roundedRect(w, d, r)` — the workhorse outline (soft-edged slabs, cushions, table tops).
- `smooth(mesh, passes)` — **Loop subdivision** (closed manifold required — the contract guarantees
  it): model a rough CAGE, smooth it → organic. ×4 tris/pass; volume shrinks toward the cage's
  interior hull (small cages melt — densify the cage for stiffer results).
- `noise(seed)` — seeded 3D value-fBm, the standard displacement field (never `Math.random`).
- `runSpec(spec)` — the `.blend` file as JSON: `{parts: [{name, color, ops: [{op: 'lathe', …}]}]}`
  runs the whole pipeline declaratively (models become DATA, diffable and generatable).
- **`scripts/meshkit-export.mjs`** — spec → standard **.glb** (hand-written glTF 2.0 binary, zero
  deps, `checkMesh` gate before export): meshkit models load in Blender, Unity, PlayCanvas, any
  three.js app. Built-in demos: `--demo vase|trophy|rock`.

## Live modeling (the Blender console)

Carrière exposes `window.__meshkit` (all ops + `buildParts`), so through the play-mode MCP the agent
models INSIDE the running game: one `play_eval` composes cage → smooth → checkMesh → `buildParts` →
`scene.add`, the next `play_screenshot` judges it — sculpt-look-adjust in seconds, then the keeper
shapes graduate into scene code. Position live experiments by DERIVATION too (site data, not guessed
coordinates): the first live lounger spawned inside the hotel room, the second inside a club wall;
the pitch-centre derivation placed the third in the open.

## What about "real" AI-generated meshes?

Three ladders, by cost: (1) meshkit — free, deterministic, contract-checked, THIS; (2) CC0 packs
(Kenney/Quaternius, reference/13) — free, hand-authored quality, no determinism; (3) text-to-3D
APIs (Meshy et al., reference/10) — paid, opt-in only, needs the game-ready cleanup pass. Meshkit is
the default because it keeps models as DATA under the same no-regression discipline as everything
else in this engine.
