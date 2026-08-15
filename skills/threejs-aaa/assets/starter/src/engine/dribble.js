import { BALL, PITCH, stepBall } from './ball.js';

// Le ballon peut être un BallBody (position en lecture seule, audit de continuité) ou un objet nu
// `{p,v,w}` — les prédicteurs simulent des futurs sur des copies mutables, et c'est légitime. Ces deux
// helpers font que le dribble marche sur les deux sans jamais écrire de position.
const setVelocity = (ball, v, w) => {
  if (typeof ball.impulse === 'function') {
    ball.impulse([v[0] - ball.v[0], v[1] - ball.v[1], v[2] - ball.v[2]],
      [w[0] - ball.w[0], w[1] - ball.w[1], w[2] - ball.w[2]]);
  } else {
    ball.v[0] = v[0]; ball.v[1] = v[1]; ball.v[2] = v[2];
    ball.w[0] = w[0]; ball.w[1] = w[1]; ball.w[2] = w[2];
  }
};
const advance = (ball, dt) => (typeof ball.integrate === 'function' ? ball.integrate(dt) : stepBall(ball, dt));

// dribble — carrying the ball, the way it actually works. The tempting shortcut is to park the
// ball at a fixed offset in front of the player (`ballPos = playerPos + heading * 0.85`). That is
// why almost every hobby football game looks wrong: the ball is WELDED to the player, it never
// runs, never lags, never gets away, and no defender can ever nick it.
//
// A real dribble is a sequence of TOUCHES. Once every stride or two the plant foot nudges the
// ball; between touches the ball is FREE — it rolls under its own physics (ball.js: grass
// resistance and air drag) while the player runs to catch it back up. Everything that makes
// dribbling feel like football falls out of that loop:
//   • the ball–player distance BREATHES instead of being constant (the single clearest tell),
//   • sprinting forces long touches (the ball gets 3–4 m away) while close control keeps it under
//     the foot — so pace and control genuinely trade off,
//   • a touch that is too heavy for the current speed loses possession, which is what gives
//     defenders something to win.
//
// Dependency-free and node-testable; feeds a ball state that ball.js integrates.

/** How far ahead a touch should put the ball: close control ≈ 0.8 m, full sprint ≈ 2.4 m. */
export function touchDistance(speed, { close = 0.5, perSpeed = 0.36, max = 3.0 } = {}) {
  return Math.min(max, close + Math.max(0, speed - 1.5) * perSpeed);
}

/**
 * Speed to leave on the ball so it gains exactly `lead` metres on a player running at `speed`
 * before the grass hands it back. The ball decelerates at a ≈ rolling resistance + air drag, so
 * relative to the player it gains (v₀−v)²/2a — invert that. Deriving the push instead of guessing
 * a multiplier is what makes the dribble self-correcting at every pace: too strong and the ball
 * runs away, too weak and it never leaves the foot.
 */
export function touchDecel(speed) {
  return PITCH.rollResist * PITCH.gravity + BALL.k * 0.42 * Math.max(2, speed) ** 2 * 0.35;
}
export function pushSpeed(speed, lead) {
  return speed + Math.sqrt(2 * touchDecel(speed) * Math.max(0.05, lead));
}
/** Seconds until the player is back on the ball after a touch of `lead` metres. */
export function touchInterval(speed, lead) {
  return 2 * Math.sqrt(2 * Math.max(0.05, lead) / touchDecel(speed));
}

/**
 * The heading a dribbler must actually run to KEEP the ball while heading toward `want`. A player
 * who runs their intended line and ignores where the ball went is not dribbling — that is exactly
 * how a ball ends up 20 m away on a curved run. Real dribblers bend their path to their ball, more
 * strongly the further off-line it has drifted. Feed the result to the character controller.
 */
export function dribbleSteer(ball, player, { pull = 0.6, reach = 1.15 } = {}) {
  const wx = player.want ? player.want[0] : player.heading[0];
  const wz = player.want ? player.want[1] : player.heading[1];
  const bx = ball.p[0] - player.p[0], bz = ball.p[2] - player.p[1];
  const d = Math.hypot(bx, bz);
  if (d < reach * 0.9) return [wx, wz];                    // ball at the foot: just go where you want
  const k = Math.min(1, (d - reach * 0.9) / 1.6) * pull;   // the further it drifted, the harder you chase
  const hx = wx + (bx / d - wx) * k, hz = wz + (bz / d - wz) * k;
  const l = Math.hypot(hx, hz) || 1;
  return [hx / l, hz / l];
}

/**
 * LA PRISE A UNE PORTÉE DE PIED (lot 62 — capture utilisateur : « le ballon change de sens sans
 * être touché »). Mesuré (3 graines × 300 s) : 80 des 105 captures accordaient la possession à un
 * ballon qui FUYAIT le preneur (jusqu'à 0,9 m), et le servo du porté le retournait le tick même —
 * 39 des 42 demi-tours sans contact du match venaient de ce seul site. La règle du réel : on
 * possède un ballon AU pied (< prise) ou qui VIENT au pied (pas fuyant) ; un ballon qui fuit se
 * court — et la touche réelle le jouera quand le pied l'atteint (dribbleStep, lot 58).
 */
/** LE CÔNE AVANT (lot 70) : une touche de PIED n'existe que si le ballon est DEVANT le corps
 *  (relèvement ≤ cone°). Les chemins sans géométrie (amorti-poursuite, quart-de-touche, capture)
 *  écrasaient des ballons DANS LE DOS — mesuré : 54 % des amortis-poursuite à > 100°, prises à
 *  p90 107° — « le joueur se réoriente avec la balle sans la toucher » (retour utilisateur).
 *  La table des techniques (technique.js) porte déjà ses fenêtres ; ce cône est la même loi
 *  pour les touches HORS table. cfg.priseCone:false = la touche omnisciente d'hier (sabotage). */
export const dansCone = (yaw, px, pz, bx, bz, cone = 100) => {
  const a = Math.atan2(bz - pz, bx - px) - yaw;
  return Math.abs(((a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI) <= cone * Math.PI / 180;
};

export function balPrenable(ball, px, pz, prise = 0.5, fuite = 0.5) {
  const bx = ball.p[0] - px, bz = ball.p[2] - pz, dd = Math.hypot(bx, bz);
  return dd < prise || (dd > 1e-4 ? (ball.v[0] * bx + ball.v[2] * bz) / dd : 0) < fuite;
}

export function makeDribbler(cfg = {}) {
  return {
    sinceTouch: 0,          // metres of player travel since the last touch
    touches: 0,
    lost: false,
    cfg: {
      reach: 1.15,          // m — a foot can only touch a ball it can actually reach
      prise: null,          // m — LA TOUCHE SE PREND AU PIED (lot 58) : on REJOINT le ballon à
      //                       ≤ prise avant de le repousser (absent : la touche d'hier part dès
      //                       reach — la jambe tendue). La touche d'URGENCE à pleine allonge
      //                       reste quand le ballon fuit plus vite qu'on ne referme (le poke).
      minStride: 0.55,      // m of travel between touches (stride pacing, not per-frame)
      minPush: 2.5,         // m/s — even a standing touch sends the ball on
      controlRadius: 3.6,   // m — beyond this the ball has run away
      steer: 0.8,           // how strongly a touch redirects the ball to the desired heading
      ...cfg,
    },
  };
}

/**
 * Advance one frame of a dribble. The player is driven by the game (controller/AI); this only
 * decides WHEN a touch happens and what it does to the ball, then integrates the ball.
 *
 * @param {object} d       dribbler state from makeDribbler()
 * @param {object} ball    { p:[x,y,z], v:[x,y,z], w:[x,y,z] } — mutated
 * @param {object} player  { p:[x,z], speed, heading:[x,z] unit, want:[x,z] unit desired heading }
 * @param {number} dt
 * @returns {{touched:boolean, dist:number, ahead:number, control:number, lost:boolean}}
 */
export function dribbleStep(d, ball, player, dt) {
  const c = d.cfg;
  const [px, pz] = player.p;
  const hx = player.heading[0], hz = player.heading[1];
  const wantX = player.want ? player.want[0] : hx, wantZ = player.want ? player.want[1] : hz;

  d.sinceTouch += player.speed * dt;

  const bx = ball.p[0] - px, bz = ball.p[2] - pz;
  const dist = Math.hypot(bx, bz);
  const ahead = (bx * hx + bz * hz);                       // signed: how far in front the ball is

  let touched = false, ev = null;
  // A touch lands when the foot actually REACHES the ball, stride-paced so it is not re-kicked
  // every frame. Triggering on "distance travelled" instead was the bug that killed turns: once
  // the ball escaped the trigger window it was never touched again and simply rolled away.
  // …ET LA TOUCHE SE PREND AU PIED (cfg.prise, lot 58 — captures utilisateur : « le ballon ne
  // touche jamais le pied », touches de sprint mesurées à 1,07 m p50 = la jambe tendue) : le
  // corps REJOINT son ballon avant de le repousser. L'exception est réelle : un ballon qui FUIT
  // plus vite qu'on ne le referme se joue à pleine allonge (le poke de la course).
  const prise = c.prise ?? c.reach;
  const bvAway = dist > 1e-4 ? (ball.v[0] * bx + ball.v[2] * bz) / dist : 0;
  const auPied = dist < prise || (bvAway > player.speed + 0.3 && dist < c.reach);
  if (auPied && d.sinceTouch >= c.minStride) {
    // turning shortens the touch — you cannot push the ball 3 m ahead and still be with it after
    // a 40° change of direction. This is real technique, and it is what makes curved runs work.
    const turn = Math.abs(player.turnRate || 0);
    // LA TOUCHE LIT L'ESPACE : seul, on pousse loin ; un défenseur à 2 m raccourcit la touche
    // (close control). Mesuré sans cette loi : 11,4 % du temps de conduite avec le ballon échappé
    // au-delà de 2,2 m — le porteur courait après son propre ballon, la « conduite imprécise »
    // que l'œil lit immédiatement. player.space = distance du plus proche adversaire (l'appelant
    // la fournit ; absente, la loi est neutre — le rondo d'avant est inchangé au bit près).
    const space = player.space ?? 99;
    const kSpace = Math.max(0.5, Math.min(1, space / 4));
    // …et la NOTE de dribble : le mauvais dribbleur pousse plus loin qu'il ne maîtrise
    // …ET LE RÉGIME (player.touchF, posé par le match — absent : le rondo au bit près) : LA
    // CONDUITE EST SERRÉE PAR DÉFAUT, la touche LANCÉE est l'acte nommé d'un démarrage. La
    // poussée pleine (0,36 × v ≈ 2,7 m à 6 m/s) servie à toutes les croisières mettait 18 % du
    // temps de conduite à > 2 m du ballon — le temps s'accumule sur le PLATEAU lointain de
    // chaque poussée (homme et ballon filent à la même allure, la fermeture n'arrive qu'en fin
    // de roulement). Mesuré : bursts nommés = 0,1 % du porté — le geste long était devenu la règle.
    const lead = (touchDistance(player.speed) / (1 + turn * 1.9)) * kSpace * (player.leadF ?? 1) * (player.touchF ?? 1);
    // …et le canal VITESSE (player.touchDamp, absent = 1 : bit-près) : une touche d'AMORTI EN
    // COURSE absorbe au lieu de relancer — le ballon roule SOUS l'allure du corps et se cale
    // pour la frappe. Mesuré sans lui : pushSpeed lit la vitesse du porteur, donc chaque touche
    // « courte » RELANÇAIT le ballon à v+1 (7,0 mesuré à 6,1 de course) — le ballon de course ne
    // se posait jamais, le tir jamais armé (l'empalement sur le gardien).
    const sp = Math.max(2.0, Math.max(c.minPush, pushSpeed(player.speed, lead)) * (player.touchDamp ?? 1));
    // the touch aims where the player WANTS to go (this is what carries the ball through a turn),
    // blended with the ball's current line so a touch never teleports its direction
    const cvx = ball.v[0], cvz = ball.v[2];
    const cl = Math.hypot(cvx, cvz);
    const curX = cl > 0.2 ? cvx / cl : wantX, curZ = cl > 0.2 ? cvz / cl : wantZ;
    // UNE TOUCHE QUI CORRIGE, CORRIGE VRAIMENT : quand la ligne du ballon a divergé de plus de
    // 60° du cap voulu (déviation, duel, rebond), le mélange avec la ligne courante perpétuait
    // l'erreur — la queue de 111° d'écart mesurée. Ce cas-là, le pied REPREND le ballon plein cap.
    const div = Math.acos(Math.max(-1, Math.min(1, curX * wantX + curZ * wantZ)));
    const steerK = div > Math.PI / 3 ? 1 : c.steer;
    let dx = curX + (wantX - curX) * steerK, dz = curZ + (wantZ - curZ) * steerK;
    const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
    // LEAD THE TURN: by the time the player catches this touch they will have rotated further, so
    // aim inside the curve rather than down the current tangent. Touching the tangent is exactly
    // what leaves the ball drifting to the outside and behind on a curved run.
    if (turn > 1e-4) {
      // rotate by HALF the turn the player will complete before catching this touch — aim at the
      // middle of the arc. Using an eyeballed fraction of a stride instead was 13× too small and
      // left the ball drifting to the outside of every curve.
      const a = (player.turnRate || 0) * touchInterval(player.speed, lead) * 0.5;
      const ca = Math.cos(a), sa = Math.sin(a);
      const rx = dx * ca - dz * sa, rz = dx * sa + dz * ca;
      dx = rx; dz = rz;
    }
    // UNE TOUCHE EST UNE VITESSE, JAMAIS UNE POSITION. `setVelocity` passe par le corps du ballon
    // quand il y en a un (ball-body.js), et reste compatible avec un objet nu pour les prédicteurs et
    // les harnais qui simulent des futurs sur une copie.
    setVelocity(ball, [dx * sp, Math.max(ball.v[1], 0), dz * sp],
      [ball.v[2] / BALL.radius, 0, -(dx * sp) / BALL.radius]);   // le pied la fait rouler : lift avant
    d.sinceTouch = 0; d.touches++; touched = true;
    // LA TOUCHE PORTE SA GÉOMÉTRIE (lot 55) : l'angle entrant→sortant et la vitesse du kick —
    // l'événement les inscrit, la scène en fait un GESTE (une cassure de 110° n'est pas une
    // caresse de course). Calcul pur sur des valeurs déjà là : la physique ne bouge pas d'un bit.
    // …un ballon RASSEMBLÉ (quasi posé au pied — la prise du lot 58) n'a plus de ligne : sa
    // cassure se lit contre le CAP DU CORPS (heading → kick), le vrai angle du demi-tour.
    ev = { dev: Math.acos(Math.max(-1, Math.min(1, (cl > 0.2 ? curX : hx) * dx + (cl > 0.2 ? curZ : hz) * dz))) * 180 / Math.PI, spd: sp };
  }

  advance(ball, dt);

  const nd = Math.hypot(ball.p[0] - px, ball.p[2] - pz);
  d.lost = nd > c.controlRadius;
  return { touched, ev, dist: nd, ahead, control: Math.max(0, 1 - nd / c.controlRadius), lost: d.lost };
}

/**
 * Contract for a dribble trace ([{t, dist, ahead, touched, speed}]). These rules are written
 * against the FAILURE MODES of fake dribbling, not against the implementation:
 *   glued      — a constant ball–player distance is the signature of a welded ball
 *   runaway    — the ball must stay inside control range for a clean dribble
 *   behind     — the ball must lead the player, not trail them
 *   machine-gun— one touch per stride, not one per frame
 */
export function checkDribble(trace, { controlRadius = 4.2, minVariation = 0.15, maxTouchRate = 4 } = {}) {
  const issues = [];
  if (trace.length < 10) return { ok: false, issues: ['trace trop courte'] };
  const dists = trace.map((s) => s.dist);
  const mean = dists.reduce((a, b) => a + b, 0) / dists.length;
  const sd = Math.sqrt(dists.reduce((a, b) => a + (b - mean) ** 2, 0) / dists.length);
  if (sd < minVariation) issues.push(`ballon COLLÉ au joueur (écart-type ${sd.toFixed(3)} m — un vrai dribble respire)`);
  const worst = Math.max(...dists);
  if (worst > controlRadius) issues.push(`ballon perdu : ${worst.toFixed(2)} m > rayon de contrôle ${controlRadius} m`);
  const behind = trace.filter((s) => s.ahead < -0.15).length / trace.length;
  if (behind > 0.25) issues.push(`le ballon traîne DERRIÈRE le joueur ${(behind * 100).toFixed(0)}% du temps`);
  const dur = trace[trace.length - 1].t - trace[0].t;
  const touches = trace.filter((s) => s.touched).length;
  if (dur > 0 && touches / dur > maxTouchRate) issues.push(`${(touches / dur).toFixed(1)} touches/s — le pied mitraille le ballon`);
  if (touches === 0) issues.push('aucune touche : le ballon n\'est jamais joué');
  return { ok: issues.length === 0, issues, stats: { mean: +mean.toFixed(2), sd: +sd.toFixed(2), worst: +worst.toFixed(2), touches } };
}
