// meshkit — Blender's core operations as DERIVED DATA (no three.js, no DOM → node-testable): the
// answer to "why is everything a box?". An AI agent doesn't drag vertices in a viewport; it composes
// OPERATIONS and proves the result with a contract, then judges the look on a screenshot. Ops:
//   lathe(profile)        — surface of revolution (vases, bottles, trophies, lamp feet, wheels)
//   sweep(shape, path)    — extrude a 2D section along a 3D curve (pipes, rails, curved furniture)
//   loft(sections)        — skin ring sections (hulls, fuselages, organic transitions)
//   displace(mesh, fn)    — offset vertices along their normal (rocks, dunes, cloth lumps)
//   mirrorX / transform / merge — assembly
// A mesh is { positions: Float32Array, indices: Uint32Array, normals: Float32Array } in a right-handed
// Y-up space. checkMesh() is the contract: finite values, valid indices, no degenerate triangles,
// and for solids CLOSED topology (every undirected edge shared by exactly 2 triangles) with POSITIVE
// signed volume (outward winding) — the "is this a real object?" proof. meshkit-builder.js wraps the
// arrays into three.js BufferGeometry. See reference/40.
const EPS = 1e-6;

// ---------- construction from quad grids (rows of rings, optionally wrapped) ----------
function grid({ rows, wrapCols, colsClosed = true, poleStart = null, poleEnd = null }) {
  // rows: array of rings, each ring = flat [x,y,z...] of the SAME length; consecutive rows are skinned.
  const nc = rows[0].length / 3;
  const positions = [];
  const rowStart = [];
  if (poleStart) positions.push(...poleStart);
  for (const r of rows) { rowStart.push(positions.length / 3); positions.push(...r); }
  if (poleEnd) positions.push(...poleEnd);
  const indices = [];
  const seg = colsClosed ? nc : nc - 1;
  for (let j = 0; j < rows.length - 1; j++) {
    const a0 = rowStart[j], b0 = rowStart[j + 1];
    for (let i = 0; i < seg; i++) {
      const i1 = (i + 1) % nc;
      const a = a0 + i, a2 = a0 + i1, b = b0 + i, b2 = b0 + i1;
      indices.push(a, a2, b, a2, b2, b);                        // outward winding (CCW rings, +t up)
    }
  }
  if (poleStart) { const a0 = rowStart[0]; for (let i = 0; i < seg; i++) indices.push(0, a0 + (i + 1) % nc, a0 + i); }
  if (poleEnd) {
    const pe = positions.length / 3 - 1, a0 = rowStart[rows.length - 1];
    for (let i = 0; i < seg; i++) indices.push(pe, a0 + i, a0 + (i + 1) % nc);
  }
  return { positions: new Float32Array(positions), indices: new Uint32Array(indices) };
}

/** Surface of revolution around Y. profile = [[radius, y], ...] bottom→top. r≈0 endpoints become
 *  poles (closed); r>0 endpoints get flat caps unless caps:false. */
export function lathe(profile, { segments = 32, caps = true } = {}) {
  const pts = profile.slice();
  const poleB = pts[0][0] < EPS ? [0, pts[0][1], 0] : null;
  const poleT = pts[pts.length - 1][0] < EPS ? [0, pts[pts.length - 1][1], 0] : null;
  const body = pts.filter((p, i) => !((i === 0 && poleB) || (i === pts.length - 1 && poleT)));
  const rows = body.map(([r, y]) => {
    const ring = [];
    for (let s = 0; s < segments; s++) { const a = (s / segments) * Math.PI * 2; ring.push(Math.cos(a) * r, y, -Math.sin(a) * r); }
    return ring;
  });
  let poleStart = poleB, poleEnd = poleT;
  if (!poleB && caps) poleStart = [0, body[0][1], 0];
  if (!poleT && caps) poleEnd = [0, body[body.length - 1][1], 0];
  const m = grid({ rows, colsClosed: true, poleStart, poleEnd });
  return computeNormals(m);
}

// parallel-transport frames along a polyline (stable sweep orientation, no twist)
function frames(path) {
  const t = [], n = [], b = [];
  const sub = (a, c) => [a[0] - c[0], a[1] - c[1], a[2] - c[2]];
  const nrm = (v) => { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const cross = (a, c) => [a[1] * c[2] - a[2] * c[1], a[2] * c[0] - a[0] * c[2], a[0] * c[1] - a[1] * c[0]];
  for (let i = 0; i < path.length; i++) {
    const a = path[Math.max(0, i - 1)], c = path[Math.min(path.length - 1, i + 1)];
    t.push(nrm(sub(c, a)));
  }
  let ref = Math.abs(t[0][1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  n.push(nrm(cross(ref, t[0])));
  b.push(cross(t[0], n[0]));
  for (let i = 1; i < path.length; i++) {
    const axis = cross(t[i - 1], t[i]);
    const s = Math.hypot(...axis), c = Math.max(-1, Math.min(1, t[i - 1][0] * t[i][0] + t[i - 1][1] * t[i][1] + t[i - 1][2] * t[i][2]));
    if (s < EPS) { n.push(n[i - 1]); b.push(b[i - 1]); continue; }
    const [ax, ay, az] = [axis[0] / s, axis[1] / s, axis[2] / s];
    const ang = Math.atan2(s, c), co = Math.cos(ang), si = Math.sin(ang);
    const rot = (v) => {                                        // Rodrigues
      const d = ax * v[0] + ay * v[1] + az * v[2];
      return [
        v[0] * co + (ay * v[2] - az * v[1]) * si + ax * d * (1 - co),
        v[1] * co + (az * v[0] - ax * v[2]) * si + ay * d * (1 - co),
        v[2] * co + (ax * v[1] - ay * v[0]) * si + az * d * (1 - co),
      ];
    };
    n.push(rot(n[i - 1])); b.push(rot(b[i - 1]));
  }
  return { t, n, b };
}

/** Sweep a closed 2D shape ([[x,y],...], CCW) along a 3D path ([[x,y,z],...]). Capped ends. */
export function sweep(shape, path, { caps = true, scaleFn = null } = {}) {
  const { n, b } = frames(path);
  const rows = path.map((p, i) => {
    const s = scaleFn ? scaleFn(i / (path.length - 1)) : 1;
    const ring = [];
    for (const [sx, sy] of shape) {
      ring.push(
        p[0] + (n[i][0] * sx + b[i][0] * sy) * s,
        p[1] + (n[i][1] * sx + b[i][1] * sy) * s,
        p[2] + (n[i][2] * sx + b[i][2] * sy) * s,
      );
    }
    return ring;
  });
  const centre = (i) => [path[i][0], path[i][1], path[i][2]];
  const m = grid({ rows, colsClosed: true, poleStart: caps ? centre(0) : null, poleEnd: caps ? centre(path.length - 1) : null });
  return computeNormals(m);
}

/** Skin ring sections (each [[x,y,z],...], same length). Capped by default. */
export function loft(sections, { caps = true } = {}) {
  const rows = sections.map((s) => s.flat());
  const avg = (s) => { const c = [0, 0, 0]; for (const p of s) { c[0] += p[0]; c[1] += p[1]; c[2] += p[2]; } return c.map((v) => v / s.length); };
  const m = grid({ rows, colsClosed: true, poleStart: caps ? avg(sections[0]) : null, poleEnd: caps ? avg(sections[sections.length - 1]) : null });
  return computeNormals(m);
}

/** UV-sphere as lathe (organic base for displace). */
export function sphere(radius = 1, { segments = 24, rings = 16 } = {}) {
  const prof = [];
  for (let i = 0; i <= rings; i++) { const a = (i / rings) * Math.PI; prof.push([Math.sin(a) * radius, -Math.cos(a) * radius]); }
  return lathe(prof, { segments });
}

/** Offset each vertex along its normal by fn(x, y, z) — seeded noise makes rocks, not Math.random. */
export function displace(mesh, fn) {
  const p = mesh.positions, n = mesh.normals;
  for (let i = 0; i < p.length; i += 3) {
    const d = fn(p[i], p[i + 1], p[i + 2]);
    p[i] += n[i] * d; p[i + 1] += n[i + 1] * d; p[i + 2] += n[i + 2] * d;
  }
  return computeNormals(mesh);
}

export function transform(mesh, { at = [0, 0, 0], rotY = 0, scale = 1 } = {}) {
  const p = mesh.positions, s = Array.isArray(scale) ? scale : [scale, scale, scale];
  const co = Math.cos(rotY), si = Math.sin(rotY);
  for (let i = 0; i < p.length; i += 3) {
    let x = p[i] * s[0], y = p[i + 1] * s[1], z = p[i + 2] * s[2];
    const rx = x * co + z * si, rz = -x * si + z * co;
    p[i] = rx + at[0]; p[i + 1] = y + at[1]; p[i + 2] = rz + at[2];
  }
  return computeNormals(mesh);
}

export function mirrorX(mesh) {
  const p = new Float32Array(mesh.positions), idx = new Uint32Array(mesh.indices);
  for (let i = 0; i < p.length; i += 3) p[i] = -p[i];
  for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }   // fix winding
  return computeNormals({ positions: p, indices: idx });
}

export function merge(meshes) {
  let np = 0, ni = 0;
  for (const m of meshes) { np += m.positions.length; ni += m.indices.length; }
  const positions = new Float32Array(np), indices = new Uint32Array(ni);
  let po = 0, io = 0;
  for (const m of meshes) {
    positions.set(m.positions, po);
    for (let i = 0; i < m.indices.length; i++) indices[io + i] = m.indices[i] + po / 3;
    po += m.positions.length; io += m.indices.length;
  }
  return computeNormals({ positions, indices });
}

/** Seeded 3D value-noise fBm (4 octaves) — THE displacement field for rocks/dunes/wear. */
export function noise(seed = 1) {
  const h = (x, y, z) => {
    let t = (x * 374761393 + y * 668265263 + z * 2147483647 + seed * 144665) | 0;
    t = Math.imul(t ^ (t >>> 13), 1274126177); t ^= t >>> 16;
    return (t >>> 0) / 4294967296;
  };
  const lerp = (a, b, t) => a + (b - a) * (t * t * (3 - 2 * t));
  const val = (x, y, z) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = x - xi, yf = y - yi, zf = z - zi;
    const c = (dx, dy, dz) => h(xi + dx, yi + dy, zi + dz);
    return lerp(
      lerp(lerp(c(0, 0, 0), c(1, 0, 0), xf), lerp(c(0, 1, 0), c(1, 1, 0), xf), yf),
      lerp(lerp(c(0, 0, 1), c(1, 0, 1), xf), lerp(c(0, 1, 1), c(1, 1, 1), xf), yf), zf) * 2 - 1;
  };
  return (x, y, z) => {
    let a = 0, f = 1, amp = 0.5;
    for (let o = 0; o < 4; o++) { a += val(x * f, y * f, z * f) * amp; f *= 2.1; amp *= 0.5; }
    return a;
  };
}

// ear-clipping triangulation of a simple 2D polygon (indices into pts; pts assumed CCW)
function earClip(pts) {
  const n = pts.length, idx = [...Array(n).keys()], tris = [];
  const area2 = (a, b, c) => (pts[b][0] - pts[a][0]) * (pts[c][1] - pts[a][1]) - (pts[b][1] - pts[a][1]) * (pts[c][0] - pts[a][0]);
  const inside = (a, b, c, p) => area2(a, b, p) >= -EPS && area2(b, c, p) >= -EPS && area2(c, a, p) >= -EPS;
  let guard = n * n;
  while (idx.length > 3 && guard-- > 0) {
    let clipped = false;
    for (let i = 0; i < idx.length; i++) {
      const a = idx[(i + idx.length - 1) % idx.length], b = idx[i], c = idx[(i + 1) % idx.length];
      if (area2(a, b, c) <= EPS) continue;                        // reflex or degenerate — not an ear
      let ok = true;
      for (const p of idx) { if (p !== a && p !== b && p !== c && inside(a, b, c, p)) { ok = false; break; } }
      if (!ok) continue;
      tris.push(a, b, c); idx.splice(i, 1); clipped = true; break;
    }
    if (!clipped) break;                                          // fallback: fan the rest
  }
  if (idx.length === 3) tris.push(idx[0], idx[1], idx[2]);
  else for (let i = 1; i < idx.length - 1; i++) tris.push(idx[0], idx[i], idx[i + 1]);
  return tris;
}

/** Rounded-rectangle outline (CCW) — the workhorse footprint for extrudePoly (soft-edged slabs). */
export function roundedRect(w, d, r, { cornerSegments = 4 } = {}) {
  const hw = w / 2 - r, hd = d / 2 - r, pts = [];
  const corners = [[hw, hd, 0], [-hw, hd, Math.PI / 2], [-hw, -hd, Math.PI], [hw, -hd, Math.PI * 1.5]];
  for (const [cx, cy, a0] of corners) {
    for (let i = 0; i <= cornerSegments; i++) {
      const a = a0 + (i / cornerSegments) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  }
  return pts;
}

/** Extrude a simple 2D polygon ([[x,z]], any orientation) UP by `depth`, optional edge bevel.
 *  Caps are ear-clipped (concave outlines welcome: L-shapes, brackets, logos). Closed manifold. */
export function extrudePoly(outline, { depth = 1, bevel = 0, y0 = 0 } = {}) {
  let pts = outline.slice();
  let sa = 0;                                                     // normalize to CCW (positive area)
  for (let i = 0; i < pts.length; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length]; sa += x1 * y2 - x2 * y1; }
  if (sa < 0) pts.reverse();
  const nrm = pts.map((p, i) => {                                 // outward 2D vertex normals (miter)
    const a = pts[(i + pts.length - 1) % pts.length], b = pts[(i + 1) % pts.length];
    const e1 = [p[0] - a[0], p[1] - a[1]], e2 = [b[0] - p[0], b[1] - p[1]];
    const n1 = [e1[1], -e1[0]], n2 = [e2[1], -e2[0]];
    const l1 = Math.hypot(...n1) || 1, l2 = Math.hypot(...n2) || 1;
    let nx = n1[0] / l1 + n2[0] / l2, ny = n1[1] / l1 + n2[1] / l2;
    const l = Math.hypot(nx, ny) || 1;
    return [nx / l, ny / l];
  });
  const ring = (inset, y) => pts.flatMap((p, i) => [p[0] - nrm[i][0] * inset, y, p[1] - nrm[i][1] * inset]);
  const rows = [];
  if (bevel > 0) rows.push(ring(bevel, y0), ring(0, y0 + bevel), ring(0, y0 + depth - bevel), ring(bevel, y0 + depth));
  else rows.push(ring(0, y0), ring(0, y0 + depth));
  const m = grid({ rows, colsClosed: true });
  const nP = pts.length, positions = [...m.positions], indices = [...m.indices];
  const capTris = earClip(pts);
  const bot = 0, top = (rows.length - 1) * nP;                    // cap vertices REUSE the boundary rings
  for (let i = 0; i < capTris.length; i += 3) {
    indices.push(bot + capTris[i], bot + capTris[i + 2], bot + capTris[i + 1]);   // bottom faces −y
    indices.push(top + capTris[i], top + capTris[i + 1], top + capTris[i + 2]);   // top faces +y
  }
  // orientation: the outline's 2D handedness vs the grid's ring convention can leave the solid
  // inside-out — the SIGNED VOLUME is the truth, not the convention: flip windings if negative
  const out = { positions: new Float32Array(positions), indices: new Uint32Array(indices) };
  let vol = 0; const P = out.positions, I = out.indices;
  for (let i = 0; i < I.length; i += 3) {
    const a = I[i] * 3, b = I[i + 1] * 3, c = I[i + 2] * 3;
    vol += P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1]) + P[a + 1] * (P[b + 2] * P[c] - P[b] * P[c + 2]) + P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c]);
  }
  if (vol < 0) for (let i = 0; i < I.length; i += 3) { const t = I[i + 1]; I[i + 1] = I[i + 2]; I[i + 2] = t; }
  return computeNormals(out);
}

/** One pass of LOOP SUBDIVISION (closed manifold required — the contract guarantees it): model a
 *  rough cage, smooth() it n times → organic. ×4 triangles per pass. */
export function smooth(mesh, passes = 1) {
  let p = mesh.positions, idx = mesh.indices;
  for (let pass = 0; pass < passes; pass++) {
    const nv = p.length / 3;
    const edge = new Map(), neigh = Array.from({ length: nv }, () => new Set());
    const ekey = (a, b) => (a < b ? a * nv + b : b * nv + a);
    for (let i = 0; i < idx.length; i += 3) {
      for (const [a, b, o] of [[idx[i], idx[i + 1], idx[i + 2]], [idx[i + 1], idx[i + 2], idx[i]], [idx[i + 2], idx[i], idx[i + 1]]]) {
        const k = ekey(a, b);
        if (!edge.has(k)) edge.set(k, { a, b, opp: [o] }); else edge.get(k).opp.push(o);
        neigh[a].add(b); neigh[b].add(a);
      }
    }
    const np = [];                                                // repositioned originals
    for (let v = 0; v < nv; v++) {
      const nb = [...neigh[v]], n = nb.length;
      const beta = n > 3 ? 3 / (8 * n) : 3 / 16;
      let x = p[v * 3] * (1 - n * beta), y = p[v * 3 + 1] * (1 - n * beta), z = p[v * 3 + 2] * (1 - n * beta);
      for (const u of nb) { x += p[u * 3] * beta; y += p[u * 3 + 1] * beta; z += p[u * 3 + 2] * beta; }
      np.push(x, y, z);
    }
    for (const e of edge.values()) {                              // new edge points (3/8 ends + 1/8 wings)
      e.mid = np.length / 3;
      const [a, b] = [e.a * 3, e.b * 3], o0 = (e.opp[0] ?? e.a) * 3, o1 = (e.opp[1] ?? e.b) * 3;
      np.push(
        0.375 * (p[a] + p[b]) + 0.125 * (p[o0] + p[o1]),
        0.375 * (p[a + 1] + p[b + 1]) + 0.125 * (p[o0 + 1] + p[o1 + 1]),
        0.375 * (p[a + 2] + p[b + 2]) + 0.125 * (p[o0 + 2] + p[o1 + 2]));
    }
    const ni = [];
    for (let i = 0; i < idx.length; i += 3) {
      const a = idx[i], b = idx[i + 1], c = idx[i + 2];
      const ab = edge.get(ekey(a, b)).mid, bc = edge.get(ekey(b, c)).mid, ca = edge.get(ekey(c, a)).mid;
      ni.push(a, ab, ca, b, bc, ab, c, ca, bc, ab, bc, ca);
    }
    p = new Float32Array(np); idx = new Uint32Array(ni);
  }
  return computeNormals({ positions: p, indices: idx });
}

/** Run a declarative model SPEC → parts [{mesh, name, color, ...}] (the .blend file, as JSON).
 *  spec = { parts: [{ name?, color?, roughness?, metalness?, ops: [{op, ...args}] }] }
 *  ops: lathe{profile,segments}, sweep{shape,path}, loft{sections}, sphere{radius}, extrudePoly
 *  {outline,depth,bevel}, roundedRect passes an outline to the NEXT op, displaceNoise{seed,amp,freq},
 *  smooth{passes}, transform{at,rotY,scale}, mirrorX, merge (merges all previous results). */
export function runSpec(spec) {
  const parts = [];
  for (const part of spec.parts) {
    let acc = [], outline = null;
    for (const step of part.ops) {
      const { op } = step;
      if (op === 'lathe') acc.push(lathe(step.profile, step));
      else if (op === 'sweep') acc.push(sweep(step.shape, step.path, step));
      else if (op === 'loft') acc.push(loft(step.sections, step));
      else if (op === 'sphere') acc.push(sphere(step.radius ?? 1, step));
      else if (op === 'roundedRect') outline = roundedRect(step.w, step.d, step.r, step);
      else if (op === 'extrudePoly') acc.push(extrudePoly(step.outline || outline, step));
      else if (op === 'displaceNoise') { const f = noise(step.seed ?? 1), a = step.amp ?? 0.1, q = step.freq ?? 2; acc.push(displace(acc.pop(), (x, y, z) => f(x * q, y * q, z * q) * a)); }
      else if (op === 'smooth') acc.push(smooth(acc.pop(), step.passes ?? 1));
      else if (op === 'transform') acc.push(transform(acc.pop(), step));
      else if (op === 'mirrorX') acc.push(mirrorX(acc[acc.length - 1]));
      else if (op === 'merge') acc = [merge(acc)];
      else throw new Error(`op inconnue: ${op}`);
    }
    parts.push({ ...part, mesh: acc.length > 1 ? merge(acc) : acc[0] });
  }
  return parts;
}

/** Smooth area-weighted vertex normals (the organic look — flat facets are the box aesthetic). */
export function computeNormals(mesh) {
  const p = mesh.positions, idx = mesh.indices;
  const n = new Float32Array(p.length);
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
    const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;   // area-weighted
    for (const o of [a, b, c]) { n[o] += nx; n[o + 1] += ny; n[o + 2] += nz; }
  }
  for (let i = 0; i < n.length; i += 3) {
    const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1;
    n[i] /= l; n[i + 1] /= l; n[i + 2] /= l;
  }
  mesh.normals = n;
  return mesh;
}

/** The mesh contract — a generated model must be a REAL object, not a soup of triangles. */
export function checkMesh(mesh, { maxTris = 20000, closed = true, minVolume = 0 } = {}) {
  const issues = [];
  const p = mesh.positions, idx = mesh.indices;
  for (let i = 0; i < p.length; i++) if (!Number.isFinite(p[i])) { issues.push('non-finite vertex coordinate'); break; }
  const nv = p.length / 3;
  for (let i = 0; i < idx.length; i++) if (idx[i] >= nv) { issues.push('index out of range'); break; }
  if (idx.length / 3 > maxTris) issues.push(`triangle budget exceeded (${idx.length / 3} > ${maxTris})`);
  let degenerate = 0, volume = 0;
  const edges = new Map();
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
    const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    const area2 = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
    if (area2 < 1e-10) degenerate++;
    volume += (p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) + p[a + 1] * (p[b + 2] * p[c] - p[b] * p[c + 2]) + p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c])) / 6;
    if (closed) {
      for (const [u, v] of [[idx[i], idx[i + 1]], [idx[i + 1], idx[i + 2]], [idx[i + 2], idx[i]]]) {
        const k = u < v ? u * nv + v : v * nv + u;
        edges.set(k, (edges.get(k) || 0) + 1);
      }
    }
  }
  if (degenerate) issues.push(`${degenerate} degenerate triangle(s)`);
  if (closed) {
    let open = 0, over = 0;
    for (const c of edges.values()) { if (c === 1) open++; else if (c > 2) over++; }
    if (open) issues.push(`open seam (${open} boundary edge(s))`);
    if (over) issues.push(`non-manifold (${over} over-shared edge(s))`);
    if (volume <= minVolume) issues.push('non-positive volume (inside-out winding?)');
  }
  return { ok: issues.length === 0, issues, tris: idx.length / 3, volume };
}
