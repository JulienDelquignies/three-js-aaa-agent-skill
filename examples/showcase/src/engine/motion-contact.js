// motion-contact — LE CONTACT GÉNÉRÉ (lot A10) : le corps qui TOMBE et se RELÈVE, qui TRÉBUCHE, qui
// met l'ÉPAULE, qui PROTÈGE son ballon bras tendu.
//
// Le sweep (note 302 bis) : la sim couche le fauté (p.down) mais la scène ne dessinait rien — un joueur
// fauché restait DEBOUT, figé dans son clip d'attente, 0,7 s, puis repartait ; le duel d'épaule n'avait
// pas de corps ; le porteur pressé dans le dos ne protégeait rien. Ici, des fonctions pures du temps :
//
//   chuteAvant   — fauché par derrière / jambes prises : il trébuche, part en avant, les mains cherchent
//                  le sol, la poitrine se pose (contact), la POSE COUCHÉE (lying — la scène y gèle tant que
//                  la sim garde le corps au sol), puis le RELEVÉ (rise → fin) : appui des mains, un genou,
//                  debout. Le corps est transporté par la sim (movement._glisse) — le clip porte 25 cm.
//   chuteCote    — bousculé de côté (duel d'épaule perdu, charge) : il tombe sur la hanche DROITE puis
//                  l'épaule, la main gauche amortit devant ; relevé par la main et le genou.
//   chuteArriere — accroché, tiré en arrière : il s'assied, part sur le dos, les mains derrière ;
//                  relevé par un roulé de côté, un genou, debout.
//   trebuche     — la course cassée sans chute : deux appuis courts, le buste plonge et se rattrape,
//                  les bras s'ouvrent.
//   epaule       — le duel d'épaule (épaule DROITE dans l'adversaire) : le corps se penche et s'appuie,
//                  coude rentré, appui large, puis se redresse.
//   protection   — le bouclier : adversaire à DROITE-derrière, le bras droit TENDU vers lui, le tronc
//                  tourné à l'opposé, le ballon sous le pied gauche ; un plateau (hold) que la scène tient
//                  tant que la pression dure ; les jambes restent à la foulée (la scène met les poids
//                  du haut du corps seuls).
//
// Même machine que motion-ground : rampes C¹, articulations conjuguées, IK deux os des jambes sur des
// cibles portées par le bassin, emitSpec, style par joueur. Côté DROIT ; le miroir d'animkit fait la gauche.

import { rx, ry, rz, chain, fkPose, jointToSpec } from './motion-rig.js';
import { ramp, bump, emitSpec, armJoints, denseSampler, NEUTRAL_STYLE } from './motion-strike.js';
import { alignFrame } from './motion-restart.js';
import { twoBoneIK } from './procedural.js';
import { sub, len, norm, cross, quatMul, quatConjugate, quatNormalize } from './vecmath.js';

/** L'IK de jambe des chutes : la même IK deux os que legIK, mais la rotation de chaque os vient de la matrice des
 *  repères (alignFrame, motion-restart) — le plus-court-arc + vrille de legIK retournait la cuisse (genou à 62 cm
 *  du sien, 174 rad/s) quand la jambe passait du couché à la flexion sous un bassin bas. Le plan du genou : celui
 *  de la jambe pliée (tibia × cuisse), sinon (jambe tendue) le pôle. */
export function legIK2(P, side, hipW, Rpar, ankle, pole) {
  const up = P.bones[`${side}UpLeg`], kn = P.bones[`${side}Leg`], ft = P.bones[`${side}Foot`], L = P.lengths;
  const ik = twoBoneIK(hipW, ankle, L.thigh, L.shank, pole);
  const d1 = norm(sub(ik.mid, hipW)), s1 = norm(sub(ik.end, ik.mid)), dir = norm(sub(ankle, hipW));
  // la normale du plan du genou vient du PÔLE (sa composante ⟂ à hanche→cheville) — mesuré : cross(tibia, cuisse) a
  // le même signe qu'elle sur toute jambe pliée, et NE SAUTE PAS quand la jambe se tend (bendN → 0 : 174 rad/s de vrille)
  const k = pole[0] * dir[0] + pole[1] * dir[1] + pole[2] * dir[2];
  let poleP = [pole[0] - k * dir[0], pole[1] - k * dir[1], pole[2] - k * dir[2]];
  if (len(poleP) < 1e-4) poleP = [0, 0, -1];
  const n1 = norm(cross(dir, norm(poleP)));
  const d0 = norm(sub(kn.bindP, up.bindP)), s0 = norm(sub(ft.bindP, kn.bindP));
  const n0 = norm(cross(d0, [0, 0, -1]));
  const thighW = alignFrame(d0, n0, d1, n1), shankW = alignFrame(s0, n0, s1, n1);
  const Rthigh = quatNormalize(quatMul(quatConjugate(Rpar), thighW)), Rshank = quatNormalize(quatMul(quatConjugate(thighW), shankW));
  return { Rthigh, Rshank, legW: shankW, knee: ik.mid, reachable: ik.reachable };
}

export const CONTACT_KINDS = {
  chuteAvant:   { duration: 1.9, contact: 0.50, lying: 0.66, rise: 1.20, fwd: 0.25, dip: 0.70, pitch: -80, stumble: 0.22, headUp: 22, vie: 1 },
  chuteCote:    { duration: 1.8, contact: 0.48, lying: 0.64, rise: 1.15, side: 0.30, dip: 0.70, roll: -76, pitch: -18, stumble: 0.18, vie: 1 },
  chuteArriere: { duration: 1.8, contact: 0.50, lying: 0.66, rise: 1.15, back: 0.30, dip: 0.74, pitch: 58, lie: 26, stumble: 0.20, vie: 1 },
  trebuche:     { duration: 0.85, contact: 0.30, pitch: 56, dip: 0.09, step: 0.42, arms: 46 },
  epaule:       { duration: 0.60, contact: 0.25, roll: 16, shift: 0.10, drop: 14, wide: 0.20, lean: 10 },
  protection:   { duration: 0.70, contact: 0.25, hold: 0.45, elev: 62, back: 42, turn: 20, lean: 8 },
};
export const CONTACT_NAMES = Object.keys(CONTACT_KINDS);
export const TRACE = (typeof process !== 'undefined' && process.env?.CONTACT_TRACE) ? [] : null;

const I = [0, 0, 0, 1];
const lerp = (a, b, u) => a + (b - a) * u;
const v3 = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];

/** le tronc : penché (lean, + = avant), de côté (side, + = vers la droite), tourné (yaw), la tête baissée (headDown) — répartis sur la chaîne */
function trunk(J, { lean = 0, side = 0, yaw = 0, headDown = 0, headUp = 0 }) {
  for (const [b, w] of [['Spine', 0.35], ['Spine1', 0.35], ['Spine2', 0.30]]) J[b] = chain(ry(yaw * w), rz(-side * w), rx(-lean * w));
  J.Neck = rx((-headDown + headUp) * 0.3);
  J.Head = rx((-headDown + headUp) * 0.7);
  J.LeftShoulder = I; J.RightShoulder = I;
}

/** la position monde de la hanche (articulation) pour un bassin donné — les cibles de pied se posent depuis là */
export function hipJoint(P, side, Rhips, hips) {
  return fkPose(P, { Hips: jointToSpec(P, 'Hips', Rhips) }, hips)[`${side}UpLeg`].p;
}

/** LES CHUTES — un bâtisseur, trois directions. Les enveloppes : trébuchement (0 → stumble), chute
 *  (stumble → contact), tassement (contact → lying), pose tenue, relevé (rise → fin : appui, genou, debout). */
function generateFall(kind, P, S) {
  const K = CONTACT_KINDS[kind];
  const T = K.duration, tc = K.contact, tS = K.stumble, tL = K.lying, tR = K.rise;
  const ground = P.lengths.groundY, restL = P.bones.LeftFoot.bindP, restR = P.bones.RightFoot.bindP;
  const dip = K.dip;
  const st = (t) => ramp(t, 0, 0.55 * tS, tS);
  const fa = (t) => ramp(t, tS, 0.65 * tc + 0.35 * tS, tc);
  const se = (t) => ramp(t, tc, (tc + tL) / 2, tL);
  const up = (t) => ramp(t, tR, (tR + T) / 2, T);
  const up1 = (t) => ramp(t, tR, tR + 0.45 * (T - tR), tR + 0.55 * (T - tR));          // le premier temps du relevé : l'appui, le genou
  const up2 = (t) => ramp(t, tR + 0.45 * (T - tR), tR + 0.8 * (T - tR), T);            // le second : debout
  // (A10 bis) LA POSE TENUE VIT : entre lying et rise, un cycle fermé (0 → 1 → 0 : la pose de rise EST celle de lying) — la tête se pose et se relève, une main va au corps, la jambe du dessus plie ; la scène y fait des allers-retours tant que la sim tient le corps au sol (rondo-contact.contactClock)
  const vie = (t) => (K.vie ?? 1) * bump(t, tL, (tL + tR) / 2, tR);
  const prone = kind === 'chuteAvant', side = kind === 'chuteCote', back = kind === 'chuteArriere';
  // le canal hanches : bas, et devant / à droite / derrière selon la chute ; le relevé passe par le genou (0,55 m) puis debout
  const hipsOf = (t) => {
    const s = st(t), f = fa(t), e = se(t), u1 = up1(t), u2 = up2(t);
    const down0 = 0.08 * s + (dip * 0.88 - 0.08) * f + dip * 0.12 * e;
    const uH = Math.min(1, u1 * 2.5);                                                  // le bassin remonte d'abord et haut (les mains poussent : à quatre pattes, 0,55 m), les pieds suivent
    const down = down0 * (1 - uH) + (P.lengths.hipsY - 0.55) * uH * (1 - u2);
    const along = 0.08 * s + ((prone ? K.fwd : side ? K.side : K.back) - 0.08) * f + 0.03 * e;
    const resid = along * (1 - 0.6 * u1) * (1 - 0.7 * u2);
    return prone ? [0, -down, resid] : side ? [resid, -down, 0] : [0, -down, -resid];   // le canal hanches : z = −z_personnage (devant +)
  };
  const hipsR = (t) => {
    const a = (0.72 * fa(t) + 0.28 * se(t)), u1 = up1(t), u2 = up2(t);
    // le relevé (u1) : le bassin se redresse presque (il reste 12° de penché avant dans la flexion), puis debout (u2)
    if (prone) { const uH = Math.min(1, u1 * 2.5), p = (K.pitch * a * (1 - uH) - 12 * uH) * (1 - u2); return rx(p); }
    if (side) { const r = K.roll * a * (1 - u1) * (1 - u2), p = (K.pitch * a * (1 - u1) - 12 * u1) * (1 - u2); return chain(rz(r), rx(p)); }
    const p = ((K.pitch * a + K.lie * se(t)) * (1 - u1) - 12 * u1) * (1 - u2);         // assis puis couché sur le dos, puis la flexion
    return rx(p);
  };
  const poseAt = (t) => {
    const s = st(t), f = fa(t), e = se(t), u1 = up1(t), u2 = up2(t), a = 0.72 * f + 0.28 * e, wr = vie(t);
    const J = { Hips: hipsR(t) };
    legs(t, J, prone ? a * (1 - u1) : 0);                                              // la pointe suit le tibia à plat ventre seulement
    if (prone) {
      // le buste plonge au trébuchement, s'aligne sur le bassin couché (un peu cambré : la tête hors de la pelouse), se redresse au relevé
      trunk(J, { lean: 26 * S.lean * s * (1 - f) + 6 * a * (1 - u1) - 22 * u1 * (1 - u2), headUp: K.headUp * a * (1 - u1) - 12 * wr + 8 * u1 * (1 - u2), headDown: 12 * s * (1 - f) });
      // les bras : en avant au trébuchement, tendus vers le sol à la chute, coudes qui plient à l'impact (les mains sous les épaules), puis l'appui du relevé
      const reach = 30 * s + 60 * f, elbow = 12 + 8 * s + 64 * e * (1 - u1) + 20 * u1 * (1 - u2);   // les coudes plient à l'impact (les avant-bras se posent) : les mains restent au-dessus du plan du sol
      const elev = 24 * s * (1 - f) + 14 * f;
      const fwdR = reach * (1 - 0.65 * u1) * (1 - 0.5 * u2);                          // les bras redescendent avec le relevé (mesuré en jeu : bras en l'air dans la flexion)
      Object.assign(J, armJoints('Left', { elev, fwd: fwdR, elbow }), armJoints('Right', { elev: elev + 10 * wr, fwd: fwdR - 30 * wr, elbow: elbow + 36 * wr }));   // la vie au sol : la main droite revient vers la tête
    } else if (side) {
      trunk(J, { lean: 14 * S.lean * s * (1 - f) + 4 * a * (1 - u1) - 16 * u1 * (1 - u2), side: -14 * a * (1 - u1), headUp: 10 * a * (1 - u1) + 8 * wr });
      // le bras droit amortit sous le corps (coude puis main), la main gauche vient devant au sol ; les deux poussent au relevé
      Object.assign(J, armJoints('Left', { elev: 22 * s + 30 * f * (1 - u2), fwd: 30 * s + 60 * f * (1 - 0.5 * u2) - 34 * wr, elbow: 12 + 30 * e * (1 - u1) + 40 * wr }),   // la vie au sol : la main du dessus va à la hanche
        armJoints('Right', { elev: 18 * s * (1 - f) + 12 * f, fwd: 20 * s + 40 * f * (1 - u2), elbow: 12 + 70 * a * (1 - u1) }));
    } else {
      // tiré en arrière : le buste part derrière, les mains cherchent le sol dans le dos ; au relevé il roule et se redresse
      trunk(J, { lean: -8 * s - 6 * a * (1 - u1) - 18 * u1 * (1 - u2), headDown: 10 * a * (1 - u1) - 10 * wr });
      Object.assign(J, armJoints('Left', { elev: 30 * s + 40 * f * (1 - u1), fwd: -(20 * s + 52 * f) * (1 - u1), elbow: 10 + 30 * e * (1 - u1) }),
        armJoints('Right', { elev: 30 * s + 40 * f * (1 - u1), fwd: -(20 * s + 52 * f) * (1 - u1) + 70 * wr, elbow: 10 + 30 * e * (1 - u1) + 50 * wr }));   // la vie au sol : la main droite vient au visage
    }
    return { J, hips: hipsOf(t) };
  };
  // les jambes : un appui de trébuchement, puis des cibles PORTÉES par la hanche de l'instant (couchées), puis la flexion et le debout
  const legTargets = (t) => {
    const s = st(t), f = fa(t), e = se(t), u1 = up1(t), u2 = up2(t), wr = vie(t);
    const Rh = hipsR(t), H = hipsOf(t);
    const hipL = hipJoint(P, 'Left', Rh, H), hipR = hipJoint(P, 'Right', Rh, H);
    // le trébuchement : le pied gauche part devant, le droit reste
    let pL = v3(restL, [restL[0], restL[1] + 0.05, restL[2] - 0.36], s), pR = [...restR];
    let poleL = [0, 0, -1], poleR = [0, 0, -1];
    if (prone) {
      // couché à plat ventre : les jambes prolongent le corps derrière, presque tendues, le genou plie vers le HAUT (talon qui monte)
      const lyL = [hipL[0] + 0.02 + 0.04 * wr, ground + 0.15 + 0.28 * wr, hipL[2] + 0.71 - 0.20 * wr], lyR = [hipR[0] - 0.02, ground + 0.15, hipR[2] + 0.72];   // presque tendues, le genou posé ; la gauche plie (talon qui monte) pendant la vie au sol
      pL = v3(pL, lyL, f); pR = v3(pR, lyR, f);
      // le pôle tourne avec la jambe : couché (pied derrière-bas) le genou plie vers le HAUT ; en flexion (pied dessous) vers l'AVANT —
      // un pôle fixe devant-haut était ANTI-parallèle à hanche→pied une fois couché (composante ⟂ nulle : la vrille sautait de 180°)
      // …et le relevé passe par le GENOU : dès que la jambe se replie sous le corps, le genou va vers le sol et devant (à
      // mi-chemin un pôle haut mettait le genou AU-DESSUS de la hanche, puis il retombait de 57 cm en une image)
      // …le genou couché est AU SOL (pôle bas : le tibia remonte vers le talon), et le pôle tourne vers devant-bas pendant que le
      // pied revient sous le corps — jamais dans l'axe de la jambe (devant et derrière le sont quand le pied est derrière :
      // composante ⟂ nulle, le solveur retombait sur son axe x, genou à 15 cm sur le côté ; haut mettait le genou au-dessus de la hanche)
      // …LE PÔLE SUIT LA JAMBE : la direction hanche→pied tournée de 90° autour de x (debout : devant ; couché, pied derrière : bas ;
      // en flexion : devant-bas) — toujours ⟂ à la jambe, le genou plie du côté anatomique, aucune image dégénérée
      const kneeDir = (h, f) => { const d = norm(sub(f, h)); return [d[0], -d[2], d[1]]; };
      poleL = kneeDir(hipL, pL); poleR = kneeDir(hipR, pR);
      // le relevé : les mains poussent, les deux pieds reviennent SOUS le bassin (la flexion), puis debout
      // …à genoux d'abord (le bassin à 0,55 m, les tibias à plat derrière : pied à 42 cm derrière la hanche), puis un pied
      // devant l'autre sous le bassin — un pied encore loin derrière sous un bassin bas mettait le genou dans la pelouse
      const uH = Math.min(1, u1 * 2.5), uP = Math.max(0, (u1 - 0.35) / 0.65);
      const kneelL = [hipL[0], ground + 0.12, hipL[2] + 0.42], kneelR = [hipR[0], ground + 0.12, hipR[2] + 0.44];
      const plantL = [hipL[0] - 0.02, ground + 0.11, hipL[2] - 0.10], plantR = [hipR[0] + 0.02, ground + 0.11, hipR[2] - 0.06];
      pL = v3(v3(pL, kneelL, uH), plantL, uP); pR = v3(v3(pR, kneelR, uH), plantR, uP);
      pL = v3(pL, restL, u2); pR = v3(pR, [restR[0], restR[1], restR[2] + 0.02], u2);
    } else if (side) {
      // couché sur le côté droit : le corps s'allonge vers −x (tête à droite, pieds à gauche) — la jambe de dessous (droite) presque
      // tendue dans l'axe, celle de dessus (gauche) repliée devant ; les genoux plient vers l'avant
      const lyR = [hipR[0] - 0.64, ground + 0.12, hipR[2] + 0.06], lyL = [hipL[0] - 0.40 + 0.10 * wr, ground + 0.24 + 0.04 * wr, hipL[2] - 0.22 - 0.10 * wr];   // la jambe du dessus se replie pendant la vie au sol
      pL = v3(pL, lyL, f); pR = v3(pR, lyR, f);
      poleL = v3([0.2, 0, -1], [0, 0, -1], u1); poleR = v3([0.2, 0.2, -1], [0, 0, -1], u1);
      const plantL = [hipL[0] - 0.04, ground + 0.10, hipL[2] - 0.10], plantR = [hipR[0] + 0.04, ground + 0.10, hipR[2] - 0.06];
      pL = v3(pL, plantL, u1); pR = v3(pR, plantR, u1);
      pL = v3(pL, restL, u2); pR = v3(pR, restR, u2);
    } else {
      // assis puis sur le dos : les jambes devant, genoux pliés vers le haut, les pieds au sol
      const lyL = [hipL[0] - 0.02, ground + 0.12, hipL[2] - 0.52 + 0.12 * wr], lyR = [hipR[0] + 0.02, ground + 0.12, hipR[2] - 0.55];   // le genou gauche remonte pendant la vie au sol
      pL = v3(pL, lyL, f); pR = v3(pR, lyR, f);
      poleL = v3([0, 1, -0.3], [0, 0, -1], u1); poleR = v3([0, 1, -0.3], [0, 0, -1], u1);
      const plantL = [hipL[0] - 0.04, ground + 0.10, hipL[2] - 0.12], plantR = [hipR[0] + 0.02, ground + 0.10, hipR[2] - 0.08];
      pL = v3(pL, plantL, u1); pR = v3(pR, plantR, u1);
      pL = v3(pL, restL, u2); pR = v3(pR, restR, u2);
    }
    void e;
    if (TRACE) TRACE.push({ t, hipL: hipL.map((v) => +v.toFixed(3)), pL: pL.map((v) => +v.toFixed(3)), poleL: poleL.map((v) => +v.toFixed(2)), u1: +u1.toFixed(2), f: +f.toFixed(2) });
    return { Left: { p: pL, pole: poleL }, Right: { p: pR, pole: poleR } };
  };
  // …résolues ici (legIK2) : cuisse, tibia, et le pied — à plat debout, la pointe qui suit le tibia (40°) une fois couché
  const legs = (t, J, lie) => {
    const tg = legTargets(t), Rh = J.Hips, H = hipsOf(t);
    const partial = fkPose(P, { Hips: jointToSpec(P, 'Hips', Rh) }, H);
    for (const side of ['Left', 'Right']) {
      const r = legIK2(P, side, partial[`${side}UpLeg`].p, Rh, tg[side].p, tg[side].pole);
      J[`${side}UpLeg`] = r.Rthigh; J[`${side}Leg`] = r.Rshank;
      const flat = quatNormalize(quatConjugate(quatMul(quatMul(Rh, r.Rthigh), r.Rshank)));
      J[`${side}Foot`] = chain(flat, rx(-40 * lie)); J[`${side}ToeBase`] = I;
    }
  };
  const ik = () => ({});
  const keys = emitSpec(P, { duration: T, contact: tc, fps: 60, poseAt, ik, marks: [tL, tR] });
  return { name: kind, duration: T, contact: tc, lying: tL, rise: tR, foot: 'right', generated: true, family: 'contact', keys };
}

/** LE TRÉBUCHEMENT — la course cassée : le buste plonge, deux appuis courts le rattrapent, les bras s'ouvrent. */
function generateStumble(P, S) {
  const K = CONTACT_KINDS.trebuche, T = K.duration, tc = K.contact;
  const restL = P.bones.LeftFoot.bindP, restR = P.bones.RightFoot.bindP;
  const dive = (t) => ramp(t, 0, 0.6 * tc, tc), rec = (t) => ramp(t, tc, (tc + T) / 2, T);
  const poseAt = (t) => {
    const d = dive(t), r = rec(t), a = d * (1 - r);
    const J = { Hips: rx(-12 * a) };
    trunk(J, { lean: K.pitch * S.lean * a, headDown: 6 * a });
    const open = K.arms * S.armElev * a;
    Object.assign(J, armJoints('Left', { elev: 12 + open, fwd: 20 * a, elbow: 16 + 10 * a }), armJoints('Right', { elev: 12 + open, fwd: 26 * a, elbow: 16 + 10 * a }));
    return { J, hips: [0, -K.dip * a, -0.10 * a] };
  };
  const ik = (t) => {
    // deux appuis : le droit part devant (0 → 0,3), le gauche le suit (0,25 → 0,55), puis les deux se rassemblent
    const s1 = ramp(t, 0.0, 0.16, 0.30), s2 = ramp(t, 0.25, 0.42, 0.55), g = ramp(t, 0.55, 0.72, T);
    const pR = v3(v3(restR, [restR[0], restR[1] + 0.06 * bump(t, 0, 0.15, 0.30), restR[2] - K.step], s1), restR, g);
    const pL = v3(v3(restL, [restL[0], restL[1] + 0.06 * bump(t, 0.25, 0.4, 0.55), restL[2] - K.step * 0.8], s2), restL, g);
    return { Left: { p: pL, pole: [0, 0, -1] }, Right: { p: pR, pole: [0, 0, -1] } };
  };
  const keys = emitSpec(P, { duration: T, contact: tc, fps: 60, poseAt, ik, marks: [] });
  return { name: 'trebuche', duration: T, contact: tc, foot: 'right', generated: true, family: 'contact', keys };
}

/** LE DUEL D'ÉPAULE — l'épaule DROITE dans l'adversaire : appui large, le corps qui se penche et s'appuie, le coude rentré. */
function generateShoulder(P, S) {
  const K = CONTACT_KINDS.epaule, T = K.duration, tc = K.contact;
  const restL = P.bones.LeftFoot.bindP, restR = P.bones.RightFoot.bindP;
  const push = (t) => ramp(t, 0, 0.7 * tc, tc), rel = (t) => ramp(t, tc + 0.08, (tc + T) / 2, T);
  const poseAt = (t) => {
    const a = push(t) * (1 - rel(t));
    const J = { Hips: chain(rz(-K.roll * 0.35 * a), rx(-4 * a)) };
    trunk(J, { lean: K.lean * S.lean * a, side: K.roll * a, yaw: -10 * a, headDown: 4 * a });
    J.RightShoulder = chain(rz(-K.drop * a), ry(6 * a));                                   // l'épaule droite qui descend et avance
    Object.assign(J, armJoints('Right', { elev: 6 + 4 * a, fwd: 18 * a, elbow: 20 + 60 * a }), armJoints('Left', { elev: 14 + 30 * S.armElev * a, fwd: 10 * a, elbow: 16 + 14 * a }));
    return { J, hips: [K.shift * a, -0.05 * a, 0] };
  };
  const ik = (t) => {
    const a = push(t) * (1 - rel(t));
    return { Left: { p: v3(restL, [restL[0] - 0.04, restL[1], restL[2] + 0.06], a), pole: [0, 0, -1] }, Right: { p: v3(restR, [restR[0] + K.wide, restR[1], restR[2] - 0.05], a), pole: [0.2, 0, -1] } };
  };
  const keys = emitSpec(P, { duration: T, contact: tc, fps: 60, poseAt, ik, marks: [] });
  return { name: 'epaule', duration: T, contact: tc, foot: 'right', generated: true, family: 'contact', keys };
}

/** LE BOUCLIER — adversaire à DROITE-derrière : bras droit tendu vers lui, tronc tourné à l'opposé, léger appui ; un plateau tenu. */
function generateShield(P, S) {
  const K = CONTACT_KINDS.protection, T = K.duration, tc = K.contact, tH = K.hold;
  const restL = P.bones.LeftFoot.bindP, restR = P.bones.RightFoot.bindP;
  const on = (t) => ramp(t, 0, 0.6 * tc, tc), off = (t) => ramp(t, tH, (tH + T) / 2, T);
  const poseAt = (t) => {
    const a = on(t) * (1 - off(t));
    const J = { Hips: ry(-6 * a) };
    trunk(J, { lean: K.lean * S.lean * a, yaw: -K.turn * a, side: 6 * a });                   // tourné vers la GAUCHE (le dos et le bras droit à l'adversaire)
    Object.assign(J, armJoints('Right', { elev: K.elev * a, fwd: -K.back * a, elbow: 8 * a }), armJoints('Left', { elev: 12 + 8 * a, fwd: 24 * a, elbow: 24 + 30 * a }));
    return { J, hips: [-0.03 * a, -0.03 * a, 0] };
  };
  const ik = (t) => {
    const a = on(t) * (1 - off(t));
    return { Left: { p: v3(restL, [restL[0] - 0.05, restL[1], restL[2] - 0.10], a), pole: [0, 0, -1] }, Right: { p: v3(restR, [restR[0] + 0.08, restR[1], restR[2] + 0.06], a), pole: [0, 0, -1] } };
  };
  const keys = emitSpec(P, { duration: T, contact: tc, fps: 60, poseAt, ik, marks: [tH] });
  return { name: 'protection', duration: T, contact: tc, hold: tH, foot: 'right', generated: true, family: 'contact', keys };
}

/** GÉNÉRER un geste de contact. */
export function generateContact(kindName, P, { style = NEUTRAL_STYLE } = {}) {
  if (!CONTACT_KINDS[kindName]) throw new Error(`motion-contact : espèce inconnue « ${kindName} »`);
  const S0 = { ...NEUTRAL_STYLE, ...style };
  // le style est un accent, pas une géométrie : penche et bras bornés ; la profondeur du sol n'en est pas un
  const S = { ...S0, lean: Math.max(0.85, Math.min(1.2, S0.lean ?? 1)), armElev: Math.max(0.85, Math.min(1.2, S0.armElev ?? 1)) };
  // une chute n'a pas de style de bras : la main qui amortit va au sol, où qu'il soit (le penché seul reste, borné serré)
  if (kindName.startsWith('chute')) return generateFall(kindName, P, { ...NEUTRAL_STYLE, lean: Math.max(0.95, Math.min(1.05, S.lean)) });   // le sol est où il est : la chute n'a pas de style de corps
  if (kindName === 'trebuche') return generateStumble(P, S);
  if (kindName === 'epaule') return generateShoulder(P, S);
  return generateShield(P, S);
}

/** Le portrait : bassin, tête, mains, pieds, poitrine — au contact, à la pose couchée, à la fin, et en série. */
export function contactPortrait(spec, P) {
  const at = denseSampler(spec, P);
  const series = [];
  for (let i = 0; i <= 80; i++) {
    const t = (i / 80) * spec.duration, w = at(t);
    series.push({ t, pelvis: w.Hips.p, head: w.Head.p, chest: w.Spine2.p, lh: w.LeftHand.p, rh: w.RightHand.p, lf: w.LeftFoot.p, rf: w.RightFoot.p, lt: w.LeftToeBase.p, rt: w.RightToeBase.p, lk: w.LeftLeg.p, rk: w.RightLeg.p, rs: w.RightArm.p, ls: w.LeftArm.p });
  }
  const pick = (t) => series.reduce((b, s) => Math.abs(s.t - t) < Math.abs(b.t - t) ? s : b, series[0]);
  return { series, atC: pick(spec.contact), atL: spec.lying != null ? pick(spec.lying) : null, atR: spec.rise != null ? pick(spec.rise) : null, atH: spec.hold != null ? pick(spec.hold) : null, end: series[series.length - 1], start: series[0] };
}

/**
 * LE CONTRAT du contact : une chute POSE le corps (bassin bas à la pose couchée, dans la direction de la
 * chute), une main au sol autour de l'impact, la tête JAMAIS dans la pelouse, rien sous elle, le RELEVÉ
 * ramène debout (bassin à hauteur, redressé, pieds sous lui) ; le trébuchement plonge et se rattrape sur
 * deux appuis ; l'épaule s'appuie (épaule droite qui sort) ; le bouclier tend le bras droit vers l'arrière-droite
 * et tourne le tronc à l'opposé.
 */
export function checkContactGen(spec, P, kind) {
  const issues = [];
  const p = contactPortrait(spec, P);
  const ground = P.lengths.groundY, hipsY = P.lengths.hipsY;
  // les marges : le genou posé (son centre à 2 cm du plan des semelles : la rotule est plus large que la chaussure n'est épaisse), le poignet d'une paume posée (3 cm), le bassin et la poitrine couchés (8 et 10 cm) ; les orteils au sol sont le plan du sol
  const lowest = (s) => Math.min(s.lt[1], s.rt[1], s.lf[1] - 0.02, s.rf[1] - 0.02, s.lk[1] - 0.02, s.rk[1] - 0.02, s.lh[1] - 0.03, s.rh[1] - 0.03, s.pelvis[1] - 0.08, s.chest[1] - 0.10);
  for (const s of p.series) { if (lowest(s) < ground - 0.02) { issues.push(`sous la pelouse à t=${s.t.toFixed(2)} (${lowest(s).toFixed(2)} m)`); break; } }
  for (const s of p.series) { if (s.head[1] < ground + 0.07) { issues.push(`la tête dans la pelouse à t=${s.t.toFixed(2)} (${s.head[1].toFixed(2)} m)`); break; } }
  if (kind.startsWith('chute')) {
    const L = p.atL, E = p.end;
    if (!(L.pelvis[1] < ground + 0.34)) issues.push(`${kind} : le bassin ne se couche pas (${L.pelvis[1].toFixed(2)} m à la pose couchée, attendu < ${(ground + 0.34).toFixed(2)})`);
    const dir = kind === 'chuteAvant' ? -L.pelvis[2] : kind === 'chuteCote' ? L.pelvis[0] : L.pelvis[2];
    if (!(dir > 0.15)) issues.push(`${kind} : le corps ne part pas dans la direction de la chute (${dir.toFixed(2)} m)`);
    const brace = p.series.filter((s) => s.t >= spec.contact - 0.12 && s.t <= spec.lying + 0.05).some((s) => Math.min(s.lh[1], s.rh[1]) < ground + 0.14);
    if (!brace) issues.push(`${kind} : aucune main au sol autour de l'impact`);
    if (!(E.pelvis[1] > hipsY - 0.08)) issues.push(`${kind} : le relevé ne ramène pas debout (bassin à ${E.pelvis[1].toFixed(2)} m)`);
    if (!(Math.abs(E.head[2] - E.pelvis[2]) < 0.16 && E.head[1] > E.pelvis[1] + 0.5)) issues.push(`${kind} : le relevé ne redresse pas le tronc`);
    if (!(Math.abs(E.lf[0] - E.rf[0]) < 0.4 && Math.abs(E.lf[2] - E.pelvis[2]) < 0.35 && Math.abs(E.rf[2] - E.pelvis[2]) < 0.35)) issues.push(`${kind} : les pieds ne reviennent pas sous le bassin`);
    // le genou du relevé : entre la pose couchée et le debout, le bassin passe par une hauteur intermédiaire (un genou au sol), il ne « saute » pas debout
    const mid = p.series.filter((s) => s.t > spec.rise && s.t < spec.duration - 0.1).map((s) => s.pelvis[1]);
    if (!(mid.some((y) => y > ground + 0.30 && y < hipsY - 0.30))) issues.push(`${kind} : le relevé saute debout sans passer par la flexion`);
    // (A10 bis) la pose tenue VIT : à mi-tenue une main ou un pied a bougé (≥ 8 cm), et le cycle se FERME (la pose de rise est celle de lying à 2 cm : la scène y fait des allers-retours, puis repart de là au relevé)
    const pick = (t) => p.series.reduce((b, s) => Math.abs(s.t - t) < Math.abs(b.t - t) ? s : b, p.series[0]);
    const gap = (a, b) => Math.max(...['head', 'lh', 'rh', 'lf', 'rf', 'pelvis'].map((k) => len(sub(a[k], b[k]))));
    const Lp = pick(spec.lying), Rp = pick(spec.rise), Mp = pick((spec.lying + spec.rise) / 2);
    if (!(gap(Lp, Mp) > 0.08)) issues.push(`${kind} : la pose tenue est FIGÉE (${(100 * gap(Lp, Mp)).toFixed(0)} cm de mouvement à mi-tenue, attendu ≥ 8)`);
    if (!(gap(Lp, Rp) < 0.02)) issues.push(`${kind} : le cycle de la pose tenue ne se ferme pas (${(100 * gap(Lp, Rp)).toFixed(0)} cm entre lying et rise)`);
  }
  if (kind === 'trebuche') {
    const C = p.atC, dip = p.start.pelvis[1] - C.pelvis[1];
    if (!(C.chest[2] < C.pelvis[2] - 0.14)) issues.push(`trébuchement : le buste ne plonge pas (${(C.pelvis[2] - C.chest[2]).toFixed(2)} m devant le bassin)`);
    if (!(dip > 0.04 && dip < 0.18)) issues.push(`trébuchement : le bassin ne s'affaisse pas comme il faut (${(dip * 100).toFixed(0)} cm)`);
    if (!(p.end.chest[2] > p.end.pelvis[2] - 0.08)) issues.push('trébuchement : il ne se rattrape pas (buste encore devant à la fin)');
    const stepR = Math.max(...p.series.map((s) => -s.rf[2])), stepL = Math.max(...p.series.map((s) => -s.lf[2]));
    if (!(stepR > 0.25 && stepL > 0.2)) issues.push(`trébuchement : pas deux appuis devant (droit ${stepR.toFixed(2)}, gauche ${stepL.toFixed(2)} m)`);
  }
  if (kind === 'epaule') {
    const C = p.atC, S0 = p.start;
    if (!(C.rs[0] - S0.rs[0] > 0.10)) issues.push(`épaule : l'épaule droite ne sort pas (${((C.rs[0] - S0.rs[0]) * 100).toFixed(0)} cm à droite)`);
    if (!(C.rs[1] < S0.rs[1] - 0.03)) issues.push('épaule : l\'épaule droite ne descend pas');
    if (!(C.rf[0] - S0.rf[0] > 0.12)) issues.push('épaule : l\'appui droit ne s\'écarte pas');
    if (!(Math.abs(p.end.rs[0] - S0.rs[0]) < 0.03)) issues.push('épaule : il ne se redresse pas');
  }
  if (kind === 'protection') {
    const H = p.atH, S0 = p.start;
    if (!(H.rh[0] > 0.42 && H.rh[2] > H.pelvis[2] + 0.10)) issues.push(`bouclier : le bras droit n'est pas tendu vers l'arrière-droite (main à ${H.rh[0].toFixed(2)} à droite, ${(H.rh[2] - H.pelvis[2]).toFixed(2)} derrière)`);
    if (!(len(sub(H.rh, H.rs)) > 0.44)) issues.push(`bouclier : le bras n'est pas tendu (${(len(sub(H.rh, H.rs)) * 100).toFixed(0)} cm épaule-main)`);
    if (!(H.rs[2] > H.ls[2] + 0.08)) issues.push(`bouclier : le tronc ne tourne pas à l'opposé (épaule droite ${((H.rs[2] - H.ls[2]) * 100).toFixed(0)} cm derrière la gauche)`);
    if (!(Math.abs(p.end.rh[0] - S0.rh[0]) < 0.06)) issues.push('bouclier : le bras ne revient pas');
  }
  return { ok: issues.length === 0, issues, portrait: p };
}
