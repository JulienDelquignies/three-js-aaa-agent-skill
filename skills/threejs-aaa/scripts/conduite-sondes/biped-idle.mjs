// LES GESTES GÉNÉRÉS SUR LE BIPED ROCKETBOX (le rig du duel), SANS NAVIGATEUR : le profil tiré du vrai .glb (rig-bip01 + motionProfileOf,
// le chemin de la scène), chaque geste généré sur CE profil passé à son contrat (checkSkillGen / GENERATORS.check) et, par cinématique
// directe, le pied d'appui et le pied actif aux instants clés. Usage : node biped-gestes.mjs [glb=foot-18.glb] [geste,…]
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as THREE from '../../../../examples/showcase/node_modules/three/build/three.webgpu.js';
import { clone as cloneSkinned } from '../../../../examples/showcase/node_modules/three/examples/jsm/utils/SkeletonUtils.js';
import { adaptBip01 } from '../../../../examples/showcase/src/engine/rig-bip01.js';
import { setCloner, rigBones } from '../../../../examples/showcase/src/engine/squad.js';
import { fkPose } from '../../../../examples/showcase/src/engine/motion-rig.js';
import { motionProfileOf, GENERATORS } from '../../../../examples/showcase/src/engine/motion-cast.js';
import { eulerToQuat } from '../../../../examples/showcase/src/engine/animkit.js';
setCloner(cloneSkinned);
const [GLB = 'foot-18.glb', LISTE = 'arretSemelle,semelleRoule,semelleRouleOut,tireSemelle,rateau,passementJambes,crochet,frappe'] = process.argv.slice(2);
const PUB = fileURLToPath(new URL('../../../../examples/showcase/public/rocketbox/', import.meta.url));
function loadRig(file) {
  const b = readFileSync(PUB + file), len = b.readUInt32LE(12), j = JSON.parse(b.subarray(20, 20 + len).toString()), joints = new Set(j.skins[0].joints);
  const objs = j.nodes.map((n, i) => { const o = joints.has(i) ? new THREE.Bone() : new THREE.Object3D(); o.name = THREE.PropertyBinding.sanitizeNodeName(n.name || ''); if (n.translation) o.position.fromArray(n.translation); if (n.rotation) o.quaternion.fromArray(n.rotation); if (n.scale) o.scale.fromArray(n.scale); return o; });
  j.nodes.forEach((n, i) => (n.children || []).forEach((c) => objs[i].add(objs[c])));
  const root = new THREE.Group(); for (const i of j.scenes[0].nodes) root.add(objs[i]); root.updateMatrixWorld(true); return root;
}
const root = loadRig(GLB); adaptBip01(root, { faces: '+Z' }); const tpl = new THREE.Group(); root.rotation.y = Math.PI; tpl.add(root); tpl.updateMatrixWorld(true);
const P = motionProfileOf({ bones: rigBones(tpl), scale: 1, spec: { name: GLB } }, []);
import { idlePose } from '../../../../examples/showcase/src/engine/motion-idle.js';
const r3 = (v) => v.map((x) => +x.toFixed(3));
for (const [side, at] of [['Right', [0.10, -0.28]], ['Right', [-0.14, -0.28]], ['Left', [-0.10, -0.28]], ['Left', [0.14, -0.28]], [null, null]]) {
  const r = idlePose(P, 1.0, 'pausa', undefined, side ? { override: { raise: { side, at, toe: 8, dz: 0.1 } } } : {});
  const W = fkPose(P, r.q ?? r.J, r.hips);
  console.log(`pausa ${side ?? 'sans raise'} ${at ?? ''} : pied G ${r3(W.LeftFoot.p)} pied D ${r3(W.RightFoot.p)} ; cibles ${JSON.stringify(Object.fromEntries(Object.entries(r.feet).map(([k, v]) => [k, r3(v.target)])))}`);
}
