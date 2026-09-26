// LE BLOC DU GARDIEN, VU DU RENDU : à chaque arrêt « bloc » (keeper.blocCorps), le ballon contre le MEMBRE rendu le plus proche du gardien
// (pieds, orteils, genoux, mains, poitrine, bassin) — le ballon doit frapper un membre, pas le vide ; si le geste était ANTICIPÉ (blocGeste :
// l'acte 'bloc' en cours, son clip) ou réflexe (habillé à son contact). Usage : node bloc-rendu.mjs <url> [secondes=120] [graines=1,2,3,4]
import { chromium } from '../../../../examples/showcase/node_modules/playwright/index.mjs';
const [URL, SECS = '120', GR = '1,2,3,4'] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const L = [];
for (const seed of GR.split(',').map(Number)) {
  const pg = await b.newPage({ viewport: { width: 320, height: 180 } });
  await pg.goto(`${URL}${URL.includes('?') ? '&' : '?'}seed=${seed}`, { waitUntil: 'load', timeout: 240000 });
  await pg.waitForFunction(() => !!window.__scene && window.__scene.players?.length === 4, null, { timeout: 240000 });
  const r = await pg.evaluate((SECS) => {
    const sc = window.__scene, st = sc.state, W = (o) => { const e = o.matrixWorld.elements; return [e[12], e[13], e[14]]; }, out = []; let ne = 0;
    const OS = ['LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase', 'LeftLeg', 'RightLeg', 'LeftHand', 'RightHand', 'Spine2', 'Hips'];
    const B = sc.players.map((pl) => { const f = {}; pl.model.traverse((o) => { if (o.isBone && !f[o.name]) for (const k of OS) if (new RegExp(k + '$').test(o.name) && !f[k]) f[k] = o; }); return f; });
    for (let i = 0; i < SECS * 60; i++) {
      const b0 = [...st.ball.p];   // le ballon AVANT le pas : le bloc le renvoie pendant ce pas
      sc.update(1 / 60);
      while (ne < st.events.length) { const e = st.events[ne++]; if (e.type !== 'arrêt' || e.kind !== 'bloc') continue;
        const j = sc.players.findIndex((pl) => pl.sim.id === e.by), pl = sc.players[j]; pl.model.updateMatrixWorld(true);
        let best = null; for (const k of OS) { const o = B[j][k]; if (!o) continue; const q = W(o), d = Math.hypot(q[0] - b0[0], q[1] - b0[1], q[2] - b0[2]); if (!best || d < best.d) best = { k, d }; }
        out.push({ t: st.t, d: best?.d ?? 9, os: best?.k ?? '?', anticipe: pl.sim.act?.payload?.skill === 'bloc', clip: pl.gestureLayer?.spec?.name ?? '-', h: e.hauteur ?? null }); }
    }
    return out;
  }, +SECS);
  L.push(...r.map((x) => ({ seed, ...x }))); await pg.close(); console.log(`graine ${seed} : ${r.length} blocs`);
}
await b.close();
const q = (xs, f) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(f * (s.length - 1))] : NaN; };
for (const [nom, X] of [['tous', L], ['anticipés', L.filter((x) => x.anticipe)], ['réflexes', L.filter((x) => !x.anticipe)]]) if (X.length)
  console.log(`${nom.padEnd(10)} (${X.length}) : ballon au membre rendu le plus proche ${q(X.map((x) => x.d), 0.5).toFixed(2)} [${q(X.map((x) => x.d), 0.1).toFixed(2)}–${q(X.map((x) => x.d), 0.9).toFixed(2)}] m (${X.filter((x) => x.d <= 0.25).length}/${X.length} ≤ 0,25 m) — membres : ${Object.entries(X.reduce((a, x) => ((a[x.os] = (a[x.os] ?? 0) + 1), a), {})).map(([k, v]) => `${k} ${v}`).join(', ')} — clips : ${Object.entries(X.reduce((a, x) => ((a[x.clip] = (a[x.clip] ?? 0) + 1), a), {})).map(([k, v]) => `${k} ${v}`).join(', ')}`);
