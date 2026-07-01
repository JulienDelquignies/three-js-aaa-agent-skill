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

## Notes on sources & versions

All package versions in the references were verified against the npm registry on 2026-06-30
and are pinned by major. Three.js addon APIs are not semver-stable — pin `three` and re-check
import paths after upgrades. Two commercial caveats flagged in the docs: **LYGIA** is
non-commercial by default (needs a commercial/patron license to ship), and **`three-bvh-csg`**
is pre-1.0 (pin it). License: MIT.
