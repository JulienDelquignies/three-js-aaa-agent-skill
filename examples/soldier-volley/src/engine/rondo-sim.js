import { BALL, stepBall, kick } from './ball.js';
import { predictPath } from './ball-predict.js';
import { solvePass, solveGroundLeg, flightRace, interceptPoint } from './ball-predict.js';
import { makeDribbler, dribbleStep, dribbleSteer } from './dribble.js';
import { RONDO, assignJobs, choosePass, strikingFoot, rondoInternals } from './rondo.js';
import { situation, chooseTechnique, checkAction, TECHNIQUES } from './technique.js';
import { MOVES } from './animkit.js';
import { startGesture, stepGesture, abortGesture, busy, winding, checkGestures } from './gesture.js';
import { STANCES, anchorFor, reachable, glide, planStrike } from './approach.js';

// rondo-sim — the game loop of the possession game, headless. Everything that decides whether a
// "passe à dix" is won or lost happens here: when the carrier releases, whether the pass beats the
// press, whether a defender reads it, and who ends up with the ball. Because it runs with no
// renderer, the whole match can be proved in node (verify-rondo) before it is ever drawn.

const d2 = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const { movePlayers, separatePlayers, turnover } = rondoInternals;

// THE TIMING OF EVERY GESTURE, taken from the animation itself. `contact` is the frame at which the
// boot meets the ball, so it IS the anticipation: the swing before the strike. Reading it from the
// clip rather than restating it here is what keeps the simulation and the picture the same event —
// re-authoring these numbers by hand is how a ball starts leaving before the leg moves.
const MOVE_TIMING = Object.fromEntries(Object.entries(MOVES)
  .filter(([, m]) => m.contact != null)
  .map(([k, m]) => [k, { duration: m.duration, contact: m.contact }]));

/** Un refus a une CAUSE NOMMÉE, et elle se compte. C'est le seul moyen de voir un étranglement :
 * quand le jeu s'effondre, le premier chiffre à lire est « qui dit non, et combien de fois ». */
function deny(st, cause) { (st.deny ??= {})[cause] = (st.deny[cause] ?? 0) + 1; return false; }

/**
 * COMMIT to the chosen pass. Inverse ballistics decides it can be played; the gesture decides when.
 * PENDANT UNE LIVRAISON (contrôle en route vers le pied), tout se planifie contre le point
 * d'ARRIVÉE du ballon (`opts.ballRef`), pas contre sa position de voyage : c'est ainsi qu'un vrai
 * joueur prépare la suite pendant que le ballon vient à lui — et l'engagement n'est accordé que si
 * le contact du geste tombe APRÈS l'arrivée (le pied et le ballon se rejoignent : la première
 * intention du une-deux). Bloquer toute intention pendant la livraison a été mesuré : 4 109 refus,
 * 0,3 s d'exposition de plus par possession, record 8,5 → 5 — on ne joue pas au rondo en
 * attendant que le ballon soit mort pour commencer à penser.
 */
function beginPass(st, choice, cfg, opts = {}) {
  const c = st.players[st.possession.carrier];
  const bref = opts.ballRef ?? [st.ball.p[0], st.ball.p[2]];
  const from = [bref[0], BALL.radius, bref[1]];
  const sol = solvePass(from, choice.lead, { style: choice.style });
  if (!sol) { c.intent = null; return deny(st, 'balistique'); }   // ce plan n'a pas de vol : il meurt

  // QUELLE TECHNIQUE ? DEUX RÉGIMES, parce que le temps change la nature de la question.
  //
  // AVEC LE TEMPS (le cas normal) : le corps va REJOINDRE sa position de frappe avant de frapper —
  // il arrivera tourné vers la passe, la stance réalisée par construction. Interroger la table sur
  // la géométrie DU MOMENT pendant cette approche était l'oscillateur mesuré : en marchant autour
  // de son ballon, le porteur l'a transitoirement derrière lui, la table basculait sur talonnade /
  // déviation, l'ancre sautait de l'autre côté du corps, le plan repartait de zéro (refus d'ancre
  // sans AUCUN progrès sur 1 971 images, pertes par tacle 67 → 192). La géométrie transitoire d'une
  // approche n'est pas une situation de frappe : c'est le chemin vers elle. planStrike (approach.js)
  // choisit donc par ATTEIGNABILITÉ : la stance propre quand on peut la rejoindre dans
  // l'anticipation du geste, la surface improvisée quand son ancre est la seule à portée.
  const nearFoe = Math.min(...st.players.filter((q) => q.team !== c.team && q.down <= 0).map((q) => d2(q.p, c.p)), 99);
  // l'urgence est TEMPORELLE (holdMax) ou SITUATIONNELLE (opts.forceUrgent : ballon contesté — un
  // adversaire est en train de le gagner ; on le joue MAINTENANT, du geste légal le plus prompt)
  const urgent = opts.forceUrgent || st.hold >= cfg.holdMax - 0.1;
  const outYaw = Math.atan2(choice.lead[2] - bref[1], choice.lead[0] - bref[0]);
  let pick, move, stance, anchor;
  if (!urgent) {
    // les surfaces de PLAN : jouables sur un ballon posé (une « première » sur un ballon qu'on
    // s'est soi-même assis serait une contradiction — firstTime reste à l'improvisation)
    const cands = TECHNIQUES.filter((t) => t.intent === 'pass' && !t.firstTime).map((t) => ({
      clip: t.clip, pref: t.accuracy, antic: (MOVE_TIMING[t.clip] || MOVE_TIMING.passe).contact, data: t,
    }));
    // pendant une livraison, la MARCHE d'ici l'arrivée s'ajoute au chemin permis : le corps se
    // place pendant que le ballon voyage — c'est tout l'intérêt de planifier contre l'arrivée.
    // (rushedSlack N'EST PAS cfg.rushedSlack : celui-là vit sur l'échelle de score de la table des
    // techniques ; planStrike note sur l'échelle des préférences 0–1 et porte son propre défaut.)
    const plan = planStrike([c.p[0], c.p[2]], bref, outYaw, cands,
      { rushed: nearFoe < cfg.rushedRadius, extraReach: (opts.deliveryLeft ?? 0) * 3.0 });
    // UN REFUS PILOTE L'APPROCHE : même sans stance atteignable, le plan dit OÙ MARCHER (steer) —
    // sans ce cap, le porteur restait sur son standoff d'évasion à p50 = 1,07 m de l'ancre,
    // image après image, jusqu'au tacle (1 573 refus, 122 tacles, médiane de possession 0 passe).
    if (plan.steer) c.anchorHint = { p: plan.steer.anchor.p, t: st.t };
    if (!plan.best) { st._denyD?.push(plan.steer?.d ?? -1); return deny(st, 'ancre'); }
    // …ET LE PIED REJOINT UN BALLON POSÉ — OU QUI LE SERA À TEMPS. L'ancre est recalculée sur le
    // ballon vivant : engagée sur un ballon encore lancé, elle FUYAIT pendant l'armé (glissement
    // mesuré à 10,2 m/s). Donc, hors livraison : ballon posé (l'assise freine, le refus dure
    // quelques images). PENDANT une livraison : l'engagement est TEMPOREL — le contact du geste
    // doit tomber après l'arrivée du ballon au point contre lequel ce plan est construit ; l'armé
    // commence pendant que le ballon finit d'arriver, c'est le une-touche préparé. (Bloquer tout
    // engagement en livraison a été mesuré : +0,3 s d'exposition par possession, record 8,5 → 4.
    // Le une-touche n'était PAS le coupable des contrôles morts — c'étaient la touche d'évasion
    // du dribbleur sur la livraison et les hints survivants, corrigés par la chaîne d'autorité.)
    if (opts.deliveryLeft != null) {
      if (opts.deliveryLeft > (MOVE_TIMING[plan.best.clip] || MOVE_TIMING.passe).contact) return deny(st, 'livraison');
    } else if (Math.hypot(st.ball.v[0], st.ball.v[2]) > cfg.strikeBallMax) return deny(st, 'ballon-vif');
    pick = { tech: plan.best.data, foot: plan.best.foot };
    move = MOVE_TIMING[plan.best.clip] || MOVE_TIMING.passe;
    stance = STANCES[plan.best.clip] || STANCES.passe;
    anchor = plan.best.anchor;
  } else {
    // SANS LE TEMPS (holdMax) : plus d'approche possible — on improvise DEPUIS la géométrie réelle,
    // et c'est ici que la table joue son vrai rôle : quelle surface atteint CE ballon-là, posé là où
    // il est, dans ce regard-là. C'est la talonnade honnête, la déviation de première — pas un choix
    // de confort mais le dernier geste légal disponible.
    const tx = choice.lead[0] - c.p[0], tz = choice.lead[2] - c.p[2];
    const fx2 = Math.cos(c.yaw), fz2 = Math.sin(c.yaw);
    const outBearing = (Math.atan2(fx2 * tz - fz2 * tx, fx2 * tx + fz2 * tz) * 180) / Math.PI;
    const sit = situation(c.p, c.yaw, from, st.ball.v, from[1]);
    const topts = chooseTechnique(sit, 'pass', { firstTouch: false, outBearing });
    if (!topts.length) return deny(st, 'technique');
    // pressé (il l'est, par définition ici) : la vitesse départage les gestes DÉJÀ bons
    const antic = (o) => (MOVE_TIMING[o.tech.clip] || MOVE_TIMING.passe).contact;
    const good = topts.filter((o) => o.score >= topts[0].score - cfg.rushedSlack);
    pick = good.reduce((b, o) => (antic(o) < antic(b) ? o : b), good[0]);
    move = MOVE_TIMING[pick.tech.clip] || MOVE_TIMING.passe;
    stance = STANCES[pick.tech.clip] || STANCES.passe;
    anchor = anchorFor(bref, outYaw, pick.foot, stance);
    c.anchorHint = { p: anchor.p, t: st.t };
    // borné même en urgence : l'inatteignable reste un téléport déguisé, donc refusé
    if (!reachable([c.p[0], c.p[2]], anchor, move.contact, { adjustSpeed: 4.5, hardMax: 0.75 })) {
      st._denyD?.push(Math.hypot(anchor.p[0] - c.p[0], anchor.p[1] - c.p[2]));
      return deny(st, 'ancre');
    }
  }

  // IS IT TIME? Only answerable once the gesture is known, because the carve is that gesture's OWN
  // anticipation. A flat budget was wrong by more than a factor of two: `passe` contacts at 0.38 s and
  // `passePivot` at 0.52, so carving an average left the pivot exposed for a quarter of a second it did
  // not have — 8 of 21 swings tackled mid-windup, and possession collapsed. He commits exactly early
  // enough that the ball still leaves at holdMin, whichever gesture he chose.
  if (st.hold < cfg.holdMin - move.contact * cfg.windupCarve) return deny(st, 'timing');

  // LA COURSE. Le couloir de choosePass est une photo (des mètres perpendiculaires, MAINTENANT) ;
  // une interception est une COURSE (des secondes, pendant le vol). Mesuré sur 4 parties : les
  // passes interceptées avaient 2,59 m de marge médiane à la décision — et jusqu'à 7 m. Sept mètres
  // ne se ferment pas en 0,4 s d'armé : c'est le modèle qui était faux, pas la défense qui était
  // rapide. On fait donc courir la défense sur le VRAI vol résolu (flightRace), EN MIROIR EXACT de
  // ce qu'elle fera (assignJobs) : elle réagit AU DÉPART du ballon — pas pendant l'armé — depuis là
  // où l'armé l'aura laissée (positions PROJETÉES de move.contact ; le premier modèle donnait à
  // tous l'armé complet d'avance à pleine vitesse, et le jeu est tombé à 1 passe par partie — une
  // défense d'oracles n'existe pas plus qu'une défense aveugle). Si elle gagne sur le receveur, la
  // passe est REFUSÉE et le receveur mis en VETO un instant — sinon choosePass re-propose la même
  // ligne condamnée image après image. À holdMax le veto tombe : forcé, on joue le moins mauvais.
  const T = move.contact;
  const defs = st.players.filter((q) => q.team !== c.team && q.down <= 0);
  const race = flightRace(from, sol, defs.map((q) => [q.p[0] + q.v[0] * T, 0, q.p[2] + q.v[1] * T]), { speed: cfg.speeds.chase });
  const rec = st.players[choice.to.id];
  const meet = rec ? interceptPoint(race.path, [rec.p[0] + rec.v[0] * T, 0, rec.p[2] + rec.v[1] * T], cfg.speeds.chase, { reaction: 0 }) : null;
  if (!urgent && st.hold < cfg.holdMax && race.first && (!meet || race.first.t < meet.t + cfg.raceSlack)) {
    (st.laneVeto ??= {})[choice.to.id] = st.t + cfg.vetoTtl;
    c.intent = null;                                        // course perdue : le plan meurt, on re-décide
    return deny(st, 'course');
  }

  // HE COMMITS TO THE GESTURE. The ball does NOT leave here — it leaves when the swing reaches its
  // contact frame, which is the whole inversion (see gesture.js). What used to happen was: strike the
  // ball, then ask the character for a pose, and start that pose AT its contact frame so the leg would
  // not still be winding up while the ball was already gone. That bought synchronisation by throwing
  // away the entire beginning of the movement — which is why there was no visible movement.
  c.foot = pick.foot;
  c.intent = null;                                          // l'intention a abouti : le geste prend le relais
  startGesture(c, { id: pick.tech.clip, ...move }, { payload: { kind: 'pass', choice, pick, stance, outYaw, from: [c.p[0], c.p[2]], fromYaw: c.yaw }, log: st.gestures });
  st.events.push({ t: +st.t.toFixed(2), type: 'windup', by: c.id, tech: pick.tech.id, move: pick.tech.clip, foot: pick.foot, anticipation: move.contact });
  return true;
}

/**
 * THE CONTACT. Called by the gesture clock at the swing's contact frame — this is the instant the
 * ball is struck, and the only instant it may be.
 *
 * The pass is re-solved HERE rather than reused from the decision: the receiver has been running for
 * the length of the windup, and hitting the spot he occupied when the passer made up his mind is how
 * you get a ball played behind a man. Aiming at where he is NOW is both more correct and more honest —
 * the geometry recorded on the event is the geometry the strike actually had.
 */
function strikeNow(st, c, cfg) {
  const { choice, pick, stance } = c.act.payload;
  const rec = st.players[choice.to.id];
  const from = [st.ball.p[0], BALL.radius, st.ball.p[2]];
  const lead = rec ? [rec.p[0] + rec.v[0] * 0.18, 0, rec.p[2] + rec.v[1] * 0.18] : choice.lead;
  const sol = solvePass(from, lead, { style: choice.style }) || solvePass(from, choice.lead, { style: choice.style });
  if (!sol) { st.ball.impulse([-st.ball.v[0] * 0.4, 0, -st.ball.v[2] * 0.4]); return; }   // scuffed: it stays loose
  // ON FRAPPE LE BALLON LÀ OÙ IL EST. `kick(from, …)` POSAIT le ballon sur `from`, et l'appelant
  // construisait `from = [x, BALL.radius, z]` : un ballon en l'air était plaqué au sol avant d'être
  // frappé — 13 fois par partie, jusqu'à 1,36 m de chute en une image. Purement vertical, donc
  // invisible sur une trace vue de dessus. `strike()` ne touche qu'à la vitesse et à l'effet.
  st.ball.strike({ speed: sol.speed, dirYaw: sol.dirYaw, elevation: sol.elevation, spinAxis: [0, 1, 0], spinRev: 0 });
  st.phase = 'flight';
  st.pass = { from: c.id, to: choice.to.id, lead, style: choice.style, t: st.t, flight: sol.flightTime, error: sol.error, origin: [from[0], from[2]] };
  st.lastPasser = c.id;
  st.possession.carrier = -1;
  st.hold = 0; st.pressure = 0;
  const sit = situation(c.p, c.yaw, from, [0, 0, 0], from[1]);
  const tx = lead[0] - c.p[0], tz = lead[2] - c.p[2];
  const fx = Math.cos(c.yaw), fz = Math.sin(c.yaw);
  const outBearing = (Math.atan2(fx * tz - fz * tx, fx * tx + fz * tz) * 180) / Math.PI;
  st.events.push({
    t: +st.t.toFixed(2), type: 'pass', from: c.id, to: choice.to.id, style: choice.style, foot: c.foot,
    margin: +choice.lane.margin.toFixed(2),
    bearing: +sit.bearing.toFixed(1), ballDist: +sit.dist.toFixed(2), ballY: +from[1].toFixed(2), speed: +sol.speed.toFixed(1),
    // the TECHNIQUE the gesture actually was, with the geometry it was chosen on — a later re-measure
    // is a different picture, so the action carries its own justification
    tech: pick.tech.id, surface: pick.surface, side: sit.side, dist: +sit.dist.toFixed(2), height: +from[1].toFixed(2), out: +outBearing.toFixed(1),
    // L'ÉCART DE STANCE RÉALISÉ — la question de l'audit (« le pied est-il là où le geste le suppose ? »)
    // devenue un nombre sur chaque frappe. dist en m ; relèvement en °, signé côté pied frappeur.
    stanceD: stance ? +Math.abs(sit.dist - stance.dist).toFixed(3) : null,
    // « positif côté pied frappeur » se lit sur sit.side, pas sur une multiplication aveugle par le
    // pied : pour un gaucher, un ballon à gauche EST côté frappeur (+24°), et l'ancienne formule le
    // comptait −24 — 48° d'erreur fantôme sur la moitié des passes, attrapée à la première mesure.
    // replié dans [−180, 180] : une talonnade à 168° comparée sans repli donnait −336°
    stanceB: stance ? +((((sit.side === pick.foot ? 1 : -1) * sit.bearing - stance.bearing + 540) % 360) - 180).toFixed(1) : null,
  });
}

/**
 * THE GESTURE CLOCK — every actor, every phase. A follow-through does not stop because the ball has
 * left or because possession changed; that is exactly the defect this runs outside the phase machine
 * to avoid. The only thing that cuts a swing short is a named interruption.
 */
function stepGestures(st, dt, cfg) {
  for (const p of st.players) {
    if (!p.act) continue;
    // CLOSED DOWN MID-SWING. The windup is a real window: a defender who arrives during it takes the
    // ball off you. This is what makes pressing worth doing, and it did not exist while the ball left
    // at the instant of the decision — there was no interval to attack.
    if (winding(p) && st.phase === 'carry' && st.possession.carrier === p.id) {
      // TAKING THE BALL OFF A MAN MID-SWING IS A BLOCK, NOT A TACKLE. Standing near him is no longer
      // enough — the defender has to have got to the BALL first. Without this the windup was simply
      // fatal: pressure had already been accumulating through the dribble, so the extra 0.4 s of swing
      // pushed every close defender past tackleTime and possession collapsed (record halved, turnovers
      // doubled). A swing you have already started is not the same target as a man still dribbling,
      // and the geometry says so: get to the ball or you do not get it.
      const press = st.players.filter((q) => q.team !== p.team && q.down <= 0
        && d2(q.p, p.p) < cfg.tackleRadius && d2(q.p, st.ball.p) < d2(p.p, st.ball.p));
      st.pressure = press.length ? st.pressure + dt : 0;
      // AND THE BALL TRAVELS WITH HIM. Nobody stops dead to pass. While the swing runs, the dribble is
      // suspended (he is not taking new touches), and the ball was simply being left where it lay while
      // he ran on — so the strike happened off a stale position and his separation fell from 2.09 m to
      // 1.53 m, which is the difference between passing on the move and being a statue. The ball is at
      // his feet: it goes where he goes until the boot sends it somewhere else.
      // LE COUPLE CORPS-BALLON EST SOUDÉ PENDANT L'ARMÉ — dans les deux sens. Avant : le corps
      // décélérait (il s'engage) pendant que le ballon gardait son inertie ; mesuré, le couple
      // divergeait de 0,4 m pendant le geste et le pied frappait du vide. Maintenant :
      //   le BALLON FREINE (escort vers zéro : un joueur qui plante son appui a posé son ballon —
      //   c'est une vitesse relaxée, l'intégrateur déplace, la continuité tient) — SAUF si une
      //   LIVRAISON de contrôle voyage encore vers lui : elle est l'autorité du ballon jusqu'à
      //   l'arrivée (un armé une-touche commence pendant qu'elle finit — freiner ici la tuerait) ;
      if (!(st._settling && st.t < st._settling.at)) st.ball.escort([0, 0], dt, { tau: 0.09 });
      //   et le CORPS GLISSE SUR L'ANCRE de la stance (approach.glide) : les derniers décimètres se
      //   règlent pendant l'armé, comme un vrai joueur ajuste ses derniers appuis. La vitesse écrite
      //   est celle du glissement, pour que l'inertie et l'animation lisent le mouvement réel.
      if (p.act.payload?.stance) {
        const A = p.act.payload;
        // l'ancre se recalcule sur le ballon COURANT : il freine encore de quelques centimètres au
        // début de l'armé, et une ancre figée sur sa position d'engagement raterait de ce freinage.
        const anchor = anchorFor([st.ball.p[0], st.ball.p[2]], A.outYaw, A.pick.foot, A.stance);
        // …et l'ancre reste DANS le carré : un ballon joué près de la ligne peut demander un corps
        // de l'autre côté d'elle — le joueur s'arrête à la craie, il ne la traverse pas. Sans cette
        // clampe, le glissement poussait dehors pendant que movePlayers replaquait dedans.
        anchor.p[0] = Math.max(-st.area[0] / 2, Math.min(st.area[0] / 2, anchor.p[0]));
        anchor.p[1] = Math.max(-st.area[1] / 2, Math.min(st.area[1] / 2, anchor.p[1]));
        const t01 = Math.min(1, p.act.t / Math.max(1e-4, p.act.anticipation));
        const g = glide(A.from, A.fromYaw, anchor, t01);
        // ON CONTOURNE SON BALLON, ON NE LE TRAVERSE PAS : la droite d'un glissement peut passer
        // par le point où le ballon est posé (l'ancre est de l'autre côté de lui) — le chemin est
        // poussé radialement hors du cercle du ballon. Les stances finissent toutes au-delà de ce
        // rayon (talonnade 0,38 m > 0,32), donc le contournement ne combat jamais l'arrivée.
        {
          const bx = g.p[0] - st.ball.p[0], bz = g.p[1] - st.ball.p[2];
          const bd = Math.hypot(bx, bz), AVOID = 0.32;
          if (bd < AVOID && bd > 1e-6) { g.p[0] = st.ball.p[0] + (bx / bd) * AVOID; g.p[1] = st.ball.p[2] + (bz / bd) * AVOID; }
        }
        // L'ACTIONNEUR EST BORNÉ : le corps rejoint la courbe du glissement à vitesse humaine au
        // plus (même loi que le lacet : une demande, un taux borné). La borne rend STRUCTURELLE la
        // clause « aucun joueur au-dessus de 8,4 m/s » — sans elle, une ancre qui fuit (ballon
        // encore vivant, cas d'urgence) faisait poursuivre le glissement au-delà de 10 m/s.
        {
          const ex = g.p[0] - p.p[0], ez = g.p[1] - p.p[2];
          const el = Math.hypot(ex, ez), cap = cfg.glideMax * dt;
          const k = el > cap ? cap / el : 1;
          p.v[0] = (ex * k) / Math.max(1e-4, dt);
          p.v[1] = (ez * k) / Math.max(1e-4, dt);
          p.p[0] += ex * k; p.p[2] += ez * k;
        }
        p.yaw = g.yaw; p.yawWant = null;
        p.speed = Math.hypot(p.v[0], p.v[1]);
      }
      if (st.pressure >= cfg.tackleTime) {
        abortGesture(p, 'fermé pendant l’armé', { log: st.gestures });
        receive(st, press[0].id, cfg);
        continue;
      }
    }
    if (stepGesture(p, dt, { log: st.gestures }) === 'contact' && p.act?.payload?.kind === 'pass') strikeNow(st, p, cfg);
  }
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
    p.intent = null; p.anchorHint = null;  // une possession neuve décide pour elle-même — le plan
    //                                        ET le cap de l'ancien plan (un hint survivant pilotait
    //                                        la première demi-seconde vers l'ancre d'un autre monde)
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
      const mv = MOVE_TIMING[pick.tech.clip];
      const T = Math.max(0.12, (mv?.duration ?? 0.5) - (mv?.contact ?? 0.2));
      const foe = st.players.filter((q) => q.team !== p.team && q.down <= 0)
        .reduce((b, q) => (!b || d2(q.p, p.p) < d2(b.p, p.p) ? q : b), null);
      let tx = Math.cos(p.yaw), tz = Math.sin(p.yaw);
      if (foe) {
        const ax = p.p[0] - foe.p[0], az = p.p[2] - foe.p[2], al = Math.hypot(ax, az) || 1;
        tx = ax / al; tz = az / al;
      }
      p.yawWant = Math.atan2(tz, tx);              // he turns ONTO it — movePlayers slews, never snaps
      const lat = pick.foot === 'left' ? 1 : -1;               // left of forward is (fz, -fx) here
      // UN CONTRÔLE EST UNE IMPULSION, PAS UNE TÉLÉPORTATION. C'était le pire des cinq sites : 208
      // sauts par partie, 0,93 m en moyenne et 1,70 m au pire — le ballon APPARAISSAIT au pied. Un
      // vrai contrôle amortit le ballon et l'envoie où le joueur le veut ; il y ARRIVE pendant
      // l'accompagnement du geste, qui dure justement ce qu'il faut. `solveGroundLeg` inverse la
      // balistique au sol sur ball.js lui-même (roulement + traînée), donc la vitesse donnée produit
      // vraiment la distance voulue dans le temps voulu.
      // ON VISE OÙ LE PIED SERA, PAS OÙ IL EST. Le ballon met le temps de l'accompagnement à arriver ;
      // pendant ce temps le joueur a couru. Viser sa position actuelle, c'est poser le ballon là où il
      // ÉTAIT — ce qui se voit exactement comme le défaut d'origine, en moins brutal.
      // …À 0,65 DE LA VITESSE, PAS 1,0 : le receveur DÉCÉLÈRE dans sa réception (l'amorti d'arrivée
      // de movePlayers freine en approchant la cible), donc projeter sa vitesse INSTANTANÉE sur
      // toute la durée du geste vise au-delà de lui — mesuré sur 6 graines : 5,2 % de contrôles
      // finissant à plus d'un mètre, tous entre 1,0 et 1,2 m (le ballon dépasse l'homme qui
      // ralentit). Le facteur est balayé, pas choisi : 1,0 → 5,2 %, 0,65 → 2,9 %, 0,45 → 3,7 %
      // (trop court fait l'erreur inverse). 0,65 ≈ la vitesse moyenne d'un freinage linéaire.
      const settleX = p.p[0] + p.v[0] * T * 0.65 + tx * cfg.controlSettle + tz * lat * cfg.footSide;
      const settleZ = p.p[2] + p.v[1] * T * 0.65 + tz * cfg.controlSettle - tx * lat * cfg.footSide;
      const dx0 = settleX - st.ball.p[0], dz0 = settleZ - st.ball.p[2];
      const D = Math.hypot(dx0, dz0);
      const v0 = D > 0.02 ? solveGroundLeg(D, T) : 0;
      // `null` = ce ballon ne peut pas être amené là en si peu de temps. C'est une vraie réponse : le
      // contrôle est manqué, le ballon file. Un solveur qui répondrait quand même mentirait.
      if (v0 == null) {
        st.ball.impulse([-st.ball.v[0] * (1 - pick.tech.power), 0, -st.ball.v[2] * (1 - pick.tech.power)]);
      } else {
        const ux = D > 1e-6 ? dx0 / D : tx, uz = D > 1e-6 ? dz0 / D : tz;
        st.ball.impulse([ux * v0 - st.ball.v[0], -st.ball.v[1], uz * v0 - st.ball.v[2]]);
      }
      // le point d'ARRIVÉE fait partie de l'état de la livraison : c'est contre LUI que le nouveau
      // porteur planifie sa prochaine passe pendant que le ballon voyage (voir beginPass — un vrai
      // joueur se place pour la suite pendant que le ballon vient à lui, pas après)
      st._settling = { ev: st.events.length, id, at: st.t + T, p: [settleX, settleZ] };
      st.events.push({
        t: +st.t.toFixed(2), type: 'control', by: id, tech: pick.tech.id, foot: pick.foot, surface: pick.surface,
        bearing: +sit.bearing.toFixed(1), side: sit.side, dist: +sit.dist.toFixed(2), height: +sit.height.toFixed(2),
        speed: +Math.hypot(st.ball.v[0], st.ball.v[2]).toFixed(1),
        // OÙ LE BALLON A FINI, relativement au joueur — le nombre que la règle juge. Il n'existe PAS
        // encore à cet instant : le contrôle est devenu continu, le ballon met l'accompagnement du
        // geste à arriver. L'inscrire maintenant, ce serait inscrire l'intention à la place du
        // résultat (mesuré : 0,8 m au contact contre 0,36 m à l'arrivée). Il est rempli plus bas,
        // quand le ballon est vraiment arrivé.
        settle: null,
      });
    } else {
      // nobody had a legal touch for that ball: it is not magically killed, it runs
      st.ball.impulse([-st.ball.v[0] * 0.25, 0, -st.ball.v[2] * 0.25]);
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
    // Un tacle ne fait pas APPARAÎTRE le ballon près du tacleur (39 sauts par partie, 1,77 m en
    // moyenne, 2,56 m au pire) : le pied le RENVOIE vers lui. Une impulsion, dont l'intégrateur fait
    // une course — on voit le ballon revenir, ce qui est le geste.
    const bx = p.p[0] - st.ball.p[0], bz = p.p[2] - st.ball.p[2];
    const bl = Math.hypot(bx, bz) || 1;
    const back = Math.min(4.5, bl / 0.28);
    st.ball.impulse([(bx / bl) * back - st.ball.v[0], -st.ball.v[1], (bz / bl) * back - st.ball.v[2]]);
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
  stepGestures(st, dt, cfg);           // swings run on their own clock, outside the phase machine
  // les contraintes du monde se projettent APRÈS toutes les autorités (locomotion PUIS glissement
  // d'armé) — projetées avant, le dernier écrivain les défaisait (voir separatePlayers)
  separatePlayers(st, cfg);
  // LA MESURE DU CONTRÔLE ARRIVE QUAND LE BALLON ARRIVE. Un contrôle continu n'a pas de résultat à
  // l'instant du contact ; l'écrire là reviendrait à noter l'intention. On remplit l'événement quand
  // le geste est fini, c'est-à-dire quand le fait existe.
  if (st._settling && st.t >= st._settling.at) {
    const pl = st.players[st._settling.id];
    const ev = st.events[st._settling.ev];
    if (pl && ev) {
      ev.settle = +d2(pl.p, st.ball.p).toFixed(2);
      // une PRÉPARATION : au moment où la livraison arrive, une décision PLUS RÉCENTE possède déjà
      // le corps — l'armé de la frappe suivante (winding), ou son intention en approche (intent).
      // La promesse du contrôle (« le ballon finit au pied ») a été remplacée par un plan plus
      // neuf ; la juger encore, c'est juger un geste contre le plan d'un autre. strike-stance juge
      // le contact qui suit (un instant, un contrat), et l'exemption est elle-même BORNÉE dans le
      // harnais (≤ 40 % des contrôles) pour qu'elle ne devienne pas la norme en silence.
      if (winding(pl) || pl.intent) ev.oneTouche = true;
    }
    st._settling = null;
  }

  if (st.phase === 'carry') {
    const c = st.players[st.possession.carrier];
    if (!c) { st.phase = 'loose'; return st; }

    // A GESTURE IN PROGRESS OWNS THE PLAYER. He has committed: he does not re-decide and he does not
    // dribble — he plants and swings, and the ball leaves at the CONTACT instant of that swing. The
    // gesture itself is advanced by stepGestures(), for every actor and in every phase, because a
    // follow-through does not stop because the ball has left.
    if (busy(c)) { st.hold += dt; return st; }

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
    // LA TOUCHE SE POSE QUAND LA PASSE EST CHOISIE. Piloter le corps vers l'ancre sans poser le
    // ballon était un TAPIS ROULANT, mesuré tel quel : l'ancre est soudée au ballon, la conduite
    // poussait le ballon côté fuite à la vitesse où le corps marchait côté passe — la distance aux
    // refus n'a pas bougé d'un centimètre (p50 1,07 → 1,09 m, 1 735 refus). Un joueur qui a choisi
    // sa passe ne martèle pas son ballon vers l'avant pendant qu'il se place : il le POSE (escort
    // vers zéro, relaxé — l'intégrateur déplace, la continuité tient), et l'armé continue ce même
    // freinage. L'évasion reprend telle quelle si l'intention expire (0,4 s sans être rafraîchie).
    // UNE AUTORITÉ PAR BALLON, PAR PHASE — la chaîne est explicite et exclusive :
    //   1. LIVRAISON en vol (st._settling) → PERSONNE ne touche le ballon. Le contrôle a calculé sa
    //      vitesse pour qu'il ARRIVE (solveGroundLeg) ; le freiner le tuait (17,6 % de contrôles
    //      morts à 1 m), et le laisser au dribbleur était pire d'une façon qu'il a fallu TRACER
    //      pour croire : le `want` du dribble est l'ÉVASION (c.push), pas le plan — la touche
    //      renvoyait la livraison ARRIVÉE (d = 0,30 m) repartir à l'opposé du corps pendant que le
    //      corps marchait vers la stance. Deux intentions sur un ballon = pantomime des deux.
    //   2. INTENTION fraîche → l'ASSISE (escort vers zéro) : le ballon se pose pour la frappe.
    //   3. Sinon → la CONDUITE (dribbleStep) : touches d'évasion, le jeu normal du porteur.
    const delivering = st._settling && st.t < st._settling.at;
    if (delivering) { /* la livraison est l'autorité : le ballon voyage, on se place (hint) */ }
    else if (c.anchorHint && st.t - c.anchorHint.t < 0.4) st.ball.escort([0, 0], dt, { tau: 0.22 });
    else dribbleStep(st._drb, st.ball, pl, dt);

    trySlide(st, cfg);                       // a touch that got away can be taken off him
    if (st.phase !== 'carry') return st;      // …and if it was, the phase has already changed
    // UN BALLON AU-DELÀ DE LA PORTÉE DE CONDUITE N'EST PLUS PORTÉ — IL EST LIBRE, ET LA PHASE LE
    // DIT. Mesuré (carry-reach 1,2 % → 19,1 %) : après un tacle glissé perdu ou un renversement,
    // le « porteur » est AU SOL avec le ballon à 3 m ; la phase disait encore carry, or le vol de
    // balle exige la proximité du PORTEUR — le défenseur garé sur le ballon ne pouvait pas le
    // réclamer, et l'impasse durait des secondes, étiquetée possession. Le seuil est CELUI DE LA
    // RÈGLE (carryMax) : au-delà, l'étiquette est fausse — c'est un 50/50, la phase libre applique
    // le premier-arrivé et l'impasse se dissout.
    if (d2(c.p, st.ball.p) > cfg.carryLoose) {
      st.phase = 'loose'; st.possession.carrier = -1; st.pass = null; st.hold = 0; st.pressure = 0;
      return st;
    }
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
    // THE WINDUP IS CARVED OUT OF THE HOLD, NOT ADDED TO IT. A first attempt at a windup simply
    // delayed every release by its length and the game fell apart — record 6, turnovers 25 → 103,
    // because every pass now had an extra beat for a defender to arrive in. The swing is not extra
    // time: it is the last part of the time he already had. He commits one anticipation EARLIER, so
    // the ball still leaves at holdMin. Same football, visible movement.
    // the earliest ANY gesture could need to start; beginPass then re-checks against the one it picked
    // DÉCIDER → PRÉPARER → S'ENGAGER, et la décision COLLE. Re-choisir la passe à chaque image
    // pendant que les portes disent non était un oscillateur, mesuré tel quel : le veto de course
    // bascule le receveur, outYaw saute, l'ANCRE passe de l'autre côté du ballon, et le corps —
    // piloté vers une cible qui change à 60 Hz — n'arrive jamais (refus d'ancre p50 = 1,02 m, sans
    // AUCUN progrès sur 1 637 refus ; pertes par tacle 67 → 182). Un joueur choisit SA passe puis
    // arrange ses appuis POUR ELLE : l'intention est adoptée une fois, elle pilote l'approche
    // jusqu'à s'engager — et elle ne meurt que de sa mort propre (course perdue, balistique nulle,
    // ou son délai : un plan qui n'a pas abouti en `intentTtl` est un plan mort, pas un dogme).
    if (st.hold >= Math.max(0, cfg.holdMin - cfg.windupBudget) && reachNow) {
      // PENDANT UNE LIVRAISON (contrôle en route vers le pied), on planifie CONTRE LE POINT
      // D'ARRIVÉE — pas contre le ballon en voyage (le corps partait vers l'ancre d'un ballon
      // mouvant : control-at-foot 1 % → 33 %), et pas rien du tout non plus (bloquer l'intention
      // pendant la livraison : 4 109 refus, 0,3 s d'exposition en plus, record 8,5 → 5). Un vrai
      // joueur pense sa suite pendant que le ballon vient : beginPass reçoit le point d'arrivée et
      // le temps de livraison restant, et n'accorde l'engagement que si le contact tombe après.
      const dlv = st._settling && st.t < st._settling.at && st._settling.id === c.id && st._settling.p ? st._settling : null;
      if (c.intent && (c.intent.until < st.t || !st.players[c.intent.choice.to.id] || st.players[c.intent.choice.to.id].team !== c.team)) c.intent = null;
      // ON NE POSE PAS SON BALLON SOUS UN ADVERSAIRE. L'assise freine le ballon ; un ballon
      // immobile avec un défenseur DESSUS n'est plus une possession, c'est un duel — mesuré :
      // l'adversaire venait se garer à 0,11 m du ballon posé (le modèle ne lui donne pas encore le
      // vol de balle debout, c'est le chantier « duel/protection »), et carrier-owns-the-ball est
      // monté à 58,6 % des images de conduite. Le prédicat est CELUI DE LA RÈGLE — l'adversaire
      // BAT le porteur au ballon (plus près que lui de l'écart de tolérance, ET à portée de jeu) —
      // pas « un adversaire est proche » : dans un rondo le presseur vit à moins d'un mètre du
      // ballon, c'est sa définition, et ce prédicat-là a étranglé le jeu à 98 passes / 505 tacles
      // (14 073 refus). Contesté ⇒ l'intention meurt et la CONDUITE reprend : les touches
      // d'évasion emmènent le ballon hors de l'emprise — ce qu'un vrai porteur fait d'un ballon
      // disputé.
      const foeBall = Math.min(...st.players.filter((q) => q.team !== c.team && q.down <= 0).map((q) => d2(q.p, st.ball.p)), 99);
      const contested = foeBall < cfg.contestRadius && foeBall < d2(c.p, st.ball.p) - cfg.contestSlack;
      if (contested) {
        // UN BALLON CONTESTÉ SE JOUE MAINTENANT — pas « se re-dribble sur place ». Reprendre
        // l'évasion laissait le cycle se répéter (le défenseur suit le ballon : garé, délogé,
        // regaré — carrier-owns-the-ball 60,8 % en 5 c. 5). Un joueur de rondo dont le ballon est
        // disputé le sort DU PREMIER GESTE LÉGAL (improvisation d'urgence, veto de course levé :
        // le moins mauvais ballon vaut mieux que le duel qu'on est en train de perdre) ; s'il n'y a
        // AUCUN geste légal, alors seulement l'évasion reprend.
        if (c.intent) c.intent = null;
        deny(st, 'contesté');
        const choice = choosePass(st, cfg);
        if (choice) beginPass(st, choice, cfg, { forceUrgent: true, ...(dlv ? { ballRef: dlv.p, deliveryLeft: dlv.at - st.t } : {}) });
      } else if (!c.intent) {
        const choice = choosePass(st, cfg);
        if (choice && (choice.score > 3.2 || st.hold >= cfg.holdMax)) c.intent = { choice, until: st.t + cfg.intentTtl };
      }
      if (c.intent) {
        // l'intention vise le receveur VIVANT : la mène se rafraîchit sur sa course réelle — c'est
        // le même receveur, pas une re-décision (strikeNow re-résout de toute façon au contact)
        const rec = st.players[c.intent.choice.to.id];
        c.intent.choice.lead = [rec.p[0] + rec.v[0] * 0.28, BALL.radius, rec.p[2] + rec.v[1] * 0.28];
        beginPass(st, c.intent.choice, cfg, dlv ? { ballRef: dlv.p, deliveryLeft: dlv.at - st.t } : {});
      }
    }
  } else {
    st.ball.integrate(dt);
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
    // LA seule discontinuité légitime — et elle se DÉCLARE. `restart()` lève si la cause est absente
    // ou inconnue : ce qui est exceptionnel doit se nommer, sinon ça redevient le chemin normal.
    st.ball.restart([
      Math.max(-st.area[0] / 2 + 1, Math.min(st.area[0] / 2 - 1, st.ball.p[0])), BALL.radius,
      Math.max(-st.area[1] / 2 + 1, Math.min(st.area[1] / 2 - 1, st.ball.p[2])),
    ], { cause: 'sortie-de-but' });
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
