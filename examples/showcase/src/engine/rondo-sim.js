import { BALL, stepBall, kick } from './ball.js';
import { predictPath } from './ball-predict.js';
import { solvePass } from './ball-predict.js';
import { makeDribbler, dribbleStep, dribbleSteer } from './dribble.js';
import { RONDO, assignJobs, choosePass, strikingFoot, rondoInternals } from './rondo.js';

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
  c.foot = strikingFoot(c.yaw, c.p, choice.lead);
  const s = kick(from, { speed: sol.speed, dirYaw: sol.dirYaw, elevation: sol.elevation, spinAxis: [0, 1, 0], spinRev: 0 });
  st.ball.p = s.p; st.ball.v = s.v; st.ball.w = s.w;
  st.phase = 'flight';
  st.pass = { from: c.id, to: choice.to.id, lead: choice.lead, style: choice.style, t: st.t, flight: sol.flightTime, error: sol.error, origin: [from[0], from[2]] };
  st.lastPasser = c.id;
  st.possession.carrier = -1;
  st.hold = 0; st.pressure = 0;
  // record the clearance the DECISION actually saw: a harness that re-measures it a frame later
  // is judging a different geometry (both the defenders and the ball have moved since)
  st.events.push({ t: +st.t.toFixed(2), type: 'pass', from: c.id, to: choice.to.id, style: choice.style, foot: c.foot, margin: +choice.lane.margin.toFixed(2) });
  return true;
}

/**
 * Give the ball to `id`. A team-mate taking it keeps possession — only the INTENDED receiver
 * scores the pass; anyone else on the same shirt is a scuffed ball that stayed in the family.
 * An opponent taking it is the turnover.
 */
function receive(st, id) {
  const p = st.players[id];
  if (p.team === st.possession.team) {
    if (st.pass && st.pass.to === id) {
      st.passes++; st.best = Math.max(st.best, st.passes);
      st.events.push({ t: +st.t.toFixed(2), type: 'receive', by: id, count: st.passes });
    } else st.events.push({ t: +st.t.toFixed(2), type: 'loose-kept', by: id });
    st.possession.carrier = id; st.phase = 'carry'; st.pass = null;
    st.hold = 0; st.pressure = 0;
    st.ball.v = [st.ball.v[0] * 0.12, 0, st.ball.v[2] * 0.12];   // first touch kills the pace
  } else {
    turnover(st, id, st.phase === 'flight' ? 'interception' : 'tackle');
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
    const want = c.target ? (() => {
      const dx = c.target[0] - c.p[0], dz = c.target[2] - c.p[2], l = Math.hypot(dx, dz) || 1;
      return [dx / l, dz / l];
    })() : [Math.cos(c.yaw), Math.sin(c.yaw)];
    const pl = { p: [c.p[0], c.p[2]], speed: c.speed, heading: [Math.cos(c.yaw), Math.sin(c.yaw)], want, turnRate: 0 };
    pl.heading = dribbleSteer(st.ball, pl);
    dribbleStep(st._drb, st.ball, pl, dt);

    st.hold += dt;
    // pressure: a defender in the tackle zone long enough wins it
    const press = st.players.filter((p) => p.team !== c.team && d2(p.p, c.p) < cfg.tackleRadius);
    st.pressure = press.length ? st.pressure + dt : 0;
    if (st.pressure >= cfg.tackleTime) { receive(st, press[0].id); return st; }
    // release
    if (st.hold >= cfg.holdMin) {
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
    if (taker >= 0) receive(st, taker);
    else if (Math.abs(st.ball.p[0]) > st.area[0] / 2 || Math.abs(st.ball.p[2]) > st.area[1] / 2) {
      // out of the grid: the other team restarts with it (a real rondo rule)
      const other = st.players.filter((p) => p.team !== st.possession.team)
        .sort((a, b) => d2(a.p, st.ball.p) - d2(b.p, st.ball.p))[0];
      st.ball.p = [Math.max(-st.area[0] / 2 + 1, Math.min(st.area[0] / 2 - 1, st.ball.p[0])), BALL.radius,
        Math.max(-st.area[1] / 2 + 1, Math.min(st.area[1] / 2 - 1, st.ball.p[2]))];
      turnover(st, other.id, 'out');
    }
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
        t: +st.t.toFixed(2), phase: st.phase, team: st.possession.team, passes: st.passes, since: +since.toFixed(2),
        ball: [+st.ball.p[0].toFixed(2), +st.ball.p[1].toFixed(2), +st.ball.p[2].toFixed(2)],
        players: st.players.map((p) => ({ id: p.id, team: p.team, job: p.job, p: [+p.p[0].toFixed(2), +p.p[2].toFixed(2)], speed: +p.speed.toFixed(2) })),
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
  const nearCount = (s) => s.players.filter((p) => p.team !== s.team && Math.hypot(p.p[0] - s.ball[0], p.p[1] - s.ball[2]) < 3.5).length;
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
  if (settled.length && minSpread < 5) issues.push(`bloc trop compact en possession installée (écartement moyen ${minSpread.toFixed(1)} m)`);
  // 4. nobody teleports
  const top = Math.max(...Object.values(cfg.speeds)) + 1.5;
  for (const s of trace) for (const p of s.players) if (p.speed > top) { issues.push(`joueur ${p.id} à ${p.speed} m/s (> ${top.toFixed(1)})`); break; }
  // 5. the game actually plays: passes complete AND the defence wins it back
  if (st.best < 3) issues.push(`l'attaque n'enchaîne pas (record ${st.best} passes)`);
  if (st.turnovers < 1) issues.push('la défense ne récupère jamais le ballon');
  // 6. both teams get to play
  const teams = new Set(trace.map((s) => s.team));
  if (teams.size < 2) issues.push('une seule équipe a eu le ballon');
  // 7. jobs are distributed, not everyone on the same task
  const jobs = new Set(trace[Math.floor(trace.length / 2)].players.map((p) => p.job));
  if (jobs.size < 3) issues.push(`rôles indifférenciés (${[...jobs].join(',')})`);

  return {
    ok: issues.length === 0, issues,
    stats: { best: st.best, turnovers: st.turnovers, swarm: worstSwarm, crowdPct: +(crowdPct * 100).toFixed(1), spread: +minSpread.toFixed(1), settled: settled.length },
  };
}

export { predictPath };
