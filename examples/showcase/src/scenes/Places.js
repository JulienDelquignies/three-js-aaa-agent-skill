import * as THREE from 'three/webgpu';
import { generatePlace, checkModel } from '../engine/floorplan.js';
import { buildPlace } from '../engine/place-builder.js';

// Lieux procéduraux — four places from four SPECS (no plan was drawn): club tier 1 vs tier 4, and the
// player's home at tier 1 (hotel room) vs tier 5 (villa + pool, two floors). Same generator, different
// {type, tier, seed}; doors/windows/stairs are DERIVED, and every model passes checkModel() — the
// no-regression contract (window.__placesReport). Dollhouse view: orbit to look inside the rooms.
const SPECS = [
  { spec: { type: 'club', tier: 1, seed: 11 }, label: 'Club T1' },
  { spec: { type: 'club', tier: 4, seed: 11 }, label: 'Club T4' },
  { spec: { type: 'home', tier: 1, seed: 7 }, label: 'Hôtel T1' },
  { spec: { type: 'home', tier: 5, seed: 7 }, label: 'Villa T5' },
];

export class Places {
  constructor(scene) {
    this.scene = scene; this.disposables = [];
    const ggeo = new THREE.PlaneGeometry(140, 140); ggeo.rotateX(-Math.PI / 2);
    const gmat = new THREE.MeshStandardNodeMaterial({ color: 0x3d4436, roughness: 1 });
    const ground = new THREE.Mesh(ggeo, gmat); ground.position.y = -0.16; ground.receiveShadow = true;
    scene.add(ground); this.disposables.push(ggeo, gmat);

    // lay the four places on a 2×2 grid, each centred in its cell
    const models = SPECS.map((s) => ({ ...s, model: generatePlace(s.spec) }));
    const cell = Math.max(...models.map(({ model: m }) => Math.max(m.W, m.D + (m.outdoor ? 12 : 0)))) + 6;
    const report = {};
    models.forEach(({ spec, label, model }, i) => {
      const cx = (i % 2) * cell - cell / 2, cz = ((i / 2) | 0) * cell - cell / 2;
      const built = buildPlace(model, { at: [cx - model.W / 2, 0, cz - model.D / 2] });
      this.scene.add(built.group); this.disposables.push(built);
      const check = checkModel(model);
      report[label] = { spec, footprint: `${model.W.toFixed(1)}×${model.D.toFixed(1)}m`, floors: model.floors.length, rooms: model.floors.reduce((s, f) => s + f.rooms.length, 0), colliders: built.colliders.length, valid: check.ok, issues: check.issues };
    });
    window.__placesReport = report;
    const allOk = Object.values(report).every((r) => r.valid);
    console.log('[Places]', allOk ? 'all generated places pass checkModel ✓' : 'VALIDATION FAILURES', report);
  }

  camera(cam, controls) {
    cam.position.set(-26, 30, 34); cam.lookAt(0, 0, 2);
    if (controls) { controls.target.set(0, 0, 2); controls.minDistance = 10; controls.maxDistance = 90; controls.maxPolarAngle = Math.PI * 0.49; controls.update(); }
  }

  update() {}
  dispose() { for (const d of this.disposables) d.dispose?.(); }
}
