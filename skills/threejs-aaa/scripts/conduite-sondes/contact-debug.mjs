import { chromium } from '../../../../examples/showcase/node_modules/playwright/index.mjs';
const { pasPositions, pasContact } = await import('../../../../examples/showcase/src/engine/pas.js');
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const pg = await b.newPage({ viewport: { width: 320, height: 180 } });
await pg.goto(process.argv[2], { waitUntil: 'load', timeout: 240000 });
await pg.waitForFunction(() => !!window.__scene, null, { timeout: 240000 });
const rows = await pg.evaluate(() => { const sc = window.__scene, st = sc.state, V = sc.players[0].model.position.constructor, out = []; let ne = 0;
  const bones = sc.players.map((pl) => { const f = {}; pl.model.traverse((o) => { if (!o.isBone) return; for (const k of ['LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase']) if (new RegExp(k + '$').test(o.name) && !f[k]) f[k] = o; }); return f; });
  const a = new V(); let prev = null;
  for (let i = 0; i < 90 * 60; i++) {
    const snap = st.players.map((s) => ({ pas: s._pas ? { ...s._pas } : null, p: [...s.p], yaw: s.yaw, legK: s.legK })), ball0 = [...st.ball.p];
    sc.update(1 / 60);
    while (ne < st.events.length) { const e = st.events[ne++]; if (e.type !== 'touche') continue;
      const s = st.players[e.by], pl = sc.players[e.by]; pl.model.updateMatrixWorld(true); const fx = Math.cos(s.yaw), fz = Math.sin(s.yaw), rel = (x, z) => [(x - s.p[0]) * fx + (z - s.p[2]) * fz, -(x - s.p[0]) * fz + (z - s.p[2]) * fx], R = {};
      for (const k of ['LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase']) { bones[e.by][k].getWorldPosition(a); R[k] = rel(a.x, a.z); }
      out.push({ mode: e.pas ?? '-', t: st.t, foot: e.foot, pas: { ...s._pas }, legK: s.legK, p: [...s.p], yaw: s.yaw, ballNow: rel(st.ball.p[0], st.ball.p[2]), ballAvant: rel(ball0[0], ball0[2]), before: snap[e.by], R, steps: sc._simSteps ?? null }); }
  }
  return out; });
await b.close();
const q = (xs, f) => { const a = [...xs].sort((x, y) => x - y); return a.length ? a[Math.floor(f * (a.length - 1))] : NaN; };
const segD = (b, a, c) => { const ux = c[0] - a[0], uz = c[1] - a[1], l2 = ux * ux + uz * uz || 1e-9, t = Math.max(0, Math.min(1, ((b[0] - a[0]) * ux + (b[1] - a[1]) * uz) / l2)); return Math.hypot(b[0] - a[0] - ux * t, b[1] - a[1] - uz * t); };
const by = {}; for (const r of rows) { if (!r.foot) { (by['sans pied'] ??= []).push(NaN); continue; } const f = r.foot === 'left' ? 'Left' : 'Right'; (by[r.mode] ??= []).push(segD(r.ballAvant, r.R[f + 'Foot'], r.R[f + 'ToeBase'])); }
for (const [m, d] of Object.entries(by)) console.log(`mode ${m} : ${d.length} touches, ballon → cou-de-pied RENDU (le pied nommé, image du contact) p50 ${q(d, 0.5).toFixed(2)} p75 ${q(d, 0.75).toFixed(2)} p90 ${q(d, 0.9).toFixed(2)} m (contact : ≤ 0,16)`);
for (const r of rows.filter((r) => r.mode !== 'contact').slice(0, 8)) { const pr = pasPositions({ _pas: r.pas, legK: r.legK }); const f = r.foot === 'left' ? 'Left' : 'Right', cote = r.foot;
  const ct = pasContact({ _pas: r.pas, legK: r.legK }, r.ballAvant[0], r.ballAvant[1]);
  console.log(`t ${r.t.toFixed(2)} ${cote} v ${r.pas.v.toFixed(1)} phi ${r.pas.phi.toFixed(2)} (prev ${r.pas.phiPrev?.toFixed(2)}) | ballon avant-pas ${r.ballAvant.map((x) => x.toFixed(2))} après ${r.ballNow.map((x) => x.toFixed(2))} | pied prédit ch ${pr[cote].ch.map((x) => x.toFixed(2))} or ${pr[cote].or.map((x) => x.toFixed(2))} vol ${pr[cote].vol} | rendu ch ${r.R[f + 'Foot'].map((x) => x.toFixed(2))} or ${r.R[f + 'ToeBase'].map((x) => x.toFixed(2))} | contact recalculé ${ct ? ct.pied + ' ' + ct.d.toFixed(2) : '-'}`); }
