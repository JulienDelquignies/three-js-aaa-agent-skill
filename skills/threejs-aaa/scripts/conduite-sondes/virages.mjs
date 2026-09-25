// Les touches de conduite selon le VIRAGE : mode (contact / fin / porté / lent), lacet du corps, accélération latérale, écart du cap
// voulu, le ballon dans le repère du corps, et pour les touches « fin » la distance du pied prédit au ballon (pasContact).
const E = decodeURI(new URL('../../../../examples/showcase/src/engine/', import.meta.url).pathname);
const { makeDuel, duelCfg } = await import(E + 'duel-1v1.js'); const { matchStep } = await import(E + 'match-sim.js'); const { pasContact } = await import(E + 'pas.js');
const rows = [];
for (const seed of [1, 2, 3, 4, 5, 6]) { const st = makeDuel({ seed }), cfg = duelCfg(), dt = 1 / 60; let ne = 0;
  for (let i = 0; i < 120 * 60; i++) { const pre = st.players.map((p) => ({ ball: [...st.ball.p], p: [...p.p], yaw: p.yaw, pas: p._pas ? { ...p._pas } : null }));
    matchStep(st, dt, cfg);
    while (ne < st.events.length) { const e = st.events[ne++]; if (e.type !== 'touche' || !e.pas || e.pas === 'lent') continue;
      const c = st.players[e.by], P = c._pas; if (!P) continue; const fx = Math.cos(c.yaw), fz = Math.sin(c.yaw), bx = st.ball.p[0] - c.p[0], bz = st.ball.p[2] - c.p[2];
      const pushYaw = c.push ? Math.atan2(c.push[1], c.push[0]) : c.yaw, ecart = Math.abs(Math.atan2(Math.sin(pushYaw - c.yaw), Math.cos(pushYaw - c.yaw))) * 180 / Math.PI;
      const pre0 = pre[e.by], pbx = pre0.ball[0] - pre0.p[0], pbz = pre0.ball[2] - pre0.p[2], pfx = Math.cos(pre0.yaw), pfz = Math.sin(pre0.yaw);
      const ct = pasContact({ _pas: P, legK: c.legK }, pbx * pfx + pbz * pfz, -pbx * pfz + pbz * pfx);
      rows.push({ mode: e.pas, v: P.v, yawRate: Math.abs(P.yawRate), turn: Math.abs(P.turn), ecart, avant: pbx * pfx + pbz * pfz, cote: Math.abs(-pbx * pfz + pbz * pfx), d: ct?.d ?? 9 }); } } }
const q = (xs, f) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(f * (s.length - 1))] : NaN; };
const bin = (r) => r.yawRate < 1 ? 'lacet <1 rad/s' : r.yawRate < 2.5 ? 'lacet 1-2,5' : 'lacet ≥2,5';
for (const b of ['lacet <1 rad/s', 'lacet 1-2,5', 'lacet ≥2,5']) { const g = rows.filter((r) => bin(r) === b), n = g.length || 1;
  const m = (k) => g.filter((r) => r.mode === k).length;
  console.log(`${b.padEnd(15)} ${String(g.length).padStart(4)} touches : contact ${(100 * m('contact') / n).toFixed(0)} %, porté ${(100 * m('porté') / n).toFixed(0)} %, fin ${(100 * m('fin') / n).toFixed(0)} % | ballon devant p50 ${q(g.map((r) => r.avant), 0.5).toFixed(2)} côté p50 ${q(g.map((r) => r.cote), 0.5).toFixed(2)} p90 ${q(g.map((r) => r.cote), 0.9).toFixed(2)} | pied prédit → ballon (fin) p50 ${q(g.filter((r) => r.mode === 'fin').map((r) => r.d), 0.5).toFixed(2)} p90 ${q(g.filter((r) => r.mode === 'fin').map((r) => r.d), 0.9).toFixed(2)} | écart cap voulu p50 ${q(g.map((r) => r.ecart), 0.5).toFixed(0)}°`); }
