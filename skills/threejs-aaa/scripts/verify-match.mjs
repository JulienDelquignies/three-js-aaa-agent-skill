#!/usr/bin/env node
// verify-match.mjs — LE MATCH RÉDUIT (pitch.js + keeper.js + match-sim.js), prouvé sans navigateur.
// Le pas d'« agrandir le terrain » : deux buts, des gardiens, des tirs, des remises EN RÈGLE, un
// score — par le MÊME game-loop que le rondo (match-sim est une configuration, pas un fork).
//
// Quatre moitiés : le TERRAIN (géométrie des sorties, Lois 9/15/16/17 au point de franchissement
// interpolé), le GARDIEN (position qui coupe l'angle, plongeon sans oracle), le MATCH JOUÉ
// (contrat complet sur graines, bandes de réalisme : conversion, arrêts, remises reprises), et
// les SABOTAGES (match sans tir attrapé, score trafiqué attrapé, remise volée attrapée).
import { makePitch, outRule, checkPitch, FULL, REDUIT } from '../assets/starter/src/engine/pitch.js';
import { KEEPER, keeperSpot, keeperDecide, shotCross, checkKeeper } from '../assets/starter/src/engine/keeper.js';
import { makeMatch, matchCfg, playMatch, checkMatch, MATCH } from '../assets/starter/src/engine/match-sim.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };

// ---------- 1. le terrain
{
  const p = makePitch();
  const r = checkPitch(p);
  ok('terrain RÉDUIT au contrat (surfaces, buts, éventail de sorties)', r.ok, r.issues.join(' | '));
  const rf = checkPitch(makePitch(FULL));
  ok('terrain PLEIN FORMAT (105 × 68, Loi 1) au contrat — le 11c11 a déjà son sol', rf.ok, rf.issues.join(' | '));
  // sabotage : une surface plus profonde que la moitié — attrapé
  const bad = checkPitch(makePitch({ ...REDUIT, box: { depth: 30, width: 15 } }));
  ok('sabotage « surface plus profonde que la moitié » attrapé', !bad.ok);
  // le point de franchissement est INTERPOLÉ : un tir qui traverse le coin croise la ligne de BUT
  // d'abord — juger sur l'image d'arrivée aurait dit « touche »
  const g = outRule(p, [p.hx - 0.5, 0.1, p.hz - 0.5], [p.hx + 1.5, 0.1, p.hz + 0.4], 0);
  ok(`le franchissement en coin suit la PREMIÈRE ligne croisée (${g.type})`, g.type === 'sortie-de-but');
}

// ---------- 2. le gardien
{
  const p = makePitch();
  const r = checkKeeper(p);
  ok('gardien au contrat (ligne ballon-but, profondeur, réflexe, pas d\'aimant)', r.ok, r.issues.join(' | '));
  // symétrie : le même tir à gauche et à droite plonge des deux côtés
  const me = [p.ownGoal(0).x + 0.6, 0, 0];
  const L = keeperDecide(p, 0, me, [me[0] + 9, 0.11, 1.5], [-14, 1.5, -0.9], 0.3);
  const R = keeperDecide(p, 0, me, [me[0] + 9, 0.11, -1.5], [-14, 1.5, 0.9], 0.3);
  ok(`le plongeon est symétrique (gauche ${L.mode}/${L.side ?? '-'}, droite ${R.mode}/${R.side ?? '-'})`,
    L.mode === 'dive' && R.mode === 'dive' && L.side === -R.side);
  // la profondeur COUPE L'ANGLE : à 12 m il est sorti plus qu'à 24 m
  const far = keeperSpot(p, 0, [p.ownGoal(0).x + 24, 0, 0]).depth;
  const near = keeperSpot(p, 0, [p.ownGoal(0).x + 12, 0, 0]).depth;
  ok(`la sortie coupe l'angle (24 m → ${far.toFixed(2)} m, 12 m → ${near.toFixed(2)} m)`, near > far + 0.3);
  // un vol qui s'éloigne du but ne croise jamais le plan
  ok('un ballon qui s\'éloigne ne « croise » pas le plan du but', shotCross(p, 0, [0, 0.11, 0], [+8, 0, 0]) === null);
}

// ---------- 3. le match joué (les bandes du réel, mesurées sur graines)
{
  let shots = 0, buts = 0, arrets = 0, dives = 0, gestes = 0, contratsOk = 0;
  const types = new Set();
  const SEEDS = [3, 7, 11, 1];
  for (const seed of SEEDS) {
    const st = makeMatch({ perTeam: 5, seed });
    const { st: s2, trace } = playMatch(st, 120);
    const r = checkMatch(s2, trace);
    if (r.ok) contratsOk++;
    else console.log(`  (graine ${seed} : ${r.issues[0]})`);
    shots += r.stats.shots; buts += r.stats.buts; arrets += r.stats.arrets;
    dives += s2.events.filter((e) => e.type === 'dive').length;
    gestes += s2.events.filter((e) => e.type === 'skill').length;
    for (const o of s2.events.filter((e) => e.type === 'sortie')) types.add(o.out);
  }
  ok(`${SEEDS.length} matchs de 120 s : contrat complet sur chaque graine (${contratsOk}/${SEEDS.length})`, contratsOk === SEEDS.length);
  ok(`ça TIRE (${shots} tirs — ≥ 3 par match en moyenne)`, shots >= SEEDS.length * 3);
  ok(`ça MARQUE, dans la bande du réel (${buts} buts pour ${shots} tirs : conversion ${(100 * buts / Math.max(1, shots)).toFixed(0)} % ∈ [8, 55])`,
    buts >= 1 && buts / Math.max(1, shots) >= 0.08 && buts / Math.max(1, shots) <= 0.55);
  ok(`le gardien ARRÊTE (${arrets} arrêts sur ${dives} plongeons)`, arrets >= SEEDS.length);
  ok(`les remises ont VÉCU en plusieurs espèces (${[...types].join(', ')})`, types.size >= 2);
  ok(`le vocabulaire du rondo a survécu au match (${gestes} gestes techniques — râteaux/feintes/semelles en match)`, gestes >= 4);
}

// ---------- 4. les sabotages
{
  // un match SANS tir (le hook retiré) : la clause « rondo décoré » attrape
  const st = makeMatch({ perTeam: 5, seed: 3 });
  const cfg = matchCfg({ tryShot: null });
  const { st: s2, trace } = playMatch(st, 90, { cfg });
  const r = checkMatch(s2, trace, cfg);
  ok('sabotage « match sans tir » attrapé (PERSONNE NE TIRE)', !r.ok && r.issues.some((i) => i.includes('TIRE')));

  // un score trafiqué ne colle plus aux événements
  const st2 = makeMatch({ perTeam: 5, seed: 7 });
  const { st: s3, trace: t3 } = playMatch(st2, 90);
  s3.score[0] += 1;
  const r2 = checkMatch(s3, t3);
  ok('sabotage « score trafiqué » attrapé (score ≠ événements de but)', !r2.ok && r2.issues.some((i) => i.includes('score')));

  // une remise volée par la mauvaise équipe — attrapée
  const st3 = makeMatch({ perTeam: 5, seed: 7 });
  const { st: s4, trace: t4 } = playMatch(st3, 90);
  const o = s4.events.find((e) => e.type === 'sortie');
  if (o) {
    const wrong = s4.players.find((p) => p.team !== o.team && !p.keeper);
    s4.events.push({ t: o.t + 0.5, type: 'restart-pris', by: wrong.id });
    // …et on retire la vraie prise pour que la fausse soit la première dans la fenêtre
    const real = s4.events.findIndex((e) => e.type === 'restart-pris' && e.t >= o.t && e.t <= o.t + 6 && e.by !== wrong.id);
    if (real >= 0) s4.events.splice(real, 1);
    s4.events.sort((a, b) => a.t - b.t);
    const r3 = checkMatch(s4, t4);
    ok('sabotage « remise volée » attrapé (mauvaise équipe à la reprise)', !r3.ok && r3.issues.some((i) => i.includes('prise par')));
  } else ok('sabotage « remise volée » (aucune sortie sur cette graine — sabotage sans objet)', true);
}

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
