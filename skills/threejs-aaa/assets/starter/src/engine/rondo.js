import { BALL } from './ball.js';
import { BallBody } from './ball-body.js';
import { predictPath, solvePass, laneClearance, interceptPoint, PASS_STYLE } from './ball-predict.js';
import { winding } from './gesture.js';
import { makePersona } from './persona.js';

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
  // LE DUEL PREND LE TEMPS D'UN DUEL. À 0,5 s, le vol sous pression était un métronome : 19,6 vols/min,
  // 54 % des pertes, possession médiane 0,40 s (sonde duels-tacles). Et la minuterie comptait la
  // proximité du CORPS — le « gagnant » était jusqu'à 2,33 m du ballon au flip. Désormais elle ne court
  // que si le défenseur BAT le porteur au ballon (contestRadius + shieldSlack, voir rondo-sim), et son
  // terme n'est plus une bascule d'étiquette : c'est l'ENGAGEMENT d'un tacle-debout (0,28 s d'armé de
  // plus, gagnable par le porteur qui sort le ballon pendant l'armé).
  tackleTime: 0.9,         // s of sustained pressure to COMMIT to the standing tackle (was 0.5)
  standCooldown: 1.5,      // s — un tacle-debout manqué ne se re-tente pas dans la seconde (anti-mitraillette)
  receiveRadius: 0.85,     // m — the receiver takes the ball. Was 1.25, which is BEYOND the reach of
                           // every control in the technique table (widest window 1.0 m): the touch
                           // fired while the ball was still out of reach, so it stopped a metre away.
  controlSettle: 0.34,     // m — where the ball ends up in front of the foot after a touch
  footSide: 0.11,          // m — and how far to the side of centre, on the controlling foot
  releaseClear: 1.8,       // m the ball must travel before ANYONE can take it (else the passer intercepts himself)
  holdMin: 0.4,            // s — minimum on the ball before passing (no hot-potato) — sous pression
  //                          (0,35 → 0,40 : hold p50 mesuré 0,78 s pour une cible ≥ 0,8, le dixième manquant
  //                          vient des passes pressées ; 0,45 balayé : p50 1,13 mais 43 % d'inter-passes en
  //                          2-5 s (cible 20-35) et record moyen 9,3 → 7,1 — trop de duels subis)
  // LA TENUE DÉLIBÉRÉE. holdMin seul faisait un métronome : hold p50 = 0,38 s (= holdMin + armé),
  // 0-1,6 % des inter-passes dans la bande 2-5 s d'un vrai rondo, chaque passe au minimum légal
  // (sonde tempo-espaces). Un porteur NON pressé (adversaire > calmFoe) tient son ballon un temps
  // tiré dans holdCalm — SEEDÉ par st.rnd, jamais Math.random — avant d'adopter une intention ;
  // pressé, l'ancien holdMin reprend : fixer puis donner, pas patate chaude puis patate chaude.
  holdCalm: [0.8, 1.8],    // s — la fourchette de tenue délibérée d'un porteur au calme
  calmFoe: 2.0,            // m — adversaire plus loin que ça = pas d'urgence à jouer
  intentBarCalm: 3.6,      // barre d'adoption d'intention relevée au calme (3,2 pressé) — 3,9 affamait
  //                          l'attaque une fois la pénalité de sortie ajoutée à choosePass (32 frappes/partie)
  settleExtra: 0.25,       // s — pas de beginPass avant la fin de la fenêtre _settling + ce délai
  holdMax: 3.0,            // s — forced to release (no dwelling). 2,4 → 3,0 : avec la tenue délibérée
  //                          (jusqu'à 1,8 s) + l'armé (0,5 s), 2,4 forçait des balles « moins mauvaises »
  //                          au veto levé — la moitié des interceptions ; un vrai rondo tient 2-5 s
  speeds: { press: 6.6, support: 5.4, carry: 4.2, chase: 6.9 },
  sprintMax: 8.0,          // m/s — plafond ABSOLU après paceBias × rupture : une chasse en rupture
                           // composait 6,9 × 1,28 × 1,06 = 9,4 m/s (au-delà du sprint humain en
                           // carré court) — le produit des accents se borne, comme tout actionneur
  // 9,5 m/s² dépassait le max humain (6-8) de 20-60 % et la locomotion vivait en bang-bang : 59 %
  // des images joueur EXACTEMENT à la saturation du cap (sonde allures-inclinaison, p50 = p90 =
  // 11,24 m/s² = √(9,5²+6²)). 7,5 rentre dans la plage humaine ; le low-pass sur la demande
  // (wantTau, movePlayers) sort les soutiens du régime tout-ou-rien.
  accel: 7.5,              // m/s² along the direction of travel (was 9.5 — above human max)
  wantTau: 0.12,           // s — low-pass sur la DEMANDE de vitesse des rôles calmes (support/mark)
  supportNearCap: 1.7,     // m/s — un soutien près de sa station ajuste par petits pas (p50 avant/après : 3,2 → 1,7)
  settledWalkCap: 1.35,    // m/s — un soutien posé (porteur au calme) MARCHE entre deux appels : le contraste EST le rythme
  // LES GESTES TECHNIQUES (râteau / feinte de passe / arrêt semelle). Chaque nombre est une loi de
  // déclenchement ou un prix — jamais un ressenti : le râteau demande un presseur FRONTAL réel et
  // une sortie arrière libre ; la feinte ne se tente qu'au calme relatif (contestée = suicide) et
  // mord les défenseurs lancés dans le cône de la fausse passe ; la semelle exige le champ libre.
  // Les cooldowns tiennent la fréquence au niveau d'un vrai rondo (un geste est un événement,
  // pas un tic), et flair (persona) module QUI tente.
  skill: {
    rateauFoe: 1.45,       // m — le presseur est PRESQUE sur vous (à 1,8 m, 12,5 râteaux/partie — le cirque)
    rateauFront: 60,       // ° — relèvement max du presseur (frontal, pas dans le dos)
    rateauClear: 1.35,     // m — la sortie ARRIÈRE doit être libre à ce rayon (2,0 ne se trouvait
                           // JAMAIS dans un carré de rondo : 0 râteau, 8 refus/partie — la borne
                           // suit la densité du carré, comme spreadFrac suit sa taille)
    rateauCd: 9,           // s — un retournement est une décision, pas une toupie
    feinteFoe: [1.2, 2.6], // m — fenêtre du défenseur à feinter (trop près = un homme SUR vous — on
                           // joue une touche, pas une pantomime ; trop loin = personne à tromper)
    feinteCone: 55,        // ° — demi-cône autour de la FAUSSE direction dans lequel un défenseur peut mordre
    feinteBite: 0.55,      // s — le temps qu'un défenseur mordu reste assis sur sa ligne morte
    biteSlow: 0.35,        // ×accel et ×vitesse du mordu pendant la morsure — il a lancé son appui du mauvais côté
    feinteCd: 8,           // s
    semelleFoe: 2.4,       // m — personne à ce rayon : la semelle est un geste de champ libre
    semelleCd: 9,          // s
  },
  turnAccel: 6.0,          // m/s² PERPENDICULAR to it — the angular rate is turnAccel/speed, so pace
                           // costs agility and a dribbler can turn inside a sprinting defender
  swarmFrac: 0.135,        // the beehive radius as a fraction of the box's short side (see checkRondo)
  spreadFrac: 0.19,        // minimum team spread, likewise as a fraction of the box
  harriedMax: 0.62,        // max share of carry time with a defender inside tackle range (see checkRondo).
                           // Recalibré AVEC sa loi à l'arrivée des gestes techniques : mesuré sur
                           // 10 graines × 90 s, le monde sans gestes vivait à 38 ± 10 % (max 50),
                           // celui avec jeu de rétention (feinte, semelle, râteau — tenir SOUS
                           // pression est leur sens même) à 44 ± 10 % (max 62). Le sabotage
                           // « défenseur garé sur le porteur » mesure toujours ~100 % : la clause
                           // garde ses dents, le seuil suit le monde qu'elle juge.
  // OFF-BALL STATIONS (see supportSpot). stationBias pulls the support ring from the ball (0) toward
  // the middle of the grid (1) so the ring stays inside the box wherever the ball is. Swept over 16
  // seeds × 90 s: 0 → 15.8 % of the box occupied, 0.45 → 20.2 %, 0.6 → 22.2 %. 0.6 spreads the most and
  // plays the worst (completed passes 4.5 → 2.3: the men are too far apart to link). 0.45 beats the old
  // model on every axis at once — occupancy, distance-to-station, record AND completed passes.
  stationBias: 0.45,
  // How much better another spot must be before a man abandons the one he holds. HISTOIRE EN DEUX
  // TEMPS : à l'époque du ring recentré sur le ballon à chaque image, toute marge non nulle mesurait
  // PIRE (à 0,6 de bias, marge 9 → occupation 24,4→22,2) — l'oscillation venait du RING, pas de la
  // décision, et la marge ne faisait que retarder la correction. Le ring est depuis ANCRÉ EN EMA
  // (ringTau) : la sonde tempo-espaces a mesuré la station qui saute > 1,5 m ~2,5 fois/s et des
  // soutiens à p50 3,0-3,5 m/s en course perpétuelle — la marge + la tenure (spotTenure) redeviennent
  // le bon outil une fois la cause racine (le ring mobile) traitée.
  commitMargin: 2.0,
  spotTenure: 1.0,         // s — une station adoptée se tient au moins ce temps avant re-décision
  //                          (0,6 mesuré insuffisant : encore ~0,9 saut/s par soutien. Résultat négatif
  //                          consigné : pousser à tenure 1,4 + marge 2,6 ne rend que 5 % de sauts en moins
  //                          (157 → 149/min) et fait tomber le record moyen 9,3 → 6,2 — le résidu vient des
  //                          re-formations LÉGITIMES (turnover ⇒ stations remises à zéro, éviction mateGap),
  //                          pas de la décision qui flappe. 1,0/2,0 est l'optimum mesuré : 599 → ~150/min.)
  ringTau: 0.5,            // s — EMA de l'ancre du ring de soutien : le ring ne re-tourne pas à chaque touche
  mateGap: 2.0,            // m — candidat de station à moins de ça d'un coéquipier : REJETÉ (deux hommes = une ligne)
  occupyMin: 0.18,        // the possession team must span at least this fraction of the box (checkRondo clause 9)
  minGap: 0.5,             // m — two players closer than this are pushed apart (they were interpenetrating)
  strikeReach: 1.25,       // m — a pass is only played off a ball the foot can reach
  shieldSlack: 0.15,       // m — how far past the shielding body a defender must get to win the ball
  slideRange: [1.4, 3.2],  // m — the window a slide tackle can reach. Plancher 1,0 → 1,4 : en deçà de 1,3 m
  //                          le tacle-debout (table : dist 0,2-1,3) atteint le ballon SUR SES APPUIS — on ne se couche pas pour ça
  // LE TACLE GLISSÉ EST RARE OU IL N'EST RIEN. Mesuré (sonde duels-tacles) : 9,4/min, joués à 69 %
  // par l'équipe EN POSSESSION dont 49 % par le porteur plongeant sur sa propre touche — un rondo
  // d'entraînement au sol en permanence. Le geste redevient défensif (trySlide exclut l'équipe en
  // possession), coûteux (cooldown par joueur) et de dernier recours (marge 0,15 → 0,4 : on ne se
  // jette que si on perd NETTEMENT la course). Recovery 1,2 s constant → 0,9 s ± variance seedée
  // (référence réelle 0,5-1 s, mesuré figé à 1,200).
  slideRecovery: 0.9,      // s on the ground afterwards (±10 % seeded), won or lost: that cost is the decision
  slideMargin: 0.7,        // m — how much closer the opponent must be before going to ground is worth it
  //                          (0,4 prescrit par la sonde laissait encore 3-3,5 glissades/min : on ne se couche
  //                          que si la course est PERDUE d'un vrai pas, pas d'une épaule)
  slideCooldown: 12,       // s — un joueur ne se jette pas deux fois dans la même séquence (8-12 s réel, haut de fourchette : 10 s mesurait encore 2,5-4,5 glissades/min)
  slideMaxBall: 5.0,       // m/s — above this the ball is going too fast to be won by sliding at it
  //                          (6,0 mesurait des plongeons sur des ballons à 5-6 m/s qui traversaient la surface de jeu)
  carryStandoff: 0.4,      // m — how far BEHIND the ball the carrier places himself (0 = off)
  carrySideBias: 0.55,     // fraction of the standoff shifted to the STRIKING side (pre-aligns the stance)
  evadeAroundBall: true,   // sample the escape directions around the BALL rather than the player
  // --- carrying the ball AWAY from pressure (evadeSpot). Weights, not rules: the answer is a
  // compromise, so it is scored. `evadeKeep` is the one that turns a shuffle into a move.
  evadeStep: 1.2,          // m — how far ahead of the ball the escape point is placed
  evadeSamples: 24,        // directions sampled around the carrier
  evadeFoe: 1.0,           // weight on getting away from the CLOSEST defender at the candidate
  evadeMate: 0.35,         // …and on not running into your own supports
  evadeEdge: 0.8,          // …and on not getting pinned against the chalk — 0,45 laissait la conduite
  //                          pousser le ballon dehors : 13-14 sorties par partie DEPUIS la phase carry
  //                          (mesuré après la tenue délibérée : le porteur vit plus longtemps près de la craie)
  evadeKeep: 1.1,          // …and on continuing the way you were already going
  // The LONGEST anticipation any gesture has (animkit `passePivot`, 0.52 s). Only used to know how
  // early to start asking the question — beginPass then carves the anticipation of the gesture it
  // actually picked, which is the only correct number. See the carve-out in rondo-sim.
  windupBudget: 0.55,
  rushedRadius: 3.2,       // m — inside this, speed breaks ties between gestures (see beginPass)
  // --- la COURSE au vol (beginPass) : un couloir n'est pas une géométrie, c'est une course.
  raceSlack: 0.08,         // s — le défenseur qui arrive à ça du receveur gagne la course : passe refusée
  //                          (résultat négatif consigné : 0,18 « pour faire tomber les interceptions » étrangle
  //                          l'attaque au lieu de la protéger — record moyen 8,1 → 5,5 sur 8 graines, glissades EN
  //                          HAUSSE parce que le jeu se remplit de ballons rendus ; 0,08 garde la marge d'un
  //                          passeur réel sans tuer les lignes jouables)
  vetoTtl: 0.6,            // s — un receveur perdu à la course n'est pas re-proposé pendant ce temps
  intentTtl: 0.9,          // s — une intention de passe pilote l'approche AU PLUS ce temps avant de mourir
  strikeBallMax: 1.5,      // m/s — une frappe PLANIFIÉE exige un ballon posé (l'assise d'abord, voir beginPass)
  glideMax: 7.5,           // m/s — l'actionneur du glissement est borné (sous la clause des 8,4 m/s)
  // le CONTESTE du ballon posé — miroir du prédicat de carrier-owns-the-ball (FOOT_LIMITS.playable /
  // ownSlack) : l'adversaire conteste s'il est À PORTÉE DE JEU du ballon ET plus près que le porteur
  // de plus que la tolérance. « Proche » tout court n'est pas un prédicat : le presseur d'un rondo
  // vit à moins d'un mètre du ballon.
  contestRadius: 0.9,      // m — portée de jeu (= playable de la règle)
  contestSlack: 0.35,      // m — l'écart de tolérance (= ownSlack de la règle)
  carryLoose: 3.0,         // m — au-delà, le ballon n'est PLUS porté : phase libre (= carryMax de la règle)
  captureRadius: 0.9,      // m — un ballon au pied, non contesté, se CAPTURE quand l'intention se forme (le porté)
  rushedSlack: 0.5,        // …but only among options within this much of the best-scoring one
  windupCarve: 1,          // how much of it is taken OUT of the hold rather than added after it (0..1)
  // A TURN TAKES TIME. Bounded at turnAccel/speed rad/s like everything else that rotates here, with
  // this floor so a man standing still still turns at a human rate instead of snapping.
  turnRateMin: 4.5,        // rad/s at a standstill (~260°/s: a sharp but human pivot)
  // LE DUO PRESS/COVER NE CHASSE PAS EN FILE. Le cover à 0,42 × la ligne depuis le ballon vivait à
  // 1,5-3 m du ballon = un DEUXIÈME presseur : les 2 défenseurs les plus proches étaient tous deux
  // < 2,5 m du ballon 49-57 % du temps installé, angle de séparation p25 = 15-23° (sonde
  // tempo-espaces, charges à trois colinéaires à l'écran). Le cover coupe la ligne aux 2/3 et sous
  // un angle DISTINCT du presseur vu du ballon.
  coverFrac: 0.68,         // fraction de la ligne ballon→meilleure option où le cover se poste (60-75 % réel)
  coverMinAngle: 60,       // ° — angle minimal presseur/cover vus du ballon ; en deçà, le cover pivote
  // …et un PLANCHER RADIAL : posté à 0,68 × une ligne courte (option à 4 m), le cover retombait à
  // 2,7 m du ballon et l'amorti d'arrivée le faisait osciller SOUS 2,5 m — mesuré après le premier
  // réglage : press+cover encore tous deux < 2,5 m du ballon 54 % du temps installé, à 715 échantillons
  // sur 762 c'était bien LA paire press+cover. Le cover n'approche jamais à moins de ce rayon.
  coverMinDist: 3.0,       // m — distance minimale cover→ballon
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
        persona: makePersona(t * perTeam + i, seed),   // l'identité de mouvement — une source, sim ET visuel
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
    // LE HASARD DU JEU EST SEEDÉ, ET IL VIT SUR L'ÉTAT. La tenue délibérée du porteur et la variance
    // du temps au sol d'un tacle tirent ici — jamais Math.random : même graine, même partie, et le
    // contrat de déterminisme de verify-rondo le prouve à chaque run.
    rnd,
    // LE BALLON EST UN CORPS, pas un objet nu. Sa position est en lecture seule : écrire `ball.p`
    // LÈVE. C'est ce qui rend les 285 téléportations mesurées impossibles par construction plutôt
    // qu'interdites par une règle qui, elle, était aveugle (voir ball-body.js).
    ball: new BallBody([players[carrier].p[0] + 0.6, BALL.radius, players[carrier].p[2]]),
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
  const foesL = foes(st, c.team);
  const opp = foesL.map((p) => p.p);
  // the pass leaves the BALL, not the player's navel — the dribbler carries it a metre or two
  // ahead, and judging the lane from his hips is how a "clear" pass hits a defender's shin
  const origin = [st.ball.p[0], BALL.radius, st.ball.p[2]];
  let best = null;
  for (const m of mates(st, c.team)) {
    if (m.id === c.id) continue;
    // EN VETO : beginPass a fait courir la défense sur le vrai vol vers ce receveur (flightRace) et
    // elle gagne — re-proposer la même ligne à l'image suivante, c'est mourir en boucle sur un refus.
    // Le veto expire vite (la défense bouge), et tombe à holdMax : forcé, on joue le moins mauvais.
    if (st.laneVeto?.[m.id] > st.t && st.hold < cfg.holdMax) continue;
    const d = d2(origin, m.p);
    if (d < cfg.passRange[0] || d > cfg.passRange[1]) continue;
    // aim slightly in front of the receiver so he runs onto it rather than waiting for it
    const lead = [m.p[0] + m.v[0] * 0.28, BALL.radius, m.p[2] + m.v[1] * 0.28];
    const lane = laneClearance(origin, lead, opp, { corridor: cfg.corridor });
    // LA LIBERTÉ DU RECEVEUR SE MESURE À L'ARRIVÉE, PAS SUR LA PHOTO. La pression « maintenant »
    // notait libre un homme dont le marqueur arrivait pendant l'armé + le vol — mesuré : la
    // possession médiane tacklée mourait 0,76 s APRÈS la réception, la pression commençait AVEC le
    // ballon. Les défenseurs sont donc PROJETÉS au moment d'arrivée (armé ~0,4 s + vol au tempo du
    // jeu) — même philosophie que la course du couloir : le temps, pas la géométrie figée.
    const tArr = 0.4 + d / 9;
    const recvPressure = Math.min(...foesL.map((o) => Math.hypot(o.p[0] + o.v[0] * tArr - lead[0], o.p[2] + o.v[1] * tArr - lead[2])), 99);
    // a lofted ball beats a blocked lane, at the cost of being slower and harder to control
    const style = lane.open ? (d > 13 ? 'driven' : 'ground') : (lane.margin > 0.5 ? 'driven' : 'lofted');
    const blocked = !lane.open && style !== 'lofted';
    if (blocked) continue;
    // UNE PASSE MANQUÉE PRÈS DE LA LIGNE EST UNE SORTIE EN PRÉPARATION. Mesuré : la sortie de but
    // était devenue la première cause de perte (77/191 sur 8 graines), dont un tiers en vol — le
    // ballon dépasse son receveur et roule ~8 m. Si la ligne de sortie est à moins de 3 m DERRIÈRE
    // le point de réception (dans l'axe de la passe), le ballon raté ne pardonne pas : pénalité.
    let overrun = 99;
    {
      const ux = (lead[0] - origin[0]) / d, uz = (lead[2] - origin[2]) / d;
      const hx = st.area[0] / 2, hz = st.area[1] / 2;
      if (ux > 1e-6) overrun = Math.min(overrun, (hx - lead[0]) / ux);
      else if (ux < -1e-6) overrun = Math.min(overrun, (-hx - lead[0]) / ux);
      if (uz > 1e-6) overrun = Math.min(overrun, (hz - lead[2]) / uz);
      else if (uz < -1e-6) overrun = Math.min(overrun, (-hz - lead[2]) / uz);
    }
    const score =
      Math.min(lane.margin, 4) * 2.4                       // clearance is king
      + Math.min(recvPressure, 9) * 1.15                    // pass to the man who will BE free
      - Math.abs(d - 10) * 0.32                             // 10 m is the sweet spot
      - (m.id === st.lastPasser ? 2.6 : 0)                  // don't ping-pong
      - (style === 'lofted' ? 2.2 : 0)                      // ground ball whenever possible
      - (overrun < 3 ? (3 - overrun) * 0.9 : 0);            // ne joue pas VERS la sortie toute proche
    if (!best || score > best.score) best = { to: m, lead, style, score, lane, dist: d };
  }
  return best;
}

/**
 * The best place for an off-ball team-mate to offer himself, sampled and scored around `anchor`
 * (the carrier, or the BALL while a pass is in flight — there is no carrier during those seconds
 * and everyone still has to keep moving).
 */
function supportSpot(st, me, cfg, anchor, carrierId, { sector = 0, claimed = [], ring = null, bias = cfg.stationBias } = {}) {
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
  // …ET IL EST ANCRÉ SUR L'EMA DU BALLON (`ring`, assignJobs), pas sur le ballon de l'image : ancré
  // brut, chaque touche re-tournait le ring entier et la station sautait > 1,5 m ~2,5 fois par
  // seconde — les soutiens couraient en permanence à p50 3,0-3,5 m/s vers des points en fuite
  // (sonde tempo-espaces). En phase loose, `bias` = 1 : les secteurs s'ancrent au CENTRE du carré,
  // pour que le ring ne s'effondre pas du côté du scramble (deux soutiens mesurés à 0,50 m).
  const rc = ring ?? anchor;
  const cx = rc[0] * (1 - bias), cz = rc[2] * (1 - bias);
  const scoreAt = (p, a) => {
    if (Math.abs(p[0]) > ax / 2 - 1.2 || Math.abs(p[2]) > az / 2 - 1.2) return -Infinity;   // stay in the grid
    const nearMate = Math.min(...others.map((o) => d2(o, p)), 99);
    const nearClaim = Math.min(...claimed.map((c) => d2(c, p)), 99);
    // PÉNALITÉ DURE, PAS UN TERME : deux coéquipiers à 0,5 m n'offrent qu'une seule ligne à eux
    // deux, et le terme doux (×0,7) était DOMINÉ par le terme de secteur (×7,5) — mesuré : soutiens
    // id5/id7 à 0,50 m l'un de l'autre, moitié du carré vide (seed 3, t=48,65 s). Un candidat qui
    // marche sur un coéquipier n'est pas un mauvais candidat, c'est un non-candidat.
    if (nearMate < cfg.mateGap || nearClaim < cfg.mateGap) return -Infinity;
    const lane = laneClearance(anchor, p, opp, { corridor: cfg.corridor });
    const nearFoe = Math.min(...opp.map((o) => d2(o, p)), 99);
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

  // COMMIT TO THE STATION — hold the spot you claimed unless another is better by `commitMargin`
  // AND you have held this one at least `spotTenure`. Worth keeping the old negative result: with
  // the ring re-centred on the raw ball every frame, every non-zero margin measured WORSE — the
  // anthill was the ring moving, not the decision flapping. With the ring now EMA-anchored, the
  // hysteresis bites on the right cause: station jumps > 1.5 m measured at ~2.5/s per supporter
  // before, and the tenure is what turns "in transit forever" into "hold your angle, adjust by
  // steps". The re-score is still what stops you holding a place gone bad (−Infinity evicts).
  if (me.spotTeam !== st.possession.team) me.spot = null;      // stations do not survive a turnover
  me.spotTeam = st.possession.team;
  if (me.spot) {
    const held = me.spot;
    const a = Math.atan2(held[2] - cz, held[0] - cx);
    const heldScore = scoreAt(held, a);
    const tenure = st.t - (me.spotT ?? -99);
    if (heldScore !== -Infinity && (tenure < cfg.spotTenure || !best || best.score < heldScore + cfg.commitMargin)) return held;
  }
  me.spot = best ? best.p : [...me.p];
  me.spotT = st.t;
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
    if (Math.abs(x) > hx - 1.0 || Math.abs(z) > hz - 1.0) continue;      // off the chalk: not an option
    //  (0,6 → 1,0 : la touche de conduite porte le ballon ~1 m au-delà du point visé — une cible à
    //  0,7 m de la ligne est déjà une sortie de but en préparation, 49 sorties sur 4 graines)
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

  // L'ANCRE DU RING EN EMA (τ = ringTau). Le ring de soutien échantillonné sur le ballon BRUT
  // re-tournait à chaque touche : la station sautait > 1,5 m ~2,5 fois/s et par soutien, la cible de
  // marche bougeait > 3 m/s sur 10-11 % des images (churn 18-19 m/s : des téléports de cible), et
  // les soutiens couraient en permanence à p50 3,0-3,5 m/s (sonde tempo-espaces). Le ring suit le
  // ballon en ~0,5 s — la DÉFENSE, elle, attaque toujours le ballon réel (`anchor`).
  {
    const dtR = Math.max(0, st.t - (st._ringT ?? st.t));
    st._ringT = st.t;
    if (!st._ring) st._ring = [st.ball.p[0], st.ball.p[2]];
    const aR = 1 - Math.exp(-dtR / Math.max(1e-3, cfg.ringTau ?? 0.5));
    st._ring[0] += (st.ball.p[0] - st._ring[0]) * aR;
    st._ring[1] += (st.ball.p[2] - st._ring[1]) * aR;
  }
  // …et en phase LOOSE, les secteurs s'ancrent au CENTRE du carré (bias 1) : ancrés sur le ballon
  // d'un scramble, le ring s'effondrait du côté de la mêlée (deux soutiens à 0,50 m, moitié du
  // carré vide — seed 3, t=48,65 s, sonde tempo-espaces).
  const ringAnchor = st.phase === 'loose' ? [0, 0, 0] : [st._ring[0], 0, st._ring[1]];
  const ringBias = st.phase === 'loose' ? 1 : cfg.stationBias;

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
    .map((p) => ({ p, a: Math.atan2(p.p[2] - ringAnchor[2], p.p[0] - ringAnchor[0]) }))
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
          // …décalé CÔTÉ PIED FRAPPEUR : la stance d'une passe met le corps sur le côté du ballon, pas
          // pile derrière. Se tenir derrière-décalé pendant la conduite, c'est arriver à l'engagement
          // déjà à un demi-pas de l'ancre — mesuré, la porte d'atteignabilité refusait sinon assez
          // d'engagements pour doubler les pertes (record 4,5 / pertes 64 contre 8,4 / 28).
          const lat = (p.foot === 'left' ? 1 : -1) * cfg.carrySideBias;
          const px = -(gx / gl), pz = -(gz / gl);
          const lx = -pz * lat, lz = px * lat;               // perpendiculaire, côté frappeur
          p.target = [st.ball.p[0] + (px + lx) * cfg.carryStandoff, 0, st.ball.p[2] + (pz + lz) * cfg.carryStandoff];
          p.push = [gx / gl, gz / gl];                       // the direction the ball should be pushed
        } else { p.target = goal; p.push = null; }
        // L'INTENTION DE PASSE PILOTE L'APPROCHE. Quand l'engagement a été refusé (ancre hors
        // d'atteinte, ou fenêtre pas encore ouverte), beginPass a déposé OÙ le geste veut le corps —
        // derrière le ballon côté PASSE, pas côté fuite. Tant que cette intention est fraîche, c'est
        // elle la destination : le standoff d'évasion la contredit (p50 = 1,07 m d'écart angulaire
        // autour du ballon, un pas jamais fait — 122 pertes par tacle en 4 parties). Un joueur qui a
        // choisi sa passe marche sur sa position de frappe ; l'évasion reprend si l'intention expire.
        if (p.anchorHint && st.t - p.anchorHint.t < 0.4) {
          let tx = p.anchorHint.p[0], tz = p.anchorHint.p[1];
          // …ET ON MARCHE À TRAVERS LE POINT, PAS JUSQU'À LUI. L'amorti d'arrivée de movePlayers
          // (s = d·2,6) fait ramper les derniers décimètres — mesuré : borner le glissement à
          // 0,5 m a fait payer chaque passe ~0,25 s de rampe (taux de perte 0,58 → 0,75). Un
          // joueur qui va planter son appui traverse le point à vitesse de pas : la cible de
          // MARCHE dépasse l'ancre de 0,35 m dans la direction du chemin, et c'est l'engagement
          // (reachable ≤ 0,5) puis le glissement qui règlent l'arrêt — pas l'amorti générique.
          // …mais SEULEMENT TANT QU'ON EST LOIN (> 0,5 m) : en deçà, l'engagement (reachable ≤ 0,6)
          // a déjà la main et viser au-delà de l'ancre ne fait que la TRAVERSER — mesuré : le
          // receveur en livraison finissait 0,35 m PASSÉ son point d'assise (control-at-foot
          // 2,9 % → 5,9 %) et le segment rasait le ballon (not-inside-a-body 4,9 %).
          {
            const ax = tx - p.p[0], az = tz - p.p[2], al = Math.hypot(ax, az);
            if (al > 0.5) { tx += (ax / al) * 0.35; tz += (az / al) * 0.35; }
          }
          // …EN CONTOURNANT SON BALLON : l'ancre est souvent de l'autre côté de lui, et la droite
          // du pas le traverse (not-inside-a-body l'a compté). Si le segment corps→ancre passe dans
          // le cercle du ballon, on vise un point de PASSAGE décalé perpendiculairement — le détour
          // d'un pas que fait n'importe quel joueur autour d'un ballon posé.
          const bx = st.ball.p[0], bz = st.ball.p[2];
          const dxs = tx - p.p[0], dzs = tz - p.p[2], L2 = dxs * dxs + dzs * dzs || 1;
          const u = Math.max(0, Math.min(1, ((bx - p.p[0]) * dxs + (bz - p.p[2]) * dzs) / L2));
          const cx = p.p[0] + dxs * u - bx, cz = p.p[2] + dzs * u - bz;
          const cd = Math.hypot(cx, cz), AVOID = 0.34;
          if (u > 0 && u < 1 && cd < AVOID) {
            const nx = cd > 1e-6 ? cx / cd : -dzs / Math.sqrt(L2), nz = cd > 1e-6 ? cz / cd : dxs / Math.sqrt(L2);
            tx = bx + nx * AVOID; tz = bz + nz * AVOID;
          }
          p.target = [tx, 0, tz];
        }
        continue;
      }
      // the intended receiver runs onto the ball; everyone else offers an angle
      if (path && st.pass && st.pass.to === p.id) {
        p.job = 'receive';
        const i = interceptPoint(path, p.p, cfg.speeds.chase, { reaction: 0 });
        p.target = i ? [i.p[0], 0, i.p[2]] : [st.pass.lead[0], 0, st.pass.lead[2]];
      } else if (st.phase === 'loose' && p === supporters.reduce((b, q) => (!b || d2(q.p, anchor) < d2(b.p, anchor) ? q : b), null)) {
        // UN BALLON LIBRE SE DISPUTE. L'équipe « en possession » d'un ballon perdu envoyait ses cinq
        // hommes tenir le ring pendant que la défense ramassait gratuitement — et pire : quand
        // PERSONNE n'allait au ballon, la partie gelait (mesuré, graine 11 : ballon posé à v=0
        // pendant 115 s, le presseur arrêté à 0,88 m — voir le deadlock ci-dessous). Le plus proche
        // court au ballon : c'est le 50/50 du vrai football.
        p.job = 'receive';
        p.target = [anchor[0], 0, anchor[2]];
      } else {
        p.job = 'support';
        const sector = sectorOf.get(p.id) ?? 0;
        p.target = supportSpot(st, p, cfg, anchor, carrierId, { sector, claimed, ring: ringAnchor, bias: ringBias });
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
    // (Résultat négatif consigné : un rôle de presseur COLLANT — gardé tant qu'un autre défenseur
    // n'est pas 0,8 m plus près — visait à supprimer l'ex-presseur en transit, deuxième silhouette
    // de l'essaim mesuré. Effet réel : essaim quasi inchangé (58 → 49-61 %) et pression continue
    // qui étouffe l'attaque, record moyen 8,4 → 6,8 sur 8 graines. L'élection reste au plus près.)
    const pr = rest[0] ?? null;
    st._pressId = pr ? pr.id : -1;
    if (pr) {
      pr.job = 'press';
      // close the ball down, arriving on the touch-line side to cut the field in half
      // …SAUF SUR BALLON LIBRE : le poste « côté ligne » (0,7 m latéral) + l'amorti d'arrivée
      // (0,18 m) posaient le presseur à 0,88 m d'un ballon mort — 3 cm AU-DELÀ du receiveRadius
      // (0,85), et la partie gelait pour toujours (mesuré, graine 11 : 115 s sans une passe,
      // personne d'autre ne venant depuis que le ring de soutien s'ancre au centre en phase loose).
      // Un ballon libre n'a pas de côté : on va LE CHERCHER.
      pr.target = st.phase === 'loose' ? [anchor[0], 0, anchor[2]]
        : [anchor[0] + (anchor[0] > 0 ? 0.7 : -0.7), 0, anchor[2]];
    }
    // cover: stand in the single most dangerous lane
    const options = mates(st, atkTeam).filter((m) => m.id !== carrierId)
      .map((m) => ({ m, margin: laneClearance(anchor, m.p, def.map((d) => d.p), { corridor: cfg.corridor }).margin }))
      .sort((a, b) => b.margin - a.margin);
    let markers = rest.filter((q) => q !== pr);
    if (markers.length && options[0]) {
      const m = options[0].m;
      // LE COVER COUPE LA LIGNE, IL NE DOUBLE PAS LE PRESSEUR. À 0,42 × la ligne il vivait à
      // 1,5-3 m du ballon : un deuxième presseur — les 2 défenseurs les plus proches tous deux
      // < 2,5 m du ballon 49-57 % du temps installé, séparation p25 = 15-23° (sonde tempo-espaces).
      // Il se poste aux 2/3 de la ligne (coverFrac), jamais à moins de coverMinDist du ballon, ET
      // sous un angle minimal vu du ballon (coverMinAngle) : plus petit, il pivote latéralement
      // autour du ballon — il coupe toujours la passe, mais depuis un cône DISTINCT du presseur.
      let vx = (m.p[0] - anchor[0]) * cfg.coverFrac, vz = (m.p[2] - anchor[2]) * cfg.coverFrac;
      {
        const vl = Math.hypot(vx, vz);
        if (vl > 1e-6 && vl < cfg.coverMinDist) { vx *= cfg.coverMinDist / vl; vz *= cfg.coverMinDist / vl; }
      }
      if (pr) {
        const px = pr.p[0] - anchor[0], pz = pr.p[2] - anchor[2];
        if (Math.hypot(px, pz) > 0.3) {                        // presseur SUR le ballon : angle indéfini
          let dAng = Math.atan2(vz, vx) - Math.atan2(pz, px);
          while (dAng > Math.PI) dAng -= 2 * Math.PI;
          while (dAng < -Math.PI) dAng += 2 * Math.PI;
          const minA = (cfg.coverMinAngle * Math.PI) / 180;
          if (Math.abs(dAng) < minA) {
            const rot = (dAng >= 0 ? 1 : -1) * (minA - Math.abs(dAng));
            const cs = Math.cos(rot), sn = Math.sin(rot);
            const nx = vx * cs - vz * sn, nz = vx * sn + vz * cs;
            vx = nx; vz = nz;
          }
        }
      }
      const cp = [
        clamp(anchor[0] + vx, -st.area[0] / 2, st.area[0] / 2), 0,
        clamp(anchor[2] + vz, -st.area[1] / 2, st.area[1] / 2),
      ];
      // (Résultat négatif consigné : élire comme cover « l'homme le plus proche du POSTE » plutôt
      // que le 2ᵉ plus près du ballon devait vider la zone du ballon — mesuré : essaim inchangé
      // (le 2ᵉ corps collé est un marqueur/ex-presseur en transit, pas le cover), et les lignes
      // les plus dangereuses héritaient des marqueurs les plus proches — record moyen 8,4 → 5,6,
      // frappes 43,9 → 39,1, un porteur collé 62 % sur la graine 4. Le cover reste le 2ᵉ au ballon,
      // qui SORT vers son poste par le plancher radial.)
      const cov = markers[0] ?? null;
      if (cov) {
        cov.job = 'cover';
        cov.target = cp;
        markers = markers.filter((q) => q.id !== cov.id);
      }
    }
    // markers: goal-side of their man, shading the lane
    markers.forEach((d, i) => {
      const m = options[i + 1]?.m || options[options.length - 1]?.m;
      if (!m) { d.target = [...d.p]; return; }
      d.job = 'mark';
      const mx = anchor[0] - m.p[0], mz = anchor[2] - m.p[2];
      const ml = Math.hypot(mx, mz) || 1;
      const step = Math.min(2.2, ml * 0.3);                     // a step goal-side of your man…
      let tx = m.p[0] + (mx / ml) * step, tz = m.p[2] + (mz / ml) * step;      // …not a walk to the ball
      // …et jamais un POSTE dans la zone du presseur : quand le porteur conduit VERS l'homme
      // marqué, le pas côté ballon plaçait le marqueur sous 2,5 m — la deuxième silhouette de
      // l'essaim mesuré. Le poste du marqueur garde un rayon de courtoisie autour du ballon.
      {
        const rx = tx - anchor[0], rz = tz - anchor[2];
        const rl = Math.hypot(rx, rz);
        if (rl > 1e-6 && rl < 2.8) { tx = anchor[0] + (rx / rl) * 2.8; tz = anchor[2] + (rz / rl) * 2.8; }
      }
      d.target = [tx, 0, tz];
    });
  }
  return st;
}

/** Move every player toward their target with real acceleration limits. */
function movePlayers(st, dt, cfg) {
  for (const p of st.players) {
    // a player on the ground after a slide does not run
    if (p.down > 0) { p.down -= dt; p.v[0] = 0; p.v[1] = 0; p.speed = 0; continue; }
    // UNE AUTORITÉ PAR CORPS. Pendant l'ARMÉ, c'est l'horloge de geste qui possède la POSITION
    // (le glissement sur l'ancre, stepGestures) ; `p.v` n'est alors qu'un RAPPORT du mouvement réel
    // (pour l'animation et l'inertie), pas un état à intégrer. L'intégrer quand même, c'est DEUX
    // écrivains sur le même corps : position posée + vitesse ré-intégrée = double pas, et l'erreur
    // se referme en oscillateur (v[n+1] = Δg/dt − v[n]) qui s'amplifie contre les bornes du carré —
    // mesuré à 15,7 m/s sur un glissement de 28 cm, contre le mur, l'ancre 27 cm dehors. Le
    // follow-through (après contact), lui, reste au modèle de course : l'élan se dissipe, il ne
    // se fige pas. (Le lacet a la même loi depuis toujours : « A SWING OWNS THE BODY ».)
    // …et un geste technique possède le corps AU-DELÀ du contact : le râteau tourne le lacet
    // pendant l'accompagnement, la semelle tient le corps immobile sur son ballon — stepGestures
    // écrit, movePlayers se tait (ownsBody : même loi, fenêtre élargie).
    if (winding(p) || p.act?.payload?.ownsBody) { p.speed = Math.hypot(p.v[0], p.v[1]); continue; }
    let top = (cfg.speeds[p.job === 'press' || p.job === 'intercept' || p.job === 'receive' ? 'chase'
      : p.job === 'carry' ? 'carry' : p.job === 'cover' ? 'press' : 'support'] ?? cfg.speeds.support)
      * (p.persona?.paceBias ?? 1);
    // LE MORDU D'UNE FEINTE S'ASSOIT SUR SA LIGNE MORTE : il a lancé son appui vers la fausse
    // passe — accélération ET pointe au ralenti le temps de la morsure (skill.biteSlow). C'est le
    // POURQUOI de la feinte : sans coût pour le défenseur, elle ne serait qu'une pantomime.
    const bitten = (p._bite ?? -1) > st.t;
    if (bitten) top *= cfg.skill?.biteSlow ?? 0.35;
    // LES RUPTURES DE RYTHME. Le calme de la refonte tempo a tué la panique — et avec elle le
    // CONTRASTE : un rondo réel vit en marche… coupée d'APPELS (un soutien qui claque 3 m pour
    // ouvrir une ligne) et de CHASSES (le presseur qui jaillit sur la touche de passe). Cadence
    // tirée du rnd SEEDÉ, fréquence par persona.burstiness — chaque rupture est un ÉVÉNEMENT
    // nommé, donc mesurable (clauses de bandes d'allure dans verify-rondo).
    if (!p._pace) p._pace = { until: -1, next: 2 + (st.rnd ? st.rnd() : 0.5) * 5 };
    const settled = st.phase === 'carry' && st.hold > 0.6;
    if (st.t >= p._pace.next && p._pace.until < st.t) {
      const bz = p.persona?.burstiness ?? 1;
      if (p.job === 'support' && settled) {
        p._pace.until = st.t + 0.7 + (st.rnd ? st.rnd() : 0.5) * 0.4;
        p._pace.kind = 'appel';
        st.events.push({ type: 'burst', kind: 'appel', by: p.id, t: +st.t.toFixed(2) });
      }
      p._pace.next = st.t + (6 + (st.rnd ? st.rnd() : 0.5) * 6) / Math.max(0.4, bz);
    }
    // …la chasse est l'affaire du PLUS PROCHE : première version, chaque presseur ET chaque
    // intercepteur jaillissait sur chaque passe — 155 chasses en 120 s, 94 ruptures/min, la frénésie
    // que la refonte tempo venait d'éteindre. Un seul défenseur claque sur la touche de passe.
    if ((p.job === 'press' || p.job === 'intercept') && st.pass && st.t - st.pass.t < 0.5
      && p._pace.until < st.t && !st.pass._chased) {
      const dMe = Math.hypot(p.p[0] - st.ball.p[0], p.p[2] - st.ball.p[2]);
      const nearest = st.players.every((q) => q === p || q.team === p.team || q.down > 0
        || (q.job !== 'press' && q.job !== 'intercept')
        || Math.hypot(q.p[0] - st.ball.p[0], q.p[2] - st.ball.p[2]) >= dMe - 1e-9);
      if (nearest) {
        st.pass._chased = true;
        p._pace.until = st.t + 0.9;
        p._pace.kind = 'chasse';
        st.events.push({ type: 'burst', kind: 'chasse', by: p.id, t: +st.t.toFixed(2) });
      }
    }
    const bursting = p._pace.until > st.t;
    if (bursting) top = Math.min(top * 1.28, cfg.sprintMax ?? 8.0);
    // …et entre les ruptures, un soutien posé MARCHE — le contraste EST le rythme
    else if (p.job === 'support' && settled) top = Math.min(top, cfg.settledWalkCap ?? 1.35);
    // UN SOUTIEN PRÈS DE SA STATION AJUSTE PAR PETITS PAS. Mesuré (sonde tempo-espaces) : les
    // non-porteurs vivaient à p50 3,0-3,5 m/s, sprint > 4,5 m/s un quart du temps, dans un carré de
    // 16 × 14 m — la panique, pas du soutien. À moins de 3 m de sa station, la vitesse d'un soutien
    // est celle d'un ajustement (supportNearCap), pas d'une course.
    if (p.job === 'support' && p.target) {
      const dS = Math.hypot(p.target[0] - p.p[0], p.target[2] - p.p[2]);
      if (dS < 3) top = Math.min(top, cfg.supportNearCap);
    }
    let wx = 0, wz = 0;
    if (p.target) {
      const dx = p.target[0] - p.p[0], dz = p.target[2] - p.p[2];
      const d = Math.hypot(dx, dz);
      if (d > 0.18) { const s = Math.min(top, d * 2.6); wx = (dx / d) * s; wz = (dz / d) * s; }
    }
    // LA DEMANDE DES RÔLES CALMES EST LISSÉE (τ = wantTau). La cible de marche des soutiens sautait
    // de plusieurs mètres en une image (churn mesuré 18-19 m/s) et la locomotion vivait en
    // bang-bang : 59 % des images joueur pile à la saturation du cap (sonde allures-inclinaison).
    // Les rôles de course (press/intercept/receive/carry) gardent la demande vive — la course
    // d'interception est le miroir exact du modèle que flightRace fait courir. (Résultat négatif
    // consigné : exempter AUSSI le marqueur pour vider la zone du ballon n'a presque rien rendu sur
    // l'essaim — both<2,5 m 58 → 49-61 % — et a durci la défense au point de faire tomber la
    // balance : record moyen 8,4 → 6,8, frappes 43,9 → 40,3. Le marqueur reste lissé.)
    if ((p.job === 'support' || p.job === 'mark') && !bursting) {
      const aW = 1 - Math.exp(-dt / Math.max(1e-3, cfg.wantTau ?? 0.12));
      p._wx = (p._wx ?? wx) + (wx - (p._wx ?? wx)) * aW;
      p._wz = (p._wz ?? wz) + (wz - (p._wz ?? wz)) * aW;
      wx = p._wx; wz = p._wz;
    } else { p._wx = wx; p._wz = wz; }
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
    // le mordu paie AUSSI en actionneurs : son appui est parti du mauvais côté — freiner comme
    // tourner lui coûtent le facteur de morsure, en plus de la pointe (le modèle d'inertie fait le
    // reste : c'est lui que la feinte bat, exactement comme le commentaire ci-dessus l'annonçait)
    const kBite = bitten ? (cfg.skill?.biteSlow ?? 0.35) : 1;
    if (sp0 > 0.4) {
      const ux = p.v[0] / sp0, uz = p.v[1] / sp0;
      const along = clamp(dvx * ux + dvz * uz, -cfg.accel * kBite * dt, cfg.accel * kBite * dt);
      let latx = dvx - (dvx * ux + dvz * uz) * ux, latz = dvz - (dvx * ux + dvz * uz) * uz;
      const lat = Math.hypot(latx, latz), cap = cfg.turnAccel * kBite * dt;
      if (lat > cap) { latx *= cap / lat; latz *= cap / lat; }
      p.v[0] += along * ux + latx; p.v[1] += along * uz + latz;
    } else {                                     // at a standstill there is no momentum to fight
      p.v[0] += clamp(dvx, -cfg.accel * kBite * dt, cfg.accel * kBite * dt);
      p.v[1] += clamp(dvz, -cfg.accel * kBite * dt, cfg.accel * kBite * dt);
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
}

// SEPARATION — une CONTRAINTE DU MONDE, pas un détail de la locomotion. Deux joueurs n'avaient
// rien qui les empêche d'occuper le même point : 28 % des images avec une paire sous 45 cm. Une
// passe de relaxation, chacun poussé de la moitié du chevauchement. ELLE SE PROJETTE EN DERNIER :
// tant qu'elle vivait DANS movePlayers, le glissement d'armé (stepGestures, autorité de position
// pendant le geste) réécrivait la position APRÈS elle et la défaisait — mesuré, le budget
// players-not-overlapping crevait (2,6 % > 2). L'ordre est une loi de charte : les autorités
// écrivent, puis le monde projette ses contraintes, une fois, à la fin.
function separatePlayers(st, cfg) {
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
  const w = st.players[carrier];
  const sp0 = Math.hypot(st.ball.v[0], st.ball.v[2]);
  const dW = w ? d2(w.p, st.ball.p) : 99;
  // l'événement porte SA géométrie (loi 8) : distance gagnant→ballon au flip, vitesse avant/après —
  // c'est ce que les clauses « vol sans geste » et « télékinésie » de checkRondo lisent.
  const ev = { t: +st.t.toFixed(2), type: 'turnover', why, to: st.players[carrier].team, by: carrier, after: st.passes, d: +dW.toFixed(2), v0: +sp0.toFixed(2), v1: +sp0.toFixed(2) };
  st.events.push(ev);
  st.passes = 0;
  st.possession = { team: st.players[carrier].team, carrier };
  st.phase = 'carry'; st.pass = null; st.hold = 0; st.pressure = 0; st.lastPasser = -1;
  // LE BALLON N'EST PAS « REMIS À ZÉRO » — NI GELÉ À DISTANCE. Deux accidents fondateurs ici :
  // (1) cette ligne appelait rest(), qui plaquait au sol un ballon encore en l'air — refusé par
  // l'invariant de ball-body dès le premier essai (interception à 0,80 m de haut) ; (2) elle
  // appliquait ensuite impulse(−v) : 100 % de la vitesse horizontale tuée en une image, mesuré
  // 130-172 fois par 6 min, p50 = 4,19 m/s → 0,00 exactement, y compris quand le « gagnant » était
  // à 2,33 m du ballon (sonde duels-tacles / ballon-vol : 39 arrêts télékinésiques). La règle est
  // celle de BallBody étendue à la VITESSE : une impulsion d'arrêt n'est légale que si son auteur
  // est À PORTÉE DE JEU du ballon — sa première touche l'amortit (résiduel ~20 %, comme les
  // contrôles attaquants qui gardent 5-18 %) et se NOMME au registre (événement 'control').
  // Hors portée : le ballon VIT, il continue sa course et le gagnant va le chercher.
  if (w && w.down <= 0 && dW <= RONDO.receiveRadius) {
    st.ball.impulse([-st.ball.v[0] * 0.8, -st.ball.v[1] * 0.6, -st.ball.v[2] * 0.8], [-st.ball.w[0] * 0.8, -st.ball.w[1], -st.ball.w[2] * 0.8]);
    st.ball.possess(carrier);
    if (sp0 > 0.5) {
      st._settling = { ev: st.events.length, id: carrier, at: st.t + 0.3 };
      st.events.push({ t: +st.t.toFixed(2), type: 'control', by: carrier, speed: +sp0.toFixed(1), settle: null });
    }
  }
  ev.v1 = +Math.hypot(st.ball.v[0], st.ball.v[2]).toFixed(2);
}

export { predictPath };
export const rondoInternals = { supportSpot, movePlayers, separatePlayers, turnover };
