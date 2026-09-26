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

/** (2026-09-26, « agrandis le terrain et mets des gardiens ») LE TERRAIN DE FUTSAL — Lois du jeu du futsal (FIFA), loi 1 : 40 × 20 m (le format
 *  international : 38-42 × 20-25), buts 3 × 2 m, surface de réparation = deux quarts de cercle de 6 m centrés sur les poteaux joints par une
 *  ligne de 3,16 m (box : son rectangle englobant, 6 × 15,16 — la zone de prise du gardien), point de réparation à 6 m, second à 10 m,
 *  cercle central de 3 m. Pas de surface de but (six : un reliquat du 11c11 — placement des sorties de but, que la grille rend inutiles).
 *  Hier : la cage street 24 × 14, sans gardien. */
export const CAGE = { length: 40, width: 20, goal: { width: 3, height: 2 }, box: { depth: 6, width: 15.16 }, six: { depth: 1, width: 4 }, spot: 6, spot2: 10, circle: 3, futsal: true };
/** La même cage au format du stade paramétrique (generateStadium). */
export const CAGE_STADE = {
  pitch: { L: CAGE.length, W: CAGE.width, circle: CAGE.circle, box: { d: CAGE.box.depth, w: CAGE.box.width }, six: { d: CAGE.six.depth, w: CAGE.six.width }, spot: CAGE.spot },
  goal: { w: CAGE.goal.width, h: CAGE.goal.height },
};

const DUEL_KEYS = { rebond: 0.55, recul: 3.5, passeGardien: 0.35, degagement: false, appel: { x: 9, z: 4.5 }, repli: { angle: 50, avance: 0.7, min: 2, max: 7, pres: 6 } };   // passeGardien : la note de la passe du joueur de champ à SON gardien × 0,35 (menace.arbitre) — un 1c1 se joue au dribble

/** L'état : un joueur de champ par camp ET SON GARDIEN (le métier du 11c11 : keeper.js — il se règle sur la largeur du but), st.full forcé
 *  (les lois du corps du 11c11). gardiens:false = le duel d'hier, sans gardien. */
export function makeDuel({ seed = 7, cage = CAGE, gardiens = true } = {}) {
  const st = makeMatch({ perTeam: gardiens ? 1 : 0, seed, pitch: makePitch(cage) });
  st.full = true;
  if (!gardiens) for (const p of st.players) p.keeper = false;          // un seul joueur par camp : pas de métier de gardien
  const [a, d] = [0, 1].map((t) => st.players.find((p) => p.team === t && !p.keeper));
  a.p = [-0.6, 0, 0]; a.yaw = 0;                          // le botteur au ballon (engagement posé par makeMatch)
  d.p = [DUEL_KEYS.recul, 0, 0]; d.yaw = Math.PI;
  st._duel = { cage };
  st.ball.sol = SOL_CAGE;                                  // le ballon roule sur le synthétique mesuré (ball.js rollGround)
  return st;
}

/** LE SOL DE LA CAGE : un gazon synthétique — la décélération du ballon qui roule mesurée par Kolitzus (ISSS, « Ball roll behaviour ») :
 *  0,40 + 0,17·v m/s² de 0,5 à 3,2 m/s (le terme de fibre plafonné au-delà). Le ballon (ball.js) et le dosage des touches (dribble.js) la partagent. */
export const SOL_CAGE = Object.freeze({ dec0: 0.40, decV: 0.17, vMax: 3.2 });

/** La configuration : celle du match, plus la cage. */
export function duelCfg(overrides = {}) {
  const base = matchCfg({ ceremonie: null, apron: 0, loi12: null, celebration: { ...MATCH.celebration, dur: 3 }, ...overrides });
  return {
    ...base,
    duel: { ...DUEL_KEYS, ...(overrides.duel ?? {}) },
    pas: overrides.pas ?? true,   // (2026-09-24) l'horloge de foulée dans la sim, la touche au pied qui la joue (pas.js)
    // (2026-09-25) LE RÉPERTOIRE DU 1c1 dans la foulée : la feinte de corps (face-à-face à 1,1-3 m), et le plancher d'envie des gestes de la cage
    dribble1c1: overrides.dribble1c1 ?? { plancher: 0.45, feinteFoe: [1.1, 3.0], feinteCone: 55, feinteCd: 3, feinteBite: 0.5, sortie: { duree: 0.6 }, passementV: 1.3, envieFace: 0.8, face: 3.5, feinteV: 1.0, refusCd: 0.5 },   // (2026-09-26) envieFace : face au défenseur on TENTE (skills-sim.envieFace) ; feinteV 1,0 (le porteur ralentit face à lui : 1,2 m/s p50) ; refusCd 0,5 s, feinteCd 3 s (6 : une feinte par face-à-face au plus)
    // …et L'ÉQUILIBRE du répertoire (mesuré, 16 min : 22 passements, 8 crochets, 6 feintes, 1 croqueta — le passement, testé AVANT les autres
    // avec une envie doublée, prenait toutes les fenêtres de face) : l'envie du passement ramenée à celle des autres, le crochet relevé
    passements: { ...base.passements, envie: 1, plancher: 0.2 },
    bouclier: base.bouclier ? { ...base.bouclier, pas: 0.8 } : base.bouclier,
    murCorps: overrides.murCorps ?? 0.244,   // LA GRILLE EST UN MUR POUR LE CORPS AUSSI : le centre s'arrête à une demi-carrure (bideltoïde ANSUR II 0,488 m / 2) — borné à la ligne, le corps entrait de moitié dans la grille et, au poteau, dans le but
    armePied: overrides.armePied ?? true,   // L'ARMÉ AU PIED (approach.glideRelatif) : pendant l'armé d'une frappe le ballon ROULE, le corps règle ses appuis sur lui — le servo au point de stance (porteAnticipe, jusqu'à 9 m/s) et la foulée d'ancre le traînaient sans pied
    recup: overrides.recup ?? { pied: 0.30, contact: 0.22, lent: 0.8, semelle: 0.45, devant: 0.6 },   // pied 0,30 : entre le pied du générateur (0,25 — au rendu 0,21 m p50 à la prise, mais le ballon libre 33 % du temps) et la portée que le rendu plie (0,35 — 0,27 m au rendu)   // le ballon libre se prend AU PIED, sans aimant (rondo-sim receive / prise, pas.pasPiedAtteint, recupTouche)
    pasPortee: overrides.pasPortee ?? 0.4,   // la touche de rattrapage (fin de vol) n'attend que le pied que le rendu PEUT amener au ballon (viseBallon ≤ 0,4 m) : 0,55 laissait un quart des touches à 0,27-0,35 m du pied rendu
    conduite: overrides.conduite ?? { couple: { d0: 0.35, tau: 0.4, vMin: 0.8 }, libre: 1.0, lead: 0.5, cadence: { v: [3.0, 5.7], f: [2.65, 1.85] } },   // cadence : LE JOUEUR ET LE BALLON NE FONT QU'UN — la touche suivante au pied du pas qui vient, à la cadence mesurée (dribble.toucheCadenceT, Zago 2016) ;   // lead : la touche plus courte — une par foulée (Zago 2016 : 2,3-3 touches/s en slalom ; 1,4-2,3/s en conduite droite à 5,7 m/s)   // le porteur court AVEC son ballon (movement), en course le ballon n'est plus tenu au servo (rondo-sim)
    surface: SOL_CAGE,   // le dosage des touches sur la loi du ballon (dribble.js touchDecel)
    leanPhys: true,   // l'accélération penche le tronc selon atan(a/g) (character-controller._applyLean, via la scène)
    locomoteur: base.locomoteur ? { ...base.locomoteur, sortie: true } : base.locomoteur,   // la sortie d'un geste démarre à pleine capacité force-vitesse (locomoteur.pasLoco)
    corps: overrides.corps ?? { portee: 1.8, marge: 0.01 },   // les corps RENDUS ne se traversent pas (contact-corps.js, appelé par la scène)
    decalage: base.decalage ? { ...base.decalage, plancher: 0.45 } : base.decalage,
    // (2026-09-26, « trop de tirs, pas assez de dribble ») LE TIR SE COMPARE AU DRIBBLE (xg.evDribbleDe) : sans coéquipier de champ, la
    // continuation d'un tir est le ballon gardé et mené plus près — plus la passe (nulle ici : on frappait dès la portée). Et la conduite
    // ne « s'use » pas (menace.muteD : elle poussait à RENDRE le ballon après 10 m — il n'y a personne à qui le rendre sur 40 m)
    xg: base.xg ? { ...base.xg, dribble: { pas: 4, min: 5, devant: 4, passe: 0.5, libre: 0.85 } } : base.xg,
    menace: typeof base.menace === 'object' ? { ...base.menace, muteD: 999 } : base.menace,
    onOut: (st, cfg) => sortieCage(st, cfg, base.onOut),
    assignJobs: (st, cfg) => { base.assignJobs(st, cfg); engagementDuel(st, cfg); appelDuel(st, cfg); repliDuel(st, cfg); },
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

/** L'APPEL DE BALLE (les gardiens, 2026-09-26) : quand SON gardien a le ballon, le joueur de champ ne reste pas sur le poste de soutien du 11c11
 *  (mesuré : figé > 1,5 s au coin de sa surface, le gardien sans ligne) — il se démarque devant son but, à `appel.x` m de sa ligne, du côté
 *  opposé à l'adversaire, et s'y replace tant que l'adversaire ferme la ligne. */
function appelDuel(st, cfg) {
  const K = cfg.duel.appel; if (!K || st.restart) return;
  const car = st.players[st.possession?.carrier ?? -1];
  if (!car?.keeper || st.phase !== 'carry') return;
  const moi = st.players.find((p) => p.team === car.team && !p.keeper), foe = st.players.find((p) => p.team !== car.team && !p.keeper);
  if (!moi || moi.act || moi.down > 0) return;
  const g = st.pitch.ownGoal(car.team), zs = foe ? -Math.sign(foe.p[2] || 1) : 1;
  moi.target = [g.x - g.sign * (K.x ?? 9), 0, zs * Math.min(st.pitch.hz - 1.5, K.z ?? 4.5)];
}

/** LE REPLI DU DÉFENSEUR (les gardiens, 2026-09-26 — « pas assez de dribble ») : mesuré (geo-1c1), le défenseur était DERRIÈRE le porteur 75 %
 *  des instants de décision (61 % à 1,5-3 m, 3,9 m/s : une course-poursuite), de face à < 3 m 4,6 % — le 1c1 était une course, pas un duel.
 *  Le vrai défenseur se replace ENTRE le ballon et son but avant de défier : tant qu'il n'est pas du bon côté (son relèvement depuis le
 *  porteur à plus de `angle`° de l'axe porteur → but), il court au point de l'axe devant le porteur que ses jambes atteignent d'abord
 *  (à `avance` × sa distance, borné) — le porteur mené ralentit (70-85 % de son sprint), l'homme sans ballon le rattrape ; du bon côté,
 *  la défense du match reprend (contenir, temporiser, mordre). */
function repliDuel(st, cfg) {
  const K = cfg.duel.repli; if (!K || st.restart || st.phase !== 'carry') return;
  const car = st.players[st.possession?.carrier ?? -1]; if (!car || car.keeper) return;
  const def = st.players.find((p) => p.team !== car.team && !p.keeper); if (!def || def.act || def.down > 0) return;
  const g = st.pitch.ownGoal(def.team), gx = g.x - car.p[0], gz = -car.p[2], gl = Math.hypot(gx, gz) || 1, dx = def.p[0] - car.p[0], dz = def.p[2] - car.p[2], dl = Math.hypot(dx, dz) || 1;
  const cos = (dx * gx + dz * gz) / (dl * gl);
  if (cos >= Math.cos((K.angle ?? 50) * Math.PI / 180) || gl < (K.pres ?? 6)) return;   // déjà du bon côté (ou le porteur au but : on y va)
  const L = Math.max(K.min ?? 2, Math.min(K.max ?? 7, dl * (K.avance ?? 0.7), gl - 1));
  def.target = [car.p[0] + gx / gl * L, 0, car.p[2] + gz / gl * L];
}

/** L'ENGAGEMENT DU DUEL : le botteur va au ballon, l'autre attend dans son camp hors du rond. */
function engagementDuel(st, cfg) {
  const R = st.restart;
  if (!R || R.type !== 'engagement') return;
  for (const p of st.players) {
    if (p.act || p.down > 0 || p.keeper) continue;   // le gardien garde son but (keeper.js)
    if (p.team === R.team) p.target = [R.p[0] - Math.sign(st.pitch.attackGoal(p.team).x) * 0.6, 0, R.p[1]];
    else p.target = [R.p[0] + Math.sign(st.pitch.ownGoal(p.team).x) * cfg.duel.recul, 0, R.p[1]];
  }
}
