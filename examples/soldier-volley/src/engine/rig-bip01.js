import * as THREE from 'three/webgpu';
import { CANON } from './motion-rig.js';
import { SHANON_PROFILE } from './motion-profile-shanon.js';

// rig-bip01 — UN SQUELETTE BIPED (3ds Max « Bip01 » : les personnages Microsoft Rocketbox) PRÉSENTÉ AU MOTEUR
// COMME LE RIG DE RÉFÉRENCE. Tout le moteur parle en 22 os canoniques (motion-rig.CANON) et en articulations du
// repère personnage : les générateurs (foulée, frappes, contrôles…) ne lisent que le PROFIL du rig vivant
// (orientations bind, longueurs — motion-cast.motionProfileOf). Trois écarts séparent un Biped d'un Mixamo, et
// chacun casse le mouvement d'une façon qui ne se voit qu'en jeu :
//
//   NOMS        « Bip01 L Thigh » au lieu de « LeftUpLeg » : rigBones, les chaînes de jambe, la couche de geste
//               adressent les os PAR NOM. Renommer ne touche pas au skin (le squelette tient des objets).
//   TOPOLOGIE   les cuisses d'un Biped sont filles de « Bip01 Spine », ses clavicules filles du cou : le tronc qui
//               se penche emporterait les jambes, la tête qui tourne les épaules. On les RATTACHE au bassin et à
//               Spine2 (attach : transform monde conservée — le maillage ne bouge pas d'un sommet).
//   POSE DE REPOS  Rocketbox est lié en A (bras 42° sous la référence, avant-bras 47-52°, mesuré par posediff),
//               la référence en T : « abaisser le bras de 70° » depuis le bind croiserait les bras dans le torse.
//               Chaque segment FONCTIONNEL (bras, avant-bras, jambes, pieds) est tourné, par la rotation minimale,
//               sur la direction du même segment de la référence, dans le repère personnage — SANS recalculer
//               les inverses de liaison : le maillage suit les os, le rig se présente en T et ses gestes sont
//               ceux de la référence. Le tronc et le cou gardent la posture du personnage (2-14° : sa silhouette,
//               pas une convention).
//
// + LA MAIN RELÂCHÉE : un Biped est lié doigts tendus (une main de mannequin en pleine course). Chaque phalange
//   fléchit vers la PAUME — le côté de la paume se calcule sur la main (ligne des jointures × direction des
//   doigts), pas sur une convention d'axes. Cosmétique, hors des os canoniques.

const SIDES = [['L', 'Left'], ['R', 'Right']];
/** Le nom Biped d'un nœud chargé : GLTFLoader ASSAINIT les noms (PropertyBinding.sanitizeNodeName — les espaces
 *  deviennent « _ », « Bip01 L Thigh » arrive « Bip01_L_Thigh ») ; la table parle le nom du fichier. */
const bipName = (n) => String(n || '').replace(/_/g, ' ');
/** Biped → canonique (les 22 os que le moteur adresse). */
export const BIP01_CANON = {
  'Bip01 Pelvis': 'Hips', 'Bip01 Spine': 'Spine', 'Bip01 Spine1': 'Spine1', 'Bip01 Spine2': 'Spine2', 'Bip01 Neck': 'Neck', 'Bip01 Head': 'Head',
};
for (const [s, c] of SIDES) Object.assign(BIP01_CANON, {
  [`Bip01 ${s} Clavicle`]: `${c}Shoulder`, [`Bip01 ${s} UpperArm`]: `${c}Arm`, [`Bip01 ${s} Forearm`]: `${c}ForeArm`, [`Bip01 ${s} Hand`]: `${c}Hand`,
  [`Bip01 ${s} Thigh`]: `${c}UpLeg`, [`Bip01 ${s} Calf`]: `${c}Leg`, [`Bip01 ${s} Foot`]: `${c}Foot`, [`Bip01 ${s} Toe0`]: `${c}ToeBase`,
});

/** Les segments alignés sur la référence, parent → enfant (l'ordre compte : un parent aligné emporte l'enfant). */
export const BIP01_ALIGN = [];
for (const [, c] of SIDES) BIP01_ALIGN.push([`${c}Arm`, `${c}ForeArm`], [`${c}ForeArm`, `${c}Hand`], [`${c}UpLeg`, `${c}Leg`], [`${c}Leg`, `${c}Foot`], [`${c}Foot`, `${c}ToeBase`]);

/** La main relâchée : flexion (degrés) des trois phalanges, de l'index (1) à l'auriculaire (4) — le pouce (0) reste. */
export const BIP01_MAIN = { 1: [22, 30, 18], 2: [26, 36, 20], 3: [30, 40, 22], 4: [34, 44, 24] };

const _u = new THREE.Vector3(), _t = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3();
const _q = new THREE.Quaternion(), _wq = new THREE.Quaternion(), _pq = new THREE.Quaternion();

/** Tourner l'os `bone` de la rotation MONDE `q` (autour de son articulation) : local' = parent⁻¹ ⊗ q ⊗ monde. */
function rotateWorld(bone, q) {
  bone.getWorldQuaternion(_wq);
  bone.parent.getWorldQuaternion(_pq);
  bone.quaternion.copy(_pq.invert().multiply(_q.copy(q).multiply(_wq)));
  bone.updateMatrixWorld(true);
}

/**
 * Adapter un Biped chargé (gltf.scene, AVANT le wrapper de squad.js).
 * @param root  la scène du glTF
 * @param ref   le profil de référence (défaut : shanon) — la pose de repos visée
 * @param faces '+Z' | '-Z' : où regarde le fichier (Rocketbox : +Z) — pour lire la référence dans le repère du fichier
 * @param main  fléchir les doigts (main relâchée)
 * @returns le rapport { renommes, rattaches, alignes: [{ os, deg }], doigts, issues }
 */
export function adaptBip01(root, { ref = SHANON_PROFILE, faces = '+Z', main = true } = {}) {
  const report = { renommes: 0, rattaches: [], alignes: [], doigts: 0, issues: [] };
  const by = new Map();
  root.traverse((o) => { if (!o.isBone) return; const c = BIP01_CANON[bipName(o.name)]; if (c) { o.name = c; by.set(c, o); report.renommes++; } });
  for (const c of CANON) if (!by.has(c)) report.issues.push(`os Biped absent pour « ${c} »`);
  if (report.issues.length) return report;

  root.updateMatrixWorld(true);
  for (const [child, parent] of [['LeftUpLeg', 'Hips'], ['RightUpLeg', 'Hips'], ['LeftShoulder', 'Spine2'], ['RightShoulder', 'Spine2']]) {
    const b = by.get(child), p = by.get(parent);
    if (b.parent !== p) { p.attach(b); report.rattaches.push(`${child} → ${parent}`); }
  }

  // la référence est dans le repère personnage (avant −Z) ; un fichier qui regarde +Z en est la rotation de 180°
  const flip = faces === '+Z';
  for (const [a, c] of BIP01_ALIGN) {
    root.updateMatrixWorld(true);
    const A = by.get(a), C = by.get(c), ra = ref.bones[a], rc = ref.bones[c];
    if (!ra || !rc) { report.issues.push(`référence sans le segment ${a}→${c}`); continue; }
    _u.copy(C.getWorldPosition(_a)).sub(A.getWorldPosition(_b)).normalize();
    _t.set(rc.bindP[0] - ra.bindP[0], rc.bindP[1] - ra.bindP[1], rc.bindP[2] - ra.bindP[2]).normalize();
    if (flip) _t.set(-_t.x, _t.y, -_t.z);
    const deg = Math.acos(THREE.MathUtils.clamp(_u.dot(_t), -1, 1)) * 180 / Math.PI;
    rotateWorld(A, new THREE.Quaternion().setFromUnitVectors(_u, _t));
    report.alignes.push({ os: a, deg: +deg.toFixed(1) });
  }

  if (main) {
    root.updateMatrixWorld(true);
    for (const [s] of SIDES) {
      const doigts = new Map(); root.traverse((o) => { if (o.isBone) doigts.set(bipName(o.name), o); });
      const bone = (k, j = '') => doigts.get(`Bip01 ${s} Finger${k}${j}`) ?? null;
      const base = (k) => bone(k)?.getWorldPosition(new THREE.Vector3());
      const i1 = base(1), i4 = base(4);
      if (!i1 || !i4) { report.issues.push(`main ${s} : doigts absents`); continue; }
      for (const [k, degs] of Object.entries(BIP01_MAIN)) {
        const bones = ['', '1', '2'].map((j) => bone(k, j));
        if (bones.some((b) => !b)) continue;
        bones.forEach((b, j) => {
          root.updateMatrixWorld(true);
          // la direction du doigt (vers la phalange suivante ; la dernière garde celle de la précédente)
          const next = bones[j + 1] ?? null;
          const d = next ? next.getWorldPosition(new THREE.Vector3()).sub(b.getWorldPosition(new THREE.Vector3())).normalize()
            : b.getWorldPosition(new THREE.Vector3()).sub(bones[j - 1].getWorldPosition(new THREE.Vector3())).normalize();
          // la paume : jointures (index → auriculaire) × doigts — main droite d×k, main gauche k×d (le miroir)
          const k4 = i4.clone().sub(i1).normalize();
          const palm = s === 'R' ? d.clone().cross(k4) : k4.clone().cross(d);
          const axis = d.clone().cross(palm).normalize();
          rotateWorld(b, new THREE.Quaternion().setFromAxisAngle(axis, degs[j] * Math.PI / 180));
          report.doigts++;
        });
      }
    }
  }
  root.updateMatrixWorld(true);
  return report;
}

/**
 * Les matériaux Rocketbox : la texture ORM porte l'occlusion en R (le glTF ne la déclare pas — on la branche,
 * c'est l'ombre des plis et des aisselles, gratuite) ; les cartes découpées (cheveux, cils : BLEND) passent en
 * alphaTest — mêlées par tri elles clignotent sous TRAA et projettent une ombre pleine.
 */
export function prepareRocketboxMaterials(root) {
  const n = { ao: 0, cutout: 0 };
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (m.roughnessMap && !m.aoMap) { m.aoMap = m.roughnessMap; m.aoMapIntensity = 1; n.ao++; }
      if (m.transparent && m.map) { m.transparent = false; m.alphaTest = 0.45; m.depthWrite = true; n.cutout++; }
      m.needsUpdate = true;
    }
  });
  return n;
}
