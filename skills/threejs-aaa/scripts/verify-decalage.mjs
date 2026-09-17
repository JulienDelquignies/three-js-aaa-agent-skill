// verify-decalage.mjs — LA CONDUITE QUI DÉCALE (cfg.decalage ; note 397). Retour utilisateur du 17/09 : « la conduite de balle ne crée pas
// de décalage, elle est trop rigide, trop rectiligne ; les passements de jambes sont toujours arrêtés, je les attends en course ». Mesuré
// (2 × 300 s) : rectitude médiane 0,98, 0 crochet, 3 passements en course pour 6 posés ; l'entonnoir du crochet (dev-engine instrumenté) :
// 597 refus « ballon > 0,65 m », 571 « fenêtre », 78 « pas devant » — le plus proche adversaire était le CHASSEUR dans le dos (132° p50), la
// fermeture ne lisait que la vitesse du défenseur (un jockey posté qu'on attaque ne « ferme » jamais). La loi : (1) L'ÉPAULE (match-sim) —
// le porteur lancé (≥ v) avec un défenseur devant (< fixe m, < lat m) vise son épaule du côté libre (cote m), l'évasion ne dilue plus
// (tenir) ; (2) LE CROCHET EN COURSE (skills-sim) — le défenseur DEVANT (≤ 75°) jusqu'à foe m, le ballon jusqu'à ballon m ramené devant le
// pied pendant l'armé (pinRel), la fermeture RELATIVE (closing), un plancher d'appétit, le corps qui court sous l'armé (mobile) ; (3) LE
// PASSEMENT EN COURSE jusqu'à chargeCourse m/s de charge. null : l'hier au bit.
import { makeMatch, matchCfg, matchStep } from '../assets/starter/src/engine/match-sim.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };
const hyp = Math.hypot;
const PINS = { toucheOrientee: null };   // la clé sœur du 17/09, nulle ; orientationPasse et verticalite vivent avec
const KD = matchCfg({}).decalage;

console.log('— (a) le match : des crochets, des passements en course —');
const match = (over, seeds = [3, 7], secs = 300) => {
  const R = { crochets: 0, passCourse: 0, passPoses: 0, pertes: 0, passes: 0 };
  for (const seed of seeds) {
    const st = makeMatch({ full: true, seed }), cfg = matchCfg({ xt: null /* xt null DATÉ 283 : vert à HEAD~ (worktree bd3322e), les crochets remangés (1 avec la clé c. ≥ 2 sur 2 × 300 s : la valeur de position change les conduites) — la clause mesure sa loi, pas la valeur de position xT */, ...PINS, ...over });
    for (let i = 0; i < 60 * secs; i++) matchStep(st, 1 / 60, cfg);
    for (const e of st.events) { if (e.type === 'skill' && e.kind === 'crochet') R.crochets++; if (e.type === 'skill' && e.kind === 'passement') { if (e.enCourse) R.passCourse++; else R.passPoses++; } if (e.type === 'pass') R.passes++; }
    R.pertes += st.turnovers ?? 0;
  }
  return R;
};
const A = match({}), N = match({ decalage: null });
ok(`LES CROCHETS : ${A.crochets} avec la clé (2 × 300 s, graines 3 et 7) contre ${N.crochets} hier (mesuré 0 sur le monde d'hier au bit ; ici hier = les clés 395-396 vivantes) — au moins 2, et pas moins qu'hier (le tirage est seedé : 2-4 selon l'état du monde)`, A.crochets >= 2 && A.crochets >= N.crochets);
ok(`LES GESTES EN COURSE (crochets + passements lancés) : ${A.crochets + A.passCourse} avec la clé (${A.passCourse} passements en course, ${A.passPoses} posés) contre ${N.crochets + N.passCourse} hier (${N.passCourse} en course, ${N.passPoses} posés) — au moins 3 (le tirage est seedé et la fenêtre fugace : 4-9 mesurés selon la graine ; la fixture (d) prouve la porte)`, A.crochets + A.passCourse >= 3);
ok(`…sans dégrader le monde : ${A.pertes} pertes pour ${A.passes} passes (${(A.pertes / Math.max(1, A.passes)).toFixed(2)} par passe) contre ${N.pertes} pour ${N.passes} hier (${(N.pertes / Math.max(1, N.passes)).toFixed(2)}) — au plus 1,2 × + 0,02 par passe (le duel attaqué se perd aussi : c'est le prix du décalage)`, A.pertes / Math.max(1, A.passes) <= N.pertes / Math.max(1, N.passes) * 1.2 + 0.02);

// LA FIXTURE : le porteur A lancé vers son but d'attaque à 3,5 m/s, le ballon de course devant, un défenseur F devant (posé ou qui avance), une ligne loin derrière lui
const fixture = (over, { dFoe = 2.2, zFoe = 0.4, vFoe = 0, secs = 3, avantPied = 0.9 } = {}) => {
  const st = makeMatch({ full: true, seed: 3 }), cfg = matchCfg({ ...PINS, tenueCalme: null, holdCalmFull: [2.5, 2.6], ...over });   // la tenue longue : il conduit avant de penser passe
  for (let i = 0; i < 60; i++) matchStep(st, 1 / 60, cfg);
  if (st.ball.owner != null) st.ball.release('perte');
  for (const q of st.players) { q.p[0] = -40 - (q.id % 11) * 1.5; q.p[2] = q.team ? 28 : -28; q.v = [0, 0]; q.act = null; q.job = 'walk'; q.target = [q.p[0], 0, q.p[2]]; q.intent = null; q._skillCd = null; q._dribAt = -99; q._pace = null; }
  const sg = Math.sign(st.pitch.attackGoal(0).x || 1), yaw0 = sg > 0 ? 0 : Math.PI;
  const A = st.players.filter((q) => q.team === 0 && !q.keeper).sort((a, b) => ((b.persona?.flair ?? 0.5) * (b.skill?.gesteF ?? 1)) - ((a.persona?.flair ?? 0.5) * (a.skill?.gesteF ?? 1)))[0];
  A.p[0] = -5 * sg; A.p[2] = 0; A.yaw = yaw0; A.v = [3.5 * sg, 0]; A.speed = 3.5; A.job = 'carry'; A.target = [A.p[0] + 4 * sg, 0, 0];
  const F = st.players.find((q) => q.team === 1 && !q.keeper); const fP = [A.p[0] + dFoe * sg, zFoe]; F.p[0] = fP[0]; F.p[2] = fP[1]; F.yaw = yaw0 + Math.PI; F.v = [-vFoe * sg, 0]; F.speed = vFoe; F.job = 'walk'; F.target = [F.p[0] - 6 * sg, 0, F.p[2]];
  const ligne = st.players.filter((q) => q.team === 1 && !q.keeper).slice(1, 5), lP = ligne.map((q, k) => [A.p[0] + 16 * sg, (k - 1.5) * 7]);   // quatre corps à 16 m : pas de contre lancé
  ligne.forEach((q, k) => { q.p[0] = lP[k][0]; q.p[2] = lP[k][1]; q.yaw = yaw0 + Math.PI; q.v = [0, 0]; });
  st.ball.restart([A.p[0] + avantPied * sg, 0.11, 0], { cause: 'engagement' }); st.restart = null; st.ball.release('conduite'); st.ball.impulse([3.2 * sg, 0, 0]); st.possession = { team: 0, carrier: A.id }; st.phase = 'carry'; st.hold = 0.5; st.lastTouch = 0;
  const n0 = st.events.length; let skill = null, dMin = 99, pushBear = null;
  for (let i = 0; i < 60 * secs; i++) {
    for (const q of st.players) if (q !== A && q !== F && !ligne.includes(q)) { q.p[0] = -40 - (q.id % 11) * 1.5; q.p[2] = q.team ? 28 : -28; q.v = [0, 0]; q.act = null; }
    ligne.forEach((q, k) => { q.p[0] = lP[k][0]; q.p[2] = lP[k][1]; q.v = [0, 0]; q.act = null; });
    if (vFoe === 0) { F.p[0] = fP[0]; F.p[2] = fP[1]; F.v = [0, 0]; } else { F.p[0] -= vFoe * sg / 60; F.v = [-vFoe * sg, 0]; F.p[2] = fP[1]; }
    F.act = null;
    matchStep(st, 1 / 60, cfg);
    dMin = Math.min(dMin, hyp(F.p[0] - A.p[0], F.p[2] - A.p[2]));
    if (pushBear == null && A.push && st.t > 0.3 + (n0 ? 0 : 0) && hyp(F.p[0] - A.p[0], F.p[2] - A.p[2]) < 4.5) { const toF = Math.atan2(F.p[2] - A.p[2], F.p[0] - A.p[0]); pushBear = Math.abs(Math.atan2(Math.sin(Math.atan2(A.push[1], A.push[0]) - toF), Math.cos(Math.atan2(A.push[1], A.push[0]) - toF))) * 180 / Math.PI; }
    skill = st.events.slice(n0).find((e) => e.type === 'skill' && e.by === A.id && (e.kind === 'crochet' || e.kind === 'passement'));
    if (skill) break;
  }
  return { skill, dMin, pushBear, mobile: A.act?.payload?.mobile ?? null, pinRel: A.act?.payload?.pinRel ?? null };
};

console.log('— (b) l\'épaule : le porteur lancé vise le côté libre du défenseur devant —');
{
  const r = fixture({ skill: { ...matchCfg({}).skill, crochetFoe: [0.2, 0.3] }, passements: null }, { dFoe: 4.5, zFoe: 0, secs: 1.2 });   // le crochet muselé : on regarde la poussée seule
  const n = fixture({ decalage: null, skill: { ...matchCfg({}).skill, crochetFoe: [0.2, 0.3] }, passements: null }, { dFoe: 4.5, zFoe: 0, secs: 1.2 });
  const epaule = Math.atan2(KD.cote, 2.5) * 180 / Math.PI;
  ok(`LE DÉFENSEUR POSÉ 4,5 m DEVANT, dans l'axe : la poussée du porteur vise à ${r.pushBear?.toFixed(0)}° de lui (l'épaule à cote ${KD.cote} m vaut ~${epaule.toFixed(0)}° à 2,5 m), approche minimale ${r.dMin.toFixed(2)} m — entre 8° et 45°, et il vient à moins de 2,6 m ; hier : ${n.pushBear?.toFixed(0)}°, ${n.dMin.toFixed(2)} m`,
    r.pushBear != null && r.pushBear >= 8 && r.pushBear <= 45 && r.dMin < 2.6);
}

console.log('— (c) le crochet en course sur un jockey posté —');
{
  const r = fixture({ decalage: { ...KD, plancher: 1 } }, { dFoe: 2.4, zFoe: 0.5, vFoe: 0 });
  ok(`LE JOCKEY POSTÉ À 2,4 m DEVANT, le ballon 0,9 m devant le pied à 3,5 m/s : ${r.skill ? `${r.skill.kind}${r.skill.espece ? ' (' + r.skill.espece + ')' : ''} à t=${r.skill.t}` : 'aucun geste en 3 s'} — un crochet, le corps qui court sous l'armé (mobile ${r.mobile}), le ballon ramené devant le pied (pinRel ${r.pinRel})`,
    !!r.skill && r.skill.kind === 'crochet' && r.mobile === true && r.pinRel === KD.pinRel);
  const n = fixture({ decalage: null }, { dFoe: 2.4, zFoe: 0.5, vFoe: 0 });
  ok(`decalage:null — le même jockey posté : ${n.skill ? n.skill.kind : 'aucun crochet'} (hier : un défenseur posé ne « ferme » pas, closing 0 < 0,8 — le crochet n'existait qu'en flux)`, !n.skill || n.skill.kind !== 'crochet');
}

console.log('— (d) le passement en course sur un jockey qui avance —');
{
  const KP = matchCfg({}).passements;
  const r = fixture({ passements: { ...KP, plancher: 1 }, skill: { ...matchCfg({}).skill, crochetFoe: [0.2, 0.3] } }, { dFoe: 3.0, zFoe: 0.3, vFoe: 1.2, secs: 3, avantPied: 0.6 });
  ok(`LE JOCKEY QUI AVANCE À 1,2 m/s, le porteur lancé à 3,5 m/s : ${r.skill ? `${r.skill.kind} ${r.skill.enCourse ? 'EN COURSE' : 'posé'} à t=${r.skill.t}` : 'aucun geste en 3 s'} — un passement en course (charge 1,2 ≤ chargeCourse ${KD.chargeCourse})`,
    !!r.skill && r.skill.kind === 'passement' && r.skill.enCourse === true);
  const n = fixture({ decalage: null, passements: { ...KP, plancher: 1 }, skill: { ...matchCfg({}).skill, crochetFoe: [0.2, 0.3] } }, { dFoe: 3.0, zFoe: 0.3, vFoe: 1.2, secs: 3, avantPied: 0.6 });
  ok(`decalage:null — le même jockey : ${n.skill ? `${n.skill.kind} ${n.skill.enCourse ? 'en course' : 'posé'}` : 'aucun passement en course'} (hier : lancé, la charge > 0,6 m/s refusait)`, !n.skill || !(n.skill.kind === 'passement' && n.skill.enCourse));
}

console.log('— (e) la sortie menée au bout (402, decalage.sortie) : le mordu s\'assoit au moins bite s —');
{
  const KP = matchCfg({}).passements, K0 = matchCfg({}).skill;
  const morsure = (over) => { const st = makeMatch({ full: true, seed: 3 }), cfg = matchCfg({ ...PINS, tenueCalme: null, holdCalmFull: [2.5, 2.6], passements: { ...KP, plancher: 1 }, skill: { ...K0, crochetFoe: [0.2, 0.3], passementBite: 0.3 }, ...over });
    for (let i = 0; i < 60; i++) matchStep(st, 1 / 60, cfg); if (st.ball.owner != null) st.ball.release('perte');
    for (const q of st.players) { q.p[0] = -40 - (q.id % 11) * 1.5; q.p[2] = q.team ? 28 : -28; q.v = [0, 0]; q.act = null; q.job = 'walk'; q.target = [q.p[0], 0, q.p[2]]; q.intent = null; q._skillCd = null; q._dribAt = -99; q._pace = null; q._bite = -1; }
    const sg = Math.sign(st.pitch.attackGoal(0).x || 1), yaw0 = sg > 0 ? 0 : Math.PI;
    const A = st.players.filter((q) => q.team === 0 && !q.keeper).sort((a, b) => ((b.persona?.flair ?? 0.5) * (b.skill?.gesteF ?? 1)) - ((a.persona?.flair ?? 0.5) * (a.skill?.gesteF ?? 1)))[0];
    A.p[0] = -5 * sg; A.p[2] = 0; A.yaw = yaw0; A.v = [0, 0]; A.speed = 0; A.job = 'carry';
    const F = st.players.find((q) => q.team === 1 && !q.keeper); F.p[0] = A.p[0] + 1.7 * sg; F.p[2] = 0; F.yaw = yaw0 + Math.PI; F.v = [0, 0]; F.job = 'walk'; F.target = [F.p[0], 0, F.p[2]];
    const ligne = st.players.filter((q) => q.team === 1 && !q.keeper).slice(1, 5), lP = ligne.map((q, k) => [A.p[0] + 16 * sg, (k - 1.5) * 7]); ligne.forEach((q, k) => { q.p[0] = lP[k][0]; q.p[2] = lP[k][1]; q.yaw = yaw0 + Math.PI; q.v = [0, 0]; });
    st.ball.restart([A.p[0] + 0.35 * sg, 0.11, 0], { cause: 'engagement' }); st.restart = null; st.ball.possess(A.id); st.possession = { team: 0, carrier: A.id }; st.phase = 'carry'; st.hold = 1; st.lastTouch = 0;
    const n0 = st.events.length; let vendu = null, bite = null;
    for (let i = 0; i < 60 * 4; i++) { for (const q of st.players) if (q !== A && q !== F && !ligne.includes(q)) { q.p[0] = -40 - (q.id % 11) * 1.5; q.p[2] = q.team ? 28 : -28; q.v = [0, 0]; q.act = null; } ligne.forEach((q, k) => { q.p[0] = lP[k][0]; q.p[2] = lP[k][1]; q.v = [0, 0]; q.act = null; }); if (!vendu) { F.p[0] = A.p[0] + 1.7 * sg; F.p[2] = 0; F.v = [0, 0]; F.act = null; }
      matchStep(st, 1 / 60, cfg); if (!vendu) { vendu = st.events.slice(n0).find((e) => e.type === 'skill' && e.kind === 'passement-vendu' && e.by === A.id && e.bitten?.length); if (vendu) bite = +(F._bite - st.t).toFixed(2); } else break; }
    return { vendu: !!vendu, bite }; };
  const a = morsure({}), n = morsure({ decalage: null });
  ok(`LE PASSEMENT VENDU AU JOCKEY POSTÉ (passementBite 0,3 s × gesteF) : le mordu s'assoit ${a.bite ?? '—'} s avec la clé contre ${n.bite ?? '—'} s hier — au moins bite ${KD.sortie.bite} s, et hier moins`, a.vendu && a.bite >= KD.sortie.bite - 0.02 && (!n.vendu || n.bite < KD.sortie.bite - 0.05));
}

console.log(`decalage : ${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
