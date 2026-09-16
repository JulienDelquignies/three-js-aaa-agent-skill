// sonde 280b — LE FILM DE LA LIGNE (Bible 10 §3.4) : l'avancement de la ligne arrière défendante (référence : le 2ᵉ plus reculé des
// défenseurs de champ, depuis sa ligne de but) contre l'avancement du ballon, par bande de ballon et par état du porteur (couvert /
// entre-deux / découvert) — le book : x_ligne = min(consigne, x_ballon − marge), marge −2..+1 couvert, +2..+4 entre-deux, +6..+12 découvert.
import { makeMatch, matchStep, matchCfg } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/match-sim.js';
const seeds = (process.argv[2] ?? '3,7').split(',').map(Number), over = JSON.parse(process.argv[3] ?? '{}'), DUR = +(process.argv[4] ?? 2700);
const bins = ['<20', '20-30', '30-40', '40-50', '50-60', '60+']; const binOf = (x) => x < 20 ? 0 : x < 30 ? 1 : x < 40 ? 2 : x < 50 ? 3 : x < 60 ? 4 : 5;
const acc = {}; const add = (k, v) => { const a = (acc[k] ??= []); a.push(v); };
const ref2 = (avs) => { let lo = Infinity, s = Infinity; for (const a of avs) { if (a < lo) { s = lo; lo = a; } else if (a < s) s = a; } return s; };
for (const seed of seeds) {
  const st = makeMatch({ full: true, seed }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: DUR, pause: 10 }, ...over });
  for (let i = 0; i < DUR * 60 * 2.4; i++) {
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break; if (i % 6) continue; if (st.restart) continue;
    const atk = st.possession?.team; if (atk == null) continue; const def = 1 - atk; const own = st.pitch.ownGoal(def); const sg = Math.sign(own.x || 1);
    const av = (x) => (own.x - x) * sg; const xb = av(st.ball.p[0]); if (xb < 5) continue;
    const ds = st.players.filter((q) => q.team === def && !q.keeper && q.down <= 0 && !q.expulse && !q._sub).map((q) => av(q.p[0]));
    const line = ref2(ds); const etat = st._bCouvert?.[def]?.etat ?? '—';
    add(bins[binOf(xb)] + '|' + etat, xb - line); add(bins[binOf(xb)] + '|ligne', line); add('all|' + etat, xb - line);
  }
}
const q = (a, x) => { a = [...a].sort((u, v) => u - v); return a.length ? a[Math.floor(x * a.length)] : NaN; };
console.log(`${seeds.length} × ${(DUR / 60).toFixed(0)} min ${JSON.stringify(over)} — ballon − ligne (m, p50 [p10 ; p90]) par bande d'avancement du ballon (depuis le but défendu) et état du porteur ; ligne = avancement p50 de la ligne`);
for (const b of bins) { const parts = []; for (const e of ['couvert', 'entre-deux', 'découvert']) { const a = acc[b + '|' + e]; if (a?.length) parts.push(`${e} ${q(a, 0.5).toFixed(1)} [${q(a, 0.1).toFixed(1)} ; ${q(a, 0.9).toFixed(1)}] (${a.length})`); } const L = acc[b + '|ligne']; console.log(`  ballon ${b} m : ligne à ${L?.length ? q(L, 0.5).toFixed(1) : '—'} m du but ; ${parts.join(' ; ')}`); }
for (const e of ['couvert', 'entre-deux', 'découvert']) { const a = acc['all|' + e]; if (a?.length) console.log(`  tout terrain, ${e} : ballon − ligne p50 ${q(a, 0.5).toFixed(1)} m (book : couvert −2..+1, entre-deux +2..+4, découvert +6..+12)`); }
