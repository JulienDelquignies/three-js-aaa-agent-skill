// motion-gait — LA FOULÉE GÉNÉRÉE (lot A7). Le corps qui court, calculé — pas trois clips d'un soldat.
//
// Mesuré avant ce module (match 11c11, 1 min, 20 joueurs de champ) : la couche de geste possède 3,2 %
// du temps d'écran ; 97 % sont de la locomotion, et cette locomotion était TROIS clips du donneur
// Soldier (idle, walk, run) cadencés par gait.js — pas de sprint (le trot accéléré, buste droit), pas
// de course arrière (un défenseur sur trois court DOS au ballon), pas de pas chassés (le gardien
// glisse de côté sur un cycle de marche de face — 43 % de son temps), pas de virage, pas de freinage.
//
// La méthode est celle des gestes (reference/51) : des CHEMINS DE PIED et des courbes articulaires
// anatomiques, en repère personnage, résolus par l'IK de jambe sur la hanche de l'instant — et la
// sortie est une pose ABSOLUE par os (rest ⊗ q_spec), posée par le contrôleur après le mixer, avec le
// même écrivain que la couche de geste. Différence avec un geste : la foulée est une FONCTION PURE de
// (φ, v→) — la phase de l'horloge unique (gait.js, cadence de Dorn 2012) et la vitesse en repère
// corps (avant, droite) — sans clé ni durée : n'importe quelle vitesse, n'importe quelle direction,
// sans blend tree. Le pied d'appui est FIXE AU MONDE PAR CONSTRUCTION (il recule sous le bassin
// exactement à −v→) : le verrou de pieds n'a plus qu'un résidu à tenir.
//
// Le cycle d'un pied (u ∈ [0,1), u = 0 au contact) : APPUI FIXE (cheville immobile au monde),
// PELAGE (le talon décolle, la cheville monte en pivotant sur l'orteil et avance de r — le
// déroulé talon-pointe qui manquait au modèle « cheville clouée » : 0,2 m par appui en marche),
// puis VOL (chemin de c1 à c0, cloche de hauteur au pic swingPeak — le talon vers la fesse en
// course, le genou devant en course arrière). φ = 0 est le contact GAUCHE (convention gait.js),
// le pied droit vit à φ + ½.
//
// Les nombres : Winter 2009 (marche 1,4 m/s : hanche +30/−10°, genou 60° en vol, appui 60 %),
// Novacheck 1998 (course : appui 40 → 35 %, hanche 45/−20°, genou 90-100° en vol, tronc 5-10°),
// Mann & Hagy 1980 (sprint : bras 90° de coude ; le reste du sprint est MESURÉ : Dorn 2012 + Miyashiro 2019, foulee-rbds), Pontzer 2009 (déphasage
// bassin/épaules 149° marche → 94° course, tête ≤ 6°). À reculons (2026-09-24) : MESURÉ — la marche arrière (Scherpereel 2023,
// 10 marcheurs), la course arrière assemblée de sources publiées (Brennan 2026, Bates 1986, Arata 1999, Cavagna 2012 ; RECUL_REF).
// Pas chassés : Flynn 1994 et la pratique (chassés larges, genoux fléchis, pas de croisement).
//
// Pur : aucune dépendance rendu. verify-foulee.mjs porte le contrat et ses sabotages.

import { fkPose, jointToSpec, quatToEulerXYZ, rx, ry, rz, chain } from './motion-rig.js';
import { legIK, armJoints, ramp, bump } from './motion-strike.js';
import { armPose } from './motion-idle.js';   // (A12e) la pose de bras de l'attente, reprise en marche
import { strideLaw } from './gait.js';
import { volRef, chevilleRef, piedAppuiRef, hancheRef, dutyRef, metatarseRef, cadenceRecul, vsolRecul, APPUI_REF } from './foulee-rbds.js';
import { sub, len, quatMul, quatConjugate, quatNormalize, clamp, applyQuat } from './vecmath.js';
import { subRng } from './rng.js';

const D2R = Math.PI / 180;
const lerp = (a, b, t) => a + (b - a) * clamp(t, 0, 1);
const TAU = Math.PI * 2;

/**
 * LES RÉGIMES — un jeu de paramètres par allure, interpolé par la vitesse (avant) puis fondu par la
 * direction (arrière, latéral). Chaque nombre est nommé pour être discutable.
 *   s         fraction d'appui du cycle        peel     part de l'appui qui est le pelage (talon levé)
 *   bias      le pied se pose PLUS PRÈS du bassin qu'il ne le quitte (0 = symétrique)
 *   roll      avance monde de la cheville pendant l'appui (déroulé talon-pointe), m
 *   hw        demi-largeur de pas, m           pitchHS  tangage du pied au contact (+ = pointe haute)
 *   pitchTO   tangage à la pointe (pelage)     swingH   hauteur max de la cheville en vol, m
 *   swingPeak position du pic dans le vol      swingK   retard du transfert horizontal (le talon monte d'abord)
 *   drop      affaissement du bassin, m        bobA     amplitude du rebond (2 par cycle)  bobSign +1 marche / −1 course
 *   pYaw pList pTilt  bassin (°)              lean     inclinaison du tronc (°, avant)
 *   girdle    lacet des épaules (°)            psi      déphasage bassin/épaules (°, Pontzer)
 *   armA armOff  balancier des bras (°)        elbow elbowMod  coude (°)   armElev  écartement (°)
 *   turnout   ouverture des pieds (°)          toeUp    extension des orteils au pelage (°)
 */
// LES RÉGIMES DE COURSE SONT ANCRÉS SUR DES MESURES (2026-09-24) : jog à 2,5 m/s et run à 4,5 m/s — les vitesses des coureurs de
// Fukuchi 2017 (RBDS) —, l'appui y est MESURÉ : contact à la force verticale (> 50 N) × fréquence, 0,338 et 0,275 (0,299 à 3,5 m/s,
// l'interpolation le recoupe ; le « non vide » des courbes traitées, 0,41 / 0,34, gonfle le contact). Les autres nombres des régimes de
// course sont CALÉS sur les courbes articulaires moyennes des mêmes coureurs (genou, cuisse globale, cheville) par l'ajusteur des sondes de
// foulée, sous les contrats de ce module. L'antéversion du bassin (pTilt) est MESURÉE, pas calée : ASIS/PSIS en course − debout, +4,2 /
// +6,2 / +7,2° à 2,5 / 3,5 / 4,5 m/s (14 coureurs). Le tronc ne la suit pas en entier (la lordose compense : J.Spine).
// LE SPRINT EST MESURÉ (2026-09-24) : ancré à 9,47 m/s, la vitesse du sprinter de Dorn 2012 (SimTK runningspeeds, MIT) — appui 0,257
// (contact × fréquence, 9 sprinteurs de la table de Dorn), antéversion +7,6° (ASIS/sacrum − debout), tronc 16° ; le vol (cuisse, genou,
// cheville) suit ses courbes (foulee-rbds). Le reste est calé sur son cycle à 6,97 et 9,47 m/s sous contrat (foulee-sondes/sprint-mesure.mjs).
// L'APPUI DE COURSE EST MESURÉ (2026-09-24, poids wRun) : l'inclinaison du pied, la hauteur du bassin et la levée des métatarses suivent les
// coureurs (APPUI_REF : RBDS 2,5-4,5, le sprinter 5,2-9,5 ; foulee-rbds) — pitchHS / pitchTO / drop / bobA des régimes ne servent plus qu'aux
// mélanges avec la course arrière et les chassés. Le point d'appui est géométrique (talon qui roule, métatarses, orteils), la portée ne rabaisse le bassin que
// LOCALEMENT. bias est calé sur la pose et le décollage mesurés (compare-appui.mjs). Écart restant : au sprint, la géométrie de décollage
// du sprinter dépasse la jambe du rig de 1,6 % (l'incertitude d'un centre de hanche estimé) — le compromis garde son bassin (sans plongée)
// et pose le pied ~8 cm plus en avant (0,38 L contre 0,29).
// LA MARCHE EST MESURÉE (2026-09-24) : Fukuchi 2018 (WBDS, figshare 5722711, CC BY 4.0 — 24 jeunes adultes sur tapis, 0,59-1,78 m/s) —
// appui 0,707 → 0,635 (événements de Zeni), cadence (gait.js), vol (MARCHE_VOL), pied et bassin en appui (APPUI_REF, plus haut à mi-appui) ;
// bias 0,10 balayé sur toutes les vitesses ; portée à 4° (le marcheur pose la jambe à 1-3°, 12° l'accroupissait) ; plancher de l'orteil
// mesuré (MT1 en vol : médiane 0,7 cm). Le poids wRun vaut donc aussi pour la marche. Écart restant : le genou à la pose, 20-30° contre 1-3°
// — la jambe du rig contre la géométrie des données (compare-marche).
// À RECULONS C'EST MESURÉ AUSSI (2026-09-24, RECUL_REF, même poids wRun sur l'axe arrière) : la MARCHE arrière sur 10 marcheurs (Scherpereel
// 2023, tapis à deux bandes, 0,6-1,0 m/s) — le pied se pose sur la POINTE (−22 à −31°) et quitte le sol TALON EN DERNIER (+13 à +19°), le genou
// se pose plié (31-39°) et décolle tendu, le vol plie le genou TARD (44-50° vers 70 % du vol), cadence ×1,19-1,25 la marche avant, appui à la
// force ; la COURSE arrière assemblée (aucun jeu de données public) : cadence et appui de Brennan 2026, forme des courbes d'un acteur (100STYLE),
// genou 40° à la pose (Bates 1986), amplitude à 5,1 m/s (Arata 1999), rebond de Cavagna 2012, creux TARD dans l'appui (atterrissage doux,
// décollage dur). Des régimes backWalk / back / backFast ne restent que le haut du corps, la largeur et bias (calé : compare-recul.mjs).
// Écart restant : le genou au décollage de la marche arrière, 15-20° contre 4° — le même résidu de normalisation que la pose en avant.
export const GAIT_REGIMES = {
  walk:   { v: 1.4, s: 0.62, peel: 0.50, bias: 0.10, roll: 0.20, hw: 0.09,  pitchHS: 12, pitchTO: 30, swingH: 0.11, swingPeak: 0.34, swingK: 1.0,  drop: 0.010, bobA: 0.024, bobSign: 1,  pYaw: 4,  pList: 4, pTilt: 0,  lean: 3,  girdle: 4.5, psi: 149, armA: 14, armOff: 0,  elbow: 24, elbowMod: 8,  armElev: 8,  turnout: 8, toeUp: 22 },
  jog:    { v: 2.5, s: 0.338, peel: 0.756, bias: 0.175, roll: 0.12, hw: 0.07,  pitchHS: 2,  pitchTO: 44, swingH: 0.20, swingPeak: 0.32, swingK: 1.2,  drop: 0.04, bobA: 0.038, bobSign: -1, pYaw: 6,  pList: 5, pTilt: 4.2,  lean: 6,  girdle: 9,   psi: 100, armA: 26, armOff: 6,  elbow: 75, elbowMod: 12, armElev: 11, turnout: 6, toeUp: 18 },
  run:    { v: 4.5, s: 0.275, peel: 0.836, bias: 0.15, roll: 0.10, hw: 0.055, pitchHS: 0,  pitchTO: 75, swingH: 0.30, swingPeak: 0.30, swingK: 1.3,  drop: 0.045, bobA: 0.037, bobSign: -1, pYaw: 7,  pList: 6, pTilt: 7.2,  lean: 8,  girdle: 12,  psi: 94,  armA: 36, armOff: 10, elbow: 90, elbowMod: 14, armElev: 13, turnout: 5, toeUp: 15 },
  sprint: { v: 9.47, s: 0.257, peel: 0.35, bias: 0.175, roll: 0.06, hw: 0.045, pitchHS: 10, pitchTO: 50, swingH: 0.30, swingPeak: 0.42, swingK: 1.0,  drop: 0.035, bobA: 0.005, bobSign: -1, pYaw: 9,  pList: 5, pTilt: 7.6,  lean: 10, girdle: 14,  psi: 92,  armA: 42, armOff: 10, elbow: 92, elbowMod: 18, armElev: 15, turnout: 4, toeUp: 12 },
  // À RECULONS (2026-09-24) : la marche arrière (0,8 m/s) puis la course arrière (3 m/s) — appui, vol, pied, bassin et cadence sont MESURÉS
  // (RECUL_REF, poids wRun) ; restent de ces régimes le haut du corps (buste droit, bras courts, marche : bras de marcheur), la largeur, bias
  backWalk: { v: 0.8, s: 0.674, peel: 0.30, bias: 0,  roll: 0.05, hw: 0.09, pitchHS: -27, pitchTO: -16, swingH: 0.08, swingPeak: 0.60, swingK: 1.0, drop: 0.010, bobA: 0.020, bobSign: 1, pYaw: 3, pList: 3, pTilt: 0, lean: 2, girdle: 3, psi: 149, armA: 10, armOff: 4, elbow: 24, elbowMod: 6, armElev: 8, turnout: 8, toeUp: 0 },
  back:   { v: 3.0, s: 0.40, peel: 0.20, bias: -0.10, roll: 0.05, hw: 0.09, pitchHS: -10, pitchTO: 8, swingH: 0.14, swingPeak: 0.45, swingK: 1.0, drop: 0.060, bobA: 0.025, bobSign: -1, pYaw: 3,  pList: 3, pTilt: -2, lean: 1,  girdle: 5,   psi: 100, armA: 14, armOff: 12, elbow: 70, elbowMod: 6,  armElev: 14, turnout: 6, toeUp: 10 },
  backFast: { v: 5.0, s: 0.40, peel: 0.20, bias: -0.05, roll: 0.05, hw: 0.09, pitchHS: -10, pitchTO: 8, swingH: 0.14, swingPeak: 0.45, swingK: 1.0, drop: 0.060, bobA: 0.025, bobSign: -1, pYaw: 3,  pList: 3, pTilt: -2, lean: 1,  girdle: 5,   psi: 100, armA: 14, armOff: 12, elbow: 70, elbowMod: 6,  armElev: 14, turnout: 6, toeUp: 10 },
  // les PAS CHASSÉS : larges (hw dynamique — jamais de croisement), bas, tronc penché, bras ouverts
  lat:    { v: 2.0, s: 0.50, peel: 0.10, bias: 0,     roll: 0,    hw: 0.12, pitchHS: 0,   pitchTO: 6, swingH: 0.09, swingPeak: 0.50, swingK: 1.0, drop: 0.110, bobA: 0.015, bobSign: -1, pYaw: 2,  pList: 3, pTilt: 6,  lean: 14, girdle: 3,   psi: 100, armA: 6,  armOff: 18, elbow: 60, elbowMod: 4,  armElev: 32, turnout: 4, toeUp: 8 },
};
const FWD_ORDER = ['walk', 'jog', 'run', 'sprint'];
const KEYS = Object.keys(GAIT_REGIMES.walk).filter((k) => k !== 'v');
/** À reculons : la marche arrière (0,8 m/s) → la course arrière (3 m/s) → vite (5 m/s, ~ le plafond à reculons : 5,3 m/s chez des athlètes,
 *  Brennan 2026), fondu linéaire (la transition préférée à reculons : 1,58 m/s, Hreljac & Imamura 2005). */
const BACK_ORDER = ['backWalk', 'back', 'backFast'];
function backParams(v) {
  const R = BACK_ORDER.map((k) => GAIT_REGIMES[k]);
  let i = 1; while (i < R.length - 1 && v > R[i].v) i++;
  const a = R[i - 1], b = R[i], t = clamp((v - a.v) / (b.v - a.v), 0, 1), out = {};
  for (const k of KEYS) out[k] = lerp(a[k], b[k], t);
  return out;
}

/** Les paramètres d'une vitesse AVANT : interpolation linéaire entre régimes (walk ↔ jog est la
 *  transition marche-course, 1,4 → 2,8 m/s : l'appui passe de 0,62 à 0,44, le double appui devient vol). */
function forwardParams(v) {
  const x = clamp(v, 0, 12);
  const R = FWD_ORDER.map((k) => GAIT_REGIMES[k]);
  if (x <= R[0].v) return { ...R[0] };
  for (let i = 1; i < R.length; i++) {
    if (x <= R[i].v) {
      const a = R[i - 1], b = R[i], t = (x - a.v) / (b.v - a.v);
      const out = {};
      for (const k of KEYS) out[k] = lerp(a[k], b[k], t);
      return out;
    }
  }
  return { ...R[R.length - 1] };
}

/** Les paramètres résolus pour (v→) : fondu des régimes avant / arrière / latéral par la direction. */
/** (A7 bis) LA CADENCE À L'ÉCHELLE DE LA JAMBE : une jambe plus courte fait des foulées plus courtes à la même vitesse (S ∝ L), donc
 *  une cadence plus haute (× L₀/L) — et c'est la jambe FONCTIONNELLE du rig qui compte (articulation de hanche → cheville, cuisse +
 *  tibia du profil) : c'est elle qui décide si la foulée tient dans l'amplitude de la hanche. Borné [0,85 ; 1,35]. La référence dans
 *  la MÊME convention : les sujets de Dorn 2012 (176 cm, texte du PDF) × Winter 2009 (hanche → cheville = 0,491 × taille) = 0,864 m.
 *  (Les rigs sont plus courts de jambe que leur taille : shanon 0,76 m pour 1,80 m — ×1,14.) */
export const LEG_REF = 0.864;
/** (A7 bis) LE FREIN RACCOURCIT LA FOULÉE : les pas de frein sont plus courts et plus vifs (le cycle × (1 − 0,25·frein)) — la cadence
 *  de l'horloge du contrôleur suit du même facteur (une phase, une durée). */
export function gaitBrakeCadence(brake) { return 1 / (1 - 0.25 * clamp(brake ?? 0, 0, 1)); }
/** (2026-09-24) LE VIRAGE SERRÉ RACCOURCIT LA FOULÉE, comme le frein : cadence × (1 + 0,2·(|a|/9)²) (×1,18 à 8,5 m/s² d'accélération
 *  latérale) — sur la foulée réelle (loi de Dorn/RBDS), la jambe qui pousse hors du virage partait à −43° (cuisse globale, 6 m/s,
 *  a = 8,5) ; celui qui coupe fort raccourcit ses appuis. Choix physique, pas calé sur des mesures ; l'horloge du contrôleur suit. */
export function gaitTurnCadence(aT) { const k = Math.min(1, Math.abs(aT ?? 0) / 9); return 1 + 0.2 * k * k; }
/** LE PIVOT (2026-09-24) : le corps qui TOURNE presque sur place (lacet ω, rad/s) doit changer d'appui — une hanche tourne de ~35° sur
 *  un pied planté, l'appui en tient ~60 % du cycle : un cycle au moins par ~60° de rotation (1,05 rad), plafonné à 2 Hz (le piétinement
 *  du footballeur qui se retourne : 180° en ~0,6 s, 4-5 appuis ; plafonné à 1,2 Hz, 3 replantations sur 306 appuis en 60 s de duel, 0 à 2 Hz). Sans lui, l'horloge suit la seule vitesse : à 0,5 m/s un appui dure 3 s, le corps pivote de 115° dessus, la jambe arrive en
 *  butée et l'ancre se replante d'un coup (30 cm en une image, mesuré en jeu). La cadence MINIMALE (Hz) — le contrôleur l'impose à
 *  l'horloge, la foulée à sa durée (opts.pivotHz) : une phase, une durée. */
export function gaitPivotCadence(yawRate) { return Math.min(2, Math.abs(yawRate ?? 0) / 1.05); }
export function gaitLegK(P) { return clamp(LEG_REF / Math.max(0.3, P.lengths.thigh + P.lengths.shank), 0.85, 1.35); }
/** Le facteur EFFECTIF à l'allure v : plein jusqu'au sprinter mesuré (≤ 9,5 m/s — Dorn 2012, JA1 : la course de l'appui rapportée à
 *  la jambe y vaut 1,27 L, le générateur 1,29 avec le facteur plein, 1,37 à mi-fondu), fondu à 1 au-delà (2026-09-24 ; ≤ 9 m/s avant). (Il s'éteignait de 4,5 à 5,5 m/s :
 *  avec la cadence d'avant, 1,5 × trop vive, le sprint touchait déjà le plafond des articulations — genou 30 rad/s. Sur la loi réelle
 *  la marge existe — 2,02 Hz × 1,14 = 2,3 Hz à 8 m/s contre 2,9 — et sans le facteur la jambe courte de shanon tendait la hanche à
 *  −41° pour suivre des foulées de 4 m.) */
export const LEG_FADE = [9.5, 10.5];
export function gaitLegFactor(legK, v) { return 1 + (legK - 1) * clamp((LEG_FADE[1] - Math.abs(v)) / (LEG_FADE[1] - LEG_FADE[0]), 0, 1); }

export function gaitParams(vF, vR, style = NEUTRAL_GAIT_STYLE, override = null, legK = 1) {
  const v = Math.hypot(vF, vR);
  const f = v > 1e-6 ? Math.max(0, vF / v) : 1, bk = v > 1e-6 ? Math.max(0, -vF / v) : 0, lat = v > 1e-6 ? Math.abs(vR) / v : 0;
  const wsum = f + bk + lat || 1;
  const PF = forwardParams(v), PB = backParams(v), PL = GAIT_REGIMES.lat;
  const p = {};
  for (const k of KEYS) p[k] = (f * PF[k] + bk * PB[k] + lat * PL[k]) / wsum;
  // le style du joueur : facteurs et décalages nommés (GAIT_STYLE_RANGES)
  p.lean *= style.lean; p.swingH *= style.lift; p.hw *= style.width; p.bobA *= style.bob;
  p.pYaw *= style.pelvis; p.pList *= style.pelvis; p.pitchTO *= style.toeOff; p.drop *= style.drop;
  p.elbow += style.elbow; p.armElev += style.armElev; p.armA *= style.armSwing; p.turnout = style.turnout;
  p.bias += style.bias;
  // …et l'allure faible : à l'arrêt tout s'éteint (le bassin ne rebondit pas sur place, les bras
  // ne balancent pas) — la pose tend vers la station debout, que le contrôleur fond dans l'idle
  const low = clamp(v / 0.6, 0, 1);
  p.bobA *= low; p.armA *= low; p.pYaw *= low; p.pList *= low; p.girdle *= low;
  p.lean *= clamp(v / 1.2, 0, 1);
  p.v = v; p.f = f; p.bk = bk; p.lat = lat; p.recul = bk > f;   // (2026-09-24) le sens des mesures (RECUL_REF / APPUI_REF)
  // LA CADENCE SUIT LA DIRECTION : la loi de Dorn est celle de la course AVANT (1,5 m de foulée à
  // 1,4 m/s) ; à reculons on trottine plus court (×1,3), en pas chassés on double presque (×1,9) —
  // sans quoi un chassé à 2 m/s demanderait des pieds à 1,8 m l'un de l'autre. Le contrôleur
  // avance l'horloge avec le même facteur (gaitCadenceFactor) : une phase, une durée.
  p.kDir = gaitCadenceFactor(vF, vR);
  p.legK = gaitLegFactor(legK, v); p.T = 1 / Math.max(0.3, strideLaw(v) * p.kDir * p.legK);   // durée du cycle (deux appuis), s — (A7 bis) × la cadence de la jambe à cette allure
  // pas chassés : la demi-largeur suit la vitesse latérale pour que les pieds ne se croisent JAMAIS
  // (le pied qui se pose au plus à droite contre celui qui décolle au plus à gauche — voir contrat)
  if (lat > 1e-3) p.hw = Math.max(p.hw, lat * (0.415 * Math.abs(vR) * p.s * p.T + 0.08));
  p.pole = [0, 0, -1];
  // (2026-09-24) TOUTE L'ALLURE AVANT est calée sur des mesures (le poids garde son nom : wRun) — la marche (WBDS), la course (RBDS), le
  // sprint (Dorn) : vol articulaire, appui géométrique, bassin mesuré, facteur d'appui mesuré ; À RECULONS aussi (RECUL_REF : la marche
  // arrière mesurée, la course arrière assemblée) ; en chassés, le modèle d'hier.
  p.wRun = sstep((Math.max(f, bk) - 0.45) / 0.4);                     // pleine dès 32° de l'axe avant ou arrière (0,85), nulle au-delà de 63° (0,45) : les chassés gardent leur modèle
  p.s += (dutyRef(v) - PF.s) * f / wsum + (dutyRef(v, true) - PB.s) * bk / wsum;
  if (override) Object.assign(p, override);
  return p;
}

/** Le facteur de cadence d'une direction (1 en avant, 1,9 de côté ; à reculons MESURÉ — cadenceRecul : 1,19-1,25 × la marche avant des mêmes
 *  sujets de 0,6 à 1,0 m/s, Scherpereel 2023 ; 1,22-1,37 × la course avant de 2 à 5 m/s, Brennan 2026 ; hier 1,3 partout — fondu continu). */
export function gaitCadenceFactor(vF, vR) {
  const v = Math.hypot(vF, vR);
  if (v < 1e-6) return 1;
  const bk = Math.max(0, -vF / v), lat = Math.abs(vR) / v;
  return 1 + (cadenceRecul(v) - 1) * bk + 0.9 * lat;
}

/** LE STYLE D'UNE FOULÉE — la signature de course d'un joueur, bornée (reconnaissable, pas caricaturale). */
export const GAIT_STYLE_RANGES = {
  elbow: [-12, 12],        // ° port du coude (plus ou moins fermé)
  armSwing: [0.85, 1.15],  // × amplitude du balancier (la persona ajoute son armSwingF)
  armElev: [-3, 4],        // ° écartement des bras
  lean: [0.75, 1.25],      // × inclinaison du tronc
  lift: [0.85, 1.15],      // × hauteur du vol (talon vers la fesse)
  turnout: [3, 14],        // ° ouverture des pieds
  width: [0.85, 1.2],      // × largeur de pas
  bob: [0.8, 1.2],         // × rebond du bassin
  pelvis: [0.8, 1.2],      // × lacet/roulis du bassin
  bias: [-0.03, 0.03],     // décalage du point de pose
  toeOff: [0.85, 1.15],    // × pointe au pelage
  drop: [0.8, 1.25],       // × affaissement (le coureur haut ou assis)
};
export const NEUTRAL_GAIT_STYLE = Object.fromEntries(Object.entries(GAIT_STYLE_RANGES).map(([k, [a, b]]) => [k, (a + b) / 2]));
NEUTRAL_GAIT_STYLE.turnout = 7;

/** Le style d'un joueur : fonction pure de sa graine — même joueur, même foulée (comme styleFromSeed). */
export function gaitStyleFromSeed(seed) {
  const r = subRng(seed, 'style-foulee');
  const s = {};
  for (const [k, [a, b]] of Object.entries(GAIT_STYLE_RANGES)) { const u = (r() + r()) / 2; s[k] = a + (b - a) * u; }
  return s;
}

const sstep = (t) => { const u = clamp(t, 0, 1); return u * u * (3 - 2 * u); };

/**
 * LE CHEMIN D'UN PIED à sa phase u ∈ [0,1) (u = 0 au contact), en repère personnage RELATIF au
 * bassin (droite +X, haut +Y, arrière +Z ; le bassin est à l'origine au sol). `vC` est la vitesse
 * du corps en repère personnage, `c` le centre du pas (±hw), `ankleY` la hauteur de cheville au repos.
 * Renvoie { p, pitch (°, + = pointe haute), phase, toe (° extension des orteils) }.
 */
/** LE GRIFFÉ — h(w) sur [0,1] : h(0) = h(1) = 0, h'(0) = h'(1) = 1, et h' = −β au milieu (β = (2e/3)/(1 − 2e/3), la pente de
 *  compensation minimale pour que le recul des bouts se rende) ; impaire autour de ½. e = GRIFFE_E (part du vol à chaque bout). */
export const GRIFFE_E = 0.2, GRIFFE_LEVE = 0.5;
/** LA FENÊTRE DU GRIFFÉ EST UN TEMPS, pas une part du vol : le rappel du pied (vitesse sol ≈ 0 → le pied repart) est une affaire de
 *  dynamique du membre. Calibré à 20 % d'un vol de 0,26 s (la cadence d'avant, 5 m/s) = 52 ms ; avec la cadence de Dorn le vol dure
 *  0,49 s et 20 % gardaient le pied immobile ~100 ms — 12 cm de traîne de plus derrière la hanche, que le bassin rattrapait en
 *  s'écrasant (sonde dropprobe : 27 cm à 5 m/s). e = min(GRIFFE_E, GRIFFE_T / durée du vol). */
export const GRIFFE_T = 0.052;
export function griffeH(w, e = GRIFFE_E) {
  const b = (2 * e / 3) / (1 - 2 * e / 3);
  const left = (x) => -b * x + (1 + b) * (e / 3) * (1 - Math.pow(1 - Math.min(x, e) / e, 3));
  if (w <= 0.5) return w <= e ? left(w) : left(e) - b * (w - e);
  return -griffeH(1 - w, e);
}

export function footPath(u, P_, c, vC, ankleY, Lfoot, pied = null) {
  const p = P_;
  const D = [vC[0] * p.s * p.T, 0, vC[2] * p.s * p.T];                 // déplacement du corps pendant l'appui
  const dir = len(D) > 1e-9 ? [D[0] / len(D), 0, D[2] / len(D)] : [0, 0, -1];
  // (2026-09-24) en course, le pied pivote comme l'os le fait tourner — J.Foot = ry(ouverture) · rx(inclinaison) incline autour de l'axe
  // LATÉRAL DU PERSONNAGE, le vecteur du pied déjà ouvert : l'avance du roulé et du pelage suit l'AVANT du personnage (pas la course : en
  // diagonale l'orteil glissait), la géométrie est celle du pied ouvert dans le plan (haut, avant) (`pied` : { L, a0 } par côté)
  // …et partout où l'avance est un PIVOT (course mesurée, griffé) : le talon qui se lève fait avancer la cheville vers l'ORTEIL, quelle que soit
  // la course — à reculons et en chassés elle partait dans le sens du déplacement, et l'appui glissait (0,5-0,9 m/s au contrat, griffé)
  const ax = ((P_.wRun ?? 0) > 0 || p.griffe) && pied ? pied.ax ?? [0, 0, -1] : dir;
  const roll = p.roll * Math.min(1, len(D) / 0.3);                     // pas de déroulé sur place
  const land = [c[0] + D[0] * (0.5 - p.bias), 0, c[2] + D[2] * (0.5 - p.bias)];               // c0
  // (griffé) LE PIVOT EXACT SUR L'ORTEIL : au repos la cheville est AU-DESSUS de l'orteil (α0 = footA0 : 31° shanon, 35° les Rocketbox) ;
  // talon levé de θ, elle tourne autour de lui — Δx = L·(cos α0 − cos(α0+θ)), Δy = L·(sin(α0+θ) − sin α0). La version à pied plat (α0 = 0 :
  // L·(1 − cos θ), L·sin θ) tenait à 22° de décollage (1-3 cm d'erreur) et laissait glisser l'orteil de 6 cm à 58°.
  // (2026-09-24) en course, la géométrie EXACTE du pivot : l'os tourne dans le plan (haut, avant) — longueur et angle cheville → métatarses dans ce
  // plan (le pied ouvert du rig : 1,5 % de moins que la longueur 3D) ; l'orteil dérivait de ~0,5 mm par image
  const run0 = ((P_.wRun ?? 0) > 0 || p.griffe) && pied, Lp = run0 ? pied.L : Lfoot;
  const a0 = (run0 ? pied.a0 : p.footA0 ?? 0) * D2R, pivX = (th) => Lp * (Math.cos(a0) - Math.cos(a0 + th * D2R));
  // LE PIVOT EXACT dans l'axe avant ou arrière (poids p.wRun, celui du vol articulaire — calé sur les mesures), le déroulé forfaitaire `roll`
  // d'hier en chassés (leur régime est réglé dessus ; aucune donnée ne le recale encore) — fondu continu.
  // (2026-09-24) …et le roulé sur les orteils du décollage (course) : le vol part EXACTEMENT de la fin de l'appui (avance, hauteur, inclinaison) —
  // l'appui est UNE fonction de u (appuiA), appelée aussi à u = s pour le point de décollage (avant, l'avance du décollage était recopiée à part :
  // en mélange de régimes et à reculons, où le pied quitte le sol TALON EN DERNIER, le vol partait à côté de la fin de l'appui)
  const kR = p.wRun ?? 0, Lo = ORTEIL * Lfoot;
  const sFix = p.s * (1 - p.peel);
  const kF = Math.max(1, 0.035 / Math.max(1e-3, 0.16 * p.s * p.T));   // (A7 bis) le talon se pose en ≥ 35 ms : à haute cadence la fenêtre en
  const appuiA = (u) => {
    // APPUI : la cheville recule sous le corps à −v (fixe au monde), puis avance de `roll` en pelant
    const rho = u < sFix ? 0 : sstep((u - sFix) / Math.max(1e-6, p.s - sFix));
    const flatten = 1 - ramp(u / p.s, 0, 0.08 * kF, 0.16 * kF);          // fraction d'appui devenait un coup de genou (39 rad/s à la pose)
    // (2026-09-24) en course le talon monte ENCORE LE PLUS VITE au décollage (le pied des coureurs tourne à plein à l'instant où il quitte
    // le sol, puis continue en vol — Dorn 2012) : le pic de la rampe au décollage (même vitesse de pointe). À 55 % du pelage, la rampe
    // CALAIT à la fin de l'appui : la cheville cessait de monter, le corps avançait, le genou claquait de 50 à 17° en 5 ms (66-91 rad/s)
    const peel = u < sFix ? 0 : ramp(u, sFix, sFix + (p.s - sFix) * (0.55 + 0.45 * kR), p.s);
    const pitchOld = p.pitchHS * flatten - p.pitchTO * peel;
    let pitch = p.pitchHS < 0 ? Math.min(pitchOld, p.pitchHS * flatten) : pitchOld;   // avant-pied : le talon ne descend pas
    // (griffé) LE DÉROULÉ PIVOTE SUR L'ORTEIL : la cheville avance de L·(1 − cos θ) — la géométrie du pivot, θ le talon levé —
    // au lieu du `roll` forfaitaire (0,1-0,2 m) qui faisait GLISSER l'orteil de 5 à 14 cm par pelage (mesuré au modèle FK)
    const advOld = kR * pivX(Math.max(0, -pitch)) + (1 - kR) * (p.griffe ? pivX(Math.max(0, -pitch)) : roll * rho);
    let adv = advOld, x = u / p.s, toe = p.toeUp * peel, phase = u < sFix ? 'stance' : 'peel', roule = 0;
    // (2026-09-24) L'APPUI MESURÉ (poids kR) : l'inclinaison du pied suit les coureurs et les marcheurs (piedAppuiRef — pointe relevée de 13-15° à
    // la pose chez les coureurs RBDS, à plat chez le sprinter, talon qui se lève dès 10 % de l'appui puis jusqu'à −40 / −74° au décollage ; À
    // RECULONS le pied se pose sur la POINTE, −22 à −31° en marche, et quitte le sol TALON EN DERNIER, +13 à +19°), les deux bouts recalés sur
    // pitchHS / pitchTO (le frein, la boiterie y restent). Le POINT D'APPUI est géométrique : pointe relevée, le pied pivote sur le TALON
    // (derrière la cheville de 0,57, dessous de 0,49 longueur cheville → MT1 — les coureurs debout) ; talon levé, sur les MÉTATARSES (pivX) ;
    // à plat, la cheville est fixe. L'avance propre de la cheville en découle (0,15-0,19 L mesurés).
    if (kR > 0) {
      const lp = p.lowP ?? 1, R_ = p.recul, pd = piedAppuiRef(p.v, x, R_) * lp + (p.pitchHS - piedAppuiRef(p.v, 0, R_) * lp) * (1 - sstep(x / 0.3)) + (-p.pitchTO - piedAppuiRef(p.v, 1, R_) * lp) * sstep((x - 0.5) / 0.5);
      pitch += (pd - pitch) * kR;
      // …et LE ROULÉ SUR LES ORTEILS : la tête des métatarses se soulève (metatarseRef — nulle chez les coureurs RBDS au décollage, +0,034 à
      // +0,039 L chez le sprinter, mesurée aux plateformes ; nulle à reculons), les orteils restent posés (longueur 0,45 × cheville → métatarses,
      // la proportion d'un pied humain) : le pied monte et avance d'autant, l'articulation des orteils se plie (le pied pointé moins leur inclinaison).
      const t = pitch * D2R, lev = pitch < 0 ? p.legL * metatarseRef(p.v, x, R_) * sstep((x - 0.4) / 0.2) : 0,   /* talon levé, seconde moitié de l'appui seulement : à l'image de la pose le métatarse mesuré est encore en l'air (le pied finit d'atterrir) */ phi = Math.asin(clamp(lev / Lo, 0, 0.95));
      const advN = (pitch > 0 ? p.talonB * Math.cos(t) - p.talonH * Math.sin(t) - p.talonB : pivX(-pitch)) + Lo * (1 - Math.cos(phi));
      adv = pitch > 0 ? advN : advOld + (advN - advOld) * kR; roule = lev * kR;   // pointe relevée : le talon roule EN ENTIER (mélangé à la marche, il glissait)
      if (kR >= 0.5) { phase = pitch < -1 ? 'peel' : 'stance'; toe = clamp(-pitch - phi / D2R, 0, 70) * kR + p.toeUp * clamp(-pitch / Math.max(1, p.pitchTO), 0, 1) * (1 - kR); }
    }
    return { pitch, adv, toe, phase, roule };
  };
  // la hauteur de la cheville posée : pivot sur l'orteil quand la pointe est basse (talon levé), sur le talon quand elle est haute, et le roulé
  const hauteur = (pitch, roule, talon) => {
    const th = Math.max(0, -pitch) * D2R, hx = Lp * (Math.sin(a0 + th) - Math.sin(a0));
    let h = kR * hx + (1 - kR) * (p.griffe ? hx : Lfoot * Math.sin(th));
    if (pitch > 0 && kR > 0) { const t = pitch * D2R; h += talon * (p.talonB * Math.sin(t) + p.talonH * Math.cos(t) - p.talonH); }   // (2026-09-24) pointe relevée : le pivot sur le talon soulève la cheville
    return h + roule;                                                    // …et le roulé sur les orteils
  };
  const fin = appuiA(p.s), debut = appuiA(0);
  const lift = [c[0] - D[0] * (0.5 + p.bias) + ax[0] * fin.adv, 0, c[2] - D[2] * (0.5 + p.bias) + ax[2] * fin.adv]; // c1
  let pos, pitch, phase, toe = 0, carry = null, own = null, y;
  if (u < p.s) {
    const a = appuiA(u), k = (u / p.s) * (1 - (p.slip || 0));        // `slip` : le sabotage nommé de l'appui qui glisse
    ({ pitch, phase, toe } = a);
    pos = [land[0] - D[0] * k + ax[0] * a.adv, 0, land[2] - D[2] * k + ax[2] * a.adv];
    own = [ax[0] * a.adv, 0, ax[2] * a.adv];                           // ce que le PIED fait au sol (le pivot) — le reste est le sol qui défile
    y = ankleY + hauteur(pitch, a.roule, 1);
  } else {
    // VOL : de c1 à c0, le transfert horizontal retardé (le talon monte d'abord), cloche de hauteur
    const w = (u - p.s) / (1 - p.s);
    const sig = 0.5 - 0.5 * Math.cos(Math.PI * Math.pow(w, p.swingK));
    pos = [lift[0] + (land[0] - lift[0]) * sig, 0, lift[2] + (land[2] - lift[2]) * sig];
    // LE GRIFFÉ (p.griffe 0..1, opts.griffe — retour utilisateur « les pieds traînent ») : la cloche en S part et arrive à
    // vitesse NULLE dans le repère du corps, donc à la vitesse du CORPS au monde — mesuré au modèle FK, la cheville décolle
    // à v (3 à 8 m/s) en raclant sous 2 cm et se pose lancée : le patin de chaque pas. Le coureur réel RÉTRACTE sa jambe
    // (vitesse sol du pied ≈ 0 au décollage et au contact). Terme griffe(w) × le recul du corps sur le vol : pente 1 aux deux
    // bouts (vitesse repère-corps −griffe·v, continue avec l'appui à griffe = 1), concentrée sur les GRIFFE_E du vol à
    // chaque bout — la forme cubique w − 3w² + 2w³ rajoutait 0,5·v au milieu du vol, le genou passait 35-41 rad/s
    // (checkClip, cap 30). 0 / absent : la foulée d'hier au bit.
    if (p.griffe) { const kg = p.griffe * griffeH(w, Math.min(GRIFFE_E, GRIFFE_T / Math.max(1e-3, (1 - p.s) * p.T))) * (1 - p.s) * p.T; carry = [-vC[0] * kg, 0, -vC[2] * kg]; pos[0] += carry[0]; pos[2] += carry[2]; }
    pitch = fin.pitch * (1 - ramp(w, 0, 0.25, 0.5)) + p.pitchHS * ramp(w, 0.5, 0.8, 1);   // depuis l'inclinaison de fin d'appui (en course avant : −pitchTO)
    const f0 = 1 - sstep(w / 0.2);                                       // la levée du métatarse et le pivot du talon du décollage s'éteignent en début de vol
    toe = (kR > 0 ? fin.toe : p.toeUp) * (1 - ramp(w, 0, 0.15, 0.3)) + (kR > 0 ? debut.toe * ramp(w, 0.7, 0.85, 1) : 0);   // (2026-09-24) depuis la flexion des orteils du décollage… et vers celle de la pose (à reculons le pied se pose sur la pointe, orteils à plat : ils s'y préparent — 67 rad/s d'un coup sans)
    phase = 'swing';
    // (griffé) LE PIED SE DÉCOLLE FRANCHEMENT : la cloche monte plus vite au départ (et redescend plus tard) — mesuré au modèle FK,
    // l'orteil restait 28-34 ms sous 1,5 cm en repartant (le rasage du début de vol) ; même pic, même point de pose.
    const bw = bump(w, 0, p.swingPeak, 1);
    y = ankleY + hauteur(pitch, fin.roule * f0, f0) + p.swingH * (p.griffe ? Math.pow(bw, GRIFFE_LEVE) : bw);
  }
  pos[1] = y;
  return { p: pos, pitch, phase, toe, carry, own };
}

/** La jambe la plus tendue que la foulée demande aux extrêmes de l'appui : genou 12° — la pose des coureurs mesurés (Fukuchi 2017 :
 *  11-13° de 2,5 à 4,5 m/s). L'affaissement s'en sert pour l'appui, le griffé en vol. (18° d'abord, par prudence : la cheville arrivait
 *  par un chemin cartésien et l'angle du genou, hypersensible près de l'extension — 2/(R·sin κ/2) —, claquait ; le vol articulaire
 *  arrive par la courbe mesurée du genou, et 18° tenaient le bassin 3 cm trop bas.) */
export const REACH_K = Math.cos(6 * D2R);
/** (2026-09-24) LE GENOU LE PLUS TENDU QUE LA FOULÉE DEMANDE, MESURÉ par allure : le marcheur pose la jambe quasi tendue (WBDS : genou 1-3° à la
 *  pose — 12° l'écrasait, le bassin descendait de 5-15 cm, marche accroupie), le coureur à 11-13° (RBDS), le sprinteur décolle à 7° (Dorn).
 *  4° jusqu'à 1,8 m/s, 12° dès 2,5, 7° à 9,47 ; → le facteur de portée (cos(κ/2)). */
export function porteeK(v, recul = false) {
  const a = Math.abs(v), k = recul ? 4 : a <= 1.8 ? 4 : a <= 2.5 ? 4 + 8 * (a - 1.8) / 0.7 : 12 - 5 * clamp((a - 7) / 2.47, 0, 1);   // à reculons la jambe se tend au DÉCOLLAGE (4° en marche, 2° en course — Scherpereel, Bates)
  return Math.cos(k / 2 * D2R);
}
/** LE GRIFFÉ NE POUSSE JAMAIS LE PIED HORS DE PORTÉE. Son déplacement (le pied qui revient vers l'arrière avant la pose pour toucher
 *  à vitesse nulle, qui traîne au décollage) s'ajoute à un chemin de vol atteignable ; au-delà de la portée (genou 18°) il est réduit
 *  juste ce qu'il faut (λ ∈ [0,1], la sphère de portée). Il s'annule aux deux bouts du vol : la continuité avec l'appui est gardée.
 *  Sans cette borne, le pied passait devant le point de pose hors de portée : IK saturée, genou 0° une image avant le contact, 89 rad/s
 *  à 4,5 m/s (sonde knee, 480 images/cycle). */
function boundCarry(fp, hip, rmax) {
  const c = fp.carry, t = fp.p;
  const bx = t[0] - c[0] - hip[0], by = t[1] - hip[1], bz = t[2] - c[2] - hip[2];
  if (Math.hypot(t[0] - hip[0], t[1] - hip[1], t[2] - hip[2]) <= rmax) return;
  const A = c[0] * c[0] + c[2] * c[2], B = c[0] * bx + c[2] * bz, C = bx * bx + by * by + bz * bz - rmax * rmax;
  const lam = C >= 0 || A < 1e-12 ? 0 : clamp((-B + Math.sqrt(Math.max(0, B * B - A * C))) / A, 0, 1);
  t[0] = hip[0] + bx + lam * c[0]; t[2] = hip[2] + bz + lam * c[2];
}

/** LE VOL ARTICULAIRE — la jambe en vol suit la CUISSE et le GENOU des coureurs mesurés (foulee-rbds : Fukuchi 2017, cuisse globale,
 *  phase de vol normalisée), pas un chemin de cheville. Le chemin cartésien faisait traîner le pied derrière, jambe presque tendue,
 *  au début du vol (cuisse −34° à 6 m/s, genou 17°), et ne pliait le genou qu'à 74-94° quand les coureurs montent le talon à
 *  93-116° : le talon qui ne monte pas, c'est « ils collent au sol ». La cheville = hanche de l'instant + FK plane (cuisse θ, jambe
 *  θ − κ, dans le plan de course) ; deux recalages lissés (smoothstep) la font partir EXACTEMENT du point de décollage et arriver
 *  EXACTEMENT au point de pose (la hanche prise à ces deux phases) — la continuité avec l'appui est gardée ; le rappel de la jambe
 *  avant la pose est dans les courbes (la cuisse culmine vers 84 % du cycle puis recule). Le latéral reste celui du chemin.
 *  (2026-09-24) Les recalages sont POLAIRES autour de la hanche : l'écart de DIRECTION (la cuisse) se fond sur tout le vol, l'écart de
 *  LONGUEUR hanche-cheville (le genou) s'éteint avant le pic de flexion des coureurs (mi-vol, W_GENOU) et celui de la pose n'apparaît
 *  qu'après. En cartésien, le décollage du frein (pied 18 cm derrière la hanche au lieu de 40 : appui court et avancé) tirait tout le
 *  début du vol 23 cm vers l'avant, SOUS la hanche — le genou se repliait de +12° au frein, +10° en virage serré, +15° les deux (132-135°
 *  à 4,5 m/s pour 116 chez les coureurs). */
/** Le pic de flexion du genou en vol, dans les courbes réalignées des coureurs (foulee-rbds) : w = 0,50 à 2,5 / 3,5 / 4,5 m/s. */
const W_GENOU = 0.5;
/** À la pose, le pied des coureurs avance encore au sol à ~0,43·v (talon, médiane — RBDS, foulee-sondes/pied-vitesse.py) : le rappel de
 *  la jambe l'a freiné, sans l'arrêter. Le vol articulaire la tient là par un terme d'Hermite (nul en position aux deux bouts, nul en
 *  pente au décollage) ; sans lui la cheville arrivait à ~0,62·v et s'arrêtait net au contact (le genou claquait au sprint). */
export const POSE_VSOL = 0.43;
/** La longueur des orteils (articulation → bout), en longueurs cheville → métatarses : 0,45 — la proportion d'un pied humain (orteils ~27 % du
 *  pied, cheville → métatarses ~60 %) ; le rig n'a pas d'os au bout des orteils. Le roulé du décollage (la tête des métatarses levée). */
export const ORTEIL = 0.45;
/** La jambe (angle GLOBAL, degrés, + = cheville devant le genou) que prend une jambe à deux segments dont la cheville est à d = [y, z] de la
 *  hanche (repère personnage, avant = −Z), genou fléchi vers l'avant. */
function jambeSag(d, L) {
  const a = L.thigh, b = L.shank, r = clamp(Math.hypot(d[0], d[1]), Math.abs(a - b) + 1e-6, a + b - 1e-6);
  const phi = Math.atan2(-d[1], -d[0]), kap = Math.PI - Math.acos(clamp((a * a + b * b - r * r) / (2 * a * b), -1, 1));
  const beta = Math.acos(clamp((a * a + r * r - b * b) / (2 * a * r), -1, 1));
  return (phi + beta - kap) / D2R;
}
function volArticulaire(fp, w, wJ, v, L, hipNow, hipTO, hipTD, lift, land, kGenou = 1, Tsw = 0, pitchTO = null, pitchTD = null, rK = REACH_K, pied = null, recul = false) {
  // (§ 8) kGenou (la boiterie) replie moins le genou pendant le RETOUR du talon (w < 0,3), puis rend la main (w 0,3 → 0,7) : le vol plus bas
  // au sommet, le pied qui dégage encore la pelouse en fin de vol (un genou replié moins tout du long la rasait sous les 4 cm)
  const kAt = (x) => 1 - (1 - kGenou) * (1 - sstep((x - 0.3) / 0.4));
  const fk = (r, x) => { const a = r.cuisse * D2R, b = (r.cuisse - r.genou * kAt(x)) * D2R; return [-L.thigh * Math.cos(a) - L.shank * Math.cos(b), -L.thigh * Math.sin(a) - L.shank * Math.sin(b)]; };   // [y, z] depuis la hanche (avant = −Z)
  // [longueur, direction] depuis la hanche (direction 0 = à la verticale, + = en arrière)
  const pol = (q) => [Math.hypot(q[0], q[1]), Math.atan2(q[1], -q[0])];
  const [r0, a0] = pol(fk(volRef(v, 0, recul), 0)), [r1, a1] = pol(fk(volRef(v, 1, recul), 1));
  const [rL, aL] = pol([lift[1] - hipTO[1], lift[2] - hipTO[2]]), [rP, aP] = pol([land[1] - hipTD[1], land[2] - hipTD[2]]);
  const path = (x) => {                                                  // le chemin recalé [y, z] depuis la hanche
    const [rw, aw] = pol(fk(volRef(v, x, recul), x)), h = sstep(x);
    const r = rw + (rL - r0) * (1 - sstep(x / W_GENOU)) + (rP - r1) * sstep((x - W_GENOU) / (1 - W_GENOU));
    const a = aw + (aL - a0) * (1 - h) + (aP - a1) * h;
    return [-r * Math.cos(a), r * Math.sin(a)];
  };
  const pw = path(w);
  let y = hipNow[1] + pw[0], z = hipNow[2] + pw[1];
  if (Tsw > 0) {                                                        // la vitesse d'arrivée : dz/dw(1) = (1 − POSE_VSOL)·v·Tvol (repère corps, +Z = arrière)
    // (2026-09-24) À RECULONS la cheville se pose en RECULANT plus vite que le corps (1,2-1,3·v au sol, le talon qui descend autour des orteils —
    // Scherpereel 2023) : dans le repère du corps elle recule encore de (k − 1)·v
    const e = 0.02, dzRef = (path(1)[1] - path(1 - e)[1]) / e, want = (recul ? vsolRecul(v) - 1 : 1 - POSE_VSOL) * v * Tsw;
    // la base d'Hermite vit dans la SECONDE moitié du vol (nulle en position et en pente à mi-vol, pente 1 à la pose) : sur tout le vol elle
    // avançait la cheville jusqu'au pic du genou, +6-7° de flexion en ligne droite (122° à 4,5 m/s pour 116 chez les coureurs)
    const u = Math.max(0, (w - W_GENOU) / (1 - W_GENOU)), t = (want - dzRef) * u * u * (u - 1) * (1 - W_GENOU);
    // …borné par la portée (genou 12°, REACH_K) : au sprint le rappel faisait passer le pied devant, jambe tendue à 0° (85 rad/s au genou)
    const rmax = rK * (L.thigh + L.shank), dx = fp.p[0] - hipNow[0], dy = y - hipNow[1], dz = z - hipNow[2], room = rmax * rmax - dx * dx - dy * dy;
    let lam = 1;
    if (room <= 0) lam = 0;
    else if (Math.abs(dz + t) > Math.sqrt(room)) lam = clamp((Math.sign(dz + t) * Math.sqrt(room) - dz) / (t || 1e-9), 0, 1);
    z += t * lam;
  }
  // …et la jambe ne se replie jamais au-delà de 150° — le sprint MESURÉ : 148,4 ± 5,6° en vol chez 79 sprinteurs à 9,9 m/s (Miyashiro,
  // Nagahara et al. 2019), 146-148° chez le sprinter de Dorn à 7 et 9,5 m/s (la borne était 135°, « Mann & Hagy 1980 », en dessous du sprint réel)
  const dMin = Math.sqrt(L.thigh * L.thigh + L.shank * L.shank + 2 * L.thigh * L.shank * Math.cos(150 * D2R));
  const dy = y - hipNow[1], dz = z - hipNow[2], dx = fp.p[0] - hipNow[0], dd = Math.hypot(dx, dy, dz);
  if (dd < dMin && dd > 1e-6) { const k = dMin / dd; y = hipNow[1] + dy * k; z = hipNow[2] + dz * k; }
  // …et la cible finale reste à portée (genou ≥ 12°) : en virage serré, roulis et hanche intérieure basse l'en sortaient une ou deux images
  { const rmax = rK * (L.thigh + L.shank), dx = fp.p[0] - hipNow[0], dy = y - hipNow[1], dz = z - hipNow[2], dd = Math.hypot(dx, dy, dz);
    if (dd > rmax) { const k = rmax / dd; y = hipNow[1] + dy * k; z = hipNow[2] + dz * k; } }
  // (2026-09-24) LE PIED ARTICULAIRE : en vol le pied SUIT la jambe — inclinaison = angle de la jambe + la cheville du sprinter mesuré
  // (chevilleRef), raccordée EXACTEMENT au pied du décollage et à celui de la pose. Tenu à plat au monde (le vol d'hier), il restait
  // horizontal quand le talon monte à la fesse (jambe à −147°) : la cheville pliée à l'extrême, le pied à 52 rad/s (sprinter : 27-30).
  if (pitchTO != null && pitchTD != null) {
    const S = jambeSag([y - hipNow[1], z - hipNow[2]], L), S0 = jambeSag([lift[1] - hipTO[1], lift[2] - hipTO[2]], L), S1 = jambeSag([land[1] - hipTD[1], land[2] - hipTD[2]], L);
    const h = sstep(w), pitch = S + chevilleRef(v, w, recul) + (pitchTO - S0 - chevilleRef(v, 0, recul)) * (1 - h) + (pitchTD - S1 - chevilleRef(v, 1, recul)) * h;
    fp.pitch += (pitch - fp.pitch) * wJ;
  }
  fp.p[1] += (y - fp.p[1]) * wJ; fp.p[2] += (z - fp.p[2]) * wJ;
  // (2026-09-24) LA GARDE DE L'ORTEIL EST CONTRÔLÉE : chez l'humain c'est la variable la mieux régulée de la marche. Au milieu du vol la tête des
  // métatarses passe à 0,7 cm au-dessus de sa hauteur debout (médiane WBDS, 24 marcheurs) ; le pied du rig, plus long que celui d'un humain
  // (0,22 L contre ~0,17), la faisait passer SOUS le sol à l'angle de cheville mesuré — il se relève juste assez (w 0,15 → 0,85).
  if (pied && wJ > 0) {
    const wg = sstep((w - 0.15) / 0.1) * (1 - sstep((w - 0.75) / 0.1));
    const a0 = pied.a0 * D2R, garde = plancherOrteil(v) + 0.003, orteil = fp.p[1] - pied.L * Math.sin(a0 - fp.pitch * D2R);   // la hauteur RÉELLE de l'orteil (au sprint le pied pointe en arrière, −150° : il est haut)
    if (wg > 0 && orteil < pied.orteil0 + garde) { const thMin = (a0 - Math.asin(clamp((fp.p[1] - pied.orteil0 - garde) / pied.L, -1, 1))) / D2R;
      if (fp.pitch < thMin) fp.pitch += (thMin - fp.pitch) * wg * wJ; }
  }
}
/** LE PLANCHER MESURÉ de la tête des métatarses au milieu du vol (w ∈ [0,3 ; 0,7]), au-dessus de sa hauteur debout : le quart bas des marcheurs
 *  (WBDS, 24 jeunes adultes : 0,3-0,4 cm — médiane 0,7) et des coureurs (RBDS : 1,7 / 4,9 / 6,3 cm à 2,5 / 3,5 / 4,5 m/s) ; foulee-sondes :
 *  garde-orteil.py. Le contrat le tient (checkGaitGen), la garde contrôlée du vol vise 3 mm au-dessus. */
const PLANCHER_ORTEIL = [[0.586, 0.003], [1.778, 0.004], [2.5, 0.017], [3.5, 0.049], [4.5, 0.063]];
export function plancherOrteil(v) {
  const a = Math.abs(v), T = PLANCHER_ORTEIL; if (a <= T[0][0]) return T[0][1];
  for (let k = 1; k < T.length; k++) if (a <= T[k][0]) return T[k - 1][1] + (T[k][1] - T[k - 1][1]) * (a - T[k - 1][0]) / (T[k][0] - T[k - 1][0]);
  return T[T.length - 1][1];
}

/**
 * LA POSE DE FOULÉE — fonction pure de (φ, vF, vR). Renvoie { q: { os: q_spec }, hips: [droite, haut,
 * avant], J: { os: R }, meta }. `opts.armSwingF` : l'accent de la persona ; `opts.override` : un
 * sabotage ou un réglage nommé (bancs).
 */
export function gaitPose(P, phi, vF, vR, style = NEUTRAL_GAIT_STYLE, opts = {}) {
  const p = gaitParams(vF, vR, style, opts.override || null, opts.legK ?? gaitLegK(P));   // (A7 bis) la cadence à l'échelle de la jambe du rig (le contrôleur avance l'horloge du même facteur)
  // (2026-09-24) L'APPUI MESURÉ (course, poids wRun) : le pied se pose et décolle à l'inclinaison des coureurs (piedAppuiRef) ; le talon du rig
  // (hauteur de sa cheville, et 0,57 / 0,49 de celle-ci derrière — les coureurs debout) ; l'affaissement du RÉGIME (le bassin de course est
  // mesuré, plus bas) — ce que le jockey et le frein y ajoutent reste.
  { const kR = p.wRun ?? 0, ov = opts.override || {};
    p.lowP = clamp(p.v / 0.586, 0, 1);                                   // à l'arrêt le pied s'aplatit (sous la marche la plus lente mesurée)
    if (kR > 0 && ov.pitchHS == null) p.pitchHS += (piedAppuiRef(p.v, 0, p.recul) * p.lowP - p.pitchHS) * kR;
    if (kR > 0 && ov.pitchTO == null) p.pitchTO += (-piedAppuiRef(p.v, 1, p.recul) * style.toeOff * p.lowP - p.pitchTO) * kR;   // la signature du joueur (toeOff) sur la mesure
    p.talonH = P.bones.LeftFoot.bindP[1] - P.lengths.groundY; p.talonB = p.talonH * APPUI_REF.talon.roule; p.drop0 = p.drop; p.legL = P.lengths.thigh + P.lengths.shank; }
  // (A12b) LA RÉCEPTION EN MOUVEMENT : le receveur qui va au-devant du ballon (la sim ne le laisse jamais attendre
  // sur place — 0 % des images de vol sous 0,6 m/s, sonde A12b) garde les bras CALMES : un peu plus ouverts, coudes un peu plus
  // fermés, balancier réduit — l'amplitude vient du PORT DE BRAS de la persona (bras 0..1), pas d'un écart uniforme. `opts.receveur` (true ou { elev, elbow, swing }) — posé par le contrôleur quand la scène
  // dit que le ballon vole vers lui ; absent : la foulée d'hier, au bit.
  if (opts.receveur) { const rc = opts.receveur === true ? {} : opts.receveur; p.armElev += rc.elev ?? 4; p.elbow += rc.elbow ?? 8; }   // (retour utilisateur) calmes par défaut : +4° / +8°, le port de bras de la persona ouvre ou ferme
  // (A12d) LE RECUL-FREIN : le défenseur qui jockeye le porteur (la sim le fait reculer et chasser en lui faisant face,
  // A10 cfg.contact.jockey) est BAS et ouvert — bassin plus bas, buste penché, pieds plus larges, bras ouverts, balancier
  // réduit (Van Dijk : « recule au tempo de l'attaquant, hanches de trois-quarts, sans se jeter »). `opts.jockey` ; absent : hier au bit.
  if (opts.jockey) { const jk = opts.jockey === true ? {} : opts.jockey; p.drop += jk.drop ?? 0.05; p.lean += jk.lean ?? 10; p.hw += jk.hw ?? 0.04; p.armElev += jk.elev ?? 14; p.elbow += jk.elbow ?? 20; }
  // (A7 bis) LE FREINAGE (`opts.brake` 0..1 — le contrôleur : décélération mesurée / 6 m/s²) : le buste se retient en ARRIÈRE, le pied
  // se pose plus LOIN devant le bassin (bias négatif : l'appui de frein), talon d'abord, la base s'élargit, le bassin descend, les bras
  // viennent devant et s'ouvrent. LE VIRAGE (`opts.turn`, accélération latérale mesurée en m/s², + = vers la droite du corps) : le bassin
  // et le tronc ROULENT dans le virage (atan(a/g) × 0,55 : 13° à 4,5 m/s², 17° à 6, 18° au plus), le bassin glisse vers l'intérieur, le pied extérieur se pose
  // plus large, la tête reste d'aplomb (contre-roulis). Absents : la foulée d'hier au bit.
  const br = clamp(opts.brake ?? 0, 0, 1), aT = clamp(opts.turn ?? 0, -9, 9);
  // LE GRIFFÉ (footPath) — absent : hier au bit. Plein jusqu'à 6 m/s, ramené à 0,3 dès 7 : au sprint le genou de la foulée
  // tourne déjà à la limite (checkClip, 30 rad/s — 9 m/s le dépasse sans griffé) ; mesuré, griffé plein à 8 m/s = 32 rad/s.
  if (opts.griffe) p.griffe = clamp(opts.griffe, 0, 1) * clamp(1 - (Math.hypot(vF, vR) - 6) * 0.7, 0.3, 1);
  { const fa = P.bones.LeftFoot.bindP, ta = P.bones.LeftToeBase.bindP; p.footA0 = Math.asin(clamp((fa[1] - ta[1]) / Math.max(1e-6, P.lengths.foot), -1, 1)) / D2R; }   // l'angle de repos cheville/orteil (le pivot exact)
  // (§ 8) LA BOITERIE (opts.boite { side, k } — le fauché d'une faute grave, sim p._boite) : le côté touché a l'appui plus court (s ×(1 − 0,3k)),
  // le vol plus ras (swingH ×(1 − 0,2k) — à 0,35 le trot rasait sous les 4 cm du contrat), moins de déroulé (pitchTO) ; le bassin PLONGE de ce côté quand il porte (10°·k) — la foulée
  // d'une jambe qui se ménage. Absente : la foulée d'hier au bit.
  const B = opts.boite && opts.boite.k > 0 ? { side: opts.boite.side === 'right' ? 'Right' : 'Left', k: clamp(opts.boite.k, 0, 1) } : null;
  const pS = (side) => B && side === B.side ? { ...p, s: p.s * (1 - 0.3 * B.k), swingH: p.swingH * (1 - 0.2 * B.k), pitchTO: p.pitchTO * (1 - 0.5 * B.k) } : p;
  if (br > 0) { const kv = clamp((6 / Math.max(1, Math.abs(vF))) ** 2, 0.3, 1) * (1 - 0.5 * Math.abs(aT) / 9); p.lean -= 11 * br; p.bias -= 0.16 * br * kv; p.hw += 0.04 * br * kv; p.pitchHS += 10 * br; p.drop += 0.02 * br * kv; p.T /= gaitBrakeCadence(br); p.swingH *= 1 - 0.2 * br; p.armOff += 12 * br; p.armElev += 8 * br; p.elbow += 6 * br; }   // kv : au sprint et en plein virage la jambe sature, l'appui de frein se raccourcit
  if (aT !== 0) p.T /= gaitTurnCadence(aT);
  if (opts.pivotHz > 1 / p.T) p.T = 1 / opts.pivotHz;                   // le pivot : la cadence minimale du corps qui tourne sur place (gaitPivotCadence)
  const rollIn = clamp(Math.atan(aT / 9.81) / D2R * 0.55, -18, 18), inG = aT / 9.81, hipX = 0.07 * inG, hipRise = (P.lengths.hipWidth / 2) * Math.sin(rollIn * D2R);
  if (aT !== 0) p.swingH *= 1 - 0.15 * Math.min(1, Math.abs(aT) / 9);   // la jambe intérieure, hanche plus basse, passe plus ras (le genou reste sous 140°) ; les pas de frein rasent aussi
  const L = P.lengths, R = L.thigh + L.shank;
  const hipY = P.bones.LeftUpLeg.bindP[1], ankleY = P.bones.LeftFoot.bindP[1];
  const vC = [vR, 0, -vF];                                            // repère personnage : avant = −Z
  const ph = ((phi % 1) + 1) % 1;
  const uL = ph, uR = (ph + 0.5) % 1;
  const armF = (opts.armSwingF ?? 1) * (opts.receveur ? ((opts.receveur === true ? {} : opts.receveur).swing ?? 0.7) : 1) * (opts.jockey ? ((opts.jockey === true ? {} : opts.jockey).swing ?? 0.5) : 1);

  // ---- le bassin : rebond (2/cycle), affaissement, roulis vers le pied d'appui, lacet, tangage
  // (2026-09-24) LE BASSIN MESURÉ en course (poids wRun) : la hauteur de la hanche des coureurs sur le demi-cycle (hancheRef — RBDS : à hauteur
  // debout à la pose et au décollage, −0,08 à −0,09 L à mi-appui ; le sprinter : −0,07 → −0,10 L, plus bas à mesure qu'il va vite), recalée sur
  // l'appui du générateur (facteur mesuré → p.s). Hier : un affaissement unique pour tout le cycle (le pire instant de l'appui), plus un rebond
  // symétrique — 3-4 cm trop bas au trot, 5-7 au sprint. La portée ne fait plus que RABAISSER si un pied en sort (la boucle ci-dessous).
  // Le recalage temporel sur le demi-cycle : pose (0) → décollage (course : s ; marche : décollage de l'AUTRE pied, s − 0,5) → pose suivante (0,5) ;
  // à l'arrêt la hauteur mesurée s'éteint vers la station debout (comme le rebond d'hier, v / 0,59).
  const kRun = p.wRun ?? 0, dutyD = kRun > 0 ? dutyRef(p.v, p.recul) : 0.3, bG = p.s < 0.5 ? p.s : p.s - 0.5, bD = dutyD < 0.5 ? dutyD : dutyD - 0.5, memeAllure = (p.s < 0.5) === (dutyD < 0.5);
  const lowH = clamp(p.v / 0.586, 0, 1);
  const bobAt = (x) => {
    const old = p.bobA * p.bobSign * Math.cos(TAU * 2 * (x - p.s / 2));
    if (kRun <= 0) return old;
    const t = ((x % 0.5) + 0.5) % 0.5, td = !memeAllure ? t : t < bG ? (t / Math.max(1e-6, bG)) * bD : bD + ((t - bG) / Math.max(1e-6, 0.5 - bG)) * (0.5 - bD);
    return old + ((L.thigh + L.shank) * hancheRef(p.v, td, p.recul) * lowH - old) * kRun;
  };
  let bob = bobAt(ph);
  // le bassin doit ATTEINDRE le pied aux extrêmes (pose et décollage) — l'affaissement nécessaire
  // se calcule, il ne se devine pas (la portée saturée est le patin silencieux des jambes IK)
  // genou ≥ 12° aux extrêmes de l'appui (la pose mesurée) — au sprint le décollage se TEND (le sprinter de Dorn aux plateformes : 18 / 17 /
  // 13 / 7° à 3,5 / 5,2 / 7,0 / 9,5 m/s) : 12° jusqu'à 7 m/s, 7° à 9,5 (2026-09-24)
  const reach = ((p.wRun ?? 0) > 0 ? porteeK(Math.hypot(vF, vR), p.recul) : REACH_K) * R;   // (2026-09-24) mesurée par allure (porteeK) ; hors de l'allure avant, la marge d'hier
  const cL = [-p.hw + 0.05 * inG - 0.04 * Math.max(0, inG), 0, 0], cR = [p.hw + 0.05 * inG + 0.04 * Math.max(0, -inG), 0, 0];   // (A7 bis) les pieds glissent vers l'intérieur du virage, l'extérieur s'élargit
  // (A7 ter) LE PAS CROISÉ du virage serré (|aT| > 7 m/s², vF > 3) : la jambe EXTÉRIEURE croise devant l'intérieure — son couloir passe
  // la ligne médiane et se pose à `cross` m À L'INTÉRIEUR du couloir de l'intérieure (qui s'écarte de `wide` vers l'intérieur), le bassin
  // TOURNE dans le virage (pYawTurn : la hanche extérieure vient devant). Borné (kX 0 → 1 de 7 à 9 m/s², fondu 3 → 4 m/s) ; chassés :
  // jamais (le contrat) ; sans virage : la foulée d'hier au bit.
  const kX = clamp((Math.abs(aT) - 7) / 2, 0, 1) * clamp(vF - 3, 0, 1) * clamp((9.5 - vF) / 3, 0.4, 1), sX = Math.sign(aT);   // …atténué au sprint (la foulée longue sature la hanche)
  if (kX > 0) { const wide = 0.05 * kX; if (sX > 0) { cR[0] += wide; cL[0] = cR[0] + 0.03 * kX; } else { cL[0] -= wide; cR[0] = cL[0] - 0.03 * kX; } }
  const pYawTurn = -6 * kX * sX;
  if (kX > 0) p.swingH *= 1 - 0.12 * kX;                                 // (A7 ter) le vol rase un peu plus dans le pas croisé (le genou reste sous 140°)
  const listAt = (x) => -p.pList * Math.cos(TAU * (x - p.s / 2)) + (B ? (B.side === 'Left' ? 1 : -1) * 12 * B.k * (0.5 + 0.5 * Math.cos(TAU * (x - (B.side === 'Left' ? 0 : 0.5) - p.s / 4))) : 0);   // (2026-09-24) 12° (hier 10) : sur l'appui réel, plus court, le plongeon se perdait dans le roulis normal   // côté en vol qui tombe ; (§ 8) le bassin plonge du côté qui boite quand il porte
  // (2026-09-24) la hanche EXACTE (le bassin tourné : antéversion, roulis, lacet) pour la portée de la course — la hanche de repos (bind − hipX)
  // ignorait 1-2 cm de lacet et de roulis : sans la marge du maximum global d'hier, la jambe saturait au pelage des virages serrés
  const hipsB = P.bones.Hips.bindP, hipRel = (x, side) => applyQuat(sub(P.bones[`${side}UpLeg`].bindP, hipsB), chain(rx(-p.pTilt), rz(listAt(x) - rollIn), ry(-p.pYaw * Math.cos(TAU * x) + pYawTurn)));
  const needAt = (x, side, fp, marge) => { const r = hipRel(x, side), horiz = Math.hypot(fp.p[0] - hipsB[0] - hipX - r[0], fp.p[2] - hipsB[2] - r[2]); return hipsB[1] + r[1] + bobAt(x) - fp.p[1] - Math.sqrt(Math.max(0, reach * reach - horiz * horiz)) + marge; };
  const axeDe = (side) => { const r = applyQuat(sub(P.bones[`${side}ToeBase`].bindP, P.bones[`${side}Foot`].bindP), ry((side === 'Left' ? 1 : -1) * p.turnout));   // le pied ouvert (J.Foot avant l'inclinaison)
    return { L: Math.hypot(r[1], r[2]), a0: Math.atan2(-r[1], Math.abs(r[2])) / D2R, ax: applyQuat([0, 0, -1], ry(opts.plantYaw?.[side] ?? 0)) }; };   // ax : l'avant du pied PLANTÉ (son lacet figé)
  let drop = p.drop - kRun * p.drop0;                                   // (2026-09-24) en course, l'affaissement du régime s'efface devant le bassin mesuré
  // (2026-09-24) …et la portée y RABAISSE LOCALEMENT : chaque instant d'appui qui sortirait de portée note son besoin (demi-cycle t) ; une
  // enveloppe lisse (cosinus, ±0,08 cycle) l'applique autour de lui seulement. Global, le pire instant (la pose ou le décollage, jambe presque
  // tendue chez les coureurs — genou 11-19°) abaissait tout le cycle de 2-3 cm, et le genou se posait plié à 36-45° (coureurs : 11-13°).
  const dropBase = drop, besoins = [], note = (u, need) => { if (kRun > 0 && need > dropBase) besoins.push([((u % 0.5) + 0.5) % 0.5, need - dropBase]); };
  // (2026-09-24) L'APPUI SEULEMENT, pelage compris : c'est là qu'un pied hors de portée GLISSE. En vol le chemin de base est atteignable
  // et le griffé est borné par la portée (boundCarry, plus bas) — la marge d'hier (u ≤ s + 0,06) mettait le début du vol dans le calcul,
  // et avec les foulées de Dorn le pied qui traîne derrière faisait tomber le bassin de 10-20 cm pour une jambe qui ne touche plus le sol.
  for (let i = 0; i <= 16; i++) {
    const u = (i / 16) * p.s;
    const bobU = bobAt(u);
    for (const [c, side] of [[cL, 'Left'], [cR, 'Right']]) {
      const fp = footPath(u, pS(side), c, vC, ankleY, L.foot, axeDe(side));
      const dx = fp.p[0] - P.bones[`${side}UpLeg`].bindP[0] - hipX, dz = fp.p[2] - P.bones[`${side}UpLeg`].bindP[2];   // (A7 bis) la hanche de l'instant : glissée…
      const horiz = Math.hypot(dx, dz);
      const maxDown = Math.sqrt(Math.max(0, reach * reach - horiz * horiz));
      const need = hipY + (side === 'Left' ? hipRise : -hipRise) + bobU - fp.p[1] - maxDown + 0.005, x = side === 'Left' ? u : u + 0.5; if (kRun > 0) note(x, needAt(x, side, fp, 0.005)); else drop = Math.max(drop, need);   // …et montée du côté extérieur du virage
    }
  }
  // (griffé) …ET LE POINT LE PLUS AVANCÉ DU VOL : le pied passe devant son point de pose avant d'y revenir (vitesse sol nulle au contact) ;
  // la jambe doit l'atteindre GENOU À 18°, sinon le retour est coupé par la portée (boundCarry) et le pied arrive lancé, piloté à l'arrêt
  // à l'image du contact (sonde griffe-speeds : 4,7 m/s six millisecondes avant la pose à 4,5 m/s). La fin du vol, à pas fin.
  if (p.griffe && kRun < 0.5) for (let i = 0; i <= 12; i++) {            // (2026-09-24) en course le vol est articulaire et borné par la portée : plus de contrainte ici
    const w = 1 - (i / 12) * 1.6 * Math.min(GRIFFE_E, GRIFFE_T / Math.max(1e-3, (1 - p.s) * p.T)), u = p.s + w * (1 - p.s);
    const bobU = bobAt(u);
    for (const [c, side] of [[cL, 'Left'], [cR, 'Right']]) {
      const fp = footPath(u, pS(side), c, vC, ankleY, L.foot, axeDe(side));
      const horiz = Math.hypot(fp.p[0] - P.bones[`${side}UpLeg`].bindP[0] - hipX, fp.p[2] - P.bones[`${side}UpLeg`].bindP[2]);
      const need = hipY + (side === 'Left' ? hipRise : -hipRise) + bobU - fp.p[1] - Math.sqrt(Math.max(0, reach * reach - horiz * horiz)) + 0.005, x = side === 'Left' ? u : u + 0.5; if (kRun > 0) note(x, needAt(x, side, fp, 0.005)); else drop = Math.max(drop, need);
    }
  }
  if (br > 0 || aT !== 0 || B) for (let i = 0; i <= 32; i++) {             // (A7 bis) sous frein ou virage, l'APPUI entier à pas fin (le vol :
    const u = (i / 32) * p.s, bobU = bobAt(u);   // le griffé borné), marge 1,2 cm
    for (const [c, side] of [[cL, 'Left'], [cR, 'Right']]) {
      const fp = footPath(u, pS(side), c, vC, ankleY, L.foot, axeDe(side));
      const horiz = Math.hypot(fp.p[0] - P.bones[`${side}UpLeg`].bindP[0] - hipX, fp.p[2] - P.bones[`${side}UpLeg`].bindP[2]);
      const need = hipY + (side === 'Left' ? hipRise : -hipRise) + bobU - fp.p[1] - Math.sqrt(Math.max(0, reach * reach - horiz * horiz)) + 0.012, x = side === 'Left' ? u : u + 0.5; if (kRun > 0) note(x, needAt(x, side, fp, 0.012)); else drop = Math.max(drop, need);
    }
  }
  const rabais = (x) => { const t = ((x % 0.5) + 0.5) % 0.5; let e = 0; for (const [tb, n] of besoins) { let d = Math.abs(t - tb); d = Math.max(0, Math.min(d, 0.5 - d) - 0.03) / 0.08; if (d < 1) e = Math.max(e, n * (0.5 + 0.5 * Math.cos(Math.PI * d))); } return e; };   // plateau ±0,03 (la jambe qui vient se poser est déjà tendue), puis cosinus
  const hips = [hipX, -drop + bob - rabais(ph), 0];                    // (A7 bis) le bassin glisse vers l'intérieur du virage
  const pYaw = -p.pYaw * Math.cos(TAU * ph) + pYawTurn;               // hanche gauche devant à φ = 0 ; (A7 ter) + le bassin tourné dans le virage serré
  const pList = listAt(ph);
  const RHips = chain(rx(-p.pTilt), rz(pList - rollIn), ry(pYaw));   // (A7 bis) rz(−) : le côté droit descend — le roulis dans le virage à droite
  // la hanche (articulation) à une autre phase du cycle — les deux bouts du vol articulaire
  const hipJointAt = (x, side) => {
    const RH = chain(rx(-p.pTilt), rz(listAt(x) - rollIn), ry(-p.pYaw * Math.cos(TAU * x) + pYawTurn));
    return fkPose(P, { Hips: jointToSpec(P, 'Hips', RH) }, [hipX, -drop + bobAt(x) - rabais(x), 0])[`${side}UpLeg`].p;
  };
  // (2026-09-24) LE VOL ARTICULAIRE en course avant (fondu de 1,8 à 2,5 m/s, pleine dès 2,5 ; la marche, la course arrière et les chassés
  // gardent le chemin cartésien) : voir volArticulaire.
  const wJ = p.wRun;
  const J = { Hips: RHips };

  // ---- le tronc : inclinaison avant, contre-rotation des épaules (déphasage Pontzer), tête stable
  const girdle = p.girdle * Math.sin(TAU * ph - Math.PI / 2 - p.psi * D2R);
  const leanQ = (k) => rx(-p.lean * k);
  J.Spine = chain(rx(0.15 * p.pTilt), leanQ(0.4), ry(girdle * 0.2 - pYawTurn / 3));   // (2026-09-24) rx(+0,15·pTilt) : la lordose compense 15 % de l'antéversion du bassin — le tronc penche de lean + 0,85·pTilt : 16,5° au sprint, le sprinter mesuré 16° (Dorn 2012, C7-sacrum à 9,5 m/s), 12° à 3,5 m/s (11°) ; plus de compensation (0,2 : 1 foulée rouge, ¼ : 1, ½ : 10, entière : 78), l'opposition bras-jambe au contact cassait sous le frein en virage (le buste qui se redresse ramène les mains l'une vers l'autre)
  J.Spine1 = chain(leanQ(0.35), ry(girdle * 0.35 - pYawTurn / 3));
  J.Spine2 = chain(leanQ(0.25), ry(girdle * 0.45 - pYawTurn / 3));
  const head = clamp(-girdle * 0.75, -6, 6);
  J.Neck = chain(rx(p.lean * 0.3 - (opts.headDown ?? 0) * 0.4), ry(head * 0.4), rz(rollIn * 0.4));   // (A11) opts.headDown : la tête basse (l'abattu) ; (A7 bis) la tête reste d'aplomb dans le virage
  J.Head = chain(rx(p.lean * 0.3 - (opts.headDown ?? 0) * 0.6), ry(head * 0.6), rz(rollIn * 0.6));

  // ---- les bras : opposés à leur jambe (gauche derrière à φ = 0), coude qui se ferme en avant
  const swing = p.armA * armF * Math.cos(TAU * ph + (p.armPhase || 0));   // `armPhase` : le sabotage des bras en phase
  const fwdL = p.armOff - swing, fwdR = p.armOff + swing;
  const elbowL = p.elbow + p.elbowMod * (0.5 - 0.5 * Math.cos(TAU * ph));
  const elbowR = p.elbow + p.elbowMod * (0.5 + 0.5 * Math.cos(TAU * ph));
  Object.assign(J, armJoints('Left', { elev: p.armElev, fwd: fwdL, elbow: elbowL }));
  Object.assign(J, armJoints('Right', { elev: p.armElev, fwd: fwdR, elbow: elbowR }));
  // (A12e) LES MAINS SUR LES HANCHES EN MARCHE : le rôle marchant loin du ballon (free_role_creator, wide_creator,
  // raumdeuter — « marche les mains sur les hanches », §3.6 C, §3.7 D) garde ses mains posées, aucun balancier ;
  // `opts.mainsHanches` (la scène : rôle à ancrage ≥ 0,8 ou repli ≥ 0,9, ballon à > 25 m, allure de marche) ; absent : hier au bit.
  if (opts.mainsHanches) { Object.assign(J, armPose('Left', { elev: 22, fwd: -8, elbow: 45, twist: -50 }), armPose('Right', { elev: 22, fwd: -8, elbow: 45, twist: -50 })); }

  // ---- les jambes : chemin de pied → IK sur la hanche de l'instant, pied à plat + tangage + ouverture
  const partial = fkPose(P, { Hips: jointToSpec(P, 'Hips', RHips) }, hips);
  const feet = {};
  for (const [side, u, c, sgn] of [['Left', uL, cL, 1], ['Right', uR, cR, -1]]) {
    const fp = footPath(u, pS(side), c, vC, ankleY, L.foot, axeDe(side));
    const hipW = partial[`${side}UpLeg`].p;
    // (2026-09-24) L'APPUI ANCRÉ : le contrôleur tient le pied posé AU MONDE (opts.plant[side], repère personnage de l'instant) — la
    // cible du générateur est calculée dans le repère du CORPS, et un corps qui pivote en appui entraînait le pied dans sa rotation
    // (sonde glisse-accel, duel : glisse p90 2,9 cm sous 2 rad/s de lacet, 29 cm au-delà). Hauteur et tangage restent ceux du générateur.
    const pl = fp.phase !== 'swing' ? opts.plant?.[side] : null;
    if (pl) { fp.p[0] = pl[0]; fp.p[2] = pl[2]; }
    if (fp.carry) boundCarry(fp, hipW, (p.wRun > 0 ? porteeK(p.v, p.recul) : REACH_K) * R);
    if (fp.phase === 'swing' && wJ > 0) volArticulaire(fp, (u - pS(side).s) / (1 - pS(side).s), wJ, p.v, L, hipW,
      hipJointAt(((side === 'Left' ? 0 : 0.5) + pS(side).s) % 1, side), hipJointAt(side === 'Left' ? 0 : 0.5, side),
      ...(() => { const a = footPath(pS(side).s, pS(side), c, vC, ankleY, L.foot, axeDe(side)), b = footPath(0, pS(side), c, vC, ankleY, L.foot, axeDe(side)); return [a.p, b.p, B && side === B.side ? 1 - 0.2 * B.k : 1, (1 - pS(side).s) * p.T, a.pitch, b.pitch, porteeK(p.v, p.recul), { ...axeDe(side), orteil0: P.bones[`${side}Foot`].bindP[1] - axeDe(side).L * Math.sin(axeDe(side).a0 * D2R) }, p.recul]; })());   // (§ 8) la jambe qui boite plie moins le genou en vol — le vol qui rase, en articulaire
    const pole = [p.pole[0] - sgn * 0.12, p.pole[1], p.pole[2]];
    const r = legIK(P, side, hipW, RHips, fp.p, pole);
    J[`${side}UpLeg`] = r.Rthigh; J[`${side}Leg`] = r.Rshank;
    const legW = quatMul(quatMul(RHips, r.Rthigh), r.Rshank);
    const flat = quatNormalize(quatConjugate(legW));
    J[`${side}Foot`] = quatMul(flat, chain(ry(sgn * p.turnout), rx(fp.pitch), ry(pl && opts.plantYaw ? opts.plantYaw[side] ?? 0 : 0)));   // (2026-09-24) le pied planté s'incline autour de SON axe (le lacet figé appliqué après) : le corps qui tourne ne le fait plus rouler, l'orteil ne dérive plus   // …et son orientation au sol (le pied planté ne vire pas avec le corps)
    J[`${side}ToeBase`] = rx(fp.toe);
    feet[side] = { ...fp, u, reachable: r.reachable, knee: r.knee, hip: hipW };
  }
  const q = {};
  for (const [bone, Rb] of Object.entries(J)) { const s = jointToSpec(P, bone, Rb); if (s) q[bone] = s; }
  return { q, hips, J, feet, meta: { s: p.s, T: p.T, drop, bob, lean: p.lean, params: p } };
}

/** Un CYCLE en spec animkit (une clé par 1/fps s sur la durée T, loop) — la planche-contact, checkClip. */
export function gaitCycleSpec(P, { vF = 4, vR = 0, style = NEUTRAL_GAIT_STYLE, fps = 60, opts = {}, name = null } = {}) {
  const T = Math.round(gaitPose(P, 0, vF, vR, style, opts).meta.T * 10000) / 10000;   // (A7 bis) la durée de la pose elle-même (jambe, frein)
  const n = Math.max(8, Math.round(T * fps));
  const keys = [];
  for (let i = 0; i <= n; i++) {
    const phi = i / n;
    const g = gaitPose(P, phi, vF, vR, style, opts);
    const pose = {};
    for (const [b, qq] of Object.entries(g.q)) pose[b] = quatToEulerXYZ(qq).map((x) => Math.round(x * 100) / 100);
    keys.push({ t: i === n ? T : Math.round((phi * T) * 10000) / 10000, pose, hips: g.hips.map((x) => Math.round(x * 1000) / 1000) });
  }
  return { name: name || `foulee-${vF.toFixed(1)}-${vR.toFixed(1)}`, duration: T, loop: true, contact: 0, keys };
}

/**
 * LE PORTRAIT D'UN CYCLE — ce que les bancs lisent : positions monde FK des chevilles, orteils, genoux,
 * hanches, mains et tête à N phases, avec le voyage du corps (v→ · t) ajouté pour juger le GLISSEMENT.
 */
export function gaitPortrait(P, { vF = 4, vR = 0, style = NEUTRAL_GAIT_STYLE, opts = {}, n = 120 } = {}) {
  const frames = [];
  const T = gaitPose(P, 0, vF, vR, style, opts).meta.T;             // (A7 bis) la durée du cycle de la pose elle-même (jambe, frein)
  for (let i = 0; i < n; i++) {
    const phi = i / n, t = phi * T;
    const g = gaitPose(P, phi, vF, vR, style, opts);
    const fk = fkPose(P, g.q, g.hips);
    const travel = [vR * t, 0, -vF * t];
    const W = (b) => [fk[b].p[0] + travel[0], fk[b].p[1], fk[b].p[2] + travel[2]];
    const kneeAngle = (side) => {
      const a = sub(fk[`${side}UpLeg`].p, fk[`${side}Leg`].p), b = sub(fk[`${side}Foot`].p, fk[`${side}Leg`].p);
      const c = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (len(a) * len(b) || 1);
      return 180 - Math.acos(clamp(c, -1, 1)) / D2R;                    // 0 = jambe tendue
    };
    const hipFlex = (side) => {
      const th = sub(fk[`${side}Leg`].p, fk[`${side}UpLeg`].p);       // cuisse, repère personnage
      return Math.atan2(-th[2], -th[1]) / D2R;                           // + = devant
    };
    frames.push({
      phi, t, hips: g.hips, meta: g.meta, feet: g.feet,
      L: { ankle: fk.LeftFoot.p, ankleW: W('LeftFoot'), toeW: W('LeftToeBase'), toe: fk.LeftToeBase.p, knee: fk.LeftLeg.p, hip: fk.LeftUpLeg.p, hand: fk.LeftHand.p, kneeAngle: kneeAngle('Left'), hipFlex: hipFlex('Left'), phase: g.feet.Left.phase, reachable: g.feet.Left.reachable },
      R: { ankle: fk.RightFoot.p, ankleW: W('RightFoot'), toeW: W('RightToeBase'), toe: fk.RightToeBase.p, knee: fk.RightLeg.p, hip: fk.RightUpLeg.p, hand: fk.RightHand.p, kneeAngle: kneeAngle('Right'), hipFlex: hipFlex('Right'), phase: g.feet.Right.phase, reachable: g.feet.Right.reachable },
      head: fk.Head.p, pelvis: fk.Hips.p, chest: fk.Spine2.p,
    });
  }
  return { frames, T, vF, vR };
}

/**
 * LE CONTRAT D'UNE FOULÉE (un régime, un style) — les clauses sont les façons dont une locomotion
 * redevient fausse : le pied d'appui qui glisse, le vol qui rase ou traverse la pelouse, le genou
 * qui plie à l'envers, les bras en phase, le buste qui ne penche pas plus vite, les pieds qui se
 * croisent en pas chassés. Chacune a son sabotage dans verify-foulee.mjs.
 */
/** Le talon (le point de roulement : hb derrière la cheville, ha dessous au repos) d'une image du portrait, au MONDE — tourné comme l'axe
 *  cheville → métatarses de la pose FK (indépendant de la variable « pitch » du générateur). */
function talonDe(A, q, dir, rest) {
  // l'inclinaison du pied comme la pose l'applique (J.Foot = ry(ouverture) · rx(inclinaison) : autour de l'axe latéral du personnage, le pied
  // déjà ouvert) : l'axe cheville → métatarses de la FK contre celui du pied ouvert au repos, dans le plan (haut, avant) du personnage
  const d = sub(A.toe, A.ankle), f = dir;                               // f : l'avant du personnage (le talon roule dans ce plan)
  const delta = Math.atan2(d[1], -d[2]) - Math.atan2(rest[1], -rest[2]);   // + = pointe relevée par rapport au repos
  const fw = -q.talonB * Math.cos(delta) + q.talonH * Math.sin(delta), up = -q.talonB * Math.sin(delta) - q.talonH * Math.cos(delta);
  return { p: [A.ankleW[0] + f[0] * fw, A.ankleW[1] + up, A.ankleW[2] + f[2] * fw], delta };
}
export function checkGaitGen(P, { vF = 4, vR = 0, style = NEUTRAL_GAIT_STYLE, opts = {} } = {}) {
  const issues = [];
  const v = Math.hypot(vF, vR);
  const { frames, T } = gaitPortrait(P, { vF, vR, style, opts, n: 120 });
  const ankleY = P.bones.LeftFoot.bindP[1], ground = P.lengths.groundY;
  const dt = T / frames.length;
  for (const side of ['L', 'R']) {
    let slideMax = 0, stanceN = 0, clearMin = Infinity, toeMin = Infinity, kneeMax = 0, kneeMin = 999, hipMax = -999, hipMin = 999, unreach = 0, kneeBack = 0;
    for (let i = 0; i < frames.length; i++) {
      const f = frames[i], g = frames[(i + 1) % frames.length], A = f[side], B = g[side];
      if (A.phase === 'stance' && B.phase === 'stance') {
        // le voyage du monde entre deux images : le point d'appui ne bouge pas — le TALON (2026-09-24 : pointe relevée, le pied roule sur lui ;
        // à plat c'est la cheville, au même déplacement), calculé sur la pose FK (l'axe cheville → métatarses) et la géométrie du talon
        // (en course seulement : la marche, à reculons et en chassés gardent leur appui d'hier — cheville fixe — et son contrat)
        // (2026-09-24) le recollement du cycle : l'image 0 est à t = 0, pas à T — −trajet(T) (le signe était inversé ; latent : en avant aucun
        // pied n'était « à plat » sur la couture, à reculons le pied qui quitte le sol talon en dernier l'est)
        const wrap = (i + 1) % frames.length === 0 ? [-vR * T, 0, vF * T] : [0, 0, 0], q = frames[i].meta.params, run = (q.wRun ?? 0) > 0 || !!q.griffe;   // (2026-09-24) griffé : le pivot géométrique partout (à reculons, en chassés)
        const sd = side === 'L' ? 'Left' : 'Right', dirC = [0, 0, -1], rest = applyQuat(sub(P.bones[`${sd}ToeBase`].bindP, P.bones[`${sd}Foot`].bindP), ry((side === 'L' ? 1 : -1) * q.turnout));
        const Ha = talonDe(A, q, dirC, rest), Hb = talonDe(B, q, dirC, rest), pa = !run ? A.ankleW : Ha.delta >= 0 ? Ha.p : A.toeW, pb = !run ? B.ankleW : Ha.delta >= 0 ? Hb.p : B.toeW;
        const dx = pb[0] - wrap[0] - pa[0], dz = pb[2] - wrap[2] - pa[2];
        slideMax = Math.max(slideMax, Math.hypot(dx, dz) / dt);
        const lowest = Math.min(A.ankle[1] - ankleY, A.toe[1] - ground, run ? Ha.p[1] - (A.ankleW[1] - A.ankle[1]) - ground : 9);
        if (lowest > 0.012) issues.push(`${side} : le pied d'appui flotte à ${(lowest * 100).toFixed(1)} cm du sol (φ ${f.phi.toFixed(2)})`);
      }
      // l'appui MESURABLE : à plat ou en pelage (le talon des coureurs se lève dès 16-35 % de l'appui — 2026-09-24 ; l'orteil du pelage de
      // course est tenu par son propre contrat, verify-foulee)
      if (A.phase !== 'swing' && B.phase !== 'swing') stanceN++;
      if (A.phase === 'swing') {
        const u = f.feet[side === 'L' ? 'Left' : 'Right'].u, w = (u - f.meta.s) / (1 - f.meta.s);
        if (w > 0.3 && w < 0.7) clearMin = Math.min(clearMin, A.toe[1] - ground);
      }
      toeMin = Math.min(toeMin, A.toe[1] - ground);
      kneeMax = Math.max(kneeMax, A.kneeAngle); kneeMin = Math.min(kneeMin, A.kneeAngle);
      hipMax = Math.max(hipMax, A.hipFlex); hipMin = Math.min(hipMin, A.hipFlex);
      if (!A.reachable) unreach++;
      // le genou plie DEVANT : il est en avant (−Z) de la droite hanche→cheville, jamais derrière
      const hk = sub(A.knee, A.hip), ha = sub(A.ankle, A.hip);
      const t = (hk[0] * ha[0] + hk[1] * ha[1] + hk[2] * ha[2]) / (len(ha) * len(ha) || 1);
      const proj = [A.hip[0] + ha[0] * t, A.hip[1] + ha[1] * t, A.hip[2] + ha[2] * t];
      if (A.knee[2] - proj[2] > 0.015) kneeBack++;
    }
    if (stanceN < 5) issues.push(`${side} : pas d'appui fixe mesurable (${stanceN} images)`);
    if (slideMax > 0.06) issues.push(`${side} : le pied d'appui GLISSE (${slideMax.toFixed(2)} m/s au monde — un appui est immobile)`);
    // (2026-09-24) le plancher est MESURÉ : le quart le plus bas des coureurs RBDS (MT1 — l'os ToeBase — au-dessus de sa hauteur debout, w ∈
    // [0,3 ; 0,7], 14 coureurs, ~1 000 vols par vitesse : foulee-sondes/garde-orteil.py) — 1,7 / 4,9 / 6,3 cm à 2,5 / 3,5 / 4,5 m/s (médianes
    // 3,9 / 8,1 / 9,8). Le seuil fixe d'hier (4 cm dès 2,3 m/s) rejetait la course de la moitié des coureurs mesurés au trot.
    // En VIRAGE (pas de coureurs mesurés) la hanche intérieure descend du roulis — (largeur de hanche / 2)·sin(roulis), la formule de la pose :
    // le plancher du pied intérieur descend d'autant (2,8 cm à 9 m/s²).
    const aT = clamp(opts.turn ?? 0, -9, 9), roulis = clamp(Math.atan(aT / 9.81) / D2R * 0.55, -18, 18), interieur = (aT > 0) === (side === 'R');
    const baisse = aT && interieur ? (P.lengths.hipWidth / 2) * Math.abs(Math.sin(roulis * D2R)) : 0;
    const plancher = Math.max(0.003, plancherOrteil(v) - baisse);        // (2026-09-24) mesuré, marche comprise (plancherOrteil)
    if (v > 0.8 && clearMin < plancher) issues.push(`${side} : le vol rase la pelouse (orteil +${(clearMin * 100).toFixed(1)} cm < ${(plancher * 100).toFixed(1)}, le quart bas des marcheurs / coureurs)`);
    if (toeMin < -0.015) issues.push(`${side} : l'orteil traverse la pelouse (${(toeMin * 100).toFixed(1)} cm)`);
    if (kneeMax > 155) issues.push(`${side} : genou à ${kneeMax.toFixed(0)}° (> 155 — le sprint mesuré plie à 148 ± 5,6°)`);
    // la cuisse derrière : −30° jusqu'à 4,5 m/s ; au-delà la borne suit les coureurs mesurés (RBDS : cuisse globale au plus bas −17 / −22 /
    // −27° à 2,5 / 3,5 / 4,5 m/s, −5° par m/s) avec 2° de marge par m/s — −36° à 6,5, −40,5° à 8 (2026-09-24 ; −30 partout rejetait la
    // course réelle au-delà de 5 m/s)
    const hipLo = -30 - 3 * Math.max(0, Math.hypot(vF, vR) - 4.5);
    if (hipMax > 80 || hipMin < hipLo) issues.push(`${side} : hanche hors [${hipLo.toFixed(0).replace('-', '−')}, 80]° (${hipMin.toFixed(0)}…${hipMax.toFixed(0)})`);
    if (unreach) issues.push(`${side} : ${unreach} images hors de portée (la jambe sature — glissement caché)`);
    if (kneeBack) issues.push(`${side} : le genou plie à l'envers sur ${kneeBack} images`);
  }
  // la symétrie : le pied droit est le gauche en miroir, un demi-cycle plus tard
  if (Math.abs(vR) < 0.1 && !opts.turn && !opts.boite) { let worst = 0;   // (A7 bis) le virage est asymétrique par construction ; (§ 8) la boiterie aussi
    for (let i = 0; i < frames.length; i++) {
      const a = frames[i].L.ankle, b = frames[(i + frames.length / 2) % frames.length].R.ankle;
      worst = Math.max(worst, Math.hypot(a[0] + b[0], a[1] - b[1], a[2] - b[2]));
    }
    if (worst > 0.02) issues.push(`asymétrie gauche/droite ${(worst * 100).toFixed(1)} cm`); }
  // la longueur du pas = la moitié de la foulée de la loi (v·T/2) — la cadence et le chemin sont UN
  // (en avant/arrière : de côté les deux demi-pas sont inégaux, le pied qui mène et celui qui suit)
  if (v > 0.8 && Math.abs(vR) < 0.1 * Math.abs(vF) && !opts.boite) {   // (§ 8) la boiterie a des pas inégaux par construction (l'appui immobile la juge)
    const l0 = frames[0].L.ankleW, r0 = frames[frames.length / 2].R.ankleW;
    const step = ((r0[0] - l0[0]) * vR + (r0[2] - l0[2]) * -vF) / v;   // le long de la vitesse
    const want = v * T / 2;
    if (Math.abs(step - want) > 0.05 * want + 0.02) issues.push(`pas de ${step.toFixed(2)} m pour ${want.toFixed(2)} attendu (v·T/2)`);
  }
  // les bras : opposés, et opposés à leur jambe (gauche derrière au contact gauche) — sauf les mains POSÉES (A12e : sur les hanches, aucun balancier)
  if (!opts.mainsHanches) {
  if (v > 1.0) {
    const f0 = frames[0];
    if (!(f0.L.hand[2] > f0.R.hand[2] + 0.02)) issues.push('au contact gauche la main gauche n\'est pas derrière la droite');
    const f2 = frames[frames.length / 2];
    if (!(f2.R.hand[2] > f2.L.hand[2] + 0.02)) issues.push('au contact droit la main droite n\'est pas derrière la gauche');
  }
  }
  // la tête stable et le buste qui penche en avant (jamais en arrière en course avant)
  const leanOf = (f) => Math.atan2(-(f.chest[2] - f.pelvis[2]), f.chest[1] - f.pelvis[1]) / D2R;
  const rest = fkPose(P, {}, null);
  const leanRest = leanOf({ chest: rest.Spine2.p, pelvis: rest.Hips.p });
  const leans = frames.map((f) => leanOf(f) - leanRest);
  const leanMean = leans.reduce((a, b) => a + b, 0) / leans.length;
  if (vF > 1.5 && Math.abs(vR) < 0.3 && leanMean < 0.5 && !(opts.brake > 0)) issues.push(`le tronc ne penche pas en avant (${leanMean.toFixed(1)}°)`);   // (A7 bis) le frein se retient en arrière
  if (leanMean > 30) issues.push(`le tronc penche trop (${leanMean.toFixed(1)}°)`);
  // pas chassés : jamais de croisement, appui large, genoux fléchis
  if (Math.abs(vR) > 0.8 && Math.abs(vF) < 0.3 * Math.abs(vR)) {
    let cross = 0, wMin = Infinity, kneeMinL = 999;
    for (const f of frames) { if (f.L.ankle[0] > f.R.ankle[0] - 0.05) cross++; wMin = Math.min(wMin, f.R.ankle[0] - f.L.ankle[0]); kneeMinL = Math.min(kneeMinL, f.L.kneeAngle, f.R.kneeAngle); }
    if (cross) issues.push(`pas chassés : les pieds se croisent sur ${cross} images`);
    if (kneeMinL < 10) issues.push(`pas chassés : genoux tendus (${kneeMinL.toFixed(0)}°)`);
    if (frames[0].meta.drop < 0.06) issues.push(`pas chassés : bassin haut (affaissement ${(frames[0].meta.drop * 100).toFixed(0)} cm)`);
  }
  // À RECULONS (2026-09-24, mesuré — Scherpereel 2023, 100STYLE, Bates 1986) : le pied se pose DERRIÈRE le bassin et SUR LA POINTE (−22 à −31° en
  // marche, jusqu'à −65° en course), et le GENOU reste devant la hanche tout le vol (cuisse ≥ 0 → 19-23° en marche, 7 → 25° à 1 m/s en course :
  // c'est le genou qui passe devant, pas la cheville — elle culmine derrière la hanche, genou plié) ; buste droit.
  // (La clause d'hier, « le vol culmine DEVANT », venait de la pratique : les mesures la démentent.)
  if (vF < -0.5 && Math.abs(vR) < 0.3 * Math.abs(vF)) {
    const land = frames[0].L.ankle, run = (frames[0].meta.params.wRun ?? 0) >= 0.5;
    if (!(land[2] > 0.05)) issues.push(`à reculons : le pied se pose devant (${land[2].toFixed(2)} m)`);
    if (run && !(frames[0].feet.Left.pitch < -10)) issues.push(`à reculons : le pied ne se pose pas sur la pointe (${frames[0].feet.Left.pitch.toFixed(0)}°)`);
    const sw = frames.filter((f) => f.L.phase === 'swing').map((f) => f.L.hipFlex);
    if (sw.length && (Math.max(...sw) < 12 || Math.min(...sw) < -8)) issues.push(`à reculons : le genou ne reste pas devant la hanche en vol (cuisse ${Math.min(...sw).toFixed(0)} → ${Math.max(...sw).toFixed(0)}°)`);
    if (leanMean > 8) issues.push(`à reculons : tronc penché de ${leanMean.toFixed(1)}° (> 8)`);
  }
  return { ok: issues.length === 0, issues, portrait: { T, leanMean } };
}
