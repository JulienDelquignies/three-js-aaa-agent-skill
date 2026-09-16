// scenes/arbitre.js — LES OFFICIELS AU RENDU (lot 185 le central, 186 les assistants —
// déporté de Rondo.js au plafond de volumétrie). Le moteur tient la vérité (st.arbitre,
// st.assistants — referee.js, hors st.players : aucun ne joue le ballon) ; ici seulement les
// CORPS : même rig que les joueurs, tenue NOIRE, locomotion seule — des témoins, pas des acteurs.
import * as THREE from 'three';
import { CharacterController } from '../engine/character-controller.js';
import { tintPart } from '../engine/part-tint.js';
import { RONDO } from '../engine/rondo.js';
import { GestureLayer } from '../engine/gesture-layer.js';
import { rigBones } from '../engine/squad.js';
import { castStrikes, strikeSpec } from '../engine/motion-cast.js';

export function spawnArbitre(ctx) {
  return { central: spawnOfficiel(ctx, [-8, 6]), assistants: [spawnOfficiel(ctx, [20, 35], true), spawnOfficiel(ctx, [-20, -35], true)] };
}

function spawnOfficiel({ squad, scene, night, q, bake }, at, drapeau = false) {
  const { model, groundY, clips } = squad.spawn(0), entry = squad.entries?.[0];
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
  // LE DRAPEAU DE L'ASSISTANT (187) : hampe + fanion orange dans la MAIN (attaché au bone —
  // il suit la course) ; pendant vers le bas au trot, DRESSÉ quand le moteur signale
  // (st.assistants[k].drapeau — la Loi 11 a un geste). Le central n'en porte pas.
  let flag = null;
  if (drapeau) {
    let hand = null; model.traverse((o) => { if (o.isBone && /RightHand$/i.test(o.name) && !hand) hand = o; });
    if (hand) {
      flag = new THREE.Group();
      const hampe = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.45, 5), new THREE.MeshLambertMaterial({ color: 0xd8d0c0 }));
      hampe.position.y = 0.225;
      const fanion = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.16), new THREE.MeshLambertMaterial({ color: 0xff7a00, side: THREE.DoubleSide }));
      fanion.position.set(0.11, 0.37, 0);
      flag.add(hampe, fanion);
      flag.rotation.x = 0;                                          // baissé par défaut (pendant le long de la jambe — l'axe X local de la main est l'axe utile, calibré au pixel)
      hand.add(flag);
    }
  }
  // (A11 bis) LES GESTES DU CENTRAL — motion-arbitre (siffler, carton, designer, avantage) sur la couche de geste, le HAUT du corps
  // seul (les jambes restent à la locomotion) ; la sim pilote (st.arbitre.geste, referee.poserGeste) ; la CARTE dans la main
  // droite (jaune ou rouge, visible pendant le geste). Les assistants n'en ont pas.
  let geste = null;
  if (!drapeau && entry) {
    const layer = new GestureLayer({ bones: rigBones(model), rest: entry.bones, hipsWrite: null });
    const cast = castStrikes(entry, { id: 99 }, 7, null);
    let hand = null; model.traverse((o) => { if (o.isBone && /RightHand$/i.test(o.name) && !hand) hand = o; });
    let carte = null;
    if (hand) { carte = new THREE.Mesh(new THREE.PlaneGeometry(0.086, 0.12), new THREE.MeshLambertMaterial({ color: 0xffd400, side: THREE.DoubleSide })); carte.position.set(0, 0.125, 0.02); /* (A11 ter) la carte aux dimensions réelles (8,6 × 12 cm), tenue au bout des doigts */ carte.visible = false; hand.add(carte); }
    geste = { layer, cast, carte, at: null, t: 0, spec: null, w: 0 };
  }
  return { model, ctrl, groundY, flag, geste };
}

export function updateArbitre(trio, state, step, top) {
  updateOfficiel(trio.central, state.arbitre, step, top);
  const as = state.assistants;
  for (let k = 0; k < 2; k++) updateOfficiel(trio.assistants[k], as?.[k], step, top);
}

function updateOfficiel(aR, aS, step, top) {
  aR.model.visible = !!aS;
  if (aR.flag) { const want = aS?.drapeau ? -Math.PI * 0.95 : 0; aR.flag.rotation.x += (want - aR.flag.rotation.x) * Math.min(1, step * 8); }   // dressé au signal (Loi 11), pendant sinon
  if (!aS) return;
  aR.ctrl.setMoveWorld(aS.v[0] / top, aS.v[1] / top);
  aR.ctrl.update(step);
  aR.ctrl.pos.set(aS.p[0], aR.groundY, aS.p[2]);
  aR.model.position.copy(aR.ctrl.pos);
  aR.ctrl.yaw = aR.ctrl.yawFor(Math.cos(aS.yaw), Math.sin(aS.yaw));
  aR.model.rotation.y = aR.ctrl.yaw;
  // (A11 bis) le geste courant de la sim : commencé à son heure (at), le haut du corps entre en 0,15 s et rend en 0,15 s ; la carte se montre au carton
  const G = aR.geste; if (!G) return;
  const g = aS.geste;
  if (g && g.at !== G.at) {
    const spec = strikeSpec(G.cast, g.kind);
    if (spec) { G.layer.begin(spec); G.spec = spec; G.at = g.at; G.t = 0; if (G.carte) { G.carte.visible = g.kind === 'carton'; G.carte.material.color.setHex(g.couleur === 'rouge' ? 0xe0201c : 0xffd400); } }
  }
  if (G.spec) {
    G.t += step;
    const T = G.spec.duration, tau = 0.15;
    G.w = G.t < T ? Math.min(1, G.w + step / tau) : Math.max(0, G.w - step / tau);
    G.layer.apply(Math.min(T, G.t), 0, G.w);
    if (G.t >= T && G.w <= 0.02) { G.layer.end(); G.spec = null; if (G.carte) G.carte.visible = false; }
  }
}
