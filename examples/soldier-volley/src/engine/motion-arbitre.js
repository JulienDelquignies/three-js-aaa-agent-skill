// motion-arbitre — LES GESTES DE L'ARBITRE (lot A11 bis) : le sifflet, le carton, le bras qui désigne, l'avantage.
//
// Le central avait ses lois (referee.js : sifflet, cartons, avantage) et un corps qui court (scenes/arbitre.js) mais aucun
// geste : il sifflait sans porter la main à la bouche, montrait des cartons sans lever le bras. Ici quatre gestes du HAUT
// (spec.upperOnly — le corps continue de courir ou s'arrête selon la sim), écrits comme les autres familles (rampes C¹,
// armJoints, emitSpec) :
//
//   siffler    — la main droite porte le sifflet à la bouche, le coude haut, la tête légèrement relevée ; tenu
//   carton     — le bras droit tendu au-dessus de la tête (la carte dans la main : la scène l'attache au bone), le regard
//                vers le fautif ; tenu deux secondes
//   designer   — le bras droit tendu à l'horizontale devant (la direction du coup franc), le tronc légèrement tourné
//   avantage   — les deux bras tendus devant, bas, qui balaient deux fois vers l'avant (« jouez ») — en courant
//
// La sim pilote (cfg.arbitreGestes : st.arbitre.geste { kind, at, until, dir, couleur }) ; la scène lit et habille.

import { rx, ry, rz, chain } from './motion-rig.js';
import { ramp, emitSpec, armJoints, bodyPortrait, NEUTRAL_STYLE } from './motion-strike.js';

export const ARBITRE_KINDS = {
  siffler:  { duration: 1.3, contact: 0.44, hold: 0.8, upperOnly: true, elev: 30, fwd: 50, elbow: 150, rot: 60, headUp: 6 },
  carton:   { duration: 2.3, contact: 0.48, hold: 1.85, upperOnly: true, elev: 176, fwd: 6, elbow: 6, headUp: 10 },   // (A11 ter) tenu 0,3 s de plus, face au fautif (referee : le regard suit dir)
  designer: { duration: 1.4, contact: 0.34, hold: 1.05, upperOnly: true, elev: 2, fwd: 96, elbow: 4, yaw: 10 },
  avantage: { duration: 1.4, contact: 0.32, hold: 1.05, upperOnly: true, elev: 8, fwd: 62, elbow: 6, sweep: 16, sweeps: 2 },
  // (A11 ter, § 5) LES GESTES DE L'ASSISTANT — la hampe dans la main droite (la scène l'attache au bone : elle suit le bras) :
  //   drapeauLeve       le hors-jeu : le bras tendu droit au-dessus de la tête, la hampe dressée — TENU tant que la sim le dit (la scène clampe à hold)
  //   drapeauIncline    la touche : la hampe à ~45° du côté que l'équipe attaque — vers SA droite (le bras levé de côté)
  //   drapeauInclineG   …vers sa gauche : le bras passe devant la poitrine
  //   drapeauHorizontal le remplacement : la hampe tenue à deux mains au-dessus de la tête, à l'horizontale (plat : le poignet couche la hampe)
  drapeauLeve:       { duration: 2.2, contact: 0.5, hold: 1.8, upperOnly: true, drapeau: true, elev: 178, fwd: 4, elbow: 4, headUp: 4 },
  drapeauIncline:    { duration: 2.0, contact: 0.45, hold: 1.6, upperOnly: true, drapeau: true, elev: 118, fwd: -12, elbow: 6 },
  drapeauInclineG:   { duration: 2.0, contact: 0.45, hold: 1.6, upperOnly: true, drapeau: true, elev: -60, fwd: 90, elbow: 8 },   // elev < 0 : le bras croise devant (mesuré : main à 42 cm à gauche de l'épaule, à sa hauteur)
  drapeauHorizontal: { duration: 3.0, contact: 0.5, hold: 2.5, upperOnly: true, drapeau: true, deux: true, elev: 160, fwd: -30, elbow: 20, plat: 80 },   // les deux mains à 25 cm au-dessus de la tête, 72 cm l'une de l'autre ; plat : le poignet couche la hampe
};
export const ARBITRE_NAMES = Object.keys(ARBITRE_KINDS);

const I = [0, 0, 0, 1];
function trunk(J, { lean = 0, yaw = 0, headPitch = 0, headYaw = 0 }) {
  for (const [b, wy, wl] of [['Spine', 0.25, 0.35], ['Spine1', 0.35, 0.35], ['Spine2', 0.40, 0.30]]) J[b] = chain(rx(-lean * wl), ry(yaw * wy));
  J.Neck = chain(rx(headPitch * 0.4), ry(headYaw * 0.4));
  J.Head = chain(rx(headPitch * 0.6), ry(headYaw * 0.6));
  J.LeftShoulder = I; J.RightShoulder = I;
}
const NEUTRAL_ARM = { elev: 14, fwd: 6, elbow: 14 };
const mix = (a, b, u) => a + (b - a) * u;
const armAt = (side, from, to, u) => armJoints(side, { elev: mix(from.elev, to.elev, u), fwd: mix(from.fwd, to.fwd, u), elbow: mix(from.elbow, to.elbow, u), rot: mix(from.rot ?? 0, to.rot ?? 0, u) });

/** GÉNÉRER un geste d'arbitre (main DROITE ; le miroir d'animkit fait la gauche). */
export function generateArbitre(kindName, P, { style = NEUTRAL_STYLE } = {}) {
  const K = ARBITRE_KINDS[kindName];
  if (!K) throw new Error(`motion-arbitre : espèce inconnue « ${kindName} »`);
  const S = { ...NEUTRAL_STYLE, ...style };
  const A = Math.max(0.9, Math.min(1.08, S.armElev ?? 1));
  const T = K.duration, tc = K.contact;
  const on = (t) => ramp(t, 0, 0.55 * tc, tc) * (1 - ramp(t, K.hold, (K.hold + T) / 2, T));
  let poseAt;
  if (kindName === 'siffler') {
    poseAt = (t) => { const a = on(t), J = {}; trunk(J, { headPitch: K.headUp * a, lean: -2 * a });
      Object.assign(J, armAt('Right', NEUTRAL_ARM, { elev: K.elev * A, fwd: K.fwd, elbow: K.elbow, rot: K.rot ?? 0 }, a), armAt('Left', NEUTRAL_ARM, { elev: 16, fwd: 10, elbow: 30 }, a));
      return { J, hips: [0, 0, 0] }; };
  } else if (K.drapeau) {   // (A11 ter, § 5) la hampe tenue : le bras droit à sa pose, la gauche calme ou symétrique (deux mains)
    poseAt = (t) => { const a = on(t), J = {}; trunk(J, { headPitch: (K.headUp ?? 0) * a, lean: -2 * a });
      const R = { elev: K.elev * Math.min(A, 1.03), fwd: K.fwd, elbow: K.elbow, rot: K.rot ?? 0 };
      Object.assign(J, armAt('Right', NEUTRAL_ARM, R, a), armAt('Left', NEUTRAL_ARM, K.deux ? { ...R, rot: -(K.rot ?? 0) } : { elev: 14, fwd: 4, elbow: 16 }, a));
      if (K.plat) J.RightHand = rx(K.plat * a);
      return { J, hips: [0, 0, 0] }; };
  } else if (kindName === 'carton') {
    poseAt = (t) => { const a = on(t), J = {}; trunk(J, { headPitch: K.headUp * a, lean: -4 * a });
      Object.assign(J, armAt('Right', NEUTRAL_ARM, { elev: K.elev * Math.min(A, 1.03), fwd: K.fwd, elbow: K.elbow }, a), armAt('Left', NEUTRAL_ARM, { elev: 14, fwd: 4, elbow: 16 }, a));
      return { J, hips: [0, 0.005 * a, 0] }; };
  } else if (kindName === 'designer') {
    poseAt = (t) => { const a = on(t), J = {}; trunk(J, { yaw: -K.yaw * a, headYaw: -K.yaw * 0.6 * a, headPitch: 2 * a });
      Object.assign(J, armAt('Right', NEUTRAL_ARM, { elev: K.elev * A, fwd: K.fwd, elbow: K.elbow }, a), armAt('Left', NEUTRAL_ARM, { elev: 14, fwd: 4, elbow: 16 }, a));
      return { J, hips: [0, 0, 0] }; };
  } else {
    const per = (K.hold - tc) / K.sweeps;
    poseAt = (t) => { const a = on(t), J = {}; const ph = t < tc ? 0 : Math.min(K.sweeps, (t - tc) / per); const sw = (t < tc || t > K.hold) ? 0 : 0.5 - 0.5 * Math.cos(ph * 2 * Math.PI);
      trunk(J, { lean: 4 * a, headPitch: 4 * a });
      const arms = { elev: K.elev * A, fwd: K.fwd + K.sweep * sw, elbow: K.elbow + 4 * sw };
      Object.assign(J, armAt('Right', NEUTRAL_ARM, arms, a), armAt('Left', NEUTRAL_ARM, arms, a));
      return { J, hips: [0, 0, 0.01 * a] }; };
  }
  const keys = emitSpec(P, { duration: T, contact: tc, fps: 60, poseAt, ik: () => ({}), marks: [K.hold] });
  return { name: kindName, duration: T, contact: tc, hold: K.hold, foot: 'right', generated: true, family: 'arbitre', upperOnly: true, keys };
}

/** Le portrait : mains, tête, épaules, poitrine — en série. */
export function arbitrePortrait(spec, P) {
  const body = bodyPortrait(spec, P, { support: null });
  const series = body.samples.map(({ t, w }) => ({ t, lh: w.LeftHand.p, rh: w.RightHand.p, head: w.Head.p, chest: w.Spine2.p, ls: w.LeftArm.p, rs: w.RightArm.p, pelvis: w.Hips.p }));
  const pick = (t) => series.reduce((b, s) => Math.abs(s.t - t) < Math.abs(b.t - t) ? s : b, series[0]);
  return { ...body, series, pick, start: series[0], end: series[series.length - 1] };
}

/** LE CONTRAT : le sifflet à la bouche (main à ≤ 16 cm du point-bouche), le carton au-dessus de la tête (bras tendu),
 *  le bras qui désigne à l'horizontale devant, l'avantage à deux bras devant qui balaient deux fois — et chaque geste
 *  revient à sa pose de départ. */
export function checkArbitreGen(spec, P, kind) {
  const issues = [];
  const K = ARBITRE_KINDS[kind], p = arbitrePortrait(spec, P);
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const s = p.pick((spec.contact + K.hold) / 2);
  const shoulderY = (s.ls[1] + s.rs[1]) / 2;
  if (p.endGap > 0.06) issues.push(`${kind} : la pose finale n'est pas la pose initiale (écart ${(100 * p.endGap).toFixed(0)} cm)`);
  if (kind === 'siffler') {
    const mouth = [0.03, s.head[1] - 0.07, s.head[2] - 0.10];   // la bouche : 7 cm sous le centre de la tête, 10 cm devant, un peu à droite (la main droite)
    if (!(dist(s.rh, mouth) < 0.20)) issues.push(`siffler : la main n'est pas à la bouche (${(100 * dist(s.rh, mouth)).toFixed(0)} cm)`);
  }
  if (kind === 'carton') {
    if (!(s.rh[1] > s.head[1] + 0.30)) issues.push(`carton : la main n'est pas au-dessus de la tête (+${(100 * (s.rh[1] - s.head[1])).toFixed(0)} cm, attendu ≥ 30)`);
    if (!(dist(s.rh, s.rs) > 0.46)) issues.push(`carton : le bras n'est pas tendu (${(100 * dist(s.rh, s.rs)).toFixed(0)} cm épaule-main)`);
  }
  if (kind === 'designer') {
    if (!(Math.abs(s.rh[1] - shoulderY) < 0.14)) issues.push(`designer : la main n'est pas à hauteur d'épaule (${(100 * (s.rh[1] - shoulderY)).toFixed(0)} cm)`);
    if (!(s.rh[2] < s.rs[2] - 0.42)) issues.push(`designer : le bras n'est pas tendu devant (${(100 * (s.rs[2] - s.rh[2])).toFixed(0)} cm devant l'épaule)`);
  }
  if (kind === 'drapeauLeve') {
    if (!(s.rh[1] > s.head[1] + 0.30)) issues.push(`drapeauLeve : la main n'est pas au-dessus de la tête (+${(100 * (s.rh[1] - s.head[1])).toFixed(0)} cm, ≥ 30)`);
    if (!(dist(s.rh, s.rs) > 0.46)) issues.push(`drapeauLeve : le bras n'est pas tendu (${(100 * dist(s.rh, s.rs)).toFixed(0)} cm épaule-main)`);
  }
  if (kind === 'drapeauIncline') {
    if (!(s.rh[0] > s.rs[0] + 0.30 && s.rh[1] > shoulderY + 0.12)) issues.push(`drapeauIncline : la main n'est pas levée de côté (${(100 * (s.rh[0] - s.rs[0])).toFixed(0)} cm à droite de l'épaule, +${(100 * (s.rh[1] - shoulderY)).toFixed(0)} cm)`);
  }
  if (kind === 'drapeauInclineG') {
    if (!(s.rh[0] < s.rs[0] - 0.30 && s.rh[1] > shoulderY - 0.06 && s.rh[2] < s.rs[2] - 0.10)) issues.push(`drapeauInclineG : la main ne croise pas devant vers la gauche (${(100 * (s.rs[0] - s.rh[0])).toFixed(0)} cm à gauche de l'épaule, ${(100 * (s.rh[1] - shoulderY)).toFixed(0)} cm de haut, ${(100 * (s.rs[2] - s.rh[2])).toFixed(0)} cm devant)`);
  }
  if (kind === 'drapeauHorizontal') {
    if (!(s.rh[1] > s.head[1] + 0.08 && s.lh[1] > s.head[1] + 0.08)) issues.push(`drapeauHorizontal : les deux mains ne sont pas au-dessus de la tête (+${(100 * (s.rh[1] - s.head[1])).toFixed(0)} / +${(100 * (s.lh[1] - s.head[1])).toFixed(0)} cm)`);
    if (!(dist(s.rh, s.lh) > 0.25 && dist(s.rh, s.lh) < 0.75)) issues.push(`drapeauHorizontal : les mains ne tiennent pas la hampe (${(100 * dist(s.rh, s.lh)).toFixed(0)} cm entre elles, 25-75)`);
  }
  if (kind === 'avantage') {
    if (!(s.rh[2] < s.chest[2] - 0.32 && s.lh[2] < s.chest[2] - 0.32)) issues.push('avantage : les deux bras ne sont pas devant');
    if (!(s.rh[1] < shoulderY && s.rh[1] > s.pelvis[1] - 0.1)) issues.push('avantage : les mains ne sont pas entre la taille et l\'épaule');
    const z = p.series.filter((x) => x.t > spec.contact && x.t < K.hold).map((x) => x.rh[2]);
    let ext = 0; for (let i = 1; i < z.length - 1; i++) if (z[i] < z[i - 1] && z[i] <= z[i + 1]) ext++;
    if (ext < 2) issues.push(`avantage : ${ext} balayage(s) vers l'avant, attendu 2`);
  }
  return { ok: issues.length === 0, issues, portrait: p };
}
