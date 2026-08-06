#!/usr/bin/env node
// verify-cartons.mjs — LA DISCIPLINE EST UN REGISTRE, PAS UNE HUMEUR.
//
// Loi 12 (discipline) : chaque adjudication compte la faute à son HOMME ; la récidive
// (cfg.loi12.jaune fautes du même joueur) vaut carton JAUNE, le second jaune vaut ROUGE —
// deux événements, comme les deux gestes de l'arbitre. Le carton SURVIT à l'avantage
// (l'arbitre le montre, avantage joué ou pas). La feuille compte jaunes et rouges par
// équipe. L'expulsion PHYSIQUE du rouge est une dette NOMMÉE (formation à 10, hors-jeu,
// cerveaux — un chantier propre), clausée ici comme absente : le rouge est montré, le corps
// reste. Doctrine lot 8 : fixtures craftées sur adjugeFaute, le flux du 11c11 ne produit
// presque jamais de récidive (~1 duel / 9 min, mesure lot 25).
import { makeMatch, matchCfg, matchStep, feuilleDeMatch } from '../assets/starter/src/engine/match-sim.js';
import { adjugeFaute } from '../assets/starter/src/engine/referee.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };

const settle = (seed, cfg) => {
  const st = makeMatch({ full: true, seed });
  for (let i = 0; i < 30 * 60 && !(st.phase === 'carry' && st.possession.carrier >= 0 && !st.restart); i++) matchStep(st, 1 / 60, cfg);
  return st;
};
// un SIFFLET crafté : faute du fautif réel `par`, fenêtre close, le lésé n'a pas le ballon
const siffle = (st, cfg, par) => {
  const lese = 1 - st.players[par].team;
  st._faute = { t: st.t - 2, par, sur: 1, team: lese, p: [4, 4] };
  st.possession.team = st.players[par].team;                        // le fautif « a » le ballon : perdu
  adjugeFaute(st, cfg);
  st.restart = null;                                                // hygiène de fixture (remise soldée)
};

// ---------- 1. la récidive : rien, puis JAUNE, puis SECOND JAUNE → ROUGE
{
  const cfg = matchCfg({ shotRange: 20 });
  const st = settle(3, cfg);
  const par = st.players.find((q) => q.team === 1 && !q.keeper).id;
  siffle(st, cfg, par);
  const apres1 = st.events.filter((e) => e.type === 'carton').length;
  siffle(st, cfg, par);
  const j1 = st.events.filter((e) => e.type === 'carton' && e.couleur === 'jaune');
  ok(`la PREMIÈRE faute ne carte pas (${apres1} carton(s) = 0), la RÉCIDIVE carte (2ᵉ faute de nº${par} → jaune cumul ${j1[0]?.cumul})`,
    apres1 === 0 && j1.length === 1 && j1[0].by === par && j1[0].cumul === 1);
  siffle(st, cfg, par);
  siffle(st, cfg, par);
  const jaunes = st.events.filter((e) => e.type === 'carton' && e.couleur === 'jaune');
  const rouges = st.events.filter((e) => e.type === 'carton' && e.couleur === 'rouge');
  ok(`le SECOND jaune vaut ROUGE (4ᵉ faute : jaune cumul ${jaunes[1]?.cumul} PUIS rouge — deux gestes, deux événements)`,
    jaunes.length === 2 && jaunes[1].cumul === 2 && rouges.length === 1 && rouges[0].by === par && rouges[0].t === jaunes[1].t);
  // …et le corps RESTE (l'expulsion physique est une dette NOMMÉE, pas un demi-flag)
  ok(`le rouge est MONTRÉ, le corps reste (dette d'expulsion nommée : nº${par} toujours dans st.players, down=${st.players[par].down})`,
    !!st.players[par] && st.players[par].down <= 0);
  const f = feuilleDeMatch(st);
  ok(`la FEUILLE compte la discipline (jaunes ${JSON.stringify(f.cartons.jaunes)} = [0,2], rouges ${JSON.stringify(f.cartons.rouges)} = [0,1])`,
    f.cartons.jaunes[0] === 0 && f.cartons.jaunes[1] === 2 && f.cartons.rouges[0] === 0 && f.cartons.rouges[1] === 1);
}

// ---------- 2. le carton SURVIT à l'avantage (l'arbitre montre au fautif, le jeu a joué)
{
  const cfg = matchCfg({ shotRange: 20 });
  const st = settle(3, cfg);
  const par = st.players.find((q) => q.team !== st.possession.team && !q.keeper).id;
  for (let k = 0; k < 2; k++) {
    // avantage GARDÉ : le lésé (porteur actuel) tient le ballon à la fin de fenêtre
    st._faute = { t: st.t - 2, par, sur: st.possession.carrier, team: st.possession.team, p: [0, 0] };
    adjugeFaute(st, cfg);
  }
  const av = st.events.filter((e) => e.type === 'avantage').length;
  const j = st.events.filter((e) => e.type === 'carton' && e.couleur === 'jaune');
  ok(`le carton SURVIT à l'avantage (${av} avantages joués = 2, 0 sifflet — et la récidive de nº${par} vaut jaune quand même)`,
    av === 2 && j.length === 1 && j[0].by === par && !st.events.some((e) => e.type === 'sortie'));
}

// ---------- 3. sabotage nommé « arbitre sans poches » : jaune:0 → des fautes, aucun carton
{
  const cfg = matchCfg({ shotRange: 20, loi12: { avantage: 1.8, contact: 0.9, mur: 9.15, jaune: 0 } });
  const st = settle(3, cfg);
  const par = st.players.find((q) => q.team === 1 && !q.keeper).id;
  for (let k = 0; k < 4; k++) siffle(st, cfg, par);
  const sorties = st.events.filter((e) => e.type === 'sortie' && e.out === 'coup-franc').length;
  ok(`sabotage « arbitre sans poches » attrapé (jaune:0 : ${sorties} sifflets = 4, ${st.events.filter((e) => e.type === 'carton').length} carton(s) = 0 — la discipline est une clé, nommée)`,
    sorties === 4 && !st.events.some((e) => e.type === 'carton'));
}

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
