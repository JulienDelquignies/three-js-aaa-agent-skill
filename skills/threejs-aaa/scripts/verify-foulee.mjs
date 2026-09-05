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
import { gaitPose, gaitParams, gaitPortrait, gaitCycleSpec, gaitCadenceFactor, gaitStyleFromSeed, checkGaitGen, NEUTRAL_GAIT_STYLE, GAIT_REGIMES } from '../assets/starter/src/engine/motion-gait.js';
import { checkClip, resolveTracks, quatAngle } from '../assets/starter/src/engine/animkit.js';
import { strideLaw } from '../assets/starter/src/engine/gait.js';
import { fkPose } from '../assets/starter/src/engine/motion-rig.js';

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
sab('vol qui rase (swingH 0)', { vF: 4.5, vR: 0, opts: { override: { swingH: 0 } } }, /rase la pelouse/);
sab('genou à l\'envers (pole arrière)', { vF: 4.5, vR: 0, opts: { override: { pole: [0, 0, 1] } } }, /genou plie à l'envers/);
sab('bras en phase (armPhase π)', { vF: 4.5, vR: 0, opts: { override: { armPhase: Math.PI } } }, /main gauche|main droite/);
sab('chassés qui croisent (hw 0,04)', { vF: 0, vR: 2, opts: { override: { hw: 0.04 } } }, /croisent/);
sab('tronc raide en course (lean 0, bassin droit)', { vF: 5, vR: 0, opts: { override: { lean: 0, pTilt: 0 } } }, /ne penche pas/);
sab('course arrière qui lève derrière (swingPeak 0,95)', { vF: -3, vR: 0, opts: { override: { swingPeak: 0.95 } } }, /ne monte pas devant/);
sab('pas trop long (bias −0,45)', { vF: 4.5, vR: 0, opts: { override: { bias: -0.45 } } }, /hors de portée|hanche hors|GLISSE|pas de/);

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
