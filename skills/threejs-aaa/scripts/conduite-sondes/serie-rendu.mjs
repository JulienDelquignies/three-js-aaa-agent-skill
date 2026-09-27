// LA SÉRIE DE PASSEMENTS, VUE DU RENDU (face.js, motion-skill passementSerieN) — à chaque image où le porteur joue une série : le ballon contre
// les pieds RENDUS. Par fenêtre du clip : le roulé (la semelle sur le ballon : ≲ 0,1 m à l'horizontale, cheville ≈ 0,3 m), chaque passement (la
// jambe qui passe : distance 3D cheville/orteils ↔ centre du ballon — elle ne le touche pas, ≥ 0,13 m ; au plus haut ; l'appui : sa dérive au
// monde, un appui planté ne glisse pas ≲ 0,03 m), la reprise (la semelle revient sur le ballon). Le pied de semelle est pick.foot (le clip droit,
// miroir pour un gaucher) ; le passement k pair est celui de l'AUTRE pied. FORCE (défaut) : toutes les feintes de la tenue sont des séries
// (mesure seulement). Usage : node serie-rendu.mjs <url> [secondes=90] [graines=1,2,3]
import { chromium } from '../../../../examples/showcase/node_modules/playwright/index.mjs';
import { SKILL_KINDS } from '../../assets/starter/src/engine/motion-skill.js';
const [URL, SECS = '90', GR = '1,2,3'] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const L = [];
for (const seed of GR.split(',').map(Number)) {
  const pg = await b.newPage({ viewport: { width: 320, height: 180 } });
  await pg.goto(`${URL}${URL.includes('?') ? '&' : '?'}seed=${seed}`, { waitUntil: 'load', timeout: 240000 });
  await pg.waitForFunction(() => !!window.__scene && window.__scene.players?.length === 4, null, { timeout: 240000 });
  const r = await pg.evaluate(([SECS, FORCE]) => {
    const sc = window.__scene, st = sc.state, FK = sc._mcfg?.face?.feintes;
    if (FORCE !== '0' && FK?.serie) { FK.passement = { ...FK.passement, p: 5 }; FK.serie = { ...FK.serie, part: 5 }; sc._mcfg.face.patience = [30, 40]; }   // (mesure du RENDU : toutes les feintes en série, le défenseur patient)
    const W = (o) => { const e = o.matrixWorld.elements; return [e[12], e[13], e[14]]; }, out = [];
    const B = sc.players.map((pl) => { const f = {}; pl.model.traverse((o) => { if (o.isBone) for (const k of ['LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase', 'Hips']) if (new RegExp(k + '$').test(o.name) && !f[k]) f[k] = o; }); return f; });
    for (let i = 0; i < SECS * 60; i++) {
      sc.update(1 / 60);
      const j = sc.players.findIndex((pl) => /^passementSerie/.test(pl.sim.act?.payload?.skill ?? '')); if (j < 0) continue;
      const pl = sc.players[j], s = pl.sim, A = s.act.payload; pl.model.updateMatrixWorld(true);
      const bp = st.ball.p, F = {};
      for (const side of ['Left', 'Right']) { const a = W(B[j][side + 'Foot']), t = W(B[j][side + 'ToeBase']); F[side] = { a, t, d3: Math.min(Math.hypot(a[0] - bp[0], a[1] - bp[1], a[2] - bp[2]), Math.hypot(t[0] - bp[0], t[1] - bp[1], t[2] - bp[2])), dh: Math.min(Math.hypot(a[0] - bp[0], a[2] - bp[2]), Math.hypot(t[0] - bp[0], t[2] - bp[2])) }; }
      const h = W(B[j].Hips);
      out.push({ j, id: s.id, skill: A.skill, t: s.act.t, foot: A.pick?.foot, F, hy: h[1], wL: pl._wLegs, by: bp[1], sp: s.speed });
    }
    return out;
  }, [+SECS, process.env.FORCE ?? '1']);
  L.push(...r); await pg.close(); console.log(`graine ${seed} : ${r.length} images de série`);
}
await b.close();
const q = (xs, f) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(f * (s.length - 1))] : NaN; };
const m = (xs, d = 2) => xs.length ? `${q(xs, 0.5).toFixed(d)} [${q(xs, 0.1).toFixed(d)}–${q(xs, 0.9).toFixed(d)}]` : '—';
// les séries une à une (une série : images consécutives du même joueur, t croissant)
const S = []; let cur = null;
for (const x of L) { if (!cur || x.t < cur.last - 1e-6 || x.id !== cur.id || x.skill !== cur.skill) { cur = { id: x.id, skill: x.skill, last: x.t, xs: [] }; S.push(cur); } cur.last = x.t; cur.xs.push(x); }
console.log(`${S.length} séries rendues (${Object.entries(S.reduce((a, s) => ((a[s.skill] = (a[s.skill] ?? 0) + 1), a), {})).map(([k, v]) => `${k} ${v}`).join(', ')}) — jambes au geste (wLegs) ${m(L.map((x) => x.wL ?? 0))}`);
const roll = [], rep = [], pas = [];
for (const s of S) {
  const K = SKILL_KINDS[s.skill], n = K.serie, so = s.xs[0].foot === 'left' ? 'Left' : 'Right', au = so === 'Left' ? 'Right' : 'Left', tA = K.entry + n * K.tour + K.lift;
  for (const x of s.xs) { if (x.t >= 0.02 && x.t <= K.roll) roll.push(x.F[so]); if (x.t >= tA + 0.02 && x.t <= K.duration - 0.02) rep.push(x.F[so]); }
  for (let k = 0; k < n; k++) {
    const t0 = K.entry + k * K.tour, t1 = t0 + K.tour, passe = k % 2 === 0 ? au : so, appui = passe === so ? au : so, X = s.xs.filter((x) => x.t >= t0 && x.t <= t1); if (X.length < 5) continue;
    const a0 = X[0].F[appui].a, derive = Math.max(...X.map((x) => Math.hypot(x.F[appui].a[0] - a0[0], x.F[appui].a[2] - a0[2])));
    pas.push({ k, dMin: Math.min(...X.map((x) => x.F[passe].d3)), hMax: Math.max(...X.map((x) => x.F[passe].a[1])), derive, appuiH: Math.max(...X.map((x) => x.F[appui].a[1])), bond: Math.max(...X.map((x) => x.hy)) - Math.min(...X.map((x) => x.hy)) });
  }
}
console.log(`  le roulé (semelle sur le ballon, ${roll.length} images) : pied ↔ ballon ${m(roll.map((f) => f.dh))} m à l'horizontale, cheville à ${m(roll.map((f) => f.a[1]))} m`);
console.log(`  la reprise (${rep.length} images) : pied ↔ ballon ${m(rep.map((f) => f.dh))} m à l'horizontale, cheville à ${m(rep.map((f) => f.a[1]))} m`);
console.log(`  les passements (${pas.length}) : la jambe qui passe au plus près du ballon ${m(pas.map((p) => p.dMin))} m (min ${Math.min(...pas.map((p) => p.dMin)).toFixed(3)} ; ≥ 0,13 : ${pas.filter((p) => p.dMin >= 0.13).length}/${pas.length}), cheville au plus haut ${m(pas.map((p) => p.hMax))} m`);
console.log(`    l'appui : dérive au monde ${m(pas.map((p) => p.derive), 3)} m (max ${Math.max(...pas.map((p) => p.derive)).toFixed(3)}), cheville d'appui au plus haut ${m(pas.map((p) => p.appuiH))} m ; le bassin bondit de ${m(pas.map((p) => p.bond), 3)} m`);
for (let k = 0; k < 4; k++) { const P = pas.filter((p) => p.k === k); if (P.length) console.log(`    passement ${k + 1} (${P.length}) : au plus près ${m(P.map((p) => p.dMin))} m, au plus haut ${m(P.map((p) => p.hMax))} m, appui ${m(P.map((p) => p.derive), 3)} m`); }
