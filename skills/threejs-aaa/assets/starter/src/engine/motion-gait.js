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
// Mann & Hagy 1980 (sprint : appui ~25 %, genou 120°+, bras 90° de coude), Pontzer 2009 (déphasage
// bassin/épaules 149° marche → 94° course, tête ≤ 6°). Course arrière et pas chassés : Flynn 1994 et
// la pratique (appui sur l'avant-pied, buste droit ; chassés larges, genoux fléchis, pas de croisement).
//
// Pur : aucune dépendance rendu. verify-foulee.mjs porte le contrat et ses sabotages.

import { fkPose, jointToSpec, quatToEulerXYZ, rx, ry, rz, chain } from './motion-rig.js';
import { legIK, armJoints, ramp, bump } from './motion-strike.js';
import { strideLaw } from './gait.js';
import { sub, len, quatMul, quatConjugate, quatNormalize, clamp } from './vecmath.js';
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
export const GAIT_REGIMES = {
  walk:   { v: 1.4, s: 0.62, peel: 0.50, bias: 0.20, roll: 0.20, hw: 0.09,  pitchHS: 12, pitchTO: 30, swingH: 0.11, swingPeak: 0.34, swingK: 1.0,  drop: 0.010, bobA: 0.024, bobSign: 1,  pYaw: 4,  pList: 4, pTilt: 0,  lean: 3,  girdle: 4.5, psi: 149, armA: 14, armOff: 0,  elbow: 24, elbowMod: 8,  armElev: 8,  turnout: 8, toeUp: 22 },
  jog:    { v: 2.8, s: 0.44, peel: 0.35, bias: 0.10, roll: 0.12, hw: 0.07,  pitchHS: 4,  pitchTO: 25, swingH: 0.20, swingPeak: 0.32, swingK: 1.2,  drop: 0.040, bobA: 0.028, bobSign: -1, pYaw: 6,  pList: 5, pTilt: 3,  lean: 6,  girdle: 9,   psi: 100, armA: 26, armOff: 6,  elbow: 75, elbowMod: 12, armElev: 11, turnout: 6, toeUp: 18 },
  run:    { v: 5.5, s: 0.36, peel: 0.30, bias: 0.10, roll: 0.10, hw: 0.055, pitchHS: 0,  pitchTO: 22, swingH: 0.30, swingPeak: 0.30, swingK: 1.3,  drop: 0.045, bobA: 0.036, bobSign: -1, pYaw: 7,  pList: 6, pTilt: 5,  lean: 8,  girdle: 12,  psi: 94,  armA: 36, armOff: 8,  elbow: 85, elbowMod: 14, armElev: 13, turnout: 5, toeUp: 15 },
  sprint: { v: 8.5, s: 0.27, peel: 0.30, bias: 0.12, roll: 0.06, hw: 0.045, pitchHS: -8, pitchTO: 20, swingH: 0.30, swingPeak: 0.42, swingK: 1.0,  drop: 0.035, bobA: 0.040, bobSign: -1, pYaw: 9,  pList: 5, pTilt: 8,  lean: 10, girdle: 14,  psi: 92,  armA: 42, armOff: 10, elbow: 92, elbowMod: 18, armElev: 15, turnout: 4, toeUp: 12 },
  // la course ARRIÈRE : appui sur l'avant-pied, genou devant en vol, buste droit, bras courts
  back:   { v: 3.0, s: 0.40, peel: 0.20, bias: 0,     roll: 0.05, hw: 0.09, pitchHS: -10, pitchTO: 8, swingH: 0.14, swingPeak: 0.45, swingK: 1.0, drop: 0.060, bobA: 0.025, bobSign: -1, pYaw: 3,  pList: 3, pTilt: -2, lean: 1,  girdle: 5,   psi: 100, armA: 14, armOff: 12, elbow: 70, elbowMod: 6,  armElev: 14, turnout: 6, toeUp: 10 },
  // les PAS CHASSÉS : larges (hw dynamique — jamais de croisement), bas, tronc penché, bras ouverts
  lat:    { v: 2.0, s: 0.50, peel: 0.10, bias: 0,     roll: 0,    hw: 0.12, pitchHS: 0,   pitchTO: 6, swingH: 0.09, swingPeak: 0.50, swingK: 1.0, drop: 0.110, bobA: 0.015, bobSign: -1, pYaw: 2,  pList: 3, pTilt: 6,  lean: 14, girdle: 3,   psi: 100, armA: 6,  armOff: 18, elbow: 60, elbowMod: 4,  armElev: 32, turnout: 4, toeUp: 8 },
};
const FWD_ORDER = ['walk', 'jog', 'run', 'sprint'];
const KEYS = Object.keys(GAIT_REGIMES.walk).filter((k) => k !== 'v');

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
export function gaitParams(vF, vR, style = NEUTRAL_GAIT_STYLE, override = null) {
  const v = Math.hypot(vF, vR);
  const f = v > 1e-6 ? Math.max(0, vF / v) : 1, bk = v > 1e-6 ? Math.max(0, -vF / v) : 0, lat = v > 1e-6 ? Math.abs(vR) / v : 0;
  const wsum = f + bk + lat || 1;
  const PF = forwardParams(v), PB = GAIT_REGIMES.back, PL = GAIT_REGIMES.lat;
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
  p.v = v; p.f = f; p.bk = bk; p.lat = lat;
  // LA CADENCE SUIT LA DIRECTION : la loi de Dorn est celle de la course AVANT (1,5 m de foulée à
  // 1,4 m/s) ; à reculons on trottine plus court (×1,3), en pas chassés on double presque (×1,9) —
  // sans quoi un chassé à 2 m/s demanderait des pieds à 1,8 m l'un de l'autre. Le contrôleur
  // avance l'horloge avec le même facteur (gaitCadenceFactor) : une phase, une durée.
  p.kDir = gaitCadenceFactor(vF, vR);
  p.T = 1 / Math.max(0.3, strideLaw(v) * p.kDir);                 // durée du cycle (deux appuis), s
  // pas chassés : la demi-largeur suit la vitesse latérale pour que les pieds ne se croisent JAMAIS
  // (le pied qui se pose au plus à droite contre celui qui décolle au plus à gauche — voir contrat)
  if (lat > 1e-3) p.hw = Math.max(p.hw, lat * (0.415 * Math.abs(vR) * p.s * p.T + 0.08));
  p.pole = [0, 0, -1];
  if (override) Object.assign(p, override);
  return p;
}

/** Le facteur de cadence d'une direction (1 en avant, 1,3 à reculons, 1,9 de côté — fondu continu). */
export function gaitCadenceFactor(vF, vR) {
  const v = Math.hypot(vF, vR);
  if (v < 1e-6) return 1;
  const bk = Math.max(0, -vF / v), lat = Math.abs(vR) / v;
  return 1 + 0.3 * bk + 0.9 * lat;
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
export function footPath(u, P_, c, vC, ankleY, Lfoot) {
  const p = P_;
  const D = [vC[0] * p.s * p.T, 0, vC[2] * p.s * p.T];                 // déplacement du corps pendant l'appui
  const dir = len(D) > 1e-9 ? [D[0] / len(D), 0, D[2] / len(D)] : [0, 0, -1];
  const roll = p.roll * Math.min(1, len(D) / 0.3);                     // pas de déroulé sur place
  const land = [c[0] + D[0] * (0.5 - p.bias), 0, c[2] + D[2] * (0.5 - p.bias)];               // c0
  const lift = [c[0] - D[0] * (0.5 + p.bias) + dir[0] * roll, 0, c[2] - D[2] * (0.5 + p.bias) + dir[2] * roll]; // c1
  const sFix = p.s * (1 - p.peel);
  let pos, pitch, phase, toe = 0;
  if (u < p.s) {
    // APPUI : la cheville recule sous le corps à −v (fixe au monde), puis avance de `roll` en pelant
    const rho = u < sFix ? 0 : sstep((u - sFix) / Math.max(1e-6, p.s - sFix));
    const k = (u / p.s) * (1 - (p.slip || 0));                         // `slip` : le sabotage nommé de l'appui qui glisse
    pos = [land[0] - D[0] * k + dir[0] * roll * rho, 0, land[2] - D[2] * k + dir[2] * roll * rho];
    const flatten = 1 - ramp(u / p.s, 0, 0.08, 0.16);
    const peel = u < sFix ? 0 : ramp(u, sFix, sFix + (p.s - sFix) * 0.55, p.s);
    pitch = p.pitchHS * flatten - p.pitchTO * peel;
    if (p.pitchHS < 0) pitch = Math.min(pitch, p.pitchHS * flatten);   // avant-pied : le talon ne descend pas
    toe = p.toeUp * peel;
    phase = u < sFix ? 'stance' : 'peel';
  } else {
    // VOL : de c1 à c0, le transfert horizontal retardé (le talon monte d'abord), cloche de hauteur
    const w = (u - p.s) / (1 - p.s);
    const sig = 0.5 - 0.5 * Math.cos(Math.PI * Math.pow(w, p.swingK));
    pos = [lift[0] + (land[0] - lift[0]) * sig, 0, lift[2] + (land[2] - lift[2]) * sig];
    pitch = -p.pitchTO * (1 - ramp(w, 0, 0.25, 0.5)) + p.pitchHS * ramp(w, 0.5, 0.8, 1);
    toe = p.toeUp * (1 - ramp(w, 0, 0.15, 0.3));
    phase = 'swing';
  }
  // la hauteur : pivot sur l'orteil quand la pointe est basse (talon levé), cloche en vol
  const heel = Lfoot * Math.sin(Math.max(0, -pitch) * D2R);
  let y = ankleY + heel;
  if (phase === 'swing') {
    const w = (u - p.s) / (1 - p.s);
    y = ankleY + heel + p.swingH * bump(w, 0, p.swingPeak, 1);
  }
  pos[1] = y;
  return { p: pos, pitch, phase, toe };
}

/**
 * LA POSE DE FOULÉE — fonction pure de (φ, vF, vR). Renvoie { q: { os: q_spec }, hips: [droite, haut,
 * avant], J: { os: R }, meta }. `opts.armSwingF` : l'accent de la persona ; `opts.override` : un
 * sabotage ou un réglage nommé (bancs).
 */
export function gaitPose(P, phi, vF, vR, style = NEUTRAL_GAIT_STYLE, opts = {}) {
  const p = gaitParams(vF, vR, style, opts.override || null);
  const L = P.lengths, R = L.thigh + L.shank;
  const hipY = P.bones.LeftUpLeg.bindP[1], ankleY = P.bones.LeftFoot.bindP[1];
  const vC = [vR, 0, -vF];                                            // repère personnage : avant = −Z
  const ph = ((phi % 1) + 1) % 1;
  const uL = ph, uR = (ph + 0.5) % 1;
  const armF = (opts.armSwingF ?? 1);

  // ---- le bassin : rebond (2/cycle), affaissement, roulis vers le pied d'appui, lacet, tangage
  const bobPhase = TAU * 2 * (ph - p.s / 2);
  let bob = p.bobA * p.bobSign * Math.cos(bobPhase);
  // le bassin doit ATTEINDRE le pied aux extrêmes (pose et décollage) — l'affaissement nécessaire
  // se calcule, il ne se devine pas (la portée saturée est le patin silencieux des jambes IK)
  const reach = 0.99 * R;
  const cL = [-p.hw, 0, 0], cR = [p.hw, 0, 0];
  let drop = p.drop;
  for (let i = 0; i <= 16; i++) {
    const u = (i / 16) * (p.s + 0.06);
    const bobU = p.bobA * p.bobSign * Math.cos(TAU * 2 * (u - p.s / 2));
    for (const [c, side] of [[cL, 'Left'], [cR, 'Right']]) {
      const fp = footPath(u, p, c, vC, ankleY, L.foot);
      const dx = fp.p[0] - P.bones[`${side}UpLeg`].bindP[0], dz = fp.p[2] - P.bones[`${side}UpLeg`].bindP[2];
      const horiz = Math.hypot(dx, dz);
      const maxDown = Math.sqrt(Math.max(0, reach * reach - horiz * horiz));
      drop = Math.max(drop, hipY + bobU - fp.p[1] - maxDown + 0.005);
    }
  }
  const hips = [0, -drop + bob, 0];
  const pYaw = -p.pYaw * Math.cos(TAU * ph);                          // hanche gauche devant à φ = 0
  const pList = -p.pList * Math.cos(TAU * (ph - p.s / 2));            // côté en vol qui tombe
  const RHips = chain(rx(-p.pTilt), rz(pList), ry(pYaw));
  const J = { Hips: RHips };

  // ---- le tronc : inclinaison avant, contre-rotation des épaules (déphasage Pontzer), tête stable
  const girdle = p.girdle * Math.sin(TAU * ph - Math.PI / 2 - p.psi * D2R);
  const leanQ = (k) => rx(-p.lean * k);
  J.Spine = chain(leanQ(0.4), ry(girdle * 0.2));
  J.Spine1 = chain(leanQ(0.35), ry(girdle * 0.35));
  J.Spine2 = chain(leanQ(0.25), ry(girdle * 0.45));
  const head = clamp(-girdle * 0.75, -6, 6);
  J.Neck = chain(rx(p.lean * 0.3), ry(head * 0.4));
  J.Head = chain(rx(p.lean * 0.3), ry(head * 0.6));

  // ---- les bras : opposés à leur jambe (gauche derrière à φ = 0), coude qui se ferme en avant
  const swing = p.armA * armF * Math.cos(TAU * ph + (p.armPhase || 0));   // `armPhase` : le sabotage des bras en phase
  const fwdL = p.armOff - swing, fwdR = p.armOff + swing;
  const elbowL = p.elbow + p.elbowMod * (0.5 - 0.5 * Math.cos(TAU * ph));
  const elbowR = p.elbow + p.elbowMod * (0.5 + 0.5 * Math.cos(TAU * ph));
  Object.assign(J, armJoints('Left', { elev: p.armElev, fwd: fwdL, elbow: elbowL }));
  Object.assign(J, armJoints('Right', { elev: p.armElev, fwd: fwdR, elbow: elbowR }));

  // ---- les jambes : chemin de pied → IK sur la hanche de l'instant, pied à plat + tangage + ouverture
  const partial = fkPose(P, { Hips: jointToSpec(P, 'Hips', RHips) }, hips);
  const feet = {};
  for (const [side, u, c, sgn] of [['Left', uL, cL, 1], ['Right', uR, cR, -1]]) {
    const fp = footPath(u, p, c, vC, ankleY, L.foot);
    const hipW = partial[`${side}UpLeg`].p;
    const pole = [p.pole[0] - sgn * 0.12, p.pole[1], p.pole[2]];
    const r = legIK(P, side, hipW, RHips, fp.p, pole);
    J[`${side}UpLeg`] = r.Rthigh; J[`${side}Leg`] = r.Rshank;
    const legW = quatMul(quatMul(RHips, r.Rthigh), r.Rshank);
    const flat = quatNormalize(quatConjugate(legW));
    J[`${side}Foot`] = quatMul(flat, chain(ry(sgn * p.turnout), rx(fp.pitch)));
    J[`${side}ToeBase`] = rx(fp.toe);
    feet[side] = { ...fp, u, reachable: r.reachable, knee: r.knee, hip: hipW };
  }
  const q = {};
  for (const [bone, Rb] of Object.entries(J)) { const s = jointToSpec(P, bone, Rb); if (s) q[bone] = s; }
  return { q, hips, J, feet, meta: { s: p.s, T: p.T, drop, bob, lean: p.lean, params: p } };
}

/** Un CYCLE en spec animkit (une clé par 1/fps s sur la durée T, loop) — la planche-contact, checkClip. */
export function gaitCycleSpec(P, { vF = 4, vR = 0, style = NEUTRAL_GAIT_STYLE, fps = 60, opts = {}, name = null } = {}) {
  const T = Math.round(gaitParams(vF, vR, style, opts.override || null).T * 10000) / 10000;
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
  const T = gaitParams(vF, vR, style, opts.override || null).T;
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
      L: { ankle: fk.LeftFoot.p, ankleW: W('LeftFoot'), toe: fk.LeftToeBase.p, knee: fk.LeftLeg.p, hip: fk.LeftUpLeg.p, hand: fk.LeftHand.p, kneeAngle: kneeAngle('Left'), hipFlex: hipFlex('Left'), phase: g.feet.Left.phase, reachable: g.feet.Left.reachable },
      R: { ankle: fk.RightFoot.p, ankleW: W('RightFoot'), toe: fk.RightToeBase.p, knee: fk.RightLeg.p, hip: fk.RightUpLeg.p, hand: fk.RightHand.p, kneeAngle: kneeAngle('Right'), hipFlex: hipFlex('Right'), phase: g.feet.Right.phase, reachable: g.feet.Right.reachable },
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
        // le voyage du monde entre deux images : la cheville fixe ne bouge pas
        const wrap = (i + 1) % frames.length === 0 ? [vR * T, 0, -vF * T] : [0, 0, 0];
        const dx = B.ankleW[0] - wrap[0] - A.ankleW[0], dz = B.ankleW[2] - wrap[2] - A.ankleW[2];
        slideMax = Math.max(slideMax, Math.hypot(dx, dz) / dt);
        stanceN++;
        const lowest = Math.min(A.ankle[1] - ankleY, A.toe[1] - ground);
        if (lowest > 0.012) issues.push(`${side} : le pied d'appui flotte à ${(lowest * 100).toFixed(1)} cm du sol (φ ${f.phi.toFixed(2)})`);
      }
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
    if (v > 0.8 && clearMin < (v > 2.3 ? 0.04 : 0.012)) issues.push(`${side} : le vol rase la pelouse (cheville +${(clearMin * 100).toFixed(1)} cm)`);
    if (toeMin < -0.015) issues.push(`${side} : l'orteil traverse la pelouse (${(toeMin * 100).toFixed(1)} cm)`);
    if (kneeMax > 140) issues.push(`${side} : genou à ${kneeMax.toFixed(0)}° (> 140)`);
    if (hipMax > 80 || hipMin < -30) issues.push(`${side} : hanche hors [−30, 80]° (${hipMin.toFixed(0)}…${hipMax.toFixed(0)})`);
    if (unreach) issues.push(`${side} : ${unreach} images hors de portée (la jambe sature — glissement caché)`);
    if (kneeBack) issues.push(`${side} : le genou plie à l'envers sur ${kneeBack} images`);
  }
  // la symétrie : le pied droit est le gauche en miroir, un demi-cycle plus tard
  if (Math.abs(vR) < 0.1) { let worst = 0;
    for (let i = 0; i < frames.length; i++) {
      const a = frames[i].L.ankle, b = frames[(i + frames.length / 2) % frames.length].R.ankle;
      worst = Math.max(worst, Math.hypot(a[0] + b[0], a[1] - b[1], a[2] - b[2]));
    }
    if (worst > 0.02) issues.push(`asymétrie gauche/droite ${(worst * 100).toFixed(1)} cm`); }
  // la longueur du pas = la moitié de la foulée de la loi (v·T/2) — la cadence et le chemin sont UN
  // (en avant/arrière : de côté les deux demi-pas sont inégaux, le pied qui mène et celui qui suit)
  if (v > 0.8 && Math.abs(vR) < 0.1 * Math.abs(vF)) {
    const l0 = frames[0].L.ankleW, r0 = frames[frames.length / 2].R.ankleW;
    const step = ((r0[0] - l0[0]) * vR + (r0[2] - l0[2]) * -vF) / v;   // le long de la vitesse
    const want = v * T / 2;
    if (Math.abs(step - want) > 0.05 * want + 0.02) issues.push(`pas de ${step.toFixed(2)} m pour ${want.toFixed(2)} attendu (v·T/2)`);
  }
  // les bras : opposés, et opposés à leur jambe (gauche derrière au contact gauche)
  if (v > 1.0) {
    const f0 = frames[0];
    if (!(f0.L.hand[2] > f0.R.hand[2] + 0.02)) issues.push('au contact gauche la main gauche n\'est pas derrière la droite');
    const f2 = frames[frames.length / 2];
    if (!(f2.R.hand[2] > f2.L.hand[2] + 0.02)) issues.push('au contact droit la main droite n\'est pas derrière la gauche');
  }
  // la tête stable et le buste qui penche en avant (jamais en arrière en course avant)
  const leanOf = (f) => Math.atan2(-(f.chest[2] - f.pelvis[2]), f.chest[1] - f.pelvis[1]) / D2R;
  const rest = fkPose(P, {}, null);
  const leanRest = leanOf({ chest: rest.Spine2.p, pelvis: rest.Hips.p });
  const leans = frames.map((f) => leanOf(f) - leanRest);
  const leanMean = leans.reduce((a, b) => a + b, 0) / leans.length;
  if (vF > 1.5 && Math.abs(vR) < 0.3 && leanMean < 0.5) issues.push(`le tronc ne penche pas en avant (${leanMean.toFixed(1)}°)`);
  if (leanMean > 30) issues.push(`le tronc penche trop (${leanMean.toFixed(1)}°)`);
  // pas chassés : jamais de croisement, appui large, genoux fléchis
  if (Math.abs(vR) > 0.8 && Math.abs(vF) < 0.3 * Math.abs(vR)) {
    let cross = 0, wMin = Infinity, kneeMinL = 999;
    for (const f of frames) { if (f.L.ankle[0] > f.R.ankle[0] - 0.05) cross++; wMin = Math.min(wMin, f.R.ankle[0] - f.L.ankle[0]); kneeMinL = Math.min(kneeMinL, f.L.kneeAngle, f.R.kneeAngle); }
    if (cross) issues.push(`pas chassés : les pieds se croisent sur ${cross} images`);
    if (kneeMinL < 10) issues.push(`pas chassés : genoux tendus (${kneeMinL.toFixed(0)}°)`);
    if (frames[0].meta.drop < 0.06) issues.push(`pas chassés : bassin haut (affaissement ${(frames[0].meta.drop * 100).toFixed(0)} cm)`);
  }
  // course arrière : le pied se pose DERRIÈRE le bassin, le vol monte DEVANT (genou levé), buste droit
  if (vF < -1.0 && Math.abs(vR) < 0.3 * Math.abs(vF)) {
    const land = frames[0].L.ankle;
    if (!(land[2] > 0.05)) issues.push(`course arrière : le pied se pose devant (${land[2].toFixed(2)} m)`);
    let hi = frames[0].L; for (const f of frames) if (f.L.ankle[1] > hi.ankle[1]) hi = f.L;
    if (!(hi.ankle[2] < 0)) issues.push('course arrière : le vol ne monte pas devant le corps');
    if (leanMean > 8) issues.push(`course arrière : tronc penché de ${leanMean.toFixed(1)}° (> 8)`);
  }
  return { ok: issues.length === 0, issues, portrait: { T, leanMean } };
}
