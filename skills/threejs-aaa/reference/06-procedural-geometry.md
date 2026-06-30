# Procedural Geometry

Table of contents
- [BufferGeometry from code](#buffergeometry-from-code)
- [Extrude / Lathe / Tube](#extrude--lathe--tube)
- [ParametricGeometry](#parametricgeometry)
- [CSG boolean operations](#csg-boolean-operations)
- [Merging & instancing for procedural kits](#merging--instancing-for-procedural-kits)
- [L-systems (plants, trees)](#l-systems-plants-trees)
- [Structures: cities, dungeons, WFC](#structures-cities-dungeons-wfc)
- [Roads / splines](#roads--splines)
- [Determinism](#determinism)

## BufferGeometry from code

All geometry is `BufferGeometry` built from typed arrays in `BufferAttribute`s.

```js
const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
  0,0,0,  1,0,0,  0,1,0,
]), 3));
geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0,0, 1,0, 0,1]), 2));
geometry.setIndex(new THREE.BufferAttribute(new Uint16Array([0,1,2]), 1)); // Uint32 if ≥65536 verts
geometry.computeVertexNormals();    // derives the 'normal' attribute
geometry.computeBoundingSphere();   // after building/editing — needed for frustum culling/raycast
```

Rules:
- Winding is counter-clockwise for front faces; it sets the sign of computed normals.
- Use `Uint32Array` index when vertex count ≥ 65536.
- After mutating attribute data: `attribute.needsUpdate = true` and recompute bounds/normals.

## Extrude / Lathe / Tube

```js
// Extrude a 2D Shape (optionally swept along a curve)
const shape = new THREE.Shape(); shape.absarc(0, 0, 10, 0, Math.PI*2, false);
const extrude = new THREE.ExtrudeGeometry(shape, {
  depth: 20, bevelEnabled: true, bevelThickness: 2, bevelSize: 1, bevelSegments: 3, steps: 1,
});
// Sweep along a path instead of straight depth: { steps: 60, bevelEnabled: false, extrudePath: curve }

// Lathe — revolve a 2D half-profile (Vector2: x=radius, y=height) around Y
const profile = [new THREE.Vector2(0,0), new THREE.Vector2(1,0), new THREE.Vector2(0.3,3)];
const lathe = new THREE.LatheGeometry(profile, 32);

// Tube — constant-radius tube along a Curve
const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0,0,0), new THREE.Vector3(10,5,0)]);
const tube = new THREE.TubeGeometry(curve, 64, 2, 8, false);
```

## ParametricGeometry

Moved to addons (no longer `THREE.ParametricGeometry`):

```js
import { ParametricGeometry } from 'three/addons/geometries/ParametricGeometry.js';
const geo = new ParametricGeometry((u, v, target) => {
  // u, v in [0,1]; write the surface point into target (Vector3)
  target.set(u * 10, Math.sin(u*6.28) * 2, v * 10);
}, 50, 50);
```

## CSG boolean operations

Use **`three-bvh-csg`** (BVH-accelerated, ~100× faster than BSP, viable in real time). Needs
`three-mesh-bvh` installed alongside.

```js
import { Brush, Evaluator, SUBTRACTION, ADDITION, INTERSECTION } from 'three-bvh-csg';

const a = new Brush(new THREE.BoxGeometry(2, 2, 2));      a.updateMatrixWorld();
const b = new Brush(new THREE.SphereGeometry(1.3, 32, 16)); b.position.y = 0.5; b.updateMatrixWorld();

const evaluator = new Evaluator();
const result = evaluator.evaluate(a, b, SUBTRACTION);     // returns a Brush/Mesh
scene.add(result);
```

Operations: `ADDITION`, `SUBTRACTION`, `REVERSE_SUBTRACTION`, `DIFFERENCE` (symmetric),
`INTERSECTION`, plus non-solid `HOLLOW_SUBTRACTION` / `HOLLOW_INTERSECTION`.

Requirements:
- **All brush geometry must be two-manifold (water-tight, no self-intersections).** Use
  primitive geometries or clean meshes; messy input yields slightly non-manifold output.
- Call `updateMatrixWorld()` on each brush before evaluating.
- Reuse one `Evaluator` and reuse `Brush` instances across frames for dynamic/destructible CSG.
- `three-bvh-csg` is pre-1.0 (`0.0.x`) — **pin the version**, expect occasional API churn.

Simpler legacy option: `three-csg-ts` (`CSG.subtract/union/intersect(meshA, meshB)`, call
`mesh.updateMatrix()` first) — BSP-based, slower, stable typed API; fine for one-off ops.

## Merging & instancing for procedural kits

Build complex props from primitive kits, then collapse draw calls:

```js
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
const merged = mergeGeometries([partA, partB, partC]);   // one geometry, one draw call
```

For many copies of the same part, use `InstancedMesh` (see `08-scattering-instancing.md`).

## L-systems (plants, trees)

`lindenmayer` (`^1.5.4`, render-agnostic — you supply the turtle). Iterate the grammar, then
walk the string with a turtle that emits cylinders per `F`:

```js
import LSystem from 'lindenmayer';
const tree = new LSystem({ axiom: 'F', productions: { F: 'FF-[-F+F+F]+[+F-F-F]' } });
tree.iterate(4);
const str = tree.getString();
// Turtle: heading quaternion; '[' push state, ']' pop, +/-/&/^// rotate, F → CylinderGeometry
// between old & new position (taper radius with depth). Merge all branch geos for 1 draw call.
```

Better-looking trees: **space colonization** (grow branches toward a cloud of attractor points;
params `attractionDistance`, `killDistance`, `segmentLength`; use a k-d tree for nearest-node
queries). Three.js port reference: `dsforza96/tree-gen`.

## Structures: cities, dungeons, WFC

- **Dungeons:** `rot-js` (`^2.2.1`, actively maintained) — `ROT.Map.Digger/Uniform/Rogue/
  Cellular` generate a 2D grid you extrude to 3D (instanced wall boxes, merged floor). Bundles
  a seeded `ROT.RNG`, FOV, A*/Dijkstra pathfinding.
  ```js
  import * as ROT from 'rot-js';
  const map = new ROT.Map.Digger(80, 40);
  map.create((x, y, v) => { /* v: 0=floor, 1=wall → build geometry */ });
  ```
- **Cities:** no dominant library — crib from `jstrait/city-tour` (roads + terrain + buildings),
  `threex.proceduralcity` (cheap instanced skyline). Recipe: road network (grid/L-system/Voronoi)
  → parcel into lots → per-lot extruded buildings (instanced/atlas).
- **WaveFunctionCollapse:** `wavefunctioncollapse` (`^2.1.0`, kchapelier) for 2D Overlapping/
  SimpleTiled; **`ndwfc` + `ndwfc-tools`** (GitHub only, not npm) for **3D tile worlds** —
  `WFCTool3D` derives adjacency from tile edges and can render to Three.js. For 3D tiles: give
  each tile 6 face socket IDs; neighbors allowed iff facing sockets match.

## Roads / splines

```js
const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5); // centripetal avoids cusps
const pts = curve.getSpacedPoints(200);   // arc-length-uniform — place segments/props evenly
// Flat road ribbon: per sample take curve.getTangentAt(t) × up → lateral; emit ±halfWidth edges.
```

## Determinism

Never `Math.random()` for procedural content (not seedable → not reproducible). Use a seeded
PRNG and derive **independent sub-seeds per subsystem** so changing one system doesn't shift
the others. See `engine/rng.js` in the starter, and:

```js
import prand from 'pure-rand';
const seed = 1234;
let rng = prand.xoroshiro128plus(seed);
const [n, next] = prand.uniformIntDistribution(0, 100, rng); rng = next;
// Inject into consumers: createNoise2D(() => prand.unsafeUniformIntDistribution(0, 2**32, rng)/2**32)
// poisson-disk-sampling takes an RNG as 2nd constructor arg; rot-js has ROT.RNG.setSeed().
```
