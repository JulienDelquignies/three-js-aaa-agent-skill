// cabin — vehicle INTERIORS as derived data (no seat is hand-placed): the team-bus cabin (2+2 rows +
// driver), the train coach (2+2 with facing table pairs) and the business-jet lounge (1+1 club chairs
// with FACE-À-FACE table pairs — the future in-flight recruitment meetings). Local space: x across
// the width, z along the length (+z = front), y up from the cabin floor. checkCabin() is the
// contract: every seat inside the shell, no overlaps, the AISLE runs the full length unobstructed
// (the character's capsule must pass), forward seats face forward, lounge pairs face each other.
// Dependency-free → node-testable (scripts/verify-cabin.mjs). Meshes live in cabin-builder.js.
const SEAT = { w: 0.42, d: 0.5 };

export function generateCabin({ kind = 'bus' } = {}) {
  const seats = []; const tables = [];
  const S = (x, z, yaw, extra = {}) => seats.push({ x, z, yaw, w: SEAT.w, d: SEAT.d, ...extra });
  let shell, aisle, door;
  if (kind === 'bus') {
    shell = { L: 8.8, W: 2.44, floorY: 0.62, h: 1.95 };
    aisle = { x0: -0.33, x1: 0.33 };
    door = { z: shell.L / 2 - 0.7, side: 1 };
    S(-0.72, shell.L / 2 - 0.55, 0, { driver: true });                     // driver up front (left)
    for (let r = 0; r < 7; r++) {
      const z = shell.L / 2 - 1.7 - r * 0.82;
      for (const x of [-0.97, -0.55]) S(x, z, 0);                          // 2 left of the aisle
      for (const x of [0.55, 0.97]) S(x, z, 0);                            // 2 right
    }
  } else if (kind === 'train') {
    shell = { L: 8.0, W: 2.6, floorY: 0.62, h: 2.15 };
    aisle = { x0: -0.34, x1: 0.34 };
    door = { z: shell.L / 2 - 0.6, side: 1 };
    for (let r = 0; r < 3; r++) {                                          // forward rows
      const z = shell.L / 2 - 1.5 - r * 0.85;
      for (const x of [-0.99, -0.56]) S(x, z, 0);
      for (const x of [0.56, 0.99]) S(x, z, 0);
    }
    for (const s of [-1, 1]) {                                             // one facing table pair per side
      const zc = -shell.L / 2 + 1.6, x = s * 0.74;
      S(x, zc + 0.62, Math.PI); S(x, zc - 0.62, 0);
      tables.push({ x, z: zc, w: 0.72, d: 0.6 });
    }
  } else {                                                                 // jet — the flying lounge
    shell = { L: 6.4, W: 1.9, floorY: 0.95, h: 1.95 };
    aisle = { x0: -0.33, x1: 0.33 };
    door = { z: shell.L / 2 - 0.55, side: 1 };
    for (const s of [-1, 1]) {                                             // two face-à-face club pairs
      const x = s * 0.6, zc = s > 0 ? 0.9 : -0.9;
      S(x, zc + 0.7, Math.PI, { vip: true }); S(x, zc - 0.7, 0, { vip: true });
      tables.push({ x, z: zc, w: 0.56, d: 0.5 });
    }
    S(-0.6, shell.L / 2 - 0.75, 0, { vip: true });                         // solo club chair up front
  }
  return { kind, shell, aisle, door, seats, tables };
}

/** The cabin contract — run after generation AND after any manual patch of the layout. */
export function checkCabin(c) {
  const issues = [];
  const { shell, aisle, seats, tables } = c;
  const bb = (o, hw = o.w / 2, hd = o.d / 2) => (Math.abs(Math.sin(o.yaw || 0)) > 0.5 ? [o.x - hd, o.z - hw, o.x + hd, o.z + hw] : [o.x - hw, o.z - hd, o.x + hw, o.z + hd]);
  const all = [...seats, ...tables.map((t) => ({ ...t, yaw: 0 }))];
  for (const o of all) {
    const A = bb(o);
    if (A[0] < -shell.W / 2 + 0.03 || A[2] > shell.W / 2 - 0.03 || A[1] < -shell.L / 2 + 0.05 || A[3] > shell.L / 2 - 0.05)
      issues.push(`${o.driver ? 'driver seat' : o.d ? 'seat/table' : 'item'} outside the shell`);
  }
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const A = bb(all[i]), B = bb(all[j]);
    const isPair = all[i].z !== undefined && tables.includes(all[j]);
    if (Math.min(A[2], B[2]) - Math.max(A[0], B[0]) > 0.02 && Math.min(A[3], B[3]) - Math.max(A[1], B[1]) > 0.02 && !isPair)
      issues.push('seats/tables overlap');
  }
  // the AISLE must run the full length, unobstructed, wide enough for the PHYSICS capsule:
  // diameter 0.60 + 2× the character-controller offset (0.02) — 0.52 passed the old contract but
  // wedged the capsule between the seat colliders in-game. Contracts must encode the REAL gauge.
  if (aisle.x1 - aisle.x0 < 0.64) issues.push('aisle too narrow for the character');
  for (const o of all) {
    const A = bb(o);
    if (A[2] > aisle.x0 + 0.02 && A[0] < aisle.x1 - 0.02) issues.push('the aisle is obstructed');
  }
  // the door bay must be clear (you must be able to board)
  if (c.door) {
    const dz = c.door.z;
    for (const o of all) { const A = bb(o); if (A[3] > dz - 0.35 && A[1] < dz + 0.35 && (c.door.side > 0 ? A[2] > shell.W / 2 - 0.6 : A[0] < -shell.W / 2 + 0.6)) issues.push('the door bay is blocked'); }
  }
  // facing rules: forward seats face the front (+z); lounge/table pairs face EACH OTHER
  const nearTable = (s) => tables.some((t) => Math.abs(s.x - t.x) < 0.3 && Math.abs(s.z - t.z) < 1.2);
  for (const s of seats) if (!s.driver && !nearTable(s) && Math.cos(s.yaw) < 0.7) issues.push('a forward seat does not face the front');
  for (const t of tables) {
    const around = seats.filter((s) => Math.abs(s.x - t.x) < 0.3 && Math.abs(s.z - t.z) < 1.2);
    const facing = around.some((a) => around.some((b) => a !== b && Math.abs(Math.atan2(Math.sin(a.yaw - b.yaw), Math.cos(a.yaw - b.yaw))) > Math.PI - 0.15));
    if (around.length < 2 || !facing) issues.push('a table lacks its face-to-face pair');
  }
  if (seats.length < 3) issues.push('cabin implausibly empty');
  return { ok: issues.length === 0, issues };
}
