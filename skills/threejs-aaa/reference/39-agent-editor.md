# The agent editor — play-mode MCP + debug gizmos (Unity's editor, for agents)

Unity's value is the editor: see the scene, inspect state, play without rebuilding. An AI agent
doesn't click a hierarchy — its editor is different: a PERSISTENT play session it can query and act
on (the MCP server), and a scene view rendered INTO its screenshots (the gizmos). Both halves serve
the human too: the same `?debug=1` overlay works on the deployed site, so the agent and the game's
creative director look at the SAME truth and can talk about it.

## Play mode: `scripts/playmode-mcp.mjs` (MCP over stdio, zero-dep JSON-RPC)

The slow part of the QA loop is not thinking — it's rebuild + relaunch + reload (~30–60 s per
question). The MCP server keeps ONE game session alive in headless Chromium; iteration drops to
seconds (a `travelTo` runs in ~3 ms, a screenshot in ~1–8 s including sim frames):

- `play_open {dist?, page?, params?}` — start/replace the session (defaults: carriere.html,
  `niveau=3&debug=1`, always `&capture&webgl` so the sim loop is driven by the tools).
- `play_state` — site, character position, seated/driving/phone flags, forme/cash/unread.
- `play_screenshot {name?, frames?, camera?}` — advance N sim frames, render (postfx), save a PNG,
  return its path (then Read it). Free camera via `{pos, look}`; game camera otherwise.
- `play_eval {code}` — the universal escape hatch: async JS with `S` (= `window.__carriere`) and `E`
  (= `window.__engine`) in scope. Teleport (`S.travelTo`), act (`S.sys.interact()`), read a contract,
  set a parameter — anything the console could do.
- `play_perf` — draw calls / triangles / memory from `renderer.info`.
- `play_close` — shut everything down.

Registered in the repo's `.mcp.json` (project scope — future sessions load it automatically); needs
`playwright` resolvable from the project (dev dependency; the Claude Code env pre-installs Chromium
at `/opt/pw-browsers/chromium`, override with `PLAYMODE_CHROMIUM`). The protocol side is ~60 lines of
newline-delimited JSON-RPC 2.0 (`initialize`, `tools/list`, `tools/call`) — no SDK needed.

Test pattern (proves the server like any other module): spawn it, speak real JSON-RPC over stdio,
assert on the tool results — open → state → eval travelTo → screenshot → perf → close.

## Scene view: `engine/debug-gizmos.js` (`?debug=1`, native module)

`new DebugGizmos(scene, { phys, sys, city, getState })` overlays what the engine KNOWS onto what the
camera SEES — the class of bug it catches is "the data and the visuals disagree" (the wedged bus
aisle, the backwards lounger — each cost a bespoke probe script before; now one glance):

- **Physics colliders** as wireframes — static amber, kinematic cyan (doors: tracked per frame from
  the Rapier body). Backed by a tiny registry in `physics.js` (`this.boxes`, filled by
  `addStaticBox`/`addKinematicBox`) — Rapier's world isn't introspectable enough on its own.
- **Interactable radii** as green rings (from `InteractableSystem.items`).
- **Drivable routes** as sky-blue polylines (from `city.paths`).
- **Live DOM panel** — site, position, draw calls/triangles, the 4 nearest interactables with
  distances (the runtime inspector).

One InstancedMesh per family + `depthTest: false` (a collider must never be hidden by the wall it
wraps) — the overlay can't wreck the perf it diagnoses. Scenes wire it in two lines: construct when
`?debug` is present, `gizmos.update(renderer)` per frame. It ships to production deliberately —
gated by the URL param, costing nothing when off — so a bug report from the live site can come back
as a debug screenshot.

## Why this order matters

Play mode + gizmos are force multipliers for everything after them: content sweeps (galleries of
seeds for the human to art-direct), simulation balancing (batch runs with statistical contracts),
match-day camera tuning (framing contracts against the live replay). Build the editor before the
content that needs it.
