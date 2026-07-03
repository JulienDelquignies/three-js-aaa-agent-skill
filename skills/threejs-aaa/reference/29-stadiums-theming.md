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
