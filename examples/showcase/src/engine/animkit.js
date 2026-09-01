// animkit — Blender's ANIMATION side as data (the meshkit of movement, reference/42): author a move
// as named POSES (degrees per Mixamo bone) on a timeline, resolve to quaternion tracks, prove it with
// a contract, judge the gesture on a live screenshot. Dependency-free (quaternion math inline) →
// node-testable by scripts/verify-animkit.mjs; animkit-builder.js turns resolved tracks into a
// THREE.AnimationClip against a real rig (bone names resolved by suffix — GLB exports rename).
//   spec = { name, duration, loop?, keys: [{ t, pose: { RightArm: [x°,y°,z°], … }, ease? }] }
// Poses are ABSOLUTE local rotations (XYZ order). All-zero = the Mixamo T-POSE, so BASE_POSE
// (arms lowered) is merged under every key — author only what MOVES.
export const MIXAMO_BONES = [
  'Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head',
  'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand',
  'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand',
  'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase',
  'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase',
];

/** Neutral standing base: arms lowered from the T-pose, slight elbow relax. */
// LA POSE NEUTRE, SYMÉTRIQUE (loi du miroir : conjugaison [x, −y, −z], exacte sur ce rig) — ET SUR
// LE BON AXE. La sonde d'axes sur shanon.glb (FK nue, une rotation à la fois) a tranché ce que
// quatre sessions ont cru sans mesurer : sur ce rig c'est X qui ABAISSE le bras (Arm x=60 →
// élévation −60°) tandis que Z le balance HORIZONTALEMENT (z=60 → azimut 31° à hauteur d'épaule,
// z=−60 → 151°). L'ancienne base [0, 0, ±60] gardait donc les bras EN CROIX — invisible tant que
// la couche annulait la base (l'autre moitié du bug), en épouvantail dès qu'elle a affiché ce qui
// était écrit : élévation médiane −14° à −5° sur 94-100 % des images de geste, mesuré composé.
// Valeurs RÉSOLUES contre cibles (élév −65°, coude ~160°) et vérifiées sur le rig (solveur du
// sweep) ; ForeArms en paire miroir EXACTE (la clause de symétrie l'exige).
export const BASE_POSE = {
  LeftArm: [65, 0, 0], RightArm: [65, 0, 0],
  LeftForeArm: [-12, 0, 8], RightForeArm: [-12, 0, -8],
};

/**
 * Le MIROIR d'une pose locale, en euler XYZ. C'est [x, −y, −z] et ce n'est pas un choix : c'est la
 * conjugaison q → (w, x, −y, −z), c'est-à-dire la réflexion d'une rotation par le plan sagittal.
 * Écrit ici pour que la loi ait un nom et un test, parce qu'elle a déjà été « corrigée » à tort en
 * [x, −y, z] — qui se trompe de 1,40 sur le quaternion, soit un bras ailleurs.
 */
export const mirrorEuler = ([x, y, z]) => [x, -y, -z];

const D2R = Math.PI / 180;
export function eulerToQuat([x, y, z]) {                           // XYZ order (three.js convention)
  const c1 = Math.cos(x * D2R / 2), s1 = Math.sin(x * D2R / 2);
  const c2 = Math.cos(y * D2R / 2), s2 = Math.sin(y * D2R / 2);
  const c3 = Math.cos(z * D2R / 2), s3 = Math.sin(z * D2R / 2);
  return [
    s1 * c2 * c3 + c1 * s2 * s3,
    c1 * s2 * c3 - s1 * c2 * s3,
    c1 * c2 * s3 + s1 * s2 * c3,
    c1 * c2 * c3 - s1 * s2 * s3,
  ];
}
export const quatAngle = (a, b) => {                               // shortest angle between rotations
  const d = Math.min(1, Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]));
  return 2 * Math.acos(d);
};

/** Resolve a spec → per-bone quaternion keyframes (BASE merged, every key stamps every used bone),
 *  plus the ROOT MOTION track if any key carries `hips: [dx, dy, dz]` (METERS, deltas from rest —
 *  dives, jumps and bicycle kicks need the pelvis to actually travel; the builder calibrates metres
 *  to rig units, Mixamo skeletons are usually centimetres). */
export function resolveTracks(spec) {
  // SEULS LES OS AUTHORÉS ont une piste. La version d'avant semait aussi les os de BASE_POSE :
  // tout geste, même sans une seule clé de bras, IMPOSAIT donc ses bras — et avec la couche
  // absolue, les imposait à la base (croix mesurée composée). Un os que le geste ne pose pas
  // appartient à la locomotion — un membre non authoré est un membre RENDU, pas un membre figé.
  // (BASE_POSE reste le repli de VALEUR pour un os authoré ailleurs mais absent d'une clé.)
  const bones = new Set();
  for (const k of spec.keys) for (const b of Object.keys(k.pose)) bones.add(b);
  const tracks = {};
  for (const b of bones) {
    tracks[b] = spec.keys.map((k) => ({
      t: k.t,
      e: k.pose[b] || BASE_POSE[b] || [0, 0, 0],
      q: eulerToQuat(k.pose[b] || BASE_POSE[b] || [0, 0, 0]),
    }));
  }
  const hipsPos = spec.keys.some((k) => k.hips)
    ? spec.keys.map((k) => ({ t: k.t, p: k.hips || [0, 0, 0] }))
    : null;
  return { name: spec.name, duration: spec.duration, loop: !!spec.loop, tracks, hipsPos };
}

/** The movement contract — a generated move must be an ANATOMICALLY SANE animation. */
export function checkClip(resolved) {
  const issues = [];
  const { duration, loop, tracks } = resolved;
  if (!(duration > 0)) issues.push('non-positive duration');
  for (const [bone, keys] of Object.entries(tracks)) {
    if (!MIXAMO_BONES.includes(bone)) { issues.push(`unknown bone "${bone}" (not on the Mixamo rig)`); continue; }
    for (let i = 0; i < keys.length; i++) {
      if (keys[i].t < 0 || keys[i].t > duration) issues.push(`${bone}: key outside [0, duration]`);
      if (i && keys[i].t <= keys[i - 1].t) { issues.push(`${bone}: keys not strictly sorted`); break; }
      const q = keys[i].q, n = hyp(...q);
      if (Math.abs(n - 1) > 1e-3) { issues.push(`${bone}: non-normalized quaternion`); break; }
    }
    // limbs must MOVE, not teleport: bounded angular velocity between consecutive keys.
    // LE PLAFOND EST PAR CHAÎNE, ET C'EST MESURÉ : l'ancien plafond unique de 14 rad/s (802°/s)
    // INTERDISAIT une frappe réaliste — le genou d'un joueur d'élite atteint 19,8 à 28 rad/s
    // (1134–1604°/s) en phase d'accélération (revue systématique du coup de pied de cou-de-pied,
    // Petrolo et al. 2023). Nos frappes plafonnaient à 7,5 rad/s au genou : 3,5 à 5 fois trop lent,
    // et c'est une part directe du rendu « mou ». Les jambes montent donc à 30 rad/s ; tout le reste
    // (bras, tronc, tête) garde 14 — un BRAS à 20 rad/s est bien un bug, pas une frappe.
    const wCap = /Leg$|UpLeg$|Foot$|ToeBase$/.test(bone) ? 30 : 14;
    for (let i = 1; i < keys.length; i++) {
      const w = quatAngle(keys[i - 1].q, keys[i].q) / Math.max(1e-4, keys[i].t - keys[i - 1].t);
      if (w > wCap) { issues.push(`${bone}: limb teleports (${w.toFixed(0)} rad/s between keys, cap ${wCap})`); break; }
    }
    // a looping move must land where it starts (the loop-seam pop, reference/20)
    if (loop && keys.length > 1 && quatAngle(keys[0].q, keys[keys.length - 1].q) > 0.26) issues.push(`${bone}: loop seam pops (start ≠ end)`);
    // hinge sanity where the axis is unambiguous on this rig — et le signe est MESURÉ, plus cru :
    // la sonde articulaire (FK nue sur shanon.glb) dit cuisse x = +45 → pied +0,56 m VERS L'AVANT
    // (flexion = +x), genou x = −90 → talon vers la fesse (flexion = −x). L'ancienne croyance était
    // l'inverse des DEUX : toutes les frappes de la bibliothèque balayaient vers l'arrière (passe :
    // −0,46 m d'avant au contact) et le genou pliait vers l'avant — invisible pour toute clause en
    // amplitude, vu par l'utilisateur (« beaucoup de talonnade »). Un genou plié en avant est LE
    // signe de l'anim générée cassée ; maintenant la borne le dit dans le bon sens.
    if (bone === 'LeftLeg' || bone === 'RightLeg') for (const k of keys) { if (k.e[0] < -150 || k.e[0] > 8) { issues.push(`${bone}: knee out of range (${k.e[0].toFixed(0)}°)`); break; } }
    if (bone === 'LeftUpLeg' || bone === 'RightUpLeg') for (const k of keys) { if (k.e[0] < -40 || k.e[0] > 130) { issues.push(`${bone}: hip out of range (${k.e[0].toFixed(0)}°)`); break; } }
  }
  // ROOT MOTION sanity: the pelvis travels, it doesn't glitch — standing hip ≈ 0.95 m, a lying hip
  // ≈ 0.2 m, so dy stays in [−0.85, 1.1] (no floor clipping, no rocket jump); linear speed bounded;
  // a looping move brings the pelvis home
  if (resolved.hipsPos) {
    for (let i = 0; i < resolved.hipsPos.length; i++) {
      const k = resolved.hipsPos[i];
      if (k.p[1] < -0.85 || k.p[1] > 1.1) { issues.push(`hips through the floor or rocket jump (dy=${k.p[1].toFixed(2)} m)`); break; }
      if (i) {
        const pv = resolved.hipsPos[i - 1];
        const v = hyp(k.p[0] - pv.p[0], k.p[1] - pv.p[1], k.p[2] - pv.p[2]) / Math.max(1e-4, k.t - pv.t);
        if (v > 6.5) { issues.push(`hips teleport (${v.toFixed(1)} m/s between keys)`); break; }
      }
    }
    const first = resolved.hipsPos[0], last = resolved.hipsPos[resolved.hipsPos.length - 1];
    if (loop && hyp(...last.p.map((v, i) => v - first.p[i])) > 0.05) issues.push('hips loop seam pops (pelvis does not come home)');
  }
  return { ok: issues.length === 0, issues };
}

/**
 * Mirror a move across the sagittal plane, turning a right-footed action into a left-footed one.
 * Every ball-contact move in the library (frappe, passe, talonnade, retournée) is authored on the
 * RIGHT side, so a player asked to pass to his left either had to swivel his whole body or strike
 * with the wrong foot — the single most visible tell of AI football. Mirroring is exact and free:
 * swap the Left/Right bone names, and negate the Y and Z euler components (X, the flexion axis, is
 * shared by both sides). Root motion is a character-space [right, up, forward] triple, so only the
 * lateral component flips.
 */
/**
 * CONTRAT D'EXPRESSIVITÉ D'UNE FRAPPE — ce que « animation de foot réaliste » veut dire en clauses.
 * Mesure d'origine : 9 os sur 22 n'étaient animés dans AUCUN move, le bassin était à 0° sur toutes les
 * frappes, et cuisse et tibia atteignaient leur extrême SUR LA MÊME CLÉ (décalage proximo-distal : 0 ms,
 * là où la biomécanique exige cuisse PUIS tibia PUIS pied — Kellis & Katis). Rien n'empêchait un geste
 * plat d'être livré : c'est précisément ce qui est arrivé.
 *
 * Les clauses (chacune a son sabotage dans verify-animkit) :
 *   1. le BASSIN participe (lacet ≥ 10° d'amplitude) — une frappe part du bassin, pas du genou ;
 *   2. le TRONC tourne (Spine* lacet cumulé ≥ 12°) — l'élite tourne le rachis de ~21° ;
 *   3. la TÊTE est sur le ballon (tangage ≥ 8° vers le bas) — le quiet eye, pas un cou de mannequin ;
 *   4. le BRAS OPPOSÉ équilibre (excursion ≥ 25°). OPPOSÉ : tous les moves sont authorés pied droit,
 *      donc c'est LeftArm qu'on mesure — une première version de cette clause visait RightArm, le bras
 *      homolatéral, et aurait validé un geste au bras d'équilibre mort (attrapé par un réfuteur) ;
 *   5. la JAMBE D'APPUI existe (genou gauche keyé, amplitude ≥ 6°) — elle absorbe puis s'étend ;
 *   6. la SÉQUENCE PROXIMO-DISTALE (si demandée) : le segment le plus rapide de la cuisse se termine
 *      AVANT celui du tibia — le fouet, pas le bloc.
 */
export function checkStrike(resolved, { proximoDistal = true, flick = false } = {}) {
  const issues = [];
  const T = resolved.tracks;
  const range = (bone, axis) => {
    const ks = T[bone]; if (!ks) return 0;
    const vs = ks.map((k) => k.e[axis]);
    return Math.max(...vs) - Math.min(...vs);
  };
  const excursion = (bone) => {
    const ks = T[bone]; if (!ks) return 0;
    let worst = 0;
    for (const k of ks) worst = Math.max(worst, (quatAngle(ks[0].q, k.q) * 180) / Math.PI);
    return worst;
  };
  // DEUX RÉGIMES, comme au foot : une frappe armée engage tout le bassin ; une pichenette (extérieur,
  // déviation, talonnade) est PAR MÉCANIQUE un geste court où la jambe reste sous le corps — exiger
  // 10° de bassin la falsifierait. Le seuil suit le geste, jamais l'inverse : c'est le même principe
  // que settleMax recalibré sur la physique plutôt que la physique pliée au seuil.
  const hipMin = flick ? 6 : 10, trunkMin = flick ? 8 : 12;
  if (range('Hips', 1) < hipMin) issues.push(`bassin figé (lacet ${range('Hips', 1).toFixed(0)}° < ${hipMin}°) — une frappe part du bassin`);
  const trunk = range('Spine', 1) + range('Spine1', 1) + range('Spine2', 1);
  if (trunk < trunkMin) issues.push(`tronc figé (lacet cumulé ${trunk.toFixed(0)}° < ${trunkMin}°)`);
  const headDown = Math.max(...(T.Head || [{ e: [0, 0, 0] }]).map((k) => k.e[0]));
  if (headDown < 8) issues.push(`la tête n'est pas sur le ballon (tangage max ${headDown.toFixed(0)}° < 8°)`);
  // le bras d'équilibre travaille de l'ÉPAULE ET DU COUDE — un bras plié qui s'écarte est un vrai
  // bras d'équilibre, un bras tendu qui monte au ciel n'en est pas un (c'est l'aberration que
  // l'utilisateur a vue sur capture pendant que cette clause, qui ne mesurait que l'épaule en degrés,
  // était verte : elle vérifiait que le bras BOUGE, jamais OÙ il finit — la silhouette a sa propre
  // clause dans verify-animkit, sur la FK du vrai squelette).
  const balance = Math.max(excursion('LeftArm'), excursion('LeftForeArm'));
  if (balance < 22) issues.push(`bras d'équilibre mort (excursion épaule+coude du bras OPPOSÉ ${balance.toFixed(0)}° < 22°)`);
  if (range('LeftLeg', 0) < 6) issues.push(`pas de jambe d'appui (genou gauche ${range('LeftLeg', 0).toFixed(0)}° < 6°)`);
  if (proximoDistal) {
    const peakSeg = (bone) => {
      const ks = T[bone]; if (!ks || ks.length < 2) return null;
      let best = 0, at = 0;
      for (let i = 1; i < ks.length; i++) {
        const w = quatAngle(ks[i - 1].q, ks[i].q) / Math.max(1e-4, ks[i].t - ks[i - 1].t);
        if (w > best) { best = w; at = ks[i].t; }
      }
      return at;
    };
    const thigh = peakSeg('RightUpLeg'), shank = peakSeg('RightLeg');
    if (thigh != null && shank != null && !(thigh < shank)) {
      issues.push(`séquence proximo-distale absente (pic cuisse à t=${thigh}, tibia à t=${shank}) — le fouet exige cuisse PUIS tibia`);
    }
  }
  return { ok: issues.length === 0, issues };
}

export function mirrorMove(spec, name = `${spec.name}-gauche`) {
  const flipBone = (b) => (b.startsWith('Left') ? `Right${b.slice(4)}` : b.startsWith('Right') ? `Left${b.slice(5)}` : b);
  return {
    ...spec, name,
    keys: spec.keys.map((k) => ({
      ...k,
      pose: Object.fromEntries(Object.entries(k.pose).map(([b, [x, y, z]]) => [flipBone(b), [x, -y, -z]])),
      ...(k.hips ? { hips: [-k.hips[0], k.hips[1], k.hips[2]] } : {}),
    })),
  };
}

export { repeatSegment, MOVES } from './animkit-data.js';
import { hyp } from './hyp.js';
