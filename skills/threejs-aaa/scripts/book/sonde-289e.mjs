// sonde 289e — OÙ NAÎT LE BALLON LIBRE (sonde 289b : ~65 pertes par équipe et par match sur un ballon libre SANS geste nommé dans
// les 3 s). À chaque passage de la phase au ballon libre ('loose'), la phase d'avant (conduite / vol) et ce qui s'est passé à cette
// image-là (les événements, le porteur, l'écart pied-ballon) ; puis, à la reprise par l'adversaire (turnover 'récupération' hors passe
// ouverte), l'origine du ballon libre, sa durée, sa vitesse — et la même chose quand c'est l'équipe qui avait le ballon qui le reprend.
import { makeMatch, matchStep, matchCfg } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/match-sim.js';
const seeds = (process.argv[2] ?? '3,7').split(',').map(Number), over = JSON.parse(process.argv[3] ?? '{}'), DUR = +(process.argv[4] ?? 2700);
const hyp = Math.hypot, pc = (a, b) => (b ? (100 * a / b).toFixed(1) : '—'), q = (a, x) => { a = [...a].sort((u, v) => u - v); return a.length ? a[Math.min(a.length - 1, Math.floor(x * a.length))] : NaN; };
const O = { matchs: 0, libres: 0, origine: {}, perdus: {}, gardes: {}, duree: [], dureePerdue: [], ecart: [] };
for (const seed of seeds) {
  const st = makeMatch({ full: true, seed }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: DUR, pause: 10 }, ...over }); O.matchs++;
  let seen = 0, libre = null, phase0 = st.phase, passeOuv = null;
  for (let i = 0; i < DUR * 60 * 2.4; i++) {
    const porteur0 = st.possession.carrier >= 0 ? st.players[st.possession.carrier] : null, team0 = st.possession.team, ecart0 = porteur0 ? hyp(st.ball.p[0] - porteur0.p[0], st.ball.p[2] - porteur0.p[2]) : null;
    const nEv = st.events.length;
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break;
    const evs = st.events.slice(nEv).map((e) => e.type + (e.type === 'control' && e.miss ? '(manqué)' : e.type === 'pass' && e.clear ? '(dégagement)' : '')).filter((t) => !['moment', 'window', 'burst', 'skill-end', 'geste'].includes(t));
    if (st.phase === 'loose' && phase0 !== 'loose' && !st.restart) {
      let o;
      if (phase0 === 'carry') o = evs.includes('tacle-pique') ? 'conduite → PIQUE' : evs.some((t) => t.startsWith('duel')) ? 'conduite → DUEL' : evs.includes('slide') ? 'conduite → TACLE GLISSÉ' : evs.some((t) => t.startsWith('control')) ? 'contrôle → libre' : `conduite → échappée (sans geste ; écart pied-ballon ${ecart0 == null ? '?' : ecart0 < 1.5 ? '< 1,5' : ecart0 < 3 ? '1,5-3' : '≥ 3'} m)`;
      else if (phase0 === 'flight') o = evs.some((t) => t.startsWith('control')) ? 'vol → contrôle → libre' : evs.includes('shot') ? 'vol → tir' : evs.some((t) => t.startsWith('tête')) ? 'vol → tête' : 'vol → personne (le vol finit libre)';
      else o = `${phase0} → libre`;
      if (evs.length && o.includes('sans geste')) o += ` [${evs.slice(0, 3).join(',')}]`;
      libre = { t: st.t, o, team: team0 }; O.libres++; O.origine[o] = (O.origine[o] ?? 0) + 1; if (ecart0 != null && phase0 === 'carry') O.ecart.push(ecart0);
    }
    for (; seen < st.events.length; seen++) { const e = st.events[seen];
      if (e.type === 'pass' && !e.clear && e.to >= 0) passeOuv = { team: st.players[e.by]?.team, t: st.t };
      if ((e.type === 'control' || e.type === 'receive' || e.type === 'loose-kept') && passeOuv && st.players[e.by]?.team === passeOuv.team) passeOuv = null;
      if (e.type === 'turnover' && libre && e.why === 'récupération') { const ouverte = passeOuv && st.t - passeOuv.t < 6; if (!ouverte) { O.perdus[libre.o] = (O.perdus[libre.o] ?? 0) + 1; O.dureePerdue.push(st.t - libre.t); } libre = null; passeOuv = null; }
      if ((e.type === 'loose-kept' || e.type === 'control') && libre && st.players[e.by]?.team === libre.team) { O.gardes[libre.o] = (O.gardes[libre.o] ?? 0) + 1; O.duree.push(st.t - libre.t); libre = null; }
    }
    phase0 = st.phase;
  }
}
const n = O.matchs, P = Object.values(O.perdus).reduce((a, b) => a + b, 0);
const top = (D, tot) => Object.entries(D).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${k} ${pc(v, tot)} % (${(v / n / 2).toFixed(0)}/éq.)`).join(' ; ');
console.log(`${n} matchs de 2 × ${(DUR / 60).toFixed(0)} min ${JSON.stringify(over)} — ${O.libres} passages au ballon libre (${(O.libres / n / 2).toFixed(0)} par équipe et par match)`);
console.log(`  ORIGINE de tous les ballons libres : ${top(O.origine, O.libres)}`);
console.log(`  ORIGINE des ballons libres REPRIS PAR L'ADVERSAIRE hors passe (${P}, ${(P / n / 2).toFixed(0)} par équipe) : ${top(O.perdus, P)} ; libre p50 ${q(O.dureePerdue, 0.5).toFixed(2)} s avant la reprise`);
console.log(`  gardés par l'équipe qui l'avait : ${top(O.gardes, Object.values(O.gardes).reduce((a, b) => a + b, 0))} ; libre p50 ${q(O.duree, 0.5).toFixed(2)} s ; écart pied-ballon au passage conduite → libre p25/p50/p75 ${q(O.ecart, 0.25).toFixed(2)}/${q(O.ecart, 0.5).toFixed(2)}/${q(O.ecart, 0.75).toFixed(2)} m`);
