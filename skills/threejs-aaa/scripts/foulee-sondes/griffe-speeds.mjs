// Par vitesse : cheville au monde à la pose / au décollage (même instrument que verify-foulee), temps de rasage de l'orteil,
// et part du griffé retenue par la portée (λ moyen en fin de vol).
const E = process.env.ENG || '/home/delkit/DelkIT/skill-1v1/examples/showcase/src/engine/';
const { gaitPortrait } = await import(E + 'motion-gait.js');
const { SHANON_PROFILE: P } = await import(E + 'motion-profile-shanon.js');
for (const v of [1.4, 3, 4.5, 6]) {
  const pr = gaitPortrait(P, { vF: v, vR: 0, n: 480, opts: { griffe: 1 } }), F = pr.frames, n = F.length, dt = pr.T / n;
  const wz = (i) => (i < n ? F[i].L.ankleW[2] : F[i - n].L.ankleW[2] - v * pr.T), wv = (i) => Math.abs(wz(i + 1) - wz(i)) / dt;
  const iTD = F.findIndex((f, i) => f.L.phase === 'stance' && F[(i - 1 + n) % n].L.phase === 'swing');
  const iLO = F.findIndex((f, i) => f.L.phase === 'swing' && F[(i - 1 + n) % n].L.phase !== 'swing');
  const sol = Math.min(...F.map((f) => f.L.toe[1])); let rase = 0;
  for (let i = 0; i < n - 1; i++) { const a = F[i], b = F[i + 1]; if (a.L.phase !== 'swing' || a.L.toe[1] - sol >= 0.015) continue; if (Math.hypot(b.L.toe[0] - a.L.toe[0], (b.L.toe[2] - v * b.t) - (a.L.toe[2] - v * a.t)) / dt > 1) rase += dt; }
  const pre = [5, 10, 20].map((k) => wv((iTD - k + n) % n).toFixed(2));
  console.log(`v ${v} : pose ${wv((iTD - 1 + n) % n).toFixed(2)} m/s (5/10/20 images avant : ${pre.join(' / ')}), décolle ${wv(iLO).toFixed(2)}, orteil rase ${(1000 * rase).toFixed(0)} ms, vol ${(1000 * (1 - F[0].meta.s) * pr.T).toFixed(0)} ms`);
}
