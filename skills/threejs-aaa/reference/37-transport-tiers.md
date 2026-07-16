# Transport by tier — team bus, station, airport, scouting trips

The transport ladder of the DS game, all derived and contract-gated: the TEAM BUS is always parked at
the club; the TRAIN STATION joins the city at career level 3; the AIRPORT with the club jet at level 4.
Riding is ONE system (PathDriver) with several skins; the station/airport also carry the first
management loop: SCOUTING TRIPS that feed the phone's Transferts app.

## Grammar + world gating

- `generatePlace({type:'gare'})` / `{type:'aeroport'}`: small civic buildings (hall hub, guichets/
  comptoirs → `ticketing` archetype, attente/salle-embarquement → `waiting`) + a DERIVED outdoor:
  `outdoor.quai` (platform slab + safety line + rails) / `outdoor.tarmac` (apron). checkModel refuses a
  platform/tarmac that intersects the building.
- `career.js` gates by level and `checkCareer` ENFORCES the ladder both ways: level 3+ without its
  station fails, a station below level 3 fails (same for the airport at 4). Sabotage proven.
- City/pins/travel pads pick the new sites up automatically (generic place-kind loops everywhere).

## One drive system, several skins

`buildBus({theme})` — the profile-extrusion technique at coach scale, in the CLUB LIVERY: primary
paint, dark window band, `drawSponsorStrip` along both flanks, the crest by the door. Matchday at the
club: « E — Monter dans le bus » → the SAME PathDriver drives the bus to the stadium (slightly slower),
your car STAYS parked (a `_skipCarPark` flag keeps the arrival teleport from moving it), and leaving
the stadium rides the bus back before re-parking it at the club. `buildTrain`/`buildJet` are static
platform/apron dressing (two-coach regional with an accent band; business jet with T-tail and engines).

Gotcha: never `Object.assign(mesh, { position: v })` — `Object3D.position` is a read-only accessor and
throws at runtime; always `mesh.position.set(...)` (broke the whole scene load, caught headless).

## The INTERIORS (engine/cabin.js + cabin-builder.js)

Vehicles are experienced from inside. `generateCabin({kind})` derives the layout as data — bus: 2+2
rows + driver; train coach: 2+2 + facing TABLE pairs; jet: the flying LOUNGE (club chairs face-à-face
around tables — the future in-flight recruitment meetings). `checkCabin()` is the contract: seats
inside the shell, no overlaps, clear door bay, forward seats facing forward, lounge pairs facing each
other, and the AISLE unobstructed over the full length at the REAL physics gauge — capsule diameter
0.60 + 2× the controller offset = **0.64 m**. The first contract said 0.52 and passed while the game
wedged the capsule between the seat colliders: contracts must encode the real gauge, not a guess.

`buildCabin()` renders floor / window-band side panels (glass between pillars) / lit ceiling / themed
seats + tables, and returns LOCAL colliders. Two mounting modes:
- **Riding** (bus): add the cabin group INSIDE the vehicle group — it drives along. The bus shell is a
  closed FrontSide mesh, so from inside it is INVISIBLE: the matchday camera sits in the aisle among
  three seated, jersey-tinted TEAMMATES (SkeletonUtils clones, idle anim + bent legs re-applied after
  each mixer update) and the city stays visible through the window band.
- **Walkable** (train/jet, parked): place the cabin at the vehicle's world pose and feed the colliders
  to `Physics.addStaticBox(pos, half, rot)` — the ROTATION overload handles any parked yaw (the jet
  sits at 0.5 rad). Board/leave doors teleport (set `groundY` to the cabin floor!), the seats are
  sittable, and the scouting interactable lives at the lounge table.

## Scouting trips (the transport→management loop)

On the platform / apron: « E — Voyage de scouting » → `state.scoutTrip('train'|'jet')` (deterministic
sequence): a prospect (name/position/rating/city — jet trips reach abroad and scout better players) is
pushed onto `state.shortlist` + a Chef-du-scouting message (phone badge). The Transferts app lists the
shortlist. Harness: shortlist/report flow + determinism; headless: full ride + report + app content.

## Acting DURING transport — the in-flight meeting

The jet's second lounge pair is reserved (excluded from the generic sittable loop — two
interactables on the same seat fight for the prompt): a dark-suited agent (a `_seatedExtra` clone
with a custom tint, no jersey lerp) waits at the table, and « E — Rendez-vous en vol ✈️ » runs the
restaurant's encounter grammar airborne — sit opposite, talk through the lines, close the deal
(phone message + `poignee` handshake played on BOTH rigs). Wiring order matters: cabins are mounted
before the character rig loads, so the cabin stores its refs and the NPC + interactable are created
after `_soldierGltf`/gestures exist.
