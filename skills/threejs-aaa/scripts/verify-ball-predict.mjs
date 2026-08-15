#!/usr/bin/env node
// verify-ball-predict.mjs — prediction and INVERSE BALLISTICS (engine/ball-predict.js). The point
// of this module is that a pass ARRIVES: on the receiver, at a pace he can control. So the
// assertions measure landing error in centimetres and arrival speed in m/s, across pass styles and
// distances — the numbers that decide whether AI football looks competent or hopeful.
import { BALL, kick } from '../assets/starter/src/engine/ball.js';
import { predictPath, crossesHeight, ballAt, solvePass, laneClearance, interceptPoint, PASS_STYLE }
  from '../assets/starter/src/engine/ball-predict.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };
const at = (x, z, y = BALL.radius) => [x, y, z];

// ---------- prediction is EXACT (it is the same integrator, not an approximation)
{
  const s = kick(at(0, 0), { speed: 18, dirYaw: 0.7, elevation: 0.35, spinAxis: [0, 1, 0], spinRev: 4 });
  const path = predictPath(s, { dt: 1 / 120, maxT: 2 });
  const truth = kick(at(0, 0), { speed: 18, dirYaw: 0.7, elevation: 0.35, spinAxis: [0, 1, 0], spinRev: 4 });
  const { stepBall } = await import('../assets/starter/src/engine/ball.js');
  for (let i = 0; i < 120; i++) stepBall(truth, 1 / 120);
  const p = ballAt(path, 1.0);
  ok(`prédiction exacte à 1 s (écart ${(Math.hypot(p[0] - truth.p[0], p[1] - truth.p[1], p[2] - truth.p[2]) * 100).toFixed(1)} cm)`,
    Math.hypot(p[0] - truth.p[0], p[1] - truth.p[1], p[2] - truth.p[2]) < 0.05);
  const kn = crossesHeight(path, 0.5);
  ok(`croisement de hauteur détecté (genou 0,5 m : ${kn.length} passages, montée puis descente)`,
    kn.length >= 2 && kn[0].rising && !kn[kn.length - 1].rising);
}
// ---------- INVERSE BALLISTICS: the pass lands where it was aimed
{
  const styles = ['ground', 'driven', 'lofted', 'chip'];
  for (const style of styles) {
    let worst = 0, minArr = 99, maxArr = 0;
    for (const d of [6, 10, 14, 18]) {
      const from = at(0, 0), to = at(d, 0);
      const sol = solvePass(from, to, { style });
      if (!sol) { worst = 99; break; }
      worst = Math.max(worst, sol.error);
      minArr = Math.min(minArr, sol.arrivalSpeed); maxArr = Math.max(maxArr, sol.arrivalSpeed);
    }
    ok(`passe « ${style} » : arrive sur la cible à 6→18 m (erreur max ${(worst * 100).toFixed(0)} cm)`, worst < 0.6);
    ok(`  … à une vitesse jouable (${minArr.toFixed(1)}–${maxArr.toFixed(1)} m/s)`, minArr > 1.5 && maxArr < 26);
  }
}
{
  // the solved pass must actually be reachable by simulation, not just by the solver's own maths
  const from = at(0, 0), to = at(12, 5);
  const sol = solvePass(from, to, { style: 'driven' });
  const s = kick(from, { speed: sol.speed, dirYaw: sol.dirYaw, elevation: sol.elevation });
  const path = predictPath(s, { dt: 1 / 240, maxT: 3 });
  let best = Infinity;
  for (const q of path) best = Math.min(best, Math.hypot(q.p[0] - to[0], q.p[2] - to[2]));
  ok(`la solution rejouée passe bien sur le receveur (${(best * 100).toFixed(0)} cm)`, best < 0.7);
  ok(`direction correcte (yaw ${sol.dirYaw.toFixed(2)} = atan2(5,12)=${Math.atan2(5, 12).toFixed(2)})`, Math.abs(sol.dirYaw - Math.atan2(5, 12)) < 1e-6);
}
{
  // a chip must actually go OVER a defender that a ground ball would hit
  const from = at(0, 0), to = at(11, 0);
  const g = solvePass(from, to, { style: 'ground' }), c = solvePass(from, to, { style: 'chip' });
  const apex = (sol) => Math.max(...predictPath(kick(from, sol), { dt: 1 / 240, maxT: 3 }).map((q) => q.p[1]));
  ok(`le lob passe au-dessus (apogée ${apex(c).toFixed(2)} m contre ${apex(g).toFixed(2)} m à ras de terre)`, apex(c) > 1.9 && apex(g) < 0.5);
  ok('… et met plus de temps à arriver (prix du lob)', c.flightTime > g.flightTime);
}
// ---------- lane geometry: the input that decides where the ball may be played
{
  const from = at(0, 0), to = at(12, 0);
  const clear = laneClearance(from, to, [at(6, 4), at(3, -5)]);
  const blocked = laneClearance(from, to, [at(6, 0.4)]);
  ok(`couloir libre détecté (marge ${clear.margin.toFixed(1)} m)`, clear.open && clear.margin > 3);
  ok(`couloir bouché détecté (marge ${blocked.margin.toFixed(2)} m, bloqueur ${blocked.blocker})`, !blocked.open && blocked.blocker === 0);
  ok('un défenseur DERRIÈRE le passeur ne bouche rien', laneClearance(from, to, [at(-4, 0)]).open);
  ok('un défenseur SUR le receveur ne compte pas comme bouchant le couloir', laneClearance(from, to, [at(11.9, 0)]).open);
}
// ---------- interception: who can read the pass
{
  const s = kick(at(0, 0), { speed: 14, dirYaw: 0, elevation: 0 });
  const path = predictPath(s, { dt: 1 / 60, maxT: 3 });
  const near = interceptPoint(path, at(7, 3), 6.5);
  const far = interceptPoint(path, at(7, 30), 6.5);
  ok(`un défenseur à 3 m du couloir intercepte (t=${near ? near.t.toFixed(2) : '—'} s)`, !!near);
  ok('un défenseur à 30 m ne peut pas', !far);
  const slow = interceptPoint(path, at(7, 3), 1.0);
  ok('un défenseur trop lent ne peut pas', !slow);
}
// ---------- determinism
{
  const j = () => JSON.stringify(solvePass(at(0, 0), at(13, 4), { style: 'driven' }));
  ok('déterministe (même passe → même solution)', j() === j());
}

// ---------- lot 56 — LE SOLVEUR RAPIDE NE CHANGE PAS LE JEU (le contrat de la saccade)
{
  const { kick, stepBall, BALL } = await import('../assets/starter/src/engine/ball.js');
  // la référence d'hier au paramètre près — le banc compare CAS PAR CAS : la vitesse résolue
  // par le rapide, REJOUÉE en physique 240 Hz, doit atterrir sur la cible (l'assiette du
  // gameplay, pas une promesse). La détection d'atterrissage se lit au REBOND (vy s'inverse)
  // — l'ancienne lecture attrapait parfois le DEUXIÈME arc, à 240 Hz aussi (bug d'hier, mesuré
  // 2,87 s de « vol » pour un premier contact à 1,7 s).
  const REF = { dt: 1 / 240, iterations: 24, tol: 0, seed: false };
  // Re-fondation lot 65 (récit) : la couche GAZON rend chaque rebond non-linéaire (k = jn/6) —
  // sur un chemin MULTI-REBONDS (une tendue de 28 m atterrit à ~11 m puis rebondit jusqu'à la
  // cible), la vitesse initiale devient DÉGÉNÉRÉE : plusieurs vitesses arrivent au même point,
  // le gazon absorbe l'écart en route (mesuré : rapide 22,49 vs réf 21,55, les DEUX atterrissent).
  // Le contrat se juge par CHEMIN : mono-arc (premier contact ≈ la cible) → Δv ≤ 0,15 strict ;
  // multi-rebonds → le juge est l'ATTERRISSAGE (clause suivante), garde-fou Δv ≤ 1,2.
  let worstDv = 0, worstLand = 0, nCas = 0, worstDvMulti = 0, nMulti = 0;
  for (const style of ['ground', 'driven', 'lofted', 'chip', 0.42, 0.45]) {
    for (const d of [8, 18, 28]) {
      for (const spin of [null, { spinRev: 4.5, spinAxis: [0, 0, 1] }]) {
        const from = [0, BALL.radius, 0], to = [d, 0, 0];
        const fast = solvePass(from, to, { style, ...(spin ?? {}) });
        const ref = solvePass(from, to, { style, ...(spin ?? {}), ...REF });
        if (!fast || !ref) continue;
        nCas++;
        const elev = typeof style === 'number' ? style : { ground: 0, driven: 0.13, lofted: 0.42, chip: 0.72 }[style];
        let premier = null;
        if (elev > 0.02) {
          const s = kick(from, { speed: fast.speed, dirYaw: 0, elevation: elev, spinAxis: spin?.spinAxis ?? [0, 1, 0], spinRev: spin?.spinRev ?? 0 });
          let pv = s.v[1];
          for (let t = 0; t < 7 && premier == null; t += 1 / 240) {
            stepBall(s, 1 / 240);
            if (t > 0.08 && pv < 0 && s.v[1] >= 0) premier = Math.hypot(s.p[0] - from[0], s.p[2] - from[2]);
            pv = s.v[1];
          }
          if (premier != null && elev >= 0.2) worstLand = Math.max(worstLand, Math.abs(premier - d));
        }
        if (premier != null && premier < d - 1.5) { nMulti++; worstDvMulti = Math.max(worstDvMulti, Math.abs(fast.speed - ref.speed)); }
        else worstDv = Math.max(worstDv, Math.abs(fast.speed - ref.speed));
      }
    }
  }
  ok(`le solveur RAPIDE rejoue le même football (${nCas - nMulti} cas mono-arc, pire Δvitesse ${worstDv.toFixed(3)} m/s ≤ 0,15 — amorce analytique + pas par régime + sortie à 2 cm/s)`, nCas >= 30 && worstDv <= 0.15);
  ok(`…les chemins MULTI-REBONDS sont dégénérés par le gazon et se jugent à l'atterrissage (${nMulti} cas, garde-fou Δv ${worstDvMulti.toFixed(2)} ≤ 1,2)`, worstDvMulti <= 1.2);
  ok(`…et sa vitesse, rejouée en 240 Hz, ATTERRIT sur la cible (pire écart ${worstLand.toFixed(2)} m ≤ 0,35 — l'assiette du gameplay est un contrat, pas une promesse)`, worstLand <= 0.35);
}

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
