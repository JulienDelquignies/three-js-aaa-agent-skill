import * as THREE from 'three/webgpu';

// A proper goal: posts + crossbar, and a NET built from real line segments (back + two sides + top),
// not alpha-mapped planes (which read as solid walls edge-on). Returns { group, setRipple, dispose }.
// setRipple(amount, cz, cy) bulges the back panel outward around the impact point — the ball hitting the net.
export function buildGoal(scene, { X = 26, W = 7.3, H = 2.44, D = 1.6, cell = 0.2 } = {}) {
  const disposables = [];
  const white = new THREE.MeshStandardNodeMaterial({ color: 0xf4f6f8, roughness: 0.4 }); disposables.push(white);
  const postG = new THREE.CylinderGeometry(0.1, 0.1, H, 14), barG = new THREE.CylinderGeometry(0.1, 0.1, W + 0.2, 14); disposables.push(postG, barG);
  const add = (geo, x, y, z, rx = 0) => { const m = new THREE.Mesh(geo, white); m.position.set(x, y, z); m.rotation.x = rx; m.castShadow = true; scene.add(m); };
  add(postG, X, H / 2, -W / 2); add(postG, X, H / 2, W / 2); add(barG, X, H, 0, Math.PI / 2);

  // net line segments
  const verts = [], back = [];
  const seg = (a, b, isBack) => { verts.push(a[0], a[1], a[2], b[0], b[1], b[2]); back.push(isBack, isBack); };
  const panel = (o, u, v, isBack) => {
    const lu = Math.hypot(u[0], u[1], u[2]), lv = Math.hypot(v[0], v[1], v[2]);
    const nu = Math.max(1, Math.round(lu / cell)), nv = Math.max(1, Math.round(lv / cell));
    const at = (s, w) => [o[0] + u[0] * s + v[0] * w, o[1] + u[1] * s + v[1] * w, o[2] + u[2] * s + v[2] * w];
    for (let i = 0; i <= nu; i++) { const s = i / nu; seg(at(s, 0), at(s, 1), isBack); }        // lines along v
    for (let j = 0; j <= nv; j++) { const w = j / nv; seg(at(0, w), at(1, w), isBack); }        // lines along u
  };
  panel([X + D, 0, -W / 2], [0, 0, W], [0, H, 0], true);   // back (bulges on impact)
  panel([X, 0, -W / 2], [D, 0, 0], [0, H, 0], false);      // left side
  panel([X, 0, W / 2], [D, 0, 0], [0, H, 0], false);       // right side
  panel([X, H, -W / 2], [D, 0, 0], [0, 0, W], false);      // top

  const pos = new Float32Array(verts); const rest = pos.slice();
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); disposables.push(geo);
  const mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false }); disposables.push(mat);
  const net = new THREE.LineSegments(geo, mat); scene.add(net);
  const isBack = back;

  return {
    net,
    // amount in metres of outward (+x) bulge; centred on the back panel at (cz, cy)
    setRipple(amount, cz = 0, cy = H * 0.45) {
      const a = geo.attributes.position.array;
      for (let i = 0; i < a.length; i += 3) {
        if (!isBack[i / 3]) continue;
        const z = rest[i + 2], y = rest[i + 1]; const d2 = (z - cz) * (z - cz) + (y - cy) * (y - cy);
        a[i] = rest[i] + amount * Math.exp(-d2 * 1.6);
      }
      geo.attributes.position.needsUpdate = true;
    },
    dispose() { for (const d of disposables) d.dispose?.(); },
  };
}
