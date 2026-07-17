# Stadiums & club identity — tiers of infrastructure, the FM view, theming

The career-game trio: a **parametric stadium** (tier 1 champêtre → tier 5 ultra-moderne), **glass offices
overlooking the training pitches**, and a **club theme** (colors/crest/jerseys) that makes every club look
like itself. Preview: `examples/showcase` → **Stades** and **Lieux procéduraux**.

## Stadium (`engine/stadium.js` + `engine/stadium-builder.js`)

```js
import { generateStadium, checkStadium } from './engine/stadium.js';
import { buildStadium } from './engine/stadium-builder.js';
const model = generateStadium({ tier: 3, seed: 7 });          // pure data, deterministic
const built = buildStadium(model, theme, { at: [0, 0, 0] });  // meshes + colliders + vantages
```

- **Tiers**: t1 = one low main stand (~850 places, Ligue 2/National vibe) … t5 = four two-deck stands,
  full roof (~13 500). Capacity strictly increases with tier (asserted).
- **The loge (directors' box)** is always on the main stand: a glass room at the top with a small
  **terrace** in front — `model.vantages.{loge,terrace}` are the playable "FM view" points where the
  sporting director watches the match. The loge floor/terrace/railing are **colliders** (walkable).
- **Contract `checkStadium()`**: stands clear of the pitch apron, loge above the rows, and an
  **unobstructed sightline** from the terrace eye to the pitch centre (row-by-row line-of-sight test).
  Harness: `node ${CLAUDE_SKILL_DIR}/scripts/verify-stadium.mjs` (5 tiers × seeds + determinism).
- Seats are one `InstancedMesh` per stand (13k seats stay cheap), colored `theme.primary` with
  `theme.secondary` end blocks; the club crest hangs in the loge.
- **The loge is EQUIPPED** (`model.loge.items`): a bar against the back wall + stools, a VIP chair row
  facing the pitch through the glass, mini-fridge, wall screen, plant — all themed, all colliders, all
  under contract (VIP seats face the pitch, nothing blocks the glass, bar at the back, no overlaps).
  Two-deck stands are **notched around the loge** (contract: `deck-2 seating passes through the loge`
  if a patch removes the notch).

## Match furniture (all data + contract)

Every stadium also carries, in the model (built themed by `stadium-builder`, all under `checkStadium()`):
- **Goals**: regulation 7.32 × 2.44 with real line-segment nets (sloped roof, back/side panels), centred
  on the goal lines, opening toward the pitch — contract rejects off-line, non-regulation or backwards.
- **Sponsor boards** (`theme.sponsors` — seeded defaults or the club's real sponsors): LED-look strips
  ringing the pitch (1 side at t1 → all 4 at t4+), 3 m behind the lines, ≤1.1 m tall (first-row sightline
  is contract-checked), slightly tilted, softly emissive.
- **Floodlights by tier**: 4 corner pylons with glowing heads (t1–3, champêtre/L2 look) → roof-integrated
  light strips (t4–5).
- **Dugouts** (t2+): plexi shelters with club-colored benches flanking the **players' tunnel**.
- **Corner flags** (club color), **giant scoreboard** behind the end (t3+, shows initials + score).
- Full pitch markings: penalty areas + 5.5 m boxes, penalty spots + arcs, corner arcs, mown stripes.

## Glass offices over the training pitches (club places)

Club programs (reference/27) mark offices `glass`: the layout FORCES them onto the north strip, their
exterior wall becomes a full **glazed bay** (`opening.type='glass'`, verified exterior-only + facing the
pitches), and the model gets `outdoor.pitches` (1→3 training pitches by tier) laid out right outside.
`place-builder` renders translucent panes + the pitches — the Leicester/PSG/OL "bureaux vitrés" at any
scale.

## Club identity (`engine/club-theme.js`)

```js
const theme = makeTheme({ seed, name: 'Racing Métropole', primary: 0x1f3a93, secondary: 0xf8d210 });
```
`{ name, initials, primary, secondary, accent }` — seeded palette or fully explicit. Applied everywhere:
stadium seats + crest, hub floor tint (`buildPlace(model, {theme})`), and **framed jerseys + crest panels**
in club offices (furnish adds `jersey-frame`/`crest-panel`; the kit draws them from canvas via
`drawCrest`/`drawJersey`). Two clubs never look alike; matching reality = supplying real colors/name.

## Scale gotcha
Stadium scenes are ~300 m across: the default indoor fog (`FogExp2 0.014`) will grey everything out —
set `scene.fog = new FogExp2(color, ~0.0012)` (and mind `camera.far`).

## Landmark presets — signature silhouettes

`generateStadium({ tier, seed, landmark })` with `'grandbol' | 'arche' | 'nervures'`: the SAME
parametric data + contract, plus ONE derived `signature` the builder knows how to raise —
- **grandbol** (the giant asymmetric bowl): oversized stand counts, taller main deck, and four
  CORNER BANKS (quarter-arc bleacher surfaces + instanced seats facing the pitch centre) that close
  the bowl; capacity credits the corners.
- **arche** (the great arch): a meshkit tube swept along a parabola spanning the whole bowl above
  the roofline — contract: the apex must CLEAR the roof, the span must cover the pitch.
- **nervures** (the concrete ribs): ~36 ribs (ONE meshkit swept profile, instanced with per-rib yaw)
  around the stadium's bounding ellipse, leaning over the rim — contract: enough ribs to read as the
  signature, none standing on the pitch.
Signatures are DERIVED from the actual footprint (extents, roofline), never hardcoded coordinates —
so they survive tier/seed changes. Sabotages: a crushed arch, a rib planted on the pitch.
