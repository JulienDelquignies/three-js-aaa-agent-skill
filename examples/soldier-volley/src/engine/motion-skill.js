// motion-skill — LES GESTES TECHNIQUES GÉNÉRÉS : un dribble est un CHEMIN DU PIED autour d'un ballon
// qui ne part pas (intent 'carry' — le ballon est manipulé, le corps est tourné par la sim).
//
// Une frappe se pense en articulations (le fouet proximo-distal) ; un geste technique se pense en
// TRAJECTOIRE : la semelle qui se pose SUR le ballon et le tire, la jambe qui décrit un CERCLE
// par-dessus, l'intérieur qui va CHERCHER le ballon de l'autre côté du corps, la pichenette qui
// pousse sec entre deux jambes. Le pied libre suit donc une courbe écrite dans le repère personnage
// (droite +X, haut +Y, avant −Z, le ballon à sa place) et l'IK deux os (motion-strike.legIK, par
// emitSpec) en déduit cuisse et tibia ; l'orientation du pied est ABSOLUE (semelle qui épouse le
// ballon, intérieur tourné vers la coupe). L'appui est planté, le tronc et les bras vendent le
// geste (le buste plonge côté feinte, les bras s'ouvrent en balancier de pivot), le bassin s'abaisse.
// Le LACET du corps (râteau qui se retourne, roulette qui tourne) N'EST PAS ICI : loi 12, la sim
// l'écrit (ownsBody) ; le clip ne porte qu'une anticipation de quelques degrés.
//
// Même machine que motion-strike (rampes C¹, articulations conjuguées, emitSpec, style par joueur) ;
// même sortie (un spec animkit ordinaire — contrats, miroir au pied, horloge de la sim inchangés).
// Le passement à N tours RÉPÈTE son cercle os pour os (verify-gestes compare la clé 0,45 du double
// à la clé 0,15 du simple) : tout ce qui bouge pendant un tour est une fonction de l'instant DU TOUR.

import { rx, ry, rz, chain, fkPose, jointToSpec } from './motion-rig.js';
import { ramp, bump, emitSpec, armJoints, legIK, bodyPortrait, bodyIssues, NEUTRAL_STYLE } from './motion-strike.js';
import { hyp } from './hyp.js';

const BALL_R = 0.11;

/** Les espèces. `ball` = où est le ballon dans le repère personnage (la planche l'y pose). */
export const SKILL_KINDS = {
  // LA SEMELLE : le pied va se poser SUR le ballon (contact) ; le râteau le TIRE ensuite sous le corps
  rateau:       { duration: 0.7,  contact: 0.22, ball: [0.10, BALL_R, -0.34], sole: true, dragTo: -0.06, dragEnd: 0.46, lean: 12, headDown: 14, dip: 0.05, yawDrag: -12 },
  arretSemelle: { duration: 0.85, contact: 0.24, ball: [0.10, BALL_R, -0.30], sole: true, hold: 0.62, headDown: 14, headUp: -5, dip: 0.05 },
  roulette:     { duration: 0.7,  contact: 0.1,  ball: [0.10, BALL_R, -0.26], sole: true, toe: true, dragTo: -0.02, dragEnd: 0.34, pivot: 0.32, armsOpen: 74, dip: 0.10, lean: 10, headDown: 10, marks: [0.32] },
  // LE CERCLE : la jambe passe PAR-DESSUS un ballon qui ne bouge pas, puis se plante à côté
  passementJambes: { duration: 0.66, contact: 0.3, ball: [0.05, BALL_R, -0.40], circle: true, tour: 0.3, tours: 1, entry: 0.15, plant: 0.16, dip: 0.04, sell: 12, plantLean: 8, yawSell: -20, marks: [0.15] },
  // LA COUPE : l'intérieur va chercher le ballon de l'autre côté du corps et le coupe vers la gauche
  crochet:         { duration: 0.55, contact: 0.2,  ball: [0.0, BALL_R, -0.32], cut: true, reach: [0.34, 0.14, -0.28], cross: -0.12, tPlant: 0.36, lean: 14, yawCut: 12, dip: 0.08, headDown: 14 },
  crochetCourt:    { duration: 0.4,  contact: 0.14, ball: [0.0, BALL_R, -0.28], cut: true, reach: [0.27, 0.12, -0.24], cross: -0.07, tPlant: 0.26, lean: 4, yawCut: 4, dip: 0.03, headDown: 12 },
  crochetChaloupe: { duration: 0.8,  contact: 0.42, ball: [0.0, BALL_R, -0.32], cut: true, reach: [0.34, 0.14, -0.28], cross: -0.12, tPlant: 0.58, lean: 12, yawCut: 10, dip: 0.06, headDown: 12, sway: 0.28, swayX: 0.06, swayYaw: 16, swayLean: 8 },
  // LA CROQUETA : deux touches sèches, deux pieds — l'intérieur droit balaie le ballon vers la gauche, le gauche le pousse devant
  doubleContact: { duration: 0.36, contact: 0.18, ball: [0.05, BALL_R, -0.30], croqueta: true, push1: 0.10, lean: 7, dip: 0.04, headDown: 12 },
  // LA PICHENETTE : armé puis extension SÈCHE entre les jambes du fermeur — le corps est déjà bas et penché, les bras restent à la locomotion
  petitPont: { duration: 0.3, contact: 0.12, ball: [0.08, BALL_R, -0.30], flick: true, arm: 0.07, lean: 8, dip: 0.06, noArms: true, headDown: 12, marks: [0.07] },
};
// les passements à N tours (2..6) : le même cercle, répété — durée et contact avancent d'un tour
for (let n = 2; n <= 6; n++) {
  const base = SKILL_KINDS.passementJambes;
  SKILL_KINDS[`passementJambes${n}`] = { ...base, tours: n, duration: +(base.duration + base.tour * (n - 1)).toFixed(4), contact: +(base.contact + base.tour * (n - 1)).toFixed(4), marks: [0.15] };
}

function trunk(J, { lean = 0, side = 0, yaw = 0, headDown = 0, headYaw = 0 }) {
  // lean > 0 = buste en avant ; side > 0 = penche à GAUCHE (rz(+) porte la main gauche vers le bas) ; yaw > 0 = tourne à GAUCHE
  for (const [b, w] of [['Spine', 0.35], ['Spine1', 0.35], ['Spine2', 0.30]]) J[b] = chain(ry(yaw * w), rz(side * w), rx(-lean * w));
  J.Neck = chain(ry(headYaw * 0.3), rx(-headDown * 0.25));
  J.Head = chain(ry(headYaw * 0.7), rx(-headDown * 0.75));
}

const lerp3 = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
/** q^a — la fraction a d'une rotation (pour aller de la pose neutre à une pose résolue en JOINT space :
 *  un chemin de cheville en ligne droite près de l'extension fait exploser la vitesse du genou). */
export const quatScale = (q, a) => {
  const w = Math.max(-1, Math.min(1, q[3])), th = 2 * Math.acos(w), s = Math.sqrt(Math.max(0, 1 - w * w));
  if (s < 1e-6 || th < 1e-6) return [0, 0, 0, 1];
  const ax = [q[0] / s, q[1] / s, q[2] / s], h = 0.5 * a * th;
  return [ax[0] * Math.sin(h), ax[1] * Math.sin(h), ax[2] * Math.sin(h), Math.cos(h)];
};
const qmul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
const qconj = (q) => [-q[0], -q[1], -q[2], q[3]];
const qnorm = (q) => { const n = Math.hypot(q[0], q[1], q[2], q[3]) || 1; return [q[0] / n, q[1] / n, q[2] / n, q[3] / n]; };

/** Résoudre une jambe pour une cible { p, foot?, pole? } exactement comme emitSpec le fera (même hanche,
 *  même parent) — pour interpoler EN JOINT SPACE entre le repos et cette solution. */
export function solveLeg(P, side, hipsCh, RHips, target) {
  const partial = fkPose(P, { Hips: jointToSpec(P, 'Hips', RHips) }, hipsCh);
  const r = legIK(P, side, partial[`${side}UpLeg`].p, RHips, target.p, target.pole || [0, 0, -1]);
  const flat = qnorm(qconj(qmul(qmul(RHips, r.Rthigh), r.Rshank)));
  return { Rthigh: r.Rthigh, Rshank: r.Rshank, Rfoot: target.foot ? qmul(flat, target.foot) : flat };
}
const qslerp = (a, b, u) => {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  if (d < 0) { b = [-b[0], -b[1], -b[2], -b[3]]; d = -d; }
  if (d > 0.9995) return qnorm([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u, a[3] + (b[3] - a[3]) * u]);
  const th = Math.acos(d), s1 = Math.sin((1 - u) * th) / Math.sin(th), s2 = Math.sin(u * th) / Math.sin(th);
  return [a[0] * s1 + b[0] * s2, a[1] * s1 + b[1] * s2, a[2] * s1 + b[2] * s2, a[3] * s1 + b[3] * s2];
};
/** Écrire l'interpolation entre deux solutions de jambe (un pied planté qui part vers une cible, et l'inverse). */
export function applyLegBetween(J, side, from, to, a) {
  J[`${side}UpLeg`] = qslerp(from.Rthigh, to.Rthigh, a); J[`${side}Leg`] = qslerp(from.Rshank, to.Rshank, a); J[`${side}Foot`] = qslerp(from.Rfoot, to.Rfoot, a); J[`${side}ToeBase`] = [0, 0, 0, 1];
}
/** Écrire la fraction a d'une solution de jambe dans J (a = 0 : repos ; a = 1 : la solution). */
export function applyLeg(J, side, sol, a) {
  J[`${side}UpLeg`] = quatScale(sol.Rthigh, a); J[`${side}Leg`] = quatScale(sol.Rshank, a); J[`${side}Foot`] = quatScale(sol.Rfoot, a); J[`${side}ToeBase`] = [0, 0, 0, 1];
}

/** GÉNÉRER un geste technique (pied DROIT — le miroir d'animkit fait le gauche). */
export function generateSkill(kindName, P, { style = NEUTRAL_STYLE, fps = 60 } = {}) {
  const K = SKILL_KINDS[kindName];
  if (!K) throw new Error(`motion-skill : espèce inconnue « ${kindName} »`);
  const S = { ...NEUTRAL_STYLE, ...style };
  const tc = K.contact, T = K.duration;
  const restR = P.bones.RightFoot.bindP, restL = P.bones.LeftFoot.bindP;
  const groundY = P.lengths.groundY;
  const b = K.ball;
  // la cheville quand la SEMELLE est sur le ballon : au-dessus du sommet, l'avant-pied sur la balle
  // (la roulette n'a que 0,1 s : c'est la POINTE qui coiffe le ballon, cheville plus basse, genou moins plié)
  const soleAnkle = (bx, bz) => [bx - 0.02, groundY + 2 * BALL_R + (K.toe ? 0.02 : 0.07), bz + (K.toe ? 0.14 : 0.10)];
  const dip = K.dip * S.dip, reach = 0.9 + 0.1 * S.backswing;
  let poseAt, ik, marks = K.marks || [];

  if (K.sole) {
    // LA SEMELLE : lever, poser sur le ballon (contact), tenir ou tirer, relâcher
    const onBall = lerp3(restR, soleAnkle(b[0], b[2]), reach);
    const tRel = K.hold ?? K.dragEnd;                 // fin de la tenue / du tirage
    const dragged = K.dragTo != null ? soleAnkle(b[0] - 0.03, K.dragTo) : onBall;
    const pitch = K.toe ? 26 : 14;
    const dipAt = (t) => (K.pivot ? dip * bump(t, 0, K.pivot, T) : dip * ramp(t, 0, 0.55 * tc, tc) * (1 - ramp(t, tRel, (tRel + T) / 2, T)));
    // l'APPROCHE se fait en joint space : la pose de contact est résolue une fois (IK), la jambe y va par
    // la fraction q^a de chaque rotation — le genou monte à vitesse bornée (une cheville en ligne droite
    // près de l'extension le fait exploser : 38 rad/s mesurés sur la roulette, qui n'a que 0,1 s)
    const solC = solveLeg(P, 'Right', [0, -dipAt(tc), 0], [0, 0, 0, 1], { p: onBall, foot: rx(-pitch) });
    const footPath = (t) => {
      const drag = K.dragTo != null ? ramp(t, tc, (tc + tRel) / 2, tRel) : 0, back = ramp(t, tRel, (tRel + T) / 2, T);
      const p = lerp3(lerp3(onBall, dragged, drag), restR, back);
      p[1] += 0.10 * bump(t, tRel, (tRel + T) / 2, T);   // le pied s'élève pour revenir
      return p;
    };
    poseAt = (t) => {
      const up = ramp(t, 0, 0.55 * tc, tc), drag = K.dragTo != null ? ramp(t, tc, (tc + tRel) / 2, tRel) : 0, back = ramp(t, tRel, (tRel + T) / 2, T);
      const on = up * (1 - back);
      const J = {};
      if (t < tc) applyLeg(J, 'Right', solC, up);
      const headDown = K.hold ? K.headDown * S.headDown * on * (1 - ramp(t, tc, (tc + tRel) / 2, tRel)) + K.headUp * ramp(t, tc, (tc + tRel) / 2, tRel) * (1 - back) : (K.headDown ?? 12) * S.headDown * on;
      trunk(J, { lean: (K.lean ?? 8) * S.lean * (on + 0.5 * drag) * (K.pivot ? 1 : 1), yaw: (K.yawDrag ?? 0) * drag * (1 - back), headDown });
      J.Hips = ry((K.yawDrag ?? 0) * 0.4 * drag * (1 - back));
      if (K.pivot) {
        // les bras s'ouvrent en balancier de pivot autour du pivot (0,32), se referment à la sortie
        const open = bump(t, tc, K.pivot, tRel + 0.28);
        const elev = 14 + (K.armsOpen * S.armElev - 14) * open;
        Object.assign(J, armJoints('Left', { elev, fwd: 4, elbow: 14 + 10 * open }), armJoints('Right', { elev, fwd: 4, elbow: 14 + 10 * open }));
      } else {
        // le bras d'équilibre opposé monte un peu devant quand le pied va au ballon
        Object.assign(J, armJoints('Left', { elev: 14 + 26 * S.armElev * on, fwd: 6 + 16 * S.armFwd * on, elbow: 14 + 20 * on }), armJoints('Right', { elev: 14 + 8 * on, fwd: 6 - 14 * on, elbow: 14 + 8 * on }));
      }
      J.LeftShoulder = [0, 0, 0, 1]; J.RightShoulder = [0, 0, 0, 1];
      return { J, hips: [0, -dipAt(t), 0] };
    };
    ik = (t) => ({ Left: [restL[0], restL[1], restL[2]], Right: t < tc ? null : { p: footPath(t), foot: rx(-pitch * (1 - ramp(t, tRel, (tRel + T) / 2, T))) } });
  } else if (K.circle) {
    // LE CERCLE : hors du ballon (0), devant (¼), dedans (½ = contact), derrière (¾), hors (1)
    const c = [b[0], groundY + 0.26, b[2] + 0.10], RX = 0.25 * reach, RZ = 0.20 * reach;
    const circle = (u) => { const th = 2 * Math.PI * (u / K.tour); return [c[0] + RX * Math.cos(th), c[1] + 0.07 * Math.sin(th), c[2] - RZ * Math.sin(th)]; };
    const out = circle(0), inn = circle(K.tour / 2);
    const tE = K.entry, tLast = tE + K.tour * (K.tours - 1);        // début du dernier tour
    const tPlant = tLast + K.tour / 2 + K.plant;                     // le pied planté après le dernier passage dedans
    const plantP = [inn[0] + 0.08, restR[1], inn[2] + 0.10];
    const plantDip = 0.04;
    // ce qui bouge PENDANT un tour n'est fonction que de u (le double passement répète le simple os pour os)
    const tourBody = (u) => ({
      side: -K.sell * S.lean * bump(u, 0, 0.08, 0.2) + K.plantLean * bump(u, 0.15, 0.25, 0.3),
      yaw: K.yawSell * bump(u, 0, 0.1, 0.22),
      dip: dip + 0.03 * bump(u, 0, 0.1, 0.22),
      armL: bump(u, 0, 0.14, 0.3),
    });
    const phase = (t) => {
      if (t < tE) return { kind: 'entry', a: ramp(t, 0, 0.6 * tE, tE) };
      const k = Math.min(K.tours - 1, Math.floor((t - tE) / K.tour + 1e-9));
      const u = t - tE - k * K.tour;
      if (k < K.tours - 1 || u <= K.tour / 2 + 1e-9) return { kind: 'tour', u, last: k === K.tours - 1 };
      return { kind: 'exit', t };
    };
    const footPath = (t) => {
      const ph = phase(t);
      if (ph.kind === 'entry') { const p = lerp3(restR, out, ph.a); p[1] += 0.06 * bump(t, 0, 0.5 * tE, tE); return p; }
      if (ph.kind === 'tour') return circle(ph.u);
      const down = ramp(t, tLast + K.tour / 2, tLast + K.tour / 2 + 0.6 * K.plant, tPlant);
      return lerp3(inn, plantP, down);
    };
    const exitDip = (t) => plantDip * ramp(t, tLast + K.tour / 2, tLast + K.tour / 2 + 0.6 * K.plant, tPlant) * (1 - ramp(t, tPlant + 0.02, (tPlant + T) / 2, T));
    const hipsOf = (t) => { const ph = phase(t); if (ph.kind === 'entry') return [0, -tourBody(0).dip * ph.a, 0]; if (ph.kind === 'tour') return [0, -tourBody(ph.u).dip, 0]; const tb = tourBody(Math.min(K.tour, t - tLast)), back = ramp(t, tPlant, (tPlant + T) / 2, T); return [0, -(tb.dip * (1 - back) + exitDip(t)), 0]; };
    const solOut = solveLeg(P, 'Right', hipsOf(tE), [0, 0, 0, 1], { p: out, foot: rx(-10), pole: [0.35, 0, -1] });
    const solPlant = solveLeg(P, 'Right', hipsOf(tPlant), [0, 0, 0, 1], { p: plantP, pole: [0.35, 0, -1] });
    const footPitch = (t) => rx(-10 * (1 - ramp(t, tLast + K.tour / 2, tLast + K.tour / 2 + 0.6 * K.plant, tPlant)));
    poseAt = (t) => {
      const ph = phase(t);
      let body;
      if (ph.kind === 'entry') { const b0 = tourBody(0); body = { side: b0.side * ph.a, yaw: b0.yaw * ph.a, dip: b0.dip * ph.a, armL: b0.armL * ph.a }; }
      else if (ph.kind === 'tour') body = tourBody(ph.u);
      else {   // la sortie CONTINUE le tour (ses bosses s'éteignent d'elles-mêmes), puis tout s'efface vers la fin
        const tb = tourBody(Math.min(K.tour, t - tLast)), back = ramp(t, tPlant, (tPlant + T) / 2, T);
        body = { side: tb.side * (1 - back), yaw: tb.yaw * (1 - back), dip: tb.dip * (1 - back), armL: tb.armL * (1 - back) };
      }
      const J = {};
      trunk(J, { lean: 6, side: body.side, yaw: body.yaw, headDown: 14 * S.headDown });
      J.Hips = ry(body.yaw * 0.5);
      if (ph.kind === 'entry') applyLeg(J, 'Right', solOut, ph.a);
      else if (ph.kind === 'exit' && t > tPlant) applyLeg(J, 'Right', solPlant, 1 - ramp(t, tPlant + 0.02, (tPlant + T) / 2, T));
      Object.assign(J, armJoints('Left', { elev: 14 + 22 * S.armElev * body.armL, fwd: 6 + 8 * body.armL, elbow: 14 + 14 * body.armL }), armJoints('Right', { elev: 14 + 10 * body.armL, fwd: 6 - 8 * body.armL, elbow: 14 + 6 * body.armL }));
      J.LeftShoulder = [0, 0, 0, 1]; J.RightShoulder = [0, 0, 0, 1];
      return { J, hips: hipsOf(t) };
    };
    ik = (t) => { const ph = phase(t); return { Left: [restL[0], restL[1], restL[2]], Right: ph.kind === 'entry' || (ph.kind === 'exit' && t > tPlant) ? null : { p: footPath(t), foot: footPitch(t), pole: [0.35, 0, -1] } }; };
  } else if (K.cut) {
    // LA COUPE : (chaloupe : le buste MENT à droite d'abord) — le pied va au côté droit du ballon, balaie vers la gauche À TRAVERS lui (contact), se plante croisé, revient
    const tSway = K.sway ?? 0, tReach = tSway + 0.55 * (tc - tSway);
    const reachP = [K.reach[0] * reach, restR[1] + K.reach[1] - 0.08, K.reach[2]];
    const contactP = [b[0] + BALL_R + 0.04, restR[1] + 0.04, b[2] + 0.02];
    const crossP = [K.cross, restR[1] + 0.07, b[2] + 0.02];
    const plantP = [Math.max(K.cross + 0.04, -0.08), restR[1], b[2] + 0.14];
    // UN balayage de reachP à crossP : le pic de vitesse tombe SUR le contact, où le pied est AU ballon
    // (ramp vaut (tp − t0)/(t1 − t0) en tp : on choisit la fin du balayage pour que ce soit la fraction du chemin au ballon)
    const alpha = (reachP[0] - contactP[0]) / (reachP[0] - crossP[0]);
    const tCross = Math.min(K.tPlant, tReach + (tc - tReach) / alpha);
    const footPath = (t) => {
      const sweep = ramp(t, tReach, tc, tCross), plant = ramp(t, tCross, (tCross + K.tPlant) / 2, K.tPlant);
      return lerp3(lerp3(reachP, crossP, sweep), plantP, plant);
    };
    const hipsOf = (t) => {
      const sw = tSway ? bump(t, 0, 0.55 * tSway, tSway + 0.08) : 0, cut = ramp(t, tReach, tc, tc + 0.08), back = ramp(t, K.tPlant, (K.tPlant + T) / 2, T);
      return [(K.swayX ?? 0) * sw - 0.04 * cut * (1 - back), -dip * (0.4 * ramp(t, tSway, tc, tc + 0.05) + 0.6 * cut) * (1 - back) - 0.02 * sw, 0];
    };
    const hipsR = (t) => ry(K.yawCut * 0.4 * ramp(t, tReach, tc, tc + 0.08) * (1 - ramp(t, K.tPlant, (K.tPlant + T) / 2, T)));
    const footR = (t) => ry(-24 * bump(t, tReach - 0.02, tc, K.tPlant));
    const solReach = solveLeg(P, 'Right', hipsOf(tReach), hipsR(tReach), { p: reachP, foot: footR(tReach) });
    const solPlant = solveLeg(P, 'Right', hipsOf(K.tPlant), hipsR(K.tPlant), { p: plantP, foot: footR(K.tPlant) });
    poseAt = (t) => {
      const sw = tSway ? bump(t, 0, 0.55 * tSway, tSway + 0.08) : 0;
      const cut = ramp(t, tReach, tc, tc + 0.08), back = ramp(t, K.tPlant, (K.tPlant + T) / 2, T);
      const J = {};
      trunk(J, {
        lean: K.lean * S.lean * (0.5 * ramp(t, tSway, tc, tc + 0.05) + 0.5 * cut) * (1 - back) + 4 * sw,
        side: -(K.swayLean ?? 0) * sw + K.lean * 0.8 * cut * (1 - back),
        yaw: -(K.swayYaw ?? 0) * sw + K.yawCut * cut * (1 - back),
        headDown: K.headDown * S.headDown * (1 - back) * (1 - 0.5 * sw), headYaw: -(K.swayYaw ?? 0) * 0.8 * sw,
      });
      J.Hips = hipsR(t);
      if (t < tReach) applyLeg(J, 'Right', solReach, ramp(t, tSway, (tSway + tReach) / 2, tReach));
      else if (t > K.tPlant) applyLeg(J, 'Right', solPlant, 1 - ramp(t, K.tPlant + 0.02, (K.tPlant + T) / 2, T));
      const bal = cut * (1 - back);
      Object.assign(J, armJoints('Left', { elev: 14 + 28 * S.armElev * bal + 10 * sw, fwd: 6 + 12 * bal, elbow: 14 + 22 * bal }), armJoints('Right', { elev: 14 + 12 * bal + 16 * sw, fwd: 6 - 10 * bal + 8 * sw, elbow: 14 + 10 * bal + 10 * sw }));
      J.LeftShoulder = [0, 0, 0, 1]; J.RightShoulder = [0, 0, 0, 1];
      return { J, hips: hipsOf(t) };
    };
    // l'intérieur tourné vers la coupe : la pointe part à droite pendant le balayage
    ik = (t) => ({ Left: [restL[0], restL[1], restL[2]], Right: t < tReach || t > K.tPlant ? null : { p: footPath(t), foot: footR(t) } });
  } else if (K.croqueta) {
    // LA CROQUETA : jambe droite balaie le ballon vers la gauche (touche 1 à push1), se plante croisée ;
    // le poids transfère ; jambe gauche va au ballon déplacé et le POUSSE devant (touche 2 = contact)
    const t1 = K.push1, tPlantR = t1 + 0.05, tGo = t1 - 0.01, tEnd2 = tc + 0.08, tBack = tEnd2 + 0.02;
    const r1 = [b[0] + BALL_R + 0.05, restR[1] + 0.05, b[2] + 0.02], r2 = [b[0] - 0.18, restR[1] + 0.05, b[2] + 0.02], rPlant = [b[0] - 0.17, restR[1], b[2] + 0.10];
    const l1 = [b[0] - 0.36, restL[1] + 0.05, b[2] + 0.12], l2 = [b[0] - 0.36, restL[1] + 0.04, b[2] - 0.08];
    const tR0 = t1 - 0.06;
    const footR = (t) => { const sweep = ramp(t, tR0, t1, t1 + 0.03), plant = ramp(t, t1 + 0.03, (t1 + 0.03 + tPlantR) / 2, tPlantR); return lerp3(lerp3(r1, r2, sweep), rPlant, plant); };
    const footL = (t) => { const push = ramp(t, tc - 0.01, tc + 0.03, tEnd2); return lerp3(l1, l2, push); };
    const hipsOf = (t) => { const one = bump(t, 0, t1, tc), two = ramp(t, t1, tc, tEnd2) * (1 - ramp(t, tBack, (tBack + T) / 2, T)); return [-0.05 * two, -dip * Math.max(one, two), 0]; };
    const I = [0, 0, 0, 1];
    const footRotR = (t) => ry(-20 * bump(t, t1 - 0.06, t1, t1 + 0.04)), footRotL = (t) => rx(-6 * bump(t, tGo, tc, tEnd2));
    const restSol = (side, t) => solveLeg(P, side, hipsOf(t), I, { p: side === 'Right' ? restR : restL });
    const solR1 = solveLeg(P, 'Right', hipsOf(tR0), I, { p: r1, foot: footRotR(tR0) }), solRPlant = solveLeg(P, 'Right', hipsOf(tBack), I, { p: rPlant, foot: footRotR(tBack) });
    const solL1 = solveLeg(P, 'Left', hipsOf(tc - 0.01), I, { p: l1, foot: footRotL(tc - 0.01) }), solL2 = solveLeg(P, 'Left', hipsOf(tBack), I, { p: l2, foot: footRotL(tBack) });
    poseAt = (t) => {
      const one = bump(t, 0, t1, tc), two = ramp(t, t1, tc, tEnd2) * (1 - ramp(t, tBack, (tBack + T) / 2, T));
      const J = {};
      // le buste VEND : penche à DROITE pendant la touche 1 (le corps ment), à GAUCHE en poussant devant
      trunk(J, { lean: 8 * S.lean * Math.max(one, two), side: -K.lean * one + K.lean * 0.7 * two, yaw: 0, headDown: K.headDown * S.headDown * Math.max(one, two) });
      Object.assign(J, armJoints('Left', { elev: 14 + 20 * S.armElev * one, fwd: 6 + 8 * one, elbow: 14 + 14 * one }), armJoints('Right', { elev: 14 + 20 * S.armElev * two, fwd: 6 + 8 * two, elbow: 14 + 14 * two }));
      J.LeftShoulder = [0, 0, 0, 1]; J.RightShoulder = [0, 0, 0, 1];
      // les jambes : droite repos → r1 (joint), balaie (IK), plantée, retour (joint) ; gauche plantée, → l1 (joint), pousse (IK), retour (joint)
      if (t < tR0) applyLegBetween(J, 'Right', restSol('Right', t), solR1, ramp(t, 0, 0.6 * tR0, tR0));
      else if (t > tBack) applyLegBetween(J, 'Right', restSol('Right', t), solRPlant, 1 - ramp(t, tBack, (tBack + T) / 2, T));
      if (t >= tGo && t < tc - 0.01) applyLegBetween(J, 'Left', restSol('Left', t), solL1, ramp(t, tGo, (tGo + tc - 0.01) / 2, tc - 0.01));
      else if (t > tBack) applyLegBetween(J, 'Left', restSol('Left', t), solL2, 1 - ramp(t, tBack, (tBack + T) / 2, T));
      return { J, hips: hipsOf(t) };
    };
    ik = (t) => ({
      Left: t < tGo ? [restL[0], restL[1], restL[2]] : (t >= tc - 0.01 && t <= tBack ? { p: footL(t), foot: footRotL(t) } : null),
      Right: t >= tR0 && t <= tBack ? { p: footR(t), foot: footRotR(t) } : null,
    });
  } else if (K.flick) {
    // LA PICHENETTE : armé (genou plié, pied sous la hanche) puis extension sèche devant à travers le ballon
    const tA = K.arm, tOut = tc + 0.08;
    const armP = [restR[0] + 0.02, restR[1] + 0.04, restR[2] - 0.10], pushP = [b[0] + 0.03, restR[1] + 0.04, b[2] - 0.10], outP = [restR[0] + 0.02, restR[1] + 0.03, restR[2] - 0.16];
    // tout en joint space : la jambe passe par l'EXTENSION COMPLÈTE au contact, où un chemin de
    // cheville en ligne droite fait claquer le genou (la dérivée de l'IK y est infinie)
    const onOf = (t) => ramp(t, 0, 0.5 * tA, tA) * (1 - ramp(t, tOut, (tOut + T) / 2, T));
    const hipsOf = (t) => [0, -dip * onOf(t), 0];
    const I = [0, 0, 0, 1];
    // la poussée TEND la jambe quel que soit le style (le bassin descend plus ou moins) : la cible est
    // posée à 99,9 % de la longueur de jambe depuis la hanche de l'instant, dans la direction du point de poussée
    const hipC = fkPose(P, {}, hipsOf(tc)).RightUpLeg.p, Lleg = P.lengths.thigh + P.lengths.shank;
    const dirP = [pushP[0] - hipC[0], pushP[1] - hipC[1], pushP[2] - hipC[2]], nP = Math.hypot(...dirP) || 1;
    const pushT = [hipC[0] + dirP[0] / nP * Lleg * 0.999, hipC[1] + dirP[1] / nP * Lleg * 0.999, hipC[2] + dirP[2] / nP * Lleg * 0.999];
    const solArm = solveLeg(P, 'Right', hipsOf(tA), I, { p: armP }), solPush = solveLeg(P, 'Right', hipsOf(tc), I, { p: pushT, foot: rx(-10) }), solOut = solveLeg(P, 'Right', hipsOf(tOut), I, { p: outP });
    poseAt = (t) => {
      const on = onOf(t);
      const J = {};
      trunk(J, { lean: 10 * S.lean * on, side: K.lean * S.lean * on, yaw: 0, headDown: K.headDown * S.headDown * on });
      if (t < tA) applyLeg(J, 'Right', solArm, ramp(t, 0, 0.6 * tA, tA));
      else if (t <= tc) applyLegBetween(J, 'Right', solArm, solPush, ramp(t, tA, tc - 0.015, tc + 0.003));
      else if (t <= tOut) applyLegBetween(J, 'Right', solPush, solOut, ramp(t, tc, (tc + tOut) / 2, tOut));
      else applyLeg(J, 'Right', solOut, 1 - ramp(t, tOut, (tOut + T) / 2, T));
      // pas de clé de bras : la locomotion les garde (0,3 s — pas le temps de gesticuler)
      return { J, hips: hipsOf(t) };
    };
    ik = () => ({ Left: [restL[0], restL[1], restL[2]], Right: null });
  }
  const keys = emitSpec(P, { duration: T, contact: tc, fps, poseAt, ik, marks });
  return { name: kindName, duration: T, contact: tc, foot: 'right', generated: true, family: 'skill', keys };
}

/** Le portrait : le chemin du pied libre au fil du temps, le ballon, l'appui, le buste. */
export function skillPortrait(spec, P) {
  const K = SKILL_KINDS[spec.name] || {};
  const support = K.croqueta ? null : 'Left';
  const body = bodyPortrait(spec, P, { support });
  const ground = P.lengths.groundY, b = K.ball || [0, BALL_R, -0.3];
  const near = (t) => body.samples.reduce((bst, x) => (Math.abs(x.t - t) < Math.abs(bst.t - t) ? x : bst), body.samples[0]);
  const f0 = body.samples[0].w.RightFoot.p, l0 = body.samples[0].w.LeftFoot.p;
  const kC = near(spec.contact).w;
  const footC = kC.RightFoot.p, toeC = kC.RightToeBase.p;
  const hC = footC[1] - ground, toeBelowAnkle = footC[1] - toeC[1];
  const distBallC = hyp(footC[0] - b[0], footC[2] - b[2]);
  // les extrêmes du pied libre avant / après le contact, la distance minimale au ballon (cercle)
  let peakH = 0, xMin = Infinity, xMax = -Infinity, minBall = Infinity, backMost = -Infinity, fwdMost = Infinity;
  let sweepL = 0, pushL = 0, holdDrift = 0, leanMax = 0, swayYawMax = 0, swayYawAbsPre = 0, hipsXPre = -Infinity;
  const hipsAt = (t) => { const k = spec.keys.reduce((bst, x) => (x.t <= t + 1e-9 ? x : bst), spec.keys[0]); return k.hips || [0, 0, 0]; };
  const yawOf = (w) => Math.atan2(w.RightShoulder.p[2] - w.LeftShoulder.p[2], w.RightShoulder.p[0] - w.LeftShoulder.p[0]);   // + = épaule droite derrière = tourné à DROITE
  const yaw0 = yawOf(body.samples[0].w);
  for (const { t, w } of body.samples) {
    const f = w[K.croqueta && t > K.push1 ? 'LeftFoot' : 'RightFoot'].p, toe = w.RightToeBase.p;
    peakH = Math.max(peakH, f[1] - ground);
    if (K.cut || t <= spec.contact + 1e-9) { xMin = Math.min(xMin, f[0]); xMax = Math.max(xMax, f[0]); }
    for (const q of [f, toe]) minBall = Math.min(minBall, hyp(q[0] - b[0], q[1] - b[1], q[2] - b[2]));
    if (t >= spec.contact) backMost = Math.max(backMost, f[2]);
    fwdMost = Math.min(fwdMost, f[2]);
    if (K.hold && t >= spec.contact && t <= K.hold) holdDrift = Math.max(holdDrift, hyp(w.RightFoot.p[0] - footC[0], w.RightFoot.p[1] - footC[1], w.RightFoot.p[2] - footC[2]));
    // le buste : inclinaison latérale (main gauche sous la droite), lacet des épaules
    const sh = w.LeftShoulder.p, shR = w.RightShoulder.p;
    leanMax = Math.max(leanMax, Math.abs(Math.atan2(shR[1] - sh[1], shR[0] - sh[0])) * 180 / Math.PI);
    const yaw = (yawOf(w) - yaw0) * 180 / Math.PI;
    if (t < spec.contact) { swayYawMax = Math.max(swayYawMax, yaw); swayYawAbsPre = Math.max(swayYawAbsPre, Math.abs(yaw)); hipsXPre = Math.max(hipsXPre, hipsAt(t)[0]); }
  }
  if (K.croqueta) {
    let rMin = Infinity; for (const { t, w } of body.samples) if (t <= K.push1 + 0.02) rMin = Math.min(rMin, w.RightFoot.p[0]);
    sweepL = f0[0] - rMin;
    const lA = near(spec.contact - 0.04).w.LeftFoot.p, lB = near(spec.contact + 0.06).w.LeftFoot.p;
    pushL = lA[2] - lB[2];
  }
  // la vitesse du pied au contact (pichenette) et la flexion du genou lue aux clés (repères)
  const kA = near(spec.contact - 0.02).w.RightFoot.p, kB = near(spec.contact + 0.02).w.RightFoot.p;
  const vFootC = hyp(kB[0] - kA[0], kB[1] - kA[1], kB[2] - kA[2]) / 0.04;
  const keyAt = (t) => spec.keys.find((k) => Math.abs(k.t - t) < 1e-6);
  const kneeAt = (t) => keyAt(t)?.pose.RightLeg?.[0] ?? 0;
  const headAt = (t) => keyAt(t)?.pose.Head?.[0] ?? 0;
  const dipMin = spec.keys.reduce((m, k) => Math.min(m, k.hips?.[1] ?? 0), 0);
  // les deux appuis de la croqueta : gauche planté avant la touche 1, droit planté après
  let supA = 0, supB = 0;
  if (K.croqueta) {
    const r0 = near(K.push1 + 0.05).w.RightFoot.p;
    for (const { t, w } of body.samples) {
      if (t <= K.push1 - 0.02) supA = Math.max(supA, hyp(w.LeftFoot.p[0] - l0[0], w.LeftFoot.p[2] - l0[2]));
      if (t >= K.push1 + 0.05 && t <= spec.contact + 0.08) supB = Math.max(supB, hyp(w.RightFoot.p[0] - r0[0], w.RightFoot.p[2] - r0[2]));
    }
  }
  const handsSpread = (t) => { const w = near(t).w; return Math.max(Math.abs(w.LeftHand.p[0] - w.Hips.p[0]), Math.abs(w.RightHand.p[0] - w.Hips.p[0])); };
  return { ...body, hC, toeBelowAnkle, distBallC, peakH, xMin, xMax, minBall, backMost, fwdMost, sweepL, pushL, holdDrift, leanMax, swayYawMax, swayYawAbsPre, hipsXPre, vFootC, kneeAt, headAt, dipMin, supA, supB, handsSpread, hipsAt, armKeys: spec.keys.some((k) => k.pose.LeftArm || k.pose.RightArm) };
}

/** Le contrat d'un geste technique. */
export function checkSkillGen(spec, P, kindName) {
  const K = SKILL_KINDS[kindName] || {};
  const p = skillPortrait(spec, P);
  const issues = bodyIssues(p, { support: !K.croqueta }).filter((s) => !(K.noArms && /coude|main/.test(s)));   // sans clé de bras, le portrait lit la pose T du rig : les bras sont à la locomotion
  const b = K.ball || [0, BALL_R, -0.3];
  if (K.sole) {
    const hMin = K.toe ? 0.21 : 0.24, dMax = K.toe ? 0.17 : 0.14;
    if (p.hC < hMin || p.hC > 0.36) issues.push(`la semelle n'est pas SUR le ballon (cheville à ${(p.hC * 100).toFixed(0)} cm du sol, attendu ${(100 * hMin).toFixed(0)}-36)`);
    if (p.distBallC > dMax) issues.push(`le pied n'est pas au-dessus du ballon (${(p.distBallC * 100).toFixed(0)} cm à l'horizontale > ${(100 * dMax).toFixed(0)})`);
    if (p.toeBelowAnkle < 0.05) issues.push(`la pointe ne descend pas sur le ballon (${(p.toeBelowAnkle * 100).toFixed(0)} cm sous la cheville < 5)`);
    if (K.dragTo != null && p.backMost < K.dragTo + 0.02) issues.push(`la semelle ne TIRE pas le ballon sous le corps (pied au plus à z=${p.backMost.toFixed(2)} après le contact, attendu ≥ ${(K.dragTo + 0.02).toFixed(2)})`);
    if (K.hold) {
      if (p.holdDrift > 0.03) issues.push(`la semelle ne TIENT pas (dérive ${(p.holdDrift * 100).toFixed(1)} cm pendant la tenue > 3)`);
      const hEnd = p.headAt(spec.keys.reduce((bst, k) => (Math.abs(k.t - K.hold) < Math.abs(bst - K.hold) ? k.t : bst), 0));
      if (p.headAt(spec.contact) < 8 || hEnd > 0) issues.push(`la tête ne se LÈVE pas pendant la tenue (${p.headAt(spec.contact).toFixed(0)}° au contact → ${hEnd.toFixed(0)}° à la fin de la tenue)`);
    }
    if (K.pivot) {
      if (p.kneeAt(spec.contact) > -28) issues.push(`la roulette n'ARME pas la semelle (genou ${p.kneeAt(spec.contact).toFixed(0)}° > −28 au contact)`);
      if ((p.hipsAt(K.pivot)[1] ?? 0) > -0.07) issues.push(`la roulette ne PIVOTE pas bas (bassin ${(100 * p.hipsAt(K.pivot)[1]).toFixed(0)} cm > −7 au pivot)`);
      if (p.handsSpread(K.pivot) < 0.42) issues.push(`les bras ne s'OUVRENT pas au pivot (main à ${(100 * p.handsSpread(K.pivot)).toFixed(0)} cm de l'axe < 42)`);
    }
  }
  if (K.circle) {
    if (p.peakH < 0.25) issues.push(`la jambe ne passe pas PAR-DESSUS le ballon (pied au plus haut ${(p.peakH * 100).toFixed(0)} cm < 25)`);
    if (p.xMax - p.xMin < 0.30) issues.push(`le cercle est timide (balayage latéral ${((p.xMax - p.xMin) * 100).toFixed(0)} cm < 30)`);
    if (p.minBall < 0.14) issues.push(`le pied TOUCHE le ballon qui ne doit pas bouger (${(p.minBall * 100).toFixed(0)} cm du centre < 14)`);
    if (p.leanMax < 8) issues.push(`le buste ne VEND pas la feinte (inclinaison ${p.leanMax.toFixed(0)}° < 8)`);
    if (p.dipMin > -0.04) issues.push(`le centre de gravité ne s'abaisse pas (${(100 * p.dipMin).toFixed(0)} cm > −4)`);
  }
  if (K.cut) {
    if (p.vFootC < 1.2) issues.push(`la coupe ne BALAIE pas (pied à ${p.vFootC.toFixed(1)} m/s au contact < 1,2)`);
    if (p.distBallC > 0.22 || p.hC > 0.16) issues.push(`l'intérieur n'est pas AU ballon au contact (${(p.distBallC * 100).toFixed(0)} cm, hauteur ${(p.hC * 100).toFixed(0)} cm)`);
    if (p.xMin > K.cross + 0.06 && p.xMin > -0.08) issues.push(`le pied ne CROISE pas la ligne médiane (x min ${p.xMin.toFixed(2)})`);
    if (p.dipMin > -K.dip * 0.6) issues.push(`le corps ne s'abaisse pas dans la coupe (${(100 * p.dipMin).toFixed(0)} cm)`);
    if (K.sway) {
      if (p.swayYawMax < 8 || p.hipsXPre < 0.04) issues.push(`le chaloupé ne MENT pas du buste (épaules ${p.swayYawMax.toFixed(0)}° à droite < 8, déport ${(100 * p.hipsXPre).toFixed(0)} cm < 4)`);
    } else if (kindName === 'crochetCourt' && p.swayYawAbsPre > 6) issues.push(`le crochet court n'a pas le temps de mentir (épaules ${p.swayYawAbsPre.toFixed(0)}° > 6 avant la coupe)`);
  }
  if (K.croqueta) {
    if (p.sweepL < 0.22) issues.push(`la touche 1 ne BALAIE pas vers la gauche (pied droit ${(100 * p.sweepL).toFixed(0)} cm < 22)`);
    if (p.pushL < 0.10) issues.push(`la touche 2 ne POUSSE pas devant (pied gauche ${(100 * p.pushL).toFixed(0)} cm < 10)`);
    if (p.supA > 0.03 || p.supB > 0.04) issues.push(`les appuis ne tiennent pas (gauche ${(100 * p.supA).toFixed(1)} cm avant la touche 1, droit ${(100 * p.supB).toFixed(1)} cm après)`);
    if (p.peakH > 0.16) issues.push(`la croqueta n'est pas RASANTE (pied à ${(100 * p.peakH).toFixed(0)} cm > 16)`);
  }
  if (K.flick) {
    if (p.kneeAt(K.arm) > -25) issues.push(`le pont ne s'ARME pas (genou ${p.kneeAt(K.arm).toFixed(0)}° > −25 à l'armé)`);
    if (p.kneeAt(spec.contact) < -8) issues.push(`le pont ne se TEND pas (genou ${p.kneeAt(spec.contact).toFixed(0)}° < −8 au contact)`);
    if (p.vFootC < 3) issues.push(`la pichenette n'est pas SÈCHE (pied à ${p.vFootC.toFixed(1)} m/s < 3)`);
    if (p.armKeys) issues.push('le pont écrit les bras — la locomotion doit les garder');
    if (p.hC > 0.15) issues.push(`la pichenette décolle (pied à ${(100 * p.hC).toFixed(0)} cm > 15)`);
  }
  return { ok: issues.length === 0, issues, portrait: p };
}
