// Floorplan — declarative, seeded interior generator. You never draw a plan: you give a SPEC
//   { type: 'club'|'home', tier: 1..5, seed }
// and a tier expands into a PROGRAM (required rooms + areas + connections). The solver lays rooms out
// around a hub (corridor / séjour) so every required adjacency shares a wall BY CONSTRUCTION, then
// DERIVES the openings: a door is the centred segment of the wall shared by two connected rooms (so it
// can never be "in the wrong place"), windows sit on exterior walls, and stairs are sized from real
// riser/going rules when the program has two floors. Output is a serialisable JSON model (rooms, walls
// with openings, stairs, spawn) — customise it as data, then re-check it with checkModel(): that is the
// no-regression contract (see scripts/verify-floorplan.mjs, the multi-seed/multi-tier harness).
//
// Dependency-free (pure data + math) → node-testable. Rendering/colliders live in place-builder.js.

export const WALL_H = 2.7, SLAB_T = 0.15, WALL_T = 0.12;
export const DOOR_W = 1.0, DOOR_H = 2.05, WIN_W = 1.4, WIN_H = 1.2, WIN_SILL = 1.0;
const FLOOR_H = WALL_H + SLAB_T;                       // storey height (stairs climb this)
const MIN_W = 3.2, CAPSULE_D = 0.7;                    // min footprint width; character capsule diameter

const mulberry = (seed) => { let t = seed >>> 0; return () => { t += 0x6D2B79F5; let x = Math.imul(t ^ (t >>> 15), 1 | t); x ^= x + Math.imul(x ^ (x >>> 7), 61 | x); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// ---- programs: tier → required rooms. `via` attaches a room to a parent (ensuite) instead of the hub.
const CLUB = {
  1: { hub: ['couloir', 9], rooms: [['vestiaire', 20, 1], ['bureau', 10, 1, null, 'glass'], ['stockage', 8, 0]], pitches: 1 },
  2: { hub: ['couloir', 12], rooms: [['vestiaire', 20, 1], ['gym', 30, 1], ['bureau', 10, 1, null, 'glass'], ['salle-presse', 14, 1], ['cafeteria', 16, 1], ['cuisine-cafet', 8, 1, 'cafeteria'], ['salle-kine', 10, 1], ['infirmerie', 10, 1], ['stockage', 8, 0]], pitches: 1 },
  3: { hub: ['couloir', 16], rooms: [['vestiaire', 20, 1], ['vestiaire2', 20, 1], ['gym', 34, 1], ['salle-video', 16, 1], ['salle-presse', 16, 1], ['cafeteria', 22, 1], ['cuisine-cafet', 10, 1, 'cafeteria'], ['salle-kine', 14, 1], ['bureau', 12, 1, null, 'glass'], ['infirmerie', 10, 1]], pitches: 2 },
  4: { hub: ['hall', 22], rooms: [['vestiaire', 22, 1], ['vestiaire2', 22, 1], ['gym', 40, 1], ['spa', 24, 1], ['salle-video', 18, 1], ['salle-presse', 20, 1], ['cafeteria', 30, 1], ['cuisine-cafet', 12, 1, 'cafeteria'], ['salle-kine', 16, 1], ['bureau', 12, 1, null, 'glass'], ['infirmerie', 12, 1]], pitches: 2 },
  5: { hub: ['hall', 30], rooms: [['vestiaire', 24, 1], ['vestiaire2', 24, 1], ['gym', 48, 1], ['spa', 30, 1], ['auditorium', 40, 1], ['salle-presse', 26, 1], ['cafeteria', 34, 1], ['cuisine-cafet', 14, 1, 'cafeteria'], ['salle-kine', 20, 1], ['bureaux-staff', 20, 1, null, 'glass'], ['infirmerie', 14, 1], ['stockage', 10, 0]], pitches: 3 },
};
const HOME = {
  1: { hub: ['chambre', 18], rooms: [['sdb', 6, 1]] },                                                    // chambre d'hôtel
  2: { hub: ['sejour-cuisine', 26], rooms: [['chambre', 12, 1], ['sdb', 6, 1]] },                          // studio/T2
  3: { hub: ['sejour', 30], rooms: [['cuisine', 12, 1], ['chambre', 14, 1], ['chambre2', 11, 1], ['sdb', 8, 1]] },
  4: { hub: ['sejour', 36], rooms: [['cuisine', 14, 1], ['chambre', 14, 1], ['bureau', 10, 1], ['sdb', 9, 1]],
       upper: { hub: ['palier', 8], rooms: [['chambre2', 16, 1], ['chambre3', 13, 1], ['sdb2', 8, 1]] } },
  5: { hub: ['sejour', 50], rooms: [['cuisine', 18, 1], ['suite', 20, 1], ['sdb-suite', 8, 1, 'suite'], ['bureau', 12, 1]],
       upper: { hub: ['palier', 10], rooms: [['chambre2', 16, 1], ['chambre3', 16, 1], ['sdb2', 10, 1]] },
       outdoor: { pool: [4.5, 9], terrace: 2.5 } },                                                        // villa + piscine
};

// venues de rencontre (jeu DS) : le restaurant — la salle EST le hub (bar + tables de 2 face à face),
// cuisine attenante, et dès le t3 des SALONS PRIVÉS (la table de rendez-vous, contrat « 2 places face à
// face » dans furnish). t1 bistrot → t5 gastronomique.
const RESTO = {
  1: { hub: ['salle-resto', 26], rooms: [['cuisine-resto', 10, 1], ['sanitaires', 5, 0]] },
  2: { hub: ['salle-resto', 34], rooms: [['cuisine-resto', 12, 1], ['sanitaires', 6, 0], ['reserve', 6, 0]] },
  3: { hub: ['salle-resto', 40], rooms: [['cuisine-resto', 14, 1], ['salon-prive', 12, 1], ['sanitaires', 6, 0], ['reserve', 6, 0]] },
  4: { hub: ['salle-resto', 48], rooms: [['cuisine-resto', 16, 1], ['salon-prive', 14, 1], ['salon-prive2', 12, 1], ['sanitaires', 8, 0], ['reserve', 8, 0]] },
  5: { hub: ['salle-resto', 58], rooms: [['cuisine-resto', 20, 1], ['salon-prive', 16, 1], ['salon-prive2', 14, 1], ['cave', 8, 0], ['sanitaires', 8, 0], ['reserve', 8, 0]] },
};

const parse = ([id, area, win, via, flag]) => ({ id, area, win: win || 0, via: via || null, glass: flag === 'glass' });

// ---- layout: one floor = north strip | hub band | south strip, all spanning the same width W.
function layoutFloor(prog, W, sd, hubD, zStart, rnd) {
  const rooms = prog.rooms.map(parse);
  // clusters keep `via` children glued to their parent so their shared wall exists by construction
  const clusters = [];
  for (const r of rooms) if (!r.via) clusters.push([r]);
  for (const r of rooms) if (r.via) { const c = clusters.find((cl) => cl[0].id === r.via); (c || clusters[clusters.length - 1]).push(r); }
  // distribute clusters to strips, biggest first onto the lighter side (seeded tie-break for variety)
  const width = (cl) => cl.reduce((s, r) => s + r.area, 0) / sd;
  clusters.sort((a, b) => width(b) - width(a));
  const strips = [[], []], loads = [0, 0];
  for (const cl of clusters) {
    const i = cl.some((r) => r.glass) ? 0 : loads[0] - loads[1] < (rnd() - 0.5) * 0.6 ? 0 : 1;   // vitrés → côté terrains
    strips[i].push(cl); loads[i] += width(cl);
  }
  if (strips[0].length === 0 && strips[1].length) strips[0].push(strips[1].pop());
  // stretch each strip to exactly W, tile the rooms
  const out = [], hubId = prog.hub[0];
  const bands = [[zStart, zStart + (strips[0].length ? sd : 0)], null, null];
  bands[1] = [bands[0][1], bands[0][1] + hubD];
  bands[2] = [bands[1][1], bands[1][1] + (strips[1].length ? sd : 0)];
  strips.forEach((strip, si) => {
    const flat = strip.flat(); if (!flat.length) return;
    const nat = flat.map((r) => r.area / sd); const k = W / nat.reduce((s, x) => s + x, 0);
    let x = 0; const [z0, z1] = bands[si === 0 ? 0 : 2];
    for (let i = 0; i < flat.length; i++) { const w = nat[i] * k; out.push({ ...flat[i], rect: [x, z0, x + w, z1], strip: si === 0 ? 'N' : 'S' }); x += w; }
  });
  out.push({ id: hubId, area: prog.hub[1], win: 0, via: null, rect: [0, bands[1][0], W, bands[1][1]], strip: 'H' });
  return { rooms: out, bands, hubId };
}

// ---- walls + derived openings for one laid-out floor
function buildWalls(fl, W, isGround, entrance) {
  const walls = []; const room = (id) => fl.rooms.find((r) => r.id === id);
  const add = (a, b, rooms, openings = []) => { walls.push({ a, b, rooms, openings }); return walls[walls.length - 1]; };
  const door = (len) => ({ type: 'door', at: len / 2, w: DOOR_W, h: DOOR_H });
  const win = (len) => ({ type: 'window', at: len / 2, w: Math.min(WIN_W, len - 0.8), h: WIN_H, sill: WIN_SILL });
  const hub = room(fl.hubId);
  for (const r of fl.rooms) {
    if (r.strip === 'H') continue;
    const [x0, z0, x1, z1] = r.rect; const len = x1 - x0;
    // wall shared with the hub — THE door lives here (derived, centred), unless the room is an ensuite
    const zh = r.strip === 'N' ? z1 : z0;
    add([x0, zh], [x1, zh], [r.id, hub.id], r.via ? [] : [door(len)]);
    // exterior wall — glazed bay for glass rooms (view over the pitches), else a window
    const ze = r.strip === 'N' ? z0 : z1;
    const glass = (l) => ({ type: 'glass', at: l / 2, w: Math.max(0.8, l - 0.7), h: WALL_H - 0.5, sill: 0.15 });
    add([x0, ze], [x1, ze], [r.id, 'out'], r.glass ? [glass(len)] : r.win && len > WIN_W + 1 ? [win(len)] : []);
  }
  // vertical walls between strip neighbours (+ ensuite doors on the shared wall with their parent)
  for (const strip of ['N', 'S']) {
    const rs = fl.rooms.filter((r) => r.strip === strip).sort((a, b) => a.rect[0] - b.rect[0]);
    for (let i = 0; i < rs.length; i++) {
      const [x0, z0, x1, z1] = rs[i].rect;
      if (i < rs.length - 1) {
        const nb = rs[i + 1]; const pair = rs[i].via === nb.id || nb.via === rs[i].id;
        add([x1, z0], [x1, z1], [rs[i].id, nb.id], pair ? [door(z1 - z0)] : []);
      }
      if (i === 0) add([x0, z0], [x0, z1], [rs[i].id, 'out'], []);
      if (i === rs.length - 1) add([x1, z0], [x1, z1], [rs[i].id, 'out'], []);
    }
  }
  // hub end walls (west = entrance on the ground floor)
  const [hx0, hz0, hx1, hz1] = hub.rect;
  add([hx0, hz0], [hx0, hz1], [hub.id, 'out'], isGround && entrance ? [door(hz1 - hz0)] : []);
  add([hx1, hz0], [hx1, hz1], [hub.id, 'out'], []);
  // hub exterior top/bottom if a strip is missing
  if (!fl.rooms.some((r) => r.strip === 'N')) add([hx0, hz0], [hx1, hz0], [hub.id, 'out'], []);
  if (!fl.rooms.some((r) => r.strip === 'S')) add([hx0, hz1], [hx1, hz1], [hub.id, 'out'], []);
  return walls;
}

/** Generate a place model from a spec. Deterministic for a given (type, tier, seed). */
export function generatePlace({ type = 'home', tier = 1, seed = 1 } = {}) {
  const catalog = type === 'club' ? CLUB : type === 'restaurant' ? RESTO : HOME;
  const prog = catalog[clamp(tier, 1, 5)];
  const rnd = mulberry(seed * 7919 + tier * 131 + (type === 'club' ? 17 : type === 'restaurant' ? 29 : 0));
  const floorsProg = [prog, prog.upper].filter(Boolean);
  // shared strip metrics across floors so the stairwell always lands inside both hubs
  const all = floorsProg.flatMap((p) => p.rooms.map(parse));
  const avg = all.reduce((s, r) => s + r.area, 0) / all.length;
  const sd = clamp(Math.sqrt(avg) * 1.15, 2.4, 5.4);
  const natW = (p) => { const byStrip = p.rooms.map(parse).reduce((s, r) => s + r.area, 0) / sd / 2; return Math.max(MIN_W, byStrip * 1.15); };
  let W = Math.max(...floorsProg.map(natW));
  const maxHub = Math.max(...floorsProg.map((p) => p.hub[1]));
  W = Math.max(W, Math.sqrt(maxHub * 1.8));            // keep big hubs wide, not tunnel-deep
  const hubD = clamp(maxHub / W, 1.8, 7);
  // stairs (two floors): straight run inside the hub band, sized from riser rules
  let stairs = null;
  if (floorsProg.length > 1) {
    const risers = Math.ceil(FLOOR_H / 0.185), riser = FLOOR_H / risers, going = 0.26, run = risers * going;
    W = Math.max(W, run + 2.4);                        // hub must hold the run + landings
    stairs = { risers, riser, going, width: 1.0, run };
  }
  const floors = floorsProg.map((p, fi) => {
    const fl = layoutFloor(p, W, sd, hubD, 0, rnd);
    const walls = buildWalls(fl, W, fi === 0, true);
    return { y: fi * FLOOR_H, rooms: fl.rooms.map(({ via, ...r }) => r), walls, hubId: fl.hubId };
  });
  if (stairs) {
    const hub = floors[0].rooms.find((r) => r.id === floors[0].hubId).rect;
    const zc = (hub[1] + hub[3]) / 2;
    stairs.rect = [hub[2] - 0.3 - stairs.run, zc - stairs.width / 2, hub[2] - 0.3, zc + stairs.width / 2];
    stairs.dir = '+x';
  }
  const D = Math.max(...floors.map((f) => Math.max(...f.rooms.map((r) => r.rect[3]))));
  const hub0 = floors[0].rooms.find((r) => r.id === floors[0].hubId);
  let outdoor = null;
  if (prog.outdoor) outdoor = { terrace: [0, D, W, D + prog.outdoor.terrace + prog.outdoor.pool[1]], pool: [W / 2 - prog.outdoor.pool[0] / 2, D + prog.outdoor.terrace, W / 2 + prog.outdoor.pool[0] / 2, D + prog.outdoor.terrace + prog.outdoor.pool[1]] };
  if (prog.pitches) {                                  // club training pitches north of the building (facing the glass offices)
    const PW = 30, PD = 20, gap = 3, total = prog.pitches * PW + (prog.pitches - 1) * gap;
    const x0 = W / 2 - total / 2;
    outdoor = { pitches: Array.from({ length: prog.pitches }, (_, i) => [x0 + i * (PW + gap), -6 - PD, x0 + i * (PW + gap) + PW, -6]) };
  }
  const model = {
    spec: { type, tier, seed }, W, D, floorH: FLOOR_H, wallH: WALL_H,
    floors, stairs,
    outdoor,
    spawn: { pos: [0.9, 0, (hub0.rect[1] + hub0.rect[3]) / 2], room: hub0.id },
  };
  return model;
}

/** Solid boxes for a wall around its openings (for meshes AND colliders). Axis-aligned walls only. */
export function wallBoxes(wall, { h = WALL_H, t = WALL_T, y = 0 } = {}) {
  const dx = wall.b[0] - wall.a[0], dz = wall.b[1] - wall.a[1];
  const len = Math.abs(dx) + Math.abs(dz), ux = Math.sign(dx), uz = Math.sign(dz);
  const boxes = [];
  const box = (s, e, y0, y1) => { if (e - s < 1e-4 || y1 - y0 < 1e-4) return; const m = (s + e) / 2;
    boxes.push({ c: [wall.a[0] + ux * m, y + (y0 + y1) / 2, wall.a[1] + uz * m], h: [ux ? (e - s) / 2 : t / 2, (y1 - y0) / 2, uz ? (e - s) / 2 : t / 2] }); };
  const ops = [...wall.openings].sort((a, b) => a.at - b.at);
  let cur = 0;
  for (const o of ops) {
    const s = o.at - o.w / 2, e = o.at + o.w / 2;
    box(cur, s, 0, h);
    if (o.type === 'door') box(s, e, o.h, h);                              // lintel
    else { box(s, e, 0, o.sill); box(s, e, o.sill + o.h, h); }            // sill + lintel
    cur = e;
  }
  box(cur, len, 0, h);
  return boxes;
}

/** The no-regression contract: every generated (or hand-customised) model must pass. */
export function checkModel(model) {
  const issues = [];
  const overlap = (a, b) => Math.min(a[2], b[2]) - Math.max(a[0], b[0]) > 0.01 && Math.min(a[3], b[3]) - Math.max(a[1], b[1]) > 0.01;
  for (const [fi, f] of model.floors.entries()) {
    // rooms: inside footprint, no overlaps
    for (const r of f.rooms) if (r.rect[0] < -0.01 || r.rect[1] < -0.01 || r.rect[2] > model.W + 0.01 || r.rect[3] > model.D + 0.01) issues.push(`floor${fi}/${r.id}: outside footprint`);
    for (let i = 0; i < f.rooms.length; i++) for (let j = i + 1; j < f.rooms.length; j++) if (overlap(f.rooms[i].rect, f.rooms[j].rect)) issues.push(`floor${fi}: ${f.rooms[i].id} overlaps ${f.rooms[j].id}`);
    for (const w of f.walls) {
      const len = Math.abs(w.b[0] - w.a[0]) + Math.abs(w.b[1] - w.a[1]);
      for (const o of w.openings) {
        if (o.at - o.w / 2 < 0.2 || o.at + o.w / 2 > len - 0.2) issues.push(`floor${fi}: ${o.type} too close to a corner (${w.rooms.join('/')})`);
        if (o.type === 'door' && o.w < CAPSULE_D + 0.2) issues.push(`floor${fi}: door too narrow for the character (${w.rooms.join('/')})`);
        if ((o.type === 'window' || o.type === 'glass') && !w.rooms.includes('out')) issues.push(`floor${fi}: ${o.type} on an interior wall (${w.rooms.join('/')})`);
      }
    }
    // connectivity: BFS over door edges (+ stairs between hub floors) must reach every room from outside
  }
  const nodes = new Set(['out']); const edges = [];
  model.floors.forEach((f, fi) => { for (const r of f.rooms) nodes.add(`${fi}:${r.id}`);
    for (const w of f.walls) if (w.openings.some((o) => o.type === 'door')) edges.push([w.rooms[0] === 'out' ? 'out' : `${fi}:${w.rooms[0]}`, w.rooms[1] === 'out' ? 'out' : `${fi}:${w.rooms[1]}`]); });
  if (model.stairs && model.floors[1]) edges.push([`0:${model.floors[0].hubId}`, `1:${model.floors[1].hubId}`]);
  const seen = new Set(['out']); const queue = ['out'];
  while (queue.length) { const n = queue.pop(); for (const [a, b] of edges) { const o = a === n ? b : b === n ? a : null; if (o && !seen.has(o)) { seen.add(o); queue.push(o); } } }
  for (const n of nodes) if (!seen.has(n)) issues.push(`unreachable room: ${n}`);
  // stairs geometry + must sit inside both hubs
  if (model.stairs) {
    const s = model.stairs;
    if (s.riser < 0.15 || s.riser > 0.19) issues.push(`stair riser ${s.riser.toFixed(3)} outside 0.15–0.19`);
    if (s.going < 0.25) issues.push('stair going < 0.25');
    if (s.width < 0.9) issues.push('stair too narrow');
    const inside = (rect, hub) => rect[0] >= hub[0] - 0.01 && rect[1] >= hub[1] - 0.01 && rect[2] <= hub[2] + 0.01 && rect[3] <= hub[3] + 0.01;
    for (const [fi, f] of model.floors.entries()) { const hub = f.rooms.find((r) => r.id === f.hubId).rect; if (!inside(s.rect, hub)) issues.push(`stairwell escapes the floor-${fi} hub`); }
  }
  if (model.outdoor?.pool) { const p = model.outdoor.pool; if (p[1] < model.D) issues.push('pool intersects the house'); }
  if (model.outdoor?.pitches) for (const p of model.outdoor.pitches) if (p[3] > 0) issues.push('training pitch intersects the building');
  // every glass room must actually face the pitches (north exterior)
  if (model.outdoor?.pitches) for (const f of model.floors) for (const w of f.walls)
    for (const o of w.openings) if (o.type === 'glass' && Math.abs(w.a[1]) > 0.01) issues.push(`glass wall not facing the pitches (${w.rooms.join('/')})`);
  // hub is passable
  for (const [fi, f] of model.floors.entries()) { const hub = f.rooms.find((r) => r.id === f.hubId).rect; if (hub[3] - hub[1] < 1.2) issues.push(`floor${fi} hub narrower than 1.2 m`); }
  return { ok: issues.length === 0, issues };
}
