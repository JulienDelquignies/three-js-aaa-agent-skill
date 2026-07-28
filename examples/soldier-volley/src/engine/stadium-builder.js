import * as THREE from 'three/webgpu';
import { drawCrest, drawSponsorStrip } from './club-theme.js';
import { buildFurnitureItem } from './furniture-kit.js';
import { sweep } from './meshkit.js';
import { toGeometry } from './meshkit-builder.js';

// stadium-builder — turn a stadium model (engine/stadium.js) into the world, THEMED by the club:
// pitch with markings, stepped stands with INSTANCED SEATS in the club colors (secondary-color end
// blocks), roofs on columns, and the directors' LOGE: glass front, terrace slab + railing, the club
// crest on the back wall. Returns colliders for the loge/terrace floors + rails (walkable later) and
// the vantage points passthrough. One InstancedMesh per stand → tier-5 (~13k seats) stays cheap.
export function buildStadium(model, theme, { at = [0, 0, 0] } = {}) {
  const group = new THREE.Group(); group.position.set(at[0], at[1], at[2]);
  const disposables = [], colliders = [];
  const mat = (o) => { const m = new THREE.MeshStandardNodeMaterial(o); disposables.push(m); return m; };
  const box = (c, h, m, solid = false) => {
    const g = new THREE.BoxGeometry(h[0] * 2, h[1] * 2, h[2] * 2); disposables.push(g);
    const mesh = new THREE.Mesh(g, m); mesh.position.set(c[0], c[1], c[2]); mesh.castShadow = mesh.receiveShadow = true; group.add(mesh);
    if (solid) colliders.push({ pos: [at[0] + c[0], at[1] + c[1], at[2] + c[2]], half: [...h] });
    return mesh;
  };

  // pitch + markings (canvas), surrounding apron. ONE metre→pixel transform draws every line, and the
  // grass plane is (L+2m)×(W+2m) with MARGIN of grass beyond the lines — so the DRAWN goal line sits at
  // exactly x=±L/2 in world space, where the goals/flags stand. (Bug fixed: the border used to be inset
  // in texture space, leaving the goals ~2 m behind the drawn line.)
  const { L, W } = model.pitch;
  const MARGIN = 3, PW2 = L + 2 * MARGIN, PH2 = W + 2 * MARGIN;
  const pc = document.createElement('canvas'); pc.width = 1110; pc.height = 740; const pg = pc.getContext('2d');
  const kx = pc.width / PW2, kz = pc.height / PH2;
  const X = (xm) => (xm + PW2 / 2) * kx, Z = (zm) => (zm + PH2 / 2) * kz;
  for (let i = 0; i < 18; i++) { pg.fillStyle = i % 2 ? '#3f9a3f' : '#368636'; pg.fillRect(i / 18 * pc.width, 0, pc.width / 18 + 1, pc.height); }
  pg.strokeStyle = '#eef4ee'; pg.lineWidth = Math.max(2, 0.12 * kx);
  pg.strokeRect(X(-L / 2), Z(-W / 2), L * kx, W * kz);                                   // lignes de touche + de but
  pg.beginPath(); pg.moveTo(X(0), Z(-W / 2)); pg.lineTo(X(0), Z(W / 2)); pg.stroke();    // médiane
  pg.beginPath(); pg.arc(X(0), Z(0), 9.15 * kx, 0, 7); pg.stroke();                      // rond central
  pg.fillStyle = '#eef4ee'; pg.beginPath(); pg.arc(X(0), Z(0), 0.25 * kx, 0, 7); pg.fill();
  for (const side of [-1, 1]) {
    const gx = side * L / 2, dir = -side;                                                // vers le centre
    pg.strokeRect(Math.min(X(gx), X(gx + dir * 16.5)), Z(-20.16), 16.5 * kx, 40.32 * kz); // surface de réparation
    pg.strokeRect(Math.min(X(gx), X(gx + dir * 5.5)), Z(-9.16), 5.5 * kx, 18.32 * kz);    // 5,5 m
    pg.beginPath(); pg.arc(X(gx + dir * 11), Z(0), 0.25 * kx, 0, 7); pg.fill();           // point de penalty
    const a0 = side < 0 ? -0.94 : Math.PI - 0.94, a1 = side < 0 ? 0.94 : Math.PI + 0.94;
    pg.beginPath(); pg.arc(X(gx + dir * 11), Z(0), 9.15 * kx, a0, a1); pg.stroke();       // arc de réparation
  }
  for (const cx of [-L / 2, L / 2]) for (const cz of [-W / 2, W / 2]) {                   // arcs de corner (1 m)
    pg.beginPath(); pg.arc(X(cx), Z(cz), 1 * kx, 0, 7); pg.stroke();
  }
  const ptex = new THREE.CanvasTexture(pc); ptex.colorSpace = THREE.SRGBColorSpace; disposables.push(ptex);
  const pgeo = new THREE.PlaneGeometry(PW2, PH2); pgeo.rotateX(-Math.PI / 2); disposables.push(pgeo);
  const pitch = new THREE.Mesh(pgeo, mat({ map: ptex, roughness: 0.95 })); pitch.receiveShadow = true;
  pitch.name = 'pelouse';                                            // NAMED: stadium-night finds it to aim the key light at the pitch alone
  group.add(pitch);
  const agеo = new THREE.PlaneGeometry(L + 2 * (model.apron + model.stands[0].rows * model.rowD + 8), W + 2 * (model.apron + model.stands[0].rows * model.rowD + 8));
  agеo.rotateX(-Math.PI / 2); disposables.push(agеo);
  const apron = new THREE.Mesh(agеo, mat({ color: 0x596066, roughness: 1 })); apron.position.y = -0.03; apron.receiveShadow = true;
  apron.name = 'abords';
  group.add(apron);

  // stands: stepped concrete rows + instanced seats in club colors
  const seatGeo = new THREE.BoxGeometry(0.42, 0.42, 0.4); disposables.push(seatGeo);
  const concrete = mat({ color: 0x8d949c, roughness: 0.95 });
  for (const s of model.stands) {
    const inner = (s.along === 'x' ? W / 2 : L / 2) + model.apron;
    const decks = [[0, s.rows]]; if (s.deck2) decks.push([s.rows + 2, s.rows + 2 + s.deck2]);   // deck 2 set back+up
    let seatCount = 0; for (const [r0, r1] of decks) seatCount += (r1 - r0) * Math.floor(s.len / model.seatStep);
    const seats = new THREE.InstancedMesh(seatGeo, mat({ roughness: 0.7 }), seatCount);
    seats.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(seatCount * 3), 3);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
    const yaw = s.along === 'x' ? (s.sign < 0 ? 0 : Math.PI) : (s.sign < 0 ? Math.PI / 2 : -Math.PI / 2);
    let n = 0;
    for (const [r0, r1] of decks) for (let i = r0; i < r1; i++) {
      const dist = inner + (i + 0.5) * model.rowD, y = (i + 1) * model.rowH;
      // notch deck 2 of the MAIN stand around the loge (loges sit between the decks)
      const notch = s.id === 'main' && i >= s.rows && model.loge.notchDeck2 ? model.loge.notchDeck2 : 0;
      // concrete tread (split around the notch when present)
      if (s.along === 'x' && notch) {
        for (const e of [-1, 1]) { const segLen = s.len / 2 - notch; if (segLen > 0.2) box([e * (notch + segLen / 2), y - model.rowH / 2, s.sign * dist], [segLen / 2, model.rowH / 2, model.rowD / 2], concrete); }
      } else {
        const c = s.along === 'x' ? [0, y - model.rowH / 2, s.sign * dist] : [s.sign * dist, y - model.rowH / 2, 0];
        const h = s.along === 'x' ? [s.len / 2, model.rowH / 2, model.rowD / 2] : [model.rowD / 2, model.rowH / 2, s.len / 2];
        box(c, h, concrete);
      }
      const per = Math.floor(s.len / model.seatStep);
      for (let k = 0; k < per; k++) {
        const t = -s.len / 2 + (k + 0.5) * model.seatStep;
        if (notch && Math.abs(t) < notch + 0.3) continue;                 // no seats through the loge
        const p = s.along === 'x' ? [t, y + 0.21, s.sign * dist] : [s.sign * dist, y + 0.21, t];
        q.setFromAxisAngle(up, yaw); m4.compose(new THREE.Vector3(p[0], p[1], p[2]), q, new THREE.Vector3(1, 1, 1));
        seats.setMatrixAt(n, m4);
        col.set(k < per * 0.12 || k > per * 0.88 ? theme.secondary : theme.primary);           // end blocks in secondary
        seats.instanceColor.setXYZ(n, col.r, col.g, col.b); n++;
      }
    }
    seats.count = n; seats.instanceMatrix.needsUpdate = true; seats.instanceColor.needsUpdate = true;
    seats.castShadow = true; group.add(seats); disposables.push(seats);
    if (s.roof) {                                                                              // roof slab on back columns
      const top = ((s.deck2 ? s.rows + 2 + s.deck2 : s.rows) + 1) * model.rowH + 3;
      const back = inner + (s.deck2 ? s.rows + 2 + s.deck2 : s.rows) * model.rowD + 0.6;
      const c = s.along === 'x' ? [0, top, s.sign * (inner + back) / 2] : [s.sign * (inner + back) / 2, top, 0];
      const h = s.along === 'x' ? [s.len / 2 + 1, 0.12, (back - inner) / 2 + 1] : [(back - inner) / 2 + 1, 0.12, s.len / 2 + 1];
      box(c, h, mat({ color: 0x9aa1a8, roughness: 0.8, metalness: 0.15 }));   // mid-tone: light metal blows white in aerials
      for (const e of [-1, 1]) { const cc = s.along === 'x' ? [e * (s.len / 2 - 1), top / 2, s.sign * back] : [s.sign * back, top / 2, e * (s.len / 2 - 1)]; box(cc, [0.15, top / 2, 0.15], concrete); }
    }
  }

  // ---- match furniture: goals (with real line-segment nets), sponsor boards, flags, dugouts, tunnel,
  //      floodlights, scoreboard — all themed, all from model data (contract-checked)
  const white = mat({ color: 0xf4f6f8, roughness: 0.35 });
  for (const gl of model.goals || []) {                              // cages 7,32 × 2,44 + filets
    const gg = new THREE.Group(); gg.position.set(gl.x, 0, 0);
    const post = new THREE.CylinderGeometry(0.06, 0.06, gl.h, 10), bar = new THREE.CylinderGeometry(0.06, 0.06, gl.w + 0.12, 10);
    disposables.push(post, bar);
    for (const e of [-1, 1]) { const p = new THREE.Mesh(post, white); p.position.set(0, gl.h / 2, e * gl.w / 2); p.castShadow = true; gg.add(p); }
    const cb = new THREE.Mesh(bar, white); cb.rotation.x = Math.PI / 2; cb.position.set(0, gl.h, 0); cb.castShadow = true; gg.add(cb);
    const bx = -gl.sign * gl.depth;                                   // net back x (local)
    const verts = [];
    const seg = (a, c) => verts.push(a[0], a[1], a[2], c[0], c[1], c[2]);
    const netPanel = (o, u, v, nu, nv) => { for (let i = 0; i <= nu; i++) seg([o[0] + u[0] * i / nu, o[1] + u[1] * i / nu, o[2] + u[2] * i / nu], [o[0] + u[0] * i / nu + v[0], o[1] + u[1] * i / nu + v[1], o[2] + u[2] * i / nu + v[2]]);
      for (let j = 0; j <= nv; j++) seg([o[0] + v[0] * j / nv, o[1] + v[1] * j / nv, o[2] + v[2] * j / nv], [o[0] + v[0] * j / nv + u[0], o[1] + v[1] * j / nv + u[1], o[2] + v[2] * j / nv + u[2]]); };
    netPanel([bx, 0, -gl.w / 2], [0, 0, gl.w], [0, gl.h * 0.82, 0], 30, 8);                       // fond
    netPanel([0, gl.h, -gl.w / 2], [bx, -gl.h * 0.18, 0], [0, 0, gl.w], 6, 30);                   // toit incliné
    for (const e of [-1, 1]) netPanel([0, 0, e * gl.w / 2], [bx, 0, 0], [0, gl.h * 0.9, 0], 6, 8); // côtés
    const ngeo = new THREE.BufferGeometry(); ngeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3)); disposables.push(ngeo);
    const nmat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false }); disposables.push(nmat);
    gg.add(new THREE.LineSegments(ngeo, nmat));
    group.add(gg);
    colliders.push({ pos: [at[0] + gl.x + bx / 2, at[1] + 0.02, at[2]], half: [gl.depth / 2, 0.02, gl.w / 2] });
  }
  if (model.boards?.length) {                                        // panneaux publicitaires sponsors
    const stex = new THREE.CanvasTexture(drawSponsorStrip(theme)); stex.colorSpace = THREE.SRGBColorSpace;
    stex.wrapS = THREE.RepeatWrapping; disposables.push(stex);
    for (const bd of model.boards) {
      const dx = bd.b[0] - bd.a[0], dz = bd.b[1] - bd.a[1]; const len = Math.hypot(dx, dz);
      const m2 = mat({ map: stex, roughness: 0.6, emissive: 0xffffff, emissiveMap: stex, emissiveIntensity: 0.25 });
      const geo = new THREE.BoxGeometry(len, bd.h, 0.08); disposables.push(geo);
      const mesh = new THREE.Mesh(geo, m2);
      mesh.position.set((bd.a[0] + bd.b[0]) / 2, bd.h / 2 + 0.02, (bd.a[1] + bd.b[1]) / 2);
      mesh.rotation.y = Math.abs(dz) > Math.abs(dx) ? Math.PI / 2 : 0;
      mesh.rotation.x = (bd.face || 1) * -0.12 * (Math.abs(dz) > Math.abs(dx) ? 0 : 1);
      mesh.castShadow = true; group.add(mesh);
      colliders.push({ pos: [at[0] + mesh.position.x, at[1] + bd.h / 2, at[2] + mesh.position.z], half: Math.abs(dz) > Math.abs(dx) ? [0.05, bd.h / 2, len / 2] : [len / 2, bd.h / 2, 0.05] });
    }
  }
  for (const f of model.flags || []) {                               // drapeaux de corner
    const pole = new THREE.CylinderGeometry(0.02, 0.02, 1.5, 6); disposables.push(pole);
    const pm = new THREE.Mesh(pole, white); pm.position.set(f[0], 0.75, f[1]); group.add(pm);
    const fg = new THREE.PlaneGeometry(0.34, 0.24); disposables.push(fg);
    const fm = new THREE.Mesh(fg, mat({ color: theme.primary, side: THREE.DoubleSide, roughness: 0.8 }));
    fm.position.set(f[0] + 0.18 * Math.sign(-f[0]), 1.36, f[1]); group.add(fm);
  }
  const plexi = mat({ color: 0xcfe6f0, roughness: 0.05, transparent: true, opacity: 0.35 });
  for (const d of model.dugouts || []) {                             // abris de touche
    const len = d.x1 - d.x0, cx = (d.x0 + d.x1) / 2;
    box([cx, d.h - 0.04, d.z], [len / 2, 0.04, d.depth / 2 + 0.15], plexi);                        // toit plexi
    box([cx, d.h / 2, d.z - d.depth / 2], [len / 2, d.h / 2, 0.04], plexi);                        // fond plexi
    box([cx, 0.25, d.z], [len / 2 - 0.1, 0.03, 0.22], mat({ color: theme.primary, roughness: 0.6 }), true);  // banquette
    for (const e of [-1, 1]) box([cx + e * (len / 2 - 0.05), d.h / 2, d.z], [0.05, d.h / 2, d.depth / 2], plexi);
  }
  if (model.tunnel) {                                                // tunnel des joueurs
    const t2 = model.tunnel; const cx = (t2.x0 + t2.x1) / 2, hw = (t2.x1 - t2.x0) / 2;
    box([cx, t2.h / 2, t2.z - 0.6], [hw, t2.h / 2, 0.6], mat({ color: 0x22262d, roughness: 0.9 }));
    box([cx, t2.h + 0.15, t2.z - 0.6], [hw + 0.3, 0.15, 0.8], concrete);
  }
  if (model.lights?.type === 'pylon') {                              // pylônes champêtres/L2
    for (const p of model.lights.at) {
      const pole = new THREE.CylinderGeometry(0.18, 0.3, model.lights.h, 8); disposables.push(pole);
      const pm = new THREE.Mesh(pole, concrete); pm.position.set(p[0], model.lights.h / 2, p[1]); pm.castShadow = true; group.add(pm);
      const head = mat({ color: 0xffffff, emissive: 0xf4f8ff, emissiveIntensity: 3.2, roughness: 0.3 });
      const hg = new THREE.BoxGeometry(2.4, 1.5, 0.3); disposables.push(hg);
      const hm = new THREE.Mesh(hg, head); hm.position.set(p[0] * 0.96, model.lights.h + 0.7, p[1] * 0.96);
      hm.lookAt(0, 1, 0); group.add(hm);
    }
  } else if (model.lights?.type === 'roof') {                        // rampes sous toit (stade moderne)
    const strip = mat({ color: 0xffffff, emissive: 0xf4f8ff, emissiveIntensity: 2.6, roughness: 0.3 });
    for (const s of model.stands) {
      if (!s.roof) continue;
      const inner = (s.along === 'x' ? W / 2 : L / 2) + model.apron;
      const top = ((s.deck2 ? s.rows + 2 + s.deck2 : s.rows) + 1) * model.rowH + 2.7;
      const gg2 = new THREE.BoxGeometry(s.along === 'x' ? s.len * 0.9 : 0.5, 0.18, s.along === 'x' ? 0.5 : s.len * 0.9); disposables.push(gg2);
      const mm = new THREE.Mesh(gg2, strip);
      mm.position.set(s.along === 'x' ? 0 : s.sign * (inner + 1.5), top, s.along === 'x' ? s.sign * (inner + 1.5) : 0);
      group.add(mm);
    }
  }
  if (model.scoreboard) {                                            // écran géant
    const sb = model.scoreboard;
    const c2 = document.createElement('canvas'); c2.width = 512; c2.height = 256; const g2 = c2.getContext('2d');
    g2.fillStyle = '#0b0e14'; g2.fillRect(0, 0, 512, 256);
    g2.fillStyle = '#ffffff'; g2.font = '800 44px system-ui'; g2.textAlign = 'center';
    g2.fillText(theme.initials + '  0 : 0  VIS', 256, 118);
    g2.fillStyle = '#8fa2c0'; g2.font = '600 30px system-ui'; g2.fillText("45' +2", 256, 176);
    const st = new THREE.CanvasTexture(c2); st.colorSpace = THREE.SRGBColorSpace; disposables.push(st);
    const sg = new THREE.BoxGeometry(0.4, sb.h, sb.w); disposables.push(sg);
    const sm = new THREE.Mesh(sg, mat({ color: 0x14181f, roughness: 0.6 })); sm.position.set(sb.x, sb.y, 0); group.add(sm);
    const fg2 = new THREE.PlaneGeometry(sb.w * 0.94, sb.h * 0.86); disposables.push(fg2);
    const fm2 = new THREE.Mesh(fg2, mat({ map: st, emissive: 0xffffff, emissiveMap: st, emissiveIntensity: 1.6, roughness: 0.4 }));
    fm2.position.set(sb.x + 0.25, sb.y, 0); fm2.rotation.y = Math.PI / 2; group.add(fm2);
    for (const e of [-1, 1]) box([sb.x, sb.y / 2 - sb.h / 4, e * sb.w / 3], [0.15, sb.y / 2 - sb.h / 4 + 0.01, 0.15], concrete);
  }

  // the LOGE: floor, back/side walls, glass front, crest, terrace + railing (all walkable/solid)
  const lg = model.loge; const zc = (lg.rect[1] + lg.rect[3]) / 2;
  const wallM = mat({ color: 0xb9b3a6, roughness: 0.9 });
  box([0, lg.floorY - 0.1, zc], [lg.w / 2 + 0.3, 0.1, lg.d / 2 + 0.2], wallM, true);            // room floor
  box([0, lg.floorY + lg.h / 2, lg.rect[1]], [lg.w / 2 + 0.3, lg.h / 2, 0.07], wallM, true);    // back wall
  for (const e of [-1, 1]) box([e * (lg.w / 2 + 0.23), lg.floorY + lg.h / 2, zc], [0.07, lg.h / 2, lg.d / 2 + 0.2], wallM, true);
  box([0, lg.floorY + lg.h + 0.08, zc], [lg.w / 2 + 0.3, 0.08, lg.d / 2 + 0.2], wallM, true);   // roof (solid → the occlusion camera ducks under it)
  const glassM = mat({ color: 0xcfe6f0, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.3 });
  // glass front + low parapet, SPLIT around the derived terrace doorway (lg.door) — so the room really
  // opens onto the terrace on foot. A glass lintel spans the doorway above head height.
  const dr = lg.door || { x: lg.w, w: 0 };
  for (const [a, b] of [[-lg.w / 2, dr.x - dr.w / 2], [dr.x + dr.w / 2, lg.w / 2]]) {
    if (b - a < 0.05) continue;
    box([(a + b) / 2, lg.floorY + lg.h / 2 + 0.35, lg.rect[3]], [(b - a) / 2, lg.h / 2 - 0.35, 0.03], glassM); // glass front (upper part)
    box([(a + b) / 2, lg.floorY + 0.35, lg.rect[3]], [(b - a) / 2, 0.35, 0.04], wallM, true);                  // low front parapet
  }
  if (dr.w > 0 && lg.h > 2.15) box([dr.x, lg.floorY + (2.1 + lg.h) / 2, lg.rect[3]], [dr.w / 2, (lg.h - 2.1) / 2, 0.03], glassM);
  const crestTex = new THREE.CanvasTexture(drawCrest(theme)); crestTex.colorSpace = THREE.SRGBColorSpace; disposables.push(crestTex);
  const crestGeo = new THREE.PlaneGeometry(1.4, 1.4); disposables.push(crestGeo);
  const crest = new THREE.Mesh(crestGeo, mat({ map: crestTex, roughness: 0.8, transparent: true }));
  crest.position.set(0, lg.floorY + lg.h / 2 + 0.2, lg.rect[1] + 0.08); group.add(crest);
  // loge equipment (bar, stools, VIP row, fridge, screen, plant) — themed via the furniture kit
  const kitCache = {};
  for (const it of lg.items || []) {
    const sub = buildFurnitureItem(it, kitCache, theme);
    sub.position.set(it.x, lg.floorY, it.z); group.add(sub);
    colliders.push({ pos: [at[0] + it.x, at[1] + lg.floorY + it.h / 2, at[2] + it.z], half: [it.w / 2, it.h / 2, it.d / 2] });
  }
  disposables.push({ dispose: () => Object.values(kitCache).forEach((o) => o.dispose?.()) });
  // terrace over the top rows + GLASS railing with a dark handrail (solid collider, see-through view)
  const tz = (lg.terrace[1] + lg.terrace[3]) / 2, td = (lg.terrace[3] - lg.terrace[1]) / 2;
  box([0, lg.floorY - 0.1, tz], [lg.w / 2 + 0.3, 0.1, td], wallM, true);
  const railM = mat({ color: 0xdfeef6, roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.28 });
  box([0, lg.floorY + lg.rail / 2, lg.terrace[3]], [lg.w / 2 + 0.3, lg.rail / 2, 0.03], railM, true);
  box([0, lg.floorY + lg.rail, lg.terrace[3]], [lg.w / 2 + 0.3, 0.03, 0.05], mat({ color: 0x30363d, roughness: 0.4, metalness: 0.7 }));
  for (const e of [-1, 1]) box([e * (lg.w / 2 + 0.26), lg.floorY + lg.rail / 2, tz], [0.03, lg.rail / 2, td], railM, true);


  // ---- the SIGNATURE (landmark presets, reference/29): raised from derived data, never hardcoded
  if (model.signature) {
    const sig = model.signature;
    if (sig.kind === 'arche') {                                 // the great arch: a meshkit tube on a parabola
      const path = [];
      for (let i = 0; i <= 48; i++) {
        const u = i / 48, x = (u - 0.5) * sig.span;
        path.push([x, sig.apex * (1 - (2 * u - 1) ** 2) + 0.4, sig.z]);
      }
      const circ = [];
      for (let i = 0; i < 12; i++) { const a2 = (i / 12) * Math.PI * 2; circ.push([Math.cos(a2) * sig.tube, Math.sin(a2) * sig.tube]); }
      const arch = new THREE.Mesh(toGeometry(sweep(circ, path)), mat({ color: 0xeef1f4, roughness: 0.35, metalness: 0.55 }));
      arch.castShadow = true; group.add(arch); disposables.push(arch.geometry);
      for (const sx of [-1, 1]) colliders.push({ pos: [sx * sig.span * 0.48, 2, sig.z], half: [2, 2, 2] });
    }
    if (sig.kind === 'nervures') {                              // the concrete ribs wrapping the rim
      const path = [];
      for (let i = 0; i <= 14; i++) {
        const u = i / 14;
        path.push([0, u * sig.top, -Math.sin(u * Math.PI / 2) * 4.5]);     // rises, leaning over the rim
      }
      const sect = [[0.55, 0], [0.38, 0.9], [-0.38, 0.9], [-0.55, 0], [-0.38, -0.9], [0.38, -0.9]];
      const ribGeo = toGeometry(sweep(sect, path)); disposables.push(ribGeo);
      const ribM = mat({ color: 0xd9d6cf, roughness: 0.85 });
      const im = new THREE.InstancedMesh(ribGeo, ribM, sig.ribs.length);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
      sig.ribs.forEach((r, k) => {
        q.setFromAxisAngle(up, r.yaw);
        m4.compose(new THREE.Vector3(r.x, 0, r.z), q, one);
        im.setMatrixAt(k, m4);
        colliders.push({ pos: [r.x, sig.top / 2, r.z], half: [0.6, sig.top / 2, 1.0], yaw: r.yaw });
      });
      im.instanceMatrix.needsUpdate = true; im.castShadow = true;
      group.add(im); disposables.push(im);
    }
    if (sig.kind === 'bol') {                                   // corner banks close the bowl
      const rowH2 = model.rowH, rowD2 = model.rowD;
      const seatGeo2 = new THREE.BoxGeometry(0.42, 0.4, 0.44); disposables.push(seatGeo2);
      const concrete2 = mat({ color: 0xb6b2a8, roughness: 0.95 });
      for (const c of sig.corners) {
        const rows = c.rows, segs = 20;
        const pos2 = [], idx2 = [];
        for (let i = 0; i <= rows; i++) {
          const r = c.r0 + i * rowD2, y = i * rowH2;
          for (let sgi = 0; sgi <= segs; sgi++) {
            const a2 = (sgi / segs) * (Math.PI / 2);
            pos2.push(c.cx + c.sx * Math.cos(a2) * r, y, c.cz + c.sz * Math.sin(a2) * r);
          }
        }
        for (let i = 0; i < rows; i++) for (let sgi = 0; sgi < segs; sgi++) {
          const a0 = i * (segs + 1) + sgi, b0 = (i + 1) * (segs + 1) + sgi;
          idx2.push(a0, b0, a0 + 1, b0, b0 + 1, a0 + 1);
        }
        const bg2 = new THREE.BufferGeometry();
        bg2.setAttribute('position', new THREE.Float32BufferAttribute(pos2, 3));
        bg2.setIndex(idx2); bg2.computeVertexNormals(); disposables.push(bg2);
        const bank = new THREE.Mesh(bg2, new THREE.MeshStandardNodeMaterial({ color: 0xb6b2a8, roughness: 0.95, side: THREE.DoubleSide }));
        disposables.push(bank.material);
        bank.receiveShadow = true; group.add(bank);
        const nSeat = rows * (segs - 1);
        const cornerSeatM = new THREE.MeshStandardNodeMaterial({ color: theme.primary, roughness: 0.7 });
        disposables.push(cornerSeatM);
        const sim = new THREE.InstancedMesh(seatGeo2, cornerSeatM, nSeat);
        const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
        let n2 = 0;
        for (let i = 0; i < rows; i++) {
          const r = c.r0 + (i + 0.5) * rowD2, y = i * rowH2 + 0.25;
          for (let sgi = 1; sgi < segs; sgi++) {
            const a2 = (sgi / segs) * (Math.PI / 2);
            const x = c.cx + c.sx * Math.cos(a2) * r, z = c.cz + c.sz * Math.sin(a2) * r;
            q.setFromAxisAngle(up, Math.atan2(-x, -z));                    // face the pitch centre
            m4.compose(new THREE.Vector3(x, y, z), q, one);
            sim.setMatrixAt(n2++, m4);
          }
        }
        sim.count = n2; sim.instanceMatrix.needsUpdate = true;
        group.add(sim); disposables.push(sim);
      }
    }
  }

  return { group, colliders, vantages: model.vantages, dispose: () => disposables.forEach((d) => d.dispose?.()) };
}
