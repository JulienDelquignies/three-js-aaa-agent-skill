# Showcase — the scene gallery

A small multi-page Vite app that presents the skill's runnable scenes behind a home page you can browse.
Each card opens a live, interactive preview. **Live:** https://threejs-aaa-showcase.vercel.app

## Scenes
- **Contrôles — jouable** (`controls.html`) — drive the Soldier with WASD/ZQSD/arrows or a gamepad
  (camera-relative); built on the native `CharacterController`: faces where it moves (no moonwalk),
  **Idle→Walk→Run** animation state machine (blends by speed — analog stick or during accel/decel), no
  foot-skate, dribbles the ball, Space shoots along its facing, Shift crosses, third-person follow camera.
- **Physique — jouable** (`physics.html`) — real Rapier collisions: the Soldier can't pass the walls,
  climbs the ramp/steps, pushes crates, and kicks the ball (dynamic bodies). Kinematic capsule character
  via `engine/physics.js` wired into `CharacterController.collide`. A red-tinted **AI opponent**
  (`engine/steering.js`) contests the ball, driven through the same controller. Kick sparks + run dust
  via `engine/particles.js`.
- **Soldier Volley** (`volley.html`) — the cinematic done right: a **dribbler** carries the ball down the
  wing and **crosses**, a **striker** (cloned rig) runs on and **volleys** into the net. Each player faces
  its run; validation on `window.__volleyReport` asserts no-moonwalk + shots-toward-target.
- **Matériaux PBR** (`materials.html`) — a lineup of spheres under image-based lighting: clearcoat,
  glass/transmission, brushed metal, gold, iridescence, velvet (sheen). Orbit to inspect.
- **Monde procédural** (`procedural.html`) — a seeded fBm-noise terrain, height-based coloring, water,
  and instanced rock/tree scatter. Deterministic from a seed. Orbit to explore.
- **IK & Interaction** (`interaction.html`) — a two-bone arm tracks a moving target with analytic IK;
  the effector turns green when it reaches the target, red when out of reach (the runtime correctness check).
- **Géométrie procédurale** (`geometry.html`) — a museum of code-authored meshes: lathe vase, extruded
  gear with bore, tube along a curve, torus knot, faceted gem, twisted shell. No imported models.
- **Post-processing · Bloom** (`neon.html`) — a dark set of emissive neon shapes so the TSL bloom pass
  reads clearly; the scene dims the inherited IBL/fog so emissive dominates.
- **Océan · Gerstner** (`ocean.html`) — a surface displaced by summed Gerstner waves (CPU, animated) with
  a physical water material and a bobbing buoy.
- **Champ d'herbe** (`grass.html`) — 6000 grass blades scattered on rolling ground as a single
  InstancedMesh (one draw call), bending in a travelling wind, with scattered flowers.

All scenes share `src/engine/` (WebGPU renderer + IBL + post-processing) and `src/runner.js`, which boots
the engine and runs a scene either as a **cinematic** (if it exposes `setTime`) or **interactive** (orbit +
`update(dt)`). A `?capture` flag renders one deterministic frame for headless thumbnails.

## Run / build
```bash
npm install
npm run dev            # open the printed localhost URL
npm run build          # → dist/ (multi-entry: index + one page per scene)
```

Thumbnails on the home page (`public/thumb-*.png`) are captured headlessly from the built scenes; regenerate
them with the skill's capture flow (`?capture&webgl` + `window.__seekFrame`).

## Notes
- Rendered headless it falls back to software WebGL (append `?webgl`); on a real GPU it's sharper with the
  full post stack.
- `Soldier.glb` is a Mixamo character from the three.js examples, included for demonstration only.
