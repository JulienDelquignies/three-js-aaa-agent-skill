#!/usr/bin/env node
// verify-bip01.mjs — engine/rig-bip01.js : un squelette Biped (3ds Max « Bip01 », les personnages Microsoft
// Rocketbox) présenté au moteur COMME LE RIG DE RÉFÉRENCE. Sur les VRAIS fichiers (examples/showcase/public/
// rocketbox : joe, marta, foot-18, foot-10-ciel), hiérarchie des nœuds reconstruite comme GLTFLoader la livre (noms assainis). Une loi
// par écart — chacune avec le sabotage qui doit la faire tomber :
//   NOMS       les 22 os canoniques, trouvés par le moteur (rigBones)          ← sabotage : le rig brut
//   TOPOLOGIE  pencher le tronc ne déplace pas les pieds ; l'attache ne bouge
//              aucune articulation                                            ← sabotage : cuisses remises sous Spine
//   REPOS      chaque segment fonctionnel sur la direction de la référence     ← sabotage : le rig brut (pose en A)
//   PROFIL     la sonde des signes (checkProfile) passe sur le rig vivant      ← sabotage : le rig brut
//   MAIN       chaque doigt fléchi vers la PAUME                               ← sabotage : main: false
//   REGARD     le regard par le profil tourne la tête là où il vise, sans
//              roulis ; sur shanon il égale le regard sondé d'hier (0°)        ← sabotage : le regard sans profil
//   SQUAD      prepare() avant le wrapper, taille 'natif', défauts remontés    ← sabotage : un os Biped retiré
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as THREE from '../../../examples/showcase/node_modules/three/build/three.webgpu.js';
import { clone as cloneSkinned } from '../../../examples/showcase/node_modules/three/examples/jsm/utils/SkeletonUtils.js';
import { adaptBip01, BIP01_ALIGN } from '../../../examples/showcase/src/engine/rig-bip01.js';
import { loadSquad, setCloner, rigBones } from '../../../examples/showcase/src/engine/squad.js';
import { CANON, checkProfile, rx, ry } from '../../../examples/showcase/src/engine/motion-rig.js';
import { motionProfileOf } from '../../../examples/showcase/src/engine/motion-cast.js';
import { SHANON_PROFILE } from '../../../examples/showcase/src/engine/motion-profile-shanon.js';
import { Gaze } from '../../../examples/showcase/src/engine/gaze.js';
import { quatMul } from '../../../examples/showcase/src/engine/vecmath.js';

setCloner(cloneSkinned);
let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };
const PUB = fileURLToPath(new URL('../../../examples/showcase/public/rocketbox/', import.meta.url));

/** La hiérarchie d'un .glb telle que GLTFLoader la livre : nœuds TRS, os pour les articulations du skin, noms
 *  assainis (PropertyBinding.sanitizeNodeName) ; un maillage skinné boîte (1,75 m) pour la mesure du squad. */
function loadRig(file, { drop = null } = {}) {
  const b = readFileSync(PUB + file), len = b.readUInt32LE(12), j = JSON.parse(b.subarray(20, 20 + len).toString());
  const joints = new Set(j.skins[0].joints);
  const objs = j.nodes.map((n, i) => {
    const o = joints.has(i) ? new THREE.Bone() : new THREE.Object3D();
    o.name = THREE.PropertyBinding.sanitizeNodeName(n.name || '');
    if (n.translation) o.position.fromArray(n.translation);
    if (n.rotation) o.quaternion.fromArray(n.rotation);
    if (n.scale) o.scale.fromArray(n.scale);
    return o;
  });
  j.nodes.forEach((n, i) => (n.children || []).forEach((c) => { if (!(drop && j.nodes[c].name === drop)) objs[i].add(objs[c]); }));
  const root = new THREE.Group();
  for (const i of j.scenes[0].nodes) root.add(objs[i]);
  root.updateMatrixWorld(true);
  const bones = []; root.traverse((o) => { if (o.isBone) bones.push(o); });
  const geo = new THREE.BoxGeometry(0.45, 1.75, 0.3); geo.translate(0, 0.875, 0);
  const n = geo.attributes.position.count;
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(new Uint16Array(n * 4), 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(Float32Array.from({ length: n * 4 }, (_, i) => (i % 4 === 0 ? 1 : 0)), 4));
  const sk = new THREE.SkinnedMesh(geo, new THREE.MeshBasicMaterial()); root.add(sk);
  sk.bind(new THREE.Skeleton(bones)); root.updateMatrixWorld(true);
  return root;
}
const byName = (root) => { const m = new Map(); root.traverse((o) => { if (o.isBone) m.set(o.name, o); }); return m; };
const wpos = (o) => o.getWorldPosition(new THREE.Vector3());
const toChar = (v) => new THREE.Vector3(-v.x, v.y, -v.z);   // fichier (regarde +Z) → repère personnage (avant −Z)
const segDeg = (m, a, c) => {
  const u = toChar(wpos(m.get(c)).sub(wpos(m.get(a)))).normalize(), rb = SHANON_PROFILE.bones;
  const t = new THREE.Vector3(...rb[c].bindP).sub(new THREE.Vector3(...rb[a].bindP)).normalize();
  return Math.acos(THREE.MathUtils.clamp(u.dot(t), -1, 1)) * 180 / Math.PI;
};
/** Le template tel que squad.js le fait : wrapper tourné de 180° (le fichier regarde +Z). */
const wrap = (root) => { const t = new THREE.Group(); root.rotation.y = Math.PI; t.add(root); t.updateMatrixWorld(true); return t; };

for (const file of ['joe.glb', 'marta.glb', 'foot-18.glb', 'foot-10-ciel.glb']) {
  console.log(`\n— ${file} —`);

  // ---- NOMS
  const raw = loadRig(file), rawBones = rigBones(raw);
  const root = loadRig(file), before = byName(root);
  const keep = ['Bip01_Pelvis', 'Bip01_Spine', 'Bip01_Spine1', 'Bip01_Spine2', 'Bip01_Neck', 'Bip01_Head', 'Bip01_L_Clavicle', 'Bip01_R_Clavicle', 'Bip01_L_UpperArm', 'Bip01_R_UpperArm', 'Bip01_L_Thigh', 'Bip01_R_Thigh'];
  const p0 = new Map(keep.map((n) => [before.get(n), wpos(before.get(n))]));
  const rep = adaptBip01(root, { faces: '+Z' });
  const bones = rigBones(root);
  ok('NOMS : les 22 os canoniques trouvés par le moteur', CANON.every((c) => bones.has(c)) && rep.renommes === 22, `${rep.renommes} renommés`);
  ok('NOMS (sabotage : rig brut) : le moteur n\'y trouve pas les os canoniques', CANON.filter((c) => rawBones.has(c)).length === 0);

  // ---- TOPOLOGIE
  ok('TOPOLOGIE : cuisses filles du bassin, clavicules filles de Spine2',
    bones.get('LeftUpLeg').parent === bones.get('Hips') && bones.get('RightUpLeg').parent === bones.get('Hips') && bones.get('LeftShoulder').parent === bones.get('Spine2') && bones.get('RightShoulder').parent === bones.get('Spine2'));
  let moved = 0; for (const [o, p] of p0) moved = Math.max(moved, wpos(o).distanceTo(p));
  ok('TOPOLOGIE : rattacher ne déplace aucune articulation (le maillage ne bouge pas)', moved < 1e-6, `${(moved * 1000).toFixed(4)} mm`);
  const lean = (m) => {
    const f0 = wpos(m.get('LeftFoot')), sp = m.get('Spine'), q = sp.quaternion.clone();
    const axis = new THREE.Vector3(1, 0, 0);   // pencher le tronc de 25° (rotation monde autour de l'axe latéral)
    const wq = sp.getWorldQuaternion(new THREE.Quaternion()), pq = sp.parent.getWorldQuaternion(new THREE.Quaternion());
    sp.quaternion.copy(pq.invert().multiply(new THREE.Quaternion().setFromAxisAngle(axis, 25 * Math.PI / 180).multiply(wq)));
    root.updateMatrixWorld(true); const d = wpos(m.get('LeftFoot')).distanceTo(f0);
    sp.quaternion.copy(q); root.updateMatrixWorld(true); return d;
  };
  const dLean = lean(bones);
  ok('TOPOLOGIE : pencher le tronc de 25° laisse le pied en place', dLean < 1e-6, `${(dLean * 100).toFixed(3)} cm`);
  {
    const sab = loadRig(file); adaptBip01(sab, { faces: '+Z' }); const m = rigBones(sab);
    m.get('Spine').attach(m.get('LeftUpLeg')); sab.updateMatrixWorld(true);   // la topologie Biped remise
    const f0 = wpos(m.get('LeftFoot')), sp = m.get('Spine');
    const wq = sp.getWorldQuaternion(new THREE.Quaternion()), pq = sp.parent.getWorldQuaternion(new THREE.Quaternion());
    sp.quaternion.copy(pq.invert().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 25 * Math.PI / 180).multiply(wq)));
    sab.updateMatrixWorld(true); const d = wpos(m.get('LeftFoot')).distanceTo(f0);
    ok('TOPOLOGIE (sabotage : cuisse sous Spine) : le tronc penché emporte le pied', d > 0.05, `${(d * 100).toFixed(1)} cm`);
  }

  // ---- REPOS
  const worst = Math.max(...BIP01_ALIGN.map(([a, c]) => segDeg(bones, a, c)));
  ok('REPOS : bras, avant-bras, jambes, pieds sur la direction de la référence', worst < 0.5, `pire ${worst.toFixed(3)}°`);
  {
    const m = new Map(); raw.traverse((o) => { if (o.isBone) m.set(o.name.replace('Bip01_L_', 'Left').replace('Bip01_R_', 'Right'), o); });
    const al = { LeftUpperArm: 'LeftArm', LeftForearm: 'LeftForeArm', LeftHand: 'LeftHand' };
    const mm = new Map([...m].map(([k, v]) => [al[k] ?? k, v]));
    const d = segDeg(mm, 'LeftArm', 'LeftForeArm');
    ok('REPOS (sabotage : rig brut) : le bras en A s\'écarte de la référence', d > 30, `${d.toFixed(1)}°`);
  }

  // ---- MAIN
  {
    const flat = loadRig(file); adaptBip01(flat, { faces: '+Z', main: false });
    const a = byName(flat), c = byName(root);
    let minIn = Infinity, n = 0;
    for (const s of ['L', 'R']) {
      const i1 = wpos(a.get(`Bip01_${s}_Finger1`)), i4 = wpos(a.get(`Bip01_${s}_Finger4`)), k4 = i4.clone().sub(i1).normalize();
      for (const k of [1, 2, 3, 4]) {
        const p2 = wpos(a.get(`Bip01_${s}_Finger${k}2`)), p1 = wpos(a.get(`Bip01_${s}_Finger${k}1`));
        const d = p2.clone().sub(p1).normalize(), palm = s === 'R' ? d.clone().cross(k4) : k4.clone().cross(d);
        const dz = wpos(c.get(`Bip01_${s}_Finger${k}2`)).sub(p2).dot(palm.normalize());
        minIn = Math.min(minIn, dz); n++;
      }
    }
    ok('MAIN : les 8 doigts fléchis vers la paume (≥ 1 cm)', minIn > 0.01 && n === 8, `pire ${(minIn * 100).toFixed(1)} cm`);
    const f2 = loadRig(file); adaptBip01(f2, { faces: '+Z', main: false });
    const g = byName(f2); const same = wpos(g.get('Bip01_L_Finger22')).distanceTo(wpos(a.get('Bip01_L_Finger22')));
    ok('MAIN (sabotage : main: false) : aucun doigt ne bouge', same < 1e-9);
  }

  // ---- PROFIL (le chemin de la scène : motionProfileOf sur le template)
  const tpl = wrap(root);
  const entry = { bones: rigBones(tpl), scale: 1, spec: { name: file } };
  const report = [];
  const P = motionProfileOf(entry, report);
  const cp = checkProfile(P);
  ok('PROFIL : la sonde des signes passe (checkProfile)', cp.ok && report.length === 0, cp.issues.join(' ; '));
  ok('PROFIL : longueurs humaines (cuisse, tibia, bassin)', P.lengths.thigh > 0.35 && P.lengths.thigh < 0.5 && P.lengths.shank > 0.35 && P.lengths.shank < 0.5 && P.lengths.hipsY > 0.85 && P.lengths.hipsY < 1.0,
    `cuisse ${P.lengths.thigh.toFixed(3)} tibia ${P.lengths.shank.toFixed(3)} bassin ${P.lengths.hipsY.toFixed(3)} m`);
  {
    const sab = wrap(loadRig(file)), e2 = { bones: rigBones(sab), scale: 1, spec: { name: 'brut' } }, r2 = [];
    motionProfileOf(e2, r2);
    ok('PROFIL (sabotage : rig brut) : la sonde le refuse', r2.length > 0, (r2[0] || '').slice(0, 90));
  }

  // ---- REGARD : la tête vise la cible (lacet sim à droite, tangage vers le haut), sans roulis
  const aim = (gazeProfile) => {
    const t2 = wrap(loadRig(file)); adaptBip01(t2.children[0], { faces: '+Z' }); t2.updateMatrixWorld(true);
    const m = rigBones(t2), head = m.get('Head');
    const B = head.getWorldQuaternion(new THREE.Quaternion());
    const e2 = { bones: m, scale: 1, spec: { name: 'r' } }, P2 = motionProfileOf(e2);
    const g = new Gaze({ neck: m.get('Neck'), head, profile: gazeProfile ? P2 : null });
    const hp = wpos(head), tgt = [hp.x + 1, hp.y + 0.3, hp.z - 2];   // devant-droite-haut ; avant = −Z, lacet sim = −90°
    // en jeu la pose est RÉÉCRITE à chaque image (mixer, foulée) avant le regard, qui compose sur le courant :
    // sans remise au repos, 90 mises à jour se cumuleraient (l'instrument l'a d'abord fait — 38° à gauche)
    const rN = m.get('Neck').quaternion.clone(), rH = head.quaternion.clone();
    for (let i = 0; i < 90; i++) { m.get('Neck').quaternion.copy(rN); head.quaternion.copy(rH); g.update(1 / 30, [hp.x, hp.y, hp.z], tgt, -Math.PI / 2); }
    t2.updateMatrixWorld(true);
    const D = head.getWorldQuaternion(new THREE.Quaternion()).multiply(B.clone().invert());   // rotation monde depuis le bind
    const f = new THREE.Vector3(0, 0, -1).applyQuaternion(D), up = new THREE.Vector3(0, 1, 0).applyQuaternion(D);
    const yawR = Math.atan2(f.x, -f.z) * 180 / Math.PI, pitch = Math.asin(f.y) * 180 / Math.PI;
    const side = new THREE.Vector3().crossVectors(f, new THREE.Vector3(0, 1, 0)).normalize();
    const roll = Math.asin(THREE.MathUtils.clamp(up.dot(side), -1, 1)) * 180 / Math.PI;
    return { yawR, pitch, roll, want: { yaw: g.yaw, pitch: g.pitch } };
  };
  {
    const r = aim(true);
    const e = Math.max(Math.abs(r.yawR - r.want.yaw), Math.abs(r.pitch - r.want.pitch));
    ok('REGARD : la tête tourne À DROITE et LÈVE comme le regard le veut, sans roulis', r.yawR > 20 && r.pitch > 4 && e < 1.5 && Math.abs(r.roll) < 1,
      `lacet ${r.yawR.toFixed(1)}° (voulu ${r.want.yaw.toFixed(1)}), tangage ${r.pitch.toFixed(1)}° (voulu ${r.want.pitch.toFixed(1)}), roulis ${r.roll.toFixed(2)}°`);
    const s = aim(false);
    const es = Math.max(Math.abs(s.yawR - s.want.yaw), Math.abs(s.pitch - s.want.pitch), Math.abs(s.roll));
    ok('REGARD (sabotage : axes sondés de shanon sur le Biped) : la tête vise de travers', es > 5,
      `lacet ${s.yawR.toFixed(1)}°, tangage ${s.pitch.toFixed(1)}°, roulis ${s.roll.toFixed(1)}°`);
  }
}

// ---- REGARD sur shanon : le chemin par le profil égale les axes sondés d'hier
{
  console.log('\n— regard shanon —');
  const bone = (q) => ({ quaternion: { x: q[0], y: q[1], z: q[2], w: q[3], set(x, y, z, w) { this.x = x; this.y = y; this.z = z; this.w = w; } } });
  let worst = 0;
  for (const tgt of [[3, 0.2, 1], [-2, 1.9, 4], [0.5, 0, -3], [4, 3, 0]]) for (const yaw of [0, 1.2, -2.5]) {
    const a = new Gaze({ neck: bone([0.05, 0.1, -0.02, 0.993]), head: bone([-0.08, 0.02, 0.03, 0.996]) });
    const b = new Gaze({ neck: bone([0.05, 0.1, -0.02, 0.993]), head: bone([-0.08, 0.02, 0.03, 0.996]), profile: SHANON_PROFILE });
    const rest = (x) => { x.neck.quaternion.set(0.05, 0.1, -0.02, 0.993); x.head.quaternion.set(-0.08, 0.02, 0.03, 0.996); };
    for (let i = 0; i < 30; i++) { rest(a); rest(b); a.update(1 / 30, [0, 1.6, 0], tgt, yaw); b.update(1 / 30, [0, 1.6, 0], tgt, yaw); }
    for (const k of ['neck', 'head']) { const p = a[k].quaternion, q = b[k].quaternion; worst = Math.max(worst, 2 * Math.acos(Math.min(1, Math.abs(p.x * q.x + p.y * q.y + p.z * q.z + p.w * q.w))) * 180 / Math.PI); }
  }
  ok('REGARD : sur shanon, articulation × bind = axes sondés (12 cas, cou et tête)', worst < 1e-3, `${worst.toFixed(5)}°`);
  // (garde-fou du garde-fou : la composition utilisée est bien ry(−lacet) ⊗ rx(+tangage))
  ok('REGARD : ry ⊗ rx se compose dans l\'ordre d\'application', Math.abs(quatMul(ry(-30), rx(10))[3] - quatMul(rx(10), ry(-30))[3]) < 1e-9);
}

// ---- SQUAD : prepare() avant le wrapper, taille native, défauts remontés
{
  console.log('\n— squad —');
  const track = (bone) => new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, [0, 1], [0, 0, 0, 1, 0, 0, 0, 1]);
  const clip = (name) => new THREE.AnimationClip(name, 1, [track('mixamorigHips')]);
  const donorRig = () => { const r = loadRig('joe.glb'); adaptBip01(r, { faces: '+Z' }); r.traverse((o) => { if (o.isBone && CANON.includes(o.name)) o.name = 'mixamorig' + o.name; }); return r; };
  const loader = (table) => ({ loadAsync: async (url) => { if (!table[url]) throw new Error(`404 ${url}`); return table[url](); } });
  const spec = (name, extra = {}) => ({ url: `${name}.glb`, faces: '+Z', name, height: 'natif', ownKit: true, prepare: (root) => adaptBip01(root, { faces: '+Z' }), ...extra });
  const sq = await loadSquad(loader({
    'donor.glb': () => ({ scene: donorRig(), animations: [clip('TPose'), clip('idle'), clip('walk'), clip('run')] }),
    'joe.glb': () => ({ scene: loadRig('joe.glb'), animations: [] }),
  }), { donor: 'donor.glb', height: 1.8, rigs: [spec('joe')] });
  const e = sq.entries[0];
  ok('SQUAD : prepare() a tourné avant le template (os canoniques dans le template)', e.bones.has('LeftUpLeg') && e.prepared?.renommes === 22);
  ok('SQUAD : taille \'natif\' — échelle 1, hauteur du fichier', Math.abs(e.scale - 1) < 1e-9 && Math.abs(e.height - e.srcHeight) < 1e-9, `${e.height.toFixed(3)} m`);
  ok('SQUAD : contrat vert sur le Biped adapté', sq.check.ok, sq.check.issues.join(' | '));
  const sab = await loadSquad(loader({
    'donor.glb': () => ({ scene: donorRig(), animations: [clip('TPose'), clip('idle'), clip('walk'), clip('run')] }),
    'bad.glb': () => ({ scene: loadRig('joe.glb', { drop: 'Bip01 L Toe0' }), animations: [] }),
  }), { donor: 'donor.glb', height: 1.8, rigs: [spec('bad', { url: 'bad.glb' })] }).catch((x) => ({ thrown: String(x) }));
  const issues = sab.check?.issues ?? [sab.thrown];
  ok('SQUAD (sabotage : un os Biped retiré) : le défaut de préparation remonte au contrat', issues.some((i) => /préparation du rig|LeftToeBase/.test(i || '')), (issues[0] || '').slice(0, 100));
}

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
