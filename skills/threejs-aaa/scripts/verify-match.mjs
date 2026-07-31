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

// ---------- 3 bis. LA CIRCULATION (le retour utilisateur, verrouillé en clauses)
// « Trop de conduite et des passes imprécises ou qui ne suivent pas l'appel » — mesuré tel quel :
// 21 % de passes reçues (le receveur trottait vers son couloir pendant que le ballon passait),
// mène figée 0,28 s (4 m derrière un coureur), tenue p90 3,6 s, 5 appels servis sur 74. Après le
// job 'receive' en vol + la mène de course + l'appel récompensé : 85 % / 1,7 s / 15 sur 82.
// Ces clauses tiennent le gain.
{
  let total = 0, recu = 0, appels = 0, servis = 0;
  const holds = [];
  for (const seed of [3, 7]) {
    const st = makeMatch({ perTeam: 5, seed });
    const { st: s2, trace } = playMatch(st, 120);
    const evs = s2.events;
    for (const p of evs.filter((e) => e.type === 'pass' && e.to >= 0)) {
      total++;
      if (evs.some((e) => e.type === 'receive' && e.by === p.to && e.t >= p.t && e.t < p.t + 3.5)) recu++;
    }
    for (const b of evs.filter((e) => e.type === 'burst' && e.kind === 'appel')) {
      appels++;
      if (evs.some((e) => e.type === 'pass' && e.to === b.by && e.t >= b.t && e.t <= b.t + 1.7)) servis++;
    }
    let h0 = -1, c0 = -1;
    for (const s of trace) {
      if (s.phase === 'carry' && c0 < 0) { h0 = s.t; c0 = s.carrier; }
      if ((s.phase !== 'carry' || s.carrier !== c0) && c0 >= 0) { holds.push(s.t - h0); c0 = -1; }
    }
  }
  holds.sort((a, b) => a - b);
  const p90 = holds[Math.floor(holds.length * 0.9)] ?? 0;
  ok(`les passes ARRIVENT (${recu}/${total} reçues = ${(100 * recu / Math.max(1, total)).toFixed(0)} % ≥ 60 — avant le receveur-en-vol : 21 %)`,
    recu / Math.max(1, total) >= 0.6);
  ok(`l'appel est SERVI (${servis}/${appels} = ${(100 * servis / Math.max(1, appels)).toFixed(0)} % ≥ 10 — avant : 7 %)`,
    servis / Math.max(1, appels) >= 0.10);
  ok(`on ne PORTE pas le ballon des heures (tenue p90 ${p90.toFixed(2)} s ≤ 2,6 — avant : 3,6)`, p90 <= 2.6);
}

// ---------- 3 ter. LA CONDUITE — présente ET précise (le retour utilisateur, deuxième passe :
// « pas trop de conduite : trop de conduite IMPRÉCISE — c'est important qu'il y ait de la
// conduite et des dribbles »). Mesuré avant : 11,4 % du temps de conduite avec le ballon échappé
// au-delà de 2,2 m (le porteur courait après son ballon), poussée qui zigzague à 60 Hz. Après la
// touche qui lit l'espace + la touche qui corrige + l'intention lissée : 5,4 % / p90 1,89 m /
// touches à 1-10° du cap. Ces clauses tiennent LES DEUX : la précision ET la présence.
{
  const dists = [], touch = [];
  let carryF = 0, freeF = 0;
  for (const seed of [3, 7]) {
    const st = makeMatch({ perTeam: 5, seed });
    const cfg = matchCfg();
    // le saut de vitesse se lit ENTRE DEUX FINS DE PAS (pv = v post-pas précédent) — la première
    // version comparait à travers deux pas et mesurait 97° là où l'instant de touche donne 10
    let pv = [0, 0];
    const { matchStep } = await import('../assets/starter/src/engine/match-sim.js');
    for (let i = 0; i < 120 * 60; i++) {
      matchStep(st, 1 / 60, cfg);
      const bv = [st.ball.v[0], st.ball.v[2]];
      const dv = Math.hypot(bv[0] - pv[0], bv[1] - pv[1]);
      const inCarry = st.phase === 'carry' && st.possession.carrier >= 0;
      if (inCarry) {
        const c = st.players[st.possession.carrier];
        if (!c.act) {
          carryF++;
          if (st.ball.owner == null) {
            freeF++;
            const dNow = Math.hypot(c.p[0] - st.ball.p[0], c.p[2] - st.ball.p[2]);
            dists.push(dNow);
            if (dv > 1.5 && dNow < 1.3 && c.push) {
              const l = Math.hypot(bv[0], bv[1]);
              if (l > 1) touch.push(Math.acos(Math.max(-1, Math.min(1, (bv[0] * c.push[0] + bv[1] * c.push[1]) / l))) * 180 / Math.PI);
            }
          }
        }
      }
      pv = bv;
    }
  }
  dists.sort((a, b) => a - b); touch.sort((a, b) => a - b);
  const q = (arr, p) => arr[Math.floor(arr.length * p)] ?? 0;
  const esc = dists.filter((d) => d > 2.2).length / Math.max(1, dists.length);
  ok(`la conduite est PRÉSENTE (${(100 * freeF / Math.max(1, carryF)).toFixed(0)} % du porté en touches libres ≥ 40 — le dribble fait partie du jeu)`,
    freeF / Math.max(1, carryF) >= 0.4);
  ok(`…et PRÉCISE : le ballon ne s'échappe pas (${(100 * esc).toFixed(1)} % > 2,2 m ≤ 7 — avant : 11,4)`, esc <= 0.07);
  ok(`…le ballon reste conduit (dist p90 ${q(dists, 0.9).toFixed(2)} m ≤ 2,1 — avant : 2,23)`, q(dists, 0.9) <= 2.1);
  ok(`…et la touche part OÙ LE PIED VEUT (p90 ${q(touch, 0.9).toFixed(0)}° ≤ 20 sur ${touch.length} touches)`, q(touch, 0.9) <= 20);
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
