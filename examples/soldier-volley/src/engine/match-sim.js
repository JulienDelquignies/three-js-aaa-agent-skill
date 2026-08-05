// match-sim — LE MATCH RÉDUIT : deux buts, des gardiens, des tirs, des remises en jeu, un score.
//
// L'architecture est celle d'un moteur, pas d'un fork : il n'y a QU'UN game-loop (rondo-sim,
// prouvé par 40 clauses) et le match est une CONFIGURATION de ce loop — quatre points d'accroche
// (`assignJobs`, `tryShot`, `onOut`, `onDive`, `canTake`) posés là où le rondo disait « carré
// abstrait » : l'attribution des rôles devient directionnelle (on attaque UN but), la sortie de
// balle devient une RÈGLE (pitch.outRule : but / touche / corner / sortie de but), le porteur
// gagne LE geste qui n'existait pas (le tir), et le gardien gagne son métier (keeper.js).
// Duels, gestes techniques, personas, tempo, balistique : tout le reste est le MÊME code que le
// rondo — c'est le point.
//
// Ce qui est volontairement V1 (dettes nommées, pas des oublis) :
//   — remise de touche AU PIED (loi du format réduit, comme au futsal — écrite dans pitch.js) ;
//   — pas de hors-jeu (format réduit à 5+1, comme au futsal/five — loi du format) ;
//   — le gardien ne sort pas de sa surface (keeper v1 : depthMax 2,6 m) ;
//   — les remises placent le ballon et tiennent les adversaires à distance, sans cérémonie.

import { BALL } from './ball.js';
import { laneClearance, predictPath, interceptPoint } from './ball-predict.js';
import { RONDO, makeRondo, evadeSpot } from './rondo.js';
import { rondoStep, checkRondo, simInternals } from './rondo-sim.js';
import { makePitch, outRule, REDUIT, FULL } from './pitch.js';
import { formationSpots } from './formation.js';
import { KEEPER, keeperSpot, keeperDecide } from './keeper.js';
import { makeProfile } from './attributes.js';
import { startGesture, busy, winding } from './gesture.js';
import { MOVES } from './animkit.js';

const d2 = (a, b) => Math.hypot(a[0] - b[0], (a[2] ?? a[1]) - (b[2] ?? b[1]));

/** La configuration du MATCH — le RONDO plus les lois du but. */
export const MATCH = {
  ...RONDO,
  area: [REDUIT.length, REDUIT.width],
  // LE TIR. Portée et dégagement : on ne tire pas de sa moitié (v1), pas à travers un mur, et le
  // coin visé est choisi CONTRE la position réelle du gardien. La vitesse est un plancher de tir
  // (un tir est un geste de puissance — solvePass rend la vitesse d'ARRIVÉE, trop douce pour cadrer).
  shotRange: 15,          // m — distance au centre du but en deçà de laquelle le tir se considère
  shotClear: 0.45,        // m — couloir minimal vers le point visé (laneClearance, gardien exclu ;
                          // 0,75 n'existait JAMAIS devant une défense postée côté but — 0 tir mesuré)
  shotSpeed: 17,          // m/s — plancher de vitesse du tir
  shotHold: 0.25,         // s — pas de tir à la première image de possession
  // LE TEMPO x1 — mesuré contre le réel (3 × 120 s) : 25 passes/min (11c11 : 9-11, futsal :
  // 14-18), tenue réception→passe 0,83 s, corps à 10 km/h de moyenne (réel 7,2), 195 m/min/joueur
  // (réel 110-120), ballon en jeu 94 % (réel 55-65). « FM est plus lent en x1 » : oui — moitié
  // TEMPS MORT (une touche réelle prend 15-25 s), moitié TENUE. Les remises respirent, le ballon
  // se garde, le hors-ballon marche — les cibles : 15-18 passes/min, en-jeu ~80 %, corps ≤ 8,5 km/h.
  restartWait: 3.2,       // s — une remise se POSE (était 1,1 : le jeu ne respirait jamais ; 4,0 quand
                          // la pose était invisible — le porté du preneur EST devenu la pose, le
                          // temps plein faisait double emploi : en-jeu mesuré 68 %, bande ≥ 70)
  restartClear: 3.0,      // m — les adversaires tiennent ce rayon à la remise (futsal Loi 15 : 5 m ; réduit ici à l'échelle)
  restartCarried: true,   // la remise se PORTE (le preneur va chercher le ballon — ballFetch) ; false : l'ancien snap (sabotage nommé)
  chaseLoose: true,       // le ballon libre est CHASSÉ par les deux camps ; false : la formation l'orbite (sabotage nommé)
  apron: 2.0,             // m — le tablier autour du terrain : un corps peut enjamber la ligne (chercher un ballon sorti)
  carryLawLoose: true,    // la bascule carry→libre lit la LOI DE TOUCHE (jamais sur une touche légale) ; false : le rayon plat (sabotage nommé)
  shotVariety: true,      // le répertoire du tir (placé/croisé/puissance/mi-hauteur/lucarne) ; false : le rase-mottes unique (sabotage nommé)
  keeperClaim: true,      // la sortie dans les pieds : un ballon au sol à portée de gants se ramasse, même « porté » ; false : le label-bouclier (sabotage nommé)
  carrySurge: { at: 1.25, top: 6.2 },  // le porteur COURT sur sa touche poussée (> 1,25 m → pointe libérée) ; null : le trottinement (sabotage nommé)
  carryTight: 0.62,       // la CONDUITE SERRÉE par défaut (la touche pleine est l'acte nommé d'un burst) ; 1 : le knock-on permanent (sabotage nommé)
  carryGuard: 0.4,        // la CONDUITE PROTÉGÉE : défenseur à ≤ 2,2 m → le ballon COLLE au pied,
                          // burst ou pas (le ballon lié tant que le défenseur n'intervient pas) ;
                          // null : la touche de fuite (sabotage nommé)
  guardDamp: 0.88,        // …et la touche protégée AMORTIT (le ballon roule SOUS l'allure — sans
                          // ça le lead court partait quand même au-dessus de la vitesse du corps)
  meetBall: true,         // le receveur ATTAQUE son ballon (rencontre au plus tôt) ; false : la statue au point de chute (sabotage nommé)
  // LES GESTES DU MATCH (passement, crochet, feinte de frappe) : leurs clés n'existent QU'ICI —
  // les maybe* refusent AVANT tout tirage quand elles manquent, le rondo est inchangé au bit près
  skill: {
    ...RONDO.skill,
    passementFoe: [0.9, 2.6],  // m — le jockey posté en face (pas une charge : le râteau possède la charge)
    passementBite: 0.4,     // s — le mensonge du buste : le jockey lance son appui du mauvais côté
    passementCd: 8,         // s
    crochetFoe: [1.0, 2.3], // m — le défenseur qui ferme la course en avant-latéral
    crochetTurn: 1.4,       // rad (~80°) — la coupe à travers la course
    crochetClear: 1.2,      // m — la sortie du crochet doit être libre
    crochetCd: 7,           // s
    frappeFeinteFoe: [1.0, 2.8],  // m — le contreur à asseoir
    frappeFeinteCone: 40,   // ° — demi-cône vers le but dans lequel le contreur mord
    frappeFeinteBite: 0.7,  // s — on ne se jette pas devant une demi-frappe (plus long qu'une feinte de passe)
    frappeFeinteCd: 9,      // s
  },
  carryViaBall: true,     // le porteur PASSE PAR SON BALLON (cible = ballon au-delà de la portée) ; false : la cible-plan (sabotage nommé)
  meetZone: 3.5,          // m — la rencontre vit dans les DERNIERS mètres du vol (avant : tenir sa position)
  meetStep: 1.3,          // m — UN PAS ET DEMI vers le ballon, sur l'axe de la livraison (pas un correcteur balistique)
  execSigma: 0.044,       // rad (≈ 2,5°) — le déchet technique du joueur MOYEN (les notes le raffinent, l'urgence l'aggrave ×1,25)
  keeperDown: 1.15,       // s — le prix d'un plongeon (au sol après, gagné ou perdu) : couvre le
                          // couché + relevé RÉEL du clip (~1,05 s après contact à vitesse 1 —
                          // à 0,75 le corps sim repartait pendant que le rendu se relevait encore)
  pokeReach: 0.5,         // m — LE PIQUE : un ballon de conduite libre à portée de pied adverse
                          // se dévie (poke tackle) ; null : le défenseur-spectateur (sabotage nommé)
  prepTouch: true,        // LA TOUCHE DE PRÉPARATION avant la frappe (serre la touche quand le
                          // couloir de tir est ouvert) ; false : l'empalement (sabotage nommé)
  prepTouchF: 0.3,        // le régime de la touche de préparation (plus serré que carryTight)
  prepDamp: 0.72,         // l'AMORTI de la touche de préparation (le ballon roule sous l'allure
                          // du corps et se cale — sans lui, chaque touche relançait à v+1)
  gkRelease: 3.0,         // s — LA RÈGLE DES SIX SECONDES à l'échelle : passé ce délai, la
                          // distribution du gardien est FORCÉE (meilleure rampe, sinon punt) ;
                          // null : le gardien-attaquant (sabotage nommé — 87 m de dribble mesurés)
  lossReact: 1.6,         // s — LE DÉPOSSÉDÉ SE RETOURNE (contre-press) : l'ex-porteur chasse son
                          // ballon au lieu de repartir en coureur de slot ; null : la course
                          // aveugle (sabotage nommé — 92/254 pertes suivies d'un dos-au-ballon)
  // LA CIRCULATION D'UN MATCH N'EST PAS LA TENUE D'UN RONDO. Mesuré avant : 53 % des images en
  // conduite, tenue p90 3,6 s, 84 passes pour 18 reçues (21 %) — « trop de conduite, des passes
  // qui ne suivent pas l'appel » (retour utilisateur, mot pour mot ce que les chiffres disaient).
  settleMin: 0.55,        // s — le ballon récupéré se DOMPTE avant de repartir, même pressé (le
                          // ping-pong des récupérations-éclair de la chasse : 23 passes/min)
  holdCalm: [1.0, 2.2],   // s — on FIXE vraiment avant de donner (0,83 s de tenue mesurée : le
                          // flipper). NOTE mesurée deux fois : l'ALLONGER fait MONTER les passes/min
                          // — la tenue attire le press, la part pressée explose (cycles éclair)
                          // flipper, pas FM) — la conduite et le dribble y gagnent leur place
  intentBarCalm: 4.8,     // la barre d'adoption au calme — assez haute pour qu'on VOIE la tenue
  appelBonus: 2.6,        // le coureur en rupture est SERVI — relevé avec intentBarCalm (4,8) :
                          // au tempo posé, la course doit encore battre la barre d'adoption
  // la mène suit la course : temps d'arrivée estimé (0,4 + d/9, borné 1 s), amorti à 85 % — un
  // ballon DANS la course, pas sur les talons
  leadTime: (d, rec) => Math.min(0.4 + d / 9, 1.0) * ((rec && Math.hypot(rec.v?.[0] ?? 0, rec.v?.[1] ?? 0) > 1.6) ? 0.85 : 0.3),
  speeds: { ...RONDO.speeds, support: 4.9, mark: 5.6, keeper: 6.4, walk: 2.6, chase: 6.4 },  // le soutien OFFENSIF économise ;
                          // walk = le pas de remise ; chase 6,4 : un press de MATCH se soutient
                          // walk = le pas de remise ; chase 6,4 : un press de MATCH se soutient
                          // sur la mi-temps (le 6,9 du duel de rondo poussait les corps à 9,7 km/h)
                          // (10 km/h mesurés, réel 7,2) — mais le MARQUAGE garde son pas : support
                          // 4,9 partagé ralentissait la défense, conversion 71 % mesurée (réel ≤ 35)
  // …et LE CALME SE GAGNE SOUS MARQUAGE LÉGER : holdCalm ne s'appliquait qu'à foeBody > calmFoe
  // du rondo — sur 46 × 30 il y a presque toujours un corps à cette distance, la tenue restait
  // 0,93 s (mesuré). Un joueur de match FIXE avec un marqueur à 2 m ; seul le vrai pressing rushe.
  calmFoe: 1.8,
};

/**
 * makeMatch — l'état d'un match réduit : perTeam joueurs de champ + 1 gardien par équipe, sur un
 * terrain de pitch.js, coup d'envoi à l'équipe 0. L'état EST un état de rondo (mêmes joueurs,
 * même ballon, mêmes personas) : le loop ne voit pas la différence, c'est la config qui la fait.
 */
export function makeMatch({ perTeam = 5, seed = 1, pitch = null, full = false, squads = null } = {}) {
  // LE 11C11 EST UNE CONFIGURATION (full: true → terrain Loi 1, 10 + gardien par équipe, postes
  // de formation) — même loop, mêmes lois, aucune tuyauterie nouvelle : la preuve du moteur.
  pitch = pitch ?? makePitch(full ? FULL : undefined);
  if (full && perTeam === 5) perTeam = 10;
  const st = makeRondo({ perTeam: perTeam + 1, seed, area: [pitch.dims.length, pitch.dims.width] });
  st.full = pitch.dims.length > 60;
  // chaque joueur de champ reçoit SON poste (l'index dans la formation — le 9 reste le 9)
  for (const team of [0, 1]) {
    st.players.filter((q) => q.team === team).forEach((q, i) => { q.post = i; });
  }
  // LES EFFECTIFS NOTÉS (attributes.js — le contrat avec les projets amont) : squads[team][i] =
  // { ratings, look, name, number } appliqué dans l'ordre des joueurs de l'équipe (le DERNIER est
  // le gardien). Sans squads : aucun p.skill, aucun tirage d'erreur — le monde d'aujourd'hui.
  if (squads) {
    for (const team of [0, 1]) {
      const roster = squads[team] ?? [];
      const mine = st.players.filter((q) => q.team === team);
      mine.forEach((q, i) => {
        const spec = roster[i];
        if (!spec) return;
        q.ratings = spec.ratings ?? null;
        q.skill = spec.ratings ? makeProfile(spec.ratings) : null;
        q.look = spec.look ?? null;
        q.name = spec.name ?? q.name;
        q.number = spec.number ?? null;
      });
    }
  }
  st.pitch = pitch;
  st.score = [0, 0];
  st.lastTouch = 0;
  // le DERNIER joueur de chaque équipe devient gardien — un métier, pas un maillot
  for (const team of [0, 1]) {
    const gk = st.players.filter((p) => p.team === team).at(-1);
    gk.keeper = true;
    const g = pitch.ownGoal(team);
    gk.p = [g.x - g.sign * 0.8, 0, 0];
    gk.yaw = Math.atan2(0 - 0, -g.sign);
  }
  // mise en place d'engagement : chaque équipe dans sa moitié (l'équipe 0 défend −x, attaque +x)
  placeKickoff(st, 0);
  st.restart = { type: 'engagement', p: [0, 0], team: 0, at: 0.4, placed: true };   // posé à la construction — la seule pose écrite
  st.ball.restart([0, BALL.radius, 0], { cause: 'engagement' });
  st.phase = 'loose'; st.possession.carrier = -1;
  return st;
}

function placeKickoff(st, kickTeam) {
  const { pitch } = st;
  for (const team of [0, 1]) {
    const sign = pitch.ownGoal(team).sign;                        // le côté DÉFENDU
    const field = st.players.filter((p) => p.team === team && !p.keeper);
    field.forEach((p, i) => {
      const rows = [[0.28, 0], [0.42, -0.28], [0.42, 0.28], [0.62, -0.14], [0.62, 0.14], [0.75, 0]];
      const [fx, fz] = rows[i % rows.length];
      p.p = [sign * pitch.hx * fx, 0, fz * pitch.dims.width];
      // l'engageur : le premier joueur de l'équipe qui engage, au ballon
      if (team === kickTeam && i === 0) p.p = [sign * 1.2, 0, 0.4];
      p.v = [0, 0]; p.yaw = Math.atan2(0 - p.p[2], 0 - p.p[0]);
      p.act = null; p.intent = null; p.down = 0;
    });
    const gk = st.players.find((p) => p.team === team && p.keeper);
    const g = pitch.ownGoal(team);
    gk.p = [g.x - g.sign * 0.8, 0, 0]; gk.v = [0, 0]; gk.act = null; gk.down = 0;
  }
}

/** Les positions d'engagement à REJOINDRE EN MARCHANT — le retour au calme après un but.
 *  placeKickoff écrivait les douze corps (jusqu'à 20 m en une image) ; ici on ne pose que des
 *  CIBLES, et movePlayers fait le trajet. Le preneur — parti chercher le ballon dans le filet —
 *  reçoit la place de l'engageur. */
function kickoffSpots(st, kickTeam, takerId = -1) {
  const { pitch } = st;
  const spots = {};
  for (const team of [0, 1]) {
    const sign = pitch.ownGoal(team).sign;
    const rows = [[0.28, 0], [0.42, -0.28], [0.42, 0.28], [0.62, -0.14], [0.62, 0.14], [0.75, 0]];
    let i = 0;
    for (const p of st.players.filter((q) => q.team === team)) {
      if (p.keeper) { const g = pitch.ownGoal(team); spots[p.id] = [g.x - g.sign * 0.8, 0]; continue; }
      if (team === kickTeam && p.id === takerId) { spots[p.id] = [sign * 1.2, 0.4]; continue; }
      const [fx, fz] = rows[i++ % rows.length];
      spots[p.id] = [sign * pitch.hx * fx, fz * pitch.dims.width];
    }
  }
  return spots;
}

// ---------------------------------------------------------------- l'attribution directionnelle
/**
 * Les rôles du match. La grammaire du rondo (press/cover/mark/support/carry) reste — c'est elle
 * qui a tué l'essaim — mais elle devient DIRECTIONNELLE : le porteur pousse VERS LE BUT (mélange
 * évasion ↔ but selon le surnombre devant), les soutiens tiennent des couloirs ORIENTÉS (deux
 * lanceurs devant, une largeur, un soutien de sécurité), la défense se poste CÔTÉ BUT (le cover
 * coupe la ligne ballon-but, le marquage se met goal-side). Les gardiens vivent leur loi
 * (keeper.js) et déclenchent leur plongeon ici.
 */
function assignMatchJobs(st, cfg) {
  const { pitch } = st;
  const atk = st.possession.team >= 0 ? st.possession.team : st.lastTouch;
  const carrier = st.players[st.possession.carrier] ?? null;
  const anchor = st.ball.p;

  // LE DÉPOSSÉDÉ SE RETOURNE (cfg.lossReact) : mémoriser QUI vient de perdre son ballon — le
  // label passe à l'adversaire ou au sol, le corps est debout. La fenêtre s'applique tout en
  // bas, PAR-DESSUS les postes (un contre-press est un réflexe, pas un poste).
  if (cfg.lossReact) {
    const cNow = st.possession.carrier;
    const prev = st._pcar ?? -1;
    if (prev >= 0 && cNow !== prev) {
      const A = st.players[prev], B = cNow >= 0 ? st.players[cNow] : null;
      if (A && !A.keeper && A.down <= 0 && (!B || B.team !== A.team)) (st._lossAt ??= {})[A.id] = st.t;
    }
    st._pcar = cNow;
  }

  // ---- LA REMISE EN JEU : un monde à part, court et légal
  if (st.restart) {
    const r = st.restart;
    // le rayon des adversaires se tient depuis le BALLON tant qu'il n'est pas posé (le preneur le
    // porte : on s'écarte de LUI), depuis le point de remise ensuite
    const rp = r.placed === false ? [st.ball.p[0], st.ball.p[2]] : r.p;
    for (const p of st.players) {
      // APRÈS UN BUT, ON REVIENT EN MARCHANT : les deux équipes rejoignent leur formation
      // d'engagement pendant que le preneur sort le ballon du filet (placeKickoff écrivait les
      // douze corps — jusqu'à 20 m en une image, mesuré à la sonde des téléports)
      // UNE REMISE EST UNE RESPIRATION : tout le monde MARCHE (bucket walk 2,6 m/s) — on revenait
      // en trottinant à 4,9-5,6 et les corps travaillaient à 10,5 km/h sur la mi-temps
      if (r.spots && r.spots[p.id] && p.id !== r.taker) { p.job = 'walk'; p.target = [r.spots[p.id][0], 0, r.spots[p.id][1]]; continue; }
      if (p.keeper) { const s = keeperSpot(pitch, p.team, [rp[0], 0, rp[1]]); p.job = 'keeper'; p.target = [s.x, 0, s.z]; continue; }
      if (p.id === r.taker) continue;                               // le preneur a son métier (plus bas)
      if (r.type === 'engagement') {
        // chacun DANS SA MOITIÉ (Loi 8) — les positions d'engagement ont été posées ; on les tient
        const sign = pitch.ownGoal(p.team).sign;
        const tx = Math.abs(p.p[0]) < 1 && p.team !== r.team ? sign * 4 : p.p[0];
        p.job = 'walk'; p.target = [tx, 0, p.p[2]];
      } else if (p.team === r.team) {
        p.job = 'walk'; p.target = [r.p[0], 0, r.p[1]];
      } else {
        // l'adversaire TIENT LE RAYON de la remise (Loi 15/16/17 à l'échelle du format)
        const dx = p.p[0] - rp[0], dz = p.p[2] - rp[1];
        const d = Math.hypot(dx, dz);
        p.job = 'walk';
        p.target = d < cfg.restartClear ? [rp[0] + (dx / (d || 1)) * cfg.restartClear, 0, rp[1] + (dz / (d || 1)) * cfg.restartClear] : [p.p[0], 0, p.p[2]];
      }
    }
    // LE PRENEUR EST STICKY (choisi à la sortie, re-choisi seulement s'il tombe) : il va CHERCHER
    // le ballon là où il s'est arrêté, le PORTE au point de remise (ballFetch tient le porté du
    // pas), puis le joue. L'ancien preneur « le plus proche du point » re-triait à chaque image.
    let taker = st.players[r.taker ?? -1] ?? null;
    if (!taker || taker.down > 0 || taker.team !== r.team || taker.keeper) {
      taker = st.players.filter((p) => p.team === r.team && !p.keeper && p.down <= 0)
        .sort((a, b) => d2(a.p, st.ball.p) - d2(b.p, st.ball.p))[0] ?? null;
      r.taker = taker ? taker.id : -1;
    }
    if (taker) {
      taker.job = 'receive';
      // il vise le BALLON (à chercher, ou posé — la prise se joue au rayon du ballon réel), le
      // point de remise seulement pendant qu'il PORTE (le ballon le suit)
      taker.target = r.carried && r.placed === false ? [r.p[0], 0, r.p[1]] : [st.ball.p[0], 0, st.ball.p[2]];
    }
    return;
  }

  // ---- les gardiens (toujours, toutes phases)
  for (const gk of st.players.filter((p) => p.keeper)) {
    gk.job = 'keeper';
    // LE GARDIEN PORTEUR EST UN DISTRIBUTEUR, PAS UN POSTE. Sa loi de position l'a fait marcher
    // vers sa ligne EN PORTANT le ballon — CSC mesuré (graine 3, t=73,95 : « arrêt » puis « but »
    // encaissé par sa propre équipe). Ballon en mains : il s'écarte de son but et le cerveau de
    // passe du loop distribue (choosePass voit ses lanceurs).
    if (carrier && carrier.id === gk.id) {
      const g = pitch.ownGoal(gk.team);
      // LE DISTRIBUTEUR VÉRIFIE SES MAINS : une étiquette de porteur sur un ballon qui FUIT vers
      // son but est un mensonge (le CSC de première touche vivait ici — le gardien « distribuait »
      // en marchant à l'opposé du ballon qui roulait au fond). Pas en mains → on se retourne et
      // on l'étouffe.
      const bdC = Math.hypot(gk.p[0] - st.ball.p[0], gk.p[2] - st.ball.p[2]);
      // …une FUITE est un ballon HORS DE PORTÉE DE TOUCHE (2,2 m) ou filant vers son but — pas
      // la touche de conduite elle-même (0,9 m re-déclenchait la poursuite à CHAQUE touche : le
      // cycle touche→« fuite »→sprint→touche traversait le terrain à 6,5 m/s, 20-43 m mesurés,
      // et resettait le chrono de distribution au passage — la règle des six secondes ne
      // mûrissait jamais).
      if (st.ball.owner !== gk.id && (bdC > 2.2 || st.ball.v[0] * g.sign > 1.5)) {
        gk.job = 'keeper';
        gk.target = [st.ball.p[0] + st.ball.v[0] * 0.25, 0, st.ball.p[2] + st.ball.v[2] * 0.25];
        gk.push = null;
        continue;
      }
      // LE GARDIEN NE DRIBBLE PAS — IL DISTRIBUE. Le push avant constant faisait du porteur-
      // gardien un ATTAQUANT (le cerveau de conduite générique le menait au camp adverse —
      // mesuré : épisodes de 45, 58 et 87 m à ~6,5 m/s, finis en sortie de balle). Sa loi de
      // métier : il se porte sur son SPOT de distribution (devant sa ligne, jamais plus loin)…
      gk.job = 'carry';
      gk.touchF = cfg.carryTight ?? 1;                             // le ballon en mains ne s'échappe pas
      gk._gkSince = gk._gkSince ?? st.t;
      const spotD = [g.x - g.sign * 4.5, Math.max(-3.5, Math.min(3.5, gk.p[2] * 0.4))];
      if (bdC > 0.85) {
        // LE GARDIEN AUSSI PASSE PAR SON BALLON (la loi du porteur, au métier près) : viser le
        // spot en abandonnant le ballon à 2 m gelait le monde — ballon posé, label tenu, press
        // au bord de la surface, distribution jamais armable (épisodes de 73 et 84 s mesurés).
        const toS = [spotD[0] - st.ball.p[0], spotD[1] - st.ball.p[2]];
        const dS = Math.hypot(toS[0], toS[1]) || 1;
        gk.push = [toS[0] / dS, toS[1] / dS];
        gk.target = [st.ball.p[0] + gk.push[0] * 0.4, 0, st.ball.p[2] + gk.push[1] * 0.4];
      } else {
        const toS = [spotD[0] - gk.p[0], spotD[1] - gk.p[2]];
        const dS = Math.hypot(toS[0], toS[1]);
        gk.push = dS > 0.6 ? [toS[0] / dS, toS[1] / dS] : [-g.sign, 0];
        gk.target = [spotD[0], 0, spotD[1]];
      }
      // …ET LA RÈGLE DES SIX SECONDES (Loi 12.2, à l'échelle du réduit : cfg.gkRelease) : le
      // cerveau de passe distribue organiquement quand une ligne s'ouvre ; passé le délai, la
      // distribution est FORCÉE — la meilleure rampe (progression, couloir dégagé), sinon le
      // PUNT au flanc opposé (le dégagement du gardien). Sans échéance, un gardien jamais posé
      // ne passait jamais.
      if (cfg.gkRelease && st.t - gk._gkSince > cfg.gkRelease && !busy(gk) && bdC < 1.1) {
        const sgn = -g.sign;
        const mates = st.players.filter((q) => q.team === gk.team && !q.keeper && q.down <= 0);
        const scored = mates.map((m) => ({ m, s: (m.p[0] - gk.p[0]) * sgn - Math.abs(m.p[2]) * 0.15 }))
          .sort((a, b) => b.s - a.s);
        let served = false;
        for (const { m } of scored.slice(0, 3)) {
          const dm = Math.hypot(m.p[0] - gk.p[0], m.p[2] - gk.p[2]);
          const tI = cfg.leadTime ? cfg.leadTime(dm, m) : 0.35;
          const lead = [m.p[0] + m.v[0] * tI, 0, m.p[2] + m.v[1] * tI];
          if (simInternals.beginPass(st, { to: { id: m.id }, lead, style: dm > 11 ? 'lofted' : 'ground', lane: { margin: dm > 11 ? 8 : 5 } }, cfg, { forceUrgent: true })) { served = true; break; }
        }
        if (!served) {
          const flank = gk.p[2] >= 0 ? -pitch.hz * 0.5 : pitch.hz * 0.5;
          simInternals.beginPass(st, { to: { id: -2 }, lead: [gk.p[0] + sgn * pitch.hx * 0.8, 0, flank], style: 'lofted', clear: true, lane: { margin: 9 } }, cfg, { clear: true, forceUrgent: true });
        }
      }
      continue;
    }
    gk._gkSince = null;
    if (busy(gk)) continue;                                        // un plongeon possède son corps
    const shotAge = st.pass ? st.t - st.pass.t : Infinity;
    // le GARDIEN NOTÉ : son envergure et son réflexe viennent de sa note (keeping) — sinon le métier moyen
    const K = gk.skill ? { ...KEEPER, diveReach: gk.skill.keeperReach, reflex: gk.skill.keeperReflex } : KEEPER;
    // LA SORTIE DANS LES PIEDS : un ballon AU SOL à portée de gants se RAMASSE — même « porté »
    // par un attaquant. Le label de conduite n'est pas un bouclier contre un plongeon dans les
    // pieds : la cueillette ne tournait qu'en phase libre, et 8 buts sans tir sont entrés à
    // 3,5-4,3 m/s DANS LES PIEDS d'un gardien posté à 0,5-2 m sans aucun droit de prise.
    if (cfg.keeperClaim !== false) {
      const own = pitch.ownGoal(gk.team);
      const bd = Math.hypot(gk.p[0] - st.ball.p[0], gk.p[2] - st.ball.p[2]);
      const bSpd = Math.hypot(st.ball.v[0], st.ball.v[2]);
      const towardGoal = st.ball.v[0] * own.sign > 0.5;
      const ownerP = st.ball.owner != null ? st.players[st.ball.owner] : null;
      if (bd < 0.8 && st.ball.p[1] < 1.2 && bSpd < 8 && (towardGoal || bSpd < 2.5)
        && pitch.inBox(st.ball.p[0], st.ball.p[2], own.sign)
        && (!ownerP || ownerP.team !== gk.team)) {
        simInternals.receive(st, gk.id, cfg);
        st.events.push({ t: +st.t.toFixed(2), type: 'arrêt', by: gk.id, mode: 'pieds' });
        continue;
      }
    }
    // la MENACE se lit au dernier contact : un ballon de SA propre équipe se cueille, ne se plonge pas
    const dec = keeperDecide(pitch, gk.team, [gk.p[0], 0, gk.p[2]], st.ball.p, st.ball.v, shotAge, K, st.lastTouch !== gk.team);
    if (dec.mode === 'dive' && gk.down <= 0) {
      const cross = dec.cross;
      // L'ESPÈCE DU PLONGEON SUIT LA HAUTEUR PRÉDITE (cross.y) : un ballon au ras se plonge BAS
      // (hanches au sol, bras rasants — plongeonBas), un ballon levé se plonge en DÉTENTE
      // (l'aérien). Le clip unique aérien laissait l'épaule à 1,2 m sur les rase-mottes.
      const espece = (cross.y ?? 0) < 0.85 ? 'plongeonBas' : 'plongeon';
      const move = { id: espece, duration: MOVES[espece].duration, contact: MOVES[espece].contact };
      const lunge = [(pitch.ownGoal(gk.team).x - gk.p[0]) * 0.2, cross.z - gk.p[2]];
      const L = Math.hypot(lunge[0], lunge[1]) || 1;
      // LE CÔTÉ DU CLIP EST RELATIF AU REGARD RÉEL, pas au monde : « cross.z > gk.z → gauche »
      // était vrai pour un gardien et inversé pour celui d'en face (la moitié des plongeons se
      // jouaient mirrorés à l'envers — clip dessiné À L'OPPOSÉ du corps, hips à 2,5 m, « il
      // plonge du mauvais côté », captures) ; et l'approximation au camp restait fausse dès que
      // le regard suivait le ballon. Le côté est le produit vectoriel regard × détente.
      const fxK = Math.cos(gk.yaw), fzK = Math.sin(gk.yaw);
      const sideFoot = (fxK * (lunge[1] / L) - fzK * (lunge[0] / L)) > 0 ? 'left' : 'right';
      startGesture(gk, move, {
        payload: { kind: 'skill', skill: 'plongeon', ownsBody: true, pick: { foot: sideFoot },
          lunge: [lunge[0] / L, lunge[1] / L], speed: Math.min(6.5, (Math.abs(cross.z - gk.p[2]) / Math.max(0.15, cross.t)) * 1.1), cross,
          // la détente couvre SA distance (l'écart au point d'interception + l'allongé), jamais plus
          // …bornée au ROOT MOTION du bassin (1,35 m — le clip) : l'envergure au-delà est le
          // métier des BRAS (gants à 2,1 par l'IK + warp), pas un corps qui glisse plus loin
          lungeMax: Math.min(1.35, Math.abs(cross.z - gk.p[2]) + 0.2) },
        log: st.gestures,
      });
      gk.yawWant = Math.atan2(st.ball.p[2] - gk.p[2], st.ball.p[0] - gk.p[0]);
      st.events.push({ t: +st.t.toFixed(2), type: 'windup', by: gk.id, move: espece, foot: sideFoot, skill: 'plongeon', anticipation: move.contact });
      st.events.push({ t: +st.t.toFixed(2), type: 'dive', by: gk.id, crossZ: +cross.z.toFixed(2), crossT: +cross.t.toFixed(2) });
      continue;
    }
    // 'battu' n'a pas de spot (l'état honnête) : le gardien se replace quand même sur sa loi
    const s = dec.spot ?? keeperSpot(pitch, gk.team, st.ball.p);
    gk.job = 'keeper'; gk.target = [s.x, 0, s.z];
    gk.yawWant = Math.atan2(st.ball.p[2] - gk.p[2], st.ball.p[0] - gk.p[0]);
  }

  const field = st.players.filter((p) => !p.keeper);
  const attackers = field.filter((p) => p.team === atk);
  const defenders = field.filter((p) => p.team !== atk);
  // LE RECEVEUR ATTAQUE SA PASSE. Le trou fondateur du 21 % de passes reçues : pendant le vol,
  // l'attribution envoyait TOUT LE MONDE aux couloirs — le destinataire trottait vers son slot
  // pendant que le ballon passait à côté de lui. Le cerveau du rondo donnait ce job ; le match
  // l'avait perdu en devenant directionnel.
  const flightRec = (st.phase === 'flight' && st.pass && st.pass.to >= 0) ? st.players[st.pass.to] : null;
  const goal = pitch.attackGoal(atk);
  const own = pitch.ownGoal(atk === 0 ? 1 : 0);                    // le but que la défense protège
  void own;

  // ---- LE BALLON LIBRE EST CHASSÉ PAR LES DEUX CAMPS. Sans porteur ni receveur vivant
  // (dégagement, claquette, contrôle manqué), la formation l'ORBITAIT : les couloirs suivaient
  // l'ancre à offsets fixes et le press visait le point où le ballon N'ÉTAIT DÉJÀ PLUS — mesuré :
  // 14 épisodes ≥ 0,7 s de ballon à > 3 m de tout corps (jusqu'à 2,7 s et 13,8 m de solitude).
  // Le plus proche de chaque camp court à l'INTERCEPTION : une mène de poursuite (~0,7 s de
  // route, bornée au terrain), re-résolue à chaque image — elle converge quand le ballon ralentit.
  const bSpd = Math.hypot(st.ball.v[0], st.ball.v[2]);
  const freeBall = cfg.chaseLoose !== false && !carrier && (st.phase === 'loose' || !st.pass || st.pass.to < 0);
  const leadK = Math.min(6, bSpd * 0.7);
  const leadP = bSpd > 1.5
    ? [Math.max(-pitch.hx + 0.8, Math.min(pitch.hx - 0.8, anchor[0] + (st.ball.v[0] / bSpd) * leadK)),
      Math.max(-pitch.hz + 0.8, Math.min(pitch.hz - 0.8, anchor[2] + (st.ball.v[2] / bSpd) * leadK))]
    : [anchor[0], anchor[2]];
  let hunter = null;
  if (freeBall) {
    hunter = attackers.filter((p) => p.down <= 0).sort((a, b) => d2(a.p, st.ball.p) - d2(b.p, st.ball.p))[0] ?? null;
    if (hunter) {
      // une cueillette SANS course adverse se trotte (bucket support) : le sprint systématique à
      // 6,9 poussait les corps à 9,9 km/h — on ne pique un sprint que si le 50/50 est réel
      const foeD = defenders.filter((q) => q.down <= 0)
        .reduce((m, q) => Math.min(m, Math.hypot(q.p[0] - leadP[0], q.p[2] - leadP[1])), Infinity);
      const myD = Math.hypot(hunter.p[0] - leadP[0], hunter.p[2] - leadP[1]);
      hunter.job = foeD > myD + 2.5 ? 'support' : 'receive';
      hunter.target = [leadP[0], 0, leadP[1]];
    }
  }

  // ---- l'attaque : porteur poussé VERS LE BUT, couloirs orientés
  for (const p of attackers) {
    if (carrier && p.id === carrier.id) {
      p.job = 'carry';
      // LA CONDUITE SERRÉE PAR DÉFAUT : la touche pleine (régime du rondo) ne se sert qu'en
      // rupture NOMMÉE (burst) — en croisière on garde le ballon sous la semelle (touchF 0,62 :
      // ~1,65 m à 6 m/s au lieu de 2,7)
      // …et LA CONDUITE POURSUIVIE COLLE (cfg.carryGuard) : un défenseur à portée de duel
      // (≤ 2,2 m) impose la touche PROTÉGÉE — mesuré avant : en course poursuivie (v > 4,5,
      // foe ≤ 2,5), ballon à p50 1,37 m / 29 % du temps au-delà de 1,5 (« bien trop loin du
      // pied… il devrait être lié à l'attaquant », retour utilisateur). Le burst garde son
      // droit d'allonger UNIQUEMENT libre devant.
      const foeGuard = Math.min(...st.players.filter((q) => q.team !== p.team && !q.keeper && q.down <= 0)
        .map((q) => Math.hypot(q.p[0] - p.p[0], q.p[2] - p.p[2])), 99);
      p.touchF = (p._prepShot ?? -1) > st.t ? (cfg.prepTouchF ?? 0.3)   // la préparation SERRE
        : foeGuard <= 2.2 ? (cfg.carryGuard ?? ((p._pace?.until ?? -1) > st.t ? 1 : (cfg.carryTight ?? 1)))
        : (p._pace?.until ?? -1) > st.t ? 1
        : (cfg.carryTight ?? 1);
      // …et AMORTIT (le canal vitesse de dribble.js) : le ballon se cale sous l'allure du corps.
      // LA CONDUITE PROTÉGÉE AMORTIT AUSSI (guardDamp) : réduire le lead ne suffisait pas —
      // pushSpeed ≥ v, le ballon partait au-dessus de l'allure et l'écart montait au roulement
      // (p50 1,4 m mesuré poursuivi malgré carryGuard) ; amorti, il reste sous le pied.
      // …EN COURSE seulement (v ≥ 4) : à basse allure, amortir sous l'allure créait des
      // excursions LENTES (ballon à 3,6 contre corps à 3 — 4,5 s/min loin mesurés) ; au trot,
      // le lead court du régime protégé suffit
      p.touchDamp = (p._prepShot ?? -1) > st.t ? (cfg.prepDamp ?? 0.72)
        : foeGuard <= 2.2 && p.speed >= 4 ? (cfg.guardDamp ?? 0.88) : 1;
      const ev = evadeSpot(st, p, cfg);
      // L'AILIER À ANGLE FERMÉ REPIQUE DANS L'AXE (le cut-inside) : viser le centre du but depuis
      // le couloir profond mène au poteau de corner — 195 refus « angle-fermé » par lot de matchs
      // mesurés sur l'équipe qui construit par l'aile (l'élite dominait la zone 609 contre 378 et
      // tirait 10-10). Le point de mire devient l'ENTRÉE DE SURFACE côté axe jusqu'à ce que
      // l'angle s'ouvre — le tir, ou le centre, redeviennent des issues.
      const sgnG = Math.sign(goal.x || 1);
      const wideClosed = Math.abs(p.p[2]) > pitch.goalHalf + 3 && p.p[0] * sgnG > pitch.hx - pitch.dims.box.depth - 4;
      // …et le repique choisit selon LA BOÎTE : des coureurs dedans → on reste large et on SERT
      // (le centre) ; boîte vide → on rentre (le repique concurrençait le centre — 6 centres
      // retombés à 2 quand le cut-inside aspirait toutes les ailes)
      const boxXr = pitch.hx - pitch.dims.box.depth;
      const boxMate = wideClosed && st.players.some((q) => q.team === p.team && !q.keeper && q.id !== p.id
        && q.down <= 0 && q.p[0] * sgnG > boxXr - 1.5 && Math.abs(q.p[2]) < pitch.dims.box.width / 2 + 1.5);
      const aim = wideClosed && !boxMate ? [goal.x - sgnG * pitch.dims.box.depth * 0.6, p.p[2] * 0.15] : [goal.x, 0];
      const gx = aim[0] - p.p[0], gz = aim[1] - p.p[2];
      const gl = Math.hypot(gx, gz) || 1;
      // devant dégagé → cap au but ; bouché → l'évasion du rondo garde le ballon
      const front = defenders.filter((q) => Math.sign(q.p[0] - p.p[0]) === Math.sign(gx) && Math.abs(q.p[0] - p.p[0]) < 6 && Math.abs(q.p[2] - p.p[2]) < 4).length;
      const wGoal = front === 0 ? 0.8 : front === 1 ? 0.5 : 0.25;
      let px = (gx / gl) * wGoal, pz = (gz / gl) * wGoal;
      if (ev) { const ex = ev[0] - p.p[0], ez = ev[2] - p.p[2]; const el = Math.hypot(ex, ez) || 1; px += (ex / el) * (1 - wGoal); pz += (ez / el) * (1 - wGoal); }
      const pl = Math.hypot(px, pz) || 1;
      // LA POUSSÉE SE LISSE (EMA τ 0,35 s) : l'évasion re-échantillonnée à 60 Hz faisait
      // zigzaguer la demande — et chaque touche partait sur un cap différent du précédent.
      // Une conduite précise est d'abord une INTENTION stable.
      const raw = [px / pl, pz / pl];
      const a = 1 - Math.exp(-(1 / 60) / 0.35);
      p._pushS = p._pushS ? [p._pushS[0] + (raw[0] - p._pushS[0]) * a, p._pushS[1] + (raw[1] - p._pushS[1]) * a] : raw;
      const sl = Math.hypot(p._pushS[0], p._pushS[1]) || 1;
      p.push = [p._pushS[0] / sl, p._pushS[1] / sl];
      // LE PORTEUR PASSE PAR SON BALLON (cfg.carryViaBall) : la cible de locomotion était la
      // POUSSÉE PROJETÉE — le plan — même quand le ballon réel vivait à 2 m à droite ou DERRIÈRE
      // le corps (captures utilisateur ; mesuré : 5,9 % du porté en course hors du cône avant,
      // 323 images ballon derrière, épisodes de 1,2 s — et la pointe carrySurge ne libérait que
      // la VITESSE : il courait plus vite du mauvais côté). Au-delà de la portée de contrôle, la
      // cible EST le ballon — routé un demi-pas au-delà dans le sens du plan, pour le prendre
      // dans la foulée ; le plan reprend au pied.
      const dBall = Math.hypot(p.p[0] - st.ball.p[0], p.p[2] - st.ball.p[2]);
      if (cfg.carryViaBall !== false && dBall > 0.85) {
        // …et pendant la TOUCHE DE PRÉPARATION, on vise AU TRAVERS du ballon (2,2 m au-delà) :
        // la cible à +0,4 m mettait l'amortissement d'arrivée du contrôleur en équilibre avec la
        // décélération du ballon — bd cloué à 1,2-1,3 m, le pied n'entrait jamais en portée
        // (mesuré : 58 refus 'prépare-frappe' sur une approche, zéro touche serrée). Le vrai
        // geste accélère À TRAVERS le point de touche.
        const over = (p._prepShot ?? -1) > st.t ? 2.2 : 0.4;
        p.target = [st.ball.p[0] + p.push[0] * over, 0, st.ball.p[2] + p.push[1] * over];
      } else {
        p.target = [p.p[0] + p.push[0] * 3, 0, p.p[2] + p.push[1] * 3];
      }
      continue;
    }
    p.push = null;
  }
  // couloirs : deux lanceurs devant-large, une sécurité derrière, le reste en largeur
  if (flightRec && !flightRec.keeper && flightRec.team === atk) {
    flightRec.job = 'receive';
    // LE RECEVEUR ATTAQUE SON BALLON (cfg.meetBall) — la loi du RONDO (interceptPoint sur la
    // trajectoire) que le match avait régressée en point de chute STATIQUE : mesuré, 49 % du vol
    // à < 0,5 m/s et p25 = 0,00 — la statue qui « attend le ballon », et la prise à bout de bras
    // d'un corps planté. Le point de RENCONTRE le plus tôt, re-résolu par image : il VIENT au
    // ballon, et la prise se fait dans le pas.
    // …D'UN PAS VERS LE BALLON, SUR L'AXE DE LA LIVRAISON (cfg.meetZone/meetStep). Deux
    // sur-corrections mesurées et consignées : la rencontre par interceptPoint suivait le vol
    // RÉEL (bruit compris) — chaque receveur corrigeait jusqu'à 4,5 m d'erreur, TOUTE passe
    // aboutissait (0 sortie en 4 matchs, 23-25 passes/min : le flipper par la réception
    // parfaite) ; et la rencontre inconditionnelle l'aspirait vers le press. Le vrai geste :
    // tenir sa position (le placement), puis UN PAS ET DEMI vers le ballon dans les derniers
    // mètres — le corps s'anime, la prise se fait en mouvement, et l'erreur LATÉRALE de la
    // passe continue d'échapper (c'est le football qui garde ses déchets).
    let met = null;
    const dInb = Math.hypot(flightRec.p[0] - st.ball.p[0], flightRec.p[2] - st.ball.p[2]);
    if (cfg.meetBall !== false && dInb < (cfg.meetZone ?? 4.5)) {
      const bx = st.ball.p[0] - st.pass.lead[0], bz = st.ball.p[2] - st.pass.lead[2];
      const bl = Math.hypot(bx, bz);
      if (bl > 0.3) {
        const step = Math.min(cfg.meetStep ?? 1.3, dInb * 0.55);   // il avance ENCORE au contact
        met = [st.pass.lead[0] + (bx / bl) * step, 0, st.pass.lead[2] + (bz / bl) * step];
      }
    }
    flightRec.target = met ?? [st.pass.lead[0], 0, st.pass.lead[2]];
  }
  {
    const sgn = Math.sign(goal.x || 1);
    // L'AILE HAUTE REMPLIT LA SURFACE (« ça manque de centres ») : quand le ballon vit LARGE et
    // HAUT, les couloirs génériques laissaient la boîte vide — personne à servir, aucun centre
    // possible. Les postes deviennent ceux du centre : premier poteau, second poteau, point de
    // penalty, plus la sécurité et le soutien de couloir.
    // …les postes s'arment TÔT (dès l'aile au quart offensif) : le coureur de surface a besoin
    // de sa course — des postes armés au moment du centre arrivent après le ballon
    const wideDeep = Math.abs(anchor[2]) > pitch.hz * 0.38 && anchor[0] * sgn > pitch.hx * 0.25;
    const zs = Math.sign(anchor[2] || 1);
    // …et les postes vivent DEVANT le but, pas SUR la ligne : des coureurs à 2,4-2,8 m de la
    // ligne faisaient de chaque phase d'aile un pinball de goal-mouth (13 buts sans tir mesurés
    // — passes qui traversent, réceptions qui roulent au fond). Premier poteau à l'épaule de la
    // surface de but, second au niveau du penalty.
    const slots = (wideDeep ? [
      [goal.x - sgn * (pitch.dims.six.depth + 1.5), zs * (pitch.goalHalf + 0.6)],  // premier poteau
      [goal.x - sgn * 5.5, -zs * (pitch.goalHalf + 1.2)],                      // second poteau
      [goal.x - sgn * pitch.dims.spot, 0],                                     // le point de penalty
      [anchor[0] - sgn * 7, anchor[2] * 0.5],                                  // la sécurité
      [anchor[0] - sgn * 1.5, zs * pitch.hz * 0.6],                            // le soutien de couloir
    ] : [
      [anchor[0] + sgn * 8, anchor[2] < 0 ? anchor[2] + 6 : anchor[2] - 6],   // lanceur intérieur
      [anchor[0] + sgn * 7, anchor[2] < 0 ? anchor[2] - 5 : anchor[2] + 5],   // lanceur opposé
      [anchor[0] - sgn * 6, anchor[2] * 0.5],                                  // la sécurité
      [anchor[0] + sgn * 2, anchor[2] > 0 ? -pitch.hz * 0.55 : pitch.hz * 0.55], // la largeur
      [anchor[0] + sgn * 4, anchor[2] * -0.6],                                 // second rideau
    ]).map(([x, z]) => [Math.max(-pitch.hx + 1.2, Math.min(pitch.hx - 1.2, x)), Math.max(-pitch.hz + 1.2, Math.min(pitch.hz - 1.2, z))]);
    const free = attackers.filter((p) => (!carrier || p.id !== carrier.id) && p !== flightRec && p !== hunter);
    // EN 11C11 : les couloirs dynamiques sont RÉSERVÉS au soutien rapproché (les 4 plus près de
    // l'ancre) — le reste du monde tient SON poste de formation coulissé (le bloc). Sans ça, les
    // 5 slots du réduit laissaient 5 corps immobiles et l'essaim mangeait la lisibilité.
    let slotters = free, posted = [];
    if (st.full) {
      slotters = [...free].sort((a, b) => d2(a.p, anchor) - d2(b.p, anchor)).slice(0, 4);
      posted = free.filter((p) => !slotters.includes(p));
      const spots = formationSpots(pitch, atk, anchor[0], true);
      for (const p of posted) {
        const want = spots[p.post ?? 0] ?? [p.p[0], p.p[2]];
        p.job = 'support';
        const drift = p._slotT ? Math.hypot(want[0] - p._slotT[0], want[1] - p._slotT[1]) : Infinity;
        if (!p._slotT || drift > 3.5 || ((p._slotAt ?? -1) <= st.t && drift > 0.8)) {
          p._slotT = want; p._slotAt = st.t + 0.7;
        }
        p.target = [p._slotT[0], 0, p._slotT[1]];
      }
    }
    const taken = new Set();
    for (const p of slotters) {
      let best = -1, bd = Infinity;
      for (let i = 0; i < slots.length; i++) {
        if (taken.has(i)) continue;
        const dd = Math.hypot(p.p[0] - slots[i][0], p.p[2] - slots[i][1]);
        if (dd < bd) { bd = dd; best = i; }
      }
      if (best < 0) { p.job = 'support'; p.target = [p.p[0], 0, p.p[2]]; continue; }
      taken.add(best);
      p.job = 'support';
      // L'ÉCONOMIE DU HORS-BALLON : le couloir re-calculé à chaque image suivait l'ancre en
      // continu — huit corps en trottinement-miroir perpétuel (10,1 km/h mesurés, bande ≤ 9,6).
      // Un joueur SE REPLACE PAR À-COUPS CADENCÉS : re-visée au plus toutes les 0,7 s, et
      // seulement si le couloir vaut le pas (0,8 m) — une transition franche (> 3,5 m) part tout
      // de suite. L'hystérésis PURE (2 m sans cadence) gelait le bloc : lignes mortes, tenues à
      // 4,8 s, 2 appels servis sur 45 — le mouvement qui NOURRIT les passes doit vivre.
      const want = [slots[best][0], slots[best][1]];
      const drift = p._slotT ? Math.hypot(want[0] - p._slotT[0], want[1] - p._slotT[1]) : Infinity;
      if (!p._slotT || drift > 3.5 || ((p._slotAt ?? -1) <= st.t && drift > 0.8)) {
        p._slotT = want; p._slotAt = st.t + 0.7;
      }
      p.target = [p._slotT[0], 0, p._slotT[1]];
    }
  }

  // ---- la défense : press sur le ballon, cover CÔTÉ BUT, marquage goal-side
  {
    const defGoal = pitch.ownGoal(atk === 0 ? 1 : 0);
    const byDist = [...defenders].sort((a, b) => d2(a.p, anchor) - d2(b.p, anchor));
    byDist.forEach((p, i) => {
      if (i === 0) {
        // LE GARDIEN EN MAINS EST INATTAQUABLE (futsal Loi 12 à l'échelle : on ne charge pas le
        // gardien dans sa surface) : le press TIENT LE BORD de la surface au lieu de le harceler —
        // sa distribution SE POSE (le harcèlement le forçait à des sorties de balle de flipper,
        // 20,5 passes/min mesurées, la bande futsal s'arrête à 20)
        const gkBall = carrier && carrier.keeper && Math.abs(carrier.p[0]) > pitch.hx - pitch.dims.box.depth
          && Math.sign(carrier.p[0]) === Math.sign(pitch.ownGoal(carrier.team).x);
        if (gkBall) {
          const edge = Math.sign(carrier.p[0]) * (pitch.hx - pitch.dims.box.depth - 0.6);
          p.job = 'press'; p.target = [edge, 0, carrier.p[2] * 0.6];
          return;
        }
        p.job = 'press'; p.target = freeBall ? [leadP[0], 0, leadP[1]] : [anchor[0], 0, anchor[2]]; return;
      }
      if (i === 1) {
        // le cover coupe la ligne ballon → but défendu, au plancher radial du rondo
        const gx = defGoal.x - anchor[0], gz = 0 - anchor[2];
        const gl = Math.hypot(gx, gz) || 1;
        const dd = Math.max(cfg.coverMinDist, Math.min(6, gl * 0.35));
        p.job = 'cover'; p.target = [anchor[0] + (gx / gl) * dd, 0, anchor[2] + (gz / gl) * dd];
        return;
      }
      // EN 11C11 : quatre marqueurs suffisent — le reste tient le BLOC défensif à son poste
      // (un marquage de dix serait un essaim ; un bloc qui coulisse est une défense lisible)
      if (st.full && i >= 6) {
        const spotsD = formationSpots(pitch, p.team, anchor[0], false);
        const want = spotsD[p.post ?? 0] ?? [p.p[0], p.p[2]];
        p.job = 'mark';
        const drift = p._slotT ? Math.hypot(want[0] - p._slotT[0], want[1] - p._slotT[1]) : Infinity;
        if (!p._slotT || drift > 3.5 || ((p._slotAt ?? -1) <= st.t && drift > 0.8)) {
          p._slotT = want; p._slotAt = st.t + 0.7;
        }
        p.target = [p._slotT[0], 0, p._slotT[1]];
        return;
      }
      // marquage : l'attaquant libre le plus proche, un pas CÔTÉ BUT — re-visé PAR À-COUPS
      // (0,5 s / 0,8 m, rupture immédiate > 3 m) : le miroir-suivi continu faisait travailler
      // les marqueurs à 3,47 m/s de moyenne (2,7 des 9,8 km/h mesurés) et une défense qui
      // vibre en continu ne ressemble pas à un BLOC qui tient ses lignes
      const marks = attackers.filter((a) => !carrier || a.id !== carrier.id);
      const m = marks.sort((a, b) => d2(a.p, p.p) - d2(b.p, p.p))[i - 2 < marks.length ? Math.min(i - 2, marks.length - 1) : 0] ?? null;
      if (!m) { p.job = 'mark'; p.target = [p.p[0], 0, p.p[2]]; return; }
      const gx = defGoal.x - m.p[0], gz = 0 - m.p[2];
      const gl = Math.hypot(gx, gz) || 1;
      p.job = 'mark';
      const want = [m.p[0] + (gx / gl) * 1.4, m.p[2] + (gz / gl) * 1.4];
      const drift = p._markT ? Math.hypot(want[0] - p._markT[0], want[1] - p._markT[1]) : Infinity;
      if (!p._markT || drift > 3 || ((p._markAt ?? -1) <= st.t && drift > 0.8)) {
        p._markT = want; p._markAt = st.t + 0.5;
      }
      p.target = [p._markT[0], 0, p._markT[1]];
    });
  }

  // …ET LA FENÊTRE DU CONTRE-PRESS S'APPLIQUE EN DERNIER, par-dessus les postes : pendant
  // cfg.lossReact s après sa perte, l'ex-porteur CHASSE son ballon. Sans elle, il redevenait
  // coureur de slot À L'INSTANT de la perte et partait DOS au ballon (mesuré : 92 des 254
  // pertes suivies d'une course ≥ 3 m à > 60° du ballon, p90 4,9 m — « ils perdent un peu le
  // ballon et courent toujours tout droit », retour utilisateur). La chasse s'éteint dès que
  // son équipe reprend, ou à la mort de la fenêtre.
  if (cfg.lossReact && st._lossAt) {
    for (const idS of Object.keys(st._lossAt)) {
      const id = +idS, la = st._lossAt[id], p = st.players[id];
      if (!p || st.t - la > cfg.lossReact) { delete st._lossAt[id]; continue; }
      const ownerNow = st.possession.carrier >= 0 ? st.players[st.possession.carrier] : null;
      if (ownerNow && ownerNow.team === p.team) { delete st._lossAt[id]; continue; }
      if (p.down > 0 || busy(p) || st.possession.carrier === p.id) continue;
      // …et un joueur DÉJÀ en chasse garde sa cible (le chasseur de chaseLoose porte la MÈNE
      // interceptPoint — l'écraser par le ballon-immédiat a rendu la fixture orbite aveugle :
      // +2,1 m dans les deux bras, mesuré) ; le contre-press ne re-cible que le coureur de slot
      if (p.job === 'press' || p.job === 'intercept') continue;
      p.job = 'press';
      p.target = [st.ball.p[0] + st.ball.v[0] * 0.25, 0, st.ball.p[2] + st.ball.v[2] * 0.25];
      p.push = null;
    }
  }
}

// ---------------------------------------------------------------- le tir
/**
 * LE TIR — le geste qui manquait au vocabulaire. Conditions : à portée (shotRange du centre du
 * but), le couloir vers le coin visé est dégagé (laneClearance, GARDIEN EXCLU — c'est lui qu'on
 * défie), et le coin est choisi CONTRE le gardien réel (le plus loin de son z). Le refus se nomme.
 */
function tryShot(st, c, cfg) {
  if (c.keeper) return false;
  const { pitch } = st;
  const goal = pitch.attackGoal(c.team);
  const dGoal = Math.hypot(goal.x - c.p[0], 0 - c.p[2]);
  if (dGoal > cfg.shotRange) return false;
  if (st.hold < cfg.shotHold) return false;
  if (Math.sign(c.p[0] - 0) !== Math.sign(goal.x) && dGoal > cfg.shotRange * 0.75) return false; // pas de sa moitié
  // L'ANGLE FERMÉ N'EST PAS UN TIR, C'EST UN CENTRE RATÉ : l'aile voyait 15 m de « portée » et
  // canonnait du couloir (0 centre mesuré — tryShot passait toujours avant tryCross). Au-delà de
  // l'épaule de la surface et hors du bout portant, le refus se nomme et l'aile SERT.
  if (Math.abs(c.p[2]) > pitch.goalHalf + 3 && dGoal > 8.5) return deny(st, 'angle-fermé');
  const gk = st.players.find((p) => p.keeper && p.team !== c.team);
  // les DEUX coins s'essaient, le plus loin du gardien d'abord — et à bout portant, on tire dans
  // le trafic (0,75 m de couloir n'existait jamais devant une défense postée côté but : 135 refus,
  // 0 tir en 90 s — un tir contré est du football, un attaquant muet n'en est pas)
  const corners = [pitch.goalHalf - 0.55, -(pitch.goalHalf - 0.55)]
    .sort((a, b) => (gk ? Math.abs(b - gk.p[2]) - Math.abs(a - gk.p[2]) : 0));
  const blockers = st.players.filter((q) => q.team !== c.team && !q.keeper && q.down <= 0).map((q) => q.p);
  const need = dGoal < 9 ? Math.min(cfg.shotClear, 0.3) : cfg.shotClear;
  let tz = null, margin = -1;
  for (const cz of corners) {
    const clr = laneClearance([st.ball.p[0], 0, st.ball.p[2]], [goal.x, 0, cz], blockers);
    const m = clr.margin ?? clr;
    if (m > margin) { margin = m; if (m >= need) { tz = cz; break; } }
  }
  if (tz == null) return deny(st, 'tir-couloir-fermé');
  // LA TOUCHE DE PRÉPARATION (cfg.prepTouch) : le ballon de course vit à 1,2-1,4 m — un poil
  // AU-DELÀ de la portée d'armement des techniques de frappe. Sans cette loi, le tir tentait et
  // se faisait refuser 'technique' EN BOUCLE (146 refus sur une seule course mesurés) jusqu'à
  // s'empaler sur le gardien (11 approches < 4 m, 0 tir). Le vrai footballeur SERRE sa dernière
  // touche avant la frappe : fenêtre de préparation posée sur le porteur (le régime de touche la
  // lit : touchF ≈ 0,3), l'ancre rafraîchie pour que le retour du ballon se POSSÈDE — au pas où
  // le ballon est au pied, la frappe arme.
  const bdShot = Math.hypot(c.p[0] - st.ball.p[0], c.p[2] - st.ball.p[2]);
  if (cfg.prepTouch !== false && bdShot > 0.95) {
    c._prepShot = st.t + 0.9;
    c.anchorHint = { t: st.t };
    return deny(st, 'prépare-frappe');
  }
  // LE RÉPERTOIRE DU TIR (« les frappes manquent de peps et de diversité ») : l'espèce se choisit
  // sur la GÉOMÉTRIE (près → on place, loin → on arme) + un tirage seedé + la note (une petite
  // dispersion de finition ose la lucarne). L'élévation se calcule balistiquement pour la hauteur
  // visée au plan du but — le gardien garde ses lois (gather ≤ 1,9 m, gant ≤ 2,1 m : une lucarne
  // à 1,7 m est un arrêt de grande envergure, pas un but gratuit).
  let shotKind = null;
  if (cfg.shotVariety !== false) {
    const u = (st.rnd ?? (() => 0.5))();
    const fin = c.skill ? Math.max(0, Math.min(1, (0.9 - c.skill.shotSigma) / 0.9)) : 0.5;
    const elevFor = (yT, v) => Math.min(0.32, (yT + 4.9 * (dGoal / v) * (dGoal / v)) / Math.max(1, dGoal));
    if (dGoal < 8.5) {
      shotKind = u < 0.55 ? { id: 'placé', speed: 16.5, elev: 0.05 }
        : u < 0.8 ? { id: 'croisé', speed: 18, elev: 0.03 }
        : { id: 'puissance', speed: 21, elev: 0.08 };
    } else {
      const pLuc = 0.08 + 0.12 * fin;
      shotKind = u < 0.48 ? { id: 'puissance', speed: 21.5, elev: 0.09 }
        : u < 0.76 ? { id: 'mi-hauteur', speed: 19, elev: elevFor(1.1, 19) }
        : u < 0.76 + pLuc ? { id: 'lucarne', speed: 19.5, elev: elevFor(1.7, 19.5) }
        : { id: 'placé', speed: 17.5, elev: 0.05 };
    }
  }
  const choice = {
    to: { id: -2 }, lead: [goal.x, 0, tz], style: 'ground', shot: true, shotKind,
    lane: { margin: +margin.toFixed(2) },
    shotInfo: { range: +dGoal.toFixed(2), tz: +tz.toFixed(2), gkZ: gk ? +gk.p[2].toFixed(2) : null },
  };
  return simInternals.beginPass(st, choice, cfg, { shot: true });
}

/** Un refus a une cause nommée (copie locale du registre du loop). */
function deny(st, cause) { (st.deny ??= {})[cause] = (st.deny[cause] ?? 0) + 1; return false; }

// ---------------------------------------------------------------- le centre
/**
 * LE CENTRE (« ça manque de centres ») — l'aile qui ne peut pas tirer SERT la surface : porteur
 * LARGE (couloir) et HAUT (approche du dernier tiers), au moins une cible dans la boîte, le
 * ballon enveloppe la défense par le HAUT (style lofted — le couloir au sol n'est pas requis,
 * c'est le point du centre). La mène vise la COURSE du coureur de surface, tirée vers le point
 * de penalty / second poteau. Cooldown d'équipe : le centre est une arme, pas une boucle.
 */
function tryCross(st, c, cfg) {
  if (c.keeper) return false;
  const { pitch } = st;
  const goal = pitch.attackGoal(c.team);
  const sgn = Math.sign(goal.x || 1);
  if (c.p[0] * sgn < pitch.hx - pitch.dims.box.depth - 9) return false;   // pas assez haut
  if (Math.abs(c.p[2]) < pitch.hz * 0.38) return false;                    // pas dans le couloir
  if (st.hold < 0.25) return false;
  if ((st._crossCd?.[c.team] ?? -1) > st.t) return false;
  const boxX = pitch.hx - pitch.dims.box.depth;
  const inBox = st.players.filter((q) => q.team === c.team && !q.keeper && q.id !== c.id && q.down <= 0
    && q.p[0] * sgn > boxX - 1.5 && Math.abs(q.p[2]) < pitch.dims.box.width / 2 + 1.5);
  if (!inBox.length) return false;
  // la cible : le coureur le plus proche du POINT DE CHUTE utile (second poteau / penalty, côté
  // opposé au centreur — là où un centre fait mal)
  const spotZ = -Math.sign(c.p[2] || 1) * Math.max(2.0, pitch.goalHalf + 0.8);
  const spot = [goal.x - sgn * Math.max(3.5, pitch.dims.spot * 0.7), spotZ];
  const rec = inBox.sort((a, b) => Math.hypot(a.p[0] - spot[0], a.p[2] - spot[1]) - Math.hypot(b.p[0] - spot[0], b.p[2] - spot[1]))[0];
  const tI = cfg.leadTime ? cfg.leadTime(Math.hypot(rec.p[0] - c.p[0], rec.p[2] - c.p[2]), rec) : 0.35;
  let lead = [rec.p[0] + rec.v[0] * tI, 0, rec.p[2] + rec.v[1] * tI];
  // …tirée vers le point utile (le centre arrive DEVANT le coureur, côté but)
  lead = [lead[0] + (spot[0] - lead[0]) * 0.4, 0, lead[2] + (spot[1] - lead[2]) * 0.4];
  lead = [Math.max(-pitch.hx + 1.2, Math.min(pitch.hx - 1.2, lead[0])), 0,
    Math.max(-pitch.hz + 1.2, Math.min(pitch.hz - 1.2, lead[2]))];
  // un centre PART quand la fenêtre s'ouvre (même régime d'urgence que le dégagement). L'ESSAI
  // CONSIGNÉ : le centre-intention (décider → préparer → s'engager) posait 6 intentions / 4
  // matchs et n'en exécutait AUCUNE — l'intention injectée en plein dribble d'aile ne trouve pas
  // ses portes (ballon-vif entre les touches serrées) dans son TTL ; l'approche pilotée du
  // centre est au backlog nommé. Le départ immédiat servait 6 centres — le monde mesuré le
  // meilleur.
  const r = simInternals.beginPass(st, { to: { id: rec.id }, lead, style: 'lofted', cross: true, lane: { margin: 9 } }, cfg, { forceUrgent: true });
  if (r) (st._crossCd ??= {})[c.team] = st.t + 5;
  return r;
}

// ---------------------------------------------------------------- la sortie et les remises
/**
 * LA SORTIE DE BALLE, par la RÈGLE (pitch.outRule au point de franchissement interpolé).
 * But → score + engagement ; touche/corner/sortie de but → remise placée, adversaires au rayon.
 */
function onOut(st, cfg) {
  const { pitch } = st;
  // une sortie déjà ADMINISTRÉE ne se rejuge pas : le ballon vit dehors (freiné, puis porté au
  // point de remise) — sans cette garde, la règle re-tirerait une sortie à chaque image
  if (st.restart) return true;
  const p0 = st._ballPrev ?? st.ball.p;
  const r = outRule(pitch, p0, st.ball.p, st.lastTouch);
  // LE BALLON NE SE TÉLÉPORTE PAS À LA REMISE. Il est FREINÉ là où il sort (la lisse, le filet,
  // la main du ramasseur — un contact, pas une écriture), puis le PRENEUR vient le chercher et le
  // PORTE au point de remise (ballFetch). Mesuré avant : 12 sauts de 4,7 à 23 m en une image sur
  // 4 matchs — « des ballons se déplacent sans joueur à proximité » (retour utilisateur).
  const brake = (keep) => {
    st.ball.release('sortie');
    st.ball.impulse([-st.ball.v[0] * (1 - keep), 0, -st.ball.v[2] * (1 - keep)]);
  };
  const nearTaker = (team) => {
    const t = st.players.filter((p) => p.team === team && !p.keeper && p.down <= 0)
      .sort((a, b) => d2(a.p, st.ball.p) - d2(b.p, st.ball.p))[0];
    return t ? t.id : -1;
  };
  const carried = cfg.restartCarried !== false;
  if (!r) {
    // sécurité : ballon dehors sans franchissement lisible (segment dégénéré) — remise en touche
    // au point le plus proche, et le cas se COMPTE au registre (il doit rester exceptionnel)
    deny(st, 'sortie-illisible');
    const x = Math.max(-pitch.hx + 1, Math.min(pitch.hx - 1, st.ball.p[0]));
    const z = Math.sign(st.ball.p[2] || 1) * (pitch.hz - 0.15);
    st.restart = { type: 'touche', p: [x, z], team: 1 - st.lastTouch, at: st.t + cfg.restartWait };
    if (carried) { brake(0.35); st.restart.placed = false; st.restart.taker = nearTaker(st.restart.team); }
    else st.ball.restart([x, BALL.radius, z], { cause: 'touche' });
    st.phase = 'loose'; st.possession.carrier = -1; st.pass = null; st.hold = 0; st.pressure = 0;
    return true;
  }
  if (r.type === 'but') {
    st.score[r.scorer] += 1;
    st.events.push({ t: +st.t.toFixed(2), type: 'but', team: r.scorer, score: [...st.score] });
    st.restart = { type: 'engagement', p: [0, 0], team: r.team, at: st.t + cfg.restartWait + 0.6 };
    if (carried) {
      // le filet mange la vitesse ; un joueur de l'équipe qui engage vient sortir le ballon du
      // but et le porte au rond central pendant que les deux équipes REVIENNENT EN MARCHANT
      brake(0.15);
      st.restart.placed = false;
      st.restart.taker = nearTaker(r.team);
      st.restart.spots = kickoffSpots(st, r.team, st.restart.taker);
    } else {
      placeKickoff(st, r.team);
      st.ball.restart([0, BALL.radius, 0], { cause: 'engagement' });
    }
  } else {
    st.events.push({ t: +st.t.toFixed(2), type: 'sortie', out: r.type, team: r.team, p: [+r.x.toFixed(1), +r.z.toFixed(1)] });
    st.restart = { type: r.type, p: [r.x, r.z], team: r.team, at: st.t + cfg.restartWait };
    if (carried) { brake(0.35); st.restart.placed = false; st.restart.taker = nearTaker(r.team); }
    else st.ball.restart([r.x, BALL.radius, r.z], { cause: r.type });
  }
  st.phase = 'loose'; st.possession.carrier = -1; st.pass = null; st.hold = 0; st.pressure = 0;
  for (const p of st.players) if (p.act && winding(p)) p.act = null;   // une remise annule les armés
  return true;
}

/** Qui a le droit de prendre le ballon ? Pendant une remise : l'équipe de la remise, à l'heure,
 *  et JAMAIS avant que le ballon soit POSÉ au point de remise (la remise portée a son trajet). */
function canTake(st, takerId) {
  if (!st.restart) return true;
  const p = st.players[takerId];
  if (st.restart.placed === false) return false;
  if (st.t < st.restart.at - 0.25) return false;
  if (p.team !== st.restart.team) return false;
  st.restart = null;                                               // la remise est PRISE — le jeu reprend
  st.events.push({ t: +st.t.toFixed(2), type: 'restart-pris', by: takerId });
  return true;
}

/**
 * LE PORTÉ DE LA REMISE — le pas du ballon libre, délégué par le loop (hook ballFetch, no-op au
 * rondo). Tant que la remise n'est pas posée : le preneur RAMASSE le ballon là où il a fini de
 * rouler (possession déclarée au corps du ballon), le porte AU PIED jusqu'au point de remise,
 * et le POSE (release à cause nommée + rest) — zéro discontinuité, le registre du BallBody en
 * témoigne. Renvoie true quand le porté a fait avancer le ballon (le loop ne double-intègre pas).
 */
function ballFetch(st, dt) {
  const r = st.restart;
  if (!r || r.placed !== false) return false;
  const tk = st.players[r.taker ?? -1];
  if (!tk || tk.down > 0) return false;
  const bp = st.ball.p;
  if (!r.carried) {
    // LA LISSE EST UN MUR : au-delà du tablier (1,2 m derrière la ligne), le ballon meurt contre
    // la palissade — AUSSI en vol (la garde « au sol seulement » laissait un dégagement aérien
    // atterrir à 3,1 m dehors, hors du tablier des corps ET du bras tendu : gel mesuré graine 3,
    // sortie jamais reprise). Un CONTACT (impulse), pas une écriture ; la gravité fait retomber.
    const outX = Math.abs(bp[0]) - st.pitch.hx, outZ = Math.abs(bp[2]) - st.pitch.hz;
    if ((outX > 1.2 || outZ > 1.2) && Math.hypot(st.ball.v[0], st.ball.v[2]) > 0.3) {
      st.ball.impulse([-st.ball.v[0], 0, -st.ball.v[2]]);
    }
    // pas encore à lui : le ballon FINIT DE ROULER (physique), le preneur marche dessus — et si
    // la QUÊTE échoue 2 s (au contact mais géométrie surprise), il TEND LE BRAS : le bras suivait
    // l'horloge de la remise (at + 5), le gel vivait dans l'intervalle
    if (r._fetchT0 == null) r._fetchT0 = st.t;
    const reach = st.t - r._fetchT0 > 2 ? 2.2 : 0.85;
    const close = Math.hypot(tk.p[0] - bp[0], tk.p[2] - bp[2]) < reach;
    const slow = Math.hypot(st.ball.v[0], st.ball.v[2]) < 3.5 && bp[1] < 1.2;
    if (close && slow && st.ball.owner == null) { st.ball.possess(tk.id); r.carried = true; }
    return false;
  }
  if (st.ball.owner !== tk.id) {
    // perdu en route (preneur au sol re-choisi, contact) — l'état se nomme et la quête reprend
    st.ball.release('perte');
    r.carried = false;
    return false;
  }
  // la pose est SERRÉE (0,12 m) : posé à 0,22 m du point pendant que le preneur s'amortit sur LE
  // POINT, l'écart cumulé dépassait le rayon de prise — touche gelée 58 s, mesuré graine 3
  const atSpot = Math.hypot(bp[0] - r.p[0], bp[2] - r.p[1]) < 0.12;
  if (atSpot && bp[1] <= BALL.radius + 0.02) {
    st.ball.release('arrêt-de-jeu');
    st.ball.rest();
    r.placed = true;                                               // posé : canTake ouvrira à l'heure
    return false;
  }
  // au pied, cap sur le point de remise (droit sur le point quand on y est presque)
  const dSpot = Math.hypot(tk.p[0] - r.p[0], tk.p[2] - r.p[1]);
  const ux = (r.p[0] - tk.p[0]) / (dSpot || 1), uz = (r.p[1] - tk.p[2]) / (dSpot || 1);
  // …porté DEVANT LES PIEDS (0,6 m), pas sous le corps : à 0,35 m le ballon vivait entre les
  // pieds du marcheur et chaque foulée l'ENJAMBAIT — l'œil lisait des passements de jambes en
  // boucle sur le retour d'engagement (retour utilisateur, confirmé : un artefact, pas un geste)
  // …0,75 visé avec un servo vif : le ballon poursuit un point qui AVANCE — au tau 0,06 il
  // traînait à ~0,3 du corps (le retard du servo), de nouveau sous les pieds du marcheur
  const aim = dSpot < 0.9 ? [r.p[0], r.p[1]] : [tk.p[0] + ux * 0.75, tk.p[2] + uz * 0.75];
  st.ball.carry(aim, dt, { tau: 0.045 });
  return true;
}

// ---------------------------------------------------------------- l'arrêt du gardien
/**
 * LE CONTACT DU PLONGEON. La géométrie du contact décide — pas celle du déclenchement : ballon
 * dans les gants (≤ 1,1 m) → PRISE (possession gardien, le jeu repart de lui) ; à bout de gants
 * (≤ 1,7 m) → CLAQUETTE (dévié, dampé, côté) ; sinon le plongeon est BATTU et se nomme.
 * Dans tous les cas le gardien paie : au sol (keeperDown).
 */
function onDive(st, gk, cfg) {
  // appelé CHAQUE IMAGE de la détente (rondo-sim, skillFollowStep) : renvoie true quand le gant a
  // résolu le ballon (prise ou claquette) — false tant qu'il passe hors de portée
  const d = Math.hypot(gk.p[0] - st.ball.p[0], gk.p[2] - st.ball.p[2]);
  const y = st.ball.p[1] ?? 0;
  if (d > 1.7 || y > 2.1) { if (gk.act?.payload) gk.act.payload._pd = d; return false; }
  // LE GANT TOUCHE AU PLUS PRÈS : résoudre au PREMIER franchissement du rayon claquait le ballon
  // à 1,5-1,7 m des mains — l'arrêt vrai en sim, faux aux gants (mesuré au composé : gant à
  // 1,0-2,1 m du ballon à l'instant de l'arrêt, p50 1,67 — aucune anatomie de bras ne couvre ça).
  // Tant que le ballon SE RAPPROCHE encore, le contact attend l'approche minimale ; le warp du
  // gant (strike-warp, plan 3D) fait le reste du chemin visuel.
  const pd = gk.act?.payload?._pd ?? Infinity;
  const closing = d < pd - 1e-4;
  if (gk.act?.payload) gk.act.payload._pd = d;
  if (closing && d > 0.35) return false;
  gk.down = Math.max(gk.down, cfg.keeperDown);
  if (d <= 1.1 && y <= 1.9) {
    if (st.ball.owner != null) st.ball.release('perte');
    st.ball.impulse([-st.ball.v[0], -st.ball.v[1] * 0.9, -st.ball.v[2]]);      // mort dans les gants
    st.ball.possess(gk.id);
    st.possession = { team: gk.team, carrier: gk.id };
    st.phase = 'carry'; st.pass = null; st.hold = 0; st.pressure = 0;
    st.lastTouch = gk.team;
    st.events.push({ t: +st.t.toFixed(2), type: 'arrêt', by: gk.id, mode: 'prise' });
    return true;
  } else {
    const side = Math.sign(gk.p[2] - 0) || 1;
    st.ball.impulse([-st.ball.v[0] * 1.4, -st.ball.v[1] * 0.6 + 1.5, -st.ball.v[2] * 0.6 + side * 3.5]);
    st.lastTouch = gk.team;
    // APRÈS LE GANT, LE BALLON EST NEUF : st.pass gardait l'origine du tir, et la porte
    // anti-auto-interception (gone > releaseClear) ne s'ouvrait JAMAIS sur un ballon claqué
    // retombé à 2 m de cette origine — MESURÉ : gel intégral de 111 s (dernier événement t=8,45,
    // fin de match t=120, personne n'a le DROIT de toucher un ballon mort). Le rondo ne pouvait
    // pas le produire (une frappe voyage) ; la claquette, si.
    st.pass = null;
    st.events.push({ t: +st.t.toFixed(2), type: 'arrêt', by: gk.id, mode: 'claquette' });
    st._surprise = { t: st.t, seen: 0 };                          // une claquette ne s'anticipe pas
    return true;
  }
}

// ---------------------------------------------------------------- l'assemblage
/** LE DÉGAGEMENT — sous siège dans son propre tiers, on met le ballon loin et haut, vers un
 *  flanc : imprécis PAR NATURE (accuracy 0,3 dans la table — un dégagement rend souvent un
 *  50/50), mais il sort l'équipe de l'étau. Cooldown d'équipe : un dégagement est un soupir,
 *  pas un style de jeu. */
function tryClear(st, c, cfg) {
  const { pitch } = st;
  if (c.keeper) return false;
  const own = pitch.ownGoal(c.team);
  const depth = (c.p[0] - own.x) * -own.sign;                      // profondeur depuis SA ligne
  if (depth > pitch.hx * 0.66) return false;                       // pas dans son tiers : on joue
  if ((st._clearCd?.[c.team] ?? -1) > st.t) return false;
  // l'étau se lit aux CORPS, pas à la minuterie de duel (st.pressure ne s'accumule qu'en
  // conteste installé — l'équipe épinglée était taclée avant) : deux corps à 2,6 m, ou un seul
  // mais collé (1,4 m) profond dans le tiers
  const near = st.players.filter((q) => q.team !== c.team && q.down <= 0 && d2(q.p, c.p) < 2.6).length;
  const glued = st.players.some((q) => q.team !== c.team && q.down <= 0 && d2(q.p, c.p) < 1.4);
  if (!(near >= 2 || (glued && depth < pitch.hx * 0.45))) return false;
  const sgn = -own.sign;                                           // vers l'avant
  const flank = c.p[2] >= 0 ? -pitch.hz * 0.55 : pitch.hz * 0.55;  // le flanc OPPOSÉ à la mêlée
  const lead = [c.p[0] + sgn * pitch.hx * 0.85, 0, flank];
  const r = simInternals.beginPass(st, { to: { id: -2 }, lead, style: 'lofted', clear: true, lane: { margin: 9 } }, cfg, { clear: true, forceUrgent: true });
  if (r) (st._clearCd ??= {})[c.team] = st.t + 6;
  return r;
}

/** LE SENS DU JEU — le terme de progression du choix de passe. Une passe qui gagne des mètres
 *  vers le but adverse vaut plus qu'une latérale, à sûreté égale ; une remise en retrait n'est
 *  pas interdite (elle garde 'clearance is king'), elle coûte juste son recul. Borné : la
 *  progression n'écrase jamais la sécurité (pente 0,22/m, plafond ±3). */
function passBias(st, c, o) {
  const goal = st.pitch.attackGoal(c.team);
  const gain = Math.sign(goal.x) * (o.lead[0] - st.ball.p[0]);
  return Math.max(-3, Math.min(3, gain * 0.22));
}

export function matchCfg(overrides = {}) {
  return { ...MATCH, assignJobs: assignMatchJobs, tryShot, tryCross, tryClear, onOut, onDive, canTake, passBias, ballFetch, ...overrides };
}

/** Avance le match d'un pas — le game-loop du rondo, configuré match. */
export function matchStep(st, dt, cfg = matchCfg()) {
  // le dernier contact d'équipe : le porteur en carry, le frappeur en vol (st.lastPasser)
  if (st.phase === 'carry' && st.possession.carrier >= 0) st.lastTouch = st.players[st.possession.carrier].team;
  else if (st.phase === 'flight' && st.lastPasser >= 0) st.lastTouch = st.players[st.lastPasser].team;
  const prev = [st.ball.p[0], st.ball.p[1], st.ball.p[2]];
  rondoStep(st, dt, cfg);
  st._ballPrev = prev;
  return st;
}

/** Joue `seconds` de match, trace échantillonnée comme playRondo (mêmes clauses possibles). */
export function playMatch(st, seconds, { dt = 1 / 60, cfg = matchCfg(), sample = 6 } = {}) {
  const trace = [];
  const n = Math.round(seconds / dt);
  for (let i = 0; i < n; i++) {
    matchStep(st, dt, cfg);
    if (i % sample === 0) {
      trace.push({
        t: +st.t.toFixed(2), phase: st.phase, team: st.possession.team, carrier: st.possession.carrier,
        score: [...st.score], restart: st.restart ? st.restart.type : null,
        ball: [+st.ball.p[0].toFixed(2), +st.ball.p[1].toFixed(2), +st.ball.p[2].toFixed(2)],
        players: st.players.map((p) => ({ id: p.id, team: p.team, job: p.job, keeper: !!p.keeper, p: [+p.p[0].toFixed(2), +p.p[2].toFixed(2)], speed: +p.speed.toFixed(2), down: +p.down.toFixed(2) })),
      });
    }
  }
  return { st, trace };
}

/**
 * CONTRAT DU MATCH. Par-dessus la santé du loop (pas de téléport, pas d'essaim — checkRondo les
 * tient), les façons dont un MATCH redevient un rondo décoré : personne ne tire, un score qui ne
 * correspond pas aux buts, des sorties sans remise nommée, un gardien qui erre loin de son but,
 * des remises volées par l'adversaire, un jeu qui ne progresse jamais vers les buts.
 */
export function checkMatch(st, trace, cfg = matchCfg()) {
  const issues = [];
  const evs = st.events ?? [];
  const shots = evs.filter((e) => e.type === 'shot');
  const buts = evs.filter((e) => e.type === 'but');
  const sorties = evs.filter((e) => e.type === 'sortie');
  const prises = evs.filter((e) => e.type === 'restart-pris');
  if (st.score[0] !== buts.filter((b) => b.team === 0).length || st.score[1] !== buts.filter((b) => b.team === 1).length) {
    issues.push(`score [${st.score}] ≠ événements de but (${buts.map((b) => b.team).join(',')})`);
  }
  // un 0 tir sur une tranche courte est du VRAI football (des mi-temps finissent 0-0) — le
  // défaut, c'est des OCCASIONS sans tir : le ballon a vécu dans le dernier tiers et personne
  // n'a appuyé. Sans visite du tiers, le silence est légitime (la clause des camps veille déjà).
  // …et une OCCASION est le ballon dans la zone QUE JE VISE pendant que JE l'ai : l'instrument
  // comptait la présence DÉFENSIVE dans sa propre surface (une équipe épinglée qui dégage) et le
  // ballon GARÉ des remises comme des occasions d'attaque — deux ombres (loi 8)
  const thirdVisits = trace.filter((s) => !s.restart && s.team >= 0
    && s.ball[0] * (s.team === 0 ? 1 : -1) > st.pitch.hx - st.pitch.dims.box.depth - 1).length;
  // …et l'attaquant MURÉ n'est pas l'attaquant MUET : celui qui DEMANDE le tir et se voit refuser
  // le couloir (refus nommé au registre) a appuyé — c'est le silence sans demande qu'on interdit
  const denied = (st.deny?.['tir-couloir-fermé'] ?? 0) > 0;
  if (!shots.length && !denied && thirdVisits > 25) issues.push(`PERSONNE NE TIRE malgré ${thirdVisits} passages dans le dernier tiers — un rondo décoré`);
  for (const s of shots) {
    if (s.range > cfg.shotRange + 0.6) issues.push(`tir hors de portée déclarée (${s.range} m > ${cfg.shotRange})`);
    // la clause connaît LA MÊME loi que le déclencheur : à bout portant (< 9 m), on tire dans le
    // trafic (0,25 m) — juger tous les tirs au couloir de loin re-créerait l'attaquant muet
    const need = (s.range ?? 99) < 9 ? 0.25 : cfg.shotClear - 0.05;
    if (s.clear != null && s.clear < need) issues.push(`tir à travers un mur (couloir ${s.clear} m < ${need})`);
  }
  // chaque sortie est SUIVIE d'une reprise par la bonne équipe (dans les 6 s — le temps de la
  // poser). Une sortie dans les dernières secondes est COUPÉE par la fin, pas perdue — la même
  // clause d'inFlight que checkGestures : accuser le hasard de l'instant d'arrêt rend le contrat
  // dépendant du chronomètre.
  const lastT = trace.length ? trace[trace.length - 1].t : 0;
  for (const o of sorties) {
    if (o.t > lastT - 6) continue;
    const pr = prises.find((p) => p.t >= o.t && p.t <= o.t + 6);
    if (!pr) { issues.push(`sortie « ${o.out} » à t=${o.t} jamais reprise`); continue; }
    const taker = st.players[pr.by];
    if (taker && taker.team !== o.team) issues.push(`remise « ${o.out} » prise par l'équipe ${taker.team} (droit : ${o.team})`);
  }
  // le gardien HABITE son but (médiane de distance à sa ligne ≤ profondeur max + marge)
  for (const team of [0, 1]) {
    const gk = st.players.find((p) => p.keeper && p.team === team);
    const g = st.pitch.ownGoal(team);
    const ds = trace.map((s) => s.players.find((q) => q.id === gk.id)).filter(Boolean)
      .map((q) => Math.hypot(q.p[0] - g.x, q.p[1] - 0)).sort((a, b) => a - b);
    const med = ds[Math.floor(ds.length / 2)] ?? 0;
    if (med > 6) issues.push(`le gardien ${team} erre (médiane à ${med.toFixed(1)} m de son but)`);
  }
  // le jeu PROGRESSE : le ballon visite les deux tiers offensifs (pas un rond central perpétuel)
  // la clause vise le rond-central-perpétuel, pas l'équilibre des forces : une équipe dominée
  // 120 s durant est un MATCH (0-0 dominé mesuré, graine 5) — un ballon qui ne franchit jamais
  // les moitiés n'en est pas un
  // …seuil au TIERS (hx/3) : à hx/2, la clause re-cassait à chaque re-donne de graine sur les
  // matchs dominés (une équipe coincée 120 s dans sa moitié est un match légal — c'est le
  // rond-central-perpétuel qu'on interdit, pas la domination)
  const third = st.pitch.hx / 3;
  const visits = [trace.some((s) => s.ball[0] > third), trace.some((s) => s.ball[0] < -third)];
  if (!visits[0] || !visits[1]) issues.push(`le ballon ne visite pas les deux camps (au-delà de ±${third.toFixed(0)} m : +x ${visits[0]}, −x ${visits[1]})`);
  // LE BALLON NE SE TÉLÉPORTE JAMAIS EN MATCH : toute remise est PORTÉE au point de remise
  // (ballFetch) — le registre du corps du ballon ne contient que LA pose du coup d'envoi
  // (construction, avant la première image). Mesuré avant la loi : 12 sauts de 4,7-23 m / 4 matchs.
  const led = st.ball.ledger;
  if (cfg.restartCarried !== false && led && led.restarts && led.restarts.length > 1) {
    issues.push(`${led.restarts.length - 1} remise(s) posée(s) par écriture — la remise se PORTE (ballFetch), elle ne se téléporte pas`);
  }
  // …ET LES CORPS NON PLUS : à l'échantillon de trace (0,1 s), aucun joueur ne franchit 1,6 m
  // (16 m/s apparents — le sprint plafonne à 8). placeKickoff écrivait les douze corps à chaque but.
  for (let i = 1; i < trace.length; i++) {
    const a = trace[i - 1], b = trace[i];
    if (b.t - a.t > 0.19) continue;
    const jump = b.players.find((q) => {
      const qa = a.players.find((x) => x.id === q.id);
      return qa && Math.hypot(q.p[0] - qa.p[0], q.p[1] - qa.p[1]) > 1.6;
    });
    if (jump) { issues.push(`téléport de corps : le joueur ${jump.id} saute > 1,6 m entre t=${a.t} et t=${b.t}`); break; }
  }
  return { ok: issues.length === 0, issues, stats: { shots: shots.length, buts: buts.length, arrets: evs.filter((e) => e.type === 'arrêt').length, sorties: sorties.length, score: [...st.score] } };
}

export const matchInternals = { assignMatchJobs, tryShot, tryCross, onOut, onDive, canTake, placeKickoff, kickoffSpots, ballFetch };
export { checkRondo };
