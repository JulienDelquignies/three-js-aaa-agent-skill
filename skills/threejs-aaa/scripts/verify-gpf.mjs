#!/usr/bin/env node
// verify-gpf.mjs — LES GESTES DE GAMEPLAY FOOTBALL PORTÉS SUR LE RIG DU DUEL (engine/gpf-anim.js) : le port se PROUVE, il ne se croit pas.
//
//   (1) la LECTURE : les quatre .anim embarqués (gpf-data.js) donnent leurs pistes, leur image de touche, leurs métadonnées ;
//   (2) la FK GPF : à l'image de touche, la cheville qui joue est à 8-30 cm du centre du ballon et l'autre plus loin — un axe ou un
//       ordre de quaternion faux met le pied à 50 cm-1 m (c'est la preuve que player.object et la composition sont bien lus) ;
//   (3) la FIDÉLITÉ sur le vrai Biped du duel (rig-bip01 + motionProfileOf) : la cheville du rig au contact est à moins de 5 cm
//       de la distance cheville-ballon de GPF (le ballon ramené au repère du rig par le même cap et la même échelle que le port) ;
//   (4) le CALAGE vertical : le pied du port ne passe pas plus bas que l'animation d'origine ne le fait elle-même (+2 cm de marge) ;
//   (5) le REGISTRE : sans ?gpf, les générateurs du duel sont intacts ; installGpf remplace EXACTEMENT les trois gestes nommés,
//       leurs contrats restent ceux du moteur, et le tacle porté dit où il se couche (holdAt — la scène y gèle le clip).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as THREE from '../../../examples/showcase/node_modules/three/build/three.webgpu.js';
import { clone as cloneSkinned } from '../../../examples/showcase/node_modules/three/examples/jsm/utils/SkeletonUtils.js';
import { adaptBip01 } from '../../../examples/showcase/src/engine/rig-bip01.js';
import { setCloner, rigBones } from '../../../examples/showcase/src/engine/squad.js';
import { fkPose } from '../../../examples/showcase/src/engine/motion-rig.js';
import { motionProfileOf, GENERATORS } from '../../../examples/showcase/src/engine/motion-cast.js';
import { eulerToQuat } from '../../../examples/showcase/src/engine/animkit.js';
import { parseGpfAnim, touchFoot, concatGpf, gpfBallInRig, GPF_GESTES, installGpf, GPF_FPS } from '../../../examples/showcase/src/engine/gpf-anim.js';
import { GPF_ANIMS } from '../../../examples/showcase/src/engine/gpf-data.js';
setCloner(cloneSkinned);

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };

// (1) la lecture
const A = Object.fromEntries(Object.entries(GPF_ANIMS).map(([k, t]) => [k, parseGpfAnim(t)]));
for (const [k, a] of Object.entries(A)) ok(`${k} : 13 pistes de rotation, une racine, ${a.frames} images`, Object.keys(a.tracks).length === 13 && a.player.length >= 2 && a.frames > 20);
ok('trapFace : un piège (type trap), touche à l\'image 20', A.trapFace.meta.type === 'trap' && A.trapFace.touch?.f === 20);
ok('glisse : une glissade qui finit couchée sur le dos (lay_back)', A.glisse.meta.type === 'sliding' && A.glisse.meta.outgoing_special_state === 'lay_back');
ok('releveDos : le relevé part de la pose couchée sur le dos', A.releveDos.meta.incoming_special_state === 'lay_back');

// (2) la FK GPF
for (const k of ['trapFace', 'trapVirageGauche', 'glisse']) {
  const t = touchFoot(A[k]);
  ok(`${k} : la cheville qui joue est au ballon (${(t.dist * 100).toFixed(0)} cm, l'autre à ${(t.other * 100).toFixed(0)})`, t.dist > 0.08 && t.dist < 0.3 && t.other > t.dist + 0.05);
}

// (3)-(4) sur le vrai rig du duel
const PUB = fileURLToPath(new URL('../../../examples/showcase/public/rocketbox/', import.meta.url));
function loadRig(file) {
  const b = readFileSync(PUB + file), len = b.readUInt32LE(12), j = JSON.parse(b.subarray(20, 20 + len).toString()), joints = new Set(j.skins[0].joints);
  const objs = j.nodes.map((n, i) => { const o = joints.has(i) ? new THREE.Bone() : new THREE.Object3D(); o.name = THREE.PropertyBinding.sanitizeNodeName(n.name || ''); if (n.translation) o.position.fromArray(n.translation); if (n.rotation) o.quaternion.fromArray(n.rotation); if (n.scale) o.scale.fromArray(n.scale); return o; });
  j.nodes.forEach((n, i) => (n.children || []).forEach((c) => objs[i].add(objs[c])));
  const root = new THREE.Group(); for (const i of j.scenes[0].nodes) root.add(objs[i]); root.updateMatrixWorld(true); return root;
}
for (const glb of ['foot-18.glb', 'foot-10-ciel.glb']) {
  const root = loadRig(glb); adaptBip01(root, { faces: '+Z' }); const tpl = new THREE.Group(); root.rotation.y = Math.PI; tpl.add(root); tpl.updateMatrixWorld(true);
  const P = motionProfileOf({ bones: rigBones(tpl), scale: 1, spec: { name: glb } }, []);
  const fk = (S, t) => { const k = S.keys.reduce((b, x) => (Math.abs(x.t - t) < Math.abs(b.t - t) ? x : b), S.keys[0]); return fkPose(P, Object.fromEntries(Object.entries(k.pose).map(([bn, e]) => [bn, eulerToQuat(e)])), k.hips ?? [0, 0, 0]); };
  for (const [nom, cle] of [['controleInterieur', 'trapFace'], ['controleOriente', 'trapVirageGauche'], ['tacle', 'glisse']]) {
    const S = GPF_GESTES[nom](P, {}), src = nom === 'tacle' ? concatGpf(A.glisse, A.releveDos) : A[cle];
    const ball = gpfBallInRig(src, P), w = fk(S, S.contact), f = w.RightFoot.p;
    const d = Math.hypot(f[0] - ball[0], f[1] - ball[1], f[2] - ball[2]), dG = touchFoot(src).dist;
    ok(`${glb} · ${nom} : cheville du rig à ${(d * 100).toFixed(1)} cm du ballon GPF (GPF : ${(dG * 100).toFixed(1)})`, Math.abs(d - dG) < 0.05);
    let low = Infinity; for (const k of S.keys) { const x = fk(S, k.t); low = Math.min(low, x.LeftToeBase.p[1], x.RightToeBase.p[1]); }
    // le pied GPF d'origine descend jusqu'à 2,8 cm sous sa pose debout (pied-gpf.mjs : foot.ase par la FK GPF) — le port pas plus (+2 cm)
    ok(`${glb} · ${nom} : le pied ne passe pas sous la pelouse plus que l'original (${((low - P.lengths.groundY) * 100).toFixed(1)} cm ≥ −4,8)`, low - P.lengths.groundY > -0.048);
    ok(`${glb} · ${nom} : spec complet (22 os, ${S.keys.length} clés, durée ${S.duration.toFixed(2)} s = images GPF / ${GPF_FPS})`, Object.keys(S.keys[0].pose).length === 22 && S.keys.length > 10);
  }
}

// (5) le registre
const avant = Object.fromEntries(Object.entries(GENERATORS).map(([k, g]) => [k, g.generate]));
const R = { ...GENERATORS };
const noms = installGpf(R, '1');
ok(`installGpf('1') remplace les trois gestes (${noms.join(', ')})`, noms.length === 3 && noms.every((n) => R[n].gpf && R[n].generate !== avant[n]));
ok('…et seulement eux : les autres générateurs sont intacts', Object.keys(R).filter((k) => !noms.includes(k)).every((k) => R[k].generate === avant[k]));
ok('…leurs contrats restent ceux du moteur', noms.every((n) => R[n].check === GENERATORS[n].check));
ok('le registre du module n\'est pas touché sans ?gpf', Object.entries(GENERATORS).every(([k, g]) => g.generate === avant[k] && !g.gpf));
ok('installGpf(\'tacle\') ne remplace que le tacle', installGpf({ ...GENERATORS }, 'tacle').join() === 'tacle');
const T = GPF_GESTES.tacle({ ...motionProfileOf({ bones: rigBones((() => { const r = loadRig('foot-18.glb'); adaptBip01(r, { faces: '+Z' }); const t = new THREE.Group(); r.rotation.y = Math.PI; t.add(r); t.updateMatrixWorld(true); return t; })()), scale: 1, spec: { name: 'x' } }, []) }, {});
ok(`le tacle porté se couche à ${T.holdAt.toFixed(2)} s (fin de la glissade) et se relève ensuite (${T.duration.toFixed(2)} s)`, Math.abs(T.holdAt - (A.glisse.frames - 1) / GPF_FPS) < 1e-6 && T.duration > T.holdAt + 0.5 && T.name === 'tacle');

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
