// motion-aerial — LA TÊTE GÉNÉRÉE : un saut est une balistique, un coup de tête est un fouetté.
//
// Le saut de tête a trois vérités que le clip doit porter : (1) le corps PART DU SOL — il plie
// (bassin −14 cm, genoux ~48°) puis se détend, et le bassin suit une PARABOLE (apex au contact,
// retombée symétrique, ~0,28 s de vol de chaque côté pour 38 cm) ; (2) les jambes restent des
// jambes — en IK sur des cibles qui montent avec le corps (les pieds traînent derrière, les genoux
// gardent une flexion) et se replantent à l'atterrissage, qui absorbe ; (3) le coup de tête
// S'ARME en montant (buste cambré, cou en extension, bras levés) et FRAPPE à l'apex (buste et cou
// fouettent vers l'avant, les bras redescendent) — c'est le cou qui joue le ballon, pas le saut.
// La tête DEBOUT est le même fouetté sans le saut : haut du corps seul (la locomotion garde les
// jambes — verify-gestes l'exige), un fouetté court.
//
// Même machine que motion-strike (rampes C¹, articulations conjuguées, emitSpec, style par joueur).

import { rx, ry, rz, chain } from './motion-rig.js';
import { ramp, bump, emitSpec, armJoints, neutralJoints, bodyPortrait, bodyIssues, NEUTRAL_STYLE } from './motion-strike.js';
import { hyp } from './hyp.js';

export const AERIAL_KINDS = {
  tete:       { duration: 0.9,  contact: 0.42, crouch: 0.14, dip: 0.14, apex: 0.38, whipBack: 16, whipFwd: 34, trunkBack: 14, trunkFwd: 16, armsUp: 96, trail: 0.10 },
  teteDebout: { duration: 0.55, contact: 0.22, upperOnly: true, whipBack: 18, whipFwd: 34, trunkBack: 12, trunkFwd: 14, dip: 0.02 },
};

function trunkJoints(J, { lean = 0, headPitch = 0 }) {
  for (const [b, wl] of [['Spine', 0.35], ['Spine1', 0.35], ['Spine2', 0.30]]) J[b] = rx(lean * wl);
  J.Neck = rx(-headPitch * 0.25);
  J.Head = rx(-headPitch * 0.75);
}

/** GÉNÉRER une tête (symétrique — pas de miroir nécessaire). */
export function generateAerial(kindName, P, { style = NEUTRAL_STYLE, fps = 60 } = {}) {
  const K = AERIAL_KINDS[kindName];
  if (!K) throw new Error(`motion-aerial : espèce inconnue « ${kindName} »`);
  const S = { ...NEUTRAL_STYLE, ...style };
  const tc = K.contact, T = K.duration;
  const leftRest = P.bones.LeftFoot.bindP, rightRest = P.bones.RightFoot.bindP;
  if (K.upperOnly) {
    // LA TÊTE DEBOUT : le haut du corps seul — le buste et le cou s'arment en arrière puis fouettent
    const poseAt = (t) => {
      const arm = ramp(t, 0, 0.5 * tc * 0.5, 0.5 * tc), whip = ramp(t, 0.5 * tc, tc - 0.02, tc), settle = ramp(t, tc + 0.05, (tc + 0.05 + T) / 2, T);
      const lean = K.trunkBack * S.lean * arm + (-K.trunkFwd - K.trunkBack * S.lean) * whip + K.trunkFwd * settle;
      const headPitch = -K.whipBack * arm + (K.whipFwd * S.headDown + K.whipBack) * whip + (-K.whipFwd * S.headDown) * settle;
      const J = {};
      trunkJoints(J, { lean, headPitch });
      const up = arm * (1 - settle);
      Object.assign(J, neutralJoints(), armJoints('Left', { elev: 14 + 26 * up, fwd: 6 + 14 * up, elbow: 14 + 24 * up }), armJoints('Right', { elev: 14 + 26 * up, fwd: 6 + 14 * up, elbow: 14 + 24 * up }));
      J.LeftShoulder = [0, 0, 0, 1]; J.RightShoulder = [0, 0, 0, 1];
      const hips = [0, -K.dip * arm + (K.dip + 0.01) * whip - 0.01 * settle, 0];
      return { J, hips };
    };
    const keys = emitSpec(P, { duration: T, contact: tc, fps, poseAt });
    return { name: kindName, duration: T, contact: tc, foot: 'none', generated: true, family: 'aerial', keys };
  }
  // LE SAUT : bassin balistique, jambes en IK sur des cibles qui montent, fouetté à l'apex
  const tCr = K.crouch, tLand = Math.min(T - 0.12, tc + (tc - tCr)), dip = K.dip * S.dip, apex = K.apex * (0.9 + 0.2 * S.follow);
  const hipsY = (t) => {
    if (t <= tCr) return -dip * ramp(t, 0, 0.6 * tCr, tCr);
    if (t <= tLand) { const u = (t - tc) / (tc - tCr); return apex - (apex + dip) * u * u; }
    return -dip + dip * ramp(t, tLand, (tLand + T) / 2, T);
  };
  const poseAt = (t) => {
    const y = hipsY(t);
    const flight = t > tCr && t < tLand ? 1 : 0;
    // le fouetté : cambré en montant (jusqu'à ~70 % de la montée), frappe à l'apex, retour
    const arm = ramp(t, 0, 0.55 * tc, 0.72 * tc), whip = ramp(t, 0.72 * tc, tc - 0.02, tc + 0.01), settle = ramp(t, tc + 0.06, tLand, T);
    const lean = -18 * ramp(t, 0, 0.6 * tCr, tCr) * (1 - arm) + (K.trunkBack * S.lean) * arm + (-K.trunkFwd - K.trunkBack * S.lean) * whip + K.trunkFwd * settle;
    const headPitch = -K.whipBack * arm + (K.whipFwd * S.headDown + K.whipBack) * whip + (-K.whipFwd * S.headDown) * settle;
    const J = {};
    J.Hips = rx(4 * ramp(t, 0, 0.6 * tCr, tCr) * (1 - arm));
    trunkJoints(J, { lean, headPitch });
    // les bras : montent avec le saut (au-dessus de l'horizontale), redescendent en frappant
    const up = arm * (1 - whip * 0.45) * (1 - settle);
    const elev = 14 + (K.armsUp * S.armElev - 14) * up;
    Object.assign(J, neutralJoints(), armJoints('Left', { elev, fwd: 6 + 20 * up, elbow: 14 + 16 * up }), armJoints('Right', { elev, fwd: 6 + 20 * up, elbow: 14 + 16 * up }));
    J.LeftShoulder = [0, 0, 0, 1]; J.RightShoulder = [0, 0, 0, 1];
    return { J, hips: [0, y, 0], flight, y };
  };
  // les pieds : plantés au sol jusqu'au décollage et après l'atterrissage ; en vol ils MONTENT avec
  // le corps (85 % de la montée du bassin — les genoux gardent une flexion) et traînent derrière
  const ik = (t) => {
    const y = hipsY(t);
    const flying = t > tCr && t < tLand;
    const rise = flying ? Math.max(0, y + dip) * 0.85 : 0;
    const trail = flying ? K.trail * bump(t, tCr, tc, tLand) : 0;
    return { Left: [leftRest[0], leftRest[1] + rise, leftRest[2] + trail], Right: [rightRest[0], rightRest[1] + rise, rightRest[2] + trail] };
  };
  const keys = emitSpec(P, { duration: T, contact: tc, fps, poseAt, ik });
  return { name: kindName, duration: T, contact: tc, foot: 'none', generated: true, family: 'aerial', keys };
}

/** Le portrait : apex, impulsion, appuis avant/après, fouetté de la tête. */
export function aerialPortrait(spec, P) {
  const K = AERIAL_KINDS[spec.name] || {};
  const body = bodyPortrait(spec, P, { support: null });
  const hipsAt = (t) => { const k = spec.keys.reduce((b, x) => (x.t <= t + 1e-9 ? x : b), spec.keys[0]); return k.hips || [0, 0, 0]; };
  const kC = spec.keys.find((k) => Math.abs(k.t - spec.contact) < 1e-6);
  const apex = kC?.hips?.[1] ?? 0;
  const crouch = spec.keys.reduce((m, k) => Math.min(m, k.hips?.[1] ?? 0), 0);
  const kCrouch = spec.keys.find((k) => (k.hips?.[1] ?? 0) <= -0.1);
  const kneeAtCrouch = kCrouch?.pose?.LeftLeg?.[0] ?? 0;
  const headC = kC?.pose?.Head?.[0] ?? 0;
  const headBackMin = spec.keys.filter((k) => k.t < spec.contact).reduce((m, k) => Math.min(m, k.pose.Head?.[0] ?? 0), Infinity);
  // les pieds plantés tant que le corps est au sol (bassin ≥ −dip + 1 cm avant le décollage)
  let feetGroundDrift = 0;
  const f0 = body.samples[0].w;
  for (const { t, w } of body.samples) {
    if (t <= (K.crouch ?? 0) || t >= spec.duration - 0.05) for (const F of ['LeftFoot', 'RightFoot']) feetGroundDrift = Math.max(feetGroundDrift, hyp(w[F].p[0] - f0[F].p[0], w[F].p[1] - f0[F].p[1], w[F].p[2] - f0[F].p[2]));
  }
  const legKeys = spec.keys.some((k) => k.pose.LeftUpLeg || k.pose.RightUpLeg);
  return { ...body, apex, crouch, kneeAtCrouch, headC, headBackMin, feetGroundDrift, legKeys, hipsAt };
}

/** Le contrat d'une tête. */
export function checkAerialGen(spec, P, kindName) {
  const K = AERIAL_KINDS[kindName] || {};
  const p = aerialPortrait(spec, P);
  const issues = [];
  // le saut a le droit de lever les mains au-dessus du cou : on ne lit du corps commun que le sol,
  // le coude et le retour
  if (p.lockedFrac > 0.2) issues.push(`coude verrouillé bras levé sur ${(100 * p.lockedFrac).toFixed(0)} % des images (> 20)`);
  if (p.lowest < -0.03) issues.push(`un pied passe sous la pelouse (${(p.lowest * 100).toFixed(0)} cm)`);
  if (p.endGap > 0.06) issues.push(`la pose finale n'est pas la pose initiale (écart ${(p.endGap * 100).toFixed(0)} cm)`);
  if (p.headC < 18) issues.push(`le cou ne joue pas le ballon (tête ${p.headC.toFixed(0)}° au contact < 18)`);
  if (p.headBackMin > -8) issues.push(`le fouetté ne s'arme pas (tête ${p.headBackMin.toFixed(0)}° avant le contact > −8)`);
  if (K.upperOnly) {
    if (p.legKeys) issues.push('la tête debout écrit les jambes — la locomotion doit les garder');
    if (Math.abs(p.apex) > 0.05) issues.push(`la tête debout saute (bassin ${(p.apex * 100).toFixed(0)} cm)`);
  } else {
    if (p.apex < 0.3) issues.push(`le saut ne MONTE pas (bassin +${(p.apex * 100).toFixed(0)} cm au contact < 30)`);
    if (p.crouch > -0.1 || p.kneeAtCrouch > -40) issues.push(`l'impulsion ne PLIE pas (bassin ${(p.crouch * 100).toFixed(0)} cm, genou ${p.kneeAtCrouch.toFixed(0)}°)`);
    if (p.feetGroundDrift > 0.03) issues.push(`les pieds bougent au sol avant le décollage / après l'atterrissage (${(p.feetGroundDrift * 100).toFixed(1)} cm)`);
  }
  return { ok: issues.length === 0, issues, portrait: p };
}
