// motion-strike — LA FRAPPE GÉNÉRÉE : un geste de football calculé, pas dessiné.
//
// Les 47 gestes d'animkit-data sont des POSES écrites à la main : six clés pour une frappe, la
// cuisse qui tourne de 92° en ligne droite entre deux d'entre elles, des bras posés à l'aveugle,
// aucune clé qui sache où est le ballon ni où est le poids du corps. L'audit du dépôt le résume :
// pied au contact entre 1 et 1,8 m/s là où le réel est entre 15 et 25 (reference/49, post-scriptum).
//
// Ici un geste est une FONCTION du temps et de paramètres, échantillonnée à 60 Hz, écrite en
// articulations anatomiques (motion-rig) à partir de la biomécanique publiée du coup de pied :
//   • la SÉQUENCE PROXIMO-DISTALE (Kellis & Katis 2007, Nunome et al. 2002) — la cuisse part la
//     première et son pic de vitesse précède le contact de ~50 ms ; le genou fléchit encore quand
//     la cuisse repart, atteint ~110° puis s'étend avec un pic de vitesse SUR le contact
//     (1 100-1 600°/s chez l'élite — Petrolo et al. 2023) ; au contact le genou reste fléchi ~45°,
//     la cheville verrouillée en flexion plantaire (cou-de-pied) ou en rotation externe (intérieur) ;
//   • LE POIDS SUR L'APPUI : le pied d'appui plante à 27-37 cm latéralement du ballon (revue de
//     l'instep kick), genou fléchi 20-30° qui s'étend au contact, le bassin s'assied derrière
//     l'appui pendant l'armé puis passe au-dessus — c'est ce que les captures n'avaient pas ;
//   • LE TRONC ET LES BRAS PAR LA PHYSIQUE : le bassin tourne côté frappeur puis revient, le buste
//     s'incline en arrière à l'armé (10-17°) et contre-tourne, le bras opposé monte en équilibre
//     du moment cinétique, la tête est SUR le ballon jusqu'au contact (quiet eye) ;
//   • LE STYLE : la même loi, des détails par joueur (amplitude d'armé, hauteur du bras, coude,
//     inclinaison, cheville, accompagnement…), tirés d'une graine dans des bornes qui gardent le
//     contrat vrai — un geste reconnaissable par joueur, jamais un autre geste.
//
// Chaque courbe d'angle est une somme de RAMPES C¹ (l'intégrale d'une cloche en cosinus surélevé,
// asymétrique) : le pic de vitesse d'une articulation est un PARAMÈTRE placé à l'instant voulu,
// pas une conséquence de l'interpolation entre deux poses. La jambe d'appui est résolue par IK
// deux os (pied planté, bassin qui voyage). La sortie est un spec animkit ordinaire (Euler XYZ par
// os, canal hanches) : toute la chaîne existante — contrats, couche de geste, stance dérivée,
// horloge de la sim, miroir — reste en place. Pur : node-testable (verify-motion.mjs).

import { fkPose, jointToSpec, quatToEulerXYZ, rx, ry, rz, chain } from './motion-rig.js';
import { twoBoneIK } from './procedural.js';
import { sub, add, norm, len, cross, dot, scale as vscale, quatMul, quatConjugate, quatNormalize, quatAngle, clamp } from './vecmath.js';
import { subRng } from './rng.js';
import { hyp } from './hyp.js';

const D2R = Math.PI / 180, R2D = 180 / Math.PI;

/**
 * LES ESPÈCES DE FRAPPE — durée et contact sont ceux de la table existante (la sim et ses bancs
 * les lisent : un générateur ne re-date pas le football), le reste est la biomécanique du geste.
 *   surface   'laces' (cou-de-pied) | 'inside' (intérieur)
 *   vFoot     vitesse du pied visée au contact (m/s) — cible du solveur d'amplitude
 *   amp       l'amplitude RÉSOLUE contre le profil de référence (solveStrike, vérifiée par le banc :
 *             le jeu génère sans bissection)
 *   swingHip  s avant le contact où la cuisse atteint son extension maximale (repart en avant)
 *   swingKnee s avant le contact où le genou atteint sa flexion maximale
 *   hipTop/hipEnd/kneeTop/kneeMin  degrés — extension d'armé, flexion d'accompagnement, flexion
 *             maximale du genou, genou après le contact
 *   turnOut   rotation externe de la hanche frappeuse au contact (l'intérieur présente sa surface)
 *   lean      inclinaison arrière du tronc à l'armé ; open : rotation du tronc à l'accompagnement
 */
export const KINDS = {
  frappe:          { surface: 'laces',  duration: 0.85, contact: 0.35, vFoot: 14.5, amp: 0.96, swingHip: 0.13, swingKnee: 0.095, follow: 0.20, hipTop: -28, hipEnd: 68, kneeTop: 116, kneeMin: 12, turnOut: 8, abdTop: 14, abdContact: 2, toeDown: 12, lean: 13, open: 22, headDown: 30, armElev: 64, armFwd: 42, dip: 0.055, sitBack: 0.07 },
  frappePuissante: { surface: 'laces',  duration: 1.0,  contact: 0.45, vFoot: 15.5, amp: 1.15, swingHip: 0.12, swingKnee: 0.085, follow: 0.18, hipTop: -26, hipEnd: 72, kneeTop: 124, kneeMin: 10, turnOut: 8, abdTop: 16, abdContact: 2, toeDown: 10, lean: 17, open: 26, headDown: 30, armElev: 70, armFwd: 44, dip: 0.065, sitBack: 0.09 },
  frappeEnroulee:  { surface: 'laces',  duration: 0.9,  contact: 0.38, vFoot: 15, amp: 1.02, swingHip: 0.13, swingKnee: 0.095, follow: 0.22, hipTop: -26, hipEnd: 64, kneeTop: 112, kneeMin: 14, turnOut: 22, abdTop: 18, abdContact: 8, toeDown: 5, lean: 12, open: 30, headDown: 28, armElev: 62, armFwd: 44, dip: 0.05, sitBack: 0.07, wrap: true },
  passe:           { surface: 'inside', duration: 0.7,  contact: 0.38, vFoot: 11.5, amp: 1.08, swingHip: 0.12, swingKnee: 0.09, follow: 0.09, hipTop: -18, hipEnd: 42, kneeTop: 70, kneeMin: 10, turnOut: 42, abdTop: 14, abdContact: 10, toeDown: -8, lean: 6, open: 12, headDown: 26, armElev: 45, armFwd: 22, dip: 0.04, sitBack: 0.06 },
  // LES FEINTES (technique.js : « TOUT l'armé d'une passe / d'une frappe, zéro ballon parti ») — le
  // même générateur, le même armé, et la jambe se RETIENT : le swing s'arrête court du ballon.
  feintePasse:     { surface: 'inside', duration: 0.4,  contact: 0.26, feint: true, vFoot: 0, swingHip: 0.10, swingKnee: 0.07, follow: 0.06, hipTop: -19, hipEnd: 6, kneeTop: 74, kneeMin: 40, turnOut: 30, abdTop: 12, abdContact: 8, toeDown: -6, lean: 5, open: 8, headDown: 24, armElev: 42, armFwd: 22, dip: 0.035, sitBack: 0.06 },
  feinteFrappe:    { surface: 'laces',  duration: 0.55, contact: 0.3,  feint: true, vFoot: 0, swingHip: 0.13, swingKnee: 0.08, follow: 0.10, hipTop: -33, hipEnd: 4, kneeTop: 122, kneeMin: 62, turnOut: 8, abdTop: 14, abdContact: 4, toeDown: 12, lean: 11, open: 14, headDown: 28, armElev: 60, armFwd: 38, dip: 0.05, sitBack: 0.10 },
  passeRapide:     { surface: 'inside', duration: 0.54, contact: 0.22, vFoot: 10.5, amp: 1.3, swingHip: 0.11, swingKnee: 0.08, follow: 0.09, hipTop: -15, hipEnd: 44, kneeTop: 58, kneeMin: 8, turnOut: 40, abdTop: 12, abdContact: 10, toeDown: -8, lean: 5, open: 10, headDown: 24, armElev: 40, armFwd: 20, dip: 0.035, sitBack: 0.045 },
};

/** Les bornes du STYLE — un détail par joueur, jamais un autre geste (verify-motion les balaye). */
export const STYLE_RANGES = {
  backswing: [0.86, 1.14],   // × amplitude d'armé (extension de hanche, flexion du genou)
  lean: [0.6, 1.5],          // × inclinaison arrière du tronc
  open: [0.6, 1.4],          // × rotation du tronc à l'accompagnement
  armElev: [0.75, 1.15],     // × hauteur du bras d'équilibre
  armFwd: [0.6, 1.5],        // × avancée du bras d'équilibre
  elbow: [30, 64],           // ° flexion du coude du bras d'équilibre
  swingArm: [14, 40],        // ° recul du bras côté frappeur
  headDown: [0.75, 1.15],    // × tête baissée
  follow: [0.85, 1.12],      // × flexion de hanche d'accompagnement
  toe: [0.8, 1.1],           // × cheville (flexion plantaire / dorsale)
  dip: [0.7, 1.35],          // × affaissement du bassin
  snap: [-0.012, 0.012],     // s — décalage du pic de vitesse du genou autour du contact
  sideLean: [3, 12],         // ° inclinaison latérale du tronc (loin de la jambe frappeuse)
  stance: [0.9, 1.1],        // × écart latéral du bassin vers l'appui
  hipRoll: [0, 6],           // ° la hanche frappeuse qui se hausse (dégagement)
};
export const NEUTRAL_STYLE = Object.fromEntries(Object.entries(STYLE_RANGES).map(([k, [a, b]]) => [k, k === 'elbow' || k === 'swingArm' || k === 'sideLean' || k === 'hipRoll' ? (a + b) / 2 : k === 'snap' ? 0 : 1]));

/** Le style d'un joueur : une fonction pure de sa graine (persona) — même joueur, même geste. */
export function styleFromSeed(seed) {
  const r = subRng(seed, 'style-frappe');
  const s = {};
  for (const [k, [a, b]] of Object.entries(STYLE_RANGES)) {
    // deux tirages moyennés : les extrêmes sont rares, le milieu fréquent — un banc de joueurs
    // reconnaissables sans caricature
    const u = (r() + r()) / 2;
    s[k] = a + (b - a) * u;
  }
  return s;
}

/** Une rampe C¹ de 0 à 1 sur [t0, t1] dont la VITESSE culmine à tp (intégrale d'une cloche en
 *  cosinus surélevé asymétrique) : le pic de vitesse est un paramètre, pas un accident. */
export function ramp(t, t0, tp, t1) {
  if (t <= t0) return 0;
  if (t >= t1) return 1;
  const total = 0.5 * (t1 - t0);
  if (t <= tp) { const w = Math.max(1e-6, tp - t0), s = t - t0; return (0.5 * (s - (w / Math.PI) * Math.sin(Math.PI * s / w))) / total; }
  const w = Math.max(1e-6, t1 - tp), s = t - tp;
  return (0.5 * (tp - t0) + 0.5 * (s + (w / Math.PI) * Math.sin(Math.PI * s / w))) / total;
}
/** Une bosse C¹ (monte de 0 à 1 puis redescend à 0) — pour ce qui passe et ne reste pas. */
const bump = (t, t0, t1, t2) => (t <= t1 ? ramp(t, t0, (t0 + t1) / 2, t1) : 1 - ramp(t, t1, (t1 + t2) / 2, t2));

// ---- l'orientation d'un os par alignement de repères (direction + normale de plan) ----
const quatFromBasis = (a1, a2, a3, b1, b2, b3) => {   // R = B · Aᵀ (colonnes a → colonnes b)
  const m = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const A = [a1, a2, a3], B = [b1, b2, b3];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) m[r][c] = B[0][r] * A[0][c] + B[1][r] * A[1][c] + B[2][r] * A[2][c];
  const tr = m[0][0] + m[1][1] + m[2][2];
  let q;
  if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; q = [(m[2][1] - m[1][2]) / s, (m[0][2] - m[2][0]) / s, (m[1][0] - m[0][1]) / s, s / 4]; }
  else if (m[0][0] > m[1][1] && m[0][0] > m[2][2]) { const s = Math.sqrt(1 + m[0][0] - m[1][1] - m[2][2]) * 2; q = [s / 4, (m[0][1] + m[1][0]) / s, (m[0][2] + m[2][0]) / s, (m[2][1] - m[1][2]) / s]; }
  else if (m[1][1] > m[2][2]) { const s = Math.sqrt(1 + m[1][1] - m[0][0] - m[2][2]) * 2; q = [(m[0][1] + m[1][0]) / s, s / 4, (m[1][2] + m[2][1]) / s, (m[0][2] - m[2][0]) / s]; }
  else { const s = Math.sqrt(1 + m[2][2] - m[0][0] - m[1][1]) * 2; q = [(m[0][2] + m[2][0]) / s, (m[1][2] + m[2][1]) / s, s / 4, (m[1][0] - m[0][1]) / s]; }
  return quatNormalize(q);
};
const frame = (d, n) => { const a1 = norm(d); let a2 = sub(n, vscale(a1, dot(n, a1))); a2 = norm(a2); return [a1, a2, cross(a1, a2)]; };
/** La rotation MONDE qui amène la direction bind d0 (normale de plan n0) sur d1 (normale n1). */
const alignWorld = (d0, n0, d1, n1) => { const A = frame(d0, n0), B = frame(d1, n1); return quatFromBasis(A[0], A[1], A[2], B[0], B[1], B[2]); };

/**
 * IK DE LA JAMBE D'APPUI : le pied planté, le bassin qui voyage → rotations d'articulation de la
 * cuisse et du tibia (repère personnage au bind), genou vers l'avant (pole −Z).
 * @param P     profil du rig
 * @param side  'Left' | 'Right'
 * @param hipW  position monde de la hanche (après la pose du bassin)
 * @param Rpar  rotation d'articulation cumulée du parent (le bassin)
 * @param ankle cible monde du nœud cheville
 */
function legIK(P, side, hipW, Rpar, ankle) {
  const up = P.bones[`${side}UpLeg`], kn = P.bones[`${side}Leg`], ft = P.bones[`${side}Foot`];
  const L = P.lengths;
  const pole = [0, 0, -1];
  const ik = twoBoneIK(hipW, ankle, L.thigh, L.shank, pole);
  const d1 = norm(sub(ik.mid, hipW)), s1 = norm(sub(ik.end, ik.mid));
  // normale du plan de la jambe : cuisse × pole (le genou bascule dans ce plan)
  const n1 = norm(cross(d1, pole));
  const d0 = norm(sub(kn.bindP, up.bindP)), s0 = norm(sub(ft.bindP, kn.bindP));
  const n0 = norm(cross(d0, [0, 0, -1]));
  const thighW = alignWorld(d0, n0, d1, n1);
  const shankW = alignWorld(s0, n0, s1, n1);
  const Rthigh = quatNormalize(quatMul(quatConjugate(Rpar), thighW));
  const Rshank = quatNormalize(quatMul(quatConjugate(thighW), shankW));
  return { Rthigh, Rshank, knee: ik.mid, reachable: ik.reachable };
}

/** La pose de bras : `elev` ° depuis la verticale basse (0 = bras pendant, 90 = horizontal
 *  latéral), `fwd` ° de flexion (vers l'avant), `elbow` ° de flexion du coude. */
function armJoints(side, { elev, fwd, elbow, rot = 0 }) {
  const s = side === 'Right' ? -1 : 1;                 // abaisser : rz(−) à droite, rz(+) à gauche
  return {
    [`${side}Arm`]: chain(ry(-s * rot), rz(s * (90 - elev)), rx(fwd)),
    [`${side}ForeArm`]: ry(-s * elbow),                 // flexion du coude : ry(+) à droite, ry(−) à gauche
  };
}

/** La pose NEUTRE debout (première et dernière clé) — bras pendants légèrement écartés. */
export function neutralJoints() {
  return { ...armJoints('Left', { elev: 14, fwd: 6, elbow: 14 }), ...armJoints('Right', { elev: 14, fwd: 6, elbow: 14 }) };
}

/**
 * GÉNÉRER une frappe (pied DROIT — le miroir d'animkit est exact et fait le gauche).
 * @param kindName  clé de KINDS
 * @param P         profil du rig (motion-rig)
 * @param style     styleFromSeed(...) ou NEUTRAL_STYLE
 * @param fps       cadence des clés
 * @param amp       facteur d'amplitude du swing (le solveur le règle pour atteindre vFoot)
 */
export function generateStrike(kindName, P, { style = NEUTRAL_STYLE, fps = 60, amp = null } = {}) {
  const K = KINDS[kindName];
  if (!K) throw new Error(`motion-strike : espèce inconnue « ${kindName} »`);
  if (amp == null) amp = K.amp ?? 1;
  const S = { ...NEUTRAL_STYLE, ...style };
  const tc = K.contact, T = K.duration;
  const tTopHip = Math.max(0.04, tc - K.swingHip);
  const tFt = Math.min(T - 0.08, tc + K.follow);          // fin de l'accompagnement (hanche au maximum)
  const tKneeEnd = Math.min(tFt, tc + 0.3 * K.swingKnee);  // le genou finit de s'étendre juste après le contact
  const tPlant = 0.45 * tc;                                // le corps est assis sur l'appui
  const inside = K.surface === 'inside';
  const L = P.lengths;
  const ankleRestY = P.bones.LeftFoot.bindP[1];
  const leftFootRest = P.bones.LeftFoot.bindP;

  // ---- les courbes (degrés) — chaque pic de vitesse est placé ----
  const hipTop = K.hipTop * S.backswing * amp, kneeTop = clamp(K.kneeTop * S.backswing * amp, 40, 122);   // 122° : le maximum réel de flexion d'armé
  const hipEnd = K.hipEnd * S.follow, kneeMin = K.kneeMin;
  // LE PLAFOND DU GENOU EST UNE LOI (animkit.checkClip : 30 rad/s) — l'élite culmine à 1 100-1 600°/s.
  // Une amplitude d'armé plus grande (style, amp) n'accélère pas le genou au-delà de 1 650°/s : elle
  // ALLONGE la fenêtre d'extension (le genou fléchit au maximum plus tôt), le pic reste sur le contact.
  const kneeNeed = (kneeTop - kneeMin) / 1650 * 2;
  const tTopKnee = Math.max(0.06, Math.min(tc - K.swingKnee, tKneeEnd - kneeNeed));
  const snap = S.snap;
  const cv = (t) => {
    // hanche frappeuse : armé → swing (pic ~50 ms avant le contact) → accompagnement → retour
    const hipFlex = hipTop * ramp(t, 0, 0.6 * tTopHip, tTopHip)
      + (hipEnd - hipTop) * ramp(t, tTopHip, tc - 0.09, tFt)
      + (0 - hipEnd) * ramp(t, tFt, (tFt + T) / 2, T);
    // genou frappeur : fléchit pendant que la cuisse repart, s'étend avec le pic SUR le contact
    const knee = kneeTop * ramp(t, 0, 0.6 * tTopKnee, tTopKnee)
      + (kneeMin - kneeTop) * ramp(t, tTopKnee, tc - 0.02 + snap, tKneeEnd)
      + ((K.feint ? kneeMin : 22) - kneeMin) * ramp(t, tKneeEnd, (tKneeEnd + tFt) / 2, tFt)
      + (0 - (K.feint ? kneeMin : 22)) * ramp(t, tFt, (tFt + T) / 2, T);
    // abduction : la jambe contourne le ballon (dehors à l'armé, rentre au contact)
    const abd = K.abdTop * ramp(t, 0, 0.5 * tTopHip, tTopHip) + (K.abdContact - K.abdTop) * ramp(t, tTopHip, tc - 0.03, tc + 0.05) + (0 - K.abdContact) * ramp(t, tFt, (tFt + T) / 2, T);
    // rotation externe : l'intérieur présente sa surface, le cou-de-pied à peine
    // (la rotation externe se DÉFAIT dès la fin du swing, lentement : son retour et celui de la
    // flexion sont orthogonaux, leur norme reste sous le pic du swing — la clause proximo-distale
    // mesure la vitesse angulaire totale de la cuisse)
    const turn = K.turnOut * ramp(t, 0.2 * tc, 0.6 * tc, tc - 0.02) + (0 - K.turnOut) * ramp(t, tKneeEnd, (tKneeEnd + T) / 2, T);
    // cheville : cou-de-pied verrouillé pointe basse ; intérieur : pied relevé (dorsiflexion)
    const toeRamp = ramp(t, 0.3 * tc, 0.7 * tc, tc - 0.02) * (1 - ramp(t, tFt, (tFt + T) / 2, T));
    const toe = K.toeDown * S.toe * toeRamp;
    // bassin : lacet côté frappeur à l'armé (droite = négatif), revient et passe au contact
    const pelvYaw = -16 * ramp(t, 0, 0.5 * tTopHip, tTopHip) + (16 + 12 * S.open) * ramp(t, tTopHip, tc - 0.02, tFt) + (-12 * S.open) * ramp(t, tFt, (tFt + T) / 2, T);
    // (le bassin : antéversion à l'armé — rx −, le haut du bassin part en avant, le dos se cambre —
    // puis rétroversion à travers le contact, qui participe à la flexion de hanche)
    const pelvTilt = -4 * ramp(t, 0, 0.5 * tTopHip, tTopHip) + (4 + 8) * ramp(t, tTopHip, tc, tFt) + (-8) * ramp(t, tFt, (tFt + T) / 2, T);
    const pelvRoll = S.hipRoll * bump(t, 0.3 * tc, tTopKnee, tc + 0.1);
    // tronc : arrière à l'armé (lean), avant à l'accompagnement ; contre-rotation ; latéral loin de la jambe
    // (rx + = le haut du corps part vers l'ARRIÈRE — sonde du profil : rx − sur Spine avance la tête)
    const lean = K.lean * S.lean * ramp(t, 0, 0.5 * tTopHip, tTopHip) + (-K.lean * S.lean - 14) * ramp(t, tTopHip, tc + 0.02, tFt) + (14) * ramp(t, tFt, (tFt + T) / 2, T);
    const trunkYaw = 10 * ramp(t, 0, 0.5 * tTopHip, tTopHip) + (-10 - K.open * S.open) * ramp(t, tTopHip, tc + 0.03, tFt) + (K.open * S.open) * ramp(t, tFt, (tFt + T) / 2, T);
    const side = S.sideLean * bump(t, tPlant, tc, T);
    // tête : SUR le ballon (bas, un peu à droite) jusqu'au contact, puis se relève vers la cible
    const head = K.headDown * S.headDown * ramp(t, 0, 0.5 * tPlant, tPlant) + (-K.headDown * S.headDown) * ramp(t, tc + 0.04, tc + 0.14, tFt + 0.1);
    const headYaw = -14 * ramp(t, 0, 0.5 * tPlant, tPlant) + 14 * ramp(t, tc + 0.04, tc + 0.14, tFt + 0.1);
    // bras d'équilibre (gauche) : monte pendant l'armé, tenu au contact, redescend ; bras droit recule
    // (un geste court — la feinte, 0,4 s — n'a pas le temps de redescendre un bras levé haut sans
    // dépasser le plafond des bras (14 rad/s, checkClip) : le bras monte MOINS, jamais plus vite)
    const armAmp = Math.min(1, (T - tc - 0.06) / 0.18);
    const armUp = armAmp * ramp(t, 0.1 * tc, 0.55 * tc, tc - 0.02) * (1 - ramp(t, tc + 0.06, (tc + 0.06 + T) / 2, T));
    const armR = ramp(t, 0.1 * tc, 0.55 * tc, tc) * (1 - ramp(t, tc + 0.02, (tc + T) / 2, T));
    // le bassin voyage : s'assied derrière et sur l'appui, descend, puis passe au-dessus et remonte
    const dip = K.dip * S.dip;
    // (le bassin reste ASSIS derrière l'appui jusqu'au contact — le ballon est devant le corps, la
    // stance à portée du jeu — et le transfert de poids se finit dans l'accompagnement)
    const hipsFwd = -K.sitBack * ramp(t, 0, 0.5 * tTopHip, tTopHip) + (K.sitBack + 0.04) * ramp(t, tc - 0.06, tc + 0.05, tFt) + (-0.04) * ramp(t, tFt, (tFt + T) / 2, T);
    const hipsUp = -dip * ramp(t, 0, 0.5 * tPlant, tTopKnee) + (dip * 0.55) * ramp(t, tTopKnee, tc, tFt) + (dip * 0.45) * ramp(t, tFt, (tFt + T) / 2, T);
    const hipsRight = -0.06 * S.stance * ramp(t, 0, 0.5 * tPlant, tPlant) + 0.03 * ramp(t, tTopHip, tc, tFt) + 0.03 * S.stance * ramp(t, tFt, (tFt + T) / 2, T);
    return { hipFlex, knee, abd, turn, toe, toeRamp, pelvYaw, pelvTilt, pelvRoll, lean, trunkYaw, side, head, headYaw, armUp, armR, hips: [hipsRight, hipsUp, hipsFwd] };
  };

  const poseAt = (t) => {
    const c = cv(t);
    const J = {};
    J.Hips = chain(rz(c.pelvRoll), rx(c.pelvTilt), ry(c.pelvYaw));
    // le tronc, réparti (lacet 25/35/40, inclinaison 35/35/30, latéral 40/35/25)
    const parts = [['Spine', 0.25, 0.35, 0.40], ['Spine1', 0.35, 0.35, 0.35], ['Spine2', 0.40, 0.30, 0.25]];
    for (const [b, wy, wl, ws] of parts) J[b] = chain(rz(c.side * ws), rx(c.lean * wl), ry(c.trunkYaw * wy));
    J.Neck = chain(rx(-c.head * 0.4), ry(c.headYaw * 0.4));
    J.Head = chain(rx(-c.head * 0.6), ry(c.headYaw * 0.6));
    // jambe frappeuse (droite) : DOF anatomiques
    J.RightUpLeg = chain(ry(-c.turn), rz(c.abd), rx(c.hipFlex));
    J.RightLeg = rx(-c.knee);
    J.RightFoot = inside ? chain(rz(8 * c.toeRamp), rx(-c.toe)) : rx(-c.toe);   // intérieur : légère éversion, la surface se présente
    J.RightToeBase = [0, 0, 0, 1];
    // bras : le gauche équilibre (haut, devant-latéral, coude plié), le droit recule
    const n = neutralJoints();
    const L1 = armJoints('Left', { elev: 14 + (K.armElev * S.armElev - 14) * c.armUp, fwd: 6 + (K.armFwd * S.armFwd - 6) * c.armUp, elbow: 14 + (S.elbow - 14) * c.armUp });
    const R1 = armJoints('Right', { elev: 14 + 6 * c.armR, fwd: 6 - (S.swingArm + 6) * c.armR, elbow: 14 + 26 * c.armR });
    Object.assign(J, n, L1, R1);
    J.LeftShoulder = [0, 0, 0, 1]; J.RightShoulder = [0, 0, 0, 1];
    return { J, hips: c.hips, c };
  };

  // ---- le DÉGAGEMENT DU SOL : la pointe du pied frappeur frôle la pelouse sans la traverser. Le
  // corps se hausse sur l'appui de ce qu'il faut (mesuré en FK sur une première passe) — c'est ce
  // que fait un vrai frappeur, qui monte sur la pointe de l'appui pendant le swing.
  let lift = 0;
  for (let pass = 0; pass < 2; pass++) {
    let deficit = 0;
    for (let t = 0.5 * tTopKnee; t <= tFt; t += 1 / 120) {
      const { J, hips } = poseAt(t);
      const w = fkPose(P, { Hips: jointToSpec(P, 'Hips', J.Hips), RightUpLeg: jointToSpec(P, 'RightUpLeg', J.RightUpLeg), RightLeg: jointToSpec(P, 'RightLeg', J.RightLeg), RightFoot: jointToSpec(P, 'RightFoot', J.RightFoot) }, [hips[0], hips[1] + lift * bump(t, 0.3 * tTopKnee, tc, tFt + 0.05), hips[2]]);
      deficit = Math.max(deficit, P.lengths.groundY - 0.005 - Math.min(w.RightToeBase.p[1], w.RightFoot.p[1] - 0.04));
    }
    if (deficit <= 0) break;
    lift += deficit;
  }
  const liftAt = (t) => lift * bump(t, 0.3 * tTopKnee, tc, tFt + 0.05);

  // ---- l'échantillonnage : jambe d'appui par IK sur le bassin réel de chaque image ----
  const keys = [];
  const n = Math.round(T * fps);
  const times = [];
  for (let i = 0; i <= n; i++) times.push(i === n ? T : i / fps);
  if (!times.some((t) => Math.abs(t - tc) < 1e-6)) times.push(tc);   // la clé de CONTACT existe (bancs, miroir)
  times.sort((a, b) => a - b);
  for (const t of times) {
    const { J, hips: hips0 } = poseAt(t);
    const hips = [hips0[0], hips0[1] + liftAt(t), hips0[2]];
    // la hanche gauche après la pose du bassin (FK partielle : Hips seul)
    const partial = fkPose(P, { Hips: jointToSpec(P, 'Hips', J.Hips) }, hips);
    const hipL = partial.LeftUpLeg.p;
    const ik = legIK(P, 'Left', hipL, J.Hips, leftFootRest);
    J.LeftUpLeg = ik.Rthigh; J.LeftLeg = ik.Rshank;
    // le pied d'appui reste À PLAT : on annule la rotation cumulée cuisse+tibia sur la cheville
    // (orientation monde du pied = bind), puis on l'étend légèrement au contact (poussée)
    const legW = quatMul(quatMul(J.Hips, ik.Rthigh), ik.Rshank);
    J.LeftFoot = quatNormalize(quatConjugate(legW));
    J.LeftToeBase = [0, 0, 0, 1];
    const pose = {};
    for (const [bone, R] of Object.entries(J)) {
      const q = jointToSpec(P, bone, R);
      if (q) pose[bone] = quatToEulerXYZ(q).map((v) => Math.round(v * 100) / 100);
    }
    keys.push({ t: Math.round(t * 10000) / 10000, pose, hips: hips.map((v) => Math.round(v * 1000) / 1000) });
  }
  return { name: kindName, duration: T, contact: tc, foot: 'right', generated: true, keys };
}

/**
 * LE PORTRAIT d'un spec généré, par FK (avec le canal hanches — la sémantique du jeu) : vitesse
 * du pied, pic, hauteur, direction, stance dérivée (S = cheville + 0,18 · direction de la
 * vitesse — la convention de approach/strike-warp), appui, mains, séquence proximo-distale.
 */
export function strikePortrait(spec, P, { foot = 'right' } = {}) {
  const F = foot === 'right' ? 'RightFoot' : 'LeftFoot', T = foot === 'right' ? 'RightToeBase' : 'LeftToeBase';
  const Fs = foot === 'right' ? 'LeftFoot' : 'RightFoot';
  const h = 1 / 240;
  const ground = P.lengths.groundY;
  const { tracks, hipsPos } = resolveDense(spec);
  const at = (t) => fkPose(P, sampleQ(tracks, t), sampleHips(hipsPos, t));
  const pts = [], toes = [], sup = [], hands = [], necks = [], elbows = [];
  const times = [];
  for (let t = 0; t <= spec.duration + 1e-9; t += h) {
    const w = at(t);
    times.push(t); pts.push(w[F].p); toes.push(w[T].p); sup.push(w[Fs].p);
    hands.push([w.LeftHand.p, w.RightHand.p]); necks.push(w.Neck.p);
    elbows.push([[w.LeftArm.p, w.LeftForeArm.p, w.LeftHand.p], [w.RightArm.p, w.RightForeArm.p, w.RightHand.p]]);
  }
  const speed = (i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]; return len(sub(b, a)) / (2 * h); };
  const iC = Math.round(spec.contact / h);
  let peak = 0, iPeak = 0;
  for (let i = 0; i < pts.length; i++) { const s = speed(i); if (s > peak) { peak = s; iPeak = i; } }
  const a = pts[Math.max(0, iC - 1)], b = pts[Math.min(pts.length - 1, iC + 1)];
  const v = vscale(sub(b, a), 1 / (2 * h));
  const vn = len(v) || 1;
  const c = pts[iC];
  const S = add(c, vscale(v, 0.18 / vn));
  // LA STANCE SE MESURE DEPUIS L'ORIGINE DU MODÈLE (la position sim que anchorFor place), pas depuis
  // l'os des hanches : le bassin VOYAGE (canal hanches) — mesurer depuis un os qui recule de 8 cm
  // au contact promet à la sim un ballon 8 cm trop près
  const fwd = -S[2], lat = S[0] * (foot === 'right' ? 1 : -1);
  const stance = { dist: hyp(fwd, lat), bearing: Math.atan2(lat, fwd) * R2D };
  // l'appui : plat et planté de tPlant à la fin de l'accompagnement
  let supDrift = 0, supLift = 0;
  const i0 = Math.round(0.45 * spec.contact / h), i1 = Math.min(pts.length - 1, Math.round((spec.contact + 0.15) / h));
  for (let i = i0; i <= i1; i++) { supDrift = Math.max(supDrift, hyp(sup[i][0] - sup[i0][0], sup[i][2] - sup[i0][2])); supLift = Math.max(supLift, Math.abs(sup[i][1] - sup[i0][1])); }
  // silhouette : mains sous le cou, coude vivant quand le bras est levé
  let worstHand = -Infinity, locked = 0, nElev = 0, lowest = Infinity;
  for (let i = 0; i < pts.length; i++) {
    for (let s = 0; s < 2; s++) {
      worstHand = Math.max(worstHand, hands[i][s][1] - necks[i][1]);
      const [sh, fo, ha] = elbows[i][s];
      const elev = Math.asin(clamp((ha[1] - sh[1]) / (len(sub(ha, sh)) || 1), -1, 1)) * R2D;
      if (elev > -40) { nElev++; const u = sub(sh, fo), w2 = sub(ha, fo); const ang = Math.acos(clamp(dot(u, w2) / ((len(u) * len(w2)) || 1), -1, 1)) * R2D; if (ang >= 155) locked++; }
    }
    lowest = Math.min(lowest, toes[i][1], pts[i][1], sup[i][1]);
  }
  // séquence proximo-distale sur les ANGLES d'articulation : pic de vitesse cuisse < pic genou
  const jointPeak = (bone) => { let best = 0, atT = 0; for (let i = 1; i < times.length; i++) { const q0 = sampleQ(tracks, times[i - 1])[bone], q1 = sampleQ(tracks, times[i])[bone]; if (!q0 || !q1) continue; const w = quatAngle(q0, q1) / h; if (w > best) { best = w; atT = times[i]; } } return { w: best, t: atT }; };
  const thighPk = jointPeak(foot === 'right' ? 'RightUpLeg' : 'LeftUpLeg'), kneePk = jointPeak(foot === 'right' ? 'RightLeg' : 'LeftLeg');
  const hipTrack = spec.keys.map((k) => k.pose[foot === 'right' ? 'RightUpLeg' : 'LeftUpLeg']?.[0]).filter((v) => typeof v === 'number');
  const hipMin = hipTrack.length ? Math.min(...hipTrack) : 0, hipMax = hipTrack.length ? Math.max(...hipTrack) : 0;
  const first = at(0), last = at(spec.duration);
  let endGap = 0;
  for (const bone of Object.keys(first)) endGap = Math.max(endGap, len(sub(first[bone].p, last[bone].p)));
  return {
    vContact: speed(iC), peak, tPeak: iPeak * h, vFwd: -v[2], height: c[1] - ground, ankleY: c[1],
    toeAxis: hyp(toes[iC][0] - c[0], toes[iC][2] - c[2]), stance, S,
    supDrift, supLift, worstHand, lockedFrac: nElev ? locked / nElev : 0, lowest: lowest - ground,
    thighPeak: thighPk, kneePeak: kneePk, endGap, hipMin, hipMax,
  };
}

/** Le contrat d'une frappe générée — les nombres du réel, sur le monde FK composé. */
export function checkStrikeGen(spec, P, kindName, { foot = 'right' } = {}) {
  const K = KINDS[kindName] || {};
  const issues = [];
  const p = strikePortrait(spec, P, { foot });
  if (K.feint) {
    // une feinte, c'est l'armé d'une frappe et un pied qui SE RETIENT : lent à l'heure du contact,
    // jamais à travers le ballon — et tout le reste du corps tient (appui, mains, retour)
    if (p.vContact > 12) issues.push(`la feinte frappe pour de vrai (pied ${p.vContact.toFixed(1)} m/s > 12 à l'heure du contact)`);
    if (p.supDrift > 0.03) issues.push(`l'appui GLISSE (${(p.supDrift * 100).toFixed(1)} cm)`);
    if (p.worstHand > 0.03) issues.push(`une main passe au-dessus du cou (+${(p.worstHand * 100).toFixed(0)} cm)`);
    if (p.lowest < -0.03) issues.push(`un pied passe sous la pelouse (${(p.lowest * 100).toFixed(0)} cm)`);
    if (p.endGap > 0.06) issues.push(`la pose finale n'est pas la pose initiale (écart ${(p.endGap * 100).toFixed(0)} cm)`);
    return { ok: issues.length === 0, issues, portrait: p };
  }
  const vMin = K.vFoot ? K.vFoot * 0.8 : 8;    // ±20 % : la technique d'un joueur est une note, pas une constante
  if (p.vContact < vMin) issues.push(`pied au contact ${p.vContact.toFixed(1)} m/s < ${vMin.toFixed(1)} (visé ${K.vFoot})`);
  if (p.vContact > 27) issues.push(`pied au contact ${p.vContact.toFixed(1)} m/s > 27 — au-delà de l'élite`);
  if (Math.abs(p.tPeak - spec.contact) > 0.035) issues.push(`pic de vitesse à t=${p.tPeak.toFixed(3)} hors du contact ${spec.contact} ± 0,035`);
  if (p.vFwd < 0.6 * p.vContact) issues.push(`le pied ne traverse pas vers l'avant (v_avant ${p.vFwd.toFixed(1)} < 60 % de ${p.vContact.toFixed(1)})`);
  if (p.height < 0.05 || p.height > 0.30) issues.push(`cheville au contact à ${(p.height * 100).toFixed(0)} cm du sol (attendu 5-30)`);
  if (p.toeAxis < 0.08) issues.push(`orientation du pied non écrite au contact (axe orteils horizontal ${(p.toeAxis * 100).toFixed(1)} cm < 8 — la clause du banc de swing)`);
  // les bornes articulaires de la hanche frappeuse (les mêmes que checkClip, en repère spec) : un armé
  // au-delà de −40° ou un accompagnement au-delà de 100° n'est plus une frappe, c'est un cancan
  if (p.hipMin < -40 || p.hipMax > 100) issues.push(`hanche frappeuse hors bornes (${p.hipMin.toFixed(0)}° … ${p.hipMax.toFixed(0)}°, attendu −40 … 100)`);
  if (p.supDrift > 0.03) issues.push(`l'appui GLISSE (${(p.supDrift * 100).toFixed(1)} cm) — le pied planté doit tenir`);
  if (p.supLift > 0.03) issues.push(`l'appui DÉCOLLE (${(p.supLift * 100).toFixed(1)} cm)`);
  if (p.worstHand > 0.03) issues.push(`une main passe au-dessus du cou (+${(p.worstHand * 100).toFixed(0)} cm)`);
  if (p.lockedFrac > 0.2) issues.push(`coude verrouillé bras levé sur ${(100 * p.lockedFrac).toFixed(0)} % des images (> 20)`);
  if (p.lowest < -0.03) issues.push(`un pied passe sous la pelouse (${(p.lowest * 100).toFixed(0)} cm)`);
  if (!(p.thighPeak.t < p.kneePeak.t)) issues.push(`séquence proximo-distale absente (pic cuisse t=${p.thighPeak.t.toFixed(3)}, genou t=${p.kneePeak.t.toFixed(3)})`);
  if (Math.abs(p.kneePeak.t - spec.contact) > 0.05) issues.push(`le pic du genou (t=${p.kneePeak.t.toFixed(3)}) n'est pas sur le contact (± 50 ms)`);
  if (p.kneePeak.w < 12) issues.push(`genou trop lent (${(p.kneePeak.w * R2D).toFixed(0)}°/s < 690)`);
  if (p.endGap > 0.06) issues.push(`la pose finale n'est pas la pose initiale (écart ${(p.endGap * 100).toFixed(0)} cm) — le fondu vers la locomotion sauterait`);
  return { ok: issues.length === 0, issues, portrait: p };
}

/** RÉGLER l'amplitude pour atteindre la vitesse de pied visée (bissection sur `amp`). */
export function solveStrike(kindName, P, { style = NEUTRAL_STYLE, fps = 60 } = {}) {
  const K = KINDS[kindName];
  if (K.feint) { const spec = generateStrike(kindName, P, { style, fps, amp: 1 }); return { spec, v: strikePortrait(spec, P).vContact, amp: 1 }; }
  let lo = 0.7, hi = 1.3, best = null;
  for (let i = 0; i < 14; i++) {
    const amp = (lo + hi) / 2;
    const spec = generateStrike(kindName, P, { style, fps, amp });
    const v = strikePortrait(spec, P).vContact;
    best = { spec, v, amp };
    if (Math.abs(v - K.vFoot) < 0.15) break;
    if (v < K.vFoot) lo = amp; else hi = amp;
  }
  return best;
}

// ---- échantillonnage dense d'un spec (mêmes lois que gesture-layer.samplePose / resolveTracks) ----
// (eulerToQuat est recopié d'animkit — importer animkit d'ici ferait un cycle animkit → animkit-data →
// motion-strike → animkit, et les MOVES générés se construisent PENDANT l'évaluation d'animkit-data)
function eulerToQuat([x, y, z]) {
  const c1 = Math.cos(x * D2R / 2), s1 = Math.sin(x * D2R / 2), c2 = Math.cos(y * D2R / 2), s2 = Math.sin(y * D2R / 2), c3 = Math.cos(z * D2R / 2), s3 = Math.sin(z * D2R / 2);
  return [s1 * c2 * c3 + c1 * s2 * s3, c1 * s2 * c3 - s1 * c2 * s3, c1 * c2 * s3 + s1 * s2 * c3, c1 * c2 * c3 - s1 * s2 * s3];
}
function resolveDense(spec) {
  const bones = new Set();
  for (const k of spec.keys) for (const b of Object.keys(k.pose)) bones.add(b);
  const tracks = {};
  for (const b of bones) tracks[b] = spec.keys.map((k) => ({ t: k.t, q: eulerToQuat(k.pose[b] || [0, 0, 0]) }));
  const hipsPos = spec.keys.some((k) => k.hips) ? spec.keys.map((k) => ({ t: k.t, p: k.hips || [0, 0, 0] })) : null;
  return { tracks, hipsPos };
}
const slerp = (a, b, u) => {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3], bb = b;
  if (d < 0) { d = -d; bb = [-b[0], -b[1], -b[2], -b[3]]; }
  if (d > 0.9995) return quatNormalize(a.map((x, i) => x + (bb[i] - x) * u));
  const th = Math.acos(Math.min(1, d)), s = Math.sin(th);
  const wa = Math.sin((1 - u) * th) / s, wb = Math.sin(u * th) / s;
  return [a[0] * wa + bb[0] * wb, a[1] * wa + bb[1] * wb, a[2] * wa + bb[2] * wb, a[3] * wa + bb[3] * wb];
};
function sampleQ(tracks, t) {
  const out = {};
  for (const [bone, ks] of Object.entries(tracks)) {
    if (t <= ks[0].t) { out[bone] = ks[0].q; continue; }
    if (t >= ks[ks.length - 1].t) { out[bone] = ks[ks.length - 1].q; continue; }
    let i = 1; while (ks[i].t < t) i++;
    out[bone] = slerp(ks[i - 1].q, ks[i].q, (t - ks[i - 1].t) / Math.max(1e-9, ks[i].t - ks[i - 1].t));
  }
  return out;
}
function sampleHips(ks, t) {
  if (!ks) return null;
  if (t <= ks[0].t) return ks[0].p;
  if (t >= ks[ks.length - 1].t) return ks[ks.length - 1].p;
  let i = 1; while (ks[i].t < t) i++;
  const a = ks[i - 1], b = ks[i], u = (t - a.t) / Math.max(1e-9, b.t - a.t);
  return [a.p[0] + (b.p[0] - a.p[0]) * u, a.p[1] + (b.p[1] - a.p[1]) * u, a.p[2] + (b.p[2] - a.p[2]) * u];
}
