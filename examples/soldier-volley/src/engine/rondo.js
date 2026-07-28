import { BALL } from './ball.js';
import { predictPath, solvePass, laneClearance, interceptPoint, PASS_STYLE } from './ball-predict.js';

// rondo — the brain of a "passe à dix": 5 v 5, the team in possession strings passes, the team out
// of possession hunts the ball. Dependency-free (ball.js + ball-predict.js only) and fully
// simulatable headless, so the whole game can be proved in node before a single triangle is drawn.
//
// The design fights the two classic failures of AI football:
//   THE BEEHIVE — every player converging on the ball. Cured by giving each off-ball player an
//   explicit JOB (support angle / presser / cover / marker) and scoring positions, never by
//   pointing everyone at the ball.
//   THE HOPEFUL PASS — a ball hit at a covered team-mate. Cured by scoring lanes with real
//   clearance geometry and by INVERSE BALLISTICS, so the chosen pass actually arrives.

export const RONDO = {
  area: [34, 26],          // m — the grid the game is played in (x, z half-extents ×2)
  supportMin: 6.5,         // m — closer than this and you clog the carrier
  supportMax: 13.5,        // m — further and the lane is too long to defend
  passRange: [4, 20],      // m — receivable pass distance
  corridor: 1.25,          // m — a defender inside this of the line blocks the lane
  pressRadius: 9,          // m — inside this the presser commits to the carrier
  tackleRadius: 1.45,      // m
  tackleTime: 0.5,         // s of sustained pressure to win the ball
  receiveRadius: 1.25,     // m — the receiver takes the ball
  releaseClear: 1.8,       // m the ball must travel before ANYONE can take it (else the passer intercepts himself)
  holdMin: 0.35,           // s — minimum on the ball before passing (no hot-potato)
  holdMax: 2.4,            // s — forced to release (no dwelling)
  speeds: { press: 6.6, support: 5.4, carry: 4.2, chase: 6.9 },
  accel: 9.5,              // m/s²
};

const d2 = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

/** Build the opening position: two teams of `perTeam`, ring formation, ball on team 0. */
export function makeRondo({ perTeam = 5, seed = 1, area = RONDO.area } = {}) {
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const players = [];
  for (let t = 0; t < 2; t++) {
    for (let i = 0; i < perTeam; i++) {
      const a = (i / perTeam) * Math.PI * 2 + (t ? Math.PI / perTeam : 0);
      const r = t === 0 ? area[0] * 0.34 : area[0] * 0.19;
      players.push({
        team: t, id: players.length,
        p: [Math.cos(a) * r + (rnd() - 0.5), 0, Math.sin(a) * r * 0.8 + (rnd() - 0.5)],
        v: [0, 0], speed: 0, yaw: a + Math.PI, job: 'support', target: null, foot: 'right',
      });
    }
  }
  const carrier = 0;
  return {
    t: 0, players, area,
    ball: { p: [players[carrier].p[0] + 0.6, BALL.radius, players[carrier].p[2]], v: [0, 0, 0], w: [0, 0, 0] },
    possession: { team: 0, carrier }, hold: 0, pressure: 0,
    passes: 0, best: 0, turnovers: 0,
    phase: 'carry', pass: null, lastPasser: -1, events: [],
  };
}

const mates = (st, team) => st.players.filter((p) => p.team === team);
const foes = (st, team) => st.players.filter((p) => p.team !== team);

/** Which foot should strike, given where the player faces and where the ball must go. */
export function strikingFoot(yaw, from, to) {
  const side = Math.cos(yaw) * (to[2] - from[2]) - Math.sin(yaw) * (to[0] - from[0]);
  return side > 0 ? 'right' : 'left';
}

/**
 * Score every available pass and return the best. This is where possession is kept or lost:
 * an open lane, a receiver who is not under pressure, a sane distance, and a change of angle
 * that drags the press out of shape.
 */
export function choosePass(st, cfg = RONDO) {
  const c = st.players[st.possession.carrier];
  if (!c) return null;
  const opp = foes(st, c.team).map((p) => p.p);
  // the pass leaves the BALL, not the player's navel — the dribbler carries it a metre or two
  // ahead, and judging the lane from his hips is how a "clear" pass hits a defender's shin
  const origin = [st.ball.p[0], BALL.radius, st.ball.p[2]];
  let best = null;
  for (const m of mates(st, c.team)) {
    if (m.id === c.id) continue;
    const d = d2(origin, m.p);
    if (d < cfg.passRange[0] || d > cfg.passRange[1]) continue;
    // aim slightly in front of the receiver so he runs onto it rather than waiting for it
    const lead = [m.p[0] + m.v[0] * 0.28, BALL.radius, m.p[2] + m.v[1] * 0.28];
    const lane = laneClearance(origin, lead, opp, { corridor: cfg.corridor });
    const recvPressure = Math.min(...opp.map((o) => d2(o, m.p)), 99);
    // a lofted ball beats a blocked lane, at the cost of being slower and harder to control
    const style = lane.open ? (d > 13 ? 'driven' : 'ground') : (lane.margin > 0.5 ? 'driven' : 'lofted');
    const blocked = !lane.open && style !== 'lofted';
    if (blocked) continue;
    const score =
      Math.min(lane.margin, 4) * 2.4                       // clearance is king
      + Math.min(recvPressure, 9) * 1.15                    // pass to the free man
      - Math.abs(d - 10) * 0.32                             // 10 m is the sweet spot
      - (m.id === st.lastPasser ? 2.6 : 0)                  // don't ping-pong
      - (style === 'lofted' ? 2.2 : 0);                     // ground ball whenever possible
    if (!best || score > best.score) best = { to: m, lead, style, score, lane, dist: d };
  }
  return best;
}

/**
 * The best place for an off-ball team-mate to offer himself, sampled and scored around `anchor`
 * (the carrier, or the BALL while a pass is in flight — there is no carrier during those seconds
 * and everyone still has to keep moving).
 */
function supportSpot(st, me, cfg, anchor, carrierId, { sector = 0, claimed = [] } = {}) {
  const opp = foes(st, me.team).map((p) => p.p);
  // .map(p => p.p): these must be POSITIONS. Holding player objects here made every distance NaN,
  // and since `NaN > NaN` is false the "best" candidate never updated — every supporter silently
  // kept the FIRST candidate in the list, i.e. the same point. That is how a whole team collapses
  // onto one spot with no error anywhere. Guard the score below so it can never happen quietly.
  const others = mates(st, me.team).filter((p) => p.id !== me.id && p.id !== carrierId).map((p) => p.p);
  const [ax, az] = st.area;
  let best = null;
  for (let ring = 0; ring < 3; ring++) {
    const r = cfg.supportMin + (cfg.supportMax - cfg.supportMin) * (ring / 2);
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      const p = [anchor[0] + Math.cos(a) * r, 0, anchor[2] + Math.sin(a) * r];
      if (Math.abs(p[0]) > ax / 2 - 1.2 || Math.abs(p[2]) > az / 2 - 1.2) continue;   // stay in the grid
      const lane = laneClearance(anchor, p, opp, { corridor: cfg.corridor });
      const nearFoe = Math.min(...opp.map((o) => d2(o, p)), 99);
      const nearMate = Math.min(...others.map((o) => d2(o, p)), 99);
      const nearClaim = Math.min(...claimed.map((c) => d2(c, p)), 99);
      const travel = d2(me.p, p);
      const score =
        Math.min(lane.margin, 4) * 2.2                      // show for a clean lane
        + Math.min(nearFoe, 8) * 0.95                       // get away from your marker
        + Math.min(nearMate, 10) * 0.7                      // spread: don't stand on a team-mate
        + Math.cos(a - sector) * 7.5                        // hold YOUR angle of the rondo — this IS the shape,
        //                                                    and it must outweigh the convenience of standing still
        + Math.min(nearClaim, 7) * 1.5                      // and never the spot a mate just claimed
        - travel * 0.22;                                    // mild: prefer the nearer of two equally good spots
      if (!Number.isFinite(score)) throw new Error('supportSpot: score non fini (positions corrompues)');
      if (!best || score > best.score) best = { p, score };
    }
  }
  return best ? best.p : [...me.p];
}

/** Assign every player a job and a target. This is the anti-beehive layer. */
export function assignJobs(st, cfg = RONDO) {
  const car = st.players[st.possession.carrier];
  const atkTeam = st.possession.team;
  // The predicted path costs ~100 ball integrations. Recomputing it every frame is the single
  // hottest thing in the game loop and buys nothing: a pass takes ~1 s and the prediction barely
  // moves between frames. Refresh it ~8×/s, and always when a new pass starts.
  let path = null;
  if (st.phase === 'flight') {
    if (!st._path || st._pathAt !== st.pass || st.t - st._pathT > 0.12) {
      st._path = predictPath(st.ball, { dt: 1 / 45, maxT: 2.2 });
      st._pathT = st.t; st._pathAt = st.pass;
    }
    path = st._path;
  } else { st._path = null; }
  // While the ball is travelling there is no carrier, so everything anchors on the ball. (Shifting
  // the whole defence onto the INCOMING RECEIVER instead was tried and measured worse: the press
  // arrives with the ball and possession collapses — 4 passes per sequence instead of 7.)
  const anchor = car ? car.p : st.ball.p;
  const carrierId = car ? car.id : -1;

  // supporters are assigned ONE AT A TIME, each holding its own angle of the rondo and avoiding the
  // spots its team-mates just claimed. Scoring them all independently in the same frame makes every
  // player pick the same "best" spot and the whole team collapses onto one point (measured: 0.6 m
  // of spread), which in turn drags all five defenders onto the ball.
  const supporters = mates(st, atkTeam).filter((p) => p.id !== carrierId);
  const claimed = [];
  // Sectors are handed out BY CURRENT ANGLE, not by shirt number. Assigning slot i to player i
  // makes players criss-cross the middle to reach a slot on the far side — and the middle is where
  // the ball is, so the whole team keeps funnelling past it. Sorting by angle and rotating the
  // whole ring to the best fit means nobody ever has to cross.
  const ring = supporters
    .map((p) => ({ p, a: Math.atan2(p.p[2] - anchor[2], p.p[0] - anchor[0]) }))
    .sort((x, y) => x.a - y.a);
  let sx = 0, sz = 0;
  ring.forEach((e, i) => { const b = (i / Math.max(1, ring.length)) * Math.PI * 2; sx += Math.cos(e.a - b); sz += Math.sin(e.a - b); });
  const offset = Math.atan2(sz, sx);                         // rotate the ring onto the team as it stands
  const sectorOf = new Map(ring.map((e, i) => [e.p.id, (i / Math.max(1, ring.length)) * Math.PI * 2 + offset]));

  for (const p of st.players) {
    if (p.team === atkTeam) {
      if (car && p.id === car.id) {
        // the carrier does not stand still: he drifts off the presser's shoulder into space,
        // which is what buys the extra half-second the pass needs
        p.job = 'carry';
        const near = foes(st, atkTeam).reduce((b, o) => (d2(o.p, car.p) < d2(b.p, car.p) ? o : b), foes(st, atkTeam)[0]);
        if (near && d2(near.p, car.p) < cfg.pressRadius) {
          const ax2 = st.area[0] / 2 - 1.5, az2 = st.area[1] / 2 - 1.5;
          const ex = car.p[0] - near.p[0], ez = car.p[2] - near.p[2];
          const l = Math.hypot(ex, ez) || 1;
          p.target = [clamp(car.p[0] + (ex / l) * 3.5, -ax2, ax2), 0, clamp(car.p[2] + (ez / l) * 3.5, -az2, az2)];
        } else p.target = null;
        continue;
      }
      // the intended receiver runs onto the ball; everyone else offers an angle
      if (path && st.pass && st.pass.to === p.id) {
        p.job = 'receive';
        const i = interceptPoint(path, p.p, cfg.speeds.chase, { reaction: 0 });
        p.target = i ? [i.p[0], 0, i.p[2]] : [st.pass.lead[0], 0, st.pass.lead[2]];
      } else {
        p.job = 'support';
        const sector = sectorOf.get(p.id) ?? 0;
        p.target = supportSpot(st, p, cfg, anchor, carrierId, { sector, claimed });
        claimed.push(p.target);
      }
    } else {
      p.job = 'mark'; p.target = null;
    }
  }

  // --- defending team: one presser, one cover, the rest mark the best options
  const def = foes(st, atkTeam);
  if (path) {
    // ball in flight: anyone who can legally get there goes for it — that is the interception
    let bestI = null;
    for (const p of def) {
      const i = interceptPoint(path, p.p, cfg.speeds.chase);
      if (i && (!bestI || i.slack > bestI.i.slack)) bestI = { p, i };
    }
    if (bestI) { bestI.p.job = 'intercept'; bestI.p.target = [bestI.i.p[0], 0, bestI.i.p[2]]; }
  }
  {
    const rest = def.filter((p) => p.job !== 'intercept').sort((a, b) => d2(a.p, anchor) - d2(b.p, anchor));
    if (rest[0]) {
      rest[0].job = 'press';
      // close the ball down, arriving on the touch-line side to cut the field in half
      rest[0].target = [anchor[0] + (anchor[0] > 0 ? 0.7 : -0.7), 0, anchor[2]];
    }
    // cover: stand in the single most dangerous lane
    const options = mates(st, atkTeam).filter((m) => m.id !== carrierId)
      .map((m) => ({ m, margin: laneClearance(anchor, m.p, def.map((d) => d.p), { corridor: cfg.corridor }).margin }))
      .sort((a, b) => b.margin - a.margin);
    if (rest[1] && options[0]) {
      rest[1].job = 'cover';
      const m = options[0].m;
      rest[1].target = [anchor[0] + (m.p[0] - anchor[0]) * 0.42, 0, anchor[2] + (m.p[2] - anchor[2]) * 0.42];
    }
    // markers: goal-side of their man, shading the lane
    for (let i = 2; i < rest.length; i++) {
      const m = options[i - 1]?.m || options[options.length - 1]?.m;
      if (!m) { rest[i].target = [...rest[i].p]; continue; }
      rest[i].job = 'mark';
      const mx = anchor[0] - m.p[0], mz = anchor[2] - m.p[2];
      const ml = Math.hypot(mx, mz) || 1;
      const step = Math.min(2.2, ml * 0.3);                     // a step goal-side of your man…
      rest[i].target = [m.p[0] + (mx / ml) * step, 0, m.p[2] + (mz / ml) * step];   // …not a walk to the ball
    }
  }
  return st;
}

/** Move every player toward their target with real acceleration limits. */
function movePlayers(st, dt, cfg) {
  for (const p of st.players) {
    const top = cfg.speeds[p.job === 'press' || p.job === 'intercept' || p.job === 'receive' ? 'chase'
      : p.job === 'carry' ? 'carry' : p.job === 'cover' ? 'press' : 'support'] ?? cfg.speeds.support;
    let wx = 0, wz = 0;
    if (p.target) {
      const dx = p.target[0] - p.p[0], dz = p.target[2] - p.p[2];
      const d = Math.hypot(dx, dz);
      if (d > 0.18) { const s = Math.min(top, d * 2.6); wx = (dx / d) * s; wz = (dz / d) * s; }
    }
    const ax = clamp(wx - p.v[0], -cfg.accel * dt, cfg.accel * dt);
    const az = clamp(wz - p.v[1], -cfg.accel * dt, cfg.accel * dt);
    p.v[0] += ax; p.v[1] += az;
    p.p[0] += p.v[0] * dt; p.p[2] += p.v[1] * dt;
    p.p[0] = clamp(p.p[0], -st.area[0] / 2, st.area[0] / 2);
    p.p[2] = clamp(p.p[2], -st.area[1] / 2, st.area[1] / 2);
    p.speed = Math.hypot(p.v[0], p.v[1]);
    if (p.speed > 0.25) p.yaw = Math.atan2(p.v[1], p.v[0]);
  }
}

/** Hand the ball to `team` at `carrier` — the turnover, and the moment the score resets. */
function turnover(st, carrier, why) {
  st.turnovers++;
  st.best = Math.max(st.best, st.passes);
  st.events.push({ t: +st.t.toFixed(2), type: 'turnover', why, to: st.players[carrier].team, after: st.passes });
  st.passes = 0;
  st.possession = { team: st.players[carrier].team, carrier };
  st.phase = 'carry'; st.pass = null; st.hold = 0; st.pressure = 0; st.lastPasser = -1;
  st.ball.v = [0, 0, 0]; st.ball.w = [0, 0, 0];
}

export { predictPath };
export const rondoInternals = { supportSpot, movePlayers, turnover };
