// strike-sim — LA FRAPPE : l'engagement d'une passe/d'un tir (beginPass — le plan, l'ancre,
// la course de la défense, la porte de la Loi 11) et le CONTACT (strikeNow — la re-mène, le
// bruit d'exécution, la photo du hors-jeu, l'événement complet). Sortis de rondo-sim au lot 21
// (volumétrie du cœur), au bit près — la batterie est la preuve. Une famille par fichier.
import { STANCES, anchorFor, planStrike, reachable } from './approach.js';
import { gauss } from './attributes.js';
import { flightRace, interceptPoint, solvePass } from './ball-predict.js';
import { BALL } from './ball.js';
import { startGesture } from './gesture.js';
import { isOffside, offsideLine } from './offside.js';
import { MOVE_TIMING } from './skills-sim.js';
import { TECHNIQUES, chooseTechnique, situation } from './technique.js';

const d2 = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
/** Un refus a une cause nommée (copie locale du registre du loop). */
const deny = (st, cause) => { (st.deny ??= {})[cause] = (st.deny[cause] ?? 0) + 1; return false; };
/** L'amorti amortit AUSSI la rotation (lot 54 — le spin orphelin ; doc : match-config). */
const dW = (st, cfg, k) => (st.full && cfg.amortiSpin !== false ? [-st.ball.w[0] * k, -st.ball.w[1] * k, -st.ball.w[2] * k] : null);

/**
 * COMMIT to the chosen pass. Inverse ballistics decides it can be played; the gesture decides when.
 * (La machinerie « planifier contre le point d'arrivée d'une livraison » a vécu ici — 4 109 refus
 * mesurés quand on bloquait, 33 % de contrôles morts quand on planifiait contre le ballon en
 * voyage. Elle est morte avec la CAPTURE : le contrôle POSSÈDE le ballon dès le contact et le
 * porté l'amène au pied — le ballon du plan est simplement le ballon réel.)
 */
export function beginPass(st, choice, cfg, opts = {}) {
  const c = st.players[st.possession.carrier];
  // LA PORTE DE LA LOI 11 (cfg.offside — 11c11 seulement, le réduit vit la loi du futsal) : le
  // cerveau ne PLANIFIE pas une passe vers une position illicite. choosePass écarte déjà ses
  // candidats ; la porte tient les AUTRES sources d'intention (centres, rampes de distribution).
  // Les dégagements et les tirs passent (un dégagement vise une ZONE, un tir vise le but) — la
  // photo de strikeNow les jugera comme tout le monde si un coupable touche.
  if (cfg.offside && st.full && !opts.clear && !choice.clear && !choice.shot && choice.to && choice.to.id >= 0) {
    const rec0 = st.players[choice.to.id];
    if (rec0 && rec0.team === c.team && isOffside(st, rec0.team, rec0.p)) { c.intent = null; return deny(st, 'hors-jeu'); }
  }
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
  // LE BALLON DE CONDUITE EST UN BALLON DU COUPLE (lot 77 — la gâchette : 3 401 refus
  // ballon-vif pour 4 tirs sur 4×180 s depuis que la conduite vit libre). Un ballon qui roule
  // AVEC son homme ne fuit l'ancre de personne : si la vitesse RELATIVE porteur-ballon tient
  // dans l'enveloppe de TECHNIQUE (strikeBallRel × controlF — l'attribut gradue la loi), la
  // frappe se planifie comme sur ballon porté (le couple s'arrange : hardMax/adjustSpeed).
  // La borne ABSOLUE d'hier reste la loi du ballon VRAIMENT libre. false : la disette d'hier.
  const relV = Math.hypot(st.ball.v[0] - (c.v?.[0] ?? 0), st.ball.v[2] - (c.v?.[1] ?? 0));
  const couple = st.ball.owner === c.id || (st.full && cfg.frappeConduite !== false
    && relV <= (cfg.strikeBallRel ?? 2.2) * (c.skill?.controlF ?? 1));
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
    const plan = planStrike([c.p[0], c.p[2]], bref, outYaw, cands,
      { rushed: nearFoe < cfg.rushedRadius, ...(couple ? { hardMax: 1.0, adjustSpeed: 4.2 } : {}) });
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
    if (!couple && Math.hypot(st.ball.v[0], st.ball.v[2]) > cfg.strikeBallMax) return deny(st, 'ballon-vif');
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
    if (!couple && Math.hypot(st.ball.v[0], st.ball.v[2]) > cfg.strikeBallMax * 1.6) return deny(st, 'ballon-vif');
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
  startGesture(c, { id: pick.tech.clip, ...move }, { payload: { kind: 'pass', choice, pick, stance, urgent, outYaw, from: [c.p[0], c.p[2]], fromYaw: c.yaw,
    // …l'ÉLAN du commit (lot 45) : la foulée de frappe le porte DANS le geste (stepGestures)
    v0: Math.hypot(c.v[0], c.v[1]), vYaw: Math.atan2(c.v[1], c.v[0]) }, log: st.gestures });
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
export function strikeNow(st, c, cfg) {
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
      st.ball.impulse([-st.ball.v[0] * 0.4, 0, -st.ball.v[2] * 0.4], dW(st, cfg, 0.4));   // vendangé : le ballon reste libre
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
  // LE BACKSPIN DE LA PASSE LEVÉE (lot 54, cfg.passeSpin && st.full) : lofted/chip se coupent SOUS le
  // ballon — l'effet rétro PORTE le vol (Magnus) et ASSIED la retombée : le premier rebond mord le
  // glissement accru au lieu de laisser filer un roulement qui fabriquait ~100 rad/s de spin orphelin.
  // Le solveur reçoit LE MÊME effet : la balistique inverse reste honnête (elle simule ball.js avec la
  // vraie rotation). Sans clé ni st.full : zéro effet, au bit près. Doc et mesures : match-config.
  // …et sur les CLOCHES MAISON (diagonale de renversement, centre aérien), l'effet exige la
  // balistique HONNÊTE : leurs formules du vide sur-portaient un ballon qui flotte (Magnus) —
  // mesuré : la diagonale n'arrivait plus (4 bancs rouges en cascade), puis SANS effet la
  // retombée redevenait la glissade à spin orphelin (chasse 13 % → 61 %). Chaque cloche liftée
  // re-résout vitesse ET temps de vol par solvePass sur la vraie physique, effet compris.
  const liftYaw = Math.atan2(lead[2] - from[2], lead[0] - from[0]);
  const liftSpin = st.full && cfg.passeSpin !== false && !choice.shot && !choice.clear
    ? { spinRev: cfg.passeSpin ?? 4.5, spinAxis: [-Math.sin(liftYaw), 0, Math.cos(liftYaw)] } : null;
  const lift = liftSpin && !choice.cross && !choice.bascule
    && (choice.style === 'lofted' || choice.style === 'chip') ? liftSpin : null;
  let liftAtStrike = lift;   // les cloches re-résolues (dessous) frappent AUSSI avec leur effet
  const sol = solvePass(from, lead, { style: choice.style, ...(lift ?? {}) }) || solvePass(from, choice.lead, { style: choice.style, ...(lift ?? {}) });
  if (!sol) { st.ball.impulse([-st.ball.v[0] * 0.4, 0, -st.ball.v[2] * 0.4], dW(st, cfg, 0.4)); return; }   // scuffed: it stays loose
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
  // LE DÉCHET TECHNIQUE EXISTE SANS NOTES (cfg.execSigma, match — absent : le rondo au bit
  // près). Le monde non noté exécutait PARFAITEMENT (zéro bruit hors attributs) : dès que les
  // receveurs ont su faire un pas vers le ballon, la complétion est montée à ~100 % et le
  // flipper est revenu par la réception parfaite (0 sortie en 4 matchs mesurée). Un joueur
  // moyen rate aussi des passes ; la note RAFFINE ce déchet, elle ne l'invente pas.
  let dirNoise = 0;
  if (!shot && !choice.clear) {
    if (c.skill) dirNoise = gauss(st.rnd ?? (() => 0.5)) * c.skill.passSigma * (urgent ? c.skill.composureF : 1);
    else if (cfg.execSigma) dirNoise = gauss(st.rnd ?? (() => 0.5)) * cfg.execSigma * (urgent ? 1.25 : 1);
  }
  sol.dirYaw += dirNoise;
  // LE RÉPERTOIRE DU TIR (choice.shotKind, posé par le match — le rondo n'en pose jamais) : le
  // plancher plat 17 + élévation coupée à 0,10 faisaient de chaque frappe le MÊME rase-mottes.
  // L'espèce décide la vitesse ET la hauteur ; sans espèce, l'ancien vol tendu, au bit près.
  const kind = shot ? choice.shotKind : null;
  // …kind.exact (le piqué) : la vitesse balistique EST le geste — le plancher de puissance
  // écraserait la cloche douce par-dessus le gardien sorti (lot 39)
  const speed = shot ? (kind?.exact ? kind.speed : Math.max(sol.speed, kind?.speed ?? cfg.shotSpeed ?? 17))
    : choice.clear ? Math.max(sol.speed, 13) : sol.speed;
  // …kind.exact libère AUSSI l'élévation : le plafond 0,32 (anti-chandelle des frappes tendues)
  // écrasait le θ 0,58 du piqué — apogée mesurée 0,91 m, le lob qui ne lobe pas (lot 39)
  let elev = shot ? (kind ? (kind.exact ? kind.elev : Math.max(Math.min(kind.elev, 0.32), 0.01)) : Math.min(sol.elevation, 0.10)) : sol.elevation;
  let spd = speed;
  // LA CLOCHE DU CENTRE (cfg.tete && st.full — lot 34) : un centre est un ARC par-dessus le
  // premier rideau, pas une passe tendue (0 centre entré en surface sur 4 matchs mesurés —
  // mangés en route). La balistique de la rentrée : portée → vitesse, θ ~26°, et le temps
  // de vol re-solvé pour le receveur qui attaque sa mène.
  if (choice.cross && choice.bas && st.full) {
    // LE CENTRE BAS (lot 40) : fort et À RAS vers le point de penalty — le ballon skim à
    // hauteur de reprise (apogée ~0,3 m, un rebond en route est sa nature), la volée l'attend
    const R = Math.hypot(lead[0] - from[0], lead[2] - from[2]);
    elev = 0.14;
    spd = Math.max(15, R * 1.25);
    sol.flightTime = R / (spd * Math.cos(elev));
  } else if (choice.cross && cfg.tete && st.full) {
    const R = Math.hypot(lead[0] - from[0], lead[2] - from[2]);
    elev = 0.45;
    const solC = liftSpin ? solvePass(from, lead, { style: elev, ...liftSpin }) : null;
    if (solC) { spd = solC.speed; sol.flightTime = solC.flightTime; liftAtStrike = liftSpin; }
    else {
      spd = Math.sqrt(Math.max(8, R) * 9.81 / Math.sin(2 * elev));
      sol.flightTime = 2 * spd * Math.sin(elev) / 9.81;
    }
  }
  // …et la DIAGONALE DU RENVERSEMENT vole PAR-DESSUS le bloc (lot 35) : la même cloche —
  // c'est sa raison d'être au vrai football, le couloir 2D bouché n'existe pas à 5 m du sol
  if (choice.bascule && cfg.renversement && st.full) {
    const R = Math.hypot(lead[0] - from[0], lead[2] - from[2]);
    elev = 0.42;
    const solB = liftSpin ? solvePass(from, lead, { style: elev, ...liftSpin }) : null;
    if (solB) { spd = solB.speed; sol.flightTime = solB.flightTime; liftAtStrike = liftSpin; }
    else {
      spd = Math.sqrt(Math.max(10, R) * 9.81 / Math.sin(2 * elev));
      sol.flightTime = 2 * spd * Math.sin(elev) / 9.81;
    }
    st.events.push({ t: +st.t.toFixed(2), type: 'renversement', by: c.id, to: choice.to.id, dz: +Math.abs(lead[2] - from[2]).toFixed(1) });
  }
  // …le RÉPERTOIRE porte son effet (lot 39) : l'enroulée son Magnus signé (kind.rev ±8 — la
  // courbe RAMÈNE la mène décalée au vrai poteau), les frappes de cou-de-pied leur rotation
  // lisible (0,5), flottante/pointu quasi rien (le gardien les lit tard). Sans kind : 0, au bit près.
  st.ball.strike({ speed: spd, dirYaw: sol.dirYaw, elevation: elev,
    spinAxis: liftAtStrike ? liftAtStrike.spinAxis : [0, 1, 0], spinRev: liftAtStrike ? liftAtStrike.spinRev : (kind?.rev ?? 0) });
  if (choice.clear) st.events.push({ t: +st.t.toFixed(2), type: 'clearance', by: c.id, foot: c.foot });
  if (choice.cross) st.events.push({ t: +st.t.toFixed(2), type: 'centre', by: c.id, foot: c.foot, to: choice.to.id, bas: !!choice.bas });
  if (shot) {
    st.events.push({ t: +st.t.toFixed(2), type: 'shot', by: c.id, foot: c.foot,
      range: choice.shotInfo?.range ?? null, clear: choice.lane?.margin ?? null,
      tz: choice.shotInfo?.tz ?? null, gkZ: choice.shotInfo?.gkZ ?? null, speed: +speed.toFixed(1),
      kind: kind?.id ?? 'tendu', elev: +elev.toFixed(2) });
  }
  // LA PERCEPTION A UNE HORLOGE : le départ du ballon est un événement — mais l'armé était
  // VISIBLE. La défense paie max(0, réaction perso − armé vu) : une passe téléphonée s'anticipe,
  // une urgence courte se subit. (Consommé par la retenue de cible dans rondoStep.)
  st._surprise = { t: st.t, seen: c.act ? c.act.t : 0, n: (st._surprise?.n ?? 0) + 1 };
  st.phase = 'flight';
  st.pass = { from: c.id, to: choice.to.id, lead, style: choice.style, t: st.t, flight: sol.flightTime, error: sol.error, origin: [from[0], from[2]] };
  // LA PHOTO DE LA LOI 11 (cfg.offside — 11c11) : le hors-jeu se juge À L'INSTANT DE LA FRAPPE —
  // pas au choix (le coureur gagne des mètres pendant l'armé : c'est TOUT l'appel timé), pas à
  // la réception (le monde a bougé pendant le vol). On photographie ICI les coéquipiers en
  // position illicite ; leur premier toucher SIFFLE (receive), l'adversaire qui joue le ballon
  // efface l'ardoise (le turnover tue st.pass). Dégagements et tirs portent la même photo — le
  // renvoi qui trouve un attaquant resté aux six mètres est LE hors-jeu classique.
  if (cfg.offside && st.full) {
    const L = offsideLine(st, c.team);
    let off = null;
    for (const q of st.players) {
      if (q.team !== c.team || q.id === c.id || q.keeper || q.p[0] * L.sgn <= L.adv + 0.05) continue;
      (off ??= {})[q.id] = [+q.p[0].toFixed(2), +q.p[2].toFixed(2)];
    }
    if (off) st.pass.off = off;
  }
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
