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
  const capacity = stands.reduce((s, st) => s + (st.rows + st.deck2) * Math.floor(st.len / SEAT_STEP), 0);
  const eye = 1.6;
  return {
    spec: { tier, seed }, pitch: PITCH, apron: APRON, rowD: ROW_D, rowH: ROW_H, seatStep: SEAT_STEP,
    stands, loge, capacity,
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
  return { ok: issues.length === 0, issues };
}
