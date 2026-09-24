// Les appuis qui glissent > 8 cm EN JEU : trace image par image (phase, cheville monde, cible du verrou, portée réelle hanche→cible
// contre A+B, poids du verrou, act de la sim, lacet, vitesse)
import { chromium } from '/home/delkit/DelkIT/skill-1v1/examples/showcase/node_modules/playwright/index.mjs';
const [URL, SECS = '60'] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const pg = await b.newPage({ viewport: { width: 320, height: 180 } });
await pg.goto(URL, { waitUntil: 'load', timeout: 240000 });
await pg.waitForFunction(() => !!window.__scene, null, { timeout: 240000 });
const r = await pg.evaluate((SECS) => {
  const sc = window.__scene, dt = 1 / 60, N = Math.round(SECS / dt), V = sc.players[0].model.position.constructor, t1 = new V(), t2 = new V();
  const open = sc.players.map(() => ({})), out = []; let nApp = 0, reps = [];
  for (let i = 0; i < N; i++) {
    sc.update(dt); if (i < 120) continue;
    sc.players.forEach((pl, j) => {
      const fl = pl.ctrl.footLock; pl.model.updateMatrixWorld(true);
      for (const side of ['Left', 'Right']) {
        const li = side === 'Left' ? 0 : 1, phase = pl.ctrl._gaitFeet?.[side]?.phase, o = open[j][side];
        if (phase === 'stance' && !pl.sim?.act) {
          const leg = fl?.legs?.[li], st = fl?.state?.[li];
          leg.foot.getWorldPosition(t1); leg.up.getWorldPosition(t2);
          const R = fl.lens[li].A + fl.lens[li].B, dH = Math.hypot(t2.x - st.dx, t2.y - t1.y, t2.z - st.dz);
          const row = { i, ax: +t1.x.toFixed(3), az: +t1.z.toFixed(3), tx: +(st.dx ?? NaN).toFixed(3), tz: +(st.dz ?? NaN).toFixed(3), w: +st.w.toFixed(2), reach: +(dH / R).toFixed(3), hipY: +t2.y.toFixed(3), yaw: +(pl.ctrl.yaw ?? 0).toFixed(3), v: +Math.hypot(pl.sim?.v?.[0] ?? 0, pl.sim?.v?.[2] ?? 0).toFixed(2), mx: +pl.model.position.x.toFixed(3), mz: +pl.model.position.z.toFixed(3), air: pl.ctrl.airborne ? 1 : 0, touche: pl._touchT != null && (sc._t - pl._touchT) / 0.2 > 0 && (sc._t - pl._touchT) / 0.2 < 1 ? (pl._touchFoot ?? '?') : 0, geste: pl.gestureLayer?.active ? 1 : 0, rep: pl.ctrl._plants?.[side]?.w?.map((x) => +x.toFixed(2)).join(',') };
          if (!o) open[j][side] = { rows: [row] }; else o.rows.push(row);
        } else if (o) {
          const a = o.rows[0], z = o.rows[o.rows.length - 1], slip = Math.hypot(z.ax - a.ax, z.az - a.az);
          nApp++; for (let q = 1; q < o.rows.length; q++) { const d = Math.hypot(o.rows[q].tx - o.rows[q - 1].tx, o.rows[q].tz - o.rows[q - 1].tz); if (d > 0.05) reps.push({ cm: +(100 * d).toFixed(0), v: o.rows[q].v, yawRate: +(Math.abs(Math.atan2(Math.sin(o.rows[q].yaw - o.rows[q - 1].yaw), Math.cos(o.rows[q].yaw - o.rows[q - 1].yaw))) * 60).toFixed(1) }); }
          if (slip > 0.08 && o.rows.length >= 4) out.push({ j, side, slip, rows: o.rows });
          open[j][side] = null;
        }
      }
    });
  }
  return { out, nApp, reps };
}, Number(SECS));
console.log('appuis', r.nApp, 'replantes (saut de cible > 5 cm)', r.reps.length, JSON.stringify(r.reps));
const R = r.out;
console.log(R.length, 'appuis > 8 cm');
for (const s of R.slice(0, 12)) { console.log(`\n— joueur ${s.j} ${s.side} : ${(100 * s.slip).toFixed(0)} cm`); for (const x of s.rows) console.log(JSON.stringify(x)); }
await b.close();
