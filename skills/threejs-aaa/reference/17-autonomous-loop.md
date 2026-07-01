# The Autonomous Build → See → Fix Loop

This is the capstone: an agent-driven loop that iterates a scene toward the AAA rubric on its own,
because the agent can **see** its render (`capture.mjs` + Read) and knows the fixes (this skill).
It is zero-cost (Playwright/Chromium pre-installed) and was demonstrated end-to-end (see
[Worked example](#worked-example)).

The critique step needs vision, so the loop is **driven by Claude**, not a standalone script — the
scripts provide the eyes (capture), the rubric provides the standard (`16-visual-qa.md`), and the
references provide the fixes.

Table of contents
- [The procedure](#the-procedure)
- [Scoring rubric](#scoring-rubric)
- [Fix selection](#fix-selection)
- [Stop conditions & guardrails](#stop-conditions--guardrails)
- [Worked example](#worked-example)

## The procedure

```
target = scene-correctness (18) + the AAA rubric (16) + a draw-call budget
for iteration in 1..N (N ≈ 4–6 max):
    0. validate PLACEMENT: verify-scene --spec scene.json  ← semantic correctness first
       if not ok → apply report.fixes, re-validate (door in wall, chair faces desk, no clipping,
       rests-on, ball-at-foot, structure orientation). Don't render a spatially-wrong scene.
    1. npm run build                                        (or run dev server)
    2. node scripts/capture.mjs --dir dist --out iterK.png --webgl --max-draws <budget>
    3. Read iterK.png                                       ← LOOK at the render
    4. score it against the rubric → list defects with severity
    5. if placement ok AND no visual defects AND perf gate passed: STOP (ship)
    6. pick the highest-severity defect
    7. apply its mapped fix (table below); keep the change minimal
    8. continue
```

Placement correctness comes first: a door floating in a wall or a goal facing backwards is wrong
before you even judge the lighting. The goal-orientation bug in the football demo is exactly what
step 0 catches (a structure-orientation constraint).

Run it after every substantive scene change as a regression gate, not just once.

## Scoring rubric

Score each dimension pass/fail on the screenshot (details in `16-visual-qa.md`). A compact JSON the
agent can fill and diff between iterations:

```json
{
  "exposure": "pass|fail", "colorManagement": "pass|fail", "ibl": "pass|fail",
  "materials": "pass|fail", "shadows": "pass|fail", "geometry": "pass|fail",
  "antialiasing": "pass|fail", "banding": "pass|fail", "bloom": "pass|fail",
  "composition": "pass|fail", "hardFailure": "none|blackScreen|missingAssets",
  "drawCalls": 57, "drawBudget": 100
}
```

## Fix selection

Highest-leverage first — this ordering reflects what actually moves a web render toward AAA:

| Defect | Fix | Ref |
|---|---|---|
| Placement wrong (float/clip/backwards/through) | `verify-scene` → apply `report.fixes` | `18` |
| Black screen / hard failure | `await renderer.init()`, import paths | `02`, SKILL gotchas |
| Flat/gray reflections, dull metals | add a real CC0 HDRI | `fetch-cc0 --hdri`, `02` |
| Washed-out / wrong colors | color management + color spaces | `02` |
| Blown highlights / hazy bloom | lower exposure, raise bloom threshold | `02`, `04` |
| Plastic untextured surfaces | add CC0 PBR maps (or TSL procedural) | `fetch-cc0 --texture`, `03` |
| No depth / flat staging | gradient sky + fog | starter `Lighting.js` |
| Jaggies | SMAA/TAA | `04` |
| Banding | dithering | `04` |
| Shadow acne / peter-panning | bias / normalBias | `02` |
| Too many draw calls | instancing / batching / LOD | `08`, `09` |

## Stop conditions & guardrails

- **Cap iterations** (≈4–6). If the rubric still fails, report the remaining defects rather than
  looping forever — some need art/assets, not code.
- **One change per iteration** so each capture attributes the effect. Minimal diffs.
- **Headless perf is not real** — SwiftShader FPS/GPU timing is meaningless; judge composition,
  color, materials, shadows, reflections, and the draw-call count, not frame time. Benchmark timing
  on real hardware (`09`).
- **Multi-angle**: capture 2–3 camera positions for a scene (not just the default) so you don't fix
  one view and break another.
- **Parallelize (optional)**: for a big review, a Workflow can capture several angles/scenes and
  critique them concurrently, then synthesize the defect list — but keep the fix step in the main
  agent so changes stay coherent.

## Worked example

This loop was run on the starter scene (zero paid APIs, headless capture):

- **Baseline** — flat dark background, metals reflecting nothing, untextured ground, blown bloom
  haze. 149 draw calls. Defects: `ibl`, `materials(reflection)`, `composition`, `bloom`.
- **Iteration 1 (code only)** — added a gradient sky + `FogExp2`, dropped exposure to 0.9, raised
  bloom threshold to 1.0 / lowered strength. Result: real depth and horizon, contained bloom.
  80 draw calls. Remaining: `ibl` (reflections still procedural), `materials` (ground flat).
- **Iteration 2 (free CC0 assets)** — `fetch-cc0.mjs` pulled a CC0 HDRI (`alps_field`) into
  `public/env/environment.hdr` and a CC0 PBR ground set (`aerial_grass_rock`) into
  `public/textures/ground/`. The starter auto-loads both. Result: metals now reflect the real
  environment (visible horizon in the sphere), ground reads as real terrain, cohesive warm lighting.
  57 draw calls — under budget.

Two iterations, each driven by looking at the render, took the scene from "obviously a demo" to a
cohesive, atmospheric frame — at zero cost. That is the loop.
