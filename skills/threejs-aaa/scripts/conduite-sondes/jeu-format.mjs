// LE JEU DU DUEL, PAR MINUTE (sans navigateur, moteur STARTER) — « trop de tirs, pas assez de dribble » : tirs, buts, arrêts du gardien,
// gestes de dribble dans la foulée, duels, temps de conduite en course, pertes de balle, passes (au gardien), la portée et le xG des
// tirs, les joueurs figés (> 1,5 s sous 0,3 m/s hors gardien). Usage : node jeu-format.mjs [graines=8] [secondes=120] [cle=JSON …]
import { makeDuel, duelCfg } from '../../assets/starter/src/engine/duel-1v1.js';
import { matchStep } from '../../assets/starter/src/engine/match-sim.js';
const [NG = '8', SECS = '120', ...KV] = process.argv.slice(2);
const over = Object.fromEntries(KV.map((s) => { const i = s.indexOf('='); return [s.slice(0, i), JSON.parse(s.slice(i + 1))]; }));
const q = (xs, f) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(f * (s.length - 1))] : NaN; };
const T = { tirs: 0, buts: 0, arrets: 0, gestes: 0, duels: 0, conduite: 0, pertes: 0, passes: 0, fige: 0, range: [], xg: [], gk: {}, gestesK: {}, relances: 0 };
let minutes = 0;
for (let seed = 1; seed <= Number(NG); seed++) {
  const st = makeDuel({ seed }), cfg = duelCfg(over), dt = 1 / 60; let ne = 0, prevTeam = -1; const lent = {};
  for (let i = 0; i < Number(SECS) * 60; i++) {
    matchStep(st, dt, cfg);
    while (ne < st.events.length) { const e = st.events[ne++];
      if (e.type === 'shot') { T.tirs++; if (e.range != null) T.range.push(e.range); if (e.xg != null) T.xg.push(e.xg); }
      if (e.type === 'but') T.buts++;
      if (e.type === 'arrêt') { T.arrets++; T.gk[e.kind ?? e.mode ?? '?'] = (T.gk[e.kind ?? e.mode ?? '?'] ?? 0) + 1; }
      if (e.type === 'relance-main') T.relances++;
      if (e.type === 'skill' && e.foulee && !/-vendu/.test(e.kind)) { T.gestes++; T.gestesK[e.kind] = (T.gestesK[e.kind] ?? 0) + 1; }
      if (e.type === 'duel') T.duels++;
      if (e.type === 'pass') { const a = st.players[e.by], b = st.players[e.to]; T.passes++; const k = `${a?.keeper ? 'gardien' : 'champ'}→${!b ? '?' + e.to : b.team !== a?.team ? 'ADVERSE' : b.keeper ? 'gardien' : b.id === a?.id ? 'LUI' : 'champ'}${e.shot ? '(tir)' : e.clear ? '(dégagement)' : ''}`; (T.passesK ??= {})[k] = (T.passesK[k] ?? 0) + 1; }
    }
    const c = st.players[st.possession?.carrier ?? -1];
    if (c && st.phase === 'carry' && !st.restart && !c.act && !c.keeper && c.speed >= 1) T.conduite += dt;
    const tm = st.phase === 'carry' && c ? c.team : -1; if (tm >= 0 && prevTeam >= 0 && tm !== prevTeam) T.pertes++; if (tm >= 0) prevTeam = tm;
    for (const p of st.players) { if (p.keeper || st.restart) { lent[p.id] = 0; continue; } lent[p.id] = p.speed < 0.3 ? (lent[p.id] ?? 0) + dt : 0; if (lent[p.id] > 1.5 && lent[p.id] - dt <= 1.5) T.fige++; }
  }
  minutes += Number(SECS) / 60;
}
const pm = (n) => (n / minutes).toFixed(2);
console.log(`${NG} graines × ${SECS} s (${minutes.toFixed(0)} min) — PAR MINUTE : tirs ${pm(T.tirs)}, buts ${pm(T.buts)}, arrêts ${pm(T.arrets)}, gestes de dribble ${pm(T.gestes)}, duels ${pm(T.duels)}, pertes ${pm(T.pertes)}, passes ${pm(T.passes)}, relances du gardien ${pm(T.relances)}, joueurs figés > 1,5 s ${pm(T.fige)}`);
console.log(`  conduite en course ${(100 * T.conduite / (minutes * 60)).toFixed(0)} % du temps ; conversion ${T.tirs ? (100 * T.buts / T.tirs).toFixed(0) : '-'} % ; portée des tirs ${q(T.range, 0.5).toFixed(1)} [${q(T.range, 0.1).toFixed(1)}–${q(T.range, 0.9).toFixed(1)}] m ; xG ${T.xg.length ? `${q(T.xg, 0.5).toFixed(3)} [${q(T.xg, 0.1).toFixed(3)}–${q(T.xg, 0.9).toFixed(3)}]` : '-'}`);
console.log(`  passes : ${Object.entries(T.passesK ?? {}).map(([k, v]) => `${k} ${v}`).join(', ')}`);
console.log(`  gestes : ${Object.entries(T.gestesK).map(([k, v]) => `${k} ${v}`).join(', ')} ; arrêts : ${Object.entries(T.gk).map(([k, v]) => `${k} ${v}`).join(', ')}`);
