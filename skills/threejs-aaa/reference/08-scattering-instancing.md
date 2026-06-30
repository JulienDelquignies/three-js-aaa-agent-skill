# Scattering & Instancing (Vegetation, Props)

Table of contents
- [InstancedMesh basics](#instancedmesh-basics)
- [Surface sampling](#surface-sampling)
- [Snapping to terrain (BVH)](#snapping-to-terrain-bvh)
- [Poisson-disk distribution](#poisson-disk-distribution)
- [Large vegetation fields](#large-vegetation-fields)
- [GPU grass](#gpu-grass)
- [R3F / drei helpers](#r3f--drei-helpers)

## InstancedMesh basics

Same geometry + material, many transforms → **one draw call**. The core tool for trees, rocks,
grass, props, crowds.

```js
const count = 5000;
const mesh = new THREE.InstancedMesh(geometry, material, count);
const dummy = new THREE.Object3D();
for (let i = 0; i < count; i++) {
  dummy.position.set(x, y, z);
  dummy.rotation.y = Math.random() * Math.PI * 2;
  dummy.scale.setScalar(0.8 + Math.random() * 0.4);
  dummy.updateMatrix();
  mesh.setMatrixAt(i, dummy.matrix);
}
mesh.instanceMatrix.needsUpdate = true;
mesh.setColorAt(0, new THREE.Color(0xff0000)); // optional per-instance color (set instanceColor.needsUpdate)
scene.add(mesh);
```

For **different geometries sharing a material** in one draw call, use `BatchedMesh` (per-instance
frustum culling + LOD). Note: verify CPU overhead on your Three.js version for huge batches.

**Frustum-culling caveat:** an `InstancedMesh` is culled as a whole by its bounding origin. If a
scene-spanning instance cloud disappears when the origin leaves the screen, either set
`mesh.frustumCulled = false` and cull manually, **chunk** the cloud into a grid of smaller
`InstancedMesh`es (each gets free per-mesh culling), or use InstancedMesh2 (below).

## Surface sampling

Scatter onto any mesh surface with `MeshSurfaceSampler`:

```js
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';

const sampler = new MeshSurfaceSampler(sourceMesh)
  .setWeightAttribute('density')   // optional: vertex attribute weights sampling (.x used)
  .build();                        // call AFTER configuration

const pos = new THREE.Vector3(), nrm = new THREE.Vector3();
for (let i = 0; i < count; i++) {
  sampler.sample(pos, nrm);        // random surface point + normal
  dummy.position.copy(pos);
  dummy.scale.setScalar(0.5 + Math.random() * 0.5);
  dummy.updateMatrix();
  mesh.setMatrixAt(i, dummy.matrix);
}
mesh.instanceMatrix.needsUpdate = true;
```

`setWeightAttribute` must be called before `build()`. Faces with weight 0 are never sampled —
paint a density attribute to control where vegetation grows.

## Snapping to terrain (BVH)

To place props on a heightfield, raycast straight down onto the terrain. Accelerate with
**`three-mesh-bvh@^0.9.10`** (build a BVH once, fire thousands of rays at 60fps):

```js
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

terrain.geometry.computeBoundsTree();   // build the BVH

const ray = new THREE.Raycaster();
ray.set(new THREE.Vector3(x, 1000, z), new THREE.Vector3(0, -1, 0));
const hit = ray.intersectObject(terrain)[0];
if (hit) { dummy.position.copy(hit.point); /* align to hit.face.normal for slopes */ }
```

`three-mesh-bvh` also serializes (`MeshBVH.serialize`/`deserialize`) for Worker builds, and is
the foundation under `three-bvh-csg`.

## Poisson-disk distribution

For even, natural, non-overlapping placement (better than uniform random):

```js
import PoissonDiskSampling from 'poisson-disk-sampling';
const pds = new PoissonDiskSampling({ shape: [worldX, worldZ], minDistance: 4, tries: 20 }, rng);
const points = pds.fill();   // [[x, z], ...]  — pass a seeded rng for reproducibility
```

`minDistance` controls density; pass a `distanceFunction` for variable density (e.g. denser
near water). The second constructor arg is an injectable RNG → deterministic with a seed.

## Large vegetation fields

For performance-critical fields needing per-instance culling/LOD/raycasting, prefer
**`@three.ez/instanced-mesh` (InstancedMesh2)** — drop-in enhanced `InstancedMesh` with
per-instance frustum culling, BVH spatial indexing, LOD (incl. shadow LOD), sorting (fixes
overdraw/transparency), per-instance visibility/opacity. Combine with `three-mesh-bvh` for
terrain snapping.

```js
import { InstancedMesh2 } from '@three.ez/instanced-mesh';
const trees = new InstancedMesh2(geometry, material);
trees.addInstances(count, (obj, i) => { obj.position.set(/* ... */); });
```

## GPU grass

The modern recipe: `InstancedMesh` (or `InstancedBufferGeometry`) of small per-blade
quads/triangles (5 verts/blade is common), **chunked per-region** for free frustum culling, with
**wind done 100% in the vertex shader** from a `time` uniform. Bend is **pinned at the root**
(angle 0 at base) and **eased toward the tip** (`pow(uv.y, 2.0)`), driven by layered sines or a
scrolling noise texture sampled by world position.

```glsl
float h = uv.y;                          // 0 root → 1 tip
float ang = sin(uTime * freq + dot(bladeWorldPos.xz, dir)) * amplitude * pow(h, 2.0);
mat3 rot = mat3(cos(ang),0.,sin(ang), 0.,1.,0., -sin(ang),0.,cos(ang));
vec3 displaced = rot * localPos;         // base unmoved (localPos.y≈0 there)
```

Reference repos to crib from: **SimonDev `Quick_Grass`** (Ghost-of-Tsushima technique, MIT),
**spacejack/terra** (grass-on-terrain), **al-ro** (100k instanced quads, two-sine wind), Codrops
2025 "Fluffy Grass" (chunked InstancedMesh + 3 LOD levels). Scaling past ~1M blades: watch
**overdraw/fill-rate** (not triangle count) — use quad-clump LODs, front-to-back sorting, or move
placement to WebGPU compute. In TSL, author the wind in `material.positionNode`.

## R3F / drei helpers

In react-three-fiber, `@react-three/drei` (`^10`) wraps these declaratively:
- `<Instances limit range>` + `<Instance position rotation scale color>` — declarative
  InstancedMesh. Set `frustumCulled={false}` for scene-spanning clouds.
- `<Merged meshes={nodes}>` — one draw call per distinct loaded GLTF mesh.
- `<Sampler weight transform count>` / `useSurfaceSampler(mesh, count, transform, weight, instMesh)`
  — wraps `MeshSurfaceSampler` into an `<instancedMesh>`.
- `<ComputedAttribute name compute>` — build the per-vertex weight attribute for `<Sampler>`.
- `<Clone object>` — shallow-copy loaded fragments (uses `SkeletonUtils.clone` for skinned).
