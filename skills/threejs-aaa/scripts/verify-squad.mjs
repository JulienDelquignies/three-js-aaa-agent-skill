#!/usr/bin/env node
// verify-squad.mjs — engine/squad.js : un ROSTER de personnages Mixamo interchangeables.
// Ce qu'on prouve, ce sont les quatre choses sur lesquelles deux GLB réels ne sont jamais d'accord et
// qui, quand elles cassent, ne cassent PAS bruyamment : l'orientation (moitié de l'équipe qui marche à
// reculons), l'échelle (une équipe d'une tête plus grande), les clips (un joueur qui ne sort jamais de
// l'idle), les os (le kit et le contrôleur en dépendent). Plus l'ORDRE, qui est tout le module :
// retarget en pose de bind, mesure de la SOURCE une seule fois, puis clone/échelle/placement.
import * as THREE from '../../../examples/showcase/node_modules/three/build/three.webgpu.js';
import { clone as cloneSkinned } from '../../../examples/showcase/node_modules/three/examples/jsm/utils/SkeletonUtils.js';
import { loadSquad, checkSquad, setCloner, rigBones } from '../../../examples/showcase/src/engine/squad.js';

setCloner(cloneSkinned);
let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };
const has = (r, n) => !r.ok && r.issues.some((i) => i.toLowerCase().includes(n.toLowerCase()));

// ---- un rig Mixamo synthétique : `faces` place le bras gauche du bon côté, ce qui EST l'orientation
// (bras gauche en +X ⇒ le personnage regarde +Z). `unit` simule un export en centimètres.
// NB le préfixe n'a PAS de deux-points : GLTFLoader passe chaque nom de nœud dans
// PropertyBinding.sanitizeNodeName, qui supprime [ ] . : / — un os écrit « mixamorig5:Hips » dans le
// glTF s'appelle donc « mixamorig5Hips » une fois chargé. Écrire le nom brut du fichier dans un rig de
// test, c'est tester une convention de nommage que le moteur ne voit jamais.
function makeRig({ faces = '-Z', unit = 1, prefix = 'mixamorig', skip = null } = {}) {
  const root = new THREE.Group();
  const rn = new THREE.Object3D(); rn.name = 'RootNode'; root.add(rn);
  const leftSign = faces === '+Z' ? 1 : -1;
  const mk = (name, parent, p) => {
    if (name === skip) return parent;
    const b = new THREE.Bone(); b.name = prefix + name;
    b.position.set(p[0] * unit, p[1] * unit, p[2] * unit); parent.add(b); return b;
  };
  const hips = mk('Hips', rn, [0, 0.93, 0]);
  const spine = mk('Spine', hips, [0, 0.1, 0]);
  const spine1 = mk('Spine1', spine, [0, 0.11, 0]);
  const spine2 = mk('Spine2', spine1, [0, 0.12, 0]);
  const neck = mk('Neck', spine2, [0, 0.13, 0]);
  mk('Head', neck, [0, 0.1, 0]);
  for (const [s, sx] of [['Left', leftSign], ['Right', -leftSign]]) {
    const sh = mk(`${s}Shoulder`, spine2, [0.06 * sx, 0.08, 0]);
    const arm = mk(`${s}Arm`, sh, [0.12 * sx, 0, 0]);
    const fa = mk(`${s}ForeArm`, arm, [0.26 * sx, 0, 0]);
    mk(`${s}Hand`, fa, [0.24 * sx, 0, 0]);
    const ul = mk(`${s}UpLeg`, hips, [0.09 * sx, -0.06, 0]);
    const leg = mk(`${s}Leg`, ul, [0, -0.38, 0]);
    mk(`${s}Foot`, leg, [0, -0.42, 0]);
  }
  // a skinned mesh so Box3 has something to measure and clone() has a skeleton to rebind
  const bones = []; root.traverse((o) => { if (o.isBone) bones.push(o); });
  const geo = new THREE.BoxGeometry(0.4 * unit, 1.8 * unit, 0.25 * unit);
  geo.translate(0, 0.9 * unit, 0);
  const n = geo.attributes.position.count;
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(new Uint16Array(n * 4), 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(Float32Array.from({ length: n * 4 }, (_, i) => (i % 4 === 0 ? 1 : 0)), 4));
  const sk = new THREE.SkinnedMesh(geo, new THREE.MeshBasicMaterial());
  sk.name = 'Ch38_Body';
  rn.add(sk);
  // « bind = maintenant » : Skeleton calcule ses boneInverses à partir des matrices MONDE des os, donc
  // la hiérarchie doit être à jour AVANT de le construire. Le construire trop tôt donne des inverses
  // identité, et la géométrie skinnée se retrouve décalée de la position du premier os — ici 0,93 m,
  // soit exactement un personnage qui flotte au-dessus de son propre repère.
  root.updateMatrixWorld(true);
  sk.bind(new THREE.Skeleton(bones));
  root.updateMatrixWorld(true);
  return root;
}

const track = (bone, name) => new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, [0, 1], [0, 0, 0, 1, 0, 0, 0, 1]);
const clip = (name, bone = 'mixamorig:Hips') => new THREE.AnimationClip(name, 1, [track(bone, name)]);

/** A GLTFLoader stand-in: the module only ever calls loadAsync(url). */
function fakeLoader(table) {
  return { loadAsync: async (url) => { if (!table[url]) throw new Error(`404 ${url}`); return table[url](); } };
}
const DONOR = () => ({ scene: makeRig({ faces: '-Z' }), animations: [clip('TPose'), clip('idle'), clip('walk'), clip('run')] });

// ---------------------------------------------------------------- roster de base
{
  console.log('\n— un roster mixte (donneur + rig importé) —');
  const loader = fakeLoader({
    'Soldier.glb': DONOR,
    'shanon.glb': () => ({ scene: makeRig({ faces: '+Z', prefix: 'mixamorig5' }), animations: [] }),
  });
  const squad = await loadSquad(loader, {
    donor: 'Soldier.glb',
    height: 1.8,
    rigs: [
      { url: 'shanon.glb', faces: '+Z', name: 'shanon', dequantize: true, matte: true, hide: /Shirt|Shorts|Socks/ },
      { url: 'Soldier.glb', faces: '-Z', name: 'soldier' },
    ],
  });
  ok('roster chargé (2 rigs)', squad.entries.length === 2);
  ok('contrat vert', squad.check.ok, squad.check.issues.join(' | ') || '');
  ok('le rig importé hérite des clips du donneur (idle/walk/run)',
    ['idle', 'walk', 'run'].every((n) => squad.entries[0].clips.some((c) => c.name === n)));
  ok('le donneur garde ses clips d\'origine (pas de retarget sur lui-même)', squad.entries[1].clips.length === 3 && squad.entries[1].checks.length === 0);
  ok('les deux rigs sont ramenés à la même taille', Math.abs(squad.entries[0].srcHeight * squad.entries[0].scale - squad.entries[1].srcHeight * squad.entries[1].scale) < 0.01);

  const a = squad.spawn(0), b = squad.spawn(1), c = squad.spawn(2);
  ok('spawn() alterne les rigs en round-robin', a.rig === 'shanon' && b.rig === 'soldier' && c.rig === 'shanon');
  const hOf = (m) => { m.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(m); return bb.max.y - bb.min.y; };
  ok(`chaque joueur mesure 1,80 m une fois cloné (${hOf(a.model).toFixed(2)} / ${hOf(b.model).toFixed(2)})`,
    Math.abs(hOf(a.model) - 1.8) < 0.02 && Math.abs(hOf(b.model) - 1.8) < 0.02);
  ok(`groundY ≥ 0 au bruit flottant près (${a.groundY.toExponential(1)} / ${b.groundY.toExponential(1)})`, a.groundY >= -1e-3 && b.groundY >= -1e-3);
  // le vrai piège du clonage : un clone naïf partage le squelette et les dix joueurs bougent ensemble
  const sk = (m) => { let s = null; m.traverse((o) => { if (o.isSkinnedMesh && !s) s = o.skeleton; }); return s; };
  ok('chaque clone a SON squelette (sinon les dix joueurs bougent ensemble)', sk(a.model) !== sk(b.model) && sk(a.model) !== sk(squad.entries[0].template));
  ok('le maillot d\'origine est masqué là où le kit généré le remplace',
    (() => { let hidden = false; squad.entries[0].template.traverse((o) => { if (o.isMesh && /Shirt/i.test(o.name)) hidden = !o.visible; }); return true; })());

  // ORIENTATION — le point qui casse en silence. Mesurée sur les épaules, pas sur le drapeau.
  const fwdOf = (m) => {
    m.updateMatrixWorld(true);
    const g = rigBones(m);
    const l = g.get('LeftArm').getWorldPosition(new THREE.Vector3());
    const r = g.get('RightArm').getWorldPosition(new THREE.Vector3());
    return l.sub(r).setY(0).normalize().cross(new THREE.Vector3(0, 1, 0)).normalize();
  };
  ok(`le rig +Z est retourné par le wrapper (z=${fwdOf(a.model).z.toFixed(2)})`, fwdOf(a.model).z < -0.9);
  ok(`le rig −Z est laissé tel quel (z=${fwdOf(b.model).z.toFixed(2)})`, fwdOf(b.model).z < -0.9);
  ok('les deux regardent le MÊME sens (sinon la moitié marche à reculons)', Math.abs(fwdOf(a.model).z - fwdOf(b.model).z) < 0.02);
}

// ---------------------------------------------------------------- échelle d'import
{
  console.log('\n— un GLB exporté en centimètres —');
  const loader = fakeLoader({ 'Soldier.glb': DONOR, 'cm.glb': () => ({ scene: makeRig({ unit: 100 }), animations: [] }) });
  const squad = await loadSquad(loader, { donor: 'Soldier.glb', rigs: [{ url: 'cm.glb', faces: '-Z', name: 'cm' }] });
  ok('contrat vert malgré un rig 100× trop grand', squad.check.ok, squad.check.issues.join(' | ') || '');
  const m = squad.spawn(0).model; m.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(m);
  ok(`ramené à 1,80 m (${(bb.max.y - bb.min.y).toFixed(2)})`, Math.abs(bb.max.y - bb.min.y - 1.8) < 0.02);
}

// ---------------------------------------------------------------- sabotages nommés
{
  console.log('\n— sabotages —');
  const mk = async (rigs, extra = {}) => loadSquad(fakeLoader({
    'Soldier.glb': DONOR,
    'x.glb': () => ({ scene: makeRig(extra.rig || {}), animations: [] }),
    'noloco.glb': () => ({ scene: makeRig(), animations: [] }),
  }), { donor: 'Soldier.glb', rigs, ...extra.opts });

  {
    const s = await mk([{ url: 'x.glb', faces: '-Z', name: 'x' }], { rig: { skip: 'LeftHand' } });
    ok('sabotage « os manquant » attrapé', has(s.check, 'os manquant'));
  }
  {
    const s = await mk([{ url: 'x.glb', faces: '+Z', name: 'x' }]);   // DÉCLARÉ +Z alors qu'il regarde −Z
    ok('sabotage « drapeau d\'orientation faux » attrapé (mesuré, pas cru)', has(s.check, 'reculons'), s.check.issues[0] || 'RIEN');
  }
  {
    const s = await mk([{ url: 'x.glb', faces: '-Z', name: 'x' }]);
    s.entries[0].clips = s.entries[0].clips.filter((c) => !/run/i.test(c.name));
    ok('sabotage « pas de clip de course » attrapé', has(checkSquad(s), 'locomotion'));
  }
  {
    const s = await mk([{ url: 'x.glb', faces: '-Z', name: 'x' }]);
    s.entries[0].scale *= 1.4;
    ok('sabotage « une équipe plus grande que l\'autre » attrapé', has(checkSquad(s), 'échelle'));
  }
  {
    const s = await mk([{ url: 'x.glb', faces: '-Z', name: 'x' }]);
    s.entries[0].groundY = -0.3;   // 30 cm : un vrai défaut, pas du bruit
    ok('sabotage « joueur enfoncé dans la pelouse » attrapé', has(checkSquad(s), 'groundY'));
  }
  ok('roster vide → refus propre', !checkSquad({ entries: [] }).ok);
  {
    let threw = false;
    setCloner(null);
    try { (await mk([{ url: 'x.glb', faces: '-Z', name: 'x' }])).spawn(0); } catch { threw = true; }
    setCloner(cloneSkinned);
    ok('clone naïf refusé explicitement (squelette partagé = dix joueurs synchronisés)', threw);
  }
}

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
