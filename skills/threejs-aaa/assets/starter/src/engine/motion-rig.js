// motion-rig — LE PROFIL DU RIG : ce que le générateur de mouvement doit savoir d'un squelette
// pour écrire des rotations d'ARTICULATION au lieu de degrés par os.
//
// Un geste écrit à la main en degrés par os (animkit-data) doit connaître la convention d'axes de
// chaque os de CE rig — l'axe qui plie le genou, celui qui abaisse le bras — et quatre sessions
// l'ont apprise par sondage (reference/42, 49). Un générateur ne doit rien en savoir : il pense en
// articulations anatomiques dans le REPÈRE PERSONNAGE (droite +X, haut +Y, avant −Z) — flexion de
// hanche = rotation autour de l'axe latéral, abduction = autour de l'axe avant, rotation axiale =
// autour du long de l'os — et la conjugaison par l'orientation bind de l'os transporte cela dans le
// local du rig, exactement :
//
//     q_spec(os) = bindQ(os)⁻¹ ⊗ R ⊗ bindQ(os)
//
// où R est la rotation de l'articulation dans le repère personnage au bind, et q_spec la rotation
// ABSOLUE locale que la couche de geste compose sur le rest (rest ⊗ q_spec — gesture-layer). La
// preuve tient en une ligne : W(os) = W(parent) ⊗ rest ⊗ q_spec = R_parent ⊗ R ⊗ bindQ(os), donc
// les rotations d'articulation se composent parent → enfant comme des angles anatomiques — l'axe du
// genou est emporté par la cuisse, sans que personne n'ait à savoir quel axe local c'est.
//
// Le profil se construit de deux sources : le glTF parsé brut (node, les bancs) et les os du
// TEMPLATE de squad.js (navigateur, jamais animé — le rest exact de la couche). Même nombres.
// Pur : aucune dépendance rendu ; tout se prouve dans node (verify-motion.mjs).

import { quatMul, quatConjugate, quatNormalize, quatFromAxisAngle, applyQuat, add, sub, scale as vscale, len, clamp } from './vecmath.js';

/** Les 22 os canoniques du rig Mixamo (même liste que animkit.MIXAMO_BONES, ordre parent → enfant). */
export const CANON = [
  'Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head',
  'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand',
  'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand',
  'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase',
  'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase',
];
export const suffixOf = (n) => String(n || '').replace(/^mixamorig\d*[:_]?/i, '');

const D2R = Math.PI / 180, R2D = 180 / Math.PI;
export const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
/** Rotations d'articulation autour des axes du repère personnage (degrés). */
export const rx = (deg) => quatFromAxisAngle(X, deg * D2R);
export const ry = (deg) => quatFromAxisAngle(Y, deg * D2R);
export const rz = (deg) => quatFromAxisAngle(Z, deg * D2R);
/** Composition « appliquer a, puis b » (b ⊗ a) — lecture gauche → droite dans l'ordre d'application.
 *  (Nommée `chain`, jamais `then` : un module qui exporte `then` devient un thenable pour import(),
 *  et la promesse l'appelle avec (resolve, reject) — attrapé au premier import dynamique.) */
export const chain = (...qs) => qs.reduce((acc, q) => quatMul(q, acc), [0, 0, 0, 1]);

/**
 * Construire le profil.
 * @param bones [{ name (canonique), parent (canonique|null), t:[x,y,z] (position locale de repos,
 *               unités du rig), q:[x,y,z,w] (rotation locale de repos) }]
 * @param rootQ rotation du nœud parent de Hips dans le repère personnage (le wrapper de squad.js
 *              tourne un rig « +Z » de 180° ; une armature Mixamo classique est tournée de −90° X)
 * @param rootP position de ce nœud (mètres, repère personnage)
 * @param scale unités du rig → mètres (× normalisation de taille du squad)
 */
export function makeProfile(bones, { rootQ = [0, 0, 0, 1], rootP = [0, 0, 0], scale = 1 } = {}) {
  const byName = new Map(bones.map((b) => [b.name, b]));
  const order = [], seen = new Set();
  const visit = (n) => {
    if (seen.has(n) || !byName.has(n)) return;
    const b = byName.get(n);
    if (b.parent && byName.has(b.parent)) visit(b.parent);
    seen.add(n); order.push(n);
  };
  for (const b of bones) visit(b.name);
  const out = {};
  for (const n of order) {
    const b = byName.get(n);
    const par = b.parent && out[b.parent] ? out[b.parent] : null;
    const pq = par ? par.bindQ : rootQ, pp = par ? par.bindP : rootP;
    const restT = vscale(b.t, scale);
    const bindP = add(pp, applyQuat(restT, pq));
    const bindQ = quatNormalize(quatMul(pq, b.q));
    out[n] = { name: n, parent: par ? b.parent : null, restT, restQ: [b.q[0], b.q[1], b.q[2], b.q[3]], bindP, bindQ };
  }
  const p = { bones: out, order, rootQ, rootP, scale };
  p.lengths = measureLengths(p);
  return p;
}

/** Longueurs de segment (mètres) — ce que l'IK et la vitesse du pied consomment. */
export function measureLengths(p) {
  const d = (a, b) => (p.bones[a] && p.bones[b] ? len(sub(p.bones[b].bindP, p.bones[a].bindP)) : 0);
  return {
    thigh: d('RightUpLeg', 'RightLeg'), shank: d('RightLeg', 'RightFoot'), foot: d('RightFoot', 'RightToeBase'),
    upperArm: d('RightArm', 'RightForeArm'), foreArm: d('RightForeArm', 'RightHand'),
    hipWidth: d('LeftUpLeg', 'RightUpLeg'), hipsY: p.bones.Hips ? p.bones.Hips.bindP[1] : 0,
    groundY: Math.min(p.bones.LeftToeBase?.bindP[1] ?? 0, p.bones.RightToeBase?.bindP[1] ?? 0),
  };
}

/** Le profil depuis un glTF parsé (JSON du GLB) — le banc, sans three. `faces` : '+Z' | '-Z' ;
 *  `unitScale` : la normalisation de taille du squad (1,8 m / hauteur du maillage), mesurée en jeu. */
export function profileFromGltf(json, { faces = '+Z', unitScale = 1 } = {}) {
  const N = json.nodes || [];
  const parentOf = new Map();
  N.forEach((n, i) => (n.children || []).forEach((c) => parentOf.set(c, i)));
  const canonOf = (i) => { const s = suffixOf(N[i]?.name); return CANON.includes(s) ? s : null; };
  const bones = [];
  let hipsIdx = -1;
  N.forEach((n, i) => {
    const c = canonOf(i); if (!c) return;
    if (c === 'Hips') hipsIdx = i;
    let pi = parentOf.get(i), pc = pi == null ? null : canonOf(pi);
    // un os intermédiaire non canonique (rare) : on remonte jusqu'au canonique — sa transform est
    // ignorée (les rigs Mixamo n'en ont pas entre les 22 canoniques)
    while (pi != null && !pc) { pi = parentOf.get(pi); pc = pi == null ? null : canonOf(pi); }
    bones.push({ name: c, parent: pc, t: n.translation || [0, 0, 0], q: n.rotation || [0, 0, 0, 1] });
  });
  // la transform au-dessus de Hips (armature tournée / en cm) + le lacet du wrapper (avant = −Z)
  let rootQ = [0, 0, 0, 1], rootP = [0, 0, 0], rootS = 1;
  const chain = [];
  for (let k = parentOf.get(hipsIdx); k != null; k = parentOf.get(k)) chain.unshift(k);
  for (const k of chain) {
    const n = N[k];
    const s = n.scale ? n.scale[0] : 1;
    rootP = add(rootP, applyQuat(vscale(n.translation || [0, 0, 0], rootS), rootQ));
    rootQ = quatNormalize(quatMul(rootQ, n.rotation || [0, 0, 0, 1]));
    rootS *= s;
  }
  const yaw = faces === '+Z' ? ry(180) : [0, 0, 0, 1];
  rootQ = quatNormalize(quatMul(yaw, rootQ));
  rootP = applyQuat(rootP, yaw);
  // l'échelle : unités du rig → mètres (× la normalisation de taille du squad, MESURÉE sur le
  // maillage par squad.js — les accesseurs quantifiés d'un GLB ne donnent pas la boîte ; la scène
  // transmet donc son échelle réelle, le banc la reçoit en paramètre)
  const scale = rootS * unitScale;
  return makeProfile(bones, { rootQ, rootP: vscale(rootP, scale / rootS), scale });
}

/**
 * Le profil depuis les os du TEMPLATE (navigateur) : `bonesMap` = rigBones(template) (canonique →
 * os three, avec .parent/.position/.quaternion), `rootQ`/`rootP`/`scale` lus par la scène sur le
 * parent de Hips (getWorldQuaternion / getWorldPosition / échelle du wrapper).
 */
export function profileFromBones(bonesMap, { rootQ, rootP = [0, 0, 0], scale = 1 } = {}) {
  const canonOfObj = (o) => { const s = suffixOf(o?.name); return CANON.includes(s) ? s : null; };
  const bones = [];
  for (const [name, o] of bonesMap) {
    if (!CANON.includes(name)) continue;
    let par = o.parent, pc = par ? canonOfObj(par) : null;
    while (par && !pc && par.isBone) { par = par.parent; pc = par ? canonOfObj(par) : null; }
    bones.push({ name, parent: pc, t: [o.position.x, o.position.y, o.position.z], q: [o.quaternion.x, o.quaternion.y, o.quaternion.z, o.quaternion.w] });
  }
  return makeProfile(bones, { rootQ: rootQ || [0, 0, 0, 1], rootP, scale });
}

/** La rotation d'articulation R (repère personnage au bind) → q_spec local absolu de l'os. */
export function jointToSpec(profile, bone, R) {
  const b = profile.bones[bone];
  if (!b) return null;
  return quatNormalize(quatMul(quatConjugate(b.bindQ), quatMul(R, b.bindQ)));
}

/** Toute une pose d'articulations { os: R } → { os: q_spec }. */
export function jointsToSpec(profile, joints) {
  const out = {};
  for (const [bone, R] of Object.entries(joints)) { const q = jointToSpec(profile, bone, R); if (q) out[bone] = q; }
  return out;
}

/**
 * FK : la pose monde (repère personnage) d'un spec { os: q_spec } composé sur le rest — la même
 * sémantique que la couche de geste (rest ⊗ q_spec) et que le banc de swing. Les os absents du
 * spec restent au REST (T-pose). `hips` = delta du bassin [droite, haut, avant] en mètres.
 */
export function fkPose(profile, pose = {}, hips = null) {
  const res = {};
  for (const n of profile.order) {
    const b = profile.bones[n];
    const par = b.parent ? res[b.parent] : null;
    const pq = par ? par.q : profile.rootQ, pp = par ? par.p : profile.rootP;
    const local = pose[n] ? quatMul(b.restQ, pose[n]) : b.restQ;
    const q = quatNormalize(quatMul(pq, local));
    let p = add(pp, applyQuat(b.restT, pq));
    if (!b.parent && hips) p = add(p, [hips[0], hips[1], -hips[2]]);
    res[n] = { p, q };
  }
  return res;
}

/** Quaternion → Euler XYZ (degrés), la convention des specs animkit (three.js 'XYZ'). Inverse exact
 *  de animkit.eulerToQuat (prouvé par aller-retour dans le banc). */
export function quatToEulerXYZ(q) {
  const [x, y, z, w] = q;
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2;
  const m11 = 1 - (yy + zz), m12 = xy - wz, m13 = xz + wy;
  const m22 = 1 - (xx + zz), m23 = yz - wx;
  const m32 = yz + wx, m33 = 1 - (xx + yy);
  const ey = Math.asin(clamp(m13, -1, 1));
  let ex, ez;
  if (Math.abs(m13) < 0.9999999) { ex = Math.atan2(-m23, m33); ez = Math.atan2(-m12, m11); }
  else { ex = Math.atan2(m32, m22); ez = 0; }
  return [ex * R2D, ey * R2D, ez * R2D];
}

/**
 * SONDE DES SIGNES — le contrat du profil : chaque articulation anatomique, appliquée par
 * conjugaison, déplace l'extrémité dans la direction que l'anatomie promet. C'est la clause qui
 * remplace « on a cru que X abaissait le bras » par une mesure, sur n'importe quel rig.
 */
export function checkProfile(profile) {
  const issues = [];
  const P = profile;
  for (const b of CANON) if (!P.bones[b]) issues.push(`os canonique absent du profil : ${b}`);
  if (issues.length) return { ok: false, issues };
  const L = P.lengths;
  if (!(L.thigh > 0.3 && L.thigh < 0.6)) issues.push(`cuisse ${L.thigh.toFixed(2)} m hors [0,3 ; 0,6] — échelle ou unités fausses`);
  if (!(L.shank > 0.3 && L.shank < 0.6)) issues.push(`tibia ${L.shank.toFixed(2)} m hors [0,3 ; 0,6]`);
  if (!(L.hipsY > 0.8 && L.hipsY < 1.15)) issues.push(`bassin à ${L.hipsY.toFixed(2)} m — un homme debout l'a entre 0,8 et 1,15`);
  const rest = fkPose(P);
  const move = (bone, R, end) => sub(fkPose(P, { [bone]: jointToSpec(P, bone, R) })[end].p, rest[end].p);
  const expect = (label, d, axis, sign, min = 0.05) => { const v = d[axis] * sign; if (!(v > min)) issues.push(`${label} : déplacement ${['x', 'y', 'z'][axis]} = ${(d[axis]).toFixed(2)} m, attendu ${sign > 0 ? '+' : '−'}`); };
  expect('flexion de hanche droite (rx +40) → pied vers l\'AVANT', move('RightUpLeg', rx(40), 'RightFoot'), 2, -1);
  expect('extension de hanche droite (rx −30) → pied vers l\'ARRIÈRE', move('RightUpLeg', rx(-30), 'RightFoot'), 2, +1);
  expect('abduction de hanche droite (rz +30) → pied vers la DROITE', move('RightUpLeg', rz(30), 'RightFoot'), 0, +1);
  expect('abduction de hanche gauche (rz −30) → pied vers la GAUCHE', move('LeftUpLeg', rz(-30), 'LeftFoot'), 0, -1);
  expect('flexion de genou droit (rx −60) → pied vers l\'ARRIÈRE', move('RightLeg', rx(-60), 'RightFoot'), 2, +1);
  expect('flexion de genou droit (rx −60) → pied vers le HAUT', move('RightLeg', rx(-60), 'RightFoot'), 1, +1);
  expect('rotation externe de hanche droite (ry −40) → orteils vers la DROITE', sub(move('RightUpLeg', ry(-40), 'RightToeBase'), move('RightUpLeg', ry(-40), 'RightFoot')), 0, +1);
  expect('flexion plantaire droite (rx −40) → orteils vers le BAS', sub(move('RightFoot', rx(-40), 'RightToeBase'), move('RightFoot', rx(-40), 'RightFoot')), 1, -1);
  expect('abaisser le bras droit (rz −70) → main vers le BAS', move('RightArm', rz(-70), 'RightHand'), 1, -1);
  expect('abaisser le bras gauche (rz +70) → main vers le BAS', move('LeftArm', rz(70), 'LeftHand'), 1, -1);
  expect('bras droit baissé puis fléchi (rx +60) → main vers l\'AVANT', move('RightArm', chain(rz(-80), rx(60)), 'RightHand'), 2, -1);
  expect('coude droit (ry +70, T-pose) → main vers l\'AVANT', move('RightForeArm', ry(70), 'RightHand'), 2, -1);
  expect('coude gauche (ry −70, T-pose) → main vers l\'AVANT', move('LeftForeArm', ry(-70), 'LeftHand'), 2, -1);
  expect('tronc penché en avant (rx −25 sur Spine) → tête vers l\'AVANT', move('Spine', rx(-25), 'Head'), 2, -1);
  expect('lacet du tronc à gauche (ry +40 sur Spine) → épaule droite vers l\'AVANT', move('Spine', ry(40), 'RightArm'), 2, -1);
  expect('cou fléchi (rx −30 sur Neck) → tête vers l\'AVANT', move('Neck', rx(-30), 'Head'), 2, -1, 0.02);
  return { ok: issues.length === 0, issues };
}
