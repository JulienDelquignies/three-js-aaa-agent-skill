// sonde 269 — LA NATURE DES GESTES : les gestes de dribble par joueur (T15bis : le meilleur / le médian ≥ 5), le volume, le tacle glissé (D20 : 6,7 / match ; D21 : P(faute | glissé) 24 % c. debout 14 %), les cartons, le monde.
import { makeMatch, matchStep, matchCfg } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/match-sim.js';
const seeds = (process.argv[2] ?? '3,7').split(',').map(Number), over = JSON.parse(process.argv[3] ?? '{}'), DUR = +(process.argv[4] ?? 2700);
const per = {}, K = {}; let n = 0, slides = 0, slideWin = 0, slideF = 0, stand = 0, standMiss = 0, standF = 0, fautes = 0, jaunes = 0, rouges = 0, tirs = 0, buts = 0, take = 0;
for (const seed of seeds) {
  const { _tactics, ...overC } = over; if (overC.nature) overC.nature = { ...matchCfg({}).nature, ...overC.nature };
  const st = makeMatch({ full: true, seed, tactics: _tactics ?? null }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: DUR, pause: 10 }, ...overC }); n++;
  for (let i = 0; i < DUR * 60 + 600; i++) { matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break; }
  for (const e of st.events) {
    if (e.type === 'skill' && !/-vendu$/.test(e.kind)) { K[e.kind] = (K[e.kind] ?? 0) + 1; const k = `${seed}:${e.by}`; per[k] = (per[k] ?? 0) + 1; if (['passement', 'crochet', 'doubleContact', 'petitPont', 'roulette'].includes(e.kind)) take++; }
    if (e.type === 'slide') { slides++; if (e.won) slideWin++; }
    if (e.type === 'faute') { fautes++; if (/gliss/.test(e.kind ?? '')) slideF++; if (/debout/.test(e.kind ?? '')) standF++; }
    if (e.type === 'carton') { if (e.couleur === 'jaune') jaunes++; else rouges++; }
    if (e.type === 'duel' && e.tech === 'tacle-debout') stand++;
    if (e.type === 'duel' && e.won === false && !e.kind && !e.tech) standMiss++;
    if (e.type === 'shot') tirs++;
  }
  for (const p of st.players) if (!p.keeper && !p._sub) per[`${seed}:${p.id}`] ??= 0;
  buts += (st.score?.[0] ?? 0) + (st.score?.[1] ?? 0);
}
const pv = Object.values(per).sort((a, b) => b - a), tot = Object.values(K).reduce((a, b) => a + b, 0), pc = (a, b) => b ? (100 * a / b).toFixed(0) + ' %' : '—';
const med = pv[Math.floor(pv.length / 2)], best = pv[0], p90 = pv[Math.floor(pv.length * 0.1)];
console.log(`${n} × ${DUR / 60} min ${JSON.stringify(over)} — gestes ${(tot / n).toFixed(0)} / match (réel ≈ 40 ; take-ons ${(take / n).toFixed(0)}, réel 25) : ${Object.entries(K).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(v / n).toFixed(1)}`).join(', ')} ; T15bis le meilleur ${best} / le médian ${med} = ${(best / Math.max(1, med)).toFixed(1)} (≥ 5), p90 ${p90} ; tirs ${(tirs / n).toFixed(1)}, buts ${(buts / n).toFixed(1)}`);
console.log(`  glissés ${(slides / n).toFixed(1)} / match (réel 6,7), gagnés ${pc(slideWin, slides)}, P(faute | glissé) ${pc(slideF, slides)} (réel 24) ; tacles debout gagnés ${(stand / n).toFixed(1)}, manqués ${(standMiss / n).toFixed(1)}, P(faute | debout) ${pc(standF, stand + standMiss)} (réel 14) ; fautes ${(fautes / n).toFixed(1)} / match (réel 21,4), jaunes ${(jaunes / n).toFixed(1)} (3,1), rouges ${(rouges / n).toFixed(2)}`);
