import * as THREE from 'three/webgpu';
import { GENERATORS } from '../engine/motion-cast.js'; import { SKILL_KINDS } from '../engine/motion-skill.js';

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
  const porteur = !scene._duelDroit && st.possession?.carrier === s.id && st.phase === 'carry';   // (351) le porteur a sa posture (rondo-porteur) et le bouclier : le duel de corps la COUPAIT (un geste possède le corps) — buste 4° au lieu de 16
  if (!porteur && !s.keeper && !s.act && (s.down ?? 0) <= 0 && !s.expulse && !s._sub && !st.restart) {
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

// LE CORPS BAS DU DUEL (351, réf. Taarabt — « l'animation de près »). Mesuré (143 images porteur ↔ adversaire le plus proche à < 1,8 m) :
// le porteur à −5 cm de bassin p50, buste 4°, bras 27-37° ; le défenseur −9 cm, 7°, 24-39° ; le jockey sur 28 % des images seulement.
// Le 1 contre 1 réel : 10-15 cm plus bas, 15-20° de buste, bras d'équilibre à 45-60°. Couche CONTINUE (τ 0,2 s, jamais d'arête), sur tout
// joueur de champ debout à < 1,8 m d'un adversaire debout (pleine à 1 m), après la couche de geste et la posture du porteur, avant le
// verrou des pieds (les genoux plient d'eux-mêmes sous le bassin descendu) ; effacée sous un geste du corps entier (un geste du haut —
// duelCorps, protection — la garde). Les attributs la règlent :
//   agilité (appuiF)  → la profondeur : l'agile s'assoit (bassin), le raide reste haut ;
//   le rôle           → le porteur −4…−8 cm, +8…+14° ; le défenseur du porteur −5…−9 cm (tacle), +12…+18° ; les autres au contact −3 cm, +6° ;
//   la force (chargeF) → le bras du côté de l'adversaire s'ouvre vers lui (il le tient) ; l'autre s'ouvre pour l'équilibre.
// ?duel-droit : hier.
const _up = new THREE.Vector3(0, 1, 0), _fw = new THREE.Vector3(), _lat = new THREE.Vector3(), _loc = new THREE.Vector3(), _qa = new THREE.Quaternion();
const D2R = Math.PI / 180, clamp01 = (x) => Math.max(0, Math.min(1, x));
const OS_BAS = ['Spine', 'Spine1', 'LeftArm', 'RightArm'];
const osBas = (pl) => { if (pl._osBas !== undefined) return pl._osBas; const B = {}; for (const [nm, b] of pl.gestureLayer.bones) { const k = nm.replace(/^mixamorig\d*:?/, '').replace(/^\d+/, ''); if (OS_BAS.includes(k)) B[k] = b; } return (pl._osBas = OS_BAS.every((k) => B[k]) ? B : null); };
function tourne(o, axe, ang) {
  if (Math.abs(ang) < 1e-4) return;
  _qa.setFromAxisAngle(axe, ang); o.getWorldQuaternion(_qw); o.parent.getWorldQuaternion(_qp); _qw.premultiply(_qa); o.quaternion.copy(_qp.invert().multiply(_qw)); o.updateMatrixWorld(true);
}
export function duelPose(scene, pl, dt) {
  if (scene._duelDroit) return;
  const st = scene.state, s = pl.sim, car = st.possession?.carrier ?? -1;
  let best = null;
  if (!s.keeper && (s.down ?? 0) <= 0 && !s.expulse && !s._sub && !st.restart) for (const q of st.players) {
    if (q.team === s.team || q.keeper || (q.down ?? 0) > 0 || q.expulse || q._sub) continue;
    const d = Math.hypot(q.p[0] - s.p[0], q.p[2] - s.p[2]); if (d < 1.8 && (!best || d < best.d)) best = { d, q };
  }
  const role = !best ? 0 : s.id === car ? 1 : best.q.id === car ? 2 : 3;
  const sk = s.skill ?? {}, agil = clamp01((1.15 - (sk.appuiF ?? 1)) / 0.3), tac = clamp01(((sk.tacleGardeF ?? 1) - 0.85) / 0.3), frc = clamp01(((sk.chargeF ?? 1) - 0.85) / 0.3);
  const drop = role === 1 ? 0.04 + 0.04 * agil : role === 2 ? 0.05 + 0.02 * tac + 0.02 * agil : role === 3 ? 0.03 : 0;
  const lean = role === 1 ? 8 + 6 * agil : role === 2 ? 12 + 3 * tac + 3 * agil : role === 3 ? 6 : 0;
  let cote = 0;
  if (best) { pl.model.updateMatrixWorld(true); _loc.set(best.q.p[0] + pl.model.position.x - s.p[0], pl.model.position.y, best.q.p[2] + pl.model.position.z - s.p[2]); pl.model.worldToLocal(_loc); cote = -_loc.x > 0 ? 1 : -1; }
  const w = best ? clamp01((1.8 - best.d) / 0.8) : 0, k = 1 - Math.exp(-Math.max(0, dt) / 0.2);
  const C = (pl._duelBas ??= { w: 0, drop: 0, lean: 0, cote: 0, g: 1 });
  C.w += (w - C.w) * k; C.drop += (drop - C.drop) * k; C.lean += (lean - C.lean) * k; C.cote += (cote - C.cote) * k;
  // le porteur au contact est presque toujours DANS un geste de dribble (131 images sur 143, mesuré) : un geste du dribble ou du contrôle
  // (familles skill, control) garde ses jambes et son bassin (ses pieds visent le ballon), le buste et les bras prennent la garde basse
  const gl = pl.gestureLayer, haut = gl?.active && /^(duelCorps|protection)/.test(gl.spec?.name ?? ''), fam = gl?.active && !haut ? gl.spec?.family : null;
  const kg = 1 - Math.exp(-Math.max(0, dt) / 0.12), buste = !gl?.active || haut || fam === 'skill' || fam === 'control';
  C.g += ((gl?.active && !haut ? 0 : 1) - C.g) * kg; C.gb = (C.gb ?? 1) + ((buste ? 1 : 0) - (C.gb ?? 1)) * kg;
  const a = C.w * C.gb; if (a < 1e-3) return;
  const B = osBas(pl); if (!B) return;
  if (pl.hipsNudge && C.w * C.g > 1e-3) pl.hipsNudge([0, -C.drop * C.w * C.g, 0]);   // (352) essayé : le bassin descendu PAR-DESSUS le geste de dribble (+2 cm, le pied qui joue enfoncé de 1 cm) — c'est le générateur qui l'abaisse (specBas)
  pl.model.getWorldDirection(_fw); _fw.y = 0; _fw.normalize(); _fw.negate(); _lat.crossVectors(_up, _fw).normalize();
  tourne(B.Spine, _lat, C.lean * a * 0.6 * D2R); tourne(B.Spine1, _lat, C.lean * a * 0.4 * D2R);
  if (!haut) {                                                                      // (en geste de dribble : par-dessus le geste) les bras : l'équilibre des deux côtés, celui de l'adversaire vers lui
    const eq = 14 + 10 * agil, tient = (role === 3 ? 6 : 14) + 16 * frc, gauche = C.cote > 0 ? 1 : 0, droite = 1 - gauche, m = Math.min(1, Math.abs(C.cote));
    tourne(B.LeftArm, _fw, (eq + tient * gauche * m) * a * D2R); tourne(B.RightArm, _fw, -(eq + tient * droite * m) * a * D2R);
  }
}

// LE GESTE DE DRIBBLE BAS SOUS PRESSION (352). Le porteur au contact est dans un geste de dribble 131 images sur 143 : sa garde est celle
// du CLIP. Abaisser le bassin au rendu par-dessus le clip gagnait 2 cm et enfonçait le pied qui joue (il suit le bassin, hors verrou).
// Ici le GÉNÉRATEUR : sous pression (adversaire debout à ≤ 2,5 m au départ du geste), le geste de la famille skill se joue dans sa variante BASSE — la même
// espèce, le style du joueur, l'affaissement du bassin × (1,8 + 0,6 × agilité) ou le plus profond que son contrat accepte, borné à 14 cm ; les jambes sont RE-RÉSOLUES par l'IK
// du générateur autour de ce bassin (les pieds restent sur leurs cibles), le contrat de l'espèce la juge (checkSkillGen). Mise en cache
// par joueur (`pl.moves['<geste>@bas']`). ?geste-haut : hier.
const ECHECS = {};
export function specBas(scene, pl, move, spec) {
  if (scene._gesteHaut || !spec || GENERATORS[move]?.family !== 'skill' || !pl.profile) return spec;
  const st = scene.state, s = pl.sim; let presse = false;
  for (const q of st.players) { if (q.team === s.team || q.keeper || (q.down ?? 0) > 0) continue; if (Math.hypot(q.p[0] - s.p[0], q.p[2] - s.p[2]) <= 2.5) { presse = true; break; } }   // 2,5 m : le geste de dribble PART avant le contact (à 1,5 m : 3 variantes jouées en 5 min)
  if (!presse) return spec;
  const k = move + '@bas';
  if (pl.moves[k] === undefined) {
    const K = SKILL_KINDS[move], d0 = (K?.dip ?? 0) * (pl.style.dip ?? 1), agil = clamp01((1.15 - (s.skill?.appuiF ?? 1)) / 0.3);
    // la plus profonde que le contrat accepte : la cible, puis 1,8 · 1,5 · 1,3 · 1,15 (mesuré sur 40 styles : le crochet court passe à ×2,2,
    // −7 → −14 cm ; le passement et le crochet n'acceptent que ×1,3 — la sortie ramène la jambe en angles pendant que le bassin remonte,
    // la pointe passe sous la pelouse au-delà ; le Cruyff ×1,3 une fois sur trois)
    let v = null;
    // (une génération + son contrat : 4-14 ms) la mémoire des échecs PARTAGÉE entre joueurs : un palier refusé 3 fois sans jamais passer
    // pour cette espèce est sauté — une à deux tentatives après les premiers joueurs, pas quatre (54 ms au passement)
    const M = (ECHECS[move] ??= {});
    // (353) + le buste au-dessus du ballon, 8-12° par l'agilité ; le contrat qui le refuse (le crochet court : « les épaules mentent avant la
    // coupe » à 12°, 12 styles sur 40) le reprend à moitié avant de remonter le bassin
    const L = 8 + 4 * agil, paliers = [[1.8 + 0.6 * agil, L], [1.8 + 0.6 * agil, L / 2], [1.8, L / 2], [1.5, L / 2], [1.3, L / 2], [1.15, 0]];
    for (const [i, [F0, lean]] of paliers.entries()) {
      const F = d0 > 1e-3 ? Math.min(F0, 0.14 / d0) : 1; if (F <= 1.05) break;
      const m = (M[i] ??= { ko: 0, ok: 0 }); if (m.ko >= 3 && !m.ok) continue;
      try { const c = GENERATORS[move].generate(pl.profile, { style: { ...pl.style, dip: (pl.style.dip ?? 1) * F, bas: true, basLean: scene._busteHaut ? 0 : lean } }); if (GENERATORS[move].check?.(c, pl.profile)?.ok !== false) { v = c; v.bas = F; m.ok++; break; } m.ko++; } catch { m.ko++; }
    }
    pl.moves[k] = v;                                                                 // null : pas de variante (l'espèce sans affaissement, ou refusée par son contrat)
  }
  return pl.moves[k] ?? spec;
}
