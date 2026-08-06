#!/usr/bin/env node
// verify-tactics.mjs — LA TACTIQUE EST UN CONTRAT, PAS UN PLACEBO.
// Cinq axes qui GÉNÈRENT l'espace des styles ; le défaut (0,5) est l'IDENTITÉ du monde mesuré
// des lots 10-14 (au bit près) ; chaque axe prouve qu'il BOUGE son instrument — en flux quand
// le flux le montre (hauteur, largeur), au mécanisme déterministe quand le flux est confondu
// (pressing : durées de fenêtre ; style : bascule d'un choix serré — la tactique ORIENTE, elle
// ne force pas un choix dominant). Dettes nommées : instruments de flux pressing/style/
// transition, catalogue de formations (couche rôles).
import { makeMatch, matchCfg, matchStep } from '../assets/starter/src/engine/match-sim.js';
import { checkTactics, axe } from '../assets/starter/src/engine/tactics.js';
import { arbitre } from '../assets/starter/src/engine/menace.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };

// ---------- 1. le contrat pur
{
  const c = checkTactics();
  ok(`le contrat des axes tient (checkTactics : presets bornés, défaut identitaire, axe honnête)`, c.ok, c.issues.join(' ; '));
  ok(`le milieu d'axe est EXACT (axe(0,5, 0,85, 1,15) === 1 — l'identité ne meurt pas d'un ulp)`, axe(0.5, 0.85, 1.15) === 1 && axe(0.5, -6, 6) === 0);
}

// ---------- 2. l'IDENTITÉ : tactique absente === équilibre explicite, octet pour octet
{
  const run = (tactics) => {
    const st = makeMatch({ full: true, seed: 3, tactics });
    const cfg = matchCfg({ shotRange: 20 });
    for (let i = 0; i < 60 * 60; i++) matchStep(st, 1 / 60, cfg);
    return JSON.stringify(st.events);
  };
  ok(`le DÉFAUT est l'identité (tactics absent === ['equilibre','equilibre'], 60 s d'événements identiques — et toute la batterie des lots 10-14 reste verte au bit près)`,
    run(null) === run(['equilibre', 'equilibre']));
}

// ---------- 3. les axes de flux : hauteur et largeur BOUGENT leurs instruments
{
  const run = (t0) => {
    const st = makeMatch({ full: true, seed: 3, tactics: [t0, null] });
    const cfg = matchCfg({ shotRange: 20 });
    let depth = 0, nD = 0, z = 0, nZ = 0;
    for (let i = 0; i < 150 * 60; i++) {
      matchStep(st, 1 / 60, cfg);
      if (st.restart) continue;
      const og = st.pitch.ownGoal(0);
      if (st.possession.team === 1) {
        const advs = st.players.filter((p) => p.team === 0 && !p.keeper).map((p) => Math.abs(p.p[0] - og.x)).sort((a, b) => a - b);
        depth += advs[1] ?? 0; nD++;
      }
      if (st.possession.team === 0 && st.t - (st._possChangeAt ?? -99) > 5) {
        for (const p of st.players) if (p.team === 0 && !p.keeper && (p.post ?? 0) >= 7) { z += Math.abs(p.p[2]); nZ++; }
      }
    }
    return { ligne: nD ? depth / nD : 0, zTrio: nZ ? z / nZ : 0 };
  };
  const bas = run({ hauteurBloc: 0 }), haut = run({ hauteurBloc: 1 });
  ok(`la HAUTEUR DE BLOC bouge la ligne (bloc bas ${bas.ligne.toFixed(1)} m de son but, ligne haute ${haut.ligne.toFixed(1)} — écart ≥ 5, mesuré +8,3)`,
    haut.ligne >= bas.ligne + 5);
  const etroit = run({ largeur: 0 }), large = run({ largeur: 1 });
  ok(`la LARGEUR bouge le trio (jeu dedans |z| ${etroit.zTrio.toFixed(1)} m, jeu d'ailes ${large.zTrio.toFixed(1)} — écart ≥ 2,5, mesuré +4,2)`,
    large.zTrio >= etroit.zTrio + 2.5);
}

// ---------- 4. le PRESSING au mécanisme : la fenêtre d'une école de chasse dure plus, revient plus vite
{
  const fen = (pressing) => {
    const st = makeMatch({ full: true, seed: 5, tactics: [null, { pressing }] });   // T1 presse
    const cfg = matchCfg({ shotRange: 20 });
    const sgn = -st.pitch.ownGoal(0).sign;
    for (const q of st.players.filter((q) => q.team === 1)) q.p[0] = sgn * (q.keeper ? 51 : 20);
    for (const q of st.players.filter((q) => q.team === 0 && !q.keeper)) q.p[0] = -sgn * 8;
    const c0 = st.players.find((p) => p.team === 0 && p.post === 5);
    c0.p[0] = -sgn * 10; c0.p[2] = 0; c0.yaw = sgn > 0 ? Math.PI : 0;
    st.ball.restart([c0.p[0], 0.11, 0], { cause: 'coup-franc' });
    st.restart = null; st.ball.possess(c0.id);
    st.possession = { team: 0, carrier: c0.id }; st.phase = 'carry'; st.hold = 0.1; st.lastTouch = 0;
    matchStep(st, 1 / 60, cfg);
    return { win: st._press ? +(st._press.until - st.t).toFixed(2) : null, cd: +((st._pressCd?.[1] ?? 0) - st.t).toFixed(1) };
  };
  const doux = fen(0), chasse = fen(1);
  ok(`l'AGRESSIVITÉ est un mécanisme mesurable (fenêtre douce ${doux.win} s / chasse ${chasse.win} s ; retour au calme ${doux.cd} / ${chasse.cd} s — l'école de la chasse presse PLUS LONGTEMPS, PLUS SOUVENT)`,
    doux.win != null && chasse.win != null && chasse.win - doux.win >= 2 && doux.cd - chasse.cd >= 5);
}

// ---------- 5. le STYLE départage les choix SERRÉS (l'arbitre par équipe)
{
  const monde = (style) => {
    const st = makeMatch({ full: true, seed: 5, tactics: [{ style }, null] });
    const sgn = -st.pitch.ownGoal(0).sign;
    const goal = st.pitch.attackGoal(0);
    for (const q of st.players.filter((q) => q.team === 1)) { q.p[0] = sgn * 20; q.p[2] = -25; }
    for (const q of st.players.filter((q) => q.team === 0 && !q.keeper)) { q.p[0] = -sgn * 20; q.p[2] = 25; }
    const gk1 = st.players.find((q) => q.team === 1 && q.keeper); gk1.p[0] = goal.x; gk1.p[2] = 0;
    const c = st.players.find((p) => p.team === 0 && p.post === 8);
    c.p[0] = goal.x - sgn * 11; c.p[2] = 0;
    // le mur est DESSERRÉ (±2,05 — le couloir de tir vaut ~0,5 m) : le monde est à QUASI-
    // ÉGALITÉ passe/tir, exactement là où le style doit départager (à ±1,6, la passe gagnait
    // d'un cheveu SOUS LES DEUX styles — 0,393 contre 0,385 : un banc qui ne bascule pas ne
    // prouve rien)
    const wall = st.players.filter((p) => p.team === 1 && !p.keeper).slice(0, 3);
    wall[0].p[0] = goal.x - sgn * 5.5; wall[0].p[2] = 2.05;
    wall[1].p[0] = goal.x - sgn * 5.5; wall[1].p[2] = -2.05;
    wall[2].p[0] = goal.x - sgn * 5.5; wall[2].p[2] = 0;
    const mate = st.players.find((p) => p.team === 0 && p.post === 9);
    mate.p[0] = goal.x - sgn * 7; mate.p[2] = 7;
    st.ball.restart([c.p[0] + 0.3, 0.11, 0], { cause: 'coup-franc' });
    st.restart = null; st.ball.possess(c.id);
    st.possession = { team: 0, carrier: c.id }; st.phase = 'carry'; st.hold = 1.0; st.lastTouch = 0;
    return arbitre(st, c, matchCfg({ shotRange: 20 }));
  };
  const p = monde(0), d = monde(1);
  ok(`le STYLE bascule un choix serré (possession → « ${p.meilleure} », direct → « ${d.meilleure} » — même monde, deux équipes, deux footballs ; un choix dominant, lui, reste dominant)`,
    p.meilleure === 'passe' && d.meilleure !== 'passe');
}

// ---------- 6. sabotage nommé « tactique placebo » : deux presets opposés ⇒ deux récits
{
  const recit = (tactics) => {
    const st = makeMatch({ full: true, seed: 4, tactics });
    const cfg = matchCfg({ shotRange: 20 });
    for (let i = 0; i < 90 * 60; i++) matchStep(st, 1 / 60, cfg);
    return JSON.stringify(st.events);
  };
  ok(`sabotage « tactique placebo » attrapé (gegenpressing/blocBas ≠ blocBas/gegenpressing — la tactique ÉCRIT le match, elle ne le décore pas)`,
    recit(['gegenpressing', 'blocBas']) !== recit(['blocBas', 'gegenpressing']));
}

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
