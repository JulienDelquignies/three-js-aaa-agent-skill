// L'ARMÉ PLANTÉ, DANS LA SIM (sans navigateur, moteur STARTER) — les armés de frappe en course (≥ 1,5 m/s) dont la sortie s'écarte de ≥ 45° de la
// course (rondo-sim.armePlante) : la vitesse du corps au départ de l'armé, au plus fort, au contact ; le tour du corps et l'écart regard → sortie au
// contact ; l'accélération au plus fort pendant l'armé ; les refus stance-au-contact. A/B : cle=JSON (armePlante=null : l'armé d'hier).
// Usage : node arme-plante.mjs [graines=32] [cle=JSON …]
import { makeDuel, duelCfg } from '../../assets/starter/src/engine/duel-1v1.js';
import { matchStep } from '../../assets/starter/src/engine/match-sim.js';
const [NS = '32', ...KV] = process.argv.slice(2);
const OV = Object.fromEntries(KV.map((s) => { const i = s.indexOf('='); return [s.slice(0, i), JSON.parse(s.slice(i + 1))]; }));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a)), D = 180 / Math.PI; const P = []; let refus = 0, refusA = 0;
for (let seed = 1; seed <= +NS; seed++) { const st = makeDuel({ seed }), cfg = duelCfg(OV); const cur = {};
  for (let i = 0; i < 120 * 60; i++) { const r0 = st.deny?.['stance-au-contact'] ?? 0; matchStep(st, 1 / 60, cfg); const dr = (st.deny?.['stance-au-contact'] ?? 0) - r0;
    if (dr) { refus += dr; for (const p of st.players) if (cur[p.id]?.ang >= 45) refusA += dr; }
    for (const p of st.players) { if (p.keeper) continue; const A = p.act, isP = A && A.payload?.stance && A.payload?.kind !== 'skill';
      if (isP && A.t <= 1 / 60 + 1e-6 && !cur[p.id]) { const hv = A.payload.vYaw ?? p.yaw;
        cur[p.id] = { id: A.id, shot: !!A.payload.choice?.shot, v0: A.payload.v0 ?? 0, ang: Math.abs(wrap(A.payload.outYaw - hv)) * D, vMax: 0, y0: p.yaw, aMax: 0, vPrev: null }; }
      const o = cur[p.id]; if (!o) continue;
      if (A && A.id === o.id && !A.fired) { o.vMax = Math.max(o.vMax, p.speed); if (o.plante == null && A.payload._plante !== undefined) o.plante = !!A.payload._plante; if (o.vPrev && A.t > 0.04) o.aMax = Math.max(o.aMax, Math.hypot(p.v[0] - o.vPrev[0], p.v[1] - o.vPrev[1]) * 60); o.vPrev = [p.v[0], p.v[1]]; }
      if (A && A.id === o.id && A.fired && o.vC == null) { o.vC = p.speed; o.res = Math.abs(wrap(A.payload.outYaw - p.yaw)) * D; o.tour = Math.abs(wrap(p.yaw - o.y0)) * D; }
      if (!A || A.id !== o.id) { P.push(o); cur[p.id] = null; } } } }
const q = (xs, f) => { const s = xs.filter((x) => x != null && !isNaN(x)).sort((a, b) => a - b); return s.length ? s[Math.floor(f * (s.length - 1))] : NaN; }, m = (xs, d = 1) => `${q(xs, 0.5).toFixed(d)} [${q(xs, 0.1).toFixed(d)}–${q(xs, 0.9).toFixed(d)}]`;
const X = P.filter((o) => o.ang >= 45 && o.v0 >= 1.5), F = X.filter((o) => o.vC != null);
console.log(`armés ≥45° lancés : ${X.length} (plantés ${X.filter((o) => o.plante).length}, frappés ${F.length}) ; refus stance-au-contact ${refus} (dont armés à angle ${refusA})`);
console.log(`corps : départ ${m(X.map((o) => o.v0))} → pic ${m(F.map((o) => o.vMax))} → contact ${m(F.map((o) => o.vC))} m/s ; contact/départ ${m(F.map((o) => o.vC / o.v0), 2)} ; pic/départ ${m(F.map((o) => o.vMax / o.v0), 2)}`);
console.log(`tour du corps ${m(F.map((o) => o.tour), 0)}° ; écart regard→sortie au contact ${m(F.map((o) => o.res), 0)}° ; accélère au contact (> départ +0,3) : ${F.filter((o) => o.vC > o.v0 + 0.3).length}/${F.length}`);
console.log(`accélération max pendant l'armé ${m(F.map((o) => o.aMax), 0)} m/s² ; > 20 m/s² : ${F.filter((o) => o.aMax > 20).length}/${F.length}`);
const Y = P.filter((o) => !(o.ang >= 45 && o.v0 >= 1.5) && o.vC != null); console.log(`autres armés frappés ${Y.length} : contact ${m(Y.map((o) => o.vC))} m/s`);
