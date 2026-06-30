# Project Setup & Engine Architecture

Table of contents
- [Stack & versions](#stack--versions)
- [Create a project](#create-a-project)
- [package.json](#packagejson)
- [Vite config](#vite-config)
- [Engine architecture](#engine-architecture)
- [The starter project](#the-starter-project)
- [Asset pipeline tooling](#asset-pipeline-tooling)

## Stack & versions

Verified current on 2026-06-30. Pin majors; Three.js addons are not semver-stable.

| Package | Version | Purpose |
|---|---|---|
| `three` | `^0.185.0` | Engine. Use `three/webgpu` + `three/tsl` entry points. |
| `vite` | `^6` | Dev server + bundler. Instant HMR, ESM. |
| `lil-gui` | `^0.20` | Debug/tweak panel. |
| `stats-gl` | `^3` | FPS/CPU/GPU overlay (WebGL **and** WebGPU). |
| `simplex-noise` | `^4.0.3` | Noise (pass your own seeded PRNG). |
| `pure-rand` | `^8` | Seeded, reproducible PRNG (best-maintained). |
| `three-mesh-bvh` | `^0.9.10` | Accelerated raycasting / spatial queries. |
| `three-bvh-csg` | `^0.0.18` | Boolean geometry (needs `three-mesh-bvh`). |
| `@dimforge/rapier3d-compat` | latest | WASM physics for character controllers. |
| `poisson-disk-sampling` | `^2.3.1` | Natural object scatter. |

Optional / context-specific: `@react-three/fiber` + `@react-three/drei` (declarative React stack), `postprocessing` (`^6.39`, only for the **WebGL** post path), `@pixiv/three-vrm` (VRM avatars), `rot-js` (dungeons), `@gltf-transform/cli` (asset optimization, install globally or as devDep).

## Create a project

Prefer the bundled scaffold — it produces the runnable engine described below:

```bash
node ${CLAUDE_SKILL_DIR}/scripts/scaffold.mjs ./my-game --name my-game
cd my-game && npm install && npm run dev
```

Manual route:

```bash
npm create vite@latest my-game -- --template vanilla
cd my-game
npm install three@^0.185 lil-gui stats-gl simplex-noise pure-rand
npm install -D vite
```

## package.json

```json
{
  "name": "my-game",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

## Vite config

WebGPU/TSL needs no special loader, but exclude WASM-heavy deps from pre-bundling and
allow top-level await for Rapier:

```js
// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: { target: 'esnext' },           // top-level await, modern output
  optimizeDeps: { exclude: ['@dimforge/rapier3d-compat'] },
  server: { host: true },                // expose on LAN for device testing
});
```

## Engine architecture

Keep a thin, composable engine. The starter separates **engine** (reusable systems) from
**game** (your content). Recommended modules:

```
src/
├── main.js                 # entry: build engine, load scene, start loop
├── engine/
│   ├── Engine.js           # owns renderer, scene, camera, clock, loop, resize
│   ├── Renderer.js         # WebGPURenderer + color mgmt + tone mapping
│   ├── Lighting.js         # HDRI/IBL (PMREM), sun, ambient
│   ├── Shadows.js          # shadow-map config / CSM hook
│   ├── PostFX.js           # TSL PostProcessing node stack
│   ├── Assets.js           # GLTF/KTX2/Draco/Meshopt loaders, caching
│   ├── Input.js            # keyboard/mouse/gamepad state
│   └── rng.js              # seeded PRNG + sub-seed derivation
└── game/
    ├── World.js            # ground/terrain, environment, props
    ├── Character.js        # model + AnimationMixer + state machine
    └── CharacterController.js  # physics capsule + movement + camera
```

Principles:
- **One render loop** driven by `THREE.Clock` delta. Pass `dt` to every `update(dt)`.
- **Async boot**: `await renderer.init()`, then `await` all asset loads, then start the loop.
- **Dispose discipline**: every system exposes `dispose()` that frees geometries, materials,
  textures, and render targets it created.
- **Data-driven config**: a single `config` object (quality tier, exposure, post toggles) so
  you can expose it via `lil-gui` and ship low/medium/high presets.

## The starter project

`assets/starter/` is a complete, runnable implementation of the architecture above
(WebGPU renderer, IBL, shadows, TSL post-processing, an orbit demo + procedural ground).
`scripts/scaffold.mjs` copies it. Read those files for concrete, current patterns — they are
the canonical reference implementation for this skill and are kept in sync with the docs.

## Asset pipeline tooling

`glTF-Transform` is the modern optimizer (Don McCurdy). Install and use it for every shipped
model:

```bash
npm i -g @gltf-transform/cli
# Geometry + animation compression (best for animated characters):
gltf-transform meshopt in.glb out.glb
# Or Draco (best ratio for static geometry):
gltf-transform draco in.glb out.glb
# Quantize + dedup + prune:
gltf-transform optimize in.glb out.glb --texture-compress ktx2
```

Do **not** double-compress (Draco *or* Meshopt, not both). Textures → KTX2 + Basis
(`--texture-compress ktx2`): stays GPU-compressed, ~10× VRAM reduction. UASTC for
normal/data maps (quality), ETC1S for albedo (size).
