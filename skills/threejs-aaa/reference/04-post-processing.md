# Post-Processing

Post-processing is the single most important lever for an AAA look after IBL + tone mapping.
There are three stacks; **choose by renderer**.

Table of contents
- [Which stack](#which-stack)
- [WebGPU: TSL PostProcessing node stack](#webgpu-tsl-postprocessing-node-stack)
- [Recommended AAA order](#recommended-aaa-order)
- [WebGL: pmndrs/postprocessing](#webgl-pmndrspostprocessing)
- [Antialiasing](#antialiasing)
- [Gotchas](#gotchas)

## Which stack

| Renderer | Use | Don't use |
|---|---|---|
| `WebGPURenderer` (default) | Built-in TSL `PostProcessing` node stack | `EffectComposer`, `postprocessing` lib |
| `WebGLRenderer` | `postprocessing` (`pmndrs`, `^6.39`) | classic `EffectComposer` (slow) |

The TSL node stack shares a G-buffer/node graph, so AO/SSR/DOF reuse depth/normal passes
instead of re-rendering the scene — the reason it's preferred on WebGPU.

## WebGPU: TSL PostProcessing node stack

> **r185 API note:** the class was renamed `PostProcessing` → `RenderPipeline`, and
> `renderAsync()` → `render()` (with `await renderer.init()` at creation). `PostProcessing`/
> `renderAsync()` still work but warn. For forward+backward compat:
> `const Pipeline = THREE.RenderPipeline ?? THREE.PostProcessing;` and call `render()` if it
> exists, else `renderAsync()`. The starter's `engine/PostFX.js` does exactly this.

```js
import * as THREE from 'three/webgpu';
import { pass } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { ao } from 'three/addons/tsl/display/GTAONode.js';

const Pipeline = THREE.RenderPipeline ?? THREE.PostProcessing;
const postProcessing = new Pipeline(renderer);

const scenePass = pass(scene, camera);
const color = scenePass.getTextureNode('output');
const depth = scenePass.getTextureNode('depth');
const normal = scenePass.getTextureNode('normal');

const aoPass = ao(depth, normal, camera);
const bloomPass = bloom(color.mul(aoPass), 0.6 /*strength*/, 0.4 /*radius*/, 0.85 /*threshold*/);

postProcessing.outputNode = color.mul(aoPass).add(bloomPass);

// render loop: use the post-processor instead of renderer.render
postProcessing.render();   // older three: await postProcessing.renderAsync();
```

Built-in TSL effect functions available from `three/tsl` and `three/addons/tsl/display/*`:
`bloom`, `ao` (GTAO), `ssr`, `denoise`, `dof` (depth of field), `fxaa`, `smaa`, TAA, `fsr1`
(FidelityFX upscale), `film` (grain), `chromaticAberration`, `lensflare`, `godrays`, blur
kernels (`gaussianBlur`, `bilateralBlur`), tone-mapping nodes (`agxToneMapping`,
`acesFilmicToneMapping`), and color grading (`cdl` color-decision-list, `hue`, `bleach`).

> Note: exact addon import paths under `three/addons/tsl/display/` shift between releases.
> If an import fails, grep the installed package: `ls node_modules/three/examples/jsm/tsl/display/`.

## Recommended AAA order

Order matters. A typical stack:

1. **SSAO/GTAO** (ambient occlusion) — grounds objects, adds contact darkening.
2. **SSR** (screen-space reflections) — *experimental everywhere; gate behind a quality flag.*
3. **Bloom** — HDR glow from bright/emissive areas.
4. **Depth of field** — cinematic focus.
5. **Motion blur** (if available) — needs a velocity buffer.
6. **Color grade (LUT / CDL)** — the "film" look; a good LUT transforms the image.
7. **Tone mapping** (if not done on the renderer) — AgX/ACES.
8. **Antialiasing** — SMAA or TAA.
9. **Vignette + subtle chromatic aberration + film grain** — final polish, keep it subtle.

## WebGL: pmndrs/postprocessing

For the classic renderer. `EffectPass` merges multiple effects into one fullscreen pass.

```js
import { EffectComposer, RenderPass, EffectPass,
         BloomEffect, SMAAEffect, VignetteEffect } from 'postprocessing';

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new EffectPass(camera,
  new BloomEffect({ intensity: 1.0, luminanceThreshold: 0.85 }),
  new VignetteEffect(),
  new SMAAEffect(),
));
// loop: composer.render();
```

Effect classes: `BloomEffect`, `SSAOEffect`, `DepthOfFieldEffect`, `SMAAEffect`,
`ToneMappingEffect`, `VignetteEffect`, `ChromaticAberrationEffect`, `LUT3DEffect`/`LUTEffect`
(color grading), `GodRaysEffect`, `NoiseEffect`. R3F wrapper: `@react-three/postprocessing`
(`<EffectComposer>`, `<Bloom>`, `<N8AO>`, `<DepthOfField>`, `<ToneMapping>`, `<Vignette>`).

## Antialiasing

Once you have a post stack, **post-AA is mandatory** (MSAA only fixes geometry edges, not
shader aliasing):
- **SMAA** — sharp, cheap; good default.
- **TAA** — best temporal stability under motion; needs a velocity buffer and careful tuning.

## Gotchas

- **SSR is unstable** on both backends — treat as experimental, gate behind a quality toggle,
  test per Three.js release.
- **Bloom needs HDR input** — drive it from emissive materials > 1.0 and a sensible threshold,
  not from already-clamped LDR color.
- **Effect order changes the look** — AO before bloom; grade before AA; vignette last.
- On WebGPU, don't reach for `postprocessing`/`EffectComposer` — they're WebGL-oriented.
