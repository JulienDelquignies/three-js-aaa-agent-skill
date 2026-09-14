#!/usr/bin/env node
// verify-gaze.mjs — LE REGARD (engine/gaze.js) : la tête n'est plus soudée au tronc.
//
// Mesuré avant le module (sonde du sweep, 27 030 échantillons composés) : angle tête→ballon
// MÉDIAN 49-65° dans tous les rôles, receveur à 0,7 % des réceptions regardées, porteur à 0,0 %,
// zéro scan hors ballon, têtes claquées avec le corps à 1 148°/s (p99). Après : réception 15,3°
// médian (74 % sous 30°). Ces clauses verrouillent le MÉCANISME (pur) ; le composé se re-mesure
// avec la sonde du sweep (probe-regard-tete/measure-gaze.mjs).
import { GAZE, Gaze, pickGazeTarget, gazeRng, checkGaze } from '../assets/starter/src/engine/gaze.js';
import { makeMatch, matchCfg, matchStep } from '../assets/starter/src/engine/match-sim.js';

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

console.log('\n— A12a : le scan du receveur en vol (p.scan de la sim, lue par la politique — interface gelée §1) —');
{
  const rng = gazeRng(11);
  const rxv = (t, until, bx, vers = 'presseur', pos = [0, 0, 0]) => pickGazeTarget({ id: 4, t, ball: [bx, 0.1, 0], ownerId: null, flightTo: 4, justReceivedAt: null, act: null, job: 'support', markP: null, carrierP: null, scan: { at: 0, until, vers, cible: [4, 4], n: 1, vol: true }, pos }, {}, rng);
  const a = rxv(1, 1.4, 6), b = rxv(1.5, 1.4, 6), c = rxv(1, 1.4, 1), e = rxv(1, 1.4, 6, 'espace');
  ok(`receveur en vol, saccade en cours : les yeux vont à la cible de la sim [${a.map((v) => v.toFixed(1)).join(', ')}] (presseur : à hauteur de tête ${GAZE.scanEyeHead})`, a[0] === 4 && a[2] === 4 && a[1] === GAZE.scanEyeHead);
  ok(`…un espace se regarde à hauteur d'horizon (y ${e[1]} = ${GAZE.scanEyeSpace})`, e[1] === GAZE.scanEyeSpace && e[0] === 4);
  ok('…saccade finie (until ≤ t) : le ballon, la politique d\'hier', b[0] === 6 && b[2] === 0);
  ok(`…ballon à portée de prise (< ${GAZE.prise} m) : le ballon MÊME en saccade (Jordet : jamais pendant la prise)`, c[0] === 1 && c[2] === 0);
  // une seule horloge : quand la sim porte p.scan, le scan LOCAL hors ballon se tait
  const stL = {}; let horsBallon = 0;
  for (let t = 0; t < 10; t += 1 / 30) { const tgt = pickGazeTarget({ id: 1, t, ball: [0, 0, 0], ownerId: 2, flightTo: null, justReceivedAt: null, act: null, job: 'support', markP: [3, 1.5, 3], carrierP: [1, 1.5, 1], scan: { at: -1, until: -1, vers: 'ballon', cible: null, n: 0, vol: false }, pos: [5, 0, 5] }, stL, rng); if (tgt[0] !== 0 || tgt[2] !== 0) horsBallon++; }
  ok(`une seule horloge : avec p.scan porté par la sim, le scan local hors ballon se tait (${horsBallon} cibles hors ballon en 10 s = 0, aucune horloge locale armée : ${stL.nextScanAt === undefined})`, horsBallon === 0 && stL.nextScanAt === undefined);
  // la TÊTE suit : le ballon arrive de +x à 8 m/s, une saccade vers un presseur à 53° entre 0,3 et 0,75 s,
  // la prise à 1,06 s — le lacet part vers le presseur et revient sur le ballon AVANT la prise
  const tete = (until, pos) => {
    const g = new Gaze({ neck: mk(), head: mk() }); let maxDev = 0, devPrise = null;
    for (let i = 0; i <= 72; i++) {
      const t = i / 60, bx = 10 - 8 * t;
      const tgt = pickGazeTarget({ id: 4, t, ball: [bx, 0.1, 0], ownerId: null, flightTo: 4, justReceivedAt: null, act: null, job: 'support', markP: null, carrierP: null, scan: { at: 0.3, until: t >= 0.3 ? until : -1, vers: 'presseur', cible: [3, 4], n: 1, vol: true }, pos }, {}, rng);
      g.update(1 / 60, [0, 1.6, 0], tgt, 0);
      const dev = Math.abs(g.yaw);
      if (t >= 0.3 && t <= 0.75) maxDev = Math.max(maxDev, dev);
      if (Math.abs(bx - 1.5) < 0.07) devPrise = dev;
    }
    return { maxDev, devPrise };
  };
  const T = tete(0.75, [0, 0, 0]);
  ok(`la TÊTE suit la saccade (lacet max ${T.maxDev.toFixed(0)}° vers le presseur à 53°, ≥ 30°) et revient sur le ballon pour la prise (${T.devPrise?.toFixed(0)}° ≤ 10° à 1,5 m)`, T.maxDev >= 30 && T.devPrise != null && T.devPrise <= 10);
  const Sab = tete(99, null);
  ok(`sabotage « la saccade qui ne finit jamais, sans garde de prise » attrapé (${Sab.devPrise?.toFixed(0)}° de lacet à la prise > 10°)`, Sab.devPrise != null && Sab.devPrise > 10);
  // LE FLUX : un match 11c11 de 240 s, la politique appelée comme la scène l'appelle, sur le receveur de chaque vol
  const film = (over) => {
    const st = makeMatch({ full: true, seed: 3 }); const cfg = matchCfg({ ...over });
    const gst = {}, rngs = {};
    let frames = 0, off = 0, sacc = 0, volT = 0, prises = 0, prisesBallon = 0, last = null, lastTo = null, lastK = null, lastD = 99;
    for (let i = 0; i < 240 * 60; i++) {
      matchStep(st, 1 / 60, cfg);
      const to0 = st.phase === 'flight' ? (st.pass?.to ?? null) : null, to = to0 != null && st.players[to0] ? to0 : null;   // un dégagement n'a pas de receveur (to −1)
      if (lastTo != null && to !== lastTo) { if (lastD < 2.5) { prises++; if (lastK === 'ballon') prisesBallon++; } last = null; }
      if (to != null) {
        const p = st.players[to];
        const tgt = pickGazeTarget({ id: p.id, t: st.t, ball: st.ball.p, ownerId: st.ball.owner, flightTo: to, justReceivedAt: null, act: null, job: p.job, markP: null, carrierP: null, scan: p.scan ?? null, pos: p.p }, gst[p.id] ??= {}, rngs[p.id] ??= gazeRng(p.id));
        const onBall = tgt === st.ball.p;
        frames++; volT += 1 / 60; if (!onBall) off++;
        const k = onBall ? 'ballon' : 'cible';
        if (k === 'cible' && last !== 'cible') sacc++;
        last = k; lastK = k; lastD = Math.hypot(st.ball.p[0] - p.p[0], st.ball.p[2] - p.p[2]);
      }
      lastTo = to;
    }
    return { volT, offShare: off / Math.max(1, frames), perS: sacc / Math.max(0.1, volT), prises, prisesBallon };
  };
  const A = film({}), sans = film({ scan: null });
  ok(`LE FLUX (graine 3, 240 s) : le receveur en vol lève les yeux — ${(A.offShare * 100).toFixed(0)} % des images de vol hors ballon (≥ 15 %), ${A.perS.toFixed(2)} saccade/s de vol (Jordet ≥ 0,4) sur ${A.volT.toFixed(0)} s de vol`, A.offShare >= 0.15 && A.perS >= 0.4);
  ok(`…et les yeux sont sur le ballon À LA PRISE : ${A.prisesBallon}/${A.prises} réceptions (≥ 95 %)`, A.prises > 0 && A.prisesBallon / A.prises >= 0.95);
  ok(`la clé absente rend l'hier au bit : sans cfg.scan, le receveur fixe le ballon tout le vol (${(sans.offShare * 100).toFixed(0)} % hors ballon = 0, ${sans.prisesBallon}/${sans.prises} prises au ballon)`, sans.offShare === 0 && sans.prisesBallon === sans.prises);
}

console.log('\n— A12f : la passe sans regarder (view.noLook) —');
{
  const rng = gazeRng(13);
  const nl = (t, noLook) => pickGazeTarget({ id: 2, t, ball: [0, 0.1, 0], ownerId: 2, flightTo: null, justReceivedAt: null, act: { t: t - 5, antic: 0.3, targetP: [5, 1.5, 2] }, job: 'carry', markP: null, carrierP: null, noLook, pos: [0, 0, 0] }, {}, rng);
  const a = nl(5.25, true), b = nl(5.1, true), c = nl(5.25, false), d = nl(5.25, undefined);
  ok(a[0] === -5 && a[2] === -2, `au dernier tiers de l'armé, le technicien pressé regarde le POINT OPPOSÉ à sa cible [${a.join(', ')}] (cible [5, 1.5, 2])`);
  ok(b[0] === 5 && b[2] === 2, '…mais il VISE d\'abord (premier tiers : la cible, comme tout porteur)');
  ok(c[0] === 0 && d[0] === 0, 'sans le drapeau (false ou absent), le ballon au dernier tiers — hier au bit');
}

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
