// LES TOUCHES DE GESTE, VUES DU RENDU — à chaque touche jouée dans la foulée (événement 'touche', pas 'geste' : la coupe balle au pied, le
// crochet, la feinte, le passement…), le pied rendu qui joue (cheville/orteils) contre le ballon : la distance au plus près dans ±0,08 s de la
// touche (le pied TOUCHE-t-il le ballon ? ≲ 0,15 m du centre), par geste ; et pour la coupe, l'avant-pied de l'APPUI planté au monde.
// Usage : node touche-rendu.mjs <url> [secondes=90] [graines=1,2,3]
import { chromium } from '../../../../examples/showcase/node_modules/playwright/index.mjs';
const [URL, SECS = '90', GR = '1,2,3'] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const R = [];
for (const seed of GR.split(',').map(Number)) {
  const pg = await b.newPage({ viewport: { width: 320, height: 180 } });
  await pg.goto(`${URL}${URL.includes('?') ? '&' : '?'}seed=${seed}`, { waitUntil: 'load', timeout: 400000 });
  await pg.waitForFunction(() => !!window.__scene && window.__scene.players?.length === 4, null, { timeout: 400000 });
  const r = await pg.evaluate((SECS) => { const sc = window.__scene, st = sc.state, out = [], hist = []; let ne = 0;
    const B = sc.players.map((pl) => { const f = {}; pl.model.traverse((o) => { if (o.isBone) for (const k of ['LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase']) if (new RegExp(k + '$').test(o.name) && !f[k]) f[k] = o; }); return f; });
    const W = (o) => { const e = o.matrixWorld.elements; return [e[12], e[13], e[14]]; }, pend = [];
    for (let i = 0; i < SECS * 60; i++) { sc.update(1 / 60);
      const snap = { t: st.t, ball: [...st.ball.p], feet: sc.players.map((pl, j) => { pl.model.updateMatrixWorld(true); return Object.fromEntries(['Left', 'Right'].map((k) => [k, [W(B[j][k + 'Foot']), W(B[j][k + 'ToeBase'])]])); }) };
      hist.push(snap); while (hist.length && st.t - hist[0].t > 0.2) hist.shift();
      while (ne < st.events.length) { const e = st.events[ne++]; if (e.type === 'touche' && e.pas === 'geste') pend.push({ t: st.t, by: sc.players.findIndex((pl) => pl.sim.id === e.by), foot: e.foot === 'left' ? 'Left' : 'Right', geste: e.geste, contactSim: !!e.contact }); }
      for (let k = pend.length - 1; k >= 0; k--) { const P = pend[k]; if (st.t - P.t < 0.08) continue;
        let d = 9; for (const h of hist) if (Math.abs(h.t - P.t) <= 0.08) for (const q of h.feet[P.by][P.foot]) d = Math.min(d, Math.hypot(q[0] - h.ball[0], q[1] - h.ball[1], q[2] - h.ball[2]));
        out.push({ geste: P.geste, d, contactSim: P.contactSim }); pend.splice(k, 1); } }
    return out; }, +SECS);
  R.push(...r); await pg.close(); console.log(`graine ${seed} : ${r.length} touches de geste`);
}
await b.close();
const q = (xs, f) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(f * (s.length - 1))]; };
for (const g of [...new Set(R.map((x) => x.geste))]) { const X = R.filter((x) => x.geste === g), D = X.map((x) => x.d);
  console.log(`${g.padEnd(12)} ${String(X.length).padStart(3)} : pied rendu ↔ ballon au plus près ${q(D, 0.5).toFixed(2)} [${q(D, 0.1).toFixed(2)}–${q(D, 0.9).toFixed(2)}] m — ≤ 0,15 : ${X.filter((x) => x.d <= 0.15).length}/${X.length} ; au contact sim ${X.filter((x) => x.contactSim).length}, au rattrapage ${X.filter((x) => !x.contactSim).length} (rattrapage : ${X.filter((x) => !x.contactSim).length ? q(X.filter((x) => !x.contactSim).map((x) => x.d), 0.5).toFixed(2) : '—'} m)`); }
