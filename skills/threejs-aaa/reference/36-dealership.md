# The dealership — showroom grammar, derived catalogue, buy loop, real GLB car

The lifestyle loop closes: walk into a generated showroom, watch the catalogue cars turn on their
podiums, buy one AT THE SHOWN COLOR — your personal cash (game-state) is debited, a message confirms,
and THAT car is the one driving the city from now on. Playable in **Carrière** (site Concessionnaire).

## Grammar + furnishing

- `generatePlace({ type: 'concession', tier })`: a big glazed SHOWROOM (the `glass` flag derives the
  bays), sales office, workshop (t3+), storage. Same solver/contract as every other place type.
- `showroom` archetype: a ROW of `car-podium` items pressed against the GLASS side, noses to the
  window like real showrooms — the hub-door clearance stays free BY CONSTRUCTION (first version
  centred the row and the contract killed the podium in front of the door; moving the row to the
  glass side both fixed it and looks right). Slot count follows the room width; showroom areas are
  sized so the slots match the catalogue (t2→2 … t4→4).

## The catalogue is derived data (`dealership.js`)

`makeCatalog({level})`: which models are displayed and at what price follows the CLUB level — the
supercar appears at level 3 (window-shopping: visible, unaffordable — the contract asserts BOTH) and
becomes affordable at level 4. `checkCatalog(catalog, state)`: ≥2 models, prices strictly ascending,
unique kinds, at least one affordable with the DS's personal `state.cash`, display colors present.
Harness `verify-dealership.mjs` (13 checks incl. buy-flow and 4 named sabotages).

`game-state` gains the personal side: `cash` (k€, grows with the level — separate from the club's
transfer budget) and `buyCar(entry, color)` (refuses what can't be paid, debits, swaps `state.car`,
pushes a Concessionnaire message → phone badge).

## The cars

- Procedural variants from ONE parametric builder (`buildCar({kind})`): the body is a **2D side
  PROFILE extruded across the width with a bevel** (nose, hood, beltline, decklid — per-kind point
  lists), and the GREENHOUSE is a second, narrower profile extrusion of tinted glass SITTING ON the
  beltline — that paint-shell/greenhouse split is what makes a silhouette read as a car (a single
  profile up to the roof swallows the glass; found by visual QA). Clearcoat paint
  (`MeshPhysicalNodeMaterial`, moderate clearcoat — a mirror clearcoat blows out to white in sun +
  bloom), torus tires with spoked rims, rocker band, grille, emissive head/tail lights, mirrors,
  plates. Name the paint material `body` so `paintCar` finds it.
- The premium model is **ferrari.glb from the three.js repo** (Ferrari 458 Italia by vicent091036 —
  credit it in your UI). It is Draco-compressed: `DRACOLoader.setDecoderPath('draco/')` with the
  decoder files copied from `three/examples/jsm/libs/draco/gltf/` into `public/draco/`.
- `paintCar(group, color)`: the official three.js car demo names the body OBJECT `body` — clone that
  mesh's material per instance (clones share materials!) then set its color. `findWheels(group)` grabs
  `wheel_fl/fr/rl/rr` so the GLB's wheels spin under the same PathDriver as the procedural cars.
- Showroom life: each podium car slowly turns and CYCLES its display colors (~2.5 s) — buying takes
  the color currently shown, no extra UI needed.

Headless proof: Ferrari refused at level 3 (cash intact), SUV bought at the shown color (cash −90 k€,
message pushed), and the bought SUV — then the Ferrari at level 4 — drives the city and parks at the
destination curb stop.
