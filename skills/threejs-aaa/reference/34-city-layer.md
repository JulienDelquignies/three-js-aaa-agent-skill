# The city layer — derived streets, drivable routes, one source of truth

The elevated city around the career sites: streets, buildings, curb stops and DRIVABLE routes — all
derived from the career world + a seed, never drawn. One data model, several presentations (the 3D
elevated view now; the phone map later renders THE SAME `city` object, so two maps can never disagree).
Playable in **Carrière**: take a travel pad → watch your car drive the streets, elevated chase camera,
E skips, the arrival hides the site (re)load.

## Derivation chain (`engine/city.js`, dep-free)

1. **Grid** over the real site footprints (`placeBounds`/`stadiumHalf`) + a city ring; site cells are
   blocked (streets can never cross a site — contract-checked).
2. **Curb stops** derived from each site's entrance pads (stadium: its club-side edge), snapped to the
   grid.
3. **Streets carved by a road-reusing Dijkstra** between every travel pair (existing road cells cost
   0.18 vs 1) — shared avenues EMERGE instead of being drawn — plus seeded straight avenues for urban
   texture (more with the level).
4. **Routes** re-run on the carved network only → collinear-simplified polylines per travel pair.
5. **Parcels**: free cells facing a street become buildings — density and height scale with the club
   level (`DENSITY`/`RISE`: T1 bourg ~30 % low houses → T4 métropole ~92 % with a downtown boost near
   the club). Leftovers: trees/parks; streetlights along the streets.

`checkCity(city, career)` is the contract: stops ON a street, a route EXISTS for every travel pair
(entirely on streets, joining the stops), streets never on a site, buildings never on a street/site,
the street graph connects every stop (BFS), city not empty. Harness `verify-city.mjs`: 4 levels ×
seeds + determinism + **density strictly growing with the level** + 5 named sabotages (stop moved into
the club, route deleted/diverted, building on a street, street cut → graph disconnected).

## Rendering (`city-builder.js`) — flat-shaded, one draw call per family

Street cells merged into per-row strips (each cell rendered exactly once — no z-fighting), dashed
centre lines + crosswalks at the stops (instanced), buildings as ONE `InstancedMesh` with per-instance
scale AND color (a few hundred instances = the whole skyline), instanced trees + streetlights.
Buildings return **colliders** (the player can't walk through the city); streets stay open.

## Driving (`vehicle.js`)

`buildCar({color})` (procedural sedan, spinning wheels, emissive headlights) + `PathDriver(path,
{speed})`: eased speed at both ends, yaw damped through corners, `finish()` to skip. The scene hides
the character, drives the car each frame, and an ELEVATED chase camera (~31 m up, looking past the
car) turns every trip into the city overview. On arrival: park at the destination stop + the normal
teleport/spawn logic. ONE system, several skins later (team bus in club livery, taxi, airport shuttle).

Headless proof: car drives club→restaurant with 31/31 position samples ON road cells, parks at the
derived stop (d=0.00), E-skip works.

Gotcha found while shipping: on arrival at the stadium the follow camera sat ABOVE the loge — and the
loge ROOF had no collider, so the occlusion clamp ignored it and the view was a roof close-up. Solid
roof collider fixed it (the camera now ducks under). Rule of thumb: every surface that can come
between the camera and the head needs a collider, or the occlusion callback is blind to it.
