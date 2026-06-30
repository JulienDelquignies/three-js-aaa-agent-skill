# Performance

Target **< 100 draw calls/frame** and a stable 60fps (16.6ms). Draw-call count is the master
metric; overdraw/fill-rate is the usual second bottleneck.

Table of contents
- [Measure first](#measure-first)
- [Draw-call reduction](#draw-call-reduction)
- [Culling & LOD](#culling--lod)
- [Asset compression](#asset-compression)
- [Memory hygiene](#memory-hygiene)
- [Quality tiers](#quality-tiers)

## Measure first

```js
console.log(renderer.info.render.calls);     // draw calls this frame
console.log(renderer.info.render.triangles); // triangles
console.log(renderer.info.memory);           // geometries + textures resident
```

Add `stats-gl` (FPS/CPU/GPU overlay, works on WebGL **and** WebGPU). Use Spector.js to capture a
frame and inspect per-draw cost. Profile before optimizing — most scenes are bound by draw calls
or overdraw, not raw triangle count.

## Draw-call reduction

- **`InstancedMesh`** — same geometry+material, many transforms → 1 call. (9,000 objects → ~300.)
- **`BatchedMesh`** — different geometries sharing a material → 1 call, with per-instance frustum
  culling + sorting. Verify CPU overhead on your Three.js version for very large batches.
- **`mergeGeometries()`** (`BufferGeometryUtils`) — merge static geometry at load time.
- **Share materials** — each unique material is a state change; reuse instances.
- **Texture atlases** — combine textures so more meshes share one material.
- On WebGPU: `instancedArray` / compute shaders keep instance buffers GPU-persistent (no
  per-frame CPU→GPU upload).

## Culling & LOD

- **Frustum culling** is automatic per object — keep correct bounding volumes
  (`computeBoundingSphere()` after editing geometry). Only disable `frustumCulled` for
  instanced/batched megameshes you cull yourself.
- **`THREE.LOD`** — swap mesh detail by distance (30–40% frame-time win in dense scenes):
  ```js
  const lod = new THREE.LOD();
  lod.addLevel(highMesh, 0);
  lod.addLevel(midMesh, 30);
  lod.addLevel(lowMesh, 100);
  scene.add(lod);   // lod.update(camera) each frame (Three handles it during render)
  ```
- For vegetation, use InstancedMesh2 LOD or BatchedMesh per-object LOD (see `08`).

## Asset compression

- **Geometry:** **Meshopt** (`MeshoptDecoder`) — great ratio, fast decode, compresses animation
  too; preferred for runtime-critical/animated loads. **Draco** (`DRACOLoader`) — best ratio for
  static geometry, slower decode. Pick one, never both.
- **Textures:** **KTX2 + Basis** (`KTX2Loader`) — stays GPU-compressed, ~10× VRAM reduction.
  UASTC for normal/data maps (quality), ETC1S for albedo (size).
- **Pipeline:** `glTF-Transform` applies Meshopt/Draco + KTX2 + dedup/prune in one step:
  ```bash
  gltf-transform optimize in.glb out.glb --texture-compress ktx2
  ```
- Cap `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))` — rendering at 3× DPR quadruples
  fragment cost for little visible gain.

## Memory hygiene

Dispose everything you discard, or VRAM leaks across scene changes:

```js
geometry.dispose();
material.dispose();
texture.dispose();
renderTarget.dispose();
// For ImageBitmap textures: texture.source.data.close?.()
```

Pre-warm object pools at load to avoid runtime GC spikes. Reuse `Vector3`/`Matrix4`/`Quaternion`
scratch objects in hot loops instead of allocating per frame.

## Quality tiers

Ship low/medium/high presets driven by one config object so you can scale to the device:

| Setting | Mobile | Desktop | Hero |
|---|---|---|---|
| Pixel ratio cap | 1.5 | 2 | 2 |
| Shadow map size | 512–1024 | 2048 | 4096 |
| CSM cascades | 2 | 4 | 4 |
| Post stack | bloom + SMAA | + GTAO + DOF | + SSR (gated) |
| Dynamic lights | 1 | ≤3 | ≤3 |
| Instanced LOD bias | aggressive | balanced | quality |

Detect WebGPU support and fall back gracefully (WebGPURenderer does this automatically for the
renderer; also scale the post stack and shadow budget down on the fallback path).
