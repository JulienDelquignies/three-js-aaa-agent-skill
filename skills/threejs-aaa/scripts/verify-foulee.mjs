// verify-foulee.mjs — LA FOULÉE GÉNÉRÉE (engine/motion-gait.js, lot A7).
//
// Ce qu'on prouve : que la locomotion calculée est une locomotion — pied d'appui immobile au monde,
// vol qui dégage sans traverser, genou qui plie devant, bras opposés à leur jambe, tronc qui penche
// avec l'allure, cadence et chemin de pied accordés (v·T/2 par pas) — dans TOUS les régimes (marche,
// trot, course, sprint, arrière, pas chassés, diagonales) et pour 40 signatures de joueur ; que la
// fonction est pure ; que les cycles passent le contrat animkit (checkClip) ; et que chaque clause
// attrape son sabotage nommé (appui qui glisse, vol qui rase, genou à l'envers, bras en phase,
// chassés qui croisent, tronc raide, course arrière qui lève derrière).
//
// Lancer : node skills/threejs-aaa/scripts/verify-foulee.mjs

import { SHANON_PROFILE } from '../assets/starter/src/engine/motion-profile-shanon.js';
import { gaitPose, gaitParams, gaitPortrait, gaitCycleSpec, gaitCadenceFactor, gaitStyleFromSeed, gaitLegK, gaitLegFactor, LEG_REF, gaitBrakeCadence, checkGaitGen, NEUTRAL_GAIT_STYLE, GAIT_REGIMES } from '../assets/starter/src/engine/motion-gait.js';
import { checkClip, resolveTracks, quatAngle } from '../assets/starter/src/engine/animkit.js';
import { strideLaw } from '../assets/starter/src/engine/gait.js';
import { fkPose } from '../assets/starter/src/engine/motion-rig.js';
import { applyQuat } from '../assets/starter/src/engine/vecmath.js';
import { volRef, chevilleRef } from '../assets/starter/src/engine/foulee-rbds.js';

let pass = 0, fail = 0;
const ok = (cond, label) => { if (cond) { pass++; console.log(`✓ ${label}`); } else { fail++; console.log(`✗ ${label}`); } };
const P = SHANON_PROFILE;
const cm = (m) => (m * 100).toFixed(1);

// ---- 1. les régimes, style neutre : le contrat complet
const REGIMES = [
  ['marche lente', 0.6, 0], ['marche', 1.4, 0], ['transition', 2.2, 0], ['trot', 2.8, 0], ['course', 4.5, 0], ['course rapide', 6, 0], ['sprint', 8, 0],
  ['arrière', -2.5, 0], ['arrière rapide', -3.5, 0], ['chassés droite', 0, 2], ['chassés gauche', 0, -1.5], ['diagonale avant', 2, 2], ['diagonale arrière', -2, 2],
];
const portraits = {};
for (const [name, vF, vR] of REGIMES) {
  const r = checkGaitGen(P, { vF, vR });
  const pr = gaitPortrait(P, { vF, vR, n: 60 });
  portraits[name] = pr;
  const m = pr.frames[0].meta;
  const kneeMax = Math.max(...pr.frames.map((f) => f.L.kneeAngle)), hipMax = Math.max(...pr.frames.map((f) => f.L.hipFlex)), hipMin = Math.min(...pr.frames.map((f) => f.L.hipFlex));
  ok(r.ok, `${name} (${vF}, ${vR} m/s) — contrat : appui ${(m.s * 100).toFixed(0)} %, cycle ${m.T.toFixed(2)} s, bassin −${cm(m.drop)} cm, tronc ${r.portrait.leanMean.toFixed(1)}°, genou ≤ ${kneeMax.toFixed(0)}°, hanche [${hipMin.toFixed(0)}, ${hipMax.toFixed(0)}]°${r.ok ? '' : ' — ' + r.issues.join(' ; ')}`);
}

// ---- 2. quarante signatures × six régimes : toutes sous contrat, et VARIÉES
{
  let bad = 0; const elbows = [], turnouts = [], leans = [];
  for (let s = 1; s <= 40; s++) {
    const st = gaitStyleFromSeed(s); elbows.push(st.elbow); turnouts.push(st.turnout); leans.push(st.lean);
    for (const [vF, vR] of [[1.4, 0], [2.8, 0], [4.5, 0], [8, 0], [-3, 0], [0, 2]]) { const r = checkGaitGen(P, { vF, vR, style: st }); if (!r.ok) { bad++; if (bad <= 3) console.log(`   graine ${s} (${vF}, ${vR}) : ${r.issues.join(' ; ')}`); } }
  }
  const span = (a) => Math.max(...a) - Math.min(...a);
  ok(bad === 0, `40 signatures × 6 régimes = 240 foulées sous contrat (${bad} rouges)`);
  ok(span(elbows) >= 15 && span(turnouts) >= 6 && span(leans) >= 0.3, `les signatures se distinguent : coude sur ${span(elbows).toFixed(0)}°, ouverture des pieds sur ${span(turnouts).toFixed(0)}°, inclinaison ×${span(leans).toFixed(2)}`);
  const a = gaitPose(P, 0.3, 4.5, 0, gaitStyleFromSeed(3)), b = gaitPose(P, 0.3, 4.5, 0, gaitStyleFromSeed(29));
  let diff = 0; for (const k in a.q) diff = Math.max(diff, quatAngle(a.q[k], b.q[k]) * 180 / Math.PI);
  ok(diff > 3, `deux joueurs ne courent pas pareil : ${diff.toFixed(1)}° d'écart max entre deux signatures à la même phase`);
}

// ---- 3. pure, et le cycle se ferme
{
  const a = JSON.stringify(gaitPose(P, 0.37, 4, 0.5)), b = JSON.stringify(gaitPose(P, 0.37, 4, 0.5));
  ok(a === b, 'gaitPose est pure (deux appels identiques, même sortie)');
  const g0 = gaitPose(P, 0, 5, 0), g1 = gaitPose(P, 0.999999, 5, 0);
  let worst = 0; for (const k in g0.q) worst = Math.max(worst, quatAngle(g0.q[k], g1.q[k]) * 180 / Math.PI);
  ok(worst < 0.5, `le cycle se ferme : ${worst.toFixed(2)}° d'écart max entre φ = 0 et φ = 1`);
}

// ---- 4. les cycles passent le contrat animkit (checkClip : membres ≤ 30 rad/s, bassin borné)
for (const [name, vF, vR] of [['marche', 1.4, 0], ['course', 4.5, 0], ['sprint', 8, 0], ['arrière', -3, 0], ['chassés', 0, 2]]) {
  const spec = gaitCycleSpec(P, { vF, vR });
  const c = checkClip(resolveTracks(spec));
  ok(c.ok, `cycle ${name} en spec animkit (${spec.keys.length} clés, ${spec.duration.toFixed(2)} s) : checkClip${c.ok ? '' : ' — ' + c.issues.join(' ; ')}`);
}

// ---- 5. les lois entre régimes : ce qui doit croître avec l'allure
{
  const p = (v) => gaitParams(v, 0);
  ok(p(1.4).s > p(2.8).s && p(2.8).s > p(5.5).s && p(5.5).s > p(8.5).s, `l'appui raccourcit avec l'allure : ${[1.4, 2.8, 5.5, 8.5].map((v) => (p(v).s * 100).toFixed(0) + ' %').join(' → ')}`);
  ok(p(1.4).s > 0.5 && p(2.8).s < 0.5, 'la marche a un double appui (> 50 %), le trot a un vol (< 50 %)');
  const lift = (v) => Math.max(...portraitOf(v).frames.map((f) => f.L.ankle[1])) - P.bones.LeftFoot.bindP[1];
  ok(lift(1.4) < lift(4.5) && lift(4.5) < lift(8), `le talon monte avec l'allure : ${cm(lift(1.4))} → ${cm(lift(4.5))} → ${cm(lift(8))} cm`);
  const lean = (v) => checkGaitGen(P, { vF: v, vR: 0 }).portrait.leanMean;
  ok(lean(1.4) < lean(4.5) && lean(4.5) < lean(8) && lean(8) >= 6, `le tronc penche avec l'allure : ${lean(1.4).toFixed(1)} → ${lean(4.5).toFixed(1)} → ${lean(8).toFixed(1)}°`);
  const armAmp = (v) => { const fr = portraitOf(v).frames; return Math.max(...fr.map((f) => f.L.hand[2])) - Math.min(...fr.map((f) => f.L.hand[2])); };
  ok(armAmp(1.4) < armAmp(4.5) && armAmp(4.5) < armAmp(8), `le balancier des bras grandit : ${cm(armAmp(1.4))} → ${cm(armAmp(4.5))} → ${cm(armAmp(8))} cm de course de la main`);
  ok(p(4.5).elbow > p(1.4).elbow + 30, `le coude se ferme en course : ${p(1.4).elbow.toFixed(0)}° en marche, ${p(4.5).elbow.toFixed(0)}° en course`);
}
function portraitOf(v) { return gaitPortrait(P, { vF: v, vR: 0, n: 60 }); }

// ---- 6. le verrou des pieds trouvera son appui : bas (≤ 5 cm) ET lent (≤ 0,06 m/s) sur l'appui fixe
{
  let worst = { h: 0, v: 0 };
  for (const [vF, vR] of [[1.4, 0], [4.5, 0], [8, 0], [-3, 0], [0, 2]]) {
    const pr = gaitPortrait(P, { vF, vR, n: 120 });
    for (const f of pr.frames) for (const side of ['L', 'R']) if (f[side].phase === 'stance') worst.h = Math.max(worst.h, f[side].ankle[1] - P.bones.LeftFoot.bindP[1]);
  }
  ok(worst.h <= 0.05, `sur l'appui fixe la cheville reste dans la bande de contact du verrou (≤ 5 cm : ${cm(worst.h)} cm au pire)`);
}

// ---- 7. la cadence suit la direction, continûment
{
  ok(Math.abs(gaitCadenceFactor(4, 0) - 1) < 1e-9 && Math.abs(gaitCadenceFactor(-3, 0) - 1.3) < 1e-9 && Math.abs(gaitCadenceFactor(0, 2) - 1.9) < 1e-9, 'cadence ×1 en avant, ×1,3 à reculons, ×1,9 de côté');
  let jump = 0; for (let a = 0; a < 360; a += 2) { const k1 = gaitCadenceFactor(Math.cos(a * Math.PI / 180) * 3, Math.sin(a * Math.PI / 180) * 3), k2 = gaitCadenceFactor(Math.cos((a + 2) * Math.PI / 180) * 3, Math.sin((a + 2) * Math.PI / 180) * 3); jump = Math.max(jump, Math.abs(k2 - k1)); }
  ok(jump < 0.05, `le facteur de cadence est continu en direction (saut max ${jump.toFixed(3)} par 2°)`);
  const T = gaitParams(0, 2).T;
  ok(Math.abs(T - 1 / (strideLaw(2) * 1.9)) < 1e-9, `la durée du cycle des chassés vaut 1/(f(v)·1,9) = ${T.toFixed(3)} s — une phase, une durée`);
}

// ---- 8. à l'arrêt, la pose tend vers la station debout (le fondu vers l'idle part de près)
{
  const g = gaitPose(P, 0.3, 0.1, 0);
  const fk = fkPose(P, g.q, g.hips);
  const dL = Math.hypot(fk.LeftFoot.p[0] - P.bones.LeftFoot.bindP[0], fk.LeftFoot.p[2] - P.bones.LeftFoot.bindP[2]);
  ok(dL < 0.12 && g.meta.drop < 0.03, `à 0,1 m/s : pied à ${cm(dL)} cm de sa place debout, bassin −${cm(g.meta.drop)} cm`);
}

// ---- 9. régimes particuliers : la course arrière et les pas chassés ont leur corps
{
  const back = gaitPortrait(P, { vF: -3, vR: 0, n: 60 });
  const land = back.frames[0].L.ankle;
  let hi = back.frames[0].L; for (const f of back.frames) if (f.L.ankle[1] > hi.ankle[1]) hi = f.L;
  ok(land[2] > 0.1 && hi.ankle[2] < 0, `course arrière : le pied se pose ${cm(land[2])} cm DERRIÈRE le bassin, le vol culmine ${cm(-hi.ankle[2])} cm devant (genou levé)`);
  const lat = gaitPortrait(P, { vF: 0, vR: 2, n: 60 });
  const widthMin = Math.min(...lat.frames.map((f) => f.R.ankle[0] - f.L.ankle[0]));
  const handOut = Math.min(...lat.frames.map((f) => Math.abs(f.R.hand[0] - f.R.hip[0])));
  ok(widthMin > 0.05 && lat.frames[0].meta.drop >= 0.08 && handOut > 0.2, `pas chassés : jamais de croisement (écart min ${cm(widthMin)} cm), bassin −${cm(lat.frames[0].meta.drop)} cm, mains ouvertes (${cm(handOut)} cm de la hanche)`);
  const gk = checkGaitGen(P, { vF: 0.3, vR: 1.6 });
  ok(gk.ok, `le gardien qui se déplace de côté face au ballon (0,3 ; 1,6) : sous contrat${gk.ok ? '' : ' — ' + gk.issues.join(' ; ')}`);
}

// ---- 10. les sabotages nommés : chaque clause attrape le sien
const sab = (label, args, want) => {
  const r = checkGaitGen(P, args);
  const hit = !r.ok && r.issues.some((i) => want.test(i));
  ok(hit, `sabotage « ${label} » attrapé${hit ? ` (${r.issues.find((i) => want.test(i)).slice(0, 90)})` : r.ok ? ' — PASSÉ SOUS LE CONTRAT' : ` — autre motif : ${r.issues.join(' ; ').slice(0, 120)}`}`);
};
sab('appui qui glisse (slip 0,35)', { vF: 4.5, vR: 0, opts: { override: { slip: 0.35 } } }, /GLISSE/);
sab('vol qui rase (swingH 0, chemin cartésien)', { vF: 4.5, vR: 0, opts: { override: { swingH: 0, wRun: 0 } } }, /rase la pelouse/);   // (le vol ARTICULAIRE de la course n'a pas de swingH : le sabotage force le chemin d'hier)
sab('genou à l\'envers (pole arrière)', { vF: 4.5, vR: 0, opts: { override: { pole: [0, 0, 1] } } }, /genou plie à l'envers/);
sab('bras en phase (armPhase π)', { vF: 4.5, vR: 0, opts: { override: { armPhase: Math.PI } } }, /main gauche|main droite/);
sab('chassés qui croisent (hw 0,04)', { vF: 0, vR: 2, opts: { override: { hw: 0.04 } } }, /croisent/);
sab('tronc raide en course (lean 0, bassin droit)', { vF: 5, vR: 0, opts: { override: { lean: 0, pTilt: 0 } } }, /ne penche pas/);
sab('course arrière qui lève derrière (swingPeak 0,95)', { vF: -3, vR: 0, opts: { override: { swingPeak: 0.95 } } }, /ne monte pas devant/);
sab('pas trop long (bias −0,45)', { vF: 4.5, vR: 0, opts: { override: { bias: -0.45 } } }, /hors de portée|hanche hors|GLISSE|pas de/);

console.log('\n— A12b : la réception en mouvement — les bras en équilibre du receveur (opts.receveur) —');
{
  const mesure = (opts) => {
    let spread = 0, zMin = Infinity, zMax = -Infinity, n = 0;
    for (let i = 0; i < 60; i++) {
      const g = gaitPose(P, i / 60, 2, 0, NEUTRAL_GAIT_STYLE, opts);
      const fk = fkPose(P, g.q, g.hips);
      spread += fk.RightHand.p[0] - fk.LeftHand.p[0]; n++;
      zMin = Math.min(zMin, fk.RightHand.p[2]); zMax = Math.max(zMax, fk.RightHand.p[2]);
    }
    return { spread: spread / n, swing: zMax - zMin };
  };
  const d = mesure({}), r = mesure({ receveur: true });
  ok(r.spread >= d.spread + 0.02 && r.swing <= d.swing * 0.75 + 1e-6,
    `à 2 m/s le receveur garde les bras CALMES (écart des mains ${(r.spread * 100).toFixed(0)} cm c. ${(d.spread * 100).toFixed(0)} sans, ≥ +2 — plus d'écart uniforme, retour utilisateur) et calme le balancier (course de la main ${(r.swing * 100).toFixed(0)} cm c. ${(d.swing * 100).toFixed(0)}, ≤ 75 %)`);
  const bas = mesure({ receveur: { elev: 2 + 8 * 0.15, elbow: 4 + 10 * 0.15, swing: 0.8 - 0.3 * 0.15 } }), haut = mesure({ receveur: { elev: 2 + 8 * 0.9, elbow: 4 + 10 * 0.9, swing: 0.8 - 0.3 * 0.9 } });
  ok(haut.spread >= bas.spread + 0.04 && bas.spread <= d.spread + 0.04, `le PORT DE BRAS de la persona fait la différence : bras 0,15 → écart ${(bas.spread * 100).toFixed(0)} cm (≤ sans + 3), bras 0,9 → ${(haut.spread * 100).toFixed(0)} cm (≥ bas + 4)`);
  let cg; try { cg = checkGaitGen(P, { vF: 2, vR: 0, opts: { receveur: true } }); } catch (e) { cg = { ok: false, issues: [String(e)] }; }
  ok(cg.ok, `…et la foulée du receveur reste sous le contrat (checkGaitGen à 2 m/s)${cg.ok ? '' : ' — ' + cg.issues.join(' ; ').slice(0, 160)}`);
  const same = JSON.stringify(gaitPose(P, 0.3, 2, 0, NEUTRAL_GAIT_STYLE, {}).q) === JSON.stringify(gaitPose(P, 0.3, 2, 0, NEUTRAL_GAIT_STYLE, { receveur: undefined }).q);
  ok(same, 'sans le drapeau, la foulée d\'hier au bit (receveur undefined = aucune option)');
}

console.log('\n— A12d : le recul-frein — le défenseur qui jockeye est bas et ouvert (opts.jockey) —');
{
  const mesure = (opts) => {
    let spread = 0, pelvis = 0, n = 0;
    for (let i = 0; i < 60; i++) { const g = gaitPose(P, i / 60, -1.5, 0.6, NEUTRAL_GAIT_STYLE, opts); const fk = fkPose(P, g.q, g.hips); spread += fk.RightHand.p[0] - fk.LeftHand.p[0]; pelvis += fk.Hips.p[1]; n++; }
    return { spread: spread / n, pelvis: pelvis / n };
  };
  const d = mesure({}), j = mesure({ jockey: true });
  ok(j.pelvis <= d.pelvis - 0.03 && j.spread >= d.spread + 0.05, `en recul chassé (−1,5 m/s, 0,6 latéral) le jockey est plus BAS (bassin ${(j.pelvis * 100).toFixed(0)} c. ${(d.pelvis * 100).toFixed(0)} cm, ≥ −3) et plus OUVERT (mains ${(j.spread * 100).toFixed(0)} c. ${(d.spread * 100).toFixed(0)} cm, ≥ +5)`);
  let cg; try { cg = checkGaitGen(P, { vF: -1.5, vR: 0.6, opts: { jockey: true } }); } catch (e) { cg = { ok: false, issues: [String(e)] }; }
  ok(cg.ok, `…et sa foulée reste sous le contrat (checkGaitGen en recul chassé)${cg.ok ? '' : ' — ' + cg.issues.join(' ; ').slice(0, 160)}`);
  ok(JSON.stringify(gaitPose(P, 0.3, -1.5, 0.6, NEUTRAL_GAIT_STYLE, {}).q) === JSON.stringify(gaitPose(P, 0.3, -1.5, 0.6, NEUTRAL_GAIT_STYLE, { jockey: undefined }).q), 'sans le drapeau, le recul d\'hier au bit');
}

console.log('\n— A12e : la marche des rôles marchants — les mains sur les hanches (opts.mainsHanches) —');
{
  const mesure = (opts) => {
    let dy = 0, zMin = Infinity, zMax = -Infinity, ex = 0, n = 0;
    for (let i = 0; i < 60; i++) { const g = gaitPose(P, i / 60, 1.2, 0, NEUTRAL_GAIT_STYLE, opts); const fk = fkPose(P, g.q, g.hips); dy += Math.abs(fk.RightHand.p[1] - fk.Hips.p[1]); zMin = Math.min(zMin, fk.RightHand.p[2]); zMax = Math.max(zMax, fk.RightHand.p[2]); ex += fk.RightForeArm.p[0] - fk.RightHand.p[0]; n++; }
    return { dy: dy / n, swing: zMax - zMin, coudeDehors: ex / n };
  };
  const d = mesure({}), m = mesure({ mainsHanches: true });
  ok(m.dy <= 0.2 && m.swing <= 0.05 && m.coudeDehors > 0.03, `en marche (1,2 m/s) les mains restent sur les hanches : main à ${(m.dy * 100).toFixed(0)} cm du bassin (≤ 20), course ${(m.swing * 100).toFixed(1)} cm (≤ 5 ; sans : ${(d.swing * 100).toFixed(0)}), coude dehors ${(m.coudeDehors * 100).toFixed(0)} cm`);
  let cg; try { cg = checkGaitGen(P, { vF: 1.2, vR: 0, opts: { mainsHanches: true } }); } catch (e) { cg = { ok: false, issues: [String(e)] }; }
  ok(cg.ok, `…et la marche reste sous le contrat (checkGaitGen à 1,2 m/s)${cg.ok ? '' : ' — ' + cg.issues.join(' ; ').slice(0, 160)}`);
  ok(JSON.stringify(gaitPose(P, 0.3, 1.2, 0, NEUTRAL_GAIT_STYLE, {}).q) === JSON.stringify(gaitPose(P, 0.3, 1.2, 0, NEUTRAL_GAIT_STYLE, { mainsHanches: undefined }).q), 'sans le drapeau, la marche d\'hier au bit');
}

console.log('\n— A7 bis : la cadence à l\'échelle de la jambe (gaitLegK), le frein (opts.brake) et le virage (opts.turn) —');
{
  const legK = gaitLegK(P), L = P.lengths.thigh + P.lengths.shank;
  ok(legK > 1.1 && legK < 1.3 && Math.abs(legK - LEG_REF / L) < 1e-9 && LEG_REF === 0.864, `shanon : jambe ${cm(L)} cm → cadence ×${legK.toFixed(3)} (0,864 m / L : les sujets de Dorn, 176 cm × Winter 0,491 — hanche → cheville, la même mesure que le rig)`);
  ok(Math.abs(gaitLegK({ lengths: { thigh: 0.432, shank: 0.432 } }) - 1) < 1e-9 && gaitLegK({ lengths: { thigh: 0.2, shank: 0.2 } }) === 1.35, 'une jambe de 0,864 m tourne à la cadence de la loi (×1) ; borné à ×1,35');
  const hier = (v) => gaitPose(P, 0, v, 0, NEUTRAL_GAIT_STYLE, { legK: 1 }).meta, rig = (v) => gaitPose(P, 0, v, 0, NEUTRAL_GAIT_STYLE, {}).meta;
  ok(Math.abs(rig(4.5).T * legK - hier(4.5).T) < 1e-9 && Math.abs(hier(4.5).T - gaitParams(4.5, 0).T) < 1e-9, `à 4,5 m/s le cycle passe de ${hier(4.5).T.toFixed(3)} s (legK 1 = gaitParams d'hier) à ${rig(4.5).T.toFixed(3)} s (× 1/legK)`);
  // (2026-09-24) le bassin de course est MESURÉ (hancheRef) : la portée ne le rabaisse que là où un pied sortirait de portée — sans le facteur de
  // jambe (legK 1), les foulées de grand le feraient plonger ; on compare son point le plus bas
  const basMin = (v, o) => { let m = 9; for (let i = 0; i < 120; i++) m = Math.min(m, gaitPose(P, i / 120, v, 0, NEUTRAL_GAIT_STYLE, o).hips[1]); return m; };
  ok(basMin(4.5, {}) >= basMin(4.5, { legK: 1 }) + 0.03 && basMin(8, {}) >= basMin(8, { legK: 1 }) + 0.05 && Math.abs(rig(8).T * legK - hier(8).T) < 1e-9, `le bassin ne plonge pas pour atteindre des foulées de grand : au plus bas −${cm(-basMin(4.5, { legK: 1 }))} → −${cm(-basMin(4.5, {}))} cm à 4,5 m/s, −${cm(-basMin(8, { legK: 1 }))} → −${cm(-basMin(8, {}))} à 8 (le facteur de jambe ; cycle ${hier(8).T.toFixed(3)} → ${rig(8).T.toFixed(3)} s)`);
  ok(Math.abs(gaitLegFactor(legK, 4.5) - legK) < 1e-12 && Math.abs(gaitLegFactor(legK, 9.47) - legK) < 1e-12 && Math.abs(gaitLegFactor(legK, 10) - (1 + (legK - 1) * 0.5)) < 1e-12 && gaitLegFactor(legK, 10.5) === 1, `gaitLegFactor : plein jusqu'au sprinter mesuré (≤ 9,5 m/s — Dorn 2012 : la foulée rapportée à la jambe y tombe juste, 1,29 L contre 1,27 mesurés), à mi-chemin à 10, ×1 dès 10,5 — le même facteur pour la pose et pour l'horloge du contrôleur`);
  const spec = gaitCycleSpec(P, { vF: 4.5, vR: 0 });
  ok(Math.abs(spec.duration - rig(4.5).T) < 2e-4, `la spec animkit du cycle dure ce que dure la pose (${spec.duration.toFixed(4)} s) — une phase, une durée`);
  // le frein
  const mes = (opts, v = 4.5) => { let hw = 0, sh = 0, hx = 0, hd = 0, sp = 0, n = 0; for (let i = 0; i < 60; i++) { const g = gaitPose(P, i / 60, v, 0, NEUTRAL_GAIT_STYLE, opts); const fk = fkPose(P, g.q, g.hips); hw += fk.RightFoot.p[0] - fk.LeftFoot.p[0]; sh += fk.RightShoulder.p[1] - fk.LeftShoulder.p[1]; hx += fk.Hips.p[0]; hd += applyQuat([0, 1, 0], fk.Head.q)[0]; sp += Math.abs(applyQuat([0, 1, 0], fk.Spine2.q)[0]); n++; } const m = gaitPose(P, 0, v, 0, NEUTRAL_GAIT_STYLE, opts).meta; return { hw: hw / n, shoulderDy: sh / n, hipsX: hx / n, headRoll: Math.asin(Math.max(-1, Math.min(1, hd / n))) / D2R, chestRoll: Math.asin(Math.min(1, sp / n)) / D2R, lean: m.lean, T: m.T, pitchHS: m.params.pitchHS }; };
  const D2R = Math.PI / 180, d = mes({}), b = mes({ brake: 1 });
  ok(b.lean <= d.lean - 8 && b.lean < 0, `frein 1 à 4,5 m/s : le tronc se RETIENT en arrière (${b.lean.toFixed(1)}° c. ${d.lean.toFixed(1)} en course)`);
  ok(b.hw >= d.hw + 0.05 && b.pitchHS >= d.pitchHS + 8 && b.T <= d.T * 0.8 + 1e-9, `…la base s'élargit (${cm(b.hw)} c. ${cm(d.hw)} cm), le talon se pose d'abord (tangage ${b.pitchHS.toFixed(0)}° c. ${d.pitchHS.toFixed(0)}), les pas raccourcissent (cycle ${b.T.toFixed(3)} c. ${d.T.toFixed(3)} s)`);
  ok(Math.abs(gaitBrakeCadence(0) - 1) < 1e-12 && Math.abs(gaitBrakeCadence(1) - 4 / 3) < 1e-12 && Math.abs(d.T / gaitBrakeCadence(1) - b.T) < 1e-9, 'gaitBrakeCadence : ×1 sans frein, ×4/3 à plein frein — le facteur que le contrôleur donne à son horloge');
  let bad = [];
  for (const v of [3, 4.5, 6, 8]) for (const o of [{ brake: 1 }, { brake: 0.5 }]) { const r = checkGaitGen(P, { vF: v, vR: 0, opts: o }); if (!r.ok) bad.push(`${v} m/s frein ${o.brake} : ${r.issues.join(' ; ').slice(0, 80)}`); }
  ok(bad.length === 0, `le frein reste sous le contrat de 3 à 8 m/s (la jambe ne sature pas — l'appui de frein se raccourcit au sprint)${bad.length ? ' — ' + bad[0] : ''}`);
  // le virage
  const t = mes({ turn: 6 }), tl = mes({ turn: -6 });
  ok(t.shoulderDy <= -0.025 && t.hipsX >= 0.03 && t.chestRoll >= d.chestRoll + 10, `virage à droite (6 m/s²) : l'épaule droite descend (${cm(t.shoulderDy)} cm), le bassin glisse à droite (${cm(t.hipsX)} cm), le tronc roule ${t.chestRoll.toFixed(0)}° dans le virage (${d.chestRoll.toFixed(0)}° de roulis moyen en course)`);
  ok(Math.abs(t.headRoll - d.headRoll) <= 1 && Math.abs(tl.headRoll - d.headRoll) <= 1, `…et la tête reste d'aplomb (roulis moyen signé ${t.headRoll.toFixed(2)}° c. ${d.headRoll.toFixed(2)} en course, à 1° près — le contre-roulis cou + tête)`);
  ok(Math.abs(tl.shoulderDy + t.shoulderDy) < 1e-4 && Math.abs(tl.hipsX + t.hipsX) < 1e-4 && t.hw >= d.hw + 0.02, `le virage à gauche est le miroir ; la base s'élargit de ${cm(t.hw - d.hw)} cm (le pied extérieur se pose plus large)`);
  // (26/09) le départ : le corps se couche dans l'accélération, pas plus vifs, jamais avec le frein, et toujours sous le contrat
  { const dp = mes({ depart: 1 }), d0 = mes({ depart: 1, brake: 1 });
    ok(dp.lean >= d.lean + 10 && dp.T < d.T && d0.lean === b.lean, `départ 1 à 4,5 m/s : le buste se couche (${dp.lean.toFixed(1)}° c. ${d.lean.toFixed(1)}), les pas s'avivent (cycle ${dp.T.toFixed(3)} c. ${d.T.toFixed(3)} s) ; avec le frein, le frein seul`);
    ok(JSON.stringify(gaitPose(P, 0.3, 4, 0, NEUTRAL_GAIT_STYLE, {})) === JSON.stringify(gaitPose(P, 0.3, 4, 0, NEUTRAL_GAIT_STYLE, { depart: 0 })), 'départ 0 / absent : la foulée d\'hier au bit');
    const badD = []; for (const v of [1, 2.8, 4.5, 6, 8]) for (const o of [{ depart: 1 }, { depart: 0.5 }, { depart: 1, turn: 6 }]) { const r = checkGaitGen(P, { vF: v, vR: 0, opts: o }); if (!r.ok) badD.push(`${v} m/s ${JSON.stringify(o)} : ${r.issues.join(' ; ').slice(0, 90)}`); }
    ok(badD.length === 0, `le départ reste sous le contrat de 1 à 8 m/s${badD.length ? ' — ' + badD.join(' | ') : ''}`); }
  bad = [];
  for (const v of [2.8, 4.5, 6, 8]) for (const o of [{ turn: 6 }, { turn: -6 }, { turn: 9, brake: 1 }]) { const r = checkGaitGen(P, { vF: v, vR: 0, opts: o }); if (!r.ok) bad.push(`${v} m/s ${JSON.stringify(o)} : ${r.issues.join(' ; ').slice(0, 80)}`); }
  ok(bad.length === 0, `le virage, seul ou avec le frein, reste sous le contrat de 2,8 à 8 m/s (la hanche extérieure qui monte est dans le calcul d'affaissement)${bad.length ? ' — ' + bad[0] : ''}`);
  let rouges = 0;
  for (let s = 1; s <= 40; s++) { const st = gaitStyleFromSeed(s); for (const [vF, o] of [[4.5, { brake: 1 }], [7, { brake: 1 }], [4.5, { turn: 7 }], [7, { turn: -7 }], [8, { brake: 1, turn: 4 }]]) if (!checkGaitGen(P, { vF, vR: 0, style: st, opts: o }).ok) rouges++; }
  ok(rouges === 0, `40 signatures × 5 régimes de frein et de virage = 200 foulées sous contrat (${rouges} rouges)`);
  // (2026-09-24) LE GENOU EN VOL au frein et en virage : le pic ne dépasse pas celui de la ligne droite à la même vitesse (+2°), qui reste
  // sur les coureurs (+3° du pic des courbes réalignées, foulee-rbds). Le recalage cartésien du décollage (pied 18 cm derrière la hanche au
  // frein, 40 en ligne droite) le repliait à 132° au frein plein, 130 en virage à 9 m/s², 135 les deux, 120 en ligne droite (4,5 m/s ;
  // coureurs 116) — en jeu, p90 136° en course.
  { const genouVol = (v, o) => { let m = 0; for (const f of gaitPortrait(P, { vF: v, vR: 0, opts: { griffe: 1, ...o }, n: 240 }).frames) for (const sd of ['L', 'R']) if (f[sd].phase === 'swing') m = Math.max(m, f[sd].kneeAngle); return m; };
    const pic = (v) => { let m = 0; for (let i = 0; i <= 40; i++) m = Math.max(m, volRef(v, i / 40).genou); return m; };
    let pire = null; for (const v of [3, 4.5, 6]) { const d = genouVol(v, {}), r = pic(v); if (d > r + 3) pire ??= `${v} m/s en ligne droite : ${d.toFixed(0)}° pour ${r.toFixed(0)} chez les coureurs`;
      for (const o of [{ brake: 1 }, { turn: 9 }, { turn: -9 }, { brake: 1, turn: 9 }]) { const k = genouVol(v, o); if (k > d + 2) pire ??= `${v} m/s ${JSON.stringify(o)} : ${k.toFixed(0)}° c. ${d.toFixed(0)} en ligne droite`; } }
    ok(!pire, `le genou en vol, au frein et en virage serré, ne se replie pas plus qu'en ligne droite (qui suit le pic des coureurs : ${genouVol(4.5, {}).toFixed(0)}° à 4,5 m/s pour ${pic(4.5).toFixed(0)} ; frein plein + virage 9 m/s² : ${genouVol(4.5, { brake: 1, turn: 9 }).toFixed(0)}°)${pire ? ' — ' + pire : ''}`); }

  // (2026-09-24) LE SPRINT MESURÉ ET LE PIED ARTICULAIRE. Le vol du sprint suit le sprinter de Dorn 2012 (genou 146-148° à 7 et 9,5 m/s ;
  // 148,4 ± 5,6° chez 79 sprinteurs à 9,9 m/s, Miyashiro 2019) — la référence d'hier, extrapolée, s'arrêtait à 128°. Et le pied en vol SUIT
  // la jambe : la cheville (pied − jambe) reste dans la plage du sprinter (−35 … +20°) tout le vol ; tenu à plat au monde (le vol d'hier,
  // wRun 0), elle plie à l'extrême quand le talon monte à la fesse.
  { const cheville = (v, o = {}) => { let lo = 99, hi = -99; const pr = gaitPortrait(P, { vF: v, vR: 0, opts: { griffe: 1, ...o }, n: 120 }), s0 = pr.frames[0].meta.s;
      for (const f of pr.frames) { if (f.L.phase !== 'swing') continue; const w = (f.feet.Left.u - s0) / (1 - s0); if (w < 0.1 || w > 0.9) continue;
        const sh = Math.atan2(-(f.L.ankle[2] - f.L.knee[2]), -(f.L.ankle[1] - f.L.knee[1])) * 180 / Math.PI, a = f.feet.Left.pitch - sh; lo = Math.min(lo, a); hi = Math.max(hi, a); } return [lo, hi]; };
    const genouSprint = (v) => { let m = 0; for (const f of gaitPortrait(P, { vF: v, vR: 0, opts: { griffe: 1 }, n: 240 }).frames) if (f.L.phase === 'swing') m = Math.max(m, f.L.kneeAngle); return m; };
    const g95 = genouSprint(9.47), g7 = genouSprint(6.97), c95 = cheville(9.47), c45 = cheville(4.5), sab = cheville(9.47, { override: { wRun: 0 } });
    ok(g95 >= 140 && g95 <= 155 && g7 >= 138, `le sprint suit le sprinter mesuré : genou en vol ${g7.toFixed(0)}° à 7 m/s, ${g95.toFixed(0)}° à 9,47 (Dorn : 148 / 147 ; 79 sprinteurs : 148,4 ± 5,6)`);
    ok(c95[0] >= -40 && c95[1] <= 25 && c45[0] >= -40 && c45[1] <= 25 && (sab[0] < -60 || sab[1] > 60), `en vol le pied suit la jambe : cheville ${c45.map((x) => x.toFixed(0)).join(' … ')}° à 4,5 m/s, ${c95.map((x) => x.toFixed(0)).join(' … ')}° à 9,47 (sprinter −31 … +7) — sabotage « pied tenu à plat » attrapé (${sab.map((x) => x.toFixed(0)).join(' … ')}°)`); }
  const a = JSON.stringify(gaitPose(P, 0.3, 4.5, 0, NEUTRAL_GAIT_STYLE, {}));
  ok(a === JSON.stringify(gaitPose(P, 0.3, 4.5, 0, NEUTRAL_GAIT_STYLE, { brake: 0, turn: 0 })) && a === JSON.stringify(gaitPose(P, 0.3, 4.5, 0, NEUTRAL_GAIT_STYLE, { brake: undefined, turn: undefined, legK: undefined })), 'sans frein ni virage (0 ou absents), la foulée à la cadence de la jambe, au bit');
}

console.log('\n— A7 ter (§ 6) : le pas croisé du virage serré, le port des bras en course, le verrou de pieds calibré —');
{
  const D2R = Math.PI / 180;
  const lanes = (v, turn) => { const pr = gaitPortrait(P, { vF: v, vR: 0, opts: { turn }, n: 60 }); const g = gaitPose(P, 0, v, 0, NEUTRAL_GAIT_STYLE, { turn }); const fk = fkPose(P, g.q, g.hips);
    const yawHips = Math.atan2(fk.RightUpLeg.p[2] - fk.LeftUpLeg.p[2], fk.RightUpLeg.p[0] - fk.LeftUpLeg.p[0]) / D2R, yawSh = Math.atan2(fk.RightShoulder.p[2] - fk.LeftShoulder.p[2], fk.RightShoulder.p[0] - fk.LeftShoulder.p[0]) / D2R;
    let kneeSep = 9; for (const f of pr.frames) kneeSep = Math.min(kneeSep, Math.hypot(f.L.knee[0] - f.R.knee[0], f.L.knee[1] - f.R.knee[1], f.L.knee[2] - f.R.knee[2]));
    return { L0: pr.frames[0].L.ankle[0], R30: pr.frames[30].R.ankle[0], yawHips, yawSh, kneeSep }; };
  const d = lanes(6, 0), c = lanes(6, 9), cg = lanes(6, -9), m = lanes(6, 6), s2 = lanes(2.5, 9);
  ok(c.L0 - c.R30 >= 0.02 && c.L0 - c.R30 <= 0.06, `virage serré à droite (9 m/s², 6 m/s) : LE PAS CROISÉ — le pied gauche (extérieur) se pose ${cm(c.L0 - c.R30)} cm À L'INTÉRIEUR du couloir du droit (en course droite : ${cm(d.R30 - d.L0)} cm d'écart, jamais croisé) — borné à 6 cm`);
  ok(c.yawHips - d.yawHips >= 4 && Math.abs(c.yawSh - d.yawSh) <= 1.5 && c.kneeSep >= 0.06, `…le bassin TOURNE dans le virage (+${(c.yawHips - d.yawHips).toFixed(1)}° au contact gauche), les épaules restent dans l'axe de la course (${(c.yawSh - d.yawSh).toFixed(1)}° — le tronc contre-tourne), les genoux ne se traversent pas (${cm(c.kneeSep)} cm au plus près)`);
  ok(Math.abs((cg.L0 - cg.R30) - (c.L0 - c.R30)) < 1e-3 && Math.abs((cg.yawHips - d.yawHips) + (c.yawHips - d.yawHips)) < 0.5, `le virage serré à gauche est le miroir (le pied droit (extérieur) se pose ${cm(cg.L0 - cg.R30)} cm à l'intérieur du couloir du gauche, le bassin tourne de ${(cg.yawHips - d.yawHips).toFixed(1)}°)`);
  ok(m.R30 - m.L0 >= 0.10 && s2.R30 - s2.L0 >= 0.10, `sous 7 m/s² (6 m/s² : ${cm(m.R30 - m.L0)} cm d'écart) et sous 3 m/s (2,5 m/s à 9 m/s² : ${cm(s2.R30 - s2.L0)} cm) : aucun croisement — le pas croisé est une allure de course dans un virage SERRÉ (la base élargie d'A7 bis reste)`);
  let rouges = 0; for (let s = 1; s <= 40; s++) { const st = gaitStyleFromSeed(s); for (const [vF, o] of [[4.5, { turn: 9 }], [7, { turn: -9 }], [8, { brake: 1, turn: 9 }], [6, { turn: 8 }], [3.5, { turn: 9 }]]) if (!checkGaitGen(P, { vF, vR: 0, style: st, opts: o }).ok) rouges++; }
  ok(rouges === 0, `40 signatures × 5 virages serrés (dont le frein au sprint) = 200 foulées croisées sous contrat (${rouges} rouges)`);
  const chassesCroises = checkGaitGen(P, { vF: 0, vR: 2, opts: { turn: 9 } });   // les chassés ne croisent pas même « en virage » : le pas croisé exige vF > 3
  ok(chassesCroises.ok || !chassesCroises.issues.some((i) => /croisent/.test(i)), `les pas chassés (0, 2 m/s) ne croisent jamais, même sous 9 m/s² (le pas croisé exige une course > 3 m/s)`);
  // le port des bras en course
  const bras = (v, opts = {}) => { let hMax = -9, elMin = 999, elMax = -999; for (let i = 0; i < 60; i++) { const g = gaitPose(P, i / 60, v, 0, NEUTRAL_GAIT_STYLE, opts); const fk = fkPose(P, g.q, g.hips); hMax = Math.max(hMax, fk.LeftHand.p[1] - fk.Spine2.p[1]);
    const a = [fk.LeftArm.p[0] - fk.LeftForeArm.p[0], fk.LeftArm.p[1] - fk.LeftForeArm.p[1], fk.LeftArm.p[2] - fk.LeftForeArm.p[2]], b = [fk.LeftHand.p[0] - fk.LeftForeArm.p[0], fk.LeftHand.p[1] - fk.LeftForeArm.p[1], fk.LeftHand.p[2] - fk.LeftForeArm.p[2]];
    const el = 180 - Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (Math.hypot(...a) * Math.hypot(...b) || 1)))) / D2R; elMin = Math.min(elMin, el); elMax = Math.max(elMax, el); } return { hMax, elMin, elMax }; };
  const r45 = bras(4.5), r8 = bras(8), r28 = bras(2.8);
  // (2026-09-24) le régime run est ancré à 4,5 m/s (les coureurs mesurés) : 90° + elbowMod 14 + le style y sont purs (hier à 5,5 m/s ; 106 à 4,5 interpolé)
  ok(r45.hMax >= -0.03 && r45.elMin >= 88 && r45.elMax <= 110 && GAIT_REGIMES.run.elbow === 90, `en course (4,5 m/s) : la main avant monte à hauteur de poitrine (${cm(r45.hMax)} cm du sternum — hier −4), le coude fléchi entre ${r45.elMin.toFixed(0)} et ${r45.elMax.toFixed(0)}° (régime run : coude 90°, hier 85 ; armOff 10, hier 8)`);
  ok(r8.hMax >= 0 && r8.elMin >= 95 && r8.elMax <= 120 && r28.elMin >= 78, `au sprint (8 m/s) : la main avant au-dessus du sternum (+${cm(r8.hMax)} cm), le coude ${r8.elMin.toFixed(0)}-${r8.elMax.toFixed(0)}° (le régime sprint est celui d'hier : 92°) ; au trot ${r28.elMin.toFixed(0)}°`);
  const frein = gaitPose(P, 0, 4.5, 0, NEUTRAL_GAIT_STYLE, { brake: 1 }).meta.params, sans = gaitPose(P, 0, 4.5, 0, NEUTRAL_GAIT_STYLE, {}).meta.params;
  ok(Math.abs(frein.elbow - sans.elbow - 6) < 1e-9, `au frein le coude se ferme de +6° (hier +10 : avec le coude de course monté, la main avant repliée perdait l'opposition bras-jambe au sprint freiné — marges 2,2 → 1,8 cm sur 5 signatures, 2,5-3,1 aujourd'hui)`);
  const bas = bras(4.5, { override: { elbow: 60, armOff: 0 } });
  ok(bas.hMax < r45.hMax - 0.06, `sabotage « le bras bas » attrapé (coude 60°, armOff 0 : la main avant retombe à ${cm(bas.hMax)} cm du sternum, ${cm(r45.hMax - bas.hMax)} cm sous la course)`);
}

console.log('\n— § 8 : la boiterie (opts.boite — le fauché d\'une faute grave se ménage une jambe) —');
{
  const d = gaitPortrait(P, { vF: 3, vR: 0, n: 60 }), b = gaitPortrait(P, { vF: 3, vR: 0, opts: { boite: { side: 'left', k: 1 } }, n: 60 });
  const stance = (pr, side) => pr.frames.filter((f) => f[side].phase === 'stance').length;
  // (2026-09-24) relatif : l'appui réel est plus court (hier −4 images sur ~17)
  ok(stance(b, 'L') <= 0.8 * stance(d, 'L') && Math.abs(stance(b, 'R') - stance(d, 'R')) <= 2, `boite gauche à 3 m/s : l'appui gauche raccourcit (${stance(b, 'L')} images sur 60 c. ${stance(d, 'L')}), le droit tient (${stance(b, 'R')} c. ${stance(d, 'R')})`);
  const clear = (pr, side) => Math.max(...pr.frames.filter((f) => f[side].phase === 'swing').map((f) => f[side].ankle[1]));
  ok(clear(b, 'L') < clear(d, 'L') - 0.02, `…le vol gauche rase (cheville à ${cm(clear(b, 'L'))} c. ${cm(clear(d, 'L'))} cm au plus haut)`);
  const list = (pr) => { let mn = 9; for (const f of pr.frames) mn = Math.min(mn, f.L.hip[1] - f.R.hip[1]); return mn; };
  ok(list(b) < list(d) - 0.01, `…le bassin plonge du côté gauche quand il porte (la hanche gauche sous la droite de ${cm(-list(b))} cm au plus, c. ${cm(-list(d))})`);
  let bad = []; for (const v of [1.4, 2.8, 4.5]) for (const k of [0.5, 1]) { const r = checkGaitGen(P, { vF: v, vR: 0, opts: { boite: { side: 'right', k } } }); if (!r.ok) bad.push(`${v} m/s k ${k} : ${r.issues.join(' ; ').slice(0, 70)}`); }
  ok(bad.length === 0, `la boiterie reste sous le contrat (marche, trot, course × k 0,5 et 1 — l'appui immobile, le vol qui dégage, la symétrie dispensée)${bad.length ? ' — ' + bad[0] : ''}`);
  ok(JSON.stringify(gaitPose(P, 0.3, 3, 0, NEUTRAL_GAIT_STYLE, {})) === JSON.stringify(gaitPose(P, 0.3, 3, 0, NEUTRAL_GAIT_STYLE, { boite: { side: 'left', k: 0 } })), 'boite k 0 (guéri) : la foulée d\'hier au bit');
}

// ---- LE GRIFFÉ (opts.griffe — retour utilisateur « les pieds traînent ») : la cheville touche le sol et en repart
// PRESQUE À L'ARRÊT au monde. Sans lui (la foulée d'hier — le sabotage), elle se pose et décolle à la vitesse du corps
// (mesuré 1,4 → 8 m/s) en rasant la pelouse : le patin de chaque pas, invisible aux clauses d'appui (l'appui, lui, est fixe).
console.log('\n— le griffé : le pied se pose et décolle sans patiner —');
{
  const solVitesse = (vF, opts) => {
    const pr = gaitPortrait(P, { vF, vR: 0, n: 480, opts }), F = pr.frames, n = F.length, dt = pr.T / n;
    const wz = (i) => (i < n ? F[i].L.ankleW[2] : F[i - n].L.ankleW[2] - vF * pr.T), wv = (i) => Math.abs(wz(i + 1) - wz(i)) / dt;
    const iTD = F.findIndex((f, i) => f.L.phase === 'stance' && F[(i - 1 + n) % n].L.phase === 'swing');
    const iLO = F.findIndex((f, i) => f.L.phase === 'swing' && F[(i - 1 + n) % n].L.phase !== 'swing');
    const st = F.filter((f) => f.L.phase === 'stance').map((f) => f.L.ankleW[2]);
    return { pose: wv((iTD - 1 + n) % n), decolle: wv(iLO), appui: Math.max(...st) - Math.min(...st) };
  };
  // (2026-09-24) LE GRIFFÉ VIT EN MARCHE : la COURSE avant a son vol ARTICULAIRE (les courbes des coureurs mesurés, foulee-rbds) et le
  // pivot exact sur l'orteil — griffé ou non, la même foulée. Ses lois se jugent donc en marche ; celles de la course, sur les coureurs
  // de Fukuchi 2017 (RBDS, marqueurs et forces : foulee-sondes/pied-vitesse.py) — le talon se pose à ~0,43·v (p90 ~0,6-0,8·v), MT1
  // quitte le sol en 17-27 ms pour 1,5 cm (p90 20-33) ; le sabotage de chaque clause de course est le chemin cartésien d'hier.
  let pire = { pose: 0, decolle: 0, appui: 0 }, hier = Infinity;
  for (const v of [1.4, 1.8]) {
    const g = solVitesse(v, { griffe: 1 }), h = solVitesse(v, {});
    pire = { pose: Math.max(pire.pose, g.pose), decolle: Math.max(pire.decolle, g.decolle), appui: Math.max(pire.appui, g.appui) };
    hier = Math.min(hier, h.pose, h.decolle);
  }
  ok(pire.pose <= 0.5 && pire.decolle <= 0.5, `griffé (marche) : la cheville se pose à ≤ ${pire.pose.toFixed(2)} m/s et décolle à ≤ ${pire.decolle.toFixed(2)} m/s au monde (1,4 → 1,8 m/s ; plafond 0,5)`);
  ok(pire.appui < 0.005, `griffé : l'appui reste fixe au monde (${(100 * pire.appui).toFixed(2)} cm au pire)`);
  ok(hier >= 1.0, `sabotage — la marche d'hier (sans griffé) pose et décolle le pied à ≥ ${hier.toFixed(2)} m/s : la clause mord`);
  let run = { pose: 0, decolle: 0 }, runHier = Infinity;
  for (const v of [3, 4.5, 6]) { const s = solVitesse(v, {}); run = { pose: Math.max(run.pose, s.pose / v), decolle: Math.max(run.decolle, s.decolle / v) }; runHier = Math.min(runHier, solVitesse(v, { override: { wRun: 0 } }).pose / v); }
  ok(run.pose <= 0.8 && run.decolle <= 0.8, `course (3 → 6 m/s) : la cheville se pose à ≤ ${run.pose.toFixed(2)}·v et décolle à ≤ ${run.decolle.toFixed(2)}·v au monde (les coureurs : talon ~0,43·v, p90 ~0,6-0,8·v ; plafond 0,8·v)`);
  ok(runHier >= 0.95, `sabotage — la course d'hier (chemin cartésien) pose le pied à ≥ ${runHier.toFixed(2)}·v : la clause mord`);
  for (const [name, vF, vR] of [['marche', 1.4, 0], ['course', 4.5, 0], ['6,5 m/s', 6.5, 0], ['sprint', 8, 0], ['arrière', -3, 0], ['chassés', 0, 2]]) {
    const c = checkClip(resolveTracks(gaitCycleSpec(P, { vF, vR, opts: { griffe: 1 } })));
    ok(c.ok, `griffé ${name} : checkClip${c.ok ? '' : ' — ' + c.issues.join(' ; ')}`);
  }
  // …ET LE DÉROULÉ PIVOTE SUR L'ORTEIL : en marche sans griffé, la cheville avance du `roll` forfaitaire et l'orteil GLISSE ; en course,
  // le pivot exact est la géométrie de tous
  const orteilDeroule = (vF, opts) => {
    const pr = gaitPortrait(P, { vF, vR: 0, n: 480, opts }), F = pr.frames, dt = pr.T / F.length; let d = 0, vmax = 0;
    for (let i = 0; i < F.length - 1; i++) if (F[i].L.phase === 'peel' && F[i + 1].L.phase === 'peel') { const a = F[i], b = F[i + 1]; const s = Math.hypot(b.L.toe[0] - a.L.toe[0], (b.L.toe[2] - vF * b.t) - (a.L.toe[2] - vF * a.t)); d += s; vmax = Math.max(vmax, s / dt); }
    return { d, vmax };
  };
  let pd = { d: 0, vmax: 0 }, hd = Infinity, pr_ = 0;
  for (const v of [1.4, 1.8]) { const g = orteilDeroule(v, { griffe: 1 }), h = orteilDeroule(v, {}); pd = { d: Math.max(pd.d, g.d), vmax: Math.max(pd.vmax, g.vmax) }; hd = Math.min(hd, h.d); }
  for (const v of [3, 4.5, 6]) pr_ = Math.max(pr_, orteilDeroule(v, {}).d);
  ok(pd.d <= 0.05 && pd.vmax <= 1.5, `griffé (marche) : pendant le déroulé l'orteil reste planté (≤ ${(100 * pd.d).toFixed(1)} cm, pointe ${pd.vmax.toFixed(2)} m/s ; plafonds 5 cm, 1,5 m/s)`);
  ok(hd > 0.05, `sabotage — en marche sans griffé, l'orteil glisse de ≥ ${(100 * hd).toFixed(1)} cm par déroulé : la clause mord`);
  ok(pr_ <= 0.02, `course (3 → 6 m/s, sans griffé) : l'orteil reste planté pendant le déroulé (≤ ${(100 * pr_).toFixed(1)} cm — le pivot exact)`);
  // …ET LE PIED SE DÉCOLLE FRANCHEMENT en course : l'orteil rase la pelouse (< 1,5 cm à > 1 m/s) moins longtemps que les coureurs au p90
  const orteilRase = (vF, opts) => {
    const pr = gaitPortrait(P, { vF, vR: 0, n: 480, opts }), F = pr.frames, dt = pr.T / F.length, sol = Math.min(...F.map((f) => f.L.toe[1])); let t = 0;
    for (let i = 0; i < F.length - 1; i++) { const a = F[i], b = F[i + 1]; if (a.L.phase !== 'swing' || a.L.toe[1] - sol >= 0.015) continue; if (Math.hypot(b.L.toe[0] - a.L.toe[0], (b.L.toe[2] - vF * b.t) - (a.L.toe[2] - vF * a.t)) / dt > 1) t += dt; }
    return t;
  };
  let pr2 = 0, hr = Infinity;
  for (const v of [3, 4.5, 6]) { pr2 = Math.max(pr2, orteilRase(v, {})); hr = Math.min(hr, orteilRase(v, { override: { wRun: 0 } })); }
  ok(pr2 <= 0.03, `course : l'orteil ne rase pas la pelouse en repartant (≤ ${(1000 * pr2).toFixed(0)} ms par vol ; les coureurs 17-27 ms, p90 20-33 : plafond 30 ms)`);
  ok(hr >= 0.04, `sabotage — le chemin cartésien d'hier fait raser l'orteil ${(1000 * hr).toFixed(0)} ms à chaque vol : la clause mord`);
  ok(JSON.stringify(gaitPose(P, 0.3, 4, 0.5, NEUTRAL_GAIT_STYLE, {})) === JSON.stringify(gaitPose(P, 0.3, 4, 0.5, NEUTRAL_GAIT_STYLE, { griffe: 0 })), 'griffé 0 / absent : la foulée d\'hier au bit');
}

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
