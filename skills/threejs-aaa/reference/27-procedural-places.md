# Procedural places — interiors from a spec, doors derived, no regression

You never draw a floor plan. A place is a **spec** — `{ type: 'club'|'home', tier: 1..5, seed }` — and the
generator (`engine/floorplan.js`, dependency-free) turns it into a correct, playable interior. This is how
a game ships *levels of infrastructure* (club tier 1 → tier 5; hotel room → villa with a pool) from one
pipeline: same grammar, different parameters. Preview: `examples/showcase` → **Lieux procéduraux**.

## The pipeline

```
spec {type, tier, seed}
  → PROGRAM        tier expands to required rooms + areas + connections (data, no geometry)
  → LAYOUT         hub-and-strips solver: every required adjacency shares a wall BY CONSTRUCTION
  → OPENINGS       doors/windows/stairs are DERIVED, never placed:
                     door   = centred on the wall shared by two connected rooms (can't be misplaced)
                     window = exterior walls only, sill/height rules
                     stairs = risers from real rules (riser 15–19 cm, going ≥25) landing in BOTH hubs
  → MODEL (JSON)   rooms, walls+openings, stairs, spawn — serialisable, patchable
  → checkModel()   THE CONTRACT: reachability (BFS through doors), passable widths (character capsule),
                     no overlaps, no corner doors, windows exterior-only, stair rules, hub passable
```

```js
import { generatePlace, checkModel, wallBoxes } from './engine/floorplan.js';
const model = generatePlace({ type: 'home', tier: 5, seed: 7 });   // villa: 2 floors + pool
const { ok, issues } = checkModel(model);                          // gate EVERY model through this
```

## "Modifiable/personnalisable sans régression"

The model is plain JSON. Customising = patching data (move a wall opening, retier the club, swap a seed),
then **re-running `checkModel()`** — either it's still correct, or you get a named issue
(`unreachable room: 0:cuisine`, `door too close to a corner`, `stair riser 0.25 outside 0.15–0.19`).
`scripts/verify-floorplan.mjs` is the CI harness: **every type × tier × N seeds** (200+ models) must stay
green, plus determinism (same seed → identical model). Change the generator, run the harness — that's the
no-regression guarantee.

```bash
node ${CLAUDE_SKILL_DIR}/scripts/verify-floorplan.mjs --seeds 30
```

## Building it in-world (+ physics)

`engine/place-builder.js` (three) turns the model into meshes AND colliders — walls with real door/window
holes (via `wallBoxes`, which splits each wall into solid boxes around its openings: jambs, lintels,
sills), coloured per-room slabs, stair steps, upper slabs with the stairwell hole, terrace + pool:

```js
import { buildPlace } from './engine/place-builder.js';
const { group, colliders, dispose } = buildPlace(model, { at: [0, 0, 0] });
scene.add(group);
for (const c of colliders) phys.addStaticBox(c.pos, c.half);   // same boxes → the character can't clip
```

Because the colliders come from the same boxes as the meshes, the CharacterController (reference/22–23)
works in ANY generated room with zero per-room work — controls are place-independent by construction.

## Programs (what a tier means)

- **club**: t1 couloir+vestiaire+bureau+stockage → t2 adds gym, **salle de presse**, **cafétéria with its
  kitchens attached *via*** (shared wall + door by construction) and the **espace kiné** → t3 adds 2nd
  vestiaire/salle vidéo → t5 hall, spa, auditorium, bureaux staff.
- **home**: t1 chambre d'hôtel (chambre+sdb) → t3 appartement → t4 maison à étage (escalier dérivé) →
  t5 villa (suite avec sdb attenante *via* la suite, étage, terrasse + piscine).

Add a tier or a building type by writing a program (rooms + areas + `via` attachments) — the solver,
openings derivation, and contract are shared.

## Current limits (next steps)
- Rooms are rectangles on a hub-and-strips layout (robust, always-valid; not architecturally fancy).
- No furniture yet — that's `furnish` (recipes per room archetype, validated by `verify-scene`, ref 19).
- Doors are holes, not animated doors; interactions (open/sit/pick up) are the `interactables` step.
- Dollhouse preview has no ceilings; a game adds ceilings + interior lighting per room.
