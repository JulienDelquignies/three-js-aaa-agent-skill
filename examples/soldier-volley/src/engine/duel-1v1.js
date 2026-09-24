import { makeRondo, assignJobs, rondoInternals, RONDO } from './rondo.js';
import { MATCH } from './match-config.js';
import { BALL } from './ball.js';
import { hyp } from './hyp.js';

// LE DUEL 1c1 (maquette) — un porteur contre un défenseur dans une cage de 14 × 10 m. C'est une
// CONFIGURATION de rondoStep (MOTEUR.md : un mode = une config de la boucle, jamais un fork) :
// cfg.assignJobs branche l'attribution du duel par-dessus celle du rondo. Aucune clé nouvelle dans
// RONDO ni MATCH — le rondo et le match restent au bit près ; tout ce qui suit ne vit que sous DUEL.
//
// Le point : le porteur AMÈNE son ballon, maîtrisé, dans la zone d'en-but adverse (les derniers
// `zone` m de la cage). L'équipe 0 attaque +x, l'équipe 1 attaque −x. Le perdant repart avec le
// ballon — la remise se DÉCLARE (cause 'engagement'), aucun corps n'est téléporté.
//
// Les deux lois que la maquette doit prouver (verify-duel) :
//   PERSONNE NE GÈLE — le défenseur tient sa garde en vivant (le jockey suit le ballon), et un
//   corps arrivé sur sa cible sans vitesse fait un pas de replacement (l'anti-gel, haché : le flux
//   seedé st.rnd n'est jamais consommé).
//   LES VIRAGES SE FONT SUR L'ÉLAN — c'est déjà la loi de movePlayers (turnAccel/v) ; le duel n'y
//   touche pas, il la mesure.

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export const DUEL = {
  ...RONDO,
  area: [14, 10],
  // les gestes pour battre son homme (crochet, passement, double contact, petit pont, roulette)
  // vivent dans MATCH.skill — le duel est précisément l'endroit où ils servent
  skill: { ...RONDO.skill, ...MATCH.skill },
  // LE PIQUE du match : un ballon de conduite trop long est libre AUSSI pour le défenseur
  pokeReach: MATCH.pokeReach,
  assignJobs: assignDuel,
  duel: {
    zone: 1.6,      // m — profondeur de la zone d'en-but
    tenu: 1.2,      // m — le ballon compte comme maîtrisé à moins de ça du porteur
    devant: 2.5,    // m — …ou à moins de ça, le porteur nettement plus près que le défenseur
    garde: 1.7,     // m — le jockey se tient à ça du ballon, entre lui et sa ligne
    serre: 0.55,    // × garde quand le porteur ralentit (< 1,2 m/s) : on referme
    mord: 1.3,      // m — une touche plus longue que ça : le défenseur attaque le ballon
    mort: 0.6,      // m/s — un ballon plus lent que ça se joue EN MARCHANT DEDANS (voir assignDuel)
    traverse: 0.5,  // m — …la cible de marche passe à travers le ballon de ça
    serreTouche: 0.6, serreD: 4,   // × longueur de touche quand le défenseur est à moins de serreD m
    lat: 0.35,      // m — le jockey ferme l'intérieur (pousse le porteur vers la touche)
    regard: 4.5,    // m — en deçà, le jockey fait face au porteur (pas chassé, dos jamais tourné)
    regardV: 3.5,   // m/s — au-delà, il court (battu, il se retourne et fait la course)
    // la poussée du porteur : l'évasion du rondo + la PROGRESSION vers la ligne
    step: 1.2, samples: 24, foe: 1.0, edge: 0.8, keep: 0.9, goal: 1.4,
    gel: { v: 0.25, t: 0.4, pas: 0.45, duree: 0.5 },   // null : pas d'anti-gel (sabotage nommé)
  },
};

/** L'état d'un duel : makeRondo à un par équipe, puis la mise en place face à face. */
export function makeDuel({ seed = 7, area = DUEL.area } = {}) {
  const st = makeRondo({ perTeam: 1, seed, area });
  const hx = area[0] / 2, hz = area[1] / 2;
  const z0 = ((((seed >>> 0) * 7919) % 11) / 11 - 0.5) * hz;   // la graine varie l'entrée (hachée, pas tirée)
  const [a, d] = st.players;
  a.p = [-hx * 0.45, 0, z0]; a.yaw = 0;
  d.p = [hx * 0.15, 0, -z0 * 0.5]; d.yaw = Math.PI;
  st.ball.restart([a.p[0] + 0.6, BALL.radius, a.p[2]], { cause: 'engagement' });
  st._duel = { score: [0, 0], points: 0 };
  st._possTeam = 0;
  return st;
}

/** Le sens d'attaque d'une équipe : +1 (vers +x) pour l'équipe 0, −1 pour l'équipe 1. */
export const sensDe = (team) => (team === 0 ? 1 : -1);

/** Où pousser le ballon : l'évasion du rondo (loin du défenseur, loin de la craie, sur l'élan)
 *  plus la progression vers la ligne adverse. Échantillonné autour du BALLON, comme evadeSpot. */
export function duelSpot(st, c, D, so = 0) {
  const hx = st.area[0] / 2, hz = st.area[1] / 2, s = sensDe(c.team);
  const sp = hyp(c.v[0], c.v[1]);
  const hdx = sp > 0.4 ? c.v[0] / sp : Math.cos(c.yaw), hdz = sp > 0.4 ? c.v[1] / sp : Math.sin(c.yaw);
  const bx = st.ball.p[0], bz = st.ball.p[2];
  const gx = s * hx - bx, gz = bz * -0.5, gl = hyp(gx, gz) || 1;
  let best = null;
  for (let i = 0; i < D.samples; i++) {
    const a = (i / D.samples) * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a);
    const x = bx + dx * D.step, z = bz + dz * D.step;
    if (Math.abs(z) > hz - 1.0) continue;                              // la craie de touche : pas une option
    if (Math.abs(x) > hx - 0.3) continue;                              // la ligne de fond : on marque AVANT
    // LE POINT D'APPUI EST DANS LA CAGE : pousser vers −u, c'est se tenir en ballon + u·standoff — hors
    // de la cage, le corps ne l'atteint jamais et ne touche plus son ballon (mesuré, graine 4 : le
    // porteur plaqué contre son mur de fond, 3,1 s immobile à 0,38 m d'un ballon mort)
    if (Math.abs(bx - dx * so) > hx - 0.4 || Math.abs(bz - dz * so) > hz - 0.4) continue;
    let foe = Infinity;
    for (const f of st.players) if (f.team !== c.team && f.down <= 0) foe = Math.min(foe, hyp(f.p[0] - x, f.p[2] - z));
    const edge = hz - Math.abs(z);
    const score = Math.min(foe, 6) * D.foe + Math.min(edge, 3) * D.edge
      + (dx * hdx + dz * hdz) * D.keep + (dx * gx + dz * gz) / gl * D.goal;
    if (!best || score > best.score) best = { score, dx, dz };
  }
  return best;
}

/** L'attribution du duel : la base du rondo (carry / press / ballon libre / interception), puis
 *  le point, la progression du porteur, le jockey, l'anti-gel. */
export function assignDuel(st, cfg = DUEL) {
  assignJobs(st, cfg);
  const D = cfg.duel, hx = st.area[0] / 2, hz = st.area[1] / 2;
  st._possTeam = st.possession.team;                                   // l'attente (motion-idle) lit qui défend
  const c = st.possession.carrier >= 0 ? st.players[st.possession.carrier] : null;
  const libre = (p) => p && !p.act && p.down <= 0;

  if (c && st.phase === 'carry') {
    const s = sensDe(c.team), bx = st.ball.p[0], bz = st.ball.p[2];
    const dcb = hyp(c.p[0] - bx, c.p[2] - bz);
    // 1. LE POINT — ballon maîtrisé, au sol, dans la zone d'en-but adverse
    //    (maîtrisé = au pied, OU nettement devant le défenseur sur son propre ballon — mesuré :
    //    574 images de ballon en zone sans point, le porteur à plus de 1,2 m derrière sa touche)
    const ddb = Math.min(99, ...st.players.filter((q) => q.team !== c.team && q.down <= 0).map((q) => hyp(q.p[0] - bx, q.p[2] - bz)));
    if (bx * s > hx - D.zone && st.ball.p[1] < 0.5 && (dcb < D.tenu || (dcb < D.devant && dcb + 0.3 < ddb))) { point(st, c, cfg); return; }
    // 2. LE PORTEUR PROGRESSE — debout derrière son ballon, côté pied frappeur (la loi du rondo)
    //    …et SOUS PRESSION IL SERRE SA CONDUITE : la touche du rondo (touchDistance(v)) envoie le
    //    ballon à ~1,3 m à 2 m/s — mesuré en image, un ballon « entre les deux » plus qu'au pied, et la
    //    moitié des pertes du duel sont des piques sur ces touches longues. c.touchF (canal existant de
    //    dribbleStep) : la clé vit sur le JOUEUR du duel, le rondo ne la pose jamais.
    for (const p of st.players) p.touchF = p === c && ddb < D.serreD ? D.serreTouche : 1;
    if (libre(c)) {
      // …ET UN BALLON PLAQUÉ CONTRE LA PAROI SE RAMÈNE VERS LE CENTRE. Aucune poussée n'a son point
      // d'appui dans la cage : la cible d'hier restait DERRIÈRE le mur (mesuré, graine 4 : ballon à
      // 0,12 m de la ligne de fond, 53 s figés). La touche de dribbleStep pousse vers `want` quel que
      // soit le côté du corps — marcher à travers le ballon vers le centre, c'est la semelle tirée.
      const b = duelSpot(st, c, D, cfg.carryStandoff) ?? (() => { const l = hyp(bx, bz) || 1; return { dx: -bx / l, dz: -bz / l, plaque: true }; })();
      if (b.plaque) { c.push = [b.dx, b.dz]; c.target = [bx + b.dx * D.traverse, 0, bz + b.dz * D.traverse]; }
      else {
        const lat = (c.foot === 'left' ? 1 : -1) * cfg.carrySideBias;
        c.target = [bx + (-b.dx + b.dz * lat) * cfg.carryStandoff, 0, bz + (-b.dz - b.dx * lat) * cfg.carryStandoff];
        c.push = [b.dx, b.dz];
        // LE BALLON ARRÊTÉ SE JOUE EN MARCHANT DEDANS. La touche exige une foulée (dribbleStep :
        // sinceTouch ≥ minStride, accumulé par la VITESSE du porteur) : posé à son standoff derrière
        // un ballon mort, il ne le touche jamais — et le jockey, calé sur ce ballon, s'arrête aussi.
        // Mesuré sans anti-gel : 97 % du temps figé, le porteur à 0,44 m d'un ballon à v = 0. Même loi
        // que l'intention de passe du rondo : on marche À TRAVERS le point, pas jusqu'à lui.
        // …À CONDITION D'ÊTRE DERRIÈRE LUI : devant son ballon (le ballon côté touche, la poussée vers
        // l'intérieur), « à travers » vise un point à 16 cm de soi — le corps ne bouge pas, la foulée
        // non plus (mesuré, graines 1 et 6, 40 s figés). Là, c'est le standoff d'hier qui le fait
        // CONTOURNER son ballon : le contour est une foulée, la touche suit.
        if (hyp(st.ball.v[0], st.ball.v[2]) < D.mort && dcb < cfg.carryStandoff + 0.35
          && (c.p[0] - bx) * b.dx + (c.p[2] - bz) * b.dz < 0) {
          c.target = [bx + b.dx * D.traverse, 0, bz + b.dz * D.traverse];
        }
      }
    }
    // 3. LE JOCKEY — entre le ballon et sa ligne, l'intérieur fermé, face au porteur
    for (const p of st.players) {
      if (p.team === c.team || !libre(p)) continue;
      const dpb = hyp(p.p[0] - bx, p.p[2] - bz);
      if (dcb > D.mord && dpb < dcb) p.target = [bx, 0, bz];            // touche trop longue : on attaque le ballon
      else {
        const ux = s * hx - bx, uz = bz * -0.35, ul = hyp(ux, uz) || 1;
        const g = D.garde * (c.speed < 1.2 ? D.serre : 1);
        const inside = -Math.sign(bz || 1) * D.lat;
        p.target = [clamp(bx + (ux / ul) * g, -hx + 0.3, hx - 0.3), 0, clamp(bz + (uz / ul) * g + inside, -hz + 0.3, hz - 0.3)];
      }
      const dpc = hyp(c.p[0] - p.p[0], c.p[2] - p.p[2]);
      if (dpc < D.regard && p.speed <= D.regardV) { p._regard = Math.atan2(c.p[2] - p.p[2], c.p[0] - p.p[0]); p._regardUntil = st.t + 0.15; }
    }
  }

  // 4. L'ANTI-GEL — arrivé sur sa cible et sans vitesse depuis gel.t s : un pas de replacement de
  //    gel.pas m, perpendiculaire au ballon, côté haché (joueur × instant) — jamais st.rnd
  const G = D.gel;
  if (!G) return;
  for (const p of st.players) {
    if (!libre(p) || !p.target) { p._gel0 = null; continue; }
    if (p._gelPas && st.t < p._gelPas.until) {
      p.target = [clamp(p.target[0] + p._gelPas.dx, -hx + 0.3, hx - 0.3), 0, clamp(p.target[2] + p._gelPas.dz, -hz + 0.3, hz - 0.3)];
      continue;
    }
    const dT = hyp(p.target[0] - p.p[0], p.target[2] - p.p[2]);
    if (p.speed >= G.v || dT > 0.3) { p._gel0 = null; continue; }
    if (p._gel0 == null) { p._gel0 = st.t; continue; }
    if (st.t - p._gel0 < G.t) continue;
    const ux = st.ball.p[0] - p.p[0], uz = st.ball.p[2] - p.p[2], ul = hyp(ux, uz) || 1;
    let side = ((p.id * 7919 + Math.floor(st.t * 2) * 104729) % 2) ? 1 : -1;
    // …du côté où il y a de la place : un pas avalé par la paroi n'en est pas un (graine 4)
    const tx = p.target[0] + (-uz / ul) * side * G.pas, tz = p.target[2] + (ux / ul) * side * G.pas;
    if (hyp(clamp(tx, -hx + 0.3, hx - 0.3) - p.target[0], clamp(tz, -hz + 0.3, hz - 0.3) - p.target[2]) < G.pas * 0.5) side = -side;
    p._gelPas = { until: st.t + G.duree, dx: (-uz / ul) * side * G.pas, dz: (ux / ul) * side * G.pas };
    p._gel0 = null;
    st.events.push({ t: +st.t.toFixed(2), type: 'duel-pas', by: p.id });
  }
}

/** Le point : le score, l'événement (avec sa géométrie), et le perdant qui repart avec le ballon. */
function point(st, c, cfg) {
  const hx = st.area[0] / 2, hz = st.area[1] / 2;
  st._duel.score[c.team]++; st._duel.points++;
  st.events.push({ t: +st.t.toFixed(2), type: 'duel-point', by: c.id, equipe: c.team,
    ballon: [+st.ball.p[0].toFixed(2), +st.ball.p[2].toFixed(2)], score: [...st._duel.score] });
  const o = st.players.find((p) => p.team !== c.team);
  if (!o) return;
  const s = sensDe(o.team);
  st.ball.restart([clamp(o.p[0] + s * 0.6, -hx + 1, hx - 1), BALL.radius, clamp(o.p[2], -hz + 1, hz - 1)], { cause: 'engagement' });
  rondoInternals.turnover(st, o.id, 'duel-point', cfg);
}
