import * as THREE from 'three/webgpu';
import { generateStadium, checkStadium } from '../engine/stadium.js';
import { buildStadium } from '../engine/stadium-builder.js';
import { makeTheme } from '../engine/club-theme.js';

// Stades — the same parametric generator at tier 1 (champêtre : une tribune, main courante) and tier 5
// (enceinte moderne : 4 tribunes 2 niveaux, toit complet), each THEMED by its club (seats in club colors,
// crest in the loge). The directors' LOGE + TERRACE vantage points are the playable "FM view" — the
// verification renders from there. window.__stadiumsReport carries the contract results.
const CLUBS = [
  { spec: { tier: 1, seed: 3 }, theme: makeTheme({ seed: 3, name: 'AS Colline', primary: 0x0b6e4f, secondary: 0xffffff }), at: [-80, 0, 0] },
  { spec: { tier: 5, seed: 3 }, theme: makeTheme({ seed: 9, name: 'Racing Métropole', primary: 0x1f3a93, secondary: 0xf8d210 }), at: [80, 0, 0] },
];

export class Stadiums {
  constructor(scene) {
    this.scene = scene; this.disposables = [];
    this._prevFog = scene.fog; scene.fog = new THREE.FogExp2(0x9aa7b4, 0.0012);   // stadium scale ≫ indoor scale
    const ggeo = new THREE.PlaneGeometry(560, 360); ggeo.rotateX(-Math.PI / 2);
    const gmat = new THREE.MeshStandardNodeMaterial({ color: 0x33402f, roughness: 1 });
    const ground = new THREE.Mesh(ggeo, gmat); ground.position.y = -0.06; ground.receiveShadow = true;
    scene.add(ground); this.disposables.push(ggeo, gmat);
    const report = {};
    this.vantages = [];
    for (const c of CLUBS) {
      const model = generateStadium(c.spec);
      const built = buildStadium(model, c.theme, { at: c.at });
      scene.add(built.group); this.disposables.push(built);
      const check = checkStadium(model);
      this.vantages.push({ at: c.at, v: model.vantages });
      report[`${c.theme.name} (T${c.spec.tier})`] = { capacity: model.capacity, stands: model.stands.length, colliders: built.colliders.length, valid: check.ok, issues: check.issues, terrace: model.vantages.terrace.map((x, i) => +(x + c.at[i]).toFixed(1)) };
    }
    window.__stadiumsReport = report;
    console.log('[Stadiums]', report);
  }

  camera(cam, controls) {
    cam.position.set(-30, 90, 170); cam.lookAt(0, 0, -10);
    if (controls) { controls.target.set(0, 4, -10); controls.minDistance = 30; controls.maxDistance = 400; controls.maxPolarAngle = Math.PI * 0.49; controls.update(); }
  }
  // helper for verification: put the camera at a stadium's terrace, looking at the pitch centre
  goToTerrace(cam, i = 1) {
    const { at, v } = this.vantages[i];
    cam.position.set(at[0] + v.terrace[0], at[1] + v.terrace[1], at[2] + v.terrace[2]);
    cam.lookAt(at[0], 1, at[2]);
  }
  update() {}
  dispose() { this.scene.fog = this._prevFog; for (const d of this.disposables) d.dispose?.(); }
}
