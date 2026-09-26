// rondo-porteur.js — LA POSTURE CONTINUE DU PORTEUR, au rendu (26/09 : « améliore la conduite de balle… pour l'instant c'est pas
// fluide »). Constat : la conduite n'a de geste que pour les touches qui tournent (≥ 20° : conduiteInterieur / Exterieur, 0,4 s) — 71 %
// des touches vont droit (recensement, 2 matchs, 1 214 touches) et le porteur court comme un joueur SANS ballon ; le bouclier (lot A10,
// rondo-contact) ne se lève que si la sim dit le ballon POSSÉDÉ — entre deux touches de conduite il est libre : il ne joue presque
// jamais en dribble. Multiplier les clips hache la course (chaque clip prend puis rend les jambes). Ici une COUCHE CONTINUE, poids lissés
// (τ 0,25 s — elle n'a jamais d'arête) :
//   en conduite   le bassin descend de 2 cm, le buste penche de 11° au-dessus du ballon (338 bis), bras bas et un peu dehors ;
//   sous pression (l'adversaire le plus proche à < 3 m, pleine à 1 m) : le bassin encore −4 cm, le buste +5°, il PIVOTE de 12° pour mettre
//                 le corps entre l'adversaire et le ballon (le dos vers lui), et le bras de son côté s'écarte de 35° — le tient à distance.
// Rien pendant un geste (la couche de geste possède le corps). Avant le verrou des pieds (qui re-plante sous le bassin descendu).
// ?conduite-nue : hier.
import * as THREE from 'three/webgpu';

const _up = new THREE.Vector3(0, 1, 0), _f = new THREE.Vector3(), _ax = new THREE.Vector3(), _v = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3();
const _qd = new THREE.Quaternion(), _qw = new THREE.Quaternion(), _qp = new THREE.Quaternion();
const D2R = Math.PI / 180;

function os(pl) {
  if (pl._osPorteur !== undefined) return pl._osPorteur;
  const B = {}; pl.model.traverse((o) => { if (!o.isBone) return; const m = /(Spine|Spine1|Spine2|LeftArm|RightArm|LeftForeArm|RightForeArm|LeftHand|RightHand)$/.exec(o.name); if (m && !B[m[1]]) B[m[1]] = o; });
  return (pl._osPorteur = B.Spine && B.Spine1 && B.Spine2 && B.LeftArm && B.RightArm && B.LeftForeArm && B.RightForeArm && B.LeftHand && B.RightHand ? B : null);
}
function tourne(o, axe, ang) {
  if (Math.abs(ang) < 1e-4) return;
  _qd.setFromAxisAngle(axe, ang); o.getWorldQuaternion(_qw); o.parent.getWorldQuaternion(_qp);
  _qw.premultiply(_qd); o.quaternion.copy(_qp.invert().multiply(_qw)); o.updateMatrixWorld(true);
}

/** Chaque image, avant le verrou des pieds. */
export function conduitePose(scene, pl, dt) {
  if (scene._conduiteNue) return;
  const st = scene.state, s = pl.sim;
  const porte = st.possession?.carrier === s.id && st.phase === 'carry' && !s.act && !s.keeper && (s.down ?? 0) <= 0;
  let pr = 0, cote = 0;
  if (porte) {
    let best = null;
    for (const q of st.players) { if (q.team === s.team || (q.down ?? 0) > 0 || q._sub) continue; const d = Math.hypot(q.p[0] - s.p[0], q.p[2] - s.p[2]); if (!best || d < best.d) best = { d, q }; }
    if (best && best.d < 3) {
      pr = Math.min(1, (3 - best.d) / 2);
      pl.model.updateMatrixWorld(true); _v.set(best.q.p[0] + pl.model.position.x - s.p[0], pl.model.position.y, best.q.p[2] + pl.model.position.z - s.p[2]); pl.model.worldToLocal(_v);
      cote = -_v.x > 0 ? 1 : -1;   // l'adversaire à gauche (+1) ou à droite (−1) du corps rendu (Mixamo : gauche = −x local)
    }
  }
  const C = (pl._porteur ??= { w: 0, pr: 0, cote: 0 }), k = 1 - Math.exp(-Math.max(0, dt) / 0.25);
  C.w += ((porte ? 1 : 0) - C.w) * k; C.pr += (pr - C.pr) * k; if (cote) C.cote += (cote - C.cote) * k; else C.cote *= 1 - k;
  // (338 bis) le geste possède le corps — mais la posture ne se COUPE plus à son départ (le buste se redressait d'une image à chaque touche
  // de conduite) : elle s'efface en τ 0,12 s pendant le geste et revient de même
  C.g = (C.g ?? 1) + ((pl.gestureLayer?.active ? 0 : 1) - (C.g ?? 1)) * (1 - Math.exp(-Math.max(0, dt) / 0.12));
  if (C.w * C.g < 1e-3) return;
  const B = os(pl); if (!B) return;
  const w = C.w * C.g, p = C.pr * w;
  if (pl.hipsNudge) pl.hipsNudge([0, -(0.02 * w + 0.03 * p), 0]);
  pl.model.updateMatrixWorld(true);
  pl.model.getWorldDirection(_f); _f.y = 0; _f.normalize(); _f.negate();          // l'avant du corps (−z local)
  _ax.crossVectors(_up, _f).normalize();                                            // pencher vers l'avant
  // (338 bis) LE PORT DE BRAS DU PORTEUR (26/09 : « la conduite n'est pas belle ») — filmée de profil : les avant-bras remontaient à la poitrine
  // (le coude à 90° et le balancier de la foulée de course), le buste presque droit. Le dribbleur réel : buste au-dessus du ballon, bras BAS et
  // un peu DEHORS (l'équilibre), coude ouvert. Le coude s'ouvre de 40°·w, le haut du bras s'écarte de 10°·w ; le buste 11° (hier 5).
  for (const [side, sg] of [['Left', 1], ['Right', -1]]) {
    const up = B[`${side}Arm`], fo = B[`${side}ForeArm`], ha = B[`${side}Hand`];
    up.getWorldPosition(_v); fo.getWorldPosition(_a); ha.getWorldPosition(_b);
    const u1 = _a.clone().sub(_v).normalize(), u2 = _b.clone().sub(_a).normalize(), ax = new THREE.Vector3().crossVectors(u1, u2);
    if (ax.lengthSq() > 1e-4) { ax.normalize(); const flex = Math.acos(Math.max(-1, Math.min(1, u1.dot(u2)))); tourne(fo, ax, -Math.min(40 * D2R * w, Math.max(0, flex - 25 * D2R))); }
    tourne(up, _f, sg * 10 * D2R * w);
  }
  const lean = (11 * w + 5 * p) * D2R; tourne(B.Spine, _ax, lean * 0.6); tourne(B.Spine1, _ax, lean * 0.4);
  tourne(B.Spine1, _up, -C.cote * 12 * D2R * p * 0.5); tourne(B.Spine2, _up, -C.cote * 12 * D2R * p * 0.5);   // le dos vers l'adversaire
  if (Math.abs(C.cote) > 0.1 && p > 0.02) {                                         // le bras de son côté s'écarte (plancher des coudes : + ouvre le gauche)
    pl.model.getWorldDirection(_f); _f.y = 0; _f.normalize(); _f.negate();
    const gauche = C.cote > 0, bras = gauche ? B.LeftArm : B.RightArm;
    tourne(bras, _f, (gauche ? 1 : -1) * 35 * D2R * p * Math.min(1, Math.abs(C.cote)));
  }
}
