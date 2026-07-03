// Club theme — the club's identity as DATA, applied everywhere (walls, floors, stadium seats, logo
// panels, framed jerseys) so two clubs never look alike: { name, initials, primary, secondary, accent }.
// Deterministic from a seed, or fully explicit. Dependency-free; canvas assets (logo/jersey textures)
// are built by consumers (stadium-builder / furniture-kit) from these colors.
const PALETTES = [
  { primary: 0x1f3a93, secondary: 0xffffff, accent: 0xd4af37 },   // bleu roi / blanc / or
  { primary: 0x8e2430, secondary: 0xf2f2f2, accent: 0x1a1a1a },   // grenat / blanc
  { primary: 0x0b6e4f, secondary: 0xffffff, accent: 0x111111 },   // vert / blanc (champêtre)
  { primary: 0x111111, secondary: 0xf8d210, accent: 0xffffff },   // noir / jaune
  { primary: 0x9a1b2f, secondary: 0x14213d, accent: 0xffffff },   // rouge / marine
  { primary: 0x0077b6, secondary: 0xff6b35, accent: 0xffffff },   // azur / orange
  { primary: 0x4a0e4e, secondary: 0xffffff, accent: 0x00a878 },   // violet / blanc
  { primary: 0xc9082a, secondary: 0xffffff, accent: 0x17408b },   // rouge / blanc / bleu
];
const NAMES = ['FC Campagne', 'Racing Métropole', 'US Vallée', 'Sporting Rivière', 'Olympique du Port', 'AS Colline', 'Étoile du Nord', 'Union Atlantique'];
const SPONSORS = ['NORDBANK', 'AZUR TÉLÉCOM', 'VOLTA ÉNERGIE', 'MAISON LUNEL', 'TRANSALTA', 'BOULANGERIE MARTIN', 'GARAGE DU PONT', 'HÔTEL RIVIERA', 'CAFÉ CENTRAL', 'ASSURANCES PICARD'];
const mulberry = (seed) => { let t = seed >>> 0; return () => { t += 0x6D2B79F5; let x = Math.imul(t ^ (t >>> 15), 1 | t); x ^= x + Math.imul(x ^ (x >>> 7), 61 | x); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; };

export function makeTheme({ seed = 1, name = null, primary = null, secondary = null, accent = null, sponsors = null } = {}) {
  const rnd = mulberry(seed * 2657 + 43);
  const pal = PALETTES[(rnd() * PALETTES.length) | 0];
  const nm = name || NAMES[(rnd() * NAMES.length) | 0];
  const initials = nm.split(/\s+/).map((w) => w[0]).join('').slice(0, 3).toUpperCase();
  const sp = sponsors || Array.from({ length: 4 }, () => SPONSORS[(rnd() * SPONSORS.length) | 0]).filter((v, i, a) => a.indexOf(v) === i);
  return { name: nm, initials, primary: primary ?? pal.primary, secondary: secondary ?? pal.secondary, accent: accent ?? pal.accent, sponsors: sp };
}

export const hexCss = (hex) => `#${hex.toString(16).padStart(6, '0')}`;

/** Procedural crest: a canvas with the club colors + initials. Consumers wrap it in a CanvasTexture. */
export function drawCrest(theme, size = 256) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
  g.fillStyle = hexCss(theme.primary); g.beginPath(); g.arc(size / 2, size / 2, size * 0.46, 0, 7); g.fill();
  g.strokeStyle = hexCss(theme.secondary); g.lineWidth = size * 0.05; g.stroke();
  g.strokeStyle = hexCss(theme.accent); g.lineWidth = size * 0.02; g.beginPath(); g.arc(size / 2, size / 2, size * 0.36, 0, 7); g.stroke();
  g.fillStyle = hexCss(theme.secondary); g.font = `800 ${size * 0.3}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(theme.initials, size / 2, size / 2 + size * 0.02);
  return c;
}

/** Procedural framed jersey: club body, secondary sleeves, accent number. */
export function drawJersey(theme, size = 256) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
  g.fillStyle = '#f4f1e8'; g.fillRect(0, 0, size, size);
  const p = hexCss(theme.primary), s = hexCss(theme.secondary);
  g.fillStyle = s; g.beginPath();                                   // sleeves
  g.moveTo(size * 0.14, size * 0.30); g.lineTo(size * 0.30, size * 0.18); g.lineTo(size * 0.36, size * 0.34); g.lineTo(size * 0.22, size * 0.46); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(size * 0.86, size * 0.30); g.lineTo(size * 0.70, size * 0.18); g.lineTo(size * 0.64, size * 0.34); g.lineTo(size * 0.78, size * 0.46); g.closePath(); g.fill();
  g.fillStyle = p; g.beginPath();                                   // torso
  g.moveTo(size * 0.30, size * 0.18); g.lineTo(size * 0.42, size * 0.14); g.lineTo(size * 0.5, size * 0.2); g.lineTo(size * 0.58, size * 0.14); g.lineTo(size * 0.70, size * 0.18);
  g.lineTo(size * 0.66, size * 0.85) ; g.lineTo(size * 0.34, size * 0.85); g.closePath(); g.fill();
  g.fillStyle = hexCss(theme.accent); g.font = `800 ${size * 0.22}px system-ui, sans-serif`; g.textAlign = 'center';
  g.fillText('10', size * 0.5, size * 0.62);
  return c;
}

/** Press-conference backdrop: the real-world sponsor wall — a light panel with a staggered grid
 *  alternating the club crest and the sponsor names (what you see behind the coach on TV). */
export function drawPressWall(theme, width = 1024, height = 512) {
  const c = document.createElement('canvas'); c.width = width; c.height = height; const g = c.getContext('2d');
  g.fillStyle = '#f4f5f7'; g.fillRect(0, 0, width, height);
  const names = theme.sponsors?.length ? theme.sponsors : ['SPONSOR'];
  const cols = 5, rows = 4, cw = width / cols, ch = height / rows;
  let k = 0;
  for (let r = 0; r < rows; r++) for (let i = 0; i < cols; i++) {
    const x = (i + 0.5) * cw + (r % 2 ? cw * 0.5 : 0), y = (r + 0.5) * ch;   // staggered like the real walls
    if (x > width) continue;
    if ((r + i) % 2 === 0) {                                                 // crest roundel
      g.fillStyle = hexCss(theme.primary); g.beginPath(); g.arc(x, y, ch * 0.3, 0, 7); g.fill();
      g.strokeStyle = hexCss(theme.secondary); g.lineWidth = 3; g.stroke();
      g.fillStyle = hexCss(theme.secondary); g.font = `800 ${ch * 0.26}px system-ui, sans-serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(theme.initials, x, y + 1);
    } else {                                                                 // sponsor wordmark
      g.fillStyle = '#3a4048'; g.font = `800 ${ch * 0.2}px system-ui, sans-serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(names[k++ % names.length], x, y, cw * 0.92);
    }
  }
  return c;
}

/** Sponsor boards strip: alternating blocks with each sponsor name (LED-board look). */
export function drawSponsorStrip(theme, width = 2048, height = 96) {
  const c = document.createElement('canvas'); c.width = width; c.height = height; const g = c.getContext('2d');
  const names = theme.sponsors?.length ? theme.sponsors : ['SPONSOR'];
  const bw = width / Math.max(4, names.length * 2);
  for (let i = 0; i * bw < width; i++) {
    const dark = i % 2 === 0;
    g.fillStyle = dark ? hexCss(theme.primary) : '#f2f3f5'; g.fillRect(i * bw, 0, bw, height);
    g.fillStyle = dark ? '#ffffff' : hexCss(theme.primary);
    g.font = `800 ${height * 0.42}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(names[i % names.length], i * bw + bw / 2, height / 2, bw * 0.9);
  }
  return c;
}
