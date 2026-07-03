// Stadium — parametric stadium generator, tier 1 (champêtre : une tribune basse, mains courantes) to
// tier 5 (enceinte ultra-moderne : quatre tribunes à deux niveaux, toit complet). Pure data, seeded,
// dependency-free. The MAIN STAND always carries the LOGE (directors' box): a glass room at the top with
// a small TERRACE in front of it — the playable "FM view" vantage points are exported in model.vantages
// so a game can put the sporting director there and watch the match. checkStadium() is the contract:
// stands clear of the pitch, loge above the rows, UNOBSTRUCTED SIGHTLINE from the terrace to the pitch.
const PITCH = { L: 105, W: 68 }, APRON = 6, ROW_D = 0.8, ROW_H = 0.45, SEAT_STEP = 0.55;

const TIERS = {
  1: { main: 5, opp: 0, ends: 0, deck2: 0, roof: [] },
  2: { main: 8, opp: 5, ends: 0, deck2: 0, roof: ['main'] },
  3: { main: 10, opp: 8, ends: 6, deck2: 0, roof: ['main'] },
  4: { main: 14, opp: 14, ends: 12, deck2: 0, roof: ['main', 'opp'] },
  5: { main: 14, opp: 14, ends: 14, deck2: 10, roof: ['main', 'opp', 'endA', 'endB'] },
};

export function generateStadium({ tier = 1, seed = 1 } = {}) {
  const t = TIERS[Math.max(1, Math.min(5, tier))];
  const stands = [];
  const mk = (id, along, sign, rows, len, deck2) => rows > 0 && stands.push({ id, along, sign, rows, len, deck2: deck2 || 0, roof: t.roof.includes(id) });
  mk('main', 'x', -1, t.main, PITCH.L * 0.9, t.deck2);           // south touchline (z<0) — tribune principale
  mk('opp', 'x', 1, t.opp, PITCH.L * 0.9, t.deck2);
  mk('endA', 'z', -1, t.ends, PITCH.W * 0.9, t.deck2);
  mk('endB', 'z', 1, t.ends, PITCH.W * 0.9, t.deck2);
  const main = stands[0];
  const topY = main.rows * ROW_H;
  const standInner = (s) => (s.along === 'x' ? PITCH.W / 2 : PITCH.L / 2) + APRON;   // distance pitch-centre → first row
  // loge at the top-centre of the main stand: glass room + terrace slab over the last rows
  const logeW = 8, logeD = 3, terrD = 1.7, floorY = topY + 0.05;
  const zIn = -(standInner(main));                                                   // inner edge (towards pitch) of first row
  const zBack = zIn - main.rows * ROW_D;
  const loge = {
    w: logeW, d: logeD, h: 2.6, floorY,
    rect: [-logeW / 2, zBack - logeD, logeW / 2, zBack],                             // room behind the top row
    terrace: [-logeW / 2, zBack, logeW / 2, zBack + terrD],                          // slab over the top rows
    rail: 1.05,
  };
  // loge equipment: bar along the back wall, stools at the bar, a VIP row facing the pitch through the
  // glass, mini-fridge, wall screen, plant. Pure data — themed/built by stadium-builder, checked below.
  const zB = loge.rect[1], zG = loge.rect[3];
  loge.items = [
    { kind: 'counter', x: -logeW / 2 + 1.5, z: zB + 0.45, yaw: Math.PI, w: 2.4, d: 0.62, h: 0.95 },      // bar (face la salle)
    { kind: 'stool', x: -logeW / 2 + 0.8, z: zB + 1.1, yaw: 0, w: 0.4, d: 0.4, h: 0.7 },
    { kind: 'stool', x: -logeW / 2 + 1.5, z: zB + 1.1, yaw: 0, w: 0.4, d: 0.4, h: 0.7 },
    { kind: 'stool', x: -logeW / 2 + 2.2, z: zB + 1.1, yaw: 0, w: 0.4, d: 0.4, h: 0.7 },
    { kind: 'fridge', x: logeW / 2 - 0.55, z: zB + 0.45, yaw: 0, w: 0.65, d: 0.65, h: 1.6 },
    { kind: 'screen', x: logeW / 2 - 0.35, z: (zB + zG) / 2, yaw: -Math.PI / 2, w: 1.1, d: 0.12, h: 1.5 },
    { kind: 'chair', x: -2.7, z: zG - 0.75, yaw: 0, w: 0.5, d: 0.55, h: 0.9, vip: true },
    { kind: 'chair', x: -1.1, z: zG - 0.75, yaw: 0, w: 0.5, d: 0.55, h: 0.9, vip: true },
    { kind: 'chair', x: 0.5, z: zG - 0.75, yaw: 0, w: 0.5, d: 0.55, h: 0.9, vip: true },
    { kind: 'chair', x: 2.1, z: zG - 0.75, yaw: 0, w: 0.5, d: 0.55, h: 0.9, vip: true },
    { kind: 'plant', x: logeW / 2 - 1.35, z: zB + 0.5, yaw: 0, w: 0.45, d: 0.45, h: 1.3 },
  ];
  // derived TERRACE DOORWAY through the glass front, right of the VIP row: the parapet + glass are
  // solid, so without it the terrace exists but can't be reached on foot. checkStadium enforces it.
  loge.door = { x: logeW / 2 - 0.75, w: 0.95 };
  // deck 2 passes through the loge volume → the builder must NOTCH it (loges sit between the decks)
  if (t.deck2 > 0) loge.notchDeck2 = logeW / 2 + 0.6;
  // match furniture — all pure data, themed & built by stadium-builder, checked by the contract:
  const L = PITCH.L, Wp = PITCH.W;
  const goals = [                                                    // cages réglementaires, ouverture vers le centre
    { x: -L / 2, sign: 1, w: 7.32, h: 2.44, depth: 2.0 },
    { x: L / 2, sign: -1, w: 7.32, h: 2.44, depth: 2.0 },
  ];
  const boardSides = tier >= 4 ? ['main', 'opp', 'endA', 'endB'] : tier === 3 ? ['main', 'opp', 'endA'] : tier === 2 ? ['main', 'opp'] : ['opp'];
  const boards = [];                                                 // panneaux sponsors, 3 m derrière les lignes
  for (const side of boardSides) {
    if (side === 'main') boards.push({ a: [-L / 2 + 4, -(Wp / 2 + 3)], b: [L / 2 - 4, -(Wp / 2 + 3)], h: 0.95, face: 1 });
    if (side === 'opp') boards.push({ a: [-L / 2 + 4, Wp / 2 + 3], b: [L / 2 - 4, Wp / 2 + 3], h: 0.95, face: -1 });
    if (side === 'endA') boards.push({ a: [-(L / 2 + 3.5), -Wp / 2 + 4], b: [-(L / 2 + 3.5), Wp / 2 - 4], h: 0.95, face: 1 });
    if (side === 'endB') boards.push({ a: [L / 2 + 3.5, -Wp / 2 + 4], b: [L / 2 + 3.5, Wp / 2 - 4], h: 0.95, face: -1 });
  }
  const flags = [[-L / 2, -Wp / 2], [-L / 2, Wp / 2], [L / 2, -Wp / 2], [L / 2, Wp / 2]];
  const dugouts = tier >= 2 ? [{ x0: -15, x1: -5, z: -(Wp / 2 + 1.7), depth: 1.5, h: 2.1 }, { x0: 5, x1: 15, z: -(Wp / 2 + 1.7), depth: 1.5, h: 2.1 }] : [];
  const tunnel = tier >= 2 ? { x0: -2.2, x1: 2.2, z: -(Wp / 2 + APRON), h: 2.3 } : null;
  const lights = tier <= 3
    ? { type: 'pylon', h: 12 + tier * 2.5, at: [[-(L / 2 + 9), -(Wp / 2 + 9)], [L / 2 + 9, -(Wp / 2 + 9)], [-(L / 2 + 9), Wp / 2 + 9], [L / 2 + 9, Wp / 2 + 9]] }
    : { type: 'roof' };
  const scoreboard = tier >= 3 ? { x: -(L / 2 + APRON + t.ends * ROW_D + 8), y: 7 + tier, w: 10 + tier * 1.5, h: 5 } : null;
  const capacity = stands.reduce((s, st) => s + (st.rows + st.deck2) * Math.floor(st.len / SEAT_STEP), 0);
  const eye = 1.6;
  return {
    spec: { tier, seed }, pitch: PITCH, apron: APRON, rowD: ROW_D, rowH: ROW_H, seatStep: SEAT_STEP,
    stands, loge, capacity, goals, boards, flags, dugouts, tunnel, lights, scoreboard,
    vantages: {
      loge: [0, floorY + eye, (loge.rect[1] + loge.rect[3]) / 2],
      terrace: [0, floorY + eye, (loge.terrace[1] + loge.terrace[3]) / 2],
      pitchCentre: [0, 0, 0],
    },
  };
}

/** Contract: geometry is playable & correct. Run after generation AND after any manual patch. */
export function checkStadium(m) {
  const issues = [];
  for (const s of m.stands) {
    const inner = (s.along === 'x' ? m.pitch.W / 2 : m.pitch.L / 2) + m.apron;
    if (inner < (s.along === 'x' ? m.pitch.W / 2 : m.pitch.L / 2) + 2) issues.push(`${s.id}: stand encroaches the pitch apron`);
    if (s.rows < 3 && s.rows > 0) issues.push(`${s.id}: fewer than 3 rows`);
  }
  const main = m.stands[0];
  const topY = main.rows * m.rowH;
  if (m.loge.floorY < topY - 0.01) issues.push('loge below the top row');
  // sightline: from the terrace eye to the pitch centre, no row may rise above the line of sight
  const [ex, ey, ez] = m.vantages.terrace;
  for (let i = 0; i < main.rows; i++) {
    const rowZ = -((m.pitch.W / 2) + m.apron) - (i + 0.5) * m.rowD;                  // row centre (negative z)
    const rowTop = (i + 1) * m.rowH;
    const u = (rowZ - ez) / (0 - ez);                                                // param along eye→pitch-centre
    if (u <= 0 || u >= 1) continue;
    const losY = ey + (0 - ey) * u;
    if (rowTop > losY - 0.15) issues.push(`sightline blocked by row ${i} (${rowTop.toFixed(2)} vs ${losY.toFixed(2)})`);
  }
  if (m.loge.terrace[3] > -(m.pitch.W / 2)) issues.push('terrace overhangs the pitch');
  if (m.capacity < 100) issues.push('capacity implausibly low');
  // loge equipment: everything inside the room, VIP seats FACE the pitch, nothing glued to the glass
  // except the VIP row, bar against the back wall, no overlaps
  const lg = m.loge; const items = lg.items || [];
  if (items.length < 5) issues.push('loge is unequipped (no bar/seats)');
  const half = (it) => (Math.abs(Math.sin(it.yaw)) > 0.5 ? [it.d / 2, it.w / 2] : [it.w / 2, it.d / 2]);
  const bb = (it) => { const [hx, hz] = half(it); return [it.x - hx, it.z - hz, it.x + hx, it.z + hz]; };
  for (const it of items) {
    const A = bb(it);
    if (A[0] < lg.rect[0] - 0.05 || A[1] < lg.rect[1] - 0.05 || A[2] > lg.rect[2] + 0.05 || A[3] > lg.rect[3] + 0.05) issues.push(`loge ${it.kind}: outside the loge`);
    if (it.vip) { const face = [Math.sin(it.yaw), Math.cos(it.yaw)]; if (face[1] < 0.7) issues.push(`loge VIP seat does not face the pitch`); }
    if (!it.vip && A[3] > lg.rect[3] - 0.35) issues.push(`loge ${it.kind}: blocks the glass front`);
  }
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const A = bb(items[i]), B = bb(items[j]);
    if (Math.min(A[2], B[2]) - Math.max(A[0], B[0]) > 0.02 && Math.min(A[3], B[3]) - Math.max(A[1], B[1]) > 0.02) issues.push(`loge ${items[i].kind}+${items[j].kind}: overlap`);
  }
  const bar = items.find((i) => i.kind === 'counter');
  if (bar && Math.abs((bar.z - bar.d / 2) - lg.rect[1]) > 0.35) issues.push('loge bar not against the back wall');
  // the terrace must be REACHABLE on foot: a doorway through the front wall (parapet + glass are solid)
  if (!lg.door) issues.push('no doorway from the loge to the terrace (the parapet seals the room)');
  else {
    if (lg.door.w < 0.9) issues.push('terrace doorway too narrow for the character');
    if (Math.abs(lg.door.x) + lg.door.w / 2 > lg.w / 2 - 0.2) issues.push('terrace doorway in the loge corner');
    const d0 = lg.door.x - lg.door.w / 2, d1 = lg.door.x + lg.door.w / 2;
    for (const it of items) { const A = bb(it); if (A[2] > d0 - 0.05 && A[0] < d1 + 0.05 && A[3] > lg.rect[3] - 0.75) issues.push(`loge ${it.kind}: blocks the terrace doorway`); }
  }
  // match furniture: regulation goals on the goal lines, boards clear & low, flags at corners, dugouts off-pitch
  for (const g of m.goals || []) {
    if (Math.abs(Math.abs(g.x) - m.pitch.L / 2) > 0.1) issues.push('goal not on the goal line');
    if (Math.abs(g.w - 7.32) > 0.1 || Math.abs(g.h - 2.44) > 0.05) issues.push('goal not regulation size (7.32×2.44)');
    if (Math.sign(g.sign) !== -Math.sign(g.x)) issues.push('goal opening faces away from the pitch');
  }
  if ((m.goals || []).length !== 2) issues.push('a football pitch needs exactly 2 goals');
  for (const b of m.boards || []) {
    const horiz = b.a[1] === b.b[1];
    const gap = horiz ? Math.abs(Math.abs(b.a[1]) - m.pitch.W / 2) : Math.abs(Math.abs(b.a[0]) - m.pitch.L / 2);
    if (gap < 2) issues.push('ad board too close to the pitch');
    if (b.h > 1.15) issues.push('ad board too tall (blocks the first row sightline)');
  }
  for (const f of m.flags || []) if (Math.abs(Math.abs(f[0]) - m.pitch.L / 2) > 0.5 || Math.abs(Math.abs(f[1]) - m.pitch.W / 2) > 0.5) issues.push('corner flag not at a corner');
  if ((m.flags || []).length !== 4) issues.push('4 corner flags required');
  for (const d of m.dugouts || []) if (d.z + d.depth / 2 > -(m.pitch.W / 2 + 0.5)) issues.push('dugout encroaches the touchline');
  if (m.lights?.type === 'pylon' && m.lights.at.length !== 4) issues.push('pylon lighting needs 4 masts');
  // deck 2 must be notched around the loge, or it clips straight through the room
  if (main.deck2 > 0) {
    const inner = m.pitch.W / 2 + m.apron;
    const d2z0 = -(inner + (main.rows + 2 + main.deck2) * m.rowD), d2z1 = -(inner + (main.rows + 2) * m.rowD);
    const d2y0 = (main.rows + 3) * m.rowH;
    const zHit = d2z1 > lg.rect[1] - 0.01 && d2z0 < lg.rect[3] + 0.01;
    const yHit = d2y0 < lg.floorY + lg.h;
    if (zHit && yHit && !(lg.notchDeck2 > lg.w / 2)) issues.push('deck-2 seating passes through the loge (missing notch)');
  }
  return { ok: issues.length === 0, issues };
}
