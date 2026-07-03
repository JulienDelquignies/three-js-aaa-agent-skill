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

## Scouting trips (the transport→management loop)

On the platform / apron: « E — Voyage de scouting » → `state.scoutTrip('train'|'jet')` (deterministic
sequence): a prospect (name/position/rating/city — jet trips reach abroad and scout better players) is
pushed onto `state.shortlist` + a Chef-du-scouting message (phone badge). The Transferts app lists the
shortlist. Harness: shortlist/report flow + determinism; headless: full ride + report + app content.
