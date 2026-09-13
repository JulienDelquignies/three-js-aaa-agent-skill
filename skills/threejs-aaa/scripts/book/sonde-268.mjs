// sonde 268 — LE NOYAU COMMUN DE DUEL (Modèle 11 lot 1) : les take-ons (gestes de dribble contre un homme) par bande de terrain et par issue (les huit du book), le contraste axe / couloir du dernier tiers, les fautes, les touches, le volume ; la mesure d'hier (sonde MC11 : gardé à 1,5 s) en regard.
import { makeMatch, matchStep, matchCfg } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/match-sim.js';
const seeds = (process.argv[2] ?? '3,7').split(',').map(Number), over = JSON.parse(process.argv[3] ?? '{}'), DUR = +(process.argv[4] ?? 2700);
const ISS = ['FRANCHI', 'FRANCHI_FAUTE', 'FRANCHI_SORTIE', 'NEUTRE_TOUCHE', 'NEUTRE', 'DEPOSSEDE', 'DEPOSSEDE_FAUTE', 'DEPOSSEDE_SORTIE'], CIBLE = [44.6, 11.6, 3.2, 10.0, 3.3, 24.1, 0.7, 2.3];
const o = { n: 0, take: {}, old: { garde: 0, faute: 0, touche: 0, perdu: 0, n: 0 }, issues: Object.fromEntries(ISS.map((k) => [k, 0])), band: {}, tiers: { axe: [0, 0], couloir: [0, 0] }, fautes: 0, touches: 0, gestes: 0, gestesFoe: 0, tirs: 0, buts: 0, jaunes: 0, mu: [], remap: 0, DUMP: [] };
const hyp = Math.hypot;
for (const seed of seeds) {
  const { _tactics, ...overC } = over; if (overC.noyau) overC.noyau = { ...matchCfg({}).noyau, ...overC.noyau };
  const st = makeMatch({ full: true, seed, tactics: _tactics ?? null }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: DUR, pause: 10 }, ...overC }); o.n++;
  let seen = 0; const pend = [];
  for (let i = 0; i < DUR * 60 + 600; i++) {
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break;
    const ow = st.ball.owner ?? -1;
    for (const w of pend) if (!w.done && st.t - w.t >= 1.5) { w.done = true; o.old.n++; if (ow === w.by || (ow >= 0 && st.players[ow].team === w.team && st.possession.team === w.team)) o.old.garde++; else if (w.faute) o.old.faute++; else if (w.touche) o.old.touche++; else o.old.perdu++; }
    for (; seen < st.events.length; seen++) { const e = st.events[seen]; const by = st.players[e.by];
      if (e.type === 'skill' && by && !by.keeper && ['passement', 'crochet', 'doubleContact', 'petitPont', 'roulette'].includes(e.kind)) { o.gestes++; let dm = 99; for (const q of st.players) if (q.team !== by.team && !q.keeper && q.down <= 0) dm = Math.min(dm, hyp(q.p[0] - by.p[0], q.p[2] - by.p[2])); if (dm < 2.2) o.gestesFoe++; pend.push({ t: st.t, by: e.by, team: by.team, done: false }); }
      if (e.type === 'duel' && e.kind === 'take-on') { o.issues[e.issue] = (o.issues[e.issue] ?? 0) + 1; const b = e.x < 0.3 ? '20-30 %' : e.x < 0.5 ? '30-50 %' : e.x < 0.7 ? '50-70 %' : e.x < 0.8 ? '70-80 %' : e.x < 0.9 ? '80-90 %' : '90-100 %'; const B = o.band[b] ??= { n: 0, g: 0, p: 0 }; B.n++; if (e.issue.startsWith('FRANCHI')) B.g++; if (e.issue.startsWith('DEPOSSEDE')) B.p++; if (e.x >= 0.67) { const T = o.tiers[e.couloir ? 'couloir' : 'axe']; T[1]++; if (e.issue.startsWith('FRANCHI')) T[0]++; } if (e.mu != null) o.mu.push(e.mu); if (e.remap) o.remap++; if (e.f && process.env.DUMP) o.DUMP.push(JSON.stringify({ issue: e.issue, f: e.f, x: e.x })); }
      if (e.type === 'faute') { o.fautes++; const w = pend.slice().reverse().find((p) => !p.done && st.t - p.t < 1.5 && p.by === e.sur); if (w) w.faute = true; }
      if (e.type === 'sortie' && e.out === 'touche') { o.touches++; const w = pend.slice().reverse().find((p) => !p.done && st.t - p.t < 1.5); if (w) w.touche = true; }
      if (e.type === 'carton' && e.couleur === 'jaune') o.jaunes++;
      if (e.type === 'shot') o.tirs++;
    }
  }
  o.buts += (st.score?.[0] ?? 0) + (st.score?.[1] ?? 0);
}
const n = o.n, pc = (a, b) => b ? (100 * a / b).toFixed(0) + ' %' : '—', tot = Object.values(o.issues).reduce((a, b) => a + b, 0), q = (a, x) => { a = [...a].sort((u, v) => u - v); return a.length ? a[Math.floor(x * a.length)].toFixed(2) : '—'; };
console.log(`${n} × ${DUR / 60} min ${JSON.stringify(over)} — gestes de dribble ${(o.gestes / n).toFixed(0)} / match dont ${(o.gestesFoe / n).toFixed(0)} contre un homme à < 2,2 m (réel 25 take-ons déclarés / match) ; take-ons jugés par le noyau ${(tot / n).toFixed(0)} / match ; fautes ${(o.fautes / n).toFixed(1)} / match (réel 21,4), jaunes ${(o.jaunes / n).toFixed(1)}, touches ${(o.touches / n).toFixed(0)} (réel 37-44) ; tirs ${(o.tirs / n).toFixed(1)}, buts ${(o.buts / n).toFixed(1)}`);
console.log(`  hier (gardé à 1,5 s, ${o.old.n}) : gardé ${pc(o.old.garde, o.old.n)}, faute obtenue ${pc(o.old.faute, o.old.n)}, touche ${pc(o.old.touche, o.old.n)}, perdu ${pc(o.old.perdu, o.old.n)}`);
if (tot) {
  console.log(`  issues du noyau (${tot}) : ${ISS.map((k, i) => `${k} ${pc(o.issues[k], tot)} (book ${CIBLE[i]})`).join(', ')} — franchi ${pc(ISS.filter((k) => k.startsWith('FRANCHI')).reduce((a, k) => a + o.issues[k], 0), tot)} (book 59,4), dépossédé ${pc(ISS.filter((k) => k.startsWith('DEPOSSEDE')).reduce((a, k) => a + o.issues[k], 0), tot)} (27,1) ; faute obtenue ${pc(o.issues.FRANCHI_FAUTE, tot)} (9-14), en touche ${pc(o.issues.FRANCHI_SORTIE + o.issues.NEUTRE_TOUCHE + o.issues.DEPOSSEDE_SORTIE, tot)} (12-19) ; remappées loin de la ligne ${o.remap} ; μ* p10/p50/p90 ${q(o.mu, 0.1)} / ${q(o.mu, 0.5)} / ${q(o.mu, 0.9)} m`);
  console.log(`  gradient par bande (P gagné / P perdu ; book 0,680 → 0,414 et 0,201 → 0,353) : ${Object.entries(o.band).sort().map(([b, B]) => `${b} ${pc(B.g, B.n)} / ${pc(B.p, B.n)} (${B.n})`).join(' ; ')}`);
  console.log(`  dernier tiers axe ${pc(o.tiers.axe[0], o.tiers.axe[1])} (${o.tiers.axe[1]}) c. couloir ${pc(o.tiers.couloir[0], o.tiers.couloir[1])} (${o.tiers.couloir[1]}) — book 0,574 c. 0,498 (contraste 0,03-0,14)`);
}
if (process.env.DUMP) { const fs = await import('node:fs'); fs.writeFileSync(process.env.DUMP, o.DUMP.join('\n') + '\n'); }
