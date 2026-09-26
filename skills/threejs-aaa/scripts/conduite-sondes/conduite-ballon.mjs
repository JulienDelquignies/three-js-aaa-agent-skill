// LE BALLON DE LA CONDUITE, VU DU RENDU : est-il mené par les PIEDS, ou par une force invisible ? Pour le porteur en course (≥ 1 m/s, hors geste,
// hors remise), image par image : le mode (PORTÉ = tenu au servo vers un point devant le pied ; LIBRE = il roule, une touche le relance), le
// ballon dans le repère du corps (devant le bassin, de côté), sa distance au pied rendu le plus proche, sa vitesse rapportée à celle du corps ;
// l'ACCÉLÉRATION INEXPLIQUÉE — le ballon au sol qui accélère ou freine au-delà du roulement sur l'herbe (> 2 m/s² d'écart) sans pied à moins de
// 0,2 m : la force invisible ; les touches (intervalle, par foulée, par mètre) ; l'aller-retour du ballon devant le corps entre deux touches.
// Usage : node conduite-ballon.mjs <url> [secondes=120] [graines=1,2,3,4] [sortie.json]
import { chromium } from '../../../../examples/showcase/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';
const [URL, SECS = '120', GR = '1,2,3,4', OUT] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const T = [], TOUCH = [], CYC = [];
for (const seed of GR.split(',').map(Number)) {
  const pg = await b.newPage({ viewport: { width: 320, height: 180 } });
  await pg.goto(`${URL}${URL.includes('?') ? '&' : '?'}seed=${seed}`, { waitUntil: 'load', timeout: 240000 });
  await pg.waitForFunction(() => !!window.__scene && window.__scene.players?.length === 2, null, { timeout: 240000 });
  const r = await pg.evaluate((SECS) => {
    const sc = window.__scene, st = sc.state, dt = 1 / 60, W = (o) => { const e = o.matrixWorld.elements; return [e[12], e[13], e[14]]; };
    const B = sc.players.map((pl) => { const f = {}; pl.model.traverse((o) => { if (o.isBone && !f[o.name]) f[o.name] = o; }); return f; });
    const out = { f: [], t: [], c: [] }; let ne = 0, bv0 = null, cyc = null;
    for (let i = 0; i < SECS * 60; i++) {
      sc.update(dt);
      const car = st.possession?.carrier ?? -1, j = sc.players.findIndex((pl) => pl.sim.id === car), bl = st.ball;
      while (ne < st.events.length) { const e = st.events[ne++]; if (e.type === 'touche' && e.by === car) out.t.push([+st.t.toFixed(3), e.pas ?? 'hier', e.foot ?? null]); }
      const bv = [bl.v[0], bl.v[2]];
      if (j < 0 || st.phase !== 'carry' || st.restart) { bv0 = null; cyc = null; continue; }
      const pl = sc.players[j], s = pl.sim, v = Math.hypot(s.v[0], s.v[1]);
      if (v < 1 || s.act) { bv0 = bv; cyc = null; continue; }
      pl.model.updateMatrixWorld(true);
      const fx = s.v[0] / v, fz = s.v[1] / v, H = W(B[j].Hips), dx = bl.p[0] - H[0], dz = bl.p[2] - H[2];
      const av = dx * fx + dz * fz, lat = -dx * fz + dz * fx;
      let pied = 9; for (const k of ['LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase']) { const q = W(B[j][k]); pied = Math.min(pied, Math.hypot(q[0] - bl.p[0], q[1] - bl.p[1], q[2] - bl.p[2])); }
      // l'accélération du ballon au sol, moins le roulement (≈ la décélération le long de sa vitesse) : l'écart est une force appliquée
      let inexp = null;
      if (bv0 && bl.p[1] < 0.16) { const ax = (bv[0] - bv0[0]) / dt, az = (bv[1] - bv0[1]) / dt, sp = Math.hypot(...bv0), ux = sp > 0.1 ? bv0[0] / sp : 0, uz = sp > 0.1 ? bv0[1] / sp : 0;
        const rou = sp > 0.1 ? 1.5 : 0; inexp = Math.hypot(ax + ux * rou, az + uz * rou); }
      const touche = out.t.length && out.t[out.t.length - 1][0] >= st.t - 1e-3;
      // pourquoi le porté (rondo-sim) : intention fraîche, contrôle qui se pose, retournement, pausa / bouclier ; et depuis quand la dernière touche
      const pq = [s.intent ? 'intent' : '', s.anchorHint && st.t - s.anchorHint.t < 0.4 ? 'ancre' : '', st._settling && st.t < st._settling.at ? 'pose' : '', s._pausa ? 'pausa' : '', s._bouclier ? 'bouclier' : ''].filter(Boolean).join('+') || '?';
      const dT = out.t.length ? +(st.t - out.t[out.t.length - 1][0]).toFixed(2) : 9;
      out.f.push([+st.t.toFixed(3), st.ball.owner === car ? 1 : 0, +v.toFixed(2), +Math.hypot(...bv).toFixed(2), +av.toFixed(2), +lat.toFixed(2), +pied.toFixed(3), inexp == null ? -1 : +inexp.toFixed(1), touche ? 1 : 0, +(s._pas?.T ?? 0).toFixed(3), pq, dT, +(Math.acos(Math.max(-1, Math.min(1, (bv[0] * fx + bv[1] * fz) / (Math.hypot(...bv) || 1)))) * 180 / Math.PI).toFixed(0)]);
      bv0 = bv;
    }
    return out;
  }, +SECS);
  T.push(...r.f.map((x) => [seed, ...x])); TOUCH.push(...r.t.map((x) => [seed, ...x]));
  await pg.close(); console.log(`graine ${seed} : ${r.f.length} images de conduite, ${r.t.length} touches`);
}
await b.close();
const q = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };
const pct = (n, d) => (100 * n / Math.max(1, d)).toFixed(0) + ' %';
const tot = T.length, porte = T.filter((x) => x[2] === 1), libre = T.filter((x) => x[2] === 0);
console.log(`\n${tot} images de conduite en course (${(tot / 60).toFixed(0)} s) : PORTÉ (servo) ${pct(porte.length, tot)}, LIBRE ${pct(libre.length, tot)}`);
for (const [nom, L] of [['porté', porte], ['libre', libre]]) {
  if (!L.length) continue;
  const inv = L.filter((x) => x[8] > 2 && x[7] > 0.2 && !x[9]);
  console.log(`  ${nom.padEnd(6)} : ballon devant le bassin ${q(L.map((x) => x[5]), 0.1).toFixed(2)} / ${q(L.map((x) => x[5]), 0.5).toFixed(2)} / ${q(L.map((x) => x[5]), 0.9).toFixed(2)} m (p10/p50/p90), de côté |${q(L.map((x) => Math.abs(x[6])), 0.5).toFixed(2)}| m, au pied le plus proche ${q(L.map((x) => x[7]), 0.5).toFixed(2)} m (p50) ; vitesse ballon / corps ${q(L.map((x) => x[4] / x[3]), 0.1).toFixed(2)}-${q(L.map((x) => x[4] / x[3]), 0.9).toFixed(2)} ; FORCE INVISIBLE (> 2 m/s² sans pied à 0,2 m) : ${pct(inv.length, L.length)} des images`);
}
// les touches : intervalle, par foulée, par mètre, modes
const parGr = {}; for (const x of TOUCH) (parGr[x[0]] ??= []).push(x);
const dts = []; let km = 0; const modes = {};
for (const L of Object.values(parGr)) for (let i = 1; i < L.length; i++) { const d = L[i][1] - L[i - 1][1]; if (d > 0.05 && d < 2.5) dts.push(d); }
for (const x of TOUCH) modes[x[2]] = (modes[x[2]] ?? 0) + 1;
for (const x of T) km += x[3] / 60;
const Tp = q(T.map((x) => x[10]).filter((u) => u > 0), 0.5);
console.log(`touches : ${TOUCH.length} (${Object.entries(modes).map(([k, v]) => `${k} ${v}`).join(', ')}) ; intervalle ${q(dts, 0.1).toFixed(2)} / ${q(dts, 0.5).toFixed(2)} / ${q(dts, 0.9).toFixed(2)} s ; ${(q(dts, 0.5) / Tp).toFixed(2)} foulée (cycle ${Tp.toFixed(2)} s) entre deux touches ; ${(TOUCH.length / km).toFixed(2)} touches par mètre couru`);
// par allure
for (const [a, z] of [[1, 2], [2, 3], [3, 4.5], [4.5, 9]]) { const L = T.filter((x) => x[3] >= a && x[3] < z); if (L.length < 60) continue;
  console.log(`  ${a}-${z} m/s (${(L.length / 60).toFixed(0)} s) : porté ${pct(L.filter((x) => x[2]).length, L.length)}, ballon devant ${q(L.map((x) => x[5]), 0.5).toFixed(2)} m [${q(L.map((x) => x[5]), 0.1).toFixed(2)}–${q(L.map((x) => x[5]), 0.9).toFixed(2)}], force invisible ${pct(L.filter((x) => x[8] > 2 && x[7] > 0.2 && !x[9]).length, L.length)}`); }
{ const R = {}; for (const x of porte) R[x[11]] = (R[x[11]] ?? 0) + 1; console.log('pourquoi le porté :', Object.entries(R).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pct(v, porte.length)}`).join(', ')); }
{ const D = libre.filter((x) => x[5] < -0.1); console.log(`libre, ballon DERRIÈRE le bassin : ${pct(D.length, libre.length)} des images libres — depuis la dernière touche ${q(D.map((x) => x[12]), 0.5).toFixed(2)} s (p50), ballon ${q(D.map((x) => x[4]), 0.5).toFixed(1)} m/s, cap du ballon contre la course ${q(D.map((x) => x[13]), 0.5)}° (p50) ; libre devant > 0,9 m : ${pct(libre.filter((x) => x[5] > 0.9).length, libre.length)}`); }
// L'UNITÉ JOUEUR-BALLON (2026-09-26, « le joueur et le ballon doivent ne faire qu'un ») : touches par seconde de conduite (Zago 2016 : 2,3-3,0
// contacts/s en conduite de test), le ballon au pied rendu le plus proche (p50/p90, part au-delà de 0,5 et 0,8 m), la respiration (p90 − p10 du
// ballon devant le bassin) et le louvoiement (p90 − p10 de côté)
{ const tc = TOUCH.filter((x) => T.some((f) => f[0] === x[0] && Math.abs(f[1] - x[1]) < 1 / 90)).length, sec = tot / 60, P = T.map((x) => x[7]), A = T.map((x) => x[5]), L = T.map((x) => x[6]);
  console.log(`UNITÉ : ${(tc / sec).toFixed(2)} touches par seconde de conduite en course (${tc} en ${sec.toFixed(0)} s ; réf. 2,3-3,0) ; ballon au pied rendu ${q(P, 0.5).toFixed(2)} / ${q(P, 0.9).toFixed(2)} m (p50/p90), > 0,5 m ${pct(P.filter((u) => u > 0.5).length, tot)}, > 0,8 m ${pct(P.filter((u) => u > 0.8).length, tot)} ; respiration devant ${(q(A, 0.9) - q(A, 0.1)).toFixed(2)} m, louvoiement ${(q(L, 0.9) - q(L, 0.1)).toFixed(2)} m (p90 − p10)`); }
if (OUT) writeFileSync(OUT, JSON.stringify({ T, TOUCH }));
