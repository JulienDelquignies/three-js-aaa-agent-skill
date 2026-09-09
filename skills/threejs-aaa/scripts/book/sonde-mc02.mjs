// sonde MC02 (Modèle 02, locomotion) — 1 pointe par poste, 2 courbe d'accélération (tau, t90), 3 accélérations/décélérations par minute, 6 part des courses courbes, 8 déficit de conduite, 11 dégradation Q1 → Q6, 12 interpénétration, 13 oscillation.
import { makeMatch, matchStep, matchCfg } from '../../assets/starter/src/engine/match-sim.js';
const seeds = (process.argv[2] ?? '3,7').split(',').map(Number);
const famDe = (post) => post < 4 ? (post === 0 || post === 3 ? 'LAT' : 'DC') : post < 7 ? 'MC' : post === 8 ? 'ATT' : 'AIL';
const o = { n: 0, top: {}, tau: [], t90: [], r2: [], acc: 0, dec: 0, minutes: 0, sprints: 0, courbes: 0, vBall: [], vSans: [], hiQ: {}, topQ: {}, interp: 0, osc: [], ticks: 0 };
for (const seed of seeds) {
  const st = makeMatch({ full: true, seed }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: 2700, pause: 10 } }); o.n++;
  const H = new Map(); // id → historique 10 Hz [{t, x, z, v}]
  const ep = new Map(); // épisodes d'accélération en cours
  let interpT = new Map();
  for (let i = 0; i < 5400 * 60; i++) {
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break; o.ticks++;
    if (i % 6) continue; const dt = 0.1; if (!st.restart) o.minutes += dt / 60;
    const Q = 'Q' + Math.min(6, Math.floor(st.t / 900) + 1);
    for (const p of st.players) { if (p.keeper) continue; const h = H.get(p.id) ?? []; const last = h[h.length - 1]; const v = last ? Math.hypot(p.p[0] - last.x, p.p[2] - last.z) / dt : 0; const a = last ? (v - last.v) / dt : 0; const yaw = last ? Math.atan2(p.p[2] - last.z, p.p[0] - last.x) : 0; h.push({ t: st.t, x: p.p[0], z: p.p[2], v, a, yaw }); if (h.length > 60) h.shift(); H.set(p.id, h);
      if (st.restart) continue;
      const f = famDe(p.post); o.top[f] = Math.max(o.top[f] ?? 0, v); o.topQ[Q] = Math.max(o.topQ[Q] ?? 0, v); if (v > 5.5) o.hiQ[Q] = (o.hiQ[Q] ?? 0) + v * dt;
      // 8 : vitesse avec / sans ballon (porteur en conduite c. autres en course > 3 m/s)
      if (v > 3) (st.possession.carrier === p.id && st.phase === 'carry' ? o.vBall : o.vSans).push(v);
      // 3 : épisodes > +3 / < −3 m/s² d'au moins 0,5 s
      const e = ep.get(p.id) ?? { kind: 0, n: 0 }; const k = a > 3 ? 1 : a < -3 ? -1 : 0; if (k === e.kind) e.n++; else { if (e.n >= 5) { if (e.kind > 0) o.acc++; else if (e.kind < 0) o.dec++; } e.kind = k; e.n = 1; } ep.set(p.id, e);
      // 2 : sprint départ arrêté (v < 1 → v > 7 sans interruption) : ajustement tau sur v(t) = V0 (1 − e^{−t/τ})
      if (v > 7 && h.length > 30) { let s = h.length - 1; while (s > 0 && h[s].v > h[s - 1].v - 0.3) s--; if (h[s].v < 1 && !p._sprintAt || (p._sprintAt ?? -9) < h[s].t - 1) { if (h[s].v < 1) { p._sprintAt = h[s].t; const pts = h.slice(s); const V0 = 8.8; let bt = 1.17, be = Infinity; for (let tau = 0.6; tau <= 2.5; tau += 0.05) { let err = 0; for (const q of pts) { const m = V0 * (1 - Math.exp(-(q.t - pts[0].t) / tau)); err += (q.v - m) ** 2; } if (err < be) { be = err; bt = tau; } } const vm = pts.reduce((x, q) => x + q.v, 0) / pts.length; const sst = pts.reduce((x, q) => x + (q.v - vm) ** 2, 0); o.tau.push(bt); o.r2.push(1 - be / Math.max(1e-6, sst)); const t90 = pts.find((q) => q.v >= 0.9 * 7.5); if (t90) o.t90.push(t90.t - pts[0].t); o.sprints++; let dev = 0; for (let k2 = 1; k2 < pts.length; k2++) { let dy = pts[k2].yaw - pts[k2 - 1].yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); dev += Math.abs(dy); } if (dev * 180 / Math.PI > 15) o.courbes++; } } }
      // 13 : inversions du signe de l'accélération latérale sur 1 s
      if (h.length >= 11) { let inv = 0, prev = 0; for (let k2 = h.length - 10; k2 < h.length; k2++) { const q = h[k2], r = h[k2 - 1]; let dy = q.yaw - r.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); const s2 = q.v > 1 ? Math.sign(dy) : 0; if (s2 && prev && s2 !== prev) inv++; if (s2) prev = s2; } if (i % 60 === 0) o.osc.push(inv); }
    }
    // 12 : interpénétration (< 0,6 m pendant > 2 ticks de 10 Hz) hors arrêt
    if (!st.restart) { const P = st.players.filter((p) => !p.keeper && p.down <= 0); for (let a = 0; a < P.length; a++) for (let b = a + 1; b < P.length; b++) { const key = P[a].id * 100 + P[b].id; if (Math.hypot(P[a].p[0] - P[b].p[0], P[a].p[2] - P[b].p[2]) < 0.6) { const n = (interpT.get(key) ?? 0) + 1; interpT.set(key, n); if (n === 3) o.interp++; } else interpT.delete(key); } }
  }
}
const q = (a, x) => { a = [...a].sort((u, v) => u - v); return a.length ? a[Math.floor(x * a.length)] : NaN; }; const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
console.log(`${o.n} × 90 min (échantillon 10 Hz)`);
console.log(`1   vitesse de pointe par poste (max sur le match) : ${Object.entries(o.top).map(([f, v]) => `${f} ${v.toFixed(2)}`).join(', ')} m/s (cible ailiers/latéraux 8,3-9,2, milieux 7,5-8,4 ; plafond moteur sprintMax 8,0)`);
console.log(`2   courbe d'accélération (départ < 1 m/s → > 7 m/s, ${o.tau.length} sprints) : tau p50 ${q(o.tau, 0.5).toFixed(2)} s (cible 0,95-1,40), t90 p50 ${q(o.t90, 0.5).toFixed(2)} s (cible 2,2-3,2), R² p50 ${q(o.r2, 0.5).toFixed(2)} (≥ 0,95)`);
console.log(`3   accélérations > +3 m/s² ≥ 0,5 s : ${(o.acc / o.minutes / 20).toFixed(2)} / joueur / min (cible PL 0,81-0,97, L1 0,60-0,75) ; décélérations < −3 : ${(o.dec / o.minutes / 20).toFixed(2)} (cible 0,86-1,17)`);
console.log(`6   part des sprints (> 7 m/s) à déviation de cap cumulée > 15° : ${(100 * o.courbes / Math.max(1, o.sprints)).toFixed(0)} % (cible ≥ 70, réel 86)`);
console.log(`8   vitesse en course > 3 m/s : avec ballon p50 ${q(o.vBall, 0.5).toFixed(2)} m/s, sans ballon ${q(o.vSans, 0.5).toFixed(2)} → déficit ${(100 * (1 - q(o.vBall, 0.5) / q(o.vSans, 0.5))).toFixed(0)} % (cible 4-16)`);
console.log(`11  haute intensité > 5,5 m/s Q6 / Q1 : ${(100 * ((o.hiQ.Q6 ?? 0) / Math.max(1, o.hiQ.Q1 ?? 1) - 1)).toFixed(0)} % (cible ≤ −10) ; pointe Q6 / Q1 : ${(100 * ((o.topQ.Q6 ?? 0) / (o.topQ.Q1 ?? 1) - 1)).toFixed(1)} % (cible > −8)`);
console.log(`12  interpénétrations (< 0,6 m > 0,2 s) : ${(o.interp / o.minutes).toFixed(2)} / min (cible < 0,5) ; 13 inversions de cap sur 1 s (joueurs > 1 m/s) : p50 ${q(o.osc, 0.5)} (cible ≤ 2,5)`);
