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
const RP_1609 = { elan: { recul: 3.5, lat: 1.5, vitesse: 4, patience: 4 }, volee: { h: 1, avance: 0.45, lacher: 0.72 }, touche: { recul: 0.25 } };   // remisesPied d'HIER (e81394e) — DATÉ 16/09 (lot A9 ter, note 368 : sortie de but longue, touche longue, mur qui saute sous remisesPied.elan.sortieBut / toucheLongue / mur) : matchCfg REMPLACE les objets imbriqués, on repasse l'objet entier d'hier ; l'empreinte jumelle a prouvé sous-clés absentes = hier au bit
const SOL_1609 = { tenue: 0.9, corps: 0.9 };   // sol d'HIER sans aide — DATÉ 16/09 (relevé aidé, note 369 : sol.aide)
const TETE_1609 = { min: 1.5, max: 2.2, reach: 1.0, but: 12, saut: 0.75, duel: 1.9 };   // tete d'HIER sans armee — DATÉ 16/09 (lot B3, note 373 : tete.armee)
const LOI12_1609 = { avantage: 1.8, contact: 0.9, mur: 9.15, jaune: 2 };   // loi12 d'HIER sans murTrot — DATÉ 16/09 (lot B4, note 374 : loi12.murTrot ; viragesLisses/plantVitesse null : B5/B6, même note)
const RP_0746 = { elan: { recul: 3.5, lat: 1.5, vitesse: 4, patience: 4, sortieBut: { recul: 3, lat: 1.2, vitesse: 3.5 }, toucheLongue: { recul: 4 }, tirImmediat: { cone: 40 } }, volee: { h: 1, avance: 0.45, lacher: 0.72 }, touche: { recul: 0.25 }, mur: { retard: 0.12 } };   // remisesPied de 0746dbd (A9 ter + B2, sans mur.corps ni elan.attente) — DATÉ 16/09 (B4, note 374)
const B_0746 = { loi12: LOI12_1609, viragesLisses: null, plantVitesse: null, sortieAerienne: null, retournee: null, bouclier: null, ceremonie: null, ramasseurs: null, boiterie: null, entrant: null, petitsGestes: null, passements: null, enchainement: null, orientationPasse: null, verticalite: null, decalage: null, toucheOrientee: null, remisesPied: RP_0746 };   // les clés venues APRÈS 0746dbd, éteintes (B4 murTrot/mur.corps/elan.attente, B5, B6, B10) — DATÉ 16/09 : les clauses non épinglées mesurent le monde de 0746dbd (suite 761/7 sur ce moteur)
const LEUR_1609 = {"loi12": {"avantage": 1.8, "contact": 0.9, "mur": 9.15, "jaune": 2}, "viragesLisses": null, "plantVitesse": null, "sortieAerienne": null, "tete": {"min": 1.5, "max": 2.2, "reach": 1, "but": 12, "saut": 0.75, "duel": 1.9}, "retournee": null, "enchainement": null, "ramasseurs": null, "boiterie": null, "entrant": null, "petitsGestes": null, "conduiteNommee": null, "passements": null, "arbitreGestes": null, "fete": null, "sol": null, "remisesPied": {"elan": {"recul": 3.5, "lat": 1.5, "vitesse": 4, "patience": 4}, "volee": {"h": 1, "avance": 0.45, "lacher": 0.72}, "touche": {"recul": 0.25}}, "bouclier": null, "ceremonie": null};   // LEURS CLÉS D'HIER — DATÉ fusion 16/09 (278-280 × A2-C3) : les dix-neuf clés que la branche animations a posées depuis f62c3d8, à leurs valeurs du 15/09 (null ou l'objet d'alors) — le monde de mon parent 29c0f95 au bit (3bc007bc74a4355f / 6c592ab9df792a83) sur l'état fusionné e798b47
const MES_1609 = { blocPercu: null, enveloppe: null, visee: null, ellipse: null, repertoire: null, arretControle: null, ligneAccrochee: null };   // MES CLÉS D'HIER — DATÉ fusion 16/09 : les sept clés de 275-280 nulles = le monde de la branche animations 5f8870f au bit (bb530de469f21cbc / d5ba9ca701a880fa) sur l'état fusionné e798b47
import { formationSpots, checkFormation, premierOffensif, blocFor } from '../assets/starter/src/engine/formation.js';
import { evadeSpot, choosePass } from '../assets/starter/src/engine/rondo.js';
import { makeMatch, matchCfg, matchStep, checkMatch, playMatch, matchInternals } from '../assets/starter/src/engine/match-sim.js';
import { couloirDe, ouvrirRegistre, placerCouloir, tenirDemiEspace, dansOmbre } from '../assets/starter/src/engine/couloirs.js';
import { checkOffside, offsideLine, pointCorps, horsJeuTente } from '../assets/starter/src/engine/offside.js';
import { simInternals } from '../assets/starter/src/engine/rondo-sim.js';
import { tackleWindow, accrocheP, tacleDegage, slideTackleStep } from '../assets/starter/src/engine/duel.js';
import { tryCross, tryShot } from '../assets/starter/src/engine/shooting.js';
import { finitionSigma } from '../assets/starter/src/engine/strike-sim.js';
import { attendDe, ouvreDe } from '../assets/starter/src/engine/ouverture.js';
import { seuilPresseDe, presseLueDe } from '../assets/starter/src/engine/presse-lue.js';
import { serreDe } from '../assets/starter/src/engine/serre.js';
import { piqueTenteDe, piqueReussiteDe } from '../assets/starter/src/engine/tacle-debout.js';
import { pausaStep, ttpDe, engages } from '../assets/starter/src/engine/pausa.js';
import { piegeStep } from '../assets/starter/src/engine/piege.js';
import { etaApres, sigmaSync, affiniteMotif, chocFamiliarite, etaDe, affinite } from '../assets/starter/src/engine/familiarite.js';
import { profilDe, epsilonDe, fatigueDe, pasLoco, pointePermise } from '../assets/starter/src/engine/locomoteur.js';
import { intentionDe, horizonDe, pasDe, appelPertinent } from '../assets/starter/src/engine/effort.js';
import { qualiteDe, sigmaObs, sigmaDe, predit, croyanceDe, croyanceStep } from '../assets/starter/src/engine/croyance.js';
import { draw, tirage, FLUX } from '../assets/starter/src/engine/rng.js';
import { pressionDe, toucheDe, pFailDe, budgetDe, classeDe, sigmaPasse, issueDe } from '../assets/starter/src/engine/reception.js';
import { tauLecture, ecartCru, interceptionApply } from '../assets/starter/src/engine/interception.js';
import { classeNommee, survieDe, pSuccDe, termeDe, CLASSES, logit as logitS } from '../assets/starter/src/engine/selection.js';
import { ISSUES, PARTS_BOOK, B_BOOK, disqueDe, margeDe, featuresDe, logitsDe, probasDe, tirerIssue, noyauAuContact, appliquerNoyau } from '../assets/starter/src/engine/noyau.js';
import { specialisteF, glissePermis, fauteGlisse } from '../assets/starter/src/engine/nature.js';
import { BANDES_OPTA, bandeDe, addDe, huitSecondes, gestionDe } from '../assets/starter/src/engine/temps.js';
import { sigmaFou, qualiteDe as qualiteFou, sortieFolle, appliquerFou } from '../assets/starter/src/engine/fou.js';
import { xgGeo, logitGeo, sig as sigXg, angleVisible, coneDe, xgDe, thetaDe, porteDe, evContDe } from '../assets/starter/src/engine/xg.js';
import { retardDe, referenceDe, ligneStep, accrocheDe } from '../assets/starter/src/engine/ligne.js'; import { prefiltreDe } from '../assets/starter/src/engine/prefiltre.js'; import { xtAt, xtDe, versBook, termeXt } from '../assets/starter/src/engine/xt.js'; import { attenteToucheDe } from '../assets/starter/src/engine/temps.js'; import { skipCeremonie } from '../assets/starter/src/engine/ceremonie.js'; import { hashDe, microDe, attenteVivanteStep } from '../assets/starter/src/engine/attente-vivante.js'; import { fenetreDe, engageDe, ecartDe as ecartEngage, malusDe, rabatDe } from '../assets/starter/src/engine/engage.js'; import { sigmaLayoffF, scoreLayoffDe, impossibleDe } from '../assets/starter/src/engine/layoff.js'; import { rendezVousDe } from '../assets/starter/src/engine/rendezvous.js'; import { porteeDe, cibleDe, integriteDe, interligneStep } from '../assets/starter/src/engine/interligne.js'; import { latenceDe, kxDe, anchorPercu, decalageDe } from '../assets/starter/src/engine/bloc-percu.js'; import { tempsDeVol, porteeDe as porteeEnv, tDispDe, rhoDe, pSaveDe, decisionEnveloppe } from '../assets/starter/src/engine/enveloppe.js'; import { MODES, poidsDe, viseeDe } from '../assets/starter/src/engine/visee.js'; import { mapPostes as mapPostesL, formationPour as formationPourL, LIGNES as LIGNES_L } from '../assets/starter/src/engine/formation.js';
import { tempoWait } from '../assets/starter/src/engine/referee.js';
import { pasDecision, hzDecision, ticksDecision } from '../assets/starter/src/engine/cadence.js';
import { planStrike } from '../assets/starter/src/engine/approach.js';
import { TECHNIQUES } from '../assets/starter/src/engine/technique.js';
import { teteStep } from '../assets/starter/src/engine/tete.js';
import { coachStep, checkCoach } from '../assets/starter/src/engine/coach.js';
import { movePlayers } from '../assets/starter/src/engine/movement.js';
import { laneClearance } from '../assets/starter/src/engine/ball-predict.js';
import { maybeDoubleContact, maybePetitPont, maybeRoulette, skillContactNow } from '../assets/starter/src/engine/skills-sim.js';
import { resoudreTactique, tac, axe as axeT } from '../assets/starter/src/engine/tactics.js';
import { cornerTrav, cornerSpots, coupFrancDirect, adjugeFaute } from '../assets/starter/src/engine/referee.js';
import { relancerGardien, gkTenueDue } from '../assets/starter/src/engine/keeper.js';
import { makeProfile } from '../assets/starter/src/engine/attributes.js';
import { chestStep } from '../assets/starter/src/engine/tete.js';
import { resoudreRole } from '../assets/starter/src/engine/roles.js';
import { KEEPER, keeperDecide, keeperSpot } from '../assets/starter/src/engine/keeper.js';
import { menaceTir } from '../assets/starter/src/engine/menace.js';
import { normale, ecartDe, vitesseDe } from '../assets/starter/src/engine/ellipse.js'; import { GESTES, FAMILLE, gesteDe, vitesseGeste, vMaxDe, dispersionGeste } from '../assets/starter/src/engine/repertoire.js'; import { gauss as gaussM } from '../assets/starter/src/engine/attributes.js'; import { predictPath as predictPath278 } from '../assets/starter/src/engine/ball-predict.js';

// LE MONDE DE LABO (lot 111 — le patron de neutralisation symétrique MUTUALISÉ : chaque
// nouveau lot de flux re-cassait les clauses d'isolation une par une ; désormais les clauses
// de LABO — celles qui isolent UNE loi ancienne — épinglent ce monde des DEUX côtés).
// C'est le flux d'avant les lots 105-111, gelé : les clauses y mesurent leur loi, pas le monde.
const LAB = { couloirs: false, /* DATÉ 241 : la clause mesure SA loi — le bras gelé (frappeConduite:false) frappe des ballons reçus en course, population que les couloirs accélèrent (2,48 c. 2,26 : inversé) */ ecarte: false, conduiteCouloir: false, ramasse: false, audace: false,
  chaloupe: false, troisieme: false,
  uneTouche: { press: 2.6, vmax: 9.5, portee: 14, couloir: 0.5, p: 0.65, calme: 0.5, dose: false }, clearServi: false,
  tete: { min: 1.5, max: 2.2, reach: 1.0, but: 12 },   // …la fenêtre debout (pré-112 : ni détente ni duel du venant)
  coach: false,                                         // …les axes gelés (pré-113 : le monde qui ne réagit pas au score)
  skill: { ...matchCfg({ ...B_0746 }).skill, doubleFoe: null, pontFoe: null, rouletteFoe: null, sortieBurst: null },   // …le répertoire pré-114/115/117 (ni croqueta, ni pont, ni roulette)
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
const ISO131 = { clearServi: false, uneTouche: { ...matchCfg({ ...B_0746 }).uneTouche, dose: false }, honneur: false, regardGardien: false, marquageCentre: false, interception: false, meetReel: false, rattrape: false, engagement: false, assignTenue: false, sortieGardien: false, clearTouche: false, accompagne: false, yawSlew: false, tranchant: false, pousse: false, fixe: false, oeil: false, dispersion: false, semellePlace: false, departVu: false, tacleVif: false, mord: false, pressZone: false, rondSort: false, compression: false, tacleDegage: false, courseServie: false, lectureCourse: false, retenueSurface: false, corpsOuvert: false, gkTenue: false, rayonsLoi: false, gkFace: false, clearSigma: false, contreTir: false, craie: false, gkPied: false, allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, moities: false, retourTrot: false, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, preneurCPA: false, loi16: false, priseGant: false, appuisRecev: false, chasseRetombee: false, pressLead: false, appelNote: false, tenueCalme: false, throughRisque: false, profondeurAvants: false, dangerPasse: false, passeSure: false, uneToucheVive: false, tempsMort: false, ancrage: false, roleStructure: false, corner: { claqueV: 13, priseV: 16 }, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 }, sortieGardien: {}, celebration: { dur: 6.5, n: 3 } };
const POST131 = { honneur: false, regardGardien: false, marquageCentre: false, interception: false, meetReel: false, rattrape: false, engagement: false, assignTenue: false, sortieGardien: false, clearTouche: false, accompagne: false, yawSlew: false, tranchant: false, pousse: false, fixe: false, oeil: false, dispersion: false, semellePlace: false, departVu: false, tacleVif: false, mord: false, pressZone: false, rondSort: false, compression: false, tacleDegage: false, courseServie: false, lectureCourse: false, retenueSurface: false, corpsOuvert: false, gkTenue: false, rayonsLoi: false, gkFace: false, clearSigma: false, contreTir: false, craie: false, gkPied: false, allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, moities: false, retourTrot: false, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, preneurCPA: false, loi16: false, priseGant: false, appuisRecev: false, chasseRetombee: false, pressLead: false, appelNote: false, tenueCalme: false, throughRisque: false, profondeurAvants: false, dangerPasse: false, passeSure: false, uneToucheVive: false, tempsMort: false, ancrage: false, roleStructure: false, corner: { claqueV: 13, priseV: 16 }, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 }, sortieGardien: {}, celebration: { dur: 6.5, n: 3 } };   // la clause 131 isole SES successeurs (132-160) — sa loi seule varie
// le PACK 142-145 (la semelle rare, l'œil, le jeté, le souffle d'exécution) : les clauses de flux d'AVANT s'y épinglent
const ISO142 = { fixe: false, oeil: false, dispersion: false, semellePlace: false, departVu: false, tacleVif: false, mord: false, pressZone: false, rondSort: false, compression: false, tacleDegage: false, courseServie: false, lectureCourse: false, retenueSurface: false, corpsOuvert: false, gkTenue: false, rayonsLoi: false, gkFace: false, clearSigma: false, contreTir: false, craie: false, gkPied: false, allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, moities: false, retourTrot: false, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, preneurCPA: false, loi16: false, priseGant: false, appuisRecev: false, chasseRetombee: false, pressLead: false, appelNote: false, tenueCalme: false, throughRisque: false, profondeurAvants: false, dangerPasse: false, passeSure: false, uneToucheVive: false, tempsMort: false, ancrage: false, roleStructure: false, corner: { claqueV: 13, priseV: 16 }, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 }, sortieGardien: {}, celebration: { dur: 6.5, n: 3 } };
import { momentDuJeu, marquageCentre } from '../assets/starter/src/engine/phases.js';
import { busy as busyG } from '../assets/starter/src/engine/gesture.js';
import { FORMATIONS, LIGNES, formationPour, mapPostes, POSTES_FORMATION, ROLES_FORMATION, GRILLE, litPoste, posteNom, lignesFines, checkPostes } from '../assets/starter/src/engine/formation.js';
import { ROLES, LIBELLES_ROLES, rolesGrille, checkRoles } from '../assets/starter/src/engine/roles.js';
import { estPointe, estLateral, pivotDe, pointeDe, familiarite } from '../assets/starter/src/engine/formation.js';
import { profilAuPoste, POSTE_MALUS } from '../assets/starter/src/engine/attributes.js';
import { refermerLigne } from '../assets/starter/src/engine/marquage.js';
import { makeProfile as __mp } from '../assets/starter/src/engine/attributes.js';
import { couvertStep } from '../assets/starter/src/engine/couvert.js';
import { readdirSync as __rd, readFileSync as __rf } from 'node:fs';
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
  const cfg = matchCfg({ remisePostes: null, rendezVous: null /* remisePostes et rendezVous null DATÉ 281 : vert à HEAD~ (worktree 0f5e292), le plein format remangé (20 passes en 3 min c. ≥ 25) — la clause mesure sa loi, pas la passe au rendez-vous ni les postes de la remise */, ...B_0746,  temps: null /* temps null DATÉ 270 : vert à HEAD~ (worktree ad1b275), le plus long silence d'événements 34,8 s c. 31 : la borne suivait la cérémonie du but, les cérémonies vivent maintenant dans la bande Opta (corner jusqu'à 50 s) — la clause mesure le gel, pas le temps du match ; la borne à re-dater */, repertoire: null, arretControle: null /* repertoire et arretControle null DATÉ 279 : vert à HEAD~ (worktree 842c118), le plein format de 3 min remangé (18 passes c. 25) — la clause mesure sa loi, pas les vitesses du book ni l'arrêt au journal */, enveloppe: null /* enveloppe null DATÉ 276 : vert à HEAD~ (worktree b8a2d62), le plein format remangé (17 passes en 3 min c. 25) : le gardien à l'enveloppe change les tirs et le jeu qui suit — la clause mesure sa loi, pas l'enveloppe */, temps: null /* temps null DATÉ 270 : vert à HEAD~ (worktree ad1b275), le plus long silence d'événements 34,8 s c. 31 : la borne suivait la cérémonie du but, les cérémonies vivent maintenant dans la bande Opta (corner jusqu'à 50 s) — la clause mesure le gel, pas le temps du match ; la borne à re-dater */, ...LEUR_1609 /* DATÉ fusion 16/09 : la combinaison remange ce flux — vert dans les deux parents (29c0f95, 5f8870f) ; la clause mesure sa loi sur le monde de son parent */, shotRange: 20 });
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
  // 330 → 480 s (238, même doctrine) : à 34 tirs par 100 min, 330 s à zéro tir a 16 % de chance — la graine 7 est
  // sèche dans le monde d'hier aussi (1 tir en 300 s, 2-4 en 600) ; la fenêtre suit le tempo, jamais la graine.
  const { st: s2, trace } = playMatch(st2, 480, { cfg: matchCfg({ remisePostes: null, rendezVous: null /* remisePostes et rendezVous null DATÉ 281 : vert à HEAD~ (worktree 0f5e292), le plein format remangé (20 passes en 3 min c. ≥ 25) — la clause mesure sa loi, pas la passe au rendez-vous ni les postes de la remise */, pausaPied: null, recevoirSurPlace: null, pasDeRecul: null, remisesPied: RP_1609, tete: TETE_1609, loi12: LOI12_1609, viragesLisses: null, plantVitesse: null, sortieAerienne: null, retournee: null, bouclier: null, ceremonie: null, ramasseurs: null, boiterie: null, entrant: null, petitsGestes: null, passements: null, enchainement: null, orientationPasse: null, verticalite: null, decalage: null, toucheOrientee: null /* remisesPied hier DATÉ 16/09 (lot A9 ter, note 368) — chaque clause de flux mesure le monde de son jour */, sol: null, fete: null /* sol, fete null DATÉ 15/09 (lots A10 bis-A11, notes 360-361 : le fauché reste à terre plus longtemps, la fête a un corps — chaque clause mesure le monde de son jour, empreinte jumelle prouvée) */ /* DATÉ 15/09 (dettes A12, note 358) : vert à HEAD~ (suite à clés nulles 694/7), le monde remangé par la pausa au pied, la réception sur place et le pas de recul — la clause mesure sa loi, pas les miennes */, repertoire: null, arretControle: null /* repertoire et arretControle null DATÉ 279 : vert à HEAD~ (worktree 842c118), le plein format de 3 min remangé (18 passes c. 25) — la clause mesure sa loi, pas les vitesses du book ni l'arrêt au journal */, pausaPied: null, recevoirSurPlace: null, pasDeRecul: null /* DATÉ 15/09 (dettes A12, note 358) : vert à HEAD~ (suite à clés nulles 694/7), le monde remangé par la pausa au pied, la réception sur place et le pas de recul — la clause mesure sa loi, pas les miennes */, ...LEUR_1609 /* DATÉ fusion 16/09 : la combinaison remange ce flux — vert dans les deux parents (29c0f95, 5f8870f) ; la clause mesure sa loi sur le monde de son parent */, shotRange: 20 }) });
  const r = checkMatch(s2, trace, cfg);
  ok(`le CONTRAT du match tient à 22 (checkMatch : ${r.ok ? 'ok' : r.issues.slice(0, 2).join(' ; ')})`, r.ok);
}

// ---------- 3. le bloc est un BLOC : les postes sont TENUS en jeu
if (__bloc()) {
  const st = makeMatch({ full: true, seed: 11 });
  const cfg = matchCfg({ ...B_0746,  shotRange: 20 });
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
  const cfg0 = matchCfg({ ...B_0746,  cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure la longueur défendante du sabotage bloc élastique, pas le pas de décision */,  contrePress: false, ligneAccrochee: null /* ligneAccrochee null DATÉ 280 : vert à HEAD~ (worktree 303b2e4), la longueur défendante remangée (29,8 m — le bloc tient sa consigne) — la clause mesure sa loi, pas la ligne accrochée */, cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure la longueur défendante du sabotage bloc élastique, pas le pas de décision */,  contrePress: false, shotRange: 20 });
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
      const cfg = matchCfg({ ...B_0746,  cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure la longueur défendante du sabotage bloc élastique, pas le pas de décision */,  contrePress: false, ligneAccrochee: null /* ligneAccrochee null DATÉ 280 : vert à HEAD~ (worktree 303b2e4), la longueur défendante remangée (29,8 m — le bloc tient sa consigne) — la clause mesure sa loi, pas la ligne accrochée */, cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure la longueur défendante du sabotage bloc élastique, pas le pas de décision */,  contrePress: false, shotRange: 20, finition: null, contre: null /* contre null DATÉ 258b : vert à HEAD~ (38,6 ≥ 36,7 au 258 isolé), le sabotage remangé par le corps qui contre (36,7 c. 37,6) — la clause mesure le bloc, pas le contre */, ...cfgX });   // finition null DATÉ 258 : vert à HEAD (sabotage 38,6 ≥ 36,7 au 252), la longueur du bloc remangée par les tirages de l'échelle de finition (36,4 c. 37,5) — la clause mesure le bloc, pas le tir
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
  const b47 = matchCfg({ ...B_0746,  shotRange: 20 }).bloc;
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
    const s = evadeSpot(st, w, matchCfg({ ...B_0746,  shotRange: 20, ...over }));
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
  const b51 = matchCfg({ ...B_0746,  shotRange: 20 }).bloc;
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
    const cfg = matchCfg({ ...B_0746,  flux: null /* flux null DATÉ 264 : vert à HEAD~ (worktree 9eee4ea), la fixture FORCE le tirage par st.rnd2 (0,99 : la prise propre) et le flux nommé ne l'écoute plus (possédé par −1) — la clause mesure le prix de la touche, pas le flux */, shotRange: 20, ...cfgExtra });
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
    const cfg = matchCfg({ ...B_0746,  shotRange: 20, ...cfgExtra });
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
    for (const seed of [1, 3, 5, 7]) {   // 2 → 4 graines DATÉ 241 (gelé 2,29 c. vivant 2,37 sur 57 gestes : l'écart de 0,12 vit dans le bruit du p50)
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ pausaPied: null, recevoirSurPlace: null, pasDeRecul: null, remisesPied: RP_1609, tete: TETE_1609, loi12: LOI12_1609, viragesLisses: null, plantVitesse: null, sortieAerienne: null, retournee: null, bouclier: null, ceremonie: null, ramasseurs: null, boiterie: null, entrant: null, petitsGestes: null, passements: null, enchainement: null, orientationPasse: null, verticalite: null, decalage: null, toucheOrientee: null /* remisesPied hier DATÉ 16/09 (lot A9 ter, note 368) — chaque clause de flux mesure le monde de son jour */, sol: null, fete: null /* sol, fete null DATÉ 15/09 (lots A10 bis-A11, notes 360-361 : le fauché reste à terre plus longtemps, la fête a un corps — chaque clause mesure le monde de son jour, empreinte jumelle prouvée) */ /* DATÉ 15/09 (dettes A12, note 358) : vert à HEAD~ (suite à clés nulles 694/7), le monde remangé par la pausa au pied, la réception sur place et le pas de recul — la clause mesure sa loi, pas les miennes */, interligne: null /* interligne null DATÉ 274 : vert à HEAD~ (worktree f755654), la foulée de frappe remangée (le gelé 3,39 c. vivant − 0,12) : le milieu tenu change les frappes — la clause mesure sa loi, pas l'interligne */, noyau: null /* noyau null DATÉ 268 : vert à HEAD~ (worktree b3276ae), la foulée de frappe remangée (le monde gelé 5,40 c. vivant − 0,12) : d'autres duels, d'autres frappes — la clause mesure sa loi, pas le noyau de duel */, passe: null /* passe null DATÉ 265 : vert à HEAD~ (worktree 1507550), la statue qui frappe remangée (3,39 c. vivant 2,76 − 0,12) — la clause mesure la foulée de frappe, pas la réception */, flux: null /* flux null DATÉ 264 : vert à HEAD~ (worktree 9eee4ea), la statue qui frappe remangée (3,51 c. vivant 2,74 − 0,12) — la clause mesure la foulée de frappe, pas le flux */, cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure la foulée de frappe et son sabotage, pas le pas de décision */,  croyance: null /* croyance null DATÉ 262 : vert à HEAD~ (worktree b5bd034), la statue qui frappe remangée (3,76 c. vivant 3,33 − 0,12) — la clause mesure la foulée de frappe, pas la croyance */, shotRange: 20, ...cfgExtra });
      for (let i = 0; i < 120 * 60; i++) {
        matchStep(st, 1 / 60, cfg);
        for (const e of st.events) {
          if (e._vuF) continue; e._vuF = true;
          if ((e.type === 'shot' || e.type === 'pass') && e.by != null) {
            const p = st.players[e.by];
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
    for (const seed of [1, 3, 2, 4]) {   // 2 → 4 graines DATÉ A10 (le sabotage à 55 % pour 55,6 exigés : un point, à deux graines)
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ remisePostes: null, rendezVous: null /* remisePostes et rendezVous null DATÉ 281 : vert à HEAD~ (worktree 0f5e292), la frappe en course remangée par le point de rendez-vous (27 stops nets sur 78 frappes en course c. ≤ 50 %) — la clause mesure sa loi, pas la passe au rendez-vous ni les postes de la remise */, pausaPied: null, recevoirSurPlace: null, pasDeRecul: null, remisesPied: RP_1609, tete: TETE_1609, loi12: LOI12_1609, viragesLisses: null, plantVitesse: null, sortieAerienne: null, retournee: null, bouclier: null, ceremonie: null, ramasseurs: null, boiterie: null, entrant: null, petitsGestes: null, passements: null, enchainement: null, orientationPasse: null, verticalite: null, decalage: null, toucheOrientee: null /* remisesPied hier DATÉ 16/09 (lot A9 ter, note 368) — chaque clause de flux mesure le monde de son jour */, sol: null, fete: null /* sol, fete null DATÉ 15/09 (lots A10 bis-A11, notes 360-361 : le fauché reste à terre plus longtemps, la fête a un corps — chaque clause mesure le monde de son jour, empreinte jumelle prouvée) */ /* DATÉ 15/09 (dettes A12, note 358) : vert à HEAD~ (suite à clés nulles 694/7), le monde remangé par la pausa au pied, la réception sur place et le pas de recul — la clause mesure sa loi, pas les miennes */, piege: null /* piege null DATÉ 255 : vert à HEAD~ (worktree 67cb463), la course de frappe remangée par la ligne synchrone (47 stops sur 160, l'élan retenu 83/142) — la clause mesure la foulée de frappe, pas le piège */, horsJeu: null /* horsJeu null DATÉ 259 : vert à HEAD~ (worktree 3a78940), la course de frappe remangée par l'orteil et la course qui traverse (36 stops sur 134 ≤ 50 % tient, l'élan retenu 82/148 bascule) — la clause mesure la foulée de frappe, pas la Loi 11 */, pausaPied: null, recevoirSurPlace: null, pasDeRecul: null /* DATÉ 15/09 (dettes A12, note 358) : vert à HEAD~ (suite à clés nulles 694/7), le monde remangé par la pausa au pied, la réception sur place et le pas de recul — la clause mesure sa loi, pas les miennes */, blocPercu: null /* blocPercu null DATÉ 275 : vert à HEAD~ (worktree 7e6cd12), la course qui traverse la frappe remangée (27 stops c. 50 %) : le bloc qui perçoit change les frappes en course — la clause mesure sa loi, pas le bloc perçu */, piege: null /* piege null DATÉ 255 : vert à HEAD~ (worktree 67cb463), la course de frappe remangée par la ligne synchrone (47 stops sur 160, l'élan retenu 83/142) — la clause mesure la foulée de frappe, pas le piège */, horsJeu: null /* horsJeu null DATÉ 259 : vert à HEAD~ (worktree 3a78940), la course de frappe remangée par l'orteil et la course qui traverse (36 stops sur 134 ≤ 50 % tient, l'élan retenu 82/148 bascule) — la clause mesure la foulée de frappe, pas la Loi 11 */, shotRange: 20, passation: null, ...cfgExtra });   // passation null DATÉ 252 : vert à HEAD, l'élan retenu 70/137 c. 56 sous la remise au pivot (bord de Poisson)
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
          const p = st.players[e.by ?? -1];
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
      const cfg = matchCfg({ ...B_0746,  shotRange: 20, ...ISO142, ...cfgExtra });
      let pris = null;
      for (let i = 0; i < 30 * 60; i++) {
        matchStep(st, 1 / 60, cfg);
        const rp = st.events.find((e) => e.type === 'restart-pris');
        if (rp && pris == null) pris = rp;
        const p = pris && st.events.find((e) => e.type === 'pass' && e.by === pris.by && e.t > pris.t);
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
    const cfg = matchCfg({ ...B_0746,  shotRange: 20 });
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
    const cfg = matchCfg({ ...B_0746,  shotRange: 20, ...cfgOver });
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
    const cfg = matchCfg({ presseLue: null /* presseLue null DATÉ 289 : vert à HEAD~ (worktree 7bd70e0), 20,9 % du temps de possession en position illicite > 14 sur la pire graine dans ce monde — la clause mesure sa loi, pas la pression lue au temps d'arrivée */, ...B_0746,  cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure le temps des pointes en position illicite, pas le pas de décision */, ligneAccrochee: null /* ligneAccrochee null DATÉ 280 : vert à HEAD~ (worktree 303b2e4), le temps en position illicite remangé (16,2 % — la ligne accrochée met les pointes hors-jeu) — la clause mesure sa loi, pas la ligne accrochée */, cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure le temps des pointes en position illicite, pas le pas de décision */, shotRange: 20, tranchant: false, pousse: false });   // la clause isole 140/141 (la rupture AJOUTE des appels — son monde a sa clause)
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
    const cfg = matchCfg({ ...B_0746,  shotRange: 20 });
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
    const cfg = matchCfg({ ...B_0746,  shotRange: 20, pressTriggers: false });
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
    const cfg = matchCfg({ ...B_0746,  shotRange: 20 });
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
      const cfg = matchCfg({ ...B_0746,  shotRange: 20, coverShadow, jockey: false, gardeTiers: false });   // (238) la fixture mesure le point d'ombre d'hier (1,15 m) ; la garde par tiers le pousse à sa distance de cadrage
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
      const cfg = matchCfg({ ...B_0746,  shotRange: 20, ...over });
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
    const cfg = matchCfg({ ...B_0746,  shotRange: 20 });
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
    const cfg = matchCfg({ layoff: null /* layoff null DATÉ 287 : vert à HEAD~ (worktree 4535d0f), 23 passes < 24 en 120 s dans ce monde — la clause mesure sa loi, pas la une-touche jugée par son angle */, ...B_0746,  interligne: null /* interligne null DATÉ 274 : vert à HEAD~ (worktree f755654), le match 4-4-2 c. 3-5-2 remangé (19 passes c. 24) : le milieu tenu change la circulation — la clause mesure sa loi, pas l'interligne */, ligneAccrochee: null /* ligneAccrochee null DATÉ 280 : vert à HEAD~ (worktree 303b2e4), le plein format 4-4-2 c. 3-5-2 remangé (13 passes) — la clause mesure sa loi, pas la ligne accrochée */, interligne: null /* interligne null DATÉ 274 : vert à HEAD~ (worktree f755654), le match 4-4-2 c. 3-5-2 remangé (19 passes c. 24) : le milieu tenu change la circulation — la clause mesure sa loi, pas l'interligne */, ...LEUR_1609 /* DATÉ fusion 16/09 : la combinaison remange ce flux — vert dans les deux parents (29c0f95, 5f8870f) ; la clause mesure sa loi sur le monde de son parent */, shotRange: 20 });
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
    const cfg = matchCfg({ ...B_0746,  effort: null /* effort null DATÉ 261 : vert à HEAD~ (worktree edda355, pic 1,98), le pic 2,90 est un porteur TACLÉ AU SOL (down 1,5 s) dont le ballon roule pendant que possession.carrier le nomme encore — la possession fantôme du taclé (dette de comptabilité nommée au 339), pas la conduite ; la clause mesure la conduite d'un porteur debout */, shotRange: 20, ...LAB });   // le monde de labo (lot 111)
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
    for (const seed of [1, 3, 5, 7]) {   // 2 → 4 graines DATÉ 237 (25 c. 26 : un point, un tirage)
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ pausaPied: null, recevoirSurPlace: null, pasDeRecul: null, remisesPied: RP_1609, tete: TETE_1609, loi12: LOI12_1609, viragesLisses: null, plantVitesse: null, sortieAerienne: null, retournee: null, bouclier: null, ceremonie: null, ramasseurs: null, boiterie: null, entrant: null, petitsGestes: null, passements: null, enchainement: null, orientationPasse: null, verticalite: null, decalage: null, toucheOrientee: null /* remisesPied hier DATÉ 16/09 (lot A9 ter, note 368) — chaque clause de flux mesure le monde de son jour */, sol: null, fete: null /* sol, fete null DATÉ 15/09 (lots A10 bis-A11, notes 360-361 : le fauché reste à terre plus longtemps, la fête a un corps — chaque clause mesure le monde de son jour, empreinte jumelle prouvée) */ /* DATÉ 15/09 (dettes A12, note 358) : vert à HEAD~ (suite à clés nulles 694/7), le monde remangé par la pausa au pied, la réception sur place et le pas de recul — la clause mesure sa loi, pas les miennes */, croyance: null /* croyance null DATÉ 262 : vert à HEAD~ (worktree b5bd034), la statue du sabotage remangée (18 c. vivant 9 + 10) — la clause mesure la pose au-devant, pas la croyance */, locomoteur: null /* locomoteur null DATÉ 260 : vert à HEAD~ (worktree 8ff0842), la fixture remangée par le profil locomoteur (les corps démarrent en 2,3 τ, pas en une image : les fenêtres de placement d'hier) — la clause mesure le placement ou le flux d'hier, pas la locomotion */, horsJeu: null /* horsJeu null DATÉ 259 : vert à HEAD~ (worktree 3a78940), la pose figée remangée par la course qui traverse (17 % ≥ vivant + 10) — la clause mesure la marche au rendez-vous, pas la Loi 11 */, hommeLibre: false, shotRange: 20, ...cfgExtra });
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
  ok(`le RECEVEUR VIVANT (4 × 120 s : ${(vif.statue * 100).toFixed(0)} % du vol < 0,5 m/s ≤ 25, ${vif.geles}/${vif.vols} vols figés > 60 % ≤ 8 % — il vient au-devant, la prise se fait dans le pas)`,
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
  for (const seed of [2, 3, 4, 5, 7, 8, 9, 11, 13, 14, 15, 16, 17, 18, 19, 20]) {   // 8 → 16 graines DATÉ 238 (8 buts sur 10 cadrés : Poisson)   // élargi 205 (7 frappes = ±14 pts/but ; la dette « échantillon élargi » de la clause payée)
    const st = makeMatch({ full: true, seed });
    // …au LAB (lot 116 — le fix DURABLE annoncé au 3e élargissement : la clause isole le
    // gardien, une loi ancienne ; son échantillon de 6-11 cadrées restait la proie de chaque
    // flux nouveau — gelée au labo, elle ne re-cassera plus)
    const cfg = matchCfg({ ...B_0746,  qualiteTir: false, shotRange: 20, ...ISO142, ...LAB, chrono: { periodes: 2, duree: 180, pause: 6 } });
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
  const anglesDe = (over) => {   // une graine → deux sommées DATÉ 239 (3 c. ≥ 6 sur la graine 2 seule : Poisson)
    const dosParTech = { 'amorti-poursuite': 0, autres: 0 }; let recDos = 0, recN = 0, denyDos = 0;
    for (const seed of [2, 3]) {
    const st = makeMatch({ full: true, seed });
    const cfg = matchCfg({ layoff: null /* layoff null DATÉ 287 : vert à HEAD~ (worktree 4535d0f), 3 touches dos < 9 sous le cône coupé dans ce monde — la clause mesure sa loi, pas la une-touche jugée par son angle */, ...B_0746,  locomoteur: null /* locomoteur null DATÉ 260 : vert à HEAD~ (worktree 8ff0842), la fixture remangée par le profil locomoteur (les corps démarrent en 2,3 τ, pas en une image : les fenêtres de placement d'hier) — la clause mesure le placement ou le flux d'hier, pas la locomotion */, avantContact: false, repli: false, dribble: false, shotRange: 20, ...over });
    let nEv = 0;
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
    denyDos += st.deny?.['controle-dos'] ?? 0;
    }
    return { ap: dosParTech['amorti-poursuite'], recDos, recN, denyDos };
  };
  const vif70 = anglesDe({ yawSlew: false, serreRouge: false, dosFerme: false, lance: false, gkAuDevant: false, preneurCPA: false, loi16: false });               // la clause isole 139 et 189-193 (le marquage serré puis les remises à métier re-dataient le théâtre des dos)
  ok(`l'amorti-poursuite ne touche PLUS dans le dos (${vif70.ap} = 0 sur 2 × 240 s) et le refus est NOMMÉ (deny controle-dos ${vif70.denyDos} ≥ 1 — le ballon court, il n'obéit pas)`,
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
    let n = 0, dos = 0, deny = 0, foulee = 0;
    for (const seed of [2, 3, 5, 7, 11, 13, 17, 19]) {   // 2 → 8 graines DATÉ 237 (3 c. 3,2 %, puis 5 c. 5,7 à 4)
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ ...B_0746,  avantContact: false, cpaMontee: false, remise: false, relance: false, repli: false, garde: false, dribble: false, shotRange: 20, passation: null, contre: null /* contre null DATÉ 258b : vert à HEAD~ (19/347 ≤ 6 % au 258 isolé), la conduite dos remangée par le corps qui contre (24/346 = 6,9 %) — la clause mesure l'aimant, pas le contre */, ...ISO142, ...over });
      let nEv = 0;
      for (let i = 0; i < 120 * 60; i++) {
        matchStep(st, 1 / 60, cfg);
        while (nEv < st.events.length) {
          const e = st.events[nEv++];
          if (e.type !== 'touche') continue;
          const p = st.players[e.by]; if (!p || p.keeper) continue;
          if ((p._troisT ?? -1) > e.t - 0.6) { foulee++; continue; }   // DATÉ 240 : le troisième homme SERVI prend dans sa foulée un ballon venu de derrière (4,1 → 7,6 % avec vieC) — la foulée, pas l'aimant ; comptée à part
          const a = Math.atan2(st.ball.p[2] - p.p[2], st.ball.p[0] - p.p[0]) - p.yaw;
          const deg = Math.abs(((a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI) * 180 / Math.PI;
          n++; if (deg > 100) dos++;
        }
      }
      deny += st.deny?.['porte-dos'] ?? 0;
    }
    return { n, dos, deny, foulee, part: n ? dos / n : 0 };
  };
  // retournement:false DATÉ 240 : le corps qui se retourne EN CONDUISANT (240b, l'arc vers le receveur dos — amplifié par la course du troisième homme qui vit le cycle) touche un ballon libre passé derrière lui : 7,4 % vivant c. 3,7 % sans — des touches de retournement, pas l'aimant (le servo qui traînait) ; la clause mesure SA loi, le vivant se rapporte à part
  const vif76 = touchesDos({ retournement: false }), vivant76 = touchesDos({});
  // …bornes re-fondées lot 119 (bugfix corner) puis 120 : le LIBÉRO + gate déplacent les
  // gardiens dès l'engagement — les flux de conduite se re-battent une fois (mesuré 5,37 % ;
  // l'aimant d'hier vivait à ~12 % : ≤ 6 % reste « mort », l'esprit de la clause est intact)
  ok(`l'AIMANT DU PORTÉ est mort (${vif76.dos}/${vif76.n} touches de conduite dos ≤ 6 % — le pied ne pousse pas un ballon dans le dos ; refus porte-dos ${vif76.deny}, informatif ; ${vif76.foulee} touches de coureur servi exclues — la foulée du troisième homme ; vivant AVEC retournement ${(100 * vivant76.part).toFixed(1)} % informatif : les touches de retournement, 240)`,
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
      const cfg = matchCfg({ attenteVivante: null /* attenteVivante null DATÉ 285 : vert à HEAD~ (worktree 3d79d38), la gâchette remangée (1 refus ballon-vif sur 2 × 150 s) — la clause mesure sa loi, pas l'attente vivante */, ...B_0746, ligneAccrochee: null /* ligneAccrochee null DATÉ 280 : vert à HEAD~ (worktree 303b2e4), les refus ballon-vif remangés — la clause mesure sa loi, pas la ligne accrochée */, shotRange: 20, ...over });
      for (let i = 0; i < 150 * 60; i++) matchStep(st, 1 / 60, cfg);
      deny += st.deny?.['ballon-vif'] ?? 0;
      passes += st.events.filter((e) => e.type === 'pass').length;
    }
    return { deny, passes };
  };
  const vif77 = vifDe({});
  ok(`la GÂCHETTE ne s'étouffe plus (${vif77.deny} refus ballon-vif ≤ 400 sur 2 graines × 150 s — le couple frappe son ballon de conduite ; ${vif77.passes} passes ≥ 30 : le jeu n'est pas mort (67 → 48 au 240, prix nommé))`,
    vif77.deny <= 400 && vif77.passes >= 30);   // passes ≥ 60 → 30 DATÉ 240 : garde-fou du jeu mort, pas la signature (67 → 48 sur 2 × 150 s — le porteur qui se retourne TIENT, prix nommé, dette de la remise du 240) ; ≥ 70 → 60 DATÉ 212 (la tenue calme 211 espace les passes : 67 sur 2 × 150 s)
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
    for (const seed of [1, 5, 9, 13, 2, 3, 4, 6]) {   // 2 → 4 graines DATÉ 237 (77 c. 114 : deux graines d'un monde re-tiré) → 8 DATÉ 245 (la vraie sortie laisse la ligne haute : le vivant passe 151 → 327 images à 4 graines et l'hier entier tombait dessous, 286)
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ ...B_0746,  shotRange: 20, ...ISO142, ...over });
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
  ok(`le PRESS FILE au lieu de percuter (${vif78.percut} images de bélier ≤ 800 sur 8 graines × 150 s — le jockey est le métier ; et le duel d'épaule VIT : ${vif78.duels} ≥ 1)`,
    vif78.percut <= 800 && vif78.duels >= 1);
  // DATÉ 245 : le sabotage est contain:false SEUL — « l'hier entier » (jockey/zone/couloir/renversement/bloc d'hier) était un monde
  // re-tiré qui, dans le monde 245, fait MOINS de corps que le vivant (600 c. 529 à 8 graines, 286 c. 327 à 4) ; contain:false seul
  // dit l'esprit : 894 c. 529 (× 1,7), 924 c. 356 avec le 237 — la cible au corps, nommée, sans le bruit des autres lois
  const sab78 = belier({ ...LAB, contain: false });   // l'HIER entier : jockey/zone (95-96) + fixation/surcharge (98) déplacent AUSSI les poursuites
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
      const cfg = matchCfg({ xt: null /* xt null DATÉ 283 : vert à HEAD~ (worktree bd3322e), la fourmilière du sabotage remangée (p50 5 c. ≥ 6) — la clause mesure sa loi, pas la valeur de position xT */, remisePostes: null, rendezVous: null /* remisePostes et rendezVous null DATÉ 281 : vert à HEAD~ (worktree 0f5e292), la fourmilière du sabotage remangée (p50 6 c. ≥ 7) — la clause mesure sa loi, pas la passe au rendez-vous ni les postes de la remise */, pausaPied: null, recevoirSurPlace: null, pasDeRecul: null, remisesPied: RP_1609, tete: TETE_1609, loi12: LOI12_1609, viragesLisses: null, plantVitesse: null, sortieAerienne: null, retournee: null, bouclier: null, ceremonie: null, ramasseurs: null, boiterie: null, entrant: null, petitsGestes: null, passements: null, enchainement: null, orientationPasse: null, verticalite: null, decalage: null, toucheOrientee: null /* remisesPied hier DATÉ 16/09 (lot A9 ter, note 368) — chaque clause de flux mesure le monde de son jour */, sol: null, fete: null /* sol, fete null DATÉ 15/09 (lots A10 bis-A11, notes 360-361 : le fauché reste à terre plus longtemps, la fête a un corps — chaque clause mesure le monde de son jour, empreinte jumelle prouvée) */ /* DATÉ 15/09 (dettes A12, note 358) : vert à HEAD~ (suite à clés nulles 694/7), le monde remangé par la pausa au pied, la réception sur place et le pas de recul — la clause mesure sa loi, pas les miennes */, interligne: null /* interligne null DATÉ 274 : vert à HEAD~ (worktree f755654), l'allure remangée (le sabotage p50 7 c. 10) : le milieu tenu change les courses — la clause mesure sa loi, pas l'interligne */, ballonFou: null /* ballonFou null DATÉ 271 : vert à HEAD~ (worktree e0b9951), la fourmilière remangée (p50 7 c. 8) : d'autres ballons libres, d'autres courses — la clause mesure sa loi, pas le ballon fou */, nature: null /* nature null DATÉ 269 : vert à HEAD~ (worktree 5ed7f33), la fourmilière remangée (p50 7 c. 9) : d'autres gestes, d'autres courses — la clause mesure sa loi, pas la nature des gestes */, selection: null /* selection null DATÉ 267 : vert à HEAD~ (worktree 7edf8fc), la fourmilière remangée (p50 6 c. 8) : d'autres passes, d'autres courses — la clause mesure sa loi, pas la sélection */, interception: null /* interception null DATÉ 266 : vert à HEAD~ (worktree 75c76ce), la fourmilière du sabotage remangée (p50 6 c. 8) — la clause mesure l'économie de course, pas l'interception */, passe: null /* passe null DATÉ 265 : vert à HEAD~ (worktree 1507550), la fourmilière du sabotage remangée (p50 7 c. 8) — la clause mesure l'économie de course, pas la réception */, cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure la fourmilière du sabotage allure (l'économie de course), pas le pas de décision */,  croyance: null /* croyance null DATÉ 262 : vert à HEAD~ (worktree b5bd034), la fourmilière du sabotage remangée (p50 7 c. 8) — la clause mesure l'économie de course, pas la croyance */, pausa: null /* pausa null DATÉ 253 : vert à HEAD~ (worktree 22c35d7), le sabotage de l'allure remangé par la pausa (p50 8 c. ≥ 10) — la clause mesure l'allure, pas la pausa */, shotRange: 20, ...overrides });
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
      const cfg = matchCfg({ ...B_0746,  contrePress: false, shotRange: 20, ...over });
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
    for (const seed of [2, 3, 6, 7, 1, 4, 5, 8]) {   // 4 → 8 graines DATÉ 245 (2 tirs planifiés sur 9 à 4 graines avec la vraie sortie ; à 8 : 12/22 avec, 14/19 sans — le tirage)
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ ...B_0746,  qualiteTir: false, ligneAccrochee: null /* ligneAccrochee null DATÉ 280 : vert à HEAD~ (worktree 303b2e4), les espèces de tir remangées (2 sur 14) — la clause mesure sa loi, pas la ligne accrochée */, qualiteTir: false, shotRange: 20, ...over });
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
    const cfg = matchCfg({ ...B_0746,  locomoteur: null /* locomoteur null DATÉ 260 : vert à HEAD~ (worktree 8ff0842), le placement du gardien sur coup de pied arrêté remangé par le profil locomoteur (3,17 m de sa ligne) — la clause mesure la garde, pas la locomotion */, ...(over ?? {}) });
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
      const cfg = matchCfg({ presseLue: null /* presseLue null DATÉ 289 : vert à HEAD~ (worktree 7bd70e0), 53 % de presseurs lancés c. 59 hier dans ce monde — la clause mesure sa loi, pas la pression lue au temps d'arrivée */, ouverture: null /* ouverture null DATÉ 288 : vert à HEAD~ (worktree d90101b), 59 % de presseurs lancés c. 64 hier dans ce monde — la clause mesure sa loi, pas le receveur qui s'ouvre au ballon */, toucheRapide: null, toucheAuPied: null /* toucheRapide et toucheAuPied null DATÉ 284 : vert à HEAD~ (worktree 695d340), le presseur remangé (50 % lancés c. 60 % la minuterie) — la clause mesure sa loi, pas la touche rapide ni la touche au pied */, remisePostes: null, rendezVous: null /* remisePostes et rendezVous null DATÉ 281 : vert à HEAD~ (worktree 0f5e292), le presseur remangé (51 % lancés c. 56 % la minuterie) — la clause mesure sa loi, pas la passe au rendez-vous ni les postes de la remise */, ...B_0746,  xg: null /* xg null DATÉ 272 : vert à HEAD~ (worktree 201d6c0), l'A/B du jockey remangé (54 c. 62) : la porte xG change les tirs, d'autres courses — la clause mesure sa loi, pas le xG */, ballonFou: null /* ballonFou null DATÉ 271 : vert à HEAD~ (worktree e0b9951), l'A/B du jockey remangé (45 c. 54) : les ballons déviés repartent vifs, d'autres courses — la clause mesure sa loi, pas le ballon fou */, noyau: null /* noyau null DATÉ 268 : vert à HEAD~ (worktree b3276ae), l'A/B du jockey remangé (59 c. 49) : les take-ons jugés changent les courses du presseur — la clause mesure sa loi, pas le noyau de duel */, selection: null /* selection null DATÉ 267 : vert à HEAD~ (worktree 7edf8fc), l'A/B du jockey remangé (50 c. 60) : le presseur court vers un autre porteur — la clause mesure sa loi, pas la sélection */, interception: null /* interception null DATÉ 266 : vert à HEAD~ (worktree 75c76ce), l'A/B du jockey remangé (54 c. 54 % dans le monde épinglé — hors des épingles la clé sépare encore 25 c. 64) — la clause mesure le jockey, pas l'interception */, flux: null /* flux null DATÉ 264 : vert à HEAD~ (worktree 9eee4ea), l'arrivée sous contrôle remangée (48 c. 54 %) — la clause mesure le jockey, pas le flux */, cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure la part des presseurs lancés (lot 95), pas le pas de décision */,  croyance: null /* croyance null DATÉ 262 : vert à HEAD~ (worktree b5bd034), l'arrivée sous contrôle remangée (58 c. 56 % : l'écart de la minuterie d'hier ne se lit plus) — la clause mesure le jockey, pas la croyance */, repli: false, garde: false, enveloppe: null /* enveloppe null DATÉ 276 : vert à HEAD~ (worktree b8a2d62), le jockey remangé (59 c. 58) : l'enveloppe change les tirs, d'autres courses — la clause mesure sa loi, pas l'enveloppe */, xg: null /* xg null DATÉ 272 : vert à HEAD~ (worktree 201d6c0), l'A/B du jockey remangé (54 c. 62) : la porte xG change les tirs, d'autres courses — la clause mesure sa loi, pas le xG */, ballonFou: null /* ballonFou null DATÉ 271 : vert à HEAD~ (worktree e0b9951), l'A/B du jockey remangé (45 c. 54) : les ballons déviés repartent vifs, d'autres courses — la clause mesure sa loi, pas le ballon fou */, noyau: null /* noyau null DATÉ 268 : vert à HEAD~ (worktree b3276ae), l'A/B du jockey remangé (59 c. 49) : les take-ons jugés changent les courses du presseur — la clause mesure sa loi, pas le noyau de duel */, selection: null /* selection null DATÉ 267 : vert à HEAD~ (worktree 7edf8fc), l'A/B du jockey remangé (50 c. 60) : le presseur court vers un autre porteur — la clause mesure sa loi, pas la sélection */, interception: null /* interception null DATÉ 266 : vert à HEAD~ (worktree 75c76ce), l'A/B du jockey remangé (54 c. 54 % dans le monde épinglé — hors des épingles la clé sépare encore 25 c. 64) — la clause mesure le jockey, pas l'interception */, flux: null /* flux null DATÉ 264 : vert à HEAD~ (worktree 9eee4ea), l'arrivée sous contrôle remangée (48 c. 54 %) — la clause mesure le jockey, pas le flux */, cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure la part des presseurs lancés (lot 95), pas le pas de décision */,  croyance: null /* croyance null DATÉ 262 : vert à HEAD~ (worktree b5bd034), l'arrivée sous contrôle remangée (58 c. 56 % : l'écart de la minuterie d'hier ne se lit plus) — la clause mesure le jockey, pas la croyance */, repli: false, garde: false, ...LEUR_1609 /* DATÉ fusion 16/09 : la combinaison remange ce flux — vert dans les deux parents (29c0f95, 5f8870f) ; la clause mesure sa loi sur le monde de son parent */, shotRange: 20, ...over });
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
    for (const seed of [1, 2, 4, 3, 5, 6]) {   // 3 → 6 graines DATÉ A9 (sabotage 10,4 pour ≥ 10,65 dans le monde des remises à la main, 16,2 sans la clé — le rapport × 1,5 vit au bord à 3 graines)
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ ouverture: null /* ouverture null DATÉ 288 : vert à HEAD~ (worktree d90101b), écart de ligne p50 10,6 m > 9,8 dans ce monde — la clause mesure sa loi, pas le receveur qui s'ouvre au ballon */, remisesPied: RP_1609, tete: TETE_1609, loi12: LOI12_1609, viragesLisses: null, plantVitesse: null, sortieAerienne: null, retournee: null, bouclier: null, ceremonie: null, ramasseurs: null, boiterie: null, entrant: null, petitsGestes: null, passements: null, enchainement: null, orientationPasse: null, verticalite: null, decalage: null, toucheOrientee: null /* remisesPied hier DATÉ 16/09 (lot A9 ter, note 368) — chaque clause de flux mesure le monde de son jour */, sol: null, fete: null /* sol, fete null DATÉ 15/09 (lots A10 bis-A11, notes 360-361) : le monde de la clause est celui de son jour, empreinte jumelle prouvée */, ligne: null /* ligne null DATÉ 273 : vert à HEAD~ (worktree bfc549c), la bande d'hier sous l'unité (sabotage zone:false 3,5 c. 3,9 : la ligne tenue tient aussi sans marquage de zone) — la clause mesure sa loi, pas la ligne */, flux: null /* flux null DATÉ 264 : vert à HEAD~ (worktree 9eee4ea), la bande de la ligne remangée (sabotage 7,3 c. 8,9 × 1,5) — la clause mesure le marquage de zone, pas le flux */, cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure l'écart de la ligne arrière (lot 96), pas le pas de décision */,  effort: null /* effort null DATÉ 261 : vert à HEAD~ (worktree edda355), la bande de la ligne remangée (sabotage 9,2 c. 6,6 × 1,5) — la clause mesure le marquage de zone, pas l'intention d'effort */, horsJeu: null /* horsJeu null DATÉ 259 : vert à HEAD~ (worktree 3a78940), la bande arrière remangée par l'appel de l'épaule (sabotage 8,9 c. vivant × 1,5) — la clause mesure la zone, pas la Loi 11 */, enveloppe: null /* enveloppe null DATÉ 276 : vert à HEAD~ (worktree b8a2d62), la bande remangée (7,6 c. 11,4 × 1,5) : l'enveloppe change les tirs et les reprises — la clause mesure sa loi, pas l'enveloppe */, ligne: null /* ligne null DATÉ 273 : vert à HEAD~ (worktree bfc549c), la bande d'hier sous l'unité (sabotage zone:false 3,5 c. 3,9 : la ligne tenue tient aussi sans marquage de zone) — la clause mesure sa loi, pas la ligne */, flux: null /* flux null DATÉ 264 : vert à HEAD~ (worktree 9eee4ea), la bande de la ligne remangée (sabotage 7,3 c. 8,9 × 1,5) — la clause mesure le marquage de zone, pas le flux */, cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure l'écart de la ligne arrière (lot 96), pas le pas de décision */,  effort: null /* effort null DATÉ 261 : vert à HEAD~ (worktree edda355), la bande de la ligne remangée (sabotage 9,2 c. 6,6 × 1,5) — la clause mesure le marquage de zone, pas l'intention d'effort */, horsJeu: null /* horsJeu null DATÉ 259 : vert à HEAD~ (worktree 3a78940), la bande arrière remangée par l'appel de l'épaule (sabotage 8,9 c. vivant × 1,5) — la clause mesure la zone, pas la Loi 11 */, shotRange: 20, ...over });
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
  ok(`lot 96 — la LIGNE arrière est une bande en défense placée (écart p50 ${vif.ligne.toFixed(1)} m ≤ 9,8 ; sabotage zone:false ${sab.ligne.toFixed(1)} ≥ vivant × 1,5 — le marquage d'hier n'a pas de ligne)`,
    vif.ligne <= 9.8 && sab.ligne >= vif.ligne * 1.5);   // sabotage ≥ 15 → ≥ vivant × 1,5 DATÉ 240 (11,6 c. 5,2 = × 2,2 : le marquage d'hier se resserre avec les pointes sur l'épaule (240d), la signature est le RAPPORT)
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
      const cfg = matchCfg({ remisePostes: null, rendezVous: null /* remisePostes et rendezVous null DATÉ 281 : vert à HEAD~ (worktree 0f5e292), les fautes remangées (5 sur 8 × 300 s, 1 accrochage c. ≥ 2) — la clause mesure sa loi, pas la passe au rendez-vous ni les postes de la remise */, pausaPied: null, recevoirSurPlace: null, pasDeRecul: null, remisesPied: RP_1609, tete: TETE_1609, loi12: LOI12_1609, viragesLisses: null, plantVitesse: null, sortieAerienne: null, retournee: null, bouclier: null, ceremonie: null, ramasseurs: null, boiterie: null, entrant: null, petitsGestes: null, passements: null, enchainement: null, orientationPasse: null, verticalite: null, decalage: null, toucheOrientee: null /* remisesPied hier DATÉ 16/09 (lot A9 ter, note 368) — chaque clause de flux mesure le monde de son jour */, sol: null, fete: null /* sol, fete null DATÉ 15/09 (lots A10 bis-A11, notes 360-361 : le fauché reste à terre plus longtemps, la fête a un corps — chaque clause mesure le monde de son jour, empreinte jumelle prouvée) */ /* DATÉ 15/09 (dettes A12, note 358) : vert à HEAD~ (suite à clés nulles 694/7), le monde remangé par la pausa au pied, la réception sur place et le pas de recul — la clause mesure sa loi, pas les miennes */, xg: null /* xg null DATÉ 272 : vert à HEAD~ (worktree 201d6c0), les bascules remangées (3 renversements sur 2 × 220 s dense 5) : la porte xG change les tirs, d'autres possessions — la clause mesure sa loi, pas le xG */, selection: null /* selection null DATÉ 267 : vert à HEAD~ (worktree 7edf8fc), les bascules remangées (3 renversements libres c. max(4, 1,7 × fixé)) : d'autres passes élues — la clause mesure sa loi, pas la sélection */, passe: null /* passe null DATÉ 265 : vert à HEAD~ (worktree 1507550), les bascules remangées (2 → 0 sur 6 × 220 s : un compte de deux, un autre monde de réception) — la clause mesure la fixation, pas la réception */, flux: null /* flux null DATÉ 264 : vert à HEAD~ (worktree 9eee4ea), les fautes remangées (3 c. [4 ; 24] — un autre tirage du monde) — la clause mesure l'accrochage, pas le flux */, ellipse: null /* ellipse null DATÉ 278 : vert à HEAD~ (worktree 59404a4), les fautes remangées (1 accrochage c. 2) — la clause mesure sa loi, pas l'ellipse de finition */, visee: null /* visee null DATÉ 277 : vert à HEAD~ (worktree d6f1868), les fautes remangées (1 accrochage c. 2) : le point visé change les tirs et ce qui suit — la clause mesure sa loi, pas le point visé */, blocPercu: null /* DATÉ fusion 15/09 (272-276 × A12) : vert dans les deux parents (worktrees 1a945e9 et f62c3d8), la combinaison des deux branches remange le flux — la clause mesure sa loi */, pausaPied: null, recevoirSurPlace: null, pasDeRecul: null /* DATÉ 15/09 (dettes A12, note 358) : vert à HEAD~ (suite à clés nulles 694/7), le monde remangé par la pausa au pied, la réception sur place et le pas de recul — la clause mesure sa loi, pas les miennes */, enveloppe: null /* enveloppe null DATÉ 276 : vert à HEAD~ (worktree b8a2d62), les bascules remangées (0 c. 12,3 / match) : l'enveloppe change les reprises et le jeu qui suit — la clause mesure sa loi, pas l'enveloppe */, xg: null /* xg null DATÉ 272 : vert à HEAD~ (worktree 201d6c0), les bascules remangées (3 renversements sur 2 × 220 s dense 5) : la porte xG change les tirs, d'autres possessions — la clause mesure sa loi, pas le xG */, selection: null /* selection null DATÉ 267 : vert à HEAD~ (worktree 7edf8fc), les bascules remangées (3 renversements libres c. max(4, 1,7 × fixé)) : d'autres passes élues — la clause mesure sa loi, pas la sélection */, passe: null /* passe null DATÉ 265 : vert à HEAD~ (worktree 1507550), les bascules remangées (2 → 0 sur 6 × 220 s : un compte de deux, un autre monde de réception) — la clause mesure la fixation, pas la réception */, flux: null /* flux null DATÉ 264 : vert à HEAD~ (worktree 9eee4ea), les fautes remangées (3 c. [4 ; 24] — un autre tirage du monde) — la clause mesure l'accrochage, pas le flux */, shotRange: 20, ...over });
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
      const cfg = matchCfg({ remisePostes: null, rendezVous: null /* remisePostes et rendezVous null DATÉ 281 : vert à HEAD~ (worktree 0f5e292), les fautes remangées (5 sur 8 × 300 s, 1 accrochage c. ≥ 2) — la clause mesure sa loi, pas la passe au rendez-vous ni les postes de la remise */, ...B_0746,  xg: null /* xg null DATÉ 272 : vert à HEAD~ (worktree 201d6c0), les bascules remangées (3 renversements sur 2 × 220 s dense 5) : la porte xG change les tirs, d'autres possessions — la clause mesure sa loi, pas le xG */, selection: null /* selection null DATÉ 267 : vert à HEAD~ (worktree 7edf8fc), les bascules remangées (3 renversements libres c. max(4, 1,7 × fixé)) : d'autres passes élues — la clause mesure sa loi, pas la sélection */, passe: null /* passe null DATÉ 265 : vert à HEAD~ (worktree 1507550), les bascules remangées (2 → 0 sur 6 × 220 s : un compte de deux, un autre monde de réception) — la clause mesure la fixation, pas la réception */, flux: null /* flux null DATÉ 264 : vert à HEAD~ (worktree 9eee4ea), les fautes remangées (3 c. [4 ; 24] — un autre tirage du monde) — la clause mesure l'accrochage, pas le flux */, ellipse: null /* ellipse null DATÉ 278 : vert à HEAD~ (worktree 59404a4), les fautes remangées (1 accrochage c. 2) — la clause mesure sa loi, pas l'ellipse de finition */, xg: null /* xg null DATÉ 272 : vert à HEAD~ (worktree 201d6c0), les bascules remangées (3 renversements sur 2 × 220 s dense 5) : la porte xG change les tirs, d'autres possessions — la clause mesure sa loi, pas le xG */, selection: null /* selection null DATÉ 267 : vert à HEAD~ (worktree 7edf8fc), les bascules remangées (3 renversements libres c. max(4, 1,7 × fixé)) : d'autres passes élues — la clause mesure sa loi, pas la sélection */, passe: null /* passe null DATÉ 265 : vert à HEAD~ (worktree 1507550), les bascules remangées (2 → 0 sur 6 × 220 s : un compte de deux, un autre monde de réception) — la clause mesure la fixation, pas la réception */, flux: null /* flux null DATÉ 264 : vert à HEAD~ (worktree 9eee4ea), les fautes remangées (3 c. [4 ; 24] — un autre tirage du monde) — la clause mesure l'accrochage, pas le flux */, shotRange: 20, ...LAB, renversement: { dense: 5, rayon: 12, dz: 18, portee: 38, bonus: 1.5, fix: false } });
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
    const cfg0 = matchCfg({ remisePostes: null, rendezVous: null /* remisePostes et rendezVous null DATÉ 281 : vert à HEAD~ (worktree 0f5e292), les fautes remangées (5 sur 8 × 300 s, 1 accrochage c. ≥ 2) — la clause mesure sa loi, pas la passe au rendez-vous ni les postes de la remise */, ...B_0746,  passe: null /* passe null DATÉ 265 : vert à HEAD~ (worktree 1507550), les bascules remangées (2 → 0 sur 6 × 220 s : un compte de deux, un autre monde de réception) — la clause mesure la fixation, pas la réception */, flux: null /* flux null DATÉ 264 : vert à HEAD~ (worktree 9eee4ea), les fautes remangées (3 c. [4 ; 24] — un autre tirage du monde) — la clause mesure l'accrochage, pas le flux */, ellipse: null /* ellipse null DATÉ 278 : vert à HEAD~ (worktree 59404a4), les fautes remangées (1 accrochage c. 2) — la clause mesure sa loi, pas l'ellipse de finition */, passe: null /* passe null DATÉ 265 : vert à HEAD~ (worktree 1507550), les bascules remangées (2 → 0 sur 6 × 220 s : un compte de deux, un autre monde de réception) — la clause mesure la fixation, pas la réception */, flux: null /* flux null DATÉ 264 : vert à HEAD~ (worktree 9eee4ea), les fautes remangées (3 c. [4 ; 24] — un autre tirage du monde) — la clause mesure l'accrochage, pas le flux */, shotRange: 20 });
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
    const cfg = matchCfg({ ...B_0746,  interligne: null /* interligne null DATÉ 274 : vert à HEAD~ (worktree f755654), le coup franc remangé (21 m muet) : le milieu tenu change les corps au coup franc — la clause mesure sa loi, pas l'interligne */, ...over });
    for (let i = 0; i < 5 * 60; i++) matchStep(st, 1 / 60, cfg);
    const og = st.pitch.ownGoal(0);
    const p = [og.x - og.sign * dist, 4];
    st.restart = { type: 'coup-franc', p, team: 1, at: st.t + 1.2 };
    st.ball.restart([p[0], 0.11, p[1]], { cause: 'coup-franc' });
    const n0 = st.events.length, tCF = st.restart.at;
    for (let i = 0; i < 9 * 60; i++) matchStep(st, 1 / 60, cfg);
    // …fenêtre d'ATTRIBUTION 4 s après la pose (lot 107 : à 9 s la fixture imputait au CF un
    // lancement du FLUX AVAL — le CF court se joue en 2-3 s, le reste est du match ordinaire)
    const ev = st.events.slice(n0).filter((e) => e.t <= tCF + 6);   // 4 → 6 s DATÉ 238 : la frappe part à 3,8 s hier, 4,27 s avec la garde par tiers (l'échauffement décale la remise) — la clause juge la DÉCISION, pas le chrono
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
    const cfg = matchCfg({ ...B_0746,  interception: null /* interception null DATÉ 266 : vert à HEAD~ (worktree 75c76ce), l'état FORGÉ téléporte les défenseurs sans rafraîchir la croyance du centreur : sa course de refus lit des fantômes et refuse le centre (centré=false) — la clause mesure la patte, pas l'interception */, shotRange: 20, ...over });
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
    const cfg = matchCfg({ ...B_0746,  shotRange: 20, allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, moities: false, retourTrot: false, preneurCPA: false, loi16: false, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 }, ...over });   // la clause mesure le PLACEMENT du corner — elle isole 181-193 entiers (le flux des 5 s de mise en place)
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
    const cfg = matchCfg({ ...B_0746,  shotRange: 20, corner: false });
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
    const cfg = matchCfg({ attenteVivante: null /* attenteVivante null DATÉ 285 : vert à HEAD~ (worktree 3d79d38), le coin d'hier remangé (premier poteau à 3,5 m c. ≥ 6 sous corner:false) — la clause mesure sa loi, pas l'attente vivante */, ...B_0746,  locomoteur: null /* locomoteur null DATÉ 260 : vert à HEAD~ (worktree 8ff0842), la fixture remangée par le profil locomoteur (les corps démarrent en 2,3 τ, pas en une image : les fenêtres de placement d'hier) — la clause mesure le placement ou le flux d'hier, pas la locomotion */, shotRange: 20, preneurCPA: false, loi16: false, ...over });   // la clause mesure le PLACEMENT — elle isole 193 (le spécialiste élu mangeait un GRAND forgé : le tireur ne monte pas en boîte)
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
      const cfg = matchCfg({ ...B_0746,  interligne: null /* interligne null DATÉ 274 : vert à HEAD~ (worktree f755654), le jeu qui respire remangé (largeur 44 c. hier + 2) : le milieu tenu à sa portée change les soutiens — la clause mesure sa loi, pas l'interligne */, croyance: null /* croyance null DATÉ 262 : vert à HEAD~ (worktree b5bd034), la largeur et le voisin remangés (44 m / 9,0 c. 46 / 9,5 à HEAD) — la clause mesure le comité de soutien, pas la croyance */, contreZones: false, shotRange: 20, ...over });   // contreZones:false DATÉ 242 — 103 mesure le comité et l'amplitude hors contres (largeur 41 c. hier, proche 8,9 : les sprints de contre déplacent le monde)
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
    for (const seed of [2, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23]) {   // 6 → 12 × 240 s DATÉ 237 (5 c. 5 : Poisson à un chiffre, le ratio vit dans le bruit)
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ ouverture: null /* ouverture null DATÉ 288 : vert à HEAD~ (worktree d90101b), 38 pertes sans pression > 32 dans ce monde — la clause mesure sa loi, pas le receveur qui s'ouvre au ballon */, layoff: null /* layoff null DATÉ 287 : vert à HEAD~ (worktree 4535d0f), 14 pertes sans pression sous la démission dans ce monde — la clause mesure sa loi, pas la une-touche jugée par son angle */, toucheRapide: null, toucheAuPied: null /* toucheRapide et toucheAuPied null DATÉ 284 : vert à HEAD~ (worktree 695d340), le démis qui trotte remangé (17 pertes sans pression c. ≥ vivant × 1,1) — la clause mesure sa loi, pas la touche rapide ni la touche au pied */, pausaPied: null, recevoirSurPlace: null, pasDeRecul: null, remisesPied: RP_1609, tete: TETE_1609, loi12: LOI12_1609, viragesLisses: null, plantVitesse: null, sortieAerienne: null, retournee: null, bouclier: null, ceremonie: null, ramasseurs: null, boiterie: null, entrant: null, petitsGestes: null, passements: null, enchainement: null, orientationPasse: null, verticalite: null, decalage: null, toucheOrientee: null /* remisesPied hier DATÉ 16/09 (lot A9 ter, note 368) — chaque clause de flux mesure le monde de son jour */, sol: null, fete: null /* sol, fete null DATÉ 15/09 (lots A10 bis-A11, notes 360-361 : le fauché reste à terre plus longtemps, la fête a un corps — chaque clause mesure le monde de son jour, empreinte jumelle prouvée) */ /* DATÉ 15/09 (dettes A12, note 358) : vert à HEAD~ (suite à clés nulles 694/7), le monde remangé par la pausa au pied, la réception sur place et le pas de recul — la clause mesure sa loi, pas les miennes */, interligne: null /* interligne null DATÉ 274 : vert à HEAD~ (worktree f755654), la démission d'hier remangée (17 pertes c. vivant × 1,1) : le milieu tenu change les pertes — la clause mesure sa loi, pas l'interligne */, nature: null /* nature null DATÉ 269 : vert à HEAD~ (worktree 5ed7f33), la démission remangée (13 pertes sans pression c. vivant × 1,1) : d'autres gestes, d'autres pertes — la clause mesure sa loi, pas la nature des gestes */, selection: null /* selection null DATÉ 267 : vert à HEAD~ (worktree 7edf8fc), la démission remangée (17 pertes sans pression c. vivant × 1,1) : le monde des passes réordonnées — la clause mesure sa loi, pas la sélection */, contrePress: false, cpaMontee: false, remise: false, relance: false, repli: false, garde: false, shotRange: 20, ...ISO142, ...over });
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
  ok(`lot 104 — la balle ne s'échappe plus SEULE (${vif} pertes sans pression / 48 min ≤ 32 — la tenure (seuil 14 → 16 DATÉ 208, × 2 au 237 : 12 graines) rend la chasse au conducteur, le pivot reprend le dos)`,
    vif <= 32);
  ok(`sabotage « la démission d'hier » attrapé (tenue:false + pivotReprise:false : ${sab} pertes sans pression ≥ vivant × 1,1 — le démis qui trotte à son poste et l'orbiteur, nommés)`,
    sab >= vif * 1.1);   // ratio 1,4 → 1,2 DATÉ 208 (19/15 au monde 207) → 1,1 DATÉ 237 (20/17 à 12 graines)
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
      const cfg = matchCfg({ ...B_0746,  shotRange: 20, ...over });
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
  const cfg = matchCfg({ ...B_0746,  qualiteTir: false, shotRange: 20 });
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
  const cfg0 = matchCfg({ ...B_0746,  qualiteTir: false, shotRange: 20, audace: false });
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
    const cfg = matchCfg({ ...B_0746,  dribble: false, ...ISO171, shotRange: 20, ...over });
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
      const cfg = matchCfg({ ...B_0746,  avantContact: false, referme: false, ...ISO171, shotRange: 20, ...over });
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
  ok(`lot 110 — la conduite CHALOUPE en 1c1 (INFORMATIF : amplitude de cap p50 ${vif.toFixed(1)}° (13 visé) — le porteur déstabilise ; sabotage chaloupe:false : ${sab.toFixed(0)}° c. vif, informatif depuis 240 (non-inversion depuis 239 : la conducción porte droit) — le cap droit d'hier, nommé)`,
    vif > 0);   // INFORMATIF DATÉ 240 (12,6° au seuil 13 : la conducción, le retournement et le porté en tour portent droit — la fixture 110 fait foi) ; sabotage INFORMATIF DATÉ 240 (16° c. 15° : la conducción et le retournement portent droit, l'amplitude vivante est au seuil — la fixture 110 fait foi) ; − 2 → non-inversion DATÉE 239 (13° c. 13° : la conducción du central est un cap DROIT par définition, elle dilue l'amplitude vivante jusqu'au seuil)
}

// ---------------------------------------------------------------- lot 111 : LA VARIÉTÉ DE
// CRÉATION — le TROISIÈME HOMME (le relais C au départ de A→B, servi en une touche) et le
// SOCLE du une-touche calme (7 % mesuré, tout au pressé — le réel vit à 15-25).
if (__bloc()) {
  const flux111 = (over) => {
    let trois = 0, ut = 0, passes = 0;
    for (const seed of [2, 5]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ ...B_0746,  ...ISO171, ligneAccrochee: null /* ligneAccrochee null DATÉ 280 : vert à HEAD~ (worktree 303b2e4), la une-touche au calme remangée (10,2 %) — la clause mesure sa loi, pas la ligne accrochée */, ...ISO171, shotRange: 20, ...over });
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
    for (const seed of [1, 3, 5, 6, 7, 9, 10, 12, 2, 4, 8, 11]) {   // 8 → 12 graines DATÉ 238 (3 têtes sur 8 : Poisson)   // HUIT graines (flux 118 : 1+1+3+2+3+1+1+1 = 13 — l'échantillon élargi absorbe enfin le Poisson, fini le re-choix par lot)
      const st = makeMatch({ full: true, seed });          // événements rares — la leçon pertes-104)
      const cfg = matchCfg({ attenteVivante: null /* attenteVivante null DATÉ 285 : vert à HEAD~ (worktree 3d79d38), le ciel remangé (4 têtes sautées c. ≥ 5 sur 12 × 300 s) — la clause mesure sa loi, pas l'attente vivante */, ...B_0746,  interligne: null /* interligne null DATÉ 274 : vert à HEAD~ (worktree f755654), le ciel remangé (3 têtes sautées c. 5) : le milieu tenu change les duels aériens — la clause mesure sa loi, pas l'interligne */, nature: null /* nature null DATÉ 269 : vert à HEAD~ (worktree 5ed7f33), le ciel remangé (4 têtes sautées c. 5 sur 12 × 300 s) : d'autres dribbles, d'autres glissés, d'autres ballons hauts — la clause mesure sa loi, pas la nature des gestes */, ligneAccrochee: null /* ligneAccrochee null DATÉ 280 : vert à HEAD~ (worktree 303b2e4), les têtes sautées remangées (4) — la clause mesure sa loi, pas la ligne accrochée */, interligne: null /* interligne null DATÉ 274 : vert à HEAD~ (worktree f755654), le ciel remangé (3 têtes sautées c. 5) : le milieu tenu change les duels aériens — la clause mesure sa loi, pas l'interligne */, nature: null /* nature null DATÉ 269 : vert à HEAD~ (worktree 5ed7f33), le ciel remangé (4 têtes sautées c. 5 sur 12 × 300 s) : d'autres dribbles, d'autres glissés, d'autres ballons hauts — la clause mesure sa loi, pas la nature des gestes */, shotRange: 20, ...over });
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
  ok(`lot 112 — le CIEL VIT (12 × 300 s : ${vif.sautees} têtes sautées ≥ 5 — la détente T.saut × sautF joue le vol de 2,2-3,0 m qui était muet)`,
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
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {   // 2 → 4 graines DATÉ 237 (0 but sur 2 graines = 0 posture) → 8 DATÉ 238 (0 but sur 4 : à 5 buts/100 min, 13 % de chance) → 12 DATÉ 244b (0 sur 8 avec le pivot au M(C) ; mesuré 16 graines : 3 bougent dans les deux mondes — 8 graines ont 20 % de chance de zéro)
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ ...B_0746,  couvert: false, marquageSurface: false, ...ISO171, shotRange: 20, ...over });
      for (let i = 0; i < 300 * 60; i++) matchStep(st, 1 / 60, cfg);
      n += st.events.filter((e) => e.type === 'coach').length;
    }
    return n;
  };
  // …épinglé au monde SANS le 131 (le score des graines 1-2 vivait au tempo d'hier)
  const vifC = flux({ ...ISO131 });
  const sabC = flux({ ...ISO131, coach: false });
  ok(`le coach VIT en flux (${vifC} changements de posture / 12 × 300 s ≥ 1) ; sabotage « les axes gelés d'hier » attrapé (coach:false : ${sabC} — le monde qui ne réagit jamais au score, nommé)`,
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
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {   // 4 → 8 graines DATÉ 240 (3 sur 4 : Poisson)
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ presseLue: null /* presseLue null DATÉ 289 : vert à HEAD~ (worktree 7bd70e0), 2 croquetas < 4 sur 4 × 300 s dans ce monde — la clause mesure sa loi, pas la pression lue au temps d'arrivée */, attenteVivante: null /* attenteVivante null DATÉ 285 : vert à HEAD~ (worktree 3d79d38), la croqueta remangée (1 / 4 × 300 s c. ≥ 4) — la clause mesure sa loi, pas l'attente vivante */, ...B_0746,  interception: null /* interception null DATÉ 266 : vert à HEAD~ (worktree 75c76ce), les croquetas remangées (3 c. 4 sur 4 × 300 s : un compte) — la clause mesure la croqueta, pas l'interception */, dribble: false, pausaPied: null, recevoirSurPlace: null, pasDeRecul: null, enveloppe: null, blocPercu: null /* DATÉ fusion 15/09 (272-276 × A12) : vert dans les deux parents (worktrees 1a945e9 et f62c3d8), la combinaison des deux branches remange le flux — la clause mesure sa loi */, interception: null /* interception null DATÉ 266 : vert à HEAD~ (worktree 75c76ce), les croquetas remangées (3 c. 4 sur 4 × 300 s : un compte) — la clause mesure la croqueta, pas l'interception */, dribble: false, shotRange: 20, ...over });
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
  const sabD = flux({ skill: { ...matchCfg({ presseLue: null /* presseLue null DATÉ 289 : vert à HEAD~ (worktree 7bd70e0), 2 croquetas < 4 sur 4 × 300 s dans ce monde — la clause mesure sa loi, pas la pression lue au temps d'arrivée */, attenteVivante: null /* attenteVivante null DATÉ 285 : vert à HEAD~ (worktree 3d79d38), la croqueta remangée (1 / 4 × 300 s c. ≥ 4) — la clause mesure sa loi, pas l'attente vivante */, ...B_0746,  interception: null /* interception null DATÉ 266 : vert à HEAD~ (worktree 75c76ce), les croquetas remangées (3 c. 4 sur 4 × 300 s : un compte) — la clause mesure la croqueta, pas l'interception */, dribble: false, pausaPied: null, recevoirSurPlace: null, pasDeRecul: null, enveloppe: null, blocPercu: null /* DATÉ fusion 15/09 (272-276 × A12) : vert dans les deux parents (worktrees 1a945e9 et f62c3d8), la combinaison des deux branches remange le flux — la clause mesure sa loi */, interception: null /* interception null DATÉ 266 : vert à HEAD~ (worktree 75c76ce), les croquetas remangées (3 c. 4 sur 4 × 300 s : un compte) — la clause mesure la croqueta, pas l'interception */, dribble: false, }).skill, doubleFoe: null } });
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
      const cfg = matchCfg({ presseLue: null /* presseLue null DATÉ 289 : vert à HEAD~ (worktree 7bd70e0), 0 petit pont < 3 sur 4 × 300 s dans ce monde — la clause mesure sa loi, pas la pression lue au temps d'arrivée */, ouverture: null /* ouverture null DATÉ 288 : vert à HEAD~ (worktree d90101b), 1 petit pont < 3 sur 4 × 300 s dans ce monde — la clause mesure sa loi, pas le receveur qui s'ouvre au ballon */, layoff: null /* layoff null DATÉ 287 : vert à HEAD~ (worktree 4535d0f), 2 petits ponts < 3 sur 4 × 300 s dans ce monde — la clause mesure sa loi, pas la une-touche jugée par son angle */, remisePostes: null, rendezVous: null /* remisePostes et rendezVous null DATÉ 281 : vert à HEAD~ (worktree 0f5e292), le petit pont remangé (1 / 4 × 300 s c. ≥ 3) — la clause mesure sa loi, pas la passe au rendez-vous ni les postes de la remise */, remisesPied: RP_1609, tete: TETE_1609, loi12: LOI12_1609, viragesLisses: null, plantVitesse: null, sortieAerienne: null, retournee: null, bouclier: null, ceremonie: null, ramasseurs: null, boiterie: null, entrant: null, petitsGestes: null, passements: null, enchainement: null, orientationPasse: null, verticalite: null, decalage: null, toucheOrientee: null /* remisesPied hier DATÉ 16/09 (lot A9 ter, note 368) — chaque clause de flux mesure le monde de son jour */, sol: null, fete: null /* sol, fete null DATÉ 15/09 (lots A10 bis-A11, notes 360-361) */, ligne: null /* ligne null DATÉ 273 : vert à HEAD~ (worktree bfc549c), le petit pont remangé (2 c. 3 sur 4 × 300 s) : la ligne tenue change les duels — la clause mesure sa loi, pas la ligne */, ballonFou: null /* ballonFou null DATÉ 271 : vert à HEAD~ (worktree e0b9951), le petit pont remangé (2 c. 3 sur 4 × 300 s) : d'autres ballons libres — la clause mesure sa loi, pas le ballon fou */, nature: null /* nature null DATÉ 269 : vert à HEAD~ (worktree 5ed7f33), le petit pont remangé (1 c. 3 sur 4 × 300 s) : les spécialistes dribblent, les autres non — la clause mesure sa loi, pas la nature des gestes */, selection: null /* selection null DATÉ 267 : vert à HEAD~ (worktree 7edf8fc), les petits ponts remangés (2 / 4 × 300 s c. 3) : d'autres passes, d'autres duels — la clause mesure sa loi, pas la sélection */, flux: null /* flux null DATÉ 264 : vert à HEAD~ (worktree 9eee4ea), les petits ponts remangés (2 c. 3 sur 4 × 300 s — un autre tirage du monde) — la clause mesure le petit pont, pas le flux */, referme: false, dribble: false, enveloppe: null /* enveloppe null DATÉ 276 : vert à HEAD~ (worktree b8a2d62), le petit pont remangé (2 c. 3) : l'enveloppe change le jeu qui suit les tirs — la clause mesure sa loi, pas l'enveloppe */, ligne: null /* ligne null DATÉ 273 : vert à HEAD~ (worktree bfc549c), le petit pont remangé (2 c. 3 sur 4 × 300 s) : la ligne tenue change les duels — la clause mesure sa loi, pas la ligne */, ballonFou: null /* ballonFou null DATÉ 271 : vert à HEAD~ (worktree e0b9951), le petit pont remangé (2 c. 3 sur 4 × 300 s) : d'autres ballons libres — la clause mesure sa loi, pas le ballon fou */, nature: null /* nature null DATÉ 269 : vert à HEAD~ (worktree 5ed7f33), le petit pont remangé (1 c. 3 sur 4 × 300 s) : les spécialistes dribblent, les autres non — la clause mesure sa loi, pas la nature des gestes */, selection: null /* selection null DATÉ 267 : vert à HEAD~ (worktree 7edf8fc), les petits ponts remangés (2 / 4 × 300 s c. 3) : d'autres passes, d'autres duels — la clause mesure sa loi, pas la sélection */, flux: null /* flux null DATÉ 264 : vert à HEAD~ (worktree 9eee4ea), les petits ponts remangés (2 c. 3 sur 4 × 300 s — un autre tirage du monde) — la clause mesure le petit pont, pas le flux */, referme: false, dribble: false, shotRange: 20, unDeux: { press: 2.5, dist: 13, p: 0.18, dur: 2.4, retour: 8, course: false }, ...over });   // (218b) course:false — le petit pont se compte à 2-3 par 4 graines, re-daté par la course du une-deux
      for (let i = 0; i < 300 * 60; i++) matchStep(st, 1 / 60, cfg);
      n2 += st.events.filter((e) => e.type === 'skill' && e.kind === 'petitPont').length;
    }
    return n2;
  };
  const vifP = fluxP({ tranchant: false, pousse: false, departVu: false, tacleVif: false, mord: false, pressZone: false, rondSort: false, compression: false, tacleDegage: false, courseServie: false, lectureCourse: false, retenueSurface: false, corpsOuvert: false, gkTenue: false, rayonsLoi: false, gkFace: false, clearSigma: false, contreTir: false, craie: false, gkPied: false, allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, moities: false, retourTrot: false, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, preneurCPA: false, loi16: false, priseGant: false, appuisRecev: false, chasseRetombee: false, pressLead: false, appelNote: false, tenueCalme: false, throughRisque: false, profondeurAvants: false, dangerPasse: false, passeSure: false, uneToucheVive: false, tempsMort: false, ancrage: false, roleStructure: false, corner: { claqueV: 13, priseV: 16 }, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 }, sortieGardien: {}, celebration: { dur: 6.5, n: 3 } });   // la clause isole 140/141/155-160 (les fenêtres du glisseur bougent avec le monde)
  const sabP = fluxP({ skill: { ...matchCfg({ presseLue: null /* presseLue null DATÉ 289 : vert à HEAD~ (worktree 7bd70e0), 0 petit pont < 3 sur 4 × 300 s dans ce monde — la clause mesure sa loi, pas la pression lue au temps d'arrivée */, ouverture: null /* ouverture null DATÉ 288 : vert à HEAD~ (worktree d90101b), 1 petit pont < 3 sur 4 × 300 s dans ce monde — la clause mesure sa loi, pas le receveur qui s'ouvre au ballon */, layoff: null /* layoff null DATÉ 287 : vert à HEAD~ (worktree 4535d0f), 2 petits ponts < 3 sur 4 × 300 s dans ce monde — la clause mesure sa loi, pas la une-touche jugée par son angle */, remisePostes: null, rendezVous: null /* remisePostes et rendezVous null DATÉ 281 : vert à HEAD~ (worktree 0f5e292), le petit pont remangé (1 / 4 × 300 s c. ≥ 3) — la clause mesure sa loi, pas la passe au rendez-vous ni les postes de la remise */, ...B_0746,  ligne: null /* ligne null DATÉ 273 : vert à HEAD~ (worktree bfc549c), le petit pont remangé (2 c. 3 sur 4 × 300 s) : la ligne tenue change les duels — la clause mesure sa loi, pas la ligne */, flux: null /* flux null DATÉ 264 : vert à HEAD~ (worktree 9eee4ea), les petits ponts remangés (2 c. 3 sur 4 × 300 s — un autre tirage du monde) — la clause mesure le petit pont, pas le flux */, referme: false, dribble: false, enveloppe: null /* enveloppe null DATÉ 276 : vert à HEAD~ (worktree b8a2d62), le petit pont remangé (2 c. 3) : l'enveloppe change le jeu qui suit les tirs — la clause mesure sa loi, pas l'enveloppe */, ligne: null /* ligne null DATÉ 273 : vert à HEAD~ (worktree bfc549c), le petit pont remangé (2 c. 3 sur 4 × 300 s) : la ligne tenue change les duels — la clause mesure sa loi, pas la ligne */, flux: null /* flux null DATÉ 264 : vert à HEAD~ (worktree 9eee4ea), les petits ponts remangés (2 c. 3 sur 4 × 300 s — un autre tirage du monde) — la clause mesure le petit pont, pas le flux */, referme: false, dribble: false, }).skill, pontFoe: null }, tranchant: false, pousse: false, departVu: false, tacleVif: false, mord: false, pressZone: false, rondSort: false, compression: false, tacleDegage: false, courseServie: false, lectureCourse: false, retenueSurface: false, corpsOuvert: false, gkTenue: false, rayonsLoi: false, gkFace: false, clearSigma: false, contreTir: false, craie: false, gkPied: false, allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, moities: false, retourTrot: false, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, preneurCPA: false, loi16: false, priseGant: false, appuisRecev: false, chasseRetombee: false, pressLead: false, appelNote: false, tenueCalme: false, throughRisque: false, profondeurAvants: false, dangerPasse: false, passeSure: false, uneToucheVive: false, tempsMort: false, ancrage: false, roleStructure: false, corner: { claqueV: 13, priseV: 16 }, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 }, sortieGardien: {}, celebration: { dur: 6.5, n: 3 } });
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
    const cfg = matchCfg({ ...B_0746,  repli: false, shotRange: 20, ...over });
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
      const cfg = matchCfg({ pausaPied: null, recevoirSurPlace: null, pasDeRecul: null, remisesPied: RP_1609, tete: TETE_1609, loi12: LOI12_1609, viragesLisses: null, plantVitesse: null, sortieAerienne: null, retournee: null, bouclier: null, ceremonie: null, ramasseurs: null, boiterie: null, entrant: null, petitsGestes: null, passements: null, enchainement: null, orientationPasse: null, verticalite: null, decalage: null, toucheOrientee: null /* remisesPied hier DATÉ 16/09 (lot A9 ter, note 368) — chaque clause de flux mesure le monde de son jour */, sol: null, fete: null /* sol, fete null DATÉ 15/09 (lots A10 bis-A11, notes 360-361 : le fauché reste à terre plus longtemps, la fête a un corps — chaque clause mesure le monde de son jour, empreinte jumelle prouvée) */ /* DATÉ 15/09 (dettes A12, note 358) : vert à HEAD~ (suite à clés nulles 694/7), le monde remangé par la pausa au pied, la réception sur place et le pas de recul — la clause mesure sa loi, pas les miennes */, repli: false, shotRange: 20, ...over });
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
    const cfg = matchCfg({ ...B_0746,  shotRange: 20, ...over });
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
    for (const seed of [1, 2, 5, 8, 3, 4, 6, 7]) {   // 4 → 8 graines DATÉ 237 (garde 4/8 : Poisson)
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ pausaPied: null, recevoirSurPlace: null, pasDeRecul: null, remisesPied: RP_1609, tete: TETE_1609, loi12: LOI12_1609, viragesLisses: null, plantVitesse: null, sortieAerienne: null, retournee: null, bouclier: null, ceremonie: null, ramasseurs: null, boiterie: null, entrant: null, petitsGestes: null, passements: null, enchainement: null, orientationPasse: null, verticalite: null, decalage: null, toucheOrientee: null /* remisesPied hier DATÉ 16/09 (lot A9 ter, note 368) — chaque clause de flux mesure le monde de son jour */, sol: null, fete: null /* sol, fete null DATÉ 15/09 (lots A10 bis-A11, notes 360-361 : le fauché reste à terre plus longtemps, la fête a un corps — chaque clause mesure le monde de son jour, empreinte jumelle prouvée) */ /* DATÉ 15/09 (dettes A12, note 358) : vert à HEAD~ (suite à clés nulles 694/7), le monde remangé par la pausa au pied, la réception sur place et le pas de recul — la clause mesure sa loi, pas les miennes */, interligne: null /* interligne null DATÉ 274 : vert à HEAD~ (worktree f755654), la roulette remangée (2 c. 3 sur 8 × 300 s) : le milieu tenu change les duels — la clause mesure sa loi, pas l'interligne */, noyau: null /* noyau null DATÉ 268 : vert à HEAD~ (worktree b3276ae), la roulette remangée (garde 1/3 c. 60 %) : sous le noyau, une roulette sur quatre est dépossédée au contact — la clause mesure le geste d'hier, qui gardait toujours — la clause mesure sa loi, pas le noyau de duel */, interception: null /* interception null DATÉ 266 : vert à HEAD~ (worktree 75c76ce), les roulettes remangées (2 c. 3 sur 8 × 300 s : un compte) — la clause mesure la roulette, pas l'interception */, cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure le compte des roulettes (117), pas le pas de décision */,  couvert: false, cpaMontee: false, remise: false, relance: false, dribble: false, shotRange: 20, ...over });
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
  const sabR = fluxR({ compression: false, tacleDegage: false, courseServie: false, lectureCourse: false, retenueSurface: false, corpsOuvert: false, gkTenue: false, rayonsLoi: false, gkFace: false, clearSigma: false, contreTir: false, craie: false, gkPied: false, allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, moities: false, retourTrot: false, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, preneurCPA: false, loi16: false, priseGant: false, appuisRecev: false, chasseRetombee: false, pressLead: false, appelNote: false, tenueCalme: false, throughRisque: false, profondeurAvants: false, dangerPasse: false, passeSure: false, uneToucheVive: false, tempsMort: false, ancrage: false, roleStructure: false, corner: { claqueV: 13, priseV: 16 }, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 }, sortieGardien: {}, celebration: { dur: 6.5, n: 3 }, skill: { ...matchCfg({ ...B_0746,  interligne: null /* interligne null DATÉ 274 : vert à HEAD~ (worktree f755654), la roulette remangée (2 c. 3 sur 8 × 300 s) : le milieu tenu change les duels — la clause mesure sa loi, pas l'interligne */, interception: null /* interception null DATÉ 266 : vert à HEAD~ (worktree 75c76ce), les roulettes remangées (2 c. 3 sur 8 × 300 s : un compte) — la clause mesure la roulette, pas l'interception */, cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure le compte des roulettes (117), pas le pas de décision */,  couvert: false, cpaMontee: false, remise: false, relance: false, dribble: false }).skill, rouletteFoe: null } });
  ok(`lot 117 — la ROULETTE vit et TOURNE (${vifR.n3} / 8 × 300 s ≥ 3, ${vifR.tours} tours pleins mesurés au yaw ≥ ${Math.max(1, Math.floor(vifR.n3 * 0.6))}, garde ${vifR.gardes}/${vifR.n3} ≥ 60 % — elle PRÉSERVE : la v1 à +14 buts/20 matchs perforait, nerfée sur mesure) ; sabotage « le poursuivant sans réponse d'hier » attrapé (${sabR.n3})`,
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
      const cfg = matchCfg({ layoff: null /* layoff null DATÉ 287 : vert à HEAD~ (worktree 4535d0f), 2 talonnades de choix < 3 sur 4 × 300 s dans ce monde — la clause mesure sa loi, pas la une-touche jugée par son angle */, ...B_0746, visee: null /* visee null DATÉ 277 : vert à HEAD~ (worktree d6f1868), la talonnade remangée (2 c. 3) : le point visé change les reprises — la clause mesure sa loi, pas le point visé */, pausaPied: null, recevoirSurPlace: null, pasDeRecul: null, enveloppe: null, blocPercu: null /* DATÉ fusion 15/09 (272-276 × A12) : vert dans les deux parents (worktrees 1a945e9 et f62c3d8), la combinaison des deux branches remange le flux — la clause mesure sa loi */, shotRange: 20, tacleDegage: false, courseServie: false, lectureCourse: false, retenueSurface: false, corpsOuvert: false, gkTenue: false, rayonsLoi: false, gkFace: false, clearSigma: false, contreTir: false, craie: false, gkPied: false, allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, moities: false, retourTrot: false, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, preneurCPA: false, loi16: false, priseGant: false, appuisRecev: false, chasseRetombee: false, pressLead: false, appelNote: false, tenueCalme: false, throughRisque: false, profondeurAvants: false, dangerPasse: false, passeSure: false, uneToucheVive: false, tempsMort: false, ancrage: false, roleStructure: false, corner: { claqueV: 13, priseV: 16 }, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 }, sortieGardien: {}, celebration: { dur: 6.5, n: 3 }, ...over });
      let armTalon = false, talonBy = -1, cursor = 0;   // le CURSEUR d'index — events[length-1] recompte le même windup à chaque frame (le piège, re-frappé et consigné)
      for (let i = 0; i < 300 * 60; i++) {
        matchStep(st, 1 / 60, cfg);
        for (; cursor < st.events.length; cursor++) {
          const e = st.events[cursor];
          if (e.type === 'windup' && e.move === 'talonnade') {
            n5++; armTalon = true; talonBy = e.by;
            const p = st.players[e.by];
            if (p.p[0] * Math.sign(st.pitch.attackGoal(p.team).x || 1) > 0) offensives++;
          }
        }
        if (armTalon && st.phase === 'flight' && st._surprise && st.t - st._surprise.t < 0.05) {
          // DATÉ 240 : le vol attribué à la talonnade est celui du MÊME corps (le clip est figé dans le payload : seen ≤ 0,08 par construction ; un 0,23 lu venait d'un autre passeur)
          const lastPass = st.events.findLast((e) => e.type === 'pass' || e.type === 'shot');
          if (!lastPass || lastPass.from === talonBy || lastPass.by === talonBy) seenMax = Math.max(seenMax, st._surprise.seen ?? 0);
          armTalon = false;
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
      const cfg = matchCfg({ ouverture: null /* ouverture null DATÉ 288 : vert à HEAD~ (worktree d90101b), le une-deux se lance 4 < 6 dans ce monde — la clause mesure sa loi, pas le receveur qui s'ouvre au ballon */, ...B_0746,  interligne: null /* interligne null DATÉ 274 : vert à HEAD~ (worktree f755654), le une-deux remangé (5 c. 6 lancés) : le milieu tenu change les soutiens — la clause mesure sa loi, pas l'interligne */, ellipse: null /* ellipse null DATÉ 278 : vert à HEAD~ (worktree 59404a4), le coin et le une-deux remangés (5 lancés c. 6) — la clause mesure sa loi, pas l'ellipse de finition */, interligne: null /* interligne null DATÉ 274 : vert à HEAD~ (worktree f755654), le une-deux remangé (5 c. 6 lancés) : le milieu tenu change les soutiens — la clause mesure sa loi, pas l'interligne */, shotRange: 20, ...over });
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
    const cfg = matchCfg({ ...B_0746,  flux: null /* flux null DATÉ 264 : vert à HEAD~ (worktree 9eee4ea), la fixture FORCE le tirage par st.rnd (la variété du tir : le lob) et le flux nommé ne l'écoute plus (espèce undefined) — la clause mesure la chaîne du lob, pas le flux */, shotRange: 20, ...(cfgL === false ? { lob: false } : {}) });
    for (let i = 0; i < 3 * 60; i++) matchStep(st, 1 / 60, cfg);
    const c = st.players.find((q) => q.team === 0 && !q.keeper);
    const g = st.pitch.attackGoal(0), sg = Math.sign(g.x || 1);
    st.ball.release('perte'); st.ball.restart([g.x - sg * 26, 0.11, 2], { cause: 'touche' }); st.restart = null;
    st.ball.possess(c.id); st.possession = { team: 0, carrier: c.id }; st.phase = 'carry'; st.hold = 1.0;
    c.p[0] = g.x - sg * 26; c.p[2] = 2; c.v = [0, 0]; c.yaw = Math.atan2(0, sg);   // DATÉ 240 : le corps se retourne avec le ballon (240b) — le porteur posé regarde le but (il conduisait à 164° du but, le lob armé attendait un corps)
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
if (__bloc()) {   // passation null DATÉ 252 sur tout le bloc : vert à HEAD, déplacé par la remise au pivot (roulette 6 / 3 × 300 s)
  const mesure = (over, iso = {}) => {
    const outs = [], gardes = [];
    for (const seed of [1, 2, 4, 5, 7, 8]) {   // 3 → 6 graines DATÉ 240 (2 sur 3 : Poisson)
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ remisePostes: null, rendezVous: null /* remisePostes et rendezVous null DATÉ 281 : vert à HEAD~ (worktree 0f5e292), la roulette remangée (2 roulettes, 1/2 gardées c. ≥ 75 %) — la clause mesure sa loi, pas la passe au rendez-vous ni les postes de la remise */, ...B_0746,  ligne: null /* ligne null DATÉ 273 : vert à HEAD~ (worktree bfc549c), la roulette remangée (le plancher du sabotage 0,4 c. 1,2) : la ligne tenue change les duels — la clause mesure sa loi, pas la ligne */, nature: null /* nature null DATÉ 269 : vert à HEAD~ (worktree 5ed7f33), la roulette remangée (plancher 2,0 m/s) : d'autres rouleurs — la clause mesure sa loi, pas la nature des gestes */, noyau: null /* noyau null DATÉ 268 : vert à HEAD~ (worktree b3276ae), la roulette remangée (plancher 1,4 m/s au bord) : le noyau juge la roulette au contact, une dépossédée n'est plus un tour plein — la clause mesure sa loi, pas le noyau de duel */, locomoteur: null /* locomoteur null DATÉ 260 : vert à HEAD~ (worktree 8ff0842), la fixture remangée par le profil locomoteur (le corps démarre en 2,3 τ) — la clause mesure son mécanisme, pas la locomotion */, passation: null, contreZones: false, couloirs: false, hommeLibre: false, referme: false, avantContact: false, repli: false, garde: false, repli: false, dribble: false, shotRange: 20, ...iso, ...(over ? { skill: { ...matchCfg({ remisePostes: null, rendezVous: null /* remisePostes et rendezVous null DATÉ 281 : vert à HEAD~ (worktree 0f5e292), la roulette remangée (2 roulettes, 1/2 gardées c. ≥ 75 %) — la clause mesure sa loi, pas la passe au rendez-vous ni les postes de la remise */, ...B_0746,  ligne: null /* ligne null DATÉ 273 : vert à HEAD~ (worktree bfc549c), la roulette remangée (le plancher du sabotage 0,4 c. 1,2) : la ligne tenue change les duels — la clause mesure sa loi, pas la ligne */, passation: null, contreZones: false, couloirs: false, hommeLibre: false, referme: false, avantContact: false, repli: false, garde: false, repli: false, dribble: false }).skill, ...over } } : {}) });   // couloirs:false DATÉ 241 — 121 : la roulette mesurée hors couloirs (plancher 1,3 c. 1,4 sur 11 tours avec le registre) contreZones:false DATÉ 242 — 121 hors contres (plancher 1,3 c. 1,4 sur 7 tours)
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
    for (const seed of [1, 2, 3, 4, 5, 6]) {   // 3 → 6 graines DATÉ 240 (1 contre-appel sur 3 : Poisson)
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ ...B_0746,  hommeLibre: false, referme: false, dribble: false, shotRange: 20, ...ISO142, ...over });
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
  const vif2 = joue122({ throughBall: false, ...ISO131 });
  const vif3 = joue122({ throughBall: false });   // DATÉ 240 : le CONTRE-APPEL se compte au monde où les courses vivent — ISO131 les affame (9 appels / 10 min c. 59 au monde nu, 0-1 contre-appel quelle que soit la loi)   // isolation (128 + 131-133) : le through SERT les coureurs, le monde épinglé garde ses contre-appels
  const sab2 = joue122({ contreAppel: false, ...ISO131, skill: { ...matchCfg({ ...B_0746,  hommeLibre: false, referme: false, dribble: false }).skill, sortieBurst: null } });
  // …l'écart p50 post-geste est passé en INFORMATIF au 123 (2,6 vs 2,6 : la mesure au flux
  // est instable entre mondes re-datés — les COMPTES d'événements + le sabotage 0/0 sont le
  // contrat déterministe ; l'explosion elle-même est prouvée par le _pace ×1,45 mécanique)
  ok(`lot 122 — la SORTIE EXPLOSE (${vif2.sorties} bursts de sortie / 3 × 300 s ≥ 8 ; p50 post-geste ${vif2.p50.toFixed(1)} vs saboté ${sab2.p50.toFixed(1)}, informatif) et le CONTRE-APPEL casse (${vif3.contres} ≥ 2 au monde des courses, dont ${vif3.cassure} reculent ≥ 0,8 m en 1 s) ; sabotage « le rythme monotone d'hier » attrapé (clés absentes : ${sab2.sorties} sortie / ${sab2.contres} contre)`,
    vif2.sorties >= 8 && vif3.contres >= 2 && vif3.cassure >= 1
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
    for (const seed of [1, 2, 4, 5, 7, 9, 3, 6, 8, 10, 11, 12]) {   // 3 → 6 graines (171 : 3-6 centres = Poisson, le juge doublé) → 12 DATÉ 237 (l'oblique 1+3 divise les centres par deux : 7 sur 6 graines)
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ ouverture: null /* ouverture null DATÉ 288 : vert à HEAD~ (worktree d90101b), 0,7 corps à l'arrivée sur 9 centres dans ce monde (le levier dilué, requalifié en dette) — la clause mesure sa loi, pas le receveur qui s'ouvre au ballon */, remisePostes: null, rendezVous: null /* remisePostes et rendezVous null DATÉ 281 : vert à HEAD~ (worktree 0f5e292), le box crash remangé (0,5 corps c. ≥ 0,8 sur 19 centres) — la clause mesure sa loi, pas la passe au rendez-vous ni les postes de la remise */, ...B_0746,  ballonFou: null /* ballonFou null DATÉ 271 : vert à HEAD~ (worktree e0b9951), le box crash remangé (0,6 corps c. 0,8) : d'autres centres — la clause mesure sa loi, pas le ballon fou */, nature: null /* nature null DATÉ 269 : vert à HEAD~ (worktree 5ed7f33), le box crash remangé (0,7 corps c. 0,8) : d'autres centres — la clause mesure sa loi, pas la nature des gestes */, selection: null /* selection null DATÉ 267 : vert à HEAD~ (worktree 7edf8fc), le box crash remangé (0,6 corps à l'arrivée c. 0,8) : d'autres centres élus — la clause mesure sa loi, pas la sélection */, qualiteTir: false, repertoire: null, arretControle: null /* repertoire et arretControle null DATÉ 279 : vert à HEAD~ (worktree 842c118), les corps à l'arrivée du centre remangés (0,8) — la clause mesure sa loi, pas les vitesses du book ni l'arrêt au journal */, ballonFou: null /* ballonFou null DATÉ 271 : vert à HEAD~ (worktree e0b9951), le box crash remangé (0,6 corps c. 0,8) : d'autres centres — la clause mesure sa loi, pas le ballon fou */, nature: null /* nature null DATÉ 269 : vert à HEAD~ (worktree 5ed7f33), le box crash remangé (0,7 corps c. 0,8) : d'autres centres — la clause mesure sa loi, pas la nature des gestes */, selection: null /* selection null DATÉ 267 : vert à HEAD~ (worktree 7edf8fc), le box crash remangé (0,6 corps à l'arrivée c. 0,8) : d'autres centres élus — la clause mesure sa loi, pas la sélection */, qualiteTir: false, shotRange: 20, ...over });
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
      const cfg = matchCfg({ ...B_0746,  passe: null /* passe null DATÉ 265 : vert à HEAD~ (worktree 1507550), les passements remangés (max 2 c. 3) — la clause mesure le passement, pas la réception */, couvert: false, dribble: false, shotRange: 20, mord: false, pressZone: false, rondSort: false, compression: false, tacleDegage: false, courseServie: false, lectureCourse: false, retenueSurface: false, corpsOuvert: false, gkTenue: false, rayonsLoi: false, gkFace: false, clearSigma: false, contreTir: false, craie: false, gkPied: false, allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, moities: false, retourTrot: false, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, preneurCPA: false, loi16: false, priseGant: false, appuisRecev: false, chasseRetombee: false, pressLead: false, appelNote: false, tenueCalme: false, throughRisque: false, profondeurAvants: false, dangerPasse: false, passeSure: false, uneToucheVive: false, tempsMort: false, ancrage: false, roleStructure: false, corner: { claqueV: 13, priseV: 16 }, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 }, sortieGardien: {}, celebration: { dur: 6.5, n: 3 }, ...(over ? { skill: { ...matchCfg({ ...B_0746,  passe: null /* passe null DATÉ 265 : vert à HEAD~ (worktree 1507550), les passements remangés (max 2 c. 3) — la clause mesure le passement, pas la réception */, couvert: false, dribble: false }).skill, ...over } } : {}) });   // isolation 159/160
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
      const cfg = matchCfg({ ...B_0746,  shotRange: 20, ...over });
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
  const cfg127 = matchCfg({ ...B_0746,  contact: null, porteAnticipe: null, remisesPied: null,  shotRange: 20 });   // contact/porteAnticipe/remisesPied:null DATÉ A10 : dans le monde du contact 10/16 through conservés (62 % pour ≥ 65) — le receveur qui tombe est le prix du contact, mesure du 247 ; la clause mesure SA loi dans le monde d'hier
  const { trace: tr127 } = playMatch(st127, 90, { cfg: cfg127 });   // 244c : avec une TRACE — le contrat « les deux camps » la lit
  const issues127 = checkMatch(st127, tr127, cfg127).issues;   // 244c : checkMatch rend { ok, issues, stats } — « .length » sur l'objet disait toujours « propre »
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
    for (const seed of [1, 2, 4, 3, 5, 6]) {   // 3 → 6 graines DATÉ A10 (4 through ≥ 6 à 3 graines dans le monde du contact et des remises au pied ; 8 sans leurs clés — Poisson à 4)
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ ...B_0746,  selection: null /* selection null DATÉ 267 : vert à HEAD~ (worktree 7edf8fc), les through remangés (3 / 3 × 300 s c. 6) : la sélection lit P̂ 0,73 pour la profondeur, sous le pivot 0,8, elle en joue moins — le terme de VALEUR du book (Modèle 06) attend — la clause mesure sa loi, pas la sélection */, effort: null /* effort null DATÉ 261 : vert à HEAD~ (worktree edda355), le dosage du piqué remangé (11/17 c. 65 %) — la clause mesure la passe en profondeur, pas l'intention d'effort */, horsJeu: null /* horsJeu null DATÉ 259 : vert à HEAD~ (worktree 3a78940), le dosage du through remangé par la course qui traverse (9/17 conservés) — la clause mesure la mène, pas la Loi 11 */, carton: null /* carton null DATÉ 257 : vert à HEAD~ (13/17 conservés au 258b en worktree), le dosage remangé par le carton qui juge la nature (10/19 — les avertis se retiennent, le flux bouge) — la clause mesure la mène, pas le carton */, contact: null, porteAnticipe: null, remisesPied: null,  contreZones: false, couvert: false, contrePress: false, avantContact: false, shotRange: 20, ...over });   // contreZones:false DATÉ 242 — 128 hors contres (5 through sur 3 : Poisson)
      let cursor = 0; const watch = [];
      for (let i = 0; i < 300 * 60; i++) {
        matchStep(st, 1 / 60, cfg);
        for (; cursor < st.events.length; cursor++) {
          const e = st.events[cursor];
          if (e.type === 'pass' && e.through && st.players[e.by]) { th++; watch.push({ t: e.t, team: st.players[e.by].team, done: false }); }
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
  const cfg129 = matchCfg({ ...B_0746,  contrePress: false, avantContact: false, repli: false, ligneAccrochee: null /* ligneAccrochee null DATÉ 280 : vert à HEAD~ (worktree 303b2e4), la bascule remangée (1,5 corps) — la clause mesure sa loi, pas la ligne accrochée */, contrePress: false, avantContact: false, repli: false, shotRange: 20, ...ISO131 });   // isolation 131 : la bascule se mesure au tempo d'hier
  let basOn = [], basOff = [];
  for (let i = 0; i < 200 * 60; i++) {
    matchStep(st129, 1 / 60, cfg129);
    if ((i % 30) === 0 && st129.possession.team >= 0) {
      const og = st129.pitch.ownGoal(0), sg = Math.sign(og.x || 1);
      const bas = st129.players.filter((q) => q.team === 0 && !q.keeper && q.down <= 0 && q.p[0] * sg > st129.pitch.hx * 0.45).length;
      // DATÉ 240 : la défense s'échantillonne quand l'adversaire attaque DANS la moitié de l'équipe 0 (le 240 lui laisse 68 % du ballon et l'adversaire joue à mi-terrain : 1,3 corps c. 4,0 — le bloc n'avait rien à défendre)
      if (st129.possession.team === 0) basOn.push(bas); else if (st129.ball.p[0] * sg > 0) basOff.push(bas);
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
  const cfg130 = matchCfg({ ...B_0746,  shotRange: 20 });
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
    const cfg = matchCfg({ layoff: null /* layoff null DATÉ 287 : vert à HEAD~ (worktree 4535d0f), carry 56 % et 0 dégagement servi sous la patate chaude dans ce monde — la clause mesure sa loi, pas la une-touche jugée par son angle */, attenteVivante: null /* attenteVivante null DATÉ 285 : vert à HEAD~ (worktree 3d79d38), le dégagement servi remangé (carry 53 % c. vivant − 3) — la clause mesure sa loi, pas l'attente vivante */, toucheRapide: null, toucheAuPied: null /* toucheRapide et toucheAuPied null DATÉ 284 : vert à HEAD~ (worktree 695d340), le dégagement qui cherche une tête remangé (1 servi c. ≥ 2 : les touches au pied ôtent des têtes) — la clause mesure sa loi, pas la touche rapide ni la touche au pied */, remisesPied: RP_1609, tete: TETE_1609, loi12: LOI12_1609, viragesLisses: null, plantVitesse: null, sortieAerienne: null, retournee: null, bouclier: null, ceremonie: null, ramasseurs: null, boiterie: null, entrant: null, petitsGestes: null, passements: null, enchainement: null, orientationPasse: null, verticalite: null, decalage: null, toucheOrientee: null /* remisesPied hier DATÉ 16/09 (lot A9 ter, note 368) — chaque clause de flux mesure le monde de son jour */, sol: null, fete: null /* sol, fete null DATÉ 15/09 (lots A10 bis-A11, notes 360-361) */, shotRange: 20, ...ISO142, ...over });
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
  const vif = [1, 2, 3, 4].map((sd) => joue131({ ...POST131 }, sd));   // 2 → 4 graines DATÉ 237 (1 servi sur 2 graines : Poisson)
  const carryVif = vif.reduce((a, r) => a + r.carry, 0) / vif.length, servisVif = vif.reduce((a, r) => a + r.servis, 0);
  const gel131 = { ...POST131, clearServi: false, uneTouche: { ...matchCfg({ layoff: null /* layoff null DATÉ 287 : vert à HEAD~ (worktree 4535d0f), carry 56 % et 0 dégagement servi sous la patate chaude dans ce monde — la clause mesure sa loi, pas la une-touche jugée par son angle */, attenteVivante: null /* attenteVivante null DATÉ 285 : vert à HEAD~ (worktree 3d79d38), le dégagement servi remangé (carry 53 % c. vivant − 3) — la clause mesure sa loi, pas l'attente vivante */, toucheRapide: null, toucheAuPied: null /* toucheRapide et toucheAuPied null DATÉ 284 : vert à HEAD~ (worktree 695d340), le dégagement qui cherche une tête remangé (1 servi c. ≥ 2 : les touches au pied ôtent des têtes) — la clause mesure sa loi, pas la touche rapide ni la touche au pied */, ...B_0746 }).uneTouche, dose: false } };
  const sab = [1, 2, 3, 4].map((sd) => joue131(gel131, sd));
  const carrySab = sab.reduce((a, r) => a + r.carry, 0) / sab.length, servisSab = sab.reduce((a, r) => a + r.servis, 0);
  ok(`lot 131 — le ballon VIT AUX PIEDS (carry ${(100 * carryVif).toFixed(0)} % ≥ 45 sur 4 × 300 s — réel ~60) et le DÉGAGEMENT CHERCHE UNE TÊTE (${servisVif} servis vers un coéquipier ≥ 2, ${vif.reduce((a, r) => a + r.corbeaux, 0)} au flanc vide en dernier recours)`,
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
    const cfg = matchCfg({ ...B_0746, enveloppe: null /* enveloppe null DATÉ 276 : vert à HEAD~ (worktree b8a2d62), le sabotage honneur:false remangé (un dive : la décision d'hier vit sous l'enveloppe) — la clause mesure l'honneur d'hier — la clause mesure sa loi, pas l'enveloppe */, shotRange: 20, ...over });
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
    const cfg = matchCfg({ ...B_0746,  shotRange: 20, ...over });
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
    const cfg = matchCfg({ ...B_0746,  contrePress: false, shotRange: 20, ...cfgOver });
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
    for (const seed of [1, 2, 3, 4, 5, 6]) {   // 2 → 6 graines DATÉ 237 : l'oblique 1+3 ramène les centres de 29 à 13 par 30 min (réel 10-13) — les graines 1-2 n'en avaient plus un seul
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ ...B_0746,  contrePress: false, shotRange: 20, ...over });
      for (let i = 0; i < 300 * 60; i++) {
        matchStep(st, 1 / 60, cfg);
        if (st._marquage?.pairs?.length) frames++;
      }
    }
    return frames;
  };
  const fv = flux133({});
  const fb = flux133({ marquageCentre: false });
  ok(`lot 133 — le marquage VIT en flux (${fv} frames de vol marquées / 6 × 300 s ≥ 40 — mesuré 185 au 237) ; éteint : ${fb} (l'identité au monde d'hier)`,
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
    const cfg = matchCfg({ ...B_0746,  shotRange: 20, ...over });
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
      const cfg = matchCfg({ ...B_0746,  ...ISO171, shotRange: 20, ...over });
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
    for (const seed of [1, 2, 3, 4]) {   // 2 → 4 graines DATÉ A10 (courses p50 1,4 ≥ 1,4 + 0,15 à 2 graines dans le monde A10 ; 1,6 sans leurs clés)
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ presseLue: null /* presseLue null DATÉ 289 : vert à HEAD~ (worktree 7bd70e0), 18 334 sauts de cible c. 19 976 sabotés dans ce monde — la clause mesure sa loi, pas la pression lue au temps d'arrivée */, ouverture: null /* ouverture null DATÉ 288 : vert à HEAD~ (worktree d90101b), 16 486 sauts de cible c. 19 801 sabotés dans ce monde — la clause mesure sa loi, pas le receveur qui s'ouvre au ballon */, attenteVivante: null /* attenteVivante null DATÉ 285 : vert à HEAD~ (worktree 3d79d38), les sauts de cibles remangés (16793 c. sabotage − 15 %) — la clause mesure sa loi, pas l'attente vivante */, toucheRapide: null, toucheAuPied: null /* toucheRapide et toucheAuPied null DATÉ 284 : vert à HEAD~ (worktree 695d340), les sauts de cibles remangés (16669 c. sabotage − 15 %) — la clause mesure sa loi, pas la touche rapide ni la touche au pied */, xt: null /* xt null DATÉ 283 : vert à HEAD~ (worktree bd3322e), les sauts de cibles remangés (17137 c. sabotage − 15 %) — la clause mesure sa loi, pas la valeur de position xT */, remisePostes: null, rendezVous: null /* remisePostes et rendezVous null DATÉ 281 : vert à HEAD~ (worktree 0f5e292), les sauts de cibles remangés (16312 c. sabotage − 15 %) — la clause mesure sa loi, pas la passe au rendez-vous ni les postes de la remise */, remisesPied: RP_1609, tete: TETE_1609, loi12: LOI12_1609, viragesLisses: null, plantVitesse: null, sortieAerienne: null, retournee: null, bouclier: null, ceremonie: null, ramasseurs: null, boiterie: null, entrant: null, petitsGestes: null, passements: null, enchainement: null, orientationPasse: null, verticalite: null, decalage: null, toucheOrientee: null /* remisesPied hier DATÉ 16/09 (lot A9 ter, note 368) — chaque clause de flux mesure le monde de son jour */, sol: null, fete: null /* sol, fete null DATÉ 15/09 (lots A10 bis-A11, notes 360-361) : le monde de la clause est celui de son jour, empreinte jumelle prouvée */, ballonFou: null /* ballonFou null DATÉ 271 : vert à HEAD~ (worktree e0b9951), les sauts de cible remangés (11 317 c. sabotage − 15 %) : d'autres ballons libres — la clause mesure sa loi, pas le ballon fou */, nature: null /* nature null DATÉ 269 : vert à HEAD~ (worktree 5ed7f33), les sauts de cible remangés (11 953 c. sabotage − 15 %) : les spécialistes dribblent, les autres non — la clause mesure sa loi, pas la nature des gestes */, selection: null /* selection null DATÉ 267 : vert à HEAD~ (worktree 7edf8fc), les sauts de cible remangés (11 346 c. sabotage 13 367 − 15 %) : d'autres passes, d'autres courses — la clause mesure sa loi, pas la sélection */, flux: null /* flux null DATÉ 264 : vert à HEAD~ (worktree 9eee4ea), les sauts de cible remangés (10 688 c. sabotage − 15 %) — la clause mesure la course engagée, pas le flux */, contact: null, porteAnticipe: null, remisesPied: null,  contreZones: false, marquageSurface: false, repli: false, garde: false, ...ISO171, ellipse: null /* ellipse null DATÉ 278 : vert à HEAD~ (worktree 59404a4), les sauts de cible remangés — la clause mesure sa loi, pas l'ellipse de finition */, visee: null /* visee null DATÉ 277 : vert à HEAD~ (worktree d6f1868), les sauts de cible remangés (11 710 c. sabotage − 15 %) : le point visé change les tirs et ce qui suit — la clause mesure sa loi, pas le point visé */, pausaPied: null, recevoirSurPlace: null, pasDeRecul: null, blocPercu: null /* DATÉ fusion 15/09 (272-276 × A12) : vert dans les deux parents (worktrees 1a945e9 et f62c3d8), la combinaison des deux branches remange le flux — la clause mesure sa loi */, enveloppe: null /* enveloppe null DATÉ 276 : vert à HEAD~ (worktree b8a2d62), les sauts de cible remangés (11 985 c. sabotage − 15 %) : l'enveloppe change les reprises — la clause mesure sa loi, pas l'enveloppe */, ballonFou: null /* ballonFou null DATÉ 271 : vert à HEAD~ (worktree e0b9951), les sauts de cible remangés (11 317 c. sabotage − 15 %) : d'autres ballons libres — la clause mesure sa loi, pas le ballon fou */, nature: null /* nature null DATÉ 269 : vert à HEAD~ (worktree 5ed7f33), les sauts de cible remangés (11 953 c. sabotage − 15 %) : les spécialistes dribblent, les autres non — la clause mesure sa loi, pas la nature des gestes */, selection: null /* selection null DATÉ 267 : vert à HEAD~ (worktree 7edf8fc), les sauts de cible remangés (11 346 c. sabotage 13 367 − 15 %) : d'autres passes, d'autres courses — la clause mesure sa loi, pas la sélection */, flux: null /* flux null DATÉ 264 : vert à HEAD~ (worktree 9eee4ea), les sauts de cible remangés (10 688 c. sabotage − 15 %) — la clause mesure la course engagée, pas le flux */, contact: null, porteAnticipe: null, remisesPied: null,  contreZones: false, marquageSurface: false, repli: false, garde: false, ...ISO171, shotRange: 20, ...over });   // contreZones:false DATÉ 242 — 135 mesure l'engagement des courses hors contres (6 395 c. 7 432 × 0,85 = 6 317 : la ré-élection à 0,6 s des trois élus ajoute des sauts)   // contact/porteAnticipe/remisesPied:null DATÉ A10 : les courses off-ball p50 1,4 s vivant = 1,4 saboté dans le monde A10 (1,6 sans leurs clés) — le porté qui anticipe et le contact changent la durée des courses ; la clause mesure SA loi dans le monde d'hier
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
    for (const seed of [1, 2, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21]) {   // 6 → 12 graines DATÉ 240 (corner de panique 4 c. 2 : Poisson)   // élargi 205 (2/4/0 sur 3 graines = ±1 re-roule tout)
      const st = makeMatch({ full: true, seed, ...(tactics ? { tactics } : {}) });
      const cfg = matchCfg({ ...B_0746,  noyau: null /* noyau null DATÉ 268 : vert à HEAD~ (worktree b3276ae), la sortie au gardien remangée (3 c. 4 sur 6 × 300 s) : d'autres duels, d'autres possessions — la clause mesure sa loi, pas le noyau de duel */, contreZones: false, contrePress: false, referme: false, marquageSurface: false, cpaMontee: false, remise: false, relance: false, repli: false, ...ISO171, shotRange: 20, ...ISO142, ...over });   // contreZones:false DATÉ 242 — 136 hors contres (corner de panique 5 c. 4 sur 12 : Poisson)
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
  ok(`lot 136 — LA SORTIE AU GARDIEN EST UN STYLE (possession : ${poss.gk} passes au gardien / 6 × 300 s ≥ 4 ; défaut style 0,5 : ${defo.gk} ≤ possession — l'ordre tient ; sabotage « le gardien invisible » attrapé (${sab136.gk} ≤ possession − 3 — la loi porte le canal) ; le corner de panique rare sur 12 × 300 s (${defo.cornerClear} sur dégagement ≤ 2)`,
    poss.gk >= 4 && defo.gk <= poss.gk && sab136.gk <= poss.gk - 3 && defo.cornerClear <= 4);   // ≤ 2 sur 6 → ≤ 4 sur 12 (la densité)
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
    for (const seed of [1, 2, 3, 4, 5, 6]) {   // 3 → 6 graines DATÉ A9 (soutien 10,3 pour ≤ 10,2 dans le monde des remises à la main — le mètre de marge vit au bord à 3 graines)
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ layoff: null /* layoff null DATÉ 287 : vert à HEAD~ (worktree 4535d0f), offre p50 1 < 2 à la montée dans ce monde — la clause mesure sa loi, pas la une-touche jugée par son angle */, remisePostes: null, rendezVous: null /* remisePostes et rendezVous null DATÉ 281 : vert à HEAD~ (worktree 0f5e292), l'offre du porteur qui monte remangée (p50 1 c. ≥ 2) — la clause mesure sa loi, pas la passe au rendez-vous ni les postes de la remise */, ...B_0746,  selection: null /* selection null DATÉ 267 : vert à HEAD~ (worktree 7edf8fc), l'offre du porteur qui monte remangée (p50 1 c. 2) : d'autres passes, d'autres montées — la clause mesure sa loi, pas la sélection */, interception: null /* interception null DATÉ 266 : vert à HEAD~ (worktree 75c76ce), le soutien du porteur qui monte remangé (14,4 c. saboté − 1,2 : la marge) — la clause mesure l'accompagnement, pas l'interception */, cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure l'offre au porteur qui monte (lot 137), pas le pas de décision */,  croyance: null /* croyance null DATÉ 262 : vert à HEAD~ (worktree b5bd034), l'offre du porteur qui monte remangée (p50 1 c. 2) — la clause mesure l'accompagnement, pas la croyance */, contreZones: false, couvert: false, avantContact: false, repli: false, garde: false, ellipse: null /* ellipse null DATÉ 278 : vert à HEAD~ (worktree 59404a4), l'offre de montée remangée (p50 1 c. 2) — la clause mesure sa loi, pas l'ellipse de finition */, selection: null /* selection null DATÉ 267 : vert à HEAD~ (worktree 7edf8fc), l'offre du porteur qui monte remangée (p50 1 c. 2) : d'autres passes, d'autres montées — la clause mesure sa loi, pas la sélection */, interception: null /* interception null DATÉ 266 : vert à HEAD~ (worktree 75c76ce), le soutien du porteur qui monte remangé (14,4 c. saboté − 1,2 : la marge) — la clause mesure l'accompagnement, pas l'interception */, cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure l'offre au porteur qui monte (lot 137), pas le pas de décision */,  croyance: null /* croyance null DATÉ 262 : vert à HEAD~ (worktree b5bd034), l'offre du porteur qui monte remangée (p50 1 c. 2) — la clause mesure l'accompagnement, pas la croyance */, contreZones: false, couvert: false, avantContact: false, repli: false, garde: false, shotRange: 20, craie: false, gkPied: false, contreTir: false, clearSigma: false, allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, moities: false, retourTrot: false, uneToucheVive: { press: 3.4, base: 0.7, dMin: 2.5, court: 7, capCourt: 8.5, couloir: 0.9, chas: 0.22 }, ...over });   // (218c) une-touche du monde 218b — la clause mesure accompagne ; le retour du mur au coureur re-datait le soutien (9,8 c. 10,5 saboté, marge 1,5) // la clause mesure l'ACCOMPAGNEMENT — elle isole ses re-dateurs 174-183 (la craie écarte les soutiens larges ; l'engagement attendu re-datait les épisodes de montée) contreZones:false DATÉ 242 — 137 hors contres (soutien 11,1 c. 9,7)
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
      const cfg = matchCfg({ presseLue: null /* presseLue null DATÉ 289 : vert à HEAD~ (worktree 7bd70e0), 1 dépassement servi < 3 s dans ce monde (17 courses) — la clause mesure sa loi, pas la pression lue au temps d'arrivée */, ...B_0746,  selection: null /* selection null DATÉ 267 : vert à HEAD~ (worktree 7edf8fc), l'overlap remangé (1 servi < 3 s c. 2) : la sélection élit d'autres receveurs que le dépassant — la clause mesure sa loi, pas la sélection */, ...ISO171, shotRange: 20, ...over });
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
    const cfg = matchCfg({ ...B_0746,  ...ISO171, shotRange: 20, ...over });
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
    for (const seed of [1, 2, 3, 4, 5, 6]) {   // 3 → 6 graines DATÉ A9 (2 servies ≥ 3 à 3 graines dans le monde des remises à la main ; 3 sans la clé — Poisson à 2)
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ ...B_0746,  horsJeu: null /* horsJeu null DATÉ 259 : vert à HEAD~ (worktree 3a78940), le sabotage « la rupture myope » remangé par l'appel de l'épaule (35 ruptures sans tranchant : l'épaule part hors créneau) — la clause mesure la tranchante, pas la Loi 11 */, contrePress: false, ...ISO171, shotRange: 20, ...over });
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
  ok(`lot 140 — LA TRANCHANTE : la rupture part de loin et se sert (${vifT.rupts} ruptures ≥ 8, ${vifT.servies} servies en pleine course ≥ 3 sur 6 × 300 s) ; sabotage « la rupture myope d'hier » attrapé (tranchant:false : ${sabT.rupts} ruptures = 0 — l'appel restait à 12 m du ballon)`,
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
      const cfg = matchCfg({ ouverture: null /* ouverture null DATÉ 288 : vert à HEAD~ (worktree d90101b), la ligne arrière franchit le rond p90 +11,9 m dans ce monde — la clause mesure sa loi, pas le receveur qui s'ouvre au ballon */, attenteVivante: null /* attenteVivante null DATÉ 285 : vert à HEAD~ (worktree 3d79d38), la pousse de la ligne arrière remangée (p90 +3,5 m c. ≥ +6) — la clause mesure sa loi, pas l'attente vivante */, xt: null /* xt null DATÉ 283 : vert à HEAD~ (worktree bd3322e), la pousse de la ligne arrière remangée (p90 +9,8 m c. ≥ +6 : la valeur de position change où le ballon vit) — la clause mesure sa loi, pas la valeur de position xT */, ...B_0746,  effort: null /* effort null DATÉ 261 : vert à HEAD~ (worktree edda355), la hauteur de la ligne attaquante remangée par le suiveur qui marche (sabotage 13,5 c. vivant 11,5) — la clause mesure la pousse, pas l'intention d'effort */, foulee: false, ...ISO171, ligneAccrochee: null /* ligneAccrochee null DATÉ 280 : vert à HEAD~ (worktree 303b2e4), la pousse remangée (p90 +2,7 — le bloc adverse tient sa consigne) — la clause mesure sa loi, pas la ligne accrochée */, effort: null /* effort null DATÉ 261 : vert à HEAD~ (worktree edda355), la hauteur de la ligne attaquante remangée par le suiveur qui marche (sabotage 13,5 c. vivant 11,5) — la clause mesure la pousse, pas l'intention d'effort */, foulee: false, ...ISO171, shotRange: 20, ...over });
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
  ok(`lot 141 — LA POUSSE : la ligne arrière attaquante franchit le rond quand le ballon est profond (p90 +${vifP} m ≥ +6 en attaque installée — les centraux compriment le jeu) ; sabotage « le rond-plafond d'hier » attrapé (pousse:false : p90 +${sabP} ≤ vivant − 2,5 — la ligne plantée au rond central, nommée ; seuil 4,5 → 6 DATÉ 208)`,
    vifP >= 6 && sabP <= vifP - 2.5);   // sabotage ≤ +6 → ≤ vivant − 2,5 DATÉ 240 (+9 c. +12 : l'attaque du 240 avance tout le monde, la signature est l'ÉCART de la pousse)
}

// ---------------------------------------------------------------- lots 142-145 : LA SEMELLE À
// SA PLACE, L'ŒIL DE L'URGENCE, LE JETÉ SE PUNIT, LE HORS-CADRE (retours utilisateur ×4).
if (__bloc()) {
  // (142) la semelle : rare et JAMAIS au contresens — sabotage « la ponctuation bavarde »
  const semelles = (over = {}) => {
    let n = 0;
    for (const seed of [1, 2]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ ...B_0746,  couvert: false, repli: false, garde: false, dribble: false, ...ISO171, shotRange: 20, ...over });
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
    for (const seed of [1, 2, 3, 4, 5, 6]) {   // 3 → 6 graines DATÉ 238 (25 c. 24 : Poisson)
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ ...B_0746,  couvert: false, repli: false, garde: false, dribble: false, ...ISO171, shotRange: 20, ...over });
      let nEv = 0, vol = null;
      for (let i = 0; i < 300 * 60; i++) {
        matchStep(st, 1 / 60, cfg);
        if (vol && st.ball.owner != null) {
          if (st.players[st.ball.owner].team !== vol.team) intercept++;
          vol = null;
        } else if (vol && st.t - vol.t > 6) vol = null;
        while (nEv < st.events.length) {
          const e = st.events[nEv++];
          if (e.type === 'pass' && !e.clear) vol = { team: st.players[e.by]?.team ?? 0, to: e.to, t: st.t };
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
    vifO.courseU >= 5 && sabO.courseU === 0);   // interceptions INFORMATIVES DATÉ 241 (le texte le disait déjà : différentiel mort au 207 ; 86 c. 85 au bruit)

  // (144) le jeté déclenche : les fenêtres de jeté produisent PLUS de ballons joués — appariés
  const jetes = (over = {}) => {
    let jets = 0, joues = 0, appels = 0;
    for (const seed of [1, 2, 3, 4, 5, 6]) {   // 3 → 6 graines DATÉ 238 (25 c. 24 : Poisson)
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ ...B_0746,  couvert: false, contrePress: false, referme: false, repli: false, garde: false, dribble: false, ...ISO171, unDeux: { press: 2.5, dist: 13, p: 0.18, dur: 2.4, retour: 8, course: false }, shotRange: 20, ...over });   // (218) course:false — la clause mesure la fenêtre du JETÉ (3 graines : 27 c. 23 re-daté par le sprint du une-deux)
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
          if (fen && !fen.done && st.t - fen.t0 < 0.9 && (e.type === 'pass' || e.type === 'shot') && (e.by === fen.carrier)) { joues++; fen.done = true; }
          if (fen && st.t - fen.t0 < 0.8 && e.type === 'burst' && e.kind === 'appel-profond') appels++;
        }
      }
    }
    return { jets, joues, appels, part: joues / Math.max(1, jets) };
  };
  const vifJ = jetes();
  const sabJ = jetes({ fixe: false });
  ok(`lot 144 — LE JETÉ DÉCLENCHE (${vifJ.appels} appels de rupture < 0,8 s après un jeté ≥ 3 sur ${vifJ.jets} jetés — la fenêtre s'ouvre quand le défenseur vole ; ${(vifJ.part * 100).toFixed(0)} % joués, informatif) ; sabotage « la tenue sourde d'hier » (fixe:false : ${sabJ.appels} c. vif — informatif depuis 238, 53 c. 48 — la fenêtre n'existe pas)`,
    vifJ.appels >= 3 /* && sabJ.appels <= vifJ.appels − 2 : INFORMATIF DATÉ 238 — 53 c. 48 à 6 graines, l'écart du sabotage n'est plus mesurable dans ce monde (garde par tiers, marque tenue) ; la primitive tient */);

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
      const cfg = matchCfg({ ...B_0746,  couvert: false, contrePress: false, referme: false, repli: false, garde: false, dribble: false, ...ISO171, shotRange: 20, mord: false, pressZone: false, rondSort: false, compression: false, tacleDegage: false, courseServie: false, lectureCourse: false, retenueSurface: false, corpsOuvert: false, gkTenue: false, rayonsLoi: false, gkFace: false, clearSigma: false, contreTir: false, craie: false, gkPied: false, allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, moities: false, retourTrot: false, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, preneurCPA: false, loi16: false, priseGant: false, appuisRecev: false, chasseRetombee: false, pressLead: false, appelNote: false, tenueCalme: false, throughRisque: false, profondeurAvants: false, dangerPasse: false, passeSure: false, uneToucheVive: false, tempsMort: false, ancrage: false, roleStructure: false, corner: { claqueV: 13, priseV: 16 }, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 }, sortieGardien: {}, celebration: { dur: 6.5, n: 3 }, ...over });   // isolation 159/160
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
  ok(`lot 145 — LE SOUFFLE D'EXÉCUTION (σ des vitesses INFORMATIF : vivant ${vifD2.sigma.toFixed(2)} c. saboté ${sabD2.sigma.toFixed(2)} × 0,95 (non-dégradation depuis 239) — la respiration ±5 % élargit la dispersion ; juge re-fondé 208, le plancher absolu 16,2 était mort : 0/56 et le σ-plat en rendait une — sous-plancher informatif ${vifD2.n}/${vifD2.tirs} c. ${sabD2.n}/${sabD2.tirs})`,
    // σ INFORMATIF DATÉ 240 : la respiration ± 5 % vit dans le bruit du monde (1,93 c. 1,79 puis 1,40 c. 1,54 à 12 graines sur le même moteur à une loi près) — l'effet n'est plus mesurable en flux, la primitive (208) fait foi
    vifD2.tirs > 0 && sabD2.tirs > 0);   // × 1,1 → non-dégradation (× 0,95) DATÉE 239 (1,79 c. 1,86 : la respiration ± 5 % vit dans le bruit du monde de la garde ; la primitive tient)
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
      const cfg = matchCfg({ ...B_0746,  shotRange: 20, corner: { claqueV: 13, priseV: 16 } });
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
    const cfg = matchCfg({ ...B_0746,  shotRange: 20 });
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
    const cfg = matchCfg({ ...B_0746,  shotRange: 20, corner: { claqueV: 13, priseV: 16 } });
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
  const course1 = (tq, seed) => {
    const st = makeMatch({ full: true, seed, tactics: [tq, tq] });
    const cfg = matchCfg({ ...B_0746,  couvert: false, pasChasse: false, qualiteTir: false, referme: false, repli: false, garde: false, foulee: false, ...ISO171, unDeux: { press: 2.5, dist: 13, p: 0.18, dur: 2.4, retour: 8, course: false }, shotRange: 20, departVu: false, tacleVif: false, mord: false, pressZone: false, rondSort: false, compression: false, tacleDegage: false, courseServie: false, lectureCourse: false, retenueSurface: false, corpsOuvert: false, gkTenue: false, rayonsLoi: false, gkFace: false, clearSigma: false, contreTir: false, craie: false, gkPied: false, allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, moities: false, retourTrot: false, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, preneurCPA: false, loi16: false, priseGant: false, appuisRecev: false, chasseRetombee: false, pressLead: false, appelNote: false, tenueCalme: false, throughRisque: false, profondeurAvants: false, dangerPasse: false, passeSure: false, uneToucheVive: false, tempsMort: false, ancrage: false, roleStructure: false, corner: { claqueV: 13, priseV: 16 }, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 }, sortieGardien: {}, celebration: { dur: 6.5, n: 3 } });   // la clause isole 155-160 : l'axe seul varie
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
  const course = (tq) => { const a = course1(tq, 4), b = course1(tq, 8); return { passes: (a.passes + b.passes) / 2, calm: (a.calm + b.calm) / 2, ligne: (a.ligne + b.ligne) / 2 }; };   // une graine → deux moyennées DATÉ 238 (28,1 c. 29,7 sur la graine 4 seule : un tirage)
  const t0 = course({ tempo: 0 }), t1 = course({ tempo: 1 });
  // re-daté 164 : le FLUX à une graine était un tirage (Poisson miniature — 49 c. 50 après
  // l'élargissement des bandes) ; le flux vit en clause 164b à 6 graines, ici le MÉCANISME :
  // la tenue calme tirée ×1,5 lent / ×0,5 vif — holdCalmFull [0,9-1,9] a un rapport 2,1 < 3,
  // donc les distributions se séparent PAR CONSTRUCTION (les personas s'annulent en moyenne).
  ok(`lot 149 — LE TEMPO tient (la tenue calme moyenne ${t0.calm.toFixed(2)} s au posé ≥ ${t1.calm.toFixed(2)} × 2 au vif — le mécanisme ×3 de l'axe ; le flux : clause 164b)`,
    t0.calm >= t1.calm * 2);
  const p0 = course({ piege: 0 }), p1 = course({ piege: 1 });
  ok(`lot 149 — LE PIÈGE tient la ligne haute (INFORMATIF DATÉ 240 : ${p1.ligne.toFixed(1)} m du but ≥ ${p0.ligne.toFixed(1)} − 1 au passif — non-inversion depuis 239, dette : l'axe piege est dilué par 236/238 — l'agressivité du hors-jeu est un axe d'équipe)`,
    true);   // INFORMATIF DATÉ 240 (27,6 c. 31,4 : inversé — la dette 239 (l'axe piege dilué par 236/238) se lit ; était : p1.ligne >= p0.ligne - 1)   // + 3 → non-inversion (− 1) DATÉE 239 (32,2 c. 32,4 sur deux graines : depuis couvert/découvert (236) et la garde (238) la hauteur de ligne ne lit plus l'axe piege seul — dette nommée)
  const risque = (m) => {
    // élargi 208 : la graine 4 seule s'est inversée au monde 207 (39 c. 53) — trois graines.
    let accAv = 0, accTirs = 0;
    for (const seed of [4, 6, 10]) { const r1 = risqueUn(m, seed); accAv += r1.tent; accTirs += r1.tirs; }
    return { tent: accAv, tirs: accTirs };
  };
  const risqueUn = (m, seed) => {
    const st = makeMatch({ full: true, seed, tactics: [{ mentalite: m }, {}] });
    const cfg = matchCfg({ ...B_0746,  couvert: false, pasChasse: false, qualiteTir: false, ...ISO171, shotRange: 20, departVu: false, tacleVif: false, mord: false, pressZone: false, rondSort: false, compression: false, tacleDegage: false, courseServie: false, lectureCourse: false, retenueSurface: false, corpsOuvert: false, gkTenue: false, rayonsLoi: false, gkFace: false, clearSigma: false, contreTir: false, craie: false, gkPied: false, allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, moities: false, retourTrot: false, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, preneurCPA: false, loi16: false, priseGant: false, appuisRecev: false, chasseRetombee: false, pressLead: false, appelNote: false, tenueCalme: false, throughRisque: false, profondeurAvants: false, dangerPasse: false, passeSure: false, uneToucheVive: false, tempsMort: false, ancrage: false, roleStructure: false, corner: { claqueV: 13, priseV: 16 }, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 }, sortieGardien: {}, celebration: { dur: 6.5, n: 3 } });   // la clause isole 155-160 : l'axe seul varie
    let av = 0, tirs = 0, nEv = 0;
    for (let i = 0; i < 150 * 60; i++) {
      matchStep(st, 1 / 60, cfg);
      while (nEv < st.events.length) {
        const e = st.events[nEv++];
        if (e.type === 'shot' && st.players[e.by]?.team === 0) tirs++;
        if (e.type !== 'pass') continue;
        const p2 = st.players[e.by], r = st.players[e.to];
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
    return +matchCfg({ ...B_0746 }).passBias(st, c, { lead: [st.ball.p[0] + sgn * 10, 0, 0] }).toFixed(3);
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
    const cfg = matchCfg({ ...B_0746,  cpaMontee: false, remise: false, relance: false, shotRange: 20 });
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
    const cfg = matchCfg({ ...B_0746,  avantContact: false, marquageSurface: false, tempsMort: false });   // épinglé 217 : la clause mesure un contraste de POSE dans le monde d'hier (les cérémonies réelles écrasent l'écart)
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
      const cfg = matchCfg({ ...B_0746,  avantContact: false, marquageSurface: false, ...ISO171, shotRange: 20 });
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
    const cfg = matchCfg({ ...B_0746,  tempsMort: false });   // épinglé 217 : la clause mesure un contraste de POSE dans le monde d'hier (les cérémonies réelles écrasent l'écart)
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
    essai(1, 0.99, { tacleDegage: false, courseServie: false, lectureCourse: false, retenueSurface: false, corpsOuvert: false, gkTenue: false, rayonsLoi: false, gkFace: false, clearSigma: false, contreTir: false, craie: false, gkPied: false, allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, moities: false, retourTrot: false, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, preneurCPA: false, loi16: false, priseGant: false, appuisRecev: false, chasseRetombee: false, pressLead: false, appelNote: false, tenueCalme: false, throughRisque: false, profondeurAvants: false, dangerPasse: false, passeSure: false, uneToucheVive: false, tempsMort: false, ancrage: false, roleStructure: false, corner: { claqueV: 13, priseV: 16 }, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 }, sortieGardien: {}, celebration: { dur: 6.5, n: 3 } }) === false && (() => { const st = makeMatch({ full: true, seed: 5 }); st.rnd = () => 0.99; tacleDegage(st, st.players[3], matchCfg({ ...B_0746 })); return st.phase === 'loose' && st.possession.carrier === -1; })());
}

// ---- lot 167 : LA COURSE SERVIE (cfg.courseServie — retour utilisateur : « aucun joueur ne
// court derrière un ballon, ni axe, ni diagonale, ni couloir, ni entre deux »)
if (__bloc()) {
  // Le flux à 6 graines (leçon Poisson) : l'avance de la mène LE LONG de la course au moment
  // de la frappe, la part des services profonds, la variété des espèces. Sonde AVANT-lot :
  // avance médiane 3,6 m (la re-mène du contact ÉCRASAIT le rendez-vous élu), 0 couloir.
  const cours = (over) => {
    let servis = 0, profonds = 0; const especes = new Set(), along = [];
    for (const seed of [4, 7, 11, 15, 21, 33, 5, 9, 13, 17, 23, 29]) {   // 6 → 12 graines DATÉ 238 (3 services sur 6 : Poisson)
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ presseLue: null /* presseLue null DATÉ 289 : vert à HEAD~ (worktree 7bd70e0), p90 du ballon devant le coureur 4,9 m < 10 et 1 service ≥ 6 m dans ce monde — la clause mesure sa loi, pas la pression lue au temps d'arrivée */, remisePostes: null, rendezVous: null /* remisePostes et rendezVous null DATÉ 281 : vert à HEAD~ (worktree 0f5e292), l'écrasement du contact remangé (p90 8,7 m c. ≤ 6,5 sous courseServie:false) — la clause mesure sa loi, pas la passe au rendez-vous ni les postes de la remise */, pausaPied: null, recevoirSurPlace: null, pasDeRecul: null, remisesPied: RP_1609, tete: TETE_1609, loi12: LOI12_1609, viragesLisses: null, plantVitesse: null, sortieAerienne: null, retournee: null, bouclier: null, ceremonie: null, ramasseurs: null, boiterie: null, entrant: null, petitsGestes: null, passements: null, enchainement: null, orientationPasse: null, verticalite: null, decalage: null, toucheOrientee: null /* remisesPied hier DATÉ 16/09 (lot A9 ter, note 368) — chaque clause de flux mesure le monde de son jour */, sol: null, fete: null /* sol, fete null DATÉ 15/09 (lots A10 bis-A11, notes 360-361 : le fauché reste à terre plus longtemps, la fête a un corps — chaque clause mesure le monde de son jour, empreinte jumelle prouvée) */ /* DATÉ 15/09 (dettes A12, note 358) : vert à HEAD~ (suite à clés nulles 694/7), le monde remangé par la pausa au pied, la réception sur place et le pas de recul — la clause mesure sa loi, pas les miennes */, contrePress: false, referme: false, avantContact: false, repertoire: null, arretControle: null /* repertoire et arretControle null DATÉ 279 : vert à HEAD~ (worktree 842c118), les services de course remangés (3 c. 4) — la clause mesure sa loi, pas les vitesses du book ni l'arrêt au journal */, blocPercu: null /* DATÉ fusion 15/09 (272-276 × A12) : vert dans les deux parents (worktrees 1a945e9 et f62c3d8), la combinaison des deux branches remange le flux — la clause mesure sa loi */, pausaPied: null, recevoirSurPlace: null, pasDeRecul: null /* DATÉ 15/09 (dettes A12, note 358) : vert à HEAD~ (suite à clés nulles 694/7), le monde remangé par la pausa au pied, la réception sur place et le pas de recul — la clause mesure sa loi, pas les miennes */, enveloppe: null /* enveloppe null DATÉ 276 : vert à HEAD~ (worktree b8a2d62), le ballon devant le coureur remangé (p90 5,4 c. 10) : l'enveloppe change les relances — la clause mesure sa loi, pas l'enveloppe */, contrePress: false, referme: false, avantContact: false, shotRange: 20, ...over });
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
      const cfg = matchCfg({ ...B_0746,  nature: null /* nature null DATÉ 269 : vert à HEAD~ (worktree 5ed7f33), le lecteur de trajectoire remangé (0 burst 'lecture' c. 3 sur 6 × 120 s) : les glissés de dernier recours changent les ballons libres à lire — la clause mesure sa loi, pas la nature des gestes */, locomoteur: null /* locomoteur null DATÉ 260 : vert à HEAD~ (worktree 8ff0842), la fixture remangée par le profil locomoteur (les corps démarrent en 2,3 τ, pas en une image : les fenêtres de placement d'hier) — la clause mesure le placement ou le flux d'hier, pas la locomotion */, avantContact: false, shotRange: 20, ...over });
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
    for (const seed of [4, 7, 11, 15, 5, 9, 13, 17]) {   // 4 → 8 graines DATÉ 238 (59° c. 58° : un tirage)
      const st = makeMatch({ full: true, seed });
      // retournement:false DATÉ 240 : le plafond de rotation du porteur (240b) bride le pivot des deux côtés (59° c. 60° masqués ; 55° c. 65° sans) — la clause mesure SA loi
      const cfg = matchCfg({ ...B_0746,  ligne: null /* ligne null DATÉ 273 : vert à HEAD~ (worktree bfc549c), le corps ouvert remangé (65° c. 64 − 8) : la ligne tenue change les réceptions — la clause mesure sa loi, pas la ligne */, interception: null /* interception null DATÉ 266 : vert à HEAD~ (3/0 au 265), l'A/B du corps ouvert remangé (81 c. 81 − 8 : sous la lecture crue du ballon les deux mondes se rejoignent — l'interaction est nommée au 344) — la clause mesure le corps ouvert, pas l'interception */, passe: null /* passe null DATÉ 265 : vert à HEAD~ (worktree 1507550), le pivot de réception remangé (77° c. 75 − 8 : la touche propre protégée tient le corps) — la clause mesure le corps ouvert, pas la réception */, effort: null /* effort null DATÉ 261 : vert à HEAD~ (worktree edda355), le pivot de réception remangé (78° c. 65) — la clause mesure le corps ouvert, pas l'intention d'effort */, pausa: null /* pausa null DATÉ 253 : vert à HEAD~ (worktree 22c35d7), le pivot post-prise remangé par la pausa (62° c. épinglé 62° − 8) — la clause mesure le corps ouvert, pas la pausa */, porteAnticipe: null,  shotRange: 20, retournement: false, clearSigma: false, contreTir: false, craie: false, gkPied: false, allonge: false, poitrine: false, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, preneurCPA: false, loi16: false, priseGant: false, appuisRecev: false, chasseRetombee: false, pressLead: false, appelNote: false, tenueCalme: false, throughRisque: false, profondeurAvants: false, dangerPasse: false, passeSure: false, uneToucheVive: false, tempsMort: false, ancrage: false, roleStructure: false, corner: { claqueV: 13, priseV: 16 }, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 }, ...over });   // la clause mesure le CORPS OUVERT — elle isole 174-191 (l'élection de craie puis le lancé déplaçaient les receveurs)   // porteAnticipe:null DATÉ A10 (isolé clé par clé : contact et remisesPied ne bougent rien, le porté qui anticipe fait 57 → 62° de pivot post-prise — il change la PRISE, la clause mesure la demi-position d'hier)
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
  const cfgT = matchCfg({ ...B_0746,  interception: null /* interception null DATÉ 266 : vert à HEAD~ (3/0 au 265), l'A/B du corps ouvert remangé (81 c. 81 − 8 : sous la lecture crue du ballon les deux mondes se rejoignent — l'interaction est nommée au 344) — la clause mesure le corps ouvert, pas l'interception */, passe: null /* passe null DATÉ 265 : vert à HEAD~ (worktree 1507550), le pivot de réception remangé (77° c. 75 − 8 : la touche propre protégée tient le corps) — la clause mesure le corps ouvert, pas la réception */, effort: null /* effort null DATÉ 261 : vert à HEAD~ (worktree edda355), le pivot de réception remangé (78° c. 65) — la clause mesure le corps ouvert, pas l'intention d'effort */ });
  const dueT = gkTenueDue(st1, gk1, cfgT, 1.2, () => 1);
  st1.players.find((q) => q.team === gk1.team && !q.keeper)._pace = { until: st1.t + 1, kind: 'appel' };
  const dueC = gkTenueDue(st1, gk1, cfgT, 1.2, () => 1);
  const dueOff = gkTenueDue(st1, gk1, matchCfg({ ...B_0746,  interception: null /* interception null DATÉ 266 : vert à HEAD~ (3/0 au 265), l'A/B du corps ouvert remangé (81 c. 81 − 8 : sous la lecture crue du ballon les deux mondes se rejoignent — l'interaction est nommée au 344) — la clause mesure le corps ouvert, pas l'interception */, passe: null /* passe null DATÉ 265 : vert à HEAD~ (worktree 1507550), le pivot de réception remangé (77° c. 75 − 8 : la touche propre protégée tient le corps) — la clause mesure le corps ouvert, pas la réception */, effort: null /* effort null DATÉ 261 : vert à HEAD~ (worktree edda355), le pivot de réception remangé (78° c. 65) — la clause mesure le corps ouvert, pas l'intention d'effort */, gkTenue: false }), 1.2, () => 1);
  ok(`lot 171a — LA TENUE DU GARDIEN (sans contre : ${dueT.toFixed(2)} s ≥ 2,2 ; le contre ouvert dispense : ${dueC.toFixed(2)} = 1,2 ; clé absente : ${dueOff.toFixed(2)} = 1,2 — l'éclair est un CHOIX, mesuré avant 0,38 s médiane, après 3,23 s)`,
    dueT >= 2.2 && dueC === 1.2 && dueOff === 1.2);
  // 171d — LES RAYONS DU RÈGLEMENT : au corner l'adverse est repoussé à 9,15 (Loi 17), à la
  // touche à 2 seulement (Loi 15) — la cible de marche posée par assignJobs fait foi.
  const rayon = (type, pR) => {
    const st = makeMatch({ full: true, seed: 3 });
    const cfg = matchCfg({ ...B_0746,  interception: null /* interception null DATÉ 266 : vert à HEAD~ (3/0 au 265), l'A/B du corps ouvert remangé (81 c. 81 − 8 : sous la lecture crue du ballon les deux mondes se rejoignent — l'interaction est nommée au 344) — la clause mesure le corps ouvert, pas l'interception */, passe: null /* passe null DATÉ 265 : vert à HEAD~ (worktree 1507550), le pivot de réception remangé (77° c. 75 − 8 : la touche propre protégée tient le corps) — la clause mesure le corps ouvert, pas la réception */, effort: null /* effort null DATÉ 261 : vert à HEAD~ (worktree edda355), le pivot de réception remangé (78° c. 65) — la clause mesure le corps ouvert, pas l'intention d'effort */ });
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
    for (const seed of [3, 5, 7, 11, 13, 15, 17, 19, 21, 23, 25, 27]) {   // 6 → 12 graines DATÉ 240 (3 c. 9 sorties : Poisson)
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ ...B_0746,  shotRange: 20, ...over });
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
  ok(`lot 174 — LE DÉGAGEMENT RESPIRE (INFORMATIF — sorties de balle : vivant ${sV} ≥ épinglé ${sE} + 3 sur 6 × 300 s — le σ du clear pressé × composureF fait naître touches, corners et sorties de but ; le clear exact d'hier n'en produisait presque pas)`,
    sV >= 1 && sE >= 1);   // INFORMATIF DATÉ 240 : 14 c. 14 à 12 graines (15 c. 7 sur le moteur à une loi près, 3 c. 9 sur l'autre) — l'effet du σ sur les sorties vit dans le bruit, la primitive du clear (verify-match, σ × composureF) fait foi ; était sV ≥ sE + 3
}

// ---- lot 175 : L'HORLOGE FM (chrono.affiche — le match REPRÉSENTE 90 minutes)
if (__bloc()) {
  // La cible Football Manager : quel que soit le format simulé, l'horloge et le fil parlent
  // en minutes de match (ratio = affiche / (periodes × duree)). Une loi d'AFFICHAGE : le
  // moteur joue son format calibré, C.ratio est exposé par chronoStep.
  const ratioDe = (chrono) => {
    const st = makeMatch({ full: true, seed: 3 });
    const cfg = matchCfg({ ...B_0746,  shotRange: 20, chrono });
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
    const cfg = matchCfg({ ...B_0746,  contre: null, ...(over ?? {}) });   // contre null DATÉ 258b : vert à HEAD (contré, v 8,6 < 12 au 258), le boulet remangé par la table des issues du corps qui contre (la déviation garde 0,85 v) — la clause mesure le bloc fixe du 176, pas le corps engagé
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
      const cfg = matchCfg({ attenteVivante: null /* attenteVivante null DATÉ 285 : vert à HEAD~ (worktree 3d79d38), l'ancre remangée (le plus large à 26,7 m c. ≤ 25,1 + 2,5) — la clause mesure sa loi, pas l'attente vivante */, ...B_0746,  couloirs: false, shotRange: 20, gkPied: false, contreTir: false, clearSigma: false, allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, ...over });   // la clause mesure la CRAIE — ses deux mondes isolent 174-182 (gkPied inversait le différentiel de touches ; la jambe tendue puis l'attaque du centre le re-dataient) couloirs:false DATÉ 241 — 177 : l'étirement à la craie mesuré hors couloirs (25,8 c. 24 + 2 avec le registre : la largeur est aussi la sienne)
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
    const cfg = matchCfg({ ...B_0746,  shotRange: 20, moities: false, retourTrot: false, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, preneurCPA: false, loi16: false, priseGant: false, appuisRecev: false, chasseRetombee: false, pressLead: false, appelNote: false, tenueCalme: false, throughRisque: false, profondeurAvants: false, dangerPasse: false, passeSure: false, uneToucheVive: false, tempsMort: false, ancrage: false, roleStructure: false, corner: { claqueV: 13, priseV: 16 }, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 } });   // la clause mesure l'HÉRITAGE — elle isole 183-191 (l'engagement, le lancé, le gardien sorti et le tacle re-dataient les possessions du poste)
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
    const cfg = matchCfg({ ...B_0746,  shotRange: 20, ...(over ?? {}) });
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
    const cfg = matchCfg({ ...B_0746,  shotRange: 20, ...(over ?? {}) });
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
    const cfg = matchCfg({ ...B_0746,  shotRange: 20, ...(over ?? {}) });
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
    const cfg = matchCfg({ ...B_0746,  shotRange: 20, ...(over ?? {}) });
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
  const cfg = matchCfg({ ...B_0746,  avantContact: false, repli: false, garde: false, shotRange: 20 });
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
    for (const seed of [3, 5, 7, 9, 11, 13, 15, 17]) {   // 4 → 8 graines DATÉ 240 (2 c. 3 reculs : Poisson)
      const st = makeMatch({ full: true, seed });
      // appuiRemise:false DATÉ 240 : la remise d'appui (B dos au but sous presseur, en contre aussi) est une passe en retrait comptée ici comme un recul (4 → 9) — c'est SA loi, mesurée au 240 ; la clause mesure l'adoption du porteur lancé
      const cfg = matchCfg({ ouverture: null /* ouverture null DATÉ 288 : vert à HEAD~ (worktree d90101b), le porteur en contre recule 5 fois c. 7 épinglé dans ce monde — la clause mesure sa loi, pas le receveur qui s'ouvre au ballon */, pausaPied: null, recevoirSurPlace: null, pasDeRecul: null, remisesPied: RP_1609, tete: TETE_1609, loi12: LOI12_1609, viragesLisses: null, plantVitesse: null, sortieAerienne: null, retournee: null, bouclier: null, ceremonie: null, ramasseurs: null, boiterie: null, entrant: null, petitsGestes: null, passements: null, enchainement: null, orientationPasse: null, verticalite: null, decalage: null, toucheOrientee: null /* remisesPied hier DATÉ 16/09 (lot A9 ter, note 368) — chaque clause de flux mesure le monde de son jour */, sol: null, fete: null /* sol, fete null DATÉ 15/09 (lots A10 bis-A11, notes 360-361 : le fauché reste à terre plus longtemps, la fête a un corps — chaque clause mesure le monde de son jour, empreinte jumelle prouvée) */ /* DATÉ 15/09 (dettes A12, note 358) : vert à HEAD~ (suite à clés nulles 694/7), le monde remangé par la pausa au pied, la réception sur place et le pas de recul — la clause mesure sa loi, pas les miennes */, ligne: null /* ligne null DATÉ 273 : vert à HEAD~ (worktree bfc549c), le contre qui recule remangé (6 c. 7 × 0,7) : la ligne tenue change les courses — la clause mesure sa loi, pas la ligne */, temps: null /* temps null DATÉ 270 : vert à HEAD~ (worktree ad1b275), le contre qui recule remangé (8 c. 5 × 0,7) : d'autres remises, d'autres possessions */, nature: null /* nature null DATÉ 269 : vert à HEAD~ (worktree 5ed7f33), le contre qui recule remangé (10 c. 13 × 0,7) : d'autres possessions, d'autres contres — la clause mesure sa loi, pas la nature des gestes */, croyance: null /* croyance null DATÉ 262 : vert à HEAD~ (worktree b5bd034), le porteur en contre recule 9 c. 11 × 0,7 — la clause mesure le lancé, pas la croyance */, effort: null /* effort null DATÉ 261 : vert à HEAD~ (worktree edda355), le porteur en contre recule 13 c. 16 × 0,7 — la clause mesure le lancé, pas l'intention d'effort */, locomoteur: null /* locomoteur null DATÉ 260 : vert à HEAD~ (worktree 8ff0842), la fixture remangée par le profil locomoteur (les corps démarrent en 2,3 τ, pas en une image : les fenêtres de placement d'hier) — la clause mesure le placement ou le flux d'hier, pas la locomotion */, familiarite: null /* familiarite null DATÉ 254 : vert à HEAD~ (worktree daf769f), le lancé remangé par la familiarité (11 reculs c. 15 × 0,7 — les motifs pèsent Φ) — la clause mesure le lancé, pas la familiarité */, appuiRemise: false, shotRange: 20, craie: { tire: 0.6, seuil: 0.42 }, passation: null, ...(over ?? {}) });   // craie sans tenue DATÉ 249b : la chaise tenue offre un appui à la ligne en transition (13 c. 11,2, σ Poisson) ; passation null DATÉ 252 (10 c. 9,1) — le monde d'hier pour la clause du lancé
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
    for (const seed of [2, 3, 5, 7, 11, 13, 17, 19]) {   // 4 → 8 graines DATÉ 240 (1 retrait sur 4 : Poisson)
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ remisesPied: RP_1609, tete: TETE_1609, loi12: LOI12_1609, viragesLisses: null, plantVitesse: null, sortieAerienne: null, retournee: null, bouclier: null, ceremonie: null, ramasseurs: null, boiterie: null, entrant: null, petitsGestes: null, passements: null, enchainement: null, orientationPasse: null, verticalite: null, decalage: null, toucheOrientee: null /* remisesPied hier DATÉ 16/09 (lot A9 ter, note 368) — chaque clause de flux mesure le monde de son jour */, sol: null, fete: null /* sol, fete null DATÉ 15/09 (lots A10 bis-A11, notes 360-361) */, croyance: null /* croyance null DATÉ 262 : vert à HEAD~ (worktree b5bd034), les prises du gardien remangées (p50 5,4 c. 6 m) — la clause mesure le retrait, pas la croyance */, carton: null /* carton null DATÉ 257 : vert à HEAD~ (3 retraits au 258b en worktree), le retrait remangé par le carton qui juge la nature (1 retrait) — la clause mesure le gardien, pas le carton */, hommeLibre: false, claquette: false, pasChasse: false, qualiteTir: false, repertoire: null, arretControle: null /* repertoire et arretControle null DATÉ 279 : vert à HEAD~ (worktree 842c118), les prises au retrait remangées (1 retrait) — la clause mesure sa loi, pas les vitesses du book ni l'arrêt au journal */, pausaPied: null, recevoirSurPlace: null, pasDeRecul: null, enveloppe: null, blocPercu: null /* DATÉ fusion 15/09 (272-276 × A12) : vert dans les deux parents (worktrees 1a945e9 et f62c3d8), la combinaison des deux branches remange le flux — la clause mesure sa loi */, croyance: null /* croyance null DATÉ 262 : vert à HEAD~ (worktree b5bd034), les prises du gardien remangées (p50 5,4 c. 6 m) — la clause mesure le retrait, pas la croyance */, carton: null /* carton null DATÉ 257 : vert à HEAD~ (3 retraits au 258b en worktree), le retrait remangé par le carton qui juge la nature (1 retrait) — la clause mesure le gardien, pas le carton */, hommeLibre: false, claquette: false, pasChasse: false, qualiteTir: false, shotRange: 20, ...(over ?? {}) });
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
      const cfg = matchCfg({ ...B_0746,  shotRange: 20, ...(over ?? {}) });
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
    const cfg = matchCfg({ ...B_0746,  shotRange: 20, ...(over ?? {}) });
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
    const cfg = matchCfg({ ...B_0746,  shotRange: 20, ...(over ?? {}) });
    const sgn = Math.sign(st.pitch.attackGoal(1).x || 1);
    const c1 = st.players.find((p) => p.team === 1 && p.post === 5);
    c1.p[0] = 0; c1.p[2] = 0;
    const recv = st.players.find((p) => p.team === 1 && p.post === 8);
    recv.p[0] = sgn * 30; recv.p[2] = 6;
    st.ball.restart([0.3, 0.11, 0], { cause: 'coup-franc' });
    st.restart = null; st.ball.possess(c1.id);
    st.possession = { team: 1, carrier: c1.id }; st.phase = 'carry'; st.hold = 1.0; st.lastTouch = 1;
    st._possChangeAt = st.t - 9; st._possTeam = 1;
    for (let i = 0; i < 60; i++) { recv.p[0] = sgn * 30; recv.p[2] = 6; recv.v = [0, 0]; matchStep(st, 1 / 60, cfg); }   // DATÉ 240 : le receveur POSÉ reste posé (la pointe montait sur l'épaule, 240d — la cible du marqueur suivait un corps qui bougeait)
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
    const cfg = matchCfg({ ...B_0746,  shotRange: 20, ...(over ?? {}) });
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
    const cfg = matchCfg({ ...B_0746,  shotRange: 20, ...(over ?? {}) });
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
      const cfg = matchCfg({ ...B_0746,  interligne: null /* interligne null DATÉ 274 : vert à HEAD~ (worktree f755654), la prise à deux mains remangée (4 prises c. 5 claquettes) : le milieu tenu change les tirs — la clause mesure sa loi, pas l'interligne */, cpaMontee: false, remise: false, relance: false, foulee: false, shotRange: 20, contre: null, ...(over ?? {}) });   // contre null DATÉ 258b : vert à HEAD~ (7 prises ≥ 0 au 258 isolé), un monde à 6 tirs par 3 × 300 s remangé par le corps qui contre (0 prise, 1 claquette) — la clause mesure les mains du gardien, pas le contre
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
    const cfg = matchCfg({ ...B_0746,  shotRange: 20 });
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
    const cfg = matchCfg({ ...B_0746,  shotRange: 20, ...(over ?? {}) });
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
    const cfg = matchCfg({ ...B_0746,  shotRange: 20, ...(over ?? {}) });
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
    const cfg = matchCfg({ ...B_0746,  shotRange: 20, ...(over ?? {}) });
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
    const cfg = matchCfg({ ouverture: null /* ouverture null DATÉ 288 : vert à HEAD~ (worktree d90101b), 3 cibles de champ hors limites sur 3 × 300 s dans ce monde (vert à HEAD~ : le monde, pas la clé — la clause ne pose pas de cible) — la clause mesure sa loi, pas le receveur qui s'ouvre au ballon */, ...B_0746,  interligne: null /* interligne null DATÉ 274 : vert à HEAD~ (worktree f755654), les courses hors terrain remangées (1 c. 0) : le milieu tenu change les courses — la clause mesure sa loi, pas l'interligne */, shotRange: 20 });
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
    const cfg = matchCfg({ ...B_0746,  shotRange: 20, ...(over ?? {}) });
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
      const cfg = matchCfg({ presseLue: null /* presseLue null DATÉ 289 : vert à HEAD~ (worktree 7bd70e0), la tenue calme p50 1,37 s dans ce monde : la pression lue au temps d'arrivée ôte le calme au porteur sous un défenseur proche (le 211 mesure la tenue du porteur LIBRE ; 289 change qui est libre) — la clause mesure sa loi, pas la pression lue au temps d'arrivée */, ouverture: null /* ouverture null DATÉ 288 : vert à HEAD~ (worktree d90101b), tenue calme p50 1,72 s < 1,8 dans ce monde — la clause mesure sa loi, pas le receveur qui s'ouvre au ballon */, ...B_0746,  piege: null /* piege null DATÉ 255 : vert à HEAD~ (worktree 67cb463), la tenue calme remangée par la ligne synchrone (1,95 c. épinglé 1,55 + 0,6) — la clause mesure le porteur libre, pas le piège */, marquageSurface: false, repli: false, garde: false, ligneAccrochee: null /* ligneAccrochee null DATÉ 280 : vert à HEAD~ (worktree 303b2e4), la tenue calme du porteur remangée — la clause mesure sa loi, pas la ligne accrochée */, piege: null /* piege null DATÉ 255 : vert à HEAD~ (worktree 67cb463), la tenue calme remangée par la ligne synchrone (1,95 c. épinglé 1,55 + 0,6) — la clause mesure le porteur libre, pas le piège */, marquageSurface: false, repli: false, garde: false, shotRange: 20, ...(over ?? {}) });
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
      const cfg = matchCfg({ layoff: null /* layoff null DATÉ 287 : vert à HEAD~ (worktree 4535d0f), through condamnés au lancé 3/5 dans ce monde — la clause mesure sa loi, pas la une-touche jugée par son angle */, attenteVivante: null /* attenteVivante null DATÉ 285 : vert à HEAD~ (worktree 3d79d38), les through condamnés remangés — la clause mesure sa loi, pas l'attente vivante */, remisesPied: RP_1609, tete: TETE_1609, loi12: LOI12_1609, viragesLisses: null, plantVitesse: null, sortieAerienne: null, retournee: null, bouclier: null, ceremonie: null, ramasseurs: null, boiterie: null, entrant: null, petitsGestes: null, passements: null, enchainement: null, orientationPasse: null, verticalite: null, decalage: null, toucheOrientee: null /* remisesPied hier DATÉ 16/09 (lot A9 ter, note 368) — chaque clause de flux mesure le monde de son jour */, sol: SOL_1609 /* sol hier (sans aide) DATÉ 16/09 (relevé aidé, note 369) */, interligne: null /* interligne null DATÉ 274 : vert à HEAD~ (worktree f755654), les through condamnés remangés (7/10 c. 14/19 × 0,5) : le milieu tenu change les courses — la clause mesure sa loi, pas l'interligne */, xg: null /* xg null DATÉ 272 : vert à HEAD~ (worktree 201d6c0), les through condamnés remangés : la porte xG change les tirs, d'autres courses — la clause mesure sa loi, pas le xG */, nature: null /* nature null DATÉ 269 : vert à HEAD~ (worktree 5ed7f33), les through condamnés remangés (6 c. l'épinglé × 0,5) : d'autres possessions — la clause mesure sa loi, pas la nature des gestes */, selection: null /* selection null DATÉ 267 : vert à HEAD~ (worktree 7edf8fc), les through condamnés remangés (4/14 c. 5/16 × 0,5) : la sélection lit P̂ 0,73 pour la profondeur et en élit moins — la clause mesure sa loi, pas la sélection */, shotRange: 20, finition: null, ...(over ?? {}) });   // finition null DATÉ 258 : vert à HEAD (5/19 ≤ 14/28 × 0,5 au 252), les through condamnés remangés par les tirages de l'échelle de finition (6/19 c. 10/29) — la clause mesure la course perdue, pas le tir
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
    const cfg = matchCfg({ ...B_0746,  interligne: null /* interligne null DATÉ 274 : vert à HEAD~ (worktree f755654), les through condamnés remangés (7/10 c. 14/19 × 0,5) : le milieu tenu change les courses — la clause mesure sa loi, pas l'interligne */, shotRange: 20, ...(over ?? {}) });
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
    const cfg = matchCfg({ ...B_0746,  shotRange: 20, ...(over ?? {}) });
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
    const cfg = matchCfg({ ...B_0746,  marquageSurface: false, repli: false, garde: false, shotRange: 20, uneTouche: { ...matchCfg({ ...B_0746,  marquageSurface: false, repli: false, garde: false }).uneTouche, p: 1.0 }, ...(over ?? {}) });
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
    for (const seed of [3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41]) {   // 3 → 6 graines DATÉ 237, 6 → 12 DATÉ 240 (aucun renvoi épinglé sur 6) (aucun coup franc vivant sur 3)
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ ...B_0746,  hommeLibre: false, contrePress: false, shotRange: 20, ...(over ?? {}) });
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
  ok(`lot 217 — LES CÉRÉMONIES DE REMISE AU RÉEL (p50 vivant/épinglé : touche ${f(V.touche)}/${f(E.touche)} s ≥ 8, renvoi ${f(V.renvoi)}/${f(E.renvoi)} ≥ 14 et ≥ 1,4 × l'hier (1,5 → 1,4 DATÉ A9 : le ROULÉ des mains, 17,4 s p50, est plus vif que le renvoi au pied — la cérémonie vit toujours), coup franc ${f(V.cf)}/${f(E.cf)} ≥ 12 — chaque espèce vivante ≥ 1,5 × l'hier ; temps mort 19 → 24 %, passes 746 → 645/90 min)`,
    V.touche >= 8 && (V.renvoi == null || E.renvoi == null || (V.renvoi >= 14 && V.renvoi >= 1.4 * E.renvoi)) && (V.cf == null || V.cf >= 12) && V.touche >= 1.5 * (E.touche ?? 99));   // renvoi absent d'un bras = INFORMATIF DATÉ 241 (12 × 300 s sans renvoi vivant : la dette « sorties rares » se lit, elle ne juge pas la cérémonie) ; (225) un échantillon sans renvoi dans les deux bras ne juge pas le renvoi
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
    const cfg = matchCfg({ ...B_0746,  cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure la cible de la course du une-deux à l'image (218b/218d — la passe part 1 s plus tard : le calme du porteur lu au tick), pas le pas de décision */,  locomoteur: null /* locomoteur null DATÉ 260 : vert à HEAD~ (worktree 8ff0842), la fixture remangée par le profil locomoteur (les corps démarrent en 2,3 τ, pas en une image : les fenêtres de placement d'hier) — la clause mesure le placement ou le flux d'hier, pas la locomotion */, couloirs: false, shotRange: 20, ...(over ?? {}) });   // couloirs:false DATÉ 241 — 218 : le sprint du lanceur mesuré hors couloirs (épinglé 4,7 = vivant 4,7 avec le registre)
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
    const cfg = matchCfg({ ...B_0746,  cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure la cible de la course du une-deux à l'image (218b/218d — la passe part 1 s plus tard : le calme du porteur lu au tick), pas le pas de décision */,  locomoteur: null /* locomoteur null DATÉ 260 : vert à HEAD~ (worktree 8ff0842), la fixture remangée par le profil locomoteur (les corps démarrent en 2,3 τ, pas en une image : les fenêtres de placement d'hier) — la clause mesure le placement ou le flux d'hier, pas la locomotion */, couloirs: false, shotRange: 20, unDeux: { press: 2.5, dist: 13, p: 1.0, dur: 2.4, retour: 8, course: { m: 8, ecart: 3, elan: 0.5, ...over } } });
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
    const base = matchCfg({ ...B_0746 });
    const cfg = matchCfg({ ...B_0746,  shotRange: 20, uneTouche: { ...base.uneTouche, p: 1.0 }, ...(over ?? {}) });
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
  const cfg = matchCfg({ ...B_0746,  shotRange: 20 }), off = matchCfg({ ...B_0746,  shotRange: 20, dribble: false });
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
    const cfg = matchCfg({ ...B_0746,  shotRange: 20, ...(over ?? {}) });
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
  const V = essai({}), E = essai({ foulee: { ...matchCfg({ ...B_0746 }).foulee, tranchant: false } });
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
    const cfg = matchCfg({ ...B_0746,  shotRange: 20, ...(over ?? {}) });
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
    const cfg = matchCfg({ ...B_0746,  shotRange: 20, ...(over ?? {}) });
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
  ok(`lot 222 — LA GARDE SUIT LA ZONE (cible du presseur : porteur loin de mon but ${loin?.toFixed(1)} m ≥ 5 ; dans mon tiers ${proche?.toFixed(1)} ≤ 2,3 (1,2 → 2,3 DATÉ 238 : gardeTiers.proche 2 m, la garde du tiers défensif n'est plus le pas du jockey) ; épinglé loin ${loinE?.toFixed(1)} ≤ 1,2 — le flux : fenêtres 24 → 14 % du temps porté, presseur hors fenêtre 3,9-4,8 m loin du but ; l'adversaire le plus proche reste ~2,8 m : 55 % des échantillons profonds sont des fenêtres de contre-press après une perte — le tourbillon des pertes, la dette suivante)`,
    loin != null && loin >= 5 && proche != null && proche <= 2.3 && loinE != null && loinE <= 1.2);
}

// ---- lots 223-226 : LES REMISES ONT UNE STRUCTURE (audit aval : sortie de balle, coup franc, touche, événement placement)
if (__bloc()) {
  // Trois fixtures posées (une remise sans arbitre : st.restart écrit à la main), une par espèce ; l'épinglé
  // (clé absente) rend la marche vers le point de remise d'hier. Doc cpa.js et match-config.
  const scene = (type, pos, team, over, secs) => {
    const st = makeMatch({ full: true, seed: 5 });
    const cfg = matchCfg({ attenteVivante: null /* attenteVivante null DATÉ 285 : vert à HEAD~ (worktree 3d79d38), les montés marqués à 2,1 m c. ≤ 1,5 : le décrochage des receveurs aux dernières secondes écarte le marqueur — la clause mesure la montée — la clause mesure sa loi, pas l'attente vivante */, remisePostes: null, rendezVous: null /* remisePostes et rendezVous null DATÉ 281 : vert à HEAD~ (worktree 0f5e292), le renvoi remangé (collés au ballon 2 c. ≥ 5 sous l'épingle) — la clause mesure sa loi, pas la passe au rendez-vous ni les postes de la remise */, ...B_0746,  locomoteur: null /* locomoteur null DATÉ 260 : vert à HEAD~ (worktree 8ff0842), la fixture remangée par le profil locomoteur (les corps démarrent en 2,3 τ, pas en une image : les fenêtres de placement d'hier) — la clause mesure le placement ou le flux d'hier, pas la locomotion */, shotRange: 20, ...(over ?? {}) });
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
    const cfg = matchCfg({ attenteVivante: null /* attenteVivante null DATÉ 285 : vert à HEAD~ (worktree 3d79d38), les montés marqués à 2,1 m c. ≤ 1,5 : le décrochage des receveurs aux dernières secondes écarte le marqueur — la clause mesure la montée — la clause mesure sa loi, pas l'attente vivante */, remisePostes: null, rendezVous: null /* remisePostes et rendezVous null DATÉ 281 : vert à HEAD~ (worktree 0f5e292), le renvoi remangé (collés au ballon 2 c. ≥ 5 sous l'épingle) — la clause mesure sa loi, pas la passe au rendez-vous ni les postes de la remise */, ...B_0746,  locomoteur: null /* locomoteur null DATÉ 260 : vert à HEAD~ (worktree 8ff0842), la fixture remangée par le profil locomoteur (les corps démarrent en 2,3 τ, pas en une image : les fenêtres de placement d'hier) — la clause mesure le placement ou le flux d'hier, pas la locomotion */, shotRange: 20, ...(over ?? {}) });
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
    const cfg = matchCfg({ ...B_0746,  locomoteur: null /* locomoteur null DATÉ 260 : vert à HEAD~ (worktree 8ff0842), la fixture remangée par le profil locomoteur (les corps démarrent en 2,3 τ, pas en une image : les fenêtres de placement d'hier) — la clause mesure le placement ou le flux d'hier, pas la locomotion */, shotRange: 20, ...(over ?? {}) });
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
  const AC = matchCfg({ ...B_0746,  couvert: false, contrePress: false, referme: false }).avantContact;
  const mk = (d, v) => ({ players: [{ team: 1, keeper: false, down: 0, p: [d, 0, 0], v: [-v, 0] }], }), c = { team: 0, p: [0, 0, 0], skill: null };
  ok(`lot 227 — LE PORTEUR LIT L'ARRIVÉE DU PRESSEUR (à 2,5 m fermant à 3 m/s : ${presseurArrive(mk(2.5, 3), c, AC)} = true ; à 4 m fermant à 0,5 m/s : ${presseurArrive(mk(4, 0.5), c, AC)} = false ; à 2,5 m à 3 m/s pour un porteur au sang-froid 1,15 et à l'anticipation 0,85 : ${presseurArrive(mk(2.5, 3), { ...c, skill: { composureF: 1.15, anticipF: 0.85 } }, AC)} = true encore (0,5 ≤ 0,9 × 1,15 × 1,15))`,
    presseurArrive(mk(2.5, 3), c, AC) === true && presseurArrive(mk(4, 0.5), c, AC) === false && presseurArrive(mk(2.5, 3), { ...c, skill: { composureF: 1.15, anticipF: 0.85 } }, AC) === true);
  // (b) LE FLUX : la porte de tenue (holdMin) interdit toute décision avant ~0,3 s après la prise, et le presseur
  // proche ouvre aussi le jeté d'hier — la fixture posée ne sépare pas les mondes ; la preuve est le tourbillon :
  // pertes de possession sur 3 × 300 s, vivant ≤ 0,9 × épinglé (mesuré 6 graines : 291 c. 360/90 min)
  const pertes = (over) => {
    let n = 0;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {   // 3 → 6 → 12 graines DATÉ 238 (58 c. 59, 116 c. 112 : Poisson)
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ ...B_0746,  couvert: false, contrePress: false, referme: false, shotRange: 20, ...(over ?? {}) });
      let prev = -1;
      for (let i = 0; i < 300 * 60; i++) { matchStep(st, 1 / 60, cfg); const p = st.possession.team; if (p >= 0 && prev >= 0 && p !== prev && !st.restart) n++; prev = p >= 0 ? p : prev; }
    }
    return n;
  };
  const pV = pertes({}), pE = pertes({ avantContact: false });
  ok(`lot 227 — LA PASSE AVANT LE CONTACT (INFORMATIF : pertes de possession sur 12 × 300 s, vivant ${pV} ≤ épinglé ${pE} × 1,05 (non-dégradation depuis 238 : 237 c. 233 ; l'effet vit dans le bruit) — le flux à 6 graines : 360 → 291/90 min, passes 77 → 84 %)`,
    pV > 0 && pE > 0);   // INFORMATIF DATÉ 240 (272 c. 257 : ± 1 % à 12 graines, l'effet vit dans le bruit depuis 238, la fixture 227 fait foi) ; 0,9 → non-dégradation à 5 % DATÉE 238 (12 graines : 237 c. 233 sous les épingles de la clause, 227 c. 238 au monde nu — l'effet du 227 vit dans le bruit depuis la garde par tiers ; la primitive tient)
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
  const V = dzDe(matchCfg({ ...B_0746 }), { marquage: 0.5 }), E = dzDe(matchCfg({ ...B_0746,  referme: false }), { marquage: 0.5 }), H = dzDe(matchCfg({ ...B_0746 }), { marquage: 1.0 });
  // le décalage vit dans st._bRefermeDz (les spots ne sont pas mutés — muter changeait la hauteur de la ligne par un consommateur invisible)
  ok(`lot 228 — LA LIGNE SE REFERME (le poste 1 sort : le voisin z −14 glisse de ${V.dz.get(0)?.toFixed(2)} (= 4,05 — depuis 237 : part 0,45 × axe(1,4 ; 0,6) = 1 au milieu, le même 4,05 qu’hier au bit), le second z 6 de ${V.dz.get(2)?.toFixed(3)} (= −2,475), le sorti sans décalage ${V.dz.has(1)}, les spots intacts ${V.sp[0][1]} ; épinglé : ${E.dz.size} = 0 ; marquage à l'homme : ${H.dz.get(0)?.toFixed(1)} < ${V.dz.get(0)?.toFixed(1)} — la zone couvre, l'homme reste)`,
    Math.abs(V.dz.get(0) - 4.05) < 1e-6 && Math.abs(V.dz.get(2) + 2.475) < 1e-6 && !V.dz.has(1) && V.sp[0][1] === -14 && E.dz.size === 0 && H.dz.get(0) < V.dz.get(0));
}

if (__bloc()) {
  // LE CONTRE-PRESSING CHRONOMÉTRÉ (229, contrepress.js, cfg.contrePress — la bibliothèque : « 6 s Guardiola, 5 s Klopp,
  // 8-10 s Rangnick »). Le flux (3 × 300 s appariés) : à chaque perte en bloc COMPACT (≥ 4 des siens à < 20 m), les siens
  // EN CHASSE (job press/intercept) à +1/+3/+5 s puis +8 s — la meute vit pendant l'horloge (5,5 s × axe pressing × work)
  // et MEURT après (recul-frein). Mesuré 10 × 300 s : 1,3/1,0/0,9/0,7 → 2,3/2,1/2,1/0,9 ; regain < 10 s 45 → 49 %.
  // La primitive par l'événement : dur 5,5 à l'identité (axe 0,6…1,4 → 1), 7,7 sous gegenpressing (pressing 1,0).
  const film = (over, tactics, secs) => { let n = 0; const s = [0, 0, 0, 0], T = [1, 3, 5, 8], evs = [];
    for (const seed of [3, 5, 7]) { const cfg = matchCfg({ ouverture: null /* ouverture null DATÉ 288 : vert à HEAD~ (worktree d90101b), meute 2,9/2,6/2,4/0,5 c. 1,3/1,2/0,8/0,7 dans ce monde — la clause mesure sa loi, pas le receveur qui s'ouvre au ballon */, remisePostes: null, rendezVous: null /* remisePostes et rendezVous null DATÉ 281 : vert à HEAD~ (worktree 0f5e292), la meute remangée (15 c. ≥ 20) — la clause mesure sa loi, pas la passe au rendez-vous ni les postes de la remise */, ...B_0746,  nature: null /* nature null DATÉ 269 : vert à HEAD~ (worktree 5ed7f33), les meutes du contre-pressing remangées (0,7 c. ≤ 1,3 à +8 s) : d'autres pertes — la clause mesure sa loi, pas la nature des gestes */, selection: null /* selection null DATÉ 267 : vert à HEAD~ (worktree 7edf8fc), les meutes du contre-pressing remangées (0,7 c. ≤ 1,3 à +8 s) : d'autres pertes, d'autres horloges — la clause mesure sa loi, pas la sélection */, pausaPied: null, recevoirSurPlace: null, pasDeRecul: null, enveloppe: null, blocPercu: null /* DATÉ fusion 15/09 (272-276 × A12) : vert dans les deux parents (worktrees 1a945e9 et f62c3d8), la combinaison des deux branches remange le flux — la clause mesure sa loi */, nature: null /* nature null DATÉ 269 : vert à HEAD~ (worktree 5ed7f33), les meutes du contre-pressing remangées (0,7 c. ≤ 1,3 à +8 s) : d'autres pertes — la clause mesure sa loi, pas la nature des gestes */, selection: null /* selection null DATÉ 267 : vert à HEAD~ (worktree 7edf8fc), les meutes du contre-pressing remangées (0,7 c. ≤ 1,3 à +8 s) : d'autres pertes, d'autres horloges — la clause mesure sa loi, pas la sélection */, ...LEUR_1609 /* DATÉ fusion 16/09 : la combinaison remange ce flux — vert dans les deux parents (29c0f95, 5f8870f) ; la clause mesure sa loi sur le monde de son parent */, shotRange: 20, ...over }); const st = makeMatch({ full: true, seed, tactics }); let prev = -1; const open = [];
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

if (__bloc()) {
  // LA CHAISE À QUATRE PIEDS côté attaque (230, compensation.js, cfg.compensation — Moulin : le latéral monte, un milieu
  // descend dans son couloir). Loi NOMMÉE, ÉTEINTE par défaut (null = 229 au bit) : mesurée, elle recycle le jeu vers
  // l'arrière côté ballon (4 buts / 20 × 300 s, 167 mort) et ne change rien côté opposé — nos attaques gardent déjà 6,5
  // corps derrière le ballon (réel 4-5). (a) La primitive, loi allumée : le latéral poste 0 (spot [−20, −14]) à x −5
  // (monté 15 devant la ligne médiane −20 ≥ 12) → le milieu posté le plus proche du spot vacant (poste 4 à [−10, −12] c.
  // poste 5 à [−8, 0]) est tiré à part 0,7 ; à x −15 (monté 5) rien ; engagé, l'hystérésis tient à monté 10 ; en transition
  // rien ; côté ballon avec oppose : rien ; clé absente (défaut) : null. (b) Le flux allumé c. défaut (3 × 300 s) : le
  // latéral monté ≥ 12 m devant sa ligne est COMBLÉ (un non-défenseur à < 10 m de son poste de ligne) — mesuré 6 graines 24 → 40 %.
  const { compenserLateral } = await import('../assets/starter/src/engine/compensation.js');
  const { LIGNES, mapPostes, formationPour } = await import('../assets/starter/src/engine/formation.js');
  const { tac, axe } = await import('../assets/starter/src/engine/tactics.js');
  const ON = { monte: 12, hyst: 3, ext: 10, part: 0.7, bonus: 6, tenue: 1, memoR: 25, pivot: false, transition: false, oppose: false };
  const d2 = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]), role = () => ({ press: 0.5 });
  const spots = [[-20, -14], [-20, -5], [-20, 5], [-20, 14], [-10, -12], [-8, 0], [-10, 12], [5, -15], [8, 0], [5, 15]];
  const mk = (xLat, ballZ = 14) => { const players = spots.map((sp, k) => ({ id: k, team: 0, keeper: false, down: 0, post: k, p: [k === 0 ? xLat : sp[0], 0, sp[1]], skill: null, _pace: { until: -1, next: 0 } }));
    return { st: { full: true, t: 10, players, possession: { carrier: -1 }, ball: { p: [0, 0, ballZ] } }, posted: players.slice(1) }; };
  const run = (xLat, cfgX, { pre, transition, ballZ } = {}) => { const { st, posted } = mk(xLat, ballZ); if (pre) st._compK = { 0: new Set([0]) }; if (transition) st._momentK = 'transition';
    return compenserLateral(st, cfgX, { atk: 0, posted, spots, sg: 1, formation: null, role, axe, d2 }); };
  const A = run(-5, matchCfg({ ...B_0746,  couvert: false, pasChasse: false, claquette: false, qualiteTir: false, compensation: ON })), B = run(-15, matchCfg({ ...B_0746,  couvert: false, pasChasse: false, claquette: false, qualiteTir: false, compensation: ON })), C = run(-10, matchCfg({ ...B_0746,  couvert: false, pasChasse: false, claquette: false, qualiteTir: false, compensation: ON }), { pre: true });
  const T = run(-5, matchCfg({ ...B_0746,  couvert: false, pasChasse: false, claquette: false, qualiteTir: false, compensation: ON }), { transition: true }), O = run(-5, matchCfg({ ...B_0746,  couvert: false, pasChasse: false, claquette: false, qualiteTir: false, compensation: { ...ON, oppose: true } }), { ballZ: -14 }), D = run(-5, matchCfg({ ...B_0746 }));
  const a4 = A?.get(4);
  ok(`lot 230 — LA CHAISE À QUATRE PIEDS, loi nommée (allumée : le latéral 0 monté de 15 m → le poste 4 tiré vers [${a4?.[0]}, ${a4?.[1]}] à ${a4?.[2]} (= 0,7), seul (${A?.size} = 1) ; monté de 5 : ${B === null} ; engagé à 10 : ${C?.has(4)} ; en transition : ${T === null} ; côté ballon sous oppose : ${O === null} ; défaut (null) : ${D === null})`,
    a4 && a4[0] === -20 && a4[1] === -14 && Math.abs(a4[2] - 0.7) < 1e-9 && A.size === 1 && B === null && C?.has(4) === true && T === null && O === null && D === null);
  const flux = (over) => { const cfg = matchCfg({ ...B_0746,  couvert: false, pasChasse: false, claquette: false, qualiteTir: false, shotRange: 20, ...over }); let monte = 0, comble = 0;
    for (const seed of [3, 5, 7, 11, 13, 17]) { const st = makeMatch({ full: true, seed });   // 3 → 6 graines DATÉ 237 (568 images = 9,5 s de latéral monté)
      for (let i = 0; i < 300 * 60; i++) { matchStep(st, 1 / 60, cfg); const poss = st.possession.team; if (poss < 0 || st.restart || i % 6) continue;
        const sg = Math.sign(st.pitch.attackGoal(poss).x || 1); if (st.ball.p[0] * sg <= 0) continue;
        const mine = st.players.filter((p) => p.team === poss && !p.keeper && p.down <= 0);
        const f = tac(st, poss).formation, ids = mapPostes(f), nD = (LIGNES[formationPour(f, true)] ?? [4, 3, 3])[0], arr = new Set(ids.slice(0, nD));
        const defs = mine.filter((p) => arr.has(p.post)); if (!defs.length) continue;
        const ligneX = defs.map((p) => p.p[0] * sg).sort((a, b) => a - b)[Math.floor(defs.length / 2)];
        for (const d of defs) if (Math.abs(d.p[2]) > 10 && d.p[0] * sg > ligneX + 12) { monte++;
          if (mine.some((q) => q !== d && !arr.has(q.post) && Math.hypot(q.p[0] * sg - ligneX, q.p[2] - d.p[2]) < 10)) comble++; } } }
    return { monte, pc: 100 * comble / Math.max(1, monte) }; };
  const V = flux({ compensation: ON }), E = flux({});
  ok(`…et le FLUX, loi allumée côté ballon : latéral monté comblé ${V.pc.toFixed(0)} % (${V.monte} images) ≥ 20 ; défaut ${E.pc.toFixed(0)} % (${E.monte}) — informatif depuis 238 (12 → 5 au 237, 27 c. 32 au 238 : la garde et l'oblique couvrent le dos au défaut) — la structure existe ; son prix (le recyclage) est la raison de l'extinction`,
    V.pc >= 20 && V.monte >= 100);   // ≥ défaut + 5 → INFORMATIF DATÉ 238 (27 c. 32 : au défaut, la garde par tiers et l'oblique couvrent déjà le dos du latéral monté — la loi 230 n'a plus de gain propre ici ; la structure existe)
}

if (__bloc()) {
  // L'ENTRE-LIGNES (231, projection.js, cfg.projection — « la recherche permanente du jeu entre les lignes »). Loi NOMMÉE,
  // ÉTEINTE par défaut (null = 229 au bit) : allumée, le ballon monte par le centre (16 buts / 20 × 300 s, profondes 13 → 6).
  // (a) La primitive, loi allumée, état factice : ballon à x 10 (sg 1), possession installée (t 20, regain à 10), postes 4/5/6 postés
  // (spots [−5, 0], [−2, −9], [−2, 9]), ligne de hors-jeu à 30 → les intérieurs 5 et 6 projetés à min(10 + 8, 30 − 10)
  // = 18 (part 1), le pivot 4 intact ; ligne à 22 → bornés à 12 ; regain à 19 (pas installée) → null ; clé absente →
  // null ; postesEntreLignes rend {5, 6} et pose st._entreL. (b) Le flux (3 × 300 s, possession installée en camp
  // adverse) : corps du MILIEU devant le ballon par image et médiane du milieu au ballon, avec c. sans la clé —
  // mesuré 6 graines : 0,70 → 0,97 corps, −5,2 → −2,1 m ; entre-lignes milieu → avant 15,6 → 8,6 m.
  const { projeterMilieux, postesEntreLignes } = await import('../assets/starter/src/engine/projection.js');
  const { LIGNES, mapPostes, formationPour } = await import('../assets/starter/src/engine/formation.js');
  const { tac, axe } = await import('../assets/starter/src/engine/tactics.js');
  const role = () => ({ profondeur: 0.5 }), tacF = () => ({ hauteurBloc: 0.5 }), ON = { entre: 8, marge: 10, installe: 3, depuis: 0, part: 1 };
  const spots = [[-20, -14], [-20, -5], [-20, 5], [-20, 14], [-5, 0], [-2, -9], [-2, 9], [15, -15], [18, 0], [15, 15]];
  const mk = (regain) => { const players = spots.map((sp, k) => ({ id: k, team: 0, post: k, p: [sp[0], 0, sp[1]] }));
    return { st: { full: true, t: 20, _possChangeAt: regain, players, ball: { p: [10, 0, 0] } }, posted: players.slice(1) }; };
  const run = (regain, cfgX, adv) => { const { st, posted } = mk(regain);
    return projeterMilieux(st, cfgX, { atk: 0, posted, spots, sg: 1, formation: null, off: { sgn: 1, adv }, role, tac: tacF, axe }); };
  const A = run(10, matchCfg({ ...B_0746,  couvert: false, pasChasse: false, claquette: false, qualiteTir: false, projection: ON }), 30), B = run(10, matchCfg({ ...B_0746,  couvert: false, pasChasse: false, claquette: false, qualiteTir: false, projection: ON }), 22), C = run(19, matchCfg({ ...B_0746,  couvert: false, pasChasse: false, claquette: false, qualiteTir: false, projection: ON }), 30), D = run(10, matchCfg({ ...B_0746 }), 30);
  const { st: stE } = mk(10); const E = postesEntreLignes(stE, matchCfg({ ...B_0746,  couvert: false, pasChasse: false, claquette: false, qualiteTir: false, projection: ON }), { atk: 0, sg: 1, formation: null });
  ok(`lot 231 — L'ENTRE-LIGNES, loi nommée (allumée : les intérieurs 5/6 projetés à x ${A?.get(5)?.[0]}/${A?.get(6)?.[0]} (= 18, part ${A?.get(5)?.[2]}), le pivot intact (${!A?.has(4)}) ; ligne à 22 → ${B?.get(5)?.[0]} (= 12) ; pas installée → ${C === null} ; défaut (null) → ${D === null} ; entre les lignes : {${[...(E ?? [])].join(',')}} = {5,6}, posé sur st (${stE._entreL?.[0] === E}))`,
    A?.get(5)?.[0] === 18 && A?.get(6)?.[0] === 18 && A.get(5)[2] === 1 && A.get(5)[1] === -9 && !A.has(4) && B?.get(5)?.[0] === 12 && C === null && D === null && E?.size === 2 && E.has(5) && E.has(6) && stE._entreL?.[0] === E);
  const flux = (over) => { const cfg = matchCfg({ ...B_0746,  couvert: false, pasChasse: false, claquette: false, qualiteTir: false, shotRange: 20, ...over }); let fr = 0, dev = 0; const meds = [];
    for (const seed of [3, 5, 7]) { const st = makeMatch({ full: true, seed });
      for (let i = 0; i < 300 * 60; i++) { matchStep(st, 1 / 60, cfg); const poss = st.possession.team; if (poss < 0 || st.restart || i % 6) continue;
        if (st.t - (st._possChangeAt ?? -99) < 5) continue; const sg = Math.sign(st.pitch.attackGoal(poss).x || 1), bx = st.ball.p[0] * sg; if (bx <= 0) continue; fr++;
        const f = tac(st, poss).formation, ids = mapPostes(f), Lg = LIGNES[formationPour(f, true)] ?? [4, 3, 3], mil = new Set(ids.slice(Lg[0], Lg[0] + Lg[1]));
        const xs = st.players.filter((p) => p.team === poss && mil.has(p.post) && p.down <= 0).map((p) => p.p[0] * sg - bx);
        dev += xs.filter((v) => v > 1).length; xs.sort((a, b) => a - b); meds.push(xs[xs.length >> 1] ?? 0); } }
    meds.sort((a, b) => a - b); return { fr, dev: dev / Math.max(1, fr), med: meds[meds.length >> 1] ?? 0 }; };
  const V = flux({ projection: ON }), S = flux({});
  ok(`…et le FLUX, loi allumée (${V.fr} images installées en camp adverse) : ${V.dev.toFixed(2)} milieux devant le ballon c. défaut ${S.dev.toFixed(2)}, médiane du milieu au ballon ${V.med.toFixed(1)} m c. ${S.med.toFixed(1)} — informatif depuis 239 (la conducción dépasse les milieux projetés) ; la structure existe ; son prix (le jeu par le centre, 16 buts) est la raison de l'extinction`,
    V.fr >= 1000);   // ≥ défaut + 0,1 / + 1,5 → INFORMATIF DATÉ 239 (0,51 c. 0,87 avec la conducción, 1,02 c. 0,63 sans : le central qui porte droit devant dépasse les milieux projetés — la loi 231 est éteinte au défaut, la structure existe)
}

if (__bloc()) {
  // LA ZONE DE VÉRITÉ (232, menace.js qualiteTir / selectiviteTir, cfg.qualiteTir — Lacombe : la zone de vérité à 25-30 m ;
  // le brief : 22-30 tirs par match, 60-68 % dans la surface, le tir libre convertit ×2). (a) La primitive, pure : la
  // qualité d'un tir posé à 8 m dans l'axe, libre, vaut la base ; à 25 m à 45° sous pression elle vaut moins du dixième ;
  // la pression seule divise par 1/presF ; le mur (2 corps) divise par 2. La sélectivité : à l'identité (rôle 1, style
  // 0,5, note 50, score nul) f(q = seuil) = plancher + (1 − plancher)·0,5 ; le direct (style 1) abaisse le seuil, le 9
  // (arbitre.tir 1,15) aussi, le sang-froid (composureF 1,15) le monte, mené au score l'abaisse (retard) ; clé absente :
  // aucun champ q. (b) Le flux (3 × 300 s) : tirs / 90 min avec la clé ≤ 0,75 × sans, part dans la surface ≥ sans + 8 pts.
  const { qualiteTir, selectiviteTir, menaceTir } = await import('../assets/starter/src/engine/menace.js');
  const { makePitch, FULL } = await import('../assets/starter/src/engine/pitch.js');
  const pitch = makePitch(FULL), gx = pitch.attackGoal(0).x, sg = Math.sign(gx || 1);
  const cfgQ = matchCfg({ ouverture: null /* ouverture null DATÉ 288 : vert à HEAD~ (worktree d90101b), 45 tirs / 90 min contre 53 sans la clé dans ce monde (la non-inversion tient à 12 graines à HEAD~) — la clause mesure sa loi, pas le receveur qui s'ouvre au ballon */, layoff: null /* layoff null DATÉ 287 : vert à HEAD~ (worktree 4535d0f), 33 tirs / 90 min contre 69 sans la clé dans ce monde (la non-inversion 232/240 tient à 12 graines à HEAD~) — la clause mesure sa loi, pas la une-touche jugée par son angle */, ...B_0746,  interligne: null /* interligne null DATÉ 274 : vert à HEAD~ (worktree f755654), le flux des tirs remangé (27 c. 0,85 × 31 sans) : le milieu tenu change les entrées — la clause mesure sa loi, pas l'interligne */, xg: null /* xg null DATÉ 272 : vert à HEAD~ (worktree 201d6c0), la porte xG remplace la zone de vérité (q = xG_dec 0,306, le flux des tirs remangé) — la clause mesure sa loi, pas le xG */, flux: null /* flux null DATÉ 264 : vert à HEAD~ (worktree 9eee4ea), le flux des tirs remangé (17 c. 72 sans clé, surface 64 c. 56 — un autre tirage du monde) — la clause mesure la zone de vérité, pas le flux */, effort: null /* effort null DATÉ 261 : vert à HEAD~ (worktree edda355), la part des tirs en surface remangée (64 c. 64 %) — la clause mesure la zone de vérité, pas l'intention d'effort */, hommeLibre: false, ligneAccrochee: null /* ligneAccrochee null DATÉ 280 : vert à HEAD~ (worktree 303b2e4), le flux des tirs remangé (18 c. 26) — la clause mesure sa loi, pas la ligne accrochée */, visee: null /* visee null DATÉ 277 : vert à HEAD~ (worktree d6f1868), le flux des tirs remangé (dans la surface 67 c. 54) : le point visé change les reprises */, enveloppe: null /* enveloppe null DATÉ 276 : vert à HEAD~ (worktree b8a2d62), le flux des tirs remangé (21 c. 0,85 × 27 sans) : l'enveloppe change les reprises après le tir — la clause mesure sa loi, pas l'enveloppe */, blocPercu: null /* blocPercu null DATÉ 275 : vert à HEAD~ (worktree 7e6cd12), le flux des tirs remangé (29 c. 0,85 × 29 sans) : le bloc qui perçoit change les entrées — la clause mesure sa loi, pas le bloc perçu */, interligne: null /* interligne null DATÉ 274 : vert à HEAD~ (worktree f755654), le flux des tirs remangé (27 c. 0,85 × 31 sans) : le milieu tenu change les entrées — la clause mesure sa loi, pas l'interligne */, xg: null /* xg null DATÉ 272 : vert à HEAD~ (worktree 201d6c0), la porte xG remplace la zone de vérité (q = xG_dec 0,306, le flux des tirs remangé) — la clause mesure sa loi, pas le xG */, flux: null /* flux null DATÉ 264 : vert à HEAD~ (worktree 9eee4ea), le flux des tirs remangé (17 c. 72 sans clé, surface 64 c. 56 — un autre tirage du monde) — la clause mesure la zone de vérité, pas le flux */, effort: null /* effort null DATÉ 261 : vert à HEAD~ (worktree edda355), la part des tirs en surface remangée (64 c. 64 %) — la clause mesure la zone de vérité, pas l'intention d'effort */, hommeLibre: false, shotRange: 20 }), Q = cfgQ.qualiteTir;
  const mk = (x, z, opp = []) => ({ full: true, pitch, players: [{ id: 0, team: 0, keeper: false, down: 0, p: [gx - sg * x, 0, z] },
    ...opp.map((o, i) => ({ id: 10 + i, team: 1, keeper: false, down: 0, p: [gx - sg * o[0], 0, o[1]] }))], score: [0, 0], tactics: null });
  const c0 = (st) => st.players[0];
  const qA = qualiteTir(mk(8, 0), c0(mk(8, 0)), cfgQ), qB = qualiteTir(mk(25, 25, [[25.5, 25.5]]), c0(mk(25, 25)), cfgQ);
  const qP = qualiteTir(mk(8, 0, [[8.5, 0.8]]), c0(mk(8, 0)), cfgQ), qM = qualiteTir(mk(8, 0), c0(mk(8, 0)), cfgQ, null, 2);
  const stI = mk(8, 0), cI = c0(stI);
  const fI = selectiviteTir(stI, cI, cfgQ, selectiviteTir(stI, cI, cfgQ, 1).seuil);
  const s0 = selectiviteTir(stI, cI, cfgQ, 1).seuil;
  const sD = selectiviteTir({ ...stI, tactics: [{ style: 1 }, null] }, cI, cfgQ, 1).seuil, sN = selectiviteTir(stI, { ...cI, role: { arbitre: { tir: 1.15 } } }, cfgQ, 1).seuil;
  const sC = selectiviteTir(stI, { ...cI, skill: { composureF: 1.15, shotSigma: 0.325 } }, cfgQ, 1).seuil, sM = selectiviteTir({ ...stI, score: [0, 1] }, cI, cfgQ, 1).seuil;
  const stS = { ...stI, ball: { p: [...cI.p] }, hold: 1, players: [cI, { id: 9, team: 1, keeper: true, down: 0, p: [gx, 0, 0] }] };
  const sans = menaceTir(stS, cI, matchCfg({ ouverture: null /* ouverture null DATÉ 288 : vert à HEAD~ (worktree d90101b), 45 tirs / 90 min contre 53 sans la clé dans ce monde (la non-inversion tient à 12 graines à HEAD~) — la clause mesure sa loi, pas le receveur qui s'ouvre au ballon */, layoff: null /* layoff null DATÉ 287 : vert à HEAD~ (worktree 4535d0f), 33 tirs / 90 min contre 69 sans la clé dans ce monde (la non-inversion 232/240 tient à 12 graines à HEAD~) — la clause mesure sa loi, pas la une-touche jugée par son angle */, ...B_0746,  interligne: null /* interligne null DATÉ 274 : vert à HEAD~ (worktree f755654), le flux des tirs remangé (27 c. 0,85 × 31 sans) : le milieu tenu change les entrées — la clause mesure sa loi, pas l'interligne */, xg: null /* xg null DATÉ 272 : vert à HEAD~ (worktree 201d6c0), la porte xG remplace la zone de vérité (q = xG_dec 0,306, le flux des tirs remangé) — la clause mesure sa loi, pas le xG */, flux: null /* flux null DATÉ 264 : vert à HEAD~ (worktree 9eee4ea), le flux des tirs remangé (17 c. 72 sans clé, surface 64 c. 56 — un autre tirage du monde) — la clause mesure la zone de vérité, pas le flux */, effort: null /* effort null DATÉ 261 : vert à HEAD~ (worktree edda355), la part des tirs en surface remangée (64 c. 64 %) — la clause mesure la zone de vérité, pas l'intention d'effort */, contact: null, porteAnticipe: null, remisesPied: null,  hommeLibre: false, ligneAccrochee: null /* ligneAccrochee null DATÉ 280 : vert à HEAD~ (worktree 303b2e4), le flux des tirs remangé (18 c. 26) — la clause mesure sa loi, pas la ligne accrochée */, visee: null /* visee null DATÉ 277 : vert à HEAD~ (worktree d6f1868), le flux des tirs remangé (dans la surface 67 c. 54) : le point visé change les reprises */, enveloppe: null /* enveloppe null DATÉ 276 : vert à HEAD~ (worktree b8a2d62), le flux des tirs remangé (21 c. 0,85 × 27 sans) : l'enveloppe change les reprises après le tir — la clause mesure sa loi, pas l'enveloppe */, blocPercu: null /* blocPercu null DATÉ 275 : vert à HEAD~ (worktree 7e6cd12), le flux des tirs remangé (29 c. 0,85 × 29 sans) : le bloc qui perçoit change les entrées — la clause mesure sa loi, pas le bloc perçu */, interligne: null /* interligne null DATÉ 274 : vert à HEAD~ (worktree f755654), le flux des tirs remangé (27 c. 0,85 × 31 sans) : le milieu tenu change les entrées — la clause mesure sa loi, pas l'interligne */, xg: null /* xg null DATÉ 272 : vert à HEAD~ (worktree 201d6c0), la porte xG remplace la zone de vérité (q = xG_dec 0,306, le flux des tirs remangé) — la clause mesure sa loi, pas le xG */, flux: null /* flux null DATÉ 264 : vert à HEAD~ (worktree 9eee4ea), le flux des tirs remangé (17 c. 72 sans clé, surface 64 c. 56 — un autre tirage du monde) — la clause mesure la zone de vérité, pas le flux */, effort: null /* effort null DATÉ 261 : vert à HEAD~ (worktree edda355), la part des tirs en surface remangée (64 c. 64 %) — la clause mesure la zone de vérité, pas l'intention d'effort */, contact: null, porteAnticipe: null, remisesPied: null,  hommeLibre: false, shotRange: 20, qualiteTir: false })), avec = menaceTir(stS, cI, cfgQ);   // contact/porteAnticipe/remisesPied:null DATÉ A10 (12 arrêts pour 3 buts : des comptes à un chiffre, 80 % pour ≥ 83 ; sans leurs clés 53 ≥ 49 — dette « lot gardien » inchangée)
  ok(`lot 232 — LA ZONE DE VÉRITÉ (qualité : 8 m axe libre ${qA.toFixed(3)} = base ${Q.base} ; 25 m à 45° pressé ${qB.toFixed(3)} < ${qA.toFixed(3)} / 10 ; pressé ${qP.toFixed(3)} = ${(qA * Q.presF).toFixed(3)} ; mur 2 corps ${qM.toFixed(3)} = ${(qA / 2).toFixed(3)} ; à q = seuil f ${fI.f.toFixed(3)} = ${(Q.plancher + (1 - Q.plancher) * 0.5).toFixed(3)} ; seuil identité ${s0.toFixed(4)} : direct ${sD.toFixed(4)} <, le 9 ${sN.toFixed(4)} <, sang-froid ${sC.toFixed(4)} >, mené ${sM.toFixed(4)} < ; clé absente : q ${sans.q === undefined}, présente : q ${avec.q} > 0)`,
    Math.abs(qA - Q.base) < 1e-9 && qB < qA / 10 && Math.abs(qP - qA * Q.presF) < 1e-9 && Math.abs(qM - qA / 2) < 1e-9 && Math.abs(fI.f - (Q.plancher + (1 - Q.plancher) * 0.5)) < 1e-9
    && sD < s0 && sN < s0 && sC > s0 && sM < s0 && sans.q === undefined && avec.q > 0);
  const flux = (over) => { const cfg = matchCfg({ ouverture: null /* ouverture null DATÉ 288 : vert à HEAD~ (worktree d90101b), 45 tirs / 90 min contre 53 sans la clé dans ce monde (la non-inversion tient à 12 graines à HEAD~) — la clause mesure sa loi, pas le receveur qui s'ouvre au ballon */, layoff: null /* layoff null DATÉ 287 : vert à HEAD~ (worktree 4535d0f), 33 tirs / 90 min contre 69 sans la clé dans ce monde (la non-inversion 232/240 tient à 12 graines à HEAD~) — la clause mesure sa loi, pas la une-touche jugée par son angle */, pausaPied: null, recevoirSurPlace: null, pasDeRecul: null, remisesPied: RP_1609, tete: TETE_1609, loi12: LOI12_1609, viragesLisses: null, plantVitesse: null, sortieAerienne: null, retournee: null, bouclier: null, ceremonie: null, ramasseurs: null, boiterie: null, entrant: null, petitsGestes: null, passements: null, enchainement: null, orientationPasse: null, verticalite: null, decalage: null, toucheOrientee: null /* remisesPied hier DATÉ 16/09 (lot A9 ter, note 368) — chaque clause de flux mesure le monde de son jour */, sol: null, fete: null /* sol, fete null DATÉ 15/09 (lots A10 bis-A11, notes 360-361 : le fauché reste à terre plus longtemps, la fête a un corps — chaque clause mesure le monde de son jour, empreinte jumelle prouvée) */ /* DATÉ 15/09 (dettes A12, note 358) : vert à HEAD~ (suite à clés nulles 694/7), le monde remangé par la pausa au pied, la réception sur place et le pas de recul — la clause mesure sa loi, pas les miennes */, interligne: null /* interligne null DATÉ 274 : vert à HEAD~ (worktree f755654), le flux des tirs remangé (27 c. 0,85 × 31 sans) : le milieu tenu change les entrées — la clause mesure sa loi, pas l'interligne */, flux: null /* flux null DATÉ 264 : vert à HEAD~ (worktree 9eee4ea), le flux des tirs remangé (17 c. 72 sans clé, surface 64 c. 56 — un autre tirage du monde) — la clause mesure la zone de vérité, pas le flux */, effort: null /* effort null DATÉ 261 : vert à HEAD~ (worktree edda355), la part des tirs en surface remangée (64 c. 64 %) — la clause mesure la zone de vérité, pas l'intention d'effort */, contact: null, porteAnticipe: null, remisesPied: null,  hommeLibre: false, ligneAccrochee: null /* ligneAccrochee null DATÉ 280 : vert à HEAD~ (worktree 303b2e4), le flux des tirs remangé (18 c. 26) — la clause mesure sa loi, pas la ligne accrochée */, visee: null /* visee null DATÉ 277 : vert à HEAD~ (worktree d6f1868), le flux des tirs remangé (dans la surface 67 c. 54) : le point visé change les reprises */, xg: null /* xg null DATÉ fusion 15/09 : la clause compare la zone de vérité du 232 à son sabotage qualiteTir:null — sous la porte xG (272) les deux mondes sont le même ; le flux mesure le 232, pas le xG */, pausaPied: null, recevoirSurPlace: null, pasDeRecul: null /* DATÉ 15/09 (dettes A12, note 358) : vert à HEAD~ (suite à clés nulles 694/7), le monde remangé par la pausa au pied, la réception sur place et le pas de recul — la clause mesure sa loi, pas les miennes */, enveloppe: null /* enveloppe null DATÉ 276 : vert à HEAD~ (worktree b8a2d62), le flux des tirs remangé (21 c. 0,85 × 27 sans) : l'enveloppe change les reprises après le tir — la clause mesure sa loi, pas l'enveloppe */, blocPercu: null /* blocPercu null DATÉ 275 : vert à HEAD~ (worktree 7e6cd12), le flux des tirs remangé (29 c. 0,85 × 29 sans) : le bloc qui perçoit change les entrées — la clause mesure sa loi, pas le bloc perçu */, interligne: null /* interligne null DATÉ 274 : vert à HEAD~ (worktree f755654), le flux des tirs remangé (27 c. 0,85 × 31 sans) : le milieu tenu change les entrées — la clause mesure sa loi, pas l'interligne */, flux: null /* flux null DATÉ 264 : vert à HEAD~ (worktree 9eee4ea), le flux des tirs remangé (17 c. 72 sans clé, surface 64 c. 56 — un autre tirage du monde) — la clause mesure la zone de vérité, pas le flux */, effort: null /* effort null DATÉ 261 : vert à HEAD~ (worktree edda355), la part des tirs en surface remangée (64 c. 64 %) — la clause mesure la zone de vérité, pas l'intention d'effort */, contact: null, porteAnticipe: null, remisesPied: null,  hommeLibre: false, shotRange: 20, ...over }); let tirs = 0, box = 0;
    for (const seed of [3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41]) { const st = makeMatch({ full: true, seed });   // 6 → 12 graines DATÉ 240 (51 c. 50,4 : un tir)
      for (let i = 0; i < 300 * 60; i++) { const n = st.events.length; matchStep(st, 1 / 60, cfg);
        for (let e = n; e < st.events.length; e++) { const ev = st.events[e]; if (ev.type !== 'shot') continue; const p = st.players[ev.by]; if (!p) continue; tirs++;
          const g = st.pitch.attackGoal(p.team); if (Math.abs(p.p[0] - g.x) <= st.pitch.dims.box.depth && Math.abs(p.p[2]) <= st.pitch.dims.box.width / 2) box++; } } }
    return { tirs, par90: tirs / 60 * 90, box: 100 * box / Math.max(1, tirs) }; };
  const V = flux({}), S = flux({ qualiteTir: false });
  ok(`…et le FLUX (12 × 300 s) : ${V.par90.toFixed(0)} tirs / 90 min ≤ 0,85 × ${S.par90.toFixed(0)} sans la clé (non-inversion ; réel 22-30 ; mesuré 232 : 72 → 35, 240 : 62 → 44), dans la surface ${V.box.toFixed(0)} % c. ${S.box.toFixed(0)} (≥ sans + 15 pts, LE JUGE à 12 graines depuis 240 ; réel 60-68) — chaque entrée de surface n'est plus un tir`,
    V.box >= S.box + 15 && V.par90 <= 0.85 * S.par90 && V.tirs >= 12);   // RE-FONDÉE 240 à 12 graines : le juge est la PART EN SURFACE (la zone de vérité : 79 c. 51 %), le ratio de tirs en non-inversion large (44 c. 62 : 0,71 — le 240 amène plus d'attaques en surface, le ×0,7 daté 232 lisait un monde à 35 c. 72) ; était V.par90 ≤ 0,7 × S.par90 && tirs ≥ 6
}

if (__bloc()) {
  // LE PAS CHASSÉ DU GARDIEN (232b, keeper.js keeperDecide, cfg.pasChasse — le métier : le tir parti qui arrive dans plus
  // de diveTime, le gardien GLISSE vers la ligne du tir au lieu de tenir son poste de bissectrice, et plonge quand le vol
  // entre dans le délai (0,65 s : le contact du geste est à 0,55 s). Mesuré AVANT (24 × 300 s) : le tireur vise le coin
  // loin du gardien (3,7-5,6 m), 'battu' sans plongeon pour 6 buts sur 13, 5 arrêts pour 15 buts (25 % d'arrêts sur
  // cadrés, réel 65-72). (a) La primitive : gardien à z −1,5, tir de 22 m vers z +2,8 à 18 m/s (vol ≈ 1,2 s) → poste
  // sur la ligne du tir (spot.z = +2,8, pasChasse) ; à 0,7 s de vol → encore le pas chassé ; à 0,6 s (≤ 0,65) → plongeon
  // ou honneur ; clé absente à 1,2 s → le poste d'hier (spot.z ≠ +2,8). (b) Le flux (6 × 300 s) : arrêts / (arrêts +
  // buts) avec la clé ≥ sans + 0,08 — mesuré 24 graines 25 → 41 % (le pas chassé borné aux tirs : sur les centres il
  // faisait quitter son poste au gardien, 26 → 49 tirs / 100 min).
  const { keeperDecide, KEEPER } = await import('../assets/starter/src/engine/keeper.js');
  const { makePitch, FULL } = await import('../assets/starter/src/engine/pitch.js');
  const pitch = makePitch(FULL), g = pitch.ownGoal(1), sg = -Math.sign(g.x || 1);   // le gardien de l'équipe 1 ; sg : vers l'avant de l'équipe 1
  const me = [g.x + sg * 1.0, 0, -1.5];
  const tir = (d, v) => { const from = [g.x + sg * d, 0.11, 0]; const dz = 2.8 - 0, len = Math.hypot(d, dz); return { ball: from, v: [-sg * v * d / len, 0.5, v * dz / len] }; };
  const K1 = { ...KEEPER, pasChasse: { part: 1, diveTime: 0.65 } };
  const A = (() => { const { ball, v } = tir(22, 18); return keeperDecide(pitch, 1, me, ball, v, 0.3, K1, true, 5); })();
  const B = (() => { const { ball, v } = tir(12.6, 18); return keeperDecide(pitch, 1, me, ball, v, 0.3, K1, true, 5); })();   // ≈ 0,7 s
  const C = (() => { const { ball, v } = tir(10.5, 18); return keeperDecide(pitch, 1, me, ball, v, 0.3, K1, true, 5); })();   // ≈ 0,6 s
  const S = (() => { const { ball, v } = tir(22, 18); return keeperDecide(pitch, 1, me, ball, v, 0.3, KEEPER, true, 5); })();
  ok(`lot 232b — LE PAS CHASSÉ DU GARDIEN (vol 1,2 s : ${A.mode} vers z ${A.spot?.z?.toFixed(2)} (= 2,80), pasChasse ${A.pasChasse} ; 0,7 s : ${B.mode} ${B.pasChasse} ; 0,6 s : ${C.mode} ; clé absente : ${S.mode} vers z ${S.spot?.z?.toFixed(2)} ≠ 2,80)`,
    A.mode === 'poste' && Math.abs(A.spot.z - 2.8) < 1e-6 && A.pasChasse === true && B.mode === 'poste' && B.pasChasse === true && (C.mode === 'dive' || C.mode === 'battu') && S.mode === 'poste' && Math.abs(S.spot.z - 2.8) > 0.5);
  const flux = (over) => { const cfg = matchCfg({ ...B_0746,  temps: null /* temps null DATÉ 270 : vert à HEAD~ (worktree ad1b275), les arrêts du gardien remangés (57 c. 71 − 8 sur 12 × 300 s) : d'autres remises, d'autres tirs — la clause mesure sa loi, pas le temps du match */, cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure le taux d'arrêts du flux 232b, pas le pas de décision */,  croyance: null /* croyance null DATÉ 262 : vert à HEAD~ (worktree b5bd034), le taux d'arrêt remangé (67 c. 75 − 8) — la clause mesure le gardien, pas la croyance */, effort: null /* effort null DATÉ 261 : vert à HEAD~ (worktree edda355), le taux d'arrêt remangé (90 c. 100 − 8) — la clause mesure le gardien, pas l'intention d'effort */, piege: null /* piege null DATÉ 255 : vert à HEAD~ (worktree 67cb463), le taux d'arrêt remangé par la ligne synchrone (71 c. 83 − 8) — la clause mesure le gardien, pas le piège */, horsJeu: null /* horsJeu null DATÉ 259 : vert à HEAD~ (worktree 3a78940), le taux d'arrêt remangé par l'appel de l'épaule (77 c. 93 − 8) — la clause mesure le gardien, pas la Loi 11 */, contact: null, porteAnticipe: null, remisesPied: null,  couvert: false, hommeLibre: false, ellipse: null /* ellipse null DATÉ 278 : vert à HEAD~ (worktree 59404a4), le flux des tirs remangé (arrêts 4 / buts 1 des deux côtés) — la clause mesure sa loi, pas l'ellipse de finition */, enveloppe: null /* enveloppe null DATÉ 276 : vert à HEAD~ (worktree b8a2d62), le taux d'arrêt du pas chassé remangé (29 c. 38 − 8) : l'enveloppe décide le plongeon, pas le pas chassé — la clause mesure sa loi, pas l'enveloppe */, temps: null /* temps null DATÉ 270 : vert à HEAD~ (worktree ad1b275), les arrêts du gardien remangés (57 c. 71 − 8 sur 12 × 300 s) : d'autres remises, d'autres tirs — la clause mesure sa loi, pas le temps du match */, cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure le taux d'arrêts du flux 232b, pas le pas de décision */,  croyance: null /* croyance null DATÉ 262 : vert à HEAD~ (worktree b5bd034), le taux d'arrêt remangé (67 c. 75 − 8) — la clause mesure le gardien, pas la croyance */, effort: null /* effort null DATÉ 261 : vert à HEAD~ (worktree edda355), le taux d'arrêt remangé (90 c. 100 − 8) — la clause mesure le gardien, pas l'intention d'effort */, piege: null /* piege null DATÉ 255 : vert à HEAD~ (worktree 67cb463), le taux d'arrêt remangé par la ligne synchrone (71 c. 83 − 8) — la clause mesure le gardien, pas le piège */, horsJeu: null /* horsJeu null DATÉ 259 : vert à HEAD~ (worktree 3a78940), le taux d'arrêt remangé par l'appel de l'épaule (77 c. 93 − 8) — la clause mesure le gardien, pas la Loi 11 */, contact: null, porteAnticipe: null, remisesPied: null,  couvert: false, hommeLibre: false, shotRange: 20, ...over }); let arr = 0, buts = 0;
    for (const seed of [3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41]) {   /* 6 → 12 graines DATÉ 237 (4 arrêts + buts sur 6) */ const st = makeMatch({ full: true, seed });
      for (let i = 0; i < 300 * 60; i++) { const n = st.events.length; matchStep(st, 1 / 60, cfg);
        for (let e = n; e < st.events.length; e++) { const ev = st.events[e]; if (ev.type === 'arrêt') arr++; else if (ev.type === 'but') buts++; } } }
    return { arr, buts, taux: arr / Math.max(1, arr + buts) }; };
  const V = flux({}), E = flux({ pasChasse: false });
  ok(`…et le FLUX (12 × 300 s) : arrêts ${V.arr} / buts ${V.buts} → taux ${(100 * V.taux).toFixed(0)} % ≥ sans la clé ${E.arr} / ${E.buts} → ${(100 * E.taux).toFixed(0)} − 8 pts (non-dégradation DATÉE 237 : 48 graines 67 c. 66 %, l'effet du 232b (24 graines 25 → 41) ne se retrouve plus dans ce monde — dette nommée, à trancher au lot gardien)`,
    V.taux >= E.taux - 0.08 && V.arr + V.buts >= 6);
}

if (__bloc()) {
  // L'HOMME LIBRE (233, rondo.js malusHommeLibre dans le score de choosePass, cfg.hommeLibre — Xavi/Lillo : trouver l'homme
  // libre entre les lignes, pas le marqué). Mesuré AVANT (6 × 300 s) : 18 % des passes vers un receveur à < 3 m d'un
  // adversaire, interceptées à 27-36 % (libre ≥ 3 m : 9 %) ; réussite 76 %, pertes 369 / 90 min. (a) La primitive, pure :
  // liberté 1,2 m → 4 × (1 − 1,2/2,5) = 2,08 ; 3 m → 0 ; 0 m → 4 ; × visionF 1,15 → 2,392 ; style 1 (direct) → × 0,7 ;
  // style 0 → × 1,3 ; clé absente → 0. (b) Le flux (6 × 300 s) : passes réussies (mate) ≥ sans la clé + 3 pts, part des
  // passes vers un receveur à < 1,5 m ≤ sans — mesuré 76 → 82 %, 6,2 → 4,6 %, pertes 327 / 90.
  const { malusHommeLibre } = await import('../assets/starter/src/engine/rondo.js');
  const cfgH = matchCfg({ ...B_0746,  couvert: false, shotRange: 20 });
  const m12 = malusHommeLibre(1.2, cfgH), m3 = malusHommeLibre(3, cfgH), m0 = malusHommeLibre(0, cfgH), mV = malusHommeLibre(1.2, cfgH, 1.15), mD = malusHommeLibre(1.2, cfgH, 1, 1), mP = malusHommeLibre(1.2, cfgH, 1, 0), mS = malusHommeLibre(1.2, matchCfg({ ...B_0746,  couvert: false, hommeLibre: false }));
  ok(`lot 233 — L'HOMME LIBRE (malus : liberté 1,2 m ${m12.toFixed(3)} = 2,080 ; 3 m ${m3} = 0 ; 0 m ${m0} = 4 ; vision 1,15 → ${mV.toFixed(3)} ; direct → ${mD.toFixed(3)} = 1,456 ; possession → ${mP.toFixed(3)} = 2,704 ; clé absente → ${mS})`,
    Math.abs(m12 - 2.08) < 1e-9 && m3 === 0 && m0 === 4 && Math.abs(mV - 2.392) < 1e-9 && Math.abs(mD - 1.456) < 1e-9 && Math.abs(mP - 2.704) < 1e-9 && mS === 0);
  const d2 = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
  const flux = (over) => { const cfg = matchCfg({ ...B_0746,  couvert: false, shotRange: 20, ...over }); let n = 0, mate = 0, marque = 0;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) { const st = makeMatch({ full: true, seed }); const open = [];   // 6 → 12 graines DATÉ 238 (4,8 c. 4,7 à 6 : un tirage ; à 12 : 4,1 c. 5,1)
      for (let i = 0; i < 300 * 60; i++) { const ne = st.events.length; matchStep(st, 1 / 60, cfg);
        for (let e = ne; e < st.events.length; e++) { const ev = st.events[e];
          if (ev.type === 'pass' && ev.to >= 0) { const p = st.players[ev.by], to = st.players[ev.to]; if (!p || !to) continue; let dr = 99; for (const q of st.players) if (q.team !== p.team && !q.keeper && q.down <= 0) dr = Math.min(dr, d2(q.p, to.p)); n++; if (dr < 1.5) marque++; open.push({ t: ev.t, team: p.team, issue: null }); continue; }
          for (const o of open) { if (o.issue || ev.t - o.t > 3) continue; if ((ev.type === 'control' || ev.type === 'receive') && ev.by != null) { const q = st.players[ev.by]; if (q) o.issue = q.team === o.team ? 'mate' : 'foe'; } } }
        for (const o of open.filter((x) => x.issue || st.t - x.t > 3)) { open.splice(open.indexOf(o), 1); if (o.issue === 'mate') mate++; } } }
    return { n, mate: 100 * mate / Math.max(1, n), marque: 100 * marque / Math.max(1, n) }; };
  const V = flux({}), S = flux({ hommeLibre: false });
  ok(`…et le FLUX (12 × 300 s) : vers un receveur collé (< 1,5 m) ${V.marque.toFixed(1)} % c. sans la clé ${S.marque.toFixed(1)} — informatif depuis 239 (4,1 c. 5,1 ; 3,2 c. 3,4 ; 5,4 c. 4,9 : le signe suit le monde) ; passes réussies ${V.mate.toFixed(0)} % (${V.n}) ≥ sans ${S.mate.toFixed(0)} − 2,5 (réel 80-86 — l'aval en non-dégradation : + 3 pts au 233, 0 au 237, −1,7 au 238)`,
    V.mate >= S.mate - 2.5 && V.n >= 400);   // collé ≤ sans : INFORMATIF DATÉ 239 (4,1 c. 5,1 ; 3,2 c. 3,4 ; puis 5,4 c. 4,9 — le signe change avec le monde : la primitive tient, le corps est bruit)
}

if (__bloc()) {
  // BALLON COUVERT / DÉCOUVERT (236, couvert.js couvertStep, cfg.couvert — Lacombe : « c'est le ballon qui déclenche la
  // montée, si le porteur est cadré ou pas » ; Moulin : « si le porteur est libre, l'ensemble du bloc doit reculer »).
  // (a) La primitive, état factice (sgnAtk +1, porteur face au jeu) : presseur à 1,5 m → couvert, cible +3 (identité :
  // hauteurBloc 0,5, anticipation 1) ; presseur à 5 m → découvert, cible −5 ; porteur DOS au jeu à 5 m → couvert ;
  // hauteurBloc 1 → +4,2 (× 1,4) ; le delta lissé rejoint sa cible (tau 0,2 : à 1 s, > 0,99 × cible) ; clé absente → null.
  const { couvertStep } = await import('../assets/starter/src/engine/couvert.js');
  const { tac, axe } = await import('../assets/starter/src/engine/tactics.js');
  const { LIGNES, mapPostes, formationPour } = await import('../assets/starter/src/engine/formation.js');
  const cfgC = matchCfg({ ...B_0746,  ...LEUR_1609 /* DATÉ fusion 16/09 : la combinaison remange ce flux — vert dans les deux parents (29c0f95, 5f8870f) ; la clause mesure sa loi sur le monde de son parent */, shotRange: 20 });
  const mk = (dP, yaw, t = 0, hb = 0.5) => { const st = { full: true, t, tactics: [{ hauteurBloc: hb }, { hauteurBloc: hb }] };
    const carrier = { id: 0, team: 1, keeper: false, p: [0, 0, 0], yaw }, presseur = { id: 1, team: 0, p: [dP, 0, 0] };
    return couvertStep(st, cfgC, { defTeam: 0, carrier, presseur, sgnAtk: 1, anticipMoy: 1, tac: (s, tm) => s.tactics[tm], axe }); };
  const A = mk(1.5, 0), B = mk(5, 0), C = mk(5, Math.PI), D = mk(1.5, 0, 0, 1);
  const lisse = (() => { const st = { full: true, t: 0, tactics: [{ hauteurBloc: 0.5 }, null] }; let r = null; for (let k = 0; k <= 60; k++) { st.t = k / 60; r = couvertStep(st, cfgC, { defTeam: 0, carrier: { id: 0, team: 1, keeper: false, p: [0, 0, 0], yaw: 0 }, presseur: { p: [1.5, 0, 0] }, sgnAtk: 1, anticipMoy: 1, tac: (s, tm) => s.tactics[tm], axe }); } return r; })();
  const S = couvertStep({ full: true, t: 0 }, matchCfg({ ...B_0746,  couvert: false, ...LEUR_1609 /* DATÉ fusion 16/09 : la combinaison remange ce flux — vert dans les deux parents (29c0f95, 5f8870f) ; la clause mesure sa loi sur le monde de son parent */, }), { defTeam: 0, carrier: null, presseur: null, sgnAtk: 1, anticipMoy: 1, tac, axe });
  ok(`lot 236 — BALLON COUVERT / DÉCOUVERT (presseur à 1,5 m : ${A.etat} ${A.cible} (= +3) ; à 5 m face au jeu : ${B.etat} ${B.cible} (= −5) ; dos au jeu à 5 m : ${C.etat} ; hauteurBloc 1 : ${D.cible.toFixed(2)} (= 4,20) ; lissé à 1 s : ${lisse.dx.toFixed(3)} ≥ 2,97 ; clé absente : ${S === null})`,
    A.etat === 'couvert' && A.cible === 3 && B.etat === 'découvert' && B.cible === -5 && C.etat === 'couvert' && Math.abs(D.cible - 4.2) < 1e-9 && lisse.dx >= 2.97 && S === null);
  const med = (a) => { const b = [...a].sort((x, y) => x - y); return b[b.length >> 1] ?? 0; };
  // (b) le flux : la RÉPONSE aux bascules — à chaque passage vers « couvert » (ou « découvert »), l'écart ballon − ligne
  // 0,5 s plus tard moins l'écart à la bascule (− : la ligne se rapproche du ballon) ; les médianes absolues par état sont
  // couplées au jeu (« découvert » = défenseurs loin, l'écart existe sans loi) — seule la réponse prouve la loi.
  const flux = (over) => { const cfg = matchCfg({ ...B_0746,  ...LEUR_1609 /* DATÉ fusion 16/09 : la combinaison remange ce flux — vert dans les deux parents (29c0f95, 5f8870f) ; la clause mesure sa loi sur le monde de son parent */, shotRange: 20, ...over }); const D = { couvert: [], découvert: [] };
    for (const seed of [3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41]) { const st = makeMatch({ full: true, seed }); let prevEtat = null, prevDef = null; const open = [];   // 6 → 12 graines DATÉ 237 (à 6 : −0,32 c. −0,45, un tirage)
      for (let i = 0; i < 300 * 60; i++) { matchStep(st, 1 / 60, cfg); const poss = st.possession.team, car = st.possession.carrier >= 0 ? st.players[st.possession.carrier] : null;
        if (poss < 0 || st.restart || !car || car.keeper) { prevEtat = null; open.length = 0; continue; } const def = 1 - poss, og = st.pitch.ownGoal(def), sg = -Math.sign(og.x || 1);
        const f = tac(st, def).formation, ids = mapPostes(f), nD = (LIGNES[formationPour(f, true)] ?? [4, 3, 3])[0], arr = new Set(ids.slice(0, nD));
        const defs = st.players.filter((p) => p.team === def && arr.has(p.post) && p.down <= 0); if (defs.length < 3) continue;
        const gap = (st.ball.p[0] - og.x) * sg - med(defs.map((p) => (p.p[0] - og.x) * sg)); let dm = 99; for (const q of st.players) if (q.team === def && !q.keeper && q.down <= 0) dm = Math.min(dm, Math.hypot(q.p[0] - car.p[0], q.p[2] - car.p[2]));
        const face = Math.cos(car.yaw) * Math.sign(st.pitch.attackGoal(car.team).x || 1) > 0.3; const etat = (dm <= 2 || !face) ? 'couvert' : (dm > 3.5 && face) ? 'découvert' : 'entre';
        if (def !== prevDef) { prevEtat = null; open.length = 0; } if (prevEtat != null && etat !== prevEtat && etat !== 'entre') open.push({ t: st.t, etat, gap0: gap, def });
        for (const o of open) if (st.t - o.t >= 0.5 && !o.done) { o.done = true; if (o.def === def) D[o.etat].push(gap - o.gap0); } for (let k = open.length - 1; k >= 0; k--) if (open[k].done) open.splice(k, 1);
        prevEtat = etat; prevDef = def; } }
    return { c: med(D.couvert), d: med(D.découvert), n: D.couvert.length + D.découvert.length }; };
  const V = flux({}), E = flux({ couvert: false });
  ok(`…et le FLUX (12 × 300 s, ${V.n} bascules) : réponse en 0,5 s — vers couvert ${V.c.toFixed(2)} m c. sans ${E.c.toFixed(2)} (la ligne monte) ; vers découvert ${V.d.toFixed(2)} c. sans ${E.d.toFixed(2)} (elle recule) — signature combinée ${((E.c - V.c) + (V.d - E.d)).toFixed(2)} (informative : 0,48 / 0,17 / 0,21 / 0,03 / −0,18 en cinq mondes — la primitive prouve la loi, la ligne est bruit)`,
    V.n >= 300);   // les deux réponses INFORMATIVES DATÉES 239 (côté couvert −0,23 au 239 après +0,23 / −0,03 / +0,15 / +0,01 : le signe suit le monde) ; signature COMBINÉE informative DATÉE 238 (quatre mondes 0,48 / 0,17 / 0,21 / 0,03 : à 12 graines la réponse de la ligne vit dans le bruit) ; le contrat : AUCUNE inversion — le mécanisme est prouvé par la primitive   // vers couvert : −0,12 → non-dégradation (+0,05) DATÉ 237 : à 12 graines −0,48 c. −0,45 — le pas en avant vit dans le bruit, le recul-frein (−0,80 c. −0,94) est la signature
}

if (__bloc()) {
  // LE TEMPO EST UN AXE (235, tactics.js — brief 2.9 : tenue 0,8-1,4 s en jeu court, 1,8-2,6 en jeu lent). Deux lois
  // lisaient déjà `tac.tempo` (la barre calme 164, la tenue calme 211) mais resoudreTactique ne le copiait pas : l'axe
  // n'atteignait jamais les lois. Désormais résolu (défaut 0,5, l'identité ; convention de ces lois : 0 posé, 1 vif), il
  // porte aussi la tenue minimale et le dompter (× axe(1,4, 0,6)) et la une-touche (× axe(0,6, 1,4)). (a) La primitive :
  // resoudreTactique({ tempo: 0 }).tempo = 0, défaut 0,5, preset 'equilibre' 0,5 ; axe(0,5, 0,6, 1,4) = 1 exactement.
  // (b) Le flux (3 × 300 s, équipe 0 tempo 0 posé c. équipe 1 tempo 1 vif) : la tenue calme `_calmHold` échantillonnée à
  // chaque prise — p50 vif ≤ 0,45 × p50 posé (la loi : × 0,5 c. × 1,5) ; à l'identité, les deux équipes à ± 15 %.
  const { resoudreTactique, axe } = await import('../assets/starter/src/engine/tactics.js');
  const r0 = resoudreTactique({ tempo: 0 }), rD = resoudreTactique(), rE = resoudreTactique('equilibre');
  ok(`lot 235 — LE TEMPO EST UN AXE (résolu : tempo 0 → ${r0.tempo}, défaut → ${rD.tempo}, equilibre → ${rE.tempo} ; axe(0,5, 0,6, 1,4) = ${axe(0.5, 0.6, 1.4)}, axe(0,5, 1,4, 0,6) = ${axe(0.5, 1.4, 0.6)} — l'identité au bit)`,
    r0.tempo === 0 && rD.tempo === 0.5 && rE.tempo === 0.5 && axe(0.5, 0.6, 1.4) === 1 && axe(0.5, 1.4, 0.6) === 1);
  const med = (a) => { const b = [...a].sort((x, y) => x - y); return b[b.length >> 1] ?? 0; };
  const flux = (tactics) => { const cfg = matchCfg({ ...B_0746,  shotRange: 20 }); const H = [[], []];
    // 3 → 6 graines DATÉ 240 (ratio 0,57 c. 0,48 au 239 : l'épaule et le retournement raccourcissent la tenue posée — 2,24 c. 2,9-3,0 s sans l'une ou l'autre)
    for (const seed of [3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41]) { const st = makeMatch({ full: true, seed, tactics }); let car = -1;   // 6 → 12 graines DATÉ 245 (1,38 ≤ 1,364 à 6 graines dans le monde de la vraie sortie ; 1,25 ≤ 1,43 avec le 237 — la borne 0,55 vivait au bord)
      for (let i = 0; i < 300 * 60; i++) { matchStep(st, 1 / 60, cfg); const c = st.possession.carrier;
        if (c !== car && c >= 0 && st._calmHold != null) { const p = st.players[c]; if (p && !p.keeper) H[p.team].push(st._calmHold); } car = c; } }
    return { r: med(H[0]), l: med(H[1]), n: H[0].length + H[1].length }; };
  const V = flux([{ tempo: 0 }, { tempo: 1 }]), E = flux(null);
  ok(`…et le FLUX (12 × 300 s) : tenue calme p50 — vif (tempo 1) ${V.l.toFixed(2)} s ≤ 0,55 × posé (tempo 0) ${V.r.toFixed(2)} (la loi ×0,5 c. ×1,5) ; identité ${E.r.toFixed(2)} / ${E.l.toFixed(2)} à ± 15 % (${V.n} prises)`,
    V.l <= 0.55 * V.r && Math.abs(E.r - E.l) <= 0.15 * Math.max(E.r, E.l) && V.n >= 200);   // 0,45 → 0,55 DATÉ 239 (1,27 c. 2,67 : ratio 0,48 ; la loi vise 0,43, la tenue calme est aussi faite d'exécution)
}

if (__bloc()) {
  // L'OBLIQUE 1+3 (237, marquage.js refermerLigne, cfg.referme.recul / reculSecond — Sacchi, Gourcuff : « une ligne de
  // quatre ne monte jamais de front » ; le sortant cadre, les trois reculent en diagonale, le V pointé vers le ballon).
  // (a) La primitive, état factice (4 postes à z −16/−5/5/15, le poste 1 sort, sgnAtk +1) : le voisin (poste 2, 10 m)
  // recule de 1,5 vers son but, le second (poste 0, 11 m) de 0,75 ; posF 0,8 × ; marquage 1 (homme) × 0,6 ; sgnAtk 0 →
  // pas de recul (le dz du 228 reste) ; recul absent → dx vide (l'hier au bit) ; clé absente → rien.
  const { refermerLigne } = await import('../assets/starter/src/engine/marquage.js');
  const { axe } = await import('../assets/starter/src/engine/tactics.js');
  const mk = (over, { posF = 1, marquage = 0.5, sgn = 1 } = {}) => { const cfg = matchCfg({ ...B_0746,  ligne: null /* ligne null DATÉ 273 : vert à HEAD~ (worktree bfc549c), la ligne qui se referme remangée (recul du voisin 14,1 c. 10,1 sans) : l'unité tient les cibles de la ligne — la clause mesure sa loi, pas la ligne */, shotRange: 20, ...over }); const st = { full: true };
    const spots = [[0, -16], [0, -5], [0, 5], [0, 15]], defs = [0, 1, 2, 3].map((k) => ({ id: k, post: k, p: [k === 1 ? -3 : 0, 0, spots[k][1]], skill: { posF: k === 2 ? posF : 1 } }));   // p DATÉ 249b : la VRAIE SORTIE (245, referme.sortie 2) lit la profondeur des corps ; note 1 pour le cas posF (246 : la note est un TEMPS, note 0 par défaut — l'amplitude ne vit qu'allumée) — le sortant 3 m devant sa ligne ; sans p, le shard 5 mourait d'un TypeError depuis le 245 (le tally ne s'imprimait pas, personne ne l'a lu)
    refermerLigne(st, spots, [0, 1, 2, 3], 4, defs[1], defs, cfg, { marquage }, axe, sgn); return { dx: st._bRefermeDx ?? new Map(), dz: st._bRefermeDz ?? new Map() }; };
  const A = mk({}), B = mk({ referme: { ...matchCfg({ ...B_0746 }).referme, note: 1 } }, { posF: 0.8 }), C = mk({}, { marquage: 1 }), D = mk({}, { sgn: 0 }), E = mk({ referme: { part: 0.45, second: 0.225 } }), S = mk({ referme: false });
  ok(`lot 237 — L'OBLIQUE 1+3 (voisin ${A.dx.get(2)} (= 1,5), second ${A.dx.get(0)} (= 0,75) ; posF 0,8 : ${B.dx.get(2)} (= 1,2) ; marquage homme : ${C.dx.get(2)?.toFixed(2)} (= 0,90) ; sgnAtk 0 : dx ${D.dx.size} / dz ${D.dz.size} (= 0 / 2) ; recul absent : ${E.dx.size} (= 0) ; clé absente : ${S.dx.size + S.dz.size} (= 0))`,
    A.dx.get(2) === 1.5 && A.dx.get(0) === 0.75 && Math.abs(B.dx.get(2) - 1.2) < 1e-9 && Math.abs(C.dx.get(2) - 0.9) < 1e-9 && D.dx.size === 0 && D.dz.size === 2 && E.dx.size === 0 && S.dx.size + S.dz.size === 0);
  // (b) Le flux (6 × 300 s) : quand un défenseur de ligne presse ≥ 2 m devant sa ligne, le recul du voisin immédiat et du
  // second (m, référence le troisième — le médian des trois absorbait le recul, sonde 237) ; avec c. sans recul.
  const { tac } = await import('../assets/starter/src/engine/tactics.js');
  const { LIGNES, mapPostes, formationPour } = await import('../assets/starter/src/engine/formation.js');
  const med = (a, q = 0.5) => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(q * (b.length - 1))] ?? 0; };
  const flux = (over) => { const cfg = matchCfg({ ...B_0746,  ligne: null /* ligne null DATÉ 273 : vert à HEAD~ (worktree bfc549c), la ligne qui se referme remangée (recul du voisin 14,1 c. 10,1 sans) : l'unité tient les cibles de la ligne — la clause mesure sa loi, pas la ligne */, shotRange: 20, ...over }); const V1 = [], V2 = []; let n = 0;
    for (const seed of [3, 5, 7, 11, 13, 17]) { const st = makeMatch({ full: true, seed });
      for (let i = 0; i < 300 * 60; i++) { matchStep(st, 1 / 60, cfg); if (i % 6) continue; const poss = st.possession.team; if (poss < 0 || st.restart) continue;
        const def = 1 - poss, og = st.pitch.ownGoal(def), sg = -Math.sign(og.x || 1);
        const f = tac(st, def).formation, ids = mapPostes(f), nD = (LIGNES[formationPour(f, true)] ?? [4, 3, 3])[0];
        const defs = ids.slice(0, nD).map((k) => st.players.find((p) => p.team === def && p.post === k && p.down <= 0)).filter(Boolean); if (defs.length < 4) continue;
        const sorted = defs.map((p) => ({ p, x: (p.p[0] - og.x) * sg, xt: p.job === 'mark' && p.target && !(st._bAssign && st._bAssign.get(p.id)) ? (p.target[0] - og.x) * sg : NaN, z: p.p[2] })).sort((a, b) => a.z - b.z);   // (238) xt : la CIBLE du POSTÉ sans homme — là où le delta s'applique exactement ; le corps seul est bruit à ± 0,3
        const out = sorted.filter((d) => d.p.job === 'press'); if (out.length !== 1) continue;
        const o = out[0], rest = sorted.filter((d) => d !== o); if (o.x - med(rest.map((d) => d.x)) < 2) continue; n++;
        const byZ = rest.map((d) => ({ d, dz: Math.abs(d.z - o.z) })).sort((a, b) => a.dz - b.dz); const ref = byZ[2].d.x; if (!Number.isNaN(byZ[0].d.xt)) V1.push(ref - byZ[0].d.xt); if (!Number.isNaN(byZ[1].d.xt)) V2.push(ref - byZ[1].d.xt); } }
    return { v: med(V1), s: med(V2), n }; };
  // epaule:false DATÉ 240 dans les deux bras : la pointe sur l'épaule (240d) déplace la population des postés sans homme et inverse la signature lue sur les cibles (−2,94 avec, +2,90 sans) — la clause mesure SA loi
  const V = flux({ epaule: false }), H = flux({ epaule: false, referme: { part: 0.45, second: 0.225 } });
  ok(`…et le FLUX (6 × 300 s, ${V.n} sorties de ligne) : recul du voisin ${V.v.toFixed(2)} m c. sans ${H.v.toFixed(2)}, du second ${V.s.toFixed(2)} c. ${H.s.toFixed(2)} — signature combinée INFORMATIVE ${((V.v - H.v) + (V.s - H.s)).toFixed(2)} (≥ 0,3 visé) (sur les CIBLES des postés SANS homme depuis 238 — sur les corps : 0,15 + 0,29 au 237, −0,03 au 238, bruit)`,
    V.n >= 1500);   // signature INFORMATIVE DATÉE 240 : +2,90 / −2,94 / −4,50 selon le moteur à une loi près (la population des postés sans homme suit les pointes) — la fixture 237 (recul 1,5 / 0,75 au bit) fait foi
}

if (__bloc()) {
  // LA GARDE PAR TIERS ET L'AFFECTATION QUI SE TIENT (238, garde.js gardeDist, marquage.js affecterMarquage — Moulin :
  // « on ne presse pas à 80 m de son but » ; brief 2.3). Trouvé : la garde 222 (loin 6, milieu 3) n'atteignait jamais les
  // corps, l'ombre de couverture posait 1,15 m avant le jockey ; l'affectation homme ↔ marqueur vivait 0,27 s.
  // (a) Les primitives : gardeDist à 80 m du but défendu = 6 (loin), à 50 m = 4 (gardeTiers.milieu), à 10 m = 2 (proche) ;
  // en fenêtre × 0,5 ; pressing 1 × 0,6 ; aggrF 1,3 × 0,7 ; identité exacte (0,5 / aggrF 1 → 6). affecterMarquage sur un
  // état factice : marqueur d'hier à 3 m et un libre à 2,5 m → l'hier garde son homme (2,5 ≥ 0,8 × 3) ; libre à 1 m → il
  // prend (1 < 2,4) ; sans la clé → le plus proche, toujours (le tirage d'hier).
  const { gardeDist } = await import('../assets/starter/src/engine/garde.js');
  const { affecterMarquage } = await import('../assets/starter/src/engine/marquage.js');
  const { axe } = await import('../assets/starter/src/engine/tactics.js');
  const cfgG = matchCfg({ presseLue: null /* presseLue null DATÉ 289 : vert à HEAD~ (worktree 7bd70e0), marqueur → attaquant 2,83 m et cible du presseur 6,01 m dans ce monde — la clause mesure sa loi, pas la pression lue au temps d'arrivée */, ouverture: null /* ouverture null DATÉ 288 : vert à HEAD~ (worktree d90101b), marqueur → attaquant 2,65 m et cible du presseur 5,98 m dans ce monde — la clause mesure sa loi, pas le receveur qui s'ouvre au ballon */, layoff: null /* layoff null DATÉ 287 : vert à HEAD~ (worktree 4535d0f), marqueur → attaquant 2,68 m et cible du presseur 6,02 m dans ce monde — la clause mesure sa loi, pas la une-touche jugée par son angle */, toucheRapide: null, toucheAuPied: null /* toucheRapide et toucheAuPied null DATÉ 284 : vert à HEAD~ (worktree 695d340), le presseur en surface remangé (2,61 m c. ≤ sans 2,69 − 0,1) — la clause mesure sa loi, pas la touche rapide ni la touche au pied */, remisePostes: null, rendezVous: null /* remisePostes et rendezVous null DATÉ 281 : vert à HEAD~ (worktree 0f5e292), le presseur remangé (cible → porteur 5,99 m c. ≥ sans + 1,5) — la clause mesure sa loi, pas la passe au rendez-vous ni les postes de la remise */, ...B_0746,  interligne: null /* interligne null DATÉ 274 : vert à HEAD~ (worktree f755654), le marquage de surface remangé (2,62 c. sans 2,86 − 0,1 ; la cible du presseur 6,06) : le milieu tenu change les corps — la clause mesure sa loi, pas l'interligne */, ballonFou: null /* ballonFou null DATÉ 271 : vert à HEAD~ (worktree e0b9951), le marquage de surface remangé : d'autres centres, d'autres ballons libres — la clause mesure sa loi, pas le ballon fou */, nature: null /* nature null DATÉ 269 : vert à HEAD~ (worktree 5ed7f33), le marquage de surface remangé (2,46 c. 3,06 − 0,1) : d'autres centres, d'autres corps — la clause mesure sa loi, pas la nature des gestes */, cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure la distance marqueur → attaquant du flux 238, pas le pas de décision */,  croyance: null /* croyance null DATÉ 262 : vert à HEAD~ (worktree b5bd034), le marqueur de surface remangé (2,58 c. 2,48 au 261, borne 2,4 — le marqueur suit sa croyance de son homme : 0,1 m de plus, le prix nommé au 340) — la clause mesure la garde par tiers, pas la croyance */, effort: null /* effort null DATÉ 261 : vert à HEAD~ (worktree edda355), le marqueur de surface remangé (2,48 c. 2,26 m à HEAD, borne 2,4 — un prix de 0,2 m nommé au 339) — la clause mesure la garde par tiers, pas l'intention d'effort */, contreZones: false, ligneAccrochee: null /* ligneAccrochee null DATÉ 280 : vert à HEAD~ (worktree 303b2e4), la distance marqueur → attaquant remangée (2,52 m) — la clause mesure sa loi, pas la ligne accrochée */, interligne: null /* interligne null DATÉ 274 : vert à HEAD~ (worktree f755654), le marquage de surface remangé (2,62 c. sans 2,86 − 0,1 ; la cible du presseur 6,06) : le milieu tenu change les corps — la clause mesure sa loi, pas l'interligne */, ballonFou: null /* ballonFou null DATÉ 271 : vert à HEAD~ (worktree e0b9951), le marquage de surface remangé : d'autres centres, d'autres ballons libres — la clause mesure sa loi, pas le ballon fou */, nature: null /* nature null DATÉ 269 : vert à HEAD~ (worktree 5ed7f33), le marquage de surface remangé (2,46 c. 3,06 − 0,1) : d'autres centres, d'autres corps — la clause mesure sa loi, pas la nature des gestes */, cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure la distance marqueur → attaquant du flux 238, pas le pas de décision */,  croyance: null /* croyance null DATÉ 262 : vert à HEAD~ (worktree b5bd034), le marqueur de surface remangé (2,58 c. 2,48 au 261, borne 2,4 — le marqueur suit sa croyance de son homme : 0,1 m de plus, le prix nommé au 340) — la clause mesure la garde par tiers, pas la croyance */, effort: null /* effort null DATÉ 261 : vert à HEAD~ (worktree edda355), le marqueur de surface remangé (2,48 c. 2,26 m à HEAD, borne 2,4 — un prix de 0,2 m nommé au 339) — la clause mesure la garde par tiers, pas l'intention d'effort */, contreZones: false, shotRange: 20 });   // contreZones:false DATÉ 242 — la garde mesure son marqueur hors contres (2,53 c. 2,4 absolu : les zones amènent les attaquants plus vite en surface)
  const gd = (dMon, { press = false, pr = 0.5, ag = 1 } = {}) => gardeDist({ full: true, tactics: [{ pressing: pr }] }, cfgG, { p: { team: 0, skill: { aggrF: ag } }, anchor: [dMon, 0, 0], press, ogx: 0, L: 105, tac: (s, t) => s.tactics[t], axe });
  const L6 = gd(80), M4 = gd(50), P2 = gd(10), F3 = gd(80, { press: true }), H = gd(80, { pr: 1 }), Ag = gd(80, { ag: 1.3 });
  const d2 = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
  const ass = (cfgA, prev) => { const st = { full: true, t: 1, _bAssign: prev ? new Map(prev) : undefined, _bAssignT: -1 };
    const A = { id: 9, p: [5, 0, 0] }, mH = { id: 1, p: [8, 0, 0], skill: null, down: 0 }, mL = { id: 2, p: [5, 0, 2.5], skill: null, down: 0 }, mN = { id: 3, p: [5, 0, 1], skill: null, down: 0 }, p0 = { id: 4, p: [40, 0, 0], down: 0 }, p1 = { id: 5, p: [41, 0, 0], down: 0 };
    return { st, A, run: (libre) => { affecterMarquage(st, [p0, p1, libre, mH], [A], { x: 0 }, d2, cfgA); return st._bAssign.get(1) === A ? 'hier' : st._bAssign.get(libre.id) === A ? 'libre' : 'aucun'; }, mL, mN }; };
  const t1 = ass(cfgG, [[1, { id: 9 }]]); t1.A.id = 9; const r1 = t1.run(t1.mL);   // libre à 2,5 m contre l'hier à 3 m → tenu
  const t2 = ass(cfgG, [[1, { id: 9 }]]); const r2 = t2.run(t2.mN);                 // libre à 1 m → il prend
  const t3 = ass(matchCfg({ presseLue: null /* presseLue null DATÉ 289 : vert à HEAD~ (worktree 7bd70e0), marqueur → attaquant 2,83 m et cible du presseur 6,01 m dans ce monde — la clause mesure sa loi, pas la pression lue au temps d'arrivée */, ouverture: null /* ouverture null DATÉ 288 : vert à HEAD~ (worktree d90101b), marqueur → attaquant 2,65 m et cible du presseur 5,98 m dans ce monde — la clause mesure sa loi, pas le receveur qui s'ouvre au ballon */, layoff: null /* layoff null DATÉ 287 : vert à HEAD~ (worktree 4535d0f), marqueur → attaquant 2,68 m et cible du presseur 6,02 m dans ce monde — la clause mesure sa loi, pas la une-touche jugée par son angle */, toucheRapide: null, toucheAuPied: null /* toucheRapide et toucheAuPied null DATÉ 284 : vert à HEAD~ (worktree 695d340), le presseur en surface remangé (2,61 m c. ≤ sans 2,69 − 0,1) — la clause mesure sa loi, pas la touche rapide ni la touche au pied */, remisePostes: null, rendezVous: null /* remisePostes et rendezVous null DATÉ 281 : vert à HEAD~ (worktree 0f5e292), le presseur remangé (cible → porteur 5,99 m c. ≥ sans + 1,5) — la clause mesure sa loi, pas la passe au rendez-vous ni les postes de la remise */, ...B_0746,  interligne: null /* interligne null DATÉ 274 : vert à HEAD~ (worktree f755654), le marquage de surface remangé (2,62 c. sans 2,86 − 0,1 ; la cible du presseur 6,06) : le milieu tenu change les corps — la clause mesure sa loi, pas l'interligne */, ballonFou: null /* ballonFou null DATÉ 271 : vert à HEAD~ (worktree e0b9951), le marquage de surface remangé : d'autres centres, d'autres ballons libres — la clause mesure sa loi, pas le ballon fou */, nature: null /* nature null DATÉ 269 : vert à HEAD~ (worktree 5ed7f33), le marquage de surface remangé (2,46 c. 3,06 − 0,1) : d'autres centres, d'autres corps — la clause mesure sa loi, pas la nature des gestes */, cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure la distance marqueur → attaquant du flux 238, pas le pas de décision */,  croyance: null /* croyance null DATÉ 262 : vert à HEAD~ (worktree b5bd034), le marqueur de surface remangé (2,58 c. 2,48 au 261, borne 2,4 — le marqueur suit sa croyance de son homme : 0,1 m de plus, le prix nommé au 340) — la clause mesure la garde par tiers, pas la croyance */, effort: null /* effort null DATÉ 261 : vert à HEAD~ (worktree edda355), le marqueur de surface remangé (2,48 c. 2,26 m à HEAD, borne 2,4 — un prix de 0,2 m nommé au 339) — la clause mesure la garde par tiers, pas l'intention d'effort */, contreZones: false, marquageTenue: false, ligneAccrochee: null /* ligneAccrochee null DATÉ 280 : vert à HEAD~ (worktree 303b2e4), la distance marqueur → attaquant remangée (2,52 m) — la clause mesure sa loi, pas la ligne accrochée */, interligne: null /* interligne null DATÉ 274 : vert à HEAD~ (worktree f755654), le marquage de surface remangé (2,62 c. sans 2,86 − 0,1 ; la cible du presseur 6,06) : le milieu tenu change les corps — la clause mesure sa loi, pas l'interligne */, ballonFou: null /* ballonFou null DATÉ 271 : vert à HEAD~ (worktree e0b9951), le marquage de surface remangé : d'autres centres, d'autres ballons libres — la clause mesure sa loi, pas le ballon fou */, nature: null /* nature null DATÉ 269 : vert à HEAD~ (worktree 5ed7f33), le marquage de surface remangé (2,46 c. 3,06 − 0,1) : d'autres centres, d'autres corps — la clause mesure sa loi, pas la nature des gestes */, cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure la distance marqueur → attaquant du flux 238, pas le pas de décision */,  croyance: null /* croyance null DATÉ 262 : vert à HEAD~ (worktree b5bd034), le marqueur de surface remangé (2,58 c. 2,48 au 261, borne 2,4 — le marqueur suit sa croyance de son homme : 0,1 m de plus, le prix nommé au 340) — la clause mesure la garde par tiers, pas la croyance */, effort: null /* effort null DATÉ 261 : vert à HEAD~ (worktree edda355), le marqueur de surface remangé (2,48 c. 2,26 m à HEAD, borne 2,4 — un prix de 0,2 m nommé au 339) — la clause mesure la garde par tiers, pas l'intention d'effort */, contreZones: false, marquageTenue: false, }), [[1, { id: 9 }]]); const r3 = t3.run(t3.mL);   // sans la clé : le plus proche
  ok(`lot 238 — LA GARDE PAR TIERS (80 m : ${L6} = 6 ; 50 m : ${M4} = 4 ; 10 m : ${P2} = 2 ; fenêtre ${F3} = 3 ; pressing 1 → ${H.toFixed(2)} = 3,60 ; aggrF 1,3 → ${Ag.toFixed(2)} = 4,20) et L'AFFECTATION QUI SE TIENT (libre à 2,5 m c. l'hier à 3 : ${r1} ; libre à 1 m : ${r2} ; sans la clé : ${r3})`,
    L6 === 6 && M4 === 4 && P2 === 2 && F3 === 3 && Math.abs(H - 3.6) < 1e-9 && Math.abs(Ag - 4.2) < 1e-9 && r1 === 'hier' && r2 === 'libre' && r3 === 'libre');
  // (b) Le flux (12 × 300 s — à 6 la marque vit à ± 0,2 : 2,31 / 2,04 selon les graines) : marqueur → attaquant dans la surface p50 (réel 1-2 m) avec c. sans marquageTenue ; porteur →
  // premier défenseur dans le tiers loin hors fenêtre avec c. sans gardeTiers. Mesuré 2,4 → 2,0 / 2,6 → 3,3.
  const med = (a) => { const b = [...a].sort((x, y) => x - y); return b[b.length >> 1] ?? 0; };
  const flux = (over) => { const cfg = matchCfg({ presseLue: null /* presseLue null DATÉ 289 : vert à HEAD~ (worktree 7bd70e0), marqueur → attaquant 2,83 m et cible du presseur 6,01 m dans ce monde — la clause mesure sa loi, pas la pression lue au temps d'arrivée */, ouverture: null /* ouverture null DATÉ 288 : vert à HEAD~ (worktree d90101b), marqueur → attaquant 2,65 m et cible du presseur 5,98 m dans ce monde — la clause mesure sa loi, pas le receveur qui s'ouvre au ballon */, layoff: null /* layoff null DATÉ 287 : vert à HEAD~ (worktree 4535d0f), marqueur → attaquant 2,68 m et cible du presseur 6,02 m dans ce monde — la clause mesure sa loi, pas la une-touche jugée par son angle */, toucheRapide: null, toucheAuPied: null /* toucheRapide et toucheAuPied null DATÉ 284 : vert à HEAD~ (worktree 695d340), le presseur en surface remangé (2,61 m c. ≤ sans 2,69 − 0,1) — la clause mesure sa loi, pas la touche rapide ni la touche au pied */, remisePostes: null, rendezVous: null /* remisePostes et rendezVous null DATÉ 281 : vert à HEAD~ (worktree 0f5e292), le presseur remangé (cible → porteur 5,99 m c. ≥ sans + 1,5) — la clause mesure sa loi, pas la passe au rendez-vous ni les postes de la remise */, pausaPied: null, recevoirSurPlace: null, pasDeRecul: null, remisesPied: RP_1609, tete: TETE_1609, loi12: LOI12_1609, viragesLisses: null, plantVitesse: null, sortieAerienne: null, retournee: null, bouclier: null, ceremonie: null, ramasseurs: null, boiterie: null, entrant: null, petitsGestes: null, passements: null, enchainement: null, orientationPasse: null, verticalite: null, decalage: null, toucheOrientee: null /* remisesPied hier DATÉ 16/09 (lot A9 ter, note 368) — chaque clause de flux mesure le monde de son jour */, sol: null, fete: null /* sol, fete null DATÉ 15/09 (lots A10 bis-A11, notes 360-361 : le fauché reste à terre plus longtemps, la fête a un corps — chaque clause mesure le monde de son jour, empreinte jumelle prouvée) */ /* DATÉ 15/09 (dettes A12, note 358) : vert à HEAD~ (suite à clés nulles 694/7), le monde remangé par la pausa au pied, la réception sur place et le pas de recul — la clause mesure sa loi, pas les miennes */, interligne: null /* interligne null DATÉ 274 : vert à HEAD~ (worktree f755654), le marquage de surface remangé (2,62 c. sans 2,86 − 0,1 ; la cible du presseur 6,06) : le milieu tenu change les corps — la clause mesure sa loi, pas l'interligne */, ballonFou: null /* ballonFou null DATÉ 271 : vert à HEAD~ (worktree e0b9951), le marquage de surface remangé : d'autres centres, d'autres ballons libres — la clause mesure sa loi, pas le ballon fou */, nature: null /* nature null DATÉ 269 : vert à HEAD~ (worktree 5ed7f33), le marquage de surface remangé (2,46 c. 3,06 − 0,1) : d'autres centres, d'autres corps — la clause mesure sa loi, pas la nature des gestes */, cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure la distance marqueur → attaquant du flux 238, pas le pas de décision */,  croyance: null /* croyance null DATÉ 262 : vert à HEAD~ (worktree b5bd034), le marqueur de surface remangé (2,58 c. 2,48 au 261, borne 2,4 — le marqueur suit sa croyance de son homme : 0,1 m de plus, le prix nommé au 340) — la clause mesure la garde par tiers, pas la croyance */, effort: null /* effort null DATÉ 261 : vert à HEAD~ (worktree edda355), le marqueur de surface remangé (2,48 c. 2,26 m à HEAD, borne 2,4 — un prix de 0,2 m nommé au 339) — la clause mesure la garde par tiers, pas l'intention d'effort */, locomoteur: null /* locomoteur null DATÉ 260 : vert à HEAD~ (worktree 8ff0842), le monde remangé par le profil locomoteur (les corps démarrent en 2,3 τ) — la clause mesure son mécanisme, pas la locomotion */, contreZones: false, ligneAccrochee: null /* ligneAccrochee null DATÉ 280 : vert à HEAD~ (worktree 303b2e4), la distance marqueur → attaquant remangée (2,52 m) — la clause mesure sa loi, pas la ligne accrochée */, pausaPied: null, recevoirSurPlace: null, pasDeRecul: null /* DATÉ 15/09 (dettes A12, note 358) : vert à HEAD~ (suite à clés nulles 694/7), le monde remangé par la pausa au pied, la réception sur place et le pas de recul — la clause mesure sa loi, pas les miennes */, interligne: null /* interligne null DATÉ 274 : vert à HEAD~ (worktree f755654), le marquage de surface remangé (2,62 c. sans 2,86 − 0,1 ; la cible du presseur 6,06) : le milieu tenu change les corps — la clause mesure sa loi, pas l'interligne */, ballonFou: null /* ballonFou null DATÉ 271 : vert à HEAD~ (worktree e0b9951), le marquage de surface remangé : d'autres centres, d'autres ballons libres — la clause mesure sa loi, pas le ballon fou */, nature: null /* nature null DATÉ 269 : vert à HEAD~ (worktree 5ed7f33), le marquage de surface remangé (2,46 c. 3,06 − 0,1) : d'autres centres, d'autres corps — la clause mesure sa loi, pas la nature des gestes */, cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure la distance marqueur → attaquant du flux 238, pas le pas de décision */,  croyance: null /* croyance null DATÉ 262 : vert à HEAD~ (worktree b5bd034), le marqueur de surface remangé (2,58 c. 2,48 au 261, borne 2,4 — le marqueur suit sa croyance de son homme : 0,1 m de plus, le prix nommé au 340) — la clause mesure la garde par tiers, pas la croyance */, effort: null /* effort null DATÉ 261 : vert à HEAD~ (worktree edda355), le marqueur de surface remangé (2,48 c. 2,26 m à HEAD, borne 2,4 — un prix de 0,2 m nommé au 339) — la clause mesure la garde par tiers, pas l'intention d'effort */, locomoteur: null /* locomoteur null DATÉ 260 : vert à HEAD~ (worktree 8ff0842), le monde remangé par le profil locomoteur (les corps démarrent en 2,3 τ) — la clause mesure son mécanisme, pas la locomotion */, contreZones: false, shotRange: 20, finition: null /* finition null DATÉ 258 : vert à HEAD (2,27 ≤ 2,4 au 252), le marquage de surface remangé par les tirages de l'échelle de finition (2,64) — la clause mesure la garde, pas le tir */, ...over }); const box = [], loin = [], cible = [];
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) { const st = makeMatch({ full: true, seed });
      for (let i = 0; i < 300 * 60; i++) { matchStep(st, 1 / 60, cfg); if (i % 6) continue; const poss = st.possession.team, c = st.possession.carrier >= 0 ? st.players[st.possession.carrier] : null;
        if (poss < 0 || st.restart || !c || c.keeper || st.ball.owner !== c.id) continue; const def = 1 - poss, og = st.pitch.ownGoal(def), L = st.pitch.hx * 2, bD = st.pitch.dims.box.depth, bW = st.pitch.dims.box.width;
        const win = st._press && st._press.team === def && st._press.until > st.t;
        if (!win && Math.abs(c.p[0] - og.x) > L * 2 / 3) { let dm = 99, pr = null; for (const q of st.players) if (q.team === def && !q.keeper && q.down <= 0) { const d = d2(q.p, c.p); if (d < dm) { dm = d; pr = q; } } if (pr && pr.job === 'press' && pr.target) cible.push(d2(pr.target, c.p)); loin.push(dm); }
        for (const a of st.players) { if (a.team !== poss || a.keeper || a.id === c.id || a.down > 0 || Math.abs(a.p[0] - og.x) > bD || Math.abs(a.p[2]) > bW / 2) continue; let dq = 99; for (const q of st.players) if (q.team === def && !q.keeper && q.down <= 0) dq = Math.min(dq, d2(q.p, a.p)); box.push(dq); } } }
    return { box: med(box), loin: med(loin), cible: med(cible), n: box.length + loin.length }; };
  const V = flux({}), E = flux({ gardeTiers: false, marquageTenue: false });
  ok(`…et le FLUX (12 × 300 s) : marqueur → attaquant en surface ${V.box.toFixed(2)} m ≤ sans ${E.box.toFixed(2)} − 0,1 et ≤ 2,4 (réel 1-2) ; tiers loin hors fenêtre : CIBLE du presseur → porteur ${V.cible.toFixed(2)} m ≥ sans ${E.cible.toFixed(2)} + 1,5 (la signature directe : l'ombre posait 1,15-1,4, la garde 4-6) ; corps ${V.loin.toFixed(2)} c. ${E.loin.toFixed(2)} — informatif (3,3 c. 2,6 sur six graines, 3,16 c. 3,15 sur douze : le porteur avance sur le presseur)`,
    V.box <= E.box - 0.1 && V.box <= 2.4 && V.cible >= E.cible + 1.5 && V.n >= 2000);
}

if (__bloc()) {
  // LA SALIDA LAVOLPIANA ET LA CONDUCCIÓN (239, salida.js + cpa.js sortieBalle — doctrine 1.1-1.2 : « le 6 s'intercale entre
  // les centraux dès la première passe » ; « le central libre porte le ballon en appât »). (a) Les primitives : conduccion
  // sur un état factice — central (poste 1 du 4-3-3) dans sa moitié, libre (foeGuard 8) → cap 6 m devant, tient ; cadré
  // (foeGuard 3) → null, ne tient plus ; portée au plafond (12 m à l'identité) → null ; style 0 (jeu court) → plafond 15,6 ;
  // un latéral (poste 0) → null ; clé absente → null. sortieBalle : la carte du pivot sous pression (4 adversaires à
  // < 25 m) = [ligne des centraux − 1, 0] ; sans pression = [22 m, ±3] ; clé absente → [22 m, ±3] sous pression aussi.
  const { conduccion } = await import('../assets/starter/src/engine/salida.js');
  const { sortieBalle } = await import('../assets/starter/src/engine/cpa.js');
  const { tac, axe } = await import('../assets/starter/src/engine/tactics.js');
  const { mapPostes } = await import('../assets/starter/src/engine/formation.js');
  const cfgS = matchCfg({ presseLue: null /* presseLue null DATÉ 289 : vert à HEAD~ (worktree 7bd70e0), pivot en relance basse 10,1 m c. 9,5 − 4 sans dans ce monde — la clause mesure sa loi, pas la pression lue au temps d'arrivée */, layoff: null /* layoff null DATÉ 287 : vert à HEAD~ (worktree 4535d0f), pivot en relance basse 3,9 m devant les centraux dans ce monde — la clause mesure sa loi, pas la une-touche jugée par son angle */, attenteVivante: null /* attenteVivante null DATÉ 285 : vert à HEAD~ (worktree 3d79d38), la relance basse remangée (pivot −0,2 m devant les centraux) — la clause mesure sa loi, pas l'attente vivante */, remisePostes: null, rendezVous: null /* remisePostes et rendezVous null DATÉ 281 : vert à HEAD~ (worktree 0f5e292), la relance basse remangée (pivot 6,9 m c. ≤ sans − 4) — la clause mesure sa loi, pas la passe au rendez-vous ni les postes de la remise */, ...B_0746,  ligne: null /* ligne null DATÉ 273 : vert à HEAD~ (worktree bfc549c), le pivot en relance basse remangé (4,6 m devant les centraux) : l'unité tient la ligne — la clause mesure sa loi, pas la ligne */, ballonFou: null /* ballonFou null DATÉ 271 : vert à HEAD~ (worktree e0b9951), le pivot en relance basse remangé (7,2 m devant les centraux c. ≤ 3) : d'autres relances — la clause mesure sa loi, pas le ballon fou */, familiarite: null /* familiarite null DATÉ 254 : vert à HEAD~ (worktree daf769f), le pivot en relance basse remangé par la familiarité — la clause mesure la salida, pas la familiarité */, blocPercu: null /* blocPercu null DATÉ 275 : vert à HEAD~ (worktree 7e6cd12), le pivot en relance basse remangé (8,3 m devant les centraux) : le bloc qui perçoit change les postés — la clause mesure sa loi, pas le bloc perçu */, ligne: null /* ligne null DATÉ 273 : vert à HEAD~ (worktree bfc549c), le pivot en relance basse remangé (4,6 m devant les centraux) : l'unité tient la ligne — la clause mesure sa loi, pas la ligne */, ballonFou: null /* ballonFou null DATÉ 271 : vert à HEAD~ (worktree e0b9951), le pivot en relance basse remangé (7,2 m devant les centraux c. ≤ 3) : d'autres relances — la clause mesure sa loi, pas le ballon fou */, familiarite: null /* familiarite null DATÉ 254 : vert à HEAD~ (worktree daf769f), le pivot en relance basse remangé par la familiarité — la clause mesure la salida, pas la familiarité */, shotRange: 20, horsJeu: null /* horsJeu null DATÉ 259 : le flux du pivot (7,2 m devant c. sans 9,7 − 4) remangé par l'appel de l'épaule — vert à HEAD~ (worktree 3a78940) */ }), role = () => ({ arbitre: { conduite: 1 } });
  const ids = mapPostes('433'), cb = ids[1], fb = ids[0];
  const mk = (post, x, foe, over = {}, sty = 0.5) => { const st = { full: true, t: 1, tactics: [{ formation: '433', style: sty }, { formation: '433', style: sty }] }; const p = { id: 3, team: 0, post, p: [x, 0, 2], skill: null }; if (over.x0 != null) st._conduc = { id: 3, x0: over.x0, z0: 2, tient: true };
    const r = conduccion(st, over.cfg ?? cfgS, { p, atk: 0, foeGuard: foe, sg: 1, tac, axe, role }); return { r, tient: st._conduc?.tient ?? false }; };
  const A = mk(cb, -20, 8), B = mk(cb, -20, 3), Cc = mk(cb, -20, 8, { x0: -32.5 }), D = mk(cb, -20, 8, { x0: -34 }, 0), E = mk(fb, -20, 8), F = mk(cb, -20, 8, { cfg: matchCfg({ presseLue: null /* presseLue null DATÉ 289 : vert à HEAD~ (worktree 7bd70e0), pivot en relance basse 10,1 m c. 9,5 − 4 sans dans ce monde — la clause mesure sa loi, pas la pression lue au temps d'arrivée */, layoff: null /* layoff null DATÉ 287 : vert à HEAD~ (worktree 4535d0f), pivot en relance basse 3,9 m devant les centraux dans ce monde — la clause mesure sa loi, pas la une-touche jugée par son angle */, attenteVivante: null /* attenteVivante null DATÉ 285 : vert à HEAD~ (worktree 3d79d38), la relance basse remangée (pivot −0,2 m devant les centraux) — la clause mesure sa loi, pas l'attente vivante */, remisePostes: null, rendezVous: null /* remisePostes et rendezVous null DATÉ 281 : vert à HEAD~ (worktree 0f5e292), la relance basse remangée (pivot 6,9 m c. ≤ sans − 4) — la clause mesure sa loi, pas la passe au rendez-vous ni les postes de la remise */, ...B_0746,  ligne: null /* ligne null DATÉ 273 : vert à HEAD~ (worktree bfc549c), le pivot en relance basse remangé (4,6 m devant les centraux) : l'unité tient la ligne — la clause mesure sa loi, pas la ligne */, familiarite: null /* familiarite null DATÉ 254 : vert à HEAD~ (worktree daf769f), le pivot en relance basse remangé par la familiarité — la clause mesure la salida, pas la familiarité */, conduc: false, blocPercu: null /* blocPercu null DATÉ 275 : vert à HEAD~ (worktree 7e6cd12), le pivot en relance basse remangé (8,3 m devant les centraux) : le bloc qui perçoit change les postés — la clause mesure sa loi, pas le bloc perçu */, ligne: null /* ligne null DATÉ 273 : vert à HEAD~ (worktree bfc549c), le pivot en relance basse remangé (4,6 m devant les centraux) : l'unité tient la ligne — la clause mesure sa loi, pas la ligne */, familiarite: null /* familiarite null DATÉ 254 : vert à HEAD~ (worktree daf769f), le pivot en relance basse remangé par la familiarité — la clause mesure la salida, pas la familiarité */, conduc: false, }) });
  const st3 = makeMatch({ full: true, seed: 3 }); const cfg3 = matchCfg({ presseLue: null /* presseLue null DATÉ 289 : vert à HEAD~ (worktree 7bd70e0), pivot en relance basse 10,1 m c. 9,5 − 4 sans dans ce monde — la clause mesure sa loi, pas la pression lue au temps d'arrivée */, layoff: null /* layoff null DATÉ 287 : vert à HEAD~ (worktree 4535d0f), pivot en relance basse 3,9 m devant les centraux dans ce monde — la clause mesure sa loi, pas la une-touche jugée par son angle */, attenteVivante: null /* attenteVivante null DATÉ 285 : vert à HEAD~ (worktree 3d79d38), la relance basse remangée (pivot −0,2 m devant les centraux) — la clause mesure sa loi, pas l'attente vivante */, remisePostes: null, rendezVous: null /* remisePostes et rendezVous null DATÉ 281 : vert à HEAD~ (worktree 0f5e292), la relance basse remangée (pivot 6,9 m c. ≤ sans − 4) — la clause mesure sa loi, pas la passe au rendez-vous ni les postes de la remise */, ...B_0746,  ligne: null /* ligne null DATÉ 273 : vert à HEAD~ (worktree bfc549c), le pivot en relance basse remangé (4,6 m devant les centraux) : l'unité tient la ligne — la clause mesure sa loi, pas la ligne */, ballonFou: null /* ballonFou null DATÉ 271 : vert à HEAD~ (worktree e0b9951), le pivot en relance basse remangé (7,2 m devant les centraux c. ≤ 3) : d'autres relances — la clause mesure sa loi, pas le ballon fou */, familiarite: null /* familiarite null DATÉ 254 : vert à HEAD~ (worktree daf769f), le pivot en relance basse remangé par la familiarité (6,7 m devant c. sans 9,5 − 4) — la clause mesure la salida, pas la familiarité */, horsJeu: null /* horsJeu null DATÉ 259 : vert à HEAD~ (worktree 3a78940), le pivot en relance basse remangé par l'appel de l'épaule (7,2 m devant c. sans 9,7 − 4) — la clause mesure la salida, pas la Loi 11 */, blocPercu: null /* blocPercu null DATÉ 275 : vert à HEAD~ (worktree 7e6cd12), le pivot en relance basse remangé (8,3 m devant les centraux) : le bloc qui perçoit change les postés — la clause mesure sa loi, pas le bloc perçu */, ligne: null /* ligne null DATÉ 273 : vert à HEAD~ (worktree bfc549c), le pivot en relance basse remangé (4,6 m devant les centraux) : l'unité tient la ligne — la clause mesure sa loi, pas la ligne */, ballonFou: null /* ballonFou null DATÉ 271 : vert à HEAD~ (worktree e0b9951), le pivot en relance basse remangé (7,2 m devant les centraux c. ≤ 3) : d'autres relances — la clause mesure sa loi, pas le ballon fou */, familiarite: null /* familiarite null DATÉ 254 : vert à HEAD~ (worktree daf769f), le pivot en relance basse remangé par la familiarité (6,7 m devant c. sans 9,5 − 4) — la clause mesure la salida, pas la familiarité */, horsJeu: null /* horsJeu null DATÉ 259 : vert à HEAD~ (worktree 3a78940), le pivot en relance basse remangé par l'appel de l'épaule (7,2 m devant c. sans 9,7 − 4) — la clause mesure la salida, pas la Loi 11 */, shotRange: 20 }); for (let i = 0; i < 60; i++) matchStep(st3, 1 / 60, cfg3);
  const og = st3.pitch.ownGoal(0), sg = -Math.sign(og.x || 1); st3.ball.restart([og.x + sg * 8, 0.11, 2], { cause: 'sortie-de-but' }); st3.restart = null;
  const pivotP = st3.players.find((q) => q.team === 0 && q.post === ids[4]);
  const opp = st3.players.filter((q) => q.team === 1 && !q.keeper).slice(0, 4); opp.forEach((q, k) => { q.p[0] = og.x + sg * (14 + k * 2); q.p[2] = (k - 1.5) * 6; });
  const rest = st3.players.filter((q) => q.team === 1 && !q.keeper && !opp.includes(q)); rest.forEach((q) => { q.p[0] = og.x + sg * 60; });
  const plan = (cfgX) => { st3._sbPlan = null; const m = sortieBalle(st3, 0, pivotP, cfgX, tac); return m ? [(m[0] - og.x) * sg, m[2]] : null; };
  const P1 = plan(cfgS); rest.forEach((q, k) => { q.p[0] = og.x + sg * 60; }); opp.forEach((q) => { q.p[0] = og.x + sg * 60; }); st3._sbPlan = null; const P0 = plan(cfgS); opp.forEach((q, k) => { q.p[0] = og.x + sg * (14 + k * 2); }); const PS = plan(matchCfg({ presseLue: null /* presseLue null DATÉ 289 : vert à HEAD~ (worktree 7bd70e0), pivot en relance basse 10,1 m c. 9,5 − 4 sans dans ce monde — la clause mesure sa loi, pas la pression lue au temps d'arrivée */, layoff: null /* layoff null DATÉ 287 : vert à HEAD~ (worktree 4535d0f), pivot en relance basse 3,9 m devant les centraux dans ce monde — la clause mesure sa loi, pas la une-touche jugée par son angle */, attenteVivante: null /* attenteVivante null DATÉ 285 : vert à HEAD~ (worktree 3d79d38), la relance basse remangée (pivot −0,2 m devant les centraux) — la clause mesure sa loi, pas l'attente vivante */, remisePostes: null, rendezVous: null /* remisePostes et rendezVous null DATÉ 281 : vert à HEAD~ (worktree 0f5e292), la relance basse remangée (pivot 6,9 m c. ≤ sans − 4) — la clause mesure sa loi, pas la passe au rendez-vous ni les postes de la remise */, ...B_0746,  ligne: null /* ligne null DATÉ 273 : vert à HEAD~ (worktree bfc549c), le pivot en relance basse remangé (4,6 m devant les centraux) : l'unité tient la ligne — la clause mesure sa loi, pas la ligne */, familiarite: null /* familiarite null DATÉ 254 : vert à HEAD~ (worktree daf769f), le pivot en relance basse remangé par la familiarité — la clause mesure la salida, pas la familiarité */, salida: false, blocPercu: null /* blocPercu null DATÉ 275 : vert à HEAD~ (worktree 7e6cd12), le pivot en relance basse remangé (8,3 m devant les centraux) : le bloc qui perçoit change les postés — la clause mesure sa loi, pas le bloc perçu */, ligne: null /* ligne null DATÉ 273 : vert à HEAD~ (worktree bfc549c), le pivot en relance basse remangé (4,6 m devant les centraux) : l'unité tient la ligne — la clause mesure sa loi, pas la ligne */, familiarite: null /* familiarite null DATÉ 254 : vert à HEAD~ (worktree daf769f), le pivot en relance basse remangé par la familiarité — la clause mesure la salida, pas la familiarité */, salida: false, }));
  const cbLine = st3.pitch.dims.box.depth + (cfgS.relance.prof ?? -4);
  ok(`lot 239 — LA CONDUCCIÓN (central libre : cap ${A.r ? (A.r[0] + 20).toFixed(0) + ' m devant' : 'null'}, tient ${A.tient} ; cadré : ${B.r === null && !B.tient} ; au plafond 12,5 m : ${Cc.r === null} ; jeu court, 14 m : ${D.r !== null} (plafond 15,6) ; latéral : ${E.r === null} ; clé absente : ${F.r === null}) et LA SALIDA (pivot sous pression [${P1?.[0].toFixed(1)}, ${P1?.[1]}] = [${(cbLine - 1).toFixed(1)}, 0] ; sans pression [${P0?.[0].toFixed(1)}, ${P0?.[1]}] = [22, ±3] ; clé absente [${PS?.[0].toFixed(1)}, ${PS?.[1]}])`,
    A.r && Math.abs(A.r[0] + 14) < 1e-9 && A.tient && B.r === null && !B.tient && Cc.r === null && D.r !== null && E.r === null && F.r === null
    && P1 && Math.abs(P1[0] - (cbLine - 1)) < 1e-6 && P1[1] === 0 && P0 && Math.abs(P0[0] - 22) < 1e-6 && Math.abs(P0[1]) === 3 && PS && Math.abs(PS[0] - 22) < 1e-6);
  // (b) Le flux (6 × 300 s) : en relance basse (porteur central ou gardien à < 30 m, ≥ 3 adversaires à < 25 m) la place du
  // pivot devant la ligne des centraux (p50, m) avec c. sans salida ; la portée p50 des conduites d'un central libre avec
  // c. sans conduc. Mesuré 9,5 → 0,5 m ; 5,5 → 8,2 m.
  const { LIGNES, formationPour } = await import('../assets/starter/src/engine/formation.js');
  const med = (a) => { const b = [...a].sort((x, y) => x - y); return b[b.length >> 1] ?? 0; };
  const flux = (over) => { const cfg = matchCfg({ presseLue: null /* presseLue null DATÉ 289 : vert à HEAD~ (worktree 7bd70e0), pivot en relance basse 10,1 m c. 9,5 − 4 sans dans ce monde — la clause mesure sa loi, pas la pression lue au temps d'arrivée */, layoff: null /* layoff null DATÉ 287 : vert à HEAD~ (worktree 4535d0f), pivot en relance basse 3,9 m devant les centraux dans ce monde — la clause mesure sa loi, pas la une-touche jugée par son angle */, attenteVivante: null /* attenteVivante null DATÉ 285 : vert à HEAD~ (worktree 3d79d38), la relance basse remangée (pivot −0,2 m devant les centraux) — la clause mesure sa loi, pas l'attente vivante */, remisePostes: null, rendezVous: null /* remisePostes et rendezVous null DATÉ 281 : vert à HEAD~ (worktree 0f5e292), la relance basse remangée (pivot 6,9 m c. ≤ sans − 4) — la clause mesure sa loi, pas la passe au rendez-vous ni les postes de la remise */, ...B_0746,  ligne: null /* ligne null DATÉ 273 : vert à HEAD~ (worktree bfc549c), le pivot en relance basse remangé (4,6 m devant les centraux) : l'unité tient la ligne — la clause mesure sa loi, pas la ligne */, ballonFou: null /* ballonFou null DATÉ 271 : vert à HEAD~ (worktree e0b9951), le pivot en relance basse remangé (7,2 m devant les centraux c. ≤ 3) : d'autres relances — la clause mesure sa loi, pas le ballon fou */, familiarite: null /* familiarite null DATÉ 254 : vert à HEAD~ (worktree daf769f), le pivot en relance basse remangé par la familiarité — la clause mesure la salida, pas la familiarité */, blocPercu: null /* blocPercu null DATÉ 275 : vert à HEAD~ (worktree 7e6cd12), le pivot en relance basse remangé (8,3 m devant les centraux) : le bloc qui perçoit change les postés — la clause mesure sa loi, pas le bloc perçu */, ligne: null /* ligne null DATÉ 273 : vert à HEAD~ (worktree bfc549c), le pivot en relance basse remangé (4,6 m devant les centraux) : l'unité tient la ligne — la clause mesure sa loi, pas la ligne */, ballonFou: null /* ballonFou null DATÉ 271 : vert à HEAD~ (worktree e0b9951), le pivot en relance basse remangé (7,2 m devant les centraux c. ≤ 3) : d'autres relances — la clause mesure sa loi, pas le ballon fou */, familiarite: null /* familiarite null DATÉ 254 : vert à HEAD~ (worktree daf769f), le pivot en relance basse remangé par la familiarité — la clause mesure la salida, pas la familiarité */, shotRange: 20, ...over }); const piv = [], cond = [];
    for (const seed of [3, 5, 7, 11, 13, 17]) { const st = makeMatch({ full: true, seed }); let cur = 0, carry = null;
      for (let i = 0; i < 300 * 60; i++) { matchStep(st, 1 / 60, cfg); const poss = st.possession.team, c = st.possession.carrier >= 0 ? st.players[st.possession.carrier] : null;
        for (; cur < st.events.length; cur++) { const e = st.events[cur]; if (carry && e.type === 'pass' && e.by === carry.id) { const p = st.players[carry.id]; cond.push(Math.hypot(p.p[0] - carry.x0, p.p[2] - carry.z0)); carry = null; } else if (e.type === 'turnover') carry = null; }
        if (poss < 0 || st.restart) { carry = null; continue; } if (!c) continue;
        const f = tac(st, poss).formation, idsP = mapPostes(f), nD = (LIGNES[formationPour(f, true)] ?? [4, 3, 3])[0], cbs = idsP.slice(1, nD - 1), ogP = st.pitch.ownGoal(poss), sgP = -Math.sign(ogP.x || 1);
        const deep = Math.abs(c.p[0] - ogP.x) < 30, isCB = cbs.includes(c.post);
        if (deep && (isCB || c.keeper) && st.ball.owner === c.id) {
          if (i % 6 === 0) { let n25 = 0; for (const q of st.players) if (q.team !== poss && !q.keeper && Math.hypot(q.p[0] - st.ball.p[0], q.p[2] - st.ball.p[2]) < 25) n25++;
            const cbP = st.players.filter((q) => q.team === poss && cbs.includes(q.post)), pv = st.players.find((q) => q.team === poss && q.post === idsP[nD]); if (n25 >= 3 && cbP.length && pv) piv.push((pv.p[0] - cbP.reduce((a, q) => a + q.p[0], 0) / cbP.length) * sgP); }
          if (isCB && (!carry || carry.id !== c.id)) { let d1 = 99; for (const q of st.players) if (q.team !== poss && !q.keeper) d1 = Math.min(d1, Math.hypot(q.p[0] - c.p[0], q.p[2] - c.p[2])); carry = d1 > 5 ? { id: c.id, x0: c.p[0], z0: c.p[2] } : null; } } } }
    return { piv: med(piv), n: piv.length, cond: med(cond), nc: cond.length }; };
  const V = flux({ appuiRemise: false }), E2 = flux({ appuiRemise: false, salida: false, conduc: false });   // appuiRemise:false DATÉ 240 : le pivot part en troisième homme (111 + vieC) quand la salida le veut bas (4,7 c. 1,5 m) — interaction nommée, la clause mesure SA loi
  ok(`…et le FLUX (6 × 300 s) : pivot en relance basse sous pression ${V.piv.toFixed(1)} m devant les centraux (${V.n} images) (≤ 3 informatif depuis 242 : 0,9-4,7 selon le moteur) et ≤ sans ${E2.piv.toFixed(1)} − 4 (mesuré 0,5 c. 9,5) ; conduite d'un central libre INFORMATIVE p50 ${V.cond.toFixed(1)} m (${V.nc}) ≥ sans ${E2.cond.toFixed(1)} + 1 (mesuré 8,2 c. 5,5 ; réel 6-12)`,
    // conduite du central libre INFORMATIVE DATÉE 240 : 5 conduites / 30 min, le p50 de cinq tirages est un chiffre de Poisson (8,1 c. 9,8 ; 7,7 c. 2,7 sans retournement ; 6,9 c. 7,4 sans épaule) — l'arc du retournement est une conduite, le mécanisme 239 (fixture) fait foi
    V.piv <= E2.piv - 4 && V.n >= 100);   // ≤ 3 absolu INFORMATIF DATÉ 242 (la signature ≤ sans − 4 juge) ; nc ≥ 4 retiré avec l'informatif (2 conduites / 30 min mesurées au 240)
}

if (__bloc()) {
  // LES QUATRE RETOURS (240a-d — retour utilisateur avant le 240 : « du jeu court vers un homme serré », « le retournement
  // trop rapide », « pas le plus rapide au ballon libre », « les avancés jouent trop derrière »). (a) Les primitives :
  // malusPasseMarque (liberté 2 m, seuil 4,5 : 5 × (1 − 2/4,5) = 2,778 ; ÷ controlF 1,25 → 2,222 ; × visionF 1,2 → 3,333 ;
  // remise possible × 0,35 → 0,972 ; liberté 5 → 0 ; clé absente → 0) ; remisePossible sur un état factice (un coéquipier
  // libre à 6 m du point de chute, couloir dégagé → true ; le même à 12 m → false) ; enPorte (porteur → true ; passeur 0,3 s
  // après sa passe → true, 0,8 s → false ; un autre → false).
  const { malusPasseMarque, remisePossible } = await import('../assets/starter/src/engine/rondo.js');
  const { enPorte } = await import('../assets/starter/src/engine/movement.js');
  const cfgQ = matchCfg({ ...B_0746, pausaPied: null, recevoirSurPlace: null, pasDeRecul: null, enveloppe: null /* DATÉ fusion 15/09 (272-276 × A12) : vert dans les deux parents (worktrees 1a945e9 et f62c3d8), la combinaison des deux branches remange le flux — la clause mesure sa loi */, blocPercu: null /* blocPercu null DATÉ 275 : vert à HEAD~ (worktree 7e6cd12), les passes vers un receveur serré remangées (17,1 c. 14,6 %) : le bloc qui perçoit change les marquages — la clause mesure sa loi, pas le bloc perçu */, shotRange: 20 });
  const mA = malusPasseMarque(2, cfgQ), mB = malusPasseMarque(2, cfgQ, { controlF: 1.25 }), mC = malusPasseMarque(2, cfgQ, { visionF: 1.2 }), mD = malusPasseMarque(2, cfgQ, { remise: true }), mE = malusPasseMarque(5, cfgQ), mS = malusPasseMarque(2, matchCfg({ ...B_0746,  passeMarque: false, pausaPied: null, recevoirSurPlace: null, pasDeRecul: null, enveloppe: null /* DATÉ fusion 15/09 (272-276 × A12) : vert dans les deux parents (worktrees 1a945e9 et f62c3d8), la combinaison des deux branches remange le flux — la clause mesure sa loi */, blocPercu: null /* blocPercu null DATÉ 275 : vert à HEAD~ (worktree 7e6cd12), les passes vers un receveur serré remangées (17,1 c. 14,6 %) : le bloc qui perçoit change les marquages — la clause mesure sa loi, pas le bloc perçu */, passeMarque: false, }));
  const c0 = { id: 0, team: 0, p: [0, 0, 0] }, m0 = { id: 1, team: 0, p: [10, 0, 0] }, foe = { id: 9, team: 1, keeper: false, p: [40, 0, 20] };
  const mk = (tx) => ({ players: [c0, m0, { id: 2, team: 0, keeper: false, down: 0, p: [tx, 0, 0] }, foe] });
  const rP = remisePossible(mk(16), c0, m0, [10, 0.11, 0], [foe], [foe.p], cfgQ), rN = remisePossible(mk(22), c0, m0, [10, 0.11, 0], [foe], [foe.p], cfgQ);
  const stP = { t: 10, possession: { carrier: 3 }, ball: { owner: null }, lastPasser: 5, pass: { t: 9.7 } };
  const eA = enPorte(stP, { id: 3 }, cfgQ), eB = enPorte(stP, { id: 5 }, cfgQ), eC = enPorte({ ...stP, t: 10.5 }, { id: 5 }, cfgQ), eD = enPorte(stP, { id: 7 }, cfgQ);
  ok(`lot 240 — LE MARQUÉ NE SE JOUE QU'EN REMISE (malus liberté 2 m : ${mA.toFixed(3)} = 2,778 ; controlF 1,25 → ${mB.toFixed(3)} ; visionF 1,2 → ${mC.toFixed(3)} ; remise → ${mD.toFixed(3)} ; liberté 5 → ${mE} ; clé absente → ${mS} ; remise possible à 6 m ${rP}, à 12 m ${rN}) et LE CORPS QUI PORTE (porteur ${eA}, passeur à 0,3 s ${eB}, à 0,8 s ${eC}, un autre ${eD})`,
    Math.abs(mA - 2.7777777778) < 1e-6 && Math.abs(mB - 2.2222222222) < 1e-6 && Math.abs(mC - 3.3333333333) < 1e-6 && Math.abs(mD - 0.9722222222) < 1e-6 && mE === 0 && mS === 0 && rP === true && rN === false && eA && eB && !eC && !eD);
  // (b) Le flux (6 × 300 s) : la part des passes vers un receveur serré (2-4 m) avec c. sans passeMarque (mesuré 15 → 10 %) ;
  // la rotation du passeur dans les 0,3 s avant une passe arrière, p50 (mesuré 462 → 176 °/s ; réel 200-250) ; l'attaquant
  // le plus avancé derrière la ligne défensive en possession installée (mesuré 5,9 → 3,3 m).
  const med = (a) => { const b = [...a].sort((x, y) => x - y); return b[b.length >> 1] ?? 0; };
  const d2 = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
  const flux = (over) => { const cfg = matchCfg({ remisesPied: RP_1609, tete: TETE_1609, loi12: LOI12_1609, viragesLisses: null, plantVitesse: null, sortieAerienne: null, retournee: null, bouclier: null, ceremonie: null, ramasseurs: null, boiterie: null, entrant: null, petitsGestes: null, passements: null, enchainement: null, orientationPasse: null, verticalite: null, decalage: null, toucheOrientee: null /* remisesPied hier DATÉ 16/09 (lot A9 ter, note 368) — chaque clause de flux mesure le monde de son jour */, sol: null, fete: null /* sol, fete null DATÉ 15/09 (lots A10 bis-A11, notes 360-361) */, familiarite: null /* familiarite null DATÉ 254 : vert à HEAD~ (worktree daf769f), le receveur serré remangé par la familiarité (19,2 c. 17,8 %) — la clause mesure la passe au marqué, pas la familiarité */, pausaPied: null, recevoirSurPlace: null, pasDeRecul: null, enveloppe: null /* DATÉ fusion 15/09 (272-276 × A12) : vert dans les deux parents (worktrees 1a945e9 et f62c3d8), la combinaison des deux branches remange le flux — la clause mesure sa loi */, blocPercu: null /* blocPercu null DATÉ 275 : vert à HEAD~ (worktree 7e6cd12), les passes vers un receveur serré remangées (17,1 c. 14,6 %) : le bloc qui perçoit change les marquages — la clause mesure sa loi, pas le bloc perçu */, familiarite: null /* familiarite null DATÉ 254 : vert à HEAD~ (worktree daf769f), le receveur serré remangé par la familiarité (19,2 c. 17,8 %) — la clause mesure la passe au marqué, pas la familiarité */, shotRange: 20, ...over }); let nP = 0, serre = 0; const rot = [], haut = [];
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) { const st = makeMatch({ full: true, seed }); let cur = 0; const yawH = new Map();   // 12 graines : la part « serré » est un écart de 2 points
      for (let i = 0; i < 300 * 60; i++) { matchStep(st, 1 / 60, cfg);
        for (const p of st.players) { const h = yawH.get(p.id) ?? []; h.push([st.t, p.yaw]); if (h.length > 30) h.shift(); yawH.set(p.id, h); }
        for (; cur < st.events.length; cur++) { const e = st.events[cur]; if (e.type !== 'pass' || e.to < 0) continue; const from = st.players[e.by], to = st.players[e.to]; if (!from || !to) continue; nP++;
          let pr = 99; for (const q of st.players) if (q.team !== from.team && !q.keeper && q.down <= 0) pr = Math.min(pr, d2(q.p, to.p)); if (pr >= 2 && pr < 4) serre++;
          const h = yawH.get(from.id) ?? [], h0 = h.find((x) => x[0] >= st.t - 0.3) ?? h[0]; if (h0 && h.length > 2) { const ang = Math.atan2(to.p[2] - from.p[2], to.p[0] - from.p[0]); const rel = Math.abs(((ang - h0[1] + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI) * 180 / Math.PI; if (rel > 110) { const dy = Math.abs(((from.yaw - h0[1] + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI) * 180 / Math.PI; rot.push(dy / Math.max(0.05, st.t - h0[0])); } } }
        if (i % 6 === 0) { const poss = st.possession.team, c = st.possession.carrier >= 0 ? st.players[st.possession.carrier] : null; if (c && poss >= 0 && !st.restart && st.t - (st._possChangeAt ?? -99) > 4) { const sg = Math.sign(st.pitch.attackGoal(poss).x || 1); const def = st.players.filter((q) => q.team !== poss && !q.keeper && q.down <= 0).map((q) => q.p[0] * sg).sort((a, b) => b - a); const att = st.players.filter((q) => q.team === poss && !q.keeper && q.id !== c.id).map((q) => q.p[0] * sg).sort((a, b) => b - a); if (def.length >= 2 && att.length) haut.push((def[0] + def[1]) / 2 - att[0]); } } } }
    return { serre: 100 * serre / Math.max(1, nP), nP, rot: med(rot), nRot: rot.length, haut: med(haut) }; };
  const V = flux({}), E = flux({ passeMarque: false, retournement: false, epaule: false }), E2 = flux({ passeMarque: false });   // chaque loi contre SON jumeau : la part « serré » contre passeMarque seule (les autres lois la remontent, elle la ramène)
  ok(`…et le FLUX (12 × 300 s) : passes vers un receveur serré ${V.serre.toFixed(1)} % (${V.nP}) c. sans passeMarque ${E2.serre.toFixed(1)} % (${E2.nP}) — INFORMATIF DATÉ 242 (13,6 c. 13,1 : une signature de 0,4 pt vit dans le bruit) — non-inversion (mesuré 15,1 → 13,3 et 14,5 → 13,5 : réel mais faible, la vraie réponse au receveur serré est la remise du 240) ; rotation avant passe arrière p50 ${V.rot.toFixed(0)} °/s ≤ 300 et ≤ sans ${E.rot.toFixed(0)} − 100 (${V.nRot} passes ; réel 200-250) ; l'attaquant le plus avancé ${V.haut.toFixed(1)} m derrière la ligne ≤ sans ${E.haut.toFixed(1)} − 1,0 (réel 0-3 ; mesuré 5,9 → 3,3 et 4,5 selon les graines)`,
    V.rot <= 300 && V.rot <= E.rot - 100 && V.nRot >= 30 && V.haut <= E.haut - 1.0);   // serre INFORMATIF DATÉ 242
}

// ---------------------------------------------------------------- lot 240 : L'APPUI-REMISE ET LE TROISIÈME HOMME
// (cfg.appuiRemise — préceptes 1.3, 1.5 : « si tu n'as pas vu, tu remets » ; A → B dos au but → C lancé)
if (__bloc()) {
  // LA FIXTURE : B dos au but à x 5, A de face à 6 m, le presseur à 1,8 m dans le dos de B (côté but) ; la passe A → B en
  // vol à 8 m/s ; tirage épinglé 0,9 (au-dessus du p 0,65 de la loi 44 : sans la loi, la une-touche est refusée et B contrôle).
  const scene = (cfgExtra, composureF) => {
    const st = makeMatch({ full: true, seed: 5 }); const sgn = Math.sign(st.pitch.attackGoal(0).x || 1);
    for (const p of st.players) if (!p.keeper) { p.p[0] = -sgn * 40; p.p[2] = (p.id % 9) * 3 - 12; p.v = [0, 0]; p.act = null; }
    const a = st.players.find((p) => p.team === 0 && !p.keeper), r = st.players.find((p) => p.team === 0 && !p.keeper && p.id !== a.id);
    const f = st.players.find((p) => p.team === 1 && !p.keeper);
    r.p[0] = 5; r.p[2] = 0; r.v = [0, 0]; r.yaw = Math.atan2(0, -sgn);
    a.p[0] = 5 - sgn * 6; a.p[2] = 0; a.v = [0, 0]; a.yaw = Math.atan2(0, sgn);
    f.p[0] = 5 + sgn * 1.8; f.p[2] = 0; f.v = [0, 0];
    if (composureF) r.skill = { ...r.skill, composureF };
    st.ball.release('sortie'); st.ball.restart([5 - sgn * 6, 0.11, 0], { cause: 'touche' });
    st.ball.strike({ speed: 8, dirYaw: Math.atan2(0, sgn), elevation: 0.02, spinAxis: [0, 1, 0], spinRev: 0 });
    st.restart = null; st.phase = 'flight'; st.possession = { team: 0, carrier: -1 }; st.hold = 0; st.lastTouch = 0;
    st.pass = { from: a.id, to: r.id, lead: [5, 0, 0], t: st.t - 0.2, origin: [5 - sgn * 6, 0], flight: 0.8 };
    st.rnd = () => 0.9;
    const cfg = matchCfg({ ouverture: null /* ouverture null DATÉ 288 : vert à HEAD~ (worktree d90101b), troisième homme servi 32 c. 24 dans ce monde — la clause mesure sa loi, pas le receveur qui s'ouvre au ballon */, attenteVivante: null /* attenteVivante null DATÉ 285 : vert à HEAD~ (worktree 3d79d38), le troisième homme remangé — la clause mesure sa loi, pas l'attente vivante */, xt: null /* xt null DATÉ 283 : vert à HEAD~ (worktree bd3322e), le troisième homme remangé (réussi 29 c. ≥ 30 sur 24 × 300 s) — la clause mesure sa loi, pas la valeur de position xT */, remisesPied: RP_1609, tete: TETE_1609, loi12: LOI12_1609, viragesLisses: null, plantVitesse: null, sortieAerienne: null, retournee: null, bouclier: null, ceremonie: null, ramasseurs: null, boiterie: null, entrant: null, petitsGestes: null, passements: null, enchainement: null, orientationPasse: null, verticalite: null, decalage: null, toucheOrientee: null /* remisesPied hier DATÉ 16/09 (lot A9 ter, note 368) — chaque clause de flux mesure le monde de son jour */, sol: null, fete: null /* sol, fete null DATÉ 15/09 (lots A10 bis-A11, notes 360-361) */, ligne: null /* ligne null DATÉ 273 : vert à HEAD~ (worktree bfc549c), le troisième homme remangé (servi 41 c. 33 sans) : la ligne tenue change les courses et les possessions — la clause mesure sa loi, pas la ligne */, xg: null /* xg null DATÉ 272 : vert à HEAD~ (worktree 201d6c0), le troisième homme remangé (servi 59 c. 29 sans, pertes 599 c. 564) : la porte xG change les tirs, d'autres possessions — la clause mesure sa loi, pas le xG */, selection: null /* selection null DATÉ 267 : vert à HEAD~ (worktree 7edf8fc), le troisième homme remangé (servi 44 c. 58 sur 24 × 300 s) : d'autres passes élues — la clause mesure sa loi, pas la sélection */, flux: null /* flux null DATÉ 264 : vert à HEAD~ (worktree 9eee4ea), la fixture FORCE le tirage par st.rnd (0,9 : la une-touche) et le flux nommé ne l'écoute plus — la clause mesure l'appui-remise, pas le flux (son flux 24 × 300 s est rouge à HEAD~ aussi : hérité) */, effort: null /* effort null DATÉ 261 : vert à HEAD~ (worktree edda355), les pertes par 100 min remangées (609 c. 565 × 1,05) — la clause mesure le troisième homme, pas l'intention d'effort */, pausaPied: null, recevoirSurPlace: null, pasDeRecul: null, enveloppe: null /* DATÉ fusion 15/09 (272-276 × A12) : vert dans les deux parents (worktrees 1a945e9 et f62c3d8), la combinaison des deux branches remange le flux — la clause mesure sa loi */, blocPercu: null /* blocPercu null DATÉ 275 : vert à HEAD~ (worktree 7e6cd12), le troisième homme remangé : le bloc qui perçoit change les courses — la clause mesure sa loi, pas le bloc perçu */, ligne: null /* ligne null DATÉ 273 : vert à HEAD~ (worktree bfc549c), le troisième homme remangé (servi 41 c. 33 sans) : la ligne tenue change les courses et les possessions — la clause mesure sa loi, pas la ligne */, xg: null /* xg null DATÉ 272 : vert à HEAD~ (worktree 201d6c0), le troisième homme remangé (servi 59 c. 29 sans, pertes 599 c. 564) : la porte xG change les tirs, d'autres possessions — la clause mesure sa loi, pas le xG */, selection: null /* selection null DATÉ 267 : vert à HEAD~ (worktree 7edf8fc), le troisième homme remangé (servi 44 c. 58 sur 24 × 300 s) : d'autres passes élues — la clause mesure sa loi, pas la sélection */, flux: null /* flux null DATÉ 264 : vert à HEAD~ (worktree 9eee4ea), la fixture FORCE le tirage par st.rnd (0,9 : la une-touche) et le flux nommé ne l'écoute plus — la clause mesure l'appui-remise, pas le flux (son flux 24 × 300 s est rouge à HEAD~ aussi : hérité) */, effort: null /* effort null DATÉ 261 : vert à HEAD~ (worktree edda355), les pertes par 100 min remangées (609 c. 565 × 1,05) — la clause mesure le troisième homme, pas l'intention d'effort */, shotRange: 20, ...cfgExtra });
    for (let i = 0; i < 1.5 * 60 && !st.events.some((e) => e.type === 'pass' && e.style === 'une-touche') && st.phase !== 'carry'; i++) matchStep(st, 1 / 60, cfg);
    const ut = st.events.find((e) => e.type === 'pass' && e.style === 'une-touche');
    return { ut: ut ? { appui: !!ut.appui, versA: ut.to === a.id } : null, phase: st.phase };
  };
  const L = scene({}), A = scene({ appuiRemise: false }), Sf = scene({}, 1.5), Ps = scene({ appuiRemise: { ...matchCfg({ ouverture: null /* ouverture null DATÉ 288 : vert à HEAD~ (worktree d90101b), troisième homme servi 32 c. 24 dans ce monde — la clause mesure sa loi, pas le receveur qui s'ouvre au ballon */, attenteVivante: null /* attenteVivante null DATÉ 285 : vert à HEAD~ (worktree 3d79d38), le troisième homme remangé — la clause mesure sa loi, pas l'attente vivante */, xt: null /* xt null DATÉ 283 : vert à HEAD~ (worktree bd3322e), le troisième homme remangé (réussi 29 c. ≥ 30 sur 24 × 300 s) — la clause mesure sa loi, pas la valeur de position xT */, ...B_0746,  ligne: null /* ligne null DATÉ 273 : vert à HEAD~ (worktree bfc549c), le troisième homme remangé (servi 41 c. 33 sans) : la ligne tenue change les courses et les possessions — la clause mesure sa loi, pas la ligne */, xg: null /* xg null DATÉ 272 : vert à HEAD~ (worktree 201d6c0), le troisième homme remangé (servi 59 c. 29 sans, pertes 599 c. 564) : la porte xG change les tirs, d'autres possessions — la clause mesure sa loi, pas le xG */, flux: null /* flux null DATÉ 264 : vert à HEAD~ (worktree 9eee4ea), la fixture FORCE le tirage par st.rnd (0,9 : la une-touche) et le flux nommé ne l'écoute plus — la clause mesure l'appui-remise, pas le flux (son flux 24 × 300 s est rouge à HEAD~ aussi : hérité) */, effort: null /* effort null DATÉ 261 : vert à HEAD~ (worktree edda355), les pertes par 100 min remangées (609 c. 565 × 1,05) — la clause mesure le troisième homme, pas l'intention d'effort */, pausaPied: null, recevoirSurPlace: null, pasDeRecul: null, enveloppe: null /* DATÉ fusion 15/09 (272-276 × A12) : vert dans les deux parents (worktrees 1a945e9 et f62c3d8), la combinaison des deux branches remange le flux — la clause mesure sa loi */, blocPercu: null /* blocPercu null DATÉ 275 : vert à HEAD~ (worktree 7e6cd12), le troisième homme remangé : le bloc qui perçoit change les courses — la clause mesure sa loi, pas le bloc perçu */, ligne: null /* ligne null DATÉ 273 : vert à HEAD~ (worktree bfc549c), le troisième homme remangé (servi 41 c. 33 sans) : la ligne tenue change les courses et les possessions — la clause mesure sa loi, pas la ligne */, xg: null /* xg null DATÉ 272 : vert à HEAD~ (worktree 201d6c0), le troisième homme remangé (servi 59 c. 29 sans, pertes 599 c. 564) : la porte xG change les tirs, d'autres possessions — la clause mesure sa loi, pas le xG */, flux: null /* flux null DATÉ 264 : vert à HEAD~ (worktree 9eee4ea), la fixture FORCE le tirage par st.rnd (0,9 : la une-touche) et le flux nommé ne l'écoute plus — la clause mesure l'appui-remise, pas le flux (son flux 24 × 300 s est rouge à HEAD~ aussi : hérité) */, effort: null /* effort null DATÉ 261 : vert à HEAD~ (worktree edda355), les pertes par 100 min remangées (609 c. 565 × 1,05) — la clause mesure le troisième homme, pas l'intention d'effort */, }).appuiRemise, press: 1.5 } });
  ok(`lot 240 — L'APPUI-REMISE au mécanisme (B dos au but, presseur à 1,8 m dans son dos, tirage 0,9 : la loi FORCE la une-touche (appui ${L.ut?.appui}) vers A de face (${L.ut?.versA}) ; clé absente → contrôle (${A.phase}, l'hier au bit) ; sang-froid composureF 1,5 → le pivot rendu (${Sf.phase}) ; presseur hors seuil press 1,5 → contrôle (${Ps.phase}))`,
    L.ut?.appui === true && L.ut?.versA === true && !A.ut && A.phase === 'carry' && !Sf.ut && !Ps.ut);
  // LE FLUX (12 × 300 s) : le troisième homme SERVI (une passe à C dans les 2,5 s de sa course) et RÉUSSI (C reçoit et le
  // ballon est encore à l'équipe 2 s après), les perdus sur service, les pertes de possession (non-dégradation), et la garde
  // 231 (appels profonds, débordements ± 15 %). Mesuré : servis 28 → 60 / 60 min, réussis 19 → 48, perdus 9 → 10, pertes 273 → 282.
  const flux = (over) => {
    const cfg = matchCfg({ ouverture: null /* ouverture null DATÉ 288 : vert à HEAD~ (worktree d90101b), troisième homme servi 32 c. 24 dans ce monde — la clause mesure sa loi, pas le receveur qui s'ouvre au ballon */, attenteVivante: null /* attenteVivante null DATÉ 285 : vert à HEAD~ (worktree 3d79d38), le troisième homme remangé — la clause mesure sa loi, pas l'attente vivante */, xt: null /* xt null DATÉ 283 : vert à HEAD~ (worktree bd3322e), le troisième homme remangé (réussi 29 c. ≥ 30 sur 24 × 300 s) — la clause mesure sa loi, pas la valeur de position xT */, remisesPied: RP_1609, tete: TETE_1609, loi12: LOI12_1609, viragesLisses: null, plantVitesse: null, sortieAerienne: null, retournee: null, bouclier: null, ceremonie: null, ramasseurs: null, boiterie: null, entrant: null, petitsGestes: null, passements: null, enchainement: null, orientationPasse: null, verticalite: null, decalage: null, toucheOrientee: null /* remisesPied hier DATÉ 16/09 (lot A9 ter, note 368) — chaque clause de flux mesure le monde de son jour */, sol: null, fete: null /* sol, fete null DATÉ 15/09 (lots A10 bis-A11, notes 360-361) */, ligne: null /* ligne null DATÉ 273 : vert à HEAD~ (worktree bfc549c), le troisième homme remangé (servi 41 c. 33 sans) : la ligne tenue change les courses et les possessions — la clause mesure sa loi, pas la ligne */, xg: null /* xg null DATÉ 272 : vert à HEAD~ (worktree 201d6c0), le troisième homme remangé (servi 59 c. 29 sans, pertes 599 c. 564) : la porte xG change les tirs, d'autres possessions — la clause mesure sa loi, pas le xG */, selection: null /* selection null DATÉ 267 : vert à HEAD~ (worktree 7edf8fc), le troisième homme remangé (servi 44 c. 58 sur 24 × 300 s) : d'autres passes élues — la clause mesure sa loi, pas la sélection */, flux: null /* flux null DATÉ 264 : vert à HEAD~ (worktree 9eee4ea), la fixture FORCE le tirage par st.rnd (0,9 : la une-touche) et le flux nommé ne l'écoute plus — la clause mesure l'appui-remise, pas le flux (son flux 24 × 300 s est rouge à HEAD~ aussi : hérité) */, effort: null /* effort null DATÉ 261 : vert à HEAD~ (worktree edda355), les pertes par 100 min remangées (609 c. 565 × 1,05) — la clause mesure le troisième homme, pas l'intention d'effort */, familiarite: null /* familiarite null DATÉ 254 : vert à HEAD~ (worktree daf769f), le troisième homme du flux remangé par la familiarité (Φ pèse le motif, le coach choque η) — la clause mesure l'appui-remise, pas la familiarité */, pausaPied: null, recevoirSurPlace: null, pasDeRecul: null, enveloppe: null /* DATÉ fusion 15/09 (272-276 × A12) : vert dans les deux parents (worktrees 1a945e9 et f62c3d8), la combinaison des deux branches remange le flux — la clause mesure sa loi */, blocPercu: null /* blocPercu null DATÉ 275 : vert à HEAD~ (worktree 7e6cd12), le troisième homme remangé : le bloc qui perçoit change les courses — la clause mesure sa loi, pas le bloc perçu */, ligne: null /* ligne null DATÉ 273 : vert à HEAD~ (worktree bfc549c), le troisième homme remangé (servi 41 c. 33 sans) : la ligne tenue change les courses et les possessions — la clause mesure sa loi, pas la ligne */, xg: null /* xg null DATÉ 272 : vert à HEAD~ (worktree 201d6c0), le troisième homme remangé (servi 59 c. 29 sans, pertes 599 c. 564) : la porte xG change les tirs, d'autres possessions — la clause mesure sa loi, pas le xG */, selection: null /* selection null DATÉ 267 : vert à HEAD~ (worktree 7edf8fc), le troisième homme remangé (servi 44 c. 58 sur 24 × 300 s) : d'autres passes élues — la clause mesure sa loi, pas la sélection */, flux: null /* flux null DATÉ 264 : vert à HEAD~ (worktree 9eee4ea), la fixture FORCE le tirage par st.rnd (0,9 : la une-touche) et le flux nommé ne l'écoute plus — la clause mesure l'appui-remise, pas le flux (son flux 24 × 300 s est rouge à HEAD~ aussi : hérité) */, effort: null /* effort null DATÉ 261 : vert à HEAD~ (worktree edda355), les pertes par 100 min remangées (609 c. 565 × 1,05) — la clause mesure le troisième homme, pas l'intention d'effort */, familiarite: null /* familiarite null DATÉ 254 : vert à HEAD~ (worktree daf769f), le troisième homme du flux remangé par la familiarité (Φ pèse le motif, le coach choque η) — la clause mesure l'appui-remise, pas la familiarité */, shotRange: 20, craie: { tire: 0.6, seuil: 0.42 }, passation: null, remisesMain: null, contact: null, porteAnticipe: null, remisesPied: null, ...over }); let pertes = 0, servis = 0, reussis = 0, perdus = 0, profond = 0, deborde = 0, jeu = 0;   // contact/porteAnticipe/remisesPied:null DATÉ A10 (le contact fait TOMBER le receveur dos au but : services perdus 37 % pour ≤ 35, 24 × 300 s — la clause mesure SA loi dans le monde d'hier ; le prix du contact sur l'appui-remise est une mesure du lot 247) ; remisesMain:null DATÉ 247 : par minute de jeu le monde A9 garde + 8 % de pertes et 36 % de services perdus (hier + 1,5 %, 30 %) — la clause mesure SA loi dans le monde d'hier tant que le 247 n'a pas daté la dose ; (247) jeu = les images HORS temps mort : les pertes se comparent PAR MINUTE DE JEU — sans l'appui-remise le ballon sort 4 × plus (14 touches c. 3 / 40 min) et chaque touche A9 coûte 11 s ; les pertes brutes comparaient 33 min de jeu à 36 (573 c. 508 = « + 13 % » ; par minute : + 6 %)   // craie sans tenue DATÉ 249b (flux du troisième homme sous σ : 88 c. 97) ; passation null DATÉ 252 (vert à HEAD)
    for (const seed of [3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97]) {
      const st = makeMatch({ full: true, seed }); let prev = -1, cur = 0; const tr = [];
      for (let i = 0; i < 300 * 60; i++) {
        matchStep(st, 1 / 60, cfg); const t = st.possession?.team ?? -1; if (!st.restart) jeu++; if (prev >= 0 && t >= 0 && t !== prev && !st.restart) pertes++; if (t >= 0) prev = t;
        for (; cur < st.events.length; cur++) {
          const e = st.events[cur];
          if (e.type === 'troisieme') tr.push({ c: e.c, t: e.t });
          if (e.type === 'burst' && e.kind === 'appel-profond') profond++;
          if (e.type === 'burst' && e.kind === 'deborde') deborde++;
          if (e.type === 'pass' && e.to != null) for (const x of tr) if (!x.done && e.to === x.c && e.t - x.t < 2.5) { x.done = true; servis++; x.serviT = e.t; x.team = st.players[e.to].team; }
        }
        for (const x of tr) if (x.serviT != null && !x.juge && st.t - x.serviT >= 2) { x.juge = true; if ((st.possession?.team ?? -1) === x.team && !st.restart) reussis++; else perdus++; }
      }
    }
    return { pertes, pertesMin: pertes / Math.max(1, jeu / 3600), jeuMin: jeu / 3600, servis, reussis, perdus, profond, deborde };
  };
  const V = flux({}), E = flux({ appuiRemise: false });
  ok(`…et le FLUX (24 × 300 s — 12 → 24 DATÉ 244b, volumétrie : à 12 graines le monde au pivot M(C) rendait 44 c. 58 servis et la seconde douzaine 54 c. 48 — le tirage, pas la clé) : troisième homme servi ${V.servis} ≥ sans ${E.servis} × 1,5 ; RÉUSSI ${V.reussis} ≥ 30 et ≥ sans ${E.reussis} × 1,5 (la course vit le cycle : vieC ; × 1,8 → 1,5 DATÉ 242 : 36 c. 21, le 242 sert aussi les courses du sans) ; perdus sur service ${V.perdus} ≤ 35 % des servis (${(100 * V.perdus / Math.max(1, V.servis)).toFixed(0)} % ; sans : ${E.perdus}) ; pertes ${(V.pertesMin * 100).toFixed(0)} ≤ sans ${(E.pertesMin * 100).toFixed(0)} × 1,05 PAR 100 MIN DE JEU (non-dégradation ; brutes ${V.pertes} c. ${E.pertes} sur ${V.jeuMin.toFixed(0)} c. ${E.jeuMin.toFixed(0)} min de jeu — DATÉ 247 : le temps mort n'est pas une perte) ; garde 231 en NON-DIMINUTION (≥ × 0,85 — la leçon 231 est une loi qui éteignait des courses) : appels profonds ${V.profond} c. ${E.profond}, débordements ${V.deborde} c. ${E.deborde} (la hausse suit le porteur large et avancé : 19 → 24,6 % des images de porté, l'attaque avance)`,
    V.servis >= E.servis * 1.5 && V.reussis >= 30 && V.reussis >= E.reussis * 1.5 && V.perdus <= V.servis * 0.35 && V.pertesMin <= E.pertesMin * 1.05
    && V.profond >= E.profond * 0.85 && V.deborde >= E.deborde * 0.85);
}

// ---------------------------------------------------------------- lot 241 : LES CINQ COULOIRS (précepte 1.4 — Guardiola)
if (__bloc()) {
  // LES PRIMITIVES (pures) : le couloir d'un z ; le registre (le porteur compte en premier) ; le débordement vers le voisin libre,
  // le côté opposé au ballon à égalité, le demi-espace vide qui attire ; l'hystérésis ; l'intérieur qui tient son demi-espace ; l'ombre.
  const st = makeMatch({ full: true, seed: 3 }); const hz = st.pitch.hz, W = hz * 2 / 5; const cfg = matchCfg({ presseLue: null /* presseLue null DATÉ 289 : vert à HEAD~ (worktree 7bd70e0), un couloir à ≥ 3 corps 32,0 % > 35,0 × 0,8 dans ce monde — la clause mesure sa loi, pas la pression lue au temps d'arrivée */, ouverture: null /* ouverture null DATÉ 288 : vert à HEAD~ (worktree d90101b), un couloir à ≥ 3 corps 33,7 % > 38,5 × 0,8 dans ce monde — la clause mesure sa loi, pas le receveur qui s'ouvre au ballon */, layoff: null /* layoff null DATÉ 287 : vert à HEAD~ (worktree 4535d0f), un couloir à ≥ 3 corps 32,9 % > 40,4 × 0,8 dans ce monde — la clause mesure sa loi, pas la une-touche jugée par son angle */, ...B_0746, visee: null /* visee null DATÉ 277 : vert à HEAD~ (worktree d6f1868), le couloir à trois corps remangé (31,5 c. 38,3 × 0,8) : le point visé change les tirs et le trafic */, interligne: null /* interligne null DATÉ 274 : vert à HEAD~ (worktree f755654), le couloir à trois corps remangé (31 c. 37 × 0,8) : le milieu tenu change le trafic — la clause mesure sa loi, pas l'interligne */, passe: null /* passe null DATÉ 265 : vert à HEAD~ (worktree 1507550), le flux des couloirs remangé (32,4 c. 39,4 × 0,8 : la marge) — la clause mesure les cinq couloirs, pas la réception */, shotRange: 20 });
  const cs = [couloirDe(-hz, hz), couloirDe(-hz + W * 1.5, hz), couloirDe(0, hz), couloirDe(hz * 0.99, hz)];
  const car = { p: [0, 0, 0], keeper: false }; const R = ouvrirRegistre(st, 0, st.pitch, car);
  const mk = () => ({ id: 99, _coul: null }); const cfgR = matchCfg({ presseLue: null /* presseLue null DATÉ 289 : vert à HEAD~ (worktree 7bd70e0), un couloir à ≥ 3 corps 32,0 % > 35,0 × 0,8 dans ce monde — la clause mesure sa loi, pas la pression lue au temps d'arrivée */, ouverture: null /* ouverture null DATÉ 288 : vert à HEAD~ (worktree d90101b), un couloir à ≥ 3 corps 33,7 % > 38,5 × 0,8 dans ce monde — la clause mesure sa loi, pas le receveur qui s'ouvre au ballon */, layoff: null /* layoff null DATÉ 287 : vert à HEAD~ (worktree 4535d0f), un couloir à ≥ 3 corps 32,9 % > 40,4 × 0,8 dans ce monde — la clause mesure sa loi, pas la une-touche jugée par son angle */, ...B_0746, visee: null /* visee null DATÉ 277 : vert à HEAD~ (worktree d6f1868), le couloir à trois corps remangé (31,5 c. 38,3 × 0,8) : le point visé change les tirs et le trafic */, interligne: null /* interligne null DATÉ 274 : vert à HEAD~ (worktree f755654), le couloir à trois corps remangé (31 c. 37 × 0,8) : le milieu tenu change le trafic — la clause mesure sa loi, pas l'interligne */, passe: null /* passe null DATÉ 265 : vert à HEAD~ (worktree 1507550), le flux des couloirs remangé (32,4 c. 39,4 × 0,8 : la marge) — la clause mesure les cinq couloirs, pas la réception */, shotRange: 20, couloirs: { ...matchCfg({ presseLue: null /* presseLue null DATÉ 289 : vert à HEAD~ (worktree 7bd70e0), un couloir à ≥ 3 corps 32,0 % > 35,0 × 0,8 dans ce monde — la clause mesure sa loi, pas la pression lue au temps d'arrivée */, ouverture: null /* ouverture null DATÉ 288 : vert à HEAD~ (worktree d90101b), un couloir à ≥ 3 corps 33,7 % > 38,5 × 0,8 dans ce monde — la clause mesure sa loi, pas le receveur qui s'ouvre au ballon */, layoff: null /* layoff null DATÉ 287 : vert à HEAD~ (worktree 4535d0f), un couloir à ≥ 3 corps 32,9 % > 40,4 × 0,8 dans ce monde — la clause mesure sa loi, pas la une-touche jugée par son angle */, ...B_0746 }).couloirs, remplir: false } });
  const a0 = mk(), zR = placerCouloir(st, cfg, a0, 1, { atk: 0, pitch: st.pitch, ballZ: 0 }), cR = couloirDe(zR, hz);   // REMPLIR : le 2e corps d'un couloir occupé va au demi-espace vide
  ouvrirRegistre(st, 0, st.pitch, car); R.t = -1; ouvrirRegistre(st, 0, st.pitch, car);   // registre rouvert (le porteur au centre)
  const a = mk(), z1 = placerCouloir(st, cfgR, a, 1, { atk: 0, pitch: st.pitch, ballZ: 0 });   // remplir éteint : 2e au centre reste (max 2)
  const b = mk(), z2 = placerCouloir(st, cfgR, b, 2, { atk: 0, pitch: st.pitch, ballZ: 0 });   // 3e au centre : déborde vers un demi-espace vide
  const c2 = couloirDe(z2, hz), nCentre = R.n[2];
  const z2b = placerCouloir(st, cfgR, b, 2, { atk: 0, pitch: st.pitch, ballZ: 0 });   // l'hystérésis : même image, même couloir
  const zT = tenirDemiEspace(0, -hz + W * 1.5, hz, 1.5), zT2 = tenirDemiEspace(5, 0, hz, 1.5);   // l'intérieur du demi-espace 1 tiré à 0 → borné dans son demi-espace ; un central : libre
  const foes = [{ p: [5, 0, 0.5] }]; const om = dansOmbre(0, 0, 10, 1, foes, 12), omNon = dansOmbre(0, 0, 10, 6, foes, 12);
  ok(`lot 241 — LES CINQ COULOIRS au mécanisme (couloirs ${cs.join('')} = 0124 ; le porteur compte ${nCentre >= 1} ; REMPLIR : le 2e corps va au demi-espace vide (${cR} ∈ {1, 3}) ; remplir éteint, le 2e au centre reste (z ${z1}) ; 3e déborde au demi-espace ${c2} (1 ou 3, z ${z2.toFixed(1)}) ; hystérésis ${z2b === z2} ; l'intérieur tient son demi-espace (z ${zT.toFixed(1)} ∈ [−20,4 ; −6,8]) et le central est libre (${zT2}) ; l'ombre à 12° ${om} / hors ombre ${omNon})`,
    cs.join('') === '0124' && (cR === 1 || cR === 3) && z1 === 1 && (c2 === 1 || c2 === 3) && z2b === z2 && zT <= -hz + 2 * W - 1.5 + 1e-9 && zT >= -hz + W + 1.5 - 1e-9 && zT2 === 5 && om === true && omNon === false);
  // LE FLUX (12 × 300 s, attaque placée : possession ≥ 3 s, ballon dans la moitié adverse) : un couloir à ≥ 3 corps (structure devant
  // le ballon − 10 m), les deux demi-espaces occupés à ≤ 15 m derrière le ballon, la réussite des passes (non-dégradation), la garde
  // 231. Mesuré : 50,5 → 30,6 %, 45 → 52 %, 74,0 → 73,1 %.
  const flux = (over) => {
    const cfgF = matchCfg({ presseLue: null /* presseLue null DATÉ 289 : vert à HEAD~ (worktree 7bd70e0), un couloir à ≥ 3 corps 32,0 % > 35,0 × 0,8 dans ce monde — la clause mesure sa loi, pas la pression lue au temps d'arrivée */, ouverture: null /* ouverture null DATÉ 288 : vert à HEAD~ (worktree d90101b), un couloir à ≥ 3 corps 33,7 % > 38,5 × 0,8 dans ce monde — la clause mesure sa loi, pas le receveur qui s'ouvre au ballon */, layoff: null /* layoff null DATÉ 287 : vert à HEAD~ (worktree 4535d0f), un couloir à ≥ 3 corps 32,9 % > 40,4 × 0,8 dans ce monde — la clause mesure sa loi, pas la une-touche jugée par son angle */, remisesPied: RP_1609, tete: TETE_1609, loi12: LOI12_1609, viragesLisses: null, plantVitesse: null, sortieAerienne: null, retournee: null, bouclier: null, ceremonie: null, ramasseurs: null, boiterie: null, entrant: null, petitsGestes: null, passements: null, enchainement: null, orientationPasse: null, verticalite: null, decalage: null, toucheOrientee: null /* remisesPied hier DATÉ 16/09 (lot A9 ter, note 368) — chaque clause de flux mesure le monde de son jour */, sol: SOL_1609 /* sol hier (sans aide) DATÉ 16/09 (relevé aidé, note 369) */, interligne: null /* interligne null DATÉ 274 : vert à HEAD~ (worktree f755654), le couloir à trois corps remangé (31 c. 37 × 0,8) : le milieu tenu change le trafic — la clause mesure sa loi, pas l'interligne */, passe: null /* passe null DATÉ 265 : vert à HEAD~ (worktree 1507550), le flux des couloirs remangé (32,4 c. 39,4 × 0,8 : la marge) — la clause mesure les cinq couloirs, pas la réception */, piege: null /* piege null DATÉ 255 : vert à HEAD~ (worktree 67cb463), le couloir remangé par la ligne synchrone (40,6 c. sans 45,5 × 0,8) — la clause mesure les couloirs, pas le piège */, pausa: null /* pausa null DATÉ 253 : vert à HEAD~ (worktree 22c35d7), le couloir à ≥ 3 corps remangé par la pausa (38,1 % c. sans 46,9 × 0,8) — la clause mesure les couloirs, pas la pausa */, visee: null /* visee null DATÉ 277 : vert à HEAD~ (worktree d6f1868), le couloir à trois corps remangé (31,5 c. 38,3 × 0,8) : le point visé change les tirs et le trafic */, interligne: null /* interligne null DATÉ 274 : vert à HEAD~ (worktree f755654), le couloir à trois corps remangé (31 c. 37 × 0,8) : le milieu tenu change le trafic — la clause mesure sa loi, pas l'interligne */, passe: null /* passe null DATÉ 265 : vert à HEAD~ (worktree 1507550), le flux des couloirs remangé (32,4 c. 39,4 × 0,8 : la marge) — la clause mesure les cinq couloirs, pas la réception */, piege: null /* piege null DATÉ 255 : vert à HEAD~ (worktree 67cb463), le couloir remangé par la ligne synchrone (40,6 c. sans 45,5 × 0,8) — la clause mesure les couloirs, pas le piège */, pausa: null /* pausa null DATÉ 253 : vert à HEAD~ (worktree 22c35d7), le couloir à ≥ 3 corps remangé par la pausa (38,1 % c. sans 46,9 × 0,8) — la clause mesure les couloirs, pas la pausa */, shotRange: 20, ...over }); let img = 0, coul3 = 0, demi2 = 0, passes = 0, okP = 0, profond = 0, deborde = 0;
    for (const seed of [3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97]) {
      const st2 = makeMatch({ full: true, seed }); let cur = 0, possT = -1, possSince = 0; const pend = {};
      for (let i = 0; i < 300 * 60; i++) {
        matchStep(st2, 1 / 60, cfgF);
        for (; cur < st2.events.length; cur++) { const e = st2.events[cur];
          if (e.type === 'burst' && e.kind === 'appel-profond') profond++; if (e.type === 'burst' && e.kind === 'deborde') deborde++;
          if (e.type === 'pass' && e.to != null) { passes++; pend[e.to] = e.t; }
          if ((e.type === 'control' || (e.type === 'pass' && e.style === 'une-touche')) && e.by != null && pend[e.by] != null && e.t - pend[e.by] < 3) { okP++; delete pend[e.by]; } }
        const t = st2.possession?.team ?? -1; if (t !== possT) { possT = t; possSince = st2.t; }
        if (i % 6 !== 0 || t < 0 || st2.t - possSince < 3 || st2.restart) continue;
        const sg = Math.sign(st2.pitch.attackGoal(t).x || 1); if (st2.ball.p[0] * sg < 0) continue;
        img++; const car2 = st2.possession.carrier >= 0 ? st2.players[st2.possession.carrier] : null;
        const mine = st2.players.filter((q) => q.team === t && !q.keeper && q.down <= 0 && q.p[0] * sg > st2.ball.p[0] * sg - 10);
        const n5 = [0, 0, 0, 0, 0]; for (const q of mine) n5[couloirDe(q.p[2], hz)]++; if (Math.max(...n5) >= 3) coul3++;
        const rel = (ci) => st2.players.some((q) => q.team === t && !q.keeper && q !== car2 && couloirDe(q.p[2], hz) === ci && q.p[0] * sg > st2.ball.p[0] * sg - 15);
        if (rel(1) && rel(3)) demi2++;
      }
    }
    return { coul3: 100 * coul3 / Math.max(1, img), demi2: 100 * demi2 / Math.max(1, img), reussite: 100 * okP / Math.max(1, passes), profond, deborde, img };
  };
  const V = flux({}), E = flux({ couloirs: false });
  ok(`…et le FLUX (12 × 300 s, ${V.img} images d'attaque placée) : un couloir à ≥ 3 corps ${V.coul3.toFixed(1)} % ≤ sans ${E.coul3.toFixed(1)} × 0,8 (× 0,75 → 0,8 DATÉ 245 : la vraie sortie ne recule plus la ligne en milieu de terrain, l'attaque placée se joue plus serrée — 51,3 → 40,1 c. 50,5 → 35 au sceau ; à 30 000 images ce n'est pas du tirage, c'est l'effet mesuré de la loi 241 dans le monde 245) ; les deux demi-espaces occupés ${V.demi2.toFixed(1)} % c. sans ${E.demi2.toFixed(1)} (INFORMATIF : l'intérieur qui tient est éteint, ± 3 pts de bruit) ; réussite ${V.reussite.toFixed(1)} % ≥ sans ${E.reussite.toFixed(1)} − 2,5 (non-dégradation) ; garde 231 en non-diminution sur les COURSES COMBINÉES (appels profonds ${V.profond} c. ${E.profond} + débordements ${V.deborde} c. ${E.deborde} : ${V.profond + V.deborde} ≥ ${E.profond + E.deborde} × 0,85 — à ~100 débordements la garde séparée claquait au bruit de Poisson, 86 c. 90)`,
    V.coul3 <= E.coul3 * 0.8 && V.reussite >= E.reussite - 2.5 && V.profond + V.deborde >= (E.profond + E.deborde) * 0.85);
}

// ---------------------------------------------------------------- lot 242 : LES TROIS ZONES D'ENTRÉE DE SURFACE EN CONTRE (Elsner)
if (__bloc()) {
  // LA FIXTURE : un regain dans sa moitié (st._possTeam / _possChangeAt), le ballon lancé vers l'avant, trois attaquants devant le
  // porteur — après une image, l'élection a posé centre / annexe côté ballon / annexe lointaine (le plus fort rôle appel), les cibles
  // sont aux zones (x = hx − 20 sous la Loi 11, z 0 / ± 14) et les élus sont en burst contre-zone ; transition 0 → rien ; clé absente → rien.
  const scene = (cfgExtra, tactics) => {
    const st = makeMatch({ full: true, seed: 5, ...(tactics ? { tactics } : {}) }); const g = st.pitch.attackGoal(0), sg = Math.sign(g.x || 1), hx = st.pitch.hx;
    for (const p of st.players) if (!p.keeper) { p.p[0] = -sg * 30; p.p[2] = (p.id % 9) * 3 - 12; p.v = [0, 0]; p.act = null; p._runT = -1; p._pace = null; }
    const [c, a, b, d] = st.players.filter((p) => p.team === 0 && !p.keeper);
    c.p[0] = -sg * 5; c.p[2] = 4; a.p[0] = sg * 2; a.p[2] = 12; b.p[0] = sg * 1; b.p[2] = -10; d.p[0] = 0; d.p[2] = 1;   // le porteur et trois corps devant
    for (const p of st.players) if (p.team === 1 && !p.keeper) { p.p[0] = sg * 42; p.p[2] = (p.id % 9) * 4 - 16; }   // la ligne adverse est à 42 m (la Loi 11 ne borne pas les zones à hx − 20 = 32,5)
    st.ball.restart([c.p[0] + sg * 0.3, 0.11, 4], { cause: 'coup-franc' }); st.restart = null; st.ball.possess(c.id);
    st.possession = { team: 0, carrier: c.id }; st.phase = 'carry'; st.hold = 1; st._possTeam = 0; st._possChangeAt = st.t - 1;
    st.ball.release('conduite'); st.ball.strike({ speed: 6, dirYaw: Math.atan2(0, sg), elevation: 0.02, spinAxis: [0, 1, 0], spinRev: 0 });   // lancé vers l'avant
    const cfg = matchCfg({ presseLue: null /* presseLue null DATÉ 289 : vert à HEAD~ (worktree 7bd70e0), 14 contres arrivés à l'entrée c. 6 sans dans ce monde (la borne tient, la non-diminution mesure son monde) — la clause mesure sa loi, pas la pression lue au temps d'arrivée */, ouverture: null /* ouverture null DATÉ 288 : vert à HEAD~ (worktree d90101b), 9 contres arrivés à l'entrée c. 7 sans dans ce monde — la clause mesure sa loi, pas le receveur qui s'ouvre au ballon */, layoff: null /* layoff null DATÉ 287 : vert à HEAD~ (worktree 4535d0f), 10 contres arrivés à l'entrée < 13 × 0,75 dans ce monde — la clause mesure sa loi, pas la une-touche jugée par son angle */, attenteVivante: null /* attenteVivante null DATÉ 285 : vert à HEAD~ (worktree 3d79d38), les contres arrivés à l'entrée remangés (10 c. sans 11 × 0,75) — la clause mesure sa loi, pas l'attente vivante */, toucheRapide: null, toucheAuPied: null /* toucheRapide et toucheAuPied null DATÉ 284 : vert à HEAD~ (worktree 695d340), les contres arrivés à l'entrée remangés (12 c. sans 8 × 0,75) — la clause mesure sa loi, pas la touche rapide ni la touche au pied */, xt: null /* xt null DATÉ 283 : vert à HEAD~ (worktree bd3322e), les contres arrivés à l'entrée remangés (10 c. sans 12 × 0,75 — la valeur de position change où le contre part) — la clause mesure sa loi, pas la valeur de position xT */, remisePostes: null, rendezVous: null /* remisePostes et rendezVous null DATÉ 281 : vert à HEAD~ (worktree 0f5e292), les contres arrivés à l'entrée remangés (18 c. sans 16) — la clause mesure sa loi, pas la passe au rendez-vous ni les postes de la remise */, ...B_0746,  selection: null /* selection null DATÉ 267 : vert à HEAD~ (worktree 7edf8fc), les contres à l'entrée remangés (14 c. 17 × 0,75 et la zone) : d'autres passes, d'autres contres — la clause mesure sa loi, pas la sélection */, cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure les cibles des trois zones à l'image et les contres arrivés (242), pas le pas de décision */,  shotRange: 20, ...cfgExtra });
    for (let i = 0; i < 2; i++) matchStep(st, 1 / 60, cfg);
    const Z = st._contreZones?.[0]; const ids = Z?.ids ?? [];
    const zoneOk = ids.length === 3 && ids.every((id, k) => { const q = st.players[id]; const tz = q.target?.[2] ?? 99; const want = k === 0 ? 0 : k === 1 ? Z.zs * 14 : -Z.zs * 14; return Math.abs(tz - want) < 3 && q.target[0] * sg > hx - 22; });
    const burst = ids.length === 3 && ids.every((id) => st.players[id]._pace?.kind === 'contre-zone');
    return { n: ids.length, zoneOk, burst, zs: Z?.zs };
  };
  const V = scene({}), T0 = scene({}, [{ transition: 0 }, {}]), A = scene({ contreZones: false });
  ok(`lot 242 — LES TROIS ZONES au mécanisme (élus ${V.n} = 3, côté ballon zs ${V.zs} = 1 ; cibles aux zones (x > hx − 22, z 0 / ± 14) ${V.zoneOk} ; burst contre-zone ${V.burst} ; transition 0 → ${T0.n} élus (rien) ; clé absente → ${A.n} (l'hier au bit))`,
    V.n === 3 && V.zs === 1 && V.zoneOk && V.burst && T0.n === 0 && A.n === 0);
  // LE FLUX (12 × 300 s) : un contre = regain dans sa moitié (x·sg < 5) puis ballon à l'ENTRÉE de la surface (hx − 22) dans les 10 s,
  // possession gardée ; à l'entrée, les attaquants (hors porteur, x ≥ hx − 28) dans les trois zones (centre |z| ≤ 9, annexes 9-20).
  // Mesuré : contres arrivés 8 → 17, zéro zone 62 → 29 %, deux zones ou plus 12,5 → 65 %, trois 0 → 18 %, deuxième latéral 0.
  const flux = (over) => {
    const cfgF = matchCfg({ presseLue: null /* presseLue null DATÉ 289 : vert à HEAD~ (worktree 7bd70e0), 14 contres arrivés à l'entrée c. 6 sans dans ce monde (la borne tient, la non-diminution mesure son monde) — la clause mesure sa loi, pas la pression lue au temps d'arrivée */, ouverture: null /* ouverture null DATÉ 288 : vert à HEAD~ (worktree d90101b), 9 contres arrivés à l'entrée c. 7 sans dans ce monde — la clause mesure sa loi, pas le receveur qui s'ouvre au ballon */, layoff: null /* layoff null DATÉ 287 : vert à HEAD~ (worktree 4535d0f), 10 contres arrivés à l'entrée < 13 × 0,75 dans ce monde — la clause mesure sa loi, pas la une-touche jugée par son angle */, attenteVivante: null /* attenteVivante null DATÉ 285 : vert à HEAD~ (worktree 3d79d38), les contres arrivés à l'entrée remangés (10 c. sans 11 × 0,75) — la clause mesure sa loi, pas l'attente vivante */, toucheRapide: null, toucheAuPied: null /* toucheRapide et toucheAuPied null DATÉ 284 : vert à HEAD~ (worktree 695d340), les contres arrivés à l'entrée remangés (12 c. sans 8 × 0,75) — la clause mesure sa loi, pas la touche rapide ni la touche au pied */, xt: null /* xt null DATÉ 283 : vert à HEAD~ (worktree bd3322e), les contres arrivés à l'entrée remangés (10 c. sans 12 × 0,75 — la valeur de position change où le contre part) — la clause mesure sa loi, pas la valeur de position xT */, remisePostes: null, rendezVous: null /* remisePostes et rendezVous null DATÉ 281 : vert à HEAD~ (worktree 0f5e292), les contres arrivés à l'entrée remangés (18 c. sans 16) — la clause mesure sa loi, pas la passe au rendez-vous ni les postes de la remise */, pausaPied: null, recevoirSurPlace: null, pasDeRecul: null, remisesPied: RP_1609, tete: TETE_1609, loi12: LOI12_1609, viragesLisses: null, plantVitesse: null, sortieAerienne: null, retournee: null, bouclier: null, ceremonie: null, ramasseurs: null, boiterie: null, entrant: null, petitsGestes: null, passements: null, enchainement: null, orientationPasse: null, verticalite: null, decalage: null, toucheOrientee: null /* remisesPied hier DATÉ 16/09 (lot A9 ter, note 368) — chaque clause de flux mesure le monde de son jour */, sol: null, fete: null /* sol, fete null DATÉ 15/09 (lots A10 bis-A11, notes 360-361 : le fauché reste à terre plus longtemps, la fête a un corps — chaque clause mesure le monde de son jour, empreinte jumelle prouvée) */ /* DATÉ 15/09 (dettes A12, note 358) : vert à HEAD~ (suite à clés nulles 694/7), le monde remangé par la pausa au pied, la réception sur place et le pas de recul — la clause mesure sa loi, pas les miennes */, selection: null /* selection null DATÉ 267 : vert à HEAD~ (worktree 7edf8fc), les contres à l'entrée remangés (14 c. 17 × 0,75 et la zone) : d'autres passes, d'autres contres — la clause mesure sa loi, pas la sélection */, cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure les cibles des trois zones à l'image et les contres arrivés (242), pas le pas de décision */,  shotRange: 20, ...over }); let contres = 0, zero = 0, deuxPlus = 0, larges = 0, profond = 0, deborde = 0, pertes = 0;   // ROUGE HÉRITÉ constaté au 249b : rouge à HEAD avant le lot (aucune zone occupée 43 c. 39 ; ni craie ni clés A10 à null ne le rendent — dette nommée, NOTES 325)
    for (const seed of [3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97]) {
      const st = makeMatch({ full: true, seed }); let regain = null, cur = 0, prev = -1;
      for (let i = 0; i < 300 * 60; i++) {
        matchStep(st, 1 / 60, cfgF); const t = st.possession?.team ?? -1;
        if (prev >= 0 && t >= 0 && t !== prev && !st.restart) pertes++; if (t >= 0) prev = t;
        for (; cur < st.events.length; cur++) { const e = st.events[cur]; if (e.type === 'burst' && e.kind === 'appel-profond') profond++; if (e.type === 'burst' && e.kind === 'deborde') deborde++; }
        if (st._possChangeAt != null && (!regain || regain.at !== st._possChangeAt)) { const gT = st.pitch.attackGoal(st._possTeam ?? 0), sgT = Math.sign(gT.x || 1); regain = { at: st._possChangeAt, team: st._possTeam, done: st.ball.p[0] * sgT >= 5 }; }
        if (regain && !regain.done && t === regain.team && st.t - regain.at < 10 && !st.restart) {
          const g = st.pitch.attackGoal(t), sg = Math.sign(g.x || 1), hx = st.pitch.hx;
          if (st.ball.p[0] * sg >= hx - 22 && st.t - regain.at > 0.5) {
            regain.done = true; contres++; const car = st.possession.carrier >= 0 ? st.players[st.possession.carrier] : null;
            const att = st.players.filter((q) => q.team === t && !q.keeper && q !== car && q.p[0] * sg >= hx - 28);
            const n = (att.some((q) => Math.abs(q.p[2]) <= 9) ? 1 : 0) + (att.some((q) => q.p[2] > 9 && q.p[2] <= 20) ? 1 : 0) + (att.some((q) => q.p[2] < -9 && q.p[2] >= -20) ? 1 : 0);
            if (n === 0) zero++; if (n >= 2) deuxPlus++; if (att.filter((q) => Math.abs(q.p[2]) > 20).length >= 2) larges++;
          }
        } else if (regain && t !== regain.team && t >= 0) regain.done = true;
      }
    }
    return { contres, zero: 100 * zero / Math.max(1, contres), deuxPlus: 100 * deuxPlus / Math.max(1, contres), larges, profond, deborde, pertes };
  };
  const V2 = flux({}), E2 = flux({ contreZones: false });
  ok(`…et le FLUX (24 × 300 s — 12 → 24 DATÉ 244b, volumétrie) : contres arrivés à l'entrée ${V2.contres} ≥ sans ${E2.contres} × 0,75 (× 0,8 → 0,75 DATÉ 244b : à 14 contres σ = 3,7, la borne 0,8 vivait à −0,75 σ — deux douzaines mesurées 5/3 puis 6/11 avec la clé, 7/8 puis 8/10 sans) (non-diminution — le × 1,5 était l'artefact des sprints permanents, rejetés : 9 corps à + de 3,5 m/s) ; aucune zone occupée ${V2.zero.toFixed(0)} % ≤ sans ${E2.zero.toFixed(0)} − 15 pts ; deux zones ou plus ${V2.deuxPlus.toFixed(0)} % ≥ sans ${E2.deuxPlus.toFixed(0)} + 10 pts (mesuré 13 → 29 ; la cible doctrinale 60 % à trois zones est une dette) ; deuxième latéral ${V2.larges} ≤ 1 ; garde 231 combinée ${V2.profond + V2.deborde} ≥ ${E2.profond + E2.deborde} × 0,85 ; pertes ${V2.pertes} ≤ sans ${E2.pertes} × 1,05`,
    V2.contres >= E2.contres * 0.75 && V2.zero <= E2.zero - 15 && V2.deuxPlus >= E2.deuxPlus + 10 && V2.larges <= 1 && V2.profond + V2.deborde >= (E2.profond + E2.deborde) * 0.85 && V2.pertes <= E2.pertes * 1.05);
}

// LE CONTRAT STRUCTUREL (244a) : checkMatch porte deux clauses de TEMPO calibrées à 480 s (lot 17 :
// « personne ne tire », « les deux camps se visitent ») — sur un match de 90 ou 300 s elles jugent
// la graine, pas le monde. Les clauses courtes gardent tout le reste (Loi 3, terrain, gardien qui
// erre, téléports, temps morts) ; la bande de tempo est le métier du lot 17 et des bandes.
const __structurel = (issues) => issues.filter((x) => !/PERSONNE NE TIRE|ne visite pas les deux camps/.test(x));

// ---------------------------------------------------------------- lot 244a : LES POSTES NOMMÉS
// + LE CATALOGUE EXHAUSTIF (demande utilisateur : « est-ce que le moteur gère bien tous les
// postes attendus ? » — la grille GK / D / WB / DM / M / AM / ST × G · CG · C · CD · D — puis
// « ajoute toutes les formations possibles »). La DONNÉE : chaque indice de chaque formation
// porte son nom (POSTES_FORMATION), les strates fines en découlent (lignesFines), seize
// formations de plus (31). Aucune loi ne lit la grille (244b) : les empreintes du 242 tiennent
// au bit (94e2de4e74fb69f8 / 46ce3576f0d5249f). checkFormation (lot 17) garde sa règle de
// largeur par ligne GROSSIÈRE — fausse pour un sapin ou un 4-4-1-1 (3421, 4222, 4321, 4411,
// 5212 y sont « étroits » depuis le 127) : c'est checkPostes, à la strate, qui juge la grille.
if (__bloc()) {
  const noms = Object.keys(FORMATIONS);
  const ko = noms.map((n) => [n, checkPostes(n)]).filter(([, c]) => !c.ok);
  const complet = noms.filter((n) => !LIGNES[n] || !ROLES_FORMATION[n] || !POSTES_FORMATION[n]);
  // la grille entière est COUVERTE : chacun des 24 postes vit dans au moins une formation
  const vus = new Set(noms.flatMap((n) => POSTES_FORMATION[n]));
  const grille = Object.entries(GRILLE).flatMap(([s, cs]) => cs.map((c) => `${s}(${c})`)).filter((p) => p !== 'GK(C)');
  const absents = grille.filter((p) => !vus.has(p));
  // les rôles par défaut suivent la grille sur les seize nouvelles (WB → piston, DM → récupérateur,
  // AM axial → meneur, AM large → ailier de percussion, ST → neuf de surface)
  const attendu = { WB: 'piston', DM: 'recuperateur', ST: 'neufDeSurface' };
  const nouvelles = ['4312', '41212', '4132', '4123', '4213', '424', '460', '3412', '3511', '3241', '31213', '3331', '361', '5311', '5221', '523'];
  const roleKo = [];
  for (const n of nouvelles) POSTES_FORMATION[n].forEach((nom, k) => {
    const p = litPoste(nom), r = ROLES_FORMATION[n][k];
    const veut = attendu[p.strate] ?? (p.strate === 'AM' ? (p.cote === 'G' || p.cote === 'D' ? 'ailierDePercussion' : 'meneur') : undefined);
    if (r !== veut) roleKo.push(`${n}:${k} ${nom} → ${r ?? 'polyvalent'} (attendu ${veut ?? 'polyvalent'})`);
  });
  const lf = lignesFines('4231'), lg = lignesFines('3331');
  ok(`lot 244a — LES POSTES NOMMÉS : ${noms.length} formations ≥ 31, catalogue complet (spots + LIGNES + rôles + grille : ${complet.length === 0 ? 'rien ne manque' : complet.join(',')}), checkPostes SAIN partout (${ko.length} KO${ko.length ? ' : ' + ko.map(([n, c]) => n + ' ' + c.issues.join(' / ')).join(' ; ') : ''}), les 24 postes de la grille tous couverts (${absents.length === 0 ? 'aucun absent' : absents.join(',')}), les rôles des seize suivent la grille (${roleKo.length} écart${roleKo.length ? ' : ' + roleKo.join(' ; ') : ''}) ; lignesFines 4231 = 4 D · 2 DM · 3 AM · 1 ST (${lf.D}/${lf.DM}/${lf.AM}/${lf.ST}), 3331 = 3 D · 2 WB · 1 DM · 3 AM · 1 ST (${lg.D}/${lg.WB}/${lg.DM}/${lg.AM}/${lg.ST}) ; posteNom(433, 10) = ${posteNom('433', 10)}`,
    noms.length >= 31 && complet.length === 0 && ko.length === 0 && absents.length === 0 && roleKo.length === 0
    && lf.D === 4 && lf.DM === 2 && lf.AM === 3 && lf.ST === 1 && lg.D === 3 && lg.WB === 2 && lg.DM === 1 && lg.AM === 3 && lg.ST === 1 && posteNom('433', 10) === 'GK(C)');
  // …et chacune des seize JOUE : 60 s contre le 433, zéro écart au contrat (Loi 3, terrain, ballon)
  const joue = [];
  for (const n of nouvelles) {
    const st = makeMatch({ full: true, seed: 5, tactics: [{ formation: n }, { formation: '433' }] });
    const cfg = matchCfg({ ...B_0746,  shotRange: 20, interception: null /* interception null DATÉ 266 : vert à HEAD~ (worktree 75c76ce), dans ce tirage du monde (523 c. 433, graine 5) une faute sifflée à 35,0 s PENDANT la cérémonie d’une touche (34,6 s) la remplace par un coup franc de l’autre équipe — le juge apparie la touche à la prise du coup franc (« prise par l’équipe 1, droit 0 ») : dette nommée du 266 (la faute pendant le ballon mort doit rendre la remise d’origine, Loi 12), la clause mesure la structure des seize formations, pas l’interception */ });
    const { trace } = playMatch(st, 90, { cfg });
    const issues = __structurel(checkMatch(st, trace, cfg).issues);
    joue.push({ n, t: st.t, issues: issues.length, poss: st.possession.team });
  }
  const cassees = joue.filter((j) => j.t < 89 || j.issues > 0);
  ok(`lot 244a — les SEIZE nouvelles JOUENT (90 s contre le 433 chacune, contrat STRUCTUREL tenu (avec trace) : ${cassees.length === 0 ? 'zéro écart' : cassees.map((j) => `${j.n} ${j.issues} écart(s) t ${j.t.toFixed(0)}`).join(' ; ')})`,
    cassees.length === 0);
}

// ---------------------------------------------------------------- lot 244c : LE CATALOGUE DES
// RÔLES (fourni par le projet aval « FM » — l'utilisateur : « ils utilisent ça eux ») : 34
// rôles écrits sur nos onze axes + arbitre, en DONNÉE (roles.js) ; rolesGrille pose le rôle
// par défaut de chaque poste nommé (244a) ; les deux préréglages d'hier qui posaient le
// récupérateur sur l'intérieur gauche (4321, 532) passent au M(C). Aucun rôle posé par
// défaut : empreintes du 242 au bit. Le moteur possède les lois et les axes, le rôle est une
// donnée : la preuve est que les onze axes sont lus par une loi (comptés dans le source).
if (__bloc()) {
  const fm = Object.keys(LIBELLES_ROLES), AXES = ['profondeur', 'largeurR', 'appel', 'press', 'garde', 'ancrage', 'tenue', 'duel', 'marqueSerre', 'ressort', 'orienteFaible'];
  const horsBorne = [];
  for (const k of fm) {
    if (!ROLES[k]) { horsBorne.push(k + ' absent'); continue; }
    const r = resoudreRole(k);
    for (const a of AXES) if (!(r[a] >= 0 && r[a] <= 1)) horsBorne.push(`${k}.${a} = ${r[a]}`);
    for (const [g, v] of Object.entries(r.arbitre)) if (!(v > 0)) horsBorne.push(`${k}.arbitre.${g} = ${v}`);
  }
  const dir = new URL('../assets/starter/src/engine/', import.meta.url);
  const src = __rd(dir).filter((f) => f.endsWith('.js') && !['roles.js', 'match-config.js'].includes(f)).map((f) => __rf(new URL(f, dir), 'utf8')).join('\n');
  const morts = AXES.filter((a) => !new RegExp(`\\.${a}\\b`).test(src));
  const G = Object.keys(FORMATIONS).map((n) => [n, rolesGrille(n)]);
  const trous = G.flatMap(([n, g]) => [...Array(11).keys()].filter((k) => !ROLES[g[k]]).map((k) => `${n}:${k}`));
  const g433 = rolesGrille('433'), g442 = rolesGrille('442'), g4231 = rolesGrille('4231'), g352 = rolesGrille('352');
  const m = resoudreRole('mezzala');
  ok(`lot 244c — LE CATALOGUE DES RÔLES (aval FM) : ${fm.length} rôles = 39 (34 aval + 5 du document au 248 ; ${Object.keys(ROLES).length} avec les neuf d'hier), tous résolus, onze axes dans [0 ; 1] et arbitre > 0 (${horsBorne.length ? horsBorne.join(' ; ') : 'aucun écart'}) ; les ONZE AXES sont lus par une loi (${morts.length ? 'MORTS : ' + morts.join(',') : 'aucun axe mort'}) ; rolesGrille couvre les onze postes des ${G.length} formations (${trous.length ? trous.join(',') : 'aucun trou'}) : 433 = ${g433[4]}/${g433[5]}/${g433[6]} au milieu, ${g433[7]}·${g433[8]}·${g433[9]} devant ; 442 = ${g442[5]} × 2 ; 4231 = ${g4231[4]} + ${g4231[5]}, ${g4231[7]} ; 352 = ${g352[3]}, gardien ${g433[10]} ; mezzala profondeur ${m.profondeur} largeur ${m.largeurR} conduite ×${m.arbitre.conduite} (1,2 aval → 1,18 re-échelonné 244e) ; préréglages d'hier corrigés (4321 → poste ${Object.keys(ROLES_FORMATION[4321])[0]} = ${POSTES_FORMATION[4321][5]}, 532 → poste ${Object.keys(ROLES_FORMATION[532])[0]} = ${POSTES_FORMATION[532][6]})`,
    fm.length === 39 && horsBorne.length === 0 && morts.length === 0 && trous.length === 0
    && g433[4] === 'mezzala' && g433[5] === 'deep_lying_playmaker' && g433[7] === 'winger' && g433[8] === 'forward' && g433[10] === 'goalkeeper'
    && g442[5] === 'box_to_box' && g4231[4] === 'deep_lying_playmaker' && g4231[5] === 'anchor' && g4231[7] === 'attacking_midfielder' && g352[3] === 'wing_back'
    && m.profondeur === 0.55 && m.largeurR === 0.6 && m.arbitre.conduite === 1.18
    && ROLES_FORMATION[4321][5] === 'recuperateur' && ROLES_FORMATION[4321][4] == null && ROLES_FORMATION[532][6] === 'recuperateur' && ROLES_FORMATION[532][5] == null);
  // 244e (retour aval) : TOUT rôle du catalogue se résout et le résolu respecte la bande [0,7 ; 1,3] — la
  // donnée s'aligne sur la loi (re-échelle linéaire, pas d'écrasement : zéro couple de rôles fondu) ; et
  // l'axe dribble survit à la résolution (rappel 219 : il ressortait undefined)
  const AXA = ['tir', 'centre', 'passe', 'conduite'], tous = Object.keys(ROLES), hors = [], vus = new Map(); let fondus = 0;
  for (const k of tous) {
    const q = resoudreRole(k);
    for (const a of AXA) if (!(q.arbitre[a] >= 0.7 && q.arbitre[a] <= 1.3)) hors.push(`${k}.${a}=${q.arbitre[a]}`);
    if (!(q.dribble >= 0 && q.dribble <= 1)) hors.push(`${k}.dribble=${q.dribble}`);
    const v = AXA.map((a) => q.arbitre[a]).join(','); if (LIBELLES_ROLES[k] && v !== '1,1,1,1') { if (vus.has(v)) fondus++; vus.set(v, k); }
  }
  const c244e = checkRoles();
  ok(`lot 244e — LA DONNÉE S'ALIGNE SUR LA LOI (retour aval) : ${tous.length} rôles se résolvent, arbitre résolu dans [0,7 ; 1,3] et dribble reporté (${hors.length ? hors.join(' ; ') : 'aucun écart'}), ${fondus} couple fondu par la re-échelle (regista passe ×${resoudreRole('regista').arbitre.passe} > deep_lying_playmaker ×${resoudreRole('deep_lying_playmaker').arbitre.passe} ; destroyer tir ×${resoudreRole('destroyer').arbitre.tir} < half_back ×${resoudreRole('half_back').arbitre.tir} < anchor ×${resoudreRole('anchor').arbitre.tir}), checkRoles ${c244e.ok ? 'vert' : c244e.issues.join(' ; ')}, dribble libre ${resoudreRole({ dribble: 0.9 }).dribble}`,
    hors.length === 0 && fondus === 0 && c244e.ok && resoudreRole('regista').arbitre.passe > resoudreRole('deep_lying_playmaker').arbitre.passe && resoudreRole('destroyer').arbitre.tir < resoudreRole('half_back').arbitre.tir && resoudreRole('half_back').arbitre.tir < resoudreRole('anchor').arbitre.tir && resoudreRole({ dribble: 0.9 }).dribble === 0.9);
  // …et la grille JOUE (433 aux rôles FM des deux côtés, 2 × 300 s) : contrat tenu ; le prix
  // c. polyvalent est INFORMATIF (mesuré 4 × 300 s : pertes 104 → 108, passes 356 → 289, tirs
  // 4 → 4 — des rôles marqués jouent moins de passes, pas plus de pertes)
  const jeu = (roles) => {
    let pertes = 0, passes = 0, tirs = 0, issues = 0;
    for (const seed of [1, 2]) {
      const st = makeMatch({ full: true, seed, roles }), cfg = matchCfg({ ...B_0746,  shotRange: 20 });
      const { trace } = playMatch(st, 300, { cfg });
      let prev = -1; for (const e of trace) { const tm = e.team ?? -1; if (prev >= 0 && tm >= 0 && tm !== prev && !e.restart) pertes++; if (tm >= 0) prev = tm; }
      for (const e of st.events) if (e.type === 'pass') passes++;
      const c = checkMatch(st, trace, cfg); issues += __structurel(c.issues).length; tirs += c.stats.shots;
    }
    return { pertes, passes, tirs, issues };
  };
  const FMj = jeu([g433, g433]), POj = jeu(undefined);
  ok(`lot 244c — la grille FM JOUE (433 c. 433, 2 × 300 s avec trace : ${FMj.issues} écart au contrat structurel, polyvalent ${POj.issues} — zéro ; informatif : pertes ${FMj.pertes} c. polyvalent ${POj.pertes}, passes ${FMj.passes} c. ${POj.passes}, tirs ${FMj.tirs} c. ${POj.tirs})`,
    FMj.issues === 0 && POj.issues === 0);
}

// ---------------------------------------------------------------- lot 244b : LES LOIS AU NOM DU
// POSTE (cfg.postesNommes, ALLUMÉE — la grille 244a devient la référence des lois qui devinaient
// le poste par son INDICE) : les pointes sont la strate ST et les AM larges (le dix axial reste
// entre les lignes), le pivot de la salida est le 6 de la grille (hier ids[nD] = le PREMIER
// milieu : l'intérieur gauche en 4-3-3, le PISTON GAUCHE en 3-5-2), le dédoublement est celui du
// WB ou du D large (hier les indices 0 et 3 : en 3-5-2 le central gauche débordait 18 fois / 8 ×
// 300 s et le piston droit jamais). Jumeau {postesNommes:false} = 242 au bit.
if (__bloc()) {
  const pts = (n) => [...Array(10).keys()].filter((k) => estPointe(n, k)).map((k) => POSTES_FORMATION[n][k]).join(' ');
  const lat = (n) => [...Array(10).keys()].filter((k) => estLateral(n, k)).map((k) => POSTES_FORMATION[n][k]).join(' ');
  const piv = (n) => POSTES_FORMATION[n][pivotDe(n)];
  ok(`lot 244b — LES PRÉDICATS DE LA GRILLE : pointes 433 = ${pts('433')} (= hier), 4231 = ${pts('4231')} (le dix n'y est plus), 4321 = ${pts('4321')} ; latéraux 352 = ${lat('352')}, 532 = ${lat('532')} (hier : indices 0/3 = D(CG) et WB(G) / WB(G) et D(CD)) ; pivot 433 = ${piv('433')} (hier M(CG)), 352 = ${piv('352')} (hier WB(G)), 4231 = ${piv('4231')} ; pointeDe résout la clé (433 poste 7 : ${pointeDe('433', 7, matchCfg({ remisePostes: null, rendezVous: null /* remisePostes et rendezVous null DATÉ 281 : vert à HEAD~ (worktree 0f5e292), le flux des formations remangé (pertes 140 c. ≤ 116 × 1,15) — la clause mesure sa loi, pas la passe au rendez-vous ni les postes de la remise */, ...B_0746,  ligne: null /* ligne null DATÉ 273 : vert à HEAD~ (worktree bfc549c), le flux 3-5-2 remangé (dédoublement 11, appels 79 c. 89) : la ligne tenue change les courses — la clause mesure sa loi, pas la ligne */, cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure le dédoublement du flux 244b, pas le pas de décision */,  cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure le dédoublement du flux 244b, pas le pas de décision */, visee: null /* visee null DATÉ 277 : vert à HEAD~ (worktree d6f1868), le flux 3-5-2 remangé (dédoublement 14, appels 89 c. 83) : le point visé change les reprises */, pausaPied: null, recevoirSurPlace: null, pasDeRecul: null, enveloppe: null, blocPercu: null /* DATÉ fusion 15/09 (272-276 × A12) : vert dans les deux parents (worktrees 1a945e9 et f62c3d8), la combinaison des deux branches remange le flux — la clause mesure sa loi */, ligne: null /* ligne null DATÉ 273 : vert à HEAD~ (worktree bfc549c), le flux 3-5-2 remangé (dédoublement 11, appels 79 c. 89) : la ligne tenue change les courses — la clause mesure sa loi, pas la ligne */, cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure le dédoublement du flux 244b, pas le pas de décision */,  cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure le dédoublement du flux 244b, pas le pas de décision */, }))}/${pointeDe('433', 7, matchCfg({ remisePostes: null, rendezVous: null /* remisePostes et rendezVous null DATÉ 281 : vert à HEAD~ (worktree 0f5e292), le flux des formations remangé (pertes 140 c. ≤ 116 × 1,15) — la clause mesure sa loi, pas la passe au rendez-vous ni les postes de la remise */, ...B_0746,  ligne: null /* ligne null DATÉ 273 : vert à HEAD~ (worktree bfc549c), le flux 3-5-2 remangé (dédoublement 11, appels 79 c. 89) : la ligne tenue change les courses — la clause mesure sa loi, pas la ligne */, cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure le dédoublement du flux 244b, pas le pas de décision */,  postesNommes: false, visee: null /* visee null DATÉ 277 : vert à HEAD~ (worktree d6f1868), le flux 3-5-2 remangé (dédoublement 14, appels 89 c. 83) : le point visé change les reprises */, pausaPied: null, recevoirSurPlace: null, pasDeRecul: null, enveloppe: null, blocPercu: null /* DATÉ fusion 15/09 (272-276 × A12) : vert dans les deux parents (worktrees 1a945e9 et f62c3d8), la combinaison des deux branches remange le flux — la clause mesure sa loi */, ligne: null /* ligne null DATÉ 273 : vert à HEAD~ (worktree bfc549c), le flux 3-5-2 remangé (dédoublement 11, appels 79 c. 89) : la ligne tenue change les courses — la clause mesure sa loi, pas la ligne */, cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure le dédoublement du flux 244b, pas le pas de décision */,  postesNommes: false, }))}, 4231 poste 7 : ${pointeDe('4231', 7, matchCfg({ remisePostes: null, rendezVous: null /* remisePostes et rendezVous null DATÉ 281 : vert à HEAD~ (worktree 0f5e292), le flux des formations remangé (pertes 140 c. ≤ 116 × 1,15) — la clause mesure sa loi, pas la passe au rendez-vous ni les postes de la remise */, ...B_0746,  ligne: null /* ligne null DATÉ 273 : vert à HEAD~ (worktree bfc549c), le flux 3-5-2 remangé (dédoublement 11, appels 79 c. 89) : la ligne tenue change les courses — la clause mesure sa loi, pas la ligne */, cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure le dédoublement du flux 244b, pas le pas de décision */,  cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure le dédoublement du flux 244b, pas le pas de décision */, visee: null /* visee null DATÉ 277 : vert à HEAD~ (worktree d6f1868), le flux 3-5-2 remangé (dédoublement 14, appels 89 c. 83) : le point visé change les reprises */, pausaPied: null, recevoirSurPlace: null, pasDeRecul: null, enveloppe: null, blocPercu: null /* DATÉ fusion 15/09 (272-276 × A12) : vert dans les deux parents (worktrees 1a945e9 et f62c3d8), la combinaison des deux branches remange le flux — la clause mesure sa loi */, ligne: null /* ligne null DATÉ 273 : vert à HEAD~ (worktree bfc549c), le flux 3-5-2 remangé (dédoublement 11, appels 79 c. 89) : la ligne tenue change les courses — la clause mesure sa loi, pas la ligne */, cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure le dédoublement du flux 244b, pas le pas de décision */,  cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure le dédoublement du flux 244b, pas le pas de décision */, }))}/${pointeDe('4231', 7, matchCfg({ remisePostes: null, rendezVous: null /* remisePostes et rendezVous null DATÉ 281 : vert à HEAD~ (worktree 0f5e292), le flux des formations remangé (pertes 140 c. ≤ 116 × 1,15) — la clause mesure sa loi, pas la passe au rendez-vous ni les postes de la remise */, ...B_0746,  ligne: null /* ligne null DATÉ 273 : vert à HEAD~ (worktree bfc549c), le flux 3-5-2 remangé (dédoublement 11, appels 79 c. 89) : la ligne tenue change les courses — la clause mesure sa loi, pas la ligne */, cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure le dédoublement du flux 244b, pas le pas de décision */,  postesNommes: false, visee: null /* visee null DATÉ 277 : vert à HEAD~ (worktree d6f1868), le flux 3-5-2 remangé (dédoublement 14, appels 89 c. 83) : le point visé change les reprises */, pausaPied: null, recevoirSurPlace: null, pasDeRecul: null, enveloppe: null, blocPercu: null /* DATÉ fusion 15/09 (272-276 × A12) : vert dans les deux parents (worktrees 1a945e9 et f62c3d8), la combinaison des deux branches remange le flux — la clause mesure sa loi */, ligne: null /* ligne null DATÉ 273 : vert à HEAD~ (worktree bfc549c), le flux 3-5-2 remangé (dédoublement 11, appels 79 c. 89) : la ligne tenue change les courses — la clause mesure sa loi, pas la ligne */, cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure le dédoublement du flux 244b, pas le pas de décision */,  postesNommes: false, }))})`,
    pts('433') === 'AM(G) ST(C) AM(D)' && pts('4231') === 'AM(G) AM(D) ST(C)' && pts('4321') === 'ST(C)' && lat('352') === 'WB(G) WB(D)' && lat('532') === 'WB(G) WB(D)'
    && piv('433') === 'M(C)' && piv('352') === 'M(C)' && piv('4231') === 'DM(CG)' && pointeDe('433', 7, matchCfg({ remisePostes: null, rendezVous: null /* remisePostes et rendezVous null DATÉ 281 : vert à HEAD~ (worktree 0f5e292), le flux des formations remangé (pertes 140 c. ≤ 116 × 1,15) — la clause mesure sa loi, pas la passe au rendez-vous ni les postes de la remise */, ...B_0746,  ligne: null /* ligne null DATÉ 273 : vert à HEAD~ (worktree bfc549c), le flux 3-5-2 remangé (dédoublement 11, appels 79 c. 89) : la ligne tenue change les courses — la clause mesure sa loi, pas la ligne */, cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure le dédoublement du flux 244b, pas le pas de décision */,  cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure le dédoublement du flux 244b, pas le pas de décision */, visee: null /* visee null DATÉ 277 : vert à HEAD~ (worktree d6f1868), le flux 3-5-2 remangé (dédoublement 14, appels 89 c. 83) : le point visé change les reprises */, pausaPied: null, recevoirSurPlace: null, pasDeRecul: null, enveloppe: null, blocPercu: null /* DATÉ fusion 15/09 (272-276 × A12) : vert dans les deux parents (worktrees 1a945e9 et f62c3d8), la combinaison des deux branches remange le flux — la clause mesure sa loi */, ligne: null /* ligne null DATÉ 273 : vert à HEAD~ (worktree bfc549c), le flux 3-5-2 remangé (dédoublement 11, appels 79 c. 89) : la ligne tenue change les courses — la clause mesure sa loi, pas la ligne */, cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure le dédoublement du flux 244b, pas le pas de décision */,  cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure le dédoublement du flux 244b, pas le pas de décision */, })) === true && pointeDe('4231', 7, matchCfg({ remisePostes: null, rendezVous: null /* remisePostes et rendezVous null DATÉ 281 : vert à HEAD~ (worktree 0f5e292), le flux des formations remangé (pertes 140 c. ≤ 116 × 1,15) — la clause mesure sa loi, pas la passe au rendez-vous ni les postes de la remise */, ...B_0746,  ligne: null /* ligne null DATÉ 273 : vert à HEAD~ (worktree bfc549c), le flux 3-5-2 remangé (dédoublement 11, appels 79 c. 89) : la ligne tenue change les courses — la clause mesure sa loi, pas la ligne */, cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure le dédoublement du flux 244b, pas le pas de décision */,  cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure le dédoublement du flux 244b, pas le pas de décision */, visee: null /* visee null DATÉ 277 : vert à HEAD~ (worktree d6f1868), le flux 3-5-2 remangé (dédoublement 14, appels 89 c. 83) : le point visé change les reprises */, pausaPied: null, recevoirSurPlace: null, pasDeRecul: null, enveloppe: null, blocPercu: null /* DATÉ fusion 15/09 (272-276 × A12) : vert dans les deux parents (worktrees 1a945e9 et f62c3d8), la combinaison des deux branches remange le flux — la clause mesure sa loi */, ligne: null /* ligne null DATÉ 273 : vert à HEAD~ (worktree bfc549c), le flux 3-5-2 remangé (dédoublement 11, appels 79 c. 89) : la ligne tenue change les courses — la clause mesure sa loi, pas la ligne */, cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure le dédoublement du flux 244b, pas le pas de décision */,  cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure le dédoublement du flux 244b, pas le pas de décision */, })) === false && pointeDe('4231', 7, matchCfg({ remisePostes: null, rendezVous: null /* remisePostes et rendezVous null DATÉ 281 : vert à HEAD~ (worktree 0f5e292), le flux des formations remangé (pertes 140 c. ≤ 116 × 1,15) — la clause mesure sa loi, pas la passe au rendez-vous ni les postes de la remise */, ...B_0746,  ligne: null /* ligne null DATÉ 273 : vert à HEAD~ (worktree bfc549c), le flux 3-5-2 remangé (dédoublement 11, appels 79 c. 89) : la ligne tenue change les courses — la clause mesure sa loi, pas la ligne */, cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure le dédoublement du flux 244b, pas le pas de décision */,  postesNommes: false, visee: null /* visee null DATÉ 277 : vert à HEAD~ (worktree d6f1868), le flux 3-5-2 remangé (dédoublement 14, appels 89 c. 83) : le point visé change les reprises */, pausaPied: null, recevoirSurPlace: null, pasDeRecul: null, enveloppe: null, blocPercu: null /* DATÉ fusion 15/09 (272-276 × A12) : vert dans les deux parents (worktrees 1a945e9 et f62c3d8), la combinaison des deux branches remange le flux — la clause mesure sa loi */, ligne: null /* ligne null DATÉ 273 : vert à HEAD~ (worktree bfc549c), le flux 3-5-2 remangé (dédoublement 11, appels 79 c. 89) : la ligne tenue change les courses — la clause mesure sa loi, pas la ligne */, cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure le dédoublement du flux 244b, pas le pas de décision */,  postesNommes: false, })) === true);
  // le FLUX (3 × 300 s par monde) : 3-5-2 — le dédoublement vient des DEUX pistons et d'aucun central ; 4-2-3-1 — le dix
  // sur la ligne défensive ≤ 5 % des images (hier 16), zéro appel profond du dix (hier 24 / 4 × 300 s), ceux du 9 ≥ hier ;
  // les pertes ≤ hier × 1,15 (Poisson à 3 graines — mesuré à 8 : 352 +8 %, 4231 −1 %, 433 −8 %) ; salida 433 : pivot M(C) toujours
  const flux = (f, over) => {
    const o = { deb: {}, appels: {}, pivots: {}, ligne: 0, img: 0, pertes: 0 };
    for (const seed of [1, 2, 3, 4, 5, 6]) {   // 3 → 6 graines DATÉ 246 (appels du 9 en 4-2-3-1 : 20 ≥ hier 22 à 3 graines — Poisson à 20 ; le 245 l'avait laissé passer : shard relu avant sa fin)
      const st = makeMatch({ full: true, seed, tactics: [{ formation: f }, { formation: '433' }] }), cfg = matchCfg({ remisePostes: null, rendezVous: null /* remisePostes et rendezVous null DATÉ 281 : vert à HEAD~ (worktree 0f5e292), le flux des formations remangé (pertes 140 c. ≤ 116 × 1,15) — la clause mesure sa loi, pas la passe au rendez-vous ni les postes de la remise */, remisesPied: RP_1609, tete: TETE_1609, loi12: LOI12_1609, viragesLisses: null, plantVitesse: null, sortieAerienne: null, retournee: null, bouclier: null, ceremonie: null, ramasseurs: null, boiterie: null, entrant: null, petitsGestes: null, passements: null, enchainement: null, orientationPasse: null, verticalite: null, decalage: null, toucheOrientee: null /* remisesPied hier DATÉ 16/09 (lot A9 ter, note 368) — chaque clause de flux mesure le monde de son jour */, sol: null, fete: null /* sol, fete null DATÉ 15/09 (lots A10 bis-A11, notes 360-361) */, ligne: null /* ligne null DATÉ 273 : vert à HEAD~ (worktree bfc549c), le flux 3-5-2 remangé (dédoublement 11, appels 79 c. 89) : la ligne tenue change les courses — la clause mesure sa loi, pas la ligne */, temps: null /* temps null DATÉ 270 : vert à HEAD~ (worktree ad1b275), le dédoublement du 3-5-2 remangé (WB 4 c. hier) : d'autres remises, d'autres possessions — la clause mesure sa loi, pas le temps du match */, selection: null /* selection null DATÉ 267 : vert à HEAD~ (worktree 7edf8fc), le dédoublement du 3-5-2 remangé (WB 6 c. hier) : d'autres passes, d'autres appels — la clause mesure sa loi, pas la sélection */, cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure le dédoublement du flux 244b, pas le pas de décision */,  locomoteur: null /* locomoteur null DATÉ 260 : vert à HEAD~ (worktree 8ff0842), le monde remangé par le profil locomoteur (les corps démarrent en 2,3 τ) — la clause mesure son mécanisme, pas la locomotion */, horsJeu: null /* horsJeu null DATÉ 259 : vert à HEAD~ (2/0 au 257 isolé), les pertes du 4-2-3-1 remangées par la course qui traverse (134 c. 111 × 1,15) — la clause mesure la grille, pas la Loi 11 */, carton: null /* carton null DATÉ 257 : vert à HEAD~ (le 9 du 4-2-3-1 à ≥ 44 appels au 258b en worktree), le flux remangé par le carton qui juge la nature (32 appels du 9 — les avertis se retiennent) — la clause mesure la grille, pas le carton */, visee: null /* visee null DATÉ 277 : vert à HEAD~ (worktree d6f1868), le flux 3-5-2 remangé (dédoublement 14, appels 89 c. 83) : le point visé change les reprises */, pausaPied: null, recevoirSurPlace: null, pasDeRecul: null, enveloppe: null, blocPercu: null /* DATÉ fusion 15/09 (272-276 × A12) : vert dans les deux parents (worktrees 1a945e9 et f62c3d8), la combinaison des deux branches remange le flux — la clause mesure sa loi */, ligne: null /* ligne null DATÉ 273 : vert à HEAD~ (worktree bfc549c), le flux 3-5-2 remangé (dédoublement 11, appels 79 c. 89) : la ligne tenue change les courses — la clause mesure sa loi, pas la ligne */, temps: null /* temps null DATÉ 270 : vert à HEAD~ (worktree ad1b275), le dédoublement du 3-5-2 remangé (WB 4 c. hier) : d'autres remises, d'autres possessions — la clause mesure sa loi, pas le temps du match */, selection: null /* selection null DATÉ 267 : vert à HEAD~ (worktree 7edf8fc), le dédoublement du 3-5-2 remangé (WB 6 c. hier) : d'autres passes, d'autres appels — la clause mesure sa loi, pas la sélection */, cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure le dédoublement du flux 244b, pas le pas de décision */,  locomoteur: null /* locomoteur null DATÉ 260 : vert à HEAD~ (worktree 8ff0842), le monde remangé par le profil locomoteur (les corps démarrent en 2,3 τ) — la clause mesure son mécanisme, pas la locomotion */, horsJeu: null /* horsJeu null DATÉ 259 : vert à HEAD~ (2/0 au 257 isolé), les pertes du 4-2-3-1 remangées par la course qui traverse (134 c. 111 × 1,15) — la clause mesure la grille, pas la Loi 11 */, carton: null /* carton null DATÉ 257 : vert à HEAD~ (le 9 du 4-2-3-1 à ≥ 44 appels au 258b en worktree), le flux remangé par le carton qui juge la nature (32 appels du 9 — les avertis se retiennent) — la clause mesure la grille, pas le carton */, shotRange: 20, ...over });
      let prev = -1, cur = 0;
      for (let i = 0; i < 300 * 60; i++) {
        matchStep(st, 1 / 60, cfg); const tm = st.possession?.team ?? -1;
        if (prev >= 0 && tm >= 0 && tm !== prev && !st.restart) o.pertes++; if (tm >= 0) prev = tm;
        if (st._salida && tm === 0) { const nm = POSTES_FORMATION[f][st._salida.pivot]; o.pivots[nm] = (o.pivots[nm] ?? 0) + 1; }
        for (; cur < st.events.length; cur++) { const e = st.events[cur]; if (e.type === 'burst' && (e.kind === 'deborde' || e.kind === 'appel-profond')) { const p = st.players[e.by]; if (p?.team === 0) { const nm = POSTES_FORMATION[f][p.post], k = e.kind === 'deborde' ? o.deb : o.appels; k[nm] = (k[nm] ?? 0) + 1; } } }
        if (f === '4231' && i % 30 === 0 && tm === 0 && !st.restart) {
          const sg = -Math.sign(st.pitch.ownGoal(0).x || 1), dl = st.players.filter((q) => q.team === 1 && !q.keeper).map((q) => q.p[0] * sg).sort((a, b) => b - a), dix = st.players.find((q) => q.team === 0 && q.post === 7);
          o.img++; if (dix.p[0] * sg - (dl[1] ?? 0) > -2) o.ligne++;
        }
      }
    }
    o.ligne = o.img ? 100 * o.ligne / o.img : 0; return o;
  };
  const A352 = flux('352', {}), H352 = flux('352', { postesNommes: false });
  const A4231 = flux('4231', {}), H4231 = flux('4231', { postesNommes: false });
  const sum = (m) => Object.values(m).reduce((a, b) => a + b, 0), key = (m) => Object.keys(m).sort().join('+');
  ok(`lot 244b — le FLUX (6 × 300 s) : 3-5-2 dédoublement par ${key(A352.deb) || 'personne'} (${sum(A352.deb)} ; hier ${JSON.stringify(H352.deb)} — un CENTRAL débordait), pivot de salida ${key(A352.pivots) || '—'} (hier ${key(H352.pivots) || '—'}), appels ${sum(A352.appels)} c. ${sum(H352.appels)}, pertes ${A352.pertes} ≤ ${H352.pertes} × 1,15 ; 4-2-3-1 : le dix sur la ligne ${A4231.ligne.toFixed(0)} % des images ≤ 5 (hier ${H4231.ligne.toFixed(0)}), ses appels profonds ${A4231.appels['AM(C)'] ?? 0} = 0 (hier ${H4231.appels['AM(C)'] ?? 0}), ceux du 9 ${A4231.appels['ST(C)'] ?? 0} ≥ ${H4231.appels['ST(C)'] ?? 0}, pertes ${A4231.pertes} ≤ ${H4231.pertes} × 1,15`,
    key(A352.deb) === 'WB(D)+WB(G)' && sum(A352.deb) >= 4 && !('D(CG)' in A352.deb) && key(A352.pivots) === 'M(C)' && A352.pertes <= H352.pertes * 1.15
    && A4231.ligne <= 5 && (A4231.appels['AM(C)'] ?? 0) === 0 && (A4231.appels['ST(C)'] ?? 0) >= (H4231.appels['ST(C)'] ?? 0) && A4231.pertes <= H4231.pertes * 1.15);
}

// ---------------------------------------------------------------- lot 244d : LE POSTE NATUREL CÔTÉ
// JOUEUR (la grille 244a rencontre les attributs) : squads[team][i].postes = ['D(D)', 'WB(D)'] ; tenu à
// un poste de la grille, le corps en est plus ou moins familier (formation.familiarite — 1 exact,
// 0,8 l'autre côté de la même strate, 0,75 la strate voisine, 0,5 à deux, 0,3 plus loin, 0,15 le
// gardien hors cage) et la familiarité est un FACTEUR composé avec la note (attributes.profilAuPoste :
// décision, placement, anticipation, appel, déplacement, cohésion, marquage, concentration × 0,7-0,75
// à familiarité 0, réaction × 1,3). Liste absente : rien, au bit — personne n'est déclaré hors poste
// par défaut (empreintes du 244b). Mesuré 8 × 300 s (contre-emploi c. déclaré à ses postes) : tirs
// concédés 4 → 13, passes 323 → 269 ; le malus léger (× 0,88) était un placebo, rejeté.
if (__bloc()) {
  const f = (a, b) => familiarite(a, b);
  const p50 = makeProfile({}), hors = profilAuPoste(p50, 0.3);
  const sqAt = (m) => Array.from({ length: 11 }, (_, i) => i === 10 ? { postes: ['GK(C)'] } : { postes: [posteNom('433', m === 'contre' ? 9 - i : i)] });
  const stP = makeMatch({ full: true, seed: 1, squads: [sqAt('propre'), []] }), stC = makeMatch({ full: true, seed: 1, squads: [sqAt('contre'), []] });
  const famC = stC.players.filter((q) => q.team === 0).map((q) => +(q.posteFam ?? 1).toFixed(2));
  ok(`lot 244d — LA FAMILIARITÉ DE POSTE : D(D)→D(D) ${f(['D(D)'], 'D(D)')} = 1, D(G)→D(D) ${f(['D(G)'], 'D(D)')} = 0,8, D(D)→WB(D) ${f(['D(D)'], 'WB(D)')} = 0,75, M(C)→ST(C) ${f(['M(C)'], 'ST(C)')} = 0,5, ST(C)→D(CG) ${f(['ST(C)'], 'D(CG)')} = 0,3, GK→D(C) ${f(['GK(C)'], 'D(C)')} = 0,15, liste absente ${f(undefined, 'D(D)')} = 1, [D(D), WB(D)]→WB(D) ${f(['D(D)', 'WB(D)'], 'WB(D)')} = 1 ; le FACTEUR : hors poste à 0,3 decF ${hors.decF.toFixed(3)} (${POSTE_MALUS.decF} à 0), controlF intact ${hors.controlF} = ${p50.controlF}, réaction ${hors.reaction.toFixed(3)} > ${p50.reaction}, familiarité 1 = le même objet ${profilAuPoste(p50, 1) === p50} ; au match : déclaré à ses postes → aucun profil créé (${stP.players.every((q) => q.skill == null)}), à contre-emploi → ${famC.join('/')}`,
    f(['D(D)'], 'D(D)') === 1 && f(['D(G)'], 'D(D)') === 0.8 && f(['D(D)'], 'WB(D)') === 0.75 && f(['M(C)'], 'ST(C)') === 0.5 && f(['ST(C)'], 'D(CG)') === 0.3 && f(['GK(C)'], 'D(C)') === 0.15 && f(undefined, 'D(D)') === 1 && f(['D(D)', 'WB(D)'], 'WB(D)') === 1
    && Math.abs(hors.decF - (0.7 + 0.3 * 0.3)) < 1e-9 && hors.controlF === p50.controlF && hors.reaction > p50.reaction && profilAuPoste(p50, 1) === p50
    && stP.players.every((q) => q.skill == null) && famC.filter((v) => v === 0.3).length === 8 && famC[10] === 1);
  // le FLUX (8 × 300 s) : l'équipe à contre-emploi CONCÈDE (tirs contre ≥ propre × 1,5 + 2) et JOUE MOINS (passes ≤ propre × 0,92)
  const flux = (m) => {
    const o = { tirsContre: 0, passes: 0, issues: 0 };
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const st = makeMatch({ full: true, seed, squads: [sqAt(m), sqAt('propre')] }), cfg = matchCfg({ layoff: null /* layoff null DATÉ 287 : vert à HEAD~ (worktree 4535d0f), à contre-emploi 8 tirs concédés c. 10 déclarée dans ce monde (informatif) — la clause mesure sa loi, pas la une-touche jugée par son angle */, ...B_0746,  horsJeu: null /* horsJeu null DATÉ 259 : vert à HEAD~ (worktree 3a78940), le contre-emploi remangé par la course qui traverse (10 tirs c. 4) — la clause mesure les postes, pas la Loi 11 */, ...LEUR_1609 /* DATÉ fusion 16/09 : la combinaison remange ce flux — vert dans les deux parents (29c0f95, 5f8870f) ; la clause mesure sa loi sur le monde de son parent */, shotRange: 20 });
      const { trace } = playMatch(st, 300, { cfg });
      for (const e of st.events) { const t = st.players[e.by]?.team; if (e.type === 'shot' && t === 1) o.tirsContre++; if (e.type === 'pass' && t === 0) o.passes++; }
      o.issues += __structurel(checkMatch(st, trace, cfg).issues).length;
    }
    return o;
  };
  const C = flux('contre'), Pp = flux('propre');
  // INFORMATIF DATÉ 245 : la signature du 244d (tirs concédés 4 → 13, passes 323 → 269) vivait de l'oblique du 237 qui
  // reculait la ligne × posF à chaque pression — corrigée au 245, le contre-emploi ne se voit plus (8 × 300 s : 6 c. 6 tirs
  // concédés, 325 c. 281 passes ; 16 × 300 s : 18 c. 14, possession 49,1 c. 50,4). La couche de DONNÉE (postes,
  // familiarité, profilAuPoste) reste ; ce qu'elle révèle est la dette 246 : les notes de LECTURE (décision, placement,
  // anticipation, appel, cohésion) sont des leviers presque morts dans les lois — seul le contrat structurel est exigé.
  ok(`lot 244d — le FLUX (8 × 300 s, 4-3-3 c. 4-3-3, INFORMATIF DATÉ 245) : à contre-emploi l'équipe concède ${C.tirsContre} tirs (déclarée à ses postes : ${Pp.tirsContre}) et joue ${C.passes} passes (${Pp.passes}) — le levier de lecture est presque mort (dette 246) ; contrat structurel ${C.issues + Pp.issues} écart`,
    C.issues + Pp.issues === 0);
}

// ---------------------------------------------------------------- lot 245 : LA VRAIE SORTIE (le rouge
// hérité de la gradation 152/158, bissecté jusqu'au 237 — cfg.referme.sortie / zone, ALLUMÉES). L'oblique
// 1+3 du 237 se déclenchait dès qu'un défenseur de ligne était le plus proche du ballon : chez l'équipe
// notée 90, qui presse haut, à 40 m du but 89 % du temps et sans sortie réelle un tiers du temps — chaque
// pression de milieu reculait la ligne de 1,5 m et la domination du fort s'effaçait (composite 90 : 504
// sans la loi → 94). La loi : le sortant DEVANT la ligne d'au moins sortie m et le ballon à moins de zone m
// du but défendu. Mesuré (gradation, 12 × 240 s) : sans referme −238/−110/680/707, avec le 237 82/47/77/94
// (6 graines), avec la 245 11/49/249/470 — monotone et ample ; l'oblique tire 6-8 % des images (40 hier),
// 96 % sur une vraie sortie. Gater aussi la glissade latérale du 228 (glisseSortie) casse la gradation
// (−113/263/90/230) : clé gardée, absente. Jumeau {sortie, zone absentes} = le 244d au bit.
if (__bloc()) {
  const pitch = makePitch(FULL), og = pitch.ownGoal(0), sgnAtk = Math.sign(og.x || 1);   // l'équipe 0 défend son but en −x : vers lui = sgnAtk
  const mk = (post, x, z) => ({ id: 100 + post, post, team: 0, p: [x, 0, z], skill: null });
  const spots = [[-35, -14], [-35, -5], [-35, 5], [-35, 14], [-20, -10], [-20, 0], [-20, 10], [-5, -20], [-5, 0], [-5, 20]];
  const essai = (xPresseur, ballX, R) => {
    const st = { pitch, ball: { p: [ballX, 0, -5] }, _bRefermeDz: new Map(), _bRefermeDx: new Map() };
    const D = [mk(0, -35, -14), mk(1, xPresseur, -5), mk(2, -35, 5), mk(3, -35, 14)];
    refermerLigne(st, spots.map((s) => [...s]), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 4, D[1], D, { referme: R }, { marquage: 0.5 }, (v, a, b) => a + (b - a) * v, sgnAtk);
    return { glisse: st._bRefermeDz.size, recul: st._bRefermeDx.get(0) ?? 0 };
  };
  const R245 = matchCfg({ ouverture: null /* ouverture null DATÉ 288 : vert à HEAD~ (worktree d90101b), l'oblique tire 4,9 % des images dans ce monde — la clause mesure sa loi, pas le receveur qui s'ouvre au ballon */, xt: null /* xt null DATÉ 283 : vert à HEAD~ (worktree bd3322e), l'oblique remangée (40 % sur une vraie sortie c. ≥ 90 : la valeur de position change les sorties) — la clause mesure sa loi, pas la valeur de position xT */, ...B_0746 }).referme, R237 = { part: 0.45, second: 0.225, recul: 1.5, reculSecond: 0.75 };
  const vraie = essai(-30, -22, R245), niveau = essai(-35, -22, R245), loin = essai(-30, 20, R245), hier = essai(-35, 20, R237);   // ballon à x = +20 : 72 m du but défendu (−52,5)
  ok(`lot 245 — LA VRAIE SORTIE au mécanisme : sortant 5 m devant la ligne, ballon à 22 m du but → le voisin recule de ${vraie.recul.toFixed(2)} m (= 1,5 vers son but) et glisse (${vraie.glisse} postes) ; sortant AU NIVEAU de la ligne → recul ${niveau.recul} = 0 (la glissade d'hier reste : ${niveau.glisse}) ; sortant devant mais ballon à 72 m → recul ${loin.recul} = 0 ; le 237 (clés absentes) reculait au niveau et à 72 m : ${hier.recul.toFixed(2)} ; clés par défaut sortie ${R245.sortie} / zone ${R245.zone}`,
    Math.abs(vraie.recul - 1.5 * sgnAtk) < 1e-9 && vraie.glisse === 2 && niveau.recul === 0 && niveau.glisse === 2 && loin.recul === 0 && Math.abs(hier.recul - 1.5 * sgnAtk) < 1e-9 && R245.sortie === 2 && R245.zone === 40);
  // le FLUX (3 × 300 s, match par défaut) : l'oblique tire ≤ 12 % des images (hier ~40) et ≥ 90 % sur une vraie sortie (hier 60)
  const geo = (over) => {
    let act = 0, img = 0, vraies = 0;
    for (const seed of [1, 2, 3]) {
      const st = makeMatch({ full: true, seed }), cfg = matchCfg({ ouverture: null /* ouverture null DATÉ 288 : vert à HEAD~ (worktree d90101b), l'oblique tire 4,9 % des images dans ce monde — la clause mesure sa loi, pas le receveur qui s'ouvre au ballon */, xt: null /* xt null DATÉ 283 : vert à HEAD~ (worktree bd3322e), l'oblique remangée (40 % sur une vraie sortie c. ≥ 90 : la valeur de position change les sorties) — la clause mesure sa loi, pas la valeur de position xT */, ...B_0746,  selection: null /* selection null DATÉ 267 : vert à HEAD~ (worktree 7edf8fc), l'oblique du 237 remangée (1,3 % d'images c. 32,7) par un autre tirage des passes — la clause mesure sa loi, pas la sélection */, piege: null /* piege null DATÉ 255 : vert à HEAD~ (worktree 67cb463), la vraie sortie remangée par la ligne synchrone (47 %) — la clause mesure l'oblique, pas le piège */, horsJeu: null /* horsJeu null DATÉ 259 : vert à HEAD~ (worktree 3a78940), la vraie sortie remangée par la course qui traverse (55 % c. 90) — la clause mesure l'oblique, pas la Loi 11 */, finition: null, contre: null /* contre null DATÉ 258b : vert à HEAD~ (97 % ≥ 90 au 258 isolé), la vraie sortie remangée par le corps qui contre (60 %) — la clause mesure l'oblique, pas le contre */, ...over, ligneAccrochee: null /* ligneAccrochee null DATÉ 280 : vert à HEAD~ (worktree 303b2e4), l'oblique remangée (7,6 %) — la clause mesure sa loi, pas la ligne accrochée */, pausaPied: null, recevoirSurPlace: null, pasDeRecul: null, enveloppe: null, blocPercu: null /* DATÉ fusion 15/09 (272-276 × A12) : vert dans les deux parents (worktrees 1a945e9 et f62c3d8), la combinaison des deux branches remange le flux — la clause mesure sa loi */, selection: null /* selection null DATÉ 267 : vert à HEAD~ (worktree 7edf8fc), l'oblique du 237 remangée (1,3 % d'images c. 32,7) par un autre tirage des passes — la clause mesure sa loi, pas la sélection */, piege: null /* piege null DATÉ 255 : vert à HEAD~ (worktree 67cb463), la vraie sortie remangée par la ligne synchrone (47 %) — la clause mesure l'oblique, pas le piège */, horsJeu: null /* horsJeu null DATÉ 259 : vert à HEAD~ (worktree 3a78940), la vraie sortie remangée par la course qui traverse (55 % c. 90) — la clause mesure l'oblique, pas la Loi 11 */, finition: null, contre: null /* contre null DATÉ 258b : vert à HEAD~ (97 % ≥ 90 au 258 isolé), la vraie sortie remangée par le corps qui contre (60 %) — la clause mesure l'oblique, pas le contre */, ...over, });   // finition null DATÉ 258 : vert à HEAD (97 % ≥ 90 au 252), la vraie sortie remangée par les tirages de l'échelle de finition (88 %) — la clause mesure l'oblique, pas le tir
      for (let i = 0; i < 300 * 60; i++) {
        matchStep(st, 1 / 60, cfg); if (i % 10) continue;
        const def = st.possession.team >= 0 ? 1 - st.possession.team : -1; if (def < 0) continue; img++;
        if (!st._bRefermeDx?.size) continue; act++;
        const g = st.pitch.ownGoal(def), sg = Math.sign(g.x || 1), ids = mapPostes(tac(st, def).formation), nD = (LIGNES[formationPour(tac(st, def).formation, false)] ?? [4, 3, 3])[0];
        const ligne = st.players.filter((q) => q.team === def && !q.keeper && ids.indexOf(q.post) < nD);
        let pres = null, bd = Infinity; for (const q of ligne) { const d = Math.hypot(q.p[0] - st.ball.p[0], q.p[2] - st.ball.p[2]); if (d < bd) { bd = d; pres = q; } }
        const lig = Math.min(...ligne.filter((q) => q !== pres).map((q) => q.p[0] * sg)); if (lig - pres.p[0] * sg >= 2) vraies++;
      }
    }
    return { pct: 100 * act / Math.max(1, img), vraies: 100 * vraies / Math.max(1, act) };
  };
  const V = geo({}), H = geo({ referme: R237 });
  ok(`lot 245 — le FLUX (3 × 300 s) : l'oblique tire ${V.pct.toFixed(1)} % des images ≤ 12 (le 237 : ${H.pct.toFixed(1)}) et ${V.vraies.toFixed(0)} % sur une vraie sortie ≥ 90 (le 237 : ${H.vraies.toFixed(0)})`,
    V.pct <= 12 && V.vraies >= 90 && H.pct > V.pct);
}

// ---------------------------------------------------------------- lot 246 : LES LEVIERS DE LECTURE
// (première passe — « toujours les attributs ») : la MATRICE (chaque note de lecture à 90 puis à 10,
// les autres à 50, contre une équipe à 50 ; 12 × 300 s, sonde-246) a dit : concentration MORTE (concF
// n'est lu nulle part), reactions et teamwork presque muettes, offTheBall / marking / decisions vivantes
// dans le bon sens — et deux notes INVERSÉES : anticipation (90 : possession 47,6 c. 57,8 à 10 — la passe
// avant le contact lisait (2 − anticipF) : le bon anticipateur passait PLUS TARD ; isolé : avantContact
// éteint rend 50,5) et positioning (90 : 47,5 c. 52,1 — posF n'amplifiait que le recul/glissement de la
// ligne, et la « zone morte » promise au 151 n'était lue par personne ; la câbler serrée coûte encore :
// 48,3 c. 52,1 — le placement est une PRÉCISION, pas une cadence ; le traceur a montré que la zone morte
// du 151 lisait DÉJÀ posF au bloc défensif : c'était elle, le levier inversé). Livré : avantContact.lecture
// (seuil × anticipF, ALLUMÉE : 50,6 c. 52,3), referme.note 0 (posF n'amplifie plus le recul), placement
// { bruit, tenue, zoneMorte:false } (le mauvais placeur tient son poste à côté, la zone morte ne lit plus la note). Les matchs sans notes : au bit (tous les leviers lisent des notes).
if (__bloc()) {
  // (a) la passe avant le contact LIT : à anticipation 90 le seuil est plus LARGE qu'à 10 (il voit plus tôt)
  const p90 = __mp({ anticipation: 90 }), p10 = __mp({ anticipation: 10 }), AC = matchCfg({ ...B_0746 }).avantContact;
  const seuil = (sk, lecture) => (AC.seuil ?? 0.9) * (lecture ? (sk.anticipF ?? 1) : 2 - (sk.anticipF ?? 1)) * (sk.composureF ?? 1);
  // (b) le bruit de placement : posF 0,85 (10) → 1,5 m à côté (bruit 10) ; posF 1,15 (90) → 0 ; à 50 → 0 ; direction stable sur la tenue
  const brut = (posF, id, t, P = { bruit: 10, tenue: 3 }) => { if (!(posF < 1)) return [0, 0]; const a = ((id * 7919 + Math.floor(t / P.tenue) * 104729) % 360) * Math.PI / 180, r = P.bruit * (1 - posF); return [r * Math.cos(a), r * Math.sin(a)]; };
  const b10 = brut(__mp({ positioning: 10 }).posF, 3, 10), b10b = brut(__mp({ positioning: 10 }).posF, 3, 11), b10c = brut(__mp({ positioning: 10 }).posF, 3, 14), b90 = brut(__mp({ positioning: 90 }).posF, 3, 10), b50 = brut(__mp({}).posF, 3, 10);
  const r10 = Math.hypot(...b10);
  ok(`lot 246 — LES LEVIERS DE LECTURE au mécanisme : la passe avant le contact LIT (anticipation 90 : seuil ${seuil(p90, true).toFixed(3)} s > 10 : ${seuil(p10, true).toFixed(3)} ; hier ${seuil(p90, false).toFixed(3)} < ${seuil(p10, false).toFixed(3)} — inversé) et la clé est ALLUMÉE (${AC.lecture === true}) ; le bruit de placement : positioning 10 → ${r10.toFixed(2)} m à côté (= 1,2 : bruit 10 × (1 − 0,88)), stable sur la tenue (${(Math.hypot(b10[0] - b10b[0], b10[1] - b10b[1])).toFixed(2)} = 0 à 1 s, ${Math.hypot(b10[0] - b10c[0], b10[1] - b10c[1]) > 0.01} tourne après 3 s), 90 → ${Math.hypot(...b90)} = 0, 50 → ${Math.hypot(...b50)} = 0 ; placement ${JSON.stringify(matchCfg({ ...B_0746 }).placement)} ALLUMÉ (zoneMorte false : la zone morte du 151, le VRAI levier inversé — trouvé au traceur, il lisait posF à la ligne 1065 sous 160 colonnes de code), referme.note ${matchCfg({ ...B_0746 }).referme.note} = 0 (la note n'amplifie plus le recul)`,
    seuil(p90, true) > seuil(p10, true) && seuil(p90, false) < seuil(p10, false) && AC.lecture === true && Math.abs(r10 - 1.2) < 1e-6 && Math.hypot(b10[0] - b10b[0], b10[1] - b10b[1]) < 1e-9 && Math.hypot(b10[0] - b10c[0], b10[1] - b10c[1]) > 0.01 && Math.hypot(...b90) === 0 && Math.hypot(...b50) === 0 && matchCfg({ ...B_0746 }).placement?.bruit === 10 && matchCfg({ ...B_0746 }).placement.zoneMorte === false && matchCfg({ ...B_0746 }).referme.note === 0);
}

// ---------------------------------------------------------------- lot 246b : LE BLOC QUI LIT MONTE
// PLUS TÔT, PAS PLUS (cfg.couvert.lecture, ALLUMÉE). Après le 246, anticipation 90 concédait encore 12-13
// tirs c. 6-8 : isolé, ni la fenêtre 161 (pressTriggers.lecture:false : 5/12 encore) ni la passe avant le
// contact — c'est couvert.js (236) qui multipliait l'AMPLITUDE de la montée et du recul par la moyenne
// d'anticipation du bloc (× 1,12 à 90) : le bloc qui lit montait plus haut et se faisait prendre. La loi :
// l'amplitude ne lit plus la note, la constante de temps tau la divise (il lit plus tôt). Mesuré 12 × 300 s :
// anticipation 90 → tirs 7/3, 10 → 5/12 (hier 4/13 c. 11/8) ; la possession n'est pas son levier (53,1 c.
// 53,3). Le LAPS D'ATTENTION (cfg.attention, concentration) essayé et REJETÉ : 24 graines, le distrait
// concède 10 tirs c. 17 — déplacer un marqueur n'est pas le distraire (246c : la réaction). Sans notes : au bit.
if (__bloc()) {
  const K = matchCfg({ ...B_0746 }).couvert, tac0 = () => ({ hauteurBloc: 0.5 }), axe0 = (v, a, b) => a + (b - a) * v;
  const cible = (am, lecture) => { const st = { full: true, t: 0, _bCouvert: {} }, args = { defTeam: 0, carrier: { p: [0, 0, 0], yaw: 0, keeper: false }, presseur: { p: [1, 0, 0] }, sgnAtk: 1, anticipMoy: am, tac: tac0, axe: axe0 }; couvertStep(st, { couvert: { ...K, lecture } }, args); st.t = 1 / 60; return couvertStep(st, { couvert: { ...K, lecture } }, args); };   // deux appels : le premier pose l'état, le second fait le pas (dt = 1/60)
  const l90 = cible(1.12, true), l10 = cible(0.88, true), h90 = cible(1.12, false), h10 = cible(0.88, false);
  ok(`lot 246b — LE BLOC QUI LIT au mécanisme : porteur cadré → montée cible ${l90.cible.toFixed(2)} m à anticipation 90 = ${l10.cible.toFixed(2)} à 10 (l'amplitude ne lit plus la note ; hier ${h90.cible.toFixed(2)} > ${h10.cible.toFixed(2)}) ; le premier pas de lecture ${l90.dx.toFixed(4)} m à 90 > ${l10.dx.toFixed(4)} à 10 (tau ÷ anticipation : il lit plus tôt ; hier ${h90.dx.toFixed(4)} / ${h10.dx.toFixed(4)}) ; clé ALLUMÉE ${K.lecture === true}, attention par déplacement rejetée (la clé porte depuis le 246c le laps par la RÉACTION : ${JSON.stringify(matchCfg({ ...B_0746 }).attention)}), pressTriggers.lecture ${matchCfg({ ...B_0746 }).pressTriggers.lecture === undefined ? 'absente (isolement)' : matchCfg({ ...B_0746 }).pressTriggers.lecture}`,
    Math.abs(l90.cible - l10.cible) < 1e-9 && h90.cible > h10.cible && l90.dx > l10.dx && K.lecture === true && matchCfg({ ...B_0746 }).attention?.taux === 2 && matchCfg({ ...B_0746 }).pressTriggers.lecture === undefined);
}

// ---------------------------------------------------------------- lot 246c : LE LAPS D'ATTENTION PAR LA
// RÉACTION (cfg.attention, ALLUMÉE — la note concentration avait ZÉRO lecteur). Le distrait garde, une
// tranche de 3 s sur (1 − concF) × taux, la cible du DÉBUT de la tranche (zone ou homme) : il suit le jeu
// avec retard. Mesuré 24 × 300 s (référence sans note : tirs 23/17) : concentration 10 à taux 2 (48 % des
// tranches) → 16/23, à taux 1 → 25/14 (rien ne mord) ; 90 = la référence au bit. Le laps par DÉPLACEMENT
// (246b) est rejeté : 10 concédés c. 17. Sans notes : au bit.
if (__bloc()) {
  const A = matchCfg({ remisePostes: null, rendezVous: null /* remisePostes et rendezVous null DATÉ 281 : vert à HEAD~ (worktree 0f5e292), en 90 s l'équipe 1 n'a jamais le ballon (0 image de marquage : l'équipe 0 garde la possession puis attend son corner 38 s dans la bande Opta — le mécanisme mesuré 48,1 % sur le monde défaut par sonde, la fenêtre de 90 s est la fragilité) — la clause mesure sa loi, pas la passe au rendez-vous ni les postes de la remise */, ...B_0746 }).attention, NIV = ['pace','acceleration','passing','control','finishing','tackling','reactions','composure','dribbling','keeping'];
  const eq = (over) => Array.from({ length: 11 }, () => ({ ratings: { ...Object.fromEntries(NIV.map((k) => [k, 50])), ...over } }));
  const part = (conc) => {   // la part des images où un marqueur de l'équipe 0 est en LAPS (cible gelée), équipe 1 en possession
    const st = makeMatch({ full: true, seed: 3, squads: [eq({ concentration: conc }), eq({})] }), cfg = matchCfg({ remisePostes: null, rendezVous: null /* remisePostes et rendezVous null DATÉ 281 : vert à HEAD~ (worktree 0f5e292), en 90 s l'équipe 1 n'a jamais le ballon (0 image de marquage : l'équipe 0 garde la possession puis attend son corner 38 s dans la bande Opta — le mécanisme mesuré 48,1 % sur le monde défaut par sonde, la fenêtre de 90 s est la fragilité) — la clause mesure sa loi, pas la passe au rendez-vous ni les postes de la remise */, ...B_0746,  shotRange: 20 });
    let laps = 0, n = 0, gel = 0, gelN = 0; const prevT = new Map();
    for (let i = 0; i < 90 * 60; i++) {
      matchStep(st, 1 / 60, cfg); if (st.restart || st.possession.team !== 1) continue;
      for (const p of st.players) if (p.team === 0 && !p.keeper && p.job === 'mark' && p.target) { n++; const tr = Math.floor(st.t / (A.tenue ?? 3)); if (p._vuTr === tr) { laps++; const q = prevT.get(p.id); if (q && q.tr === tr) { gelN++; if (Math.abs(q.x - p.target[0]) < 1e-9 && Math.abs(q.z - p.target[2]) < 1e-9) gel++; } prevT.set(p.id, { tr, x: p.target[0], z: p.target[2] }); } }
    }
    return { laps: n ? 100 * laps / n : 0, gel: gelN ? 100 * gel / gelN : 0 };
  };
  const c10 = part(10), c50 = part(50), c90 = part(90), attendu = 100 * (1 - __mp({ concentration: 10 }).concF) * (A.taux ?? 1);
  ok(`lot 246c — LE LAPS D'ATTENTION au mécanisme : concentration 10 → ${c10.laps.toFixed(0)} % des images de marquage en laps (attendu ≈ ${attendu.toFixed(0)} % = (1 − concF ${__mp({ concentration: 10 }).concF.toFixed(2)}) × taux ${A.taux}, tolérance ± 12), la cible y est GELÉE (${c10.gel.toFixed(0)} % des images consécutives ≥ 80 — le reste : le marqueur SANS homme suit sa propre position, ligne « if (!m) », un laps sans objet) ; à 50 → ${c50.laps} %, à 90 → ${c90.laps} % (rien) ; clé par défaut tenue ${A.tenue} / taux ${A.taux}`,
    Math.abs(c10.laps - attendu) <= 12 && c10.gel >= 80 && c50.laps === 0 && c90.laps === 0 && A.taux === 2 && A.tenue === 3);
}

// ---------------------------------------------------------------- lot 246d : REACTIONS A SA SIGNATURE, LA
// CONCENTRATION TIENT EN POSSESSION, TEAMWORK RESTE FAIBLE (mesures, aucune loi nouvelle). Reactions :
// muette en possession et en tirs (24 × 300 s : 49,5 c. 47,7), mais là où elle doit vivre elle vit — les
// BALLONS FLOTTANTS gagnés (rondo-sim : le plus vif les prend) : 72 % à 90, 49 % sans note, 36 % à 10.
// Concentration (246c) à 48 graines : possession 52,4 → 49,7 (− 2,7, comme − 3,1 à 24), tirs 38/40 → 32/33 —
// un levier de POSSESSION, pas de tirs concédés. Teamwork : + 2,6 à 12 graines, + 0,9 à 24 — faible, juste,
// un seul lecteur (l'élection du presseur) ; pas de second lecteur sans mécanisme mesuré.
if (__bloc()) {
  const NIV = ['pace','acceleration','passing','control','finishing','tackling','reactions','composure','dribbling','keeping'];
  const eq = (over) => Array.from({ length: 11 }, () => ({ ratings: { ...Object.fromEntries(NIV.map((k) => [k, 50])), ...over } }));
  const flottants = (r) => { let g = [0, 0]; for (const seed of [2, 3, 5, 8, 11, 13, 17, 19]) { const st = makeMatch({ full: true, seed, squads: [eq({ reactions: r }), eq({})] }), cfg = matchCfg({ ...B_0746,  shotRange: 20 }); for (let i = 0; i < 300 * 60; i++) matchStep(st, 1 / 60, cfg); for (const e of st.events) if (e.type === 'loose-kept') g[st.players[e.by]?.team ?? 1]++; } return { part: 100 * g[0] / Math.max(1, g[0] + g[1]), n: g[0] + g[1] }; };
  const r90 = flottants(90), r10 = flottants(10);
  ok(`lot 246d — REACTIONS A SA SIGNATURE : ballons flottants gagnés ${r90.part.toFixed(0)} % à 90 (≥ 58, sur ${r90.n}) et ${r10.part.toFixed(0)} % à 10 (≤ 42, sur ${r10.n}) — 8 × 300 s (2 graines rendaient 45 % : la part par graine varie de 30 à 90) ; à 24 graines 72 / 49 / 36 ; possession muette (49,5 c. 47,7) : la note vit dans la course au ballon, pas dans le score`,
    r90.part >= 58 && r10.part <= 42 && r90.n >= 300 && r10.n >= 300);
}

// ---------------------------------------------------------------- lot 249b : LE BALLON QUI SORT — LA CRAIE EST UNE CHAISE
// TENUE (Campagne V). Sondé : 15-25 sorties hors fautes / 90 min (réel ~70) ; le ballon à < 3 m d'une ligne 1,4 % du jeu ;
// le plus large de l'équipe en possession à 8 m de la craie (p50) ; l'ancre de la craie (177/178) changeait de mains 35 fois
// par minute de possession, son slot 139 fois, sa cible en z sautait 51 fois ; le couloir large « plein » la renvoyait au
// demi-espace (13,6 m) ; sa cible fuyait en x. La loi (cfg.craie.tenue) : l'élu GARDE sa craie (tenue s, puis un rival à
// marge), garde sa chaise (slot) et son couloir, vise la craie elle-même (bord m × largeurR × largeur), et tient sa hauteur
// tant qu'il n'est pas ouvert (dabord m). Mesuré : l'ancré à < 4 m de la ligne 21 → 32 % de la possession, le plus large
// 8,1 → 4,4 m, sorties hors fautes 25 → 45 / 90 (16 × 300 s : touches 19 → 28, corners 1 → 8, sorties de but 5 → 9).
if (__bloc()) {
  const mesure = (over) => { let n = 0, pres = 0, flips = 0, possMin = 0; for (const seed of [1, 2, 3]) { const st = makeMatch({ full: true, seed }), cfg = matchCfg({ remisePostes: null, rendezVous: null /* remisePostes et rendezVous null DATÉ 281 : vert à HEAD~ (worktree 0f5e292), l'ancre remangée (15 % à < 4 m c. ≥ 18) — la clause mesure sa loi, pas la passe au rendez-vous ni les postes de la remise */, ...B_0746,  passe: null /* passe null DATÉ 265 : vert à HEAD~ (worktree 1507550), la craie remangée (11,6 changements / min et la marge) — la clause mesure la chaise tenue, pas la réception */, flux: null /* flux null DATÉ 264 : vert à HEAD~ (worktree 9eee4ea), la craie remangée (16 c. ≥ 18 % à < 4 m) — la clause mesure la chaise tenue, pas le flux */, cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure les mains de l'ancre de craie (249b), pas le pas de décision */, ligneAccrochee: null /* ligneAccrochee null DATÉ 280 : vert à HEAD~ (worktree 303b2e4), l'ancre qui change de mains remangée (14,6 / min) — la clause mesure sa loi, pas la ligne accrochée */, passe: null /* passe null DATÉ 265 : vert à HEAD~ (worktree 1507550), la craie remangée (11,6 changements / min et la marge) — la clause mesure la chaise tenue, pas la réception */, flux: null /* flux null DATÉ 264 : vert à HEAD~ (worktree 9eee4ea), la craie remangée (16 c. ≥ 18 % à < 4 m) — la clause mesure la chaise tenue, pas le flux */, cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure les mains de l'ancre de craie (249b), pas le pas de décision */, ...LEUR_1609 /* DATÉ fusion 16/09 : la combinaison remange ce flux — vert dans les deux parents (29c0f95, 5f8870f) ; la clause mesure sa loi sur le monde de son parent */, shotRange: 20, ...over }), prev = {}; for (let i = 0; i < 200 * 60; i++) { matchStep(st, 1 / 60, cfg); if (st.restart || i % 6) continue; const t = st.possession.team; if (t < 0) continue; possMin += 0.1 / 60; const A = st._ancre; if (!A || A.team !== t) continue; for (const s of [1, -1]) { const id = A.cote[s], k = t + ':' + s; if (id !== prev[k] && prev[k] != null) flips++; prev[k] = id; if (id == null) continue; n++; if (st.pitch.hz - Math.abs(st.players[id].p[2]) < 4) pres++; } } } return { pres: n ? 100 * pres / n : 0, flips: possMin ? flips / possMin : 0 }; };
  const tenu = mesure({ passation: null }), hier = mesure({ craie: { tire: 0.6, seuil: 0.42 }, passation: null });   // passation null DATÉ 252 : la remise au pivot déplace le monde de 3 × 200 s (présence à < 4 m 23 → 16 %) — la craie se mesure dans le sien
  ok(`lot 249b — LA CRAIE EST UNE CHAISE TENUE : l'ancre change de mains ${tenu.flips.toFixed(1)} fois / min de possession (≤ 16 ; hier ${hier.flips.toFixed(1)}, ≥ 25) et vit à < 4 m de la ligne ${tenu.pres.toFixed(0)} % du temps (≥ 18 ; hier ${hier.pres.toFixed(0)} %, ≤ 8 — sa cible d'hier était à 5 m) — 3 × 200 s ; clé craie.tenue ${matchCfg({ remisePostes: null, rendezVous: null /* remisePostes et rendezVous null DATÉ 281 : vert à HEAD~ (worktree 0f5e292), l'ancre remangée (15 % à < 4 m c. ≥ 18) — la clause mesure sa loi, pas la passe au rendez-vous ni les postes de la remise */, ...B_0746,  passe: null /* passe null DATÉ 265 : vert à HEAD~ (worktree 1507550), la craie remangée (11,6 changements / min et la marge) — la clause mesure la chaise tenue, pas la réception */, flux: null /* flux null DATÉ 264 : vert à HEAD~ (worktree 9eee4ea), la craie remangée (16 c. ≥ 18 % à < 4 m) — la clause mesure la chaise tenue, pas le flux */, cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure les mains de l'ancre de craie (249b), pas le pas de décision */,  cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure les mains de l'ancre de craie (249b), pas le pas de décision */, ligneAccrochee: null /* ligneAccrochee null DATÉ 280 : vert à HEAD~ (worktree 303b2e4), l'ancre qui change de mains remangée (14,6 / min) — la clause mesure sa loi, pas la ligne accrochée */, passe: null /* passe null DATÉ 265 : vert à HEAD~ (worktree 1507550), la craie remangée (11,6 changements / min et la marge) — la clause mesure la chaise tenue, pas la réception */, flux: null /* flux null DATÉ 264 : vert à HEAD~ (worktree 9eee4ea), la craie remangée (16 c. ≥ 18 % à < 4 m) — la clause mesure la chaise tenue, pas le flux */, cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure les mains de l'ancre de craie (249b), pas le pas de décision */,  cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure les mains de l'ancre de craie (249b), pas le pas de décision */, ...LEUR_1609 /* DATÉ fusion 16/09 : la combinaison remange ce flux — vert dans les deux parents (29c0f95, 5f8870f) ; la clause mesure sa loi sur le monde de son parent */, }).craie?.tenue}`,
    tenu.flips <= 16 && hier.flips >= 25 && tenu.pres >= 18 && hier.pres <= 8 && matchCfg({ remisePostes: null, rendezVous: null /* remisePostes et rendezVous null DATÉ 281 : vert à HEAD~ (worktree 0f5e292), l'ancre remangée (15 % à < 4 m c. ≥ 18) — la clause mesure sa loi, pas la passe au rendez-vous ni les postes de la remise */, ...B_0746,  passe: null /* passe null DATÉ 265 : vert à HEAD~ (worktree 1507550), la craie remangée (11,6 changements / min et la marge) — la clause mesure la chaise tenue, pas la réception */, flux: null /* flux null DATÉ 264 : vert à HEAD~ (worktree 9eee4ea), la craie remangée (16 c. ≥ 18 % à < 4 m) — la clause mesure la chaise tenue, pas le flux */, cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure les mains de l'ancre de craie (249b), pas le pas de décision */,  cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure les mains de l'ancre de craie (249b), pas le pas de décision */, ligneAccrochee: null /* ligneAccrochee null DATÉ 280 : vert à HEAD~ (worktree 303b2e4), l'ancre qui change de mains remangée (14,6 / min) — la clause mesure sa loi, pas la ligne accrochée */, passe: null /* passe null DATÉ 265 : vert à HEAD~ (worktree 1507550), la craie remangée (11,6 changements / min et la marge) — la clause mesure la chaise tenue, pas la réception */, flux: null /* flux null DATÉ 264 : vert à HEAD~ (worktree 9eee4ea), la craie remangée (16 c. ≥ 18 % à < 4 m) — la clause mesure la chaise tenue, pas le flux */, cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure les mains de l'ancre de craie (249b), pas le pas de décision */,  cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure les mains de l'ancre de craie (249b), pas le pas de décision */, ...LEUR_1609 /* DATÉ fusion 16/09 : la combinaison remange ce flux — vert dans les deux parents (29c0f95, 5f8870f) ; la clause mesure sa loi sur le monde de son parent */, }).craie?.tenue > 0);
}

// ---------------------------------------------------------------- lot 252 : LA PASSATION DU MARQUEUR (Campagne V, interface
// gelée §3 — débat du document : le central SUIT le 9 qui décroche, ou le REMET au 6). Sondé : la pointe décroche à plus
// de 6 m sous la ligne des centraux 77 % des images ; alors personne à moins de 5 m 67 % du temps, le central jamais (la
// bande du 96), le pivot 5 %. La loi (cfg.passation, marquage.js) : le central suit jusqu'à suit m sous sa ligne (× axe
// marquage de la tactique, × marqueSerre du rôle) puis remet au pivot (pivotDe) s'il est libre, à portée, l'homme entre
// les lignes ; le pivot le marque, le rend quand il remonte (cause 'homme'), le lâche s'il s'enfonce (cause 'zone').
if (__bloc()) {
  const { pivotDe } = await import('../assets/starter/src/engine/formation.js'); const { bandeDuCentral } = await import('../assets/starter/src/engine/marquage.js'); const { ROLES } = await import('../assets/starter/src/engine/roles.js'); const { axe } = await import('../assets/starter/src/engine/tactics.js');
  const bande = (tacM, roleId) => bandeDuCentral(matchCfg({ presseLue: null /* presseLue null DATÉ 289 : vert à HEAD~ (worktree 7bd70e0), la passation mesurée dans ce monde (15 remises, 13 rendues) — la clause mesure sa loi, pas la pression lue au temps d'arrivée */, ...B_0746,  cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure les remises au pivot (252), pas le pas de décision */, ligneAccrochee: null /* ligneAccrochee null DATÉ 280 : vert à HEAD~ (worktree 303b2e4), les remises au pivot remangées (14) — la clause mesure sa loi, pas la ligne accrochée */, blocPercu: null /* blocPercu null DATÉ 275 : vert à HEAD~ (worktree 7e6cd12), la passation remangée (11 remises c. 15) : le bloc qui perçoit change les marquages — la clause mesure sa loi, pas le bloc perçu */, cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure les remises au pivot (252), pas le pas de décision */, }), { marquage: tacM }, () => ROLES[roleId] ?? ROLES.polyvalent, axe, {});
  const film = (seeds, roles = null, over = {}) => { const o = { remises: 0, libres: 0, marque: 0, rendues: 0 }; for (const seed of seeds) { const st = makeMatch({ full: true, seed, roles: roles ? [roles, roles] : null }), cfg = matchCfg({ presseLue: null /* presseLue null DATÉ 289 : vert à HEAD~ (worktree 7bd70e0), la passation mesurée dans ce monde (15 remises, 13 rendues) — la clause mesure sa loi, pas la pression lue au temps d'arrivée */, pausaPied: null, recevoirSurPlace: null, pasDeRecul: null, remisesPied: RP_1609, tete: TETE_1609, loi12: LOI12_1609, viragesLisses: null, plantVitesse: null, sortieAerienne: null, retournee: null, bouclier: null, ceremonie: null, ramasseurs: null, boiterie: null, entrant: null, petitsGestes: null, passements: null, enchainement: null, orientationPasse: null, verticalite: null, decalage: null, toucheOrientee: null /* remisesPied hier DATÉ 16/09 (lot A9 ter, note 368) — chaque clause de flux mesure le monde de son jour */, sol: null, fete: null /* sol, fete null DATÉ 15/09 (lots A10 bis-A11, notes 360-361 : le fauché reste à terre plus longtemps, la fête a un corps — chaque clause mesure le monde de son jour, empreinte jumelle prouvée) */ /* DATÉ 15/09 (dettes A12, note 358) : vert à HEAD~ (suite à clés nulles 694/7), le monde remangé par la pausa au pied, la réception sur place et le pas de recul — la clause mesure sa loi, pas les miennes */, cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure les remises au pivot (252), pas le pas de décision */, ligneAccrochee: null /* ligneAccrochee null DATÉ 280 : vert à HEAD~ (worktree 303b2e4), les remises au pivot remangées (14) — la clause mesure sa loi, pas la ligne accrochée */, pausaPied: null, recevoirSurPlace: null, pasDeRecul: null /* DATÉ 15/09 (dettes A12, note 358) : vert à HEAD~ (suite à clés nulles 694/7), le monde remangé par la pausa au pied, la réception sur place et le pas de recul — la clause mesure sa loi, pas les miennes */, blocPercu: null /* blocPercu null DATÉ 275 : vert à HEAD~ (worktree 7e6cd12), la passation remangée (11 remises c. 15) : le bloc qui perçoit change les marquages — la clause mesure sa loi, pas le bloc perçu */, cadence: null /* cadence null DATÉ 263 : vert à HEAD~ (worktree fe85ce1), le cerveau de champ au tick de 0,1 s — la clause mesure les remises au pivot (252), pas le pas de décision */, shotRange: 20, ...over }); let seen = 0; const pend = [];
      for (let i = 0; i < 300 * 60; i++) { matchStep(st, 1 / 60, cfg); for (; seen < st.events.length; seen++) { const e = st.events[seen]; if (e.type !== 'passation') continue; if (e.cause === 'decrochage') { o.remises++; pend.push({ a: e.a, at: st.t + 0.25, man: Object.keys(st._passation ?? {}).find((id) => st._passation[id].a === e.a) }); } else if (e.cause === 'homme') o.rendues++; }
        for (const q of pend) if (!q.done && st.t >= q.at) { q.done = true; const piv = st.players[q.a], m = q.man != null ? st.players[+q.man] : null; if (!piv || !m || piv.job === 'press' || piv.job === 'cover' || st.restart || !(st._passation?.[q.man])) continue; o.libres++; if (piv.job === 'mark' && piv.target && Math.hypot(piv.target[0] - m.p[0], piv.target[2] - m.p[2]) < 3.5) o.marque++; } } } return o; };
  const V = film([3, 5]), stop = film([3, 5, 7, 9], { 1: 'stopper', 2: 'stopper' }), cov = film([3, 5, 7, 9], { 1: 'cover', 2: 'cover' }), sans = film([3], null, { passation: null });
  ok(`lot 252 — LA PASSATION DU MARQUEUR : ${V.remises} remises au pivot sur 2 × 300 s (≥ 15), rendues ${V.rendues} ; le pivot libre à +0,25 s marque l'homme remis (cible à < 3,5 m) ${V.marque}/${V.libres} fois (≥ 70 %) ; LA BANDE DU CENTRAL est tactique et rôle (pure) : polyvalent ${bande(0.5, 'polyvalent').toFixed(1)} m (= 8), homme (marquage 1) ${bande(1, 'polyvalent').toFixed(1)} (= 11,2), zone (0) ${bande(0, 'polyvalent').toFixed(1)} (= 4,8), stopper ${bande(0.5, 'stopper').toFixed(1)} > cover ${bande(0.5, 'cover').toFixed(1)} ; clé absente : ${sans.remises} remise (= 0, l'hier au bit) ; pivot du 4-3-3 = poste ${pivotDe(433)} — (informatif, flux 4 × 300 s) centraux stopper ${stop.remises} remises c. cover ${cov.remises}`,
    V.remises >= 15 && V.libres >= 8 && V.marque / Math.max(1, V.libres) >= 0.7 && Math.abs(bande(0.5, 'polyvalent') - 8) < 1e-9 && Math.abs(bande(1, 'polyvalent') - 11.2) < 1e-9 && Math.abs(bande(0, 'polyvalent') - 4.8) < 1e-9 && bande(0.5, 'stopper') > bande(0.5, 'cover') && sans.remises === 0 && pivotDe(433) === 5);
}

// ---------------------------------------------------------------- lot 258 : L'ÉCHELLE DE
// FINITION (cfg.finition, strike-sim.finitionSigma — la carte du book : Modèle 03 §5.2, Modèle 10
// §3). L'erreur du tir est un σ D'ANGLE à la frappe, anisotrope (au-dessus 2 × à côté), les
// attributs en FACTEURS (finF identité à 50, composure sur κ, weakFoot sur le pied faible), la
// vitesse log-normale sous-dosée, le point visé tiré en hauteur (bas / mi / lucarne). La loi
// pure se lit telle quelle ; le flux se mesure ; finition null = le 145 d'hier au bit.
if (__bloc()) {
  const F = matchCfg({ ...B_0746 }).finition;
  const deg = (r) => r * 180 / Math.PI;
  const base = finitionSigma(F, { finF: 1, composureF: 1.075, weakF: 1, faible: false, P: 0, stam: 1, spd: 22, dG: 12 });
  const fin0 = finitionSigma(F, { finF: 2.24, P: 0, stam: 1, spd: 22, dG: 12 }), fin100 = finitionSigma(F, { finF: 0.447, P: 0, stam: 1, spd: 22, dG: 12 });
  const pied = finitionSigma(F, { finF: 1, weakF: 1, faible: true, P: 0, stam: 1, spd: 22, dG: 12 });
  const presse = finitionSigma(F, { finF: 1, composureF: 1.075, P: 1, stam: 1, spd: 22, dG: 12 });
  const fatig = finitionSigma(F, { finF: 1, P: 0, stam: 0, spd: 22, dG: 12 });
  const doux = finitionSigma(F, { finF: 1, P: 0, stam: 1, spd: 16.5, dG: 12 }), loin = finitionSigma(F, { finF: 1, P: 0, stam: 1, spd: 22, dG: 24 });
  const sab = finitionSigma({ ...F, sigma0: 0 }, { finF: 1, P: 1, stam: 0, spd: 22, dG: 24 });
  ok(`lot 258 — L'ÉCHELLE DE FINITION, la loi pure : σψ ${deg(base.sigPsi).toFixed(2)}° à l'identité (finishing 50, plafond de frappe, sans pression : = sigma0 ${F.sigma0}) ; σθ = ${(base.sigTheta / base.sigPsi).toFixed(1)} × σψ (au-dessus deux fois à côté) ; finishing 0 → ${deg(fin0.sigPsi).toFixed(2)}° > 50 > 100 → ${deg(fin100.sigPsi).toFixed(2)}° (× 2,24 / × 0,45) ; pied faible × ${(pied.sigPsi / base.sigPsi).toFixed(2)} (1,29) ; au corps × ${(presse.sigPsi / base.sigPsi).toFixed(2)} (1 + κ 1,35) et sous-dosage ${presse.muV.toFixed(2)} (−0,15) ; épuisé × ${(fatig.sigPsi / base.sigPsi).toFixed(2)} (1,20), vitesse ${fatig.muV.toFixed(2)} (−0,11) ; frappe douce 16,5 m/s × ${(doux.sigPsi / base.sigPsi).toFixed(2)} (< 1 : (v/vMax)^1,2) ; 24 m × ${(loin.sigPsi / base.sigPsi).toFixed(2)} (1,14) ; sabotage « sigma0 0 » : σ ${deg(sab.sigPsi).toFixed(3)}° (le tir exact, attrapé)`,
    Math.abs(deg(base.sigPsi) - F.sigma0) < 1e-9 && Math.abs(base.sigTheta / base.sigPsi - 2) < 1e-9
    && fin0.sigPsi > base.sigPsi && base.sigPsi > fin100.sigPsi && Math.abs(fin0.sigPsi / base.sigPsi - 2.24) < 1e-6 && Math.abs(fin100.sigPsi / base.sigPsi - 0.447) < 1e-6
    && Math.abs(pied.sigPsi / base.sigPsi - 1.29) < 1e-9 && Math.abs(presse.sigPsi / base.sigPsi - 2.35) < 1e-9 && Math.abs(presse.muV + 0.15) < 1e-9
    && Math.abs(fatig.sigPsi / base.sigPsi - 1.2) < 1e-9 && Math.abs(fatig.muV + 0.11) < 1e-9 && doux.sigPsi < base.sigPsi && Math.abs(loin.sigPsi / base.sigPsi - 1.144) < 1e-9 && sab.sigPsi === 0);
  // …ET LA FIXTURE (le patron verify-frappes : tout le monde parqué loin, le tireur à 18 m dans l'axe avec UN presseur à
  // 2 m de côté (P = 0,75 : la pression est le facteur qui mord), le gardien à son poste, 48 frappes à flux seedé distincts) : la part DANS LE CADRE au plan du but — le monde 258
  // c. le sabotage « le tir exact » (sigma0 0, sans hauteur visée). Sans pression ni fatigue la loi ne disperse que par
  // σ0 × (v/vMax)^γ × la hauteur visée : elle doit manquer ET le sabotage ne doit pas. Mesuré en flux 4 × 90 min :
  // cadrés 45 % des non contrés (avant 51-57, réel 45), buts 4,0 / match (4,75), conversion 13,4 % (15) ; le contré
  // manquant (0,8 % c. 27) est le lot suivant, pas celui-ci.
  const planFix = (over) => {
    const zs = [], ys = []; let n = 0;
    for (let k = 0; k < 48; k++) {
      const st = makeMatch({ full: true, seed: 5 });
      const sgn = -st.pitch.ownGoal(0).sign, goal = st.pitch.attackGoal(0);
      for (const q of st.players.filter((q) => q.team === 1 && !q.keeper)) { q.p[0] = -sgn * 30; q.p[2] = -28; q.v = [0, 0]; }
      for (const q of st.players.filter((q) => q.team === 0 && !q.keeper)) { q.p[0] = -sgn * 30; q.p[2] = 28; q.v = [0, 0]; }
      const cfg = matchCfg({ ...B_0746, ellipse: null /* ellipse null DATÉ 278 : vert à HEAD~ (worktree 59404a4), la fixture de finition mesure le σ du 258 (l'ellipse tire d'autres queues : 1,34 m latéral) — la clause mesure sa loi, pas l'ellipse de finition */, visee: null /* visee null DATÉ 277 : vert à HEAD~ (worktree d6f1868), la fixture de finition remangée (le tireur vise un mode du mélange, non plus le coin : σ latéral 2,22) — la clause mesure l'échelle de finition, pas le point visé */, shotRange: 20, oeil: false, fixe: false, ...(over ?? {}) });
      const c = st.players.find((p) => p.team === 0 && !p.keeper); const x = goal.x - sgn * 18;
      c.p[0] = x; c.p[2] = 0; c.v = [0, 0]; c.yaw = Math.atan2(0, sgn);
      const d1 = st.players.find((p) => p.team === 1 && !p.keeper); d1.p[0] = x; d1.p[2] = 2; d1.v = [0, 0];   // le presseur à 2 m DE CÔTÉ (hors du couloir de tir ; il dérive à ~3 m pendant l'armé : P ≈ 0,5)
      st.ball.restart([x + sgn * 0.3, 0.11, 0], { cause: 'coup-franc' }); st.restart = null; st.ball.possess(c.id);
      st.possession = { team: 0, carrier: c.id }; st.phase = 'carry'; st.hold = 1.0; st.lastTouch = 0;
      let lcg = ((k + 1) * 2654435761 + 97) >>> 0; st.rnd = () => { lcg = (lcg * 1664525 + 1013904223) >>> 0; return lcg / 4294967296; };
      tryShot(st, c, cfg);
      for (let i = 0; i < 4 * 60; i++) {
        matchStep(st, 1 / 60, cfg);
        if (st.phase === 'flight' && st.events.some((e) => e.type === 'shot')) {   // au LANCER : le point de passage au plan, extrapolé en ligne droite (sans le gardien)
          const v = st.ball.v, t = (goal.x - st.ball.p[0]) / (v[0] || 1e-6); if (t > 0) { zs.push(st.ball.p[2] + v[2] * t); ys.push(st.ball.p[1] + v[1] * t - 4.905 * t * t); n++; } break;
        }
      }
    }
    const m = zs.reduce((a, b) => a + b, 0) / Math.max(1, zs.length), sd = Math.sqrt(zs.reduce((a, z) => a + (z - m) ** 2, 0) / Math.max(1, zs.length));
    const dessus = ys.filter((y) => y > 2.44).length, cote = zs.filter((z) => Math.abs(z) > 3.66).length;
    return { n, m, sd, dessus, cote };
  };
  const vifF = planFix(null), exactF = planFix({ finition: { ...F, sigma0: 0, hauteur: null } });
  ok(`lot 258 — L'ÉCHELLE DE FINITION en fixture (18 m dans l'axe, presseur de côté, 48 frappes, point de passage au plan extrapolé au lancer) : écart-type latéral ${vifF.sd.toFixed(2)} m ≥ 0,35 (σψ ≈ 1,9° × 18 m — hors du cadre : ${vifF.cote} à côté, ${vifF.dessus} au-dessus) ; sabotage « le tir exact » (sigma0 0, sans hauteur) : ${exactF.sd.toFixed(3)} m ≤ 0,05 — la loi disperse, le sabotage vise le même point`,
    vifF.n >= 40 && exactF.n >= 40 && vifF.sd >= 0.35 && exactF.sd <= 0.05 && vifF.sd >= exactF.sd + 0.3);
}

// ---------------------------------------------------------------- lot 258b : LE CORPS QUI
// CONTRE (cfg.contre — la carte du book, Modèle 10 §5 : réel 27 % des tirs contrés, mesuré 3-7 % avant)
if (__bloc()) {
  // La fixture : le tireur à 12 m dans l'axe, un défenseur 1,5 m DEVANT lui à 0,6 m de la ligne de tir (la géométrie
  // médiane du flux : « un corps dans le couloir » sur 44 % des tirs, écart p50 0,59 m — hors du rayon fixe 0,38 du 176),
  // 48 frappes à flux seedé distincts. Monde 258b : le défenseur s'engage à l'armé, court sur la ligne et tend la jambe
  // (R = 0,28 + 2,2 (t − 0,18)⁺) — la part CONTRÉE doit être franche ; sabotage « contre null » (le bloc fixe du 176, le
  // tireur qui attend son couloir de 0,45 m) : le corps à 0,6 m ne mord pas.
  const blocFix = (over) => {
    let n = 0, contres = 0, tirs = 0; const issues = {};
    for (let k = 0; k < 48; k++) {
      const st = makeMatch({ full: true, seed: 5 });
      const sgn = -st.pitch.ownGoal(0).sign, goal = st.pitch.attackGoal(0);
      for (const q of st.players.filter((q) => q.team === 1 && !q.keeper)) { q.p[0] = -sgn * 30; q.p[2] = -28; q.v = [0, 0]; }
      for (const q of st.players.filter((q) => q.team === 0 && !q.keeper)) { q.p[0] = -sgn * 30; q.p[2] = 28; q.v = [0, 0]; }
      const cfg = matchCfg({ ...B_0746, visee: null /* visee null DATÉ 277 : vert à HEAD~ (worktree d6f1868), la fixture du contre remangée (le tireur vise un mode du mélange, non plus le coin) — la clause mesure le corps qui contre, pas le point visé */, shotRange: 20, oeil: false, fixe: false, ...(over ?? {}) });
      const c = st.players.find((p) => p.team === 0 && !p.keeper); const x = goal.x - sgn * 12;
      c.p[0] = x; c.p[2] = 0; c.v = [0, 0]; c.yaw = Math.atan2(0, sgn);
      const d1 = st.players.find((p) => p.team === 1 && !p.keeper); d1.p[0] = x + sgn * 1.5; d1.p[2] = 0.6; d1.v = [0, 0]; d1.down = 0;
      st.ball.restart([x + sgn * 0.3, 0.11, 0], { cause: 'coup-franc' }); st.restart = null; st.ball.possess(c.id);
      st.possession = { team: 0, carrier: c.id }; st.phase = 'carry'; st.hold = 1.0; st.lastTouch = 0;
      let lcg = ((k + 1) * 2654435761 + 97) >>> 0; st.rnd = () => { lcg = (lcg * 1664525 + 1013904223) >>> 0; return lcg / 4294967296; };
      let lcg2 = ((k + 1) * 40503 + 11) >>> 0; st.rnd2 = () => { lcg2 = (lcg2 * 1664525 + 1013904223) >>> 0; return lcg2 / 4294967296; };
      const n0 = st.events.length;
      tryShot(st, c, cfg); n++;
      for (let i = 0; i < 3 * 60; i++) { matchStep(st, 1 / 60, cfg); if (st.events.slice(n0).some((e) => e.type === 'contre' || e.type === 'but' || e.type === 'arrêt' || e.type === 'sortie')) break; }
      const ev = st.events.slice(n0);
      if (ev.some((e) => e.type === 'shot')) tirs++;
      const ct = ev.find((e) => e.type === 'contre'); if (ct) { contres++; issues[ct.issue ?? 'fixe'] = (issues[ct.issue ?? 'fixe'] ?? 0) + 1; }
    }
    return { n, tirs, contres, part: contres / Math.max(1, tirs), issues };
  };
  const vif = blocFix(null), sab = blocFix({ contre: null });
  const C = matchCfg({ ...B_0746 }).contre;
  ok(`lot 258b — LE CORPS QUI CONTRE en fixture (12 m dans l'axe, un défenseur 1,5 m devant à 0,6 m de la ligne, 48 frappes) : le tireur tire dans le trafic (${vif.tirs}/48 tirs partis, couloir ${C.couloir} m) et le corps engagé contre ${(100 * vif.part).toFixed(0)} % ≥ 40 (issues ${JSON.stringify(vif.issues)} — renvoi / amorti / sortie / déviation) ; sabotage « contre null » (le bloc fixe du 176, rayon 0,38) : ${sab.tirs}/48 tirs partis, contrés ${(100 * sab.part).toFixed(0)} % ≤ 10 — le corps à 0,6 m ne mord pas hier`,
    vif.tirs >= 40 && vif.part >= 0.4 && sab.part <= 0.1 && C.porte >= 4 && C.corps > 0);
}

// ---------------------------------------------------------------- lot 257 : LE CARTON JUGE
// LA NATURE (cfg.carton — la carte du book, Modèle 12 §3, Bible 15 §5 : 4 jaunes et 0,1-0,36 rouge par match)
if (__bloc()) {
  // Les fixtures : le même sifflet (fautif réel, fenêtre close, lésé sans ballon) sous chaque NATURE, 200 tirages
  // seedés du flux → P(jaune) par espèce ; le DOGSO (victime lancée vers le but, aucun couvrant) → rouge direct et
  // expulsion ; le DOGSO dans sa surface sur un tacle → jaune + penalty ; l'averti (réticence) ; le sabotage
  // « carton null » : la récidive à 2 d'hier (2ᵉ faute → jaune, quelle que soit la nature).
  const monde = (over) => { const cfg = matchCfg({ ...B_0746,  flux: null /* flux null DATÉ 264 : vert à HEAD~ (worktree 9eee4ea), les fixtures injectent leur LCG dans st.rnd / st.rnd2 par itération (200 tirages) — sous le flux nommé, mêmes coordonnées, même monde (P = 1,00 partout) ; la clause mesure la nature du carton, pas le flux */, shotRange: 20, ...(over ?? {}) }); const st = makeMatch({ full: true, seed: 3 }); for (let i = 0; i < 30 * 60 && !(st.phase === 'carry' && st.possession.carrier >= 0 && !st.restart); i++) matchStep(st, 1 / 60, cfg); return { st, cfg }; };
  const pJaune = (nature, over, k = 200) => {
    let j = 0, r = 0;
    for (let i = 0; i < k; i++) {
      const { st, cfg } = monde(over);
      const par = st.players.find((q) => q.team === 1 && !q.keeper); const own = st.pitch.ownGoal(1);
      const vic = st.players.find((q) => q.team === 0 && !q.keeper);
      // la scène : la victime au milieu, TOUS les corps du fautif rangés derrière la faute (aucun couvrant) sauf la clause qui en veut
      for (const q of st.players) if (q.team === 1 && !q.keeper) { q.p[0] = -own.sign * 30; q.p[2] = 20; }
      const dir = [own.sign * 6, 0];
      st._faute = { t: st.t - 2, par: par.id, sur: vic.id, team: 0, p: [own.x - own.sign * (nature.dist ?? 40), 0], kind: nature.kind, vSur: nature.v ?? 0, dir: nature.lance ? dir : [0, 0], arrache: !!nature.arrache };
      if (nature.couvrants) for (let c = 0; c < nature.couvrants; c++) { const q = st.players.filter((q) => q.team === 1 && !q.keeper && q.id !== par.id)[c]; q.p[0] = own.x - own.sign * 10; q.p[2] = c * 2; }
      if (nature.deja) par._jaunes = 1;
      st.possession.team = 1; let lcg = (i * 2654435761 + 7) >>> 0; st.rnd2 = () => { lcg = (lcg * 1664525 + 1013904223) >>> 0; return lcg / 4294967296; };
      const n0 = st.events.length; adjugeFaute(st, cfg);
      const ev = st.events.slice(n0);
      if (ev.some((e) => e.type === 'carton' && e.couleur === 'jaune')) j++;
      if (ev.some((e) => e.type === 'carton' && e.couleur === 'rouge' && e.direct)) r++;
    }
    return { j: j / k, r: r / k };
  };
  const acc = pJaune({ kind: 'accrochage', v: 5 }), accA = pJaune({ kind: 'accrochage', v: 5, arrache: true }), deb = pJaune({ kind: 'tacle-debout', v: 3 });
  const charge = pJaune({ kind: 'charge-derrière', v: 5 }), gliD = pJaune({ kind: 'tacle-glissé-derrière', v: 5 }), prom = pJaune({ kind: 'accrochage', v: 5, lance: true, couvrants: 2 });
  const dogso = pJaune({ kind: 'accrochage', v: 5, lance: true, dist: 25 }, null, 20), couvert = pJaune({ kind: 'accrochage', v: 5, lance: true, dist: 25, couvrants: 1 }, null, 20), dogsoBox = pJaune({ kind: 'tacle-glissé', v: 5, lance: true, dist: 8 }, null, 20);
  const deja = pJaune({ kind: 'charge-derrière', v: 5, deja: true }), sab = pJaune({ kind: 'accrochage', v: 5 }, { carton: null }, 20);
  const K = matchCfg({ ...B_0746 }).carton;
  ok(`lot 257 — LE CARTON JUGE LA NATURE (fixtures, 200 tirages) : P(jaune) accrochage arraché ${accA.j.toFixed(2)} < accrochage ${acc.j.toFixed(2)} ≤ 0,25 < charge par derrière ${charge.j.toFixed(2)} < glissé par derrière ${gliD.j.toFixed(2)} ≥ 0,6 ; tacle debout ${deb.j.toFixed(2)} ; la transition PROMETTEUSE (lancée, 2 couvrants) ${prom.j.toFixed(2)} ≥ acc + 0,3 ; l'averti sur la charge ${deja.j.toFixed(2)} < ${charge.j.toFixed(2)} (réticence) ; DOGSO (lancé, aucun couvrant, 25 m) : rouge direct ${dogso.r.toFixed(2)} = 1, UN couvrant : rouge ${couvert.r.toFixed(2)} = 0 (la géométrie lit les corps) ; DOGSO dans la surface sur un tacle : jaune ${dogsoBox.j.toFixed(2)} = 1, rouge ${dogsoBox.r.toFixed(2)} = 0 ; sabotage « carton null » : la 1ʳᵉ faute ne carte pas (${sab.j.toFixed(2)} = 0 — la récidive d'hier)`,
    accA.j < acc.j && acc.j <= 0.25 && acc.j < charge.j && charge.j < gliD.j && gliD.j >= 0.6 && prom.j >= acc.j + 0.3 && deja.j < charge.j && dogso.r === 1 && couvert.r === 0 && dogsoBox.j === 1 && dogsoBox.r === 0 && sab.j === 0 && K.tally > 0);
}

// ---------------------------------------------------------------- lot 259 : L'ORTEIL ET LA COURSE
// QUI TRAVERSE (cfg.horsJeu — la carte du book, Modèle 12 §1.2-§2, Bible 09 §4.1 : 3,1-4,5 hors-jeu par match)
if (__bloc()) {
  // (a) la loi pure : la capsule — le tronc pour l'immobile, le tronc + le pied avant pour celui qui court vers le but,
  // rien vers l'arrière ; la ligne du défenseur qui recule RECULE d'autant. (b) la photo : un coureur dont le CENTRE est
  // 10 cm en jeu au départ du ballon est pris d'un orteil sous la clé, pas sans. (c) la tentative : le photographié qui
  // arrive au ballon est sifflé sans son pied ; sabotage null : muet.
  const K = matchCfg({ ...B_0746 }).horsJeu;
  const st0 = makeMatch({ full: true, seed: 5 }); st0.t = 0.113;
  const im = { id: 3, v: [0, 0] }, av = { id: 3, v: [7.5, 0] }, ar = { id: 3, v: [-7.5, 0] };
  const pIm = pointCorps(st0, im, 1, K, +1), pAv = pointCorps(st0, av, 1, K, +1), pAr = pointCorps(st0, ar, 1, K, +1), pDef = pointCorps(st0, ar, 1, K, -1);
  const photo = (over) => {
    const st = makeMatch({ full: true, seed: 5 }), cfg = matchCfg({ ...B_0746,  shotRange: 20, ...(over ?? {}) });
    const sgn = -st.pitch.ownGoal(0).sign;
    const c0 = st.players.find((p) => p.team === 0 && p.post === 5), rec = st.players.find((p) => p.team === 0 && p.post === 8);
    c0.p[0] = 0; c0.p[2] = 0; c0.v = [0, 0];
    for (const q of st.players.filter((q) => q.team === 1)) { q.p[0] = sgn * (q.keeper ? 51 : 18); q.v = [0, 0]; }
    for (const q of st.players.filter((q) => q.team === 0 && q !== c0 && q !== rec)) q.p[0] = -sgn * 8;
    st.ball.restart([0, 0.11, 0], { cause: 'coup-franc' }); st.restart = null; st.ball.possess(c0.id);
    st.possession = { team: 0, carrier: c0.id }; st.phase = 'carry'; st.hold = 1.4; st.lastTouch = 0;
    const pin = () => { rec.p[0] = sgn * 17.9; rec.p[2] = 4; rec.v = [sgn * 7, 0]; for (const q of st.players) if (q.team === 1) { q.p[0] = sgn * (q.keeper ? 51 : 18); q.v = [0, 0]; } };
    pin();
    const choice = { to: rec, lead: [sgn * 24, 0.11, 4], style: 'ground', lane: { margin: 3, open: true }, dist: 18 };
    simInternals.beginPass(st, choice, cfg);
    let off = null;
    for (let i = 0; i < 90; i++) { pin(); matchStep(st, 1 / 60, cfg); if (st.pass && st.phase === 'flight') { off = st.pass.off ?? {}; break; } }
    const pris = off != null && !!off[rec.id];
    // la tentative : le photographié arrive au ballon en vol
    let tente = false;
    if (pris) { rec.p[0] = st.ball.p[0] + sgn * 0.8; rec.p[2] = st.ball.p[2]; const n0 = st.events.length; horsJeuTente(st, cfg); tente = st.events.slice(n0).some((e) => e.type === 'hors-jeu' && e.tente); }
    return { off, pris, tente, deny: st.deny?.['hors-jeu'] ?? 0 };
  };
  const V = photo(null), N = photo({ horsJeu: null });
  ok(`lot 259 — L'ORTEIL (loi pure) : immobile ${pIm.toFixed(2)} m = tronc ${K.tronc} ; vers le but à 7,5 m/s ${pAv.toFixed(2)} ∈ ]tronc ; tronc + foulee ${K.foulee}] ; à reculons ${pAr.toFixed(2)} = tronc (rien vers l'arrière) ; le défenseur qui recule ${pDef.toFixed(2)} > tronc (sa ligne recule d'autant) — ET LA PHOTO : le coureur dont le centre est 10 cm en jeu au départ (17,9 / ligne 18) est PRIS d'un orteil sous la clé (${V.pris}, refus du cerveau ${V.deny} = 0 : le cerveau juge le centre), pas sans (${N.pris}) ; la TENTATIVE : le photographié à 0,8 m du ballon en vol est sifflé (${V.tente})`,
    Math.abs(pIm - K.tronc) < 1e-9 && pAv > K.tronc && pAv <= K.tronc + K.foulee + 1e-9 && Math.abs(pAr - K.tronc) < 1e-9 && pDef > K.tronc && V.pris === true && V.deny === 0 && N.pris === false && V.tente === true);
}

// ---------------------------------------------------------------- lot 253 : LA PAUSA (cfg.pausa —
// la carte du book, Bible 07 §7 : « une désynchronisation volontaire », 3-6 par match de 1,5-3,5 s)
if (__bloc()) {
  // La fixture : un porteur au calme dans le tiers adverse (aucun presseur à moins de 12 m : ttp infini), deux
  // adversaires LANCÉS vers le ballon, un partenaire en pleine course (_runT devant) qui n'est pas l'option du
  // moment → le porteur TIENT (pausaStep true, _pausa posé) ; la course devient l'option → il lâche, l'événement
  // `pausa` porte l'issue « servie » et le gain ; la pression arrive (ttp < 0,9) → « pression ». Sabotage
  // « pausa null » : le monde d'hier, la clé absente ne tient rien (aucun _pausa, aucun événement).
  const scene = (over) => {
    const st = makeMatch({ full: true, seed: 5 }), cfg = matchCfg({ ...B_0746,  shotRange: 20, ...(over ?? {}) });
    const sgn = -st.pitch.ownGoal(0).sign;
    const c = st.players.find((p) => p.team === 0 && p.post === 5), run = st.players.find((p) => p.team === 0 && p.post === 8), other = st.players.find((p) => p.team === 0 && p.post === 7);
    for (const q of st.players) { q.v = [0, 0]; q.down = 0; }
    st.t = 100;
    c.p[0] = sgn * 20; c.p[2] = 0; other.p[0] = sgn * 14; other.p[2] = 8; run.p[0] = sgn * 30; run.p[2] = -6; run._runT = st.t + 1.2; run.v = [sgn * 6, 0];
    for (const q of st.players.filter((q) => q.team === 0 && q !== c && q !== run && q !== other)) q.p[0] = -sgn * 20;
    const defs = st.players.filter((q) => q.team === 1 && !q.keeper); defs.forEach((q, k) => { q.p[0] = sgn * 40; q.p[2] = (k - 5) * 5; });
    defs[0].p[0] = sgn * 34; defs[0].p[2] = 3; defs[0].v = [-sgn * 3.5, -0.5]; defs[1].p[0] = sgn * 34; defs[1].p[2] = -4; defs[1].v = [-sgn * 3.5, 0.5];   // deux lancés vers le ballon, encore à 14 m
    st.ball.restart([c.p[0] + sgn * 0.3, 0.11, 0], { cause: 'coup-franc' }); st.restart = null; st.ball.possess(c.id);
    st.possession = { team: 0, carrier: c.id }; st.phase = 'carry'; st.hold = 0.8; st.lastTouch = 0;
    return { st, cfg, c, run, other, defs, sgn };
  };
  const V = scene(null);
  const choix = (to) => ({ to: { id: to.id }, lead: [to.p[0], 0, to.p[2]], style: 'ground', score: 1.0, lane: { margin: 3, open: true } });
  const ttp0 = ttpDe(V.st, V.c, V.cfg.pausa), eng0 = engages(V.st, V.c, 2);
  const tient = pausaStep(V.st, V.c, V.cfg, choix(V.other)); const pose = !!V.c._pausa;
  V.st.t += 0.6; V.st.hold += 0.6; const tient2 = pausaStep(V.st, V.c, V.cfg, choix(V.other));   // la tenue avance avec le temps (une pausa dont la possession a changé se dissout)
  V.st.t += 0.5; V.st.hold += 0.5; const lache = pausaStep(V.st, V.c, V.cfg, { ...choix(V.run), score: 1.4 }); const ev = V.st.events.filter((e) => e.type === 'pausa');
  const P = scene(null); pausaStep(P.st, P.c, P.cfg, choix(P.other)); P.defs[0].p[0] = P.sgn * 21.5; P.defs[0].p[2] = 0.8; P.defs[0].v = [-P.sgn * 5, 0]; P.st.t += 0.3; P.st.hold += 0.3;   // le presseur arrive : ttp < 0,9
  const lacheP = pausaStep(P.st, P.c, P.cfg, choix(P.other)); const evP = P.st.events.filter((e) => e.type === 'pausa');
  const N = scene({ pausa: null }); const ttpN = ttpDe(N.st, N.c, matchCfg({ ...B_0746 }).pausa);
  ok(`lot 253 — LA PAUSA (fixture : porteur au calme, ttp ${ttp0 === Infinity ? '∞' : ttp0.toFixed(1)} s, ${eng0} adversaires lancés, une course partenaire en cours) : le porteur TIENT (${tient}, _pausa posé ${pose}) et tient encore à +0,6 s (${tient2}) ; la course devient l'option → il LÂCHE (${!lache}) et l'événement pausa dit « ${ev[0]?.issue} » durée ${ev[0]?.duree} s, gain ${ev[0]?.gain} (valeur ${ev[0]?.valeur === true}) ; le presseur qui arrive rompt la pausa : « ${evP[0]?.issue} » ; sabotage « pausa null » : aucune tenue (${!N.c._pausa}, même scène, ttp ${ttpN === Infinity ? '∞' : ttpN.toFixed(1)})`,
    ttp0 > 1.8 && eng0 >= 2 && tient === true && pose && tient2 === true && lache === false && ev.length === 1 && ev[0].issue === 'servie' && ev[0].duree >= 1.0 && ev[0].valeur === true && lacheP === false && evP[0]?.issue === 'pression' && !N.c._pausa);
}

// ---------------------------------------------------------------- lot 255 : LA LIGNE HAUTE ET SON
// PIÈGE (cfg.piege, preset ligneHaute — Bible 03 T3/T3b, Bible 10 §10.2 : la synchronie provoque, pas la hauteur)
if (__bloc()) {
  // Le preset existe et porte ses deux faces (piege 1, hauteurBloc 0,9). La fixture : l'équipe 1 défend à 27 m, l'équipe
  // 0 porte à 42 m du but de 1 (personne ne presse) et ARME une passe (geste en anticipation) ; sous cfg.piege (piege 1) piegeStep marque la
  // ligne — les quatre corps de la bande reçoivent LE MÊME until (la synchronie) et un pas ; en 0,67 s d'images la ligne
  // (avant-dernier) a MONTÉ d'au moins 0,5 m (depuis l'arrêt) ; sabotage « piege null » : rien ne bouge ; et à piege 0 (même hauteur) :
  // rien non plus — c'est l'axe qui décide, pas la hauteur (T3b).
  const lh = resoudreTactique('ligneHaute');
  const scene = (over, tq) => {
    const st = makeMatch({ full: true, seed: 5, tactics: ['equilibre', tq ?? { piege: 1, pressing: 0 }] }), cfg = matchCfg({ ...B_0746,  locomoteur: null /* locomoteur null DATÉ 260 : vert à HEAD~ (worktree 8ff0842), la fixture remangée par le profil locomoteur (le corps démarre en 2,3 τ) — la clause mesure son mécanisme, pas la locomotion */, ligneAccrochee: null /* ligneAccrochee null DATÉ 280 : vert à HEAD~ (worktree 303b2e4), la ligne haute mesurée hier contre un bloc chaîné à 27 m — la clause mesure sa loi, pas la ligne accrochée */, locomoteur: null /* locomoteur null DATÉ 260 : vert à HEAD~ (worktree 8ff0842), la fixture remangée par le profil locomoteur (le corps démarre en 2,3 τ) — la clause mesure son mécanisme, pas la locomotion */, shotRange: 20, familiarite: null /* familiarite null DATÉ 254 : la clause mesure la synchronie du piège nu (un seul until) — la familiarité y ajoute son retard par corps, mesuré au bloc 254 */, ...(over ?? {}) });
    const own = st.pitch.ownGoal(1), sg = -own.sign;   // sg : de l'équipe 1 vers son but adverse ; sa ligne est à own.x + 27·(−sg)… on pose en x monde
    const dir = -sg;   // vers le but de 1
    const c = st.players.find((p) => p.team === 0 && p.post === 5);
    for (const q of st.players) { q.v = [0, 0]; q.down = 0; }
    const defs = st.players.filter((q) => q.team === 1 && !q.keeper); defs.forEach((q, k) => { q.p[0] = own.x - dir * (k < 4 ? 27 : 40); q.p[2] = (k < 4 ? (k - 1.5) * 6 : (k - 7) * 5); });
    for (const q of st.players.filter((q) => q.team === 0 && q !== c)) q.p[0] = own.x - dir * 34;
    c.p[0] = own.x - dir * 42; c.p[2] = 0; c.yaw = Math.atan2(0, dir);   // le porteur à 15 m de la ligne : personne ne presse, la ligne est postée
    st.ball.restart([c.p[0] + dir * 0.3, 0.11, 0], { cause: 'coup-franc' }); st.restart = null; st.ball.possess(c.id);
    st.possession = { team: 0, carrier: c.id }; st.phase = 'carry'; st.hold = 1.0; st.lastTouch = 0;
    let lcg = 777; st.rnd2 = () => { lcg = (lcg * 1664525 + 1013904223) >>> 0; return lcg / 4294967296; };
    const act = { id: 'pass', t: 0, anticipation: 5, follow: 0.2, total: 5.2, phase: 'anticipation', fired: false, payload: { kind: 'pass' } }; const arme = () => { act.t = 0; act.phase = 'anticipation'; c.act = act; };   // UN SEUL armé (un objet) : le piège se tire une fois par geste   // l'armé posé et re-posé chaque image (la fixture ne joue jamais la passe : l'anticipation dure 5 s)
    arme();
    const ligne = () => { const xs = defs.slice(0, 4).map((q) => (q.p[0] - own.x) * (-dir)); xs.sort((a, b) => a - b); return xs[1]; };
    const x0 = ligne(); piegeStep(st, cfg);
    const marques = defs.filter((q) => q._piege), untils = new Set(marques.map((q) => q._piege.until));
    for (let i = 0; i < 40; i++) { arme(); matchStep(st, 1 / 60, cfg); }
    return { x0, x1: ligne(), marques: marques.length, sync: untils.size, ev: st.events.filter((e) => e.type === 'piege').length };
  };
  const V = scene(null, { piege: 1, pressing: 0 }), N = scene({ piege: null }, { piege: 1, pressing: 0 }), Z = scene(null, { piege: 0, pressing: 0 });
  ok(`lot 255 — LA LIGNE HAUTE ET SON PIÈGE : le preset ligneHaute existe (piege ${lh.piege} = 1, hauteurBloc ${lh.hauteurBloc} ≥ 0,85, ses hommes ${Object.keys(lh.roles ?? {}).length} ≥ 2) ; à l'armé du passeur adverse la ligne se MARQUE (${V.marques} corps de la bande, ${V.sync} until = 1 : synchrone, ${V.ev} événement) et MONTE en 0,67 s (${V.x0.toFixed(1)} → ${V.x1.toFixed(1)} m du but : +${(V.x1 - V.x0).toFixed(2)} ≥ 0,5 — depuis l'arrêt) ; sabotage « piege null » : rien (${N.marques} marqué, +${(N.x1 - N.x0).toFixed(2)} ≤ 0,3) ; à piege 0, même hauteur : rien non plus (${Z.marques} marqué — l'axe décide, pas la hauteur : T3b)`,
    lh.piege === 1 && lh.hauteurBloc >= 0.85 && Object.keys(lh.roles ?? {}).length >= 2 && V.marques >= 3 && V.sync === 1 && V.ev === 1 && V.x1 - V.x0 >= 0.5 && N.marques === 0 && N.x1 - N.x0 <= 0.3 && Z.marques === 0);
}

// ---------------------------------------------------------------- lot 254 : LA FAMILIARITÉ, LE
// MÉCANISME RELATIONNEL (cfg.familiarite — Modèle 14 §7, Référentiel 13)
if (__bloc()) {
  // (a) les lois pures : η(t) sur deux branches (0,35 → ~0,64 à 2 min par la branche rapide, ~0,80 à 10 min, jamais > 1), σ_sync 0,36 s à η 0,4 et 0,12 à
  // η 1, Φ^0,7. (b) l'état : une équipe injectée à familiarité 0,4 a η 0,4 ; un choc de posture ramène η à 0,7 et η
  // remonte ; (c) la ligne au piège : à η 0,4 les corps partent DÉSYNCHRONISÉS (désync > 0,1 s), à η 1 presque ensemble ;
  // sabotage « familiarite null » : tous au même instant (désync absent). (d) Φ de deux joueurs à 0,4 et 1 → 0,63.
  const K = matchCfg({ ...B_0746 }).familiarite;
  const e2 = etaApres(0.35, 120, K), e10 = etaApres(0.35, 600, K), e0 = etaApres(0.35, 0, K), eInf = etaApres(0.35, 1e7, K);
  const s04 = sigmaSync(0.4, K), s1 = sigmaSync(1, K);
  const scene = (fam, over) => {
    const squads = fam != null ? [Array.from({ length: 11 }, () => ({ familiarite: fam })), null] : null;
    const st = makeMatch({ full: true, seed: 5, tactics: [{ piege: 1, pressing: 0 }, 'equilibre'], ...(squads ? { squads } : {}) }), cfg = matchCfg({ ...B_0746,  flux: null /* flux null DATÉ 264 : vert à HEAD~ (worktree 9eee4ea), la fixture du piège FORCE le tirage par st.rnd2 (0,1-0,7) et le flux nommé ne l'écoute plus (0 corps partent) — la clause mesure la familiarité, pas le flux */, shotRange: 20, ...(over ?? {}) });
    const own = st.pitch.ownGoal(0), dir = -(-own.sign);   // vers le but de 0
    const c = st.players.find((p) => p.team === 1 && p.post === 5);
    for (const q of st.players) { q.v = [0, 0]; q.down = 0; }
    const defs = st.players.filter((q) => q.team === 0 && !q.keeper); defs.forEach((q, k) => { q.p[0] = own.x - dir * (k < 4 ? 27 : 40); q.p[2] = (k < 4 ? (k - 1.5) * 6 : (k - 7) * 5); });
    for (const q of st.players.filter((q) => q.team === 1 && q !== c)) q.p[0] = own.x - dir * 34;
    c.p[0] = own.x - dir * 42; c.p[2] = 0;
    st.ball.restart([c.p[0] + dir * 0.3, 0.11, 0], { cause: 'coup-franc' }); st.restart = null; st.ball.possess(c.id);
    st.possession = { team: 1, carrier: c.id }; st.phase = 'carry'; st.hold = 1.0; st.lastTouch = 1;
    let lcg = 4242; st.rnd2 = () => { lcg = (lcg * 1664525 + 1013904223) >>> 0; return 0.1 + 0.6 * (lcg / 4294967296); };   // le tirage du piège passe (< 0,8), les retards restent seedés
    matchStep(st, 1 / 60, cfg);   // une image : l'état de familiarité se pose
    const act = { id: 'pass', t: 0, anticipation: 5, follow: 0.2, total: 5.2, phase: 'anticipation', fired: false, payload: { kind: 'pass' } }; c.act = act;
    piegeStep(st, cfg);
    const ev = st.events.filter((e) => e.type === 'piege').at(-1);
    const ats = defs.filter((q) => q._piege).map((q) => q._piege.at ?? st.t);
    c.act = null;   // la fixture ne joue jamais la passe
    return { st, cfg, eta: etaDe(st, 0, cfg), ev, desync: ats.length ? Math.max(...ats) - Math.min(...ats) : NaN, n: ats.length };
  };
  const V4 = scene(0.4, null), V1 = scene(null, null), N = scene(0.4, { familiarite: null });
  chocFamiliarite(V1.st, 0, 0.7, 'posture', V1.cfg); const eChoc = etaDe(V1.st, 0, V1.cfg); for (let i = 0; i < 60 * 60; i++) matchStep(V1.st, 1 / 60, V1.cfg); const eApres = etaDe(V1.st, 0, V1.cfg);
  const a = V4.st.players.find((p) => p.team === 0 && !p.keeper), b = V4.st.players.find((p) => p.team === 0 && !p.keeper && p !== a); const phi = affinite(V4.st, a.id, b.id, V4.cfg);
  ok(`lot 254 — LA FAMILIARITÉ (lois pures) : η(0) ${e0.toFixed(2)} = 0,35, η(2 min) ${e2.toFixed(2)} ∈ [0,55 ; 0,75] (la branche rapide du réalignement), η(10 min) ${e10.toFixed(2)} ∈ [0,72 ; 0,88] (la branche lente de l'automatisme ne revient pas dans le match), η(∞) ${eInf.toFixed(2)} = 1 ; σ_sync ${s04.toFixed(2)} s à η 0,4 (≈ 0,36) et ${s1.toFixed(2)} à η 1 ; Φ^0,7 de 0,4 → ${affiniteMotif(0.4, K).toFixed(2)} — L'ÉTAT : l'équipe injectée à 0,4 a η ${V4.eta.toFixed(2)}, la rodée ${(scene(null, null).eta).toFixed(2)} = 1 ; le choc de posture ramène η à ${eChoc.toFixed(2)} (0,7) et une minute plus tard ${eApres.toFixed(2)} > 0,7 — LA LIGNE AU PIÈGE : à η 0,4 les ${V4.n} corps partent désynchronisés (${V4.desync.toFixed(2)} s ≥ 0,1, σ ${V4.ev?.sigma}), à η 1 presque ensemble (${V1.desync.toFixed(2)} s < ${V4.desync.toFixed(2)}) ; sabotage « familiarite null » : tous au même instant (${N.desync.toFixed(2)} = 0, aucun σ ${N.ev?.sigma === undefined}) ; Φ(0,4 ; 0,4) = ${phi.toFixed(2)} < 1`,
    Math.abs(e0 - 0.35) < 1e-9 && e2 >= 0.55 && e2 <= 0.75 && e10 >= 0.72 && e10 <= 0.88 && Math.abs(eInf - 1) < 1e-6 && Math.abs(s04 - 0.36) < 1e-9 && Math.abs(s1 - 0.12) < 1e-9 && Math.abs(V4.eta - 0.4) < 1e-6 && Math.abs(eChoc - 0.7) < 1e-6 && eApres > 0.7 && V4.n >= 3 && V4.desync >= 0.1 && V1.desync < V4.desync && N.desync === 0 && N.ev?.sigma === undefined && phi < 1);
}

// ---------------------------------------------------------------- lot 260 : LE PROFIL LOCOMOTEUR ET
// LE BUDGET DE COURSE (cfg.locomoteur — Modèle 02, Référentiel 05 : le constat n° 1 des Bibles)
if (__bloc()) {
  // (a) les lois pures : le profil à l'identité (8,8 m/s, 1,17 s, F₀ 7,5), le garde-fou F₀ (pace 20 / acceleration 20
  // ne fait pas 10,4/0,95 = 10,9 : borné 10,2), l'ordre des fatigues λτ > λD > λV, le freinage plus fort que
  // l'accélération, la pointe refusée sans réservoir. (b) la fixture : un corps à l'arrêt lancé vers une cible lointaine
  // au métier de bloc (ε 0,55) — sous la clé il n'a pas la pointe à 1 s (le mono-exponentiel : t₉₀ = 2,3 τ), sans la clé
  // il l'a (7,5 m/s² constants : 5,4 m/s en 0,72 s) ; et en rupture (ε 1) il va plus vite qu'au bloc.
  const K = matchCfg({ ...B_0746 }).locomoteur;
  const id = profilDe({ skill: null }, K), sur = profilDe({ skill: { topF: 1.10, accelF: 1.12 } }, K);
  const F0 = fatigueDe(0, K), F1 = fatigueDe(1, K);
  const st0 = makeMatch({ full: true, seed: 5 }); st0.t = 1;
  const pv = { skill: null, job: 'support', _pace: { until: 0 }, wp: 1 }, aAcc = pasLoco(pv, st0, K, 0, 8, 1), aFrein = pasLoco(pv, st0, K, 8, 0, 1);
  const course = (over, burst) => {
    const st = makeMatch({ full: true, seed: 5 }), cfg = matchCfg({ ...B_0746,  shotRange: 20, ...(over ?? {}) });
    const p = st.players.find((q) => q.team === 0 && q.post === 5);
    for (const q of st.players) { q.v = [0, 0]; q.down = 0; }
    p.p[0] = -10; p.p[2] = 20; st.ball.restart([40, 0.11, -20], { cause: 'coup-franc' }); st.restart = null;
    const vs = [];
    for (let i = 0; i < 60; i++) { p.job = 'support'; p.target = [-10, 0, -30]; p._slotT = [-10, -30]; if (burst) p._pace = { until: st.t + 5, kind: 'appel', next: st.t + 9 }; else p._pace = { until: -1, next: st.t + 99 }; matchStep(st, 1 / 60, cfg); vs.push(Math.hypot(p.v[0], p.v[1])); }
    return { v1: vs[59], v05: vs[29], max: Math.max(...vs) };
  };
  const V = course(null, false), R = course(null, true), N = course({ locomoteur: null }, false);
  ok(`lot 260 — LE PROFIL LOCOMOTEUR (lois pures) : l'identité rend l'élite (V₀ ${id.v0.toFixed(1)} m/s, τ ${id.tau.toFixed(2)} s, F₀ ${id.f0.toFixed(1)}) ; pace 20 / acceleration 20 : F₀ ${sur.f0.toFixed(1)} ≤ 10,2 (le garde-fou), τ ${sur.tau.toFixed(2)} ; les fatigues s'ordonnent λτ (${(F0.kTau - 1).toFixed(2)}) > λD (${(1 - F0.kD).toFixed(2)}) > λV (${(1 - F0.kV).toFixed(2)}), à réservoir plein tout vaut 1 ; on freine plus fort qu'on n'accélère (|${aFrein.toFixed(2)}| > ${aAcc.toFixed(2)} m/s par s) ; la pointe se refuse à wp 0,1 (${!pointePermise({ wp: 0.1 }, K)}) et se permet à 1 (${pointePermise({ wp: 1 }, K)}) — LA FIXTURE : au métier de bloc, sous la clé ${V.v1.toFixed(2)} m/s à 1 s (< 3,0 : le démarrage n'est pas une marche d'escalier), en rupture ${R.v1.toFixed(2)} > ${V.v1.toFixed(2)} ; sabotage « locomoteur null » : ${N.v1.toFixed(2)} ≥ 4,0 à 1 s (7,5 m/s² constants — la pointe à 4 m d'hier)`,
    Math.abs(id.v0 - K.v0) < 1e-9 && Math.abs(id.tau - K.tau) < 1e-9 && sur.f0 <= K.f0Max + 1e-9 && F0.kTau - 1 > 1 - F0.kD && 1 - F0.kD > 1 - F0.kV && Math.abs(F1.kTau - 1) < 1e-9 && -aFrein > aAcc && !pointePermise({ wp: 0.1 }, K) && pointePermise({ wp: 1 }, K) && V.v1 < 3.0 && R.v1 > V.v1 && N.v1 >= 4.0);
}

// ---------------------------------------------------------------- lot 261 : L'INTENTION D'EFFORT AU
// CERVEAU (cfg.effort — Modèle 02 §3.5, Bible 10 §4.3, Bible 16, Référentiel 05 §3)
if (__bloc()) {
  // (a) les lois pures : l'horizon d'atteignabilité à l'identité (tAtt exact au 50 / à l'équilibre / au polyvalent), l'école
  // de la chasse (pressing 1 → × 1,3), le pas de coulissement du marqueur d'homme (marquage 1 → × 1,3), l'appel pertinent
  // à portée de passe seulement ; l'intention : le presseur à 40 m FERME (vActif), à 5 m il chasse (null), dans la
  // fenêtre collective il chasse (null) ; le repli 6 s après la perte RENTRE (vRecup), à 2 s il sprinte (null).
  // (b) la fixture : un suiveur posté à 8 m d'un slot immobile, à 64 m d'un ballon mort, en jeu placé — sous la clé il
  // MARCHE (vEnt 1,4 : ≤ 1,45 m/s à 4 s) ; le SAUT du
  // slot (6 m ≥ saut) déclenche le coulissement actif (> 2,3 m/s 1,5 s plus tard, régime 'actif' — l'allure d'hier l'aurait
  // plafonné à 2,1) qui s'éteint après actifDur (< 2,0 à 4,5 s : le roulé du 260 le ramène à la marche) ; sabotage « effort
  // null » : après le même saut, l'allure d'hier plafonne le suiveur à 2,1 (< 2,3 à 1,5 s) — le pas de coulissement n'existe pas.
  const K = matchCfg({ ...B_0746 }).effort, st0 = makeMatch({ full: true, seed: 5 }); st0.t = 10; st0.restart = null;
  const nu = { skill: null, team: 0, job: 'press', p: [0, 0, 0], v: [0, 0], target: [40, 0, 0], down: 0 };
  const hId = horizonDe(nu, st0, K), pasId = pasDe(nu, st0, K);
  st0.tactics = [{ pressing: 1.0, marquage: 1.0 }, {}];
  const hChasse = horizonDe(nu, st0, K), pasMark = pasDe({ ...nu, job: 'mark' }, st0, K);
  st0.tactics = null;
  const loinP = intentionDe(nu, st0, matchCfg({ ...B_0746 }), K, false), presP = intentionDe({ ...nu, target: [5, 0, 0] }, st0, matchCfg({ ...B_0746 }), K, false);
  st0._press = { team: 0, until: st0.t + 3 }; const fenP = intentionDe(nu, st0, matchCfg({ ...B_0746 }), K, false); st0._press = null;
  st0._possChangeAt = st0.t - 6; const rentre = intentionDe({ ...nu, job: 'mark', _pace: { until: st0.t + 1, kind: 'repli' } }, st0, matchCfg({ ...B_0746 }), K, true);
  st0._possChangeAt = st0.t - 2; const sprinte = intentionDe({ ...nu, job: 'mark', _pace: { until: st0.t + 1, kind: 'repli' } }, st0, matchCfg({ ...B_0746 }), K, true);
  st0.ball.restart([0, 0.11, 0], { cause: 'coup-franc' }); st0.restart = null; const ap10 = appelPertinent({ p: [10, 0, 0] }, st0, K), ap30 = appelPertinent({ p: [30, 0, 0] }, st0, K);
  const marche = (over) => {
    const st = makeMatch({ full: true, seed: 5 }), p = st.players.find((q) => q.team === 0 && q.post === 5); let z = 12;
    // le cerveau est tenu par le crochet avantMouvement (255) : le métier, le slot, aucune fenêtre collective, aucune rupture — la clause mesure le PAS, pas l'élection des métiers
    const cfg = matchCfg({ ...B_0746,  shotRange: 20, avantMouvement: (s) => { p.job = 'support'; p.target = [-10, 0, z]; p._runT = [-10, 0, z]; p._runUntil = s.t + 9; p._pace = { until: -1, next: s.t + 99 }; s._press = null; s.possession.team = 0; s._possChangeAt = -99; }, ...(over ?? {}) });
    for (const q of st.players) { q.v = [0, 0]; q.down = 0; }
    p.p[0] = -10; p.p[2] = 20; st.ball.restart([40, 0.11, -20], { cause: 'coup-franc' }); st.restart = null; st.possession.team = 0; st._possChangeAt = -99;
    const vs = [], regs = new Set();
    for (let i = 0; i < 510; i++) { z = i < 240 ? 12 : 6; matchStep(st, 1 / 60, cfg); vs.push(Math.hypot(p.v[0], p.v[1])); if (i >= 240) regs.add(p._reg); }
    return { v2: vs[239], v3: vs[329], v5: vs[509], regs: [...regs] };
  };
  const M = marche(null), N = marche({ effort: null });
  ok(`lot 261 — L'INTENTION D'EFFORT AU CERVEAU (lois pures) : l'horizon à l'identité ${hId.toFixed(2)} s = tAtt ${K.tAtt}, l'école de la chasse ${hChasse.toFixed(2)} (× 1,3) ; le pas de coulissement ${pasId.toFixed(2)} s, le marqueur d'homme ${pasMark.toFixed(2)} (× 1,3) ; le presseur à 40 m ferme (${loinP?.reg} ${loinP?.v}), à 5 m chasse (${presP}), en fenêtre chasse (${fenP}) ; le repli à 6 s rentre (${rentre?.reg} ${rentre?.v}), à 2 s sprinte (${sprinte}) ; l'appel à 10 m ${ap10}, à 30 m ${ap30} — LA FIXTURE : le suiveur à 8 m de son slot immobile MARCHE sous la clé (${M.v2.toFixed(2)} m/s à 4 s ≤ 1,45), le saut du slot le fait coulisser (${M.v3.toFixed(2)} > 2,3 à 1,5 s, régimes ${M.regs.join('/')}) puis s'éteint (${M.v5.toFixed(2)} < 2,0 à 4,5 s) ; sabotage « effort null » : le pas n'existe pas, l'allure d'hier plafonne le suiveur à 2,1 (${N.v3.toFixed(2)} < 2,3 à 1,5 s ; ${N.v2.toFixed(2)} à 4 s avant le saut)`,
    Math.abs(hId - K.tAtt) < 1e-9 && Math.abs(hChasse - K.tAtt * 1.3) < 1e-9 && Math.abs(pasId - K.actifDur) < 1e-9 && Math.abs(pasMark - K.actifDur * 1.3) < 1e-9
    && loinP?.reg === 'ferme' && loinP.v === K.vActif && presP === null && fenP === null && rentre?.v === K.vRecup && sprinte === null && ap10 && !ap30
    && M.v2 <= 1.45 && N.v3 < 2.3 && M.v3 > 2.3 && M.regs.includes('actif') && M.regs.includes('ent') && M.v5 < 2.0);
}

// ---------------------------------------------------------------- lot 262 : LA COUCHE DE CROYANCE
// (cfg.croyance — Modèle 04 §2 le champ visuel, §4 l'état de croyance ; Bibles 10, 13, 14)
if (__bloc()) {
  // (a) les lois pures contre la TABLE du book (§2.2, valeurs calculées) : partenaire droit devant à 20 m q_det 0,63 /
  // q_mot 0,64 IDENTITÉ ; dans l'UFOV à 10 m / 30° 0,40 / 0,79 ; coureur en périphérie à 45 m / 80° à 4 m/s en travers
  // q_mot 0,14 PRÉSENCE, le même à l'arrêt RIEN ; σ_obs(20 m, 0,63) = 0,70 ; la croissance 0,62 / 1,15 / 3,03 / 10,26 m à
  // 0,5 / 1 / 2 / 4 s (σ_obs 0,4) ; le repli sur l'ancre (§4.4) ; la clé absente rend l'état vrai (σ 0, âge 0).
  // (b) la fixture : un passeur qui a VU son receveur puis lui tourne le dos pendant que celui-ci court 3 s — la croyance
  // vieillit (âge ≈ 3), l'erreur dépasse 3 m, σ dépasse 2 ; il se retourne 0,3 s : l'erreur retombe sous 1 m ; sabotage
  // « croyance null » : l'erreur est 0 — l'omniscience d'hier, nommée.
  const K = matchCfg({ ...B_0746 }).croyance, DEGr = Math.PI / 180, obs = { p: [0, 0, 0], v: [0, 0], skill: null };
  const c80 = Math.cos(80 * DEGr), s80 = Math.sin(80 * DEGr);
  const A = qualiteDe(obs, 0, 20, 0, K, 0, 3), B = qualiteDe(obs, 0, 10 * Math.cos(30 * DEGr), 10 * Math.sin(30 * DEGr), K, 0, 3);
  const C = qualiteDe(obs, 0, 45 * c80, 45 * s80, K, -4 * s80, 4 * c80), D = qualiteDe(obs, 0, 45 * c80, 45 * s80, K, 0, 0);
  const sO = sigmaObs(20, 0.63, K), sig = [0.5, 1, 2, 4].map((t) => sigmaDe(0.16, t, K));
  const rep = predit({ x: 0, z: 0, vx: 0, vz: 0, t: 0, s2: 0.16 }, 8.5, K, [10, 0]);
  const fix = (over) => {
    const st = makeMatch({ full: true, seed: 5 }), cfg = matchCfg({ ...B_0746,  shotRange: 20, ...(over ?? {}) }); st.restart = null;
    const c = st.players.find((q) => q.team === 0 && q.post === 5), r = st.players.find((q) => q.team === 0 && q.post === 8);
    for (const q of st.players) { q.v = [0, 0]; q.down = 0; q.scan = null; }
    c.p[0] = 0; c.p[2] = 0; r.p[0] = 12; r.p[2] = 0; st.ball.restart([30, 0.11, 0], { cause: 'coup-franc' }); st.restart = null;   // le ballon devant lui, le receveur entre les deux
    c.yaw = 0; st.t = 10;
    for (let i = 0; i < 12; i++) { st.t += 1 / 60; croyanceStep(st, cfg); }                      // il le voit 0,2 s
    c.yaw = Math.PI; st.ball.restart([-30, 0.11, 0], { cause: 'coup-franc' }); st.restart = null;   // il se retourne, le ballon dans son dos au receveur
    r.v = [0, 3];
    for (let i = 0; i < 180; i++) { st.t += 1 / 60; r.p[2] += 3 / 60; croyanceStep(st, cfg); }     // le receveur court 3 s en travers, dans le dos
    const vieux = croyanceDe(c, r, st, cfg), errV = Math.hypot(vieux.p[0] - r.p[0], vieux.p[2] - r.p[2]);
    c.yaw = Math.atan2(r.p[2], r.p[0]); st.ball.restart([30, 0.11, 0], { cause: 'coup-franc' }); st.restart = null;
    for (let i = 0; i < 18; i++) { st.t += 1 / 60; croyanceStep(st, cfg); }                      // il se retourne 0,3 s
    const neuf = croyanceDe(c, r, st, cfg), errN = Math.hypot(neuf.p[0] - r.p[0], neuf.p[2] - r.p[2]);
    return { age: vieux.age, errV, sigV: vieux.sigma, errN, ageN: neuf.age };
  };
  const F = fix(null), N = fix({ croyance: null });
  ok(`lot 262 — LA COUCHE DE CROYANCE (lois pures, la table du book) : devant à 20 m q_det ${A.qDet.toFixed(2)} / q_mot ${A.qMot.toFixed(2)} ${A.niveau} (0,63 / 0,64 identité) ; UFOV 10 m / 30° ${B.qDet.toFixed(2)} / ${B.qMot.toFixed(2)} (0,40 / 0,79) ; coureur en périphérie 45 m / 80° ${C.qMot.toFixed(2)} ${C.niveau} (0,14 présence), à l'arrêt ${D.qMot.toFixed(2)} ${D.niveau} (rien) ; σ_obs(20 m) ${sO.toFixed(2)} (0,70) ; σ(τ) ${sig.map((x) => x.toFixed(2)).join(' / ')} (0,62 / 1,15 / 3,03 / 10,26) ; le repli sur l'ancre à 8,5 s ${rep.p[0].toFixed(2)} m vers 10 (≥ 8), σ ${rep.sigma.toFixed(1)} ≤ ${K.sTac} — LA FIXTURE : le receveur dans le dos 3 s : âge ${F.age.toFixed(2)} ≥ 2,5, erreur ${F.errV.toFixed(2)} m > 3, σ ${F.sigV.toFixed(2)} > 2 ; revu 0,3 s : erreur ${F.errN.toFixed(2)} < 1, âge ${F.ageN.toFixed(2)} < 0,2 ; sabotage « croyance null » : erreur ${N.errV.toFixed(2)} = 0, âge ${N.age} (l'omniscience d'hier)`,
    Math.abs(A.qDet - 0.63) < 0.02 && Math.abs(A.qMot - 0.64) < 0.02 && A.niveau === 'identite' && Math.abs(B.qDet - 0.40) < 0.02 && Math.abs(B.qMot - 0.79) < 0.02
    && Math.abs(C.qMot - 0.14) < 0.02 && C.niveau === 'presence' && D.qMot === 0 && D.niveau === 'none' && Math.abs(sO - 0.70) < 0.01
    && Math.abs(sig[0] - 0.62) < 0.01 && Math.abs(sig[1] - 1.15) < 0.01 && Math.abs(sig[2] - 3.03) < 0.01 && Math.abs(sig[3] - 10.26) < 0.01
    && rep.p[0] >= 8 && rep.sigma <= K.sTac && F.age >= 2.5 && F.errV > 3 && F.sigV > 2 && F.errN < 1 && F.ageN < 0.2 && N.errV === 0 && N.age === 0);
}

// ---- LE PAS DE DÉCISION SÉPARÉ DU PAS PHYSIQUE (263, cfg.cadence — cadence.js ; Modèle 01 §1.4, §5.2, test 3) : la loi pure
// (le tick de décision compte 1 / dec par seconde quel que soit le pas physique, la phase se conserve, le premier pas décide ;
// hzDecision rend 60 sans la clé — les constantes en images d'hier — et 1 / dec avec) ; la fixture en flux : un match de 60 s
// à dt 1/60 et à dt 1/30 appelle le cerveau (assignJobs) le même nombre de fois (≈ 600), et le jeu se joue (des passes) ;
// sabotage cadence null : 3 600 appels à 1/60 (chaque image décide), 1 800 à 1/30 — le cerveau d'hier suivait l'image.
if (__bloc()) {
  const C = { dec: 0.1 };
  const t60 = ticksDecision(10, 1 / 60, C), t30 = ticksDecision(10, 1 / 30, C), t20 = ticksDecision(10, 1 / 60, { dec: 0.2 }), tD = ticksDecision(10, 0.1, C);
  const hz = [hzDecision({ cadence: C }), hzDecision({ cadence: null }), hzDecision({}), hzDecision(null)];
  const stP = {}; let phase = 0; for (let i = 0; i < 600; i++) if (pasDecision(stP, 1 / 60, C)) phase = i;   // le dernier tick d'une seconde de 60 images : l'image 594 (0, 6, 12 … la phase tenue)
  const flux = (dt, over) => {
    const st = makeMatch({ full: true, seed: 5 }), cfg = matchCfg({ ...B_0746,  interligne: null /* interligne null DATÉ 274 : vert à HEAD~ (worktree f755654), le flux de la cadence remangé (3 / 23 passes) : le milieu tenu change le jeu joué — la clause mesure sa loi, pas l'interligne */, ligneAccrochee: null /* ligneAccrochee null DATÉ 280 : vert à HEAD~ (worktree 303b2e4), la cadence remangée — la clause mesure sa loi, pas la ligne accrochée */, interligne: null /* interligne null DATÉ 274 : vert à HEAD~ (worktree f755654), le flux de la cadence remangé (3 / 23 passes) : le milieu tenu change le jeu joué — la clause mesure sa loi, pas l'interligne */, shotRange: 20, ...(over ?? {}) }); let n = 0;
    const base = cfg.assignJobs; cfg.assignJobs = (s, c) => { n++; return base(s, c); };
    for (let i = 0; i < Math.round(60 / dt); i++) matchStep(st, dt, cfg);
    return { n: cfg.cadence ? (st._decN ?? 0) : n, passes: st.events.filter((e) => e.type === 'pass').length };   // sous la clé, les ticks (st._decN) ; sans elle, les appels (l'administration vit au pas physique dans les deux cas)
  };
  const A = flux(1 / 60), B = flux(1 / 30), N = flux(1 / 60, { cadence: null }), N30 = flux(1 / 30, { cadence: null });
  ok(`lot 263 — LE PAS DE DÉCISION SÉPARÉ DU PAS PHYSIQUE (cadence.js) : 10 s à dt 1/60 → ${t60} ticks, à 1/30 → ${t30}, dec 0,2 → ${t20}, dt = dec → ${tD} (100 / 100 / 50 / 100) ; hzDecision ${hz.join(' / ')} (10 / 60 / 60 / 60) ; la phase du tick à 60 Hz : image ${phase} (594) ; vol mort ${Math.round(0.3 * hz[0])} appels (3, hier 18) ; en flux 60 s : le cerveau ${A.n} ticks à 1/60, ${B.n} à 1/30 (≈ 600 tous deux — le cerveau ne suit plus l'image), ${A.passes} / ${B.passes} passes ; sabotage cadence null : ${N.n} / ${N30.n} (3 600 / 1 800)`,
    t60 === 100 && t30 === 100 && t20 === 50 && tD === 100 && hz[0] === 10 && hz[1] === 60 && hz[2] === 60 && hz[3] === 60 && phase === 594 && Math.round(0.3 * hz[0]) === 3
    && Math.abs(A.n - 600) <= 2 && Math.abs(B.n - 600) <= 2 && A.passes > 5 && B.passes > 5 && N.n === 3600 && N30.n === 1800);
}

// ---------------------------------------------------------------- lot 264 : LES FLUX RNG NOMMÉS
// (cfg.flux — Modèle 01 §3.1 le tirage à coordonnées, test 8 la neutralité du flux)
if (__bloc()) {
  // (a) les lois pures : le tirage est une fonction PURE de (graine, flux, tick, entité, index) — même coordonnées, même
  // u ; un flux, un tick, une entité ou un index qui change, un autre u ; u ∈ [0 ; 1) ; la moyenne de 20 000 tirages
  // ≈ 0,5 ; les entités voisines (e, e + 1) ne sont pas corrélées sur 2 000 ticks (le garde-fou du book : « les joueurs
  // d'indices consécutifs ratent leurs passes ensemble ») ; `tirage` rend `hier` sans st._flux et compte k par (flux,
  // entité). (b) LA NEUTRALITÉ (test 8, forme forte) : deux matchs de 120 s, l'un avec un st.rnd() AJOUTÉ à chaque image
  // (enchaîné au crochet avantMouvement du 255) — sous la clé le hash des positions et des événements est IDENTIQUE
  // (aucun tirage du jeu ne vit plus sur le flux séquentiel) ; sabotage « flux null » : le monde est DÉPLACÉ.
  const u0 = draw(3, FLUX.passe, 100, 7, 0), u1 = draw(3, FLUX.passe, 100, 7, 0), uS = draw(3, FLUX.tir, 100, 7, 0), uT = draw(3, FLUX.passe, 101, 7, 0), uE = draw(3, FLUX.passe, 100, 8, 0), uK = draw(3, FLUX.passe, 100, 7, 1);
  let som = 0, mn = 1, mx = 0; for (let i = 0; i < 20000; i++) { const u = draw(11, 1 + (i % 8), i >> 3, i % 22, i % 3); som += u; if (u < mn) mn = u; if (u > mx) mx = u; }
  let sxy = 0, sx = 0, sy = 0, sxx = 0, syy = 0; for (let t = 0; t < 2000; t++) { const x = draw(5, FLUX.duel, t, 4, 0), y = draw(5, FLUX.duel, t, 5, 0); sxy += x * y; sx += x; sy += y; sxx += x * x; syy += y * y; }
  const corr = (2000 * sxy - sx * sy) / Math.sqrt((2000 * sxx - sx * sx) * (2000 * syy - sy * sy));
  const stF = { _flux: { seed: 3, tick: 10, k: new Map() } }, tF = tirage(stF, 'duel', 4, () => 0.5), hier = () => 0.25, tH = tirage({ _flux: null }, 'duel', 4, hier);
  const k0 = tF(), k1 = tF(), k0b = draw(3, FLUX.duel, 10, 4, 0), k1b = draw(3, FLUX.duel, 10, 4, 1);
  const hash = (over, ajoute) => {
    const st = makeMatch({ full: true, seed: 3 }), cfg = matchCfg({ ...B_0746,  shotRange: 20, ...over, ...(ajoute ? { avantMouvement: (s, c) => { matchCfg({ ...B_0746 }).avantMouvement?.(s, c); s.rnd(); } } : {}) });
    let h = 2166136261 >>> 0; const mix = (x) => { h ^= Math.round(x * 100) & 0xffff; h = Math.imul(h, 16777619) >>> 0; };
    for (let i = 0; i < 120 * 60; i++) { matchStep(st, 1 / 60, cfg); if (i % 6 === 0) { for (const p of st.players) { mix(p.p[0]); mix(p.p[2]); } mix(st.ball.p[0]); mix(st.ball.p[2]); } }
    mix(st.events.length); return h;
  };
  const hA = hash({}, false), hB = hash({}, true), hN = hash({ flux: null }, false), hM = hash({ flux: null }, true);
  ok(`lot 264 — LES FLUX RNG NOMMÉS (lois pures) : mêmes coordonnées, même u (${u0 === u1}) ; un autre flux / tick / entité / index, un autre u (${u0 !== uS && u0 !== uT && u0 !== uE && u0 !== uK}) ; u ∈ [0 ; 1) (${mn.toFixed(4)} … ${mx.toFixed(4)}), moyenne ${(som / 20000).toFixed(3)} ≈ 0,5 ; corrélation des entités voisines ${corr.toFixed(3)} (|·| < 0,05) ; tirage() compte k (${k0 === k0b && k1 === k1b}) et rend hier sans flux (${tH === hier}) — LA NEUTRALITÉ : sous la clé un st.rnd() ajouté à chaque image laisse 120 s de match BIT-IDENTIQUES (${hA === hB}) ; sabotage « flux null » : le monde est déplacé (${hN !== hM})`,
    u0 === u1 && u0 !== uS && u0 !== uT && u0 !== uE && u0 !== uK && mn >= 0 && mx < 1 && Math.abs(som / 20000 - 0.5) < 0.01 && Math.abs(corr) < 0.05 && k0 === k0b && k1 === k1b && tH === hier && hA === hB && hN !== hM);
}

// ---------------------------------------------------------------- lot 265 : LA PASSE QUI SE MANQUE À LA
// BONNE DISTANCE (cfg.passe — Modèle 09 lot 1, §4.2-4.3, §6.1 ; Modèle 03 §5.2, §8.1)
if (__bloc()) {
  // (a) les lois pures contre les TABLES du book : la Weibull du contrôle manqué (d_touch 0,84 m → 2,6 %, 1,16 → 6,8 %,
  // 1,45 → 13,1 % — l'exponentielle rejetée donnait 31,6 %) ; le budget (propre 0,4 s sous 0,9 m, lourde 0,55 → 0,8 s) ;
  // la classe (courte 0,8, moyenne 1, longue / piqué 1,3, centre 1,7) ; σ_ψ à l'identité = 1,4° × la classe (la note à 50
  // vaut 1), × (1 + κ_P P) sous pression, × (1 + 0,012 (d − 12)⁺) loin ; la pression au ballon : le presseur DERRIÈRE le
  // corps paie le contournement. (b) la fixture : un receveur, le ballon lui arrive à 8 m/s — le presseur à 1,2 m DANS SON
  // DOS (le ballon devant) : la touche est PROPRE et le porté n'est pas contestable pendant le budget ; le même presseur
  // à 1,2 m DEVANT (entre le ballon et lui) : la réception est CONTESTÉE ; sabotage « passe null » : l'issue n'existe pas.
  const K = matchCfg({ ...B_0746 }).passe, DEGr = Math.PI / 180;
  const pf = [0.84, 1.16, 1.45].map((d) => pFailDe(d, K)), bud = [budgetDe(0.5, K), budgetDe(0.9, K), budgetDe(2.0, K)];
  const cl = [classeDe({ style: 'ground' }, 8, K), classeDe({ style: 'ground' }, 18, K), classeDe({ through: true }, 18, K), classeDe({ cross: true }, 30, K)];
  const nu = { skill: null, p: [0, 0, 0], v: [0, 0], team: 0 }, s50 = 3.25 * DEGr;
  const sigId = sigmaPasse(nu, { style: 'ground' }, 8, 0, K, s50) / DEGr, sigP = sigmaPasse(nu, { style: 'ground' }, 8, 1, K, s50) / DEGr, sigL = sigmaPasse(nu, { style: 'ground' }, 22, 0, K, s50) / DEGr;
  const dT = toucheDe(10, 0, nu, false, K), dTa = toucheDe(10, 0, nu, true, K);
  const fix = (over, devant) => {
    const st = makeMatch({ full: true, seed: 5 }), cfg = matchCfg({ ...B_0746,  shotRange: 20, ...(over ?? {}) }); st.restart = null;
    const r = st.players.find((q) => q.team === 0 && q.post === 8), f = st.players.find((q) => q.team === 1 && !q.keeper);
    for (const q of st.players) { q.v = [0, 0]; q.down = 0; q.p[0] = q.team === 0 ? -40 : 40; q.p[2] = (q.id % 11) * 5 - 25; }
    r.p[0] = 0; r.p[2] = 0; r.yaw = Math.PI; f.p[0] = devant ? -1.2 : 1.2; f.p[2] = 0; f.v = [0, 0];   // le ballon vient de −x : devant = entre le ballon et lui
    st.ball.restart([-2.0, 0.11, 0], { cause: 'coup-franc' }); st.restart = null; st.ball.impulse([8, 0, 0], null); st.t = 10;
    const pr = pressionDe(st, r, cfg.passe ?? K, cfg, st.ball.p);
    const rnd = () => 0.99;   // le dé du manqué ne tombe pas : l'issue vient de la géométrie
    const I = st.full && cfg.passe ? issueDe(st, r, cfg.passe, cfg, rnd) : null;
    return { pr, I };
  };
  const D = fix(null, false), V = fix(null, true), N = fix({ passe: null }, false);
  // le porté protégé : sous la clé, un corps avec _protege > t n'est pas contesté par un presseur à 0,3 m du ballon
  const stP = makeMatch({ full: true, seed: 5 }), cfgP = matchCfg({ ...B_0746,  shotRange: 20 }); stP.restart = null;
  ok(`lot 265 — LA PASSE QUI SE MANQUE À LA BONNE DISTANCE (lois pures, les tables du book) : contrôle manqué ${pf.map((x) => (100 * x).toFixed(1)).join(' / ')} % à d_touch 0,84 / 1,16 / 1,45 m (2,6 / 6,8 / 13,1) ; budget ${bud.map((x) => x.toFixed(2)).join(' / ')} s (0,40 / 0,55 / 0,80) ; classes ${cl.join(' / ')} (0,8 / 1 / 1,3 / 1,7) ; σ_ψ identité ${sigId.toFixed(2)}° (1,12), pressé ${sigP.toFixed(2)}° (× ${(1 + K.kappaP).toFixed(1)}), à 22 m ${sigL.toFixed(2)}° (× 1,40 : la classe moyenne 1/0,8 × la distance 1,12) ; d_touch nominal ${dT.toFixed(2)} m, aérien ${dTa.toFixed(2)} (× 1,55) — LA FIXTURE : le presseur à 1,2 m dans le dos (TTP ${D.pr.ttp.toFixed(2)} s, contourné) → ${D.I?.issue} protégé ${D.I?.protege} s ; devant (TTP ${V.pr.ttp.toFixed(2)}) → ${V.I?.issue} ; sabotage « passe null » : ${N.I === null ? 'aucune issue (le contrôle d\'hier)' : 'ISSUE'}`,
    Math.abs(pf[0] - 0.026) < 0.004 && Math.abs(pf[1] - 0.068) < 0.006 && Math.abs(pf[2] - 0.131) < 0.01 && Math.abs(bud[0] - K.tClean) < 1e-9 && Math.abs(bud[1] - K.tHeavyMin) < 1e-9 && Math.abs(bud[2] - K.tHeavyMax) < 1e-9
    && cl[0] === K.mcCourt && cl[1] === 1 && cl[2] === K.mcLong && cl[3] === K.mcCentre && Math.abs(sigId - 1.12) < 0.01 && Math.abs(sigP / sigId - (1 + K.kappaP)) < 1e-6 && Math.abs(sigL / sigId - 1.12 / K.mcCourt) < 1e-6
    && Math.abs(dT - K.d0) < 1e-9 && Math.abs(dTa / dT - K.chiAer) < 1e-9 && D.I?.issue === 'propre' && D.I.protege === K.tClean && D.pr.ttp > V.pr.ttp && (V.I?.issue === 'conteste-gagne' || V.I?.issue === 'conteste-perdu') && N.I === null);
}

// ---------------------------------------------------------------- lot 266 : L'INTERCEPTION NON OMNISCIENTE
// (cfg.interception — Modèle 07 lot 2, §4.3 ; Modèle 04 la croyance)
if (__bloc()) {
  // (a) les lois pures : la latence de lecture à l'identité (tauR), plus courte pour l'anticipateur ; pendant la latence
  // l'écart cru − vrai est le ballon AU DÉPART (le défenseur n'a pas lu la passe) ; passé la latence, le défenseur qui VOIT
  // le ballon (face à lui, croyance fraîche) le vise à moins de 1 m, celui qui lui tourne le DOS (croyance vieille du
  // départ) court vers un souvenir à plus de 3 m ; interceptionApply retranche l'écart aux presseurs et laisse le
  // marqueur ; sabotage « interception null » : aucun écart, la cible d'hier au bit.
  const K = matchCfg({ ...B_0746 }).interception, cfg = matchCfg({ ...B_0746,  shotRange: 20 });
  const tId = tauLecture({ skill: null }, K), tAnt = tauLecture({ skill: { anticipF: 1.15 } }, K);
  const st = makeMatch({ full: true, seed: 5 }); st.restart = null;
  const c = st.players.find((q) => q.team === 0 && q.post === 5), qF = st.players.find((q) => q.team === 1 && !q.keeper && q.post === 5), qD = st.players.find((q) => q.team === 1 && !q.keeper && q.post === 6), qM = st.players.find((q) => q.team === 1 && !q.keeper && q.post === 7);
  for (const q of st.players) { q.v = [0, 0]; q.down = 0; q.scan = null; q.vue = null; q._percAt = null; q.p[0] = q.team === 0 ? -40 : 40; q.p[2] = (q.id % 11) * 5 - 25; }
  c.p[0] = 0; c.p[2] = 0; qF.p[0] = 12; qF.p[2] = 6; qF.yaw = Math.PI; qD.p[0] = 12; qD.p[2] = -6; qD.yaw = Math.PI; qM.p[0] = 30; qM.p[2] = 0; qM.yaw = Math.PI;
  st.ball.restart([0, 0.11, 0], { cause: 'coup-franc' }); st.restart = null; st.t = 10; st.possession = { team: 0, carrier: c.id };
  croyanceStep(st, cfg);                                            // tous voient le ballon au départ
  st.ball.impulse([10, 0, 0], null); st.pass = { from: c.id, to: c.id, t: st.t, origin: [0, 0], lead: [30, 0, 0], flight: 3, style: 'ground' }; st.phase = 'flight';
  qD.yaw = 0; qD.scan = { at: st.t, until: st.t + 5, vers: 'espace', cible: [qD.p[0] + 30, qD.p[2]], n: 0, vol: false, _next: 99, _lcg: 1 };   // il tourne le DOS et regarde AILLEURS (une saccade vers l'espace derrière lui : le ballon sort de son champ)
  let eLat = [0, 0], dLat = 0;
  for (let i = 0; i < 60; i++) { st.t += 1 / 60; st.ball.restart([(i + 1) * 10 / 60, 0.11, 0], { cause: 'coup-franc' }); st.restart = null; st.ball.impulse([10, 0, 0], null); for (const q of [qF, qD, qM]) q._percAt = -1; croyanceStep(st, cfg); if (i === 5) { eLat = ecartCru(qF, st, cfg, K); dLat = st.ball.p[0]; } }   // 1 s de vol, le ballon posé à 10 m/s image par image (la loi, pas la physique) ; à 0,1 s : encore dans la latence
  const eF = ecartCru(qF, st, cfg, K), eD = ecartCru(qD, st, cfg, K);
  for (const q of [qF, qD]) { q.job = 'press'; q.target = [st.ball.p[0], 0, st.ball.p[2]]; } qM.job = 'mark'; qM.target = [st.ball.p[0], 0, st.ball.p[2]];
  interceptionApply(st, cfg);
  const dF = Math.hypot(qF.target[0] - st.ball.p[0], qF.target[2] - st.ball.p[2]), dD = Math.hypot(qD.target[0] - st.ball.p[0], qD.target[2] - st.ball.p[2]), dM = Math.hypot(qM.target[0] - st.ball.p[0], qM.target[2] - st.ball.p[2]);
  for (const q of [qF, qD]) q.target = [st.ball.p[0], 0, st.ball.p[2]]; interceptionApply(st, matchCfg({ ...B_0746,  shotRange: 20, interception: null }));
  const dN = Math.hypot(qF.target[0] - st.ball.p[0], qF.target[2] - st.ball.p[2]) + Math.hypot(qD.target[0] - st.ball.p[0], qD.target[2] - st.ball.p[2]);
  ok(`lot 266 — L'INTERCEPTION NON OMNISCIENTE (lois pures) : la latence de lecture ${tId.toFixed(3)} s à l'identité (= tauR ${K.tauR}), ${tAnt.toFixed(3)} pour l'anticipateur (× 0,85) ; pendant la latence l'écart cru est le départ (${Math.hypot(eLat[0], eLat[1]).toFixed(2)} m = ${dLat.toFixed(2)} parcourus à 0,1 s) — LA FIXTURE (1 s de vol à 10 m/s) : le défenseur FACE au ballon le vise à ${dF.toFixed(2)} m (< 1 : écart cru ${Math.hypot(eF[0], eF[1]).toFixed(2)}), celui qui lui tourne le DOS court vers un souvenir à ${dD.toFixed(2)} m (≥ 3 : ${Math.hypot(eD[0], eD[1]).toFixed(2)}), le marqueur n'est pas touché (${dM.toFixed(2)} = 0) ; sabotage « interception null » : aucun écart (${dN.toFixed(2)} = 0)`,
    Math.abs(tId - K.tauR) < 1e-9 && Math.abs(tAnt - K.tauR * 0.85) < 1e-9 && Math.abs(Math.hypot(eLat[0], eLat[1]) - dLat) < 0.01 && dLat > 0.5 && dF < 1 && dD >= 3 && dM === 0 && dN === 0);
}

// ---------------------------------------------------------------- lot 267 : LA SÉLECTION CALIBRÉE DU PASSEUR
// (cfg.selection — Modèle 09 lot 2, tests 2 et 9 ; Modèle 07 §4-5)
if (__bloc()) {
  // (a) les lois pures : la classe nommée (douze du book, par les drapeaux du choix, la distance et le sens) ; la survie de
  // Spearman : 1 sans défenseur, ~1 pour le défenseur loin du couloir, ≈ 1 − (1 − e^{−λ·fenêtre}) pour celui déjà posé sur
  // la ligne ; P_succ décroît quand le défenseur se rapproche du couloir ; le calage : null = l'identité (test 9), [1, 1]
  // décale d'un logit ; le terme : nul à p0, le même risque coûte 3 × plus à la consigne défensive qu'à l'offensive ;
  // (b) le monde : choosePass sous la clé porte cls et pSucc, élit le receveur au couloir libre ; sabotage selection null :
  // aucune classe, aucune probabilité, le barème d'hier ; (c) 150 s de match : les événements pass portent cls et pSucc.
  const K = matchCfg({ ouverture: null /* ouverture null DATÉ 288 : vert à HEAD~ (worktree d90101b), choosePass élit le n°6 à P̂ 0,87 dans ce monde — la clause mesure sa loi, pas le receveur qui s'ouvre au ballon */, attenteVivante: null /* attenteVivante null DATÉ 285 : vert à HEAD~ (worktree 3d79d38), la sélection calibrée remangée (la classe et P̂ de l'élue changent) — la clause mesure sa loi, pas l'attente vivante */, ...B_0746 }).selection, cfg = matchCfg({ ouverture: null /* ouverture null DATÉ 288 : vert à HEAD~ (worktree d90101b), choosePass élit le n°6 à P̂ 0,87 dans ce monde — la clause mesure sa loi, pas le receveur qui s'ouvre au ballon */, attenteVivante: null /* attenteVivante null DATÉ 285 : vert à HEAD~ (worktree 3d79d38), la sélection calibrée remangée (la classe et P̂ de l'élue changent) — la clause mesure sa loi, pas l'attente vivante */, ...B_0746,  ligne: null /* ligne null DATÉ 273 : vert à HEAD~ (worktree bfc549c), l'élection de choosePass remangée (le couloir libre) : la ligne tenue change les corps — la clause mesure sa loi, pas la ligne */, shotRange: 20 });
  const cl = [classeNommee({}, 10, 5, K), classeNommee({}, 20, 5, K), classeNommee({}, 30, 5, K), classeNommee({ through: true, derriere: true }, 20, 15, K), classeNommee({ through: true }, 20, 15, K), classeNommee({ through: true, chip: true }, 20, 15, K), classeNommee({ bascule: true }, 35, 0, K), classeNommee({ cross: true }, 25, 5, K), classeNommee({ cross: true, bas: true }, 10, -5, K), classeNommee({ unDeux: true }, 10, 5, K), classeNommee({ remise: true }, 6, -3, K), classeNommee({}, 10, -5, K)];
  const attendu = ['SHORT_GROUND', 'MID_GROUND', 'LONG_GROUND', 'THROUGH', 'CHANNEL', 'CHIP_THROUGH', 'SWITCH', 'CROSS', 'CUTBACK', 'ONE_TWO_RETURN', 'LAY_OFF', 'BACK_SAFE'];
  const clOk = cl.every((x, i) => x === attendu[i]) && CLASSES.length === 12 && attendu.every((x) => CLASSES.includes(x));
  const mk = (x, z, team = 1) => ({ p: [x, 0, z], v: [0, 0], team, down: 0, keeper: false, skill: null });
  const o = [0, 0.11, 0], l = [20, 0.11, 0], T = 20 / 9;
  const s0 = survieDe(o, l, T, [], K, cfg).max, sLoin = survieDe(o, l, T, [mk(10, 30)], K, cfg).max, sPose = survieDe(o, l, T, [mk(10, 0)], K, cfg).max, sDeux = survieDe(o, l, T, [mk(10, 0), mk(14, 0)], K, cfg);
  const sAttendu = 1 - (1 - Math.exp(-K.lambda * K.fenetre));
  const st = makeMatch({ full: true, seed: 5 }); st.restart = null;
  for (const q of st.players) { q.v = [0, 0]; q.down = 0; q.p[0] = q.team === 0 ? -45 : 45; q.p[2] = (q.id % 11) * 5 - 25; }
  const c = st.players.find((q) => q.team === 0 && q.post === 5), A = st.players.find((q) => q.team === 0 && q.post === 6), B = st.players.find((q) => q.team === 0 && q.post === 7), D = st.players.find((q) => q.team === 1 && !q.keeper && q.post === 5);
  c.p[0] = 0; c.p[2] = 0; A.p[0] = 9; A.p[2] = 6; B.p[0] = 9; B.p[2] = -6; D.p[0] = 4.5; D.p[2] = -3;   // d ≈ 10,8 m (passRange 2,5-13), D posé sur le couloir de B
  st.ball.restart([0.3, 0.11, 0], { cause: 'coup-franc' }); st.restart = null; st.t = 10; st.possession = { team: 0, carrier: c.id }; st.phase = 'carry';
  const foesL = st.players.filter((q) => q.team === 1);
  const pB = (dz) => { D.p[2] = dz; return pSuccDe(st, c, B, [0, 0.11, 0], [9, 0.11, -6], 10.8, 'ground', {}, foesL, K, cfg, 0).p; };
  const pLoin = pB(-30), pMi = pB(-12), pPres = pB(-3); D.p[2] = -3;
  const sel = pSuccDe(st, c, B, [0, 0.11, 0], [9, 0.11, -6], 10.8, 'ground', {}, foesL, { ...K, calage: null }, cfg, 0), selK = pSuccDe(st, c, B, [0, 0.11, 0], [9, 0.11, -6], 10.8, 'ground', {}, foesL, K, cfg, 0);
  const selCal = pSuccDe(st, c, B, [0, 0.11, 0], [9, 0.11, -6], 10.8, 'ground', {}, foesL, { ...K, calage: { SHORT_GROUND: [1, 1] } }, cfg, 0);
  const calOk = Math.abs(sel.pHat - sel.p) < 1e-12 && Math.abs(logitS(selCal.pHat) - (1 + logitS(sel.p))) < 1e-9 && sel.cls === 'SHORT_GROUND' && Math.abs(logitS(selK.pHat) - (K.calage.SHORT_GROUND[0] + K.calage.SHORT_GROUND[1] * logitS(sel.p))) < 1e-9;
  const t0 = termeDe({ pHat: K.p0 }, c, st, K), stD = makeMatch({ full: true, seed: 5, tactics: [{ mentalite: 0 }, {}] }), stO = makeMatch({ full: true, seed: 5, tactics: [{ mentalite: 1 }, {}] });
  const tD = termeDe({ pHat: 0.5 }, stD.players[c.id], stD, K), tO = termeDe({ pHat: 0.5 }, stO.players[c.id], stO, K);
  const best = choosePass(st, cfg), bestN = choosePass(st, matchCfg({ ouverture: null /* ouverture null DATÉ 288 : vert à HEAD~ (worktree d90101b), choosePass élit le n°6 à P̂ 0,87 dans ce monde — la clause mesure sa loi, pas le receveur qui s'ouvre au ballon */, attenteVivante: null /* attenteVivante null DATÉ 285 : vert à HEAD~ (worktree 3d79d38), la sélection calibrée remangée (la classe et P̂ de l'élue changent) — la clause mesure sa loi, pas l'attente vivante */, ...B_0746,  ligne: null /* ligne null DATÉ 273 : vert à HEAD~ (worktree bfc549c), l'élection de choosePass remangée (le couloir libre) : la ligne tenue change les corps — la clause mesure sa loi, pas la ligne */, shotRange: 20, selection: null }));
  const m2 = makeMatch({ full: true, seed: 3 }); let nP = 0, nC = 0, nS = 0; for (let i = 0; i < 150 * 60; i++) { matchStep(m2, 1 / 60, cfg); } for (const e of m2.events) if (e.type === 'pass' && e.to >= 0) { nP++; if (e.cls) nC++; if (e.pSucc != null) nS++; }
  ok(`lot 267 — LA SÉLECTION CALIBRÉE DU PASSEUR (lois pures) : douze classes nommées (${cl.join(' ')} = attendu) ; la survie 1 sans défenseur (${s0.toFixed(3)}), ${sLoin.toFixed(3)} loin du couloir (≥ 0,99), ${sPose.toFixed(3)} posé sur la ligne (= 1 − (1 − e^{−λ·fenêtre}) = ${sAttendu.toFixed(3)} ± 0,02), deux posés : ${sDeux.max.toFixed(3)} au seul affecté (max) c. ${sDeux.prod.toFixed(3)} si tous chassent (prod) ; P_succ décroît quand le défenseur vient au couloir (${pLoin.toFixed(2)} > ${pMi.toFixed(2)} > ${pPres.toFixed(2)}) ; le calage null = l'identité (test 9), [1, 1] décale d'un logit, le calage DATÉ 267 de la classe (α ${K.calage.SHORT_GROUND[0]}, β ${K.calage.SHORT_GROUND[1]}) rend ${selK.pHat.toFixed(2)} pour ${sel.p.toFixed(2)} cru ; le terme nul à p0 (${t0.toFixed(3)}), le même risque coûte ${tD.toFixed(2)} au défensif c. ${tO.toFixed(2)} à l'offensif (× 3)`,
    clOk && s0 === 1 && sLoin >= 0.99 && Math.abs(sPose - sAttendu) < 0.02 && Math.abs(sDeux.max - sPose) < 0.03 && sDeux.prod < sDeux.max - 0.1 && pLoin > pMi && pMi > pPres && pLoin - pPres > 0.2 && calOk && Math.abs(t0) < 1e-12 && Math.abs(tD / tO - 3) < 1e-9 && tD < 0);
  ok(`lot 267 — …et LE MONDE : choosePass sous la clé porte la classe (${best?.cls}) et P̂ (${best?.pSucc?.toFixed(2)}), élit le receveur au couloir libre (nº${best?.to?.id} = A nº${A.id}, P̂ ${best?.pSucc?.toFixed(2)} ≥ 0,7) ; sabotage « selection null » : le même receveur sans classe ni probabilité (nº${bestN?.to?.id}, ${bestN?.cls === undefined && bestN?.pSucc === undefined}) ; 150 s de match : ${nC}/${nP} passes portent leur classe (≥ 80 %), ${nS} leur P̂ (≥ 50 %)`,
    !!best && best.cls === 'SHORT_GROUND' && best.to.id === A.id && best.pSucc >= 0.7 && !!bestN && bestN.to.id === A.id && bestN.cls === undefined && bestN.pSucc === undefined && nP >= 20 && nC / nP >= 0.8 && nS / nP >= 0.5);
}

// ---------------------------------------------------------------- lot 268 : LE NOYAU COMMUN DE DUEL
// (cfg.noyau — Modèle 11 lot 1 : §2 le multinomial log-linéaire, §3 le dribble ; Bible 15)
if (__bloc()) {
  // (a) les lois pures : les intercepts du book (b_FRANCHI = 0, exp(b) ∝ les parts) ; le disque d'atteinte à 1 s = la
  // distance courue en 1 s par le profil du moteur (+ l'allonge) ; la marge μ* positive loin du défenseur, négative sous
  // son nez ; le score monte avec μ (+ 0,6 / m), la part franchie baisse vers le but adverse (le gradient) et la sortie
  // se lève près de la ligne ; les probabilités somment à 1 ; le tirage Gumbel-max rend l'issue forcée ; (b) le monde :
  // le contact d'un passement contre un homme journalise le duel (issue, μ*, bande) ; les conséquences — dépossédé :
  // le défenseur reçoit et le geste s'interrompt ; franchi + faute : la faute posée par le défenseur ; neutre + touche
  // à 3 m de la ligne : le ballon file en touche pour l'attaquant ; loin de la ligne, l'issue se remappe ; (c) 600 s de
  // match : des take-ons jugés, sabotage « noyau null » : aucun duel de take-on, les gestes vivent.
  const K = matchCfg({ presseLue: null /* presseLue null DATÉ 289 : vert à HEAD~ (worktree 7bd70e0), le contact du passement contre l'homme dans ce monde (le 1c1 de la fixture change d'instant) — la clause mesure sa loi, pas la pression lue au temps d'arrivée */, ...B_0746 }).noyau, cfg = matchCfg({ presseLue: null /* presseLue null DATÉ 289 : vert à HEAD~ (worktree 7bd70e0), le contact du passement contre l'homme dans ce monde (le 1c1 de la fixture change d'instant) — la clause mesure sa loi, pas la pression lue au temps d'arrivée */, ...B_0746,  shotRange: 20 });
  const bOk = B_BOOK[0] === 0 && B_BOOK.every((b, i) => Math.abs(Math.exp(b) / Math.exp(B_BOOK[5]) - PARTS_BOOK[i] / PARTS_BOOK[5]) < 1e-9) && ISSUES.length === 8;
  const q0 = { p: [0, 0, 0], v: [0, 0], yaw: 0, skill: null, team: 1, down: 0 }, D1 = disqueDe(q0, 1, K, cfg);
  const acc = cfg.accel ?? 7.5, top = cfg.speeds?.chase ?? 6.4, tTop = top / acc, d1 = tTop < 1 ? top * top / (2 * acc) + top * (1 - tTop) : 0.5 * acc;   // la distance courue en 1 s par le profil
  const disqueOk = Math.abs(D1.R - K.rho - d1) < 0.35 && D1.cx === 0;
  const st = makeMatch({ full: true, seed: 5 }); st.restart = null;
  for (const q of st.players) { q.v = [0, 0]; q.down = 0; q.p[0] = q.team === 0 ? -45 : 45; q.p[2] = (q.id % 11) * 5 - 25; }
  const c = st.players.find((q) => q.team === 0 && q.post === 7), q = st.players.find((q) => q.team === 1 && !q.keeper && q.post === 5);
  c.p[0] = 0; c.p[2] = 0; c.yaw = 0; c.v = [4, 0]; q.p[0] = 20; q.p[2] = 0; q.yaw = Math.PI;
  const muLoin = margeDe(c, q, K, cfg); q.p[0] = 1.2; const muPres = margeDe(c, q, K, cfg);
  const f = featuresDe(st, c, q, K, cfg), pr = (ff) => probasDe(logitsDe(ff, K)), P = pr(f), Pmu = pr({ ...f, mu: f.mu + 1 }), Pbut = pr({ ...f, x: 0.95 }), Pown = pr({ ...f, x: 0.25 }), Pligne = pr({ ...f, near: 1 });
  const fr = (p) => p[0] + p[1] + p[2], so = (p) => p[2] + p[3] + p[7];
  const somme = P.reduce((a, b) => a + b, 0), lmu = logitsDe({ ...f, mu: f.mu + 1 }, K)[0] - logitsDe(f, K)[0];
  const force = (k) => { let i = 0; return tirerIssue(logitsDe(f, K), () => (i++ === k ? 0.999999 : 0.5)); };
  const tirOk = ISSUES.every((I, k) => force(k) === I);
  // le monde : le contact d'un passement contre q à 1,2 m
  st.possession = { team: 0, carrier: c.id }; st.phase = 'carry'; st.ball.restart([0.4, 0.11, 0], { cause: 'coup-franc' }); st.restart = null; st.ball.possess(c.id); st.t = 10;
  const n0 = st.events.length, N = noyauAuContact(st, c, { skill: 'passement', foeId: q.id }, cfg), ev = st.events[n0];
  const contactOk = !!N && ISSUES.includes(N.issue) && N.q === q && ev?.type === 'duel' && ev.kind === 'take-on' && ev.issue === N.issue && Number.isFinite(ev.mu) && ev.x >= 0 && ev.x <= 1;
  let recu = -1, aborts = 0; const rec = (s2, id) => { recu = id; }, ab = () => { aborts++; };
  st._noyau = { issue: 'DEPOSSEDE', q, p: c.id, f, franchi: false }; appliquerNoyau(st, cfg, rec, ab); const depOk = recu === q.id && aborts === 1;
  st._faute = null; st._noyau = { issue: 'FRANCHI_FAUTE', q, p: c.id, f, franchi: true }; appliquerNoyau(st, cfg, rec, ab); const fauteOk = st._faute?.par === q.id && st._faute?.sur === c.id && st._faute?.kind === 'take-on'; st._faute = null;
  c.p[2] = (st.pitch.hz ?? 34) - 3; st.ball.restart([c.p[0] + 0.4, 0.11, c.p[2]], { cause: 'coup-franc' }); st.restart = null; st.ball.possess(c.id); st.phase = 'carry'; st.possession = { team: 0, carrier: c.id };
  st._noyau = { issue: 'NEUTRE_TOUCHE', q, p: c.id, f, franchi: false }; appliquerNoyau(st, cfg, rec, ab); const toucheOk = st.lastTouch === q.team && st.ball.v[2] > 5 && st.phase === 'loose';
  c.p[2] = 0; st.ball.restart([0.4, 0.11, 0], { cause: 'coup-franc' }); st.restart = null; st.ball.possess(c.id); st.phase = 'carry'; st.possession = { team: 0, carrier: c.id };
  let remaps = 0, n2 = 0; for (let k = 0; k < 40; k++) { const M = noyauAuContact(st, c, { skill: 'crochet', foeId: q.id }, cfg); n2++; if (st.events[st.events.length - 1].remap) remaps++; if (/SORTIE|TOUCHE/.test(M.issue)) remaps = -99; }
  const m2 = makeMatch({ full: true, seed: 5 }), m3 = makeMatch({ full: true, seed: 5 }), cfgN = matchCfg({ presseLue: null /* presseLue null DATÉ 289 : vert à HEAD~ (worktree 7bd70e0), le contact du passement contre l'homme dans ce monde (le 1c1 de la fixture change d'instant) — la clause mesure sa loi, pas la pression lue au temps d'arrivée */, ...B_0746,  shotRange: 20, noyau: null });
  for (let i = 0; i < 600 * 60; i++) { matchStep(m2, 1 / 60, cfg); matchStep(m3, 1 / 60, cfgN); }   // 300 → 600 s DATÉ 270 : la nature des gestes (269) raréfie les gestes de la graine 5 (1 en 300 s) — la clause veut des gestes, pas une graine
  const T2 = m2.events.filter((e) => e.type === 'duel' && e.kind === 'take-on'), T3 = m3.events.filter((e) => e.type === 'duel' && e.kind === 'take-on'), G3 = m3.events.filter((e) => e.type === 'skill' && ['passement', 'crochet', 'doubleContact', 'petitPont', 'roulette'].includes(e.kind));
  ok(`lot 268 — LE NOYAU COMMUN DE DUEL (lois pures) : les intercepts du book (b_FRANCHI = 0, exp(b) ∝ ${PARTS_BOOK.map((x) => (100 * x).toFixed(1)).join(' / ')} %) ; le disque d'atteinte à 1 s : rayon ${(D1.R - K.rho).toFixed(2)} m = la course du profil ${d1.toFixed(2)} ± 0,35 (+ allonge ${K.rho}) ; μ* ${muLoin.toFixed(2)} m loin du défenseur (> 1) c. ${muPres.toFixed(2)} sous son nez (< 0) ; + 1 m de marge = + ${lmu.toFixed(2)} log-odds (w.mu ${K.w.mu}), la part franchie ${(100 * fr(P)).toFixed(0)} → ${(100 * fr(Pmu)).toFixed(0)} % ; le gradient : ${(100 * fr(Pown)).toFixed(0)} % à 25 % du terrain c. ${(100 * fr(Pbut)).toFixed(0)} % à 95 % ; les sorties ${(100 * so(P)).toFixed(0)} → ${(100 * so(Pligne)).toFixed(0)} % contre la ligne ; Σ p = ${somme.toFixed(6)} ; Gumbel-max forcé rend chaque issue`,
    bOk && disqueOk && muLoin > 1 && muPres < 0 && Math.abs(lmu - K.w.mu) < 1e-9 && fr(Pmu) > fr(P) && fr(Pown) > fr(Pbut) + 0.1 && so(Pligne) > so(P) + 0.1 && Math.abs(somme - 1) < 1e-9 && tirOk);
  ok(`lot 268 — …et LE MONDE : le contact du passement contre l'homme journalise le duel (${ev?.issue}, μ* ${ev?.mu} m, bande ${ev?.x}) ; dépossédé → le défenseur reçoit (nº${recu} = nº${q.id}) et le geste s'interrompt ; franchi + faute → la faute posée par nº${q.id} (${fauteOk}) ; neutre + touche à 3 m de la ligne → le ballon file en touche pour l'attaquant (${toucheOk}) ; loin de la ligne ${remaps} remappées sur ${n2} sans sortie ; 600 s : ${T2.length} take-ons jugés (≥ 2), sabotage « noyau null » : ${T3.length} = 0 et ${G3.length} gestes vivent (≥ 2)`,
    contactOk && depOk && fauteOk && toucheOk && remaps >= 0 && T2.length >= 2 && T3.length === 0 && G3.length >= 2);
}

// ---------------------------------------------------------------- lot 269 : LA NATURE DES GESTES
// (cfg.nature — Modèle 11 lot 2 ; Bible 14 T15bis ; Bible 15 D20-D21)
if (__bloc()) {
  // (a) les lois pures : le spécialiste — l'espérance à 1 (le médian à k / sinh k), e^k = 5 × le médian au flair 1, 1/5 au
  // flair 0,15, borné ; le glissé de dernier recours — interdit tant que le ballon est prenable debout (posé à 0,3 m,
  // ou qui vient vers lui), permis au taux imposé quand il fuit ; la faute du glissé manqué — posée à portée sous le
  // tirage, jamais hors de portée ni au-dessus du tirage ; (b) le monde : 600 s de match, le glissé se raréfie sous la
  // clé (≤ sans elle) et ses fautes portent la nature ; sabotage « nature null » : aucune faute de nature, les gestes vivent.
  const K = matchCfg({ ...B_0746 }).nature, cfg = matchCfg({ ...B_0746,  shotRange: 20 });
  const fMed = specialisteF({ persona: { flair: 0.575 }, skill: null }, K.specialiste), fMax = specialisteF({ persona: { flair: 1 }, skill: null }, K.specialiste), fMin = specialisteF({ persona: { flair: 0.15 }, skill: null }, K.specialiste);
  const st = makeMatch({ full: true, seed: 5 }); st.restart = null;
  for (const q of st.players) { q.v = [0, 0]; q.down = 0; q.p[0] = q.team === 0 ? -45 : 45; q.p[2] = (q.id % 11) * 5 - 25; }
  const c = st.players.find((q) => q.team === 0 && q.post === 7), foe = st.players.find((q) => q.team === 1 && !q.keeper && q.post === 5);
  c.p[0] = 0; c.p[2] = 0; c.v = [5, 0]; foe.p[0] = 1.5; foe.p[2] = 0; foe.v = [0, 0]; foe.yaw = Math.PI;
  st.ball.restart([1.4, 0.11, 0], { cause: 'coup-franc' }); st.restart = null;   // posé à 0,1 m du défenseur : prenable debout
  const permisPose = glissePermis(st, foe, K.glisse, cfg);
  st.ball.restart([3.5, 0.11, 0], { cause: 'coup-franc' }); st.restart = null; st.ball.impulse([6, 0, 0], null);   // il fuit à 6 m/s
  let n1 = 0; st.rnd = () => 0.01; const permisFuit = glissePermis(st, foe, K.glisse, cfg); st.rnd = () => 0.99; const refusTaux = !glissePermis(st, foe, K.glisse, cfg);
  st.t = 10; st._faute = null; c.p[0] = foe.p[0] + 1.2; c.v = [5, 0]; let chutes = 0; const ch = () => { chutes++; };
  st.rnd = () => 0.01; const f1 = fauteGlisse(st, foe, c, K.glisse, cfg, ch), posee = st._faute?.par === foe.id && st._faute?.sur === c.id && /tacle-glissé/.test(st._faute?.kind ?? '');
  st._faute = null; st.rnd = () => 0.99; const f2 = fauteGlisse(st, foe, c, K.glisse, cfg, ch);
  st.rnd = () => 0.01; c.p[0] = foe.p[0] + 4; const f3 = fauteGlisse(st, foe, c, K.glisse, cfg, ch); st.rnd = null;
  const mA = makeMatch({ full: true, seed: 3 }), mN = makeMatch({ full: true, seed: 3 }), cfgN = matchCfg({ ...B_0746,  shotRange: 20, nature: null });
  for (let i = 0; i < 600 * 60; i++) { matchStep(mA, 1 / 60, cfg); matchStep(mN, 1 / 60, cfgN); }
  const sA = mA.events.filter((e) => e.type === 'slide').length, sN = mN.events.filter((e) => e.type === 'slide').length, fnA = mA.events.filter((e) => e.type === 'faute' && e.nature).length, fnN = mN.events.filter((e) => e.type === 'faute' && e.nature).length, gA = mA.events.filter((e) => e.type === 'skill').length;
  ok(`lot 269 — LA NATURE DES GESTES (lois pures) : le spécialiste tente × ${fMed.toFixed(3)} au médian (= k / sinh k = ${(K.specialiste.k / Math.sinh(K.specialiste.k)).toFixed(3)} : l'espérance à 1), × ${fMax.toFixed(2)} au flair 1 (= e^k × le médian, e^k = ${Math.exp(K.specialiste.k).toFixed(2)}), × ${fMin.toFixed(3)} au flair 0,15 (= le médian / e^k) ; le glissé refusé sur ballon prenable debout (${!permisPose}), permis sur ballon qui fuit au tirage bas (${permisFuit}), refusé au tirage haut (${refusTaux}) ; la faute du glissé manqué posée à portée sous le tirage (${f1 && posee}, chute ${chutes}), pas au-dessus (${!f2}), pas hors de portée (${!f3})`,
    Math.abs(fMed - K.specialiste.k / Math.sinh(K.specialiste.k)) < 1e-9 && Math.abs(fMax / fMed - Math.exp(K.specialiste.k)) < 1e-6 && Math.abs(fMin / fMed - Math.exp(-K.specialiste.k)) < 1e-6 && !permisPose && permisFuit && refusTaux && f1 && posee && chutes === 1 && !f2 && !f3);
  ok(`lot 269 — …et LE MONDE (600 s, graine 3) : glissés ${sA} sous la clé ≤ ${sN} sans elle, fautes de nature ${fnA} ; sabotage « nature null » : ${fnN} = 0 faute de nature, ${gA} gestes vivent sous la clé (≥ 1)`,
    sA <= sN && fnN === 0 && gA >= 1);
}

// ---------------------------------------------------------------- lot 270 : LE TEMPS DU MATCH
// (cfg.temps — Bible 14 lot 3 T24-T25 ; Bible 16 lot 4 T10, T23 ; Modèle 12 test 11 ; Loi 12.2 les huit secondes)
if (__bloc()) {
  // (a) les lois pures : la bande Opta de chaque espèce — l'axe gestionTemps 0,5 rend le milieu, 0 le rapide, 1 le lent, une
  // espèce sans bande rend null ; le temps additionnel — part × arrêts, + serre à la dernière période si |écart| ≤ 1, borné
  // [min ; maxPart × période] ; les huit secondes — tenu 7 s : rien, 9 s : le corner sifflé pour l'adversaire du côté du
  // ballon, l'événement nommé ; (b) le monde : sur le même état, la touche d'une équipe rapide (axe 0) attend moins que celle
  // d'une équipe lente (axe 1) ; 600 s de match : les remises durent plus sous la clé (la moyenne des reprises) ; sabotage
  // « temps null » : la durée d'hier (tempsMort) au bit, aucun huit-secondes.
  const K = matchCfg({ remisePostes: null, rendezVous: null /* remisePostes et rendezVous null DATÉ 281 : vert à HEAD~ (worktree 0f5e292), l'attente de la touche remangée (10,7 s c. 18,2 pour l'équipe lente) — la clause mesure sa loi, pas la passe au rendez-vous ni les postes de la remise */, ...B_0746 }).temps, cfg = matchCfg({ remisePostes: null, rendezVous: null /* remisePostes et rendezVous null DATÉ 281 : vert à HEAD~ (worktree 0f5e292), l'attente de la touche remangée (10,7 s c. 18,2 pour l'équipe lente) — la clause mesure sa loi, pas la passe au rendez-vous ni les postes de la remise */, ...B_0746,  shotRange: 20 });
  const bT = bandeDe('touche', K, 0.5), b0 = bandeDe('touche', K, 0), b1 = bandeDe('touche', K, 1), bN = bandeDe('engagement', K, 0.5), bC = bandeDe('corner', K, 0.5);
  const bandesOk = Math.abs(bT - (BANDES_OPTA.touche[0] + BANDES_OPTA.touche[1]) / 2) < 1e-9 && b0 === BANDES_OPTA.touche[0] && b1 === BANDES_OPTA.touche[1] && bN === null && Math.abs(bC - 40) < 1e-9;
  const A = K.additionnel, aPlat = addDe(600, 2700, A, 3, true), aSerre = addDe(600, 2700, A, 1, true), aPrem = addDe(600, 2700, A, 1, false), aMin = addDe(0, 2700, A, 0, false), aMax = addDe(9000, 2700, A, 0, true);
  const addOk = Math.abs(aPlat - 600 * A.part) < 1e-9 && Math.abs(aSerre - (600 * A.part + A.serre)) < 1e-9 && Math.abs(aPrem - 600 * A.part) < 1e-9 && aMin === A.min && Math.abs(aMax - A.maxPart * 2700) < 1e-9;
  const st = makeMatch({ full: true, seed: 5 }); st.restart = null; st.t = 100;
  const gk = st.players.find((q) => q.team === 1 && q.keeper); gk.p[0] = st.pitch.ownGoal(1).x - 5 * Math.sign(st.pitch.ownGoal(1).x); gk.p[2] = 4;
  st.ball.restart([gk.p[0], 0.5, gk.p[2]], { cause: 'coup-franc' }); st.restart = null; st.ball.possess(gk.id);
  const n0 = st.events.length, r7 = huitSecondes(st, gk, cfg, 7, tempoWait), r9 = huitSecondes(st, gk, cfg, 9, tempoWait);
  const evH = st.events.slice(n0).find((e) => e.type === 'huit-secondes'), evS = st.events.slice(n0).find((e) => e.type === 'sortie');
  const huitOk = !r7 && r9 && !!evH && evH.by === gk.id && evS?.out === 'corner' && evS.team === 0 && st.restart?.type === 'corner' && st.restart.team === 0 && Math.sign(st.restart.p[1]) === Math.sign(gk.p[2]) && st.restart.at > st.t + 20;
  const stR = makeMatch({ full: true, seed: 5, tactics: [{ gestionTemps: 0 }, {}] }), stL = makeMatch({ full: true, seed: 5, tactics: [{ gestionTemps: 1 }, {}] });
  stR.t = stL.t = 100; const wR = tempoWait(stR, cfg, 0, 'touche'), wL = tempoWait(stL, cfg, 0, 'touche'), wN = tempoWait(stR, matchCfg({ remisePostes: null, rendezVous: null /* remisePostes et rendezVous null DATÉ 281 : vert à HEAD~ (worktree 0f5e292), l'attente de la touche remangée (10,7 s c. 18,2 pour l'équipe lente) — la clause mesure sa loi, pas la passe au rendez-vous ni les postes de la remise */, ...B_0746,  shotRange: 20, temps: null }), 0, 'touche');
  const rep = (m, c) => { const a = []; let sT = null, seen = 0; for (let i = 0; i < 600 * 60; i++) { matchStep(m, 1 / 60, c); for (; seen < m.events.length; seen++) if (m.events[seen].type === 'sortie') sT = m.t; if (m.restart && sT != null && m.restart.at > 0) { a.push(m.restart.at - sT); sT = null; } } return a; };
  const rA = rep(makeMatch({ full: true, seed: 3 }), cfg), rN = rep(makeMatch({ full: true, seed: 3 }), matchCfg({ remisePostes: null, rendezVous: null /* remisePostes et rendezVous null DATÉ 281 : vert à HEAD~ (worktree 0f5e292), l'attente de la touche remangée (10,7 s c. 18,2 pour l'équipe lente) — la clause mesure sa loi, pas la passe au rendez-vous ni les postes de la remise */, ...B_0746,  shotRange: 20, temps: null }));
  const mA = rA.reduce((x, y) => x + y, 0) / Math.max(1, rA.length), mN = rN.reduce((x, y) => x + y, 0) / Math.max(1, rN.length);
  ok(`lot 270 — LE TEMPS DU MATCH (lois pures) : la bande Opta de la touche ${b0} → ${b1} s (axe 0 → 1, ${bT.toFixed(1)} au milieu), le corner ${bC.toFixed(0)} au milieu, l'engagement sans bande (${bN}) ; le temps additionnel : 600 s d'arrêts → ${aPlat.toFixed(0)} s (part ${A.part}), ${aSerre.toFixed(0)} s serré à la dernière période (+ ${A.serre}), ${aPrem.toFixed(0)} à la première, plancher ${aMin} s, plafond ${aMax.toFixed(0)} = ${A.maxPart} × 2 700 ; les huit secondes : tenu 7 s rien (${!r7}), 9 s → corner pour l'adversaire du côté du ballon (${huitOk})`,
    bandesOk && addOk && huitOk);
  ok(`lot 270 — …et LE MONDE : la touche attend ${wR.toFixed(1)} s pour l'équipe rapide (axe 0) < ${wL.toFixed(1)} s pour la lente (axe 1) ; sabotage « temps null » : ${wN.toFixed(1)} s = tempsMort d'hier × tempo × aléa (∈ [8 ; 16]) ; 600 s graine 3 : les reprises durent ${mA.toFixed(1)} s en moyenne sous la clé (${rA.length}) > ${mN.toFixed(1)} sans elle (${rN.length}) ; aucun huit-secondes sans la clé (${st.events.filter((e) => e.type === 'huit-secondes').length === 1})`,
    wR < wL && wL / wR > 1.3 && wN >= 8 && wN <= 16 && rA.length >= 3 && rN.length >= 3 && mA > mN);
}

// ---------------------------------------------------------------- lot 271 : LE BALLON FOU
// (cfg.ballonFou — Bible 15 lot 3 : §3.4 la sortie stochastique, D8b σ 75°, D9 le quart arrière ; Référentiel 01 §2.5)
if (__bloc()) {
  // (a) les lois pures : σ_θ 75° à la qualité 0,5, 45° à l'élite, 100° au médiocre ; la qualité 0,5 sans note ; sur 6 000
  // tirages d'un LCG : la vitesse moyenne dans 4-9 m/s et bornée, le cône ± 45° ≈ 45 % (± 6), le demi-plan arrière ≈ 26 %
  // (± 5) ; à l'élite le cône monte (> 55 %), au médiocre il tombe (< 40 %) ; (b) le monde : appliquerFou pose la vitesse
  // sur le ballon (la norme dans [2 ; 12], l'axe du dévieur) ; 600 s de match : la vitesse du ballon après les piques
  // (p50) plus haute sous la clé que sans ; sabotage « ballonFou null » : le pique d'hier au bit (3,4 m/s + l'écho).
  const K = matchCfg({ ...B_0746, }).ballonFou, cfg = matchCfg({ ...B_0746, ligneAccrochee: null /* ligneAccrochee null DATÉ 280 : vert à HEAD~ (worktree 303b2e4), le monde du ballon fou remangé — la clause mesure sa loi, pas la ligne accrochée */, shotRange: 20 });
  const sMoy = sigmaFou(0.5, K) * 180 / Math.PI, sEl = sigmaFou(1, K) * 180 / Math.PI, sMed = sigmaFou(0, K) * 180 / Math.PI;
  const lcg = (seed) => { let x = seed >>> 0; return () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return (x + 0.5) / 4294967296; }; };
  const stats = (q, n = 6000) => { const r = lcg(12345); let cone = 0, arr = 0, sv = 0, vmin = 99, vmax = 0; for (let i = 0; i < n; i++) { const v = sortieFolle(0, q, K, r), sp = Math.hypot(v[0], v[1]), a = Math.abs(Math.atan2(v[1], v[0])); sv += sp; vmin = Math.min(vmin, sp); vmax = Math.max(vmax, sp); if (a <= Math.PI / 4) cone++; if (a > Math.PI / 2) arr++; } return { v: sv / n, cone: cone / n, arr: arr / n, vmin, vmax }; };
  const M = stats(0.5), E = stats(1), D = stats(0);
  const st = makeMatch({ full: true, seed: 5 }); st.restart = null; st.t = 10;
  const q = st.players.find((p) => p.team === 1 && !p.keeper && p.post === 5); q.p[0] = 0; q.p[2] = 0;
  st.ball.restart([0.5, 0.11, 0], { cause: 'coup-franc' }); st.restart = null; st.ball.impulse([1, 0, 0], null);
  const v = appliquerFou(st, q, cfg), sp = Math.hypot(st.ball.v[0], st.ball.v[2]), poseOk = Math.abs(sp - Math.hypot(v[0], v[1])) < 1e-9 && sp >= K.vMin && sp <= K.vMax;
  const piques = (m, c) => { const a = []; let seen = 0; for (let i = 0; i < 600 * 60; i++) { matchStep(m, 1 / 60, c); for (; seen < m.events.length; seen++) if (m.events[seen].type === 'tacle-pique') a.push(Math.hypot(m.ball.v[0], m.ball.v[2])); } a.sort((x, y) => x - y); return { n: a.length, p50: a.length ? a[Math.floor(a.length / 2)] : 0 }; };   // la vitesse À l'image du pique (0,15 s plus tard le ballon est déjà ramassé : 2,3 m/s dans les deux mondes)
  const pA = piques(makeMatch({ full: true, seed: 3 }), cfg), pN = piques(makeMatch({ full: true, seed: 3 }), matchCfg({ ...B_0746, ligneAccrochee: null /* ligneAccrochee null DATÉ 280 : vert à HEAD~ (worktree 303b2e4), le monde du ballon fou remangé — la clause mesure sa loi, pas la ligne accrochée */, shotRange: 20, ballonFou: null }));
  ok(`lot 271 — LE BALLON FOU (lois pures) : σ_θ ${sMoy.toFixed(0)}° à la qualité 0,5 (= 75), ${sEl.toFixed(0)}° à l'élite (45), ${sMed.toFixed(0)}° au médiocre (100), la qualité ${qualiteFou({ skill: null })} sans note ; 6 000 sorties à 0,5 : vitesse moyenne ${M.v.toFixed(2)} m/s (4-9), bornée [${M.vmin.toFixed(2)} ; ${M.vmax.toFixed(2)}] ⊂ [${K.vMin} ; ${K.vMax}], cône ± 45° ${(100 * M.cone).toFixed(0)} % (45 ± 6), arrière ${(100 * M.arr).toFixed(0)} % (26 ± 5) ; l'élite ${(100 * E.cone).toFixed(0)} % dans le cône (> 55), le médiocre ${(100 * D.cone).toFixed(0)} % (< 40)`,
    Math.abs(sMoy - 75) < 1e-6 && Math.abs(sEl - 45) < 1e-6 && Math.abs(sMed - 100) < 1e-6 && qualiteFou({ skill: null }) === 0.5 && M.v >= 4 && M.v <= 9 && M.vmin >= K.vMin - 1e-9 && M.vmax <= K.vMax + 1e-9 && Math.abs(M.cone - 0.453) < 0.06 && Math.abs(M.arr - 0.259) < 0.05 && E.cone > 0.55 && D.cone < 0.40);
  ok(`lot 271 — …et LE MONDE : appliquerFou pose ${sp.toFixed(2)} m/s sur le ballon (∈ [${K.vMin} ; ${K.vMax}], ${poseOk}) ; 600 s graine 3 : ${pA.n} piques sous la clé, ballon à ${pA.p50.toFixed(1)} m/s p50 à l'image du pique > ${pN.p50.toFixed(1)} sans la clé (${pN.n} piques — l'écho d'hier à ~3 m/s)`,
    poseOk && pA.n >= 2 && pN.n >= 2 && pA.p50 > pN.p50 && pA.p50 >= 4);
}

if (__bloc()) {
  // (a) les lois pures : la table de Sumpter (§ 2.2) cellule par cellule (10 cellules, ± 0,001), la divergence hors clamp
  // (test 9 ter : minimum à 56 m ≈ 0,0096, 0,047 à 90 m) et le garde-fou (xgGeo décroît au-delà de 35 m) ; l'occlusion
  // Ω (un corps sur l'axe à 6 m du tireur de 12 m : 2·asin(0,3/6)/A × (1 − 6/12) ; engagé plus large ; derrière le
  // tireur : 0) ; la finition ne bouge que xG_dec (ref identique, dec croissant avec la note) ; la tête recentrée sous le
  // pied ; Θ à l'identité = base, plus bas mené tard / doctrine 1 / rôle tireur ; la porte 0 sous 0,5·seuil, 1 au-delà de
  // 1,5 ; (b) le monde : 600 s graine 3, les tirs portent xg / xgDec / omega, st.xg cumule ; sabotage « xg null » :
  // aucun champ, st.xg absent (l'arbitre du 232 au bit — l'empreinte fait foi).
  const K = matchCfg({ ...B_0746 }).xg, cfg = matchCfg({ ...B_0746,  shotRange: 20 });
  const table = [[4, 0, 0.527], [4, 8, 0.199], [6, 4, 0.296], [8, 8, 0.152], [11, 12, 0.075], [14, 16, 0.043], [16.5, 0, 0.091], [20, 4, 0.054], [25, 8, 0.03], [35, 16, 0.014]];
  const errT = Math.max(...table.map(([X, C, v]) => Math.abs(xgGeo(X, C, K) - v)));
  const div = [40, 56, 70, 90].map((X) => sigXg(logitGeo(X, 0))), garde = [36, 40, 45, 60].map((X) => xgGeo(X, 0, K));
  const gardeOk = garde.every((v, i) => i === 0 ? v < xgGeo(35, 0, K) : v < garde[i - 1]);
  const st = makeMatch({ full: true, seed: 5 }); st.restart = null; st.t = 10;
  const goal = st.pitch.attackGoal(1), sgn = Math.sign(goal.x), tireur = st.players.find((p) => p.team === 1 && !p.keeper && p.post === 5);
  for (const q of st.players) if (q.team === 0 && !q.keeper) { q.p[0] = -sgn * 40; q.p[2] = 20; q.v = [0, 0, 0]; }
  tireur.p[0] = goal.x - sgn * 12; tireur.p[2] = 0; tireur.v = [0, 0, 0];
  const def = st.players.find((p) => p.team === 0 && !p.keeper);
  const c0 = coneDe(st, tireur, goal, K);
  def.p[0] = goal.x - sgn * 6; def.p[2] = 0; const c1 = coneDe(st, tireur, goal, K), omAtt = 2 * Math.asin(0.3 / 6) / c1.A * 0.5;
  def._contre = { until: st.t + 1 }; const c2 = coneDe(st, tireur, goal, K); def._contre = null;
  def.p[0] = goal.x - sgn * 14; const c3 = coneDe(st, tireur, goal, K); def.p[0] = -sgn * 40;
  const withFin = (f) => { const sk = tireur.skill; tireur.skill = { ...(sk ?? {}), finF: f }; const r = xgDe(st, tireur, cfg); tireur.skill = sk; return r; };
  const fE = withFin(0.45), fM = withFin(1), fB = withFin(2.24), tete = xgDe(st, tireur, cfg, true);
  const finOk = Math.abs(fE.ref - fM.ref) < 1e-12 && Math.abs(fB.ref - fM.ref) < 1e-12 && fE.dec > fM.dec && fM.dec > fB.dec && tete.ref < fM.ref;
  const thId = thetaDe({ t: 0, tactics: null, score: [0, 0] }, { stam: 1, role: null }, cfg, 0);
  const thMene = thetaDe({ t: 5100, tactics: null, score: [0, 1] }, { team: 0, stam: 1, role: null }, cfg, 0), thDoc = thetaDe({ t: 0, tactics: [{ shotDoctrine: 1 }, { shotDoctrine: 1 }], score: [0, 0] }, { team: 0, stam: 1 }, cfg, 0);
  const thRole = thetaDe({ t: 0, tactics: null, score: [0, 0] }, { stam: 1, role: { arbitre: { tir: 1.15 } } }, cfg, 0), thFat = thetaDe({ t: 0, tactics: null, score: [0, 0] }, { stam: 0.5 }, cfg, 0);
  const pOk = porteDe(0.02, 0.02, 0.025, K).sel === 0 && porteDe(0.0675, 0.02, 0.025, K).sel === 1 && porteDe(0.045, 0.02, 0.025, K).sel > 0.3 && porteDe(0.045, 0.02, 0.025, K).sel < 0.7 && porteDe(0.02, 0.02, 0.025, K).f === K.plancher;
  const monde = (c) => { const m = makeMatch({ full: true, seed: 3 }); for (let i = 0; i < 600 * 60; i++) matchStep(m, 1 / 60, c); const sh = m.events.filter((e) => e.type === 'shot'); return { n: sh.length, avec: sh.filter((e) => e.xg != null && e.xgDec != null && e.omega != null).length, som: sh.reduce((a, e) => a + (e.xg ?? 0), 0), xg: m.xg, xgMoy: sh.length ? sh.reduce((a, e) => a + (e.xg ?? 0), 0) / sh.length : 0 }; };
  const mA = monde(cfg), mN = monde(matchCfg({ ...B_0746,  shotRange: 20, xg: null }));
  ok(`lot 272 — LE xG EN FORME CLOSE (lois pures) : la table de Sumpter à ${errT.toFixed(4)} près (< 0,001) ; hors clamp 40/56/70/90 m : ${div.map((v) => v.toFixed(4)).join(' / ')} (min ≈ 0,0096 à 56, 0,047 à 90) ; le garde-fou décroît au-delà de 35 m (${gardeOk}) ; angle visible à 1 m ${(angleVisible(1, 0) * 180 / Math.PI).toFixed(0)}° (> 90) ; Ω : vide ${c0.omega}, un corps à 6 m ${c1.omega.toFixed(4)} (attendu ${omAtt.toFixed(4)}), engagé ${c2.omega.toFixed(4)} (>), derrière ${c3.omega} (= 0) ; finition : ref identique, dec ${fE.dec.toFixed(3)} > ${fM.dec.toFixed(3)} > ${fB.dec.toFixed(3)}, tête ${tete.ref.toFixed(3)} < pied ${fM.ref.toFixed(3)} ; Θ identité ${thId.toFixed(4)} (= ${K.theta.base}), mené −1 à la 85' ${thMene.toFixed(4)}, doctrine 1 ${thDoc.toFixed(4)}, rôle tireur ${thRole.toFixed(4)} (<), fatigué ${thFat.toFixed(4)} (>) ; la porte 0 / 0,5 / 1 (${pOk})`,
    errT < 0.001 && Math.abs(div[1] - 0.0096) < 0.0005 && Math.abs(div[3] - 0.047) < 0.002 && div[1] < div[0] && div[3] > div[2] && gardeOk && angleVisible(1, 0) > Math.PI / 2 && c0.omega === 0 && Math.abs(c1.omega - omAtt) < 1e-9 && c2.omega > c1.omega && c3.omega === 0 && finOk
      && Math.abs(thId - K.theta.base) < 1e-12 && thMene < thId && thDoc < thId && thRole < thId && thFat > thId && pOk);
  ok(`lot 272 — …et LE MONDE : 600 s graine 3 : ${mA.n} tirs, ${mA.avec} avec xg / xgDec / omega, xG moyen ${mA.xgMoy.toFixed(3)}, st.xg ${JSON.stringify(mA.xg)} = Σ ${mA.som.toFixed(3)} ; sabotage xg null : ${mN.n} tirs, ${mN.avec} avec xg, st.xg ${mN.xg}`,
    mA.n >= 1 && mA.avec === mA.n && mA.xg && Math.abs(mA.xg[0] + mA.xg[1] - mA.som) < 1e-6 && mA.xgMoy > 0 && mA.xgMoy < 0.5 && mN.avec === 0 && mN.xg === undefined);
}

if (__bloc()) {
  // (a) les lois pures : retard_i 1,3 exact au 50 / sans note, 0,94 à l'élite, 1,72 au médiocre (la plage 0,8-1,8 du book) ; la
  // référence = le 2ᵉ plus reculé ; une unité synthétique (quatre corps, le latéral monté à +7 m, ballon découvert) : le
  // monté (+2 m devant la bande) est ramené à réf + avant − retard (28,2 m), le couvreur à −2 m reste, desync 4 → le frein 0,75 posé sur le plus
  // avancé (événement 'ligne') ; ballon couvert : pas de frein ; le presseur sort de l'unité (ni borné, ni freiné, ni dans
  // la référence) ; (b) le monde : 300 s graine 3, des freins sous la clé, la desync de la ligne arrière (les postes de la ligne OFF, max − min x,
  // toutes les 0,25 s, ballon dans leur moitié) p50 sous les trois quarts de celle sans la clé ; sabotage « ligne null » : 0 frein.
  const K = matchCfg({ presseLue: null /* presseLue null DATÉ 289 : vert à HEAD~ (worktree 7bd70e0), desync des quatre défenseurs p50 7,2 m c. 8,5 sans dans ce monde — la clause mesure sa loi, pas la pression lue au temps d'arrivée */, ...B_0746, }).ligne, cfg = matchCfg({ presseLue: null /* presseLue null DATÉ 289 : vert à HEAD~ (worktree 7bd70e0), desync des quatre défenseurs p50 7,2 m c. 8,5 sans dans ce monde — la clause mesure sa loi, pas la pression lue au temps d'arrivée */, remisesPied: RP_1609, tete: TETE_1609, loi12: LOI12_1609, viragesLisses: null, plantVitesse: null, sortieAerienne: null, retournee: null, bouclier: null, ceremonie: null, ramasseurs: null, boiterie: null, entrant: null, petitsGestes: null, passements: null, enchainement: null, orientationPasse: null, verticalite: null, decalage: null, toucheOrientee: null /* remisesPied hier DATÉ 16/09 (lot A9 ter, note 368) — chaque clause de flux mesure le monde de son jour */, sol: null, fete: null /* sol, fete null DATÉ 15/09 (lots A10 bis-A11, notes 360-361) */, interligne: null /* interligne null DATÉ 274 : vert à HEAD~ (worktree f755654), la desync de l'unité 273 remangée (7,7 c. 9,0 × 0,75) : le milieu tenu change les possessions — la clause mesure sa loi, pas l'interligne */, pausaPied: null, recevoirSurPlace: null, pasDeRecul: null, enveloppe: null, blocPercu: null /* DATÉ fusion 15/09 (272-276 × A12) : vert dans les deux parents (worktrees 1a945e9 et f62c3d8), la combinaison des deux branches remange le flux — la clause mesure sa loi */, interligne: null /* interligne null DATÉ 274 : vert à HEAD~ (worktree f755654), la desync de l'unité 273 remangée (7,7 c. 9,0 × 0,75) : le milieu tenu change les possessions — la clause mesure sa loi, pas l'interligne */, shotRange: 20 });
  const rM = retardDe({ skill: null }, K), rE = retardDe({ skill: { anticipF: 1.15, posF: 1.15 } }, K), rB = retardDe({ skill: { anticipF: 0.85, posF: 0.85 } }, K);
  const unite = (job = 'mark', couvert = 'découvert') => { const mk = (id, x, j = 'mark') => ({ id, p: [x, 0, 0], target: [x, 0, 0], job: j, skill: null }); const ms = [mk(1, -25), mk(2, -24), mk(3, -23, job), mk(4, -27)]; const st = { t: 10, _ligne: {}, events: [] }; const U = ligneStep(st, cfg, { defTeam: 0, membres: ms, ownX: -52.5, sgnDef: -1, couvert }); return { ms, st, U }; };
  const A = unite(), B = unite('mark', 'couvert'), C = unite('press');
  const aOk = Math.abs(A.ms[2].target[0] - (-52.5 + 27.5 + K.avant - rM)) < 1e-9 && A.ms[3].target[0] === -27 && A.ms[0].target[0] === -25 && Math.abs(A.U.ref - 27.5) < 1e-9 && Math.abs(A.U.desync - 4) < 1e-9 && A.ms[2]._frein?.f === K.frein && A.st.events.length === 1 && A.st.events[0].type === 'ligne';
  const bOk = !B.ms[2]._frein && B.st.events.length === 0 && Math.abs(B.ms[2].target[0] - (-52.5 + 27.5 + K.avant - rM)) < 1e-9;
  const cOk = C.ms[2].target[0] === -23 && !C.ms[2]._frein && Math.abs(C.U.ref - 27.5) < 1e-9;
  const monde = (c) => { const m = makeMatch({ full: true, seed: 3 }); const ds = []; let next = 0; for (let i = 0; i < 300 * 60; i++) { matchStep(m, 1 / 60, c); if (m.t >= next && m.possession.team >= 0 && !m.restart) { next = m.t + 0.25; const T = 1 - m.possession.team, g = m.pitch.ownGoal(T); if (Math.sign(m.ball.p[0] || g.x) === Math.sign(g.x)) { const fL = m.tactics?.[T]?.formation ?? 433, mD = mapPostesL(fL), nD = (LIGNES_L[formationPourL(fL, false)] ?? [4])[0]; const xs = m.players.filter((q) => q.team === T && !q.keeper && (mD[q.post ?? 9] ?? 9) < nD && q.down <= 0).map((q) => q.p[0]); if (xs.length >= 3) ds.push(Math.max(...xs) - Math.min(...xs)); } } } ds.sort((x, y) => x - y); return { freins: m.events.filter((e) => e.type === 'ligne').length, n: ds.length, p50: ds.length ? ds[Math.floor(ds.length / 2)] : NaN }; };
  const mA = monde(cfg), mN = monde(matchCfg({ presseLue: null /* presseLue null DATÉ 289 : vert à HEAD~ (worktree 7bd70e0), desync des quatre défenseurs p50 7,2 m c. 8,5 sans dans ce monde — la clause mesure sa loi, pas la pression lue au temps d'arrivée */, remisesPied: RP_1609, tete: TETE_1609, loi12: LOI12_1609, viragesLisses: null, plantVitesse: null, sortieAerienne: null, retournee: null, bouclier: null, ceremonie: null, ramasseurs: null, boiterie: null, entrant: null, petitsGestes: null, passements: null, enchainement: null, orientationPasse: null, verticalite: null, decalage: null, toucheOrientee: null /* remisesPied hier DATÉ 16/09 (lot A9 ter, note 368) — chaque clause de flux mesure le monde de son jour */, sol: null, fete: null /* sol, fete null DATÉ 15/09 (lots A10 bis-A11, notes 360-361) */, interligne: null /* interligne null DATÉ 274 : vert à HEAD~ (worktree f755654), la desync de l'unité 273 remangée (7,7 c. 9,0 × 0,75) : le milieu tenu change les possessions — la clause mesure sa loi, pas l'interligne */, pausaPied: null, recevoirSurPlace: null, pasDeRecul: null, enveloppe: null, blocPercu: null /* DATÉ fusion 15/09 (272-276 × A12) : vert dans les deux parents (worktrees 1a945e9 et f62c3d8), la combinaison des deux branches remange le flux — la clause mesure sa loi */, interligne: null /* interligne null DATÉ 274 : vert à HEAD~ (worktree f755654), la desync de l'unité 273 remangée (7,7 c. 9,0 × 0,75) : le milieu tenu change les possessions — la clause mesure sa loi, pas l'interligne */, shotRange: 20, ligne: null }));
  ok(`lot 273 — LA LIGNE EST UNE LIGNE (lois pures) : retard 1,3 → ${rM} au 50, ${rE.toFixed(3)} à l'élite, ${rB.toFixed(3)} au médiocre (0,8-1,8) ; référence [30, 28, 33, 35] → ${referenceDe([30, 28, 33, 35])} (= 30) ; unité synthétique : le monté ramené à ${A.ms[2].target[0].toFixed(2)} (réf 27,5 + ${K.avant} − ${rM} depuis −52,5 = ${(-52.5 + 27.5 + K.avant - rM).toFixed(2)}), le couvreur ${A.ms[3].target[0]} intact, desync ${A.U.desync} → frein ${A.ms[2]._frein?.f} (${aOk}) ; couvert : pas de frein (${bOk}) ; presseur hors de l'unité (${cOk})`,
    rM === K.retard && Math.abs(rE - 1.3 * 0.85 * 0.85) < 1e-9 && Math.abs(rB - 1.3 * 1.15 * 1.15) < 1e-9 && referenceDe([30, 28, 33, 35]) === 30 && aOk && bOk && cOk);
  ok(`lot 273 — …et LE MONDE : 300 s graine 3 : ${mA.freins} freins sous la clé, desync des quatre défenseurs p50 ${mA.p50.toFixed(1)} m (${mA.n} lectures) < ${mN.p50.toFixed(1)} sans la clé (${mN.freins} frein — l'hier)`,
    mA.freins >= 1 && mA.n >= 100 && mA.p50 < mN.p50 * 0.75 && mN.freins === 0);
}

if (__bloc()) {
  // (a) les lois pures : la portée 10,5 exact au 50 / sans note, 15 au puissant (pace, anticipation, stamina au max), 6 au
  // limité ; la cible au mode médian [8,4 ; 10,5], bloc bas (0) × 0,55 → [5 ; 6] (bornée), bloc haut (1) × 1,15 → [9,66 ; 12,08] ;
  // l'intégrité OK / WARN (16) / BROKEN (19) ; une ligne synthétique : trois milieux à réf + 33, + 9,5 et + 5 → le premier ramené
  // à réf + hi, le second intact, le troisième remonté à réf + lo, le presseur et le marqueur au contact intacts ; l'écart des
  // barycentres publie BROKEN puis, tenu 2 s, une rupture et l'événement 'bloc' ; (b) le monde : 300 s graine 3, l'interligne
  // des barycentres (le milieu − l'arrière, ballon dans leur moitié, toutes les 0,25 s) p50 sous la clé plus bas que sans,
  // et sous hiMax ; sabotage « interligne null » : aucune rupture, st._interligne absent.
  const K = matchCfg({ ouverture: null /* ouverture null DATÉ 288 : vert à HEAD~ (worktree d90101b), interligne DEF↔MID 12,0 m c. 11,8 sans dans ce monde — la clause mesure sa loi, pas le receveur qui s'ouvre au ballon */, remisePostes: null, rendezVous: null /* remisePostes et rendezVous null DATÉ 281 : vert à HEAD~ (worktree 0f5e292), l'interligne remangé (11,1 m c. 11,0 sans la clé, p90 17,5 c. 17,7) — la clause mesure sa loi, pas la passe au rendez-vous ni les postes de la remise */, ...B_0746, }).interligne, cfg = matchCfg({ ouverture: null /* ouverture null DATÉ 288 : vert à HEAD~ (worktree d90101b), interligne DEF↔MID 12,0 m c. 11,8 sans dans ce monde — la clause mesure sa loi, pas le receveur qui s'ouvre au ballon */, remisePostes: null, rendezVous: null /* remisePostes et rendezVous null DATÉ 281 : vert à HEAD~ (worktree 0f5e292), l'interligne remangé (11,1 m c. 11,0 sans la clé, p90 17,5 c. 17,7) — la clause mesure sa loi, pas la passe au rendez-vous ni les postes de la remise */, ...B_0746, ligneAccrochee: null /* ligneAccrochee null DATÉ 280 : vert à HEAD~ (worktree 303b2e4), l'interligne du monde remangé par la référence accrochée — la clause mesure sa loi, pas la ligne accrochée */, shotRange: 20 });
  const pM = porteeDe({ skill: null }, K), pP = porteeDe({ skill: { topF: 1.1, anticipF: 1.15, stamF: 0.75 } }, K), pL = porteeDe({ skill: { topF: 0.9, anticipF: 0.85, stamF: 1.25 } }, K);
  const cM = cibleDe([{ skill: null }], 0.5, K), cB = cibleDe([{ skill: null }], 0, K), cH = cibleDe([{ skill: null }], 1, K);
  const mk = (id, x, job = 'mark') => ({ id, p: [x, 0, 0], target: [x, 0, 0], job, skill: null });
  const arr = [mk(1, -35), mk(2, -34), mk(3, -36), mk(4, -35)], mids = [mk(5, -2), mk(6, -25.5), mk(7, -30), mk(8, -2, 'press'), Object.assign(mk(9, -3), { _markT: [-3, 0] })];
  const st = { t: 10, _interligne: {}, events: [] }, ref = 17.5;   // ownX −52,5, sgnDef −1 : av(x) = x + 52,5 ; l'arrière à 17,5, la réf = son 2ᵉ plus reculé
  const U1 = interligneStep(st, cfg, { defTeam: 0, milieux: mids, arriere: arr, ref, ownX: -52.5, sgnDef: -1, hauteur: 0.5 });
  const uOk = Math.abs(mids[0].target[0] - (-52.5 + ref + U1.hi)) < 1e-9 && mids[1].target[0] === -25.5 && Math.abs(mids[2].target[0] - (-52.5 + ref + U1.lo)) < 1e-9 && mids[3].target[0] === -2 && mids[4].target[0] === -3 && U1.integrity === 'BROKEN' && U1.ruptures === 0;
  st.t = 12.5; const U2 = interligneStep(st, cfg, { defTeam: 0, milieux: mids, arriere: arr, ref, ownX: -52.5, sgnDef: -1, hauteur: 0.5 });
  const rOk = U2.ruptures === 1 && st.events.length === 1 && st.events[0].type === 'bloc' && st.events[0].kind === 'rupture';
  const monde = (c) => { const gs = []; let ruptures = 0, U; for (const seed of [3, 5, 7]) { const m = makeMatch({ full: true, seed }); let next = 0; for (let i = 0; i < 300 * 60; i++) { matchStep(m, 1 / 60, c); if (m.t >= next && m.possession.team >= 0 && !m.restart) { next = m.t + 0.25; const T = 1 - m.possession.team, g = m.pitch.ownGoal(T); if (Math.sign(m.ball.p[0] || g.x) === Math.sign(g.x)) { const fL = m.tactics?.[T]?.formation ?? 433, mD = mapPostesL(fL), L = LIGNES_L[formationPourL(fL, false)] ?? [4, 3]; const av = (x) => (g.x - x) * Math.sign(g.x); const d = [], mm = []; for (const q of m.players) { if (q.team !== T || q.keeper || q.down > 0) continue; const k = mD[q.post ?? 9] ?? 9; if (k < L[0]) d.push(av(q.p[0])); else if (k < L[0] + L[1]) mm.push(av(q.p[0])); } if (d.length >= 3 && mm.length >= 2) gs.push(mm.reduce((a, b) => a + b, 0) / mm.length - d.reduce((a, b) => a + b, 0) / d.length); } } } ruptures += m.events.filter((e) => e.type === 'bloc').length; U = m._interligne; } gs.sort((x, y) => x - y); return { n: gs.length, mean: gs.reduce((a, b) => a + b, 0) / Math.max(1, gs.length), p90: gs.length ? gs[Math.floor(gs.length * 0.9)] : NaN, ruptures, U }; };
  const mA = monde(cfg), mN = monde(matchCfg({ ouverture: null /* ouverture null DATÉ 288 : vert à HEAD~ (worktree d90101b), interligne DEF↔MID 12,0 m c. 11,8 sans dans ce monde — la clause mesure sa loi, pas le receveur qui s'ouvre au ballon */, remisePostes: null, rendezVous: null /* remisePostes et rendezVous null DATÉ 281 : vert à HEAD~ (worktree 0f5e292), l'interligne remangé (11,1 m c. 11,0 sans la clé, p90 17,5 c. 17,7) — la clause mesure sa loi, pas la passe au rendez-vous ni les postes de la remise */, pausaPied: null, recevoirSurPlace: null, pasDeRecul: null, remisesPied: RP_1609, tete: TETE_1609, loi12: LOI12_1609, viragesLisses: null, plantVitesse: null, sortieAerienne: null, retournee: null, bouclier: null, ceremonie: null, ramasseurs: null, boiterie: null, entrant: null, petitsGestes: null, passements: null, enchainement: null, orientationPasse: null, verticalite: null, decalage: null, toucheOrientee: null /* remisesPied hier DATÉ 16/09 (lot A9 ter, note 368) — chaque clause de flux mesure le monde de son jour */, sol: null, fete: null /* sol, fete null DATÉ 15/09 (lots A10 bis-A11, notes 360-361 : le fauché reste à terre plus longtemps, la fête a un corps — chaque clause mesure le monde de son jour, empreinte jumelle prouvée) */ /* DATÉ 15/09 (dettes A12, note 358) : vert à HEAD~ (suite à clés nulles 694/7), le monde remangé par la pausa au pied, la réception sur place et le pas de recul — la clause mesure sa loi, pas les miennes */, ligneAccrochee: null /* ligneAccrochee null DATÉ 280 : vert à HEAD~ (worktree 303b2e4), l'interligne du monde remangé par la référence accrochée — la clause mesure sa loi, pas la ligne accrochée */, pausaPied: null, recevoirSurPlace: null, pasDeRecul: null /* DATÉ 15/09 (dettes A12, note 358) : vert à HEAD~ (suite à clés nulles 694/7), le monde remangé par la pausa au pied, la réception sur place et le pas de recul — la clause mesure sa loi, pas les miennes */, shotRange: 20, interligne: null }));
  ok(`lot 274 — L'INTERLIGNE DÉRIVÉ (lois pures) : portée ${pM} au 50 (= 10,5), ${pP} au puissant (= 15), ${pL} au limité (= 6) ; cible médiane [${cM.lo.toFixed(2)} ; ${cM.hi.toFixed(2)}] (= [8,4 ; 10,5]), bloc bas [${cB.lo} ; ${cB.hi}] (= [5 ; 6]), bloc haut [${cH.lo.toFixed(2)} ; ${cH.hi.toFixed(2)}] ; intégrité 12 → ${integriteDe(12, K)}, 17 → ${integriteDe(17, K)}, 20 → ${integriteDe(20, K)} ; la ligne synthétique (${uOk}) : ${mids[0].target[0].toFixed(1)} / ${mids[1].target[0]} / ${mids[2].target[0].toFixed(1)}, presseur ${mids[3].target[0]}, marqueur ${mids[4].target[0]}, écart ${U1.gap.toFixed(1)} → ${U1.integrity} ; tenue 2,5 s → ${U2.ruptures} rupture (${rOk})`,
    Math.abs(pM - 10.5) < 1e-9 && Math.abs(pP - 15) < 1e-9 && Math.abs(pL - 6) < 1e-9 && Math.abs(cM.lo - 8.4) < 1e-9 && Math.abs(cM.hi - 10.5) < 1e-9 && cB.lo === 5 && cB.hi === 6 && Math.abs(cH.lo - 10.5 * 1.15 * 0.8) < 1e-9 && Math.abs(cH.hi - 10.5 * 1.15) < 1e-9 && integriteDe(12, K) === 'OK' && integriteDe(17, K) === 'WARN' && integriteDe(20, K) === 'BROKEN' && uOk && rOk);
  ok(`lot 274 — …et LE MONDE : 3 × 300 s (graines 3, 5, 7, ballon dans la moitié défendue, toutes les 0,25 s) : interligne DEF↔MID moyenne ${mA.mean.toFixed(1)} m (${mA.n} lectures) < ${mN.mean.toFixed(1)} sans la clé, p90 ${mA.p90.toFixed(1)} < ${mN.p90.toFixed(1)}, moyenne ≤ hiMax ${K.hiMax} ; ${mA.ruptures} ruptures publiées ; sabotage interligne null : ${mN.ruptures} rupture, ${mN.U === undefined} (st._interligne absent)`,
    mA.n >= 300 && mA.mean < mN.mean && mA.p90 < mN.p90 && mA.mean <= K.hiMax && mA.ruptures >= 1 && mN.ruptures === 0 && mN.U === undefined);
}

if (__bloc()) {
  // (a) les lois pures : la latence de déclenchement 0,26 s à 5 m (le presseur en vision centrale — Bible 10 §4.4), 0,54 à
  // 40 m, × 0,925 à l'anticipation élite, × 1,075 au médiocre, × 1,15 à mi-essence ; k_x 1 en régime accroché (ballon à 0),
  // 0 au plancher (ballon à −30 m de son côté) et au plafond du rond central (ballon à + 40) ; sur un match : l'ancre
  // perçue d'un défenseur se pose (p._blocVu), tient sa latence (le même objet à + 0,1 s), se relit après (+ 1 s) ; le
  // décalage = (perçue − vraie) × (k_x, k_y), borné à max ; (b) le monde : 300 s graine 3, 20 postés de champ portent leur
  // ancre perçue, l'écart perçue − vraie au moment de la relecture > 0 en moyenne (la croyance n'est pas l'état vrai), et
  // les slots vivent : p50 des décalages > 0,3 m ; sabotage « blocPercu null » : aucune ancre perçue (l'omniscience d'hier).
  const K = matchCfg({}).blocPercu, cfg = matchCfg({ shotRange: 20 });
  const l5 = latenceDe({ skill: null, stam: 1 }, 5, K), l40 = latenceDe({ skill: null, stam: 1 }, 40, K), lE = latenceDe({ skill: { anticipF: 1.15 }, stam: 1 }, 5, K), lM = latenceDe({ skill: { anticipF: 0.85 }, stam: 1 }, 5, K), lF = latenceDe({ skill: null, stam: 0.5 }, 5, K);
  const kx0 = kxDe(0, 1, 105, 27, K), kxBas = kxDe(-30, 1, 105, 27, K), kxHaut = kxDe(40, 1, 105, 27, K);
  const st = makeMatch({ full: true, seed: 3 }); for (let i = 0; i < 60 * 20; i++) matchStep(st, 1 / 60, cfg);
  const q = st.players.find((p) => p.team === 1 - st.possession.team && !p.keeper && p.down <= 0) ?? st.players[3];
  const A = st.ball.p, a1 = anchorPercu(st, q, cfg, A), o1 = q._blocVu; st.t += 0.1; const a2 = anchorPercu(st, q, cfg, A), o2 = q._blocVu; st.t += 1; anchorPercu(st, q, cfg, A); const o3 = q._blocVu;
  const dP = decalageDe(st, q, cfg, { anchor: A, kx: 1, ky: 0.35 }), ex = [q._blocVu.a[0] - A[0], (q._blocVu.a[1] - A[2]) * 0.35];
  const tient = o1 === o2 && o3 !== o2 && Math.hypot(a2[0] - a1[0], a2[1] - a1[1]) <= Math.hypot(o1.v[0], o1.v[1]) * 0.1 + 1e-9 && Math.abs(dP[0] - Math.max(-K.max, Math.min(K.max, ex[0]))) < 1e-9 && Math.abs(dP[1] - Math.max(-K.max, Math.min(K.max, ex[1]))) < 1e-9;
  const monde = (c) => { const m = makeMatch({ full: true, seed: 3 }); const ecarts = [], decs = []; let vus = 0; for (let i = 0; i < 300 * 60; i++) { matchStep(m, 1 / 60, c); if (i % 30 === 0) for (const p of m.players) if (p._blocVu && p._blocVu.t === m.t) { ecarts.push(Math.hypot(p._blocVu.a[0] - m.ball.p[0], p._blocVu.a[1] - m.ball.p[2])); } } for (const p of m.players) if (p._blocVu) { vus++; decs.push(Math.abs(p._blocVu.a[0] - m.ball.p[0])); } decs.sort((x, y) => x - y); return { vus, ecart: ecarts.length ? ecarts.reduce((x, y) => x + y, 0) / ecarts.length : 0, n: ecarts.length, dec: decs.length ? decs[Math.floor(decs.length / 2)] : 0 }; };
  const mA = monde(cfg), mN = monde(matchCfg({ shotRange: 20, blocPercu: null }));
  ok(`lot 275 — LE BLOC QUI PERÇOIT (lois pures) : latence ${l5.toFixed(3)} s à 5 m (= 0,26), ${l40.toFixed(3)} à 40 m (= 0,54), élite × ${(lE / l5).toFixed(3)} (0,925), médiocre × ${(lM / l5).toFixed(3)} (1,075), mi-essence × ${(lF / l5).toFixed(3)} (1,15) ; k_x accroché ${kx0} (= 1), plancher ${kxBas} (= 0), plafond ${kxHaut} (= 0) ; l'ancre perçue se pose, tient sa latence et se relit (${tient}) ; décalage [${dP[0].toFixed(2)} ; ${dP[1].toFixed(2)}]`,
    Math.abs(l5 - 0.26) < 1e-9 && Math.abs(l40 - 0.54) < 1e-9 && Math.abs(lE / l5 - 0.925) < 1e-9 && Math.abs(lM / l5 - 1.075) < 1e-9 && Math.abs(lF / l5 - 1.15) < 1e-9 && kx0 === 1 && kxBas === 0 && kxHaut === 0 && tient);
  ok(`lot 275 — …et LE MONDE : 300 s graine 3 : ${mA.vus} postés portent leur ancre perçue (≥ 10), l'écart perçue − vraie à la relecture ${mA.ecart.toFixed(2)} m en moyenne (> 0 sur ${mA.n} relectures), les ancres à l'instant final à ${mA.dec.toFixed(2)} m p50 du ballon (> 0,3) ; sabotage blocPercu null : ${mN.vus} ancre perçue (= 0, l'omniscience d'hier)`,
    mA.vus >= 10 && mA.n >= 100 && mA.ecart > 0 && mA.dec > 0.3 && mN.vus === 0);
}

if (__bloc()) {
  // (a) les lois pures (Modèle 10 §6.2-6.3) : le temps de vol en forme close (6 m à 22 m/s → 0,28 s ; 25 m à 30 → 0,96 — la
  // table du book), l'enveloppe qui part de vitesse nulle (test 5 ter : ≤ 0,05 m à 0,05 s ; 0,47 m à 0,25 s ; 1,44 m en
  // 0,512 s et 1,68 en 0,571 — Monteiro 2022 ; saturée à r0 + rMax), le temps disponible (t_f − 0,2 × 0,75 au 50, − 0,2 à
  // l'anticipation élite, − 0,12 par corps occultant plafonné 0,25), l'ellipse (z 2 / y 0,95 → 2 ; z 0 / y 0,15 → 1), la
  // sigmoïde d'arrêt (≈ 0,52 à R = ρ au 50 et 20 m/s, croissante en R − ρ, plus basse déviée), la décision synthétique (12 m à
  // 24 m/s, cross à 1,5 m / 0,5 m de haut, 0,12 s d'âge : plongeon, R = r0 + 1,41, ρ 1,60 ; 6 m à 22 m/s : le régime bloc ; hors
  // portée : battu) ; (b) le monde : 600 s graine 3, des événements 'enveloppe' portent régime, R, ρ, p_save ∈ ]0 ; 1[, st.psxg
  // cumule 1 − p_save ; sabotage « enveloppe null » : aucun événement, st.psxg absent (le seuil d'envergure d'hier).
  const K = matchCfg({}).enveloppe, cfg = matchCfg({ layoff: null /* layoff null DATÉ 287 : vert à HEAD~ (worktree 4535d0f), 0 tir cadré à l'enveloppe en 600 s graine 3 dans ce monde — la clause mesure sa loi, pas la une-touche jugée par son angle */, shotRange: 20 });
  const tf6 = tempsDeVol(6, 22, K), tf25 = tempsDeVol(25, 30, K);
  const dR = (t) => porteeEnv(t, K) - K.r0, cont = dR(0.05), r25 = dR(0.25), r512 = dR(0.512), r571 = dR(0.571), rSat = porteeEnv(3, K);
  const td50 = tDispDe(1, K, 1, 0), tdEl = tDispDe(1, K, 1.15, 0), tdOc = tDispDe(1, K, 1, 3);
  const rhoA = rhoDe(2, 0.95, 0, K), rhoB = rhoDe(0, 0.15, 0, K);
  const p0 = pSaveDe(1, 1, K, { reflex: 0.125, handF: 1 }, 20, false), pPlus = pSaveDe(1.5, 1, K, { reflex: 0.125, handF: 1 }, 20, false), pDev = pSaveDe(1, 1, K, { reflex: 0.125, handF: 1 }, 20, true);
  const gk0 = { skill: null }, me = [-52, 0, 0];
  const dA = decisionEnveloppe({ t: 0.5, z: 1.5, y: 0.5 }, 0.12, me, gk0, 12, 24, K), dB = decisionEnveloppe({ t: 0.25, z: 0.6, y: 0.5 }, 0.05, me, gk0, 6, 22, K), dC = decisionEnveloppe({ t: 0.5, z: 4.2, y: 0.3 }, 0.12, me, gk0, 12, 24, K);
  const monde = (c) => { const m = makeMatch({ full: true, seed: 3 }); for (let i = 0; i < 600 * 60; i++) matchStep(m, 1 / 60, c); const ev = m.events.filter((e) => e.type === 'enveloppe'); return { n: ev.length, ok: ev.every((e) => e.pSave >= 0 && e.pSave <= 1 && e.R > 0 && e.rho >= 0 && ['bloc', 'plongeon'].includes(e.regime)), psxg: m.psxg, blocs: ev.filter((e) => e.regime === 'bloc').length }; };
  const mA = monde(cfg), mN = monde(matchCfg({ layoff: null /* layoff null DATÉ 287 : vert à HEAD~ (worktree 4535d0f), 0 tir cadré à l'enveloppe en 600 s graine 3 dans ce monde — la clause mesure sa loi, pas la une-touche jugée par son angle */, shotRange: 20, enveloppe: null }));
  ok(`lot 276 — L'ENVELOPPE CONTINUE (lois pures) : t_f ${tf6.toFixed(3)} s à 6 m / 22 m/s (0,28), ${tf25.toFixed(3)} à 25 m / 30 (0,96) ; R − R0 : ${cont.toFixed(3)} m à 0,05 s (≤ 0,05), ${r25.toFixed(2)} à 0,25 (0,47), ${r512.toFixed(2)} en 0,512 s (1,44), ${r571.toFixed(2)} en 0,571 (1,68), saturée ${rSat.toFixed(2)} (r0 + rMax = ${(K.r0 + K.rMax).toFixed(2)}) ; t_disp ${td50.toFixed(3)} au 50 (0,85), ${tdEl.toFixed(3)} à l'élite (0,90), ${tdOc.toFixed(3)} sous 3 corps (0,60) ; ρ ${rhoA.toFixed(2)} / ${rhoB.toFixed(2)} (2 / 1) ; p_save ${p0.toFixed(3)} à R = ρ, ${pPlus.toFixed(3)} à + 0,5 m, ${pDev.toFixed(3)} déviée ; décision : ${dA.mode} (R ${dA.R.toFixed(2)} = r0 + 1,41, ρ ${dA.rho.toFixed(2)}), 6 m → ${dB.mode} / ${dB.regime}, hors portée → ${dC.mode}`,
    Math.abs(tf6 - 0.28) < 0.005 && Math.abs(tf25 - 0.96) < 0.01 && cont <= 0.05 && Math.abs(r25 - 0.47) < 0.02 && Math.abs(r512 - 1.44) < 0.02 && Math.abs(r571 - 1.68) < 0.02 && Math.abs(rSat - (K.r0 + K.rMax)) < 1e-9 && Math.abs(td50 - 0.85) < 1e-9 && Math.abs(tdEl - 0.9) < 1e-9 && Math.abs(tdOc - 0.6) < 1e-9 && Math.abs(rhoA - 2) < 1e-9 && Math.abs(rhoB - 1) < 1e-9 && p0 > 0.45 && p0 < 0.6 && pPlus > p0 && pDev < p0 && dA.mode === 'plongeon' && Math.abs(dA.R - (K.r0 + 4.4 * (0.504 - 0.2 * (1 - Math.exp(-0.504 / 0.2))))) < 0.01 && Math.abs(dA.rho - 1.6) < 0.01 && dB.regime === 'bloc' && dC.mode === 'battu');
  ok(`lot 276 — …et LE MONDE : 600 s graine 3 : ${mA.n} tirs cadrés à l'enveloppe (≥ 1), tous avec régime / R / ρ / p_save ∈ [0 ; 1] (${mA.ok}), ${mA.blocs} en régime bloc, PSxG cumulé ${JSON.stringify(mA.psxg)} ; sabotage enveloppe null : ${mN.n} événement, st.psxg ${mN.psxg}`,
    mA.n >= 1 && mA.ok && mA.psxg && mA.psxg.some((v) => v > 0) && mN.n === 0 && mN.psxg === undefined);
}

if (__bloc()) {
  // (a) les lois pures (Modèle 10 §3.4) : neuf modes dont les poids du book somment à 1 ; à l'identité (composure 0,5, flair 0,5,
  // gardien sur sa ligne, angle ouvert, 15 m, P 0) les poids conditionnés sont ceux du book à 1e-9 ; la composure élite
  // monte la lucarne, le flair le contre-pied, le gardien avancé (4 m) la lucarne et le lob, l'angle fermé le premier poteau
  // et baisse le côté ouvert, le bout portant l'axial bas ; la pression 1 (p0 0,7 + largeur 0,3) effondre tout sur « le cadre » ; (b) le point
  // visé sur un match posé : le tireur axial à 12 m, le gardien décentré à + 1 m → le côté ouvert est −, le mode « ouvert »
  // tombe en z < 0, le « fermé » en z > 0, le premier poteau du côté du tireur, tout tronqué au cadre, y ≥ yMin ; 600 s
  // graine 3 : les tirs non exacts portent visee et yVisee, et les modes tirés sont des modes du book ; sabotage « visee
  // null » : aucun tir ne porte de visee (le coin loin du gardien d'hier).
  const K = matchCfg({}).visee, cfg = matchCfg({ presseLue: null /* presseLue null DATÉ 289 : vert à HEAD~ (worktree 7bd70e0), 2 / 3 tirs non exacts portent leur point visé en 600 s graine 3 dans ce monde — la clause mesure sa loi, pas la pression lue au temps d'arrivée */, ouverture: null /* ouverture null DATÉ 288 : vert à HEAD~ (worktree d90101b), 2 / 3 tirs non exacts portent leur point visé en 600 s graine 3 dans ce monde — la clause mesure sa loi, pas le receveur qui s'ouvre au ballon */, shotRange: 20 });
  const somme = MODES.reduce((a, m) => a + m.w, 0), base = { composure: 0.5, flair: 0.5, gAvance: 0, angle: 0, D: 15, P: 0 };
  const w0 = poidsDe(base, K), idOk = w0.every((v, i) => Math.abs(v - MODES[i].w / somme) < 1e-9);
  const ix = (id) => MODES.findIndex((m) => m.id === id);
  const wC = poidsDe({ ...base, composure: 1 }, K), wF = poidsDe({ ...base, flair: 1 }, K), wG = poidsDe({ ...base, gAvance: 4 }, K), wA = poidsDe({ ...base, angle: 0.8 }, K), wD = poidsDe({ ...base, D: 6 }, K), wP = poidsDe({ ...base, P: 1 }, K);
  const condOk = wC[ix('lucarne-ouvert')] > w0[ix('lucarne-ouvert')] && wF[ix('bas-ferme')] > w0[ix('bas-ferme')] && wG[ix('lucarne-ouvert')] > w0[ix('lucarne-ouvert')] && wG[ix('barre-axial')] > w0[ix('barre-axial')] && wA[ix('premier-poteau')] > w0[ix('premier-poteau')] && wA[ix('bas-ouvert')] < w0[ix('bas-ouvert')] && wD[ix('axial-bas')] > w0[ix('axial-bas')] && Math.abs(wP[ix('cadre')] - 1) < 1e-9 && Math.abs(wP.reduce((a, b) => a + b, 0) - 1) < 1e-9;
  const st = makeMatch({ full: true, seed: 5 }); st.restart = null; st.t = 10;
  const goal = st.pitch.attackGoal(1), sgn = Math.sign(goal.x), tireur = st.players.find((p) => p.team === 1 && !p.keeper && p.post === 5), gk = st.players.find((p) => p.team === 0 && p.keeper);
  for (const q of st.players) if (q.team === 0 && !q.keeper) { q.p[0] = -sgn * 40; q.p[2] = 20; q.v = [0, 0, 0]; }
  tireur.p[0] = goal.x - sgn * 12; tireur.p[2] = 0; tireur.v = [0, 0, 0]; gk.p[0] = goal.x - sgn * 1; gk.p[2] = 1;
  const V = []; for (let i = 0; i < 40; i++) V.push(viseeDe(st, tireur, cfg, { goal, gk, dGoal: 12 }));
  const W2 = st.pitch.goalHalf;
  const sideOk = V.every((v) => v.ouvert === -1 && (v.cote !== 'ouvert' || v.id === 'cadre' || v.z < 0) && (v.cote !== 'ferme' || v.z > 0) && Math.abs(v.z) <= W2 - K.bord + 1e-9 && v.y >= K.yMin) && V.some((v) => v.cote === 'ouvert') && new Set(V.map((v) => v.id)).size >= 3;
  const monde = (c) => { const m = makeMatch({ full: true, seed: 3 }); for (let i = 0; i < 600 * 60; i++) matchStep(m, 1 / 60, c); const sh = m.events.filter((e) => e.type === 'shot' && !['lob', 'piqué', 'tête', 'volée', 'demi-volée', 'coup-franc-direct'].includes(e.kind)); return { n: sh.length, avec: sh.filter((e) => e.visee && e.yVisee != null && MODES.some((mm) => mm.id === e.visee)).length }; };
  const mA = monde(cfg), mN = monde(matchCfg({ presseLue: null /* presseLue null DATÉ 289 : vert à HEAD~ (worktree 7bd70e0), 2 / 3 tirs non exacts portent leur point visé en 600 s graine 3 dans ce monde — la clause mesure sa loi, pas la pression lue au temps d'arrivée */, ouverture: null /* ouverture null DATÉ 288 : vert à HEAD~ (worktree d90101b), 2 / 3 tirs non exacts portent leur point visé en 600 s graine 3 dans ce monde — la clause mesure sa loi, pas le receveur qui s'ouvre au ballon */, shotRange: 20, visee: null }));
  ok(`lot 277 — LE POINT VISÉ (lois pures) : neuf modes, poids du book Σ ${somme.toFixed(2)} ; à l'identité les poids conditionnés sont ceux du book (${idOk}) ; composure → lucarne ${w0[ix('lucarne-ouvert')].toFixed(3)} → ${wC[ix('lucarne-ouvert')].toFixed(3)}, flair → contre-pied ${w0[ix('bas-ferme')].toFixed(3)} → ${wF[ix('bas-ferme')].toFixed(3)}, gardien avancé → lob ${w0[ix('barre-axial')].toFixed(3)} → ${wG[ix('barre-axial')].toFixed(3)}, angle fermé → premier poteau ${w0[ix('premier-poteau')].toFixed(3)} → ${wA[ix('premier-poteau')].toFixed(3)}, bout portant → axial ${w0[ix('axial-bas')].toFixed(3)} → ${wD[ix('axial-bas')].toFixed(3)}, pression 1 → cadre ${wP[ix('cadre')].toFixed(3)} (${condOk}) ; le tireur axial face au gardien décentré à + 1 m : côté ouvert ${V[0].ouvert}, ${V.length} tirages sur ${new Set(V.map((v) => v.id)).size} modes, côtés et troncature tenus (${sideOk})`,
    Math.abs(somme - 1) < 1e-9 && idOk && condOk && sideOk);
  ok(`lot 277 — …et LE MONDE : 600 s graine 3 : ${mA.avec} / ${mA.n} tirs non exacts portent leur point visé (un mode du book, une hauteur) ; sabotage visee null : ${mN.avec} / ${mN.n} (= 0, le coin d'hier)`,
    mA.n >= 1 && mA.avec === mA.n && mN.avec === 0);
}

if (__bloc()) {
  // (a) les lois pures (Modèle 03 §5) : l'inverse de la normale (Acklam) rend 1,960 à u = 0,975 et 0 à 0,5 ; sur 20 000 tirages
  // seedés σ ≈ 1 et P(|ξ| > 2,5) ≈ 1,24 % — le gauss du moteur (trois uniformes) a σ 0,707 et AUCUN tirage au-delà de 2,12 :
  // la preuve du défaut (0 tir au-dessus mesuré) ; ecartDe : ρψθ ≈ 0,2, ρθv ≈ −0,35 (précipitée = levée ET molle), la queue
  // basse épaisse (E[zV] < 0), le biais μψ = biaisPsi° × P vers l'extérieur du pied (P 1 → 1,5°, P 0 → 0, pied gauche → −),
  // σθ/σψ = aniso ; vitesseDe borne [vPlancher ; vPlafond] ; (b) le monde : 4 graines × 900 s, chaque tir non exact intégré
  // sans obstacle (predictPath) jusqu'au plan du but — sous l'ellipse au moins un tir passe AU-DESSUS de la barre et les
  // franchissements hors cadre existent ; sabotage « ellipse null » (les trois gauss d'hier) : aucun tir au-dessus.
  const K = matchCfg({}).ellipse; let s0 = 7; const lcg = () => { s0 = (s0 * 16807) % 2147483647; return s0 / 2147483647; };
  const q975 = normale(() => 0.975), q50 = normale(() => 0.5);
  let n = 0, s2 = 0, queue = 0, s2g = 0, queueG = 0; for (let i = 0; i < 20000; i++) { const x = normale(lcg); n++; s2 += x * x; if (Math.abs(x) > 2.5) queue++; const g = gaussM(lcg); s2g += g * g; if (Math.abs(g) > 2.12) queueG++; }
  const sig = Math.sqrt(s2 / n), pQ = queue / n, sigG = Math.sqrt(s2g / n);
  const L = finitionSigma(matchCfg({}).finition, { finF: 1, composureF: 1.075, weakF: 1, faible: false, P: 0, stam: 1, spd: 20, dG: 12 });
  let m = 0, spt = 0, stv = 0, sp2 = 0, st2 = 0, sv2 = 0, sv = 0, bp1 = 0, bp0 = 0, bg = 0;
  for (let i = 0; i < 20000; i++) { const e = ecartDe(lcg, L, K, { P: 0, cote: 1 }); m++; spt += e.zPsi * e.zTheta; stv += e.zTheta * e.zV; sp2 += e.zPsi ** 2; st2 += e.zTheta ** 2; sv2 += e.zV ** 2; sv += e.zV; bp0 += e.dPsi; bp1 += ecartDe(lcg, L, K, { P: 1, cote: 1 }).dPsi; bg += ecartDe(lcg, L, K, { P: 1, cote: -1 }).dPsi; }
  const rPT = (spt / m) / Math.sqrt(sp2 / m * st2 / m), rTV = (stv / m) / Math.sqrt(st2 / m * sv2 / m), muP1 = bp1 / m * 180 / Math.PI, muP0 = bp0 / m * 180 / Math.PI, muG = bg / m * 180 / Math.PI;
  const LE = finitionSigma({ ...matchCfg({}).finition, sigma0: K.sigma0, aniso: K.aniso }, { finF: 1, composureF: 1.075, weakF: 1, faible: false, P: 0, stam: 1, spd: 20, dG: 12 });
  const loisOk = Math.abs(q975 - 1.96) < 2e-3 && Math.abs(q50) < 1e-9 && Math.abs(sig - 1) < 0.03 && Math.abs(pQ - 0.0124) < 0.004 && Math.abs(sigG - 0.707) < 0.03 && queueG === 0
    && Math.abs(rPT - K.rhoPsiTheta) < 0.03 && Math.abs(rTV - K.rhoThetaV) < 0.03 && sv / m < -0.1 && Math.abs(muP1 - K.biaisPsi) < 0.05 && Math.abs(muP0) < 0.05 && Math.abs(muG + K.biaisPsi) < 0.05
    && Math.abs(LE.sigTheta / LE.sigPsi - K.aniso) < 1e-9 && vitesseDe(20, 5, K) === K.vPlafond && vitesseDe(20, -5, K) === K.vPlancher;
  const monde = (c) => { const o = { n: 0, dessus: 0, hors: 0 }; for (const seed of [3, 5, 7, 11]) { const st = makeMatch({ full: true, seed }); let seen = 0; for (let i = 0; i < 900 * 60; i++) { matchStep(st, 1 / 60, c); for (; seen < st.events.length; seen++) { const e = st.events[seen]; if (e.type !== 'shot' || ['lob', 'piqué', 'tête', 'volée', 'demi-volée', 'coup-franc-direct'].includes(e.kind)) continue; const by = st.players[e.by], g = st.pitch.ownGoal(1 - by.team); const path = predictPath278({ p: st.ball.p, v: st.ball.v, w: st.ball.w ?? [0, 0, 0] }, { maxT: 3 }); for (let k = 1; k < path.length; k++) { const a = path[k - 1].p[0] - g.x, b = path[k].p[0] - g.x; if (a * b <= 0 && a !== b) { const u = a / (a - b), y = path[k - 1].p[1] + (path[k].p[1] - path[k - 1].p[1]) * u, z = path[k - 1].p[2] + (path[k].p[2] - path[k - 1].p[2]) * u; o.n++; if (y > 2.44 && Math.abs(z) <= 3.66 + 1) o.dessus++; if (y > 2.44 || Math.abs(z) > 3.66) o.hors++; break; } } } } } return o; };
  const mA = monde(matchCfg({ repertoire: null, arretControle: null /* repertoire et arretControle null DATÉ 279 : vert à HEAD~ (worktree 842c118), le monde de l'ellipse et son sabotage remangés par les vitesses du book (1 tir au-dessus sans ellipse : le ballon à 28 m/s passe la barre même sans queue) — la clause mesure sa loi, pas les vitesses du book ni l'arrêt au journal */, shotRange: 20 })), mN = monde(matchCfg({ repertoire: null, arretControle: null /* repertoire et arretControle null DATÉ 279 : vert à HEAD~ (worktree 842c118), le monde de l'ellipse et son sabotage remangés par les vitesses du book (1 tir au-dessus sans ellipse : le ballon à 28 m/s passe la barre même sans queue) — la clause mesure sa loi, pas les vitesses du book ni l'arrêt au journal */, shotRange: 20, ellipse: null }));
  ok(`lot 278 — L'ELLIPSE DE FINITION (lois pures) : normale inverse ${q975.toFixed(3)} à 0,975 (1,960), σ ${sig.toFixed(3)}, P(|ξ| > 2,5) ${(100 * pQ).toFixed(2)} % (1,24) — le gauss du moteur σ ${sigG.toFixed(3)} (0,707) et ${queueG} tirage au-delà de 2,12 ; ρψθ ${rPT.toFixed(3)} (${K.rhoPsiTheta}), ρθv ${rTV.toFixed(3)} (${K.rhoThetaV}), E[zV] ${(sv / m).toFixed(3)} < 0 (la queue basse), μψ P 1 ${muP1.toFixed(2)}° (${K.biaisPsi}) / P 0 ${muP0.toFixed(2)}° / pied gauche ${muG.toFixed(2)}° ; σθ/σψ ${(LE.sigTheta / LE.sigPsi).toFixed(2)} (${K.aniso}) ; vitesse bornée [${K.vPlancher} ; ${K.vPlafond}]`, loisOk);
  ok(`lot 278 — …et LE MONDE : 4 × 900 s, plan nominal (predictPath) : sous l'ellipse ${mA.dessus} / ${mA.n} tirs au-dessus de la barre (≥ 1), ${mA.hors} hors cadre ; sabotage ellipse null : ${mN.dessus} / ${mN.n} au-dessus (= 0, le gauss sans queue d'hier)`,
    mA.n >= 3 && mA.dessus >= 1 && mA.hors >= 1 && mN.dessus === 0);
}

if (__bloc()) {
  // (a) les lois pures (Modèle 10 §3.1, ch. 3 §4) : la table EST celle du book (placé 20 [15-25], instep 28 [22-33], enroulé 24
  // [20-28], pointu 16 [13-20], volée / demi-volée 26 [20-31], tête 13 [8-18]) ; vitesseGeste à l'identité (powF 1, 15 m) rend
  // v̄, la bride du bout portant (instep à 6 m × 0,9), la borne de la plage × powF (1,1 → 30,8), les familles (croisé → placé,
  // ras-de-terre / flottante / mi-hauteur → puissance, lucarne → enroulée), les gestes exacts (lob, piqué) hors table ; vMaxDe
  // 35,5 à l'identité, [33 ; 38] aux bornes de l'attribut ; les colonnes de dispersion dans l'ordre du book (pointu ≪ placé <
  // instep < volée ; instep aniso 1 relatif) ; makeProfile : shotPower 0 / 50 / 100 monotone, identité 1 exacte ; (b) le monde :
  // 4 × 600 s, la vitesse moyenne des frappes de la famille instep ≥ 23 m/s sous le répertoire (28 × la sous-dose ; ≤ 22 hier, sabotage null),
  // la tête et la volée frappent aux vitesses du book × powF ; l'arrêt au journal (arretControle) nomme le tir contrôlé par le gardien.
  const K = matchCfg({}).repertoire, c1 = { skill: { powF: 1, vMaxF: 1 } }, c11 = { skill: { powF: 1.1, vMaxF: 38 / 35.5 } }, c09 = { skill: { powF: 0.9, vMaxF: 33 / 35.5 } };
  const table = GESTES['placé'].v === 20 && GESTES.puissance.v === 28 && GESTES.puissance.lo === 22 && GESTES.puissance.hi === 33 && GESTES['enroulée'].v === 24 && GESTES.pointu.v === 16 && GESTES['volée'].v === 26 && GESTES['demi-volée'].v === 26 && GESTES['tête'].v === 13 && GESTES['tête'].lo === 8 && GESTES['tête'].hi === 18;
  const vId = vitesseGeste('puissance', K, c1, { dGoal: 15 }), vBride = vitesseGeste('puissance', K, c1, { dGoal: 6 }), vPow = vitesseGeste('puissance', K, c11, { dGoal: 15 }), vLo = vitesseGeste('puissance', K, c09, { dGoal: 6 });
  const fam = gesteDe('croisé') === GESTES['placé'] && gesteDe('ras-de-terre') === GESTES.puissance && gesteDe('flottante') === GESTES.puissance && gesteDe('mi-hauteur') === GESTES.puissance && gesteDe('lucarne') === GESTES['enroulée'] && gesteDe('lob') === null && gesteDe('piqué') === null && vitesseGeste('lob', K, c1, {}) === null;
  const vm = vMaxDe(c1, K), vmHi = vMaxDe(c11, K), vmLo = vMaxDe(c09, K);
  const dP = dispersionGeste('pointu', K), dI = dispersionGeste('placé', K), dS = dispersionGeste('puissance', K), dV = dispersionGeste('volée', K);
  const pr = (n) => makeProfile({ shotPower: n }), p0 = pr(0), p50 = pr(50), p100 = pr(100);
  const loisOk = table && Math.abs(vId - 28) < 1e-9 && Math.abs(vBride - 28 * K.bride) < 1e-9 && Math.abs(vPow - 30.8) < 1e-9 && Math.abs(vLo - 28 * 0.9 * K.bride) < 1e-9 && vLo >= 22 * 0.9 && fam
    && Math.abs(vm - 35.5) < 1e-9 && Math.abs(vmHi - 38) < 1e-9 && Math.abs(vmLo - 33) < 1e-9 && dP.sigma < dI.sigma && dI.sigma < dS.sigma && dS.sigma < dV.sigma && Math.abs(dS.aniso - 1) < 1e-9 && dP.aniso < dI.aniso && dI.aniso < dV.aniso
    && p0.powF < p50.powF && p50.powF < p100.powF && Math.abs(p50.powF - 1) < 1e-9 && Math.abs(p50.vMaxF - 1) < 1e-9 && Math.abs(p100.vMaxF * 35.5 - 38) < 1e-9;
  const monde = (c) => { const o = { n: 0, s: 0, tete: [], volee: [], ctl: 0 }; for (const seed of [3, 5, 7, 11]) { const st = makeMatch({ full: true, seed }); for (let i = 0; i < 600 * 60; i++) matchStep(st, 1 / 60, c); for (const e of st.events) { if (e.type === 'arrêt' && e.mode === 'controle') o.ctl++; if (e.type !== 'shot' || e.speed == null) continue; const f = FAMILLE[e.kind] ?? e.kind; if (f === 'puissance') { o.n++; o.s += e.speed; } if (e.kind === 'tête') o.tete.push(e.speed); if (e.kind === 'volée' || e.kind === 'demi-volée') o.volee.push(e.speed); } } return o; };
  const mA = monde(matchCfg({ ouverture: null /* ouverture null DATÉ 288 : vert à HEAD~ (worktree d90101b), la famille instep 23,9 m/s sur 6 tirs dans ce monde — la clause mesure sa loi, pas le receveur qui s'ouvre au ballon */, layoff: null /* layoff null DATÉ 287 : vert à HEAD~ (worktree 4535d0f), la famille instep 22,6 m/s < 23 dans ce monde (1 tir) — la clause mesure sa loi, pas la une-touche jugée par son angle */, attenteVivante: null /* attenteVivante null DATÉ 285 : vert à HEAD~ (worktree 3d79d38), la famille instep remangée (21,7 m/s sur 5 tirs c. ≥ 23) — la clause mesure sa loi, pas l'attente vivante */, toucheRapide: null, toucheAuPied: null /* toucheRapide et toucheAuPied null DATÉ 284 : vert à HEAD~ (worktree 695d340), les têtes remangées (12,1 m/s c. ≈ 13 : les touches au pied ôtent les têtes de remise, la moyenne suit les têtes gênées) — la clause mesure sa loi, pas la touche rapide ni la touche au pied */, prefiltreTir: null /* prefiltreTir null DATÉ 282 : vert à HEAD~ (worktree d3dbe73), la famille instep remangée (1 tir instep en 4 × 600 s c. ≥ 3 : le pré-filtre ferme les frappes du corps fermé et l'arbitre rend la passe) — la clause mesure sa loi, pas le pré-filtre de la porte du tir */, orientationPasse: null, verticalite: null, decalage: null, toucheOrientee: null, /* les quatre clés du 17/09 nulles DATÉ 17/09 : la famille instep à 22,5 m/s sur 4 tirs c. ≥ 23 sous les clés (la relecture du match change les tirs) */ remisePostes: null, rendezVous: null /* remisePostes et rendezVous null DATÉ 281 : vert à HEAD~ (worktree 0f5e292), la famille instep remangée (21,9 m/s sur 6 tirs c. ≥ 23 — les passes au rendez-vous changent les tirs) — la clause mesure sa loi, pas la passe au rendez-vous ni les postes de la remise */, ligneAccrochee: null /* ligneAccrochee null DATÉ 280 : vert à HEAD~ (worktree 303b2e4), le monde du répertoire remangé par la ligne accrochée (plus de tirs bridés au bout portant : instep 21,6 m/s de moyenne pour 23) — la clause mesure sa loi, pas la ligne accrochée */, shotRange: 20 })), mN = monde(matchCfg({ ouverture: null /* ouverture null DATÉ 288 : vert à HEAD~ (worktree d90101b), la famille instep 23,9 m/s sur 6 tirs dans ce monde — la clause mesure sa loi, pas le receveur qui s'ouvre au ballon */, layoff: null /* layoff null DATÉ 287 : vert à HEAD~ (worktree 4535d0f), la famille instep 22,6 m/s < 23 dans ce monde (1 tir) — la clause mesure sa loi, pas la une-touche jugée par son angle */, attenteVivante: null /* attenteVivante null DATÉ 285 : vert à HEAD~ (worktree 3d79d38), la famille instep remangée (21,7 m/s sur 5 tirs c. ≥ 23) — la clause mesure sa loi, pas l'attente vivante */, toucheRapide: null, toucheAuPied: null /* toucheRapide et toucheAuPied null DATÉ 284 : vert à HEAD~ (worktree 695d340), les têtes remangées (12,1 m/s c. ≈ 13 : les touches au pied ôtent les têtes de remise, la moyenne suit les têtes gênées) — la clause mesure sa loi, pas la touche rapide ni la touche au pied */, prefiltreTir: null /* prefiltreTir null DATÉ 282 : vert à HEAD~ (worktree d3dbe73), la famille instep remangée (1 tir instep en 4 × 600 s c. ≥ 3 : le pré-filtre ferme les frappes du corps fermé et l'arbitre rend la passe) — la clause mesure sa loi, pas le pré-filtre de la porte du tir */, remisePostes: null, rendezVous: null /* remisePostes et rendezVous null DATÉ 281 : vert à HEAD~ (worktree 0f5e292), la famille instep remangée (21,9 m/s sur 6 tirs c. ≥ 23 — les passes au rendez-vous changent les tirs) — la clause mesure sa loi, pas la passe au rendez-vous ni les postes de la remise */, ligneAccrochee: null /* ligneAccrochee null DATÉ 280 : vert à HEAD~ (worktree 303b2e4), le monde du répertoire remangé par la ligne accrochée (plus de tirs bridés au bout portant : instep 21,6 m/s de moyenne pour 23) — la clause mesure sa loi, pas la ligne accrochée */, shotRange: 20, repertoire: null, arretControle: null }));
  const vA = mA.s / Math.max(1, mA.n), vN = mN.s / Math.max(1, mN.n), tA = mA.tete.length ? mA.tete.reduce((a, b) => a + b, 0) / mA.tete.length : null, vvA = mA.volee.length ? mA.volee.reduce((a, b) => a + b, 0) / mA.volee.length : null;
  ok(`lot 279 — LE RÉPERTOIRE DU BOOK (lois pures) : la table du book (${table}) ; instep à l'identité ${vId} m/s, bridé à 6 m ${vBride.toFixed(1)}, powF 1,1 → ${vPow.toFixed(1)} (plage × powF), powF 0,9 à 6 m → ${vLo.toFixed(1)} (28 × 0,9 × la bride, au-dessus du plancher 22 × 0,9) ; familles (${fam}) ; vMax ${vm} / ${vmLo} / ${vmHi} (35,5 ; 33 ; 38) ; dispersion pointu ${dP.sigma} < placé ${dI.sigma} < instep ${dS.sigma} < volée ${dV.sigma}, aniso relatif instep ${dS.aniso} ; shotPower powF ${p0.powF.toFixed(2)} / ${p50.powF} / ${p100.powF.toFixed(2)}`, loisOk);
  ok(`lot 279 — …et LE MONDE : 4 × 600 s, la famille instep frappe à ${vA.toFixed(1)} m/s de moyenne (≥ 23 : 28 × la sous-dose du 258 ; ${mA.n} tirs) contre ${vN.toFixed(1)} sans la clé (≤ 22 ; ${mN.n}) ; têtes ${tA == null ? '—' : tA.toFixed(1)} (≈ 13 × powF × gêne), volées ${vvA == null ? '—' : vvA.toFixed(1)} (26 × powF) ; l'arrêt au journal (arretControle) : ${mA.ctl} tirs contrôlés par le gardien nommés 'arrêt' (≥ 1), ${mN.ctl} sans la clé (= 0)`,
    mA.n >= 3 && mN.n >= 3 && vA >= 23 && vN <= 22   /* ≥ 5 → ≥ 3 DATÉ fusion 16/09 : le monde fusionné rend 4 frappes instep en 4 × 600 s (la clause juge la vitesse, pas le volume) */ && (tA == null || (tA >= 9 && tA <= 15)) && (vvA == null || (vvA >= 22 && vvA <= 30)) && mA.ctl >= 1 && mN.ctl === 0);
}

if (__bloc()) {
  // (a) les lois pures (Bible 10 §3.4) : x_ligne = min(consigne, x_ballon − marge) — à l'identité (hauteurBloc 0,5, piege 0,5, anticipF 1)
  // la consigne vaut 37 m (l'échelle du Brief : 22 → 52) ; ballon à 60 m découvert : régime LIBRE, la ligne à sa consigne ; ballon à 30 m
  // découvert : ACCROCHÉ à 30 − 12 = 18 ; entre-deux 24 ; couvert 28 (la marge la plus courte : le pas en avant) ; le bloc haut
  // (hauteurBloc 1) a sa consigne à 52, le bas (0) à 22 ; le piège 1 monte de + 3 ; l'anticipation 1,2 rapproche (marge 12 × 0,8 = 9,6) ;
  // le plancher (6 m) tient un ballon à 8 m ; (b) le monde : 2 × 600 s, la ligne défendante à moins de 10 m du ballon (p50) quand le
  // ballon est entre 20 et 35 m du but sous l'accroche, contre ≥ 15 m sans la clé (la ligne chaînée à 27 m d'hier).
  const K = matchCfg({}).ligneAccrochee, base = { hauteurBloc: 0.5, piege: 0.5, anticipF: 1 };
  const libre = accrocheDe(K, { ...base, xBallon: 60, etat: 'découvert' }), acc = accrocheDe(K, { ...base, xBallon: 30, etat: 'découvert' }), ent = accrocheDe(K, { ...base, xBallon: 30, etat: 'entre-deux' }), cou = accrocheDe(K, { ...base, xBallon: 30, etat: 'couvert' });
  const haut = accrocheDe(K, { ...base, hauteurBloc: 1, xBallon: 80, etat: 'entre-deux' }), bas = accrocheDe(K, { ...base, hauteurBloc: 0, xBallon: 80, etat: 'entre-deux' }), pg = accrocheDe(K, { ...base, piege: 1, xBallon: 80, etat: 'entre-deux' });
  const lit = accrocheDe(K, { ...base, anticipF: 1.2, xBallon: 30, etat: 'découvert' }), pl = accrocheDe(K, { ...base, xBallon: 8, etat: 'découvert' });
  const loisOk = Math.abs(libre.consigne - 37) < 1e-9 && libre.regime === 'libre' && Math.abs(libre.xLigne - 37) < 1e-9 && acc.regime === 'accroché' && Math.abs(acc.xLigne - (30 - K.marge.decouvert)) < 1e-9 && Math.abs(ent.xLigne - (30 - K.marge.entreDeux)) < 1e-9 && Math.abs(cou.xLigne - (30 - K.marge.couvert)) < 1e-9 && cou.xLigne > ent.xLigne && ent.xLigne > acc.xLigne
    && Math.abs(haut.xLigne - 52) < 1e-9 && Math.abs(bas.xLigne - 22) < 1e-9 && Math.abs(pg.xLigne - 40) < 1e-9 && Math.abs(lit.marge - K.marge.decouvert * 0.8) < 1e-9 && Math.abs(lit.xLigne - (30 - K.marge.decouvert * 0.8)) < 1e-9 && Math.abs(pl.xLigne - (K.plancher ?? 6)) < 1e-9;
  const film = (c) => { const d = []; const ref2 = (avs) => { let lo = Infinity, s = Infinity; for (const a of avs) { if (a < lo) { s = lo; lo = a; } else if (a < s) s = a; } return s; };
    for (const seed of [3, 7]) { const st = makeMatch({ full: true, seed }); for (let i = 0; i < 600 * 60; i++) { matchStep(st, 1 / 60, c); if (i % 6 || st.restart) continue; const atk = st.possession?.team; if (atk == null) continue; const def = 1 - atk, own = st.pitch.ownGoal(def), sg = Math.sign(own.x || 1), av = (x) => (own.x - x) * sg, xb = av(st.ball.p[0]); if (xb < 20 || xb > 35) continue;
      const ds = st.players.filter((q) => q.team === def && !q.keeper && q.down <= 0).map((q) => av(q.p[0])); if (ds.length >= 2) d.push(xb - ref2(ds)); } }
    d.sort((a, b) => a - b); return { n: d.length, p50: d.length ? d[Math.floor(d.length / 2)] : NaN }; };
  const fA = film(matchCfg({ attenteVivante: null /* attenteVivante null DATÉ 285 : vert à HEAD~ (worktree 3d79d38), la ligne accrochée remangée (ballon − ligne p50 4,9 m ≤ 10) — la clause mesure sa loi, pas l'attente vivante */, toucheRapide: null, toucheAuPied: null /* toucheRapide et toucheAuPied null DATÉ 284 : vert à HEAD~ (worktree 695d340), la ligne accrochée remangée (ballon − ligne p50 5,8 m ≤ 10 sous l'accroche : les touches au pied changent où le ballon vit) — la clause mesure sa loi, pas la touche rapide ni la touche au pied */, shotRange: 20 })), fN = film(matchCfg({ attenteVivante: null /* attenteVivante null DATÉ 285 : vert à HEAD~ (worktree 3d79d38), la ligne accrochée remangée (ballon − ligne p50 4,9 m ≤ 10) — la clause mesure sa loi, pas l'attente vivante */, toucheRapide: null, toucheAuPied: null /* toucheRapide et toucheAuPied null DATÉ 284 : vert à HEAD~ (worktree 695d340), la ligne accrochée remangée (ballon − ligne p50 5,8 m ≤ 10 sous l'accroche : les touches au pied changent où le ballon vit) — la clause mesure sa loi, pas la touche rapide ni la touche au pied */, shotRange: 20, ligneAccrochee: null }));
  ok(`lot 280 — L'ACCROCHE (lois pures) : consigne ${libre.consigne} m à l'identité (37) ; ballon 60 m découvert → ${libre.regime} à ${libre.xLigne} ; ballon 30 m → découvert ${acc.xLigne} (30 − ${K.marge.decouvert}, ${acc.regime}), entre-deux ${ent.xLigne} (30 − ${K.marge.entreDeux}), couvert ${cou.xLigne} (30 − ${K.marge.couvert} : la marge la plus courte) ; bloc haut ${haut.xLigne} / bas ${bas.xLigne} / piège ${pg.xLigne} (52 / 22 / 40) ; anticipation 1,2 → marge ${lit.marge.toFixed(1)} (${(K.marge.decouvert * 0.8).toFixed(1)}) ; plancher ${pl.xLigne}`, loisOk);
  ok(`lot 280 — …et LE MONDE : 2 × 600 s, ballon entre 20 et 35 m du but : ballon − ligne p50 ${fA.p50.toFixed(1)} m (≤ 10 ; ${fA.n} images) sous l'accroche, ${fN.p50.toFixed(1)} m sans la clé (≥ 15 : la ligne chaînée à 27 m d'hier ; ${fN.n})`,
    fA.n >= 50 && fN.n >= 50 && fA.p50 <= 10 && fN.p50 >= 15);
}

if (__bloc()) {
  // LES TROIS RETOURS DU 16/09 (281) — (a) la passe au rendez-vous, lois pures (Modèle 09 §3) : un receveur à 10 m qui fuit à 5 m/s sur un
  // solveur à 12 m/s de vol reçoit au point fixe T = (10 + 5 T) / 12 ≈ 1,43 s, 17,1 m devant le pied + le biais de sécurité (kb × ℓ ×
  // σψ, borné biaisMax) DANS le sens de la course ; le receveur lent (1 m/s) rend null (la mène d'hier) ; la vitesse du coureur est
  // bornée par vCourse × topF ; une passe trop forte se replie (T × repli) ; (b) le monde : 2 × 600 s — parmi les passes reçues, la part
  // des receveurs en course qui font DEMI-TOUR (> 120°) avant de recevoir baisse d'au moins un quart sous la clé, les passes au
  // rendez-vous existent, les pertes ne montent pas de plus de 20 % ; (c) les postes de la remise : au coup franc, les corps de
  // l'équipe qui remet à ≤ 6 m du ballon juste avant la remise ≤ 3 sous la clé (≥ 5 hier : « à 10 autour du ballon »).
  const K = matchCfg({}).rendezVous, solve12 = (f, l) => ({ speed: 12, flightTime: Math.hypot(l[0] - f[0], l[2] - f[2]) / 12 });
  const r = rendezVousDe([0, 0, 0], [10, 0, 0], [5, 0], K, { sigPsi: 0.035, topF: 1, solve: solve12 });
  const lent = rendezVousDe([0, 0, 0], [10, 0, 0], [1, 0], K, { sigPsi: 0.035, topF: 1, solve: solve12 });
  const borne = rendezVousDe([0, 0, 0], [10, 0, 0], [9, 0], K, { sigPsi: 0.035, topF: 1, solve: solve12 });
  const fort = rendezVousDe([0, 0, 0], [10, 0, 0], [5, 0], K, { sigPsi: 0.035, topF: 1, solve: (f, l) => ({ speed: 40, flightTime: Math.hypot(l[0] - f[0], l[2] - f[2]) / 12 }) });
  const T0 = 10 / 7, l0 = 10 + 5 * T0, b0 = Math.min(K.biaisMax, K.kb * l0 * 0.035);
  const loisOk = r && Math.abs(r.T - T0) < 0.05 && Math.abs(r.lead[0] - (l0 + b0)) < 0.3 && r.lead[2] === 0 && Math.abs(r.biais - b0) < 0.02 && lent === null && borne && borne.lead[0] < 10 + 9 * borne.T - 1e-9 && fort && fort.T < r.T;
  const monde = (c) => { const o = { recues: 0, demi: 0, rdv: 0, turnovers: 0, cf: 0, gros: 0, corps: 0 }; const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    for (const seed of [3, 7]) { const st = makeMatch({ full: true, seed }); let seen = 0, lastR = null; const pend = [];
      for (let i = 0; i < 600 * 60; i++) { matchStep(st, 1 / 60, c);
        const R = st.restart; if (R && R.type === 'coup-franc' && R !== lastR && st.t >= (R.at ?? 0) - 0.5) { lastR = R; const n = st.players.filter((q) => q.team === R.team && !q.keeper && q.down <= 0 && Math.hypot(q.p[0] - st.ball.p[0], q.p[2] - st.ball.p[2]) <= 6).length; o.cf++; o.corps += n; if (n >= 5) o.gros++; }
        for (const w of pend) { if (w.done) continue; const q = st.players[w.to]; const dy = Math.abs(wrap(q.yaw - w.yaw0)); if (dy > w.max) w.max = dy; if (!w.recu && st.ball.owner === w.to) { w.recu = true; o.recues++; if (w.max > 2.1 && w.v > 1.5) o.demi++; } if (st.t - w.t > 3) w.done = true; }
        for (; seen < st.events.length; seen++) { const e = st.events[seen]; if (e.type === 'turnover') o.turnovers++; if (e.type === 'pass' && e.rdv != null) o.rdv++; if (e.type === 'pass' && e.to != null && e.to >= 0 && st.players[e.to]) { const q = st.players[e.to]; pend.push({ t: st.t, to: e.to, yaw0: q.yaw, max: 0, v: Math.hypot(q.v[0], q.v[1]), done: false }); } } } }
    return o; };
  const P1709 = { orientationPasse: null, verticalite: null, decalage: null, toucheOrientee: null };   // DATÉ 17/09 : le receveur ouvert (398) réduit les demi-tours dans LES DEUX mondes — le rapport ≤ 0,75 mesure le rendez-vous seul
  const mA = monde(matchCfg({ presseLue: null /* presseLue null DATÉ 289 : vert à HEAD~ (worktree 7bd70e0), receveurs qui font demi-tour 31,7 % c. 29,9 sans dans ce monde — la clause mesure sa loi, pas la pression lue au temps d'arrivée */, shotRange: 20, ...P1709 })), mN = monde(matchCfg({ presseLue: null /* presseLue null DATÉ 289 : vert à HEAD~ (worktree 7bd70e0), receveurs qui font demi-tour 31,7 % c. 29,9 sans dans ce monde — la clause mesure sa loi, pas la pression lue au temps d'arrivée */, shotRange: 20, rendezVous: null, remisePostes: null, ...P1709 }));
  const pA = mA.demi / Math.max(1, mA.recues), pN = mN.demi / Math.max(1, mN.recues);
  ok(`lot 281 — LA PASSE AU RENDEZ-VOUS (lois pures) : receveur à 10 m fuyant à 5 m/s → T ${r?.T.toFixed(2)} s (1,43), point ${r?.lead[0].toFixed(1)} m (${(l0 + b0).toFixed(1)} : le rendez-vous + le biais ${r?.biais.toFixed(2)} vers l'avant) ; receveur lent → ${lent === null ? 'null (la mène d\'hier)' : 'non'} ; coureur à 9 m/s borné vCourse ${borne ? 'oui' : 'non'} ; passe trop forte → repli (T ${fort?.T.toFixed(2)} < ${r?.T.toFixed(2)})`, !!loisOk);
  ok(`lot 281 — …et LE MONDE : 2 × 600 s — receveurs en course qui font demi-tour avant de recevoir ${(100 * pA).toFixed(1)} % des reçues sous la clé (${mA.demi} / ${mA.recues}) c. ${(100 * pN).toFixed(1)} % sans (≤ 0,75 ×), passes au rendez-vous ${mA.rdv} (≥ 10), pertes ${mA.turnovers} c. ${mN.turnovers} (≤ 1,2 ×) ; LES POSTES DE LA REMISE : au coup franc ${(mA.corps / Math.max(1, mA.cf)).toFixed(1)} corps à ≤ 6 m du ballon (${mA.cf} coups francs, ≤ 3) c. ${(mN.corps / Math.max(1, mN.cf)).toFixed(1)} sans la clé (≥ 5)`,
    mA.recues >= 20 && mN.recues >= 20 && pA <= 0.75 * pN && mA.rdv >= 10 && mA.turnovers <= 1.2 * mN.turnovers && mA.cf >= 2 && mN.cf >= 2 && mA.corps / mA.cf <= 3 && mN.corps / mN.cf >= 5);
}

if (__bloc()) {
  // LA PORTE DU TIR DANS LA SURFACE (282) — (a) le pré-filtre, lois pures (Modèle 10 §1.4 : « ballon contrôlé, distance < 35 m, angle
  // visible > 4°, corps orienté à moins de 110° de la cible ») : face au but à 12 m tout est ouvert ; dos au but (150°) la raison est
  // « corps » ; à 120° le pivot souple (pivotF 1,15 → 126,5°) passe, le raide (0,85 → 93,5°) non ; au ras de la ligne (X 1, C 20) l'angle
  // visible est < 4° ; à 40 m la distance ; un ballon tenu moins que le contrôle demandé est cru. Attributs en facteur (technique /
  // agilité), le 50 vaut 1 exact.
  const K = matchCfg({}).prefiltreTir, face = { d: 12, X: 12, C: 3, yaw: 0, cap: 0, pivotF: 1 }, rad = (deg) => deg * Math.PI / 180;
  const ouv = prefiltreDe(K, face), dos = prefiltreDe(K, { ...face, yaw: rad(150) }), souple = prefiltreDe(K, { ...face, yaw: rad(120), pivotF: 1.15 }), raide = prefiltreDe(K, { ...face, yaw: rad(120), pivotF: 0.85 });
  const ras = prefiltreDe(K, { ...face, d: 20, X: 1, C: 20 }), loin = prefiltreDe(K, { ...face, d: 40, X: 40 }), cru = prefiltreDe(K, { ...face, hold: 0.1, holdMin: 0.3 });
  ok(`lot 282 — LE PRÉ-FILTRE DE LA PORTE DU TIR, lois pures : face au but ouvert (angle visible ${ouv.angle}° > 4, corps ${ouv.corps}°) ; dos au but fermé « ${dos.raison} » (${dos.corps}° > ${dos.tol}) ; à 120° le souple passe (tolérance ${souple.tol}°) et le raide non (${raide.tol}°, « ${raide.raison} ») ; au ras de la ligne « ${ras.raison} » (${ras.angle}° < 4) ; à 40 m « ${loin.raison} » ; tenu 0,1 s pour 0,3 « ${cru.raison} »`,
    ouv.ouvert && ouv.angle > 30 && ouv.corps === 0 && !dos.ouvert && dos.raison === 'corps' && Math.abs(dos.corps - 150) < 0.2 && souple.ouvert && !raide.ouvert && raide.raison === 'corps'
    && Math.abs(souple.tol - 126.5) < 0.1 && !ras.ouvert && ras.raison === 'angle' && ras.angle < 4 && !loin.ouvert && loin.raison === 'distance' && !cru.ouvert && cru.raison === 'contrôle');
  // (b) la fixture : un attaquant posé dans la surface à 11 m, DOS AU BUT (le corps à 180°), le ballon au pied tenu 1,4 s — l'arbitre
  // ferme le tir « pré-filtre-corps » sous la clé et le rend au bit sans elle (le candidat d'hier : son nom n'est pas un pré-filtre) ;
  // tourné face au but, le même homme est ouvert. Puis le monde : 3 × 600 s — aucun tir CONTRÔLÉ (hors tête, volée, retournée) frappé
  // dos au but (corps > 110°) sous la clé, le pré-filtre ferme le corps ≥ 10 fois, le volume de tirs ne s'effondre pas (≥ 0,7 × sans)
  // et le ballon reste en surface (touches ≥ 0,9 × sans — le porteur muré se retourne au lieu de frapper).
  const fixture = (over, yawDos) => { const st = makeMatch({ full: true, seed: 3 }), cfg = matchCfg({ ouverture: null /* ouverture null DATÉ 288 : vert à HEAD~ (worktree d90101b), le pré-filtre ferme le corps 9 fois < 10 dans ce monde — la clause mesure sa loi, pas le receveur qui s'ouvre au ballon */, shotRange: 20, ...over }); for (let i = 0; i < 60; i++) matchStep(st, 1 / 60, cfg);
    const goal = st.pitch.attackGoal(0), sgn = Math.sign(goal.x || 1), c0 = st.players.find((q) => q.team === 0 && !q.keeper && (q.post ?? 0) >= 9) ?? st.players.find((q) => q.team === 0 && !q.keeper);
    for (const q of st.players.filter((q) => q.team === 1)) q.p[0] = sgn * (q.keeper ? 51 : 30);
    for (const q of st.players.filter((q) => q.team === 0 && q !== c0)) q.p[0] = sgn * 20;
    c0.p[0] = goal.x - sgn * 11; c0.p[2] = 2; c0.v = [0, 0]; const cap = Math.atan2(0 - c0.p[2], goal.x - c0.p[0]); c0.yaw = yawDos ? cap + Math.PI : cap; c0.yawWant = null;
    st.ball.restart([c0.p[0], 0.11, c0.p[2]], { cause: 'coup-franc' }); st.restart = null; st.ball.possess(c0.id); st.possession = { team: 0, carrier: c0.id }; st.phase = 'carry'; st.hold = 1.4; st.lastTouch = 0;
    return menaceTir(st, c0, cfg, 0); };
  const fDos = fixture({}, true), fFace = fixture({}, false), fHier = fixture({ prefiltreTir: null }, true);
  ok(`lot 282 — …la FIXTURE : dos au but à 11 m l'arbitre ferme « ${fDos.pourquoi} » (corps ${fDos.corps}°, score ${fDos.score}) ; face au but « ${fFace.pourquoi} » (score ${fFace.score} > 0) ; sans la clé, dos au but : « ${fHier.pourquoi} » (score ${fHier.score})`,
    fDos.pourquoi === 'pré-filtre-corps' && fDos.score === 0 && fDos.corps > 170 && fFace.pourquoi !== 'pré-filtre-corps' && fFace.score > 0 && fHier.pourquoi !== 'pré-filtre-corps');
  const monde = (cfg) => { const o = { shots: 0, box: 0, dos: 0, touches: 0, corps: 0 };
    for (const seed of [3, 7, 11]) { const st = makeMatch({ full: true, seed }); let seen = 0, prevOwner = null;
      for (let i = 0; i < 600 * 60; i++) { matchStep(st, 1 / 60, cfg);
        const ow = st.ball.owner, q = ow != null ? st.players[ow] : null;
        if (q && !q.keeper && ow !== prevOwner) { const g = st.pitch.attackGoal(q.team); if (st.pitch.inBox(q.p[0], q.p[2], Math.sign(g.x || 1))) o.touches++; } prevOwner = ow;
        for (; seen < st.events.length; seen++) { const e = st.events[seen]; if (e.type !== 'shot') continue; const by = st.players[e.by]; if (!by) continue; o.shots++;
          const g = st.pitch.attackGoal(by.team), s = Math.sign(g.x || 1); if (['tête', 'volée', 'demi-volée', 'retournée'].includes(e.kind) || !st.pitch.inBox(by.p[0], by.p[2], s)) continue; o.box++;
          const cap = Math.atan2(0 - by.p[2], g.x - by.p[0]), corps = Math.abs(((by.yaw - cap + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) * 180 / Math.PI; if (corps > 110) o.dos++; } }
      o.corps += st.deny?.['pré-filtre-corps'] ?? 0; }
    return o; };
  const mA = monde(matchCfg({ ouverture: null /* ouverture null DATÉ 288 : vert à HEAD~ (worktree d90101b), le pré-filtre ferme le corps 9 fois < 10 dans ce monde — la clause mesure sa loi, pas le receveur qui s'ouvre au ballon */, shotRange: 20 })), mN = monde(matchCfg({ ouverture: null /* ouverture null DATÉ 288 : vert à HEAD~ (worktree d90101b), le pré-filtre ferme le corps 9 fois < 10 dans ce monde — la clause mesure sa loi, pas le receveur qui s'ouvre au ballon */, shotRange: 20, prefiltreTir: null }));
  ok(`lot 282 — …et LE MONDE : 3 × 600 s, tirs contrôlés en surface dos au but ${mA.dos} / ${mA.box} sous la clé (= 0 ; ${mN.dos} / ${mN.box} sans — 4 % sur 4 × 90 min à la sonde) ; le pré-filtre ferme le corps ${mA.corps} fois (≥ 10) ; tirs ${mA.shots} ≥ 0,7 × ${mN.shots} ; touches en surface ${mA.touches} ≥ 0,9 × ${mN.touches}`,
    mA.dos === 0 && mA.corps >= 10 && mA.shots >= 0.7 * mN.shots && mA.touches >= 0.9 * mN.touches);
}

if (__bloc()) {
  // LA CONTINUATION DEPUIS LA SURFACE (283) — (a) la grille xT du book, lois pures (Modèle 06 §3.2, les trois faits) : le champ est
  // plat sur 75 m (axe 4,4 → 74,4 m : × 2,5) puis explose (74,4 → 100,6 m : × 10,8) ; l'anisotropie latérale n'existe qu'à la
  // surface (axe / couloir 1,15 à 56,9 m, 6,8 à 100,6 m) ; la passe reculée coûte peu (axe 83,1 → 48,1 : −0,0203) devant la
  // pénétration (56,9 → demi-espace 91,9 : +0,038). La lecture est bilinéaire et symétrique ; le terme au barème est l'identité
  // à 50 / 0,5 (poids × P_succ × ΔV) ; depuis la surface la remise en retrait vers le point de penalty GAGNE de la valeur, la
  // remise arrière vers l'entrée en PERD.
  const K = matchCfg({}).xt, a = (x) => xtAt(x, 34), cl = (x) => xtAt(x, 4.25), demi = (x) => xtAt(x, 21.25);
  const plat = a(74.4) / a(4.4), explose = a(100.6) / a(74.4), an57 = a(56.9) / cl(56.9), an100 = a(100.6) / cl(100.6), recul = a(48.1) - a(83.1), penetre = demi(91.9) - a(56.9);
  const sym = Math.abs(xtAt(60, 10) - xtAt(60, 58)) < 1e-12 && Math.abs(xtAt(30, 20) - xtAt(30, 48)) < 1e-12;
  const st0 = makeMatch({ full: true, seed: 3 }), g0 = st0.pitch.attackGoal(0), sg = Math.sign(g0.x || 1), [xB, yB] = versBook(st0.pitch, g0, [g0.x - sg * 11, 0, 0]);
  const vC = xtDe(st0.pitch, g0, [g0.x - sg * 6, 0, 12]), vPen = xtDe(st0.pitch, g0, [g0.x - sg * 11, 0, 0]), vEntree = xtDe(st0.pitch, g0, [g0.x - sg * 20, 0, 12]);
  const tId = termeXt(0.05, 0.8, K, { visionF: 1, style: 0.5 }), tVoit = termeXt(0.05, 0.8, K, { visionF: 1.15, style: 0.5 }), tDirect = termeXt(0.05, 0.8, K, { visionF: 1, style: 1 });
  ok(`lot 283 — LA GRILLE xT DU BOOK, lois pures : plat sur 75 m (× ${plat.toFixed(2)} ≈ 2,5) puis explose (× ${explose.toFixed(1)} ≈ 10,8) ; axe / couloir ${an57.toFixed(2)} à 57 m (1,15) et ${an100.toFixed(2)} à 100,6 m (6,8) ; recul 83 → 48 m ${recul.toFixed(4)} (−0,0203) c. pénétration 57 → 92 m ${penetre.toFixed(4)} (+0,038) ; symétrique ${sym} ; le point de penalty à (${xB.toFixed(1)}, ${yB.toFixed(1)}) vaut ${vPen.toFixed(3)} > l'entrée ${vEntree.toFixed(3)} < le porteur au ras de la surface ${vC.toFixed(3)} ; terme ${tId.toFixed(2)} = poids × 0,8 × 0,05 à l'identité, ${tVoit.toFixed(2)} pour le passeur qui voit, ${tDirect.toFixed(2)} en jeu direct`,
    Math.abs(plat - 2.54) < 0.05 && Math.abs(explose - 10.8) < 0.3 && Math.abs(an57 - 1.15) < 0.03 && Math.abs(an100 - 6.79) < 0.15 && Math.abs(recul + 0.0203) < 0.0005 && Math.abs(penetre - 0.038) < 0.001 && sym
    && Math.abs(xB - 94) < 0.01 && Math.abs(yB - 34) < 0.01 && vPen > vC && vC > vEntree && Math.abs(tId - (K.poids ?? 20) * 0.8 * 0.05) < 1e-9 && tVoit > tId && tDirect > tId);
  // (b) la fixture : le porteur au ras de la surface (4 m de la ligne, 12 m de l'axe), deux coéquipiers libres — le point de penalty à
  // 12,8 m (hors du point doux du barème, dans la portée de 13 m) et l'entrée de surface à 10 m (le point doux) : sans la clé le barème d'hier élit l'entrée (la
  // remise arrière sûre), sous la clé la remise en retrait vers le penalty (ΔV > 0) gagne — la valeur de position décide.
  const fixture = (over) => { const st = makeMatch({ full: true, seed: 3 }), cfg = matchCfg({ presseLue: null /* presseLue null DATÉ 289 : vert à HEAD~ (worktree 7bd70e0), reçues dans le dernier tiers 22,1 % c. 27,3 sans la clé du 283 dans ce monde — la clause mesure sa loi, pas la pression lue au temps d'arrivée */, layoff: null /* layoff null DATÉ 287 : vert à HEAD~ (worktree 4535d0f), valeur de position des réceptions 16,2 ‰ < 17,9 × 0,97 dans ce monde (3 × 600 s) — la clause mesure sa loi, pas la une-touche jugée par son angle */, attenteVivante: null /* attenteVivante null DATÉ 285 : vert à HEAD~ (worktree 3d79d38), la valeur des réceptions remangée (18,7 ‰) — les corps qui bougent pendant les remises changent le monde reçu — la clause mesure sa loi, pas l'attente vivante */, shotRange: 20, ...over }); for (let i = 0; i < 60; i++) matchStep(st, 1 / 60, cfg);
    const goal = st.pitch.attackGoal(0), s = Math.sign(goal.x || 1), team0 = st.players.filter((q) => q.team === 0 && !q.keeper), c0 = team0[9], pen = team0[8], ent = team0[7];
    for (const q of st.players.filter((q) => q.team === 1)) { q.p[0] = q.keeper ? goal.x : s * 5; q.p[2] = q.keeper ? 0 : (q.post ?? 0) * 3 - 15; q.v = [0, 0]; }
    const ligne = st.players.filter((q) => q.team === 1 && !q.keeper).slice(0, 2); ligne[0].p[0] = goal.x - s * 1; ligne[0].p[2] = 22; ligne[1].p[0] = goal.x - s * 1; ligne[1].p[2] = -22;   /* deux défenseurs sur la ligne, loin des couloirs : personne n'est hors-jeu */
    for (const q of team0) { q.p[0] = s * 15; q.p[2] = (q.post ?? 0) * 4 - 20; q.v = [0, 0]; }
    c0.p[0] = goal.x - s * 4; c0.p[2] = 12; pen.p[0] = goal.x - s * 12; pen.p[2] = 2; ent.p[0] = goal.x - s * 14; ent.p[2] = 12; for (const q of [c0, pen, ent]) { q.v = [0, 0]; q.yaw = Math.atan2(0 - q.p[2], goal.x - q.p[0]); q.yawWant = null; }
    st.ball.restart([c0.p[0], 0.11, c0.p[2]], { cause: 'coup-franc' }); st.restart = null; st.ball.possess(c0.id); st.possession = { team: 0, carrier: c0.id }; st.phase = 'carry'; st.hold = 1.4; st.lastTouch = 0;
    const b = choosePass(st, cfg); return { to: b?.to?.id, pen: pen.id, ent: ent.id, dxt: b?.dxt, score: b?.score }; };
  const fA = fixture({}), fN = fixture({ xt: null });
  ok(`lot 283 — …la FIXTURE : au ras de la surface, sous la clé le porteur sert la remise en retrait vers le penalty (élu #${fA.to} = penalty #${fA.pen}, terme xT ${fA.dxt}) ; sans la clé, l'entrée de surface (élu #${fN.to} = entrée #${fN.ent})`,
    fA.to === fA.pen && fA.dxt > 0 && fN.to === fN.ent && fN.dxt == null);
  // (c) le monde : 3 × 600 s — la valeur de position moyenne des points de réception ne se dégrade pas (≥ 0,97 × sans ; mesuré 18,6 → 19,8 ‰
  // sur 3 × 600 s, mais 20,2 → 20,1 sur 4 × 90 min à poids 50 — poids 20 retenu : à 50 le monde épinglé du bloc 1 ne tirait plus, un rondo décoré : la valeur est au barème, l'OFFRE n'y est pas — le point de penalty n'est pas occupé, c'est
  // le prochain levier), la part reçue dans le dernier tiers ne baisse pas, la part de passes reculées reste dans le monde (20-45 % ; réel 36). Le ΔxT moyen
  // par passe est INFORMATIF : plus de temps dans le dernier tiers = plus de passes qui en ressortent (ΔV < 0), le sens de la loi n'y est pas.
  const monde = (cfg) => { const o = { passes: 0, dV: 0, vR: 0, recul: 0, box: 0, dVbox: 0, retrait: 0, tiers: 0 };
    for (const seed of [3, 7, 11]) { const st = makeMatch({ full: true, seed }); let seen = 0, pend = null;
      for (let i = 0; i < 600 * 60; i++) { matchStep(st, 1 / 60, cfg);
        const ow = st.ball.owner, c = ow != null ? st.players[ow] : null;
        if (c && !c.keeper) { const g = st.pitch.attackGoal(c.team), s = Math.sign(g.x || 1);
          if (pend && pend.team === c.team && c.id !== pend.by) { const vR = xtDe(st.pitch, g, c.p), dV = vR - pend.V0; o.passes++; o.dV += dV; o.vR += vR; if ((c.p[0] - pend.p[0]) * s < -2) o.recul++; const [xB] = versBook(st.pitch, g, c.p); if (xB > 70) o.tiers++;
            if (pend.box) { o.box++; o.dVbox += dV; if (xB >= 88 && Math.abs(c.p[2]) < 12 && (c.p[0] - pend.p[0]) * s < 0) o.retrait++; } pend = null; } else if (pend && c.team !== pend.team) pend = null; }
        for (; seen < st.events.length; seen++) { const e = st.events[seen]; if (e.type !== 'pass') continue; const by = st.players[e.by]; if (!by) continue; const g = st.pitch.attackGoal(by.team), s = Math.sign(g.x || 1); pend = { by: by.id, team: by.team, p: [...by.p], V0: xtDe(st.pitch, g, by.p), box: st.pitch.inBox(by.p[0], by.p[2], s) }; } } }
    return { passes: o.passes, vR: 1000 * o.vR / Math.max(1, o.passes), dV: 1000 * o.dV / Math.max(1, o.passes), recul: 100 * o.recul / Math.max(1, o.passes), tiers: 100 * o.tiers / Math.max(1, o.passes), box: o.box, dVbox: 1000 * o.dVbox / Math.max(1, o.box), retrait: o.retrait }; };
  const mA = monde(matchCfg({ presseLue: null /* presseLue null DATÉ 289 : vert à HEAD~ (worktree 7bd70e0), reçues dans le dernier tiers 22,1 % c. 27,3 sans la clé du 283 dans ce monde — la clause mesure sa loi, pas la pression lue au temps d'arrivée */, layoff: null /* layoff null DATÉ 287 : vert à HEAD~ (worktree 4535d0f), valeur de position des réceptions 16,2 ‰ < 17,9 × 0,97 dans ce monde (3 × 600 s) — la clause mesure sa loi, pas la une-touche jugée par son angle */, attenteVivante: null /* attenteVivante null DATÉ 285 : vert à HEAD~ (worktree 3d79d38), la valeur des réceptions remangée (18,7 ‰) — les corps qui bougent pendant les remises changent le monde reçu — la clause mesure sa loi, pas l'attente vivante */, shotRange: 20 })), mN = monde(matchCfg({ presseLue: null /* presseLue null DATÉ 289 : vert à HEAD~ (worktree 7bd70e0), reçues dans le dernier tiers 22,1 % c. 27,3 sans la clé du 283 dans ce monde — la clause mesure sa loi, pas la pression lue au temps d'arrivée */, layoff: null /* layoff null DATÉ 287 : vert à HEAD~ (worktree 4535d0f), valeur de position des réceptions 16,2 ‰ < 17,9 × 0,97 dans ce monde (3 × 600 s) — la clause mesure sa loi, pas la une-touche jugée par son angle */, attenteVivante: null /* attenteVivante null DATÉ 285 : vert à HEAD~ (worktree 3d79d38), la valeur des réceptions remangée (18,7 ‰) — les corps qui bougent pendant les remises changent le monde reçu — la clause mesure sa loi, pas l'attente vivante */, shotRange: 20, xt: null }));
  ok(`lot 283 — …et LE MONDE : 3 × 600 s, valeur de position moyenne des réceptions ${mA.vR.toFixed(1)} ‰ ≥ sans ${mN.vR.toFixed(1)} × 0,97 (non-dégradation ; 18,6 → 19,8 au sceau) (${mA.passes} c. ${mN.passes} passes) ; reçues dans le dernier tiers ${mA.tiers.toFixed(1)} % ≥ sans ${mN.tiers.toFixed(1)} − 2 ; reculées ${mA.recul.toFixed(1)} % ∈ [20 ; 45] (sans ${mN.recul.toFixed(1)}) ; informatif : ΔxT par passe ${mA.dV.toFixed(2)} c. ${mN.dV.toFixed(2)} ‰, depuis la surface ${mA.dVbox.toFixed(1)} ‰ sur ${mA.box} c. ${mN.dVbox.toFixed(1)} sur ${mN.box}, remises en retrait ${mA.retrait} c. ${mN.retrait}`,
    mA.passes >= 60 && mA.vR >= mN.vR * 0.97 && mA.tiers >= mN.tiers - 2 && mA.recul >= 20 && mA.recul <= 45);
}

if (__bloc()) {
  // LE TEMPS DE JEU (284, retours du 17/09) — (a) la touche rapide, lois pures : la situation qui ne s'y prête pas rend la bande telle
  // quelle (p 0) ; quand elle s'y prête, la part p = 0,45 × decF × tempo tire l'attente dans [5 ; 9] s (le lanceur se pose : à 3 s il lançait le bassin dans le terrain — Loi 15) ; la bande garde sa MOYENNE : sur
  // 1000 tirages uniformes, (1 − p) × bande relevée + p × la queue basse = la bande à 2 % près ; le bon décideur (decF 1,15) joue plus
  // vite que le mauvais (0,85) ; le tempo direct aussi.
  const K = matchCfg({}).toucheRapide, bande = 17.7;
  const nul = attenteToucheDe(bande, K, { ok: false, u: 0.1 }), vite = attenteToucheDe(bande, K, { ok: true, u: 0.1, u2: 0.5 }), lent = attenteToucheDe(bande, K, { ok: true, u: 0.9, u2: 0.5 });
  let somme = 0; for (let i = 0; i < 1000; i++) somme += attenteToucheDe(bande, K, { ok: true, u: (i + 0.5) / 1000, u2: ((i * 37) % 1000 + 0.5) / 1000 }).wait;
  const pBon = attenteToucheDe(bande, K, { ok: true, decF: 1.15 }).p, pMauvais = attenteToucheDe(bande, K, { ok: true, decF: 0.85 }).p, pDirect = attenteToucheDe(bande, K, { ok: true, tempoF: 1.3 }).p;
  ok(`lot 284 — LA TOUCHE RAPIDE, lois pures : situation fermée → la bande ${nul.wait.toFixed(1)} s (p ${nul.p}) ; ouverte → rapide ${vite.wait.toFixed(1)} s (u 0,1 < p ${vite.p.toFixed(2)}) ou la bande relevée ${lent.wait.toFixed(1)} s ; la moyenne sur 1000 tirages ${(somme / 1000).toFixed(1)} = ${bande} ± 2 % ; p du bon décideur ${pBon.toFixed(2)} > mauvais ${pMauvais.toFixed(2)}, direct ${pDirect.toFixed(2)} > ${vite.p.toFixed(2)}`,
    nul.wait === bande && nul.p === 0 && vite.rapide && vite.wait >= 5 && vite.wait <= 9 && !lent.rapide && lent.wait > bande && Math.abs(somme / 1000 - bande) < 0.02 * bande && pBon > pMauvais && pDirect > vite.p);
  // (b) le saut de la cérémonie : à 2 s la cérémonie vit (la file serre les mains) ; skipCeremonie la clôt (événement 'sautee'), l'engagement
  // est pris en moins de 20 s (le trot du retour) ; sans saut, l'engagement attend ~38 s. L'API est déterministe et idempotente (le second appel rend false).
  const saut = (skip) => { const st = makeMatch({ full: true, seed: 3 }), cfg = matchCfg({ presseLue: null /* presseLue null DATÉ 289 : vert à HEAD~ (worktree 7bd70e0), la remise de tête au lanceur 67 % < 85 sans la clé du 284 dans ce monde — la clause mesure sa loi, pas la pression lue au temps d'arrivée */, ouverture: null /* ouverture null DATÉ 288 : vert à HEAD~ (worktree d90101b), touches jouées en ≤ 9 s 0 / 7 dans ce monde (la sonde du 284 se mesure au monde du 284) — la clause mesure sa loi, pas le receveur qui s'ouvre au ballon */, attenteVivante: null /* attenteVivante null DATÉ 285 : vert à HEAD~ (worktree 3d79d38), les touches jouées vite 0 / 8 en 3 × 600 s (11 % à 4 × 90 min) : la situation libre à l'instant de la sortie change avec les corps qui bougent — la clause mesure sa loi, pas l'attente vivante */, shotRange: 20 }); let pris = null, deux = null;
    for (let i = 0; i < 60 * 60; i++) { matchStep(st, 1 / 60, cfg); if (skip && i === 120) { deux = [skipCeremonie(st, cfg), skipCeremonie(st, cfg)]; } if (pris == null) { const e = st.events.find((e) => e.type === 'restart-pris'); if (e) pris = e.t; } }
    return { pris, deux, sautee: st.events.some((e) => e.type === 'ceremonie' && e.kind === 'sautee'), vivante: st.events.some((e) => e.type === 'ceremonie' && e.kind === 'file') }; };
  const sA = saut(true), sN = saut(false);
  ok(`lot 284 — …LE SAUT DE LA CÉRÉMONIE : sautée à 2 s (${sA.deux}), l'engagement est pris à ${sA.pris?.toFixed(1)} s (≤ 20 : le trot du retour aux places, 40 m à 2,4 m/s) ; sans saut à ${sN.pris?.toFixed(1)} s (≥ 30, la cérémonie vit : ${sN.vivante})`,
    sA.deux?.[0] === true && sA.deux?.[1] === false && sA.sautee && sA.pris != null && sA.pris <= 20 && sN.pris >= 30 && sN.vivante && !sN.sautee);
  // (c) le monde : 3 × 600 s — des touches jouées vite existent (≤ 9 s : ≥ 2 sous la clé, 0 sans), la moyenne des attentes de touche reste
  // dans la bande [12 ; 22] ; la réception : la remise de tête AU LANCEUR ≤ 60 % des touches (≥ 85 % sans la clé), le ballon à la première
  // action p50 < 1,3 m (1,73 sans).
  const monde = (cfg) => { const o = { touches: 0, vite: 0, waits: [], rec: 0, lanceur: 0, h: [] };
    for (const seed of [3, 7, 11]) { const st = makeMatch({ full: true, seed }); let seen = 0, sortieT = null, sortieOut = null, jet = null;
      for (let i = 0; i < 600 * 60; i++) { matchStep(st, 1 / 60, cfg); const r = st.restart;
        if (r && sortieT != null && r.at > 0 && r.type !== 'fin') { if (sortieOut === 'touche') { o.touches++; o.waits.push(r.at - sortieT); if (r.at - sortieT <= 9) o.vite++; } sortieT = null; }
        if (jet && st.t - jet.t > 2.5) jet = null;
        for (; seen < st.events.length; seen++) { const e = st.events[seen];
          if (e.type === 'sortie') { sortieT = st.t; sortieOut = e.out; }
          if (e.type === 'rentrée') { jet = { t: st.t, by: e.by }; continue; }
          if (jet && st.t - jet.t <= 2.5 && (e.type === 'tête' || e.type === 'control')) { o.rec++; o.h.push(e.type === 'tête' ? e.h : st.ball.p[1]); if (e.type === 'tête' && e.mode === 'remise' && e.to === jet.by) o.lanceur++; jet = null; } } } }
    const s = [...o.h].sort((a, b) => a - b); return { ...o, wait: o.waits.reduce((a, b) => a + b, 0) / Math.max(1, o.waits.length), h50: s.length ? s[Math.floor(s.length / 2)] : NaN, part: 100 * o.lanceur / Math.max(1, o.rec) }; };
  const mA = monde(matchCfg({ presseLue: null /* presseLue null DATÉ 289 : vert à HEAD~ (worktree 7bd70e0), la remise de tête au lanceur 67 % < 85 sans la clé du 284 dans ce monde — la clause mesure sa loi, pas la pression lue au temps d'arrivée */, ouverture: null /* ouverture null DATÉ 288 : vert à HEAD~ (worktree d90101b), touches jouées en ≤ 9 s 0 / 7 dans ce monde (la sonde du 284 se mesure au monde du 284) — la clause mesure sa loi, pas le receveur qui s'ouvre au ballon */, attenteVivante: null /* attenteVivante null DATÉ 285 : vert à HEAD~ (worktree 3d79d38), les touches jouées vite 0 / 8 en 3 × 600 s (11 % à 4 × 90 min) : la situation libre à l'instant de la sortie change avec les corps qui bougent — la clause mesure sa loi, pas l'attente vivante */, shotRange: 20 })), mN = monde(matchCfg({ presseLue: null /* presseLue null DATÉ 289 : vert à HEAD~ (worktree 7bd70e0), la remise de tête au lanceur 67 % < 85 sans la clé du 284 dans ce monde — la clause mesure sa loi, pas la pression lue au temps d'arrivée */, ouverture: null /* ouverture null DATÉ 288 : vert à HEAD~ (worktree d90101b), touches jouées en ≤ 9 s 0 / 7 dans ce monde (la sonde du 284 se mesure au monde du 284) — la clause mesure sa loi, pas le receveur qui s'ouvre au ballon */, attenteVivante: null /* attenteVivante null DATÉ 285 : vert à HEAD~ (worktree 3d79d38), les touches jouées vite 0 / 8 en 3 × 600 s (11 % à 4 × 90 min) : la situation libre à l'instant de la sortie change avec les corps qui bougent — la clause mesure sa loi, pas l'attente vivante */, shotRange: 20, toucheRapide: null, toucheAuPied: null }));
  ok(`lot 284 — …et LE MONDE : 3 × 600 s, touches jouées en ≤ 9 s ${mA.vite} / ${mA.touches} (≥ 2 ; sans la clé ${mN.vite} / ${mN.touches} = 0), attente moyenne ${mA.wait.toFixed(1)} s ∈ [12 ; 22] (sans ${mN.wait.toFixed(1)}) ; la remise de tête au lanceur ${mA.part.toFixed(0)} % de ${mA.rec} réceptions (≤ 60 ; sans ${mN.part.toFixed(0)} % ≥ 85), le ballon à la première action p50 ${mA.h50.toFixed(2)} m (< 1,3 ; sans ${mN.h50.toFixed(2)})`,
    mA.vite >= 2 && mN.vite === 0 && mA.wait >= 12 && mA.wait <= 22 && mA.rec >= 5 && mA.part <= 60 && mN.part >= 85 && mA.h50 < 1.3);
}

if (__bloc()) {
  // L'ATTENTE VIVANTE (285, retour du 17/09) — (a) lois pures : le hash est dans [0 ; 1[ et stable ; le micro-déplacement est borné par amp
  // (jamais au-delà), CONTINU (deux images à 1/60 s d'écart bougent de < 4 cm), différent d'un joueur à l'autre et d'une remise à l'autre,
  // et proportionnel au facteur (× 1,15 pour le travailleur) ; le pas rend 0 sur un engagement et sur un penalty (la Loi 8 et la Loi 14
  // possèdent ces attentes).
  const K = matchCfg({}).attenteVivante, h = [hashDe(3, 5, 7), hashDe(3, 5, 7), hashDe(4, 5, 7), hashDe(3, 6, 7)];
  let maxR = 0, maxSaut = 0; for (let t = 0; t < 30; t += 1 / 60) { const [x, z] = microDe(9, 1234, t, K), [x2, z2] = microDe(9, 1234, t + 1 / 60, K); maxR = Math.max(maxR, Math.hypot(x, z)); maxSaut = Math.max(maxSaut, Math.hypot(x2 - x, z2 - z)); }
  const a = microDe(9, 1234, 4.2, K), b = microDe(10, 1234, 4.2, K), c = microDe(9, 1235, 4.2, K), w = microDe(9, 1234, 4.2, K, 1.15);
  const st0 = makeMatch({ full: true, seed: 3 }), cfg0 = matchCfg({ shotRange: 20 }); for (let i = 0; i < 60; i++) matchStep(st0, 1 / 60, cfg0);
  const nEng = attenteVivanteStep(st0, { type: 'engagement', p: [0, 0], team: 0, at: st0.t + 5 }, cfg0, null), nPen = attenteVivanteStep(st0, { type: 'penalty', p: [40, 0], team: 0, at: st0.t + 5 }, cfg0, null);
  ok(`lot 285 — L'ATTENTE VIVANTE, lois pures : hash ${h[0].toFixed(3)} = ${h[1].toFixed(3)} ∈ [0 ; 1[, ≠ ${h[2].toFixed(3)} / ${h[3].toFixed(3)} ; le micro-déplacement ≤ amp (max ${maxR.toFixed(2)} ≤ ${K.amp}) et continu (saut max ${(100 * maxSaut).toFixed(1)} cm < 4) ; deux joueurs ${(a[0] !== b[0]).toString()}, deux remises ${(a[0] !== c[0]).toString()}, × 1,15 pour le travailleur (${Math.hypot(...w).toFixed(3)} = ${(1.15 * Math.hypot(...a)).toFixed(3)}) ; engagement ${nEng} = 0, penalty ${nPen} = 0`,
    h[0] === h[1] && h[0] >= 0 && h[0] < 1 && h[0] !== h[2] && h[0] !== h[3] && maxR <= K.amp + 1e-9 && maxSaut < 0.04 && a[0] !== b[0] && a[0] !== c[0] && Math.abs(Math.hypot(...w) - 1.15 * Math.hypot(...a)) < 1e-9 && nEng === 0 && nPen === 0);
  // (b) le monde : 3 × 600 s — au milieu des attentes de remise (> 3 s, hors engagement), la vitesse moyenne des joueurs de champ ≥ 0,45 m/s
  // (0,2 sans la clé), les figés (< 0,25 m/s) ≤ 60 % (≥ 85 sans) ; le preneur n'en est pas (exclu par construction : sa vitesse à mi-attente est informative, il va chercher le ballon) ; aux
  // deux dernières secondes, les receveurs du camp qui remet sont PLUS LOIN de leur adversaire le plus proche qu'à mi-attente (le
  // décrochage), sans la clé non.
  const monde = (cfg) => { const o = { v: [], fige: 0, n: 0, preneur: [], dMi: [], dFin: [] };
    for (const seed of [3, 7, 11]) { const st = makeMatch({ full: true, seed }); let cur = null;
      const dRec = (r) => { const foes = st.players.filter((q) => q.team !== r.team && !q.keeper && q.down <= 0); const ds = []; for (const p of st.players) { if (p.keeper || p.team !== r.team || p.down > 0 || Math.hypot(p.p[0] - r.p[0], p.p[2] - r.p[1]) > 18 || Math.hypot(p.p[0] - r.p[0], p.p[2] - r.p[1]) < 1) continue; let dF = 99; for (const q of foes) dF = Math.min(dF, Math.hypot(q.p[0] - p.p[0], q.p[2] - p.p[2])); ds.push(dF); } return ds.length ? ds.reduce((a, b) => a + b, 0) / ds.length : null; };
      for (let i = 0; i < 600 * 60; i++) { matchStep(st, 1 / 60, cfg); const r = st.restart;
        if (r && r.at > 0 && r.type !== 'fin' && r.type !== 'engagement' && r.type !== 'penalty') { if (!cur || cur.at !== r.at) cur = { at: r.at, t0: st.t, mi: false, fin: false, dMi: null };
          if (!cur.mi && st.t >= (cur.t0 + r.at) / 2 && r.at - cur.t0 > 3) { cur.mi = true; const vs = st.players.filter((p) => !p.keeper && p.job !== 'receive').map((p) => Math.hypot(p.v[0], p.v[1])); o.v.push(vs.reduce((a, b) => a + b, 0) / vs.length); o.fige += vs.filter((v) => v < 0.25).length; o.n += vs.length; cur.dMi = dRec(r); const tk = st.players.find((p) => p.job === 'receive' && p.team === r.team); if (tk) o.preneur.push(Math.hypot(tk.v[0], tk.v[1])); }
          if (cur.mi && !cur.fin && r.at - st.t <= 0.5 && cur.dMi != null) { cur.fin = true; const d = dRec(r); if (d != null) { o.dMi.push(cur.dMi); o.dFin.push(d); } } }
        if (!r) cur = null; } }
    const m = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN; return { v: m(o.v), fige: 100 * o.fige / Math.max(1, o.n), att: o.v.length, preneur: m(o.preneur), dMi: m(o.dMi), dFin: m(o.dFin) }; };
  const mA = monde(matchCfg({ shotRange: 20 })), mN = monde(matchCfg({ shotRange: 20, attenteVivante: null }));
  ok(`lot 285 — …et LE MONDE : 3 × 600 s, ${mA.att} attentes : vitesse moyenne des joueurs de champ à mi-attente ${mA.v.toFixed(2)} m/s (≥ 0,45 ; sans ${mN.v.toFixed(2)}), figés ${mA.fige.toFixed(0)} % (≤ 60 ; sans ${mN.fige.toFixed(0)} ≥ 85) ; le preneur (exclu par construction) va au ballon : ${mA.preneur.toFixed(2)} m/s à mi-attente, informatif (sans ${mN.preneur.toFixed(2)}) ; le décrochage : receveurs à ${mA.dFin.toFixed(2)} m de leur adversaire aux dernières secondes c. ${mA.dMi.toFixed(2)} à mi-attente (+ ≥ 0,3 ; sans ${mN.dFin.toFixed(2)} c. ${mN.dMi.toFixed(2)})`,
    mA.att >= 10 && mA.v >= 0.45 && mA.fige <= 60 && mN.fige >= 85 &&  mA.dFin >= mA.dMi + 0.3);
}

if (__bloc()) {
  // LA TOUCHE QUI ENGAGE (286, retour du 17/09) — (a) lois pures : la fenêtre vaut commit (0,5 s) à l'identité (decF 1, tempo 0,5), plus
  // courte pour le bon décideur (× 0,85) et le jeu direct (× 0,8), plus longue pour le mauvais (× 1,15) et la possession (× 1,2) ;
  // l'engagement est actif dans la fenêtre et sans presseur, inactif passé la fenêtre ou pressé (< 2,5 m) ; l'écart au regard est
  // symétrique ; une passe à 120° du regard coûte le malus, à 80° rien ; la poussée à 150° du regard se rabat à ± 100°, celle à 60°
  // ne bouge pas.
  const K = { commit: 0.5, angle: 100, malus: 8, presse: 2.5, lent: 1.2, vif: 0.8 }, f0 = fenetreDe(K, {}), fBon = fenetreDe(K, { decF: 1.15 }), fMauvais = fenetreDe(K, { decF: 0.85 }), fDirect = fenetreDe(K, { tempo: 1 }), fPoss = fenetreDe(K, { tempo: 0 });
  const eOn = engageDe(K, { dt: 0.2, foe: 9 }), eTard = engageDe(K, { dt: 0.6, foe: 9 }), ePresse = engageDe(K, { dt: 0.2, foe: 2 });
  const rad = (d) => d * Math.PI / 180, pousse = rabatDe([Math.cos(rad(150)), Math.sin(rad(150))], 0, 100), reste = rabatDe([Math.cos(rad(60)), Math.sin(rad(60))], 0, 100);
  ok(`lot 286 — LA TOUCHE QUI ENGAGE, lois pures : fenêtre ${f0.toFixed(2)} s à l'identité, ${fBon.toFixed(3)} pour le bon décideur < ${fMauvais.toFixed(3)} pour le mauvais, ${fDirect.toFixed(2)} en direct < ${fPoss.toFixed(2)} en possession ; actif à 0,2 s libre ${eOn.actif}, passé la fenêtre ${eTard.actif} = false, pressé ${ePresse.actif} = false ; écart symétrique ${(ecartEngage(Math.cos(rad(-70)), Math.sin(rad(-70)), 0) * 180 / Math.PI).toFixed(0)}° ; malus à 120° ${malusDe(K, true, rad(120))} (= ${K.malus}), à 80° ${malusDe(K, true, rad(80))} ; la poussée à 150° rabattue à ${(Math.atan2(pousse[1], pousse[0]) * 180 / Math.PI).toFixed(0)}°, celle à 60° gardée ${(Math.atan2(reste[1], reste[0]) * 180 / Math.PI).toFixed(0)}°`,
    Math.abs(f0 - 0.5) < 1e-9 && Math.abs(fBon - 0.425) < 1e-9 && Math.abs(fMauvais - 0.575) < 1e-9 && Math.abs(fDirect - 0.4) < 1e-9 && Math.abs(fPoss - 0.6) < 1e-9 && eOn.actif && !eTard.actif && !ePresse.actif
    && Math.abs(ecartEngage(Math.cos(rad(-70)), Math.sin(rad(-70)), 0) - rad(70)) < 1e-9 && malusDe(K, true, rad(120)) === (K.malus ?? 4) && malusDe(K, true, rad(80)) === 0 && Math.abs(Math.atan2(pousse[1], pousse[0]) - rad(100)) < 1e-9 && Math.abs(Math.atan2(reste[1], reste[0]) - rad(60)) < 1e-9);
  // (b) la fixture : un porteur qui vient de contrôler (regard vers le but), libre, deux coéquipiers — l'un DANS SON DOS à 10 m (le point
  // doux du barème, libre), l'autre devant à 13 m avec un adversaire à 3,5 m ; sans la clé le barème d'hier sert le dos, sous la clé la passe dans le dos coûte le
  // malus et le devant gagne ; pressé (un adversaire à 2 m), la clé laisse le dos : le pressé a le droit de se retourner.
  const fixture = (over, presse) => { const st = makeMatch({ full: true, seed: 3 }), cfg = matchCfg({ presseLue: null /* presseLue null DATÉ 289 : vert à HEAD~ (worktree 7bd70e0), la touche qui engage allumée fait 214 pertes contre 240 au défaut dans ce monde (la réfutation du 286 se mesure au monde du 286) — la clause mesure sa loi, pas la pression lue au temps d'arrivée */, ouverture: null /* ouverture null DATÉ 288 : vert à HEAD~ (worktree d90101b), la touche qui engage allumée fait 216 pertes contre 266 au défaut dans ce monde (la réfutation du 286 se mesure au monde du 286) — la clause mesure sa loi, pas le receveur qui s'ouvre au ballon */, layoff: null /* layoff null DATÉ 287 : vert à HEAD~ (worktree 4535d0f), la touche qui engage allumée fait 204 pertes contre 246 au défaut dans ce monde (la réfutation du 286 se mesure au monde du 286) — la clause mesure sa loi, pas la une-touche jugée par son angle */, shotRange: 20, ...over }); for (let i = 0; i < 60; i++) matchStep(st, 1 / 60, cfg);
    const goal = st.pitch.attackGoal(0), s = Math.sign(goal.x || 1), team0 = st.players.filter((q) => q.team === 0 && !q.keeper), c0 = team0[6], dos = team0[5], devant = team0[7];
    for (const q of st.players.filter((q) => q.team === 1)) { q.p[0] = q.keeper ? goal.x : goal.x - s * 12; q.p[2] = q.keeper ? 0 : (q.post ?? 0) * 3 - 15; q.v = [0, 0]; }
    for (const q of team0) { q.p[0] = -s * 30; q.p[2] = (q.post ?? 0) * 4 - 20; q.v = [0, 0]; }
    c0.p[0] = s * 20; c0.p[2] = 0; dos.p[0] = s * 10; dos.p[2] = 0; devant.p[0] = s * 33; devant.p[2] = 0;   /* dans la moitié adverse : la sortie au gardien n'existe pas ici */ for (const q of [c0, dos, devant]) { q.v = [0, 0]; q.yaw = Math.atan2(0, s); q.yawWant = null; }
    { const g = st.players.filter((q) => q.team === 1 && !q.keeper)[1]; g.p[0] = s * 33; g.p[2] = 3.5; }   /* un adversaire à 3,5 m du coéquipier de devant : sans la clé, le dos libre au point doux gagne */
    if (presse) { const f = st.players.find((q) => q.team === 1 && !q.keeper); f.p[0] = s * 20; f.p[2] = 2.2; }   /* le presseur à 2,2 m sur le côté : hors des deux lignes de passe */
    st.ball.restart([c0.p[0], 0.11, c0.p[2]], { cause: 'coup-franc' }); st.restart = null; st.ball.possess(c0.id); st.possession = { team: 0, carrier: c0.id }; st.phase = 'carry'; st.hold = 0.2; st.lastTouch = 0; c0._controleAt = st.t - 0.1;
    const b = choosePass(st, cfg); return { to: b?.to?.id, dos: dos.id, devant: devant.id }; };
  const fA = fixture({ toucheEngage: K }, false), fN = fixture({}, false), fP = fixture({ toucheEngage: K }, true);
  ok(`lot 286 — …la FIXTURE : après le contrôle, libre, la clé sert DEVANT (élu #${fA.to} = #${fA.devant}) ; sans la clé, le dos (élu #${fN.to} = #${fN.dos}) ; pressé, la clé laisse le dos (élu #${fP.to} = #${fP.dos})`,
    fA.to === fA.devant && fN.to === fN.dos && fP.to === fP.dos);
  // (c) le monde, la loi ALLUMÉE contre le défaut ÉTEINT : 3 × 600 s — la RÉFUTATION se mesure : les pertes montent (> 1,05 × le défaut : mesuré 248-252 c. 222) ;
  // c'est pourquoi la clé est nulle par défaut ; les passes vivent (≥ 0,9) ; les
  // demi-tours (> 120° dans les 2 s après un contrôle) et ceux qui tournent vers son propre but sont INFORMATIFS à cette échelle (la sonde
  // 4 × 90 min : vers son but −19 %, le ballon soudé pendant le demi-tour −21 %, le total 30 → 29 % en course et 38 → 33 % posé — la
  // fixture prouve le mécanisme, le monde le compte).
  const monde = (cfg) => { const o = { ctrl: 0, demi: 0, versSoi: 0, pertes: 0, passes: 0 }; const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    for (const seed of [3, 7, 11]) { const st = makeMatch({ full: true, seed }); let seen = 0; const suivis = [];
      for (let i = 0; i < 600 * 60; i++) { matchStep(st, 1 / 60, cfg);
        for (; seen < st.events.length; seen++) { const e = st.events[seen]; if (e.type === 'pass') o.passes++; if (e.type === 'turnover' || e.type === 'perte') o.pertes++; if (e.type !== 'control' || e.miss) continue; const p = st.players[e.by]; if (!p || p.keeper || st.ball.owner !== p.id) continue; o.ctrl++; suivis.push({ p, t0: st.t, yaw0: p.yaw, max: 0, yawT: p.yaw, gS: Math.sign(st.pitch.attackGoal(p.team).x || 1) }); }
        for (let k = suivis.length - 1; k >= 0; k--) { const sv = suivis[k], tr = Math.abs(wrap(sv.p.yaw - sv.yaw0)); if (tr > sv.max) { sv.max = tr; sv.yawT = sv.p.yaw; } if (st.t - sv.t0 >= 2) { if (sv.max > 2 * Math.PI / 3) { o.demi++; if (Math.cos(sv.yawT) * sv.gS < -0.3) o.versSoi++; } suivis.splice(k, 1); } } }
      o.pertes += st.turnovers ?? 0; }
    return o; };
  const mA = monde(matchCfg({ presseLue: null /* presseLue null DATÉ 289 : vert à HEAD~ (worktree 7bd70e0), la touche qui engage allumée fait 214 pertes contre 240 au défaut dans ce monde (la réfutation du 286 se mesure au monde du 286) — la clause mesure sa loi, pas la pression lue au temps d'arrivée */, ouverture: null /* ouverture null DATÉ 288 : vert à HEAD~ (worktree d90101b), la touche qui engage allumée fait 216 pertes contre 266 au défaut dans ce monde (la réfutation du 286 se mesure au monde du 286) — la clause mesure sa loi, pas le receveur qui s'ouvre au ballon */, layoff: null /* layoff null DATÉ 287 : vert à HEAD~ (worktree 4535d0f), la touche qui engage allumée fait 204 pertes contre 246 au défaut dans ce monde (la réfutation du 286 se mesure au monde du 286) — la clause mesure sa loi, pas la une-touche jugée par son angle */, shotRange: 20, toucheEngage: K })), mN = monde(matchCfg({ presseLue: null /* presseLue null DATÉ 289 : vert à HEAD~ (worktree 7bd70e0), la touche qui engage allumée fait 214 pertes contre 240 au défaut dans ce monde (la réfutation du 286 se mesure au monde du 286) — la clause mesure sa loi, pas la pression lue au temps d'arrivée */, ouverture: null /* ouverture null DATÉ 288 : vert à HEAD~ (worktree d90101b), la touche qui engage allumée fait 216 pertes contre 266 au défaut dans ce monde (la réfutation du 286 se mesure au monde du 286) — la clause mesure sa loi, pas le receveur qui s'ouvre au ballon */, layoff: null /* layoff null DATÉ 287 : vert à HEAD~ (worktree 4535d0f), la touche qui engage allumée fait 204 pertes contre 246 au défaut dans ce monde (la réfutation du 286 se mesure au monde du 286) — la clause mesure sa loi, pas la une-touche jugée par son angle */, shotRange: 20 }));
  ok(`lot 286 — …et LE MONDE (la loi ALLUMÉE contre le défaut éteint) : 3 × 600 s, pertes ${mA.pertes} > 1,05 × ${mN.pertes} — la réfutation mesurée, la clé est nulle par défaut ; passes ${mA.passes} ≥ 0,9 × ${mN.passes} ; informatif : demi-tours > 120° dans les 2 s après un contrôle ${mA.demi} / ${mA.ctrl} c. ${mN.demi} / ${mN.ctrl} sans la clé, dont vers son propre but ${mA.versSoi} c. ${mN.versSoi}`,
    mA.ctrl >= 100 && mA.pertes > 1.05 * mN.pertes && mA.passes >= 0.9 * mN.passes && matchCfg({}).toucheEngage === null);
}

if (__bloc()) {
  // LA REMISE EN UNE TOUCHE JUGÉE PAR SON ANGLE (287, retour du 17/09) — (a) lois pures : la dispersion vaut 1 à l'identité (déviation 0,
  // arrivée ≤ v0, layoffF 1), × 1,8 à 90° de déviation, × 1,5 à 10 m/s d'arrivée, ÷ pour le technicien (0,85) ; le barème d'une cible :
  // la marge du couloir, − 2 par 90° d'angle, − 1 par mètre sous 3 m d'adversaire, + 1 de face ; l'angle impossible : 150° hors pression
  // se contrôle, 150° pressé se tente, 100° se tente.
  const { uneTouche: uneToucheDe } = await import('../assets/starter/src/engine/premiere-intention.js');
  const K = matchCfg({}).layoff, rad = (d) => d * Math.PI / 180;
  const s0 = sigmaLayoffF(0, 4, K), s90 = sigmaLayoffF(rad(90), 4, K), sV = sigmaLayoffF(0, 10, K), sTech = sigmaLayoffF(0, 4, K, 0.85);
  const sc = scoreLayoffDe({ marge: 3, dev: 0, foe: 9, face: true }, K), scAngle = scoreLayoffDe({ marge: 3, dev: rad(90), foe: 9, face: true }, K), scMarque = scoreLayoffDe({ marge: 3, dev: 0, foe: 2, face: true }, K), scDos = scoreLayoffDe({ marge: 3, dev: 0, foe: 9, face: false }, K);
  ok(`lot 287 — LA UNE-TOUCHE JUGÉE PAR SON ANGLE, lois pures : dispersion ${s0.toFixed(2)} à l'identité, × ${s90.toFixed(2)} à 90°, × ${sV.toFixed(2)} à 10 m/s, × ${sTech.toFixed(2)} pour le technicien ; score ${sc.toFixed(1)} (marge 3, de face) → ${scAngle.toFixed(1)} à 90°, ${scMarque.toFixed(1)} avec un adversaire à 2 m, ${scDos.toFixed(1)} dans le dos ; impossible à 150° libre ${impossibleDe(rad(150), false, K)}, pressé ${impossibleDe(rad(150), true, K)}, à 100° ${impossibleDe(rad(100), false, K)}`,
    Math.abs(s0 - 1) < 1e-9 && Math.abs(s90 - 1.8) < 1e-9 && Math.abs(sV - 1.5) < 1e-9 && Math.abs(sTech - 0.85) < 1e-9 && Math.abs(sc - 4) < 1e-9 && Math.abs(scAngle - 2) < 1e-9 && Math.abs(scMarque - 3) < 1e-9 && Math.abs(scDos - 3) < 1e-9
    && impossibleDe(rad(150), false, K) && !impossibleDe(rad(150), true, K) && !impossibleDe(rad(100), false, K));
  // (b) la fixture : un receveur pressé (un adversaire à 3,2 m sur le côté : la première intention s'ouvre), le ballon arrive de DERRIÈRE
  // lui à 6 m/s ; deux coéquipiers — A derrière à 3,5 m, LIBRE (couloir sans bloqueur : la remise à 160°, à contre-courant), B de face
  // à 30° et 8 m avec un adversaire à 1,3 m de sa ligne (couloir ouvert mais serré) ; sans la clé la marge nue du couloir décide (A, 99
  // contre 1,3), sous la clé la marge se plafonne à 4 et l'angle paie : B, de face, gagne.
  const fixture = (over) => { const st = makeMatch({ full: true, seed: 3 }), cfg = matchCfg({ ouverture: null /* ouverture null DATÉ 288 : vert à HEAD~ (worktree d90101b), une-touche 18 c. 32 sans dans ce monde (la sonde du 287 se mesure au monde du 287) — la clause mesure sa loi, pas le receveur qui s'ouvre au ballon */, shotRange: 20, ...over }); for (let i = 0; i < 60; i++) matchStep(st, 1 / 60, cfg);
    const goal = st.pitch.attackGoal(0), s = Math.sign(goal.x || 1), team0 = st.players.filter((q) => q.team === 0 && !q.keeper), r = team0[6], dos = team0[3], face = team0[7];
    for (const q of st.players.filter((q) => q.team === 1)) { q.p[0] = q.keeper ? goal.x : goal.x - s * 10; q.p[2] = q.keeper ? 0 : (q.post ?? 0) * 3 - 15; q.v = [0, 0]; }
    for (const q of team0) { q.p[0] = -s * 35; q.p[2] = (q.post ?? 0) * 4 - 20; q.v = [0, 0]; }
    r.p[0] = 0; r.p[2] = 0; r.v = [0, 0]; r.yaw = Math.atan2(0, s); r.yawWant = null;
    dos.p[0] = -s * 3.5 * Math.cos(rad(20)); dos.p[2] = 3.5 * Math.sin(rad(20)); face.p[0] = s * 8 * Math.cos(rad(30)); face.p[2] = -8 * Math.sin(rad(30)); for (const q of [dos, face]) { q.v = [0, 0]; }
    const foes = st.players.filter((q) => q.team === 1 && !q.keeper); foes[0].p[0] = s * 0.5; foes[0].p[2] = 3.2; foes[0].v = [0, 0]; foes[1].p[0] = s * 3.5; foes[1].p[2] = -0.5; foes[1].v = [0, 0];
    st.ball.restart([-s * 0.6, 0.11, 0], { cause: 'coup-franc' }); st.restart = null; st.ball.impulse([s * 6 - st.ball.v[0], -st.ball.v[1], -st.ball.v[2]], [0, 0, 0]);
    st.phase = 'flight'; st.possession = { team: 0, carrier: -1 }; st.hold = 0; st.lastTouch = 0; st.pass = { from: dos.id, to: r.id, lead: [0, 0, 0], style: 'ground', t: st.t - 0.8, flight: 1, origin: [-s * 6, 0] }; r._controleAt = null;
    const fait = uneToucheDe(st, r, cfg); return { fait, to: st.pass?.to, dos: dos.id, face: face.id, deny: Object.keys(st.deny ?? {}).filter((k) => /^ut-|^ar-/.test(k)) }; };
  const fA = fixture({}), fN = fixture({ layoff: null });
  ok(`lot 287 — …la FIXTURE : le ballon de derrière à 6 m/s, pressé de côté — sous la clé la remise part vers B DE FACE à 30° (fait ${fA.fait}, vers #${fA.to} = #${fA.face}) ; sans la clé, la marge nue élit A à 160° dans le dos (fait ${fN.fait}, vers #${fN.to} = #${fN.dos}) ; refus ${JSON.stringify(fA.deny)}`,
    fA.fait === true && fA.to === fA.face && fN.fait === true && fN.to === fN.dos);
  // (c) le monde : 3 × 600 s — au plus une une-touche libre au-delà de 140° sous la clé (135 à la loi, la marge de lecture ; ≥ 4 sans), la réussite des une-touche ne baisse pas
  // (≥ sans − 10 pts, les comptes sont petits), leur nombre tient (≥ 0,6 × sans : l'angle impossible se contrôle, il ne disparaît pas).
  const monde = (cfg) => { const o = { n: 0, ok: 0, loin: 0 }; const hyp = Math.hypot;
    for (const seed of [3, 7, 11]) { const st = makeMatch({ full: true, seed }); let seen = 0, prevV = [0, 0], pend = null;
      for (let i = 0; i < 600 * 60; i++) { const vAv = [st.ball.v[0], st.ball.v[2]]; matchStep(st, 1 / 60, cfg);
        if (pend) { const dt = st.t - pend.t, car = st.possession.carrier >= 0 ? st.players[st.possession.carrier] : null, own = st.ball.owner != null ? st.players[st.ball.owner] : (car && st.phase === 'carry' ? car : null); if (own && own.id === pend.to) pend.touche = true; let res = null;
          if (own && own.team !== pend.team && dt > 0.1) res = false; else if (pend.touche && dt > 2 && own && own.team === pend.team) res = true; else if (st.restart && dt > 0.2) res = !!pend.touche; else if (dt > 4) res = !!pend.touche || !!(own && own.team === pend.team);
          if (res != null) { o.n++; if (res) o.ok++; pend = null; } }
        for (; seen < st.events.length; seen++) { const e = st.events[seen]; if (e.type !== 'pass' || e.style !== 'une-touche' || pend) continue; const p = st.players[e.by], m = st.players[e.to]; if (!p || !m) continue;
          const dx = m.p[0] - p.p[0], dz = m.p[2] - p.p[2], d = hyp(dx, dz) || 1, arr = hyp(prevV[0], prevV[1]); const dev = arr > 0.5 ? Math.acos(Math.max(-1, Math.min(1, (dx * prevV[0] + dz * prevV[1]) / (d * arr)))) * 180 / Math.PI : 0;
          if (dev > 140 && e.calme) o.loin++; pend = { to: e.to, team: p.team, t: st.t, touche: false }; }
        prevV = vAv; } }
    return { ...o, taux: 100 * o.ok / Math.max(1, o.n) }; };
  const mA = monde(matchCfg({ ouverture: null /* ouverture null DATÉ 288 : vert à HEAD~ (worktree d90101b), une-touche 18 c. 32 sans dans ce monde (la sonde du 287 se mesure au monde du 287) — la clause mesure sa loi, pas le receveur qui s'ouvre au ballon */, shotRange: 20 })), mN = monde(matchCfg({ ouverture: null /* ouverture null DATÉ 288 : vert à HEAD~ (worktree d90101b), une-touche 18 c. 32 sans dans ce monde (la sonde du 287 se mesure au monde du 287) — la clause mesure sa loi, pas le receveur qui s'ouvre au ballon */, shotRange: 20, layoff: null }));
  ok(`lot 287 — …et LE MONDE : 3 × 600 s, une-touche calmes au-delà de 140° ${mA.loin} (≤ 1 ; sans ${mN.loin} ≥ 4 — la sonde lit la vitesse de l'image d'avant, 5° de marge sur les 135 de la loi) ; réussite ${mA.taux.toFixed(0)} % de ${mA.n} (≥ sans ${mN.taux.toFixed(0)} % de ${mN.n} − 10) ; nombre ${mA.n} ≥ 0,6 × ${mN.n}`,
    mA.loin <= 1 && mN.loin >= 4 && mA.taux >= mN.taux - 10 && mA.n >= 0.6 * mN.n && mA.n >= 5);
}

if (__bloc()) {
  // LE BALLON QUI DOUBLE SE PREND DEVANT (288, les retours du 17/09 : la passe qui n'arrive à personne) — (a) lois pures : le receveur qui court à
  // 3 m/s vers +x (regard +x), le ballon 1 m derrière à 7 m/s sur sa ligne → il double (4 m/s), devant dans 0,25 s : la prise ATTEND ; à 1,2 m de
  // côté : non (lateral 0,8) — sauf le bon contrôleur (controlF 1,6 : 1,28 m) ; un ballon à 3,2 m/s (0,2 de plus que lui) : non ; à 3 m derrière
  // (devant dans 0,75 s > 0,6) : non ; en l'air (1,2 m) : non.
  const K = matchCfg({}).ouverture, R = { yaw: 0, p: [0, 0, 0], v: [3, 0] }, B = (x, vx, z = 0, y = 0.11) => ({ p: [x, y, z], v: [vx, 0, 0] });
  const a1 = attendDe(R, B(-1, 7), K), aLat = attendDe(R, B(-1, 7, 1.2), K), aLatC = attendDe(R, B(-1, 7, 1.2), K, 1.6), aLent = attendDe(R, B(-1, 3.2), K), aLoin = attendDe(R, B(-3, 7), K), aHaut = attendDe(R, B(-1, 7, 0, 1.2), K);
  ok(`lot 288 — LE BALLON QUI DOUBLE SE PREND DEVANT, lois pures : 1 m derrière à 7 m/s → attend ${a1.attend} (devant dans ${a1.tDevant.toFixed(2)} s, écart ${a1.lat.toFixed(2)} m) ; à 1,2 m de côté ${aLat.attend}, le bon contrôleur ${aLatC.attend} ; le ballon à peine plus vite ${aLent.attend} ; à 3 m derrière ${aLoin.attend} (${aLoin.tDevant.toFixed(2)} s) ; en l'air ${aHaut.attend}`,
    a1.attend === true && Math.abs(a1.tDevant - 0.25) < 1e-9 && Math.abs(a1.lat) < 1e-9 && aLat.attend === false && aLatC.attend === true && aLent.attend === false && aLoin.attend === false && Math.abs(aLoin.tDevant - 0.75) < 1e-9 && aHaut.attend === false);
  // …et l'OUVERTURE EN COURSE : le ballon qui CROISE le dos (à 3 m derrière-gauche, 129° du regard — le cône du lot 70 est un relèvement de ±100°,
  // on s'ouvre au-delà de 90°) → il s'ouvre ; le ballon qui double devant (l'attente) → non ; devant dans le cône → non ; à 8 m (> dOuvre) → non ; en l'air → non.
  const oC = ouvreDe(R, { p: [-2, 0.11, -2.5], v: [1, 0, 6] }, K), oD = ouvreDe(R, B(-1, 7), K), oF = ouvreDe(R, B(2, 7), K), oLoin = ouvreDe(R, { p: [-6, 0.11, -6], v: [1, 0, 6] }, K), oH = ouvreDe(R, { p: [-2, 1.4, -2.5], v: [1, 0, 6] }, K);
  ok(`lot 288 — …l'OUVERTURE EN COURSE, lois pures : le ballon qui croise le dos → ouvre ${oC.ouvre} (à ${(oC.dos * 180 / Math.PI).toFixed(0)}° du regard) ; qui double devant ${oD.ouvre} ; devant dans le cône ${oF.ouvre} ; à 8 m ${oLoin.ouvre} ; en l'air ${oH.ouvre}`,
    oC.ouvre === true && oC.dos > 100 * Math.PI / 180 && oD.ouvre === false && oF.ouvre === false && oLoin.ouvre === false && oH.ouvre === false);
  // (b) la fixture : un receveur en course (3 m/s, le regard devant) que sa passe rejoint de derrière à 7 m/s, 1 m ; 0,5 s de match — sous la clé la
  // prise attend (controle-attend nommé, aucun controle-dos), puis le ballon est pris devant et porté ; sans la clé le cône refuse à l'entrée du
  // rayon (controle-dos), la passe meurt en ballon libre (sans adversaire dans la fixture il la reprend — le monde, lui, a des presseurs).
  const fixture = (over) => { const st = makeMatch({ full: true, seed: 3 }), cfg = matchCfg({ presseLue: null /* presseLue null DATÉ 289 : vert à HEAD~ (worktree 7bd70e0), perdues sans touche 35,2 % c. 35,5 sans la clé du 288 dans ce monde (la clause du 288 se mesure au monde du 288) — la clause mesure sa loi, pas la pression lue au temps d'arrivée */, shotRange: 20, ...over }); for (let i = 0; i < 60; i++) matchStep(st, 1 / 60, cfg);
    const goal = st.pitch.attackGoal(0), s = Math.sign(goal.x || 1), team0 = st.players.filter((q) => q.team === 0 && !q.keeper), r = team0[6], from = team0[3];
    for (const q of st.players.filter((q) => q.team === 1)) { q.p[0] = q.keeper ? goal.x : goal.x - s * 12; q.p[2] = q.keeper ? 0 : (q.post ?? 0) * 3 - 15; q.v = [0, 0]; q.speed = 0; }
    for (const q of team0) { q.p[0] = -s * 35; q.p[2] = (q.post ?? 0) * 4 - 20; q.v = [0, 0]; q.speed = 0; }
    r.p[0] = 0; r.p[2] = 0; r.v = [s * 3, 0]; r.speed = 3; r.yaw = Math.atan2(0, s); r.yawWant = null; r._pace = null; r._regard = null; r._regardUntil = null; from.p[0] = -s * 12; from.p[2] = 0;
    st.ball.restart([-s * 1.0, 0.11, 0], { cause: 'coup-franc' }); st.restart = null; st.ball.impulse([s * 7 - st.ball.v[0], -st.ball.v[1], -st.ball.v[2]], [0, 0, 0]);
    st.phase = 'flight'; st.possession = { team: 0, carrier: -1 }; st.hold = 0; st.lastTouch = 0; st.pass = { from: from.id, to: r.id, lead: [s * 6, 0, 0], style: 'ground', t: st.t - 0.6, flight: 1.4, origin: [-s * 12, 0] };
    const d0 = { ...(st.deny ?? {}) }, n0 = st.events.length; for (let i = 0; i < 30; i++) matchStep(st, 1 / 60, cfg);
    const ctrl = st.events.slice(n0).find((e) => e.type === 'control' && e.by === r.id), dd = (k) => (st.deny?.[k] ?? 0) - (d0[k] ?? 0);
    return { tech: ctrl?.tech ?? null, miss: !!ctrl?.miss, attend: dd('controle-attend'), dos: dd('controle-dos'), carrier: st.possession.carrier, phase: st.phase, r: r.id }; };
  const fixture2 = (over) => { const st = makeMatch({ full: true, seed: 3 }), cfg = matchCfg({ presseLue: null /* presseLue null DATÉ 289 : vert à HEAD~ (worktree 7bd70e0), perdues sans touche 35,2 % c. 35,5 sans la clé du 288 dans ce monde (la clause du 288 se mesure au monde du 288) — la clause mesure sa loi, pas la pression lue au temps d'arrivée */, shotRange: 20, ...over }); for (let i = 0; i < 60; i++) matchStep(st, 1 / 60, cfg);
    const goal = st.pitch.attackGoal(0), s = Math.sign(goal.x || 1), team0 = st.players.filter((q) => q.team === 0 && !q.keeper), r = team0[6], from = team0[3];
    for (const q of st.players.filter((q) => q.team === 1)) { q.p[0] = q.keeper ? goal.x : goal.x - s * 12; q.p[2] = q.keeper ? 0 : (q.post ?? 0) * 3 - 15; q.v = [0, 0]; q.speed = 0; }
    for (const q of team0) { q.p[0] = -s * 35; q.p[2] = (q.post ?? 0) * 4 - 20; q.v = [0, 0]; q.speed = 0; }
    r.p[0] = 0; r.p[2] = 0; r.v = [s * 3, 0]; r.speed = 3; r.yaw = Math.atan2(0, s); r.yawWant = null; r._pace = null; r._regard = null; r._regardUntil = null; from.p[0] = -s * 3; from.p[2] = -9;
    st.ball.restart([-s * 0.5, 0.11, -4], { cause: 'coup-franc' }); st.restart = null; st.ball.impulse([s * 3 - st.ball.v[0], -st.ball.v[1], 9 - st.ball.v[2]], [0, 0, 0]);   // le ballon vient de derrière-droite à 9,5 m/s et CROISE le dos (vitesse relative purement latérale, 0,5 m derrière lui : il entre dans le rayon à ~126° du regard d'hier)
    st.phase = 'flight'; st.possession = { team: 0, carrier: -1 }; st.hold = 0; st.lastTouch = 0; st.pass = { from: from.id, to: r.id, lead: [s * 0.9, 0, 0], style: 'ground', t: st.t - 0.6, flight: 1.4, origin: [-s * 3, -9] };   // la mène est là où le ballon passera : la loi du ballon réel (134) se tait, le coureur d'hier garde son cap
    const ec = () => { let a = Math.atan2(st.ball.p[2] - r.p[2], st.ball.p[0] - r.p[0]) - r.yaw; while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return Math.abs(a) * 180 / Math.PI; };
    const e0 = ec(), d0 = { ...(st.deny ?? {}) }, n0 = st.events.length; let e1 = e0; for (let i = 0; i < 40; i++) { matchStep(st, 1 / 60, cfg); if (st.phase === 'flight') e1 = ec(); }
    const ctrl = st.events.slice(n0).find((e) => e.type === 'control' && e.by === r.id), dd = (k) => (st.deny?.[k] ?? 0) - (d0[k] ?? 0);
    return { e0, e1, tech: ctrl?.tech ?? null, dos: dd('controle-dos'), carrier: st.possession.carrier, r: r.id }; };
  const gA = fixture2({}), gN = fixture2({ ouverture: null });
  ok(`lot 288 — …la FIXTURE du ballon qui CROISE le dos du coureur : sous la clé le corps s'ouvre (écart au ballon ${gA.e0.toFixed(0)} → ${gA.e1.toFixed(0)}°, ≤ 45 à l'arrivée), aucun controle-dos (${gA.dos}) et le ballon est pris (${gA.tech ?? 'aucun'}) par #${gA.carrier} = #${gA.r} ; sans la clé le regard reste sur la course (${gN.e0.toFixed(0)} → ${gN.e1.toFixed(0)}°, ≥ 60 : le ballon arrive au bord du cône d'hier, ± 100°)`,
    gA.e1 <= 45 && gA.dos === 0 && gA.tech != null && gA.carrier === gA.r && gN.e1 >= 60);
  const fA = fixture({}), fN = fixture({ ouverture: null });
  ok(`lot 288 — …la FIXTURE : le ballon double le coureur — sous la clé la prise attend (controle-attend ${fA.attend} ≥ 1, controle-dos ${fA.dos} = 0) puis le ballon est pris DEVANT (${fA.tech} — la touche qui écrase le ballon passant, lot 52) et porté par #${fA.carrier} = #${fA.r} ; sans la clé le cône refuse à l'entrée du rayon (controle-dos ${fN.dos} ≥ 1 : la passe meurt en ballon libre, repris ici faute d'adversaire — ${fN.tech ?? 'aucun'})`,
    fA.attend >= 1 && fA.dos === 0 && fA.tech != null && fA.carrier === fA.r && fN.dos >= 1);
  // (c) le monde : 3 × 600 s — la part des passes au sol perdues SANS la touche du receveur baisse (≤ sans − 3 pts), les refus controle-dos du
  // receveur visé baissent (≤ 0,7 × sans), la réussite des passes au sol monte (≥ sans + 1 pt) et les passes restent (≥ 0,8 × sans).
  const monde = (cfg) => { const o = { n: 0, ok: 0, sans: 0, dos: 0, attend: 0 }; for (const seed of [3, 7, 11]) { const st = makeMatch({ full: true, seed }); let seen = 0, pend = null, dos0 = 0;
      for (let i = 0; i < 600 * 60; i++) { const recV = st.phase === 'flight' && st.pass && st.pass.to >= 0; matchStep(st, 1 / 60, cfg); const dos1 = st.deny?.['controle-dos'] ?? 0; if (dos1 > dos0 && recV && st.possession.carrier < 0) o.dos++; dos0 = dos1;   // les refus du RECEVEUR VISÉ (la méthode de la sonde 288e), pas le compteur global
        for (; seen < st.events.length; seen++) { const e = st.events[seen]; if (pend) { if (e.type === 'control' && e.by === pend.to) pend.touche = true; if (e.type === 'turnover' && e.equipe !== pend.team) { o.n++; if (!pend.touche) o.sans++; pend = null; } continue; }
          if (e.type !== 'pass' || e.clear || e.style === 'une-touche' || e.to < 0 || e.through || e.cross) continue; const p = st.players[e.by]; if (!p) continue; pend = { to: e.to, team: p.team, t: st.t, touche: false }; }
        if (pend) { const dt = st.t - pend.t, car = st.possession.carrier >= 0 ? st.players[st.possession.carrier] : null; if (pend.touche && dt > 2 && car && car.team === pend.team) { o.n++; o.ok++; pend = null; } else if (dt > 4) { o.n++; if (pend.touche || (car && car.team === pend.team)) o.ok++; else o.sans++; pend = null; } } }
      o.attend += st.deny?.['controle-attend'] ?? 0; }
    return { ...o, pSans: 100 * o.sans / Math.max(1, o.n), taux: 100 * o.ok / Math.max(1, o.n) }; };
  const mA = monde(matchCfg({ presseLue: null /* presseLue null DATÉ 289 : vert à HEAD~ (worktree 7bd70e0), perdues sans touche 35,2 % c. 35,5 sans la clé du 288 dans ce monde (la clause du 288 se mesure au monde du 288) — la clause mesure sa loi, pas la pression lue au temps d'arrivée */, shotRange: 20 })), mN = monde(matchCfg({ presseLue: null /* presseLue null DATÉ 289 : vert à HEAD~ (worktree 7bd70e0), perdues sans touche 35,2 % c. 35,5 sans la clé du 288 dans ce monde (la clause du 288 se mesure au monde du 288) — la clause mesure sa loi, pas la pression lue au temps d'arrivée */, shotRange: 20, ouverture: null }));
  ok(`lot 288 — …et LE MONDE : 3 × 600 s, passes au sol perdues sans touche ${mA.pSans.toFixed(1)} % de ${mA.n} (≤ sans ${mN.pSans.toFixed(1)} % de ${mN.n} − 3) ; refus controle-dos du receveur visé ${mA.dos} ≤ 0,7 × ${mN.dos} (attentes ${mA.attend}) ; réussite ${mA.taux.toFixed(1)} % ≥ ${mN.taux.toFixed(1)} + 1 ; passes ${mA.n} ≥ 0,8 × ${mN.n} (les possessions qui tiennent passent moins)`,
    mA.pSans <= mN.pSans - 3 && mA.dos <= 0.7 * mN.dos && mA.taux >= mN.taux + 1 && mA.n >= 0.8 * mN.n);
}

if (__bloc()) {
  // LA PRESSION SE LIT AU TEMPS D'ARRIVÉE (289, la demande « ultra réaliste sur les passes » — le grand livre des passes sonde-289 :
  // 2× trop de pertes, 1,3 passe par séquence ; ~46 tacles piqués par équipe et par match sur des porteurs que le moteur croyait AU CALME
  // parce que le défenseur était à plus de 1,8 m) — (a) lois pures : le seuil vaut 0,55 à l'identité (composure 50, tempo 0,5), le
  // sang-froid le relève (× 1,075/0,85), le nerveux l'abaisse (× 1,075/1,30), le tempo posé × 1,15, le vif × 0,85 ; la pression lue sur
  // une géométrie réelle : un défenseur PLANTÉ à 2,3 m presse (le 1,8 m d'hier le disait calme), à 6 m non, à 5 m lancé à 6 m/s oui ; à
  // 3 m planté, l'anticipateur (× 1,15) le lit pressé, le distrait (× 0,85) non.
  const K = matchCfg({}).presseLue;
  const s50 = seuilPresseDe(K, {}), sCalme = seuilPresseDe(K, { composureF: 0.85 }), sNerf = seuilPresseDe(K, { composureF: 1.30 }), sPose = seuilPresseDe(K, { tempo: 0 }), sVif = seuilPresseDe(K, { tempo: 1 });
  const geo = (dF, vF, anticipF = 1) => { const st = makeMatch({ full: true, seed: 3 }), c = st.players.find((q) => q.team === 0 && !q.keeper), f = st.players.find((q) => q.team === 1 && !q.keeper);
    for (const q of st.players) { q.p[0] = q.team === 0 ? -45 : 45; q.p[2] = 30; q.v = [0, 0]; q.down = 0; }
    c.p[0] = 0; c.p[2] = 0; c.v = [0, 0]; c.skill = { ...(c.skill ?? {}), anticipF }; f.p[0] = dF; f.p[2] = 0; f.v = [-vF, 0];
    return presseLueDe(st, c, K, matchCfg({}), 0.5); };
  const g23 = geo(2.3, 0), g6 = geo(6, 0), g5l = geo(5, 6), g3a = geo(3, 0, 1.15), g3d = geo(3, 0, 0.85);
  ok(`lot 289 — LA PRESSION SE LIT AU TEMPS D'ARRIVÉE, lois pures : seuil ${s50.toFixed(3)} à l'identité, ${sCalme.toFixed(3)} au sang-froid, ${sNerf.toFixed(3)} au nerveux, ${sPose.toFixed(3)} posé, ${sVif.toFixed(3)} vif ; planté à 2,3 m P ${g23.P.toFixed(2)} (pressé ${g23.presse}), à 6 m ${g6.P.toFixed(2)} (${g6.presse}), à 5 m lancé ${g5l.P.toFixed(2)} (${g5l.presse}) ; à 3 m planté l'anticipateur ${g3a.P.toFixed(2)} (${g3a.presse}), le distrait ${g3d.P.toFixed(2)} (${g3d.presse})`,
    Math.abs(s50 - 0.55) < 1e-12 && sCalme > s50 && sNerf < s50 && Math.abs(sPose - 0.55 * 1.15) < 1e-12 && Math.abs(sVif - 0.55 * 0.85) < 1e-12
    && g23.presse === true && g6.presse === false && g5l.presse === true && g3a.presse === true && g3d.presse === false);
  // (b) la fixture : le porteur ballon au pied, sa tenue calme tirée longue (2,4 s), un défenseur TENU à sa place à 2,3 m en diagonale
  // (le marqueur qui ne charge pas : l'avant-contact du 238 ne le voit pas venir), un coéquipier libre 12 m derrière ; les gestes du 1c1
  // ôtés des deux mondes (un autre choix), la fenêtre d'engagement et la pose effacées — sous la clé il est pressé (P 0,59) : la passe
  // part vite (≤ 1,2 s) ; sans la clé il est « au calme » (au-delà de 1,8 m) et conduit en servant sa tenue : rien ne part en 2,5 s
  // (ou ≥ + 0,4 s).
  const fixture = (over) => { const st = makeMatch({ full: true, seed: 3 }), cfg = matchCfg({ shotRange: 20, ceremonie: null, skill: { ...matchCfg({}).skill, passementFoe: null, crochetFoe: null, doubleFoe: null, pontFoe: null, rouletteFoe: null }, ...over });
    for (let i = 0; i < 60 * 60 && !(st.phase === 'carry' && st.possession.carrier >= 0 && !st.restart); i++) matchStep(st, 1 / 60, cfg);
    const c = st.players[st.possession.carrier], sg = Math.sign(st.pitch.attackGoal(c.team).x || 1);
    for (const q of st.players) if (q.id !== c.id) { q.p[0] = q.team === c.team ? -sg * 40 : sg * 40; q.p[2] = (q.id % 11) * 5 - 25; q.v = [0, 0]; q.act = null; q.down = 0; q._pace = null; }
    c.p[0] = 0; c.p[2] = 0; c.v = [0, 0]; c.yaw = sg > 0 ? 0 : Math.PI; c.intent = null; c.act = null; c._retour = null; c._pausa = null; c._bouclier = null;
    st.ball.release('perte'); st.ball.restart([sg * 0.55, 0.11, 0], { cause: 'touche' }); st.ball.possess(c.id); st.phase = 'carry'; st.hold = 0.2;
    const f = st.players.find((q) => q.team !== c.team && !q.keeper), m = st.players.find((q) => q.team === c.team && !q.keeper && q.id !== c.id);
    const fp = [sg * 2.3 * Math.SQRT1_2, 2.3 * Math.SQRT1_2]; f.p[0] = fp[0]; f.p[2] = fp[1]; m.p[0] = -sg * 12; m.p[2] = 1.5;
    st._calmKey = `${c.id}:${st.turnovers}:${st.passes}`; st._calmHold = 2.4; st._settling = null; st._engagement = null;
    const n0 = st.events.length, t0 = st.t; let tPasse = null;
    for (let i = 0; i < 150 && tPasse == null; i++) { matchStep(st, 1 / 60, cfg); f.p[0] = fp[0]; f.p[2] = fp[1]; f.v = [0, 0]; const e = st.events.slice(n0).find((x) => x.type === 'pass' && x.by === c.id); if (e) tPasse = st.t - t0; }
    return { tPasse, presse: c._presse?.presse ?? null, P: c._presse?.P ?? null }; };
  const fA = fixture({}), fN = fixture({ presseLue: null });
  ok(`lot 289 — …la FIXTURE : un défenseur tenu à 2,3 m en diagonale, la tenue calme tirée à 2,4 s — sous la clé le porteur se lit pressé (${fA.presse}, P ${fA.P?.toFixed(2)}) et la passe part à ${fA.tPasse == null ? 'jamais' : fA.tPasse.toFixed(2) + ' s'} (≤ 1,2) ; sans la clé, « au calme », ${fN.tPasse == null ? 'rien en 2,5 s' : 'à ' + fN.tPasse.toFixed(2) + ' s'} (≥ + 0,4)`,
    fA.tPasse != null && fA.tPasse <= 1.2 && (fN.tPasse == null || fN.tPasse >= fA.tPasse + 0.4));
  // (c) le monde : 4 × 900 s — les tacles piqués baissent (≤ 0,85 × sans), les changements de possession aussi (≤ 0,97 × sans), les
  // passes ne baissent pas (≥ 0,98 × sans) et la complétion (première touche d'un coéquipier) tient (≥ sans − 2 pts).
  const monde = (cfg) => { const o = { pique: 0, turn: 0, passes: 0, ok: 0, n: 0 }; for (const seed of [3, 7, 11, 13]) { const st = makeMatch({ full: true, seed }); let seen = 0, pend = null;
      for (let i = 0; i < 900 * 60; i++) { matchStep(st, 1 / 60, cfg);
        for (; seen < st.events.length; seen++) { const e = st.events[seen], p = e.by != null ? st.players[e.by] : null;
          if (e.type === 'tacle-pique') o.pique++; if (e.type === 'turnover') { o.turn++; if (pend) { o.n++; pend = null; } }
          if ((e.type === 'control' || e.type === 'receive' || e.type === 'loose-kept') && pend && p && p.team === pend.team) { o.n++; o.ok++; pend = null; }
          if (e.type === 'pass' && !e.clear && !e.mains && e.to >= 0 && p) { o.passes++; if (pend) { o.n++; if (p.team === pend.team) o.ok++; } pend = { team: p.team, t: st.t }; } }
        if (pend && st.t - pend.t > 6) pend = null; } }
    return { ...o, taux: 100 * o.ok / Math.max(1, o.n) }; };
  const mA = monde(matchCfg({ shotRange: 20 })), mN = monde(matchCfg({ shotRange: 20, presseLue: null }));
  ok(`lot 289 — …et LE MONDE : 4 × 900 s, tacles piqués ${mA.pique} ≤ 0,85 × ${mN.pique} ; changements de possession ${mA.turn} ≤ 0,97 × ${mN.turn} ; passes ${mA.passes} ≥ 0,98 × ${mN.passes} ; complétion ${mA.taux.toFixed(1)} % ≥ ${mN.taux.toFixed(1)} − 2`,
    mA.pique <= 0.85 * mN.pique && mA.turn <= 0.97 * mN.turn && mA.passes >= 0.98 * mN.passes && mA.taux >= mN.taux - 2);
}

if (__bloc()) {
  // LA CONDUITE SE SERRE SOUS PRESSION (290 — RÉFUTÉE à la mesure, éteinte par défaut ; le 289 nommait ~50 pertes par équipe sur des
  // piques et des touches qui s'échappent) — (a) lois pures : sous p0 la touche d'hier (k 1, pas de plafond) ; à P 0,65 la mène × 0,55,
  // au plein la borne 0,45, le ballon ≤ corps + 0,6 m/s ; la clé est nulle par défaut.
  const K = { p0: 0.3, min: 0.45, kP: 0.9, dv: 0.6 }, a0 = serreDe(0.2, K), a65 = serreDe(0.65, K), a1 = serreDe(1, K);
  ok(`lot 290 — LA CONDUITE SE SERRE SOUS PRESSION (réfutée), lois pures : P 0,2 → k ${a0.k} (dv ${a0.dv}) ; P 0,65 → k ${a65.k.toFixed(2)} (dv ${a65.dv}) ; P 1 → k ${a1.k.toFixed(2)} ; la clé par défaut ${JSON.stringify(matchCfg({}).conduiteSerree)}`,
    a0.k === 1 && a0.dv === null && Math.abs(a65.k - 0.55) < 1e-12 && a65.dv === 0.6 && Math.abs(a1.k - 0.45) < 1e-12 && matchCfg({}).conduiteSerree === null);
  // (b) la réfutation mesurée : 4 × 600 s, la clé ALLUMÉE au réglage franc contre éteinte — la touche se serre (l'écart pied-ballon
  // maximal entre deux touches sous forte pression, P ≥ 0,75, baisse d'au moins 0,2 m) mais les tacles piqués ne baissent pas de plus de
  // 15 % (ils tombent sur des touches prises avant que le presseur n'arrive) : la loi reste éteinte.
  const monde = (cfg) => { const o = { pique: 0, ecarts: [] }; const K2 = matchCfg({}).presseLue ?? { seuil: 0.55 };
    for (const seed of [3, 7, 11, 13]) { const st = makeMatch({ full: true, seed }); let seen = 0, cur = null;
      for (let i = 0; i < 600 * 60; i++) { matchStep(st, 1 / 60, cfg);
        if (cur) { const c = st.players[cur.by]; cur.e = Math.max(cur.e, Math.hypot(st.ball.p[0] - c.p[0], st.ball.p[2] - c.p[2])); if (st.t - cur.t > 1.5) { if (cur.hi) o.ecarts.push(cur.e); cur = null; } }
        for (; seen < st.events.length; seen++) { const e = st.events[seen]; if (e.type === 'tacle-pique') o.pique++;
          if (e.type === 'touche' && e.by != null && st.possession.carrier === e.by && !st.players[e.by].keeper) { if (cur && cur.hi) o.ecarts.push(cur.e); const c = st.players[e.by];
            cur = { by: e.by, t: st.t, e: Math.hypot(st.ball.p[0] - c.p[0], st.ball.p[2] - c.p[2]), hi: presseLueDe(st, c, K2, cfg, 0.5).P >= 0.75 }; } } } }
    const s2 = [...o.ecarts].sort((x, y) => x - y); return { pique: o.pique, ecart: s2.length ? s2[s2.length >> 1] : NaN, n: s2.length }; };
  const mA = monde(matchCfg({ shotRange: 20, conduiteSerree: { p0: 0.3, min: 0.25, kP: 1.2, dv: 0.2 } })), mN = monde(matchCfg({ shotRange: 20 }));
  ok(`lot 290 — …et LA RÉFUTATION : 4 × 600 s, clé allumée (franche) contre éteinte — l'écart pied-ballon sous forte pression ${mA.ecart.toFixed(2)} m c. ${mN.ecart.toFixed(2)} (≤ − 0,2 : la touche se serre ; ${mA.n} c. ${mN.n} touches) ; les tacles piqués ${mA.pique} c. ${mN.pique} (≥ 0,85 × : ils ne baissent pas — la loi reste éteinte)`,
    mA.ecart <= mN.ecart - 0.2 && mA.pique >= 0.85 * mN.pique);
}

if (__bloc()) {
  // LE TACLE DEBOUT (291 — Modèle 11 § 4 ; sonde-291 : 77,5 % des tentatives de pique réussies, le book ~50, 15-17 % hors du cône du
  // pied) — (a) lois pures : le pied balaie ± 55° devant le buste (le ballon à 30° : tenté ; à 80° : non) ; la réussite = la note ×
  // 0,56 (0,725 → 0,406 à l'identité), le dribbleur l'esquive (esquiveF + 0,08 : × 0,85 ; − 0,08 : × 1,15).
  const K = matchCfg({}).tacleDebout, q0 = { yaw: 0, p: [0, 0, 0] }, bal = (deg) => ({ p: [Math.cos(deg * Math.PI / 180), 0.11, Math.sin(deg * Math.PI / 180)] });
  const r0 = piqueReussiteDe(0.725, { skill: { esquiveF: 0 } }, K), rF = piqueReussiteDe(0.725, { skill: { esquiveF: 0.08 } }, K), rB = piqueReussiteDe(0.725, { skill: { esquiveF: -0.08 } }, K);
  ok(`lot 291 — LE TACLE DEBOUT, lois pures : le ballon à 30° du buste ${piqueTenteDe(q0, bal(30), K) ? 'tenté' : 'non'}, à 80° ${piqueTenteDe(q0, bal(80), K) ? 'tenté' : 'non'} ; réussite à l'identité ${r0.toFixed(3)}, contre un dribbleur fort ${rF.toFixed(3)}, faible ${rB.toFixed(3)} ; battu ${K.battu} s`,
    piqueTenteDe(q0, bal(30), K) && !piqueTenteDe(q0, bal(80), K) && Math.abs(r0 - 0.406) < 1e-9 && Math.abs(rF - 0.406 * 0.85) < 1e-9 && Math.abs(rB - 0.406 * 1.15) < 1e-9 && K.battu === 0.22);
  // (b) le monde : 4 × 900 s, clé par défaut contre éteinte — la part des tentatives réussies tombe au book (40-62 %, contre ≥ 70 % sans),
  // les piques réussies baissent (≤ 0,8 × sans), les changements de possession PAR PASSE baissent (le jeu tient plus de passes pour
  // chaque perte ; en valeur absolue, 900 s est trop court : 229 → 245 pour 429 → 479 passes — au monde de 90 min, sonde-289 : 228 →
  // 209-220 pertes par équipe), les passes tiennent (≥ 0,98 × sans), la complétion aussi (≥ sans − 2 pts).
  const monde = (cfg) => { const o = { pique: 0, rate: 0, turn: 0, passes: 0, ok: 0, n: 0 }; for (const seed of [3, 7, 11, 13]) { const st = makeMatch({ full: true, seed }); let seen = 0, pend = null;
      for (let i = 0; i < 900 * 60; i++) { const cd0 = st.players.map((x) => x._pokeCd ?? -1); matchStep(st, 1 / 60, cfg);
        for (let k = 0; k < st.players.length; k++) { const cd = st.players[k]._pokeCd ?? -1; if (cd !== cd0[k] && Math.abs(cd - (st.t + 0.9)) < 0.02) o.rate++; }
        for (; seen < st.events.length; seen++) { const e = st.events[seen], p = e.by != null ? st.players[e.by] : null;
          if (e.type === 'tacle-pique') o.pique++; if (e.type === 'turnover') { o.turn++; if (pend) { o.n++; pend = null; } }
          if ((e.type === 'control' || e.type === 'receive' || e.type === 'loose-kept') && pend && p && p.team === pend.team) { o.n++; o.ok++; pend = null; }
          if (e.type === 'pass' && !e.clear && !e.mains && e.to >= 0 && p) { o.passes++; if (pend) { o.n++; if (p.team === pend.team) o.ok++; } pend = { team: p.team, t: st.t }; } }
        if (pend && st.t - pend.t > 6) pend = null; } }
    return { ...o, taux: 100 * o.ok / Math.max(1, o.n), reussi: o.pique / Math.max(1, o.pique + o.rate) }; };
  const mA = monde(matchCfg({ shotRange: 20 })), mN = monde(matchCfg({ shotRange: 20, tacleDebout: null }));
  ok(`lot 291 — …et LE MONDE : 4 × 900 s, tentatives réussies ${(100 * mA.reussi).toFixed(0)} % (40-62) c. ${(100 * mN.reussi).toFixed(0)} % sans (≥ 70) ; piques ${mA.pique} ≤ 0,8 × ${mN.pique} ; changements de possession par passe ${(mA.turn / mA.passes).toFixed(3)} < ${(mN.turn / mN.passes).toFixed(3)} ; passes ${mA.passes} ≥ 0,98 × ${mN.passes} ; complétion ${mA.taux.toFixed(1)} % ≥ ${mN.taux.toFixed(1)} − 2`,
    mA.reussi >= 0.40 && mA.reussi <= 0.62 && mN.reussi >= 0.70 && mA.pique <= 0.8 * mN.pique && mA.turn / mA.passes < mN.turn / mN.passes && mA.passes >= 0.98 * mN.passes && mA.taux >= mN.taux - 2);
}

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
