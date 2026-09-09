// sonde MC11/12/13 — duels : take-ons par bande de terrain et issues ; arbitrage : hors-jeu, fautes par jaune ; CPA : corners (profil, premier contact), coups francs directs, penalties, touches (rétention par bande), seconds ballons de CPA.
import { makeMatch, matchStep, matchCfg } from '../../assets/starter/src/engine/match-sim.js';
const seeds = (process.argv[2] ?? '3,7').split(',').map(Number);
const o = { n: 0, take: {}, takeIssue: { garde: 0, faute: 0, touche: 0, perdu: 0 }, horsJeu: 0, fautes: 0, jaunes: 0, corners: 0, cornerCible: {}, cornerGenre: {}, premierContact: { atk: 0, def: 0, gk: 0 }, cornerTir25: 0, cornerBut: 0, cfDirect: 0, cfBut: 0, cfDist: [], pen: 0, penBut: 0, touches: 0, toucheRet: {}, arrets: 0, arretsDur: [] };
for (const seed of seeds) {
  const st = makeMatch({ full: true, seed }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: 2700, pause: 10 } }); o.n++;
  let seen = 0; const pend = []; const cornersPend = []; const touchesPend = []; let lastRestart = null, restartT0 = null, penPend = null;
  for (let i = 0; i < 5400 * 60; i++) {
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break;
    if (st.restart && !lastRestart) { lastRestart = st.restart; restartT0 = st.t; } if (!st.restart && lastRestart) { o.arrets++; o.arretsDur.push(st.t - restartT0); if (lastRestart.type === 'penalty') { o.pen++; penPend = { t: st.t, team: lastRestart.team }; } if (lastRestart.type === 'touche') touchesPend.push({ t: st.t, team: lastRestart.team, x: Math.abs(lastRestart.p[0] - st.pitch.ownGoal(lastRestart.team).x), done: false }); lastRestart = null; }
    const ow = st.ball.owner ?? -1;
    for (const w of pend) if (!w.done && st.t - w.t >= 1.5) { w.done = true; if (ow === w.by || (ow >= 0 && st.players[ow].team === w.team && st.possession.team === w.team)) { o.takeIssue.garde++; w.ok = true; } else if (w.faute) o.takeIssue.faute++; else if (w.touche) o.takeIssue.touche++; else o.takeIssue.perdu++; (o.take[w.band] ??= [0, 0])[1]++; if (w.ok) o.take[w.band][0]++; }
    for (const c of cornersPend) { if (!c.contact && ow >= 0 && st.t - c.t > 0.3) { c.contact = true; const p = st.players[ow]; if (p.keeper) o.premierContact.gk++; else if (p.team === c.team) o.premierContact.atk++; else o.premierContact.def++; } }
    for (const w of touchesPend) if (!w.done && st.t - w.t >= 5) { w.done = true; const band = w.x < 35 ? 'déf' : w.x < 70 ? 'méd' : 'off'; (o.toucheRet[band] ??= [0, 0])[1]++; if (st.possession.team === w.team) o.toucheRet[band][0]++; }
    for (; seen < st.events.length; seen++) { const e = st.events[seen]; const by = st.players[e.by];
      if (e.type === 'skill' && by && !by.keeper) { const og = st.pitch.ownGoal(by.team); const x = Math.abs(by.p[0] - og.x) / 105; const band = x < 0.3 ? '0-30 %' : x < 0.6 ? '30-60 %' : x < 0.9 ? '60-90 %' : '90-100 %'; pend.push({ t: st.t, by: e.by, team: by.team, band, done: false }); }
      if (e.type === 'faute') { o.fautes++; const w = pend.slice().reverse().find((p) => !p.done && st.t - p.t < 1.5 && p.by === e.sur); if (w) w.faute = true; }
      if (e.type === 'sortie' && e.out === 'touche') { o.touches++; const w = pend.slice().reverse().find((p) => !p.done && st.t - p.t < 1.5); if (w) w.touche = true; }
      if (e.type === 'sortie' && e.out === 'hors-jeu') o.horsJeu++;
      if (e.type === 'carton' && e.couleur === 'jaune') o.jaunes++;
      if (e.type === 'corner-joué' && by) { o.corners++; o.cornerCible[e.cible] = (o.cornerCible[e.cible] ?? 0) + 1; o.cornerGenre[e.genre] = (o.cornerGenre[e.genre] ?? 0) + 1; cornersPend.push({ t: st.t, team: by.team, contact: false }); }
      if (e.type === 'shot' && by) { const c = cornersPend.find((k) => st.t - k.t < 25 && k.team === by.team && !k.tir); if (c) { c.tir = true; o.cornerTir25++; } if (e.kind === 'coup-franc-direct') { o.cfDirect++; const g = st.pitch.ownGoal(1 - by.team); o.cfDist.push(Math.hypot(by.p[0] - g.x, by.p[2])); } if (penPend && st.t - penPend.t < 3 && by.team === penPend.team) penPend.shot = true; }
      if (e.type === 'but') { const c = cornersPend.find((k) => st.t - k.t < 25 && k.team === e.team); if (c) o.cornerBut++; if (penPend && st.t - penPend.t < 5 && e.team === penPend.team) { o.penBut++; penPend = null; } const cf = o.cfDirect && st.events.slice(Math.max(0, seen - 6), seen).some((x) => x.type === 'shot' && x.kind === 'coup-franc-direct' && st.players[x.by]?.team === e.team && st.t - x.t < 3); if (cf) o.cfBut++; }
    }
  }
}
const q = (a, x) => { a = [...a].sort((u, v) => u - v); return a.length ? a[Math.floor(x * a.length)] : NaN; }; const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN; const n = o.n; const pct = (c) => c[1] ? (100 * c[0] / c[1]).toFixed(0) : 'NaN';
const T = o.takeIssue; const tt = T.garde + T.faute + T.touche + T.perdu;
console.log(`${n} × 90 min`);
console.log(`M11-2 take-ons (gestes) gagnés par bande de terrain : ${Object.entries(o.take).sort().map(([b, c]) => `${b} ${pct(c)} % (${c[1]})`).join(' ; ')} (cible 0,680 → 0,414 entre 20-30 % et 90-100 %)`);
console.log(`M11-4 issues des take-ons : gardé ${(100 * T.garde / tt).toFixed(0)} %, faute obtenue ${(100 * T.faute / tt).toFixed(1)} % (cible 9-14), touche ${(100 * T.touche / tt).toFixed(1)} % (12-19), perdu ${(100 * T.perdu / tt).toFixed(0)} % ; ${(tt / n).toFixed(0)} gestes / match`);
console.log(`M12-8 fautes / jaune : ${(o.fautes / Math.max(1, o.jaunes)).toFixed(1)} (cible 5-7) ; jaunes / match ${(o.jaunes / n).toFixed(1)} (3-5) ; hors-jeu / match ${(o.horsJeu / n).toFixed(1)} ; M12-12 arrêts de jeu / match ${(o.arrets / n).toFixed(0)} (cible 85-105), durée moyenne ${mean(o.arretsDur).toFixed(1)} s (26-32)`);
const tc = Object.values(o.cornerCible).reduce((a, b) => a + b, 0); console.log(`M13-1 corners ${(o.corners / n).toFixed(1)} / match (cible 10) ; cible ${Object.entries(o.cornerCible).map(([k, v]) => `${k} ${(100 * v / tc).toFixed(0)} %`).join(', ')} (cible premier poteau 47,9 / axe 27,1 / second 24,9) ; genre ${Object.entries(o.cornerGenre).map(([k, v]) => `${k} ${v}`).join(', ')}`);
const pc = o.premierContact; const tp = pc.atk + pc.def + pc.gk; console.log(`M13-2 premier contact : attaque ${(100 * pc.atk / Math.max(1, tp)).toFixed(0)} % (cible ≈ 45), défense ${(100 * pc.def / Math.max(1, tp)).toFixed(0)} % (≈ 55 dont gardien 7,5), gardien ${(100 * pc.gk / Math.max(1, tp)).toFixed(0)} % ; tir ≤ 25 s ${(100 * o.cornerTir25 / Math.max(1, o.corners)).toFixed(0)} % des corners, but ${(100 * o.cornerBut / Math.max(1, o.corners)).toFixed(1)} % (cible 2,8-4,2, xG 0,030)`);
console.log(`M13-5 coups francs directs ${(o.cfDirect / n).toFixed(1)} / match (cible 1,1), distance p50 ${q(o.cfDist, 0.5).toFixed(0)} m (28), buts ${o.cfBut} ; M13-7 penalties ${o.pen} (${(o.pen / n).toFixed(2)} / match), transformés ${o.penBut} (cible 0,78)`);
console.log(`M13-10 rétention 5 s après touche : ${Object.entries(o.toucheRet).map(([b, c]) => `${b} ${pct(c)} % (${c[1]})`).join(', ')} (cible 94 / 93 / 86 / 76 par distance au but adverse — ici par tiers) ; touches / match ${(o.touches / n).toFixed(0)} (cible 37-44)`);
