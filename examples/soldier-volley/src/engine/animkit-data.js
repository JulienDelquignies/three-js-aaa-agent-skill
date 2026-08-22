// animkit-data.js — LES CLIPS AUTHORÉS SONT DES DONNÉES (lot 23 — settings ≠ systems) :
// chaque geste (passes, frappes, contrôles, dribbles, plongeons…) est une spec de keyframes
// commentée, avec son horloge (duration/contact) lue par MOVE_TIMING. L'outil que les données
// consomment (repeatSegment — le passement double est os-pour-os la répétition du simple)
// vit avec elles — sens d'import unique animkit → animkit-data, jamais l'inverse.
// Au bit près : batterie + audits navigateur.

/** Répéter un segment (t0, t1] d'un clip `extra` fois — le MULTI-TOURS du passement (Mancini,
 *  Reveillère) : les clés du segment sont rejouées décalées, la suite glisse, durée et contact
 *  s'étendent d'autant. Pur : la variante passe le même checkClip que l'original. */
export function repeatSegment(spec, t0, t1, extra) {
  const seg = spec.keys.filter((k) => k.t > t0 && k.t <= t1);
  const dur = t1 - t0;
  const keys = [];
  for (const k of spec.keys) {
    if (k.t <= t1) keys.push({ ...k });
    else keys.push({ ...k, t: +(k.t + extra * dur).toFixed(3) });
  }
  for (let i = 1; i <= extra; i++) for (const k of seg) keys.push({ ...k, t: +(k.t + i * dur).toFixed(3) });
  keys.sort((a, b) => a.t - b.t);
  return { ...spec, duration: +(spec.duration + extra * dur).toFixed(3), contact: +(spec.contact + extra * dur).toFixed(3), keys };
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
        LeftArm: [40, 0, 45], LeftForeArm: [35, 0, 35], RightArm: [40, 0, 40], RightForeArm: [-10, 0, -20],
        LeftUpLeg: [10, 0, 0], LeftLeg: [-26, 0, 0], LeftFoot: [-8, 0, 0],
      }, hips: [0, -0.05, 0] },
      // la clé de traversée est POSÉE sur l'instant de contact (0,35) — le pied ne s'y arrête pas :
      // l'overshoot (0,41, cuisse −80°) continue le balayage au même rythme avant la récupération
      { t: 0.35, pose: {
        RightUpLeg: [62, 0, 0], RightLeg: [-62, 0, 0], RightFoot: [30, 0, 0],
        Hips: [0, 6, 0],
        Spine: [-2, 6, 0], Spine1: [-4, 10, 0], Spine2: [-2, 8, 0],
        Neck: [4, 0, 0], Head: [17, 0, 0],
        LeftArm: [15, 0, 35], LeftForeArm: [5, 0, -20], RightArm: [45, 0, 5], RightForeArm: [-5, 0, 15],
        LeftUpLeg: [8, 0, 0], LeftLeg: [-20, 0, 0], LeftFoot: [-6, 0, 0],
      }, hips: [0, -0.02, 0] },
      { t: 0.4, pose: {
        RightUpLeg: [80, 0, 0], RightLeg: [-10, 0, 0], RightFoot: [32, 0, 0],
        Hips: [0, 8, 0],
        Spine: [0, 8, 0], Spine1: [2, 14, 0], Spine2: [0, 10, 0],
        Neck: [3, 0, 0], Head: [18, 0, 0],
        LeftArm: [20, 0, 25], LeftForeArm: [-5, 0, -30], RightArm: [50, 0, -20], RightForeArm: [10, 0, -12],
        LeftUpLeg: [6, 0, 0], LeftLeg: [-14, 0, 0], LeftFoot: [-4, 0, 0],
      }, hips: [0, 0, 0] },
      { t: 0.62, pose: {
        RightUpLeg: [58, 0, 0], RightLeg: [-34, 0, 0],
        Hips: [0, 14, 0],
        Spine: [2, 6, 0], Spine1: [8, 10, 0], Spine2: [3, 6, 0],
        Head: [6, 0, 0],
        LeftArm: [40, 0, 15], LeftForeArm: [-10, 0, -25], RightArm: [60, 0, -35], RightForeArm: [20, 0, -15],
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
      { t: 0.18, pose: { RightUpLeg: [18, 0, 0], RightLeg: [-25, 0, 0], Spine1: [4, 0, 0], Spine2: [2, 0, 0], Head: [-4, 0, 0], LeftLeg: [-16, 0, 0], LeftArm: [50, 0, 15], LeftForeArm: [15, 0, 30], RightArm: [55, 0, -10], RightForeArm: [0, 0, -25] } },
      // clé de contact posée SUR la trajectoire (valeurs interpolées 0,18→0,36) : le talon frappe en
      // TRAVERSANT, à 0,19 le balayage arrière est lancé et ne s'arrête pas là
      { t: 0.19, pose: { RightUpLeg: [15.4, 0, 0], RightLeg: [-29.4, 0, 0], Spine1: [4.3, 0, 0], Spine2: [2.1, 0, 0], Head: [-4.1, 0, 0], LeftLeg: [-15.8, 0, 0], LeftArm: [49.4, 0, 15.6], LeftForeArm: [15.3, 0, 30.3], RightArm: [54.4, 0, -10.6], RightForeArm: [0.6, 0, -25] } },
      { t: 0.36, pose: { RightUpLeg: [-28, 0, 0], RightLeg: [-105, 0, 0], RightFoot: [20, 0, 0], Spine1: [10, 0, 0], Spine2: [4, 0, 0], Head: [-6, 0, 0], LeftLeg: [-12, 0, 0], LeftArm: [40, 0, 25], LeftForeArm: [20, 0, 35], RightArm: [45, 0, -20], RightForeArm: [10, 0, -25] } },
      { t: 0.65, pose: {} },
    ] },
  /** CHEST CONTROL (once): arch back, chest puffed, arms open, soft knees */
  amorti: {
    name: 'amorti', duration: 1.0, contact: 0.3, loop: false,
    keys: [
      { t: 0.0, pose: {} },
      { t: 0.3, pose: { Spine1: [-18, 0, 0], Head: [-10, 0, 0], LeftUpLeg: [14, 0, 0], RightUpLeg: [14, 0, 0], LeftLeg: [-24, 0, 0], RightLeg: [-24, 0, 0] }, hips: [0, -0.07, 0] },
      { t: 0.55, pose: { Spine1: [-6, 0, 0], LeftLeg: [-14, 0, 0], RightLeg: [-14, 0, 0] }, hips: [0, -0.03, 0] },
      { t: 1.0, pose: {}, hips: [0, 0, 0] },
    ] },
  /** GOALKEEPER DIVE (once, root motion): crouch, launch to the right, lay out, spring back up */
  plongeon: {
    name: 'plongeon', duration: 1.6, contact: 0.55, loop: false,   // 0,55 = l'extension — le moment des gants
    rise: 1.2,   // l'instant où le RELEVÉ commence — la scène gèle ici pendant le sol (gk.rise), puis
                 // rejoue la queue sur la durée du relevé sim (0,9-1,6 s selon l'agilité — lot 91)
    keys: [
      { t: 0.0, pose: {}, hips: [0, 0, 0] },
      { t: 0.25, pose: { LeftUpLeg: [55, 0, 0], RightUpLeg: [55, 0, 0], LeftLeg: [-75, 0, 0], RightLeg: [-75, 0, 0], Spine1: [16, 0, 0] }, hips: [0, -0.26, 0] },
      { t: 0.55, pose: { Hips: [0, 0, -62], LeftArm: [-20, 0, -68], RightArm: [-20, 0, -72], LeftForeArm: [0, 0, 8], RightForeArm: [0, 0, 8], LeftUpLeg: [12, 0, 0], RightUpLeg: [16, 0, 0], LeftLeg: [-12, 0, 0], RightLeg: [-18, 0, 0], Spine1: [-6, 0, 0] }, hips: [0.85, 0.28, 0] },
      { t: 0.9, pose: { Hips: [0, 0, -80], LeftArm: [-15, 0, -70], RightArm: [-15, 0, -74], LeftUpLeg: [10, 0, 0], RightUpLeg: [14, 0, 0], Spine1: [0, 0, 0] }, hips: [1.35, -0.68, 0] },
      { t: 1.2, pose: { Hips: [0, 0, -80], LeftArm: [-10, 0, -60], RightArm: [-10, 0, -64] }, hips: [1.35, -0.68, 0] },
      // le relevé se joue SUR PLACE (hanches x tenues à 1,35 : les ramener à 0 faisait RECULER le
      // corps rendu — la sim est transportée au même point par le lunge, le fondu part d'un delta
      // ≈ 0) ET PAR ÉTAPES (lot 91) : rouler → appui bras → genou → debout. La catapulte d'hier :
      // couché → debout en UN segment, fondu de couche par-dessus (700°/s de tronc mesurés).
      { t: 1.28, pose: { Hips: [0, 0, -60], LeftArm: [-40, 0, -30], RightArm: [-40, 0, -34], LeftForeArm: [-20, 0, 10], RightForeArm: [-20, 0, 10], LeftUpLeg: [30, 0, 0], RightUpLeg: [34, 0, 0], LeftLeg: [-45, 0, 0], RightLeg: [-50, 0, 0], Spine1: [10, 0, 0] }, hips: [1.35, -0.6, 0] },
      { t: 1.4, pose: { Hips: [0, 0, -35], Spine1: [22, 0, 0], LeftArm: [30, 0, -10], RightArm: [30, 0, -12], LeftForeArm: [-16, 0, 9], RightForeArm: [-16, 0, 9], LeftUpLeg: [58, 0, 0], RightUpLeg: [40, 0, 0], LeftLeg: [-74, 0, 0], RightLeg: [-58, 0, 0], Head: [8, 0, 0] }, hips: [1.35, -0.42, 0] },
      { t: 1.51, pose: { Hips: [0, 0, -13], Spine1: [12, 0, 0], LeftArm: [52, 0, -4], RightArm: [52, 0, -5], LeftUpLeg: [66, 0, 0], RightUpLeg: [26, 0, 0], LeftLeg: [-84, 0, 0], RightLeg: [-34, 0, 0], Head: [4, 0, 0] }, hips: [1.35, -0.2, 0] },
      { t: 1.6, pose: {}, hips: [1.35, 0, 0] },
    ],
  },
  plongeonBas: {
    // LE PLONGEON BAS — l'espèce qui manquait : le clip unique était AÉRIEN (hanches +0,28 à
    // l'extension, un saut), donc sur un ballon AU SOL l'épaule restait à 1,2 m et aucun bras
    // n'atteignait le ballon (mesuré au composé : gant à ~1,0 m à l'instant de la prise, warp
    // saturé à sa borne). Ici les hanches DESCENDENT (−0,5 à l'extension, −0,72 au tapis), le
    // corps se couche, les bras rasent le sol — la sim choisit l'espèce par cross.y.
    name: 'plongeonBas', duration: 1.4, contact: 0.5, loop: false,
    rise: 1.1,   // le début du relevé (même loi que l'aérien — la scène gèle/rejoue par gk.rise)
    keys: [
      { t: 0.0, pose: {}, hips: [0, 0, 0] },
      { t: 0.2, pose: {
        LeftUpLeg: [62, 0, 0], RightUpLeg: [62, 0, 0], LeftLeg: [-84, 0, 0], RightLeg: [-84, 0, 0],
        Spine1: [20, 0, 0], Head: [10, 0, 0],
        LeftArm: [30, 0, -20], RightArm: [30, 0, -25], LeftForeArm: [15, 0, 10], RightForeArm: [15, 0, 10],
      }, hips: [0, -0.34, 0] },
      { t: 0.5, pose: {
        Hips: [0, 0, -70],
        LeftArm: [-10, 0, -58], RightArm: [-10, 0, -62], LeftForeArm: [0, 0, 8], RightForeArm: [0, 0, 8],
        LeftUpLeg: [14, 0, 0], RightUpLeg: [18, 0, 0], LeftLeg: [-14, 0, 0], RightLeg: [-20, 0, 0],
        Spine1: [-4, 0, 0], Head: [6, 0, 0],
      }, hips: [0.8, -0.5, 0] },
      { t: 0.85, pose: {
        Hips: [0, 0, -82],
        LeftArm: [-8, 0, -60], RightArm: [-8, 0, -64],
        LeftUpLeg: [12, 0, 0], RightUpLeg: [16, 0, 0], Spine1: [0, 0, 0],
      }, hips: [1.15, -0.72, 0] },
      { t: 1.1, pose: { Hips: [0, 0, -82], LeftArm: [-6, 0, -52], RightArm: [-6, 0, -56] }, hips: [1.15, -0.72, 0] },
      // le relevé SUR PLACE et PAR ÉTAPES (lot 91) : rouler → appui bras → genou → debout
      { t: 1.18, pose: { Hips: [0, 0, -62], LeftArm: [-38, 0, -28], RightArm: [-38, 0, -32], LeftForeArm: [-18, 0, 10], RightForeArm: [-18, 0, 10], LeftUpLeg: [32, 0, 0], RightUpLeg: [36, 0, 0], LeftLeg: [-48, 0, 0], RightLeg: [-52, 0, 0], Spine1: [8, 0, 0] }, hips: [1.15, -0.62, 0] },
      { t: 1.27, pose: { Hips: [0, 0, -36], Spine1: [20, 0, 0], LeftArm: [20, 0, -12], RightArm: [20, 0, -14], LeftForeArm: [-15, 0, 9], RightForeArm: [-15, 0, 9], LeftUpLeg: [56, 0, 0], RightUpLeg: [38, 0, 0], LeftLeg: [-72, 0, 0], RightLeg: [-56, 0, 0], Head: [8, 0, 0] }, hips: [1.15, -0.44, 0] },
      { t: 1.34, pose: { Hips: [0, 0, -13], Spine1: [11, 0, 0], LeftArm: [50, 0, -5], RightArm: [50, 0, -6], LeftUpLeg: [64, 0, 0], RightUpLeg: [24, 0, 0], LeftLeg: [-82, 0, 0], RightLeg: [-32, 0, 0] }, hips: [1.15, -0.21, 0] },
      { t: 1.4, pose: {}, hips: [1.15, 0, 0] },
    ],
  },
  /** LA FRAPPE PUISSANTE (lot 93) : l'élan AMPLE — 13/16 tirs mesurés s'habillaient en passeRapide
   *  (l'armé court d'une petite passe pour un ballon à 21 m/s). Ici : armé plus profond que `frappe`
   *  (cuisse −38, genou −120), buste plus arrière (−20), bras plus hauts, traversée qui EMMÈNE le
   *  corps (overshoot cuisse 88) — la même biomécanique proximo-distale, amplifiée. */
  frappePuissante: {
    name: 'frappePuissante', duration: 1.0, contact: 0.45, loop: false,
    keys: [
      { t: 0.0, pose: {} },
      { t: 0.32, pose: {
        RightUpLeg: [-38, 0, 0], RightLeg: [-120, 0, 0], RightFoot: [30, 0, 0],
        Hips: [0, -18, 0],
        Spine: [-6, -9, 0], Spine1: [-11, -9, 0], Spine2: [-5, -7, 0],
        Neck: [5, 0, 0], Head: [17, 0, 0],
        LeftArm: [52, 0, 52], LeftForeArm: [40, 0, 38], RightArm: [46, 0, 44], RightForeArm: [-12, 0, -22],
        LeftUpLeg: [12, 0, 0], LeftLeg: [-30, 0, 0], LeftFoot: [-9, 0, 0],
      }, hips: [0, -0.07, 0] },
      // la clé de contact SUR la trajectoire — le pied traverse, l'overshoot (0,52) continue le balayage
      { t: 0.45, pose: {
        RightUpLeg: [66, 0, 0], RightLeg: [-58, 0, 0], RightFoot: [32, 0, 0],
        Hips: [0, 7, 0],
        Spine: [-2, 7, 0], Spine1: [-4, 11, 0], Spine2: [-2, 9, 0],
        Neck: [4, 0, 0], Head: [18, 0, 0],
        LeftArm: [16, 0, 38], LeftForeArm: [6, 0, -22], RightArm: [48, 0, 6], RightForeArm: [-6, 0, 16],
        LeftUpLeg: [9, 0, 0], LeftLeg: [-22, 0, 0], LeftFoot: [-7, 0, 0],
      }, hips: [0, -0.03, 0] },
      { t: 0.52, pose: {
        RightUpLeg: [88, 0, 0], RightLeg: [-8, 0, 0], RightFoot: [34, 0, 0],
        Hips: [0, 10, 0],
        Spine: [0, 9, 0], Spine1: [3, 16, 0], Spine2: [1, 11, 0],
        Neck: [3, 0, 0], Head: [18, 0, 0],
        LeftArm: [22, 0, 26], LeftForeArm: [-6, 0, -32], RightArm: [54, 0, -24], RightForeArm: [12, 0, -14],
        LeftUpLeg: [7, 0, 0], LeftLeg: [-15, 0, 0], LeftFoot: [-5, 0, 0],
      }, hips: [0, 0.01, 0] },
      { t: 0.74, pose: {
        RightUpLeg: [60, 0, 0], RightLeg: [-36, 0, 0],
        Hips: [0, 16, 0],
        Spine: [2, 7, 0], Spine1: [9, 11, 0], Spine2: [3, 7, 0],
        Head: [7, 0, 0],
        LeftArm: [42, 0, 16], LeftForeArm: [-10, 0, -26], RightArm: [62, 0, -36], RightForeArm: [22, 0, -16],
        LeftLeg: [-13, 0, 0],
      }, hips: [0, 0.02, 0] },
      { t: 1.0, pose: {} },
    ],
  },
  /** LA FRAPPE ENROULÉE (lot 93) : l'INTÉRIEUR ENVELOPPE — le corps s'ouvre et penche du côté
   *  opposé, la jambe balaye EN TRAVERS (adduction z), la traversée finit CROISÉE devant le corps
   *  avec les hanches qui tournent — la signature du curler (placé/croisé/enroulée). */
  frappeEnroulee: {
    name: 'frappeEnroulee', duration: 0.9, contact: 0.38, loop: false,
    keys: [
      { t: 0.0, pose: {} },
      { t: 0.27, pose: {
        RightUpLeg: [-28, 0, -10], RightLeg: [-100, 0, 0], RightFoot: [24, 0, 0],
        Hips: [0, -14, 0],
        Spine: [-4, -7, -6], Spine1: [-7, -7, -8], Spine2: [-3, -5, -5],
        Neck: [4, 0, 0], Head: [15, 0, 4],
        LeftArm: [45, 0, 48], LeftForeArm: [32, 0, 34], RightArm: [38, 0, 36], RightForeArm: [-8, 0, -18],
        LeftUpLeg: [10, 0, 0], LeftLeg: [-25, 0, 0], LeftFoot: [-8, 0, 0],
      }, hips: [0, -0.05, 0] },
      // contact SUR la trajectoire : l'intérieur du pied, jambe qui traverse VERS L'INTÉRIEUR
      { t: 0.38, pose: {
        RightUpLeg: [50, 0, -22], RightLeg: [-55, 0, 0], RightFoot: [26, 12, 0],
        Hips: [0, 10, 0],
        Spine: [-2, 8, -8], Spine1: [-4, 12, -10], Spine2: [-2, 9, -6],
        Neck: [4, 0, 0], Head: [16, 0, 5],
        LeftArm: [18, 0, 40], LeftForeArm: [4, 0, -20], RightArm: [44, 0, 8], RightForeArm: [-4, 0, 14],
        LeftUpLeg: [8, 0, 0], LeftLeg: [-18, 0, 0], LeftFoot: [-6, 0, 0],
      }, hips: [0, -0.02, 0] },
      { t: 0.46, pose: {
        RightUpLeg: [64, 0, -34], RightLeg: [-14, 0, 0], RightFoot: [28, 16, 0],
        Hips: [0, 22, 0],
        Spine: [0, 12, -9], Spine1: [2, 18, -11], Spine2: [0, 12, -7],
        Head: [14, 0, 6],
        LeftArm: [24, 0, 28], LeftForeArm: [-6, 0, -28], RightArm: [50, 0, -18], RightForeArm: [10, 0, -12],
        LeftUpLeg: [6, 0, 0], LeftLeg: [-13, 0, 0],
      }, hips: [0, 0, 0] },
      { t: 0.66, pose: {
        RightUpLeg: [46, 0, -20], RightLeg: [-30, 0, 0],
        Hips: [0, 26, 0],
        Spine: [2, 9, -5], Spine1: [7, 13, -6], Spine2: [3, 8, -4],
        Head: [6, 0, 3],
        LeftArm: [40, 0, 16], LeftForeArm: [-8, 0, -24], RightArm: [56, 0, -30], RightForeArm: [18, 0, -14],
        LeftLeg: [-12, 0, 0],
      }, hips: [0, 0.02, 0] },
      { t: 0.9, pose: {} },
    ],
  },
  /** LE POINTU (lot 93) : le bout du pied SANS élan lisible — l'arme des petits espaces. Armé
   *  minuscule (cuisse −14), extension sèche du genou, corps droit, récupération courte : rien
   *  à lire pour le gardien ni pour le contreur — c'est TOUT le geste. */
  frappePointu: {
    name: 'frappePointu', duration: 0.5, contact: 0.18, loop: false,
    keys: [
      { t: 0.0, pose: {} },
      { t: 0.11, pose: {
        RightUpLeg: [-14, 0, 0], RightLeg: [-48, 0, 0], RightFoot: [18, 0, 0],
        Spine1: [-4, -3, 0], Head: [12, 0, 0],
        LeftArm: [40, 0, 22], RightArm: [42, 0, 12],
        LeftLeg: [-16, 0, 0],
      }, hips: [0, -0.03, 0] },
      // le contact : genou qui claque, pointe tendue — la traversée est COURTE (0,24) par nature
      { t: 0.18, pose: {
        RightUpLeg: [26, 0, 0], RightLeg: [-16, 0, 0], RightFoot: [34, 0, 0],
        Spine1: [-1, 2, 0], Head: [14, 0, 0],
        LeftArm: [28, 0, 26], RightArm: [46, 0, 2],
        LeftLeg: [-14, 0, 0],
      }, hips: [0, -0.02, 0] },
      { t: 0.24, pose: {
        RightUpLeg: [36, 0, 0], RightLeg: [-10, 0, 0], RightFoot: [30, 0, 0],
        Spine1: [1, 3, 0], LeftArm: [30, 0, 20], RightArm: [48, 0, -6],
        LeftLeg: [-12, 0, 0],
      }, hips: [0, -0.01, 0] },
      { t: 0.5, pose: {} },
    ],
  },
  /** LA PARADE À UNE MAIN (lot 93) : le plongeon LOIN — même corps que `plongeon` (détente,
   *  couché, relevé par étapes lot 91), mais le bras du DESSUS seul est tendu à fond (+0,15 m
   *  d'envergure) et l'autre replié sur la poitrine : l'espèce du bout de gants (mains: 1). */
  plongeonUneMain: {
    name: 'plongeonUneMain', duration: 1.6, contact: 0.55, loop: false,
    rise: 1.2,
    keys: [
      { t: 0.0, pose: {}, hips: [0, 0, 0] },
      { t: 0.25, pose: { LeftUpLeg: [55, 0, 0], RightUpLeg: [55, 0, 0], LeftLeg: [-75, 0, 0], RightLeg: [-75, 0, 0], Spine1: [16, 0, 0] }, hips: [0, -0.26, 0] },
      { t: 0.55, pose: { Hips: [0, 0, -64], RightArm: [-24, 0, -86], RightForeArm: [0, 0, 2], LeftArm: [-6, 0, -22], LeftForeArm: [0, 55, 24], LeftUpLeg: [12, 0, 0], RightUpLeg: [16, 0, 0], LeftLeg: [-12, 0, 0], RightLeg: [-18, 0, 0], Spine1: [-6, 0, 0] }, hips: [0.95, 0.26, 0] },
      { t: 0.9, pose: { Hips: [0, 0, -82], RightArm: [-18, 0, -84], LeftArm: [-4, 0, -20], LeftForeArm: [0, 50, 22], LeftUpLeg: [10, 0, 0], RightUpLeg: [14, 0, 0], Spine1: [0, 0, 0] }, hips: [1.5, -0.68, 0] },
      { t: 1.2, pose: { Hips: [0, 0, -82], RightArm: [-12, 0, -70], LeftArm: [-2, 0, -18], LeftForeArm: [0, 45, 20] }, hips: [1.5, -0.68, 0] },
      // le relevé SUR PLACE et PAR ÉTAPES (lot 91) : rouler → appui bras → genou → debout
      { t: 1.28, pose: { Hips: [0, 0, -60], RightArm: [-40, 0, -34], LeftArm: [-38, 0, -28], LeftForeArm: [-18, 0, 10], RightForeArm: [-20, 0, 10], LeftUpLeg: [30, 0, 0], RightUpLeg: [34, 0, 0], LeftLeg: [-45, 0, 0], RightLeg: [-50, 0, 0], Spine1: [10, 0, 0] }, hips: [1.5, -0.6, 0] },
      { t: 1.4, pose: { Hips: [0, 0, -35], Spine1: [22, 0, 0], LeftArm: [30, 0, -10], RightArm: [30, 0, -12], LeftForeArm: [-16, 0, 9], RightForeArm: [-16, 0, 9], LeftUpLeg: [58, 0, 0], RightUpLeg: [40, 0, 0], LeftLeg: [-74, 0, 0], RightLeg: [-58, 0, 0], Head: [8, 0, 0] }, hips: [1.5, -0.42, 0] },
      { t: 1.51, pose: { Hips: [0, 0, -13], Spine1: [12, 0, 0], LeftArm: [52, 0, -4], RightArm: [52, 0, -5], LeftUpLeg: [66, 0, 0], RightUpLeg: [26, 0, 0], LeftLeg: [-84, 0, 0], RightLeg: [-34, 0, 0], Head: [4, 0, 0] }, hips: [1.5, -0.2, 0] },
      { t: 1.6, pose: {}, hips: [1.5, 0, 0] },
    ],
  },
  /** LA PRISE AÉRIENNE (lot 93) : la DÉTENTE VERTICALE de prise — l'ÉPAULE MONTE avec le saut,
   *  les DEUX bras au-dessus de la tête AVANT le contact (la dette des prises-réflexe : premier
   *  contact des gants à ~0,96 m parce que le clip de détente latérale n'avait pas les bras en
   *  l'air à temps). Retombe SUR SES APPUIS : pas de couché, pas de relevé (pas de champ rise). */
  plongeonPrise: {
    name: 'plongeonPrise', duration: 1.3, contact: 0.5, loop: false,
    keys: [
      { t: 0.0, pose: {}, hips: [0, 0, 0] },
      { t: 0.2, pose: { LeftUpLeg: [50, 0, 0], RightUpLeg: [50, 0, 0], LeftLeg: [-70, 0, 0], RightLeg: [-70, 0, 0], Spine1: [14, 0, 0], LeftArm: [30, 0, -20], RightArm: [30, 0, -24] }, hips: [0, -0.3, 0] },
      // l'extension : les bras PASSENT au-dessus de la tête pendant la montée — l'épaule y est déjà
      { t: 0.38, pose: { LeftArm: [-24, 0, -66], RightArm: [-24, 0, -70], LeftForeArm: [0, 0, 6], RightForeArm: [0, 0, 6], LeftUpLeg: [16, 0, 0], RightUpLeg: [20, 0, 0], LeftLeg: [-20, 0, 0], RightLeg: [-26, 0, 0], Spine1: [-8, 0, 0], Head: [10, 0, 0] }, hips: [0.3, 0.3, 0] },
      { t: 0.5, pose: { LeftArm: [-32, 0, -78], RightArm: [-32, 0, -82], LeftForeArm: [0, 0, 4], RightForeArm: [0, 0, 4], LeftUpLeg: [14, 0, 0], RightUpLeg: [18, 0, 0], LeftLeg: [-16, 0, 0], RightLeg: [-22, 0, 0], Spine1: [-10, 0, 0], Head: [12, 0, 0] }, hips: [0.5, 0.55, 0] },
      // la retombée : les gants REDESCENDENT AVEC le ballon tenu, genoux qui absorbent
      { t: 0.85, pose: { LeftArm: [10, 0, -30], RightArm: [10, 0, -34], LeftForeArm: [-40, 0, 14], RightForeArm: [-40, 0, 14], LeftUpLeg: [34, 0, 0], RightUpLeg: [34, 0, 0], LeftLeg: [-48, 0, 0], RightLeg: [-48, 0, 0], Spine1: [8, 0, 0] }, hips: [0.72, 0, 0] },
      { t: 1.05, pose: { LeftArm: [28, 0, -14], RightArm: [28, 0, -16], LeftForeArm: [-52, 0, 16], RightForeArm: [-52, 0, 16], LeftLeg: [-24, 0, 0], RightLeg: [-24, 0, 0], Spine1: [4, 0, 0] }, hips: [0.72, -0.04, 0] },
      { t: 1.3, pose: {}, hips: [0.72, 0, 0] },
    ],
  },
  /** LA PARADE DES PIEDS (lot 93, arrêt {mode:'pieds'}) : la jambe CLAQUE latérale tendue, le
   *  corps contre-penche, les bras équilibrent — le réflexe du bout portant au ras du sol. */
  paradePieds: {
    name: 'paradePieds', duration: 0.7, contact: 0.22, loop: false,
    keys: [
      { t: 0.0, pose: {} },
      { t: 0.12, pose: { RightUpLeg: [16, 0, -14], RightLeg: [-30, 0, 0], LeftLeg: [-18, 0, 0], Spine1: [6, 0, 6], LeftArm: [50, 0, 26], RightArm: [50, 0, -18] }, hips: [0, -0.05, 0] },
      { t: 0.22, pose: { RightUpLeg: [30, 0, -34], RightLeg: [-6, 0, 0], RightFoot: [22, 0, 0], LeftLeg: [-22, 0, 0], Spine1: [8, 0, 10], Head: [8, 0, -4], LeftArm: [58, 0, 34], LeftForeArm: [20, 0, 20], RightArm: [54, 0, -28] }, hips: [0, -0.08, 0] },
      { t: 0.4, pose: { RightUpLeg: [22, 0, -20], RightLeg: [-16, 0, 0], LeftLeg: [-18, 0, 0], Spine1: [6, 0, 5], LeftArm: [52, 0, 24], RightArm: [50, 0, -16] }, hips: [0, -0.05, 0] },
      { t: 0.7, pose: {} },
    ],
  },
  /** LE BLOCAGE DU BUSTE (lot 93, arrêt {mode:'buste'}) : la poitrine ENCAISSE le tir dans le
   *  corps — buste bombé, coudes serrés DEVANT (les avant-bras protègent, ils ne tendent pas),
   *  genoux souples ; le recul au contact, puis on se rassemble. Le patron inverse de l'amorti. */
  paradeBuste: {
    name: 'paradeBuste', duration: 0.8, contact: 0.3, loop: false,
    keys: [
      { t: 0.0, pose: {} },
      { t: 0.18, pose: { Spine1: [-12, 0, 0], Head: [-6, 0, 0], LeftArm: [26, 0, 30], RightArm: [26, 0, 28], LeftForeArm: [70, 0, 30], RightForeArm: [70, 0, -30], LeftUpLeg: [12, 0, 0], RightUpLeg: [12, 0, 0], LeftLeg: [-20, 0, 0], RightLeg: [-20, 0, 0] }, hips: [0, -0.06, 0] },
      // le contact : le buste prend, le corps RECULE d'un souffle — pas un geste de bras
      { t: 0.3, pose: { Spine1: [4, 0, 0], Head: [-2, 0, 0], LeftArm: [30, 0, 32], RightArm: [30, 0, 30], LeftForeArm: [76, 0, 32], RightForeArm: [76, 0, -32], LeftUpLeg: [14, 0, 0], RightUpLeg: [14, 0, 0], LeftLeg: [-24, 0, 0], RightLeg: [-24, 0, 0] }, hips: [-0.05, -0.08, 0] },
      { t: 0.52, pose: { Spine1: [-2, 0, 0], LeftArm: [34, 0, 24], RightArm: [34, 0, 22], LeftForeArm: [50, 0, 24], RightForeArm: [50, 0, -24], LeftLeg: [-16, 0, 0], RightLeg: [-16, 0, 0] }, hips: [0, -0.04, 0] },
      { t: 0.8, pose: {} },
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
      { t: 0.14, pose: { RightUpLeg: [-16, -6, 0], RightLeg: [-50, 0, 0], RightFoot: [0, -20, 0], Hips: [0, -5, 0], Spine1: [3, -6, 0], Spine2: [1, -4, 0], Neck: [2, 0, 0], Head: [13, 0, 0], LeftArm: [50, 0, 30], LeftForeArm: [25, 0, 35], RightArm: [45, 0, 30], RightForeArm: [0, 0, -25], LeftLeg: [-16, 0, 0] } },
      // le contact se TRAVERSE : la cuisse balaie 50° dans le segment d'approche et continue au même
      // rythme après — une clé de contact où le pied se gare mesure une vitesse nulle sur le ballon
      { t: 0.24, pose: { RightUpLeg: [38, 12, 0], RightLeg: [-16, 0, 0], RightFoot: [-6, -34, 0], Hips: [0, 4, 0], Spine1: [-2, 8, 0], Spine2: [0, 5, 0], Neck: [2, 0, 0], Head: [15, 0, 0], LeftArm: [20, 0, 20], LeftForeArm: [10, 0, 35], RightArm: [50, 0, -5], RightForeArm: [10, 0, -25], LeftLeg: [-12, 0, 0] } },
      { t: 0.3, pose: { RightUpLeg: [74, 14, 0], RightLeg: [-14, 0, 0], RightFoot: [-6, -30, 0], Hips: [0, 5, 0], Spine1: [-3, 8, 0], Spine2: [0, 5, 0], Neck: [2, 0, 0], Head: [15, 0, 0], LeftArm: [35, 0, 20], LeftForeArm: [20, 0, 30], RightArm: [60, 0, -25], RightForeArm: [18, 0, -25], LeftLeg: [-14, 0, 0] } },
      { t: 0.5, pose: {} },
    ] },
  passePivot: {
    // Se retourner AVEC le ballon : le bassin part en premier, les épaules suivent, et la frappe part
    // du pied intérieur en fin de rotation. Sans la rotation du buste, un « pivot » est une passe normale.
    name: 'passePivot', duration: 0.95, contact: 0.52, loop: false,
    keys: [
      { t: 0.0, pose: {} },
      // le BASSIN mène la rotation (il n'y était pas : un « pivot » du seul buste est une torsion,
      // pas un demi-tour), les épaules suivent, la tête cherche le ballon puis la cible
      { t: 0.22, pose: { Hips: [0, -22, 0], Spine: [0, -20, 0], Spine1: [4, -16, 0], Spine2: [2, -10, 0], Neck: [2, -8, 0], Head: [10, -18, 0], LeftUpLeg: [14, -18, 0], RightUpLeg: [-10, -12, 0], LeftLeg: [-18, 0, 0], LeftArm: [45, 0, 25], LeftForeArm: [20, 0, 30], RightArm: [50, 0, 10], RightForeArm: [0, 0, -25] } },
      // la jambe ATTEND pendant que le corps tourne : sans cette clé armée, la cuisse s'étale sur
      // 0,30 s (147°/s — une caresse) ; ici le balayage se concentre sur 0,44→0,52 puis TRAVERSE
      { t: 0.44, pose: { Hips: [0, -34, 0], Spine: [0, -30, 0], Spine1: [2, -22, 0], Spine2: [0, -13, 0], Neck: [2, -7, 0], Head: [12, -15, 0], RightUpLeg: [-12, -22, 0], RightLeg: [-58, 0, 0], RightFoot: [0, 12, 0], LeftUpLeg: [-2, -21, 0], LeftLeg: [-18, 0, 0], LeftArm: [35, 0, 30], LeftForeArm: [15, 0, 30], RightArm: [45, 0, 15], RightForeArm: [0, 0, -25] } },
      { t: 0.52, pose: { Hips: [0, -38, 0], Spine: [0, -34, 0], Spine1: [2, -24, 0], Spine2: [0, -14, 0], Neck: [2, -6, 0], Head: [12, -14, 0], RightUpLeg: [34, -26, 0], RightLeg: [-24, 0, 0], RightFoot: [0, 18, 0], LeftUpLeg: [-8, -22, 0], LeftLeg: [-20, 0, 0], LeftArm: [25, 0, 25], LeftForeArm: [10, 0, 30], RightArm: [50, 0, 0], RightForeArm: [10, 0, -25] } },
      { t: 0.585, pose: { Hips: [0, -40, 0], Spine: [0, -35, 0], Spine1: [0, -22, 0], Spine2: [0, -13, 0], Neck: [2, -6, 0], Head: [8, -10, 0], RightUpLeg: [72, -26, 0], RightLeg: [-16, 0, 0], RightFoot: [0, 16, 0], LeftUpLeg: [-10, -20, 0], LeftLeg: [-18, 0, 0], LeftArm: [35, 0, 20], LeftForeArm: [15, 0, 28], RightArm: [55, 0, -15], RightForeArm: [15, 0, -25] } },
      { t: 0.74, pose: { Hips: [0, -24, 0], Spine: [0, -22, 0], Spine1: [0, -16, 0], Spine2: [0, -8, 0], Head: [4, -6, 0], RightUpLeg: [16, -18, 0], RightLeg: [-34, 0, 0], LeftLeg: [-20, 0, 0], LeftArm: [50, 0, 10], LeftForeArm: [10, 0, 20], RightArm: [60, 0, -10], RightForeArm: [5, 0, -20] } },
      { t: 0.95, pose: {} },
    ] },
  deviation: {
    // Remise de première : rien ne s'arme, le pied se pose sur la trajectoire et redirige. Le geste le
    // plus court du répertoire — c'est ce qui le distingue à l'œil d'une passe classique.
    name: 'deviation', duration: 0.38, contact: 0.16, loop: false,
    keys: [
      { t: 0.0, pose: {} },
      // même une remise ACCOMPAGNE : la surface se présente (0→0,13) puis pousse À TRAVERS le point de
      // contact — un pied figé au contact rend une vitesse nulle et le ballon traverse une statue
      { t: 0.13, pose: { RightUpLeg: [8, -18, 0], RightLeg: [-24, 0, 0], RightFoot: [0, 26, 0], Hips: [0, -6, 0], Spine1: [-3, -7, 0], Spine2: [0, -4, 0], Head: [12, 0, 0], LeftLeg: [-13, 0, 0], LeftArm: [50, 0, 20], LeftForeArm: [20, 0, 30], RightArm: [50, 0, 5], RightForeArm: [0, 0, -25] } },
      { t: 0.16, pose: { RightUpLeg: [18, -22, 0], RightLeg: [-22, 0, 0], RightFoot: [0, 30, 0], Hips: [0, -7, 0], Spine1: [-3, -8, 0], Spine2: [0, -4, 0], Head: [12, 0, 0], LeftLeg: [-14, 0, 0], LeftArm: [40, 0, 25], LeftForeArm: [15, 0, 30], RightArm: [52, 0, 0], RightForeArm: [5, 0, -25] } },
      { t: 0.21, pose: { RightUpLeg: [31, -24, 0], RightLeg: [-24, 0, 0], RightFoot: [0, 30, 0], Hips: [0, -7, 0], Spine1: [-3, -8, 0], Spine2: [0, -4, 0], Head: [12, 0, 0], LeftLeg: [-14, 0, 0], LeftArm: [45, 0, 20], LeftForeArm: [18, 0, 28], RightArm: [55, 0, -5], RightForeArm: [5, 0, -22] } },
      { t: 0.38, pose: {} },
    ] },
  controleInterieur: {
    // Amorti de l'intérieur : le pied va CHERCHER le ballon puis recule avec lui pour absorber — le
    // retrait est tout le geste, un pied qui reste tendu renvoie le ballon au lieu de l'amortir.
    name: 'controleInterieur', duration: 0.62, contact: 0.2, loop: false,
    keys: [
      { t: 0.0, pose: {} },
      { t: 0.2, pose: { RightUpLeg: [26, -24, 0], RightLeg: [-28, 0, 0], RightFoot: [0, 34, 0], Hips: [0, -6, 0], Spine1: [6, -6, 0], Spine2: [2, -4, 0], Neck: [3, 0, 0], Head: [16, 0, 0], LeftArm: [50, 0, 20], LeftForeArm: [20, 0, 30], RightArm: [45, 0, 10], RightForeArm: [10, 0, -25], LeftLeg: [-18, 0, 0] } },
      { t: 0.36, pose: { RightUpLeg: [-6, -16, 0], RightLeg: [-52, 0, 0], RightFoot: [0, 26, 0], Hips: [0, -3, 0], Spine1: [10, -4, 0], Spine2: [3, -2, 0], Neck: [3, 0, 0], Head: [17, 0, 0], LeftArm: [50, 0, 15], LeftForeArm: [-15, 0, -35], RightArm: [50, 0, 0], RightForeArm: [5, 0, -25], LeftLeg: [-22, 0, 0] } },
      { t: 0.62, pose: {} },
    ],
  },
  controleExterieur: {
    // Contrôle extérieur : le corps reste ouvert, le ballon est emmené SUR LE CÔTÉ dans le mouvement.
    name: 'controleExterieur', duration: 0.6, contact: 0.22, loop: false,
    keys: [
      { t: 0.0, pose: {} },
      { t: 0.22, pose: { RightUpLeg: [14, 18, 0], RightLeg: [-30, 0, 0], RightFoot: [-6, -30, 0], Spine1: [4, 10, 0], Spine2: [2, 6, 0], Hips: [0, 12, 0], Head: [14, 6, 0], LeftLeg: [-16, 0, 0] } },
      { t: 0.4, pose: { RightUpLeg: [-4, 22, 0], RightLeg: [-48, 0, 0], RightFoot: [0, -20, 0], Hips: [0, 16, 0], Spine1: [3, 8, 0], Spine2: [1, 5, 0], Head: [15, 8, 0], LeftLeg: [-18, 0, 0] } },
      { t: 0.6, pose: {} },
    ] },
  controleSemelle: {
    // Semelle : la jambe se lève, la plante se pose SUR le ballon et l'arrête net. Le seul contrôle où
    // le pied arrive par le dessus — et donc le seul qu'on reconnaît de loin.
    name: 'controleSemelle', duration: 0.55, contact: 0.22, loop: false,
    keys: [
      { t: 0.0, pose: {} },
      { t: 0.22, pose: { RightUpLeg: [44, 0, 0], RightLeg: [-30, 0, 0], RightFoot: [22, 0, 0], Spine1: [10, 0, 0], Spine2: [4, 0, 0], Neck: [4, 0, 0], Head: [16, 0, 0], LeftLeg: [-14, 0, 0] }, hips: [0, -0.06, 0] },
      { t: 0.38, pose: { RightUpLeg: [20, 0, 0], RightLeg: [-42, 0, 0], RightFoot: [10, 0, 0], Spine1: [6, 0, 0], Spine2: [2, 0, 0], Neck: [3, 0, 0], Head: [14, 0, 0], LeftLeg: [-16, 0, 0] }, hips: [0, -0.03, 0] },
      { t: 0.55, pose: {}, hips: [0, 0, 0] },
    ] },
  amortiCuisse: {
    // Cuisse : la jambe monte à l'horizontale, le buste part en arrière pour amortir, et le ballon
    // retombe devant. Entre le pied et la poitrine il manquait toute une hauteur de jeu.
    name: 'amortiCuisse', duration: 0.8, contact: 0.3, loop: false,
    keys: [
      { t: 0.0, pose: {} },
      { t: 0.3, pose: { RightUpLeg: [78, 0, 0], RightLeg: [-46, 0, 0], Spine1: [-14, 0, 0], Spine2: [-5, 0, 0], Neck: [-3, 0, 0], Head: [-8, 0, 0], LeftLeg: [-14, 0, 0] }, hips: [0, -0.04, 0] },
      { t: 0.5, pose: { RightUpLeg: [46, 0, 0], RightLeg: [-58, 0, 0], Spine1: [-6, 0, 0], Spine2: [-2, 0, 0], Neck: [2, 0, 0], Head: [10, 0, 0], LeftLeg: [-16, 0, 0] } },
      { t: 0.8, pose: {} },
    ] },
  tacleDebout: {
    // Tacle debout : on reste sur ses appuis, le corps se baisse, la jambe la plus proche se tend vers
    // le ballon. Ce n'est PAS un tacle glissé — le bassin ne quitte jamais la verticale, et c'est
    // exactement la différence qu'on doit voir.
    name: 'tacleDebout', duration: 0.7, contact: 0.28, loop: false,
    keys: [
      { t: 0.0, pose: {} },
      { t: 0.28, pose: { RightUpLeg: [52, -10, 0], RightLeg: [-20, 0, 0], RightFoot: [0, 26, 0], LeftUpLeg: [8, 0, 0], LeftLeg: [-58, 0, 0], Spine1: [24, -6, 0], Head: [-10, 0, 0] }, hips: [0, -0.14, 0.1] },
      { t: 0.48, pose: { RightUpLeg: [24, -6, 0], RightLeg: [-40, 0, 0], LeftLeg: [-40, 0, 0], Spine1: [14, 0, 0] }, hips: [0, -0.06, 0.05] },
      { t: 0.7, pose: {}, hips: [0, 0, 0] },
    ] },
  // LE TACLE GLISSÉ. Le seul geste du répertoire où le bassin quitte la verticale : on part en appui,
  // la jambe d'attaque se tend vers le ballon, la hanche descend et le corps se couche sur le côté,
  // puis on se relève. Sans le mouvement de bassin (hips), un tacle « glissé » est un joueur debout qui
  // tend une jambe — ce qui est exactement le tell qu'on cherche à éviter.
  tacle: {
    name: 'tacle', duration: 1.25, contact: 0.34, loop: false,
    keys: [
      { t: 0.0, pose: {}, hips: [0, 0, 0] },
      { t: 0.18, pose: { RightUpLeg: [25, 0, 0], RightLeg: [-55, 0, 0], LeftUpLeg: [12, 0, 0], Spine1: [16, 0, 0], LeftArm: [30, 0, 35], LeftForeArm: [25, 0, 30], RightArm: [30, 0, 0], RightForeArm: [-5, 0, 35] }, hips: [0, -0.18, 0.15] },
      { t: 0.34, pose: { RightUpLeg: [58, 0, -18], RightLeg: [-8, 0, 0], RightFoot: [18, 0, 0], LeftUpLeg: [-15, 0, -25], LeftLeg: [-95, 0, 0], Spine1: [8, 0, -28], Head: [0, 15, 0], LeftArm: [-20, 0, -15], LeftForeArm: [30, 0, 10], RightArm: [5, 0, -30], RightForeArm: [0, 0, -35] }, hips: [0.1, -0.62, 0.75] },
      { t: 0.62, pose: { RightUpLeg: [40, 0, -22], RightLeg: [-22, 0, 0], LeftUpLeg: [-5, 0, -30], LeftLeg: [-80, 0, 0], Spine1: [4, 0, -32], LeftArm: [-5, 0, -5], LeftForeArm: [0, 0, 25], RightArm: [25, 0, -35], RightForeArm: [10, 0, -35] }, hips: [0.16, -0.66, 1.05] },
      { t: 0.95, pose: { RightUpLeg: [15, 0, -8], RightLeg: [-45, 0, 0], LeftUpLeg: [20, 0, -10], LeftLeg: [-60, 0, 0], Spine1: [18, 0, -10], LeftArm: [30, 0, 10], LeftForeArm: [10, 0, 30], RightArm: [40, 0, -15], RightForeArm: [-15, 0, 35] }, hips: [0.08, -0.42, 1.15] },
      { t: 1.25, pose: {}, hips: [0, 0, 1.2] },
    ],
  },
  retournee: {
    name: 'retournee', duration: 1.35, contact: 0.52, loop: false,
    keys: [
      { t: 0.0, pose: {}, hips: [0, 0, 0] },
      { t: 0.22, pose: { LeftUpLeg: [48, 0, 0], RightUpLeg: [48, 0, 0], LeftLeg: [-62, 0, 0], RightLeg: [-62, 0, 0], Spine1: [14, 0, 0] }, hips: [0, -0.22, 0] },
      { t: 0.52, pose: { Hips: [-95, 0, 0], RightUpLeg: [115, 0, 0], RightLeg: [-18, 0, 0], LeftUpLeg: [35, 0, 0], LeftLeg: [-45, 0, 0], Spine1: [-10, 0, 0], Head: [-15, 0, 0] }, hips: [0, 0.62, -0.18] },
      { t: 0.8, pose: { Hips: [-60, 0, 0], RightUpLeg: [55, 0, 0], RightLeg: [-40, 0, 0], LeftUpLeg: [60, 0, 0], LeftLeg: [-30, 0, 0] }, hips: [0, 0.1, -0.35] },
      { t: 1.05, pose: { LeftUpLeg: [45, 0, 0], RightUpLeg: [45, 0, 0], LeftLeg: [-60, 0, 0], RightLeg: [-60, 0, 0], Spine1: [12, 0, 0] }, hips: [0, -0.2, -0.42] },
      { t: 1.35, pose: {}, hips: [0, 0, -0.42] },
    ] },
  /** LE SAUT DE TÊTE (lot 112) — la dette du ciel payée : impulsion accroupie, extension
   *  verticale (hanches +0,38 au pic — la DÉTENTE se voit), le buste se CAMBRE en montant
   *  (l'armé du fouetté) puis FOUETTE au contact (Spine1 −14 → +16, Head −12 → +22 : c'est
   *  le cou qui frappe), bras en balancier, réception fléchie. Contact 0,42 = le pic. */
  tete: {
    name: 'tete', duration: 0.9, contact: 0.42, loop: false,
    keys: [
      { t: 0.0, pose: {}, hips: [0, 0, 0] },
      { t: 0.14, pose: { LeftUpLeg: [32, 0, 0], RightUpLeg: [32, 0, 0], LeftLeg: [-48, 0, 0], RightLeg: [-48, 0, 0], Spine1: [18, 0, 0], LeftArm: [22, 0, -8], RightArm: [22, 0, 8] }, hips: [0, -0.14, 0] },
      { t: 0.3, pose: { LeftUpLeg: [12, 0, 0], RightUpLeg: [12, 0, 0], LeftLeg: [-18, 0, 0], RightLeg: [-18, 0, 0], Spine1: [-14, 0, 0], Head: [-12, 0, 0], LeftArm: [-38, 0, 28], RightArm: [-38, 0, -28], LeftForeArm: [0, 0, 24], RightForeArm: [0, 0, -24] }, hips: [0, 0.22, 0] },
      { t: 0.42, pose: { LeftUpLeg: [4, 0, 0], RightUpLeg: [4, 0, 0], LeftLeg: [-8, 0, 0], RightLeg: [-8, 0, 0], Spine1: [16, 0, 0], Head: [22, 0, 0], LeftArm: [-8, 0, 18], RightArm: [-8, 0, -18] }, hips: [0, 0.38, 0] },
      { t: 0.56, pose: { LeftUpLeg: [18, 0, 0], RightUpLeg: [18, 0, 0], LeftLeg: [-26, 0, 0], RightLeg: [-26, 0, 0], Spine1: [8, 0, 0], Head: [6, 0, 0] }, hips: [0, 0.16, 0] },
      { t: 0.72, pose: { LeftUpLeg: [30, 0, 0], RightUpLeg: [30, 0, 0], LeftLeg: [-42, 0, 0], RightLeg: [-42, 0, 0], Spine1: [12, 0, 0] }, hips: [0, -0.1, 0] },
      { t: 0.9, pose: {}, hips: [0, 0, 0] },
    ] },
  /** LA TÊTE DEBOUT (lot 112) — le contact sous 2,2 m n'a pas besoin de détente : le buste
   *  se cambre court (l'armé), le cou fouette, l'accompagnement retombe. Les jambes restent
   *  à la locomotion (aucune clé de jambe : la couche fond le haut du corps seulement). */
  teteDebout: {
    name: 'teteDebout', duration: 0.55, contact: 0.22, loop: false,
    keys: [
      { t: 0.0, pose: {}, hips: [0, 0, 0] },
      { t: 0.1, pose: { Spine1: [-12, 0, 0], Head: [-14, 0, 0] }, hips: [0, -0.02, 0] },
      { t: 0.22, pose: { Spine1: [14, 0, 0], Head: [20, 0, 0] }, hips: [0, 0.01, 0] },
      { t: 0.38, pose: { Spine1: [8, 0, 0], Head: [8, 0, 0] }, hips: [0, 0, 0] },
      { t: 0.55, pose: {}, hips: [0, 0, 0] },
    ] },
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
        LeftArm: [50, 0, 30], LeftForeArm: [25, 0, 35], RightArm: [45, 0, 30], RightForeArm: [0, 0, -25],
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
        LeftArm: [35, 0, 25], LeftForeArm: [20, 0, 35], RightArm: [50, 0, 10], RightForeArm: [-5, 0, -25],
        LeftUpLeg: [6, 0, 0], LeftLeg: [-18, 0, 0], LeftFoot: [-5, 0, 0],
      } },
      { t: 0.38, pose: {
        RightUpLeg: [46, -30, 0], RightLeg: [-10, 0, 0], RightFoot: [28, 35, 0],
        Hips: [0, 4, 0],
        Spine: [0, 4, 0], Spine1: [-4, 8, 0], Spine2: [0, 6, 0],
        Neck: [2, 0, 0], Head: [16, 0, 0],
        LeftArm: [20, 0, 20], LeftForeArm: [10, 0, 35], RightArm: [50, 0, -5], RightForeArm: [20, 0, -25],
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
        LeftArm: [35, 0, 20], LeftForeArm: [20, 0, 30], RightArm: [60, 0, -25], RightForeArm: [30, 0, -25],
        LeftUpLeg: [5, 0, 0], LeftLeg: [-14, 0, 0], LeftFoot: [-3, 0, 0],
      } },
      { t: 0.7, pose: {} },
    ],
  },

  // ---- LES GESTES TECHNIQUES (intent 'carry' — le ballon ne part pas, il est manipulé) ----
  // Le lacet du retournement N'EST PAS DANS CES CLÉS : le corps est tourné par la SIM (loi 12 — le
  // visuel copie le lacet sim), le clip n'authore que les membres. C'est ce qui permet au même
  // râteau de sortir à 140° comme à 200° selon la géométrie du pressing.
  rateau: {
    // Le râteau : le pied va se poser SUR le ballon (contact 0,22 = la semelle agrippe), puis la
    // hanche BALAIE en arrière — extension + genou qui se plie : le ballon est raclé sous le corps
    // pendant que le buste s'enroule. La jambe d'appui fléchit (tout le poids est dessus).
    name: 'rateau', duration: 0.7, contact: 0.22, loop: false,
    keys: [
      { t: 0.0, pose: {} },
      { t: 0.22, pose: {
        RightUpLeg: [40, -6, 0], RightLeg: [-26, 0, 0], RightFoot: [24, 0, 0],
        Hips: [0, -6, 0],
        Spine: [-2, -3, 0], Spine1: [8, -5, 0], Spine2: [3, -3, 0],
        Neck: [3, 0, 0], Head: [15, 0, 0],
        LeftArm: [45, 0, 25], LeftForeArm: [20, 0, 30], RightArm: [50, 0, 15], RightForeArm: [5, 0, -20],
        LeftUpLeg: [6, 0, 0], LeftLeg: [-22, 0, 0], LeftFoot: [-6, 0, 0],
      }, hips: [0, -0.04, 0] },
      { t: 0.4, pose: {
        RightUpLeg: [-22, -12, 0], RightLeg: [-72, 0, 0], RightFoot: [30, 0, 0],
        Hips: [0, -14, 0],
        Spine: [-2, -6, 0], Spine1: [12, -10, 0], Spine2: [4, -6, 0],
        Neck: [3, 0, 0], Head: [16, 0, 0],
        LeftArm: [35, 0, 35], LeftForeArm: [15, 0, 30], RightArm: [55, 0, -10], RightForeArm: [10, 0, -20],
        LeftUpLeg: [10, 0, 0], LeftLeg: [-26, 0, 0], LeftFoot: [-7, 0, 0],
      }, hips: [0, -0.05, 0] },
      { t: 0.55, pose: {
        RightUpLeg: [8, -4, 0], RightLeg: [-40, 0, 0], RightFoot: [12, 0, 0],
        Hips: [0, -6, 0],
        Spine1: [6, -4, 0], Spine2: [2, -2, 0], Head: [12, 0, 0],
        LeftArm: [45, 0, 22], LeftForeArm: [15, 0, 25], RightArm: [50, 0, 5], RightForeArm: [5, 0, -20],
        LeftUpLeg: [8, 0, 0], LeftLeg: [-22, 0, 0],
      }, hips: [0, -0.02, 0] },
      { t: 0.7, pose: {} },
    ],
  },
  feintePasse: {
    // La feinte de passe VIT de sa ressemblance : l'armé est CELUI de `passe` (mêmes clés de
    // backswing — une clause du banc compare, un armé qui ne ressemble pas à la passe ne trompe
    // personne), et au « contact » (0,26) le geste SE RETIENT : la cuisse s'arrête à 6° au lieu de
    // traverser à 46°, le pied se relève — le swing meurt SUR le ballon au lieu de passer à
    // travers. C'est l'anti-overshoot : la signature mécanique de la feinte.
    // La rétraction est COURTE (0,14 s — mesuré : à 0,26 s de rétraction, la morsure du défenseur
    // (0,55 s) expirait AVANT que la vraie passe parte — l'avantage s'évaporait pile au moment
    // de servir ; à 0,14 s, le ballon part pendant que le mordu est encore assis).
    name: 'feintePasse', duration: 0.4, contact: 0.26, loop: false,
    keys: [
      { t: 0.0, pose: {} },
      { t: 0.18, pose: {
        RightUpLeg: [-18, -20, 0], RightLeg: [-56, 0, 0], RightFoot: [8, 15, 0],
        Hips: [0, -8, 0],
        Spine: [-2, -4, 0], Spine1: [2, -6, 0], Spine2: [-2, -4, 0],
        Neck: [3, 0, 0], Head: [14, 0, 0],
        LeftArm: [50, 0, 30], LeftForeArm: [25, 0, 35], RightArm: [45, 0, 30], RightForeArm: [0, 0, -25],
        LeftUpLeg: [8, 0, 0], LeftLeg: [-22, 0, 0], LeftFoot: [-6, 0, 0],
      }, hips: [0, -0.03, 0] },
      { t: 0.26, pose: {
        RightUpLeg: [6, -24, 0], RightLeg: [-38, 0, 0], RightFoot: [0, 18, 0],
        Hips: [0, -2, 0],
        Spine: [-1, -1, 0], Spine1: [0, 0, 0], Spine2: [0, 0, 0],
        Neck: [3, 0, 0], Head: [15, 0, 0],
        LeftArm: [40, 0, 25], LeftForeArm: [20, 0, 35], RightArm: [48, 0, 15], RightForeArm: [-2, 0, -25],
        LeftUpLeg: [6, 0, 0], LeftLeg: [-18, 0, 0], LeftFoot: [-5, 0, 0],
      } },
      { t: 0.32, pose: {
        RightUpLeg: [16, -14, 0], RightLeg: [-32, 0, 0], RightFoot: [4, 10, 0],
        Hips: [0, 2, 0],
        Spine1: [2, 2, 0], Head: [12, 0, 0],
        LeftArm: [48, 0, 20], LeftForeArm: [15, 0, 30], RightArm: [50, 0, 10], RightForeArm: [0, 0, -22],
        LeftLeg: [-16, 0, 0],
      } },
      { t: 0.4, pose: {} },
    ],
  },
  arretSemelle: {
    // Le ballon sous la semelle : la plante se POSE dessus (contact 0,24) et Y RESTE — deux clés
    // quasi identiques font la tenue. Pendant qu'elle dure, la TÊTE SE LÈVE (14° → −2°, regard au
    // jeu) : c'est exactement pour ça qu'un vrai joueur pose la semelle — le ballon est garé, les
    // yeux sont libres. Le seul clip du répertoire dont le sens est l'immobilité.
    name: 'arretSemelle', duration: 0.85, contact: 0.24, loop: false,
    keys: [
      { t: 0.0, pose: {} },
      { t: 0.24, pose: {
        RightUpLeg: [42, 0, 0], RightLeg: [-34, 0, 0], RightFoot: [22, 0, 0],
        Hips: [0, -4, 0],
        Spine1: [6, 0, 0], Spine2: [2, 0, 0], Neck: [3, 0, 0], Head: [14, 0, 0],
        LeftArm: [55, 0, 12], LeftForeArm: [10, 0, 18], RightArm: [55, 0, 8], RightForeArm: [5, 0, -12],
        LeftUpLeg: [4, 0, 0], LeftLeg: [-14, 0, 0], LeftFoot: [-4, 0, 0],
      }, hips: [0, -0.05, 0] },
      { t: 0.62, pose: {
        RightUpLeg: [40, 0, 0], RightLeg: [-32, 0, 0], RightFoot: [20, 0, 0],
        Hips: [0, -4, 0],
        Spine1: [4, 0, 0], Spine2: [1, 0, 0], Neck: [-2, 0, 0], Head: [-2, 8, 0],
        LeftArm: [55, 0, 12], LeftForeArm: [10, 0, 18], RightArm: [55, 0, 8], RightForeArm: [5, 0, -12],
        LeftUpLeg: [4, 0, 0], LeftLeg: [-15, 0, 0], LeftFoot: [-4, 0, 0],
      }, hips: [0, -0.05, 0] },
      { t: 0.85, pose: {} },
    ],
  },

  passementJambes: {
    // Le passement de jambes : la jambe DÉCRIT UN CERCLE PAR-DESSUS le ballon (extérieur →
    // intérieur), le buste PLONGE du côté de la feinte — c'est le buste qui vend, pas le pied —
    // puis le pied se PLANTE à côté du ballon et le poids repart de l'autre bord. Le ballon ne
    // bouge pas d'un centimètre (pin au contact — c'est le seul geste où l'immobilité du ballon
    // est la moitié du mensonge). L'appui reste fléchi et PLANTÉ tout du long (v = 0 en sim).
    // …RÉ-AUTHORÉ lot 110 (« les passements jamais vus » — le clip jouait mais illisible :
    // arc latéral de jambe ~14° et buste 4-8°, invisibles à distance de régie). Le cercle
    // balaie large (~60° d'arc), le genou MONTE (le pied passe clairement au-dessus), le
    // BUSTE PLONGE côté feinte (±15° — c'est lui qui vend), le bassin pivote, le centre de
    // gravité s'abaisse (−0,07). Durée 0,66 : le tour respire sans casser le lancé.
    name: 'passementJambes', duration: 0.66, contact: 0.3, loop: false,
    keys: [
      { t: 0.0, pose: {} },
      { t: 0.15, pose: {
        RightUpLeg: [52, -30, 0], RightLeg: [-72, 0, 0], RightFoot: [24, 16, 0],
        Hips: [0, -18, 0],
        Spine: [-4, -10, 9], Spine1: [10, -16, 12], Spine2: [4, -9, 6],
        Neck: [4, 4, 0], Head: [15, 5, 0],
        LeftArm: [58, 0, 38], LeftForeArm: [26, 0, 36], RightArm: [38, 0, 30], RightForeArm: [-6, 0, -26],
        LeftUpLeg: [10, 0, 0], LeftLeg: [-24, 0, 0], LeftFoot: [-6, 0, 0],
      }, hips: [0, -0.05, 0] },
      { t: 0.3, pose: {
        RightUpLeg: [58, -58, 0], RightLeg: [-76, 0, 0], RightFoot: [26, 22, 0],
        Hips: [0, -24, 0],
        Spine: [-4, -12, 11], Spine1: [14, -20, 15], Spine2: [5, -10, 7],
        Neck: [4, 5, 0], Head: [16, 6, 0],
        LeftArm: [62, 0, 44], LeftForeArm: [28, 0, 38], RightArm: [34, 0, 34], RightForeArm: [-8, 0, -26],
        LeftUpLeg: [12, 0, 0], LeftLeg: [-28, 0, 0], LeftFoot: [-7, 0, 0],
      }, hips: [0, -0.07, 0] },
      { t: 0.46, pose: {
        RightUpLeg: [20, 8, 0], RightLeg: [-32, 0, 0], RightFoot: [6, -6, 0],
        Hips: [0, 12, 0],
        Spine: [0, 6, -6], Spine1: [6, 12, -10], Spine2: [2, 6, -4],
        Neck: [2, -3, 0], Head: [12, -4, 0],
        LeftArm: [44, 0, 18], LeftForeArm: [12, 0, 24], RightArm: [54, 0, 8], RightForeArm: [6, 0, -18],
        LeftUpLeg: [8, 0, 0], LeftLeg: [-20, 0, 0], LeftFoot: [-5, 0, 0],
      }, hips: [0, -0.03, 0] },
      { t: 0.66, pose: {} },
    ],
  },
  crochet: {
    // Le crochet : l'intérieur du pied va CHERCHER le ballon de l'autre côté du corps (contact
    // 0,2 — l'adduction de hanche croise la ligne médiane) puis BALAIE — le lacet du pivot N'EST
    // PAS DANS CES CLÉS (le corps est tourné par la SIM, exactement comme le râteau : c'est ce
    // qui permet au même crochet de couper à 70° comme à 95° selon le défenseur). Le poids vit
    // sur l'appui fléchi, le buste s'abaisse dans la coupe puis se relève dans la relance.
    // …RÉ-AUTHORÉ lot 110 (même verdict que le passement : la coupe était timide). L'adduction
    // croise FRANCHEMENT (−45° d'arc), le buste S'ABAISSE dans la coupe (lean 12-16°), le
    // bassin s'assoit (−0,08) — le crochet se lit comme une cassure, pas comme un pas.
    name: 'crochet', duration: 0.55, contact: 0.2, loop: false,
    keys: [
      { t: 0.0, pose: {} },
      { t: 0.2, pose: {
        RightUpLeg: [46, -45, 0], RightLeg: [-56, 0, 0], RightFoot: [16, 30, 0],
        Hips: [0, -16, 0],
        Spine: [-4, -9, 8], Spine1: [10, -14, 12], Spine2: [4, -8, 6],
        Neck: [4, 3, 0], Head: [15, 4, 0],
        LeftArm: [58, 0, 36], LeftForeArm: [24, 0, 34], RightArm: [40, 0, 28], RightForeArm: [-4, 0, -24],
        LeftUpLeg: [10, 0, 0], LeftLeg: [-28, 0, 0], LeftFoot: [-7, 0, 0],
      }, hips: [0, -0.06, 0] },
      { t: 0.36, pose: {
        RightUpLeg: [26, 16, 0], RightLeg: [-42, 0, 0], RightFoot: [18, -10, 0],
        Hips: [0, 12, 0],
        Spine: [0, 7, -6], Spine1: [10, 12, -9], Spine2: [3, 7, -4],
        Neck: [2, -2, 0], Head: [13, -3, 0],
        LeftArm: [40, 0, 18], LeftForeArm: [10, 0, 22], RightArm: [56, 0, 4], RightForeArm: [8, 0, -18],
        LeftUpLeg: [12, 0, 0], LeftLeg: [-30, 0, 0], LeftFoot: [-8, 0, 0],
      }, hips: [0, -0.08, 0] },
      { t: 0.46, pose: {
        RightUpLeg: [10, 0, 0], RightLeg: [-24, 0, 0], RightFoot: [4, 0, 0],
        Hips: [0, 2, 0],
        Spine1: [4, 2, 0], Head: [10, 0, 0],
        LeftArm: [46, 0, 14], LeftForeArm: [8, 0, 20], RightArm: [50, 0, 8],
        LeftUpLeg: [6, 0, 0], LeftLeg: [-18, 0, 0],
      }, hips: [0, -0.02, 0] },
      { t: 0.55, pose: {} },
    ],
  },
  crochetCourt: {
    // LE CROCHET COURT (le chop — Yamal) : même grammaire que le crochet mais SEC — le pied
    // croise vite (contact 0,14), le buste n'a pas le temps de s'abaisser, la coupe est petite
    // (la sim tourne ~50° au lieu de ~80-95). C'est l'espèce du contact proche : on sort du pied
    // du défenseur en une demi-foulée, sans cérémonie.
    name: 'crochetCourt', duration: 0.4, contact: 0.14, loop: false,
    keys: [
      { t: 0.0, pose: {} },
      { t: 0.14, pose: {
        RightUpLeg: [30, -22, 0], RightLeg: [-40, 0, 0], RightFoot: [10, 20, 0],
        Hips: [0, -5, 0],
        Spine1: [4, -5, 2],
        Neck: [2, 0, 0], Head: [12, 0, 0],
        LeftArm: [46, 0, 20], LeftForeArm: [14, 0, 26], RightArm: [44, 0, 14], RightForeArm: [0, 0, -20],
        LeftUpLeg: [8, 0, 0], LeftLeg: [-20, 0, 0], LeftFoot: [-5, 0, 0],
      }, hips: [0, -0.03, 0] },
      { t: 0.26, pose: {
        RightUpLeg: [18, 8, 0], RightLeg: [-30, 0, 0], RightFoot: [10, -4, 0],
        Hips: [0, 4, 0],
        Spine1: [5, 4, -2], Head: [11, 0, 0],
        LeftArm: [42, 0, 16], RightArm: [48, 0, 8],
        LeftUpLeg: [8, 0, 0], LeftLeg: [-20, 0, 0],
      }, hips: [0, -0.03, 0] },
      { t: 0.4, pose: {} },
    ],
  },
  crochetChaloupe: {
    // LE CROCHET CHALOUPÉ (Dembélé) : le buste MENT d'abord — épaules et tête plongent du côté
    // où il ne va PAS (la chaloupe, 0-0,28, avec un vrai déport de bassin), le défenseur mord
    // (la sim le fait asseoir au contact), PUIS l'intérieur coupe large (contact 0,42, la sim
    // tourne ~95°). Le mensonge est dans les clés du HAUT : c'est lui qui vend, pas le pied.
    name: 'crochetChaloupe', duration: 0.8, contact: 0.42, loop: false,
    keys: [
      { t: 0.0, pose: {} },
      { t: 0.16, pose: {
        Spine: [0, 8, -6], Spine1: [6, 12, -8], Spine2: [2, 8, -4],
        Neck: [2, -6, 0], Head: [12, -8, 0],
        Hips: [0, 6, 0],
        RightUpLeg: [22, 14, 0], RightLeg: [-30, 0, 0], RightFoot: [8, -6, 0],
        LeftArm: [40, 0, 30], LeftForeArm: [16, 0, 28], RightArm: [55, 0, -6], RightForeArm: [4, 0, -16],
        LeftUpLeg: [12, 0, 0], LeftLeg: [-26, 0, 0], LeftFoot: [-6, 0, 0],
      }, hips: [0.06, -0.05, 0] },
      { t: 0.28, pose: {
        Spine: [0, 6, -4], Spine1: [4, 6, -4], Spine2: [1, 4, -2],
        Neck: [2, -3, 0], Head: [12, -4, 0],
        Hips: [0, 2, 0],
        RightUpLeg: [30, -6, 0], RightLeg: [-40, 0, 0], RightFoot: [10, 8, 0],
        LeftArm: [44, 0, 26], RightArm: [50, 0, 4],
        LeftUpLeg: [10, 0, 0], LeftLeg: [-24, 0, 0], LeftFoot: [-6, 0, 0],
      }, hips: [0.04, -0.06, 0] },
      { t: 0.42, pose: {
        RightUpLeg: [36, -30, 0], RightLeg: [-50, 0, 0], RightFoot: [12, 26, 0],
        Hips: [0, -10, 0],
        Spine: [-2, -6, 2], Spine1: [6, -10, 5], Spine2: [2, -6, 3],
        Neck: [3, 4, 0], Head: [14, 6, 0],
        LeftArm: [52, 0, 28], LeftForeArm: [20, 0, 30], RightArm: [44, 0, 22], RightForeArm: [-2, 0, -22],
        LeftUpLeg: [8, 0, 0], LeftLeg: [-24, 0, 0], LeftFoot: [-6, 0, 0],
      }, hips: [-0.03, -0.05, 0] },
      { t: 0.58, pose: {
        RightUpLeg: [22, 12, 0], RightLeg: [-38, 0, 0], RightFoot: [14, -6, 0],
        Hips: [0, 8, 0],
        Spine1: [8, 8, -4], Head: [12, 0, 0],
        LeftArm: [42, 0, 18], RightArm: [52, 0, 4],
        LeftUpLeg: [10, 0, 0], LeftLeg: [-26, 0, 0],
      }, hips: [-0.05, -0.04, 0] },
      { t: 0.68, pose: {
        RightUpLeg: [10, 0, 0], RightLeg: [-24, 0, 0],
        Hips: [0, 2, 0], Spine1: [4, 2, 0],
        LeftArm: [46, 0, 14], RightArm: [50, 0, 8],
        LeftUpLeg: [6, 0, 0], LeftLeg: [-18, 0, 0],
      }, hips: [-0.03, -0.02, 0] },
      { t: 0.8, pose: {} },
    ],
  },
  feinteFrappe: {
    // La feinte de frappe VIT de sa ressemblance (même loi que feintePasse/passe — une clause du
    // banc COMPARE) : l'armé est CELUI de `frappe`, clé pour clé (cuisse −30°, genou −108°, buste
    // en arrière, bassin −16°), et au « contact » (0,3) le geste SE RETIENT — la cuisse meurt à
    // 8° au lieu de traverser à 62°, le bassin ne tourne pas, le pied se relève. Le défenseur
    // lancé pour contrer s'assoit (morsure LONGUE : on ne se jette pas devant une demi-frappe).
    // Rétraction courte (0,14 s — la leçon de feintePasse : l'avantage doit survivre au geste).
    name: 'feinteFrappe', duration: 0.55, contact: 0.3, loop: false,
    keys: [
      { t: 0.0, pose: {} },
      { t: 0.2, pose: {
        RightUpLeg: [-30, 0, 0], RightLeg: [-108, 0, 0], RightFoot: [28, 0, 0],
        Hips: [0, -16, 0],
        Spine: [-4, -8, 0], Spine1: [-8, -8, 0], Spine2: [-4, -6, 0],
        Neck: [4, 0, 0], Head: [16, 0, 0],
        LeftArm: [40, 0, 45], LeftForeArm: [35, 0, 35], RightArm: [40, 0, 40], RightForeArm: [-10, 0, -20],
        LeftUpLeg: [10, 0, 0], LeftLeg: [-26, 0, 0], LeftFoot: [-8, 0, 0],
      }, hips: [0, -0.05, 0] },
      { t: 0.3, pose: {
        RightUpLeg: [8, 0, 0], RightLeg: [-42, 0, 0], RightFoot: [2, 12, 0],
        Hips: [0, -4, 0],
        Spine: [-2, -2, 0], Spine1: [0, -2, 0], Spine2: [0, -1, 0],
        Neck: [3, 0, 0], Head: [15, 0, 0],
        LeftArm: [42, 0, 30], LeftForeArm: [25, 0, 32], RightArm: [45, 0, 22], RightForeArm: [-5, 0, -22],
        LeftUpLeg: [8, 0, 0], LeftLeg: [-22, 0, 0], LeftFoot: [-6, 0, 0],
      } },
      { t: 0.4, pose: {
        RightUpLeg: [14, -8, 0], RightLeg: [-30, 0, 0], RightFoot: [4, 6, 0],
        Hips: [0, 2, 0],
        Spine1: [2, 2, 0], Head: [12, 0, 0],
        LeftArm: [46, 0, 22], LeftForeArm: [15, 0, 26], RightArm: [48, 0, 12], RightForeArm: [0, 0, -20],
        LeftUpLeg: [6, 0, 0], LeftLeg: [-18, 0, 0],
      }, hips: [0, -0.01, 0] },
      { t: 0.55, pose: {} },
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
        LeftArm: [50, 0, 30], LeftForeArm: [25, 0, 35], RightArm: [45, 0, 30], RightForeArm: [0, 0, -25],
        LeftUpLeg: [8, 0, 0], LeftLeg: [-22, 0, 0], LeftFoot: [-6, 0, 0],
      }, hips: [0, -0.03, 0] },
      { t: 0.19, pose: {
        RightUpLeg: [14, -28, 0], RightLeg: [-34, 0, 0], RightFoot: [6, 22, 0],
        Hips: [0, 3, 0],
        Spine: [-1, 0, 0], Spine1: [-2, 4, 0], Spine2: [0, 4, 0],
        Neck: [3, 0, 0], Head: [15, 0, 0],
        LeftArm: [35, 0, 25], LeftForeArm: [20, 0, 35], RightArm: [50, 0, 10], RightForeArm: [-5, 0, -25],
        LeftUpLeg: [6, 0, 0], LeftLeg: [-18, 0, 0], LeftFoot: [-5, 0, 0],
      } },
      { t: 0.22, pose: {
        RightUpLeg: [46, -30, 0], RightLeg: [-10, 0, 0], RightFoot: [28, 35, 0],
        Hips: [0, 4, 0],
        Spine: [0, 4, 0], Spine1: [-4, 8, 0], Spine2: [0, 6, 0],
        Neck: [2, 0, 0], Head: [16, 0, 0],
        LeftArm: [20, 0, 20], LeftForeArm: [10, 0, 35], RightArm: [50, 0, -5], RightForeArm: [10, 0, -25],
        LeftUpLeg: [5, 0, 0], LeftLeg: [-12, 0, 0],
      }, hips: [0, 0, 0] },
      { t: 0.26, pose: {
        RightUpLeg: [72, -26, 0], RightLeg: [-30, 0, 0], RightFoot: [30, 32, 0],
        Hips: [0, 7, 0],
        Spine: [0, 3, 0], Spine1: [0, 5, 0], Spine2: [0, 3, 0],
        Neck: [1, 0, 0], Head: [9, 0, 0],
        LeftArm: [35, 0, 20], LeftForeArm: [20, 0, 30], RightArm: [60, 0, -25], RightForeArm: [18, 0, -25],
        LeftUpLeg: [4, 0, 0], LeftLeg: [-14, 0, 0], LeftFoot: [-3, 0, 0],
      } },
      { t: 0.54, pose: {} },
    ],
  },
};

// LE DOUBLE PASSEMENT (deux tours autour du ballon) — généré par répétition du segment du
// cercle (0 → 0,28] : mêmes clés, même anatomie, le plant et la sortie glissent d'un tour.
MOVES.passementJambes2 = { ...repeatSegment(MOVES.passementJambes, 0, 0.3, 1), name: 'passementJambes2' };   // le tour = 0,3 depuis le ré-authoring lot 110
