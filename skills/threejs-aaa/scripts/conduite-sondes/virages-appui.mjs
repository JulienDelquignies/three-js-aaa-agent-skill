// LES CHANGEMENTS DE DIRECTION DU DUEL (sans navigateur, moteur STARTER) — « il manque les virages en changement d'appui, les courbes ne vont
// pas : les joueurs font des virages secs avec des changements d'appui ». Chaque VIRAGE : le cap de la vitesse tourne de ≥ 45° en ≤ 1,2 s, lancé
// (≥ 2 m/s au départ). Mesuré : l'angle, la durée (10 → 90 % du virage), le rayon de la trajectoire au plus serré (v/ω), l'allure à l'entrée,
// au plus bas, à la sortie (+0,5 s), la part du virage prise pendant un VOL (aucun pied à l'appui selon l'horloge de foulée — physiquement
// impossible : sans appui, pas de force), et le plus grand morceau de virage pris pendant UN SEUL appui (la coupe réelle : 45° en un appui,
// 90°+ en deux). Réf. Dos'Santos et al. 2021 (J Sports Sci, sans ballon) : 45° pose à 0,97 × l'approche, 90° à 0,76, 180° à 0,67.
// Usage : node virages-appui.mjs [graines=8] [s=120]
import { makeDuel, duelCfg } from '../../assets/starter/src/engine/duel-1v1.js';
import { matchStep } from '../../assets/starter/src/engine/match-sim.js';
import { pasEtat } from '../../assets/starter/src/engine/pas.js';
const [NG = '8', SECS = '120'] = process.argv.slice(2);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a)), D = 180 / Math.PI;
const V = [];
for (let seed = 1; seed <= Number(NG); seed++) {
  const st = makeDuel({ seed }), cfg = duelCfg(), H = new Map();
  for (let i = 0; i < Number(SECS) * 60; i++) {
    matchStep(st, 1 / 60, cfg);
    for (const p of st.players) { if (p.keeper) continue;
      const h = H.get(p.id) ?? []; const sp = Math.hypot(p.v[0], p.v[1]), e = pasEtat(p);
      h.push({ t: st.t, sp, hd: sp > 0.3 ? Math.atan2(p.v[1], p.v[0]) : null, appui: e ? (e.appui.left || e.appui.right) : true, qui: e ? (e.appui.left && e.appui.right ? 'deux' : e.appui.left ? 'G' : e.appui.right ? 'D' : 'vol') : '?', busy: !!p.act, porteur: st.possession?.carrier === p.id && st.phase === 'carry', coupe: !!(p._coupe && p._coupe.etat !== 'fin'), p: [p.p[0], p.p[2]] });
      if (h.length > 150) h.shift(); H.set(p.id, h);
      // un virage se juge quand il est FINI : fenêtre de 1,2 s qui se termine maintenant, départ lancé
      const n = h.length; if (n < 75 || p._virT > st.t - 1.2) continue;
      const i0 = n - 73, a = h[i0]; if (a.hd == null || a.sp < 2) continue;
      let cum = 0, maxAbs = 0, iMax = i0; for (let k = i0 + 1; k < n; k++) { if (h[k].hd == null || h[k - 1].hd == null) continue; cum += wrap(h[k].hd - h[k - 1].hd); if (Math.abs(cum) > maxAbs) { maxAbs = Math.abs(cum); iMax = k; } }
      if (maxAbs * D < 45 || iMax > n - 20) continue;   // (le virage doit être fini : sa fin à ≥ 0,3 s avant maintenant)
      p._virT = st.t;
      // profil : cumul signé du virage image par image
      const cumAt = []; let c = 0; for (let k = i0; k <= iMax; k++) { if (k > i0 && h[k].hd != null && h[k - 1].hd != null) c += wrap(h[k].hd - h[k - 1].hd); cumAt.push({ k, c: Math.abs(c) }); }
      const tA = cumAt.find((x) => x.c >= 0.1 * maxAbs).k, tB = cumAt.find((x) => x.c >= 0.9 * maxAbs).k;
      let vol = 0, parAppui = new Map(), rMin = Infinity, spMin = Infinity, cur = null, segs = [];
      for (let k = i0 + 1; k <= iMax; k++) { const x = h[k], y = h[k - 1]; if (x.hd == null || y.hd == null) continue; const dA = Math.abs(wrap(x.hd - y.hd)), dt = x.t - y.t;
        if (!x.appui) vol += dA; spMin = Math.min(spMin, x.sp); if (dA > 1e-4) rMin = Math.min(rMin, x.sp / (dA / dt));
        const key = x.qui; if (!cur || cur.q !== key) { cur = { q: key, a: 0 }; segs.push(cur); } cur.a += dA; }
      const unAppui = Math.max(0, ...segs.filter((s) => s.q === 'G' || s.q === 'D' || s.q === 'deux').map((s) => s.a));
      const spOut = h[Math.min(n - 1, iMax + 30)].sp;
      V.push({ porteur: h.slice(i0, iMax).some((x) => x.porteur), coupe: h.slice(i0, iMax).some((x) => x.coupe), seed, t: a.t, ang: maxAbs * D, dur: h[tB].t - h[tA].t, rMin, sp0: a.sp, spMin, spOut, vol: vol / maxAbs, unAppui: unAppui / maxAbs, busy: h.slice(i0, iMax).some((x) => x.busy) });
    }
  }
}
const q = (xs, f) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(f * (s.length - 1))] : NaN; };
const m = (X, f, d = 2) => X.length ? `${q(X.map(f), 0.5).toFixed(d)} [${q(X.map(f), 0.1).toFixed(d)}–${q(X.map(f), 0.9).toFixed(d)}]` : '—';
for (const [nom, X] of [['45-90°', V.filter((v) => v.ang < 90 && !v.busy && !v.porteur)], ['90-135°', V.filter((v) => v.ang >= 90 && v.ang < 135 && !v.busy && !v.porteur)], ['≥ 135°', V.filter((v) => v.ang >= 135 && !v.busy && !v.porteur)], ['porteur', V.filter((v) => v.porteur && !v.busy)], ['sous geste', V.filter((v) => v.busy)]])
  console.log(`${nom.padEnd(10)} ${String(X.length).padStart(4)} virages : durée ${m(X, (v) => v.dur)} s, rayon au plus serré ${m(X, (v) => v.rMin)} m, allure ${m(X, (v) => v.sp0, 1)} → min ${m(X, (v) => v.spMin, 1)} → sortie ${m(X, (v) => v.spOut, 1)} m/s (min/entrée ${m(X, (v) => v.spMin / v.sp0)}), part pendant un VOL ${m(X, (v) => 100 * v.vol, 0)} %, le plus grand morceau en UN appui ${m(X, (v) => 100 * v.unAppui, 0)} %, par une COUPE ${X.length ? (100 * X.filter((v) => v.coupe).length / X.length).toFixed(0) : '—'} %`);
console.log(`${V.length} virages en ${Number(NG) * Number(SECS) / 60} min (${(V.length / (Number(NG) * Number(SECS) / 60)).toFixed(1)}/min)`);
