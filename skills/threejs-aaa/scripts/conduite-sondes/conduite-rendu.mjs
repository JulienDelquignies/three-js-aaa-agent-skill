// LA CONDUITE VUE DU RENDU : à chaque touche de la sim (événement 'touche' → pl._touchT), l'état des PIEDS RENDUS — lequel joue (le warp),
// sa phase de foulée, sa distance NATURELLE au ballon (image de la touche : enveloppe nulle), le ballon dans le repère du corps ; entre les
// touches, le ballon traverse-t-il un pied ; les gestes (acts) de dribble : vitesse du corps, pied au ballon au contact.
import { chromium } from '../../../../examples/showcase/node_modules/playwright/index.mjs';
const [URL, SECS = '60'] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const pg = await b.newPage({ viewport: { width: 320, height: 180 } });
await pg.goto(URL, { waitUntil: 'load', timeout: 240000 });
await pg.waitForFunction(() => !!window.__scene, null, { timeout: 240000 });
const r = await pg.evaluate((SECS) => {
  const sc = window.__scene, st = sc.state, dt = 1 / 60, V = sc.players[0].model.position.constructor;
  const bones = sc.players.map((pl) => { const f = {}; pl.model.traverse((o) => { if (!o.isBone) return; for (const k of ['LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase', 'Hips']) if (new RegExp(k + '$').test(o.name) && !f[k]) f[k] = o; }); return f; });
  let ne = 0; const modeDe = sc.players.map(() => null);
  const lastT = sc.players.map(() => null), touches = [], pen = [], acts = [], carry = sc.players.map(() => ({ frames: 0, steps: 0, touches: 0 })), lastPh = sc.players.map(() => ({}));
  const a = new V(), c = new V(); let prevActs = sc.players.map(() => null);
  for (let i = 0; i < SECS * 60; i++) {
    sc.update(dt); const t = i * dt;
    while (ne < st.events.length) { const e = st.events[ne++]; if (e.type === 'touche') modeDe[e.by] = e.pas ?? '-'; }
    const bp = st.ball.p;
    sc.players.forEach((pl, j) => {
      const s = pl.sim, B = bones[j], feet = pl.ctrl?._gaitFeet;
      pl.model.updateMatrixWorld(true);
      const yaw = s.yaw, fx = Math.cos(yaw), fz = Math.sin(yaw);   // regard sim (x, z)
      const rel = (x, z) => { const dx = x - s.p[0], dz = z - s.p[2]; return [dx * fx + dz * fz, -dx * fz + dz * fx]; };   // [devant, gauche?]
      const owner = st.ball.owner === s.id;
      if (owner && !s.act) { carry[j].frames++; for (const sd of ['Left', 'Right']) { const ph = feet?.[sd]?.phase; if (ph && ph !== 'swing' && lastPh[j][sd] === 'swing') carry[j].steps++; lastPh[j][sd] = ph; } }
      if (pl._touchT != null && pl._touchT !== lastT[j]) {
        lastT[j] = pl._touchT; if (owner || true) carry[j].touches++;
        const f = {}; for (const sd of ['Left', 'Right']) { B[sd + 'Foot'].getWorldPosition(a); B[sd + 'ToeBase'].getWorldPosition(c);
          const dFoot = Math.hypot(a.x - bp[0], a.z - bp[2]), dToe = Math.hypot(c.x - bp[0], c.z - bp[2]); f[sd] = { ph: feet?.[sd]?.phase ?? '?', u: +(feet?.[sd]?.u ?? -1).toFixed(2), d: +Math.min(dFoot, dToe).toFixed(2), rel: rel(c.x, c.z).map((x) => +x.toFixed(2)) }; }
        const planted = (sd) => /stance|peel/.test(f[sd].ph);
        const cand = ['Left', 'Right'].filter((sd) => !planted(sd)).sort((x, y) => f[x].d - f[y].d);
        const named = pl._touchFoot ? (pl._touchFoot === 'left' ? 'Left' : 'Right') : null;
        const side = named ?? cand[0] ?? null;   // le pied NOMMÉ par la sim, même s'il vient de se poser (le contact a été joué sur la fin du vol)
        touches.push({ mode: modeDe[j], t: +t.toFixed(2), j, v: +Math.hypot(s.v[0], s.v[1]).toFixed(1), ball: rel(bp[0], bp[2]).map((x) => +x.toFixed(2)), bh: +bp[1].toFixed(2), feet: f, joue: side, dJoue: side ? f[side].d : null, nomme: named, tousPlantes: !cand.length });
      }
      // pénétration : le centre du ballon à < rayon + 4 cm d'un os de pied (hors la touche elle-même)
      if (bp[1] < 0.3) for (const sd of ['Left', 'Right']) { B[sd + 'ToeBase'].getWorldPosition(c); B[sd + 'Foot'].getWorldPosition(a);
        const d = Math.min(Math.hypot(c.x - bp[0], c.y - bp[1], c.z - bp[2]), Math.hypot(a.x - bp[0], a.y - bp[1], a.z - bp[2]));
        if (d < 0.10) pen.push({ t: +t.toFixed(2), j, sd, d: +d.toFixed(3), ph: feet?.[sd]?.phase, act: s.act?.payload?.kind ?? null, regime: s.act ? 'geste' : st.ball.owner === s.id ? 'porté' : st.possession?.carrier === s.id ? 'conduite' : 'autre', v: +Math.hypot(s.v[0], s.v[1]).toFixed(1) }); }
      const k = s.act ? (s.act.kind ?? s.act.type ?? s.act.payload?.kind ?? 'act') : null;
      if (k !== prevActs[j]) { if (k) acts.push({ t: +t.toFixed(2), j, k, v: +Math.hypot(s.v[0], s.v[1]).toFixed(1), owner }); prevActs[j] = k; }
    });
  }
  return { touches, pen, acts, carry };
}, +SECS);
await b.close();
const T = r.touches, q = (xs, f) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(f * (s.length - 1))] : NaN; };
console.log(`${T.length} touches ; porté : ${r.carry.map((c, j) => `j${j} ${(c.frames / 60).toFixed(1)} s, ${c.steps} appuis, ${c.touches} touches`).join(' ; ')}`);
for (const m of [...new Set(T.map((x) => x.mode))]) { const g = T.filter((x) => x.mode === m); console.log(`  mode ${m} : ${g.length} touches, distance naturelle p50 ${q(g.map((x) => x.dJoue ?? 9), 0.5)} p90 ${q(g.map((x) => x.dJoue ?? 9), 0.9)} m`); }
console.log(`pied qui joue → distance NATURELLE au ballon à l'instant de la touche : p50 ${q(T.map((x) => x.dJoue ?? 9), 0.5)} p90 ${q(T.map((x) => x.dJoue ?? 9), 0.9)} m ; tous les pieds plantés (aucun warp) : ${T.filter((x) => x.tousPlantes).length}`);
console.log(`phase du pied qui joue : ${Object.entries(T.reduce((m, x) => { const k = x.joue ? x.feet[x.joue].ph : 'aucun'; m[k] = (m[k] ?? 0) + 1; return m; }, {})).map(([k, v]) => `${k} ${v}`).join(', ')} ; u vol du pied qui joue p10/50/90 ${[0.1, 0.5, 0.9].map((f) => q(T.filter((x) => x.joue && x.feet[x.joue].ph === 'swing').map((x) => x.feet[x.joue].u), f)).join('/')}`);
console.log(`ballon dans le repère du corps (devant, côté) p50 ${q(T.map((x) => x.ball[0]), 0.5)} / ${q(T.map((x) => Math.abs(x.ball[1])), 0.5)} m ; pied qui joue DEVANT l'autre ? ${T.filter((x) => x.joue).filter((x) => { const o = x.joue === 'Left' ? 'Right' : 'Left'; return x.feet[x.joue].rel[0] > x.feet[o].rel[0]; }).length}/${T.filter((x) => x.joue).length}`);
console.log(`pénétrations ballon-pied (centre du ballon à < 10 cm d'un os de pied) : ${r.pen.length} images (${[...new Set(r.pen.map((p) => p.t))].length} instants) — phases ${Object.entries(r.pen.reduce((m, x) => { m[x.ph ?? '?'] = (m[x.ph ?? '?'] ?? 0) + 1; return m; }, {})).map(([k, v]) => `${k} ${v}`).join(', ')}`);
console.log(`  par régime : ${Object.entries(r.pen.reduce((m, x) => { const k = x.regime + (x.v < 1 ? ' (<1 m/s)' : ''); m[k] = (m[k] ?? 0) + 1; return m; }, {})).map(([k, v]) => `${k} ${v}`).join(', ')}`);
console.log(`gestes : ${Object.entries(r.acts.reduce((m, x) => { m[x.k] = (m[x.k] ?? 0) + 1; return m; }, {})).map(([k, v]) => `${k} ${v}`).join(', ')}`);
console.log('exemples de touches :'); for (const x of T.slice(0, 12)) console.log(' ', JSON.stringify(x));
