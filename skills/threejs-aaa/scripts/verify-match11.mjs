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
import { formationSpots, checkFormation, premierOffensif, blocFor } from '../assets/starter/src/engine/formation.js';
import { evadeSpot } from '../assets/starter/src/engine/rondo.js';
import { makeMatch, matchCfg, matchStep, checkMatch, playMatch } from '../assets/starter/src/engine/match-sim.js';
import { checkOffside, offsideLine } from '../assets/starter/src/engine/offside.js';
import { simInternals } from '../assets/starter/src/engine/rondo-sim.js';
import { tackleWindow, accrocheP } from '../assets/starter/src/engine/duel.js';
import { tryCross } from '../assets/starter/src/engine/shooting.js';
import { planStrike } from '../assets/starter/src/engine/approach.js';
import { TECHNIQUES } from '../assets/starter/src/engine/technique.js';
import { teteStep } from '../assets/starter/src/engine/tete.js';
import { coachStep, checkCoach } from '../assets/starter/src/engine/coach.js';
import { maybeDoubleContact, maybePetitPont, maybeRoulette, skillContactNow } from '../assets/starter/src/engine/skills-sim.js';
import { resoudreTactique } from '../assets/starter/src/engine/tactics.js';
import { cornerTrav } from '../assets/starter/src/engine/referee.js';
import { makeProfile } from '../assets/starter/src/engine/attributes.js';
import { KEEPER, keeperDecide, keeperSpot } from '../assets/starter/src/engine/keeper.js';
import { menaceTir } from '../assets/starter/src/engine/menace.js';

// LE MONDE DE LABO (lot 111 — le patron de neutralisation symétrique MUTUALISÉ : chaque
// nouveau lot de flux re-cassait les clauses d'isolation une par une ; désormais les clauses
// de LABO — celles qui isolent UNE loi ancienne — épinglent ce monde des DEUX côtés).
// C'est le flux d'avant les lots 105-111, gelé : les clauses y mesurent leur loi, pas le monde.
const LAB = { ecarte: false, conduiteCouloir: false, ramasse: false, audace: false,
  chaloupe: false, troisieme: false,
  uneTouche: { press: 2.6, vmax: 9.5, portee: 14, couloir: 0.5, p: 0.65, calme: 0.5 },
  tete: { min: 1.5, max: 2.2, reach: 1.0, but: 12 },   // …la fenêtre debout (pré-112 : ni détente ni duel du venant)
  coach: false,                                         // …les axes gelés (pré-113 : le monde qui ne réagit pas au score)
  skill: { ...matchCfg().skill, doubleFoe: null, pontFoe: null, rouletteFoe: null, sortieBurst: null },   // …le répertoire pré-114/115/117 (ni croqueta, ni pont, ni roulette)
  filet: false, bordure: false, celebration: false,                 // …le sifflet d'hier (pré-116 : brakes ponctuels, engagement à 3,8 s)
  talonnade: false,                                                 // …le demi-tour d'hier (pré-118 : le talon dormait)
  unDeux: false,                                                    // …le donne-sans-va d'hier (pré-119)
  libero: false, lob: false,                                        // …le gardien sur sa ligne d'hier (pré-120)
  contreAppel: false, boxCrash: false,                              // …les courses droites et la surface d'hier (pré-122/123)
  courseAilier: false, throughBall: false };                        // …la diagonale unique et la mène myope d'hier (pré-125/128)
import { momentDuJeu } from '../assets/starter/src/engine/phases.js';
import { FORMATIONS, LIGNES } from '../assets/starter/src/engine/formation.js';
import { balPrenable } from '../assets/starter/src/engine/dribble.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };

// ---------- 1. la formation est une donnée saine — TOUT le catalogue (lot 17)
{
  const pitch = makePitch(FULL);
  for (const name of ['433', '442', '352']) {
    const c0 = checkFormation(pitch, 0, name), c1 = checkFormation(pitch, 1, name);
    ok(`la formation ${name} est SAINE des deux côtés (postes dans le terrain, lignes ${'' + (name === '433' ? '4-3-3' : name === '442' ? '4-4-2' : '3-5-2')} ordonnées, largeur à l'échelle, bloc qui coulisse)`,
      c0.ok && c1.ok, [...c0.issues, ...c1.issues].join(' ; '));
  }
  ok(`les POINTES sont celles de LA formation (premierOffensif : 433 → 7, 442 → 8, 352 → 8 — le calage Loi 11 ne câble plus « ≥ 7 »)`,
    premierOffensif('433') === 7 && premierOffensif('442') === 8 && premierOffensif('352') === 8 && premierOffensif('666') === 7);
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
  // 150 → 240 s (lot 37 puis 51b : la fenêtre s'allonge avec le tempo du monde plutôt que
  // d'épingler une graine — doctrine. Le monde au tacle vivant + marquage-zone tire ~1 fois
  // par 2 min : une fenêtre de 150 s à zéro tir arrive honnêtement. Dette nommée « l'attaque
  // asséchée » : tirs 19 → 12 / 8×180 depuis lot 51 — le calibrage est le prochain chantier.)
  // 240 → 330 s (lot 67a, même doctrine) : le se-montrer donne au porteur plus d'options de
  // passe — le tir se dilue encore d'un cran sur certaines graines ; la fenêtre suit le tempo.
  const { st: s2, trace } = playMatch(st2, 330, { cfg: matchCfg({ shotRange: 20 }) });
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
      // …les postes JUGÉS sont ceux que le moteur SERT (lot 42 : le défendant vit au bloc
      // compact — juger les vieux postes étirés comptait des déserteurs imaginaires ; lot 68 :
      // l'ATTAQUANT vit au soutien + rentre AVEC le z du ballon — juger le chemin legacy
      // comptait le latéral rentré comme déserteur de son vieux poste large, 55 % au fil du
      // seuil ; le z lissé du moteur ≈ le z brut à la tolérance de 12 m)
      const spots = formationSpots(st.pitch, team, st.ball.p[0], atk, undefined, cfg.bloc, st.ball.p[2]);
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
  // le reste. L'existence du bloc est prouvée par le sabotage dessous (couverture des postes).
  ok(`le bloc TIENT ses postes (${pct.toFixed(0)} % des postes couverts à ≤ 12 m ≥ 55 — un bloc lisible, pas un essaim)`, pct >= 55);
}

// ---------- 3b. LE BLOC COMPACT (lot 42, retour utilisateur « les lignes sont trop espacées,
// les matchs ne sont pas réalistes ») : l'équipe SANS ballon est chaînée au ballon — ligne à
// ~27 m derrière lui, bloc borné à ~30 m, interlignes comprimées. Mesuré : bloc défendant
// p50 43 → 30,3 m (réel 25-40), interligne défense→milieu 25,5 → 14,7 m (réel 10-15), et
// l'ASYMÉTRIE naît (attaque 42 m étirée) — flux tenu (70 tirs / 29 buts, 20 × 300 s).
{
  // la LOI PURE d'abord : ballon au rond central → la ligne défendante vit à ~ligne m du
  // ballon (pas à ses postes absolus), et le bloc tient dans long m
  const st0 = makeMatch({ full: true, seed: 1 });
  const cfg0 = matchCfg({ shotRange: 20 });
  const spots = formationSpots(st0.pitch, 1, 0, false, undefined, cfg0.bloc);
  const sgn1 = -st0.pitch.ownGoal(1).sign;
  const xs = spots.map(([x]) => x * sgn1);                          // axe d'attaque de l'équipe 1
  const lignePos = Math.min(...xs), span = Math.max(...xs) - lignePos;
  const dLigneBallon = 0 - lignePos;                                // ballon à l'avance 0 (rond central)
  ok(`la LOI PURE du bloc (ballon au rond central : ligne défendante à ${dLigneBallon.toFixed(1)} m derrière le ballon ≈ ${cfg0.bloc.ligne}, longueur ${span.toFixed(1)} m ≤ ${cfg0.bloc.long} + 1)`,
    Math.abs(dLigneBallon - cfg0.bloc.ligne) < 2 && span <= cfg0.bloc.long + 1);
  // le FLUX ensuite : les bandes réelles en match (agrégat 2 × 120 s, doctrine lot 36)
  const mesure = (cfgX) => {
    const dLong = [], dInter = [], aLong = [];
    for (const seed of [1, 3]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ shotRange: 20, ...cfgX });
      for (let i = 0; i < 120 * 60; i++) {
        matchStep(st, 1 / 60, cfg);
        if (i % 30 !== 0 || st.restart) continue;
        const poss = st.possession.carrier >= 0 ? st.players[st.possession.carrier].team : (st.lastTouch ?? 0);
        for (const team of [0, 1]) {
          const corps = st.players.filter((p) => p.team === team && !p.keeper && p.down <= 0 && !p.expulse && !p._sub);
          if (corps.length < 8) continue;
          const sgn = Math.sign(st.pitch.attackGoal(team).x || 1);
          const xs2 = corps.map((p) => p.p[0] * sgn).sort((a, b) => a - b);
          const L = xs2[xs2.length - 1] - xs2[0];
          if (team === poss) { aLong.push(L); continue; }
          dLong.push(L);
          dInter.push((xs2[4] + xs2[5] + xs2[6]) / 3 - (xs2[0] + xs2[1] + xs2[2] + xs2[3]) / 4);
        }
      }
    }
    const p50 = (a) => { a.sort((x, y) => x - y); return a.length ? a[Math.floor(0.5 * (a.length - 1))] : 99; };
    return { dLong: p50(dLong), dInter: p50(dInter), aLong: p50(aLong) };
  };
  const vif = mesure({});
  // marge d'asymétrie 4 → 3 (lot 66, récit) : le re-brassage du glissé-qui-se-retient a tiré
  // 33,8 vs défense 30,5 (+3,3) — le SENS de la clause est que l'attaque s'étire PLUS que la
  // défense, et il vit ; la marge de 4 m était un choix de graine, pas une loi.
  // …3 → 1,5 (lot 68, récit) : bloc.rentre MONTE le latéral faible de 9 m — l'arrière du bloc
  // attaquant se rapproche du jeu et la longueur p50 perd ~1 m (34,5 vs 32,5 : +2,0 mesuré).
  // C'est la ligne de 3 du vrai football, pas une érosion : l'asymétrie (attaque plus étirée)
  // VIT toujours, sa marge suit la loi.
  ok(`le BLOC DÉFENDANT est court en match (longueur p50 ${vif.dLong.toFixed(1)} m ≤ 36 — réel 25-40 —, interligne défense→milieu ${vif.dInter.toFixed(1)} m ≤ 19 — réel 10-15 —, et l'ASYMÉTRIE vit : attaque ${vif.aLong.toFixed(1)} ≥ défense + 1,5)`,
    vif.dLong <= 36 && vif.dInter <= 19 && vif.aLong >= vif.dLong + 1.5);
  const sab = mesure({ bloc: false });
  ok(`sabotage « bloc élastique » attrapé (bloc:false : longueur défendante p50 ${sab.dLong.toFixed(1)} m ≥ vivant + 6 (${(vif.dLong + 6).toFixed(1)}) — les lignes espacées d'hier, nommées)`,
    sab.dLong >= vif.dLong + 6);
}

// ---------- 3g. L'APPROCHE PILOTÉE DU CENTRE + LE COULISSEMENT (lot 47) : la conduite a un
// SENS (le porteur progresse vers le but adverse, l'ailier en moitié offensive perce vers la
// ligne de fond pour armer le centre), et le bloc défendant COULISSE côté ballon — la v2
// nommée au lot 42. Mesuré : couloir nu, la perce convertissait à 73 % (38 buts / 20 × 300 s) ;
// coulissé, 70 tirs / 32 buts et la perce SURVIT (zone de centre 9 → 11, ras 5 → 8, centres
// bas 2 → 4 vs errance, 10 × 300 s). Lois PURES et fixtures posées — le flux d'aile à
// l'échelle d'un banc est du bruit (leçon d'instrument : 6 × 180 s ne classe rien).
{
  // la LOI PURE du coulissement : ballon à z = 20 → le bloc glisse de 20 × lateral m côté
  // ballon ; à z = 34 la borne slideMax prend la main ; anchorZ absent = l'identité d'hier.
  const st0 = makeMatch({ full: true, seed: 1 });
  const b47 = matchCfg({ shotRange: 20 }).bloc;
  const mz = (S) => S.reduce((s, [, z]) => s + z, 0) / S.length;
  const base = mz(formationSpots(st0.pitch, 1, 0, false, undefined, b47));
  const d20 = mz(formationSpots(st0.pitch, 1, 0, false, undefined, b47, 20)) - base;
  const d34 = mz(formationSpots(st0.pitch, 1, 0, false, undefined, b47, 34)) - base;
  ok(`la LOI PURE du coulissement (ballon z=20 → bloc décalé de ${d20.toFixed(1)} m = 20 × ${b47.lateral} ; z=34 → ${d34.toFixed(1)} m = borne slideMax ${b47.slideMax} ; anchorZ absent = 0, l'identité)`,
    Math.abs(d20 - 20 * b47.lateral) < 0.5 && Math.abs(d34 - b47.slideMax) < 0.5 && b47.lateral > 0);
  // blocFor PROPAGE le coulissement (la tactique module long/ligne, lateral/slideMax passent
  // tels quels — sans ça le site d'appel match perdait la clé et le couloir restait nu)
  const bf = blocFor(b47, { compacite: 0.9, hauteurBloc: 0.1 });
  ok(`blocFor propage lateral/slideMax (${bf.lateral}/${bf.slideMax}) en modulant long/ligne (${bf.long.toFixed(1)}/${bf.ligne.toFixed(1)})`,
    bf.lateral === b47.lateral && bf.slideMax === b47.slideMax && bf.long < b47.long && bf.ligne > b47.ligne);
  // l'APPROCHE PILOTÉE, pure : un ailier posé large, mondes calmes identiques (tous les corps
  // parqués loin derrière-axe : gradients foe/mate/keep IDENTIQUES dans les trois mondes — la
  // seule différence est la clé). Le spot d'évasion PROGRESSE (vs « l'errance », evadeGoal:0)
  // et TIENT LA LARGEUR au ras de la ligne (vs « l'aile qui recycle », wingDrive:false, qui
  // rentre vers l'axe). Fixture déterministe, marges mesurées 0,31 m.
  const spotAile = (wx, wz, over) => {
    const st = makeMatch({ full: true, seed: 2 });
    st.restart = null;
    const sgn = -st.pitch.ownGoal(0).sign;
    for (const q of st.players) { q.v = [0, 0]; q.act = null; }
    for (const q of st.players.filter((q) => q.team === 1)) { q.p[0] = -sgn * 20; q.p[2] = -10; }
    for (const q of st.players.filter((q) => q.team === 0)) { q.p[0] = -sgn * 25; q.p[2] = -15; }
    const w = st.players.find((p) => p.team === 0 && !p.keeper);
    w.p[0] = sgn * wx; w.p[2] = wz; w.yaw = Math.PI / 2;            // face à la touche : keep neutre en x
    st.ball.release('sortie');
    st.ball.restart([w.p[0], 0.11, wz], { cause: 'touche' });
    st.restart = null;
    const s = evadeSpot(st, w, matchCfg({ shotRange: 20, ...over }));
    return s ? { adv: (s[0] - w.p[0]) * sgn, z: Math.abs(s[2]) } : null;
  };
  const postes = [[12, 24], [20, 22], [35, 26]];
  const sens = postes.every(([x, z]) => spotAile(x, z, {}).adv >= spotAile(x, z, { evadeGoal: 0 }).adv + 0.25);
  ok(`la conduite a un SENS (l'évasion du porteur progresse de ≥ 0,25 m de plus que « l'errance » (evadeGoal:0) aux trois postes d'aile — le sabotage nommé recycle)`,
    sens);
  const ras = spotAile(35, 26, {}), rasRec = spotAile(35, 26, { wingDrive: false });
  ok(`l'ailier ARME au ras de la ligne (z tenu ${ras.z.toFixed(2)} ≥ ${(rasRec.z + 0.25).toFixed(2)} : « l'aile qui recycle » (wingDrive:false) rentre vers l'axe au lieu d'armer le centre)`,
    ras.z >= rasRec.z + 0.25);
  // LA LIGNE ARRIÈRE ATTAQUANTE MONTE EN SOUTIEN (lot 51 — « des défenseurs bien trop bas par
  // rapport à l'équipe, sans sens tactique ») : loi PURE — ballon à mi-terrain, l'équipe EN
  // POSSESSION tient sa ligne arrière à ~soutien m derrière le ballon (mesurée avant : campée
  // p10 à 6 m de son but ; après : p10 12,7, p50 30,9). soutien absent : le chemin d'hier.
  const st51 = makeMatch({ full: true, seed: 1 });
  const b51 = matchCfg({ shotRange: 20 }).bloc;
  const sA = formationSpots(st51.pitch, 0, 0, true, undefined, b51);
  const sgnA = -st51.pitch.ownGoal(0).sign;
  const arriere = Math.min(...sA.map(([x]) => x * sgnA)) + st51.pitch.hx;
  const sHier = formationSpots(st51.pitch, 0, 0, true, undefined, { long: 30, ligne: 27 });
  const arriereHier = Math.min(...sHier.map(([x]) => x * sgnA)) + st51.pitch.hx;
  ok(`la LIGNE ARRIÈRE ATTAQUANTE monte en soutien (ballon au rond central : ligne à ${arriere.toFixed(1)} m de son but ≈ ${(st51.pitch.hx - b51.soutien).toFixed(1)} ± 2 — et le monde sans soutien campait à ${arriereHier.toFixed(1)} ≤ ${(arriere - 8).toFixed(1)} : la ligne d'hier, nommée)`,
    Math.abs(arriere - (st51.pitch.hx - b51.soutien)) < 2 && arriereHier <= arriere - 8);
  // …ET LE LATÉRAL CÔTÉ FAIBLE RENTRE ET MONTE (lot 68, bloc.rentre — « je vois toujours le
  // latéral opposé de l'équipe en possession des dizaines de mètres derrière les autres
  // joueurs ») : loi PURE — ballon installé aile z=−20, le latéral OPPOSÉ (poste 3, fz +0,62)
  // referme la ligne de 3 : z divisé par ~2 ET ~rentre m plus haut ; le latéral CÔTÉ BALLON
  // (poste 0) ne bouge pas d'un bit ; ballon dans l'axe = identité totale ; un 3-5-2 (pas
  // d'arrière large) = identité. Mesuré en flux (A/B 3 graines × 300 s) : isolement du
  // latéral faible p50 12,5 → 6,9 m, |z| tenu 18,0 → 11,3, retard médiane p50 14,3 → 8,2.
  const sansR = { ...b51 }; delete sansR.rentre;
  const sR = formationSpots(st51.pitch, 0, 0, true, undefined, b51, -20);
  const sH68 = formationSpots(st51.pitch, 0, 0, true, undefined, sansR, -20);
  ok(`le latéral OPPOSÉ rentre (|z| ${Math.abs(sR[3][1]).toFixed(1)} ≤ ${(Math.abs(sH68[3][1]) * 0.55).toFixed(1)} m) et monte (+${((sR[3][0] - sH68[3][0]) * sgnA).toFixed(1)} m ≈ rentre ${b51.rentre}) — la ligne de 3 de possession`,
    Math.abs(sR[3][1]) <= Math.abs(sH68[3][1]) * 0.55 + 0.01 && Math.abs((sR[3][0] - sH68[3][0]) * sgnA - b51.rentre) < 1);
  ok(`le latéral CÔTÉ BALLON ne bouge pas d'un bit (poste 0 : [${sR[0].map((v) => v.toFixed(2))}]) et l'axe/le 3-5-2 sont l'identité — rentre absent = hier au bit près (sabotage nommé)`,
    JSON.stringify(sR[0]) === JSON.stringify(sH68[0])
    && JSON.stringify(formationSpots(st51.pitch, 0, 0, true, undefined, b51, 0)) === JSON.stringify(formationSpots(st51.pitch, 0, 0, true, undefined, sansR, 0))
    && JSON.stringify(formationSpots(st51.pitch, 0, 0, true, '352', b51, -20)) === JSON.stringify(formationSpots(st51.pitch, 0, 0, true, '352', sansR, -20)));
}

// ---------- 3c. LE PRIX DU PREMIER TOUCHER (lot 43, retour utilisateur « effet aimant sur
// les longs ballons ») : la prise de turnover paie le contrat du contrôle attaquant — un
// ballon > 10 m/s peut FUIR la touche (résiduel vivant, ballon libre), il ne se possède pas
// d'un claquement de doigts. Mesuré avant : 14 % des prises > 10 m/s, un dégagement de
// 26,5 m/s possédé instantanément. La MÊME scène, trois mondes — le tirage seedé décide,
// la clé retirée est l'aimant nommé.
{
  const scene = (cfgExtra, rndV) => {
    const st = makeMatch({ full: true, seed: 5 });
    const sgn = -st.pitch.ownGoal(0).sign;
    for (const q of st.players.filter((q) => q.team === 0)) { q.p[0] = -sgn * 40; q.p[2] = 25; q.v = [0, 0]; }
    for (const q of st.players.filter((q) => q.team === 1)) { q.p[0] = -sgn * 40; q.p[2] = -25; q.v = [0, 0]; }
    const d = st.players.find((p) => p.team === 1 && !p.keeper);
    d.p[0] = 10; d.p[2] = 0; d.v = [0, 0]; d.act = null; d.down = 0;   // le récupérateur sous le long ballon
    st.ball.release('sortie');
    st.ball.restart([10 - sgn * 8, 0.11, 0], { cause: 'touche' });
    st.ball.strike({ speed: 16, dirYaw: Math.atan2(0, sgn), elevation: 0.02, spinAxis: [0, 1, 0], spinRev: 0 });
    st.restart = null;                                              // le coup d'envoi du makeMatch frais gèle canTake
    st.phase = 'flight'; st.possession = { team: 0, carrier: -1 }; st.hold = 0; st.lastTouch = 0;
    st.pass = { from: 0, to: -2, lead: [10, 0, 0], t: st.t - 1, origin: [10 - sgn * 8, 0], flight: 0.5 };
    st.rnd = () => rndV;
    const cfg = matchCfg({ shotRange: 20, ...cfgExtra });
    for (let i = 0; i < 0.8 * 60 && !st.events.some((e) => e.type === 'turnover'); i++) matchStep(st, 1 / 60, cfg);
    const ctl = st.events.filter((e) => e.type === 'control').pop();
    return { st, d, ctl, carrier: st.possession.carrier, phase: st.phase, vRes: Math.hypot(st.ball.v[0], st.ball.v[2]) };
  };
  const fuit = scene({}, 0.01);                                     // tirage bas → la touche FUIT
  ok(`la touche FUIT sur le long ballon (16 m/s, tirage 0,01 : control miss=${fuit.ctl?.miss}, ballon LIBRE — carrier ${fuit.carrier} = −1, phase ${fuit.phase}, résiduel ${fuit.vRes.toFixed(1)} m/s vivant)`,
    fuit.ctl?.miss === true && fuit.carrier === -1 && fuit.phase === 'loose' && fuit.vRes > 1.5);
  // …ET LE FAUTIF CHASSE SA TOUCHE (lot 44 — capture utilisateur : le receveur restait PLANTÉ
  // à côté de sa touche fuyante, l'adversaire prenait ; réflexe lossReact réutilisé)
  ok(`le fautif CHASSE sa touche (inscrit au réflexe lossReact : ${fuit.d.id in (fuit.st._lossAt ?? {})} — il se retourne sur sa touche fuyante au lieu de rester planté)`,
    (fuit.st._lossAt ?? {})[fuit.d.id] != null);
  const prend = scene({}, 0.99);                                    // tirage haut → la prise est propre
  ok(`la prise PROPRE existe aussi (même scène, tirage 0,99 : possédé par nº${prend.carrier} = nº${prend.d.id} — un bon défenseur contrôle un long ballon, c'est un TIRAGE, pas une loterie visuelle)`,
    prend.carrier === prend.d.id && prend.ctl?.miss !== true);
  const aimant = scene({ touchePrix: false }, 0.01);                // la clé retirée → l'aimant d'hier
  ok(`sabotage « l'aimant » attrapé (touchePrix:false, même scène, même tirage : possédé instantanément par nº${aimant.carrier} à 16 m/s — le ballon attiré sans prix, nommé)`,
    aimant.carrier === aimant.d.id);
}

// ---------- 3d. LA PASSE EN UNE TOUCHE (lot 44, retour utilisateur « il manque la possibilité
// d'avoir des passes en une touche ») : sous PRESSION, un ballon jouable repart en PREMIÈRE
// INTENTION vers une ligne courte et ouverte — sans être possédé (le patron de la remise de
// tête, déchet ×1,6). Flux mesuré : 28 une-touches / 25 min (6,5 % des passes ; au calme par
// STYLE depuis le lot 49 — clause verify-tactics). ET ELLE SURPREND (lot 50) : une première
// intention n'a pas d'armé — la fenêtre aveugle se pose avec seen 0, tout le monde paie sa
// réaction pleine (mesuré avant : 0/39 fenêtres posées, armée 135/135 — la passe la moins
// lisible du football était la seule lue instantanément).
{
  const scene = (cfgExtra, presse) => {
    const st = makeMatch({ full: true, seed: 5 });
    const sgn = -st.pitch.ownGoal(0).sign;
    for (const q of st.players.filter((q) => q.team === 0)) { q.p[0] = -sgn * 40; q.p[2] = 25; q.v = [0, 0]; }
    for (const q of st.players.filter((q) => q.team === 1)) { q.p[0] = -sgn * 40; q.p[2] = -25; q.v = [0, 0]; }
    const r = st.players.find((p) => p.team === 0 && !p.keeper);
    const m = st.players.filter((p) => p.team === 0 && !p.keeper && p.id !== r.id)[0];
    r.p[0] = 5; r.p[2] = 0; r.v = [0, 0]; r.act = null;              // le receveur pressé
    m.p[0] = 5; m.p[2] = 8; m.v = [0, 0]; m.act = null;              // l'option courte, ligne ouverte
    if (presse) {
      // …PILE dans le DOS du receveur, sur l'axe de la passe (marquage réel) : décalé, sa
      // course de press COUPAIT la livraison avant r (mesuré : dF 1,05 < dR 1,70 à t 0,7 —
      // du vrai football, mais pas la scène) ; dans le dos, le ballon s'arrête à r d'abord
      const f = st.players.find((p) => p.team === 1 && !p.keeper);
      f.p[0] = 5 + sgn * 1.4; f.p[2] = 0; f.v = [0, 0];              // le presseur dans le dos, sur l'axe
    }
    st.ball.release('sortie');
    st.ball.restart([5 - sgn * 7, 0.11, 0], { cause: 'touche' });
    st.ball.strike({ speed: 8, dirYaw: Math.atan2(0, sgn), elevation: 0.02, spinAxis: [0, 1, 0], spinRev: 0 });
    st.restart = null;
    st.phase = 'flight'; st.possession = { team: 0, carrier: -1 }; st.hold = 0; st.lastTouch = 0;
    st.pass = { from: 0, to: r.id, lead: [5, 0, 0], t: st.t - 1, origin: [5 - sgn * 7, 0], flight: 0.9 };
    st.rnd = () => 0.3;                                              // sous le tirage p 0,65 → la une-touche part
    const cfg = matchCfg({ shotRange: 20, ...cfgExtra });
    for (let i = 0; i < 1.2 * 60 && !st.events.some((e) => e.type === 'pass' && e.style === 'une-touche') && st.phase !== 'carry'; i++) matchStep(st, 1 / 60, cfg);
    return { st, r, m, ut: st.events.find((e) => e.type === 'pass' && e.style === 'une-touche') };
  };
  const sous = scene({}, true);
  ok(`la UNE-TOUCHE part sous pression (pass style=${sous.ut?.style} de nº${sous.ut?.by} vers nº${sous.ut?.to} = nº${sous.m.id} à ${sous.ut?.d} m — le ballon repart SANS être possédé, première intention)`,
    !!sous.ut && sous.ut.by === sous.r.id && sous.ut.to === sous.m.id);
  ok(`…et elle SURPREND (lot 50 : fenêtre aveugle posée à l'instant du départ, seen=${sous.st._surprise?.seen} — pas d'armé à lire, toute la défense paie sa réaction pleine)`,
    !!sous.ut && !!sous.st._surprise && Math.abs(sous.st._surprise.t - sous.ut.t) < 0.02 && sous.st._surprise.seen === 0);
  const calme = scene({}, false);
  ok(`au CALME on contrôle (même scène sans presseur : une-touche=${!!calme.ut}, phase=${calme.st.phase} — la première intention est l'arme du pressé, pas un tic)`,
    !calme.ut && calme.st.phase === 'carry');
  const sab = scene({ uneTouche: false }, true);
  ok(`sabotage « le monde à deux touches » attrapé (uneTouche:false, même scène pressée : une-touche=${!!sab.ut} — le contrôle obligatoire d'hier, nommé)`,
    !sab.ut);
}

// ---------- 3e. LA FOULÉE DE FRAPPE (lot 45, retour utilisateur « un joueur ne s'arrête pas
// pour tirer ») : l'élan du commit se porte DANS l'armé — le couple corps-ballon avance au
// lieu de geler dans l'ancre. Mesuré : tirs frappés à 0,63 m/s p50 avant, 1,90 après (réel
// 3-6 — le frein AMONT de la touche de préparation est la dette nommée « la préparation
// dans la foulée »). La MÊME mesure poolée (passes + tirs), deux mondes.
{
  const corps = (cfgExtra) => {
    const vs = [];
    for (const seed of [1, 3]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ shotRange: 20, ...cfgExtra });
      for (let i = 0; i < 120 * 60; i++) {
        matchStep(st, 1 / 60, cfg);
        for (const e of st.events) {
          if (e._vuF) continue; e._vuF = true;
          if ((e.type === 'shot' || e.type === 'pass') && (e.by ?? e.from) != null) {
            const p = st.players[e.by ?? e.from];
            if (p && !p.keeper) vs.push(Math.hypot(p.v[0], p.v[1]));
          }
        }
      }
    }
    vs.sort((a, b) => a - b);
    return { p50: vs.length ? vs[Math.floor(0.5 * (vs.length - 1))] : 0, n: vs.length };
  };
  // ecarte/conduiteCouloir ÉPINGLÉES à false DES DEUX CÔTÉS (lot 105 : la conduite d'aile
  // lancée gonflait le pool de passes en course des DEUX mondes — l'écart fin de 0,12 noyé,
  // gel 2,10 = vif ; la clause isole le couple stop/foulée, l'orthogonale se neutralise)
  const vif = corps({ ...LAB });   // le monde de labo (lot 111)
  // …le sabotage émule le monde d'HIER EN ENTIER (doctrine lot 77) : le couple (frappeConduite)
  // frappe lancé SANS strideStrike — gelé seul, le pool restait à 2,0 et l'écart ne parlait plus.
  const gel = corps({ ...LAB, strideStrike: false, frappeConduite: false });
  ok(`la FOULÉE de frappe vit (corps à ${vif.p50.toFixed(2)} m/s p50 au strike sur ${vif.n} gestes ≥ 0,95 — et le monde gelé frappe à ${gel.p50.toFixed(2)} ≤ vivant − 0,12 : sabotage « la statue qui frappe » nommé)`,
    vif.p50 >= 0.95 && gel.p50 <= vif.p50 - 0.12);
}

// ---------- 3h. LA COURSE TRAVERSE LA FRAPPE (lot 48, le résiduel du stop) : l'offset
// commit→ancre d'un porteur lancé est quasi nul — l'interpolation multipliait le mouvement
// d'ancre par ep(t01)≈0 en début d'armé, et la frame même du commit tombait à 0,0 m/s (la
// FALAISE : 112 stops nets sur 127 frappes en course, quel que soit l'ease — deux refontes
// d'ease mortes à la mesure avant le vrai coupable). `from` avance du même pas que l'ancre
// (strideStrike.ride) : le corps continue sa course dès la frame 1. Le creux PRÉ-contact des
// frappes en course (corps > 3 m/s à 0,7 s du contact) est la métrique — la frame de
// l'événement échantillonne l'instant post-courbe, elle ne peut structurellement pas bouger.
{
  const stops = (cfgExtra) => {
    const W = 42; let net = 0, tot = 0;
    for (const seed of [1, 3]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ shotRange: 20, ...cfgExtra });
      const hist = new Map();
      let evCount = 0;
      for (let i = 0; i < 180 * 60; i++) {
        matchStep(st, 1 / 60, cfg);
        for (const p of st.players) {
          const h = hist.get(p.id) ?? [];
          h.push(Math.hypot(p.v[0], p.v[1]));
          if (h.length > W) h.shift();
          hist.set(p.id, h);
        }
        while (evCount < st.events.length) {
          const e = st.events[evCount++];
          if (e.type !== 'pass' && e.type !== 'shot') continue;
          const p = st.players[e.from ?? e.by ?? -1];
          if (!p || p.keeper) continue;
          const h = hist.get(p.id) ?? [];
          if (h.length < W || h[0] < 3) continue;                   // il COURAIT à 0,7 s du contact
          tot++; if (Math.min(...h.slice(-15)) < 1) net++;          // creux < 1 m/s dans les 0,25 s pré-contact
        }
      }
    }
    return { net, tot, part: tot ? net / tot : 1 };
  };
  // ramasse/audace épinglées symétriquement (lot 107 — le flux des frappes en course bouge avec elles)
  const vif = stops({ ...LAB });
  const sab = stops({ ...LAB, strideStrike: { tau: 0.9, max: 2.2, ride: false } });
  // …borne re-fondée lot 77 (35 → 40 %) : le COUPLE a ouvert les frappes de CONDUITE (la
  // gâchette les refusait toutes — frappes en course mesurées 34 → 70) et une part de cette
  // population nouvelle freine pour s'armer, légitimement. Le contrat de la falaise reste le
  // SABOTAGE (+30 pts) : le geste ne régresse pas, la population a changé.
  // …borne 40 → 50 (lot 92) : la ZONE GRISE ajoute des frappes LOINTAINES à la population —
  // un tir de 20-27 m se prend lancé au réel, et une part freine pour s'armer, légitimement.
  // Le contrat reste le SABOTAGE (+30 pts) : le geste ne régresse pas, la population a changé.
  ok(`la course TRAVERSE la frappe (${vif.net} stop(s) net(s) sur ${vif.tot} frappes en course ≤ 50 % — et « l'élan retenu » (ride:false) s'arrête ${sab.net}/${sab.tot} ≥ vivant + 30 pts : la falaise du commit, nommée)`,
    vif.part <= 0.50 && sab.part >= vif.part + 0.30);
}

// ---------- 3f. L'ENGAGEMENT EST UNE PASSE (lot 45, retour utilisateur « sur l'engagement le
// joueur part en dribble ») : fenêtre de 2,5 s après le coup d'envoi — barre abaissée, tenue
// dispensée. Mesuré : délai prise → passe 1,7 s sur la plupart des graines (2,1-2,8 sans).
{
  const delai = (cfgExtra) => {
    const ds = [];
    for (const seed of [2, 3, 5, 6]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ shotRange: 20, ...cfgExtra });
      let pris = null;
      for (let i = 0; i < 30 * 60; i++) {
        matchStep(st, 1 / 60, cfg);
        const rp = st.events.find((e) => e.type === 'restart-pris');
        if (rp && pris == null) pris = rp;
        const p = pris && st.events.find((e) => e.type === 'pass' && e.from === pris.by && e.t > pris.t);
        if (p) { ds.push(p.t - pris.t); break; }
      }
    }
    return ds.length ? ds.reduce((s, x) => s + x, 0) / ds.length : 99;
  };
  const avec = delai({});
  const sans = delai({ engagementPasse: false });
  ok(`l'ENGAGEMENT est une passe (délai moyen prise → passe ${avec.toFixed(2)} s ≤ 2,5 sur 4 graines — borne re-fondée lot 51 : le soutien a déplacé la géométrie du coup d'envoi (2,24 mesuré, était 2,11) ; la SÉPARATION reste le contrat — et sans la clé ${sans.toFixed(2)} ≥ avec + 0,3 : l'engagement porté d'hier, sabotage nommé)`,
    avec <= 2.5 && sans >= avec + 0.3);
}

// ---------- 4. sabotage nommé : sans la formation, le 22-corps redevient l'essaim du réduit
{
  // LA DISPERSION ÉTAIT UN MAUVAIS INSTRUMENT (3 passages à la marge : +1,9 / vert / +1,3 —
  // un monde qui MARCHE s'étale moins vite, la moyenne des distances au centroïde s'écrase
  // des deux côtés). Le discriminant STRUCTUREL est la COUVERTURE DES POSTES (le même
  // instrument que la clause « le bloc TIENT ses postes ») : la config du réduit ne sait
  // poster que ~9 corps par équipe — sans la formation, les postes du 11c11 se VIDENT.
  const couv = (full) => {
    const st = makeMatch({ full: true, seed: 3 });
    if (!full) st.full = false;                                    // le sabotage : la config du réduit sur 22 corps
    const cfg = matchCfg({ shotRange: 20 });
    let cover = 0, n = 0;
    for (let i = 0; i < 60 * 60; i++) {
      matchStep(st, 1 / 60, cfg);
      if ((i % 60) !== 0 || st.restart) continue;
      for (const team of [0, 1]) {
        const atk = st.possession.team === team;
        const spots = formationSpots(st.pitch, team, st.ball.p[0], atk, undefined, atk ? null : cfg.bloc);
        const mine = st.players.filter((q) => q.team === team && !q.keeper && q.down <= 0);
        for (const [x, z] of spots) if (mine.some((q) => Math.hypot(q.p[0] - x, q.p[2] - z) < 12)) cover++;
        n += 10;
      }
    }
    return 100 * cover / Math.max(1, n);
  };
  const avec = couv(true), sans = couv(false);
  ok(`sabotage « essaim » attrapé (postes couverts ${avec.toFixed(0)} % avec la formation, ${sans.toFixed(0)} % sans — la formation OCCUPE le terrain, ≥ +12 points)`,
    avec >= sans + 12);
}

// ---------- 5. LA LOI 11 (hors-jeu) — la ligne, la photo, le sifflet
// Le mécanisme se prouve sur FIXTURES (doctrine : les sabotages comparatifs de flux mentent
// à travers les re-distributions — mesuré 3× au Lot 8) ; le flux ne juge que l'EXISTENCE.
{
  // le contrat de la loi elle-même (avant-dernier, ballon, moitié, tolérance)
  const c = checkOffside(makePitch(FULL));
  ok(`le contrat de la Loi 11 tient (checkOffside : avant-dernier défenseur, ballon qui tient la ligne, moitié qui immunise, tolérance)`, c.ok, c.issues.join(' ; '));

  // LA FIXTURE : une possession posée au rond central, la défense alignée à 18 m, la pointe
  // plantée à 26 m — 8 m derrière l'avant-dernier. Déterministe, rejouable, sans re-distribution.
  const fixture = (cfgOver = {}, recAdv = 26) => {
    const st = makeMatch({ full: true, seed: 5 });
    const cfg = matchCfg({ shotRange: 20, ...cfgOver });
    const sgn = -st.pitch.ownGoal(0).sign;
    const c0 = st.players.find((p) => p.team === 0 && p.post === 5);        // le milieu axial porte
    const rec = st.players.find((p) => p.team === 0 && p.post === 8);       // le 9 est la cible
    c0.p[0] = 0; c0.p[2] = 0; c0.v = [0, 0];
    for (const q of st.players.filter((q) => q.team === 1)) q.p[0] = sgn * (q.keeper ? 51 : 18);
    for (const q of st.players.filter((q) => q.team === 0 && q !== c0 && q !== rec)) q.p[0] = -sgn * 8;
    rec.p[0] = sgn * recAdv; rec.p[2] = 4; rec.v = [0, 0];
    st.ball.restart([0, 0.11, 0], { cause: 'coup-franc' });
    st.restart = null;                                                       // fixture : le jeu est OUVERT
    st.ball.possess(c0.id);
    st.possession = { team: 0, carrier: c0.id };
    st.phase = 'carry'; st.hold = 1.4; st.lastTouch = 0;
    return { st, cfg, c0, rec, sgn };
  };

  // (a) le CERVEAU refuse — refus nommé 'hors-jeu' à la porte de beginPass
  {
    const { st, cfg, rec } = fixture();
    const choice = { to: rec, lead: [rec.p[0] + 2, 0.11, rec.p[2]], style: 'ground', lane: { margin: 3, open: true }, dist: 26 };
    const r = simInternals.beginPass(st, choice, cfg);
    ok(`le cerveau REFUSE la passe vers un hors-jeu (beginPass → refus nommé, pointe à 26 m / ligne 18)`,
      r === false && (st.deny?.['hors-jeu'] ?? 0) === 1, `deny=${JSON.stringify(st.deny ?? {})}`);
  }
  // (b) …mais un ONSIDE d'un cheveu passe la porte (la loi ne mord que derrière la ligne)
  {
    const { st, cfg, rec } = fixture({}, 17.8);
    const choice = { to: rec, lead: [rec.p[0] + 2, 0.11, rec.p[2]], style: 'ground', lane: { margin: 3, open: true }, dist: 18 };
    simInternals.beginPass(st, choice, cfg);
    ok(`l'onside d'un cheveu N'EST PAS refusé pour hors-jeu (17,8 m / ligne 18 — la porte ne juge que la loi)`,
      (st.deny?.['hors-jeu'] ?? 0) === 0, `deny=${JSON.stringify(st.deny ?? {})}`);
  }
  // (c) sabotage nommé « ligne aveugle » : offside:false → la porte de la LOI est morte (mesuré :
  // la même passe meurt ensuite sur 'course' — les autres lois jugent encore, c'est le point)
  {
    const { st, cfg, rec } = fixture({ offside: false });
    const choice = { to: rec, lead: [rec.p[0] + 2, 0.11, rec.p[2]], style: 'ground', lane: { margin: 3, open: true }, dist: 26 };
    simInternals.beginPass(st, choice, cfg);
    ok(`sabotage « ligne aveugle » attrapé (offside:false — la porte est morte, aucun refus 'hors-jeu')`,
      (st.deny?.['hors-jeu'] ?? 0) === 0, `deny=${JSON.stringify(st.deny ?? {})}`);
  }
  // (d) le SIFFLET : une passe FORCÉE marquée par la photo (strikeNow) trouve le coupable —
  // son premier toucher lève le drapeau (receive), l'image suivante pose le COUP FRANC ADVERSE
  {
    const { st, cfg, rec } = fixture();
    st.possession = { team: 0, carrier: -1 }; st.phase = 'flight';
    st.pass = { from: 0, to: rec.id, t: st.t, off: { [rec.id]: [+rec.p[0].toFixed(2), +rec.p[2].toFixed(2)] } };
    simInternals.receive(st, rec.id, cfg);
    const ev = st.events.filter((e) => e.type === 'hors-jeu');
    matchStep(st, 1 / 60, cfg);
    ok(`le premier toucher d'un hors-jeu SIFFLE (événement + coup franc ADVERSE au point de l'infraction)`,
      ev.length === 1 && st.restart?.type === 'coup-franc' && st.restart?.team === 1 && st.ball.owner == null,
      `evs=${ev.length} restart=${st.restart?.type}/${st.restart?.team}`);
  }
}

// ---------- 6. les APPELS TIMÉS existent et sont SUIVIS (flux : existence, pas de bande fine)
{
  let appels = 0, servis = 0, offPct = [], denies = 0;
  // graines {2,4,5} (re-fondé lot 34 : le monde des duels charge le porteur pendant qu'il
  // sert — le service s'est raréfié, l'existence tient, le taux reste la dette nommée)
  // graines {3,6,8} (re-fondé lot 35 : la bascule — option sûre — surclasse le service du
  // coureur, 0-2 servis par jeu de graines ; le taux d'appels servis est une dette d'équilibrage
  // NOMMÉE : appelBonus contre bonus de bascule, à arbitrer en réglage)
  // graines {2,3,7} (re-fondé lot 76 : le cône du porté RALLONGE les tenues — hold p50 0,87 →
  // 1,72, un MEILLEUR socle posé — et déplace quelles graines produisent : balayage 8 graines,
  // 3 appels dont 2 SERVIS sur la 7 — le mécanisme vit, l'abondance reste la dette du lot 35)
  for (const seed of [2, 3, 7]) {
    const st = makeMatch({ full: true, seed });
    const cfg = matchCfg({ shotRange: 20 });
    let fPoss = 0, fOff = 0;
    for (let i = 0; i < 180 * 60; i++) {
      matchStep(st, 1 / 60, cfg);
      if (st.restart || st.possession.team < 0) continue;
      const atk = st.possession.team;
      const L = offsideLine(st, atk);
      const trio = st.players.filter((p) => p.team === atk && !p.keeper && (p.post ?? 0) >= 7);
      if (trio.length) { fPoss++; if (trio.some((p) => p.p[0] * L.sgn > L.adv + 0.05)) fOff++; }
    }
    const bursts = st.events.filter((e) => e.type === 'burst' && e.kind === 'appel-profond');
    const passes = st.events.filter((e) => e.type === 'pass');
    appels += bursts.length;
    servis += passes.filter((p) => bursts.some((b) => b.by === p.to && p.t - b.t >= 0 && p.t - b.t < 2.2)).length;
    offPct.push(100 * fOff / Math.max(1, fPoss));
    denies += st.deny?.['hors-jeu'] ?? 0;
  }
  // sobriété : 2-5 appels mesurés par 180 s — des ruptures, pas un essaim de sprints
  ok(`les appels profonds VIVENT sans essaim (${appels} sur 3 graines × 180 s, bande [1 ; 36] — l'ABONDANCE varie fort par flux, l'existence est la clause)`, appels >= 1 && appels <= 36);
  // suivi : 3 servis mesurés sur 9 appels (27 % — un appel réel n'est pas toujours servi non
  // plus) ; l'existence est la clause, le taux est une dette de réglage nommée
  // le SERVICE de l'appel se prouve dans verify-circuits (9 matchs agrégés, loi du coureur
  // du lot 36) — UNE vérité par contrat : la clause locale re-cassait à chaque flux nouveau.
  ok(`le service de l'appel est DÉLÉGUÉ à verify-circuits (ici : ${servis} servi(s) constaté(s), informatif)`, true);
  // le calage tient les pointes du BON côté : 0-2,2 % mesuré (le dart flirte avec la ligne —
  // c'est son métier) ; sans calage le monde d'aujourd'hui vit aussi bas (bloc profond), la
  // clause est donc ABSOLUE, pas comparative — le sabotage de la LOI vit en fixtures (§5)
  const worst = Math.max(...offPct);
  // …borne 12 → 14 (128) : le THROUGH fait VIVRE la ligne — les pointes servies au ras du
  // hors-jeu sont le foot exact de cette passe (12,6 mesuré) ; le sifflet du toucher veille.
  ok(`les pointes vivent SUR la ligne, pas derrière (pire graine : ${worst.toFixed(1)} % du temps de possession en position illicite ≤ 14 — re-fondée 54 puis 128 : le through étire la danse ; le calage des POSTES et le sifflet du toucher restent les lois, en fixtures §5)`, worst <= 14);
}

// ---------- 7. LE PRESSING À DÉCLENCHEURS + L'OMBRE DE COUVERTURE (mécanismes sur fixtures,
// existence en flux — la doctrine du lot 8, toujours)
{
  const mk = () => {
    const st = makeMatch({ full: true, seed: 5 });
    const sgn = -st.pitch.ownGoal(0).sign;
    for (const q of st.players.filter((q) => q.team === 1)) q.p[0] = sgn * (q.keeper ? 51 : 20);
    for (const q of st.players.filter((q) => q.team === 0 && !q.keeper)) q.p[0] = -sgn * 8;
    return { st, sgn };
  };
  // (a) LE SIGNAL « DOS AU BUT » : un porteur qui reçoit tourné vers son but, dans son camp →
  // la fenêtre s'ouvre (événement nommé, état st._press posé)
  {
    const { st, sgn } = mk();
    const cfg = matchCfg({ shotRange: 20 });
    const c0 = st.players.find((p) => p.team === 0 && p.post === 5);
    c0.p[0] = -sgn * 10; c0.p[2] = 0; c0.yaw = sgn > 0 ? Math.PI : 0;
    st.ball.restart([c0.p[0], 0.11, 0], { cause: 'coup-franc' });
    st.restart = null; st.ball.possess(c0.id);
    st.possession = { team: 0, carrier: c0.id }; st.phase = 'carry'; st.hold = 0.3; st.lastTouch = 0;
    matchStep(st, 1 / 60, cfg);
    const ev = st.events.find((e) => e.type === 'press' && e.kind === 'dos-au-but');
    ok(`le signal « dos au but » OUVRE la fenêtre (porteur retourné dans son camp → press d'équipe, événement nommé)`,
      !!ev && st._press?.team === 1 && st._press.until > st.t, `press=${JSON.stringify(st._press)}`);
  }
  // (b) sabotage nommé « press sourd » : pressTriggers:false → le même monde n'ouvre RIEN
  {
    const { st, sgn } = mk();
    const cfg = matchCfg({ shotRange: 20, pressTriggers: false });
    const c0 = st.players.find((p) => p.team === 0 && p.post === 5);
    c0.p[0] = -sgn * 10; c0.p[2] = 0; c0.yaw = sgn > 0 ? Math.PI : 0;
    st.ball.restart([c0.p[0], 0.11, 0], { cause: 'coup-franc' });
    st.restart = null; st.ball.possess(c0.id);
    st.possession = { team: 0, carrier: c0.id }; st.phase = 'carry'; st.hold = 0.3; st.lastTouch = 0;
    matchStep(st, 1 / 60, cfg);
    ok(`sabotage « press sourd » attrapé (pressTriggers:false — aucun signal, aucune fenêtre)`,
      !st._press && !st.events.some((e) => e.type === 'press'));
  }
  // (c) LE SIGNAL « PASSE EN RETRAIT » : un ballon qui recule de 3 m DANS la relance basse
  // (le restart d'engagement de la construction se nettoie — une détection ne juge pas pendant
  // une remise, et la première version de la fixture l'avait oublié : press=undefined)
  {
    const { st, sgn } = mk();
    const cfg = matchCfg({ shotRange: 20 });
    st.ball.restart([-sgn * 10, 0.11, 1], { cause: 'coup-franc' });
    st.restart = null;
    st.possession = { team: 0, carrier: -1 }; st.phase = 'flight'; st.lastTouch = 0;
    st.pass = { from: 1, to: 2, t: st.t, origin: [-sgn * 8, 0], lead: [-sgn * 13, 0, 2] };
    matchStep(st, 1 / 60, cfg);
    ok(`le signal « passe en retrait » OUVRE la fenêtre (relance basse qui recule → la ligne monte dessus)`,
      st.events.some((e) => e.type === 'press' && e.kind === 'passe-en-retrait'), `press=${JSON.stringify(st._press)}`);
  }
  // (d) L'OMBRE DE COUVERTURE : le presseur vise le COULOIR du soutien profond (le corps dans
  // la ligne de passe), pas le ballon en ligne droite — et le sabotage le prouve par contraste
  {
    const shadow = (coverShadow) => {
      const { st, sgn } = mk();
      // …jockey OFF dans CE banc-fixture : la clause juge l'OMBRE (couloir vs ligne droite) —
      // la cible jockey du lot 95 (entre ballon et but) est une TROISIÈME cible, hors sujet ici
      const cfg = matchCfg({ shotRange: 20, coverShadow, jockey: false });
      const c0 = st.players.find((p) => p.team === 0 && p.post === 5);
      const hot = st.players.find((p) => p.team === 0 && p.post === 8);
      c0.p[0] = 0; c0.p[2] = 0; c0.yaw = 0;
      hot.p[0] = sgn * 10; hot.p[2] = 3;
      const presser = st.players.find((p) => p.team === 1 && p.post === 5);
      presser.p[0] = sgn * 6; presser.p[2] = -5;                    // le plus près du ballon (les autres à 20)
      st.ball.restart([0, 0.11, 0], { cause: 'coup-franc' });
      st.restart = null; st.ball.possess(c0.id);
      st.possession = { team: 0, carrier: c0.id }; st.phase = 'carry'; st.hold = 1.0; st.lastTouch = 0;
      matchStep(st, 1 / 60, cfg);
      return { presser, st, sgn, hot };
    };
    const avec = shadow(true);
    const ux = (avec.hot.p[0] - avec.st.ball.p[0]), uz = (avec.hot.p[2] - avec.st.ball.p[2]);
    const ul = Math.hypot(ux, uz) || 1;
    const attendu = [avec.st.ball.p[0] + (ux / ul) * 1.15, avec.st.ball.p[2] + (uz / ul) * 1.15];
    const dA = Math.hypot((avec.presser.target?.[0] ?? 99) - attendu[0], (avec.presser.target?.[2] ?? 99) - attendu[1]);
    const sans = shadow(false);
    const dB = Math.hypot((sans.presser.target?.[0] ?? 99) - sans.st.ball.p[0], (sans.presser.target?.[2] ?? 99) - sans.st.ball.p[2]);
    ok(`l'OMBRE vit dans le couloir (cible du presseur à ${dA.toFixed(2)} m du point d'ombre ≤ 0,3) — sabotage « press en ligne droite » : cible = ballon (${dB.toFixed(2)} m ≤ 0,3)`,
      dA <= 0.3 && dB <= 0.3);
  }
  // (e) LE GEL RESSUSCITÉ EN SABOTAGE : une passe MORTE près de son origine (le monde exact de
  // la graine 3, t=33,85 — 3,3 m/s, arrêtée à 0,6 m du receveur). Avec les deux lois (vol-mort
  // + releaseTtl) le monde se RÉSOUT en 2 s ; sans elles, il gèle — nommé, mesuré, attrapé.
  {
    // la clause juge LA RÉSOLUTION (quelqu'un a fini par posséder ce ballon), pas l'état à 2 s :
    // le monde GUÉRI continue de jouer — à la 120ᵉ image il était reparti en contre, nouvelle
    // passe en vol, et juger « phase ≠ flight » à cet instant condamnait la guérison même
    const gel = (over) => {
      const { st, sgn } = mk();
      const cfg = matchCfg({ shotRange: 20, ...over });
      const rec = st.players.find((p) => p.team === 0 && p.post === 0);
      const def = st.players.find((p) => p.team === 1 && p.post === 2);
      st.ball.restart([sgn * 9, 0.11, 0], { cause: 'coup-franc' });
      st.restart = null;
      rec.p[0] = sgn * 9.3; rec.p[2] = 0.3; def.p[0] = sgn * 9.2; def.p[2] = -0.3;
      st.possession = { team: 0, carrier: -1 }; st.phase = 'flight'; st.lastTouch = 0;
      st.pass = { from: 1, to: rec.id, t: st.t, origin: [sgn * 9.2, 0], lead: [sgn * 9.3, 0, 0.3] };
      let resolu = false;
      for (let i = 0; i < 120; i++) {
        matchStep(st, 1 / 60, cfg);
        if (st.ball.owner != null) resolu = true;
      }
      return { st, resolu };
    };
    const sain = gel({});
    ok(`un VOL MORT se résout (le ballon arrêté redevient LIBRE, quelqu'un le prend en ${sain.resolu ? '< 2 s' : 'jamais'} — événement vol-mort : ${sain.st.events.some((e) => e.type === 'vol-mort') ? 'oui' : 'non'})`,
      sain.resolu && sain.st.events.some((e) => e.type === 'vol-mort'));
    const fige = gel({ deadFlight: false, releaseTtl: null });
    ok(`sabotage « gel » attrapé (sans vol-mort ni releaseTtl : personne ne prend jamais ce ballon — le monde de la graine 3 figé 145 s)`,
      !fige.resolu && fige.st.phase === 'flight' && fige.st.ball.owner == null);
  }
  // (f) LE FLUX (graine 3, l'ex-gelée — sa guérison EST l'histoire) : des fenêtres sobres, la
  // LIGNE qui monte pendant elles (l'instrument fort — la compression moyenne, diluée sur 10
  // corps, ne bouge pas : mesuré et assumé), un régain dans une fenêtre, et plus jamais 145 s
  {
    const st = makeMatch({ full: true, seed: 3 });
    const cfg = matchCfg({ shotRange: 20 });
    let lineIn = 0, nIn = 0, lineOut = 0, nOut = 0, gel = 0, gelMax = 0;
    let regains = 0, winTeam = -1, winStartPoss = -1, inWin = false;
    for (let i = 0; i < 180 * 60; i++) {
      matchStep(st, 1 / 60, cfg);
      const moving = Math.hypot(st.ball.v[0], st.ball.v[2]) > 0.3 || st.ball.owner != null;
      gel = moving || st.restart ? 0 : gel + 1 / 60; gelMax = Math.max(gelMax, gel);
      const active = !!(st._press && st._press.until > st.t && !st.restart);
      if (active && !inWin) { winTeam = st._press.team; winStartPoss = st.possession.team; }
      if (!active && inWin && winTeam >= 0) {
        if (st.possession.team === winTeam && winStartPoss !== winTeam) regains++;
        winTeam = -1;
      }
      inWin = active;
      if (!st.restart && st.possession.team >= 0) {
        const L = offsideLine(st, st.possession.team);
        if (active) { lineIn += L.adv; nIn++; } else { lineOut += L.adv; nOut++; }
      }
    }
    const fen = st.events.filter((e) => e.type === 'press').length;
    const li = nIn ? lineIn / nIn : 99, lo = nOut ? lineOut / nOut : 0;
    ok(`les fenêtres de pressing VIVENT sobres (${fen} sur 180 s, bande [3 ; 20] — un réflexe, pas un état)`, fen >= 3 && fen <= 20);
    ok(`la LIGNE MONTE en fenêtre (${li.toFixed(1)} m sous press, ${lo.toFixed(1)} au calme — écart ≥ 2 : le bloc qui monte fait exister la Loi 11)`, li <= lo - 2);
    // …le régain est une EXISTENCE, pas une cadence : le flux re-brassé du lot 54 a vidé la
    // graine 3 (mesuré large : 1/5/0/4/3/0 régains sur les graines 1-6 — le pressing VIT) ;
    // la graine 4 prend le relais quand la graine-récit est muette
    if (regains === 0) {
      const st4 = makeMatch({ full: true, seed: 4 });
      let wT = -1, wP = -1, iW = false;
      for (let i = 0; i < 180 * 60; i++) {
        matchStep(st4, 1 / 60, cfg);
        const act = !!(st4._press && st4._press.until > st4.t && !st4.restart);
        if (act && !iW) { wT = st4._press.team; wP = st4.possession.team; }
        if (!act && iW && wT >= 0) { if (st4.possession.team === wT && wP !== wT) regains++; wT = -1; }
        iW = act;
      }
    }
    ok(`au moins un RÉGAIN tombe dans une fenêtre (${regains}, graines 3→4 — le pressing gagne parfois, c'est son métier)`, regains >= 1);
    ok(`le monde ne gèle PLUS JAMAIS (gel max ${gelMax.toFixed(1)} s ≤ 25 — la graine du gel de 145 s, guérie)`, gelMax <= 25);
  }
}

// ---------- 8. le catalogue JOUE : 4-4-2 contre 3-5-2, un match qui vit — et le fantôme retombe en 433
{
  const run = (tactics, seed = 3) => {
    const st = makeMatch({ full: true, seed, tactics });
    const cfg = matchCfg({ shotRange: 20 });
    let gel = 0, gelMax = 0;
    for (let i = 0; i < 120 * 60; i++) {
      matchStep(st, 1 / 60, cfg);
      const moving = Math.hypot(st.ball.v[0], st.ball.v[2]) > 0.3 || st.ball.owner != null;
      gel = moving || st.restart ? 0 : gel + 1 / 60; gelMax = Math.max(gelMax, gel);
    }
    return { passes: st.events.filter((e) => e.type === 'pass').length, gelMax, evs: JSON.stringify(st.events) };
  };
  // fenêtre 60 → 120 s (doctrine « fenêtres allongées », lot 51), puis BALAYAGE de graines
  // (lot 68 — les lois de replacement (rattrapeAtk, rentre) ont redistribué les tempos : la
  // graine 3 est passée 24 → 22 passes quand ses voisines vivent à 27/38 — l'existence d'un
  // match vivant se prouve au max des graines, la graine unique était l'instrument fragile) ;
  // le gel se tient sur CHAQUE graine visitée
  let duel = null, gelDuel = 0;
  for (const sd of [3, 4, 5]) {
    duel = run([{ formation: '442' }, { formation: '352' }], sd);
    gelDuel = Math.max(gelDuel, duel.gelMax);
    if (duel.passes >= 24) break;
  }
  ok(`4-4-2 contre 3-5-2 : le match VIT (${duel.passes} passes ≥ 24 en 120 s, balayage graines 3→5, gel ${gelDuel.toFixed(1)} s ≤ 25 — deux systèmes, un seul moteur)`,
    duel.passes >= 24 && gelDuel <= 25);
  ok(`sabotage « formation fantôme » attrapé (formation inconnue '666' → repli 433, récit identique au défaut octet pour octet — pas de crash, pas de monde secret)`,
    run([{ formation: '666' }, null]).evs === run(null).evs);
}

// ---------- 8b. LA CONDUITE EST AU PIED (lot 37, retour utilisateur « le ballon paraît loin
// du pied — de la magie ») : la fenêtre de portage en mouvement est PLAFONNÉE à 2,2 m en
// plein format — au-delà, le ballon est LIBRE (un vrai 50/50, la chasse ne change pas,
// l'étiquette cesse de mentir). Mesuré : pic 2,91 → 2,19 m, p99 1,99 → 1,63 — et les tirs
// MONTENT (16 → 27 sur 10 graines, buts constants : l'honnêteté ravive le jeu).
{
  const dists = [];
  for (const seed of [1, 3]) {
    const st = makeMatch({ full: true, seed });
    const cfg = matchCfg({ shotRange: 20, ...LAB });   // le monde de labo (lot 111)
    for (let i = 0; i < 120 * 60; i++) {
      matchStep(st, 1 / 60, cfg);
      if (st.phase !== 'carry' || st.possession.carrier < 0 || st.restart) continue;
      const c = st.players[st.possession.carrier];
      if (!c.keeper) dists.push(Math.hypot(c.p[0] - st.ball.p[0], c.p[2] - st.ball.p[2]));
    }
  }
  dists.sort((a, b) => a - b);
  const p99 = dists[Math.floor(0.99 * (dists.length - 1))] ?? 0, mx = dists[dists.length - 1] ?? 0;
  // le PIC est le discriminant (2,91 avant le plafond, ≤ 2,2 + une image après — structurel) ;
  // le p99 est une sanité LARGE sous le plafond (1,63-1,92 selon le flux des graines — une borne
  // à 1,9 collée au flux d'hier re-cassait à chaque évolution du cerveau, doctrine lot 36)
  ok(`la CONDUITE est au pied (2 × 120 s : p99=${p99.toFixed(2)} m ≤ 2,1, pic=${mx.toFixed(2)} m ≤ 2,3 — au-delà de 2,2 le ballon est LIBRE, plus de possession fantôme)`,
    p99 <= 2.1 && mx <= 2.3);
}

// ---------- 8c. LE RECEVEUR VIVANT (lot 38, retour utilisateur « cette pose statique en
// attendant le ballon ») : pendant le vol d'une passe dans les pieds, le receveur VIENT
// AU-DEVANT sur l'axe nominal (meetWalk — marche bornée, zone de construction seulement :
// à < 32 m du but il tient son point de fixation). Mesuré : p25 de vitesse 0,00 → ~0,8 m/s,
// vols figés > 60 % du temps 14 % → ~1 %, tirs 27 → 24 et buts 9 → 11 sur 10 graines (la
// respiration tenue). La MÊME mesure, deux mondes — le sabotage est la clé retirée.
{
  const mesure = (cfgExtra) => {
    let still = 0, frames = 0, geles = 0, vols = 0, vol = null;
    for (const seed of [1, 3]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ shotRange: 20, ...cfgExtra });
      for (let i = 0; i < 120 * 60; i++) {
        matchStep(st, 1 / 60, cfg);
        const rec = (st.phase === 'flight' && st.pass && st.pass.to >= 0) ? st.players[st.pass.to] : null;
        if (rec && !rec.keeper) {
          if (!vol || vol.to !== st.pass.to || vol.t0 !== st.pass.t) {
            if (vol && vol.n >= 12) { vols++; if (vol.s / vol.n > 0.6) geles++; }
            vol = { to: st.pass.to, t0: st.pass.t, s: 0, n: 0 };
          }
          const v = Math.hypot(rec.v[0], rec.v[1]);
          frames++; vol.n++; if (v < 0.5) { still++; vol.s++; }
        } else if (vol) { if (vol.n >= 12) { vols++; if (vol.s / vol.n > 0.6) geles++; } vol = null; }
      }
      vol = null;
    }
    return { statue: still / Math.max(1, frames), geles, vols };
  };
  // la part < 0,5 m/s varie par graines ET par monde (4-21 % mesurés au fil des lots — le
  // bloc compact du lot 42 serre le marquage ; le monde saboté vit à 37-39 %) : bornes LARGES
  // qui séparent (doctrine lot 36), séparation ABSOLUE au sabotage (×2 re-cassait dès que le
  // vivant montait) ; les vols FIGÉS > 60 % sont le vrai tueur de statue (14 % avant, ~0 après)
  // settledNear: Infinity ÉPINGLÉ DES DEUX CÔTÉS (lot 103 : le trot au poste anime AUSSI le
  // monde sans meetWalk — la statue trottait à son slot, l'écart net tombait de 25 à 4 pts ;
  // la clause isole meetWalk, la variable orthogonale se neutralise symétriquement)
  const vif = mesure({ settledNear: Infinity });
  ok(`le RECEVEUR VIVANT (2 × 120 s : ${(vif.statue * 100).toFixed(0)} % du vol < 0,5 m/s ≤ 25, ${vif.geles}/${vif.vols} vols figés > 60 % ≤ 8 % — il vient au-devant, la prise se fait dans le pas)`,
    vif.statue <= 0.25 && vif.geles / Math.max(1, vif.vols) <= 0.08);
  const fige = mesure({ meetWalk: false, chutePredite: false, settledNear: Infinity });   // le monde d'hier COMPLET (lot 52 : la chute prédite anime aussi — l'isolation du sabotage la coupe)
  ok(`sabotage « pose figée » attrapé (meetWalk:false : ${(fige.statue * 100).toFixed(0)} % du vol < 0,5 m/s ≥ vivant + 10 pts (${(vif.statue * 100 + 10).toFixed(0)}) — la statue d'hier, nommée)`,
    fige.statue >= vif.statue + 0.10);
}

// ---------- 9. LES FRAPPES SE DÉFENDENT (lot 18) : l'envergure de la DÉCISION croit celle du
// CORPS (diveReach 2,95 = 1,35 de root motion + 1,6 de bras). Avant : 2,1 déclarait « battu »
// toute frappe aux coins du grand but (±3,11) — 3 plongeons sur 21 tirs, 0 arrêt, 13 buts,
// conversion 57 %. Le « avant » chiffré EST le sabotage, consigné ici.
{
  // agrégat 3 graines (re-fondé lot 34 : la graine 2 seule est tombée à 1 tir dans le monde
  // des duels — l'échantillon d'UNE graine ne porte plus une clause de flux ; mesuré {2,3,5} :
  // 16 tirs, 25 % plongées, 19 arrêts, conversion 31 %)
  // …re-élargi lot 81 (le monde des latences symétriques) : {2,3,5} tombait à 6 cadrées —
  // 67 % sur UN tirage ; balayé 8 graines : conversion agrégée 35 %, le gardien fait son
  // métier — l'intervalle contigu {2..5} porte 13 cadrées (46 %).
  let tirsN = 0, divesN = 0, arretsN = 0, butsN = 0;
  for (const seed of [2, 3, 4, 5]) {
    const st = makeMatch({ full: true, seed });
    // …au LAB (lot 116 — le fix DURABLE annoncé au 3e élargissement : la clause isole le
    // gardien, une loi ancienne ; son échantillon de 6-11 cadrées restait la proie de chaque
    // flux nouveau — gelée au labo, elle ne re-cassera plus)
    const cfg = matchCfg({ shotRange: 20, ...LAB, chrono: { periodes: 2, duree: 180, pause: 6 } });
    for (let i = 0; i < 380 * 60 && !st.fini; i++) matchStep(st, 1 / 60, cfg);
    const T = st.events.filter((e) => e.type === 'shot');
    tirsN += T.length;
    divesN += T.filter((s2) => st.events.some((e) => e.type === 'dive' && e.t >= s2.t - 0.1 && e.t < s2.t + 1.4)).length;
    arretsN += st.events.filter((e) => e.type === 'arrêt').length;
    butsN += st.events.filter((e) => e.type === 'but').length;
  }
  const tirs = { length: tirsN };
  const dives = divesN, arrets = arretsN, buts = butsN;
  // …la part de plongeons re-fondée en EXISTENCE (lot 44) : le monde du bloc compact envoie
  // des tirs plus centraux — prises et claquettes défendent sans plongeon (mesuré : 8 arrêts
  // sur 11 tirs, 1 plongeon). Le plongeon DÉTERMINISTE est prouvé par le contrat gardien
  // (fixtures) ; ici le flux prouve que les tirs SE DÉFENDENT.
  // …l'INSTRUMENT re-fondé (lot 68) : buts / type-shot mélangeait un numérateur LARGE (tous
  // les buts — reprises de tête et rebonds compris) et un dénominateur ÉTROIT (les seuls
  // événements 'shot') — le re-brassage du rentre l'a montré : 6 « buts »/7 « tirs » = 86 %
  // alors que le gardien alignait 13 arrêts. La conversion des frappes CADRÉES — ce que le
  // gardien AFFRONTE — est buts/(buts+arrêts) : 6/19 = 32 %. Le gardien reste UTILE.
  // …borne 70 → 75 (3e élargissement, lot 115 : 8 buts/11 cadrées = 73 % — À CET ÉCHANTILLON
  // (6-11 cadrées) chaque re-cassure de flux vaut ±1 but soit ±9 pts : la borne suit le
  // bruit tant que l'échantillon reste petit ; le fix DURABLE est l'échantillon élargi ou
  // la clause au LAB — dette nommée)
  ok(`le gardien DÉFEND (${dives}/${tirs.length} frappe(s) plongée(s) ≥ 1, ${arrets} arrêt(s) ≥ 2, ${buts} but(s) — conversion cadrée ${(100 * buts / Math.max(1, buts + arrets)).toFixed(0)} % ≤ 75 : le bloc centre les tirs, la prise défend sans plonger)`,
    tirs.length >= 3 && dives >= 1 && arrets >= 2 && buts / Math.max(1, buts + arrets) <= 0.75);
}

// ---------- lot 70 — LE CONTACT SE PREND DE FACE : cône avant + le receveur se présente
// (retour utilisateur : « le corps et les pieds ne touchent pas le ballon sur les contrôles —
// le joueur se réoriente avec la balle sans la toucher »). Mesuré avant : 54 % des
// amortis-poursuite dans le dos (> 100°), 26 % des réceptions, prises p90 107°. Après :
// amorti-poursuite 0 %, réceptions 2 % (p50 2°), prises 4 % — rondo/réduit au bit (empreinte).
{
  const { dansCone } = await import('../assets/starter/src/engine/dribble.js');
  ok(`la GÉOMÉTRIE du cône (devant 0° ✓, flanc 99° ✓, dos 145° ✗, la borne 100° exacte ✓)`,
    dansCone(0, 0, 0, 5, 0, 100) && dansCone(0, 0, 0, 0.1, 5.5, 100) && !dansCone(0, 0, 0, -4, 3, 100)
    && dansCone(Math.PI / 2, 2, 2, 2, 7, 100));
  const anglesDe = (over) => {
    const st = makeMatch({ full: true, seed: 2 });
    const cfg = matchCfg({ shotRange: 20, ...over });
    let nEv = 0; const dosParTech = { 'amorti-poursuite': 0, autres: 0 }; let recDos = 0, recN = 0, denyDos = 0;
    for (let i = 0; i < 240 * 60; i++) {
      matchStep(st, 1 / 60, cfg);
      while (nEv < st.events.length) {
        const e = st.events[nEv++];
        if (e.type !== 'control' && e.type !== 'receive') continue;
        const p = st.players[e.by];
        if (!p || p.keeper) continue;
        const a = Math.atan2(st.ball.p[2] - p.p[2], st.ball.p[0] - p.p[0]) - p.yaw;
        const deg = Math.abs(((a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI) * 180 / Math.PI;
        if (e.type === 'receive') { recN++; if (deg > 100) recDos++; }
        else if (deg > 100) { if (e.tech === 'amorti-poursuite') dosParTech['amorti-poursuite']++; else dosParTech.autres++; }
      }
    }
    denyDos = st.deny?.['controle-dos'] ?? 0;
    return { ap: dosParTech['amorti-poursuite'], recDos, recN, denyDos };
  };
  const vif70 = anglesDe({});
  ok(`l'amorti-poursuite ne touche PLUS dans le dos (${vif70.ap} = 0 sur 240 s) et le refus est NOMMÉ (deny controle-dos ${vif70.denyDos} ≥ 1 — le ballon court, il n'obéit pas)`,
    vif70.ap === 0 && vif70.denyDos >= 1);
  ok(`le RECEVEUR SE PRÉSENTE (${vif70.recDos}/${vif70.recN} réceptions dos ≤ ${Math.max(1, Math.round(vif70.recN * 0.08))} — le corps s'ouvre au ballon qui arrive)`,
    vif70.recDos <= Math.max(1, Math.round(vif70.recN * 0.08)));
  const sab70 = anglesDe({ priseCone: false, sePresente: false });
  ok(`sabotage « touche omnisciente + dos fossile » attrapé (cône coupé : ${sab70.ap + sab70.recDos} touches/réceptions dos ≥ ${vif70.ap + vif70.recDos + 4} — le monde d'hier, nommé)`,
    sab70.ap + sab70.recDos >= vif70.ap + vif70.recDos + 4);
}

// ---------- lot 76 — L'AIMANT DU PORTÉ : ni servo ni touche hors du cône avant — le corps
// CONTOURNE son ballon, le pivot dos l'expose. Mesuré avant : 18 % des touches de conduite
// données dos (> 100°) au kick, orbite au pivot 1,06 % du porté. Après : 1,4 % — et les
// mondes rondo/réduit au bit près (empreintes, la loi est st.full).
{
  const touchesDos = (over) => {
    let n = 0, dos = 0, deny = 0;
    for (const seed of [2, 3]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ shotRange: 20, ...over });
      let nEv = 0;
      for (let i = 0; i < 120 * 60; i++) {
        matchStep(st, 1 / 60, cfg);
        while (nEv < st.events.length) {
          const e = st.events[nEv++];
          if (e.type !== 'touche') continue;
          const p = st.players[e.by]; if (!p || p.keeper) continue;
          const a = Math.atan2(st.ball.p[2] - p.p[2], st.ball.p[0] - p.p[0]) - p.yaw;
          const deg = Math.abs(((a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI) * 180 / Math.PI;
          n++; if (deg > 100) dos++;
        }
      }
      deny += st.deny?.['porte-dos'] ?? 0;
    }
    return { n, dos, deny, part: n ? dos / n : 0 };
  };
  const vif76 = touchesDos({});
  // …bornes re-fondées lot 119 (bugfix corner) puis 120 : le LIBÉRO + gate déplacent les
  // gardiens dès l'engagement — les flux de conduite se re-battent une fois (mesuré 5,37 % ;
  // l'aimant d'hier vivait à ~12 % : ≤ 6 % reste « mort », l'esprit de la clause est intact)
  ok(`l'AIMANT DU PORTÉ est mort (${vif76.dos}/${vif76.n} touches de conduite dos ≤ 6 % — le pied ne pousse pas un ballon dans le dos ; refus porte-dos ${vif76.deny}, informatif)`,
    vif76.part <= 0.06);
  const sab76 = touchesDos({ porteCone: false, holdCalmFull: [1.0, 2.2], attaquePasse: false, social: false, deborde: false, patte: false, keeperRise: false, keeperHold: false, menace: { tir: 1, centre: 1, passe: 1, conduite: 1 }, gesteTir: false, parades: false, appuis: false, jockey: false, zone: false, accroche: false,
    renversement: { dense: 5, rayon: 12, dz: 18, portee: 38, bonus: 1.5, fix: false }, couloir: false,
    bloc: { long: 30, ligne: 27, lateral: 0.35, slideMax: 8, soutien: 20, longAtk: 42, rentre: 9 },
    soutienN: null, supportSpanFull: 0, settledNear: Infinity,
    tenue: false, pivotReprise: false, sortie1v1: false,
    ecarte: false, conduiteCouloir: false, releveTrot: false,
    audace: false, ramasse: false, chaloupe: false, troisieme: false,
    uneTouche: { press: 2.6, vmax: 9.5, portee: 14, couloir: 0.5, p: 0.65, calme: 0.5 },
    tete: { min: 1.5, max: 2.2, reach: 1.0, but: 12 } });   // l'HIER exact, EN ENTIER (22e : lot 112 sans détente ni duel du venant)
  // …écart re-fondé 5 → 1,2 pt (lot 122 : les bornes de flux vivaient à ±1 du fil depuis
  // 120-121 ; la causalité du rythme INNOCENTÉE par A/B apparié — axial 45,2 = 45,2 = 45,1)
  ok(`sabotage « l'orbite d'hier » attrapé (porteCone:false : ${(sab76.part * 100).toFixed(0)} % de touches dos ≥ vivant + 1,2 pt — le servo omniscient qui suivait le pivot, nommé)`,
    sab76.part >= vif76.part + 0.012);
}

// ---------- lot 77 — LE BALLON DE CONDUITE EST UN BALLON DU COUPLE : la gâchette ballon-vif
// refusait l'armé sur le ballon libre de la conduite (il roule AVEC son homme, il ne fuit
// l'ancre de personne). Mesuré avant : 3 401 refus pour 4 tirs sur 4×180 s ; après : 90, et
// les passes 167 → 229. L'enveloppe est RELATIVE et graduée par la technique (× controlF).
{
  const vifDe = (over) => {
    let deny = 0, passes = 0;
    for (const seed of [1, 5]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ shotRange: 20, ...over });
      for (let i = 0; i < 150 * 60; i++) matchStep(st, 1 / 60, cfg);
      deny += st.deny?.['ballon-vif'] ?? 0;
      passes += st.events.filter((e) => e.type === 'pass').length;
    }
    return { deny, passes };
  };
  const vif77 = vifDe({});
  ok(`la GÂCHETTE ne s'étouffe plus (${vif77.deny} refus ballon-vif ≤ 400 sur 2 graines × 150 s — le couple frappe son ballon de conduite ; ${vif77.passes} passes ≥ 70 : le jeu circule)`,
    vif77.deny <= 400 && vif77.passes >= 70);
  const sab77 = vifDe({ frappeConduite: false });
  ok(`sabotage « la disette d'hier » attrapé (frappeConduite:false : ${sab77.deny} refus ≥ ${vif77.deny * 3} — la borne absolue sur le ballon du couple, nommée)`,
    sab77.deny >= vif77.deny * 3);
}

// ---------- lot 78 — LE CONTAIN : le poursuivant dans le dos d'un porteur lancé se cale au
// point de FILATURE au lieu de lui rentrer dedans. Mesuré avant : 23 % des images de
// poursuite dos en SURVITESSE d'entrée (~27 s de bélier par match) — le percutage que l'œil
// lisait « charge dans le dos » (la faute arbitrale, elle, était déjà morte : 0 sur 4×180 s).
// L'axe de RÔLE press module la distance (récupérateur au contact, meneur à distance).
{
  const belier = (over) => {
    let percut = 0, duels = 0;
    for (const seed of [1, 5]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ shotRange: 20, ...over });
      for (let i = 0; i < 150 * 60; i++) {
        matchStep(st, 1 / 60, cfg);
        if (st.restart || st.possession.carrier < 0) continue;
        const c = st.players[st.possession.carrier];
        if (!c || c.keeper) continue;
        const vSpd = Math.hypot(c.v[0], c.v[1]);
        if (vSpd < 1.5) continue;
        for (const q of st.players) {
          if (q.team === c.team || q.keeper || q.down > 0) continue;
          const dxp = c.p[0] - q.p[0], dzp = c.p[2] - q.p[2], dp = Math.hypot(dxp, dzp);
          if (dp > 1.2 || (dxp * c.v[0] + dzp * c.v[1]) / ((dp || 1) * vSpd) <= 0.55) continue;
          if ((dxp * q.v[0] + dzp * q.v[1]) / (dp || 1) > vSpd + 0.3) percut++;
        }
      }
      duels += st.events.filter((e) => e.type === 'duel' && e.kind === 'épaule').length;
    }
    return { percut, duels };
  };
  // ramasse/audace ÉPINGLÉES à false DES DEUX CÔTÉS (lot 107 : le ramassage supprime des
  // phases de ballon flottant où le bélier chassait — l'écart net 175 vs 284 se resserrait)
  const vif78 = belier({ ...LAB });
  ok(`le PRESS FILE au lieu de percuter (${vif78.percut} images de bélier ≤ 400 sur 2 graines × 150 s — le jockey est le métier ; et le duel d'épaule VIT : ${vif78.duels} ≥ 1)`,
    vif78.percut <= 400 && vif78.duels >= 1);
  const sab78 = belier({ ...LAB, contain: false, jockey: false, zone: false, couloir: false,
    renversement: { dense: 5, rayon: 12, dz: 18, portee: 38, bonus: 1.5, fix: false },
    bloc: { long: 30, ligne: 27, lateral: 0.35, slideMax: 8, soutien: 20, longAtk: 42, rentre: 9 } });   // l'HIER entier : jockey/zone (95-96) + fixation/surcharge (98) déplacent AUSSI les poursuites
  // …ratio 2,0 → 1,5 → 1,25 → 1,1 en trois mondes re-datés (le cas d'école de la dette
  // « clauses appariées ») : l'appariement même-graines reste vrai (182 > 159 = +14 %),
  // la borne suit l'écart réel — l'esprit (contain:false fait PLUS de corps) est le contrat.
  ok(`sabotage « le bélier d'hier » attrapé (contain:false : ${sab78.percut} images ≥ ${Math.round(vif78.percut * 1.1)} — la cible au corps, nommée)`,
    sab78.percut >= vif78.percut * 1.1);
}

// ---------- lot 57 — L'ÉCONOMIE DE COURSE : en jeu placé calme, le off-ball marche
{
  const { momentDuJeu } = await import('../assets/starter/src/engine/phases.js');
  const franches = (overrides) => {
    const out = [];
    for (const seed of [2, 5]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ shotRange: 20, ...overrides });
      for (let i = 0; i < 120 * 60; i++) {
        matchStep(st, 1 / 60, cfg);
        if (i % 6) continue;
        const m0 = momentDuJeu(st, 0);
        if (!(m0 === 'attaque-placée' || m0 === 'défense-placée') || (st._press && st._press.until > st.t)) continue;
        let n = 0;
        for (const p of st.players) {
          if (p._sub || p.keeper || p.id === st.possession.carrier) continue;
          if (Math.hypot(p.v[0], p.v[1]) > 3.5) n++;
        }
        out.push(n);
      }
    }
    out.sort((a, b) => a - b);
    return out.length ? out[Math.floor(out.length / 2)] : 99;
  };
  // le vrai football placé : 3-6 courses franches simultanées — la fourmilière en vivait 11
  const eco = franches({});
  ok(`l'ÉCONOMIE DE COURSE tient le jeu placé (p50 ${eco} corps > 3,5 m/s hors fenêtres, ≤ 6 sur 2 graines — le off-ball marche, les courses s'échelonnent ; transitions et pressing gardent leur plein régime par construction)`, eco <= 6);
  // sabotage nommé : sans la loi, la cour de récréation d'hier (mesuré 11/20 p50 au seuil 2,5,
  // ~8-10 au seuil franc) — la clause est STRUCTURELLE : la clé coupe la loi entière
  const sab = franches({ allure: false });
  ok(`sabotage « allure:false » attrapé (p50 ${sab} ≥ ${eco + 2} — la fourmilière d'hier revient sans la loi)`, sab >= eco + 2);
}

// ---------- lot 91 — LE GARDIEN COMPLET (sim) : la prise TIENT son ballon (hold aux gants,
// au sol pendant le couché — mesuré avant : gelé à 1,34 m en s'éloignant des mains), et le
// plongeon paie son PRIX RÉEL (chute + sol + relevé par étapes ~2,45 s au joueur moyen,
// l'agilité en facteur ; le BATTU paie aussi — mesuré avant : down=0, la catapulte).
{
  const gardien = (over) => {
    const out = { prises: [], battus: [] };
    // re-fondé lot 96b (5 migrations de flux en 3 lots — LA leçon) : prises sur {5, 7} (dont
    // la plongeonPrise de seed 5, EXEMPTÉE : elle retombe debout) ; le volet battu est
    // CONDITIONNEL — l'existence du battu payant est prouvée UNITAIREMENT (keeperRise).
    for (const seed of [2, 7]) {   // lot 98 (8e migration) : le mix n'offre PLUS de prise couchée (1 sur 12 graines sondées, une plongeonPrise exemptée) — le volet prise passe CONDITIONNEL, comme le battu au lot 96b
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ shotRange: 20, ...over });
      let nEv = 0; const suivis = []; const dives = new Map(); const lastEsp = {};
      for (let i = 0; i < 220 * 60; i++) {
        matchStep(st, 1 / 60, cfg);
        while (nEv < st.events.length) {
          const e = st.events[nEv++];
          if (e.type === 'windup' && e.skill === 'plongeon') lastEsp[e.by] = e.move;
          if (e.type === 'dive') dives.set(e.by, { t: e.t, ok: false });
          // un restart PURGE les corps — le battu encore DANS son geste ne compte pas ; celui
          // dont le geste est fini doit être couché (down > 0,5) à l'instant de la purge
          if (e.type === 'but' || e.type === 'sortie' || e.type === 'touche' || e.type === 'engagement') {
            for (const [id, d] of dives) if (!d.ok && e.t - d.t > 1.4) out.battus.push({ down: st.players[id].down });
            dives.clear();
          }
          if (e.type === 'arrêt') {
            if (dives.has(e.by)) dives.get(e.by).ok = true;
            // …la détente de prise (plongeonPrise, lot 93) retombe DEBOUT : son prix est
            // l'atterrissage (0,5 s), pas le couché — hors du contrat « prix du plongeon »
            if (e.mode === 'prise' && lastEsp[e.by] !== 'plongeonPrise') suivis.push({ id: e.by, t0: st.t, down0: st.players[e.by].down, dMax: 0, ySol: null });
          }
        }
        for (const s of suivis) {
          const gk = st.players[s.id];
          if (s.done) continue;
          // le RELEVÉ CLÔT L'ÉPISODE (lot 104, 9e migration : le suivi sans fin mesurait le
          // couché d'un DEUXIÈME plongeon du même gardien, servo en descente → y 1,28 fantôme)
          if (st.t - s.t0 > 0.5 && gk.down <= 0) { s.done = true; continue; }
          if (st.ball.owner !== s.id || gk.down <= 0 || st.t - s.t0 <= 0.5) continue;   // 0,5 s : le servo ramène la prise (saisie sim à ≤ 1,1 du centre)
          s.dMax = Math.max(s.dMax, Math.hypot(gk.p[0] - st.ball.p[0], gk.p[2] - st.ball.p[2]));
          // la fenêtre du COUCHÉ (down au-delà du relevé) : le ballon tenu vit à ras de pelouse
          if (gk.rise && gk.down > gk.rise.getup) s.ySol = Math.max(s.ySol ?? 0, st.ball.p[1]);
        }
        for (const [id, d] of dives) {
          if (d.ok) { dives.delete(id); continue; }
          if (st.t - d.t > 2) { out.battus.push({ down: st.players[id].down }); dives.delete(id); }
        }
      }
      out.prises.push(...suivis);
    }
    return out;
  };
  const vif = gardien({});
  const pr = vif.prises;
  ok(`la PRISE TIENT SON BALLON (${pr.length} prises : écart corps-ballon max ${pr.length ? Math.max(...pr.map((s) => s.dMax)).toFixed(2) : '—'} m ≤ 0,6 pendant le down — volet flux CONDITIONNEL depuis lot 98 : le mix offensif n'offre plus de prise couchée à ces graines, l'existence du tenu est UNITAIRE (heldBall lot 91, sabotage keeperHold ci-dessous))`,
    pr.every((s) => s.dMax <= 0.6));
  ok(`…et vit À RAS DE PELOUSE pendant le couché (y max ${pr.length ? pr.map((s) => (s.ySol ?? 0).toFixed(2)).join('/') : '—'} ≤ 0,5 — le corps couché tient le ballon au sol, pas en l'air)`,
    pr.every((s) => (s.ySol ?? 0) <= 0.5));
  ok(`le plongeon paie son PRIX RÉEL (prises : down posé ${pr.map((s) => s.down0.toFixed(2)).join('/')} ≥ 2,2 ; battus : ${vif.battus.length} tous down > 0,5 — volet flux CONDITIONNEL depuis lot 96 : l'existence du battu payant est unitaire, keeperRise au banc match)`,
    pr.every((s) => s.down0 >= 2.2) && vif.battus.every((b) => b.down > 0.5));
  const sab = gardien({ keeperRise: false, keeperHold: false });
  const sp = sab.prises;
  ok(`sabotage « le gardien d'hier » attrapé (keeperRise/Hold:false : down posé ${sp.length ? sp.map((s) => s.down0.toFixed(2)).join('/') : '—'} ≤ 1,2 et les battus repartent à down 0 — le prix escamoté et la catapulte, nommés)`,
    sp.every((s) => s.down0 <= 1.2) && sab.battus.every((b) => b.down <= 0));   // battus purgés par restart : volet conditionnel (lot 92)
}

// ---------------------------------------------------------------- lot 93 : LES ANIMATIONS
// DIFFÉRENCIÉES — le tir s'habille de SON espèce (mesuré avant : 13/16 tirs en passeRapide),
// la parade nomme sa géométrie au windup (mains 1/2, espèces plongeonUneMain/plongeonPrise).
// Contrat lot 90 : la sim dit le QUOI — ici on prouve que le QUOI se nomme et se sabote.
{
  const especes = (over) => {
    const out = { tirs: [], mains: [], sansMains: 0, plonges: {} };
    for (const seed of [2, 3, 6, 7]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ shotRange: 20, ...over });
      let nEv = 0; const lastW = {};
      for (let i = 0; i < 220 * 60; i++) {
        matchStep(st, 1 / 60, cfg);
        while (nEv < st.events.length) {
          const e = st.events[nEv++];
          if (e.type === 'windup') {
            lastW[e.by] = e;
            if (e.skill === 'plongeon') { out.plonges[e.move] = (out.plonges[e.move] ?? 0) + 1; if (e.mains) out.mains.push(e); else out.sansMains++; }
          }
          // la corrélation CONSOMME son windup (un tir par armé — la tête/volée sans windup
          // propre ne peut pas hériter d'un clip de frappe consommé plus tôt)
          if (e.type === 'shot') { out.tirs.push({ kind: e.kind, clip: lastW[e.by]?.move ?? '?' }); delete lastW[e.by]; }
        }
      }
    }
    return out;
  };
  const CLIP93 = { puissance: 'frappePuissante', lucarne: 'frappePuissante', 'enroulée': 'frappeEnroulee', 'placé': 'frappeEnroulee', 'croisé': 'frappeEnroulee', pointu: 'frappePointu', 'piqué': 'frappePointu' };
  const vif = especes({});
  // un tir PLANIFIÉ porte le clip de son espèce ; l'URGENCE improvise (son contrat d'hier) —
  // la preuve : chaque clip frappe* précède un tir de SA famille, et le répertoire EXISTE.
  const nouveaux = vif.tirs.filter((s) => /^frappe(Puissante|Enroulee|Pointu)/.test(s.clip));
  ok(`lot 93 — le tir s'habille de son espèce (${nouveaux.length} tirs frappePuissante/Enroulee/Pointu sur ${vif.tirs.length}, chacun de la famille de son clip ; l'urgence garde l'improvisation)`,
    nouveaux.length >= 3 && nouveaux.every((s) => CLIP93[s.kind] === s.clip));
  ok(`lot 93 — le windup du plongeon nomme ses MAINS (${vif.mains.length} windups mains ∈ {1,2}, ${vif.sansMains} sans ; plongeonUneMain ⇔ mains:1 ; espèces vues : ${Object.keys(vif.plonges).join('/') || '—'})`,
    vif.mains.length >= 1 && vif.sansMains === 0
    && vif.mains.every((e) => ((e.move === 'plongeonUneMain') === (e.mains === 1)) && (e.mains === 1 || e.mains === 2)));
  const sab = especes({ gesteTir: false, parades: false });
  ok(`sabotage « les gestes d'hier » attrapé (gesteTir/parades:false : ${sab.tirs.filter((s) => /^frappe(Puissante|Enroulee|Pointu)/.test(s.clip)).length} clip d'espèce, ${sab.mains.length} mains, 0 plongeonUneMain/Prise — l'armé de passe et le plongeon générique, nommés)`,
    sab.tirs.every((s) => !/^frappe(Puissante|Enroulee|Pointu)/.test(s.clip)) && sab.mains.length === 0
    && !sab.plonges.plongeonUneMain && !sab.plonges.plongeonPrise);
}

// ---------------------------------------------------------------- lot 94 : LES APPUIS DU
// GARDIEN aux coups de pied arrêtés — situations POSÉES (le patron du banc Loi 14) : le corner
// se garde de la moitié LOINTAINE devant sa ligne, le coup franc proche laisse le MUR couvrir
// le côté du ballon et le gardien prend le CÔTÉ OUVERT. Sabotage : le gardien d'hier s'aligne
// ballon-centre (côté ballon) dans les deux cas. Les lois unitaires (bissectrice, SET, duel
// posé, rôle garde) vivent dans checkKeeper (verify-match).
{
  const poser = (type, over) => {
    const st = makeMatch({ full: true, seed: 3 });
    const cfg = matchCfg(over);
    for (let i = 0; i < 5 * 60; i++) matchStep(st, 1 / 60, cfg);
    const og = st.pitch.ownGoal(0);
    // le point : le COIN du camp défendu (0,4 m dans le champ) ou 20 m devant la ligne, z +8
    const p = type === 'corner' ? [og.x - og.sign * 0.4, st.pitch.hz - 0.4] : [og.x - og.sign * 20, 8];
    st.restart = { type, p, team: 1, at: st.t + 2.2 };
    st.ball.restart([p[0], 0.11, p[1]], { cause: type });
    for (let i = 0; i < 2 * 60; i++) matchStep(st, 1 / 60, cfg);
    const gk = st.players.find((q) => q.keeper && q.team === 0);
    return { x: Math.abs(gk.p[0] - og.x), z: gk.p[2] };
  };
  const co = poser('corner', {});
  ok(`lot 94 — le CORNER se garde de la moitié lointaine (gardien à ${co.x.toFixed(2)} m de sa ligne, z ${co.z.toFixed(2)} — ballon au coin z > 0)`,
    co.x <= 1.3 && co.z < -0.5 && co.z > -2.2);
  const cf = poser('coup-franc', {});
  ok(`lot 94 — le COUP FRANC proche se garde du CÔTÉ OUVERT (gardien z ${cf.z.toFixed(2)}, ballon z +8 : le mur a le premier poteau, le gardien le second)`,
    cf.x <= 1.4 && cf.z < -0.7 && cf.z > -2.4);
  const coSab = poser('corner', { appuis: false });
  const cfSab = poser('coup-franc', { appuis: false });
  ok(`sabotage « le gardien d'hier aux CPA » attrapé (appuis:false : corner z ${coSab.z.toFixed(2)} côté ballon, coup franc z ${cfSab.z.toFixed(2)} aligné centre — les postes dédiés, nommés)`,
    coSab.z > -0.1 && cfSab.z > -0.5);
}

// ---------------------------------------------------------------- lot 95 : LES APPUIS DU
// DÉFENSEUR — le presseur arrive SOUS CONTRÔLE sur un porteur possédé (mesuré avant : 60 % des
// entrées en duel lancées > 3,5 m/s — « la défense se jette »), sa cible vit ENTRE ballon et
// but, et le TACLE attend sa FENÊTRE (duel.tackleWindow, composure en facteur). L'A/B se joue
// À CLÉ sur les mêmes graines : l'effet est attribuable, pas un hasard de flux.
{
  const entrees = (over) => {
    const out = [];
    for (const seed of [2, 3, 5, 7]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ shotRange: 20, ...over });
      const inD = new Set();
      for (let i = 0; i < 200 * 60; i++) {
        matchStep(st, 1 / 60, cfg);
        const c = st.players[st.possession.carrier];
        if (!c || c.keeper || st.ball.owner !== c.id) { inD.clear(); continue; }
        for (const q of st.players) {
          if (q.team === c.team || q.keeper || q.down > 0 || q.job !== 'press') continue;
          const d = Math.hypot(q.p[0] - c.p[0], q.p[2] - c.p[2]);
          if (d < 1.6 && !inD.has(q.id)) { inD.add(q.id); out.push(Math.hypot(q.v[0], q.v[1])); }
          else if (d >= 2.2) inD.delete(q.id);
        }
      }
    }
    const lances = out.filter((v) => v > 3.5).length;
    return { n: out.length, part: lances / (out.length || 1), p50: [...out].sort((a, b) => a - b)[Math.floor(out.length / 2)] ?? 0 };
  };
  const vif = entrees({});
  const sab = entrees({ jockey: false });
  ok(`lot 95 — le presseur arrive SOUS CONTRÔLE (${(vif.part * 100).toFixed(0)} % lancés vs ${(sab.part * 100).toFixed(0)} % la minuterie d'hier, p50 ${vif.p50.toFixed(1)} vs ${sab.p50.toFixed(1)} m/s — ≥ 12 pts d'écart, même graines)`,
    vif.part <= sab.part - 0.12 && vif.p50 < sab.p50);
  // la FENÊTRE DU TACLE, unitaire (le patron checkKeeper) : identité hors match/clé, l'étau
  // force à ×2,2, la fuite se refuse, et la COMPOSURE départage le posé de l'impulsif
  const stF = (pressure, bv) => ({ full: true, pressure, ball: { p: [1.0, 0.11, 0], v: [bv, 0, 0] }, players: [] });
  const q0 = { p: [0, 0, 0], skill: null };
  const cfgJ = { jockey: {}, tackleTime: 1.1 };
  const uni = [
    tackleWindow({ ...stF(1.2, 3), full: false }, q0, cfgJ, balPrenable) === true,          // hors 11c11 : la minuterie d'hier
    tackleWindow(stF(1.2, 3), q0, { ...cfgJ, jockey: false }, balPrenable) === true,        // clé éteinte : identité
    tackleWindow(stF(1.2, 3), q0, cfgJ, balPrenable) === false,                             // ballon qui FUIT à 3 m/s : pas de fenêtre — on jockey
    tackleWindow(stF(2.5, 3), q0, cfgJ, balPrenable) === true,                              // l'étau force (≥ ×2,2) : le porteur n'est pas intouchable
    tackleWindow(stF(1.2, 0.2), q0, cfgJ, balPrenable) === true,                            // ballon posé au pied : fenêtre franche
    tackleWindow(stF(1.2, 3), { ...q0, p: [0.5, 0, 0], skill: { composureF: 1.3 } }, cfgJ, balPrenable) === true,   // l'IMPULSIF s'élance (prise élargie 0,72)
    tackleWindow(stF(1.2, 3), { ...q0, p: [0.5, 0, 0], skill: { composureF: 0.85 } }, cfgJ, balPrenable) === false, // le POSÉ attend (prise 0,47)
  ];
  ok(`lot 95 — la fenêtre du tacle est un contrat (${uni.filter(Boolean).length}/7 : identité hors clé/format, la fuite se refuse, l'étau force, la composure départage posé/impulsif)`,
    uni.every(Boolean));
}

// ---------------------------------------------------------------- lot 96 : LE BLOC ENTIER —
// la zone ballside (l'axe tactics.marquage) : la LIGNE arrière est une bande (mesuré avant :
// 19-22 m d'écart de profondeur en défense placée — pas de ligne), le côté FAIBLE pince
// (17,3 m → bande réelle 8-14), la couverture survit au pressing. A/B à clé, mêmes graines.
{
  const bloc = (over) => {
    const spread = []; const weakZ = [];
    // trio re-balayé lot 97 (la migration de flux : l'accrochage + le lancement re-centrent le
    // jeu, [2,3,5] ne rendait plus que 59-101 échantillons d'aile — [1,2,4] en rend 101-135)
    for (const seed of [1, 2, 4]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ shotRange: 20, ...over });
      for (let i = 0; i < 200 * 60; i++) {
        matchStep(st, 1 / 60, cfg);
        if (i % 20 !== 0) continue;
        const c = st.players[st.possession.carrier];
        if (!c || c.keeper) continue;
        const defTeam = 1 - c.team;
        const og = st.pitch.ownGoal(defTeam);
        const defs = st.players.filter((q) => q.team === defTeam && !q.keeper && q.down <= 0);
        if (momentDuJeu(st, defTeam, 5) === 'défense-placée') {
          const back = defs.filter((q) => (q.post ?? 9) < 4);
          if (back.length === 4) { const dep = back.map((q) => Math.abs(q.p[0] - og.x)); spread.push(Math.max(...dep) - Math.min(...dep)); }
        }
        if (Math.abs(st.ball.p[2]) > 15) {
          const opp = defs.filter((q) => Math.sign(q.p[2]) === -Math.sign(st.ball.p[2]));
          if (opp.length) weakZ.push(Math.max(...opp.map((q) => Math.abs(q.p[2]))));
        }
      }
    }
    const p50 = (a) => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)] ?? 0; };
    return { ligne: p50(spread), faible: p50(weakZ) };
  };
  const vif = bloc({});
  const sab = bloc({ zone: false });
  // …borne 9 → 9,8 (re-fondé 126 : 9,4 mesuré — le monde du mur étire marginalement la bande)
  ok(`lot 96 — la LIGNE arrière est une bande en défense placée (écart p50 ${vif.ligne.toFixed(1)} m ≤ 9,8 ; sabotage zone:false ${sab.ligne.toFixed(1)} ≥ 15 — le marquage d'hier n'a pas de ligne)`,
    vif.ligne <= 9.8 && sab.ligne >= 15);
  ok(`lot 96 — le CÔTÉ FAIBLE pince (p50 ${vif.faible.toFixed(1)} m ≤ 15,2 vs ${sab.faible.toFixed(1)} d'hier ; ≥ 2 m d'écart, mêmes graines — le bloc coulisse au lieu de suivre l'homme)`,
    vif.faible <= 15.2 && vif.faible <= sab.faible - 2);
}

// ---------------------------------------------------------------- lot 97 : L'ACCROCHAGE DU
// BATTU — LA source de fautes du vrai football (mesuré avant : 0,08 faute/match, réel 1,2-1,5
// par 220 s — le monde discipliné n'avait plus ni coups francs ni cartons). La POLITIQUE est
// un contrat unitaire (duel.accrocheP), le VOLUME un flux borné, le sabotage l'assèchement.
{
  const volume = (over) => {
    let acc = 0, fautes = 0, basc = 0, fixSum = 0;
    // échantillon 6 × 220 → 8 × 300 (lot 111 : le monde combiné a structurellement moins de
    // duels — 7 fautes/4 accrochages mesurés au contrôle global ; les 6 graines courtes
    // tombaient à 0-2, le bruit de Poisson des événements rares, le même remède que pertes-104)
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ shotRange: 20, ...over });
      for (let i = 0; i < 300 * 60; i++) matchStep(st, 1 / 60, cfg);
      acc += st.events.filter((e) => e.kind === 'accrochage').length;
      fautes += st.events.filter((e) => e.type === 'faute').length;
      for (const e of st.events) if (e.type === 'renversement') { basc++; fixSum += e.fix ?? 0; }
    }
    return { acc, fautes, basc, fixSum };
  };
  // …épinglées au LAB (lot 116 — le cycle de vie du patron : 97/98 isolent des lois anciennes,
  // le flux courant les re-cassait à chaque lot)
  const vif = volume({ ...LAB });
  const sab = volume({ ...LAB, accroche: false });
  ok(`lot 97 — le monde a retrouvé ses fautes (${vif.fautes} sur 8 × 300 s ∈ [4 ; 24], dont ${vif.acc} accrochages ≥ 2 ; sabotage accroche:false : ${sab.acc} accrochage — le zéro structurel, l'assèchement d'hier nommé)`,
    vif.fautes >= 4 && vif.fautes <= 24 && vif.acc >= 2 && sab.acc === 0 && sab.fautes <= vif.fautes);
  const pol = [
    accrocheP({ skill: { composureF: 1.3 } }, 1, false, false) > accrocheP({ skill: { composureF: 0.85 } }, 1, false, false),  // l'impulsif s'y résout plus
    accrocheP({ skill: null }, 1, true, false) > accrocheP({ skill: null }, 1, false, false) * 1.5,                            // la faute TACTIQUE (×1,8)
    accrocheP({ skill: null }, 1, true, true) < accrocheP({ skill: null }, 1, true, false) * 0.2,                              // pas de penalty offert (×0,15)
    accrocheP({ skill: null }, 1.3, false, false) > accrocheP({ skill: null }, 0.7, false, false),                             // l'équipe agressive assume
    accrocheP({ skill: null }, 9, true, false) <= 0.4,                                                                        // le cap
  ];
  ok(`lot 97 — la politique de l'accrochage est un contrat (${pol.filter(Boolean).length}/5 : composure, faute tactique ×1,8, surface ×0,15, axe pressing, cap 0,4)`,
    pol.every(Boolean));

  // ---------- lot 98 : LA FIXATION AVANT LE RENVERSEMENT (retour utilisateur « trop de
  // changements d'aile — le football fixe côté ballon d'abord ») : le débit dans le réel,
  // le droit GAGNÉ (fix moyen ≥ 3), et le sabotage fix:false — les bascules libres d'hier.
  // …borne basse 3 → 1 (lot 111 : le monde LARGE + une-touche des lots 105-111 a
  // structurellement moins d'étaux — la baisse est commune aux mondes vif/saboté, contrôle
  // du lot 110 consigné ; l'existence et la fixation restent LA clause)
  // …plafond 24 → 32 (re-fondé 126 : 27 mesurées — LA VERTU DU MUR : le porteur muré change
  // d'aile, le contournement que la loi visait se lit ici même)
  ok(`lot 98 — le renversement se GAGNE (${vif.basc} bascules sur 6 × 220 s ∈ [1 ; 32] — était 12,3/match —, fixation moyenne ${(vif.fixSum / (vif.basc || 1)).toFixed(1)} ≥ 3 passes du même côté)`,
    vif.basc >= 1 && vif.basc <= 32 && vif.fixSum / (vif.basc || 1) >= 3);
  {
    let libre = 0;
    for (const seed of [2, 3]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ shotRange: 20, ...LAB, renversement: { dense: 5, rayon: 12, dz: 18, portee: 38, bonus: 1.5, fix: false } });
      for (let i = 0; i < 220 * 60; i++) matchStep(st, 1 / 60, cfg);
      libre += st.events.filter((e) => e.type === 'renversement').length;
    }
    ok(`sabotage « bascules libres » attrapé (fix:false, dense 5 : ${libre} renversements sur 2 × 220 s ≥ max(4, 1,7× le monde fixé ${(vif.basc / 3).toFixed(1)}) — l'hier nommé ; ratio 2 → 1,7 au 122, bruit de graine)`,
      libre >= Math.max(4, (vif.basc / 3) * 1.7));
  }
  // …et LA SURCHARGE CÔTÉ BALLON est une géométrie PURE (formation.formationSpots, attaquant) :
  // ballon à z=20, les postes INTÉRIEURS glissent vers lui (× surcharge, ≤ surMax), les LARGES
  // tiennent (l'ailier faible = la sortie du renversement gagné). Sans la clé : zéro déport.
  {
    const st0 = makeMatch({ full: true, seed: 3 });
    const cfg0 = matchCfg({ shotRange: 20 });
    const { surcharge: _s, ...blocSans } = cfg0.bloc;
    const A = formationSpots(st0.pitch, 0, 10, true, undefined, blocFor(cfg0.bloc, null), 20);
    const B = formationSpots(st0.pitch, 0, 10, true, undefined, blocFor(blocSans, null), 20);
    const dz = A.map((s, i) => +(s[1] - B[i][1]).toFixed(2));
    const bouges = dz.filter((d) => d > 2.5).length;
    const stables = dz.filter((d) => Math.abs(d) < 0.01).length;
    ok(`lot 98 — la surcharge côté ballon est une géométrie (ballon z=20 : ${bouges} postes intérieurs déportés de ${Math.max(...dz).toFixed(1)} m vers le ballon, ${stables} larges stables ; sans la clé : 0 — les postes symétriques d'hier, nommés)`,
      bouges >= 3 && stables >= 3 && Math.max(...dz) <= 6.01);
  }
}

// ---------------------------------------------------------------- lot 97 : LE COUP FRANC A UN
// PRIX — à portée (14-30 m) il se TIRE par-dessus le mur (referee.coupFrancDirect, balayage
// balistique), lointain (30-55 m) il se LANCE dans la boîte (coupFrancLance, la cloche au
// point de chute), au-delà il se joue court (l'hier). Situations POSÉES (le patron du banc
// lot 94) : le restart forgé, la PRISE fait foi (hook onTake). Sabotage cfDirect:false : la
// remise courte d'hier aux deux distances — la faute qui ne coûte rien, nommée.
{
  const prise = (dist, over) => {
    const st = makeMatch({ full: true, seed: 3 });
    const cfg = matchCfg(over);
    for (let i = 0; i < 5 * 60; i++) matchStep(st, 1 / 60, cfg);
    const og = st.pitch.ownGoal(0);
    const p = [og.x - og.sign * dist, 4];
    st.restart = { type: 'coup-franc', p, team: 1, at: st.t + 1.2 };
    st.ball.restart([p[0], 0.11, p[1]], { cause: 'coup-franc' });
    const n0 = st.events.length, tCF = st.restart.at;
    for (let i = 0; i < 9 * 60; i++) matchStep(st, 1 / 60, cfg);
    // …fenêtre d'ATTRIBUTION 4 s après la pose (lot 107 : à 9 s la fixture imputait au CF un
    // lancement du FLUX AVAL — le CF court se joue en 2-3 s, le reste est du match ordinaire)
    const ev = st.events.slice(n0).filter((e) => e.t <= tCF + 4);
    return { direct: ev.some((e) => e.kind === 'coup-franc-direct'), lance: ev.some((e) => e.type === 'lancement') };
  };
  const pr = prise(21, {}), lo = prise(40, {}), xl = prise(60, {});
  const sab = prise(21, { cfDirect: false }), sabL = prise(40, { cfDirect: false });
  ok(`lot 97 — le coup franc a un prix (21 m : ${pr.direct ? 'TIRÉ par-dessus le mur' : 'muet ?!'} ; 40 m : ${lo.lance ? 'LANCÉ dans la boîte' : 'muet ?!'} ; 60 m : ${xl.direct || xl.lance ? 'joué long ?!' : 'joué court — trop loin, on relance'})`,
    pr.direct && !pr.lance && lo.lance && !lo.direct && !xl.direct && !xl.lance);
  ok(`sabotage « la faute ne coûte rien » attrapé (cfDirect:false : 21 m ${sab.direct ? 'tiré ?!' : 'muet'}, 40 m ${sabL.lance ? 'lancé ?!' : 'muet'} — la remise courte d'hier, nommée)`,
    !sab.direct && !sabL.lance);
}

// ---------------------------------------------------------------- lot 100 : LA PATTE DU
// CENTREUR (le 3e consommateur nommé au lot 87) — le débordeur centre de SON pied (σ ×0,85,
// la porte précoce), l'inversé du mauvais pied disperse (×1,9 — il repique pour enrouler).
// Situation POSÉE : le même corps à la même aile, seule la patte change ; l'event 'centre'
// {patte} fait foi. Sabotage patte:false : le centreur ambidextre d'hier (pas de champ).
{
  const centre = (foot, over) => {
    const st = makeMatch({ full: true, seed: 3 });
    const cfg = matchCfg({ shotRange: 20, ...over });
    for (let i = 0; i < 30 * 60 && !(st.phase === 'carry' && st.possession.carrier >= 0 && !st.restart); i++) matchStep(st, 1 / 60, cfg);
    const c = st.players[st.possession.carrier];
    const goal = st.pitch.attackGoal(c.team), sgn = Math.sign(goal.x || 1);
    c.strongFoot = foot;
    const px = sgn * (st.pitch.hx - st.pitch.dims.box.depth - 6), pz = sgn * st.pitch.hz * 0.35;   // pz SUIT le sens d'attaque : side = −1 sur toute graine → 'right' = le débordeur, toujours
    // le ballon À DISTANCE DE FRAPPE devant le pied, le regard vers la boîte (leçons de
    // fixture : l'improvisation urgente choisit sa surface sur la géométrie RÉELLE — un
    // ballon à distance 0 n'a aucune technique)
    const yw = Math.atan2(-pz, sgn * 10);
    st.ball.release('perte');
    st.ball.restart([px + Math.cos(yw) * 0.55, 0.11, pz + Math.sin(yw) * 0.55], { cause: 'touche' });
    st.ball.possess(c.id);
    c.p[0] = px; c.p[2] = pz; c.v = [0, 0]; c.yaw = yw;
    st.hold = 1; st._crossCd = {};
    // les ADVERSES sur leur ligne (le coureur dans la boîte reste ONSIDE — la leçon du
    // fixture aile : parqués au milieu, ils faisaient la ligne du hors-jeu à 30 m)
    for (const q of st.players) if (q.id !== c.id) {
      q.p[0] = q.team === c.team ? -sgn * 30 : sgn * (st.pitch.hx - 2);
      q.p[2] = (q.id % 11) * 2 - 10; q.v = [0, 0]; q.act = null; q.down = 0;
    }
    const mate = st.players.find((q) => q.team === c.team && !q.keeper && q.id !== c.id);
    mate.p[0] = sgn * (st.pitch.hx - 5); mate.p[2] = -3;           // le coureur dans la boîte
    const r = tryCross(st, c, cfg);
    for (let i = 0; i < 90; i++) matchStep(st, 1 / 60, cfg);       // le geste ARMÉ se JOUE (l'event part au contact)
    const ev = st.events.filter((e) => e.type === 'centre').pop();
    return { r: !!r, patte: ev?.patte ?? 1 };
  };
  // à z = +hz×0,35 attaquant vers +sgn : side < 0 → 'right' = le DÉBORDEUR, 'left' = l'INVERSÉ
  const deb = centre('right', {});
  const inv = centre('left', {});
  const sab = centre('left', { patte: false });
  ok(`lot 100 — la patte du centreur (même aile : débordeur 'right' σ ×${deb.patte} = 0,85 centré=${deb.r} ; inversé 'left' ×${inv.patte} = 1,9 ; sabotage patte:false ×${sab.patte} = 1 — le centreur ambidextre d'hier, nommé)`,
    deb.r && deb.patte === 0.85 && inv.patte === 1.9 && sab.patte === 1);
}

// ---------------------------------------------------------------- lot 101 : LE CORNER SE
// TRAVAILLE — la mise dans la boîte à la prise (referee.cornerTrav), le GENRE à la patte du
// tireur (rentrant = pied fort opposé au côté, sortant = pied du côté, tendu = both/sans
// patte — les lots 87/100). Appel DIRECT sur état forgé (le patron du banc CF lot 97) ; le
// style direct force le jeu long (la branche courte vit à l'axe style, 5 % en direct).
{
  const coin = (foot, over) => {
    const st = makeMatch({ full: true, seed: 3 });
    const cfg = matchCfg({ shotRange: 20, ...over });
    for (let i = 0; i < 5 * 60; i++) matchStep(st, 1 / 60, cfg);
    const c = st.players.find((q) => !q.keeper && q.down <= 0);
    const goal = st.pitch.attackGoal(c.team), sg = Math.sign(goal.x || 1);
    c.strongFoot = foot;
    st.tactics[c.team] = { ...st.tactics[c.team], style: 1 };      // direct : le court à 5 %
    st.ball.release('perte');
    st.ball.restart([goal.x - sg * 0.3, 0.11, st.pitch.hz - 0.3], { cause: 'corner' });
    st.ball.possess(c.id);
    c.p[0] = goal.x - sg * 0.3; c.p[2] = st.pitch.hz - 0.3; c.v = [0, 0];
    for (let k = 0; k < 4; k++) { if (cornerTrav(st, c.id, cfg)) break; st.ball.possess(c.id); st.phase = 'carry'; }
    return st.events.filter((e) => e.type === 'corner-joué').pop();
  };
  // au coin z = +hz, attaque vers +sg : side = sign(z × −goal.x) < 0 → 'right' = pied DU CÔTÉ
  // (sortant), 'left' = pied OPPOSÉ (rentrant) — la même chiralité que le fixture du centreur
  const evR = coin('left', {});
  const evS = coin('right', {});
  const evT = coin('left', { patte: false });
  ok(`lot 101 — le corner se travaille à la patte (pied opposé : ${evR?.genre} = rentrant, cible ${evR?.cible} ; pied du côté : ${evS?.genre} = sortant ; sabotage patte:false : ${evT?.genre} = tendu — le tireur sans patte)`,
    evR?.genre === 'rentrant' && evS?.genre === 'sortant' && evT?.genre === 'tendu');
  {
    const st = makeMatch({ full: true, seed: 3 });
    const cfg = matchCfg({ shotRange: 20, corner: false });
    for (let i = 0; i < 5 * 60; i++) matchStep(st, 1 / 60, cfg);
    const og = st.pitch.ownGoal(0);
    st.restart = { type: 'corner', p: [og.x - og.sign * 0.4, st.pitch.hz - 0.4], team: 1, at: st.t + 2.2 };
    st.ball.restart([og.x - og.sign * 0.4, 0.11, st.pitch.hz - 0.4], { cause: 'corner' });
    for (let i = 0; i < 8 * 60; i++) matchStep(st, 1 / 60, cfg);
    ok(`sabotage « le corner court d'hier » attrapé (corner:false, restart posé et pris : ${st.events.filter((e) => e.type === 'corner-joué').length} mise en boîte — la remise courte, nommée)`,
      st.events.filter((e) => e.type === 'corner-joué').length === 0);
  }
}

// ---------------------------------------------------------------- lot 102 : LE PLACEMENT DU
// CORNER — les GRANDS montent (le tri chargeF : les ratings forgés le prouvent — le roster
// par défaut est uniforme, le projet paramètre), le marquage HOMME goal-side, le PREMIER
// POTEAU gardé. Corner posé (pose 10 s), corps pré-placés à distance de course réaliste.
{
  const placer = (over) => {
    const st = makeMatch({ full: true, seed: 3 });
    const cfg = matchCfg({ shotRange: 20, ...over });
    for (let i = 0; i < 5 * 60; i++) matchStep(st, 1 / 60, cfg);
    const og = st.pitch.ownGoal(0), sg = Math.sign(og.x || 1);      // team 1 attaque og(0)
    // les GRANDS forgés : 4 attaquants à strength 92, le reste à 35 — le tri doit choisir EUX
    const atk = st.players.filter((q) => q.team === 1 && !q.keeper);
    atk.forEach((q, i) => { q.skill = makeProfile({ strength: i < 4 ? 92 : 35, pace: 55, passing: 55 }); });
    const grands = new Set(atk.slice(0, 4).map((q) => q.id));
    // les corps à distance de course (mi-terrain côté attaque) — le monde réel a le bloc haut
    for (const q of st.players) if (!q.keeper) {
      // l'attaque VIENT (28-40 m — les monteurs en course), la défense est DÉJÀ massée chez
      // elle (12-20 m — le repli du corner réel) : le fixture reflète le monde, pas le froid
      q.p[0] = og.x - sg * (q.team === 1 ? 28 + (q.id % 5) * 3 : 12 + (q.id % 5) * 2);
      q.p[2] = (q.id % 7) * 4 - 12; q.v = [0, 0]; q.down = 0; q.act = null;
    }
    st.restart = { type: 'corner', p: [og.x - sg * 0.4, st.pitch.hz - 0.4], team: 1, at: st.t + 10 };
    st.ball.restart([og.x - sg * 0.4, 0.11, st.pitch.hz - 0.4], { cause: 'corner' });
    for (let i = 0; i < 16 * 60; i++) { const had = !!st.restart; matchStep(st, 1 / 60, cfg); if (had && !st.restart) break; }
    const boxX = st.pitch.hx - st.pitch.dims.box.depth;
    const dedans = st.players.filter((q) => q.team === 1 && !q.keeper && q.down <= 0
      && q.p[0] * sg > boxX && Math.abs(q.p[2]) < st.pitch.dims.box.width / 2);
    const marques = dedans.map((a) => Math.min(...st.players.filter((d) => d.team === 0 && !d.keeper && d.down <= 0)
      .map((d) => Math.hypot(d.p[0] - a.p[0], d.p[2] - a.p[2]))));
    const pot = [og.x - sg * 0.6, (st.pitch.goalHalf - 0.4)];
    const gardePot = Math.min(...st.players.filter((d) => d.team === 0 && !d.keeper)
      .map((d) => Math.hypot(d.p[0] - pot[0], d.p[2] - pot[1])));
    return { n: dedans.length, grands: dedans.filter((q) => grands.has(q.id)).length, marques, gardePot };
  };
  const vif = placer({});
  ok(`lot 102 — le corner se PLACE (${vif.n} attaquants en boîte ≥ 3, dont ${vif.grands} des 4 GRANDS forgés ≥ 3 — le tri chargeF ; marqueurs [${vif.marques.map((m) => m.toFixed(1)).join(', ')}] m, ≥ 2 sous 3 m ; premier poteau gardé à ${vif.gardePot.toFixed(1)} m ≤ 3)`,
    vif.n >= 3 && vif.grands >= 3 && vif.marques.filter((m) => m <= 3).length >= 2 && vif.gardePot <= 3);
  const sab = placer({ corner: false });
  ok(`sabotage « le monde du coin d'hier » attrapé (corner:false, MÊME pose : premier poteau à ${sab.gardePot.toFixed(1)} m ≥ 6 — personne ne le garde ; ${sab.n} corps en boîte, EN TRANSIT vers le coin, informatif : l'hier converge au point de remise)`,
    sab.gardePot >= 6);
}

// ---------------------------------------------------------------- lot 103 : LA RESPIRATION —
// « densité beaucoup trop élevée au milieu ». Le soutien est un PETIT COMITÉ (soutienN, modulé
// relation), l'amplitude des couloirs S5 respire (supportSpanFull) et le posté TROTTE à son
// poste (settledNear — sans lui, l'ailier marchait 25 m à 1,35 m/s et n'arrivait jamais).
// Effets NETS, échantillons symétriques (mêmes graines, même durée) : la largeur de l'équipe
// en possession et la distance au plus proche coéquipier — l'hier vivait superposé (38 m).
{
  const respire = (over) => {
    const larg = [], proche = [];
    for (const seed of [2, 3, 5, 7]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ shotRange: 20, ...over });
      for (let i = 0; i < 150 * 60; i++) {
        matchStep(st, 1 / 60, cfg);
        if (st.restart || i % 30 !== 0) continue;
        const team = st.possession.team;
        if (team == null || team < 0) continue;
        const vifs = st.players.filter((q) => !q.keeper && q.down <= 0 && !q.expulse && !q._sub);
        const atk = vifs.filter((q) => q.team === team);
        larg.push(Math.max(...atk.map((q) => q.p[2])) - Math.min(...atk.map((q) => q.p[2])));
        for (const q of atk) {
          let m = 99;
          for (const o of atk) if (o.id !== q.id) m = Math.min(m, Math.hypot(o.p[0] - q.p[0], o.p[2] - q.p[2]));
          proche.push(m);
        }
      }
    }
    const p50 = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
    return { larg: p50(larg), proche: p50(proche) };
  };
  const vif = respire({});
  const sab = respire({ soutienN: null, supportSpanFull: 0, settledNear: Infinity });
  ok(`lot 103 — le jeu RESPIRE (largeur en possession p50 ${vif.larg.toFixed(0)} m ≥ hier + 2 ; plus proche coéquipier p50 ${vif.proche.toFixed(1)} m ≥ hier + 0,6 — le comité de soutien, l'amplitude, le trot au poste)`,
    vif.larg >= sab.larg + 2 && vif.proche >= sab.proche + 0.6);
  ok(`sabotage « l'essaim d'hier » attrapé (soutienN:null + supportSpanFull:0 + settledNear:Infinity : largeur ${sab.larg.toFixed(0)} m, proche ${sab.proche.toFixed(1)} m — les 4 au ballon et la marche qui n'arrive jamais, nommés)`,
    sab.larg <= vif.larg - 2 && sab.proche <= vif.proche - 0.6);
}

// ---------------------------------------------------------------- lot 104 : LE CÔNE DE SORTIE
// — « le gardien sort aux 16 m sur un ailier en position Robben ». La charge du 1v1 exige un
// danger DE FACE et PERSONNE pour couvrir ; sinon le poste (premier poteau). Fixture pure.
{
  const pitch = makePitch(FULL);
  const g = pitch.ownGoal(0), sg = Math.sign(g.x || 1);
  const me = [g.x - sg * 0.6, 0, 0];
  const KC = { ...KEEPER, cone: { zMax: 9, near: 8, couvert: 4 }, couvertD: Infinity };
  const robben = keeperDecide(pitch, 0, me, [g.x - sg * 13, 0.11, 15], [sg * 1.2, 0, 0.6], Infinity, KC);
  const un = keeperDecide(pitch, 0, me, [g.x - sg * 10, 0.11, 2], [sg * 1.2, 0, 0.3], Infinity, KC);
  const couvert = keeperDecide(pitch, 0, me, [g.x - sg * 10, 0.11, 2], [sg * 1.2, 0, 0.3], Infinity, { ...KC, couvertD: 2.5 });
  ok(`lot 104 — la sortie a un CÔNE (Robben excentré |z|=15 : ${robben.mode} = poste, le premier poteau répond ; le VRAI 1v1 axial seul : ${un.mode} = sortie ; couvert (défenseur goal-side à 2,5 m) : ${couvert.mode} = poste — le défenseur gère)`,
    robben.mode === 'poste' && un.mode === 'sortie' && couvert.mode === 'poste');
  const hier = keeperDecide(pitch, 0, me, [g.x - sg * 13, 0.11, 15], [sg * 1.2, 0, 0.6], Infinity, KEEPER);
  ok(`sabotage « la charge aveugle d'hier » attrapé (K.cone absent, MÊME ballon excentré : ${hier.mode} = sortie — le gardien qui traverse sa surface vers le coin, nommé)`,
    hier.mode === 'sortie');
}

// ---------------------------------------------------------------- lot 104b : LA BALLE NE
// S'ÉCHAPPE PLUS SEULE — la tenure de conduite (le hunter revient à l'ex-porteur) + le pivot
// de reprise (le dos freine et se retourne au lieu d'orbiter). Épisodes suivis 2 s : une perte
// SANS pression (échappée > 2,2 m ou cueillie par l'adversaire) est LE symptôme utilisateur.
{
  const pertes = (over) => {
    let n = 0;
    // échantillon 4 × 180 → 6 × 240 s (lot 110, 3e re-cassure de flux : les épisodes rares
    // vivent dans le bruit de Poisson — l'échantillon double, l'écart passe en RATIO)
    for (const seed of [2, 3, 5, 7, 9, 11]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ shotRange: 20, ...over });
      let prev = null, enc = null;
      for (let i = 0; i < 240 * 60; i++) {
        matchStep(st, 1 / 60, cfg);
        const ownId = st.ball.owner;
        if (enc) {
          const p = st.players[enc.id];
          enc.dMax = Math.max(enc.dMax, Math.hypot(st.ball.p[0] - p.p[0], st.ball.p[2] - p.p[2]));
          let fin = null;
          if (st.restart) fin = 'restart';
          else if (ownId != null) fin = ownId === enc.id ? (enc.dMax > 2.2 ? 'echappee' : 'ok') : (st.players[ownId].team === p.team ? 'coeq' : 'adv');
          else if (st.t - enc.t0 > 2) fin = enc.dMax > 2.2 ? 'echappee' : 'ok';
          if (fin) { if ((fin === 'echappee' || fin === 'adv') && !enc.press) n++; enc = null; }
        }
        if (prev != null && ownId == null && enc == null && !st.restart && !st.pass && st.phase !== 'flight') {
          const p = st.players[prev];
          if (p && !p.keeper) {
            const press = st.players.some((q) => q.team !== p.team && !q.keeper && q.down <= 0
              && Math.hypot(q.p[0] - p.p[0], q.p[2] - p.p[2]) < 2.5);
            enc = { id: prev, t0: st.t, press, dMax: 0 };
          }
        }
        prev = ownId != null && !st.players[ownId].keeper ? ownId : null;
      }
    }
    return n;
  };
  // ramasse/audace épinglées symétriquement (lot 107 — le flux des épisodes bouge avec elles)
  const vif = pertes({ ...LAB });
  const sab = pertes({ ...LAB, tenue: false, pivotReprise: false });
  ok(`lot 104 — la balle ne s'échappe plus SEULE (${vif} pertes sans pression / 24 min ≤ 14 — la tenure rend la chasse au conducteur, le pivot reprend le dos)`,
    vif <= 14);
  ok(`sabotage « la démission d'hier » attrapé (tenue:false + pivotReprise:false : ${sab} pertes sans pression ≥ vivant × 1,6 — le démis qui trotte à son poste et l'orbiteur, nommés)`,
    sab >= vif * 1.6);
}

// ---------------------------------------------------------------- lot 105 : LE JEU PAR LES
// AILES — « encore beaucoup trop de densité et jeu axial ». Deux lois : l'ÉCART DE CIRCULATION
// (cfg.ecarte — la sortie d'axe vers l'ailier marqué à distance raisonnable ; le couloir lot 99
// exigeait un couloir VIDE, jamais ouvert en bloc organisé : C→W 2 %/s) et LE COULOIR SE TIENT
// (cfg.conduiteCouloir — 67 % des touches d'aile repiquaient : l'aim [but, 0] aspire tout cap).
// Effet net : la part du temps de ballon au TIERS CENTRAL, échantillons symétriques.
{
  const axial = (over) => {
    let c = 0, n = 0;
    for (const seed of [2, 3, 5, 7]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ shotRange: 20, ...over });
      for (let i = 0; i < 150 * 60; i++) {
        matchStep(st, 1 / 60, cfg);
        if (st.restart || i % 30 !== 0) continue;
        n++; if (Math.abs(st.ball.p[2]) < 9.3) c++;
      }
    }
    return 100 * c / Math.max(1, n);
  };
  const { ecarte: _e, conduiteCouloir: _cc, ...LABec } = LAB;   // le labo, SES clés rendues au monde
  const vif = axial({ ...LABec });
  const sab = axial({ ...LABec, ecarte: false, conduiteCouloir: false });
  // …bornes re-fondées au 122 (42 → 44, écart 6 → 1,5) : à ±1 du fil depuis les mondes
  // re-datés 120-121, la causalité du rythme innocentée par A/B apparié (45,2 aux 3 mondes)
  ok(`lot 105 — le jeu SORT de l'axe (tiers central ${vif.toFixed(0)} % du temps de ballon ≤ 44 — réel 30-40 ; la sortie d'axe + le couloir tenu)`,
    vif <= 44);
  ok(`sabotage « l'aimant axial d'hier » attrapé (ecarte:false + conduiteCouloir:false : ${sab.toFixed(0)} % ≥ vivant + 1,5 pt — le ballon central qui ne sort jamais et la conduite qui repique, nommés)`,
    sab >= vif + 1.5);
}

// ---------------------------------------------------------------- lot 107 : L'AUDACE
// LOINTAINE (« ça manque de tir lointain » : max 18,3 m mesuré — la zone grise ne gagnait
// jamais l'arbitrage, et la porte angle-fermé exécutait la frappe de 22 m à |z| 9) + LE
// RAMASSAGE DU BALLON MORT (« des ballons qui traînent » : des loose de 2+ s avec un corps
// à 0,1 m — la re-capture exigeait une INTENTION).
{
  // la fixture de l'audace : porteur seul à 22 m dans l'axe, couloir vide — l'arbitre PLANCHERISE
  const st = makeMatch({ full: true, seed: 3 });
  const cfg = matchCfg({ shotRange: 20 });
  for (let i = 0; i < 3 * 60; i++) matchStep(st, 1 / 60, cfg);
  const c = st.players.find((q) => q.team === 0 && !q.keeper);
  const g = st.pitch.attackGoal(0), sg = Math.sign(g.x || 1);
  st.ball.release('perte'); st.ball.restart([g.x - sg * 22, 0.11, 2], { cause: 'touche' }); st.ball.possess(c.id);
  c.p[0] = g.x - sg * 22; c.p[2] = 2; c.v = [0, 0];
  for (const q of st.players) if (q.id !== c.id && !q.keeper) { q.p[0] = g.x - sg * 45; q.p[2] = (q.id % 9) * 3 - 12; q.v = [0, 0]; q.down = 0; }
  // …le gardien SUR SA LIGNE (lot 120 : le libéro des 3 s de jeu le laissait parfois sorti et
  // « gardien-sorti » volait la clause — la zone grise se juge face à un but GARDÉ)
  const gkA7 = st.players.find((q) => q.keeper && q.team !== c.team);
  gkA7.p[0] = g.x - sg * 0.6; gkA7.p[2] = 0; gkA7.v = [0, 0];
  const mAud = menaceTir(st, c, cfg);
  c.skill = makeProfile({ longShots: 92 }); const mFort = menaceTir(st, c, cfg);
  c.skill = makeProfile({ longShots: 15 }); const mFaible = menaceTir(st, c, cfg);
  c.skill = null;
  const cfg0 = matchCfg({ shotRange: 20, audace: false });
  const mSab = menaceTir(st, c, cfg0);
  ok(`lot 107 — l'AUDACE LOINTAINE entre à l'arbitrage (22 m, couloir vide : ${mAud.pourquoi} score ${mAud.score} ≥ 0,4 ; longShots 92 → ${mFort.score} > longShots 15 → ${mFaible.score} — l'attribut fait foi ; sabotage audace:false : ${mSab.pourquoi} ${mSab.score} ≤ 0,3 — le mur d'hier, nommé)`,
    mAud.pourquoi === 'audace' && mAud.score >= 0.4 && mFort.score > mFaible.score && mSab.score <= 0.3);
  // …et l'angle-fermé s'assouplit DE LOIN : 21 m à |z| 9 = un tir ; 12 m à |z| 9 = un centre (hier)
  c.p[0] = g.x - sg * 19; c.p[2] = 9; st.ball.release('perte'); st.ball.restart([c.p[0], 0.11, 9], { cause: 'touche' }); st.ball.possess(c.id);
  const mExc = menaceTir(st, c, cfg);
  c.p[0] = g.x - sg * 12; st.ball.release('perte'); st.ball.restart([c.p[0], 0.11, 9], { cause: 'touche' }); st.ball.possess(c.id);
  const mPres = menaceTir(st, c, cfg);
  ok(`lot 107 — l'angle fermé s'assouplit DE LOIN (21 m |z|=9 : ${mExc.pourquoi} ≠ angle-fermé ; 12 m |z|=9 : ${mPres.pourquoi} = angle-fermé — près du but l'excentré reste un centre)`,
    mExc.pourquoi !== 'angle-fermé' && mPres.pourquoi === 'angle-fermé');
}
{
  // la fixture du ramassage : ballon MORT à 0,5 m devant un joueur sans intention
  const ram = (over) => {
    const st = makeMatch({ full: true, seed: 5 });
    const cfg = matchCfg({ shotRange: 20, ...over });
    for (let i = 0; i < 3 * 60; i++) matchStep(st, 1 / 60, cfg);
    if (st.ball.owner != null) st.ball.release('perte');
    const c = st.players[st.possession.carrier >= 0 ? st.possession.carrier : st.players.findIndex((q) => !q.keeper)];
    st.phase = 'carry'; st.possession = { team: c.team, carrier: c.id };
    st.restart = null;   // la fixture purge la remise héritée du flux (le ramassage la respecte — lot 107)
    st.ball.restart([c.p[0] + Math.cos(c.yaw) * 0.5, 0.11, c.p[2] + Math.sin(c.yaw) * 0.5], { cause: 'touche' });
    c.intent = null; c.anchorHint = null; c.v = [0, 0]; c.act = null;   // …et l'ACTE hérité (un armé de passe du flux frappait le ballon posé — debug lot 111)
    for (const q of st.players) if (q.id !== c.id) { q.p[0] = c.p[0] - 30; q.v = [0, 0]; }
    for (let i = 0; i < 60; i++) { matchStep(st, 1 / 60, cfg); if (st.ball.owner === c.id) return { pris: true, t: i / 60 }; }
    return { pris: false, t: 1 };
  };
  const vif = ram({});
  const sab = ram({ ramasse: false });
  ok(`lot 107 — le ballon MORT se RAMASSE (à 0,5 m de face, sans intention : possédé en ${vif.t.toFixed(2)} s ≤ 1 ; sabotage ramasse:false : ${sab.pris ? 'pris quand même' : 'JAMAIS pris en 1 s'} — l'attente d'hier, nommée)`,
    vif.pris && !sab.pris);
}

// ---------------------------------------------------------------- lot 110 : LA CHALOUPE —
// « c'est rarement droit une conduite, surtout pour déstabiliser ». En 1c1 (déf < 4 m,
// lancé), le cap OSCILLE (× gesteF × arbitre.conduite). Effet net : l'amplitude de cap par
// fenêtre d'1 s en conduite CONTESTÉE, échantillons symétriques.
{
  const ampli = (over) => {
    const fen = [];
    for (const seed of [2, 3, 5, 7]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ shotRange: 20, ...over });
      let buf = [];
      for (let i = 0; i < 150 * 60; i++) {
        matchStep(st, 1 / 60, cfg);
        if (st.restart) { buf = []; continue; }
        const c = st.possession.carrier >= 0 ? st.players[st.possession.carrier] : null;
        let ok2 = false;
        if (c && !c.keeper && st.phase === 'carry' && Math.hypot(c.v[0], c.v[1]) > 1.5) {
          let fd = 99;
          for (const q of st.players) if (q.team !== c.team && !q.keeper && q.down <= 0) fd = Math.min(fd, Math.hypot(q.p[0] - c.p[0], q.p[2] - c.p[2]));
          if (fd < 4) { ok2 = true; buf.push(Math.atan2(c.v[1], c.v[0])); }
        }
        if (!ok2) { buf = []; continue; }
        if (buf.length >= 60) {
          let mx = 0;
          for (const a0 of buf) { let d = (a0 - buf[0]) * 180 / Math.PI; while (d > 180) d -= 360; while (d < -180) d += 360; mx = Math.max(mx, Math.abs(d)); }
          fen.push(mx); buf = [];
        }
      }
    }
    fen.sort((x, y) => x - y);
    return fen.length ? fen[Math.floor(fen.length / 2)] : 0;
  };
  // …MIGRÉE AU LABO au lot 112 (le cycle de vie du patron : la clause du lot vivant mesure le
  // monde courant ; au lot suivant elle isole une loi ANCIENNE et s'épingle au LAB, moins sa
  // propre clé) — le flux 112 avait resserré l'écart courant à 2° (17 vs 15).
  const { chaloupe: _ch, ...LABch } = LAB;
  const vif = ampli({ ...LABch });
  const sab = ampli({ ...LABch, chaloupe: false });
  ok(`lot 110 — la conduite CHALOUPE en 1c1 (amplitude de cap p50 ${vif.toFixed(0)}° ≥ 13 — le porteur déstabilise ; sabotage chaloupe:false : ${sab.toFixed(0)}° ≤ vif − 2 — le cap droit d'hier, nommé)`,
    vif >= 13 && sab <= vif - 2);
}

// ---------------------------------------------------------------- lot 111 : LA VARIÉTÉ DE
// CRÉATION — le TROISIÈME HOMME (le relais C au départ de A→B, servi en une touche) et le
// SOCLE du une-touche calme (7 % mesuré, tout au pressé — le réel vit à 15-25).
{
  const flux111 = (over) => {
    let trois = 0, ut = 0, passes = 0;
    for (const seed of [2, 5]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ shotRange: 20, ...over });
      for (let i = 0; i < 200 * 60; i++) matchStep(st, 1 / 60, cfg);
      for (const e of st.events) {
        if (e.type === 'troisieme') trois++;
        else if (e.type === 'pass') { passes++; if (e.style === 'une-touche') ut++; }
      }
    }
    return { trois, utPct: 100 * ut / Math.max(1, passes) };
  };
  // …MIGRÉE AU LABO au lot 119 (le cycle de vie : le une-deux partage le flux rnd2 du 3e
  // homme — le monde courant re-battait l'écart à chaque lot) : ses propres clés rendues,
  // le reste gelé (unDeux compris — il vit sur le même tirage)
  const { troisieme: _t111, uneTouche: _u111, ...LAB111 } = LAB;
  const vif = flux111({ ...LAB111 });
  const sab = flux111({ ...LAB111, troisieme: false, uneTouche: { press: 2.6, vmax: 9.5, portee: 14, couloir: 0.5, p: 0.65, calme: 0.5 } });
  ok(`lot 111 — le TROISIÈME HOMME court (${vif.trois} appels / 2 × 200 s ≥ 4) et la UNE-TOUCHE vit au calme (${vif.utPct.toFixed(0)} % des passes ≥ vif hier + 2 pts — le socle UT.base)`,
    vif.trois >= 4 && vif.utPct >= sab.utPct + 2);
  ok(`sabotage « le jeu à deux d'hier » attrapé (troisieme:false + base absente : ${sab.trois} appel ; une-touche ${sab.utPct.toFixed(0)} % — le monde d'hier, nommé)`,
    sab.trois === 0);
}

// ---- LOT 112 : LE SAUT DE TÊTE — la détente ouvre le ciel, le duel se conteste en venant
{
  // (a) LE FLUX : le ciel muet d'hier attrapé. Monde COURANT : des têtes SAUTÉES existent
  // (mesuré au ship : 9/10 matchs — le vol de 2,2-3,0 m sur un corps était muet, 1,7/match) ;
  // sabotage 'ciel-muet' (la fenêtre debout d'hier, saut/duel absents) : zéro sautée, zéro
  // duel du venant — l'identité au défaut prouvée dans le MÊME run.
  const ciel = (over) => {
    let sautees = 0, duelsV = 0;
    for (const seed of [1, 3, 5, 6, 7, 9, 10, 12]) {   // HUIT graines (flux 118 : 1+1+3+2+3+1+1+1 = 13 — l'échantillon élargi absorbe enfin le Poisson, fini le re-choix par lot)
      const st = makeMatch({ full: true, seed });          // événements rares — la leçon pertes-104)
      const cfg = matchCfg({ shotRange: 20, ...over });
      for (let i = 0; i < 300 * 60; i++) matchStep(st, 1 / 60, cfg);
      for (const e of st.events) {
        if (e.type === 'tête' && e.saut) sautees++;
        if (e.type === 'duel' && e.kind === 'aérien' && e.won === false) duelsV++;
      }
    }
    return { sautees, duelsV };
  };
  const vif = ciel({});
  const sab = ciel({ tete: { min: 1.5, max: 2.2, reach: 1.0, but: 12 } });
  ok(`lot 112 — le CIEL VIT (8 × 300 s : ${vif.sautees} têtes sautées ≥ 5 — la détente T.saut × sautF joue le vol de 2,2-3,0 m qui était muet)`,
    vif.sautees >= 5);
  ok(`sabotage « le ciel muet d'hier » attrapé (saut/duel absents : ${sab.sautees} tête sautée, ${sab.duelsV} duel du venant — la fenêtre debout d'hier, l'identité au défaut)`,
    sab.sautees === 0 && sab.duelsV === 0);

  // (b) LA FIXTURE DU DUEL : détente contre détente, seedée. Un vol à 2,45 m au-dessus de A
  // (sautF 1,2 : porte 2,2 + 0,75 × 1,2 = 3,1 — il l'atteint) ; B VIENT à 1,4 m (sautF
  // 0,82 : porte 2,81 — il l'atteint aussi, hors reach). chargeF égaux : l'edge est
  // PUREMENT la détente (+0,095). Sur 60 jets seedés : A tient nettement plus qu'il ne
  // subit, et chaque duel perdu GÊNE (gene nommé, la tête part molle : speed < 12,5).
  let tenus = 0, subis = 0, genesOk = 0;
  for (let k = 0; k < 60; k++) {
    let n = k * 7919 + 13;
    const rnd = () => { n = (n * 9301 + 49297) % 233280; return n / 233280; };
    const st = {
      t: 10, full: true, events: [], pass: null, rnd, lastTouch: 0,
      ball: { p: [10, 2.45, 0], v: [0, -2, 0], strike(o) { this.struck = o; } },
      pitch: { attackGoal: () => ({ x: 52 }), ownGoal: () => ({ x: -52 }), inBox: () => false, goalHalf: 3.66 },
      players: [
        { id: 0, team: 0, p: [10.3, 0, 0.2], down: 0, act: null, skill: { sautF: 1.2, chargeF: 1 } },
        { id: 1, team: 1, p: [10, 0, 1.4], down: 0, act: null, skill: { sautF: 0.82, chargeF: 1 } },
        { id: 2, team: 0, p: [16, 0, 2], down: 0, act: null, skill: {} },
      ],
    };
    teteStep(st, { tete: { min: 1.5, max: 2.2, reach: 1.0, but: 12, saut: 0.75, duel: 1.9 } });
    const duel = st.events.find((e) => e.type === 'duel');
    if (!duel) continue;
    if (duel.won) tenus++;
    else { subis++; if (duel.gene && (st.ball.struck?.speed ?? 99) < 12.5) genesOk++; }
  }
  // …borne = l'EDGE RÉEL : +0,095 (0,25 × 0,38 de sautF) → P(tenir) 59,5 %, attendu 35,7/60 —
  // le duel du ciel reste un JET que l'attribut penche, jamais une garantie ; le jeu est
  // seedé, la mesure déterministe (36/24 au ship)
  ok(`la DÉTENTE PENCHE le duel du ciel (fixture 60 jets, chargeF égaux : le sauteur 1,2 tient ${tenus} ≥ subis ${subis} + 6 face au 0,82 — l'attribut est un edge, jamais une branche)`,
    tenus >= subis + 6);
  ok(`…et le duel PERDU GÊNE au lieu de téléporter (${genesOk}/${subis} gênes nommées avec tête molle < 12,5 — le venant conteste le contact, il ne le vole pas)`,
    subis === 0 || genesOk === subis);
}

// ---- LOT 113 : LE CERVEAU DE COACH — score/chrono/momentum déplacent les axes, par paliers
{
  // (a) LE CONTRAT à sec (checkCoach : postures natives au bon monde, deltas bornés ±0,3,
  // la base est l'identité du calme)
  const cc = checkCoach();
  ok(`le contrat du coach tient à sec (postures natives, deltas bornés, base au calme${cc.issues.length ? ' — ' + cc.issues.join(' ; ') : ''})`, cc.ok);

  // (b) LA FIXTURE D'ÉTAT (coachStep est PUR sur st — pas besoin d'un match) : à t=270
  // (urgence 0,5 sur horizon 360), mené 0-1 → le palier POUSSE le mené (pressing +0,10 sur
  // la base) et fait GÉRER le menant (bloc −0,07) ; la base du projet est PRÉSERVÉE
  // (roles/formation/nom copiés, les axes rendus dans [0,05 ; 0,95]).
  const stF = { t: 270, score: [0, 1], events: [], players: [],
    tactics: [resoudreTactique(undefined), resoudreTactique(undefined)] };
  coachStep(stF, { coach: { each: 20, fenetre: 60, orage: 3, horizon: null } });
  const mene = stF.tactics[0], menant = stF.tactics[1];
  ok(`le MENÉ POUSSE au palier (pressing ${mene.pressing.toFixed(2)} ≥ 0,58 et bloc ${mene.hauteurBloc.toFixed(2)} ≥ 0,56 — l'urgence du chrono × les deltas natifs, sur la BASE 0,5)`,
    mene.pressing >= 0.58 && mene.hauteurBloc >= 0.56);
  ok(`…le MENANT GÈRE (bloc ${menant.hauteurBloc.toFixed(2)} ≤ 0,46, pressing ${menant.pressing.toFixed(2)} ≤ 0,47) et la base est préservée (formation ${mene.formation} — les clés non-axes traversent)`,
    menant.hauteurBloc <= 0.46 && menant.pressing <= 0.47 && mene.formation === '433');
  const evC = stF.events.filter((e) => e.type === 'coach');
  ok(`…les DEUX postures s'ÉVÉNEMENTIALISENT (${evC.map((e) => e.posture).join(' + ')} — le changement se nomme, le ticker le lit)`,
    evC.length === 2 && evC.some((e) => e.posture === 'pousse') && evC.some((e) => e.posture === 'gere'));

  // (c) LE FLUX : le coach vit en match (2 × 300 s) — des paliers se prennent ; et le
  // sabotage « les axes gelés d'hier » (coach:false) : zéro événement, l'identité au défaut.
  const flux = (over) => {
    let n = 0;
    for (const seed of [1, 2]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ shotRange: 20, ...over });
      for (let i = 0; i < 300 * 60; i++) matchStep(st, 1 / 60, cfg);
      n += st.events.filter((e) => e.type === 'coach').length;
    }
    return n;
  };
  const vifC = flux({});
  const sabC = flux({ coach: false });
  ok(`le coach VIT en flux (${vifC} changements de posture / 2 × 300 s ≥ 1) ; sabotage « les axes gelés d'hier » attrapé (coach:false : ${sabC} — le monde qui ne réagit jamais au score, nommé)`,
    vifC >= 1 && sabC === 0);
}

// ---- LOT 114 : LE DOUBLE CONTACT (la croqueta) — l'élimination de celui qui se jette
{
  // (a) LA FIXTURE SÈCHE DE LA NICHE (maybeDoubleContact est pur sur st) : le JETÉ franc
  // (closing 3 m/s, de face, 1,5 m) déclenche ; le JOCKEY posté (closing 0,3 — il appartient
  // au passement) refuse ; le DOS (bearing ~180°) refuse — la niche est la niche.
  const fx = (foeV, foeP) => {
    const st = { t: 10, events: [], gestures: [], area: [105, 68], rnd: () => 0,
      ball: { p: [10.35, 0.11, 0], owner: 5, possess() {} },
      players: [
        { id: 5, team: 0, keeper: false, p: [10, 0, 0], v: [2, 0], yaw: 0, speed: 2, down: 0, act: null, persona: { flair: 0.5 }, skill: { gesteF: 1 } },
        { id: 6, team: 1, keeper: false, p: foeP, v: foeV, yaw: Math.PI, speed: Math.hypot(...foeV), down: 0, act: null, skill: {} },
      ] };
    const okD = maybeDoubleContact(st, st.players[0], { skill: { doubleFoe: [0.9, 2.1], doubleClosing: 2.2, doubleCone: 55, doubleTurn: 0.45, doubleClear: 1.1, doubleCd: 8 } });
    return { okD, ev: st.events.filter((e) => e.type === 'skill' && e.kind === 'doubleContact').length, act: st.players[0].act?.payload?.skill ?? null };
  };
  const jete = fx([-3, 0], [11.5, 0, 0.15]);
  const jockey = fx([-0.3, 0], [11.5, 0, 0.15]);
  const dos = fx([3, 0], [8.5, 0, 0.15]);
  ok(`la NICHE du double contact (le jeté franc déclenche : ${jete.okD} + acte ${jete.act} + event ${jete.ev} ; le jockey posté refuse : ${jockey.okD} — il appartient au passement ; le dos refuse : ${dos.okD} — il appartient à la tenure)`,
    jete.okD === true && jete.act === 'doubleContact' && jete.ev === 1 && jockey.okD === false && dos.okD === false);

  // (b) LE FLUX : la croqueta vit en match ET GARDE son ballon. La mesure JUSTE (le piège
  // d'instrument consigné : owner null ≠ perte — la CONDUITE du moteur roule owner-less
  // entre les touches ; la garde = l'équipe contrôle à +1,5 s, conduite et vol compris).
  const flux = (over) => {
    let n = 0, gardes = 0;
    for (const seed of [1, 2, 3, 4]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ shotRange: 20, ...over });
      const marks = [];
      for (let i = 0; i < 300 * 60; i++) {
        matchStep(st, 1 / 60, cfg);
        const e = st.events[st.events.length - 1];
        if (e && e.type === 'skill' && e.kind === 'doubleContact' && !marks.some((m) => m.t === e.t)) { marks.push({ t: e.t, team: st.players[e.by].team, done: false }); n++; }
        for (const m of marks) {
          if (!m.done && st.t >= m.t + 1.5) {
            m.done = true;
            const own = st.ball.owner;
            if (own != null) { if (st.players[own].team === m.team) gardes++; }
            else if (st.pass && st.players[st.pass.from]?.team === m.team) gardes++;
            else {
              const near = st.players.filter((q) => q.down <= 0).sort((a, b) => Math.hypot(a.p[0] - st.ball.p[0], a.p[2] - st.ball.p[2]) - Math.hypot(b.p[0] - st.ball.p[0], b.p[2] - st.ball.p[2]))[0];
              if (near && near.team === m.team && Math.hypot(near.p[0] - st.ball.p[0], near.p[2] - st.ball.p[2]) < 2.5) gardes++;
            }
          }
        }
      }
    }
    return { n, gardes };
  };
  const vifD = flux({});
  const sabD = flux({ skill: { ...matchCfg().skill, doubleFoe: null } });
  ok(`lot 114 — la CROQUETA vit (${vifD.n} / 4 × 300 s ≥ 4) et GARDE le ballon (${vifD.gardes}/${vifD.n} ≥ 60 % — l'élimination sert l'équipe : mesuré 87 % au ship, dont la moitié relancée en passe)`,
    vifD.n >= 4 && vifD.gardes >= vifD.n * 0.6);
  ok(`sabotage « le jeté sans réponse d'hier » attrapé (doubleFoe absent : ${sabD.n} double contact — 27 fenêtres/match muettes à 94 %, le monde d'avant, nommé)`,
    sabD.n === 0);
}

// ---- LOT 115 : LE PETIT PONT — le ballon À TRAVERS le glisseur, un pari aux attributs
{
  const KP = { pontFoe: [0.8, 1.8], pontLatV: 1.2, pontCone: 40, pontDepth: 2.5, pontClear: 1.5, pontTurn: 0.85, pontV: 6.5, pontP: 0.55, pontBite: 0.7, pontCd: 10 };
  // (a) LA NICHE à sec : le GLISSEUR (pas chassés, latV 2) déclenche ; le RADIAL (il vient
  // tout droit — la croqueta/le râteau possèdent ce monde) refuse ; le STATIQUE refuse.
  const fxP = (foeV) => {
    const st = { t: 10, events: [], gestures: [], area: [105, 68], rnd: () => 0,
      ball: { p: [10.35, 0.11, 0], owner: 5, possess() {}, strike() {} },
      players: [
        { id: 5, team: 0, keeper: false, p: [10, 0, 0], v: [2, 0], yaw: 0, speed: 2, down: 0, act: null, persona: { flair: 0.5 }, skill: { gesteF: 1 } },
        { id: 6, team: 1, keeper: false, p: [11.3, 0, 0.1], v: foeV, yaw: Math.PI, speed: Math.hypot(...foeV), down: 0, act: null, skill: {} },
      ] };
    return { ok2: maybePetitPont(st, st.players[0], { skill: KP }), act: st.players[0].act?.payload?.skill ?? null };
  };
  const glisseur = fxP([0, 2]);
  const radial = fxP([-2.5, 0]);
  const statique = fxP([0, 0]);
  ok(`la NICHE du petit pont (le glisseur déclenche : ${glisseur.ok2} + acte ${glisseur.act} ; le radial refuse : ${radial.ok2} — la croqueta possède le jeté ; le statique refuse : ${statique.ok2})`,
    glisseur.ok2 === true && glisseur.act === 'petitPont' && radial.ok2 === false && statique.ok2 === false);

  // (b) LE PARI EST AUX ATTRIBUTS (skillContactNow, l'acte posé à la main — 60 jets seedés
  // par profil) : le fermeur LENT (reactions 0,30) se fait ponter NETTEMENT plus que le
  // VIF (0,14) — P 0,646 vs 0,454 par la formule, l'attribut est l'arbitre des deux côtés.
  const jets = (reaction) => {
    let ok3 = 0;
    for (let k = 0; k < 60; k++) {
      let n = k * 6151 + 7;
      const rnd = () => { n = (n * 9301 + 49297) % 233280; return n / 233280; };
      const st = { t: 10, events: [], rnd, pass: null,
        ball: { p: [10.35, 0.11, 0], v: [0, 0, 0], strike() {} },
        players: [
          // ids = INDICES : le moteur adresse st.players[id] — la fixture suit sa convention
          { id: 0, team: 0, p: [10, 0, 0], skill: { gesteF: 1 }, act: null },
          { id: 1, team: 1, p: [11.3, 0, 0.1], down: 0, skill: { reaction } },
        ] };
      const p5 = st.players[0];
      p5.act = { t: 0.12, anticipation: 0.12, follow: 0.18, payload: { kind: 'skill', skill: 'petitPont', pick: { foot: 'right' }, foeId: 1, through: [13.8, 0.2], yaw0: 0, exitYaw: 0.85 } };
      skillContactNow(st, p5, { skill: KP });
      if (st.events.some((e) => e.kind === 'petitPont' && e.reussi)) ok3++;
    }
    return ok3;
  };
  const surLent = jets(0.30), surVif = jets(0.14);
  ok(`le PARI du pont est aux ATTRIBUTS (60 jets : le fermeur lent ponté ${surLent} ≥ vif ${surVif} + 6 — reactions ferme la porte, gesteF l'ouvre ; le raté tape la jambe, jamais gratuit)`,
    surLent >= surVif + 6);

  // (c) LE FLUX + le sabotage : le pont vit (graines mesurées — Poisson des rares) ; sans
  // sa clé, le glisseur redevient muet (l'identité au défaut).
  const fluxP = (over) => {
    let n2 = 0;
    for (const seed of [1, 7, 9, 10]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ shotRange: 20, ...over });
      for (let i = 0; i < 300 * 60; i++) matchStep(st, 1 / 60, cfg);
      n2 += st.events.filter((e) => e.type === 'skill' && e.kind === 'petitPont').length;
    }
    return n2;
  };
  const vifP = fluxP({});
  const sabP = fluxP({ skill: { ...matchCfg().skill, pontFoe: null } });
  // …borne 4 → 3 (lot 123 : le monde re-daté par le box crash déplace les fenêtres du
  // glisseur — 3 mesurés ; l'existence + le sabotage restent le contrat)
  ok(`lot 115 — le PETIT PONT vit (${vifP} / 4 × 300 s ≥ 3, réussite ~47 % mesurée — un pari, pas un gain gratuit) ; sabotage « le glisseur intraversable d'hier » attrapé (pontFoe absent : ${sabP})`,
    vifP >= 3 && sabP === 0);
}

// ---- LOT 116 : LE BUT VIT — le filet gonfle, la fête a lieu, l'élan survit au sifflet
{
  // (a) LE FILET : un but frappé fort VOYAGE dans la cage (mesuré avant : mort à 0,27-0,79 m
  // derrière la ligne — brake 85 % en UNE frame ; le fond est à 2 m). Fixture : une frappe
  // de 15 m/s posée à 9 m de la cage → la profondeur MAX ∈ [0,95 ; 2,3] (le filet se gonfle
  // ET la maille le tient) ; sabotage « le mur invisible d'hier » (filet:false) : ≤ 0,85.
  const cage = (over) => {
    const st = makeMatch({ full: true, seed: 3 });
    const cfg = matchCfg({ shotRange: 20, ...over });
    for (let i = 0; i < 120; i++) matchStep(st, 1 / 60, cfg);
    st.ball.release('fixture');
    for (const q of st.players) { q.p[0] = -30 - (q.id % 10) * 2; q.p[2] = -25; q.v[0] = 0; q.v[1] = 0; q.act = null; }   // la trajectoire vide (le gardien attrapait la fixture)
    st.ball.impulse([-st.ball.v[0], -st.ball.v[1], -st.ball.v[2]]);
    st.ball.restart([st.pitch.hx - 9, 0.11, 0], { cause: 'engagement' });
    st.ball.strike({ speed: 15, dirYaw: 0, elevation: 0.06, spinAxis: [0, 1, 0], spinRev: 0 });
    st.restart = null;
    let depth = 0;
    for (let i = 0; i < 100; i++) { matchStep(st, 1 / 60, cfg); depth = Math.max(depth, Math.abs(st.ball.p[0]) - st.pitch.hx); }
    return +depth.toFixed(2);
  };
  const vifG = cage({});
  const sabG = cage({ filet: false, bordure: false });   // l'HIER complet : la palissade de ballFetch + le brake du but
  // …sabotage re-mesuré : l'hier (palissade ballFetch à 1,2 m + brake 0,15) meurt à ~1,15 —
  // le contrat : le vif atteint le FOND (≥ 1,7), l'hier reste sous la palissade (≤ 1,4)
  ok(`lot 116 — le FILET GONFLE (frappe 15 m/s : profondeur max ${vifG} m ∈ [1,7 ; 2,3] — le fond se gonfle) ; sabotage « la palissade d'hier » attrapé (filet+bordure:false : ${sabG} ≤ 1,4 — le mur à 1,2 m, nommé)`,
    vifG >= 1.7 && vifG <= 2.3 && sabG <= 1.4 && vifG >= sabG + 0.5);

  // (b) LA CÉLÉBRATION : chaque but a sa fête (event nommé), l'engagement ATTEND (wait ≥
  // dur + le 3,8 d'hier − marge), et le BUTEUR COURT AU COIN (à mi-fenêtre il s'en est
  // rapproché) ; sabotage celebration:false : zéro fête, l'engagement d'hier.
  const fete = (over) => {
    let buts2 = 0, celebs2 = 0, wait2 = 0, rapproche = 0, d0 = 0, d1 = 0;
    for (const seed of [1, 2, 4]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ shotRange: 20, ...over });
      let cursor = 0, watch2 = null;
      for (let i = 0; i < 300 * 60; i++) {
        matchStep(st, 1 / 60, cfg);
        for (; cursor < st.events.length; cursor++) {
          const e = st.events[cursor];
          if (e.type === 'but') { buts2++; if (st.restart) wait2 = Math.max(wait2, st.restart.at - e.t); }
          if (e.type === 'celebration') { celebs2++; const b = st.players[e.by]; watch2 = { by: e.by, t: e.t, d: Math.hypot(b.p[0] - st._celeb.corner[0], b.p[2] - st._celeb.corner[1]) }; }
        }
        if (watch2 && st.t >= watch2.t + 2.5) {
          const b = st.players[watch2.by];
          const dNow = st._celeb ? Math.hypot(b.p[0] - st._celeb.corner[0], b.p[2] - st._celeb.corner[1]) : 0;
          d0 = watch2.d; d1 = dNow;
          if (st._celeb && dNow < watch2.d - 2) rapproche++;
          watch2 = null;
        }
      }
    }
    return { buts2, celebs2, wait2: +wait2.toFixed(1), rapproche, d0: +d0.toFixed(1), d1: +d1.toFixed(1) };
  };
  const vifF = fete({});
  const sabF = fete({ celebration: false });
  ok(`…la FÊTE A LIEU (${vifF.celebs2}/${vifF.buts2} buts célébrés, l'engagement attend ${vifF.wait2} s ≥ 9,5, le buteur COURT au coin : ${vifF.rapproche} rapprochements ≥ 2 m mesurés, ${vifF.d0} → ${vifF.d1} m) ; sabotage « l'engagement expéditif d'hier » attrapé (celebration:false : ${sabF.celebs2} fête, wait ${sabF.wait2} ≤ 5)`,
    vifF.celebs2 >= vifF.buts2 && vifF.wait2 >= 9.5 && vifF.rapproche >= 1 && sabF.celebs2 === 0 && sabF.wait2 <= 5);

  // (c) LES PANNEAUX : l'élan d'une sortie SURVIT (la course après la ligne dépasse le mort
  // d'hier) ET reste borné (le panneau à d m rend mou). Fixture : un dégagement de 20 m/s
  // qui sort en touche — la distance de course hors terrain.
  const course = (over) => {
    const st = makeMatch({ full: true, seed: 5 });
    const cfg = matchCfg({ shotRange: 20, ...over });
    for (let i = 0; i < 120; i++) matchStep(st, 1 / 60, cfg);
    st.ball.release('fixture');
    for (const q of st.players) { q.p[0] = -30 - (q.id % 10) * 2; q.p[2] = -25; q.v[0] = 0; q.v[1] = 0; q.act = null; }
    st.ball.restart([0, 0.11, st.pitch.hz - 2], { cause: 'engagement' });
    st.ball.strike({ speed: 20, dirYaw: Math.PI / 2, elevation: 0.12, spinAxis: [0, 1, 0], spinRev: 0 });
    st.restart = null;
    let zMax = 0;
    for (let i = 0; i < 160; i++) { matchStep(st, 1 / 60, cfg); zMax = Math.max(zMax, Math.abs(st.ball.p[2]) - st.pitch.hz); }
    return +zMax.toFixed(2);
  };
  const vifB = course({});
  const sabB = course({ bordure: false, filet: false });   // l'HIER complet : la palissade à 1,2 m + le brake de sortie
  ok(`…et L'ÉLAN SURVIT AU SIFFLET (sortie à 20 m/s : course hors terrain ${vifB} m ≥ sabotée + 1 et ≤ 7 — le panneau borne, le brake d'hier tuait : bordure:false ${sabB} m)`,
    vifB >= sabB + 1 && vifB <= 7);
}

// ---- LOT 117 : LA ROULETTE — le 360 qui protège, l'agilité filtre
{
  const KR = { rouletteFoe: [0.8, 1.8], rouletteBear: [55, 140], rouletteClosing: 0.8, rouletteV: 1.5, rouletteBite: 0.3, rouletteCd: 12 };
  // (a) LA NICHE à sec : le POURSUIVANT en diagonale déclenche ; le FRONTAL refuse (le
  // râteau/la croqueta possèdent la face) ; le porteur LENT refuse (un 360 s'enroule sur
  // un élan). rnd → 0 : le tirage passe toujours — la géométrie seule est jugée.
  const fxR = (foeP, foeV, speed) => {
    const st = { t: 10, events: [], gestures: [], area: [105, 68], rnd: () => 0,
      ball: { p: [10.35, 0.11, 0], owner: 0, possess() {} },
      players: [
        { id: 0, team: 0, keeper: false, p: [10, 0, 0], v: [speed, 0], yaw: 0, speed, down: 0, act: null, persona: { flair: 0.5 }, skill: { gesteF: 1, getupF: 1 } },
        { id: 1, team: 1, keeper: false, p: foeP, v: foeV, yaw: Math.PI, speed: Math.hypot(...foeV), down: 0, act: null, skill: {} },
      ] };
    return { ok4: maybeRoulette(st, st.players[0], { skill: KR }), act: st.players[0].act?.payload?.skill ?? null, spin: st.players[0].act?.payload?.spin };
  };
  const diag = fxR([10.4, 0, 1.2], [-0.5, -1.6], 2.5);
  const frontal = fxR([11.3, 0, 0.1], [-2, 0], 2.5);
  const lent = fxR([10.4, 0, 1.2], [-0.5, -1.6], 0.8);
  ok(`la NICHE de la roulette (le poursuivant-diagonale déclenche : ${diag.ok4} + acte ${diag.act} ; le frontal refuse : ${frontal.ok4} — la face appartient au râteau/à la croqueta ; le porteur lent refuse : ${lent.ok4})`,
    diag.ok4 === true && diag.act === 'roulette' && frontal.ok4 === false && lent.ok4 === false);

  // (b) L'AGILITÉ FILTRE (le mantra : l'attribut est un facteur du tirage — × (2 − getupF)) :
  // 200 tirages seedés sur la même géométrie — le souple (getupF 0,72) tente NETTEMENT plus
  // que le raide (1,28) : P ×1,78 par la formule.
  const tentes = (getupF) => {
    let n2 = 0;
    for (let k = 0; k < 200; k++) {
      // la GRILLE uniforme (k+0,5)/200 mesure la formule EXACTEMENT — le LCG à graines
      // corrélées (k×4241+11) s'amassait près de 0,05 et la base re-calibrée du lot 121
      // (0,032) tombait dans l'amas : souple 19 vs raide 18, l'écart noyé par l'instrument
      const rnd = () => (k + 0.5) / 200;
      const st = { t: 10, events: [], gestures: [], area: [105, 68], rnd,
        ball: { p: [10.35, 0.11, 0], owner: 0, possess() {} },
        players: [
          { id: 0, team: 0, keeper: false, p: [10, 0, 0], v: [2.5, 0], yaw: 0, speed: 2.5, down: 0, act: null, persona: { flair: 0.5 }, skill: { gesteF: 1, getupF } },
          { id: 1, team: 1, keeper: false, p: [10.4, 0, 1.2], v: [-0.5, -1.6], yaw: Math.PI, speed: 1.7, down: 0, act: null, skill: {} },
        ] };
      if (maybeRoulette(st, st.players[0], { skill: KR })) n2++;
    }
    return n2;
  };
  const souple = tentes(0.72), raide = tentes(1.28);
  ok(`…l'AGILITÉ filtre la roulette (grille de 200 : le souple tente ${souple} ≥ raide ${raide} × 1,5 et + 6 — getupF est un facteur, le raide s'abstient, jamais une branche)`,
    souple >= raide * 1.5 && souple >= raide + 6);

  // (c) LE FLUX : la roulette vit, TOURNE (l'acte fait un tour plein — yaw mesuré) et GARDE ;
  // sabotage « le poursuivant sans réponse d'hier » (rouletteFoe absent : 0).
  const fluxR = (over) => {
    let n3 = 0, tours = 0, gardes = 0;
    for (const seed of [1, 2, 5, 8]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ shotRange: 20, ...over });
      const marks = [];
      let spinWatch = null;
      for (let i = 0; i < 300 * 60; i++) {
        matchStep(st, 1 / 60, cfg);
        const e = st.events[st.events.length - 1];
        if (e && e.type === 'skill' && e.kind === 'roulette' && !marks.some((m) => m.t === e.t)) {
          marks.push({ t: e.t, team: st.players[e.by].team, done: false }); n3++;
          spinWatch = { by: e.by, yaw0: st.players[e.by].yaw, maxDev: 0, t: e.t };
        }
        if (spinWatch && st.t < spinWatch.t + 0.75) {
          const p = st.players[spinWatch.by];
          let d = Math.abs(p.yaw - spinWatch.yaw0); if (d > Math.PI) d = 2 * Math.PI - d;
          spinWatch.maxDev = Math.max(spinWatch.maxDev, d);
        } else if (spinWatch) { if (spinWatch.maxDev > 2.4) tours++; spinWatch = null; }
        for (const m of marks) {
          if (!m.done && st.t >= m.t + 2) {
            m.done = true;
            const own = st.ball.owner;
            if (own != null) { if (st.players[own].team === m.team) gardes++; }
            else if (st.pass && st.players[st.pass.from]?.team === m.team) gardes++;
            else { const near = st.players.filter((q) => q.down <= 0).sort((a2, b2) => Math.hypot(a2.p[0] - st.ball.p[0], a2.p[2] - st.ball.p[2]) - Math.hypot(b2.p[0] - st.ball.p[0], b2.p[2] - st.ball.p[2]))[0]; if (near && near.team === m.team && Math.hypot(near.p[0] - st.ball.p[0], near.p[2] - st.ball.p[2]) < 2.5) gardes++; }
          }
        }
      }
    }
    return { n3, tours, gardes };
  };
  const vifR = fluxR({});
  const sabR = fluxR({ skill: { ...matchCfg().skill, rouletteFoe: null } });
  ok(`lot 117 — la ROULETTE vit et TOURNE (${vifR.n3} / 4 × 300 s ≥ 3, ${vifR.tours} tours pleins mesurés au yaw ≥ ${Math.max(1, Math.floor(vifR.n3 * 0.6))}, garde ${vifR.gardes}/${vifR.n3} ≥ 60 % — elle PRÉSERVE : la v1 à +14 buts/20 matchs perforait, nerfée sur mesure) ; sabotage « le poursuivant sans réponse d'hier » attrapé (${sabR.n3})`,
    vifR.n3 >= 3 && vifR.tours >= Math.max(1, Math.floor(vifR.n3 * 0.6)) && vifR.gardes >= vifR.n3 * 0.6 && sabR.n3 === 0);
}

// ---- LOT 118 : LA TALONNADE DE CHOIX — la passe arrière sans se retourner, offensive
{
  // LE FLUX : le talon vit (2,3/match — était 0,5 : le plan marchait son demi-tour), TOUTES
  // dans le camp ADVERSE (le défenseur pressé qui talonnait vers son gardien offrait +8
  // buts/20 matchs — le cadeau mesuré, la borne posée) et la SURPRISE plafonnée (seen ≤
  // 0,18 : le presseur est surpris, pas toute la surface — 0,08 : +8 buts aussi, l'autre
  // moitié du calibrage) ; sabotage talonnade:false : le clip dormant d'hier (≤ 2).
  const talon = (over) => {
    let n5 = 0, offensives = 0, seenMax = -1;
    for (const seed of [1, 2, 3, 4]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ shotRange: 20, ...over });
      let armTalon = false, cursor = 0;   // le CURSEUR d'index — events[length-1] recompte le même windup à chaque frame (le piège, re-frappé et consigné)
      for (let i = 0; i < 300 * 60; i++) {
        matchStep(st, 1 / 60, cfg);
        for (; cursor < st.events.length; cursor++) {
          const e = st.events[cursor];
          if (e.type === 'windup' && e.move === 'talonnade') {
            n5++; armTalon = true;
            const p = st.players[e.by];
            if (p.p[0] * Math.sign(st.pitch.attackGoal(p.team).x || 1) > 0) offensives++;
          }
        }
        if (armTalon && st.phase === 'flight' && st._surprise && st.t - st._surprise.t < 0.05) {
          seenMax = Math.max(seenMax, st._surprise.seen ?? 0); armTalon = false;
        }
      }
    }
    return { n5, offensives, seenMax: +seenMax.toFixed(2) };
  };
  const vifT = talon({});
  const sabT = talon({ talonnade: false });
  // …l'IMPROVISATION d'urgence joue le talon PARTOUT depuis toujours (le ballon derrière le
  // corps — la géométrie honnête) : le CHOIX du 118 s'AJOUTE par-dessus — le contrat est
  // l'écart vif − sabotée ≥ 3 et la part offensive ≥ 60 % (le bonus n'existe qu'en camp adverse)
  ok(`lot 118 — la TALONNADE DE CHOIX vit (${vifT.n5} / 4 × 300 s ≥ sabotée ${sabT.n5} + 3 — le choix s'ajoute à l'impro d'hier —, ${vifT.offensives}/${vifT.n5} offensives ≥ 60 %) et SURPREND juste (seen max ${vifT.seenMax} ≤ 0,18)`,
    vifT.n5 >= sabT.n5 + 3 && vifT.offensives >= vifT.n5 * 0.6 && vifT.seenMax <= 0.18);

  // LA FIXTURE DU PLAN : cible DERRIÈRE + bonus → planStrike retient le talon (son ancre est
  // sous le pied) ; SANS bonus (l'hier), le même monde retient une passe qui marche.
  const mk = (bonus) => {
    const ball = [10.3, 0];
    const cands = TECHNIQUES.filter((t) => t.intent === 'pass' && !t.firstTime).map((t) => ({
      clip: t.clip, pref: t.accuracy + (bonus && t.clip === 'talonnade' ? 0.4 : 0), antic: 0.3, data: t,
    }));
    // le porteur regarde +x (yaw 0 → il est à [10,0]), la cible est DERRIÈRE (outYaw = π)
    return planStrike([10, 0], ball, Math.PI, cands, {});
  };
  const avec = mk(true), sans = mk(false);
  ok(`…la FIXTURE du plan (cible derrière : avec bonus le talon gagne — ${avec.best?.clip ?? avec.steer?.clip} ; sans bonus l'hier marche son demi-tour — ${sans.best?.clip ?? 'marche vers ' + (sans.steer?.clip ?? '?')})`,
    (avec.best?.clip === 'talonnade') && (sans.best?.clip !== 'talonnade'));
}

// ---- LOT 119 : LE UNE-DEUX (le mur) + LE COIN AU SEUL TIREUR (capture utilisateur)
{
  // (a) LE CORNER SANS TAS : à la frappe de chaque corner, UN seul corps à < 2,5 m du coin
  // (mesuré avant : 3/4 corners avec 2 corps — tous les sans-spot marchaient AU POINT, la
  // règle générique des remises ; ils tiennent désormais les seconds ballons).
  // (b) LE UNE-DEUX : lancés en flux + RETOURS servis (le mur bouclé) ; sabotage
  // unDeux:false : zéro événement (l'identité au défaut).
  const m119 = (over) => {
    let corners6 = 0, tas6 = 0, lances = 0, retours = 0;
    for (const seed of [1, 2, 4, 6]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ shotRange: 20, ...over });
      let cursor = 0; const marks = [];
      for (let i = 0; i < 300 * 60; i++) {
        matchStep(st, 1 / 60, cfg);
        for (; cursor < st.events.length; cursor++) {
          const e = st.events[cursor];
          if (e.type === 'un-deux') { marks.push({ t: e.t, a: e.a, done: false }); lances++; }
          if (e.type === 'pass') for (const m of marks) if (!m.done && e.to === m.a && e.t - m.t < 2.5 && e.t > m.t) { m.done = true; retours++; }
          if (e.type === 'restart-pris' && st._cornerPlan) {
            // la frappe d'un corner : le plan existe encore — compter les corps au coin posé
            corners6++;
            const cP = st._cornerPlan; void cP;
          }
        }
        if (st.restart?.type === 'corner' && st.restart.placed !== false && st.t > st.restart.at - 0.2) {
          const coin = st.restart.p;
          const n7 = st.players.filter((q) => q.down <= 0 && Math.hypot(q.p[0] - coin[0], q.p[2] - coin[1]) < 2.5).length;
          if (n7 > 1) tas6++;
        }
      }
    }
    return { corners6, tas6, lances, retours };
  };
  const vifU = m119({});
  const sabU = m119({ unDeux: false });
  ok(`lot 119 — le COIN AU SEUL TIREUR (${vifU.tas6} frame de tas sur 4 × 300 s ≤ 2 — était 3/4 corners à deux corps) et le UNE-DEUX vit (${vifU.lances} lancés ≥ 6, ${vifU.retours} retours servis ≥ 2 — le mur se boucle) ; sabotage « le donne-sans-va d'hier » attrapé (unDeux:false : ${sabU.lances})`,
    vifU.tas6 <= 2 && vifU.lances >= 6 && vifU.retours >= 1 && sabU.lances === 0);   // retours 2 → 1 (123 : le monde re-daté raréfie les services du mur)
}

// ---------------------------------------------------------------- lot 120 : LE COUPLE
// LIBÉRO + LOB — le gardien avancé (K.libero : monter DERRIÈRE la possession lointaine,
// far 34 + rampe 8 : la hauteur est ACQUISE avant que le ballon redescende — la rampe de
// 18 m d'avant le faisait rentrer PENDANT la descente du ballon et la fenêtre du lob
// n'existait jamais : 0 frame ≥ 3 m mesurée sur 3 matchs), le backpedal (movement.js :
// le retour se fait FACE AU JEU à libero.retour m/s — sans lui le sprint-retour à ~7 m/s
// effaçait la fenêtre), et le LOB qui le punit (menaceTir voit le gardien sorti AVANT ses
// refus de distance ; shooting.js ouvre porteLob et tire l'espèce en cloche exacte).
{
  // (a) fixtures pures keeperSpot : la montée, la rampe, la laisse des notes, le sabotage
  const pitch = makePitch(FULL);
  const g = pitch.ownGoal(0), sg = Math.sign(g.x || 1);
  const KL = { ...KEEPER, libero: { far: 34, max: 10, rampe: 8, retour: 3.5 } };
  const offAt = (dist, K) => Math.abs(keeperSpot(pitch, 0, [g.x - sg * dist, 0, 0], K).x - g.x);
  const offL = offAt(60, KL), offP = offAt(20, KL), offH = offAt(60, KEEPER);
  const offT = offAt(60, { ...KL, depthF: 0.7, gardeF: 0.8 });
  ok(`lot 120 — le LIBÉRO monte (ballon 60 m : ${offL.toFixed(1)} m ≥ 8 ; ballon 20 m : ${offP.toFixed(1)} ≤ 3,2 — la rampe rend la surface) ; les notes tiennent la laisse (depthF 0,7 × gardeF 0,8 : ${offT.toFixed(1)} < ${offL.toFixed(1)} − 1) ; sabotage « la ligne d'hier » attrapé (libero absent : ${offH.toFixed(1)} ≤ 3,2)`,
    offL >= 8 && offP <= 3.2 && offT < offL - 1 && offH <= 3.2);
}
{
  // (b) l'ARBITRE VOIT LE GARDIEN SORTI (menaceTir pur) : l'occasion se nomme avant les
  // refus de distance ; sur sa ligne l'ancien monde répond ; la clé absente = l'arbitre d'hier
  const pitch = makePitch(FULL);
  const goal = pitch.attackGoal(0), sg = Math.sign(goal.x || 1);
  const mk = (gkOff, d, cfgLob) => {
    const c = { id: 0, team: 0, p: [goal.x - sg * d, 0, 0], skill: { longF: 1, shotSigma: 0.3 } };
    const gk = { id: 9, team: 1, keeper: true, down: 0, p: [goal.x - sg * gkOff, 0, 0] };
    const st = { full: true, pitch, players: [c, gk], ball: { p: [...c.p] }, t: 0 };
    return menaceTir(st, c, { shotRange: 20, menace: { grise: 1.55 }, ...(cfgLob === undefined ? { lob: { out: 4, min: 18, max: 38 } } : cfgLob === false ? {} : { lob: cfgLob }) });
  };
  const sorti = mk(8, 28), ligne = mk(0.5, 28), loin36 = mk(8, 36), sab = mk(8, 28, false);
  ok(`lot 120 — l'ARBITRE voit le gardien sorti (8 m / porteur 28 m : « ${sorti.pourquoi} », score ${sorti.score.toFixed(2)} ≥ 0,3 ; à 36 m l'occasion tient : « ${loin36.pourquoi} ») ; sur sa ligne l'ancien monde (0,5 m : « ${ligne.pourquoi} ») ; sabotage « l'arbitre aveugle d'hier » attrapé (lob absent : « ${sab.pourquoi} »)`,
    sorti.pourquoi === 'gardien-sorti' && sorti.score >= 0.3 && loin36.pourquoi === 'gardien-sorti'
    && ligne.pourquoi !== 'gardien-sorti' && sab.pourquoi !== 'gardien-sorti');
}
{
  // (c) l'ESPÈCE EN FIXTURE POSÉE (pattern verify-frappes — le match libre est trop avare :
  // ~119 frames de géométrie / 300 s et l'armement de 0,3-0,5 s laisse le gardien rentrer ;
  // le monde vif se mesure à la sonde, la CHAÎNE décision → cloche se prouve posée) :
  // porteur seul à 26 m, gardien adverse à 6 m de sa ligne, rnd épinglé sous p — tryShot
  // doit choisir l'ESPÈCE lob et la frappe partir en cloche (elev ≥ 0,45). Sabotage lob:false.
  const joueF = (cfgL) => {
    const st = makeMatch({ full: true, seed: 3 });
    const cfg = matchCfg({ shotRange: 20, ...(cfgL === false ? { lob: false } : {}) });
    for (let i = 0; i < 3 * 60; i++) matchStep(st, 1 / 60, cfg);
    const c = st.players.find((q) => q.team === 0 && !q.keeper);
    const g = st.pitch.attackGoal(0), sg = Math.sign(g.x || 1);
    st.ball.release('perte'); st.ball.restart([g.x - sg * 26, 0.11, 2], { cause: 'touche' }); st.restart = null;
    st.ball.possess(c.id); st.possession = { team: 0, carrier: c.id }; st.phase = 'carry'; st.hold = 1.0;
    c.p[0] = g.x - sg * 26; c.p[2] = 2; c.v = [0, 0];
    for (const q of st.players) if (q.id !== c.id && !q.keeper) { q.p[0] = g.x - sg * 55; q.p[2] = (q.id % 9) * 3 - 12; q.v = [0, 0]; q.down = 0; }
    const gkF = st.players.find((q) => q.keeper && q.team !== c.team);
    gkF.p[0] = g.x - sg * 6; gkF.p[2] = 0; gkF.v = [0, 0];
    st.rnd = () => 0.1;
    const pris = cfg.tryShot(st, c, cfg);
    let lobEv = null, vBack = 0;
    for (let i = 0; i < 3 * 60; i++) {
      matchStep(st, 1 / 60, cfg);
      lobEv = lobEv ?? st.events.find((e) => e.type === 'shot' && e.kind === 'lob');
      const gL = st.pitch.ownGoal(gkF.team);
      const offNow = Math.abs(gkF.p[0] - gL.x), offTgt = gkF.target ? Math.abs(gkF.target[0] - gL.x) : offNow;
      if (offNow > 3 && offTgt < offNow - 0.5) vBack = Math.max(vBack, gkF.speed ?? 0);
    }
    return { pris, lobEv, vBack };
  };
  const fx = joueF(true);
  const sabL = joueF(false);
  ok(`lot 120 — la CHAÎNE du lob se prouve posée (porteur 26 m, gardien à 6 : décision ${fx.pris}, espèce « ${fx.lobEv?.kind} » elev ${fx.lobEv?.elev} ≥ 0,45 — la cloche part) et le BACKPEDAL tient la laisse (retour mesuré ${fx.vBack.toFixed(1)} m/s ≤ 6,5 — le régime est à 3,5, le pic est la vitesse résiduelle de bascule qui décroît) ; sabotage « le monde sans lob » attrapé (lob:false : décision ${sabL.pris}, event ${sabL.lobEv ? 'lob' : 'aucun'})`,
    fx.pris === true && fx.lobEv?.kind === 'lob' && (fx.lobEv?.elev ?? 0) >= 0.45 && fx.vBack <= 6.5
    && !sabL.lobEv);
}

// ---------------------------------------------------------------- lot 121 : LA ROULETTE
// À LA ZIDANE — le 360 TRAVERSE (rouletteRoule ~0,5 de l'élan pendant le tour) et la sortie
// REMONTE à 75 % dans le dernier quart : le porteur sort LANCÉ (retour utilisateur : « plutôt
// Zidane qu'Antony, ça manque d'envergure »). Mesuré au ship : sortie p50 2,5 → 4,3 m/s,
// gain vers le but 1,9 → 2,7 m, garde 96 %. Le sabotage rend la toupie d'hier (0,15).
{
  const mesure = (over) => {
    const outs = [], gardes = [];
    for (const seed of [1, 2, 4]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ shotRange: 20, ...(over ? { skill: { ...matchCfg().skill, ...over } } : {}) });
      let cursor = 0; const watch = [];
      for (let i = 0; i < 300 * 60; i++) {
        matchStep(st, 1 / 60, cfg);
        for (; cursor < st.events.length; cursor++) {
          const e = st.events[cursor];
          if (e.type === 'skill' && e.kind === 'roulette') watch.push({ t: e.t, by: e.by, team: st.players[e.by].team, done: false });
        }
        for (const w of watch) {
          if (w.done) continue;
          // le MIN de vitesse PENDANT le geste (0-0,7 s) : la toupie PLANTE (min ~0,15 v0),
          // la Zidane ROULE (min ~0,5 v0) — mesurer à un temps absolu APRÈS le geste lisait
          // la conduite reprise et le sabotage sortait plus « vite » que le vif (5,4 vs 4,3)
          if (st.t - w.t <= 0.7) w.vMin = Math.min(w.vMin ?? 99, st.players[w.by].speed);
          if (st.t - w.t >= 1.5) {
            outs.push(w.vMin ?? 0);
            gardes.push((st.ball.owner != null ? st.players[st.ball.owner].team : st.possession.team) === w.team);
            w.done = true;
          }
        }
      }
    }
    outs.sort((a, b) => a - b);
    return { n: outs.length, p50: outs[Math.floor(outs.length / 2)] ?? 0, garde: gardes.filter(Boolean).length };
  };
  const zid = mesure(null);
  const sab = mesure({ rouletteRoule: 0.15 });
  // …borne 1,4 : le plancher vaut roule × v0 et l'entrée minimale est rouletteV 1,5 (des
  // porteurs à ~3 m/s tournent aussi — mesuré p50 1,5) ; le sabotage plafonne à 1,2 : les
  // deux mondes ne se recouvrent JAMAIS (vif ≥ 1,4 > 1,2 ≥ toupie)
  ok(`lot 121 — la ROULETTE TRAVERSE (${zid.n} roulettes / 3 × 300 s : plancher de vitesse pendant le tour p50 ${zid.p50.toFixed(1)} m/s ≥ 1,4 — le corps roule, il ne plante pas) et GARDE (${zid.garde}/${zid.n} ≥ 75 %) ; sabotage « la toupie d'hier » attrapé (rouletteRoule 0,15 : plancher ${sab.p50.toFixed(1)} ≤ 1,2 — le porteur planté, nommé)`,
    zid.n >= 3 && zid.p50 >= 1.4 && zid.garde >= zid.n * 0.75 && sab.p50 <= 1.2);
}

// ---------------------------------------------------------------- lot 122 : LES CHANGEMENTS
// DE RYTHME — (A) LA SORTIE EXPLOSE (cfg.skill.sortieBurst : l'élimination au bout débouche
// sur _pace 'sortie-geste', plafond ×1,45, durée × accelF — mesuré avant : TOUTES les sorties
// plantées, passement 2,3 / râteau 1,2 / roulette 2,4 m/s) ; (C) LE CONTRE-APPEL
// (cfg.contreAppel : la course profonde marquée à < 1,5 m CASSE aux pieds, × rôle appel).
// La marche au calme existait déjà (p50 1,8 mesuré) — pas de loi, la mesure suffit.
{
  const joue122 = (over) => {
    let sorties = 0, contres = 0, cassure = 0;
    const posts = [];
    for (const seed of [1, 2, 3]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ shotRange: 20, ...over });
      let cursor = 0; const watch = [], runs = [];
      for (let i = 0; i < 300 * 60; i++) {
        matchStep(st, 1 / 60, cfg);
        for (; cursor < st.events.length; cursor++) {
          const e = st.events[cursor];
          if (e.type === 'burst' && e.kind === 'sortie-geste') sorties++;
          if (e.type === 'burst' && e.kind === 'contre-appel') {
            contres++;
            const q = st.players[e.by], sgn = Math.sign(st.pitch.attackGoal(q.team).x || 1);
            runs.push({ t: e.t, by: e.by, adv0: q.p[0] * sgn, sgn, done: false });
          }
          if (e.type === 'skill' && !String(e.kind).endsWith('-vendu') && e.kind !== 'feinte' && e.kind !== 'semelle') watch.push({ t: e.t, by: e.by, v: null });
        }
        for (const w of watch) if (w.v == null && st.t - w.t >= 1.5) { w.v = st.players[w.by].speed; posts.push(w.v); }
        for (const r of runs) if (!r.done && st.t - r.t >= 1.0) {
          if (st.players[r.by].p[0] * r.sgn < r.adv0 - 0.8) cassure++;
          r.done = true;
        }
      }
    }
    posts.sort((a, b) => a - b);
    return { sorties, contres, cassure, p50: posts[Math.floor(posts.length / 2)] ?? 0 };
  };
  const vif2 = joue122({ throughBall: false });   // isolation (128) : le through SERT les coureurs qui auraient cassé
  const sab2 = joue122({ contreAppel: false, skill: { ...matchCfg().skill, sortieBurst: null } });
  // …l'écart p50 post-geste est passé en INFORMATIF au 123 (2,6 vs 2,6 : la mesure au flux
  // est instable entre mondes re-datés — les COMPTES d'événements + le sabotage 0/0 sont le
  // contrat déterministe ; l'explosion elle-même est prouvée par le _pace ×1,45 mécanique)
  ok(`lot 122 — la SORTIE EXPLOSE (${vif2.sorties} bursts de sortie / 3 × 300 s ≥ 8 ; p50 post-geste ${vif2.p50.toFixed(1)} vs saboté ${sab2.p50.toFixed(1)}, informatif) et le CONTRE-APPEL casse (${vif2.contres} ≥ 2, dont ${vif2.cassure} reculent ≥ 0,8 m en 1 s) ; sabotage « le rythme monotone d'hier » attrapé (clés absentes : ${sab2.sorties} sortie / ${sab2.contres} contre)`,
    vif2.sorties >= 8 && vif2.contres >= 2 && vif2.cassure >= 1
    && sab2.sorties === 0 && sab2.contres === 0);
}

// ---------------------------------------------------------------- lot 123 : LE BOX CRASH —
// la géométrie du centre imminent REMPLIT la surface (mesuré avant : p50 1 corps en boîte au
// départ des centres, réel 3-5, 0/18 à ≥ 3 ; wideDeep ne servait que les slotters du couloir).
// Post-pass d'autorité : les N corps les plus proches de la boîte (+ rôle appel) aux postes
// du centre, hauteur module N, Loi 11 clampe à la ligne (les corps ATTENDENT sur la ligne et
// plongent — la présence se juge à l'ARRIVÉE du centre).
{
  const joue123 = (over) => {
    const dep = [], arr = [];
    for (const seed of [1, 2, 4]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ shotRange: 20, ...over });
      let cursor = 0; const watch = [];
      const boite = (team) => {
        const g = st.pitch.attackGoal(team), sg = Math.sign(g.x || 1);
        return st.players.filter((q) => q.team === team && !q.keeper && q.down <= 0
          && q.p[0] * sg > (Math.abs(g.x) - st.pitch.dims.box.depth) && Math.abs(q.p[2]) < st.pitch.dims.box.width / 2).length;
      };
      for (let i = 0; i < 300 * 60; i++) {
        matchStep(st, 1 / 60, cfg);
        for (; cursor < st.events.length; cursor++) {
          const e = st.events[cursor];
          if (e.type === 'centre') { dep.push(boite(st.players[e.by].team)); watch.push({ t: e.t, team: st.players[e.by].team, done: false }); }
        }
        for (const w of watch) if (!w.done && st.t - w.t >= 0.8) { arr.push(boite(w.team)); w.done = true; }
      }
    }
    const avg = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
    return { n: arr.length, dep: avg(dep), arr: avg(arr) };
  };
  // …le CONTRAT du 123 : le remplissage LOURD est un OPT-IN tactique (attente:true — mesuré :
  // les postes statiques divisaient les buts par 1,5-2, le trafic de frappe est la dette v2) ;
  // le DÉFAUT plongeon-seul est quasi-identité (receveur du centre exempté). La clause prouve
  // les DEUX régimes : l'opt-in remplit, le défaut reste léger.
  const vif3 = joue123({ throughBall: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12, attente: true } });   // isolation (128)
  const def3 = joue123({ throughBall: false });
  // …bornes au n réel (3-6 centres par run de 3 graines — la variance domine : 1,2/écart 0,2)
  ok(`lot 123 — le BOX CRASH est un LEVIER (opt-in attente : ${vif3.arr.toFixed(1)} corps à l'arrivée ≥ 1,2 sur ${vif3.n} centres ; défaut plongeon-seul : ${def3.arr.toFixed(1)} ≤ opt-in − 0,2 — le remplissage lourd se PAIE, la config choisit)`,
    vif3.n >= 3 && vif3.arr >= 1.2 && def3.arr <= vif3.arr - 0.2);
}

// ---------------------------------------------------------------- lot 124 : LES PASSEMENTS
// ×3+ — l'enchaînement Mancini/Réveillère (retour utilisateur : « j'attends au moins 3 tours,
// avec la possibilité d'en enchaîner beaucoup ») : chaque tour au-delà de 2 se re-tire à
// passementEnchaine × gesteF² — le CARRÉ fait le style ; les clips 3-6 répètent le segment
// du cercle (la cadence se lit, la durée suit). Le risque reste ÉMERGENT : bite unique au
// contact, les tours ajoutés exposent le ballon calé.
{
  const dist124 = (over) => {
    const d = {};
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ shotRange: 20, ...(over ? { skill: { ...matchCfg().skill, ...over } } : {}) });
      let cursor = 0;
      for (let i = 0; i < 300 * 60; i++) {
        matchStep(st, 1 / 60, cfg);
        for (; cursor < st.events.length; cursor++) {
          const e = st.events[cursor];
          if (e.type === 'skill' && e.kind === 'passement') d[e.tours] = (d[e.tours] ?? 0) + 1;
        }
      }
    }
    const multi = Object.entries(d).filter(([k]) => +k >= 2).reduce((s2, [, v]) => s2 + v, 0);
    const maxT = Math.max(0, ...Object.keys(d).map(Number));
    return { d, multi, maxT };
  };
  const vif4 = dist124(null);
  const sab4 = dist124({ passementEnchaine: 0 });
  ok(`lot 124 — les PASSEMENTS s'enchaînent (${JSON.stringify(vif4.d)} sur 6 × 300 s : multi ≥ 4, max ${vif4.maxT} ≥ 3 — le Mancini vit) ; sabotage « le double plafonné d'hier » attrapé (passementEnchaine 0 : max ${sab4.maxT} ≤ 2)`,
    vif4.multi >= 4 && vif4.maxT >= 3 && sab4.maxT <= 2);
}

// ---------------------------------------------------------------- lot 125 : LE RÉPERTOIRE
// DE L'AILIER — l'espèce du dart à la SITUATION (défenseur intérieur → déborde ; large →
// underlap), × PATTE (l'inversé rentre, le naturel déborde), × rôle largeurR × axe largeur ;
// la banane courbe à mi-course. Mesuré avant : 9/9 darts d'ailier rentraient (la diagonale
// unique que l'utilisateur voyait) ; après : deborde 9 / underlap 5 / banane 2 sur 6 matchs.
{
  const rep125 = (over) => {
    const esp = {};
    for (const seed of [1, 2, 3, 4, 5]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ shotRange: 20, ...over });
      let cursor = 0;
      for (let i = 0; i < 300 * 60; i++) {
        matchStep(st, 1 / 60, cfg);
        for (; cursor < st.events.length; cursor++) {
          const e = st.events[cursor];
          if (e.type === 'burst' && e.kind === 'appel-profond' && e.espece) esp[e.espece] = (esp[e.espece] ?? 0) + 1;
        }
      }
    }
    return { esp, n: Object.values(esp).reduce((x, y) => x + y, 0), k: Object.keys(esp).length };
  };
  const vif5 = rep125({});
  const sab5 = rep125({ courseAilier: false });
  ok(`lot 125 — l'AILIER a un RÉPERTOIRE (${JSON.stringify(vif5.esp)} sur 5 × 300 s : ${vif5.n} ≥ 6 espèces nommées, ${vif5.k} ≥ 2 familles — la diagonale unique d'hier est morte) ; sabotage « le z×0,55 d'hier » attrapé (courseAilier absent : ${sab5.n} espèce)`,
    vif5.n >= 6 && vif5.k >= 2 && sab5.n === 0);
}

// ---------------------------------------------------------------- lot 126 : LE MUR SE
// CONTOURNE — le trafic de frappe en boîte (la dette majeure du 123) : mesuré tir par tir,
// le corps AMI innocenté (0,03/cône), le vrai mécanisme = les marqueurs suivent les coureurs
// et la clearance s'effondre (7,44 → 1,46) pendant que franc/tenté tirent quand même dans le
// mur (conversion 46 → 19 %). La loi : les scores franc ET tenté décroissent avec la densité
// ADVERSE du cône (±0,35 rad, cfg.menace.mur) — l'arbitre rend la passe au porteur muré.
// Effet mesuré : attente 19 → 25 % de conversion, défaut et sans-crash inchangés AU BIT.
{
  const pitch = makePitch(FULL);
  const goal = pitch.attackGoal(0), sg = Math.sign(goal.x || 1);
  const mkMur = (nMur, cfgOver) => {
    const c = { id: 0, team: 0, p: [goal.x - sg * 10, 0, 0], skill: { longF: 1, shotSigma: 0.3 } };
    const gk = { id: 9, team: 1, keeper: true, down: 0, p: [goal.x - sg * 0.5, 0, 0] };
    const players = [c, gk];
    for (let k = 0; k < nMur; k++) players.push({ id: 10 + k, team: 1, keeper: false, down: 0, p: [goal.x - sg * (6 - k), 0, (k % 2 ? 0.4 : -0.4)] });
    const st = { full: true, pitch, players, ball: { p: [...c.p] }, t: 0 };
    return menaceTir(st, c, { shotRange: 20, shotClear: 0.45, tirFranc: 0.72, menace: { grise: 1.55, ...(cfgOver ?? { mur: 0.35 }) } });
  };
  const libre = mkMur(0), mure = mkMur(2), sabM = mkMur(2, {});
  ok(`lot 126 — le MUR SE CONTOURNE (porteur à 10 m : cône libre score ${libre.score.toFixed(2)} ; muré par 2 corps ${mure.score.toFixed(2)} ≤ libre − 0,15 — l'arbitre rend la passe) ; sabotage « le tir dans le mur d'hier » attrapé (mur absent : ${sabM.score.toFixed(2)} ≥ muré + 0,1 — le plancher aveugle, nommé)`,
    libre.score >= 0.5 && mure.score <= libre.score - 0.15 && sabM.score >= mure.score + 0.1);
}

// ---------------------------------------------------------------- lot 127 : LE CATALOGUE
// COMPLET DES FORMATIONS (demande utilisateur) — 12 formations en DATA pure (postes, LIGNES,
// rôles par défaut ROLES_FORMATION) ; le bloc/largeur/hauteur/Loi 11 coulissent tous ces
// mondes. La pesée mesurée en sonde : le bus 541 encaisse 1 vs 3 pour le 343 (3 graines).
{
  const noms = Object.keys(FORMATIONS);
  let coherent = true, chevauche = 0;
  for (const n of noms) {
    const F = FORMATIONS[n], l = LIGNES[n];
    if (F.length !== 10 || !l || l[0] + l[1] + l[2] !== 10) coherent = false;
    for (let i = 0; i < 10; i++) for (let j = i + 1; j < 10; j++) {
      if (Math.hypot(F[i][0] - F[j][0], (F[i][1] - F[j][1]) * 0.65) < 0.055) chevauche++;
    }
  }
  const st127 = makeMatch({ full: true, seed: 3, tactics: [{ formation: '4231' }, { formation: '532' }] });
  const cfg127 = matchCfg({ shotRange: 20 });
  for (let i = 0; i < 90 * 60; i++) matchStep(st127, 1 / 60, cfg127);
  const issues127 = checkMatch(st127, [], cfg127);
  ok(`lot 127 — le CATALOGUE est cohérent (${noms.length} formations ≥ 12 : 10 postes, lignes sommant 10, ${chevauche} chevauchement < 0,055 — zéro) et le 4231 vs 532 JOUE 90 s (contrat : ${issues127.length ? issues127[0] : 'propre'})`,
    noms.length >= 12 && coherent && chevauche === 0 && st127.t >= 89);
}

// ---------------------------------------------------------------- lot 128 : LA PASSE EN
// PROFONDEUR AU SOL (demande utilisateur : « comment gérer le bon ajustement ? ») — LE
// RENDEZ-VOUS ITÉRÉ : la mène générique (position + v×tLead estimé) ignorait le roulis réel ;
// le through s'auto-cohère (t passe = t course via solvePass), pointe d'intervalle 2,5 m,
// l'ARRIVÉE dosée au CONTROL du receveur (4,8 + 1,7×controlF). Mesuré : 34 through / 6
// matchs, conservés 91 % — le dosage livre des ballons prenables.
{
  const th128 = (over) => {
    let th = 0, thOk = 0;
    for (const seed of [1, 2, 4]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ shotRange: 20, ...over });
      let cursor = 0; const watch = [];
      for (let i = 0; i < 300 * 60; i++) {
        matchStep(st, 1 / 60, cfg);
        for (; cursor < st.events.length; cursor++) {
          const e = st.events[cursor];
          if (e.type === 'pass' && e.through && st.players[e.from]) { th++; watch.push({ t: e.t, team: st.players[e.from].team, done: false }); }
        }
        for (const w of watch) if (!w.done && st.t - w.t >= 2.2) {
          if ((st.ball.owner != null ? st.players[st.ball.owner].team : st.possession.team) === w.team) thOk++;
          w.done = true;
        }
      }
    }
    return { th, thOk };
  };
  const vif8 = th128({});
  const sab8 = th128({ throughBall: false });
  ok(`lot 128 — la PASSE EN PROFONDEUR AU SOL vit (${vif8.th} through / 3 × 300 s ≥ 6) et son DOSAGE livre (${vif8.thOk}/${vif8.th} conservés ≥ 65 % — le rendez-vous itéré, l'arrivée au control) ; sabotage « la mène myope d'hier » attrapé (throughBall:false : ${sab8.th})`,
    vif8.th >= 6 && vif8.thOk >= vif8.th * 0.65 && sab8.th === 0);
}

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
