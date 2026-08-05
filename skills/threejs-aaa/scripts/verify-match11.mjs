#!/usr/bin/env node
// verify-match11.mjs — LE 11C11 EST UNE CONFIGURATION, ET ÇA SE PROUVE (la promesse de
// MOTEUR.md « greffer le 11c11 : le chemin balisé », tenue).
//
// La demande utilisateur qui fonde le banc : « un autre projet qui s'appuie sur ce qu'on a fait
// a une tuyauterie de match tellement complexe que le rendu 3D est horrible — je veux m'assurer
// que ce qu'on fait fonctionne avec 22 joueurs de façon fluide ». La réponse du moteur :
// makeMatch({ full: true }) — terrain Loi 1 (105 × 68), 10 + gardien par équipe, formation
// 4-3-3 dont le bloc coulisse, MÊME game-loop, mêmes lois, zéro fork. Mesuré : sim 0,44 ms/step
// à 22 joueurs ; scène complète (couches + IK + warps) 3,65 ms/image ; fps 22 corps = 75 % du
// fps 12 corps en rasterisation CPU pure (le pire cas — le stade domine les triangles).
//
// V1 assumée : ce banc prouve l'ARCHITECTURE (ça tourne, le bloc est un bloc, pas de gel, le
// budget tient). L'ÉQUILIBRE de jeu du plein format (tempo, tirs, conversion — les bandes fines
// du réduit) est la dette nommée du backlog « réglage 11c11 ».
import { makePitch, FULL } from '../assets/starter/src/engine/pitch.js';
import { formationSpots, checkFormation } from '../assets/starter/src/engine/formation.js';
import { makeMatch, matchCfg, matchStep, checkMatch, playMatch } from '../assets/starter/src/engine/match-sim.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };

// ---------- 1. la formation est une donnée saine
{
  const pitch = makePitch(FULL);
  for (const team of [0, 1]) {
    const c = checkFormation(pitch, team);
    ok(`la formation 4-3-3 de l'équipe ${team} est SAINE (postes dans le terrain, lignes ordonnées, largeur, bloc qui coulisse)`, c.ok, c.issues.join(' ; '));
  }
}

// ---------- 2. le monde 22 corps tourne, contrat de base, budget
{
  const st = makeMatch({ full: true, seed: 3 });
  ok(`makeMatch({ full }) : 22 joueurs sur ${st.pitch.dims.length} × ${st.pitch.dims.width} (Loi 1)`,
    st.players.length === 22 && st.pitch.dims.length === 105 && st.full === true);
  const cfg = matchCfg({ shotRange: 20 });
  const t0 = process.hrtime.bigint();
  let gelMax = 0, sinceEvent = 0, passes = 0;
  let lastN = 0;
  for (let i = 0; i < 180 * 60; i++) {
    matchStep(st, 1 / 60, cfg);
    if (st.events.length > lastN) { lastN = st.events.length; sinceEvent = 0; } else sinceEvent += 1 / 60;
    gelMax = Math.max(gelMax, sinceEvent);
  }
  const msStep = Number(process.hrtime.bigint() - t0) / 1e6 / (180 * 60);
  passes = st.events.filter((e) => e.type === 'pass').length;
  ok(`la sim 22 joueurs tient son budget (${msStep.toFixed(2)} ms/step ≤ 1,5 — mesuré 0,44 sur la machine de calibrage)`, msStep <= 1.5);
  ok(`le jeu VIT en plein format (${passes} passes en 3 min ≥ 25, ${st.events.filter((e) => e.type === 'shot').length} tirs)`, passes >= 25);
  ok(`le monde ne GÈLE jamais (plus long silence d'événements ${gelMax.toFixed(1)} s ≤ 25)`, gelMax <= 25);
  // le contrat de base du match juge aussi ce monde (téléports, ledger, score-événements)
  const st2 = makeMatch({ full: true, seed: 7 });
  const { st: s2, trace } = playMatch(st2, 90, { cfg: matchCfg({ shotRange: 20 }) });
  const r = checkMatch(s2, trace, cfg);
  ok(`le CONTRAT du match tient à 22 (checkMatch : ${r.ok ? 'ok' : r.issues.slice(0, 2).join(' ; ')})`, r.ok);
}

// ---------- 3. le bloc est un BLOC : les postes sont TENUS en jeu
{
  const st = makeMatch({ full: true, seed: 11 });
  const cfg = matchCfg({ shotRange: 20 });
  let cover = 0, n = 0;
  for (let i = 0; i < 120 * 60; i++) {
    matchStep(st, 1 / 60, cfg);
    if ((i % 60) !== 0 || st.restart) continue;
    // à chaque seconde de jeu ouvert : combien des 10 postes de CHAQUE équipe ont un corps à
    // ≤ 12 m ? (les actifs — porteur, presseur, coureurs — désertent le leur : c'est le jeu)
    for (const team of [0, 1]) {
      const atk = st.possession.team === team;
      const spots = formationSpots(st.pitch, team, st.ball.p[0], atk);
      const mine = st.players.filter((q) => q.team === team && !q.keeper && q.down <= 0);
      let covered = 0;
      for (const [x, z] of spots) {
        if (mine.some((q) => Math.hypot(q.p[0] - x, q.p[2] - z) < 12)) covered++;
      }
      cover += covered; n += 10;
    }
  }
  const pct = (100 * cover / Math.max(1, n));
  // 55 : le monde mesuré vit à 60 % — les ~6 ACTIFS par équipe (porteur, soutiens, press,
  // cover, marqueurs) désertent leur poste pour JOUER, c'est le football ; les postés tiennent
  // le reste. L'existence du bloc est prouvée par le sabotage dessous (dispersion +5,8 m).
  ok(`le bloc TIENT ses postes (${pct.toFixed(0)} % des postes couverts à ≤ 12 m ≥ 55 — un bloc lisible, pas un essaim)`, pct >= 55);
}

// ---------- 4. sabotage nommé : sans la formation, le 22-corps redevient l'essaim du réduit
{
  // les couloirs du réduit ne savent poster que ~9 corps par équipe (5 slots + press/cover/
  // marks) — mesurer la DISPERSION du bloc : sans postes, les non-servis s'agglutinent
  const disp = (full) => {
    const st = makeMatch({ full: true, seed: 3 });
    if (!full) st.full = false;                                    // le sabotage : la config du réduit sur 22 corps
    const cfg = matchCfg({ shotRange: 20 });
    let spread = 0, n = 0;
    for (let i = 0; i < 60 * 60; i++) {
      matchStep(st, 1 / 60, cfg);
      if ((i % 60) !== 0 || st.restart) continue;
      for (const team of [0, 1]) {
        const mine = st.players.filter((q) => q.team === team && !q.keeper);
        const cx = mine.reduce((a, q) => a + q.p[0], 0) / mine.length;
        const cz = mine.reduce((a, q) => a + q.p[2], 0) / mine.length;
        spread += mine.reduce((a, q) => a + Math.hypot(q.p[0] - cx, q.p[2] - cz), 0) / mine.length;
        n++;
      }
    }
    return spread / Math.max(1, n);
  };
  const avec = disp(true), sans = disp(false);
  ok(`sabotage « essaim » attrapé (dispersion du bloc ${avec.toFixed(1)} m avec les postes, ${sans.toFixed(1)} sans — la formation OCCUPE le terrain, ≥ +3 m)`,
    avec >= sans + 3);
}

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
