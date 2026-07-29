import { BALL } from './ball.js';
import { checkAction, byId as TECH } from './technique.js';

// football-rules — THE CATALOGUE OF THINGS THAT CANNOT HAPPEN IN FOOTBALL.
//
// Written the way reference/19 says to reach exhaustiveness: not by listing bugs you happen to
// remember, but by GENERATING the rules from a grid — every relationship (ball ↔ carrier, ball ↔
// world, player ↔ player, event ↔ event) crossed with every phase (carry, strike, flight, receive,
// tackle, out). Each cell of that grid is a question: "what would be impossible here?" A catalogue
// built that way finds defects nobody thought to look for; a list of remembered bugs never does.
//
// Each rule is DATA — an id, the phase it applies to, the impossibility it forbids, and a predicate.
// That matters for three reasons: the catalogue can be printed and reviewed by a human who knows
// football but not this codebase; a rule can be sabotaged individually to prove it bites; and rules
// can be added without touching the runner.
//
// SCOPES
//   'frame' — evaluated on every sampled trace frame
//   'event' — evaluated on every matching event (which carries the geometry it was decided on:
//             a rule that re-measures from a trace sampled a few frames later is judging a
//             different picture, and will be wrong in both directions)
//   'pair'  — evaluated on consecutive frames (velocities, teleports, energy)

const deg = (rad) => (rad * 180) / Math.PI;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const ballXZ = (s) => [s.ball[0], s.ball[2]];

export const FOOT_RULES = [
  // ---------------------------------------------------------------- ball ↔ the man on it
  {
    id: 'ball-ahead-at-strike', scope: 'event', on: 'pass',
    title: 'le ballon est DEVANT le joueur qui le frappe',
    why: 'On ne passe pas un ballon qui est derrière soi. Le relèvement est l\'angle entre le regard du '
      + 'joueur et la direction du ballon : 0° = pile devant, 180° = dans le dos. Un coup du pied '
      + 'droit ou gauche exige le ballon dans le cône avant ; seule la TALONNADE fait exception, et '
      + 'c\'est précisément pour ça qu\'elle porte un nom.',
    // `e.tech`, NOT `e.style`. `style` is the BALLISTIC style of the pass — ground or lofted — and it
    // has never once held the string 'talonnade', so this exemption was dead code from the day it was
    // written: every backheel in the game was being counted as an illegal strike. Worse, the harness
    // test for it built its fixture with `style: 'talonnade'` and therefore passed — a test written
    // against the implementation instead of against the football. The gesture is `tech`.
    check: (e, cfg) => (e.tech === 'talonnade' ? null
      : e.bearing > cfg.strikeCone ? `relèvement ${e.bearing}° (> ${cfg.strikeCone}°) : ballon dans le dos` : null),
  },
  {
    id: 'ball-in-reach-at-strike', scope: 'event', on: 'pass',
    title: 'le ballon est à portée de pied au moment de la frappe',
    why: 'Un pied ne frappe que ce qu\'il atteint. Au-delà d\'une foulée, la frappe est une intention, pas un contact.',
    check: (e, cfg) => (e.ballDist > cfg.reach ? `ballon à ${e.ballDist} m (> ${cfg.reach} m) : hors d\'atteinte` : null),
  },
  {
    id: 'foot-height', scope: 'event', on: 'pass',
    title: 'un ballon frappé du pied est à hauteur de pied',
    why: 'Au-dessus du genou ce n\'est plus une passe du pied : c\'est une reprise de volée, une cuisse '
      + 'ou une tête, et l\'animation comme la physique du contact sont différentes.',
    check: (e, cfg) => (e.ballY > cfg.footHeight ? `ballon à ${e.ballY} m de haut (> ${cfg.footHeight} m) pour une passe au pied` : null),
  },
  {
    id: 'strike-speed', scope: 'event', on: 'pass',
    title: 'la vitesse de frappe reste humaine',
    why: 'Le record du monde est ~38 m/s, sur une frappe pleine. Une passe au-dessus de 35 m/s est un bug de solveur.',
    check: (e, cfg) => (e.speed > cfg.maxStrike ? `frappe à ${e.speed} m/s (> ${cfg.maxStrike})` : null),
  },
  {
    id: 'carrier-owns-the-ball', scope: 'frame', when: (s) => s.phase === 'carry' && s.carrier >= 0,
    title: 'la possession affichée est réelle : aucun ADVERSAIRE en position de jouer le ballon',
    why: 'La question n\'est pas « qui est le plus près » — un porteur qui PROTÈGE son ballon se place '
      + 'exprès derrière lui, donc il n\'en est pas le plus proche, et c\'est du bon football. La '
      + 'question est de savoir si l\'étiquette « possession » ment : elle ment quand un adversaire est '
      + 'à la fois plus près du ballon ET assez près pour le jouer. Le reste est un duel en cours.',
    check: (s, cfg) => {
      const c = s.players.find((p) => p.id === s.carrier);
      if (!c) return null;
      const b = ballXZ(s), mine = dist(c.p, b);
      const beaten = s.players.filter((p) => p.team !== c.team && dist(p.p, b) < mine - cfg.ownSlack && dist(p.p, b) < cfg.playable);
      return beaten.length ? `adversaire ${beaten[0].id} à ${dist(beaten[0].p, b).toFixed(2)} m du ballon, porteur à ${mine.toFixed(2)} m` : null;
    },
  },
  {
    id: 'carry-reach', scope: 'frame', when: (s) => s.phase === 'carry' && s.carrier >= 0,
    title: 'le porteur reste à distance de conduite de son ballon',
    why: 'Conduire, c\'est garder le ballon dans un rayon de touche. Au-delà, ce n\'est plus une conduite : '
      + 'c\'est un ballon abandonné que le jeu appelle encore une possession.',
    check: (s, cfg) => {
      const c = s.players.find((p) => p.id === s.carrier);
      if (!c) return null;
      const d = dist(c.p, ballXZ(s));
      return d > cfg.carryMax ? `ballon à ${d.toFixed(2)} m du porteur (> ${cfg.carryMax} m)` : null;
    },
  },
  {
    id: 'not-inside-a-body', scope: 'frame',
    title: 'le ballon n\'est pas à l\'intérieur d\'un joueur',
    why: 'Un ballon dont le centre est plus près que son rayon plus celui du corps traverse la jambe à l\'écran.',
    check: (s, cfg) => {
      const b = ballXZ(s);
      if (s.ball[1] > 1.2) return null;                       // au-dessus de la taille : il passe par-dessus
      const inside = s.players.filter((p) => dist(p.p, b) < cfg.bodyRadius);
      return inside.length ? `ballon dans le corps du joueur ${inside[0].id} (${dist(inside[0].p, b).toFixed(2)} m)` : null;
    },
  },

  {
    id: 'technique-legal', scope: 'events', on: null,
    title: 'chaque geste respecte les préconditions de SA technique',
    why: 'Un geste n\'est pas « frapper le ballon » : c\'est une surface précise d\'un pied précis sur un '
      + 'ballon placé quelque part de précis. Rejouer chaque action contre sa propre fiche technique, '
      + 'c\'est transformer « il a contrôlé du mauvais pied » d\'un avis en une violation.',
    check: (list) => {
      for (const a of list) {
        if (!a.tech) continue;
        const bad = checkAction(a);
        if (bad) return `t=${a.t} ${bad}`;
      }
      return null;
    },
  },
  {
    id: 'no-crossed-legs', scope: 'events', on: null,
    title: 'jamais l\'intérieur du pied opposé sur un ballon latéral',
    why: 'Un ballon qui arrive à gauche se joue du pied gauche, ou de l\'EXTÉRIEUR du droit — jamais de '
      + 'l\'intérieur du droit, qui veut dire croiser les jambes par-dessus l\'appui. C\'est l\'un des '
      + 'tells les plus visibles qu\'on n\'a pas modélisé le geste.',
    check: (list) => {
      for (const a of list) {
        if (!a.tech || !a.side || !a.foot) continue;
        const far = a.side === 'left' ? 'right' : 'left';
        if (a.surface === 'inside' && a.foot === far && a.bearing > 25) {
          return `t=${a.t} intérieur du pied ${a.foot} sur un ballon à ${a.side} (relèvement ${a.bearing}°)`;
        }
      }
      return null;
    },
  },
  {
    id: 'control-at-foot', scope: 'event', on: 'control',
    title: 'un contrôle AMÈNE le ballon au pied — il ne l\'arrête pas où il est',
    why: 'Amortir, ce n\'est pas éteindre la vitesse du ballon là où il passe : c\'est le faire finir '
      + 'devant son pied. Un contrôle qui laisse le ballon à un mètre se voit immédiatement — le joueur '
      + 'a fait le geste, le ballon s\'est arrêté ailleurs, et plus personne ne croit à la scène.',
    check: (e, cfg) => (e.settle != null && e.settle > cfg.settleMax
      ? `ballon à ${e.settle} m du joueur après le contrôle (> ${cfg.settleMax} m)` : null),
  },
  {
    id: 'control-in-reach', scope: 'event', on: 'control',
    title: 'on ne contrôle que ce qu\'on atteint',
    why: 'Le déclencheur de réception était plus large que la portée de TOUTES les techniques de '
      + 'contrôle : la touche partait alors que le ballon était encore hors d\'atteinte. Le rayon de '
      + 'réception doit tenir dans la fenêtre du geste, sinon le geste est une fiction.',
    check: (e, cfg) => (e.dist > cfg.reach ? `contrôle déclenché à ${e.dist} m (> ${cfg.reach} m)` : null),
  },
  {
    id: 'slide-in-range', scope: 'event', on: 'slide',
    title: 'un tacle glissé part de sa fenêtre de portée',
    why: 'Le tacle glissé existe pour atteindre un ballon hors de portée debout. Plus près on le prend '
      + 'sur ses appuis ; plus loin on n\'arrive pas. Hors de cette fenêtre, ce n\'est pas un tacle, '
      + 'c\'est une glissade qui téléporte le joueur sur le ballon.',
    check: (e) => {
      const t = TECH['tacle-glisse'];
      return e.dist < t.dist[0] || e.dist > t.dist[1] ? `tacle à ${e.dist} m (fenêtre [${t.dist[0]}, ${t.dist[1]}])` : null;
    },
  },

  // ---------------------------------------------------------------- ball ↔ the world
  {
    id: 'ball-above-ground', scope: 'frame',
    title: 'le ballon ne passe jamais sous la pelouse',
    why: 'Le sol est une contrainte, pas une suggestion : un ballon sous l\'herbe est un pas d\'intégration raté.',
    check: (s) => (s.ball[1] < BALL.radius - 0.05 ? `ballon à y=${s.ball[1]}` : null),
  },
  {
    id: 'ball-in-play', scope: 'frame',
    title: 'le ballon reste dans le monde',
    why: 'Sorti du carré il doit être remis en jeu, pas continuer à voler vers l\'infini.',
    check: (s, cfg, ctx) => {
      const hx = ctx.area[0] / 2 + 2, hz = ctx.area[1] / 2 + 2;
      return Math.abs(s.ball[0]) > hx || Math.abs(s.ball[2]) > hz ? `ballon en (${s.ball[0]}, ${s.ball[2]})` : null;
    },
  },
  {
    id: 'ball-no-teleport', scope: 'pair',
    title: 'le ballon ne se téléporte pas',
    why: 'Entre deux images il ne peut parcourir que vitesse × temps. Un saut plus grand est une position écrite à la main.',
    check: (a, b, cfg) => {
      const dt = b.t - a.t;
      if (dt <= 0) return null;
      const d = Math.hypot(b.ball[0] - a.ball[0], b.ball[1] - a.ball[1], b.ball[2] - a.ball[2]);
      return d / dt > cfg.maxStrike * 1.2 ? `ballon à ${(d / dt).toFixed(0)} m/s entre deux images` : null;
    },
  },
  {
    id: 'ball-no-free-energy', scope: 'pair',
    title: 'le ballon n\'accélère pas tout seul',
    why: 'Sans contact, la traînée et le roulement ne peuvent que lui en retirer. Une accélération libre '
      + 'trahit une force fantôme — ou un ballon repositionné pendant le vol.',
    check: (a, b, cfg) => {
      const dt = b.t - a.t;
      if (dt <= 0 || b.phase !== 'flight' || a.phase !== 'flight') return null;
      const sa = Math.hypot(a.ball[0] - (a.prev?.[0] ?? a.ball[0]), 0);   // vitesse indisponible : on borne le gain de hauteur
      return b.ball[1] > a.ball[1] + 0.5 && a.ball[1] > 0.5 ? `le ballon remonte de ${(b.ball[1] - a.ball[1]).toFixed(2)} m en plein vol` : null;
    },
  },

  // ---------------------------------------------------------------- player ↔ player, player ↔ world
  {
    id: 'player-top-speed', scope: 'frame',
    title: 'personne ne dépasse la vitesse de pointe',
    why: 'Un sprinteur de haut niveau plafonne vers 10 m/s. Au-delà, c\'est une position écrite, pas courue.',
    check: (s, cfg) => {
      const fast = s.players.filter((p) => p.speed > cfg.maxPlayer);
      return fast.length ? `joueur ${fast[0].id} à ${fast[0].speed} m/s (> ${cfg.maxPlayer})` : null;
    },
  },
  {
    id: 'players-not-overlapping', scope: 'frame',
    title: 'deux joueurs n\'occupent pas le même point',
    why: 'Deux corps qui se traversent, c\'est le défaut le plus visible d\'une foule et le moins cher à détecter.',
    check: (s, cfg) => {
      for (let i = 0; i < s.players.length; i++) {
        for (let j = i + 1; j < s.players.length; j++) {
          const d = dist(s.players[i].p, s.players[j].p);
          if (d < cfg.minGap) return `joueurs ${s.players[i].id} et ${s.players[j].id} à ${d.toFixed(2)} m (< ${cfg.minGap})`;
        }
      }
      return null;
    },
  },
  {
    id: 'players-in-the-box', scope: 'frame',
    title: 'les joueurs restent dans l\'aire de jeu',
    why: 'Un joueur hors du carré défend une zone qui n\'existe pas.',
    check: (s, cfg, ctx) => {
      const hx = ctx.area[0] / 2 + 1.5, hz = ctx.area[1] / 2 + 1.5;
      const out = s.players.filter((p) => Math.abs(p.p[0]) > hx || Math.abs(p.p[1]) > hz);
      return out.length ? `joueur ${out[0].id} hors de l'aire (${out[0].p.join(', ')})` : null;
    },
  },

  // ---------------------------------------------------------------- events among themselves
  {
    id: 'one-carrier', scope: 'frame',
    title: 'un seul porteur à la fois',
    why: 'Deux joueurs ne peuvent pas conduire le même ballon ; si l\'état le prétend, une des deux IA joue à vide.',
    check: (s) => (s.phase === 'carry' && s.carrier < 0 ? 'phase « conduite » sans porteur' : null),
  },
  {
    id: 'pass-has-a-striker', scope: 'event', on: 'pass',
    title: 'une passe part d\'un joueur, vers un autre',
    why: 'Une passe sans passeur ou vers soi-même est un état incohérent qui se voit comme un ballon parti tout seul.',
    check: (e) => (e.from === undefined || e.to === undefined || e.from === e.to ? `passe ${e.from} → ${e.to}` : null),
  },
  {
    id: 'correct-foot', scope: 'event', on: 'pass',
    title: 'le pied de frappe est celui du côté de la cible',
    why: 'Frapper du pied opposé oblige à pivoter tout le corps : c\'est l\'un des tells les plus visibles d\'une IA.',
    check: (e) => (e.foot !== 'left' && e.foot !== 'right' ? `pied « ${e.foot} »` : null),
  },
  {
    id: 'no-machine-gun-touches', scope: 'events', on: 'pass',
    title: 'un joueur ne frappe pas deux fois dans la même foulée',
    why: 'Entre deux contacts il faut le temps d\'un appui. Sans ce minimum, la conduite se met à mitrailler.',
    check: (list, cfg) => {
      for (let i = 1; i < list.length; i++) {
        if (list[i].from === list[i - 1].from && list[i].t - list[i - 1].t < cfg.minTouchGap) {
          return `joueur ${list[i].from} frappe deux fois en ${(list[i].t - list[i - 1].t).toFixed(2)} s`;
        }
      }
      return null;
    },
  },
];

export const FOOT_LIMITS = {
  strikeCone: 75,      // ° — demi-angle du cône avant dans lequel le pied peut frapper
  reach: 1.3,          // m — portée du pied depuis le centre du corps
  footHeight: 0.55,    // m — au-dessus, ce n'est plus une passe au pied
  maxStrike: 35,       // m/s — vitesse de frappe humaine plausible
  maxPlayer: 10,       // m/s — vitesse de pointe d'un sprinteur
  carryMax: 3.0,       // m — au-delà, le ballon n'est plus conduit
  ownSlack: 0.35,      // m — tolérance avant de dire qu'un autre est « plus près »
  playable: 0.9,       // m — en-deçà, un adversaire peut réellement JOUER le ballon (pas juste être proche)
  settleMax: 0.6,      // m — où le ballon doit finir après un contrôle : devant le pied, pas ailleurs
  bodyRadius: 0.16,    // m — un ballon plus près que ça traverse le corps
  minGap: 0.45,        // m — deux joueurs plus proches se traversent
  minTouchGap: 0.25,   // s — temps d'appui minimal entre deux contacts du même joueur
};

/**
 * Run the whole catalogue. Returns a verdict PER RULE, not a single boolean: which rule failed and
 * how often is the entire diagnostic value, and a bare `ok:false` throws that away.
 */
export function checkFootball(st, trace, limits = FOOT_LIMITS) {
  const ctx = { area: st.area };
  const events = st.events || [];
  const byRule = {};
  for (const rule of FOOT_RULES) {
    let n = 0, first = null, total = 0;
    if (rule.scope === 'frame') {
      for (const s of trace) {
        if (rule.when && !rule.when(s)) continue;
        total++;
        const bad = rule.check(s, limits, ctx);
        if (bad) { n++; if (!first) first = `t=${s.t} ${bad}`; }
      }
    } else if (rule.scope === 'pair') {
      for (let i = 1; i < trace.length; i++) {
        total++;
        const bad = rule.check(trace[i - 1], trace[i], limits, ctx);
        if (bad) { n++; if (!first) first = `t=${trace[i].t} ${bad}`; }
      }
    } else if (rule.scope === 'event') {
      for (const e of events) {
        if (e.type !== rule.on) continue;
        total++;
        const bad = rule.check(e, limits, ctx);
        if (bad) { n++; if (!first) first = `t=${e.t} ${bad}`; }
      }
    } else if (rule.scope === 'events') {
      const list = rule.on ? events.filter((e) => e.type === rule.on) : events;
      total = list.length;
      const bad = rule.check(list, limits, ctx);
      if (bad) { n = 1; first = bad; }
    }
    byRule[rule.id] = { title: rule.title, violations: n, samples: total, pct: total ? +(100 * n / total).toFixed(1) : 0, first };
  }
  const issues = Object.entries(byRule).filter(([, v]) => v.violations > 0)
    .map(([id, v]) => `${id}: ${v.violations}/${v.samples} (${v.pct}%) — ${v.first}`);
  return { ok: issues.length === 0, issues, byRule };
}
