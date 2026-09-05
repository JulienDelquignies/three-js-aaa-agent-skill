#!/usr/bin/env node
// verify-motion.mjs — LES FRAPPES GÉNÉRÉES, prouvées sans navigateur (motion-rig + motion-strike).
//
// Ce que le banc tient :
//   1. LE PROFIL : le rig de référence (shanon.glb, parsé brut) et le profil baké sont le MÊME
//      squelette (positions bind à 1 mm), et chaque articulation anatomique déplace l'extrémité
//      dans le sens promis (la sonde des signes — ce qui remplace « on a cru que X abaisse le bras »).
//   2. LA CONJUGAISON : Euler ↔ quaternion aller-retour exact ; rest ⊗ q_spec reproduit la rotation
//      d'articulation voulue à 1e-6 sur toute la chaîne (la preuve d'une ligne, mesurée).
//   3. LE CONTRAT DE FRAPPE, par espèce et par pied : vitesse du pied au contact dans la fenêtre du
//      réel, pic sur le contact, séquence proximo-distale, appui planté et à plat, mains sous le cou,
//      coude vivant, retour à la pose initiale — et les clauses d'animkit (checkClip, checkStrike).
//   4. LE STYLE : 40 graines × 7 espèces restent sous contrat (un détail par joueur, jamais un
//      autre geste), le même joueur re-tire le même geste, deux joueurs ne sont pas des clones.
//   5. LES AMPLITUDES BAKÉES tiennent leur vitesse (le jeu génère sans bissection).
//   6. LA STANCE DÉRIVÉE (S = cheville + 0,18 · direction) concorde avec approach.STANCES_CLIP (≤ 8 cm) —
//      la table est imprimée pour être recopiée quand un geste change.
//   7. LE MIROIR est exact : la FK du geste miroir est le miroir de la FK (x ↔ −x, ≤ 1 cm).
//   8. LES SABOTAGES : la frappe plate d'hier, une main au ciel, un appui qui glisse, un style hors
//      bornes — chacun refusé par la clause qui le nomme.
import { readFileSync } from 'node:fs';
import { profileFromGltf, checkProfile, fkPose, jointToSpec, jointsToSpec, quatToEulerXYZ, rx, ry, rz, chain, CANON } from '../assets/starter/src/engine/motion-rig.js';
import { SHANON_PROFILE } from '../assets/starter/src/engine/motion-profile-shanon.js';
import { KINDS, STYLE_RANGES, NEUTRAL_STYLE, styleFromSeed, generateStrike, solveStrike, strikePortrait, checkStrikeGen, ramp } from '../assets/starter/src/engine/motion-strike.js';
import { resolveTracks, checkClip, checkStrike, mirrorMove, eulerToQuat, quatAngle } from '../assets/starter/src/engine/animkit.js';
import { AUTHORED } from '../assets/starter/src/engine/animkit-data.js';
import { STANCES_CLIP as STANCES } from '../assets/starter/src/engine/approach.js';   // la stance DES CLIPS (la sim garde la sienne : STANCES)
import { CONTROL_KINDS, generateControl, checkControlGen } from '../assets/starter/src/engine/motion-control.js';
import { AERIAL_KINDS, generateAerial, checkAerialGen } from '../assets/starter/src/engine/motion-aerial.js';
import { SKILL_KINDS, generateSkill, checkSkillGen } from '../assets/starter/src/engine/motion-skill.js';
import { GROUND_KINDS, generateGround, checkGroundGen } from '../assets/starter/src/engine/motion-ground.js';
import { KEEPER_KINDS, generateKeeper, checkKeeperGen } from '../assets/starter/src/engine/motion-keeper.js';
import { GENERATORS, GENERATED_KINDS } from '../assets/starter/src/engine/motion-cast.js';
import { quatMul, quatNormalize } from '../assets/starter/src/engine/vecmath.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };
const R2D = 180 / Math.PI;

// ---------- 1. le profil
const raw = readFileSync(new URL('../../../examples/showcase/public/shanon.glb', import.meta.url));
const glbLen = new DataView(raw.buffer, raw.byteOffset, raw.byteLength).getUint32(12, true);
const json = JSON.parse(new TextDecoder().decode(raw.subarray(20, 20 + glbLen)));
const P = profileFromGltf(json, { faces: '+Z' });
console.log('— le profil du rig —');
ok('les 22 os canoniques sont dans le profil', CANON.every((b) => P.bones[b]));
{
  let worst = 0;
  for (const b of CANON) { const a = P.bones[b].bindP, c = SHANON_PROFILE.bones[b].bindP; worst = Math.max(worst, Math.hypot(a[0] - c[0], a[1] - c[1], a[2] - c[2])); }
  ok(`le profil baké EST le fichier (positions bind à ${(worst * 1000).toFixed(2)} mm ≤ 1)`, worst <= 1e-3);
}
ok(`longueurs plausibles (cuisse ${P.lengths.thigh.toFixed(2)} m, tibia ${P.lengths.shank.toFixed(2)}, bassin à ${P.lengths.hipsY.toFixed(2)})`, P.lengths.thigh > 0.3 && P.lengths.shank > 0.3 && P.lengths.hipsY > 0.8);
{ const c = checkProfile(P); ok('la sonde des signes : chaque articulation déplace l\'extrémité dans le sens promis', c.ok, c.issues.join(' | ')); }
{
  // sabotage : un profil dont le lacet du wrapper est oublié (rig « +Z » lu tel quel) regarde à l'envers
  const bad = profileFromGltf(json, { faces: '-Z' });
  const c = checkProfile(bad);
  ok('sabotage « wrapper oublié (le rig regarde +Z) » attrapé par la sonde', !c.ok, `${c.issues.length} signes faux`);
}

// ---------- 2. la conjugaison
console.log('\n— la conjugaison —');
{
  let worst = 0;
  for (let i = 0; i < 500; i++) {
    const e = [Math.random() * 300 - 150, Math.random() * 170 - 85, Math.random() * 300 - 150];
    worst = Math.max(worst, quatAngle(eulerToQuat(e), eulerToQuat(quatToEulerXYZ(eulerToQuat(e)))));
  }
  ok(`Euler XYZ ↔ quaternion : aller-retour exact (pire ${worst.toExponential(1)} rad)`, worst < 1e-6);
}
{
  // W(os) = R_parent ⊗ R ⊗ bindQ : une flexion de hanche + une flexion de genou composées par le
  // spec donnent l'orientation monde prédite par la loi anatomique (l'axe du genou emporté par la cuisse)
  const Rh = chain(ry(-20), rz(10), rx(35)), Rk = rx(-70);
  const pose = jointsToSpec(P, { RightUpLeg: Rh, RightLeg: Rk });
  const w = fkPose(P, pose);
  const predicted = quatNormalize(quatMul(quatMul(Rh, Rk), P.bones.RightLeg.bindQ));
  ok(`rest ⊗ q_spec = R_parent ⊗ R ⊗ bindQ sur la chaîne (écart ${(quatAngle(w.RightLeg.q, predicted) * R2D).toExponential(1)}°)`, quatAngle(w.RightLeg.q, predicted) < 1e-6);
}
ok('ramp : C¹, 0 → 1, pic de vitesse à l\'instant demandé', (() => {
  const t0 = 0.1, tp = 0.25, t1 = 0.5, h = 1e-4;
  const v = (t) => (ramp(t + h, t0, tp, t1) - ramp(t - h, t0, tp, t1)) / (2 * h);
  let best = 0, at = 0; for (let t = t0; t <= t1; t += 0.001) { const s = v(t); if (s > best) { best = s; at = t; } }
  return ramp(t0, t0, tp, t1) === 0 && ramp(t1, t0, tp, t1) === 1 && Math.abs(at - tp) < 0.002 && Math.abs(v(t0 + 1e-3)) < 0.5;
})());

// ---------- 3. le contrat, par espèce et par pied
console.log('\n— le contrat de frappe, par espèce et par pied —');
const REAL = { laces: [13.5, 27], inside: [9.5, 16], outside: [7.5, 14], toe: [9, 18], heel: [5.5, 12] };   // fenêtres du réel : cou-de-pied 15-25 (élite), intérieur ~10-14
const stanceTable = {};
for (const k of Object.keys(KINDS)) {
  const K = KINDS[k];
  const spec = generateStrike(k, P);
  ok(`« ${k} » : ${spec.keys.length} clés à 60 Hz, durée ${spec.duration} s et contact ${spec.contact} s inchangés (la sim ne voit rien changer)`,
    spec.duration === K.duration && spec.contact === K.contact && spec.keys.length >= Math.round(K.duration * 60));
  for (const [foot, sp] of [['droit', spec], ['gauche', mirrorMove(spec)]]) {
    const c = checkStrikeGen(sp, P, k, { foot: foot === 'droit' ? 'right' : 'left' });
    const p = c.portrait;
    if (K.feint) ok(`  pied ${foot} : feinte — se RETIENT (pied ${p.vContact.toFixed(1)} m/s), appui planté, mains sous le cou, retour`, c.ok, c.issues.join(' | '));
    else {
      const [lo, hi] = K.vWindow || REAL[K.surface];
      ok(`  pied ${foot} : pied au contact ${p.vContact.toFixed(1)} m/s dans le réel [${lo}, ${hi}], pic à ${(1000 * (p.tPeak - sp.contact)).toFixed(0)} ms du contact`, c.ok && p.vContact >= lo && p.vContact <= hi, c.issues.join(' | '));
      if (K.backheel) ok(`    la talonnade fouette DERRIÈRE (genou ${p.kneeRange.toFixed(0)}° ≥ 70, v_avant ${p.vFwd.toFixed(1)} ≤ −60 %)`, p.kneeRange >= 70 && p.vFwd <= -0.6 * p.vContact);
      else if (K.flick) ok(`    pichenette : la jambe reste sous le corps (hanche ${p.hipMin.toFixed(0)}…${p.hipMax.toFixed(0)}°), pied ${(p.height * 100).toFixed(0)} cm`, p.hipMin >= -40 && p.hipMax <= 100);
      else ok(`    séquence proximo-distale : cuisse ${(p.thighPeak.t * 1000).toFixed(0)} ms PUIS genou ${(p.kneePeak.t * 1000).toFixed(0)} ms (${(p.kneePeak.w * R2D).toFixed(0)}°/s — élite 1 100-1 600)`, p.thighPeak.t < p.kneePeak.t && p.kneePeak.w * R2D >= 690);
      ok(`    appui planté (dérive ${(p.supDrift * 100).toFixed(1)} cm, décollage ${(p.supLift * 100).toFixed(1)} cm), mains à ${(p.worstHand * 100).toFixed(0)} cm sous le cou, retour ${(p.endGap * 100).toFixed(0)} cm`, p.supDrift <= 0.03 && p.supLift <= 0.03 && p.worstHand <= 0.03 && p.endGap <= 0.06);
    }
  }
  const r = resolveTracks(spec);
  const cc = checkClip(r);
  ok(`  checkClip (animkit) : os connus, vitesses angulaires sous les plafonds, bassin sain`, cc.ok, cc.issues.slice(0, 3).join(' | '));
  // les clauses d'expressivité d'animkit suivent la FAMILLE (comme dans verify-animkit) : pichenette
  // sans fouet, pivot sans séquence, la talonnade a ses propres clauses (bassin carré, tête haute)
  if (!K.feint && !K.backheel) { const cs = checkStrike(r, K.flick ? { proximoDistal: false, flick: true } : K.pivot ? { proximoDistal: false } : {}); ok(`  checkStrike (animkit) : bassin, tronc, tête, bras d'équilibre, appui${K.flick || K.pivot ? '' : ', fouet'}`, cs.ok, cs.issues.join(' | ')); }
  stanceTable[k] = strikePortrait(spec, P).stance;
}

// ---------- 4. le style
console.log('\n— le style : un détail par joueur, jamais un autre geste —');
{
  let bad = 0, n = 0, worstV = [Infinity, -Infinity];
  for (let seed = 1; seed <= 40; seed++) {
    const st = styleFromSeed(seed);
    for (const [k, [a, b]] of Object.entries(STYLE_RANGES)) if (!(st[k] >= a && st[k] <= b)) bad++;
    for (const kind of GENERATED_KINDS) {
      const spec = GENERATORS[kind].generate(P, { style: st });
      const c = GENERATORS[kind].check(spec, P, {});
      const cc = checkClip(resolveTracks(spec));
      n++; if (!c.ok || !cc.ok) { bad++; if (bad <= 6) console.log(`   graine ${seed} × ${kind} : ${[...c.issues, ...cc.issues].join(' | ')}`); }
      if (KINDS[kind] && !KINDS[kind].feint) { worstV[0] = Math.min(worstV[0], c.portrait.vContact / KINDS[kind].vFoot); worstV[1] = Math.max(worstV[1], c.portrait.vContact / KINDS[kind].vFoot); }
    }
  }
  ok(`40 graines × ${GENERATED_KINDS.length} espèces = ${n} gestes sous contrat ET sous checkClip (${bad} refus)`, bad === 0);
  ok(`la vitesse visée tient sous tous les styles (${(100 * worstV[0]).toFixed(0)} % à ${(100 * worstV[1]).toFixed(0)} % de vFoot — ±25 %, la technique est une note)`, worstV[0] >= 0.75 && worstV[1] <= 1.3);
  ok('même graine → même geste (déterminisme)', JSON.stringify(generateStrike('frappe', P, { style: styleFromSeed(9) })) === JSON.stringify(generateStrike('frappe', P, { style: styleFromSeed(9) })));
  const a = generateStrike('frappe', P, { style: styleFromSeed(9) }), b = generateStrike('frappe', P, { style: styleFromSeed(10) });
  let diff = 0; for (let i = 0; i < a.keys.length; i++) for (const bone of Object.keys(a.keys[i].pose)) diff = Math.max(diff, quatAngle(eulerToQuat(a.keys[i].pose[bone]), eulerToQuat(b.keys[i].pose[bone])) * R2D);
  ok(`deux graines ne sont pas des clones (pire écart d'os ${diff.toFixed(0)}° ≥ 5) mais restent le même geste (≤ 40°)`, diff >= 5 && diff <= 40);
}

// ---------- 4b. les contrôles : le pied va au ballon et cède, le corps reçoit
console.log('\n— les contrôles, par espèce et par pied —');
for (const k of Object.keys(CONTROL_KINDS)) {
  const K = CONTROL_KINDS[k];
  const spec = generateControl(k, P);
  ok(`« ${k} » : ${spec.keys.length} clés, durée ${spec.duration} s et contact ${spec.contact} s inchangés`, spec.duration === K.duration && spec.contact === K.contact);
  for (const [foot, sp] of K.chest ? [['droit', spec]] : [['droit', spec], ['gauche', mirrorMove(spec)]]) {
    const c = checkControlGen(sp, P, k, { foot: foot === 'droit' ? 'right' : 'left' });
    const p = c.portrait;
    const what = K.chest ? `poitrine offerte (tête ${(p.headBack * 100).toFixed(0)} cm derrière le bassin), genoux ${(p.dipC * 100).toFixed(0)} cm`
      : K.thigh ? `cuisse au ballon (genou à ${(p.kneeH * 100).toFixed(0)} cm), cambré ${(p.headBack * 100).toFixed(0)} cm`
      : K.lunge ? `fente : pied à ${(p.excC * 100).toFixed(0)} cm devant, bassin ${(p.dipC * 100).toFixed(0)} cm / +${(p.fwdC * 100).toFixed(0)} cm`
      : `pied au ballon à ${(p.excC * 100).toFixed(0)} cm (≥ ${(K.excursion * 100).toFixed(0)}), cheville à ${(p.hC * 100).toFixed(0)} cm, retour à ${(p.endExc * 100).toFixed(0)} cm`;
    ok(`  pied ${foot} : ${what} — appui planté, mains sous le cou, retour`, c.ok, c.issues.join(' | '));
  }
  const cc = checkClip(resolveTracks(spec));
  ok('  checkClip (animkit)', cc.ok, cc.issues.slice(0, 3).join(' | '));
}

// ---------- 4c. les têtes : un saut est une balistique, un coup de tête est un fouetté
console.log('\n— les têtes —');
for (const k of Object.keys(AERIAL_KINDS)) {
  const spec = generateAerial(k, P);
  const c = checkAerialGen(spec, P, k), p = c.portrait;
  ok(`« ${k} » : ${AERIAL_KINDS[k].upperOnly ? 'haut du corps seul, ' : `bassin +${(p.apex * 100).toFixed(0)} cm à l'apex, impulsion ${(p.crouch * 100).toFixed(0)} cm / genou ${p.kneeAtCrouch.toFixed(0)}°, `}tête ${p.headBackMin.toFixed(0)}° → ${p.headC.toFixed(0)}° au contact`, c.ok, c.issues.join(' | '));
  const cc = checkClip(resolveTracks(spec));
  ok('  checkClip (animkit)', cc.ok, cc.issues.slice(0, 3).join(' | '));
}

// ---------- 4d. les gestes techniques : un chemin du pied autour d'un ballon qui ne part pas
console.log('\n— les gestes techniques —');
for (const k of Object.keys(SKILL_KINDS)) {
  if (/^passementJambes[3-6]$/.test(k)) continue;   // les tours 3-6 sont le même cercle (le sweep les couvre)
  const K = SKILL_KINDS[k];
  const spec = generateSkill(k, P);
  const c = checkSkillGen(spec, P, k), p = c.portrait;
  const what = K.sole ? `semelle à ${(p.hC * 100).toFixed(0)} cm du sol, ${(p.distBallC * 100).toFixed(0)} cm du ballon${K.dragTo != null ? `, tirée jusqu'à z=${p.backMost.toFixed(2)}` : ''}${K.hold ? `, tenue à ${(p.holdDrift * 100).toFixed(1)} cm` : ''}`
    : K.circle ? `pied à ${(p.peakH * 100).toFixed(0)} cm par-dessus, balayage ${((p.xMax - p.xMin) * 100).toFixed(0)} cm, jamais à moins de ${(p.minBall * 100).toFixed(0)} cm du ballon, buste ${p.leanMax.toFixed(0)}°`
    : K.cut ? `intérieur au ballon à ${p.vFootC.toFixed(1)} m/s, croise jusqu'à x=${p.xMin.toFixed(2)}, bassin ${(p.dipMin * 100).toFixed(0)} cm${K.sway ? `, épaules ${p.swayYawMax.toFixed(0)}° à droite avant la coupe` : ''}`
    : K.croqueta ? `pied droit balaie ${(p.sweepL * 100).toFixed(0)} cm à gauche, pied gauche pousse ${(p.pushL * 100).toFixed(0)} cm devant, appuis ${(p.supA * 100).toFixed(1)}/${(p.supB * 100).toFixed(1)} cm`
    : `genou ${p.kneeAt(K.arm).toFixed(0)}° armé → ${p.kneeAt(spec.contact).toFixed(0)}° au contact, pied ${p.vFootC.toFixed(1)} m/s, sans clé de bras`;
  ok(`« ${k} » : ${what}`, c.ok, c.issues.slice(0, 3).join(' | '));
  const cc = checkClip(resolveTracks(spec));
  ok('  checkClip (animkit)', cc.ok, cc.issues.slice(0, 3).join(' | '));
}
{
  // le double passement répète le simple os pour os (la clause de verify-gestes, re-prouvée ici)
  const p1 = generateSkill('passementJambes', P), p2 = generateSkill('passementJambes2', P);
  const k015 = p1.keys.find((k) => Math.abs(k.t - 0.15) < 1e-6), k045 = p2.keys.find((k) => Math.abs(k.t - 0.45) < 1e-6);
  ok('le double passement répète le cercle os pour os (clé 0,45 du double = clé 0,15 du simple)', !!k015 && !!k045 && JSON.stringify(k045.pose) === JSON.stringify(k015.pose) && JSON.stringify(k045.hips) === JSON.stringify(k015.hips));
  // SABOTAGES : le râteau authoré d'hier sous le contrat de la semelle ; un passement qui touche le ballon
  const old = checkSkillGen(AUTHORED.rateau, P, 'rateau');
  ok(`sabotage « le râteau authoré » refusé (${old.issues.length} clauses : ${old.issues.slice(0, 2).join(' | ')})`, !old.ok);
  const low = JSON.parse(JSON.stringify(generateSkill('passementJambes', P)));
  for (const k of low.keys) if (k.hips) k.hips = [k.hips[0], k.hips[1] - 0.12, k.hips[2]];   // le corps descend de 12 cm : la jambe frôle le ballon
  const lowC = checkSkillGen(low, P, 'passementJambes');
  ok(`sabotage « le passement qui touche le ballon » refusé (${lowC.issues.slice(0, 2).join(' | ')})`, !lowC.ok);
}

// ---------- 4e. le sol : le tacle glissé — le corps se couche sur la hanche, la jambe s'allonge au ballon
console.log('\n— le sol —');
for (const k of Object.keys(GROUND_KINDS)) {
  const spec = generateGround(k, P);
  const c = checkGroundGen(spec, P, k), p = c.portrait;
  ok(`« ${k} » : pied à ${(p.footAheadC * 100).toFixed(0)} cm devant au contact (${(p.footHC * 100).toFixed(0)} cm du sol), bassin à ${(p.pelvisL * 100).toFixed(0)} cm couché, épaules roulées à ${p.rollL.toFixed(0)}°, main gauche à ${(p.handMin * 100).toFixed(0)} cm du sol, relevé debout (bassin ${(p.pelvisE * 100).toFixed(0)} cm)`, c.ok, c.issues.slice(0, 3).join(' | '));
  const cc = checkClip(resolveTracks(spec));
  ok('  checkClip (animkit)', cc.ok, cc.issues.slice(0, 3).join(' | '));
  // sabotage : le tacle authoré d'hier (bassin à −0,66 en une clé, jambes traversant la pelouse) sous le contrat du sol
  const old = checkGroundGen(AUTHORED[k], P, k);
  ok(`sabotage « le ${k} authoré » refusé (${old.issues.length} clauses : ${old.issues.slice(0, 2).join(' | ')})`, !old.ok);
}

// ---------- 4f. les mains du gardien : la détente, les gants au bout, le tapis, le relevé sur place
console.log('\n— le gardien —');
for (const k of Object.keys(KEEPER_KINDS)) {
  const K = KEEPER_KINDS[k];
  const spec = generateKeeper(k, P);
  const c = checkKeeperGen(spec, P, k), p = c.portrait;
  const what = K.dive ? `bassin ${p.hC[0].toFixed(2)} m de côté et ${(100 * p.hC[1]).toFixed(0)} cm de haut au contact, gants à ${p.handReach.toFixed(2)} m, épaules ${p.rollC.toFixed(0)}° ; tapis à ${(100 * p.pelvisLie).toFixed(0)} cm / ${p.rollLie.toFixed(0)}° ; relevé debout sur place (rise ${spec.rise})`
    : K.jump ? `bassin +${(100 * p.hC[1]).toFixed(0)} cm, mains ${(100 * p.handsAboveHead).toFixed(0)} cm au-dessus de la tête, retombée sur les appuis (${(100 * p.landed).toFixed(0)} cm)`
    : K.kick ? `pied à ${p.footOutC.toFixed(2)} m de côté, ${(100 * p.footHC).toFixed(0)} cm du sol, genou ${p.kneeC.toFixed(0)}°`
    : `tête ${(100 * p.headBackMax).toFixed(0)} cm derrière le bassin, mains ${(100 * p.handsFrontC).toFixed(0)} cm devant la poitrine, bassin ${(100 * p.dipMin).toFixed(0)} cm`;
  ok(`« ${k} » : ${what}`, c.ok, c.issues.slice(0, 3).join(' | '));
  const cc = checkClip(resolveTracks(spec));
  ok('  checkClip (animkit)', cc.ok, cc.issues.slice(0, 3).join(' | '));
}
{
  // le miroir d'un plongeon plonge de l'autre côté (root motion latéral inversé) et reste sain
  const m = mirrorMove(generateKeeper('plongeon', P));
  const kC = m.keys.find((k) => Math.abs(k.t - 0.55) < 1e-6);
  ok(`le miroir du plongeon part à GAUCHE (bassin x ${kC?.hips?.[0].toFixed(2)} au contact ≤ −1,2) et passe checkClip`, (kC?.hips?.[0] ?? 0) <= -1.2 && checkClip(resolveTracks(m)).ok);
  // SABOTAGES : le plongeon authoré d'hier sous le contrat des mains ; un plongeon bras le long du corps
  const old = checkKeeperGen(AUTHORED.plongeon, P, 'plongeon');
  ok(`sabotage « le plongeon authoré » refusé (${old.issues.length} clauses : ${old.issues.slice(0, 2).join(' | ')})`, !old.ok);
  const lazy = JSON.parse(JSON.stringify(generateKeeper('plongeon', P)));
  for (const k of lazy.keys) { delete k.pose.LeftArm; delete k.pose.RightArm; delete k.pose.LeftForeArm; delete k.pose.RightForeArm; }
  const lazyC = checkKeeperGen(lazy, P, 'plongeon');
  ok(`sabotage « le plongeon bras le long du corps » refusé (${lazyC.issues.slice(0, 1).join('')})`, !lazyC.ok);
}

// ---------- 5. les amplitudes bakées
console.log('\n— les amplitudes bakées —');
for (const k of Object.keys(KINDS)) {
  if (KINDS[k].feint) continue;
  const s = solveStrike(k, P);
  ok(`« ${k} » : amp bakée ${KINDS[k].amp ?? 1} ≈ résolue ${s.amp.toFixed(3)} (vitesse ${s.v.toFixed(1)} → ${KINDS[k].vFoot})`, Math.abs((KINDS[k].amp ?? 1) - s.amp) <= 0.03);
}

// ---------- 6. la stance dérivée
console.log('\n— la stance dérivée ↔ approach.STANCES_CLIP (la sim garde STANCES, sa géométrie) —');
for (const [k, st] of Object.entries(stanceTable)) {
  const tab = STANCES[k];
  if (!tab) { console.log(`   (${k} : pas de stance — geste porté)`); continue; }
  const sx = Math.cos(tab.bearing * Math.PI / 180) * tab.dist, sy = Math.sin(tab.bearing * Math.PI / 180) * tab.dist;
  const mx = Math.cos(st.bearing * Math.PI / 180) * st.dist, my = Math.sin(st.bearing * Math.PI / 180) * st.dist;
  const gap = Math.hypot(sx - mx, sy - my);
  ok(`« ${k} » : la table {${tab.dist}, ${tab.bearing}°} est celle du geste généré {${st.dist.toFixed(2)}, ${st.bearing.toFixed(0)}°} (écart ${(gap * 100).toFixed(0)} cm ≤ 8)`, gap <= 0.08);
}

// ---------- 7. le miroir
console.log('\n— le miroir —');
{
  const spec = generateStrike('frappe', P), m = mirrorMove(spec);
  const rr = resolveTracks(spec), rm = resolveTracks(m);
  const at = (r, t) => { const pose = {}; for (const [b, ks] of Object.entries(r.tracks)) { const k = ks.find((x) => Math.abs(x.t - t) < 1e-6); if (k) pose[b] = k.q; } return pose; };
  const w = fkPose(P, at(rr, spec.contact), spec.keys.find((k) => Math.abs(k.t - spec.contact) < 1e-6).hips);
  const wm = fkPose(P, at(rm, m.contact), m.keys.find((k) => Math.abs(k.t - m.contact) < 1e-6).hips);
  const worst = Math.max(Math.hypot(w.RightFoot.p[0] + wm.LeftFoot.p[0], w.RightFoot.p[1] - wm.LeftFoot.p[1], w.RightFoot.p[2] - wm.LeftFoot.p[2]), Math.hypot(w.LeftHand.p[0] + wm.RightHand.p[0], w.LeftHand.p[1] - wm.RightHand.p[1], w.LeftHand.p[2] - wm.RightHand.p[2]));
  ok(`la FK du geste gauche est le miroir de la FK du geste droit (pied et main à ${(worst * 100).toFixed(1)} cm ≤ 1)`, worst <= 0.01);
}

// ---------- 8. les sabotages
console.log('\n— les sabotages —');
{
  const old = AUTHORED.frappe;
  const c = checkStrikeGen(old, P, 'frappe');
  ok(`sabotage « la frappe authorée d'hier » refusée par le contrat (${c.issues.length} clauses : pied ${c.portrait.vContact.toFixed(1)} m/s)`, !c.ok && c.issues.length >= 1);
  const sky = generateStrike('frappe', P);
  for (const k of sky.keys) k.pose.LeftArm = [-59.5, -5.4, 3.6];
  ok('sabotage « main au ciel » attrapé', !checkStrikeGen(sky, P, 'frappe').ok);
  const slide = generateStrike('passe', P);
  for (const k of slide.keys) if (k.hips) k.hips = [k.hips[0] + 0.12 * Math.sin(k.t * 20), k.hips[1], k.hips[2]];
  ok('sabotage « l\'appui qui glisse » attrapé', checkStrikeGen(slide, P, 'passe').issues.some((i) => /appui/i.test(i)));
  const wild = { ...NEUTRAL_STYLE, backswing: 1.8, follow: 1.6 };
  const c2 = checkStrikeGen(generateStrike('frappe', P, { style: wild }), P, 'frappe');
  ok('sabotage « style hors bornes (armé ×1,8) » refusé par le contrat', !c2.ok, c2.issues.slice(0, 2).join(' | '));
  const slow = generateStrike('passe', P, { amp: 0.4 });
  ok('sabotage « armé étouffé (amp 0,4) » : la passe n\'atteint plus sa vitesse', !checkStrikeGen(slow, P, 'passe').ok);
  const statue = generateControl('controleInterieur', P);
  for (const k of statue.keys) for (const b of Object.keys(k.pose)) if (/Leg|Foot/.test(b)) k.pose[b] = [0, 0, 0];
  ok('sabotage « contrôle-statue (le pied ne va pas au ballon) » attrapé', checkControlGen(statue, P, 'controleInterieur').issues.some((i) => /ne va pas au ballon/.test(i)));
  const flat = generateAerial('tete', P);
  for (const k of flat.keys) k.hips = [0, 0, 0];
  ok('sabotage « tête sans saut (bassin à plat) » attrapé', checkAerialGen(flat, P, 'tete').issues.some((i) => /ne MONTE pas|ne PLIE pas/.test(i)));
  const fwdHeel = { ...generateStrike('passe', P), name: 'talonnade' };
  ok('sabotage « talonnade qui frappe DEVANT » attrapé par la direction', checkStrikeGen(fwdHeel, P, 'talonnade').issues.some((i) => /ARRIÈRE/.test(i)));
}

console.log('\n— la table des stances à recopier (approach.STANCES) —');
for (const [k, st] of Object.entries(stanceTable)) if (!KINDS[k].feint) console.log(`  ${k}: { dist: ${st.dist.toFixed(2)}, bearing: ${Math.round(st.bearing)} },`);
console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
