#!/usr/bin/env node
// verify-animkit.mjs — the movement kit (engine/animkit.js): every library move must be an
// ANATOMICALLY SANE animation under checkClip — known Mixamo bones only, sorted keys, normalized
// quaternions, bounded angular velocity (no teleporting limbs), looping moves land where they start,
// knees/hips inside their range. Plus determinism and named sabotages.
import { MOVES, resolveTracks, checkClip, checkStrike, eulerToQuat, quatAngle, MIXAMO_BONES, mirrorMove, BASE_POSE, mirrorEuler } from '../assets/starter/src/engine/animkit.js';

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
  // « la jambe de frappe a changé de côté » se mesure à l'AMPLITUDE, plus à la présence : depuis que
  // la jambe d'appui est animée (c'était une clause d'expressivité), TOUTES les clés keyent les deux
  // jambes — l'ancienne version de cette clause, « la clé gauche ne doit pas keyer la droite »,
  // condamnait donc précisément le progrès qu'elle était censée protéger.
  const excur = (spec, bone) => {
    const ks = resolveTracks(spec).tracks[bone] || [];
    let w = 0; for (const k of ks) w = Math.max(w, quatAngle(ks[0].q, k.q));
    return w;
  };
  ok('la jambe de frappe a changé de côté (l\'amplitude domine à GAUCHE dans le miroir)',
    excur(left, 'LeftUpLeg') > excur(left, 'RightUpLeg') * 1.5
    && Math.abs(excur(left, 'LeftUpLeg') - excur(MOVES.passe, 'RightUpLeg')) < 1e-6);
  const rightKey = MOVES.passe.keys.find((k) => Math.abs(k.t - MOVES.passe.contact) < 1e-6);
  const leftKey = left.keys.find((k) => Math.abs(k.t - left.contact) < 1e-6);
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
  ok('les 12 moves supportent le miroir', Object.values(MOVES).every((m) => checkClip(resolveTracks(mirrorMove(m))).ok));
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
// le signe est MESURÉ (sonde articulaire) : la flexion du genou est −x sur ce rig — un genou à
// +60 plie VERS L'AVANT, et c'est ça, le genou à l'envers.
sab('genou plié à l’envers', (s) => { s.keys[1].pose.RightLeg = [60, 0, 0]; s.keys[0].pose.RightLeg = [50, 0, 0]; s.keys[s.keys.length - 1].pose.RightLeg = [50, 0, 0]; }, 'knee out of range');
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

console.log('\n— l’expressivité des frappes : le corps entier, prouvé —');
{
  // Trois régimes, comme au foot : la frappe armée (séquence proximo-distale exigée), le geste
  // tournant (pivot, talonnade), la pichenette (extérieur, déviation — la jambe reste sous le corps
  // PAR mécanique ; le seuil suit le geste, jamais l'inverse).
  const FAMILIES = [
    [['frappe', 'passe'], {}],
    [['passePivot'], { proximoDistal: false }],
    [['passeExterieur', 'deviation'], { proximoDistal: false, flick: true }],
  ];
  for (const [ids, opts] of FAMILIES) for (const id of ids) {
    const r = checkStrike(resolveTracks(MOVES[id]), opts);
    ok(`« ${id} » engage le corps entier`, r.ok, r.issues.join(' | '));
  }
  // LA TALONNADE EST L'EXCEPTION QUI CONFIRME — littéralement. Sa mécanique est l'INVERSE des clauses
  // de frappe : bassin carré, épaules de face, tête HAUTE (regarder le ballon vendrait le geste ; la
  // tromperie est le geste). La faire passer par checkStrike la falsifierait. Ses clauses à elle :
  {
    const T = resolveTracks(MOVES.talonnade).tracks;
    const range = (b, a) => { const ks = T[b] || []; const vs = ks.map((k) => k.e[a]); return ks.length ? Math.max(...vs) - Math.min(...vs) : 0; };
    ok('« talonnade » : le bassin RESTE carré (c\'est sa signature)', range('Hips', 1) < 6, `${range('Hips', 1).toFixed(0)}°`);
    ok('« talonnade » : la tête reste HAUTE (la tromperie est le geste)',
      Math.max(...(T.Head || [{ e: [0] }]).map((k) => k.e[0])) <= 0);
    ok('« talonnade » : le genou fouette derrière', range('RightLeg', 0) >= 70, `${range('RightLeg', 0).toFixed(0)}°`);
    ok('« talonnade » : un bras d\'équilibre existe quand même', (() => {
      const ks = T.LeftArm || []; let w = 0;
      for (const k of ks) w = Math.max(w, (quatAngle(ks[0].q, k.q) * 180) / Math.PI);
      return w >= 15;
    })());
  }
}
{
  // LE SABOTAGE-RÉFÉRENCE : l'ancienne frappe telle qu'elle était écrite — bassin à 0°, pas de tête,
  // pas de jambe d'appui, cuisse et tibia à l'extrême SUR LA MÊME CLÉ. Elle a été livrée pendant des
  // semaines ; le contrat doit la condamner sur PLUSIEURS clauses, sinon il n'aurait rien empêché.
  const old = {
    name: 'frappe-plate', duration: 0.85, contact: 0.42, loop: false,
    keys: [
      { t: 0.0, pose: {} },
      { t: 0.22, pose: { RightUpLeg: [28, 0, 0], RightLeg: [95, 0, 0], LeftArm: [-35, 0, 45], RightArm: [15, 0, 70], Spine1: [10, 0, 0] } },
      { t: 0.42, pose: { RightUpLeg: [-85, 0, 0], RightLeg: [15, 0, 0], RightFoot: [30, 0, 0], LeftArm: [15, 0, 60], RightArm: [-45, 0, 50], Spine1: [-8, 0, 0] } },
      { t: 0.6, pose: { RightUpLeg: [-60, 0, 0], RightLeg: [30, 0, 0], LeftArm: [0, 0, 55], RightArm: [-25, 0, 55], Spine1: [-4, 0, 0] } },
      { t: 0.85, pose: {} },
    ],
  };
  const r = checkStrike(resolveTracks(old));
  ok('sabotage « l’ancienne frappe plate » attrapé sur plusieurs clauses', !r.ok && r.issues.length >= 3,
    `${r.issues.length} clauses`);
  ok('  …dont la séquence proximo-distale absente', r.issues.some((i) => i.includes('proximo')));
  ok('  …et le bassin figé', r.issues.some((i) => i.includes('bassin')));
}
{
  // LE PIÈGE DU BRAS HOMOLATÉRAL (trouvé par un réfuteur) : tous les moves sont pied droit, donc le
  // bras d'équilibre est le GAUCHE. Une clause qui mesurerait le droit validerait un geste au bras
  // d'équilibre mort. On soude le piège : bras droit expressif + bras gauche mort DOIT échouer.
  const trap = JSON.parse(JSON.stringify(MOVES.frappe));
  for (const k of trap.keys) { if (k.pose.LeftArm) k.pose.LeftArm = [...BASE_POSE.LeftArm]; if (k.pose.LeftForeArm) k.pose.LeftForeArm = [...BASE_POSE.LeftForeArm]; }
  const r = checkStrike(resolveTracks(trap));
  ok('sabotage « bras homolatéral expressif, bras d’équilibre mort » attrapé', !r.ok && r.issues.some((i) => i.includes('OPPOSÉ')));
}
{
  // …et le plafond PAR CHAÎNE : un genou à 17 rad/s est une frappe d'élite, un BRAS à 20 rad/s est un
  // bug. L'ancien plafond unique (14) interdisait la frappe ; le nouveau ne doit pas tout permettre.
  const armGun = { name: 'bras-fusil', duration: 0.3, loop: false, keys: [
    { t: 0.0, pose: { RightArm: [0, 0, 60] } },
    { t: 0.1, pose: { RightArm: [-115, 0, 60] } },
    { t: 0.3, pose: { RightArm: [0, 0, 60] } },
  ] };
  ok('sabotage « bras à 20 rad/s » attrapé (le plafond des jambes ne vaut pas pour les bras)',
    !checkClip(resolveTracks(armGun)).ok);
  const legWhip = { name: 'fouet-jambe', duration: 0.3, loop: false, keys: [
    { t: 0.0, pose: { RightLeg: [-108, 0, 0] } },
    { t: 0.1, pose: { RightLeg: [-10, 0, 0] } },
    { t: 0.3, pose: { RightLeg: [-30, 0, 0] } },
  ] };
  ok('  …et le même fouet sur un GENOU passe (17 rad/s : une frappe d’élite)',
    checkClip(resolveTracks(legWhip)).ok);
}


console.log('\n— la SILHOUETTE : où finissent les mains, sur le vrai squelette —');
{
  // La leçon de cette clause : checkStrike mesurait des DEGRÉS par os et était vert pendant que la
  // capture montrait un bras tendu à la verticale au-dessus de la tête pour une passe de huit mètres.
  // Une clause d'animation qui ne regarde pas le RÉSULTAT MONDE mesure une ombre. Celle-ci fait la FK
  // du vrai squelette (shanon.glb, parsé brut — pas de three, pas de textures) et exige qu'aucune
  // main ne monte au-dessus du cou sur un geste de football. Les célébrations, elles, ont le droit.
  import('node:fs').then(() => {});
  const { readFileSync } = await import('node:fs');
  const raw = readFileSync(new URL('../../../examples/showcase/public/shanon.glb', import.meta.url));
  const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  let off = 12, json = null;
  while (off < dv.byteLength) {
    const l = dv.getUint32(off, true), ty = dv.getUint32(off + 4, true);
    if (ty === 0x4E4F534A) json = JSON.parse(new TextDecoder().decode(raw.subarray(off + 8, off + 8 + l)));
    off += 8 + l + ((4 - (l % 4)) % 4); if (json) break;
  }
  const N = json.nodes, parent = new Map(); N.forEach((n, i) => (n.children || []).forEach((c) => parent.set(c, i)));
  const nIdx = new Map(); N.forEach((n, i) => nIdx.set(String(n.name || '').replace(/^mixamorig\d*[:_]?/i, ''), i));
  const chain = (name) => { const out = []; let k = nIdx.get(name); while (k != null) { out.unshift(k); k = parent.get(k); } return out; };
  const qm = (a, c) => [a[3] * c[0] + a[0] * c[3] + a[1] * c[2] - a[2] * c[1], a[3] * c[1] - a[0] * c[2] + a[1] * c[3] + a[2] * c[0],
    a[3] * c[2] + a[0] * c[1] - a[1] * c[0] + a[2] * c[3], a[3] * c[3] - a[0] * c[0] - a[1] * c[1] - a[2] * c[2]];
  const rv = (q, v) => { const [x, y, z, w] = q; const ux = y * v[2] - z * v[1], uy = z * v[0] - x * v[2], uz = x * v[1] - y * v[0];
    return [v[0] + 2 * (w * ux + y * uz - z * uy), v[1] + 2 * (w * uy + z * ux - x * uz), v[2] + 2 * (w * uz + x * uy - y * ux)]; };
  const world = (name, pose) => { let q = [0, 0, 0, 1], p = [0, 0, 0];
    for (const k of chain(name)) { const nm = String(N[k].name || '').replace(/^mixamorig\d*[:_]?/i, '');
      const t = N[k].translation || [0, 0, 0]; const rt = rv(q, t); p = [p[0] + rt[0], p[1] + rt[1], p[2] + rt[2]];
      q = qm(q, pose[nm] || (N[k].rotation || [0, 0, 0, 1])); }
    return p; };
  const handsBelowNeck = (spec) => {
    const r = resolveTracks(spec);
    const times = [...new Set(Object.values(r.tracks).flatMap((ks) => ks.map((k) => k.t)))];
    let worst = -Infinity, at = 0;
    for (const t of times) {
      const pose = {};
      for (const [bone, ks] of Object.entries(r.tracks)) { const k = ks.find((k2) => Math.abs(k2.t - t) < 1e-9); if (k) pose[bone] = k.q; }
      const neck = world('Neck', pose)[1];
      for (const hand of ['LeftHand', 'RightHand']) {
        const d = world(hand, pose)[1] - neck;
        if (d > worst) { worst = d; at = t; }
      }
    }
    return { worst, at };
  };
  const FOOT_MOVES = ['frappe', 'passe', 'passeExterieur', 'passePivot', 'deviation', 'talonnade',
    'controleInterieur', 'controleExterieur', 'controleSemelle', 'amortiCuisse', 'amorti', 'tacleDebout'];
  for (const id of FOOT_MOVES) {
    const { worst, at } = handsBelowNeck(MOVES[id]);
    ok(`« ${id} » : aucune main au-dessus du cou (pire ${(worst * 100).toFixed(0)} cm à t=${at})`, worst <= 0.02);
  }
  // LE SABOTAGE-RÉFÉRENCE : la frappe LIVRÉE la veille — bras d'équilibre à la verticale (main à
  // +20 cm au-dessus du cou), verte sous checkStrike, dénoncée par l'utilisateur sur capture.
  const skyArm = JSON.parse(JSON.stringify(MOVES.frappe));
  for (const k of skyArm.keys) {
    if (k.pose.LeftArm) { k.pose.LeftArm = [-38, 0, 52]; k.pose.LeftForeArm = [-20, 0, 20]; }
  }
  const sky = handsBelowNeck(skyArm);
  ok(`sabotage « bras d'équilibre au ciel (la version livrée) » attrapé (main à +${(sky.worst * 100).toFixed(0)} cm)`, sky.worst > 0.05);
}

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);
