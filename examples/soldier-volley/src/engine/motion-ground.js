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

import { rx, ry, rz, chain, fkPose, jointToSpec } from './motion-rig.js';
import { ramp, bump, emitSpec, armJoints, bodyPortrait, bodyIssues, NEUTRAL_STYLE } from './motion-strike.js';
import { hyp } from './hyp.js';

export const GROUND_KINDS = {
  // le corps glisse PIEDS DEVANT : le bassin bascule en ARRIÈRE (le tacleur s'ASSIED sur la hanche, buste redressé), le roulis n'est que
  // le côté ; la jambe arrière est celle du HURDLER — cuisse sortie à gauche au ras du sol, tibia replié derrière (fold : pied depuis la
  // hanche, pole du genou) — une bascule au-delà de ~50° fait lire à checkClip une extension de hanche hors bornes sur cette jambe
  tacle: { duration: 1.25, contact: 0.34, ball: [0.12, 0.11, -1.0], slide: true, lying: 0.55, rise: 0.76, reach: 0.95, roll: 30, pitch: 46, sitUp: 24, dip: 0.70, fwd: 0.32, lean: 12, headDown: 10, fold: { dx: -0.30, dz: 0.40, pole: [-1, 0.2, -0.5] } },
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
    const down = 0.18 * launch(t) + (dipS * 0.86 - 0.18) * fall(t) + dipS * 0.14 * settle(t);
    const fwd = 0.10 * launch(t) + (K.fwd - 0.10) * fall(t) + 0.06 * settle(t);
    return [0, -down * (1 - up(t)), (fwd * (1 - up(t)) + 0.16 * up(t))];
  };
  // le bassin : BASCULE EN ARRIÈRE (les jambes partent devant, le tacleur s'assied) et roule un peu sur la hanche
  // gauche (rz(+) porte le côté gauche vers le bas) — surtout pendant la chute (au contact le corps est déjà assis)
  const hipsR = (t) => { const a = (0.7 * fall(t) + 0.3 * settle(t)) * (1 - up(t)); return chain(rx(K.pitch * a), rz(K.roll * a), ry(-8 * a)); };
  const poseAt = (t) => {
    const a = (0.7 * fall(t) + 0.3 * settle(t)) * (1 - up(t)), l = launch(t) * (1 - up(t));
    const J = {};
    J.Hips = hipsR(t);
    // le tronc : penché devant au lancement, puis il SE REDRESSE sur le bassin basculé (le tacleur est assis, buste
    // à ~20° en arrière), penche un peu à gauche vers la main d'appui, la tête regarde le ballon
    for (const [b, w] of [['Spine', 0.35], ['Spine1', 0.35], ['Spine2', 0.30]]) J[b] = chain(rz(6 * a * w), rx(-(K.lean * S.lean * l + K.sitUp * a) * w));
    J.Neck = rx(-(K.headDown * S.headDown * l + 4 * a) * 0.3);
    J.Head = rx(-(K.headDown * S.headDown * l + 4 * a) * 0.7);
    // les bras : la main gauche va au sol DERRIÈRE (l'appui du tacleur), le droit en balancier devant-haut
    Object.assign(J, armJoints('Left', { elev: 14 + 26 * a + 14 * l, fwd: 6 - 30 * a + 14 * l, elbow: 14 + 8 * a }), armJoints('Right', { elev: 14 + 46 * S.armElev * a + 10 * l, fwd: 6 + 34 * a, elbow: 14 + 26 * a + 8 * l }));
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
    // la jambe gauche : plantée au lancement, puis REPLIÉE DERRIÈRE le corps couché sur la hanche gauche — le pied
    // derrière la fesse, le genou vers l'extérieur (gauche-arrière) AU RAS DU SOL, le tibia couché : la jambe de haie
    // du tacleur (un genou replié DEVANT-dessous faisait un genou à terre — retour utilisateur)
    // (la cible se pose depuis la HANCHE de l'instant — le bassin a avancé de 30 cm et descendu de 70 : une cible
    // écrite depuis l'origine mettait le pied hors de portée, jambe tendue derrière, hanche à 175°)
    const hipL = fkPose(P, { Hips: jointToSpec(P, 'Hips', hipsR(t)) }, hipsOf(t)).LeftUpLeg.p;
    const foldP = [hipL[0] + K.fold.dx, groundY + 0.06, hipL[2] + K.fold.dz];
    const lf = (0.55 * f + 0.45 * s) * (1 - u);
    const pl = [restL[0] + (foldP[0] - restL[0]) * lf, restL[1] + (foldP[1] - restL[1]) * lf + 0.06 * bump(t, tLaunch, tc, tLying), restL[2] + (foldP[2] - restL[2]) * lf - 0.16 * u];
    return { Left: { p: pl, pole: K.fold.pole }, Right: { p, foot: rx(20 * (f + s) * 0.5 * (1 - u)), pole: [0, 1, -0.35] } };
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
  const headBackL = wL.Head.p[2] - wL.Hips.p[2], headHL = wL.Head.p[1] - ground;   // le tacleur est ASSIS : la tête derrière le bassin, basse
  let handMin = Infinity;
  for (const { t, w } of body.samples) if (t >= spec.contact && t <= tLying) handMin = Math.min(handMin, w.LeftHand.p[1] - ground);
  // le relevé : debout à la fin (bassin à sa hauteur, pieds au sol)
  const pelvisE = wE.Hips.p[1] - w0.Hips.p[1];
  const feetE = Math.max(Math.abs(wE.RightFoot.p[1] - w0.RightFoot.p[1]), Math.abs(wE.LeftFoot.p[1] - w0.LeftFoot.p[1]));
  return { ...body, footAheadC, footHC, pelvisL, rollL, rollC, headBackL, headHL, handMin, pelvisE, feetE };
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
    if (p.rollL < 15) issues.push(`le corps ne se pose pas sur la hanche (épaules à ${p.rollL.toFixed(0)}° < 15)`);
    if (p.headBackL < 0.08 || p.headHL > 1.0) issues.push(`le tacleur n'est pas ASSIS en glissant (tête ${(100 * p.headBackL).toFixed(0)} cm derrière le bassin < 8, à ${(100 * p.headHL).toFixed(0)} cm du sol > 100)`);
    if (p.handMin > 0.30) issues.push(`la main ne se POSE pas au sol (main gauche au plus bas à ${(p.handMin * 100).toFixed(0)} cm > 30)`);
    if (Math.abs(p.pelvisE) > 0.06 || p.feetE > 0.08) issues.push(`le relevé ne remet pas DEBOUT (bassin ${(p.pelvisE * 100).toFixed(0)} cm, pieds ${(p.feetE * 100).toFixed(0)} cm)`);
  }
  return { ok: issues.length === 0, issues, portrait: p };
}
