// motion-profile-shanon — LE RIG DE RÉFÉRENCE, en données : les 22 os canoniques de shanon.glb (positions
// et rotations locales de repos, unités du fichier — mètres), tels que le générateur les lit au chargement
// pour construire les MOVES par défaut (animkit-data). La scène, elle, reconstruit le profil sur le rig
// VIVANT (profileFromBones sur le template de squad.js, échelle du squad comprise) ; ce fichier n'est que
// le point de départ commun du banc et du jeu. Régénéré par scripts/motion-profile.mjs — ne pas éditer.
import { makeProfile, ry } from './motion-rig.js';

export const SHANON_BONES = [
  { name: 'Hips', parent: null, t: [0, 0.92817, 0.02554], q: [0, 0, 0, 1] },
  { name: 'Spine', parent: 'Hips', t: [0, 0.15053, 0.00399], q: [-0.052833, 0, 0, 0.998603] },
  { name: 'Spine1', parent: 'Spine', t: [0, 0.11749, 0.01157], q: [0, 0, 0, 1] },
  { name: 'Spine2', parent: 'Spine1', t: [0, 0.13679, -0.01044], q: [0, 0, 0, 1] },
  { name: 'Neck', parent: 'Spine2', t: [0, 0.15432, -0.01578], q: [0.052833, 0, 0, 0.998603] },
  { name: 'Head', parent: 'Neck', t: [0, 0.06038, 0.01394], q: [0, 0, 0, 1] },
  { name: 'LeftShoulder', parent: 'Spine2', t: [0.06475, 0.13553, -0.01783], q: [-0.558392, -0.428626, 0.576771, -0.414504] },
  { name: 'LeftArm', parent: 'LeftShoulder', t: [0, 0.13297, 0], q: [-0.128453, 0.001452, -0.01121, 0.991651] },
  { name: 'LeftForeArm', parent: 'LeftArm', t: [0, 0.27722, 0], q: [-0.036096, -0.001543, 0.042676, 0.998436] },
  { name: 'LeftHand', parent: 'LeftForeArm', t: [0, 0.21256, 0], q: [0.062056, 0.103433, 0.037793, 0.991979] },
  { name: 'RightShoulder', parent: 'Spine2', t: [-0.06475, 0.13552, -0.01771], q: [0.558944, -0.428197, 0.576315, 0.414838] },
  { name: 'RightArm', parent: 'RightShoulder', t: [0, 0.13297, 0], q: [-0.128766, -0.001885, 0.014518, 0.991567] },
  { name: 'RightForeArm', parent: 'RightArm', t: [0, 0.27729, 0], q: [-0.03548, 0.001755, -0.049369, 0.998149] },
  { name: 'RightHand', parent: 'RightForeArm', t: [0, 0.21262, 0], q: [0.061418, -0.095329, -0.028726, 0.993134] },
  { name: 'LeftUpLeg', parent: 'Hips', t: [0.09144, -0.05269, -0.00604], q: [-0.001103, -0.026397, 0.99878, -0.041717] },
  { name: 'LeftLeg', parent: 'LeftUpLeg', t: [-0.00381, 0.35836, -0.00242], q: [-0.01679, 0.000262, -0.01558, 0.999738] },
  { name: 'LeftFoot', parent: 'LeftLeg', t: [0, 0.40192, 0], q: [0.526072, -0.058566, 0.036348, 0.847642] },
  { name: 'LeftToeBase', parent: 'LeftFoot', t: [0, 0.16392, 0], q: [0.285648, -0.022057, 0.006576, 0.958058] },
  { name: 'RightUpLeg', parent: 'Hips', t: [-0.09144, -0.05269, -0.00981], q: [0.000935, -0.022381, 0.998877, 0.041737] },
  { name: 'RightLeg', parent: 'RightUpLeg', t: [0.00381, 0.35818, -0.00205], q: [-0.024615, -0.000384, 0.015594, 0.999575] },
  { name: 'RightFoot', parent: 'RightLeg', t: [0, 0.4022, 0], q: [0.534228, 0.056425, -0.035771, 0.842696] },
  { name: 'RightToeBase', parent: 'RightFoot', t: [0, 0.16712, 0], q: [0.28047, 0.028689, -0.008387, 0.959397] },
];
/** shanon.glb regarde +Z : le wrapper de squad.js le tourne de 180° (avant = −Z). */
export const SHANON_PROFILE = makeProfile(SHANON_BONES, { rootQ: ry(180), rootP: [0, 0, 0], scale: 1 });
