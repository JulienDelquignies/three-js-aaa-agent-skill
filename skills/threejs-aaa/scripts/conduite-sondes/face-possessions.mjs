// LES POSSESSIONS DE CHAMP DU DUEL (face.js — « le porteur va davantage chercher le défenseur ») : par possession, la durée, la situation
// « défenseur côté but » (cône 50° vers le but, ≤ 7 m), l'approche, le face-à-face, l'issue ; et, défenseur côté but, le CAP du porteur (vers lui /
// de côté / DOS / arrêté) par bande de distance. Usage : node face-possessions.mjs [graines=8] [secondes=120]
// Les possessions de joueur de champ : durée, situation « défenseur côté but » (cône 50° vers le but, ≤ 7 m), cap du porteur, issue.
import { makeDuel, duelCfg } from '../../assets/starter/src/engine/duel-1v1.js';
import { matchStep } from '../../assets/starter/src/engine/match-sim.js';
const [NG = '8', SECS = '120'] = process.argv.slice(2);
const q = (xs, f) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(f * (s.length - 1))] : NaN; };
const P = [], cap = { vers: 0, cote: 0, dos: 0, arret: 0 }, capD = {}; let tDev = 0, tCar = 0;
for (let seed = 1; seed <= +NG; seed++) { const st = makeDuel({ seed }), cfg = duelCfg(); let ne = 0, cur = null;
  for (let i = 0; i < +SECS * 60; i++) { matchStep(st, 1 / 60, cfg); const evs = []; while (ne < st.events.length) evs.push(st.events[ne++]);
    const c = st.players[st.possession?.carrier ?? -1], ok = c && !c.keeper && st.phase === 'carry' && !st.restart;
    if (cur && (!ok || c.id !== cur.by)) { cur.fin = !c ? (st.restart ? 'arret-jeu' : 'libre') : c.keeper ? (c.team === cur.team ? 'au-gardien' : 'gardien-adv') : c.team === cur.team ? 'coequipier' : 'perdu';
      if (cur.tir) cur.fin = 'tir'; P.push(cur); cur = null; }
    if (!ok) continue; if (!cur) cur = { by: c.id, team: c.team, t0: st.t, dur: 0, dev: 0, dmin: 99, face: false, tir: false, app: false };
    cur.dur += 1 / 60; tCar += 1 / 60; if (evs.some((e) => e.type === 'shot' && e.by === c.id)) cur.tir = true; if (evs.some((e) => e.type === 'face' && e.phase === 'entre')) cur.face = true; if (c._faceApp?.go) cur.app = true;
    const g = st.pitch.attackGoal(c.team), gx = g.x - c.p[0], gz = -c.p[2], gl = Math.hypot(gx, gz), q2 = st.players.find((p) => p.team !== c.team && !p.keeper), dx = q2.p[0] - c.p[0], dz = q2.p[2] - c.p[2], d = Math.hypot(dx, dz);
    if (d <= 7 && (dx * gx + dz * gz) / (d * gl) > Math.cos(50 * Math.PI / 180) && gl >= 6.5) { cur.dev += 1 / 60; tDev += 1 / 60; cur.dmin = Math.min(cur.dmin, d);
      const k = c.speed < 0.5 ? 'arret' : (() => { const a = Math.acos(Math.max(-1, Math.min(1, (dx * c.v[0] + dz * c.v[1]) / (d * c.speed)))) * 180 / Math.PI; return a <= 60 ? 'vers' : a <= 110 ? 'cote' : 'dos'; })();
      cap[k] += 1 / 60; const band = d < 2 ? '<2' : d < 4 ? '2-4' : '4-7'; (capD[band] ??= { vers: 0, cote: 0, dos: 0, arret: 0 })[k] += 1 / 60; } } }
const n = P.length, pc = (a) => (100 * a / Math.max(1, n)).toFixed(0) + ' %', fins = {}; for (const p of P) fins[p.fin] = (fins[p.fin] ?? 0) + 1;
console.log(`${n} possessions de champ (${(n / (+NG * +SECS / 60)).toFixed(1)}/min), durée ${q(P.map((p) => p.dur), 0.5).toFixed(1)} s [${q(P.map((p) => p.dur), 0.1).toFixed(1)}–${q(P.map((p) => p.dur), 0.9).toFixed(1)}] ; porteur de champ ${(100 * tCar / (+NG * +SECS)).toFixed(0)} % du temps`);
console.log(`  avec défenseur côté but ≤ 7 m : ${pc(P.filter((p) => p.dev > 0.2).length)} ; approche lancée ${pc(P.filter((p) => p.app).length)} ; face-à-face ${pc(P.filter((p) => p.face).length)} ; fins : ${Object.entries(fins).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pc(v)}`).join(', ')}`);
const T = Object.values(cap).reduce((a, b) => a + b, 0); console.log(`  défenseur côté but (${tDev.toFixed(0)} s) — le porteur va VERS lui ${(100 * cap.vers / T).toFixed(0)} %, de côté ${(100 * cap.cote / T).toFixed(0)} %, DOS ${(100 * cap.dos / T).toFixed(0)} %, arrêté ${(100 * cap.arret / T).toFixed(0)} %`);
for (const [b, v] of Object.entries(capD)) { const t = Object.values(v).reduce((a, x) => a + x, 0); console.log(`    à ${b} m (${t.toFixed(0)} s) : vers ${(100 * v.vers / t).toFixed(0)} %, côté ${(100 * v.cote / t).toFixed(0)} %, dos ${(100 * v.dos / t).toFixed(0)} %, arrêté ${(100 * v.arret / t).toFixed(0)} %`); }
