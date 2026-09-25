// LA RÉCUPÉRATION D'UN BALLON QUI TRAÎNE, VUE DU RENDU. À chaque prise d'un ballon LIBRE (le ballon sans porteur — phase 'loose' — qu'un joueur fait
// sien : événement 'control' ou 'loose-kept'), autour de l'instant de la prise : l'approche (vitesse du corps sur la dernière seconde, le
// freinage), la distance du ballon au pied RENDU le plus proche à l'instant de la prise (le pied touche-t-il ?), la distance au corps (la prise
// « à distance »), puis pendant 0,6 s : le ballon qui bouge au servo (possédé) SANS pied à 0,2 m — la force invisible, son déplacement — et la
// technique nommée. Usage : node recuperation.mjs <url> [secondes=120] [graines=1,2,3,4] [sortie.json]
import { chromium } from '../../../../examples/showcase/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';
const [URL, SECS = '120', GR = '1,2,3,4', OUT] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const P = [];
for (const seed of GR.split(',').map(Number)) {
  const pg = await b.newPage({ viewport: { width: 320, height: 180 } });
  await pg.goto(`${URL}${URL.includes('?') ? '&' : '?'}seed=${seed}`, { waitUntil: 'load', timeout: 240000 });
  await pg.waitForFunction(() => !!window.__scene && window.__scene.players?.length === 2, null, { timeout: 240000 });
  const r = await pg.evaluate((SECS) => {
    const sc = window.__scene, st = sc.state, dt = 1 / 60, W = (o) => { const e = o.matrixWorld.elements; return [e[12], e[13], e[14]]; };
    const B = sc.players.map((pl) => { const f = {}; pl.model.traverse((o) => { if (o.isBone && !f[o.name]) f[o.name] = o; }); return f; });
    const pied = (j) => { const bl = st.ball.p; let m = 9; for (const k of ['LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase']) { const q = W(B[j][k]); m = Math.min(m, Math.hypot(q[0] - bl[0], q[1] - bl[1], q[2] - bl[2])); } return m; };
    const hist = sc.players.map(() => []), out = [], ouvertes = []; let ne = 0, phase0 = st.phase;
    for (let i = 0; i < SECS * 60; i++) {
      const libreAvant = st.phase === 'loose' || st.possession?.carrier == null || st.possession.carrier < 0;
      sc.update(dt); for (const pl of sc.players) pl.model.updateMatrixWorld(true);
      sc.players.forEach((pl, j) => { hist[j].push([st.t, Math.hypot(pl.sim.v[0], pl.sim.v[1])]); if (hist[j].length > 90) hist[j].shift(); });
      while (ne < st.events.length) { const e = st.events[ne++];
        if ((e.type === 'control' || e.type === 'loose-kept') && libreAvant && !st.restart) {
          const j = sc.players.findIndex((pl) => pl.sim.id === e.by); if (j < 0) continue; const s = sc.players[j].sim;
          const h = hist[j].filter(([t]) => t >= st.t - 1), bv = Math.hypot(st.ball.v[0], st.ball.v[2]);
          ouvertes.push({ t: st.t, j, tech: e.tech ?? e.type, vApp: h.length ? +Math.max(...h.map((x) => x[1])).toFixed(2) : 0, vPrise: +Math.hypot(...s.v).toFixed(2),
            ballonV: +bv.toFixed(2), piedPrise: +pied(j).toFixed(3), corps: +Math.hypot(st.ball.p[0] - s.p[0], st.ball.p[2] - s.p[2]).toFixed(2), servo: 0, servoSansPied: 0, glisse: 0, piedMin: 9, prev: [...st.ball.p] });
        } }
      for (const o of ouvertes) if (!o.fini) { const s = sc.players[o.j].sim, d = pied(o.j); o.piedMin = Math.min(o.piedMin, d);
        if (st.ball.owner === s.id) { o.servo++; if (d > 0.2) { o.servoSansPied++; o.glisse += Math.hypot(st.ball.p[0] - o.prev[0], st.ball.p[2] - o.prev[2]); const k = [s.intent ? 'intent' : '', s.anchorHint && st.t - s.anchorHint.t < 0.4 ? 'ancre' : '', s.act ? 'acte:' + (s.act.payload?.skill ?? s.act.payload?.kind ?? s.act.kind ?? '?') : '', (s._prepShot ?? -1) > st.t ? 'prepTir' : '', st._settling && st.t < st._settling.at ? 'pose' : '', s._bouclier ? 'bouclier' : '', s._pausa ? 'pausa' : '', Math.hypot(...s.v) < 1 ? 'lent' : ''].filter(Boolean).join('+') || '?'; (o.pourquoi ??= {})[k] = (o.pourquoi[k] ?? 0) + 1; } }
        o.prev = [...st.ball.p]; if (st.t - o.t > 0.6) { o.fini = true; delete o.prev; out.push(o); } }
    }
    return out;
  }, +SECS);
  P.push(...r.map((x) => ({ seed, ...x }))); await pg.close(); console.log(`graine ${seed} : ${r.length} récupérations`);
}
await b.close();
const q = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };
const m = (f, d = 2) => `${q(P.map(f), 0.5).toFixed(d)} [${q(P.map(f), 0.1).toFixed(d)}–${q(P.map(f), 0.9).toFixed(d)}]`;
console.log(`\n${P.length} récupérations d'un ballon libre — médiane [p10–p90]`);
console.log(`  approche : ${m((x) => x.vApp, 1)} m/s au plus vite sur la dernière seconde → ${m((x) => x.vPrise, 1)} m/s à la prise ; ballon ${m((x) => x.ballonV, 1)} m/s`);
console.log(`  À LA PRISE : ballon au pied rendu le plus proche ${m((x) => x.piedPrise)} m (${P.filter((x) => x.piedPrise <= 0.2).length}/${P.length} ≤ 0,2 m), au centre du corps ${m((x) => x.corps)} m`);
console.log(`  0,6 s APRÈS : ballon tenu au servo ${m((x) => x.servo / 60)} s dont SANS pied à 0,2 m ${m((x) => x.servoSansPied / 60)} s, glissé sans pied ${m((x) => x.glisse)} m (${P.filter((x) => x.glisse > 0.1).length}/${P.length} > 0,1 m) ; pied au plus près ${m((x) => x.piedMin)} m`);
{ const Wy = {}; for (const x of P) for (const [k, v] of Object.entries(x.pourquoi ?? {})) Wy[k] = (Wy[k] ?? 0) + v; console.log('  pourquoi le ballon tenu sans pied après la prise (images) :', Object.entries(Wy).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')); }
const T = {}; for (const x of P) T[x.tech] = (T[x.tech] ?? 0) + 1; console.log('  techniques :', Object.entries(T).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '));
if (OUT) writeFileSync(OUT, JSON.stringify(P));
