// technique — THE VOCABULARY OF FOOTBALL GESTURES, AS DATA.
//
// A football action is not "kick the ball". It is a specific SURFACE of a specific foot meeting the
// ball in a specific place relative to the body, and every one of those choices is forced by the
// situation rather than free. A ball arriving on the left is controlled with the left foot, or with
// the OUTSIDE of the right — never with the inside of the right, because that means crossing your
// legs, and it is one of the most visible tells that nobody modelled the gesture.
//
// So the gesture is data: preconditions (which side, how far, how high, how fast the ball is coming),
// which foot, which surface, what it does to the ball, which clip plays and on which frame the boot
// meets it. Three things fall out of that which cannot fall out of a switch statement:
//
//   1. THE FOOT AND THE SURFACE ARE DERIVED, not chosen. Given where the ball is and where it must
//      go, only a few techniques are geometrically available, and the selector picks among those.
//   2. IT IS CHECKABLE. Every executed action can be re-tested against its own preconditions, so
//      "he controlled that with the wrong foot" becomes a contract violation rather than an opinion.
//   3. IT IS EXTENSIBLE without touching the brain: add a row, and the selector can use it.
//
// GEOMETRY CONVENTIONS (this module's, matching rondo.js): the player's facing is [cos yaw, sin yaw]
// in the (x, z) plane. `side` is the signed cross product of facing and the direction to the ball:
// positive = the ball is on the player's LEFT. `bearing` is the unsigned angle between facing and the
// ball, 0° dead ahead, 180° behind.

export const SURFACES = ['inside', 'outside', 'laces', 'sole', 'heel', 'thigh', 'chest', 'head'];

/** Height windows per surface, in metres off the grass. A ball at chest height is not a foot pass. */
export const SURFACE_HEIGHT = {
  sole: [0, 0.16], inside: [0, 0.45], outside: [0, 0.45], laces: [0, 0.55], heel: [0, 0.35],
  thigh: [0.40, 0.95], chest: [0.85, 1.45], head: [1.40, 2.30],
};

/**
 * THE TABLE. Each row is a technique that a player can actually perform.
 *
 *  intent    what it is for: 'pass' | 'control' | 'carry' | 'clear' | 'win'
 *  foot      'near' = the foot on the ball's side, 'far' = the other one, 'either', 'none' (body)
 *  surface   which part meets the ball
 *  side      [min, max] absolute bearing (°) the ball may sit at — the geometric window
 *  dist      [min, max] metres from body centre to ball
 *  turn      how much body rotation (°) the technique tolerates before it stops being this technique
 *  power     multiplier on the strike speed the solver asks for (a backheel cannot be hit hard)
 *  accuracy  0..1, used by the brain to prefer the clean option when several are available
 *  clip      the animkit move that draws it, and `contact` the frame the boot meets the ball
 */
export const TECHNIQUES = [
  // ---- PASSING
  {
    id: 'passe-interieur', intent: 'pass', foot: 'near', surface: 'inside',
    side: [0, 75], dist: [0.15, 1.1], turn: 40, power: 0.85, accuracy: 1.0,
    clip: 'passe', why: 'La passe de base : le pied le plus proche du ballon, surface intérieure — la plus large et la plus précise.',
  },
  {
    id: 'passe-rapide', intent: 'pass', foot: 'near', surface: 'inside',
    side: [0, 75], dist: [0.15, 1.1], turn: 35, power: 0.75, accuracy: 0.9,
    clip: 'passeRapide', why: 'La passe intérieure PRESSÉE : même surface que la passe de base, armé de poussée '
      + 'court (0,22 s). C\'est le geste du rondo sous pression — un pro ne bascule pas sur l\'extérieur '
      + 'parce qu\'on le presse, il raccourcit son armé. Sans elle, le départage de vitesse n\'avait que '
      + 'le flick extérieur à offrir (mesuré : 79,5 % des passes).',
  },
  {
    id: 'passe-exterieur', intent: 'pass', foot: 'far', surface: 'outside',
    side: [0, 60], dist: [0.15, 0.95], turn: 25, power: 0.7, accuracy: 0.75,
    clip: 'passeExterieur', why: 'L\'extérieur du pied opposé : la réponse quand le ballon est du mauvais côté et qu\'on ne veut pas croiser les jambes ni se réorienter.',
  },
  {
    id: 'passe-laces', intent: 'pass', foot: 'near', surface: 'laces',
    side: [0, 45], dist: [0.25, 1.2], turn: 30, power: 1.15, accuracy: 0.8,
    clip: 'frappe', why: 'Le coup de patte : plus de puissance, moins de précision. Pour la passe longue ou tendue.',
  },
  {
    id: 'talonnade', intent: 'pass', foot: 'near', surface: 'heel',
    side: [120, 180], dist: [0.15, 0.7], turn: 15, power: 0.45, accuracy: 0.55,
    clip: 'talonnade', why: 'LA seule façon légale de jouer un ballon qui est derrière soi — et c\'est pour ça qu\'elle porte un nom.',
  },
  {
    id: 'passe-pivot', intent: 'pass', foot: 'near', surface: 'inside',
    side: [0, 70], dist: [0.15, 1.0], turn: 150, power: 0.7, accuracy: 0.6,
    clip: 'passePivot', why: 'Se retourner avec le ballon pour le rendre d\'où il vient : lent, contestable, mais c\'est la '
      + 'seule façon de jouer vers l\'arrière sans talonnade — et sans elle un joueur ne rend jamais un ballon.',
  },
  {
    id: 'deviation', intent: 'pass', foot: 'near', surface: 'inside',
    side: [0, 90], dist: [0.15, 1.1], turn: 55, power: 0.9, accuracy: 0.7,
    firstTime: true, clip: 'deviation',
    why: 'La remise de première : on ne contrôle pas, on redirige. Seule technique qui accepte un ballon rapide sans amorti.',
  },

  // ---- CONTROL
  {
    id: 'controle-interieur', intent: 'control', foot: 'near', surface: 'inside',
    side: [0, 80], dist: [0.15, 1.0], turn: 45, power: 0.12, accuracy: 1.0,
    clip: 'controleInterieur', why: 'Amorti de l\'intérieur : la surface la plus sûre, le ballon retombe devant le pied.',
  },
  {
    id: 'controle-exterieur', intent: 'control', foot: 'far', surface: 'outside',
    side: [0, 65], dist: [0.15, 0.9], turn: 25, power: 0.18, accuracy: 0.75,
    clip: 'controleExterieur', why: 'Contrôle extérieur du pied opposé : garde le corps ouvert et emmène le ballon dans le mouvement.',
  },
  {
    id: 'controle-semelle', intent: 'control', foot: 'near', surface: 'sole',
    side: [0, 50], dist: [0.15, 0.7], turn: 20, power: 0.05, accuracy: 0.9,
    clip: 'controleSemelle', why: 'Semelle : le ballon s\'arrête net sous le pied. Le contrôle qui ne laisse rien courir.',
  },
  {
    id: 'amorti-poitrine', intent: 'control', foot: 'none', surface: 'chest',
    side: [0, 55], dist: [0.15, 0.8], turn: 30, power: 0.10, accuracy: 0.8,
    clip: 'amorti', why: 'Un ballon à hauteur de torse ne se prend pas du pied : la poitrine l\'assied.',
  },
  {
    id: 'amorti-cuisse', intent: 'control', foot: 'near', surface: 'thigh',
    side: [0, 55], dist: [0.15, 0.8], turn: 30, power: 0.12, accuracy: 0.8,
    clip: 'amortiCuisse', why: 'Entre le pied et la poitrine il y a la cuisse — sans elle, une hauteur entière du jeu manque.',
  },

  // ---- CARRYING THE BALL (les gestes techniques — ce qui fait le foot au pied)
  // Un geste 'carry' ne LIBÈRE pas le ballon : il le manipule. Son « contact » de geste est
  // l'instant où la manœuvre s'exécute (la semelle agrippe, la feinte se vend, le pied se pose) —
  // le ballon reste au porteur du début à la fin. Ces lignes existent pour que le vocabulaire
  // vive DANS LA TABLE (préconditions géométriques, pied, surface, clip) : checkAction peut
  // rejuger chaque râteau exécuté, comme chaque passe.
  {
    id: 'rateau', intent: 'carry', foot: 'near', surface: 'sole',
    side: [0, 70], dist: [0.15, 0.8], turn: 180, power: 0.3, accuracy: 0.85,
    clip: 'rateau', why: 'Le râteau : la semelle tire le ballon en ARRIÈRE et le corps se retourne par-dessus — '
      + 'LA sortie quand un presseur ferme la face avant. Le seul geste dont le tour complet est le but (turn 180).',
  },
  {
    id: 'feinte-passe', intent: 'carry', foot: 'near', surface: 'inside',
    side: [0, 75], dist: [0.15, 1.1], turn: 40, power: 0, accuracy: 0.9,
    clip: 'feintePasse', why: 'La feinte de passe : TOUT l\'armé d\'une passe, zéro ballon parti. Elle ne joue pas '
      + 'le ballon, elle joue le DÉFENSEUR — celui qui mord s\'assoit sur la ligne morte pendant que la vraie passe part.',
  },
  {
    id: 'arret-semelle', intent: 'carry', foot: 'near', surface: 'sole',
    side: [0, 55], dist: [0.15, 0.7], turn: 20, power: 0, accuracy: 1.0,
    clip: 'arretSemelle', why: 'Le ballon sous la semelle : le porteur au calme POSE le pied dessus et lève la tête. '
      + 'Ce n\'est pas un contrôle (le ballon est déjà à lui) — c\'est la ponctuation du jeu posé, celle qu\'on reconnaît de loin.',
  },
  {
    id: 'passement-jambes', intent: 'carry', foot: 'near', surface: 'laces',
    side: [0, 60], dist: [0.15, 0.7], turn: 50, power: 0, accuracy: 1.0,
    clip: 'passementJambes', why: 'Le passement de jambes : la jambe cercle PAR-DESSUS un ballon qui ne bouge pas — '
      + 'c\'est le buste qui ment, pas le pied. Le jockey en face lance son appui du côté du mensonge, la sortie part de l\'autre.',
  },
  {
    id: 'crochet', intent: 'carry', foot: 'near', surface: 'inside',
    side: [0, 70], dist: [0.15, 0.8], turn: 110, power: 0.25, accuracy: 0.9,
    clip: 'crochet', why: 'Le crochet : l\'intérieur du pied va chercher le ballon de l\'autre côté du corps et le COUPE '
      + 'à travers la course — le changement de direction qui laisse un défenseur lancé continuer tout droit.',
  },
  {
    id: 'feinte-frappe', intent: 'carry', foot: 'near', surface: 'laces',
    side: [0, 60], dist: [0.15, 1.0], turn: 30, power: 0, accuracy: 0.9,
    clip: 'feinteFrappe', why: 'La feinte de frappe : TOUT l\'armé d\'une frappe, zéro ballon parti. Le contreur se jette '
      + 'ou s\'assoit — et la demi-seconde qu\'il paie est exactement l\'angle qui manquait au tir.',
  },

  // ---- WINNING THE BALL BACK
  {
    id: 'tacle-debout', intent: 'win', foot: 'near', surface: 'inside',
    side: [0, 90], dist: [0.2, 1.3], turn: 45, power: 0.6, accuracy: 0.8,
    clip: 'tacleDebout', why: 'Le tacle debout : on reste sur ses appuis, on prend le ballon du pied le plus proche.',
  },
  {
    id: 'tacle-glisse', intent: 'win', foot: 'near', surface: 'sole',
    side: [0, 70], dist: [1.0, 3.2], turn: 25, power: 0.9, accuracy: 0.6, commits: true,
    clip: 'tacle', why: 'Le tacle glissé : la seule façon d\'atteindre un ballon qui traîne hors de portée — au prix de '
      + 'se coucher, donc de sortir du jeu si on le rate. C\'est ce qui manquait pour aller chercher un ballon qui traîne.',
  },
  {
    id: 'degagement', intent: 'clear', foot: 'near', surface: 'laces',
    side: [0, 60], dist: [0.2, 1.2], turn: 60, power: 1.3, accuracy: 0.3,
    clip: 'frappe', why: 'Le dégagement : quand il n\'y a pas de solution, on met le ballon loin. Puissance maximale, précision nulle.',
  },
  // ---- SHOOTING (lot 93) — l'espèce du tir (shooting.js, choice.shotKind) s'habille de SON geste :
  // intent 'shot' pour que le filtre des passes ne les voie jamais (le flux d'hier au bit près).
  {
    id: 'frappe-puissante', intent: 'shot', foot: 'near', surface: 'laces',
    side: [0, 60], dist: [0.15, 1.1], turn: 40, power: 1.15, accuracy: 0.75,
    clip: 'frappePuissante', why: 'La frappe de puissance : l\'élan ample du cou-de-pied — tout le corps arme, la précision paie l\'amplitude.',
  },
  {
    id: 'frappe-enroulee', intent: 'shot', foot: 'near', surface: 'inside',
    side: [0, 70], dist: [0.15, 1.1], turn: 45, power: 0.95, accuracy: 0.9,
    clip: 'frappeEnroulee', why: 'L\'enroulée / le placé : l\'intérieur du pied enveloppe le ballon, le corps s\'ouvre — le geste du curler et du plat du pied croisé.',
  },
  {
    id: 'frappe-pointu', intent: 'shot', foot: 'near', surface: 'laces',
    side: [0, 50], dist: [0.15, 1.2], turn: 25, power: 0.9, accuracy: 0.6,
    clip: 'frappePointu', why: 'Le pointu : le bout du pied sans élan lisible — l\'arme des petits espaces et du piqué, rien à lire pour personne.',
  },
];

/**
 * WHICH WAY A SURFACE CAN SEND THE BALL. This is the half that makes the user's sentence fall out of
 * geometry instead of being a special case: the inside of the LEFT foot faces the player's RIGHT, so
 * it plays ACROSS the body; the outside of the left foot faces left, so it plays AWAY. A ball on the
 * left that must go left therefore cannot be played with the inside of the left foot — you use the
 * outside of the left, or the outside of the right around the body. Nothing here is a rule about
 * football; it is a rule about which way a foot points.
 *
 * Angles are SIGNED, relative to the player's facing, positive to his LEFT.
 */
export function outWindow(surface, foot) {
  if (surface === 'laces') return [-40, 40];
  if (surface === 'sole') return [-70, 70];
  if (surface === 'heel') return [130, 230];              // behind: handled modulo below
  const left = foot === 'left';
  if (surface === 'inside') return left ? [-125, 25] : [-25, 125];   // across the body
  if (surface === 'outside') return left ? [-20, 125] : [-125, 20];  // away from the body
  return [-90, 90];                                       // thigh / chest / head: whatever the torso faces
}

const wrap = (a) => { let x = a; while (x > 180) x -= 360; while (x < -180) x += 360; return x; };

export const byId = Object.fromEntries(TECHNIQUES.map((t) => [t.id, t]));

/**
 * Describe the situation a technique has to fit. All angles in degrees, distances in metres.
 * `facing` is a yaw in this module's convention; `ballV` is the ball's velocity in (x, z).
 */
export function situation(playerP, yaw, ballP, ballV = [0, 0], ballY = 0.11) {
  const fx = Math.cos(yaw), fz = Math.sin(yaw);
  const dx = ballP[0] - playerP[0], dz = ballP[2] - playerP[2];
  const d = hyp(dx, dz) || 1e-6;
  const ux = dx / d, uz = dz / d;
  const dot = Math.max(-1, Math.min(1, fx * ux + fz * uz));
  const bearing = (Math.acos(dot) * 180) / Math.PI;
  // cross product of facing × direction-to-ball, in a Y-up frame: positive means the ball is LEFT
  const side = fx * uz - fz * ux;
  const speed = hyp(ballV[0], ballV[2] ?? ballV[1] ?? 0);
  return { bearing, side: side > 0 ? 'left' : 'right', sideMag: Math.abs(side), dist: d, height: ballY, speed };
}

/** Which foot a technique wants, resolved against which side the ball is on. */
export function footFor(tech, sit) {
  if (tech.foot === 'none') return 'none';
  if (tech.foot === 'either') return sit.side;
  const near = sit.side;                                  // the foot on the ball's side
  const far = near === 'left' ? 'right' : 'left';
  return tech.foot === 'near' ? near : far;
}

/**
 * Can this technique be performed in this situation? Returns null when it can, a REASON when it
 * cannot. The reason strings are the diagnostic — "impossible" without a reason is useless to whoever
 * has to fix it.
 */
export function techniqueFails(tech, sit, { firstTouch = false, controlMax = 8, outBearing = null, foot = null } = {}) {
  // where the ball must go, against where this surface can send it
  if (outBearing != null && tech.intent === 'pass') {
    const f = foot || footFor(tech, sit);
    // …widened by how much the technique lets him OPEN HIS BODY. You do not have to be facing the
    // receiver to pass to him: you open your hips, and `turn` is how far each technique allows that
    // before it stops being that technique. Without this term almost every pass in a rondo — where
    // the ball goes backwards and sideways constantly — has no legal surface at all.
    const [lo0, hi0] = outWindow(tech.surface, f);
    const lo = lo0 - tech.turn, hi = hi0 + tech.turn;
    const o = tech.surface === 'heel' ? (wrap(outBearing) + 360) % 360 : wrap(outBearing);
    if (o < lo || o > hi) {
      return `sortie à ${wrap(outBearing).toFixed(0)}° : « ${tech.surface} » du pied ${f} ne peut pas envoyer là, même corps ouvert (fenêtre [${lo.toFixed(0)}, ${hi.toFixed(0)}])`;
    }
  }
  if (sit.bearing < tech.side[0] || sit.bearing > tech.side[1]) {
    return `relèvement ${sit.bearing.toFixed(0)}° hors de la fenêtre [${tech.side[0]}, ${tech.side[1]}]`;
  }
  if (sit.dist < tech.dist[0] || sit.dist > tech.dist[1]) {
    return `ballon à ${sit.dist.toFixed(2)} m hors de la fenêtre [${tech.dist[0]}, ${tech.dist[1]}]`;
  }
  const [hLo, hHi] = SURFACE_HEIGHT[tech.surface];
  if (sit.height < hLo || sit.height > hHi) {
    return `ballon à ${sit.height.toFixed(2)} m : hors de portée de « ${tech.surface} » [${hLo}, ${hHi}]`;
  }
  // A ball arriving fast cannot simply be passed on: either you take a touch, or you play it FIRST
  // TIME. That is the whole difference between a control and a deviation, and it is a precondition,
  // not a stylistic preference.
  if (tech.intent === 'pass' && !tech.firstTime && sit.speed > controlMax && firstTouch) {
    return `ballon à ${sit.speed.toFixed(1)} m/s joué sans contrôle et sans être une remise de première`;
  }
  return null;
}

/**
 * THE ON-BALL BRAIN, geometric half: given the situation and what the player wants to do, which
 * techniques are available, best first. `prefer` lets the caller bias (a defender under no pressure
 * prefers the standing tackle; one who is beaten has only the slide).
 */
export function chooseTechnique(sit, intent, opts = {}) {
  const out = [];
  for (const t of TECHNIQUES) {
    if (t.intent !== intent) continue;
    if (opts.exclude && opts.exclude.includes(t.id)) continue;
    const foot = footFor(t, sit);
    const why = techniqueFails(t, sit, { ...opts, foot });
    if (why) continue;
    // score: accuracy first, then how centred the ball is in the technique's window (a technique used
    // at the very edge of its geometry is the one that looks wrong on screen even when it is legal)
    const mid = (t.side[0] + t.side[1]) / 2, half = Math.max(1, (t.side[1] - t.side[0]) / 2);
    const centred = 1 - Math.min(1, Math.abs(sit.bearing - mid) / half);
    out.push({ tech: t, foot, surface: t.surface, score: t.accuracy * 2 + centred + (opts.bias?.[t.id] ?? 0) });
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}

/**
 * Contract: an executed action was legal. This is what turns "he controlled that with the wrong foot"
 * from an opinion into a failure. `act` is what the game recorded; the situation is recomputed from
 * the geometry the action itself carried, never from a trace sampled later.
 */
export function checkAction(act) {
  const t = byId[act.tech];
  if (!t) return `technique inconnue « ${act.tech} »`;
  const sit = { bearing: act.bearing, side: act.side, dist: act.dist, height: act.height, speed: act.speed ?? 0 };
  const why = techniqueFails(t, sit, { firstTouch: !!act.firstTouch, outBearing: act.out ?? null, foot: act.foot });
  if (why) return `${act.tech} : ${why}`;
  const want = footFor(t, sit);
  if (want !== act.foot) return `${act.tech} : joué du pied ${act.foot} alors que la technique impose ${want} (ballon à ${act.side})`;
  if (act.surface !== t.surface) return `${act.tech} : surface ${act.surface} au lieu de ${t.surface}`;
  // THE CROSSED LEGS. The inside of the FAR foot means reaching across your own standing leg. It is
  // the single most visible "nobody modelled this" tell, and no row in the table permits it — so it is
  // asserted here as well, because a future row could add it by accident.
  const far = act.side === 'left' ? 'right' : 'left';
  if (act.surface === 'inside' && act.foot === far && act.bearing > 25) {
    return `${act.tech} : intérieur du pied ${act.foot} sur un ballon à ${act.side} — jambes croisées`;
  }
  return null;
}
import { hyp } from './hyp.js';
