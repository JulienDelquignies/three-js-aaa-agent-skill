#!/usr/bin/env node
// verify-animkit.mjs — the movement kit (engine/animkit.js): every library move must be an
// ANATOMICALLY SANE animation under checkClip — known Mixamo bones only, sorted keys, normalized
// quaternions, bounded angular velocity (no teleporting limbs), looping moves land where they start,
// knees/hips inside their range. Plus determinism and named sabotages.
import { MOVES, resolveTracks, checkClip, eulerToQuat, quatAngle, MIXAMO_BONES, mirrorMove, BASE_POSE, mirrorEuler } from '../assets/starter/src/engine/animkit.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };

for (const [name, spec] of Object.entries(MOVES)) {
  const r = resolveTracks(spec);
  const c = checkClip(r);
  const nb = Object.keys(r.tracks).length;
  ok(`« ${name} » anatomiquement sain (${nb} os, ${spec.keys.length} clés${spec.loop ? ', boucle' : ''})`, c.ok, c.issues[0] || '');
}
ok('déterministe (même spec → mêmes quaternions)', JSON.stringify(resolveTracks(MOVES.frappe)) === JSON.stringify(resolveTracks(MOVES.frappe)));
ok('la base MERGE sous chaque clé (bras baissés partout)', (() => {
  const r = resolveTracks(MOVES.frappe);
  return r.tracks.LeftArm && r.tracks.LeftArm.length === MOVES.frappe.keys.length;
})());
{
  const q = eulerToQuat([90, 0, 0]);
  ok('euler→quat correct (90° x)', Math.abs(q[0] - Math.SQRT1_2) < 1e-6 && Math.abs(q[3] - Math.SQRT1_2) < 1e-6);
  ok('quatAngle symétrique et bornée', Math.abs(quatAngle(eulerToQuat([0, 0, 0]), eulerToQuat([45, 0, 0])) - Math.PI / 4) < 1e-6);
}
ok('les 22 os canoniques Mixamo déclarés', MIXAMO_BONES.length === 22);

// ---------- MIRROR: the whole strike library is right-footed; a left-footed pass must be exact
{
  const left = mirrorMove(MOVES.passe);
  const c = checkClip(resolveTracks(left));
  ok('passe miroir (pied gauche) anatomiquement saine', c.ok, c.issues[0] || '');
  const rightKey = MOVES.passe.keys.find((k) => k.pose.RightUpLeg);
  const leftKey = left.keys.find((k) => k.pose.LeftUpLeg);
  ok('la jambe de frappe a changé de côté', !!leftKey && !leftKey.pose.RightUpLeg);
  ok('la flexion (x) est conservée, le lacet/roulis (y,z) sont inversés',
    leftKey.pose.LeftUpLeg[0] === rightKey.pose.RightUpLeg[0] && leftKey.pose.LeftUpLeg[1] === -rightKey.pose.RightUpLeg[1]);
  ok('miroir involutif (miroir du miroir = original)', JSON.stringify(mirrorMove(mirrorMove(MOVES.passe)).keys) === JSON.stringify(MOVES.passe.keys));
  const dive = mirrorMove(MOVES.plongeon);
  ok('root motion latéral inversé (plongeon de l\'autre côté)',
    dive.keys.some((k, i) => k.hips && MOVES.plongeon.keys[i].hips && k.hips[0] === -MOVES.plongeon.keys[i].hips[0] && k.hips[1] === MOVES.plongeon.keys[i].hips[1]));
  for (const [n, m] of Object.entries(MOVES)) {
    const r = checkClip(resolveTracks(mirrorMove(m)));
    if (!r.ok) ok(`miroir de « ${n} » sain`, false, r.issues[0]);
  }
  ok('les 11 moves supportent le miroir', Object.values(MOVES).every((m) => checkClip(resolveTracks(mirrorMove(m))).ok));
}

const sab = (name, mutate, expect) => {
  const spec = JSON.parse(JSON.stringify(MOVES.salut)); mutate(spec);
  const r = checkClip(resolveTracks(spec));
  const hit = !r.ok && r.issues.some((i) => i.includes(expect));
  (hit ? pass++ : fail++);
  console.log(`${hit ? '✓' : '✗'} sabotage « ${name} » attrapé${hit ? '' : ` — issues: ${r.issues.join('; ') || '(aucune)'}`}`);
};
sab('os inconnu (typo de rig)', (s) => { s.keys[1].pose.RigthArm = [0, 0, -90]; }, 'unknown bone');
sab('clés dans le désordre', (s) => { s.keys[2].t = 0.1; }, 'not strictly sorted');
sab('membre téléporté (180° en 30 ms)', (s) => { s.keys[1].t = 0.03; s.keys[1].pose.RightForeArm = [0, 0, -178]; s.keys[0].pose.RightForeArm = [0, 0, 0]; }, 'teleports');
sab('couture de boucle cassée (fin ≠ début)', (s) => { s.keys[s.keys.length - 1].pose.RightArm = [0, 0, -20]; }, 'loop seam');
sab('genou plié à l’envers', (s) => { s.keys[1].pose.RightLeg = [-60, 0, 0]; s.keys[0].pose.RightLeg = [-50, 0, 0]; s.keys[s.keys.length - 1].pose.RightLeg = [-50, 0, 0]; }, 'knee out of range');
{
  const sabH = (name, mutate, expect) => {
    const spec = JSON.parse(JSON.stringify(MOVES.plongeon)); mutate(spec);
    const r = checkClip(resolveTracks(spec));
    const hit = !r.ok && r.issues.some((i) => i.includes(expect));
    (hit ? pass++ : fail++);
    console.log(`${hit ? '✓' : '✗'} sabotage « ${name} » attrapé${hit ? '' : ` — issues: ${r.issues.join('; ') || '(aucune)'}`}`);
  };
  sabH('bassin à travers le sol', (s) => { s.keys[3].hips = [1.35, -1.2, 0]; }, 'through the floor');
  sabH('saut-fusée (dy 2 m)', (s) => { s.keys[2].hips = [0, 2, 0]; }, 'rocket jump');
  sabH('bassin téléporté (1,3 m en 40 ms)', (s) => { s.keys[2].t = s.keys[1].t + 0.04; }, 'hips teleport');
}


// ---------- CONTACT : le seul nombre qui synchronise une frappe avec le ballon
{
  const strikes = ['frappe', 'passe', 'talonnade', 'amorti', 'retournee'];
  for (const n of strikes) {
    const m = MOVES[n];
    ok(`« ${n} » déclare sa frame de contact`, typeof m.contact === 'number', `contact=${m.contact}`);
    ok(`  contact dans le clip (0 < ${m.contact} < ${m.duration})`, m.contact > 0 && m.contact < m.duration);
    // le contact doit tomber SUR une pose clé, pas dans une interpolation : c'est l'instant où le pied
    // est le plus loin dans son geste, et une valeur "au milieu" est une intention perdue
    const near = m.keys.reduce((b, k) => (Math.abs(k.t - m.contact) < Math.abs(b.t - m.contact) ? k : b), m.keys[0]);
    ok(`  contact posé sur une clé (${near.t})`, Math.abs(near.t - m.contact) < 1e-6);
    ok(`  la clé de contact pose vraiment quelque chose`, Object.keys(near.pose).length > 0);
  }
  // mirrorMove doit transporter le contact : sinon le pied gauche frappe à un autre instant que le droit
  const mg = mirrorMove(MOVES.passe);
  ok('mirrorMove conserve la frame de contact', mg.contact === MOVES.passe.contact, `${mg.contact}`);
}

console.log('\n— la pose neutre est symétrique, et la loi du miroir est exacte —');
{
  // Deux clauses jumelles, et la seconde protège la première : une BASE_POSE asymétrique fige les bras
  // en torsion sur TOUT geste qui ne les anime pas, et c'est invisible parce que ça ne bouge jamais.
  const dq = (a, b) => Math.min(
    Math.max(...a.map((v, i) => Math.abs(v - b[i]))),
    Math.max(...a.map((v, i) => Math.abs(v + b[i]))),   // q et −q sont la MÊME rotation : nier le quaternion ENTIER
  );                                                   // (une double-couverture composante par composante
                                                       //  laisse passer un signe, et m'a donné une conclusion fausse)
  const conj = ([x, y, z, w]) => [x, -y, -z, w];
  const pairs = [['LeftArm', 'RightArm'], ['LeftForeArm', 'RightForeArm']];
  let worstPose = 0;
  for (const [L, R] of pairs) {
    if (!BASE_POSE[L] || !BASE_POSE[R]) continue;
    worstPose = Math.max(worstPose, dq(conj(eulerToQuat(BASE_POSE[L])), eulerToQuat(BASE_POSE[R])));
  }
  ok(`la pose neutre est symétrique (écart ${worstPose.toFixed(6)})`, worstPose < 1e-6);

  // …et la loi utilisée par mirrorMove EST la conjugaison. Vérifié sur 20 000 poses aléatoires, parce
  // qu'une loi de miroir fausse ne se voit que sur les gestes du pied gauche, soit une fois sur deux.
  let worstLaw = 0;
  for (let i = 0; i < 20000; i++) {
    const e = [(Math.random() * 2 - 1) * 170, (Math.random() * 2 - 1) * 170, (Math.random() * 2 - 1) * 170];
    worstLaw = Math.max(worstLaw, dq(eulerToQuat(mirrorEuler(e)), conj(eulerToQuat(e))));
  }
  ok(`mirrorEuler EST la conjugaison quaternion (écart max ${worstLaw.toFixed(6)} sur 20 000 poses)`, worstLaw < 1e-6);
  // le sabotage : la variante plausible et fausse qu'on a failli livrer
  const bad = ([x, y, z]) => [x, -y, z];
  let worstBad = 0;
  for (let i = 0; i < 2000; i++) {
    const e = [(Math.random() * 2 - 1) * 170, (Math.random() * 2 - 1) * 170, (Math.random() * 2 - 1) * 170];
    worstBad = Math.max(worstBad, dq(eulerToQuat(bad(e)), conj(eulerToQuat(e))));
  }
  ok(`sabotage « miroir [x,-y,z] » attrapé (écart ${worstBad.toFixed(2)})`, worstBad > 0.1);
  // …et le sabotage de la pose neutre
  const asym = { LeftArm: [0, 0, 60], RightArm: [0, 0, 60] };
  ok('sabotage « pose neutre asymétrique (les deux bras du même côté) » attrapé',
    dq(conj(eulerToQuat(asym.LeftArm)), eulerToQuat(asym.RightArm)) > 0.1);
}

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);
