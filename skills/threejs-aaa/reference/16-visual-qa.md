# Visual QA — Closing the Perception Loop

You cannot hit "AAA-perfect renders" while coding blind. This is the loop that gets there:
**build → screenshot → look at the image → critique against the rubric → fix → repeat.** It's
zero-cost — Playwright + a Chromium are pre-installed in the Claude Code remote environment, so
the agent captures its own render and reads it back (no paid service).

Table of contents
- [The loop](#the-loop)
- [Capture](#capture)
- [The AAA visual rubric](#the-aaa-visual-rubric)
- [Defect → fix map](#defect--fix-map)
- [Performance gate](#performance-gate)
- [Headless caveats](#headless-caveats)

## The loop

```
1. npm run build                                   (or run the dev/preview server)
2. node scripts/capture.mjs --dir dist --out shot.png --webgl --max-draws 100
3. Read shot.png   ← the agent LOOKS at its own render
4. Critique it against the rubric below; find concrete, fixable defects
5. Apply the fix (each defect maps to a reference file)
6. Go to 1. Stop when the render passes the rubric and the perf gate.
```

This turns "write code and hope" into "write, see, correct" — the only reliable path to visual
quality in a visual medium. Capture snapshots also become **regression tests**: a screenshot + a
draw-call budget that must hold on every change.

## Capture

`scripts/capture.mjs` runs a build in headless Chromium, screenshots it, and reads a perf snapshot
from `window.__engine.renderer.info` (the starter exposes `window.__engine`).

```bash
# From a built dist/ (served locally, zero-dep)
node ${CLAUDE_SKILL_DIR}/scripts/capture.mjs --dir ./dist --out shot.png --webgl --max-draws 100
# Or from a running server
node ${CLAUDE_SKILL_DIR}/scripts/capture.mjs --url http://localhost:5173 --out shot.png --webgl
```

It prints backend, draw calls, triangles, geometry/texture counts, writes `shot.perf.json`, and
exits non-zero if there were page errors or the draw-call budget was exceeded. Then **Read the PNG**
to inspect it. Use `--webgl` in headless environments where WebGPU is unavailable/broken.

## The AAA visual rubric

Check the screenshot against each. Most "not AAA" renders fail one of the first four.

- **Exposure / tone mapping** — highlights not blown to flat white; shadows not crushed to black;
  overall not washed-out (a washed-out image usually means broken color management).
- **Color management** — colors look correct, not muddy/desaturated or oversaturated.
- **IBL / environment** — metals and glossy surfaces reflect a real environment (horizon, sky),
  not a flat gray gradient. Plain reflections = no HDRI → add one.
- **Materials read correctly** — a roughness/metalness sweep should show clear variation; metals
  look metallic (colored specular), dielectrics look plausible.
- **Shadows** — grounded and soft; no shadow acne (bias), no peter-panning (gap under objects), no
  hard aliased edges.
- **Geometry** — no z-fighting (flickering coplanar faces), no visible faceting where it should be
  smooth, correct normals (no black/inverted patches).
- **Antialiasing** — no jaggies on edges (add SMAA/TAA once a post stack exists).
- **Banding** — smooth gradients (sky, fog) have no stair-stepping (add dithering/noise).
- **Bloom / post** — bloom is subtle and driven by genuinely bright/emissive areas, not a blown
  haze over everything.
- **Composition / staging** — subject is framed, lit, and readable; background supports it.
- **No hard failure** — not a black screen (missing `await renderer.init()`), not missing assets.

## Defect → fix map

| You see… | Likely cause | Fix in |
|---|---|---|
| Washed-out / muddy colors | color management / wrong texture color space | `02-rendering.md` |
| Blown-out highlights | exposure too high / bloom threshold too low | `02` (toneMappingExposure), `04` |
| Flat gray reflections, dull metals | no HDRI environment | `fetch-cc0.mjs --hdri`, `02` |
| Plastic, untextured surfaces | no PBR maps | `fetch-cc0.mjs --texture`, `03` |
| Jagged edges | no post-AA | `04` (SMAA/TAA) |
| Banding in sky/fog | no dithering | `04` |
| Shadow acne / peter-panning | shadow bias / normalBias | `02` (shadows) |
| Flickering faces | z-fighting (near/far, coplanar) | adjust camera near/far, offset geometry |
| Black screen | missing `await renderer.init()` / import path mix | `02`, SKILL gotchas |
| Too many draw calls | no instancing/batching | `08`, `09` |

## Performance gate

`--max-draws <n>` fails the run if `renderer.info.render.calls` exceeds the budget — wire it into
CI so a change that balloons draw calls fails the build. Target < 100 for a 60fps scene. The
`shot.perf.json` (draw calls, triangles, geometry/texture counts) is a machine-readable budget record.

## Headless caveats

- The headless Chromium uses **software WebGL (SwiftShader)** — **FPS/GPU timing shown is NOT
  representative** of a real GPU. Use headless capture for **correctness, composition, color,
  materials, shadows, and draw-call budget** — not for frame-time benchmarking. Benchmark timing on
  real hardware (`stats-gl`, `09-performance.md`).
- WebGPU is usually unavailable headless → pass `--webgl`. The image is representative for
  everything except performance; the WebGL and WebGPU paths render the same scene.
- Let the scene settle (`--wait`) so async assets (HDRI, GLB, KTX2) have loaded before the shot.
