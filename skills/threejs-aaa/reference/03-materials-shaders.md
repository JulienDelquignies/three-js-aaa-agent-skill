# Materials & Shaders: TSL, Procedural, Triplanar

Table of contents
- [TSL essentials](#tsl-essentials)
- [Node materials](#node-materials)
- [Assigning node slots](#assigning-node-slots)
- [Procedural noise nodes](#procedural-noise-nodes)
- [Triplanar mapping](#triplanar-mapping)
- [Procedural textures (CPU)](#procedural-textures-cpu)
- [WebGL / GLSL path](#webgl--glsl-path)

## TSL essentials

TSL (Three Shading Language) is a JavaScript node-graph shader API. You compose nodes and
assign them to material slots; it compiles to **WGSL** (WebGPU) or **GLSL** (WebGL2) — write
once, run on both. **Stable as of r184.** Prefer TSL for all new custom shaders; it is the
only cross-backend path, and raw `ShaderMaterial`/`onBeforeCompile` don't work on WebGPU.

Import discipline (the thing agents get wrong most):

```js
import * as THREE from 'three/webgpu';   // WebGPURenderer + *NodeMaterial classes
import {
  Fn, uniform, attribute, varying, positionLocal, positionWorld,
  normalLocal, normalWorld, uv, texture, time, vec2, vec3, vec4, float, color,
  sin, cos, mix, smoothstep, clamp, normalize,
  mx_noise_float, mx_fractal_noise_vec3, triplanarTexture,
} from 'three/tsl';                       // ALL TSL nodes/functions
```

Node vocabulary:
- Declaration: `Fn()` (reusable function), `uniform()` (JS-driven value), `attribute()`,
  `varying()`.
- Types: `float, int, bool, vec2/3/4, mat2/3/4, color`.
- Builtins: `positionLocal/World`, `normalLocal/View/World`, `uv()`, `time`, `screenUV`, `texture()`.
- Math: `sin, cos, mix, smoothstep, clamp, normalize, abs, dot, pow, length` plus chained
  operators `.add() .sub() .mul() .div() .negate()`.

## Node materials

Import from `three/webgpu`: `MeshStandardNodeMaterial`, `MeshPhysicalNodeMaterial`,
`MeshBasicNodeMaterial`, `PointsNodeMaterial`, `SpriteNodeMaterial`, `LineBasicNodeMaterial`,
and base `NodeMaterial`. They mirror the classic materials but expose `*Node` slots, so you
keep full PBR lighting/shadows/fog while overriding pieces.

## Assigning node slots

```js
const material = new THREE.MeshStandardNodeMaterial();

material.colorNode     = texture(albedoMap);
material.roughnessNode = float(0.5);
material.metalnessNode = float(0.0);
material.emissiveNode  = color(0xff3300).mul(2.0);     // HDR emissive feeds bloom

// Vertex displacement along the normal:
const amp = uniform(0.2);
material.positionNode  = positionLocal.add(
  normalLocal.mul(mx_noise_float(positionLocal).mul(amp))
);
```

Available slots include `colorNode, positionNode, normalNode, emissiveNode, roughnessNode,
metalnessNode, opacityNode`. Update a `uniform()` each frame via `myUniform.value = ...`.

Reusable functions with `Fn`:

```js
const displace = Fn(([amp]) => {
  const n = mx_noise_float(positionLocal);
  return positionLocal.add(normalLocal.mul(n).mul(amp));
});
material.positionNode = displace(float(0.2));
```

## Procedural noise nodes

MaterialX noise is built into TSL (exported from `three/tsl`):

- `mx_noise_float(texcoord, amplitude?, pivot?)`
- `mx_noise_vec3(texcoord, amplitude?, pivot?)`
- `mx_cell_noise_float(texcoord)`
- `mx_worley_noise_float / _vec2 / _vec3(texcoord, jitter)`
- `mx_fractal_noise_float / _vec2 / _vec3 / _vec4(position, octaves, lacunarity, diminish, amplitude)` — fBm
- color utils: `mx_hsvtorgb`, `mx_rgbtohsv`, `mx_aastep(threshold, value)`
- also `mx_rotate2d/3d`, `mx_heighttonormal`, `mx_ifgreater`

Plus TSL helpers: `curlNoise(vec3)`, `hash(float)`, `checker(vec2)`, `circle(scale, softness, coord)`.

Example — animated procedural surface, no textures:

```js
const n = mx_fractal_noise_vec3(positionWorld.mul(0.5).add(time.mul(0.1)), 5, 2.0, 0.5, 1.0);
material.colorNode = mix(color(0x113355), color(0x88ccff), n.x.mul(0.5).add(0.5));
```

## Triplanar mapping

Projects a texture from the 3 world axes and blends by the surface normal — kills the UV
stretching that flat mapping shows on cliffs/terrain. Built into TSL:

```js
// signature: triplanarTexture(texX, texY=texX, texZ=texX, scale=1, position=positionLocal, normal=normalLocal)
material.colorNode = triplanarTexture(texture(rockAlbedo), null, null, float(0.1));
```

Cost: the texture is sampled ~3× per fragment. Use it for terrain/cliffs and any object
without good UVs.

## Procedural textures (CPU)

When you need a texture object rather than in-shader color:

```js
// DataTexture — build a typed array directly (RGBA, 4 bytes/pixel, 0–255)
const size = 64, data = new Uint8Array(size * size * 4);
for (let i = 0; i < size * size; i++) {
  const v = Math.random() * 255;
  data[i*4+0] = v; data[i*4+1] = v; data[i*4+2] = v; data[i*4+3] = 255;
}
const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
tex.needsUpdate = true;            // REQUIRED after construction/modification

// CanvasTexture — draw with the 2D canvas API, then wrap it
const tex2 = new THREE.CanvasTexture(canvas);  // tex2.needsUpdate = true on redraw
```

Prefer in-shader noise (resolution-independent, no upload). Use `DataTexture` for precomputed
arrays, `CanvasTexture` for 2D-canvas-drawn content.

## WebGL / GLSL path

If you stay on `WebGLRenderer` and have/need GLSL:

- **`three-custom-shader-material`** (`^6.4`) — inject GLSL into built-in materials while
  keeping PBR lighting. Hooks: vertex `csm_Position`, `csm_Normal`; fragment `csm_DiffuseColor`
  (keeps shading), `csm_FragColor` (overrides), `csm_Emissive`, `csm_Roughness`, etc. **GLSL/
  WebGL only** — no WebGPU support.
  ```js
  import CustomShaderMaterial from 'three-custom-shader-material/vanilla';
  const mat = new CustomShaderMaterial({
    baseMaterial: THREE.MeshPhysicalMaterial,
    vertexShader: `void main(){ csm_Position = position; }`,
    fragmentShader: `void main(){ csm_DiffuseColor = vec4(1.,0.,0.,1.); }`,
    uniforms: { uTime: { value: 0 } },
  });
  ```
- **LYGIA** (`lygia`) — large multi-language shader include library (noise/SDF/lighting).
  Use via `resolveLygia()` to inline `#include "lygia/..."`. GLSL/`ShaderMaterial` only.
  **License caveat for commercial/AAA: Prosperity License — non-commercial by default; you
  must obtain a commercial/patron license to ship it.** Flag this to the user before adding it.

On WebGPU, the equivalent of CSM is just `MeshStandardNodeMaterial` with `colorNode`/
`positionNode`; the equivalent of LYGIA noise is the built-in `mx_*` nodes above.
