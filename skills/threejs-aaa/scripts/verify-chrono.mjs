#!/usr/bin/env node
// verify-chrono.mjs — LE CYCLE DE MATCH EST UN PRODUIT, ET ÇA SE PROUVE.
//
// L'enveloppe qu'un projet aval appelle : démarrer un match, le jouer (périodes, mi-temps,
// engagement alterné — Loi 8), le FINIR (sifflet final, état terminal calme), et LIRE la
// feuille de match (score, buts à la minute, tirs, arrêts, possession, passes, hors-jeu,
// coups francs — tout depuis les événements, aucune seconde vérité). Clé absente : les mondes
// d'aujourd'hui, sans fin, au bit près (sentinelles rondo/match).
import { makeMatch, matchCfg, matchStep, feuilleDeMatch } from '../assets/starter/src/engine/match-sim.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };

// un match COURT pour le banc : 2 × 60 s + 5 s de pause (le chrono est une config, pas une durée)
const CH = { periodes: 2, duree: 60, pause: 5 };
const joue = (seed, over = {}) => {
  const st = makeMatch({ full: true, seed });
  const cfg = matchCfg({ shotRange: 20, chrono: CH, ...over });
  let miTempsRestart = null;
  for (let i = 0; i < 140 * 60; i++) {
    matchStep(st, 1 / 60, cfg);
    if (!miTempsRestart && st.events.some((e) => e.type === 'mi-temps') && st.restart) {
      miTempsRestart = { type: st.restart.type, team: st.restart.team };
    }
    if (st.fini && st.t > 132) break;
  }
  return { st, miTempsRestart };
};

// ---------- 1. le cycle : mi-temps, engagement alterné, sifflet final, état terminal
{
  const { st, miTempsRestart } = joue(3);
  const mt = st.events.find((e) => e.type === 'mi-temps');
  const fin = st.events.find((e) => e.type === 'fin-de-match');
  ok(`la MI-TEMPS siffle à l'heure (événement à t=${mt?.t} ≈ 60, période ${mt?.periode})`,
    !!mt && Math.abs(mt.t - 60) < 1.5 && mt.periode === 2);
  ok(`l'AUTRE équipe engage la seconde période (Loi 8 : engagement équipe ${miTempsRestart?.team})`,
    miTempsRestart?.type === 'engagement' && miTempsRestart?.team === 1);
  ok(`le SIFFLET FINAL tombe (fin-de-match à t=${fin?.t} ≈ 125, st.fini=${st.fini}, score ${JSON.stringify(fin?.score)})`,
    !!fin && Math.abs(fin.t - 125) < 1.5 && st.fini === true);
  // l'état terminal est CALME : le monde tient, personne ne joue un ballon mort
  const evAvant = st.events.length;
  const pAvant = st.players.map((p) => [p.p[0], p.p[2]]);
  for (let i = 0; i < 120; i++) matchStep(st, 1 / 60, matchCfg({ shotRange: 20, chrono: CH }));
  const bouge = st.players.reduce((a, p, i) => Math.max(a, Math.hypot(p.p[0] - pAvant[i][0], p.p[2] - pAvant[i][1])), 0);
  ok(`l'état terminal est CALME (${st.events.length - evAvant} événement(s) en 2 s après le sifflet, plus grand déplacement ${bouge.toFixed(2)} m ≤ 1)`,
    st.events.length - evAvant === 0 && bouge <= 1);
  // la PAUSE est muette : aucune passe entre le sifflet et la reprise
  const passesPause = st.events.filter((e) => e.type === 'pass' && e.t > mt.t && e.t < mt.t + CH.pause - 0.5).length;
  ok(`la mi-temps est MUETTE (${passesPause} passe(s) pendant la pause)`, passesPause === 0);
}

// ---------- 2. la feuille de match : cohérente, complète, déterministe
{
  const { st } = joue(3);
  const f = feuilleDeMatch(st);
  const evs = st.events;
  const n = (t) => evs.filter((e) => e.type === t).length;
  ok(`la feuille COMPTE juste (tirs ${f.tirs[0]}+${f.tirs[1]} = ${n('shot')} événements, passes ${f.passes[0]}+${f.passes[1]} = ${n('pass')}, arrêts ${f.arrets[0]}+${f.arrets[1]} = ${n('arrêt')})`,
    f.tirs[0] + f.tirs[1] === n('shot') && f.passes[0] + f.passes[1] === n('pass') && f.arrets[0] + f.arrets[1] === n('arrêt'));
  ok(`le score de la feuille EST celui des buts (${JSON.stringify(f.score)}, ${f.buts.length} but(s) listés à la minute)`,
    f.score[0] + f.score[1] === f.buts.length && f.score[0] === st.score[0] && f.score[1] === st.score[1]);
  ok(`la possession se PARTAGE (${f.possession[0]} % / ${f.possession[1]} %, somme ${f.possession[0] + f.possession[1]} ∈ [99;101])`,
    f.possession[0] + f.possession[1] >= 99 && f.possession[0] + f.possession[1] <= 101 && f.possession[0] > 10 && f.possession[1] > 10);
  ok(`la feuille dit l'état du cycle (période ${f.periode}, fini ${f.fini})`, f.periode === 2 && f.fini === true);
  const { st: st2 } = joue(3);
  ok(`la feuille est DÉTERMINISTE (même graine → même feuille, octet pour octet)`,
    JSON.stringify(f) === JSON.stringify(feuilleDeMatch(st2)));
}

// ---------- 3. sabotage nommé « match sans fin » : chrono absent → le monde d'hier, qui ne finit pas
{
  const st = makeMatch({ full: true, seed: 3 });
  const cfg = matchCfg({ shotRange: 20 });
  for (let i = 0; i < 140 * 60; i++) matchStep(st, 1 / 60, cfg);
  ok(`sabotage « match sans fin » attrapé (chrono absent : t=${st.t.toFixed(0)} s, aucun sifflet, st.fini=${!!st.fini} — le monde d'hier, nommé)`,
    !st.fini && !st.events.some((e) => e.type === 'fin-de-match' || e.type === 'mi-temps'));
}

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
