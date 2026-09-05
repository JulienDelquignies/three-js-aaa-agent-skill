// motion-control — LES CONTRÔLES GÉNÉRÉS : le pied qui va au ballon, l'amortit, et le corps qui le reçoit.
//
// Une réception n'est pas une frappe à l'envers. Le pied part À LA RENCONTRE du ballon (la jambe se
// tend, la surface se présente — intérieur en rotation externe, extérieur en inversion, semelle
// relevée par-dessus), le touche à l'heure du contact, puis CÈDE : la jambe recule et s'élève avec
// le ballon pour lui prendre sa vitesse (l'amorti est un geste, pas une pose — verify-swing :
// excursion ≥ 18 cm puis retour), et le corps se pose. La cuisse et la poitrine reçoivent en
// se CAMBRANT : le buste part en arrière, les genoux plient, le ballon meurt sur un corps mou.
// Le tacle debout est de la même famille — un pied qui va loin devant, bas, sur un appui qui plie
// et un bassin qui descend et avance (fente) — et non une frappe.
//
// Même machine que motion-strike : rampes C¹, articulations anatomiques conjuguées dans le rig
// (motion-rig), jambe d'appui par IK sur le bassin réel, style par joueur, spec animkit dense.

import { rx, ry, rz, chain } from './motion-rig.js';
import { ramp, bump, emitSpec, armJoints, neutralJoints, bodyPortrait, bodyIssues, NEUTRAL_STYLE } from './motion-strike.js';
import { hyp } from './hyp.js';

/**
 * LES ESPÈCES. Durée et contact sont ceux de la table (la scène joue ces clips en réactif : le
 * ballon est là à t = 0, le pied le rejoint à `contact`).
 *   reach    la pose du pied AU ballon : flexion/genou/abduction/rotation/cheville/éversion (°)
 *   cushion  la pose après l'amorti (le pied a cédé), atteinte dt s après le contact
 *   lean     tronc (+ = arrière, − = avant) ; yaw : lacet du tronc vers le ballon ; head [avant, après]
 *   dip/lat/back  le bassin (m) : descend, va sur l'appui, s'assied
 *   excursion  cm horizontaux minimaux du pied au contact (la clause du banc de swing : ≥ 18)
 */
export const CONTROL_KINDS = {
  controleInterieur: { duration: 0.62, contact: 0.2,  reach: { flex: 36, knee: 22, abd: 10, turn: 26, toe: -6, evert: 8 },  cushion: { flex: -4, knee: 52, abd: 6, turn: 12, dt: 0.16 }, lean: -6, yaw: -6, head: [16, 14], arms: { elev: 44, fwd: 20, elbow: 40 }, dip: 0.04, lat: -0.04, back: -0.03, excursion: 0.20, height: [0.02, 0.22] },
  controleExterieur: { duration: 0.6,  contact: 0.22, reach: { flex: 32, knee: 20, abd: -8, turn: -18, toe: -8, evert: -12 }, cushion: { flex: 4, knee: 50, abd: -4, turn: -8, dt: 0.16 }, lean: -5, yaw: 6, head: [16, 14], arms: { elev: 44, fwd: 22, elbow: 40 }, dip: 0.035, lat: -0.03, back: -0.03, excursion: 0.18, height: [0.02, 0.22] },
  controleSemelle:   { duration: 0.55, contact: 0.22, reach: { flex: 48, knee: 32, abd: 4, turn: 0, toe: -22, evert: 0 },   cushion: { flex: 24, knee: 44, abd: 2, turn: 0, dt: 0.16 }, lean: -8, yaw: 0, head: [16, 12], arms: { elev: 40, fwd: 18, elbow: 36 }, dip: 0.06, lat: -0.04, back: -0.02, excursion: 0.18, height: [0.12, 0.34], sole: true },
  amortiCuisse:      { duration: 0.8,  contact: 0.3,  reach: { flex: 82, knee: 50, abd: 8, turn: 6, toe: 8, evert: 0 },    cushion: { flex: 50, knee: 62, abd: 4, turn: 2, dt: 0.2 },  lean: 14, yaw: 0, head: [-8, 10], arms: { elev: 48, fwd: 24, elbow: 42 }, dip: 0.04, lat: -0.05, back: -0.03, thigh: true, kneeHeight: 0.62 },
  // (« amorti » sert aussi de réception PAR DÉFAUT — un ballon sans technique nommée — : la poitrine
  // s'offre, mais sans théâtre : un cambré modéré, des genoux qui plient)
  amorti:            { duration: 1.0,  contact: 0.3,  chest: true, lean: 14, yaw: 0, head: [-8, 6], arms: { elev: 48, fwd: 24, elbow: 44 }, dip: 0.06, lat: 0, back: -0.02, cushionDt: 0.25 },
  tacleDebout:       { duration: 0.7,  contact: 0.28, reach: { flex: 58, knee: 30, abd: 4, turn: 14, toe: -20, evert: 6 },  cushion: { flex: 36, knee: 68, abd: 2, turn: 6, dt: 0.2 },  lean: -24, yaw: -6, head: [-6, 4], arms: { elev: 50, fwd: 32, elbow: 40 }, dip: 0.11, lat: -0.02, back: -0.10, lunge: true, excursion: 0.40, height: [0.02, 0.24] },
};

/** Le tronc réparti (mêmes parts que la frappe) et la tête. */
function trunkJoints(J, { lean = 0, yaw = 0, side = 0, headPitch = 0, headYaw = 0 }) {
  for (const [b, wy, wl, ws] of [['Spine', 0.25, 0.35, 0.40], ['Spine1', 0.35, 0.35, 0.35], ['Spine2', 0.40, 0.30, 0.25]]) J[b] = chain(rz(side * ws), rx(lean * wl), ry(yaw * wy));
  J.Neck = chain(rx(-headPitch * 0.4), ry(headYaw * 0.4));
  J.Head = chain(rx(-headPitch * 0.6), ry(headYaw * 0.6));
}

/**
 * GÉNÉRER un contrôle (pied DROIT — le miroir d'animkit fait le gauche ; la poitrine est symétrique).
 */
export function generateControl(kindName, P, { style = NEUTRAL_STYLE, fps = 60 } = {}) {
  const K = CONTROL_KINDS[kindName];
  if (!K) throw new Error(`motion-control : espèce inconnue « ${kindName} »`);
  const S = { ...NEUTRAL_STYLE, ...style };
  const tc = K.contact, T = K.duration;
  const dt = K.cushion?.dt ?? K.cushionDt ?? 0.2;
  const tCush = Math.min(T - 0.1, tc + dt);
  const leftRest = P.bones.LeftFoot.bindP, rightRest = P.bones.RightFoot.bindP;
  const reachAmp = K.lunge ? 1 : 0.85 + 0.15 * S.backswing;   // un joueur tend plus ou moins la jambe (la fente : non — la pointe frôle déjà)
  const poseAt = (t) => {
    const up = ramp(t, 0, 0.55 * tc, tc);                 // le pied part à la rencontre (pic de vitesse au milieu)
    const cu = ramp(t, tc, tc + 0.4 * dt, tCush);         // …et CÈDE après le contact
    const settle = ramp(t, tCush, (tCush + T) / 2, T);   // …puis le corps se pose
    const held = up * (1 - settle);
    const J = {};
    const c = {};
    if (K.reach) {
      for (const k of ['flex', 'knee', 'abd', 'turn', 'toe', 'evert']) {
        const r = (K.reach[k] ?? 0) * (k === 'flex' || k === 'knee' ? reachAmp : 1), q = K.cushion[k] ?? (k === 'toe' || k === 'evert' ? K.reach[k] ?? 0 : 0);
        // la cheville se relâche en DERNIER (après que la jambe est redescendue) : une pointe qui
        // retombe pendant que le pied est encore devant passe sous la pelouse
        c[k] = r * up + (q - r) * cu + (0 - q) * (k === 'toe' || k === 'evert' ? ramp(t, (tCush + T) / 2, (tCush + 3 * T) / 4, T) : settle);
      }
      J.RightUpLeg = chain(ry(-c.turn), rz(c.abd), rx(c.flex));
      J.RightLeg = rx(-c.knee);
      J.RightFoot = chain(rz(c.evert), rx(-c.toe));
      J.RightToeBase = [0, 0, 0, 1];
    }
    // le bassin : descend sur l'appui, s'assied (le tacle : la FENTE avance)
    const dip = K.dip * (K.lunge ? Math.max(0.9, Math.min(S.dip, 1.1)) : S.dip);   // la fente : ni plus bas que le pied ne suit, ni moins qu'une fente
    const hips = [K.lat * S.stance * held, -dip * held, (K.lunge ? -K.back : K.back) * held];
    J.Hips = chain(rx(K.lunge ? -6 * held : 2 * held), ry(K.yaw * 0.5 * held));
    // le tronc : avant sur le ballon (contrôle), ARRIÈRE et cambré (cuisse, poitrine), penché (tacle)
    const lean = K.lean * (K.lean > 0 ? S.lean : 1) * held;
    const headPitch = (K.head[0] * S.headDown) * up * (1 - cu) + (K.head[1] * S.headDown) * cu * (1 - settle);
    trunkJoints(J, { lean, yaw: K.yaw * held, side: (K.chest ? 0 : 3) * held, headPitch, headYaw: K.yaw * 1.5 * held });
    // les bras : équilibre — gauche devant-latéral, droit un peu ; la poitrine ouvre les deux
    const A = K.arms;
    const armUp = Math.min(1, held * 1.2);
    const L = armJoints('Left', { elev: 14 + (A.elev * S.armElev - 14) * armUp, fwd: 6 + (A.fwd * S.armFwd - 6) * armUp, elbow: 14 + (S.elbow - 14) * armUp });
    const R = armJoints('Right', { elev: 14 + ((K.chest ? A.elev * S.armElev : 24) - 14) * armUp, fwd: 6 + ((K.chest ? A.fwd * S.armFwd : -10) - 6) * armUp, elbow: 14 + (K.chest ? S.elbow - 14 : 20) * armUp });
    Object.assign(J, neutralJoints(), L, R);
    J.LeftShoulder = [0, 0, 0, 1]; J.RightShoulder = [0, 0, 0, 1];
    return { J, hips };
  };
  const ik = () => ({ Left: leftRest, Right: K.chest ? rightRest : null });   // l'appui en IK ; la poitrine reçoit sur DEUX appuis
  const keys = emitSpec(P, { duration: T, contact: tc, fps, poseAt, ik });
  return { name: kindName, duration: T, contact: tc, foot: K.chest ? 'both' : 'right', generated: true, family: 'control', keys };
}

/** Le portrait d'un contrôle : excursion du pied, hauteur au contact, retour, hauteur du genou, cambré. */
export function controlPortrait(spec, P, { foot = 'right' } = {}) {
  const F = foot === 'right' ? 'RightFoot' : 'LeftFoot', T = foot === 'right' ? 'RightToeBase' : 'LeftToeBase', Kn = foot === 'right' ? 'RightLeg' : 'LeftLeg';
  const support = foot === 'right' ? 'Left' : 'Right';
  const K = CONTROL_KINDS[spec.name] || {};
  const body = bodyPortrait(spec, P, { support: K.chest ? 'Left' : support });
  const rest = body.samples[0].w[F].p;
  let excMax = 0, excAt = 0, excC = 0, hC = 0, toeAxis = 0, kneeH = 0, headBack = 0, dipC = 0, fwdC = 0, endExc = 0;
  const tNear = body.samples.reduce((b, x) => (Math.abs(x.t - spec.contact) < Math.abs(b - spec.contact) ? x.t : b), body.samples[0].t);
  for (const { t, w } of body.samples) {
    const f = w[F].p;
    const e = hyp(f[0] - rest[0], f[2] - rest[2]);
    if (e > excMax) { excMax = e; excAt = t; }
    if (t === tNear) {
      excC = e; hC = f[1] - P.lengths.groundY; toeAxis = hyp(w[T].p[0] - f[0], w[T].p[2] - f[2]);
      kneeH = w[Kn].p[1]; headBack = w.Head.p[2] - w.Hips.p[2];   // + = la tête DERRIÈRE le bassin (cambré)
      dipC = w.Hips.p[1] - body.samples[0].w.Hips.p[1]; fwdC = -(w.Hips.p[2] - body.samples[0].w.Hips.p[2]);
    }
  }
  endExc = hyp(body.samples.at(-1).w[F].p[0] - rest[0], body.samples.at(-1).w[F].p[2] - rest[2]);
  // deux appuis (poitrine) : l'autre pied aussi
  let sup2 = 0;
  if (K.chest) { const r0 = body.samples[0].w.RightFoot.p; for (const { w } of body.samples) sup2 = Math.max(sup2, hyp(w.RightFoot.p[0] - r0[0], w.RightFoot.p[2] - r0[2], w.RightFoot.p[1] - r0[1])); }
  return { ...body, excMax, excAt, excC, hC, toeAxis, kneeH, headBack, dipC, fwdC, endExc, sup2 };
}

/** Le contrat d'un contrôle. */
export function checkControlGen(spec, P, kindName, { foot = 'right' } = {}) {
  const K = CONTROL_KINDS[kindName] || {};
  const p = controlPortrait(spec, P, { foot });
  const issues = bodyIssues(p, { support: true });
  if (K.reach && !K.thigh) {
    if (p.excC < (K.excursion ?? 0.18)) issues.push(`le pied ne va pas au ballon (${(p.excC * 100).toFixed(0)} cm au contact < ${((K.excursion ?? 0.18) * 100).toFixed(0)})`);
    if (p.hC < K.height[0] || p.hC > K.height[1]) issues.push(`cheville au contact à ${(p.hC * 100).toFixed(0)} cm du sol (attendu ${(K.height[0] * 100).toFixed(0)}-${(K.height[1] * 100).toFixed(0)})`);
    if (p.toeAxis < 0.08) issues.push(`orientation du pied non écrite au contact (axe orteils horizontal ${(p.toeAxis * 100).toFixed(0)} cm < 8)`);
    if (p.endExc > 0.6 * p.excMax + 0.02) issues.push(`le pied ne REVIENT pas (fin à ${(p.endExc * 100).toFixed(0)} cm pour ${(p.excMax * 100).toFixed(0)} d'excursion)`);
  }
  if (K.thigh) {
    if (p.kneeH < K.kneeHeight) issues.push(`la cuisse ne monte pas au ballon (genou à ${(p.kneeH * 100).toFixed(0)} cm < ${(K.kneeHeight * 100).toFixed(0)})`);
    if (p.headBack < 0.04) issues.push(`le buste ne se cambre pas (tête ${(p.headBack * 100).toFixed(0)} cm derrière le bassin < 4)`);
  }
  if (K.chest) {
    if (p.headBack < 0.07) issues.push(`la poitrine ne s'offre pas (tête ${(p.headBack * 100).toFixed(0)} cm derrière le bassin < 7)`);
    if (p.dipC > -0.04) issues.push(`les genoux ne plient pas (bassin ${(p.dipC * 100).toFixed(0)} cm)`);
    if (p.sup2 > 0.03) issues.push(`le second appui bouge (${(p.sup2 * 100).toFixed(1)} cm)`);
  }
  if (K.lunge) {
    if (p.dipC > -0.09) issues.push(`la fente ne descend pas (bassin ${(p.dipC * 100).toFixed(0)} cm > −9)`);
    if (p.fwdC < 0.05) issues.push(`la fente n'avance pas (bassin ${(p.fwdC * 100).toFixed(0)} cm < 5)`);
  }
  return { ok: issues.length === 0, issues, portrait: p };
}
