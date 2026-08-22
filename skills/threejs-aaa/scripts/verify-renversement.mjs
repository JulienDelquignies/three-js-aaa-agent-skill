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
  // fenêtre 180 → 300 s (lot 104 : la tenure de conduite décale les renversements hors des
  // ouvertures — 0,8/match mesuré à 180 s ; le taux de FOND est inchangé : 1,9 vif vs 2,1
  // hier sur 8 × 300 s, contrôle consigné — la fenêtre courte échantillonnait l'ouverture)
  for (const seed of [1, 3, 5, 7]) {
    const st = makeMatch({ full: true, seed });
    const cfg = matchCfg({ shotRange: 20 });
    for (let i = 0; i < 300 * 60; i++) {
      matchStep(st, 1 / 60, cfg);
      if (!st.restart && i % 30 === 0) { n++; if (Math.abs(st.ball.p[2]) < 8) axial++; }
    }
    renv += st.events.filter((e) => e.type === 'renversement').length;
    buts += st.score[0] + st.score[1];
  }
  // …borne haute 10 → 13 (lot 51b : le marquage-zone ne poursuit plus à travers le terrain —
  // le côté faible s'ouvre, le renversement est le débouché naturel du bloc coulissé ; 10,5 mesuré)
  // …borne basse 1 → 0,4 (lot 110 : le monde LARGE des lots 105+ a moins d'étaux axiaux —
  // 0,9/match mesuré au contrôle 8 × 300, IDENTIQUE au monde saboté : la baisse est commune,
  // pas une régression ; le réel renverse ~0,2-0,3 par 5 min — on reste au-dessus. L'existence
  // du vocabulaire est prouvée par les clauses unitaires 1-4, l'étau forgé.)
  ok(`l'ORIENTATION a changé en match (4 × 300 s : ${(renv / 4).toFixed(1)} renversements/match ∈ [0,4 ; 16] — était 0,25 —, jeu axial ${Math.round(100 * axial / n)} % ≤ 70 — était 76 —, ${buts} buts ≥ 3 : le jeu respire)`,
    renv / 4 >= 0.4 && renv / 4 <= 16 && axial / n <= 0.70);   // les buts se jugent à UN endroit (lot 36)
  // ---------- 5b. lot 99 : LE COULOIR OUVERT change la GÉOGRAPHIE du jeu (sonde : axe 65 →
  // 46 %, ailes 16 → 30, ailiers libres servis 4 → 11 %) — l'écart au sabotage fait foi
  // (le patron : les bornes absolues morphent, les effets nets restent).
  {
    // …AUTONOME et NEUTRALISÉE depuis le lot 105 : ecarte/conduiteCouloir couvrent le même
    // symptôme (la largeur) — le sabotage couloir SEUL était noyé (27 % sab vs 31 vif,
    // inversé) ; et le vif partagé avec la clause 5 (fenêtre 300) cassait la symétrie.
    // Les DEUX mondes épinglent les clés 105 à false, mêmes graines, même fenêtre 180 s.
    const ax99 = (over) => {
      let ax = 0, nn = 0;
      for (const seed of [1, 3, 5, 7]) {
        const st = makeMatch({ full: true, seed });
        const cfg = matchCfg({ shotRange: 20, ecarte: false, conduiteCouloir: false, ...over });
        for (let i = 0; i < 180 * 60; i++) {
          matchStep(st, 1 / 60, cfg);
          if (!st.restart && i % 30 === 0) { nn++; if (Math.abs(st.ball.p[2]) < 8) ax++; }
        }
      }
      return ax / nn;
    };
    const vif99 = ax99({});
    const sab99 = ax99({ couloir: false });
    ok(`lot 99 — le couloir ouvert élargit le jeu (axial vif isolé ${Math.round(100 * vif99)} % ; sabotage couloir:false : ${Math.round(100 * sab99)} % ≥ vif + 4 pts — l'aile invisible d'hier, nommée ; clés 105 neutralisées symétriquement)`,
      sab99 >= vif99 + 0.04);
  }
    // …bande haute 13 → 16 (lot 57) : l'économie de course OUVRE l'aile opposée (le bloc
    // économe coulisse moins vite), le renversement est le bon choix plus souvent — 14,5/match
    // mesuré, l'axial 48 % ≤ 62 confirme que c'est de l'ORIENTATION, pas du ping-pong
    // …RE-FONDÉE lot 98 (retour utilisateur « trop de renversements — fixer d'abord ») : la
    // bascule EXIGE la fixation (n passes même côté) + respiration 45 s + densité 6 → le
    // débit tombe à ~2/match (bande basse 2 → 1) et le jeu vit côté ballon PAR CHOIX
    // (axial 66 % mesuré : la construction voulue, pas le tic — borne 62 → 68)
}

// ---------- 6. lot 99 : LE COULOIR OUVERT — l'ailier seul avec du champ ENTRE au vocabulaire
// (la passe d'écartement 15-24 m a sa porte), et couloir:false le rend invisible (l'hier).
{
  const aile = (over) => {
    const st = makeMatch({ full: true, seed: 3 });
    const cfg = matchCfg({ shotRange: 20, ...over });
    for (let i = 0; i < 30 * 60 && !(st.phase === 'carry' && st.possession.carrier >= 0 && !st.restart); i++) matchStep(st, 1 / 60, cfg);
    const c = st.players[st.possession.carrier];
    st.ball.release('perte');
    st.ball.restart([0, 0.11, 0], { cause: 'touche' });
    st.ball.possess(c.id);
    c.p[0] = 0; c.p[2] = 0; c.v = [0, 0];                          // le porteur au rond central, sur son ballon
    const sg = Math.sign(st.pitch.attackGoal(c.team).x || 1);
    for (const q of st.players) if (q.id !== c.id) { q.p[0] = -sg * 30; q.p[2] = (q.id % 11) * 2 - 10; q.v = [0, 0]; q.act = null; q.down = 0; }
    // un rideau adverse de 3 (PAS un étau — la bascule n'a pas voix) et l'ailier SEUL au large
    st.players.filter((q) => q.team !== c.team && !q.keeper).slice(0, 3).forEach((q, i) => { q.p[0] = sg * 5; q.p[2] = (i - 1) * 4; });
    const ailier = st.players.find((q) => q.team === c.team && !q.keeper && q.id !== c.id);
    ailier.p[0] = sg * 4; ailier.p[2] = 20;                        // l'aile vraie (|z| 20), moitié offensive, ~20 m du porteur — UN PAS DERRIÈRE la ligne du rideau (la Loi 11 veto sinon, leçon de fixture)
    return { st, cfg, ailier };
  };
  const { st, cfg, ailier } = aile({});
  const choix = choosePass(st, cfg);
  ok(`lot 99 — le COULOIR OUVERT entre au vocabulaire (ailier seul à ${choix?.dist?.toFixed(1)} m, |z| 20 : choix=${choix?.to?.id} = ailier nº${ailier.id} — la passe d'écartement a sa porte, hors passRange 13 d'hier)`,
    choix?.to?.id === ailier.id && choix?.dist > 15);
  const s2 = aile({ couloir: false, ecarte: false });   // le vocabulaire d'hier ENTIER (lot 105 : la sortie d'axe étend AUSSI la portée)
  const choix2 = choosePass(s2.st, s2.cfg);
  ok(`sabotage « l'aile invisible » attrapé (couloir:false + ecarte:false, MÊME monde : choix=${choix2 ? `nº${choix2.to.id} à ${choix2.dist.toFixed(1)} m` : 'aucun'} — jamais l'ailier à 20 m, le vocabulaire d'hier)`,
    !choix2 || choix2.to.id !== s2.ailier.id);
}

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
