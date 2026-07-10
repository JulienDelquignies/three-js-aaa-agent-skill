# Three.js AAA Game Toolkit — Claude Code Skill

A Claude Code **skill** (packaged as a plugin) that helps AI coding agents build
**AAA-quality 3D games in Three.js**: production rendering, procedural worlds, and
Mixamo-rigged animated characters. It bundles distilled, version-verified reference docs,
executable helper scripts, and a runnable starter project.

Targets the modern (2026) stack: `three@^0.185`, **WebGPURenderer** with automatic WebGL2
fallback, **TSL** shaders, node-based post-processing, and the Mixamo → glTF pipeline.

## What's inside

```
threejs-aaa/ (the skill)
├── SKILL.md                  navigation hub + default tech decisions + workflow checklist
├── reference/                load-on-demand domain docs (verified APIs & versions)
│   ├── 01-project-setup.md   deps, engine architecture, asset pipeline
│   ├── 02-rendering.md        WebGPU, PBR, HDRI/IBL, tone mapping, shadows
│   ├── 03-materials-shaders.md  TSL, procedural & node materials, triplanar
│   ├── 04-post-processing.md  bloom, GTAO, SSR, DOF, TAA/SMAA, color grade
│   ├── 05-characters-mixamo.md  Mixamo pipeline, AnimationMixer, FSM, physics, IK
│   ├── 06-procedural-geometry.md  BufferGeometry, extrude/lathe, CSG, L-systems, WFC
│   ├── 07-terrain-noise.md    noise, heightmaps, erosion, marching cubes, chunked LOD
│   ├── 08-scattering-instancing.md  InstancedMesh, surface sampling, BVH, grass
│   ├── 09-performance.md      draw calls, LOD, KTX2/Draco, profiling, quality tiers
│   ├── 10-ai-asset-generation.md   (optional/paid) text/image-to-3D, AI textures/HDRI, licensing
│   ├── 11-ai-characters-motion.md  AI auto-rig, mocap, text-to-motion, audio-to-face, MediaPipe
│   ├── 12-advanced-rendering-scale.md  GPU-driven rendering, web-Nanite, streaming, FSR, GI
│   ├── 13-zero-cost-assets.md  NO paid APIs: procedural + free CC0 libraries + free local tools
│   ├── 14-procedural-animation.md  springs, damping, two-bone IK, look-at, foot IK
│   ├── 21-locomotion-no-footskate.md  moving characters that don't slide: cadence-sync + foot-lock IK + follow camera
│   ├── 22-character-controller.md  controls: input→facing (no moonwalk) + run/idle + no-slide, camera-relative, gamepad
│   ├── 23-physics-rapier.md    physics & collisions (Rapier): kinematic character, static/dynamic bodies, kick/push
│   ├── 24-ai-steering.md       AI opponents: steering (seek/flee/arrive/pursue/wander) driving the CharacterController
│   ├── 25-particles.md         particles (juice): pooled instanced additive bursts — run dust, kick sparks, impacts
│   ├── 26-anim-state-machine.md  animation FSM: Idle→Walk→Run 1D blend (cadence-synced) + discrete states + crossfades
│   ├── 27-procedural-places.md  interiors from a spec: doors/stairs derived, tiers, no-regression contract
│   ├── 28-furnishing.md        rule-based furniture: archetype recipes, facing/clearance rules, re-verifiable
│   ├── 29-stadiums-theming.md  parametric stadiums (tiers, loge+terrace FM view, sightline) + club identity theming
│   ├── 30-interactables.md     playable interactions: doors that block/open, sit, pick up/carry, prompts
│   ├── 31-interior-camera-lighting.md  indoor playability: camera occlusion + per-room lights & switches
│   ├── 32-career-world.md      career world: home+club+stadium derived from one level, fast-travel, contract
│   ├── 33-venues-encounters.md venues & encounters: restaurant grammar, meeting-table contract, seated NPC
│   ├── 34-city-layer.md        derived city: Dijkstra streets, drivable routes, level-scaled skyline
│   ├── 35-diegetic-ui.md       diegetic UI: phone overlay, FM data layer, one city rendered 3D and 2D
│   ├── 36-dealership.md        dealership: showroom grammar, derived catalogue, buy loop, GLB car
│   ├── 37-transport-tiers.md   transport tiers + interiors: bus matchday ride, walkable cabins, scouting
│   ├── 38-vacation-resort.md   vacation resort: derived beach/villa/palms, loungers face the sea, forme loop
│   ├── 39-agent-editor.md      agent editor: play-mode MCP (live session tools) + ?debug=1 gizmos overlay
│   ├── 15-interaction-alignment.md  character↔object interaction + correctness verification
│   ├── 18-scene-correctness.md  REQUIRED spatial rules: door-in-wall, no-clip, rests-on, ball-at-foot
│   ├── 19-correctness-catalogue.md  exhaustiveness generator + full rule catalogue by relationship
│   ├── 20-temporal-correctness.md  animation-time pass: foot-skate, detach, pops, loop seam, phase
│   ├── 16-visual-qa.md        screenshot → critique → fix loop + draw-call perf gate
│   └── 17-autonomous-loop.md  agent-driven build→see→fix loop to the AAA rubric (demonstrated)
├── scripts/                  executable helpers (run, don't read)
│   ├── scaffold.mjs          create a new game from the starter
│   ├── convert-character.mjs Mixamo/FBX → optimized GLB
│   ├── procgen.mjs           generate a procedural prop GLB (zero deps)
│   ├── fetch-cc0.mjs         download free CC0 HDRIs + PBR textures (Poly Haven, no key)
│   ├── verify-interaction.mjs validate character↔object interaction; --selftest proves the math
│   ├── verify-scene.mjs       validate scene placement correctness (door/chair/clip/rests-on/foot)
│   ├── verify-temporal.mjs    validate animation-time correctness (skate/detach/pops/loop/phase)
│   ├── verify-locomotion.mjs  self-test the no-foot-skate cadence math (matchCadence/estimateStride)
│   ├── verify-worldbasis.mjs  self-test the gameplay-direction ↔ world-axis transforms (facing/heading/no-moonwalk)
│   ├── verify-steering.mjs    self-test the AI steering behaviours (seek/flee/arrive/pursue/wander)
│   ├── verify-anim-fsm.mjs    self-test the animation state machine's 1D blend weights (partition of unity)
│   ├── verify-floorplan.mjs   no-regression harness for procedural places (all types × tiers × seeds)
│   ├── verify-furnish.mjs     no-regression harness for rule-based furnishing (clearances, facing, overlaps)
│   ├── verify-stadium.mjs     no-regression harness for parametric stadiums (sightline, loge, capacity by tier)
│   ├── verify-career.mjs      no-regression harness for the multi-site career world (overlap, travel graph, pads)
│   ├── verify-city.mjs        no-regression harness for the derived city (routes on streets, connectivity, density)
│   ├── verify-gamestate.mjs   FM data layer: deterministic roster/budget, message flow
│   ├── verify-dealership.mjs  dealership catalogue: level gating, ascending prices, buy flow
│   ├── verify-cabin.mjs       vehicle interiors: aisle at the real capsule gauge, facing rules
│   ├── verify-beach.mjs       vacation resort: sea after the sand, loungers face the sea, palms clear
│   ├── playmode-mcp.mjs       MCP server: persistent live game session (open/state/screenshot/eval/perf)
│   ├── capture.mjs           headless screenshot + perf snapshot (the visual-QA loop)
│   └── gen-asset.mjs         (optional/paid) AI text/image-to-3D → game-ready GLB (Meshy)
└── assets/starter/           a complete, runnable WebGPU + IBL + post-processing project

examples/
├── showcase/                 a scene gallery (multi-page): home page → live previews of every scene
│                             LIVE: https://threejs-aaa-showcase.vercel.app  (WebGPU + WebGL2 fallback)
└── soldier-volley/           runnable demo: a REAL Mixamo-rigged character (Soldier.glb) runs in
                              (no foot-skate: cadence-sync + foot-lock IK) chasing a rolling ball and
                              volleys into the net, with a follow camera + temporal validation on the bones
```

## Capabilities

- **AAA rendering** — WebGPU/TSL, PBR (clearcoat/transmission/sheen/iridescence/anisotropy),
  HDRI image-based lighting, AgX/ACES tone mapping, soft + cascaded shadows, a modern
  post-processing stack (bloom, GTAO, DOF, TAA/SMAA, LUT color grading).
- **Procedural content** — BufferGeometry authoring, CSG booleans (`three-bvh-csg`), noise &
  fBm terrain, hydraulic/thermal erosion, marching cubes / surface nets, L-systems, WFC,
  reproducible seeded generation, instanced scattering, and GPU grass.
- **Animated characters** — the full Mixamo → glTF pipeline, `SkeletonUtils` cloning,
  `AnimationMixer` blending/additive, an explicit animation state machine, Rapier physics
  capsule controllers, IK (foot/look-at), morph-target facial animation, and VRM.
- **Performance** — instancing/batching, LOD, Draco/Meshopt + KTX2 compression via
  glTF-Transform, draw-call budgeting, and device quality tiers.
- **Closing the perception loop (visual QA)** — the agent screenshots its own build in headless
  Chromium, reads the image back, and critiques it against an AAA rubric (exposure, IBL, materials,
  shadows, AA, banding), then fixes and repeats — plus a draw-call perf gate for CI. Free
  (Playwright/Chromium pre-installed). This is what makes "AAA-perfect renders" iteratively reachable
  instead of coded blind.
- **Procedural animation & interaction verification** — math-driven motion (springs, damping,
  two-bone IK, look-at, foot IK) and a tested validator that checks a character↔object interaction
  is correct (orientation, reach, hand-on-target, feet grounded) — runnable at runtime and in CI.
- **Locomotion without foot-skate (native)** — a moving character must not slide. `matchCadence()`
  ties clip phase to distance travelled so legs cycle at ground speed, and `FootLockIK` pins the
  planted foot (root-motion clips barely push, so cadence alone still smears). Proven on the real
  Mixamo Soldier rig: planted-foot slip **0.15 → 0 m/frame**. Cadence math self-tests with zero deps.
- **Character controller / controls (native)** — the point of a game, as three composable modules:
  `CharacterController` (faces where it moves — no moonwalk — run/idle blend, cadence-synced, foot-locked,
  **sprint + jump**, shots aim along `forward()`), `Input` (one abstraction over **keyboard + gamepad +
  mouse-look + touch**, auto-building an on-screen joystick + buttons on phones), and `ThirdPersonCamera`
  (a **steerable** follow camera — orbit/zoom — whose heading makes movement camera-relative). Playable in
  the live gallery (**Contrôles** — run, look, sprint, jump, dribble, shoot; keyboard/gamepad/touch).
- **Physics & collisions (native, Rapier)** — `engine/physics.js` wraps Rapier for real runtime collision:
  a ground, static/dynamic boxes, a dynamic ball, and a **kinematic capsule character** (auto-step,
  snap-to-ground, pushes dynamic bodies) that plugs into `CharacterController.collide`. The character
  can't walk through walls, climbs ramps/steps, pushes crates, and kicks the ball. Playable in the live
  gallery (**Physique**). Verified headless: walls block, crates displace, kick launches ~12 m/s.
- **AI opponents (native, steering)** — `engine/steering.js` (seek/flee/arrive/pursue/wander) drives NPCs
  through the *same* `CharacterController` as the player, so they face where they move, don't foot-skate,
  and collide via physics. The **Physique** demo has an AI opponent that intercepts and boots the ball
  away; verified headless (closes to 0.5 m, displaces the ball ~9 m). Behaviours self-test with zero deps.
- **Animation state machine (native)** — `engine/anim-state-machine.js` blends **Idle→Walk→Run** as a 1D
  space by speed (each clip cadence-synced to ground speed, only two neighbours ever active) plus discrete
  states + crossfades; built into `CharacterController` (pass a `walkClip`). Verified on the Soldier rig:
  0 → idle, 1.8 m/s → walk, 6 m/s → run, distinct poses, no foot-skate at any blend.
- **Procedural places (native)** — `engine/floorplan.js` generates interiors from a spec
  `{type, tier, seed}` (club t1→t5, hotel room→villa with pool): rooms laid out around a hub so required
  adjacencies share walls by construction, **doors/windows/stairs derived** (never hand-placed), stairs
  from real riser/going rules, output as patchable JSON gated by `checkModel()` — the no-regression
  contract, enforced across 200+ models in CI by `verify-floorplan.mjs`. `place-builder.js` emits meshes
  + identical physics colliders, so the character controls work in any generated room.
- **Furnishing (native)** — `engine/furnish.js` furnishes any generated room by archetype recipes
  (bed+nightstands+wardrobe, sofa+coffee-table+tv-facing-sofa, desk+chair-facing-desk, lockers+bench,
  gym, **salle de presse** — sponsor backdrop + podium with mics + press rows facing it, the TV shot…)
  under hard rules: against-wall, no overlaps, door/stair clearances always free, facing constraints.
  `checkFurnishing()` re-verifies independently (incl. named press rules: backdrop BEHIND the podium,
  ≥2 seats facing it); `furniture-kit.js` builds meshes + colliders. Sabotages (wardrobe in front of a
  door, chair turned away, backdrop in front of the podium) are caught by name.
- **Stadiums & club identity (native)** — `engine/stadium.js` generates stadiums by infrastructure tier
  (t1 champêtre, one low stand → t5 four two-deck roofed stands, ~13.5k seats), always with the
  **directors' loge + terrace** as playable vantage points (the "FM view") and a contract asserting an
  unobstructed sightline to the pitch. `club-theme.js` themes everything (instanced seats in club colors,
  crest, framed jerseys in offices); club buildings get **glass offices facing their training pitches**.
- **Interactables (native)** — `engine/interactables.js`: proximity prompts ("E — Ouvrir"), hinged doors
  with **kinematic physics colliders** (closed doorways really block; verified 0.5 m vs 4.5 m advance),
  `sitAt()/standUp()` procedural sitting (hips ON the seat — the sitPose rule, verified at 0.50 m on a
  0.45 m bench), and carry-in-hand (ball ≤0.13 m from the hand bone). Playable demo **Intérieur** in a
  generated club with doors, seats and a ball.
- **Indoor playability (native)** — `ThirdPersonCamera` occlusion via `Physics.raycast` (snaps in front
  of walls, eases back out; verified 8.5 m → 0.36 m with a clear head→camera segment) and
  `interior-lighting.js`: a pendant + PointLight per room with **derived wall switches** beside each door
  ("E — Allumer/Éteindre"), under an evening ambience so lighting visibly matters.
- **Career world (native)** — `engine/career.js` derives the WHOLE multi-site world from one number (the
  club level 1..4): home (hôtel→villa) + training centre (club T1→T4) + stadium, offsets computed from
  the real footprints, **travel pads derived from the entrances**, and the loge's **terrace door derived**
  in the stadium model (checkStadium fails if the terrace can't be reached on foot). `checkCareer()`
  re-runs every site contract + world checks. Playable demo **Carrière**: the same character and controls
  walk the house, the club and the loge terrace over the stands (verified headless end-to-end).
- **Particles / juice (native)** — `engine/particles.js` is a pooled instanced additive particle system
  (one draw call, no per-frame allocation) for run dust, kick sparks, impact/landing bursts, and trails.
  Wired into the **Physique** demo (sparks on kick, dust while running); feeds the bloom pass.
- **Scene correctness enforcement (the skill's job, not the user's)** — a tested spatial validator
  that catches placement bugs the way an AAA reviewer would: a door must sit in the wall opening, a
  chair must face the desk, a seated character's hips on the seat, furniture must not clip walls, a
  plant rests ON a table (not through it), a ball is at the foot (not through the body), a structure
  faces the right way. Each failure returns a suggested fix; proven by `verify-scene.mjs --selftest`.
- **Zero-cost content (no paid APIs)** — the default path: Claude writes procedural geometry/
  shaders (free, infinite), fetches **CC0 assets** from free no-key APIs (Poly Haven/ambientCG
  HDRIs + PBR textures via `fetch-cc0.mjs`), rigs with free Mixamo/AccuRIG, and does live capture
  with free in-browser MediaPipe — entirely inside a Claude Code Pro/Max plan.
- **Overcoming the "no art / browser budget" limits** — optionally orchestrating paid AI generation
  (text/image-to-3D, AI PBR textures, auto-rig + mocap + facial) or free self-hosted open models,
  with a game-ready cleanup pipeline and explicit commercial-licensing guidance; plus the realistic
  path to AAA-scale fidelity in the browser (GPU-driven rendering, KTX2/Meshopt streaming,
  dynamic-resolution + FSR1, baked GI) and an honest gap analysis vs native.

## Install

As a plugin via marketplace:

```
/plugin marketplace add JulienDelquignies/three-js-aaa-agent-skill
/plugin install threejs-aaa@threejs-aaa-marketplace
```

Or as a project skill — copy `skills/threejs-aaa/` into your repo's `.claude/skills/`.

Then ask Claude to build a Three.js game, scaffold a project, convert a Mixamo character, or
generate procedural content, and the skill activates automatically.

## Try the starter directly

```bash
node skills/threejs-aaa/scripts/scaffold.mjs ./my-game --name my-game
cd my-game && npm install && npm run dev
```

## Cahier de bord

Design notes, external watch (e.g. [GameBlocks](https://github.com/xt4d/GameBlocks)), and the roadmap
live in [`NOTES.md`](NOTES.md).

## Notes on sources & versions

All package versions in the references were verified against the npm registry on 2026-06-30
and are pinned by major. Three.js addon APIs are not semver-stable — pin `three` and re-check
import paths after upgrades. Two commercial caveats flagged in the docs: **LYGIA** is
non-commercial by default (needs a commercial/patron license to ship), and **`three-bvh-csg`**
is pre-1.0 (pin it). License: MIT.
