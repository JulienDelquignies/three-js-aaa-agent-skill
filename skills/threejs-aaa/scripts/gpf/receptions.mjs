// LES RÉCEPTIONS DU DUEL, MESURÉES : à chaque clip de contrôle joué (controleInterieur, controleOriente…), la vitesse du receveur, celle du
// ballon et sa direction d'arrivée dans le repère du corps (0° = de face, 90° = de côté), le virage voulu (yawWant − yaw) — pour choisir
// l'animation GameplayFootball de même situation (idle / walk / sprint, ballon de face ou de côté). Usage : node receptions.mjs <url> [s=180] [graines]
import { chromium } from '../../../../examples/showcase/node_modules/playwright/index.mjs';
const [URL, SECS = '180', GR = '1,2,3'] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const all = [];
for (const seed of GR.split(',').map(Number)) {
  const pg = await b.newPage({ viewport: { width: 320, height: 180 } });
  await pg.goto(`${URL}${URL.includes('?') ? '&' : '?'}seed=${seed}`, { waitUntil: 'load', timeout: 240000 });
  await pg.waitForFunction(() => !!window.__scene && window.__scene.players?.length >= 2, null, { timeout: 240000 });
  const r = await pg.evaluate(([SECS, seed]) => {
    const sc = window.__scene, st = sc.state, out = []; let prevBall = null;
    for (const pl of sc.players) { const L = pl.gestureLayer, beg = L.begin.bind(L);
      L.begin = (spec, ...a) => { const n = String(spec?.name ?? '?'); if (/^controle|^tacle$|^amorti/.test(n)) { const s = pl.sim, bv = prevBall ?? st.ball.v, sp = Math.hypot(bv[0], bv[2]);
        // direction d'arrivée du ballon dans le repère du corps : l'angle entre −v_ballon et l'avant (cos yaw, sin yaw)
        const ang = sp > 0.3 ? Math.acos(Math.max(-1, Math.min(1, (-bv[0] * Math.cos(s.yaw) - bv[2] * Math.sin(s.yaw)) / sp))) * 180 / Math.PI : null;
        const dY = s.yawWant != null ? Math.atan2(Math.sin(s.yawWant - s.yaw), Math.cos(s.yawWant - s.yaw)) * 180 / Math.PI : null;
        out.push({ seed, t: +st.t.toFixed(2), clip: n, v: +Math.hypot(s.v[0], s.v[1]).toFixed(2), ballV: +sp.toFixed(1), ballH: +st.ball.p[1].toFixed(2), arrivee: ang == null ? null : Math.round(ang), dY: dY == null ? null : Math.round(dY) }); }
        return beg(spec, ...a); }; }
    for (let i = 0; i < SECS * 60; i++) { prevBall = [...st.ball.v]; sc.update(1 / 60); }
    return out;
  }, [+SECS, seed]);
  all.push(...r); await pg.close();
}
await b.close();
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : null; };
for (const clip of [...new Set(all.map((x) => x.clip.replace(/-gauche$/, '')))]) {
  const L = all.filter((x) => x.clip.replace(/-gauche$/, '') === clip), V = L.map((x) => x.v), A = L.filter((x) => x.arrivee != null).map((x) => x.arrivee), D = L.filter((x) => x.dY != null).map((x) => Math.abs(x.dY)), BV = L.map((x) => x.ballV);
  console.log(`${clip} ×${L.length} (gauche ${L.filter((x) => /-gauche$/.test(x.clip)).length}) : receveur v p25/50/75 ${q(V, .25)}/${q(V, .5)}/${q(V, .75)} m/s · ballon ${q(BV, .5)} m/s · arrivée p25/50/75 ${q(A, .25)}/${q(A, .5)}/${q(A, .75)}° · |virage| p50 ${q(D, .5)}°`);
}
for (const x of all.filter((x) => /tacle/.test(x.clip))) console.log('tacle', JSON.stringify(x));
console.log(JSON.stringify(all.filter((x) => /controleOriente/.test(x.clip)).slice(0, 12)));
