import * as THREE from 'three/webgpu';

// cabin-builder — turn a cabin model (engine/cabin.js) into an interior you can actually be in:
// floor, window-band side panels (glass between pillars → the city stays visible from inside),
// ceiling with a lit strip, themed seats (headrest included), tables. LOCAL vehicle space — add the
// group INSIDE a vehicle group (the bus: it rides along), or place it at a parked vehicle's world
// pose and feed the returned colliders (floor/walls/seats, local) to physics for a WALKABLE interior.
export function buildCabin(cabin, { theme = null } = {}) {
  const { shell, seats, tables } = cabin;
  const group = new THREE.Group();
  const disposables = [], colliders = [];
  const mat = (o) => { const m = new THREE.MeshStandardNodeMaterial(o); disposables.push(m); return m; };
  const box = (c, h, m, solid = false) => {
    const g = new THREE.BoxGeometry(h[0] * 2, h[1] * 2, h[2] * 2); disposables.push(g);
    const mesh = new THREE.Mesh(g, m); mesh.position.set(c[0], c[1], c[2]); group.add(mesh);
    if (solid) colliders.push({ pos: [...c], half: [...h] });
    return mesh;
  };
  const y0 = shell.floorY;
  const floorM = mat({ color: 0x3a3f47, roughness: 0.9 });
  const trimM = mat({ color: 0xb9bdc4, roughness: 0.6, metalness: 0.3 });
  const glassM = mat({ color: 0xcfe6f0, roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.22 });

  box([0, y0 - 0.04, 0], [shell.W / 2 + 0.05, 0.04, shell.L / 2 + 0.05], floorM, true);        // floor
  box([0, y0 + shell.h + 0.03, 0], [shell.W / 2 + 0.05, 0.03, shell.L / 2 + 0.05], trimM, true); // ceiling
  const led = box([0, y0 + shell.h - 0.02, 0], [0.09, 0.015, shell.L / 2 - 0.3],
    mat({ color: 0xffffff, emissive: 0xfff3dd, emissiveIntensity: 1.6, roughness: 0.4 }));
  led.renderOrder = 1;
  // side panels: low wall + PILLARS with glass between (window band) + header — you see the city out
  const nPil = Math.max(3, Math.round(shell.L / 1.6));
  for (const s of [-1, 1]) {
    const x = s * (shell.W / 2 + 0.02);
    box([x, y0 + 0.45, 0], [0.03, 0.45, shell.L / 2 + 0.03], trimM, true);                     // low wall
    box([x, y0 + shell.h - 0.14, 0], [0.03, 0.14, shell.L / 2 + 0.03], trimM);                 // header
    box([x, y0 + (0.9 + shell.h - 0.28) / 2 + 0.0, 0], [0.012, (shell.h - 0.28 - 0.9) / 2, shell.L / 2], glassM);
    for (let i = 0; i <= nPil; i++) {
      const z = -shell.L / 2 + (i * shell.L) / nPil;
      box([x, y0 + shell.h / 2, z], [0.035, shell.h / 2, 0.05], trimM);
    }
  }
  box([0, y0 + shell.h / 2, -shell.L / 2 - 0.02], [shell.W / 2, shell.h / 2, 0.03], trimM, true);   // rear wall
  box([0, y0 + shell.h / 2, shell.L / 2 + 0.02], [shell.W / 2, shell.h / 2, 0.03], glassM, true);   // windshield

  // seats: base + back + headrest, themed (the team bus wears the club color)
  const seatM = mat({ color: theme?.primary ?? 0x38414f, roughness: 0.85 });
  const seatM2 = mat({ color: 0x232830, roughness: 0.9 });
  for (const s of seats) {
    const g = new THREE.Group(); g.position.set(s.x, y0, s.z); g.rotation.y = s.yaw;
    const add = (w, h, d, x, y, z, m) => { const bg = new THREE.BoxGeometry(w, h, d); disposables.push(bg); const mm = new THREE.Mesh(bg, m); mm.position.set(x, y, z); g.add(mm); };
    add(s.w, 0.1, s.d, 0, 0.42, 0, seatM);
    add(s.w, 0.16, s.d, 0, 0.3, 0, seatM2);
    add(s.w, 0.62, 0.09, 0, 0.75, -s.d / 2 + 0.05, seatM);
    add(s.w * 0.55, 0.16, 0.08, 0, 1.14, -s.d / 2 + 0.05, seatM2);                             // headrest
    group.add(g);
    colliders.push({ pos: [s.x, y0 + 0.35, s.z], half: [s.w / 2, 0.35, s.d / 2] });
  }
  const tableM = mat({ color: 0xd9d4c8, roughness: 0.5 });
  for (const t of tables || []) {
    box([t.x, y0 + 0.68, t.z], [t.w / 2, 0.02, t.d / 2], tableM, true);
    box([t.x, y0 + 0.34, t.z], [0.03, 0.34, 0.03], trimM);
  }
  return { group, colliders, dispose: () => disposables.forEach((d) => d.dispose?.()) };
}
