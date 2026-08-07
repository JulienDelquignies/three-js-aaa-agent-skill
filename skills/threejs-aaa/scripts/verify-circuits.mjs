#!/usr/bin/env node
// verify-circuits.mjs — LE STYLE ÉCRIT LES CIRCUITS, ET LE COUREUR EST SERVI.
//
// Lot 36, deux chantiers liés. (1) L'APPEL SERVI RETROUVÉ : la bascule (lot 35) avait tué le
// service du coureur profond — diagnostic en trois étages : 79 % des fenêtres HORS PORTÉE (le
// dart sort de l'enveloppe en 0,6 s), mais quand il est évaluable le coureur GAGNE 37 % des
// choix… et 0 passe partait : les portes d'engagement (technique 932 / ballon-vif 865 / ancre
// 642 refus) mangeaient la fenêtre de course entière. Le remède NATIF du tir (lot 6a) et du
// centre (lot 34) : la touche de PRÉPARATION quand l'intention vise un coureur vivant — et la
// loi du coureur au barème (point doux neutralisé, comme la bascule). (2) LE STYLE PILOTE LE
// VOCABULAIRE : l'axe style [0..1] module la densité de bascule (±1 corps), son bonus (±0,5)
// et le service (×0,7-1,3) — à 0,5 EXACTEMENT les valeurs d'aujourd'hui (axe() au milieu
// exact). Signature mesurée : possession 20 renversements / direct 7 sur 3 graines — les
// styles produisent des CIRCUITS mesurablement différents.
import { makeMatch, matchCfg, matchStep } from '../assets/starter/src/engine/match-sim.js';
import { choosePass } from '../assets/starter/src/engine/rondo.js';
import { axe } from '../assets/starter/src/engine/tactics.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };

// ---------- 1. l'identité au défaut, deux preuves : le milieu EXACT et le monde inchangé
{
  ok(`le milieu de l'axe est EXACT (axe(0,5, 0,7, 1,3) = ${axe(0.5, 0.7, 1.3)} ≡ 1 ; axe(0,5, −1, 1) = ${axe(0.5, -1, 1)} ≡ 0 — pas un ulp de dérive au défaut)`,
    axe(0.5, 0.7, 1.3) === 1 && axe(0.5, -1, 1) === 0);
  const run = (tactics) => {
    const st = makeMatch({ full: true, seed: 3, tactics });
    const cfg = matchCfg({ shotRange: 20 });
    for (let i = 0; i < 60 * 60; i++) matchStep(st, 1 / 60, cfg);
    return JSON.stringify(st.events);
  };
  ok(`l'ÉQUILIBRE explicite = le défaut, octet pour octet (60 s de match : mêmes événements — le câblage du style est un no-op à 0,5)`,
    run(null) === run(['equilibre', 'equilibre']));
}

// ---------- 2. la LOI DU COUREUR (fixture déterministe) : évaluable, il gagne
{
  const st = makeMatch({ full: true, seed: 3 });
  const cfg = matchCfg({ shotRange: 20 });
  for (let i = 0; i < 30 * 60 && !(st.phase === 'carry' && st.possession.carrier >= 0 && !st.restart); i++) matchStep(st, 1 / 60, cfg);
  const c = st.players[st.possession.carrier];
  const sgn = Math.sign(st.pitch.attackGoal(c.team).x || 1);
  for (const q of st.players) if (q.id !== c.id) { q.p[0] = c.p[0] - sgn * 40; q.p[2] = (q.id % 11) * 2 - 10; q.v = [0, 0]; q.act = null; q.down = 0; }
  const coureur = st.players.find((q) => q.team === c.team && !q.keeper && q.id !== c.id);
  coureur.p[0] = st.ball.p[0] + sgn * 14; coureur.p[2] = st.ball.p[2] + 2;   // devant, en rupture
  coureur.v = [sgn * 6, 0];
  coureur._pace = { until: st.t + 2, kind: 'appel' };
  // la LIGNE doit vivre DEVANT la course (leçon : tout le monde parqué derrière = coureur
  // hors-jeu, choix null) : le gardien adverse sur SON but (dernier), le marqueur à +20
  // (avant-dernier) — la course à +14 est LICITE
  const gkAdv = st.players.find((q) => q.team !== c.team && q.keeper);
  gkAdv.p[0] = st.pitch.attackGoal(c.team).x - sgn * 0.8; gkAdv.p[2] = 0;
  const marqueur = st.players.find((q) => q.team !== c.team && !q.keeper);
  marqueur.p[0] = st.ball.p[0] + sgn * 20; marqueur.p[2] = st.ball.p[2] + 2; // l'avant-dernier, derrière la course
  const choix = choosePass(st, cfg);
  ok(`le COUREUR VIVANT est choisi (course de nº${coureur.id} à 14 m : choix=${choix?.to?.id}, ${choix?.dist?.toFixed(1)} m — le point doux des 10 m ne le juge plus)`,
    choix?.to?.id === coureur.id);
}

// ---------- 3. les CIRCUITS PAR STYLE : possession bascule, direct va devant — et le service VIT
{
  const mesure = (tactics) => {
    let servis = 0, renv = 0;
    for (const seed of [1, 3, 5]) {
      const st = makeMatch({ full: true, seed, tactics });
      const cfg = matchCfg({ shotRange: 20 });
      for (let i = 0; i < 180 * 60; i++) matchStep(st, 1 / 60, cfg);
      const bursts = st.events.filter((e) => e.type === 'burst' && e.kind === 'appel-profond');
      servis += st.events.filter((e) => e.type === 'pass').filter((p) => bursts.some((b) => b.by === p.to && p.t - b.t >= 0 && p.t - b.t < 2.5)).length;
      renv += st.events.filter((e) => e.type === 'renversement').length;
    }
    return { servis, renv };
  };
  const neutre = mesure(null), poss = mesure(['possession', 'possession']), direct = mesure(['direct', 'direct']);
  ok(`la SIGNATURE des circuits (3 graines × 180 s : possession ${poss.renv} renversements > direct ${direct.renv} × 1,5 — mesuré 20/7 : la possession recycle au large, le direct va devant)`,
    poss.renv > direct.renv * 1.5);
  ok(`le SERVICE du coureur VIT dans tous les mondes (neutre ${neutre.servis} + possession ${poss.servis} + direct ${direct.servis} = ${neutre.servis + poss.servis + direct.servis} ≥ 3 — était 0 partout : les portes d'engagement mangeaient la fenêtre)`,
    neutre.servis + poss.servis + direct.servis >= 3);
}

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
