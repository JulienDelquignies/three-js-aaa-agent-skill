// LE BASSIN QUI TOMBE SANS RAISON (rendu) — pour chaque joueur, les images où le bassin rendu passe sous `seuil` m alors qu'aucun geste ne
// joue (couche de geste inactive ou fondue), que la sim ne le dit pas au sol et qu'il ne chute pas : l'enjambée hors de portée (le pied que
// l'IK ne peut atteindre, le bassin descend le chercher). Usage : node bassin-chute.mjs <url> [secondes=120] [graines=1,2,3] [seuil=0.55]
import { chromium } from '../../../../examples/showcase/node_modules/playwright/index.mjs';
const [URL, SECS = '120', GR = '1,2,3', SEUIL = '0.55'] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let tot = 0; const E = [];
for (const seed of GR.split(',').map(Number)) {
  const pg = await b.newPage({ viewport: { width: 320, height: 180 } });
  await pg.goto(`${URL}${URL.includes('?') ? '&' : '?'}seed=${seed}`, { waitUntil: 'load', timeout: 400000 });
  await pg.waitForFunction(() => !!window.__scene && window.__scene.players?.length === 4, null, { timeout: 400000 });
  const r = await pg.evaluate(([SECS, SEUIL]) => { const sc = window.__scene, st = sc.state, out = []; let n = 0;
    const H = sc.players.map((pl) => { let h = null; pl.model.traverse((o) => { if (!h && o.isBone && /Hips$/.test(o.name)) h = o; }); return h; });
    for (let i = 0; i < SECS * 60; i++) { sc.update(1 / 60);
      sc.players.forEach((pl, j) => { n++; pl.model.updateMatrixWorld(true); const hy = H[j].matrixWorld.elements[13] - (pl.model.position.y ?? 0);
        const geste = pl.gestureLayer?.active && (pl._wLegs ?? 0) > 0.05, sol = (pl.sim.down ?? 0) > 0 || pl._fallOwns || pl.ctrl.seated;
        if (hy < SEUIL && !geste && !sol) out.push({ t: +st.t.toFixed(2), id: pl.sim.id, gk: !!pl.sim.keeper, hy: +hy.toFixed(3), v: +(pl.ctrl.groundSpeed ?? 0).toFixed(2), vs: +(pl.sim.speed ?? 0).toFixed(2), reach: ['Left', 'Right'].map((k) => pl.ctrl._gaitFeet?.[k]?.reachable) }); }); }
    return { out, n }; }, [+SECS, +SEUIL]);
  tot += r.n; for (const x of r.out) x.seed = seed; E.push(...r.out); await pg.close(); console.log(`graine ${seed} : ${r.out.length} images de bassin tombé`);
}
await b.close();
console.log(`${E.length} images sur ${tot} (joueur × image) avec le bassin sous ${SEUIL} m sans geste ni chute`);
const ev = []; for (const x of E) { const L = ev[ev.length - 1]; if (L && L.seed === x.seed && L.id === x.id && x.t - L.t1 < 0.05) { L.t1 = x.t; L.n++; L.min = Math.min(L.min, x.hy); } else ev.push({ ...x, t1: x.t, n: 1, min: x.hy }); }
for (const e of ev.slice(0, 15)) console.log(` · g${e.seed} t${e.t} joueur ${e.id}${e.gk ? ' (gardien)' : ''} : ${e.n} images, bassin au plus bas ${e.min} m, allure rendue ${e.v} / sim ${e.vs}, pieds atteignables ${e.reach}`);
