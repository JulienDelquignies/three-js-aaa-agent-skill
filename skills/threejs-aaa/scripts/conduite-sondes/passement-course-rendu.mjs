// LE PASSEMENT EN COURSE, VU DU RENDU (skills-sim.passementFoulee → pas.gesteFouleeStep → character-controller._gesteFouleeOpts → motion-gait
// arcPassement) — à chaque image où le porteur joue un passement dans la foulée : pour le pied en ARC (l'état du contrôleur), la distance 3D
// cheville/orteils ↔ centre du ballon (la jambe cercle sans toucher : ≥ 0,13 m), la cheville au plus haut, le passage DEVANT le ballon ; l'appui
// (l'autre pied au sol) : sa dérive au monde ; la POSTURE de la série (le poids serie, le bassin plus bas qu'à la même allure hors série, les
// mains écartées de l'axe du corps). FORCE (défaut) : l'envie de passement poussée, les séries longues (mesure seulement). Usage :
// node passement-course-rendu.mjs <url> [secondes=90] [graines=1,2,3]
import { chromium } from '../../../../examples/showcase/node_modules/playwright/index.mjs';
const [URL, SECS = '90', GR = '1,2,3'] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const L = [], H = [];
for (const seed of GR.split(',').map(Number)) {
  const pg = await b.newPage({ viewport: { width: 320, height: 180 } });
  await pg.goto(`${URL}${URL.includes('?') ? '&' : '?'}seed=${seed}`, { waitUntil: 'load', timeout: 240000 });
  await pg.waitForFunction(() => !!window.__scene && window.__scene.players?.length === 4, null, { timeout: 240000 });
  const r = await pg.evaluate(([SECS, FORCE]) => {
    const sc = window.__scene, st = sc.state, K = sc._mcfg;
    if (FORCE !== '0' && K?.passements) { K.passements = { ...K.passements, envie: 6, plancher: 1 }; K.skill = { ...K.skill, passementEnchaine: 0.9, passementCd: 1.5 }; }   // (mesure du RENDU : des passements, des séries)
    const W = (o) => { const e = o.matrixWorld.elements; return [e[12], e[13], e[14]]; }, out = [], hors = [];
    const B = sc.players.map((pl) => { const f = {}; pl.model.traverse((o) => { if (o.isBone) for (const k of ['LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase', 'Hips', 'LeftHand', 'RightHand', 'Spine2']) if (new RegExp(k + '$').test(o.name) && !f[k]) f[k] = o; }); return f; });
    for (let i = 0; i < SECS * 60; i++) {
      sc.update(1 / 60);
      sc.players.forEach((pl, j) => {
        const s = pl.sim, A = s.act?.payload; pl.model.updateMatrixWorld(true);
        const hy = W(B[j].Hips)[1], hand = (k) => { const h = W(B[j][k]), sp = W(B[j].Spine2); return Math.hypot(h[0] - sp[0], h[2] - sp[2]); };
        if (A?.foulee && A.skill === 'passement') {
          const bp = st.ball.p, S = pl.ctrl._gesteEtat, F = {};
          const fx = Math.cos(s.yaw), fz = Math.sin(s.yaw), rel = (q) => { const dx = q[0] - bp[0], dz = q[2] - bp[2]; return [-dx * fz + dz * fx, q[1] - bp[1], dx * fx + dz * fz]; };   // (droite, haut, avant) depuis le ballon
          for (const k of ['Left', 'Right']) { const a = W(B[j][k + 'Foot']), t = W(B[j][k + 'ToeBase']), da = Math.hypot(a[0] - bp[0], a[1] - bp[1], a[2] - bp[2]), dt = Math.hypot(t[0] - bp[0], t[1] - bp[1], t[2] - bp[2]);
            F[k] = { a, t, e: S?.[k]?.e, d3: Math.min(da, dt), os: dt < da ? 'orteil' : 'cheville', rel: rel(dt < da ? t : a), u: pl.ctrl._gaitFeet?.[k]?.u, ph: pl.ctrl._gaitFeet?.[k]?.phase }; }
          out.push({ opts: JSON.stringify({ ...pl.ctrl._lastGaitOpts, geste: pl.ctrl._lastGaitOpts?.geste }), phi: pl.ctrl.gait?.phi, vb: pl.ctrl.G?.vBody ? [...pl.ctrl.G.vBody] : null, gv: pl.ctrl._lastGaitOpts?.geste?.balle ? [...pl.ctrl._lastGaitOpts.geste.balle] : null, gp: { Left: pl.ctrl._gaitFeet?.Left?.p ? [...pl.ctrl._gaitFeet.Left.p] : null, Right: pl.ctrl._gaitFeet?.Right?.p ? [...pl.ctrl._gaitFeet.Right.p] : null }, gph: { Left: pl.ctrl._gaitFeet?.Left?.phase, Right: pl.ctrl._gaitFeet?.Right?.phase }, beat: A.foulee.beats.map((b) => b.type[0] + (b.etat ?? '?')[0]).join(''), el: { Left: pl.ctrl._lastGaitOpts?.geste?.Left?.elargi, Right: pl.ctrl._lastGaitOpts?.geste?.Right?.elargi }, j, id: s.id, t: s.act.t, tours: A.tours, F, sp: s.speed, hy, hands: hand('LeftHand') + hand('RightHand'), serie: pl.ctrl._serieW ?? 0, bAv: (bp[0] - s.p[0]) * fx + (bp[2] - s.p[2]) * fz, fAv: { Left: (F.Left.a[0] - s.p[0]) * fx + (F.Left.a[2] - s.p[2]) * fz, Right: (F.Right.a[0] - s.p[0]) * fx + (F.Right.a[2] - s.p[2]) * fz } });
        } else if (st.possession?.carrier === s.id && s.speed > 1.4 && s.speed < 3.2 && !s.act) hors.push({ id: s.id, i, sp: s.speed, hy, hands: hand('LeftHand') + hand('RightHand'), T: { Left: W(B[j].LeftToeBase), Right: W(B[j].RightToeBase) }, ph: { Left: pl.ctrl._gaitFeet?.Left?.phase, Right: pl.ctrl._gaitFeet?.Right?.phase } });
      });
    }
    return { out, hors };
  }, [+SECS, process.env.FORCE ?? '1']);
  L.push(...r.out); H.push(...r.hors); await pg.close(); console.log(`graine ${seed} : ${r.out.length} images de passement en course`);
}
await b.close();
const q = (xs, f) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(f * (s.length - 1))] : NaN; };
const m = (xs, d = 2) => xs.length ? `${q(xs, 0.5).toFixed(d)} [${q(xs, 0.1).toFixed(d)}–${q(xs, 0.9).toFixed(d)}]` : '—';
// les arcs un à un : images consécutives où un pied est en 'arc'
const arcs = []; const cur = {};
const nA = {}; for (const x of L) for (const k of ['Left', 'Right']) { const key = x.id + k; if (x.F[k].e === 'arc') { if (!cur[key]) { const g = x.id + ':' + x.tours; nA[g] = x.t < 0.1 ? 0 : nA[g] ?? 0; nA[g]++; } const c = cur[key] ?? (cur[key] = { k, tours: x.tours, n: nA[x.id + ':' + x.tours], xs: [] }); c.xs.push(x); } else if (cur[key]) { arcs.push(cur[key]); delete cur[key]; } }
const res = arcs.filter((a) => a.xs.length >= 4).map((a) => { const o = a.k === 'Left' ? 'Right' : 'Left', X = a.xs, sol = X.filter((x) => x.F[o].ph !== 'swing'), a0 = sol[0]?.F[o].t;
  const iMin = X.reduce((bi, x, i) => (x.F[a.k].d3 < X[bi].F[a.k].d3 ? i : bi), 0), xm = X[iMin].F[a.k];
  const xx = X[iMin]; if (process.env.OPTS && xx.F[a.k].d3 < 0.13) console.log('OPTS', xx.opts, 'phi', xx.phi, 'vb', JSON.stringify(xx.vb)); return { dbg: `gv ${xx.gv?.map((v) => v.toFixed(2))} pied(gait) ${xx.gp?.[a.k]?.map((v) => v.toFixed(2))} ${xx.gph?.[a.k]} beats ${xx.beat}`, k: a.k, tours: a.tours, nArc: a.n, elargi: X[iMin].el?.[a.k], bAv: X[iMin].bAv, sp: X[iMin].sp, dMin: xm.d3, ou: { f: iMin / Math.max(1, X.length - 1), os: xm.os, rel: xm.rel }, hMax: Math.max(...X.map((x) => x.F[a.k].a[1])), devant: X.some((x) => x.fAv[a.k] > x.bAv - 0.02),
    derive: a0 ? Math.max(...sol.map((x) => Math.hypot(x.F[o].t[0] - a0[0], x.F[o].t[2] - a0[2])), 0) : null, nSol: sol.length }; });
console.log(`${res.length} arcs rendus (dans des passements de ${[...new Set(res.map((r) => r.tours))].sort().join('/')} arcs)`);
console.log(`  la jambe qui cercle au plus près du ballon ${m(res.map((r) => r.dMin))} m (min ${Math.min(...res.map((r) => r.dMin)).toFixed(3)} ; ≥ 0,13 : ${res.filter((r) => r.dMin >= 0.13).length}/${res.length}), cheville au plus haut ${m(res.map((r) => r.hMax))} m, passe devant le ballon ${res.filter((r) => r.devant).length}/${res.length}`);
console.log(`  l'appui (l'autre pied, en phase d'appui du générateur) pendant l'arc : l'AVANT-PIED dérive au monde de ${m(res.filter((r) => r.derive != null).map((r) => r.derive), 3)} m (${res.filter((r) => r.derive != null).length} arcs avec appui)`);
const P = res.filter((r) => r.dMin < 0.13); if (process.env.BRUT) for (const r of P) console.log(`   · ${r.k} arc de ${r.tours}, n° ${r.nArc}, dMin ${r.dMin.toFixed(3)} à ${r.ou.f.toFixed(2)} (${r.ou.os}) rel ${r.ou.rel.map((v) => v.toFixed(2)).join(',')} ; élargi ${r.elargi?.toFixed(2)} ; ballon devant ${r.bAv?.toFixed(2)} m ; allure ${r.sp?.toFixed(1)} | ${r.dbg}`); if (P.length) console.log(`  au plus près (${P.length} arcs < 0,13) : à ${m(P.map((r) => r.ou.f))} de l'arc, ${Object.entries(P.reduce((a, r) => ((a[r.ou.os] = (a[r.ou.os] ?? 0) + 1), a), {})).map(([k, v]) => k + ' ' + v).join(', ')} ; depuis le ballon : droite ${m(P.map((r) => r.ou.rel[0] * (r.k === 'Left' ? -1 : 1)))} (côté du pied +), haut ${m(P.map((r) => r.ou.rel[1]))}, avant ${m(P.map((r) => r.ou.rel[2]))}`);
{ const D = []; const seg = {}; for (const h of H) for (const k of ['Left', 'Right']) { const key = h.id + k, sg = seg[key]; if (h.ph[k] !== 'swing' && sg && h.i === sg.i + 1) { sg.i = h.i; sg.d = Math.max(sg.d, Math.hypot(h.T[k][0] - sg.t0[0], h.T[k][2] - sg.t0[2])); } else { if (sg && sg.n > 3) D.push(sg.d); seg[key] = h.ph[k] !== 'swing' ? { i: h.i, t0: h.T[k], d: 0, n: 0 } : null; } if (seg[key]) seg[key].n++; }
  console.log(`  référence — conduite hors geste 1,4-3,2 m/s : l'avant-pied d'appui dérive de ${m(D, 3)} m par appui (${D.length} appuis)`); }
const S2 = L.filter((x) => x.tours >= 2 && x.serie > 0.8), S1 = L.filter((x) => x.tours === 1);
console.log(`  POSTURE — série (≥ 2 arcs, poids > 0,8 ; ${S2.length} images) : bassin ${m(S2.map((x) => x.hy))} m, mains écartées (somme à l'axe) ${m(S2.map((x) => x.hands))} m, allure ${m(S2.map((x) => x.sp), 1)} ; passement à 1 arc : bassin ${m(S1.map((x) => x.hy))}, mains ${m(S1.map((x) => x.hands))} ; conduite hors geste 1,4-3,2 m/s : bassin ${m(H.map((x) => x.hy))}, mains ${m(H.map((x) => x.hands))}`);
