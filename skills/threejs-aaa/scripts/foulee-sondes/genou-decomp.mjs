import fs from 'fs';
const E = '/home/delkit/DelkIT/skill-1v1/examples/showcase/src/engine/';
const src = fs.readFileSync(E + 'motion-gait.js', 'utf8');
const V = {
  base: [],
  'sans d0 (décollage)': [["const d0 = [lift[1] - hipTO[1] - f0[0], lift[2] - hipTO[2] - f0[1]]", "const d0 = [0, 0]"]],
  'sans d1 (pose)': [["d1 = [land[1] - hipTD[1] - f1[0], land[2] - hipTD[2] - f1[1]]", "d1 = [0, 0]"]],
  'sans Hermite': [["  if (Tsw > 0) {", "  if (false) {"]],
};
const { SHANON_PROFILE: P } = await import(E + 'motion-profile-shanon.js');
for (const [name, reps] of Object.entries(V)) {
  let s = src; for (const [a, b] of reps) { if (!s.includes(a)) throw new Error('absent: ' + a); s = s.replace(a, b); }
  const f = E + `_dec${Math.random().toString(36).slice(2)}.mjs`; fs.writeFileSync(f, s); const MG = await import(f); fs.unlinkSync(f);
  const kmax = (v, opts) => { const pr = MG.gaitPortrait(P, { vF: v, vR: 0, opts, n: 240 }); let m = 0; for (const fr of pr.frames) for (const sd of ['L', 'R']) if (fr[sd].phase === 'swing') m = Math.max(m, fr[sd].kneeAngle); return m; };
  console.log(name.padEnd(22), [[4.5, {}], [4.5, { brake: 1 }], [4.5, { turn: 9 }], [4.5, { brake: 1, turn: 9 }], [3, {}], [3, { brake: 1 }]].map(([v, o]) => `${v}${JSON.stringify(o)} ${kmax(v, { griffe: 1, ...o }).toFixed(0)}`).join(' | '));
}
