import * as THREE from 'three/webgpu';

// rondo-corps.js — LE DUEL DE CORPS AU RENDU (lot 350 — demande du 28/09 : « les collisions » ; l'audit contre les vidéos).
// Mesuré (sondes face / contact, filmé) : le porteur a un adversaire à < 1 m 12 % du temps de conduite, deux adversaires à < 0,75 m
// l'un de l'autre ~3 min / 30 min — et AUCUNE posture : les corps se tenaient poitrine contre poitrine, les jambes et les bras se
// traversaient (filmé : genoux dans les genoux, visages à 5 cm). Le bouclier (rondo-contact) ne vivait qu'au porteur qui POSSÈDE le
// ballon (depuis le 343, la conduite à touches le laisse libre entre deux touches) : 5 boucliers / 30 min.
// Ici, la sim ne bouge pas : chaque joueur de champ debout, sans acte ni geste en cours, qui a un adversaire debout à ≤ 0,95 m DEVANT
// ou SUR LE CÔTÉ (pas dans le dos : c'est le bouclier du porteur) joue le DUEL DE CORPS (motion-contact.duelCorps : l'épaule engagée, le
// bras sur lui, penché vers lui ; le haut du corps seul) du côté de l'adversaire, TENU tant qu’il reste à ≤ 1,15 m.
// ?corps-hier : l'hier (ni duel de corps, ni bouclier élargi).
export function duelCorps(scene, pl) {
  if (scene._corpsHier) return false;
  const st = scene.state, s = pl.sim, spec = pl.gestureLayer.spec, joue = /^duelCorps/.test(spec?.name ?? '') && pl.gestureLayer.active;   // le miroir s'appelle « duelCorps-gauche » (animkit.mirrorMove)
  let want = 0, dMin = 99;
  if (!s.keeper && !s.act && (s.down ?? 0) <= 0 && !s.expulse && !s._sub && !st.restart) {
    const fx = Math.cos(s.yaw), fz = Math.sin(s.yaw);
    for (const q of st.players) {
      if (q.team === s.team || q.keeper || (q.down ?? 0) > 0 || q.expulse || q._sub) continue;
      const dx = q.p[0] - s.p[0], dz = q.p[2] - s.p[2], d = Math.hypot(dx, dz);
      if (d > (joue ? 1.15 : 0.95) || d < 0.15 || d >= dMin) continue;
      if ((dx * fx + dz * fz) / d < -0.3) continue;                                  // dans le dos : pas un duel de face
      dMin = d; want = (-dx * fz + dz * fx) >= 0 ? 1 : -1;                           // > 0 : à droite (le clip neutre)
    }
  }
  if (want && !joue && !pl.gestureLayer.active) {
    scene._playTech(pl, { type: 'duelCorps', move: 'duelCorps', foot: want < 0 ? 'left' : 'right' });
    pl._duel = { side: want, since: scene._t }; pl._teched = scene._t;
  } else if (pl._duel && (!want || !joue)) pl._duel = null;                          // le contact se défait : le clip joue sa fin
  return joue;
}

// LE BRAS SE POSE SUR L'AUTRE, IL NE LE TRAVERSE PAS (350). Mesuré en match (sonde des capsules, 4 min) : 14 % des paires d'adversaires à
// < 0,9 m ont un bras DANS le buste ou le bras de l'autre — au duel de corps, c'est l'avant-bras engagé qui entre dans la hanche. Une passe
// par image, APRÈS toutes les poses finales (les deux corps sont où ils seront vus) : pour chaque bras d'un joueur debout près d'un
// adversaire debout, le segment qui entre dans la capsule du buste adverse (hanches → cou, rayon R) pivote — l'épaule pour le bras, le
// coude pour l'avant-bras — du plus petit angle qui le pose sur la surface (borné à 45° : l'épaule déjà dans l'autre ne se répare pas
// par le bras, c'est la séparation qui s'en charge). Puis les bras de l'autre (rayon RB 0,1 m : bras contre bras, pas l'un dans l'autre —
// au duel côte à côte, les deux bras engagés se croisaient : 60 % des traversées restantes). ?corps-hier : l'hier.
const RT = 0.2, RB = 0.1, AMAX = 45 * Math.PI / 180;
const _p1 = new THREE.Vector3(), _q1 = new THREE.Vector3(), _p2 = new THREE.Vector3(), _q2 = new THREE.Vector3(), _c1 = new THREE.Vector3(), _c2 = new THREE.Vector3();
const _u = new THREE.Vector3(), _w = new THREE.Vector3(), _n = new THREE.Vector3(), _qd = new THREE.Quaternion(), _qw = new THREE.Quaternion(), _qp = new THREE.Quaternion();
const OS = ['Hips', 'Neck', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightArm', 'RightForeArm', 'RightHand'];
const osDe = (pl) => { if (pl._osCorps !== undefined) return pl._osCorps; const B = {}; for (const [nm, b] of pl.gestureLayer.bones) { const k = nm.replace(/^mixamorig\d*:?/, '').replace(/^\d+/, ''); if (OS.includes(k)) B[k] = b; } return (pl._osCorps = OS.every((k) => B[k]) ? B : null); };
// les points les plus proches entre [p1 q1] et [p2 q2] → _c1, _c2
function proches(p1, q1, p2, q2) {
  const d1 = _u.subVectors(q1, p1), d2 = _w.subVectors(q2, p2), r = _n.subVectors(p1, p2), a = d1.dot(d1), e = d2.dot(d2), f = d2.dot(r), c = d1.dot(r), b = d1.dot(d2), den = a * e - b * b;
  let s = den > 1e-9 ? Math.min(1, Math.max(0, (b * f - c * e) / den)) : 0, t = e > 1e-9 ? (b * s + f) / e : 0;
  if (t < 0) { t = 0; s = Math.min(1, Math.max(0, -c / a)); } else if (t > 1) { t = 1; s = Math.min(1, Math.max(0, (b - c) / a)); }
  _c1.copy(p1).addScaledVector(d1, s); _c2.copy(p2).addScaledVector(d2, t);
}
// pivote l'os `os` (racine du segment p→q) pour sortir le segment de la capsule [a b] de rayon R ; true s'il a bougé
function pose(os, p, q, a, b, soi, R = RT) {
  proches(p, q, a, b); const d = _c1.distanceTo(_c2); if (d >= R) return false;
  _n.subVectors(_c1, _c2); if (_n.lengthSq() < 1e-8) _n.subVectors(soi, _c2).setY(0); _n.normalize();
  const tgt = _c2.clone().addScaledVector(_n, R), v0 = _c1.clone().sub(p), v1 = tgt.sub(p); if (v0.lengthSq() < 1e-6) return false;   // le point le plus proche EST la racine : rien à pivoter
  _qd.setFromUnitVectors(v0.normalize(), v1.normalize()); const ang = 2 * Math.acos(Math.min(1, Math.abs(_qd.w))); if (ang > AMAX) _qd.slerp(new THREE.Quaternion(), 1 - AMAX / ang);
  os.getWorldQuaternion(_qw); os.parent.getWorldQuaternion(_qp); _qw.premultiply(_qd); os.quaternion.copy(_qp.invert().multiply(_qw)); os.updateMatrixWorld(true);
  return true;
}
export function brasContact(scene) {
  if (scene._corpsHier) return;
  const P = (scene.players ?? []).filter((pl) => (pl.sim.down ?? 0) <= 0 && !pl.sim.expulse && !pl.sim._sub && pl.model.visible !== false);
  for (let i = 0; i < P.length; i++) for (let j = 0; j < P.length; j++) {
    const x = P[i], y = P[j]; if (x.sim.team === y.sim.team) continue;
    if (Math.hypot(x.model.position.x - y.model.position.x, x.model.position.z - y.model.position.z) > 1.1) continue;
    const X = osDe(x), Y = osDe(y); if (!X || !Y) continue;
    Y.Hips.getWorldPosition(_p2); Y.Neck.getWorldPosition(_q2); X.Hips.getWorldPosition(_p1); const soi = _p1.clone();
    for (const c of ['Left', 'Right']) {
      const sh = X[c + 'Arm'].getWorldPosition(new THREE.Vector3()), el = X[c + 'ForeArm'].getWorldPosition(new THREE.Vector3());
      if (pose(X[c + 'Arm'], sh, el, _p2, _q2, soi)) X[c + 'ForeArm'].getWorldPosition(el);
      const ha = X[c + 'Hand'].getWorldPosition(new THREE.Vector3()); if (pose(X[c + 'ForeArm'], el, ha, _p2, _q2, soi)) X[c + 'Hand'].getWorldPosition(ha);
      for (const o of ['Left', 'Right']) {                                                // les bras de l'autre : le haut du bras, puis l'avant-bras
        const a0 = Y[o + 'Arm'].getWorldPosition(new THREE.Vector3()), a1 = Y[o + 'ForeArm'].getWorldPosition(new THREE.Vector3()), a2 = Y[o + 'Hand'].getWorldPosition(new THREE.Vector3());
        for (const [m, n] of [[a0, a1], [a1, a2]]) { if (pose(X[c + 'Arm'], sh, el, m, n, soi, RB)) { X[c + 'ForeArm'].getWorldPosition(el); X[c + 'Hand'].getWorldPosition(ha); } if (pose(X[c + 'ForeArm'], el, ha, m, n, soi, RB)) X[c + 'Hand'].getWorldPosition(ha); }
      }
      if (pose(X[c + 'ForeArm'], el, ha, _p2, _q2, soi)) X[c + 'Hand'].getWorldPosition(ha);   // le buste a le dernier mot (écarté d'un bras, l'avant-bras y retombait)
    }
  }
}
