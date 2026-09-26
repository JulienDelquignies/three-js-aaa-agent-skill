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
const fk = (k) => fkPose(P, Object.fromEntries(Object.entries(k.pose).map(([bn, e]) => [bn, eulerToQuat(e)])), k.hips ?? [0, 0, 0]);
const r3 = (v) => v.map((x) => +x.toFixed(3));
console.log(`${GLB} : repos pied gauche ${r3(P.bones.LeftFoot.bindP)}, droit ${r3(P.bones.RightFoot.bindP)}, sol ${P.lengths.groundY?.toFixed?.(3)}`);
for (const mv of LISTE.split(',')) {
  const G = GENERATORS[mv]; if (!G) { console.log(mv, ': non généré'); continue; }
  const S = G.generate(P, {}), C = G.check(S, P, {});
  const at = (t) => { const k = S.keys.reduce((b, x) => (Math.abs(x.t - t) < Math.abs(b.t - t) ? x : b), S.keys[0]); return fk(k); };
  const tc = S.contact, W0 = at(0), Wc = at(tc), Wm = at((tc + S.duration) / 2);
  console.log(`${mv.padEnd(16)} contrat ${C.ok ? 'OK' : '✗ ' + C.issues.slice(0, 3).join(' | ')}\n   appui G : t0 ${r3(W0.LeftFoot.p)} contact ${r3(Wc.LeftFoot.p)} milieu ${r3(Wm.LeftFoot.p)} ; actif D : contact ${r3(Wc.RightFoot.p)}`);
}
