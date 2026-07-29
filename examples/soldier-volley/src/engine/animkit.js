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
export const BASE_POSE = {
  LeftArm: [0, 0, 60], RightArm: [0, 0, 60],
  LeftForeArm: [0, 0, 12], RightForeArm: [0, 0, 12],
};

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
  const bones = new Set(Object.keys(BASE_POSE));
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
      const q = keys[i].q, n = Math.hypot(...q);
      if (Math.abs(n - 1) > 1e-3) { issues.push(`${bone}: non-normalized quaternion`); break; }
    }
    // limbs must MOVE, not teleport: bounded angular velocity between consecutive keys
    for (let i = 1; i < keys.length; i++) {
      const w = quatAngle(keys[i - 1].q, keys[i].q) / Math.max(1e-4, keys[i].t - keys[i - 1].t);
      if (w > 14) { issues.push(`${bone}: limb teleports (${w.toFixed(0)} rad/s between keys)`); break; }
    }
    // a looping move must land where it starts (the loop-seam pop, reference/20)
    if (loop && keys.length > 1 && quatAngle(keys[0].q, keys[keys.length - 1].q) > 0.26) issues.push(`${bone}: loop seam pops (start ≠ end)`);
    // hinge sanity where the axis is unambiguous on this rig: knees flex +x, hips −x (see the
    // seated-teammates code) — a knee bent backwards is the classic broken-generated-anim tell
    if (bone === 'LeftLeg' || bone === 'RightLeg') for (const k of keys) { if (k.e[0] < -8 || k.e[0] > 150) { issues.push(`${bone}: knee out of range (${k.e[0].toFixed(0)}°)`); break; } }
    if (bone === 'LeftUpLeg' || bone === 'RightUpLeg') for (const k of keys) { if (k.e[0] < -130 || k.e[0] > 40) { issues.push(`${bone}: hip out of range (${k.e[0].toFixed(0)}°)`); break; } }
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
        const v = Math.hypot(k.p[0] - pv.p[0], k.p[1] - pv.p[1], k.p[2] - pv.p[2]) / Math.max(1e-4, k.t - pv.t);
        if (v > 6.5) { issues.push(`hips teleport (${v.toFixed(1)} m/s between keys)`); break; }
      }
    }
    const first = resolved.hipsPos[0], last = resolved.hipsPos[resolved.hipsPos.length - 1];
    if (loop && Math.hypot(...last.p.map((v, i) => v - first.p[i])) > 0.05) issues.push('hips loop seam pops (pelvis does not come home)');
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

// ---------- the MOVE LIBRARY (football + DS life) — data, judged live via the play-mode ----------
export const MOVES = {
  /** wave hello (loop): right arm raised, forearm swings */
  salut: {
    name: 'salut', duration: 1.4, loop: true,
    keys: [
      { t: 0.0, pose: { RightArm: [0, 0, -60], RightForeArm: [0, 0, -30], Head: [0, 0, 6] } },
      { t: 0.35, pose: { RightArm: [0, 0, -60], RightForeArm: [0, 0, -65], Head: [0, 0, 6] } },
      { t: 0.7, pose: { RightArm: [0, 0, -60], RightForeArm: [0, 0, -12], Head: [0, 0, 6] } },
      { t: 1.05, pose: { RightArm: [0, 0, -60], RightForeArm: [0, 0, -65], Head: [0, 0, 6] } },
      { t: 1.4, pose: { RightArm: [0, 0, -60], RightForeArm: [0, 0, -30], Head: [0, 0, 6] } },
    ],
  },
  /** handshake (once): right arm forward, two pumps */
  poignee: {
    name: 'poignee', duration: 1.3, loop: false,
    keys: [
      { t: 0.0, pose: {} },
      { t: 0.3, pose: { RightArm: [-55, 0, 25], RightForeArm: [0, -18, 14], Spine1: [6, 0, 0] } },
      { t: 0.55, pose: { RightArm: [-48, 0, 25], RightForeArm: [0, -18, 14], Spine1: [8, 0, 0] } },
      { t: 0.8, pose: { RightArm: [-58, 0, 25], RightForeArm: [0, -18, 14], Spine1: [6, 0, 0] } },
      { t: 1.3, pose: {} },
    ],
  },
  /** celebration (once): both arms punched to the sky, chest open */
  celebration: {
    name: 'celebration', duration: 1.6, loop: false,
    keys: [
      { t: 0.0, pose: {} },
      { t: 0.25, pose: { LeftArm: [0, 0, 82], RightArm: [0, 0, 82], Spine1: [12, 0, 0], Head: [10, 0, 0] } },
      { t: 0.55, pose: { LeftArm: [-12, 0, -70], RightArm: [-12, 0, -70], LeftForeArm: [0, 0, 18], RightForeArm: [0, 0, 18], Spine1: [-12, 0, 0], Head: [-18, 0, 0] } },
      { t: 1.1, pose: { LeftArm: [-12, 0, -62], RightArm: [-12, 0, -62], LeftForeArm: [0, 0, 22], RightForeArm: [0, 0, 22], Spine1: [-10, 0, 0], Head: [-15, 0, 0] } },
      { t: 1.6, pose: {} },
    ],
  },
  /** applause (loop): hands together/apart in front of the chest */
  applaudir: {
    name: 'applaudir', duration: 0.9, loop: true,
    keys: [
      { t: 0.0, pose: { LeftArm: [-40, -20, 40], RightArm: [-40, 20, 40], LeftForeArm: [0, 55, 40], RightForeArm: [0, -55, 40] } },
      { t: 0.22, pose: { LeftArm: [-40, -8, 38], RightArm: [-40, 8, 38], LeftForeArm: [0, 72, 40], RightForeArm: [0, -72, 40] } },
      { t: 0.45, pose: { LeftArm: [-40, -20, 40], RightArm: [-40, 20, 40], LeftForeArm: [0, 55, 40], RightForeArm: [0, -55, 40] } },
      { t: 0.67, pose: { LeftArm: [-40, -8, 38], RightArm: [-40, 8, 38], LeftForeArm: [0, 72, 40], RightForeArm: [0, -72, 40] } },
      { t: 0.9, pose: { LeftArm: [-40, -20, 40], RightArm: [-40, 20, 40], LeftForeArm: [0, 55, 40], RightForeArm: [0, -55, 40] } },
    ],
  },
  /** football KICK (once): plant left, right leg loads back then swings through, arms counter */
  frappe: {
    name: 'frappe', duration: 0.85, contact: 0.42, loop: false,
    keys: [
      { t: 0.0, pose: {} },
      { t: 0.22, pose: { RightUpLeg: [28, 0, 0], RightLeg: [95, 0, 0], LeftArm: [-35, 0, 45], RightArm: [15, 0, 70], Spine1: [10, 0, 0] } },
      { t: 0.42, pose: { RightUpLeg: [-85, 0, 0], RightLeg: [15, 0, 0], RightFoot: [30, 0, 0], LeftArm: [15, 0, 60], RightArm: [-45, 0, 50], Spine1: [-8, 0, 0] } },
      { t: 0.6, pose: { RightUpLeg: [-60, 0, 0], RightLeg: [30, 0, 0], LeftArm: [0, 0, 55], RightArm: [-25, 0, 55], Spine1: [-4, 0, 0] } },
      { t: 0.85, pose: {} },
    ],
  },
  /** BACKHEEL (once): quick heel flick behind, shoulders stay square */
  talonnade: {
    name: 'talonnade', duration: 0.65, contact: 0.36, loop: false,
    keys: [
      { t: 0.0, pose: {} },
      { t: 0.18, pose: { RightUpLeg: [-18, 0, 0], RightLeg: [25, 0, 0], Spine1: [4, 0, 0] } },
      { t: 0.36, pose: { RightUpLeg: [28, 0, 0], RightLeg: [105, 0, 0], RightFoot: [20, 0, 0], Spine1: [10, 0, 0], LeftArm: [-15, 0, 50], RightArm: [10, 0, 68] } },
      { t: 0.65, pose: {} },
    ],
  },
  /** CHEST CONTROL (once): arch back, chest puffed, arms open, soft knees */
  amorti: {
    name: 'amorti', duration: 1.0, contact: 0.3, loop: false,
    keys: [
      { t: 0.0, pose: {} },
      { t: 0.3, pose: { Spine1: [-18, 0, 0], Head: [-10, 0, 0], LeftArm: [-12, 0, 28], RightArm: [-12, 0, 28], LeftUpLeg: [-14, 0, 0], RightUpLeg: [-14, 0, 0], LeftLeg: [24, 0, 0], RightLeg: [24, 0, 0] }, hips: [0, -0.07, 0] },
      { t: 0.55, pose: { Spine1: [-6, 0, 0], LeftArm: [-5, 0, 45], RightArm: [-5, 0, 45], LeftLeg: [14, 0, 0], RightLeg: [14, 0, 0] }, hips: [0, -0.03, 0] },
      { t: 1.0, pose: {}, hips: [0, 0, 0] },
    ],
  },
  /** GOALKEEPER DIVE (once, root motion): crouch, launch to the right, lay out, spring back up */
  plongeon: {
    name: 'plongeon', duration: 1.6, loop: false,
    keys: [
      { t: 0.0, pose: {}, hips: [0, 0, 0] },
      { t: 0.25, pose: { LeftUpLeg: [-55, 0, 0], RightUpLeg: [-55, 0, 0], LeftLeg: [75, 0, 0], RightLeg: [75, 0, 0], Spine1: [16, 0, 0] }, hips: [0, -0.26, 0] },
      { t: 0.55, pose: { Hips: [0, 0, -62], LeftArm: [-20, 0, -68], RightArm: [-20, 0, -72], LeftForeArm: [0, 0, 8], RightForeArm: [0, 0, 8], LeftUpLeg: [-12, 0, 0], RightUpLeg: [-16, 0, 0], LeftLeg: [12, 0, 0], RightLeg: [18, 0, 0], Spine1: [-6, 0, 0] }, hips: [0.85, 0.28, 0] },
      { t: 0.9, pose: { Hips: [0, 0, -80], LeftArm: [-15, 0, -70], RightArm: [-15, 0, -74], LeftUpLeg: [-10, 0, 0], RightUpLeg: [-14, 0, 0], Spine1: [0, 0, 0] }, hips: [1.35, -0.68, 0] },
      { t: 1.2, pose: { Hips: [0, 0, -80], LeftArm: [-10, 0, -60], RightArm: [-10, 0, -64] }, hips: [1.35, -0.68, 0] },
      { t: 1.6, pose: {}, hips: [0, 0, 0] },
    ],
  },
  /** BICYCLE KICK (once, root motion): crouch, launch, lay back mid-air, right leg scissors overhead */
  // ---- LES GESTES MANQUANTS. La table de technique.js compte 13 gestes ; il y avait 5 clips, donc une
  // passe de l'intérieur et une passe en pivot dessinaient le même mouvement. À une caméra à 19 m ça se
  // voit. Chacun de ces moves est écrit contre la MÉCANIQUE de son geste : quel appui, quelle rotation
  // de bassin, quelle jambe passe devant l'autre — et `contact` marque la frame où le pied touche.
  passeExterieur: {
    // Extérieur du pied : la jambe reste sous le corps, la cheville se ferme vers l'intérieur et c'est
    // le tibia qui pivote. Pas d'armé — c'est un geste court, presque une pichenette.
    name: 'passeExterieur', duration: 0.5, contact: 0.24, loop: false,
    keys: [
      { t: 0.0, pose: {} },
      // le bras suit en RAMPE : sans clé intermédiaire, le miroir double l'amplitude (Z est nié) et
      // le bras franchit 76° en 0,12 s — un membre qui se téléporte, que le contrat anatomique attrape
      { t: 0.12, pose: { RightUpLeg: [8, -6, 0], RightLeg: [38, 0, 0], RightFoot: [0, -18, 0], Spine1: [3, -6, 0], LeftArm: [-4, 0, 16] } },
      { t: 0.24, pose: { RightUpLeg: [-22, 14, 0], RightLeg: [16, 0, 0], RightFoot: [-8, -32, 0], Spine1: [-2, 8, 0], LeftArm: [-10, 0, 38] } },
      { t: 0.5, pose: {} },
    ],
  },
  passePivot: {
    // Se retourner AVEC le ballon : le bassin part en premier, les épaules suivent, et la frappe part
    // du pied intérieur en fin de rotation. Sans la rotation du buste, un « pivot » est une passe normale.
    name: 'passePivot', duration: 0.95, contact: 0.52, loop: false,
    keys: [
      { t: 0.0, pose: {} },
      { t: 0.22, pose: { Spine: [0, -28, 0], Spine1: [4, -20, 0], Head: [0, -25, 0], LeftUpLeg: [-14, -18, 0], RightUpLeg: [10, -12, 0], LeftArm: [-20, 0, 42] } },
      { t: 0.52, pose: { Spine: [0, -52, 0], Spine1: [2, -34, 0], Head: [0, -30, 0], RightUpLeg: [-34, -26, 0], RightLeg: [24, 0, 0], RightFoot: [0, 18, 0], LeftUpLeg: [12, -22, 0], LeftLeg: [30, 0, 0], LeftArm: [5, 0, 52], RightArm: [-15, 0, 44] } },
      { t: 0.74, pose: { Spine: [0, -34, 0], Spine1: [0, -22, 0], RightUpLeg: [-16, -18, 0], RightLeg: [34, 0, 0], LeftArm: [-5, 0, 40] } },
      { t: 0.95, pose: {} },
    ],
  },
  deviation: {
    // Remise de première : rien ne s'arme, le pied se pose sur la trajectoire et redirige. Le geste le
    // plus court du répertoire — c'est ce qui le distingue à l'œil d'une passe classique.
    name: 'deviation', duration: 0.38, contact: 0.16, loop: false,
    keys: [
      { t: 0.0, pose: {} },
      { t: 0.16, pose: { RightUpLeg: [-18, -22, 0], RightLeg: [22, 0, 0], RightFoot: [0, 30, 0], Spine1: [-3, -8, 0], LeftArm: [-12, 0, 44] } },
      { t: 0.38, pose: {} },
    ],
  },
  controleInterieur: {
    // Amorti de l'intérieur : le pied va CHERCHER le ballon puis recule avec lui pour absorber — le
    // retrait est tout le geste, un pied qui reste tendu renvoie le ballon au lieu de l'amortir.
    name: 'controleInterieur', duration: 0.62, contact: 0.2, loop: false,
    keys: [
      { t: 0.0, pose: {} },
      { t: 0.2, pose: { RightUpLeg: [-26, -24, 0], RightLeg: [28, 0, 0], RightFoot: [0, 34, 0], Spine1: [6, -6, 0], LeftArm: [-16, 0, 40] } },
      { t: 0.36, pose: { RightUpLeg: [6, -16, 0], RightLeg: [52, 0, 0], RightFoot: [0, 26, 0], Spine1: [10, -4, 0] } },
      { t: 0.62, pose: {} },
    ],
  },
  controleExterieur: {
    // Contrôle extérieur : le corps reste ouvert, le ballon est emmené SUR LE CÔTÉ dans le mouvement.
    name: 'controleExterieur', duration: 0.6, contact: 0.22, loop: false,
    keys: [
      { t: 0.0, pose: {} },
      { t: 0.22, pose: { RightUpLeg: [-14, 18, 0], RightLeg: [30, 0, 0], RightFoot: [-6, -30, 0], Spine1: [4, 10, 0], Hips: [0, 12, 0] } },
      { t: 0.4, pose: { RightUpLeg: [4, 22, 0], RightLeg: [48, 0, 0], RightFoot: [0, -20, 0], Hips: [0, 16, 0] } },
      { t: 0.6, pose: {} },
    ],
  },
  controleSemelle: {
    // Semelle : la jambe se lève, la plante se pose SUR le ballon et l'arrête net. Le seul contrôle où
    // le pied arrive par le dessus — et donc le seul qu'on reconnaît de loin.
    name: 'controleSemelle', duration: 0.55, contact: 0.22, loop: false,
    keys: [
      { t: 0.0, pose: {} },
      { t: 0.22, pose: { RightUpLeg: [-44, 0, 0], RightLeg: [30, 0, 0], RightFoot: [22, 0, 0], Spine1: [10, 0, 0], LeftArm: [-20, 0, 38], RightArm: [-10, 0, 40] }, hips: [0, -0.06, 0] },
      { t: 0.38, pose: { RightUpLeg: [-20, 0, 0], RightLeg: [42, 0, 0], RightFoot: [10, 0, 0], Spine1: [6, 0, 0] }, hips: [0, -0.03, 0] },
      { t: 0.55, pose: {}, hips: [0, 0, 0] },
    ],
  },
  amortiCuisse: {
    // Cuisse : la jambe monte à l'horizontale, le buste part en arrière pour amortir, et le ballon
    // retombe devant. Entre le pied et la poitrine il manquait toute une hauteur de jeu.
    name: 'amortiCuisse', duration: 0.8, contact: 0.3, loop: false,
    keys: [
      { t: 0.0, pose: {} },
      { t: 0.3, pose: { RightUpLeg: [-78, 0, 0], RightLeg: [46, 0, 0], Spine1: [-14, 0, 0], Head: [-8, 0, 0], LeftArm: [-30, 0, 30], RightArm: [-30, 0, 30] }, hips: [0, -0.04, 0] },
      { t: 0.5, pose: { RightUpLeg: [-46, 0, 0], RightLeg: [58, 0, 0], Spine1: [-6, 0, 0], LeftArm: [-15, 0, 36] } },
      { t: 0.8, pose: {} },
    ],
  },
  tacleDebout: {
    // Tacle debout : on reste sur ses appuis, le corps se baisse, la jambe la plus proche se tend vers
    // le ballon. Ce n'est PAS un tacle glissé — le bassin ne quitte jamais la verticale, et c'est
    // exactement la différence qu'on doit voir.
    name: 'tacleDebout', duration: 0.7, contact: 0.28, loop: false,
    keys: [
      { t: 0.0, pose: {} },
      { t: 0.28, pose: { RightUpLeg: [-52, -10, 0], RightLeg: [20, 0, 0], RightFoot: [0, 26, 0], LeftUpLeg: [-8, 0, 0], LeftLeg: [58, 0, 0], Spine1: [24, -6, 0], Head: [-10, 0, 0], LeftArm: [-40, 0, 34], RightArm: [-18, 0, 46] }, hips: [0, -0.14, 0.1] },
      { t: 0.48, pose: { RightUpLeg: [-24, -6, 0], RightLeg: [40, 0, 0], LeftLeg: [40, 0, 0], Spine1: [14, 0, 0] }, hips: [0, -0.06, 0.05] },
      { t: 0.7, pose: {}, hips: [0, 0, 0] },
    ],
  },
  // LE TACLE GLISSÉ. Le seul geste du répertoire où le bassin quitte la verticale : on part en appui,
  // la jambe d'attaque se tend vers le ballon, la hanche descend et le corps se couche sur le côté,
  // puis on se relève. Sans le mouvement de bassin (hips), un tacle « glissé » est un joueur debout qui
  // tend une jambe — ce qui est exactement le tell qu'on cherche à éviter.
  tacle: {
    name: 'tacle', duration: 1.25, contact: 0.34, loop: false,
    keys: [
      { t: 0.0, pose: {}, hips: [0, 0, 0] },
      { t: 0.18, pose: { RightUpLeg: [-25, 0, 0], RightLeg: [55, 0, 0], LeftUpLeg: [-12, 0, 0], Spine1: [16, 0, 0], LeftArm: [-30, 0, 40] }, hips: [0, -0.18, 0.15] },
      { t: 0.34, pose: { RightUpLeg: [-58, 0, -18], RightLeg: [8, 0, 0], RightFoot: [18, 0, 0], LeftUpLeg: [15, 0, -25], LeftLeg: [95, 0, 0], Spine1: [8, 0, -28], Head: [0, 15, 0], LeftArm: [-55, 0, 25], RightArm: [-20, 0, 60] }, hips: [0.1, -0.62, 0.75] },
      { t: 0.62, pose: { RightUpLeg: [-40, 0, -22], RightLeg: [22, 0, 0], LeftUpLeg: [5, 0, -30], LeftLeg: [80, 0, 0], Spine1: [4, 0, -32], LeftArm: [-60, 0, 20], RightArm: [-10, 0, 55] }, hips: [0.16, -0.66, 1.05] },
      { t: 0.95, pose: { RightUpLeg: [-15, 0, -8], RightLeg: [45, 0, 0], LeftUpLeg: [-20, 0, -10], LeftLeg: [60, 0, 0], Spine1: [18, 0, -10] }, hips: [0.08, -0.42, 1.15] },
      { t: 1.25, pose: {}, hips: [0, 0, 1.2] },
    ],
  },
  retournee: {
    name: 'retournee', duration: 1.35, contact: 0.52, loop: false,
    keys: [
      { t: 0.0, pose: {}, hips: [0, 0, 0] },
      { t: 0.22, pose: { LeftUpLeg: [-48, 0, 0], RightUpLeg: [-48, 0, 0], LeftLeg: [62, 0, 0], RightLeg: [62, 0, 0], Spine1: [14, 0, 0], LeftArm: [-25, 0, 45], RightArm: [-25, 0, 45] }, hips: [0, -0.22, 0] },
      { t: 0.52, pose: { Hips: [-95, 0, 0], RightUpLeg: [-115, 0, 0], RightLeg: [18, 0, 0], LeftUpLeg: [-35, 0, 0], LeftLeg: [45, 0, 0], Spine1: [-10, 0, 0], Head: [-15, 0, 0], LeftArm: [-45, 0, 20], RightArm: [-45, 0, 20] }, hips: [0, 0.62, -0.18] },
      { t: 0.8, pose: { Hips: [-60, 0, 0], RightUpLeg: [-55, 0, 0], RightLeg: [40, 0, 0], LeftUpLeg: [-60, 0, 0], LeftLeg: [30, 0, 0], LeftArm: [-25, 0, 35], RightArm: [-25, 0, 35] }, hips: [0, 0.1, -0.35] },
      { t: 1.05, pose: { LeftUpLeg: [-45, 0, 0], RightUpLeg: [-45, 0, 0], LeftLeg: [60, 0, 0], RightLeg: [60, 0, 0], Spine1: [12, 0, 0] }, hips: [0, -0.2, -0.42] },
      { t: 1.35, pose: {}, hips: [0, 0, -0.42] },
    ],
  },
  /** CONSULTING the laptop (loop, subtle sway): left forearm raised flat to carry it at chest
   *  height, right hand over the keys, head down toward the screen */
  consulter: {
    name: 'consulter', duration: 2.4, loop: true,
    keys: [
      { t: 0.0, pose: { LeftArm: [-55, 0, 48], LeftForeArm: [-95, 0, 18], RightArm: [-55, 0, 40], RightForeArm: [-70, 0, 20], Head: [16, 0, 0], Spine1: [6, 0, 0] } },
      { t: 1.2, pose: { LeftArm: [-57, 0, 48], LeftForeArm: [-97, 0, 18], RightArm: [-57, 0, 39], RightForeArm: [-72, 0, 20], Head: [18, 0, 0], Spine1: [7, 0, 0] } },
      { t: 2.4, pose: { LeftArm: [-55, 0, 48], LeftForeArm: [-95, 0, 18], RightArm: [-55, 0, 40], RightForeArm: [-70, 0, 20], Head: [16, 0, 0], Spine1: [6, 0, 0] } },
    ],
  },
  /** side-foot PASS (once): shorter, opened hip */
  passe: {
    // `contact` = when in this clip the boot meets the ball. A ball-contact move is only worth
    // anything if something can synchronise it with the ball, and that number is not derivable from
    // the keys: it is the author's intent about which key IS the contact (here the through-swing at
    // 0.38). Consumers start the clip there when the ball is already leaving.
    name: 'passe', duration: 0.7, contact: 0.38, loop: false,
    keys: [
      { t: 0.0, pose: {} },
      { t: 0.2, pose: { RightUpLeg: [18, -18, 0], RightLeg: [55, 0, 0], LeftArm: [-20, 0, 40], Spine1: [6, 0, 0] } },
      { t: 0.38, pose: { RightUpLeg: [-45, -30, 0], RightLeg: [12, 0, 0], RightFoot: [0, 25, 0], LeftArm: [5, 0, 50], Spine1: [-4, 0, 0] } },
      { t: 0.7, pose: {} },
    ],
  },
};
