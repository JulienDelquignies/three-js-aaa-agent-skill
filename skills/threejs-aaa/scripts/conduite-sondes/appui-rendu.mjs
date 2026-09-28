// L'APPUI DES FRAPPES À ANGLE, VU DU RENDU — pour chaque armé de frappe en course (≥ 1,5 m/s) dont la sortie s'écarte de ≥ 45° de la course
// (rondo-sim.armePlante) : le pied d'APPUI rendu (l'opposé du pied qui frappe) sur les 0,1 s qui précèdent le contact — sa vitesse au sol et
// son glissement au monde (planté : ~0), sa hauteur ; et le bassin rendu, pour la vitesse du corps. BASE=1 : cfg.armePlante éteint dans la page
// (l'armé d'hier), pour l'A/B sur les mêmes graines. Usage : node appui-rendu.mjs <url> [secondes=120] [graines=1,2,3]
import { chromium } from '../../../../examples/showcase/node_modules/playwright/index.mjs';
const [URL, SECS = '120', GR = '1,2,3'] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const R = [];
for (const seed of GR.split(',').map(Number)) {
  const pg = await b.newPage({ viewport: { width: 320, height: 180 } });
  await pg.goto(`${URL}${URL.includes('?') ? '&' : '?'}seed=${seed}`, { waitUntil: 'load', timeout: 400000 });
  await pg.waitForFunction(() => !!window.__scene && window.__scene.players?.length === 4, null, { timeout: 400000 });
  const r = await pg.evaluate(([SECS, BASE]) => { const sc = window.__scene, st = sc.state, out = [], cur = {};
    if (BASE) sc._mcfg.armePlante = null;
    const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    const B = sc.players.map((pl) => { const f = {}; pl.model.traverse((o) => { if (o.isBone) for (const k of ['LeftToeBase', 'RightToeBase', 'LeftFoot', 'RightFoot', 'Hips']) if (new RegExp(k + '$').test(o.name) && !f[k]) f[k] = o; }); return f; });
    const W = (o) => { const e = o.matrixWorld.elements; return [e[12], e[13], e[14]]; };
    for (let i = 0; i < SECS * 60; i++) { sc.update(1 / 60);
      sc.players.forEach((pl, j) => { const s = pl.sim, A = s.act; let c = cur[j];
        if (!c && A && A.payload?.stance && A.payload.kind !== 'skill' && !s.keeper && (A.payload.v0 ?? 0) >= 1.5 && Math.abs(wrap(A.payload.outYaw - (A.payload.vYaw ?? s.yaw))) >= Math.PI / 4)
          c = cur[j] = { id: A.id, act: A, appui: A.payload.pick.foot === 'left' ? 'Right' : 'Left', xs: [], tC: null, plante: null };
        if (!c) return; pl.model.updateMatrixWorld(true);
        c.xs.push({ t: st.t, toe: W(B[j][c.appui + 'ToeBase']), ank: W(B[j][c.appui + 'Foot']), hip: W(B[j].Hips) });
        if (c.plante == null && c.act.payload._plante !== undefined) c.plante = !!c.act.payload._plante;
        if (c.tC == null && c.act.fired) c.tC = st.t;
        if (s.act !== c.act || (c.tC != null && st.t - c.tC > 0.05)) { if (c.tC != null) out.push(c); cur[j] = null; } }); }
    return out.map((c) => { const X = c.xs.filter((x) => x.t >= c.tC - 0.1 - 1e-6 && x.t <= c.tC + 1e-6); if (X.length < 3) return null;
      const h = (a, b) => Math.hypot(b[0] - a[0], b[2] - a[2]), dT = X[X.length - 1].t - X[0].t;
      return { id: c.id, plante: c.plante, glisse: h(X[0].toe, X[X.length - 1].toe), glisseCh: h(X[0].ank, X[X.length - 1].ank), vHip: h(X[0].hip, X[X.length - 1].hip) / dT, haut: Math.min(...X.map((x) => x.toe[1])) }; }).filter(Boolean); }, [+SECS, !!process.env.BASE]);
  R.push(...r); await pg.close(); console.log(`graine ${seed} : ${r.length} frappes à angle`);
}
await b.close();
const q = (xs, f) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(f * (s.length - 1))]; }, m = (xs, d = 2) => `${q(xs, 0.5).toFixed(d)} [${q(xs, 0.1).toFixed(d)}–${q(xs, 0.9).toFixed(d)}]`;
console.log(`${process.env.BASE ? 'BASE (armé d\'hier)' : 'armé planté'} — ${R.length} frappes à angle (plantées ${R.filter((x) => x.plante).length}) : sur les 0,1 s avant le contact, le pied d'appui rendu glisse de ${m(R.map((x) => x.glisse))} m (orteils), ${m(R.map((x) => x.glisseCh))} m (cheville) ; ≤ 5 cm : ${R.filter((x) => x.glisse <= 0.05).length}/${R.length} ; bassin ${m(R.map((x) => x.vHip), 1)} m/s ; orteils au plus bas ${m(R.map((x) => x.haut))} m`);
