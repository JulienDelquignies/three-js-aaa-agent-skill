// motion-restart — LES REMISES À LA MAIN (lot A9) : la touche, le roulé du gardien, le ramassage au sol.
//
// Mesuré avant (match11, graine 7, t = 172 s) : la touche était JOUÉE AU PIED depuis la ligne, ballon
// au sol, aucun geste ; la relance à la main du gardien (événement 'relance-main') dessinait une
// passe du pied ; la prise d'un ballon qui roule tendait deux bras vers le sol depuis un corps debout
// (le warp de prise, sans corps qui se baisse).
//
// Trois espèces générées avec la méthode des gestes (reference/51) — courbes articulaires + IK — et
// pour la première fois une IK DE BRAS (armIK, jumelle de legIK : deux os, plan du coude choisi) :
//   touche      les deux mains portent le ballon devant la poitrine, montent derrière la tête (le
//               tronc s'arque), le fouetté du tronc les ramène par-dessus la tête, LÂCHER au contact
//               (mains à 2,05 m, devant le front), accompagnement vers le bas. Appuis décalés, plantés
//               (Loi 15 : les deux pieds au sol).
//   rouleMain   le gardien lâche un ballon ROULÉ à deux mains par en dessous : fente avant, tronc
//               penché, les mains descendent derrière la hanche puis balaient vers l'avant bas,
//               lâcher à hauteur de genou (le ballon part au sol, comme la sim le lance).
//   ramassage   le gardien qui cueille un ballon qui roule : il se baisse (fente, tronc à 60°), les
//               deux mains cuillèrent au sol devant lui (contact), et il se relève ballon à la poitrine.
// Le ballon vit DANS LES MAINS : la scène le dessine au point médian des poignets pendant la tenue
// (hold, _holdHands) et la sim le lance de la hauteur des mains au contact (strike-sim : TOUCHE_H).
//
// Pur : aucune dépendance rendu. verify-remises.mjs porte le contrat et ses sabotages.

import { fkPose, jointsToSpec, rx } from './motion-rig.js';
import { emitSpec, ramp, neutralJoints, denseSampler } from './motion-strike.js';
import { twoBoneIK } from './procedural.js';
import { sub, add, norm, len, cross, dot, scale as vscale, quatMul, quatConjugate, quatNormalize, quatFromAxisAngle, applyQuat, clamp } from './vecmath.js';

const D2R = Math.PI / 180;

export const RESTART_KINDS = {
  touche: { duration: 1.15, contact: 0.62, ball: [0, 1.76, -0.22], hands: 'two', releaseH: 1.76,
    stagger: 0.30, hw: 0.14, knee: 14, arch: 20, whip: 30, follow: 30, back: 0.18, backH: 1.7, over: 0.22, reach: 0.08 },
  rouleMain: { duration: 1.05, contact: 0.52, ball: [0, 0.36, -0.45], hands: 'two', releaseH: 0.36,
    lunge: 0.5, hw: 0.12, lean: 60, dip: 0.38, backswing: 0.24, backH: 0.74, sweep: 0.45 },
  ramassage: { duration: 1.12, contact: 0.42, ball: [0, 0.11, -0.4], hands: 'two', releaseH: 0.2,
    lunge: 0.45, hw: 0.14, lean: 84, dip: 0.41, scoopZ: -0.36, chestZ: -0.28, chestY: 1.06 },
};
export const RESTART_NAMES = Object.keys(RESTART_KINDS);

// ---- petites primitives de rotation (repère personnage)
const quatFromTo = (a, b) => {
  const u = norm(a), v = norm(b), d = dot(u, v);
  if (d > 1 - 1e-9) return [0, 0, 0, 1];
  if (d < -1 + 1e-9) { const ax = Math.abs(u[0]) < 0.9 ? cross(u, [1, 0, 0]) : cross(u, [0, 1, 0]); return quatFromAxisAngle(norm(ax), Math.PI); }
  const c = cross(u, v); const s = Math.sqrt((1 + d) * 2);
  return quatNormalize([c[0] / s, c[1] / s, c[2] / s, s / 2]);
};
/** Un repère orthonormé (d, n, d × n) — la normale re-projetée hors de d. */
function frameOf(d, n) {
  const u = norm(d);
  const nn = norm(sub(n, vscale(u, dot(n, u))));
  return [u, nn, cross(u, nn)];
}
/** Quaternion d'une matrice de rotation donnée par ses colonnes (Shepperd — la branche la plus stable). */
function quatFromCols(c0, c1, c2) {
  const m00 = c0[0], m10 = c0[1], m20 = c0[2], m01 = c1[0], m11 = c1[1], m21 = c1[2], m02 = c2[0], m12 = c2[1], m22 = c2[2];
  const tr = m00 + m11 + m22;
  let q;
  if (tr > 0) { const S = Math.sqrt(tr + 1) * 2; q = [(m21 - m12) / S, (m02 - m20) / S, (m10 - m01) / S, 0.25 * S]; }
  else if (m00 > m11 && m00 > m22) { const S = Math.sqrt(1 + m00 - m11 - m22) * 2; q = [0.25 * S, (m01 + m10) / S, (m02 + m20) / S, (m21 - m12) / S]; }
  else if (m11 > m22) { const S = Math.sqrt(1 + m11 - m00 - m22) * 2; q = [(m01 + m10) / S, 0.25 * S, (m12 + m21) / S, (m02 - m20) / S]; }
  else { const S = Math.sqrt(1 + m22 - m00 - m11) * 2; q = [(m02 + m20) / S, (m12 + m21) / S, 0.25 * S, (m10 - m01) / S]; }
  return quatNormalize(q);
}
/** La rotation qui porte le repère (d0, n0) sur (d1, n1) : R = F1 · F0ᵀ — unique et continue tant que les repères le
 *  sont (le plus-court-arc + vrille d'hier sautait de 44° quand le bras se repliait sur lui-même). */
function alignFrame(d0, n0, d1, n1) {
  const F0 = frameOf(d0, n0), F1 = frameOf(d1, n1);
  // R = F1 · F0ᵀ : colonne j de R = Σ_k F1[k] · F0[k][j]
  const col = (j) => [0, 1, 2].map((i) => F1[0][i] * F0[0][j] + F1[1][i] * F0[1][j] + F1[2][i] * F0[2][j]);
  return quatFromCols(col(0), col(1), col(2));
}
void quatFromTo; void applyQuat; void quatFromAxisAngle; void clamp;

/**
 * L'IK DE BRAS — jumelle de legIK : le poignet à `wrist` (repère personnage), le coude dans le plan
 * choisi par `pole` (direction du coude depuis la ligne épaule→poignet). `shoulderW` : la position de
 * l'articulation Arm de l'instant, `Rpar` : la rotation cumulée des parents (bassin → clavicule).
 * @returns { Rarm, Rfore, elbow, reachable }
 */
export function armIK(P, side, shoulderW, Rpar, wrist, pole) {
  const up = P.bones[`${side}Arm`], fo = P.bones[`${side}ForeArm`], ha = P.bones[`${side}Hand`];
  const L = P.lengths;
  const ik = twoBoneIK(shoulderW, wrist, L.upperArm, L.foreArm, pole);
  const d1 = norm(sub(ik.mid, shoulderW)), s1 = norm(sub(ik.end, ik.mid));
  const dir = norm(sub(wrist, shoulderW));
  // la normale du plan du coude vient du PÔLE (l'IK déplace le coude vers lui : cross(d1, s1) ∥ cross(pôle, dir)) —
  // lue sur la géométrie elle SAUTAIT de signe quand le bras se tendait (187 rad/s de vrille mesurés)
  const pN = cross(pole, dir);
  const n1 = norm(len(pN) > 0.05 ? pN : cross(d1, s1));
  const d0 = norm(sub(fo.bindP, up.bindP)), s0 = norm(sub(ha.bindP, fo.bindP));
  const n0 = norm(cross(d0, [0, 0, -1]));                  // au bind le coude plie vers l'avant
  const armW = alignFrame(d0, n0, d1, n1);
  const foreW = alignFrame(s0, n0, s1, n1);
  const Rarm = quatNormalize(quatMul(quatConjugate(Rpar), armW));
  const Rfore = quatNormalize(quatMul(quatConjugate(armW), foreW));
  return { Rarm, Rfore, elbow: ik.mid, reachable: ik.reachable };
}

const mulAll = (...qs) => qs.reduce((acc, q) => quatMul(acc, q));   // parent ⊗ … ⊗ enfant

/** Résoudre les deux bras vers deux poignets, sur le tronc posé de l'instant. */
function armsTo(P, J, hips, wrists, poles) {
  const spec = jointsToSpec(P, J);
  const partial = fkPose(P, spec, hips);
  for (const side of ['Left', 'Right']) {
    const w = wrists[side]; if (!w) continue;
    const Rpar = mulAll(J.Hips || [0, 0, 0, 1], J.Spine || [0, 0, 0, 1], J.Spine1 || [0, 0, 0, 1], J.Spine2 || [0, 0, 0, 1], J[`${side}Shoulder`] || [0, 0, 0, 1]);
    const r = armIK(P, side, partial[`${side}Arm`].p, Rpar, w, poles[side] || [side === 'Left' ? -1 : 1, -0.3, 0]);
    J[`${side}Arm`] = r.Rarm; J[`${side}ForeArm`] = r.Rfore;
    J[`${side}Hand`] = [0, 0, 0, 1];
  }
  return J;
}

// ---- LES GÉNÉRATEURS
const lerp = (a, b, t) => a + (b - a) * t;
const v3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** LA TOUCHE. Le ballon tenu à deux mains ; les poignets encadrent le ballon (±grip sur X). */
function generateTouche(P, { style }) {
  const K = RESTART_KINDS.touche;
  const T = K.duration, tc = K.contact, ankleY = P.bones.LeftFoot.bindP[1], groundY = P.lengths.groundY;
  const grip = 0.16;
  const s = style;
  const archA = K.arch * s.lean, whipA = K.whip * s.follow, followA = K.follow * s.follow;
  const poseAt = (t) => {
    // le tronc : s'arque pendant l'armé (t 0 → 0,45), fouette au contact, accompagne
    const arm = ramp(t, 0.02, 0.24, 0.42);                       // l'armé : bras derrière la tête, tronc arqué
    const whip = ramp(t, 0.42, 0.54, tc + 0.02);                 // le fouetté (arrive au contact)
    const fol = ramp(t, tc, tc + 0.18, T);                       // l'accompagnement
    const trunk = archA * arm - (archA + whipA) * whip - followA * 0.6 * fol;   // + = en arrière
    const dip = 0.02 * arm * (1 - fol) + 0.05 * whip * (1 - fol);
    const hips = [0, -0.02 - dip, -K.reach * whip];                  // le bassin avance un peu au lâcher (les appuis restent plantés, décalés : 2 cm de garde)
    const J = { ...neutralJoints() };
    J.Hips = rx(trunk * 0.35);
    J.Spine = rx(trunk * 0.3); J.Spine1 = rx(trunk * 0.2); J.Spine2 = rx(trunk * 0.15);
    J.Neck = rx(-trunk * 0.25); J.Head = rx(-trunk * 0.25 - 8 * whip);   // le regard suit le ballon
    // les mains : devant la poitrine → derrière la tête → par-dessus, lâcher devant le front → bas devant
    const chest = [0, 1.42, -0.30], back = [0, K.backH, K.back], top = [0, K.releaseH, -K.over], down = [0, 1.2, -0.55];   // le ballon est déjà au front : l'armé est court
    let c;
    if (t < 0.42) c = v3(chest, back, ramp(t, 0.02, 0.24, 0.42));
    else if (t < tc) { const u = ramp(t, 0.42, 0.54, tc); c = v3(back, top, u); c[1] = lerp(back[1], top[1], u) + 0.06 * Math.sin(Math.PI * u); }
    else { const u = ramp(t, tc, tc + 0.2, T); c = v3(top, down, u); }
    const spread = 1 + 0.6 * ramp(t, tc, tc + 0.05, tc + 0.12);   // les mains s'ouvrent APRÈS le lâcher (la clé de contact tient encore le ballon)
    const wrists = { Left: [c[0] - grip * spread, c[1], c[2]], Right: [c[0] + grip * spread, c[1], c[2]] };
    armsTo(P, J, hips, wrists, { Left: [-0.6, 0.2, 0.6], Right: [0.6, 0.2, 0.6] });   // coudes dehors et derrière
    return { J, hips, c };
  };
  const ik = () => ({ Left: [-K.hw, ankleY, -K.stagger * 0.5], Right: [K.hw * 1.1, ankleY, K.stagger * 0.5] });   // appuis décalés, plantés
  const keys = emitSpec(P, { duration: T, contact: tc, poseAt: (t) => { const p = poseAt(t); return { J: p.J, hips: p.hips }; }, ik });
  void groundY;
  return { name: 'touche', duration: T, contact: tc, keys, hold: 'hands', release: tc };
}

/** LE ROULÉ DU GARDIEN, à deux mains par en dessous. */
function generateRouleMain(P, { style }) {
  const K = RESTART_KINDS.rouleMain;
  const T = K.duration, tc = K.contact, ankleY = P.bones.LeftFoot.bindP[1];
  const grip = 0.15;
  const leanA = K.lean;                                          // la portée du bras fixe la géométrie : pas de style ici
  void style;
  const poseAt = (t) => {
    const bend = ramp(t, 0, 0.14, 0.28);                         // il se penche en armant (l'épaule reste en arrière)
    const sweep = ramp(t, 0.28, 0.41, tc);                       // le balayage vers l'avant, le corps descend encore
    const up = ramp(t, tc + 0.05, tc + 0.3, T);                  // il se redresse
    const lean = leanA * (0.35 * bend + 0.65 * sweep) * (1 - up);
    const dip = K.dip * (0.35 * bend + 0.65 * sweep) * (1 - up);
    const hips = [0, -dip, -0.06 * sweep * (1 - up)];
    const J = { ...neutralJoints() };
    J.Hips = rx(-lean * 0.55);
    J.Spine = rx(-lean * 0.25); J.Spine1 = rx(-lean * 0.15); J.Spine2 = rx(-lean * 0.05);
    J.Neck = rx(lean * 0.3); J.Head = rx(lean * 0.3 - 6 * sweep);
    // les mains : à la hanche → derrière (l'armé bas) → balayage devant bas (lâcher) → devant, mains ouvertes
    const hip = [0.05, 0.9, -0.15], back = [0.08, K.backH, K.backswing], rel = [0, K.releaseH, -K.sweep], out = [0, 0.75, -0.65];
    let c;
    if (t < 0.28) c = v3(hip, back, ramp(t, 0, 0.14, 0.28));
    else if (t < tc) { const u = ramp(t, 0.28, 0.41, tc); c = v3(back, rel, u); c[1] = lerp(back[1], rel[1], u) - 0.05 * Math.sin(Math.PI * u); }
    else c = v3(rel, out, ramp(t, tc, tc + 0.15, T));
    const spread = 1 + 0.5 * ramp(t, tc, tc + 0.05, tc + 0.12);
    const wrists = { Left: [c[0] - grip * spread, c[1], c[2]], Right: [c[0] + grip * spread, c[1], c[2]] };
    armsTo(P, J, hips, wrists, { Left: [-0.7, 0.3, 0.3], Right: [0.7, 0.3, 0.3] });
    return { J, hips };
  };
  // la fente : le pied gauche devant (planté), le droit derrière ; le talon droit se lève au balayage
  const ik = (t) => {
    const sweep = ramp(t, 0.28, 0.41, tc), up = ramp(t, tc + 0.05, tc + 0.3, T);
    const heel = 22 * sweep * (1 - up);
    return { Left: [-K.hw, ankleY, -K.lunge * 0.55], Right: { p: [K.hw, ankleY + P.lengths.foot * Math.sin(heel * D2R), K.lunge * 0.45], foot: rx(-heel), pole: [0.1, 0, -1] } };
  };
  const keys = emitSpec(P, { duration: T, contact: tc, poseAt, ik });
  return { name: 'rouleMain', duration: T, contact: tc, keys, hold: 'hands', release: tc };
}

/** LE RAMASSAGE au sol : il se baisse, cuillère, se relève ballon à la poitrine. */
function generateRamassage(P, { style }) {
  const K = RESTART_KINDS.ramassage;
  const T = K.duration, tc = K.contact, ankleY = P.bones.LeftFoot.bindP[1];
  const grip = 0.15;
  const leanA = K.lean;
  void style;
  const poseAt = (t) => {
    const down = ramp(t, 0, 0.18, tc);                            // il descend jusqu'au contact
    const up = ramp(t, tc + 0.04, tc + 0.42, T);                  // il se relève
    const lean = leanA * down * (1 - up);
    const dip = K.dip * down * (1 - up);
    const hips = [0, -dip, -0.06 * down * (1 - up)];
    const J = { ...neutralJoints() };
    J.Hips = rx(-lean * 0.28);                                    // le bassin bascule peu : la hanche reste sous 130° dans l'accroupi
    J.Spine = rx(-lean * 0.38); J.Spine1 = rx(-lean * 0.24); J.Spine2 = rx(-lean * 0.1);
    J.Neck = rx(lean * 0.35); J.Head = rx(lean * 0.3);
    const hip = [0.05, 0.9, -0.15], floor = [0, K.releaseH, K.scoopZ], chest = [0, K.chestY, K.chestZ];
    let c;
    if (t < tc) c = v3(hip, floor, ramp(t, 0.02, 0.2, tc));
    else c = v3(floor, chest, ramp(t, tc + 0.04, tc + 0.42, T));
    const wrists = { Left: [c[0] - grip, c[1], c[2]], Right: [c[0] + grip, c[1], c[2]] };
    armsTo(P, J, hips, wrists, { Left: [-0.7, 0.2, 0.2], Right: [0.7, 0.2, 0.2] });
    return { J, hips };
  };
  const ik = (t) => {
    const down = ramp(t, 0, 0.18, tc), up = ramp(t, tc + 0.04, tc + 0.42, T);
    const heel = 30 * down * (1 - up);
    return { Left: [-K.hw, ankleY, -K.lunge * 0.55], Right: { p: [K.hw, ankleY + P.lengths.foot * Math.sin(heel * D2R), K.lunge * 0.4], foot: rx(-heel), pole: [0.1, 0, -1] } };
  };
  const keys = emitSpec(P, { duration: T, contact: tc, poseAt, ik });
  return { name: 'ramassage', duration: T, contact: tc, keys, hold: 'hands', catch: tc };
}

export const RESTART_GENERATORS = { touche: generateTouche, rouleMain: generateRouleMain, ramassage: generateRamassage };

const NEUTRAL = { lean: 1, follow: 1 };
export function generateRestart(kind, P, { style = null } = {}) {
  const st = { lean: style?.lean ?? 1, follow: style?.follow ?? 1 };
  // les × de style de frappe (lean 0,6-1,5, follow 0,85-1,12) sont trop larges pour un tronc qui s'arque : bornés
  st.lean = clamp(st.lean, 0.85, 1.2); st.follow = clamp(st.follow, 0.9, 1.1);
  return RESTART_GENERATORS[kind](P, { style: st });
}
void NEUTRAL;

/** LE PORTRAIT : mains, tête, bassin, pieds au fil du geste (FK dense). */
export function restartPortrait(spec, P) {
  const at = denseSampler(spec, P);
  const mid = (w) => [(w.LeftHand.p[0] + w.RightHand.p[0]) / 2, (w.LeftHand.p[1] + w.RightHand.p[1]) / 2, (w.LeftHand.p[2] + w.RightHand.p[2]) / 2];
  const wc = at(spec.contact), w0 = at(0), wT = at(spec.duration);
  const series = [];
  for (let i = 0; i <= 60; i++) { const t = (i / 60) * spec.duration; const w = at(t); series.push({ t, mid: mid(w), apart: len(sub(w.LeftHand.p, w.RightHand.p)), head: w.Head.p, pelvis: w.Hips.p, chest: w.Spine2.p, lf: w.LeftFoot.p, rf: w.RightFoot.p, lt: w.LeftToeBase.p, rt: w.RightToeBase.p, le: w.LeftForeArm.p, re: w.RightForeArm.p }); }
  return { midC: mid(wc), apartC: len(sub(wc.LeftHand.p, wc.RightHand.p)), head: wc.Head.p, pelvisC: wc.Hips.p, pelvis0: w0.Hips.p, chestC: wc.Spine2.p, mid0: mid(w0), midT: mid(wT), series };
}

/**
 * LE CONTRAT des remises : le ballon est ENTRE les mains jusqu'au lâcher (écart ≈ diamètre), au bon
 * endroit au contact (la touche au-dessus du front, le roulé au genou devant, le ramassage au sol
 * devant), les deux pieds au sol pour la touche (Loi 15), le tronc qui s'arque puis fouette, rien sous
 * la pelouse, retour debout à la fin.
 */
export function checkRestartGen(spec, P, kind) {
  const issues = [];
  const p = restartPortrait(spec, P);
  const K = RESTART_KINDS[kind];
  const ground = P.lengths.groundY;
  const apartOk = p.series.filter((s) => s.t <= spec.contact).every((s) => s.apart > 0.22 && s.apart < 0.42);
  if (!apartOk) issues.push('les mains ne tiennent pas le ballon (écart hors [22, 42] cm avant le lâcher)');
  for (const s of p.series) {
    if (Math.min(s.lt[1], s.rt[1], s.lf[1] - 0.02, s.rf[1] - 0.02) < ground - 0.015) { issues.push(`sous la pelouse à t=${s.t.toFixed(2)}`); break; }
  }
  if (kind === 'touche') {
    if (!(p.midC[1] > 1.75 && p.midC[1] < 2.1)) issues.push(`touche : lâcher à ${p.midC[1].toFixed(2)} m (attendu 1,75-2,1 — l'épaule de shanon à 1,43 + 0,49 de bras)`);
    if (!(p.midC[2] < p.head[2] - 0.05)) issues.push('touche : le lâcher n\'est pas DEVANT le front');
    const backMax = Math.max(...p.series.filter((s) => s.t < spec.contact).map((s) => s.mid[2]));
    if (!(backMax > p.head[2] + 0.12)) issues.push(`touche : les mains ne passent pas DERRIÈRE la tête (max ${backMax.toFixed(2)})`);
    const feetLow = p.series.every((s) => s.lf[1] < P.bones.LeftFoot.bindP[1] + 0.03 && s.rf[1] < P.bones.LeftFoot.bindP[1] + 0.03);
    if (!feetLow) issues.push('touche : un pied quitte le sol (Loi 15)');
    const arch = Math.max(...p.series.filter((s) => s.t < 0.5).map((s) => s.chest[2] - s.pelvis[2]));
    if (!(arch > 0.04)) issues.push(`touche : le tronc ne s'arque pas (${arch.toFixed(2)})`);
    if (!(p.chestC[2] - p.pelvisC[2] < -0.06)) issues.push('touche : le tronc ne fouette pas en avant au lâcher');
  }
  if (kind === 'rouleMain') {
    if (!(p.midC[1] < 0.5 && p.midC[1] > 0.2)) issues.push(`roulé : lâcher à ${p.midC[1].toFixed(2)} m (attendu 0,2-0,5)`);
    if (!(p.midC[2] < -0.4)) issues.push('roulé : le lâcher n\'est pas devant');
    const backMax = Math.max(...p.series.filter((s) => s.t < spec.contact).map((s) => s.mid[2]));
    if (!(backMax > 0.12)) issues.push(`roulé : pas d'armé derrière (max ${backMax.toFixed(2)})`);
    if (!(p.pelvisC[1] < p.pelvis0[1] - 0.08)) issues.push('roulé : le corps ne se baisse pas');
  }
  if (kind === 'ramassage') {
    if (!(p.midC[1] < 0.34)) issues.push(`ramassage : les mains cueillent à ${p.midC[1].toFixed(2)} m (attendu ≤ 0,34)`);
    if (!(p.midC[2] < -0.35)) issues.push('ramassage : les mains ne sont pas devant au sol');
    if (!(p.midT[1] > 0.95 && p.midT[2] < -0.15)) issues.push(`ramassage : le ballon ne finit pas à la poitrine (${p.midT.map((v) => v.toFixed(2))})`);
    if (!(p.pelvisC[1] < p.pelvis0[1] - 0.2)) issues.push('ramassage : le corps ne se baisse pas assez');
  }
  // retour debout : bassin à ≤ 4 cm de son départ à la fin
  const last = p.series[p.series.length - 1];
  if (Math.abs(last.pelvis[1] - p.pelvis0[1]) > 0.04) issues.push(`fin : bassin à ${((last.pelvis[1] - p.pelvis0[1]) * 100).toFixed(1)} cm du départ`);
  return { ok: issues.length === 0, issues, portrait: p };
}
