#!/usr/bin/env node
// verify-gait.mjs — L'HORLOGE DE FOULÉE ET LE CORPS ACCORDÉ (engine/gait.js).
//
// Ce qu'on prouve : qu'il n'existe qu'UNE phase de locomotion et que tous les clips porteurs de foulée
// en sont esclaves ; que la cadence suit la loi mesurée (Dorn 2012) et non une constante inventée ; que
// l'idle n'est jamais asservi ; et que la couche « corps accordé » est pure, nulle à l'arrêt, opposée
// bras/jambes et bornée à la tête.
//
// Le sabotage qui compte le plus est L'ANCIEN CODE LUI-MÊME : timeScale = v/strideᵢ par ancre — la
// clause de dérive doit le condamner avec le même instrument, sinon elle ne mesure pas le défaut qui a
// motivé le module (dérive mesurée : 1,044 cycle/s à 3,7 m/s, opposition des pieds 10× en 10 s).
import { strideLaw, makeGaitClock, phaseOffset, gaitLayer, GAIT_TUNE, checkGait }
  from '../assets/starter/src/engine/gait.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };
const has = (r, n) => !r.ok && r.issues.some((i) => i.toLowerCase().includes(n.toLowerCase()));

console.log('— la loi de cadence —');
{
  // (2026-09-24) la table RÉELLE : RBDS 2017 (coureurs amateurs, 2,5-4,5 m/s) puis Dorn 2012 (5,2-8,95 m/s), relue dans le texte du PDF
  ok('la loi passe par les mesures (RBDS 1,286 / 1,358 / 1,433 Hz à 2,5 / 3,5 / 4,5 m/s ; Dorn 1,47 / 1,75 / 2,18 Hz à 5,2 / 7,0 / 8,95)',
    [[2.5, 1.286], [3.5, 1.358], [4.5, 1.433], [5.2, 1.47], [7.0, 1.75], [8.95, 2.18]].every(([v, f]) => Math.abs(strideLaw(v) - f) < 1e-9));
  ok('f·S = v tient aux points de Dorn (1,47 × 3,42 ≈ 5,2 ; 1,75 × 3,99 ≈ 7,0 ; 2,18 × 4,10 ≈ 8,95 — moyennes de coureurs : le produit des moyennes n’est pas la moyenne des produits, 3,3 % à 5,2 — à 4 %)',
    [[5.2, 1.47, 3.42], [7.0, 1.75, 3.99], [8.95, 2.18, 4.10]].every(([v, f, S]) => Math.abs(f * S - v) / v < 0.04));
  ok('les deux sources se recoupent (Dorn 3,52 m/s → 1,31 Hz : la loi y donne ' + strideLaw(3.52).toFixed(3) + ')', Math.abs(strideLaw(3.52) - 1.31) < 0.05);
  ok('monotone et bornée', strideLaw(2) < strideLaw(5) && strideLaw(12) === strideLaw(9) && strideLaw(0) === 0);
  // LE sabotage : la table MAL CITÉE d'hier (1,88 / 2,21 / 2,63 Hz, 1,43 à 1,50 × le papier) — 281 pas/min à 4 m/s, des pas de marche
  // à vitesse de course, sans vol : « ils collent au sol ». (La constante `stride: 2.6` d'avant, elle, tombait juste à 3,5 m/s : 1,35 Hz.)
  const misquoted = (v) => v <= 3.5 ? 1.88 * v / 3.5 : v <= 5.2 ? 1.88 + (v - 3.5) / 1.7 * 0.33 : 2.21 + (v - 5.2) / 1.8 * 0.42;
  ok(`sabotage « la table mal citée » attrapé (${misquoted(3.5).toFixed(2)} Hz au lieu de ${strideLaw(3.5).toFixed(2)} à 3,5 m/s, ${(misquoted(5.2) / strideLaw(5.2)).toFixed(2)}× à 5,2)`,
    [3.5, 5.2, 7.0].every((v) => misquoted(v) / strideLaw(v) > 1.3));
}

console.log('\n— l\'horloge unique —');
{
  const r = checkGait({ clock: makeGaitClock() });
  ok('contrat vert sur l\'horloge saine', r.ok, r.issues.join(' | '));
}
{
  // LE SABOTAGE-ROI : l'ancien code, mesuré avec le même instrument que la clause. Chaque ancre avance
  // à v/strideᵢ — on intègre exactement comme AnimationMixer l'aurait fait, et on mesure la dérive.
  const A = { stride: 1.5, dur: 1.0, t: 0 };
  const B = { stride: 2.3, dur: 0.7, t: 0 };
  let worst = 0;
  for (let i = 0; i < 600; i++) {
    const v = 2 + 2.5 * Math.sin(i / 40);
    for (const an of [A, B]) { const ts = Math.max(0.01, (v / an.stride) * an.dur); an.t = (an.t + ts * (1 / 60)) % an.dur; }
    const d = Math.abs(A.t / A.dur - B.t / B.dur) % 1;
    worst = Math.max(worst, Math.min(d, 1 - d));
  }
  ok(`sabotage « chaque clip a sa propre horloge (l'ancien code) » attrapé — dérive ${worst.toFixed(2)} cycle`, worst > 0.3);
}
{
  // sabotage « l'idle asservi » : à l'arrêt, φ est constant, donc l'idle asservi devient une statue.
  const clock = makeGaitClock();
  const idle = { stride: 0.0001, dur: 2.0, action: { time: 0.42, timeScale: 1 } };   // « juste un petit stride »
  const t0 = [];
  for (let i = 0; i < 120; i++) { clock.advance(0, 1 / 60); clock.apply([idle]); t0.push(idle.action.time); }
  ok('sabotage « idle asservi à φ (statue à l\'arrêt) » attrapé', new Set(t0).size === 1 && idle.action.timeScale === 0,
    `time figé à ${t0[0].toFixed(3)}`);
}
{
  // sabotage « φ horloge murale » : une phase qui avance à l'arrêt fait piétiner un joueur immobile.
  const wall = makeGaitClock({ law: () => 1.6 });
  const p0 = wall.phi; for (let i = 0; i < 60; i++) wall.advance(0, 1 / 60);
  ok('sabotage « φ avance à l\'arrêt (horloge murale) » attrapé', Math.abs(wall.phi - p0) > 0.5);
}

console.log('\n— l\'alignement des pieds (φ = 0 au contact gauche) —');
{
  // deux clips synthétiques : le contact gauche (minimum de hauteur) à u = 0,20 et u = 0,70
  const mk = (uContact) => (u) => 0.1 + 0.08 * (1 - Math.cos(2 * Math.PI * ((u - uContact + 1) % 1)));
  const offA = phaseOffset(mk(0.20)), offB = phaseOffset(mk(0.70));
  const at0 = (f, off) => f(((0 - off) % 1 + 1) % 1);
  ok('l\'offset place le contact de chaque clip à φ = 0',
    Math.abs(at0(mk(0.20), offA) - 0.1) < 0.005 && Math.abs(at0(mk(0.70), offB) - 0.1) < 0.005,
    `offsets ${offA.toFixed(2)} / ${offB.toFixed(2)}`);
  // sabotage : sans offsets, les deux clips lisent des pieds opposés au même φ. Mesuré AU CONTACT de
  // l'un des deux (u = 0,20 : le premier est au sol, le second en plein vol) — le premier point
  // d'échantillonnage choisi (0,45) tombait par hasard là où les deux cosinus coïncident, et le
  // sabotage était aveugle : même un sabotage se mesure.
  const gap = Math.abs(mk(0.20)(0.20) - mk(0.70)(0.20));
  ok('sabotage « offsets à zéro (pieds opposés au même φ) » attrapé', gap > 0.05, `écart de hauteur ${gap.toFixed(3)} m`);
}

console.log('\n— le corps accordé —');
{
  ok('pure : deux appels identiques rendent la même chose',
    JSON.stringify(gaitLayer(0.37, 4.2)) === JSON.stringify(gaitLayer(0.37, 4.2)));
  ok('nulle à l\'arrêt (aucun biais sur les poses d\'animkit)', gaitLayer(0.5, 0) === null && gaitLayer(0.2, 0.1) === null);
  const g = gaitLayer(0.25, 5);
  ok('les bras s\'opposent (gauche = −droite, à toutes les phases)',
    Array.from({ length: 24 }, (_, i) => gaitLayer(i / 24, 5)).every((x) => Math.abs(x.euler.LeftArm[0] + x.euler.RightArm[0]) < 1e-9));
  ok('le tronc tourne CONTRE le bassin (signe opposé au pic)', (() => {
    const a = gaitLayer(0.25, 5);                          // sin(2πφ) max à φ = 0,25
    return Math.sign(a.euler.Hips[1]) !== 0 && Math.sign(a.euler.Spine2[1]) !== Math.sign(a.euler.Hips[1]);
  })());
  ok(`la tête reste stable (≤ ${GAIT_TUNE.headMax}°)`,
    Array.from({ length: 48 }, (_, i) => gaitLayer(i / 48, 7)).every((x) => Math.abs(x.euler.Head[1] / 0.6) <= GAIT_TUNE.headMax + 1e-6));
  ok('l\'amplitude grandit avec la vitesse', Math.abs(gaitLayer(0, 6).euler.LeftArm[0]) > Math.abs(gaitLayer(0, 1.2).euler.LeftArm[0]) * 1.5);
  ok('le bassin rebondit deux fois par cycle, vers le bas', (() => {
    const ys = Array.from({ length: 64 }, (_, i) => gaitLayer(i / 64, 5).hipsY);
    let dips = 0;
    for (let i = 1; i < 63; i++) if (ys[i] < ys[i - 1] && ys[i] < ys[i + 1]) dips++;
    return dips === 2 && Math.min(...ys) < 0 && Math.max(...ys) <= 1e-12;
  })());
}
{
  // sabotages de la couche, chacun une variante plausible et fausse
  const memo = { n: 0 };
  const stateful = (phi, v) => { memo.n++; const g = gaitLayer(phi, v); if (g) g.euler.Hips[1] += memo.n * 1e-3; return g; };
  ok('sabotage « couche à état (dérive d\'appel en appel) » attrapé', has(checkGait({ layer: stateful }), 'pure'));
  const biased = (phi, v) => { const g = gaitLayer(phi, Math.max(v, 0.2)); return g; };
  ok('sabotage « biais au repos » attrapé', has(checkGait({ layer: biased }), 'arrêt'));
  const sameArms = (phi, v) => { const g = gaitLayer(phi, v); if (g) g.euler.RightArm = [...g.euler.LeftArm]; return g; };
  ok('sabotage « bras du même côté (le robot) » attrapé', has(checkGait({ layer: sameArms }), 'opposent'));
  const wildHead = (phi, v) => { const g = gaitLayer(phi, v); if (g) g.euler.Head = [0, g.euler.Spine2[1] * 4, 0]; return g; };
  ok('sabotage « tête qui suit le buste (regard non stabilisé) » attrapé', has(checkGait({ layer: wildHead }), 'tête'));
  const flatPsi = (phi, v) => gaitLayer(phi, v, { ...GAIT_TUNE, psi: { walk: 60, run: 60 } });
  ok('sabotage « déphasage bassin/épaules hors mesure (60°) » attrapé', has(checkGait({ layer: flatPsi }), 'déphasage'));
  const lazyLaw = (v) => v / 2.6;
  ok('sabotage « loi de cadence remplacée par la constante » attrapé', has(checkGait({ law: lazyLaw }), 'cadence'));
}

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
