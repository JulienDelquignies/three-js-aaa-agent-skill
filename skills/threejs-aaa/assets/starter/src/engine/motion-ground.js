// motion-ground — LE CORPS QUI SE COUCHE : le tacle glissé généré.
//
// Un tacle glissé a quatre temps que le clip doit porter et que la scène et la sim exploitent tels
// quels : (1) le LANCEMENT — une foulée, le corps déjà bas et penché ; (2) la CHUTE SUR LE CÔTÉ —
// le bassin descend et ROULE sur la hanche gauche, la jambe droite S'ALLONGE devant au ras du sol
// vers le ballon (contact 0,34 : c'est elle qui joue), la gauche se REPLIE dessous, la main gauche
// se pose au sol, le bras droit fait balancier, la tête reste sur le ballon ; (3) la POSE COUCHÉE
// (atteinte à 55 % — la scène gèle le clip là tant que la sim garde le corps au sol, `down`) ;
// (4) le RELEVÉ (les 30 derniers %), rejoué quand la sim relève. Le CORPS EST TRANSPORTÉ PAR LA
// SIM (movement.js : la glissade porte le corps 2,5-3 m, freinée) — le clip ne porte qu'un petit
// root motion vers l'avant (le bassin qui s'allonge devant les pieds), pas la distance.
//
// Même machine : rampes C¹, articulations conjuguées, IK deux os pour la jambe tendue, joint space
// pour la jambe repliée, emitSpec, style par joueur. Pied DROIT ; le miroir d'animkit fait le gauche.

import { rx, ry, rz, chain } from './motion-rig.js';
import { ramp, bump, emitSpec, armJoints, bodyPortrait, bodyIssues, NEUTRAL_STYLE } from './motion-strike.js';
import { hyp } from './hyp.js';

export const GROUND_KINDS = {
  tacle: { duration: 1.25, contact: 0.34, ball: [0.12, 0.11, -1.0], slide: true, lying: 0.55, rise: 0.76, reach: 0.95, roll: 68, pitch: 22, dip: 0.70, fwd: 0.32, lean: 12, headDown: 10 },
};

/** GÉNÉRER un geste au sol. */
export function generateGround(kindName, P, { style = NEUTRAL_STYLE, fps = 60 } = {}) {
  const K = GROUND_KINDS[kindName];
  if (!K) throw new Error(`motion-ground : espèce inconnue « ${kindName} »`);
  const S = { ...NEUTRAL_STYLE, ...style };
  const tc = K.contact, T = K.duration;
  const restR = P.bones.RightFoot.bindP, restL = P.bones.LeftFoot.bindP;
  const groundY = P.lengths.groundY;
  const tLaunch = 0.14, tLying = K.lying * T, tRise = K.rise * T;
  const reach = K.reach * (0.94 + 0.06 * S.backswing);
  // la profondeur de la pose couchée n'est PAS un style : le sol est où il est (±2 cm)
  const dipS = K.dip * (0.98 + 0.04 * Math.max(0, Math.min(1, (S.dip - 0.75) / 0.55)));
  // les enveloppes : lancement (0 → 0,14), chute (0,14 → contact), tassement (contact → couché), relevé (rise → fin)
  const launch = (t) => ramp(t, 0, 0.6 * tLaunch, tLaunch);
  const fall = (t) => ramp(t, tLaunch, 0.7 * tc, tc);
  const settle = (t) => ramp(t, tc, (tc + tLying) / 2, tLying);
  const up = (t) => ramp(t, tRise, (tRise + T) / 2, T);
  // le canal hanches : bas et devant — la pose couchée, puis le relevé (le corps se redresse SUR PLACE : la sim a transporté l'origine)
  const hipsOf = (t) => {
    const down = 0.18 * launch(t) + (dipS * 0.78 - 0.18) * fall(t) + dipS * 0.22 * settle(t);
    const fwd = 0.10 * launch(t) + (K.fwd - 0.10) * fall(t) + 0.06 * settle(t);
    return [0, -down * (1 - up(t)), (fwd * (1 - up(t)) + 0.16 * up(t))];
  };
  // le bassin : roule sur la hanche gauche (rz(+) porte le côté gauche vers le bas) et bascule en arrière
  // le roulis : plus de la moitié pendant la chute (au contact le corps est déjà sur la hanche), le reste au tassement
  const hipsR = (t) => { const a = (0.55 * fall(t) + 0.45 * settle(t)) * (1 - up(t)); return chain(rz(K.roll * a), rx(K.pitch * a), ry(-10 * a)); };
  const poseAt = (t) => {
    const a = (0.55 * fall(t) + 0.45 * settle(t)) * (1 - up(t)), l = launch(t) * (1 - up(t));
    const J = {};
    J.Hips = hipsR(t);
    // le tronc : penché devant au lancement, puis il SUIT le bassin (un peu moins roulé — l'épaule gauche va au sol, la tête regarde le ballon)
    for (const [b, w] of [['Spine', 0.35], ['Spine1', 0.35], ['Spine2', 0.30]]) J[b] = chain(rz(-K.roll * 0.2 * a * w), rx(-(K.lean * S.lean * l + 10 * a) * w));
    J.Neck = chain(rz(K.roll * 0.35 * a), rx(-(K.headDown * S.headDown * l) * 0.3));
    J.Head = chain(rz(K.roll * 0.45 * a), rx(-(K.headDown * S.headDown * l) * 0.7 + 12 * a));
    // les bras : la main gauche va au sol (bras pendant le long du corps roulé, coude un peu plié), le droit en balancier devant-haut
    Object.assign(J, armJoints('Left', { elev: 14 + 16 * a + 14 * l, fwd: 6 + 22 * a + 14 * l, elbow: 14 + 12 * a }), armJoints('Right', { elev: 14 + 46 * S.armElev * a + 10 * l, fwd: 6 + 30 * a, elbow: 14 + 26 * a + 8 * l }));
    J.LeftShoulder = [0, 0, 0, 1]; J.RightShoulder = [0, 0, 0, 1];
    return { J, hips: hipsOf(t) };
  };
  // la jambe droite : une foulée devant (lancement) puis TENDUE au ras du sol vers le ballon (IK), pointe relevée ; revient sous le corps au relevé
  const ik = (t) => {
    const l = launch(t), f = fall(t), s = settle(t), u = up(t);
    const strideP = [restR[0], restR[1] + 0.08, restR[2] - 0.28];
    const reachP = [K.ball[0] + 0.02, groundY + 0.11, -reach + 0.02];
    const lyingP = [K.ball[0] + 0.05, groundY + 0.10, -reach - 0.02];
    let p = [restR[0] + (strideP[0] - restR[0]) * l, restR[1] + (strideP[1] - restR[1]) * l, restR[2] + (strideP[2] - restR[2]) * l];
    p = [p[0] + (reachP[0] - p[0]) * f, p[1] + (reachP[1] - p[1]) * f, p[2] + (reachP[2] - p[2]) * f];
    p = [p[0] + (lyingP[0] - p[0]) * s, p[1] + (lyingP[1] - p[1]) * s, p[2] + (lyingP[2] - p[2]) * s];
    const endP = [restR[0], restR[1], restR[2] + 0.16 * 0 - 0.16];
    p = [p[0] + (endP[0] - p[0]) * u, p[1] + (endP[1] - p[1]) * u + 0.06 * bump(t, tRise, (tRise + T) / 2, T), p[2] + (endP[2] - p[2]) * u];
    // la jambe gauche : plantée au lancement, puis REPLIÉE sous le corps roulé — le pied au sol derrière la hanche, genou vers le haut-gauche
    const foldP = [restL[0] + 0.02, groundY + 0.13, restL[2] + 0.18];
    const lf = (0.4 * f + 0.6 * s) * (1 - u);
    const pl = [restL[0] + (foldP[0] - restL[0]) * lf, restL[1] + (foldP[1] - restL[1]) * lf, restL[2] + (foldP[2] - restL[2]) * lf - 0.16 * u];
    return { Left: { p: pl, pole: [-0.5, 0.8, -0.3] }, Right: { p, foot: rx(20 * (f + s) * 0.5 * (1 - u)), pole: [0, 1, -0.35] } };
  };
  const keys = emitSpec(P, { duration: T, contact: tc, fps, poseAt, ik, marks: [tLying] });
  return { name: kindName, duration: T, contact: tc, foot: 'right', generated: true, family: 'ground', keys };
}

/** Le portrait : le bassin au sol, la jambe tendue, le roulis, la main au sol, le relevé. */
export function groundPortrait(spec, P) {
  const K = GROUND_KINDS[spec.name] || {};
  const body = bodyPortrait(spec, P, { support: null });
  const ground = P.lengths.groundY;
  const near = (t) => body.samples.reduce((b, x) => (Math.abs(x.t - t) < Math.abs(b.t - t) ? x : b), body.samples[0]);
  const tLying = (K.lying ?? 0.55) * spec.duration;
  const wC = near(spec.contact).w, wL = near(tLying).w, w0 = body.samples[0].w, wE = body.samples.at(-1).w;
  const rollOf = (w) => Math.abs(Math.atan2(w.RightShoulder.p[1] - w.LeftShoulder.p[1], w.RightShoulder.p[0] - w.LeftShoulder.p[0])) * 180 / Math.PI;
  const footAheadC = -(wC.RightFoot.p[2]), footHC = wC.RightFoot.p[1] - ground;
  const pelvisL = wL.Hips.p[1] - ground, rollL = rollOf(wL), rollC = rollOf(wC);
  let handMin = Infinity;
  for (const { t, w } of body.samples) if (t >= spec.contact && t <= tLying) handMin = Math.min(handMin, w.LeftHand.p[1] - ground);
  // le relevé : debout à la fin (bassin à sa hauteur, pieds au sol)
  const pelvisE = wE.Hips.p[1] - w0.Hips.p[1];
  const feetE = Math.max(Math.abs(wE.RightFoot.p[1] - w0.RightFoot.p[1]), Math.abs(wE.LeftFoot.p[1] - w0.LeftFoot.p[1]));
  return { ...body, footAheadC, footHC, pelvisL, rollL, rollC, handMin, pelvisE, feetE };
}

/** Le contrat d'un geste au sol. */
export function checkGroundGen(spec, P, kindName) {
  const K = GROUND_KINDS[kindName] || {};
  const p = groundPortrait(spec, P);
  // du corps commun : la pelouse et le coude (pas d'appui — le corps est couché ; pas de retour à la pose initiale — il s'est déplacé)
  const issues = bodyIssues(p, { support: false }).filter((s) => !/pose finale|au-dessus du cou/.test(s));   // un corps couché a le cou au sol : la clause des mains n'a pas de sens
  if (K.slide) {
    if (p.footAheadC < 0.8) issues.push(`la jambe ne s'ALLONGE pas au ballon (pied à ${(p.footAheadC * 100).toFixed(0)} cm devant au contact < 80)`);
    if (p.footHC > 0.16) issues.push(`la jambe tendue décolle (pied à ${(p.footHC * 100).toFixed(0)} cm du sol > 16)`);
    if (p.pelvisL > 0.32) issues.push(`le corps ne se COUCHE pas (bassin à ${(p.pelvisL * 100).toFixed(0)} cm à la pose couchée > 32)`);
    if (p.rollL < 40) issues.push(`le corps ne ROULE pas sur la hanche (épaules à ${p.rollL.toFixed(0)}° < 40)`);
    if (p.handMin > 0.30) issues.push(`la main ne se POSE pas au sol (main gauche au plus bas à ${(p.handMin * 100).toFixed(0)} cm > 30)`);
    if (Math.abs(p.pelvisE) > 0.06 || p.feetE > 0.08) issues.push(`le relevé ne remet pas DEBOUT (bassin ${(p.pelvisE * 100).toFixed(0)} cm, pieds ${(p.feetE * 100).toFixed(0)} cm)`);
  }
  return { ok: issues.length === 0, issues, portrait: p };
}
