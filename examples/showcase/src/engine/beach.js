import { generatePlace, checkModel } from './floorplan.js';
import { placeBounds as pb } from './career.js';

// beach — the VACATION resort as derived data: a seaside villa (the home grammar, one tier above your
// level — you holiday better than you live), a SAND strip running down to the SEA, seeded palm trees,
// sun loungers (transats) and parasols. Local space: the villa at the origin, the sea to the SOUTH
// (+z). Reached only by train or jet (it is far from the city — no street can go there), so the scene
// places it wherever it wants. checkBeach() is the contract: the sea strictly beyond the sand, every
// transat ON the sand and FACING THE SEA, palms clear of the villa/pool/transats, spawn walkable.
// Dependency-free → node-testable (scripts/verify-beach.mjs). Meshes live in beach-builder.js.
const mulberry = (seed) => { let t = seed >>> 0; return () => { t += 0x6D2B79F5; let x = Math.imul(t ^ (t >>> 15), 1 | t); x ^= x + Math.imul(x ^ (x >>> 7), 61 | x); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; };

export function placeBounds(m) { return pb(m); }

export function generateBeach({ level = 3, seed = 1 } = {}) {
  const villa = generatePlace({ type: 'home', tier: Math.min(5, level + 1), seed: seed + 6 });
  const rnd = mulberry(seed * 3557 + level * 101 + 7);
  const vb = pb(villa);
  const M = 14;                                                     // sand margin around the villa
  const sand = [vb[0] - M, vb[1] - 6, vb[2] + M, vb[3] + 24];       // the beach runs SOUTH of the villa
  const sea = [sand[0] - 60, sand[3], sand[2] + 60, sand[3] + 90];  // the water starts where the sand ends
  const transats = [];                                              // loungers between villa and water
  const n = 3 + Math.min(4, level);
  for (let i = 0; i < n; i++) {
    const x = sand[0] + 3 + ((i + 0.5) / n) * (sand[2] - sand[0] - 6) + (rnd() - 0.5) * 1.2;
    const z = sand[3] - 3.5 - rnd() * 3.5;
    transats.push({ x, z, yaw: (rnd() - 0.5) * 0.3 });              // yaw ≈ 0 → facing +z, the sea
  }
  const parasols = transats.filter((_, i) => i % 2 === 0).map((t) => [t.x + 0.9, t.z - 0.6]);
  const palms = [];
  for (let i = 0; i < 10 + level * 3; i++) {
    const x = sand[0] + 1.5 + rnd() * (sand[2] - sand[0] - 3);
    const z = sand[1] + 1.5 + rnd() * (sand[3] - sand[1] - 6);
    // keep palms off the villa footprint (pool included) and away from the loungers
    if (x > vb[0] - 1.2 && x < vb[2] + 1.2 && z > vb[1] - 1.2 && z < vb[3] + 1.2) continue;
    if (transats.some((t) => hyp(t.x - x, t.z - z) < 2.2)) continue;
    palms.push([x, z, 0.85 + rnd() * 0.5]);
  }
  const hub = villa.floors[0].rooms.find((r) => r.id === villa.floors[0].hubId);
  const spawn = [hub.rect[0] - 1.4, 0, (hub.rect[1] + hub.rect[3]) / 2];      // outside the entrance
  const returnPad = [spawn[0] - 2.2, 0, spawn[2]];
  return { level, seed, villa, sand, sea, transats, parasols, palms, spawn, returnPad };
}

/** The resort contract — run after generation AND after any manual patch. */
export function checkBeach(b) {
  const issues = [];
  const r = checkModel(b.villa); if (!r.ok) issues.push(`villa: ${r.issues[0]}`);
  const vb = pb(b.villa);
  const inSand = (x, z, m = 0) => x >= b.sand[0] - m && x <= b.sand[2] + m && z >= b.sand[1] - m && z <= b.sand[3] + m;
  if (b.sea[1] < b.sand[3] - 0.01) issues.push('the sea floods the beach (sea starts before the sand ends)');
  if (vb[3] > b.sand[3] - 4) issues.push('the villa stands in the surf');
  for (const t of b.transats) {
    if (!inSand(t.x, t.z)) issues.push('a lounger is off the sand');
    if (t.z > b.sand[3] - 1) issues.push('a lounger is in the water');
    if (Math.cos(t.yaw) < 0.9) issues.push('a lounger does not face the sea');
    if (t.x > vb[0] - 0.8 && t.x < vb[2] + 0.8 && t.z > vb[1] - 0.8 && t.z < vb[3] + 0.8) issues.push('a lounger clips the villa');
  }
  for (const [x, z] of b.palms) {
    if (!inSand(x, z)) issues.push('a palm is off the sand');
    if (x > vb[0] - 0.8 && x < vb[2] + 0.8 && z > vb[1] - 0.8 && z < vb[3] + 0.8) issues.push('a palm grows through the villa');
    if (b.transats.some((t) => hyp(t.x - x, t.z - z) < 1.2)) issues.push('a palm grows through a lounger');
  }
  if (!inSand(b.spawn[0], b.spawn[2], 2)) issues.push('spawn off the resort');
  if (b.spawn[0] > vb[0] && b.spawn[0] < vb[2] && b.spawn[2] > vb[1] && b.spawn[2] < vb[3]) issues.push('spawn inside the villa');
  if (hyp(b.returnPad[0] - b.spawn[0], b.returnPad[2] - b.spawn[2]) > 6) issues.push('return pad far from the spawn');
  if (b.transats.length < 3) issues.push('resort implausibly empty (no loungers)');
  return { ok: issues.length === 0, issues };
}
import { hyp } from './hyp.js';
