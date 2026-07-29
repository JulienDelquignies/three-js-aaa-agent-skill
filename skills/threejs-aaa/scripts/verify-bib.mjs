#!/usr/bin/env node
// verify-bib.mjs — la CHASUBLE (engine/bib.js) : le plus petit vêtement qui distingue deux équipes.
// Ce qu'on prouve : c'est bien une chasuble (s'arrête à la taille, monte à la poitrine, sans manches),
// elle est SKINNÉE proprement sur le buste, elle se taille sur le RIG qu'on lui donne — et chacun de
// ces points a son sabotage, sinon le contrat ne dit rien.
import * as THREE from '../../../examples/showcase/node_modules/three/build/three.webgpu.js';
import { buildBib, checkBib } from '../../../examples/showcase/src/engine/bib.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };
const has = (r, n) => !r.ok && r.issues.some((i) => i.toLowerCase().includes(n.toLowerCase()));

/** un humanoïde Mixamo à l'échelle métrique — `scale` simule un personnage plus petit ou plus grand */
function makeRig(scale = 1) {
  const root = new THREE.Group();
  const rn = new THREE.Object3D(); rn.name = 'RootNode'; root.add(rn);
  const mk = (name, parent, p) => { const b = new THREE.Bone(); b.name = 'mixamorig' + name; b.position.set(p[0] * scale, p[1] * scale, p[2] * scale); parent.add(b); return b; };
  const hips = mk('Hips', rn, [0, 0.93, 0]);
  const spine = mk('Spine', hips, [0, 0.1, 0]);
  const spine1 = mk('Spine1', spine, [0, 0.11, 0]);
  const spine2 = mk('Spine2', spine1, [0, 0.12, 0]);
  const neck = mk('Neck', spine2, [0, 0.13, 0]);
  mk('Head', neck, [0, 0.1, 0]);
  for (const [s, sx] of [['Left', -1], ['Right', 1]]) {
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

const span = (mesh) => {
  const pos = mesh.geometry.attributes.position;
  let lo = Infinity, hi = -Infinity, wx = 0;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i); if (y < lo) lo = y; if (y > hi) hi = y;
    wx = Math.max(wx, Math.abs(pos.getX(i)));
  }
  return { lo, hi, wx };
};

{
  console.log('— une chasuble sur un rig standard —');
  const rig = makeRig();
  const b = buildBib(rig, { color: 0xffb200 });
  ok('chasuble construite', !!b.group && !!b.mesh, b.check?.issues?.[0] || '');
  ok('contrat de coupe OK', b.check.ok, b.check.issues.join(' | ') || '');
  ok('contrat meshkit (fermée, volume positif)', b.contract.ok, b.contract.issues?.[0] || '');
  ok('c\'est un SkinnedMesh lié au squelette du personnage', b.mesh.isSkinnedMesh && b.mesh.skeleton.bones.length > 0);
  const s = span(b.mesh);
  ok(`s'arrête à la taille (ourlet ${s.lo.toFixed(2)} ≥ hanches ${b.measures.hipsY.toFixed(2)} − 12 cm)`, s.lo >= b.measures.hipsY - 0.12);
  ok(`monte à la poitrine sans dépasser le cou (${s.hi.toFixed(2)} ≤ ${b.measures.neckY.toFixed(2)})`, s.hi <= b.measures.neckY + 0.06 && s.hi > b.measures.neckY - 0.25);
  // SANS MANCHES : c'est ce qui la distingue d'un maillot, et ce qui fait qu'on ne peut pas la rater.
  // Une chasuble plus large que l'épaule aurait des manches par accident.
  ok(`sans manches (largeur ${s.wx.toFixed(2)} m, épaule à 0.18)`, s.wx < 0.30, `${s.wx.toFixed(3)}`);
  ok('déterministe (mêmes mesures au rebuild)', JSON.stringify(buildBib(makeRig()).measures) === JSON.stringify(b.measures));

  // TAILLÉE SUR LE RIG, pas sur des constantes : une chasuble coupée pour un personnage flotte sur le
  // suivant. Un rig 30 % plus petit doit donner une chasuble 30 % plus petite.
  const small = buildBib(makeRig(0.7));
  ok('taillée sur le rig qu\'on lui donne (personnage 0,7× → chasuble 0,7×)',
    Math.abs(small.measures.rx / b.measures.rx - 0.7) < 0.12, `rapport ${(small.measures.rx / b.measures.rx).toFixed(2)}`);
  ok('  …et son contrat passe aussi', small.check.ok, small.check.issues.join(' | ') || '');
}

console.log('\n— sabotages —');
{
  const rig = makeRig(); const b = buildBib(rig);
  const pos = b.mesh.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) if (pos.getY(i) < b.measures.bottom + 0.01) pos.setY(i, pos.getY(i) - 0.5);
  ok('sabotage « chasuble longueur maillot » attrapé', has(checkBib(b.mesh, rig, b.measures), 'trop long'));
}
{
  const rig = makeRig(); const b = buildBib(rig);
  const pos = b.mesh.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, pos.getY(i) - 0.45);
  ok('sabotage « chasuble qui ne couvre pas la poitrine » attrapé', has(checkBib(b.mesh, rig, b.measures), 'poitrine'));
}
{
  const rig = makeRig(); const b = buildBib(rig);
  b.mesh.geometry.attributes.skinWeight.array[0] = 3;
  ok('sabotage « poids dénormalisés » attrapé', has(checkBib(b.mesh, rig, b.measures), 'normalis'));
}
{
  const rig = makeRig(); const b = buildBib(rig);
  b.mesh.geometry.attributes.skinIndex.array[2] = 9999;
  ok('sabotage « index d\'os fantôme » attrapé', has(checkBib(b.mesh, rig, b.measures), 'invalide'));
}
{
  // LE sabotage qui manquait quand la chasuble est sortie à l'envers en vrai : un `+sin` au lieu d'un
  // `−sin` dans l'anneau retourne toute la maille. De face ça passe presque inaperçu, c'est pour ça
  // qu'il faut une clause et pas un coup d'œil.
  const rig = makeRig(); const b = buildBib(rig);
  const idx = b.mesh.geometry.index.array;
  for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
  ok('sabotage « chasuble à l\'envers » attrapé', has(checkBib(b.mesh, rig, b.measures), 'envers'));
}
{
  const b = buildBib(new THREE.Group());
  ok('rig sans os → refus propre (pas de crash)', !b.check.ok && b.group === null, b.check.issues[0] || '');
}

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
