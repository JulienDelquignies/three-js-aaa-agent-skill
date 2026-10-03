// vers-gpf.mjs — NOS GESTES VERS LE CORPS : un geste généré par notre moteur (sur notre squelette de 22 os) devient une
// animation de Gameplay Football (.anim : la racine et 13 articulations à 100 images/s, la touche, les étiquettes).
//
// C'est l'INVERSE EXACT du port du lot L0 (gpf-anim.js, `jointsFromSample` : une pose du corps → nos articulations), dont
// les constantes et la FK sont reprises ici telles quelles (branche feat/l2-regardable, examples/showcase/src/engine/
// gpf-anim.js) :
//   · le repère du corps (Z en haut, l'avant en −Y, la gauche en +X) et le nôtre (Y en haut, l'avant en −Z, la droite en +X)
//     se passent l'un à l'autre par (x, y, z) → (−x, z, y) — une involution : la même fonction dans les deux sens ;
//   · chaque segment de bras et de jambe du corps reçoit l'orientation du nôtre, corrigée de l'écart des poses de repos (C) ;
//     le bassin, le tronc (middle = Spine2) et la tête (neck = Head) reçoivent l'orientation cumulée de nos os ;
//   · la racine (le nœud player) reçoit le déplacement de notre bassin, à l'échelle des jambes du corps.
// La PREUVE : `aller-retour` passe des animations du corps par notre squelette et revient — l'écart doit être nul.
//
//   node outils/vers-gpf.mjs aller-retour [fichiers .anim du corps…]
//   node outils/vers-gpf.mjs geste <nom> <numéro> [sortie.anim]   (STARTER=<dossier des modules du moteur>, le duel par défaut)
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const STARTER = process.env.STARTER ?? '/home/delkit/DelkIT/skill-1v1/skills/threejs-aaa/assets/starter/src/engine';
const ANIMS = new URL('../upstream/data/media/animations/', import.meta.url).pathname;
const V = await import(join(STARTER, 'vecmath.js'));
const R = await import(join(STARTER, 'motion-rig.js'));
const { quatMul, quatConjugate: qinv, quatNormalize, applyQuat, quatFromTo, sub, norm } = V;

// ── LE CORPS (repris de gpf-anim.js) ────────────────────────────────────────────────────────────────────────────────────
export const GPF_NODES = ['body', 'middle', 'neck', 'left_shoulder', 'left_elbow', 'right_shoulder', 'right_elbow', 'left_thigh', 'left_knee', 'left_ankle', 'right_thigh', 'right_knee', 'right_ankle'];
const GPF_PARENT = { body: null, middle: 'body', neck: 'middle', left_shoulder: 'middle', left_elbow: 'left_shoulder', right_shoulder: 'middle', right_elbow: 'right_shoulder', left_thigh: 'body', left_knee: 'left_thigh', left_ankle: 'left_knee', right_thigh: 'body', right_knee: 'right_thigh', right_ankle: 'right_knee' };
const GPF_OFFSET = { body: [0, 0, 0.96], middle: [0, 0, 0.15], neck: [0, -0.03, 0.5], left_shoulder: [0.16, -0.01, 0.48], left_elbow: [-0.01, 0, -0.33], right_shoulder: [-0.16, -0.01, 0.48], right_elbow: [0.01, 0, -0.33], left_thigh: [0.087, 0, -0.01], left_knee: [0, 0, -0.42], left_ankle: [0, -0.04, -0.44], right_thigh: [-0.087, 0, -0.01], right_knee: [0, 0, -0.42], right_ankle: [0, -0.04, -0.44] };
const GPF_FPS = 100, GPF_HIPS_Y = 0.984, BALL_R = 0.11;
const gpfVec = (v) => [-v[0], v[2], v[1]];
const gpfQuat = (q) => [-q[0], q[2], q[1], q[3]];
const SEG = {
  LeftArm: ['LeftForeArm', 'left_shoulder', [0, 0, -1]], LeftForeArm: ['LeftHand', 'left_elbow', [0, 0, -1]],
  RightArm: ['RightForeArm', 'right_shoulder', [0, 0, -1]], RightForeArm: ['RightHand', 'right_elbow', [0, 0, -1]],
  LeftUpLeg: ['LeftLeg', 'left_thigh', GPF_OFFSET.left_knee], LeftLeg: ['LeftFoot', 'left_knee', GPF_OFFSET.left_ankle],
  RightUpLeg: ['RightLeg', 'right_thigh', GPF_OFFSET.right_knee], RightLeg: ['RightFoot', 'right_knee', GPF_OFFSET.right_ankle],
};
function restOffsets(P) {
  const C = {};
  for (const [bone, [child, , dG]] of Object.entries(SEG)) C[bone] = quatFromTo(norm(sub(P.bones[child].bindP, P.bones[bone].bindP)), norm(gpfVec(dG)));
  return C;
}
const slerp = (a, b, t) => {
  let [bx, by, bz, bw] = b; let d = a[0] * bx + a[1] * by + a[2] * bz + a[3] * bw;
  if (d < 0) { bx = -bx; by = -by; bz = -bz; bw = -bw; d = -d; }
  if (d > 0.9995) return quatNormalize([a[0] + (bx - a[0]) * t, a[1] + (by - a[1]) * t, a[2] + (bz - a[2]) * t, a[3] + (bw - a[3]) * t]);
  const th = Math.acos(d), s = Math.sin(th), wa = Math.sin((1 - t) * th) / s, wb = Math.sin(t * th) / s;
  return [a[0] * wa + bx * wb, a[1] * wa + by * wb, a[2] * wa + bz * wb, a[3] * wa + bw * wb];
};
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
function sampleTrack(keys, f, field, lerpFn) {
  if (!keys?.length) return null;
  if (f <= keys[0].f) return keys[0][field];
  for (let k = 1; k < keys.length; k++) if (f <= keys[k].f) { const a = keys[k - 1], b = keys[k]; return lerpFn(a[field], b[field], (f - a.f) / (b.f - a.f)); }
  return keys.at(-1)[field];
}
export function parseGpfAnim(text) {
  const lines = String(text).split(/\r?\n/).filter((l) => l.trim().length);
  const tracks = {}; const player = []; let touch = null; let frames = 0; let i = 0;
  for (; i < lines.length; i++) {
    const tok = lines[i].split(',').map((s) => s.trim());
    if (tok[0] === 'extension' || tok[0].startsWith('<')) break;
    if (tok[0] === 'player') { for (let k = 1; k + 3 < tok.length; k += 4) player.push({ f: Math.round(+tok[k]), p: [+tok[k + 1], +tok[k + 2], +tok[k + 3]] }); }
    else { const keys = []; for (let k = 1; k + 4 < tok.length; k += 5) keys.push({ f: Math.round(+tok[k]), q: quatNormalize([+tok[k + 1], +tok[k + 2], +tok[k + 3], +tok[k + 4]]) }); tracks[tok[0]] = keys; }
  }
  for (; i < lines.length; i++) { const tok = lines[i].split(',').map((s) => s.trim()); if (tok[0] !== 'extension') break; if (tok[1] === 'football' && !touch) touch = { f: Math.round(+tok[2]), ball: [+tok[3], +tok[4], +tok[5]] }; }
  for (const t of [player, ...Object.values(tracks)]) for (const k of t) frames = Math.max(frames, k.f + 1);
  return { player, tracks, frames, touch };
}
export function sampleGpf(A, f) {
  const q = {}; for (const n of GPF_NODES) q[n] = sampleTrack(A.tracks[n], f, 'q', slerp) ?? [0, 0, 0, 1];
  return { q, p: sampleTrack(A.player, f, 'p', lerp3) ?? [0, 0, 0] };
}
/** La FK du corps (son repère, racine comprise) : { nœud: { p, q } } monde. */
export function fkGpf(S) {
  const W = {};
  for (const n of GPF_NODES) {
    const par = GPF_PARENT[n], pq = par ? W[par].q : [0, 0, 0, 1], pp = par ? W[par].p : S.p, o = applyQuat(GPF_OFFSET[n], pq);
    W[n] = { q: quatNormalize(quatMul(pq, S.q[n])), p: [pp[0] + o[0], pp[1] + o[1], pp[2] + o[2]] };
  }
  return W;
}
const qpow = (q, a) => { let [x, y, z, w] = q; if (w < 0) { x = -x; y = -y; z = -z; w = -w; } const s = Math.hypot(x, y, z); if (s < 1e-9) return [0, 0, 0, 1]; const th = 2 * Math.atan2(s, w) * a, k = Math.sin(th / 2) / s; return [x * k, y * k, z * k, Math.cos(th / 2)]; };

/** L'ALLER (gpf-anim.js, jointsFromSample, le cap gardé) : une pose du corps → nos rotations d'articulation J et le bassin. */
export function versNous(S, P, C) {
  const W = fkGpf(S); const G = {}; for (const n of GPF_NODES) G[n] = gpfQuat(W[n].q);
  const A = {}, J = {};
  A.Hips = G.body; J.Hips = G.body;
  const mid = quatMul(qinv(G.body), G.middle); let acc = G.body;
  for (const [b, w] of [['Spine', 0.34], ['Spine1', 0.33], ['Spine2', 0.33]]) { J[b] = qpow(mid, w); acc = quatMul(acc, J[b]); A[b] = acc; }
  const nk = quatMul(qinv(G.middle), G.neck); J.Neck = qpow(nk, 0.4); J.Head = qpow(nk, 0.6);
  for (const s of ['Left', 'Right']) {
    const g = s.toLowerCase();
    J[`${s}Shoulder`] = [0, 0, 0, 1]; A[`${s}Shoulder`] = A.Spine2;
    A[`${s}Arm`] = quatMul(G[`${g}_shoulder`], C[`${s}Arm`]); J[`${s}Arm`] = quatMul(qinv(A[`${s}Shoulder`]), A[`${s}Arm`]);
    A[`${s}ForeArm`] = quatMul(G[`${g}_elbow`], C[`${s}ForeArm`]); J[`${s}ForeArm`] = quatMul(qinv(A[`${s}Arm`]), A[`${s}ForeArm`]);
    J[`${s}Hand`] = [0, 0, 0, 1];
    A[`${s}UpLeg`] = quatMul(G[`${g}_thigh`], C[`${s}UpLeg`]); J[`${s}UpLeg`] = quatMul(qinv(A.Hips), A[`${s}UpLeg`]);
    A[`${s}Leg`] = quatMul(G[`${g}_knee`], C[`${s}Leg`]); J[`${s}Leg`] = quatMul(qinv(A[`${s}UpLeg`]), A[`${s}Leg`]);
    A[`${s}Foot`] = G[`${g}_ankle`]; J[`${s}Foot`] = quatMul(qinv(A[`${s}Leg`]), A[`${s}Foot`]);
    J[`${s}ToeBase`] = [0, 0, 0, 1];
  }
  for (const b of Object.keys(J)) J[b] = quatNormalize(J[b]);
  const k = (P.lengths.hipsY - P.lengths.groundY) / GPF_HIPS_Y;
  const v = gpfVec(S.p);   // la racine du corps → notre repère : [droite, haut, arrière]
  return { J, hips: [v[0] * k, v[1] * k, -v[2] * k] };   // hips = [droite, haut, avant] (fkPose ajoute [h0, h1, −h2])
}

/** LE RETOUR : nos rotations d'articulation J (repère personnage) et le bassin [droite, haut, avant] → une pose du corps. */
export function versCorps(J, hips, P, C) {
  const A = {};
  for (const n of P.order) { const par = P.bones[n].parent; const Rb = J[n] ?? [0, 0, 0, 1]; A[n] = quatNormalize(par && A[par] ? quatMul(A[par], Rb) : Rb); }
  const G = { body: A.Hips, middle: A.Spine2, neck: A.Head };
  for (const s of ['Left', 'Right']) {
    const g = s.toLowerCase();
    G[`${g}_shoulder`] = quatMul(A[`${s}Arm`], qinv(C[`${s}Arm`]));
    G[`${g}_elbow`] = quatMul(A[`${s}ForeArm`], qinv(C[`${s}ForeArm`]));
    G[`${g}_thigh`] = quatMul(A[`${s}UpLeg`], qinv(C[`${s}UpLeg`]));
    G[`${g}_knee`] = quatMul(A[`${s}Leg`], qinv(C[`${s}Leg`]));
    G[`${g}_ankle`] = A[`${s}Foot`];
  }
  const Wg = {}; for (const n of GPF_NODES) Wg[n] = quatNormalize(gpfQuat(G[n]));
  const q = {}; for (const n of GPF_NODES) { const par = GPF_PARENT[n]; q[n] = quatNormalize(par ? quatMul(qinv(Wg[par]), Wg[n]) : Wg[n]); }
  const k = (P.lengths.hipsY - P.lengths.groundY) / GPF_HIPS_Y;
  return { q, p: gpfVec([hips[0] / k, hips[1] / k, -hips[2] / k]) };
}

// ── le profil de notre squelette de référence (le banc verify-motion du moteur : shanon.glb) ────────────────────────────
export function profilReference() {
  const raw = readFileSync(join(STARTER, '../../../../../../examples/showcase/public/shanon.glb'));
  const n = new DataView(raw.buffer, raw.byteOffset, raw.byteLength).getUint32(12, true);
  return R.profileFromGltf(JSON.parse(new TextDecoder().decode(raw.subarray(20, 20 + n))), { faces: '+Z' });
}
const angle = (a, b) => { const d = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]); return 2 * Math.acos(Math.min(1, d)) * 180 / Math.PI; };

// ── la preuve : l'aller-retour ─────────────────────────────────────────────────────────────────────────────────────────
function allerRetour(fichiers) {
  const P = profilReference(), C = restOffsets(P);
  for (const f of fichiers) {
    const A = parseGpfAnim(readFileSync(f.startsWith('/') ? f : join(ANIMS, f), 'utf8'));
    let pire = 0, pireNoeud = '', haut = 0;
    for (let fr = 0; fr < A.frames; fr++) {
      const S = sampleGpf(A, fr), { J, hips } = versNous(S, P, C), S2 = versCorps(J, hips, P, C);
      const W1 = fkGpf(S), W2 = fkGpf({ q: S2.q, p: S.p });
      for (const n of GPF_NODES) { const e = angle(W1[n].q, W2[n].q); if (e > pire) { pire = e; pireNoeud = n; } }
      haut = Math.max(haut, Math.abs(S2.p[2] - S.p[2]));
    }
    console.log(`${f} : ${A.frames} images · écart d'orientation maximal ${pire.toFixed(4)}° (${pireNoeud}) · racine ${(haut * 1000).toFixed(2)} mm`);
  }
}

// ── un geste de notre moteur → un fichier .anim du corps ───────────────────────────────────────────────────────────────
/** Les gestes sans touche de balle : les passements (le pied passe au-dessus du ballon immobile) et la feinte d'appel. */
const SANS_TOUCHE = /^passement|^feinteAppel/;
// ── LES GESTES EN SÉRIE : plusieurs touches, le corps qui tourne et se déplace ─────────────────────────────────────────────
// Dans le duel, la sortie du face-à-face (skills-sim.js, la branche face.chemin ; la croqueta, sa propre branche) n'est pas que
// le clip : la sim écrit PENDANT le geste le cap (il tourne de `tour` sur `cap`), le corps (il pivote sur son appui — pivots — puis
// part vers la sortie à `v`), et le ballon (il suit un chemin [t, x : la droite, z : devant], en repère personnage). Rejoués ici à
// 100 Hz pour un départ type — la sortie à `d` du regard (°, + à droite) ; le corps du jeu en tire le miroir —, ils sont cuits dans
// l'animation : le lacet dans le nœud body, le déplacement dans la racine, et dans la ligne football, à leur image, les touches
// puis la destination du ballon (<gfserie> : le corps les joue l'une après l'autre, patch.py étape 14).
const DEG = Math.PI / 180, DEV = 0.28;   // (face.js) le ballon sous la semelle, devant le corps
const clamp01 = (u) => Math.max(0, Math.min(1, u));
/** Les sorties du face-à-face (face.js, sortir) : pied droit (m = 1), leurs paramètres de sim tels quels. */
export const SERIES = {
  rouletteFace: (S) => {
    const m = 1, d = 30 * DEG;
    return { d, tour: -Math.sign(d) * (2 * Math.PI - Math.abs(d)), cap: [S.drag1End - 0.06, S.duration], v: 2.4,
      pivots: [[0, -0.175 * m, 0.07], [S.plantR, 0.215 * m, 0.11]], libre: S.drag2End,
      chemin: [[0, m * S.ball[0], DEV], [S.contact, m * S.ball[0], DEV], [S.drag1End, m * S.drag1[0], -S.drag1[1]], [(S.drag1End + S.on2) / 2, m * (S.drag1[0] + S.ball2[0]) / 2, -S.drag1[1] - 0.04],
        [S.on2, m * S.ball2[0], -S.ball2[1]], [S.drag2End, m * S.drag2[0], -S.drag2[1]], [S.duration, 0, 0.38]],
      touches: [S.contact, S.drag1End, S.on2, S.drag2End], pieds: ['right', 'right', 'left', 'left'] };
  },
  rateauFace: (S) => ({ d: -30 * DEG, tour: -30 * DEG, cap: [S.contact, S.duration], v: 2.2,
    chemin: [[0, S.ball[0], DEV], [S.contact, S.ball[0], DEV], [S.dragEnd, S.dragX, -S.dragTo], [S.duration, 0, 0.4]], touches: [S.contact, S.dragEnd], pieds: ['right', 'right'] }),
  rateauFaceIn: (S) => ({ d: 30 * DEG, tour: 30 * DEG, cap: [S.contact, S.duration], v: 2.2,
    chemin: [[0, S.ball[0], DEV], [S.contact, S.ball[0], DEV], [S.dragEnd, S.dragX, -S.dragTo], [S.duration, 0, 0.4]], touches: [S.contact, S.dragEnd], pieds: ['right', 'right'] }),
  // LA CROQUETA : la sim du duel porte le ballon d'un trait ; ici les deux touches tombent sur les PIEDS du clip — l'intérieur droit
  // arrive au ballon à 0,06 s (la cheville à 15 cm de son centre, à sa droite : le pied le touche, il ne l'a pas encore traversé —
  // à 0,08 s il est dedans) et le balaie vers le pied gauche, qui le pousse devant à 0,18 s (le ballon devant l'intérieur de ses
  // orteils, entre les deux appuis) ; le cap tourne vers la sortie après la 2e touche (face.js : planté, il ne tourne qu'après) ;
  // le corps reste sur ses appuis — le clip les plante, la glissade de la sim les faisait patiner
  doubleContact: (S) => {
    const d = -0.45, T = S.duration, b2 = [-0.22, 0.32];   // (skill.doubleTurn) la sortie à peine diagonale, du côté du transfert
    return { d, tour: d, cap: [S.contact, T], v: 0, fixe: true,
      chemin: [[0, S.ball[0], -S.ball[2]], [0.06, S.ball[0], -S.ball[2]], [S.contact, ...b2], [T, b2[0] + Math.sin(d) * 0.55, b2[1] + Math.cos(d) * 0.55]],
      touches: [0.06, S.contact], pieds: ['right', 'left'] };
  },
};
/** La sim du duel pour un geste en série (skills-sim.js, la branche face.chemin), à pas fixe : à chaque instant le cap ψ (+ à droite),
 *  le corps p [devant, droite] et le ballon [devant, droite], dans le repère du départ (cap initial 0). */
export function rejouer(S, X, dt = 0.01) {
  const T = S.duration, C = X.chemin, out = [], A = {};
  let yaw = 0, p = [0, 0];
  const ey = (t) => { const u = clamp01((t - X.cap[0]) / (X.cap[1] - X.cap[0])), r = 0.2; return u < r ? u * u / (2 * r * (1 - r)) : u > 1 - r ? 1 - (1 - u) * (1 - u) / (2 * r * (1 - r)) : (u - r / 2) / (1 - r); };
  const dir = [Math.cos(X.d), Math.sin(X.d)];
  for (let i = 0; i <= Math.round(T / dt); i++) {
    const t = i * dt;
    let piv = -1; if (X.pivots) for (let j = 0; j < X.pivots.length; j++) if (t >= X.pivots[j][0]) piv = j;
    if (piv >= 0 && t < X.libre) {   // le corps PIVOTE SUR SON APPUI : l'appui (repère personnage) reste à sa place au monde
      const [, lx, lz] = X.pivots[piv];
      if (A.piv !== piv) { const f0 = Math.cos(yaw), g0 = Math.sin(yaw); A.piv = piv; A.anc = [p[0] + f0 * lz - g0 * lx, p[1] + g0 * lz + f0 * lx]; }
      const y1 = X.tour * ey(t), f1 = Math.cos(y1), g1 = Math.sin(y1), np = [A.anc[0] - (f1 * lz - g1 * lx), A.anc[1] - (g1 * lz + f1 * lx)];
      A.vPiv = Math.hypot(np[0] - p[0], np[1] - p[1]) / dt; p = np; yaw = y1;
    } else {
      yaw = X.tour * ey(t);
      const uv = clamp01(t / T);
      const vv = X.fixe ? 0 : X.pivots ? (A.vL ??= Math.min(X.v, A.vPiv ?? 0)) + (X.v - A.vL) * clamp01((t - X.libre) / Math.max(1e-3, T - X.libre)) : X.v * uv * uv * (3 - 2 * uv);
      if (i > 0) p = [p[0] + dir[0] * vv * dt, p[1] + dir[1] * vv * dt];
    }
    let k = 1; while (k < C.length - 1 && C[k][0] < t - 1e-9) k++;
    const a = C[k - 1], b = C[k], u = clamp01((t - a[0]) / Math.max(1e-3, b[0] - a[0])), e = u * u * (3 - 2 * u);
    const x = a[1] + (b[1] - a[1]) * e, z = a[2] + (b[2] - a[2]) * e, f = Math.cos(yaw), g = Math.sin(yaw);
    out.push({ t, yaw, p: [...p], ballon: [p[0] + f * z - g * x, p[1] + g * z + f * x] });
  }
  return out;
}
/** LE RÉPERTOIRE DU FACE-À-FACE (face.js, branche duel) et son numéro dans le corps (specialvar1). */
export const REPERTOIRE = { arretSemelle: 101, semelleRoule: 102, semelleRouleOut: 103, feinteSemelle: 104, feinteSemelleIn: 105, passementFace: 106,
  passementSerie2: 107, passementSerie3: 108, passementSerie4: 109, tireSemelle: 110, tireSemelleIn: 111, rateauFace: 112, rateauFaceIn: 113,
  rouletteFace: 114, doubleContact: 115, rateau: 116, tenueSemelle: 117, tenueSemelleIn: 118 };
/** LA TENUE : la semelle posée sur le ballon, immobile — la pose de départ du roulé (startOn), figée 0,3 s, sans touche (un déplacement :
 *  le corps ne touche pas le ballon, il reste là où le geste précédent l'a rangé). Jouée entre deux gestes du face-à-face, au lieu du
 *  contrôle du corps qui le replaçait à sa distance à lui (0,36-0,40 m devant, centré) : nos gestes l'attendent sous la semelle. */
const TENUES = { tenueSemelle: 'semelleRoule', tenueSemelleIn: 'semelleRouleOut' };
/** OÙ LE GESTE RANGE LE BALLON (un geste planté qui touche) : la semelle le prend au contact et l'arrête au bout de son tirage — au
 *  roulé, au tiré, sous elle à l'arrêt et à la feinte de corps ([droite, devant], l'instant). Le corps le joue en série : la touche,
 *  puis l'arrêt (<gfarret>). */
const rangement = (K) => ({ b: [K.dragX ?? K.ball[0], -(K.dragTo ?? K.ball[2])], t: K.dragEnd ?? K.contact + 0.06 });
async function geste(nom, numero, sortie) {
  const S_ = await import(join(STARTER, 'motion-skill.js'));
  const P = profilReference(), C = restOffsets(P);
  const tenue = TENUES[nom];
  const spec = S_.generateSkill(tenue ?? nom, P, { fps: GPF_FPS });
  if (tenue) { spec.keys = [{ ...spec.keys[0], t: 0 }, { ...spec.keys[0], t: 0.3 }]; spec.duration = 0.3; }
  const K = S_.SKILL_KINDS[tenue ?? nom];
  const eulerToQuat = ([x, y, z]) => { const d = Math.PI / 360, c1 = Math.cos(x * d), s1 = Math.sin(x * d), c2 = Math.cos(y * d), s2 = Math.sin(y * d), c3 = Math.cos(z * d), s3 = Math.sin(z * d); return [s1 * c2 * c3 + c1 * s2 * s3, c1 * s2 * c3 - s1 * c2 * s3, c1 * c2 * s3 + s1 * s2 * c3, c1 * c2 * c3 - s1 * s2 * s3]; };
  // une clé du geste (Euler local du spec) → la rotation d'articulation R = bindQ ⊗ q_spec ⊗ bindQ⁻¹ (motion-rig, jointToSpec)
  // un geste en série : la sim du duel rejouée (le cap, le corps, le ballon) — cuite dans chaque clé
  const X = SERIES[nom]?.(K), sim = X ? rejouer(K, X) : null;
  const instant = (t) => sim.reduce((b, s) => (Math.abs(s.t - t) < Math.abs(b.t - t) ? s : b), sim[0]);
  const poses = spec.keys.map((k) => {
    const J = {};
    for (const [b, e] of Object.entries(k.pose)) { const B = P.bones[b]; if (B) J[b] = quatNormalize(quatMul(B.bindQ, quatMul(eulerToQuat(e), qinv(B.bindQ)))); }
    let hips = k.hips ?? [0, 0, 0];
    if (sim) {
      // le cap ψ (+ à droite) : une rotation autour de notre +Y de −ψ, AVANT le bassin du clip ; le bassin du clip (repère personnage,
      // [droite, haut, devant]) tourné de ψ, puis le corps de la sim ajouté — tout dans le repère du départ
      const s = instant(k.t), c = Math.cos(s.yaw), sn = Math.sin(s.yaw);
      J.Hips = quatNormalize(quatMul([0, Math.sin(-s.yaw / 2), 0, Math.cos(-s.yaw / 2)], J.Hips ?? [0, 0, 0, 1]));
      hips = [s.p[1] + hips[2] * sn + hips[0] * c, hips[1], s.p[0] + hips[2] * c - hips[0] * sn];
    }
    return { f: Math.round(k.t * GPF_FPS), S: versCorps(J, hips, P, C) };
  });
  const fTouche = Math.round(spec.contact * GPF_FPS);
  // le ballon au contact, dans le repère de l'animation : celui du geste (repère personnage, au sol) à l'échelle des jambes du
  // corps ; sa hauteur reste le rayon du ballon
  const k = (P.lengths.hipsY - P.lengths.groundY) / GPF_HIPS_Y, b = K.ball ?? [0.1, 0.11, -0.3];
  const ballon = [-b[0] / k, b[2] / k, b[1]];
  const Wt = fkGpf(poses.find((p) => p.f === fTouche)?.S ?? poses[0].S);
  const dCheville = Math.hypot(Wt.right_ankle.p[0] - ballon[0], Wt.right_ankle.p[1] - ballon[1], Wt.right_ankle.p[2] - ballon[2]);
  const fmt = (v) => v.toFixed(6);
  const lignes = [`player,${poses.map((p) => `${p.f},${p.S.p.map(fmt).join(',')}`).join(',')}`];
  for (const n of GPF_NODES) lignes.push(`${n},${poses.map((p) => `${p.f},${p.S.q[n].map(fmt).join(',')}`).join(',')}`);
  const touche = !SANS_TOUCHE.test(nom) && !tenue;
  let bilanSerie = '';
  if (sim) {
    // LES TOUCHES EN SÉRIE, puis la destination du ballon (sa dernière entrée) : le ballon de la sim à chaque instant, au corps
    const vers = (b) => [-b[1] / k, -b[0] / k, BALL_R];   // [devant, droite] → le repère du corps (la gauche en +X, l'avant en −Y)
    const entrees = [...X.touches, K.duration].map((t, i) => ({ f: Math.min(Math.round(t * GPF_FPS), poses.at(-1).f), b: vers(instant(t).ballon), touche: i < X.touches.length }));
    lignes.push(`extension,football,${entrees.map((e) => `${e.f},${e.b.map(fmt).join(',')}`).join(',')}`);
    lignes.push(`<gfserie>\n\t1\n</gfserie>`);
    bilanSerie = ' · ' + entrees.map((e) => {
      if (!e.touche) return `destination image ${e.f}`;
      const W = fkGpf(poses.reduce((b, p) => (Math.abs(p.f - e.f) < Math.abs(b.f - e.f) ? p : b), poses[0]).S), pied = X.pieds[entrees.indexOf(e)];
      const a = W[`${pied}_ankle`].p, dd = Math.hypot(a[0] - e.b[0], a[1] - e.b[1], a[2] - e.b[2]);
      return `touche image ${e.f} (pied ${pied === 'right' ? 'droit' : 'gauche'}) : cheville à ${(dd * 100).toFixed(1)} cm du centre`;
    }).join(' · ') + ` · cap final ${(instant(K.duration).yaw / DEG).toFixed(0)}° · corps à ${(Math.hypot(...instant(K.duration).p) * 100).toFixed(0)} cm`;
  } else if (touche) {
    // un geste planté : la touche, puis l'arrêt du ballon là où il le range (la dernière entrée)
    const R = rangement(K), fR = Math.min(Math.round(R.t * GPF_FPS), poses.at(-1).f), bR = [-R.b[0] / k, -R.b[1] / k, BALL_R];
    lignes.push(`extension,football,${fTouche},${ballon.map(fmt).join(',')},${fR},${bR.map(fmt).join(',')}`);
    lignes.push(`<gfserie>\n\t1\n</gfserie>`, `<gfarret>\n\t1\n</gfarret>`);
    bilanSerie = ` · le ballon rangé à l'image ${fR} en [${R.b.map((v) => v.toFixed(2)).join(', ')}] (droite, devant)`;
  }
  lignes.push(`<type>\n\t${touche ? 'ballcontrol' : 'movement'}\n</type>`);
  lignes.push(`<specialvar1>\n\t${numero}\n</specialvar1>`);
  const texte = lignes.join('\n') + '\n';
  if (sortie) writeFileSync(sortie, texte);
  console.log(`${nom} → specialvar1 ${numero} : ${poses.length} clés, ${(spec.duration).toFixed(2)} s, ${tenue ? `TENUE (la pose de ${tenue}, sans touche) · la cheville droite à ${(dCheville * 100).toFixed(1)} cm du ballon` : sim ? `EN SÉRIE${bilanSerie}` : touche ? `touche à l'image ${fTouche} · la cheville droite du corps à ${(dCheville * 100).toFixed(1)} cm du centre du ballon${bilanSerie}` : 'sans touche'}${sortie ? ` → ${sortie}` : ''}`);
  return texte;
}

const direct = import.meta.url === (await import('node:url')).pathToFileURL(process.argv[1] ?? '').href;
const [mode, ...args] = direct ? process.argv.slice(2) : [];
if (!direct) { /* importé : les fonctions seules */ }
else if (mode === 'aller-retour') allerRetour(args.length ? args : ['ballcontrol/idle/000.anim', 'pass/idle/180.anim', 'trap/idle/000_IB000.anim', 'shot/sprint/000_headerdive.anim', 'sliding/walk/000.anim']);
else if (mode === 'geste') await geste(args[0], +args[1], args[2]);
else if (mode === 'tous') for (const [nom, n] of Object.entries(REPERTOIRE)) await geste(nom, n, new URL(`../gestes/${nom}.anim`, import.meta.url).pathname);
else console.log('usage : node outils/vers-gpf.mjs aller-retour [fichiers…] | geste <nom> <numéro> [sortie.anim]');
export { GPF_PARENT, GPF_OFFSET, gpfVec, gpfQuat };
