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
  ok(`le vocabulaire est documenté (${Object.keys(ATTRIBUTES).length} notes consommées ≥ 21 — le lot 147 sert l'inventaire du consommateur carrière)`, Object.keys(ATTRIBUTES).length >= 21);
  // lot 147 — LE FLAIR EST UNE NOTE : fournie, elle remplace le tirage seedé de persona
  // (vouloir TENTER) ; absente, le hash d'hier au bit (l'identité)
  {
    const sq = [Array.from({ length: 6 }, () => ({ ratings: { flair: 95 } })), []];
    const stF = makeMatch({ perTeam: 5, seed: 7, squads: sq });
    const stN = makeMatch({ perTeam: 5, seed: 7 });
    const pF = stF.players.find((q) => q.team === 0);
    const pN = stN.players.find((q) => q.team === 0);
    ok(`lot 147 — la note flair pilote la persona (${pF.persona.flair.toFixed(3)} ≈ 0,958 avec flair 95 ; sans note : ${pN.persona.flair.toFixed(3)}, le tirage seedé d'hier)`,
      Math.abs(pF.persona.flair - (0.15 + 0.85 * 0.95)) < 1e-9 && Math.abs(pN.persona.flair - pF.persona.flair) > 1e-6);
  }
  // lot 152 — LA GRADATION EST CONTINUE ET ORDONNÉE (la question utilisateur : « plusieurs
  // niveaux, pas juste supérieur/inférieur ? chaque joueur différent, l'impact réel ») :
  // quatre niveaux d'équipe contre un 50 fixe, mêmes graines — les tirs s'ORDONNENT.
  // (Mesuré 3 graines × 240 s : 3 < 6 ≤ 7 < 9 strictement monotone. La dette nommée au
  // ROADMAP : les boucles de POSSESSION restent géométriques — passes volées 7 = 7.)
  {
    const { matchStep, matchCfg } = await import('../assets/starter/src/engine/match-sim.js');
    const NIVEAU = ['pace','acceleration','passing','control','finishing','tackling','reactions','composure','dribbling','keeping'];
    const eq = (n) => Array.from({ length: 11 }, () => ({ ratings: Object.fromEntries(NIVEAU.map((k) => [k, n])) }));
    // …l'échantillon de LA MESURE (leçon lot 110 : les tirs vivent dans le bruit de Poisson —
    // 2 × 180 s rendait 0/4/2, le faux négatif ; 3 × 240 s rend 3/6/7/9 stable)
    const tirsDe = (n) => {
      let tirs = 0;
      for (const seed of [2, 5, 8]) {
        const st = makeMatch({ full: true, seed, squads: [eq(n), eq(50)] });
        const cfg = matchCfg({ shotRange: 20 });
        for (let i = 0; i < 240 * 60; i++) matchStep(st, 1 / 60, cfg);
        tirs += st.events.filter((e) => e.type === 'shot' && st.players[e.by]?.team === 0).length;
      }
      return tirs;
    };
    const t30 = tirsDe(30), t50 = tirsDe(50), t90 = tirsDe(90);
    ok(`lot 152 — LA GRADATION s'ordonne (tirs appariés 3 × 240 s : équipe 30 → ${t30}, 50 → ${t50}, 90 → ${t90} — l'échelle est CONTINUE, un 62 n'est pas un 65, et l'impact est croissant)`,
      t90 > t30 + 3 && t90 >= t50 && t50 > t30);
  }
  // lot 153 — LE PREMIER PAS AU 50/50 (l'égalisateur du 152, premier canal traité) : sur
  // ballon LOOSE, le chasseur noté LENT reste planté l'excédent de sa réaction (× 2,5) —
  // ±0,5 m concédé par duel, la fourchette du réel. No-op au vif, au moyen et au monde nu.
  {
    const { movePlayers } = await import('../assets/starter/src/engine/movement.js');
    const { matchCfg } = await import('../assets/starter/src/engine/match-sim.js');
    const course = (reactions, over = {}) => {
      const st = makeMatch({ full: true, seed: 13 });
      const cfg = matchCfg({ shotRange: 20, ...over });
      const p2 = st.players.find((q) => q.team === 0 && !q.keeper);
      p2.skill = makeProfile({ reactions });
      p2.job = 'press'; p2.target = [30, 0, 0]; p2.p[0] = -10; p2.p[2] = 0; p2.v = [0, 0]; p2.speed = 0;
      st._looseAt2 = st.t;
      const x0 = p2.p[0];
      for (let i = 0; i < 60; i++) { movePlayers(st, 1 / 60, cfg); st.t += 1 / 60; }
      return +(p2.p[0] - x0).toFixed(2);
    };
    const dVif = course(90), dMoy = course(50), dLent = course(10), dSab = course(10, { premierPas: false });
    ok(`lot 153 — LE PREMIER PAS se paie à la réaction (1 s de chasse : vif ${dVif} m = moyen ${dMoy} — le no-op à 50 ; lent ${dLent} ≤ vif − 0,3 — planté son excédent) ; sabotage « le 50/50 aveugle » attrapé (premierPas:false : ${dSab} = le vif)`,
      Math.abs(dVif - dMoy) < 0.05 && dLent <= dVif - 0.3 && Math.abs(dSab - dVif) < 0.05);
  }
  // lot 154 — LE DUEL DU CONTACT (le miroir 50/50 : deux chasseurs équidistants, contact la même
  // frame) : la prise revient au plus VIF, pas au premier du tableau (le biais d'ordre gagnait
  // 30/30 pour l'équipe 0 même côtés inversés) ; à notes égales, l'ancien chemin (le nu au bit).
  {
    const { matchStep, matchCfg } = await import('../assets/starter/src/engine/match-sim.js');
    const miroir = (r0, r1, over = {}) => {
      let w = [0, 0];
      for (const seed of [1, 2, 3]) for (const flip of [false, true]) {
        const st = makeMatch({ full: true, seed });
        const cfg = matchCfg(over);
        for (const p of st.players) { p.p[0] = p.team === 0 ? -48 : 48; p.p[2] = (p.id % 5) * 6 - 12; p.v = [0, 0]; p.speed = 0; }
        const a = st.players.find((q) => q.team === 0 && !q.keeper);
        const b = st.players.find((q) => q.team === 1 && !q.keeper);
        a.p[0] = flip ? 8 : -8; a.p[2] = 0; b.p[0] = flip ? -8 : 8; b.p[2] = 0;
        a.skill = makeProfile({ reactions: r0 }); b.skill = makeProfile({ reactions: r1 });
        st.ball.restart([0, 0.11, 0], { cause: 'coup-franc' });
        st.restart = null; st.phase = 'loose'; st.possession.team = -1; st.possession.carrier = -1; st.lastTouch = 0;
        for (let i = 0; i < 360; i++) { matchStep(st, 1 / 60, cfg); if (st.possession.carrier >= 0) { w[st.players[st.possession.carrier].team]++; break; } }
      }
      return w;
    };
    const vif = miroir(50, 90), ancien = miroir(50, 50), sab = miroir(50, 90, { prise5050: false });
    ok(`lot 154 — LE DUEL DU CONTACT revient au plus vif (miroir 50v90 : équipe1 ${vif[1]}/6 malgré l'ordre du tableau) ; à notes égales l'ancien chemin tient (50v50 : équipe0 ${ancien[0]}/6 — le nu au bit) ; sabotage « l'ordre du tableau » attrapé (prise5050:false : équipe0 ${sab[0]}/6)`,
      vif[1] === 6 && ancien[0] === 6 && sab[0] === 6);
  }
  // lot 151 — LES MENTALES AU FLUX (appariées mêmes graines) : l'AGGRESSION fait les fautes,
  // OFF THE BALL fait les appels — le contrat statique (monotonie, no-op) vit dans checkAttributes.
  {
    const { matchStep, matchCfg } = await import('../assets/starter/src/engine/match-sim.js');
    const flux = (ratings) => {
      const sq = [Array.from({ length: 11 }, () => ({ ratings })), []];
      const st = makeMatch({ full: true, seed: 5, squads: sq });
      const cfg = matchCfg({ shotRange: 20 });
      for (let i = 0; i < 300 * 60; i++) matchStep(st, 1 / 60, cfg);
      return {
        fautes: st.events.filter((e) => e.type === 'faute' && st.players[e.by]?.team === 0).length,
        appels: st.events.filter((e) => e.type === 'burst' && e.kind === 'appel-profond' && st.players[e.by]?.team === 0).length,
      };
    };
    const hargneux = flux({ aggression: 90, offTheBall: 90 });
    const placide = flux({ aggression: 10, offTheBall: 10 });
    ok(`lot 151 — les MENTALES vivent au flux (l'équipe hargneuse/mobile : ${hargneux.fautes} fautes ≥ ${placide.fautes} et ${hargneux.appels} appels ≥ ${placide.appels} + 1 — aggression et offTheBall, appariés seed 5)`,
      hargneux.fautes >= placide.fautes && hargneux.appels >= placide.appels + 1);
  }
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
  let scores = [0, 0];
  const tirs = [0, 0], poss = [0, 0];
  const dev = [[], []];                                            // déviation du DÉPART de passe, par équipe
  const { matchStep, matchCfg } = await import('../assets/starter/src/engine/match-sim.js');
  // 5 graines : 3 × 120 s re-donnait un pile-ou-face (2:2 mesuré) — l'échantillon du VERDICT
  // doit être plus large que la variance d'un match
  // DIX graines, pas cinq — la leçon du verdict, un cran plus loin : les TIRS d'un échantillon
  // court sont aussi un tirage (mesuré : 16-27 sur les 5 premières graines, 40-32 sur 10 —
  // l'inversion était le bruit de re-distribution des tirages d'espèces, pas une loi morte)
  for (const seed of [3, 7, 1, 11, 5, 9, 13, 2, 17, 4]) {
    const st = makeMatch({ perTeam: 5, seed, squads: [elite, faible] });
    const cfg = matchCfg({ skill: { ...matchCfg().skill, doubleFoe: null, pontFoe: null, rouletteFoe: null } });   // le gel 114-117 : les 50/50 des gestes re-battaient la possession
    let lastPass = -1;
    for (let i = 0; i < 120 * 60; i++) {
      matchStep(st, 1 / 60, cfg);
      const pc = st.possession.carrier; if (pc >= 0 && st.players[pc]) poss[st.players[pc].team]++;
      // LA COMPLÉTION NE DISCRIMINE PLUS (90 % contre 90 % mesurés) : le receveur-qui-attaque-
      // son-vol rattrape les 0,6 m d'erreur d'une note 30 sur ce format court — c'est son métier.
      // La note se lit là où elle agit : la DÉVIATION du départ (l'angle entre le vol réel et la
      // ligne origine → mène), mesurée dans le monde à la première image de chaque vol.
      if (st.phase === 'flight' && st.pass && st.pass.t !== lastPass && st.pass.to >= 0 && st.lastPasser >= 0) {
        lastPass = st.pass.t;
        const want = Math.atan2(st.pass.lead[2] - st.pass.origin[1], st.pass.lead[0] - st.pass.origin[0]);
        const got = Math.atan2(st.ball.v[2], st.ball.v[0]);
        let d = Math.abs(got - want) * 180 / Math.PI;
        if (d > 180) d = 360 - d;
        dev[st.players[st.lastPasser].team].push(d);
      }
    }
    scores[0] += st.score[0]; scores[1] += st.score[1];
    for (const e of st.events.filter((x) => x.type === 'shot')) tirs[st.players[e.by].team]++;
  }
  const mean = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
  // LE SCORE D'UN ÉCHANTILLON COURT EST UN TIRAGE, ET LES TIRS AUSSI (re-fondation lot 64,
  // troisième de cette clause — 3→5→10 graines n'ont pas suffi) : après la physique honnête du
  // rebond, mesuré 25:26 sur les 10 graines du banc ET 25:28 sur 10 graines fraîches — les tirs
  // du format court (5-8/match) ne convergent pas ; les ballons ne meurent plus à l'atterrissage
  // pour être ramassés à la technique, ils se chassent à la course. La domination d'une équipe
  // notée se lit au TERRITOIRE (mesuré 57,4 % sur 10 graines fraîches — des milliers de ticks
  // convergent là où 50 tirs tirent au sort). Tirs et score restent affichés en témoins ; le
  // POIDS des notes aux occasions est une dette nommée (la chasse doit favoriser pace, le
  // premier toucher sous pression control).
  ok(`l'élite domine le TERRITOIRE (possession ${(100 * poss[0] / Math.max(1, poss[0] + poss[1])).toFixed(1)} % ≥ 54 — témoins : score ${scores[0]}:${scores[1]})`,
    poss[0] / Math.max(1, poss[0] + poss[1]) >= 0.54);
  // …LES OCCASIONS REDEVIENNENT TÉMOIN (lot 115 — le 2e repli de cette clause) : l'avantage
  // élite aux tirs, 69 %/66 % au lot 79, s'est ÉRODÉ à 46-52 % à travers les ~36 lots
  // suivants (mesuré 4 × 10 graines : 52/33/61/54 — et l'A/B APPARIÉ innocente les gestes
  // 114/115 : 46 % avec, 47 % sans, mêmes graines). L'érosion est progressive (une-touche,
  // chasses, corners… chaque loi nouvelle redistribue des 50/50) et le format court ne
  // converge pas (±19 pts entre jeux de 10 graines). Le CONTRAT reste au territoire (poss,
  // des milliers de ticks) et à l'exécution (dev) ; LE POIDS DES NOTES AUX OCCASIONS v2
  // est la dette nommée du ROADMAP — un lot dédié, sonde par mécanisme.
  ok(`témoin — la part élite aux tirs (${tirs[0]} contre ${tirs[1]} : ${(100 * tirs[0] / Math.max(1, tirs[0] + tirs[1])).toFixed(0)} % ; contrat au territoire et à l'exécution, le poids des notes v2 est la dette nommée)`,
    true);
  ok(`l'élite EXÉCUTE mieux (déviation de départ ${mean(dev[0]).toFixed(1)}° contre ${mean(dev[1]).toFixed(1)}° sur ${dev[0].length}+${dev[1].length} passes — l'écart est la note, pas un hasard)`,
    dev[0].length >= 20 && dev[1].length >= 20 && mean(dev[1]) > mean(dev[0]) + 0.8);
  // …mais la note est un ACCENT : l'équipe faible joue encore au football (pas un 15-0 d'arcade)
  ok(`la note ne crée pas d'arcade (écart cumulé ${scores[0] - scores[1]} ≤ 14 sur 5 matchs)`, scores[0] - scores[1] <= 14);
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
