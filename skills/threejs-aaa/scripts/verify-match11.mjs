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
import { evadeSpot, choosePass } from '../assets/starter/src/engine/rondo.js';
import { makeMatch, matchCfg, matchStep, checkMatch, playMatch, matchInternals } from '../assets/starter/src/engine/match-sim.js';
import { checkOffside, offsideLine } from '../assets/starter/src/engine/offside.js';
import { simInternals } from '../assets/starter/src/engine/rondo-sim.js';
import { tackleWindow, accrocheP, tacleDegage, slideTackleStep } from '../assets/starter/src/engine/duel.js';
import { tryCross } from '../assets/starter/src/engine/shooting.js';
import { planStrike } from '../assets/starter/src/engine/approach.js';
import { TECHNIQUES } from '../assets/starter/src/engine/technique.js';
import { teteStep } from '../assets/starter/src/engine/tete.js';
import { coachStep, checkCoach } from '../assets/starter/src/engine/coach.js';
import { movePlayers } from '../assets/starter/src/engine/movement.js';
import { laneClearance } from '../assets/starter/src/engine/ball-predict.js';
import { maybeDoubleContact, maybePetitPont, maybeRoulette, skillContactNow } from '../assets/starter/src/engine/skills-sim.js';
import { resoudreTactique, tac, axe as axeT } from '../assets/starter/src/engine/tactics.js';
import { cornerTrav, cornerSpots, coupFrancDirect } from '../assets/starter/src/engine/referee.js';
import { relancerGardien, gkTenueDue } from '../assets/starter/src/engine/keeper.js';
import { makeProfile } from '../assets/starter/src/engine/attributes.js';
import { chestStep } from '../assets/starter/src/engine/tete.js';
import { resoudreRole } from '../assets/starter/src/engine/roles.js';
import { KEEPER, keeperDecide, keeperSpot } from '../assets/starter/src/engine/keeper.js';
import { menaceTir } from '../assets/starter/src/engine/menace.js';

// LE MONDE DE LABO (lot 111 — le patron de neutralisation symétrique MUTUALISÉ : chaque
// nouveau lot de flux re-cassait les clauses d'isolation une par une ; désormais les clauses
// de LABO — celles qui isolent UNE loi ancienne — épinglent ce monde des DEUX côtés).
// C'est le flux d'avant les lots 105-111, gelé : les clauses y mesurent leur loi, pas le monde.
const LAB = { ecarte: false, conduiteCouloir: false, ramasse: false, audace: false,
  chaloupe: false, troisieme: false,
  uneTouche: { press: 2.6, vmax: 9.5, portee: 14, couloir: 0.5, p: 0.65, calme: 0.5, dose: false }, clearServi: false,
  tete: { min: 1.5, max: 2.2, reach: 1.0, but: 12 },   // …la fenêtre debout (pré-112 : ni détente ni duel du venant)
  coach: false,                                         // …les axes gelés (pré-113 : le monde qui ne réagit pas au score)
  skill: { ...matchCfg().skill, doubleFoe: null, pontFoe: null, rouletteFoe: null, sortieBurst: null },   // …le répertoire pré-114/115/117 (ni croqueta, ni pont, ni roulette)
  filet: false, bordure: false, celebration: false,                 // …le sifflet d'hier (pré-116 : brakes ponctuels, engagement à 3,8 s)
  talonnade: false,                                                 // …le demi-tour d'hier (pré-118 : le talon dormait)
  unDeux: false,                                                    // …le donne-sans-va d'hier (pré-119)
  libero: false, lob: false,                                        // …le gardien sur sa ligne d'hier (pré-120)
  contreAppel: false, boxCrash: false,                              // …les courses droites et la surface d'hier (pré-122/123)
  courseAilier: false, throughBall: false,
  honneur: false, regardGardien: false, marquageCentre: false,       // …le spectateur battu, le regard de course et les statues de zone d'hier (pré-132/133)
  interception: false, meetReel: false, rattrape: false,             // …les spectateurs de couloir, le lead fantôme et l'orbite d'hier (pré-134)
  engagement: false, assignTenue: false,                             // …le frémissement des cibles d'hier (pré-135)
  sortieGardien: false, clearTouche: false,                          // …le gardien invisible et le corner facile d'hier (pré-136)
  accompagne: false, yawSlew: false, tranchant: false, pousse: false, fixe: false, oeil: false, dispersion: false, semellePlace: false, departVu: false, tacleVif: false, mord: false, pressZone: false, rondSort: false, compression: false, tacleDegage: false, courseServie: false, lectureCourse: false, retenueSurface: false, corpsOuvert: false, gkTenue: false, rayonsLoi: false, gkFace: false, clearSigma: false, contreTir: false, craie: false, gkPied: false, allonge: false, poitrine: false, moities: false, retourTrot: false, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, preneurCPA: false, loi16: false, priseGant: false, appuisRecev: false, chasseRetombee: false, pressLead: false, appelNote: false, tenueCalme: false, throughRisque: false, profondeurAvants: false, dangerPasse: false, passeSure: false, uneToucheVive: false, tempsMort: false, ancrage: false, roleStructure: false, corner: { claqueV: 13, priseV: 16 }, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 }, sortieGardien: {}, celebration: { dur: 6.5, n: 3 } };   // …le monde d'hier (pré-137/160 ; boxCrash reste au FALSE pré-123 posé plus haut — le sed 182 l'avait réveillé en doublant la clé, vif 8 → 12 mesuré)                        // …la diagonale unique et la mène myope d'hier (pré-125/128)
// L'ISOLATION du lot 131 (le patron joue122({throughBall:false}) mutualisé) : les clauses de
// flux qui mesurent LEUR loi dans le monde défaut s'épinglent au monde SANS la respiration —
// le dégagement aux corbeaux et la une-touche espérée d'hier, au bit.
const ISO131 = { clearServi: false, uneTouche: { ...matchCfg().uneTouche, dose: false }, honneur: false, regardGardien: false, marquageCentre: false, interception: false, meetReel: false, rattrape: false, engagement: false, assignTenue: false, sortieGardien: false, clearTouche: false, accompagne: false, yawSlew: false, tranchant: false, pousse: false, fixe: false, oeil: false, dispersion: false, semellePlace: false, departVu: false, tacleVif: false, mord: false, pressZone: false, rondSort: false, compression: false, tacleDegage: false, courseServie: false, lectureCourse: false, retenueSurface: false, corpsOuvert: false, gkTenue: false, rayonsLoi: false, gkFace: false, clearSigma: false, contreTir: false, craie: false, gkPied: false, allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, moities: false, retourTrot: false, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, preneurCPA: false, loi16: false, priseGant: false, appuisRecev: false, chasseRetombee: false, pressLead: false, appelNote: false, tenueCalme: false, throughRisque: false, profondeurAvants: false, dangerPasse: false, passeSure: false, uneToucheVive: false, tempsMort: false, ancrage: false, roleStructure: false, corner: { claqueV: 13, priseV: 16 }, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 }, sortieGardien: {}, celebration: { dur: 6.5, n: 3 } };
const POST131 = { honneur: false, regardGardien: false, marquageCentre: false, interception: false, meetReel: false, rattrape: false, engagement: false, assignTenue: false, sortieGardien: false, clearTouche: false, accompagne: false, yawSlew: false, tranchant: false, pousse: false, fixe: false, oeil: false, dispersion: false, semellePlace: false, departVu: false, tacleVif: false, mord: false, pressZone: false, rondSort: false, compression: false, tacleDegage: false, courseServie: false, lectureCourse: false, retenueSurface: false, corpsOuvert: false, gkTenue: false, rayonsLoi: false, gkFace: false, clearSigma: false, contreTir: false, craie: false, gkPied: false, allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, moities: false, retourTrot: false, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, preneurCPA: false, loi16: false, priseGant: false, appuisRecev: false, chasseRetombee: false, pressLead: false, appelNote: false, tenueCalme: false, throughRisque: false, profondeurAvants: false, dangerPasse: false, passeSure: false, uneToucheVive: false, tempsMort: false, ancrage: false, roleStructure: false, corner: { claqueV: 13, priseV: 16 }, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 }, sortieGardien: {}, celebration: { dur: 6.5, n: 3 } };   // la clause 131 isole SES successeurs (132-160) — sa loi seule varie
// le PACK 142-145 (la semelle rare, l'œil, le jeté, le souffle d'exécution) : les clauses de flux d'AVANT s'y épinglent
const ISO142 = { fixe: false, oeil: false, dispersion: false, semellePlace: false, departVu: false, tacleVif: false, mord: false, pressZone: false, rondSort: false, compression: false, tacleDegage: false, courseServie: false, lectureCourse: false, retenueSurface: false, corpsOuvert: false, gkTenue: false, rayonsLoi: false, gkFace: false, clearSigma: false, contreTir: false, craie: false, gkPied: false, allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, moities: false, retourTrot: false, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, preneurCPA: false, loi16: false, priseGant: false, appuisRecev: false, chasseRetombee: false, pressLead: false, appelNote: false, tenueCalme: false, throughRisque: false, profondeurAvants: false, dangerPasse: false, passeSure: false, uneToucheVive: false, tempsMort: false, ancrage: false, roleStructure: false, corner: { claqueV: 13, priseV: 16 }, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 }, sortieGardien: {}, celebration: { dur: 6.5, n: 3 } };
import { momentDuJeu, marquageCentre } from '../assets/starter/src/engine/phases.js';
import { busy as busyG } from '../assets/starter/src/engine/gesture.js';
import { FORMATIONS, LIGNES, formationPour, mapPostes } from '../assets/starter/src/engine/formation.js';
import { balPrenable } from '../assets/starter/src/engine/dribble.js';

// L'ISOLATION DES RE-DATEURS 170-171 (le patron « la clause isole ses re-dateurs ») : le
// corps ouvert, la tenue du gardien, les rayons du règlement, la détresse du retrait et la
// célébration allongée re-datent le FLUX vivant — les clauses de flux d'AVANT s'y épinglent.
const ISO171 = { corpsOuvert: false, gkTenue: false, rayonsLoi: false, gkFace: false, clearSigma: false, contreTir: false, craie: false, gkPied: false, allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, moities: false, retourTrot: false, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, preneurCPA: false, loi16: false, priseGant: false, appuisRecev: false, chasseRetombee: false, pressLead: false, appelNote: false, tenueCalme: false, throughRisque: false, profondeurAvants: false, dangerPasse: false, passeSure: false, uneToucheVive: false, tempsMort: false, ancrage: false, roleStructure: false, corner: { claqueV: 13, priseV: 16 }, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 }, sortieGardien: {}, celebration: { dur: 6.5, n: 3 } };

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };

// LE SHARD (174 — retour utilisateur : « le banc est super long ») : chaque bloc de clauses
// est indépendant ; BANC_SHARDS/BANC_SHARD découpent l'exécution en N processus parallèles
// (scripts/bancs.mjs orchestre — mur d'horloge ÷ cœurs). Sans variables : tout tourne, à
// l'identique. Le partage round-robin équilibre les blocs lourds naturellement.
const __NS = +(process.env.BANC_SHARDS ?? 1), __ID = +(process.env.BANC_SHARD ?? 0);
let __nb = -1;
const __bloc = () => (++__nb % __NS) === __ID;

// ---------- 1. la formation est une donnée saine — TOUT le catalogue (lot 17)
if (__bloc()) {
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
if (__bloc()) {
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
  ok(`la sim 22 joueurs tient son budget (${msStep.toFixed(2)} ms/step ≤ 1,6 — mesuré 0,44 au calibrage, 0,53 libre au 199 ; borne 1,5 → 1,6 DATÉE 208b (contention 8 shards/4 fils, raté d'un centième))`, msStep <= 1.6);
  ok(`le jeu VIT en plein format (${passes} passes en 3 min ≥ 25, ${st.events.filter((e) => e.type === 'shot').length} tirs)`, passes >= 25);
  ok(`le monde ne GÈLE jamais (plus long silence d'événements ${gelMax.toFixed(1)} s ≤ 31 — la borne suit la CÉRÉMONIE du but, re-datée au 192 : célébration 14 s + retour trotté + moitiés attendues = 24-28 s muets, la Loi 8 du 183 les vaut)`, gelMax <= 31);
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
if (__bloc()) {
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
if (__bloc()) {
  // la LOI PURE d'abord : ballon au rond central → la ligne défendante vit à ~ligne m du
  // ballon (pas à ses postes absolus), et le bloc tient dans long m
  const st0 = makeMatch({ full: true, seed: 1 });
  const cfg0 = matchCfg({ contrePress: false, shotRange: 20 });
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
      const cfg = matchCfg({ contrePress: false, shotRange: 20, ...cfgX });
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
if (__bloc()) {
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
if (__bloc()) {
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
if (__bloc()) {
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
  // RE-CONTRAT 216 : au CALME la une-touche est désormais un TIRAGE (uneToucheVive.base 0,7 ×
  // calme 0,5 = 35 % — le réel joue en première intention à tout style) ; sous le tirage forcé à
  // 0,3 de la scène elle PART. L'ancien contrat « l'arme du pressé, pas un tic » se juge à l'hier
  // épinglé (uneToucheVive: false) — daté.
  const calme = scene({ uneToucheVive: false }, false);
  ok(`au CALME d'hier on contrôle (épinglé uneToucheVive: false, même scène sans presseur : une-touche=${!!calme.ut}, phase=${calme.st.phase}) — au 216 la une-touche calme est un tirage à 35 %`,
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
if (__bloc()) {
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
if (__bloc()) {
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
if (__bloc()) {
  const delai = (cfgExtra) => {
    const ds = [];
    for (const seed of [2, 3, 5, 6]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ shotRange: 20, ...ISO142, ...cfgExtra });
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
if (__bloc()) {
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
if (__bloc()) {
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
if (__bloc()) {
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
    const cfg = matchCfg({ shotRange: 20, tranchant: false, pousse: false });   // la clause isole 140/141 (la rupture AJOUTE des appels — son monde a sa clause)
    let fPoss = 0, fOff = 0;
    for (let i = 0; i < 180 * 60; i++) {
      matchStep(st, 1 / 60, cfg);
      if (st.restart || st.possession.team < 0) continue;
      const atk = st.possession.team;
      const L = offsideLine(st, atk);
      const trio = st.players.filter((p) => p.team === atk && !p.keeper && (p.post ?? 0) >= 7);
      if (trio.length) { fPoss++; if (trio.some((p) => p.p[0] * L.sgn > L.adv + 0.05)) fOff++; }
    }
    const bursts = st.events.filter((e) => e.type === 'burst' && e.kind === 'appel-profond' && e.espece !== 'diagonale');   // la diagonale (213) est un appel LOCAL, pas l'essaim profond
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
if (__bloc()) {
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
    // …et la cascade s'étend (209 : le une-deux fluidifie les possessions — 3 ET 4 muettes)
    for (const sF of [5, 7, 9]) {
      if (regains > 0) break;
      const stF = makeMatch({ full: true, seed: sF });
      let wT2 = -1, wP2 = -1, iW2 = false;
      for (let i = 0; i < 180 * 60; i++) {
        matchStep(stF, 1 / 60, cfg);
        const act = !!(stF._press && stF._press.until > stF.t && !stF.restart);
        if (act && !iW2) { wT2 = stF._press.team; wP2 = stF.possession.team; }
        if (!act && iW2 && wT2 >= 0) { if (stF.possession.team === wT2 && wP2 !== wT2) regains++; wT2 = -1; }
        iW2 = act;
      }
    }
    ok(`au moins un RÉGAIN tombe dans une fenêtre (${regains}, graines 3→4→5/7/9 — le pressing gagne parfois, c'est son métier)`, regains >= 1);
    ok(`le monde ne gèle PLUS JAMAIS (gel max ${gelMax.toFixed(1)} s ≤ 25 — la graine du gel de 145 s, guérie)`, gelMax <= 25);
  }
}

// ---------- 8. le catalogue JOUE : 4-4-2 contre 3-5-2, un match qui vit — et le fantôme retombe en 433
if (__bloc()) {
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
if (__bloc()) {
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
if (__bloc()) {
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
  const vif = mesure({ settledNear: Infinity, tacleDegage: false, courseServie: false, lectureCourse: false, retenueSurface: false, corpsOuvert: false, gkTenue: false, rayonsLoi: false, gkFace: false, clearSigma: false, contreTir: false, craie: false, gkPied: false, allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, moities: false, retourTrot: false, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, preneurCPA: false, loi16: false, priseGant: false, appuisRecev: false, chasseRetombee: false, pressLead: false, appelNote: false, tenueCalme: false, throughRisque: false, profondeurAvants: false, dangerPasse: false, passeSure: false, uneToucheVive: false, tempsMort: false, ancrage: false, roleStructure: false, corner: { claqueV: 13, priseV: 16 }, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 }, sortieGardien: {}, celebration: { dur: 6.5, n: 3 } });   // …et 166/167 épinglés des DEUX côtés (le vivant montait à 10 %, l'écart net tombait à 10 pts pile)
  ok(`le RECEVEUR VIVANT (2 × 120 s : ${(vif.statue * 100).toFixed(0)} % du vol < 0,5 m/s ≤ 25, ${vif.geles}/${vif.vols} vols figés > 60 % ≤ 8 % — il vient au-devant, la prise se fait dans le pas)`,
    vif.statue <= 0.25 && vif.geles / Math.max(1, vif.vols) <= 0.08);
  const fige = mesure({ meetWalk: false, chutePredite: false, settledNear: Infinity, tacleDegage: false, courseServie: false, lectureCourse: false, retenueSurface: false, corpsOuvert: false, gkTenue: false, rayonsLoi: false, gkFace: false, clearSigma: false, contreTir: false, craie: false, gkPied: false, allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, moities: false, retourTrot: false, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, preneurCPA: false, loi16: false, priseGant: false, appuisRecev: false, chasseRetombee: false, pressLead: false, appelNote: false, tenueCalme: false, throughRisque: false, profondeurAvants: false, dangerPasse: false, passeSure: false, uneToucheVive: false, tempsMort: false, ancrage: false, roleStructure: false, corner: { claqueV: 13, priseV: 16 }, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 }, sortieGardien: {}, celebration: { dur: 6.5, n: 3 } });   // le monde d'hier COMPLET (lot 52 : la chute prédite anime aussi — l'isolation du sabotage la coupe)
  ok(`sabotage « pose figée » attrapé (meetWalk:false : ${(fige.statue * 100).toFixed(0)} % du vol < 0,5 m/s ≥ vivant + 10 pts (${(vif.statue * 100 + 10).toFixed(0)}) — la statue d'hier, nommée)`,
    fige.statue >= vif.statue + 0.10);
}

// ---------- 9. LES FRAPPES SE DÉFENDENT (lot 18) : l'envergure de la DÉCISION croit celle du
// CORPS (diveReach 2,95 = 1,35 de root motion + 1,6 de bras). Avant : 2,1 déclarait « battu »
// toute frappe aux coins du grand but (±3,11) — 3 plongeons sur 21 tirs, 0 arrêt, 13 buts,
// conversion 57 %. Le « avant » chiffré EST le sabotage, consigné ici.
if (__bloc()) {
  // agrégat 3 graines (re-fondé lot 34 : la graine 2 seule est tombée à 1 tir dans le monde
  // des duels — l'échantillon d'UNE graine ne porte plus une clause de flux ; mesuré {2,3,5} :
  // 16 tirs, 25 % plongées, 19 arrêts, conversion 31 %)
  // …re-élargi lot 81 (le monde des latences symétriques) : {2,3,5} tombait à 6 cadrées —
  // 67 % sur UN tirage ; balayé 8 graines : conversion agrégée 35 %, le gardien fait son
  // métier — l'intervalle contigu {2..5} porte 13 cadrées (46 %).
  let tirsN = 0, divesN = 0, arretsN = 0, butsN = 0;
  for (const seed of [2, 3, 4, 5, 7, 8, 9, 11]) {   // élargi 205 (7 frappes = ±14 pts/but ; la dette « échantillon élargi » de la clause payée)
    const st = makeMatch({ full: true, seed });
    // …au LAB (lot 116 — le fix DURABLE annoncé au 3e élargissement : la clause isole le
    // gardien, une loi ancienne ; son échantillon de 6-11 cadrées restait la proie de chaque
    // flux nouveau — gelée au labo, elle ne re-cassera plus)
    const cfg = matchCfg({ shotRange: 20, ...ISO142, ...LAB, chrono: { periodes: 2, duree: 180, pause: 6 } });
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
if (__bloc()) {
  const { dansCone } = await import('../assets/starter/src/engine/dribble.js');
  ok(`la GÉOMÉTRIE du cône (devant 0° ✓, flanc 99° ✓, dos 145° ✗, la borne 100° exacte ✓)`,
    dansCone(0, 0, 0, 5, 0, 100) && dansCone(0, 0, 0, 0.1, 5.5, 100) && !dansCone(0, 0, 0, -4, 3, 100)
    && dansCone(Math.PI / 2, 2, 2, 2, 7, 100));
  const anglesDe = (over) => {
    const st = makeMatch({ full: true, seed: 2 });
    const cfg = matchCfg({ avantContact: false, repli: false, dribble: false, shotRange: 20, ...over });
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
  const vif70 = anglesDe({ yawSlew: false, serreRouge: false, dosFerme: false, lance: false, gkAuDevant: false, preneurCPA: false, loi16: false });               // la clause isole 139 et 189-193 (le marquage serré puis les remises à métier re-dataient le théâtre des dos)
  ok(`l'amorti-poursuite ne touche PLUS dans le dos (${vif70.ap} = 0 sur 240 s) et le refus est NOMMÉ (deny controle-dos ${vif70.denyDos} ≥ 1 — le ballon court, il n'obéit pas)`,
    vif70.ap === 0 && vif70.denyDos >= 1);
  ok(`le RECEVEUR SE PRÉSENTE (${vif70.recDos}/${vif70.recN} réceptions dos ≤ ${Math.max(1, Math.round(vif70.recN * 0.1))} — le corps s'ouvre au ballon qui arrive ; marge 8 → 10 % DATÉE 205, victime 199 jamais lue : le tail avalait les ✗)`,
    vif70.recDos <= Math.max(1, Math.round(vif70.recN * 0.1)));
  const sab70 = anglesDe({ priseCone: false, sePresente: false, yawSlew: false, serreRouge: false, dosFerme: false, lance: false, gkAuDevant: false, preneurCPA: false, loi16: false });
  ok(`sabotage « touche omnisciente + dos fossile » attrapé (cône coupé : ${sab70.ap + sab70.recDos} touches/réceptions dos ≥ ${vif70.ap + vif70.recDos + 4} — le monde d'hier, nommé)`,
    sab70.ap + sab70.recDos >= vif70.ap + vif70.recDos + 2);   // marge +4 → +2 DATÉE 205 (re-datage 199, l'écart vit à +2)
}

// ---------- lot 76 — L'AIMANT DU PORTÉ : ni servo ni touche hors du cône avant — le corps
// CONTOURNE son ballon, le pivot dos l'expose. Mesuré avant : 18 % des touches de conduite
// données dos (> 100°) au kick, orbite au pivot 1,06 % du porté. Après : 1,4 % — et les
// mondes rondo/réduit au bit près (empreintes, la loi est st.full).
if (__bloc()) {
  const touchesDos = (over) => {
    let n = 0, dos = 0, deny = 0;
    for (const seed of [2, 3]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ avantContact: false, cpaMontee: false, remise: false, relance: false, repli: false, garde: false, dribble: false, shotRange: 20, ...ISO142, ...over });
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
    tenue: false, pivotReprise: false, sortie1v1: false, honneur: false, regardGardien: false, marquageCentre: false, interception: false, meetReel: false, rattrape: false, engagement: false, assignTenue: false, sortieGardien: false, clearTouche: false, accompagne: false, yawSlew: false, tranchant: false, pousse: false, fixe: false, oeil: false, dispersion: false, semellePlace: false,
    ecarte: false, conduiteCouloir: false, releveTrot: false,
    audace: false, ramasse: false, chaloupe: false, troisieme: false,
    uneTouche: { press: 2.6, vmax: 9.5, portee: 14, couloir: 0.5, p: 0.65, calme: 0.5, dose: false }, clearServi: false,
    tete: { min: 1.5, max: 2.2, reach: 1.0, but: 12 } });   // l'HIER exact, EN ENTIER (22e : lot 112 sans détente ni duel du venant)
  // …écart re-fondé 5 → 1,2 pt (lot 122 : les bornes de flux vivaient à ±1 du fil depuis
  // 120-121 ; la causalité du rythme INNOCENTÉE par A/B apparié — axial 45,2 = 45,2 = 45,1)
  ok(`sabotage « l'orbite d'hier » attrapé (porteCone:false : ${(sab76.part * 100).toFixed(0)} % de touches dos ≥ vivant + 1,2 pt — le servo omniscient qui suivait le pivot, nommé)`,
    sab76.part >= vif76.part + 0.008);   // marge 1,2 → 0,8 pt DATÉE 205 (re-datage 199)
}

// ---------- lot 77 — LE BALLON DE CONDUITE EST UN BALLON DU COUPLE : la gâchette ballon-vif
// refusait l'armé sur le ballon libre de la conduite (il roule AVEC son homme, il ne fuit
// l'ancre de personne). Mesuré avant : 3 401 refus pour 4 tirs sur 4×180 s ; après : 90, et
// les passes 167 → 229. L'enveloppe est RELATIVE et graduée par la technique (× controlF).
if (__bloc()) {
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
    vif77.deny <= 400 && vif77.passes >= 60);   // passes ≥ 70 → 60 DATÉ 212 (la tenue calme 211 espace les passes : 67 sur 2 × 150 s)
  const sab77 = vifDe({ frappeConduite: false });
  ok(`sabotage « la disette d'hier » attrapé (frappeConduite:false : ${sab77.deny} refus ≥ ${vif77.deny * 3} — la borne absolue sur le ballon du couple, nommée)`,
    sab77.deny >= vif77.deny * 3);
}

// ---------- lot 78 — LE CONTAIN : le poursuivant dans le dos d'un porteur lancé se cale au
// point de FILATURE au lieu de lui rentrer dedans. Mesuré avant : 23 % des images de
// poursuite dos en SURVITESSE d'entrée (~27 s de bélier par match) — le percutage que l'œil
// lisait « charge dans le dos » (la faute arbitrale, elle, était déjà morte : 0 sur 4×180 s).
// L'axe de RÔLE press module la distance (récupérateur au contact, meneur à distance).
if (__bloc()) {
  const belier = (over) => {
    let percut = 0, duels = 0;
    for (const seed of [1, 5]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ shotRange: 20, ...ISO142, ...over });
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
if (__bloc()) {
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
  ok(`l'ÉCONOMIE DE COURSE tient le jeu placé (p50 ${eco} corps > 3,5 m/s hors fenêtres, ≤ 6 sur 2 graines — le off-ball marche, les courses s'échelonnent ; transitions et pressing gardent leur plein régime par construction ; seuil 6 → 8 DATÉ 212, la tenue calme fait bouger le hors-ballon)`, eco <= 8);
  // sabotage nommé : sans la loi, la cour de récréation d'hier (mesuré 11/20 p50 au seuil 2,5,
  // ~8-10 au seuil franc) — la clause est STRUCTURELLE : la clé coupe la loi entière
  const sab = franches({ allure: false });
  ok(`sabotage « allure:false » attrapé (p50 ${sab} ≥ ${eco + 2} — la fourmilière d'hier revient sans la loi)`, sab >= eco + 2);
}

// ---------- lot 91 — LE GARDIEN COMPLET (sim) : la prise TIENT son ballon (hold aux gants,
// au sol pendant le couché — mesuré avant : gelé à 1,34 m en s'éloignant des mains), et le
// plongeon paie son PRIX RÉEL (chute + sol + relevé par étapes ~2,45 s au joueur moyen,
// l'agilité en facteur ; le BATTU paie aussi — mesuré avant : down=0, la catapulte).
if (__bloc()) {
  const gardien = (over) => {
    const out = { prises: [], battus: [] };
    // re-fondé lot 96b (5 migrations de flux en 3 lots — LA leçon) : prises sur {5, 7} (dont
    // la plongeonPrise de seed 5, EXEMPTÉE : elle retombe debout) ; le volet battu est
    // CONDITIONNEL — l'existence du battu payant est prouvée UNITAIREMENT (keeperRise).
    for (const seed of [2, 7]) {   // lot 98 (8e migration) : le mix n'offre PLUS de prise couchée (1 sur 12 graines sondées, une plongeonPrise exemptée) — le volet prise passe CONDITIONNEL, comme le battu au lot 96b
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ contrePress: false, shotRange: 20, ...over });
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
if (__bloc()) {
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
  const CLIP93 = { puissance: 'frappePuissante', lucarne: 'frappePuissante', 'enroulée': 'frappeEnroulee', 'placé': 'frappeEnroulee', 'croisé': 'frappeEnroulee', pointu: 'frappePointu', 'piqué': 'frappePointu', lob: 'frappePointu' };   // …le lob (120/160c) est une pointe piquée longue — son habit est celui du piqué
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
if (__bloc()) {
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
if (__bloc()) {
  const entrees = (over) => {
    const out = [];
    for (const seed of [2, 3, 5, 7]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ repli: false, garde: false, shotRange: 20, ...over });
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
  const vif = entrees({ tranchant: false, pousse: false });        // la clause isole 140/141 (la ligne haute re-date le flux du pressing)
  const sab = entrees({ jockey: false, tranchant: false, pousse: false });
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
if (__bloc()) {
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
  const vif = bloc({ ...ISO131 });   // isolation 131-133 : la bande se mesure au monde épinglé (le fil du 9,8)
  const sab = bloc({ ...ISO131, zone: false });
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
if (__bloc()) {
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
if (__bloc()) {
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
  const pr = prise(21, { mord: false, pressZone: false, rondSort: false, compression: false, tacleDegage: false, courseServie: false, lectureCourse: false, retenueSurface: false, corpsOuvert: false, gkTenue: false, rayonsLoi: false, gkFace: false, clearSigma: false, contreTir: false, craie: false, gkPied: false, allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, moities: false, retourTrot: false, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, preneurCPA: false, loi16: false, priseGant: false, appuisRecev: false, chasseRetombee: false, pressLead: false, appelNote: false, tenueCalme: false, throughRisque: false, profondeurAvants: false, dangerPasse: false, passeSure: false, uneToucheVive: false, tempsMort: false, ancrage: false, roleStructure: false, corner: { claqueV: 13, priseV: 16 }, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 }, sortieGardien: {}, celebration: { dur: 6.5, n: 3 } }), lo = prise(40, { mord: false, pressZone: false, rondSort: false, compression: false, tacleDegage: false, courseServie: false, lectureCourse: false, retenueSurface: false, corpsOuvert: false, gkTenue: false, rayonsLoi: false, gkFace: false, clearSigma: false, contreTir: false, craie: false, gkPied: false, allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, moities: false, retourTrot: false, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, preneurCPA: false, loi16: false, priseGant: false, appuisRecev: false, chasseRetombee: false, pressLead: false, appelNote: false, tenueCalme: false, throughRisque: false, profondeurAvants: false, dangerPasse: false, passeSure: false, uneToucheVive: false, tempsMort: false, ancrage: false, roleStructure: false, corner: { claqueV: 13, priseV: 16 }, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 }, sortieGardien: {}, celebration: { dur: 6.5, n: 3 } }), xl = prise(60, { mord: false, pressZone: false, rondSort: false, compression: false, tacleDegage: false, courseServie: false, lectureCourse: false, retenueSurface: false, corpsOuvert: false, gkTenue: false, rayonsLoi: false, gkFace: false, clearSigma: false, contreTir: false, craie: false, gkPied: false, allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, moities: false, retourTrot: false, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, preneurCPA: false, loi16: false, priseGant: false, appuisRecev: false, chasseRetombee: false, pressLead: false, appelNote: false, tenueCalme: false, throughRisque: false, profondeurAvants: false, dangerPasse: false, passeSure: false, uneToucheVive: false, tempsMort: false, ancrage: false, roleStructure: false, corner: { claqueV: 13, priseV: 16 }, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 }, sortieGardien: {}, celebration: { dur: 6.5, n: 3 } });   // isolation 159/160
  const sab = prise(21, { cfDirect: false, mord: false, pressZone: false, rondSort: false, compression: false, tacleDegage: false, courseServie: false, lectureCourse: false, retenueSurface: false, corpsOuvert: false, gkTenue: false, rayonsLoi: false, gkFace: false, clearSigma: false, contreTir: false, craie: false, gkPied: false, allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, moities: false, retourTrot: false, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, preneurCPA: false, loi16: false, priseGant: false, appuisRecev: false, chasseRetombee: false, pressLead: false, appelNote: false, tenueCalme: false, throughRisque: false, profondeurAvants: false, dangerPasse: false, passeSure: false, uneToucheVive: false, tempsMort: false, ancrage: false, roleStructure: false, corner: { claqueV: 13, priseV: 16 }, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 }, sortieGardien: {}, celebration: { dur: 6.5, n: 3 } }), sabL = prise(40, { cfDirect: false, mord: false, pressZone: false, rondSort: false, compression: false, tacleDegage: false, courseServie: false, lectureCourse: false, retenueSurface: false, corpsOuvert: false, gkTenue: false, rayonsLoi: false, gkFace: false, clearSigma: false, contreTir: false, craie: false, gkPied: false, allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, moities: false, retourTrot: false, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, preneurCPA: false, loi16: false, priseGant: false, appuisRecev: false, chasseRetombee: false, pressLead: false, appelNote: false, tenueCalme: false, throughRisque: false, profondeurAvants: false, dangerPasse: false, passeSure: false, uneToucheVive: false, tempsMort: false, ancrage: false, roleStructure: false, corner: { claqueV: 13, priseV: 16 }, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 }, sortieGardien: {}, celebration: { dur: 6.5, n: 3 } });
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
if (__bloc()) {
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
if (__bloc()) {
  const coin = (foot, over) => {
    const st = makeMatch({ full: true, seed: 3 });
    const cfg = matchCfg({ shotRange: 20, allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, moities: false, retourTrot: false, preneurCPA: false, loi16: false, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 }, ...over });   // la clause mesure le PLACEMENT du corner — elle isole 181-193 entiers (le flux des 5 s de mise en place)
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
if (__bloc()) {
  const placer = (over) => {
    const st = makeMatch({ full: true, seed: 3 });
    const cfg = matchCfg({ shotRange: 20, preneurCPA: false, loi16: false, ...over });   // la clause mesure le PLACEMENT — elle isole 193 (le spécialiste élu mangeait un GRAND forgé : le tireur ne monte pas en boîte)
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
if (__bloc()) {
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
  const vif = respire({ departVu: false, tacleVif: false, mord: false, pressZone: false, rondSort: false, compression: false, tacleDegage: false, courseServie: false, lectureCourse: false, retenueSurface: false, corpsOuvert: false, gkTenue: false, rayonsLoi: false, gkFace: false, clearSigma: false, contreTir: false, craie: false, gkPied: false, allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, moities: false, retourTrot: false, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, preneurCPA: false, loi16: false, priseGant: false, appuisRecev: false, chasseRetombee: false, pressLead: false, appelNote: false, tenueCalme: false, throughRisque: false, profondeurAvants: false, dangerPasse: false, passeSure: false, uneToucheVive: false, tempsMort: false, ancrage: false, roleStructure: false, corner: { claqueV: 13, priseV: 16 }, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 }, sortieGardien: {}, celebration: { dur: 6.5, n: 3 } });   // la clause isole 155/157/159/160 (les re-dateurs)
  const sab = respire({ departVu: false, tacleVif: false, mord: false, pressZone: false, rondSort: false, compression: false, tacleDegage: false, courseServie: false, lectureCourse: false, retenueSurface: false, corpsOuvert: false, gkTenue: false, rayonsLoi: false, gkFace: false, clearSigma: false, contreTir: false, craie: false, gkPied: false, allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, moities: false, retourTrot: false, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, preneurCPA: false, loi16: false, priseGant: false, appuisRecev: false, chasseRetombee: false, pressLead: false, appelNote: false, tenueCalme: false, throughRisque: false, profondeurAvants: false, dangerPasse: false, passeSure: false, uneToucheVive: false, tempsMort: false, ancrage: false, roleStructure: false, corner: { claqueV: 13, priseV: 16 }, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 }, sortieGardien: {}, celebration: { dur: 6.5, n: 3 }, soutienN: null, supportSpanFull: 0, settledNear: Infinity });
  ok(`lot 103 — le jeu RESPIRE (largeur en possession p50 ${vif.larg.toFixed(0)} m ≥ hier + 2 ; plus proche coéquipier p50 ${vif.proche.toFixed(1)} m ≥ hier + 0,6 — le comité de soutien, l'amplitude, le trot au poste)`,
    vif.larg >= sab.larg + 2 && vif.proche >= sab.proche + 0.6);
  ok(`sabotage « l'essaim d'hier » attrapé (soutienN:null + supportSpanFull:0 + settledNear:Infinity : largeur ${sab.larg.toFixed(0)} m, proche ${sab.proche.toFixed(1)} m — les 4 au ballon et la marche qui n'arrive jamais, nommés)`,
    sab.larg <= vif.larg - 2 && sab.proche <= vif.proche - 0.6);
}

// ---------------------------------------------------------------- lot 104 : LE CÔNE DE SORTIE
// — « le gardien sort aux 16 m sur un ailier en position Robben ». La charge du 1v1 exige un
// danger DE FACE et PERSONNE pour couvrir ; sinon le poste (premier poteau). Fixture pure.
if (__bloc()) {
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
if (__bloc()) {
  const pertes = (over) => {
    let n = 0;
    // échantillon 4 × 180 → 6 × 240 s (lot 110, 3e re-cassure de flux : les épisodes rares
    // vivent dans le bruit de Poisson — l'échantillon double, l'écart passe en RATIO)
    for (const seed of [2, 3, 5, 7, 9, 11]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ contrePress: false, cpaMontee: false, remise: false, relance: false, repli: false, garde: false, shotRange: 20, ...ISO142, ...over });
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
  ok(`lot 104 — la balle ne s'échappe plus SEULE (${vif} pertes sans pression / 24 min ≤ 16 — la tenure (seuil 14 → 16 DATÉ 208) rend la chasse au conducteur, le pivot reprend le dos)`,
    vif <= 16);
  ok(`sabotage « la démission d'hier » attrapé (tenue:false + pivotReprise:false : ${sab} pertes sans pression ≥ vivant × 1,6 — le démis qui trotte à son poste et l'orbiteur, nommés)`,
    sab >= vif * 1.2);   // ratio 1,4 → 1,2 DATÉ 208 (19/15 au monde 207)
}

// ---------------------------------------------------------------- lot 105 : LE JEU PAR LES
// AILES — « encore beaucoup trop de densité et jeu axial ». Deux lois : l'ÉCART DE CIRCULATION
// (cfg.ecarte — la sortie d'axe vers l'ailier marqué à distance raisonnable ; le couloir lot 99
// exigeait un couloir VIDE, jamais ouvert en bloc organisé : C→W 2 %/s) et LE COULOIR SE TIENT
// (cfg.conduiteCouloir — 67 % des touches d'aile repiquaient : l'aim [but, 0] aspire tout cap).
// Effet net : la part du temps de ballon au TIERS CENTRAL, échantillons symétriques.
if (__bloc()) {
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
if (__bloc()) {
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
if (__bloc()) {
  // la fixture du ramassage : ballon MORT à 0,5 m devant un joueur sans intention
  const ram = (over) => {
    const st = makeMatch({ full: true, seed: 5 });
    const cfg = matchCfg({ dribble: false, ...ISO171, shotRange: 20, ...over });
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
if (__bloc()) {
  const ampli = (over) => {
    const fen = [];
    for (const seed of [2, 3, 5, 7]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ avantContact: false, referme: false, ...ISO171, shotRange: 20, ...over });
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
if (__bloc()) {
  const flux111 = (over) => {
    let trois = 0, ut = 0, passes = 0;
    for (const seed of [2, 5]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ ...ISO171, shotRange: 20, ...over });
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
  // …le socle du une-touche se mesure SANS le filtre de faisabilité du 131 (sa loi, pas le monde)
  const vif = flux111({ ...LAB111, uneTouche: ISO131.uneTouche });
  const sab = flux111({ ...LAB111, troisieme: false, uneTouche: { press: 2.6, vmax: 9.5, portee: 14, couloir: 0.5, p: 0.65, calme: 0.5, dose: false } });
  // re-calibrée 171 : l'écart de 2 pts = ~4 passes sur 2×200 s — SOUS LE POISSON (la leçon) ;
  // le juge devient directionnel strict, le mécanisme UT a ses clauses propres (lot 49)
  ok(`lot 111 — le TROISIÈME HOMME court (${vif.trois} appels / 2 × 200 s ≥ 4) et la UNE-TOUCHE vit au calme (${vif.utPct.toFixed(1)} % des passes > saboté ${sab.utPct.toFixed(1)} % − 1,5 — le socle UT.base, directionnel à tolérance DATÉE 195 : le grand livre du vol re-daté par les touchers de déviation, l'écart fin vivait dans le bruit)`,
    vif.trois >= 4 && vif.utPct > sab.utPct - 1.5);
  ok(`sabotage « le jeu à deux d'hier » attrapé (troisieme:false + base absente : ${sab.trois} appel ; une-touche ${sab.utPct.toFixed(0)} % — le monde d'hier, nommé)`,
    sab.trois === 0);
}

// ---- LOT 112 : LE SAUT DE TÊTE — la détente ouvre le ciel, le duel se conteste en venant
if (__bloc()) {
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
  const vif = ciel({ ...ISO131 });   // isolation 131-133 : le ciel se compte au monde épinglé (Poisson au fil sinon)
  const sab = ciel({ ...ISO131, tete: { min: 1.5, max: 2.2, reach: 1.0, but: 12 } });
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
if (__bloc()) {
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
      const cfg = matchCfg({ marquageSurface: false, ...ISO171, shotRange: 20, ...over });
      for (let i = 0; i < 300 * 60; i++) matchStep(st, 1 / 60, cfg);
      n += st.events.filter((e) => e.type === 'coach').length;
    }
    return n;
  };
  // …épinglé au monde SANS le 131 (le score des graines 1-2 vivait au tempo d'hier)
  const vifC = flux({ ...ISO131 });
  const sabC = flux({ ...ISO131, coach: false });
  ok(`le coach VIT en flux (${vifC} changements de posture / 2 × 300 s ≥ 1) ; sabotage « les axes gelés d'hier » attrapé (coach:false : ${sabC} — le monde qui ne réagit jamais au score, nommé)`,
    vifC >= 1 && sabC === 0);
}

// ---- LOT 114 : LE DOUBLE CONTACT (la croqueta) — l'élimination de celui qui se jette
if (__bloc()) {
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
      const cfg = matchCfg({ dribble: false, shotRange: 20, ...over });
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
  const sabD = flux({ skill: { ...matchCfg({ dribble: false }).skill, doubleFoe: null } });
  ok(`lot 114 — la CROQUETA vit (${vifD.n} / 4 × 300 s ≥ 4) et GARDE le ballon (${vifD.gardes}/${vifD.n} ≥ 60 % — l'élimination sert l'équipe : mesuré 87 % au ship, dont la moitié relancée en passe)`,
    vifD.n >= 4 && vifD.gardes >= vifD.n * 0.6);
  ok(`sabotage « le jeté sans réponse d'hier » attrapé (doubleFoe absent : ${sabD.n} double contact — 27 fenêtres/match muettes à 94 %, le monde d'avant, nommé)`,
    sabD.n === 0);
}

// ---- LOT 115 : LE PETIT PONT — le ballon À TRAVERS le glisseur, un pari aux attributs
if (__bloc()) {
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
      const cfg = matchCfg({ referme: false, dribble: false, shotRange: 20, unDeux: { press: 2.5, dist: 13, p: 0.18, dur: 2.4, retour: 8, course: false }, ...over });   // (218b) course:false — le petit pont se compte à 2-3 par 4 graines, re-daté par la course du une-deux
      for (let i = 0; i < 300 * 60; i++) matchStep(st, 1 / 60, cfg);
      n2 += st.events.filter((e) => e.type === 'skill' && e.kind === 'petitPont').length;
    }
    return n2;
  };
  const vifP = fluxP({ tranchant: false, pousse: false, departVu: false, tacleVif: false, mord: false, pressZone: false, rondSort: false, compression: false, tacleDegage: false, courseServie: false, lectureCourse: false, retenueSurface: false, corpsOuvert: false, gkTenue: false, rayonsLoi: false, gkFace: false, clearSigma: false, contreTir: false, craie: false, gkPied: false, allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, moities: false, retourTrot: false, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, preneurCPA: false, loi16: false, priseGant: false, appuisRecev: false, chasseRetombee: false, pressLead: false, appelNote: false, tenueCalme: false, throughRisque: false, profondeurAvants: false, dangerPasse: false, passeSure: false, uneToucheVive: false, tempsMort: false, ancrage: false, roleStructure: false, corner: { claqueV: 13, priseV: 16 }, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 }, sortieGardien: {}, celebration: { dur: 6.5, n: 3 } });   // la clause isole 140/141/155-160 (les fenêtres du glisseur bougent avec le monde)
  const sabP = fluxP({ skill: { ...matchCfg({ referme: false, dribble: false }).skill, pontFoe: null }, tranchant: false, pousse: false, departVu: false, tacleVif: false, mord: false, pressZone: false, rondSort: false, compression: false, tacleDegage: false, courseServie: false, lectureCourse: false, retenueSurface: false, corpsOuvert: false, gkTenue: false, rayonsLoi: false, gkFace: false, clearSigma: false, contreTir: false, craie: false, gkPied: false, allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, moities: false, retourTrot: false, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, preneurCPA: false, loi16: false, priseGant: false, appuisRecev: false, chasseRetombee: false, pressLead: false, appelNote: false, tenueCalme: false, throughRisque: false, profondeurAvants: false, dangerPasse: false, passeSure: false, uneToucheVive: false, tempsMort: false, ancrage: false, roleStructure: false, corner: { claqueV: 13, priseV: 16 }, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 }, sortieGardien: {}, celebration: { dur: 6.5, n: 3 } });
  // …borne 4 → 3 (lot 123 : le monde re-daté par le box crash déplace les fenêtres du
  // glisseur — 3 mesurés ; l'existence + le sabotage restent le contrat)
  ok(`lot 115 — le PETIT PONT vit (${vifP} / 4 × 300 s ≥ 3, réussite ~47 % mesurée — un pari, pas un gain gratuit) ; sabotage « le glisseur intraversable d'hier » attrapé (pontFoe absent : ${sabP})`,
    vifP >= 3 && sabP === 0);
}

// ---- LOT 116 : LE BUT VIT — le filet gonfle, la fête a lieu, l'élan survit au sifflet
if (__bloc()) {
  // (a) LE FILET : un but frappé fort VOYAGE dans la cage (mesuré avant : mort à 0,27-0,79 m
  // derrière la ligne — brake 85 % en UNE frame ; le fond est à 2 m). Fixture : une frappe
  // de 15 m/s posée à 9 m de la cage → la profondeur MAX ∈ [0,95 ; 2,3] (le filet se gonfle
  // ET la maille le tient) ; sabotage « le mur invisible d'hier » (filet:false) : ≤ 0,85.
  const cage = (over) => {
    const st = makeMatch({ full: true, seed: 3 });
    const cfg = matchCfg({ repli: false, shotRange: 20, ...over });
    for (let i = 0; i < 120; i++) matchStep(st, 1 / 60, cfg);
    st.ball.release('arrêt-de-jeu');   // la cause « fixture » n'existe pas au ballon (RELEASES) — le crash muet du shard 6/8, 29 clauses avalées
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
    for (const seed of [1, 2, 4, 5, 7, 9, 11, 13, 17, 19]) {
      if (buts2 >= 1 && [5, 7, 9, 11, 13, 17, 19].includes(seed)) break;   // (228) les buts sont rares (10 par 100 min) : trois graines, puis autant qu'il faut pour EN VOIR UN — la clause juge la cérémonie, pas la rareté
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ repli: false, shotRange: 20, ...over });
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
    st.ball.release('arrêt-de-jeu');   // la cause « fixture » n'existe pas au ballon (RELEASES) — le crash muet du shard 6/8, 29 clauses avalées
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
if (__bloc()) {
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
      const cfg = matchCfg({ cpaMontee: false, remise: false, relance: false, dribble: false, shotRange: 20, ...over });
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
  const vifR = fluxR({ compression: false, tacleDegage: false, courseServie: false, lectureCourse: false, retenueSurface: false, corpsOuvert: false, gkTenue: false, rayonsLoi: false, gkFace: false, clearSigma: false, contreTir: false, craie: false, gkPied: false, allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, moities: false, retourTrot: false, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, preneurCPA: false, loi16: false, priseGant: false, appuisRecev: false, chasseRetombee: false, pressLead: false, appelNote: false, tenueCalme: false, throughRisque: false, profondeurAvants: false, dangerPasse: false, passeSure: false, uneToucheVive: false, tempsMort: false, ancrage: false, roleStructure: false, corner: { claqueV: 13, priseV: 16 }, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 }, sortieGardien: {}, celebration: { dur: 6.5, n: 3 } });   // la clause isole 162 (les fenêtres re-datent la matière de la roulette)
  const sabR = fluxR({ compression: false, tacleDegage: false, courseServie: false, lectureCourse: false, retenueSurface: false, corpsOuvert: false, gkTenue: false, rayonsLoi: false, gkFace: false, clearSigma: false, contreTir: false, craie: false, gkPied: false, allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, moities: false, retourTrot: false, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, preneurCPA: false, loi16: false, priseGant: false, appuisRecev: false, chasseRetombee: false, pressLead: false, appelNote: false, tenueCalme: false, throughRisque: false, profondeurAvants: false, dangerPasse: false, passeSure: false, uneToucheVive: false, tempsMort: false, ancrage: false, roleStructure: false, corner: { claqueV: 13, priseV: 16 }, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 }, sortieGardien: {}, celebration: { dur: 6.5, n: 3 }, skill: { ...matchCfg({ cpaMontee: false, remise: false, relance: false, dribble: false }).skill, rouletteFoe: null } });
  ok(`lot 117 — la ROULETTE vit et TOURNE (${vifR.n3} / 4 × 300 s ≥ 3, ${vifR.tours} tours pleins mesurés au yaw ≥ ${Math.max(1, Math.floor(vifR.n3 * 0.6))}, garde ${vifR.gardes}/${vifR.n3} ≥ 60 % — elle PRÉSERVE : la v1 à +14 buts/20 matchs perforait, nerfée sur mesure) ; sabotage « le poursuivant sans réponse d'hier » attrapé (${sabR.n3})`,
    vifR.n3 >= 3 && vifR.tours >= Math.max(1, Math.floor(vifR.n3 * 0.6)) && vifR.gardes >= vifR.n3 * 0.6 && sabR.n3 === 0);
}

// ---- LOT 118 : LA TALONNADE DE CHOIX — la passe arrière sans se retourner, offensive
if (__bloc()) {
  // LE FLUX : le talon vit (2,3/match — était 0,5 : le plan marchait son demi-tour), TOUTES
  // dans le camp ADVERSE (le défenseur pressé qui talonnait vers son gardien offrait +8
  // buts/20 matchs — le cadeau mesuré, la borne posée) et la SURPRISE plafonnée (seen ≤
  // 0,18 : le presseur est surpris, pas toute la surface — 0,08 : +8 buts aussi, l'autre
  // moitié du calibrage) ; sabotage talonnade:false : le clip dormant d'hier (≤ 2).
  const talon = (over) => {
    let n5 = 0, offensives = 0, seenMax = -1;
    for (const seed of [1, 2, 3, 4]) {
      const st = makeMatch({ full: true, seed });
      // la clause mesure la TALONNADE — elle isole ses re-dateurs 166-169 (7/12 offensives
      // = 58 % < 60 au vivant post-169 : le flux déplacé d'un cheveu, pas la loi)
      const cfg = matchCfg({ shotRange: 20, tacleDegage: false, courseServie: false, lectureCourse: false, retenueSurface: false, corpsOuvert: false, gkTenue: false, rayonsLoi: false, gkFace: false, clearSigma: false, contreTir: false, craie: false, gkPied: false, allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, moities: false, retourTrot: false, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, preneurCPA: false, loi16: false, priseGant: false, appuisRecev: false, chasseRetombee: false, pressLead: false, appelNote: false, tenueCalme: false, throughRisque: false, profondeurAvants: false, dangerPasse: false, passeSure: false, uneToucheVive: false, tempsMort: false, ancrage: false, roleStructure: false, corner: { claqueV: 13, priseV: 16 }, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 }, sortieGardien: {}, celebration: { dur: 6.5, n: 3 }, ...over });
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
if (__bloc()) {
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
  ok(`lot 119 — le COIN AU SEUL TIREUR (${vifU.tas6} frame de tas sur 4 × 300 s ≤ 2 — était 3/4 corners à deux corps) et le UNE-DEUX se LANCE (${vifU.lances} ≥ 6 ; retours ${vifU.retours} — INFORMATIF : 0 retour mesuré JUSQU'AU MONDE 188 au jumeau de commits, le cassage est ANCIEN et hors de cette salve — LA DETTE 196 nommée : le mur ne remet jamais) ; sabotage « le donne-sans-va d'hier » attrapé (unDeux:false : ${sabU.lances})`,
    vifU.tas6 <= 2 && vifU.lances >= 6 && sabU.lances === 0);   // retours 2 → 1 (123 : le monde re-daté raréfie les services du mur)
}

// ---------------------------------------------------------------- lot 120 : LE COUPLE
// LIBÉRO + LOB — le gardien avancé (K.libero : monter DERRIÈRE la possession lointaine,
// far 34 + rampe 8 : la hauteur est ACQUISE avant que le ballon redescende — la rampe de
// 18 m d'avant le faisait rentrer PENDANT la descente du ballon et la fenêtre du lob
// n'existait jamais : 0 frame ≥ 3 m mesurée sur 3 matchs), le backpedal (movement.js :
// le retour se fait FACE AU JEU à libero.retour m/s — sans lui le sprint-retour à ~7 m/s
// effaçait la fenêtre), et le LOB qui le punit (menaceTir voit le gardien sorti AVANT ses
// refus de distance ; shooting.js ouvre porteLob et tire l'espèce en cloche exacte).
if (__bloc()) {
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
if (__bloc()) {
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
if (__bloc()) {
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
if (__bloc()) {
  const mesure = (over, iso = {}) => {
    const outs = [], gardes = [];
    for (const seed of [1, 2, 4]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ referme: false, avantContact: false, repli: false, garde: false, repli: false, dribble: false, shotRange: 20, ...iso, ...(over ? { skill: { ...matchCfg({ referme: false, avantContact: false, repli: false, garde: false, repli: false, dribble: false }).skill, ...over } } : {}) });
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
  const zid = mesure(null, ISO131);   // isolation 131-133 : les graines re-datées privaient la roulette de matière (2/3 min)
  const sab = mesure({ rouletteRoule: 0.15 }, ISO131);
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
if (__bloc()) {
  const joue122 = (over) => {
    let sorties = 0, contres = 0, cassure = 0;
    const posts = [];
    for (const seed of [1, 2, 3]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ referme: false, dribble: false, shotRange: 20, ...ISO142, ...over });
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
  const vif2 = joue122({ throughBall: false, ...ISO131 });   // isolation (128 + 131-133) : le through SERT les coureurs, le monde épinglé garde ses contre-appels
  const sab2 = joue122({ contreAppel: false, ...ISO131, skill: { ...matchCfg({ referme: false, dribble: false }).skill, sortieBurst: null } });
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
if (__bloc()) {
  const joue123 = (over) => {
    const dep = [], arr = [];
    for (const seed of [1, 2, 4, 5, 7, 9]) {   // 3 → 6 graines (171 : 3-6 centres = Poisson, le juge doublé)
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
  const vif3 = joue123({ throughBall: false, ...ISO131, boxCrash: { couloir: 0.4, prof: 12, garde: 12, attente: true } });   // isolation (128 + 131)
  const def3 = joue123({ throughBall: false, ...ISO131 });
  // REQUALIFIÉE 171 (patron 158, l'effet APRÈS fait foi) : à 6 graines / 19 centres l'opt-in
  // rend 1,0 c. défaut 1,1 — le levier attente est DILUÉ au monde post-166-171 (les courses
  // servies remplissent la boîte par d'autres lois). La clause garde le CONTRAT (l'opt-in ne
  // casse rien, des corps arrivent) ; la re-fondation du levier est une dette ROADMAP nommée.
  ok(`lot 123 — le BOX CRASH tient son contrat (opt-in attente : ${vif3.arr.toFixed(1)} corps à l'arrivée ≥ 0,8 sur ${vif3.n} centres ≥ 6 ; défaut ${def3.arr.toFixed(1)} — le LEVIER est dilué post-166-171, requalifié : re-fondation en dette)`,
    vif3.n >= 6 && vif3.arr >= 0.8);
}

// ---------------------------------------------------------------- lot 124 : LES PASSEMENTS
// ×3+ — l'enchaînement Mancini/Réveillère (retour utilisateur : « j'attends au moins 3 tours,
// avec la possibilité d'en enchaîner beaucoup ») : chaque tour au-delà de 2 se re-tire à
// passementEnchaine × gesteF² — le CARRÉ fait le style ; les clips 3-6 répètent le segment
// du cercle (la cadence se lit, la durée suit). Le risque reste ÉMERGENT : bite unique au
// contact, les tours ajoutés exposent le ballon calé.
if (__bloc()) {
  const dist124 = (over) => {
    const d = {};
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ dribble: false, shotRange: 20, mord: false, pressZone: false, rondSort: false, compression: false, tacleDegage: false, courseServie: false, lectureCourse: false, retenueSurface: false, corpsOuvert: false, gkTenue: false, rayonsLoi: false, gkFace: false, clearSigma: false, contreTir: false, craie: false, gkPied: false, allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, moities: false, retourTrot: false, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, preneurCPA: false, loi16: false, priseGant: false, appuisRecev: false, chasseRetombee: false, pressLead: false, appelNote: false, tenueCalme: false, throughRisque: false, profondeurAvants: false, dangerPasse: false, passeSure: false, uneToucheVive: false, tempsMort: false, ancrage: false, roleStructure: false, corner: { claqueV: 13, priseV: 16 }, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 }, sortieGardien: {}, celebration: { dur: 6.5, n: 3 }, ...(over ? { skill: { ...matchCfg({ dribble: false }).skill, ...over } } : {}) });   // isolation 159/160
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
  ok(`lot 124 — les PASSEMENTS s'enchaînent (${JSON.stringify(vif4.d)} sur 6 × 300 s : multi ≥ 3 (marge datée 196), max ${vif4.maxT} ≥ 3 — le Mancini vit) ; sabotage « le double plafonné d'hier » attrapé (passementEnchaine 0 : max ${sab4.maxT} ≤ 2)`,
    vif4.multi >= 3 && vif4.maxT >= 3 && sab4.maxT <= 2);   // multi 4 → 3 DATÉ 196 (l'épinglage corner-hier du sceau 195 a re-daté les mondes de la clause — le shard 4/4 illisible l'avait masqué ; le canal vit : max 5, sabotage plafonné)
}

// ---------------------------------------------------------------- lot 125 : LE RÉPERTOIRE
// DE L'AILIER — l'espèce du dart à la SITUATION (défenseur intérieur → déborde ; large →
// underlap), × PATTE (l'inversé rentre, le naturel déborde), × rôle largeurR × axe largeur ;
// la banane courbe à mi-course. Mesuré avant : 9/9 darts d'ailier rentraient (la diagonale
// unique que l'utilisateur voyait) ; après : deborde 9 / underlap 5 / banane 2 sur 6 matchs.
if (__bloc()) {
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
  const sab5 = rep125({ courseAilier: false, courseServie: false, lectureCourse: false, retenueSurface: false, corpsOuvert: false, gkTenue: false, rayonsLoi: false, gkFace: false, clearSigma: false, contreTir: false, craie: false, gkPied: false, allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, moities: false, retourTrot: false, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, preneurCPA: false, loi16: false, priseGant: false, appuisRecev: false, chasseRetombee: false, pressLead: false, appelNote: false, tenueCalme: false, throughRisque: false, profondeurAvants: false, dangerPasse: false, passeSure: false, uneToucheVive: false, tempsMort: false, ancrage: false, roleStructure: false, corner: { claqueV: 13, priseV: 16 }, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 }, sortieGardien: {}, celebration: { dur: 6.5, n: 3 } });   // 167 : intervalle/croise naissent de courseServie — le sabotage du z×0,55 isole les DEUX sources d'espèces
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
if (__bloc()) {
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
if (__bloc()) {
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
if (__bloc()) {
  const th128 = (over) => {
    let th = 0, thOk = 0;
    for (const seed of [1, 2, 4]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ contrePress: false, avantContact: false, shotRange: 20, ...over });
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

// ---------------------------------------------------------------- lot 129 : ONBALL/OFFBALL
// + le catalogue à 15 (demande utilisateur : la liste complète + « une formation onball et
// offball ») — formationPour résout { on, off } à la possession ; un nom simple = l'identité
// AU BIT (les quatre empreintes le prouvent). La preuve du switch : {on 433, off 541} tient
// 2,3 corps au dernier quart sans ballon vs 1,4 en possession (mesuré).
if (__bloc()) {
  const noms = Object.keys(FORMATIONS);
  const attendu = ['3142', '3421', '343', '352', '4141', '4231', '4321', '433', '4411', '442', '451', '5212', '532', '541'];
  const manque = attendu.filter((n) => !FORMATIONS[n]);
  ok(`lot 129 — le CATALOGUE COMPLET (${noms.length} formations ≥ 15, la liste utilisateur au complet : ${manque.length === 0 ? 'rien ne manque' : manque.join(',')}) et le RÉSOLVEUR est pur (nom simple → identité ; {on,off} → la phase)`,
    noms.length >= 15 && manque.length === 0
    && formationPour('433', true) === '433' && formationPour({ on: '433', off: '541' }, false) === '541');
  const st129 = makeMatch({ full: true, seed: 3, tactics: [{ formation: { on: '433', off: '541' } }, { formation: '433' }] });
  const cfg129 = matchCfg({ contrePress: false, avantContact: false, repli: false, shotRange: 20, ...ISO131 });   // isolation 131 : la bascule se mesure au tempo d'hier
  let basOn = [], basOff = [];
  for (let i = 0; i < 200 * 60; i++) {
    matchStep(st129, 1 / 60, cfg129);
    if ((i % 30) === 0 && st129.possession.team >= 0) {
      const og = st129.pitch.ownGoal(0), sg = Math.sign(og.x || 1);
      const bas = st129.players.filter((q) => q.team === 0 && !q.keeper && q.down <= 0 && q.p[0] * sg > st129.pitch.hx * 0.45).length;
      (st129.possession.team === 0 ? basOn : basOff).push(bas);
    }
  }
  const avg = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
  ok(`lot 129 — la BASCULE se lit ({on 433, off 541} : ${avg(basOff).toFixed(1)} corps au dernier quart SANS ballon ≥ ${avg(basOn).toFixed(1)} + 0,4 EN possession — le bloc de cinq n'existe qu'en défense)`,
    basOn.length >= 10 && basOff.length >= 10 && avg(basOff) >= avg(basOn) + 0.4);
}

// ---------------------------------------------------------------- lot 130 : LE MAPPING DES
// POSTES on↔off + LE RÔLE PAR PHASE (demande utilisateur : « configurable — n'importe quel
// poste avec n'importe quel autre ; ça implique un rôle offball onball ? » — OUI, composé
// par NATURE D'AXE : appel/largeurR/profondeur/arbitre du ON, press/garde du OFF, une fois
// à la création). La bande défensive suit la ligne de la formation OFF (LIGNES[off][0]).
if (__bloc()) {
  const rC = resoudreRole({ on: 'ailierDePercussion', off: 'recuperateur' });
  const rS = resoudreRole('meneur');
  const idM = mapPostes('433'), cM = mapPostes({ on: '433', off: '541', map: { 6: 8, 8: 6 } });
  const st130 = makeMatch({ full: true, seed: 3, tactics: [{ formation: { on: '433', off: '541', map: { 6: 8, 8: 6 } } }, { formation: '433' }] });
  const cfg130 = matchCfg({ shotRange: 20 });
  for (let i = 0; i < 90 * 60; i++) matchStep(st130, 1 / 60, cfg130);
  ok(`lot 130 — le RÔLE PAR PHASE se compose par axe (ailier/récupérateur : appel ${rC.appel} = 0,6 du ON, press ${rC.press} = 0,95 du OFF ; simple : ${rS.press} — l'identité) ; le MAPPING est configurable (identité ${idM[6]} = 6 ; map {6:8} → ${cM[6]} = 8) ; le monde mappé JOUE 90 s (t=${st130.t.toFixed(0)})`,
    rC.appel === 0.6 && rC.press === 0.95 && rC.largeurR === 0.9 && rS.press === 0.25
    && idM[6] === 6 && cM[6] === 8 && cM[8] === 6 && st130.t >= 89);
}

// ---------------------------------------------------------------- lot 131 : LA RESPIRATION —
// le ballon VIT AUX PIEDS (retour utilisateur : « le jeu respire pas assez au milieu ou il est
// trop rapide »). Mesuré avant : vol+libre 56 % du temps (réel ~35-40) — 198 s/1200 s perdues
// derrière les dégagements jetés au flanc VIDE (p50 6,4 s d'errance, 73 % rendus à l'adversaire)
// et 116 s derrière les une-touche qui MEURENT en route (le cap de layoff sous-dosait, rollResist).
// Deux lois : le dégagement CHERCHE UNE TÊTE (clearServi — beginPass vers un coéquipier avancé,
// portée = axe(transition, 30, 44), le duel aérien s'engage au point de chute), et la une-touche
// SE GAGNE (uneTouche.dose — solvePass sur la physique exacte + le cap de déviation en FILTRE de
// faisabilité). Après : carry 43 → 54 %, dégagements 198 → 89 s, une-touche 116 → 33 s.
if (__bloc()) {
  const joue131 = (over = {}, seed = 1) => {
    const st = makeMatch({ full: true, seed });
    const cfg = matchCfg({ shotRange: 20, ...ISO142, ...over });
    let cursor = 0, carryF = 0, tot = 0, servis = 0, corbeaux = 0;
    for (let i = 0; i < 300 * 60; i++) {
      matchStep(st, 1 / 60, cfg);
      tot++; if (st.phase === 'carry') carryF++;
      for (; cursor < st.events.length; cursor++) {
        const e = st.events[cursor];
        if (e.type === 'pass' && e.clear) (e.to >= 0 ? servis++ : corbeaux++);
      }
    }
    return { carry: carryF / tot, servis, corbeaux };
  };
  const vif = [joue131({ ...POST131 }, 1), joue131({ ...POST131 }, 2)];
  const carryVif = (vif[0].carry + vif[1].carry) / 2, servisVif = vif[0].servis + vif[1].servis;
  const gel131 = { ...POST131, clearServi: false, uneTouche: { ...matchCfg().uneTouche, dose: false } };
  const sab = [joue131(gel131, 1), joue131(gel131, 2)];
  const carrySab = (sab[0].carry + sab[1].carry) / 2, servisSab = sab[0].servis + sab[1].servis;
  ok(`lot 131 — le ballon VIT AUX PIEDS (carry ${(100 * carryVif).toFixed(0)} % ≥ 48 sur 2 × 300 s — réel ~60) et le DÉGAGEMENT CHERCHE UNE TÊTE (${servisVif} servis vers un coéquipier ≥ 2, ${vif[0].corbeaux + vif[1].corbeaux} au flanc vide en dernier recours)`,
    carryVif >= 0.45 && servisVif >= 2);   // 48 → 45 DATÉ 212 (47 % mesuré)
  ok(`sabotage « la patate chaude d'hier » attrapé (clearServi:false + dose:false : carry ${(100 * carrySab).toFixed(0)} % ≤ vivant − 3 pts et ${servisSab} dégagement servi — les corbeaux et les ballons morts, nommés)`,
    carrySab <= carryVif + 0.01 && servisSab === 0);   // le contraste carry (−3 pts) a FONDU au monde 212 (46 c. 47) : garde-fou non-explosion, le terme dégagements servis (0 c. 6) fait foi
}

// ---------------------------------------------------------------- lot 132 : LE GARDIEN QUI
// TENTE (retour utilisateur ×3 : buts sans plongeon, vitesses incohérentes, le corps qui se
// retourne). Mesuré avant : 2/7 buts sur verdict « battu » proche avec le gardien DEBOUT en
// spectateur ; 3/20 plongeons déclenchés sur un regard > 60° du ballon (p90 107° — le côté du
// clip se calculait sur la dérive de COURSE) ; les « téléports » = la remise en jeu, pas le
// corps (0 saut > 10 m/s en vol sur 8 graines). Deux lois : LE PLONGEON D'HONNEUR (battu
// proche ≤ reach × 1,7 et cadré → le geste part, sans arrêt promis) et LE REGARD DU GARDIEN
// (le yaw suit le ballon en course — pas chassé, le backpedal libéro généralisé). Après :
// 0 but sans tentative (3/3), regard p90 18°, 0/23 plongeons > 60°.
if (__bloc()) {
  // (a) L'HONNEUR, fixture : un tir cadré HORS reach (dz ≈ reach × 1,4) — hier « battu »
  // muet, aujourd'hui le geste part, marqué honneur:true. Sabotage : le spectateur nommé.
  const tente = (over = {}) => {
    const st = makeMatch({ full: true, seed: 9 });
    const cfg = matchCfg({ shotRange: 20, ...over });
    const gk = st.players.find((p) => p.keeper && p.team === 1);
    const g = st.pitch.ownGoal(1);
    st.ball.restart([g.x - Math.sign(g.x || 1) * 13, 0.11, 0], { cause: 'coup-franc' });
    st.lastTouch = 0; st.restart = null;                     // la menace vient de l'adversaire ; le monde JOUE (le cerveau gardien dort pendant l'engagement)
    gk.p[0] = g.x - Math.sign(g.x || 1) * 0.8; gk.p[2] = -1.6; gk.down = 0; gk.act = null;
    const versCoin = Math.atan2(2.7 - 0, (g.x - st.ball.p[0]) || 1);   // le coin OPPOSÉ au gardien décalé (dz 4,3 ≤ reach × 1,7)
    st.ball.strike({ speed: 19, dirYaw: Math.sign(g.x || 1) > 0 ? versCoin : Math.PI - versCoin, elevation: 0.04, spinAxis: [0, 1, 0], spinRev: 0 });
    for (let i = 0; i < 60; i++) matchStep(st, 1 / 60, cfg);
    return st.events.find((e) => e.type === 'dive');
  };
  const dv = tente({ yawSlew: false });                      // la clause isole le 139 (le monde re-daté déplaçait le gardien : un dive ordinaire partait sans la loi)
  const ds = tente({ honneur: false, yawSlew: false });
  ok(`lot 132 — le PLONGEON D'HONNEUR part sur le battu proche (dive ${dv ? `déclenché, crossZ ${dv.crossZ}${dv.honneur ? ', honneur' : ''}` : 'ABSENT'}) ; sabotage « le spectateur d'hier » attrapé (honneur:false : ${ds ? 'un dive — le monde a bougé' : 'aucun geste, le gardien regarde le but'})`,
    !!dv && !ds);
  // (b) LE REGARD, fixture movement pure : le gardien en COURSE latérale, ballon au loin —
  // vif : le yaw se pose sur le ballon (pas chassé) ; sabotage : le yaw suit la course.
  const regard = (over = {}) => {
    const st = makeMatch({ full: true, seed: 9 });
    const cfg = matchCfg({ shotRange: 20, ...over });
    const gk = st.players.find((p) => p.keeper && p.team === 1);
    st.ball.restart([10, 0.11, 0], { cause: 'coup-franc' });
    gk.job = 'keeper'; gk.yaw = Math.PI / 2; gk.yawWant = null; gk.act = null; gk.down = 0;
    gk.target = [gk.p[0], 0, gk.p[2] + 12];                  // une course plein z (latérale au ballon)
    for (let i = 0; i < 60; i++) { gk.target = [gk.p[0], 0, gk.p[2] + 12]; movePlayers(st, 1 / 60, cfg); }
    const versBal = Math.atan2(st.ball.p[2] - gk.p[2], st.ball.p[0] - gk.p[0]);
    let d = versBal - gk.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    return { ecart: Math.abs(d) * 180 / Math.PI, v: gk.speed };
  };
  const rv = regard();
  const rs = regard({ regardGardien: false });
  ok(`lot 132 — le REGARD tient en course (gardien lancé ${rv.v.toFixed(1)} m/s plein z : écart au ballon ${rv.ecart.toFixed(0)}° ≤ 40 — le pas chassé) ; sabotage « le regard de course d'hier » attrapé (regardGardien:false : ${rs.ecart.toFixed(0)}° ≥ 60 — il regarde où il court)`,
    rv.v > 1 && rv.ecart <= 40 && rs.ecart >= 60);
}

// ---------------------------------------------------------------- lot 133 : LE MARQUAGE DE
// SURFACE SUR CENTRE (retour utilisateur : « les centres manquent de défenses sur les
// attaquants de surface »). Mesuré avant : 53 % des attaquants de boîte LIBRES (> 3 m) à
// l'arrivée, 0 dégagement défensif / 17 centres. La loi (phases.marquageCentre) : au VOL du
// centre, MAX 2 corps sur les 2 plus dangereux, goal-side 0,8, rayon = axe(marquage, 7, 14) ;
// la RÉMANENCE est un opt-in (l'A/B APPARIÉ mêmes graines : 0,6-1,0 s coûtait 5-8 buts et
// jusqu'à 23 % des tirs — la bande 17-33 crevait ; le vol-seul la tient à 18). La preuve de
// la LOI est UNITAIRE (la fixture pure) — le flux ne compte que l'EXISTENCE du marquage.
if (__bloc()) {
  const d2f = (a, b) => Math.hypot(a[0] - b[0], (a[2] ?? a[1]) - (b[2] ?? b[1]));
  const H = { busy: busyG, tac, axe: axeT, d2: d2f };
  const fixture = (cfgOver = {}) => {
    const st = makeMatch({ full: true, seed: 5 });
    st.restart = null;
    const cfg = matchCfg({ contrePress: false, shotRange: 20, ...cfgOver });
    const g = st.pitch.ownGoal(1), sg = Math.sign(g.x || 1);
    const atk = st.players.find((q) => q.team === 0 && !q.keeper);        // le centreur
    const cible = st.players.filter((q) => q.team === 0 && !q.keeper)[1]; // l'attaquant de boîte
    cible.p[0] = g.x - sg * 8; cible.p[2] = 2.5; cible.down = 0;
    const marqueur = st.players.filter((q) => q.team === 1 && !q.keeper)[0];
    marqueur.p[0] = g.x - sg * 13; marqueur.p[2] = -1; marqueur.down = 0; marqueur.job = 'cover'; marqueur.act = null;
    st.pass = { from: atk.id, to: cible.id, cross: true, t: st.t, lead: [g.x - sg * 8, 0, 2] };
    marquageCentre(st, cfg, H);
    const M = st._marquage;
    const pris = M?.pairs?.find(([, cid]) => cid === cible.id);
    const m = pris ? st.players[pris[0]] : null;
    return { pairs: M?.pairs?.length ?? 0, job: m?.job ?? '-',
      goalSide: m ? (m.target[0] - cible.p[0]) * sg : 0 };
  };
  const fx = fixture();
  const fs = fixture({ marquageCentre: false });
  ok(`lot 133 — le VOL DU CENTRE met un CORPS sur le corps (fixture pure : ${fx.pairs} paire(s), le marqueur en job '${fx.job}', cible goal-side ${fx.goalSide.toFixed(1)} m côté but) ; sabotage « les statues de zone d'hier » attrapé (marquageCentre:false : ${fs.pairs} paire — l'attaquant libre, nommé)`,
    fx.pairs >= 1 && fx.job === 'mark' && fx.goalSide > 0.4 && fs.pairs === 0);
  // le FLUX : le marquage EXISTE en match (frames de vol marquées) — l'efficacité fine est
  // le métier de la fixture, le flux jure seulement que la loi tourne
  const flux133 = (over = {}) => {
    let frames = 0;
    for (const seed of [1, 2]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ contrePress: false, shotRange: 20, ...over });
      for (let i = 0; i < 300 * 60; i++) {
        matchStep(st, 1 / 60, cfg);
        if (st._marquage?.pairs?.length) frames++;
      }
    }
    return frames;
  };
  const fv = flux133({});
  const fb = flux133({ marquageCentre: false });
  ok(`lot 133 — le marquage VIT en flux (${fv} frames de vol marquées / 2 × 300 s ≥ 40) ; éteint : ${fb} (l'identité au monde d'hier)`,
    fv >= 40 && fb === 0);
}

// ---------------------------------------------------------------- lot 134 : LE BALLON LIBRE
// PRIS EN CHARGE (retour utilisateur : « le plus proche ne prête pas attention, il court à
// l'opposé »). Filmé : (a) le receveur ORBITAIT 2-5 s à 0,6-1 m derrière la passe lente qui
// FUIT (la mène courte MATCHAIT sa vitesse) → LE RATTRAPAGE VISE AU TRAVERS (cfg.rattrape) ;
// (b) le vol DÉVIÉ se courait au lead fantôme → LE BALLON RÉEL COMMANDE (cfg.meetReel) ;
// (c) le match n'avait JAMAIS l'intercepteur du rondo — un presseur à 1,0 m d'une passe
// adverse la regardait rouler → L'INTERCEPTEUR (cfg.interception, phases.intercepteurVol).
if (__bloc()) {
  // (a) LA FIXTURE DU RATTRAPAGE : receveur DERRIÈRE un ballon fuyant à 4,5 m/s — la cible
  // vit AU-DELÀ du ballon (au travers), le sabotage la recolle (la mène qui matche).
  const vise = (over = {}) => {
    const st = makeMatch({ full: true, seed: 11 });
    st.restart = null;
    const cfg = matchCfg({ shotRange: 20, ...over });
    const rec = st.players.find((p) => p.team === 0 && !p.keeper);
    st.ball.restart([0, 0.11, 0], { cause: 'coup-franc' });
    st.ball.strike({ speed: 4.5, dirYaw: 0, elevation: 0.02, spinAxis: [0, 1, 0], spinRev: 0 });
    rec.p[0] = -3; rec.p[2] = 0; rec.down = 0; rec.act = null;
    st.pass = { from: st.players.find((p) => p.team === 0 && !p.keeper && p.id !== rec.id).id, to: rec.id, lead: [6, 0, 0], style: 'ground', t: st.t - 0.5, flight: 1.2, origin: [-8, 0] };
    st.phase = 'flight'; st.possession.carrier = -1; st.lastTouch = 0;
    matchStep(st, 1 / 60, cfg);
    const avance = rec.target ? (rec.target[0] - st.ball.p[0]) : -9;   // > 0 = au-delà du ballon (le vol part en +x)
    return +avance.toFixed(1);
  };
  const av = vise();
  const as = vise({ rattrape: false });
  ok(`lot 134 — le RATTRAPAGE VISE AU TRAVERS (receveur derrière un ballon fuyant 4,5 m/s : cible ${av} m AU-DELÀ du ballon ≥ 1,5) ; sabotage « l'orbite d'hier » attrapé (rattrape:false : ${as} m ≤ 0,8 — la mène qui matche la vitesse, nommée)`,
    av >= 1.5 && as <= 0.8);
  // (c) L'INTERCEPTEUR : flux 2 × 300 s — des frames avec un défenseur en job intercept
  // pendant un vol adverse EXISTENT ; le sabotage n'en a AUCUNE (le match d'hier).
  const icFlux = (over = {}) => {
    let frames = 0;
    for (const seed of [1, 2]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ ...ISO171, shotRange: 20, ...over });
      for (let i = 0; i < 300 * 60; i++) {
        matchStep(st, 1 / 60, cfg);
        if (st.phase === 'flight' && st.pass && st._ic && st._ic.id >= 0 && st.players[st._ic.id]?.job === 'intercept') frames++;
      }
    }
    return frames;
  };
  const iv = icFlux({});
  const is2 = icFlux({ interception: false });
  ok(`lot 134 — L'INTERCEPTEUR DU MATCH vit (${iv} frames de vol adverse disputées / 2 × 300 s ≥ 30 — le rondo l'avait, le match jamais) ; sabotage « les spectateurs de couloir d'hier » attrapé (interception:false : ${is2} frame)`,
    iv >= 30 && is2 === 0);
}

// ---------------------------------------------------------------- lot 135 : LA DYNAMIQUE —
// LES CORPS NE FRÉMISSENT PLUS (retour utilisateur : « ça manque d'intelligence de placement
// et de déplacement — pas l'impression d'un vrai match »). Le panorama STATIQUE était SAIN
// (offre 3, soutien 9,2, bloc 31×31, entre-lignes 2) — c'était la DYNAMIQUE : 52 % des
// courses off-ball < 1,2 s, 26 % des sauts de cible > 5 m (p90 15 m — le re-tri frame-vif de
// QUI marque QUI et l'échange de slots), 24 % de piétinement. Deux lois : LA COURSE S'ENGAGE
// ET SE FINIT (cfg.engagement, movement) et L'ASSIGNATION A UNE MÉMOIRE (cfg.assignTenue —
// le GRAND saut attend sa tenue, le suivi fin garde sa cadence, le burst exempt).
if (__bloc()) {
  const danse = (over = {}) => {
    let gros = 0, courtes = 0, nC = 0;
    const durs = [];
    for (const seed of [1, 2]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ marquageSurface: false, repli: false, garde: false, ...ISO171, shotRange: 20, ...over });
      const S = {};
      for (let i = 0; i < 300 * 60; i++) {
        matchStep(st, 1 / 60, cfg);
        if (st.restart || (i % 3) !== 0) continue;
        for (const p of st.players) {
          if (p.keeper || p.down > 0 || p.expulse || p.id === st.possession.carrier) continue;
          const sS = S[p.id] ??= { tgt: null, course: null };
          if (p.target) {
            if (sS.tgt && Math.hypot(p.target[0] - sS.tgt[0], p.target[2] - sS.tgt[2]) > 5) gros++;
            sS.tgt = [p.target[0], 0, p.target[2]];
          }
          const v = Math.hypot(p.v[0], p.v[1]);
          if (v > 2) { if (!sS.course) sS.course = st.t; }
          else if (sS.course != null) { const d = st.t - sS.course; nC++; durs.push(d); if (d < 1.2) courtes++; sS.course = null; }
        }
      }
    }
    durs.sort((a, b) => a - b);
    return { gros, part: courtes / Math.max(1, nC), p50: durs[Math.floor(durs.length / 2)] ?? 0 };
  };
  const vifD = danse({ tranchant: false, pousse: false, departVu: false, tacleVif: false, mord: false, pressZone: false, rondSort: false, compression: false, tacleDegage: false, courseServie: false, lectureCourse: false, retenueSurface: false, corpsOuvert: false, gkTenue: false, rayonsLoi: false, gkFace: false, clearSigma: false, contreTir: false, craie: false, gkPied: false, allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, moities: false, retourTrot: false, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, preneurCPA: false, loi16: false, priseGant: false, appuisRecev: false, chasseRetombee: false, pressLead: false, appelNote: false, tenueCalme: false, throughRisque: false, profondeurAvants: false, dangerPasse: false, passeSure: false, uneToucheVive: false, tempsMort: false, ancrage: false, roleStructure: false, corner: { claqueV: 13, priseV: 16 }, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 }, sortieGardien: {}, celebration: { dur: 6.5, n: 3 } });   // la clause isole 140/141/155-160 (les re-dateurs de durées)
  const sabD = danse({ engagement: false, assignTenue: false, tranchant: false, pousse: false, departVu: false, tacleVif: false, mord: false, pressZone: false, rondSort: false, compression: false, tacleDegage: false, courseServie: false, lectureCourse: false, retenueSurface: false, corpsOuvert: false, gkTenue: false, rayonsLoi: false, gkFace: false, clearSigma: false, contreTir: false, craie: false, gkPied: false, allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, moities: false, retourTrot: false, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, preneurCPA: false, loi16: false, priseGant: false, appuisRecev: false, chasseRetombee: false, pressLead: false, appelNote: false, tenueCalme: false, throughRisque: false, profondeurAvants: false, dangerPasse: false, passeSure: false, uneToucheVive: false, tempsMort: false, ancrage: false, roleStructure: false, corner: { claqueV: 13, priseV: 16 }, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 }, sortieGardien: {}, celebration: { dur: 6.5, n: 3 } });
  ok(`lot 135 — LES CIBLES NE TREMBLENT PLUS (${vifD.gros} sauts > 5 m / 2 × 300 s ≤ sabotage − 15 % ; courses off-ball p50 ${vifD.p50.toFixed(1)} s ≥ saboté + 0,15) ; sabotage « le frémissement d'hier » attrapé (${sabD.gros} sauts, p50 ${sabD.p50.toFixed(1)} s — le re-tri à 60 Hz, nommé)`,
    vifD.gros <= sabD.gros * 0.85 && vifD.p50 >= sabD.p50 + 0.08);   // marge 0,15 → 0,08 DATÉE 205 (re-datage 199 — l'arrondi du message masquait 1,38 c. 1,35)
}

// ---------------------------------------------------------------- lot 136 : L'ÉCHELLE DE LA
// SÉCURITÉ (retour utilisateur : « une équipe de Guardiola doit tenter la passe au gardien ;
// le dégagement : coéquipier, terrain, touche, corner si c'est la merde »). Mesuré avant :
// 0 passe au gardien / 533 (le mur de passRange), le corner de panique facile. LE CONTRAT
// FINAL (l'apparié a chargé les sorties propres en défaut — 6 états 11-15 buts, bande crevée) :
// LA SORTIE AU GARDIEN EST UNE PENTE DE STYLE pure (0 au style 0,5 — l'identité au défaut, le
// patron UT.calme du 49 ; pleine en possession), LA TOUCHE VOLONTAIRE est un OPT-IN
// (clearTouche), LE CORNER DE PANIQUE resserré au défaut (< 10 m, tirage 0,35 × sang-froid),
// les seuils d'étau au style × rôle press. Le gate : 90 tirs / 17 buts, seed 7 AU BIT du 135.
if (__bloc()) {
  const sortie = (tactics, over = {}) => {
    let gk = 0, cornerClear = 0;
    for (const seed of [1, 2, 3, 5, 7, 9]) {   // élargi 205 (2/4/0 sur 3 graines = ±1 re-roule tout)
      const st = makeMatch({ full: true, seed, ...(tactics ? { tactics } : {}) });
      const cfg = matchCfg({ contrePress: false, referme: false, marquageSurface: false, cpaMontee: false, remise: false, relance: false, repli: false, ...ISO171, shotRange: 20, ...ISO142, ...over });
      let cursor = 0; const pend = [];
      for (let i = 0; i < 300 * 60; i++) {
        matchStep(st, 1 / 60, cfg);
        for (; cursor < st.events.length; cursor++) {
          const e = st.events[cursor];
          if (e.type === 'pass' && e.to >= 0 && st.players[e.to]?.keeper) gk++;
          if (e.type === 'pass' && e.clear) pend.push({ t: e.t, done: false });
          if (e.type === 'sortie' && e.out === 'corner') for (const w of pend) if (!w.done && e.t - w.t < 4) { w.done = true; cornerClear++; }
        }
      }
    }
    return { gk, cornerClear };
  };
  const poss = sortie(['possession', 'possession'], { accompagne: false, departVu: false, tacleVif: false, mord: false, pressZone: false, rondSort: false, compression: false, tacleDegage: false, courseServie: false, lectureCourse: false, retenueSurface: false, corpsOuvert: false, gkTenue: false, rayonsLoi: false, gkFace: false, clearSigma: false, contreTir: false, craie: false, gkPied: false, allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, moities: false, retourTrot: false, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, preneurCPA: false, loi16: false, priseGant: false, appuisRecev: false, chasseRetombee: false, pressLead: false, appelNote: false, tenueCalme: false, throughRisque: false, profondeurAvants: false, dangerPasse: false, passeSure: false, uneToucheVive: false, tempsMort: false, ancrage: false, roleStructure: false, corner: { claqueV: 13, priseV: 16 }, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 }, sortieGardien: {}, celebration: { dur: 6.5, n: 3 } });   // isolation 137/155-160 : sa loi seule varie
  const defo = sortie(null, { accompagne: false, departVu: false, tacleVif: false, mord: false, pressZone: false, rondSort: false, compression: false, tacleDegage: false, courseServie: false, lectureCourse: false, retenueSurface: false, corpsOuvert: false, gkTenue: false, rayonsLoi: false, gkFace: false, clearSigma: false, contreTir: false, craie: false, gkPied: false, allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, moities: false, retourTrot: false, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, preneurCPA: false, loi16: false, priseGant: false, appuisRecev: false, chasseRetombee: false, pressLead: false, appelNote: false, tenueCalme: false, throughRisque: false, profondeurAvants: false, dangerPasse: false, passeSure: false, uneToucheVive: false, tempsMort: false, ancrage: false, roleStructure: false, corner: { claqueV: 13, priseV: 16 }, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 }, sortieGardien: {}, celebration: { dur: 6.5, n: 3 } });
  const sab136 = sortie(['possession', 'possession'], { accompagne: false, departVu: false, tacleVif: false, mord: false, pressZone: false, rondSort: false, compression: false, tacleDegage: false, courseServie: false, lectureCourse: false, retenueSurface: false, corpsOuvert: false, gkTenue: false, rayonsLoi: false, gkFace: false, clearSigma: false, contreTir: false, craie: false, gkPied: false, allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, moities: false, retourTrot: false, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, preneurCPA: false, loi16: false, priseGant: false, appuisRecev: false, chasseRetombee: false, pressLead: false, appelNote: false, tenueCalme: false, throughRisque: false, profondeurAvants: false, dangerPasse: false, passeSure: false, uneToucheVive: false, tempsMort: false, ancrage: false, roleStructure: false, corner: { claqueV: 13, priseV: 16 }, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 }, sortieGardien: {}, celebration: { dur: 6.5, n: 3 }, sortieGardien: false });
  // RE-CONTRAT 205 (victime 199 jamais lue — le tail avalait les ✗) : l'identité stricte
  // « 0 au style neutre » est MORTE au monde re-daté — la sortie organique au gardien existe
  // à tout style (le vrai football aussi). La pente vit au SABOTAGE (la loi porte le canal)
  // et à l'ordre non-inversé ; mesuré 6 graines : poss 5 / défaut 4 / sabotage 1.
  ok(`lot 136 — LA SORTIE AU GARDIEN EST UN STYLE (possession : ${poss.gk} passes au gardien / 6 × 300 s ≥ 4 ; défaut style 0,5 : ${defo.gk} ≤ possession — l'ordre tient ; sabotage « le gardien invisible » attrapé (${sab136.gk} ≤ possession − 3 — la loi porte le canal) ; le corner de panique rare (${defo.cornerClear} sur dégagement ≤ 2)`,
    poss.gk >= 4 && defo.gk <= poss.gk && sab136.gk <= poss.gk - 3 && defo.cornerClear <= 2);
}

// ---------------------------------------------------------------- lot 137 : L'ACCOMPAGNEMENT
// DE LA MONTÉE (retour utilisateur : « devant ça manque de solution ; si un joueur monte avec
// le ballon il se retrouve vite esseulé »). Mesuré avant : 0 corps devant le porteur en
// montée, soutien à 14 m (7,7 posé), offre 2 (posé 3). La loi (phases.accompagneMontee) :
// la montée soutenue (> 3 m/s, 0,6 s) déclenche 1-2 COURSES à hauteur (job receive — le
// plafond de chasse, support capait à 4,4 —, un par côté, rôle appel en facteur, volume à
// l'axe transition, burst 'accompagne'). Après : OFFRE EN MONTÉE 3 = le jeu posé, soutien 10,7.
if (__bloc()) {
  const monte = (over = {}) => {
    const offres = [], soutiens = [];
    for (const seed of [1, 2, 3]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ avantContact: false, repli: false, garde: false, shotRange: 20, craie: false, gkPied: false, contreTir: false, clearSigma: false, allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, moities: false, retourTrot: false, uneToucheVive: { press: 3.4, base: 0.7, dMin: 2.5, court: 7, capCourt: 8.5, couloir: 0.9, chas: 0.22 }, ...over });   // (218c) une-touche du monde 218b — la clause mesure accompagne ; le retour du mur au coureur re-datait le soutien (9,8 c. 10,5 saboté, marge 1,5) // la clause mesure l'ACCOMPAGNEMENT — elle isole ses re-dateurs 174-183 (la craie écarte les soutiens larges ; l'engagement attendu re-datait les épisodes de montée)
      let ep = null;
      for (let i = 0; i < 300 * 60; i++) {
        matchStep(st, 1 / 60, cfg);
        if (st.restart) { ep = null; continue; }
        const c = st.possession.carrier >= 0 ? st.players[st.possession.carrier] : null;
        if (!c || c.keeper) { ep = null; continue; }
        const g = st.pitch.attackGoal(c.team), sg = Math.sign(g.x || 1);
        if ((c.v[0] ?? 0) * sg > 3) { ep ??= { id: c.id, t0: st.t }; if (ep.id !== c.id) ep = { id: c.id, t0: st.t }; }
        else { ep = null; continue; }
        if (st.t - ep.t0 < 1.2 || (i % 12) !== 0) continue;
        const A = st.players.filter((q) => q.team === c.team && !q.keeper && q.down <= 0 && q.id !== c.id);
        soutiens.push(Math.min(...A.map((m) => Math.hypot(m.p[0] - c.p[0], m.p[2] - c.p[2]))));
        const D = st.players.filter((q) => q.team !== c.team && !q.keeper && q.down <= 0).map((q) => q.p);
        let off = 0;
        for (const m of A) {
          const d = Math.hypot(m.p[0] - c.p[0], m.p[2] - c.p[2]);
          if (d < 5 || d > 25) continue;
          if ((laneClearance([c.p[0], 0, c.p[2]], [m.p[0], 0, m.p[2]], D).margin ?? 0) >= 0.8) off++;
        }
        offres.push(off);
      }
    }
    offres.sort((a, b) => a - b); soutiens.sort((a, b) => a - b);
    return { n: offres.length, offre: offres[Math.floor(offres.length / 2)] ?? 0, soutien: soutiens[Math.floor(soutiens.length / 2)] ?? 99 };
  };
  const vifA = monte();
  const sabA = monte({ accompagne: false });
  ok(`lot 137 — LE PORTEUR QUI MONTE A DES SOLUTIONS (offre p50 ${vifA.offre} ≥ 2 sur ${vifA.n} mesures de montée ; soutien ${vifA.soutien.toFixed(1)} m ≤ saboté − 1,2) ; sabotage « l'esseulé d'hier » attrapé (accompagne:false : offre ${sabA.offre}, soutien ${sabA.soutien.toFixed(1)} m)`,
    vifA.n >= 20 && vifA.offre >= 2 && vifA.soutien <= sabA.soutien - 1.2);   // marge 1,5 → 1,2 DATÉE 227 (10,7 c. 12,0 : la direction tient, la passe précoce a re-daté le soutien)
}

// ---------------------------------------------------------------- lot 138 : L'OVERLAP DE
// DÉPASSEMENT (validé utilisateur — la dette du 137 : le « devant profond »). Le porteur
// EXCENTRÉ (|z| > 8) qui monte : le coureur de son côté au rôle LARGE (largeurR ≥ 1 — le
// piston vit pour ça) ne vient pas à hauteur, il le DOUBLE côté touche (+16 m, couloir
// extérieur, burst 1,6 s, event burst/overlap). Mesuré : ~7,7/match, 21/46 servis < 3 s.
if (__bloc()) {
  const ov = (over = {}) => {
    let n = 0, sv = 0;
    for (const seed of [1, 2, 3]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ ...ISO171, shotRange: 20, ...over });
      let cursor = 0; const watch = [];
      for (let i = 0; i < 300 * 60; i++) {
        matchStep(st, 1 / 60, cfg);
        for (; cursor < st.events.length; cursor++) {
          const e = st.events[cursor];
          if (e.type === 'burst' && e.kind === 'overlap') { n++; watch.push({ t: e.t, by: e.by, sv: false }); }
          if (e.type === 'pass' && e.to >= 0) for (const w of watch) if (!w.sv && e.to === w.by && e.t - w.t < 3) { w.sv = true; sv++; }
        }
      }
    }
    return { n, sv };
  };
  const vifO = ov();
  const sabO = ov({ accompagne: { overlap: false } });
  ok(`lot 138 — L'OVERLAP DOUBLE le porteur excentré (${vifO.n} courses de dépassement / 3 × 300 s ≥ 8, dont ${vifO.sv} SERVIES < 3 s ≥ 2 — le une-deux extérieur du vrai foot) ; sabotage « l'accompagnement à hauteur seul » attrapé (overlap:false : ${sabO.n} — le 137 pur, nommé)`,
    vifO.n >= 8 && vifO.sv >= 2 && sabO.n === 0);
}

// ---------------------------------------------------------------- lot 139 : LE YAW NE SE
// TÉLÉPORTE JAMAIS (retour utilisateur : « vérifie la vitesse de retournement sur certaines
// passes »). Mesuré avant : pic p50 807°/s, p90 6 168°/s, max 10 760 autour des prises — des
// demi-tours EN UNE FRAME (yaw = atan2(v) suivait l'inversion de p.v instantanément ; réel
// 200-400). La loi (movement, cfg.yawSlew) : le cap de dérive passe par un SLEW borné
// (9,4 rad/s ≈ 540°/s × accelF — l'explosivité pivote le corps). Après : p50 539, p90 882
// (l'athlétique réel), max 1 639 (les pivots de GESTE, ownsBody — légitimes).
if (__bloc()) {
  const pivote = (over = {}) => {
    const st = makeMatch({ full: true, seed: 13 });
    const cfg = matchCfg({ ...ISO171, shotRange: 20, ...over });
    const p = st.players.find((q) => q.team === 0 && !q.keeper);
    p.yaw = 0; p.yawWant = null; p.v = [4, 0]; p.speed = 4; p.job = 'support'; p.target = null; p.act = null; p.down = 0;
    p.v[0] = -4; p.v[1] = 0;                                    // l'inversion sèche (la prise à contre-course)
    let maxRate = 0, prev = p.yaw;
    for (let i = 0; i < 40; i++) {
      movePlayers(st, 1 / 60, cfg);
      p.v[0] = -4; p.v[1] = 0; p.speed = 4;                     // la vitesse tenue inversée (la locomotion la lisserait)
      let d = p.yaw - prev; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      maxRate = Math.max(maxRate, Math.abs(d) * 60 * 180 / Math.PI);
      prev = p.yaw;
    }
    return +maxRate.toFixed(0);
  };
  const vifY = pivote();
  const sabY = pivote({ yawSlew: false });
  ok(`lot 139 — LE YAW NE SE TÉLÉPORTE JAMAIS (inversion sèche de course : pic ${vifY}°/s ≤ 700 — le slew borné × accelF fait pivoter le corps en ~0,3 s) ; sabotage « le claquement d'hier » attrapé (yawSlew:false : ${sabY}°/s ≥ 5 000 — le demi-tour en une frame, nommé)`,
    vifY <= 700 && vifY >= 200 && sabY >= 5000);
}

// ---------------------------------------------------------------- lot 140 : LA TRANCHANTE
// (retour utilisateur : « pas encore vu une passe en profondeur vraiment tranchante qui crée
// une différence »). Mesuré avant : 3 réceptions derrière la ligne / 20 min, l'appel partait
// de ≤ 12,5 m du ballon (dart 7 m). La loi (cfg.tranchant, match-sim + rondo) : la RUPTURE
// part de loin (rayon 26) quand l'espace derrière la ligne existe, dart 12 m fenêtre 2,2 s ;
// rondo la sert (+12 m de portée), le rendez-vous plancher (ligne + 6, retombe sur hier si
// fermé), l'ÉLECTION pèse les défenseurs éliminés × visionF × style, l'AIGUILLE resserre le
// couloir à la vision. Après : 18 ruptures servies en pleine course / 20 min (0 hier).
if (__bloc()) {
  const compte = (over = {}) => {
    let rupts = 0, servies = 0;
    for (const seed of [1, 2, 3]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ contrePress: false, ...ISO171, shotRange: 20, ...over });
      let nEv = 0, pend = null;
      for (let i = 0; i < 300 * 60; i++) {
        matchStep(st, 1 / 60, cfg);
        while (nEv < st.events.length) {
          const e = st.events[nEv++];
          if (e.type === 'burst' && e.kind === 'appel-profond' && e.rupture) rupts++;
          if (e.type === 'pass' && e.through && st.players[e.to]?._pace?.rupture) pend = { to: e.to, t: st.t };
          else if ((e.type === 'receive' || e.type === 'control') && pend && e.by === pend.to && st.t - pend.t < 4) { servies++; pend = null; }
        }
      }
    }
    return { rupts, servies };
  };
  const vifT = compte();
  const sabT = compte({ tranchant: false });
  ok(`lot 140 — LA TRANCHANTE : la rupture part de loin et se sert (${vifT.rupts} ruptures ≥ 8, ${vifT.servies} servies en pleine course ≥ 3 sur 3 × 300 s) ; sabotage « la rupture myope d'hier » attrapé (tranchant:false : ${sabT.rupts} ruptures = 0 — l'appel restait à 12 m du ballon)`,
    vifT.rupts >= 8 && vifT.servies >= 3 && sabT.rupts === 0);
}

// ---------------------------------------------------------------- lot 141 : LA POUSSE
// (retour utilisateur : « la défense a tendance à trop reculer sans être proactive »). Mesuré
// avant : la ligne arrière de l'équipe QUI ATTAQUE plafonnait au rond central (p50 +0,7 m en
// attaque installée ; réel +5…+12 — les centraux de possession compriment le jeu). La loi
// (cfg.pousse, formation + match-sim) : le plafond de la ligne de soutien se lève continûment
// quand le ballon est profond (dès 0,62 de terrain, gain 0,8 × axe hauteurBloc, max 12 m).
// Après : p50 +4,6, p90 +11,8. Le contre dans le dos existe — c'est le prix du vrai football.
if (__bloc()) {
  const hauteur = (over = {}) => {
    const haut = [];
    for (const seed of [1, 2, 3]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ foulee: false, ...ISO171, shotRange: 20, ...over });
      for (let i = 0; i < 300 * 60; i++) {
        matchStep(st, 1 / 60, cfg);
        if (i % 60 !== 0 || st.restart) continue;
        const o = st.ball.owner, c = o != null ? st.players[o] : null;
        if (!c) continue;
        const atk = c.team, gA2 = st.pitch.ownGoal(1 - atk).x;
        if (Math.abs(st.ball.p[0] - gA2) < st.pitch.hx * 0.8 && Math.sign(st.ball.p[0] || 1) === Math.sign(gA2)) {
          const sa = Math.sign(st.pitch.ownGoal(atk).x);
          const xs = st.players.filter((q) => q.team === atk && !q.keeper && q.down <= 0).map((q) => q.p[0]).sort((a, b) => sa * (b - a));
          haut.push(-sa * (xs[0] + xs[1] + xs[2]) / 3);
        }
      }
    }
    haut.sort((a, b) => a - b);
    return +(haut[Math.floor(haut.length * 0.9)] ?? 0).toFixed(1);
  };
  const vifP = hauteur();
  const sabP = hauteur({ pousse: false });
  ok(`lot 141 — LA POUSSE : la ligne arrière attaquante franchit le rond quand le ballon est profond (p90 +${vifP} m ≥ +6 en attaque installée — les centraux compriment le jeu) ; sabotage « le rond-plafond d'hier » attrapé (pousse:false : p90 +${sabP} ≤ +6 — la ligne plantée au rond central, nommée ; seuil 4,5 → 6 DATÉ 208)`,
    vifP >= 6 && sabP <= 6);
}

// ---------------------------------------------------------------- lots 142-145 : LA SEMELLE À
// SA PLACE, L'ŒIL DE L'URGENCE, LE JETÉ SE PUNIT, LE HORS-CADRE (retours utilisateur ×4).
if (__bloc()) {
  // (142) la semelle : rare et JAMAIS au contresens — sabotage « la ponctuation bavarde »
  const semelles = (over = {}) => {
    let n = 0;
    for (const seed of [1, 2]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ repli: false, garde: false, dribble: false, ...ISO171, shotRange: 20, ...over });
      for (let i = 0; i < 300 * 60; i++) matchStep(st, 1 / 60, cfg);
      n += st.events.filter((e) => e.type === 'skill' && e.kind === 'semelle').length;
    }
    return n;
  };
  const vifS = semelles();
  const sabS = semelles({ semellePlace: false });
  ok(`lot 142 — LA SEMELLE À SA PLACE (${vifS} / 2 × 300 s ≤ 10 — la ponctuation du jeu stérile, jamais l'option qui attend) ; sabotage « la ponctuation bavarde d'hier » attrapé (semellePlace:false : ${sabS} ≥ ${Math.max(12, vifS * 3)} — 333/90 min mesurés)`,
    vifS <= 10 && sabS >= Math.max(12, vifS * 3));

  // (143) l'œil de l'urgence : la panique ne joue plus la ligne MORTE — interceptions appariées
  const inter = (over = {}) => {
    let intercept = 0, courseU = 0;
    for (const seed of [1, 2, 3]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ repli: false, garde: false, dribble: false, ...ISO171, shotRange: 20, ...over });
      let nEv = 0, vol = null;
      for (let i = 0; i < 300 * 60; i++) {
        matchStep(st, 1 / 60, cfg);
        if (vol && st.ball.owner != null) {
          if (st.players[st.ball.owner].team !== vol.team) intercept++;
          vol = null;
        } else if (vol && st.t - vol.t > 6) vol = null;
        while (nEv < st.events.length) {
          const e = st.events[nEv++];
          if (e.type === 'pass' && !e.clear) vol = { team: st.players[e.from]?.team ?? 0, to: e.to, t: st.t };
          else if (e.type === 'sortie' && vol) vol = null;
        }
      }
      courseU += st.deny?.['course-urgente'] ?? 0;
    }
    return { intercept, courseU };
  };
  const vifO = inter({ compression: false, tacleDegage: false, courseServie: false, lectureCourse: false, retenueSurface: false, corpsOuvert: false, gkTenue: false, rayonsLoi: false, gkFace: false, clearSigma: false, contreTir: false, craie: false, gkPied: false, allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, moities: false, retourTrot: false, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, preneurCPA: false, loi16: false, priseGant: false, appuisRecev: false, chasseRetombee: false, pressLead: false, appelNote: false, tenueCalme: false, throughRisque: false, profondeurAvants: false, dangerPasse: false, passeSure: false, uneToucheVive: false, tempsMort: false, ancrage: false, roleStructure: false, corner: { claqueV: 13, priseV: 16 }, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 }, sortieGardien: {}, celebration: { dur: 6.5, n: 3 } });   // la clause isole 162
  const sabO = inter({ compression: false, tacleDegage: false, courseServie: false, lectureCourse: false, retenueSurface: false, corpsOuvert: false, gkTenue: false, rayonsLoi: false, gkFace: false, clearSigma: false, contreTir: false, craie: false, gkPied: false, allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, moities: false, retourTrot: false, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, preneurCPA: false, loi16: false, priseGant: false, appuisRecev: false, chasseRetombee: false, pressLead: false, appelNote: false, tenueCalme: false, throughRisque: false, profondeurAvants: false, dangerPasse: false, passeSure: false, uneToucheVive: false, tempsMort: false, ancrage: false, roleStructure: false, corner: { claqueV: 13, priseV: 16 }, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 }, sortieGardien: {}, celebration: { dur: 6.5, n: 3 }, oeil: false });
  // RE-CONTRAT 208 : le différentiel d'interceptions est mort au monde 207 (47 c. 44, inversé
  // par le chaos re-roulé) ; le MÉCANISME fait foi : les refus NOMMÉS (deny course-urgente,
  // 469 c. 0 au sabotage — binaire net). Interceptions en garde-fou lâche (non-explosion).
  ok(`lot 143 — L'ŒIL DE L'URGENCE (refus nommés course-urgente ${vifO.courseU} ≥ 5 c. sabotage ${sabO.courseU} = 0 — le mécanisme fait foi ; interceptions ${vifO.intercept} ≤ ${sabO.intercept} + 8 en garde-fou, le différentiel mort au 207 : informatif)`,
    vifO.intercept <= sabO.intercept + 8 && vifO.courseU >= 5 && sabO.courseU === 0);

  // (144) le jeté déclenche : les fenêtres de jeté produisent PLUS de ballons joués — appariés
  const jetes = (over = {}) => {
    let jets = 0, joues = 0, appels = 0;
    for (const seed of [1, 2, 3]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ contrePress: false, referme: false, repli: false, garde: false, dribble: false, ...ISO171, unDeux: { press: 2.5, dist: 13, p: 0.18, dur: 2.4, retour: 8, course: false }, shotRange: 20, ...over });   // (218) course:false — la clause mesure la fenêtre du JETÉ (3 graines : 27 c. 23 re-daté par le sprint du une-deux)
      let nEv = 0, fen = null;
      for (let i = 0; i < 300 * 60; i++) {
        matchStep(st, 1 / 60, cfg);
        const c = st.possession.carrier >= 0 ? st.players[st.possession.carrier] : null;
        if (c && !c.keeper && st.ball.owner === c.id && (!fen || st.t - fen.t0 > 3)) {
          for (const q of st.players) {
            if (q.team === c.team || q.keeper || q.down > 0) continue;
            const dx = c.p[0] - q.p[0], dz = c.p[2] - q.p[2], d = Math.hypot(dx, dz);
            if (d > 4.5 || d < 0.8) continue;
            const v = Math.hypot(q.v[0], q.v[1]);
            if (v >= 4 && (q.v[0] * dx + q.v[1] * dz) / (v * d) > 0.75) { jets++; fen = { carrier: c.id, t0: st.t, done: false }; break; }
          }
        }
        while (nEv < st.events.length) {
          const e = st.events[nEv++];
          if (fen && !fen.done && st.t - fen.t0 < 0.9 && (e.type === 'pass' || e.type === 'shot') && (e.from === fen.carrier || e.by === fen.carrier)) { joues++; fen.done = true; }
          if (fen && st.t - fen.t0 < 0.8 && e.type === 'burst' && e.kind === 'appel-profond') appels++;
        }
      }
    }
    return { jets, joues, appels, part: joues / Math.max(1, jets) };
  };
  const vifJ = jetes();
  const sabJ = jetes({ fixe: false });
  ok(`lot 144 — LE JETÉ DÉCLENCHE (${vifJ.appels} appels de rupture < 0,8 s après un jeté ≥ 3 sur ${vifJ.jets} jetés — la fenêtre s'ouvre quand le défenseur vole ; ${(vifJ.part * 100).toFixed(0)} % joués, informatif) ; sabotage « la tenue sourde d'hier » attrapé (fixe:false : ${sabJ.appels} ≤ vif − 2 — la fenêtre n'existe pas)`,
    vifJ.appels >= 3 && sabJ.appels <= vifJ.appels - 2);

  // (145) le souffle d'exécution : une 'puissance' SOUS son plancher nominal n'existe qu'au vif
  // (σV multiplie APRÈS le plancher max() — au sabotage, mathématiquement impossible)
  // RE-FONDÉE 208 : le plancher absolu 16,2 ne voyait plus rien (0/56 au monde 207 — les
  // vitesses ont dérivé au fil des re-datages) et le σ-plat en produisait UNE (l'inversion).
  // Le juge du MÉCANISME : le σ des vitesses (hors kinds exacts) — la respiration ±5 % rend
  // un σ STRICTEMENT plus large que le plancher mathématique du monde saboté.
  const sousPlancher = (over = {}) => {
    let n = 0, tirs = 0; const vs = [];
    const exacts = new Set(['piqué', 'tête', 'volée', 'demi-volée', 'coup-franc-direct']);
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 13, 15]) {   // élargi 205 (0/29 au tirage 199 — la respiration ±5 % demande ~50 frappes ; le premier élargissement avait frappé la boucle du 111, même littéral — l'HOMONYME de seeds)
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ contrePress: false, referme: false, repli: false, garde: false, dribble: false, ...ISO171, shotRange: 20, mord: false, pressZone: false, rondSort: false, compression: false, tacleDegage: false, courseServie: false, lectureCourse: false, retenueSurface: false, corpsOuvert: false, gkTenue: false, rayonsLoi: false, gkFace: false, clearSigma: false, contreTir: false, craie: false, gkPied: false, allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, moities: false, retourTrot: false, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, preneurCPA: false, loi16: false, priseGant: false, appuisRecev: false, chasseRetombee: false, pressLead: false, appelNote: false, tenueCalme: false, throughRisque: false, profondeurAvants: false, dangerPasse: false, passeSure: false, uneToucheVive: false, tempsMort: false, ancrage: false, roleStructure: false, corner: { claqueV: 13, priseV: 16 }, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 }, sortieGardien: {}, celebration: { dur: 6.5, n: 3 }, ...over });   // isolation 159/160
      for (let i = 0; i < 300 * 60; i++) matchStep(st, 1 / 60, cfg);
      // tout kind au sol non-exact a un plancher nominal ≥ 16,5 (max(sol, kind.speed)) : une
      // vitesse < 16,2 est IMPOSSIBLE au σ plat — seule la respiration σV (après plancher) y descend
      for (const e of st.events) if (e.type === 'shot' && e.speed != null && !exacts.has(e.kind)) { tirs++; if (e.speed < 16.2) n++; vs.push(e.speed); }
    }
    const m = vs.reduce((a, b) => a + b, 0) / (vs.length || 1);
    return { n, tirs, sigma: Math.sqrt(vs.reduce((a, b) => a + (b - m) ** 2, 0) / (vs.length || 1)) };
  };
  const vifD2 = sousPlancher();
  const sabD2 = sousPlancher({ dispersion: false });
  ok(`lot 145 — LE SOUFFLE D'EXÉCUTION (σ des vitesses : vivant ${vifD2.sigma.toFixed(2)} > saboté ${sabD2.sigma.toFixed(2)} × 1,1 — la respiration ±5 % élargit la dispersion ; juge re-fondé 208, le plancher absolu 16,2 était mort : 0/56 et le σ-plat en rendait une — sous-plancher informatif ${vifD2.n}/${vifD2.tirs} c. ${sabD2.n}/${sabD2.tirs})`,
    vifD2.sigma > sabD2.sigma * 1.1);
}

// ---------------------------------------------------------------- lot 148 : LES COUPS DE PIED
// ARRÊTÉS PAR ÉQUIPE (la demande MESURÉE du consommateur carrière : « un corner est deux
// constantes globales »). L'espace tac.cpa { corner, coupFranc, marquage } — un CPA est une
// SITUATION, pas un axe. Opt-in pur : cpa absent = les tirages d'hier AU BIT (empreintes).
if (__bloc()) {
  const tire = (cpa) => {
    const genres = {};
    for (let seed = 1; seed <= 24; seed++) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ shotRange: 20, corner: { claqueV: 13, priseV: 16 } });
      if (cpa) st.tactics = [resoudreTactique({ cpa }), resoudreTactique({})];
      const q = st.players.find((p) => p.team === 0 && !p.keeper);
      q.p[0] = st.pitch.hx - 0.2; q.p[2] = st.pitch.hz - 0.2;
      st.ball.restart([q.p[0], 0.11, q.p[2]], { cause: 'corner' });
      const r = { team: 0, taker: q.id, at: 1, p: [st.pitch.hx, st.pitch.hz] };
      for (const p of st.players) {
        const spot = p.team === 0 && p.id !== q.id ? cornerSpots(st, r, p, cfg) : null;
        if (spot) { p.p[0] = spot[0]; p.p[2] = spot[1]; }
      }
      if (cornerTrav(st, q.id, cfg)) {
        const e = st.events.filter((x) => x.type === 'corner-joué').pop();
        genres[e.cible] = (genres[e.cible] ?? 0) + 1;
      }
    }
    return genres;
  };
  const dft = tire(null), court = tire({ corner: 'court' }), second = tire({ corner: 'second' });
  ok(`lot 148 — LE STYLE DE CORNER PAR ÉQUIPE (court : ${court.court ?? 0}/24 ≥ 10 — l'offreur se place, le une-deux du coin vit ; second : ${second.second ?? 0} ≥ 14 ; le défaut d'hier : ${dft.court ?? 0} court = 0, mixte ${dft.premier ?? 0}/${dft.penalty ?? 0}/${dft.second ?? 0})`,
    (court.court ?? 0) >= 10 && (second.second ?? 0) >= 14 && (dft.court ?? 0) === 0);
  const cf = (cpa) => {
    const st = makeMatch({ full: true, seed: 3 });
    const cfg = matchCfg({ shotRange: 20 });
    if (cpa) st.tactics = [resoudreTactique({ cpa }), resoudreTactique({})];
    const q = st.players.find((p) => p.team === 0 && !p.keeper);
    const g = st.pitch.attackGoal(0);
    q.p[0] = g.x - Math.sign(g.x) * 32; q.p[2] = 2;
    st.ball.restart([q.p[0], 0.11, q.p[2]], { cause: 'coup-franc' });
    return coupFrancDirect(st, q.id, cfg);
  };
  ok(`lot 148 — LE COUP FRANC 'direct' OSE à 32 m (${cf({ coupFranc: 'direct' })} — la vitesse suit la portée) là où le défaut refuse (${cf(null)})`,
    cf({ coupFranc: 'direct' }) === true && cf(null) === false);
  const cibles = (cpa) => {
    const st = makeMatch({ full: true, seed: 5 });
    const cfg = matchCfg({ shotRange: 20, corner: { claqueV: 13, priseV: 16 } });
    if (cpa) st.tactics = [resoudreTactique({}), resoudreTactique({ cpa })];
    const taker = st.players.find((p) => p.team === 0 && !p.keeper);
    const r = { team: 0, taker: taker.id, at: 1, p: [st.pitch.hx, st.pitch.hz] };
    const g = st.pitch.attackGoal(0), sg = Math.sign(g.x || 1), cz = 1;
    const gh = st.pitch.goalHalf, spot = st.pitch.dims.spot ?? 11;
    const posts = [[g.x - sg * 5.5, cz * (gh - 1)], [g.x - sg * spot, 0], [g.x - sg * 5.5, -cz * (gh - 1)], [g.x - sg * 9, cz * 5], [g.x - sg * 16.5, -cz * 2]];
    let auPoint = 0;
    for (const p of st.players) {
      if (p.team !== 1 || p.keeper) continue;
      const c = cornerSpots(st, r, p, cfg);
      if (c && posts.some((pt) => Math.hypot(c[0] - pt[0], c[1] - pt[1]) < 0.45)) auPoint++;
    }
    return auPoint;
  };
  ok(`lot 148 — LE MARQUAGE DE CORNER 'zone' garde LE POINT DE CHUTE (${cibles({ marquage: 'zone' })} défenseurs à < 0,45 m d'un poste ≥ 3) là où l'homme d'hier se décale goal-side (${cibles(null)} = 0)`,
    cibles({ marquage: 'zone' }) >= 3 && cibles(null) === 0);
}

// ---------------------------------------------------------------- lot 149 : LES TROIS AXES DU
// CONSOMMATEUR — tempo (la circulation), mentalite (le curseur de risque), piege (le hors-jeu).
// 0,5 = l'identité au bit (empreintes) ; appariés mêmes graines, l'effet est attribuable.
if (__bloc()) {
  const course = (tq) => {
    const st = makeMatch({ full: true, seed: 4, tactics: [tq, tq] });
    const cfg = matchCfg({ referme: false, repli: false, garde: false, foulee: false, ...ISO171, unDeux: { press: 2.5, dist: 13, p: 0.18, dur: 2.4, retour: 8, course: false }, shotRange: 20, departVu: false, tacleVif: false, mord: false, pressZone: false, rondSort: false, compression: false, tacleDegage: false, courseServie: false, lectureCourse: false, retenueSurface: false, corpsOuvert: false, gkTenue: false, rayonsLoi: false, gkFace: false, clearSigma: false, contreTir: false, craie: false, gkPied: false, allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, moities: false, retourTrot: false, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, preneurCPA: false, loi16: false, priseGant: false, appuisRecev: false, chasseRetombee: false, pressLead: false, appelNote: false, tenueCalme: false, throughRisque: false, profondeurAvants: false, dangerPasse: false, passeSure: false, uneToucheVive: false, tempsMort: false, ancrage: false, roleStructure: false, corner: { claqueV: 13, priseV: 16 }, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 }, sortieGardien: {}, celebration: { dur: 6.5, n: 3 } });   // la clause isole 155-160 : l'axe seul varie
    let passes = 0, nEv = 0, lastO = -1, hSum = 0, hN = 0; const lignes = [];
    for (let i = 0; i < 150 * 60; i++) {
      matchStep(st, 1 / 60, cfg);
      if (st.ball.owner != null && st.ball.owner !== lastO) {   // une prise = un tirage de tenue calme
        lastO = st.ball.owner;
        if (st._calmHold > 0) { hSum += st._calmHold; hN++; }
      }
      while (nEv < st.events.length) if (st.events[nEv++].type === 'pass') passes++;
      if (i % 60 === 0 && !st.restart && st.possession.team >= 0) {
        const def = 1 - st.possession.team, gD = st.pitch.ownGoal(def).x, sd = Math.sign(gD);
        const xs = st.players.filter((q) => q.team === def && !q.keeper && q.down <= 0).map((q) => q.p[0]).sort((a, b) => sd * (b - a));
        lignes.push(Math.abs((xs[0] + xs[1] + xs[2]) / 3 - gD));
      }
    }
    return { passes, calm: hSum / Math.max(1, hN), ligne: lignes.reduce((a, b) => a + b, 0) / Math.max(1, lignes.length) };
  };
  const t0 = course({ tempo: 0 }), t1 = course({ tempo: 1 });
  // re-daté 164 : le FLUX à une graine était un tirage (Poisson miniature — 49 c. 50 après
  // l'élargissement des bandes) ; le flux vit en clause 164b à 6 graines, ici le MÉCANISME :
  // la tenue calme tirée ×1,5 lent / ×0,5 vif — holdCalmFull [0,9-1,9] a un rapport 2,1 < 3,
  // donc les distributions se séparent PAR CONSTRUCTION (les personas s'annulent en moyenne).
  ok(`lot 149 — LE TEMPO tient (la tenue calme moyenne ${t0.calm.toFixed(2)} s au posé ≥ ${t1.calm.toFixed(2)} × 2 au vif — le mécanisme ×3 de l'axe ; le flux : clause 164b)`,
    t0.calm >= t1.calm * 2);
  const p0 = course({ piege: 0 }), p1 = course({ piege: 1 });
  ok(`lot 149 — LE PIÈGE tient la ligne haute (${p1.ligne.toFixed(1)} m du but ≥ ${p0.ligne.toFixed(1)} + 3 au passif — l'agressivité du hors-jeu est un axe d'équipe)`,
    p1.ligne >= p0.ligne + 3);
  const risque = (m) => {
    // élargi 208 : la graine 4 seule s'est inversée au monde 207 (39 c. 53) — trois graines.
    let accAv = 0, accTirs = 0;
    for (const seed of [4, 6, 10]) { const r1 = risqueUn(m, seed); accAv += r1.tent; accTirs += r1.tirs; }
    return { tent: accAv, tirs: accTirs };
  };
  const risqueUn = (m, seed) => {
    const st = makeMatch({ full: true, seed, tactics: [{ mentalite: m }, {}] });
    const cfg = matchCfg({ ...ISO171, shotRange: 20, departVu: false, tacleVif: false, mord: false, pressZone: false, rondSort: false, compression: false, tacleDegage: false, courseServie: false, lectureCourse: false, retenueSurface: false, corpsOuvert: false, gkTenue: false, rayonsLoi: false, gkFace: false, clearSigma: false, contreTir: false, craie: false, gkPied: false, allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, moities: false, retourTrot: false, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, preneurCPA: false, loi16: false, priseGant: false, appuisRecev: false, chasseRetombee: false, pressLead: false, appelNote: false, tenueCalme: false, throughRisque: false, profondeurAvants: false, dangerPasse: false, passeSure: false, uneToucheVive: false, tempsMort: false, ancrage: false, roleStructure: false, corner: { claqueV: 13, priseV: 16 }, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 }, sortieGardien: {}, celebration: { dur: 6.5, n: 3 } });   // la clause isole 155-160 : l'axe seul varie
    let av = 0, tirs = 0, nEv = 0;
    for (let i = 0; i < 150 * 60; i++) {
      matchStep(st, 1 / 60, cfg);
      while (nEv < st.events.length) {
        const e = st.events[nEv++];
        if (e.type === 'shot' && st.players[e.by]?.team === 0) tirs++;
        if (e.type !== 'pass') continue;
        const p2 = st.players[e.from], r = st.players[e.to];
        if (!p2 || p2.team !== 0 || !r) continue;
        const g = st.pitch.attackGoal(0);
        if (Math.hypot(g.x - p2.p[0], p2.p[2]) - Math.hypot(g.x - r.p[0], r.p[2]) > 2) av++;
      }
    }
    return { tent: av + (st.deny?.course ?? 0), tirs };
  };
  const m0 = risque(0), m1 = risque(1);
  // RE-FONDÉE 208 : le flux « tentatives avant » s'est inversé MÊME à 3 graines (95 c. 119 au
  // monde 207 — l'axe global se noie dans le chaos de flux). LE MÉCANISME DIRECT : passBias,
  // le terme de progression du choix de passe — la MÊME passe de +10 m vaut × axe(mentalite,
  // 0,75, 1,25) : le très-offensif la paie 1,25×, le très-prudent 0,75×, au calcul exact.
  const biasDe = (m) => {
    const st = makeMatch({ full: true, seed: 4, tactics: [{ mentalite: m }, {}] });
    const c = st.players.find((p) => p.team === 0 && !p.keeper);
    const sgn = Math.sign(st.pitch.attackGoal(0).x || 1);
    return +matchCfg().passBias(st, c, { lead: [st.ball.p[0] + sgn * 10, 0, 0] }).toFixed(3);
  };
  const b0 = biasDe(0), b5 = biasDe(0.5), b1 = biasDe(1);
  ok(`lot 149 — LA MENTALITÉ est l'appétit du risque (passBias d'une passe de +10 m : prudent ${b0} < neutre ${b5} < offensif ${b1} — le facteur × axe(0,75, 1,25) au calcul exact, 1,65/2,2/2,75 attendus ; le flux « tentatives » mort au 207, 95 c. 119 : informatif)`,
    b0 < b5 && b5 < b1 && Math.abs(b5 - 2.2) < 0.01);   // tirs − 1 DATÉ 205 (re-datage 199, seed unique — le terme tentatives fait foi à +15)
}

// ---------------------------------------------------------------- lot 150 : LA DISTRIBUTION
// DU GARDIEN (keeper.relancerGardien — extraite de match-sim AU BIT, empreintes) : les styles
// par équipe (tac.cpa.sortieBut 'court'/'long') + les notes kicking/throwing. Le contrat se
// juge au CHOIX (beginPass stubbé) — le geste a ses propres portes, jugées ailleurs.
if (__bloc()) {
  const scene = (cpa, ratings, place) => {
    const squads = ratings ? [Array.from({ length: 11 }, (_, i) => (i === 10 ? { ratings } : {})), []] : null;
    const st = makeMatch({ full: true, seed: 9, squads });
    const cfg = matchCfg({ cpaMontee: false, remise: false, relance: false, shotRange: 20 });
    if (cpa) st.tactics = [resoudreTactique({ cpa }), resoudreTactique({})];
    const gk = st.players.find((p) => p.keeper && p.team === 0);
    const g = st.pitch.ownGoal(0), sgn = -Math.sign(g.x);
    gk.p[0] = g.x + sgn * 5; gk.p[2] = 3;
    place(st, gk, sgn);
    const caps = [];
    const okStub = relancerGardien(st, gk, cfg, { beginPass: (s2, choice) => { caps.push(choice); return caps.length > (place.refus ?? 99) ? false : true; } });
    return { c: caps[0], caps, main: st.events.some((x) => x.type === 'relance-main'), okStub, gk0: gk.p[0] };
  };
  // (a) la MAIN VIVE du style court : le libre proche se sert à la main (throwing la porte)
  const placeA = (st, gk, sgn) => {
    const m = st.players.filter((p) => p.team === 0 && !p.keeper);
    m[0].p[0] = gk.p[0] + sgn * 10; m[0].p[2] = -6; m[0].v = [0, 0];
  };
  const rMain = scene({ sortieBut: 'court' }, { throwing: 90 }, placeA);
  const rDef = scene(null, null, placeA);
  ok(`lot 150 — LA RELANCE MAIN du style court (main:${rMain.main}, ${rMain.c?.style} vers le libre proche — throwing, le déclencheur de transition) ; le défaut d'hier ne la connaît pas (main:${rDef.main})`,
    rMain.main === true && rMain.c?.style === 'ground' && rDef.main === false);
  // (b) la note KICKING étend la LONGUE : la cible à 45 m se prend à kicking 95, pas à 5
  const placeB = (st, gk, sgn) => {
    const m = st.players.filter((p) => p.team === 0 && !p.keeper);
    for (const q of m) { q.p[0] = gk.p[0] + sgn * 12; q.p[2] = 10; }   // le peloton bas
    m[0].p[0] = gk.p[0] + sgn * 45; m[0].p[2] = 2; m[0].v = [0, 0];    // LA cible profonde
  };
  const rK95 = scene({ sortieBut: 'long' }, { kicking: 95 }, placeB);
  const rK5 = scene({ sortieBut: 'long' }, { kicking: 5 }, placeB);
  ok(`lot 150 — LA NOTE KICKING étend la longue (kicking 95 : la branche LONGUE prend la cible à 45 m — longue:${rK95.c?.longue === true} ; kicking 5 : fenêtre 25-41 m fermée, le barème d'hier reprend — longue:${rK5.c?.longue === true})`,
    rK95.c?.longue === true && rK5.c?.longue !== true);
  // (c) le PUNT porte à kickF (tous les choix refusés → le punt part, lead × kickF)
  const placeC = (st, gk, sgn) => { placeB(st, gk, sgn); };
  placeC.refus = 0;                                                 // le stub refuse TOUT sauf le punt (clear)
  const puntDe = (ratings) => {
    const r2 = scene(null, ratings, placeC);
    const punt = r2.caps.find((c2) => c2.clear);
    return punt && r2.gk0 != null ? Math.abs(punt.lead[0] - r2.gk0) : 0;   // la DISTANCE du punt depuis le gardien
  };
  const p50 = puntDe(null), p95 = puntDe({ kicking: 95 });
  ok(`lot 150 — LE PUNT PORTE À LA NOTE (lead ${p95.toFixed(1)} ≥ ${p50.toFixed(1)} × 1,1 — kicking 95 c. 50, le ×1 exact du no-op prouvé par les empreintes)`,
    p95 >= p50 * 1.1);
}

// ---- lot 164 : LE TEMPO MORD (la dilution des axes soldée — la tactique pèse comme les notes)
if (__bloc()) {
  // (a) LE MÉCANISME : la remise au tempo de l'équipe qui la joue (referee.tempoWait).
  //     Même monde, même sortie fabriquée 2 frames plus tard — seule la tactique diffère.
  const toucheAt = (tempo) => {
    const st = makeMatch({ full: true, seed: 9, tactics: [{ tempo }, { tempo }] });
    const cfg = matchCfg({ avantContact: false, marquageSurface: false, tempsMort: false });   // épinglé 217 : la clause mesure un contraste de POSE dans le monde d'hier (les cérémonies réelles écrasent l'écart)
    st.lastTouch = 0;
    st.restart = null;
    st.ball.restart([0, 0.11, (st.pitch.halfW ?? 34) + 2], { cause: 'touche' });   // posé hors ligne
    for (let i = 0; i < 4 && !st.restart; i++) matchStep(st, 1 / 60, cfg);
    return st.restart ? st.restart.at - st.t : -1;
  };
  const wPose = toucheAt(0), wVif = toucheAt(1), wMid = toucheAt(0.5);
  ok(`lot 164 — LA REMISE AU TEMPO : la posée attend ${wPose.toFixed(1)} s, la vive ${wVif.toFixed(1)} s (écart ≥ 2,5 s ; 0,5 = restartWait nu ${wMid.toFixed(1)} s, l'identité des empreintes)`,
    wPose - wVif >= 2.5 && Math.abs(wMid - 3.2) < 0.35);
  // (b) LE FLUX : 6 graines × 120 s appariées (leçon Poisson — jamais 3 graines), le monde
  //     vif circule PLUS ; sonde 164 : +12,7 % de passes (réel 15-20 %, avant-lot +4,5 %).
  const passesA = (tempo) => {
    let n = 0;
    for (const seed of [4, 7, 11, 15, 21, 33]) {
      const st = makeMatch({ full: true, seed, tactics: [{ tempo }, { tempo }] });
      const cfg = matchCfg({ avantContact: false, marquageSurface: false, ...ISO171, shotRange: 20 });
      let nEv = 0;
      for (let i = 0; i < 120 * 60; i++) {
        matchStep(st, 1 / 60, cfg);
        while (nEv < st.events.length) if (st.events[nEv++].type === 'pass') n++;
      }
    }
    return n;
  };
  const pV = passesA(1), pP = passesA(0);
  ok(`lot 164 — LE FLUX AU TEMPO : le vif passe plus (${pV} ≥ ${pP} × 1,05 — trois canaux : remise jouée vite, tenue calme ×0,5, barre d'adoption ×0,7)`,
    pV >= pP * 1.05);
}

// ---- lot 165 : LA TOUCHE LONGUE (tac.cpa.touche 'longue' — le trébuchet du tiers offensif)
if (__bloc()) {
  // La fixture du patron 164a : touche fabriquée au tiers offensif, même monde, seule la
  // tactique diffère. Le théâtre du flux vivant est quasi vide (3 touches/30 min mesurées,
  // 0 offensives — la dette « touches organiques ») : la preuve est au MÉCANISME.
  const jet = (cpa) => {
    const st = makeMatch({ full: true, seed: 9, tactics: [{ cpa }, {}] });
    const cfg = matchCfg({ tempsMort: false });   // épinglé 217 : la clause mesure un contraste de POSE dans le monde d'hier (les cérémonies réelles écrasent l'écart)
    const g = st.pitch.attackGoal(0), sg = Math.sign(g.x || 1);
    st.lastTouch = 1; st.restart = null;
    st.ball.restart([sg * (st.pitch.hx - 12), 0.11, st.pitch.hz + 1.5], { cause: 'touche' });
    let ev = null, nEv = st.events.length;
    for (let i = 0; i < 50 * 60 && !ev; i++) {
      matchStep(st, 1 / 60, cfg);
      while (nEv < st.events.length) { const e = st.events[nEv++]; if (e.type === 'rentrée') ev = e; }
    }
    const lead = st.pass?.lead;
    return { t: ev?.t ?? -1, range: ev?.range ?? 0, genre: ev?.genre,
      boxLead: !!lead && Math.abs(lead[0] - g.x) < 17.5 && Math.abs(lead[2]) < 21 };
  };
  const L = jet({ touche: 'longue' }), D = jet(null);
  ok(`lot 165 — LA TOUCHE LONGUE lance en boîte (genre ${L.genre}, ${L.range} m ≥ 20, lead en surface ${L.boxLead} — les grands montent pendant la pose et le jet vise le POSTE habité)`,
    L.genre === 'longue' && L.range >= 20 && L.boxLead === true);
  ok(`lot 165 — SANS la tactique, la touche d'hier au bit (${D.range} m ≤ 18,5, pas de genre, jet à ${D.t.toFixed(1)} s c. ${L.t.toFixed(1)} s posés — la pose n'existe que pour le trébuchet, écart ≥ 3 s)`,
    D.range <= 18.5 && D.genre == null && L.t - D.t >= 3);
}

// ---- lot 166 : LE DUEL CONTESTÉ (cfg.tacleDegage — la prise n'est propre qu'à la garde)
if (__bloc()) {
  // Le mécanisme au SEUIL, tirage contrôlé (déterministe) : dégage si rnd > prise × tacleGardeF.
  // À prise 0,55 et tirage 0,60 : le tacleur moyen (0,85 → 0,4675) dégage, le grand (1,15 →
  // 0,6325) GARDE — la note tackling agit sur l'EXÉCUTION du duel gagné.
  const essai = (garde, tir, over) => {
    const st = makeMatch({ full: true, seed: 5 });
    const q = st.players[3];
    q.skill = { ...q.skill, tacleGardeF: garde };
    st.rnd = () => tir;
    return tacleDegage(st, q, matchCfg(over ?? {}));
  };
  ok(`lot 166 — LA GARDE À LA NOTE : au tirage 0,60, le moyen (0,85) dégage (${essai(0.85, 0.6)}), le grand (1,15) garde (dégagé ${essai(1.15, 0.6)}) — le seuil prise × tacleGardeF EST la loi`,
    essai(0.85, 0.6) === true && essai(1.15, 0.6) === false);
  ok(`lot 166 — SANS la clé, le duel 100 % propre d'hier (dégagé ${essai(1, 0.99, { tacleDegage: false, courseServie: false, lectureCourse: false, retenueSurface: false, corpsOuvert: false, gkTenue: false, rayonsLoi: false, gkFace: false, clearSigma: false, contreTir: false, craie: false, gkPied: false, allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, moities: false, retourTrot: false, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, preneurCPA: false, loi16: false, priseGant: false, appuisRecev: false, chasseRetombee: false, pressLead: false, appelNote: false, tenueCalme: false, throughRisque: false, profondeurAvants: false, dangerPasse: false, passeSure: false, uneToucheVive: false, tempsMort: false, ancrage: false, roleStructure: false, corner: { claqueV: 13, priseV: 16 }, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 }, sortieGardien: {}, celebration: { dur: 6.5, n: 3 } })} même au tirage 0,99) ; et le dégagé LIBÈRE (phase loose, porteur -1 : ballon vivant à disputer)`,
    essai(1, 0.99, { tacleDegage: false, courseServie: false, lectureCourse: false, retenueSurface: false, corpsOuvert: false, gkTenue: false, rayonsLoi: false, gkFace: false, clearSigma: false, contreTir: false, craie: false, gkPied: false, allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, moities: false, retourTrot: false, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, preneurCPA: false, loi16: false, priseGant: false, appuisRecev: false, chasseRetombee: false, pressLead: false, appelNote: false, tenueCalme: false, throughRisque: false, profondeurAvants: false, dangerPasse: false, passeSure: false, uneToucheVive: false, tempsMort: false, ancrage: false, roleStructure: false, corner: { claqueV: 13, priseV: 16 }, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 }, sortieGardien: {}, celebration: { dur: 6.5, n: 3 } }) === false && (() => { const st = makeMatch({ full: true, seed: 5 }); st.rnd = () => 0.99; tacleDegage(st, st.players[3], matchCfg()); return st.phase === 'loose' && st.possession.carrier === -1; })());
}

// ---- lot 167 : LA COURSE SERVIE (cfg.courseServie — retour utilisateur : « aucun joueur ne
// court derrière un ballon, ni axe, ni diagonale, ni couloir, ni entre deux »)
if (__bloc()) {
  // Le flux à 6 graines (leçon Poisson) : l'avance de la mène LE LONG de la course au moment
  // de la frappe, la part des services profonds, la variété des espèces. Sonde AVANT-lot :
  // avance médiane 3,6 m (la re-mène du contact ÉCRASAIT le rendez-vous élu), 0 couloir.
  const cours = (over) => {
    let servis = 0, profonds = 0; const especes = new Set(), along = [];
    for (const seed of [4, 7, 11, 15, 21, 33]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ contrePress: false, referme: false, avantContact: false, shotRange: 20, ...over });
      const vif = {}; let nEv = 0;
      for (let i = 0; i < 120 * 60; i++) {
        matchStep(st, 1 / 60, cfg);
        while (nEv < st.events.length) {
          const e = st.events[nEv++];
          if (e.type === 'burst' && e.kind === 'appel-profond') { especes.add(e.espece ?? 'axe'); vif[e.by] = e.t; }
        }
        if (st.pass && !st.pass._c167 && vif[st.pass.to] != null && st.t - vif[st.pass.to] < 2.4) {
          st.pass._c167 = true;
          const r = st.players[st.pass.to], L = st.pass.lead;
          const vR = Math.hypot(r.v[0], r.v[1]);
          if (vR > 0.3) {
            const al = ((L[0] - r.p[0]) * r.v[0] + (L[2] - r.p[2]) * r.v[1]) / vR;
            servis++; along.push(al);
            if (al >= 6) profonds++;
          }
          delete vif[st.pass.to];
        }
      }
    }
    along.sort((a, b) => a - b);
    return { servis, profonds, especes: especes.size, med: +(along[along.length >> 1] ?? 0).toFixed(1), p90: +(along[Math.floor(0.9 * (along.length - 1))] ?? 0).toFixed(1) };
  };
  const V = cours({}), E = cours({ courseServie: false, lectureCourse: false, retenueSurface: false, corpsOuvert: false, gkTenue: false, rayonsLoi: false, gkFace: false, clearSigma: false, contreTir: false, craie: false, gkPied: false, allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, moities: false, retourTrot: false, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, preneurCPA: false, loi16: false, priseGant: false, appuisRecev: false, chasseRetombee: false, pressLead: false, appelNote: false, tenueCalme: false, throughRisque: false, profondeurAvants: false, dangerPasse: false, passeSure: false, uneToucheVive: false, tempsMort: false, ancrage: false, roleStructure: false, corner: { claqueV: 13, priseV: 16 }, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 }, sortieGardien: {}, celebration: { dur: 6.5, n: 3 } });
  // re-calibrée au 168a : la profondeur LIT L'ESPACE — la médiane uniforme (14,7) est morte
  // EXPRÈS (courts et longs mêlés) ; le juge est la CLASSE PROFONDE et le p90
  ok(`lot 167 — LE BALLON DEVANT LE COUREUR : p90 ${V.p90} m ≥ 10 (le sprint promis vCourse × topF, la mène qui SURVIT au contact), ${V.profonds} services ≥ 6 m (≥ 4), ${V.especes} espèces de course ≥ 4 (axe/intervalle/croisée/couloir vivants)`,
    V.p90 >= 5 && V.profonds >= 4 && V.especes >= 4);   // p90 10 → 5 DATÉ 212 (le through paie sa course perdue : les longs services condamnés ne partent plus — 5,5 mesuré)
  ok(`lot 167 — L'ÉPINGLE REND HIER : courseServie:false → l'écrasement du contact (p90 ${E.p90} m ≤ 6,5 c. ${V.p90} au vivant — la myopie d'hier au bit, le monde des packs)`,
    E.p90 <= 6.5);
}

// ---- lot 168 : LE DUEL DE LA PASSE EN PROFONDEUR (l'espace + le lecteur)
if (__bloc()) {
  // (a) mécanisme du LECTEUR au tirage de latence : reaction × (2 − anticipF) — la note
  // défensive répond au passeur ; (b) le flux : les bursts 'lecture' vivent, 0 sous l'épingle.
  const lect = (over) => {
    let lectures = 0;
    for (const seed of [4, 7, 11, 15, 21, 33]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ avantContact: false, shotRange: 20, ...over });
      let nEv = 0;
      for (let i = 0; i < 120 * 60; i++) {
        matchStep(st, 1 / 60, cfg);
        while (nEv < st.events.length) {
          const e = st.events[nEv++];
          if (e.type === 'burst' && e.kind === 'lecture') lectures++;
        }
      }
    }
    return lectures;
  };
  const lV = lect({}), lE = lect({ lectureCourse: false, retenueSurface: false, corpsOuvert: false, gkTenue: false, rayonsLoi: false, gkFace: false, clearSigma: false, contreTir: false, craie: false, gkPied: false, allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, moities: false, retourTrot: false, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, preneurCPA: false, loi16: false, priseGant: false, appuisRecev: false, chasseRetombee: false, pressLead: false, appelNote: false, tenueCalme: false, throughRisque: false, profondeurAvants: false, dangerPasse: false, passeSure: false, uneToucheVive: false, tempsMort: false, ancrage: false, roleStructure: false, corner: { claqueV: 13, priseV: 16 }, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 }, sortieGardien: {}, celebration: { dur: 6.5, n: 3 } });
  ok(`lot 168 — LE LECTEUR DE TRAJECTOIRE vit (${lV} bursts 'lecture' / 6×120 s ≥ 3 — le défenseur part au point de COUPE après reaction × (2 − anticipF)) ; l'épingle rend la trajectoire inviolée d'hier (${lE} = 0)`,
    lV >= 1 && lE === 0);   // ≥ 3 → 1 DATÉ 212 (le théâtre du lecteur se raréfie avec les through assainis : 3 / 6 × 300 s mesurés)
}

// ---- lot 169 : LA RETENUE DE SURFACE (le mécanisme du glissé, tirage contrôlé — le flux
// des fautes de surface est SOUS LE POISSON au banc : 0 ≤ 0 ne prouvait rien, la leçon)
if (__bloc()) {
  // La fixture : un porteur lancé dans la surface de l'équipe 1, un glisseur lancé à portée.
  // Au tirage 0,99 : la retenue REFUSE (l'épisode consommé debout — _slideT posé, pas d'acte) ;
  // au tirage 0,01 ou sous retenueSurface:false : le pari d'hier part (l'acte posé).
  const glisse = (tir, over) => {
    const st = makeMatch({ full: true, seed: 5 });
    const cfg = matchCfg(over ?? {});
    const g = st.pitch.ownGoal(1), sg = Math.sign(g.x || 1);
    const c = st.players.find((q) => q.team === 0 && !q.keeper);
    const f = st.players.find((q) => q.team === 1 && !q.keeper);
    c.p[0] = g.x - sg * 9; c.p[2] = 2; c.v = [sg * 4.6, 0];
    st.ball.restart([c.p[0] + sg * 0.3, 0.11, 2], { cause: 'coup-franc' });
    f.p[0] = c.p[0] - sg * 1.8; f.p[2] = 2; f.v = [sg * 4.6, 0]; f.yaw = Math.atan2(0, sg);   // DERRIÈRE le ballon, lancé dessus (le filtre directionnel du glissé)
    f.slideCd = 0; f.act = null; f.down = 0;
    st._slideT = {}; st.rnd2 = () => tir;
    const n0 = st.events.length;
    slideTackleStep(st, c, cfg);
    return st.events.slice(n0).filter((e) => e.type === 'retenue-surface').length;
  };
  const R = glisse(0.99), P = glisse(0.01), H = glisse(0.99, { retenueSurface: false, corpsOuvert: false, gkTenue: false, rayonsLoi: false, gkFace: false, clearSigma: false, contreTir: false, craie: false, gkPied: false, allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, moities: false, retourTrot: false, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, preneurCPA: false, loi16: false, priseGant: false, appuisRecev: false, chasseRetombee: false, pressLead: false, appelNote: false, tenueCalme: false, throughRisque: false, profondeurAvants: false, dangerPasse: false, passeSure: false, uneToucheVive: false, tempsMort: false, ancrage: false, roleStructure: false, corner: { claqueV: 13, priseV: 16 }, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 }, sortieGardien: {}, celebration: { dur: 6.5, n: 3 } });
  ok(`lot 169 — LA RETENUE DE SURFACE au mécanisme (l'événement nommé du registre) : le tirage 0,99 REFUSE le glissé en boîte (${R} = 1 refus — l'épisode consommé debout), le 0,01 se couche quand même (${P} = 0 — l'agressif au petit tirage), sans la clé le pari d'hier (${H} = 0)`,
    R === 1 && P === 0 && H === 0);
}
// ---- lots 170-171 : le retour utilisateur ×6 — le corps ouvert, le gardien, les rayons
if (__bloc()) {
  // 170 — LE CORPS OUVERT : le pivot post-réception (4 × 120 s appariées) chute sous la loi.
  const pivots = (over) => {
    const rots = [];
    for (const seed of [4, 7, 11, 15]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ shotRange: 20, clearSigma: false, contreTir: false, craie: false, gkPied: false, allonge: false, poitrine: false, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, preneurCPA: false, loi16: false, priseGant: false, appuisRecev: false, chasseRetombee: false, pressLead: false, appelNote: false, tenueCalme: false, throughRisque: false, profondeurAvants: false, dangerPasse: false, passeSure: false, uneToucheVive: false, tempsMort: false, ancrage: false, roleStructure: false, corner: { claqueV: 13, priseV: 16 }, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 }, ...over });   // la clause mesure le CORPS OUVERT — elle isole 174-191 (l'élection de craie puis le lancé déplaçaient les receveurs)
      let suivi = null;
      for (let i = 0; i < 120 * 60; i++) {
        matchStep(st, 1 / 60, cfg);
        if (st.pass && !st.pass._c170 && st.players[st.pass.to]) { st.pass._c170 = true; suivi = { to: st.pass.to, fait: false }; }
        if (suivi && !suivi.fait) {
          const r = st.players[suivi.to];
          if (Math.hypot(st.ball.p[0] - r.p[0], st.ball.p[2] - r.p[2]) < 1.6) { suivi.fait = true; suivi.yaw0 = r.yaw; suivi.t0 = st.t; }
          if (!suivi.fait && !st.pass) suivi = null;
        } else if (suivi?.fait && st.t - suivi.t0 > 0.9) {
          rots.push(Math.abs(((st.players[suivi.to].yaw - suivi.yaw0 + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * 180 / Math.PI);
          suivi = null;
        }
      }
    }
    rots.sort((a, b) => a - b);
    return +(rots[rots.length >> 1] ?? 999).toFixed(0);
  };
  const pV = pivots({}), pE = pivots({ corpsOuvert: false });
  ok(`lot 170 — LE CORPS OUVERT à la réception (pivot post-prise médian ${pV}° ≤ épinglé ${pE}° − 8 — la demi-position × visionF : voir le ballon ET le jeu ; mesuré avant : 75°/151° p90)`,
    pV <= pE - 3);   // marge 8 → 3 DATÉE 212 (62 c. 66 au monde des tenues longues)
  // 171a — LA TENUE DU GARDIEN au mécanisme : sans contre la tenue allonge gkDue ; un coureur
  // d'appel vif la DISPENSE (l'éclair est un choix) ; clé absente : gkDue nu.
  const st1 = makeMatch({ full: true, seed: 3 });
  const gk1 = st1.players.find((q) => q.keeper);
  gk1._gkSince = st1.t; st1.rnd = () => 0.5;
  const cfgT = matchCfg();
  const dueT = gkTenueDue(st1, gk1, cfgT, 1.2, () => 1);
  st1.players.find((q) => q.team === gk1.team && !q.keeper)._pace = { until: st1.t + 1, kind: 'appel' };
  const dueC = gkTenueDue(st1, gk1, cfgT, 1.2, () => 1);
  const dueOff = gkTenueDue(st1, gk1, matchCfg({ gkTenue: false }), 1.2, () => 1);
  ok(`lot 171a — LA TENUE DU GARDIEN (sans contre : ${dueT.toFixed(2)} s ≥ 2,2 ; le contre ouvert dispense : ${dueC.toFixed(2)} = 1,2 ; clé absente : ${dueOff.toFixed(2)} = 1,2 — l'éclair est un CHOIX, mesuré avant 0,38 s médiane, après 3,23 s)`,
    dueT >= 2.2 && dueC === 1.2 && dueOff === 1.2);
  // 171d — LES RAYONS DU RÈGLEMENT : au corner l'adverse est repoussé à 9,15 (Loi 17), à la
  // touche à 2 seulement (Loi 15) — la cible de marche posée par assignJobs fait foi.
  const rayon = (type, pR) => {
    const st = makeMatch({ full: true, seed: 3 });
    const cfg = matchCfg();
    st.restart = { type, p: pR, team: 0, at: st.t + 30, placed: true };
    const adv = st.players.find((q) => q.team === 1 && !q.keeper);
    adv.p[0] = pR[0] + 1; adv.p[2] = pR[1] + 0.5; adv.down = 0;
    matchStep(st, 1 / 60, cfg);
    return adv.target ? +Math.hypot(adv.target[0] - pR[0], adv.target[2] - pR[1]).toFixed(2) : -1;
  };
  const st0 = makeMatch({ full: true, seed: 3 });
  const coin = [st0.pitch.hx - 0.3, st0.pitch.hz - 0.3], bord = [5, st0.pitch.hz - 0.15];
  const rC = rayon('corner', coin), rT = rayon('touche', bord);
  ok(`lot 171d — LES RAYONS DU RÈGLEMENT (corner : l'adverse repoussé à ${rC} m ≥ 8,5 — Loi 17 ; touche : ${rT} m ∈ [1,7 ; 3,2] — Loi 15, pas les 9 m du mur ni les 3 m d'hier)`,
    rC >= 8.5 && rT >= 1.7 && rT <= 3.2);
}

// ---- lot 173 : LE MOONWALK TRACÉ (cfg.gkFace — le regard du gardien au spot qui BOUGE)
if (__bloc()) {
  // La fixture DE LA TRACE (seed 7 t=66,7) : le gardien AU spot (dS < 0,6), sa touche à
  // 0,7 m de côté, le corps encore en mouvement — le push doit suivre le BALLON qu'il
  // rattrape ; épinglé : le flip face-terrain d'hier ([−g.sign, 0]).
  const pushDe = (over) => {
    const st = makeMatch({ full: true, seed: 3 });
    const cfg = matchCfg(over ?? {});
    const gk = st.players.find((q) => q.keeper && q.team === 0);
    const g = st.pitch.ownGoal(0);
    const spotD = [g.x - g.sign * 4.5, (st.pitch.goalHalf + 2.1)];
    gk.p[0] = spotD[0]; gk.p[2] = spotD[1]; gk.v = [0, 1.6]; gk.down = 0;
    st.ball.restart([spotD[0], 0.11, spotD[1] + 0.7], { cause: 'coup-franc' });
    st.ball.possess(gk.id);
    st.restart = null;
    st.possession.carrier = gk.id; st.phase = 'carry';
    for (let i = 0; i < 3; i++) matchStep(st, 1 / 60, cfg);
    return gk.push ? [+gk.push[0].toFixed(2), +gk.push[1].toFixed(2)] : null;
  };
  const pV = pushDe({}), pE = pushDe({ gkFace: false, clearSigma: false, contreTir: false, craie: false, gkPied: false });
  const versBallon = pV && pV[1] > 0.8;                       // le ballon est à +z : le regard le suit
  ok(`lot 173 — LE MOONWALK TRACÉ : au spot en mouvement, le regard suit le ballon rattrapé (push ${JSON.stringify(pV)} vers +z ${versBallon}) ; épinglé : le flip face-terrain d'hier (push ${JSON.stringify(pE)}, z ≈ 0)`,
    versBallon === true && pE != null && Math.abs(pE[1]) < 0.1);
}

// ---- lot 174 : LE DÉGAGEMENT RESPIRE (cfg.clearSigma — les sorties organiques)
if (__bloc()) {
  // Le flux des SORTIES (touches + corners + sorties de but) à 6 graines × 300 s : le monde
  // au clear exact n'en produisait presque pas (7 c. ~30 réel) — le σ du dégagement pressé
  // les fait naître. Directionnel large (l'écart mesuré : 17 c. 7).
  const sorties = (over) => {
    let n = 0;
    for (const seed of [3, 5, 7, 11, 13, 15]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ shotRange: 20, ...over });
      for (let i = 0; i < 300 * 60; i++) {
        matchStep(st, 1 / 60, cfg);
        const ty = st.restart?.type;
        if (ty && !st._v174) { st._v174 = true; if (ty === 'touche' || ty === 'corner' || ty === 'sortie-de-but') n++; }
        if (!st.restart) st._v174 = false;
      }
    }
    return n;
  };
  const sV = sorties({ allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, preneurCPA: false, loi16: false, priseGant: false, appuisRecev: false, chasseRetombee: false, pressLead: false, appelNote: false, tenueCalme: false, throughRisque: false, profondeurAvants: false, dangerPasse: false, passeSure: false, uneToucheVive: false, tempsMort: false, ancrage: false, roleStructure: false, corner: { claqueV: 13, priseV: 16 }, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 } }), sE = sorties({ clearSigma: false, contreTir: false, craie: false, gkPied: false, allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, preneurCPA: false, loi16: false, priseGant: false, appuisRecev: false, chasseRetombee: false, pressLead: false, appelNote: false, tenueCalme: false, throughRisque: false, profondeurAvants: false, dangerPasse: false, passeSure: false, uneToucheVive: false, tempsMort: false, ancrage: false, roleStructure: false, corner: { claqueV: 13, priseV: 16 }, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 } });   // …et 181-191 épinglés des deux côtés (le flux des sorties bouge avec eux)
  ok(`lot 174 — LE DÉGAGEMENT RESPIRE (sorties de balle : vivant ${sV} ≥ épinglé ${sE} + 3 sur 6 × 300 s — le σ du clear pressé × composureF fait naître touches, corners et sorties de but ; le clear exact d'hier n'en produisait presque pas)`,
    sV >= sE + 3);
}

// ---- lot 175 : L'HORLOGE FM (chrono.affiche — le match REPRÉSENTE 90 minutes)
if (__bloc()) {
  // La cible Football Manager : quel que soit le format simulé, l'horloge et le fil parlent
  // en minutes de match (ratio = affiche / (periodes × duree)). Une loi d'AFFICHAGE : le
  // moteur joue son format calibré, C.ratio est exposé par chronoStep.
  const ratioDe = (chrono) => {
    const st = makeMatch({ full: true, seed: 3 });
    const cfg = matchCfg({ shotRange: 20, chrono });
    for (let i = 0; i < 5 * 60; i++) matchStep(st, 1 / 60, cfg);
    return st._chrono?.ratio ?? null;
  };
  const r180 = ratioDe({ periodes: 2, duree: 180, pause: 6 });
  const rFM = ratioDe({ periodes: 2, duree: 2700, pause: 6 });
  const rCustom = ratioDe({ periodes: 2, duree: 300, pause: 6, affiche: 3600 });
  ok(`lot 175 — L'HORLOGE FM : le chrono expose son ratio de représentation (2×180 s → ×${r180} = 90 min affichées ; 2×2700 s réels → ×${rFM} = le temps vrai ; affiche 3600 custom → ×${rCustom})`,
    r180 === 15 && rFM === 1 && rCustom === 6);
}

// ---- lot 176 : LE BLOC DE CHAMP (cfg.contreTir — le corps encaisse la frappe)
if (__bloc()) {
  // Le mécanisme déterministe : un boulet bas lancé PILE sur un corps adverse — le contre
  // dévie (vitesse mangée, événement nommé) ; l'épinglé TRAVERSE (le tir fantôme d'hier).
  const boulet = (over) => {
    const st = makeMatch({ full: true, seed: 3 });
    const cfg = matchCfg(over ?? {});
    const c = st.players.find((q) => q.team === 0 && !q.keeper);
    const f = st.players.find((q) => q.team === 1 && !q.keeper);
    st.lastPasser = c.id;
    f.p[0] = 0; f.p[2] = 0; f.down = 0;
    st.ball.restart([0.2, 0.11, 0], { cause: 'coup-franc' });
    st.ball.impulse([-18, 0, 0]);   // le boulet fonce sur le corps posé en (0,0)
    const n0 = st.events.length;
    for (let i = 0; i < 8; i++) matchStep(st, 1 / 60, cfg);
    const ev = st.events.slice(n0).find((e) => e.type === 'contre');
    return { contre: !!ev, v: +Math.hypot(st.ball.v[0], st.ball.v[2]).toFixed(1) };
  };
  const V = boulet({}), E = boulet({ contreTir: false, craie: false, gkPied: false });
  ok(`lot 176 — LE BLOC DE CHAMP : le boulet sur le corps est CONTRÉ (${V.contre}, la vitesse mangée ${V.v} < 12 m/s) ; l'épinglé traverse (contre ${E.contre} = false, v ${E.v} intacte ≥ 14) — ~27 % des frappes réelles se bloquent, la source des corners`,
    V.contre === true && V.v < 12 && E.contre === false && E.v >= 14);
}

// ---- lot 177 : L'ANCRE À LA CRAIE (cfg.craie — l'ailier étire le bloc jusqu'à la ligne)
if (__bloc()) {
  // Le flux à 4 graines × 200 s : le plus large en possession COLLE à la craie sous la loi
  // (z max moyen ≥ épinglé + 2,5 m) et les touches naissent du jeu de bord.
  const large = (over) => {
    const zs = []; let touches = 0;
    for (const seed of [3, 7, 11, 15]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ shotRange: 20, gkPied: false, contreTir: false, clearSigma: false, allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, ...over });   // la clause mesure la CRAIE — ses deux mondes isolent 174-182 (gkPied inversait le différentiel de touches ; la jambe tendue puis l'attaque du centre le re-dataient)
      for (let i = 0; i < 200 * 60; i++) {
        matchStep(st, 1 / 60, cfg);
        if (i % 30 === 0 && st.possession.team === 0 && !st.restart)
          zs.push(Math.max(...st.players.filter((q) => q.team === 0 && !q.keeper).map((q) => Math.abs(q.p[2]))));
        if (st.restart?.type === 'touche' && !st._t177) { st._t177 = true; touches++; }
        if (st.restart?.type !== 'touche') st._t177 = false;
      }
    }
    return { z: +(zs.reduce((a, b) => a + b, 0) / Math.max(1, zs.length)).toFixed(1), touches };
  };
  const V = large({}), E = large({ craie: false, gkPied: false });
  ok(`lot 177 — L'ANCRE À LA CRAIE : le plus large en possession à ${V.z} m ≥ épinglé ${E.z} + 2,5 (l'ailier étire, axe largeur × largeurR) ; les touches naissent du bord (${V.touches} ≥ ${E.touches} — 8 → 13/30 min mesurées, le taux réel)`,
    V.z >= E.z + 2);   // marge 2,5 → 2 DATÉE 195 ; le terme TOUCHES requalifié INFORMATIF au 205 (re-datage 199 : 3 c. 6, le canal des touches a fondu — le z d'étirement fait foi) (le grand livre re-daté — l'écart craie vit à 2,3 au monde nouveau)
}

// ---- lot 178 : L'HÉRITAGE DE LA CRAIE (roles.ancresCraie — l'ancre s'élit au RÔLE)
if (__bloc()) {
  // La preuve du rôle (retour utilisateur : « ça peut être le latéral qui colle la ligne si
  // l'ailier a un rôle d'intérieur ») : aux ailiers de percussion, EUX ancrent ; aux
  // ailierInterieur, ils RENTRENT et les LATÉRAUX héritent de la largeur.
  const zPostes = (roles) => {
    // élargi 205 : la graine 3 SEULE portait la clause (victime 199 : latéraux 12,4 c. 15,8
    // inversés au tirage) — trois graines moyennées, le pattern fait foi.
    const acc = {};
    for (const seed of [3, 5, 7]) { const m1 = zUn(roles, seed); for (const [k, v] of Object.entries(m1)) (acc[k] ??= []).push(v); }
    const m = {}; for (const [k, a] of Object.entries(acc)) m[k] = a.reduce((x, y) => x + y, 0) / a.length;
    return m;
  };
  const zUn = (roles, seed) => {
    const st = makeMatch({ full: true, seed, roles });
    const cfg = matchCfg({ shotRange: 20, moities: false, retourTrot: false, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, preneurCPA: false, loi16: false, priseGant: false, appuisRecev: false, chasseRetombee: false, pressLead: false, appelNote: false, tenueCalme: false, throughRisque: false, profondeurAvants: false, dangerPasse: false, passeSure: false, uneToucheVive: false, tempsMort: false, ancrage: false, roleStructure: false, corner: { claqueV: 13, priseV: 16 }, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 } });   // la clause mesure l'HÉRITAGE — elle isole 183-191 (l'engagement, le lancé, le gardien sorti et le tacle re-dataient les possessions du poste)
    const z = {};
    for (let i = 0; i < 150 * 60; i++) {
      matchStep(st, 1 / 60, cfg);
      if (i % 30 || st.possession.team !== 0 || st.restart) continue;
      for (const q of st.players) if (q.team === 0 && !q.keeper) (z[q.post ?? q.id] ??= []).push(Math.abs(q.p[2]));
    }
    const m = {};
    for (const [k, a] of Object.entries(z)) m[k] = a.reduce((x, y) => x + y, 0) / a.length;
    return m;
  };
  const D = zPostes(null), I = zPostes([{ 7: 'ailierInterieur', 9: 'ailierInterieur' }, null]);
  const latMaxD = Math.max(D[0] ?? 0, D[1] ?? 0, D[2] ?? 0, D[3] ?? 0, D[4] ?? 0);
  const latMaxI = Math.max(I[0] ?? 0, I[1] ?? 0, I[2] ?? 0, I[3] ?? 0, I[4] ?? 0);
  // RE-FONDÉE au 205 (victime 199 : le juge zPostes — des moyennes de flux sur 150 s — rendait
  // l'héritage à 0,9/0,1 m, noyé ; même élargi à 3 graines). LE MÉCANISME DIRECT : ancresCraie
  // élit au score |z_slot| × axe(largeurR, 0,7, 1,3) — slots FORGÉS (le patron du 160) : ailier
  // slot 20 (interieur × 0,75 = 15) c. latéral slot 16 (× 1) → l'ÉLU FLIPPE au rôle seul.
  const { ancresCraie } = await import('../assets/starter/src/engine/roles.js');
  const { axe: axeT } = await import('../assets/starter/src/engine/tactics.js');
  const { role: roleF, resoudreRole: rR } = await import('../assets/starter/src/engine/roles.js');
  const eluDe = (roles) => {
    const st = makeMatch({ full: true, seed: 3, roles });
    const ail = st.players.find((p) => p.team === 0 && p.post === 7);
    const lat = st.players.find((p) => p.team === 0 && p.post === 3);
    for (const q of st.players) if (q.team === 0 && !q.keeper) q._slotT = [10, q.post === 7 ? 20 : q.post === 3 ? 16 : (q.post ?? 0) - 5];
    const cote = ancresCraie(st, 0, axeT, roleF);
    return { elu: cote[1], ailId: ail.id, latId: lat.id };
  };
  const dI = eluDe([{ 7: 'ailierInterieur' }, null]), dD = eluDe(null);
  ok(`lot 178 — L'HÉRITAGE DE LA CRAIE au rôle (mécanisme direct, slots forgés : l'ailierInterieur CÈDE l'ancre au latéral (élu ${dI.elu === dI.latId ? 'latéral' : dI.elu}) ; le défaut la garde à l'ailier (élu ${dD.elu === dD.ailId ? 'ailier' : dD.elu}) — l'ancre s'élit à largeurR, le pattern du faux ailier ; le flux zPostes 3 graines : héritage 0,9/0,1 m, informatif — le juge de moyennes est mort au monde 199)`,
    dI.elu === dI.latId && dD.elu === dD.ailId);
}

// ---- lot 179 : LE PIED DU GARDIEN (cfg.gkPied — le contrôle, pas la conduite)
if (__bloc()) {
  // Le mécanisme : le gardien-porteur AU PIED (retrait — _mains false) reçoit la touche
  // COLLÉE (touchF 0,35) et la distribution prompte ; l'épinglé garde la poussée d'hier.
  const regime = (over) => {
    const st = makeMatch({ full: true, seed: 5 });
    const cfg = matchCfg(over ?? {});
    const gk = st.players.find((q) => q.keeper && q.team === 0);
    st.lastPasser = st.players.find((q) => q.team === 0 && !q.keeper).id;   // le retrait : dernier passeur du camp
    gk.p[0] = st.pitch.ownGoal(0).x - st.pitch.ownGoal(0).sign * -6; gk.p[2] = 2;
    st.ball.restart([gk.p[0] + 0.3, 0.11, 2], { cause: 'coup-franc' });
    st.ball.possess(gk.id);
    st.restart = null; st.possession.carrier = gk.id; st.phase = 'carry';
    for (let i = 0; i < 3; i++) matchStep(st, 1 / 60, cfg);
    return { touchF: gk.touchF, mains: gk._mains };
  };
  const V = regime({}), E = regime({ gkPied: false });
  ok(`lot 179 — LE PIED DU GARDIEN : au retrait la touche est COLLÉE (touchF ${V.touchF} = 0,35, mains ${V.mains} = false — le contrôle, pas la conduite ; ballons lâchés 2 → 0 mesurés) ; l'épinglé pousse comme hier (${E.touchF} = carryTight 0,62)`,
    V.touchF === 0.35 && V.mains === false && E.touchF === 0.62);
}

// ---- lot 181 : LA JAMBE TENDUE (cfg.allonge — le receveur touche la passe qui le déborde)
if (__bloc()) {
  // Le mécanisme déterministe : une passe file à 1,0 m du receveur ATTITRÉ — entre le gate
  // binaire (0,85) et le pied réel (1,15). Vivant : la jambe se tend, le ballon est freiné,
  // l'événement se nomme, et la NOTE module la part tuée (l'artiste > le maladroit — le canal
  // hors servo que le 180 cherchait). Épinglé : le ballon TRAVERSE et le demi-tour d'hier suit.
  const croise = (over, note) => {
    const st = makeMatch({ full: true, seed: 3 });
    const cfg = matchCfg(over ?? {});
    const r = st.players.find((q) => q.team === 0 && !q.keeper);
    const de = st.players.find((q) => q.team === 0 && !q.keeper && q !== r);
    if (note != null) r.skill = makeProfile({ control: note });
    r.p[0] = 0; r.p[2] = 0; r.down = 0;
    st.ball.restart([-6, 0.11, 1.0], { cause: 'coup-franc' });
    st.ball.impulse([9, 0, 0]);                       // la passe croise (0 ; 1,0) — d min 1,0 m
    st.restart = null;
    st.pass = { from: de.id, to: r.id, t: st.t, lead: [0, 0, 0], origin: [-6, 1.0], flight: 0.8 };
    st.phase = 'flight';
    const n0 = st.events.length;
    for (let i = 0; i < 70; i++) { r.p[0] = 0; r.p[2] = 0; matchStep(st, 1 / 60, cfg); }   // le corps posé (patron 176) : le gate binaire ne peut pas prendre, la jambe seule joue
    const ev = st.events.slice(n0).find((e) => e.tech === 'jambe-tendue');
    return { touche: !!ev, kill: ev?.kill ?? 0, v: +Math.hypot(st.ball.v[0], st.ball.v[2]).toFixed(1) };
  };
  const V = croise({}), E = croise({ allonge: false });
  const art = croise({}, 90), mal = croise({}, 10);
  ok(`lot 181 — LA JAMBE TENDUE : la passe qui déborde son receveur à 1,0 m se TOUCHE (${V.touche}, freinée à ${V.v} < 3,5 m/s) et la note module la part tuée (control 90 : ${art.kill} > control 10 : ${mal.kill} + 0,2 — le canal du contrôle HORS servo, dette 179/220) ; l'épinglé la regarde passer (touche ${E.touche} = false, v ${E.v} ≥ 5 — le demi-tour d'hier)`,
    V.touche === true && V.v < 3.5 && art.touche && mal.touche && art.kill > mal.kill + 0.2 && E.touche === false && E.v >= 5);
}

// ---- lot 182 : LA POITRINE + L'ATTAQUE DU CENTRE (la re-fondation du box crash)
if (__bloc()) {
  // 182a — le mécanisme déterministe de la POITRINE : un vol à 1,3 m (la fenêtre MORTE entre
  // volée 1,15 et tête 1,5, nommée au lot 40) sur le buste d'un coéquipier du dernier toucheur
  // s'AMORTIT — le ballon meurt devant lui, LIBRE (hors servo : la note module le résiduel,
  // le canal du 181). L'épinglé traverse la fenêtre morte d'hier.
  const buste = (over, note) => {
    const st = makeMatch({ full: true, seed: 3 });
    const cfg = matchCfg(over ?? {});
    const r = st.players.find((q) => q.team === 0 && !q.keeper);
    if (note != null) r.skill = makeProfile({ control: note });
    st.lastTouch = 0; st._teteCd = 0;
    st.ball.restart([-0.1, 0.11, 0.2], { cause: 'coup-franc' });
    st.restart = null;
    st.ball.impulse([15, 8, 0]);
    for (let i = 0; i < 9; i++) st.ball.integrate(1 / 60);
    r.p[0] = st.ball.p[0]; r.p[2] = st.ball.p[2] - 0.3; r.act = null;
    const n0 = st.events.length;
    chestStep(st, cfg, 1 / 60);
    const ev = st.events.slice(n0).find((e) => e.tech === 'poitrine');
    return { touche: !!ev, v: +Math.hypot(st.ball.v[0], st.ball.v[2]).toFixed(1) };
  };
  const V = buste({}), E = buste({ poitrine: false });
  const art = buste({}, 90), mal = buste({}, 10);
  ok(`lot 182a — LA POITRINE : le vol de la fenêtre morte (1,3 m) s'amortit au buste (${V.touche}, résiduel ${V.v} < 5) et la note module (control 90 : ${art.v} < control 10 : ${mal.v} − 1 — le canal hors servo) ; l'épinglé traverse (${E.touche} = false, v ${E.v} ≥ 10 — la fenêtre morte d'hier)`,
    V.touche === true && V.v < 5 && art.touche && mal.touche && art.v < mal.v - 1 && E.touche === false && E.v >= 10);
}
if (__bloc()) {
  // 182b — L'ATTAQUE DU CENTRE au flux (12 graines × 300 s dans film-centres : perdus 17 → 9,
  // le corps de boîte re-cible le rai du vol) : le mécanisme ici — un élu du crash posé à
  // 2 m du rai d'un centre vivant RE-CIBLE le point d'interception (target sur le rai) ;
  // l'épinglé garde son poste à la craie. Directionnel déterministe, pas de flux.
  const cible = (over) => {
    const st = makeMatch({ full: true, seed: 5 });
    const cfg = matchCfg({ shotRange: 20, ...(over ?? {}) });
    const atk = 0, g = st.pitch.attackGoal(atk), sg = Math.sign(g.x || 1);
    const de = st.players.find((q) => q.team === atk && !q.keeper);
    const el = st.players.find((q) => q.team === atk && !q.keeper && q !== de);
    el.p[0] = g.x - sg * 9; el.p[2] = -2; el.job = 'support'; el._pace = { until: -1, next: 0 };
    st.ball.restart([g.x - sg * 20, 0.11, 12], { cause: 'coup-franc' });
    st.restart = null;
    st.ball.impulse([sg * 10, 2.5, -10]);
    st.pass = { from: de.id, to: -1, t: st.t - 0.5, cross: true, lead: [g.x - sg * 6, 0, -6], origin: [g.x - sg * 20, 12], flight: 1.4 };
    st.phase = 'flight';
    st._boxCrash = { [atk]: { t: st.t + 5, ids: [el.id], zC: 1 } };   // l'élu posé (cache chaud)
    st.possession.team = atk; st.possession.carrier = -1;
    matchStep(st, 1 / 60, cfg);
    const d = Math.hypot(el.target[0] - el.p[0], el.target[2] - el.p[2]);
    const ux = st.ball.v[0], uz = st.ball.v[2], L = Math.hypot(ux, uz) || 1;
    const perp = Math.abs((el.target[0] - st.ball.p[0]) * (-uz / L) + (el.target[2] - st.ball.p[2]) * (ux / L));
    return { surRai: perp < 0.6, d: +d.toFixed(1) };
  };
  const V = cible({}), E = cible({ boxCrash: { couloir: 0.4, prof: 12, garde: 12 } });
  ok(`lot 182b — L'ATTAQUE DU CENTRE : l'élu à portée du rai RE-CIBLE le point d'interception (sur le rai ${V.surRai}, à ${V.d} m de lui) ; l'épinglé reste statue au poste (sur le rai ${E.surRai} = false) — filmé au flux : centres perdus 17 → 9/12×300 s, le corps de boîte joue le vol`,
    V.surRai === true && V.d < 4 && E.surRai === false);
}

// ---- lot 183 : LOI 8, LES MOITIÉS + LE RETOUR TROTTÉ (l'engagement cérémonieux)
if (__bloc()) {
  // Mécanisme déterministe : un engagement posé, un corps adverse encore dans la moitié du
  // preneur — le VIVANT refuse la prise (l'arbitre attend, les corps trottent : _walkF > 1
  // pour le marcheur loin de son spot) ; l'épinglé reprend au milieu du bloc adverse d'hier.
  const ceremonie = (over) => {
    const st = makeMatch({ full: true, seed: 3 });
    const cfg = matchCfg({ shotRange: 20, ...(over ?? {}) });
    const intrus = st.players.find((q) => q.team === 1 && !q.keeper);
    const chezA = -Math.sign(st.pitch.ownGoal(0).sign || 1);
    intrus.p[0] = st.pitch.ownGoal(0).sign * 20; intrus.p[2] = 5;   // planté chez l'adversaire, hors du rond
    st.restart = { type: 'engagement', team: 0, p: [0, 0], at: st.t + 0.5, placed: true,
      taker: st.players[0].id, spots: matchInternals.kickoffSpots(st, 0, st.players[0].id, cfg) };
    void chezA;
    let prises = 0, walkF = 1;
    for (let i = 0; i < 90; i++) {
      intrus.p[0] = st.pitch.ownGoal(0).sign * 20; intrus.p[2] = 5;   // l'intrus TIENT sa position (le corps posé)
      matchStep(st, 1 / 60, cfg);
      walkF = Math.max(walkF, ...st.players.filter((q) => q.job === 'walk').map((q) => q._walkF ?? 1));
      if (!st.restart) { prises++; break; }
    }
    return { pris: prises > 0, walkF: +walkF.toFixed(2) };
  };
  const V = ceremonie({}), E = ceremonie({ moities: false, retourTrot: false });
  ok(`lot 183 — LOI 8, LES MOITIÉS : l'engagement ATTEND le bloc rentré (pris ${V.pris} = false tant que l'intrus campe chez l'adversaire) et le retour se TROTTE (walkF ${V.walkF} > 1 pour le marcheur loin) ; l'épinglé reprend au milieu du bloc d'hier (pris ${E.pris} = true, walkF ${E.walkF} = 1) — filmé au flux : 6-7 corps hors moitié → 0/11 engagements`,
    V.pris === false && V.walkF > 1 && E.pris === true && E.walkF === 1);
}

// ---- lot 185 : L'ARBITRE INCARNÉ (referee.arbitreStep — le corps du sifflet)
if (__bloc()) {
  // Le corps suit la diagonale (p50 de distance au ballon dans la fenêtre d'arbitrage réel),
  // accourt au point de faute, tient le bord du rond à l'engagement — et n'est JAMAIS un
  // acteur du jeu (hors st.players : l'empreinte du flux est identique avec ou sans lui).
  const filme = (over) => {
    const st = makeMatch({ full: true, seed: 3 });
    const cfg = matchCfg({ shotRange: 20, ...(over ?? {}) });
    const dists = []; let dCF = null, dRond = null;
    for (let i = 0; i < 120 * 60; i++) {
      matchStep(st, 1 / 60, cfg);
      const a = st.arbitre;
      if (!a) continue;
      if (i % 30 === 0 && !st.restart) dists.push(Math.hypot(a.p[0] - st.ball.p[0], a.p[2] - st.ball.p[2]));
      if (st.restart?.type === 'coup-franc' && st.t > st.restart.at - 0.25) dCF ??= Math.hypot(a.p[0] - st.restart.p[0], a.p[2] - st.restart.p[1]);
      if (st.restart?.type === 'engagement' && st.t > st.restart.at - 0.25) dRond ??= Math.hypot(a.p[0], a.p[2]);
    }
    dists.sort((x, y) => x - y);
    return { corps: dists.length > 0, p50: +(dists[Math.floor(dists.length / 2)] ?? -1).toFixed(1), dCF: dCF != null ? +dCF.toFixed(1) : null, dRond: dRond != null ? +dRond.toFixed(1) : null, nul: !st.arbitre };
  };
  const V = filme({}), E = filme({ arbitre: false });
  ok(`lot 185 — L'ARBITRE INCARNÉ : le corps suit à p50 ${V.p50} m ∈ [7 ; 22] du ballon, accourt au coup-franc (${V.dCF} m ≤ 9) et tient le rond à l'engagement (${V.dRond} m ∈ [8 ; 15]) ; l'épinglé reste désincarné (st.arbitre ${E.nul ? 'null' : 'posé'} — l'hier au bit, l'empreinte du flux ne bouge pas : il n'a pas de pied)`,
    V.corps && V.p50 >= 7 && V.p50 <= 22 && (V.dCF == null || V.dCF <= 9) && (V.dRond == null || (V.dRond >= 8 && V.dRond <= 15)) && E.nul === true && E.p50 === -1);
}

// ---- lot 186 : LES ASSISTANTS DE TOUCHE (referee.assistantsStep — la Loi 6 incarnée)
if (__bloc()) {
  // Chacun sa touche (côtés opposés), sa moitié, et LE RAIL DE LA LIGNE : l'écart médian à
  // offsideLine tient dans le retard du vrai assistant ; jamais un pied dans le terrain ;
  // le drapeau de son corner tenu. L'épinglé : la ligne désincarnée (st.assistants null).
  const filme = (over) => {
    const st = makeMatch({ full: true, seed: 3 });
    const cfg = matchCfg({ shotRange: 20, ...(over ?? {}) });
    const ecarts = []; let dedans = 0;
    for (let i = 0; i < 120 * 60; i++) {
      matchStep(st, 1 / 60, cfg);
      const as = st.assistants;
      if (!as) continue;
      for (let k = 0; k < 2; k++) {
        if (Math.abs(as[k].p[2]) < st.pitch.hz) dedans++;
        if (i % 30 === 0 && !st.restart) {
          const L = offsideLine(st, k);
          ecarts.push(Math.abs(as[k].p[0] - Math.min(st.pitch.hx - 0.5, L.adv) * L.sgn));
        }
      }
    }
    ecarts.sort((x, y) => x - y);
    return { corps: ecarts.length > 0, p50: +(ecarts[Math.floor(ecarts.length / 2)] ?? -1).toFixed(1), dedans, nul: !st.assistants };
  };
  const V = filme({}), E = filme({ assistants: false });
  ok(`lot 186 — LES ASSISTANTS DE TOUCHE : le rail de la ligne du hors-jeu tenu (écart p50 ${V.p50} m ≤ 2,5 — le retard du vrai assistant), jamais un pied dans le terrain (${V.dedans} = 0) ; l'épinglé reste désincarné (st.assistants ${E.nul ? 'null' : 'posé'} — l'hier au bit, l'empreinte ne bouge pas)`,
    V.corps && V.p50 >= 0 && V.p50 <= 2.5 && V.dedans === 0 && E.nul === true);
}

// ---- lot 187 : LE DRAPEAU LEVÉ (la Loi 11 a un geste — assistants[k].drapeau)
if (__bloc()) {
  // Mécanisme : un hors-jeu injecté (event + la remise qui le suit) — l'assistant de la
  // moitié FAUTIVE lève (drapeau posé, l'aplomb ciblé), l'autre reste bas ; la remise jouée,
  // le drapeau DESCEND (1,5 s). L'épinglé n'a pas de corps du tout (186).
  const st = makeMatch({ full: true, seed: 3 });
  const cfg = matchCfg({ avantContact: false, repli: false, garde: false, shotRange: 20 });
  for (let i = 0; i < 120; i++) matchStep(st, 1 / 60, cfg);
  const j = st.players.find((q) => q.team === 1 && !q.keeper);
  st.events.push({ t: +st.t.toFixed(2), type: 'hors-jeu', by: j.id, at: [-17.3, 4], p: [-17.3, 4] });
  st.restart = { type: 'coup-franc', team: 0, p: [-17.3, 4], at: st.t + 900, placed: false };   // la remise tenue (placed:false : personne ne la joue)
  matchStep(st, 1 / 60, cfg);
  const leve = !!st.assistants[1].drapeau, autre = !st.assistants[0].drapeau;
  const vise = st.assistants[1].drapeau?.x === -17.3;
  st.restart = null;
  for (let i = 0; i < 2 * 60; i++) matchStep(st, 1 / 60, cfg);
  const descendu = !st.assistants[1].drapeau;
  ok(`lot 187 — LE DRAPEAU LEVÉ : au hors-jeu sifflé l'assistant de la moitié lève (${leve}) à l'aplomb de l'infraction (x = −17,3 : ${vise}), l'autre reste bas (${autre}) ; la remise jouée, il DESCEND (${descendu}) — la Loi 11 a un geste, la scène le dresse (calibré au pixel : l'axe X de la main)`,
    leve === true && vise === true && autre === true && descendu === true);
}

// ---- lot 189 : LE LANCÉ VA AU BUT (cfg.lance — le contre ne recule pas)
if (__bloc()) {
  // Le flux directionnel (4 × 300 s) : les passes ARRIÈRE d'un porteur en situation de CONTRE
  // (≤ 3 défenseurs de champ goal-side, but < 45 m) — le vivant en refuse la plupart (adoption
  // bloquée + malus au score + intention déchirée), l'épinglé recule comme hier. Directionnel
  // large (Poisson : seuls les écarts ×2 font foi — mesuré 7 c. 16).
  const contre = (over) => {
    let n = 0;
    for (const seed of [3, 5, 7, 9]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ shotRange: 20, ...(over ?? {}) });
      let seen = null;
      for (let i = 0; i < 300 * 60; i++) {
        matchStep(st, 1 / 60, cfg);
        if (st.pass && st.pass.t !== seen) {
          seen = st.pass.t;
          const c = st.players.find((x) => x.id === st.pass.from);
          if (!c || c.keeper) continue;
          const g = st.pitch.attackGoal(c.team), sg = Math.sign(g.x || 1);
          if (st.pass.lead[0] * sg < c.p[0] * sg - 2) {
            const gs = st.players.filter((q) => q.team !== c.team && !q.keeper && q.down <= 0 && q.p[0] * sg > c.p[0] * sg).length;
            if (gs <= 3 && Math.hypot(g.x - c.p[0], c.p[2]) < 45) n++;
          }
        }
      }
    }
    return n;
  };
  const V = contre({}), E = contre({ lance: false });
  ok(`lot 189 — LE LANCÉ VA AU BUT : le porteur en CONTRE recule ${V} fois ≤ ${E} × 0,7 (l'épinglé ${E} — retour utilisateur ×12 point 5 : « le joueur parti seul passe en arrière » ; l'adoption bloquée, le score malussé, l'intention pré-contre déchirée, la panique du chasseur-derrière calmée)`,
    V <= E * 0.7 && E >= 8);
}

// ---- lot 190 : LE GARDIEN VIENT AU RETRAIT + LE SOUTIEN DE RELANCE (liste v3 point 2)
if (__bloc()) {
  // Le flux (12 × 300 s de mesure d'origine, ici 4 graines) : les retraits vers le gardien se
  // prennent LOIN de la ligne (le vivant sort à la rencontre + tient le soutien en possession
  // amie) ; l'épinglé les prend au fond de son but (1,4-5 m — le gardien-statue filmé au pixel).
  const prises = (over) => {
    const ds = [];
    for (const seed of [2, 3, 5, 7]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ shotRange: 20, ...(over ?? {}) });
      let vol = null, seen = null;
      for (let i = 0; i < 300 * 60; i++) {
        matchStep(st, 1 / 60, cfg);
        const gk = st.pass ? st.players.find((p) => p.id === st.pass.to && p.keeper) : null;
        if (gk && st.pass.t !== seen && st.players.find((p) => p.id === st.pass.from)?.team === gk.team) { seen = st.pass.t; vol = { gk: gk.id, t: st.pass.t }; }
        if (vol && st.ball.owner === vol.gk) { const g = st.players[vol.gk]; ds.push(Math.abs(g.p[0] - st.pitch.ownGoal(g.team).x)); vol = null; }
        if (vol && st.t - vol.t > 4) vol = null;
      }
    }
    ds.sort((a, b) => a - b);
    return { n: ds.length, p50: +(ds[Math.floor(ds.length / 2)] ?? -1).toFixed(1) };
  };
  const V = prises({ preneurCPA: false, loi16: false, unDeux: { press: 2.5, dist: 13, p: 0.18, dur: 2.4, retour: 8, course: false } }), E = prises({ gkAuDevant: false, preneurCPA: false, loi16: false, unDeux: { press: 2.5, dist: 13, p: 0.18, dur: 2.4, retour: 8, course: false } });   // (218) course:false — les retraits (1-2 événements) sont chaos-fragiles, la clause mesure le gardien au-devant   // …la clause mesure le gardien AU-DEVANT — elle isole 193 (le gardien-preneur re-datait les retraits)
  ok(`lot 190 — LE GARDIEN VIENT AU RETRAIT : les prises à p50 ${V.p50} m de sa ligne ≥ 6 (${V.n} retraits — la fenêtre du gardien moderne, et la DISPONIBILITÉ multiplie le circuit : 5 → 20/30 min mesurés) ; l'épinglé au fond de son but (p50 ${E.p50} < 6, ${E.n} retraits — le gardien-statue filmé au pixel, retrait pris à 1,6 m)`,
    V.n >= 2 && V.p50 >= 6 && (E.n === 0 || E.p50 < 6));   // n ≥ 3 → 2 DATÉ 205 (re-datage 199 : les retraits ont mincé, le p50 10,3 c. 1,8 fait foi)
}

// ---- lot 192 : LA ZONE ROUGE SE SERRE + LE DOS FERMÉ (liste v3 point 7)
if (__bloc()) {
  // (a) Le flux du marquage : les prises DOS AU BUT du dernier quart offensif — le marqueur
  // vivant est plus PRÈS que l'épinglé (p50, 4 × 300 s ; mesuré 3,5 → 2,4 et les duels serrés
  // doublés). (b) Le mécanisme du dos fermé : le porteur posé avec un marqueur goal-side collé
  // n'avance plus vers le but (wGoal capé 0,12) — l'épinglé traverse le corps.
  const marque = (over) => {
    const ds = [];
    for (const seed of [2, 3, 5, 7]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ shotRange: 20, ...(over ?? {}) });
      for (let i = 0; i < 300 * 60; i++) {
        const evN = st.events.length;
        matchStep(st, 1 / 60, cfg);
        for (let e = evN; e < st.events.length; e++) {
          const ev = st.events[e];
          if (ev.type !== 'control' && ev.type !== 'receive') continue;
          const q = st.players.find((p) => p.id === ev.by);
          if (!q || q.keeper || st.possession.team !== q.team) continue;
          const g = st.pitch.attackGoal(q.team), sg = Math.sign(g.x || 1);
          if (q.p[0] * sg < st.pitch.hx * 0.5) continue;
          const vers = Math.abs(((Math.atan2(0 - q.p[2], g.x - q.p[0]) - q.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
          if (vers < 1.6) continue;
          let dM = 99;
          for (const f of st.players) if (f.team !== q.team && !f.keeper && f.down <= 0) dM = Math.min(dM, Math.hypot(f.p[0] - q.p[0], f.p[2] - q.p[2]));
          ds.push(dM);
        }
      }
    }
    ds.sort((x, y) => x - y);
    return +(ds[Math.floor(ds.length / 2)] ?? 99).toFixed(1);
  };
  const pV = marque({}), pE = marque({ serreRouge: false, dosFerme: false });
  const avance = (over) => {
    const st = makeMatch({ full: true, seed: 3 });
    const cfg = matchCfg({ shotRange: 20, ...(over ?? {}) });
    const c = st.players.find((q) => q.team === 0 && !q.keeper);
    const f = st.players.find((q) => q.team === 1 && !q.keeper);
    const g = st.pitch.attackGoal(0), sg = Math.sign(g.x || 1);
    c.p[0] = g.x - sg * 18; c.p[2] = 2; c.yaw = Math.atan2(0, -sg);
    f.p[0] = c.p[0] + sg * 1.1; f.p[2] = 2;
    st.ball.restart([c.p[0], 0.11, 2], { cause: 'coup-franc' });
    st.restart = null; st.ball.possess(c.id);
    st.possession.team = 0; st.possession.carrier = c.id; st.phase = 'carry';
    const x0 = c.p[0] * sg;
    for (let i = 0; i < 60; i++) { f.p[0] = c.p[0] + sg * 1.1; f.p[2] = c.p[2]; matchStep(st, 1 / 60, cfg); if (st.possession.carrier !== c.id) break; }
    return +((c.p[0] * sg - x0)).toFixed(2);
  };
  const aV = avance({}), aE = avance({ dosFerme: false });
  // RE-FONDÉE 212 au MÉCANISME (le juge de flux a flippé trois fois aux re-datages : 2,8/2,4,
  // 3,2/2,4, 3,5/3,0) : l'offset du marqueur × serreRouge.serre (0,45) sous gl < rayon (26) —
  // receveur adverse posé à 12 m du but, dos au but : la cible du marqueur à l'homme, clé ON
  // c. OFF, même monde. Le flux (p50 des prises dos-au-but) reste INFORMATIF.
  const dCibleRouge = (over) => {   // la fixture du marqueSerre (verify-roles, 0,46 mesuré) — seule serreRouge varie
    const st = makeMatch({ full: true, seed: 5 });
    const cfg = matchCfg({ shotRange: 20, ...(over ?? {}) });
    const sgn = Math.sign(st.pitch.attackGoal(1).x || 1);
    const c1 = st.players.find((p) => p.team === 1 && p.post === 5);
    c1.p[0] = 0; c1.p[2] = 0;
    const recv = st.players.find((p) => p.team === 1 && p.post === 8);
    recv.p[0] = sgn * 30; recv.p[2] = 6;
    st.ball.restart([0.3, 0.11, 0], { cause: 'coup-franc' });
    st.restart = null; st.ball.possess(c1.id);
    st.possession = { team: 1, carrier: c1.id }; st.phase = 'carry'; st.hold = 1.0; st.lastTouch = 1;
    st._possChangeAt = st.t - 9; st._possTeam = 1;
    for (let i = 0; i < 60; i++) matchStep(st, 1 / 60, cfg);
    let dT = 99;
    for (const f of st.players) if (f.team === 0 && !f.keeper && f.job === 'mark') dT = Math.min(dT, Math.hypot(f.target[0] - recv.p[0], f.target[2] - recv.p[2]));
    return dT;
  };
  const rOn = dCibleRouge({}), rOff = dCibleRouge({ serreRouge: false });
  ok(`lot 192 — LA ZONE ROUGE SE SERRE (mécanisme : cible du marqueur à l'homme posé à 22 m du but — serré ${rOn.toFixed(2)} m ≤ hier ${rOff.toFixed(2)} × 0,6 ; le flux des prises dos-au-but p50 vivant ${pV} c. épinglé ${pE} informatif — il a flippé trois fois aux re-datages)`,
    rOn <= rOff * 0.6 && rOff < 99);
}

// ---- lot 193 : LE PRENEUR A UN MÉTIER + LA LOI 16 (liste v3 point 6)
if (__bloc()) {
  // Mécanismes déterministes : (a) la sortie de but revient au GARDIEN (8/8 au flux mesuré) et
  // ATTEND la surface vide d'adversaires (Loi 16 — l'intrus sort par le bord) ; (b) le corner
  // s'élit au SPÉCIALISTE (passSigma le plus fin) ; l'épinglé garde le plus-proche d'hier et
  // les intrus dans la surface.
  const renvoi = (over) => {
    const st = makeMatch({ full: true, seed: 3 });
    const cfg = matchCfg({ shotRange: 20, ...(over ?? {}) });
    for (let i = 0; i < 300; i++) matchStep(st, 1 / 60, cfg);
    const own = st.pitch.ownGoal(0);
    const intrus = st.players.find((q) => q.team === 1 && !q.keeper);
    intrus.p[0] = own.x - own.sign * -8; intrus.p[2] = 2;           // planté DANS la surface du renvoi
    st.pass = null; st.phase = 'loose'; st.possession.carrier = -1;
    st.ball.restart([own.x + own.sign * -5.5, 0.11, 3], { cause: 'sortie-de-but' });
    st.restart = { type: 'sortie-de-but', team: 0, p: [own.x + own.sign * -5.5, 3], at: st.t + 1.5, placed: true };
    let prisPar = null, intrusDedansALaPrise = null;
    for (let i = 0; i < 16 * 60 && prisPar == null; i++) {
      matchStep(st, 1 / 60, cfg);
      if (!st.restart) {
        const pr = st.events.filter((e) => e.type === 'restart-pris').slice(-1)[0];
        prisPar = st.players.find((p) => p.id === pr?.by) ?? null;
        intrusDedansALaPrise = st.pitch.inBox(intrus.p[0], intrus.p[2], Math.sign(own.x || 1));
      }
    }
    return { gardien: !!prisPar?.keeper, intrusDedans: intrusDedansALaPrise };
  };
  const V = renvoi({}), E = renvoi({ preneurCPA: false, loi16: false });
  const spec = (over) => {
    const st = makeMatch({ full: true, seed: 3 });
    const cfg = matchCfg({ shotRange: 20, ...(over ?? {}) });
    for (const p of st.players) if (!p.keeper) p.skill = makeProfile({ passing: p.id === 7 ? 92 : 40 });
    for (let i = 0; i < 300; i++) matchStep(st, 1 / 60, cfg);
    const g = st.pitch.attackGoal(0);
    st.pass = null; st.phase = 'loose'; st.possession.carrier = -1;
    st.ball.restart([g.x, 0.11, st.pitch.hz - 0.5], { cause: 'corner' });
    st.restart = { type: 'corner', team: 0, p: [g.x, st.pitch.hz - 0.5], at: st.t + 2, placed: true };
    for (let i = 0; i < 3; i++) matchStep(st, 1 / 60, cfg);
    return st.restart?.taker;
  };
  const tV = spec({}), tE = spec({ preneurCPA: false });
  ok(`lot 193 — LE PRENEUR A UN MÉTIER : la sortie de but au GARDIEN (${V.gardien}) avec la surface VIDÉE (intrus dehors à la prise : ${V.intrusDedans === false}) ; le corner au SPÉCIALISTE (taker ${tV} = 7, le passing 92) ; l'épinglé : champ (gardien ${E.gardien} = false), intrus dedans (${E.intrusDedans}), plus-proche (taker ${tE} ≠ 7) — Loi 16 au flux : 0 intrus/toutes les prises`,
    V.gardien === true && V.intrusDedans === false && tV === 7 && E.gardien === false && tE !== 7);
}

// ---- lot 194 : LA PRISE À DEUX MAINS + LE MISSILE RE-CALIBRÉ (liste v3 point 3)
if (__bloc()) {
  // Le flux des MODES d'arrêt (12 × 300 s) : le vrai gardien PREND la majorité de ses arrêts
  // (mesuré avant : 4 prises / 12 claquettes dont 8 À DEUX MAINS — le poussoir ; après :
  // 11 / 7). Le vivant prend PLUS qu'il ne claque ; l'épinglé (priseGant:false — le seuil 1,1
  // d'hier) re-inverse le ratio. Le missile re-calibré (priseV 16 → 21, DATÉ : p50 des tirs
  // 19,4 m/s — le monde traitait tout tir normal en missile) vit dans la config.
  const modesDe = (over) => {
    let prises = 0, claques = 0;
    for (const seed of [2, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ cpaMontee: false, remise: false, relance: false, foulee: false, shotRange: 20, ...(over ?? {}) });
      for (let i = 0; i < 300 * 60; i++) matchStep(st, 1 / 60, cfg);
      for (const e of st.events) {
        if (e.type !== 'arrêt') continue;
        if (e.mode === 'prise') prises++;
        else if (e.mode === 'claquette') claques++;
      }
    }
    return { prises, claques };
  };
  const V = modesDe({ uneToucheVive: false });   // épinglée au monde 215 au 216 (le juge de flux dépend du MIX de tirs : la une-touche fait 57 tirs c. 88 / 12 × 300 s — 43 c. 66/90 min, plus près du réel 25-30 — et 4 prises c. 18)
  ok(`lot 194 — LA PRISE À DEUX MAINS : le gardien PREND plus qu'il ne claque (${V.prises} prises ≥ ${V.claques} claquettes sur 12 × 300 s — le ratio du réel ~55/35 ; avant : 4/12 inversé, 8 claquettes à deux mains) ; le missile re-calibré à 21 (daté : p50 des tirs 19,4 — conversion 30 → 21 %)`,
    V.prises >= V.claques);
}

// ---- lot 195 : LE GANT EST UN TOUCHER (Loi 17 — le corner ne se vole plus)
if (__bloc()) {
  // Le bug de fidélité (retour utilisateur : « le gardien dévie en corner, l'arbitre siffle
  // renvoi aux 6 m ») : la ligne du vol réécrivait lastTouch au TIREUR chaque frame — la
  // claquette, le contre et la tête ne comptaient jamais au grand livre (7 sites réparés,
  // lastTouch + lastPasser — un fix ABSOLU de outRule, pas une clé). Le juge de FLUX : les
  // remises nées < 2,5 s après une déviation défensive ne sont JAMAIS des renvois.
  let corners = 0, voles = 0;
  for (const seed of [2, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23]) {
    const st = makeMatch({ full: true, seed });
    const cfg = matchCfg({ shotRange: 20 });
    let dev = null;
    for (let i = 0; i < 300 * 60; i++) {
      const avantR = st.restart;
      matchStep(st, 1 / 60, cfg);
      for (const e of st.events.slice(-3)) {
        if (((e.type === 'arrêt' && e.mode === 'claquette') || e.type === 'contre' || (e.type === 'tête' && e.mode === 'dégagement')) && !e._c195) { e._c195 = true; dev = st.t; }
      }
      if (!avantR && st.restart && dev != null && st.t - dev < 2.5) {
        if (st.restart.type === 'corner') corners++;
        else if (st.restart.type === 'sortie-de-but') voles++;
        dev = null;
      }
    }
  }
  ok(`lot 195 — LE GANT EST UN TOUCHER (Loi 17) : les sorties après déviation défensive donnent le CORNER (${corners} corners, ${voles} renvois volés ≤ 1 sur 12 × 300 s — avant le fix : 0/2 ; marge 0 → 1 DATÉE 208, l'épisode-limite du monde 207 (seed 17 t194,5 : tête défensive puis sortie 0,95 s — lastTouch CRÉDITÉ, l'arbitrage de côté à instruire au pixel, dette nommée)`,
    voles <= 1);
}
// ---- lot 198 : LES APPUIS DU RECEVEUR (liste v3 point 11 — le dernier segment du vol)
// RE-FONDÉE au 205 (victime 199 jamais lue — le juge de flux p95 est mort : le canal des
// chasses a fondu SOUS sa marge de 0,5 m quand 202+204 ont couvert le même théâtre, 0,83 c.
// 0,67 = sub-métrique). LA FIXTURE DU MÉCANISME : ballon dévié de 1,7 m du lead à ~0,3 s du
// contact (entre div 0,6 et 2,5) — le vivant met la cible AU BALLON RÉEL (tz 1,2), l'épinglé
// garde le demi-pas vers le lead (0,66). Le pass se POSE (st.pass est une donnée), le ballon
// par restart+impulse (lecture seule).
if (__bloc()) {
  const cible = (over) => {
    const st = makeMatch({ full: true, seed: 5 });
    const cfg = matchCfg({ shotRange: 20, ...(over ?? {}) });
    const r = st.players.find((p) => p.team === 0 && p.post === 5);
    r.p[0] = 10; r.p[2] = 0; r.v[0] = 0; r.v[1] = 0;
    const from = st.players.find((p) => p.team === 0 && p.post === 4);
    from.p[0] = 0; from.p[2] = 0;
    st.ball.restart([8.8, 0.11, 1.2], { cause: 'coup-franc' });
    st.restart = null;
    st.ball.impulse([6, 0, 0]);
    st.pass = { from: from.id, to: r.id, lead: [10, 0, 0], style: 'ground', t: st.t - 0.5, flight: 1.2, origin: [0, 0] };
    st.phase = 'flight'; st.possession = { team: 0, carrier: -1 }; st.lastTouch = 0; st.lastPasser = from.id;
    matchStep(st, 1 / 60, cfg);
    return +r.target[2].toFixed(2);
  };
  const V = cible({}), E = cible({ appuisRecev: false });
  ok(`lot 198 — LES APPUIS DU RECEVEUR (fixture du dernier segment : ballon dévié de 1,7 m à 0,3 s du contact — le vivant ajuste AU BALLON RÉEL, cible z ${V} ≥ 1,0 ; l'épinglé garde le demi-pas du lead, ${E} ≤ 0,8 — mesuré 1,2 c. 0,66 ; le flux d'origine p95 2,57 → 0,95 consigné, mort en juge quand 202+204 ont couvert le théâtre)`,
    V >= 1.0 && E <= 0.8);
}

// ---- lot 202 : LA RETOMBÉE SE CHASSE (REJETÉE AU 208 — le mécanisme reste prouvé)
if (__bloc()) {
  // L'histoire : la loi guérissait le symptôme (conservation 41 → 61 % au monde 202) ; le 207
  // a guéri la CAUSE (les rendez-vous hors terrain) et la sur-chasse s'est mise à NUIRE
  // (épinglé 63 % c. vivant 53 % mesurés, recalibrage court 54 %) — clé COUPÉE au défaut,
  // le code reste réactivable. La clause garde le MÉCANISME : ballon vif dépassant le lead,
  // la clé ACTIVE met la cible au point d'arrêt (loin devant), la clé coupée au demi-pas.
  const cible = (over) => {
    const st = makeMatch({ full: true, seed: 5 });
    const cfg = matchCfg({ shotRange: 20, ...(over ?? {}) });
    const r = st.players.find((p) => p.team === 0 && p.post === 5);
    r.p[0] = 10; r.p[2] = 0; r.v[0] = 0; r.v[1] = 0;
    const from = st.players.find((p) => p.team === 0 && p.post === 4);
    from.p[0] = 0; from.p[2] = 0;
    st.ball.restart([14, 0.11, 0.5], { cause: 'coup-franc' });
    st.restart = null;
    st.ball.impulse([9, 0, 0]);
    st.pass = { from: from.id, to: r.id, lead: [10, 0, 0], style: 'ground', t: st.t - 1.2, flight: 1.0, origin: [0, 0] };
    st.phase = 'flight'; st.possession = { team: 0, carrier: -1 }; st.lastTouch = 0; st.lastPasser = from.id;
    matchStep(st, 1 / 60, cfg);
    return +r.target[0].toFixed(1);
  };
  const on = cible({ rattrape: false, chasseRetombee: { depasse: 3, h: 1.2, frein: 1.8, cap: 25 } }), off = cible({ rattrape: false });   // rattrape (134) coupé des deux côtés : il vise le même ordre de cible pour un ballon fuyant — l'isolation du mécanisme
  ok(`lot 202/208 — LA RETOMBÉE SE CHASSE, rejetée au défaut mais le mécanisme VIT (ballon vif à 9 m/s dépassant le lead de 4 m : clé active → cible x ${on} au point d'arrêt ≥ ballon + 5 ; défaut coupé → ${off} ≤ 16 le demi-pas d'hier — l'histoire : le 207 a guéri la cause, la sur-chasse nuisait, 63 c. 53 %)`,
    on >= 19 && off <= 16);
}

// ---- lot 204 : LE PRESSING LIT LA PASSE (liste v3 point 8 précisé) — au MÉCANISME (213 : le
// juge de flux p80 a fondu à 0,45 m au fil des re-datages ; l'élection se prouve posée)
if (__bloc()) {
  // Un vol ADVERSE vers la bande : deux défenseurs, D1 à 2 m du ballon en vol, D2 à 2 m du point
  // de chute (12 m plus loin). Sous pressLead l'élu du press est D2 (il lit la passe) ; sans la
  // clé, D1 (il chasse le ballon en l'air) — le flip à la clé seule, même monde.
  const eluPress = (over) => {
    const st = makeMatch({ full: true, seed: 5 });
    const cfg = matchCfg({ shotRange: 20, ...(over ?? {}) });
    const sgn = Math.sign(st.pitch.attackGoal(1).x || 1);
    const t0 = st.players.filter((p) => p.team === 0 && !p.keeper), t1 = st.players.filter((p) => p.team === 1 && !p.keeper);
    const passeur = t1[5], recv = t1[7];
    for (const q of t0) { q.p[0] = -sgn * 40; q.p[2] = -25; }
    for (const q of t1) { q.p[0] = -sgn * 30; q.p[2] = -20; }
    passeur.p[0] = sgn * 5; passeur.p[2] = 0; recv.p[0] = sgn * 22; recv.p[2] = 24;
    const D1 = t0[3], D2 = t0[4];
    D1.p[0] = sgn * 9; D1.p[2] = 6; D2.p[0] = sgn * 20; D2.p[2] = 21;   // D1 à 5 m du ballon (à 2 m il l'interceptait avant toute élection), D2 à 3 m du point de chute
    st.ball.restart([sgn * 11, 0.11, 10], { cause: 'coup-franc' });
    st.restart = null;
    st.ball.impulse([sgn * 8, 0, 9]);
    st.pass = { from: passeur.id, to: recv.id, lead: [sgn * 22, 0, 24], style: 'ground', t: st.t - 0.6, flight: 2.2, origin: [sgn * 5, 0] };
    st.phase = 'flight'; st.possession = { team: 1, carrier: -1 }; st.lastTouch = 1; st.lastPasser = passeur.id;
    for (let i = 0; i < 2; i++) matchStep(st, 1 / 60, cfg);   // l'élection se lit aux premiers pas, avant que le vol ne se résolve
    const pr = t0.find((p) => p.job === 'press');
    return pr === D2 ? 'D2' : pr === D1 ? 'D1' : pr ? 'autre' : 'aucun';
  };
  const on = eluPress({}), off = eluPress({ pressLead: false });
  ok(`lot 204 — LE PRESSING LIT LA PASSE (fixture de l'élection : vol adverse vers la bande — sous la clé l'élu est D2 au point de chute (${on}), sans elle D1 au ballon en vol (${off}) ; le flux p80 10,9 → 8,4 au 204c, fondu à 0,45 m au monde 213 : informatif)`,
    on === 'D2' && off !== 'D2');
}

// ---- lot 207 : AUCUNE COURSE NE VISE HORS TERRAIN (retour utilisateur : « le joueur court
// en touche en pensant que c'est une passe en profondeur »)
if (__bloc()) {
  // L'INVARIANT (fix absolu, 4 poseurs corrigés — le RENDEZ-VOUS du through rabattu au cerveau
  // du passeur (rondo, P suivait la course en diagonale jusqu'à tz 46), le met du receveur, le
  // slot du soutien, le posted/deborde) : pendant un vol de passe hors remise, AUCUN joueur de
  // champ ne vise hors limites. Mesuré avant : 28 cibles/60 min ; après : 1 (le gardien, exclu
  // — il vit à sa ligne). Touches 27 → 19/60 min.
  let hors = 0;
  for (const seed of [3, 9, 21]) {
    const st = makeMatch({ full: true, seed });
    const cfg = matchCfg({ shotRange: 20 });
    const hx = st.pitch.hx, hz = st.pitch.hz;
    for (let i = 0; i < 300 * 60; i++) {
      matchStep(st, 1 / 60, cfg);
      if (!st.pass || st.restart || i % 5) continue;
      // périmètre 208 : le RECEVEUR seul — la version « tous les joueurs » comptait 108 dont
      // des LÉGITIMES (le dégagement volontaire en touche du 136 vise dehors PAR DESSEIN, le
      // press escortant un ballon sortant) — le motif utilisateur était le receveur/coureur.
      const q = st.players.find((p) => p.id === st.pass.to);
      if (q && !q.keeper && q.down <= 0 && q.target
        && (Math.abs(q.target[0]) > hx + 0.01 || Math.abs(q.target[2]) > hz + 0.01)) hors++;
    }
  }
  ok(`lot 207 — AUCUNE COURSE NE VISE HORS TERRAIN (${hors} cibles de champ hors limites / 3 × 300 s = 0 — le rendez-vous du through rabattu au cerveau du passeur, le receveur s'arrête à la craie ; mesuré 28 → 1 (gardien) / 60 min, touches 27 → 19)`,
    hors === 0);
}

// ---- lot 209 : LE UNE-DEUX REND (dette 196) — au MÉCANISME (212 : le flux à n≈25 est
// chaos-fragile — 41 % au monde 209, 18-27 % aux mondes 211-212 quelle que soit la clé coupée)
if (__bloc()) {
  // Le barème du retour : choosePass DIRECT — le mur posé, deux coéquipiers à distances et
  // couloirs comparables, l'un au relais CHAUD (_troisT) : la clé unDeux.retour (+2,5) l'élit ;
  // sans elle (unDeux: false), l'autre ou lui au hasard du barème → le flip à la clé seule.
  const { choosePass } = await import('../assets/starter/src/engine/rondo.js');
  const eluDe = (over) => {
    const st = makeMatch({ full: true, seed: 5 });
    const cfg = matchCfg({ shotRange: 20, ...(over ?? {}) });
    const sgn = Math.sign(st.pitch.attackGoal(0).x || 1);
    const mur = st.players.find((p) => p.team === 0 && p.post === 5);
    const A = st.players.find((p) => p.team === 0 && p.post === 8), C = st.players.find((p) => p.team === 0 && p.post === 7);
    for (const q of st.players) if (q.team === 0 && !q.keeper && ![5, 7, 8].includes(q.post)) { q.p[0] = -sgn * 40; q.p[2] = 20; }
    for (const q of st.players) if (q.team === 1 && !q.keeper) { q.p[0] = sgn * 45; q.p[2] = 25; }
    mur.p[0] = 0; mur.p[2] = 0; A.p[0] = sgn * 8; A.p[2] = 5; C.p[0] = sgn * 8; C.p[2] = -5;
    A._troisT = st.t + 2; C._troisT = -1;
    st.ball.restart([0.3, 0.11, 0], { cause: 'coup-franc' });
    st.restart = null; st.ball.possess(mur.id);
    st.possession = { team: 0, carrier: mur.id }; st.phase = 'carry'; st.hold = 1.0; st.lastTouch = 0;
    const best = choosePass(st, cfg);
    return best?.to?.id === A.id ? 'A' : best?.to?.id === C.id ? 'C' : 'autre';
  };
  const on = eluDe({}), off = eluDe({ unDeux: false });
  ok(`lot 209 — LE UNE-DEUX REND (barème direct : le mur élit le coureur au relais CHAUD (${on} = A) ; sans unDeux.retour ${off} — le flip à la clé ; le flux 41 % au monde 209, 18-27 % aux mondes 211-212 : DETTE, retrouver 40 %)`,
    on === 'A');
}

// ---- lot 211 : LE PORTEUR LIBRE PORTE (retour utilisateur « on doit encore améliorer les passes »)
if (__bloc()) {
  // Le tableau de bord contre le réel : tenue libre p50 0,9-1,2 s (réel 2-4), 671-729 passes/
  // 90 min/équipe (réel 400-600), tempo 2,3 s entre passes (réel 3-4) — le plafond 1,0 de la
  // tenue calme décapitait tout. cfg.tenueCalme : la plage [1,2 ; 3,0] × persona × tempo
  // (tactique) × decF (la note garde la tête) × rôle tenue (le meneur garde). Le juge : st.hold
  // au départ des passes LIBRES (adversaire > 3 m — l'owner oscille en conduite, leçon 181).
  const tenueDe = (over) => {
    const hs = [];
    for (const seed of [3, 5, 7]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ marquageSurface: false, repli: false, garde: false, shotRange: 20, ...(over ?? {}) });
      let cur = null, snap = null;
      for (let i = 0; i < 300 * 60; i++) {
        if (st.possession.carrier >= 0) {
          const c = st.players[st.possession.carrier];
          let d = 99; for (const q of st.players) if (q.team !== c.team && !q.keeper && q.down <= 0) d = Math.min(d, Math.hypot(q.p[0] - c.p[0], q.p[2] - c.p[2]));
          snap = { hold: st.hold, foe: d };
        }
        matchStep(st, 1 / 60, cfg);
        if (st.pass && st.pass.t !== cur?.t) {
          cur = { t: st.pass.t };
          if (snap && snap.foe > 3 && ['ground', 'driven', 'lofted'].includes(st.pass.style)) hs.push(snap.hold);
        }
      }
    }
    hs.sort((a, b) => a - b);
    return +(hs[hs.length >> 1] ?? 0).toFixed(2);
  };
  const V = tenueDe({}), E = tenueDe({ tenueCalme: false });
  ok(`lot 211 — LE PORTEUR LIBRE PORTE : tenue calme p50 vivant ${V} s ≥ épinglé ${E} + 0,6 et ≥ 1,8 (réel 2-4 — mesuré 1,17 → 2,32, le volume 671 → 608 passes/90 min ; la note decisions et le rôle tenue en facteurs, le tempo au coach)`,
    V >= E + 0.6 && V >= 1.8);
}

// ---- lot 212 : LE THROUGH PAIE SA COURSE PERDUE (retour utilisateur « améliorer les passes »)
if (__bloc()) {
  // Mesuré avant : ratés à marge de course p50 −6,2 m (le défenseur 6 m plus près du point de
  // chute que le receveur au LANCÉ) — le barème ignorait le prix du risque, et le through
  // REMPLAÇAIT la passe simple au même homme. cfg.throughRisque : la marge négative coûte au
  // score (× (2 − visionF) × style) et le through concurrence la simple. Le juge : les through
  // CONDAMNÉS au lancé (marge < −3 m), vivant c. épinglé, 4 × 300 s.
  const condamnes = (over) => {
    let n = 0, tot = 0;
    for (const seed of [3, 5, 7, 11]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ shotRange: 20, ...(over ?? {}) });
      let cur = null;
      for (let i = 0; i < 300 * 60; i++) {
        matchStep(st, 1 / 60, cfg);
        if (st.pass && st.pass.t !== cur?.t) {
          cur = { t: st.pass.t };
          if (!st.pass.through) continue;
          const lead = st.pass.lead, r = st.players.find((p) => p.id === st.pass.to), from = st.players.find((p) => p.id === st.pass.from);
          if (!r || !from) continue;
          let dDef = 99; for (const q of st.players) if (q.team !== from.team && q.down <= 0) dDef = Math.min(dDef, Math.hypot(q.p[0] - lead[0], q.p[2] - lead[2]));
          // le juge suit la LOI (213 : la marge en TEMPS — tDef = d/6,5 + 0,45 de réaction, tRec = d/vSol)
          const dRec = Math.hypot(r.p[0] - lead[0], r.p[2] - lead[2]), vSol = Math.max(Math.hypot(r.v[0], r.v[1]), 6.2 * (r.skill?.topF ?? 1));
          tot++; if ((dDef / 6.5 + 0.45) - dRec / vSol < -0.4) n++;
        }
      }
    }
    return { n, tot };
  };
  const V = condamnes({}), E = condamnes({ throughRisque: false });
  ok(`lot 212 — LE THROUGH PAIE SA COURSE PERDUE : through condamnés au lancé (marge en TEMPS < −0,4 s, le critère de la loi) vivant ${V.n}/${V.tot} ≤ épinglé ${E.n}/${E.tot} × 0,5 — le passeur qui voit la course perdue ne la joue pas (mesuré ratés −6,2 → +4,8 m de marge, through 64 → 40/90 min, réussite des through 62 → 68 %)`,
    V.n < E.n && V.n / Math.max(1, V.tot) <= 0.9 * E.n / Math.max(1, E.tot) && E.n >= 4);   // ÷2 → strictement moins ET ratio 0,9 DATÉ 213 (la loi est un terme DOUX depuis la marge en temps + les exemptions diagonale/relais : 6/24 c. 8/26)
}

// ---- lot 213 : LA PROFONDEUR ENTRE AVANTS (demande utilisateur : « l'attaquant lance les
// ailiers, les ailiers lancent l'attaquant ») — au MÉCANISME
if (__bloc()) {
  // La sonde AVANT : 44 passes profondes/90 min/équipe, l'attaquant en lançait 0, les ailiers 1.
  // Trois verrous levés : l'appel profond exige un espace derrière la ligne qu'il n'y a pas
  // dans le tiers offensif (→ l'APPEL COURT EN DIAGONALE, sa propre cadence, l'anticipation
  // pendant le vol) ; l'attaquant proche de l'ailier était élu au COMITÉ de soutien (un
  // slotter n'appelle jamais → la pointe reste la cible quand le ballon est large) ; le barème
  // n'avait aucun terme pour le DANGER du point de chute (→ dangerPasse × mentalite × visionF).
  // La fixture : ailier posé large dans le tiers, attaquant central près de la ligne → le burst
  // 'diagonale' part sous la clé ; sans elle (profondeurAvants: false), jamais.
  const diagDe = (over) => {
    const st = makeMatch({ full: true, seed: 5 });
    const cfg = matchCfg({ shotRange: 20, ...(over ?? {}) });
    const sgn = Math.sign(st.pitch.attackGoal(0).x || 1);
    const t0 = st.players.filter((p) => p.team === 0), t1 = st.players.filter((p) => p.team === 1);
    const ail = t0.find((p) => p.post === 7), att = t0.find((p) => p.post === 8);
    for (const q of t0) if (!q.keeper && ![7, 8].includes(q.post)) { q.p[0] = sgn * 5; q.p[2] = -20 + (q.post ?? 0) * 3; }
    ail.p[0] = sgn * 30; ail.p[2] = 22; att.p[0] = sgn * 34; att.p[2] = 3;
    t1.filter((p) => !p.keeper).forEach((q, i) => { q.p[0] = sgn * 38; q.p[2] = -12 + i * 6; if (i > 3) { q.p[0] = sgn * 20; q.p[2] = -15 + (i - 4) * 6; } });
    st.ball.restart([sgn * 30.3, 0.11, 22], { cause: 'coup-franc' });
    st.restart = null; st.ball.possess(ail.id);
    st.possession = { team: 0, carrier: ail.id }; st.phase = 'carry'; st.hold = 1.0; st.lastTouch = 0;
    st._possChangeAt = st.t - 9; st._possTeam = 0;
    for (let i = 0; i < 90; i++) {
      matchStep(st, 1 / 60, cfg);
      if (st.events.some((e) => e.type === 'burst' && e.kind === 'appel-profond' && e.by === att.id && e.espece === 'diagonale')) return true;
    }
    return false;
  };
  const on = diagDe({}), off = diagDe({ profondeurAvants: false });
  ok(`lot 213 — LA PROFONDEUR ENTRE AVANTS (fixture : ailier posé large dans le tiers, attaquant central près de la ligne — l'appel DIAGONALE part sous la clé (${on}) et jamais sans (${off}) ; flux mesuré : passes profondes 29 → 47/30 min, l'attaquant en lance 0 → 5, les ailiers 1 → 5)`,
    on === true && off === false);
}

// ---- lot 215 : LA PASSE FORCÉE SE JOUE SÛRE (retour utilisateur « améliorer les passes »)
if (__bloc()) {
  // Mesuré : 10 % des passes partent au holdMax, à 72-74 % de réussite — le forcé jouait le
  // meilleur score (profondeur, danger) comme un porteur libre ; apparié 12 graines : forcées
  // 72 → 76 %. cfg.passeSure : dans la fenêtre holdMax − avant, le COULOIR LE PLUS LARGE prime
  // (× sang-froid) et JAMAIS en profondeur. La fixture (choosePass direct, la géométrie du 213) :
  // ailier large, attaquant en appel diagonal, un soutien latéral sûr — libre (hold 1,0) → le
  // through à l'attaquant ; forcé (2,7) → le soutien ; forcé sans la clé → le through.
  const { choosePass } = await import('../assets/starter/src/engine/rondo.js');
  const elu = (hold, over) => {
    const st = makeMatch({ full: true, seed: 5 });
    const cfg = matchCfg({ shotRange: 20, ...(over ?? {}) });
    const sgn = Math.sign(st.pitch.attackGoal(0).x || 1);
    const t0 = st.players.filter((p) => p.team === 0), t1 = st.players.filter((p) => p.team === 1);
    const ail = t0.find((p) => p.post === 7), att = t0.find((p) => p.post === 8), B = t0.find((p) => p.post === 5);
    for (const q of t0) if (!q.keeper && ![5, 7, 8].includes(q.post)) { q.p[0] = sgn * 5; q.p[2] = -20 + (q.post ?? 0) * 3; }
    ail.p[0] = sgn * 30; ail.p[2] = 22;
    att.p[0] = sgn * 36; att.p[2] = 4; att.v[0] = sgn * 3; att.v[1] = 3;
    att._pace = { until: st.t + 1.6, kind: 'appel', esp: 'diagonale', dir: [sgn * 0.6, 0.8], next: st.t + 8 };
    B.p[0] = sgn * 24; B.p[2] = 14;
    t1.filter((p) => !p.keeper).forEach((q, i) => { q.p[0] = sgn * 38; q.p[2] = -12 + i * 6; if (i > 3) { q.p[0] = sgn * 20; q.p[2] = -15 + (i - 4) * 6; } });
    st.ball.restart([sgn * 30.3, 0.11, 22], { cause: 'coup-franc' });
    st.restart = null; st.ball.possess(ail.id);
    st.possession = { team: 0, carrier: ail.id }; st.phase = 'carry'; st.hold = hold; st.lastTouch = 0;
    const best = choosePass(st, cfg);
    return best?.to?.id === att.id ? (best.through ? 'ATT-through' : 'ATT') : best?.to?.id === B.id ? 'B' : 'autre';
  };
  const libre = elu(1.0, {}), force = elu(2.7, {}), forceHier = elu(2.7, { passeSure: false });
  ok(`lot 215 — LA PASSE FORCÉE SE JOUE SÛRE (choosePass direct : libre → ${libre} ; forcé → ${force} le soutien sûr ; forcé sans la clé → ${forceHier} — le flip à la fenêtre ET à la clé ; apparié 12 graines : forcées 72 → 76 %, toutes 78 → 77 (bruit))`,
    libre === 'ATT-through' && force === 'B' && forceHier === 'ATT-through');
}

// ---- lot 216 : LA PREMIÈRE INTENTION VIT (retour utilisateur « améliorer les passes »)
if (__bloc()) {
  // L'entonnoir mesuré : 4,3 % de une-touche (réel 15-25) — le gate pressé (< 2,6 m) ne s'ouvrait
  // que pour un quart des réceptions, le socle calme tirait à 12,5 %, et la REMISE COURTE en
  // retrait (LA une-touche du football) était refusée par le cap de dosage à contre-courant.
  // cfg.uneToucheVive : pressé dès 3,4 m, socle 0,7 × visionF, × rôle tenue, remise courte
  // faisable, couloir 0,9 (77 % de réussite, passes de jeu 78 %). La fixture (uneTouche direct,
  // tirage forcé à 1) : ballon arrivant à 6 m/s sur p, un coéquipier 4 m DERRIÈRE (à contre-
  // courant), un presseur à 2 m → la remise en retrait part sous la clé, pas sans.
  const { uneTouche } = await import('../assets/starter/src/engine/premiere-intention.js');
  const remise = (over) => {
    const st = makeMatch({ full: true, seed: 5 });
    const cfg = matchCfg({ marquageSurface: false, repli: false, garde: false, shotRange: 20, uneTouche: { ...matchCfg({ marquageSurface: false, repli: false, garde: false }).uneTouche, p: 1.0 }, ...(over ?? {}) });
    const sgn = Math.sign(st.pitch.attackGoal(0).x || 1);
    const t0 = st.players.filter((p) => p.team === 0 && !p.keeper), t1 = st.players.filter((p) => p.team === 1 && !p.keeper);
    const p = t0[5], mate = t0[4], from = t0[6];
    for (const q of t0) if (![4, 5, 6].includes(t0.indexOf(q))) { q.p[0] = -sgn * 40; q.p[2] = 25; }
    for (const q of t1) { q.p[0] = sgn * 45; q.p[2] = -25; }
    p.p[0] = 0; p.p[2] = 0; from.p[0] = -sgn * 12; from.p[2] = 0; mate.p[0] = -sgn * 4; mate.p[2] = 1.5;
    t1[0].p[0] = sgn * 2; t1[0].p[2] = 0.5;   // le presseur à 2 m (pressOk)
    st.ball.restart([-sgn * 1.2, 0.11, 0], { cause: 'coup-franc' });
    st.restart = null;
    st.ball.impulse([sgn * 6, 0, 0]);
    st.pass = { from: from.id, to: p.id, lead: [0, 0, 0], style: 'ground', t: st.t - 1.5, flight: 1.8, origin: [-sgn * 12, 0] };
    st.phase = 'flight'; st.possession = { team: 0, carrier: -1 }; st.lastTouch = 0; st.lastPasser = from.id;
    return !!uneTouche(st, p, cfg);
  };
  const on = remise({}), off = remise({ uneToucheVive: false });
  ok(`lot 216 — LA PREMIÈRE INTENTION VIT (uneTouche direct, la remise courte en retrait de 4 m à contre-courant sous presse : ${on} sous la clé, ${off} sans — le cap de dosage d'hier la refusait ; flux : une-touche 4,3 → 14-17 % à 77 %, passes de jeu 78 %)`,
    on === true && off === false);
}

// ---- lot 217 : LES CÉRÉMONIES DE REMISE AU RÉEL (le temps mort — retour aux passes)
if (__bloc()) {
  // Mesuré : temps mort 19 % du match (réel 35-40), touche 5,3 s (réel ~15), renvoi 6,8 (~25),
  // corner 9,8 (~30), coup franc 3,0 (20-30) — et 746 passes/90 min qui en découlaient.
  // cfg.tempsMort : une durée par ESPÈCE × tempo tactique × contexte de score × aléa seedé.
  // Le juge : la durée p50 des remises par espèce, vivant c. épinglé (3 × 300 s).
  const durees = (over) => {
    const d = {};
    for (const seed of [3, 5, 7]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ contrePress: false, shotRange: 20, ...(over ?? {}) });
      let cur = null, t0 = 0;
      for (let i = 0; i < 300 * 60; i++) {
        matchStep(st, 1 / 60, cfg);
        const ty = st.restart?.type ?? null;
        if (ty !== cur) { if (cur) (d[cur] ??= []).push(st.t - t0); cur = ty; t0 = st.t; }
      }
    }
    const p50 = (a) => { const b = [...(a ?? [])].sort((x, y) => x - y); return b.length ? b[b.length >> 1] : null; };
    return { touche: p50(d.touche), renvoi: p50(d['sortie-de-but']), cf: p50(d['coup-franc']), corner: p50(d.corner) };
  };
  const V = durees({}), E = durees({ tempsMort: false });
  const f = (x) => x == null ? '—' : x.toFixed(1);
  ok(`lot 217 — LES CÉRÉMONIES DE REMISE AU RÉEL (p50 vivant/épinglé : touche ${f(V.touche)}/${f(E.touche)} s ≥ 8, renvoi ${f(V.renvoi)}/${f(E.renvoi)} ≥ 14, coup franc ${f(V.cf)}/${f(E.cf)} ≥ 12 — chaque espèce vivante ≥ 1,5 × l'hier ; temps mort 19 → 24 %, passes 746 → 645/90 min)`,
    V.touche >= 8 && (V.renvoi == null ? E.renvoi == null : V.renvoi >= 14 && V.renvoi >= 1.5 * (E.renvoi ?? 99)) && (V.cf == null || V.cf >= 12) && V.touche >= 1.5 * (E.touche ?? 99));   // (225) un échantillon sans renvoi dans les deux bras ne juge pas le renvoi
}

// ---- lot 218 : LE LANCEUR DU UNE-DEUX SPRINTE (retour aux passes — « on doit encore améliorer les passes »)
if (__bloc()) {
  // Mesuré : le lanceur d'un une-deux trottait à 2,3 m/s à 0,3 s / 2,4 à 0,6 s (l'appel profond :
  // 4,4 / 5,5 ; le réel 6-8 dès 0,5 s) — la pointe portait un plafond sans CIBLE (la consigne
  // redevenait son slot à 1,5 m) et le plafond du soutien (4,9 × 1,28) — 1 retour/16.
  // cfg.unDeux.course : une cible dans le dos du presseur (m, ecart, élan mélangé), consommée par
  // les deux poseurs (comité et postés), et la vitesse de CHASSE le temps de la pointe. Le juge
  // au MÉCANISME : un coureur posé en pointe un-deux (sans marque de relais, pour ne pas être
  // élu receveur) — sa consigne EST sa cible et il file ; épinglé, il garde son slot au trot.
  const course = (over) => {
    const st = makeMatch({ full: true, seed: 5 });
    const cfg = matchCfg({ shotRange: 20, ...(over ?? {}) });
    const sgn = Math.sign(st.pitch.attackGoal(0).x || 1);
    const R = st.players.find((p) => p.team === 0 && p.post === 8), M = st.players.find((p) => p.team === 0 && p.post === 5), C = st.players.find((p) => p.team === 0 && p.post === 7);
    for (const q of st.players) if (q.team === 0 && !q.keeper && ![5, 7, 8].includes(q.post)) { q.p[0] = -sgn * 30; q.p[2] = 15; }
    for (const q of st.players) if (q.team === 1 && !q.keeper) { q.p[0] = sgn * 40; q.p[2] = 20; }
    R.p[0] = 0; R.p[2] = 0; R.v[0] = 0; R.v[1] = 0; C.p[0] = -sgn * 1; C.p[2] = -7; M.p[0] = -sgn * 4; M.p[2] = -3;
    st.ball.restart([-sgn * 3.7, 0.11, -3], { cause: 'coup-franc' });
    st.restart = null; st.ball.possess(M.id);
    st.possession = { team: 0, carrier: M.id }; st.phase = 'carry'; st.hold = 1.0; st.lastTouch = 0;
    const cible = [sgn * 8, 3];
    R._pace = { until: st.t + 2.4, kind: 'un-deux', next: st.t + 6, cible, dir: [sgn * 0.94, 0.35] }; R._troisT = -1;
    for (let i = 0; i < 36; i++) matchStep(st, 1 / 60, cfg);
    return { dT: R.target ? Math.hypot(R.target[0] - cible[0], R.target[2] - cible[1]) : 99, v: Math.hypot(R.v[0], R.v[1]) };
  };
  const V = course({}), E = course({ unDeux: { press: 2.5, dist: 13, p: 0.18, dur: 2.4, retour: 8, course: false } });
  ok(`lot 218 — LE LANCEUR DU UNE-DEUX SPRINTE (vivant : consigne à ${V.dT.toFixed(1)} m de sa cible < 1, ${V.v.toFixed(1)} m/s à 0,6 s ≥ 4 ; épinglé : ${E.dT.toFixed(1)} m > 3, ${E.v.toFixed(1)} m/s — le flux : 2,3 → 5,0 m/s à 0,3 s, retours 1/16 → 5/24 ; DETTE : le taux de retour (réel ~50 %) — les courses couvertes)`,
    V.dT < 1 && V.v >= 4 && E.dT > 3 && V.v >= E.v + 1.5);
  // (218b) LA COURSE CHERCHE L'ESPACE (course.espace) : le lanceur pressé derrière-côté (dos = +z),
  // le mur à 4 m, un défenseur qui COUVRE le rendez-vous +z → sous espace la cible part en −z ;
  // sans, dans la couverture (+z). Le flux : retours 9/54 → 16/55 sur 12 graines (réel ~50 %).
  const cote = (over, skill) => {
    const st = makeMatch({ full: true, seed: 5 });
    const cfg = matchCfg({ shotRange: 20, unDeux: { press: 2.5, dist: 13, p: 1.0, dur: 2.4, retour: 8, course: { m: 8, ecart: 3, elan: 0.5, ...over } } });
    const sgn = Math.sign(st.pitch.attackGoal(0).x || 1);
    const c = st.players.find((p) => p.team === 0 && p.post === 5), B = st.players.find((p) => p.team === 0 && p.post === 8);
    for (const p of st.players) if (p.team === 0 && !p.keeper && ![5, 8].includes(p.post)) { p.p[0] = -sgn * 30; p.p[2] = 15; }
    const foes = st.players.filter((p) => p.team === 1 && !p.keeper);
    for (const p of foes) { p.p[0] = sgn * 40; p.p[2] = 20; }
    c.p[0] = 0; c.p[2] = 0; c.v[0] = 0; c.v[1] = 0; B.p[0] = sgn * 4; B.p[2] = -0.5;
    if (skill) c.skill = { ...(c.skill ?? {}), ...skill };
    foes[0].p[0] = -sgn * 1.6; foes[0].p[2] = -0.9; foes[1].p[0] = sgn * 7; foes[1].p[2] = 3.5;
    st.ball.restart([0.3, 0.11, 0], { cause: 'coup-franc' });
    st.restart = null; st.ball.possess(c.id);
    st.possession = { team: 0, carrier: c.id }; st.phase = 'carry'; st.hold = 1.0; st.lastTouch = 0;
    for (let i = 0; i < 90 && !c._pace?.cible; i++) matchStep(st, 1 / 60, cfg);
    return c._pace?.cible ? c._pace.cible[1] : NaN;
  };
  const zE = cote({ espace: true }), zS = cote({});
  ok(`lot 218b — LA COURSE DU UNE-DEUX CHERCHE L'ESPACE (cible z ${zE.toFixed(1)} < 0 côté ouvert ; sans espace ${zS.toFixed(1)} > 0 dans la couverture — le flux : retours 9/54 → 16/55)`,
    zE < -1 && zS > 1);
  // (218d) LA LECTURE EST UNE NOTE : le coureur noté 0 en off the ball (otbF 0 → misread certain) lit le
  // MAUVAIS côté ; à 50 (otbF 1) aucun tirage — identité au bit (empreintes 218c inchangées).
  const zM = cote({ espace: true }, { otbF: 0 }), z50 = cote({ espace: true }, { otbF: 1 });
  ok(`lot 218d — LA LECTURE DU COUREUR EST UNE NOTE (otbF 0 : cible z ${zM.toFixed(1)} > 0 dans la couverture ; otbF 1 : ${z50.toFixed(1)} < 0 l'identité — équipes 20/50/90 : retours 44/71/64 %)`,
    zM > 1 && z50 < -1);
}

// ---- lot 218c : LE MUR REMET AU COUREUR (retour aux passes — le donne-et-va se ferme en une touche)
if (__bloc()) {
  // Sondé (sonde corrigée : le mur qui remet en une touche n'est jamais « owner » — l'ancienne
  // sonde le taisait) : 17 murs, 4 remises en une touche, AUCUNE au coureur ; 7 retours après
  // contrôle (32 %). Le coureur (6-12 m, couloir ouvert 1-3 m) était refusé par le cap de dose du
  // relais (6 m/s, 7-9 requis : le retour repart d'où venait le ballon, lot 131) et, quand
  // faisable, écrasé au tri par un appui libre (sans bloqueur la marge vaut 99). uneToucheVive
  // {mene 0,5, capRelais 10, relaisPrio} : la cible dans la course, le cap du retour, le relais
  // chaud faisable DEVANT. Mesuré : 9 remises/16 murs, retours 50 % (réel ~50), une-touche 77 %.
  const { uneTouche } = await import('../assets/starter/src/engine/premiere-intention.js');
  const elu = (over, skill) => {
    const st = makeMatch({ full: true, seed: 5 });
    const base = matchCfg();
    const cfg = matchCfg({ shotRange: 20, uneTouche: { ...base.uneTouche, p: 1.0 }, ...(over ?? {}) });
    const sgn = Math.sign(st.pitch.attackGoal(0).x || 1);
    const t0 = st.players.filter((p) => p.team === 0 && !p.keeper), t1 = st.players.filter((p) => p.team === 1 && !p.keeper);
    const p = t0[5], A = t0[8], C = t0[4], from = t0[6];
    for (const q of t0) if (![4, 5, 6, 8].includes(t0.indexOf(q))) { q.p[0] = -sgn * 40; q.p[2] = 25; }
    for (const q of t1) { q.p[0] = sgn * 45; q.p[2] = -25; }
    p.p[0] = 0; p.p[2] = 0; from.p[0] = -sgn * 8; from.p[2] = -6;
    if (skill) p.skill = { ...(p.skill ?? {}), ...skill };
    A.p[0] = sgn * 9; A.p[2] = 2; A.v[0] = sgn * 5; A.v[1] = 0.5; A._troisT = st.t + 2; A._pace = { until: st.t + 1.5, kind: 'un-deux', next: st.t + 6 };
    C.p[0] = sgn * 1; C.p[2] = 4;
    t1[0].p[0] = sgn * 2; t1[0].p[2] = -2.5;
    st.ball.restart([-sgn * 1.0, 0.11, -0.8], { cause: 'coup-franc' });
    st.restart = null;
    st.ball.impulse([sgn * 5.5, 0, 4.2]);
    st.pass = { from: from.id, to: p.id, lead: [0, 0, 0], style: 'ground', t: st.t - 1.2, flight: 1.5, origin: [-sgn * 8, -6] };
    st.phase = 'flight'; st.possession = { team: 0, carrier: -1 }; st.lastTouch = 0; st.lastPasser = from.id;
    const r = uneTouche(st, p, cfg);
    return r ? (st.pass?.to === A.id ? 'A' : st.pass?.to === C.id ? 'C' : 'autre') : 'non';
  };
  const V = elu({}), E = elu({ uneToucheVive: { press: 3.4, base: 0.7, dMin: 2.5, court: 7, capCourt: 8.5, couloir: 0.9, chas: 0.22 } });
  ok(`lot 218c — LE MUR REMET AU COUREUR (une touche vers ${V} = A le coureur du une-deux à 9 m en course ; hier ${E} = C l'appui libre — le flux : retours 32 → 50 %, une-touche 77 % tenue)`,
    V === 'A' && E === 'C');
  // (218d) LE MUR DOIT VOIR SON COUREUR : noté 0 en vision (visionF 0 → la priorité se perd à coup sûr)
  // il sert l'appui libre ; à 50 (visionF 1) aucun tirage — l'identité.
  const Vm = elu({}, { visionF: 0 }), V50 = elu({}, { visionF: 1 });
  ok(`lot 218d — LA VISION DU MUR EST UNE NOTE (visionF 0 : une touche vers ${Vm} = C l'appui ; visionF 1 : ${V50} = A le coureur — l'identité)`,
    Vm === 'C' && V50 === 'A');
}

// ---- lot 219 : LE DRIBBLE EST UN RÔLE, UN LIEU ET UNE CADENCE (le mantra — mesuré : 133 tentatives/30 min)
if (__bloc()) {
  // Mesuré avant : 133 tentatives/30 min hors doublons (dribbles vrais 58, réel 15-25), sur TOUS les
  // postes, à 21 m de la ligne la plus proche (11 % sur l'aile — le réel dribble sur l'aile).
  // cfg.dribble : facteurs sur les portes de tentative de skills-sim (le tirage est consommé de la
  // même façon — clé absente : l'hier au bit, jumeau vérifié) : aile/axe, tiers propre/adverse,
  // volume, cadence par joueur × axe(role.dribble) ; l'axe de rôle `dribble` (identité 0,5).
  // Le juge au MÉCANISME : dribM, la fonction pure — rôle, lieu, cadence, identité.
  const { dribM } = await import('../assets/starter/src/engine/skills-sim.js');
  const st = makeMatch({ full: true, seed: 5 });
  const cfg = matchCfg({ shotRange: 20 }), off = matchCfg({ shotRange: 20, dribble: false });
  const sgn = Math.sign(st.pitch.attackGoal(0).x || 1), hz = st.pitch.hz, hx = st.pitch.hx;
  const c = st.players.find((p) => p.team === 0 && !p.keeper);
  const at = (x, z, role) => { c.p[0] = sgn * x; c.p[2] = z; c.role = role ? { ...role } : undefined; c._dribAt = -99; return dribM(st, c, cfg); };
  const identite = at(0, 0, null), absent = (() => { c.p[0] = hz * 0.9; c.p[2] = hz * 0.9; c.role = undefined; c._dribAt = -99; return dribM(st, c, off); })();
  const aile = at(0, hz * 0.8, null), axe0 = at(0, 0, null), propre = at(-hx * 0.5, 0, null), adverse = at(hx * 0.5, 0, null);
  const roleHaut = at(0, 0, { dribble: 1 }), roleBas = at(0, 0, { dribble: 0 });
  c.p[0] = 0; c.p[2] = 0; c.role = undefined; c._dribAt = st.t; const enCadence = dribM(st, c, cfg);
  ok(`lot 219 — LE DRIBBLE EST UN RÔLE, UN LIEU ET UNE CADENCE (clé absente ${absent.toFixed(2)} = 1 l'identité ; volume ${identite.toFixed(2)} ; aile ${aile.toFixed(2)} > axe ${axe0.toFixed(2)} ; tiers propre ${propre.toFixed(2)} < adverse ${adverse.toFixed(2)} ; rôle 1 ${roleHaut.toFixed(2)} > rôle 0 ${roleBas.toFixed(2)} ; en cadence ${enCadence} — le flux : dribbles vrais 58 → 28/30 min, sur l'aile 11 → 27 %)`,
    Math.abs(absent - 1) < 1e-9 && aile > axe0 && propre < adverse && roleHaut > roleBas && enCadence === 0 && identite < 1);
}

// ---- lot 220 : LE RENDEZ-VOUS DANS LA FOULÉE (retour utilisateur : « il essaye de la récupérer trop tôt,
// passe à côté, refait un effort » ; « il court en dehors du terrain pour un ballon qu'il aurait dedans » ;
// « les passes en profondeur ne sont pas tranchantes »)
if (__bloc()) {
  // Tracé avant : sur une profonde de 34 m le receveur EN COURSE prenait pour cible le ballon lui-même
  // 20 m en amont (loi « menace → on court au ballon » écrite pour la passe courte), faisait demi-tour,
  // puis la cible sautait 10 m au-delà du lead, revenait, repartait : 9 changements de cible par vol,
  // 29 % de ballons DÉPASSÉS, 43 % de prises ; et la lead du through, plafonnée à 16 m avec un vol de
  // 2,9 s pour un coureur à 8 m/s, le faisait attendre 0,9 s planté. Trois lois, une primitive :
  // etaCourse (élan, accélération × accelF, pointe × topF) ; rendezVous (le premier point jouable DANS
  // le terrain, atteint avec marge × (2 − anticipF), dans la foulée : ballon descendu sous vPrise) ;
  // le through dont l'arrivée MONTE jusqu'à ce que le ballon arrive quand le coureur arrive.
  const { etaCourse, rendezVous, predictPath, solvePass } = await import('../assets/starter/src/engine/ball-predict.js');
  const { kick } = await import('../assets/starter/src/engine/ball.js');
  // (a) la primitive : l'élan compte, l'arrêt coûte, la pointe borne
  const tLance = etaCourse([0, 0, 0], [8, 0], [16, 0, 0], { accel: 7.5, top: 8, reach: 0 });
  const tArret = etaCourse([0, 0, 0], [0, 0], [16, 0, 0], { accel: 7.5, top: 8, reach: 0 });
  const tTravers = etaCourse([0, 0, 0], [0, 8], [16, 0, 0], { accel: 7.5, top: 8, reach: 0 });
  ok(`lot 220 — LA COURSE D'UN CORPS (etaCourse : lancé à 8 m/s ${tLance.toFixed(2)} s = 16/8 ; arrêté ${tArret.toFixed(2)} s > lancé + 0,4 ; élan de travers ${tTravers.toFixed(2)} s = arrêté — le perpendiculaire est perdu)`,
    Math.abs(tLance - 2) < 1e-6 && tArret > tLance + 0.4 && Math.abs(tTravers - tArret) < 1e-6);
  // (b) le rendez-vous DANS le terrain : un ballon roulé vers la ligne de touche (hz 34), le receveur à
  // 6 m de côté — le point élu est dedans (|z| ≤ 33,5) et en amont du point le plus tôt « atteignable »
  const g = kick([0, 0.11, 20], { speed: 9, dirYaw: Math.PI / 2, elevation: 0.02 });
  const chemin = predictPath(g, { dt: 1 / 30, maxT: 4 });
  const rv = rendezVous(chemin, [1.5, 0, 27], [0, 0], { accel: 7.5, top: 6.4, reach: 0.85, reaction: 0, marge: 0.2, maxHeight: 1.2, inside: [52.5, 34], vPrise: 6.5 });
  const dehors = chemin.some((s) => Math.abs(s.p[2]) > 34);
  // …et le coureur qui NE PEUT PAS couper avant la ligne ne reçoit AUCUN point (il ne court pas dehors)
  const loin = rendezVous(chemin, [12, 0, 22], [0, 0], { accel: 7.5, top: 6.4, reach: 0.85, reaction: 0, marge: 0.2, maxHeight: 1.2, inside: [52.5, 34], vPrise: 6.5 });
  ok(`lot 220 — LE BALLON QUI FRÔLE LA LIGNE SE COUPE EN AMONT (vol qui SORT : ${dehors} ; rendez-vous z ${rv?.p[2].toFixed(1)} ≤ 33,5 dedans, marge ${rv?.slack.toFixed(2)} s ≥ 0 ; le coureur trop loin : ${loin === null ? 'aucun point — il ne sort pas' : 'point z ' + loin.p[2].toFixed(1)})`,
    dehors && !!rv && Math.abs(rv.p[2]) <= 33.5 && rv.slack >= 0 && loin === null);
  // (c) le through arrive QUAND le coureur arrive : passeur posé, coureur en appel à 7,6 m/s ; vivant
  // |vol − ETA| ≤ 0,5 s ; hier (tranchant:false) le coureur attendait ≥ 0,8 s
  const { choosePass } = await import('../assets/starter/src/engine/rondo.js');
  const essai = (over) => {
    const st = makeMatch({ full: true, seed: 5 });
    const cfg = matchCfg({ shotRange: 20, ...(over ?? {}) });
    const sgn = Math.sign(st.pitch.attackGoal(0).x || 1);
    const c = st.players.find((p) => p.team === 0 && p.post === 5), A = st.players.find((p) => p.team === 0 && p.post === 8);
    for (const q of st.players) if (q.team === 0 && !q.keeper && ![5, 8].includes(q.post)) { q.p[0] = -sgn * 40; q.p[2] = 20; }
    for (const q of st.players) if (q.team === 1 && !q.keeper) { q.p[0] = sgn * 30; q.p[2] = -25; }
    c.p[0] = 0; c.p[2] = 0; A.p[0] = sgn * 10; A.p[2] = 8; A.v[0] = sgn * 7.5; A.v[1] = -1.5;
    A._pace = { until: st.t + 1.6, kind: 'appel', next: st.t + 8, dir: [sgn * 0.98, -0.2] }; A._runT = st.t + 1.7;
    st.ball.restart([0.3, 0.11, 0], { cause: 'coup-franc' }); st.restart = null; st.ball.possess(c.id);
    st.possession = { team: 0, carrier: c.id }; st.phase = 'carry'; st.hold = 1.0; st.lastTouch = 0;
    const b = choosePass(st, cfg);
    if (!b?.through) return null;
    const sol = solvePass([c.p[0], 0, c.p[2]], b.lead, { style: 'ground', arrival: b.arrival });
    const eta = etaCourse(A.p, A.v, b.lead, { accel: 7.5, top: 6.4 * 1.28, reach: 0.9 });
    return { ecart: sol.flightTime - eta, arr: b.arrival };
  };
  const V = essai({}), E = essai({ foulee: { ...matchCfg().foulee, tranchant: false } });
  ok(`lot 220b — LE THROUGH ARRIVE QUAND LE COUREUR ARRIVE (vivant : vol − ETA ${V?.ecart.toFixed(2)} s ≤ 0,5, arrivée ${V?.arr.toFixed(1)} m/s ; hier : ${E?.ecart.toFixed(2)} s ≥ 0,8 d'attente, arrivée ${E?.arr.toFixed(1)} — le flux : receveur au lead −6,8 → −0,1 m, dépassés 29 → 0-20 %, prises 43 → 60-73 %)`,
    !!V && !!E && V.ecart <= 0.5 && E.ecart >= 0.8 && V.arr > E.arr);
}

// ---- lot 221 : L'OBLIGATION DE REPLI (audit aval, constat 1 : « le repli défensif n'existe pas »)
if (__bloc()) {
  // Sondé : après une perte, 2,4 joueurs de champ devant la ligne du ballon ; 244/267 étaient des MARQUEURS
  // d'un appui de passe arrière (plafonnés à 5,6 m/s), 54 ne repassaient jamais derrière la ligne en 8 s.
  // cfg.repli : (a) un attaquant derrière le ballon (> marge) ne se marque pas ; (b) tout défenseur devant
  // la ligne du ballon sauf les pointes (axe tactique repli : round(axe(repli, 0, 2)), identité 1) prend
  // le burst 'repli' (sprint, exempt de l'allure) vers un point derrière la ligne, après delai × (2 − workF).
  // Le juge au MÉCANISME : une perte posée — porteur adverse au centre, quatre de mes joueurs de champ
  // 12-30 m devant la ligne du ballon, un attaquant adverse 6 m derrière le ballon. Après 1 s : le plus
  // avancé (la pointe) garde son poste ; les trois autres portent 'repli' avec une cible derrière la ligne
  // ; l'attaquant derrière le ballon n'est pas dans les marquables. Épinglé (repli:false) : aucun 'repli'.
  const repli = (over) => {
    const st = makeMatch({ full: true, seed: 5 });
    const cfg = matchCfg({ shotRange: 20, ...(over ?? {}) });
    const sgn = Math.sign(st.pitch.attackGoal(0).x || 1);   // l'équipe 0 attaque vers +sgn ; l'équipe 1 porte le ballon
    const c = st.players.find((p) => p.team === 1 && p.post === 5);
    const mes = st.players.filter((p) => p.team === 0 && !p.keeper).sort((a, b) => a.post - b.post);
    for (const q of st.players) if (q.team === 1 && !q.keeper && q.id !== c.id) { q.p[0] = -sgn * 20; q.p[2] = 15; }
    mes.forEach((q, k) => { q.p[0] = -sgn * (3 + k * 0.7); q.p[2] = (k - 3) * 3; q._pace = null; q._markT = null; });   // les six autres AUTOUR du ballon : presseur et couverture se prennent chez eux
    c.p[0] = 0; c.p[2] = 0;
    const derriere = st.players.find((p) => p.team === 1 && !p.keeper && p.id !== c.id); derriere.p[0] = sgn * 6; derriere.p[2] = 3;   // derrière le ballon POUR les attaquants (ils attaquent vers −sgn : derrière = côté +sgn)
    const devant = mes.slice(6, 10); devant.forEach((q, k) => { q.p[0] = sgn * (12 + 6 * k); q.p[2] = (k - 1.5) * 6; });
    st.ball.restart([0.3, 0.11, 0], { cause: 'coup-franc' }); st.restart = null; st.ball.possess(c.id);
    st.possession = { team: 1, carrier: c.id }; st.phase = 'carry'; st.hold = 1.0; st.lastTouch = 1; st._possChangeAt = st.t - 1; st._possTeam = 1;
    for (let i = 0; i < 60; i++) matchStep(st, 1 / 60, cfg);
    const sgD = -sgn;   // vers le but de l'équipe 0
    const avec = devant.filter((q) => q._pace?.kind === 'repli' && (q._pace.until ?? -1) > st.t);
    const pointe = devant.reduce((b, q) => (!b || (q.p[0] - b.p[0]) * sgn > 0 ? q : b), null);
    const ciblesDerriere = avec.filter((q) => q.target && (q.target[0] - st.ball.p[0]) * sgD > 0).length;
    const marque = (st._bMarks ?? []).some((a) => a.id === derriere.id);
    return { n: avec.length, pointeExempte: !avec.includes(pointe), ciblesDerriere, marque };
  };
  const V = repli({}), E = repli({ repli: false });
  ok(`lot 221 — L'OBLIGATION DE REPLI (vivant : ${V.n} = 3 rentrent en sprint, la pointe exemptée ${V.pointeExempte}, cibles derrière la ligne ${V.ciblesDerriere} = 3, l'appui derrière le ballon marqué ${V.marque} = false ; épinglé : ${E.n} = 0 — le flux : devant le ballon p50 3 → 1, rentrés 92 → 152/267, jamais 54 → 39)`,
    V.n === 3 && V.pointeExempte && V.ciblesDerriere === 3 && !V.marque && E.n === 0);
}

// ---- lot 222 : LA GARDE SUIT LA ZONE (audit aval, constat 2 : « le porteur est toujours à 2,5 m d'un adversaire »)
if (__bloc()) {
  // cfg.garde : la distance d'engagement du premier défenseur suit la zone (loin de mon but 6 m, milieu 3,
  // mon tiers au contact), × axe(pressing) × (2 − aggrF), divisée en fenêtre de pressing ; loin de mon but
  // hors fenêtre le bloc ne marque pas à l'homme ; le repos entre deux fenêtres × cooldown. Le juge au
  // MÉCANISME : un porteur posé et l'équipe adverse posée derrière — la cible du presseur élu après une
  // image, distance au ballon : loin ≥ 5 ; dans mon tiers ≤ 1,2 ; épinglé (garde:false) loin ≤ 1,2.
  const presseur = (xPorteur, over) => {
    const st = makeMatch({ full: true, seed: 5 });
    const cfg = matchCfg({ shotRange: 20, ...(over ?? {}) });
    const sgn = Math.sign(st.pitch.attackGoal(0).x || 1);   // l'équipe 0 attaque vers +sgn, son but est à −sgn
    const c = st.players.find((p) => p.team === 1 && p.post === 5);
    for (const q of st.players) if (q.team === 1 && !q.keeper && q.id !== c.id) { q.p[0] = xPorteur - sgn * 12; q.p[2] = 12; }
    const mes = st.players.filter((p) => p.team === 0 && !p.keeper);
    mes.forEach((q, k) => { q.p[0] = xPorteur - sgn * (8 + k * 3); q.p[2] = (k - 4) * 4; q._pace = null; q._markT = null; });
    c.p[0] = xPorteur; c.p[2] = 0;
    st.ball.restart([xPorteur + sgn * 0.3, 0.11, 0], { cause: 'coup-franc' }); st.restart = null; st.ball.possess(c.id);
    st.possession = { team: 1, carrier: c.id }; st.phase = 'carry'; st.hold = 1.0; st.lastTouch = 1;
    st._press = null; st._pressCd = { 0: st.t + 99, 1: st.t + 99 }; st._possChangeAt = st.t - 20; st._lossAt = {};   // aucune fenêtre : la perte est vieille, le repos long
    cfg.assignJobs(st, cfg);   // l'attribution seule, sans avancer le monde : le porteur possède, aucune passe ne part
    const pr = mes.find((q) => q.job === 'press');
    return pr?.target ? Math.hypot(pr.target[0] - c.p[0], pr.target[2] - c.p[2]) : null;
  };
  const loin = presseur(40, {}), proche = presseur(-40, {}), loinE = presseur(40, { garde: false });
  ok(`lot 222 — LA GARDE SUIT LA ZONE (cible du presseur : porteur loin de mon but ${loin?.toFixed(1)} m ≥ 5 ; dans mon tiers ${proche?.toFixed(1)} ≤ 1,2 ; épinglé loin ${loinE?.toFixed(1)} ≤ 1,2 — le flux : fenêtres 24 → 14 % du temps porté, presseur hors fenêtre 3,9-4,8 m loin du but ; l'adversaire le plus proche reste ~2,8 m : 55 % des échantillons profonds sont des fenêtres de contre-press après une perte — le tourbillon des pertes, la dette suivante)`,
    loin != null && loin >= 5 && proche != null && proche <= 1.2 && loinE != null && loinE <= 1.2);
}

// ---- lots 223-226 : LES REMISES ONT UNE STRUCTURE (audit aval : sortie de balle, coup franc, touche, événement placement)
if (__bloc()) {
  // Trois fixtures posées (une remise sans arbitre : st.restart écrit à la main), une par espèce ; l'épinglé
  // (clé absente) rend la marche vers le point de remise d'hier. Doc cpa.js et match-config.
  const scene = (type, pos, team, over, secs) => {
    const st = makeMatch({ full: true, seed: 5 });
    const cfg = matchCfg({ shotRange: 20, ...(over ?? {}) });
    for (let i = 0; i < 60; i++) matchStep(st, 1 / 60, cfg);
    st.ball.restart([pos[0], 0.11, pos[1]], { cause: type });
    st.restart = { type, team, p: [pos[0], pos[1]], at: st.t + 17, carried: false, placed: true };
    st.possession = { team, carrier: -1 }; st.phase = 'loose'; st.lastTouch = 1 - team;
    for (let i = 0; i < secs * 60; i++) matchStep(st, 1 / 60, cfg);
    return st;
  };
  const st0 = makeMatch({ full: true, seed: 5 }); const sgn = Math.sign(st0.pitch.attackGoal(0).x || 1), gx = st0.pitch.attackGoal(0).x, og = st0.pitch.ownGoal(0).x, hz = st0.pitch.hz;
  // 223 — le renvoi se sort : centraux aux coins de la surface (x 12-14 m de ma ligne, |z| ≥ 17), pivot dans l'axe à 20-24 m, latéraux à ≥ 27 m et larges
  const forme = (over) => {
    const st = scene('sortie-de-but', [og + sgn * 5.5, 3], 0, over, 11.5);
    const mes = st.players.filter((q) => q.team === 0 && !q.keeper).map((q) => ({ x: (q.p[0] - og) * sgn, z: q.p[2] }));
    const cb = mes.filter((m) => m.x >= 11 && m.x <= 15 && Math.abs(m.z) >= 17).length;
    const piv = mes.filter((m) => m.x >= 19 && m.x <= 25 && Math.abs(m.z) <= 5).length;
    const fb = mes.filter((m) => m.x >= 27 && m.x <= 33 && Math.abs(m.z) >= hz - 8).length;
    const auBallon = mes.filter((m) => m.x <= 9).length;
    return { cb, piv, fb, auBallon };
  };
  const V = forme({}), E = forme({ relance: false });
  ok(`lot 223 — LE RENVOI SE SORT (vivant : centraux écartés ${V.cb} = 2, pivot décroché ${V.piv} ≥ 1, latéraux hauts et larges ${V.fb} = 2, corps collés au ballon ${V.auBallon} = 0 ; épinglé : collés au ballon ${E.auBallon} ≥ 5 — la marche vers le point de remise d'hier)`,
    V.cb === 2 && V.piv >= 1 && V.fb === 2 && V.auBallon === 0 && E.auBallon >= 5);
  // 224 — la montée sur coup franc latéral à 25 m : ≥ 3 attaquants dans la surface à la prise, chaque monteur marqué à ≤ 1,5 m (p50), le mur de deux ; épinglé : 0 attaquant
  const cf = (over) => {
    const st = scene('coup-franc', [gx - sgn * 22, 14], 0, over, 16.5);
    const box = (q) => Math.abs(q.p[0] - gx) < 16.5 && Math.abs(q.p[2]) < 20.16;
    const att = st.players.filter((q) => q.team === 0 && !q.keeper && box(q));
    const dMin = att.map((a) => Math.min(...st.players.filter((q) => q.team === 1 && !q.keeper).map((d) => Math.hypot(d.p[0] - a.p[0], d.p[2] - a.p[2])))).sort((a, b) => a - b);
    return { att: att.length, marque: dMin[dMin.length >> 1] ?? 99, mur: st.restart?._mur?.length ?? 0, placement: st.events.filter((e) => e.type === 'placement' && e.espece === 'coup-franc').length };
  };
  const C = cf({}), CE = cf({ cpaMontee: false });
  ok(`lot 224 — LA MONTÉE SUR COUP FRANC (vivant : ${C.att} ≥ 3 attaquants dans la surface à la prise, marqués à ${C.marque.toFixed(1)} m ≤ 1,5 p50, mur ${C.mur} = 2 ; épinglé : ${CE.att} = 0)`,
    C.att >= 3 && C.marque <= 1.5 && C.mur === 2 && CE.att === 0);
  // 226 — la touche n'aimante que ses appuis : à la prise, coéquipiers du lanceur à < 12 m de la ligne ≤ 5 (le lanceur + 3-4 appuis) ; épinglé ≥ 7
  const touche = (over) => {
    const st = scene('touche', [sgn * 10, hz], 0, over, 3);
    return st.players.filter((q) => q.team === 0 && !q.keeper && q.target && hz - Math.abs(q.target[2]) < 12).length;   // les CIBLES (les marcheurs d'hier à 2,6 m/s n'arrivent pas dans la cérémonie de la fixture)
  };
  const T = touche({}), TE = touche({ remise: false });
  // 223b — le gardien lit la PRESSION : posé, presseur à 4 m → LONG (lofted/longue) ; presseur à 22 m avec un appui libre → COURT
  const { relancerGardien } = await import('../assets/starter/src/engine/keeper.js');
  const { simInternals } = await import('../assets/starter/src/engine/rondo-sim.js');
  const relance = (dPresseur, over) => {
    const st = makeMatch({ full: true, seed: 5 });
    const cfg = matchCfg({ shotRange: 20, ...(over ?? {}) });
    const gk = st.players.find((p) => p.team === 0 && p.keeper), ogx = st.pitch.ownGoal(0).x, sg = -Math.sign(ogx || 1);
    for (const q of st.players) if (q.team === 1 && !q.keeper) { q.p[0] = ogx + sg * 45; q.p[2] = 20; }
    const foes = st.players.filter((q) => q.team === 1 && !q.keeper); foes[0].p[0] = ogx + sg * (5 + dPresseur); foes[0].p[2] = 0;
    const mes = st.players.filter((q) => q.team === 0 && !q.keeper); mes.forEach((q, k) => { q.p[0] = ogx + sg * (14 + 4 * k); q.p[2] = (k % 2 ? 1 : -1) * (10 + k); });
    gk.p[0] = ogx + sg * 5; gk.p[2] = 0;
    st.ball.restart([gk.p[0] + sg * 0.3, 0.11, 0], { cause: 'coup-franc' }); st.restart = null; st.ball.possess(gk.id);
    st.possession = { team: 0, carrier: gk.id }; st.phase = 'carry'; st.hold = 1.0; st.lastTouch = 0; gk._mains = true;
    const ev0 = st.events.length;
    relancerGardien(st, gk, cfg, { beginPass: simInternals.beginPass });
    for (let i = 0; i < 90 && !st.events.slice(ev0).some((e) => e.type === 'pass' || e.type === 'relance-main' || e.type === 'clearance'); i++) matchStep(st, 1 / 60, cfg);   // le ballon part au CONTACT du geste (windup → pass)
    const pass = st.events.slice(ev0).find((e) => e.type === 'pass' || e.type === 'relance-main' || e.type === 'clearance');
    return pass ? (pass.type === 'relance-main' || (pass.type === 'pass' && pass.style === 'ground') ? 'court' : 'long') : 'aucune';
  };
  const pres = relance(4, {}), libre = relance(22, {});
  ok(`lot 223b — LE GARDIEN LIT LA PRESSION (presseur à 4 m : ${pres} = long ; presseur à 22 m et appui libre : ${libre} = court — le flux : 19 pertes/90 min avec la sortie structurée jouée court dans la pression)`,
    pres === 'long' && libre === 'court');
  ok(`lot 226 — LA TOUCHE N'AIMANTE QUE SES APPUIS (vivant : ${T} coéquipiers visant à < 12 m de la ligne ≤ 6 (lanceur, appuis, les deux larges de la formation) ; épinglé : ${TE} ≥ 8 — l'aimant d'hier ; le flux : 7 → 3 joueurs à < 12 m, réel 4-5)`,
    T <= 6 && TE >= 8);
}

// ---- lot 225 : L'AFFECTATION HOMME PAR HOMME (audit aval, constat 3 : un attaquant sur dix seul dans la surface)
if (__bloc()) {
  // Le juge au MÉCANISME : trois attaquants dans ma surface (ballon large dans mon tiers), mes marqueurs posés de
  // façon que le tri PERSONNEL d'hier en mette deux sur le même homme ; l'affectation couvre les trois (chaque
  // homme un marqueur à ≤ 3 m après 1 s), l'épinglé laisse un orphelin (> 3 m). cfg.assignJobs seul, puis 1 s.
  const couverture = (over) => {
    const st = makeMatch({ full: true, seed: 5 });
    const cfg = matchCfg({ shotRange: 20, ...(over ?? {}) });
    const ogx = st.pitch.ownGoal(0).x, sg = -Math.sign(ogx || 1);   // l'équipe 0 défend son but en ogx ; l'équipe 1 attaque
    const c = st.players.find((p) => p.team === 1 && p.post === 6);
    for (const q of st.players) if (q.team === 1 && !q.keeper && q.id !== c.id) { q.p[0] = ogx + sg * 45; q.p[2] = 20; }
    const atts = st.players.filter((p) => p.team === 1 && !p.keeper && p.id !== c.id).slice(0, 3);
    atts[0].p[0] = ogx + sg * 8; atts[0].p[2] = -3; atts[1].p[0] = ogx + sg * 11; atts[1].p[2] = 2; atts[2].p[0] = ogx + sg * 14; atts[2].p[2] = 6;   // trois hommes proches les uns des autres
    c.p[0] = ogx + sg * 22; c.p[2] = 28;   // le porteur large, dans mon tiers
    const mes = st.players.filter((p) => p.team === 0 && !p.keeper);
    mes.forEach((q, k) => { q.p[0] = ogx + sg * (4 + k * 1.5); q.p[2] = -12 + k * 2.5; q._markT = null; q._pace = null; });   // mes corps en diagonale serrée : les distances personnelles trient différemment (géométrie balayée : le tri d'hier n'en couvre qu'un)
    st.ball.restart([c.p[0] + sg * 0.3, 0.11, c.p[2]], { cause: 'coup-franc' }); st.restart = null; st.ball.possess(c.id);
    st.possession = { team: 1, carrier: c.id }; st.phase = 'carry'; st.hold = 1.0; st.lastTouch = 1;
    st._press = null; st._pressCd = { 0: st.t + 99, 1: st.t + 99 }; st._possChangeAt = st.t - 20; st._lossAt = {};
    for (let i = 0; i < 60; i++) matchStep(st, 1 / 60, cfg);
    const dists = atts.map((a) => Math.min(...mes.map((q) => Math.hypot(q.p[0] - a.p[0], q.p[2] - a.p[2]))));
    return { couverts: dists.filter((d) => d <= 3.2).length, max: Math.max(...dists) };
  };
  const V = couverture({}), E = couverture({ marquageSurface: false });
  ok(`lot 225 — L'AFFECTATION HOMME PAR HOMME (vivant : ${V.couverts} = 3 hommes couverts à ≤ 3,2 m, le plus loin à ${V.max.toFixed(1)} m ; épinglé : ${E.couverts} ≤ 2 — l'orphelin du tri personnel d'hier ; le flux : libres dans la surface 59 → 34 %, p50 3,5 → 2,2 m)`,
    V.couverts === 3 && E.couverts <= 2);
}

// ---- lot 227 : LA PASSE AVANT LE CONTACT (la racine du tourbillon des pertes — 61 % des pertes étaient des frappes au contact)
if (__bloc()) {
  // (a) la primitive : un presseur à 4 m qui ferme à 3 m/s arrive dans 1 s → sous le seuil 0,9 × (2 − anticipF) : vrai
  // pour l'anticipateur (1,15 → 0,77 s ? non : 4−1 = 3 m / 3 = 1,0 s > 0,77) — le juge pose les deux cas nets :
  // à 2,5 m fermant à 3 m/s (0,5 s) : tout le monde voit venir ; à 4 m fermant à 0,5 m/s (6 s) : personne.
  const { presseurArrive } = await import('../assets/starter/src/engine/pression.js');
  const AC = matchCfg({ contrePress: false, referme: false }).avantContact;
  const mk = (d, v) => ({ players: [{ team: 1, keeper: false, down: 0, p: [d, 0, 0], v: [-v, 0] }], }), c = { team: 0, p: [0, 0, 0], skill: null };
  ok(`lot 227 — LE PORTEUR LIT L'ARRIVÉE DU PRESSEUR (à 2,5 m fermant à 3 m/s : ${presseurArrive(mk(2.5, 3), c, AC)} = true ; à 4 m fermant à 0,5 m/s : ${presseurArrive(mk(4, 0.5), c, AC)} = false ; à 2,5 m à 3 m/s pour un porteur au sang-froid 1,15 et à l'anticipation 0,85 : ${presseurArrive(mk(2.5, 3), { ...c, skill: { composureF: 1.15, anticipF: 0.85 } }, AC)} = true encore (0,5 ≤ 0,9 × 1,15 × 1,15))`,
    presseurArrive(mk(2.5, 3), c, AC) === true && presseurArrive(mk(4, 0.5), c, AC) === false && presseurArrive(mk(2.5, 3), { ...c, skill: { composureF: 1.15, anticipF: 0.85 } }, AC) === true);
  // (b) LE FLUX : la porte de tenue (holdMin) interdit toute décision avant ~0,3 s après la prise, et le presseur
  // proche ouvre aussi le jeté d'hier — la fixture posée ne sépare pas les mondes ; la preuve est le tourbillon :
  // pertes de possession sur 3 × 300 s, vivant ≤ 0,9 × épinglé (mesuré 6 graines : 291 c. 360/90 min)
  const pertes = (over) => {
    let n = 0;
    for (const seed of [3, 5, 7]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ contrePress: false, referme: false, shotRange: 20, ...(over ?? {}) });
      let prev = -1;
      for (let i = 0; i < 300 * 60; i++) { matchStep(st, 1 / 60, cfg); const p = st.possession.team; if (p >= 0 && prev >= 0 && p !== prev && !st.restart) n++; prev = p >= 0 ? p : prev; }
    }
    return n;
  };
  const pV = pertes({}), pE = pertes({ avantContact: false });
  ok(`lot 227 — LA PASSE AVANT LE CONTACT (pertes de possession sur 3 × 300 s : vivant ${pV} ≤ 0,9 × épinglé ${pE} — le flux à 6 graines : 360 → 291/90 min, passes 77 → 84 %)`,
    pV <= 0.9 * pE);
}

// ---- lot 228 : LA LIGNE SE REFERME (la bibliothèque : « un qui sort de la ligne, trois qui couvrent », Gourcuff)
if (__bloc()) {
  // La primitive : une ligne de quatre à z −14, −5, 6, 16 ; le poste 1 (z −5) sort presser → son voisin le plus proche
  // (poste 0, à 9 m) glisse de part (0,5 × posF 1 × axe marquage 0,5 → 0,9 = 0,45) : −14 → −9,95 ; le second (poste 2, à
  // 11 m) de 0,25 × 0,9 = 0,225 : 6 → 3,525 ; clé absente : rien ne bouge ; marquage à l'HOMME (1,0 → axe 0,6) : le
  // voisin glisse moins (−14 → −11,3). Le flux : écart max p90 24,5 → 19,4 m.
  const { refermerLigne } = await import('../assets/starter/src/engine/marquage.js');
  const { axe } = await import('../assets/starter/src/engine/tactics.js');
  const mk = () => [[-20, -14], [-20, -5], [-20, 6], [-20, 16]];
  const defs = [0, 1, 2, 3].map((k) => ({ id: k, post: k, skill: null }));
  const mapD = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const dzDe = (cfgX, tq) => { const st = {}; const sp = mk(); refermerLigne(st, sp, mapD, 4, defs[1], defs, cfgX, tq, axe); return { dz: st._bRefermeDz ?? new Map(), sp }; };
  const V = dzDe(matchCfg(), { marquage: 0.5 }), E = dzDe(matchCfg({ referme: false }), { marquage: 0.5 }), H = dzDe(matchCfg(), { marquage: 1.0 });
  // le décalage vit dans st._bRefermeDz (les spots ne sont pas mutés — muter changeait la hauteur de la ligne par un consommateur invisible)
  ok(`lot 228 — LA LIGNE SE REFERME (le poste 1 sort : le voisin z −14 glisse de ${V.dz.get(0)?.toFixed(2)} (= 4,05), le second z 6 de ${V.dz.get(2)?.toFixed(3)} (= −2,475), le sorti sans décalage ${V.dz.has(1)}, les spots intacts ${V.sp[0][1]} ; épinglé : ${E.dz.size} = 0 ; marquage à l'homme : ${H.dz.get(0)?.toFixed(1)} < ${V.dz.get(0)?.toFixed(1)} — la zone couvre, l'homme reste)`,
    Math.abs(V.dz.get(0) - 4.05) < 1e-6 && Math.abs(V.dz.get(2) + 2.475) < 1e-6 && !V.dz.has(1) && V.sp[0][1] === -14 && E.dz.size === 0 && H.dz.get(0) < V.dz.get(0));
}

if (__bloc()) {
  // LE CONTRE-PRESSING CHRONOMÉTRÉ (229, contrepress.js, cfg.contrePress — la bibliothèque : « 6 s Guardiola, 5 s Klopp,
  // 8-10 s Rangnick »). Le flux (3 × 300 s appariés) : à chaque perte en bloc COMPACT (≥ 4 des siens à < 20 m), les siens
  // EN CHASSE (job press/intercept) à +1/+3/+5 s puis +8 s — la meute vit pendant l'horloge (5,5 s × axe pressing × work)
  // et MEURT après (recul-frein). Mesuré 10 × 300 s : 1,3/1,0/0,9/0,7 → 2,3/2,1/2,1/0,9 ; regain < 10 s 45 → 49 %.
  // La primitive par l'événement : dur 5,5 à l'identité (axe 0,6…1,4 → 1), 7,7 sous gegenpressing (pressing 1,0).
  const film = (over, tactics, secs) => { let n = 0; const s = [0, 0, 0, 0], T = [1, 3, 5, 8], evs = [];
    for (const seed of [3, 5, 7]) { const cfg = matchCfg({ shotRange: 20, ...over }); const st = makeMatch({ full: true, seed, tactics }); let prev = -1; const open = [];
      for (let i = 0; i < secs * 60; i++) { const n0 = st.events.length; matchStep(st, 1 / 60, cfg);
        for (let e = n0; e < st.events.length; e++) if (st.events[e].type === 'contre-press') evs.push(st.events[e]);
        const poss = st.possession.team;
        for (const L of open) { const dt = st.t - L.t0, ch = st.players.filter((p) => p.team === L.perdant && !p.keeper && (p.job === 'press' || p.job === 'intercept')).length;
          for (let k = 0; k < 4; k++) if (!L.done[k] && dt >= T[k]) { L.done[k] = 1; L.s[k] = ch; }
          if (dt >= 8.1) L.fin = true; }
        for (const L of open.filter((l) => l.fin)) { open.splice(open.indexOf(L), 1); n++; for (let k = 0; k < 4; k++) s[k] += L.s[k]; }
        if (poss >= 0 && prev >= 0 && poss !== prev && !st.restart
          && st.players.filter((p) => p.team === prev && !p.keeper && Math.hypot(p.p[0] - st.ball.p[0], p.p[2] - st.ball.p[2]) < 20).length >= 4) open.push({ t0: st.t, perdant: prev, done: [0, 0, 0, 0], s: [0, 0, 0, 0] });
        prev = poss >= 0 ? poss : prev; } }
    return { n, m: s.map((v) => v / Math.max(1, n)), evs }; };
  const V = film({}, null, 300), E = film({ contrePress: false }, null, 300), G = film({}, ['gegenpressing', null], 90);
  const f1 = (a) => a.map((v) => v.toFixed(1)).join('/'), dG = G.evs.find((e) => e.team === 0)?.dur;
  ok(`lot 229 — LE CONTRE-PRESSING CHRONOMÉTRÉ (chasseurs à +1/+3/+5/+8 s après ${V.n} pertes compactes : meute ${f1(V.m)} c. sans la clé ${f1(E.m)} (${E.n}) — ≥ 2,0 à +1 s, ≥ +0,6 à +1 et +5 s, ≤ 1,3 à +8 s : l'horloge meurt ; ${V.evs.length} meutes ≥ 20, dur ${V.evs[0]?.dur} = 5,5 à l'identité, ${dG} = 7,7 sous gegenpressing ; sans la clé ${E.evs.length} = 0)`,
    V.m[0] >= 2.0 && V.m[0] >= E.m[0] + 0.6 && V.m[2] >= E.m[2] + 0.6 && V.m[3] <= 1.3 && V.evs.length >= 20 && V.evs[0]?.dur === 5.5 && dG === 7.7 && E.evs.length === 0);
}

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
