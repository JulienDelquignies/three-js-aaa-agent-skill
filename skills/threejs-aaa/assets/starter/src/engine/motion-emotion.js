// motion-emotion — L'ÉMOTION GÉNÉRÉE (lot A11) : la joie du buteur, l'accolade, l'applaudissement, la
// protestation — des gestes du HAUT DU CORPS qui se jouent EN COURANT ou debout (la scène laisse les
// jambes à la foulée : spec.upperOnly), et UNE glissade sur les genoux qui possède les jambes.
//
// Le sweep (« tu as d'autres animations à refaire ? ») : le buteur courait au coin les bras à
// l'horizontale — le clip du donneur, le dernier geste non généré qu'on voyait en match — seul, sans
// personne ; la fête n'avait ni corps ni tempérament. Ici, des fonctions pures du temps, choisies par
// la PERSONA (referee.js, cfg.fete : flair → glissade, oreille ; calm → calme ; burstiness → poing) :
//
//   poing       — le poing serré pompé deux fois devant l'épaule droite, en courant
//   brasLeves   — les deux bras au ciel en V, la tête en arrière, tenus
//   oreille     — arrêté face à la tribune : la main droite en cornet à l'oreille, la gauche sur la hanche
//   calme       — les deux mains levées paumes devant à hauteur d'épaule, la tête basse (le buteur qui s'excuse)
//   glissade    — la GLISSADE SUR LES GENOUX : le corps descend sur les genoux (pieds derrière, pointes au sol),
//                 le buste cambré, les bras ouverts ; la pose tenue VIT (les bras montent en V et reviennent) ;
//                 le relevé : un pied devant, debout. La sim porte le corps (movement._glisse) et le tient
//                 au sol (down) ; la scène tient la pose et relève à l'heure sim (rondo-contact.contactClock)
//   accolade    — les deux bras qui enveloppent devant, le buste penché, la tête sur l'épaule
//   applaudir   — trois claquements des mains devant la poitrine
//   proteste    — les avant-bras qui s'ouvrent paumes vers le ciel, les épaules qui montent, la tête qui dit non
//
// Même machine que les autres familles : rampes C¹, armJoints, emitSpec, style par joueur (l'amplitude
// des bras suit armElev — donc le port de bras de la persona, motion-cast). Côté DROIT.

import { rx, ry, rz, chain } from './motion-rig.js';
import { ramp, bump, emitSpec, armJoints, bodyPortrait, NEUTRAL_STYLE } from './motion-strike.js';
import { legIK2, hipJoint } from './motion-contact.js';
import { quatMul, quatConjugate, quatNormalize } from './vecmath.js';

export const EMOTION_KINDS = {
  poing:      { duration: 1.5, contact: 0.44, upperOnly: true, pumps: [0.44, 0.92], elev: 20, fwd: 112, elbow: 100 },
  brasLeves:  { duration: 1.9, contact: 0.48, upperOnly: true, hold: 1.3, elev: 154, fwd: 12, headUp: 16 },
  oreille:    { duration: 2.4, contact: 0.50, upperOnly: true, hold: 1.9, elev: 135, fwd: 60, elbow: 155, rot: 0, yaw: 22 },
  calme:      { duration: 2.0, contact: 0.40, upperOnly: true, hold: 1.5, elev: 52, fwd: 64, elbow: 82, headDown: 12 },
  glissade:   { duration: 2.0, contact: 0.45, lying: 0.55, rise: 1.35, ownsLegs: true, kneel: 0.06, back: 0.40, arms: 74, armsUp: 138, lean: -12, vie: 1 },
  // (A10 quater) LA MAIN TENDUE au fauché qui se relève : le buste se penche, le bras droit se tend devant et bas, la main offerte
  mainTendue: { duration: 1.4, contact: 0.5, hold: 0.65, pull: 0.5, fwdPull: 10, elbowPull: 62, upperOnly: true, lean: 26, elev: 8, fwd: 64, elbow: 8, headDown: 10 },   // (C2) hold puis TIRE : le bras revient (fwd → fwdPull, le coude plie), le buste se redresse — le fauché se relève à la main
  // (A9 ter) LE MUR QUI SAUTE : accroupi, détente, les deux pieds décollés au sommet (contact), les mains croisées devant le bas-ventre, réception
  sautMur:    { duration: 0.78, contact: 0.34, ownsLegs: true, saut: true, crouch: 0.11, h: 0.36, tuck: 0.22, elev: -26, fwd: 22, elbow: 32, lean: 4 },   // elev < 0 : les bras se croisent devant le bas-ventre (mesuré : mains à 5 cm l'une de l'autre, +16 cm au-dessus du bassin, 18 cm devant)
  accolade:   { duration: 1.5, contact: 0.35, upperOnly: true, hold: 1.0, elev: -14, fwd: 80, elbow: 62, lean: 10, rot: -10 },
  applaudir:  { duration: 1.2, contact: 0.20, upperOnly: true, claps: 3, elev: 22, fwd: 62, elbow: 92 },
  proteste:   { duration: 1.6, contact: 0.35, upperOnly: true, hold: 1.2, elev: 42, fwd: 28, elbow: 72, shrug: 9, shake: 14 },
};
export const EMOTION_NAMES = Object.keys(EMOTION_KINDS);

const I = [0, 0, 0, 1];
/** le tronc réparti : penché (lean, + = avant), tourné (yaw), la tête (pitch + = relevée, yaw) */
function trunk(J, { lean = 0, yaw = 0, side = 0, headPitch = 0, headYaw = 0 }) {
  for (const [b, wy, wl, ws] of [['Spine', 0.25, 0.35, 0.40], ['Spine1', 0.35, 0.35, 0.35], ['Spine2', 0.40, 0.30, 0.25]]) J[b] = chain(rz(-side * ws), rx(-lean * wl), ry(yaw * wy));
  J.Neck = chain(rx(headPitch * 0.4), ry(headYaw * 0.4));
  J.Head = chain(rx(headPitch * 0.6), ry(headYaw * 0.6));
  J.LeftShoulder = I; J.RightShoulder = I;
}
const NEUTRAL_ARM = { elev: 14, fwd: 6, elbow: 14 };
const mix = (a, b, u) => a + (b - a) * u;
const armAt = (side, from, to, u) => armJoints(side, { elev: mix(from.elev, to.elev, u), fwd: mix(from.fwd, to.fwd, u), elbow: mix(from.elbow, to.elbow, u), rot: mix(from.rot ?? 0, to.rot ?? 0, u) });

/** GÉNÉRER un geste d'émotion (côté DROIT ; le miroir d'animkit fait la gauche). */
export function generateEmotion(kindName, P, { style = NEUTRAL_STYLE } = {}) {
  const K = EMOTION_KINDS[kindName];
  if (!K) throw new Error(`motion-emotion : espèce inconnue « ${kindName} »`);
  const S = { ...NEUTRAL_STYLE, ...style };
  const A = Math.max(0.85, Math.min(1.15, S.armElev ?? 1));   // l'amplitude des bras : un accent, pas une géométrie
  const T = K.duration, tc = K.contact;
  const restL = P.bones.LeftFoot.bindP, restR = P.bones.RightFoot.bindP, ground = P.lengths.groundY;
  let poseAt, ik = () => ({}), marks = [];
  if (kindName === 'poing') {
    const [p1, p2] = K.pumps;
    const up = (t) => Math.max(bump(t, p1 - 0.30, p1, p1 + 0.24), bump(t, p2 - 0.24, p2, p2 + 0.32));
    const armed = (t) => ramp(t, 0, 0.18, 0.34) * (1 - ramp(t, p2 + 0.2, (p2 + 0.2 + T) / 2, T));
    poseAt = (t) => {
      const u = up(t), a = armed(t), J = {};
      trunk(J, { lean: -3 * a, side: 4 * u, headPitch: 8 * a, headYaw: -6 * u });
      const held = { elev: 22, fwd: 42, elbow: 96 }, pump = { elev: K.elev * A, fwd: K.fwd, elbow: K.elbow };
      const R = armAt('Right', held, pump, u);
      Object.assign(J, armAt('Right', NEUTRAL_ARM, { elev: mix(held.elev, pump.elev, u), fwd: mix(held.fwd, pump.fwd, u), elbow: mix(held.elbow, pump.elbow, u) }, a), armAt('Left', NEUTRAL_ARM, { elev: 16, fwd: 14, elbow: 44 }, a));
      void R;
      return { J, hips: [0, 0, 0] };
    };
    marks = [p1, p2];
  } else if (kindName === 'brasLeves') {
    const on = (t) => ramp(t, 0, 0.55 * tc, tc) * (1 - ramp(t, K.hold, (K.hold + T) / 2, T));
    poseAt = (t) => {
      const a = on(t), sway = 5 * Math.sin((t - tc) * 4.2) * a, J = {};
      trunk(J, { lean: -8 * a, headPitch: K.headUp * a });
      const top = { elev: K.elev * Math.min(A, 1.06), fwd: K.fwd, elbow: 10 };   // au-delà le V se referme en I
      Object.assign(J, armAt('Left', NEUTRAL_ARM, { ...top, elev: top.elev + sway }, a), armAt('Right', NEUTRAL_ARM, { ...top, elev: top.elev - sway }, a));
      return { J, hips: [0, 0, 0] };
    };
  } else if (kindName === 'oreille') {
    const on = (t) => ramp(t, 0, 0.55 * tc, tc) * (1 - ramp(t, K.hold, (K.hold + T) / 2, T));
    poseAt = (t) => {
      const a = on(t), J = {};
      trunk(J, { yaw: -K.yaw * a, lean: 2 * a, headYaw: -K.yaw * 0.8 * a, headPitch: 4 * a });
      // la main droite en cornet à l'oreille droite, la gauche sur la hanche (coude en arrière)
      Object.assign(J, armAt('Right', NEUTRAL_ARM, { elev: K.elev * Math.min(A, 1.05), fwd: K.fwd, elbow: K.elbow, rot: K.rot }, a), armAt('Left', NEUTRAL_ARM, { elev: 24, fwd: -12, elbow: 58, rot: -30 }, a));
      return { J, hips: [0, 0, 0] };
    };
  } else if (kindName === 'calme') {
    const on = (t) => ramp(t, 0, 0.55 * tc, tc) * (1 - ramp(t, K.hold, (K.hold + T) / 2, T));
    poseAt = (t) => {
      const a = on(t), J = {};
      trunk(J, { lean: 4 * a, headPitch: -K.headDown * a });
      const hands = { elev: K.elev * A, fwd: K.fwd, elbow: K.elbow, rot: -20 };
      Object.assign(J, armAt('Left', NEUTRAL_ARM, hands, a), armAt('Right', NEUTRAL_ARM, hands, a));
      return { J, hips: [0, 0, 0] };
    };
  } else if (kindName === 'accolade') {
    const on = (t) => ramp(t, 0, 0.55 * tc, tc) * (1 - ramp(t, K.hold, (K.hold + T) / 2, T));
    poseAt = (t) => {
      const a = on(t), J = {};
      trunk(J, { lean: K.lean * a, headPitch: -6 * a, headYaw: 12 * a, side: -4 * a });
      const wrap = { elev: K.elev * A, fwd: K.fwd, elbow: K.elbow, rot: K.rot };
      Object.assign(J, armAt('Left', NEUTRAL_ARM, { ...wrap, elev: wrap.elev + 10, fwd: wrap.fwd + 6 }, a), armAt('Right', NEUTRAL_ARM, { ...wrap, elev: wrap.elev - 8, fwd: wrap.fwd - 4 }, a));
      return { J, hips: [0, 0.01 * a, 0.02 * a] };
    };
  } else if (kindName === 'applaudir') {
    const on = (t) => ramp(t, 0, 0.6 * tc, tc) * (1 - ramp(t, T - 0.25, T - 0.12, T));
    const per = (T - tc - 0.25) / K.claps;
    poseAt = (t) => {
      const a = on(t), J = {};
      const ph = t < tc ? 0 : Math.min(K.claps, (t - tc) / per);
      const together = t < tc || t > T - 0.25 ? 0 : 0.5 - 0.5 * Math.cos(ph * 2 * Math.PI);   // 0 : mains écartées, 1 : jointes
      trunk(J, { lean: 3 * a, headPitch: 3 * a });
      const open = { elev: K.elev * A, fwd: K.fwd, elbow: K.elbow - 8, rot: 0 }, shut = { elev: -36, fwd: K.fwd + 6, elbow: K.elbow + 16, rot: -10 };
      const L = armAt('Left', open, shut, together), R = armAt('Right', open, shut, together);
      Object.assign(J, armAt('Left', NEUTRAL_ARM, { elev: 0, fwd: 0, elbow: 0 }, 0));   // placeholder écrasé ci-dessous
      const blendArm = (side, target) => armAt(side, NEUTRAL_ARM, { elev: mix(open.elev, shut.elev, together), fwd: mix(open.fwd, shut.fwd, together), elbow: mix(open.elbow, shut.elbow, together), rot: mix(open.rot, shut.rot, together) }, a);
      Object.assign(J, blendArm('Left'), blendArm('Right'));
      void L; void R;
      return { J, hips: [0, 0, 0] };
    };
    for (let i = 0; i < K.claps; i++) marks.push(tc + per * (i + 0.5));
  } else if (kindName === 'proteste') {
    const on = (t) => ramp(t, 0, 0.55 * tc, tc) * (1 - ramp(t, K.hold, (K.hold + T) / 2, T));
    poseAt = (t) => {
      const a = on(t), J = {};
      const shake = K.shake * Math.sin((t - tc) * 2 * Math.PI / 0.55) * a * (t > tc && t < K.hold ? 1 : 0.4);
      trunk(J, { lean: -4 * a, headPitch: 6 * a, headYaw: shake });
      const out = { elev: K.elev * A, fwd: K.fwd, elbow: K.elbow, rot: -34 };
      Object.assign(J, armAt('Left', NEUTRAL_ARM, out, a), armAt('Right', NEUTRAL_ARM, out, a));
      J.LeftShoulder = rz(K.shrug * a); J.RightShoulder = rz(-K.shrug * a);   // les épaules qui montent
      return { J, hips: [0, -0.01 * a, 0] };
    };
  } else if (kindName === 'mainTendue') {
    // (C2) LA MAIN QUI TIRE : tendue devant (contact), tenue (hold), puis le bras REVIENT et le buste se redresse (pull — le fauché
    // se relève à la main, la scène rejoint les deux mains au point médian), le retour au neutre ensuite. pull absent : le retour d'hier.
    const tP = K.hold + (K.pull ?? 0);
    const a = (t) => ramp(t, 0, 0.5 * tc, tc) * (1 - ramp(t, tP, (tP + T) / 2, T)), r = (t) => (K.pull ? ramp(t, K.hold, (K.hold + tP) / 2, tP) : 0);
    poseAt = (t) => {
      const u = a(t), q = r(t), J = {};
      trunk(J, { lean: K.lean * u * (1 - 0.8 * q), headPitch: K.headDown * u * (1 - q) });
      Object.assign(J, armAt('Right', NEUTRAL_ARM, { elev: K.elev * A, fwd: mix(K.fwd, K.fwdPull ?? K.fwd, q), elbow: mix(K.elbow, K.elbowPull ?? K.elbow, q) }, u), armAt('Left', NEUTRAL_ARM, { elev: 18, fwd: -16, elbow: 24 }, u));   // la gauche en balancier derrière
      return { J, hips: [0, 0, 0] };
    };
    marks = [tc, K.hold, tP];
  } else if (kindName === 'sautMur') {
    // LE SAUT DU MUR : le bassin descend (accroupi), remonte et DÉCOLLE (cloche de hauteur, sommet au contact), retombe avec
    // un amorti ; les pieds suivent le bassin et se replient sous lui en vol (IK), à plat au sol avant et après ; les bras
    // se croisent devant le bas-ventre (la protection du mur), le buste se retient un peu en arrière, la tête rentre.
    const yOf = (t) => -K.crouch * bump(t, 0, 0.11, 0.21) + K.h * bump(t, 0.19, tc, 0.52) - 0.05 * bump(t, 0.52, 0.60, 0.70);
    const air = (t) => bump(t, 0.20, tc, 0.51);
    const hipsOf = (t) => [0, yOf(t), 0.02 * air(t)];
    poseAt = (t) => {
      const a = ramp(t, 0, 0.11, 0.22) * (1 - ramp(t, 0.56, 0.68, T)), f = air(t), J = {};   // les bras se croisent en 0,22 s (≤ 14 rad/s aux avant-bras : checkClip)
      trunk(J, { lean: -K.lean * f + 6 * bump(t, 0, 0.11, 0.21), headPitch: 8 * a });
      const cross = { elev: K.elev * A, fwd: K.fwd, elbow: K.elbow };
      Object.assign(J, armAt('Left', NEUTRAL_ARM, cross, a), armAt('Right', NEUTRAL_ARM, cross, a));
      const H = hipsOf(t), RH = rx(-K.lean * f * 0.3);
      J.Hips = RH;
      for (const side of ['Left', 'Right']) {
        const rest = side === 'Left' ? restL : restR;
        const target = [rest[0], rest[1] + Math.max(0, H[1]) + K.tuck * f, rest[2] - 0.03 * f];   // au sol tant que le bassin est bas ; en vol les pieds suivent et se replient
        const r = legIK2(P, side, hipJoint(P, side, RH, H), RH, target, [0, 0, -1]);
        J[`${side}UpLeg`] = r.Rthigh; J[`${side}Leg`] = r.Rshank;
        const flat = quatNormalize(quatConjugate(quatMul(quatMul(RH, r.Rthigh), r.Rshank)));
        J[`${side}Foot`] = chain(flat, rx(-18 * f)); J[`${side}ToeBase`] = I;   // la pointe tombe un peu en vol
      }
      return { J, hips: H };
    };
    marks = [tc];
  } else {
    // LA GLISSADE : descente sur les genoux (0 → contact), pose tenue vivante (lying → rise), relevé (rise → fin)
    const tL = K.lying, tR = K.rise;
    const kneelY = ground + P.lengths.thigh + K.kneel;                             // le bassin à genoux : la cuisse debout sur la rotule posée
    const down = (t) => ramp(t, 0, 0.5 * tc, tc);
    const vie = (t) => (K.vie ?? 1) * bump(t, tL, (tL + tR) / 2, tR);
    const up1 = (t) => ramp(t, tR, tR + 0.45 * (T - tR), tR + 0.6 * (T - tR));   // un pied devant
    const up2 = (t) => ramp(t, tR + 0.4 * (T - tR), tR + 0.8 * (T - tR), T);     // debout
    const hipsOf = (t) => {
      const d = down(t), u1 = up1(t), u2 = up2(t);
      const y = (kneelY - P.lengths.hipsY) * d * (1 - 0.15 * u1) * (1 - u2);
      return [0, y, 0.04 * d * (1 - u2)];
    };
    const kneelT = (side) => ({ p: [side === 'Left' ? restL[0] : restR[0], ground + 0.17, (side === 'Left' ? restL[2] : restR[2]) + K.back], pole: [0, -1, 0.35] });
    const plantR = { p: [restR[0] + 0.02, restR[1], restR[2] - 0.08], pole: [0, 0, -1] };
    poseAt = (t) => {
      const d = down(t), wr = vie(t), u1 = up1(t), u2 = up2(t), J = {};
      const a = d * (1 - u2);
      trunk(J, { lean: K.lean * a - 6 * u1 * (1 - u2), headPitch: (10 + 6 * wr) * a });
      const open = { elev: K.arms * A, fwd: 22, elbow: 14 }, vee = { elev: K.armsUp * A, fwd: 8, elbow: 10 };
      const arms = { elev: mix(open.elev, vee.elev, wr), fwd: mix(open.fwd, vee.fwd, wr), elbow: mix(open.elbow, vee.elbow, wr) };
      Object.assign(J, armAt('Left', NEUTRAL_ARM, arms, a), armAt('Right', NEUTRAL_ARM, arms, a));
      const H = hipsOf(t), RH = rx(-K.lean * a * 0.4);
      J.Hips = RH;
      // les jambes : debout → à genoux (IK, pointes au sol) → le pied droit devant (u1) → debout (u2)
      const v3 = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
      for (const side of ['Left', 'Right']) {
        const rest = side === 'Left' ? restL : restR, kn = kneelT(side);
        // la cible du pied : debout → derrière-haut (à genoux) en ligne droite (jamais sous la pelouse) ; le droit revient devant au relevé, puis les deux au repos
        let target, pole = [0, -1, 0], toe = d;
        if (t < tR) target = v3(rest, kn.p, d);
        else if (side === 'Right') { target = u1 < 1 ? v3(kn.p, plantR.p, u1) : v3(plantR.p, rest, u2); pole = u1 < 1 ? [0, -0.6 + 0.6 * u1, -0.4 - 0.6 * u1] : [0, 0, -1]; toe = 1 - u1; }
        else { target = v3(kn.p, rest, u2); pole = [0, -0.6 + 0.6 * u2, -0.4 - 0.6 * u2]; toe = 1 - u2; }
        const r = legIK2(P, side, hipJoint(P, side, RH, H), RH, target, pole);
        J[`${side}UpLeg`] = r.Rthigh; J[`${side}Leg`] = r.Rshank;
        const flat = quatNormalize(quatConjugate(quatMul(quatMul(RH, r.Rthigh), r.Rshank)));
        J[`${side}Foot`] = chain(flat, rx(-46 * toe)); J[`${side}ToeBase`] = I;   // à plat debout, la pointe au sol derrière à genoux
      }
      return { J, hips: H };
    };
    marks = [tL, tR];
  }
  const keys = emitSpec(P, { duration: T, contact: tc, fps: 60, poseAt, ik, marks });
  const spec = { name: kindName, duration: T, contact: tc, foot: 'right', generated: true, family: 'emotion', keys };
  if (K.upperOnly) spec.upperOnly = true;
  if (K.ownsLegs) { spec.ownsLegs = true; spec.lying = K.lying; spec.rise = K.rise; }
  return spec;
}

/** Le portrait : mains, tête, bassin, genoux, pieds — en série. */
export function emotionPortrait(spec, P) {
  const body = bodyPortrait(spec, P, { support: null });
  const series = body.samples.map(({ t, w }) => ({ t, lh: w.LeftHand.p, rh: w.RightHand.p, head: w.Head.p, pelvis: w.Hips.p, chest: w.Spine2.p, ls: w.LeftArm.p, rs: w.RightArm.p, lk: w.LeftLeg.p, rk: w.RightLeg.p, lf: w.LeftFoot.p, rf: w.RightFoot.p, lt: w.LeftToeBase.p, rt: w.RightToeBase.p }));
  const pick = (t) => series.reduce((b, s) => Math.abs(s.t - t) < Math.abs(b.t - t) ? s : b, series[0]);
  return { ...body, series, pick, start: series[0], end: series[series.length - 1] };
}

/**
 * LE CONTRAT : chaque geste a sa signature mesurable — le poing au-dessus de l'épaule deux fois ; les deux mains
 * au-dessus de la tête ; la main à l'oreille et l'autre à la hanche ; les mains devant à hauteur d'épaule ; la
 * glissade à genoux (bassin à la hauteur de la cuisse, genoux au sol, buste droit, bras ouverts, cycle tenu qui vit,
 * relevé debout) ; les bras qui enveloppent devant ; trois claquements ; les mains ouvertes hors des épaules et la
 * tête qui dit non — et chaque geste du haut revient à sa pose de départ (le fondu vers la foulée ne saute pas).
 */
export function checkEmotionGen(spec, P, kind) {
  const issues = [];
  const K = EMOTION_KINDS[kind], p = emotionPortrait(spec, P);
  const ground = P.lengths.groundY, hipsY = P.lengths.hipsY;
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const shoulderY = (s) => (s.ls[1] + s.rs[1]) / 2;
  if (K.upperOnly && p.endGap > 0.06) issues.push(`${kind} : la pose finale n'est pas la pose initiale (écart ${(100 * p.endGap).toFixed(0)} cm)`);
  if (p.lowest < -0.03) issues.push(`${kind} : un pied passe sous la pelouse (${(100 * p.lowest).toFixed(0)} cm)`);
  if (kind === 'poing') {
    const peaks = K.pumps.map((t) => p.pick(t)).filter((s) => s.rh[1] > shoulderY(s) + 0.10 && s.rh[2] < s.chest[2] + 0.05);
    if (peaks.length < 2) issues.push(`poing : le poing ne monte pas deux fois devant l'épaule (${peaks.length} pompe(s) mesurée(s))`);
    const between = p.pick((K.pumps[0] + K.pumps[1]) / 2);
    if (!(between.rh[1] < p.pick(K.pumps[0]).rh[1] - 0.06)) issues.push('poing : le poing ne redescend pas entre les deux pompes');
  }
  if (kind === 'brasLeves') {
    const s = p.pick((spec.contact + K.hold) / 2);
    if (!(s.lh[1] > s.head[1] + 0.08 && s.rh[1] > s.head[1] + 0.08)) issues.push(`brasLeves : les mains ne sont pas au-dessus de la tête (${(100 * (s.lh[1] - s.head[1])).toFixed(0)} / ${(100 * (s.rh[1] - s.head[1])).toFixed(0)} cm)`);
    if (!(Math.abs(s.lh[0]) > 0.25 && Math.abs(s.rh[0]) > 0.25)) issues.push('brasLeves : les bras ne font pas le V (mains trop près de l\'axe)');
  }
  if (kind === 'oreille') {
    const s = p.pick((spec.contact + K.hold) / 2);
    const ear = [0.10, s.head[1], s.head[2] + 0.02];   // l'oreille droite : à 10 cm du centre de la tête
    if (!(dist(s.rh, ear) < 0.19)) issues.push(`oreille : la main droite n'est pas à l'oreille (${(100 * dist(s.rh, ear)).toFixed(0)} cm de l'oreille)`);
    if (!(Math.abs(s.lh[1] - s.pelvis[1]) < 0.16 && s.lh[2] > s.pelvis[2] - 0.05)) issues.push('oreille : la main gauche n\'est pas sur la hanche');
  }
  if (kind === 'calme') {
    const s = p.pick((spec.contact + K.hold) / 2);
    if (!(Math.abs(s.lh[1] - shoulderY(s)) < 0.18 && Math.abs(s.rh[1] - shoulderY(s)) < 0.18)) issues.push('calme : les mains ne sont pas à hauteur d\'épaule');
    if (!(s.lh[2] < s.chest[2] - 0.18 && s.rh[2] < s.chest[2] - 0.18)) issues.push('calme : les mains ne sont pas devant');
    if (!(s.head[2] < p.start.head[2] - 0.02 || true)) issues.push('calme : la tête ne baisse pas');
  }
  if (kind === 'accolade') {
    const s = p.pick((spec.contact + K.hold) / 2);
    if (!(s.lh[2] < s.chest[2] - 0.25 && s.rh[2] < s.chest[2] - 0.25)) issues.push(`accolade : les bras n'enveloppent pas devant (mains à ${(100 * (s.chest[2] - s.lh[2])).toFixed(0)} / ${(100 * (s.chest[2] - s.rh[2])).toFixed(0)} cm devant la poitrine)`);
    if (!(Math.abs(s.lh[0] - s.rh[0]) < 0.38)) issues.push(`accolade : les mains restent écartées (${(100 * Math.abs(s.lh[0] - s.rh[0])).toFixed(0)} cm)`);
  }
  if (kind === 'applaudir') {
    const d = p.series.map((s) => dist(s.lh, s.rh));
    let minima = 0; for (let i = 1; i < d.length - 1; i++) if (d[i] < d[i - 1] && d[i] <= d[i + 1] && d[i] < 0.14) minima++;
    if (minima < 3) issues.push(`applaudir : ${minima} claquement(s) (mains à < 14 cm), attendu 3`);
    if (!(Math.max(...d) > 0.24)) issues.push('applaudir : les mains ne s\'écartent pas entre deux claquements');
  }
  if (kind === 'proteste') {
    const s = p.pick((spec.contact + K.hold) / 2);
    if (!(s.rh[0] > s.rs[0] + 0.15 && s.lh[0] < s.ls[0] - 0.15)) issues.push('proteste : les mains ne s\'ouvrent pas hors des épaules');
    if (!(s.rh[1] > s.pelvis[1] - 0.05 && s.rh[1] < shoulderY(s) + 0.05)) issues.push('proteste : les mains ne sont pas entre la taille et l\'épaule');
    const yaw = spec.keys.filter((k) => k.t > spec.contact && k.t < K.hold).map((k) => k.pose.Head?.[1] ?? 0);
    let flips = 0, sg = 0; for (const y of yaw) { const g = Math.abs(y) > 3 ? Math.sign(y) : 0; if (g && sg && g !== sg) flips++; if (g) sg = g; }
    if (flips < 2) issues.push(`proteste : la tête ne dit pas non (${flips} changement(s) de côté)`);
  }
  if (kind === 'mainTendue') {
    const s = p.pick((spec.contact + K.hold) / 2);
    if (!(s.rh[2] < s.chest[2] - 0.25)) issues.push(`mainTendue : la main n'est pas tendue devant (${(100 * (s.chest[2] - s.rh[2])).toFixed(0)} cm devant la poitrine, ≥ 25)`);
    if (!(s.rh[1] < shoulderY(s) - 0.12 && s.rh[1] > s.pelvis[1] - 0.35)) issues.push(`mainTendue : la main n'est pas offerte bas (${s.rh[1].toFixed(2)} m ; attendu sous l'épaule, au-dessus des genoux)`);
    if (!(s.head[2] < p.start.head[2] - 0.12)) issues.push(`mainTendue : le buste ne se penche pas vers le fauché (tête ${(100 * (p.start.head[2] - s.head[2])).toFixed(0)} cm devant sa place)`);
    if (!(s.lh[1] < shoulderY(s) - 0.2)) issues.push('mainTendue : la main gauche monte au lieu de rester en balancier');
    if (K.pull) {   // (C2) la main TIRE : à la fin du tir, la main droite est revenue vers la poitrine et la tête s'est redressée
      const q = p.pick(K.hold + K.pull), back = (s.chest[2] - s.rh[2]) - (q.chest[2] - q.rh[2]);
      if (!(back > 0.12)) issues.push(`mainTendue : la main ne revient pas en tirant (${(100 * back).toFixed(0)} cm vers la poitrine entre la tenue et la fin du tir, ≥ 12)`);
      if (!(q.head[2] > s.head[2] + 0.05)) issues.push(`mainTendue : le buste ne se redresse pas en tirant (tête ${(100 * (q.head[2] - s.head[2])).toFixed(0)} cm en arrière, ≥ 5)`);
    }
  }
  if (kind === 'sautMur') {
    const S = p.pick(spec.contact), C = p.pick(0.10), E = p.end, restF = (p.start.lf[1] + p.start.rf[1]) / 2;
    if (!(S.lf[1] > restF + 0.20 && S.rf[1] > restF + 0.20)) issues.push(`sautMur : les pieds ne décollent pas (${(100 * (S.lf[1] - restF)).toFixed(0)} / ${(100 * (S.rf[1] - restF)).toFixed(0)} cm au sommet, ≥ 20)`);
    if (!(S.pelvis[1] > hipsY + 0.22)) issues.push(`sautMur : le bassin ne monte pas (+${(100 * (S.pelvis[1] - hipsY)).toFixed(0)} cm au sommet, ≥ 22)`);
    if (!(C.pelvis[1] < hipsY - 0.05)) issues.push(`sautMur : pas d'accroupi avant la détente (bassin ${(100 * (C.pelvis[1] - hipsY)).toFixed(0)} cm à 0,10 s)`);
    if (!(S.lh[1] < S.chest[1] - 0.15 && S.rh[1] < S.chest[1] - 0.15 && dist(S.lh, S.rh) < 0.30 && S.lh[2] < S.pelvis[2] - 0.08)) issues.push(`sautMur : les mains ne sont pas croisées devant sous la poitrine (${(100 * dist(S.lh, S.rh)).toFixed(0)} cm entre elles)`);
    if (!(Math.abs(E.pelvis[1] - hipsY) < 0.04 && E.lf[1] < restF + 0.03 && E.rf[1] < restF + 0.03)) issues.push(`sautMur : la réception ne ramène pas au sol (bassin ${(100 * (E.pelvis[1] - hipsY)).toFixed(0)} cm, pieds ${(100 * (E.lf[1] - restF)).toFixed(0)} / ${(100 * (E.rf[1] - restF)).toFixed(0)} cm)`);
  }
  if (kind === 'glissade') {
    const L = p.pick(spec.lying), M = p.pick((spec.lying + spec.rise) / 2), R = p.pick(spec.rise), E = p.end;
    const kneelY = ground + P.lengths.thigh + K.kneel;
    if (!(Math.abs(L.pelvis[1] - kneelY) < 0.06)) issues.push(`glissade : le bassin n'est pas à genoux (${L.pelvis[1].toFixed(2)} m, attendu ${kneelY.toFixed(2)})`);
    if (!(L.lk[1] < ground + 0.12 && L.rk[1] < ground + 0.12)) issues.push(`glissade : les genoux ne sont pas au sol (${(100 * (L.lk[1] - ground)).toFixed(0)} / ${(100 * (L.rk[1] - ground)).toFixed(0)} cm)`);
    if (!(L.lf[2] > L.pelvis[2] + 0.2 && L.rf[2] > L.pelvis[2] + 0.2)) issues.push('glissade : les pieds ne sont pas derrière');
    if (!(L.head[1] > L.pelvis[1] + 0.55 && Math.abs(L.head[2] - L.pelvis[2]) < 0.25)) issues.push('glissade : le buste n\'est pas droit à genoux');
    if (!(L.rh[0] - L.lh[0] > 0.9)) issues.push(`glissade : les bras ne sont pas ouverts (${(100 * (L.rh[0] - L.lh[0])).toFixed(0)} cm entre les mains)`);
    const gap = (a, b) => Math.max(dist(a.lh, b.lh), dist(a.rh, b.rh), dist(a.head, b.head), dist(a.pelvis, b.pelvis));
    if (!(gap(L, M) > 0.15)) issues.push(`glissade : la pose tenue est FIGÉE (${(100 * gap(L, M)).toFixed(0)} cm de mouvement à mi-tenue)`);
    if (!(gap(L, R) < 0.03)) issues.push(`glissade : le cycle de la pose tenue ne se ferme pas (${(100 * gap(L, R)).toFixed(0)} cm)`);
    if (!(E.pelvis[1] > hipsY - 0.05 && Math.abs(E.lf[2] - E.pelvis[2]) < 0.3 && Math.abs(E.rf[2] - E.pelvis[2]) < 0.3)) issues.push(`glissade : le relevé ne ramène pas debout (bassin ${E.pelvis[1].toFixed(2)} m)`);
    for (const s of p.series) { const low = Math.min(s.lt[1], s.rt[1], s.lf[1] - 0.03, s.rf[1] - 0.03, s.lk[1] - 0.03, s.rk[1] - 0.03); if (low < ground - 0.02) { issues.push(`glissade : sous la pelouse à t=${s.t.toFixed(2)} (${low.toFixed(2)} m)`); break; } }
  }
  return { ok: issues.length === 0, issues, portrait: p };
}
