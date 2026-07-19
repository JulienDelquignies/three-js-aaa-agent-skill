#!/usr/bin/env node
// verify-outfit.mjs — the layered-clothing builder (engine/outfit.js): the long coat generated
// around a rig's bind pose must pass its DOUBLE gate — meshkit geometry contract per part
// (closed, outward, budget) AND coverage/skinning contract (weights normalized onto real bones,
// hem BELOW the knee = truly long, sleeves to the wrists). Named sabotages prove the gate bites.
import * as THREE from '../../../examples/showcase/node_modules/three/build/three.webgpu.js';
import { buildLongCoat, checkOutfit } from '../../../examples/showcase/src/engine/outfit.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };

// a metre-scale T-pose humanoid (shanon-like frames: RootNode parent, no armature rotation)
function makeRig() {
  const root = new THREE.Group();
  const rn = new THREE.Object3D(); rn.name = 'RootNode'; root.add(rn);
  const mk = (name, parent, p) => { const b = new THREE.Bone(); b.name = 'mixamorig5' + name; b.position.set(...p); parent.add(b); return b; };
  const hips = mk('Hips', rn, [0, 0.93, 0.01]);
  const spine = mk('Spine', hips, [0, 0.1, 0]);
  const spine1 = mk('Spine1', spine, [0, 0.11, 0]);
  const spine2 = mk('Spine2', spine1, [0, 0.12, 0]);
  const neck = mk('Neck', spine2, [0, 0.13, 0]);
  mk('Head', neck, [0, 0.1, 0.02]);
  for (const [s, sx] of [['Left', 1], ['Right', -1]]) {
    const sh = mk(`${s}Shoulder`, spine2, [0.06 * sx, 0.08, 0]);
    const arm = mk(`${s}Arm`, sh, [0.12 * sx, 0, 0]);
    const fa = mk(`${s}ForeArm`, arm, [0.26 * sx, 0, 0]);
    mk(`${s}Hand`, fa, [0.24 * sx, 0, 0]);
    const ul = mk(`${s}UpLeg`, hips, [0.09 * sx, -0.06, 0]);
    const leg = mk(`${s}Leg`, ul, [0, -0.38, 0]);
    mk(`${s}Foot`, leg, [0, -0.42, 0]);
  }
  root.updateMatrixWorld(true);
  return root;
}

{
  const rig = makeRig();
  const coat = buildLongCoat(rig);
  ok('manteau construit (4 pièces : corps, col, 2 manches)', coat.meshes.length === 4, coat.check.issues[0] || '');
  ok('contrat global OK (géométrie + poids + couverture)', coat.check.ok, coat.check.issues.join(' | ') || '');
  for (const p of coat.meshes) ok(`  pièce « ${p.name} » : contrat meshkit (fermée, volume positif)`, p.contract.ok, p.contract.issues[0] || '');
  const kneeY = 0.93 - 0.06 - 0.38;
  ok(`ourlet sous le genou (${coat.measures.hemY.toFixed(2)} < ${kneeY.toFixed(2)})`, coat.measures.hemY < kneeY);
  ok('le groupe est un vrai objet scène (SkinnedMesh × 4, squelette lié)', coat.group.children.length === 4 && coat.group.children.every((c) => c.isSkinnedMesh && c.skeleton.bones.length > 0));
  ok('déterministe (mêmes mesures au rebuild)', JSON.stringify(buildLongCoat(makeRig()).measures) === JSON.stringify(coat.measures));

  // ---- named sabotages
  {
    const c2 = buildLongCoat(makeRig(), { hem: 0.75 });            // hem ABOVE the knee
    ok('sabotage « manteau court » attrapé', !c2.check.ok && c2.check.issues.some((i) => i.includes('LONG')), c2.check.issues[0] || 'RIEN');
  }
  {
    const c2 = buildLongCoat(makeRig());
    const sw = c2.meshes[0].mesh.geometry.attributes.skinWeight;
    sw.array[0] = 3;                                               // denormalize one vertex
    const r = checkOutfit(c2.meshes, makeRig(), c2.measures);
    ok('sabotage « poids dénormalisés » attrapé', !r.ok && r.issues.some((i) => i.includes('normalisés')), r.issues[0] || 'RIEN');
  }
  {
    const c2 = buildLongCoat(makeRig());
    c2.meshes[1].mesh.geometry.attributes.skinIndex.array[2] = 9999;
    const r = checkOutfit(c2.meshes, makeRig(), c2.measures);
    ok('sabotage « index d\'os fantôme » attrapé', !r.ok && r.issues.some((i) => i.includes('invalide')), r.issues[0] || 'RIEN');
  }
  {
    const c2 = buildLongCoat(makeRig());
    const pos = c2.meshes.find((p) => p.name === 'mancheG').mesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setX(i, pos.getX(i) * 0.35);   // sleeve stops at the elbow
    const r = checkOutfit(c2.meshes, makeRig(), c2.measures);
    ok('sabotage « manche courte » attrapé', !r.ok && r.issues.some((i) => i.includes('manche')), r.issues[0] || 'RIEN');
  }
  {
    const rigless = new THREE.Group();                             // no bones at all
    const c2 = buildLongCoat(rigless);
    ok('rig sans os → refus propre (pas de crash)', !c2.check.ok && c2.group === null, c2.check.issues[0] || '');
  }
}

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
