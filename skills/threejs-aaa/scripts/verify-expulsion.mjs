#!/usr/bin/env node
// verify-expulsion.mjs — LE ROUGE SORT UN CORPS, PAS UNE ÉTIQUETTE.
//
// Lot 28 : l'expulsion physique. Le second jaune pose q.expulse + un down GÉANT — le levier
// natif : les ~30 filtres down<=0 du moteur oublient l'expulsé sans être touchés (une
// autorité, zéro seconde vérité) ; movement le laisse MARCHER vers sa sortie (il n'est pas
// un corps au sol) ; la Loi 11 l'ignore NOMMÉMENT (un rouge posté hors terrain ne fait pas
// la ligne) ; placeKickoff/kickoffSpots ne le ramènent pas des vestiaires ; l'équipe joue
// à 10 et le monde CONTINUE. Gardien expulsé : dette nommée (pas de remplaçant aux gants).
import { makeMatch, matchCfg, matchStep } from '../assets/starter/src/engine/match-sim.js';
import { adjugeFaute, placeKickoff } from '../assets/starter/src/engine/referee.js';
import { offsideLine } from '../assets/starter/src/engine/offside.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };

const settle = (seed, cfg) => {
  const st = makeMatch({ full: true, seed });
  for (let i = 0; i < 30 * 60 && !(st.phase === 'carry' && st.possession.carrier >= 0 && !st.restart); i++) matchStep(st, 1 / 60, cfg);
  return st;
};
const siffle = (st, cfg, par) => {
  st._faute = { t: st.t - 2, par, sur: 1, team: 1 - st.players[par].team, p: [4, 4] };
  st.possession.team = st.players[par].team;
  adjugeFaute(st, cfg);
  st.restart = null;
};
// un monde avec un ROUGE : 4 sifflets du même homme, posé près de la touche avant le dernier
const rougeWorld = (seed) => {
  const cfg = matchCfg({ shotRange: 20 });
  const st = settle(seed, cfg);
  const q = st.players.find((p) => p.team === 1 && !p.keeper);
  for (let k = 0; k < 3; k++) siffle(st, cfg, q.id);
  q.p[0] = 10; q.p[2] = 28;                                        // près de la touche (hz 34) : la marche se mesure vite
  siffle(st, cfg, q.id);                                           // → 2ᵉ jaune → rouge → expulsion
  return { st, cfg, q };
};

// ---------- 1. le corps SORT, RESTE dehors, et l'équipe joue à 10
{
  const { st, cfg, q } = rougeWorld(3);
  ok(`le rouge POSE l'expulsion (expulse=${!!q.expulse}, down géant ${q.down > 1e6}, sortie [${q._exit?.map((v) => +v.toFixed(0)).join(', ')}])`,
    q.expulse === true && q.down > 1e6 && Array.isArray(q._exit));
  for (let i = 0; i < 8 * 60; i++) matchStep(st, 1 / 60, cfg);
  const dehors = Math.abs(q.p[2]) > st.pitch.hz;
  const pos8 = [q.p[0], q.p[2]];
  for (let i = 0; i < 4 * 60; i++) matchStep(st, 1 / 60, cfg);
  const bouge = Math.hypot(q.p[0] - pos8[0], q.p[2] - pos8[1]);
  ok(`le corps SORT et RESTE (8 s de marche : |z|=${Math.abs(q.p[2]).toFixed(1)} > ${st.pitch.hz} ; 4 s de plus : ${bouge.toFixed(2)} m ≤ 0,8 — il se tient à sa sortie)`,
    dehors && bouge <= 0.8);
  const actifs = st.players.filter((p) => p.team === 1 && !p.keeper && !p.expulse).length;
  ok(`l'équipe joue À 10 (${actifs} joueurs de champ actifs = 9, gardien aux gants)`,
    actifs === 9 && st.players.some((p) => p.team === 1 && p.keeper && !p.expulse));
  // …et le MONDE CONTINUE à 10 : des passes vivent après l'expulsion
  const evBase = st.events.length;
  for (let i = 0; i < 20 * 60; i++) matchStep(st, 1 / 60, cfg);
  const passes = st.events.slice(evBase).filter((e) => e.type === 'pass').length;
  ok(`le monde CONTINUE à 10 (${passes} passe(s) ≥ 3 en 20 s, aucun gel)`, passes >= 3);
  // …et l'expulsé n'est JAMAIS re-servi (aucune passe vers lui, aucun toucher de lui)
  const luiJoue = st.events.slice(evBase).some((e) => (e.type === 'pass' && (e.from === q.id || e.to === q.id)) || (e.type === 'touch' && e.by === q.id));
  ok(`l'expulsé est HORS DU MONDE (aucune passe de/vers nº${q.id}, aucun toucher)`, !luiJoue);
}

// ---------- 2. la Loi 11 l'OUBLIE (un rouge posté hors terrain ne fait pas la ligne)
{
  const { st, q } = rougeWorld(3);
  // fixture : l'expulsé (équipe 1) posé PLUS PROFOND que toute sa défense — s'il comptait,
  // la ligne de l'attaque (équipe 0) serait la sienne
  const own = st.pitch.ownGoal(1);
  q.p[0] = own.x - own.sign * 0.5; q.p[2] = 0;
  const ligneAvec = offsideLine(st, 0);
  const vivants = st.players.filter((p) => p.team === 1 && !p.expulse).map((p) => p.p[0] * -st.pitch.ownGoal(0).sign).sort((a, b) => b - a);
  ok(`la Loi 11 OUBLIE l'expulsé (ligne ${ligneAvec.adv.toFixed(1)} = avant-dernier VIVANT ${Math.max(vivants[1], 0).toFixed(1)}, pas le fantôme posé à ${(q.p[0] * ligneAvec.sgn).toFixed(1)})`,
    Math.abs(ligneAvec.adv - Math.max(vivants[1], st.ball.p[0] * ligneAvec.sgn, 0)) < 0.01 && ligneAvec.adv < q.p[0] * ligneAvec.sgn - 1);
}

// ---------- 3. les vestiaires ne le RAMÈNENT pas (placeKickoff saute l'expulsé)
{
  const { st, q } = rougeWorld(3);
  q.p[0] = 10; q.p[2] = 36.5;                                      // déjà sorti
  placeKickoff(st, 0);
  ok(`placeKickoff ne ramène PAS l'expulsé (nº${q.id} toujours à [${q.p[0].toFixed(0)}, ${q.p[2].toFixed(1)}], down toujours géant ${q.down > 1e6} — les autres corps posés)`,
    Math.abs(q.p[2] - 36.5) < 0.01 && q.down > 1e6);
}

// ---------- 4. sabotage nommé « arbitre sans poches » : jaune:0 → personne ne sort jamais
{
  const cfg = matchCfg({ shotRange: 20, loi12: { avantage: 1.8, contact: 0.9, mur: 9.15, jaune: 0 } });
  const st = settle(3, cfg);
  const par = st.players.find((p) => p.team === 1 && !p.keeper).id;
  for (let k = 0; k < 4; k++) siffle(st, cfg, par);
  ok(`sabotage « arbitre sans poches » attrapé (jaune:0 : 4 fautes, nº${par} toujours sur le terrain — expulse=${!!st.players[par].expulse})`,
    !st.players[par].expulse && !st.events.some((e) => e.type === 'expulsion'));
}

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
