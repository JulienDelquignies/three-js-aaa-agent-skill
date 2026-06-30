# Three.js AAA Starter

A runnable, vanilla Three.js project wired for an AAA look: **WebGPURenderer** (auto WebGL2
fallback), **image-based lighting**, soft shadows, **AgX tone mapping**, and **TSL node
post-processing** (bloom). Runs with zero external assets — the environment is generated
procedurally and the ground is a noise-displaced plane.

## Run

```bash
npm install
npm run dev
```

Open the printed localhost URL. Drag to orbit. Open the console and inspect
`__engine.renderer.info.render.calls` to watch the draw-call budget.

> **Black screen?** WebGPU is the default. On a browser with an outdated/broken WebGPU
> implementation (some headless setups, very old Dawn builds), append **`?webgl`** to the URL
> to force the WebGL2 path — the whole pipeline (IBL, shadows, bloom) runs identically.
> Modern Chrome/Edge/Firefox and Safari 26+ run WebGPU fine.

## Layout

```
src/
├── main.js                 entry: boot engine → add world → start loop
├── engine/                 reusable systems (keep these; reuse across games)
│   ├── Engine.js           renderer/scene/camera/clock/loop/resize/stats
│   ├── Renderer.js         WebGPURenderer + color mgmt + AgX tone mapping + shadows
│   ├── Lighting.js         IBL (RoomEnvironment → swap for HDRI) + key sun
│   ├── PostFX.js           TSL PostProcessing (bloom; degrades gracefully)
│   └── rng.js              seeded PRNG + per-subsystem sub-seeds
└── game/                   your content
    └── World.js            procedural ground + PBR showcase + instanced scatter
```

## Make it yours

- **Replace the environment** with a real HDRI in `engine/Lighting.js` (RGBELoader +
  PMREMGenerator) — the single biggest visual upgrade. Source CC0 HDRIs from Poly Haven.
- **Add post effects** (GTAO, DOF, SMAA/TAA, color grade) in `engine/PostFX.js`.
- **Swap `game/World.js`** for your scene; the engine stays as-is.
- **Add characters** (Mixamo → GLB, AnimationMixer, state machine) and **physics** (Rapier)
  — see the skill's `reference/05-characters-mixamo.md`.

This starter is the reference implementation for the `threejs-aaa` skill; its patterns match
the skill's `reference/*.md` docs.
