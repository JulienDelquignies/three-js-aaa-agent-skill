// LES SORTIES DE LA TENUE, VUES DU RENDU (face.js : le râteau, la roulette) — à chaque image où le porteur joue rateauFace/rateauFaceIn/
// rouletteFace : le ballon contre CHAQUE pied rendu (cheville/orteils, le plus proche des deux os par pied), la hauteur de la cheville, le
// lacet du corps. Par fenêtre du clip : la semelle droite qui ratisse/tire (contact → fin du tirage), le tour ballon libre, la semelle GAUCHE
// de la roulette (on2 → drag2End) — le pied qui doit être SUR le ballon (≲ 0,1 m à l'horizontale, cheville ≈ 0,2-0,3 m). Le pied gauche
// d'un gaucher est le miroir (le pied « de semelle » est lu dans pick.foot). Et la ROULETTE EN COURSE (rouletteCourse : l'approche freinée, puis
// la même) — FORCE=1 pousse cfg.skill.rouletteCourse.envie (mesure seulement) ; le GLISSEMENT des appuis : le pied planté, au monde, par phase.
// Usage : node sortie-rendu.mjs <url> [secondes=120] [graines=1,2,3,4]
import { chromium } from '../../../../examples/showcase/node_modules/playwright/index.mjs';
import { SKILL_KINDS } from '../../assets/starter/src/engine/motion-skill.js';
const [URL, SECS = '120', GR = '1,2,3,4'] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const L = [];
for (const seed of GR.split(',').map(Number)) {
  const pg = await b.newPage({ viewport: { width: 320, height: 180 } });
  await pg.goto(`${URL}${URL.includes('?') ? '&' : '?'}seed=${seed}`, { waitUntil: 'load', timeout: 240000 });
  await pg.waitForFunction(() => !!window.__scene && window.__scene.players?.length === 4, null, { timeout: 240000 });
  const r = await pg.evaluate(([SECS, FORCE]) => {
    const sc = window.__scene, st = sc.state; if (FORCE && sc._mcfg?.skill?.rouletteCourse) { sc._mcfg.skill.rouletteCourse = { ...sc._mcfg.skill.rouletteCourse, envie: 60, ...(FORCE === 'pied' ? { ancre: 'pied' } : {}) }; sc._mcfg.noyau = null; }   // (mesure du RENDU : le noyau coupé, les gestes vont au bout)
    const W = (o) => { const e = o.matrixWorld.elements; return [e[12], e[13], e[14]]; }, out = [];
    const B = sc.players.map((pl) => { const f = {}; pl.model.traverse((o) => { if (o.isBone) for (const k of ['LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase', 'Hips']) if (new RegExp(k + '$').test(o.name) && !f[k]) f[k] = o; }); return f; });
    for (let i = 0; i < SECS * 60; i++) {
      sc.update(1 / 60);
      const j = sc.players.findIndex((pl) => /^(rateauFace|rateauFaceIn|rouletteFace|rouletteCourse)$/.test(pl.sim.act?.payload?.skill ?? '')); if (j < 0) continue;
      const pl = sc.players[j], s = pl.sim, A = s.act.payload; pl.model.updateMatrixWorld(true);
      const bp = st.ball.p, pied = {};
      const wp = {}, wt = {}; for (const side of ['Left', 'Right']) { const o = B[j][side + 'Foot'], o2 = B[j][side + 'ToeBase']; if (o) { const q = W(o); wp[side] = [q[0], q[2]]; } if (o2) { const q = W(o2); wt[side] = [q[0], q[2]]; } }
      for (const side of ['Left', 'Right']) { let best = null; for (const k of [side + 'Foot', side + 'ToeBase']) { const o = B[j][k]; if (!o) continue; const q = W(o), d = Math.hypot(q[0] - bp[0], q[2] - bp[2]); if (!best || d < best.d) best = { d, h: W(B[j][side + 'Foot'])[1] }; } pied[side] = best; }
      const me = pl.model.matrixWorld.elements, myaw = Math.atan2(me[10], me[8]), dyaw = Math.atan2(Math.sin(myaw - s.yaw), Math.cos(myaw - s.yaw)) * 180 / Math.PI;
      const fx = Math.cos(s.yaw), fz = Math.sin(s.yaw), rx0 = bp[0] - s.p[0], rz0 = bp[2] - s.p[2];
      const other = sc.players.filter((o, oi) => oi !== j && o.sim.team !== s.team).map((o) => Math.hypot(o.sim.p[0] - s.p[0], o.sim.p[2] - s.p[2])).reduce((a, b) => Math.min(a, b), 9);
      const Sx = A.face ?? A.course, anc = s.act.payload._anc ? [...s.act.payload._anc] : null, lock = pl.ctrl.footLock?.state?.map((fs) => +(fs.w ?? 0).toFixed(2));
      const hq = B[j].Hips ? W(B[j].Hips) : null;
      out.push({ hips: hq ? [hq[0], hq[2]] : null, wL: pl._wLegs, clipN: pl.gestureLayer.spec?.name, jam: (A.face ?? A.course)?.jambes, wt, anc, lock, piv: s.act.payload._piv, other, sp: [s.p[0], s.p[2]], wp, j, bx: rx0 * -fz + rz0 * fx, bz: rx0 * fx + rz0 * fz, skill: A.skill, t: s.act.t, foot: A.pick?.foot, L: pied.Left, R: pied.Right, dB: Math.hypot(bp[0] - s.p[0], bp[2] - s.p[2]), yaw: s.yaw, v: Math.hypot(s.v[0], s.v[1]), dyaw, dpos: Math.hypot(me[12] - s.p[0], me[14] - s.p[2]), clip: pl.gestureLayer.spec?.name, ct: pl.gestureLayer.t ?? pl.gestureLayer.time });
    }
    return out;
  }, [+SECS, process.env.FORCE ?? '']);
  L.push(...r); await pg.close(); console.log(`graine ${seed} : ${r.length} images de sortie`);
}
await b.close();
if (process.env.BRUT) for (const x of L.filter((x) => x.skill === process.env.BRUT).slice(0, +(process.env.N ?? 60))) console.log(`${x.skill} t${x.t.toFixed(3)} pied ${x.foot} G ${x.L.d.toFixed(2)}@${x.L.h.toFixed(2)} D ${x.R.d.toFixed(2)}@${x.R.h.toFixed(2)} bal-corps ${x.dB.toFixed(2)} lacet ${(x.yaw * 180 / Math.PI).toFixed(0)} v ${x.v.toFixed(1)} | ballon perso x ${x.bx.toFixed(2)} z ${x.bz.toFixed(2)} | piedG ${x.wp.Left?.map((v) => v.toFixed(2))} piedD ${x.wp.Right?.map((v) => v.toFixed(2))} corps ${x.sp.map((v) => v.toFixed(2))} rendu−sim ${x.dpos.toFixed(3)} adv ${x.other.toFixed(2)} | ancre${x.piv} ${x.anc?.map((v) => v.toFixed(2))} verrou ${x.lock} | local avant-pied G ${x.wt?.Left ? (() => { const f = Math.cos(x.yaw), g = Math.sin(x.yaw), dx = x.wt.Left[0] - x.sp[0], dz = x.wt.Left[1] - x.sp[1]; return (dx * -g + dz * f).toFixed(3) + ',' + (dx * f + dz * g).toFixed(3); })() : '-'} D ${x.wt?.Right ? (() => { const f = Math.cos(x.yaw), g = Math.sin(x.yaw), dx = x.wt.Right[0] - x.sp[0], dz = x.wt.Right[1] - x.sp[1]; return (dx * -g + dz * f).toFixed(3) + ',' + (dx * f + dz * g).toFixed(3); })() : '-'} | bassin ${x.hips ? (() => { const f = Math.cos(x.yaw), g = Math.sin(x.yaw), dx = x.hips[0] - x.sp[0], dz = x.hips[1] - x.sp[1]; return (dx * -g + dz * f).toFixed(3) + ',' + (dx * f + dz * g).toFixed(3); })() : '-'} | cheville G ${x.wp?.Left ? (() => { const f = Math.cos(x.yaw), g = Math.sin(x.yaw), dx = x.wp.Left[0] - x.sp[0], dz = x.wp.Left[1] - x.sp[1]; return (dx * -g + dz * f).toFixed(3) + ',' + (dx * f + dz * g).toFixed(3); })() : '-'}`);
const q = (xs, f) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(f * (s.length - 1))] : NaN; };
const m = (X, f, d = 2) => X.length ? `${q(X.map(f), 0.5).toFixed(d)} [${q(X.map(f), 0.1).toFixed(d)}–${q(X.map(f), 0.9).toFixed(d)}]` : '—';
// le pied « de semelle » (celui du clip droit) et l'autre, selon le pied du porteur
const sole = (x) => (x.foot === 'left' ? x.L : x.R), autre = (x) => (x.foot === 'left' ? x.R : x.L);
for (const k of ['rateauFace', 'rateauFaceIn', 'rouletteFace', 'rouletteCourse']) {
  const X = L.filter((x) => x.skill === k); if (!X.length) continue; const K = SKILL_KINDS[k];
  const fen = /^roulette/.test(k) ? [...(k === 'rouletteCourse' ? [['approche (freine)', 0, K.contact, sole]] : []), ['semelle 1 (tire)', K.contact, K.drag1End, sole], ['tour, ballon libre', K.drag1End + 0.02, K.on2 - 0.02, (x) => (sole(x).d < autre(x).d ? sole(x) : autre(x))], ['semelle 2 (l\'autre pied)', K.on2 + 0.02, K.drag2End, autre]] : [['semelle (ratisse)', K.contact, K.dragEnd, sole], ['après', K.dragEnd + 0.02, K.duration, sole]];
  console.log(`${k} (${X.length} images) : ballon au corps ${m(X, (x) => x.dB)} m, allure ${m(X, (x) => x.v, 1)} m/s`);
  for (const [nom, t0, t1, f] of fen) { const Y = X.filter((x) => x.t >= t0 && x.t <= t1 && f(x)); console.log(`  ${nom.padEnd(26)} (${Y.length}) : ballon au pied ${m(Y, (x) => f(x).d)} m à l'horizontale, cheville à ${m(Y, (x) => f(x).h)} m`); }
}
// LE GLISSEMENT DES APPUIS (roulette) : par geste joué, le pied planté au monde — l'autre pied de [début, plantR], le pied de semelle reposé de
// [plantR + 0,02, drag2End] — la dérive horizontale max depuis le début de la fenêtre (un appui planté ne glisse pas : ≲ 0,03 m)
for (const k of ['rouletteFace', 'rouletteCourse']) {
  const K = SKILL_KINDS[k], X = L.filter((x) => x.skill === k); if (!X.length) continue; const ges = []; let cur = null;
  for (const x of X) { if (!cur || x.t < cur.last - 1e-6 || x.j !== cur.j) { cur = { j: x.j, last: x.t, xs: [] }; ges.push(cur); } cur.last = x.t; cur.xs.push(x); }
  const derive = (xs, t0, t1, side, k = 'wp') => { const Y = xs.filter((x) => x.t >= t0 && x.t <= t1 && x[k]?.[side]); if (Y.length < 2) return null; const a = Y[0][k][side]; return Math.max(...Y.map((y) => Math.hypot(y[k][side][0] - a[0], y[k][side][1] - a[1]))); };
  const res = ges.map((g) => { const so = g.xs[0].foot === 'left' ? 'Left' : 'Right', au = so === 'Left' ? 'Right' : 'Left'; return { app: derive(g.xs, 0, K.contact, au), a: derive(g.xs, K.contact, K.plantR, au), b: derive(g.xs, K.plantR + 0.02, K.drag2End, so), aT: derive(g.xs, K.contact, K.plantR, au, 'wt'), bT: derive(g.xs, K.plantR + 0.02, K.drag2End, so, 'wt') }; });
  const f = (key) => { const v = res.map((r) => r[key]).filter((v) => v != null); return v.length ? `${q(v, 0.5).toFixed(3)} [max ${Math.max(...v).toFixed(3)}]` : '—'; };
  console.log(`${k} — ${ges.length} gestes, glissement de l'appui : ${k === 'rouletteCourse' ? `approche ${f('app')} m, ` : ''}1er appui ${f('a')} m, 2e appui (pied de semelle reposé) ${f('b')} m — à l'AVANT-PIED (le pivot vrai) : 1er ${f('aT')} m, 2e ${f('bT')} m`);
}
