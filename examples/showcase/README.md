# Showcase — the scene gallery

A small multi-page Vite app that presents the skill's runnable scenes behind a home page you can browse.
Each card opens a live, interactive preview. **Live:** https://threejs-aaa-showcase.vercel.app

## Scenes
- **Soldier Volley** (`volley.html`) — the cinematic: a real Mixamo rig (`Soldier.glb`) runs in without
  foot-skate (cadence-sync + foot-lock IK), chases a rolling ball and volleys into the net, broadcast
  camera. Deterministic timeline (`setTime(t, camera)`), temporal validation on `window.__volleyReport`.
- **Matériaux PBR** (`materials.html`) — a lineup of spheres under image-based lighting: clearcoat,
  glass/transmission, brushed metal, gold, iridescence, velvet (sheen). Orbit to inspect.
- **Monde procédural** (`procedural.html`) — a seeded fBm-noise terrain, height-based coloring, water,
  and instanced rock/tree scatter. Deterministic from a seed. Orbit to explore.

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
