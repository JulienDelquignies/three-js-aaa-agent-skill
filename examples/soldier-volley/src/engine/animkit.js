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
// LA POSE NEUTRE, ET ELLE DOIT ÊTRE SYMÉTRIQUE. Elle ne l'était pas : les deux bras portaient
// [0, 0, 60], ce qui n'est PAS un miroir — la loi du miroir sur ce rig est la conjugaison quaternion
// (w, x, −y, −z), soit [x, −y, −z] en euler XYZ, et elle est EXACTE (écart 0,000000 sur 20 000 poses
// aléatoires ; dérivée du rig lui-même : A = PL⁻¹·M·PR vaut M à 0,009 près sur les sept paires d'os).
// Conséquence mesurée sur le vrai squelette : main gauche à z = +0,411 (devant), main droite à
// z = −0,467 (DERRIÈRE), 9,3 cm d'écart de hauteur. Les bras étaient donc figés en torsion permanente
// sur tout geste qui ne les anime pas — c'est-à-dire la plupart, puisqu'ils ne participent que de 36°.
// Symétrisée, les deux mains tombent à z = +0,41 et à la même hauteur, écart 0,000.
export const BASE_POSE = {
  LeftArm: [0, 0, 60], RightArm: [0, 0, -60],
  LeftForeArm: [0, 0, 12], RightForeArm: [0, 0, -12],
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
    // LA FRAPPE DU COU-DE-PIED, écrite contre la biomécanique publiée et plus contre l'intuition.
    // Ce que l'ancienne version n'avait pas, et qui est chacun un nombre mesuré :
    //   • la SÉQUENCE PROXIMO-DISTALE — la cuisse atteint son pic de vitesse AVANT le tibia, le tibia
    //     AU contact (Kellis & Katis). L'ancienne clé posait leurs extrêmes au même instant : 0 ms de
    //     décalage, une jambe d'un seul bloc.
    //   • le BASSIN tourne tôt (retrait −16° → +8°) puis SE FIGE : ≤ 2° entre l'appui et le contact —
    //     c'est ce que l'élite fait. Il était à 0° sur toutes les frappes.
    //   • le BUSTE part en arrière de 13–17° à l'armé et tourne ~22° vers le côté non frappeur.
    //   • la TÊTE est SUR LE BALLON jusqu'au contact (quiet eye : la fixation finale dépasse 1 s chez
    //     ceux qui marquent), puis remonte vers la cible.
    //   • la JAMBE D'APPUI existe : plantée genou fléchi ~26° (absorption), elle s'étend au contact.
    //   • le genou frappeur passe à ~15 rad/s en phase d'accélération (littérature : 19,8–28) — c'est
    //     précisément ce que l'ancien plafond uniforme interdisait.
    name: 'frappe', duration: 0.85, contact: 0.35, loop: false,
    keys: [
      { t: 0.0, pose: {} },
      { t: 0.26, pose: {
        RightUpLeg: [-30, 0, 0], RightLeg: [-108, 0, 0], RightFoot: [28, 0, 0],
        Hips: [0, -16, 0],
        Spine: [-4, -8, 0], Spine1: [-8, -8, 0], Spine2: [-4, -6, 0],
        Neck: [4, 0, 0], Head: [16, 0, 0],
        LeftArm: [-10, 8, 46], LeftForeArm: [8, 0, 48], RightArm: [18, -6, 55], RightForeArm: [8, 0, -42],
        LeftUpLeg: [10, 0, 0], LeftLeg: [-26, 0, 0], LeftFoot: [-8, 0, 0],
      }, hips: [0, -0.05, 0] },
      // la clé de traversée est POSÉE sur l'instant de contact (0,35) — le pied ne s'y arrête pas :
      // l'overshoot (0,41, cuisse −80°) continue le balayage au même rythme avant la récupération
      { t: 0.35, pose: {
        RightUpLeg: [62, 0, 0], RightLeg: [-62, 0, 0], RightFoot: [30, 0, 0],
        Hips: [0, 6, 0],
        Spine: [-2, 6, 0], Spine1: [-4, 10, 0], Spine2: [-2, 8, 0],
        Neck: [4, 0, 0], Head: [17, 0, 0],
        LeftArm: [-2, 4, 48], LeftForeArm: [8, 0, 42], RightArm: [-4, -2, 52], RightForeArm: [6, 0, -34],
        LeftUpLeg: [8, 0, 0], LeftLeg: [-20, 0, 0], LeftFoot: [-6, 0, 0],
      }, hips: [0, -0.02, 0] },
      { t: 0.4, pose: {
        RightUpLeg: [80, 0, 0], RightLeg: [-10, 0, 0], RightFoot: [32, 0, 0],
        Hips: [0, 8, 0],
        Spine: [0, 8, 0], Spine1: [2, 14, 0], Spine2: [0, 10, 0],
        Neck: [3, 0, 0], Head: [18, 0, 0],
        LeftArm: [6, 2, 48], LeftForeArm: [8, 0, 34], RightArm: [-12, -3, 50], RightForeArm: [6, 0, -28],
        LeftUpLeg: [6, 0, 0], LeftLeg: [-14, 0, 0], LeftFoot: [-4, 0, 0],
      }, hips: [0, 0, 0] },
      { t: 0.62, pose: {
        RightUpLeg: [58, 0, 0], RightLeg: [-34, 0, 0],
        Hips: [0, 14, 0],
        Spine: [2, 6, 0], Spine1: [8, 10, 0], Spine2: [3, 6, 0],
        Head: [6, 0, 0],
        LeftArm: [10, 4, 50], LeftForeArm: [6, 0, 26], RightArm: [-14, -4, 48], RightForeArm: [5, 0, -24],
        LeftLeg: [-12, 0, 0],
      }, hips: [0, 0.02, 0] },
      { t: 0.85, pose: {} },
    ],
  },
  /** BACKHEEL (once): quick heel flick behind, shoulders stay square */
  talonnade: {
    name: 'talonnade', duration: 0.65, contact: 0.19, loop: false,
    keys: [
      { t: 0.0, pose: {} },
      // les épaules restent de face et la tête reste HAUTE : c'est la tromperie du geste — regarder
      // le ballon vendrait la talonnade. Le bassin, lui, ne tourne pas ; c'est sa signature.
      { t: 0.18, pose: { RightUpLeg: [18, 0, 0], RightLeg: [-25, 0, 0], Spine1: [4, 0, 0], Spine2: [2, 0, 0], Head: [-4, 0, 0], LeftLeg: [-16, 0, 0], LeftArm: [-10, 0, 44] } },
      // clé de contact posée SUR la trajectoire (valeurs interpolées 0,18→0,36) : le talon frappe en
      // TRAVERSANT, à 0,19 le balayage arrière est lancé et ne s'arrête pas là
      { t: 0.19, pose: { RightUpLeg: [15.4, 0, 0], RightLeg: [-29.4, 0, 0], Spine1: [4.3, 0, 0], Spine2: [2.1, 0, 0], Head: [-4.1, 0, 0], LeftLeg: [-15.8, 0, 0], LeftArm: [-10.3, 0, 44.3] } },
      { t: 0.36, pose: { RightUpLeg: [-28, 0, 0], RightLeg: [-105, 0, 0], RightFoot: [20, 0, 0], Spine1: [10, 0, 0], Spine2: [4, 0, 0], Head: [-6, 0, 0], LeftArm: [-15, 0, 50], RightArm: [10, 0, 68], LeftLeg: [-12, 0, 0] } },
      { t: 0.65, pose: {} },
    ],
  },
  /** CHEST CONTROL (once): arch back, chest puffed, arms open, soft knees */
  amorti: {
    name: 'amorti', duration: 1.0, contact: 0.3, loop: false,
    keys: [
      { t: 0.0, pose: {} },
      { t: 0.3, pose: { Spine1: [-18, 0, 0], Head: [-10, 0, 0], LeftArm: [-12, 0, 28], RightArm: [-12, 0, 28], LeftUpLeg: [14, 0, 0], RightUpLeg: [14, 0, 0], LeftLeg: [-24, 0, 0], RightLeg: [-24, 0, 0] }, hips: [0, -0.07, 0] },
      { t: 0.55, pose: { Spine1: [-6, 0, 0], LeftArm: [-5, 0, 45], RightArm: [-5, 0, 45], LeftLeg: [-14, 0, 0], RightLeg: [-14, 0, 0] }, hips: [0, -0.03, 0] },
      { t: 1.0, pose: {}, hips: [0, 0, 0] },
    ],
  },
  /** GOALKEEPER DIVE (once, root motion): crouch, launch to the right, lay out, spring back up */
  plongeon: {
    name: 'plongeon', duration: 1.6, loop: false,
    keys: [
      { t: 0.0, pose: {}, hips: [0, 0, 0] },
      { t: 0.25, pose: { LeftUpLeg: [55, 0, 0], RightUpLeg: [55, 0, 0], LeftLeg: [-75, 0, 0], RightLeg: [-75, 0, 0], Spine1: [16, 0, 0] }, hips: [0, -0.26, 0] },
      { t: 0.55, pose: { Hips: [0, 0, -62], LeftArm: [-20, 0, -68], RightArm: [-20, 0, -72], LeftForeArm: [0, 0, 8], RightForeArm: [0, 0, 8], LeftUpLeg: [12, 0, 0], RightUpLeg: [16, 0, 0], LeftLeg: [-12, 0, 0], RightLeg: [-18, 0, 0], Spine1: [-6, 0, 0] }, hips: [0.85, 0.28, 0] },
      { t: 0.9, pose: { Hips: [0, 0, -80], LeftArm: [-15, 0, -70], RightArm: [-15, 0, -74], LeftUpLeg: [10, 0, 0], RightUpLeg: [14, 0, 0], Spine1: [0, 0, 0] }, hips: [1.35, -0.68, 0] },
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
      { t: 0.14, pose: { RightUpLeg: [-16, -6, 0], RightLeg: [-50, 0, 0], RightFoot: [0, -20, 0], Hips: [0, -5, 0], Spine1: [3, -6, 0], Spine2: [1, -4, 0], Neck: [2, 0, 0], Head: [13, 0, 0], LeftArm: [-4, 0, 16], LeftLeg: [-16, 0, 0] } },
      // le contact se TRAVERSE : la cuisse balaie 50° dans le segment d'approche et continue au même
      // rythme après — une clé de contact où le pied se gare mesure une vitesse nulle sur le ballon
      { t: 0.24, pose: { RightUpLeg: [38, 12, 0], RightLeg: [-16, 0, 0], RightFoot: [-6, -34, 0], Hips: [0, 4, 0], Spine1: [-2, 8, 0], Spine2: [0, 5, 0], Neck: [2, 0, 0], Head: [15, 0, 0], LeftArm: [-8, 0, 30], LeftLeg: [-12, 0, 0] } },
      { t: 0.3, pose: { RightUpLeg: [74, 14, 0], RightLeg: [-14, 0, 0], RightFoot: [-6, -30, 0], Hips: [0, 5, 0], Spine1: [-3, 8, 0], Spine2: [0, 5, 0], Neck: [2, 0, 0], Head: [15, 0, 0], LeftArm: [-10, 0, 38], LeftLeg: [-14, 0, 0] } },
      { t: 0.5, pose: {} },
    ],
  },
  passePivot: {
    // Se retourner AVEC le ballon : le bassin part en premier, les épaules suivent, et la frappe part
    // du pied intérieur en fin de rotation. Sans la rotation du buste, un « pivot » est une passe normale.
    name: 'passePivot', duration: 0.95, contact: 0.52, loop: false,
    keys: [
      { t: 0.0, pose: {} },
      // le BASSIN mène la rotation (il n'y était pas : un « pivot » du seul buste est une torsion,
      // pas un demi-tour), les épaules suivent, la tête cherche le ballon puis la cible
      { t: 0.22, pose: { Hips: [0, -22, 0], Spine: [0, -20, 0], Spine1: [4, -16, 0], Spine2: [2, -10, 0], Neck: [2, -8, 0], Head: [10, -18, 0], LeftUpLeg: [14, -18, 0], RightUpLeg: [-10, -12, 0], LeftLeg: [-18, 0, 0], LeftArm: [-20, 0, 42], RightArm: [8, 0, 46] } },
      // la jambe ATTEND pendant que le corps tourne : sans cette clé armée, la cuisse s'étale sur
      // 0,30 s (147°/s — une caresse) ; ici le balayage se concentre sur 0,44→0,52 puis TRAVERSE
      { t: 0.44, pose: { Hips: [0, -34, 0], Spine: [0, -30, 0], Spine1: [2, -22, 0], Spine2: [0, -13, 0], Neck: [2, -7, 0], Head: [12, -15, 0], RightUpLeg: [-12, -22, 0], RightLeg: [-58, 0, 0], RightFoot: [0, 12, 0], LeftUpLeg: [-2, -21, 0], LeftLeg: [-18, 0, 0], LeftArm: [-2, 0, 49], RightArm: [-9, 0, 45] } },
      { t: 0.52, pose: { Hips: [0, -38, 0], Spine: [0, -34, 0], Spine1: [2, -24, 0], Spine2: [0, -14, 0], Neck: [2, -6, 0], Head: [12, -14, 0], RightUpLeg: [34, -26, 0], RightLeg: [-24, 0, 0], RightFoot: [0, 18, 0], LeftUpLeg: [-8, -22, 0], LeftLeg: [-20, 0, 0], LeftArm: [5, 0, 52], RightArm: [-15, 0, 44] } },
      { t: 0.585, pose: { Hips: [0, -40, 0], Spine: [0, -35, 0], Spine1: [0, -22, 0], Spine2: [0, -13, 0], Neck: [2, -6, 0], Head: [8, -10, 0], RightUpLeg: [72, -26, 0], RightLeg: [-16, 0, 0], RightFoot: [0, 16, 0], LeftUpLeg: [-10, -20, 0], LeftLeg: [-18, 0, 0], LeftArm: [8, 0, 50], RightArm: [-18, 0, 42] } },
      { t: 0.74, pose: { Hips: [0, -24, 0], Spine: [0, -22, 0], Spine1: [0, -16, 0], Spine2: [0, -8, 0], Head: [4, -6, 0], RightUpLeg: [16, -18, 0], RightLeg: [-34, 0, 0], LeftLeg: [-20, 0, 0], LeftArm: [-5, 0, 40], RightArm: [-10, 0, 44] } },
      { t: 0.95, pose: {} },
    ],
  },
  deviation: {
    // Remise de première : rien ne s'arme, le pied se pose sur la trajectoire et redirige. Le geste le
    // plus court du répertoire — c'est ce qui le distingue à l'œil d'une passe classique.
    name: 'deviation', duration: 0.38, contact: 0.16, loop: false,
    keys: [
      { t: 0.0, pose: {} },
      // même une remise ACCOMPAGNE : la surface se présente (0→0,13) puis pousse À TRAVERS le point de
      // contact — un pied figé au contact rend une vitesse nulle et le ballon traverse une statue
      { t: 0.13, pose: { RightUpLeg: [8, -18, 0], RightLeg: [-24, 0, 0], RightFoot: [0, 26, 0], Hips: [0, -6, 0], Spine1: [-3, -7, 0], Spine2: [0, -4, 0], Head: [12, 0, 0], LeftArm: [-7, 4, 40], LeftForeArm: [7, 0, 36], LeftLeg: [-13, 0, 0] } },
      { t: 0.16, pose: { RightUpLeg: [18, -22, 0], RightLeg: [-22, 0, 0], RightFoot: [0, 30, 0], Hips: [0, -7, 0], Spine1: [-3, -8, 0], Spine2: [0, -4, 0], Head: [12, 0, 0], LeftArm: [-8, 5, 46], LeftForeArm: [8, 0, 42], LeftLeg: [-14, 0, 0] } },
      { t: 0.21, pose: { RightUpLeg: [31, -24, 0], RightLeg: [-24, 0, 0], RightFoot: [0, 30, 0], Hips: [0, -7, 0], Spine1: [-3, -8, 0], Spine2: [0, -4, 0], Head: [12, 0, 0], LeftArm: [-8, 5, 46], LeftForeArm: [8, 0, 42], LeftLeg: [-14, 0, 0] } },
      { t: 0.38, pose: {} },
    ],
  },
  controleInterieur: {
    // Amorti de l'intérieur : le pied va CHERCHER le ballon puis recule avec lui pour absorber — le
    // retrait est tout le geste, un pied qui reste tendu renvoie le ballon au lieu de l'amortir.
    name: 'controleInterieur', duration: 0.62, contact: 0.2, loop: false,
    keys: [
      { t: 0.0, pose: {} },
      { t: 0.2, pose: { RightUpLeg: [26, -24, 0], RightLeg: [-28, 0, 0], RightFoot: [0, 34, 0], Hips: [0, -6, 0], Spine1: [6, -6, 0], Spine2: [2, -4, 0], Neck: [3, 0, 0], Head: [16, 0, 0], LeftArm: [-16, 0, 40], LeftLeg: [-18, 0, 0] } },
      { t: 0.36, pose: { RightUpLeg: [-6, -16, 0], RightLeg: [-52, 0, 0], RightFoot: [0, 26, 0], Hips: [0, -3, 0], Spine1: [10, -4, 0], Spine2: [3, -2, 0], Neck: [3, 0, 0], Head: [17, 0, 0], LeftArm: [-8, 0, 42], LeftLeg: [-22, 0, 0] } },
      { t: 0.62, pose: {} },
    ],
  },
  controleExterieur: {
    // Contrôle extérieur : le corps reste ouvert, le ballon est emmené SUR LE CÔTÉ dans le mouvement.
    name: 'controleExterieur', duration: 0.6, contact: 0.22, loop: false,
    keys: [
      { t: 0.0, pose: {} },
      { t: 0.22, pose: { RightUpLeg: [14, 18, 0], RightLeg: [-30, 0, 0], RightFoot: [-6, -30, 0], Spine1: [4, 10, 0], Spine2: [2, 6, 0], Hips: [0, 12, 0], Head: [14, 6, 0], LeftArm: [-18, 0, 42], LeftLeg: [-16, 0, 0] } },
      { t: 0.4, pose: { RightUpLeg: [-4, 22, 0], RightLeg: [-48, 0, 0], RightFoot: [0, -20, 0], Hips: [0, 16, 0], Spine1: [3, 8, 0], Spine2: [1, 5, 0], Head: [15, 8, 0], LeftArm: [-10, 0, 40], LeftLeg: [-18, 0, 0] } },
      { t: 0.6, pose: {} },
    ],
  },
  controleSemelle: {
    // Semelle : la jambe se lève, la plante se pose SUR le ballon et l'arrête net. Le seul contrôle où
    // le pied arrive par le dessus — et donc le seul qu'on reconnaît de loin.
    name: 'controleSemelle', duration: 0.55, contact: 0.22, loop: false,
    keys: [
      { t: 0.0, pose: {} },
      { t: 0.22, pose: { RightUpLeg: [44, 0, 0], RightLeg: [-30, 0, 0], RightFoot: [22, 0, 0], Spine1: [10, 0, 0], Spine2: [4, 0, 0], Neck: [4, 0, 0], Head: [16, 0, 0], LeftArm: [-20, 0, 38], RightArm: [-10, 0, 40], LeftLeg: [-14, 0, 0] }, hips: [0, -0.06, 0] },
      { t: 0.38, pose: { RightUpLeg: [20, 0, 0], RightLeg: [-42, 0, 0], RightFoot: [10, 0, 0], Spine1: [6, 0, 0], Spine2: [2, 0, 0], Neck: [3, 0, 0], Head: [14, 0, 0], LeftArm: [-12, 0, 38], RightArm: [-8, 0, 40], LeftLeg: [-16, 0, 0] }, hips: [0, -0.03, 0] },
      { t: 0.55, pose: {}, hips: [0, 0, 0] },
    ],
  },
  amortiCuisse: {
    // Cuisse : la jambe monte à l'horizontale, le buste part en arrière pour amortir, et le ballon
    // retombe devant. Entre le pied et la poitrine il manquait toute une hauteur de jeu.
    name: 'amortiCuisse', duration: 0.8, contact: 0.3, loop: false,
    keys: [
      { t: 0.0, pose: {} },
      { t: 0.3, pose: { RightUpLeg: [78, 0, 0], RightLeg: [-46, 0, 0], Spine1: [-14, 0, 0], Spine2: [-5, 0, 0], Neck: [-3, 0, 0], Head: [-8, 0, 0], LeftArm: [-2, 10, 46], LeftForeArm: [8, 0, 38], RightArm: [-2, -10, 46], RightForeArm: [8, 0, -38], LeftLeg: [-14, 0, 0] }, hips: [0, -0.04, 0] },
      { t: 0.5, pose: { RightUpLeg: [46, 0, 0], RightLeg: [-58, 0, 0], Spine1: [-6, 0, 0], Spine2: [-2, 0, 0], Neck: [2, 0, 0], Head: [10, 0, 0], LeftArm: [-4, 4, 46], LeftForeArm: [6, 0, 32], RightArm: [-4, -4, 46], RightForeArm: [20, 0, 16], LeftLeg: [-16, 0, 0] } },
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
      { t: 0.28, pose: { RightUpLeg: [52, -10, 0], RightLeg: [-20, 0, 0], RightFoot: [0, 26, 0], LeftUpLeg: [8, 0, 0], LeftLeg: [-58, 0, 0], Spine1: [24, -6, 0], Head: [-10, 0, 0], LeftArm: [-14, 8, 44], LeftForeArm: [8, 0, 45], RightArm: [-10, -4, 48], RightForeArm: [8, 0, -36] }, hips: [0, -0.14, 0.1] },
      { t: 0.48, pose: { RightUpLeg: [24, -6, 0], RightLeg: [-40, 0, 0], LeftLeg: [-40, 0, 0], Spine1: [14, 0, 0] }, hips: [0, -0.06, 0.05] },
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
      { t: 0.18, pose: { RightUpLeg: [25, 0, 0], RightLeg: [-55, 0, 0], LeftUpLeg: [12, 0, 0], Spine1: [16, 0, 0], LeftArm: [-30, 0, 40] }, hips: [0, -0.18, 0.15] },
      { t: 0.34, pose: { RightUpLeg: [58, 0, -18], RightLeg: [-8, 0, 0], RightFoot: [18, 0, 0], LeftUpLeg: [-15, 0, -25], LeftLeg: [-95, 0, 0], Spine1: [8, 0, -28], Head: [0, 15, 0], LeftArm: [-55, 0, 25], RightArm: [-20, 0, 60] }, hips: [0.1, -0.62, 0.75] },
      { t: 0.62, pose: { RightUpLeg: [40, 0, -22], RightLeg: [-22, 0, 0], LeftUpLeg: [-5, 0, -30], LeftLeg: [-80, 0, 0], Spine1: [4, 0, -32], LeftArm: [-60, 0, 20], RightArm: [-10, 0, 55] }, hips: [0.16, -0.66, 1.05] },
      { t: 0.95, pose: { RightUpLeg: [15, 0, -8], RightLeg: [-45, 0, 0], LeftUpLeg: [20, 0, -10], LeftLeg: [-60, 0, 0], Spine1: [18, 0, -10] }, hips: [0.08, -0.42, 1.15] },
      { t: 1.25, pose: {}, hips: [0, 0, 1.2] },
    ],
  },
  retournee: {
    name: 'retournee', duration: 1.35, contact: 0.52, loop: false,
    keys: [
      { t: 0.0, pose: {}, hips: [0, 0, 0] },
      { t: 0.22, pose: { LeftUpLeg: [48, 0, 0], RightUpLeg: [48, 0, 0], LeftLeg: [-62, 0, 0], RightLeg: [-62, 0, 0], Spine1: [14, 0, 0], LeftArm: [-25, 0, 45], RightArm: [-25, 0, 45] }, hips: [0, -0.22, 0] },
      { t: 0.52, pose: { Hips: [-95, 0, 0], RightUpLeg: [115, 0, 0], RightLeg: [-18, 0, 0], LeftUpLeg: [35, 0, 0], LeftLeg: [-45, 0, 0], Spine1: [-10, 0, 0], Head: [-15, 0, 0], LeftArm: [-45, 0, 20], RightArm: [-45, 0, 20] }, hips: [0, 0.62, -0.18] },
      { t: 0.8, pose: { Hips: [-60, 0, 0], RightUpLeg: [55, 0, 0], RightLeg: [-40, 0, 0], LeftUpLeg: [60, 0, 0], LeftLeg: [-30, 0, 0], LeftArm: [-25, 0, 35], RightArm: [-25, 0, 35] }, hips: [0, 0.1, -0.35] },
      { t: 1.05, pose: { LeftUpLeg: [45, 0, 0], RightUpLeg: [45, 0, 0], LeftLeg: [-60, 0, 0], RightLeg: [-60, 0, 0], Spine1: [12, 0, 0] }, hips: [0, -0.2, -0.42] },
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
    // Passe de l'intérieur : pendule depuis la hanche, hanche OUVERTE (rotation externe — c'est le
    // geste qui présente la surface), buste quasi droit, bassin discret mais présent, tête sur le
    // ballon. Amplitudes moindres que la frappe : la littérature donne le pied à 19 m/s côté pro sur
    // une passe appuyée contre 20+ en frappe, mais surtout un armé bien plus court.
    name: 'passe', duration: 0.7, contact: 0.38, loop: false,
    keys: [
      { t: 0.0, pose: {} },
      { t: 0.22, pose: {
        RightUpLeg: [-20, -20, 0], RightLeg: [-58, 0, 0], RightFoot: [8, 15, 0],
        Hips: [0, -8, 0],
        Spine: [-2, -4, 0], Spine1: [2, -6, 0], Spine2: [-2, -4, 0],
        Neck: [3, 0, 0], Head: [14, 0, 0],
        LeftArm: [-8, 6, 48], LeftForeArm: [8, 0, 45], RightArm: [12, -4, 54], RightForeArm: [8, 0, -36],
        LeftUpLeg: [8, 0, 0], LeftLeg: [-22, 0, 0], LeftFoot: [-6, 0, 0],
      }, hips: [0, -0.03, 0] },
      // CHAQUE os animé est keyé à CHAQUE clé : un os absent retombe sur la POSE DE BASE, pas sur
      // l'interpolation — le bras droit faisait 12° → −60° (base) → −18° en 0,1 s, soit 19 rad/s de
      // téléportation que le contrat a attrapée au premier essai.
      { t: 0.32, pose: {
        RightUpLeg: [-2, -24, 0], RightLeg: [-44, 0, 0], RightFoot: [4, 20, 0],
        Hips: [0, 0, 0],
        Spine: [-1, 0, 0], Spine1: [-2, 4, 0], Spine2: [0, 4, 0],
        Neck: [3, 0, 0], Head: [15, 0, 0],
        LeftArm: [-2, 3, 48], LeftForeArm: [8, 0, 40], RightArm: [-2, -2, 52], RightForeArm: [6, 0, -30],
        LeftUpLeg: [6, 0, 0], LeftLeg: [-18, 0, 0], LeftFoot: [-5, 0, 0],
      } },
      { t: 0.38, pose: {
        RightUpLeg: [46, -30, 0], RightLeg: [-10, 0, 0], RightFoot: [28, 35, 0],
        Hips: [0, 4, 0],
        Spine: [0, 4, 0], Spine1: [-4, 8, 0], Spine2: [0, 6, 0],
        Neck: [2, 0, 0], Head: [16, 0, 0],
        LeftArm: [5, 2, 48], LeftForeArm: [6, 0, 30], RightArm: [-10, -3, 50], RightForeArm: [6, 0, -26],
        LeftUpLeg: [5, 0, 0], LeftLeg: [-12, 0, 0],
      }, hips: [0, 0, 0] },
      // L'OVERSHOOT : le swing CONTINUE après le contact (cuisse −46° → −72°) avant de récupérer.
      // Le banc de swing a mesuré l'ancienne forme : l'accompagnement RECULAIT (−46° → −30°), donc
      // la vitesse interpolée s'annulait pile sur la pose de contact — pied à 3 m/s au lieu de 12.
      // Un swing passe À TRAVERS sa pose de contact ; il ne se gare pas dessus.
      { t: 0.42, pose: {
        RightUpLeg: [76, -26, 0], RightLeg: [-34, 0, 0], RightFoot: [30, 30, 0],
        Hips: [0, 8, 0],
        Spine: [0, 4, 0], Spine1: [0, 6, 0], Spine2: [0, 4, 0],
        Neck: [1, 0, 0], Head: [10, 0, 0],
        LeftArm: [0, 2, 48], LeftForeArm: [6, 0, 26], RightArm: [-8, -2, 50], RightForeArm: [5, 0, -22],
        LeftUpLeg: [5, 0, 0], LeftLeg: [-14, 0, 0], LeftFoot: [-3, 0, 0],
      } },
      { t: 0.7, pose: {} },
    ],
  },

  // LA PASSE INTÉRIEURE RAPIDE — même surface, armé court. Le geste qui manquait : sous pression,
  // le départage prenait la seule option prompte de la bibliothèque, l'EXTÉRIEUR du pied (0,24 s
  // d'armé) — mesuré : 79,5 % des passes du rondo jouées de l'extérieur, l'inverse du football.
  // Corriger le départage sans offrir de passe intérieure courte a produit l'inverse du problème :
  // 89 % d'intérieur mais 0,38 s d'armé sous pression, record 8,4 → 5,8. Un pro pressé joue
  // TOUJOURS l'intérieur — avec un armé de POUSSÉE, court (le push pass rapide a un backswing
  // réduit, pas une autre surface). Dérivée de `passe` : phase d'armé compressée (0,38 → 0,22 s)
  // avec un backswing RÉDUIT (cuisse 20° → 14°, genou 58° → 46° — un armé court est un armé plus
  // PETIT, pas seulement plus vite : les vitesses angulaires restent ≤ 13 rad/s), pose de CONTACT
  // identique (c'est la même frappe), accompagnement aux mêmes deltas.
  passeRapide: {
    name: 'passeRapide', duration: 0.54, contact: 0.22, loop: false,
    keys: [
      { t: 0.0, pose: {} },
      { t: 0.13, pose: {
        RightUpLeg: [-14, -20, 0], RightLeg: [-46, 0, 0], RightFoot: [8, 15, 0],
        Hips: [0, -8, 0],
        Spine: [-2, -4, 0], Spine1: [2, -6, 0], Spine2: [-2, -4, 0],
        Neck: [3, 0, 0], Head: [14, 0, 0],
        LeftArm: [-8, 6, 48], LeftForeArm: [8, 0, 45], RightArm: [10, -4, 0], RightForeArm: [8, 0, -24],
        LeftUpLeg: [8, 0, 0], LeftLeg: [-22, 0, 0], LeftFoot: [-6, 0, 0],
      }, hips: [0, -0.03, 0] },
      { t: 0.19, pose: {
        RightUpLeg: [14, -28, 0], RightLeg: [-34, 0, 0], RightFoot: [6, 22, 0],
        Hips: [0, 3, 0],
        Spine: [-1, 0, 0], Spine1: [-2, 4, 0], Spine2: [0, 4, 0],
        Neck: [3, 0, 0], Head: [15, 0, 0],
        LeftArm: [-2, 3, 48], LeftForeArm: [8, 0, 40], RightArm: [-4, -2, 10], RightForeArm: [6, 0, -22],
        LeftUpLeg: [6, 0, 0], LeftLeg: [-18, 0, 0], LeftFoot: [-5, 0, 0],
      } },
      { t: 0.22, pose: {
        RightUpLeg: [46, -30, 0], RightLeg: [-10, 0, 0], RightFoot: [28, 35, 0],
        Hips: [0, 4, 0],
        Spine: [0, 4, 0], Spine1: [-4, 8, 0], Spine2: [0, 6, 0],
        Neck: [2, 0, 0], Head: [16, 0, 0],
        LeftArm: [5, 2, 48], LeftForeArm: [6, 0, 30], RightArm: [-10, -3, 16], RightForeArm: [6, 0, -22],
        LeftUpLeg: [5, 0, 0], LeftLeg: [-12, 0, 0],
      }, hips: [0, 0, 0] },
      { t: 0.26, pose: {
        RightUpLeg: [72, -26, 0], RightLeg: [-30, 0, 0], RightFoot: [30, 32, 0],
        Hips: [0, 7, 0],
        Spine: [0, 3, 0], Spine1: [0, 5, 0], Spine2: [0, 3, 0],
        Neck: [1, 0, 0], Head: [9, 0, 0],
        LeftArm: [0, 2, 48], LeftForeArm: [6, 0, 26], RightArm: [-6, -2, 4], RightForeArm: [5, 0, -20],
        LeftUpLeg: [4, 0, 0], LeftLeg: [-14, 0, 0], LeftFoot: [-3, 0, 0],
      } },
      { t: 0.54, pose: {} },
    ],
  },
};
