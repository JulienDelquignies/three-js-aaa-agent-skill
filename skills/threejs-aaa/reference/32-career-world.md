# The career world — multi-site, one character, all derived from the club level

The end-game of the place/stadium chantier: a WORLD of several generated sites the player walks with the
SAME character and controls — home, training centre, stadium loge + terrace. `engine/career.js` derives
everything from **one number** (the club level 1..4) and `checkCareer()` is the no-regression contract.
Playable in `examples/showcase` → **Carrière** (`?niveau=1..4`).

## One number in, a world out

```js
import { generateCareer, checkCareer } from './engine/career.js';
const career = generateCareer({ level: 3, seed: 11 });    // → { sites: {home, club, stadium}, travels }
if (!checkCareer(career).ok) throw new Error('patched world broke the contract');
```

Derivation chain (nothing hand-placed):
- **Tiers from the level** — club T1→T4, home hôtel→villa (`HOME_TIER`), stadium champêtre→moderne.
- **Offsets from the real footprints** — `placeBounds(model)` (outdoor pitches/pool included) and
  `stadiumHalf(model)` (stands, pylons, scoreboard included) size each site; club at the origin, home
  west, stadium south, `GAP` metres of walkable ground between them. Change a tier and the offsets
  follow — no overlap can appear.
- **Travel pads from the entrances** — the floorplan already derives each building's entrance door;
  the pad goes 1.4 m outside it. The stadium pad goes inside the loge (clear of its furniture — checked).
- **Spawns** — building hub spawn (from the floorplan), or the loge floor at `loge.floorY`.

`checkCareer()` re-runs every site's own contract (checkModel ×2 + checkStadium), then checks the WORLD:
footprints ≥4 m apart, travel graph connects every site from home, pads outside buildings near their
entrance (or inside the loge, on its floor, off the furniture), spawns on-site. Harness:
`scripts/verify-career.mjs` — 4 levels × N seeds + determinism + named sabotages (stadium moved onto the
club, travel deleted, pad moved indoors, loge terrace door deleted, spawn dropped to the ground).

## The loge terrace DOOR is derived (and contract-enforced)

The loge's glass front + low parapet are solid — without an opening the terrace *exists but can't be
reached on foot*. `generateStadium` now derives `loge.door = { x, w }` (right of the VIP row) and
stadium-builder splits parapet + glass around it (glass lintel above head height). `checkStadium` fails
on: missing door, door < 0.9 m, door in the corner, any furniture blocking it. The terrace railing is
GLASS with a dark handrail — solid collider, see-through view (the FM view stays open when seated).

Verified headless (Playwright + SwiftShader): walk in the house (y≈0), teleport to the club, teleport to
the loge (character stands at floorY=4.55 m), **walk through the derived door onto the terrace**, the
railing holds at the edge (0.36 m short of it), the parapet still blocks where there is no door.

## Fast-travel teleport (kinematic capsule)

```js
travelTo(key) {
  const p = career.sites[key].spawn, c = this.char;      // spawn = FEET position
  c.body.setTranslation({ x: p[0], y: p[1] + c.center, z: p[2] }, true);
  c.body.setNextKinematicTranslation({ x: p[0], y: p[1] + c.center, z: p[2] });
  ctrl.pos.set(p[0], p[1], p[2]); ctrl.groundY = p[1]; ctrl.vy = 0;   // groundY drives the sit pose height
  tpc._init = false; tpc._occDist = Infinity;            // camera snaps behind, occlusion state reset
}
```

Gotchas that cost time:
- Set **both** `setTranslation` AND `setNextKinematicTranslation` — a kinematic body only applies the
  "next" transform on `world.step()`; forgetting the immediate one leaves one frame of the old position.
- **`ctrl.groundY = spawn.y`** — the seated pose and standUp() are relative to groundY; on the elevated
  loge floor, forgetting this sits the character 4.5 m below the VIP chair.
- In headless tests, driving `ctrl.update()` without `phys.step()` makes the character SINK (the resolver
  computes movement but the collider never moves) — always step the world in sim loops.
- One physics world for all sites is fine at this scale (a few hundred metres): one big ground box +
  every builder collider; teleporting is just moving the capsule.
