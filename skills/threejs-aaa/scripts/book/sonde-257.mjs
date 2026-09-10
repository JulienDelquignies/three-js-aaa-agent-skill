// sonde 257 — le carton juge la nature : fautes par espèce (accrochage prometteur / arraché, tacle glissé, par derrière, charge, debout), cartons jaunes / rouges, fautes par jaune, la nature de la faute qui vaut le carton, dernier défenseur, seconds jaunes.
import { makeMatch, matchStep, matchCfg } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/match-sim.js';
const seeds = (process.argv[2] ?? '3,7,11,13').split(',').map(Number), over = JSON.parse(process.argv[3] ?? '{}'), DUR = +(process.argv[4] ?? 5400);
const o = { n: 0, fautes: 0, kinds: {}, prometteur: 0, arrache: 0, dernier: 0, jaunes: 0, rouges: 0, seconds: 0, directs: 0, jauneNature: {}, avantages: 0, penalties: 0, parGraine: [] };
for (const seed of seeds) {
  const st = makeMatch({ full: true, seed }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: 2700, pause: 10 }, ...over }); o.n++;
  let seen = 0, lastF = null, g = { fautes: 0, jaunes: 0, rouges: 0 };
  for (let i = 0; i < DUR * 60; i++) {
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break;
    for (; seen < st.events.length; seen++) { const e = st.events[seen];
      if (e.type === 'faute') { o.fautes++; g.fautes++; const k = e.kind ?? 'debout'; o.kinds[k] = (o.kinds[k] ?? 0) + 1; if (e.prometteur) o.prometteur++; if (e.arrache) o.arrache++; if (e.dernier) o.dernier++; lastF = e; }
      if (e.type === 'carton') { if (e.couleur === 'jaune') { o.jaunes++; g.jaunes++; const k = lastF ? (lastF.kind ?? 'debout') + (lastF.prometteur ? '+prometteur' : '') : '?'; o.jauneNature[k] = (o.jauneNature[k] ?? 0) + 1; if (e.repetee) o.repetees = (o.repetees ?? 0) + 1; if (e.prometteur) o.promJ = (o.promJ ?? 0) + 1; }
        else { o.rouges++; g.rouges++; if (e.direct) o.directs++; else o.seconds++; if (e.dogso) o.dogso = (o.dogso ?? 0) + 1; } }
      if (e.type === 'avantage') o.avantages++;
      if (e.type === 'restart' && e.cause === 'penalty') o.penalties++;
    }
  }
  o.parGraine.push(`${seed}: ${g.fautes} fautes, ${g.jaunes} j, ${g.rouges} r`);
}
const n = o.n, f = (x) => (x / n).toFixed(2);
console.log(`${n} × ${(DUR / 60).toFixed(0)} min ${JSON.stringify(over)} — ${o.parGraine.join(' ; ')}`);
console.log(`fautes / match ${f(o.fautes)} (réel 20-30) ; jaunes / match ${f(o.jaunes)} (3,2-4,8) ; rouges / match ${f(o.rouges)} (0,08-0,36) dont seconds jaunes ${f(o.seconds)} (0,12), directs ${f(o.directs)} ; fautes par jaune ${(o.fautes / Math.max(1, o.jaunes)).toFixed(1)} (5,4-6,8) ; avantages ${f(o.avantages)}`);
console.log(`espèces : ${JSON.stringify(o.kinds)} ; prometteur ${o.prometteur} (${(100 * o.prometteur / Math.max(1, o.fautes)).toFixed(0)} %), arraché ${o.arrache}, dernier défenseur ${o.dernier}`);
console.log(`la nature qui vaut le jaune : ${JSON.stringify(o.jauneNature)} ; jaunes à l'ardoise ${o.repetees ?? 0}, jaunes prometteurs ${o.promJ ?? 0}, dogso ${o.dogso ?? 0}`);
