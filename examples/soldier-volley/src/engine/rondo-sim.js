import { BALL, stepBall, kick } from './ball.js';
import { predictPath } from './ball-predict.js';
import { solvePass, solveGroundLeg, flightRace, interceptPoint } from './ball-predict.js';
import { makeDribbler, dribbleStep, dribbleSteer } from './dribble.js';
import { RONDO, assignJobs, choosePass, strikingFoot, rondoInternals } from './rondo.js';
import { situation, chooseTechnique, checkAction, TECHNIQUES, byId, footFor } from './technique.js';
import { gauss } from './attributes.js';
import { MOVES } from './animkit.js';
import { startGesture, stepGesture, abortGesture, busy, winding, following, checkGestures } from './gesture.js';
import { STANCES, anchorFor, reachable, glide, planStrike } from './approach.js';

// rondo-sim — the game loop of the possession game, headless. Everything that decides whether a
// "passe à dix" is won or lost happens here: when the carrier releases, whether the pass beats the
// press, whether a defender reads it, and who ends up with the ball. Because it runs with no
// renderer, the whole match can be proved in node (verify-rondo) before it is ever drawn.

const d2 = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const { movePlayers, separatePlayers, turnover } = rondoInternals;

/** Le POINT DU PIED du porteur — où un ballon porté vit : devant le pied de contrôle, mêmes
 *  décalages que la touche directionnelle du receive (controlSettle devant, footSide côté pied).
 *  CLAMPÉ DANS LE CARRÉ : un porteur debout SUR la ligne portait son ballon 0,34 m dehors — mesuré,
 *  6 sorties de but sur 3 graines avec un ballon PORTÉ (le porteur sortait son propre ballon en
 *  le protégeant). Le joueur s'arrête à la craie ; son ballon aussi. */
const footPoint = (st, p, cfg) => {
  const fx = Math.cos(p.yaw), fz = Math.sin(p.yaw);
  const lat = p.foot === 'left' ? 1 : -1;
  const m = BALL.radius + 0.02;
  return [Math.max(-st.area[0] / 2 + m, Math.min(st.area[0] / 2 - m, p.p[0] + fx * cfg.controlSettle + fz * lat * cfg.footSide)),
          Math.max(-st.area[1] / 2 + m, Math.min(st.area[1] / 2 - m, p.p[2] + fz * cfg.controlSettle - fx * lat * cfg.footSide))];
};

/** Le POINT DE STANCE : où le geste veut le ballon relativement à CE corps (l'inverse exact
 *  d'anchorFor — ballon = corps + R(yaw + β·côté)·dist, même convention de signe). */
const stanceBallPoint = (p, stance, foot) => {
  const side = foot === 'left' ? 1 : -1;
  const a = p.yaw + stance.bearing * side * (Math.PI / 180);
  return [p.p[0] + Math.cos(a) * stance.dist, p.p[2] + Math.sin(a) * stance.dist];
};

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
 * (La machinerie « planifier contre le point d'arrivée d'une livraison » a vécu ici — 4 109 refus
 * mesurés quand on bloquait, 33 % de contrôles morts quand on planifiait contre le ballon en
 * voyage. Elle est morte avec la CAPTURE : le contrôle POSSÈDE le ballon dès le contact et le
 * porté l'amène au pied — le ballon du plan est simplement le ballon réel.)
 */
function beginPass(st, choice, cfg, opts = {}) {
  const c = st.players[st.possession.carrier];
  const bref = [st.ball.p[0], st.ball.p[2]];
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
    // (rushedSlack N'EST PAS cfg.rushedSlack : celui-là vit sur l'échelle de score de la table des
    // techniques ; planStrike note sur l'échelle des préférences 0–1 et porte son propre défaut.)
    // UN BALLON PORTÉ CHANGE LA NATURE DE L'ANCRE. Porté, le ballon est soudé au corps : l'ancre
    // (calculée depuis le ballon) MARCHE AVEC le porteur, et la borne serrée des ballons libres
    // (0,6 m — calibrée contre une ancre qui FUIT) devient un mur infranchissable — mesuré : 6 495
    // refus à p50 = 0,84 m sans AUCUNE convergence, le porteur traînant le couple hors du carré
    // (75 sorties). Rejoindre la stance d'un ballon porté n'est pas une marche vers un point du
    // monde : c'est ARRANGER LE COUPLE (pivoter, un demi-pas) — corps et ballon glissent ensemble,
    // le glissement de l'armé fait les deux, et la borne est celle d'un ajustement à deux pas.
    const carried = st.ball.owner === c.id;
    const plan = planStrike([c.p[0], c.p[2]], bref, outYaw, cands,
      { rushed: nearFoe < cfg.rushedRadius, ...(carried ? { hardMax: 1.0, adjustSpeed: 4.2 } : {}) });
    // UN REFUS PILOTE L'APPROCHE : même sans stance atteignable, le plan dit OÙ MARCHER (steer) —
    // sans ce cap, le porteur restait sur son standoff d'évasion à p50 = 1,07 m de l'ancre,
    // image après image, jusqu'au tacle (1 573 refus, 122 tacles, médiane de possession 0 passe).
    if (plan.steer) c.anchorHint = { p: plan.steer.anchor.p, t: st.t };
    if (!plan.best) { st._denyD?.push(plan.steer?.d ?? -1); return deny(st, 'ancre'); }
    // …ET LE PIED REJOINT UN BALLON POSÉ — OU PORTÉ. Un ballon PORTÉ est déjà à soi : sa vitesse
    // est celle du porteur et l'ancre bouge AVEC lui, cohérente (le carry le tient au pied) — la
    // porte ballon-vif ne concerne que les ballons LIBRES, dont l'ancre fuyait pendant l'armé
    // (glissement mesuré à 10,2 m/s avant la porte). La branche « livraison » est morte avec la
    // capture : le contrôle possède le ballon dès le contact, il n'y a plus de vol à attendre.
    if (st.ball.owner !== c.id && Math.hypot(st.ball.v[0], st.ball.v[2]) > cfg.strikeBallMax) return deny(st, 'ballon-vif');
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
    // MÊME L'URGENCE NE FRAPPE PAS UN BALLON QUI FILE. L'improvisation choisit sa surface sur la
    // géométrie RÉELLE de l'engagement — mais le ballon libre d'un duel bouge encore pendant
    // l'armé, et la géométrie du contact n'est plus celle du choix : mesuré (verify-approach),
    // l'écart de stance p90 est monté de 0,05 à 0,104 m et le relèvement à 18° quand la patience
    // du conteste a laissé les balles d'urgence partir de ballons dribblés à 2-4 m/s. La borne est
    // plus lâche que celle du plan (l'urgence a moins le choix), mais elle existe : au-delà, on
    // continue de conduire — le refus se nomme.
    if (st.ball.owner !== c.id && Math.hypot(st.ball.v[0], st.ball.v[2]) > cfg.strikeBallMax * 1.6) return deny(st, 'ballon-vif');
    // pressé (il l'est, par définition ici) : la vitesse départage les gestes DÉJÀ bons
    const antic = (o) => (MOVE_TIMING[o.tech.clip] || MOVE_TIMING.passe).contact;
    const good = topts.filter((o) => o.score >= topts[0].score - cfg.rushedSlack);
    pick = good.reduce((b, o) => (antic(o) < antic(b) ? o : b), good[0]);
    move = MOVE_TIMING[pick.tech.clip] || MOVE_TIMING.passe;
    stance = STANCES[pick.tech.clip] || STANCES.passe;
    anchor = anchorFor(bref, outYaw, pick.foot, stance);
    c.anchorHint = { p: anchor.p, t: st.t };
    // borné même en urgence : l'inatteignable reste un téléport déguisé, donc refusé
    // (porté : le couple s'arrange ensemble — la borne est celle du plan, pas celle du ballon libre)
    if (!reachable([c.p[0], c.p[2]], anchor, move.contact, st.ball.owner === c.id ? { adjustSpeed: 4.5, hardMax: 1.15 } : { adjustSpeed: 4.5, hardMax: 0.75 })) {
      st._denyD?.push(Math.hypot(anchor.p[0] - c.p[0], anchor.p[1] - c.p[2]));
      return deny(st, 'ancre');
    }
  }

  // IS IT TIME? Only answerable once the gesture is known, because the carve is that gesture's OWN
  // anticipation. A flat budget was wrong by more than a factor of two: `passe` contacts at 0.38 s and
  // `passePivot` at 0.52, so carving an average left the pivot exposed for a quarter of a second it did
  // not have — 8 of 21 swings tackled mid-windup, and possession collapsed. He commits exactly early
  // enough that the ball still leaves at holdMin, whichever gesture he chose.
  // …et le holdMin est CONDITIONNEL (st._holdMin, posé par la boucle de conduite) : 0,8-1,0 s au
  // calme, l'ancien 0,35 s sous pression — le remède du hold p50 = 0,38 s du flipper mesuré.
  // …mais un TIR est un geste d'OPPORTUNITÉ : la tenue délibérée du jeu posé ne s'applique pas à
  // une fenêtre de but (mesuré : 27 refus 'timing', 0 tir en 120 s — l'occasion fermait pendant
  // que le porteur « posait » son ballon)
  const holdGate = opts.shot ? cfg.holdMin : (st._holdMin ?? cfg.holdMin);
  if (st.hold < holdGate - move.contact * cfg.windupCarve) return deny(st, 'timing');

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
  // un TIR ne se refuse pas à la course : le défenseur qui coupe, c'est le duel du tir même
  if (!opts.shot && !opts.clear && !urgent && st.hold < cfg.holdMax && race.first && (!meet || race.first.t < meet.t + cfg.raceSlack)) {
    (st.laneVeto ??= {})[choice.to.id] = st.t + cfg.vetoTtl;
    c.intent = null;                                        // course perdue : le plan meurt, on re-décide
    return deny(st, 'course');
  }

  // HE COMMITS TO THE GESTURE. The ball does NOT leave here — it leaves when the swing reaches its
  // contact frame, which is the whole inversion (see gesture.js). What used to happen was: strike the
  // ball, then ask the character for a pose, and start that pose AT its contact frame so the leg would
  // not still be winding up while the ball was already gone. That bought synchronisation by throwing
  // away the entire beginning of the movement — which is why there was no visible movement.
  // …ET UN BALLON LIBRE AU PIED, NON CONTESTÉ, EST CAPTURÉ À L'ENGAGEMENT. L'urgence frappait des
  // ballons libres qui dérivaient pendant l'armé : la surface choisie sur la géométrie du commit ne
  // trouvait plus la même au contact — mesuré (verify-approach), écart de relèvement p90 monté de
  // 5° à 11-18°, tous sur des passe-rapide d'urgence. Si le ballon est à lui (à portée de capture,
  // personne ne le bat au ballon), le porté du geste (carry au point de stance, stepGestures) rend
  // la stance vraie PAR CONSTRUCTION — c'est le même régime que la passe planifiée. Un ballon
  // réellement contesté, lui, reste libre : le duel a le droit de pourrir la géométrie.
  if (st.ball.owner == null && d2(c.p, st.ball.p) < cfg.captureRadius) {
    const foeBall = Math.min(...st.players.filter((q) => q.team !== c.team && q.down <= 0).map((q) => d2(q.p, st.ball.p)), 99);
    const beaten = foeBall < cfg.contestRadius && foeBall < d2(c.p, st.ball.p) - cfg.contestSlack;
    if (!beaten) st.ball.possess(c.id);
  }
  c.foot = pick.foot;
  c.intent = null;                                          // l'intention a abouti : le geste prend le relais
  startGesture(c, { id: pick.tech.clip, ...move }, { payload: { kind: 'pass', choice, pick, stance, urgent, outYaw, from: [c.p[0], c.p[2]], fromYaw: c.yaw }, log: st.gestures });
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
  const { choice, pick, stance, urgent } = c.act.payload;
  const rec = st.players[choice.to.id];
  const from = [st.ball.p[0], BALL.radius, st.ball.p[2]];
  // LE PIED NE FRAPPE JUSTE QUE LÀ OÙ LE GESTE LE SUPPOSE. Deux façons d'arriver au contact avec un
  // ballon qui n'est pas à sa stance : un ballon CONTESTÉ resté libre pendant l'armé (le duel a le
  // droit de pourrir la géométrie), et un porté qui n'a pas eu le temps d'ARRANGER le couple (armé
  // de 0,22 s juste après une remise en jeu : le servo n'a pas fini d'amener le ballon). Dans les
  // deux cas la frappe n'est pas une passe propre : c'est un ballon VENDANGÉ, qui part mou et reste
  // disputable. Mesuré avant cette porte : 2 passes/partie à 0,26 m / 46° de leur stance — la dette
  // strike-stance crevait son budget de 2 %. Le refus se nomme au registre.
  if (stance) {
    const sitNow = situation(c.p, c.yaw, from, st.ball.v, from[1]);
    const bNow = ((((sitNow.side === pick.foot ? 1 : -1) * sitNow.bearing - stance.bearing + 540) % 360) - 180);
    // les seuils vivent SOUS ceux de la règle strike-stance (0,25 m / 25°) : la porte du moteur
    // refuse AVANT que le catalogue ne condamne
    if (Math.abs(sitNow.dist - stance.dist) > 0.22 || Math.abs(bNow) > 22) {
      deny(st, 'stance-au-contact');
      if (st.ball.owner === c.id) st.ball.release('perte');              // la touche ratée le lui échappe
      st.ball.impulse([-st.ball.v[0] * 0.4, 0, -st.ball.v[2] * 0.4]);   // vendangé : le ballon reste libre
      return;
    }
  }
  // la re-mène du contact suit LA MÊME loi que le choix : une mène courte ici défaisait la mène
  // de course posée par choosePass (le tir garde sa cible fixe)
  const tRe = choice.shot ? 0 : (cfg.leadTime ? cfg.leadTime(Math.hypot((rec?.p[0] ?? 0) - from[0], (rec?.p[2] ?? 0) - from[2]), rec) : 0.18);
  let lead = rec ? [rec.p[0] + rec.v[0] * tRe, 0, rec.p[2] + rec.v[1] * tRe] : choice.lead;
  if (choice.shot && c.skill) {
    lead = [lead[0], lead[1], lead[2] + gauss(st.rnd ?? (() => 0.5)) * c.skill.shotSigma];
  }
  const sol = solvePass(from, lead, { style: choice.style }) || solvePass(from, choice.lead, { style: choice.style });
  if (!sol) { st.ball.impulse([-st.ball.v[0] * 0.4, 0, -st.ball.v[2] * 0.4]); return; }   // scuffed: it stays loose
  // ON FRAPPE LE BALLON LÀ OÙ IL EST. `kick(from, …)` POSAIT le ballon sur `from`, et l'appelant
  // construisait `from = [x, BALL.radius, z]` : un ballon en l'air était plaqué au sol avant d'être
  // frappé — 13 fois par partie, jusqu'à 1,36 m de chute en une image. Purement vertical, donc
  // invisible sur une trace vue de dessus. `strike()` ne touche qu'à la vitesse et à l'effet.
  // UN TIR EST UN GESTE DE PUISSANCE : solvePass rend la vitesse d'ARRIVÉE (trop douce pour
  // battre un gardien) — le tir prend un plancher (cfg.shotSpeed), même direction, vol tendu
  // L'ERREUR D'EXÉCUTION DU JOUEUR NOTÉ (attributes.js) : la planification est parfaite, la
  // FRAPPE dévie — bruit d'angle σ(passing), amplifié sous pression par le sang-froid ; le tir
  // disperse son point visé (σ(finishing), déjà appliqué sur lead avant la résolution). Un joueur
  // SANS notes ne tire aucun aléa : le flux seedé d'un monde non noté ne bouge pas d'un bit.
  const shot = !!choice.shot;
  let dirNoise = 0;
  if (c.skill && !shot && !choice.clear) {
    dirNoise = gauss(st.rnd ?? (() => 0.5)) * c.skill.passSigma * (urgent ? c.skill.composureF : 1);
  }
  sol.dirYaw += dirNoise;
  const speed = shot ? Math.max(sol.speed, cfg.shotSpeed ?? 17)
    : choice.clear ? Math.max(sol.speed, 13) : sol.speed;
  st.ball.strike({ speed, dirYaw: sol.dirYaw, elevation: shot ? Math.min(sol.elevation, 0.10) : sol.elevation, spinAxis: [0, 1, 0], spinRev: 0 });
  if (choice.clear) st.events.push({ t: +st.t.toFixed(2), type: 'clearance', by: c.id, foot: c.foot });
  if (shot) {
    st.events.push({ t: +st.t.toFixed(2), type: 'shot', by: c.id, foot: c.foot,
      range: choice.shotInfo?.range ?? null, clear: choice.lane?.margin ?? null,
      tz: choice.shotInfo?.tz ?? null, gkZ: choice.shotInfo?.gkZ ?? null, speed: +speed.toFixed(1) });
  }
  // LA PERCEPTION A UNE HORLOGE : le départ du ballon est un événement — mais l'armé était
  // VISIBLE. La défense paie max(0, réaction perso − armé vu) : une passe téléphonée s'anticipe,
  // une urgence courte se subit. (Consommé par la retenue de cible dans rondoStep.)
  st._surprise = { t: st.t, seen: c.act ? c.act.t : 0, n: (st._surprise?.n ?? 0) + 1 };
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
    // le RÉGIME de la frappe : une passe PLANIFIÉE a marché sur sa stance (l'approche la réalise au
    // degré près) ; une passe d'URGENCE improvise depuis la géométrie réelle d'un duel — deux
    // contrats différents (charte, loi 7), et l'événement dit lequel le juge.
    urgent: !!urgent,
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
      // …ET LE PRÉDICAT EST CELUI DU DUEL (pressPredicate) : à portée de jeu du BALLON, et qui BAT le
      // porteur au ballon — plus jamais « près du corps ». Le terme de la minuterie n'est plus une
      // bascule : c'est l'engagement d'un tacle-debout, que l'armé du porteur peut encore gagner
      // (son contact part avant celui du tacle → le tacle mord dans le vide, refus nommé).
      const press = pressPredicate(st, p, cfg);
      st.pressure = press.length ? st.pressure + dt : 0;
      // AND THE BALL TRAVELS WITH HIM. Nobody stops dead to pass. While the swing runs, the dribble is
      // suspended (he is not taking new touches), and the ball was simply being left where it lay while
      // he ran on — so the strike happened off a stale position and his separation fell from 2.09 m to
      // 1.53 m, which is the difference between passing on the move and being a statue. The ball is at
      // his feet: it goes where he goes until the boot sends it somewhere else.
      // LE COUPLE CORPS-BALLON EST SOUDÉ PENDANT L'ARMÉ — dans les deux sens. Avant : le corps
      // décélérait (il s'engage) pendant que le ballon gardait son inertie ; mesuré, le couple
      // divergeait de 0,4 m pendant le geste et le pied frappait du vide. Maintenant :
      //   le BALLON PORTÉ est porté AU POINT DE STANCE du corps qui glisse (carry) : le couple est
      //   soudé PAR CONSTRUCTION — au contact, la stance est vraie parce que le ballon est LÀ où le
      //   geste la définit, plus parce qu'un frein l'a laissé à peu près au bon endroit. Un ballon
      //   NON porté (frappe d'urgence sur ballon libre) garde l'ancien frein d'assise ;
      if (st.ball.owner === p.id && p.act.payload?.stance) {
        // tau 0,05 → 0,035 : l'armé le plus court du répertoire (passeRapide, contact 0,22 s) ne
        // laissait pas au servo le temps de finir d'ARRANGER le couple — mesuré, les passes rapides
        // planifiées partaient à 6-21° de leur stance (p90 du contrat d'approche 5° → 6,6). Le
        // porté reste continu, borné (vMax du carry), et l'audit de continuité tourne inchangé.
        st.ball.carry(stanceBallPoint(p, p.act.payload.stance, p.act.payload.pick.foot), dt, { tau: 0.035 });
      } else if (!(st._settling && st.t < st._settling.at)) st.ball.escort([0, 0], dt, { tau: 0.09 });
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
      if (st.pressure >= cfg.tackleTime) beginStandTackle(st, press[0], p, cfg);
    } else if (busy(p) && p.act?.payload?.kind === 'skill' && st.phase === 'carry' && st.possession.carrier === p.id) {
      // LA FENÊTRE DE DUEL RESTE OUVERTE PENDANT TOUT LE GESTE TECHNIQUE — armé ET accompagnement.
      // Sans elle, la semelle (1,0 s) et le raclage du râteau étaient des sanctuaires : un défenseur
      // à 2,4 m couvre cette distance en 0,4 s et devait regarder. Un geste technique s'assume.
      const press = pressPredicate(st, p, cfg);
      st.pressure = press.length ? st.pressure + dt : 0;
      if (st.pressure >= cfg.tackleTime) beginStandTackle(st, press[0], p, cfg);
    }
    // l'accompagnement possédé (râteau qui tourne, semelle qui tient) écrit corps ET ballon ICI —
    // movePlayers se tait (ownsBody), la branche busy du pas de jeu aussi : une autorité.
    if ((following(p) || p.act?.payload?.skill === 'plongeon') && p.act?.payload?.kind === 'skill') skillFollowStep(st, p, dt, cfg);
    const actBefore = p.act;
    const evg = stepGesture(p, dt, { log: st.gestures });
    if (evg === 'contact') {
      if (p.act?.payload?.kind === 'pass') strikeNow(st, p, cfg);
      else if (p.act?.payload?.kind === 'tacle-debout') standTackleNow(st, p, cfg);
      else if (p.act?.payload?.kind === 'skill') skillContactNow(st, p, cfg);
    } else if (evg === 'end' && actBefore?.payload?.kind === 'skill') {
      // la fin d'un geste technique STAMPE ses mesures — le banc juge des chiffres de la sim,
      // pas une reconstruction de trace échantillonnée
      const A = actBefore.payload;
      if (A.skill === 'rateau') {
        p.v[0] = Math.cos(A.exitYaw) * 1.6; p.v[1] = Math.sin(A.exitYaw) * 1.6;
        p.push = [Math.cos(A.exitYaw), Math.sin(A.exitYaw)];
        st.events.push({
          t: +st.t.toFixed(2), type: 'skill-end', kind: 'rateau', by: p.id,
          turned: +(Math.abs(wrapA(p.yaw - A.yaw0)) * 180 / Math.PI).toFixed(0),
          ballMax: +(A.ballMax ?? 0).toFixed(2),
        });
      } else if (A.skill === 'semelle') {
        st.events.push({ t: +st.t.toFixed(2), type: 'skill-end', kind: 'semelle', by: p.id, maxV: +(A.maxV ?? 0).toFixed(2) });
      } else if (A.skill === 'plongeon') {
        if (!A.resolved) deny(st, 'plongeon-battu');              // la détente n'a rien trouvé : l'état se nomme
      } else if (A.skill === 'feinte') {
        st.events.push({ t: +st.t.toFixed(2), type: 'skill-end', kind: 'feinte', by: p.id });
      }
    }
  }
}

/**
 * LE PRÉDICAT DU DUEL — qui a le droit de faire courir la minuterie de vol. L'ancien prédicat
 * (« 1,45 m du CORPS pendant tackleTime ») a produit le chiffre fondateur de la sonde duels-tacles :
 * 54 % des pertes étaient un flip d'étiquette, gagnant jusqu'à 2,33 m du ballon, 29 % au-delà du
 * rayon de jeu. Le vrai prédicat est celui de carrier-owns-the-ball, ENFIN consommé côté attaque du
 * ballon : à portée de jeu du BALLON (contestRadius) ET plus près de lui que le porteur de plus que
 * shieldSlack — la protection de balle (le corps entre défenseur et ballon) devient une défense
 * réelle, parce que le prédicat la regarde.
 */
function pressPredicate(st, c, cfg) {
  const dc = d2(c.p, st.ball.p);
  return st.players.filter((q) => q.team !== c.team && q.down <= 0 && !q.act
    && (q.tackleCd ?? -1) <= st.t
    && d2(q.p, st.ball.p) < cfg.contestRadius
    && d2(q.p, st.ball.p) < dc - cfg.shieldSlack)
    .sort((a, b) => d2(a.p, st.ball.p) - d2(b.p, st.ball.p));
}

/**
 * LE VOL DEVIENT UN GESTE. La minuterie arrivée à terme n'est plus une bascule de possession en une
 * image : le presseur S'ENGAGE dans un tacle-debout (armé 0,28 s, le clip tacleDebout qui existait
 * depuis le début et n'était JAMAIS déclenché — technique.js:117 / animkit:456, mesuré 0 déclenchement
 * en 8 min). Pendant l'armé, le porteur peut encore sortir le ballon — c'est le duel. Le transfert,
 * s'il a lieu, se joue AU CONTACT du geste, sur un ballon à portée (standTackleNow).
 */
function beginStandTackle(st, q, victim, cfg) {
  const move = MOVE_TIMING.tacleDebout;
  st.pressure = 0;
  q.tackleCd = st.t + cfg.standCooldown;              // manqué ou gagné : pas de mitraillette de duels
  q.yawWant = Math.atan2(st.ball.p[2] - q.p[2], st.ball.p[0] - q.p[0]);
  startGesture(q, { id: 'tacleDebout', ...move }, { payload: { kind: 'tacle-debout', victim: victim.id }, log: st.gestures });
  st.events.push({ t: +st.t.toFixed(2), type: 'windup', by: q.id, move: 'tacleDebout', anticipation: move.contact });
}

/**
 * LE CONTACT DU TACLE-DEBOUT. Le duel se juge ICI, sur la géométrie réelle du contact — pas sur
 * celle d'il y a 0,28 s : si le porteur a sorti le ballon (passe partie, conduite hors de portée),
 * le tacle mord dans le vide et le refus se NOMME au registre (tacle-manqué). S'il gagne, le
 * transfert est PHYSIQUE : la technique de la table (tacle-debout) valide le contact, la première
 * touche du gagnant amortit le ballon (résiduel dans turnover) — plus jamais un ballon gelé à
 * distance ni une possession qui bascule sans événement.
 */
function standTackleNow(st, q, cfg) {
  const victimId = q.act?.payload?.victim ?? -1;
  const d = d2(q.p, st.ball.p);
  const still = st.phase === 'carry' && st.possession.carrier === victimId;
  const sit = situation(q.p, q.yaw, st.ball.p, st.ball.v, st.ball.p[1]);
  const pick = still && d <= cfg.receiveRadius + (q.skill?.tackleReach ?? 0) ? chooseTechnique(sit, 'win', { bias: { 'tacle-debout': 1 } })[0] : null;
  const won = !!pick && pick.tech.id === 'tacle-debout';
  if (!won) {
    // le refus a une cause nommée, et l'événement du duel perdu reste visible dans le flux
    deny(st, still ? 'tacle-manqué' : 'tacle-orphelin');
    st.events.push({ t: +st.t.toFixed(2), type: 'duel', by: q.id, won: false, dist: +d.toFixed(2) });
    return;
  }
  // l'événement porte sa géométrie ET sa technique — checkAction peut le rejouer (technique-legal)
  st.events.push({
    t: +st.t.toFixed(2), type: 'duel', by: q.id, won: true, tech: 'tacle-debout', foot: pick.foot,
    surface: pick.surface, bearing: +sit.bearing.toFixed(1), side: sit.side, dist: +sit.dist.toFixed(2),
    height: +st.ball.p[1].toFixed(2), speed: +Math.hypot(st.ball.v[0], st.ball.v[2]).toFixed(1),
  });
  const victim = st.players[victimId];
  // …et un geste TECHNIQUE se fait fermer à n'importe quel instant (la semelle tenue, le raclage
  // du râteau) — pas seulement l'armé : sa fenêtre de duel est ouverte du début à la fin
  if (victim?.act && (winding(victim) || victim.act.payload?.kind === 'skill')) abortGesture(victim, 'fermé pendant l’armé', { log: st.gestures });
  receive(st, q.id, cfg);          // → turnover : amorti nommé (résiduel ~20 %), possession déclarée
}

// ============================ LES GESTES TECHNIQUES ============================
// Râteau, feinte de passe, arrêt semelle — les gestes qui manipulent le ballon SANS le libérer.
// Trois lois partagées : (1) chaque déclenchement est SITUÉ (presseur frontal réel, défenseur à
// tromper dans le cône, champ libre mesuré) et chaque refus de situation se NOMME ; (2) le geste
// passe par la MÊME machine que les frappes (startGesture/stepGesture — armé volable, contact,
// accompagnement, abort nommé) : un râteau mal timé se fait tacler pendant l'armé, exactement
// comme une passe ; (3) le couple corps-ballon reste SOUDÉ (carry servo) — le ballon est raclé,
// garé, jamais téléporté. La fréquence est une identité (persona.flair) sous cooldowns stricts :
// un geste technique est un événement, pas un tic.

const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/** Le râteau : presseur FRONTAL qui ferme → la semelle tire le ballon en arrière, le corps se
 *  retourne par-dessus (le lacet appartient au geste pendant TOUT l'accompagnement — ownsBody). */
function maybeRateau(st, c, cfg) {
  const K = cfg.skill; if (!K) return false;
  if ((c._skillCd?.rateau ?? -1) > st.t) return false;
  if (d2(c.p, st.ball.p) > 0.55) return false;                    // sur SON ballon, au pied
  let foe = null, fd = Infinity;
  for (const q of st.players) {
    if (q.team === c.team || q.down > 0) continue;
    const d = d2(q.p, c.p); if (d < fd) { fd = d; foe = q; }
  }
  if (!foe || fd > K.rateauFoe) return false;
  const bear = situation(c.p, c.yaw, foe.p, [0, 0], 0.11).bearing;
  if (bear > K.rateauFront) return false;                         // il presse la FACE, pas le dos
  const closing = ((c.p[0] - foe.p[0]) * foe.v[0] + (c.p[2] - foe.p[2]) * foe.v[1]) / Math.max(1e-4, fd);
  if (closing < 1.5) return false;                                // il ARRIVE lancé (une dérive n'est pas une charge)
  // la sortie ARRIÈRE est libre — se retourner dans un second duel n'est pas une sortie
  const exitYaw = c.yaw + Math.PI;
  const ex = c.p[0] + Math.cos(exitYaw) * 1.2, ez = c.p[2] + Math.sin(exitYaw) * 1.2;
  for (const q of st.players) {
    if (q.team === c.team || q.down > 0) continue;
    if (Math.hypot(q.p[0] - ex, q.p[2] - ez) < K.rateauClear) return deny(st, 'rateau-sans-issue');
  }
  if (Math.abs(ex) > st.area[0] / 2 - 0.6 || Math.abs(ez) > st.area[1] / 2 - 0.6) return deny(st, 'rateau-hors-carré');
  // QUI tente : le flair (tirage seedé) — un refus de tempérament re-tire dans 2 s, pas à 60 Hz
  if ((st.rnd ? st.rnd() : 0.5) > 0.12 + 0.3 * (c.persona?.flair ?? 0.5)) {
    (c._skillCd ??= {}).rateau = st.t + 2; return false;
  }
  const sit = situation(c.p, c.yaw, st.ball.p, [0, 0], st.ball.p[1]);
  const foot = footFor(byId.rateau, sit);
  const move = MOVE_TIMING.rateau;
  if (st.ball.owner !== c.id) st.ball.possess(c.id);              // la semelle exige le couple soudé
  startGesture(c, { id: 'rateau', ...move }, {
    payload: { kind: 'skill', skill: 'rateau', pick: { foot }, ownsBody: true, yaw0: c.yaw, exitYaw, ballMax: 0 },
    log: st.gestures,
  });
  (c._skillCd ??= {}).rateau = st.t + K.rateauCd;
  c.intent = null;
  st.events.push({ t: +st.t.toFixed(2), type: 'windup', by: c.id, move: 'rateau', foot, skill: 'rateau', anticipation: move.contact });
  st.events.push({ t: +st.t.toFixed(2), type: 'skill', kind: 'rateau', by: c.id, foe: +fd.toFixed(2), bearing: +bear.toFixed(0) });
  return true;
}

/** La feinte de passe : l'intention EXISTE (une vraie passe est prête), un défenseur est dans le
 *  cône de la fausse direction — tout l'armé se joue, le ballon ne part pas, le mordu s'assoit. */
function maybeFeinte(st, c, cfg, contested) {
  const K = cfg.skill; if (!K || contested) return false;         // feinter sous conteste = offrir le ballon
  if ((c._skillCd?.feinte ?? -1) > st.t) return false;
  if (!c.intent || c.intent.feinted) return false;                // UNE feinte par intention
  const rec = st.players[c.intent.choice.to.id]; if (!rec) return false;
  const fakeYaw = Math.atan2(rec.p[2] - c.p[2], rec.p[0] - c.p[0]);
  let mark = null;
  for (const q of st.players) {
    if (q.team === c.team || q.down > 0) continue;
    const d = d2(q.p, c.p);
    if (d < K.feinteFoe[0] || d > K.feinteFoe[1]) continue;
    if (situation(c.p, fakeYaw, q.p, [0, 0], 0.11).bearing <= K.feinteCone) { mark = q; break; }
  }
  if (!mark) return false;                                        // personne à tromper : on joue simple
  // …et PERSONNE en duel vivant sur le ballon : se figer 0,4 s avec un homme à portée de vol,
  // c'est offrir le tacle — la sonde des graines 2/4 a mesuré le temps « collé » gonfler de 10 %
  if (pressPredicate(st, c, cfg).length) return false;
  if ((st.rnd ? st.rnd() : 0.5) > 0.15 + 0.45 * (c.persona?.flair ?? 0.5)) { c.intent.feinted = true; return false; }
  if (st.ball.owner !== c.id) {
    if (d2(c.p, st.ball.p) > cfg.captureRadius) return false;
    st.ball.possess(c.id);
  }
  const sit = situation(c.p, c.yaw, st.ball.p, [0, 0], st.ball.p[1]);
  const foot = footFor(byId['feinte-passe'], sit);
  const move = MOVE_TIMING.feintePasse;
  startGesture(c, { id: 'feintePasse', ...move }, {
    // outYaw : le REGARD vend la feinte (la scène fait regarder la fausse cible pendant l'armé)
    payload: { kind: 'skill', skill: 'feinte', pick: { foot }, fakeYaw, outYaw: fakeYaw },
    log: st.gestures,
  });
  c.intent.feinted = true;                                        // l'intention SURVIT : la vraie passe suit
  (c._skillCd ??= {}).feinte = st.t + K.feinteCd;
  st.events.push({ t: +st.t.toFixed(2), type: 'windup', by: c.id, move: 'feintePasse', foot, skill: 'feinte', anticipation: move.contact });
  return true;
}

/** L'arrêt semelle : porteur au calme, champ libre — le pied se pose SUR le ballon et la tête se
 *  lève. La ponctuation du jeu posé ; persona.calm et flair décident QUI la joue. */
function maybeSemelle(st, c, cfg, calm, foeBody) {
  const K = cfg.skill; if (!K || !calm) return false;
  if ((c._skillCd?.semelle ?? -1) > st.t) return false;
  if (foeBody < K.semelleFoe) return false;
  // …dans la tenue délibérée, pas à sa toute fin (première version : fenêtre [0,35 ; calmHold−0,6]
  // → pour une tenue de 1,0 s la fenêtre faisait 5 centièmes — 0 semelle en 6 minutes mesurées ;
  // et le ballon de CONDUITE vit à 0,5-0,9 m entre deux touches — 0,6 m est le rayon du porté)
  if (st.hold < 0.3 || st.hold > Math.max(0.5, (st._calmHold ?? 1) - 0.35)) return false;
  if (d2(c.p, st.ball.p) > 0.6) return false;
  if ((st.rnd ? st.rnd() : 0.5) > 0.2 + 0.5 * Math.max(0, (c.persona?.calm ?? 1) - 0.85) + 0.25 * (c.persona?.flair ?? 0.5)) {
    (c._skillCd ??= {}).semelle = st.t + 1.2; return false;       // pas cette fois — on re-tire plus tard
  }
  const sit = situation(c.p, c.yaw, st.ball.p, [0, 0], st.ball.p[1]);
  const foot = footFor(byId['arret-semelle'], sit);
  const move = MOVE_TIMING.arretSemelle;
  if (st.ball.owner !== c.id) st.ball.possess(c.id);
  startGesture(c, { id: 'arretSemelle', ...move }, {
    payload: { kind: 'skill', skill: 'semelle', pick: { foot }, ownsBody: true, maxV: 0 },
    log: st.gestures,
  });
  (c._skillCd ??= {}).semelle = st.t + K.semelleCd;
  st.events.push({ t: +st.t.toFixed(2), type: 'windup', by: c.id, move: 'arretSemelle', foot, skill: 'semelle', anticipation: move.contact });
  st.events.push({ t: +st.t.toFixed(2), type: 'skill', kind: 'semelle', by: c.id, foe: +foeBody.toFixed(2) });
  return true;
}

/** LE CONTACT D'UN GESTE TECHNIQUE — rien ne part : la semelle AGRIPPE (le point de départ du
 *  raclage se fige ici), la feinte SE VEND (les défenseurs lancés dans le cône mordent — leur
 *  ralenti est la loi de movePlayers), la plante SE POSE (le point de parking se fige). */
function skillContactNow(st, p, cfg) {
  const A = p.act.payload;
  if (A.skill === 'feinte') {
    const K = cfg.skill;
    const bitten = [];
    for (const q of st.players) {
      if (q.team === p.team || q.down > 0) continue;
      const d = d2(q.p, p.p);
      if (d < K.feinteFoe[0] - 0.2 || d > K.feinteFoe[1] + 0.6) continue;
      if (situation(p.p, A.fakeYaw, q.p, [0, 0], 0.11).bearing > K.feinteCone) continue;
      q._bite = st.t + K.feinteBite;
      bitten.push(q.id);
    }
    st.events.push({ t: +st.t.toFixed(2), type: 'skill', kind: 'feinte', by: p.id, bitten, foot: A.pick.foot });
  } else if (A.skill === 'rateau') {
    A.from = [st.ball.p[0], st.ball.p[2]];
  } else if (A.skill === 'semelle') {
    A.pin = [st.ball.p[0], st.ball.p[2]];
  }
}

/** L'ACCOMPAGNEMENT POSSÉDÉ (ownsBody) — la seule écriture du corps pendant qu'il dure.
 *  Râteau : le lacet balaie vers exitYaw (ease), le ballon RACLE tout droit en arrière le long de
 *  l'ancien regard — 0,32 m devant → 0,45 m derrière, qui est 0,45 m DEVANT le nouveau regard.
 *  Semelle : corps immobile, ballon garé au point d'agrippage. */
function skillFollowStep(st, p, dt, cfg) {
  const A = p.act.payload;
  if (A.skill === 'rateau') {
    const u = Math.min(1, (p.act.t - p.act.anticipation) / Math.max(1e-4, p.act.follow));
    const e = u * u * (3 - 2 * u);
    p.yaw = A.yaw0 + wrapA(A.exitYaw - A.yaw0) * e;
    p.yawWant = null;
    p.v[0] = 0; p.v[1] = 0; p.speed = 0.5;                        // le pivot n'est pas une course
    // les cibles de carry sont 2D [x, z] — la sonde du premier essai a vu le [x, y, z] à trois
    // termes envoyer le ballon vers la ligne z = 0,11 à la vMax du servo (3,99 m de « raclage »)
    const drag = 0.32 - 0.77 * e;
    st.ball.carry([p.p[0] + Math.cos(A.yaw0) * drag, p.p[2] + Math.sin(A.yaw0) * drag], dt, { tau: 0.05 });
    A.ballMax = Math.max(A.ballMax ?? 0, d2(p.p, st.ball.p));
  } else if (A.skill === 'plongeon') {
    // LE PLONGEON EST UNE DÉTENTE : le corps part vers le point d'interception dès l'armé et
    // glisse encore un peu après le contact — la seule écriture du corps pendant qu'il dure.
    // …et LE TOUCHER EST CONTINU : tester le ballon à la frame de contact du clip (0,55 s) rate
    // tout vol plus prompt — 2 arrêts sur 15 plongeons mesurés. Le gant rencontre le ballon à
    // l'image où il PASSE, le clip n'est que le dessin de la détente.
    if (!A.resolved && cfg.onDive && cfg.onDive(st, p, cfg)) A.resolved = true;
    const T = p.act.anticipation + 0.25;
    const k = p.act.t < p.act.anticipation ? 1 : Math.max(0, 1 - (p.act.t - p.act.anticipation) / 0.25);
    if (p.act.t < T && A.lunge) {
      p.p[0] += A.lunge[0] * A.speed * k * dt;
      p.p[2] += A.lunge[1] * A.speed * k * dt;
      p.p[0] = Math.max(-st.area[0] / 2, Math.min(st.area[0] / 2, p.p[0]));
      p.p[2] = Math.max(-st.area[1] / 2, Math.min(st.area[1] / 2, p.p[2]));
      p.v[0] = A.lunge[0] * A.speed * k; p.v[1] = A.lunge[1] * A.speed * k;
      p.speed = Math.hypot(p.v[0], p.v[1]);
    } else { p.v[0] = 0; p.v[1] = 0; p.speed = 0; }
  } else if (A.skill === 'semelle') {
    // LA SEMELLE SE DÉCOLLE QUAND ON VIENT LA PRESSER. Tenue quoi qu'il arrive, elle offrait le
    // temps « collé » mesuré (58 % — un presseur à 2,4 m couvre l'écart en 0,4 s et la tenue
    // durait 1,0 s) : le vrai joueur relâche la pose et REJOUE dès que quelqu'un ferme. L'abandon
    // est un abort NOMMÉ — le contrat des gestes le lit, rien ne s'évapore.
    let foe = Infinity;
    for (const q of st.players) if (q.team !== p.team && q.down <= 0) foe = Math.min(foe, d2(q.p, p.p));
    if (foe < 2.0) {
      st.events.push({ t: +st.t.toFixed(2), type: 'skill-end', kind: 'semelle', by: p.id, maxV: +(A.maxV ?? 0).toFixed(2), broke: 'pressé' });
      abortGesture(p, 'pressé-sous-semelle', { log: st.gestures });
      return;
    }
    p.v[0] = 0; p.v[1] = 0; p.speed = 0;
    if (A.pin) st.ball.carry([A.pin[0], A.pin[1]], dt, { tau: 0.04 });
    A.maxV = Math.max(A.maxV ?? 0, Math.hypot(st.ball.v[0], st.ball.v[2]));
  }
}

export const skillInternals = { maybeRateau, maybeFeinte, maybeSemelle, skillContactNow };
export const simInternals = { beginPass: (...a) => beginPass(...a), strikeNow: (...a) => strikeNow(...a), receive: (...a) => receive(...a) };

/**
 * Give the ball to `id`. A team-mate taking it keeps possession — only the INTENDED receiver
 * scores the pass; anyone else on the same shirt is a scuffed ball that stayed in the family.
 * An opponent taking it is the turnover.
 */
function receive(st, id, cfg = RONDO) {
  const p = st.players[id];
  // un ballon encore PORTÉ par un autre change de mains ici : la sortie se nomme (vol de balle)
  if (st.ball.owner != null && st.ball.owner !== id) st.ball.release('perte');
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
      // LA CAPTURE — LE PORTÉ COMMENCE ICI. Le contrôle ne calcule plus une livraison vers le point
      // où le pied SERA (solveGroundLeg : quatre correctifs successifs, la mène 0,65 balayée, 3-9 %
      // de dette control-at-foot — toute la négociation) : il PREND le ballon. L'amorti tue la
      // vitesse incidente (l'impulsion, le geste réel), possess() déclare la possession, et le
      // PORTÉ (carry vers le point du pied, chaque image de la phase carry) amène le ballon au pied
      // PAR l'intégrateur — continu, borné, et contestable à tout instant (release('contesté')).
      // La touche directionnelle survit entière : yawWant tourne le corps hors du presseur, et le
      // point du pied suit ce regard — le ballon vient AVEC la rotation, comme un vrai contrôle
      // orienté.
      // LE POIDS DE LA PASSE SE PAIE AU CONTRÔLE : le résiduel d'amorti croît avec la vitesse
      // d'arrivée (une passe douce se pose, une fusée REBONDIT du pied — mesuré avant : douce
      // p50 0,22 m, fusée 0,29 — quasi identiques, le poids n'existait pas), et l'assise prend
      // plus longtemps. Amplification bornée (×2,6 max) : le contrôle reste un geste maîtrisé,
      // pas une roulette.
      // LE POIDS DE LA PASSE SE PAIE AU CONTRÔLE — et il se paie en RISQUE, pas en lenteur (la
      // première version allongeait l'assise : mesurée engloutie par l'urgence, une ombre). Un
      // ballon au-delà de ~10 m/s peut ÉCHAPPER à la touche : le contrôle est manqué, le ballon
      // reste LIBRE avec son résiduel — contestable, exactement ce qu'un défenseur attend d'une
      // passe trop appuyée. Le taux suit la vitesse et la précision de la surface (accuracy), le
      // tirage est seedé (le hasard de la partie, pas un dé caché).
      const arr = Math.hypot(st.ball.v[0], st.ball.v[2]);
      const pMiss = Math.max(0, Math.min(0.35, (arr - 10) * 0.07 / Math.max(0.5, pick.tech.accuracy * (p.skill?.controlF ?? 1))));
      if (pMiss > 0 && (st.rnd ? st.rnd() : 0.5) < pMiss) {
        deny(st, 'contrôle-manqué');
        st.ball.impulse([-st.ball.v[0] * 0.62, -st.ball.v[1] * 0.8, -st.ball.v[2] * 0.62]);
        st.events.push({ t: +st.t.toFixed(2), type: 'control', by: id, tech: pick.tech.id, foot: pick.foot,
          surface: pick.surface, speed: +arr.toFixed(1), miss: true, settle: null });
        return;                                                    // pas de possession : la touche a fui
      }
      st.ball.impulse([-st.ball.v[0] * (1 - pick.tech.power), -st.ball.v[1], -st.ball.v[2] * (1 - pick.tech.power)]);
      st.ball.possess(id);
      st._settling = { ev: st.events.length, id, at: st.t + T };
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
    // LA CAUSE DIT LE GESTE : une interception prend un ballon en vol, un tacle prend le ballon d'un
    // porteur (duel debout ou glissade — la clause 10 de checkRondo exige l'événement physique
    // correspondant), une récupération ramasse un ballon LIBRE au sol — trois football différents,
    // et l'ancien étiquetage « tackle » pour un ramassage de ballon perdu mentait sur les deux.
    turnover(st, id, st.phase === 'flight' ? 'interception' : st.phase === 'loose' ? 'récupération' : 'tackle');
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
  if (st.ball.owner != null) return;                            // un ballon PORTÉ se dispute debout (le duel), pas au sol
  if (st.ball.p[1] > 0.4) return;                               // you do not slide at a ball in the air
  if (Math.hypot(st.ball.v[0], st.ball.v[2]) > cfg.slideMaxBall) return;   // nor at one going too fast to win
  // A SLIDE IS A LAST RESORT, not a longer reach. Letting anyone within range go to ground produced
  // 182 slides in 90 s and possession collapsed from 18 passes to 4: everybody dived at every loose
  // ball. You slide when you are LOSING THE RACE — when the man who would otherwise get there is an
  // opponent, and you cannot beat him on your feet. Everything else is a normal run.
  // …ET C'EST UN GESTE DÉFENSIF. Mesuré (sonde duels-tacles) : 9,4 glissades/min, 69 % par l'équipe
  // EN POSSESSION dont 49 % par le PORTEUR plongeant sur sa propre touche échappée — or un porteur
  // dont la touche s'échappe la POURSUIT (c'est le travail du modèle de conduite), il ne se couche
  // pas dessus. Seuls les défenseurs se jettent, chacun au plus une fois par slideCooldown, et
  // seulement s'ils perdent NETTEMENT la course (slideMargin 0,15 → 0,4). Cible : ≤ 2/min.
  let best = null;
  for (const p of st.players) {
    if (p.down > 0 || p.act) continue;
    if (p.team === st.possession.team) continue;                         // le tacle glissé est défensif
    if ((p.slideCd ?? -1) > st.t) continue;                              // il vient déjà de se jeter
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
    // …mais pas si l'adversaire A DÉJÀ le ballon au pied : plonger sur un ballon contrôlé n'a plus
    // rien à disputer — c'était la moitié du spam résiduel mesuré (3-6/min malgré cooldown+marge)
    if (dRival < 0.55) continue;
    // …et pas non plus si la menace n'est pas IMMINENTE : l'adversaire à plus d'un pas et demi du
    // ballon laisse le temps de défendre debout — le plongeon préventif était le reste du spam
    if (dRival > 1.6) continue;
    if (!best || d < best.d) best = { p, d };
  }
  if (!best) return;
  const p = best.p;
  // UN SEUL PLONGEON PAR BALLON. Mesuré (seed 1) : trois défenseurs de la même équipe au sol sur le
  // MÊME ballon en 0,3 s — le cooldown par joueur ne voit pas les coéquipiers, et un coéquipier DÉJÀ
  // couché ne compte plus comme « plus proche » (filtre down). Le ballon qu'un partenaire attaque au
  // sol est SON ballon : l'équipe espace ses plongeons.
  const lastSlide = (st._slideT ??= {})[p.team] ?? -99;
  if (st.t - lastSlide < 4) return;
  const sit = situation(p.p, p.yaw, st.ball.p, st.ball.v, st.ball.p[1]);
  const pick = chooseTechnique(sit, 'win', { bias: { 'tacle-glisse': 1 } })[0];
  if (!pick || pick.tech.id !== 'tacle-glisse') return;
  p.slideCd = st.t + cfg.slideCooldown;                        // gagné ou perdu : pas deux plongeons de suite
  st._slideT[p.team] = st.t;
  // le temps au sol n'est plus une constante d'horloger (mesuré : 1,200 s pile sur chaque tacle,
  // référence réelle 0,5-1 s) — variance seedée ±10 % autour de slideRecovery
  p.down = cfg.slideRecovery * (0.9 + 0.2 * (st.rnd ? st.rnd() : 0.5));  // he is on the ground either way
  // he gets there if he is genuinely the first: an opponent already on the ball wins the duel
  const rival = st.players.filter((q) => q.team !== p.team && q.down <= 0).reduce((b, q) => (d2(q.p, st.ball.p) < d2(b.p, st.ball.p) ? q : b), st.players.find((q) => q.team !== p.team));
  const won = !rival || d2(rival.p, st.ball.p) > cfg.receiveRadius;
  st.events.push({
    t: +st.t.toFixed(2), type: 'slide', by: p.id, won, tech: 'tacle-glisse', foot: pick.foot, surface: pick.surface,
    // l'événement dit QUI a glissé et QUI avait le ballon : la clause de discipline de checkRondo
    // (0 glissade de l'équipe en possession) le lit — et son sabotage l'injecte.
    team: p.team, atk: st.possession.team,
    bearing: +sit.bearing.toFixed(1), side: sit.side, dist: +sit.dist.toFixed(2), height: +st.ball.p[1].toFixed(2),
    speed: +Math.hypot(st.ball.v[0], st.ball.v[2]).toFixed(1),
  });
  if (won) {
    // Un tacle ne fait pas APPARAÎTRE le ballon près du tacleur (39 sauts par partie, 1,77 m en
    // moyenne, 2,56 m au pire) : le pied le RENVOIE. Une impulsion, dont l'intégrateur fait une
    // course — on voit le ballon partir, ce qui est le geste.
    st.ball.release('perte');                  // un tacle qui gagne PREND — la sortie du porté se nomme
    receive(st, p.id, cfg);                       // bookkeeping: possession, turnover count, sequence reset
    // …ET LE POKE VISE UN PARTENAIRE DEBOUT, PAS SON PROPRE CORPS COUCHÉ. L'ancien poke renvoyait le
    // ballon VERS le tacleur, au sol pour ~1 s, v = 0 : un adversaire debout le réclamait — mesuré,
    // 36 tacles « gagnés » sur 37 rendaient le ballon à l'autre équipe (claim p50 0,2-0,5 s après).
    // Un tacle réussi DÉGAGE le ballon vers le coéquipier debout le plus proche ; sans coéquipier,
    // à l'opposé de l'adversaire le plus proche. (Le poke part APRÈS receive : l'amorti du turnover
    // porte sur le ballon incident, l'impulsion du pied est le geste qui suit.)
    const mate = st.players.filter((q) => q.team === p.team && q.id !== p.id && q.down <= 0)
      .reduce((b, q) => (!b || d2(q.p, st.ball.p) < d2(b.p, st.ball.p) ? q : b), null);
    const foe = st.players.filter((q) => q.team !== p.team && q.down <= 0)
      .reduce((b, q) => (!b || d2(q.p, st.ball.p) < d2(b.p, st.ball.p) ? q : b), null);
    let ux = 0, uz = 0;
    if (mate) { ux = mate.p[0] - st.ball.p[0]; uz = mate.p[2] - st.ball.p[2]; }
    else if (foe) { ux = st.ball.p[0] - foe.p[0]; uz = st.ball.p[2] - foe.p[2]; }
    else { ux = p.p[0] - st.ball.p[0]; uz = p.p[2] - st.ball.p[2]; }
    const ul = Math.hypot(ux, uz) || 1;
    // 4,5 m/s envoyait le dégagement traverser le carré (et parfois la ligne) : 3,2 suffit à
    // mettre le ballon hors de l'emprise sans le rendre au chaos
    const back = Math.min(3.2, best.d / 0.28);
    st.ball.impulse([(ux / ul) * back - st.ball.v[0], -st.ball.v[1], (uz / ul) * back - st.ball.v[2]]);
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
  (cfg.assignJobs ?? assignJobs)(st, cfg);   // le match branche ici son attribution directionnelle
  // LA LATENCE DE PERCEPTION — mesurée avant : 10 % des défenseurs re-ciblaient dans l'IMAGE du
  // départ de passe (17 ms — surhumain). Après l'événement-surprise, un adversaire du porteur
  // GARDE sa cible d'avant le temps de sa réaction résiduelle : il court sur l'ancienne image du
  // monde, comme un vrai défenseur surpris. Son équipe à lui SAIT ce qu'elle joue (pas de délai).
  if (st._surprise) {
    for (const p of st.players) {
      // QUI REGARDAIT ? La politique de regard (gaze.js) donne ~65 % des hors-ballon les yeux sur
      // le ballon — CEUX-LÀ ont vu l'armé et le déduisent de leur réaction ; les ~35 % qui
      // SCANNAIENT ailleurs paient leur réaction PLEINE. Part HACHÉE (joueur × passe), pas tirée :
      // le flux seedé de la partie ne bouge pas d'un bit. Une claquette (seen = 0) surprend tout
      // le monde. Première version sans le regard : l'armé vu annulait le délai de TOUTES les
      // passes — la loi ne mordait que sur les claquettes, mesuré p10 = 0 ms sur l'urgence.
      const k = ((p.id * 7919 + (st._surprise.n ?? 0) * 104729) % 97) / 97;
      const scanning = k < 0.35;
      const base = p.skill?.reaction ?? p.persona?.reaction ?? 0.2;
      const rt = scanning ? base : Math.max(0, base - (st._surprise.seen ?? 0));
      if (p.team !== st.possession.team && !p.keeper && st.t - st._surprise.t < rt) {
        if (p._heldT) p.target = p._heldT;
      } else p._heldT = p.target ? [...p.target] : null;
    }
  }
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
      // LA MESURE EST CONSCIENTE DE LA POSSESSION. Un ballon encore PORTÉ à la fin de la fenêtre
      // du contrôle se juge (et le porté rend la règle structurelle : il est au pied par carry) ;
      // un ballon qui n'est PLUS à lui a été relâché à cause nommée — frappé (la trace l'a montré :
      // capture 0,82 → 0,26 m, armé soudé, passe partie AVANT la fin de la fenêtre — un
      // enchaînement une-touche légitime que l'ancienne mesure comptait comme un contrôle mort à
      // 1,29 m), contesté, ou perdu — et CE contrat-là l'a jugé. Un instant, un contrat ;
      // l'exemption reste bornée dans le harnais.
      if (st.ball.owner === st._settling.id) ev.settle = +d2(pl.p, st.ball.p).toFixed(2);
      else ev.oneTouche = true;
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
    // …MAIS LE BALLON VIT PENDANT L'ACCOMPAGNEMENT. Un tacle-debout gagné fait du tacleur le porteur
    // pendant ~0,4 s de follow EN PHASE CARRY — un cas que le porteur-passeur ne produit jamais (sa
    // frappe bascule en flight). Pendant l'ARMÉ, l'autorité du ballon est stepGestures (porté au
    // point de stance) ; pendant le FOLLOW en carry, personne n'écrivait : le ballon gelait sur
    // place. Une autorité par phase : porté → carry au pied ; libre → physique.
    if (busy(c)) {
      st.hold += dt;
      if (c.act.fired) {
        // un geste ownsBody (râteau, semelle) écrit son ballon dans skillFollowStep — une autorité ;
        // la feinte, elle, garde le porté au pied ordinaire pendant sa rétraction
        if (c.act.payload?.ownsBody) { /* stepGestures possède corps et ballon */ }
        else if (st.ball.owner === c.id) st.ball.carry(footPoint(st, c, cfg), dt);
        else st.ball.integrate(dt);
      }
      return st;
    }

    // the carrier really dribbles: touches, the ball free in between (dribble.js)
    if (!st._drb) st._drb = makeDribbler();
    // where the BALL should be pushed — the escape direction assignJobs computed, not the direction of
    // the player's own next step (those differ: he stands behind the ball, so his step is toward it)
    let want = c.push || (c.target ? (() => {
      const dx = c.target[0] - c.p[0], dz = c.target[2] - c.p[2], l = Math.hypot(dx, dz) || 1;
      return [dx / l, dz / l];
    })() : [Math.cos(c.yaw), Math.sin(c.yaw)]);
    // LA CONDUITE RENTRE SES TOUCHES PRÈS DE LA CRAIE. La sortie de but était devenue la première
    // cause de perte (77/191 sur 8 graines), l'essentiel en phase carry : la poussée de conduite,
    // décidée sur l'évasion, shave la ligne et la touche suivante sort. À moins de 1,3 m de la
    // ligne, la demande de poussée est mélangée vers l'intérieur — le geste d'un joueur réel qui
    // garde son ballon en jeu.
    {
      const mX = st.area[0] / 2 - Math.abs(st.ball.p[0]);
      const mZ = st.area[1] / 2 - Math.abs(st.ball.p[2]);
      let wx2 = want[0], wz2 = want[1];
      if (mX < 1.3) { const k = (1.3 - mX) / 1.3; wx2 = wx2 * (1 - k) - Math.sign(st.ball.p[0]) * k; }
      if (mZ < 1.3) { const k = (1.3 - mZ) / 1.3; wz2 = wz2 * (1 - k) - Math.sign(st.ball.p[2]) * k; }
      if (wx2 !== want[0] || wz2 !== want[1]) {
        const l2 = Math.hypot(wx2, wz2) || 1;
        want = [wx2 / l2, wz2 / l2];
      }
    }
    // `heading` here is the body's MOMENTUM, like evadeKeep — how the dribble model decides how hard a
    // touch may be. It read the facing, which was the drift until the carrier started facing his ball;
    // after that, heading and `want` became the same vector and every touch went full strength straight
    // down the push, so the ball simply outran a man capped at 4.2 m/s (`carry-reach` 0.4 % → 8.8 % of
    // carry frames with the ball beyond 3 m). Two consumers of yaw, one meaning changed, both to fix.
    const csp = Math.hypot(c.v[0], c.v[1]);
    const heading = csp > 0.4 ? [c.v[0] / csp, c.v[1] / csp] : [Math.cos(c.yaw), Math.sin(c.yaw)];
    const pl = { p: [c.p[0], c.p[2]], speed: c.speed, heading, want, turnRate: 0, leadF: c.skill?.dribbleLeadF,
      space: Math.min(...st.players.filter((q) => q.team !== c.team && q.down <= 0).map((q) => d2(q.p, c.p)), 99) };
    pl.heading = dribbleSteer(st.ball, pl);
    // LE PORTÉ — la possession est un ÉTAT DU MOTEUR (ball-body : possess/carry/release), plus une
    // négociation. L'historique de cette chaîne est le meilleur argument du régime : quatre
    // autorités successives (livraison, assise, conduite, plus leurs gardes) se sont fait la guerre
    // ici — la touche d'évasion renvoyait une livraison arrivée, l'assise tuait un contrôle en
    // route, control-at-foot est monté à 33 %. Désormais :
    //   PORTÉ (owner = porteur) : le ballon converge vers le POINT DU PIED par l'intégrateur
    //     (carry — servo borné, continu). Contrôle et préparation de frappe ne font qu'un avec le
    //     joueur : le ballon est à lui, au pied, par définition.
    //   CONDUITE : le porté se RELÂCHE (release('conduite')) — touches réelles, ballon libre entre
    //     elles, interceptable : le football contestable qu'une attache dure aurait tué.
    //   CONTESTÉ : release('contesté') — le duel se joue sur un ballon PHYSIQUE, le 50/50 est réel.
    //   La re-capture (l'ancienne « assise ») : quand l'intention se forme et que le ballon est au
    //   pied, non contesté — possess() + porté.
    const foeBall = Math.min(...st.players.filter((q) => q.team !== c.team && q.down <= 0).map((q) => d2(q.p, st.ball.p)), 99);
    const contested = foeBall < cfg.contestRadius && foeBall < d2(c.p, st.ball.p) - cfg.contestSlack;
    const intentFresh = !!c.intent || (c.anchorHint && st.t - c.anchorHint.t < 0.4);
    const settling = st._settling && st.t < st._settling.at;
    if (st.ball.owner === c.id) {
      if (contested) {
        st.ball.release('contesté');
        dribbleStep(st._drb, st.ball, pl, dt);                  // il tente de l'emmener hors du duel
      } else if (intentFresh || settling) {
        st.ball.carry(footPoint(st, c, cfg), dt);               // porté : le ballon au pied, continu
      } else {
        st.ball.release('conduite');
        dribbleStep(st._drb, st.ball, pl, dt);
      }
    } else if (intentFresh && !contested && d2(c.p, st.ball.p) < cfg.captureRadius) {
      st.ball.possess(c.id);
      st.ball.carry(footPoint(st, c, cfg), dt);
    } else {
      dribbleStep(st._drb, st.ball, pl, dt);
    }

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
      st.ball.release('perte');
      st.phase = 'loose'; st.possession.carrier = -1; st.pass = null; st.hold = 0; st.pressure = 0;
      return st;
    }
    st.hold += dt;
    // LA PRESSION EST UN DUEL, PAS UNE MINUTERIE DE VOISINAGE. L'ancien prédicat (« 1,45 m du corps
    // pendant 0,5 s » → receive() instantané) était la cause n°1 de la non-forme du jeu : 54 % des
    // pertes sans AUCUN geste, gagnant jusqu'à 2,33 m du ballon, ballon gelé net à distance,
    // possession médiane 0,40 s (sonde duels-tacles). Le résultat négatif consigné ci-avant
    // (« exiger d'être plus près du ballon que le corps-bouclier → record 0 ») valait pour un monde
    // à tackleTime 0,5 SANS modèle de tacle : le bouclier demandait un modèle de tacle fait pour
    // lui, et c'est ce que le tacle-debout est. Le prédicat regarde le BALLON (pressPredicate :
    // contestRadius + shieldSlack), la minuterie s'engage dans un GESTE (beginStandTackle), le
    // transfert se joue au contact — mesuré après bascule : turnover toutes les ~11 s au lieu de
    // 1,6 s, et 0 flip sans événement physique (clause 10 de checkRondo).
    const press = pressPredicate(st, c, cfg);
    st.pressure = press.length ? st.pressure + dt : 0;
    if (st.pressure >= cfg.tackleTime) beginStandTackle(st, press[0], c, cfg);
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
    // LA TENUE DÉLIBÉRÉE — le tempo d'un rondo n'est pas le minimum légal en boucle. Mesuré (sonde
    // tempo-espaces / premiere-touche) : hold p50 = 0,38 s (= holdMin + armé), 0-1,6 % des
    // inter-passes dans la bande 2-5 s du vrai rondo, contrôle→passe 0,39 s alors que 84 % des
    // réceptions se font SANS presseur à 1,5 m. Un porteur au calme (adversaire > calmFoe) tient son
    // ballon un temps tiré dans holdCalm — par st.rnd, le hasard SEEDÉ de la partie — avant
    // d'adopter une intention ; pressé, l'urgence garde ses droits (holdMin, improvisation).
    if (st._calmKey !== `${st.possession.carrier}:${st.turnovers}:${st.passes}`) {
      st._calmKey = `${st.possession.carrier}:${st.turnovers}:${st.passes}`;
      // × persona.calm : le posé et le vif ne tiennent pas le ballon pareil — l'identité au tempo
      st._calmHold = (cfg.holdCalm[0] + (st.rnd ? st.rnd() : 0.5) * (cfg.holdCalm[1] - cfg.holdCalm[0])) * (c.persona?.calm ?? 1);
    }
    const foeBody = Math.min(...st.players.filter((q) => q.team !== c.team && q.down <= 0).map((q) => d2(q.p, c.p)), 99);
    const calm = foeBody > cfg.calmFoe;
    // …et beginPass lit CE holdMin-là (la porte 'timing') : au calme la fenêtre s'étire à 0,8-1,0 s,
    // pressé elle retombe au holdMin d'origine — fixer puis donner.
    st._holdMin = calm ? Math.min(1.0, st._calmHold) : cfg.holdMin;
    // ON NE PASSE PAS UN BALLON QU'ON EST ENCORE EN TRAIN DE POSER : pas d'engagement avant la fin
    // de la fenêtre du contrôle + settleExtra (70 % des contrôles étaient refrappés avant la fin du
    // follow-through). L'urgence contestée, elle, joue quand même : le duel n'attend pas l'assise.
    const settleGate = st._settling && st._settling.id === c.id && st.t < st._settling.at + cfg.settleExtra;
    // LE RÂTEAU SE JOUE AVANT QUE LE DUEL S'INSTALLE : un presseur qui ferme la face avant, une
    // sortie arrière libre — on se retourne PENDANT qu'on a encore le pas d'avance, contesté ou
    // pas (première version : contesté seulement — 0,2 râteau par partie, le geste que
    // l'utilisateur demandait restait invisible). Refus nommés quand la situation manque.
    if (!settleGate && maybeRateau(st, c, cfg)) return st;
    if (st.hold >= Math.max(0, cfg.holdMin - cfg.windupBudget) && reachNow && (!settleGate || contested)) {
      // PENDANT UNE LIVRAISON (contrôle en route vers le pied), on planifie CONTRE LE POINT
      // D'ARRIVÉE — pas contre le ballon en voyage (le corps partait vers l'ancre d'un ballon
      // mouvant : control-at-foot 1 % → 33 %), et pas rien du tout non plus (bloquer l'intention
      // pendant la livraison : 4 109 refus, 0,3 s d'exposition en plus, record 8,5 → 5). Un vrai
      // joueur pense sa suite pendant que le ballon vient : beginPass reçoit le point d'arrivée et
      // le temps de livraison restant, et n'accorde l'engagement que si le contact tombe après.
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
      // LE TIR — le geste du match (cfg.tryShot, match-sim) : évalué AVANT l'intention de
      // passe, parce qu'une occasion de but domine une ligne de passe. Le rondo n'a pas de but :
      // le hook n'y existe pas, et ce bloc est un no-op.
      if (!contested && cfg.tryShot && cfg.tryShot(st, c, cfg)) return st;
      // …et le DÉGAGEMENT se décide ICI aussi (pas seulement au duel installé : mesuré, la branche
      // contestée ne tournait que 17 fois en 120 s — l'équipe épinglée perdait le ballon par tacle
      // AVANT d'y entrer ; ses propres portes lisent l'étau)
      if (cfg.tryClear && cfg.tryClear(st, c, cfg)) return st;
      if (contested) {
        // UN BALLON CONTESTÉ SE JOUE MAINTENANT — pas « se re-dribble sur place ». Reprendre
        // l'évasion laissait le cycle se répéter (le défenseur suit le ballon : garé, délogé,
        // regaré — carrier-owns-the-ball 60,8 % en 5 c. 5). Un joueur de rondo dont le ballon est
        // disputé le sort DU PREMIER GESTE LÉGAL (improvisation d'urgence, veto de course levé :
        // le moins mauvais ballon vaut mieux que le duel qu'on est en train de perdre) ; s'il n'y a
        // AUCUN geste légal, alors seulement l'évasion reprend.
        // …MAIS PAS AU PREMIER FRÔLEMENT. Depuis que le duel est un vrai geste (tacle-debout à
        // tackleTime), le porteur a une fenêtre : jouer la panique dès la première image de
        // conteste produisait le ping-pong mesuré (intervalle entre pertes p50 1,5-1,9 s, les
        // possessions neuves mouraient sur des balles improvisées interceptées). Il laisse d'abord
        // l'évasion travailler ; l'urgence ne prend la main que si le duel s'installe (pressure).
        if (c.intent) c.intent = null;
        deny(st, 'contesté');
        if (st.pressure > 0.15) {
          const choice = choosePass(st, cfg);
          if (choice) beginPass(st, choice, cfg, { forceUrgent: true });
        }
      } else if (!c.intent) {
        const choice = choosePass(st, cfg);
        // AU CALME, LA BARRE MONTE ET LA TENUE SE PAIE : l'intention ne s'adopte qu'au-delà de la
        // tenue délibérée tirée pour CETTE possession (st._calmHold, seedée) et d'une barre de
        // score relevée (intentBarCalm) — le porteur conduit, fixe, PUIS donne. Pressé, la barre
        // et la tenue d'origine reprennent : l'urgence reste prompte.
        const bar = calm ? cfg.intentBarCalm : 3.2;
        const heldEnough = !calm || st.hold >= st._calmHold;
        // L'APPEL CASSE LA TENUE : au tempo posé, les tenues (1,5-2,5 s) et les courses (0,7-1,1 s)
        // étaient désynchronisées — le temps d'avoir « assez tenu », la course était finie (3
        // appels servis sur 41 mesurés). Au vrai foot, la course DÉCLENCHE le ballon : un coureur
        // en rupture au bout d'une ligne qui score dispense de finir la tenue délibérée.
        const runnerCall = choice && (st.players[choice.to.id]?._pace?.until ?? -1) > st.t;
        if (choice && ((choice.score > bar && (heldEnough || runnerCall)) || st.hold >= cfg.holdMax)) c.intent = { choice, until: st.t + cfg.intentTtl };
        // LA SEMELLE VIT DANS LA TENUE : pas d'intention encore, du champ, du calme — le pied se
        // pose sur le ballon et la tête se lève. Le geste ALLONGE la tenue de sa durée (busy),
        // ce qui est exactement ce qu'il fait au vrai foot.
        if (!c.intent && maybeSemelle(st, c, cfg, calm, foeBody)) return st;
      }
      if (c.intent) {
        // l'intention vise le receveur VIVANT : la mène se rafraîchit sur sa course réelle — c'est
        // le même receveur, pas une re-décision (strikeNow re-résout de toute façon au contact)
        const rec = st.players[c.intent.choice.to.id];
        const tI = cfg.leadTime ? cfg.leadTime(Math.hypot(rec.p[0] - c.p[0], rec.p[2] - c.p[2]), rec) : 0.28;
        c.intent.choice.lead = [rec.p[0] + rec.v[0] * tI, BALL.radius, rec.p[2] + rec.v[1] * tI];
        // LA FEINTE AVANT LA PASSE : l'intention est prête, un défenseur vit dans le cône de la
        // fausse direction — tout l'armé se joue (volable !), le ballon reste, le mordu s'assoit,
        // et la VRAIE passe part au geste suivant sur une ligne morte. Une feinte par intention.
        if (maybeFeinte(st, c, cfg, contested)) return st;
        beginPass(st, c.intent.choice, cfg);
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
        // UN HOMME AU SOL NE RÉCLAME PAS UN BALLON. La boucle sans garde donnait 3 prises de balle
        // par des joueurs ENCORE couchés après leur tacle (sonde duels-tacles) — possession = homme
        // DEBOUT au ballon, le temps au sol est le prix du plongeon.
        if (p.down > 0) continue;
        const d = d2(p.p, st.ball.p);
        if (d < cfg.receiveRadius && st.ball.p[1] < 1.9 && d < bestD) { bestD = d; taker = p.id; }
      }
    }
    if (taker >= 0 && (!cfg.canTake || cfg.canTake(st, taker))) receive(st, taker, cfg);   // une remise a un ayant droit et une heure
  }
  // OUT OF PLAY IS A RULE OF THE BALL, NOT OF A PHASE. This test only ran while the ball was loose or
  // in flight, so a ball dribbled over the line simply stayed out — and once the carrier began pushing
  // the ball ahead of himself, that is exactly what happened: the catalogue caught it as `ball-in-play`
  // on seeds where a carry ran into the corner. The line does not care who has it.
  if (Math.abs(st.ball.p[0]) > st.area[0] / 2 || Math.abs(st.ball.p[2]) > st.area[1] / 2) {
    // LE MATCH A DES LOIS DE SORTIE (but / touche / corner / sortie de but — cfg.onOut, match-sim) ;
    // le rondo garde sa remise unique en jeu réduit
    if (cfg.onOut) { cfg.onOut(st, cfg); return st; }
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
        players: st.players.map((p) => ({ id: p.id, team: p.team, job: p.job, p: [+p.p[0].toFixed(2), +p.p[2].toFixed(2)], speed: +p.speed.toFixed(2), yaw: +p.yaw.toFixed(3), down: +p.down.toFixed(2) })),
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

  // 10. UN VOL DE BALLE EST UN GESTE, PAS UN FLIP D'ÉTIQUETTE. Le chiffre fondateur de la fournée
  //     duels : 54 % des pertes (157/291) basculaient la possession sans AUCUN événement physique —
  //     gagnant jusqu'à 2,33 m du ballon, premier geste du « voleur » : la passe suivante. Chaque
  //     turnover par tacle doit être adossé à un duel GAGNÉ (tacle-debout, événement 'duel') ou à un
  //     tacle glissé gagné (événement 'slide') dans la même fenêtre d'instant.
  const evs = st.events ?? [];
  const tackleTOs = evs.filter((e) => e.type === 'turnover' && e.why === 'tackle');
  const orphans = tackleTOs.filter((e) => !evs.some((g) => (g.type === 'duel' || g.type === 'slide') && g.won && Math.abs(g.t - e.t) <= 0.15));
  if (orphans.length) issues.push(`VOL SANS GESTE : ${orphans.length} bascule(s) de possession par tacle sans duel ni glissade gagné (t=${orphans[0].t})`);
  // 11. PAS DE TÉLÉKINÉSIE : arrêter un ballon vivant exige d'être à sa portée. Mesuré avant : 39
  //     arrêts d'un ballon > 1 m/s (jusqu'à 9,5 m/s) tué net avec un gagnant au-delà du rayon de jeu.
  //     Le tacle glissé est exempté : son pied ATTEINT le ballon à 1-3,2 m, et l'événement le dit.
  const teleki = tackleTOs.concat(evs.filter((e) => e.type === 'turnover' && e.why === 'interception'))
    .filter((e) => (e.d ?? 0) > cfg.receiveRadius && (e.v0 ?? 0) > 1 && (e.v1 ?? 0) < 0.5 * (e.v0 ?? 0)
      && !evs.some((g) => g.type === 'slide' && g.won && Math.abs(g.t - e.t) <= 0.15));
  if (teleki.length) issues.push(`TÉLÉKINÉSIE : ${teleki.length} ballon(s) arrêté(s) à distance (t=${teleki[0].t}, ${teleki[0].v0}→${teleki[0].v1} m/s à ${teleki[0].d} m)`);
  // 12. LE TACLE GLISSÉ EST RARE ET DÉFENSIF. Mesuré avant : 9,4/min, 69 % par l'équipe en
  //     possession (49 % par le porteur sur son propre ballon). Budget : ≤ 3/min (cible de jeu
  //     2/min, le seuil de contrat laisse la variance multi-graines), et ZÉRO par l'équipe qui a
  //     déjà le ballon — courir derrière sa touche est le travail de la conduite.
  const slideEvs = evs.filter((e) => e.type === 'slide');
  const slideByAtk = slideEvs.filter((e) => e.team != null && e.atk != null && e.team === e.atk);
  if (slideByAtk.length) issues.push(`GLISSADE DE POSSESSION : ${slideByAtk.length} tacle(s) glissé(s) par l'équipe qui avait le ballon (t=${slideByAtk[0].t})`);
  // durée arrondie à la seconde ENTIÈRE : 119,9 s lus comme 1,998 min faisaient déclarer 3,0026/min
  // pour 6 glissades en 2 minutes — le budget se juge sur la partie, pas sur l'artefact du dernier pas
  const gameMin = trace.length ? Math.max(0.5, Math.ceil(trace[trace.length - 1].t) / 60) : 1;
  if (slideEvs.length / gameMin > 3) issues.push(`SPAM DE GLISSADES : ${(slideEvs.length / gameMin).toFixed(1)}/min (max 3)`);
  // 13. LA POSSESSION EST UN HOMME DEBOUT. 19 épisodes mesurés de phase carry avec porteur au sol
  //     (jusqu'à 6,7 s, un « porteur » couché que la défense ne pouvait pas déposséder).
  for (const s of carry) {
    const cd = s.players.find((p) => p.id === s.carrier);
    if (cd && (cd.down ?? 0) > 0) { issues.push(`PORTEUR AU SOL : phase carry à t=${s.t} avec porteur ${s.carrier} couché (down=${cd.down})`); break; }
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
