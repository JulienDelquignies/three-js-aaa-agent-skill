// LE PIVOT DU CORPS, VU DU RENDU — pendant les gestes qui tournent le corps (râteau, passes, coupes…) : le lacet du MODÈLE rendu (bassin, repère
// monde) contre le lacet de la sim, image par image — l'angle tourné, la durée 10→90 % de la rotation, le taux au plus fort, le retard du rendu ;
// et la vitesse du corps au monde (la course continue-t-elle pendant le pivot : le corps de biais). Usage : node pivot-rendu.mjs <url> [s=90] [graines=1,2,3] [regex d'acte]
import { chromium } from '../../../../examples/showcase/node_modules/playwright/index.mjs';
const [URL, SECS = '90', GR = '1,2,3', RX = '^(rateau|passe)'] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const G = [];
for (const seed of GR.split(',').map(Number)) {
  const pg = await b.newPage({ viewport: { width: 320, height: 180 } });
  await pg.goto(`${URL}${URL.includes('?') ? '&' : '?'}seed=${seed}`, { waitUntil: 'load', timeout: 400000 });
  await pg.waitForFunction(() => !!window.__scene && window.__scene.players?.length === 4, null, { timeout: 400000 });
  const r = await pg.evaluate(([SECS, RX]) => { const sc = window.__scene, st = sc.state, re = new RegExp(RX), out = [], cur = {};
    const H = sc.players.map((pl) => { let h = null; pl.model.traverse((o) => { if (!h && o.isBone && /Hips$/.test(o.name)) h = o; }); return h; });
    for (let i = 0; i < SECS * 60; i++) { sc.update(1 / 60);
      sc.players.forEach((pl, j) => { const s = pl.sim, id = s.act?.id; let c = cur[j];
        if (id && re.test(id) && (!c || c.id !== id || s.act.t < c.lastT)) { if (c) out.push(c); c = cur[j] = { id, xs: [], lastT: -1, post: 0 }; }
        if (!c) return; pl.model.updateMatrixWorld(true); const e = H[j].matrixWorld.elements;
        // le lacet du bassin rendu : l'axe avant du bassin projeté au sol (colonne Z du bassin — le rig regarde +Z local) ; on le compare en variation
        const fx = e[8], fz = e[10];
        c.xs.push({ t: st.t, yR: Math.atan2(fz, fx), yS: s.yaw, v: s.speed, vR: pl.ctrl.groundSpeed ?? 0 });
        if (id === c.id) c.lastT = s.act.t; else if (++c.post > 20) { out.push(c); cur[j] = null; } }); }
    return out; }, [+SECS, RX]);
  G.push(...r); await pg.close(); console.log(`graine ${seed} : ${r.length} gestes`);
}
await b.close();
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a)), D = 180 / Math.PI;
const q = (xs, f) => { const s = xs.filter((x) => x != null && !isNaN(x)).sort((a, b) => a - b); return s.length ? s[Math.floor(f * (s.length - 1))] : NaN; }, m = (xs, d = 2) => `${q(xs, 0.5).toFixed(d)} [${q(xs, 0.1).toFixed(d)}–${q(xs, 0.9).toFixed(d)}]`;
const rot = (xs, k) => { const cum = [0]; for (let i = 1; i < xs.length; i++) cum.push(cum[i - 1] + wrap(xs[i][k] - xs[i - 1][k])); const T = cum[cum.length - 1]; if (Math.abs(T) < 0.3) return { T: T * D, d: null, w: null };
  const i1 = cum.findIndex((c) => c / T >= 0.1), i9 = cum.findIndex((c) => c / T >= 0.9); let w = 0; for (let i = 1; i < xs.length; i++) w = Math.max(w, Math.abs(wrap(xs[i][k] - xs[i - 1][k])) / Math.max(1e-3, xs[i].t - xs[i - 1].t)); return { T: T * D, d: xs[i9].t - xs[i1].t, w: w * D }; };
for (const id of [...new Set(G.map((g) => g.id))]) { const X = G.filter((g) => g.id === id && g.xs.length > 5);
  const R = X.map((g) => ({ r: rot(g.xs, 'yR'), s: rot(g.xs, 'yS'), vMax: Math.max(...g.xs.map((x) => x.vR)) })).filter((o) => Math.abs(o.s.T) >= 30);
  if (!R.length) continue;
  console.log(`${id.padEnd(14)} ${String(R.length).padStart(3)} (≥ 30°) : SIM ${m(R.map((o) => Math.abs(o.s.T)), 0)}° en ${m(R.map((o) => o.s.d))} s | RENDU ${m(R.map((o) => Math.abs(o.r.T)), 0)}° en ${m(R.map((o) => o.r.d))} s, taux au plus fort ${m(R.map((o) => o.r.w), 0)}°/s ; allure rendue au plus ${m(R.map((o) => o.vMax), 1)} m/s`); }
