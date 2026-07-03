import { placeBounds, stadiumHalf } from './career.js';

// city.js — the CITY as one more derived layer (no map is drawn). Input: the career world (its sites'
// REAL footprints) + a seed. A coarse grid covers the world; STREETS are carved by a road-reusing
// Dijkstra between every travel pair's curb STOPS (derived from the entrance pads), plus seeded
// avenues for texture; the remaining parcels become BUILDINGS (façades along the streets, height &
// density scale with the club level: T1 bourg champêtre → T4 métropole), parks and trees fill the
// rest. checkCity() is the no-regression contract: stops on a road, a route exists for every travel
// pair (and stays on roads), streets never cross a site, buildings never sit on a street.
// One source of truth, many presentations (3D elevated view, phone map later). See reference/34.
const mulberry = (seed) => { let t = seed >>> 0; return () => { t += 0x6D2B79F5; let x = Math.imul(t ^ (t >>> 15), 1 | t); x ^= x + Math.imul(x ^ (x >>> 7), 61 | x); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; };

const DENSITY = { 1: 0.3, 2: 0.5, 3: 0.75, 4: 0.92 };            // building probability per façade cell
const RISE = { 1: [3, 4], 2: [4, 7], 3: [6, 14], 4: [8, 22] };   // height base+range by level
const PALETTE = [0xcfc8bb, 0xbcb4a4, 0xd8d2c6, 0xa8926f, 0x9c8a7a, 0x8f9aa6, 0xb0a186, 0xc4b9a5];

export function generateCity({ career, seed = 1 } = {}) {
  const lvl = career.level;
  const rnd = mulberry(seed * 6247 + lvl * 389 + 5);
  // ---- site footprints in world space
  const rects = {};
  for (const k of Object.keys(career.sites)) {
    const s = career.sites[k];
    if (s.kind === 'place') { const b = placeBounds(s.model); rects[k] = [s.at[0] + b[0], s.at[2] + b[1], s.at[0] + b[2], s.at[2] + b[3]]; }
    else { const [hx, hz] = stadiumHalf(s.model); rects[k] = [s.at[0] - hx, s.at[2] - hz, s.at[0] + hx, s.at[2] + hz]; }
  }
  // ---- grid over the world + a city ring beyond the sites
  const M = 30, C = 6;
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const r of Object.values(rects)) { x0 = Math.min(x0, r[0]); z0 = Math.min(z0, r[1]); x1 = Math.max(x1, r[2]); z1 = Math.max(z1, r[3]); }
  x0 -= M; z0 -= M; x1 += M; z1 += M;
  const nx = Math.ceil((x1 - x0) / C), nz = Math.ceil((z1 - z0) / C);
  const id = (i, j) => j * nx + i;
  const cellOf = (x, z) => [Math.min(nx - 1, Math.max(0, Math.floor((x - x0) / C))), Math.min(nz - 1, Math.max(0, Math.floor((z - z0) / C)))];
  const centre = (i, j) => [x0 + (i + 0.5) * C, z0 + (j + 0.5) * C];
  const blocked = new Array(nx * nz).fill(0);
  for (const r of Object.values(rects)) {
    const i0 = Math.max(0, Math.floor((r[0] - 1.5 - x0) / C)), i1 = Math.min(nx - 1, Math.floor((r[2] + 1.5 - x0) / C));
    const j0 = Math.max(0, Math.floor((r[1] - 1.5 - z0) / C)), j1 = Math.min(nz - 1, Math.floor((r[3] + 1.5 - z0) / C));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) blocked[id(i, j)] = 1;
  }
  // ---- curb stops, derived: outside each entrance pad (places) / the stadium's club-side edge
  const stopWant = {};
  for (const k of Object.keys(career.sites)) {
    if (career.sites[k].kind === 'place') { const t = career.travels.find((t) => t.from === k); stopWant[k] = [t.pos[0] - 2.4, t.pos[2]]; }
    else stopWant[k] = [career.sites[k].at[0], rects[k][1] - 4];
  }
  // ---- carve streets: road-reusing Dijkstra between every travel pair (shared avenues emerge)
  const road = new Array(nx * nz).fill(0);
  const dijkstra = (a, b, useRoadOnly = false) => {
    const dist = new Array(nx * nz).fill(Infinity), prev = new Array(nx * nz).fill(-1);
    const A = id(...a), B = id(...b); dist[A] = 0;
    const q = [[0, A]];
    while (q.length) {
      q.sort((u, v) => u[0] - v[0]);
      const [du, u] = q.shift();
      if (u === B) break;
      if (du > dist[u]) continue;
      const ui = u % nx, uj = (u / nx) | 0;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const vi = ui + di, vj = uj + dj; if (vi < 0 || vj < 0 || vi >= nx || vj >= nz) continue;
        const v = id(vi, vj); if (blocked[v]) continue;
        if (useRoadOnly && !road[v]) continue;
        const w = road[v] ? 0.18 : 1;
        if (du + w < dist[v]) { dist[v] = du + w; prev[v] = u; q.push([dist[v], v]); }
      }
    }
    if (dist[B] === Infinity) return null;
    const cells = []; for (let c = B; c !== -1; c = prev[c]) cells.push(c);
    return cells.reverse();
  };
  const stops = {};
  for (const k of Object.keys(stopWant)) {                          // snap to nearest carvable cell
    let [i, j] = cellOf(...stopWant[k]);
    for (let r = 0; blocked[id(i, j)] && r < 6; r++) { if (i > 0 && !blocked[id(i - 1, j)]) i--; else if (j > 0 && !blocked[id(i, j - 1)]) j--; else { i = Math.max(0, i - 1); j = Math.max(0, j - 1); } }
    stops[k] = { cell: [i, j], pos: centre(i, j) };
  }
  for (const t of career.travels) {                                 // main streets = the travel routes
    const cells = dijkstra(stops[t.from].cell, stops[t.to].cell);
    if (cells) for (const c of cells) road[c] = 1;
  }
  // seeded avenues for urban texture (straight lines through free cells, more with the level)
  const extra = 2 + lvl * 2;
  for (let s = 0; s < extra; s++) {
    if (rnd() > 0.5) { const j = 2 + ((rnd() * (nz - 4)) | 0); for (let i = 0; i < nx; i++) if (!blocked[id(i, j)]) road[id(i, j)] = 1; }
    else { const i = 2 + ((rnd() * (nx - 4)) | 0); for (let j = 0; j < nz; j++) if (!blocked[id(i, j)]) road[id(i, j)] = 1; }
  }
  // ---- routes for every travel pair (on the carved network only) → world polylines
  const paths = {};
  for (const t of career.travels) {
    const cells = dijkstra(stops[t.from].cell, stops[t.to].cell, true);
    if (!cells) { paths[`${t.from}->${t.to}`] = null; continue; }
    const pts = cells.map((c) => centre(c % nx, (c / nx) | 0));
    const poly = [pts[0]];                                          // drop collinear points
    for (let i = 1; i < pts.length - 1; i++) {
      const a = poly[poly.length - 1], b = pts[i], c = pts[i + 1];
      if (Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) > 1e-6) poly.push(b);
    }
    poly.push(pts[pts.length - 1]);
    paths[`${t.from}->${t.to}`] = poly;
  }
  // ---- parcels: façade cells (free, next to a street) become buildings; leftovers become greenery
  const nextToRoad = (i, j) => (i > 0 && road[id(i - 1, j)]) || (i < nx - 1 && road[id(i + 1, j)]) || (j > 0 && road[id(i, j - 1)]) || (j < nz - 1 && road[id(i, j + 1)]);
  const buildings = [], trees = [], lights = [];
  const [cx, cz] = stops.club.pos;
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const c = id(i, j);
      if (blocked[c] || road[c]) continue;
      const [wx, wz] = centre(i, j);
      if (nextToRoad(i, j) && rnd() < DENSITY[lvl]) {
        const d = Math.hypot(wx - cx, wz - cz);
        const boost = lvl >= 3 && d < 70 ? 1 + (70 - d) / 70 * (lvl - 2) : 1;      // downtown rises
        const [hb, hr] = RISE[lvl];
        const h = Math.round((hb + rnd() * hr) * boost);
        const w = C - 1.2 - rnd() * 1.2, dpt = C - 1.2 - rnd() * 1.2;
        buildings.push({ x: wx, z: wz, w, d: dpt, h, color: PALETTE[(rnd() * PALETTE.length) | 0] });
      } else if (rnd() < 0.3) {
        trees.push([wx + (rnd() - 0.5) * 2.5, wz + (rnd() - 0.5) * 2.5]);
      }
    }
  }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {       // streetlights along the streets
    if (road[id(i, j)] && (i + j * 3) % 5 === 0) { const [wx, wz] = centre(i, j); lights.push([wx + C * 0.42, wz + C * 0.42]); }
  }
  return { level: lvl, seed, bounds: [x0, z0, x1, z1], cell: C, nx, nz, road, blocked, rects, stops, paths, buildings, trees, lights };
}

/** The city contract — run after generation AND after any manual patch of the city data. */
export function checkCity(city, career) {
  const issues = [];
  const { nx, nz, cell: C, bounds, road, blocked } = city;
  const id = (i, j) => j * nx + i;
  const cellOf = (x, z) => [Math.floor((x - bounds[0]) / C), Math.floor((z - bounds[1]) / C)];
  const onRoad = (x, z) => { const [i, j] = cellOf(x, z); return i >= 0 && j >= 0 && i < nx && j < nz && !!road[id(i, j)]; };
  // stops sit ON a street
  for (const k of Object.keys(city.stops)) if (!onRoad(...city.stops[k].pos)) issues.push(`stop ${k} is off the road`);
  // every travel pair has a route, entirely on streets, ending at the stops
  for (const t of career.travels) {
    const p = city.paths[`${t.from}->${t.to}`];
    if (!p || p.length < 2) { issues.push(`no route ${t.from}→${t.to}`); continue; }
    for (const [x, z] of p) if (!onRoad(x, z)) { issues.push(`route ${t.from}→${t.to} leaves the road`); break; }
    const near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= C * 1.5;
    if (!near(p[0], city.stops[t.from].pos) || !near(p[p.length - 1], city.stops[t.to].pos)) issues.push(`route ${t.from}→${t.to} does not join the stops`);
  }
  // streets never cross a site, buildings never sit on a street or a site
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) if (road[id(i, j)] && blocked[id(i, j)]) { issues.push('a street crosses a site'); j = nz; break; }
  for (const b of city.buildings) {
    const [i, j] = cellOf(b.x, b.z);
    if (road[id(i, j)]) { issues.push('a building sits on a street'); break; }
    if (blocked[id(i, j)]) { issues.push('a building sits on a site'); break; }
  }
  // the street graph connects every stop (BFS from home)
  const seen = new Set(); const start = city.stops.home.cell; const q = [id(...start)]; seen.add(id(...start));
  while (q.length) {
    const u = q.pop(); const ui = u % nx, uj = (u / nx) | 0;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const vi = ui + di, vj = uj + dj; if (vi < 0 || vj < 0 || vi >= nx || vj >= nz) continue;
      const v = id(vi, vj); if (road[v] && !seen.has(v)) { seen.add(v); q.push(v); }
    }
  }
  for (const k of Object.keys(city.stops)) if (!seen.has(id(...city.stops[k].cell))) issues.push(`stop ${k} unreachable by street`);
  if (city.buildings.length < 10) issues.push('city is implausibly empty');
  return { ok: issues.length === 0, issues };
}
