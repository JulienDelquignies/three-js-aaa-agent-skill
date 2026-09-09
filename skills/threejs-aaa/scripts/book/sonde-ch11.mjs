// sonde ch11 (Bible 11, transitions) — X1 pertes en jeu, X2 temps de reprise, X3/X4 tirs et buts après récupération, X5/X6 gradients de zone, X7 transition-transition, X8 vitesse du contre, X10 passes avant tir, X13 corps à 10 m à t0+1,5 s, X14 premier contact, X15 dispersion des départs en repli, X22 part du temps en transition, X23 origine des buts, X25 contre-pressings.
import { makeMatch, matchStep, matchCfg } from '../../assets/starter/src/engine/match-sim.js';
import { momentDuJeu } from '../../assets/starter/src/engine/phases.js';
const seeds = (process.argv[2] ?? '3,7').split(',').map(Number);
const o = { n: 0, possEnJeu: 0, possTot: 0, reprise: [], tirsRecup: [], butsRecup: [], tirsTot: 0, butsTot: 0, zoneRecup: {}, zonePerte: {}, tt: { court: [0, 0], long: [0, 0] }, vContre: [], passesAvantTir: [], corps15: [], contact: [], stdRepli: [], trans: 0, jeu: 0, origine: { transition10: 0, transition15: 0, enJeu: 0, cpa: 0 }, cpress: 0 };
const zoneDe = (x) => x < 10.5 ? '0-10,5' : x < 21 ? '10,5-21' : x < 52.5 ? '21-52,5' : x < 84 ? '52,5-84' : x < 94.5 ? '84-94,5' : '94,5+';
for (const seed of seeds) {
  const st = makeMatch({ full: true, seed }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: 2700, pause: 10 } }); o.n++;
  let seen = 0, cur = null, prev = null, lastRestartEnd = -9; const prevP = new Map();
  const finPoss = (p, t) => { if (!p) return; p.dur = t - p.t0; if (p.enJeu) { o.possEnJeu++; if (p.perte && p.perdant != null) { /* X2 : temps de reprise pour le perdant */ } } };
  for (let i = 0; i < 5400 * 60; i++) {
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break;
    const vel = new Map(); for (const p of st.players) { const pv = prevP.get(p.id); vel.set(p.id, pv ? [(p.p[0] - pv[0]) * 60, (p.p[2] - pv[1]) * 60] : [0, 0]); prevP.set(p.id, [p.p[0], p.p[2]]); }
    if (st.restart) { lastRestartEnd = st.t; } else { o.jeu++; if (momentDuJeu(st, 0, 5).startsWith('transition')) o.trans++; }
    const team = st.possession.team;
    if (team >= 0 && (!cur || cur.team !== team)) {
      const enJeu = !st.restart && st.t - lastRestartEnd > 0.5 && cur != null;
      if (cur) { cur.dur = st.t - cur.t0; cur.fin = st.t; }
      const og = st.pitch.ownGoal(team); const x0 = Math.abs(st.ball.p[0] - og.x);
      const nv = { team, t0: st.t, x0, enJeu, passes: 0, tir: false, but: false, prevDur: cur?.dur ?? 99, prevEnJeu: cur?.enJeu ?? false, loser: 1 - team, contact: null, corps15: null, repliT: new Map(), cpress: false, tirSubi10: false };
      o.possTot++; if (enJeu) { o.possEnJeu++; if (cur) o.reprise.push(0); /* placeholder rempli à la reprise */ }
      // X2 : le perdant (cur.team) reprend quand une possession future lui revient ; on mémorise sa perte
      if (cur && cur.enJeu !== undefined) nv.perteDe = { team: cur.team, t: st.t, enJeu, x: Math.abs(st.ball.p[0] - st.pitch.ownGoal(cur.team).x) };
      if (prev && prev.team === team && prev.lossT != null && enJeu && cur?.enJeu) { o.reprise.push(st.t - prev.lossT); }
      prev = cur; if (prev) prev.lossT = st.t; cur = nv;
      if (enJeu) { const z = zoneDe(x0); (o.zoneRecup[z] ??= [0, 0, 0])[0]++; if (prev) { const zp = zoneDe(Math.abs(st.ball.p[0] - st.pitch.ownGoal(prev.team).x)); (o.zonePerte[zp] ??= [0, 0])[0]++; cur.zonePerte = zp; } }
    }
    if (cur && cur.enJeu && !st.restart) {
      const dt = st.t - cur.t0, c = st.possession.carrier >= 0 ? st.players[st.possession.carrier] : null;
      if (c) {
        // X14 premier contact d'un contre-presseur ; X13 corps à 10 m à t0 + 1,5 s ; X25 contre-pressing (≥ 2 en course > 2 m/s vers le ballon dans les 5 s)
        const L = st.players.filter((p) => p.team === cur.loser && !p.keeper && p.down <= 0);
        if (!cur.pres0) { cur.pres0 = new Set(L.filter((p) => Math.hypot(p.p[0] - c.p[0], p.p[2] - c.p[2]) < 3).map((p) => p.id)); }
        if (cur.contact == null && dt < 5) { for (const p of L) if (!cur.pres0.has(p.id) && Math.hypot(p.p[0] - c.p[0], p.p[2] - c.p[2]) < 1.5) { cur.contact = dt; o.contact.push(dt); break; } }
        if (cur.corps15 == null && dt >= 1.5) { cur.corps15 = L.filter((p) => Math.hypot(p.p[0] - st.ball.p[0], p.p[2] - st.ball.p[2]) < 10).length; o.corps15.push(cur.corps15); }
        if (!cur.cpress && dt < 5) { let k = 0; for (const p of L) { const v = vel.get(p.id), sp = Math.hypot(v[0], v[1]); if (sp < 2) continue; const dx = st.ball.p[0] - p.p[0], dz = st.ball.p[2] - p.p[2], dn = Math.hypot(dx, dz); if (dn > 1 && (v[0] * dx + v[1] * dz) / (sp * dn) > 0.5) k++; } if (k >= 2) { cur.cpress = true; o.cpress++; } }
        // X15 : instants de départ en repli (composante de vitesse vers son but > 1,5 m/s) dans les 4 s
        if (dt < 4) { const ogL = st.pitch.ownGoal(cur.loser); for (const p of L) if (!cur.repliT.has(p.id)) { const v = vel.get(p.id); if (v[0] * ogL.sign > 1.5) cur.repliT.set(p.id, dt); } }
        if (dt >= 4 && !cur.repliDone) { cur.repliDone = true; const ts = [...cur.repliT.values()]; if (ts.length >= 4) { const m = ts.reduce((a, b) => a + b, 0) / ts.length; o.stdRepli.push(Math.sqrt(ts.reduce((a, t) => a + (t - m) ** 2, 0) / ts.length)); } }
      }
    }
    for (; seen < st.events.length; seen++) { const e = st.events[seen]; if (!cur) continue; const by = st.players[e.by]; if (!by && e.type !== 'but') continue;
      if (e.type === 'pass' && by.team === cur.team) cur.passes++;
      if (e.type === 'shot' && by.team === cur.team) { o.tirsTot++; const dt = st.t - cur.t0; if (cur.enJeu) { o.tirsRecup.push(dt); if (!cur.tir) { cur.tir = true; o.passesAvantTir.push(cur.passes); const z = zoneDe(cur.x0); (o.zoneRecup[z] ??= [0, 0, 0])[1]++; if (cur.zonePerte) (o.zonePerte[cur.zonePerte] ??= [0, 0])[1] += dt <= 10 ? 1 : 0; if (dt <= 10) { const g = cur.prevEnJeu ? (cur.prevDur <= 3 ? 'court' : cur.prevDur > 12 ? 'long' : null) : null; if (g) o.tt[g][1]++; } if (dt <= 15 && cur.x0 < 52.5) { const og = st.pitch.ownGoal(cur.team); o.vContre.push((Math.abs(by.p[0] - og.x) - cur.x0) / Math.max(0.5, dt)); } } } }
      if (e.type === 'but') { o.butsTot++; const dt = st.t - cur.t0; if (cur.enJeu) { o.butsRecup.push(dt); o.origine.enJeu++; if (dt <= 10) o.origine.transition10++; if (dt <= 15) o.origine.transition15++; const z = zoneDe(cur.x0); (o.zoneRecup[z] ??= [0, 0, 0])[2]++; } else o.origine.cpa++; }
    }
    if (cur && cur.enJeu && cur.prevEnJeu && !cur.ttCounted) { cur.ttCounted = true; const g = cur.prevDur <= 3 ? 'court' : cur.prevDur > 12 ? 'long' : null; if (g) o.tt[g][0]++; }
  }
}
const q = (a, x) => { a = [...a].sort((u, v) => u - v); return a.length ? a[Math.floor(x * a.length)] : NaN; }; const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN; const pct = (a, f) => a.length ? (100 * a.filter(f).length / a.length).toFixed(0) : 'NaN';
const n = o.n;
console.log(`${n} × 90 min`);
console.log(`X1  possessions démarrées par une perte en jeu / match (deux équipes) : ${(o.possEnJeu / n).toFixed(0)} (cible 242 ±15 %) ; toutes possessions ${(o.possTot / n).toFixed(0)}`);
const rep = o.reprise.filter((x) => x > 0); console.log(`X2  temps de reprise après perte (jeu continu, ${rep.length}) : p50 ${q(rep, 0.5).toFixed(1)} s (cible 9,0), p10 ${q(rep, 0.1).toFixed(1)} (3,2), p90 ${q(rep, 0.9).toFixed(1)} (28,6) ; ≤ 5 s ${pct(rep, (x) => x <= 5)} % (24), ≤ 10 s ${pct(rep, (x) => x <= 10)} % (55)`);
console.log(`X3  tirs après récupération en jeu : ≤ 5 s ${pct(o.tirsRecup, (x) => x <= 5)} % / ≤ 10 s ${pct(o.tirsRecup, (x) => x <= 10)} % (cibles 44 / 62) sur ${o.tirsRecup.length} tirs ; X4 buts ≤ 10 s ${pct(o.butsRecup, (x) => x <= 10)} % (65) sur ${o.butsRecup.length}`);
console.log(`X5  zone de récupération → [possessions, tirs, buts] : ${Object.entries(o.zoneRecup).sort().map(([z, v]) => `${z} m : ${v[0]} / ${v[1]} / ${v[2]} (but ${(100 * v[2] / Math.max(1, v[0])).toFixed(2)} %)`).join(' ; ')} (cible 84-94,5 : 3,0 % ; 0-10,5 : 0,16 %)`);
console.log(`X6  zone de perte → tir adverse ≤ 10 s : ${Object.entries(o.zonePerte).sort().map(([z, v]) => `${z} m : ${(100 * v[1] / Math.max(1, v[0])).toFixed(1)} % (${v[0]})`).join(' ; ')} (cible 10,5-21 : ≥ 25 % ; 84-94,5 : ≤ 0,5 %)`);
console.log(`X7  transition-transition — tir adverse ≤ 10 s après une possession de ≤ 3 s : ${(100 * o.tt.court[1] / Math.max(1, o.tt.court[0])).toFixed(1)} % (${o.tt.court[0]}) ; après > 12 s : ${(100 * o.tt.long[1] / Math.max(1, o.tt.long[0])).toFixed(1)} % (${o.tt.long[0]}) (cibles 8,0 / 1,2, rapport ≥ 5)`);
console.log(`X8  vitesse de progression en contre (récup. dans son camp, tir ≤ 15 s) : p50 ${q(o.vContre, 0.5).toFixed(2)} m/s, p90 ${q(o.vContre, 0.9).toFixed(2)} (cibles 5,55 / 8,1) sur ${o.vContre.length}`);
console.log(`X10 passes avant le premier tir d'une possession récupérée : moyenne ${mean(o.passesAvantTir).toFixed(1)} (cible 2,7 sur les contres), 0 passe ${pct(o.passesAvantTir, (x) => x === 0)} % (29), ≤ 2 ${pct(o.passesAvantTir, (x) => x <= 2)} % (59)`);
console.log(`X13 corps de l'équipe qui a perdu à < 10 m du ballon à t0 + 1,5 s : moyenne ${mean(o.corps15).toFixed(1)} (cible 3-5 école Red Bull) ; X14 premier contact (< 1,5 m) : p50 ${q(o.contact, 0.5).toFixed(2)} s (cible 0,9-1,6), contact < 5 s dans ${(100 * o.contact.length / Math.max(1, o.possEnJeu)).toFixed(0)} % des pertes`);
console.log(`X15 écart-type des instants de départ en repli (≥ 4 partants) : p50 ${(1000 * q(o.stdRepli, 0.5)).toFixed(0)} ms (cible ≥ 120) sur ${o.stdRepli.length} pertes`);
console.log(`X22 part du temps en transition (fenêtre moteur 5 s) : ${(100 * o.trans / o.jeu).toFixed(0)} % (cible 15-30)`);
console.log(`X23 origine des buts (${o.butsTot}) : possession née d'une perte en jeu ${o.origine.enJeu} dont ≤ 10 s ${o.origine.transition10} (${(100 * o.origine.transition10 / Math.max(1, o.butsTot)).toFixed(0)} %) et ≤ 15 s ${o.origine.transition15} ; issue d'un arrêt de jeu ${o.origine.cpa} (${(100 * o.origine.cpa / Math.max(1, o.butsTot)).toFixed(0)} %) (cibles D3 47-53 %, CPA 15-25 %)`);
console.log(`X25 contre-pressings (≥ 2 corps en course > 2 m/s vers le ballon dans les 5 s) / match / équipe : ${(o.cpress / 2 / n).toFixed(0)} (cible 20-30) sur ${(o.possEnJeu / 2 / n).toFixed(0)} pertes`);
