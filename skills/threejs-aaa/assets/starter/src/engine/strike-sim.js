// strike-sim — LA FRAPPE : l'engagement d'une passe/d'un tir (beginPass — le plan, l'ancre,
// la course de la défense, la porte de la Loi 11) et le CONTACT (strikeNow — la re-mène, le
// bruit d'exécution, la photo du hors-jeu, l'événement complet). Sortis de rondo-sim au lot 21
// (volumétrie du cœur), au bit près — la batterie est la preuve. Une famille par fichier.
import { STANCES, anchorFor, planStrike, reachable } from './approach.js';
import { gauss } from './attributes.js';
import { flightRace, interceptPoint, laneClearance, solvePass } from './ball-predict.js';
import { BALL } from './ball.js';
import { startGesture } from './gesture.js';
import { isOffside, offsideLine, pointCorps } from './offside.js';
import { affinite as affiniteFam, affiniteMotif } from './familiarite.js';
import { MOVE_TIMING } from './skills-sim.js';
import { croyanceDe } from './croyance.js'; import { tirage } from './rng.js';
import { pressionDe, sigmaPasse } from './reception.js';
import { TECHNIQUES, chooseTechnique, situation, byId } from './technique.js';
import { axe, tac } from './tactics.js';
import { role } from './roles.js';

const d2 = (a, b) => hyp(a[0] - b[0], a[2] - b[2]);
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
/** LA TOUCHE (lot A9, cfg.remisesMain) : le lancer part des MAINS — hauteur du lâcher, la cloche d'hier (0,55 rad court, 0,42 long :
 *  un jet à 10-15 m/s ; tendu à 0,24 il filait à 17,7 m/s et arrivait en 1 s — mesuré, la possession tenait 5 s au lieu de 19). */
export const TOUCHE_H = 1.8, TOUCHE_ELEV = 0.55, TOUCHE_ELEV_LONGUE = 0.42;
const wrapPi = (a) => a - 2 * Math.PI * Math.round(a / (2 * Math.PI));
const smooth = (u) => { const v = Math.max(0, Math.min(1, u)); return v * v * (3 - 2 * v); };

/**
 * LE BALLON AUX MAINS PENDANT L'ARMÉ d'une remise à la main (stepGestures, lot A9) — une AUTORITÉ de position
 * nommée, comme le porté au pied d'une frappe : le ballon est TENU (ball.hold : un déplacement, jamais une pose
 * par écriture — le registre du ballon ne voit aucune remise). Le roulé du gardien : les gants descendent
 * (keeper.gkHeldBall) ; la touche : le ballon monte du sol à la poitrine, passe derrière la tête, revient au
 * point de lâcher (toucheH, 0,3 m devant) — le chemin des mains du geste généré (motion-restart.touche).
 */
export function holdMains(st, c, dt, cfg) {
  const A = c.act;
  if (!A || A.fired || st.ball.owner !== c.id) return false;
  if (A.payload?.mains === 'roule' || A.payload?.mains === 'volee') return !!cfg.heldBall?.(st, c, dt, cfg);   // les gants du gardien (keeper.gkHeldBall)
  if (A.payload?.mains !== 'touche') return false;
  const H = (cfg.remisesMain && cfg.remisesMain.toucheH) || TOUCHE_H;
  const u = A.t / Math.max(1e-3, A.anticipation), fx = Math.cos(c.yaw), fz = Math.sin(c.yaw);
  // poitrine (u ≤ 0,35) → derrière la tête (u 0,65) → point de lâcher (u 1) : trois jalons, deux fondus
  const chest = [0.25, 1.35], back = [-0.12, H - 0.06], rel = [0.30, H];
  const k = u < 0.35 ? chest : u < 0.65 ? [chest[0] + (back[0] - chest[0]) * smooth((u - 0.35) / 0.3), chest[1] + (back[1] - chest[1]) * smooth((u - 0.35) / 0.3)]
    : [back[0] + (rel[0] - back[0]) * smooth((u - 0.65) / 0.35), back[1] + (rel[1] - back[1]) * smooth((u - 0.65) / 0.35)];
  st.ball.hold([c.p[0] + fx * k[0], k[1], c.p[2] + fz * k[0]], dt, { tau: 0.1, vMax: 8 });
  return true;
}

/**
 * LE LÂCHER DE LA TOUCHE — appelé par l'horloge du geste au contact du geste 'touche' armé par
 * referee.remiseEnTouche. Le ballon quitte les MAINS là où holdMains l'a porté (aucune écriture de position :
 * la balistique part du ballon tel qu'il est), re-mené sur le coéquipier élu là où il est MAINTENANT, honnête
 * (solvePass depuis la hauteur des mains). Pas de photo de hors-jeu : la Loi 11 exempte la rentrée.
 */
export function throwNow(st, c, cfg) {
  const T = c.act.payload, K = cfg.remisesMain || {};
  const best = st.players[T.to];
  const tx = best ? best.p[0] : T.target[0], tz = best ? best.p[2] : T.target[1];
  const from = [st.ball.p[0], Math.max(BALL.radius, st.ball.p[1]), st.ball.p[2]];
  const d = hyp(tx - from[0], tz - from[2]);
  const longue = T.longue && d > 19;
  const sol = solvePass(from, [tx, 0, tz], { style: longue ? (K.elevLongue ?? TOUCHE_ELEV_LONGUE) : (K.elev ?? TOUCHE_ELEV) });
  st.ball.release('touche');                                      // la cause VRAIE au grand livre — le ballon quitte les mains
  const theta = sol ? sol.elevation : 0.45, speed = sol ? sol.speed : Math.sqrt(Math.max(4, d) * 9.81 / Math.sin(2 * 0.45));
  st.ball.strike({ speed, dirYaw: sol ? sol.dirYaw : Math.atan2(tz - from[2], tx - from[0]), elevation: theta, spinAxis: [0, 1, 0], spinRev: 0 });
  st.phase = 'flight';
  st.possession.carrier = -1; st.hold = 0; st.pressure = 0;
  st.pass = { from: c.id, to: T.to, lead: [tx, 0, tz], style: 'touche', t: st.t, flight: sol ? sol.flightTime : 2 * speed * Math.sin(theta) / 9.81, origin: [from[0], from[2]] };
  st.events.push({ t: +st.t.toFixed(2), type: 'rentrée', by: c.id, to: T.to, range: +Math.min(d, T.Rr ?? d).toFixed(1), genre: longue ? 'longue' : undefined, ballY: +from[1].toFixed(2), speed: +speed.toFixed(1),
    face: +(Math.abs(wrapPi(Math.atan2(tz - from[2], tx - from[0]) - c.yaw)) * 180 / Math.PI).toFixed(0) });   // l'écart corps-cible en degrés
}

export function beginPass(st, choice, cfg, opts = {}) {
  const c = st.players[st.possession.carrier];
  // (262) LE REGARD DE PASSE : décider de servir X, c'est le REGARDER — une saccade vers le receveur à l'adoption (avant l'armé : Jordet, jamais pendant la frappe), que la couche de croyance observe à la prochaine image (c._percAt) ; le receveur hors de portée de la tête (± tete °) reste cru, pas vu — la passe vers un fantôme
  if (st.full && cfg.croyance && c && choice?.to?.id >= 0 && !choice.shot) { const R = st.players[choice.to.id]; if (R) { const S = c.scan ??= { at: -1, until: -1, vers: 'ballon', cible: null, n: 0, vol: false, _next: 0, _lcg: ((c.id + 1) * 2654435761 + 12345) >>> 0 }; S.vers = 'receveur'; S.cible = [R.p[0], R.p[2]]; S.at = st.t; S.until = st.t + (cfg.croyance.regardPasse ?? 0.2); c._percAt = -1; } }
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
  // LA DISTRIBUTION À LA MAIN DU GARDIEN (lot A9, opts.mains) : pas d'ancre ni de stance — le ballon est DANS
  // les mains ; la technique est le roulé (motion-restart.rouleMain), lâché bas devant au contact. Avant : la
  // relance à la main dessinait une passe du pied. (La touche, elle, s'arme dans referee.remiseEnTouche.)
  const mains = opts.mains === true ? 'roule' : (opts.mains || null);   // 'roule' (le gardien, A9) | 'volee' (le dégagement de volée, A9 bis)

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
  const relV = hyp(st.ball.v[0] - (c.v?.[0] ?? 0), st.ball.v[2] - (c.v?.[1] ?? 0));
  const couple = st.ball.owner === c.id || (st.full && cfg.frappeConduite !== false
    && relV <= (cfg.strikeBallRel ?? 2.2) * (c.skill?.controlF ?? 1));
  let pick, move, stance, anchor;
  if (mains) {
    pick = { tech: byId[mains === 'volee' ? 'volee-gardien' : 'roule-main'] || byId['roule-main'], foot: c.foot }; move = MOVE_TIMING[pick.tech.clip] || MOVE_TIMING.passe; stance = null; anchor = null;
  } else if (!urgent) {
    // les surfaces de PLAN : jouables sur un ballon posé (une « première » sur un ballon qu'on
    // s'est soi-même assis serait une contradiction — firstTime reste à l'improvisation)
    let cands = TECHNIQUES.filter((t) => t.intent === 'pass' && !t.firstTime).map((t) => ({
      clip: t.clip, pref: t.accuracy, antic: (MOVE_TIMING[t.clip] || MOVE_TIMING.passe).contact, data: t,
    }));
    // LA TALONNADE DE CHOIX (lot 118, cfg.talonnade && st.full — le clip dormait : 0,5
    // exécution/match, le plan préférait MARCHER son demi-tour). PRESSÉ de face avec une
    // cible DERRIÈRE (> cone°), le demi-tour est un CADEAU au presseur — le talon gagne sa
    // préférence (+bonus) et le plan le retient (son ancre est déjà sous le pied, fit ≈ 0).
    // Clé absente : le demi-tour d'hier, au bit.
    // …et SEULEMENT dans le camp ADVERSE (mesuré : le défenseur pressé talonnait vers son
    // gardien — molle, power 0,45, interceptée : +8 buts/20 matchs de cadeaux ; le vrai
    // défenseur pressé garde son demi-tour prudent, la talonnade est un geste de CRÉATION)
    if (st.full && cfg.talonnade && !opts.shot
      && c.p[0] * Math.sign(st.pitch?.attackGoal?.(c.team).x || 1) > 0) {
      let dYaw118 = Math.abs(outYaw - c.yaw); while (dYaw118 > Math.PI) dYaw118 = Math.abs(dYaw118 - 2 * Math.PI);
      if (dYaw118 * 180 / Math.PI > (cfg.talonnade.cone ?? 130)
        && st.players.some((q) => q.team !== c.team && q.down <= 0
          && hyp(q.p[0] - c.p[0], q.p[2] - c.p[2]) < (cfg.talonnade.press ?? 2.8)
          && situation(c.p, c.yaw, q.p, [0, 0], 0.11).bearing < 70)) {
        for (const cd of cands) if (cd.clip === 'talonnade') cd.pref += cfg.talonnade.bonus ?? 0.4;
      }
    }
    // LE GESTE DU TIR (lot 93, cfg.gesteTir && st.full) : l'espèce s'habille de SON clip — mesuré
    // avant : 13/16 tirs dessinés en passeRapide/passePivot (l'armé d'une petite passe pour un
    // ballon à 21 m/s). La puissance arme AMPLE, l'enroulée ENVELOPPE de l'intérieur, le pointu
    // part SANS élan lisible ; les frappes tendues (ras-de-terre, flottante, mi-hauteur) gardent
    // le cou-de-pied `frappe`. La géométrie du plan (ancre, stance, atteignabilité) reste LA loi.
    if (opts.shot && choice.shotKind && st.full && cfg.gesteTir !== false) {
      const K93 = { puissance: 'frappePuissante', lucarne: 'frappePuissante', 'enroulée': 'frappeEnroulee', 'placé': 'frappeEnroulee', 'croisé': 'frappeEnroulee', pointu: 'frappePointu', 'piqué': 'frappePointu', lob: 'frappePointu' };
      const cl = K93[choice.shotKind.id] ?? 'frappe';
      const row = TECHNIQUES.find((t) => t.clip === cl && t.intent !== 'clear');
      cands = [{ clip: cl, pref: 1, antic: (MOVE_TIMING[cl] || MOVE_TIMING.frappe).contact, data: row }];
    }
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
    if (!couple && hyp(st.ball.v[0], st.ball.v[2]) > cfg.strikeBallMax) return deny(st, 'ballon-vif');
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
    if (!couple && hyp(st.ball.v[0], st.ball.v[2]) > cfg.strikeBallMax * 1.6) return deny(st, 'ballon-vif');
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
      st._denyD?.push(hyp(anchor.p[0] - c.p[0], anchor.p[1] - c.p[2]));
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
  // …et la MAIN du gardien ne « pose » pas un ballon qu'elle tient : la tenue (gkTenueDue) a déjà été servie,
  // la porte ne s'applique qu'au pied (lot A9 — mesuré : holdMin conditionnel 2,2 s au calme, la relance à la
  // main refusée 'timing' à chaque essai, 0 relance-main en 7 graines × 240 s).
  const holdGate = opts.shot ? cfg.holdMin : (st._holdMin ?? cfg.holdMin);
  if (!mains && st.hold < holdGate - move.contact * cfg.windupCarve) return deny(st, 'timing');

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
  // un TIR ne se refuse pas à la course : le défenseur qui coupe, c'est le duel du tir même.
  // …ET L'URGENCE GARDE UN ŒIL (lot 143, cfg.oeil && st.full — retour utilisateur : « beaucoup
  // de passes dans le dos des joueurs, récupérations horribles ») : la passe de panique sautait
  // TOUT le refus de course — mesuré : 19 % des passes interceptées (réel 7-10), et les
  // interceptées ne sont PAS plus lentes (12,0 c. 10,5 m/s) : c'est l'ÉLECTION aveugle. Même
  // pressé, une ligne MORTE (course perdue de ≥ marge s) se refuse — le frame suivant élit la
  // moins mauvaise VivANTE (le veto aiguille choosePass). false : la panique aveugle d'hier.
  // …ET LA MENTALITÉ EST LE CURSEUR DU RISQUE ACCEPTÉ (149) : l'offensif tolère des courses
  // plus serrées (raceSlack ×0,75), le défensif exige de la marge (×1,25) — 0,5 = ×1, l'hier
  const slackM = cfg.raceSlack * axe(tac(st, c.team).mentalite, 1.25, 0.75) * (2 - (c.skill?.visionF ?? 1));   // …ET LA VISION OSE (152) : le voyant joue les couloirs serrés que le myope refuse — 1 exact à 50
  if (!opts.shot && !opts.clear && st.hold < cfg.holdMax && race.first
    && ((!urgent && (!meet || race.first.t < meet.t + slackM))
      || (urgent && st.full && cfg.oeil && (!meet || race.first.t < meet.t - (cfg.oeil.marge ?? 0.25))))) {
    (st.laneVeto ??= {})[choice.to.id] = st.t + cfg.vetoTtl;
    c.intent = null;                                        // course perdue : le plan meurt, on re-décide
    return deny(st, urgent ? 'course-urgente' : 'course');
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
  startGesture(c, { id: pick.tech.clip, ...move }, { payload: { kind: 'pass', choice, pick, stance, urgent, outYaw, from: [c.p[0], c.p[2]], fromYaw: c.yaw, mains,
    // …l'ÉLAN du commit (lot 45) : la foulée de frappe le porte DANS le geste (stepGestures)
    v0: hyp(c.v[0], c.v[1]), vYaw: Math.atan2(c.v[1], c.v[0]) }, log: st.gestures });
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
/** L'ÉCHELLE DE FINITION (258) — la loi PURE : les σ d'un tir. `F` = cfg.finition, `x` = { finF, composureF, weakF,
 *  faible (mauvais pied), P (pression 0..1), stam, spd (m/s), dG (m au point visé) }. Renvoie { sigPsi, sigTheta } en
 *  radians et { sigV, muV } sur le log de la vitesse. Aucun tirage ici : le banc la lit telle quelle. */
export function finitionSigma(F, x) {
  const fPied = x.faible ? 1 + (F.pied ?? 0.29) * (x.weakF ?? 1) : 1;
  const kappa = (F.kappa ?? 1.35) * ((x.composureF ?? 1.075) / 1.075);
  const sigPsi = (F.sigma0 ?? 1.4) * Math.PI / 180 * (x.finF ?? 1) * fPied * (1 + kappa * (x.P ?? 0))
    * (1 + (F.fatigue ?? 0.2) * (1 - (x.stam ?? 1))) * Math.pow(Math.max(0.3, (x.spd ?? 25) / (F.vMax ?? 35)), F.gamma ?? 1.2)
    * (1 + (F.dist ?? 0.012) * Math.max(0, (x.dG ?? 12) - 12));
  return { sigPsi, sigTheta: (F.aniso ?? 2) * sigPsi, sigV: F.sigmaV ?? 0.08,
    muV: -((F.sousDose ?? 0.05) + (F.sousDoseP ?? 0.10) * (x.P ?? 0)) - (F.fatigueV ?? 0.06) * (1 - (x.stam ?? 1)) };
}

export function strikeNow(st, c, cfg) {
  const { choice, pick, stance, urgent } = c.act.payload;
  const rec = st.players[choice.to.id];
  // LE ROULÉ DU GARDIEN (lot A9) part des MAINS, bas et devant : le ballon tenu descend au point de lâcher
  // (hold — le déplacement porté, pas un téléport) et la balistique part de là
  const mains = c.act.payload.mains;                            // 'roule' : aux gants descendus au point de lâcher ; 'volee' : le ballon lâché qui tombe (keeper.gkHeldBall) — la frappe part de sa hauteur
  const from = [st.ball.p[0], mains ? Math.max(BALL.radius, st.ball.p[1]) : BALL.radius, st.ball.p[2]];
  if (mains === 'volee' && st.ball.owner !== c.id) { deny(st, 'volée-volée'); return; }   // le ballon lâché lui a été pris : pas de frappe dans le vide
  // LA LIGNE RELUE À LA FRAPPE (243, cfg.ligneFermee.relu && st.full — retour utilisateur « un adversaire sur la ligne de passe ») : la
  // ligne était OUVERTE à l'adoption (≥ 1,15 m) et un défenseur y est entré pendant l'armé (0,77 s p50 — 15 des 22 passes au sol
  // jouées dans un corps, mesurées) ; le passeur qui a le temps (pas urgent) relit sa ligne au contact : fermée sous relu × visionF
  // (le myope laisse partir, le voyant refuse plus tôt), le geste finit en FEINTE — ballon au pied, l'intention se re-choisit ;
  // refus nommé ligne-fermee. Le centre, le through et la cloche passent par-dessus, ils ne relisent pas. Absente : l'hier au bit.
  if (st.full && cfg.ligneFermee && cfg.ligneFermee.relu && rec && !urgent && !choice.cross && !choice.through && choice.style !== 'lofted') {
    const blockers = st.players.filter((q) => q.team !== c.team && !q.keeper && q.down <= 0 && !q._sub).map((q) => q.p);
    const lead0 = [rec.p[0] + rec.v[0] * 0.28, BALL.radius, rec.p[2] + rec.v[1] * 0.28];
    const lane = laneClearance(from, lead0, blockers, { corridor: cfg.ligneFermee.relu * (c.skill?.visionF ?? 1) });
    if (!lane.open) { c.intent = null; st.events.push({ t: +st.t.toFixed(2), type: 'refus', kind: 'ligne-fermee', by: c.id, marge: +lane.margin.toFixed(2) }); return deny(st, 'ligne-fermee'); }
  }
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
      if (st.full && cfg.porteAnticipe) { c._reprise = st.t + (cfg.porteAnticipe.reprise ?? 0.8); c.v[0] *= cfg.porteAnticipe.frein ?? 0.4; c.v[1] *= cfg.porteAnticipe.frein ?? 0.4; }   // …et le vendangé FREINE et se REPREND (movement.js : il vise son ballon, sans poussée) — hier il filait 0,6 s sur l'élan du glissement (7,5 m/s) et perdait la possession
      if (st.ball.owner === c.id) st.ball.release('perte');              // la touche ratée le lui échappe
      st.ball.impulse([-st.ball.v[0] * 0.4, 0, -st.ball.v[2] * 0.4], dW(st, cfg, 0.4));   // vendangé : le ballon reste libre
      return;
    }
  }
  // la re-mène du contact suit LA MÊME loi que le choix : une mène courte ici défaisait la mène
  // de course posée par choosePass (le tir garde sa cible fixe)
  const tRe = choice.shot ? 0 : (cfg.leadTime ? cfg.leadTime(hyp((rec?.p[0] ?? 0) - from[0], (rec?.p[2] ?? 0) - from[2]), rec) : 0.18);
  const KB = rec && st.full && cfg.croyance ? croyanceDe(c, rec, st, cfg) : null, rP = KB ? KB.p : rec?.p, rV = KB ? KB.v : rec?.v;   // (262) LE PASSEUR VISE SA CROYANCE du receveur (croyance.js) : la passe vers un fantôme si elle est vieille
  c._croyPasse = KB ? { err: hyp(KB.p[0] - rec.p[0], KB.p[2] - rec.p[2]), age: KB.age, sigma: KB.sigma } : null;
  let lead = rec ? [rP[0] + rV[0] * tRe, 0, rP[2] + rV[1] * tRe] : choice.lead;
  // LA MÈNE DE COURSE SURVIT AU CONTACT (167, cfg.courseServie — retour utilisateur : « aucun
  // joueur ne court derrière un ballon ») : le through élu posait un rendez-vous 8-11 m devant,
  // la re-mène générique ci-dessus l'ÉCRASAIT à la frappe (mène frappée 3,6 m médiane, mesuré).
  // Le contact re-résout LA MÊME loi que le choix : le sprint promis (vCourse × topF) × le vol,
  // + la pointe à la vision du passeur — la position du coureur a bougé pendant l'armé, le POINT
  // se re-calcule, il ne se rabat pas. Clé absente : l'écrasement d'hier au bit.
  if (choice.through && rec && st.full && cfg.courseServie) {
    const vR = hyp(rV[0], rV[1]);
    const dirT = vR > 1 ? [rV[0] / vR, rV[1] / vR] : (rec._pace?.dir ?? null);
    if (dirT) {
      let tV = hyp(rec.p[0] - from[0], rec.p[2] - from[2]) / 11;
      const vS = Math.max(vR, (cfg.courseServie.vCourse ?? 6.2) * (rec.skill?.topF ?? 1));
      for (let it = 0; it < 2; it++) {
        const adv = Math.min(vS * tV + (cfg.throughBall?.pointe ?? 2.5) * (c.skill?.visionF ?? 1), cfg.courseServie.advMax ?? 16);
        lead = [rP[0] + dirT[0] * adv, 0, rP[2] + dirT[1] * adv];
        const s2 = solvePass(from, lead, { style: 'ground', arrival: choice.arrival ?? 5.2 });
        if (!s2) break;
        tV = s2.flightTime;
      }
      // …et LE PIQUÉ SE NOMME (172 — retour utilisateur : « je ne vois aucune passe en
      // profondeur » : 25 tentatives / 9 contrôles sur 20 min EXISTAIENT, invisibles au fil)
      st.events.push({ t: +st.t.toFixed(2), type: 'piqué', by: c.id, to: rec.id,
        avance: +hyp(lead[0] - rec.p[0], lead[2] - rec.p[2]).toFixed(1) });
    }
  }
  // LE HORS-CADRE DU VRAI FOOT (lot 145, cfg.dispersion && st.full — retour utilisateur :
  // « certainement trop cadrées », mesuré 13 % hors cadre, réel ~40) : le σ du point visé
  // s'AMPLIFIE à la SITUATION — le presseur au corps, le tireur lancé, la distance — et le
  // sang-froid (composureF, un × d'erreur) module l'inflation ; le monde non noté reçoit un
  // σ de base (le patron execSigma : le déchet existe sans notes). Plus bas, le même facteur
  // souffle la HAUTEUR et la VITESSE d'exécution. Clé absente : le σ plat d'hier, au bit.
  // L'ÉCHELLE DE FINITION (258, cfg.finition && st.full — la carte du book, Modèle 03 §5.2 / Modèle 10 §3 :
  // « shotSigma 0,10-0,55 m pour 7,32 m de cage ») : l'erreur du TIR n'est plus un σ métrique sur le point visé
  // mais un σ D'ANGLE à la frappe — σψ = σ0 × finF (finishing, identité à 50) × pied (faible + pied × weakF)
  // × pression (1 + κ P, κ × composureF / 1,075) × fatigue (1 + fat (1 − stam)) × (v / vMax)^γ × distance —
  // anisotrope (σθ = aniso σψ : le tir manque AU-DESSUS plus qu'À CÔTÉ), la vitesse log-normale SOUS-DOSÉE sous
  // pression et fatigue. Elle REMPLACE le σ métrique et le souffle du 145 sur le tir (le piqué exact garde son
  // geste). Clé absente : le 145 d'hier, au bit. Mesuré avant : conversion 24,5 % (réel 11), cadrés 55 % (33).
  const F258 = st.full && choice.shot && cfg.finition ? cfg.finition : null;
  const D145 = st.full && choice.shot && cfg.dispersion && !F258 ? cfg.dispersion : null;
  let sigF = 1;
  {
    const sigBase = choice.shot && !F258 ? (c.skill?.shotSigma ?? (D145 ? (D145.base ?? 0.33) : 0)) : 0;
    if (D145) {
      const dG = hyp(lead[0] - from[0], lead[2] - from[2]);
      let foeP = 99;
      for (const q of st.players) if (q.team !== c.team && !q.keeper && q.down <= 0) foeP = Math.min(foeP, hyp(q.p[0] - c.p[0], q.p[2] - c.p[2]));
      sigF = 1 + ((foeP < (D145.press ?? 3) ? (D145.pressF ?? 0.7) : 0)
        + Math.min(1, hyp(c.v[0], c.v[1]) / 6) * (D145.lanceF ?? 0.5)
        + Math.max(0, dG - 11) / (D145.distF ?? 18)) * (c.skill?.composureF ?? 1);
    }
    if (sigBase > 0) lead = [lead[0], lead[1], lead[2] + gauss(tirage(st, 'passe', c.id, st.rnd ?? (() => 0.5))) * sigBase * sigF];
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
  const solOpts = { style: choice.style, ...(choice.arrival ? { arrival: choice.arrival } : {}), ...(lift ?? {}) };   // le through (128) transmet SON arrivée dosée au control
  const sol = solvePass(from, lead, solOpts) || solvePass(from, choice.lead, solOpts);
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
  let dirNoise = 0, PG = null;
  if (!shot && !choice.clear) {
    // choice.sigmaF (lot 100 — contrat générique) : le multiplicateur de dispersion DU GESTE,
    // posé par l'appelant (le centre du mauvais pied ×1,9, du pied de débordement ×0,85 —
    // shooting.tryCross). Absent : 1, le σ d'hier au bit — aucun tirage de plus.
    if (c.skill && st.full && cfg.passe) { PG = pressionDe(st, c, cfg.passe, cfg).P; dirNoise = gauss(tirage(st, 'passe', c.id, st.rnd ?? (() => 0.5))) * sigmaPasse(c, choice, hyp(lead[0] - from[0], lead[2] - from[2]), PG, cfg.passe, 3.25 * Math.PI / 180) * (choice.sigmaF ?? 1); }   // (265) L'ERREUR DE GESTE PAR CLASSE ET DISTANCE (reception.js) : la base du book, la note en facteur, la classe, la pression, la distance
    else if (c.skill) dirNoise = gauss(tirage(st, 'passe', c.id, st.rnd ?? (() => 0.5))) * c.skill.passSigma * (urgent ? c.skill.composureF : 1) * (choice.sigmaF ?? 1);
    else if (cfg.execSigma) dirNoise = gauss(tirage(st, 'passe', c.id, st.rnd ?? (() => 0.5))) * cfg.execSigma * (urgent ? 1.25 : 1) * (choice.sigmaF ?? 1);
  } else if (!shot && choice.clear && st.full && cfg.clearSigma) {
    // LE DÉGAGEMENT RESPIRE (174, cfg.clearSigma — le monde ne produisait NI touches NI
    // corners : touches 9/90 min c. 40-50 réel, corners 1/20 matchs c. ~10/match — le clear
    // partait EXACT au flanc, or LE pourvoyeur de sorties du foot est le dégagement pressé).
    // σ de passe × ampli × composureF ; le monde NU reçoit execSigma (patron 145 : le déchet
    // existe sans notes, la note le RAFFINE). Clé absente : le clear exact d'hier au bit.
    const sigC = c.skill ? c.skill.passSigma * (c.skill.composureF ?? 1) : (cfg.execSigma ?? 0.044) * 1.25;
    dirNoise = gauss(tirage(st, 'passe', c.id, st.rnd ?? (() => 0.5))) * sigC * (cfg.clearSigma.ampli ?? 2.4);
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
  if (PG != null) spd *= Math.exp((cfg.passe.muV ?? -0.05) + (cfg.passe.muP ?? -0.10) * PG + gauss(tirage(st, 'passe', c.id, st.rnd ?? (() => 0.5))) * (cfg.passe.sigV ?? 0.06));   // (265) LE SOUS-DOSAGE : sous pression la passe est trop courte bien plus souvent que trop longue
  // …LE MÊME SOUFFLE SUR LA HAUTEUR ET LA VITESSE (145) : la frappe pressée/lancée/lointaine
  // s'envole ou s'écrase (±σEl × sigF rad) et son exécution varie (±σV × sigF) — le piqué
  // (kind.exact, une balistique de toucher) garde son geste exact
  if (D145 && shot && !kind?.exact) {
    elev = Math.max(0.005, elev + gauss(tirage(st, 'tir', c.id, st.rnd ?? (() => 0.5))) * (D145.sigmaEl ?? 0.04) * sigF);
    spd = Math.max(10, spd * (1 + gauss(tirage(st, 'tir', c.id, st.rnd ?? (() => 0.5))) * (D145.sigmaV ?? 0.05) * Math.min(1.6, sigF)));
  }
  // …LA FRAPPE DÉVIE EN ANGLE (258) : σψ à la frappe, σθ = aniso × σψ, la vitesse log-normale et sous-dosée.
  // Trois tirages seedés (cap, élévation, vitesse) — le monde à clé nulle n'en tire aucun.
  let shotYawNoise = 0;
  if (F258 && shot && !kind?.exact) {
    const rnd = tirage(st, 'tir', c.id, st.rnd ?? (() => 0.5));
    const dG = hyp(lead[0] - from[0], lead[2] - from[2]);
    let foeP = 99;
    for (const q of st.players) if (q.team !== c.team && !q.keeper && q.down <= 0) foeP = Math.min(foeP, hyp(q.p[0] - c.p[0], q.p[2] - c.p[2]));
    const P = Math.max(0, Math.min(1, 1 - Math.max(0, foeP - 1) / Math.max(0.5, (F258.press ?? 5) - 1)));   // l'intensité de pression [0..1] : 1 au corps (≤ 1 m), 0 au plateau press m (Modèle 04 : 4-5 m) — la distance en attendant le temps d'arrivée (Modèle 07)
    // …LA HAUTEUR VISÉE (258, F.hauteur — Modèle 10 §3.4 : le point visé est un TIRAGE dans un mélange, bas / mi-hauteur /
    // lucarne) : l'élévation ne vient plus du geste seul mais de la hauteur voulue au but (chute compensée) — c'est ce qui
    // rend possible le tir AU-DESSUS (réel : 1,5 × plus de manqués au-dessus qu'à côté). null : l'élévation du geste
    const H = F258.hauteur;
    if (H && (!kind || ['placé', 'puissance', 'enroulée', 'tendu'].includes(kind.id))) {   // les FRAPPES DE BUT tirent leur hauteur ; le ras-de-terre, le pointu, la volée, le lob gardent la hauteur de leur geste (le geste EST la hauteur)
      const u = rnd(), pB = H.p?.[0] ?? 0.62, pM = H.p?.[1] ?? 0.30;
      const yV = u < pB ? (H.bas ?? 0.35) : u < pB + pM ? (H.mi ?? 1.0) : (H.lucarne ?? 1.95);
      const tv = dG / Math.max(8, spd);
      elev = Math.max(0.005, Math.min(0.45, Math.atan((yV - (from[1] ?? 0.11) + 4.905 * tv * tv) / Math.max(1, dG))));
    }
    const faible = !!(c.strongFoot && c.strongFoot !== 'both' && c.foot && c.foot !== c.strongFoot);
    const L = finitionSigma(F258, { finF: c.skill?.finF ?? 1, composureF: c.skill?.composureF ?? 1.075, weakF: c.skill?.weakF ?? 1, faible, P, stam: c.stam ?? 1, spd, dG });
    shotYawNoise = gauss(rnd) * L.sigPsi; sol.dirYaw += shotYawNoise;   // la déviation de cap du tir, comme celle de la passe (dirNoise), avant la frappe
    elev = Math.max(0.005, elev + gauss(rnd) * L.sigTheta);
    spd = Math.max(10, spd * Math.exp(gauss(rnd) * L.sigV + L.muV));
  }
  // LA CLOCHE DU CENTRE (cfg.tete && st.full — lot 34) : un centre est un ARC par-dessus le
  // premier rideau, pas une passe tendue (0 centre entré en surface sur 4 matchs mesurés —
  // mangés en route). La balistique de la rentrée : portée → vitesse, θ ~26°, et le temps
  // de vol re-solvé pour le receveur qui attaque sa mène.
  if (choice.cross && choice.bas && st.full) {
    // LE CENTRE BAS (lot 40) : fort et À RAS vers le point de penalty — le ballon skim à
    // hauteur de reprise (apogée ~0,3 m, un rebond en route est sa nature), la volée l'attend
    const R = hyp(lead[0] - from[0], lead[2] - from[2]);
    elev = 0.14;
    spd = Math.max(15, R * 1.25);
    sol.flightTime = R / (spd * Math.cos(elev));
  } else if (choice.cross && cfg.tete && st.full) {
    const R = hyp(lead[0] - from[0], lead[2] - from[2]);
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
    const R = hyp(lead[0] - from[0], lead[2] - from[2]);
    elev = 0.42;
    const solB = liftSpin ? solvePass(from, lead, { style: elev, ...liftSpin }) : null;
    if (solB) { spd = solB.speed; sol.flightTime = solB.flightTime; liftAtStrike = liftSpin; }
    else {
      spd = Math.sqrt(Math.max(10, R) * 9.81 / Math.sin(2 * elev));
      sol.flightTime = 2 * spd * Math.sin(elev) / 9.81;
    }
    st.events.push({ t: +st.t.toFixed(2), type: 'renversement', by: c.id, to: choice.to.id, dz: +Math.abs(lead[2] - from[2]).toFixed(1), fix: st._fix?.team === c.team ? st._fix.n : 0 });
    st._basculeAt = { ...(st._basculeAt ?? {}), [c.team]: st.t };  // la respiration (lot 98) : pas deux diagonales coup sur coup
  }
  // …le RÉPERTOIRE porte son effet (lot 39) : l'enroulée son Magnus signé (kind.rev ±8 — la
  // courbe RAMÈNE la mène décalée au vrai poteau), les frappes de cou-de-pied leur rotation
  // lisible (0,5), flottante/pointu quasi rien (le gardien les lit tard). Sans kind : 0, au bit près.
  st.ball.strike({ speed: spd, dirYaw: sol.dirYaw, elevation: elev,
    spinAxis: liftAtStrike ? liftAtStrike.spinAxis : [0, 1, 0], spinRev: liftAtStrike ? liftAtStrike.spinRev : (kind?.rev ?? 0) });
  if (choice.clear) st.events.push({ t: +st.t.toFixed(2), type: 'clearance', by: c.id, foot: c.foot });
  if (choice.cross) st.events.push({ t: +st.t.toFixed(2), type: 'centre', by: c.id, foot: c.foot, to: choice.to.id, bas: !!choice.bas, ...(choice.sigmaF != null && choice.sigmaF !== 1 ? { patte: choice.sigmaF } : {}) });
  if (shot) {
    st.events.push({ t: +st.t.toFixed(2), type: 'shot', by: c.id, foot: c.foot,
      range: choice.shotInfo?.range ?? null, clear: choice.lane?.margin ?? null,
      tz: choice.shotInfo?.tz ?? null, gkZ: choice.shotInfo?.gkZ ?? null, speed: +spd.toFixed(1),   // …le spd FRAPPÉ (145) : l'event dit la vitesse réelle, souffle compris
      kind: kind?.id ?? 'tendu', elev: +elev.toFixed(2), z: +st.ball.p[2].toFixed(1) });
  }
  // LA PERCEPTION A UNE HORLOGE : le départ du ballon est un événement — mais l'armé était
  // VISIBLE. La défense paie max(0, réaction perso − armé vu) : une passe téléphonée s'anticipe,
  // une urgence courte se subit. (Consommé par la retenue de cible dans rondoStep.)
  // …et LA TALONNADE NE SE LIT PAS (lot 118) : sa signature est un bassin qui ne tourne pas
  // — l'armé visible ne téléphone rien, la défense paie presque plein tarif (seen plafonné)
  const seen118 = st.full && cfg.talonnade && pick?.tech?.clip === 'talonnade'
    ? Math.min(c.act ? c.act.t : 0, cfg.talonnade.seen ?? 0.08) : (c.act ? c.act.t : 0);
  st._surprise = { t: st.t, seen: seen118, n: (st._surprise?.n ?? 0) + 1 };
  st.phase = 'flight';
  st.pass = { from: c.id, to: choice.to.id, lead, style: choice.style, t: st.t, flight: sol.flightTime, error: sol.error, origin: [from[0], from[2]], cross: !!choice.cross, ...(choice.through ? { through: true } : {}) };
  // LE TROISIÈME HOMME (lot 111, cfg.troisieme && st.full — « le foot est plus varié dans la
  // création ») : au DÉPART de A→B, le relais C (côté but de B, à portée de une-touche) pique
  // un appel court dans l'intervalle — la passe que B peut remettre en première intention
  // SANS que le presseur de A la voie venir. Le candidat se tire sur rnd2 (le flux auxiliaire),
  // × l'axe relation (le jeu combiné) × le rôle appel de C. Absente : le monde à deux d'hier.
  if (st.full && cfg.troisieme && choice.to?.p && !choice.shot) {
    const g3 = st.pitch.attackGoal(c.team), sg3 = Math.sign(g3.x || 1);
    let C = null, bs = -1;
    for (const q of st.players) {
      if (q.team !== c.team || q.keeper || q.down > 0 || q.expulse || q._sub || q.id === c.id || q.id === choice.to.id) continue;
      const dB = hyp(q.p[0] - choice.to.p[0], q.p[2] - choice.to.p[2]);
      if (dB < (cfg.troisieme.min ?? 6) || dB > (cfg.troisieme.max ?? 16)) continue;
      if (sg3 * (q.p[0] - choice.to.p[0]) < 1) continue;
      const sc3 = (20 - dB) + sg3 * (q.p[0] - choice.to.p[0]);
      if (sc3 > bs) { bs = sc3; C = q; }
    }
    if (C && tirage(st, 'intention', c.id, st.rnd2 ?? (() => 0.5))() < (cfg.troisieme.p ?? 0.5) * axe(tac(st, c.team).relation, 1.4, 0.6) * axe(role(C).appel, 0.7, 1.3) * (st.full && cfg.familiarite ? affiniteMotif(affiniteFam(st, c.id, C.id, cfg), cfg.familiarite) : 1)) {   // (254) le motif à trois vit de l'affinité de la paire
      C._pace = { until: st.t + (cfg.troisieme.dur ?? 1.1), kind: 'troisieme', next: C._pace?.next ?? st.t + 6 };
      C._troisT = st.t + (cfg.troisieme.dur ?? 1.6);
      // (240, cfg.appuiRemise.vieC) LA COURSE VIT LE CYCLE : jusqu'à la réception de B + vieC s (mesuré : C partait 0,95 s avant la réception et mourait 0,65 s après — seule la une-touche le servait, 3 sur 25 contrôles) ; gardé par la clé, le jumeau au bit
      if (cfg.appuiRemise) { const vie = st.t + (st.pass?.flight ?? 0.8) + (cfg.appuiRemise.vieC ?? 1.2); C._troisT = vie; C._pace.until = vie; C._troisAt = st.t; }
      st.events.push({ t: +st.t.toFixed(2), type: 'troisieme', a: c.id, b: choice.to.id, c: C.id });
    }
  }
  // LE UNE-DEUX (lot 119, cfg.unDeux && st.full — la liste utilisateur : le MUR). Sur une
  // passe COURTE d'un passeur PRESSÉ, le passeur ENCHAÎNE SA COURSE dans le dos de son
  // presseur (donne-et-va) — le même marqueur que le relais du 3e homme (_troisT) : le
  // receveur le SERT en première intention (premiere-intention bonifie déjà les coureurs
  // marqués, zéro consommateur nouveau). Tiré sur rnd2 × l'axe relation (le jeu combiné
  // aime le une-deux) × le rôle appel DU PASSEUR. Absente : le monde d'hier au bit.
  if (st.full && cfg.unDeux && choice.to?.p && !choice.shot && !c.keeper) {
    const dAB = hyp(choice.to.p[0] - c.p[0], choice.to.p[2] - c.p[2]);
    const presse2 = st.players.some((q) => q.team !== c.team && q.down <= 0
      && hyp(q.p[0] - c.p[0], q.p[2] - c.p[2]) < (cfg.unDeux.press ?? 2.5));
    if (dAB < (cfg.unDeux.dist ?? 13) && presse2
      && tirage(st, 'intention', c.id, st.rnd2 ?? (() => 0.5))() < (cfg.unDeux.p ?? 0.55) * axe(tac(st, c.team).relation, 1.4, 0.6) * axe(role(c).appel, 0.7, 1.3) * (st.full && cfg.familiarite ? affiniteMotif(affiniteFam(st, c.id, choice.to.id, cfg), cfg.familiarite) : 1)) {   // (254) l'un-deux vit de l'affinité de la paire
      c._pace = { until: st.t + (cfg.unDeux.dur ?? 1.5), kind: 'un-deux', next: c._pace?.next ?? st.t + 6 };
      c._troisT = st.t + (cfg.unDeux.dur ?? 1.5);
      // …ET LE LANCEUR SPRINTE (218, cfg.unDeux.course — mesuré : 2,3 m/s à 0,3 s, 2,4 à 0,6 s
      // (l'appel profond : 4,4 / 5,5 ; le réel 6-8 dès 0,5 s) : la pointe n'avait qu'un PLAFOND,
      // jamais de CIBLE — la consigne redevenait son slot, il TROTTAIT. Le donne-et-va prend
      // une cible dans le DOS de son presseur : course m vers le but, décalée du côté opposé au
      // presseur (ecart m) ; le poseur la consomme pendant la pointe (borne : le hors-jeu).
      // 1 retour/16 hier : le mur ne trouvait pas de coureur. Absente : l'hier au bit.
      if (cfg.unDeux.course) {
        const C = cfg.unDeux.course, sg = Math.sign(st.pitch?.attackGoal?.(c.team)?.x ?? 1) || 1;
        const q = st.players.filter((o) => o.team !== c.team && o.down <= 0).sort((a, b) => hyp(a.p[0] - c.p[0], a.p[2] - c.p[2]) - hyp(b.p[0] - c.p[0], b.p[2] - c.p[2]))[0];
        const cote = q ? -Math.sign(q.p[2] - c.p[2] || 1) : Math.sign(c.p[2] || 1);
        // …la course PROLONGE L'ÉLAN (trace : lancé à 7,5 m/s en conduite, la cible plein but lui imposait un
        // demi-tour — 2,0 m/s à 0,8 s) : direction = élan × elan + but × (1 − elan), avancée plancher 30 %
        const vN = hyp(c.v[0], c.v[1]), el = vN > 2 ? (C.elan ?? 0.5) : 0, M = C.m ?? 8;
        let ux = sg * (1 - el) + (c.v[0] / (vN || 1)) * el, uz = (c.v[1] / (vN || 1)) * el;
        const ul = hyp(ux, uz) || 1; ux = (ux / ul) * M; uz = (uz / ul) * M;
        if (ux * sg < 0.3 * M) ux = sg * 0.3 * M;
        // …ET LA COURSE CHERCHE L'ESPACE (218b, C.espace — la fixture du mur : il sert le coureur quand le
        // défenseur est sur la ligne de passe et l'appui quand le défenseur COUVRE la course ; 5 retours/24) :
        // des deux côtés (±ecart), celui dont le couloir mur → cible et le rendez-vous sont les plus
        // dégagés ; l'ancien côté (dos du presseur) départage. Absente : le 218 au bit.
        let coteE = cote;
        if (C.espace) {
          const foes = st.players.filter((o) => o.team !== c.team && o.down <= 0).map((o) => o.p);
          const score = (k) => {
            const tx = c.p[0] + ux, tz = c.p[2] + uz + k * (C.ecart ?? 3);
            const lane = laneClearance(choice.to.p, [tx, 0, tz], foes, { corridor: 1 });
            let near = 99; for (const f of foes) near = Math.min(near, hyp(f[0] - tx, f[2] - tz));
            return Math.min(lane.margin, near) + (k === cote ? 0.3 : 0);
          };
          coteE = score(1) >= score(-1) ? 1 : -1;
          // …ET LA LECTURE EST UNE NOTE (218d, C.lecture — le mantra : les attributs entrent par des
          // facteurs) : le coureur mal noté OFF THE BALL lit parfois le mauvais côté — probabilité
          // (1 − otbF) × lecture (otbF 0,85 → 30 %) ; à 50 et au-dessus aucun tirage : l'identité au bit.
          const mis = Math.max(0, 1 - (c.skill?.otbF ?? 1)) * (C.lecture ?? 2);
          if (mis > 0 && tirage(st, 'intention', c.id, st.rnd2 ?? (() => 0.5))() < mis) coteE = -coteE;
        }
        const dx = ux, dz = uz + coteE * (C.ecart ?? 3), dl = hyp(dx, dz) || 1;
        c._pace.cible = [c.p[0] + dx, c.p[2] + dz]; c._pace.dir = [dx / dl, dz / dl];
      }
      st.events.push({ t: +st.t.toFixed(2), type: 'un-deux', a: c.id, b: choice.to.id });
    }
  }
  // LA PHOTO DE LA LOI 11 (cfg.offside — 11c11) : le hors-jeu se juge À L'INSTANT DE LA FRAPPE —
  // pas au choix (le coureur gagne des mètres pendant l'armé : c'est TOUT l'appel timé), pas à
  // la réception (le monde a bougé pendant le vol). On photographie ICI les coéquipiers en
  // position illicite ; leur premier toucher SIFFLE (receive), l'adversaire qui joue le ballon
  // efface l'ardoise (le turnover tue st.pass). Dégagements et tirs portent la même photo — le
  // renvoi qui trouve un attaquant resté aux six mètres est LE hors-jeu classique.
  if (cfg.offside && st.full) {
    const K = cfg.horsJeu ?? null;   // (259) la photo lit L'ORTEIL (offside.pointCorps) — le cerveau, lui, juge le centre : l'écart est le hors-jeu d'un orteil
    const L = offsideLine(st, c.team, K);
    let off = null;
    for (const q of st.players) {
      if (q.team !== c.team || q.id === c.id || q.keeper || q.p[0] * L.sgn + (K ? pointCorps(st, q, L.sgn, K, +1) : 0) <= L.adv + 0.05) continue;
      (off ??= {})[q.id] = [+q.p[0].toFixed(2), +q.p[2].toFixed(2)];
    }
    if (off) st.pass.off = off;
  }
  st.lastPasser = c.id;
  // LA FIXATION S'ENREGISTRE (lot 98, cfg.renversement && st.full) : les passes conclues du
  // même côté nourrissent le DROIT au renversement (rondo.js l'exige — on ne renverse pas un
  // bloc qu'on n'a pas déformé). L'axe central (|z| < 4) prolonge sans casser ; le côté
  // opposé repart à 1 (cette passe fixe le nouveau côté) ; le turnover reset (team change).
  if (cfg.renversement && st.full) {
    const zSide = Math.abs(from[2]) < 4 ? 0 : Math.sign(from[2]);
    const F = st._fix;
    st._fix = F && F.team === c.team && (zSide === 0 || F.side === 0 || F.side === zSide)
      ? { team: c.team, side: zSide || F.side, n: F.n + 1 } : { team: c.team, side: zSide, n: 1 };
  }
  st.possession.carrier = -1;
  // la sortie au gardien pose son COOLDOWN d'équipe (lot 136 — pas de ping-pong)
  if (st.players[choice.to.id]?.keeper) (st._gkOutCd ??= {})[c.team] = st.t + (cfg.sortieGardien?.cd ?? 12);
  st.hold = 0; st.pressure = 0;
  const sit = situation(c.p, c.yaw, from, [0, 0, 0], from[1]);
  const tx = lead[0] - c.p[0], tz = lead[2] - c.p[2];
  const fx = Math.cos(c.yaw), fz = Math.sin(c.yaw);
  const outBearing = (Math.atan2(fx * tz - fz * tx, fx * tx + fz * tz) * 180) / Math.PI;
  st.events.push({
    // (256) by canonique — l'alias from est tombé au 257 ; sansCible : le ballon expédié sans destinataire (dégagement, urgence) — pas une passe manquée
    t: +st.t.toFixed(2), type: 'pass', by: c.id, to: choice.to.id, ...(c._croyPasse ? { croyErr: +c._croyPasse.err.toFixed(2), croyAge: +c._croyPasse.age.toFixed(2), croySigma: +c._croyPasse.sigma.toFixed(2) } : {}), ...(choice.to.id < 0 ? { sansCible: true } : {}), style: choice.style, foot: c.foot, ...(mains ? { mains, ballY: +from[1].toFixed(2) } : {}), ...(choice.through ? { through: true } : {}), ...(choice.clear ? { clear: true } : {}),
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
import { hyp } from './hyp.js';
