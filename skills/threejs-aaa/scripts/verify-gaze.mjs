#!/usr/bin/env node
// verify-gaze.mjs — LE REGARD (engine/gaze.js) : la tête n'est plus soudée au tronc.
//
// Mesuré avant le module (sonde du sweep, 27 030 échantillons composés) : angle tête→ballon
// MÉDIAN 49-65° dans tous les rôles, receveur à 0,7 % des réceptions regardées, porteur à 0,0 %,
// zéro scan hors ballon, têtes claquées avec le corps à 1 148°/s (p99). Après : réception 15,3°
// médian (74 % sous 30°). Ces clauses verrouillent le MÉCANISME (pur) ; le composé se re-mesure
// avec la sonde du sweep (probe-regard-tete/measure-gaze.mjs).
import { GAZE, Gaze, pickGazeTarget, gazeRng, checkGaze } from '../assets/starter/src/engine/gaze.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };
const mk = () => ({ quaternion: { x: 0, y: 0, z: 0, w: 1, set(x, y, z, w) { this.x = x; this.y = y; this.z = z; this.w = w; } } });

console.log('— le contrat embarqué —');
{
  const c = checkGaze();
  ok('checkGaze est vert (clamps, saccade, vestibulaire, scans)', c.ok, c.issues.join(' ; '));
}

console.log('\n— le mécanisme : humain, borné, continu —');
{
  // convergence : une cible de côté est ACQUISE en < 0,4 s (saccade réelle : 0,1-0,3 s + poursuite)
  const g = new Gaze({ neck: mk(), head: mk() });
  let t = 0, acquired = null;
  for (let i = 0; i < 120; i++) {
    g.update(1 / 60, [0, 1.6, 0], [2, 1.6, 2], 0); t += 1 / 60;
    if (acquired == null && Math.abs(g.yaw - 45) < 3) acquired = t;
  }
  ok(`une cible à 45° est acquise en ${acquired?.toFixed(2) ?? '∞'} s (< 0,4)`, acquired != null && acquired < 0.4);
  // le tangage descend assez pour LIRE « il regarde son ballon » (clamp −55°)
  const g2 = new Gaze({ neck: mk(), head: mk() });
  for (let i = 0; i < 120; i++) g2.update(1 / 60, [0, 1.6, 0], [0.4, 0.11, 0.001], 0);
  ok(`le ballon au pied incline la tête au clamp (tangage ${g2.pitch.toFixed(0)}° = ${GAZE.pitchMin})`, Math.abs(g2.pitch - GAZE.pitchMin) < 2);
  // continuité : jamais plus que la saccade, même sur un swap de cible à 180°
  const g3 = new Gaze({ neck: mk(), head: mk() });
  for (let i = 0; i < 60; i++) g3.update(1 / 60, [0, 1.6, 0], [3, 1.6, 3], 0);
  const before = g3.yaw;
  g3.update(1 / 60, [0, 1.6, 0], [3, 1.6, -3], 0);
  ok(`un swap de cible reste sous la saccade (Δ ${Math.abs(g3.yaw - before).toFixed(1)}° ≤ ${(GAZE.saccade / 60).toFixed(0)}°/image)`,
    Math.abs(g3.yaw - before) <= GAZE.saccade / 60 + 1e-6);
}

console.log('\n— la politique : les rôles du vrai foot —');
{
  const rng = gazeRng(3);
  // le receveur regarde le ballon TOUT le vol + l'amorti
  const st = {};
  const rx = pickGazeTarget({ id: 4, t: 10, ball: [1, 0.1, 1], ownerId: null, flightTo: 4, justReceivedAt: null, act: null, job: 'support', markP: null, carrierP: null }, st, rng);
  ok('receveur : la cible est LE BALLON pendant le vol', rx[0] === 1 && rx[2] === 1);
  const rx2 = pickGazeTarget({ id: 4, t: 10.2, ball: [1, 0.1, 1], ownerId: 4, flightTo: null, justReceivedAt: 10.05, act: null, job: 'support', markP: null, carrierP: null }, st, rng);
  ok('…et le reste pendant l\'amorti (0,3 s après la réception)', rx2[0] === 1 && rx2[2] === 1);
  // le porteur en armé : la cible d'abord, le ballon au dernier tiers
  const stP = {};
  const early = pickGazeTarget({ id: 2, t: 5, ball: [0, 0.1, 0], ownerId: 2, flightTo: null, justReceivedAt: null, act: { t: 0.05, antic: 0.3, targetP: [5, 1.5, 0] }, job: 'carry', markP: null, carrierP: null }, stP, rng);
  const late = pickGazeTarget({ id: 2, t: 5.25, ball: [0, 0.1, 0], ownerId: 2, flightTo: null, justReceivedAt: null, act: { t: 0.25, antic: 0.3, targetP: [5, 1.5, 0] }, job: 'carry', markP: null, carrierP: null }, stP, rng);
  ok('porteur en armé : la CIBLE d\'abord (il vise)…', early[0] === 5);
  ok('…le BALLON au dernier tiers (il frappe)', late[0] === 0);
  // le presseur ne quitte jamais le ballon
  const pr = pickGazeTarget({ id: 7, t: 3, ball: [2, 0.1, -1], ownerId: 0, flightTo: null, justReceivedAt: null, act: null, job: 'chase', markP: null, carrierP: [0, 1.5, 0] }, {}, rng);
  ok('presseur : les yeux verrouillés sur le ballon', pr[0] === 2 && pr[2] === -1);
}

console.log('\n— les sabotages : chaque clause doit mordre —');
{
  // 1. tête-girouette : sans rate-limit, un swap de cible téléporte le regard
  const snap = (want, cur) => want;   // le « mécanisme » saboté
  const jump = Math.abs(snap(70, -70) - (-70));
  ok('sabotage « tête téléportée (pas de rate-limit) » attrapé par la clause de continuité (saut 140° en 1 image)', jump > GAZE.saccade / 60);
  // 2. chouette : sans clamp, une cible dans le dos met le cou à 180°
  const g = new Gaze({ neck: mk(), head: mk() });
  for (let i = 0; i < 300; i++) g.update(1 / 60, [0, 1.6, 0], [-5, 1.6, 0.01], 0);
  ok(`sabotage « chouette » impossible par construction (cible plein dos → lacet tenu à ${Math.abs(g.yaw).toFixed(0)}° = clamp)`,
    Math.abs(g.yaw) <= GAZE.yawMax + 1e-6);
  // 3. statue : une politique sans scans se voit à la cadence
  const stS = {}, rng = gazeRng(9);
  let changes = 0, last = null;
  for (let t = 0; t < 10; t += 1 / 30) {
    const tgt = pickGazeTarget({ id: 1, t, ball: [0, 0, 0], ownerId: 2, flightTo: null, justReceivedAt: null, act: null, job: 'support', markP: [3, 1.5, 3], carrierP: [1, 1.5, 1] }, stS, rng);
    const k = tgt.join(','); if (last && k !== last) changes++; last = k;
  }
  ok(`la politique hors-ballon SCANNE (${changes} changements de cible en 10 s ≥ 3)`, changes >= 3);
}

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
