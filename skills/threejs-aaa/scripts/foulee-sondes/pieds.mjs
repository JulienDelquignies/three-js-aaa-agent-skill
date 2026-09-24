// LES PIEDS TRAÎNENT ? Mesure sur le squelette RENDU (scène réelle, sans rendu d'image) :
//   glissement d'appui : vitesse horizontale du pied quand il est au sol (devrait être ≈ 0)
//   dégagement : hauteur max du pied entre deux appuis (un pied qui ne se lève pas « traîne »)
// ventilé par allure du corps (sim) : lent < 1,5 m/s, trot 1,5-4, course > 4.
import { chromium } from '../../../../examples/showcase/node_modules/playwright/index.mjs';
const VARIANT = process.env.VARIANT || 'base'; const pages = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const url of pages) {
  const pg = await b.newPage({ viewport: { width: 640, height: 360 } });
  await pg.goto(url, { waitUntil: 'load', timeout: 180000 });
  await pg.waitForFunction(() => !!window.__scene && window.__scene.players?.length > 0, null, { timeout: 180000 });
  const r = await pg.evaluate(async (VARIANT) => {
    const sc = window.__scene, dt = 1 / 60, N = 60 * 22, SKIP = 60 * 2;
    for (const pl of sc.players) {
      if (VARIANT.includes('lean')) pl.ctrl._applyLean = () => {};
      if (VARIANT.includes('lock')) pl.ctrl.footLock = null;
      if (VARIANT.includes('gaze') && pl.gaze) pl.gaze.update = () => {};
    }
    const V = sc.players[0].model.position.constructor;
    const feet = sc.players.map((pl) => { const f = {}; pl.model.traverse((o) => { if (o.isBone) { if (/LeftToeBase$/.test(o.name)) f.L = o; if (/RightToeBase$/.test(o.name)) f.R = o; if (/LeftFoot$/.test(o.name)) f.LA = o; if (/RightFoot$/.test(o.name)) f.RA = o; } }); return f; });
    const rec = [];   // [joueur][pied] -> [{y, x, z, v}]
    const tmp = new V();
    for (let i = 0; i < N; i++) {
      sc.update(dt);
      if (i < SKIP) continue;
      sc.players.forEach((pl, j) => {
        pl.model.updateMatrixWorld(true);
        for (const k of ['L', 'R', 'LA', 'RA']) {
          const bone = feet[j][k]; if (!bone) continue;
          bone.getWorldPosition(tmp);
          ((rec[j] ??= {})[k] ??= []).push({ x: tmp.x, y: tmp.y, z: tmp.z, bx: pl.sim?.p?.[0] ?? 0, bz: pl.sim?.p?.[2] ?? 0, v: pl.sim?.speed ?? 0, act: !!pl.sim?.act, down: (pl.sim?.down ?? 0) > 0, lk: pl.ctrl?.footLock?.state?.[k.startsWith('L') ? 0 : 1]?.w ?? -1 });
        }
      });
    }
    // analyse : un CONTACT = fenêtre de ≥ 4 images où le pied est à moins de 2,5 cm de SON sol (p5 de sa hauteur hors geste/chute)
    const bucket = (v) => (v < 1.5 ? 'lent' : v < 4 ? 'trot' : 'course');
    const res = {};
    for (const set of [['L', 'R'], ['LA', 'RA']]) {
    const G = { lent: { slip: [], ratio: [], clear: [], lk: [] }, trot: { slip: [], ratio: [], clear: [], lk: [] }, course: { slip: [], ratio: [], clear: [], lk: [] } };
    sc.players.forEach((pl, j) => { for (const k of set) {
      const s = rec[j]?.[k]; if (!s) continue;
      const ys = s.filter((p) => !p.act && !p.down).map((p) => p.y).sort((a, b) => a - b); if (ys.length < 30) continue;
      const sol = ys[Math.floor(0.05 * ys.length)] + 0.025;
      let w = null, peak = -1;
      const close = (end) => { if (w && end - w.i0 >= 4 && !w.bad) { const a = s[w.i0], c = s[end - 1];
          const slip = Math.hypot(c.x - a.x, c.z - a.z), body = Math.hypot(c.bx - a.bx, c.bz - a.bz), g = bucket(w.vmax);
          G[g].slip.push(slip); { const bl = body || 1; (G[g].sgn ??= []).push(((c.x - a.x) * (c.bx - a.bx) + (c.z - a.z) * (c.bz - a.bz)) / bl); } if (body > 0.05) G[g].ratio.push(slip / body); if (w.peak >= 0) G[g].clear.push(w.peak - (sol - 0.025));
          let lk = 0; for (let t = w.i0; t < end; t++) lk += s[t].lk; G[g].lk.push(lk / (end - w.i0)); } w = null; };
      for (let i = 0; i < s.length; i++) { const c = s[i];
        if (c.y < sol) { if (!w) w = { i0: i, vmax: 0, bad: false, peak }; w.vmax = Math.max(w.vmax, c.v); if (c.act || c.down) w.bad = true; peak = -1; }
        else { close(i); peak = Math.max(peak, c.y); } }
      close(s.length);
    } });
    const q = (xs, f) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(f * (s.length - 1))] : NaN; };
    const out = {};
    for (const g of ['lent', 'trot', 'course']) out[g] = { n: G[g].slip.length, slip50: +(100 * q(G[g].slip, 0.5)).toFixed(1), slip90: +(100 * q(G[g].slip, 0.9)).toFixed(1), ratio50: +(100 * q(G[g].ratio, 0.5)).toFixed(0), clear50: +(100 * q(G[g].clear, 0.5)).toFixed(1), lk: +q(G[g].lk, 0.5).toFixed(2), sgn50: +(100 * q(G[g].sgn ?? [], 0.5)).toFixed(1) };
    res[set[0] === 'L' ? 'orteil' : 'cheville'] = out; }
    return { joueurs: sc.players.length, res };
  }, VARIANT);
  console.log(url.split('/').pop().split('&')[0], `(${r.joueurs} joueurs) VARIANTE ${VARIANT}`);
  for (const [os, out] of Object.entries(r.res)) for (const [g, o] of Object.entries(out)) console.log(`  ${os.padEnd(8)} ${g.padEnd(6)} ${String(o.n).padStart(4)} contacts : glisse p50 ${o.slip50} cm / p90 ${o.slip90} cm (${o.ratio50} % du trajet du corps) | levé p50 ${o.clear50} cm | poids du verrou p50 ${o.lk} | sens : ${o.sgn50} cm le long du corps (+ = entraîné vers l'avant)`);
  await pg.close();
}
await b.close();
