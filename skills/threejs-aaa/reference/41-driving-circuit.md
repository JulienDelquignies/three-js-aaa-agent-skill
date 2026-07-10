# Free driving + the circuit — take the wheel, then take it to the track

Buying beautiful cars begs two features: DRIVE them yourself (not just watch the autopilot), and a
TRACK DAY. Both are native modules under contract, and both reuse everything already here: the same
physics, the same interactable grammar, the same derived-site pattern as the beach resort.

## DriveController (`engine/drive.js`, dep-free)

An arcade **bicycle model**: `yaw' = (v / wheelBase) · tan(steerAngle)`, steering angle softens with
speed, reverse steering comes out right through v's sign — no special case. Longitudinal: throttle
accel, hard brake, exponential drag. Physics is INJECTED like CharacterController's:
`drv.collide = (dx, dz) => resolved` — the scene wires a kinematic capsule (radius ~0.95) so
buildings, walls and barriers are REAL; when the resolved move is much shorter than asked, `blocked`
is raised and speed is scrubbed (you hit the wall, you don't clip it). Node harness
(`verify-drive.mjs`): top speed reached and capped, brake to zero, constant steer → a closed circle
of plausible radius, reverse capped + inverted steering, wall blocking, determinism.

Scene wiring (Carrière): « E — Prendre le volant 🚗 » on YOUR parked car → character hidden, WASD =
throttle/steer (Shift brakes), low chase camera, E steps out at the driver's door (car stays where
you stopped). The first live test drove 3 m and slammed the building facing the parking spot —
the collision capsule working exactly as intended.

## The circuit (`engine/circuit.js` + `circuit-builder.js`)

`generateCircuit({level, seed})`: control points on a circle with **low-frequency radial variation**
(2–3 lobes + gentle jitter) → closed Catmull-Rom. Independent per-point jitter FOLDS the loop onto
itself (the first version overlapped its own ribbon — the contract caught it); coherent low-frequency
variation is what makes generated loops track-shaped. Generation is **self-correcting AND
deterministic**: it retries derived sub-seeds until `checkCircuit` passes, so a given (level, seed)
always yields the same provably drivable track.

`checkCircuit`: every bend's circumradius ≥ 9 m (the car can physically turn it), **no
self-intersection or pinch** — non-neighbouring centreline points keep ≥ 1.6× width apart, with the
neighbourhood computed CIRCULARLY (`min(j−i, n−(j−i))` — the linear version flags the seam as a
pinch), paddock off the track, grid slot on it. Sabotages: a kink bent ⟂ to the tangent (note: a
radial SPIKE makes a cusp whose circumradius is huge, not small — bend sideways to test the radius
gate), a mirrored figure-8, the paddock dropped on the racing line.

Builder: the asphalt **ribbon** triangulated from the centreline (`side: DoubleSide` — a one-sided
ground ribbon can end up wound face-down and simply invisible from above), instanced red/white kerbs,
instanced barriers 3 m outside both edges with **yaw colliders** (the car bounces, it doesn't fly
into the fields), checkered start gantry, paddock slab.

## Lap timing is data (`makeLapTimer`)

Crossing detection in track space: `along = dot(pos − startPos, startDir)` sign flip while
`|lateral| ≤ width/2` → crossing; first crossing arms the clock, later ones emit `{lap}` (a > 15 s
floor rejects wobbles on the line). Node-tested by driving the centreline at a realistic pace.
`game-state.recordLap(t)` keeps the best and celebrates a new record with a phone message — the
track day feeds the same diegetic loop as everything else.

## The GT (meshkit loft — `buildGT` in vehicle.js)

The curvy car: body and greenhouse are LOFTED superellipse sections (tail→nose so the winding faces
outward) through one pass of Loop subdivision — real haunches over the rear wheels, long low nose,
fastback glass. Same contract as every car: paint material named `'body'` (paintCar cycles the
showroom colors), spinning wheel groups, `{group, wheels, dispose}`. Catalogue: `gt` at 240 k€ from
level 2; with more models than podiums the showroom now displays the TOP of the range
(`catalog[offset + i]` — the citadine sells itself).
