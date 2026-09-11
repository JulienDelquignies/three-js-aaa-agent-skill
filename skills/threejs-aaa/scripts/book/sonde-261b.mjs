// sonde 261b — les RUPTURES par sorte : combien, quelle distance, quelle part de HI, quelle pointe atteinte, à quelle distance du ballon elles se déclenchent ; et la distance/HI des métiers HORS rupture par moment.
import { makeMatch, matchStep, matchCfg } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/match-sim.js';
import { momentDuJeu } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/phases.js';
const seeds = (process.argv[2] ?? '3').split(',').map(Number), over = JSON.parse(process.argv[3] ?? '{}'), DUR = +(process.argv[4] ?? 1800);
const K = {}, J = {}; let dist = 0, n = 0, minutes = 0, still = 0, frames = 0;
for (const seed of seeds) {
  const st = makeMatch({ full: true, seed }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: 2700, pause: 10 }, ...over }); n++;
  const P = st.players.filter((p) => !p.keeper), cur = new Map();
  for (let i = 0; i < DUR * 60; i++) {
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break; frames++;
    for (const p of P) { const v = Math.hypot(p.v[0], p.v[1]), dd = v / 60; dist += dd; if (v < 0.5) still++;
      const on = (p._pace?.until ?? -1) > st.t;
      if (on) { const k = p._pace.kind ?? '?'; let c = cur.get(p.id); if (c && c.k !== k) { const R0 = K[c.k]; R0.d += c.d; R0.hi += c.hi; R0.vmax.push(c.vmax); R0.dur.push(st.t - c.t0); c = null; } if (!c) { c = { k, until: p._pace.until, d: 0, hi: 0, vmax: 0, dB: Math.hypot(p.p[0] - st.ball.p[0], p.p[2] - st.ball.p[2]), t0: st.t, mine: st.possession.team === p.team, mom: momentDuJeu(st, p.team, 5) }; cur.set(p.id, c); const R = (K[k] ??= { n: 0, d: 0, hi: 0, vmax: [], dB: [], dur: [], mine: 0, mom: {} }); R.n++; R.dB.push(c.dB); if (c.mine) R.mine++; R.mom[c.mom] = (R.mom[c.mom] ?? 0) + 1; } c.d += dd; if (v > 5.5) c.hi += dd; if (v > c.vmax) c.vmax = v; }
      else { const c = cur.get(p.id); if (c) { const R = K[c.k]; R.d += c.d; R.hi += c.hi; R.vmax.push(c.vmax); R.dur.push(st.t - c.t0); cur.delete(p.id); }
        const j = `${p.job}/${momentDuJeu(st, p.team, 5)}`; const R = (J[j] ??= { d: 0, hi: 0 }); R.d += dd; if (v > 5.5) R.hi += dd; } }
  }
  minutes += frames / 3600;
}
const nJ = n * 20, q = (a, x) => { a = [...a].sort((u, v) => u - v); return a.length ? a[Math.floor(x * a.length)] : NaN; };
let hiTot = 0, dTot = 0; for (const R of Object.values(K)) { hiTot += R.hi; dTot += R.d; } for (const R of Object.values(J)) { hiTot += R.hi; dTot += R.d; }
console.log(`HI total ${(hiTot / nJ / (minutes / n) * 90).toFixed(0)} m /joueur/90, dist ${(dTot / nJ / (minutes / n) * 90).toFixed(0)}`);
console.log(`${n} × ${(minutes / n).toFixed(0)} min ${JSON.stringify(over)} — ${(dist / nJ / 1000).toFixed(2)} km/joueur ; immobile (< 0,5 m/s) ${(100 * still / frames / 20).toFixed(1)} % du temps (réel ~59 % hors mouvement intentionnel)`);
for (const [k, R] of Object.entries(K).sort((a, b) => b[1].hi - a[1].hi)) console.log(`  rupture ${k.padEnd(14)} ${(R.n / nJ / (minutes / n) * 90).toFixed(1).padStart(6)} /joueur/90 min ; dist ${(R.d / nJ / (minutes / n) * 90).toFixed(0).padStart(4)} m, HI ${(R.hi / nJ / (minutes / n) * 90).toFixed(0).padStart(4)} m /joueur/90 ; vmax p50 ${q(R.vmax, 0.5).toFixed(1)} p90 ${q(R.vmax, 0.9).toFixed(1)} ; durée p50 ${q(R.dur, 0.5).toFixed(2)} s ; dB p50 ${q(R.dB, 0.5).toFixed(0)} m p90 ${q(R.dB, 0.9).toFixed(0)} ; mon ballon ${(100 * R.mine / R.n).toFixed(0)} % ; ${Object.entries(R.mom).map(([m, c]) => `${m} ${c}`).join(', ')}`);
console.log('hors rupture, métier/moment (HI m /joueur/90 ; dist m) : ' + Object.entries(J).sort((a, b) => b[1].hi - a[1].hi).slice(0, 12).map(([k, R]) => `${k} ${(R.hi / nJ / (minutes / n) * 90).toFixed(0)} ; ${(R.d / nJ / (minutes / n) * 90).toFixed(0)}`).join(' | '));
