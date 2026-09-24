// Le glissement du pied d'appui EN JEU, ventilé par l'accélération du corps pendant l'appui (dynamique) — l'appui = la PHASE du
// générateur (feet.*.phase === 'stance', pas une détection) ; glisse = déplacement monde de la cheville pendant la phase 'stance'.
import { chromium } from '/home/delkit/DelkIT/skill-1v1/examples/showcase/node_modules/playwright/index.mjs';
const [URL, SECS = '60'] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const pg = await b.newPage({ viewport: { width: 320, height: 180 } });
await pg.goto(URL, { waitUntil: 'load', timeout: 240000 });
await pg.waitForFunction(() => !!window.__scene, null, { timeout: 240000 });
const r = await pg.evaluate((SECS) => {
  const sc = window.__scene, dt = 1 / 60, N = Math.round(SECS / dt), V = sc.players[0].model.position.constructor, tmp = new V();
  const A = sc.players.map((pl) => { const f = {}; pl.model.traverse((o) => { if (o.isBone && /(Left|Right)Foot$/.test(o.name)) f[o.name.match(/(Left|Right)Foot$/)[1]] = o; if (o.isBone && /(Left|Right)ToeBase$/.test(o.name)) f[o.name.match(/(Left|Right)ToeBase$/)[1] + 'T'] = o; }); return f; });
  const openT = sc.players.map(() => ({})), outT = []; const yawP = sc.players.map(() => null);
  const open = sc.players.map(() => ({})), out = [];
  const pv = sc.players.map(() => null);
  for (let i = 0; i < N; i++) {
    sc.update(dt); if (i < 120) continue;
    sc.players.forEach((pl, j) => {
      const g = pl.ctrl._gaitGen, ph = g?.lastFeet ?? null;
      const vel = [pl.sim?.v?.[0] ?? 0, pl.sim?.v?.[2] ?? 0]; const acc = pv[j] ? Math.hypot(vel[0] - pv[j][0], vel[1] - pv[j][1]) / dt : 0; pv[j] = vel;
      pl.model.updateMatrixWorld(true);
      const yaw = pl.ctrl.yaw ?? 0, dyaw = yawP[j] == null ? 0 : Math.abs(Math.atan2(Math.sin(yaw - yawP[j]), Math.cos(yaw - yawP[j]))) / dt; yawP[j] = yaw;
      for (const side of ['Left', 'Right']) {
        const phase = pl.ctrl._gaitFeet?.[side]?.phase;
        { A[j][side + 'T'].getWorldPosition(tmp); const o = openT[j][side];
          if (phase === 'peel' && !pl.sim?.act) { if (!o) openT[j][side] = { x0: tmp.x, z0: tmp.z, n: 1 }; else { o.x1 = tmp.x; o.z1 = tmp.z; o.n++; } }
          else if (o) { if (o.x1 != null && o.n >= 3) outT.push(Math.hypot(o.x1 - o.x0, o.z1 - o.z0)); openT[j][side] = null; } }
        A[j][side].getWorldPosition(tmp);
        const o = open[j][side];
        if (phase === 'stance' && !pl.sim?.act) {
          const f = pl.ctrl._gaitFeet[side], pa = pl.ctrl._plants?.[side];
          if (!o) open[j][side] = { x0: tmp.x, z0: tmp.z, acc: [acc], v: [Math.hypot(...vel)], yr: [dyaw], unr: f.reachable ? 0 : 1, pw: pa ? [...pa.w] : null, rep: 0, lockW: [pl.ctrl.footLock?.state?.[side === 'Left' ? 0 : 1]?.w ?? 0] };
          else { o.x1 = tmp.x; o.z1 = tmp.z; o.acc.push(acc); o.v.push(Math.hypot(...vel)); o.yr.push(dyaw); o.unr += f.reachable ? 0 : 1; if (pa && o.pw && Math.hypot(pa.w[0] - o.pw[0], pa.w[1] - o.pw[1]) > 1e-6) { o.rep++; o.pw = [...pa.w]; } o.lockW.push(pl.ctrl.footLock?.state?.[side === 'Left' ? 0 : 1]?.w ?? 0); }
        } else if (o) {
          if (o.x1 != null && o.acc.length >= 4) out.push({ slip: Math.hypot(o.x1 - o.x0, o.z1 - o.z0), acc: o.acc.reduce((a, b) => a + b) / o.acc.length, v: o.v.reduce((a, b) => a + b) / o.v.length, yr: Math.max(...o.yr), unr: o.unr, rep: o.rep, lock: Math.max(...o.lockW), n: o.acc.length });
          open[j][side] = null;
        }
      }
    });
  }
  return { out, outT };
}, Number(SECS));
const q = (xs, f) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(f * (s.length - 1))] : NaN; };
const R = r.out;
console.log(`${R.length} appuis ; orteil pendant le déroulé : p50 ${(100 * q(r.outT, 0.5)).toFixed(1)} cm, p90 ${(100 * q(r.outT, 0.9)).toFixed(1)} cm (${r.outT.length} déroulés)`);
for (const [lo, hi] of [[0, 2], [2, 6], [6, 99]]) { const g = R.filter((x) => x.yr >= lo && x.yr < hi && x.v > 1.5); console.log(`lacet ${lo}-${hi} rad/s : ${g.length} appuis, glisse p50 ${(100 * q(g.map((x) => x.slip), 0.5)).toFixed(1)} cm, p90 ${(100 * q(g.map((x) => x.slip), 0.9)).toFixed(1)} cm`); }
const big = R.filter((x) => x.slip > 0.08 && x.v > 1.5); console.log('appuis qui glissent > 8 cm :', big.length, JSON.stringify(big.slice(0, 8).map((x) => ({ cm: +(100 * x.slip).toFixed(0), lacet: +x.yr.toFixed(1), horsPortee: x.unr, replante: x.rep, verrou: +x.lock.toFixed(2), images: x.n, v: +x.v.toFixed(1) }))));
for (const [lo, hi] of [[0, 1.5], [1.5, 4], [4, 99]]) {
  const g = R.filter((x) => x.acc >= lo && x.acc < hi && x.v > 2);
  console.log(`accélération ${lo}-${hi} m/s² (course > 2 m/s) : ${g.length} appuis, glisse p50 ${(100 * q(g.map((x) => x.slip), 0.5)).toFixed(1)} cm, p90 ${(100 * q(g.map((x) => x.slip), 0.9)).toFixed(1)} cm`);
}
await b.close();
