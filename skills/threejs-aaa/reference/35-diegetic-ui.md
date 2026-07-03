# Diegetic UI — the DS phone, the FM data layer, one city two presentations

The management side of the DS game: a PHONE overlay (DOM, no three.js) + a SEPARATE data store the 3D
world and the UI both read and write. Playable in **Carrière**: `T` / gamepad Y / the 📱 button.

## Architecture: three layers, one direction of truth

```
game-state.js  (data: budget, roster, messages)  ← the single source for "the game"
     ↑ writes                    ↑ reads/writes
3D world (scenes)            phone.js (DOM overlay)
```

- `makeGameState({seed, level})` — dependency-free, deterministic: roster (14 players, G/D/M/A,
  ratings that grow with the club level), transfer budget by level, `addMessage()/markRead()` with an
  unread counter. Harness `verify-gamestate.mjs` (determinism, quality growth, bounded ratings,
  message flow).
- **The 3D writes to the UI**: finishing the restaurant meeting (reference/33) pushes an Agent message
  — the phone badge lights up. The player LIVES an event, the management layer records it.
- **The UI drives the 3D**: the map's destination buttons call the same `driveTo()` as the walk-up
  travel pads.

## One city, two presentations

The phone's Carte tab renders **the same `city` object** (engine/city.js) on a 2D canvas: the same
road grid cells, the same site rects, the same stops — plus live markers (you, your car). Because both
the 3D world and the map read one model, they can never disagree; `checkCity` validates once for both.

Map travel between NON-adjacent sites composes legs over the travel graph (BFS on `career.travels`,
concatenate the per-leg polylines minus the duplicated joint) — verified headless: home→stadium drives
THROUGH the club's curb stop.

## Scene integration rules

- Phone open ⇒ **the world waits**: zero move input, no interactions; physics/anim keep ticking so
  nothing snaps when it closes.
- The phone is self-contained DOM (injects its own CSS, `dispose()` removes it) — works on any page,
  screenshots include it (Playwright captures DOM over canvas: free visual QA of UI + 3D together).
- Repaint the live map at ~5 Hz while open, not per frame.
