# Diegetic UI — the DS phone, the FM data layer, one city two presentations

The management side of the DS game: a PHONE overlay (DOM, no three.js) + a SEPARATE data store the 3D
world and the UI both read and write. Playable in **Carrière**: `T` / gamepad Y / the 📱 button.
The phone is a REAL one: a home screen of apps (wallpaper, status bar, unread badges, home bar) and
full-screen app pages — the scene composes its app list (`PhoneApps.messages/effectif/finances` +
placeholders + ACTION apps whose `launch()` runs immediately, e.g. Plan → the city view).

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

## The city view (Top-Eleven style), not a phone map

Feedback-driven redesign: city navigation does NOT live on the phone screen. `engine/city-view.js` is a
management-game overview of the REAL 3D city: `M` / 🗺️ / the phone's Plan app glides the camera to a
fixed panorama (pose derived from `city.bounds`), and clickable PINS (DOM chips, projected every frame
with `Vector3.project`) hover over the sites — pick one, the view closes and the drive starts. No free
camera, no SimCity building. The pins/pose read the same `city`/`career` objects as the 3D — one source
of truth still holds.

Travel between NON-adjacent sites composes legs over the travel graph (BFS on `career.travels`,
concatenate the per-leg polylines minus the duplicated joint) — verified headless: home→stadium drives
THROUGH the club's curb stop.

## Scene integration rules

- Phone open OR city view active ⇒ **the world waits**: zero move input, no interactions;
  physics/anim keep ticking so nothing snaps when it closes.
- The phone is self-contained DOM (injects its own CSS, `dispose()` removes it) — works on any page,
  screenshots include it (Playwright captures DOM over canvas: free visual QA of UI + 3D together).
- App badges refresh on the home screen each frame (cheap DOM); pins reproject every frame while the
  view is active (4 elements).
