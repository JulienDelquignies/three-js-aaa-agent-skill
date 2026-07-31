#!/usr/bin/env node
// verify-attributes.mjs — LES NOTES DU JOUEUR (attributes.js), le contrat avec les projets amont.
// La question de fond : « les autres projets vont amener des attributs qui changent les mécaniques
// de réussite et le rendu ». Le contrat a trois lois : une note module DANS la bande humaine
// (jamais un surhomme), SANS notes rien ne change (au bit près — même règle que les hooks), et la
// note agit sur l'EXÉCUTION du joueur, pas sur la physique du monde.
import { ATTRIBUTES, makeProfile, gauss, checkAttributes } from '../assets/starter/src/engine/attributes.js';
import { makeMatch, matchCfg, playMatch } from '../assets/starter/src/engine/match-sim.js';
import { RONDO } from '../assets/starter/src/engine/rondo.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };

// ---------- 1. le contrat du mapping (bandes, monotonie, no-op du 50, clés inconnues)
{
  const r = checkAttributes();
  ok('contrat du mapping (bandes bornées, monotonie, no-op du joueur moyen)', r.ok, r.issues.join(' | '));
  ok(`le vocabulaire est documenté (${Object.keys(ATTRIBUTES).length} notes consommées)`, Object.keys(ATTRIBUTES).length >= 10);
  // le surhomme est impossible PAR CONSTRUCTION : 100 partout reste sous les plafonds du monde
  const best = makeProfile(Object.fromEntries(Object.keys(ATTRIBUTES).map((k) => [k, 100])));
  ok(`pace 100 × chase (${(best.topF * RONDO.speeds.chase).toFixed(2)} m/s) reste sous le plafond absolu (${RONDO.sprintMax ?? 8})`,
    best.topF * RONDO.speeds.chase <= (RONDO.sprintMax ?? 8) + 1e-9);
  // …et une note > 100 est ÉCRASÉE à la bande, pas amplifiée
  const cheat = makeProfile({ pace: 400 });
  ok(`sabotage « note 400 » écrasé à la bande (topF ${cheat.topF.toFixed(2)} = 1,10)`, Math.abs(cheat.topF - 1.10) < 1e-9);
  // le gauss seedé est borné (pas de queue infinie qui ruinerait une frappe sur un tirage)
  let worst = 0;
  const rnd = (() => { let s = 12345; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); })();
  for (let i = 0; i < 5000; i++) worst = Math.max(worst, Math.abs(gauss(rnd)));
  ok(`le bruit d'exécution est borné (|max| ${worst.toFixed(2)} ≤ 2,2 σ)`, worst <= 2.2);
}

// ---------- 2. SANS notes, rien ne change — la clause du socle sûr
{
  const a = makeMatch({ perTeam: 5, seed: 7 });
  ok('sans squads : aucun joueur noté, aucun levier attaché', a.players.every((p) => !p.skill && !p.ratings));
  const { st: s1 } = playMatch(makeMatch({ perTeam: 5, seed: 7 }), 60);
  const { st: s2 } = playMatch(makeMatch({ perTeam: 5, seed: 7 }), 60);
  ok(`même graine sans notes → même match (score ${s1.score} / ${s2.score}, ${s1.events.length} événements)`,
    s1.score[0] === s2.score[0] && s1.score[1] === s2.score[1] && s1.events.length === s2.events.length);
  // …et AVEC notes, même graine + mêmes notes → même match (le déterminisme survit à l'injection)
  const squads = [Array.from({ length: 6 }, () => ({ ratings: { passing: 70, pace: 60 } })), []];
  const { st: s3 } = playMatch(makeMatch({ perTeam: 5, seed: 7, squads }), 60);
  const { st: s4 } = playMatch(makeMatch({ perTeam: 5, seed: 7, squads }), 60);
  ok(`même graine + mêmes notes → même match (${s3.events.length} événements)`,
    s3.score[0] === s4.score[0] && s3.events.length === s4.events.length);
}

// ---------- 3. les notes SE VOIENT dans le jeu (élite contre faible, 3 graines × 120 s)
{
  const mk = (r) => Array.from({ length: 6 }, () => ({ ratings: r }));
  const elite = mk({ pace: 80, acceleration: 78, passing: 88, control: 85, finishing: 85, tackling: 80, reactions: 85, composure: 85, keeping: 88, dribbling: 82 });
  const faible = mk({ pace: 35, acceleration: 35, passing: 30, control: 35, finishing: 30, tackling: 35, reactions: 35, composure: 35, keeping: 30, dribbling: 35 });
  let scores = [0, 0], comp = [[0, 0], [0, 0]];
  for (const seed of [3, 7, 1]) {
    const st = makeMatch({ perTeam: 5, seed, squads: [elite, faible] });
    const { st: s2 } = playMatch(st, 120);
    scores[0] += s2.score[0]; scores[1] += s2.score[1];
    for (const pss of s2.events.filter((e) => e.type === 'pass' && e.to >= 0)) {
      const team = s2.players[pss.from].team;
      comp[team][1]++;
      if (s2.events.some((e) => e.type === 'receive' && e.by === pss.to && e.t >= pss.t && e.t < pss.t + 3.5)) comp[team][0]++;
    }
  }
  const pct = (t) => 100 * comp[t][0] / Math.max(1, comp[t][1]);
  ok(`l'élite domine au score (${scores[0]}:${scores[1]} cumulé sur 3 matchs)`, scores[0] > scores[1]);
  ok(`l'élite passe mieux (${pct(0).toFixed(0)} % contre ${pct(1).toFixed(0)} % — l'écart est la note, pas un hasard)`,
    pct(0) > pct(1) + 2);
  // …mais la note est un ACCENT : l'équipe faible joue encore au football (pas un 15-0 d'arcade)
  ok(`la note ne crée pas d'arcade (écart cumulé ${scores[0] - scores[1]} ≤ 9 sur 3 matchs)`, scores[0] - scores[1] <= 9);
}

// ---------- 4. la loi par levier (fixture, pas fréquence) : la passe notée dévie moins
{
  // deux profils, même tirage : l'erreur d'angle appliquée à la frappe est σ(passing) — on la lit
  // directement du mapping (la loi), et la clause du match élite/faible ci-dessus prouve l'effet.
  const p90 = makeProfile({ passing: 90 }), p30 = makeProfile({ passing: 30 });
  ok(`σ de passe : note 90 → ${(p90.passSigma * 180 / Math.PI).toFixed(2)}°, note 30 → ${(p30.passSigma * 180 / Math.PI).toFixed(2)}° (rapport ≥ 2,5)`,
    p30.passSigma / p90.passSigma >= 2.5);
  const k90 = makeProfile({ keeping: 90 }), k30 = makeProfile({ keeping: 30 });
  ok(`le gant noté : envergure ${k90.keeperReach.toFixed(2)} m vs ${k30.keeperReach.toFixed(2)} m, réflexe ${k90.keeperReflex.toFixed(3)} vs ${k30.keeperReflex.toFixed(3)} s`,
    k90.keeperReach > k30.keeperReach + 0.3 && k90.keeperReflex < k30.keeperReflex - 0.02);
}

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
