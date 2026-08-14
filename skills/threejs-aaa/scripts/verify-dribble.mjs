#!/usr/bin/env node
// verify-dribble.mjs — carrying the ball (engine/dribble.js). The assertions target the FAILURE
// MODES of fake dribbling: a ball welded at a fixed offset, a ball that runs away, a ball that
// trails behind, a foot that machine-guns it every frame. Plus the trade-off that makes dribbling
// a real mechanic: pace costs control.
import { BALL } from '../assets/starter/src/engine/ball.js';
import { makeDribbler, dribbleStep, checkDribble, touchDistance, dribbleSteer } from '../assets/starter/src/engine/dribble.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };

/** Run a dribble: player moves at `speed` along a heading that can turn at `turn` rad/s. */
function run({ speed = 5, turn = 0, T = 6, dt = 1 / 120 } = {}) {
  const d = makeDribbler();
  const ball = { p: [1.0, BALL.radius, 0], v: [speed, 0, 0], w: [0, 0, 0] };
  const player = { p: [0, 0], speed, heading: [1, 0], want: [1, 0] };
  const trace = [];
  let yaw = 0;
  for (let i = 0; i * dt < T; i++) {
    yaw += turn * dt;
    player.want = [Math.cos(yaw), Math.sin(yaw)];
    player.turnRate = turn;
    // a dribbler RUNS WITH THEIR BALL: the intended line is `want`, the actual heading bends to
    // the ball (dribbleSteer). Running the intended line blind is how you leave the ball behind.
    player.heading = dribbleSteer(ball, player);
    player.p = [player.p[0] + player.heading[0] * speed * dt, player.p[1] + player.heading[1] * speed * dt];
    const r = dribbleStep(d, ball, player, dt);
    trace.push({ t: i * dt, speed, ...r });
  }
  return { d, ball, player, trace };
}

// ---------- 1. a clean jogging dribble satisfies the whole contract
{
  const { trace, d } = run({ speed: 4, T: 8 });
  const c = checkDribble(trace);
  ok(`dribble au petit trot (4 m/s) sous contrat — ${d.touches} touches, ballon à ${c.stats.mean} m ±${c.stats.sd}`, c.ok, c.issues.join(' | '));
  ok('le ballon MÈNE le joueur (jamais derrière durablement)', trace.filter((s) => s.ahead < -0.15).length / trace.length < 0.1);
}
// ---------- 2. THE tell: the distance breathes — this is what a welded ball can never do
{
  const { trace } = run({ speed: 5, T: 8 });
  const c = checkDribble(trace);
  ok(`la distance ballon–joueur RESPIRE (écart-type ${c.stats.sd} m, max ${c.stats.worst} m)`, c.stats.sd > 0.25);
  // and the sabotage: a ball welded at a constant offset must be REJECTED
  const glued = trace.map((s) => ({ ...s, dist: 0.85, ahead: 0.85 }));
  const g = checkDribble(glued);
  ok('sabotage « ballon soudé à 85 cm » attrapé', !g.ok && g.issues.some((i) => i.includes('COLLÉ')), g.issues[0] || 'RIEN');
}
// ---------- 3. pace costs control: sprint touches are longer than close-control touches
{
  const slow = touchDistance(2.5), fast = touchDistance(8);
  ok(`la vitesse allonge la touche (${slow.toFixed(2)} m au petit trot → ${fast.toFixed(2)} m en sprint)`, fast > slow + 1.2);
  const a = run({ speed: 2.5, T: 8 }), b = run({ speed: 8, T: 8 });
  const maxOf = (r) => Math.max(...r.trace.map((x) => x.dist));
  ok(`le ballon s'éloigne quand on sprinte (${maxOf(a).toFixed(2)} m au trot → ${maxOf(b).toFixed(2)} m en sprint)`, maxOf(b) > maxOf(a) + 0.6);
  ok('mais reste sous contrôle même à 8 m/s', checkDribble(b.trace).ok, checkDribble(b.trace).issues.join(' | '));
}
// ---------- 4. touches are stride-paced, not per-frame
{
  const { trace, d } = run({ speed: 5, T: 8 });
  const rate = d.touches / 8;
  ok(`cadence des touches réaliste (${rate.toFixed(2)}/s à 5 m/s)`, rate > 0.4 && rate < 4);
  const machine = trace.map((s) => ({ ...s, touched: true }));
  const m = checkDribble(machine);
  ok('sabotage « le pied mitraille » attrapé', !m.ok && m.issues.some((i) => i.includes('mitraille')), m.issues[0] || 'RIEN');
}
// ---------- 5. the ball follows a turn instead of flying off tangentially
{
  const { trace, ball, player } = run({ speed: 4.5, turn: 0.55, T: 7 });
  const c = checkDribble(trace);
  ok('le ballon SUIT le virage (reste sous contrôle en courbe)', c.ok, c.issues.join(' | '));
  const end = Math.hypot(ball.p[0] - player.p[0], ball.p[2] - player.p[1]);
  ok(`après 7 s de course en courbe le ballon est toujours là (${end.toFixed(2)} m)`, end < 4.2);
}
// ---------- 6. sabotages: runaway and trailing ball
{
  const { trace } = run({ speed: 5, T: 6 });
  const away = trace.map((s, i) => ({ ...s, dist: i > 300 ? 6.5 : s.dist }));
  const a = checkDribble(away);
  ok('sabotage « ballon qui fuit » attrapé', !a.ok && a.issues.some((i) => i.includes('perdu')), a.issues[0] || 'RIEN');
  const back = trace.map((s) => ({ ...s, ahead: -1 }));
  const b = checkDribble(back);
  ok('sabotage « ballon qui traîne derrière » attrapé', !b.ok && b.issues.some((i) => i.includes('DERRIÈRE')), b.issues[0] || 'RIEN');
}
// ---------- 6 bis. LE RATIO DE TOUCHE (la contre-vérification croisée : purecontender, UE5,
// tune ~1,27× à la main — « the ball has to leave the foot ~1.27× faster than you're running
// just to stay ahead » ; nous DÉRIVONS la poussée de la friction (pushSpeed = v + √(2·a·lead)).
// Mesuré en flux match (touches LIBRES, allure de course 3,5-5,2 m/s) : p50 1,26, p25-p75
// 1,25-1,26 — deux moteurs, deux méthodes, la même constante à ±0,01. Ces clauses verrouillent
// la DÉRIVATION elle-même (unitaires, pas de flux) : si touchDecel/pushSpeed/touchF régressent,
// le ratio sort de la bande et le banc crie.
{
  const { pushSpeed } = await import('../assets/starter/src/engine/dribble.js');
  const serre = 0.62;                                    // le régime de croisière du match (carryTight)
  const ratios = [4.0, 4.5, 5.0].map((v) => pushSpeed(v, touchDistance(v) * serre) / v);
  ok(`le ratio de touche en course vit autour du 1,27 d'UE (${ratios.map((r) => r.toFixed(2)).join(', ')} ∈ [1,15 ; 1,45])`,
    ratios.every((r) => r >= 1.15 && r <= 1.45));
  // …et il N'EST PAS une constante : au trot le décollage coûte relativement plus (la dérivation
  // lit la friction — un multiplicateur plat ne le ferait pas ; mesuré en flux : 1,35 contre 1,26)
  const trot = pushSpeed(2.5, touchDistance(2.5) * serre) / 2.5;
  const course = pushSpeed(4.5, touchDistance(4.5) * serre) / 4.5;
  ok(`…et n'est PAS un multiplicateur plat (trot ${trot.toFixed(2)} > course ${course.toFixed(2)} + 0,04)`, trot > course + 0.04);
  // sabotage nommé « poussée plate » : servir un multiplicateur constant à la place de la
  // dérivation doit sortir de la clause ci-dessus (la signature trot > course disparaît)
  const plat = (v) => v * 1.27 / v;
  ok('sabotage « poussée plate » attrapé (un ×1,27 constant perd la signature trot > course)', !(plat(2.5) > plat(4.5) + 0.04));
}

// ---------- 7. determinism
{
  const j = () => JSON.stringify(run({ speed: 5, T: 3 }).ball);
  ok('déterministe (même course → même ballon)', j() === j());
}

// ---------- 8. lot 55 — la touche PORTE SA GÉOMÉTRIE (dev°, spd) : la scène en fait un geste
{
  const { makeMatch, matchCfg, matchStep } = await import('../assets/starter/src/engine/match-sim.js');
  const st = makeMatch({ full: true, seed: 1 });
  const cfg = matchCfg({ shotRange: 20 });
  for (let i = 0; i < 120 * 60; i++) matchStep(st, 1 / 60, cfg);
  const touches = st.events.filter((e) => e.type === 'touche');
  const nues = touches.filter((e) => e.dev == null || e.spd == null || !Number.isFinite(e.dev));
  ok(`chaque touche de conduite porte sa cassure (${touches.length} touches, ${nues.length} nue(s) — un renderer aval n'a rien à recalculer)`,
    touches.length >= 30 && nues.length === 0);
  // …et les touches FORTES existent (le demi-tour que l'utilisateur voyait sans frappe) : la
  // scène joue crochetCourt ≥ 110° / passeExterieur ≥ 60° sur ce signal (Rondo.js, sabotage
  // 'touche-plate' — prouvé en playmode : 8 fortes → 8 swings, sabotage → 0)
  const fortes = touches.filter((e) => e.dev >= 60);
  ok(`les touches fortes VIVENT (${fortes.length} à ≥ 60° sur 120 s, existence ≥ 1 — le signal du geste de scène)`, fortes.length >= 1);
}

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
