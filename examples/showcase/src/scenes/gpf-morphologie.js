import * as THREE from 'three/webgpu';

// gpf-morphologie.js — LA MORPHOLOGIE DES JOUEURS de /match11 (lot L5, EX-26 « apparence pilotée par les données : taille, gabarit ») : la
// taille (cm) et le poids (kg) de chaque joueur font son corps — la hauteur par l'échelle du modèle, la carrure (fin, normal, costaud) par
// une cible de morphing qui épaissit ou affine le corps autour de ses os. Les deux viennent des DONNÉES du joueur : la loi de la carrière
// (foot, gabarit.ts : la taille en cloche autour de la moyenne du poste, le poids qui suit la taille), tirée par le contrat du corps
// (gpf-wasm/contrat.mjs morphologiesDe, que la page et les bancs posent pareil) en attendant les fiches de la carrière ; le corps en prend la
// taille (gf_set_hauteur : la hauteur de ses touches de balle). Jamais un réglage du corps à la main (l'Office, 2026 : la formule physique()
// validée par l'utilisateur).
//
// LA FORMULE (l'Office, appearance.ts) : la référence 180 cm, 75 kg ; hauteur = taille / 180 ; carrure = √(poids / 75 / hauteur) — la masse
// va comme carrure² × hauteur, la carrure s'en déduit. Chacune est STYLISÉE par son exagération E (x → 1 + (x − 1) · E) : les écarts humains
// sont faibles et se perdent à la caméra lointaine. Ici deux réglages : la carrure à E = 2 (celle de l'Office, validée), la HAUTEUR à E = 1 —
// la vraie taille, parce que le corps de Gameplay Football la connaît et que nos pieds, nos mains doivent rester où son corps les met.

const REF_CM = 180, REF_KG = 75;
/** LA FORMULE : la hauteur et la carrure dessinées, la masse (le rapport des poids, sans exagération). */
export function physique(cm, kg, { exagHauteur = 1, exagCarrure = 2 } = {}) {
  const h = cm / REF_CM, b = Math.sqrt(kg / REF_KG / h);
  return { hauteur: 1 + (h - 1) * exagHauteur, carrure: 1 + (b - 1) * exagCarrure, masse: kg / REF_KG };
}
/** L'indice de masse corporelle, et le mot de la carrière (foot, Physique.tsx) : léger (< 21), équilibré, solide (≥ 23), puissant (≥ 25). */
export const imc = (cm, kg) => kg / (cm / 100) ** 2;
export function corpulence(cm, kg) { const i = imc(cm, kg); return i >= 25 ? 'puissant' : i >= 23 ? 'solide' : i >= 21 ? 'équilibré' : 'léger'; }
/** LES CARRURES À CHOISIR (fin, normal, costaud) : l'IMC visé — le poids s'en déduit de la taille. */
export const CARRURES = { fin: { nom: 'Fin', imc: 20.4 }, normal: { nom: 'Normal', imc: 22.8 }, costaud: { nom: 'Costaud', imc: 25.6 } };
export const poidsPour = (cm, carrure) => Math.round((CARRURES[carrure]?.imc ?? 22.8) * (cm / 100) ** 2);
/** La carrure (fin, normal, costaud) d'une taille et d'un poids. */
export function carrureDe(cm, kg) { const i = imc(cm, kg); return i < 21.5 ? 'fin' : i >= 24.5 ? 'costaud' : 'normal'; }

// ———————————————————————————— la carrure : une cible de morphing ————————————————————————————
/** Le gain de chaque os (nom canonique) dans la carrure : le tronc, les bras, les cuisses ; le cou, la tête, les mains et les pieds ne bougent
 *  pas (la tête est un autre maillage : le cou épaissi ferait une marche à la jonction). */
const GAINS = {
  Hips: 1, Spine: 1, Spine1: 1, Spine2: 0.9, LeftShoulder: 0.6, RightShoulder: 0.6, LeftArm: 1, RightArm: 1, LeftForeArm: 0.65, RightForeArm: 0.65,
  LeftUpLeg: 1, RightUpLeg: 1, LeftLeg: 0.75, RightLeg: 0.75,
};
/** Le segment de chaque os : de sa tête à celle de l'os qui le prolonge. */
const SUITE = {
  Hips: 'Spine', Spine: 'Spine1', Spine1: 'Spine2', Spine2: 'Neck', LeftShoulder: 'LeftArm', RightShoulder: 'RightArm', LeftArm: 'LeftForeArm',
  RightArm: 'RightForeArm', LeftForeArm: 'LeftHand', RightForeArm: 'RightHand', LeftUpLeg: 'LeftLeg', RightUpLeg: 'RightLeg', LeftLeg: 'LeftFoot', RightLeg: 'RightFoot',
};
/** L'amplitude de la cible : + 15 % de rayon à l'influence 1 (une carrure de 1,15) ; l'influence d'une carrure c est (c − 1) / 0,15. */
export const AMPLITUDE_CARRURE = 0.15;

/**
 * LA CARRURE EN VOLUME : une cible de morphing du corps (dans la pose de liaison, avant le skinning — les ombres suivent), réglée par joueur
 * (`mesh.morphTargetInfluences[indice]`, positive : costaud, négative : fin). Chaque sommet s'écarte de l'axe de ses os (le segment de
 * chaque os, au repos de liaison — l'inverse de sa matrice de liaison), pondéré par ses poids de skinning et le gain de l'os : le tronc,
 * les bras, les cuisses s'épaississent, sans plis aux jointures (la somme pondérée est continue). Les normales suivent (recalculées sur la
 * forme épaissie, moins celles de la forme d'origine). Rend l'indice de la cible.
 */
export function morphCarrure(mesh) {
  const geo = mesh.geometry, pos = geo.attributes.position, si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight, n = pos.count;
  const os = mesh.skeleton.bones, tete = os.map((_, i) => new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().copy(mesh.skeleton.boneInverses[i]).invert()));
  const parNom = new Map(os.map((b, i) => [b.name, i]));
  const segs = os.map((b, i) => {
    const g = GAINS[b.name] ?? 0, j = parNom.get(SUITE[b.name]);
    return g && j != null ? { a: tete[i], b: tete[j], g } : null;
  });
  const d = new Float32Array(n * 3), P = new THREE.Vector3(), ab = new THREE.Vector3(), r = new THREE.Vector3(), cl = new THREE.Vector3();
  for (let v = 0; v < n; v++) {
    P.fromBufferAttribute(pos, v);
    let dx = 0, dy = 0, dz = 0;
    for (let k = 0; k < 4; k++) {
      const w = sw.getComponent(v, k), S = w > 0 ? segs[si.getComponent(v, k)] : null; if (!S) continue;
      ab.subVectors(S.b, S.a); const t = Math.max(0, Math.min(1, r.subVectors(P, S.a).dot(ab) / ab.lengthSq()));
      cl.copy(S.a).addScaledVector(ab, t); r.subVectors(P, cl);
      const f = w * S.g * AMPLITUDE_CARRURE; dx += r.x * f; dy += r.y * f; dz += r.z * f;
    }
    d[v * 3] = dx; d[v * 3 + 1] = dy; d[v * 3 + 2] = dz;
  }
  const normalesDe = (A) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(A, 3)); if (geo.index) g.setIndex(geo.index); g.computeVertexNormals(); return g.attributes.normal.array; };
  const P0 = new Float32Array(n * 3); for (let v = 0; v < n; v++) { P0[v * 3] = pos.getX(v); P0[v * 3 + 1] = pos.getY(v); P0[v * 3 + 2] = pos.getZ(v); }
  const N0 = normalesDe(P0), N1 = normalesDe(P0.map((x, i) => x + d[i])), dn = new Float32Array(n * 3);
  for (let i = 0; i < n * 3; i++) dn[i] = N1[i] - N0[i];
  (geo.morphAttributes.position ??= []).push(new THREE.Float32BufferAttribute(d, 3));
  (geo.morphAttributes.normal ??= []).push(new THREE.Float32BufferAttribute(dn, 3));
  geo.morphTargetsRelative = true;
  return geo.morphAttributes.position.length - 1;
}
