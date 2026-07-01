# Scene Correctness (Semantic & Spatial Placement)

**This is the skill's job, not the user's.** A AAA scene must be spatially *correct*, not just
pretty: a door sits in the wall opening (not floating, not through it); a chair faces the desk and a
seated character's hips are on the seat, oriented with the chair; furniture doesn't pass through
walls; a plant rests ON a table, not through it; a ball is at the striker's foot, not inside their
body; a goal faces the pitch. The agent must **declare these intended relationships and validate
them automatically** — never rely on the user to spot that the goal was backwards.

This list is non-exhaustive by design; the predicates are extensible. Implementations live in
`assets/starter/src/engine/scene-validate.js` (dep-free, runtime + CI) and are proven by
`scripts/verify-scene.mjs --selftest`.

> **Want the exhaustive list + the method to keep it complete?** See
> [reference/19-correctness-catalogue.md](19-correctness-catalogue.md): the rule *generator*
> (relationship × failure-mode × archetype), the full catalogue by relationship type (what's
> implemented vs extensible), severity/review-pass model, and how to add a rule.

Table of contents
- [The rule taxonomy](#the-rule-taxonomy)
- [Objects as OBBs](#objects-as-obbs)
- [Declaring & validating a scene](#declaring--validating-a-scene)
- [Auto-correction](#auto-correction)
- [Bridge to Three.js](#bridge-to-threejs)
- [Make it a required gate](#make-it-a-required-gate)
- [The verify-scene script](#the-verify-scene-script)

## The rule taxonomy

| Rule | Means | Examples | Predicate |
|---|---|---|---|
| **Support** | object's underside touches a surface top, within its footprint, not sunk in | plant on table, box on floor, cup on shelf | `restsOn` |
| **Non-penetration** | two solids don't interpenetrate | furniture through wall, prop through prop, character through geometry | `noPenetration` (OBB SAT) |
| **Facing** | A's forward points at B (horizontal) | chair faces desk, NPC faces counter, turret faces target | `facing` |
| **Orientation match** | two orientations agree | seated character aligned to chair, picture parallel to wall | `orientationMatch` |
| **Containment** | a panel is set into an opening: coplanar, aligned, and contained | door/window in a wall aperture | `insideOpening` |
| **Attachment** | object at an attach point AND clear of a body | ball at the foot for a volley (not through the leg), tool in hand | `attachment` |
| **Sit pose** | hips rest on the seat AND oriented with the chair | character sitting down | `sitPose` (support + orientation) |

Composite/interaction rules (reach, hand-on-target, feet grounded) live in
`15-interaction-alignment.md`; use both together.

## Objects as OBBs

Every check works on oriented bounding boxes: `{ c:[x,y,z] center, e:[hx,hy,hz] half-extents,
q:[x,y,z,w] orientation }`. "Forward" is local **+Z** rotated by `q`. Derive an OBB from any mesh:

```js
import * as THREE from 'three/webgpu';
const b = new THREE.Box3().setFromObject(mesh);
const size = b.getSize(new THREE.Vector3()), center = b.getCenter(new THREE.Vector3());
const q = mesh.getWorldQuaternion(new THREE.Quaternion());
const obb = { c: center.toArray(), e: [size.x/2, size.y/2, size.z/2], q: q.toArray() };
```

(For accurate OBBs on rotated meshes, compute the box in local space and pass the world quaternion,
rather than the world-AABB above; for axis-aligned props the world AABB is fine.)

## Declaring & validating a scene

Declare the *intended* relationships next to where you place objects, then validate:

```js
import { validateScene } from './engine/scene-validate.js';
const report = validateScene({
  objects: { door, wall_obb, chair, desk, pelvis, seat, cabinet, ball, body, foot },
  constraints: [
    { type: 'insideOpening', door: 'door', wall: wallOpeningSpec },
    { type: 'facing', a: 'chair', target: deskCenter, maxAngleDeg: 20 },
    { type: 'sit', pelvis: 'pelvis', seat: 'seat', character: 'characterObb', chair: 'chair' },
    { type: 'noPenetration', a: 'cabinet', b: 'wall_obb' },
    { type: 'restsOn', obj: 'plant', support: 'table' },
    { type: 'attachment', ball: 'ball', footTip: footTipPos, body: 'body' },
  ],
});
// report.ok, report.checks[], report.failed[], report.fixes[]
```

## Auto-correction

Every failing check returns a concrete `fix` (a corrected position), so the agent fixes placement
instead of shipping the error:

- **restsOn** → `fix.position` snaps the object's underside onto the support top.
- **noPenetration** → `fix.position` pushes the object out along the minimum-penetration axis.
- **insideOpening** → `fix.position` pulls the panel onto the wall plane.

```js
for (const { constraint, fix } of report.fixes) {
  scene.getObjectByName(constraint.obj || constraint.a || constraint.door).position.fromArray(fix.position);
}
// re-validate until report.ok (a couple of passes; fixes are independent enough to converge)
```

For orientation/facing failures, rotate the object to face the target (`quatLookRotation` in
`vecmath.js`) — orientation fixes are situ­ational, so they're reported, not auto-applied.

## Bridge to Three.js

Runtime: build OBBs from `Box3.setFromObject` + `getWorldQuaternion`, validate after you place
things (and after physics settles), apply fixes, re-validate. All checks are cheap (OBB math), so
running them every time you spawn/move furniture is fine.

## Make it a required gate

Treat spatial correctness as a **mandatory step**, like visual QA (`16`) — part of the
autonomous loop (`17`):

1. Place objects/characters and **declare their intended relationships** in the same code.
2. `validateScene(...)` (or the individual predicates) → if not `ok`, apply `report.fixes` and
   re-validate.
3. Only then render + visual-QA.
4. In CI, run `verify-scene.mjs --spec scene.json`; a placement regression fails the build.

Do not depend on the user to catch that a door floats, a chair faces backwards, or a ball clips
through a leg — declare it and let the validator enforce it.

## The verify-scene script

```bash
node ${CLAUDE_SKILL_DIR}/scripts/verify-scene.mjs --selftest        # prove every rule (CI)
node ${CLAUDE_SKILL_DIR}/scripts/verify-scene.mjs --spec scene.json # validate a declared scene
```

`--selftest` demonstrates all rules on canonical cases — plant-on-table, furniture-through-wall,
chair-faces-desk, sit pose, door-in-opening, ball-at-foot-not-through-body, and structure
orientation (the football-goal bug). Extend `scene-validate.js` with new predicates as your scenes
need them (e.g. clearance/pathing, symmetry, snap-to-grid).
