import { BALL, PITCH, kick, stepBall } from './ball.js';

// ball-predict — the ball's FUTURE, and how to aim at it. Two jobs, both essential to a football
// that plays itself well:
//
//   PREDICT — where will the ball be, and when does it pass through a given height? Everything an
//   AI does about a moving ball (intercept it, run onto it, head it, chest it) is a query on its
//   predicted path. Because ball.js is a deterministic integrator, "predict" is just "simulate a
//   copy", and it is exact — not a parabola approximation that drifts once drag matters.
//
//   AIM — INVERSE BALLISTICS. A pass that "looks about right" is what makes AI football feel
//   sloppy: the ball arrives short, long, or too hot to control. With drag in the model there is
//   no closed-form solution, so we SOLVE it: pick the pass style (angle), then bisect the launch
//   speed until the simulated ball actually lands where we asked. Monotone in speed, so bisection
//   always converges. The result is a pass that arrives on the receiver at a receivable pace.

const dist2 = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

/** Sample the ball's future. Returns [{t, p:[x,y,z], v:[x,y,z]}] at `dt` intervals. */
export function predictPath(state, { dt = 1 / 60, maxT = 4 } = {}) {
  const s = { p: [...state.p], v: [...state.v], w: [...state.w] };
  const path = [{ t: 0, p: [...s.p], v: [...s.v] }];
  for (let t = 0; t < maxT; t += dt) {
    stepBall(s, dt);
    path.push({ t: t + dt, p: [...s.p], v: [...s.v] });
  }
  return path;
}

/**
 * Every moment the ball crosses height `h`, with the direction of travel — the query that drives
 * juggling and aerial control: "when is it at knee height on the way down?".
 */
export function crossesHeight(path, h) {
  const out = [];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1].p[1], b = path[i].p[1];
    if ((a - h) * (b - h) > 0) continue;
    const u = Math.abs(b - a) < 1e-9 ? 0 : (h - a) / (b - a);
    const p = [0, 1, 2].map((k) => path[i - 1].p[k] + (path[i].p[k] - path[i - 1].p[k]) * u);
    out.push({ t: path[i - 1].t + (path[i].t - path[i - 1].t) * u, p, rising: b > a });
  }
  return out;
}

/** Where the ball will be at time `t` (linear interpolation between samples). */
export function ballAt(path, t) {
  if (t <= 0) return path[0].p;
  const last = path[path.length - 1];
  if (t >= last.t) return last.p;
  const i = Math.min(path.length - 1, Math.max(1, Math.ceil((t / last.t) * (path.length - 1))));
  const a = path[i - 1], b = path[i];
  const u = (t - a.t) / Math.max(1e-9, b.t - a.t);
  return [0, 1, 2].map((k) => a.p[k] + (b.p[k] - a.p[k]) * u);
}

/** Pass styles: the launch angle that defines the shape of the ball. */
export const PASS_STYLE = {
  ground: 0.0,      // along the grass — fastest to arrive, easiest to control
  driven: 0.13,     // low and hard, skims over a defender's foot
  lofted: 0.42,     // over a press
  chip: 0.72,       // dinked over a closing defender, drops steeply
};

/**
 * INVERSE BALLISTICS: the kick that actually lands on `to`.
 * Bisects launch speed (monotone: harder = further) until the simulated ball reaches the target's
 * horizontal distance at the moment it comes back down to the target's height.
 * @returns {{speed, dirYaw, elevation, flightTime, arrivalSpeed, error}|null}
 */
export function solvePass(from, to, { style = 'ground', arrival = 6.5, spinRev = 0, spinAxis = [0, 1, 0], maxSpeed = 34, iterations = 24 } = {}) {
  const elevation = typeof style === 'number' ? style : (PASS_STYLE[style] ?? 0);
  const d = dist2(from, to);
  if (d < 1e-3) return null;
  const dirYaw = Math.atan2(to[2] - from[2], to[0] - from[0]);
  const targetY = Math.max(BALL.radius, to[1]);
  // TWO REGIMES, because "correct" means different things. A ball along the grass must ARRIVE AT A
  // PLAYABLE PACE — solving for "just reaches the target" converges on a pass that dies at the
  // receiver's feet at 0.2 m/s, which is exactly the limp AI pass we are trying to eliminate. A
  // ball in the air must LAND on the target. Both are monotone in launch speed, so both bisect.
  const rolling = elevation < 0.2;

  const trial = (v) => {
    const s = kick(from, { speed: v, dirYaw, elevation, spinAxis, spinRev });
    const dt = 1 / 240;
    let prevY = s.p[1];
    for (let t = 0; t < 7; t += dt) {
      stepBall(s, dt);
      const travelled = dist2(from, s.p);
      const sp = Math.hypot(s.v[0], s.v[1], s.v[2]);
      if (rolling) {
        if (travelled >= d) return { metric: sp, t: t + dt, r: travelled, sp };
        if (sp < 0.2) return { metric: 0, t: t + dt, r: travelled, sp: 0 };
      } else if (s.p[1] < prevY && s.p[1] <= targetY && t > 0.08) {
        return { metric: travelled, t: t + dt, r: travelled, sp };
      }
      prevY = s.p[1];
    }
    const r = dist2(from, s.p);
    return { metric: rolling ? 0 : r, t: 7, r, sp: Math.hypot(s.v[0], s.v[2]) };
  };

  const target = rolling ? arrival : d;
  let lo = 0.5, hi = maxSpeed, best = null;
  for (let i = 0; i < iterations; i++) {
    const mid = (lo + hi) / 2;
    const got = trial(mid);
    best = { speed: mid, ...got };
    if (got.metric < target) lo = mid; else hi = mid;
  }
  if (!best) return null;
  return {
    speed: best.speed, dirYaw, elevation, spinRev, spinAxis,
    flightTime: best.t, arrivalSpeed: best.sp, error: Math.abs(best.r - d),
  };
}

/**
 * Is the straight line from → to clear of `blockers`? A pass into a covered lane is how possession
 * is lost, so this is the single most important input to choosing a pass.
 * @returns {{open:boolean, margin:number, blocker:number}} margin = metres of clearance
 */
export function laneClearance(from, to, blockers, { corridor = 1.15, ignore = -1 } = {}) {
  const ax = from[0], az = from[2], bx = to[0], bz = to[2];
  const dx = bx - ax, dz = bz - az;
  const L2 = dx * dx + dz * dz || 1;
  let margin = Infinity, blocker = -1;
  for (let i = 0; i < blockers.length; i++) {
    if (i === ignore) continue;
    const b = blockers[i];
    let u = ((b[0] - ax) * dx + (b[2] - az) * dz) / L2;
    if (u < 0.06 || u > 0.98) continue;                       // behind the passer or on the receiver
    u = Math.max(0, Math.min(1, u));
    const m = Math.hypot(b[0] - (ax + dx * u), b[2] - (az + dz * u));
    if (m < margin) { margin = m; blocker = i; }
  }
  return { open: margin >= corridor, margin: margin === Infinity ? 99 : margin, blocker };
}

/**
 * Can this runner get to the ball before it passes by? Scans the predicted path for the EARLIEST
 * sample the runner can physically reach (accounting for reaction time and playable height), which
 * is exactly how a defender reads a pass — and how a receiver runs onto one.
 * @returns {{t, p, slack}|null} slack = spare seconds (bigger = easier)
 */
export function interceptPoint(path, from, speed, { reaction = 0.18, reach = 0.9, maxHeight = 2.2 } = {}) {
  let best = null;
  for (const s of path) {
    if (s.p[1] > maxHeight) continue;
    const need = Math.max(0, Math.hypot(s.p[0] - from[0], s.p[2] - from[2]) - reach) / Math.max(0.1, speed);
    const slack = s.t - (need + reaction);
    if (slack >= 0) { best = { t: s.t, p: [...s.p], slack }; break; }
  }
  return best;
}

/** The point on the pitch a receiver should run to in order to meet the ball cleanly. */
export function meetPoint(path, from, speed, opts = {}) {
  const i = interceptPoint(path, from, speed, opts);
  return i ? i.p : path[path.length - 1].p;
}

export { PITCH };

/**
 * BALISTIQUE INVERSE AU SOL : quelle vitesse donner à un ballon posé pour qu'il parcoure `D` mètres en
 * `T` secondes ? C'est ce dont un CONTRÔLE a besoin — amener le ballon au pied prend le temps du geste,
 * ce n'est pas une téléportation. Il n'y a pas de forme fermée : ball.js a une traînée quadratique, une
 * crise de traînée et un frottement de roulement. Un solveur avec son PROPRE modèle de frottement est
 * un solveur qui ment ; celui-ci fait une bissection sur le vrai intégrateur.
 * La distance est monotone en v0, donc la bissection converge toujours. `null` = « pas à cette
 * distance dans ce temps-là », qui est une vraie réponse : ce contrôle-là n'existe pas, le ballon file,
 * et c'est du football.
 */
export function solveGroundLeg(D, T, { vMax = 6, iters = 40, tol = 1e-3 } = {}) {
  if (!(D > 0) || !(T > 0)) return null;
  const reach = (v0) => {
    const s = { p: [0, BALL.radius, 0], v: [v0, 0, 0], w: [0, 0, -v0 / BALL.radius] };
    const n = Math.max(1, Math.ceil(T * 120));
    for (let i = 0; i < n; i++) stepBall(s, T / n);
    return s.p[0];
  };
  if (reach(vMax) < D - tol) return null;                    // hors d'atteinte dans ce temps
  let lo = 0, hi = vMax;
  for (let i = 0; i < iters && hi - lo > 1e-5; i++) {
    const mid = (lo + hi) / 2;
    if (reach(mid) < D) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
