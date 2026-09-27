// LE PLONGEON DU GARDIEN, VU DU RENDU — « parfois les gardiens plongent 2 fois sur le même plongeon ». Pour chaque plongeon de la sim (un acte
// 'plongeon' qui commence), 3 s d'images : le clip de la couche de geste et son poids, la chute au sol du rendu (_fallOwns), l'état sim (acte,
// au sol), la hauteur du BASSIN rendu — un plongeon = UNE descente ; deux descentes (le bassin qui remonte de ≥ 0,25 m puis redescend) = le
// double plongeon, et ce qui jouait à chacune. Usage : node plongeon-rendu.mjs <url> [secondes=120] [graines=1,2,3,4]
import { chromium } from '../../../../examples/showcase/node_modules/playwright/index.mjs';
const [URL, SECS = '120', GR = '1,2,3,4'] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const D = [];
for (const seed of GR.split(',').map(Number)) {
  const pg = await b.newPage({ viewport: { width: 320, height: 180 } });
  await pg.goto(`${URL}${URL.includes('?') ? '&' : '?'}seed=${seed}`, { waitUntil: 'load', timeout: 400000 });
  await pg.waitForFunction(() => !!window.__scene && window.__scene.players?.length === 4, null, { timeout: 400000 });
  const r = await pg.evaluate((SECS) => {
    const sc = window.__scene, st = sc.state, out = [], cur = {};
    const hipsOf = (pl) => { let h = null; pl.model.traverse((o) => { if (!h && o.isBone && /Hips$/.test(o.name)) h = o; }); return h; };
    const H = sc.players.map(hipsOf);
    for (let i = 0; i < SECS * 60; i++) {
      sc.update(1 / 60);
      sc.players.forEach((pl, j) => {
        const s = pl.sim; if (!s.keeper) return;
        const plonge = s.act?.payload?.skill === 'plongeon';
        if (plonge && !cur[j]) cur[j] = { seed: null, t0: st.t, move: s.act.id, xs: [] };
        const c = cur[j]; if (!c) return;
        pl.model.updateMatrixWorld(true); const e = H[j].matrixWorld.elements;
        c.xs.push({ t: +(st.t - c.t0).toFixed(3), hy: +e[13].toFixed(3), clip: pl.gestureLayer?.spec?.name ?? null, w: +(pl._wLegs ?? 0).toFixed(2), fall: !!pl._fallOwns, act: s.act?.id ?? null, down: +(s.down ?? 0).toFixed(2), tAct: s.act ? +s.act.t.toFixed(2) : null });
        if (st.t - c.t0 > 3) { out.push(c); cur[j] = null; }
      });
    }
    return out;
  }, +SECS);
  for (const x of r) x.seed = seed; D.push(...r); await pg.close(); console.log(`graine ${seed} : ${r.length} plongeons`);
}
await b.close();
for (const d of D) {
  // les descentes du bassin : un minimum local ≥ 0,25 m sous le maximum qui le précède
  let hiMax = d.xs[0].hy, desc = [], enBas = false, lo = Infinity;
  for (const x of d.xs) { if (!enBas) { hiMax = Math.max(hiMax, x.hy); if (x.hy < hiMax - 0.25) { enBas = true; lo = x.hy; desc.push({ t: x.t, clip: x.clip, fall: x.fall, act: x.act, down: x.down }); } } else { lo = Math.min(lo, x.hy); if (x.hy > lo + 0.25) { enBas = false; hiMax = x.hy; } } }
  const clips = [...new Set(d.xs.map((x) => `${x.clip ?? '—'}${x.fall ? '+chute' : ''}`))].join(' → ');
  console.log(`g${d.seed} t${d.t0.toFixed(1)} ${d.move} : ${desc.length} descente(s) ${desc.map((x) => `@${x.t}s (${x.clip ?? '—'}${x.fall ? ', chute' : ''}, acte ${x.act}, au sol ${x.down})`).join(' ; ')} | clips : ${clips}`);
  if (process.env.BRUT && desc.length > 1) for (const x of d.xs.filter((_, i) => i % 6 === 0)) console.log(`    t${x.t} bassin ${x.hy} clip ${x.clip} w ${x.w} chute ${x.fall} acte ${x.act}@${x.tAct} sol ${x.down}`);
}
