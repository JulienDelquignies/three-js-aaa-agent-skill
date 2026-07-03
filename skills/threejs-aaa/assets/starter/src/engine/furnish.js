// Furnish — rule-based furniture placement for floorplan models (engine/floorplan.js). Dependency-free:
// items are pure data { kind, floor, room, x, z, yaw, w, d, h, faces? } placed by ARCHETYPE RECIPES
// (bedroom, bathroom, living, kitchen, office, locker room, gym…) under hard rules:
//   • against-wall items back onto a real wall and face into the room
//   • nothing overlaps, nothing leaves the room, nothing blocks a DOOR CLEARANCE zone (both sides) or
//     the stair run, `faces` constraints hold (chair→desk, tv→sofa — the ref-19 correctness rules)
// checkFurnishing() re-verifies all of it independently → the same no-regression contract as the
// floorplan: patch the layout, re-run the check. Seeded → deterministic. See verify-furnish.mjs.
import { WALL_T } from './floorplan.js';

const mulberry = (seed) => { let t = seed >>> 0; return () => { t += 0x6D2B79F5; let x = Math.imul(t ^ (t >>> 15), 1 | t); x ^= x + Math.imul(x ^ (x >>> 7), 61 | x); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; };
const halfFor = (w, d, yaw) => (Math.abs(Math.sin(yaw)) > 0.5 ? [d / 2, w / 2] : [w / 2, d / 2]);
const aabb = (it) => { const [hx, hz] = halfFor(it.w, it.d, it.yaw); return [it.x - hx, it.z - hz, it.x + hx, it.z + hz]; };
const rOverlap = (a, b, eps = 0) => Math.min(a[2], b[2]) - Math.max(a[0], b[0]) > eps && Math.min(a[3], b[3]) - Math.max(a[1], b[1]) > eps;
const rInside = (a, r, eps = 0.02) => a[0] >= r[0] - eps && a[1] >= r[1] - eps && a[2] <= r[2] + eps && a[3] <= r[3] + eps;

const ARCHETYPE = (id) => {
  for (const [re, a] of [[/^(chambre|suite)/, 'bedroom'], [/^sdb/, 'bathroom'], [/^sejour-cuisine/, 'studio'], [/^sejour/, 'living'], [/^cuisine/, 'kitchen'], [/^bureau/, 'office'], [/^vestiaire/, 'locker'], [/^gym/, 'gym'], [/^(infirmerie|spa)/, 'medical'], [/^cafeteria/, 'cafeteria'], [/^salle-presse/, 'press'], [/^(salle-video|auditorium)/, 'media'], [/^stockage/, 'storage'], [/^(couloir|hall|palier)/, 'hub']]) if (re.test(id)) return a;
  return 'hub';
};

function roomCtx(model, fi, room, items) {
  const floor = model.floors[fi];
  const inner = [room.rect[0] + WALL_T / 2, room.rect[1] + WALL_T / 2, room.rect[2] - WALL_T / 2, room.rect[3] - WALL_T / 2];
  const zones = [];                                       // keep-clear rects: doors (this room's side) + stairs
  for (const w of floor.walls) {
    if (!w.rooms.includes(room.id)) continue;
    const horiz = w.a[1] === w.b[1];
    for (const o of w.openings) {
      if (o.type !== 'door') continue;
      const ux = Math.sign(w.b[0] - w.a[0]), uz = Math.sign(w.b[1] - w.a[1]);
      const cx = w.a[0] + ux * o.at, cz = w.a[1] + uz * o.at, hw = o.w / 2 + 0.25, depth = 1.0;
      if (horiz) { const into = Math.abs(room.rect[1] - w.a[1]) < 0.01 ? 1 : -1; zones.push([cx - hw, into > 0 ? w.a[1] : w.a[1] - depth, cx + hw, into > 0 ? w.a[1] + depth : w.a[1]]); }
      else { const into = Math.abs(room.rect[0] - w.a[0]) < 0.01 ? 1 : -1; zones.push([into > 0 ? w.a[0] : w.a[0] - depth, cz - hw, into > 0 ? w.a[0] + depth : w.a[0], cz + hw]); }
    }
  }
  if (model.stairs && room.id === floor.hubId) { const s = model.stairs.rect; zones.push([s[0] - 0.5, s[1] - 0.4, s[2] + 0.5, s[3] + 0.4]); }
  const mine = () => items.filter((i) => i.floor === fi && i.room === room.id);
  const fits = (it) => { const A = aabb(it); return rInside(A, inner) && !zones.some((z) => rOverlap(A, z)) && !mine().some((o) => rOverlap(A, aabb(o), -0.03)); };
  return { inner, zones, fits, club: model.spec.type === 'club' };
}

// slide along a wall side looking for a valid spot; sides tried in seeded order
function againstWall(ctx, room, w, d, rnd, { sides = ['N', 'S', 'W', 'E'], step = 0.2 } = {}) {
  const [x0, z0, x1, z1] = room.rect;
  const order = [...sides].sort(() => rnd() - 0.5);
  for (const side of order) {
    const yaw = side === 'N' ? 0 : side === 'S' ? Math.PI : side === 'W' ? Math.PI / 2 : -Math.PI / 2;
    const [hx, hz] = halfFor(w, d, yaw);
    const fixed = side === 'N' ? z0 + WALL_T / 2 + hz + 0.01 : side === 'S' ? z1 - WALL_T / 2 - hz - 0.01 : side === 'W' ? x0 + WALL_T / 2 + hx + 0.01 : x1 - WALL_T / 2 - hx - 0.01;
    const [t0, t1] = side === 'N' || side === 'S' ? [x0 + hx + 0.12, x1 - hx - 0.12] : [z0 + hz + 0.12, z1 - hz - 0.12];
    if (t1 < t0) continue;
    const start = t0 + rnd() * (t1 - t0), span = t1 - t0;
    for (let k = 0; k <= Math.ceil(span / step); k++) {
      const t = t0 + (((start - t0) + k * step) % (span || 1));
      const it = side === 'N' || side === 'S' ? { x: t, z: fixed, yaw, w, d } : { x: fixed, z: t, yaw, w, d };
      if (ctx.fits(it)) return it;
    }
  }
  return null;
}
const freeSpot = (ctx, room, w, d, yaw, rnd, tries = 30) => {
  const [x0, z0, x1, z1] = room.rect; const [hx, hz] = halfFor(w, d, yaw);
  for (let k = 0; k < tries; k++) {
    const it = { x: x0 + hx + 0.3 + rnd() * Math.max(0.01, x1 - x0 - 2 * hx - 0.6), z: z0 + hz + 0.3 + rnd() * Math.max(0.01, z1 - z0 - 2 * hz - 0.6), yaw, w, d };
    if (ctx.fits(it)) return it;
  } return null;
};
const facingYaw = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);
const front = (it, dist) => ({ x: it.x + Math.sin(it.yaw) * dist, z: it.z + Math.cos(it.yaw) * dist });

// ---- archetype recipes (add(kind, spot, w, d, h, extra?) returns the item or null)
const RECIPES = {
  bedroom(c, room, add, rnd) {
    const bed = add('bed', againstWall(c, room, 1.5, 2.1, rnd), 1.5, 2.1, 0.55);
    if (bed) for (const s of [-1, 1]) {                    // nightstands flanking the headboard
      const off = 0.75 + 0.26; const p = { x: bed.x + Math.cos(bed.yaw) * off * s, z: bed.z - Math.sin(bed.yaw) * off * s, yaw: bed.yaw, w: 0.45, d: 0.45 };
      const back = -(2.1 / 2 - 0.45 / 2); p.x += Math.sin(bed.yaw) * back; p.z += Math.cos(bed.yaw) * back;
      add('nightstand', c.fits(p) ? p : null, 0.45, 0.45, 0.5);
    }
    add('wardrobe', againstWall(c, room, 1.2, 0.62, rnd), 1.2, 0.62, 2.0);
    if ((room.rect[2] - room.rect[0]) * (room.rect[3] - room.rect[1]) > 15) add('desk', againstWall(c, room, 1.2, 0.65, rnd), 1.2, 0.65, 0.75);
  },
  bathroom(c, room, add, rnd) {
    add('sink', againstWall(c, room, 0.62, 0.48, rnd), 0.62, 0.48, 0.85);
    add('toilet', againstWall(c, room, 0.42, 0.68, rnd), 0.42, 0.68, 0.78);
    add('shower', againstWall(c, room, 0.95, 0.95, rnd), 0.95, 0.95, 2.0);
  },
  living(c, room, add, rnd) {
    const sofa = add('sofa', againstWall(c, room, 2.1, 0.95, rnd), 2.1, 0.95, 0.8);
    if (sofa) {
      const ct = { ...front(sofa, 1.15), yaw: sofa.yaw, w: 1.1, d: 0.6 };
      add('coffee-table', c.fits(ct) ? ct : null, 1.1, 0.6, 0.4);
      const opp = sofa.yaw === 0 ? ['S'] : sofa.yaw === Math.PI ? ['N'] : sofa.yaw > 0 ? ['E'] : ['W'];
      const tv = add('tv-stand', againstWall(c, room, 1.5, 0.42, rnd, { sides: opp }), 1.5, 0.42, 1.25, { faces: sofa.id });
      if (tv) tv.faces = sofa.id;
    }
    add('plant', againstWall(c, room, 0.45, 0.45, rnd), 0.45, 0.45, 1.3);
    add('bookshelf', againstWall(c, room, 0.9, 0.32, rnd), 0.9, 0.32, 1.9);
  },
  kitchen(c, room, add, rnd) {
    for (let i = 0; i < 3; i++) add('counter', againstWall(c, room, 0.6, 0.62, rnd), 0.6, 0.62, 0.92);
    add('fridge', againstWall(c, room, 0.75, 0.75, rnd), 0.75, 0.75, 1.85);
    const table = add('table', freeSpot(c, room, 1.3, 0.85, 0, rnd), 1.3, 0.85, 0.75);
    if (table) for (const s of [-1, 1]) { const ch = { x: table.x, z: table.z + s * (0.425 + 0.35), yaw: s > 0 ? Math.PI : 0, w: 0.46, d: 0.5 }; const it = add('chair', c.fits(ch) ? ch : null, 0.46, 0.5, 0.9); if (it) it.faces = table.id; }
  },
  studio(c, room, add, rnd) { RECIPES.kitchen(c, room, add, rnd); RECIPES.living(c, room, add, rnd); },
  office(c, room, add, rnd) {
    const desk = add('desk', againstWall(c, room, 1.4, 0.72, rnd), 1.4, 0.72, 0.75);
    if (desk) { const ch = { ...front(desk, 0.75), yaw: desk.yaw + Math.PI, w: 0.5, d: 0.5 }; const it = add('office-chair', c.fits(ch) ? ch : null, 0.5, 0.5, 0.95); if (it) it.faces = desk.id; }
    add('bookshelf', againstWall(c, room, 0.9, 0.32, rnd), 0.9, 0.32, 1.9);
    add('plant', againstWall(c, room, 0.45, 0.45, rnd), 0.45, 0.45, 1.3);
    if (c.club) {                                       // identité club : maillot encadré + blason au mur
      add('jersey-frame', againstWall(c, room, 0.85, 0.1, rnd), 0.85, 0.1, 2.0);
      add('crest-panel', againstWall(c, room, 0.9, 0.08, rnd), 0.9, 0.08, 2.0);
    }
  },
  locker(c, room, add, rnd) {
    for (let i = 0; i < 4; i++) add('locker', againstWall(c, room, 1.2, 0.5, rnd), 1.2, 0.5, 1.9);
    add('bench', freeSpot(c, room, 1.8, 0.38, rnd() > 0.5 ? 0 : Math.PI / 2, rnd), 1.8, 0.38, 0.45);
  },
  gym(c, room, add, rnd) {
    add('treadmill', againstWall(c, room, 0.85, 1.9, rnd), 0.85, 1.9, 1.4);
    add('treadmill', againstWall(c, room, 0.85, 1.9, rnd), 0.85, 1.9, 1.4);
    add('rack', againstWall(c, room, 1.2, 0.68, rnd), 1.2, 0.68, 2.2);
    add('bench-press', freeSpot(c, room, 0.65, 1.5, 0, rnd), 0.65, 1.5, 0.5);
    add('mat', freeSpot(c, room, 1.0, 1.8, 0, rnd), 1.0, 1.8, 0.05);
  },
  medical(c, room, add, rnd) {
    add('exam-table', freeSpot(c, room, 0.75, 1.95, rnd() > 0.5 ? 0 : Math.PI / 2, rnd), 0.75, 1.95, 0.8);
    add('cabinet', againstWall(c, room, 0.9, 0.45, rnd), 0.9, 0.45, 1.8);
    add('sink', againstWall(c, room, 0.62, 0.48, rnd), 0.62, 0.48, 0.85);
  },
  cafeteria(c, room, add, rnd) {
    for (let i = 0; i < 3; i++) {
      const t = add('table', freeSpot(c, room, 0.95, 0.95, 0, rnd), 0.95, 0.95, 0.75);
      if (t) for (const s of [-1, 1]) { const ch = { x: t.x + s * 0.85, z: t.z, yaw: s > 0 ? -Math.PI / 2 : Math.PI / 2, w: 0.46, d: 0.5 }; const it = add('chair', c.fits(ch) ? ch : null, 0.46, 0.5, 0.9); if (it) it.faces = t.id; }
    }
    add('counter', againstWall(c, room, 2.0, 0.62, rnd), 2.0, 0.62, 0.92);
  },
  press(c, room, add, rnd) {
    // the podium: sponsor backdrop (press wall) against a wall, the press desk right in front of it
    // (mics on top, club-cloth skirt), speakers' chairs behind, then ROWS of press seats facing it —
    // exactly the TV shot. checkFurnishing() has named rules for this room (backdrop behind, rows face).
    const back = add('press-wall', againstWall(c, room, 2.4, 0.1, rnd), 2.4, 0.1, 2.2);
    if (!back) return;
    const dk = { ...front(back, 1.0), yaw: back.yaw, w: 2.0, d: 0.6 };        // room for the speakers' chairs
    const desk = add('press-desk', c.fits(dk) ? dk : null, 2.0, 0.6, 0.78);
    if (!desk) return;
    const rx = Math.cos(desk.yaw), rz = -Math.sin(desk.yaw);                  // podium's right axis (world)
    for (const s of [-1, 1]) {                                                // speakers between desk and backdrop
      const p = front(desk, -0.62);
      const ch = { x: p.x + rx * 0.5 * s, z: p.z + rz * 0.5 * s, yaw: desk.yaw, w: 0.5, d: 0.5 };
      add('office-chair', c.fits(ch) ? ch : null, 0.5, 0.5, 0.95);
    }
    for (let r = 0; r < 3; r++) for (let i = -1; i <= 1; i++) {               // press rows, facing the podium
      const p = front(desk, 1.45 + r * 0.95);
      const ch = { x: p.x + rx * i * 0.85, z: p.z + rz * i * 0.85, yaw: desk.yaw + Math.PI, w: 0.46, d: 0.5 };
      const it = add('chair', c.fits(ch) ? ch : null, 0.46, 0.5, 0.9); if (it) it.faces = desk.id;
    }
    const camSpot = front(desk, 3.6);                                         // TV camera at the back
    const cam = { x: camSpot.x, z: camSpot.z, yaw: desk.yaw + Math.PI, w: 0.55, d: 0.55 };
    const tc = add('tripod-cam', c.fits(cam) ? cam : null, 0.55, 0.55, 1.6); if (tc) tc.faces = desk.id;
  },
  media(c, room, add, rnd) {
    const screen = add('screen', againstWall(c, room, 2.4, 0.14, rnd), 2.4, 0.14, 1.6);
    if (screen) for (let r = 0; r < 2; r++) for (let i = -1; i <= 1; i++) {
      const p = front(screen, 1.6 + r * 1.1); const ch = { x: p.x + Math.cos(screen.yaw) * i * 0.7, z: p.z - Math.sin(screen.yaw) * i * 0.7, yaw: screen.yaw + Math.PI, w: 0.46, d: 0.5 };
      const it = add('chair', c.fits(ch) ? ch : null, 0.46, 0.5, 0.9); if (it) it.faces = screen.id;
    }
  },
  storage(c, room, add, rnd) { for (let i = 0; i < 3; i++) add('shelf', againstWall(c, room, 0.9, 0.42, rnd), 0.9, 0.42, 1.9); },
  hub(c, room, add, rnd) {
    add('plant', againstWall(c, room, 0.45, 0.45, rnd), 0.45, 0.45, 1.3);
    if (room.rect[3] - room.rect[1] > 2.4) add('bench', againstWall(c, room, 1.6, 0.38, rnd), 1.6, 0.38, 0.45);
  },
};

/** Furnish every room of a model by archetype recipes. Deterministic (model seed ⊕ room). */
export function furnishPlace(model) {
  const items = []; let n = 0;
  model.floors.forEach((floor, fi) => {
    for (const room of floor.rooms) {
      const rnd = mulberry((model.spec.seed + 1) * 2711 + fi * 613 + n * 97 + room.id.length * 7);
      const ctx = roomCtx(model, fi, room, items);
      const add = (kind, spot, w, d, h) => { if (!spot) return null; const it = { id: `f${n++}`, kind, floor: fi, room: room.id, x: spot.x, z: spot.z, yaw: spot.yaw, w, d, h }; items.push(it); return it; };
      (RECIPES[ARCHETYPE(room.id)] || RECIPES.hub)(ctx, room, add, rnd);
    }
  });
  return items;
}

/** Independent re-verification — the furnishing side of the no-regression contract. */
export function checkFurnishing(model, items) {
  const issues = [];
  const byId = new Map(items.map((i) => [i.id, i]));
  model.floors.forEach((floor, fi) => {
    for (const room of floor.rooms) {
      const mine = items.filter((i) => i.floor === fi && i.room === room.id);
      const ctx = roomCtx(model, fi, room, []);
      for (const it of mine) {
        const A = aabb(it);
        if (!rInside(A, ctx.inner, 0.05)) issues.push(`${it.kind}@${room.id}: outside its room`);
        if (ctx.zones.some((z) => rOverlap(A, z, 0.02))) issues.push(`${it.kind}@${room.id}: blocks a door/stair clearance`);
      }
      for (let i = 0; i < mine.length; i++) for (let j = i + 1; j < mine.length; j++)
        if (rOverlap(aabb(mine[i]), aabb(mine[j]), 0.02)) issues.push(`${mine[i].kind}+${mine[j].kind}@${room.id}: overlap`);
    }
  });
  for (const it of items) {
    if (!it.faces) continue; const t = byId.get(it.faces); if (!t) continue;
    const dir = [Math.sin(it.yaw), Math.cos(it.yaw)]; const to = [t.x - it.x, t.z - it.z]; const l = Math.hypot(to[0], to[1]) || 1;
    if ((dir[0] * to[0] + dir[1] * to[1]) / l < 0.5) issues.push(`${it.kind}@${it.room}: does not face its ${t.kind}`);
  }
  // press room: the podium desk needs its sponsor backdrop RIGHT BEHIND it (aligned) and a press
  // audience — at least 2 seats facing the desk (the TV shot must read)
  for (const desk of items.filter((i) => i.kind === 'press-desk')) {
    const wall = items.find((i) => i.kind === 'press-wall' && i.room === desk.room && i.floor === desk.floor);
    if (!wall) { issues.push(`press-desk@${desk.room}: no sponsor backdrop`); continue; }
    const dyaw = Math.atan2(Math.sin(wall.yaw - desk.yaw), Math.cos(wall.yaw - desk.yaw));
    if (Math.abs(dyaw) > 0.1) issues.push(`press-wall@${desk.room}: backdrop not aligned with the podium`);
    const fwd = [Math.sin(desk.yaw), Math.cos(desk.yaw)], to = [wall.x - desk.x, wall.z - desk.z];
    if (fwd[0] * to[0] + fwd[1] * to[1] > 0) issues.push(`press-wall@${desk.room}: backdrop in FRONT of the podium`);
    if (Math.hypot(to[0], to[1]) > 1.2) issues.push(`press-wall@${desk.room}: backdrop too far behind the podium`);
    const seats = items.filter((i) => i.faces === desk.id && i.kind === 'chair').length;
    if (seats < 2) issues.push(`press-desk@${desk.room}: fewer than 2 press seats facing the podium`);
  }
  return { ok: issues.length === 0, issues };
}
