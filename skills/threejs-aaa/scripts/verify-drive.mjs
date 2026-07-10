#!/usr/bin/env node
// verify-drive.mjs — the free-driving controller (engine/drive.js): the arcade bicycle model must
// behave like a car — reach (and not exceed) top speed, brake to a stop, hold a sane turning circle,
// cap reverse, scrub speed on a wall hit resolved by the injected collide, and stay deterministic.
import { DriveController } from '../assets/starter/src/engine/drive.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };
const DT = 1 / 60;

{
  const d = new DriveController();
  for (let i = 0; i < 60 * 12; i++) d.update(DT, { throttle: 1 });
  const top = d.speed;
  ok('pleine charge → vitesse de pointe stable sous maxSpeed', top > 15 && top <= d.maxSpeed, `${top.toFixed(1)} m/s`);
  for (let i = 0; i < 60 * 3; i++) d.update(DT, { brake: true });
  ok('freinage → arrêt complet', Math.abs(d.speed) < 0.05, `v=${d.speed.toFixed(3)}`);
}
{
  const d = new DriveController();
  for (let i = 0; i < 60 * 6; i++) d.update(DT, { throttle: 1, steer: 1 });
  const yaw0 = d.yaw, p0 = [...d.pos];
  let dist = 0, prev = [...d.pos];
  while (d.yaw - yaw0 < Math.PI * 2) { d.update(DT, { throttle: 1, steer: 1 }); dist += Math.hypot(d.pos[0] - prev[0], d.pos[1] - prev[1]); prev = [...d.pos]; }
  const R = dist / (Math.PI * 2);
  ok('braquage constant → cercle (rayon plausible 8–60 m)', R > 8 && R < 60, `R≈${R.toFixed(1)} m`);
  ok('le cercle revient près de son départ', Math.hypot(d.pos[0] - p0[0], d.pos[1] - p0[1]) < R * 0.6, `d=${Math.hypot(d.pos[0] - p0[0], d.pos[1] - p0[1]).toFixed(1)}`);
}
{
  const d = new DriveController();
  for (let i = 0; i < 60 * 8; i++) d.update(DT, { throttle: -1 });
  ok('marche arrière plafonnée', d.speed < 0 && d.speed >= -d.maxReverse - 0.01, `${d.speed.toFixed(1)} m/s`);
  const yaw0 = d.yaw;
  for (let i = 0; i < 60; i++) d.update(DT, { throttle: -1, steer: 1 });
  ok('en marche arrière le volant s’inverse (modèle bicyclette)', d.yaw < yaw0);
}
{
  const d = new DriveController();
  d.collide = (dx, dz) => (d.pos[1] + dz > 20 ? { dx, dz: Math.max(0, 20 - d.pos[1]) } : { dx, dz });   // wall at z=20
  for (let i = 0; i < 60 * 6; i++) d.update(DT, { throttle: 1 });
  ok('mur : la voiture est bloquée (z ≤ 20) et la vitesse purgée', d.pos[1] <= 20.01 && Math.abs(d.speed) < 3, `z=${d.pos[1].toFixed(2)} v=${d.speed.toFixed(1)}`);
  ok('drapeau blocked levé au contact', d.blocked === true);
}
{
  const run = () => { const d = new DriveController(); const out = []; for (let i = 0; i < 200; i++) out.push(d.update(DT, { throttle: 1, steer: 0.4 })); return JSON.stringify(out[199]); };
  ok('déterministe (mêmes entrées → même trajectoire)', run() === run());
}

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);
