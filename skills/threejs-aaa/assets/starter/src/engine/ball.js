// ball — the FLIGHT OF A FOOTBALL, dependency-free and node-testable. A rigid sphere dropped into
// a physics engine is not a football: it flies a perfect parabola, never curves, and rolls
// forever. A real ball's trajectory is dominated by AERODYNAMICS, and its contacts by the coupling
// between spin and velocity. This module models the four things that actually make it read as
// football, in order of how much they change the picture:
//
//   1. DRAG — ½ρ·Cd·A·v² is COMPARABLE TO GRAVITY at shooting speed (≈9.7 m/s² at 30 m/s), so a
//      struck ball flattens and dies instead of arcing symmetrically. With the DRAG CRISIS: Cd
//      collapses from ~0.47 to ~0.18 as the boundary layer goes turbulent around 12-14 m/s, which
//      is why a hard shot travels flat and then drops off a cliff as it slows back through it.
//   2. MAGNUS — F ∝ ω × v. THE curve. Without it no free kick bends, no cross swings, no shot
//      dips; every ball in the game feels like a stone. Cl = 1/(2 + v/(ω·r)) (Carré/Asai).
//   3. BOUNCE WITH SPIN COUPLING — the contact point's velocity is v + ω × r, so friction at
//      impact trades spin for velocity: backspin checks up and comes back, topspin skids away.
//      A restitution-only bounce loses all of that.
//   4. ROLLING — rolling resistance on grass, so a pass dies at a believable distance.
//
// State is plain arrays: { p:[x,y,z] metres, v:[x,y,z] m/s, w:[x,y,z] rad/s }. Integration is
// sub-stepped (a 30 m/s shot covers 0.5 m per 60 Hz frame — 4.5 ball radii — and would tunnel
// straight through the net, a keeper, or the ground without it).

/** FIFA Law 2 ball, plus the air it flies through. */
export const BALL = {
  mass: 0.43,            // kg (410–450 g)
  radius: 0.11,          // m (circumference 68–70 cm)
  rho: 1.225,            // kg/m³ air density at sea level
  inertiaFactor: 2 / 3,  // thin spherical shell: I = ⅔·m·r²
};
BALL.area = Math.PI * BALL.radius * BALL.radius;
/** ½ρA/m — multiply by Cd·v² for an acceleration in m/s². */
BALL.k = 0.5 * BALL.rho * BALL.area / BALL.mass;

export const PITCH = {
  gravity: 9.81,
  restitution: 0.62,     // grass is not concrete
  friction: 0.55,        // boot/ball and ball/grass tangential friction
  rollResist: 0.12,      // rolling resistance coefficient on cut grass (tuned so a 15 m/s pass dies ~40 m)
  spinDecay: 20,         // s — aerodynamic spin damping time constant in flight
};

const len = (a) => Math.hypot(a[0], a[1], a[2]);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/**
 * Drag coefficient across the DRAG CRISIS. Subcritical (slow, laminar) the ball is draggy; past
 * the critical speed the boundary layer trips turbulent and Cd collapses; very fast it creeps back
 * up. This curve is why a hard shot holds a flat line and then falls away as it decelerates.
 */
export function dragCoefficient(speed) {
  const t = 1 / (1 + Math.exp(-(speed - 13) / 1.9));     // smooth crisis transition around 13 m/s
  const base = 0.47 + (0.17 - 0.47) * t;
  return base + Math.max(0, speed - 24) * 0.004;          // mild supercritical creep-back
}

/**
 * Magnus lift coefficient, Cl = 1/(2 + v/(ω·r)) — the standard empirical fit for a football.
 * Spin ratio ω·r/v is what matters: a 9 rev/s free kick at 25 m/s gives Cl ≈ 0.18, i.e. ~6 m/s²
 * of sideways acceleration — a couple of metres of bend over the flight. Capped: a ball cannot
 * lift more than about half its drag.
 */
export function magnusCoefficient(speed, spinRate) {
  if (speed < 1e-4 || spinRate < 1e-4) return 0;
  return Math.min(0.35, 1 / (2 + speed / (spinRate * BALL.radius)));
}

/** Accelerations acting on the ball in flight: gravity + drag + Magnus. */
export function aeroAccel(v, w, { gravity = PITCH.gravity, drag = true, magnus = true } = {}) {
  const a = [0, -gravity, 0];
  const speed = len(v);
  if (speed < 1e-6) return a;
  if (drag) {
    const ad = BALL.k * dragCoefficient(speed) * speed;   // ×speed here, ×v below ⇒ Cd·v²·v̂
    a[0] -= ad * v[0]; a[1] -= ad * v[1]; a[2] -= ad * v[2];
  }
  if (magnus) {
    const spin = len(w);
    const cl = magnusCoefficient(speed, spin);
    if (cl > 0) {
      const wv = cross(w, v);                              // force is along ω × v (backspin ⇒ lift)
      const l = len(wv);
      if (l > 1e-6) {
        const am = BALL.k * cl * speed * speed / l;
        a[0] += am * wv[0]; a[1] += am * wv[1]; a[2] += am * wv[2];
      }
    }
  }
  return a;
}

/**
 * Resolve a ground contact. The velocity of the material point touching the grass is
 * v + ω × (−r·ŷ); friction acts against THAT, which is what converts spin into velocity and back.
 * A sliding contact gets a Coulomb impulse μ·Jn; a gripping contact gets exactly the impulse that
 * kills the slip (for I = α·m·r², that is α/(1+α)·m·|u| — 0.4·m·|u| for a football shell).
 */
function resolveGround(s, { restitution, friction }) {
  const r = BALL.radius, a = BALL.inertiaFactor;
  s.p[1] = r;
  const jn = Math.abs(s.v[1]) * (1 + restitution);          // normal impulse per unit mass
  s.v[1] = -s.v[1] * restitution;
  // contact-point tangential velocity: u = v_t + (ω × (0,−r,0))_t = (vx + r·wz, vz − r·wx)
  const ux = s.v[0] + r * s.w[2], uz = s.v[2] - r * s.w[0];
  const u = Math.hypot(ux, uz);
  if (u < 1e-6) return;
  const jStick = (a / (1 + a)) * u;                         // impulse/mass that removes all slip
  const j = Math.min(friction * jn, jStick);                // Coulomb cone
  const nx = ux / u, nz = uz / u;                           // slip direction (friction opposes it)
  s.v[0] -= j * nx; s.v[2] -= j * nz;
  // Δω = (r_c × J)/I with r_c = (0,−r,0), J/m = −j·(nx,0,nz), I/m = a·r²
  s.w[0] -= (j * nz) / (a * r);
  s.w[2] += (j * nx) / (a * r);
}

/**
 * Ground-rolling regime. Deceleration is rolling resistance on the grass PLUS aerodynamic drag —
 * forgetting the air here is not a rounding error: at 15 m/s drag alone is ~2.6 m/s², more than
 * the grass contributes, and without it a firm pass rolls 150 m across the pitch.
 */
function rollGround(s, dt, { gravity, rollResist, drag = true }) {
  const sp = Math.hypot(s.v[0], s.v[2]);
  if (sp < 1e-6) { s.v[0] = s.v[2] = 0; s.w[0] = s.w[1] = s.w[2] = 0; return; }
  const dec = (rollResist * gravity + (drag ? BALL.k * dragCoefficient(sp) * sp * sp : 0)) * dt;
  const f = Math.max(0, sp - dec) / sp;
  s.v[0] *= f; s.v[2] *= f;
  s.w[2] = -s.v[0] / BALL.radius;                           // rolling without slipping
  s.w[0] = s.v[2] / BALL.radius;
}

/**
 * Advance the ball by `dt`, sub-stepped so a fast ball cannot tunnel. Mutates and returns `s`.
 * @param {{p:number[],v:number[],w:number[]}} s
 * @param {number} dt seconds
 */
export function stepBall(s, dt, opts = {}) {
  const o = { ...PITCH, drag: true, magnus: true, ground: true, ...opts };
  const speed = len(s.v);
  // never travel more than half a radius per sub-step
  const n = Math.max(1, Math.min(64, Math.ceil((speed * dt) / (BALL.radius * 0.5))));
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    const onGround = s.p[1] <= BALL.radius + 1e-4 && Math.abs(s.v[1]) < 0.6;
    if (onGround && o.ground) {
      s.p[1] = BALL.radius; s.v[1] = 0;
      rollGround(s, h, o);
    } else {
      const a = aeroAccel(s.v, s.w, o);
      s.v[0] += a[0] * h; s.v[1] += a[1] * h; s.v[2] += a[2] * h;
      const decay = Math.exp(-h / o.spinDecay);             // spin bleeds off slowly in flight
      s.w[0] *= decay; s.w[1] *= decay; s.w[2] *= decay;
    }
    s.p[0] += s.v[0] * h; s.p[1] += s.v[1] * h; s.p[2] += s.v[2] * h;
    if (o.ground && s.p[1] < BALL.radius) resolveGround(s, o);
  }
  return s;
}

/**
 * Launch a ball. `dirYaw` is the compass heading (radians, +x at 0 turning toward +z),
 * `elevation` the launch angle above the pitch, `spinAxis` a vector (normalised here) and
 * `spinRev` the spin rate in REVOLUTIONS per second — the unit coaches and broadcasters use.
 */
export function kick(from, { speed = 25, dirYaw = 0, elevation = 0.2, spinAxis = [0, 1, 0], spinRev = 0 } = {}) {
  const ch = Math.cos(elevation), sh = Math.sin(elevation);
  const l = len(spinAxis) || 1;
  const w = spinRev * 2 * Math.PI;
  return {
    p: [from[0], from[1], from[2]],
    v: [Math.cos(dirYaw) * speed * ch, speed * sh, Math.sin(dirYaw) * speed * ch],
    w: [spinAxis[0] / l * w, spinAxis[1] / l * w, spinAxis[2] / l * w],
  };
}

/** Simulate until `until(state, t)` is true or `maxT` elapses; returns the sampled path. */
export function simulate(s0, { dt = 1 / 120, maxT = 8, until = null, opts = {} } = {}) {
  const s = { p: [...s0.p], v: [...s0.v], w: [...s0.w] };
  const path = [{ t: 0, p: [...s.p], v: [...s.v] }];
  for (let t = 0; t < maxT; t += dt) {
    stepBall(s, dt, opts);
    path.push({ t: t + dt, p: [...s.p], v: [...s.v] });
    if (until && until(s, t + dt)) break;
  }
  return { state: s, path };
}

/**
 * Contract: a trajectory must be physically admissible. Catches the failure modes that make a
 * ball feel wrong — free energy, tunnelling through the pitch, teleports, dead or runaway spin.
 */
export function checkBallFlight(path, { maxSpeed = 60, dt = 1 / 120 } = {}) {
  const issues = [];
  let e0 = null;
  for (let i = 0; i < path.length; i++) {
    const { p, v } = path[i];
    for (const c of [...p, ...v]) if (!Number.isFinite(c)) { issues.push('valeurs non finies dans la trajectoire'); break; }
    if (p[1] < BALL.radius - 0.02) { issues.push(`le ballon traverse la pelouse (y=${p[1].toFixed(3)} < r)`); break; }
    const sp = Math.hypot(v[0], v[1], v[2]);
    if (sp > maxSpeed) { issues.push(`vitesse irréaliste ${sp.toFixed(1)} m/s (> ${maxSpeed})`); break; }
    if (i > 0) {
      const q = path[i - 1].p;
      const step = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
      if (step > maxSpeed * dt * 1.6 + 1e-3) { issues.push(`saut de position ${step.toFixed(2)} m en un pas (téléport)`); break; }
    }
    // energy may only decrease in flight (drag/friction are dissipative — nothing adds energy)
    const e = 0.5 * sp * sp + PITCH.gravity * p[1];
    if (e0 === null) e0 = e;
    else if (e > e0 * 1.02 + 0.05) { issues.push(`énergie qui augmente (${e.toFixed(1)} > ${e0.toFixed(1)}) — force non physique`); break; }
    e0 = Math.min(e0, e);
  }
  return { ok: issues.length === 0, issues };
}

/** Lateral deviation (m) of a path from the straight line of its initial heading — the "bend". */
export function lateralBend(path) {
  const a = path[0].p, v = path[0].v;
  const h = Math.hypot(v[0], v[2]) || 1;
  const dx = v[0] / h, dz = v[2] / h;                       // unit heading in the pitch plane
  let worst = 0;
  for (const s of path) {
    const ox = s.p[0] - a[0], oz = s.p[2] - a[2];
    const side = ox * dz - oz * dx;                          // signed perpendicular offset
    if (Math.abs(side) > Math.abs(worst)) worst = side;
  }
  return worst;
}
