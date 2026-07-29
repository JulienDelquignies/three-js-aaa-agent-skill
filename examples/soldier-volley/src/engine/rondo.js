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
  // A RONDO IS A SMALL BOX. This was 34 x 26 m, which is a five-a-side PITCH, not a rondo — and that
  // single number is why the ball read as far from everyone: at that size the supports stand 6.5–13.5 m
  // out and the ball sits a mean 5.89 m from the players. A real "passe à dix" is played in 12–16 m.
  // Measured over 3 seeds × 60 s: 34x26 → record 12, ball 5.89 m from the players; 22x18 → 13, 4.20 m;
  // 16x14 → 18, 3.44 m; 12x11 → 8, 2.86 m (too tight, the defence just wins it). 16 x 14 it is.
  area: [16, 14],          // m — the grid the game is played in (x, z half-extents ×2)
  supportMin: 4.0,         // m — closer than this and you clog the carrier
  supportMax: 7.5,         // m — further and the lane is too long to defend
  passRange: [2.5, 13],    // m — receivable pass distance
  corridor: 1.25,          // m — a defender inside this of the line blocks the lane
  pressRadius: 9,          // m — inside this the presser commits to the carrier
  tackleRadius: 1.45,      // m
  tackleTime: 0.5,         // s of sustained pressure to win the ball
  receiveRadius: 0.85,     // m — the receiver takes the ball. Was 1.25, which is BEYOND the reach of
                           // every control in the technique table (widest window 1.0 m): the touch
                           // fired while the ball was still out of reach, so it stopped a metre away.
  controlSettle: 0.34,     // m — where the ball ends up in front of the foot after a touch
  footSide: 0.11,          // m — and how far to the side of centre, on the controlling foot
  releaseClear: 1.8,       // m the ball must travel before ANYONE can take it (else the passer intercepts himself)
  holdMin: 0.35,           // s — minimum on the ball before passing (no hot-potato)
  holdMax: 2.4,            // s — forced to release (no dwelling)
  speeds: { press: 6.6, support: 5.4, carry: 4.2, chase: 6.9 },
  accel: 9.5,              // m/s² along the direction of travel
  turnAccel: 6.0,          // m/s² PERPENDICULAR to it — the angular rate is turnAccel/speed, so pace
                           // costs agility and a dribbler can turn inside a sprinting defender
  swarmFrac: 0.135,        // the beehive radius as a fraction of the box's short side (see checkRondo)
  spreadFrac: 0.19,        // minimum team spread, likewise as a fraction of the box
  harriedMax: 0.55,        // max share of carry time with a defender inside tackle range (see checkRondo)
  // OFF-BALL STATIONS (see supportSpot). stationBias pulls the support ring from the ball (0) toward
  // the middle of the grid (1) so the ring stays inside the box wherever the ball is. Swept over 16
  // seeds × 90 s: 0 → 15.8 % of the box occupied, 0.45 → 20.2 %, 0.6 → 22.2 %. 0.6 spreads the most and
  // plays the worst (completed passes 4.5 → 2.3: the men are too far apart to link). 0.45 beats the old
  // model on every axis at once — occupancy, distance-to-station, record AND completed passes.
  stationBias: 0.45,
  // How much better another spot must be before a man abandons the one he holds. Measured: every
  // non-zero value made things WORSE (at 0.6 bias, margin 9 → occupancy 24.4→22.2, passes down), so it
  // stays at 0 = ties go to the spot you already hold. Kept as a knob because the finding is worth
  // holding onto: the anthill was the ring centring, not a lack of hysteresis.
  commitMargin: 0,
  occupyMin: 0.18,        // the possession team must span at least this fraction of the box (checkRondo clause 9)
  minGap: 0.5,             // m — two players closer than this are pushed apart (they were interpenetrating)
  strikeReach: 1.25,       // m — a pass is only played off a ball the foot can reach
  shieldSlack: 0.15,       // m — how far past the shielding body a defender must get to win the ball
  slideRange: [1.0, 3.2],  // m — the window a slide tackle can reach (nearer, you just take it standing)
  slideRecovery: 1.2,      // s on the ground afterwards, won or lost: that cost is the whole decision
  slideMargin: 0.15,        // m — how much closer the opponent must be before going to ground is worth it
  slideMaxBall: 6.0,       // m/s — above this the ball is going too fast to be won by sliding at it
  carryStandoff: 0.4,      // m — how far BEHIND the ball the carrier places himself (0 = off)
  evadeAroundBall: true,   // sample the escape directions around the BALL rather than the player
  // --- carrying the ball AWAY from pressure (evadeSpot). Weights, not rules: the answer is a
  // compromise, so it is scored. `evadeKeep` is the one that turns a shuffle into a move.
  evadeStep: 1.2,          // m — how far ahead of the ball the escape point is placed
  evadeSamples: 24,        // directions sampled around the carrier
  evadeFoe: 1.0,           // weight on getting away from the CLOSEST defender at the candidate
  evadeMate: 0.35,         // …and on not running into your own supports
  evadeEdge: 0.45,         // …and on not getting pinned against the chalk
  evadeKeep: 1.1,          // …and on continuing the way you were already going
  // The LONGEST anticipation any gesture has (animkit `passePivot`, 0.52 s). Only used to know how
  // early to start asking the question — beginPass then carves the anticipation of the gesture it
  // actually picked, which is the only correct number. See the carve-out in rondo-sim.
  windupBudget: 0.55,
  rushedRadius: 3.2,       // m — inside this, speed breaks ties between gestures (see beginPass)
  rushedSlack: 0.5,        // …but only among options within this much of the best-scoring one
  windupCarve: 1,          // how much of it is taken OUT of the hold rather than added after it (0..1)
  // A TURN TAKES TIME. Bounded at turnAccel/speed rad/s like everything else that rotates here, with
  // this floor so a man standing still still turns at a human rate instead of snapping.
  turnRateMin: 4.5,        // rad/s at a standstill (~260°/s: a sharp but human pivot)
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
        down: 0,          // seconds still on the ground after a slide tackle
        push: null,       // the direction the carrier wants his ball to go
        act: null,        // the gesture in progress (gesture.js) — it owns him while it runs
        yawWant: null,    // a facing he is turning ONTO, at a bounded rate — never a snap
      });
    }
  }
  const carrier = 0;
  return {
    t: 0, players, area,
    ball: { p: [players[carrier].p[0] + 0.6, BALL.radius, players[carrier].p[2]], v: [0, 0, 0], w: [0, 0, 0] },
    possession: { team: 0, carrier }, hold: 0, pressure: 0,
    gestures: [],                    // the log every swing writes to (gesture.js) — the contract reads it
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
  // WHERE THE RING IS CENTRED. Sampling it on the ball looks right and measures wrong: when the ball
  // drifts off centre, the edge guard below rejects the whole far half of the ring, so every supporter
  // is forced onto the near side and the team folds onto the ball. Pulling the centre back toward the
  // middle of the grid keeps the ring INSIDE the box at any ball position, which is what lets five men
  // actually stand around it. (Occupancy of the box: 21% of the area with the ring on the ball.)
  const cx = anchor[0] * (1 - cfg.stationBias), cz = anchor[2] * (1 - cfg.stationBias);
  const scoreAt = (p, a) => {
    if (Math.abs(p[0]) > ax / 2 - 1.2 || Math.abs(p[2]) > az / 2 - 1.2) return -Infinity;   // stay in the grid
    const lane = laneClearance(anchor, p, opp, { corridor: cfg.corridor });
    const nearFoe = Math.min(...opp.map((o) => d2(o, p)), 99);
    const nearMate = Math.min(...others.map((o) => d2(o, p)), 99);
    const nearClaim = Math.min(...claimed.map((c) => d2(c, p)), 99);
    const s =
      Math.min(lane.margin, 4) * 2.2                        // show for a clean lane
      + Math.min(nearFoe, 8) * 0.95                         // get away from your marker
      + Math.min(nearMate, 10) * 0.7                        // spread: don't stand on a team-mate
      + Math.cos(a - sector) * 7.5                          // hold YOUR angle of the rondo — this IS the shape,
      //                                                      and it must outweigh the convenience of standing still
      + Math.min(nearClaim, 7) * 1.5                        // and never the spot a mate just claimed
      - d2(me.p, p) * 0.22;                                 // mild: prefer the nearer of two equally good spots
    if (!Number.isFinite(s) && s !== -Infinity) throw new Error('supportSpot: score non fini (positions corrompues)');
    return s;
  };
  let best = null;
  for (let ring = 0; ring < 3; ring++) {
    const r = cfg.supportMin + (cfg.supportMax - cfg.supportMin) * (ring / 2);
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      const p = [cx + Math.cos(a) * r, 0, cz + Math.sin(a) * r];
      const score = scoreAt(p, a);
      if (score === -Infinity) continue;
      if (!best || score > best.score) best = { p, score };
    }
  }

  // COMMIT TO THE STATION — hold the spot you claimed unless another is better by `commitMargin`.
  // Worth reading as a negative result: the anthill LOOKED like a hysteresis problem (a supporter sat
  // 4.46 m from his own target on average, as far from it as he was from the ball, i.e. permanently in
  // transit toward a station that had already moved). But swept, every non-zero margin measured worse.
  // The distance-to-station fell because the ring stopped moving so much, not because men stopped
  // re-deciding. Ties go to the held spot; the re-score is what stops you holding a place gone bad.
  if (me.spotTeam !== st.possession.team) me.spot = null;      // stations do not survive a turnover
  me.spotTeam = st.possession.team;
  if (me.spot) {
    const held = me.spot;
    const a = Math.atan2(held[2] - cz, held[0] - cx);
    const heldScore = scoreAt(held, a);
    if (heldScore !== -Infinity && (!best || best.score < heldScore + cfg.commitMargin)) return held;
  }
  me.spot = best ? best.p : [...me.p];
  return me.spot;
}

/**
 * WHERE TO TAKE THE BALL. The carrier used to run in a straight line directly away from the single
 * nearest defender, 3.5 m, clamped to the box. Measured, that produced a carrier turning 4.3°/s — a
 * straight line — with a defender inside 1.5 m of him HALF THE TIME, which is what an anthill feels
 * like from the outside even when the defender COUNT is fine (mean 1.28 inside the swarm radius).
 *
 * Escaping one man is not dribbling. This scores candidate directions the way supportSpot scores
 * candidate positions — the same pattern, for the same reason: the good answer is a compromise between
 * things that pull in different directions, and a compromise is what a score is for.
 *   + get away from EVERY defender, not the nearest one (their minimum, so a second man closing hurts)
 *   + stay off the box edge — being pinned against the chalk is how possession is actually lost
 *   + do not run into your own supports, they are the passing options
 *   + keep going the way you were going, a little: without it the pick flips frame to frame and reads
 *     as jitter rather than as a move. This term is the whole difference between evasion and a shuffle.
 *
 * Heading convention is THIS module's: `p.yaw = atan2(v[1], v[0])`, so forward is [cos, sin] — 90° off
 * the project-wide atan2(x, z) used by world-basis.js and the CharacterController.
 */
export function evadeSpot(st, c, cfg = RONDO) {
  const enemies = st.players.filter((p) => p.team !== c.team);
  const mates = st.players.filter((p) => p.team === c.team && p.id !== c.id);
  const hx = st.area[0] / 2, hz = st.area[1] / 2;
  // `evadeKeep` means MOMENTUM — "you are already running that way, it costs you to change" — so it
  // must read the velocity, not the facing. It used to read `c.yaw`, which was the same thing back when
  // facing was derived from the drift. It is not any more: the carrier now faces his ball, which is the
  // direction he is PUSHING it. Left on yaw, the term closed a loop — push sets the facing, the facing
  // rewards the same push — and the carrier became literally unbeatable: 63 passes and 0 turnovers on
  // seed 6, versus 19 and 15 with the loop broken. A feedback loop reads as brilliance right up until
  // you notice the defence has stopped existing.
  const sp = Math.hypot(c.v[0], c.v[1]);
  const hdx = sp > 0.4 ? c.v[0] / sp : Math.cos(c.yaw), hdz = sp > 0.4 ? c.v[1] / sp : Math.sin(c.yaw);
  // SAMPLED AROUND THE BALL, NOT AROUND THE PLAYER. Sampling around the player sends him to a point
  // the ball is not on the way to, so he walks off and leaves it behind: measured, 65 % of passes were
  // struck with the ball BEHIND the striker (bearing up to 180°) and 15 % of carry frames had an
  // opponent closer to the ball than the man supposedly carrying it. Aiming past the ball is what
  // keeps the ball between him and where he is going — which is the definition of carrying it.
  const org = cfg.evadeAroundBall ? [st.ball.p[0], 0, st.ball.p[2]] : [c.p[0], 0, c.p[2]];
  let best = null;
  for (let i = 0; i < cfg.evadeSamples; i++) {
    const a = (i / cfg.evadeSamples) * Math.PI * 2;
    const dx = Math.cos(a), dz = Math.sin(a);
    const x = org[0] + dx * cfg.evadeStep, z = org[2] + dz * cfg.evadeStep;
    if (Math.abs(x) > hx - 0.6 || Math.abs(z) > hz - 0.6) continue;      // off the chalk: not an option
    let foe = Infinity;
    for (const f of enemies) foe = Math.min(foe, Math.hypot(f.p[0] - x, f.p[2] - z));
    let mate = Infinity;
    for (const m of mates) mate = Math.min(mate, Math.hypot(m.p[0] - x, m.p[2] - z));
    const edge = Math.min(hx - Math.abs(x), hz - Math.abs(z));
    const score = foe * cfg.evadeFoe + Math.min(mate, 4) * cfg.evadeMate
      + edge * cfg.evadeEdge + (dx * hdx + dz * hdz) * cfg.evadeKeep;
    if (!Number.isFinite(score)) throw new Error('evadeSpot: score non fini (positions corrompues)');
    if (!best || score > best.score) best = { score, p: [x, 0, z] };
  }
  return best ? best.p : null;
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
  // The press attacks THE BALL, not the man. Aiming it at the carrier's body was fine while he stood
  // on top of the ball; now that he shields it from behind, a presser aimed at his body walks into his
  // back — measured as the carrier being inside tackle range 56 % of the carry, worse than before he
  // shielded at all. What a defender actually goes for is the ball.
  const anchor = st.ball.p;
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
        // A SWING PLANTS THE FEET TOO. Locking only the facing was half a lock and measurably worse:
        // `assignJobs` kept re-targeting him to stand behind a ball whose push direction was still
        // rotating, so he physically walked around his own ball while his shoulders stayed committed —
        // and the ball finished at his side or behind him, which is how a rondo ends up being played
        // with 18 backheels out of 38 passes. If the body is committed, so is where it is going.
        if (p.act) { p.job = 'carry'; p.target = [p.p[0], 0, p.p[2]]; continue; }
        // the carrier does not stand still: he drifts off the presser's shoulder into space,
        // which is what buys the extra half-second the pass needs
        p.job = 'carry';
        const near = foes(st, atkTeam).reduce((b, o) => (d2(o.p, car.p) < d2(b.p, car.p) ? o : b), foes(st, atkTeam)[0]);
        // THE CARRIER STANDS BEHIND HIS BALL. evadeSpot answers "which way should this ball go"; the
        // player's own target is then that direction taken BACKWARDS from the ball, so the ball stays
        // between him and where he is going. Sending him to the escape point itself makes him run PAST
        // the ball (measured: an opponent closer to it than him 45 % of carry frames, and 45 % of passes
        // still struck backwards). Standing off it by a boot's length is what dribbling actually is.
        const goal = near && d2(near.p, car.p) < cfg.pressRadius ? evadeSpot(st, car, cfg) : null;
        if (goal && cfg.carryStandoff > 0) {
          const gx = goal[0] - st.ball.p[0], gz = goal[2] - st.ball.p[2];
          const gl = Math.hypot(gx, gz) || 1;
          p.target = [st.ball.p[0] - (gx / gl) * cfg.carryStandoff, 0, st.ball.p[2] - (gz / gl) * cfg.carryStandoff];
          p.push = [gx / gl, gz / gl];                       // the direction the ball should be pushed
        } else { p.target = goal; p.push = null; }
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
    // a player on the ground after a slide does not run
    if (p.down > 0) { p.down -= dt; p.v[0] = 0; p.v[1] = 0; p.speed = 0; continue; }
    const top = cfg.speeds[p.job === 'press' || p.job === 'intercept' || p.job === 'receive' ? 'chase'
      : p.job === 'carry' ? 'carry' : p.job === 'cover' ? 'press' : 'support'] ?? cfg.speeds.support;
    let wx = 0, wz = 0;
    if (p.target) {
      const dx = p.target[0] - p.p[0], dz = p.target[2] - p.p[2];
      const d = Math.hypot(dx, dz);
      if (d > 0.18) { const s = Math.min(top, d * 2.6); wx = (dx / d) * s; wz = (dz / d) * s; }
    }
    // TURNING COSTS, AND THE FASTER YOU GO THE WIDER YOU TURN. Acceleration used to be isotropic:
    // 9.5 m/s² in any direction, so a defender at a full 6.6 m/s sprint could reverse as sharply as a
    // man standing still. With no momentum to beat, a feint cannot pay — which is why scoring the
    // carrier's escape direction changed nothing on its own (separation 1.67 → 1.64 m). Splitting the
    // demand into ALONG the current velocity (drive/brake) and PERPENDICULAR to it (turn), and capping
    // the perpendicular part, gives an angular rate of turnAccel/v for free: at 6.6 m/s that is 52°/s,
    // at 3 m/s it is 115°/s. The slower carrier out-turns the quicker presser — which is the actual
    // advantage a dribbler has over a defender, and now it exists in the model instead of in the prose.
    const dvx = wx - p.v[0], dvz = wz - p.v[1];
    const sp0 = Math.hypot(p.v[0], p.v[1]);
    if (sp0 > 0.4) {
      const ux = p.v[0] / sp0, uz = p.v[1] / sp0;
      const along = clamp(dvx * ux + dvz * uz, -cfg.accel * dt, cfg.accel * dt);
      let latx = dvx - (dvx * ux + dvz * uz) * ux, latz = dvz - (dvx * ux + dvz * uz) * uz;
      const lat = Math.hypot(latx, latz), cap = cfg.turnAccel * dt;
      if (lat > cap) { latx *= cap / lat; latz *= cap / lat; }
      p.v[0] += along * ux + latx; p.v[1] += along * uz + latz;
    } else {                                     // at a standstill there is no momentum to fight
      p.v[0] += clamp(dvx, -cfg.accel * dt, cfg.accel * dt);
      p.v[1] += clamp(dvz, -cfg.accel * dt, cfg.accel * dt);
    }
    p.p[0] += p.v[0] * dt; p.p[2] += p.v[1] * dt;
    p.p[0] = clamp(p.p[0], -st.area[0] / 2, st.area[0] / 2);
    p.p[2] = clamp(p.p[2], -st.area[1] / 2, st.area[1] / 2);
    p.speed = Math.hypot(p.v[0], p.v[1]);
    // A SWING OWNS THE BODY. Once he has started it, his facing is locked: he does not re-aim with his
    // drift and he does not keep turning onto a new target. Without this, the gesture gated the strike
    // on the geometry at COMMIT and then let the body rotate for the whole 0.4 s of the windup, so the
    // ball could be dead behind him by the time the boot arrived — `ball-ahead-at-strike` 16.7 %. You
    // commit your body when you commit your gesture; that IS what committing means.
    if (p.act) continue;
    if (p.speed > 0.25) p.yaw = Math.atan2(p.v[1], p.v[0]);
    // A MAN CARRYING THE BALL FACES HIS BALL — not his drift. For everyone else, facing = direction of
    // travel is right; for the carrier it is wrong, and wrong in the one place it shows. He stands
    // `carryStandoff` BEHIND the ball, so his velocity points at a spot behind it while the ball is in
    // front: derive his facing from the drift and his body ends up square to, or turned away from, the
    // thing at his feet. Measured as the share of passes struck with the ball more than 75° off his
    // shoulders — i.e. behind him — which the catalogue calls `ball-ahead-at-strike`.
    // The slew is the same law as the momentum model above (rate = turnAccel / speed), so pace still
    // costs agility: a man sprinting cannot snap his shoulders round onto the ball.
    if (p.job === 'carry') {
      p.yawWant = p.push ? Math.atan2(p.push[1], p.push[0])
        : Math.atan2(st.ball.p[2] - p.p[2], st.ball.p[0] - p.p[0]);
    }
    // A TURN TAKES TIME — this is the ONE place a facing may change, and it can only change at a
    // bounded rate. A first touch used to write `p.yaw = atan2(...)` directly: the man was simply
    // pointing somewhere else on the next frame, 180° in zero seconds. Nothing in the animation can
    // rescue that, because there is no interval to animate. Now the touch asks for a facing and he
    // turns ONTO it — which is also why he arrives at it a beat after the ball, like a real player.
    if (p.yawWant != null) {
      let d = p.yawWant - p.yaw;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      const rate = Math.max(cfg.turnRateMin, cfg.turnAccel / Math.max(1, p.speed));
      if (Math.abs(d) <= rate * dt) { p.yaw = p.yawWant; p.yawWant = null; }
      else p.yaw += Math.sign(d) * rate * dt;
    }
  }
  // SEPARATION. Two players had nothing at all stopping them occupying the same point, and measured,
  // 28 % of frames had a pair inside 45 cm — bodies visibly passing through each other, the cheapest
  // defect in a crowd to see and to fix. One relaxation pass, each pushed half the overlap: enough to
  // keep them apart without turning the shape into a physics toy.
  for (let i = 0; i < st.players.length; i++) {
    for (let j = i + 1; j < st.players.length; j++) {
      const a = st.players[i], b = st.players[j];
      const dx = b.p[0] - a.p[0], dz = b.p[2] - a.p[2];
      const d = Math.hypot(dx, dz);
      if (d >= cfg.minGap || d < 1e-6) continue;
      const push = (cfg.minGap - d) / 2, ux = dx / d, uz = dz / d;
      a.p[0] -= ux * push; a.p[2] -= uz * push;
      b.p[0] += ux * push; b.p[2] += uz * push;
    }
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
