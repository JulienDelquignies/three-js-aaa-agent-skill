// Pendant un passement DANS LA FOULÉE (page) : le pied qui cercle, relativement au BALLON dans le repère du corps (avant, droite, haut) — passe-t-il
// devant le ballon, de dedans à dehors, assez haut ; la vitesse du corps ; le roulis du bassin.
import { chromium } from '../../../../examples/showcase/node_modules/playwright/index.mjs';
const [URL, SECS = '90'] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const pg = await b.newPage({ viewport: { width: 320, height: 180 } });
await pg.goto(URL, { waitUntil: 'load', timeout: 240000 });
await pg.waitForFunction(() => !!window.__scene, null, { timeout: 240000 });
const r = await pg.evaluate((SECS) => { const sc = window.__scene, st = sc.state, V = sc.players[0].model.position.constructor, out = [];
  const bones = sc.players.map((pl) => { const f = {}; pl.model.traverse((o) => { if (!o.isBone) return; for (const k of ['LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase', 'Hips']) if (new RegExp(k + '$').test(o.name) && !f[k]) f[k] = o; }); return f; });
  const a = new V();
  for (let i = 0; i < SECS * 60; i++) { sc.update(1 / 60);
    sc.players.forEach((pl, j) => { const s = pl.sim, F = s.act?.payload?.foulee; if (!F) return; pl.model.updateMatrixWorld(true);
      const v = F.vols.find((x) => st.t >= x.t0 && st.t <= x.t1); if (!v) return;
      const fx = Math.cos(s.yaw), fz = Math.sin(s.yaw), bp = st.ball.p, rel = (x, z) => [(x - bp[0]) * fx + (z - bp[2]) * fz, -(x - bp[0]) * fz + (z - bp[2]) * fx];
      const k = v.pied === 'left' ? 'Left' : 'Right'; bones[j][k + 'ToeBase'].getWorldPosition(a); const toe = [...rel(a.x, a.z), a.y]; bones[j][k + 'Foot'].getWorldPosition(a); const ank = [...rel(a.x, a.z), a.y];
      out.push({ t: +st.t.toFixed(2), j, pied: v.pied, w: +((st.t - v.t0) / (v.t1 - v.t0)).toFixed(2), v: +Math.hypot(s.v[0], s.v[1]).toFixed(1), ballCorps: [+((bp[0] - s.p[0]) * fx + (bp[2] - s.p[2]) * fz).toFixed(2), +(-(bp[0] - s.p[0]) * fz + (bp[2] - s.p[2]) * fx).toFixed(2)], orteil: toe.map((x) => +x.toFixed(2)), cheville: ank.map((x) => +x.toFixed(2)), phase: pl.ctrl._gaitFeet?.[k]?.phase, gw: +(pl.ctrl._gaitGen?.w ?? -1).toFixed(2), gl: !!pl.gestureLayer?.active });
    }); }
  return out; }, +SECS);
await b.close();
for (const x of r) console.log(`t ${x.t} j${x.j} ${x.pied.padEnd(5)} w ${x.w.toFixed(2)} v ${x.v} | ballon/corps ${x.ballCorps} | orteil/ballon (avant, droite, haut) ${x.orteil} | cheville ${x.cheville} | ${x.phase} poidsFoulée ${x.gw} coucheGeste ${x.gl}`);
