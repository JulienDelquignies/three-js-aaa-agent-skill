import * as THREE from 'three/webgpu';
import { drawCrest } from './club-theme.js';
import { buildFurnitureItem } from './furniture-kit.js';

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

  // pitch + markings (canvas), surrounding apron
  const { L, W } = model.pitch;
  const pc = document.createElement('canvas'); pc.width = 1024; pc.height = 664; const pg = pc.getContext('2d');
  for (let i = 0; i < 16; i++) { pg.fillStyle = i % 2 ? '#3f9a3f' : '#368636'; pg.fillRect(i / 16 * 1024, 0, 64, 664); }
  pg.strokeStyle = '#eef4ee'; pg.lineWidth = 4; pg.strokeRect(20, 20, 984, 624);
  pg.beginPath(); pg.moveTo(512, 20); pg.lineTo(512, 644); pg.stroke(); pg.beginPath(); pg.arc(512, 332, 88, 0, 7); pg.stroke();
  for (const x of [20, 1004 - 155]) pg.strokeRect(x, 332 - 200 / 2 - 60, 155, 320);
  const ptex = new THREE.CanvasTexture(pc); ptex.colorSpace = THREE.SRGBColorSpace; disposables.push(ptex);
  const pgeo = new THREE.PlaneGeometry(L, W); pgeo.rotateX(-Math.PI / 2); disposables.push(pgeo);
  const pitch = new THREE.Mesh(pgeo, mat({ map: ptex, roughness: 0.95 })); pitch.receiveShadow = true; group.add(pitch);
  const agеo = new THREE.PlaneGeometry(L + 2 * (model.apron + model.stands[0].rows * model.rowD + 8), W + 2 * (model.apron + model.stands[0].rows * model.rowD + 8));
  agеo.rotateX(-Math.PI / 2); disposables.push(agеo);
  const apron = new THREE.Mesh(agеo, mat({ color: 0x596066, roughness: 1 })); apron.position.y = -0.03; apron.receiveShadow = true; group.add(apron);

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
      box(c, h, mat({ color: 0xd8dde2, roughness: 0.5, metalness: 0.4 }));
      for (const e of [-1, 1]) { const cc = s.along === 'x' ? [e * (s.len / 2 - 1), top / 2, s.sign * back] : [s.sign * back, top / 2, e * (s.len / 2 - 1)]; box(cc, [0.15, top / 2, 0.15], concrete); }
    }
  }

  // the LOGE: floor, back/side walls, glass front, crest, terrace + railing (all walkable/solid)
  const lg = model.loge; const zc = (lg.rect[1] + lg.rect[3]) / 2;
  const wallM = mat({ color: 0xb9b3a6, roughness: 0.9 });
  box([0, lg.floorY - 0.1, zc], [lg.w / 2 + 0.3, 0.1, lg.d / 2 + 0.2], wallM, true);            // room floor
  box([0, lg.floorY + lg.h / 2, lg.rect[1]], [lg.w / 2 + 0.3, lg.h / 2, 0.07], wallM, true);    // back wall
  for (const e of [-1, 1]) box([e * (lg.w / 2 + 0.23), lg.floorY + lg.h / 2, zc], [0.07, lg.h / 2, lg.d / 2 + 0.2], wallM, true);
  box([0, lg.floorY + lg.h + 0.08, zc], [lg.w / 2 + 0.3, 0.08, lg.d / 2 + 0.2], wallM);         // roof
  const glassM = mat({ color: 0xcfe6f0, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.3 });
  box([0, lg.floorY + lg.h / 2 + 0.35, lg.rect[3]], [lg.w / 2, lg.h / 2 - 0.35, 0.03], glassM); // glass front (upper part)
  box([0, lg.floorY + 0.35, lg.rect[3]], [lg.w / 2, 0.35, 0.04], wallM, true);                  // low front parapet
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
  // terrace over the top rows + railing
  const tz = (lg.terrace[1] + lg.terrace[3]) / 2, td = (lg.terrace[3] - lg.terrace[1]) / 2;
  box([0, lg.floorY - 0.1, tz], [lg.w / 2 + 0.3, 0.1, td], wallM, true);
  box([0, lg.floorY + lg.rail / 2, lg.terrace[3]], [lg.w / 2 + 0.3, lg.rail / 2, 0.04], mat({ color: 0x30363d, roughness: 0.4, metalness: 0.7 }), true);
  for (const e of [-1, 1]) box([e * (lg.w / 2 + 0.26), lg.floorY + lg.rail / 2, tz], [0.04, lg.rail / 2, td], wallM, true);

  return { group, colliders, vantages: model.vantages, dispose: () => disposables.forEach((d) => d.dispose?.()) };
}
