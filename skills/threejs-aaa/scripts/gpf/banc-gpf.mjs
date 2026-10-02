// LE BANC DES GESTES PORTÉS — chaque geste du duel CONTRE son port Gameplay Football, sur le VRAI rig du duel (le Biped Rocketbox
// adapté, le profil de la scène : rig-bip01 + motionProfileOf), sans navigateur. Pour chaque paire :
//   (1) le CONTRAT du geste (GENERATORS[nom].check — les clauses que le moteur impose à son propre geste, appliquées au port) ;
//   (2) le PORT est-il fidèle ? le pied du rig au contact contre le ballon de l'animation GPF (repère personnage, à l'échelle des
//       jambes) — la cheville GPF y est à 10-25 cm du centre du ballon (inventaire.mjs), le rig doit en être au même ordre ;
//   (3) la PELOUSE : le point le plus bas des pieds (cm, < 0 = sous le sol) ; l'APPUI : la dérive du pied d'appui (cm) ;
//   (4) la SOUPLESSE : vitesse et accélération angulaires des articulations (°/s, °/s²) à 120 Hz — p95 sur les os des jambes et du
//       tronc. Des clés à la main interpolées en slerp ont une vitesse CONSTANTE par morceaux : l'accélération y est en pics (les clés).
// Usage : node banc-gpf.mjs [glb=foot-18.glb] [json de sortie]
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as THREE from '../../../../examples/showcase/node_modules/three/build/three.webgpu.js';
import { clone as cloneSkinned } from '../../../../examples/showcase/node_modules/three/examples/jsm/utils/SkeletonUtils.js';
import { adaptBip01 } from '../../../../examples/showcase/src/engine/rig-bip01.js';
import { setCloner, rigBones } from '../../../../examples/showcase/src/engine/squad.js';
import { fkPose } from '../../../../examples/showcase/src/engine/motion-rig.js';
import { motionProfileOf, GENERATORS } from '../../../../examples/showcase/src/engine/motion-cast.js';
import { eulerToQuat } from '../../../../examples/showcase/src/engine/animkit.js';
import { GPF_GESTES, gpfBallInRig, touchFoot, parseGpfAnim, concatGpf, GPF_HIPS_Y } from '../../../../examples/showcase/src/engine/gpf-anim.js';
import { GPF_ANIMS } from '../../../../examples/showcase/src/engine/gpf-data.js';
import { quatAngle } from '../../../../examples/showcase/src/engine/vecmath.js';
setCloner(cloneSkinned);
const [GLB = 'foot-18.glb', OUT] = process.argv.slice(2);
const PUB = fileURLToPath(new URL('../../../../examples/showcase/public/rocketbox/', import.meta.url));
function loadRig(file) {
  const b = readFileSync(PUB + file), len = b.readUInt32LE(12), j = JSON.parse(b.subarray(20, 20 + len).toString()), joints = new Set(j.skins[0].joints);
  const objs = j.nodes.map((n, i) => { const o = joints.has(i) ? new THREE.Bone() : new THREE.Object3D(); o.name = THREE.PropertyBinding.sanitizeNodeName(n.name || ''); if (n.translation) o.position.fromArray(n.translation); if (n.rotation) o.quaternion.fromArray(n.rotation); if (n.scale) o.scale.fromArray(n.scale); return o; });
  j.nodes.forEach((n, i) => (n.children || []).forEach((c) => objs[i].add(objs[c])));
  const root = new THREE.Group(); for (const i of j.scenes[0].nodes) root.add(objs[i]); root.updateMatrixWorld(true); return root;
}
const root = loadRig(GLB); adaptBip01(root, { faces: '+Z' }); const tpl = new THREE.Group(); root.rotation.y = Math.PI; tpl.add(root); tpl.updateMatrixWorld(true);
const P = motionProfileOf({ bones: rigBones(tpl), scale: 1, spec: { name: GLB } }, []);
const ground = P.lengths.groundY, kLeg = (P.lengths.hipsY - ground) / GPF_HIPS_Y;

// l'échantillonneur d'un spec : la clé la plus proche n'est pas assez fine pour des accélérations — interpolation slerp entre clés
const poseAt = (S, t) => {
  const K = S.keys; let i = 1; while (i < K.length - 1 && K[i].t < t) i++;
  const a = K[i - 1], b = K[i], u = Math.max(0, Math.min(1, (t - a.t) / ((b.t - a.t) || 1)));
  const q = {}; for (const bn of Object.keys(b.pose)) { const qa = eulerToQuat(a.pose[bn] ?? b.pose[bn]), qb = eulerToQuat(b.pose[bn]); q[bn] = new THREE.Quaternion(...qa).slerp(new THREE.Quaternion(...qb), u).toArray(); }
  const h = (a.hips && b.hips) ? a.hips.map((v, j) => v + (b.hips[j] - v) * u) : (b.hips ?? [0, 0, 0]);
  return fkPose(P, q, h);
};
const OS = ['Hips', 'Spine1', 'Head', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot', 'LeftArm', 'RightArm'];
const p95 = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(0.95 * (s.length - 1))] ?? 0; };
function mesure(S, { support = 'Left' } = {}) {
  const hz = 120, dt = 1 / hz, W = [];
  for (let t = 0; t <= S.duration + 1e-9; t += dt) W.push(poseAt(S, t));
  let lowest = Infinity, lowAt = null; const sup0 = W[0][`${support}Foot`].p; let drift = 0;
  for (const [i, w] of W.entries()) { for (const [os, y] of [['LeftToeBase', w.LeftToeBase.p[1]], ['RightToeBase', w.RightToeBase.p[1]], ['LeftFoot', w.LeftFoot.p[1] - 0.04], ['RightFoot', w.RightFoot.p[1] - 0.04]]) if (y < lowest) { lowest = y; lowAt = `${os} à ${(i / hz).toFixed(2)} s`; } drift = Math.max(drift, Math.hypot(w[`${support}Foot`].p[0] - sup0[0], w[`${support}Foot`].p[2] - sup0[2])); }
  // vitesse / accélération angulaires (monde, repère personnage) de chaque os
  const vel = [], acc = [];
  let accMaxAt = '';
  for (const os of OS) { const v = []; for (let i = 1; i < W.length; i++) v.push(quatAngle(W[i - 1][os].q, W[i][os].q) * 180 / Math.PI / dt);
    vel.push(...v); for (let i = 1; i < v.length; i++) { const a = Math.abs(v[i] - v[i - 1]) / dt; if (a > Math.max(0, ...acc.slice(-1), accMaxAt ? +accMaxAt.split('|')[0] : 0)) accMaxAt = `${a.toFixed(0)}|${os} à ${(i * dt).toFixed(2)} s`; acc.push(a); } }
  const ic = Math.round(S.contact * hz), wc = W[Math.min(W.length - 1, ic)];
  return { accMaxAt: accMaxAt.split('|')[1], lowAt, lowest: (lowest - ground) * 100, drift: drift * 100, vel95: p95(vel), acc95: p95(acc), accMax: Math.max(...acc), wc, W };
}

// le ballon GPF au contact dans le repère du rig (gpf-anim.gpfBallInRig : le même cap retiré, la même échelle que le port)
function ballonGpf(cle) { const A = cle === 'glisse' ? concatGpf(parseGpfAnim(GPF_ANIMS.glisse), parseGpfAnim(GPF_ANIMS.releveDos)) : parseGpfAnim(GPF_ANIMS[cle]); return { ball: gpfBallInRig(A, P), ankle: touchFoot(A).dist }; }

const PAIRES = [['controleInterieur', 'trapFace', 'Left'], ['controleOriente', 'trapVirageGauche', 'Left'], ['tacle', 'glisse', null]];
const R = [];
const f1 = (x) => (Math.round(x * 10) / 10).toFixed(1);
console.log(`rig ${GLB} : bassin ${P.lengths.hipsY.toFixed(3)} m, sol ${ground.toFixed(3)}, cuisse ${P.lengths.thigh.toFixed(3)}, tibia ${P.lengths.shank.toFixed(3)} — échelle des jambes GPF → rig ×${kLeg.toFixed(3)}`);
for (const [nom, cle, support] of PAIRES) {
  const G = GENERATORS[nom];
  const Sd = G.generate(P, {}), Sg = GPF_GESTES[nom](P, {});
  const Cd = G.check(Sd, P, {}), Cg = G.check(Sg, P, {});
  const md = mesure(Sd, { support: support ?? 'Left' }), mg = mesure(Sg, { support: support ?? 'Left' });
  const bg = ballonGpf(cle), fc = mg.wc.RightFoot.p, tc = mg.wc.RightToeBase.p;
  const piedBallon = Math.hypot(fc[0] - bg.ball[0], fc[1] - bg.ball[1], fc[2] - bg.ball[2]);
  const rowFor = (S, C, m) => ({ duree: S.duration, contact: S.contact, cles: S.keys.length, contrat: C.ok ? 'OK' : C.issues, sousPelouse_cm: +f1(m.lowest), plusBas: m.lowAt, appuiDerive_cm: support ? +f1(m.drift) : null, vitesseP95: Math.round(m.vel95), accelP95: Math.round(m.acc95), accelMax: Math.round(m.accMax), accelMaxOu: m.accMaxAt,
    piedContact: m.wc.RightFoot.p.map((v) => +v.toFixed(3)) });
  const row = { geste: nom, gpf: cle, duel: rowFor(Sd, Cd, md), port: { ...rowFor(Sg, Cg, mg), piedBallon_cm: +f1(piedBallon * 100), chevilleBallonGpf_cm: +f1(bg.ankle * 100), ballonGpf: bg.ball.map((v) => +v.toFixed(3)), holdAt: Sg.holdAt ?? null } };
  R.push(row);
  console.log(`\n== ${nom}  (duel généré  ↔  port GPF ${cle})`);
  for (const [lab, x] of [['duel', row.duel], ['GPF ', row.port]]) {
    console.log(`  ${lab} ${x.duree.toFixed(2)} s, contact ${x.contact.toFixed(2)} s · contrat ${x.contrat === 'OK' ? 'OK' : '✗ ' + x.contrat.join(' | ')}`);
    console.log(`       pelouse ${x.sousPelouse_cm} cm (${x.plusBas}) · appui ${x.appuiDerive_cm ?? '—'} cm · vitesse ang. p95 ${x.vitesseP95}°/s · accél. p95 ${x.accelP95} °/s² (max ${x.accelMax}, ${x.accelMaxOu}) · pied D au contact ${JSON.stringify(x.piedContact)}`);
  }
  console.log(`  fidélité du port : cheville du rig à ${row.port.piedBallon_cm} cm du ballon GPF (cheville GPF : ${row.port.chevilleBallonGpf_cm} cm)${row.port.holdAt != null ? ` · pose couchée à ${row.port.holdAt.toFixed(2)} s` : ''}`);
}
if (OUT) writeFileSync(OUT, JSON.stringify(R, null, 1));
