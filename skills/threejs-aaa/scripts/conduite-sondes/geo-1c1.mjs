// La géométrie du 1c1 dans la cage, aux instants de décision du porteur (ballon au pied ≤ 0,6 m, pas de geste) : distance au défenseur,
// vitesse de rapprochement, relèvement (où est-il dans le regard du porteur), vitesse latérale du défenseur, vitesse du porteur — et la part
// des instants où la FENÊTRE géométrique de chaque geste (clés du duel) est ouverte.
const E = decodeURI(new URL('../../../../examples/showcase/src/engine/', import.meta.url).pathname);
const { makeDuel, duelCfg } = await import(E + 'duel-1v1.js'); const { matchStep } = await import(E + 'match-sim.js');
const cfg0 = duelCfg(), K = cfg0.skill, rows = [];
for (const seed of [1, 2, 3, 4, 5, 6]) { const st = makeDuel({ seed }), cfg = duelCfg(), dt = 1 / 60;
  for (let i = 0; i < 120 * 60; i++) { matchStep(st, dt, cfg); if (i % 6 || st.phase !== 'carry') continue;
    const c = st.players[st.possession.carrier]; if (!c || c.act || Math.hypot(st.ball.p[0] - c.p[0], st.ball.p[2] - c.p[2]) > 0.6) continue;
    const q = st.players.find((x) => x.team !== c.team); if (!q || q.down > 0) continue;
    const dx = q.p[0] - c.p[0], dz = q.p[2] - c.p[2], fd = Math.hypot(dx, dz), closing = ((c.p[0] - q.p[0]) * q.v[0] + (c.p[2] - q.p[2]) * q.v[1]) / Math.max(1e-4, fd);
    const bear = Math.abs(Math.atan2(Math.sin(Math.atan2(dz, dx) - c.yaw), Math.cos(Math.atan2(dz, dx) - c.yaw))) * 180 / Math.PI;
    const latV = Math.abs((q.v[0] * -dz + q.v[1] * dx) / Math.max(1e-4, fd));
    rows.push({ fd, closing, bear, latV, v: c.speed }); } }
const q = (xs, f) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(f * (s.length - 1))]; }, pc = (f) => (100 * rows.filter(f).length / rows.length).toFixed(1) + ' %';
console.log(`${rows.length} instants de décision (ballon au pied, 6 × 120 s)`);
for (const k of ['fd', 'closing', 'bear', 'latV', 'v']) console.log(`  ${k.padEnd(8)} p10 ${q(rows.map((r) => r[k]), 0.1).toFixed(2)} p50 ${q(rows.map((r) => r[k]), 0.5).toFixed(2)} p90 ${q(rows.map((r) => r[k]), 0.9).toFixed(2)}`);
console.log('fenêtres géométriques ouvertes (sans la sortie libre ni le tirage) :');
console.log('  râteau      ', pc((r) => r.fd <= K.rateauFoe && r.bear <= K.rateauFront && r.closing >= 1.5));
console.log('  passement   ', pc((r) => r.fd >= K.passementFoe[0] && r.fd <= cfg0.passements.foe && r.bear <= 70 && r.closing <= cfg0.passements.charge));
console.log('  crochet     ', pc((r) => r.v >= 1.2 && r.fd >= K.crochetFoe[0] && r.fd <= (cfg0.decalage?.foe ?? K.crochetFoe[1]) && r.bear <= 75 && r.closing >= (cfg0.decalage?.closing ?? 0.8)));
console.log('  croqueta    ', pc((r) => r.fd >= K.doubleFoe[0] && r.fd <= K.doubleFoe[1] && r.closing >= K.doubleClosing && r.bear <= K.doubleCone));
console.log('  petit pont  ', pc((r) => r.fd >= K.pontFoe[0] && r.fd <= K.pontFoe[1] && r.latV >= K.pontLatV && r.bear <= K.pontCone));
console.log('  roulette    ', pc((r) => r.fd >= K.rouletteFoe[0] && r.fd <= K.rouletteFoe[1] && r.bear >= K.rouletteBear[0] && r.bear <= K.rouletteBear[1] && r.closing >= K.rouletteClosing));
console.log('  feinte tir  ', pc((r) => r.fd >= K.frappeFeinteFoe[0] && r.fd <= K.frappeFeinteFoe[1] && r.bear <= K.frappeFeinteCone));
console.log('\nrelèvement × distance (part des instants ; vitesse de rapprochement p50 ; vitesse latérale du défenseur p50 ; vitesse du porteur p50) :');
for (const [b0, b1, nb] of [[0, 45, 'devant'], [45, 90, 'de côté avant'], [90, 135, 'de côté arrière'], [135, 181, 'derrière']]) for (const [d0, d1] of [[0, 1.5], [1.5, 3], [3, 99]]) {
  const g = rows.filter((r) => r.bear >= b0 && r.bear < b1 && r.fd >= d0 && r.fd < d1); if (!g.length) continue;
  console.log(`  ${nb.padEnd(16)} ${String(d0).padStart(3)}-${String(d1 === 99 ? '∞' : d1).padEnd(3)} m : ${(100 * g.length / rows.length).toFixed(1).padStart(5)} %  rapproch. ${q(g.map((r) => r.closing), 0.5).toFixed(1)}  latéral ${q(g.map((r) => r.latV), 0.5).toFixed(1)}  porteur ${q(g.map((r) => r.v), 0.5).toFixed(1)} m/s`); }
