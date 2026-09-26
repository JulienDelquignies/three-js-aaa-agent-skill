// LE FACE-À-FACE AU PAS, VU DU RENDU (face.js) : à chaque image où un porteur tient un face-à-face, le ballon contre le PIED rendu le plus proche
// (chevilles, orteils) — la semelle doit être SUR le ballon (la tenue : l'idle pausa lève le pied sur le ballon réel ; le roulé et le tiré :
// le clip de semelle) — par état : tenue (pas de geste), roulé, tiré, arrêt semelle d'entrée. La hauteur de la cheville au-dessus du sol dit
// si le pied est posé dessus (≈ 0,25-0,32 m) ou au sol à côté (≈ 0,08). Usage : node face-rendu.mjs <url> [secondes=90] [graines=1,2,3]
import { chromium } from '../../../../examples/showcase/node_modules/playwright/index.mjs';
const [URL, SECS = '90', GR = '1,2,3'] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const L = [];
for (const seed of GR.split(',').map(Number)) {
  const pg = await b.newPage({ viewport: { width: 320, height: 180 } });
  await pg.goto(`${URL}${URL.includes('?') ? '&' : '?'}seed=${seed}`, { waitUntil: 'load', timeout: 240000 });
  await pg.waitForFunction(() => !!window.__scene && window.__scene.players?.length === 4, null, { timeout: 240000 });
  const r = await pg.evaluate((SECS) => {
    const sc = window.__scene, st = sc.state, W = (o) => { const e = o.matrixWorld.elements; return [e[12], e[13], e[14]]; }, out = [];
    const OS = ['LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase'];
    const B = sc.players.map((pl) => { const f = {}; pl.model.traverse((o) => { if (o.isBone) for (const k of OS) if (new RegExp(k + '$').test(o.name) && !f[k]) f[k] = o; }); return f; });
    for (let i = 0; i < SECS * 60; i++) {
      sc.update(1 / 60);
      const j = sc.players.findIndex((pl) => pl.sim._face); if (j < 0) continue;
      const pl = sc.players[j], s = pl.sim; pl.model.updateMatrixWorld(true);
      const bp = st.ball.p; let best = null;
      for (const k of OS) { const o = B[j][k]; if (!o) continue; const q = W(o), d = Math.hypot(q[0] - bp[0], q[2] - bp[2]); if (!best || d < best.d) best = { k, d, h: q[1] }; }
      const etat = s.act ? (s.act.payload?.skill ?? s.act.id) : 'tenue';
      out.push({ etat, d: best?.d ?? 9, h: best?.h ?? 0, os: best?.k, idle: pl.ctrl.idleForce ?? '-', v: Math.hypot(s.v[0], s.v[1]), dB: Math.hypot(bp[0] - s.p[0], bp[2] - s.p[2]), t: +(s.act?.t ?? -1).toFixed(2), j, pied: s._face.pied });
    }
    return out;
  }, +SECS);
  L.push(...r); await pg.close(); console.log(`graine ${seed} : ${r.length} images de face-à-face`);
}
await b.close();
if (process.env.BRUT) for (const x of L.filter((x) => x.etat === process.env.BRUT).slice(0, 30)) console.log(JSON.stringify(x));
const q = (xs, f) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(f * (s.length - 1))] : NaN; };
const m = (X, f, d = 2) => `${q(X.map(f), 0.5).toFixed(d)} [${q(X.map(f), 0.1).toFixed(d)}–${q(X.map(f), 0.9).toFixed(d)}]`;
for (const e of [...new Set(L.map((x) => x.etat + '/' + x.pied))]) { const X = L.filter((x) => x.etat + '/' + x.pied === e);
  console.log(`${e.padEnd(13)} (${X.length} images) : ballon au pied rendu le plus proche ${m(X, (x) => x.d)} m à l'horizontale, cheville à ${m(X, (x) => x.h)} m ; ballon au corps ${m(X, (x) => x.dB)} m ; allure ${m(X, (x) => x.v, 1)} m/s ; idle : ${Object.entries(X.reduce((a, x) => ((a[x.idle] = (a[x.idle] ?? 0) + 1), a), {})).map(([k, v]) => `${k} ${v}`).join(', ')}`); }
