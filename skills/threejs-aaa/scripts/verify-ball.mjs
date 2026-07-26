#!/usr/bin/env node
// verify-ball.mjs — the football flight model (engine/ball.js). This harness does not test code
// against itself: it tests the SIMULATION AGAINST THE REAL GAME. Every assertion is a number a
// coach would recognise — a curled free kick bends a couple of metres, a backspin ball checks and
// comes back, a firm pass dies inside the far half, a 30 m/s shot is dragged down hard.
import { BALL, PITCH, dragCoefficient, magnusCoefficient, kick, stepBall, simulate, checkBallFlight, lateralBend }
  from '../assets/starter/src/engine/ball.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };
const NO_AIR = { drag: false, magnus: false };

// ---------- the ball itself
ok(`ballon FIFA : 430 g, rayon ${BALL.radius} m, aire ${BALL.area.toFixed(4)} m²`,
  BALL.mass === 0.43 && Math.abs(BALL.radius - 0.11) < 1e-9 && Math.abs(BALL.area - 0.038) < 0.001);
ok(`traînée comparable à la gravité à 30 m/s (${(BALL.k * dragCoefficient(30) * 900).toFixed(1)} m/s²)`,
  BALL.k * dragCoefficient(30) * 900 > 6);

// ---------- 1. no air ⇒ the analytic parabola (the integrator itself is correct)
{
  const v0 = 25, th = Math.PI / 4;
  const s = kick([0, BALL.radius, 0], { speed: v0, dirYaw: 0, elevation: th });
  const { path } = simulate(s, { dt: 1 / 480, maxT: 8, opts: { ...NO_AIR, ground: false }, until: (st, t) => t > 0.2 && st.p[1] < BALL.radius });
  const range = path[path.length - 1].p[0];
  const analytic = (v0 * v0 * Math.sin(2 * th)) / PITCH.gravity;
  ok(`sans air : parabole analytique (${range.toFixed(1)} m vs ${analytic.toFixed(1)} m théoriques)`, Math.abs(range - analytic) < 0.6);
}
// ---------- 2. drag crisis: draggy when slow, slippery when fast
ok(`crise de traînée : Cd chute avec la vitesse (${dragCoefficient(5).toFixed(2)} à 5 m/s → ${dragCoefficient(30).toFixed(2)} à 30 m/s)`,
  dragCoefficient(5) > 0.4 && dragCoefficient(30) < 0.25 && dragCoefficient(5) > dragCoefficient(30));

// ---------- 3. drag really shortens a struck ball
let dragged = 0;
{
  const mk = (opts) => {
    const s = kick([0, BALL.radius, 0], { speed: 30, elevation: Math.PI / 4 });
    const { path } = simulate(s, { dt: 1 / 480, maxT: 10, opts: { ...opts, ground: false }, until: (st, t) => t > 0.2 && st.p[1] < BALL.radius });
    return path[path.length - 1].p[0];
  };
  const vac = mk(NO_AIR); dragged = mk({ drag: true, magnus: false });
  ok(`la traînée écrase un tir à 30 m/s (${dragged.toFixed(1)} m au lieu de ${vac.toFixed(1)} m dans le vide)`, dragged < vac * 0.72);
}
// ---------- 4. THE CURVE: a curled free kick must bend, the right way, by a realistic amount
let bend = 0;
{
  const s = kick([0, BALL.radius, 0], { speed: 25, dirYaw: 0, elevation: 0.14, spinAxis: [0, 1, 0], spinRev: 9 });
  const { path } = simulate(s, { dt: 1 / 480, maxT: 3, opts: { ground: false }, until: (st, t) => t > 0.2 && st.p[1] < BALL.radius });
  bend = lateralBend(path);
  const flown = Math.hypot(path[path.length - 1].p[0], path[path.length - 1].p[2]);
  ok(`coup franc brossé (25 m/s, 9 tr/s) : ${Math.abs(bend).toFixed(2)} m de courbe sur ${flown.toFixed(1)} m`,
    Math.abs(bend) > 1.0 && Math.abs(bend) < 8 && flown > 15);
  ok('la courbe part du BON côté (Magnus = ω × v)', bend > 0);
  const c = checkBallFlight(path); ok('trajectoire brossée sous contrat', c.ok, c.issues[0] || '');
}
// ---------- 5. mirrored spin ⇒ mirrored bend (no hidden bias)
{
  const s = kick([0, BALL.radius, 0], { speed: 25, dirYaw: 0, elevation: 0.14, spinAxis: [0, -1, 0], spinRev: 9 });
  const { path } = simulate(s, { dt: 1 / 480, maxT: 3, opts: { ground: false }, until: (st, t) => t > 0.2 && st.p[1] < BALL.radius });
  ok('effet inversé ⇒ courbe symétrique', Math.abs(lateralBend(path) + bend) < 0.05, `${lateralBend(path).toFixed(2)} vs ${(-bend).toFixed(2)}`);
}
// ---------- 6. backspin carries (lift), topspin dips
{
  const fly = (rev, axis) => {
    const s = kick([0, BALL.radius, 0], { speed: 22, dirYaw: 0, elevation: 0.3, spinAxis: axis, spinRev: rev });
    const { path } = simulate(s, { dt: 1 / 480, maxT: 6, opts: { ground: false }, until: (st, t) => t > 0.2 && st.p[1] < BALL.radius });
    return path[path.length - 1].p[0];
  };
  const flat = fly(0, [0, 0, 1]), back = fly(8, [0, 0, 1]), top = fly(8, [0, 0, -1]);
  ok(`rétro = portance : porte plus loin (${back.toFixed(1)} m vs ${flat.toFixed(1)} m sans effet)`, back > flat + 1.5);
  ok(`lifté = plonge : retombe plus court (${top.toFixed(1)} m)`, top < flat - 1.5);
}
// ---------- 7. bounces decay and respect restitution
{
  const s = { p: [0, 3, 0], v: [0, 0, 0], w: [0, 0, 0] };
  const { path } = simulate(s, { dt: 1 / 480, maxT: 6 });
  const peaks = [];
  for (let i = 1; i < path.length - 1; i++) if (path[i].p[1] > path[i - 1].p[1] && path[i].p[1] >= path[i + 1].p[1] && path[i].p[1] > BALL.radius + 0.05) peaks.push(path[i].p[1]);
  ok(`rebonds décroissants (${peaks.slice(0, 3).map((h) => h.toFixed(2)).join(' → ')} m)`, peaks.length >= 2 && peaks[1] < peaks[0] && peaks[0] < 3);
  const ratio = peaks[0] / 3;                                   // h1/h0 ≈ e² for a vertical drop
  ok(`restitution cohérente (h₁/h₀=${ratio.toFixed(2)} ≈ e²=${(PITCH.restitution ** 2).toFixed(2)})`, Math.abs(ratio - PITCH.restitution ** 2) < 0.12);
}
// ---------- 8. THE SPIN CONTACT, isolated. Measuring the END of a flight conflates the bounce
// with in-flight Magnus (a descending backspin ball is pushed FORWARD by Magnus, which masked the
// contact entirely on the first run). So sample vₓ immediately before and after the impact.
{
  const acrossBounce = (rev, axis) => {
    const s = { p: [0, 0.6, 0], v: [10, -5, 0], w: [0, 0, 0] };
    const w = rev * 2 * Math.PI, l = Math.hypot(...axis) || 1;
    s.w = [axis[0] / l * w, axis[1] / l * w, axis[2] / l * w];
    let before = s.v[0];
    for (let i = 0; i < 2000; i++) {
      const prevVy = s.v[1], prevVx = s.v[0];
      stepBall(s, 1 / 480);
      if (prevVy < 0 && s.v[1] > 0) return { before: prevVx, after: s.v[0] };   // the bounce frame
      before = prevVx;
    }
    return { before, after: s.v[0] };
  };
  const plain = acrossBounce(0, [0, 0, 1]), back = acrossBounce(11, [0, 0, 1]), top = acrossBounce(11, [0, 0, -1]);
  const d = (r) => r.after - r.before;
  ok(`rétro : le rebond FREINE le ballon (Δvₓ = ${d(back).toFixed(2)} m/s, sans effet ${d(plain).toFixed(2)})`, d(back) < d(plain) - 1.0);
  ok(`lifté : le rebond RELANCE le ballon (Δvₓ = ${d(top).toFixed(2)} m/s)`, d(top) > d(plain) + 0.5);
  ok('sans effet, le rebond ne fait que freiner un peu', d(plain) <= 0.01);
}
// ---------- 9. a firm pass dies at a believable distance
{
  const s = kick([0, BALL.radius, 0], { speed: 15, dirYaw: 0, elevation: 0 });
  const { path } = simulate(s, { dt: 1 / 240, maxT: 30, until: (st) => Math.hypot(st.v[0], st.v[2]) < 0.3 });
  const d = path[path.length - 1].p[0];
  ok(`passe à plat de 15 m/s : s'arrête à ${d.toFixed(0)} m (plausible : 20–70 m)`, d > 20 && d < 70);
  ok('le ballon roulant finit par S\'ARRÊTER (pas de roulement perpétuel)', path[path.length - 1].t < 30);
}
// ---------- 10. no tunnelling at shooting speed, even at 60 Hz
{
  const s = kick([0, 0.4, 0], { speed: 35, dirYaw: 0, elevation: -0.15 });
  const { path } = simulate(s, { dt: 1 / 60, maxT: 3 });
  const under = path.filter((q) => q.p[1] < BALL.radius - 0.02).length;
  ok('35 m/s à 60 Hz : aucun passage sous la pelouse (sous-pas)', under === 0, `${under} échantillons fautifs`);
  const c = checkBallFlight(path, { dt: 1 / 60 }); ok('contrat OK à 60 Hz', c.ok, c.issues[0] || '');
}
// ---------- 11. determinism
{
  const run = () => simulate(kick([0, BALL.radius, 0], { speed: 25, elevation: 0.3, spinAxis: [0, 1, 0], spinRev: 7 }), { dt: 1 / 240, maxT: 2 }).state;
  ok('déterministe (même coup → même trajectoire)', JSON.stringify(run()) === JSON.stringify(run()));
}
// ---------- 12. named sabotages of the contract
{
  const base = simulate(kick([0, BALL.radius, 0], { speed: 20, elevation: 0.4 }), { dt: 1 / 240, maxT: 2 }).path;
  const sab = (name, mutate, needle) => {
    const bad = base.map((q) => ({ t: q.t, p: [...q.p], v: [...q.v] })); mutate(bad);
    const c = checkBallFlight(bad, { dt: 1 / 240 });
    ok(`sabotage « ${name} » attrapé`, !c.ok && c.issues.some((i) => i.includes(needle)), c.issues[0] || 'RIEN');
  };
  sab('ballon sous la pelouse', (b) => { b[40].p[1] = -0.5; }, 'traverse');
  sab('téléport', (b) => { b[40].p[0] += 12; }, 'téléport');
  sab('énergie créée', (b) => { for (let i = 40; i < b.length; i++) b[i].v[1] += 30; }, 'énergie');
  sab('vitesse irréaliste', (b) => { b[30].v[0] = 200; }, 'irréaliste');
}
// ---------- 13. Magnus coefficient sanity
ok(`Cl réaliste (25 m/s, 9 tr/s → ${magnusCoefficient(25, 9 * 2 * Math.PI).toFixed(3)})`,
  magnusCoefficient(25, 9 * 2 * Math.PI) > 0.1 && magnusCoefficient(25, 9 * 2 * Math.PI) < 0.3);
ok('sans effet, pas de Magnus', magnusCoefficient(25, 0) === 0);

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
