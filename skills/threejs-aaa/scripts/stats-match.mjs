#!/usr/bin/env node
// stats-match.mjs — LA FEUILLE DE MATCH EN LIGNE DE COMMANDE (engine/stats.js). Un match ou la MOYENNE de plusieurs.
//   node stats-match.mjs [graines=3] [--niveaux 80,50] [--tactiques gegenpressing,equilibre] [--duree 5400] [--mi-temps 1|2] [--joueurs] [--json fichier] [--cfg '{json}']
//   --niveaux : des effectifs NOTÉS (effectif.genererEffectif, 4-3-3) — sans : les 22 joueurs neutres du moteur (notés 50).
import { writeFileSync } from 'node:fs';
import { makeMatch, matchCfg, matchStep } from '../assets/starter/src/engine/match-sim.js';
import { makeStats, statsStep, statsReport } from '../assets/starter/src/engine/stats.js';
import { makeTactique, tactiqueStep, tactiqueReport } from '../assets/starter/src/engine/tactique.js';
import { genererEffectif } from '../assets/starter/src/engine/effectif.js';
import { ROLES_FORMATION } from '../assets/starter/src/engine/formation.js';
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const seeds = (args[0] && !args[0].startsWith('--') ? args[0] : '3').split(',').map(Number);
const niv = opt('--niveaux', null)?.split(',').map(Number), DUR = +opt('--duree', 5400), per = opt('--mi-temps', null) ? +opt('--mi-temps') : null, over = JSON.parse(opt('--cfg', '{}')), tacs = opt('--tactiques', null)?.split(',');   // --tactiques gegenpressing,equilibre : les presets de tactics.js
const rapports = [];
for (const seed of seeds) {
  const squads = niv ? niv.map((niveau, k) => genererEffectif({ formation: '433', roles: ROLES_FORMATION[433], niveau, graine: seed * 2 + k + 1 })) : null;
  const st = makeMatch({ full: true, seed, ...(tacs ? { tactics: tacs } : {}), ...(squads ? { squads, roles: [ROLES_FORMATION[433], ROLES_FORMATION[433]] } : {}) });
  const cfg = matchCfg({ chrono: { periodes: 2, duree: DUR / 2, pause: 10 }, ...over }), S = makeStats(st), TQ = makeTactique(st);
  for (let i = 0; i < DUR * 60 * 1.3; i++) { matchStep(st, 1 / 60, cfg); statsStep(S, st); tactiqueStep(TQ, st); if (st.restart?.type === 'fin') break; }
  rapports.push({ ...statsReport(S, st, { per }), tactique: tactiqueReport(TQ, st) });
}
const N = rapports.length, moy = (f) => rapports.reduce((s, R) => s + (f(R) ?? 0), 0) / N;
const LIGNES = [
  ['Buts', 'buts'], ['xG (référence)', 'xg'], ['xG (modèle du moteur)', 'xgMoteur'], ['Possession %', 'possession'],
  ['— TIRS', null], ['Tirs', 'tirs'], ['Cadrés', 'cadres'], ['Arrêtés', 'arretes'], ['Contrés', 'contres'], ['Hors cadre', 'horsCadre'], ['dont frôlent le cadre', 'frole'],
  ['Dans la surface', 'tirsSurface'], ['Hors surface', 'tirsHorsSurface'], ['Dans les 6 m', 'tirsSixMetres'], ['Du pied', 'tirsPied'], ['De la tête', 'tirsTete'], ['De volée', 'tirsVolee'], ['Distance moyenne (m)', 'distTir'], ['xG par tir', 'xgParTir'],
  ['— PASSES', null], ['Passes', 'passes'], ['Réussies', 'passesReussies'], ['Réussite %', 'reussite'], ['Courtes (< 15 m)', 'courtes'], ['Moyennes (15-30 m)', 'moyennes'], ['Longues (> 30 m)', 'longues'], ['Réussite des longues %', 'reussiteLongues'],
  ['Au sol', 'auSol'], ['En hauteur', 'enHauteur'], ['Une touche', 'uneTouche'], ['Vers l’avant', 'versAvant'], ['Latérales', 'laterales'], ['Vers l’arrière', 'versArriere'], ['Réussies dans le dernier tiers', 'dernierTiers'], ['Passes clés', 'passesCles'], ['Centres', 'centres'],
  ['— DUELS', null], ['Duels au sol', 'duelsSol'], ['gagnés', 'duelsSolGagnes'], ['Duels aériens', 'duelsAeriens'], ['gagnés', 'duelsAeriensGagnes'], ['Largeur en possession (m)', 'largeurPossession'], ['Profondeur en possession (m de son but)', 'profondeurPossession'], ['Hauteur de la ligne (m de son but)', 'hauteurLigne'], ['Hauteur du bloc (m de son but)', 'hauteurBloc'], ['Longueur du bloc (m)', 'longueurBloc'], ['Largeur défensive (m)', 'largeurDefensive'], ['Contrôles ratés', 'controlesRates'], ['Dépossédés à la réception', 'depossedesReception'], ['Dribbles tentés', 'dribbles'], ['réussis', 'dribblesReussis'],
  ['— DÉFENSE ET PRESSING', null], ['Tacles', 'tacles'], ['gagnés', 'taclesGagnes'], ['Interceptions', 'interceptions'], ['Récupérations', 'recuperations'], ['Hauteur moyenne de récupération (m, 0 = milieu)', 'recupHauteur'], ['Récupérations dans le camp adverse', 'recupCampAdverse'],
  ['Récupérations en contre-pressing (< 5 s)', 'recupContrePress'], ['Pressions', 'pressions'], ['PPDA (passes adverses par action défensive)', 'ppda'], ['Dégagements', 'degagements'], ['Tirs contrés', 'contresDefensifs'],
  ['— GARDIEN', null], ['Arrêts (sur tir)', 'arrets'], ['Prises et interventions', 'prisesGardien'], ['Sorties aériennes', 'sortiesGardien'],
  ['— DISCIPLINE ET ARRÊTS DE JEU', null], ['Fautes commises', 'fautes'], ['Fautes subies', 'fautesSubies'], ['Cartons jaunes', 'jaunes'], ['Cartons rouges', 'rouges'], ['Hors-jeu', 'horsJeu'], ['Corners', 'corners'],
];
const f = (x) => (x == null || Number.isNaN(x) ? '—' : Number.isInteger(x) ? String(x) : x.toFixed(2));
console.log(`FEUILLE DE MATCH — ${N} match(s)${N > 1 ? ' (moyennes)' : ''}, ${DUR / 60} min${per ? `, mi-temps ${per}` : ''}${niv ? `, niveaux ${niv.join(' c. ')}` : ', joueurs neutres'}`);
console.log(`${''.padEnd(48)}${'A'.padStart(9)}${'B'.padStart(9)}`);
for (const [lib, k] of LIGNES) { if (!k) { console.log(lib); continue; } console.log(`  ${lib.padEnd(46)}${f(moy((R) => R.equipes[0][k])).padStart(9)}${f(moy((R) => R.equipes[1][k])).padStart(9)}`); }
if (args.includes('--joueurs')) {
  const R = rapports[0]; console.log(`\nJOUEURS (match ${seeds[0]}) — note, min, buts, PD, tirs, xG, passes (réussite %), clés, dribbles, tacles, interceptions, récup, km, sprints`);
  for (const j of [...R.joueurs].sort((a, b) => a.team - b.team || (b.note ?? 0) - (a.note ?? 0))) console.log(`  ${'AB'[j.team]} #${String(j.id).padEnd(3)}${j.keeper ? 'GK ' : '   '}${f(j.note).padStart(5)} ${f(j.minutes).padStart(5)}  ${j.buts} ${j.passesDecisives}  ${j.tirs} ${f(j.xg).padStart(5)}  ${String(j.passes).padStart(3)} (${f(j.reussite)}) ${j.passesCles}  ${j.dribblesReussis}/${j.dribbles}  ${j.taclesGagnes}/${j.tacles}  ${j.interceptions}  ${j.recuperations}  ${(j.distance / 1000).toFixed(1)} ${j.sprints}`);
}
if (opt('--json', null)) writeFileSync(opt('--json'), JSON.stringify(N === 1 ? rapports[0] : rapports));
