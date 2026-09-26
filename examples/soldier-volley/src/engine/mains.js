import * as THREE from 'three/webgpu';

// mains.js — LES MAINS VIVANTES (26/09, retour « les animations — tout » ; mesuré au plan d'étude : les 24 os de doigts du rig ne sont
// animés par RIEN — les mains restent ouvertes, doigts écartés, comme la pose de liaison ; de près, c'est la première chose qui fait
// « mannequin »). Une main de footballeur qui court est RELÂCHÉE : doigts fléchis de 30-55° par phalange, pouce replié contre l'index.
// L'axe de flexion n'est pas deviné (le sondage à l'œil était ambigu) : il se DÉDUIT de la pose de liaison du squelette — la convention
// Mixamo pose les paumes vers le bas (−Y monde) : l'axe de flexion d'une phalange = (direction du doigt) × (−Y), ramené dans le repère
// local de l'os par la rotation de liaison. Le pouce plie autour de l'axe (direction du pouce) × (vers la paume, vers l'index).
// Absolu, pas cumulatif : q = q_liaison_local ⊗ R(axe local, θ) — rejoué à chaque image il ne dérive pas, et il gagne sur un clip qui
// écrirait les doigts à la liaison. Générique : tout rig aux noms Mixamo (…HandIndex1-3, Middle, Ring, Pinky, Thumb1-3).

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _a = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Vector3();
const DOIGT = /(Left|Right)Hand(Index|Middle|Ring|Pinky|Thumb)([123])$/;

/** Prépare les mains d'un modèle skinné : pour chaque phalange, l'axe local de flexion et la rotation locale de liaison. */
export function preparerMains(model) {
  const sk = []; model.traverse((o) => { if (o.isSkinnedMesh && o.skeleton) sk.push(o.skeleton); });
  const S = sk.sort((a, b) => b.bones.length - a.bones.length)[0]; if (!S) return null;   // le squelette le PLUS COMPLET (le corps — le short n'a que 7 os)
  const monde = new Map();   // os → [position, rotation] monde de LIAISON
  S.bones.forEach((b, i) => { _m.copy(S.boneInverses[i]).invert(); const p = new THREE.Vector3(), q = new THREE.Quaternion(); _m.decompose(p, q, _c); monde.set(b, [p, q]); });
  const out = [];
  for (const b of S.bones) {
    const m = DOIGT.exec(b.name); if (!m) continue;
    const enfant = b.children.find((c) => c.isBone), W = monde.get(b), We = enfant ? monde.get(enfant) : null; if (!W || !We) continue;
    const f = We[0].clone().sub(W[0]).normalize();                                  // la direction de la phalange (liaison, monde)
    let n;
    if (m[2] === 'Thumb') { const idx = S.bones.find((x) => x.name.endsWith(`${m[1]}HandIndex1`)); const Wi = idx ? monde.get(idx) : null; n = Wi ? Wi[0].clone().sub(W[0]).normalize() : new THREE.Vector3(0, -1, 0); }
    else n = new THREE.Vector3(0, -1, 0);                                           // la paume regarde −Y (convention de liaison Mixamo)
    const axeMonde = new THREE.Vector3().crossVectors(n, f); if (axeMonde.lengthSq() < 1e-8) continue; axeMonde.normalize();   // n × f (vérifié au plan d'étude : f × n pliait les doigts en HYPEREXTENSION sur shanon)
    const axeLocal = axeMonde.clone().applyQuaternion(W[1].clone().invert());           // dans le repère de l'os
    out.push({ os: b, doigt: m[2], rang: +m[3], axe: axeLocal, q0: b.quaternion.clone() });
  }
  return out.length ? out : null;
}

/** Pose les mains : flexion par phalange (rad) — { base, milieu, bout } pour les doigts, { pouce } pour le pouce ; `serre` 0..1 module tout. */
export function poserMains(M, { serre = 1, base = 0.55, milieu = 0.95, bout = 0.6, pouce = 0.45, ecart = 0.1 } = {}) {
  if (!M) return;
  for (const P of M) {
    let th = P.doigt === 'Thumb' ? pouce * (P.rang === 1 ? 0.5 : 1) : [0, base, milieu, bout][P.rang];
    // le petit doigt plie un peu plus, l'index un peu moins (la main relâchée se ferme de l'auriculaire vers l'index)
    if (P.doigt === 'Pinky') th *= 1 + ecart * 2; else if (P.doigt === 'Ring') th *= 1 + ecart; else if (P.doigt === 'Index') th *= 1 - ecart;
    _q.setFromAxisAngle(P.axe, th * serre);
    P.os.quaternion.copy(P.q0).multiply(_q);
  }
}
