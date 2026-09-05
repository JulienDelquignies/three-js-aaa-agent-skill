---
name: threejs-aaa
description: >-
  Builds AAA-quality 3D games and interactive scenes with Three.js: production
  rendering (WebGPU/TSL, PBR materials, HDRI/IBL lighting, post-processing),
  procedural geometry/terrain/scattering, and Mixamo-rigged animated characters
  with state machines and physics. Use when building, scaffolding, designing, or
  optimizing a Three.js / WebGL / WebGPU 3D game, a character animation system, a
  procedural world, photoreal materials, or a high-end interactive 3D scene.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash(node *), Bash(npm *), Bash(npx *), Bash(node:*)
---

# Three.js AAA Game Toolkit

Procedural knowledge + executable scripts + a runnable starter project for building
**AAA-looking 3D games in Three.js**. Targets the modern (2026) stack: `three@^0.185`,
**WebGPURenderer** with automatic WebGL2 fallback, **TSL** shaders, node-based
post-processing, and the Mixamo → glTF character pipeline.

> This file is the navigation hub. Read the relevant `reference/*.md` file before
> implementing a subsystem — they contain verified APIs, exact package versions, and
> copy-ready patterns. Do not guess Three.js APIs from memory; they churn between releases.

## How to use this skill

1. **Identify the subsystem** the user needs (rendering, characters, procedural, perf…).
2. **Read the matching reference file** (table below) for current APIs and gotchas.
3. **Reuse the starter engine** in `assets/starter/` rather than writing boilerplate — it
   already wires up renderer, color management, IBL, shadows, post-processing, and a loop.
4. **Run the bundled scripts** for scaffolding, character conversion, and procedural assets.
5. **Verify** by running the dev server (`npm run dev`) and checking `renderer.info`.

## Reference map (load on demand)

| Need | Read |
|---|---|
| Project setup, deps, engine architecture, dev server | [reference/01-project-setup.md](reference/01-project-setup.md) |
| Renderer, PBR materials, HDRI/IBL, tone mapping, color, shadows | [reference/02-rendering.md](reference/02-rendering.md) |
| Custom shaders, TSL, procedural & node materials, triplanar | [reference/03-materials-shaders.md](reference/03-materials-shaders.md) |
| Post-processing: bloom, GTAO, SSR, DOF, TAA/SMAA, color grade | [reference/04-post-processing.md](reference/04-post-processing.md) |
| Mixamo pipeline, GLTF loading, AnimationMixer, state machine, IK | [reference/05-characters-mixamo.md](reference/05-characters-mixamo.md) |
| Procedural animation: springs, damping, two-bone IK, look-at, foot IK | [reference/14-procedural-animation.md](reference/14-procedural-animation.md) |
| **Locomotion (REQUIRED for moving characters): no foot-skate — cadence-sync + foot-lock IK + follow camera** | [reference/21-locomotion-no-footskate.md](reference/21-locomotion-no-footskate.md) |
| **Character controller (controls): input→facing (no moonwalk)+run/idle+no-slide, camera-relative, gamepad** | [reference/22-character-controller.md](reference/22-character-controller.md) |
| **Physics & collisions (Rapier): walls/crates/steps, kinematic character, dynamic bodies, kick/push** | [reference/23-physics-rapier.md](reference/23-physics-rapier.md) |
| **AI opponents: steering (seek/flee/arrive/pursue/wander) driving the same CharacterController** | [reference/24-ai-steering.md](reference/24-ai-steering.md) |
| **Particles (juice): pooled instanced additive bursts — run dust, kick sparks, impacts, trails** | [reference/25-particles.md](reference/25-particles.md) |
| **Animation state machine: Idle→Walk→Run 1D blend (cadence-synced) + discrete states + crossfades** | [reference/26-anim-state-machine.md](reference/26-anim-state-machine.md) |
| **Procedural places (interiors): spec→rooms/walls, doors/stairs DERIVED, no-regression contract** | [reference/27-procedural-places.md](reference/27-procedural-places.md) |
| **Furnishing: room-archetype recipes, against-wall/facing/clearance rules, re-verifiable** | [reference/28-furnishing.md](reference/28-furnishing.md) |
| **Stadiums & club identity: tiers, loge+terrace (FM view), sightline contract, theming** | [reference/29-stadiums-theming.md](reference/29-stadiums-theming.md) |
| **Interactables (playable): doors that block/open, sit (hips on seat), pick up/carry, prompts** | [reference/30-interactables.md](reference/30-interactables.md) |
| **Indoor playability: camera occlusion (never through walls) + per-room lights & switches** | [reference/31-interior-camera-lighting.md](reference/31-interior-camera-lighting.md) |
| **Career world: multi-site (home+club+stadium) derived from ONE level, fast-travel, checkCareer** | [reference/32-career-world.md](reference/32-career-world.md) |
| **Venues & encounters: restaurant grammar, meeting-table contract, seated NPC face-to-face** | [reference/33-venues-encounters.md](reference/33-venues-encounters.md) |
| **City layer: derived streets (Dijkstra), drivable routes, level-scaled skyline, checkCity** | [reference/34-city-layer.md](reference/34-city-layer.md) |
| **Diegetic UI: the phone overlay, FM data layer, one city rendered 3D AND 2D (map travel)** | [reference/35-diegetic-ui.md](reference/35-diegetic-ui.md) |
| **Dealership: showroom grammar, derived catalogue (level-gated supercar), buy loop, GLB car** | [reference/36-dealership.md](reference/36-dealership.md) |
| **Transport tiers + INTERIORS: bus livery & matchday ride, walkable train/jet cabins, scouting** | [reference/37-transport-tiers.md](reference/37-transport-tiers.md) |
| **Vacation resort: derived beach/villa/palms, loungers-face-the-sea contract, the forme loop** | [reference/38-vacation-resort.md](reference/38-vacation-resort.md) |
| **Agent editor: play-mode MCP (persistent live session, seconds not rebuilds) + debug gizmos** | [reference/39-agent-editor.md](reference/39-agent-editor.md) |
| **Meshkit — Blender ops as data: lathe/sweep/loft/displace, closed-manifold contract** | [reference/40-meshkit.md](reference/40-meshkit.md) |
| **Free driving + circuit: bicycle-model controller, derived drivable track, lap timer** | [reference/41-driving-circuit.md](reference/41-driving-circuit.md) |
| **Animkit — Mixamo moves as data: pose keys, anatomical contract, additive gestures** | [reference/42-animkit.md](reference/42-animkit.md) |
| **Staged sculpt workflow: blockout → form → lookdev, double-gated (contract + screenshot)** | [reference/43-sculpt-workflow.md](reference/43-sculpt-workflow.md) |
| **Character swap: cross-rig retarget (world-delta), quantized GLBs, skinned layered clothing** | [reference/44-character-swap.md](reference/44-character-swap.md) |
| **Football that feels real: ball aerodynamics (drag/Magnus/spin) + touch-based dribbling** | [reference/45-football-simulation.md](reference/45-football-simulation.md) |
| **A 5v5 possession game that plays itself: jobs not urges, inverse ballistics, both feet, night** | [reference/46-possession-game.md](reference/46-possession-game.md) |
| **IMPOSSIBLE football (21 rules, one sabotage each) + the GESTURE VOCABULARY as data (foot, surface, windows)** | [reference/47-football-rules.md](reference/47-football-rules.md) |
| **A gesture with a beginning and an end: windup → contact → follow-through, the ball leaves at contact** | [reference/48-gesture-timeline.md](reference/48-gesture-timeline.md) |
| **The gait clock: ONE locomotion phase, clips slaved to it, cadence from Dorn 2012, whole-body layer** | [reference/49-gait-engine.md](reference/49-gait-engine.md) |
| **Generated gestures (motion-rig + motion-strike + motion-control + motion-aerial + motion-skill + motion-ground + motion-keeper + motion-cast): 41 species — strikes, controls, headers, dribbling skills, slide tackle, keeper dives and parades — as anatomical joint curves and IK foot paths → animkit specs, rig profile with sign probe, per-player style, the contact sheet** | [reference/51-motion-strike.md](reference/51-motion-strike.md) |
| **LA CHARTE MOTEUR (uniformisation) : 10 lois — une autorité par corps, projections en dernier, actionneurs bornés, refus nommés qui pilotent, intention qui colle, courses pas photos, un instant un contrat, clauses monde-composé, budgets = dettes, résultats négatifs** | [reference/50-charte-moteur.md](reference/50-charte-moteur.md) |
| Character↔object interaction + correctness verification (orientation, reach…) | [reference/15-interaction-alignment.md](reference/15-interaction-alignment.md) |
| **Scene correctness (REQUIRED): door-in-wall, chair-faces-desk, no-clip, rests-on, ball-at-foot** | [reference/18-scene-correctness.md](reference/18-scene-correctness.md) |
| **Correctness catalogue + how to reach exhaustiveness (the rule generator)** | [reference/19-correctness-catalogue.md](reference/19-correctness-catalogue.md) |
| **Temporal correctness (animation-time): foot-skate, detach, pops, loop seam** | [reference/20-temporal-correctness.md](reference/20-temporal-correctness.md) |
| Procedural geometry: BufferGeometry, extrude/lathe, CSG booleans | [reference/06-procedural-geometry.md](reference/06-procedural-geometry.md) |
| Noise, heightmap terrain, erosion, marching cubes, chunked LOD | [reference/07-terrain-noise.md](reference/07-terrain-noise.md) |
| Scattering vegetation/props, InstancedMesh, surface sampling, BVH | [reference/08-scattering-instancing.md](reference/08-scattering-instancing.md) |
| Performance: draw calls, instancing, LOD, KTX2/Draco, profiling | [reference/09-performance.md](reference/09-performance.md) |
| **Visual QA: screenshot → critique → fix loop + perf gate (see your render)** | [reference/16-visual-qa.md](reference/16-visual-qa.md) |
| **Autonomous build→see→fix loop: iterate a scene to the AAA rubric on its own** | [reference/17-autonomous-loop.md](reference/17-autonomous-loop.md) |
| **Zero-cost pipeline: no paid APIs, procedural + free CC0 + free local tools** | [reference/13-zero-cost-assets.md](reference/13-zero-cost-assets.md) |
| AI asset generation (optional/paid): text/image-to-3D, AI textures, HDRI, licensing | [reference/10-ai-asset-generation.md](reference/10-ai-asset-generation.md) |
| AI characters: auto-rig, mocap, text-to-motion, audio-to-face, MediaPipe | [reference/11-ai-characters-motion.md](reference/11-ai-characters-motion.md) |
| Toward true AAA: GPU-driven rendering, web-Nanite, streaming, FSR, GI, scale | [reference/12-advanced-rendering-scale.md](reference/12-advanced-rendering-scale.md) |

## Bundled scripts (execute, don't read into context)

All paths are relative to this skill. Use `${CLAUDE_SKILL_DIR}/scripts/...` so they
resolve regardless of install location. Each prints `--help`.

- **Scaffold a new game** — copies the runnable AAA starter into a target directory:
  ```bash
  node ${CLAUDE_SKILL_DIR}/scripts/scaffold.mjs <target-dir> [--name my-game]
  ```
- **Convert a Mixamo character** — FBX → optimized GLB (Meshopt/Draco, merged clips).
  Requires Node ≥18 and network/CLI access; prints exact steps if a tool is missing:
  ```bash
  node ${CLAUDE_SKILL_DIR}/scripts/convert-character.mjs ./char.fbx ./public/character.glb
  ```
- **Generate a procedural object** — emits a `.glb` from a JSON spec (box/cylinder kit,
  CSG booleans, greebles) for quick props:
  ```bash
  node ${CLAUDE_SKILL_DIR}/scripts/procgen.mjs --spec ./prop.json --out ./public/prop.glb
  ```
- **Model CURVED/ORGANIC objects (meshkit — Blender ops as data)** — lathe/sweep/loft/extrudePoly
  (+bevel, concave ok)/Loop-subdivision cages/seeded-noise displace, all under the closed-manifold +
  positive-volume contract, exportable to standard `.glb` (loads in Blender/Unity/any engine). See
  `reference/40`:
  ```bash
  node ${CLAUDE_SKILL_DIR}/scripts/verify-meshkit.mjs                      # the contract harness
  node ${CLAUDE_SKILL_DIR}/scripts/meshkit-export.mjs --demo trophy --out trophy.glb
  node ${CLAUDE_SKILL_DIR}/scripts/meshkit-export.mjs --spec model.json --out model.glb
  ```
- **Fetch a free CC0 asset** — HDRIs and full PBR texture sets from Poly Haven. **Free, no API
  key, no cost** — the default asset path:
  ```bash
  node ${CLAUDE_SKILL_DIR}/scripts/fetch-cc0.mjs --hdri kloofendal_48d_partly_cloudy --res 2k --out ./public/env.hdr
  node ${CLAUDE_SKILL_DIR}/scripts/fetch-cc0.mjs --texture rock_boulder_dry --res 2k --out-dir ./public/textures/rock
  ```
- **Verify a character↔object interaction** — checks orientation, reach, hand-on-target, feet on
  ground; `--selftest` proves the procedural-animation + IK + alignment math (free, zero deps):
  ```bash
  node ${CLAUDE_SKILL_DIR}/scripts/verify-interaction.mjs --selftest
  node ${CLAUDE_SKILL_DIR}/scripts/verify-interaction.mjs --spec ./interaction.json
  ```
- **Validate scene placement correctness (REQUIRED)** — checks door-in-wall, chair-faces-desk,
  sit pose, furniture-not-through-wall, plant-on-table, ball-at-foot-not-through-body, structure
  orientation; `--selftest` proves the rules (free, zero deps). Declare relationships, don't rely
  on the user to catch placement bugs:
  ```bash
  node ${CLAUDE_SKILL_DIR}/scripts/verify-scene.mjs --selftest
  node ${CLAUDE_SKILL_DIR}/scripts/verify-scene.mjs --spec ./scene.json
  ```
- **Validate animation-time correctness** — samples an animation across frames for foot-skate,
  object detachment mid-motion, pops/teleports, loop-seam hitches, impossible speed, foot-plant
  phase (catches what a single frame can't):
  ```bash
  node ${CLAUDE_SKILL_DIR}/scripts/verify-temporal.mjs --selftest
  node ${CLAUDE_SKILL_DIR}/scripts/verify-temporal.mjs --spec ./sequence.json
  ```
- **Make a moving character not slide (REQUIRED for locomotion)** — `engine/locomotion.js`
  `matchCadence()` ties clip phase to distance travelled (legs cycle at ground speed) and
  `engine/foot-lock.js` `FootLockIK` pins the planted foot (root-motion clips barely push, so
  cadence alone still smears). Proven on a real Mixamo rig in `examples/soldier-volley`
  (planted-foot slip 0.15 → 0 m/frame). See `reference/21`:
  ```bash
  node ${CLAUDE_SKILL_DIR}/scripts/verify-locomotion.mjs   # self-test the cadence math
  ```
- **Give a character good controls (the point of a game)** — `engine/character-controller.js` turns a
  world-space move vector (keyboard/gamepad, camera-relative) into correct movement: the model faces
  where it moves (no moonwalk — the Mixamo Soldier's forward is −Z; verify `dot(forward,velocity)>0`),
  run/idle blends by speed, cadence tracks ground speed, and the planted foot is locked. Shots aim along
  `ctrl.forward()`. All facing/heading/control-signal transforms route through one source of truth,
  `engine/world-basis.js` (`WORLD`), so sign conventions can't drift. Playable demo: `examples/showcase`
  → **Contrôles**. See `reference/22`:
  ```bash
  node ${CLAUDE_SKILL_DIR}/scripts/verify-worldbasis.mjs   # self-test the direction transforms + moonwalk case
  ```
- **Real collisions + AI opponents** — `engine/physics.js` wraps Rapier (ground, static/dynamic bodies, a
  kinematic capsule character that can't clip walls, climbs steps, pushes crates, kicks the ball) via
  `CharacterController.collide`; `engine/steering.js` (seek/flee/arrive/pursue/wander) drives NPCs through
  the *same* controller. Playable: `examples/showcase` → **Physique** (an AI opponent contests the ball).
  See `reference/23`–`24`:
  ```bash
  node ${CLAUDE_SKILL_DIR}/scripts/verify-steering.mjs     # self-test the steering behaviours
  ```
- **Blend Idle→Walk→Run properly** — `engine/anim-state-machine.js` is a 1D blend space (by speed, each
  clip cadence-synced) + discrete states with crossfades; built into `CharacterController` (pass a
  `walkClip`). Only the two neighbouring clips are ever active (partition of unity). See `reference/26`:
  ```bash
  node ${CLAUDE_SKILL_DIR}/scripts/verify-anim-fsm.mjs     # self-test the 1D blend weights
  ```
- **Generate interiors from a spec (no plan drawing)** — `engine/floorplan.js`: `{type, tier, seed}` →
  rooms/walls with doors, windows and stairs **derived** (a door = the centred shared-wall segment of two
  connected rooms — it can't be misplaced); `checkModel()` is the no-regression contract (reachability,
  passable widths, stair rules); `engine/place-builder.js` emits meshes + the SAME boxes as physics
  colliders so controls work in any room. Tiers = infrastructure levels (club t1→t5, hôtel→villa+piscine).
  See `reference/27`:
  ```bash
  node ${CLAUDE_SKILL_DIR}/scripts/verify-floorplan.mjs --seeds 30   # every type × tier × seed stays green
  ```
- **Furnish generated rooms by rules** — `engine/furnish.js` places furniture per room archetype
  (bedroom/bathroom/living/kitchen/office/locker/gym/press-conference room — sponsor backdrop + podium
  with mics + press rows facing it…) obeying against-wall + facing + door-clearance rules;
  `checkFurnishing()` re-verifies independently (chair-faces-desk, nothing blocks a door, backdrop
  BEHIND the podium); `engine/furniture-kit.js` builds the meshes + colliders. See `reference/28`:
  ```bash
  node ${CLAUDE_SKILL_DIR}/scripts/verify-furnish.mjs --seeds 20
  ```
- **Generate a stadium + club identity** — `engine/stadium.js` (tier 1 champêtre → tier 5 moderne, the
  directors' loge + terrace as playable FM-view vantages, sightline contract) + `engine/club-theme.js`
  (colors/crest/jerseys applied to seats, walls, offices). Club places get glass offices facing their
  training pitches. See `reference/29`:
  ```bash
  node ${CLAUDE_SKILL_DIR}/scripts/verify-stadium.mjs
  ```
- **Assemble the career world (multi-site)** — `engine/career.js`: ONE number (the club level 1..4) →
  home + training centre + stadium, tiers/offsets/travel-pads/spawns all DERIVED (offsets from the real
  footprints, pads from the derived entrances, the loge terrace door from the stadium model); the same
  character/controls walk all of it (fast-travel = kinematic teleport). `checkCareer()` re-runs every
  site contract + world checks (no overlap, travel graph connected, pads walkable). Playable:
  `examples/showcase` → **Carrière** (`?niveau=1..4`). See `reference/32`:
  ```bash
  node ${CLAUDE_SKILL_DIR}/scripts/verify-career.mjs --seeds 8
  ```
- **Play football, not football-shaped animation** — `engine/ball.js` (drag + drag crisis + Magnus +
  spin-coupled bounce), `engine/dribble.js` (dribbling as a sequence of *touches*, the ball free in
  between), `engine/ball-predict.js` (prediction + **inverse ballistics**: solve the strike so the pass
  arrives ON the man at a playable pace; lane clearance; interception points), and
  `engine/rondo.js` + `rondo-sim.js` (a 5v5 possession game where players do a **job** instead of
  chasing the ball — the whole match is decided headless, the scene only dresses it). Dressed by
  `engine/stadium-night.js` (floodlights, one pitch-fitted shadow), `engine/render-pipeline.js`
  (low/high/ultra post chain) and `engine/kit.js` (shirt/shorts/socks generated on the rig). Playable:
  `examples/showcase` → **Rondo** (`?seed=…&q=low|high|ultra`). See `reference/45` and `reference/46`:
  ```bash
  node ${CLAUDE_SKILL_DIR}/scripts/verify-ball.mjs && node ${CLAUDE_SKILL_DIR}/scripts/verify-dribble.mjs
  node ${CLAUDE_SKILL_DIR}/scripts/verify-ball-predict.mjs && node ${CLAUDE_SKILL_DIR}/scripts/verify-rondo.mjs
  node ${CLAUDE_SKILL_DIR}/scripts/verify-matchday.mjs   # kit on the rig, night rig, post-chain contract
  # the domain rules themselves — what CANNOT happen in football. Generated from a relationship ×
  # phase grid rather than remembered, which is why its first run found six violations in a game
  # whose own contract was green: the ball was struck from BEHIND the player 65% of the time.
  node ${CLAUDE_SKILL_DIR}/scripts/verify-football-rules.mjs
  ```
- **Cast a whole team from arbitrary Mixamo GLBs** — `engine/squad.js`: a scene should not know which
  file it is casting. A roster normalises the four things two real exports never agree on — FACING
  (a +Z bind rides inside a yawed wrapper so the controller's one forward still holds), SCALE
  (normalised to a target height, or one team towers over the other), CLIPS (most character GLBs ship
  with none: one rig is the DONOR and its locomotion is retargeted onto the rest) and ATTRIBUTES
  (`KHR_mesh_quantization` needs dequantizing or skinning reads garbage) — then hands the scene a
  `spawn()`. `checkSquad` measures facing off the shoulders rather than trusting the flag. See
  `reference/44` and `reference/46`:
  ```bash
  node ${CLAUDE_SKILL_DIR}/scripts/verify-squad.mjs
  ```
- **Tell two teams apart when the character cannot be recoloured** — `engine/bib.js`. A bought or
  scanned character usually shares ONE atlas and ONE material between shirt, skin and boots, so
  tinting the shirt tints the player. Regenerating a full kit gets you lofted tubes that read as
  lofted tubes. A CHASUBLE is what the situation actually calls for and what a training ground
  actually uses: sleeveless, collarless, one colour, skinned onto the same skeleton (bind = now,
  identity bind matrix, `bindMode: 'attached'`), cut from the RIG's own measurements so it fits the
  next character too. `checkBib` asserts it is a bib and not a shirt — hem at the waist, top at the
  chest, no sleeves, normalised weights, valid bone indices, and **positive signed volume**, the
  clause that catches an inside-out loft (a `+sin` instead of a `−sin` in one ring flips the whole
  mesh, and from the front it just looks slightly wrong):
  ```bash
  node ${CLAUDE_SKILL_DIR}/scripts/verify-bib.mjs
  ```
  **…but check the file before you build a garment.** A bib is the right answer only when the shirt
  genuinely cannot be addressed on its own. MEASURE THAT FIRST: in three.js the material is an
  attribute of the DRAW CALL, so if the shirt is its own mesh — which it very often is, even when the
  whole character shares one atlas and one material — cloning that mesh's material and setting
  `.color` recolours the shirt and **cannot** reach the skin. `shanon.glb` turned out to have 7 meshes
  for 2 materials, with `Ch38_Shirt` already separate; the bib was built to work around a premise that
  a two-minute inspection would have refuted. `engine/part-tint.js` is that tool, and its contract's
  load-bearing clause is not "the shirt changed colour" but "the tinted material is shared with
  nothing else", which is a structural proof rather than a visual one. Use `.color` (it MULTIPLIES the
  map) rather than replacing the texture, so folds, seams, crest and baked AO survive — a flat fill
  gives the right colour and a cardboard garment:
  ```bash
  node ${CLAUDE_SKILL_DIR}/scripts/verify-part-tint.mjs
  ```
- **Make an action have a beginning and an end** — `engine/gesture.js`. THE difference between a game
  and an illustrated simulation. The usual shape is: the sim strikes the ball, then asks the character
  for a pose — so the animation *comments on* the ball instead of producing it, and the only way to
  keep boot and ball together is to start the clip at its contact frame, which throws away the entire
  backswing. The result reads as "you can't even see the movement", because you are watching the
  second half of a gesture whose first half was deleted. Invert it: the actor COMMITS to a gesture,
  the swing runs on its own clock, and the ball leaves at the clip's own contact frame.
  `anticipation → contact → follow-through`, with three rules the contract enforces — the ball leaves
  at contact and nowhere else; the actor is committed from the first frame (he does not re-decide, and
  he *can be tackled mid-swing*, which is what makes pressing worth doing); and a gesture runs to its
  own end or is interrupted with a NAMED cause. Two things to get right when wiring it: the windup must
  be **carved out of** the time he already had, not added to it (adding it doubled turnovers), and it
  must be the chosen gesture's own anticipation, not an average — a pivot pass winds up for 0.52 s and
  a lay-off for 0.16:
  ```bash
  node ${CLAUDE_SKILL_DIR}/scripts/verify-gesture.mjs
  ```
- **Capture the render + see it** — screenshot a build in headless Chromium and read a perf
  snapshot, then Read the PNG to critique it against the AAA rubric (`reference/16`). Free
  (Playwright/Chromium pre-installed in the Claude Code env):
  ```bash
  npm run build && node ${CLAUDE_SKILL_DIR}/scripts/capture.mjs --dir ./dist --out shot.png --webgl --max-draws 100
  # then: Read shot.png → critique → fix → repeat
  # …and MEASURE it, so "too dark" / "looks like daytime" is a number, not taste. A night scene once
  # shipped with every light contract green and rendered a bright afternoon; this catches that in one
  # line. (Read the PNG back — a WebGPU canvas reads as transparent black in-page.)
  node ${CLAUDE_SKILL_DIR}/scripts/frame-stats.mjs shot.png --preset night
  ```
- **Live play mode (the agent editor)** — an MCP server that keeps ONE game session alive in headless
  Chromium: `play_open/state/screenshot/eval/perf/close` — teleport, act, capture in seconds instead
  of rebuild+relaunch minutes. Register in the project's `.mcp.json`; pair with `?debug=1` gizmos
  (`engine/debug-gizmos.js`: collider wireframes, interaction rings, routes, live inspector panel —
  works on the deployed site for human eyes too). See `reference/39`:
  ```json
  { "mcpServers": { "playmode": { "command": "node", "args": ["skills/threejs-aaa/scripts/playmode-mcp.mjs"] } } }
  ```
- **Generate an AI 3D asset (OPTIONAL / paid)** — text/image → 3D via the Meshy API. Only if you
  choose to pay; needs `MESHY_API_KEY`. Prefer procedural + CC0 (above) for zero cost:
  ```bash
  node ${CLAUDE_SKILL_DIR}/scripts/gen-asset.mjs --prompt "a mossy stone well" --out ./public/well.glb --optimize
  ```

## Default tech decisions (the AAA baseline)

Apply these unless the user asks otherwise. Rationale and alternatives are in the references.

- **Renderer:** `WebGPURenderer` from `three/webgpu` with automatic WebGL2 fallback.
  `await renderer.init()` before the first render. Pin `three@^0.185`.
- **Color/tone:** `THREE.ColorManagement.enabled = true`, `outputColorSpace = SRGBColorSpace`,
  tone mapping **AgX** (realism) or **ACES Filmic** (cinematic game look); tune exposure.
- **Lighting:** HDRI via `RGBELoader` → `PMREMGenerator` → `scene.environment` does most of
  the work. Add one `DirectionalLight` sun (+ CSM outdoors). Keep ≤3 dynamic lights.
- **Materials:** `MeshStandardNodeMaterial` baseline; `MeshPhysicalNodeMaterial` selectively
  for clearcoat / transmission / sheen / iridescence / anisotropy. Full PBR texture sets
  with correct color spaces (albedo/emissive = sRGB; normal/roughness/metal/AO = linear).
- **Shadows:** `PCFSoftShadowMap`; CSM for large outdoor scenes; accumulated/baked shadows
  for static hero shots.
- **Post:** WebGPU → built-in TSL `PostProcessing` node stack (GTAO → bloom → DOF →
  SMAA/TAA → LUT grade → vignette). SSR is experimental — gate it behind a quality flag.
- **Performance:** `InstancedMesh`/`BatchedMesh`, `THREE.LOD`, Meshopt/Draco geometry, KTX2
  textures, `glTF-Transform` asset pipeline, **target < 100 draw calls**, dispose discipline.
- **Architecture:** vanilla Three.js (the starter) for engine-grade control and custom TSL.
  Mention `react-three-fiber` + `drei` as an option for declarative/indie projects.
- **Determinism:** never `Math.random()` for procedural content — use a seeded PRNG
  (`pure-rand` or an inline mulberry32) and derive independent sub-seeds per subsystem.
- **Zero cost is the default (no paid APIs).** Get past "no art" for free: Claude writes the
  **procedural** geometry/shaders (infinite, free), pulls **CC0 assets** from free no-key APIs
  (`fetch-cc0.mjs` → Poly Haven/ambientCG HDRIs + PBR textures), rigs with free **Mixamo/AccuRIG**,
  and does live capture with free in-browser **MediaPipe** — all inside the Pro/Max plan. See
  `reference/13`. Paid generators (Meshy/Tripo/Rodin, `reference/10`) are **opt-in only**.
- **AI-generated assets (optional/paid):** if you *choose* to pay, orchestrate text/image-to-3D or
  self-host open models for free on your own GPU (TRELLIS/TripoSR). Always run the **game-ready
  cleanup** (retopo/optimize → KTX2/Meshopt GLB). **Check licensing** (`reference/10` table): some
  open models exclude the EU; text-to-motion datasets are non-commercial.
- **Pushing real AAA scale:** browsers have no mesh shaders / hardware RT / sparse textures, so the
  wins are KTX2 textures, dynamic-resolution + FSR1, GPU-driven culling (`BatchedMesh` + compute +
  indirect draws), meshopt LOD streaming, and baked GI — not brute force. See `reference/12`.

## Build workflow checklist

A repeatable order for standing up an AAA scene. Tick each as you go.

- [ ] Scaffold the project (`scaffold.mjs`) or confirm an existing engine structure.
- [ ] Renderer + color management + tone mapping + resize handling. (`reference/02`)
- [ ] HDRI environment (IBL) + sun + shadow setup. (`reference/02`)
- [ ] Ground/terrain — flat, heightmap, or procedural. (`reference/07`)
- [ ] Materials with full PBR maps and correct color spaces. (`reference/02`, `03`)
- [ ] Characters: convert (`convert-character.mjs`), load, clone with `SkeletonUtils`,
      build the animation state machine + physics controller. (`reference/05`)
- [ ] Procedural props / scatter vegetation with instancing. (`reference/06`, `08`)
- [ ] Post-processing stack. (`reference/04`)
- [ ] Performance pass: instancing, LOD, compression, draw-call budget. (`reference/09`)
- [ ] Verify in the browser; check `renderer.info.render.calls` and frame time.

## Critical gotchas (the ones agents get wrong)

- **Don't mix import paths.** Use `three/webgpu` (renderer + `*NodeMaterial`) and
  `three/tsl` (nodes) together; do not also import from bare `three` for the same objects.
- **`await renderer.init()`** is mandatory on WebGPURenderer or you get silent black frames.
- **Skinned mesh cloning:** use `SkeletonUtils.clone(model)`, never `Object3D.clone()`
  (clones share the original skeleton and all animate identically).
- **Color spaces:** only albedo/emissive maps are sRGB; all data maps (normal/roughness/
  metalness/AO/displacement/heightmap) stay linear (`NoColorSpace`). Wrong = washed out.
- **Recompute after editing geometry:** `computeVertexNormals()` + `computeBoundingSphere()`
  after displacing vertices, or lighting and culling break.
- **`ShaderMaterial` / `onBeforeCompile` don't run on WebGPURenderer** — author shaders in TSL.
- **Mixamo FBX imports at 0.01 scale**; bone separator `:` gets mangled across loaders —
  normalize bone names. `SkeletonUtils.retargetClip` is unreliable across rigs — prefer the
  manual rest-pose retarget recipe in `reference/05`.
- **Dispose** geometries, materials, textures, and render targets you discard.
- **Own spatial correctness — it's the skill's job, not the user's.** Whenever you place objects or
  characters, declare the intended relationships (door in the wall opening, chair facing the desk,
  hips on the seat, furniture not through walls, plant on the table not through it, ball at the foot
  not through the body, a structure facing the right way) and validate with `verify-scene.mjs` /
  `scene-validate.js`, then apply the suggested fixes. Never rely on the user to notice that a door
  floats or a goal is backwards. See `reference/18`.

## When an MCP server instead of this skill?

This skill is procedural knowledge + local scripts — the right tool for "help me build a
Three.js game." Reach for an MCP server only if you need a live runtime connector (a remote
asset-library API, a build/playtest farm, a telemetry backend). The two can coexist.
