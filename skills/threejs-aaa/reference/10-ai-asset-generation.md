# AI Asset Generation (Models, Textures, HDRI)

Overcoming "an agent can't make the art." An agent can't paint pixels itself, but it **can
orchestrate** generation services + deterministic cleanup: prompt → generate (submit/poll/
download) → make game-ready (retopo/optimize) → wire into Three.js. This file is the playbook.

> Versions/prices/endpoints below were researched 2026-06; AI services change fast. Treat
> specifics marked **(verify)** as needing a live-docs check before you depend on them.
> **Commercial licensing is the #1 risk** — read each tool's license before shipping, especially
> for an EU/UK entity (see the licensing table — some open models exclude the EU).

Table of contents
- [The pipeline](#the-pipeline)
- [Text/image-to-3D services (with APIs)](#textimage-to-3d-services-with-apis)
- [The async job API pattern](#the-async-job-api-pattern)
- [Self-hosted open 3D models](#self-hosted-open-3d-models)
- [Replicate / fal.ai wrappers](#replicate--falai-wrappers)
- [Making AI meshes game-ready](#making-ai-meshes-game-ready)
- [AI textures & PBR materials](#ai-textures--pbr-materials)
- [AI HDRI / environment maps](#ai-hdri--environment-maps)
- [Licensing cheat-sheet (read this)](#licensing-cheat-sheet-read-this)
- [The bundled gen-asset script](#the-bundled-gen-asset-script)

## The pipeline

```
prompt/image ─▶ generate (hosted API or open model) ─▶ raw GLB/FBX
            ─▶ validate (poly count, PBR maps, manifold)
            ─▶ retopo / decimate / UV (if dense)
            ─▶ optimize: weld→dedup→prune→simplify→meshopt/draco→KTX2
            ─▶ game-ready GLB ─▶ GLTFLoader + MeshoptDecoder + KTX2Loader
```

Every step is CLI/scriptable, so an agent can run the whole thing headlessly.

## Text/image-to-3D services (with APIs)

| Service | Output | PBR | Topology | API | Commercial |
|---|---|---|---|---|---|
| **Meshy** (meshy.ai) | GLB/FBX/OBJ/USDZ/STL/3MF | yes (basecolor/metal/rough/normal/emission; 4K base, 2K PBR) | tri default, **quad remesh** + low-poly mode, auto-rig + animation | **REST, Pro+** | Pro+ = full ownership |
| **Tripo** (tripo3d.ai) | GLB/FBX/OBJ/USDZ/STL | yes | Standard (game) / Ultra (≤2M poly), quad remesh, T-pose+skeleton | **REST** | paid = private/commercial |
| **Rodin/Hyper3D** (hyper3d.ai) | GLB/USDZ/FBX/OBJ/STL | yes (2K, 4K via HighPack) | **quad** (4k–50k presets, ≤200k) or raw tri (≤1M); cleanest topology | **REST, Business tier** | per plan |
| **Sloyd** (sloyd.ai) | GLB/FBX/OBJ/USD | configurable | **parametric, clean low-poly + LOD + UV** (hard-surface props only) | REST (gated) | Plus+ commercial |
| **CSM.ai**, **Kaedim** | GLB/FBX | yes | Kaedim is human-in-the-loop (not pure automation) | yes | per plan |

Quality today: hosted services (Meshy/Tripo/Rodin) lead on texture + topology; open models have
closed the geometry gap. **Diffusion meshes are dense tri-soup unless you apply a remesh step** —
always plan retopo/decimation. Luma **Genie is discontinued** (sunset ~Jan 2026) — don't use it.

## The async job API pattern

Almost every hosted 3D/texture/HDRI API is the same shape. Auth = `Authorization: Bearer <key>`.

```
1. POST create job (prompt/image + options)        → { id }
2. GET  job/{id}  every ~3–5s                       → { status, progress, ... }
   status: PENDING/QUEUED → IN_PROGRESS → SUCCEEDED | FAILED   (names vary)
3. on SUCCEEDED: download from model_urls.glb / texture_urls   (signed URLs)
```

**Meshy** (verified): base `https://api.meshy.ai`. Text-to-3D is **v2**; image-to-3D/retexture/
remesh/rigging are **v1**.
- `POST /openapi/v2/text-to-3d` body `{ mode:"preview", prompt, ai_model:"latest", topology:"quad"|"triangle", target_polycount, pose_mode:"t-pose" }` → `{ result: <id> }`.
- Then `POST /openapi/v2/text-to-3d` `{ mode:"refine", preview_task_id, enable_pbr:true, hd_texture:true }` for textures.
- `GET /openapi/v2/text-to-3d/{id}` → `{ status, progress, model_urls:{glb,fbx,obj,usdz}, texture_urls:[{base_color,metallic,roughness,normal}] }`. Status: `PENDING|IN_PROGRESS|SUCCEEDED|FAILED|CANCELED`. SSE `/{id}/stream` and webhooks also exist.
- Image-to-3D: `POST /openapi/v1/image-to-3d` `{ image_url, enable_pbr, should_remesh, topology, target_polycount }`.
- API requires **Pro tier** ($20/mo ≈ 1000 credits; ~20 credits/textured model). Pro+ assets are privately owned/commercial.

**Rodin/Hyper3D** (verified): base `https://api.hyper3d.com/api/v2`. `POST /rodin` (submit) → poll
`POST /check-status` → `POST /download`. Bearer token, Business tier for Gen-2 API. `TAPose` param
forces rig-friendly T/A-pose. Modes `quad`/`raw`, `quality` presets, PBR `material` option.

**Tripo** (verified host pattern): platform `platform.tripo3d.ai`, docs `docs.tripo3d.ai`. `POST`
a task `{ type:"text_to_model"|"image_to_model", ... }` → `{ data:{ task_id } }` → `GET task/{id}`
→ `{ status: queued|running|success|failed, progress, output:{ model, pbr_model } }`. $1 = 100 credits.

## Self-hosted open 3D models

For no-vendor-lock / cost control / privacy. Run locally (GPU) or via Replicate/fal (next section).

| Model | Task | ~VRAM | Output | License |
|---|---|---|---|---|
| **TripoSR** | image→3D, <1s | ~6 GB | mesh + vertex color/baked tex | **MIT** ✅ |
| **InstantMesh** | image→3D | ~8–24 GB | OBJ/GLB | **Apache-2.0** ✅ |
| **TRELLIS / TRELLIS.2** (Microsoft) | image/text→3D, top quality | ~16 GB | GLB + PBR (TRELLIS.2) | **MIT** ✅ (⚠️ `nvdiffrast` dep is non-commercial — review/replace) |
| **SF3D / SPAR3D** (Stability) | image→3D, ~0.5s, **UV+PBR** | ~7 GB | game-ready GLB | Stability Community — free commercial **≤ $1M revenue** |
| **Hunyuan3D-2.1** (Tencent) | image→3D, best open PBR | ~21–29 GB | GLB + PBR | Tencent license — **⚠️ does NOT apply in EU/UK/South Korea**; >1M MAU needs license |
| **Hunyuan3D-2mini** | image→3D, light | ~5–6 GB | GLB | same Tencent license family (EU-excluded) |
| **LGM / CRM / Wonder3D** | image→3D | varies | mesh | **MIT** ✅ |

**EU note:** for an EU/`.fr` commercial project, prefer **TRELLIS, TripoSR, InstantMesh, LGM, CRM**
(clean MIT/Apache) or hosted **Meshy/Tripo/Rodin** (commercial on paid tiers). **Avoid the Hunyuan3D
family** — its license is void in the EU.

## Replicate / fal.ai wrappers

Open-model quality without owning a GPU. Same submit/poll/download shape.

- **Replicate**: `POST https://api.replicate.com/v1/predictions` `{ version, input }`, header
  `Authorization: Bearer <token>` (or `Prefer: wait` to block). Poll `GET /v1/predictions/{id}` →
  `output` URLs. Hosts TRELLIS, Hunyuan3D, TripoSR, InstantMesh, Real-ESRGAN, SD/Flux. Per-second GPU billing.
- **fal.ai**: `POST https://queue.fal.run/{model-id}`, header `Authorization: Key <key>` → `request_id`
  → poll status → result GLB. e.g. `fal-ai/hyper3d/rodin`, `fal-ai/trellis`, `fal-ai/hunyuan3d` **(verify slugs)**.
- **HuggingFace** Spaces via `gradio_client` for prototyping (Spaces sleep/queue — not for production SLAs).

## Making AI meshes game-ready

AI meshes are rarely shippable as-is. All-CLI cleanup chain:

- **Retopo** (tri-soup → clean/lower): **Instant Meshes** (BSD, CLI quad remesher); **Blender headless**
  `blender --background --python script.py` (Quadriflow, Decimate, Smart UV, exporters).
- **Decimate**: `gltfpack` / `gltf-transform simplify` (both wrap meshoptimizer); Blender Decimate.
- **UV unwrap** (if missing): **xatlas** (open, CLI/bindings); Blender Smart UV. SF3D/Sloyd already emit UVs.
- **Optimize for web — `gltf-transform`** (the canonical tool):
  ```bash
  gltf-transform optimize in.glb out.glb --compress meshopt --texture-compress ktx2
  # or granular: weld → dedup → prune → simplify --ratio 0.5 → meshopt → resize → uastc/etc1s
  ```
- **Meshopt vs Draco / KTX2**: see `09-performance.md`. Meshopt = fast decode (default for games);
  KTX2 = essential GPU-compressed textures.

The bundled **`scripts/gen-asset.mjs --optimize`** runs this chain after downloading.

## AI textures & PBR materials

Target maps (correct color spaces in `02-rendering.md`): albedo(sRGB), normal, roughness, metalness,
AO, height (all linear).

- **Full PBR map sets**: **Substance 3D Sampler** (best, GUI/enterprise API only); **Poly (withpoly.com)**
  (tileable, API — verify); **Polycam** (albedo/normal/roughness/displacement, **no metal/AO**, ≤2K, no
  REST API, royalty-free outputs); **StableMaterials** (open, one model → tileable PBR set);
  **Materialize** (derives normal/height/rough/AO from one diffuse, free, GUI); **DeepBump** (open,
  albedo→normal/AO/curvature — wrap as a microservice).
- **Texture an existing mesh** (project onto its UVs): **Meshy retexture** (`POST /openapi/v1/retexture`,
  PBR, API — best automatable); **TEXTure/Text2Tex/Paint3D** (research, albedo-only; Paint3D emits delit albedo).
- **Tileable**: generate with SD **tiling mode** (or use Poly/StableMaterials which are tileable natively);
  offset-and-heal as fallback. **Upscale**: Real-ESRGAN (open, on Replicate). **Delight** (clean albedo):
  prompt "flat, evenly-lit, shadowless, orthographic, seamless" so albedo is near-delit, then derive maps.
- **Hybrid & when procedural wins**: for terrain/water/clouds/marble/sci-fi paneling, **TSL procedural
  materials win** (no download, no VRAM, no seams, infinite zoom, free animation — see `03-materials-shaders.md`).
  Use AI for specific hero-surface detail, mix with procedural masks.

Wire-up:
```js
const mat = new THREE.MeshStandardNodeMaterial({ map: albedo, normalMap, roughnessMap, aoMap, metalnessMap });
albedo.colorSpace = THREE.SRGBColorSpace;              // ONLY albedo/emissive are sRGB
[normalMap, roughnessMap, aoMap, metalnessMap].forEach(t => t.colorSpace = THREE.NoColorSpace);
[albedo, normalMap, roughnessMap, aoMap, metalnessMap].forEach(t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(8,8); });
```

## AI HDRI / environment maps

The **true-HDR vs LDR** distinction is decisive: realistic IBL (bright sun driving reflections/bloom)
needs values > 1.0, i.e. a real `.hdr`/`.exr`, not an 8-bit panorama.

- **Best default (not AI): Poly Haven** — real captured **true-HDR**, **CC0** (free commercial, no
  attribution), 1K–16K, direct CDN URLs (agent-fetchable). A 1K/2K Poly Haven HDRI is often the best
  `scene.environment`. Use AI HDRI only for a *specific stylized* environment Poly Haven lacks.
- **Blockade Labs Skybox AI**: text→360, **REST API** (POST generate `{ prompt, skybox_style_id }` →
  poll `GET .../imagine/requests/{id}` → download `file_url` + depth + HDRI export on tiers). **Caveat:
  its HDRI export is inverse-tonemapped, not physically captured** — fine for ambient/reflections, but add
  an explicit `DirectionalLight` for hard sun shadows. Up to ~8K (verify).
- **DiffusionLight** (open): estimate HDR lighting from a single LDR photo (inpaints a chrome ball).

Wire-up (`02-rendering.md` has the full IBL setup):
```js
new RGBELoader().load(url, (hdr) => {
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = pmrem.fromEquirectangular(hdr).texture;
});
```
If only an LDR equirect PNG is available, it still works as `scene.environment` (flatter lighting) — add a sun.

## Licensing cheat-sheet (read this)

| Asset source | Commercial? | Catch |
|---|---|---|
| Meshy / Tripo / Rodin (paid tiers) | ✅ | none (you own outputs) |
| TripoSR, InstantMesh, TRELLIS, LGM, CRM | ✅ | TRELLIS: vet `nvdiffrast` dep |
| SF3D / SPAR3D | ⚠️ | free commercial only ≤ $1M revenue |
| **Hunyuan3D 2.x family** | ❌ in EU | **license void in EU/UK/South Korea**; >1M MAU needs license |
| Poly Haven HDRIs/textures | ✅ | CC0 — none |
| Polycam textures | ✅ | royalty-free (verify ToS) |
| Text-to-motion models (MDM/MoMask…) | ⚠️ | code is MIT but **trained on AMASS/HumanML3D = non-commercial** (see `11`) |

## The bundled gen-asset script

`scripts/gen-asset.mjs` orchestrates the full pipeline with a **Meshy** adapter (the verified API).
It reads `MESHY_API_KEY` from the env, submits a text/image job, polls, downloads the GLB, and
(with `--optimize`) runs the gltf-transform game-ready chain. It fails gracefully with setup
instructions if no key is present. Other providers follow the identical submit/poll/download shape —
the script documents how to add an adapter.

```bash
export MESHY_API_KEY=msy_xxx
node ${CLAUDE_SKILL_DIR}/scripts/gen-asset.mjs --prompt "a mossy stone well" --out ./public/well.glb --optimize
```
