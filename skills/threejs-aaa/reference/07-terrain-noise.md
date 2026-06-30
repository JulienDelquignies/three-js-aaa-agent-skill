# Noise & Terrain

Table of contents
- [Noise library](#noise-library)
- [fBm (fractal noise)](#fbm-fractal-noise)
- [Heightmap terrain (CPU)](#heightmap-terrain-cpu)
- [GPU displacement](#gpu-displacement)
- [Erosion](#erosion)
- [Marching cubes / caves / voxels](#marching-cubes--caves--voxels)
- [Chunked / infinite terrain (LOD)](#chunked--infinite-terrain-lod)
- [Web Workers](#web-workers)

## Noise library

`simplex-noise@^4.0.3`. **v4 is a breaking rewrite**: no `new SimplexNoise()`, no built-in
seeding. Factory functions return closures; pass your own PRNG (e.g. `alea` or `pure-rand`):

```js
import { createNoise2D, createNoise3D } from 'simplex-noise';
import alea from 'alea';

const noise2D = createNoise2D(alea('world-seed'));   // (x, y) → [-1, 1]
const noise3D = createNoise3D(alea('world-seed-3d')); // pass a FRESH prng to each create*()
const v = noise2D(x * 0.01, y * 0.01);
```

~70M calls/sec. For reproducibility across multiple noise functions, give each `create*` its
own fresh `alea` instance (they consume the PRNG stream on construction).

## fBm (fractal noise)

fBm = summing octaves. Standard CPU form:

```js
function fbm(noise2D, x, y, { octaves = 6, lacunarity = 2.0, persistence = 0.5, scale = 0.01 } = {}) {
  let amp = 1, freq = scale, sum = 0, norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum  += amp * noise2D(x * freq, y * freq);
    norm += amp;
    amp  *= persistence;   // each octave contributes less
    freq *= lacunarity;    // each octave is higher frequency
  }
  return sum / norm;       // ~[-1, 1]
}
```

`lacunarity ≈ 2.0`, `persistence/gain ≈ 0.5`. Ridged mountains: `1 - abs(noise)` per octave.
Billowy: `abs(noise)`. On GPU/TSL use `mx_fractal_noise_float(pos, octaves, lacunarity, diminish, amp)`.

## Heightmap terrain (CPU)

`PlaneGeometry` lies in the XY plane, so before rotation you displace **Z**; after
`rotateX(-Math.PI/2)` the height is world **Y**:

```js
const geo = new THREE.PlaneGeometry(width, depth, segX, segY); // segX/segY = vertex resolution
geo.rotateX(-Math.PI / 2);

const pos = geo.attributes.position;
for (let i = 0; i < pos.count; i++) {
  const h = fbm(noise2D, pos.getX(i), pos.getZ(i)) * maxHeight;
  pos.setY(i, h);
}
pos.needsUpdate = true;
geo.computeVertexNormals();    // REQUIRED after displacement, or lighting is wrong
geo.computeBoundingSphere();   // for correct frustum culling / raycasting
```

Animated terrain: use 3D noise with time as the third axis, rewrite positions each frame,
`needsUpdate = true`, recompute normals (CPU recompute is the bottleneck — prefer GPU below).

Batteries-included: `THREE.Terrain` (`three.terrain.js`, needs r160+) — Perlin/Simplex/Worley/
Diamond-Square, `generateBlendedMaterial()` (elevation/slope blending), `ScatterMeshes()`.

## GPU displacement

`displacementMap` moves vertices in the vertex shader (cheap, but needs a high-segment plane):

```js
const mat = new THREE.MeshStandardNodeMaterial({
  displacementMap: heightTex, displacementScale: 50, displacementBias: 0,
});
heightTex.colorSpace = THREE.NoColorSpace;   // displacement is non-color data
```

`displacementScale` = max height; `displacementBias` offsets the whole surface. **Caveat:** it
does **not** recompute normals from the displaced surface — pair with a matching normal map, or
compute normals analytically in TSL, for correct lighting.

## Erosion

Post-process a heightfield for realism. **Droplet hydraulic erosion** (Beyer / Sebastian Lague)
is the practical default — spawn N droplets that walk downhill, eroding and depositing sediment.
Run it in a Web Worker.

Canonical parameters (SebLague): `erosionRadius 3`, `inertia 0.05`, `sedimentCapacityFactor 4`,
`minSedimentCapacity 0.01`, `erodeSpeed 0.3`, `depositSpeed 0.3`, `evaporateSpeed 0.01`,
`gravity 4`, `maxDropletLifetime 30`, 35k–100k+ droplets.

Per-droplet loop: bilinear-sample height+gradient at the float position → update direction
`dir = dir*inertia − gradient*(1−inertia)` → compute capacity
`max(−deltaHeight * speed * water * sedimentCapacityFactor, minSedimentCapacity)` → if sediment >
capacity or moving uphill **deposit**, else **erode** (spread over `erosionRadius` neighbors) →
`speed = sqrt(max(0, speed² + deltaHeight*gravity))`, `water *= (1 − evaporateSpeed)`.

**Thermal erosion** complements it: move material off slopes steeper than a talus angle to the
lower neighbors; iterate. Interleave hydraulic + thermal passes. JS reference (Three.js/TS):
`tessapower/hydraulic-erosion`.

## Marching cubes / caves / voxels

- **Metaballs / simple isosurfaces:** built-in `MarchingCubes` addon.
  ```js
  import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
  const mc = new MarchingCubes(64 /*resolution*/, material, true, true, 40000 /*maxPolyCount*/);
  mc.isolation = 80;            // isosurface threshold
  mc.reset();
  mc.addBall(0.5, 0.5, 0.5, 0.8, 12);   // coords in 0..1 space
  mc.update();
  ```
  Raise `maxPolyCount` for complex fields. `setCell(x,y,z,v)` writes arbitrary density fields
  (your own noise/SDF), then `update()`.
- **General voxel terrain / caves with your own density field** (e.g. `fbm3D(x,y,z) - y` for
  overhangs): use **Surface Nets** for smoother, lower-poly meshes — `isosurface` npm
  (`surfaceNets(dims, potentialFn)` → `{positions, cells}` → feed a `BufferGeometry`). Run in a
  Worker for large worlds.

## Chunked / infinite terrain (LOD)

**Quadtree LOD** is the dominant pattern: manage patches in a quadtree, subdivide near the
camera, select by screen-space error. Reference: SimonDev's "3D World Generation" series
(`simondevyoutube/ProceduralTerrain_Part*`). Fix LOD seams with **skirts** (vertical lip around
chunk edges) or **edge stitching**; **geomorph** vertices between levels to kill popping.

Drop-in library: `@interverse/three-terrain-lod@^2.1.1` (quadtree chunked LOD, swappable
materials, real-time editing). Alternative: **geometry clipmaps** (concentric nested grids
centered on camera; simpler, GPU-friendly, great for very large heightfields).

## Web Workers

Noise/fBm/erosion/meshing are CPU-heavy — run them off the main thread. Pattern: a worker pool;
each worker computes a chunk's `Float32Array` heightfield (and normals/indices) → **transfer**
the `ArrayBuffer` back (zero-copy) → main thread builds the `BufferGeometry`. `three-mesh-bvh`
supports `MeshBVH.serialize`/`deserialize`, so build the (expensive) BVH in the worker and
transfer it too. Stream/evict chunks by camera distance.
