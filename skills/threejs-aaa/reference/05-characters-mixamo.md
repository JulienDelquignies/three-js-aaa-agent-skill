# Characters: Mixamo Pipeline, Animation, Controllers

Table of contents
- [End-to-end pipeline](#end-to-end-pipeline)
- [Mixamo workflow](#mixamo-workflow)
- [FBX → glTF conversion](#fbx--gltf-conversion)
- [Loading in Three.js](#loading-in-threejs)
- [Cloning skinned meshes](#cloning-skinned-meshes)
- [Animation system](#animation-system)
- [State machine](#state-machine)
- [Physics character controller](#physics-character-controller)
- [Retargeting (Mixamo → other rigs)](#retargeting-mixamo--other-rigs)
- [IK, morph targets, VRM](#ik-morph-targets-vrm)
- [Gotchas](#gotchas)

## End-to-end pipeline

**Offline (do once):** model → T-pose → Mixamo auto-rig → download base **with skin** +
animations **without skin** → Blender merge clips onto one armature → export GLB → optimize
with glTF-Transform. **Runtime:** `GLTFLoader` → `SkeletonUtils.clone` per instance → one
`AnimationMixer` → action map → state machine + physics. The `convert-character.mjs` script
automates the conversion/optimization half.

## Mixamo workflow

- **Auto-rig:** upload a humanoid mesh as **FBX** (Embed Media on), roughly **T-pose**, arms
  out. Place markers on chin, wrists, elbows, knees, groin → ML rigger produces a skinned
  skeleton in minutes. "No Fingers" gives a lighter rig.
- **Skeleton naming:** `mixamorig` prefix. In FBX the separator is a colon (`mixamorig:Hips`);
  loaders often turn it into nothing or `_` (`mixamorigHips`). Canonical bones: `Hips` (root),
  `Spine/Spine1/Spine2`, `Neck`, `Head`, `LeftShoulder/Arm/ForeArm/Hand`,
  `LeftUpLeg/Leg/Foot/ToeBase` (mirror Right). **Always normalize the separator in code.**
- **Download:** base character **WITH skin** in T-pose (FBX); each animation **WITHOUT skin**
  (animation-only). Standard pattern: ship the mesh once, recombine many clips in Blender.
- **In Place:** check it for locomotion (walk/run) so the root stays put and **your code drives
  movement** — the common Three.js choice. Unchecked, world translation rides on the **hips**
  (Mixamo has no dedicated root bone) and you must extract it for root motion.

## FBX → glTF conversion

glTF/GLB is runtime-native for Three.js: first-class `GLTFLoader`, single binary, Draco/Meshopt
compression, PBR + morph targets. FBX works (`FBXLoader`) but is heavier/slower.

| Tool | Command | Notes |
|---|---|---|
| **Blender** (most control) | Import FBX → Export glTF 2.0 (.glb) | Use "Automatic Bone Orientation"; Mixamo FBX imports at **0.01 scale** (apply it); merge clips as NLA strips → "Group by NLA Track". |
| **glTF-Transform** | `gltf-transform meshopt in.glb out.glb` | Modern optimizer; also `draco`, `quantize`, `merge`. |
| **FBX2glTF** | `FBX2glTF -b -i in.fbx -o out` | Fast CLI; `--draco`; no clip merging. |
| **gltfpack** | `gltfpack -i in.glb -o out.glb -cc` | Meshopt; good for animated data. |
| Online mergers | mixamo2gltf.com, Mixamo2GLBAnimationMerger | One-shot "N FBX → single GLB with all clips". |

**Meshopt** (decoded via `MeshoptDecoder`) compresses geometry **and animation/morph** data —
generally best for animated characters. **Draco** = best ratio for static geometry. Don't
double-compress.

## Loading in Three.js

```js
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const loader = new GLTFLoader();
const draco = new DRACOLoader(); draco.setDecoderPath('/draco/'); loader.setDRACOLoader(draco);
loader.setMeshoptDecoder(MeshoptDecoder);

const gltf = await loader.loadAsync('/character.glb');
const model = gltf.scene;          // contains SkinnedMesh + Bones
const clips = gltf.animations;     // THREE.AnimationClip[]
```

Access bones: traverse for the `SkinnedMesh`, then `mesh.skeleton.bones[]`, or
`scene.getObjectByName('mixamorigHips')`. Visualize with `new THREE.SkeletonHelper(model)`.

## Cloning skinned meshes

**Never `Object3D.clone()` a skinned character** — clones keep referencing the *original*
bones and all animate identically. Use `SkeletonUtils.clone`, which rebuilds the bone hierarchy
and rebinds each `SkinnedMesh` to its own skeleton while sharing geometry/materials:

```js
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
const instance = cloneSkinned(model);   // independent skeleton, shared GPU buffers
```

## Animation system

One `AnimationMixer` per character; drive it with a `Clock` delta.

```js
const mixer = new THREE.AnimationMixer(model);
const actions = Object.fromEntries(clips.map(c => [c.name, mixer.clipAction(c)]));
actions.Idle.play();
// loop: mixer.update(clock.getDelta());
```

`AnimationAction` surface: `.play() .stop() .reset() .setLoop(THREE.LoopRepeat|LoopOnce, n)
.clampWhenFinished .setEffectiveWeight(w) .setEffectiveTimeScale(s) .fadeIn(t) .fadeOut(t)
.crossFadeTo(target, dur, warp) .crossFadeFrom(...)`.

Blend locomotion two ways:
- **Weight blending** — play idle/walk/run together, interpolate weights `(1,0,0)→(0,1,0)→
  (0,0,1)` by speed.
- **Crossfade with warp** — `from.crossFadeTo(to, dur, true)`; sync fades to the mixer's
  `'loop'` event so feet stay in phase.

**Additive** layers (aim/lean/look on top of locomotion):

```js
const add = THREE.AnimationUtils.makeClipAdditive(lookClip);  // subtracts rest pose
const a = mixer.clipAction(add);
a.blendMode = THREE.AdditiveAnimationBlendMode;
a.setEffectiveWeight(0.7); a.play();
```

## State machine

Use an explicit FSM (states own `enter/update/exit`) rather than nested `if`s — it scales to
AAA movesets. Drive transitions from `grounded` + horizontal speed:

```js
class State { enter(){} update(dt){} exit(){} }
class Idle extends State {
  enter(){ this.ctx.fade('Idle', 0.2); }
  update(){ if (this.ctx.speed > 0.1) this.ctx.set('Walk'); }
}
// fade(name): actions[name].reset().fadeIn(0.2).play(); previous.fadeOut(0.2)
// Scale Walk/Run playback: actions.Run.setEffectiveTimeScale(speed / runRefSpeed)
```

States to model: `Idle / Walk / Run / Jump / Fall` (+ combat/interaction as needed). See
`assets/starter/src/game/Character.js` for a working implementation.

## Physics character controller

Recommended: **Rapier** (`@dimforge/rapier3d-compat` vanilla, or `@react-three/rapier` for R3F).
`cannon-es` is the lighter pure-JS alternative.

Canonical capsule pattern:
- Player = **capsule collider** on a `RigidBody`, or Rapier's `KinematicCharacterController`
  (`world.createCharacterController(offset)`) for auto step/slope handling — often preferable.
- **Grounded check:** cast a ray straight down from the capsule base each frame; gate jumping.
- The rigged GLB visual is a **child** of the physics body.
- The state machine reads `grounded` + horizontal velocity to pick the animation.
- **Follow camera:** lerp/spring toward `body.position + offset`.

```js
import RAPIER from '@dimforge/rapier3d-compat';
await RAPIER.init();
const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
world.createCollider(RAPIER.ColliderDesc.capsule(0.6, 0.3), body);
const controller = world.createCharacterController(0.01);
// each frame: controller.computeColliderMovement(collider, desiredMove); apply corrected movement
```

## Retargeting (Mixamo → other rigs)

`SkeletonUtils.retargetClip` exists but is **unreliable** across glTF rigs (bind-matrix/bone-
orientation bugs, no official examples). For Mixamo → a different rig (Ready Player Me, VRM,
custom), prefer the **manual rest-pose recipe**:

1. Build a bone-name map (`mixamorigHips → hips`, …).
2. For each Mixamo bone, capture its **rest-pose world quaternion** (and inverse) and its
   **parent's rest world quaternion**.
3. For each rotation keyframe: `quat.premultiply(parentRestWorldRotation).multiply(restRotationInverse)`
   (+ a global Y-flip when handedness differs).
4. Scale the hips translation track by `targetHipsHeight / motionHipsHeight` (and the 0.01 unit
   scale) so motion fits the avatar.
5. Rebuild as fresh `QuaternionKeyframeTrack`/`VectorKeyframeTrack` → new `AnimationClip` bound
   to the target bone names.

Ready-made: `vrm-mixamo-retarget` (`retargetAnimation(fbxAsset, vrm, opts)` → `AnimationClip`,
auto bone-map + height scaling). Offline mergers (mixamo2gltf.com) bake many clips into one GLB.
Runtime blending is plain Three.js (`AnimationMixer` weights/crossfade/additive) — no extra lib.

## IK, morph targets, VRM

- **IK:** `CCDIKSolver` (`three/addons/animation/CCDIKSolver.js`) — configure `iks` chains
  (`{target, effector, links, iteration}`), call `solver.update()` after `mixer.update()`. Good
  for **foot IK** on uneven terrain (raycast down from each foot, pin via IK) and look-at.
  `CCDIKHelper` visualizes. Alternative: `THREE.IK` (FABRIK, standalone).
- **Morph targets / blend shapes:** Blender shape keys → glTF morph targets →
  `mesh.morphTargetInfluences[]` + `mesh.morphTargetDictionary` (name→index). Three.js supports
  effectively unlimited morphs (GPU texture-packed). Drive ARKit blendshapes (`jawOpen`,
  `mouthSmile`) for facial/lip-sync.
- **VRM:** `@pixiv/three-vrm` with `VRMLoaderPlugin` on `GLTFLoader`; `gltf.userData.vrm` gives
  a `VRM` with `VRMHumanoid` normalized bones (`vrm.humanoid.getNormalizedBoneNode('hips')`).
  Call `vrm.update(delta)` each frame (advances spring-bone physics + expressions). Normalization
  is what makes Mixamo retargeting tractable.

## Gotchas

- `SkeletonUtils.clone`, never `Object3D.clone()`, for skinned meshes.
- Mixamo FBX imports at **0.01 scale**; apply it.
- Bone separator `:` gets mangled across loaders — normalize names.
- `retargetClip` is unreliable across rigs — use the manual rest-pose recipe.
- Don't double-compress (Draco *or* Meshopt).
- "In Place" clips = you drive movement; non-in-place = translation rides on the hips.
