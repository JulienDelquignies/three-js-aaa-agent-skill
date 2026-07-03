# Furnishing — rule-based furniture for procedural places

`engine/furnish.js` (dependency-free) furnishes any floorplan model (reference/27) by **room-archetype
recipes** under hard placement rules, and `engine/furniture-kit.js` (three) builds the meshes + one
physics collider per item. Same philosophy as the floorplan: placement is DERIVED from rules, then
independently re-verified — customise the JSON, re-run the check, no regression.

## Usage

```js
import { furnishPlace, checkFurnishing } from './engine/furnish.js';
import { buildFurnishing } from './engine/furniture-kit.js';

const items = furnishPlace(model);                  // pure data: {kind, floor, room, x, z, yaw, w, d, h, faces?}
const { ok, issues } = checkFurnishing(model, items); // THE gate — run it after ANY manual patch
const furn = buildFurnishing(items, model, { at }); // meshes + colliders (→ phys.addStaticBox)
scene.add(furn.group);
```

## The rules every item obeys (and the checker re-verifies)
- **against-wall** items back onto a real wall of their room and face into the room
- inside the room (wall thickness respected), **no overlaps** between items
- **never blocks a door clearance zone** (≈1 m in front of every door, on BOTH sides) or the stair run
- `faces` constraints hold: the office **chair faces its desk**, the **tv faces the sofa**, dining chairs
  face their table (the ref-19 correctness rules, enforced at placement AND at re-check)
- seeded → deterministic (same spec → same furnishing)

## Archetypes → recipes
`chambre|suite→bedroom` (lit + chevets flanquant la tête de lit + armoire [+ bureau si grand]),
`sdb→bathroom` (lavabo, WC, douche), `sejour→living` (canapé + table basse devant + meuble TV en face +
plante + bibliothèque), `cuisine→kitchen` (plan de travail ×3 + frigo + table + chaises), `bureau→office`
(bureau + chaise qui LE regarde + bibliothèque), `vestiaire→locker` (casiers ×4 + banc central),
`gym` (tapis ×2, rack, banc de développé, tapis de sol), `infirmerie|spa→medical`, `cafeteria`,
`salle-video|auditorium→media` (écran + rangées de chaises qui le regardent), `stockage→storage`,
`couloir|hall|palier→hub` (plante, banc). Add an archetype by writing one recipe function.

### The press room (`salle-presse→press`, clubs t2+)
The TV shot, derived: a **sponsor backdrop** (`press-wall`, themed canvas `drawPressWall` — staggered
crest roundels + sponsor wordmarks, the real-world press wall) against a wall, the **podium desk** 1 m in
front (white top, club-cloth skirt, 3 mics), two speakers' chairs between desk and backdrop, then **rows
of press seats facing the podium** (`faces` constraint) and a TV **camera on a tripod** at the back when
the room is deep enough. `checkFurnishing()` has NAMED press rules: backdrop present, aligned, BEHIND the
podium and ≤1.2 m from it, ≥2 press seats facing the desk. Press seats are ordinary `chair` items → they
are automatically sittable in the playable scenes.

## No-regression harness

```bash
node ${CLAUDE_SKILL_DIR}/scripts/verify-furnish.mjs --seeds 20   # all types × tiers × seeds stay green
```

Sabotage coverage (proven): furniture pushed through a wall → caught; wardrobe parked in front of a door
→ caught (`blocks a door/stair clearance`); office chair turned away from the desk → caught
(`does not face its desk`); press seat turned away → caught; sponsor backdrop moved in FRONT of the
podium, or deleted → caught by name.
