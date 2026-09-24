// LA LOCOMOTION MESURÉE SUR LE SQUELETTE RENDU (scène réelle, sans image) — ce que « ils collent au sol » peut vouloir
// dire, chiffré par allure (vitesse sim, hors geste/chute) et comparé à la biomécanique :
//   genou     flexion MAX en vol par foulée (°)            — Novacheck 1998 : ~65 marche, ~90 trot, ~100-110 course
//   cheville  hauteur MAX au-dessus de son sol en vol (cm)
//   appui     facteur d'appui (part du cycle au sol, par pied)   — ~0,40 à 3 m/s, ~0,35 à 4-5 m/s
//   vol       part du temps SANS pied au sol (%)            — 1 − 2·appui : ~20 % à 3 m/s, ~30 % à 4-5 m/s
//   bassin    oscillation crête-crête par pas (cm)          — 6-10 cm en course (Cavanagh)
//   hanche    hauteur moyenne du bassin − debout (cm)
// Usage : node locomotion.mjs <url> [secondes=60]
import { chromium } from '/home/delkit/DelkIT/skill-1v1/examples/showcase/node_modules/playwright/index.mjs';
const [URL, SECS = '60'] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const pg = await b.newPage({ viewport: { width: 320, height: 180 } });
await pg.goto(URL, { waitUntil: 'load', timeout: 240000 });
await pg.waitForFunction(() => !!window.__scene, null, { timeout: 240000 });
const r = await pg.evaluate((SECS) => {
  const sc = window.__scene, dt = 1 / 60, N = Math.round(SECS / dt), SKIP = 120;
  const V = sc.players[0].model.position.constructor;
  const P = sc.players.map((pl) => { const f = {}; pl.model.traverse((o) => { if (!o.isBone) return; for (const k of ['Hips', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase', 'Neck']) if (new RegExp(k + '$').test(o.name) && !f[k]) f[k] = o; }); return f; });
  // le bassin DEBOUT : la hauteur des hanches au repos du template (échelle comprise), mesurée avant de jouer
  const stand = sc.players.map((pl, j) => { pl.model.updateMatrixWorld(true); return P[j].Hips.getWorldPosition(new V()).y; });
  const rec = sc.players.map(() => []);
  const a = new V(), c = new V(), d = new V(), e = new V();
  for (let i = 0; i < N; i++) {
    sc.update(dt); if (i < SKIP) continue;
    sc.players.forEach((pl, j) => {
      pl.model.updateMatrixWorld(true); const B = P[j], fr = { v: pl.sim?.speed ?? 0, bad: !!pl.sim?.act || (pl.sim?.down ?? 0) > 0 };
      for (const s of ['Left', 'Right']) {
        B[s + 'UpLeg'].getWorldPosition(a); B[s + 'Leg'].getWorldPosition(c); B[s + 'Foot'].getWorldPosition(d); B[s + 'ToeBase'].getWorldPosition(e);
        const t = a.clone().sub(c).normalize(), sh = d.clone().sub(c).normalize();
        fr[s] = { knee: 180 - Math.acos(Math.max(-1, Math.min(1, t.dot(sh)))) * 180 / Math.PI, ank: d.y, toe: e.y };
      }
      fr.hip = B.Hips.getWorldPosition(a).y;
      rec[j].push(fr);
    });
  }
  const buckets = [[1.5, 2.5, 'marche-trot 1,5-2,5'], [2.5, 3.5, 'trot 2,5-3,5'], [3.5, 4.5, 'course 3,5-4,5'], [4.5, 9, 'course vive 4,5+']];
  const q = (xs, f) => { const s = [...xs].sort((x, y) => x - y); return s.length ? s[Math.floor(f * (s.length - 1))] : NaN; };
  const out = {};
  for (const [lo, hi, name] of buckets) {
    const G = { knee: [], ank: [], duty: [], flight: 0, frames: 0, bob: [], hipd: [], n: 0 };
    rec.forEach((s, j) => {
      // sols : p5 des hauteurs cheville / orteil hors geste
      const floor = {}; for (const k of ['Left', 'Right']) { floor[k] = { ank: q(s.filter((f) => !f.bad).map((f) => f[k].ank), 0.05), toe: q(s.filter((f) => !f.bad).map((f) => f[k].toe), 0.05) }; }
      const onG = (f, k) => f[k].toe < floor[k].toe + 0.025 || f[k].ank < floor[k].ank + 0.025;
      // fenêtres de vitesse stables (≥ 0,6 s dans le seau, sans geste)
      let i0 = -1;
      const close = (i1) => {
        if (i0 < 0 || i1 - i0 < 36) { i0 = -1; return; }
        const w = s.slice(i0, i1);
        for (const f of w) { G.frames++; if (!onG(f, 'Left') && !onG(f, 'Right')) G.flight++; G.hipd.push(f.hip - stand[j]); }
        for (const k of ['Left', 'Right']) {
          G.duty.push(w.filter((f) => onG(f, k)).length / w.length);
          // par vol (entre deux appuis) : flexion max du genou, hauteur max de la cheville
          let air = null;
          for (const f of w) { if (onG(f, k)) { if (air && air.n > 6) { G.knee.push(air.knee); G.ank.push(100 * (air.ank - floor[k].ank)); } air = null; } else { air ??= { knee: 0, ank: -9, n: 0 }; air.n++; air.knee = Math.max(air.knee, f[k].knee); air.ank = Math.max(air.ank, f[k].ank); } }
        }
        // oscillation du bassin : crête-crête par fenêtre de 0,35 s (≈ un pas)
        for (let k = 0; k + 21 <= w.length; k += 21) { const h = w.slice(k, k + 21).map((f) => f.hip); G.bob.push(100 * (Math.max(...h) - Math.min(...h))); }
        G.n++; i0 = -1;
      };
      s.forEach((f, i) => { const inB = !f.bad && f.v >= lo && f.v < hi; if (inB && i0 < 0) i0 = i; if (!inB) close(i); });
      close(s.length);
    });
    out[name] = { fenetres: G.n, secondes: +(G.frames / 60).toFixed(1), genouVol_p50: +q(G.knee, 0.5).toFixed(0), genouVol_p90: +q(G.knee, 0.9).toFixed(0), chevilleVol_cm_p50: +q(G.ank, 0.5).toFixed(0), appui_p50: +q(G.duty, 0.5).toFixed(2), vol_pct: +(100 * G.flight / Math.max(1, G.frames)).toFixed(0), bassinCC_cm_p50: +q(G.bob, 0.5).toFixed(1), bassin_vs_debout_cm: +(100 * q(G.hipd, 0.5)).toFixed(1) };
  }
  return out;
}, Number(SECS));
for (const [k, o] of Object.entries(r)) console.log(k.padEnd(20), JSON.stringify(o));
await b.close();
