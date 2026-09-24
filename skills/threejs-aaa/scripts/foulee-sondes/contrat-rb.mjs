// Les contrats de foulée (checkGaitGen) sur le PROFIL d'un joueur Rocketbox du duel (foot-18), griffé 1, de 1,4 à 8 m/s + virages/frein.
import { readFileSync } from 'node:fs';
const S = '/home/delkit/DelkIT/skill-1v1/';
const THREE = await import(S + 'examples/showcase/node_modules/three/build/three.webgpu.js');
const { adaptBip01 } = await import(S + 'examples/showcase/src/engine/rig-bip01.js');
const { rigBones } = await import(S + 'examples/showcase/src/engine/squad.js');
const { motionProfileOf } = await import(S + 'examples/showcase/src/engine/motion-cast.js');
const { checkGaitGen, gaitLegK, gaitCycleSpec, gaitStyleFromSeed } = await import(S + 'examples/showcase/src/engine/motion-gait.js');
const { checkClip, resolveTracks } = await import(S + 'examples/showcase/src/engine/animkit.js').catch(() => ({}));
const file = process.argv[2] || 'foot-18.glb';
const b = readFileSync(S + 'examples/showcase/public/rocketbox/' + file), len = b.readUInt32LE(12), j = JSON.parse(b.subarray(20, 20 + len).toString());
const joints = new Set(j.skins[0].joints);
const objs = j.nodes.map((n, i) => { const o = joints.has(i) ? new THREE.Bone() : new THREE.Object3D(); o.name = THREE.PropertyBinding.sanitizeNodeName(n.name || ''); if (n.translation) o.position.fromArray(n.translation); if (n.rotation) o.quaternion.fromArray(n.rotation); if (n.scale) o.scale.fromArray(n.scale); return o; });
j.nodes.forEach((n, i) => (n.children || []).forEach((c) => objs[i].add(objs[c])));
const root = new THREE.Group(); for (const i of j.scenes[0].nodes) root.add(objs[i]);
adaptBip01(root, { faces: '+Z' });
const t = new THREE.Group(); root.rotation.y = Math.PI; t.add(root); t.updateMatrixWorld(true);
const P = motionProfileOf({ bones: rigBones(t), scale: 1, spec: {} });
console.log(file, 'jambe', (P.lengths.thigh + P.lengths.shank).toFixed(3), 'legK', gaitLegK(P).toFixed(3));
let red = 0, n = 0;
const cases = [];
for (const v of [1.4, 3, 4.5, 6, 7, 8]) cases.push([v, 0, {}]);
for (const v of [3, 4.5, 6, 8]) for (const o of [{ turn: 6 }, { brake: 1 }, { turn: -8 }]) cases.push([v, 0, o]);
cases.push([-3, 0, {}], [0, 2, {}]);
for (const [vF, vR, o] of cases) for (const seed of [1, 2, 3, 4]) {
  const r = checkGaitGen(P, { vF, vR, style: gaitStyleFromSeed(seed * 7919), opts: { griffe: 1, ...o } }); n++;
  if (!r.ok) { red++; if (red <= 12) console.log('✗', vF, vR, JSON.stringify(o), 'graine', seed, '—', r.issues.join(' ; ').slice(0, 160)); }
}
console.log(`${n - red} ✓ / ${red} ✗ (contrats de foulée, griffé)`);
if (checkClip) for (const v of [4.5, 6.5, 8]) { const c = checkClip(resolveTracks(gaitCycleSpec(P, { vF: v, vR: 0, opts: { griffe: 1 } }))); console.log('checkClip', v, c.ok ? 'ok' : c.issues.join(' ; ')); }
