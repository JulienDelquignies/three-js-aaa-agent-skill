// circuit — the TRACK DAY as derived data (buy a nice car → take it to the circuit): a closed racing
// loop generated from seeded control points on a jittered circle, smoothed by closed Catmull-Rom.
// Local space, centred on the origin; the scene drops it far from the city like the beach resort.
// checkCircuit() is the drivability contract: a CLOSED loop, every bend wider than the car can turn
// (min curvature radius), no self-intersection or near-touch pinch, the paddock safely OFF the
// track. Generation is self-correcting AND deterministic: it retries derived sub-seeds until the
// contract passes, so a given (level, seed) always yields the same, provably drivable track.
// Meshes/colliders live in circuit-builder.js; lap timing is data too (start line + direction).
const mulberry = (seed) => { let t = seed >>> 0; return () => { t += 0x6D2B79F5; let x = Math.imul(t ^ (t >>> 15), 1 | t); x ^= x + Math.imul(x ^ (x >>> 7), 61 | x); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; };

function catmullClosed(ctrl, samplesPerSeg) {
  const n = ctrl.length, pts = [];
  for (let i = 0; i < n; i++) {
    const p0 = ctrl[(i + n - 1) % n], p1 = ctrl[i], p2 = ctrl[(i + 1) % n], p3 = ctrl[(i + 2) % n];
    for (let s = 0; s < samplesPerSeg; s++) {
      const t = s / samplesPerSeg, t2 = t * t, t3 = t2 * t;
      pts.push([
        0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  return pts;
}

function attempt({ level, seed }) {
  const rnd = mulberry(seed * 7919 + level * 251 + 13);
  const N = 9 + level, R = 58 + level * 13;
  // low-frequency radial variation (2–3 lobes + gentle jitter): neighbouring control points stay
  // COHERENT — independent per-point jitter folds the loop onto itself and the ribbon overlaps
  const freq = 2 + ((rnd() * 2) | 0), phase = rnd() * Math.PI * 2, amp = 0.16 + rnd() * 0.14;
  const ctrl = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const r = R * (0.88 + amp * Math.sin(a * freq + phase) + (rnd() - 0.5) * 0.09);
    ctrl.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  const pts = catmullClosed(ctrl, 14);
  const width = 8.5;
  const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const start = { pos: pts[0], dir: (() => { const v = [pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]], l = Math.hypot(...v); return [v[0] / l, v[1] / l]; })() };
  const nrm = [-start.dir[1], start.dir[0]];                       // start-line normal (left)
  const paddock = {
    spawn: [start.pos[0] + nrm[0] * (width / 2 + 9), start.pos[1] + nrm[1] * (width / 2 + 9)],
    returnPad: [start.pos[0] + nrm[0] * (width / 2 + 12.2), start.pos[1] + nrm[1] * (width / 2 + 12.2)],
  };
  const grid = [start.pos[0] - start.dir[0] * 6, start.pos[1] - start.dir[1] * 6];   // grid slot behind the line
  return { level, seed, pts, width, start, paddock, grid, R };
}

export function generateCircuit({ level = 2, seed = 1 } = {}) {
  for (let k = 0; k < 40; k++) {                                   // deterministic self-correction
    const c = attempt({ level, seed: seed * 31 + k * 7 });
    if (checkCircuit(c).ok) return { ...c, seed };                  // keep the caller's seed in the data
  }
  throw new Error('no drivable circuit found (contract never satisfied)');
}

/** The drivability contract — run after generation AND after any manual patch. */
export function checkCircuit(c) {
  const issues = [];
  const { pts, width } = c, n = pts.length;
  if (n < 80) issues.push('track too coarse');
  // every bend must be drivable: circumradius of each sample triplet ≥ 9 m
  let minR = Infinity;
  for (let i = 0; i < n; i++) {
    const a = pts[(i + n - 1) % n], b = pts[i], cc = pts[(i + 1) % n];
    const ab = Math.hypot(b[0] - a[0], b[1] - a[1]), bc = Math.hypot(cc[0] - b[0], cc[1] - b[1]), ca = Math.hypot(a[0] - cc[0], a[1] - cc[1]);
    const area2 = Math.abs((b[0] - a[0]) * (cc[1] - a[1]) - (b[1] - a[1]) * (cc[0] - a[0]));
    if (area2 > 1e-9) minR = Math.min(minR, (ab * bc * ca) / (2 * area2));
  }
  if (minR < 9) issues.push(`a bend is tighter than the car can turn (R=${minR.toFixed(1)} m)`);
  // no self-intersection / pinch: non-neighbouring centreline points keep ≥ 1.6× width apart
  const GAP = (n / 10) | 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const circGap = Math.min(j - i, n - (j - i));                // neighbourhood is CIRCULAR
      if (circGap < GAP) continue;
      const dx = pts[i][0] - pts[j][0], dz = pts[i][1] - pts[j][1];
      if (dx * dx + dz * dz < (width * 1.6) ** 2) { issues.push('the track crosses or pinches itself'); i = n; break; }
    }
  }
  // the paddock stands OFF the racing surface
  for (const p of [c.paddock.spawn, c.paddock.returnPad]) {
    for (const q of pts) if (Math.hypot(p[0] - q[0], p[1] - q[1]) < width / 2 + 2) { issues.push('the paddock sits on the track'); break; }
  }
  // the grid slot IS on the track (you start ON the tarmac, aimed down the straight)
  let onTrack = false;
  for (const q of pts) if (Math.hypot(c.grid[0] - q[0], c.grid[1] - q[1]) < width / 2) { onTrack = true; break; }
  if (!onTrack) issues.push('the starting grid is off the track');
  return { ok: issues.length === 0, issues, minRadius: minR };
}

/** Lap-line crossing detector (pure data → node-testable): feed positions each frame. */
export function makeLapTimer(circuit) {
  const { start, width } = circuit;
  let prevAlong = null, t = 0, armed = false;
  return {
    /** advance dt with the car at [x, z]; returns {lap: seconds} exactly when the line is crossed */
    update(dt, x, z) {
      t += dt;
      const rx = x - start.pos[0], rz = z - start.pos[1];
      const along = rx * start.dir[0] + rz * start.dir[1];
      const lateral = Math.abs(-rx * start.dir[1] + rz * start.dir[0]);
      let lap = null;
      const crossed = prevAlong !== null && prevAlong < 0 && along >= 0 && lateral <= width / 2 + 1;
      if (crossed) {
        if (armed && t > 15) lap = t;                              // a real lap, not a wobble on the line
        armed = true; t = 0;                                       // first crossing arms the clock
      }
      prevAlong = along;
      return { lap, time: t };
    },
  };
}
