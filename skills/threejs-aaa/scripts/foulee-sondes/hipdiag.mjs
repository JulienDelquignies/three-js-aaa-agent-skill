// Où la hanche dépasse-t-elle −30° ? Portrait fin (480), shanon et foot-18, griffé 1/0 : phase, u, cheville (derrière, hauteur), genou, bassin.
const E = '/home/delkit/DelkIT/skill-1v1/examples/showcase/src/engine/';
const { gaitPortrait } = await import(E + 'motion-gait.js');
const { SHANON_PROFILE } = await import(E + 'motion-profile-shanon.js');
for (const [name, P] of [['shanon', SHANON_PROFILE]]) for (const v of [4.5, 6, 8]) for (const g of [1, 0]) {
  const pr = gaitPortrait(P, { vF: v, vR: 0, n: 480, opts: g ? { griffe: 1 } : {} }), F = pr.frames;
  let m = null; F.forEach((f, i) => { if (!m || f.L.hipFlex < m.h) m = { h: f.L.hipFlex, i, f }; });
  const f = m.f, s = f.meta.s, u = f.feet.Left.u, to = F.findIndex((x) => x.L.phase === 'swing');
  const hipAt = (k) => F[(to + k + F.length) % F.length].L.hipFlex.toFixed(0);
  console.log(`${name} v ${v} griffé ${g} : hanche min ${m.h.toFixed(1)}° à u ${u.toFixed(3)} (${f.L.phase}${f.L.phase === 'swing' ? ', w ' + ((u - s) / (1 - s)).toFixed(3) : ''}) — cheville ${(f.L.ankle[2]).toFixed(2)} m derrière, ${(f.L.ankle[1]).toFixed(2)} m haut, genou ${f.L.kneeAngle.toFixed(0)}° | hanche au décollage −2/0/+10/+20 images : ${hipAt(-2)} ${hipAt(0)} ${hipAt(10)} ${hipAt(20)}`);
}
