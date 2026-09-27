// LES COUPES, VUES DU RENDU (coupe.js : les virages en changement d'appui) — pour chaque appui de coupe (p._coupe.etat 'appui'), le pied
// PLANTÉ rendu : son glissement au monde pendant l'appui (cheville et avant-pied — un appui qui pousse ne glisse pas : ≲ 3-4 cm), son écart
// LATÉRAL au bassin à la pose (repère de la course d'approche, vers l'extérieur du virage : la jambe qui pousse de côté se pose loin — la
// physique : ~0,5-0,6 m à 5 m/s pour 45°, Brault 2010 ≈ 0,6 m à la feinte), la hauteur de la cheville (au sol), et l'angle de la coupe.
// Usage : node coupe-rendu.mjs <url> [secondes=60] [graines=1,2,3]
import { chromium } from '../../../../examples/showcase/node_modules/playwright/index.mjs';
const [URL, SECS = '60', GR = '1,2,3'] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const R = [];
for (const seed of GR.split(',').map(Number)) {
  const pg = await b.newPage({ viewport: { width: 320, height: 180 } });
  await pg.goto(`${URL}${URL.includes('?') ? '&' : '?'}seed=${seed}`, { waitUntil: 'load', timeout: 240000 });
  await pg.waitForFunction(() => !!window.__scene && window.__scene.players?.length === 4, null, { timeout: 240000 });
  const r = await pg.evaluate((SECS) => {
    const sc = window.__scene, W = (o) => { const e = o.matrixWorld.elements; return [e[12], e[13], e[14]]; }, out = [], cur = new Map();
    const B = sc.players.map((pl) => { const f = {}; pl.model.traverse((o) => { if (o.isBone) for (const k of ['LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase', 'Hips']) if (new RegExp(k + '$').test(o.name) && !f[k]) f[k] = o; }); return f; });
    for (let i = 0; i < SECS * 60; i++) {
      sc.update(1 / 60);
      sc.players.forEach((pl, j) => { const s = pl.sim, C = s._coupe;
        if (!C || C.etat !== 'appui') { const o = cur.get(j); if (o) { out.push(o); cur.delete(j); } return; }
        pl.model.updateMatrixWorld(true); const S = C.pied === 'left' ? 'Left' : 'Right', fo = W(B[j][S + 'Foot']), to = W(B[j][S + 'ToeBase']), hB = pl.gestureLayer?.bones?.get('Hips'), hi = hB ? W(hB) : W(B[j].Hips);
        let o = cur.get(j); if (!o || o.tA !== C.tA) { if (o) out.push(o); o = { tA: C.tA, ang: Math.abs(C.dA) * 180 / Math.PI, v: C.vApp, pied: C.pied, from: C.fromA, cote: C.cote, f0: fo, t0: to, lat: null, hMax: 0, dF: 0, dT: 0, n: 0 };
          const rx = -Math.sin(C.fromA), rz = Math.cos(C.fromA);   // la droite de la course d'approche (repère sim : droite = (−sin, cos))
          o.lat = ((fo[0] - hi[0]) * rx + (fo[2] - hi[2]) * rz) * (C.pied === 'right' ? 1 : -1);   // vers l'extérieur (le côté du pied planté)
          cur.set(j, o); }
        if (o.n < 40) (o.trace ??= []).push(`${(sc.state.t - C.tA).toFixed(2)} h${fo[1].toFixed(2)} glisse${Math.hypot(to[0] - o.t0[0], to[2] - o.t0[2]).toFixed(2)} bassinY${hi[1].toFixed(2)} hanche-cheville${Math.hypot(fo[0] - hi[0], fo[1] - hi[1], fo[2] - hi[2]).toFixed(2)} ancre${(() => { const L = pl.ctrl.footLock?.state?.[C.pied === 'left' ? 0 : 1]; return L ? [L.dx, L.dz].map((x) => (x ?? NaN).toFixed(2)).join(',') + ' drv' + L.driven : '-'; })()} plant${(() => { const a = pl.ctrl._plants?.[C.pied === 'left' ? 'Left' : 'Right']; return a ? a.w.map((x) => x.toFixed(2)).join(',') : 'null'; })()} coupeK${pl.ctrl.pasFinal?.coupe?.k ?? '-'} pied${fo[0].toFixed(2)},${fo[2].toFixed(2)} v${Math.hypot(s.v[0], s.v[1]).toFixed(1)} verrou${(pl.ctrl.footLock?.state?.[C.pied === 'left' ? 0 : 1]?.w ?? -1).toFixed(2)}`);
        o.n++; o.dF = Math.max(o.dF, Math.hypot(fo[0] - o.f0[0], fo[2] - o.f0[2])); o.dT = Math.max(o.dT, Math.hypot(to[0] - o.t0[0], to[2] - o.t0[2])); o.hMax = Math.max(o.hMax, fo[1]);
      });
    }
    for (const o of cur.values()) out.push(o); return out;
  }, +SECS);
  R.push(...r); await pg.close(); console.log(`graine ${seed} : ${r.length} appuis de coupe`);
}
await b.close();
if (process.env.BRUT) for (const o of R.filter((x) => x.dT > 0.12).slice(0, +process.env.BRUT)) console.log(`coupe ${o.ang.toFixed(0)}° pied ${o.pied} glisse ${o.dF.toFixed(2)} : ${(o.trace ?? []).filter((_, i) => i % 2 === 0).join(' | ')}`);
const q = (xs, f) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(f * (s.length - 1))] : NaN; };
const m = (X, f, d = 2) => X.length ? `${q(X.map(f), 0.5).toFixed(d)} [${q(X.map(f), 0.1).toFixed(d)}–${q(X.map(f), 0.9).toFixed(d)}]` : '—';
for (const [nom, X] of [['35-60°', R.filter((o) => o.ang < 60)], ['60-110°', R.filter((o) => o.ang >= 60 && o.ang < 110)], ['≥ 110°', R.filter((o) => o.ang >= 110)], ['< 3 m/s', R.filter((o) => o.v < 3)], ['3-4 m/s', R.filter((o) => o.v >= 3 && o.v < 4)], ['≥ 4 m/s', R.filter((o) => o.v >= 4)]])
  console.log(`${nom.padEnd(8)} ${String(X.length).padStart(3)} appuis (${m(X, (o) => o.n / 60)} s) : glissement cheville ${m(X, (o) => o.dF)} m, avant-pied ${m(X, (o) => o.dT)} m ; pose à ${m(X, (o) => o.lat)} m du bassin vers l'extérieur ; cheville au plus haut ${m(X, (o) => o.hMax)} m ; approche ${m(X, (o) => o.v, 1)} m/s`);
