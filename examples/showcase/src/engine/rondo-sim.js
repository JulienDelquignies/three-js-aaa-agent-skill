import { BALL, stepBall, kick } from './ball.js';
import { predictPath } from './ball-predict.js';
import { solvePass } from './ball-predict.js';
import { makeDribbler, dribbleStep, dribbleSteer } from './dribble.js';
import { RONDO, assignJobs, choosePass, strikingFoot, rondoInternals } from './rondo.js';
import { situation, chooseTechnique, checkAction } from './technique.js';

// rondo-sim — the game loop of the possession game, headless. Everything that decides whether a
// "passe à dix" is won or lost happens here: when the carrier releases, whether the pass beats the
// press, whether a defender reads it, and who ends up with the ball. Because it runs with no
// renderer, the whole match can be proved in node (verify-rondo) before it is ever drawn.

const d2 = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const { movePlayers, turnover } = rondoInternals;

/** Execute the chosen pass: inverse ballistics, so it arrives on the receiver at a playable pace. */
function playPass(st, choice, cfg) {
  const c = st.players[st.possession.carrier];
  const from = [st.ball.p[0], BALL.radius, st.ball.p[2]];
  const sol = solvePass(from, choice.lead, { style: choice.style });
  if (!sol) return false;

  // THE GESTURE COMES FIRST, AND IT CAN SAY NO.
  // Bearing is the angle between where the player is FACING and where the ball is — 0 = straight ahead,
  // ±180° = behind him. Together with the distance, the height and where the pass has to GO, that is
  // the whole question "is this strike physically available to this body right now", and the technique
  // table is what answers it. It was being asked AFTER the ball had already been kicked, purely to
  // label the event: when the table returned NOTHING — no foot, no surface, no gesture that reaches
  // this ball and sends it there — the pass went out anyway, off a ball the man could not have touched.
  // That is the whole of `ball-ahead-at-strike`, and no amount of tuning elsewhere can fix it, because
  // the impossible strike is not a bad choice among legal ones: it is an illegal one being allowed.
  // Now the selection gates the kick. No technique, no pass — he keeps the ball and turns onto it
  // (he faces his ball, so the window opens within a stride), or he backheels, which the table allows
  // precisely because that IS the gesture for a ball behind you.
  const tx = choice.lead[0] - c.p[0], tz = choice.lead[2] - c.p[2];
  const fx2 = Math.cos(c.yaw), fz2 = Math.sin(c.yaw);
  const outBearing = (Math.atan2(fx2 * tz - fz2 * tx, fx2 * tx + fz2 * tz) * 180) / Math.PI;
  // measured on the ball AS IT LIES — this used to read st.ball.v after the kick had overwritten it,
  // i.e. it described the ball leaving rather than the ball being struck
  const sit = situation(c.p, c.yaw, from, st.ball.v, from[1]);
  const pick = chooseTechnique(sit, 'pass', { firstTouch: false, outBearing })[0];
  if (!pick) return false;

  c.foot = pick.foot;
  const s = kick(from, { speed: sol.speed, dirYaw: sol.dirYaw, elevation: sol.elevation, spinAxis: [0, 1, 0], spinRev: 0 });
  st.ball.p = s.p; st.ball.v = s.v; st.ball.w = s.w;
  st.phase = 'flight';
  st.pass = { from: c.id, to: choice.to.id, lead: choice.lead, style: choice.style, t: st.t, flight: sol.flightTime, error: sol.error, origin: [from[0], from[2]] };
  st.lastPasser = c.id;
  st.possession.carrier = -1;
  st.hold = 0; st.pressure = 0;
  st.events.push({
    t: +st.t.toFixed(2), type: 'pass', from: c.id, to: choice.to.id, style: choice.style, foot: c.foot,
    margin: +choice.lane.margin.toFixed(2),
    bearing: +sit.bearing.toFixed(1), ballDist: +sit.dist.toFixed(2), ballY: +from[1].toFixed(2), speed: +sol.speed.toFixed(1),
    // the TECHNIQUE the gesture actually was, with the geometry it was chosen on — a later re-measure
    // is a different picture, so the action carries its own justification
    tech: pick.tech.id, surface: pick.surface, side: sit.side, dist: +sit.dist.toFixed(2), height: +from[1].toFixed(2), out: +outBearing.toFixed(1),
  });
  return true;
}

/**
 * Give the ball to `id`. A team-mate taking it keeps possession — only the INTENDED receiver
 * scores the pass; anyone else on the same shirt is a scuffed ball that stayed in the family.
 * An opponent taking it is the turnover.
 */
function receive(st, id, cfg = RONDO) {
  const p = st.players[id];
  if (p.team === st.possession.team) {
    if (st.pass && st.pass.to === id) {
      st.passes++; st.best = Math.max(st.best, st.passes);
      st.events.push({ t: +st.t.toFixed(2), type: 'receive', by: id, count: st.passes });
    } else st.events.push({ t: +st.t.toFixed(2), type: 'loose-kept', by: id });
    st.possession.carrier = id; st.phase = 'carry'; st.pass = null;
    st.hold = 0; st.pressure = 0;
    // WHICH CONTROL. A ball arriving on the left is taken with the left foot, or with the outside of
    // the right — the technique table decides from the geometry, and the choice is recorded so the
    // catalogue can rule on it. A ball nobody has a legal control for is simply not controlled: it
    // runs, and that is a loose ball, which is correct football rather than a magic first touch.
    const sit = situation(p.p, p.yaw, st.ball.p, st.ball.v, st.ball.p[1]);
    const pick = chooseTechnique(sit, 'control')[0];
    if (pick) {
      p.foot = pick.foot;
      // A CONTROL BRINGS THE BALL TO THE FOOT. It used to only damp the velocity, so the ball stopped
      // dead wherever it happened to be when the receive triggered — a metre from the man, which reads
      // exactly as "it stops on the control while it is still far from his foot". Taking a touch means
      // the ball ENDS UP at your feet; that is the whole point of the gesture.
      // …AND IT IS A DIRECTIONAL TOUCH. Settling the ball along his CURRENT facing put it back where
      // the pass came from — he was running to meet it, so "in front of him" pointed at the passer —
      // and the next strike then had the ball behind him 55 % of the time. A first touch is taken INTO
      // the direction you intend to go, and the body turns with it: away from the nearest opponent.
      const foe = st.players.filter((q) => q.team !== p.team && q.down <= 0)
        .reduce((b, q) => (!b || d2(q.p, p.p) < d2(b.p, p.p) ? q : b), null);
      let tx = Math.cos(p.yaw), tz = Math.sin(p.yaw);
      if (foe) {
        const ax = p.p[0] - foe.p[0], az = p.p[2] - foe.p[2], al = Math.hypot(ax, az) || 1;
        tx = ax / al; tz = az / al;
      }
      p.yaw = Math.atan2(tz, tx);                              // he turns with the touch
      const lat = pick.foot === 'left' ? 1 : -1;               // left of forward is (fz, -fx) here
      st.ball.p = [
        p.p[0] + tx * cfg.controlSettle + tz * lat * cfg.footSide,
        BALL.radius,
        p.p[2] + tz * cfg.controlSettle - tx * lat * cfg.footSide,
      ];
      st.ball.v = [st.ball.v[0] * pick.tech.power, 0, st.ball.v[2] * pick.tech.power];
      st.events.push({
        t: +st.t.toFixed(2), type: 'control', by: id, tech: pick.tech.id, foot: pick.foot, surface: pick.surface,
        bearing: +sit.bearing.toFixed(1), side: sit.side, dist: +sit.dist.toFixed(2), height: +sit.height.toFixed(2),
        speed: +Math.hypot(st.ball.v[0], st.ball.v[2]).toFixed(1),
        // where the ball ENDED UP relative to the man who took the touch — the number the rule judges
        settle: +d2(p.p, st.ball.p).toFixed(2),
      });
    } else {
      // nobody had a legal touch for that ball: it is not magically killed, it runs
      st.ball.v = [st.ball.v[0] * 0.75, 0, st.ball.v[2] * 0.75];
    }
  } else {
    turnover(st, id, st.phase === 'flight' ? 'interception' : 'tackle');
  }
}

/**
 * THE SLIDE TACKLE — the action that was missing. A ball running loose beyond anyone's standing reach
 * could not be attacked at all: the game simply waited for someone to walk into it. A slide is the
 * only way to reach a ball 1 to 3 metres away, and it is a COMMITMENT — you go to ground, and if you
 * do not get it you are out of the play while you get up. That cost is what makes it a decision
 * rather than a free extra metre of reach.
 */
function trySlide(st, cfg) {
  // WHEN. Not at a pass in flight — that is what the interception job is for, and letting anyone dive
  // at a travelling ball produced 157 slides in 90 s. A slide is for a ball that has STRAYED: a touch
  // that got away from the carrier, or a genuinely loose ball. That is the situation the request
  // named, and restricting it to that situation is what makes the action rare enough to read.
  const car = st.possession.carrier >= 0 ? st.players[st.possession.carrier] : null;
  const strayed = car ? d2(car.p, st.ball.p) > cfg.strikeReach : true;
  if (!strayed) return;
  if (st.ball.p[1] > 0.4) return;                               // you do not slide at a ball in the air
  if (Math.hypot(st.ball.v[0], st.ball.v[2]) > cfg.slideMaxBall) return;   // nor at one going too fast to win
  // A SLIDE IS A LAST RESORT, not a longer reach. Letting anyone within range go to ground produced
  // 182 slides in 90 s and possession collapsed from 18 passes to 4: everybody dived at every loose
  // ball. You slide when you are LOSING THE RACE — when the man who would otherwise get there is an
  // opponent, and you cannot beat him on your feet. Everything else is a normal run.
  let best = null;
  for (const p of st.players) {
    if (p.down > 0) continue;
    const d = d2(p.p, st.ball.p);
    if (d < cfg.slideRange[0] || d > cfg.slideRange[1]) continue;
    const mine = st.players.filter((q) => q.team === p.team && q.id !== p.id && q.down <= 0);
    const foes = st.players.filter((q) => q.team !== p.team && q.down <= 0);
    if (mine.some((q) => d2(q.p, st.ball.p) < d)) continue;              // a team-mate is nearer: his ball
    const rival = foes.reduce((b, q) => (!b || d2(q.p, st.ball.p) < d2(b.p, st.ball.p) ? q : b), null);
    if (!rival) continue;
    const dRival = d2(rival.p, st.ball.p);
    // he only goes down if staying up loses it: the opponent is closer, or close enough to arrive first
    if (dRival > d - cfg.slideMargin) continue;
    if (!best || d < best.d) best = { p, d };
  }
  if (!best) return;
  const p = best.p;
  const sit = situation(p.p, p.yaw, st.ball.p, st.ball.v, st.ball.p[1]);
  const pick = chooseTechnique(sit, 'win', { bias: { 'tacle-glisse': 1 } })[0];
  if (!pick || pick.tech.id !== 'tacle-glisse') return;
  p.down = cfg.slideRecovery;                                  // he is on the ground either way
  // he gets there if he is genuinely the first: an opponent already on the ball wins the duel
  const rival = st.players.filter((q) => q.team !== p.team && q.down <= 0).reduce((b, q) => (d2(q.p, st.ball.p) < d2(b.p, st.ball.p) ? q : b), st.players.find((q) => q.team !== p.team));
  const won = !rival || d2(rival.p, st.ball.p) > cfg.receiveRadius;
  st.events.push({
    t: +st.t.toFixed(2), type: 'slide', by: p.id, won, tech: 'tacle-glisse', foot: pick.foot, surface: pick.surface,
    bearing: +sit.bearing.toFixed(1), side: sit.side, dist: +sit.dist.toFixed(2), height: +st.ball.p[1].toFixed(2),
    speed: +Math.hypot(st.ball.v[0], st.ball.v[2]).toFixed(1),
  });
  if (won) {
    st.ball.p = [p.p[0] + (st.ball.p[0] - p.p[0]) * 0.2, BALL.radius, p.p[2] + (st.ball.p[2] - p.p[2]) * 0.2];
    st.ball.v = [0, 0, 0]; st.ball.w = [0, 0, 0];
    receive(st, p.id, cfg);                       // bookkeeping: possession, turnover count, sequence reset
    // …BUT A BALL WON ON THE GROUND IS LOOSE, NOT CARRIED. `receive` made the tackler the carrier while
    // he was still lying in the grass with slideRecovery seconds left to serve, so the game spent those
    // seconds calling it a carry with the ball sitting metres from a man who could not move — 5.6 % of
    // all carry frames, which the catalogue reported as `carry-reach`. That is not a debt to budget: it
    // is a phase that is false. He poked it away; whoever gets to his feet first takes it, him included.
    // Which is also the better football — a won tackle is a 50/50, not a gift.
    if (p.down > 0) { st.phase = 'loose'; st.pass = null; st.possession.carrier = -1; st.hold = 0; st.pressure = 0; }
  }
}

/**
 * Advance the whole game by `dt`.
 * @param {object} st  state from makeRondo()
 */
export function rondoStep(st, dt, cfg = RONDO) {
  st.t += dt;
  assignJobs(st, cfg);
  movePlayers(st, dt, cfg);

  if (st.phase === 'carry') {
    const c = st.players[st.possession.carrier];
    if (!c) { st.phase = 'loose'; return st; }
    // the carrier really dribbles: touches, the ball free in between (dribble.js)
    if (!st._drb) st._drb = makeDribbler();
    // where the BALL should be pushed — the escape direction assignJobs computed, not the direction of
    // the player's own next step (those differ: he stands behind the ball, so his step is toward it)
    const want = c.push || (c.target ? (() => {
      const dx = c.target[0] - c.p[0], dz = c.target[2] - c.p[2], l = Math.hypot(dx, dz) || 1;
      return [dx / l, dz / l];
    })() : [Math.cos(c.yaw), Math.sin(c.yaw)]);
    // `heading` here is the body's MOMENTUM, like evadeKeep — how the dribble model decides how hard a
    // touch may be. It read the facing, which was the drift until the carrier started facing his ball;
    // after that, heading and `want` became the same vector and every touch went full strength straight
    // down the push, so the ball simply outran a man capped at 4.2 m/s (`carry-reach` 0.4 % → 8.8 % of
    // carry frames with the ball beyond 3 m). Two consumers of yaw, one meaning changed, both to fix.
    const csp = Math.hypot(c.v[0], c.v[1]);
    const heading = csp > 0.4 ? [c.v[0] / csp, c.v[1] / csp] : [Math.cos(c.yaw), Math.sin(c.yaw)];
    const pl = { p: [c.p[0], c.p[2]], speed: c.speed, heading, want, turnRate: 0 };
    pl.heading = dribbleSteer(st.ball, pl);
    dribbleStep(st._drb, st.ball, pl, dt);

    trySlide(st, cfg);                       // a touch that got away can be taken off him
    if (st.phase !== 'carry') return st;      // …and if it was, the phase has already changed
    st.hold += dt;
    // pressure: a defender in the tackle zone long enough wins it
    // A tackle needs the defender ON the carrier. Requiring him to also get NEARER THE BALL than the
    // shielding body was tried — it is the right football idea, and it made tackles so rare that the
    // carrier dribbled until the ball left the box: record 0. The shielding model needs a tackle model
    // built for it, and that is a bigger piece of work than a tighter condition here.
    const press = st.players.filter((p) => p.team !== c.team && d2(p.p, c.p) < cfg.tackleRadius);
    st.pressure = press.length ? st.pressure + dt : 0;
    if (st.pressure >= cfg.tackleTime) { receive(st, press[0].id, cfg); return st; }
    // release — but only off a ball the foot can actually reach. Striking a ball 2.8 m away was 17 %
    // of passes; the ball is not in front of him and the leg has nothing to hit.
    const reachNow = d2(c.p, st.ball.p) <= cfg.strikeReach;
    if (st.hold >= cfg.holdMin && reachNow) {
      const choice = choosePass(st, cfg);
      if (choice && (choice.score > 3.2 || st.hold >= cfg.holdMax)) playPass(st, choice, cfg);
      else if (st.hold >= cfg.holdMax && choice) playPass(st, choice, cfg);
    }
  } else {
    stepBall(st.ball, dt);
    st._drb = null;
    // first player within reach takes it — defenders included: that is the interception.
    // BUT the ball must have LEFT the passer first: for the first metres it is still at his feet,
    // and without this he is the closest player to it and "intercepts" his own pass 0.02 s after
    // striking it (measured: every single pass ended that way).
    const gone = st.pass ? Math.hypot(st.ball.p[0] - st.pass.origin[0], st.ball.p[2] - st.pass.origin[1]) : 99;
    let taker = -1, bestD = Infinity;
    if (gone > cfg.releaseClear) {
      for (const p of st.players) {
        const d = d2(p.p, st.ball.p);
        if (d < cfg.receiveRadius && st.ball.p[1] < 1.9 && d < bestD) { bestD = d; taker = p.id; }
      }
    }
    if (taker >= 0) receive(st, taker, cfg);
  }
  // OUT OF PLAY IS A RULE OF THE BALL, NOT OF A PHASE. This test only ran while the ball was loose or
  // in flight, so a ball dribbled over the line simply stayed out — and once the carrier began pushing
  // the ball ahead of himself, that is exactly what happened: the catalogue caught it as `ball-in-play`
  // on seeds where a carry ran into the corner. The line does not care who has it.
  if (Math.abs(st.ball.p[0]) > st.area[0] / 2 || Math.abs(st.ball.p[2]) > st.area[1] / 2) {
    const other = st.players.filter((p) => p.team !== st.possession.team && p.down <= 0)
      .sort((a, b) => d2(a.p, st.ball.p) - d2(b.p, st.ball.p))[0];
    st.ball.p = [Math.max(-st.area[0] / 2 + 1, Math.min(st.area[0] / 2 - 1, st.ball.p[0])), BALL.radius,
      Math.max(-st.area[1] / 2 + 1, Math.min(st.area[1] / 2 - 1, st.ball.p[2]))];
    st.ball.v = [0, 0, 0]; st.ball.w = [0, 0, 0];
    if (other) turnover(st, other.id, 'out');
  }
  return st;
}

/** Run the game for `seconds` and return the state plus a sampled trace for the contract. */
export function playRondo(st, seconds, { dt = 1 / 60, cfg = RONDO, sample = 6 } = {}) {
  const trace = [];
  const n = Math.round(seconds / dt);
  let lastTO = st.turnovers, since = 0;
  for (let i = 0; i < n; i++) {
    rondoStep(st, dt, cfg);
    if (st.turnovers !== lastTO) { lastTO = st.turnovers; since = 0; } else since += dt;
    if (i % sample === 0) {
      trace.push({
        t: +st.t.toFixed(2), phase: st.phase, team: st.possession.team, passes: st.passes, since: +since.toFixed(2), carrier: st.possession.carrier,
        ball: [+st.ball.p[0].toFixed(2), +st.ball.p[1].toFixed(2), +st.ball.p[2].toFixed(2)],
        players: st.players.map((p) => ({ id: p.id, team: p.team, job: p.job, p: [+p.p[0].toFixed(2), +p.p[2].toFixed(2)], speed: +p.speed.toFixed(2), yaw: +p.yaw.toFixed(3) })),
      });
    }
  }
  return { st, trace };
}

/**
 * Contract for a possession game. Written against what makes AI football look stupid:
 * the beehive, a defence that never wins the ball, an attack that never completes a pass,
 * players teleporting, and the ball leaving the world.
 */
export function checkRondo(st, trace, cfg = RONDO) {
  const issues = [];
  if (!trace.length) return { ok: false, issues: ['trace vide'] };

  // 1. the ball stays in the world and on the deck
  for (const s of trace) {
    if (!s.ball.every(Number.isFinite)) { issues.push('ballon non fini'); break; }
    if (Math.abs(s.ball[0]) > st.area[0] / 2 + 2 || Math.abs(s.ball[2]) > st.area[1] / 2 + 2) { issues.push(`ballon hors du carré (${s.ball[0]}, ${s.ball[2]})`); break; }
    if (s.ball[1] < BALL.radius - 0.05) { issues.push('ballon sous la pelouse'); break; }
  }
  // 2. NO BEEHIVE: never more than 3 defenders inside 3.5 m of the ball. Judged on SETTLED
  // possession only — a team that just won the ball by pressing is bunched by definition, and
  // scoring that instant measures the tackle, not the shape.
  // measured in TIME, not as a snapshot maximum: four defenders converging for the instant a pass
  // is received is correct football, and a peak count cannot tell that apart from a real beehive.
  // A genuine beehive is permanent — the sabotage below sits at 100%.
  const settled = trace.filter((s) => (s.since ?? 99) > 1.5);
  // The swarm radius is a FRACTION OF THE BOX, not a fixed 3.5 m. Third time this session that a
  // metric, not the system, was the thing that was wrong: in a real rondo box (12–16 m) four defenders
  // within 3.5 m of the ball is the DEFINITION of the exercise, not a defect, and an absolute radius
  // called it a beehive 39% of the time. Scaled to the box, the same rule keeps its meaning at any size.
  const swarmR = Math.min(3.5, cfg.swarmFrac * Math.min(st.area[0], st.area[1]));
  const nearCount = (s) => s.players.filter((p) => p.team !== s.team && Math.hypot(p.p[0] - s.ball[0], p.p[1] - s.ball[2]) < swarmR).length;
  const crowded = settled.filter((s) => nearCount(s) > 3).length;
  const allIn = settled.filter((s) => nearCount(s) > 4).length;
  const worstSwarm = settled.length ? Math.max(...settled.map(nearCount)) : 0;
  const crowdPct = settled.length ? crowded / settled.length : 0;
  const allInPct = settled.length ? allIn / settled.length : 0;
  if (crowdPct > 0.25) issues.push(`ESSAIM : plus de 3 défenseurs collés au ballon ${(crowdPct * 100).toFixed(0)}% du temps`);
  if (allInPct > 0.08) issues.push(`ESSAIM : toute la défense sur le ballon ${(allInPct * 100).toFixed(0)}% du temps`);
  // 3. the team in possession stays SPREAD (mean pairwise distance)
  let minSpread = Infinity;
  for (const s of settled) {
    const team = s.players.filter((p) => p.team === s.team);
    let sum = 0, k = 0;
    for (let i = 0; i < team.length; i++) for (let j = i + 1; j < team.length; j++) { sum += Math.hypot(team[i].p[0] - team[j].p[0], team[i].p[1] - team[j].p[1]); k++; }
    if (k) minSpread = Math.min(minSpread, sum / k);
  }
  // …and the same for spread: 5 m was written against a 26 m box. Both thresholds were absolute metres
  // fitted to one box size, which is why the grid could never be tightened without the contract
  // screaming — and a rondo played in a 34 x 26 m square is why the ball reads as far from everyone.
  const spreadMin = cfg.spreadFrac * Math.min(st.area[0], st.area[1]);
  if (settled.length && minSpread < spreadMin) issues.push(`bloc trop compact en possession installée (écartement moyen ${minSpread.toFixed(1)} m < ${spreadMin.toFixed(1)})`);
  // 4. nobody teleports
  const top = Math.max(...Object.values(cfg.speeds)) + 1.5;
  for (const s of trace) for (const p of s.players) if (p.speed > top) { issues.push(`joueur ${p.id} à ${p.speed} m/s (> ${top.toFixed(1)})`); break; }
  // 5. the game actually plays: passes complete AND the defence wins it back
  if (st.best < 3) issues.push(`l'attaque n'enchaîne pas (record ${st.best} passes)`);
  if (st.turnovers < 1) issues.push('la défense ne récupère jamais le ballon');
  // 6. both teams get to play
  const teams = new Set(trace.map((s) => s.team));
  if (teams.size < 2) issues.push('une seule équipe a eu le ballon');
  // 7. THE CARRIER IS NOT GLUED TO A DEFENDER. The crowd clauses count HOW MANY defenders are near the
  //    ball, which a carrier being permanently harried does not trip — one man on him is not a crowd.
  //    But that is exactly what reads as an anthill from the outside, and it was invisible: every
  //    variant of the carry, good and bad, passed the contract. Measured as the share of carry time
  //    with a defender inside tackle range: 50% before players had momentum, 30% after, 100% for the
  //    sabotage. The threshold catches the pathology, not the tuning.
  // Measured against the CARRIER'S BODY, not against the ball. They used to be the same point; they
  // are not any more, now that he shields the ball from behind it — and a defender arriving at the
  // ball with a body in the way is good football, not an anthill. The clause is named "glued to the
  // carrier", so it measures the carrier. (Fourth time this scene that a metric, not the system, was
  // the thing that needed fixing — the tell each time is a clause whose name and whose arithmetic
  // have quietly drifted apart.)
  const carry = trace.filter((s) => s.phase === 'carry' && s.carrier >= 0);
  const harried = carry.filter((s) => {
    const c = s.players.find((p) => p.id === s.carrier);
    if (!c) return false;
    const mine = Math.hypot(c.p[0] - s.ball[0], c.p[1] - s.ball[2]);
    // …and BEATEN, not merely close. A defender touch-tight behind a man who is shielding the ball is
    // normal football; what is not normal is a defender permanently between the carrier and his ball.
    return s.players.some((p) => p.team !== s.team
      && Math.hypot(p.p[0] - c.p[0], p.p[1] - c.p[1]) < cfg.tackleRadius
      && Math.hypot(p.p[0] - s.ball[0], p.p[1] - s.ball[2]) < mine);
  }).length;
  const harriedPct = carry.length ? harried / carry.length : 0;
  if (carry.length > 30 && harriedPct > cfg.harriedMax) issues.push(`le porteur est collé par un défenseur ${(harriedPct * 100).toFixed(0)}% du temps de conduite — il ne s'échappe jamais`);

  // 8. jobs are distributed, not everyone on the same task
  const jobs = new Set(trace[Math.floor(trace.length / 2)].players.map((p) => p.job));
  if (jobs.size < 3) issues.push(`rôles indifférenciés (${[...jobs].join(',')})`);

  // 9. THE TEAM IN POSSESSION OCCUPIES THE GRID. Clause 3 measures mean pairwise distance, which a
  //    RING and a LINE score identically — and it stayed green while the possession team spanned 15 %
  //    of the box, i.e. while the thing looked like an anthill on screen. Area is what "occupying the
  //    space" actually means: five men holding a shape have a convex hull, five men in a knot do not.
  //    (Fifth time this scene that a green clause and a broken picture disagreed, and every time the
  //    clause was measuring a proxy rather than the thing it was named after.)
  const occ = settled.map((s) => hullArea(s.players.filter((p) => p.team === s.team).map((p) => p.p)));
  const occupy = occ.length ? occ.reduce((a, b) => a + b, 0) / occ.length / (st.area[0] * st.area[1]) : 1;
  if (settled.length > 60 && occupy < cfg.occupyMin) {
    issues.push(`bloc recroquevillé : l'équipe en possession n'occupe que ${(occupy * 100).toFixed(0)} % du carré (< ${(cfg.occupyMin * 100).toFixed(0)} %)`);
  }

  return {
    ok: issues.length === 0, issues,
    stats: { best: st.best, turnovers: st.turnovers, swarm: worstSwarm, crowdPct: +(crowdPct * 100).toFixed(1), spread: +minSpread.toFixed(1), settled: settled.length, harried: +(harriedPct * 100).toFixed(0), occupy: +(occupy * 100).toFixed(1) },
  };
}

/** Convex-hull area of a set of [x, z] (monotone chain). The shape metric clause 3 cannot see. */
function hullArea(pts) {
  const p = pts.map((q) => [q[0], q[1]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return 0;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
  const h = lo.slice(0, -1).concat(hi.slice(0, -1));
  let s = 0;
  for (let i = 0; i < h.length; i++) { const a = h[i], b = h[(i + 1) % h.length]; s += a[0] * b[1] - b[0] * a[1]; }
  return Math.abs(s) / 2;
}

export { predictPath };
