// scenes/arbitre.js — LES OFFICIELS AU RENDU (lot 185 le central, 186 les assistants —
// déporté de Rondo.js au plafond de volumétrie). Le moteur tient la vérité (st.arbitre,
// st.assistants — referee.js, hors st.players : aucun ne joue le ballon) ; ici seulement les
// CORPS : même rig que les joueurs, tenue NOIRE, locomotion seule — des témoins, pas des acteurs.
import * as THREE from 'three';
import { CharacterController } from '../engine/character-controller.js';
import { tintPart } from '../engine/part-tint.js';
import { RONDO } from '../engine/rondo.js';

export function spawnArbitre(ctx) {
  return { central: spawnOfficiel(ctx, [-8, 6]), assistants: [spawnOfficiel(ctx, [20, 35]), spawnOfficiel(ctx, [-20, -35])] };
}

function spawnOfficiel({ squad, scene, night, q, bake }, at) {
  const { model, groundY, clips } = squad.spawn(0);
  model.position.set(at[0], groundY, at[1]);
  scene.add(model); model.updateMatrixWorld(true);
  tintPart(model, { match: /Shirt|Shorts|Socks/i, color: 0x17171c });
  const mixer = new THREE.AnimationMixer(model);
  const bone = (re) => { let f = null; model.traverse((o) => { if (o.isBone && re.test(o.name) && !f) f = o; }); return f; };
  const legs = [
    { up: bone(/LeftUpLeg/i), knee: bone(/LeftLeg$/i), foot: bone(/LeftFoot/i) },
    { up: bone(/RightUpLeg/i), knee: bone(/RightLeg$/i), foot: bone(/RightFoot/i) },
  ];
  const ctrl = new CharacterController(model, { mixer,
    runClip: clips.find((a) => /run/i.test(a.name)), idleClip: clips.find((a) => /idle/i.test(a.name)), walkClip: clips.find((a) => /walk/i.test(a.name)),
    legs, stride: 2.6, runSpeed: RONDO.speeds.chase, forwardLocal: new THREE.Vector3(0, 0, -1) });
  night.light(model);
  if (q.get('cils') !== '1') model.traverse((o) => { if (/eyelash/i.test(o.name)) o.visible = false; });
  if (bake) bake(model);
  return { model, ctrl, groundY };
}

export function updateArbitre(trio, state, step, top) {
  updateOfficiel(trio.central, state.arbitre, step, top);
  const as = state.assistants;
  for (let k = 0; k < 2; k++) updateOfficiel(trio.assistants[k], as?.[k], step, top);
}

function updateOfficiel(aR, aS, step, top) {
  aR.model.visible = !!aS;
  if (!aS) return;
  aR.ctrl.setMoveWorld(aS.v[0] / top, aS.v[1] / top);
  aR.ctrl.update(step);
  aR.ctrl.pos.set(aS.p[0], aR.groundY, aS.p[2]);
  aR.model.position.copy(aR.ctrl.pos);
  aR.ctrl.yaw = aR.ctrl.yawFor(Math.cos(aS.yaw), Math.sin(aS.yaw));
  aR.model.rotation.y = aR.ctrl.yaw;
}
