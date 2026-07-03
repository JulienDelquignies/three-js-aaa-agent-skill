import * as THREE from 'three/webgpu';

// Interior lighting — one warm pendant fixture + PointLight per room of a generated place, each with a
// wall SWITCH next to the room's door (register the returned switches as interactables: "E — Éteindre").
// Budgeted: lights don't cast shadows; a room's light only reaches its own space (distance-limited).
// Pairs with the evening ambience: dim the sun/IBL and the room lights carry the scene. See reference/31.
export function lightPlace(scene, model, { at = [0, 0, 0], color = 0xffe6bd, intensity = 16, range = 9, height = 2.35 } = {}) {
  const rooms = [], disposables = [];
  const rodG = new THREE.CylinderGeometry(0.012, 0.012, 0.35, 6); disposables.push(rodG);
  const shadeG = new THREE.CylinderGeometry(0.1, 0.17, 0.12, 16); disposables.push(shadeG);
  const rodM = new THREE.MeshStandardNodeMaterial({ color: 0x2a2e35, roughness: 0.6 }); disposables.push(rodM);
  for (const [fi, f] of model.floors.entries()) {
    for (const r of f.rooms) {
      const cx = at[0] + (r.rect[0] + r.rect[2]) / 2, cz = at[2] + (r.rect[1] + r.rect[3]) / 2;
      const y = at[1] + f.y + height;
      const light = new THREE.PointLight(color, intensity, range, 1.9);
      light.position.set(cx, y - 0.15, cz); scene.add(light);
      const shadeM = new THREE.MeshStandardNodeMaterial({ color: 0x3a3e46, emissive: new THREE.Color(0xffe9c4), emissiveIntensity: 2.4, roughness: 0.5 });
      disposables.push(shadeM);
      const rod = new THREE.Mesh(rodG, rodM); rod.position.set(cx, y + 0.22, cz); scene.add(rod);
      const shade = new THREE.Mesh(shadeG, shadeM); shade.position.set(cx, y, cz); scene.add(shade);
      const room = {
        id: r.id, floor: fi, light, on: true,
        toggle() { this.on = !this.on; light.visible = this.on; shadeM.emissiveIntensity = this.on ? 2.4 : 0.06; },
      };
      rooms.push(room);
    }
  }
  return { rooms, byId: (id) => rooms.find((r) => r.id === id), dispose: () => disposables.forEach((d) => d.dispose?.()) };
}

/** Wall-switch world positions: inside each room, beside its door (hinge side). Returns [{roomId, pos}]. */
export function switchPositions(model, { at = [0, 0, 0] } = {}, floorIndex = 0) {
  const out = []; const f = model.floors[floorIndex];
  for (const r of f.rooms) {
    const w = f.walls.find((w2) => w2.rooms.includes(r.id) && w2.openings.some((o) => o.type === 'door'));
    if (!w) continue;
    const o = w.openings.find((o2) => o2.type === 'door');
    const ux = Math.sign(w.b[0] - w.a[0]), uz = Math.sign(w.b[1] - w.a[1]);
    const ex = w.a[0] + ux * (o.at + o.w / 2 + 0.25), ez = w.a[1] + uz * (o.at + o.w / 2 + 0.25);
    // step 0.3 m INTO this room (perpendicular, toward the room centre)
    const cx = (r.rect[0] + r.rect[2]) / 2, cz = (r.rect[1] + r.rect[3]) / 2;
    const nx = ux ? 0 : Math.sign(cx - ex), nz = ux ? Math.sign(cz - ez) : 0;
    out.push({ roomId: r.id, pos: [at[0] + ex + nx * 0.3, at[1] + f.y + 1.1, at[2] + ez + nz * 0.3] });
  }
  return out;
}
