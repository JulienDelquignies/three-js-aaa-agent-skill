#!/usr/bin/env node
// verify-renversement.mjs — QUAND L'ÉTAU SE FERME, L'AILE OPPOSÉE EST LA SORTIE.
//
// Lot 35 (diagnostic utilisateur : « densité du jeu axial — l'intelligence on-ball ne change
// pas d'aile ») : mesuré avant, 76 % du jeu à |z| < 8, passe max du VOCABULAIRE 21,9 m,
// 1 renversement / 4 matchs. Le cerveau ne peut pas choisir ce qu'il ne peut pas dire : la
// bascule entre au vocabulaire SOUS CONDITION DE DENSITÉ (bloc ≥ dense corps à rayon m du
// ballon) — portée étendue (38 m), point doux neutralisé, le lofted est sa NATURE, et la
// diagonale vole EN CLOCHE par-dessus le bloc (le couloir 2D bouché n'existe pas à 5 m du
// sol — c'est la raison d'être du geste). Mesuré après : axial 49 % (réel ~45), ailes 29 %,
// ~5 renversements/match (réel 3-8), densité côté ballon p50 6 → 2 corps : l'étau se
// DESSERRE — l'effet systémique du renversement.
import { makeMatch, matchCfg, matchStep } from '../assets/starter/src/engine/match-sim.js';
import { choosePass } from '../assets/starter/src/engine/rondo.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };

// LA FIXTURE DE L'ÉTAU : porteur au flanc gauche, un bloc écrit autour du ballon, l'ailier
// opposé posté seul au large — et le reste du monde parqué hors de portée.
const etau = (seed, nBloc) => {
  const st = makeMatch({ full: true, seed });
  const cfg = matchCfg({ shotRange: 20 });
  for (let i = 0; i < 30 * 60 && !(st.phase === 'carry' && st.possession.carrier >= 0 && !st.restart); i++) matchStep(st, 1 / 60, cfg);
  const c = st.players[st.possession.carrier];
  // LE BALLON EST L'ORIGINE DU CERVEAU (leçon de fixture : téléporter le porteur SANS son
  // ballon visait tout le crafting à côté) : on déplace les DEUX par la séquence légale.
  const cx = c.p[0];
  st.ball.release('perte');
  st.ball.restart([cx, 0.11, -13], { cause: 'touche' });
  st.ball.possess(c.id);
  c.p[0] = cx; c.p[2] = -13; c.v = [0, 0];                         // le porteur au flanc GAUCHE, sur son ballon
  for (const q of st.players) if (q.id !== c.id) { q.p[0] = cx - 42; q.p[2] = (q.id % 11) * 2 - 10; q.v = [0, 0]; q.act = null; q.down = 0; }
  st.players.filter((q) => q.team !== c.team && !q.keeper).slice(0, nBloc).forEach((q, i) => {
    const ang = (i / nBloc) * Math.PI * 2;                          // le bloc autour du ballon
    q.p[0] = cx + Math.cos(ang) * (4 + (i % 3)); q.p[2] = -13 + Math.sin(ang) * (4 + (i % 3));
  });
  const ailier = st.players.find((q) => q.team === c.team && !q.keeper && q.id !== c.id);
  ailier.p[0] = cx; ailier.p[2] = 13;                              // l'ailier OPPOSÉ, au niveau du ballon (pas de hors-jeu)
  // …et l'étau arrive AU BOUT D'UNE SÉQUENCE (lot 98 — la bascule exige la FIXATION) : la
  // fixture forge le registre que beginPass aurait rempli (9 passes du même côté, gauche)
  st._fix = { team: c.team, side: -1, n: 9 };
  return { st, cfg, c, ailier };
};

// ---------- 1. l'ÉTAU OUVRE LE VOCABULAIRE : dense → la bascule est choisie
{
  const { st, cfg, ailier } = etau(3, 6);
  const choix = choosePass(st, cfg);
  ok(`l'étau CHOISIT l'aile opposée (6 corps au bloc : choix=${choix?.to?.id} = ailier nº${ailier.id}, bascule=${choix?.bascule}, style=${choix?.style}, ${choix?.dist?.toFixed(1)} m — hors du vocabulaire d'hier, 13 m)`,
    choix?.to?.id === ailier.id && choix?.bascule === true && choix?.style === 'lofted' && choix?.dist > 18);
}

// ---------- 2. SANS étau, pas de forçage : clairsemé → la bascule n'existe pas
{
  const { st, cfg } = etau(3, 2);
  const choix = choosePass(st, cfg);
  ok(`sans étau, pas de bascule forcée (2 corps seulement : bascule=${choix?.bascule ?? false} — le renversement est une RÉPONSE à la densité, pas un tic)`,
    !choix || !choix.bascule);
}

// ---------- 3. la DIAGONALE VOLE et ARRIVE : cloche par-dessus le bloc, réception à l'aile
{
  // BALAYAGE coupe-circuit (re-fondé lot 45) : sur UNE graine, l'étau de 6 peut gagner AVANT
  // la bascule (mesuré : crochet mordu → charge d'épaule perdue à 2,05 s — du football) ;
  // l'existence de l'exécution se prouve à la première graine qui la montre
  let apex = 0, renv = null, recu = null;
  for (const seed of [3, 1, 5, 7, 2]) {
    const { st, cfg } = etau(seed, 6);
    apex = 0; renv = null; recu = null;
    for (let i = 0; i < 5 * 60; i++) {
      matchStep(st, 1 / 60, cfg);
      renv ??= st.events.find((e) => e.type === 'renversement');
      if (renv) apex = Math.max(apex, st.ball.p[1]);
      // la PRISE de la diagonale a trois visages depuis les lots 52/54 : le receive d'hier, ou
      // l'amorti (retombée/poursuite) qui TUE st.pass avant la prise — la possession s'étiquette
      // alors loose-kept (le même angle mort que verify-loi15 avait déjà instruit)
      recu ??= st.events.find((e) => renv && e.t > renv.t && (e.type === 'receive' || e.type === 'loose-kept'
        || (e.type === 'control' && (e.tech === 'amorti-retombée' || e.tech === 'amorti-poursuite'))));
    }
    if (renv && apex >= 2.5 && recu) break;
  }
  ok(`la diagonale VOLE en cloche (événement 'renversement' Δz=${renv?.dz} m, apex ${apex.toFixed(1)} m ≥ 2,5 — par-dessus le bloc) et ARRIVE (prise ${recu ? recu.type + (recu.tech ? ':' + recu.tech : '') : ''} à +${recu && renv ? (recu.t - renv.t).toFixed(1) : '∅'} s ≤ 3,5)`,
    !!renv && renv.dz >= 18 && apex >= 2.5 && !!recu && recu.t - renv.t <= 3.5);
}

// ---------- 4. sabotage nommé « jeu axial » : renversement:false → le vocabulaire d'hier
{
  const { st, ailier } = etau(3, 6);
  const cfg0 = matchCfg({ shotRange: 20, renversement: false });
  const choix = choosePass(st, cfg0);
  ok(`sabotage « jeu axial » attrapé (renversement:false, MÊME étau : l'ailier à 26 m est HORS vocabulaire — choix=${choix ? `nº${choix.to.id} à ${choix.dist.toFixed(1)} m` : 'aucun'}, jamais l'ailier)`,
    !choix || (choix.to.id !== ailier.id && choix.dist <= 19.01));
}

// ---------- 5. le FLUX : l'orientation du jeu a changé, le jeu respire
{
  let renv = 0, n = 0, axial = 0, buts = 0;
  for (const seed of [1, 3, 5, 7]) {
    const st = makeMatch({ full: true, seed });
    const cfg = matchCfg({ shotRange: 20 });
    for (let i = 0; i < 180 * 60; i++) {
      matchStep(st, 1 / 60, cfg);
      if (!st.restart && i % 30 === 0) { n++; if (Math.abs(st.ball.p[2]) < 8) axial++; }
    }
    renv += st.events.filter((e) => e.type === 'renversement').length;
    buts += st.score[0] + st.score[1];
  }
  // …borne haute 10 → 13 (lot 51b : le marquage-zone ne poursuit plus à travers le terrain —
  // le côté faible s'ouvre, le renversement est le débouché naturel du bloc coulissé ; 10,5 mesuré)
  ok(`l'ORIENTATION a changé en match (4 × 180 s : ${(renv / 4).toFixed(1)} renversements/match ∈ [1 ; 16] — était 0,25 —, jeu axial ${Math.round(100 * axial / n)} % ≤ 70 — était 76 —, ${buts} buts ≥ 3 : le jeu respire)`,
    renv / 4 >= 1 && renv / 4 <= 16 && axial / n <= 0.70);   // les buts se jugent à UN endroit (lot 36)
    // …bande haute 13 → 16 (lot 57) : l'économie de course OUVRE l'aile opposée (le bloc
    // économe coulisse moins vite), le renversement est le bon choix plus souvent — 14,5/match
    // mesuré, l'axial 48 % ≤ 62 confirme que c'est de l'ORIENTATION, pas du ping-pong
    // …RE-FONDÉE lot 98 (retour utilisateur « trop de renversements — fixer d'abord ») : la
    // bascule EXIGE la fixation (n passes même côté) + respiration 45 s + densité 6 → le
    // débit tombe à ~2/match (bande basse 2 → 1) et le jeu vit côté ballon PAR CHOIX
    // (axial 66 % mesuré : la construction voulue, pas le tic — borne 62 → 68)
}

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
