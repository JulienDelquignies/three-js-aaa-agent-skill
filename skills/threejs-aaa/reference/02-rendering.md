# Rendering: Renderer, Materials, Lighting, Shadows

The single biggest drivers of an AAA look, in order: **correct color management + tone
mapping**, **HDRI image-based lighting**, **full PBR material maps**, **soft shadows**, and
**post-processing** (see `04-post-processing.md`). Get the first four right before anything else.

Table of contents
- [Renderer (WebGPU + fallback)](#renderer-webgpu--fallback)
- [Color management & tone mapping](#color-management--tone-mapping)
- [PBR materials](#pbr-materials)
- [Texture maps & color spaces](#texture-maps--color-spaces)
- [HDRI / image-based lighting](#hdri--image-based-lighting)
- [Lights](#lights)
- [Shadows](#shadows)
- [WebGL fallback notes](#webgl-fallback-notes)

## Renderer (WebGPU + fallback)

Default to `WebGPURenderer` from `three/webgpu`. It runs WebGPU where available and
**automatically falls back to WebGL2**. `await renderer.init()` is mandatory.

```js
import * as THREE from 'three/webgpu';

const renderer = new THREE.WebGPURenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // cap at 2 for perf
renderer.setSize(innerWidth, innerHeight);
await renderer.init();                 // REQUIRED — silent black frames otherwise
document.body.appendChild(renderer.domElement);
```

Rules:
- **Never mix import paths.** Renderer and `*NodeMaterial` classes come from `three/webgpu`;
  TSL nodes come from `three/tsl`. Do not also import the same objects from bare `three`.
- `ShaderMaterial`, `RawShaderMaterial`, and `onBeforeCompile` patches **do not run** under
  WebGPURenderer — author custom shaders in TSL (`03-materials-shaders.md`).
- The classic `EffectComposer` passes don't work on WebGPURenderer — use the TSL
  `PostProcessing` node stack (`04-post-processing.md`).
- WebGL can still be faster in trivial scenes; WebGPU wins on draw-call-heavy scenes and
  compute (particles/physics). For an AAA target, WebGPU is the right default.

## Color management & tone mapping

This is non-negotiable and the most common reason scenes look "washed out" or "muddy".

```js
THREE.ColorManagement.enabled = true;          // default since r152; keep it on
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.AgXToneMapping;    // realism; or ACESFilmicToneMapping (cinematic)
renderer.toneMappingExposure = 1.0;             // tune per scene/HDRI
```

Tone-mapping options:
- `AgXToneMapping` (r158+) — physically accurate, best highlight hue preservation. Default for realism.
- `ACESFilmicToneMapping` — cinematic S-curve, the popular game look.
- `NeutralToneMapping` (Khronos PBR Neutral) — minimal hue shift, good for product/asset fidelity.

## PBR materials

- `MeshStandardNodeMaterial` — metalness/roughness PBR. Baseline for most opaque surfaces.
- `MeshPhysicalNodeMaterial` — adds the AAA-defining layers (extra per-pixel cost; each
  feature is off until you set it):

| Feature | Properties | Use for |
|---|---|---|
| Clearcoat | `clearcoat`, `clearcoatRoughness`, `clearcoatNormalMap` | car paint, lacquer, wet surfaces |
| Transmission | `transmission`, `thickness`, `ior`, `attenuationColor`, `attenuationDistance` | real glass/liquid refraction |
| Sheen | `sheen`, `sheenColor`, `sheenRoughness` | cloth, velvet |
| Iridescence | `iridescence`, `iridescenceIOR`, `iridescenceThicknessRange` | soap bubbles, oil film |
| Anisotropy | `anisotropy`, `anisotropyRotation`, `anisotropyMap` | brushed metal, hair, vinyl |

These map to Khronos `KHR_materials_*` glTF extensions, so authored glTF imports natively.

`transmission` triggers an extra render pass and is expensive — budget it. In R3F, drei's
`MeshTransmissionMaterial` is the production glass helper.

```js
import * as THREE from 'three/webgpu';

const mat = new THREE.MeshPhysicalNodeMaterial({
  color: 0x8899aa, metalness: 1.0, roughness: 0.35,
  clearcoat: 1.0, clearcoatRoughness: 0.1,
});
```

## Texture maps & color spaces

A full PBR set: `map` (albedo), `normalMap` + `normalScale`, `roughnessMap`, `metalnessMap`,
`aoMap` (needs a 2nd UV set, `uv1`), optional `displacementMap` (+ tessellated geometry),
`emissiveMap`, `clearcoatMap`, `sheenColorMap`.

**Color-space discipline (load-bearing):**

```js
albedoTex.colorSpace   = THREE.SRGBColorSpace;  // base color
emissiveTex.colorSpace = THREE.SRGBColorSpace;  // emissive
normalTex.colorSpace    = THREE.NoColorSpace;   // data map — linear
roughnessTex.colorSpace = THREE.NoColorSpace;   // data map — linear
metalnessTex.colorSpace = THREE.NoColorSpace;   // data map — linear
aoTex.colorSpace        = THREE.NoColorSpace;   // data map — linear
heightTex.colorSpace    = THREE.NoColorSpace;   // displacement — linear
```

Only albedo/emissive are sRGB; everything carrying *data* (not color) stays linear.

## HDRI / image-based lighting

IBL does most of the realism work before you add a single light.

```js
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

const pmrem = new THREE.PMREMGenerator(renderer);
pmrem.compileEquirectangularShader();

const hdr = await new RGBELoader().loadAsync('/env/studio_2k.hdr');
const envMap = pmrem.fromEquirectangular(hdr).texture;

scene.environment = envMap;            // lights ALL PBR materials at once
scene.background = hdr;                 // optional: show the HDRI as background
scene.environmentIntensity = 1.0;      // cheap art-direction knob
scene.backgroundBlurriness = 0.0;      // blur the visible background only
hdr.mapping = THREE.EquirectangularReflectionMapping;
```

Use `EXRLoader` for `.exr` instead of `RGBELoader`. Source HDRIs from Poly Haven (CC0).

## Lights

Keep **≤3 active dynamic lights**; lean on IBL for fill.

- `DirectionalLight` — the sun. The only light that should cast shadows in most outdoor scenes.
  Pair with the `Sky` addon (`three/addons/objects/Sky.js`) or an HDRI sky.
- `RectAreaLight` — soft area light (windows, softboxes). Call `RectAreaLightUniformsLib.init()`;
  only affects `MeshStandard*`/`MeshPhysical*`; **does not cast shadows**.
- `LightProbe` — ambient irradiance (SH) to ground dynamic objects in baked scenes.
- Avoid shadowed `PointLight` — it costs **6 shadow renders** (one per cube face).

```js
const sun = new THREE.DirectionalLight(0xffffff, 3.0);
sun.position.set(50, 80, 30);
sun.castShadow = true;
scene.add(sun);
```

## Shadows

```js
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;   // good AAA default
```

Shadow-map type, cheapest → best: `BasicShadowMap` (avoid) → `PCFShadowMap` (default) →
`PCFSoftShadowMap` → `VSMShadowMap` (smoother, can light-bleed).

Tune the directional light's shadow:

```js
sun.shadow.mapSize.set(2048, 2048);     // mobile 512–1024, desktop 1024–2048, hero 4096
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 200;
sun.shadow.camera.left = -60; sun.shadow.camera.right = 60;   // tighten to visible area
sun.shadow.camera.top = 60;   sun.shadow.camera.bottom = -60; // smaller frustum = sharper
sun.shadow.bias = -0.0005;              // fix shadow acne
sun.shadow.normalBias = 0.02;
```

Beyond basic shadow maps:
- **Cascaded Shadow Maps (CSM)** — essential for large open worlds (sharp near, coarse far).
  Three.js ships a `CSM` addon and example (`webgl_shadowmap_csm`); libs: `three-csm`. Use
  4 cascades on desktop, 2 on mobile. (WebGPU CSM is in active development — verify per release.)
- **Contact shadows** — cheap grounded shadow under objects (drei `<ContactShadows>` in R3F).
- **PCSS** — contact-hardening soft shadows (drei `<SoftShadows>`).
- **AccumulativeShadows + RandomizedLight** (drei) — best-in-class baked soft shadows for
  static hero shots; near-zero runtime cost once converged.

## WebGL fallback notes

If you must target the classic `WebGLRenderer` (`import * as THREE from 'three'`): use
`MeshStandardMaterial`/`MeshPhysicalMaterial`, the `postprocessing` library for post
(`04-post-processing.md`), and you regain `ShaderMaterial`/`onBeforeCompile`. Everything else
(color management, IBL, shadows, materials) is identical.
