#!/usr/bin/env node
// verify-gesture-layer.mjs — LA COUCHE DE GESTE (engine/gesture-layer.js) : la pose authorée,
// posée ABSOLUE sur le rest mesuré, par membre, après le mixer.
//
// La clause reine est celle que le chemin additif ne pouvait PAS tenir : à poids 1, la BASE N'A
// AUCUNE INFLUENCE sur la pose affichée. Mesuré avant : l'idle retargeté (Soldier → shanon) porte
// 20° (cuisse), 32° (tibia), ~43° (bassin) d'écart au rest — un delta additif conjugué dans ce
// repère tourné faisait balayer les passes VERS L'ARRIÈRE (pied composé à z +0,55 « derrière »,
// banc à −0,4 « devant »). Le sabotage-référence reconstitue ce bug exactement.
import { GestureLayer, samplePose, checkGestureLayer, UP_BONES, LEG_BONES }
  from '../assets/starter/src/engine/gesture-layer.js';
import { MOVES, mirrorMove, resolveTracks, eulerToQuat, quatAngle }
  from '../assets/starter/src/engine/animkit.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };

const qMul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
const mkBone = (q = [0, 0, 0, 1]) => ({ quaternion: { x: q[0], y: q[1], z: q[2], w: q[3], set(x, y, z, w) { this.x = x; this.y = y; this.z = z; this.w = w; } } });
const qOf = (b) => [b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w];
const angDeg = (a, b) => quatAngle(a, b) * 180 / Math.PI;
// le rest MESURÉ de la cuisse shanon (~180° de Z) — le repère qui a cassé le chemin additif
const THIGH_REST = [0, -0.02, 0.999, 0.042];

console.log('— le contrat embarqué —');
ok('checkGestureLayer est vert', checkGestureLayer().ok, checkGestureLayer().issues.join(' ; '));

console.log('\n— la clause reine : à poids 1, la base n\'existe pas —');
{
  const spec = MOVES.passeRapide;
  const bases = [
    [0, 0, 0, 1],                                                      // repos
    THIGH_REST,                                                        // le rest réel
    qMul([0, Math.sin(0.375), 0, Math.cos(0.375)], THIGH_REST),        // le retarget tordu de 43°
    eulerToQuat([25, -40, 10]),                                        // une base de course quelconque
  ];
  const poses = bases.map((b0) => {
    const bone = mkBone(b0);
    const L = new GestureLayer({ bones: new Map([['RightUpLeg', bone]]), rest: new Map([['RightUpLeg', THIGH_REST]]) });
    L.begin(spec);
    L.apply(spec.contact, 1, 1);
    return qOf(bone);
  });
  let worst = 0;
  for (let i = 1; i < poses.length; i++) worst = Math.max(worst, angDeg(poses[0], poses[i]));
  ok(`4 bases très différentes (repos, rest, retarget 43°, course) ⇒ MÊME pose au contact (pire écart ${worst.toFixed(4)}°)`, worst < 0.01);
}

console.log('\n— l\'échantillonnage : les clés exactes, l\'interpolation continue —');
{
  const r = resolveTracks(MOVES.passe);
  const key = r.tracks.RightUpLeg.find((k) => Math.abs(k.t - MOVES.passe.contact) < 1e-9);
  const s = samplePose(r.tracks, MOVES.passe.contact);
  ok('à t = une clé, la pose EST la clé (pas d\'interpolation parasite)', key && angDeg(s.RightUpLeg, key.q) < 1e-6);
  let worstStep = 0;
  let prev = null;
  for (let t = 0; t <= MOVES.passe.duration; t += 1e-3) {
    const p = samplePose(r.tracks, t).RightUpLeg;
    if (prev) worstStep = Math.max(worstStep, angDeg(prev, p));
    prev = p;
  }
  ok(`l'interpolation est continue (pire pas à 1 kHz : ${worstStep.toFixed(2)}° — pas de téléport entre clés)`, worstStep < 2.5);
}

console.log('\n— les poids : par membre, continus, et 0 = intact —');
{
  const spec = MOVES.passe;
  const mk = () => {
    const bones = new Map([['RightUpLeg', mkBone(THIGH_REST)], ['RightArm', mkBone()]]);
    const L = new GestureLayer({ bones, rest: new Map([['RightUpLeg', THIGH_REST], ['RightArm', [0, 0, 0, 1]]]) });
    L.begin(spec);
    return { bones, L };
  };
  const a = mk(); a.L.apply(spec.contact, 0, 1);
  ok('wLegs = 0 : la jambe reste à la base pendant que le bras est au geste (les étages sont indépendants)',
    angDeg(qOf(a.bones.get('RightUpLeg')), THIGH_REST) < 1e-6 && angDeg(qOf(a.bones.get('RightArm')), [0, 0, 0, 1]) > 5);
  // la continuité en poids : w et w+ε donnent des poses voisines (le fondu ne saute pas)
  const b1 = mk(); b1.L.apply(spec.contact, 0.5, 1);
  const b2 = mk(); b2.L.apply(spec.contact, 0.52, 1);
  ok('la pose est continue en poids (Δw = 0,02 ⇒ écart < 2°)',
    angDeg(qOf(b1.bones.get('RightUpLeg')), qOf(b2.bones.get('RightUpLeg'))) < 2);
  ok('UP_BONES et LEG_BONES partitionnent les os du geste (aucun os des deux étages à la fois)',
    !['RightUpLeg', 'LeftLeg', 'Hips', 'RightArm', 'Spine1', 'Head'].some((n) => UP_BONES.test(n) && LEG_BONES.test(n)));
}

console.log('\n— le miroir : le geste gauche est le jumeau exact —');
{
  const spec = MOVES.passeRapide, mir = mirrorMove(spec);
  const rR = resolveTracks(spec), rL = resolveTracks(mir);
  const at = samplePose(rR.tracks, spec.contact).RightUpLeg;
  const atL = samplePose(rL.tracks, spec.contact).LeftUpLeg;
  // conjugaison sagittale : q → (x, −y, −z, w) sur le quat — la loi du miroir prouvée d'animkit
  const mirrored = [at[0], -at[1], -at[2], at[3]];
  ok('la cuisse gauche du clip miroir = conjugaison sagittale de la droite (écart < 0,01°)',
    angDeg(atL, mirrored) < 0.01);
}

console.log('\n— les sabotages : chaque clause doit mordre —');
{
  // 1. LE BUG RECONSTITUÉ : composer le geste en DELTA sur la base animée (le chemin additif).
  // delta = q0⁻¹ ⊗ q_t appliqué base ⊗ delta — sur la base tordue de 43°, la pose diverge.
  const spec = MOVES.passeRapide;
  const r = resolveTracks(spec);
  const q0 = r.tracks.RightUpLeg[0].q;
  const qc = samplePose(r.tracks, spec.contact).RightUpLeg;
  const delta = qMul([-q0[0], -q0[1], -q0[2], q0[3]], qc);
  const twisted = qMul([0, Math.sin(0.375), 0, Math.cos(0.375)], THIGH_REST);
  const additive = qMul(twisted, delta);                                // ce que faisait le mixer
  const bone = mkBone(twisted);
  const L = new GestureLayer({ bones: new Map([['RightUpLeg', bone]]), rest: new Map([['RightUpLeg', THIGH_REST]]) });
  L.begin(spec); L.apply(spec.contact, 1, 1);
  ok(`sabotage « delta additif sur base animée » attrapé (écart à la pose du banc : ${angDeg(additive, qOf(bone)).toFixed(0)}° — le plan du balayage pivotait d'autant)`,
    angDeg(additive, qOf(bone)) > 20);
  // 2. un rest CONTAMINÉ (pris sur un squelette déjà posé, pas sur le template) décale tout
  const bad = new GestureLayer({ bones: new Map([['RightUpLeg', mkBone()]]), rest: new Map([['RightUpLeg', twisted]]) });
  bad.begin(spec); bad.apply(spec.contact, 1, 1);
  const good = new GestureLayer({ bones: new Map([['RightUpLeg', mkBone()]]), rest: new Map([['RightUpLeg', THIGH_REST]]) });
  good.begin(spec); good.apply(spec.contact, 1, 1);
  ok('sabotage « rest contaminé (squelette posé au lieu du template) » attrapé (les poses divergent)',
    angDeg(qOf(bad.bones.get('RightUpLeg')), qOf(good.bones.get('RightUpLeg'))) > 20);
}

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
