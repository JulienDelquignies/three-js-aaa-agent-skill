# Advanced Rendering & Scale (Toward True AAA)

Pushing browser 3D toward AAA fidelity/scale. Honest framing: the gap vs native AAA is no longer
mainly GPU power (WebGPU is capable) — it's **missing hardware features the browser doesn't expose
(mesh shaders, hardware ray tracing, sparse textures), per-tab VRAM ceilings, and the single JS main
thread**. You close the gap with compute, streaming, baking, and temporal upscaling — not brute force.

Each technique is tagged **[ship]** (available now) or **[exp]** (experimental/research).

Table of contents
- [The honest gap](#the-honest-gap)
- [Virtualized geometry / "web Nanite"](#virtualized-geometry--web-nanite)
- [GPU-driven rendering](#gpu-driven-rendering)
- [Streaming & memory](#streaming--memory)
- [Upscaling & temporal](#upscaling--temporal)
- [GI & advanced lighting](#gi--advanced-lighting)
- [Threading & architecture](#threading--architecture)
- [Engines that go further](#engines-that-go-further)
- [Prioritized wins](#prioritized-wins)

## The honest gap

Not exposed in WebGPU today (so no literal Nanite/Lumen parity in-tab): **mesh/task shaders**,
**hardware ray tracing / ray queries**, **sparse/tiled textures**. Plus tight VRAM ceilings and one JS
main thread. True UE5-grade titles in-browser ship via **Pixel Streaming** (render in cloud, stream
video). Vanilla Three.js/WebGPU can credibly hit **"AA / stylized-AAA"** at scale with the techniques
below. (Status of mesh-shader/ray-query proposals — verify against the current WebGPU spec.)

## Virtualized geometry / "web Nanite"

- **No mesh shaders → no literal Nanite [exp].** A real Nanite port needs mesh shaders + a software
  rasterizer for sub-pixel triangles; not portable to WebGPU yet.
- **The shipping substitute [ship]: meshlet/cluster rendering via compute + indirect draws.**
  - **meshoptimizer** (WASM, used by gltfpack) provides `meshopt_buildMeshlets` for clusters and a
    simplification chain (`meshopt_simplify`, `simplifyCluster`) to build LOD/cluster hierarchies offline.
  - **`BatchedMesh`** (three core) [ship] merges many geometries into one draw call with **per-instance
    and per-geometry LOD**, frustum culling, and sorting — the closest vanilla primitive to a GPU-driven
    scene and the right backbone for large static/instanced worlds.
- **Verdict:** there is **no production "web Nanite" drop-in** (only research demos). Use
  **meshoptimizer LOD + BatchedMesh + compute culling** as the Nanite-*flavored* path.

## GPU-driven rendering

The most concrete recent progress, largely **[ship]** on the WebGPU backend via TSL:

- **Compute via TSL** [ship]: `Fn` kernels run through `renderer.compute(...)`. Persistent GPU state in
  **storage buffers** — `instancedArray(count, type)` / `storage(...)` survive across frames. Foundation
  for GPU particles, GPU culling, GPU scene management with no CPU round-trip.
- **Indirect draws** [ship]: `IndirectStorageBufferAttribute` lets a compute pass write draw arguments
  the renderer consumes — the GPU decides what to draw. (verify exact API per release.)
- **Compute frustum culling** [ship]: per-instance culling in a compute shader, compacting survivors into
  an indirect buffer (TSL + BatchedMesh). Collapses thousands of CPU draws into a few indirect draws —
  removing the historically #1 web bottleneck (JS/driver per-draw overhead).
- **Hi-Z occlusion culling** [exp]: WebGPU gives the pieces (depth pyramid via compute) but there's no
  turnkey three.js module — custom TSL work.

## Streaming & memory

- **KTX2 / Basis Universal** [ship] — the single biggest VRAM win. `KTX2Loader` transcodes to the
  device's native compressed format (ASTC/BC7/ETC2), cutting texture VRAM 4–8× and staying compressed
  in memory. UASTC for normals/detail, ETC1S for albedo. Decode in a worker.
- **Meshopt vs Draco** [ship] — `EXT_meshopt_compression` decodes far faster (SIMD/WASM) and compresses
  animation/morphs; **preferred at scale and for streaming** (decode speed dominates frame time). Draco
  wins raw download size for one-shot loads. gltfpack produces meshopt-compressed, quantized glTF.
- **Geometry/world streaming** [ship, custom code] — tile/chunk the world, stream glTF chunks + LODs on
  demand, decode in workers, add/remove from `BatchedMesh`/scene. No standard three.js streaming manager.
- **Virtual/sparse texturing** [exp] — no hardware API in WebGPU; software virtual texturing is bespoke.
- **VRAM budgets (verify)**: plan ~**0.5–1 GB mobile**, ~**1–2 GB mid-desktop** before instability.
  Query `adapter.limits` (`maxBufferSize`, `maxTextureDimension2D`). Multi-GB worlds are feasible **only**
  via streaming + compressed textures + LOD — never all resident.

## Upscaling & temporal

- **DLSS / XeSS / MetalFX: not on web** [confirmed] — proprietary, no browser API.
- **FSR1 TSL node** [ship] — spatial upscaler (EASU) + sharpening (RCAS) in the three WebGPU examples.
  Spatial-only fits the web (no motion vectors needed). (verify exact node path per release.)
- **TAA** [ship] — `TAARenderPass` / pmndrs `postprocessing`; doubles as temporal upsampling with a
  jittered low-res render.
- **Dynamic resolution scaling** [ship, trivial] — render to a reduced-scale target, upscale to display.
  The **highest-ROI fidelity-per-frame lever** on fill-rate-bound GPUs (mobile especially). Pair with a
  frame-time controller. FSR2/FSR3 (temporal, need motion vectors) are [exp] on the web.
- **Web upscaling stack**: low-res render → TAA → FSR1 EASU → RCAS sharpen. The shipping DLSS-substitute.

## GI & advanced lighting

- **Hardware RT / ray queries: not exposed** [exp] — no real-time hardware RT GI; use baked/screen-space.
- **Baked lightmaps + SH light probes** [ship] — best "AAA look per watt." Bake GI offline (Blender or
  three-gpu-pathtracer), load lightmaps + `LightProbe` irradiance for dynamic objects.
- **three-gpu-pathtracer** (gkjohnson) [ship, WebGL2; WebGPU port ongoing] — full progressive path tracer
  in-browser. Two uses: (1) **offline/at-load bakes** of lightmaps/probes; (2) a **"cinematic/photo mode"**
  that converges a still. Not real-time for gameplay.
- **SSR / SSGI / SSAO** [ship, screen-space] — pragmatic real-time GI polish (classic screen-space limits:
  no off-screen data, ghosting). Complement with baked cubemap/PMREM reflection probes.
- **SDFGI / Voxel GI (VXGI)** [exp] — implementable in WebGPU compute, no turnkey module, heavy.
- **Clustered/tiled lighting for many dynamic lights** — a vanilla-three weak spot; engines do it better
  (see below). (verify current TSL clustered-lighting support.)
- **Verdict:** bake everything you can; SH probes for dynamic objects; SSR/SSGI/SSAO as polish; path
  tracing for bakes and photo mode.

## Threading & architecture

- **OffscreenCanvas + Web Workers** [ship] — run the whole renderer on a worker, freeing the main thread
  for game logic/input. Directly attacks the #1 architectural bottleneck. (verify Safari/Firefox coverage.)
- **Worker-pool asset decode** [ship] — Draco/Basis/KTX2/meshopt decoders in a worker pool; avoids hitches.
- **WASM SIMD + threads** [ship, caveat] — SIMD widely available; multithreaded WASM via `SharedArrayBuffer`
  needs **cross-origin isolation (COOP/COEP headers)** — a real deployment constraint.
- **Where the real bottlenecks are**: (1) draw-call/JS-driver overhead → batching + GPU-driven indirect
  draws; (2) JS GC stutter → no per-frame allocations, reuse typed arrays/vectors; (3) fill-rate/overdraw
  → dynamic resolution + depth pre-pass + less transparent overdraw; (4) main-thread contention →
  OffscreenCanvas + workers. Raw GPU power is rarely the first wall.

## Engines that go further

If vanilla three becomes a fight, these ship the hard systems out of the box:
- **PlayCanvas** — WebGPU, **clustered lighting** (many dynamic lights), instancing/batching, runtime
  lightmaps, streaming/asset pipeline.
- **Babylon.js** — strong WebGPU, **snapshot rendering** (records command buffers to slash CPU draw
  overhead on static scenes — a unique CPU-side win), clustered lighting, built-in GI/IBL tooling.
- **Needle Engine** — Unity-authored → web on top of three.js.
- **Galacean** — mobile/web-first, strong compression/streaming, proven at consumer scale.

## Prioritized wins

Biggest fidelity/scale gains for a Three.js game, in order:

1. **KTX2/Basis compressed textures everywhere** [ship, do first] — biggest VRAM win; `KTX2Loader` +
   gltfpack/`toktx`, UASTC normals / ETC1S albedo, decode in worker.
2. **Dynamic resolution + FSR1 + TAA** [ship] — render at 60–80% internal scale, upscale, temporally
   stabilize. Largest perf-per-pixel gain, especially mobile.
3. **GPU-driven rendering: BatchedMesh + compute frustum culling + indirect draws** [ship, WebGPU] —
   collapse thousands of draws into a few; kills the main draw-call bottleneck.
4. **Meshoptimizer LOD/cluster pipeline + streaming** [ship] — quantized, meshopt-compressed, multi-LOD
   assets; per-instance LOD via BatchedMesh; chunk-stream the world with worker decode. The realistic
   "Nanite-flavored" path.
5. **Baked GI: lightmaps + SH probes** [ship] — bake with three-gpu-pathtracer/Blender; SSR/SSAO/SSGI as
   polish; path tracing for photo mode.
6. **OffscreenCanvas + worker architecture** [ship; verify Safari] — renderer/decoders off the main
   thread; eliminate per-frame allocations to kill GC stutter (gate behind COOP/COEP if using SharedArrayBuffer).
7. **Watch list** [exp]: software virtual texturing, Hi-Z occlusion, SDFGI/VXGI, FSR2 temporal upscaling,
   mesh shaders & WebGPU ray queries. Don't put a shipping title's critical path on these yet.
