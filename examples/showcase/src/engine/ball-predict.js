import { BALL, PITCH, kick, stepBall, dragCoefficient } from './ball.js';

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

const dist2 = (a, b) => hyp(a[0] - b[0], a[2] - b[2]);

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
export function solvePass(from, to, { style = 'ground', arrival = 6.5, spinRev = 0, spinAxis = [0, 1, 0], maxSpeed = 34, iterations = 24, dt = null, tol = 0.02, seed = true } = {}) {
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
  // LE BUDGET DE LA FRAME (lot 56 — « ça saccade ») : 6-7 ms PAR APPEL à 240 Hz × 24 bissections
  // aveugles — des rafales de frames à 10-18 ms au moment des passes. Trois remèdes, MÊME loi :
  // (1) le pas d'essai suit le régime (roulé 1/60, aérien 1/96) — stepBall sous-échantillonne
  //     DÉJÀ par demi-rayon dès que le ballon est rapide : la précision d'intégration tient,
  //     seul le surcoût de boucle tombe (le roulé payait 1 680 itérations pleines) ;
  // (2) l'AMORCE ANALYTIQUE (seed) resserre le panier de bissection — roulé : v² = arrivée² +
  //     2·(résistance + traînée moyenne)·d, itéré deux fois ; aérien : la portée du vide.
  //     Le panier se VÉRIFIE (deux essais) : trop étroit, il redevient celui d'hier ;
  // (3) la sortie anticipée (tol 2 cm/s) — la précision utile, pas un compte fixe.
  // La RÉFÉRENCE d'hier reste appelable au paramètre près ({ dt: 1/240, tol: 0, seed: false }) —
  // le banc compare les deux mondes cas par cas : l'atterrissage ne bouge pas de 0,35 m.
  const h = dt ?? (rolling ? 1 / 60 : 1 / 96);

  const trial = (v) => {
    const s = kick(from, { speed: v, dirYaw, elevation, spinAxis, spinRev });
    let prevY = s.p[1], prevVy = s.v[1];
    for (let t = 0; t < 7; t += h) {
      stepBall(s, h);
      const travelled = dist2(from, s.p);
      const sp = hyp(s.v[0], s.v[1], s.v[2]);
      if (rolling) {
        if (travelled >= d) return { metric: sp, t: t + h, r: travelled, sp };
        if (sp < 0.2) return { metric: 0, t: t + h, r: travelled, sp: 0 };
      } else if (t > 0.08 && ((prevVy < 0 && s.v[1] >= 0 && targetY <= BALL.radius + 0.02)
        || (s.p[1] < prevY && s.p[1] <= targetY))) {
        // L'ATTERRISSAGE SE LIT AU REBOND (vy s'inverse — resolveGround l'a retourné DANS le pas),
        // pas au « premier échantillon descendant sous le rayon » : cette lecture-là ratait un
        // rebond survenu entre deux échantillons et attrapait le DEUXIÈME arc (mesuré : des vols
        // « résolus » à 2,87 s pour un premier contact à 1,7 s — à 240 Hz aussi). Une cible EN
        // HAUTEUR (targetY > rayon : un receveur aérien) garde la traversée de hauteur.
        return { metric: travelled, t: t + h, r: travelled, sp };
      }
      prevY = s.p[1]; prevVy = s.v[1];
    }
    const r = dist2(from, s.p);
    return { metric: rolling ? 0 : r, t: 7, r, sp: hyp(s.v[0], s.v[2]) };
  };

  const target = rolling ? arrival : d;
  let lo = 0.5, hi = maxSpeed, best = null;
  if (seed) {
    let est;
    if (rolling) {
      let a = 2.5;
      for (let k = 0; k < 2; k++) {
        est = Math.sqrt(Math.max(1, arrival * arrival + 2 * a * d));
        const vm = (est + arrival) / 2;
        a = PITCH.rollResist * PITCH.gravity + BALL.k * dragCoefficient(vm) * vm * vm;
      }
    } else est = Math.sqrt(d * PITCH.gravity / Math.max(0.2, Math.sin(2 * elevation)));
    lo = Math.max(0.5, est * 0.7); hi = Math.min(maxSpeed, Math.max(est * 1.45, lo + 2));
    if (hi < maxSpeed && trial(hi).metric < target) hi = maxSpeed;
    if (lo > 0.6 && trial(lo).metric > target) lo = 0.5;
  }
  for (let i = 0; i < iterations && (tol === 0 || hi - lo > tol || !best); i++) {
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
    const m = hyp(b[0] - (ax + dx * u), b[2] - (az + dz * u));
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
    const need = Math.max(0, hyp(s.p[0] - from[0], s.p[2] - from[2]) - reach) / Math.max(0.1, speed);
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

/**
 * LA COURSE AU VOL. Un couloir de passe n'est pas une géométrie, c'est une COURSE : la question
 * n'est jamais « à combien de mètres du segment est le défenseur » mais « peut-il rejoindre le vol
 * AVANT le ballon ». La photo statique (laneClearance) a été mesurée mensongère au point d'en rire :
 * des passes interceptées avec 2,6 m de marge médiane — et jusqu'à 7 m — parce qu'un ballon au sol
 * met ~1 s à arriver et qu'un défenseur à 6,5 m/s traverse 6 m dans ce temps-là. L'outil exact
 * existait déjà (interceptPoint, la course paramétrée en temps) : seul le RECEVEUR s'en servait.
 * Celle-ci fait courir tout le monde sur le VRAI vol (fantôme intégré par ball.js, pas une droite).
 * `headStart` donne aux coureurs de l'avance sur le départ du ballon — à n'utiliser QUE si la
 * défense de ce monde lit l'armé : calibré trop généreux (armé complet, pleine vitesse), le modèle
 * a étranglé le jeu à 1 passe par partie. La défense du rondo réagit AU DÉPART (assignJobs) ; le
 * bon appel projette les POSITIONS au moment du départ et laisse headStart à zéro.
 * @returns {{path, first:{idx,t,slack}|null}} le premier coureur qui gagne la course, et le vol.
 */
export function flightRace(from, sol, runners, { speed = 6.5, reaction = 0.18, headStart = 0, reach = 0.9, maxHeight = 2.2, dt = 1 / 30, maxT = 3 } = {}) {
  const ghost = kick(from, { speed: sol.speed, dirYaw: sol.dirYaw, elevation: sol.elevation, spinAxis: sol.spinAxis ?? [0, 1, 0], spinRev: sol.spinRev ?? 0 });
  const path = predictPath(ghost, { dt, maxT });
  let first = null;
  for (let i = 0; i < runners.length; i++) {
    const hit = interceptPoint(path, runners[i], speed, { reaction: reaction - headStart, reach, maxHeight });
    if (hit && (!first || hit.t < first.t)) first = { idx: i, ...hit };
  }
  return { path, first };
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
import { hyp } from './hyp.js';
