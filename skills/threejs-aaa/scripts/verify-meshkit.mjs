#!/usr/bin/env node
// verify-meshkit.mjs — the modeling kit (engine/meshkit.js): every operation must produce a REAL
// object under checkMesh (finite, valid indices, no degenerate triangles, CLOSED manifold topology,
// positive volume = outward winding). A library of representative models proves the ops compose:
// lathe (vase/bottle/trophy cup), sweep (S-pipe, curved rail), loft, displaced sphere (rock),
// mirrored+merged assembly. Plus determinism and named sabotages.
import { lathe, sweep, loft, sphere, displace, transform, mirrorX, merge, checkMesh } from '../assets/starter/src/engine/meshkit.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };
const mulberry = (seed) => { let t = seed >>> 0; return () => { t += 0x6D2B79F5; let x = Math.imul(t ^ (t >>> 15), 1 | t); x ^= x + Math.imul(x ^ (x >>> 7), 61 | x); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; };

// ---- the demo library (each = one op or one composition)
const vase = () => lathe([[0, 0], [0.16, 0], [0.2, 0.04], [0.14, 0.28], [0.26, 0.62], [0.18, 0.86], [0.2, 0.96], [0.19, 1.0], [0, 1.0]], { segments: 40 });
const bottle = () => lathe([[0, 0], [0.11, 0], [0.13, 0.05], [0.13, 0.5], [0.05, 0.68], [0.045, 0.9], [0.055, 0.93], [0.05, 0.97], [0, 0.97]], { segments: 32 });
const cup = () => lathe([[0, 0.0], [0.3, 0.0], [0.34, 0.06], [0.26, 0.5], [0.3, 0.72], [0, 0.72]], { segments: 36 });
const sPipe = () => {
  const path = []; for (let i = 0; i <= 40; i++) { const t = i / 40; path.push([Math.sin(t * Math.PI * 2) * 0.4, t * 1.6, Math.cos(t * Math.PI) * 0.3]); }
  const circle = []; for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; circle.push([Math.cos(a) * 0.07, Math.sin(a) * 0.07]); }
  return sweep(circle, path);
};
const hull = () => {
  const secs = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8, w = 0.3 + Math.sin(t * Math.PI) * 0.5, h = 0.25 + Math.sin(t * Math.PI) * 0.2;
    const ring = []; for (let s = 0; s < 18; s++) { const a = (s / 18) * Math.PI * 2; ring.push([Math.cos(a) * w, Math.sin(a) * h + 0.4, t * 3 - 1.5]); }
    secs.push(ring);
  }
  return loft(secs);
};
const rock = (seed = 7) => {
  const rnd = mulberry(seed); const f = [rnd() * 4 + 2, rnd() * 4 + 2, rnd() * 4 + 2], ph = [rnd() * 7, rnd() * 7, rnd() * 7];
  return displace(sphere(0.5, { segments: 28, rings: 18 }), (x, y, z) =>
    0.09 * Math.sin(x * f[0] + ph[0]) * Math.sin(y * f[1] + ph[1]) + 0.06 * Math.sin(z * f[2] + ph[2]));
};
const trophy = () => {
  const handlePath = []; for (let i = 0; i <= 16; i++) { const a = (i / 16) * Math.PI; handlePath.push([0.3 + Math.sin(a) * 0.16, 0.62 - Math.cos(a) * 0.22, 0]); }
  const circ = []; for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; circ.push([Math.cos(a) * 0.03, Math.sin(a) * 0.03]); }
  const handle = sweep(circ, handlePath);
  const base = lathe([[0, 0], [0.22, 0], [0.22, 0.08], [0.08, 0.12], [0.06, 0.34], [0, 0.34]], { segments: 24 });
  return merge([transform(cup(), { at: [0, 0.3, 0] }), base, handle, mirrorX(handle)]);
};

const LIB = { vase, bottle, coupe: cup, 'tuyau-S': sPipe, coque: hull, rocher: rock, trophée: trophy };
for (const [name, make] of Object.entries(LIB)) {
  const m = make();
  const r = checkMesh(m, { maxTris: 20000 });
  ok(`${name} : objet réel (fermé, volume +, ${r.tris} tris)`, r.ok, r.issues[0] || `V=${r.volume.toFixed(3)}`);
}
ok('déterminisme (rocher : même seed → mêmes sommets)', JSON.stringify([...rock(7).positions.slice(0, 30)]) === JSON.stringify([...rock(7).positions.slice(0, 30)]));
ok('le seed change le rocher', JSON.stringify([...rock(7).positions.slice(0, 30)]) !== JSON.stringify([...rock(8).positions.slice(0, 30)]));
{
  const m = vase();
  ok('normales unitaires', (() => { for (let i = 0; i < m.normals.length; i += 3) { const l = Math.hypot(m.normals[i], m.normals[i + 1], m.normals[i + 2]); if (Math.abs(l - 1) > 1e-3) return false; } return true; })());
  const t = transform(vase(), { at: [2, 1, -3], rotY: 0.7, scale: 2 });
  const r = checkMesh(t);
  ok('transform préserve le contrat (volume ×8)', r.ok && Math.abs(r.volume / checkMesh(m).volume - 8) < 0.01, `×${(r.volume / checkMesh(m).volume).toFixed(2)}`);
}

// ---- sabotages : le contrat doit mordre par son nom
const sab = (name, mutate, expect) => {
  const m = vase(); mutate(m);
  const r = checkMesh(m);
  const hit = !r.ok && r.issues.some((i) => i.includes(expect));
  (hit ? pass++ : fail++);
  console.log(`${hit ? '✓' : '✗'} sabotage « ${name} » attrapé${hit ? '' : ` — issues: ${r.issues.join('; ') || '(aucune)'}`}`);
};
sab('sommet NaN injecté', (m) => { m.positions[10] = NaN; }, 'non-finite');
sab('index hors bornes', (m) => { m.indices[4] = 99999; }, 'out of range');
sab('couture ouverte (6 triangles retirés)', (m) => { m.indices = m.indices.slice(0, m.indices.length - 18); }, 'open seam');
sab('maillage retourné (normales dedans)', (m) => { for (let i = 0; i < m.indices.length; i += 3) { const t = m.indices[i + 1]; m.indices[i + 1] = m.indices[i + 2]; m.indices[i + 2] = t; } }, 'non-positive volume');
sab('triangle dégénéré (sommets confondus)', (m) => { const a = m.indices[0] * 3, b = m.indices[1] * 3; m.positions[b] = m.positions[a]; m.positions[b + 1] = m.positions[a + 1]; m.positions[b + 2] = m.positions[a + 2]; }, 'degenerate');
{
  const m = lathe([[0, 0], [0.2, 0], [0.3, 0.5], [0.25, 1]], { segments: 12, caps: false });   // open lampshade
  const closedR = checkMesh(m, { closed: true }), openR = checkMesh(m, { closed: false });
  ok('surface OUVERTE assumée : rejetée en solide, acceptée en closed:false', !closedR.ok && openR.ok);
}

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);
