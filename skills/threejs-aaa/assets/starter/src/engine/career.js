import { generatePlace, checkModel } from './floorplan.js';
import { generateStadium, checkStadium } from './stadium.js';

// career.js — the career WORLD derived from a single number: the club level (1..4). Nothing is placed
// by hand: the tiers come from the level (club T1→T4, logement chambre d'hôtel→villa, stade champêtre→
// moderne), the site offsets come from the models' REAL footprints + a margin, and the TRAVEL pads
// (fast-travel between sites) are derived from each site's entrance — outside the front door for the
// buildings, inside the loge for the stadium. checkCareer() is the no-regression contract: patch
// anything (tiers, seeds, offsets, pads), re-check, ship. Dependency-free (pure data) → node-testable
// (scripts/verify-career.mjs). Rendering/colliders stay in place-builder / stadium-builder.
const HOME_TIER = { 1: 1, 2: 2, 3: 3, 4: 5 };
const HOME_LABEL = { 1: "Chambre d'hôtel", 2: 'Appartement', 3: 'Maison', 5: 'Villa' };
const GAP = 22;                                          // walkable ground kept between site footprints

/** Local-space footprint [x0,z0,x1,z1] of a floorplan model, outdoor areas included. */
export function placeBounds(m) {
  let b = [0, 0, m.W, m.D];
  const grow = (r) => { b = [Math.min(b[0], r[0]), Math.min(b[1], r[1]), Math.max(b[2], r[2]), Math.max(b[3], r[3])]; };
  for (const r of m.outdoor?.pitches || []) grow(r);
  if (m.outdoor?.terrace) grow(m.outdoor.terrace);
  return b;
}

/** Centred half-extents [hx,hz] of a stadium, stands + pylons/scoreboard included. */
export function stadiumHalf(m) {
  const rows = (s) => s.rows + (s.deck2 ? 2 + s.deck2 : 0);
  let hx = m.pitch.L / 2 + m.apron + 6, hz = m.pitch.W / 2 + m.apron + 6;
  for (const s of m.stands) {
    const d = rows(s) * m.rowD + 6;
    if (s.along === 'x') hz = Math.max(hz, m.pitch.W / 2 + m.apron + d);
    else hx = Math.max(hx, m.pitch.L / 2 + m.apron + d);
  }
  if (m.scoreboard) hx = Math.max(hx, Math.abs(m.scoreboard.x) + 3);
  if (m.lights?.type === 'pylon') { hx = Math.max(hx, m.pitch.L / 2 + 12); hz = Math.max(hz, m.pitch.W / 2 + 12); }
  return [hx, hz];
}

// ground-floor hub entrance in local space (the floorplan derives the door on the hub's west wall)
const entranceOf = (m) => {
  const f = m.floors[0]; const hub = f.rooms.find((r) => r.id === f.hubId);
  return [hub.rect[0], (hub.rect[1] + hub.rect[3]) / 2];
};

/** Generate the whole career world for a level. Deterministic for a given (level, seed). */
export function generateCareer({ level = 1, seed = 1 } = {}) {
  const lvl = Math.max(1, Math.min(4, level | 0));
  const homeM = generatePlace({ type: 'home', tier: HOME_TIER[lvl], seed });
  const clubM = generatePlace({ type: 'club', tier: lvl, seed: seed + 1 });
  const restoM = generatePlace({ type: 'restaurant', tier: Math.min(5, lvl + 1), seed: seed + 2 });
  const dealM = generatePlace({ type: 'concession', tier: Math.min(5, lvl + 1), seed: seed + 3 });
  const stadM = generateStadium({ tier: lvl, seed });
  // offsets derived from the footprints: club centred at the origin, home west, restaurant east,
  // stadium south — always GAP metres of walkable ground between the real footprints
  const cb = placeBounds(clubM), hb = placeBounds(homeM), rb = placeBounds(restoM), db = placeBounds(dealM);
  const clubAt = [-clubM.W / 2, 0, -clubM.D / 2];
  const homeAt = [clubAt[0] + cb[0] - GAP - hb[2], 0, -homeM.D / 2];
  const restoAt = [clubAt[0] + cb[2] + GAP - rb[0], 0, -restoM.D / 2];
  const dealAt = [restoAt[0] + rb[2] + GAP - db[0], 0, -dealM.D / 2];   // east of the restaurant
  const [, shz] = stadiumHalf(stadM);
  const stadAt = [0, 0, clubAt[2] + cb[3] + GAP + shz];
  const lg = stadM.loge, logeZc = (lg.rect[1] + lg.rect[3]) / 2;
  const sites = {
    home: { kind: 'place', model: homeM, at: homeAt, label: HOME_LABEL[HOME_TIER[lvl]],
      spawn: [homeAt[0] + homeM.spawn.pos[0], 0, homeAt[2] + homeM.spawn.pos[2]] },
    club: { kind: 'place', model: clubM, at: clubAt, label: "Centre d'entraînement",
      spawn: [clubAt[0] + clubM.spawn.pos[0], 0, clubAt[2] + clubM.spawn.pos[2]] },
    resto: { kind: 'place', model: restoM, at: restoAt, label: 'Restaurant « Le Rond Central »',
      spawn: [restoAt[0] + restoM.spawn.pos[0], 0, restoAt[2] + restoM.spawn.pos[2]] },
    dealer: { kind: 'place', model: dealM, at: dealAt, label: 'Concessionnaire Prestige Auto',
      spawn: [dealAt[0] + dealM.spawn.pos[0], 0, dealAt[2] + dealM.spawn.pos[2]] },
    stadium: { kind: 'stadium', model: stadM, at: stadAt, label: 'Stade — loge du directeur sportif',
      spawn: [stadAt[0] + 0.8, lg.floorY, stadAt[2] + logeZc] },
  };
  // travel pads: just outside the entrance door (buildings) / the middle of the loge (stadium)
  const he = entranceOf(homeM), ce = entranceOf(clubM), re = entranceOf(restoM), de = entranceOf(dealM);
  const travels = [
    { from: 'home', to: 'club', pos: [homeAt[0] + he[0] - 1.4, 0, homeAt[2] + he[1] - 0.8] },
    { from: 'home', to: 'resto', pos: [homeAt[0] + he[0] - 1.4, 0, homeAt[2] + he[1] + 0.8] },
    { from: 'club', to: 'home', pos: [clubAt[0] + ce[0] - 1.4, 0, clubAt[2] + ce[1] - 0.8] },
    { from: 'club', to: 'stadium', pos: [clubAt[0] + ce[0] - 1.4, 0, clubAt[2] + ce[1] + 0.8] },
    { from: 'club', to: 'resto', pos: [clubAt[0] + ce[0] - 2.6, 0, clubAt[2] + ce[1]] },
    { from: 'resto', to: 'club', pos: [restoAt[0] + re[0] - 1.4, 0, restoAt[2] + re[1] - 0.8] },
    { from: 'resto', to: 'home', pos: [restoAt[0] + re[0] - 1.4, 0, restoAt[2] + re[1] + 0.8] },
    { from: 'resto', to: 'dealer', pos: [restoAt[0] + re[0] - 2.6, 0, restoAt[2] + re[1]] },
    { from: 'dealer', to: 'resto', pos: [dealAt[0] + de[0] - 1.4, 0, dealAt[2] + de[1] - 0.8] },
    { from: 'dealer', to: 'home', pos: [dealAt[0] + de[0] - 1.4, 0, dealAt[2] + de[1] + 0.8] },
    { from: 'stadium', to: 'club', pos: [stadAt[0], lg.floorY, stadAt[2] + logeZc] },
  ];
  for (const t of travels) t.label = `Aller : ${sites[t.to].label}`;
  return { level: lvl, seed, sites, travels };
}

/** The no-regression contract for the whole world — run after generation AND after any manual patch. */
export function checkCareer(c) {
  const issues = [];
  const placeKeys = Object.keys(c.sites).filter((k) => c.sites[k].kind === 'place');
  // every site passes its own contract
  for (const k of placeKeys) { const r = checkModel(c.sites[k].model); if (!r.ok) issues.push(`${k}: ${r.issues[0]}`); }
  { const r = checkStadium(c.sites.stadium.model); if (!r.ok) issues.push(`stadium: ${r.issues[0]}`); }
  // world-space footprints must keep clear ground between them
  const rects = {};
  for (const k of placeKeys) { const b = placeBounds(c.sites[k].model), a = c.sites[k].at; rects[k] = [a[0] + b[0], a[2] + b[1], a[0] + b[2], a[2] + b[3]]; }
  { const [hx, hz] = stadiumHalf(c.sites.stadium.model), a = c.sites.stadium.at; rects.stadium = [a[0] - hx, a[2] - hz, a[0] + hx, a[2] + hz]; }
  const keys = Object.keys(rects), M = 4;
  for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
    const A = rects[keys[i]], B = rects[keys[j]];
    if (Math.min(A[2], B[2]) - Math.max(A[0], B[0]) > -M && Math.min(A[3], B[3]) - Math.max(A[1], B[1]) > -M)
      issues.push(`${keys[i]} and ${keys[j]} sites overlap (or are closer than ${M} m)`);
  }
  // travel graph: every site reachable from home (both directions exist by construction of the pads)
  const seen = new Set(['home']); let grew = true;
  while (grew) { grew = false; for (const t of c.travels) if (seen.has(t.from) && !seen.has(t.to)) { seen.add(t.to); grew = true; } }
  for (const k of keys) if (!seen.has(k)) issues.push(`site ${k} unreachable by travel`);
  // pads land where the player can stand: outside the building near its entrance / inside the loge
  for (const t of c.travels) {
    const s = c.sites[t.from]; if (!s) { issues.push(`travel from unknown site ${t.from}`); continue; }
    if (s.kind === 'place') {
      const inX = t.pos[0] > s.at[0] - 0.01 && t.pos[0] < s.at[0] + s.model.W + 0.01;
      const inZ = t.pos[2] > s.at[2] - 0.01 && t.pos[2] < s.at[2] + s.model.D + 0.01;
      if (inX && inZ) issues.push(`travel ${t.from}→${t.to}: pad inside the building`);
      if (t.pos[1] !== 0) issues.push(`travel ${t.from}→${t.to}: pad not on the ground`);
      const e = entranceOf(s.model);
      if (Math.hypot(t.pos[0] - (s.at[0] + e[0]), t.pos[2] - (s.at[2] + e[1])) > 4) issues.push(`travel ${t.from}→${t.to}: pad far from the entrance`);
    } else {
      const lg = s.model.loge, lx = t.pos[0] - s.at[0], lz = t.pos[2] - s.at[2];
      if (lx < lg.rect[0] || lx > lg.rect[2] || lz < lg.rect[1] || lz > lg.rect[3]) issues.push(`travel ${t.from}→${t.to}: pad outside the loge`);
      if (Math.abs(t.pos[1] - lg.floorY) > 0.01) issues.push(`travel ${t.from}→${t.to}: pad not on the loge floor`);
      for (const it of lg.items || []) if (Math.hypot(it.x - lx, it.z - lz) < 0.6) issues.push(`travel ${t.from}→${t.to}: pad collides with the loge ${it.kind}`);
    }
  }
  // spawns on-site (the stadium spawn must be in the loge, on its floor)
  for (const k of placeKeys) {
    const s = c.sites[k], [x, , z] = s.spawn;
    if (x < s.at[0] || x > s.at[0] + s.model.W || z < s.at[2] || z > s.at[2] + s.model.D) issues.push(`${k} spawn outside the building`);
  }
  { const s = c.sites.stadium, lg = s.model.loge, lx = s.spawn[0] - s.at[0], lz = s.spawn[2] - s.at[2];
    if (lx < lg.rect[0] || lx > lg.rect[2] || lz < lg.rect[1] || lz > lg.rect[3] || Math.abs(s.spawn[1] - lg.floorY) > 0.01) issues.push('stadium spawn not in the loge'); }
  return { ok: issues.length === 0, issues };
}
