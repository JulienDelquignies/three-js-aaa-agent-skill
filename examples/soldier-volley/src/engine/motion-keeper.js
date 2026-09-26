// motion-keeper — LES MAINS DU GARDIEN : plongeons, prise aérienne, parades — générés.
//
// Un plongeon a cinq temps que la scène et la sim exploitent tels quels : (1) l'IMPULSION — le corps
// PLIE (bassin −26 à −34 cm, genoux ~75°), buste devant, bras bas ; (2) la DÉTENTE latérale — le
// bassin PART sur le côté (root motion, jusqu'à 1,35-1,5 m : au-delà c'est le métier des bras) en
// montant (aérien : +28 cm) ou en rasant (bas : −50 cm), le corps ROULE sur le flanc, les jambes
// s'allongent, les BRAS S'ÉTIRENT le long de l'axe du corps vers le ballon — au contact (0,5-0,55)
// les gants sont au bout ; (3) la CHUTE — le bassin retombe au tapis (−68/−72 cm), roulé à 80° ;
// (4) le SOL — pose tenue jusqu'à `rise` (la scène y gèle tant que la sim garde le corps au sol,
// gk.rise) ; (5) le RELEVÉ par étapes (rouler → appui bras → genou → debout), SUR PLACE : le
// bassin garde son décalage latéral (la sim a transporté l'origine au même point, le rendu dessine
// clip − voyage). La PRISE AÉRIENNE est une détente verticale : bras au-dessus de la tête AVANT le
// contact, retombée SUR SES APPUIS. Les PARADES sont des réflexes debout : la jambe qui claque
// latérale, la poitrine qui encaisse.
//
// Même machine (rampes C¹, articulations conjuguées, emitSpec, style par joueur). Le plongeon est
// écrit à DROITE (+X) ; le miroir d'animkit inverse le root motion latéral (verify-animkit).

import { rx, ry, rz, chain, fkPose, jointToSpec } from './motion-rig.js';
import { ramp, bump, emitSpec, armJoints, bodyPortrait, bodyIssues, NEUTRAL_STYLE } from './motion-strike.js';
import { solveLeg, applyLeg, applyLegBetween } from './motion-skill.js';
import { hyp } from './hyp.js';

export const KEEPER_KINDS = {
  plongeon:        { duration: 1.6, contact: 0.55, rise: 1.2, dive: true, crouch: 0.25, dip: 0.26, lateral: 1.35, apex: 0.28, lying: -0.68, tLie: 0.9, roll: 80, rollC: 62, hands: 2, ball: [1.95, 1.05, -0.1] },
  plongeonBas:     { duration: 1.4, contact: 0.5,  rise: 1.1, dive: true, crouch: 0.2,  dip: 0.34, lateral: 1.15, apex: -0.5, lying: -0.72, tLie: 0.85, roll: 82, rollC: 100, topL: 156, hands: 2, low: true, ball: [1.7, 0.2, -0.1] },   // (A10 bis) rollC 100 : la poitrine se tourne vers le sol dans la détente basse, le bras du dessus (topL) suit l'axe — les deux mains au ras du ballon (mesuré : main du dessus 0,92 → 0,33 m pour un ballon à 0,20)
  plongeonUneMain: { duration: 1.6, contact: 0.55, rise: 1.2, dive: true, crouch: 0.25, dip: 0.26, lateral: 1.5,  apex: 0.26, lying: -0.68, tLie: 0.9, roll: 82, rollC: 64, hands: 1, ball: [2.2, 1.1, -0.1] },
  plongeonPrise:   { duration: 1.3, contact: 0.5,  jump: true, crouch: 0.2, dip: 0.3, lateral: 0.72, apex: 0.55, tLand: 0.85, ball: [0.75, 2.05, -0.2] },
  sortiePoing:     { duration: 1.32, contact: 0.62, jump: true, punch: true, crouch: 0.26, dip: 0.3, lateral: 0.6, apex: 0.5, tLand: 0.94, kneeUp: 72, aE: 186, aF0: 50, aF1: -20, eb0: 30, eb1: 30, armEnd: 0.0, thruW: 0.16, ball: [0.7, 2.0, -0.25] },   // (C3) LA SORTIE DU POING : le saut à un genou levé, les deux poings serrés devant-haut, le coup À TRAVERS le ballon au contact
  paradePieds:     { duration: 0.7, contact: 0.22, kick: true, reach: 0.78, dip: 0.08, ball: [0.85, 0.15, -0.12] },
  paradeBuste:     { duration: 0.8, contact: 0.3,  chest: true, dip: 0.06, ball: [0.0, 1.22, -0.36] },
  // (2026-09-26) LE BLOC EN CROIX DU FUTSAL (« parada en cruz ») : face au tir de près, le gardien TOMBE sur le genou arrière pendant que la
  // jambe du côté du ballon s'allonge au ras du sol, bras écartés — il barre le sol et le petit filet. Un RÉFLEXE : contact à 0,24 s (0,18 dépassait le plafond de vitesse angulaire des membres de checkClip : 37 rad/s > 30).
  blocCroix:       { duration: 1.25, contact: 0.24, croix: true, drop: 0.44, reach: 0.95, hold: 0.62, ball: [0.8, 0.2, -0.1] },
};

function trunk(J, { lean = 0, side = 0, yaw = 0, headDown = 0 }) {
  for (const [b, w] of [['Spine', 0.35], ['Spine1', 0.35], ['Spine2', 0.30]]) J[b] = chain(ry(yaw * w), rz(side * w), rx(-lean * w));
  J.Neck = rx(-headDown * 0.25);
  J.Head = rx(-headDown * 0.75);
}
const I = [0, 0, 0, 1];

/** GÉNÉRER un geste de gardien (plongeon à DROITE — le miroir d'animkit fait la gauche). */
export function generateKeeper(kindName, P, { style = NEUTRAL_STYLE, fps = 60 } = {}) {
  const K = KEEPER_KINDS[kindName];
  if (!K) throw new Error(`motion-keeper : espèce inconnue « ${kindName} »`);
  const S = { ...NEUTRAL_STYLE, ...style };
  const tc = K.contact, T = K.duration;
  const restR = P.bones.RightFoot.bindP, restL = P.bones.LeftFoot.bindP;
  let poseAt, ik, marks = [];

  if (K.dive || K.jump) {
    const tCr = K.crouch, dip = K.dip * (0.9 + 0.1 * S.dip), L = K.lateral * (0.97 + 0.03 * S.backswing);
    const crouch = (t) => ramp(t, 0, 0.6 * tCr, tCr);
    const fly = (t) => ramp(t, tCr, tCr + 0.45 * (tc - tCr), tc);       // la détente : pic de vitesse tôt
    // le voyage latéral COMMENCE pendant l'impulsion (le gardien charge déjà de côté) : checkClip borne la
    // vitesse du bassin à 6,5 m/s entre clés — 1,35 m en 0,3 s à pic de cosinus en ferait 9
    const lat = (t) => L * ramp(t, (L >= 1.4 ? 0.1 : 0.3) * tCr, tCr + 0.4 * (tc - tCr), tc + 0.03);
    if (K.dive) {
      const tLie = K.tLie, tR = K.rise;
      const fall = (t) => ramp(t, tc, (tc + tLie) / 2, tLie);
      // le relevé par ÉTAPES : rouler (0-25 %), appui bras + genou (25-60 %), debout (60-100 %)
      const upA = (t) => ramp(t, tR, tR + 0.22 * (T - tR), tR + 0.44 * (T - tR));
      const upB = (t) => ramp(t, tR + 0.34 * (T - tR), tR + 0.54 * (T - tR), tR + 0.74 * (T - tR));
      const upC = (t) => ramp(t, tR + 0.64 * (T - tR), tR + 0.84 * (T - tR), T);
      const hipsOf = (t) => {
        const y = -dip * crouch(t) * (1 - fly(t)) + K.apex * fly(t) * (1 - fall(t)) + K.lying * fall(t);
        // le relevé : le bassin remonte par étapes (−0,68 → −0,45 → −0,2 → 0)
        const yUp = y * (1 - upA(t)) + (K.lying * 0.66) * upA(t) * (1 - upB(t)) + (K.lying * 0.3) * upB(t) * (1 - upC(t));
        return [lat(t), yUp, 0];
      };
      const rollOf = (t) => { const r = K.rollC * fly(t) * (1 - fall(t)) + K.roll * fall(t); return r * (1 - upA(t)) + K.roll * 0.75 * upA(t) * (1 - upB(t)) + K.roll * 0.4 * upB(t) * (1 - upC(t)) + K.roll * 0.15 * upC(t) * (1 - ramp(t, tR + 0.66 * (T - tR), tR + 0.83 * (T - tR), T)); };
      const solCr = solveLeg(P, 'Left', hipsOf(tCr), I, { p: restL }), solCrR = solveLeg(P, 'Right', hipsOf(tCr), I, { p: restR });
      // la jambe du DESSOUS (droite) se serre vers l'autre (adduction = vers le haut en monde), plus encore sur le plongeon bas
      const flight = (side) => ({ Rthigh: chain(rx(side === 'Right' ? 16 : 12), rz(side === 'Right' ? (K.low ? -24 : -12) : -4)), Rshank: rx(side === 'Right' ? -18 : -12), Rfoot: rx(-14) });
      const lying = (side) => ({ Rthigh: chain(rx(side === 'Right' ? 14 : 10), rz(side === 'Right' ? -20 : -6)), Rshank: rx(side === 'Right' ? -10 : -6), Rfoot: rx(-8) });
      // LE RELEVÉ : les pieds vont de leur place couchée à leur place DEBOUT (décalée de L) au ras du sol,
      // par IK — les genoux se replient sous le corps d'eux-mêmes pendant que le bassin remonte et déroule
      const tail = T - tR;
      // une cible de pied hors de portée tend la jambe d'un coup : toute cible IK du plongeon reste à 96 % de la jambe depuis la hanche DE L'INSTANT
      const Lleg = P.lengths.thigh + P.lengths.shank;
      const clampReach = (side, p, t) => {
        const hip = fkPose(P, { Hips: jointToSpec(P, 'Hips', chain(rz(-rollOf(t)))) }, hipsOf(t))[`${side}UpLeg`].p;
        const d = [p[0] - hip[0], p[1] - hip[1], p[2] - hip[2]], n = Math.hypot(...d), m = 0.96 * Lleg;
        return n > m ? [hip[0] + d[0] / n * m, hip[1] + d[1] / n * m, hip[2] + d[2] / n * m] : p;
      };
      const JL = { Hips: chain(rz(-K.roll)) };
      for (const side of ['Left', 'Right']) { const l = lying(side); JL[`${side}UpLeg`] = l.Rthigh; JL[`${side}Leg`] = l.Rshank; JL[`${side}Foot`] = l.Rfoot; }
      const wLie = fkPose(P, Object.fromEntries(Object.entries(JL).map(([b, q]) => [b, jointToSpec(P, b, q)])), [L, K.lying, 0]);
      const footLie = { Left: wLie.LeftFoot.p, Right: wLie.RightFoot.p };
      const standP = (side) => (side === 'Left' ? [restL[0] + L, restL[1], restL[2]] : [restR[0] + L, restR[1], restR[2]]);
      const gather = (t) => ramp(t, tR, tR + 0.35 * tail, tR + (K.low ? 0.8 : 0.7) * tail);
      const footT = (side, t) => { const g = gather(t), a0 = footLie[side], a1 = standP(side); return clampReach(side, [a0[0] + (a1[0] - a0[0]) * g, Math.max(a1[1], a0[1] + (a1[1] - a0[1]) * g) + 0.03 * bump(t, tR, tR + 0.35 * tail, tR + 0.75 * tail), a0[2] + (a1[2] - a0[2]) * g], t); };
      const pole = (side) => (side === 'Left' ? [-0.15, 0.25, -1] : [0.15, 0.25, -1]);
      // la chute : des jambes de vol (joint space) vers la solution IK du pied couché (même pole que le
      // relevé — le tapis et le relevé sont alors UNE seule chaîne IK continue)
      const restOf = (side) => (side === 'Left' ? restL : restR);
      const slideT = (side, t) => { const u = ramp(t, tCr, (tCr + tLie) / 2, tLie), a0 = restOf(side), a1 = footLie[side]; return clampReach(side, [a0[0] + (a1[0] - a0[0]) * u, Math.max(a0[1] + (a1[1] - a0[1]) * u, a0[1]) + 0.05 * bump(t, tCr, (tCr + tc) / 2, tLie), a0[2] + (a1[2] - a0[2]) * u], t); };
      const legAt = (side, t) => {
        const f = fly(t), fa = fall(t);
        if (t < tCr || K.low) return null;                              // planté (IK) ; plongeon bas : les pieds rasent le sol (IK) jusqu'au tapis
        if (t <= tc) return { from: side === 'Left' ? solCr : solCrR, to: flight(side), u: f };
        if (t < tLie) return { from: flight(side), to: solveLeg(P, side, hipsOf(t), chain(rz(-rollOf(t))), { p: clampReach(side, footLie[side], t), pole: pole(side) }), u: fa };
        return null;                                                    // couché puis relevé : IK
      };
      poseAt = (t) => {
        const cr = crouch(t) * (1 - fly(t)), f = fly(t), fa = fall(t), a = upA(t), b = upB(t), c = upC(t);
        const J = {};
        J.Hips = chain(rz(-rollOf(t)), rx(6 * f * (1 - fa) * 0 + 0));
        // le buste : penché devant à l'impulsion, s'aligne dans la détente (léger cambré), se replie au relevé
        trunk(J, { lean: 16 * S.lean * cr - 6 * f * (1 - fa) + 10 * a * (1 - b) + 22 * b * (1 - c) + 12 * c * (1 - ramp(t, tR + 0.66 * (T - tR), tR + 0.83 * (T - tR), T)), side: -(K.hands === 1 ? 22 : 16) * f * (1 - a), headDown: 8 * cr - 4 * f * (1 - fa) + 4 * c });
        // les bras : bas et derrière à l'impulsion, ÉTIRÉS le long de l'axe du corps vers le ballon dans la détente
        // (une main : le bras du bas tendu à fond, l'autre replié sur la poitrine), puis les appuis du relevé
        const armUp = ramp(t, 0.05 * tCr, tCr + 0.4 * (tc - tCr), tc);
        const relax = fall(t) * 0.45;                                    // au tapis les bras retombent à l'horizontale (devant la tête)
        const ext = armUp * (1 - relax) * (1 - a), rl = 0;
        const stage = (vA, vB, vC) => vA * a * (1 - b) + vB * b * (1 - c) + vC * c * (1 - ramp(t, tR + 0.66 * (T - tR), tR + 0.83 * (T - tR), T));
        const topL = K.hands === 1 ? 46 : (K.low ? (K.topL ?? 126) : 162) * Math.min(S.armElev, 1.04), topR = K.hands === 1 ? 170 : (K.low ? 148 : 164) * Math.min(S.armElev, 1.04);   // (A10 bis) plongeon bas : le bras du DESSUS croise devant la poitrine vers le ballon au sol (mesuré : main gauche à 1,2 m de haut, vers la barre, pour un ballon à 20 cm)
        const elevL = 20 * cr + topL * ext + topL * 0.6 * rl + (K.low ? stage(42, 30, 14) : stage(52, 36, 18));   // (A10 bis) un étirement TARDIF du bras du dessus (ext²) a été essayé et refusé : 14 rad/s sur 8 styles / 40 — la poitrine tournée (rollC 100) fait le travail
        const elevR = 20 * cr + topR * ext + topR * 0.6 * rl + (K.low ? stage(42, 30, 14) : stage(52, 36, 18));
        Object.assign(J,
          armJoints('Left', { elev: 14 + elevL, fwd: -10 * cr + (K.hands === 1 ? 60 : K.low ? (K.fwdL ?? 46) : 8) * (ext + rl) + stage(24, 20, 8), elbow: 14 - 6 * ext + (K.hands === 1 ? 100 : 0) * (ext + 0.7 * rl) + stage(20, 16, 6) }),
          armJoints('Right', { elev: 14 + elevR, fwd: -10 * cr + 8 * (ext + rl) + stage(24, 20, 8), elbow: 14 - 6 * ext + stage(20, 16, 6) }));
        J.LeftShoulder = I; J.RightShoulder = I;
        for (const side of ['Left', 'Right']) { const lg = legAt(side, t); if (lg) applyLegBetween(J, side, lg.from, lg.to, lg.u); }
        return { J, hips: hipsOf(t) };
      };
      ik = (t) => (t < tCr ? { Left: [restL[0], restL[1], restL[2]], Right: [restR[0], restR[1], restR[2]] }
        : t >= tLie ? { Left: { p: footT('Left', t), pole: pole('Left') }, Right: { p: footT('Right', t), pole: pole('Right') } }
        : K.low ? { Left: { p: slideT('Left', t), pole: pole('Left') }, Right: { p: slideT('Right', t), pole: pole('Right') } } : { Left: null, Right: null });
      marks = [tLie, tR];
    } else {
      // LA PRISE AÉRIENNE : détente verticale, bras au-dessus de la tête AVANT le contact, retombée sur ses appuis
      const tLand = K.tLand;
      const land = (t) => ramp(t, tc, (tc + tLand) / 2, tLand), settle = (t) => ramp(t, tLand, (tLand + T) / 2, T);
      const hipsOf = (t) => [lat(t), -dip * crouch(t) * (1 - fly(t)) + K.apex * fly(t) * (1 - land(t)) - 0.06 * bump(t, tLand - 0.05, tLand + 0.1, T), 0];
      const solCr = solveLeg(P, 'Left', hipsOf(tCr), I, { p: restL }), solCrR = solveLeg(P, 'Right', hipsOf(tCr), I, { p: restR });
      // (C3) LE POING : un genou (gauche) levé dans la détente — la jambe de protection du gardien qui sort dans la foule
      const flight = (side) => (K.punch && side === 'Left' ? { Rthigh: rx(K.kneeUp ?? 72), Rshank: rx(-(K.kneeUp ?? 72) - 18), Rfoot: rx(-10) }
        : { Rthigh: rx(side === 'Right' ? 18 : 14), Rshank: rx(side === 'Right' ? -22 : -16), Rfoot: rx(-12) });
      const aEnd = K.armEnd ?? 0.08, tW = K.thruW ?? 0.08;
      const armsUp = (t) => ramp(t, 0.02, 0.5 * (tc - aEnd), tc - aEnd);   // les bras PASSENT au-dessus de la tête dès l'impulsion (sous 14 rad/s)
      const thru = (t) => (K.punch ? ramp(t, tc - tW, tc, tc + 0.75 * tW) : 0);   // (C3) le coup : les coudes pliés se DÉTENDENT au contact, les poings traversent
      poseAt = (t) => {
        const cr = crouch(t) * (1 - fly(t)), f = fly(t), ld = land(t), st = settle(t), dn = K.punch ? ramp(t, tc + 0.12, (tc + 0.12 + T) / 2, T) : ld, au = armsUp(t) * (1 - dn), th = thru(t) * (1 - dn);   // (C3) le poing redescend LENTEMENT (178° en 0,3 s de retombée : 14 rad/s au bras — mesuré)
        const J = {};
        trunk(J, { lean: 14 * S.lean * cr - 8 * f * (1 - ld) + 8 * ld * (1 - st), headDown: 6 * cr - 12 * au + 4 * ld * (1 - st) });
        // les bras : au-dessus de la tête (les deux, paumes au ballon), puis REDESCENDENT avec le ballon tenu contre la poitrine —
        // le poing : les deux bras serrés devant-haut, coudes pliés, qui se détendent au contact et retombent sans rien tenir
        const hold = K.punch ? 0 : ld * (1 - st);
        const aE = K.punch ? (K.aE ?? 150) : 132, aF = K.punch ? (K.aF0 ?? 10) * (1 - th) + (K.aF1 ?? 40) * th : 12, aB = K.punch ? (K.eb0 ?? 60) * (1 - th) + (K.eb1 ?? 25) * th : 4;   // (C3) le poing : bras hauts et serrés, le coup part de l'épaule (fwd) et du coude au contact
        Object.assign(J,
          armJoints('Left', { elev: 14 + aE * Math.max(0.97, Math.min(S.armElev, 1.04)) * au + 36 * hold, fwd: aF * au + 46 * hold, elbow: 14 + aB * au + 96 * hold, rot: K.punch ? 18 * au : 0 }),
          armJoints('Right', { elev: 14 + (aE + 2) * Math.max(0.97, Math.min(S.armElev, 1.04)) * au + 36 * hold, fwd: aF * au + 46 * hold, elbow: 14 + aB * au + 96 * hold, rot: K.punch ? 18 * au : 0 }));
        J.LeftShoulder = I; J.RightShoulder = I;
        if (t >= tCr && t <= tc) for (const side of ['Left', 'Right']) applyLegBetween(J, side, side === 'Left' ? solCr : solCrR, flight(side), f);
        else if (t > tc && t < tLand) for (const side of ['Left', 'Right']) applyLegBetween(J, side, flight(side), solveLeg(P, side, hipsOf(t), I, { p: side === 'Left' ? [restL[0] + L, restL[1], restL[2]] : [restR[0] + L, restR[1], restR[2]] }), ld);
        return { J, hips: hipsOf(t) };
      };
      // les pieds : plantés au sol à l'impulsion, en l'air (joint space) pendant le vol, REPLANTÉS à la retombée là où le corps est (décalé de L)
      ik = (t) => (t < tCr ? { Left: [restL[0], restL[1], restL[2]], Right: [restR[0], restR[1], restR[2]] }
        : t >= tLand ? { Left: [restL[0] + L, restL[1], restL[2]], Right: [restR[0] + L, restR[1], restR[2]] } : { Left: null, Right: null });
      marks = [tLand];
    }
  } else if (K.kick) {
    // LA PARADE DES PIEDS : la jambe droite CLAQUE latérale tendue au ras du sol, le corps contre-penche, les bras équilibrent
    const dip = K.dip * S.dip;
    const out = (t) => ramp(t, 0, 0.6 * tc, tc), back = (t) => ramp(t, tc + 0.06, (tc + T) / 2, T);
    const target = [K.reach * (0.95 + 0.05 * S.backswing), P.lengths.groundY + 0.14, -0.10];
    const hipsOf = (t) => [-0.05 * out(t) * (1 - back(t)), -dip * out(t) * (1 - back(t)), 0];
    const solOut = solveLeg(P, 'Right', hipsOf(tc), I, { p: target, foot: rx(22), pole: [0, 1, -0.4] });
    poseAt = (t) => {
      const on = out(t) * (1 - back(t));
      const J = {};
      trunk(J, { lean: 6 * on, side: 12 * on, headDown: 6 * on });   // contre-penche à GAUCHE
      Object.assign(J, armJoints('Left', { elev: 14 + 46 * S.armElev * on, fwd: 6 + 14 * on, elbow: 14 + 18 * on }), armJoints('Right', { elev: 14 + 40 * on, fwd: 6 - 16 * on, elbow: 14 + 10 * on }));
      J.LeftShoulder = I; J.RightShoulder = I;
      applyLeg(J, 'Right', solOut, on);
      return { J, hips: hipsOf(t) };
    };
    ik = () => ({ Left: [restL[0], restL[1], restL[2]], Right: null });
  } else if (K.croix) {
    // LE BLOC EN CROIX : chute rapide (0 → contact), la jambe droite glisse latérale tendue au ras du sol, le genou gauche au tapis sous le
    // bassin (tibia derrière), le tronc droit penché d'un rien vers le ballon, les bras en croix bas ; tenu, puis on se relève sur place
    const down = (t) => ramp(t, 0, 0.55 * tc, tc), up = (t) => ramp(t, K.hold, (K.hold + T) / 2, T), on = (t) => down(t) * (1 - up(t));
    const hipsOf = (t) => [0.10 * on(t), -K.drop * on(t), 0.04 * on(t)];
    const g = P.lengths.groundY;
    // les pieds suivent des TRAJECTOIRES (IK à chaque image, pas un mélange d'angles — le mélange faisait passer l'orteil arrière 15 cm sous
    // la pelouse au relevé) : le pied du bloc GLISSE au ras du sol jusqu'à `reach`, le pied arrière recule sous le genou en arc (+8 cm au milieu)
    const kneel = [restL[0] + 0.02, g + 0.05, 0.42], out = [K.reach, g + 0.07, -0.04];
    const lerp3 = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
    poseAt = (t) => {
      const o = on(t), J = {}, h = hipsOf(t);
      trunk(J, { lean: 8 * o, side: -8 * o, headDown: 10 * o });
      Object.assign(J, armJoints('Right', { elev: 14 + 46 * o, fwd: 6 + 18 * o, elbow: 14 + 6 * o }), armJoints('Left', { elev: 14 + 56 * S.armElev * o, fwd: 6 + 10 * o, elbow: 14 + 8 * o }));
      J.LeftShoulder = I; J.RightShoulder = I;
      if (o > 1e-4) {
        const pR = lerp3(restR, out, o), pL = lerp3(restL, kneel, o); pL[1] += 0.08 * Math.sin(Math.PI * o) * (1 - o);
        applyLeg(J, 'Right', solveLeg(P, 'Right', h, I, { p: pR, foot: rx(10 * o), pole: [0, 1, -0.3] }), 1);
        applyLeg(J, 'Left', solveLeg(P, 'Left', h, I, { p: pL, foot: rx(95 * o), pole: [0, 0.2 + 0.8 * (1 - o), -1] }), 1);
      }
      return { J, hips: h };
    };
    ik = (t) => (on(t) < 1e-3 ? { Left: [restL[0], restL[1], restL[2]], Right: [restR[0], restR[1], restR[2]] } : { Left: null, Right: null });
  } else if (K.chest) {
    // LE BLOCAGE DU BUSTE : la poitrine ENCAISSE — buste bombé, coudes serrés devant, genoux souples ; le recul au contact, puis on se rassemble
    const dip = K.dip * S.dip;
    const arm = (t) => ramp(t, 0, 0.6 * 0.18, 0.18), take = (t) => ramp(t, 0.18, tc, tc + 0.05), gather = (t) => ramp(t, tc + 0.1, (tc + T) / 2, T);
    poseAt = (t) => {
      const a = arm(t) * (1 - gather(t)), tk = take(t) * (1 - gather(t));
      const J = {};
      trunk(J, { lean: -12 * S.lean * a + 16 * tk, headDown: -6 * a + 8 * tk });   // cambré puis « prend »
      Object.assign(J, armJoints('Left', { elev: 14 + 4 * a, fwd: 6 + 24 * a + 6 * tk, elbow: 14 + 50 * a + 8 * tk, rot: 24 * a }), armJoints('Right', { elev: 14 + 4 * a, fwd: 6 + 24 * a + 6 * tk, elbow: 14 + 50 * a + 8 * tk, rot: 24 * a }));
      J.LeftShoulder = I; J.RightShoulder = I;
      return { J, hips: [0, -dip * Math.max(a, tk), 0.05 * tk] };
    };
    ik = () => ({ Left: [restL[0], restL[1], restL[2]], Right: [restR[0], restR[1], restR[2]] });
  }
  const keys = emitSpec(P, { duration: T, contact: tc, fps, poseAt, ik, marks });
  const spec = { name: kindName, duration: T, contact: tc, foot: 'none', generated: true, family: 'keeper', keys };
  if (K.rise != null) spec.rise = K.rise;   // la scène gèle ici pendant le sol et rejoue la queue sur la durée du relevé sim (gk.rise)
  return spec;
}

/** Le portrait : la détente, les gants, le roulis, le tapis, le relevé. */
export function keeperPortrait(spec, P) {
  const K = KEEPER_KINDS[spec.name] || {};
  const body = bodyPortrait(spec, P, { support: K.kick ? 'Left' : K.chest ? 'Left' : null });
  const ground = P.lengths.groundY;
  const near = (t) => body.samples.reduce((b, x) => (Math.abs(x.t - t) < Math.abs(b.t - t) ? x : b), body.samples[0]);
  const hipsAt = (t) => { const k = spec.keys.reduce((b, x) => (x.t <= t + 1e-9 ? x : b), spec.keys[0]); return k.hips || [0, 0, 0]; };
  const rollOf = (w) => Math.abs(Math.atan2(w.RightShoulder.p[1] - w.LeftShoulder.p[1], w.RightShoulder.p[0] - w.LeftShoulder.p[0])) * 180 / Math.PI;
  const wC = near(spec.contact).w, w0 = body.samples[0].w, wE = body.samples.at(-1).w;
  const hC = hipsAt(spec.contact);
  const handReach = Math.max(wC.LeftHand.p[0], wC.RightHand.p[0]) - wC.Hips.p[0];   // la main la plus loin vers +X (le côté du plongeon), depuis le bassin
  const handsAboveHead = Math.min(wC.LeftHand.p[1], wC.RightHand.p[1]) - wC.Head.p[1];
  const rollC = rollOf(wC);
  const wL = K.tLie ? near(K.tLie).w : wC;
  const pelvisLie = K.tLie ? (hipsAt(K.tLie)[1]) : 0, rollLie = K.tLie ? rollOf(wL) : 0;
  const pelvisE = hipsAt(spec.duration)[1], rollE = rollOf(wE);
  const feetE = Math.max(Math.abs(wE.LeftFoot.p[1] - w0.LeftFoot.p[1]), Math.abs(wE.RightFoot.p[1] - w0.RightFoot.p[1]));
  // le pied qui claque (parade), la tête derrière le bassin (buste), la retombée sur les appuis (prise)
  const footOutC = wC.RightFoot.p[0], footHC = wC.RightFoot.p[1] - ground;
  const kneeC = spec.keys.find((k) => Math.abs(k.t - spec.contact) < 1e-6)?.pose.RightLeg?.[0] ?? 0;
  let headBackMax = -Infinity, handsFrontC = 0;
  for (const { t, w } of body.samples) if (t < spec.contact) headBackMax = Math.max(headBackMax, w.Head.p[2] - w.Hips.p[2]);
  handsFrontC = -(Math.max(wC.LeftHand.p[2], wC.RightHand.p[2]) - wC.Spine2.p[2]);
  let landed = 0;
  if (K.tLand) { const wLand = near(K.tLand + 0.05).w; landed = Math.max(wLand.LeftFoot.p[1] - w0.LeftFoot.p[1], wLand.RightFoot.p[1] - w0.RightFoot.p[1]); }
  const dipMin = spec.keys.reduce((m, k) => Math.min(m, k.hips?.[1] ?? 0), 0);
  // (C3) le poing : l'écart des deux mains au contact, le coup À TRAVERS (les mains avancent de −0,06 à +0,06 s autour du contact, vers −Z) et le genou levé
  const fistsGap = hyp(wC.LeftHand.p[0] - wC.RightHand.p[0], wC.LeftHand.p[1] - wC.RightHand.p[1], wC.LeftHand.p[2] - wC.RightHand.p[2]);
  const zH = (w) => (w.LeftHand.p[2] + w.RightHand.p[2]) / 2, punchThru = zH(near(spec.contact - 0.06).w) - zH(near(spec.contact + 0.06).w);
  const kneeUpH = wC.LeftLeg.p[1] - w0.LeftLeg.p[1], kneeLC = wC.LeftLeg.p[1] - ground;   // (croix) le genou arrière au tapis
  return { ...body, hC, handReach, handsAboveHead, rollC, pelvisLie, rollLie, pelvisE, rollE, feetE, footOutC, footHC, kneeC, headBackMax, handsFrontC, landed, dipMin, fistsGap, punchThru, kneeUpH, kneeLC };
}

/** Le contrat d'un geste de gardien. */
export function checkKeeperGen(spec, P, kindName) {
  const K = KEEPER_KINDS[kindName] || {};
  const p = keeperPortrait(spec, P);
  // du corps commun : la pelouse (un plongeon étire les bras — le coude tendu est le geste ; couché, le cou est au sol)
  const issues = bodyIssues(p, { support: !!(K.kick || K.chest) }).filter((s) => !/pose finale|au-dessus du cou|coude/.test(s) || K.kick || K.chest);
  if (K.dive) {
    if (p.hC[0] < 0.9 * K.lateral) issues.push(`la détente ne COUVRE pas sa distance (bassin à ${p.hC[0].toFixed(2)} m au contact < ${(0.9 * K.lateral).toFixed(2)})`);
    if (K.low ? p.hC[1] > -0.35 : (p.hC[1] < 0.18 || p.hC[1] > 0.4)) issues.push(`la détente n'a pas sa hauteur (bassin ${(100 * p.hC[1]).toFixed(0)} cm au contact, attendu ${K.low ? '≤ −35' : '18-40'})`);
    if (p.handReach < (K.hands === 1 ? 0.95 : K.low ? 0.78 : 0.85)) issues.push(`les gants ne sont pas au bout (main à ${p.handReach.toFixed(2)} m du bassin vers le ballon < ${K.hands === 1 ? 0.95 : K.low ? 0.78 : 0.85})`);
    if (p.rollC < 40) issues.push(`le corps ne se COUCHE pas dans la détente (épaules à ${p.rollC.toFixed(0)}° < 40)`);
    if (p.pelvisLie > -0.6 || p.rollLie < 65) issues.push(`le tapis n'est pas atteint (bassin ${(100 * p.pelvisLie).toFixed(0)} cm, épaules ${p.rollLie.toFixed(0)}° à ${K.tLie} s)`);
    if (Math.abs(p.pelvisE) > 0.04 || p.rollE > 10 || p.feetE > 0.06) issues.push(`le relevé ne remet pas DEBOUT (bassin ${(100 * p.pelvisE).toFixed(0)} cm, épaules ${p.rollE.toFixed(0)}°, pieds ${(100 * p.feetE).toFixed(0)} cm)`);
    if (spec.rise == null || spec.rise <= spec.contact || spec.rise >= spec.duration) issues.push('le clip ne déclare pas son instant de relevé (rise)');
  }
  if (K.jump) {
    if (p.hC[1] < 0.45) issues.push(`la prise ne SAUTE pas (bassin +${(100 * p.hC[1]).toFixed(0)} cm au contact < 45)`);
    if (p.handsAboveHead < (K.punch ? -0.05 : 0.12)) issues.push(`les mains ne sont pas AU-DESSUS de la tête au contact (${(100 * p.handsAboveHead).toFixed(0)} cm < ${K.punch ? -5 : 12})`);
    if (K.punch) {   // (C3) les deux poings serrés, le coup à travers le ballon, un genou levé
      if (p.fistsGap > 0.34) issues.push(`les poings ne sont pas SERRÉS au contact (${(100 * p.fistsGap).toFixed(0)} cm entre les mains > 34)`);
      if (p.punchThru < 0.08) issues.push(`le coup ne TRAVERSE pas le ballon (mains avancées de ${(100 * p.punchThru).toFixed(0)} cm autour du contact < 8)`);
      if (p.kneeUpH < 0.25) issues.push(`le genou ne monte pas (genou gauche à +${(100 * p.kneeUpH).toFixed(0)} cm au contact < 25)`);
    }
    if (p.landed > 0.05) issues.push(`la retombée n'est pas sur les appuis (pied à ${(100 * p.landed).toFixed(0)} cm du sol après l'atterrissage)`);
    if (Math.abs(p.pelvisE) > 0.04 || p.feetE > 0.06) issues.push(`la fin n'est pas debout sur place (bassin ${(100 * p.pelvisE).toFixed(0)} cm, pieds ${(100 * p.feetE).toFixed(0)} cm)`);
  }
  if (K.kick) {
    if (p.footOutC < 0.6) issues.push(`la jambe ne CLAQUE pas latérale (pied à ${p.footOutC.toFixed(2)} m < 0,6)`);
    if (p.footHC > 0.3) issues.push(`la parade des pieds décolle (pied à ${(100 * p.footHC).toFixed(0)} cm > 30)`);
    if (p.kneeC < -14) issues.push(`la jambe n'est pas TENDUE au contact (genou ${p.kneeC.toFixed(0)}° < −14)`);
  }
  if (K.croix) {   // le bloc en croix : la jambe barre le sol, le bassin tombe, le genou au tapis, et l'on se relève debout
    if (p.footOutC < 0.75) issues.push(`la jambe ne BARRE pas le sol (pied à ${p.footOutC.toFixed(2)} m < 0,75)`);
    if (p.footHC > 0.2) issues.push(`la jambe du bloc décolle (pied à ${(100 * p.footHC).toFixed(0)} cm > 20)`);
    if (p.hC[1] > -0.32) issues.push(`le bassin ne tombe pas (${(100 * p.hC[1]).toFixed(0)} cm au contact > −32)`);
    if (p.kneeLC > 0.22) issues.push(`le genou arrière n'est pas au tapis (${(100 * p.kneeLC).toFixed(0)} cm > 22)`);
    if (Math.abs(p.pelvisE) > 0.04 || p.feetE > 0.06) issues.push(`le relevé ne remet pas DEBOUT (bassin ${(100 * p.pelvisE).toFixed(0)} cm, pieds ${(100 * p.feetE).toFixed(0)} cm)`);
  }
  if (K.chest) {
    if (p.headBackMax < 0.03) issues.push(`le buste ne se BOMBE pas avant le contact (tête ${(100 * p.headBackMax).toFixed(0)} cm derrière le bassin < 3)`);
    if (p.handsFrontC < 0.15) issues.push(`les coudes ne sont pas serrés DEVANT (mains ${(100 * p.handsFrontC).toFixed(0)} cm devant la poitrine < 15)`);
    if (p.dipMin > -0.03) issues.push(`les genoux ne sont pas souples (bassin ${(100 * p.dipMin).toFixed(0)} cm > −3)`);
  }
  return { ok: issues.length === 0, issues, portrait: p };
}
