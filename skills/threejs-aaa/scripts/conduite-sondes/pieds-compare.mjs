// Pieds rendus contre pieds prédits par la sim (pas.js), repère corps de la sim, sur des images de course du porteur.
import { chromium } from '../../../../examples/showcase/node_modules/playwright/index.mjs';
const { pasPositions } = await import('../../../../examples/showcase/src/engine/pas.js');
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const pg = await b.newPage({ viewport: { width: 320, height: 180 } });
await pg.goto(process.argv[2], { waitUntil: 'load', timeout: 240000 });
await pg.waitForFunction(() => !!window.__scene, null, { timeout: 240000 });
const rows = await pg.evaluate(() => { const sc = window.__scene, V = sc.players[0].model.position.constructor, out = [];
  const bones = sc.players.map((pl) => { const f = {}; pl.model.traverse((o) => { if (!o.isBone) return; for (const k of ['LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase']) if (new RegExp(k + '$').test(o.name) && !f[k]) f[k] = o; }); return f; });
  const a = new V();
  for (let i = 0; i < 90 * 60; i++) { sc.update(1 / 60); if (i % 3) continue;
    sc.players.forEach((pl, j) => { const s = pl.sim; if (!s._pas || s.act || s._pas.v < 1 || sc.state.ball.owner !== s.id && sc.state.possession?.carrier !== s.id) return; pl.model.updateMatrixWorld(true);
      const fx = Math.cos(s.yaw), fz = Math.sin(s.yaw), rel = (x, z) => [(x - s.p[0]) * fx + (z - s.p[2]) * fz, -(x - s.p[0]) * fz + (z - s.p[2]) * fx], R = {};
      for (const k of ['LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase']) { bones[j][k].getWorldPosition(a); R[k] = rel(a.x, a.z); }
      out.push({ j, pas: { ...s._pas }, legK: s.legK, R, ph: pl.ctrl._gaitFeet ? { L: pl.ctrl._gaitFeet.Left?.phase, R: pl.ctrl._gaitFeet.Right?.phase } : null }); }); }
  return out; });
await b.close();
const q = (xs, f) => { const s = [...xs].sort((x, y) => x - y); return s[Math.floor(f * (s.length - 1))]; };
const err = { L: [], R: [], LA: [], LD: [], RA: [], RD: [] };
for (const r of rows) { const pr = pasPositions({ _pas: r.pas, legK: r.legK });
  for (const [c, cote] of [['L', 'left'], ['R', 'right']]) { const ch = r.R[c === 'L' ? 'LeftFoot' : 'RightFoot'], p = pr[cote].ch; err[c].push(Math.hypot(ch[0] - p[0], ch[1] - p[1])); err[c + 'A'].push(ch[0] - p[0]); err[c + 'D'].push(ch[1] - p[1]); } }
console.log(rows.length, 'images de porteur ; écart cheville rendue − prédite (m) :');
const bins = {}; rows.forEach((r, i) => { const pr = pasPositions({ _pas: r.pas, legK: r.legK }); const e = Math.max(...['L', 'R'].map((c) => { const ch = r.R[c === 'L' ? 'LeftFoot' : 'RightFoot'], p = pr[c === 'L' ? 'left' : 'right'].ch; return Math.hypot(ch[0] - p[0], ch[1] - p[1]); }));
  const ang = Math.abs(Math.atan2(r.pas.vR, r.pas.vF)) * 180 / Math.PI, k = `v ${r.pas.v < 2 ? '1-2' : r.pas.v < 4 ? '2-4' : '4+'} | cap ${ang < 20 ? '0-20' : ang < 45 ? '20-45' : ang < 90 ? '45-90' : '90+'}° | lacet ${Math.abs(r.pas.yawRate) < 1 ? '<1' : '≥1'}`; (bins[k] ??= []).push(e); });
for (const [k, e] of Object.entries(bins).sort()) console.log(`  ${k.padEnd(34)} n ${String(e.length).padStart(4)} pire pied p50 ${q(e, 0.5).toFixed(2)} p90 ${q(e, 0.9).toFixed(2)}`);
for (const c of ['L', 'R']) console.log(`  ${c} : |écart| p50 ${q(err[c], 0.5).toFixed(2)} p90 ${q(err[c], 0.9).toFixed(2)} ; avant p50 ${q(err[c + 'A'], 0.5).toFixed(2)} ; droite p50 ${q(err[c + 'D'], 0.5).toFixed(2)}`);
for (const r of rows.slice(0, 6)) { const pr = pasPositions({ _pas: r.pas, legK: r.legK }); console.log(`  phi ${r.pas.phi.toFixed(2)} v ${r.pas.v.toFixed(1)} | rendu G ${r.R.LeftFoot.map((x) => x.toFixed(2))} D ${r.R.RightFoot.map((x) => x.toFixed(2))} | prédit G ${pr.left.ch.map((x) => x.toFixed(2))} D ${pr.right.ch.map((x) => x.toFixed(2))} | phases ${JSON.stringify(r.ph)} vol prédit G ${pr.left.vol} D ${pr.right.vol}`); }
