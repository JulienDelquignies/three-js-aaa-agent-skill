import { makeMatch, matchCfg } from './match-sim.js';
import { makePitch, outRule } from './pitch.js';
import { BALL } from './ball.js';
import { MATCH } from './match-config.js';

// LE DUEL 1c1 (maquette v2) — SUR LES LOIS DU 11c11. La v1 tournait sur la base du rondo : ~280 lois
// du corps y sont éteintes (elles vivent sous st.full) — mesuré, le corps y pivotait jusqu'à
// 10 685 °/s (44 images au-delà de 2 000 °/s), un demi-tour en une image. Ici le duel EST un match
// (makeMatch + matchStep : rotation bornée, virages lissés, profil locomoteur, jockey/contain/mord,
// gestes, frappes) sur un terrain de cage, un joueur par camp, sans gardien.
//
// Ce qui change par rapport au match, et rien d'autre :
//   LA CAGE — pitch 24 × 14, petits buts 3 × 2 ; pas de tablier (apron 0 : la grille est un mur).
//   PAS DE CÉRÉMONIE — ceremonie null : on joue. LA JOIE EST BRÈVE — celebration.dur 3 s (14 s au
//     match : mesuré, 17,6 s de temps mort après chaque but, un tiers du duel à l'arrêt).
//   PAS D'ARBITRE DES FAUTES — loi12 null : le coup franc du match attend un coéquipier à servir
//     (mesuré, 28-33 s gelés sans jamais être tiré) ; dans une cage, on rejoue.
//   LA GRILLE — une sortie qui n'est pas un but REBONDIT (le ballon revient, vitesse réfléchie
//     × rebond) au lieu d'ouvrir une remise : sans gardien, la sortie de but du match gelait
//     (mesuré, graine 3 : le preneur posté derrière la ligne, 25 s immobile à 14 m du jeu).
//   L'ENGAGEMENT — le botteur au ballon, l'adversaire dans son camp à `recul` m (les postes de
//     formation d'un joueur seul sont sa ligne de but : 11 m de marche avant chaque engagement).

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export const CAGE = { length: 24, width: 14, goal: { width: 3, height: 2 }, box: { depth: 3, width: 7 }, six: { depth: 1.2, width: 4 }, spot: 5, circle: 3 };
/** La même cage au format du stade paramétrique (generateStadium). */
export const CAGE_STADE = {
  pitch: { L: CAGE.length, W: CAGE.width, circle: CAGE.circle, box: { d: CAGE.box.depth, w: CAGE.box.width }, six: { d: CAGE.six.depth, w: CAGE.six.width }, spot: CAGE.spot },
  goal: { w: CAGE.goal.width, h: CAGE.goal.height },
};

const DUEL_KEYS = { rebond: 0.55, recul: 3.5 };

/** L'état : un match à un joueur par camp sur la cage, st.full forcé (les lois du corps du 11c11). */
export function makeDuel({ seed = 7, cage = CAGE } = {}) {
  const st = makeMatch({ perTeam: 0, seed, pitch: makePitch(cage) });
  st.full = true;
  for (const p of st.players) p.keeper = false;          // un seul joueur par camp : pas de métier de gardien
  const [a, d] = st.players;
  a.p = [-0.6, 0, 0]; a.yaw = 0;                          // le botteur au ballon (engagement posé par makeMatch)
  d.p = [DUEL_KEYS.recul, 0, 0]; d.yaw = Math.PI;
  st._duel = { cage };
  return st;
}

/** La configuration : celle du match, plus la cage. */
export function duelCfg(overrides = {}) {
  const base = matchCfg({ ceremonie: null, apron: 0, loi12: null, celebration: { ...MATCH.celebration, dur: 3 }, ...overrides });
  return {
    ...base,
    duel: { ...DUEL_KEYS, ...(overrides.duel ?? {}) },
    onOut: (st, cfg) => sortieCage(st, cfg, base.onOut),
    assignJobs: (st, cfg) => { base.assignJobs(st, cfg); engagementDuel(st, cfg); },
  };
}

/** LA GRILLE : un but reste un but (la loi du match : score, célébration, engagement) ; toute autre
 *  sortie rebondit — le ballon repart de la grille, sa vitesse réfléchie, et le jeu continue. */
function sortieCage(st, cfg, onOutMatch) {
  if (st.restart) return onOutMatch(st, cfg);
  const r = outRule(st.pitch, st._ballPrev ?? st.ball.p, st.ball.p, st.lastTouch);
  // …et une sortie ILLISIBLE (segment dégénéré : le ballon dégagé depuis la ligne même) rebondit aussi —
  // renvoyée au match, elle ouvrait une touche à la main avec ramasseur (graine 3, t=8,6 : 20 s gelés)
  if (r?.type === 'but') return onOutMatch(st, cfg);
  const { hx, hz } = st.pitch, b = st.ball.p, v = st.ball.v, k = cfg.duel.rebond;
  const horsX = Math.abs(b[0]) > hx, horsZ = Math.abs(b[2]) > hz;
  const x = clamp(b[0], -hx + 0.25, hx - 0.25), z = clamp(b[2], -hz + 0.25, hz - 0.25);
  const vx = horsX ? -v[0] * k : v[0] * 0.8, vz = horsZ ? -v[2] * k : v[2] * 0.8;
  // la seule discontinuité : le ballon ramené au point de contact de la grille — DÉCLARÉE
  st.ball.restart([x, BALL.radius, z], { cause: horsZ ? 'touche' : 'sortie-de-but' });
  st.ball.impulse([vx, 0, vz]);
  st.events.push({ t: +st.t.toFixed(2), type: 'grille', p: [+x.toFixed(2), +z.toFixed(2)], v: +Math.hypot(vx, vz).toFixed(2) });
  if (st.phase === 'flight') { st.phase = 'loose'; st.possession.carrier = -1; st.pass = null; }
  return true;
}

/** L'ENGAGEMENT DU DUEL : le botteur va au ballon, l'autre attend dans son camp hors du rond. */
function engagementDuel(st, cfg) {
  const R = st.restart;
  if (!R || R.type !== 'engagement') return;
  for (const p of st.players) {
    if (p.act || p.down > 0) continue;
    if (p.team === R.team) p.target = [R.p[0] - Math.sign(st.pitch.attackGoal(p.team).x) * 0.6, 0, R.p[1]];
    else p.target = [R.p[0] + Math.sign(st.pitch.ownGoal(p.team).x) * cfg.duel.recul, 0, R.p[1]];
  }
}
