// L'affaissement du bassin que le générateur CALCULE (meta.drop) pour joe, par vitesse — et qui le fixe : le pied posé devant
// (u = 0) ou le décollage derrière (fin d'appui). Sonde des paramètres (override) : pitchTO, roll, bias.
import { readFileSync } from 'node:fs';
const S = decodeURI(new URL('../../../../', import.meta.url).pathname) + '';
const THREE = await import(S + 'examples/showcase/node_modules/three/build/three.webgpu.js');
const { adaptBip01 } = await import(S + 'examples/showcase/src/engine/rig-bip01.js');
const { rigBones } = await import(S + 'examples/showcase/src/engine/squad.js');
const { motionProfileOf } = await import(S + 'examples/showcase/src/engine/motion-cast.js');
const { gaitPose, gaitParams, footPath, gaitLegK } = await import(S + 'examples/showcase/src/engine/motion-gait.js');
const b = readFileSync(S + 'examples/showcase/public/rocketbox/joe.glb'), len = b.readUInt32LE(12), j = JSON.parse(b.subarray(20, 20 + len).toString());
const joints = new Set(j.skins[0].joints);
const objs = j.nodes.map((n, i) => { const o = joints.has(i) ? new THREE.Bone() : new THREE.Object3D(); o.name = THREE.PropertyBinding.sanitizeNodeName(n.name || ''); if (n.translation) o.position.fromArray(n.translation); if (n.rotation) o.quaternion.fromArray(n.rotation); if (n.scale) o.scale.fromArray(n.scale); return o; });
j.nodes.forEach((n, i) => (n.children || []).forEach((c) => objs[i].add(objs[c])));
const root = new THREE.Group(); for (const i of j.scenes[0].nodes) root.add(objs[i]);
adaptBip01(root, { faces: '+Z' });
const t = new THREE.Group(); root.rotation.y = Math.PI; t.add(root); t.updateMatrixWorld(true);
const P = motionProfileOf({ bones: rigBones(t), scale: 1, spec: {} });
console.log('joe : hanche', P.bones.LeftUpLeg.bindP[1].toFixed(3), 'cheville', P.bones.LeftFoot.bindP[1].toFixed(3), 'R', (P.lengths.thigh + P.lengths.shank).toFixed(3), 'pied', P.lengths.foot.toFixed(3), 'legK', gaitLegK(P).toFixed(3));
const line = (label, ov, g = 1) => {
  const cells = [];
  for (const v of [3, 4, 5, 6]) { const r = gaitPose(P, 0, v, 0, undefined, { override: ov, griffe: g }); cells.push(`${v}:${(100 * r.meta.drop).toFixed(1)}`); }
  console.log(label.padEnd(34), 'drop cm (v:cm)', cells.join('  '));
};
line('griffé (fenêtre en temps)', null);
line('sans griffé', null, 0);
for (const pto of [35, 50, 60]) line(`pitchTO ${pto}°`, { pitchTO: pto });
line('roll 0,18', { roll: 0.18 });
line('pitchTO 55 + roll 0,15', { pitchTO: 55, roll: 0.15 });
// qui fixe le drop : l'extrême avant (u=0) ou arrière (u=s..s+0,06) — distance horizontale cheville-hanche et hauteur de cheville
for (const v of [4, 5]) {
  const p = gaitParams(v, 0, undefined, null, gaitLegK(P)); p.griffe = 1;
  const vC = [0, 0, -v], c = [-p.hw, 0, 0], ay = P.bones.LeftFoot.bindP[1];
  const at = (u) => { const f = footPath(u, p, c, vC, ay, P.lengths.foot); return `u=${u.toFixed(2)} z=${f.p[2].toFixed(2)} y=${f.p[1].toFixed(3)} pitch=${f.pitch.toFixed(0)}`; };
  console.log(`v ${v} (s ${p.s.toFixed(3)}, T ${p.T.toFixed(3)}, D ${(v * p.s * p.T).toFixed(2)} m) :`, at(0), '|', at(p.s * 0.5), '|', at(p.s - 0.001), '|', at(p.s + 0.06));
}
// les valeurs DÉRIVÉES (pied au décollage : cuisse ~20° + genou ~20° + flexion plantaire ~19° ≈ 58° en course ; pose : cheville ~0,3-0,35 m devant)
const regime = (v) => v < 4.2 ? { pitchTO: 50, bias: 0.10 } : v < 7 ? { pitchTO: 58, bias: 0.15 } : { pitchTO: 65, bias: 0.21 };
{
  const cells = [];
  for (const v of [3, 4, 5, 6, 7, 8]) { const r = gaitPose(P, 0, v, 0, undefined, { override: regime(v), griffe: 1 }); cells.push(`${v}:${(100 * r.meta.drop).toFixed(1)}`); }
  console.log('dérivé (TO 50/58/65, bias .10/.15/.21)'.padEnd(34), 'drop cm (v:cm)', cells.join('  '));
  const c0 = []; for (const v of [3, 4, 5, 6, 7, 8]) { const r = gaitPose(P, 0, v, 0, undefined, { griffe: 1 }); c0.push(`${v}:${(100 * r.meta.drop).toFixed(1)}`); }
  console.log('actuel (même tableau)'.padEnd(34), 'drop cm (v:cm)', c0.join('  '));
}
// QUI FIXE LE DROP : pour chaque u de la boucle du générateur, l'affaissement exigé ; l'argmax et sa géométrie
{
  const { bump } = await import(S + 'examples/showcase/src/engine/motion-strike.js');
  for (const [v, ov] of [[5, regime(5)], [6, regime(6)], [5, {}]]) {
    const p = gaitParams(v, 0, undefined, Object.keys(ov).length ? ov : null, gaitLegK(P)); p.griffe = 1;
    const R = P.lengths.thigh + P.lengths.shank, reach = 0.99 * R, hipY = P.bones.LeftUpLeg.bindP[1], ay = P.bones.LeftFoot.bindP[1];
    const vC = [0, 0, -v];
    let best = null;
    for (const [c, side] of [[[-p.hw, 0, 0], 'Left'], [[p.hw, 0, 0], 'Right']])
    for (let i = 0; i <= 16; i++) {
      const u = (i / 16) * (p.s + 0.06), bobU = p.bobA * p.bobSign * Math.cos(2 * Math.PI * 2 * (u - p.s / 2));
      const fp = footPath(u, p, c, vC, ay, P.lengths.foot);
      const dz = fp.p[2] - P.bones[side + 'UpLeg'].bindP[2], dx = fp.p[0] - P.bones[side + 'UpLeg'].bindP[0], horiz = Math.hypot(dx, dz);
      const need = hipY + bobU - fp.p[1] - Math.sqrt(Math.max(0, reach * reach - horiz * horiz)) + 0.005;
      if (!best || need > best.need / 100) best = { side, dx: +dx.toFixed(3), u: +u.toFixed(3), need: +(100 * need).toFixed(1), z: +dz.toFixed(3), y: +fp.p[1].toFixed(3), phase: fp.phase, pitch: +fp.pitch.toFixed(0), bob: +(100 * bobU).toFixed(1) };
    }
    console.log(`v ${v} ${JSON.stringify(ov)} s ${p.s.toFixed(3)} : argmax`, JSON.stringify(best));
  }
}
