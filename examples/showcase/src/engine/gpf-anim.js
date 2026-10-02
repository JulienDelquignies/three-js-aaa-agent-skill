// gpf-anim — LES ANIMATIONS DE GAMEPLAY FOOTBALL, LUES ET PORTÉES SUR LE RIG DU DUEL.
//
// Gameplay Football (Bastiaan Konings Schuiling, repris par google-research/football et vi3itor/GameplayFootball) anime ses
// joueurs avec ~290 fichiers .anim écrits à la main : 14 nœuds, des clés éparses (4 à 8 par articulation) interpolées en
// slerp à 100 images/s (une image = 10 ms : humanoidbase.cpp avance frameNum d'un pas par tick, la vitesse s'en déduit × 100).
// Le format, lu dans utils/animation.cpp (Animation::Load / LoadData / GetInterpolatedValues) :
//   ligne 0      player,f,x,y,z,…        la position de la racine (mètres) — le seul nœud à position
//   lignes 1-13  nœud,f,qx,qy,qz,qw,…    la rotation LOCALE absolue du nœud (quaternion [x,y,z,w], Hamilton)
//   extension,football,f,x,y,z            le ballon au contact (repère de l'animation) — l'image de touche
//   <balise> valeur </balise>             les métadonnées (type, incomingballdirection, outgoing_special_state…)
// Le squelette (media/objects/players/player.object) : Z en haut, l'AVANT en −Y, la GAUCHE en +X (left_shoulder à x = +0,16).
// Toutes les rotations à l'identité (straight.anim.util) = la pose droite : jambes et bras à la verticale, pieds à plat
// (foot.ase : semelle 11 cm sous la cheville, orteils vers −Y). Le monde d'un nœud = monde(parent) ⊗ local (Spatial::
// GetDerivedRotation) — la même composition que les articulations du moteur (motion-rig : W = R_parent ⊗ R ⊗ bindQ).
//
// LE PORT : le repère GPF passe au repère personnage par une rotation PROPRE (det +1) — droite +X = −x_gpf, haut +Y = z_gpf,
// avant −Z = −y_gpf ⇒ un quaternion GPF (x, y, z, w) devient (−x, z, y, w). Chaque segment du rig reçoit la rotation monde du
// segment GPF composée sur l'écart des poses de repos (C : la rotation minimale qui couche le bras en T du rig sur le bras
// pendant de GPF, aligne cuisse et tibia — le tibia GPF penche de 5° : cheville 4 cm devant le genou) ; les rotations
// d'articulation se déduisent parent → enfant (R = A_parent⁻¹ ⊗ A_os) et passent par emitSpec comme tout geste généré.
// Le tronc GPF (« middle ») se répartit sur Spine/Spine1/Spine2 (puissances du même quaternion : le total est exact), la tête
// (« neck ») sur Neck 0,4 / Head 0,6 ; clavicules, mains et orteils restent au repos (GPF ne les a pas).
// LA RACINE APPARTIENT À LA SIM : le cap (lacet du bassin) et le déplacement horizontal de l'animation sont RETIRÉS — la sim
// du duel porte le corps et le tourne (comme pour ses propres gestes) ; seule la hauteur (z du nœud player) reste, à l'échelle
// des jambes du rig. Pied DROIT : une animation du pied gauche se reflète (plan sagittal) avant le port.

import { quatMul, quatConjugate, quatNormalize, applyQuat, quatFromTo, sub, norm } from './vecmath.js';
import { fkPose, jointToSpec, CANON } from './motion-rig.js';
import { emitSpec } from './motion-strike.js';

/** Les nœuds GPF à rotation, dans l'ordre du fichier, et leur parent (player.object). */
export const GPF_NODES = ['body', 'middle', 'neck', 'left_shoulder', 'left_elbow', 'right_shoulder', 'right_elbow', 'left_thigh', 'left_knee', 'left_ankle', 'right_thigh', 'right_knee', 'right_ankle'];
export const GPF_PARENT = { body: null, middle: 'body', neck: 'middle', left_shoulder: 'middle', left_elbow: 'left_shoulder', right_shoulder: 'middle', right_elbow: 'right_shoulder', left_thigh: 'body', left_knee: 'left_thigh', left_ankle: 'left_knee', right_thigh: 'body', right_knee: 'right_thigh', right_ankle: 'right_knee' };
/** Les décalages des nœuds dans leur parent (mètres, repère GPF) — player.object ; body est à 0,96 m au-dessus de la racine. */
export const GPF_OFFSET = { body: [0, 0, 0.96], middle: [0, 0, 0.15], neck: [0, -0.03, 0.5], left_shoulder: [0.16, -0.01, 0.48], left_elbow: [-0.01, 0, -0.33], right_shoulder: [-0.16, -0.01, 0.48], right_elbow: [0.01, 0, -0.33], left_thigh: [0.087, 0, -0.01], left_knee: [0, 0, -0.42], left_ankle: [0, -0.04, -0.44], right_thigh: [-0.087, 0, -0.01], right_knee: [0, 0, -0.42], right_ankle: [0, -0.04, -0.44] };
export const GPF_FPS = 100;
/** Le bassin GPF au-dessus de la SEMELLE debout (m) — la hauteur de référence de l'échelle des jambes. Le nœud body est à 0,96 m
 *  au-dessus de la racine, mais la pose droite pose la semelle 2,4 cm SOUS la racine (cheville à 0,09 m, semelle 0,114 sous elle —
 *  pied-gpf.mjs : les sommets de foot.ase par la FK GPF) : le sol des animations est là. (0,96 enfonçait le corps couché de 2 cm.) */
export const GPF_HIPS_Y = 0.984;

/** Lire un fichier .anim (texte) : { player: [{ f, p }], tracks: { nœud: [{ f, q }] }, frames, touch: { f, ball } | null, meta }. */
export function parseGpfAnim(text) {
  const lines = String(text).split(/\r?\n/).filter((l) => l.trim().length);
  const tracks = {}; let player = []; let touch = null; let frames = 0; const meta = {};
  let i = 0;
  for (; i < lines.length; i++) {
    const tok = lines[i].split(',').map((s) => s.trim());
    if (tok[0] === 'extension' || tok[0].startsWith('<')) break;
    if (tok[0] === 'player') {
      for (let k = 1; k + 3 < tok.length; k += 4) player.push({ f: Math.round(+tok[k]), p: [+tok[k + 1], +tok[k + 2], +tok[k + 3]] });
    } else {
      const keys = [];
      for (let k = 1; k + 4 < tok.length; k += 5) keys.push({ f: Math.round(+tok[k]), q: quatNormalize([+tok[k + 1], +tok[k + 2], +tok[k + 3], +tok[k + 4]]) });
      tracks[tok[0]] = keys;
    }
  }
  for (; i < lines.length; i++) {
    const tok = lines[i].split(',').map((s) => s.trim());
    if (tok[0] !== 'extension') break;
    if (tok[1] === 'football' && !touch) touch = { f: Math.round(+tok[2]), ball: [+tok[3], +tok[4], +tok[5]] };
  }
  const xml = lines.slice(i).join(' ');
  for (const m of xml.matchAll(/<(\w+)>\s*([^<]*?)\s*<\/\1>/g)) meta[m[1]] = m[2];
  player.sort((a, b) => a.f - b.f);
  for (const n of Object.keys(tracks)) tracks[n].sort((a, b) => a.f - b.f);
  for (const t of [player, ...Object.values(tracks)]) for (const k of t) frames = Math.max(frames, k.f + 1);   // Animation::SetKeyFrame : frameCount = dernière clé + 1
  return { player, tracks, frames, touch, meta };
}

const slerp = (a, b, t) => {
  let [bx, by, bz, bw] = b; let d = a[0] * bx + a[1] * by + a[2] * bz + a[3] * bw;
  if (d < 0) { bx = -bx; by = -by; bz = -bz; bw = -bw; d = -d; }   // le plus court chemin (MakeSameNeighborhood)
  if (d > 0.9995) return quatNormalize([a[0] + (bx - a[0]) * t, a[1] + (by - a[1]) * t, a[2] + (bz - a[2]) * t, a[3] + (bw - a[3]) * t]);
  const th = Math.acos(d), s = Math.sin(th), wa = Math.sin((1 - t) * th) / s, wb = Math.sin(t * th) / s;
  return [a[0] * wa + bx * wb, a[1] * wa + by * wb, a[2] * wa + bz * wb, a[3] * wa + bw * wb];
};
/** La valeur d'une piste à l'image (fractionnaire) f — GetInterpolatedValues : avant la 1re clé, la 1re ; entre deux clés, slerp
 *  (position : linéaire) ; après la dernière, la dernière (le moteur extrapole, le port n'en a pas besoin). */
function sampleTrack(keys, f, field, lerpFn) {
  if (!keys?.length) return null;
  if (f <= keys[0].f) return keys[0][field];
  for (let k = 1; k < keys.length; k++) if (f <= keys[k].f) { const a = keys[k - 1], b = keys[k]; return lerpFn(a[field], b[field], (f - a.f) / (b.f - a.f)); }
  return keys.at(-1)[field];
}
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** La pose GPF à l'image f : { q: { nœud: quat local }, p: racine }. */
export function sampleGpf(A, f) {
  const q = {};
  for (const n of GPF_NODES) q[n] = sampleTrack(A.tracks[n], f, 'q', slerp) ?? [0, 0, 0, 1];
  return { q, p: sampleTrack(A.player, f, 'p', lerp3) ?? [0, 0, 0] };
}

/** Le miroir d'une animation par le plan sagittal (x → −x) : gauche ↔ droite, quaternion (x, −y, −z, w), position (−x, y, z). */
export function mirrorGpf(A) {
  const sw = (n) => (n.startsWith('left_') ? `right_${n.slice(5)}` : n.startsWith('right_') ? `left_${n.slice(6)}` : n);
  const tracks = {};
  for (const [n, keys] of Object.entries(A.tracks)) tracks[sw(n)] = keys.map((k) => ({ f: k.f, q: [k.q[0], -k.q[1], -k.q[2], k.q[3]] }));
  return { ...A, tracks, player: A.player.map((k) => ({ f: k.f, p: [-k.p[0], k.p[1], k.p[2]] })), touch: A.touch && { f: A.touch.f, ball: [-A.touch.ball[0], A.touch.ball[1], A.touch.ball[2]] }, mirrored: !A.mirrored };
}

/** Enchaîner deux animations (le relevé après la glissade) : la seconde commence à la dernière image de la première, et ses
 *  `blend` premières images partent de la pose finale de la première (le fondu d'entrée de GPF — beginBias sur 8 images). */
export function concatGpf(A, B, { blend = 8 } = {}) {
  const off = A.frames - 1, last = sampleGpf(A, off);
  const tracks = {};
  for (const n of GPF_NODES) {
    const kb = (B.tracks[n] ?? [{ f: 0, q: [0, 0, 0, 1] }]);
    const keysB = [];
    for (let f = 0; f <= Math.min(blend, B.frames - 1); f++) { const w = f / blend; keysB.push({ f: off + f, q: slerp(last.q[n], sampleTrack(kb, f, 'q', slerp), w) }); }
    for (const k of kb) if (k.f > blend) keysB.push({ f: off + k.f, q: k.q });
    tracks[n] = [...(A.tracks[n] ?? []).filter((k) => k.f < off), ...keysB];
  }
  // la racine : B repart de la position finale de A (son propre déplacement s'ajoute)
  const pB0 = sampleTrack(B.player, 0, 'p', lerp3) ?? [0, 0, 0];
  const player = [...A.player.filter((k) => k.f < off), { f: off, p: last.p }, ...B.player.filter((k) => k.f > 0).map((k) => ({ f: off + k.f, p: [last.p[0] + k.p[0] - pB0[0], last.p[1] + k.p[1] - pB0[1], last.p[2] + k.p[2] - pB0[2]] }))];
  return { ...A, tracks, player, frames: off + B.frames, joinFrame: off, metaB: B.meta };
}

/** FK GPF (repère GPF, racine comprise) : { nœud: { p, q } } monde. */
export function fkGpf(S) {
  const W = {};
  for (const n of GPF_NODES) {
    const par = GPF_PARENT[n];
    const pq = par ? W[par].q : [0, 0, 0, 1], pp = par ? W[par].p : S.p;
    W[n] = { q: quatNormalize(quatMul(pq, S.q[n])), p: [pp[0] + applyQuat(GPF_OFFSET[n], pq)[0], pp[1] + applyQuat(GPF_OFFSET[n], pq)[1], pp[2] + applyQuat(GPF_OFFSET[n], pq)[2]] };
  }
  return W;
}

/** Repère GPF → repère personnage : vecteur (x, y, z) → (−x, z, y) ; quaternion (x, y, z, w) → (−x, z, y, w). */
export const gpfVec = (v) => [-v[0], v[2], v[1]];
export const gpfQuat = (q) => [-q[0], q[2], q[1], q[3]];
const qinv = quatConjugate;
const qpow = (q, a) => {   // q^a (q unitaire) : même axe, angle × a
  let [x, y, z, w] = q; if (w < 0) { x = -x; y = -y; z = -z; w = -w; }
  const s = Math.hypot(x, y, z); if (s < 1e-9) return [0, 0, 0, 1];
  const th = 2 * Math.atan2(s, w) * a, k = Math.sin(th / 2) / s;
  return [x * k, y * k, z * k, Math.cos(th / 2)];
};
/** Le cap d'une orientation (rotation autour de +Y) : lu sur l'axe DROIT du bassin (horizontal même couché sur le dos), sur
 *  l'avant si le bassin roule au-delà de 60°. ry(ψ)·(1,0,0) = (cos ψ, 0, −sin ψ). */
function headingOf(q) {
  const r = applyQuat([1, 0, 0], q);
  if (Math.hypot(r[0], r[2]) > 0.5) return Math.atan2(-r[2], r[0]);
  const f = applyQuat([0, 0, -1], q); return Math.atan2(-f[0], -f[2]) ;   // ry(ψ)·(0,0,−1) = (−sin ψ, 0, −cos ψ)
}
const ry = (a) => [0, Math.sin(a / 2), 0, Math.cos(a / 2)];

/** Les segments du rig alignés sur GPF : os → [os enfant (direction du rig), nœud GPF, direction GPF au repos (repère GPF)]. */
const SEG = {
  LeftArm: ['LeftForeArm', 'left_shoulder', [0, 0, -1]], LeftForeArm: ['LeftHand', 'left_elbow', [0, 0, -1]],
  RightArm: ['RightForeArm', 'right_shoulder', [0, 0, -1]], RightForeArm: ['RightHand', 'right_elbow', [0, 0, -1]],
  LeftUpLeg: ['LeftLeg', 'left_thigh', GPF_OFFSET.left_knee], LeftLeg: ['LeftFoot', 'left_knee', GPF_OFFSET.left_ankle],
  RightUpLeg: ['RightLeg', 'right_thigh', GPF_OFFSET.right_knee], RightLeg: ['RightFoot', 'right_knee', GPF_OFFSET.right_ankle],
};

/** Les écarts de repos C (repère personnage) : C · direction du rig = direction GPF ; le pied garde son bind (à plat ↔ à plat). */
export function restOffsets(P) {
  const C = {};
  for (const [bone, [child, , dG]] of Object.entries(SEG)) {
    const d = norm(sub(P.bones[child].bindP, P.bones[bone].bindP));
    C[bone] = quatFromTo(d, norm(gpfVec(dG)));
  }
  return C;
}

/**
 * Les articulations du rig (repère personnage) à l'image f : { J, hips, W } — J au format des générateurs (rotations
 * d'articulation), hips = [droite, haut, avant] (m), W = la FK GPF (repère GPF) pour les mesures.
 */
export function gpfJoints(A, f, P, C = restOffsets(P), { keepHeading = false } = {}) {
  const S = sampleGpf(A, f), W = fkGpf(S);
  const G = {}; for (const n of GPF_NODES) G[n] = gpfQuat(W[n].q);
  const H = keepHeading ? [0, 0, 0, 1] : ry(headingOf(G.body)), Hi = qinv(H);
  for (const n of GPF_NODES) G[n] = quatNormalize(quatMul(Hi, G[n]));
  const A_ = {}, J = {};
  A_.Hips = G.body; J.Hips = G.body;
  const mid = quatMul(qinv(G.body), G.middle), sp = [['Spine', 0.34], ['Spine1', 0.33], ['Spine2', 0.33]];
  let acc = G.body; for (const [b, w] of sp) { J[b] = qpow(mid, w); acc = quatMul(acc, J[b]); A_[b] = acc; }
  const nk = quatMul(qinv(G.middle), G.neck); J.Neck = qpow(nk, 0.4); J.Head = qpow(nk, 0.6);
  for (const s of ['Left', 'Right']) {
    const g = s.toLowerCase();
    J[`${s}Shoulder`] = [0, 0, 0, 1]; A_[`${s}Shoulder`] = A_.Spine2;
    A_[`${s}Arm`] = quatMul(G[`${g}_shoulder`], C[`${s}Arm`]); J[`${s}Arm`] = quatMul(qinv(A_[`${s}Shoulder`]), A_[`${s}Arm`]);
    A_[`${s}ForeArm`] = quatMul(G[`${g}_elbow`], C[`${s}ForeArm`]); J[`${s}ForeArm`] = quatMul(qinv(A_[`${s}Arm`]), A_[`${s}ForeArm`]);
    J[`${s}Hand`] = [0, 0, 0, 1];
    A_[`${s}UpLeg`] = quatMul(G[`${g}_thigh`], C[`${s}UpLeg`]); J[`${s}UpLeg`] = quatMul(qinv(A_.Hips), A_[`${s}UpLeg`]);
    A_[`${s}Leg`] = quatMul(G[`${g}_knee`], C[`${s}Leg`]); J[`${s}Leg`] = quatMul(qinv(A_[`${s}UpLeg`]), A_[`${s}Leg`]);
    A_[`${s}Foot`] = G[`${g}_ankle`]; J[`${s}Foot`] = quatMul(qinv(A_[`${s}Leg`]), A_[`${s}Foot`]);
    J[`${s}ToeBase`] = [0, 0, 0, 1];
  }
  for (const b of Object.keys(J)) J[b] = quatNormalize(J[b]);
  // la hauteur : z de la racine GPF (le corps qui descend), à l'échelle des jambes du rig
  const k = (P.lengths.hipsY - P.lengths.groundY) / GPF_HIPS_Y;
  return { J, hips: [0, S.p[2] * k, 0], W };
}

/** Le ballon GPF de l'image de touche dans le repère personnage du RIG, avec le cap retiré et l'échelle des jambes du port
 *  (le bassin du rig à sa hauteur portée) — la mesure de fidélité : la cheville du rig doit en être à la distance de la cheville GPF. */
export function gpfBallInRig(A, P) {
  const tf = touchFoot(A); if (!tf) return null;
  const B = tf.foot === 'left' ? mirrorGpf(A) : A, S = sampleGpf(B, B.touch.f), W = fkGpf(S);
  const G = gpfQuat(W.body.q), Hi = qinv(ry(headingOf(G)));
  const k = (P.lengths.hipsY - P.lengths.groundY) / GPF_HIPS_Y, b = B.touch.ball;
  const d = applyQuat(gpfVec([b[0] - W.body.p[0], b[1] - W.body.p[1], b[2] - W.body.p[2]]), Hi);
  const h = P.bones.Hips.bindP;
  return [h[0] + d[0] * k, h[1] + S.p[2] * k + d[1] * k, h[2] + d[2] * k];
}

/** Le pied GPF qui joue le ballon à l'image de touche (la cheville la plus proche, comme AddExtraTouches) et la distance (m). */
export function touchFoot(A) {
  if (!A.touch) return null;
  const W = fkGpf(sampleGpf(A, A.touch.f)), b = A.touch.ball;
  const d = (n) => Math.hypot(W[n].p[0] - b[0], W[n].p[1] - b[1], W[n].p[2] - b[2]);
  const L = d('left_ankle'), R = d('right_ankle');
  return { foot: R <= L ? 'right' : 'left', dist: Math.min(L, R), other: Math.max(L, R) };
}

/**
 * LE GESTE : une animation GPF → un spec animkit (le format des gestes générés) sur le profil P.
 * @param A       l'animation (parseGpfAnim ; concatGpf pour la glissade + le relevé)
 * @param name    le nom du geste remplacé (la scène reconnaît « tacle » à son nom)
 * @param extra   champs ajoutés au spec (holdAt : l'instant de la pose couchée)
 */
export function gpfSpec(A, P, { name, family = 'gpf', fps = 60, extra = {} } = {}) {
  const tf = touchFoot(A);
  const B = tf?.foot === 'left' ? mirrorGpf(A) : A;   // pied DROIT : la scène reflète pour le gauche (mirrorGen)
  const C = restOffsets(P);
  const duration = (B.frames - 1) / GPF_FPS, contact = B.touch ? B.touch.f / GPF_FPS : duration / 2;
  const poseAt = (t) => { const { J, hips } = gpfJoints(B, t * GPF_FPS, P, C); return { J, hips }; };
  const keys = emitSpec(P, { duration, contact, fps, poseAt, ik: () => ({}), marks: extra.holdAt != null ? [extra.holdAt] : [] });
  return { name, duration, contact, foot: 'right', generated: true, family, gpf: { mirrored: !!B.mirrored, frames: B.frames, touch: B.touch, meta: B.meta }, ...extra, keys };
}

/**
 * LES TROIS GESTES PORTÉS, choisis sur les situations MESURÉES du duel (scripts/gpf/receptions.mjs, 4 graines × 180 s) :
 *   controleInterieur  ← trap/idle/000_IB000                       l'amorti de l'intérieur, ballon de face (contact 0,20 s comme le généré)
 *   controleOriente    ← trap/idle/135_IB000_accel_left_shallowangle  l'intérieur droit reçoit, le corps tourne À GAUCHE et repart
 *                                                                    (2,3 m/s en sortie = le receveur médian du duel ; le virage médian y est de 105°)
 *   tacle              ← sliding/walk/000 + movement_special/idle/special/000_stand_up_from_back
 *                                                                    lancé à 5,2 m/s (le tacleur du duel : 5,7), couché sur le dos, relevé
 * La famille et le nom restent ceux du geste remplacé : la scène les joue, les fond et les reflète comme les siens.
 */
import { GPF_ANIMS } from './gpf-data.js';
const parsed = {}; const anim = (k) => (parsed[k] ??= parseGpfAnim(GPF_ANIMS[k]));
export const GPF_GESTES = {
  controleInterieur: (P, o) => gpfSpec(anim('trapFace'), P, { name: 'controleInterieur', family: 'control', fps: o?.fps }),
  controleOriente: (P, o) => gpfSpec(anim('trapVirageGauche'), P, { name: 'controleOriente', family: 'control', fps: o?.fps }),
  // la pose couchée au bout de la glissade : la scène y GÈLE le clip tant que la sim garde le corps au sol (holdAt)
  tacle: (P, o) => { const A = concatGpf(anim('glisse'), anim('releveDos')); return gpfSpec(A, P, { name: 'tacle', family: 'ground', fps: o?.fps, extra: { holdAt: A.joinFrame / GPF_FPS } }); },
};

/** Remplacer, dans le registre des générateurs (motion-cast.GENERATORS), les gestes nommés par leur port GPF.
 *  `liste` : '1' | 'all' (les trois) ou des noms séparés par des virgules. Le contrat (check) du geste remplacé reste : il juge le port. */
export function installGpf(GENERATORS, liste = 'all') {
  const noms = liste === '1' || liste === 'all' || liste === true ? Object.keys(GPF_GESTES) : String(liste).split(',').map((s) => s.trim()).filter((n) => GPF_GESTES[n]);
  for (const n of noms) if (GENERATORS[n]) GENERATORS[n] = { ...GENERATORS[n], generate: GPF_GESTES[n], gpf: true };
  return noms;
}

export { CANON, fkPose, jointToSpec };
