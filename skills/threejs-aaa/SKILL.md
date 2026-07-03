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
- **Capture the render + see it** — screenshot a build in headless Chromium and read a perf
  snapshot, then Read the PNG to critique it against the AAA rubric (`reference/16`). Free
  (Playwright/Chromium pre-installed in the Claude Code env):
  ```bash
  npm run build && node ${CLAUDE_SKILL_DIR}/scripts/capture.mjs --dir ./dist --out shot.png --webgl --max-draws 100
  # then: Read shot.png → critique → fix → repeat
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
