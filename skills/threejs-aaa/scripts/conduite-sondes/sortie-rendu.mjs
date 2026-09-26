// LES SORTIES DE LA TENUE, VUES DU RENDU (face.js : le râteau, la roulette) — à chaque image où le porteur joue rateauFace/rateauFaceIn/
// rouletteFace : le ballon contre CHAQUE pied rendu (cheville/orteils, le plus proche des deux os par pied), la hauteur de la cheville, le
// lacet du corps. Par fenêtre du clip : la semelle droite qui ratisse/tire (contact → fin du tirage), le tour ballon libre, la semelle GAUCHE
// de la roulette (on2 → drag2End) — le pied qui doit être SUR le ballon (≲ 0,1 m à l'horizontale, cheville ≈ 0,2-0,3 m). Le pied gauche
// d'un gaucher est le miroir (le pied « de semelle » est lu dans pick.foot). Usage : node sortie-rendu.mjs <url> [secondes=120] [graines=1,2,3,4]
import { chromium } from '../../../../examples/showcase/node_modules/playwright/index.mjs';
import { SKILL_KINDS } from '../../assets/starter/src/engine/motion-skill.js';
const [URL, SECS = '120', GR = '1,2,3,4'] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const L = [];
for (const seed of GR.split(',').map(Number)) {
  const pg = await b.newPage({ viewport: { width: 320, height: 180 } });
  await pg.goto(`${URL}${URL.includes('?') ? '&' : '?'}seed=${seed}`, { waitUntil: 'load', timeout: 240000 });
  await pg.waitForFunction(() => !!window.__scene && window.__scene.players?.length === 4, null, { timeout: 240000 });
  const r = await pg.evaluate((SECS) => {
    const sc = window.__scene, st = sc.state, W = (o) => { const e = o.matrixWorld.elements; return [e[12], e[13], e[14]]; }, out = [];
    const B = sc.players.map((pl) => { const f = {}; pl.model.traverse((o) => { if (o.isBone) for (const k of ['LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase']) if (new RegExp(k + '$').test(o.name) && !f[k]) f[k] = o; }); return f; });
    for (let i = 0; i < SECS * 60; i++) {
      sc.update(1 / 60);
      const j = sc.players.findIndex((pl) => /^(rateauFace|rateauFaceIn|rouletteFace)$/.test(pl.sim.act?.payload?.skill ?? '')); if (j < 0) continue;
      const pl = sc.players[j], s = pl.sim, A = s.act.payload; pl.model.updateMatrixWorld(true);
      const bp = st.ball.p, pied = {};
      for (const side of ['Left', 'Right']) { let best = null; for (const k of [side + 'Foot', side + 'ToeBase']) { const o = B[j][k]; if (!o) continue; const q = W(o), d = Math.hypot(q[0] - bp[0], q[2] - bp[2]); if (!best || d < best.d) best = { d, h: W(B[j][side + 'Foot'])[1] }; } pied[side] = best; }
      const me = pl.model.matrixWorld.elements, myaw = Math.atan2(me[10], me[8]), dyaw = Math.atan2(Math.sin(myaw - s.yaw), Math.cos(myaw - s.yaw)) * 180 / Math.PI;
      const fx = Math.cos(s.yaw), fz = Math.sin(s.yaw), rx0 = bp[0] - s.p[0], rz0 = bp[2] - s.p[2];
      out.push({ bx: rx0 * -fz + rz0 * fx, bz: rx0 * fx + rz0 * fz, skill: A.skill, t: s.act.t, foot: A.pick?.foot, L: pied.Left, R: pied.Right, dB: Math.hypot(bp[0] - s.p[0], bp[2] - s.p[2]), yaw: s.yaw, v: Math.hypot(s.v[0], s.v[1]), dyaw, dpos: Math.hypot(me[12] - s.p[0], me[14] - s.p[2]), clip: pl.gestureLayer.spec?.name, ct: pl.gestureLayer.t ?? pl.gestureLayer.time });
    }
    return out;
  }, +SECS);
  L.push(...r); await pg.close(); console.log(`graine ${seed} : ${r.length} images de sortie`);
}
await b.close();
if (process.env.BRUT) for (const x of L.filter((x) => x.skill === process.env.BRUT).slice(0, +(process.env.N ?? 60))) console.log(`${x.skill} t${x.t.toFixed(3)} pied ${x.foot} G ${x.L.d.toFixed(2)}@${x.L.h.toFixed(2)} D ${x.R.d.toFixed(2)}@${x.R.h.toFixed(2)} bal-corps ${x.dB.toFixed(2)} lacet ${(x.yaw * 180 / Math.PI).toFixed(0)} v ${x.v.toFixed(1)} | ballon perso x ${x.bx.toFixed(2)} z ${x.bz.toFixed(2)}`);
const q = (xs, f) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(f * (s.length - 1))] : NaN; };
const m = (X, f, d = 2) => X.length ? `${q(X.map(f), 0.5).toFixed(d)} [${q(X.map(f), 0.1).toFixed(d)}–${q(X.map(f), 0.9).toFixed(d)}]` : '—';
// le pied « de semelle » (celui du clip droit) et l'autre, selon le pied du porteur
const sole = (x) => (x.foot === 'left' ? x.L : x.R), autre = (x) => (x.foot === 'left' ? x.R : x.L);
for (const k of ['rateauFace', 'rateauFaceIn', 'rouletteFace']) {
  const X = L.filter((x) => x.skill === k); if (!X.length) continue; const K = SKILL_KINDS[k];
  const fen = k === 'rouletteFace' ? [['semelle 1 (tire)', K.contact, K.drag1End, sole], ['tour, ballon libre', K.drag1End + 0.02, K.on2 - 0.02, (x) => (sole(x).d < autre(x).d ? sole(x) : autre(x))], ['semelle 2 (l\'autre pied)', K.on2 + 0.02, K.drag2End, autre]] : [['semelle (ratisse)', K.contact, K.dragEnd, sole], ['après', K.dragEnd + 0.02, K.duration, sole]];
  console.log(`${k} (${X.length} images) : ballon au corps ${m(X, (x) => x.dB)} m, allure ${m(X, (x) => x.v, 1)} m/s`);
  for (const [nom, t0, t1, f] of fen) { const Y = X.filter((x) => x.t >= t0 && x.t <= t1 && f(x)); console.log(`  ${nom.padEnd(26)} (${Y.length}) : ballon au pied ${m(Y, (x) => f(x).d)} m à l'horizontale, cheville à ${m(Y, (x) => f(x).h)} m`); }
}
