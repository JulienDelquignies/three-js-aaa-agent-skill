// Les gestes de dribble du duel : événements 'skill' (kind, réussite, pied), l'act joué (clip), la vitesse du porteur avant / pendant, la durée.
import { chromium } from '../../../../examples/showcase/node_modules/playwright/index.mjs';
const [URL, SECS = '120'] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const pg = await b.newPage({ viewport: { width: 320, height: 180 } });
await pg.goto(URL, { waitUntil: 'load', timeout: 240000 });
await pg.waitForFunction(() => !!window.__scene, null, { timeout: 240000 });
const r = await pg.evaluate((SECS) => {
  const sc = window.__scene, st = sc.state, dt = 1 / 60, out = []; let ne = 0; const vHist = sc.players.map(() => []), open = sc.players.map(() => null);
  for (let i = 0; i < SECS * 60; i++) { sc.update(dt); const t = i * dt;
    sc.players.forEach((pl, j) => { const s = pl.sim, v = Math.hypot(s.v[0], s.v[1]); vHist[j].push(v); if (vHist[j].length > 60) vHist[j].shift();
      const a = s.act; const key = a ? JSON.stringify([a.kind ?? a.type, a.payload?.kind, a.payload?.skill, a.clip, a.move]) : null;
      if (a && !open[j]) open[j] = { t0: t, j, key, vAvant: +vHist[j][Math.max(0, vHist[j].length - 20)].toFixed(1), vs: [], gl: pl.gestureLayer?.clip?.name ?? pl.gestureLayer?.name ?? null };
      if (open[j]) open[j].vs.push(v);
      if (!a && open[j]) { const o = open[j]; out.push({ t: +o.t0.toFixed(2), j, act: o.key, dur: +(t - o.t0).toFixed(2), vAvant: o.vAvant, vMin: +Math.min(...o.vs).toFixed(1), vMoy: +(o.vs.reduce((x, y) => x + y, 0) / o.vs.length).toFixed(1) }); open[j] = null; } });
    while (ne < st.events.length) { const e = st.events[ne++]; if (e.type === "skill" || e.type === "feinte" || /dribble|geste/.test(e.type)) out.push({ t: e.t, ev: e.type, kind: e.kind, by: e.by, reussi: e.reussi, foot: e.foot, foulee: e.foulee, tours: e.tours }); }
  }
  return out;
}, +SECS);
await b.close();
for (const x of r) console.log(JSON.stringify(x));
