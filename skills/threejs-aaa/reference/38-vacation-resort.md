# The vacation resort — beach, villa, transats, and the forme loop

The DS's holidays as a real PLACE (the game vision: everything a directeur sportif does in real life
is walkable in 3D): a seaside station far beyond the city — no street goes there, you only reach it
by TRAIN or JET (« Partir en vacances 🏖️ » at the second lounge table) — with a villa, a sand strip
running down to the sea, palms, transats and parasols. And a management effect: trips wear the DS's
FORME down, holidays restore it.

## Derived data (engine/beach.js) + the contract

`generateBeach({level, seed})` — local space, villa at the origin, the sea to the SOUTH (+z):
- the **villa** is the `home` grammar one tier above your level (`tier: min(5, level+1)`) — you
  holiday better than you live; it passes `checkModel` like any place.
- the **sand** wraps the villa and extends 24 m south; the **sea** starts exactly where the sand ends.
- **transats** sit between villa and water with `yaw ≈ 0` — facing +z, i.e. THE SEA; **parasols**
  shade every other one; seeded **palms** skip the villa footprint and keep ≥ 2.2 m from loungers.
- **spawn** lands outside the hub entrance (the travel-pad convention: `hub.rect[0] − 1.4`), with the
  **returnPad** 2.2 m west of it.

`checkBeach()` is the no-regression gate, with named sabotages in `scripts/verify-beach.mjs`:
the sea must not flood the beach, the villa must not stand in the surf, every transat ON the sand /
NOT in the water / `cos(yaw) ≥ 0.9` (face the sea) / clear of the villa, palms off the villa and off
the loungers, spawn walkable, return pad ≤ 6 m from spawn. Geometry contracts like « the loungers
face the sea » cost one line and catch a whole class of silly-looking worlds.

## Meshes (engine/beach-builder.js)

Sand + wet band + a foam line at the waterline; the sea's VISUAL plane runs far wider and deeper than
the data rect so the horizon reads as open water. Palms: leaning segmented trunk (deterministic lean
per index — no `Math.random`), 7 drooping fronds, coconuts. Transats: slatted deck + backrest HINGED
at the deck head and reclined away from the sea (`rotation.x = 0.85` — mind the sign: rotating about
+x sends the plank's −z end UP; get it wrong and the backrest hovers over the seat like a table top).
Returns local colliders (palms/loungers/poles) and `seats` (pos/yaw/seatH 0.38) so the scene wires
« E — S'allonger au soleil » with the usual furniture→character yaw conversion (`ctrl.yawFor`).

Rendering lesson: a large, very bright ground area (near-white sand) under sun + bloom reads as a
milky veil over the whole frame. Keep big planes mid-tone (sand 0xbfa26b) and avoid pure-white props
(terracotta parasols) — same family as the clearcoat blowout on cars (reference/16).

## The forme loop (game-state) and the scene wiring

- `state.forme` starts at 100; `scoutTrip` costs 12 (train) / 18 (jet), clamped at 0;
  `state.vacation()` restores 100 and pushes an assistant message. The Finances app shows the forme
  with a green/amber/red color. Harness: verify-gamestate (wear, restore, clamp).
- Carrière builds the resort only when the gare exists (level ≥ 3) at `city.bounds[2] + 100` — far
  east, outside the street grid. Villa built by place-builder (furnished, doors, sittable seats);
  beach colliders use the `addStaticBox(pos, half, rot)` yaw overload for the loungers.
- In the train/jet cabin, table 0 keeps the scouting trip and table 1 is « Partir en vacances 🏖️ » —
  two actions on the SAME table would fight for the prompt. `_goVacation()` teleports to the beach
  spawn facing the villa, calls `state.vacation()`, and the site becomes `vacances` (not a career
  site: HUD set manually, `travelTo` from the return pad goes back to the site you left from).
