# AI Characters: Rigging, Motion Capture, Facial Animation

Going beyond Mixamo (humanoid-only auto-rig, fixed clip library, no face, no creatures, no live
capture). This file covers AI auto-rigging, AI mocap, text-to-motion, audio-to-face, and in-browser
real-time tracking — and the licensing landmines.

> Marked **(verify)** = changes often (pricing/APIs). **The biggest risk is text-to-motion licensing**
> (see §3): the code is permissive but the training datasets are non-commercial.

Table of contents
- [Auto-rigging beyond Mixamo](#auto-rigging-beyond-mixamo)
- [AI motion capture from video](#ai-motion-capture-from-video)
- [Text-to-motion generation](#text-to-motion-generation)
- [Audio-to-face / lip-sync](#audio-to-face--lip-sync)
- [In-browser real-time tracking](#in-browser-real-time-tracking)
- [Retargeting onto your rig](#retargeting-onto-your-rig)
- [Recommended pipelines](#recommended-pipelines)

## Auto-rigging beyond Mixamo

- **Reallusion AccuRIG** — free desktop app (GUI, no API). Humanoid auto-rig with **better weight
  painting and finger rigging than Mixamo**, local (no cloud upload), exports FBX. Skeleton is
  Reallusion's (retarget by bone-name map). Best free humanoid rigger.
- **Anything World** — the standout for **creatures/arbitrary meshes**: cloud **REST API** (base
  `https://api.anything.world`, key as `?key=` query param), async (`POST /rig` or `/animate` →
  poll `GET /user-processed-model` → download **GLB/FBX/glTF**). Handles humanoids **and quadrupeds/
  animals**. **Has a free tier** (Individual, <$100K annual revenue) — commercial use with
  **attribution required** ("Animated by Anything World"). The main API-callable option for non-humanoids.
- **Meshy / Tripo** — their generated humanoids ship **auto-rig + animation** export (GLB/FBX), API-accessible.
- **Meshcapade** — SMPL/SMPL-X parametric humans. **Note: its public API shut down ~Apr 2025 after
  the Epic Games acquisition; treat as unavailable.** SMPL outputs are also non-commercial by default.
- **Research**: RigNet / RigAnything (neural skeleton+skinning prediction for arbitrary shapes) — not turnkey.

## AI motion capture from video

**Commercial (offline/cloud batch → file you retarget):**

| Service | Output | API | Notes |
|---|---|---|---|
| **DeepMotion Animate 3D** | FBX/BVH/glTF/GLB | **REST async** | face + hand, physics filters, retarget. Credit-based, commercial on paid. |
| **Move.ai** | FBX/USD/BVH | limited/enterprise (verify) | best quality, esp. multicam. |
| **Rokoko Video** | FBX/BVH | Studio app + LAN Command API + live-stream SDK (Blender/Unity/UE); no cloud REST | **free Starter tier** (FBX, video-to-motion, ~150 commercial-usable clips, retargets to Mixamo). |
| **Plask** | FBX/BVH/glTF | (verify) | browser-based mocap + editor. |

**Open-source / research:**
- **MediaPipe Pose (BlazePose)** — the browser-runtime option: real-time 33 landmarks + 3D world
  landmarks via `@mediapipe/tasks-vision`, **Apache-2.0** (commercial OK). Lower fidelity than offline
  SMPL models but the only practical **webcam → pose at runtime on the web**.
- **WHAM / GVHMR / 4D-Humans (HMR2.0)** — SOTA video→**SMPL** (WHAM/GVHMR are world-grounded, handle
  camera motion). Research licenses, offline GPU. Output = SMPL params → convert to BVH/FBX → retarget.

## Text-to-motion generation

Generate animation from a text prompt, then retarget onto your rig.

- **MoMask** (2024 SOTA, sharp/fast), **MDM** (Motion Diffusion Model), **MotionGPT**, **T2M-GPT** —
  all use the HumanML3D 22-joint representation → convertible to BVH.
- **⚠️ THE KEY LICENSING TRAP:** the *code* is MIT/Apache, but these models are **trained on HumanML3D /
  AMASS, which are licensed for research / non-commercial use only**. The permissive code license does
  **not** clear the trained weights or generated motion for commercial shipping. MotionGPT's README says
  this explicitly. **For a commercial game, treat text-to-motion output as prototyping-only** until you
  clear SMPL (smpl.is.tue.mpg.de) and AMASS (amass.is.tue.mpg.de) terms.
- **Cascadeur** — physics-assisted desktop animation with AI **AutoPosing/AutoPhysics/interpolation**.
  Not text-to-motion, but **commercially clean** (license by revenue threshold), exports FBX, has a
  Python API. The safe production choice for AI-assisted animation + mocap cleanup.

## Audio-to-face / lip-sync

Target an **ARKit-52-blendshape avatar** (e.g. Ready Player Me, which ships ARKit blendshapes + visemes
as morph targets in GLB) so every face source maps the same way.

- **MediaPipe FaceLandmarker** (`@mediapipe/tasks-vision`) — outputs **52 ARKit-compatible blendshape
  coefficients** in-browser, real-time, **Apache-2.0**. Feed straight into `mesh.morphTargetInfluences`.
  The cleanest free, commercial-OK route for **live webcam facial animation** on the web.
- **TTS visemes** — Azure & AWS Polly emit **viseme events with timestamps** → drive morph targets at
  runtime. Ideal for TTS-driven avatars.
- **Rhubarb Lip Sync** — open-source (MIT), offline: audio → mouth visemes with timing. Build-time,
  deterministic, free. Map visemes to morph targets.
- **NVIDIA Audio2Face** — open-sourced 2025 (+ Audio2Face-3D NIM microservice with API), highest
  quality, maps to ARKit blendshapes. Heavy for pure-web — run as a **server/build-time** step that
  bakes blendshape tracks into the GLB. (verify license tag)

## In-browser real-time tracking

- **`@mediapipe/tasks-vision`** — PoseLandmarker / FaceLandmarker / HandLandmarker; WASM + GPU delegate;
  Apache-2.0. Primary choice for live webcam → character.
- **TensorFlow.js** — MoveNet (fast 2D), BlazePose (3D); generally lower 3D fidelity than MediaPipe.
- **Mapping landmarks → bones**: convert landmark directions to **bone quaternions** (parent→child
  look-at) or solve light IK, then write `bone.quaternion`. **`@pixiv/three-vrm`**'s normalized
  humanoid pairs well with this. **Kalidokit** maps MediaPipe Holistic → VRM/Three.js bones + morphs
  (older, built on legacy Holistic — verify it works with current `tasks-vision`, may need an adapter).
- **Morph targets**: `mesh.morphTargetInfluences[mesh.morphTargetDictionary['<name>']] = value` per frame.

## Retargeting onto your rig

- `SkeletonUtils.retargetClip(target, source, clip, options)` remaps an `AnimationClip` between
  skeletons by **bone-name map**. (See `05-characters-mixamo.md` — it's unreliable across some glTF
  rigs; the manual rest-pose recipe there is the robust fallback.)
- **Pitfalls**: bone-name mismatch (normalize to `mixamorig:` names), hip-height/scale differences,
  rest-pose orientation (T-pose vs A-pose), root motion. Get everything onto a **shared rest pose +
  naming convention** before retargeting.
- **Format**: convert AI mocap FBX → GLB (FBX2glTF/Blender) for the web; play with `AnimationMixer`.

## Recommended pipelines

**Humanoid character, fully-licensed, web-friendly:**
1. Mesh → **AccuRIG** (free, local, great hands) or **Ready Player Me** avatar (pre-rigged + ARKit face).
2. Body animation: Mixamo clips + **AI mocap** (Move.ai/DeepMotion → FBX/glTF), polished in **Cascadeur**.
3. Convert FBX→GLB, retarget with `SkeletonUtils` / rest-pose recipe, play via `AnimationMixer`.
4. Face: live → **MediaPipe FaceLandmarker → morph targets**; speech → **TTS visemes** or **Rhubarb**/Audio2Face.

**Creature / arbitrary mesh:** swap the rig step to **Anything World API** (auto-rig + animation → GLB).

**Live performance capture (browser):** `@mediapipe/tasks-vision` Pose + Face → drive a VRM/RPM avatar
via `@pixiv/three-vrm` — all Apache-2.0, runs at runtime, no server.

**Licensing reminders:** prefer **Cascadeur / licensed mocap / MediaPipe (Apache-2.0)** for commercial
work; treat **text-to-motion (MDM/MoMask/…) as prototyping-only** due to AMASS/HumanML3D dataset terms.
