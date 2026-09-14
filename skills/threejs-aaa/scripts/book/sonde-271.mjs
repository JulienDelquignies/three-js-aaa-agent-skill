// sonde 271 — LE BALLON QUI SORT : les sorties par espèce (touche / corner / sortie de but ; réel 33-45 / 9-11 / ~16 par match) et par CAUSE (la dernière action avant la sortie : passe et sa classe, tir, dégagement, centre, déviation de duel, glissé, take-on, gardien), la part des passes / tirs / dégagements / centres qui finissent dehors, le jeu long (≥ 32 m, réel 8-20 % des passes, conservé à 10 s 28,6 %).
import { makeMatch, matchStep, matchCfg } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/match-sim.js';
const seeds = (process.argv[2] ?? '3,7').split(',').map(Number), over = JSON.parse(process.argv[3] ?? '{}'), DUR = +(process.argv[4] ?? 2700);
const o = { n: 0, out: {}, cause: {}, causeOut: {}, ev: {}, evOut: {}, passesD: { c: [0, 0], m: [0, 0], l: [0, 0] }, longs: 0, longsCons: 0, passes: 0, arrets: 0, fautes: 0, buts: 0, tirs: 0, tirsOut: 0, dt: [] };
const hyp = Math.hypot, CAUSES = ['pass', 'shot', 'clearance', 'centre', 'slide', 'tacle-pique', 'duel', 'skill', 'control', 'receive', 'loose-kept', 'tête', 'renvoi', 'relance', 'touche', 'volée'];
for (const seed of seeds) {
  const { _tactics, ...overC } = over; if (overC.ballonFou) overC.ballonFou = { ...matchCfg({}).ballonFou, ...overC.ballonFou };
  const st = makeMatch({ full: true, seed, tactics: _tactics ?? null }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: DUR, pause: 10 }, ...overC }); o.n++;
  let seen = 0, last = null, lastRestart = null; const longsPend = [];
  for (let i = 0; i < DUR * 60 * 2.4; i++) {
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break;
    if (st.restart && !lastRestart) { o.arrets++; lastRestart = st.restart; } if (!st.restart && lastRestart) lastRestart = null;
    for (const w of longsPend) if (!w.done && st.t - w.t >= 10) { w.done = true; if (st.possession.team === w.team) o.longsCons++; }
    for (; seen < st.events.length; seen++) { const e = st.events[seen];
      if (e.type === 'sortie') {
        if (['coup-franc', 'penalty', 'hors-jeu'].includes(e.out)) continue;
        o.out[e.out] = (o.out[e.out] ?? 0) + 1;
        const k = last ? (last.type === 'pass' ? `pass:${last.cls ?? last.style ?? '?'}` : last.type === 'shot' ? `shot:${last.kind ?? '?'}` : last.type) : 'aucune';
        o.cause[k] = (o.cause[k] ?? 0) + 1; o.causeOut[`${e.out}<${k}`] = (o.causeOut[`${e.out}<${k}`] ?? 0) + 1; if (last) o.dt.push(st.t - last.t);
        if (last) o.evOut[last.type] = (o.evOut[last.type] ?? 0) + 1;
        continue;
      }
      if (e.type === 'but') o.buts++;
      if (e.type === 'faute') o.fautes++;
      if (CAUSES.includes(e.type)) { last = e; o.ev[e.type] = (o.ev[e.type] ?? 0) + 1; }
      if (e.type === 'pass' && e.to >= 0 && st.pass) { o.passes++; const d = hyp(st.pass.lead[0] - st.pass.origin[0], st.pass.lead[2] - st.pass.origin[1]); const b = d < 15 ? 'c' : d < 32 ? 'm' : 'l'; o.passesD[b][1]++; last._d = b; if (d >= 32) { o.longs++; longsPend.push({ t: st.t, team: st.players[e.by].team, done: false }); } }
      if (e.type === 'shot') o.tirs++;
    }
  }
}
const n = o.n, pc = (a, b) => b ? (100 * a / b).toFixed(0) + ' %' : '—';
const sortiesTot = Object.values(o.out).reduce((a, b) => a + b, 0);
console.log(`${n} × ${DUR / 60} min ${JSON.stringify(over)} — sorties ${(sortiesTot / n).toFixed(0)} / match : ${Object.entries(o.out).sort().map(([k, v]) => `${k} ${(v / n).toFixed(1)}`).join(', ')} (réel touche 33-45, corner 9-11, sortie de but ~16) ; arrêts ${(o.arrets / n).toFixed(0)} (85-105), fautes ${(o.fautes / n).toFixed(1)}, buts ${(o.buts / n).toFixed(1)}, tirs ${(o.tirs / n).toFixed(1)}`);
console.log(`  la dernière action avant la sortie : ${Object.entries(o.cause).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(v / n).toFixed(1)} (${pc(v, o.ev[k.split(':')[0]] ?? 0)} des ${k.split(':')[0]})`).join(', ')}`);
console.log(`  par espèce : ${Object.entries(o.causeOut).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => `${k} ${(v / n).toFixed(1)}`).join(', ')}`);
console.log(`  volumes / match : ${Object.entries(o.ev).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(v / n).toFixed(0)}`).join(', ')} ; passes courtes/moyennes/longues ${o.passesD.c[1] / n} / ${o.passesD.m[1] / n} / ${o.passesD.l[1] / n} ; longs ≥ 32 m ${pc(o.longs, o.passes)} des passes (réel 8-20), conservés à 10 s ${pc(o.longsCons, o.longs)} (réel 28,6)`);
