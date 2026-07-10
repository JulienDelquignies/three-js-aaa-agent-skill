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
