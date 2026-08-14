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
//   — pas de hors-jeu AU FORMAT RÉDUIT (5+1, comme au futsal/five — loi du format) ; le 11c11,
//     lui, vit sous la Loi 11 (offside.js : cerveau, photo au départ, sifflet, calage des pointes) ;
//   — le gardien ne sort pas de sa surface (keeper v1 : depthMax 2,6 m) ;
//   — les remises placent le ballon et tiennent les adversaires à distance, sans cérémonie.

import { BALL } from './ball.js';
import { laneClearance, predictPath, interceptPoint } from './ball-predict.js';
import { RONDO, makeRondo, evadeSpot } from './rondo.js';
import { rondoStep, checkRondo, simInternals } from './rondo-sim.js';
import { makePitch, outRule, REDUIT, FULL } from './pitch.js';
import { formationSpots, premierOffensif, blocFor } from './formation.js';
import { offsideLine } from './offside.js';
import { tac, axe, resoudreTactique } from './tactics.js';
import { resoudreRole, role } from './roles.js';
import { MATCH } from './match-config.js';
export { MATCH };
import { onOut, canTake, chronoStep, feuilleDeMatch, administerWhistle, adjugeFaute, remiseEnTouche, stepRemplacements, ballFetch, kickoffSpots, placeKickoff } from './referee.js';
import { tryShot, tryCross, tryClear } from './shooting.js';
export { feuilleDeMatch, kickoffSpots, placeKickoff };
import { KEEPER, keeperSpot, keeperDecide } from './keeper.js';
import { makeProfile } from './attributes.js';
import { startGesture, busy, winding } from './gesture.js';
import { MOVES } from './animkit.js';

const d2 = (a, b) => Math.hypot(a[0] - b[0], (a[2] ?? a[1]) - (b[2] ?? b[1]));

/** La configuration du MATCH — le RONDO plus les lois du but. */

/**
 * makeMatch — l'état d'un match réduit : perTeam joueurs de champ + 1 gardien par équipe, sur un
 * terrain de pitch.js, coup d'envoi à l'équipe 0. L'état EST un état de rondo (mêmes joueurs,
 * même ballon, mêmes personas) : le loop ne voit pas la différence, c'est la config qui la fait.
 */
export function makeMatch({ perTeam = 5, seed = 1, pitch = null, full = false, squads = null, tactics = null, roles = null } = {}) {
  // LE 11C11 EST UNE CONFIGURATION (full: true → terrain Loi 1, 10 + gardien par équipe, postes
  // de formation) — même loop, mêmes lois, aucune tuyauterie nouvelle : la preuve du moteur.
  pitch = pitch ?? makePitch(full ? FULL : undefined);
  if (full && perTeam === 5) perTeam = 10;
  const st = makeRondo({ perTeam: perTeam + 1, seed, area: [pitch.dims.length, pitch.dims.width] });
  st.full = pitch.dims.length > 60;
  // LA TACTIQUE PAR ÉQUIPE (tactics.js) : toujours résolue — absente, c'est « équilibre »
  // (0,5 partout = l'IDENTITÉ : chaque axe module autour des constantes mesurées des lots
  // 10-14, le monde d'aujourd'hui au bit près). makeMatch({ tactics: ['gegenpressing',
  // 'blocBas'] }) ou objets partiels — le contrat d'injection de l'écran tactique aval.
  st.tactics = [resoudreTactique(tactics?.[0]), resoudreTactique(tactics?.[1])];
  // chaque joueur de champ reçoit SON poste (l'index dans la formation — le 9 reste le 9)
  for (const team of [0, 1]) {
    st.players.filter((q) => q.team === team).forEach((q, i) => { q.post = i; });
  }
  // LES RÔLES PAR POSTE (roles.js) : makeMatch({ roles: [{ 8: 'neufDeSurface', 5: 'meneur' },
  // {…équipe 1}] }) — clé = numéro de poste, valeur = nom ou objet partiel. APRÈS l'assignation
  // des postes (la première version lisait q.post avant qu'il existe : six sondes bit-identiques,
  // zéro rôle posé — attrapé à la mesure). Aucun rôle posé : polyvalent, pas un bit ne bouge.
  // …fusion PRESET < EXPLICITE (lot 20) : la tactique amène ses hommes (gegenpressing → son
  // récupérateur), les rôles passés à makeMatch gagnent poste par poste. Vide : personne.
  for (const team of [0, 1]) {
    const spec = { ...(st.tactics[team].roles ?? {}), ...(roles?.[team] ?? {}) };
    for (const q of st.players.filter((q) => q.team === team)) {
      if (spec[q.post] != null) q.role = resoudreRole(spec[q.post]);
    }
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

  // le sifflet de la Loi 11 (receive) s'administre AVANT tout métier : le coup franc est posé
  // ici même, et le bloc remise ci-dessous prend le relais dans la même image
  if (st._whistle) administerWhistle(st, cfg);

  // …et le CHRONO siffle ses périodes au même étage (mi-temps, fin de match, possession)
  if (cfg.chrono) chronoStep(st, cfg);

  // …et la LOI 12 s'adjuge au même étage (l'avantage d'abord, le sifflet ensuite)
  if (cfg.loi12 && st._faute) adjugeFaute(st, cfg);
  if (cfg.loi3 && st.full) stepRemplacements(st, cfg);

  // L'HORLOGE DU REGAIN (cfg.moments — phases.js) : le moment COLLECTIF se dérive de qui a le
  // ballon et depuis quand (momentDuJeu) ; le changement s'événemente ('transition'), son
  // installation aussi ('placée') — mesurable au banc, socle des consommateurs tactiques.
  // Événements seuls ici : aucun comportement, le flux réduit/rondo ne bouge pas d'un bit.
  if (cfg.moments) {
    const poss = st.possession.team >= 0 ? st.possession.team : st.lastTouch;
    if (poss === 0 || poss === 1) {
      if (st._possTeam !== poss) {
        st._possTeam = poss; st._possChangeAt = st.t; st._momentK = 'transition';
        st.events.push({ t: +st.t.toFixed(2), type: 'moment', kind: 'transition', team: poss });
      } else if (st._momentK === 'transition' && st.t - (st._possChangeAt ?? 0) >= (cfg.moments.win ?? 5)) {
        st._momentK = 'placée';
        st.events.push({ t: +st.t.toFixed(2), type: 'moment', kind: 'placée', team: poss });
      }
    }
  }

  // UN VOL MORT EST UN BALLON LIBRE (cfg.deadFlight, 11c11) : la passe s'est arrêtée au sol
  // avant son receveur — personne ne « reçoit » un ballon immobile à 0,6 m du pied. La phase
  // bascule en 'loose' après ~0,3 s d'agonie (pas un rebond : une mort), et la chasse des deux
  // camps reprend ses droits. st.pass SURVIT : la photo de la Loi 11 juge le PREMIER TOUCHER,
  // même d'un ballon mort — le hors-jeu qui ramasse une passe morte est toujours hors-jeu.
  if (cfg.deadFlight && st.full && st.phase === 'flight' && st.ball.owner == null
    && st.ball.p[1] < 0.25 && Math.hypot(st.ball.v[0], st.ball.v[2]) < cfg.deadFlight) {
    st._deadFlightN = (st._deadFlightN ?? 0) + 1;
    if (st._deadFlightN >= 18) {
      st.phase = 'loose';
      st.events.push({ t: +st.t.toFixed(2), type: 'vol-mort', p: [+st.ball.p[0].toFixed(1), +st.ball.p[2].toFixed(1)] });
      st._deadFlightN = 0;
    }
  } else st._deadFlightN = 0;

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
    // LE MATCH EST FINI (chrono) : plus d'ayant droit, plus de course — le monde SE TIENT (les
    // chiffres sont sur la feuille de match ; un état terminal propre, pas un gel qui inquiète)
    if (r.type === 'fin') {
      for (const p of st.players) { p.job = 'walk'; p.target = [p.p[0], 0, p.p[2]]; }
      return;
    }
    // le rayon des adversaires se tient depuis le BALLON tant qu'il n'est pas posé (le preneur le
    // porte : on s'écarte de LUI), depuis le point de remise ensuite
    const rp = r.placed === false ? [st.ball.p[0], st.ball.p[2]] : r.p;
    // LA LOI 14 (cfg.loi14 && st.full) : la CÉRÉMONIE du penalty. Tous les corps sauf le preneur
    // et le gardien de la ligne : HORS surface, HORS de l'arc (rayon du mur autour du POINT — pas
    // du ballon porté), DERRIÈRE le ballon. Un clamp en UNE passe, ancré au point r.p : pour un z
    // donné, le x légal est le plus contraignant de (surface + 0,8) et de l'arc (+ 0,35), toujours
    // côté champ du plan du ballon — mesuré avant : gardien à 1,8 m DEVANT sa ligne, coéquipiers
    // en marche VERS le point (la remise générique), corps en surface et dans l'arc à la prise.
    const l14 = cfg.loi14 && st.full && r.type === 'penalty'
      ? { own: pitch.ownGoal(1 - r.team), def: 1 - r.team, arc: (cfg.loi12?.mur ?? 9.15) + 0.35 } : null;
    const l14clamp = (p) => {
      const sgn = l14.own.sign;
      const sSpot = r.p[0] * sgn;                               // tout se compte VERS le but (s = x·sgn)
      let sLim = sSpot - 0.9;                                   // derrière le ballon
      if (Math.abs(p.p[2]) < pitch.dims.box.width / 2 + 0.6) sLim = Math.min(sLim, pitch.hx - pitch.dims.box.depth - 0.8);
      if (Math.abs(p.p[2]) < l14.arc) sLim = Math.min(sLim, sSpot - Math.sqrt(l14.arc * l14.arc - p.p[2] * p.p[2]));
      p.job = 'walk';
      p.target = p.p[0] * sgn > sLim ? [sLim * sgn, 0, p.p[2]] : [p.p[0], 0, p.p[2]];
    };
    for (const p of st.players) {
      // l'EXPULSÉ est hors du monde, remises comprises (Loi 12, lot 28) : il rejoint sa sortie —
      // et le REMPLACÉ marche le même chemin (Loi 3 : sortie puis entrée du nouvel homme)
      if (p.expulse || p._sub) {
        const to = p._sub?.phase === 'in' ? p._sub.entry : p._exit;
        p.job = 'walk'; p.target = [to[0], 0, to[1]]; continue;
      }
      // APRÈS UN BUT, ON REVIENT EN MARCHANT : les deux équipes rejoignent leur formation
      // d'engagement pendant que le preneur sort le ballon du filet (placeKickoff écrivait les
      // douze corps — jusqu'à 20 m en une image, mesuré à la sonde des téléports)
      // UNE REMISE EST UNE RESPIRATION : tout le monde MARCHE (bucket walk 2,6 m/s) — on revenait
      // en trottinant à 4,9-5,6 et les corps travaillaient à 10,5 km/h sur la mi-temps
      if (r.spots && r.spots[p.id] && p.id !== r.taker) { p.job = 'walk'; p.target = [r.spots[p.id][0], 0, r.spots[p.id][1]]; continue; }
      if (p.keeper) {
        // …le gardien de la LIGNE (Loi 14) : SUR sa ligne, entre les poteaux, jusqu'à la frappe —
        // keeperSpot le posait à 1,8 m devant (sa loi de position ne connaît pas la cérémonie)
        if (l14 && p.team === l14.def) { p.job = 'keeper'; p.target = [l14.own.x - l14.own.sign * 0.15, 0, 0]; continue; }
        const s = keeperSpot(pitch, p.team, [rp[0], 0, rp[1]]); p.job = 'keeper'; p.target = [s.x, 0, s.z]; continue;
      }
      if (p.id === r.taker) continue;                               // le preneur a son métier (plus bas)
      if (l14) { l14clamp(p); continue; }                           // la cérémonie vaut pour les DEUX camps
      if (r.type === 'engagement') {
        // chacun DANS SA MOITIÉ (Loi 8) — les positions d'engagement ont été posées ; on les tient
        const sign = pitch.ownGoal(p.team).sign;
        const tx = Math.abs(p.p[0]) < 1 && p.team !== r.team ? sign * 4 : p.p[0];
        p.job = 'walk'; p.target = [tx, 0, p.p[2]];
      } else if (p.team === r.team) {
        p.job = 'walk'; p.target = [r.p[0], 0, r.p[1]];
      } else {
        // l'adversaire TIENT LE RAYON de la remise (Loi 15/16/17 à l'échelle du format)
        // …et le COUP FRANC du plein format tient LE MUR (Loi 13 — cfg.loi12.mur, 9,15 m) :
        // rayon réel, et les deux défenseurs les plus proches de leur but se posent SUR la
        // ligne ballon→but, épaule contre épaule — un coup franc sans mur est un penalty déguisé
        const mur = cfg.loi12 && st.full && (r.type === 'coup-franc' || r.type === 'penalty') ? (cfg.loi12.mur ?? 9.15) : cfg.restartClear;
        if (mur !== cfg.restartClear && r.type === 'coup-franc') {
          const og = pitch.ownGoal(p.team);
          if (Math.hypot(og.x - rp[0], rp[1]) < 30) {
            r._mur ??= st.players.filter((q) => q.team !== r.team && !q.keeper && q.down <= 0)
              .sort((a, b) => Math.hypot(og.x - a.p[0], a.p[2]) - Math.hypot(og.x - b.p[0], b.p[2]))
              .slice(0, 2).map((q) => q.id);
            const im = r._mur.indexOf(p.id);
            if (im >= 0) {
              const gx = og.x - rp[0], gz = 0 - rp[1];
              const gl = Math.hypot(gx, gz) || 1;
              const lat = im === 0 ? 0.35 : -0.35;
              p.job = 'walk';
              p.target = [rp[0] + (gx / gl) * mur - (gz / gl) * lat, 0, rp[1] + (gz / gl) * mur + (gx / gl) * lat];
              continue;
            }
          }
        }
        const dx = p.p[0] - rp[0], dz = p.p[2] - rp[1];
        const d = Math.hypot(dx, dz);
        p.job = 'walk';
        p.target = d < mur ? [rp[0] + (dx / (d || 1)) * mur, 0, rp[1] + (dz / (d || 1)) * mur] : [p.p[0], 0, p.p[2]];
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

  // ---- l'EXPULSÉ (Loi 12, lot 28) : hors du monde — il marche vers sa sortie et y reste ;
  // aucun cerveau d'équipe ne le voit (field et gardiens filtrent, la Loi 11 l'ignore,
  // les preneurs/mur le sautent par leurs filtres down<=0 — le levier natif du down géant).
  // Le REMPLACÉ (Loi 3) marche le même chemin : sortie, échange d'identité, entrée.
  for (const p of st.players) if (p.expulse || p._sub) {
    const to = p._sub?.phase === 'in' ? p._sub.entry : p._exit;
    p.job = 'walk'; p.target = [to[0], 0, to[1]];
  }

  // ---- les gardiens (toujours, toutes phases)
  for (const gk of st.players.filter((p) => p.keeper && !p.expulse && !p._sub)) {
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
      // …et le spot vit AU COIN des six mètres, JAMAIS sur l'axe : z borné ±3,5 posait le point
      // DANS la bouche du but (poteaux à ±3,66) — le porté via-ball sur-vise (l'équilibre
      // d'amortissement de NOTES 38), le ballon déborde le spot et roule ENTRE les poteaux :
      // CSC du gardien mesuré sur matchs complets (graine 1 t=14,9 : six touches de porté, puis
      // le ballon seul dans son filet — le premier « but » du match). Hors de l'axe, le même
      // débordement meurt en sortie de but, pas en but.
      const spotD = [g.x - g.sign * 4.5, (gk.p[2] >= 0 ? 1 : -1) * (pitch.goalHalf + 2.1)];
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
    // …et le SPIN du ballon se lit (lot 39) : la flottante — vite, sans axe — retarde le départ.
    // Le fil passe par la clé du répertoire : shotVariety:false = la lecture d'hier, au bit près
    // (sans la garde, un tendu > 18 m/s à spin nul déclenchait la lecture tardive dans le monde saboté)
    const dec = keeperDecide(pitch, gk.team, [gk.p[0], 0, gk.p[2]], st.ball.p, st.ball.v, shotAge, K, st.lastTouch !== gk.team,
      cfg.shotVariety !== false ? Math.hypot(st.ball.w[0], st.ball.w[1], st.ball.w[2]) : null);
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

  const field = st.players.filter((p) => !p.keeper && !p.expulse && !p._sub);   // à 10 après un rouge (Loi 12) ; le remplacé en chemin est hors des postes (Loi 3)
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
      // …ET L'ÉVASION NE TRAVERSE PAS SA PROPRE SURFACE : la fuite pure (0,75 d'évasion sous
      // surnombre) d'un porteur pressé dans son camp pointait DANS son propre but — mesuré sur
      // matchs complets : des CSC en conduite (t=14,9 graine 1, t=124 graine 3 — le premier
      // « but » de 3 matchs sur 4, dGoal adverse ~100 m et CROISSANT pendant toute la course).
      // Un défenseur acculé fuit LE LONG de la ligne, jamais dans son filet : à moins de 22 m de
      // son but, la composante vers le but propre se PLAFONNE et la poussée se rabat sur la
      // latérale — le signe de l'évasion garde le côté déjà choisi, le lissage repart de la loi
      // (sinon l'EMA la combat image après image).
      {
        const og = pitch.ownGoal(p.team);
        const sOwn = Math.sign(og.x || 1);
        // …au rayon À L'ÉCHELLE DU TERRAIN (0,42·hx, plafonné 22) : le 22 m plat couvrait un
        // TIERS du réduit et étouffait sa conduite (tempsLoin 7,1 > 2,5 — attrapé par la
        // sentinelle, encore elle)
        if (Math.hypot(og.x - p.p[0], p.p[2]) < Math.min(22, pitch.hx * 0.42) && p.push[0] * sOwn > 0.35) {
          const lat = Math.sign(p.push[1] || (p.p[2] >= 0 ? 1 : -1));
          p.push = [sOwn * 0.35, lat * Math.sqrt(1 - 0.35 * 0.35)];
          p._pushS = [p.push[0], p.push[1]];
        }
      }
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
    // LE RECEVEUR VIVANT (retour utilisateur « cette pose statique en attendant le ballon ») :
    // mesuré, p25 de vitesse = 0,00 m/s pendant le vol et 14 % des vols figés > 60 % du temps —
    // loin du ballon, la rencontre n'existait pas encore, la statue au point de chute. Sur une
    // passe DANS LES PIEDS (mène ≈ receveur) assez longue, il VIENT AU-DEVANT sur l'AXE NOMINAL
    // de la livraison (mène → origine), à allure de marche, borné — le corps vit pendant TOUT le
    // vol, la prise se fait dans le pas, et l'erreur latérale continue d'échapper (l'axe est
    // NOMINAL, pas le vol réel : la leçon du flipper reste consignée). Le coureur d'appel garde
    // sa course (_pace vivant = pas de retour vers l'origine), le réduit son monde (st.full).
    // …ET LA ZONE EST LA LOI (cfg.meetWalk.hold) : venir au ballon est un geste de CONSTRUCTION —
    // dans les ~30 derniers mètres le receveur TIENT son point de fixation (mesuré sans la porte :
    // les prises < 22 m du but chutaient 12 → 5 et les tirs 27 → 16, l'attaque redescendait).
    if (!met && st.full && cfg.meetWalk && dInb >= (cfg.meetZone ?? 4.5)
      && !((flightRec._pace?.until ?? -1) > st.t)) {
      const g = st.pitch.attackGoal(flightRec.team);
      const dGoal = Math.hypot(st.pass.lead[0] - g.x, st.pass.lead[2] - (g.z ?? 0));
      const ax = st.pass.origin[0] - st.pass.lead[0], az = st.pass.origin[1] - st.pass.lead[2];
      const al = Math.hypot(ax, az);
      const adv = Math.min(cfg.meetWalk.max ?? 2.2, (st.t - st.pass.t) * (cfg.meetWalk.pace ?? 1.8), al * 0.25);
      const dLead = Math.hypot(flightRec.p[0] - st.pass.lead[0], flightRec.p[2] - st.pass.lead[2]);
      if (dGoal > (cfg.meetWalk.hold ?? 32) && al > (cfg.meetWalk.min ?? 7) && dLead < 2.5 + adv) {
        met = [st.pass.lead[0] + (ax / al) * adv, 0, st.pass.lead[2] + (az / al) * adv];
      }
    }
    // …ET UN VOL LONG SE REÇOIT À SA CHUTE PRÉDITE (lot 52, cfg.chutePredite — retour
    // utilisateur « les contrôles sur les passes longues sont tous ratés ») : ancré au point
    // NOMINAL, le receveur d'un lofted vivait à 4,3 m p50 de la chute réelle (p90 14) — le vol
    // le survolait et retombait plus loin : 68 % des longs finissaient en CHASSE AU REBOND
    // (p90 5 rebonds, 9 m roulés, 2,8 s). Le vrai receveur a ~2 s pour LIRE le vol : il court
    // vers le premier point JOUABLE (y ≤ 1,2 m, descendant) du chemin prédit — à vitesse
    // humaine (movePlayers borne : le déchet reste ce que ses jambes ne couvrent pas ; la
    // leçon du flipper tient, on ne suit pas le bruit du vol court). false : l'ancre nominale
    // d'hier (sabotage nommé « le récepteur au point de rendez-vous »).
    if (st.full && cfg.chutePredite !== false && !met && (st.pass.flight ?? 0) > 1.1 && st.ball.p[1] > 0.9) {
      if (!st._chuteT || st._chuteAt !== st.pass || st.t - st._chuteT > 0.25) {
        const chemin = predictPath(st.ball, { dt: 1 / 30, maxT: (st.pass.flight ?? 2) + 0.8 });
        const chute = chemin.find((s) => s.p[1] <= 1.2 && s.v[1] < 0) ?? null;
        st._chute = chute ? [chute.p[0], chute.p[2]] : null;
        st._chuteT = st.t; st._chuteAt = st.pass;
      }
      if (st._chute) met = [st._chute[0], 0, st._chute[1]];
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
      // …chaînée au ballon AUSSI en attaque (lot 51, bloc.soutien — la ligne arrière monte)
      const spots = formationSpots(pitch, atk, anchor[0], true, tac(st, atk).formation, blocFor(cfg.bloc ?? null, tac(st, atk)));
      // LA LOI 11 CALE LES POINTES (cfg.offside) : un poste offensif coulissé peut tomber DERRIÈRE
      // la défense — un attaquant réel vit SUR la ligne, pas au-delà. Mesuré AVANT le calage : le
      // bloc adverse recule si profond (slide borné, ligne de 4 devant sa surface) que le camping
      // illicite est déjà rare (0-1,1 % du temps de possession, 4 graines × 180 s) — le calage
      // n'est donc pas un remède, c'est la LOI : la borne qui garantit qu'AUCUNE hauteur de bloc
      // future (ligne haute, pressing) ne rendra les pointes injouables. La ligne se relit CHAQUE
      // image (elle bouge avec la défense) : l'à-coup cadencé garde le POSTE, le calage borne la
      // CIBLE — reculer avec la ligne qui monte n'est pas un à-coup, c'est la règle.
      const off = cfg.offside ? offsideLine(st, atk) : null;
      // …ET L'APPEL SE TIME SUR LE PASSEUR (lot 41, cfg.appelPret) : on appelle quand le
      // porteur PEUT donner — le ballon au pied (≤ appelPret m), pas au milieu d'une touche
      // poussée. Mesuré avant : latence burst → passe p50 1,43 s (le cycle de préparation
      // mangeait la course — le ballon partait quand le dart FINISSAIT, l'enveloppe fermée
      // à 0,6 s) ; le coureur du vrai football lit les APPUIS du passeur avant de partir.
      // false : l'appel aveugle d'hier (sabotage nommé).
      const posé = carrier && !carrier.keeper && st.phase === 'carry' && st.hold > 0.6
        && (cfg.appelPret === false || d2(st.ball.p, carrier.p) <= (cfg.appelPret ?? 1.0));
      // LA VERTICALITÉ DU REGAIN (cfg.moments) : pendant la transition offensive (les win s où
      // le bloc adverse est déformé), le cooldown d'équipe des appels profonds se relâche de
      // 2,5 s — la profondeur se joue MAINTENANT, pas au tempo du jeu placé
      const transOff = cfg.moments && st._possTeam === atk
        && st.t - (st._possChangeAt ?? -99) < (cfg.moments.win ?? 5);
      for (const p of posted) {
        const want = spots[p.post ?? 0] ?? [p.p[0], p.p[2]];
        p.job = 'support';
        const drift = p._slotT ? Math.hypot(want[0] - p._slotT[0], want[1] - p._slotT[1]) : Infinity;
        if (!p._slotT || drift > 3.5 || ((p._slotAt ?? -1) <= st.t && drift > 0.8)) {
          p._slotT = want; p._slotAt = st.t + 0.7;
        }
        let tx = p._slotT[0], tz = p._slotT[1];
        // LA LARGEUR (tactics.largeur) : l'amplitude des postes offensifs — jouer dedans
        // (×0,85) ou écarter le bloc (×1,15, le jeu d'ailes). 0,5 = ×1, l'identité.
        const lF = axe(tac(st, atk).largeur, 0.85, 1.15);
        if (lF !== 1) tz = Math.max(-pitch.hz + 1.5, Math.min(pitch.hz - 1.5, tz * lF));
        // …ET LE RÔLE NUANCE SON POSTE (roles.js) : la profondeur (le 9 se tient haut, le 10
        // décroche — ±2,5 m ; le calage Loi 11 garde le DERNIER mot : un 9 haut reste calé sur
        // la ligne) et la largeur personnelle (craie la ligne ou repique — ×0,9…1,1, composée
        // avec la largeur d'équipe). Aucun rôle : ±0 / ×1, pas un bit.
        const R = role(p);
        const pf = axe(R.profondeur, -2.5, 2.5);
        if (pf) tx = Math.max(-pitch.hx + 1.2, Math.min(pitch.hx - 1.2, tx + -pitch.ownGoal(atk).sign * pf));
        const wR = axe(R.largeurR, 0.9, 1.1);
        if (wR !== 1) tz = Math.max(-pitch.hz + 1.5, Math.min(pitch.hz - 1.5, tz * wR));
        // …les POINTES sont celles de LA formation (LIGNES — « ≥ 7 » n'était vrai qu'en 4-3-3)
        if (off && (p.post ?? 0) >= premierOffensif(tac(st, atk).formation)) {
          // …ET L'APPEL TIMÉ JAILLIT DE LA LIGNE — depuis la PORTÉE DE PASSE, pas depuis l'autre
          // bout du terrain. Première version mesurée : dart visant une ligne à ~16 m du poste,
          // porteur à 30 m — 21-29 appels/180 s, 0-1 servi (la décoration déjà enterrée au rondo :
          // « 5 servis sur 74 »). Un appel n'existe que s'il peut être SUIVI : pointe à portée de
          // choosePass (passRange[1] = 13), DEVANT le ballon, porteur posé, couloir profond ouvert
          // → elle darde 7 m vers la ligne (jamais au-delà : la photo se prend au départ du ballon,
          // strikeNow), l'appelBonus la fait servir, la mène (leadTime) jette le ballon DERRIÈRE.
          // Un appel par équipe à la fois — dix ruptures simultanées seraient un essaim.
          // …style (cadence des appels : direct appelle plus) et transition (contre → la
          // relaxation du regain va jusqu'à 5 s ; conservation → zéro) sont les axes tactiques
          if ((p._runT ?? -1) <= st.t && posé
            && (st._appelAt?.[atk] ?? -1) - (transOff ? axe(tac(st, atk).transition, 0, 5) : 0) <= st.t
            && (p._appelCd ?? -1) <= st.t) {
            const dB = d2(st.ball.p, p.p);
            const myAdv = p.p[0] * off.sgn;
            if (dB > 6 && dB < (cfg.passRange?.[1] ?? 13) - 0.5 && myAdv > st.ball.p[0] * off.sgn + 2) {
              const deepZ = p.p[2] * 0.55;
              const dartAdv = Math.min(off.adv - 0.15, myAdv + 7);
              const lane = laneClearance([st.ball.p[0], 0, st.ball.p[2]], [off.sgn * (dartAdv + 4), 0, deepZ],
                defenders.map((q) => q.p), { corridor: 0.9 });
              if (lane.open) {
                // …la cadence personnelle est un RÔLE (le 9 vit de ses courses : 6 s ; le
                // meneur vit du ballon : 14 s ; polyvalent : les 10 s mesurées du lot 10)
                p._runT = st.t + 1.7; p._runZ = deepZ; p._runAdv = dartAdv;
                p._appelCd = st.t + axe(role(p).appel, 14, 6);
                (st._appelAt ??= {})[atk] = st.t + axe(tac(st, atk).style, 6.5, 3.5);
                // la fenêtre de _pace COUVRE le dart (1,6 ≈ 1,7 s) : c'est elle qui porte le
                // bonus ET l'extension de portée — expirer à mi-course re-fermait l'enveloppe
                p._pace = { until: st.t + 1.6, kind: 'appel', next: p._pace?.next ?? st.t + 8 };
                st.events.push({ t: +st.t.toFixed(2), type: 'burst', kind: 'appel-profond', by: p.id });
              }
            }
          }
          if ((p._runT ?? -1) > st.t) {
            tx = off.sgn * Math.max(0, Math.min(p._runAdv ?? (off.adv - 0.15), off.adv - 0.15));
            tz = p._runZ ?? tz;
          } else if (tx * off.sgn > off.adv - 0.8) tx = off.sgn * Math.max(0, off.adv - 0.8);
        }
        p.target = [tx, 0, tz];
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

  // ---- LE PRESSING À DÉCLENCHEURS (cfg.pressTriggers, 11c11) : une équipe ne presse pas TOUT
  // LE TEMPS — elle presse SUR SIGNAL, en fenêtre bornée. C'est le patron du contre-press
  // (lossReact : un réflexe par-dessus les postes) porté à l'échelle de l'ÉQUIPE. Deux signaux
  // de l'école du pressing, lisibles dans l'état sans oracle : (t1) LA PRISE DOS AU BUT — un
  // porteur qui reçoit tourné vers son propre but, dans son camp, ne voit pas la sortie ; (t2)
  // LA PASSE EN RETRAIT — un ballon qui recule de 3 m invite la ligne à monter dessus. La
  // fenêtre meurt au régain (objectif atteint — la détection voit W.team === atk), à la remise,
  // ou à l'expiration ; cooldown d'équipe : un press permanent n'est ni lisible ni tenable
  // (c'est la frénésie que la refonte tempo a enterrée).
  if (cfg.pressTriggers && st.full) {
    const defTeam = atk === 0 ? 1 : 0;
    if (st._press && (st.t > st._press.until || st._press.team === atk || st.restart)) st._press = null;
    const sgnAtk = -pitch.ownGoal(atk).sign;
    // L'AGRESSIVITÉ (tactics.pressing) module les TROIS signaux et la fenêtre : à 0, un bloc
    // qui n'accepte le press que sur signal criant ; à 1, l'école de la chasse — signaux
    // permissifs, fenêtres longues, cooldown court. 0,5 = les constantes mesurées du lot 11.
    const Tp = tac(st, defTeam).pressing;
    if (!st._press && !st.restart && (st._pressCd?.[defTeam] ?? -1) <= st.t) {
      let kind = null;
      if (carrier && !carrier.keeper && st.phase === 'carry' && st.hold < axe(Tp, 0.2, 0.8)
        && carrier.p[0] * sgnAtk < -2 && Math.cos(carrier.yaw) * sgnAtk < -0.35) kind = 'dos-au-but';
      else if (st.phase === 'flight' && st.pass && st.pass.lead && st.pass.origin
        && st.pass.origin[0] * sgnAtk < axe(Tp, -7, -1)
        && (st.pass.lead[0] - st.pass.origin[0]) * sgnAtk < -3) kind = 'passe-en-retrait';
      // …le retrait ne déclenche que dans la RELANCE BASSE (origine à 4 m dans leur camp) : la
      // première version sautait sur toute passe arrière — 16-18 fenêtres/180 s, 40 % du temps
      // sous pressing, un état permanent déguisé en réflexe (mesuré, 4 graines)
      // (t3) LE CONTRE-PRESS D'ÉQUIPE (cfg.moments — la transition défensive du Gegenpressing) :
      // la perte est JEUNE (< 2,5 s) et HAUTE (ballon dans le camp du nouveau porteur) — le bloc
      // qui vient de perdre saute AVANT que l'adversaire ne s'organise. Le contre-press
      // individuel (lossReact) chassait déjà l'ex-porteur ; ici c'est l'ÉQUIPE qui bascule.
      else if (cfg.moments && st.t - (st._possChangeAt ?? -99) < axe(Tp, 1, 4)
        && st.ball.p[0] * sgnAtk < -4) kind = 'contre-press';
      if (kind) {
        const win = (cfg.pressTriggers.win ?? 4.5) + axe(Tp, -1.3, 1.3);
        st._press = { team: defTeam, until: st.t + win, kind };
        (st._pressCd ??= {})[defTeam] = st.t + win + axe(Tp, 10, 2);
        st.events.push({ t: +st.t.toFixed(2), type: 'press', kind, team: defTeam });
      }
    }
  }

  // ---- la défense : press sur le ballon, cover CÔTÉ BUT, marquage goal-side
  {
    const defGoal = pitch.ownGoal(atk === 0 ? 1 : 0);
    const sgnAtk = -pitch.ownGoal(atk).sign;
    const press = st.full && cfg.pressTriggers && st._press
      && st._press.team === (atk === 0 ? 1 : 0) && st._press.until > st.t ? st._press : null;
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
        // L'OMBRE DE COUVERTURE (cfg.coverShadow, 11c11) : le presseur n'arrive pas en ligne
        // droite — il arrive PAR LE COULOIR du soutien le plus dangereux (le plus profond à
        // portée de passe) : son corps vit DANS la ligne de passe pendant toute l'approche, et
        // l'option qui progresse meurt sans un geste (laneClearance mesure des corps réels —
        // l'ombre n'a besoin d'aucune règle de plus, c'est du POSITIONNEMENT). À portée de duel
        // (< 2,6 m) l'ombre cède au tacle : le duel est le duel.
        if (cfg.coverShadow && st.full && carrier && !freeBall && d2(p.p, anchor) > 2.6) {
          const hot = attackers.filter((a) => a.id !== carrier.id && !a.keeper && d2(a.p, anchor) < 15)
            .sort((a, b) => b.p[0] * sgnAtk - a.p[0] * sgnAtk)[0] ?? null;
          if (hot) {
            const hx2 = hot.p[0] - anchor[0], hz2 = hot.p[2] - anchor[2];
            const hl = Math.hypot(hx2, hz2) || 1;
            p.job = 'press'; p.target = [anchor[0] + (hx2 / hl) * 1.15, 0, anchor[2] + (hz2 / hl) * 1.15];
            return;
          }
        }
        p.job = 'press'; p.target = freeBall ? [leadP[0], 0, leadP[1]] : [anchor[0], 0, anchor[2]]; return;
      }
      if (i === 1) {
        // EN FENÊTRE DE PRESSING : le second défenseur ne couvre plus — il SAUTE sur le PIVOT
        // (l'option courte du porteur). Presser à deux en abandonnant la couverture, c'est LE
        // pari du pressing — le risque est le prix du régain haut, et il se voit (une passe qui
        // casse la première ligne trouve le champ que le cover aurait fermé).
        // …et un rôle SANS jambes de press (press < 0,25 — le meneur replié) ne saute pas :
        // il garde la couverture, le pari du pressing appartient à ceux qui en vivent
        if (press && carrier && role(p).press >= 0.25) {
          const outlet = attackers.filter((a) => a.id !== carrier.id && !a.keeper)
            .sort((a, b) => d2(a.p, anchor) - d2(b.p, anchor))[0] ?? null;
          if (outlet) { p.job = 'press'; p.target = [outlet.p[0], 0, outlet.p[2]]; return; }
        }
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
        // …le bloc défendant est CHAÎNÉ AU BALLON (cfg.bloc, lot 42 — formation.js) : ligne
        // à ~27 m du ballon, longueur bornée 30 m — les lignes ne s'espacent plus. Et le bloc
        // est CELUI DE SA TACTIQUE (lot 43, blocFor) : compacité et hauteur PAR ÉQUIPE.
        const spotsD = formationSpots(pitch, p.team, anchor[0], false, tac(st, p.team).formation, blocFor(cfg.bloc ?? null, tac(st, p.team)), anchor[2]);
        const want = spotsD[p.post ?? 0] ?? [p.p[0], p.p[2]];
        // LA HAUTEUR DE BLOC (tactics.hauteurBloc) : où l'équipe DÉFEND — le bloc posté se
        // décale de −6 (bloc bas, parqué devant sa surface) à +6 m (ligne haute — et la ligne
        // de hors-jeu suit : la Loi 11 fait exister le pari). 0,5 = 0 m, l'identité.
        const sgnD = -pitch.ownGoal(p.team).sign;
        const haut = axe(tac(st, p.team).hauteurBloc, -6, 6);
        if (haut) want[0] = Math.max(-pitch.hx + 1.2, Math.min(pitch.hx - 1.2, want[0] + sgnD * haut));
        // EN FENÊTRE DE PRESSING : le bloc posté MONTE d'un cran (pressTriggers.step) vers le
        // ballon — c'est la COMPRESSION qui fait exister la ligne (et le hors-jeu en flux : un
        // bloc qui monte pousse la ligne de la Loi 11 devant les pointes adverses)
        if (press) {
          want[0] = Math.max(-pitch.hx + 1.2, Math.min(pitch.hx - 1.2, want[0] + sgnD * (cfg.pressTriggers.step ?? 3.5)));
        }
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
      // …EN FENÊTRE DE PRESSING : le demi-pas (1,4 → 0,95 m) et la cadence courte (0,35 s /
      // 0,55 m) — on COLLE le temps du signal, puis le bloc respire à nouveau
      // …ET ON MARQUE DANS LA ZONE DE DANGER SEULEMENT (lot 51b, cfg.marquageRayon — vu en
      // playmode : ballon à +35 devant la surface, TROIS marqueurs partis à −6..+1 marquer la
      // ligne de SOUTIEN adverse à 40 m du ballon — l'amas au rond central, les corps « sans
      // sens tactique » du retour utilisateur ; la ligne montée du lot 51 les a rendus
      // « marquables »). Un homme à plus de rayon m du ballon est couvert par le BLOC — le
      // marqueur sans homme pertinent REJOINT SON POSTE. Le réduit garde le monde d'hier.
      // On marque LE DANGER : près du ballon (rayon), OU dans MON tiers défensif (les centraux
      // tiennent le 9 même ballon loin — le rayon seul laissait les pointes sans marqueur et la
      // ligne montait sur elles : camping 4-6 → 13,2 % mesuré, corrigé ici).
      const rayonM = st.full ? (cfg.marquageRayon ?? 22) : Infinity;
      const sgnDef = Math.sign(defGoal.x || 1);
      const marks = attackers.filter((a) => (!carrier || a.id !== carrier.id)
        && (d2(a.p, anchor) <= rayonM || (st.full && a.p[0] * sgnDef > pitch.hx / 3)));
      const m = marks.sort((a, b) => d2(a.p, p.p) - d2(b.p, p.p))[i - 2 < marks.length ? Math.min(i - 2, marks.length - 1) : 0] ?? null;
      if (!m && st.full) {
        const spotsM = formationSpots(pitch, p.team, anchor[0], false, tac(st, p.team).formation, blocFor(cfg.bloc ?? null, tac(st, p.team)), anchor[2]);
        const wM = spotsM[p.post ?? 0] ?? [p.p[0], p.p[2]];
        p.job = 'mark'; p.target = [wM[0], 0, wM[1]];
        return;
      }
      if (!m) { p.job = 'mark'; p.target = [p.p[0], 0, p.p[2]]; return; }
      const gx = defGoal.x - m.p[0], gz = 0 - m.p[2];
      const gl = Math.hypot(gx, gz) || 1;
      p.job = 'mark';
      // …ET LE RÔLE DU MARQUEUR (roles.press, lot 19) : le récupérateur COLLE (×0,82), le
      // meneur replié marque LÂCHE (×1,18) — milieu ×1, l'identité du polyvalent
      const off = (press ? 0.95 : 1.4) * axe(role(p).press, 1.18, 0.82);
      const want = [m.p[0] + (gx / gl) * off, m.p[2] + (gz / gl) * off];
      const drift = p._markT ? Math.hypot(want[0] - p._markT[0], want[1] - p._markT[1]) : Infinity;
      if (!p._markT || drift > 3 || ((p._markAt ?? -1) <= st.t && drift > (press ? 0.55 : 0.8))) {
        p._markT = want; p._markAt = st.t + (press ? 0.35 : 0.5);
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
  return {
    ...MATCH, assignJobs: assignMatchJobs, tryShot, tryCross, tryClear, onOut, onDive, canTake, passBias, ballFetch,
    // LA PRISE A UN MÉTIER (hook onTake du loop) : la touche du plein format se LANCE (Loi 15)
    onTake: (st, id, type, cfg) => { if (type === 'touche' && cfg.loi15 && st.full) remiseEnTouche(st, id, cfg); },
    ...overrides,
  };
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
  // …la fenêtre suit L'ÉCHELLE DU TERRAIN : 6 s suffisent au réduit ; un corner du 105 m se
  // PORTE sur ~27 m le long de la ligne (7,4 s mesurés, graine 7) — la borne plate accusait un
  // porté légal de gel
  const winR = Math.max(6, (st.pitch?.hx ?? 0) * 0.19);
  for (const o of sorties) {
    if (o.t > lastT - winR) continue;
    const pr = prises.find((p) => p.t >= o.t && p.t <= o.t + winR);
    if (!pr) { issues.push(`sortie « ${o.out} » à t=${o.t} jamais reprise (fenêtre ${winR.toFixed(0)} s)`); continue; }
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
