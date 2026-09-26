import * as THREE from 'three/webgpu';

// coudes.js — LE PLANCHER D'ÉCART DES COUDES (26/09, retour utilisateur : « ce sont les coudes qui sont trop collés »). MESURÉ en match :
// le haut du bras rendu ne s'écarte du flanc que de ~15° médian — 1 à 5° chez plusieurs coureurs — quand la foulée générée en demande
// 24-26 (l'écart générateur → écran n'est pas résolu : la liaison des bras est bien en T, 87,7°). Monter l'écart DANS le générateur
// cassait ses contrats (le receveur aux bras calmes, le port de bras, le balancier au frein). Ici, sur la pose FINALE : si l'angle du
// haut du bras au flanc (dans le plan frontal du buste, Spine2) est sous le plancher, l'os du bras pivote vers l'extérieur autour de l'axe
// avant-arrière du buste, du manque exactement — le plan du balancier est conservé, rien ne bouge au-dessus du plancher. Générique :
// tout rig aux noms Mixamo (Spine2, LeftArm/LeftForeArm, RightArm/RightForeArm).

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _f = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3();
const _qs = new THREE.Quaternion(), _qw = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _qd = new THREE.Quaternion();

/** Les os utiles d'un modèle (par suffixe de nom). */
export function osCoudes(model) {
  const B = {}; model.traverse((o) => { if (!o.isBone) return; const m = /(Spine2|LeftArm|LeftForeArm|RightArm|RightForeArm)$/.exec(o.name); if (m) B[m[1]] = o; });
  return B.Spine2 && B.LeftArm && B.LeftForeArm && B.RightArm && B.RightForeArm ? B : null;
}

/** Applique le plancher (degrés). À appeler après la pose de la foulée, avant les IK de fin de pile. */
export function coudesDehors(model, B, minDeg) {
  if (!B || !(minDeg > 0)) return;
  model.updateMatrixWorld(true);
  B.Spine2.getWorldQuaternion(_qs);
  _f.set(0, 0, 1).applyQuaternion(_qs);                          // l'avant du buste (Mixamo : +Z local du buste)
  _u.set(0, 1, 0).applyQuaternion(_qs);                          // le haut du buste
  _r.crossVectors(_u, _f).normalize();                            // la gauche du buste
  for (const [side, s] of [['Left', 1], ['Right', -1]]) {
    const up = B[`${side}Arm`], el = B[`${side}ForeArm`];
    up.getWorldPosition(_a); el.getWorldPosition(_b); _b.sub(_a).normalize();
    // l'angle au flanc, dans le plan frontal : la composante latérale (vers l'extérieur) contre la composante vers le bas
    const lat = _b.dot(_r) * s, bas = -_b.dot(_u), ang = Math.atan2(lat, Math.max(1e-3, bas)) * 180 / Math.PI;
    if (bas <= 0.2 || ang >= minDeg) continue;                      // bras levé (geste) ou déjà dehors : rien
    const d = (minDeg - ang) * Math.PI / 180;
    _qd.setFromAxisAngle(_f, d * s);                              // pivot autour de l'avant du buste, vers l'extérieur (signe vérifié en match : + ouvre le bras gauche)
    up.getWorldQuaternion(_qw); up.parent.getWorldQuaternion(_qp);
    _qw.premultiply(_qd); up.quaternion.copy(_qp.invert().multiply(_qw));
    up.updateMatrixWorld(true);
  }
}
