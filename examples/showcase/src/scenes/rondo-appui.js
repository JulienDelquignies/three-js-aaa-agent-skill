// rondo-appui.js — LE GESTE DE L'APPUI PLANTÉ, au rendu (lot 336 bis, 26/09 : « le foot est un sport d'appui » — l'appui de la sim,
// engine/appui.js, se lisait par le seul frein et le pivot de la foulée). Pendant pl.sim._appui (t0 → fin), une enveloppe sin(π u) :
//   le BASSIN descend (4 cm à 40°, 10 cm au demi-tour) et se décale de 5 cm vers l'accélération (le centre de gravité passe devant
//   l'appui) ;
//   le BUSTE s'incline DANS l'accélération — la direction du changement de vitesse (sortie − entrée) : en arrière de la course au
//   freinage, vers le nouvel axe à la relance — d'un angle atan(a/g) (la physique de l'appui : a = |Δv| / durée), plafonné à 24°,
//   porté par la colonne (Spine 60 %, Spine1 40 %).
// Avant le verrou des pieds (Rondo.js) : le verrou re-plante les appuis sous le bassin descendu — les genoux plient. ?appui-muet : hier.
import * as THREE from 'three/webgpu';

const _up = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3(), _ax = new THREE.Vector3(), _qd = new THREE.Quaternion(), _qw = new THREE.Quaternion(), _qp = new THREE.Quaternion();
const LEAN_MAX = 24, G = 9.81;

function colonne(pl) {
  if (pl._colonne !== undefined) return pl._colonne;
  const B = {}; pl.model.traverse((o) => { if (!o.isBone) return; const m = /(Spine|Spine1)$/.exec(o.name); if (m && !B[m[1]]) B[m[1]] = o; });
  return (pl._colonne = B.Spine && B.Spine1 ? B : null);
}

function tourne(os, part, ang) {
  _qd.setFromAxisAngle(_ax, ang * part);
  os.getWorldQuaternion(_qw); os.parent.getWorldQuaternion(_qp);
  _qw.premultiply(_qd); os.quaternion.copy(_qp.invert().multiply(_qw));
  os.updateMatrixWorld(true);
}

/** Chaque image, avant le verrou des pieds. */
export function appuiPose(scene, pl) {
  const A = pl.sim._appui; if (scene._appuiMuet || !A || pl.sim.act || (pl.sim.down ?? 0) > 0 || pl.gestureLayer?.active) return;
  const st = scene.state, dur = A.fin - A.t0, u = (st.t - A.t0) / Math.max(1e-3, dur); if (!(u > 0 && u < 1)) return;
  const env = Math.sin(Math.PI * u);
  const ax = A.vo * A.uo[0] - A.vi * A.ui[0], az = A.vo * A.uo[1] - A.vi * A.ui[1], dv = Math.hypot(ax, az); if (dv < 0.3) return;
  _d.set(ax / dv, 0, az / dv);
  const prof = Math.max(0, Math.min(1, (A.deg - 40) / 140));
  if (pl.hipsNudge) pl.hipsNudge([_d.x * 0.05 * env, -(0.04 + 0.06 * prof) * env, _d.z * 0.05 * env]);
  const B = colonne(pl); if (!B) return;
  const lean = Math.min(LEAN_MAX, Math.atan2(dv / dur, G) * 180 / Math.PI) * Math.PI / 180 * env;
  pl.model.updateMatrixWorld(true);
  _ax.crossVectors(_up, _d).normalize();                       // incliner vers _d : rotation autour de haut × d
  tourne(B.Spine, 0.6, lean); tourne(B.Spine1, 0.4, lean);
}
