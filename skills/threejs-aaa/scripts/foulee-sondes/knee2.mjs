// Où le genou dépasse-t-il 30 rad/s ? Portrait fin (480 images) du cycle, shanon, griffé 1 et 0 ; vitesse du genou et phase.
const E = process.env.ENG || '/home/delkit/DelkIT/skill-1v1/examples/showcase/src/engine/';
const { gaitPortrait, gaitLegK, gaitLegFactor } = await import(E + 'motion-gait.js');
const { SHANON_PROFILE: P } = await import(E + 'motion-profile-shanon.js');
for (const v of [3, 4.5, 6.5, 8]) for (const g of [1, 0]) {
  const pr = gaitPortrait(P, { vF: v, vR: 0, n: 480, opts: g ? { griffe: 1 } : {} }), F = pr.frames, dt = pr.T / F.length;
  let best = { w: 0 };
  for (let i = 0; i < F.length; i++) { const a = F[i].L, b = F[(i + 1) % F.length].L; const w = Math.abs(b.kneeAngle - a.kneeAngle) * Math.PI / 180 / dt;
    if (w > best.w) { const u = F[i].feet.Left.u, s = F[i].meta.s; best = { w: +w.toFixed(1), phase: a.phase, u: +u.toFixed(3), wSwing: a.phase === 'swing' ? +((u - s) / (1 - s)).toFixed(3) : null, knee: +a.kneeAngle.toFixed(0) }; } }
  const knees = F.map((f) => f.L.kneeAngle);
  console.log(`v ${v} griffé ${g} : cycle ${pr.T.toFixed(3)} s, legK eff ${gaitLegFactor(gaitLegK(P), v).toFixed(3)}, genou ${Math.min(...knees).toFixed(0)}-${Math.max(...knees).toFixed(0)}°, vitesse max genou`, JSON.stringify(best));
}
