// motion-idle — L'ATTENTE GÉNÉRÉE (lot A8). Le corps qui ne court pas, calculé — pas l'idle d'un soldat.
//
// Mesuré avant ce module (match 11c11, graine 7) : à l'arrêt, TOUS les joueurs jouaient le clip idle du
// donneur Soldier — la même pose de garde-à-vous, bras le long du corps, mêmes secondes pour tous, le
// gardien compris (43 % de son temps à l'arrêt, debout comme un piquet à 30 m du ballon). Une remise en
// jeu, c'était onze statues (captures du sweep, note 302 bis).
//
// Ici, l'attente est une FONCTION PURE de (t, espèce, style) : le poids qui passe d'un pied à l'autre
// (période 6-9 s, le bassin roule vers l'appui), la respiration (période ~4 s, cage et épaules), les
// bras qui vivent (micro-balancier), et des ESPÈCES qui sont des situations de football :
//   repos          debout, bras le long du corps, poids qui passe — le fond de l'attente
//   mainsHanches   les mains sur les hanches, coudes dehors (le calme, le temps mort)
//   sautillement   sur la pointe des pieds, genoux qui pompent (le nerveux, l'avant-penalty)
//   pret           la garde du défenseur : pieds larges, genoux fléchis, buste penché, bras devant
//   pretGardien    la position d'attente du gardien : plus bas, plus large, gants devant, prêt à partir
//   mur            le mur : pieds serrés, mains croisées devant le bas-ventre, menton rentré
// Les pieds sont FIXES en repère personnage (les jambes sont résolues par IK sur le bassin qui bouge) :
// une attente ne glisse pas. La politique (idlePolicy) choisit l'espèce d'après la situation de la sim
// (temps mort, mur, gardien près du ballon, défenseur au contact) et le tempérament de la persona
// (calm → mains sur les hanches, burstiness → sautillement).
//
// Posée par le contrôleur (character-controller) sous 0,6 m/s, fondue avec la foulée générée
// (motion-gait) au-dessus, les espèces fondues entre elles en 0,5 s. Pur : aucune dépendance rendu.
// verify-attente.mjs porte le contrat et ses sabotages.

import { fkPose, jointToSpec, quatToEulerXYZ, rx, ry, rz, chain } from './motion-rig.js';
import { legIK } from './motion-strike.js';
import { armIK } from './motion-restart.js';
import { quatMul, quatConjugate, quatNormalize, clamp } from './vecmath.js';
import { subRng } from './rng.js';

const D2R = Math.PI / 180;
const TAU = Math.PI * 2;

/**
 * LES ESPÈCES D'ATTENTE — chaque nombre nommé pour être discutable.
 *   hw       demi-largeur de pieds (m)      knee     flexion de genou visée (°) — l'affaissement s'en déduit
 *   lean     inclinaison du tronc (°)        headDown tête baissée (°)
 *   sway swayT   balancement latéral du bassin (m, s)   breath   respiration (°, cage + épaules)
 *   bounce bounceT  rebond vertical (m, s) — sur la pointe des pieds au sommet (heel °)
 *   arms     { elev, fwd, elbow, twist } (armPose : élévation, avancée, coude, VRILLE de l'humérus — la
 *            vrille est ce qui met une main sur une hanche ou devant le bas-ventre) + armLive : micro-balancier (°)
 */
export const IDLE_KINDS = {
  repos:        { hw: 0.11, knee: 5,  lean: 1,  headDown: 0,  sway: 0.035, swayT: 7.5, breath: 1.2, breathT: 4.2, bounce: 0,     bounceT: 1,    heel: 0,  arms: { elev: 9,  fwd: 5,   elbow: 16, twist: 0 },   armLive: 1.5 },
  mainsHanches: { hw: 0.13, knee: 4,  lean: 0,  headDown: 0,  sway: 0.03,  swayT: 8.5, breath: 1.0, breathT: 4.6, bounce: 0,     bounceT: 1,    heel: 0,  arms: { elev: 22, fwd: -8,  elbow: 45, twist: -50 }, armLive: 0.6 },
  sautillement: { hw: 0.12, knee: 14, lean: 4,  headDown: 2,  sway: 0.012, swayT: 3.0, breath: 1.0, breathT: 3.0, bounce: 0.035, bounceT: 0.42, heel: 14, arms: { elev: 12, fwd: 22,  elbow: 70, twist: 0 },   armLive: 2.5 },
  pret:         { hw: 0.24, knee: 32, lean: 18, headDown: 6,  sway: 0.02,  swayT: 2.4, breath: 1.4, breathT: 2.8, bounce: 0.012, bounceT: 0.75, heel: 4,  arms: { elev: 10, fwd: 24,  elbow: 50, twist: -20 }, armLive: 2.0 },
  pretGardien:  { hw: 0.30, knee: 40, lean: 26, headDown: 4,  sway: 0.015, swayT: 2.0, breath: 1.4, breathT: 2.6, bounce: 0.016, bounceT: 0.62, heel: 6,  arms: { elev: 22, fwd: 36,  elbow: 55, twist: -10 }, armLive: 2.0 },
  // le ballon en mains (le preneur d'une touche qui attend) : les deux poignets encadrent le ballon devant la poitrine (IK de bras)
  ballonMains:  { hw: 0.12, knee: 6,  lean: 2,  headDown: 3,  sway: 0.02,  swayT: 6.5, breath: 1.0, breathT: 4.0, bounce: 0,     bounceT: 1,    heel: 0,  arms: { elev: 8,  fwd: 30,  elbow: 90, twist: 0 },   armLive: 0.5, wrists: [0.16, 1.32, -0.30] },
  mur:          { hw: 0.10, knee: 10, lean: 8,  headDown: 12, sway: 0.008, swayT: 5.0, breath: 0.8, breathT: 3.8, bounce: 0,     bounceT: 1,    heel: 0,  arms: { elev: -20, fwd: 26, elbow: 12, twist: 72 },  armLive: 0.4 },
};
export const IDLE_NAMES = Object.keys(IDLE_KINDS);

/** LE STYLE D'ATTENTE d'un joueur — bornes douces : reconnaissable, jamais une caricature. */
export const IDLE_STYLE_RANGES = {
  width: [0.85, 1.2],      // × largeur de pieds
  sway: [0.7, 1.3],        // × balancement
  swayT: [0.8, 1.25],      // × période du balancement
  breath: [0.8, 1.25],     // × respiration
  elbow: [-8, 8],          // ° port du coude
  armElev: [-3, 4],        // ° écartement des bras
  lean: [-1.5, 2.5],       // ° inclinaison propre
  turnout: [4, 16],        // ° ouverture des pieds
  phase: [0, 1],           // déphasage des horloges (jamais deux joueurs synchrones)
};
export const NEUTRAL_IDLE_STYLE = Object.fromEntries(Object.entries(IDLE_STYLE_RANGES).map(([k, [a, b]]) => [k, (a + b) / 2]));
NEUTRAL_IDLE_STYLE.phase = 0;
export function idleStyleFromSeed(seed) {
  const r = subRng(seed, 'style-attente');
  const s = {};
  for (const [k, [a, b]] of Object.entries(IDLE_STYLE_RANGES)) { const u = k === 'phase' ? r() : (r() + r()) / 2; s[k] = a + (b - a) * u; }
  return s;
}

/** Le bras avec VRILLE de l'humérus : `twist` d'abord (autour de l'axe du bras en T-pose), puis
 *  l'élévation (0 = bras pendant), l'avancée, et le coude. C'est la vrille qui tourne le plan du coude —
 *  main sur la hanche (vrille externe, coude dehors) ou devant le bas-ventre (vrille interne). */
export function armPose(side, { elev, fwd, elbow, twist = 0 }) {
  const s = side === 'Right' ? -1 : 1;
  // la vrille garde son signe d'un côté à l'autre : le miroir x → −x conserve une rotation autour de X
  return { [`${side}Arm`]: chain(rx(twist), rz(s * (90 - elev)), rx(fwd)), [`${side}ForeArm`]: ry(-s * elbow) };
}

/** L'affaissement du bassin qui donne une flexion de genou κ avec les pieds à `horiz` de la hanche. */
export function dropForKnee(P, kneeDeg, horiz = 0) {
  const a = P.lengths.thigh, b = P.lengths.shank;
  const d = Math.sqrt(Math.max(0, a * a + b * b + 2 * a * b * Math.cos(kneeDeg * D2R)));
  const vert = Math.sqrt(Math.max(0, d * d - horiz * horiz));
  const hipY = P.bones.LeftUpLeg.bindP[1], ankleY = P.bones.LeftFoot.bindP[1];
  return Math.max(0, hipY - ankleY - vert);
}

/**
 * LA POSE D'ATTENTE — fonction pure de (t, espèce, style). Renvoie { q: { os: q_spec }, hips, J, meta }.
 * `opts.override` : un réglage ou un sabotage nommé (bancs) appliqué sur les paramètres résolus.
 */
export function idlePose(P, t, kind = 'repos', style = NEUTRAL_IDLE_STYLE, opts = {}) {
  const K0 = IDLE_KINDS[kind] || IDLE_KINDS.repos;
  const K = { ...K0, arms: { ...K0.arms }, ...(opts.override || {}) };
  const L = P.lengths;
  const hipY = P.bones.LeftUpLeg.bindP[1], ankleY = P.bones.LeftFoot.bindP[1];
  const tt = t + style.phase * 11.3;                                 // le déphasage : jamais deux joueurs synchrones
  // ---- le bassin : balancement lent d'un pied à l'autre, respiration, rebond (sautillement)
  const hw = K.hw * style.width;
  const swayA = K.sway * style.sway;
  const sw = swayA * Math.sin(TAU * tt / (K.swayT * style.swayT));
  const bounceU = K.bounce > 0 ? 0.5 - 0.5 * Math.cos(TAU * tt / K.bounceT) : 0;   // 0 en bas, 1 en haut
  // l'affaissement se DIMENSIONNE sur la jambe la plus loin : le pied déchargé quand le bassin est au
  // bout de son balancement (horizontal = écart du pied à sa hanche + balancement, en 3D), marge 4 mm
  const hipX = Math.abs(P.bones.LeftUpLeg.bindP[0]), hipZ = Math.abs(P.bones.LeftUpLeg.bindP[2]);
  // la jambe CHARGÉE (le bassin au-dessus d'elle) porte la flexion visée ; la jambe LIBRE, plus loin,
  // doit rester atteignable (portée 0,99) — elle plie davantage, comme une vraie jambe déchargée
  const near = Math.hypot(Math.max(0, hw - hipX - swayA), hipZ);
  const R = L.thigh + L.shank;
  const drop = dropForKnee(P, K.knee, near) + 0.002 + (K.bounce > 0 ? K.bounce * (1 - bounceU) : 0);
  const heel = K.heel * bounceU;                                        // sur la pointe au sommet du rebond
  const hips = [sw, -drop, 0];
  // le bassin roule vers le côté DÉCHARGÉ (la hanche libre descend, la jambe d'appui se tend) — rz(+) lève la droite
  const list = (sw / Math.max(1e-6, swayA)) * 2.5;
  const lean = K.lean + style.lean;
  const RHips = chain(rx(-lean * 0.6), rz(list), ry(0));
  const J = { Hips: RHips };
  // ---- le tronc : inclinaison, respiration (extension de la cage), contre-roulis léger
  // la respiration : l'inspiration lève les épaules (rz aux clavicules) et ouvre la cage (extension haute)
  const brU = 0.5 + 0.5 * Math.sin(TAU * tt / K.breathT);
  const br = K.breath * style.breath * brU;
  J.Spine = chain(rx(-lean * 0.2), rz(-list * 0.4));
  J.Spine1 = chain(rx(-lean * 0.15 - br * 0.4), rz(-list * 0.3));
  J.Spine2 = chain(rx(-lean * 0.1 - br * 0.4), rz(-list * 0.2));
  J.LeftShoulder = rz(-br * 1.4); J.RightShoulder = rz(br * 1.4);
  J.Neck = rx(lean * 0.35 - K.headDown * 0.4);
  J.Head = rx(lean * 0.35 - K.headDown * 0.6);
  // ---- les bras : la pose de l'espèce, le micro-balancier (période propre), la respiration
  const live = K.armLive * Math.sin(TAU * tt / 5.1 + 1.3), live2 = K.armLive * 0.6 * Math.sin(TAU * tt / 6.7);
  const A = K.arms;
  // les mains posées (hanches, mur) ne prennent pas l'accent du style : la pose EST le geste
  const posed = kind === 'mur' || kind === 'mainsHanches';
  const elev = A.elev + (posed ? 0 : style.armElev) + br * 0.5, elbow = A.elbow + (posed ? 0 : style.elbow);
  Object.assign(J, armPose('Left', { elev, fwd: A.fwd + live, elbow: elbow + live2, twist: A.twist }));
  Object.assign(J, armPose('Right', { elev, fwd: A.fwd - live, elbow: elbow - live2, twist: A.twist }));
  if (K.wrists) {
    // les mains SUR le ballon : IK de bras vers les deux poignets (le micro-balancier respire avec la cage)
    const w = K.wrists, lift = 0.01 * Math.sin(TAU * tt / 5.1);
    const partialA = fkPose(P, { Hips: jointToSpec(P, 'Hips', RHips), Spine: jointToSpec(P, 'Spine', J.Spine), Spine1: jointToSpec(P, 'Spine1', J.Spine1), Spine2: jointToSpec(P, 'Spine2', J.Spine2) }, hips);
    for (const [side, sgn] of [['Left', -1], ['Right', 1]]) {
      const Rpar = [J.Hips, J.Spine, J.Spine1, J.Spine2].reduce((acc, q) => quatMul(acc, q));
      const r = armIK(P, side, partialA[`${side}Arm`].p, Rpar, [sgn * w[0], w[1] + lift, w[2]], [sgn * 0.6, 0.2, 0.6]);
      J[`${side}Arm`] = r.Rarm; J[`${side}ForeArm`] = r.Rfore;
    }
  }
  // ---- les jambes : pieds FIXES en repère personnage, IK sur le bassin qui bouge
  const partial = fkPose(P, { Hips: jointToSpec(P, 'Hips', RHips) }, hips);
  const feet = {};
  for (const [side, sgn] of [['Left', 1], ['Right', -1]]) {
    const hipW = partial[`${side}UpLeg`].p;
    const target = [-sgn * hw + (K.slide || 0) * sw, ankleY + L.foot * Math.sin(heel * D2R), 0.0];
    // la jambe LIBRE (le bassin est parti de l'autre côté) lève le talon de ce qui lui manque en
    // portée — comme une vraie jambe déchargée ; l'orteil reste au sol, la pose ne glisse pas
    const dh = Math.hypot(target[0] - hipW[0], target[2] - hipW[2]);
    const needY = hipW[1] - Math.sqrt(Math.max(0, (0.99 * R) ** 2 - dh * dh));
    const lift = Math.min(0.05, Math.max(0, needY - target[1]));
    let heelS = heel;
    if (lift > 1e-4) { target[1] += lift; heelS = Math.max(heel, Math.asin(Math.min(1, lift / L.foot)) / D2R); }
    const r = legIK(P, side, hipW, RHips, target, [-sgn * 0.15, 0, -1]);
    J[`${side}UpLeg`] = r.Rthigh; J[`${side}Leg`] = r.Rshank;
    const legW = quatMul(quatMul(RHips, r.Rthigh), r.Rshank);
    const flat = quatNormalize(quatConjugate(legW));
    J[`${side}Foot`] = quatMul(flat, chain(ry(sgn * style.turnout), rx(-heelS)));
    J[`${side}ToeBase`] = rx(heelS * 0.8);
    feet[side] = { target, reachable: r.reachable, knee: r.knee, hip: hipW, lift };
  }
  const q = {};
  for (const [bone, R] of Object.entries(J)) { const s = jointToSpec(P, bone, R); if (s) q[bone] = s; }
  return { q, hips, J, feet, meta: { kind, drop, sway: sw, lean, bounceU, params: K } };
}

/**
 * LA POLITIQUE D'ATTENTE — quelle espèce pour quelle situation. Pure : (contexte, persona) → espèce.
 * ctx : { keeper, dead (temps mort), wall (dans le mur d'un coup franc), ballD (m), carrierD (m, porteur
 *        ADVERSE le plus proche — Infinity sinon), defending, inPlay }
 */
export function idlePolicy(ctx, persona = null) {
  const calm = persona?.calm ?? 1, burst = persona?.burstiness ?? 1;
  if (ctx.wall) return 'mur';
  if (ctx.toucheTaker) return 'ballonMains';
  if (ctx.keeper) {
    if (ctx.dead) return calm > 1.08 ? 'mainsHanches' : 'repos';
    return (ctx.ballD ?? 99) < 32 ? 'pretGardien' : 'repos';
  }
  if (ctx.dead) return burst > 1.18 ? 'sautillement' : calm > 1.1 ? 'mainsHanches' : 'repos';
  if (ctx.defending && (ctx.carrierD ?? 99) < 5.5) return 'pret';
  return 'repos';
}

/** Un CYCLE d'attente en spec animkit (une période de balancement) — la planche-contact, checkClip. */
export function idleCycleSpec(P, { kind = 'repos', style = NEUTRAL_IDLE_STYLE, fps = 30, seconds = null, opts = {} } = {}) {
  const K = IDLE_KINDS[kind] || IDLE_KINDS.repos;
  const T = Math.round((seconds ?? (K.bounce > 0 ? K.bounceT * 4 : K.swayT * style.swayT)) * 100) / 100;
  const n = Math.max(8, Math.round(T * fps));
  const keys = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * T;
    const g = idlePose(P, t, kind, style, opts);
    const pose = {};
    for (const [b, qq] of Object.entries(g.q)) pose[b] = quatToEulerXYZ(qq).map((x) => Math.round(x * 100) / 100);
    keys.push({ t: i === n ? T : Math.round(t * 10000) / 10000, pose, hips: g.hips.map((x) => Math.round(x * 1000) / 1000) });
  }
  return { name: `attente-${kind}`, duration: T, loop: true, contact: 0, keys };
}

/** LE PORTRAIT d'une attente : positions monde FK (pieds, orteils, genoux, mains, coudes, poitrine, tête) sur N instants. */
export function idlePortrait(P, { kind = 'repos', style = NEUTRAL_IDLE_STYLE, opts = {}, seconds = 12, n = 120 } = {}) {
  const frames = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * seconds;
    const g = idlePose(P, t, kind, style, opts);
    const fk = fkPose(P, g.q, g.hips);
    const kneeAngle = (side) => {
      const a = [fk[`${side}UpLeg`].p[0] - fk[`${side}Leg`].p[0], fk[`${side}UpLeg`].p[1] - fk[`${side}Leg`].p[1], fk[`${side}UpLeg`].p[2] - fk[`${side}Leg`].p[2]];
      const b = [fk[`${side}Foot`].p[0] - fk[`${side}Leg`].p[0], fk[`${side}Foot`].p[1] - fk[`${side}Leg`].p[1], fk[`${side}Foot`].p[2] - fk[`${side}Leg`].p[2]];
      const la = Math.hypot(...a), lb = Math.hypot(...b);
      return 180 - Math.acos(clamp((a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (la * lb || 1), -1, 1)) / D2R;
    };
    frames.push({ t, meta: g.meta, reachable: g.feet.Left.reachable && g.feet.Right.reachable,
      L: { ankle: fk.LeftFoot.p, toe: fk.LeftToeBase.p, knee: fk.LeftLeg.p, hip: fk.LeftUpLeg.p, hand: fk.LeftHand.p, elbow: fk.LeftForeArm.p, kneeAngle: kneeAngle('Left') },
      R: { ankle: fk.RightFoot.p, toe: fk.RightToeBase.p, knee: fk.RightLeg.p, hip: fk.RightUpLeg.p, hand: fk.RightHand.p, elbow: fk.RightForeArm.p, kneeAngle: kneeAngle('Right') },
      pelvis: fk.Hips.p, chest: fk.Spine2.p, head: fk.Head.p, shoulderR: fk.RightArm.p });
  }
  return { frames, seconds };
}

/**
 * LE CONTRAT d'une attente : les pieds ne bougent pas (une attente ne glisse pas), rien sous la pelouse,
 * le genou de l'espèce, les mains où l'espèce les met (hanches, devant le bas-ventre, devant soi), la
 * respiration visible mais petite, le balancement borné, lent (≤ 6 rad/s ; 14 en sautillement).
 */
export function checkIdleGen(P, { kind = 'repos', style = NEUTRAL_IDLE_STYLE, opts = {} } = {}) {
  const issues = [];
  const K = IDLE_KINDS[kind] || IDLE_KINDS.repos;
  const { frames } = idlePortrait(P, { kind, style, opts, seconds: 12, n: 120 });
  const ground = P.lengths.groundY, hipRestY = P.bones.LeftUpLeg.bindP[1];
  const f0 = frames[0];
  let footMove = 0, toeMin = Infinity, kneeMin = 999, kneeMax = -999, unreach = 0;
  for (const f of frames) {
    for (const side of ['L', 'R']) {
      footMove = Math.max(footMove, Math.hypot(f[side].ankle[0] - f0[side].ankle[0], f[side].ankle[2] - f0[side].ankle[2]));
      toeMin = Math.min(toeMin, f[side].toe[1] - ground);
      kneeMin = Math.min(kneeMin, f[side].kneeAngle); kneeMax = Math.max(kneeMax, f[side].kneeAngle);
    }
    if (!f.reachable) unreach++;
  }
  if (footMove > 0.005) issues.push(`les pieds bougent de ${(footMove * 100).toFixed(1)} cm — une attente ne glisse pas`);
  if (toeMin < -0.01) issues.push(`l'orteil sous la pelouse (${(toeMin * 100).toFixed(1)} cm)`);
  if (unreach) issues.push(`${unreach} instants hors de portée`);
  const kneeBand = { repos: [0, 24], mainsHanches: [0, 24], sautillement: [5, 45], pret: [24, 44], pretGardien: [30, 52], mur: [3, 24] }[kind] || [0, 60];
  if (kneeMin < kneeBand[0] - 0.5 || kneeMax > kneeBand[1] + 0.5) issues.push(`${kind} : genou [${kneeMin.toFixed(0)}, ${kneeMax.toFixed(0)}]° hors [${kneeBand}]`);
  // les mains de l'espèce (poignets, repère personnage : droite +X, haut +Y, avant −Z)
  const hR = f0.R.hand, hL = f0.L.hand, eR = f0.R.elbow;
  const chestZ = f0.chest[2];
  if (kind === 'mainsHanches') {
    const d = Math.hypot(hR[0] - 0.24, hR[1] - 0.99, hR[2] - 0.0);
    if (d > 0.07) issues.push(`mains sur les hanches : poignet droit à ${(d * 100).toFixed(1)} cm de la crête (${hR.map((v) => v.toFixed(2))})`);
    if (eR[0] < hR[0] + 0.03) issues.push('mains sur les hanches : le coude n\'est pas dehors');
  }
  if (kind === 'mur') {
    const apart = Math.hypot(hR[0] - hL[0], hR[1] - hL[1], hR[2] - hL[2]);
    if (apart > 0.16) issues.push(`mur : les mains sont à ${(apart * 100).toFixed(0)} cm l'une de l'autre (croisées : ≤ 16)`);
    if (!(hR[2] < chestZ - 0.07 && hR[1] < 1.1 && hR[1] > 0.85)) issues.push(`mur : les mains ne protègent pas le bas-ventre (${hR.map((v) => v.toFixed(2))})`);
  }
  if (kind === 'pret' || kind === 'pretGardien') {
    if (!(hR[2] < chestZ - 0.12)) issues.push(`${kind} : les mains ne sont pas devant (z ${hR[2].toFixed(2)} c. poitrine ${chestZ.toFixed(2)})`);
    if (!(hR[1] < f0.shoulderR[1] - 0.2)) issues.push(`${kind} : les mains sont trop hautes`);
    if (kind === 'pretGardien' && !(hR[0] - hL[0] > 0.45)) issues.push(`gardien : les gants ne sont pas ouverts (${((hR[0] - hL[0]) * 100).toFixed(0)} cm)`);
    const leanDeg = Math.atan2(-(f0.chest[2] - f0.pelvis[2]), f0.chest[1] - f0.pelvis[1]) / D2R;
    if (leanDeg < 10) issues.push(`${kind} : le buste ne penche pas (${leanDeg.toFixed(0)}°)`);
  }
  if (kind === 'repos') {
    if (!(Math.abs(hR[0]) < 0.36 && Math.abs(hR[2]) < 0.15)) issues.push(`repos : la main n'est pas le long du corps (${hR.map((v) => v.toFixed(2))})`);
  }
  // la respiration : les épaules montent (≥ 2 mm au-dessus du bassin) mais peu (≤ 25 mm) ; le balancement borné
  const shY = frames.map((f) => f.shoulderR[1] - f.pelvis[1]);
  const breathPP = Math.max(...shY) - Math.min(...shY);
  if (breathPP < 0.002) issues.push('pas de respiration (épaules immobiles)');
  if (breathPP > 0.025) issues.push(`respiration excessive (${(breathPP * 1000).toFixed(0)} mm)`);
  const px = frames.map((f) => f.pelvis[0]);
  const swayPP = Math.max(...px) - Math.min(...px);
  const swayBand = { repos: [0.03, 0.11], mainsHanches: [0.025, 0.1], sautillement: [0, 0.05], pret: [0, 0.07], pretGardien: [0, 0.06], mur: [0, 0.03] }[kind] || [0, 0.12];
  if (swayPP < swayBand[0] || swayPP > swayBand[1]) issues.push(`${kind} : balancement de ${(swayPP * 100).toFixed(1)} cm hors [${swayBand.map((v) => v * 100)}]`);
  // le bassin ne s'élève jamais au-dessus du repos
  if (Math.max(...frames.map((f) => f.pelvis[1])) > P.bones.Hips.bindP[1] + 0.005) issues.push('le bassin monte au-dessus du repos');
  void hipRestY;
  return { ok: issues.length === 0, issues, portrait: { breathPP, swayPP, kneeMin, kneeMax, handR: hR } };
}
