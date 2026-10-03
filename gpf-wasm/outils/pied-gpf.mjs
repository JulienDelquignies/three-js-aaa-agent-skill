// pied-gpf.mjs — QUEL PIED EST AU SOL au début des animations du corps (la convention « currentFoot = droit », docs/corps.md § 5.8) ?
//   node outils/pied-gpf.mjs ballcontrol/walk/045.anim ballcontrol/walk/000.anim …   (la hauteur des chevilles aux images 0, ¼, ½, ¾, fin)
// Mesuré le 3 octobre : à l'image 0, le pied GAUCHE est posé (10-11 cm), le DROIT en vol — sur les contrôles et les courses du corps.
import { readFileSync } from 'node:fs';
const V = await import('./vers-gpf.mjs');
const A = new URL('../upstream/data/media/animations/', import.meta.url).pathname;
// parse minimal (comme parseGpfAnim)
const parse = (txt) => { const L = txt.split(/\r?\n/).filter((l) => l.trim()); const T = {}; let player = []; for (const l of L) { const c = l.split(','); if (c[0] === 'player') { for (let i = 1; i + 3 < c.length; i += 4) player.push({ f: +c[i], p: [+c[i + 1], +c[i + 2], +c[i + 3]] }); } else if (V.GPF_NODES.includes(c[0])) { const k = []; for (let i = 1; i + 4 < c.length; i += 5) k.push({ f: +c[i], q: [+c[i + 1], +c[i + 2], +c[i + 3], +c[i + 4]] }); T[c[0]] = k; } } return { T, player }; };
const at = (keys, f, fld) => { if (f <= keys[0].f) return keys[0][fld]; for (let k = 1; k < keys.length; k++) if (f <= keys[k].f) { const a = keys[k - 1], b = keys[k], u = (f - a.f) / (b.f - a.f); return a[fld].map((x, i) => x + (b[fld][i] - x) * u); } return keys.at(-1)[fld]; };
for (const f of process.argv.slice(2)) {
  const { T, player } = parse(readFileSync(A + f, 'utf8'));
  const steps = (readFileSync(A + f, 'utf8').match(/<steps>\s*(\d+)/) ?? [])[1];
  const last = player.at(-1).f; const out = [];
  for (const fr of [0, Math.round(last / 4), Math.round(last / 2), Math.round(3 * last / 4), last]) {
    const S = { p: at(player, fr, 'p'), q: {} }; for (const n of V.GPF_NODES) S.q[n] = at(T[n], fr, 'q');
    const W = V.fkGpf(S); out.push(`${fr}: G ${W.left_ankle.p[2].toFixed(2)} D ${W.right_ankle.p[2].toFixed(2)}`);
  }
  console.log(`${f.padEnd(42)} steps ${steps ?? '-'} · hauteur des chevilles ${out.join(' | ')}`);
}
