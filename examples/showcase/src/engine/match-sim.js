// match-sim — LE MATCH : UN game-loop (rondo-sim) configuré par accroches (assignJobs/tryShot/onOut/onDive/canTake). Dettes v1 : touche au pied réduit, hors-jeu 11c11, gardien-surface.

import { BALL } from './ball.js';
import { laneClearance, predictPath, interceptPoint } from './ball-predict.js';
import { RONDO, makeRondo, evadeSpot } from './rondo.js';
import { rondoStep, checkRondo, simInternals } from './rondo-sim.js';
import { makePitch, outRule, REDUIT, FULL } from './pitch.js';
import { formationSpots, premierOffensif, formationPour, mapPostes, LIGNES, blocFor, coverSpot, ballsideTrim } from './formation.js';
import { offsideLine } from './offside.js';
import { tac, axe, resoudreTactique, triangule } from './tactics.js';
import { resoudreRole, role, deborde } from './roles.js';
import { MATCH } from './match-config.js';
export { MATCH };
import { bordFiletStep, onOut, canTake, chronoStep, feuilleDeMatch, administerWhistle, adjugeFaute, remiseEnTouche, coupFrancDirect, coupFrancLance, cornerTrav, cornerSpots, stepRemplacements, ballFetch, kickoffSpots, placeKickoff } from './referee.js';
import { tryShot, tryCross, tryClear } from './shooting.js';
export { feuilleDeMatch, kickoffSpots, placeKickoff };
import { KEEPER, keeperSpot, keeperDecide, keeperRise, keeperHoldPoint, keeperCouvert, relancerGardien } from './keeper.js';
import { accrocheStep } from './duel.js';
import { makeProfile } from './attributes.js';
import { startGesture, busy, winding } from './gesture.js';
import { marquageCentre, intercepteurVol, accompagneMontee } from './phases.js';
import { MOVES } from './animkit.js';

const d2 = (a, b) => Math.hypot(a[0] - b[0], (a[2] ?? a[1]) - (b[2] ?? b[1]));

/** La configuration du MATCH — le RONDO plus les lois du but. */

/** makeMatch — perTeam + 1 gardien par équipe, terrain pitch.js ; l'état EST un rondo, la config fait la différence. */
export function makeMatch({ perTeam = 5, seed = 1, pitch = null, full = false, squads = null, tactics = null, roles = null } = {}) {
  pitch = pitch ?? makePitch(full ? FULL : undefined);   // full = une CONFIGURATION (Loi 1, 10+gardien, postes) : même loop, la preuve du moteur
  if (full && perTeam === 5) perTeam = 10;
  const st = makeRondo({ perTeam: perTeam + 1, seed, area: [pitch.dims.length, pitch.dims.width] });
  st.full = pitch.dims.length > 60;
  // le FLUX AUXILIAIRE (lot 97, contrat rng.js : un sous-seed par sous-système) : l'accrochage tire sur st.rnd2 — consommer st.rnd décalait tout le mix aval au bit (mesuré)
  { let s2 = (seed * 7919 + 13) >>> 0; st.rnd2 = () => ((s2 = (s2 * 1664525 + 1013904223) >>> 0) / 4294967296); }
  // LA TACTIQUE PAR ÉQUIPE (tactics.js) : absente = équilibre, l'identité au bit.
  st.tactics = [resoudreTactique(tactics?.[0]), resoudreTactique(tactics?.[1])];
  // chaque joueur de champ reçoit SON poste (l'index dans la formation — le 9 reste le 9)
  for (const team of [0, 1]) {
    st.players.filter((q) => q.team === team).forEach((q, i) => { q.post = i; });
  }
  // LES RÔLES PAR POSTE (roles.js) : APRÈS l'assignation des postes ; PRESET < EXPLICITE (lot 20).
  for (const team of [0, 1]) {
    const spec = { ...(st.tactics[team].roles ?? {}), ...(roles?.[team] ?? {}) };
    for (const q of st.players.filter((q) => q.team === team)) {
      if (spec[q.post] != null) q.role = resoudreRole(spec[q.post]);
    }
  }
  // LA PATTE (lot 87) : née au CORPS — hash (seed, id), 72/23/5, zéro st.rnd ; ratings.foot surclasse.
  for (const q of st.players) {
    const h = ((seed * 31 + q.id * 37) % 100 + 100) % 100;
    q.strongFoot = h < 72 ? 'right' : h < 95 ? 'left' : 'both';
  }
  // LES EFFECTIFS NOTÉS (attributes.js) : squads[team][i] dans l'ordre (le DERNIER = gardien). Sans squads : aucun p.skill — le monde d'aujourd'hui.
  if (squads) {
    for (const team of [0, 1]) {
      const roster = squads[team] ?? [];
      const mine = st.players.filter((q) => q.team === team);
      mine.forEach((q, i) => {
        const spec = roster[i];
        if (!spec) return;
        q.ratings = spec.ratings ?? null;
        q.skill = spec.ratings ? makeProfile(spec.ratings) : null;
        if (spec.ratings?.foot) q.strongFoot = spec.ratings.foot;
        q.look = spec.look ?? null;
        q.name = spec.name ?? q.name;
        q.number = spec.number ?? null;
        if (spec.ratings?.flair != null && q.persona)   // LE FLAIR EST UNE NOTE (147) : fournie, elle remplace le tirage seedé (TENTER ; FAIRE reste gesteF/technique)
          q.persona = { ...q.persona, flair: 0.15 + 0.85 * Math.max(0, Math.min(1, spec.ratings.flair / 100)) };
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
/** Les rôles du match. La grammaire du rondo (press/cover/mark/support/carry) reste — elle a tué
 *  l'essaim — mais devient DIRECTIONNELLE : porteur vers LE BUT, soutiens en couloirs orientés,
 *  défense CÔTÉ BUT (cover sur la ligne ballon-but, marquage goal-side) ; les gardiens (keeper.js). */
function assignMatchJobs(st, cfg) {
  const { pitch } = st;
  const atk = st.possession.team >= 0 ? st.possession.team : st.lastTouch;
  const carrier = st.players[st.possession.carrier] ?? null;
  const anchor = st.ball.p;

  if (st._whistle) administerWhistle(st, cfg);
  if (cfg.chrono) chronoStep(st, cfg);
  if (cfg.loi12 && st._faute) adjugeFaute(st, cfg);
  if (cfg.loi3 && st.full) stepRemplacements(st, cfg);

  // L'HORLOGE DU REGAIN (cfg.moments — phases.js) : events 'transition'/'placée' SEULS, pas un bit.
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

  // UN VOL MORT EST UN BALLON LIBRE (cfg.deadFlight, 11c11) : la passe morte bascule en 'loose' (~0,3 s), la chasse reprend ; st.pass SURVIT — la Loi 11 juge le premier toucher même d'un ballon mort.
  if (cfg.deadFlight && st.full && st.phase === 'flight' && st.ball.owner == null
    && st.ball.p[1] < 0.25 && Math.hypot(st.ball.v[0], st.ball.v[2]) < cfg.deadFlight) {
    st._deadFlightN = (st._deadFlightN ?? 0) + 1;
    if (st._deadFlightN >= 18) {
      st.phase = 'loose';
      st.events.push({ t: +st.t.toFixed(2), type: 'vol-mort', p: [+st.ball.p[0].toFixed(1), +st.ball.p[2].toFixed(1)] });
      st._deadFlightN = 0;
    }
  } else st._deadFlightN = 0;

  if (cfg.lossReact) {  // LE DÉPOSSÉDÉ SE RETOURNE : la fenêtre s'applique PAR-DESSUS les postes
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
    // LE MATCH EST FINI (chrono) : plus d'ayant droit — le monde SE TIENT (un état terminal propre)
    if (r.type === 'fin') {
      for (const p of st.players) { p.job = 'walk'; p.target = [p.p[0], 0, p.p[2]]; }
      return;
    }
    const rp = r.placed === false ? [st.ball.p[0], st.ball.p[2]] : r.p;   // le rayon : depuis le ballon porté tant que pas posé, du point ensuite
    // LA LOI 14 (cfg.loi14 && st.full) : la CÉRÉMONIE du penalty — tous sauf preneur/gardien HORS surface, HORS arc (9,15), DERRIÈRE le ballon ; un clamp UNE passe ancré à r.p.
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
      // l'EXPULSÉ est hors du monde, remises comprises (Loi 12) ; le REMPLACÉ marche le même chemin
      if (p.expulse || p._sub) {
        const to = p._sub?.phase === 'in' ? p._sub.entry : p._exit;
        p.job = 'walk'; p.target = [to[0], 0, to[1]]; continue;
      }
      // …MAIS D'ABORD ON CÉLÈBRE (lot 116) : le buteur file au coin, les proches le rejoignent (st._celeb, referee)
      if (st._celeb && st.t >= st._celeb.until) st._celeb = null;
      if (st._celeb && p.id === st._celeb.by) { p.job = 'walk'; p.target = [st._celeb.corner[0], 0, st._celeb.corner[1]]; continue; }
      if (st._celeb && st._celeb.avec.includes(p.id)) { const bC = st.players[st._celeb.by]; p.job = 'walk'; p.target = [bC.p[0], 0, bC.p[2]]; continue; }
      // APRÈS UN BUT, ON REVIENT EN MARCHANT (placeKickoff écrivait les douze corps — 20 m en une image) ; UNE REMISE EST UNE RESPIRATION : marche 2,6 m/s.
      if (r.spots && r.spots[p.id] && p.id !== r.taker) { p.job = 'walk'; p.target = [r.spots[p.id][0], 0, r.spots[p.id][1]]; continue; }
      if (p.keeper) {
          if (l14 && p.team === l14.def) { p.job = 'keeper'; p.target = [l14.own.x - l14.own.sign * 0.15, 0, 0]; continue; }
        // LE COUP FRANC ADVERSE PROCHE (lot 94, cfg.appuis && st.full) : le MUR couvre le côté du ballon — le gardien le CÔTÉ OUVERT, près de sa ligne
        const ogK = pitch.ownGoal(p.team);
        if (st.full && cfg.appuis !== false && r.type === 'coup-franc' && r.team !== p.team
          && Math.hypot(rp[0] - ogK.x, rp[1]) < 28) {
          p.job = 'keeper'; p.target = [ogK.x - ogK.sign * 0.7, 0, -Math.sign(rp[1] || 1) * pitch.goalHalf * 0.4];
          p.yawWant = Math.atan2(rp[1] - p.p[2], rp[0] - p.p[0]); continue;
        }
        const s = keeperSpot(pitch, p.team, [rp[0], 0, rp[1]], st.full && cfg.appuis !== false ? { ...KEEPER, appuis: true } : KEEPER);
        p.job = 'keeper'; p.target = [s.x, 0, s.z]; continue;
      }
      if (p.id === r.taker) continue;                               // le preneur a son métier (plus bas)
      // LE PLACEMENT DU CORNER (lot 102, referee.cornerSpots) : les grands montent, le marquage homme, le premier poteau — les corps COURENT en place pendant la pose allongée
      const cSpot = st.full && cfg.corner && r.type === 'corner' ? cornerSpots(st, r, p, cfg) : null;
      if (cSpot) { p.job = 'walk'; p.target = [cSpot[0], 0, cSpot[1]]; continue; }
      if (l14) { l14clamp(p); continue; }                           // la cérémonie vaut pour les DEUX camps
      if (r.type === 'engagement') {
        // chacun DANS SA MOITIÉ (Loi 8) — les positions d'engagement ont été posées ; on les tient
        const sign = pitch.ownGoal(p.team).sign;
        const tx = Math.abs(p.p[0]) < 1 && p.team !== r.team ? sign * 4 : p.p[0];
        p.job = 'walk'; p.target = [tx, 0, p.p[2]];
      } else if (p.team === r.team) {
        // …MAIS PAS AU CORNER (lot 119 : le TAS au coin) : les sans-spot tiennent les SECONDS BALLONS à l'entrée de surface, étagés — le coin au seul tireur.
        if (st.full && cfg.corner && r.type === 'corner') {
          const gC = pitch.attackGoal(p.team), sgC = Math.sign(gC.x || 1), czC = Math.sign(r.p[1] || 1);
          p.job = 'walk'; p.target = [gC.x - sgC * (23 + (p.id % 2) * 5), 0, czC * (3 + ((p.id % 3) - 1) * 8)];
        } else { p.job = 'walk'; p.target = [r.p[0], 0, r.p[1]]; }
      } else {
        // l'adversaire TIENT LE RAYON de la remise (Lois 15/16/17) ; le COUP FRANC plein format tient LE MUR (Loi 13, 9,15 m) : deux défenseurs ligne ballon→but
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
    // LE PRENEUR EST STICKY (re-choisi s'il tombe) : il CHERCHE le ballon où il meurt, le PORTE au point (ballFetch), puis le joue — l'ancien « plus proche du point » re-triait à chaque image.
    let taker = st.players[r.taker ?? -1] ?? null;
    if (!taker || taker.down > 0 || taker.team !== r.team || taker.keeper) {
      taker = st.players.filter((p) => p.team === r.team && !p.keeper && p.down <= 0)
        .sort((a, b) => d2(a.p, st.ball.p) - d2(b.p, st.ball.p))[0] ?? null;
      r.taker = taker ? taker.id : -1;
    }
    if (taker) {
      taker.job = 'receive';
      // il vise le BALLON (la prise au rayon du ballon réel) ; le point de remise seulement pendant qu'il PORTE
      taker.target = r.carried && r.placed === false ? [r.p[0], 0, r.p[1]] : [st.ball.p[0], 0, st.ball.p[2]];
    }
    return;
  }

  // ---- l'EXPULSÉ (Loi 12) : hors du monde, il marche vers sa sortie (filtres down<=0 partout) ; le REMPLACÉ (Loi 3) marche le même chemin — sortie, échange d'identité, entrée.
  for (const p of st.players) if (p.expulse || p._sub) {
    const to = p._sub?.phase === 'in' ? p._sub.entry : p._exit;
    p.job = 'walk'; p.target = [to[0], 0, to[1]];
  }

  // ---- les gardiens (toujours, toutes phases)
  for (const gk of st.players.filter((p) => p.keeper && !p.expulse && !p._sub)) {
    gk.job = 'keeper';
    // LE GARDIEN PORTEUR EST UN DISTRIBUTEUR, PAS UN POSTE (CSC mesuré en marchant vers sa ligne) : il s'écarte du but, le cerveau distribue.
    if (carrier && carrier.id === gk.id) {
      const g = pitch.ownGoal(gk.team);
      // LE DISTRIBUTEUR VÉRIFIE SES MAINS : un ballon qui FUIT vers son but = mensonge (le CSC vivait ici) — pas en mains, on se retourne et on l'étouffe.
      const bdC = Math.hypot(gk.p[0] - st.ball.p[0], gk.p[2] - st.ball.p[2]);
      // …une FUITE = hors portée de touche (2,2 m) ou filant vers son but — PAS la touche de conduite (0,9 re-déclenchait, 20-43 m mesurés).
      if (st.ball.owner !== gk.id && (bdC > 2.2 || st.ball.v[0] * g.sign > 1.5)) {
        gk.job = 'keeper';
        gk.target = [st.ball.p[0] + st.ball.v[0] * 0.25, 0, st.ball.p[2] + st.ball.v[2] * 0.25];
        gk.push = null;
        continue;
      }
      // LE GARDIEN NE DRIBBLE PAS — IL DISTRIBUE (épisodes de 45-87 m mesurés) : le SPOT devant sa ligne, jamais plus loin…
      gk.job = 'carry';
      gk.touchF = cfg.carryTight ?? 1;                             // le ballon en mains ne s'échappe pas
      // …l'échéance des six secondes court DEBOUT (lot 91, clé keeperRise) : un gardien couché ne distribue pas — sans la garde, le down rallongé puntait depuis le sol
      gk._gkSince = (st.full && cfg.keeperRise !== false && gk.down > 0) ? st.t : (gk._gkSince ?? st.t);
      // …et le spot vit AU COIN des six mètres, JAMAIS sur l'axe (z ±3,5 = la bouche du but : CSC mesuré ; hors axe il meurt en sortie de but).
      const spotD = [g.x - g.sign * 4.5, (gk.p[2] >= 0 ? 1 : -1) * (pitch.goalHalf + 2.1)];
      if (bdC > 0.85) {
        // LE GARDIEN AUSSI PASSE PAR SON BALLON (viser le spot en l'abandonnant à 2 m gelait le
        // monde — épisodes de 73 et 84 s mesurés, distribution jamais armable).
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
      // …LA RÈGLE DES SIX SECONDES (Loi 12.2, cfg.gkRelease) : passe organique, au délai FORCÉE
      // (rampe, sinon PUNT) ; et l'espace presse la relance (lot 89 : sans presseur, 1,2 s).
      let gkDue = cfg.gkRelease;
      if (st.full && cfg.gkRelease) {
        let pr = 99; for (const q of st.players) if (q.team !== gk.team && !q.keeper && q.down <= 0) pr = Math.min(pr, Math.hypot(q.p[0] - gk.p[0], q.p[2] - gk.p[2]));
        if (pr > 12) gkDue = Math.min(cfg.gkRelease, 1.2);
      }
      // LA DISTRIBUTION vit chez le gardien (keeper.relancerGardien, lot 150) : le barème
      // d'hier au bit + les styles par équipe (cpa.sortieBut) et les notes kicking/throwing
      if (cfg.gkRelease && st.t - gk._gkSince > gkDue && !busy(gk) && bdC < 1.1)
        relancerGardien(st, gk, cfg, { beginPass: simInternals.beginPass });
      continue;
    }
    gk._gkSince = null;
    if (busy(gk)) continue;                                        // un plongeon possède son corps
    const shotAge = st.pass ? st.t - st.pass.t : Infinity;
    let K = gk.skill ? { ...KEEPER, diveReach: gk.skill.keeperReach, reflex: gk.skill.keeperReflex } : KEEPER;   // le GARDIEN NOTÉ (keeping) — sinon le métier moyen
    // LES APPUIS (lot 94) : bissectrice à la note, profondeur au rôle garde, SET, duel posé.
    if (st.full && cfg.appuis !== false) {
      const ownr = st.ball.owner != null ? st.players[st.ball.owner] : null;
      K = { ...K, appuis: true, posMixF: gk.skill?.posMixF ?? 1, depthF: gk.skill?.depthKF ?? 1,
        gardeF: axe(role(gk).garde, 0.7, 1.3), vGk: Math.hypot(gk.v[0], gk.v[1]), porte: !!ownr && ownr.team !== gk.team,
        // …libéro (120) : une LECTURE — jamais sur CPA (le corner défensif vit à 34 m) ; SA possession : plein ; adverse LOINTAINE (> tient 48 m) : demi-garde 0,6 ; adverse qui avance : cible basse, le backpedal fait la fenêtre du lob
        libero: cfg.libero, liberoGate: st.restart ? 0 : st.possession.team === gk.team ? 1 : Math.hypot(st.ball.p[0] - pitch.ownGoal(gk.team).x, st.ball.p[2]) > (cfg.libero?.tient ?? 48) ? 0.6 : 0 };
    }
    // LE CÔNE DE SORTIE (lot 104, cfg.sortie1v1 && st.full) : K.cone + la couverture goal-side mesurée (keeper.js)
    if (st.full && cfg.sortie1v1) K = { ...K, cone: cfg.sortie1v1, couvertD: keeperCouvert(st.players, gk, pitch.ownGoal(gk.team), st.ball.p) };
    // LA SORTIE DANS LES PIEDS : un ballon AU SOL à portée de gants se RAMASSE — même « porté ».
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
    // la MENACE se lit au dernier contact ; le SPIN se lit (lot 39) — shotVariety:false = hier au bit
    const dec = keeperDecide(pitch, gk.team, [gk.p[0], 0, gk.p[2]], st.ball.p, st.ball.v, shotAge, K, st.lastTouch !== gk.team,
      cfg.shotVariety !== false ? Math.hypot(st.ball.w[0], st.ball.w[1], st.ball.w[2]) : null);
    const honneur = st.full && cfg.honneur !== false && dec.mode === 'battu' && dec.cross   // LE PLONGEON D'HONNEUR (132) : battu proche + cadré → le geste part ; false : le spectateur
      && Math.abs(dec.cross.z - gk.p[2]) <= K.diveReach * (cfg.honneur?.portee ?? 1.7)
      && dec.cross.t <= (K.diveTime ?? 0.9);
    if ((dec.mode === 'dive' || honneur) && gk.down <= 0) {
      const cross = dec.cross;
      // L'ESPÈCE DE LA PARADE (lot 93) : haut ≥ 1,35 → plongeonPrise ; ras < 0,85 → plongeonBas ; loin > 1,35 m → plongeonUneMain ; sinon deux mains. Éteinte : hier.
      const par93 = st.full && cfg.parades !== false;
      const espece = par93 && (cross.y ?? 0) >= 1.35 ? 'plongeonPrise'
        : (cross.y ?? 0) < 0.85 ? 'plongeonBas'
        : par93 && Math.abs(cross.z - gk.p[2]) > 1.35 ? 'plongeonUneMain' : 'plongeon';
      const move = { id: espece, duration: MOVES[espece].duration, contact: MOVES[espece].contact };
      const lunge = [(pitch.ownGoal(gk.team).x - gk.p[0]) * 0.2, cross.z - gk.p[2]];
      const L = Math.hypot(lunge[0], lunge[1]) || 1;
      // LE CÔTÉ DU CLIP EST RELATIF AU REGARD RÉEL, pas au monde (« cross.z > gk.z → gauche »
      // jouait la moitié des plongeons à l'envers) : le produit vectoriel regard × détente.
      const fxK = Math.cos(gk.yaw), fzK = Math.sin(gk.yaw);
      const sideFoot = (fxK * (lunge[1] / L) - fzK * (lunge[0] / L)) > 0 ? 'left' : 'right';
      startGesture(gk, move, {
        payload: { kind: 'skill', skill: 'plongeon', ownsBody: true, pick: { foot: sideFoot },
          lunge: [lunge[0] / L, lunge[1] / L], speed: Math.min(6.5, (Math.abs(cross.z - gk.p[2]) / Math.max(0.15, cross.t)) * 1.1), cross,
          // la détente couvre SA distance, bornée au ROOT MOTION du bassin (1,35 m) : au-delà
          // c'est le métier des BRAS (gants à 2,1 par l'IK + warp), pas un corps qui glisse.
          lungeMax: Math.min(1.35, Math.abs(cross.z - gk.p[2]) + 0.2) },
        log: st.gestures,
      });
      gk.yawWant = Math.atan2(st.ball.p[2] - gk.p[2], st.ball.p[0] - gk.p[0]);
      // le contrat du relevé (gk.rise) se stampe DÈS LE DÉPART (sans ça : 2 453°/s mesurés —
      // le relevé joué pendant l'acte, puis le down claquait le corps au sol en une image).
      if (st.full && cfg.keeperRise !== false && espece !== 'plongeonPrise') { const R = keeperRise(gk.skill?.getupF ?? 1, true); gk.rise = { ground: R.ground, getup: R.getup }; }
      st.events.push({ t: +st.t.toFixed(2), type: 'windup', by: gk.id, move: espece, foot: sideFoot, skill: 'plongeon', anticipation: move.contact, ...(par93 ? { mains: espece === 'plongeonUneMain' ? 1 : 2 } : {}) });
      st.events.push({ t: +st.t.toFixed(2), type: 'dive', by: gk.id, crossZ: +cross.z.toFixed(2), crossT: +cross.t.toFixed(2), ...(honneur ? { honneur: true } : {}) });
      continue;
    }
    // 'battu' n'a pas de spot (l'état honnête) : le gardien se replace quand même sur sa loi
    const s = dec.spot ?? keeperSpot(pitch, gk.team, st.ball.p);
    gk.job = 'keeper'; gk.target = [s.x, 0, s.z];
    gk.yawWant = Math.atan2(st.ball.p[2] - gk.p[2], st.ball.p[0] - gk.p[0]);
  }

  // LA BOUCLE CHAUDE N'ALLOUE PLUS (lot 69 — les filter/map/sort par frame nourrissaient le
  // GC du téléphone : buffers réutilisés + boucles inline, flux au bit près — empreinte sha256)
  const field = st._bField ??= [], attackers = st._bAtk ??= [], defenders = st._bDef ??= []; field.length = 0; attackers.length = 0; defenders.length = 0;
  // à 10 après un rouge (Loi 12) ; le remplacé en chemin est hors des postes (Loi 3)
  for (const p of st.players) if (!p.keeper && !p.expulse && !p._sub) { field.push(p); (p.team === atk ? attackers : defenders).push(p); }
  // LE RECEVEUR ATTAQUE SA PASSE (le trou fondateur : il trottait vers son slot, 21 % reçues).
  const flightRec = (st.phase === 'flight' && st.pass && st.pass.to >= 0) ? st.players[st.pass.to] : null;
  const goal = pitch.attackGoal(atk);
  const own = pitch.ownGoal(atk === 0 ? 1 : 0);                    // le but que la défense protège
  void own;

  // ---- LE BALLON LIBRE EST CHASSÉ PAR LES DEUX CAMPS : le plus proche de chaque camp court.
  const bSpd = Math.hypot(st.ball.v[0], st.ball.v[2]);
  // L'HORLOGE DU 50/50 (lot 153) : le front de la phase loose s'horodate — le PREMIER PAS
  // se paie à la réaction personnelle (movement.premierPas). Pur, aucun tirage.
  if (st.phase === 'loose') { if (!st._loosePh) st._looseAt2 = st.t; st._loosePh = true; } else st._loosePh = false;
  const freeBall = cfg.chaseLoose !== false && !carrier && (st.phase === 'loose' || !st.pass || st.pass.to < 0);
  const leadK = Math.min(6, bSpd * 0.7);
  const leadP = bSpd > 1.5
    ? [Math.max(-pitch.hx + 0.8, Math.min(pitch.hx - 0.8, anchor[0] + (st.ball.v[0] / bSpd) * leadK)),
      Math.max(-pitch.hz + 0.8, Math.min(pitch.hz - 0.8, anchor[2] + (st.ball.v[2] / bSpd) * leadK))]
    : [anchor[0], anchor[2]];
  let hunter = null;
  if (freeBall) {
    // …JAMAIS le gardien (lot 89, st.full — un ballon de champ n'est pas le sien : le hunter
    // l'envoyait chasser à 20-30 m puis porter au coin des six, « il court en corner »)
    let hD = Infinity; for (const p of attackers) if (p.down <= 0 && !(st.full && p.keeper)) { const d = d2(p.p, st.ball.p); if (d < hD) { hD = d; hunter = p; } }
    // LA CONDUITE SE TIENT (lot 104, cfg.tenue && st.full) : le ballon qu'il vient de pousser reste SA course
    // (< temps s, à portée) — un coéquipier ne la vole qu'avec une VRAIE avance (marge). Absente : l'hier au bit.
    if (st.full && cfg.tenue && st._exCarrier && st.t - st._exCarrier.t < (cfg.tenue.temps ?? 1.5)) {
      const ex = st.players[st._exCarrier.id];
      if (ex && ex.team === atk && ex.down <= 0 && !ex.keeper && !ex.expulse) {
        const dEx = d2(ex.p, st.ball.p);
        if (dEx < (cfg.tenue.portee ?? 6) && hD > dEx - (cfg.tenue.marge ?? 2.5)) hunter = ex;
      }
    }
    if (hunter) {
      // une cueillette SANS course adverse se trotte (bucket support) : le sprint systématique à
      // 6,9 poussait les corps à 9,9 km/h — on ne pique un sprint que si le 50/50 est réel
      let foeD = Infinity;
      for (const q of defenders) if (q.down <= 0) foeD = Math.min(foeD, Math.hypot(q.p[0] - leadP[0], q.p[2] - leadP[1]));
      const myD = Math.hypot(hunter.p[0] - leadP[0], hunter.p[2] - leadP[1]);
      hunter.job = foeD > myD + 2.5 ? 'support' : 'receive';
      hunter.target = [leadP[0], 0, leadP[1]];
    }
  }

  // ---- l'attaque : porteur poussé VERS LE BUT, couloirs orientés
  for (const p of attackers) {
    if (carrier && p.id === carrier.id) {
      p.job = 'carry';
      // CONDUITE SERRÉE PAR DÉFAUT : touche pleine en rupture nommée (burst) seulement ; et
      // POURSUIVIE (défenseur ≤ 2,2 m) elle COLLE (cfg.carryGuard — « bien trop loin du pied »).
      let foeGuard = 99;
      for (const q of st.players) if (q.team !== p.team && !q.keeper && q.down <= 0) foeGuard = Math.min(foeGuard, Math.hypot(q.p[0] - p.p[0], q.p[2] - p.p[2]));
      p.touchF = (p._prepShot ?? -1) > st.t ? (cfg.prepTouchF ?? 0.3)   // la préparation SERRE
        : foeGuard <= 2.2 ? (cfg.carryGuard ?? ((p._pace?.until ?? -1) > st.t ? 1 : (cfg.carryTight ?? 1)))
        : (p._pace?.until ?? -1) > st.t ? 1
        : (cfg.carryTight ?? 1);
      // …et la PROTÉGÉE AMORTIT (guardDamp) EN COURSE seulement (v ≥ 4) : amorti, le ballon
      // reste sous le pied ; au trot, amortir créait des excursions lentes (4,5 s/min mesurés).
      p.touchDamp = (p._prepShot ?? -1) > st.t ? (cfg.prepDamp ?? 0.72)
        : foeGuard <= 2.2 && p.speed >= 4 ? (cfg.guardDamp ?? 0.88) : 1;
      const ev = evadeSpot(st, p, cfg);
      // L'AILIER À ANGLE FERMÉ REPIQUE DANS L'AXE (cut-inside — 195 refus angle-fermé mesurés par
      // lot) : le point de mire devient l'ENTRÉE DE SURFACE côté axe jusqu'à ce que l'angle s'ouvre.
      const sgnG = Math.sign(goal.x || 1);
      const wideClosed = Math.abs(p.p[2]) > pitch.goalHalf + 3 && p.p[0] * sgnG > pitch.hx - pitch.dims.box.depth - 4;
      // …et le repique choisit selon LA BOÎTE : coureurs dedans → large et on SERT ; vide → on
      // rentre (le cut-inside aspirait toutes les ailes : 6 centres retombés à 2).
      const boxXr = pitch.hx - pitch.dims.box.depth;
      const boxMate = wideClosed && st.players.some((q) => q.team === p.team && !q.keeper && q.id !== p.id
        && q.down <= 0 && q.p[0] * sgnG > boxXr - 1.5 && Math.abs(q.p[2]) < pitch.dims.box.width / 2 + 1.5);
      // LE COULOIR SE TIENT (lot 105, cfg.conduiteCouloir — 67 % des touches d'aile repiquaient) : le porteur
      // latéral progresse DANS son couloir ; pied/largeurR/axe largeur modulent. Absente : l'aim [but, 0] d'hier.
      let aimZ = 0;
      if (st.full && cfg.conduiteCouloir && Math.abs(p.p[2]) > (cfg.conduiteCouloir.z ?? 12) && !wideClosed) {
        const inv = (Math.sign(p.p[2] * -(goal.x || 1)) > 0) === ((p.strongFoot ?? 'right') === 'right');
        const tient = (cfg.conduiteCouloir.tient ?? 0.75) * (inv ? (cfg.conduiteCouloir.inverse ?? 0.55) : 1)
          * axe(role(p).largeurR, 0.8, 1.2) * axe(tac(st, atk).largeur, 0.85, 1.15);
        aimZ = Math.sign(p.p[2]) * Math.min(Math.abs(p.p[2]), pitch.hz * 0.55) * Math.max(0, Math.min(1, tient));
      }
      const aim = wideClosed && !boxMate ? [goal.x - sgnG * pitch.dims.box.depth * 0.6, p.p[2] * 0.15] : [goal.x, aimZ];
      const gx = aim[0] - p.p[0], gz = aim[1] - p.p[2];
      const gl = Math.hypot(gx, gz) || 1;
      // devant dégagé → cap au but ; bouché → l'évasion ; LE MUET REND LE CAP (lot 92) : ×0,25.
      let front = 0;
      for (const q of defenders) if (Math.sign(q.p[0] - p.p[0]) === Math.sign(gx) && Math.abs(q.p[0] - p.p[0]) < 6 && Math.abs(q.p[2] - p.p[2]) < 4) front++;
      let wGoal = front === 0 ? 0.8 : front === 1 ? 0.5 : 0.25;
      const mR92 = st.full && cfg.menace?.muteD ? cfg.menace.muteD * (p.skill?.composureF ?? 1) : 0;
      if (mR92 && p._takeP && Math.hypot(p.p[0] - p._takeP[0], p.p[2] - p._takeP[1]) > mR92) wGoal *= 0.25;
      let px = (gx / gl) * wGoal, pz = (gz / gl) * wGoal;
      if (ev) { const ex = ev[0] - p.p[0], ez = ev[2] - p.p[2]; const el = Math.hypot(ex, ez) || 1; px += (ex / el) * (1 - wGoal); pz += (ez / el) * (1 - wGoal); }
      // LA CHALOUPE (lot 110, cfg.chaloupe && st.full) : le porteur contesté-et-lancé OSCILLE
      // (sin seedé par identité), × gesteF × arbitre.conduite. Absente : le cap droit d'hier.
      if (st.full && cfg.chaloupe && foeGuard < (cfg.chaloupe.foe ?? 4) && p.speed > (cfg.chaloupe.v ?? 1.5)) {
        const o = Math.sin(st.t * (cfg.chaloupe.freq ?? 8.5) + p.id * 2.1)
          * (cfg.chaloupe.amp ?? 0.55) * (p.skill?.gesteF ?? 1) * (role(p).arbitre?.conduite ?? 1);
        const pl0 = Math.hypot(px, pz) || 1;
        px += (-pz / pl0) * o; pz += (px / pl0) * o;
      }
      const pl = Math.hypot(px, pz) || 1;
      // LA POUSSÉE SE LISSE (EMA τ 0,35 s) : l'évasion 60 Hz zigzaguait — l'intention d'abord.
      const raw = [px / pl, pz / pl];
      const a = 1 - Math.exp(-(1 / 60) / 0.35);
      p._pushS = p._pushS ? [p._pushS[0] + (raw[0] - p._pushS[0]) * a, p._pushS[1] + (raw[1] - p._pushS[1]) * a] : raw;
      const sl = Math.hypot(p._pushS[0], p._pushS[1]) || 1;
      p.push = [p._pushS[0] / sl, p._pushS[1] / sl];
      // …ET L'ÉVASION NE TRAVERSE PAS SA PROPRE SURFACE (CSC mesurés) : l'acculé fuit LE LONG de la ligne —
      // < 22 m du but propre, la composante vers lui se plafonne, la poussée se rabat en latérale.
      {
        const og = pitch.ownGoal(p.team);
        const sOwn = Math.sign(og.x || 1);
        // …au rayon À L'ÉCHELLE DU TERRAIN (0,42·hx, plafonné 22) : le 22 m plat couvrait un TIERS du
        // réduit et étouffait sa conduite (tempsLoin 7,1 > 2,5 — la sentinelle, encore elle)
        if (Math.hypot(og.x - p.p[0], p.p[2]) < Math.min(22, pitch.hx * 0.42) && p.push[0] * sOwn > 0.35) {
          const lat = Math.sign(p.push[1] || (p.p[2] >= 0 ? 1 : -1));
          p.push = [sOwn * 0.35, lat * Math.sqrt(1 - 0.35 * 0.35)];
          p._pushS = [p.push[0], p.push[1]];
        }
      }
      // LE PORTEUR PASSE PAR SON BALLON (cfg.carryViaBall) : la cible était la POUSSÉE PROJETÉE même ballon
      // derrière (5,9 % hors cône mesuré). Hors portée de contrôle, la cible EST le ballon, un demi-pas au-delà.
      const dBall = Math.hypot(p.p[0] - st.ball.p[0], p.p[2] - st.ball.p[2]);
      if (cfg.carryViaBall !== false && dBall > 0.85) {
        // …et pendant la TOUCHE DE PRÉPARATION, on vise AU TRAVERS du ballon (2,2 m au-delà — à +0,4 m
        // l'amorti s'équilibrait avec sa décélération, bd cloué 1,2-1,3 m : le geste accélère À TRAVERS).
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
    let met = null;   // le pas au contact (meetBall) : un pas et demi sur l'AXE NOMINAL (flipper consigné)
    const dInb = Math.hypot(flightRec.p[0] - st.ball.p[0], flightRec.p[2] - st.ball.p[2]);
    // LE BALLON RÉEL COMMANDE À PORTÉE (lot 134, cfg.meetReel && st.full — le receveur du ballon DÉVIÉ courait
    // au lead nominal fantôme). Divergé (> div), bas, proche : on joue LE BALLON (mène 0,12 s). false : hier.
    if (!met && st.full && cfg.meetReel !== false && dInb < (cfg.meetZone ?? 4.5) && st.ball.p[1] < 0.9
      && Math.hypot(st.ball.p[0] - st.pass.lead[0], st.ball.p[2] - st.pass.lead[2]) > (cfg.meetReel?.div ?? 2.5)) {
      const bR = Math.hypot(st.ball.v[0], st.ball.v[2]), mR = Math.min(1.2, bR * 0.12);
      met = bR > 0.3 ? [st.ball.p[0] + (st.ball.v[0] / bR) * mR, 0, st.ball.p[2] + (st.ball.v[2] / bR) * mR]
        : [st.ball.p[0], 0, st.ball.p[2]];
    }
    if (!met && cfg.meetBall !== false && dInb < (cfg.meetZone ?? 4.5)) {
      const bx = st.ball.p[0] - st.pass.lead[0], bz = st.ball.p[2] - st.pass.lead[2];
      const bl = Math.hypot(bx, bz);
      if (bl > 0.3) {
        const step = Math.min(cfg.meetStep ?? 1.3, dInb * 0.55);   // il avance ENCORE au contact
        met = [st.pass.lead[0] + (bx / bl) * step, 0, st.pass.lead[2] + (bz / bl) * step];
      }
    }
    // LA PASSE CONTESTÉE S'ATTAQUE (lot 81) : menace lue après sa RÉACTION (attribut), il
    // SPRINTE (burst 'attaque') au BALLON RÉEL — un vrai 50/50. attaquePasse:false = hier.
    let menace = false;
    if (st.full && cfg.attaquePasse !== false && (st.pass.flight ?? 0) > 0
      && st.t - st.pass.t > (flightRec.skill?.reaction ?? 0.18)) {
      let dFoe = 99;
      for (const q of st.players) if (q.team !== flightRec.team && !q.keeper && q.down <= 0)
        dFoe = Math.min(dFoe, Math.hypot(q.p[0] - st.pass.lead[0], q.p[2] - st.pass.lead[2]));
      const dRec = Math.hypot(flightRec.p[0] - st.pass.lead[0], flightRec.p[2] - st.pass.lead[2]);
      menace = dFoe < dRec + (cfg.attaquePasse?.marge ?? 2);
      if (menace && !st.pass._attacked && (flightRec._pace?.until ?? -1) < st.t) {
        st.pass._attacked = true; flightRec._pace ??= { until: -1, next: 0 };
        flightRec._pace.until = st.t + 0.8; flightRec._pace.kind = 'attaque';
        st.events.push({ type: 'burst', kind: 'attaque', by: flightRec.id, t: +st.t.toFixed(2) });
      }
    }
    // …ET LA PASSE MOURANTE SE VA CHERCHER (filmé : morte à 2 m d'un receveur PLANTÉ, cible
    // verrouillée sur une mène jamais atteinte). Ballon au sol, lent, loin : cible = POINT D'ARRÊT.
    const bSp = Math.hypot(st.ball.v[0], st.ball.v[2]);
    if (st.full && cfg.attaquePasse !== false && st.ball.p[1] < 0.5
      && bSp < (cfg.attaquePasse?.mort ?? 2.8)
      && Math.hypot(st.ball.p[0] - st.pass.lead[0], st.ball.p[2] - st.pass.lead[2]) > 1.5
      && st.t - st.pass.t > (flightRec.skill?.reaction ?? 0.18)) {
      const stop = Math.min(3, bSp * bSp / 3.6);
      met = bSp > 0.3 ? [st.ball.p[0] + (st.ball.v[0] / bSp) * stop, 0, st.ball.p[2] + (st.ball.v[2] / bSp) * stop]
        : [st.ball.p[0], 0, st.ball.p[2]];
    } else if (menace && st.ball.p[1] < 0.9) {
      // sous menace on court AU ballon (mène 0,12 s — 0,35 visait le point futur : filmé
      // perdant la course d'un cheveu, le voleur au ballon, le receveur 2 m devant)
      const mk = Math.min(1.2, bSp * 0.12);
      met = bSp > 0.3 ? [st.ball.p[0] + (st.ball.v[0] / bSp) * mk, 0, st.ball.p[2] + (st.ball.v[2] / bSp) * mk]
        : [st.ball.p[0], 0, st.ball.p[2]];
    }
    // LE RATTRAPAGE VISE AU TRAVERS (lot 134, cfg.rattrape && st.full — filmé : le receveur ORBITE 2-5 s derrière
    // la passe qui FUIT, la mène matchait sa vitesse). PRIME quand le ballon fuit vite (≥ mort). false : l'orbite.
    if (st.full && cfg.rattrape !== false && dInb < 8 && st.ball.p[1] < 0.9) {
      const bF = Math.hypot(st.ball.v[0], st.ball.v[2]);
      const fuit = bF >= (cfg.attaquePasse?.mort ?? 2.8)
        && ((st.ball.p[0] - flightRec.p[0]) * st.ball.v[0] + (st.ball.p[2] - flightRec.p[2]) * st.ball.v[2]) / (bF * Math.max(0.1, dInb)) > 0.5;
      if (fuit) {
        const tR = Math.min(2, dInb / Math.max(0.8, (cfg.speeds.chase ?? 6.9) - bF));
        const mg = (cfg.rattrape?.marge ?? 1.5) / bF;
        met = [st.ball.p[0] + st.ball.v[0] * (tR + mg), 0, st.ball.p[2] + st.ball.v[2] * (tR + mg)];
      }
    }
    // LE RECEVEUR VIVANT (meetWalk) : il vient AU-DEVANT en marchant ; hold ~30 derniers m : il TIENT (tirs 27 → 16 sans).
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
    // UN VOL LONG SE REÇOIT À SA CHUTE PRÉDITE (lot 52, cfg.chutePredite — 68 % des longs en
    // chasse au rebond avant) : le premier point JOUABLE du chemin prédit. false : hier.
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
    let sa = anchor;   // ancre lente des soutiens (lot 85, slotAnchor ÉTEINTE — doc : config)
    if (st.full && cfg.slotAnchor !== false) {
      const A = st._sAnc ??= { x: anchor[0], z: anchor[2], t: st.t };
      const k = Math.min(1, Math.max(0, st.t - A.t) / (cfg.slotAnchor?.tau ?? 1.5));
      A.x += (anchor[0] - A.x) * k; A.z += (anchor[2] - A.z) * k; A.t = st.t;
      sa = st._sAncP ??= [0, 0, 0]; sa[0] = A.x; sa[2] = A.z;
    }
    // L'AILE HAUTE REMPLIT LA SURFACE : ballon LARGE et HAUT → les postes du centre, armés TÔT
    // — seuls les SLOTTERS les prennent ; le box crash (123) envoie les corps AVANCÉS, lui.
    const wideDeep = Math.abs(sa[2]) > pitch.hz * 0.38 && sa[0] * sgn > pitch.hx * 0.25;
    const zs = Math.sign(sa[2] || 1);
    // …et les postes vivent DEVANT le but, pas SUR la ligne (le pinball de goal-mouth : 13 buts
    // sans tir mesurés) — premier poteau à l'épaule des six mètres, second au penalty.
    const slots = st._bSlots ??= [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]];   // 5 paires réutilisées (lot 69)
    const S5 = (i, x, z) => { slots[i][0] = Math.max(-pitch.hx + 1.2, Math.min(pitch.hx - 1.2, x)); slots[i][1] = Math.max(-pitch.hz + 1.2, Math.min(pitch.hz - 1.2, z)); };
    if (wideDeep) {   // premier/second poteau, penalty, sécurité, soutien de couloir
      S5(0, goal.x - sgn * (pitch.dims.six.depth + 1.5), zs * (pitch.goalHalf + 0.6)); S5(1, goal.x - sgn * 5.5, -zs * (pitch.goalHalf + 1.2));
      S5(2, goal.x - sgn * pitch.dims.spot, 0); S5(3, sa[0] - sgn * 7, sa[2] * 0.5); S5(4, sa[0] - sgn * 1.5, zs * pitch.hz * 0.6);
    } else {          // lanceur intérieur/opposé, sécurité, largeur, second rideau
      // …l'AMPLITUDE du soutien (lot 103 : supportSpanFull réactivée en MULTIPLICATEUR — 0/absente = ×1 l'identité au bit ; 1,25 = l'air autour du ballon) × l'axe relation (lot 83)
      const K = st.full ? (cfg.supportSpanFull || 1) * axe(tac(st, atk).relation, 1.35, 0.65) : 1;
      S5(0, sa[0] + sgn * 8 * K, sa[2] < 0 ? sa[2] + 6 * K : sa[2] - 6 * K); S5(1, sa[0] + sgn * 7 * K, sa[2] < 0 ? sa[2] - 5 * K : sa[2] + 5 * K);
      S5(2, sa[0] - sgn * 6 * K, sa[2] * 0.5); S5(3, sa[0] + sgn * 2 * K, sa[2] > 0 ? -pitch.hz * 0.55 : pitch.hz * 0.55); S5(4, sa[0] + sgn * 4 * K, sa[2] * -0.6);
    }
    if (st.full && cfg.triangle !== false && !wideDeep) triangule(slots, sa, cfg.triangle?.min ?? 35, pitch.hx, pitch.hz);   // lot 84, ÉTEINTE
    const free = st._bFree ??= []; free.length = 0;
    for (const p of attackers) if ((!carrier || p.id !== carrier.id) && p !== flightRec && p !== hunter) free.push(p);
    // EN 11C11 : les couloirs dynamiques sont RÉSERVÉS au soutien rapproché (les plus près de
    // l'ancre) — le reste du monde tient SON poste de formation coulissé (le bloc).
    let slotters = free, posted = [];
    if (st.full) {
      // tri à clés TRANSIENTES pré-calculées (lot 60 — d2 recalculé par comparaison à 60 Hz) ; sort stable, mêmes clés → l'ordre d'hier
      const bs = st._bSlotters ??= []; bs.length = 0;
      for (const q of free) { q._dAnc = d2(q.p, sa); bs.push(q); }
      bs.sort((a, b) => a._dAnc - b._dAnc);
      // LE SOUTIEN EST UN PETIT COMITÉ (lot 103, cfg.soutienN — « trop dense au milieu » : 4 slotters + porteur = 5 corps au ballon, largeur
      // 38 m vs 45-60 réel ; le réel soutient à 2-3, les libérés TIENNENT LA STRUCTURE — relation module ±1). Absente : les 4 d'hier au bit.
      const nSout = cfg.soutienN != null ? Math.round(axe(tac(st, atk).relation, cfg.soutienN - 1, cfg.soutienN + 1)) : 4;
      if (bs.length > nSout) bs.length = nSout;
      slotters = bs; posted = st._bPosted ??= []; posted.length = 0;
      for (const p of free) if (!slotters.includes(p)) posted.push(p);
      // …chaînée au ballon en attaque (51), latéralement (68) ; l'ancre de rentrée LENTE (τ 2 s, x vif) : la ligne se referme sur l'aile INSTALLÉE.
      const tz = st._tuckZ ??= { v: 0, t: st.t };
      tz.v += (anchor[2] - tz.v) * Math.min(1, Math.max(0, st.t - tz.t) / 2); tz.t = st.t;
          const blocA = blocFor(cfg.bloc ?? null, tac(st, atk));   // LA POUSSE (141, cfg.pousse && st.full) : la ligne arrière attaquante franchit le rond, gain × axe hauteurBloc
      if (blocA && st.full && cfg.pousse) blocA.pousse = { gain: (cfg.pousse.gain ?? 0.8) * axe(tac(st, atk).hauteurBloc, 0.3, 1.7), des: cfg.pousse.des, max: cfg.pousse.max };
      const spots = formationSpots(pitch, atk, anchor[0], true, formationPour(tac(st, atk).formation, true), blocA, tz.v, st._outAtk ??= []);   // la formation ON (129)
      // LA LOI 11 CALE LES POINTES (cfg.offside) : un poste coulissé peut tomber DERRIÈRE la
      // défense — l'attaquant réel vit SUR la ligne. Relue CHAQUE image ; le calage borne la CIBLE.
      const off = cfg.offside ? offsideLine(st, atk) : null;
      // …ET L'APPEL SE TIME SUR LE PASSEUR (lot 41, cfg.appelPret) : on appelle quand le porteur PEUT
      // donner — ballon au pied ≤ appelPret m (avant p50 1,43 s). false : l'appel aveugle d'hier.
      const posé = carrier && !carrier.keeper && st.phase === 'carry' && st.hold > 0.6
        && (cfg.appelPret === false || d2(st.ball.p, carrier.p) <= (cfg.appelPret ?? 1.0));
      // LA VERTICALITÉ DU REGAIN (cfg.moments) : en transition offensive (bloc adverse déformé), le
      // cooldown des appels profonds se relâche de 2,5 s — la profondeur se joue MAINTENANT
      const transOff = cfg.moments && st._possTeam === atk
        && st.t - (st._possChangeAt ?? -99) < (cfg.moments.win ?? 5);
      for (const p of posted) {
        const want = spots[p.post ?? 0] ?? [p.p[0], p.p[2]];
        p.job = 'support';
        const drift = p._slotT ? Math.hypot(want[0] - p._slotT[0], want[1] - p._slotT[1]) : Infinity;
        if (!p._slotT || (drift > 3.5 && (!(st.full && cfg.assignTenue !== false) || st.t >= (p._slotHold ?? 0) || (p._pace?.until ?? -1) > st.t) && ((p._slotHold = st.t + (cfg.assignTenue?.slot ?? 1.2)), true)) || ((p._slotAt ?? -1) <= st.t && drift > 0.8 && drift <= 3.5)) {
          p._slotT = [want[0], want[1]]; p._slotAt = st.t + 0.7;   // copie (lot 69 : want vit en buffer)
        }
        let tx = p._slotT[0], tz = p._slotT[1];
        // LA LARGEUR (tactics.largeur) : l'amplitude des postes offensifs — jouer dedans
        // (×0,85) ou écarter le bloc (×1,15, le jeu d'ailes). 0,5 = ×1, l'identité.
        const lF = axe(tac(st, atk).largeur, 0.85, 1.15);
        if (lF !== 1) tz = Math.max(-pitch.hz + 1.5, Math.min(pitch.hz - 1.5, tz * lF));
        // …ET LE RÔLE NUANCE SON POSTE (roles.js) : profondeur ±2,5 m (le 9 haut, le 10 décroche —
        // le calage Loi 11 garde le dernier mot) et largeur personnelle ×0,9…1,1. Aucun rôle : pas un bit.
        const R = role(p);
        const pf = axe(R.profondeur, -2.5, 2.5);
        if (pf) tx = Math.max(-pitch.hx + 1.2, Math.min(pitch.hx - 1.2, tx + -pitch.ownGoal(atk).sign * pf));
        const wR = axe(R.largeurR, 0.9, 1.1);
        if (wR !== 1) tz = Math.max(-pitch.hz + 1.5, Math.min(pitch.hz - 1.5, tz * wR));
        // …les POINTES sont celles de LA formation (LIGNES — « ≥ 7 » n'était vrai qu'en 4-3-3)
        if (off && (p.post ?? 0) >= premierOffensif(formationPour(tac(st, atk).formation, true))) {
          // …ET L'APPEL TIMÉ JAILLIT DE LA LIGNE : suivi ou rien (pointe ≤ passRange, DEVANT le ballon, porteur posé, couloir ouvert → dart de 7 m). Un par équipe.
          // …ET LE JETÉ DÉCLENCHE LA COURSE (144) : le défenseur qui se jette OUVRE la fenêtre d'appel — « fixer puis lâcher » se joue À DEUX
          const jeteHot = st.full && cfg.fixe && st._jeteAt && st._jeteAt.team === atk && st.t - st._jeteAt.t < 0.8;
          if ((p._runT ?? -1) <= st.t && posé
            && (st._appelAt?.[atk] ?? -1) - (transOff ? axe(tac(st, atk).transition, 0, 5) : 0) - (jeteHot ? (cfg.fixe.appel ?? 4) : 0) <= st.t
            && (p._appelCd ?? -1) <= st.t + (jeteHot ? 3 : 0)) {
            const dB = d2(st.ball.p, p.p);
            const myAdv = p.p[0] * off.sgn;
                  const long = dB >= (cfg.passRange?.[1] ?? 13) - 0.5;   // LA RUPTURE (140, cfg.tranchant) : l'espace derrière la ligne → l'appel part de LOIN (26 c. 12,5), PROFOND (dart 12, 2,2 s) ; rondo sert (+portee), l'élection pèse les éliminés
            const rupt = st.full && cfg.tranchant && pitch.hx - off.adv >= (cfg.tranchant.espace ?? 14);
            if (dB > 6 && (!long || (rupt && dB < (cfg.tranchant.rayon ?? 26))) && myAdv > st.ball.p[0] * off.sgn + 2) {
              // LE RÉPERTOIRE DE L'AILIER (125, cfg.courseAilier && st.full — 9/9 darts rentraient) : l'ESPÈCE à la
              // SITUATION (déf. intérieur → DÉBORDE ; large → UNDERLAP), × patte/largeurR/axe ; BANANE au tirage. Absente : hier.
              let deepZ = p.p[2] * 0.55, espece = null;
              if (st.full && cfg.courseAilier && Math.abs(p.p[2]) > pitch.hz * 0.32) {
                let latD = null, dLat = 99;
                for (const q of st.players) if (q.team !== atk && !q.keeper && q.down <= 0) {
                  const dq = d2(q.p, p.p); if (dq < dLat) { dLat = dq; latD = q; }
                }
                const sf = p.strongFoot ?? 'right';
                const inv = (Math.sign(p.p[2] * -off.sgn) > 0) === (sf === 'right');
                const latInt = latD && Math.abs(latD.p[2]) < Math.abs(p.p[2]) - 0.8;
                const wD = (latInt ? 1.6 : 0.7) * (inv ? 0.6 : 1.5) * axe(role(p).largeurR, 0.7, 1.4) * axe(tac(st, atk).largeur, 0.8, 1.3);
                const wU = (latInt ? 0.8 : 1.5) * (inv ? 1.5 : 0.7);
                const wB = 0.5 * (inv ? 0.8 : 1.3);
                const uE = (st.rnd ? st.rnd() : 0.5) * (wD + wU + wB);
                espece = uE < wD ? 'deborde' : uE < wD + wU ? 'underlap' : 'banane';
                if (espece === 'deborde') deepZ = Math.sign(p.p[2] || 1) * Math.min(pitch.hz - 1.5, Math.abs(p.p[2]) + 4);
                else if (espece === 'banane') { deepZ = Math.sign(p.p[2] || 1) * Math.min(pitch.hz - 1.5, Math.abs(p.p[2]) + 3); p._runBanane = st.t + 0.8; }
              }
              const dartAdv = Math.min(off.adv - 0.15, myAdv + (long ? (cfg.tranchant?.dart ?? 12) : 7));
              const lane = laneClearance([st.ball.p[0], 0, st.ball.p[2]], [off.sgn * (dartAdv + 4), 0, deepZ],
                defenders.map((q) => q.p), { corridor: 0.9 });
              if (lane.open) {
                // …la cadence personnelle est un RÔLE (le 9 : 6 s ; le meneur : 14 s ; polyvalent : 10 s — lot 10)
                // …et le créneau d'équipe échoit au PREMIER ÉLIGIBLE : l'ÉLECTION du mieux-disant
                // (dart + couloir + otbF, lot 156) a été TENTÉE ET REJETÉE à la mesure — volume
                // −22 % (106 → 83 / 6 × 300 s), le canal otbF tué (17 ≈ 18 contre 31 vs 26 ici) :
                // la cadence personnelle (÷ otbF) + l'ordre font DÉJÀ vivre la note, à l'échelle.
                p._runT = st.t + (long ? 2.3 : 1.7); p._runZ = deepZ; p._runAdv = dartAdv;
                p._appelCd = st.t + axe(role(p).appel, 14, 6) / (p.skill?.otbF ?? 1);   // …OFF THE BALL est une note (151) : le bon rejaillit plus souvent
                (st._appelAt ??= {})[atk] = st.t + axe(tac(st, atk).style, 6.5, 3.5);
                // la fenêtre de _pace COUVRE le dart (1,6 ≈ 1,7 s ; rupture 2,2 ≈ 2,3) — elle porte bonus et portée
                p._pace = { until: st.t + (long ? 2.2 : 1.6), kind: 'appel', ...(long ? { rupture: true } : {}), next: p._pace?.next ?? st.t + 8 };
                st.events.push({ t: +st.t.toFixed(2), type: 'burst', kind: 'appel-profond', by: p.id, ...(espece ? { espece } : {}), ...(long ? { rupture: true } : {}) });
              }
            }
          }
          if ((p._runT ?? -1) > st.t) {
            if (p._runBanane && st.t > p._runBanane) { p._runZ = p.p[2] * 0.4; p._runBanane = null; }   // la BANANE courbe à mi-course (125)
            // LE CONTRE-APPEL (122) : la course MARQUÉE de près casse aux pieds — une fois par dart, × rôle
            // appel ; JAMAIS le coureur CHOISI, marqueur GOAL-SIDE (sans : −7 buts/20 de courses vivantes).
            if (st.full && cfg.contreAppel && p._counter !== p._runT && st.t > p._runT - 1.0
              && st.players[st.possession.carrier]?.intent?.choice?.to?.id !== p.id
              && st.players.some((q) => q.team !== p.team && q.down <= 0 && d2(q.p, p.p) < (cfg.contreAppel.marque ?? 1.5)
                && q.p[0] * off.sgn > p.p[0] * off.sgn - 0.3)
              && (st.rnd ? st.rnd() : 0.5) < (cfg.contreAppel.p ?? 0.5) * axe(role(p).appel, 0.6, 1.4)) {
              p._counter = p._runT; p._runT = st.t + 1.1;
              p._runAdv = Math.max(2, p.p[0] * off.sgn - 5); p._runZ = p.p[2] + Math.sign(st.ball.p[2] - p.p[2] || 1) * 2;
              p._pace = { until: st.t + 1.0, kind: 'contre-appel', next: p._pace?.next ?? st.t + 8 };
              st.events.push({ t: +st.t.toFixed(2), type: 'burst', kind: 'contre-appel', by: p.id });
            }
            tx = off.sgn * Math.max(0, Math.min(p._runAdv ?? (off.adv - 0.15), off.adv - 0.15));
            tz = p._runZ ?? tz;
          } else if (tx * off.sgn > off.adv - 0.8) tx = off.sgn * Math.max(0, off.adv - 0.8);
        }
        // LE DÉDOUBLEMENT (lot 88, roles.deborde — la course de rôle du couloir) : doc roles.js
        const ov = deborde(st, p, carrier, pitch, atk, cfg, axe);
        if (ov) { tx = ov[0]; tz = ov[1]; }
        p.target = [tx, 0, tz];
      }
    }
    const seMontrer = (p, want) => {
      // SE MONTRER (lot 67, st.full — 0 option sûre 44 % du temps) : ligne coupée → le soutien
      // DÉCALE perpendiculairement (±2,5 puis ±5 m) au premier point OUVERT. false : les statues.
      const foes = st._bFoes ??= []; foes.length = 0;   // buffer (lot 69)
      for (const q of st.players) if (q.team !== p.team && q.down <= 0 && !q._sub) foes.push(q);
      const ouvert = (wx, wz) => {
        const dx0 = wx - carrier.p[0], dz0 = wz - carrier.p[2], L = Math.hypot(dx0, dz0);
        if (L < 4) return false;
        const ux = dx0 / L, uz = dz0 / L;
        for (const f of foes) {
          if (Math.hypot(f.p[0] - wx, f.p[2] - wz) < 2.2) return false;
          const rx = f.p[0] - carrier.p[0], rz = f.p[2] - carrier.p[2], al = rx * ux + rz * uz;
          if (al > 0.5 && al < L && Math.hypot(rx - al * ux, rz - al * uz) < 1.2) return false;
        }
        return true;
      };
      if (ouvert(want[0], want[1])) return want;
      const dx = want[0] - carrier.p[0], dz = want[1] - carrier.p[2], L = Math.hypot(dx, dz) || 1;
      const px = -dz / L, pz = dx / L;
      // …et parmi les points ouverts LE PLUS AVANCÉ gagne (le premier-ouvert offrait du latéral
      // sûr : seed 7 passait de 5 tirs à 0 — on se démarque VERS le but quand un point y existe).
      const gx = pitch.attackGoal(atk).x;
      let bestPt = null, bestProg = -Infinity;
      for (const off of [2.5, -2.5, 5, -5]) {
        const wx = want[0] + px * off, wz = want[1] + pz * off;
        if (Math.abs(wx) >= pitch.hx - 1.2 || Math.abs(wz) >= pitch.hz - 1.2 || !ouvert(wx, wz)) continue;
        const prog = -Math.abs(gx - wx);
        if (prog > bestProg) { bestProg = prog; bestPt = [wx, wz]; }
      }
      return bestPt ?? want;
    };
    const taken = new Set();
    // greedy vif = OPTIMUM LOCAL prouvé (lot 85 : bail 7,3 %, ancre 8,6, combiné 6,4 — base 4,6)
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
      // L'ÉCONOMIE DU HORS-BALLON : re-visée cadencée (0,7 s / 0,8 m ; > 3,5 m = réaffectation, voir assignTenue) — l'hystérésis PURE gelait le bloc (consigné).
      let want = [slots[best][0], slots[best][1]];
      // le se-montrer s'évalue À CHAQUE cadence (un slot immobile mais fermé se ré-ouvre), même hystérésis
      if (st.full && cfg.demarque !== false && carrier && !carrier.keeper && (p._slotAt ?? -1) <= st.t) want = seMontrer(p, want);
      const drift = p._slotT ? Math.hypot(want[0] - p._slotT[0], want[1] - p._slotT[1]) : Infinity;
      if (!p._slotT || (drift > 3.5 && (!(st.full && cfg.assignTenue !== false) || st.t >= (p._slotHold ?? 0) || (p._pace?.until ?? -1) > st.t) && ((p._slotHold = st.t + (cfg.assignTenue?.slot ?? 1.2)), true)) || ((p._slotAt ?? -1) <= st.t && drift > 0.8 && drift <= 3.5)) {
        p._slotT = [want[0], want[1]]; p._slotAt = st.t + 0.7;   // copie (lot 69 : want vit en buffer)
      }
      p.target = [p._slotT[0], 0, p._slotT[1]];
    }
  }
  // ---- LE PRESSING À DÉCLENCHEURS (cfg.pressTriggers, 11c11) : on presse SUR SIGNAL, en fenêtre bornée.
  // (t1) la PRISE DOS AU BUT ; (t2) le RETRAIT (3 m). La fenêtre meurt au régain/remise/expiration ; cooldown d'équipe.
  if (cfg.pressTriggers && st.full) {
    const defTeam = atk === 0 ? 1 : 0;
    if (st._press && (st.t > st._press.until || st._press.team === atk || st.restart)) st._press = null;
    const sgnAtk = -pitch.ownGoal(atk).sign;
    // L'AGRESSIVITÉ (tactics.pressing) module les trois signaux et la fenêtre (0 : signal
    // criant seulement ; 1 : l'école de la chasse ; 0,5 = les constantes du lot 11).
    const Tp = tac(st, defTeam).pressing;
    if (!st._press && !st.restart && (st._pressCd?.[defTeam] ?? -1) <= st.t) {
      let kind = null;
      if (carrier && !carrier.keeper && st.phase === 'carry' && st.hold < axe(Tp, 0.2, 0.8)
        && carrier.p[0] * sgnAtk < -2 && Math.cos(carrier.yaw) * sgnAtk < -0.35) kind = 'dos-au-but';
      else if (st.phase === 'flight' && st.pass && st.pass.lead && st.pass.origin
        && st.pass.origin[0] * sgnAtk < axe(Tp, -7, -1)
        && (st.pass.lead[0] - st.pass.origin[0]) * sgnAtk < -3) kind = 'passe-en-retrait';
      // …le retrait ne déclenche qu'en RELANCE BASSE (sinon 40 % du temps sous pressing). (t3) LE
      // CONTRE-PRESS D'ÉQUIPE (cfg.moments) : perte JEUNE (< 2,5 s) et HAUTE — le bloc saute avant l'organisation.
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
    // LE BLOC SE CALCULE UNE FOIS PAR FRAME (lot 60 : formationSpots reconstruit PAR défenseur —
    // ~20 formations/frame identiques ; hoisté, flux au bit) ; le tri sur clés pré-calculées.
    const defTeamB = atk === 0 ? 1 : 0;
    const spotsBloc = st.full
      ? formationSpots(pitch, defTeamB, anchor[0], false, formationPour(tac(st, defTeamB).formation, false), blocFor(cfg.bloc ?? null, tac(st, defTeamB), st.full && cfg.zone !== false), anchor[2], st._outDef ??= []) : null;   // la formation OFF (129)
    const mapD = mapPostes(tac(st, defTeamB).formation), nDefD = (LIGNES[formationPour(tac(st, defTeamB).formation, false)] ?? [4])[0];   // le mapping on→off + la ligne OFF (130)
    const byDist = st._bByDist ??= []; byDist.length = 0;
    for (const q of defenders) { q._dAnc = d2(q.p, anchor); byDist.push(q); } byDist.sort((a, b) => a._dAnc - b._dAnc);
    // …les MARQUABLES une fois par frame (lot 69 — le prédicat ignore le marqueur ; seul le tri est personnel)
    const rayonM = st.full ? (cfg.marquageRayon ?? 22) : Infinity;
    const sgnDef = Math.sign(defGoal.x || 1);
    const marks = st._bMarks ??= [], mTri = st._bMTri ??= []; marks.length = 0;
    for (const a of attackers) if ((!carrier || a.id !== carrier.id) && (d2(a.p, anchor) <= rayonM || (st.full && a.p[0] * sgnDef > pitch.hx / 3))) marks.push(a);
    // LE MARQUAGE EST BALLSIDE (96, cfg.zone — ballsideTrim, axe marquage) : le côté FAIBLE n'a pas de marqueur, la ZONE le couvre.
    if (st.full && cfg.zone !== false && marks.length) ballsideTrim(marks, anchor[2], pitch, sgnDef, axe(tac(st, defTeamB).marquage, 8, 30));
    byDist.forEach((p, i) => {
      if (i === 0) {
        // LE GARDIEN EN MAINS EST INATTAQUABLE (Loi 12 à l'échelle) : le press TIENT LE BORD de
        // la surface — le harcèlement forçait des sorties de flipper (20,5 passes/min mesurées).
        const gkBall = carrier && carrier.keeper && Math.abs(carrier.p[0]) > pitch.hx - pitch.dims.box.depth
          && Math.sign(carrier.p[0]) === Math.sign(pitch.ownGoal(carrier.team).x);
        if (gkBall) {
          const edge = Math.sign(carrier.p[0]) * (pitch.hx - pitch.dims.box.depth - 0.6);
          p.job = 'press'; p.target = [edge, 0, carrier.p[2] * 0.6];
          return;
        }
        // L'OMBRE DE COUVERTURE (cfg.coverShadow, 11c11) : le presseur arrive PAR LE COULOIR du
        // soutien dangereux — le corps DANS la ligne de passe ; à < 2,6 m l'ombre cède au tacle.
        if (cfg.coverShadow && st.full && carrier && !freeBall && d2(p.p, anchor) > 2.6) {
          let hot = null, hotAdv = -Infinity;
          for (const a of attackers) if (a.id !== carrier.id && !a.keeper && d2(a.p, anchor) < 15) {
            const adv = a.p[0] * sgnAtk; if (adv > hotAdv) { hotAdv = adv; hot = a; }
          }
          if (hot) {
            const hx2 = hot.p[0] - anchor[0], hz2 = hot.p[2] - anchor[2];
            const hl = Math.hypot(hx2, hz2) || 1;
            p.job = 'press'; p.target = [anchor[0] + (hx2 / hl) * 1.15, 0, anchor[2] + (hz2 / hl) * 1.15];
            return;
          }
        }
        // LE CONTAIN (cfg.contain, lot 78 — 23 % des poursuites dos en survitesse, ~27 s de bélier/match) :
        // dans le dos d'un porteur lancé on vise la FILATURE, pas le corps ; le rôle press module.
        if (cfg.contain !== false && st.full && carrier && !freeBall) {
          const cv = Math.hypot(carrier.v[0], carrier.v[1]);
          const dxb = carrier.p[0] - p.p[0], dzb = carrier.p[2] - p.p[2], db = Math.hypot(dxb, dzb);
          if (cv > 1.5 && db < 2.2 && (dxb * carrier.v[0] + dzb * carrier.v[1]) / ((db || 1) * cv) > 0.4) {
            const cd = (cfg.contain?.dist ?? 0.9) * (1.25 - 0.5 * role(p).press);
            p.job = 'press'; p.target = [carrier.p[0] - (carrier.v[0] / cv) * cd, 0, carrier.p[2] - (carrier.v[1] / cv) * cd];
            return;
          }
        }
          // LE JOCKEY (lot 95) : cible ENTRE ballon et SON but, approche SOUS CONTRÔLE (movement.js).
        if (cfg.jockey !== false && st.full && carrier && !freeBall && st.ball.owner === carrier.id) {
          const ogJ = pitch.ownGoal(p.team);
          const gxJ = ogJ.x - anchor[0], gzJ = 0 - anchor[2]; const glJ = Math.hypot(gxJ, gzJ) || 1;
          const jd = cfg.jockey?.dist ?? 1.0;
          p.job = 'press'; p.target = [anchor[0] + (gxJ / glJ) * jd, 0, anchor[2] + (gzJ / glJ) * jd];
          return;
        }
        p.job = 'press'; p.target = freeBall ? [leadP[0], 0, leadP[1]] : [anchor[0], 0, anchor[2]]; return;
      }
      if (i === 1) {
        // EN FENÊTRE DE PRESSING : le second défenseur SAUTE sur le PIVOT (le pari — le régain haut se paie
        // en couverture) ; un rôle sans jambes de press (< 0,25, le meneur replié) garde la couverture.
        if (press && carrier && role(p).press >= 0.25) {
          let outlet = null, outD = Infinity;
          for (const a of attackers) if (a.id !== carrier.id && !a.keeper) {
            const d = d2(a.p, anchor); if (d < outD) { outD = d; outlet = a; }
          }
          if (outlet) { p.job = 'press'; p.target = [outlet.p[0], 0, outlet.p[2]]; return; }
        }
        // le cover coupe la ligne ballon → but défendu, au plancher radial du rondo
        p.job = 'cover'; p.target = coverSpot(defGoal, anchor, cfg);
        return;
      }
      if (st.full && cfg.zone !== false && press && i === 2 && carrier) {
        p.job = 'cover'; p.target = coverSpot(defGoal, anchor, cfg);
        return;
      }
      // EN 11C11 : quatre marqueurs suffisent — le reste tient le BLOC défensif à son poste
      // (un marquage de dix serait un essaim ; un bloc qui coulisse est une défense lisible)
      if (st.full && i >= 6) {
        // …le bloc défendant est CHAÎNÉ AU BALLON (cfg.bloc, lot 42) : ligne ~27 m du ballon,
        // longueur 30 — et le bloc est CELUI DE SA TACTIQUE (blocFor : compacité, hauteur).
        const spotsD = spotsBloc;   // hoisté (60)
        const want = spotsD[mapD[p.post ?? 0]] ?? [p.p[0], p.p[2]];
        // LA HAUTEUR DE BLOC (tactics.hauteurBloc) : le bloc posté se décale de −6 à +6 m —
        // la ligne de hors-jeu suit (Loi 11 fait exister le pari). 0,5 = 0 m, l'identité.
        const sgnD = -pitch.ownGoal(p.team).sign;
        const haut = axe(tac(st, p.team).hauteurBloc, -6, 6);
        if (haut) want[0] = Math.max(-pitch.hx + 1.2, Math.min(pitch.hx - 1.2, want[0] + sgnD * haut));
        // EN FENÊTRE DE PRESSING : le bloc posté MONTE d'un cran (pressTriggers.step) vers le ballon —
        // la COMPRESSION fait la ligne (le bloc qui monte pousse la Loi 11 devant les pointes)
        if (press) {
          want[0] = Math.max(-pitch.hx + 1.2, Math.min(pitch.hx - 1.2, want[0] + sgnD * (cfg.pressTriggers.step ?? 3.5)));
        }
        p.job = 'mark';
        const drift = p._slotT ? Math.hypot(want[0] - p._slotT[0], want[1] - p._slotT[1]) : Infinity;
        if (!p._slotT || (drift > 3.5 && (!(st.full && cfg.assignTenue !== false) || st.t >= (p._slotHold ?? 0) || (p._pace?.until ?? -1) > st.t) && ((p._slotHold = st.t + (cfg.assignTenue?.slot ?? 1.2)), true)) || ((p._slotAt ?? -1) <= st.t && drift > 0.8 * (2 - (p.skill?.posF ?? 1)) && drift <= 3.5)) {   // …le POSITIONING est une note (151) : le mauvais dérive avant de se recaler
          p._slotT = [want[0], want[1]]; p._slotAt = st.t + 0.7;   // copie (lot 69 : want vit en buffer)
        }
        p.target = [p._slotT[0], 0, p._slotT[1]];
        return;
      }
      // marquage : l'attaquant libre le plus proche, un pas CÔTÉ BUT, à-coups (0,5 s/0,8 m) ; ON MARQUE LE DANGER SEULEMENT (51b) — sinon le bloc couvre. Réduit : hier.
      mTri.length = 0;                                             // copie depuis `marks` : le départ du tri stable reste l'ordre d'hier
      for (const a of marks) { a._dMark = d2(a.p, p.p); mTri.push(a); } mTri.sort((x, y) => x._dMark - y._dMark);
      // …UN MARQUEUR PAR HOMME (lot 72 : trois voisins élisaient le même homme, tas de 4-5
      // corps) : en 11c11 le surplus rejoint son poste (!m) ; le réduit garde le doublement.
      const m = i - 2 < marks.length ? (mTri[i - 2] ?? null) : (st.full ? null : (mTri[0] ?? null));
      if (!m && st.full) {
        const spotsM = spotsBloc;   // hoisté (60)
        const wM = spotsM[mapD[p.post ?? 0]] ?? [p.p[0], p.p[2]];
        p.job = 'mark'; p.target = [wM[0], 0, wM[1]];
        return;
      }
      if (!m) { p.job = 'mark'; p.target = [p.p[0], 0, p.p[2]]; return; }
      const gx = defGoal.x - m.p[0], gz = 0 - m.p[2];
      const gl = Math.hypot(gx, gz) || 1;
      p.job = 'mark';
      // …ET LE RÔLE DU MARQUEUR (roles.press, lot 19) : le récupérateur COLLE (×0,82), le meneur replié marque LÂCHE (×1,18) — milieu ×1, l'identité du polyvalent
      const off = (press ? 0.95 : 1.4) * axe(role(p).press, 1.18, 0.82) * (2 - (p.skill?.markF ?? 1));   // …le MARQUAGE est une note (151) : le bon colle, le lâche laisse l'intervalle
      const want = [m.p[0] + (gx / gl) * off, m.p[2] + (gz / gl) * off];
      // …ET LA LIGNE ARRIÈRE EST UNE BANDE (lot 96, cfg.zone — « ligne » à 19-22 m d'écart mesurée, réel 2-5) : le marqueur ne sort pas de sa bande (6 m) — il suit son homme EN LATÉRAL (le central sort dans le trou).
      if (st.full && cfg.zone !== false && (mapD[p.post ?? 9] ?? 9) < nDefD && spotsBloc) {
        const xL = spotsBloc[mapD[p.post ?? 0]]?.[0], sL = (xL ?? 0) * sgnDef;
        // …ne descend pas SOUS elle (le piège Loi 11 couvre l'homme bas) sauf ballon déjà profond…
        if (xL != null && anchor[0] * sgnDef < sL - 2 && want[0] * sgnDef > sL) want[0] = xL;
        // …et ne MONTE pas marquer à plus de 4 m devant elle (l'homme haut appartient au bloc)
        if (xL != null && want[0] * sgnDef < sL - 6) want[0] = sgnDef * (sL - 6);
      }
      const drift = p._markT ? Math.hypot(want[0] - p._markT[0], want[1] - p._markT[1]) : Infinity;
      // L'ASSIGNATION A UNE MÉMOIRE (lot 135, cfg.assignTenue — 4 841 sauts > 5 m : le re-tri frame-vif de QUI marque QUI) : le grand saut (> 3 = un autre homme) attend la TENUE ; le suivi fin garde sa cadence.
      const t135 = st.full && cfg.assignTenue !== false;
      if (!p._markT || (drift > 3 && (!t135 || st.t >= (p._markHold ?? 0)) && ((t135 && (p._markHold = st.t + (cfg.assignTenue?.mark ?? 1.6))), true)) || ((p._markAt ?? -1) <= st.t && drift > (press ? 0.55 : 0.8) && drift <= 3)) {
        p._markT = want; p._markAt = st.t + (press ? 0.35 : 0.5);
      }
      p.target = [p._markT[0], 0, p._markT[1]];
    });
  }

  // L'INTERCEPTEUR (134, phases) : le vol de passe adverse basse SE VOLE par qui gagne le chemin.
  intercepteurVol(st, cfg, { busy, predictPath, interceptPoint, defenders, atk });
  // …ET LA FENÊTRE DU CONTRE-PRESS S'APPLIQUE EN DERNIER : pendant cfg.lossReact s, l'ex-porteur CHASSE son ballon (92/254 dos mesuré) ; elle s'éteint au regain ou à la mort de la fenêtre.
  if (cfg.lossReact && st._lossAt) {
    for (const idS of Object.keys(st._lossAt)) {
      const id = +idS, la = st._lossAt[id], p = st.players[id];
      if (!p || st.t - la > cfg.lossReact * (p.skill?.workF ?? 1)) { delete st._lossAt[id]; continue; }   // …WORK RATE est une note (151) : le travailleur chasse sa perte plus longtemps
      const ownerNow = st.possession.carrier >= 0 ? st.players[st.possession.carrier] : null;
      if (ownerNow && ownerNow.team === p.team) { delete st._lossAt[id]; continue; }
      if (p.down > 0 || busy(p) || st.possession.carrier === p.id) continue;
      // …et un joueur DÉJÀ en chasse garde sa cible (l'écraser par le ballon-immédiat : fixture orbite aveugle, +2,1 m les deux bras) ; le contre-press ne re-cible que le coureur de slot
      if (p.job === 'press' || p.job === 'intercept') continue;
      p.job = 'press';
      p.target = [st.ball.p[0] + st.ball.v[0] * 0.25, 0, st.ball.p[2] + st.ball.v[2] * 0.25];
      p.push = null;
    }
  }
  // LE BOX CRASH (123) — POST-PASS d'autorité : la géométrie du centre REMPLIT la surface (N plus proches + rôle appel, soutien épargné, Loi 11, cache 0,6 s). Absente : hier.
  if (st.full && cfg.boxCrash && !st.restart && st.possession.team >= 0) {
    const atk = st.possession.team;
    const g2 = pitch.attackGoal(atk), sg2 = Math.sign(g2.x || 1), zB = st.ball.p[2];
    const bc = (st._boxCrash ??= {});
    if ((bc[atk]?.t ?? -1) < st.t - 0.6) {
      const geo = Math.abs(zB) > pitch.hz * (cfg.boxCrash.couloir ?? 0.4)
        && st.ball.p[0] * sg2 > pitch.hx - pitch.dims.box.depth - (cfg.boxCrash.prof ?? 18);
      if (geo) {
        const n = Math.max(2, Math.min(4, Math.round(3 + axe(tac(st, atk).hauteur, -1, 1))));
        const bx = g2.x - sg2 * 9;
        const cands = st.players.filter((q) => q.team === atk && !q.keeper && q.down <= 0
          && q.id !== st.possession.carrier && q.job !== 'press' && q.job !== 'intercept'
          && d2(q.p, st.ball.p) > (cfg.boxCrash.garde ?? 12))
          .map((q) => ({ id: q.id, s: -Math.hypot(q.p[0] - bx, q.p[2]) + axe(role(q).appel, -3, 3) }))
          .sort((x, y) => y.s - x.s).slice(0, n).map((x) => x.id);
        bc[atk] = { t: st.t, ids: cands, zC: Math.sign(zB || 1) };
      } else bc[atk] = { t: st.t, ids: [], zC: 1 };
    }
    // …LE PLONGEON SEUL en défaut (le statique DIVISAIT les buts par 2, A/B apparié) : le crash ne vit qu'au VOL ; attente = l'opt-in payant.
    const E = bc[atk], offL = cfg.offside ? offsideLine(st, atk) : null;
    if (E?.ids?.length) {
      const vol = st.pass && st.pass.cross && st.players[st.pass.from]?.team === atk;
      if (vol || cfg.boxCrash.attente) {
        const g3 = pitch.attackGoal(atk), sg3 = Math.sign(g3.x || 1), zC = E.zC;
        const P = vol
          ? [[g3.x - sg3 * 5.5, zC * 3.4], [g3.x - sg3 * 11, -zC * 1], [g3.x - sg3 * 6.5, -zC * 4.5], [g3.x - sg3 * 16, zC * 2]]
          : [[g3.x - sg3 * 18, zC * 5], [g3.x - sg3 * 19.5, -zC * 1], [g3.x - sg3 * 18, -zC * 7], [g3.x - sg3 * 22, zC * 3]];
        for (let k = 0; k < E.ids.length; k++) {
          const q = st.players[E.ids[k]];
          if (!q || q.down > 0 || busy(q) || st.possession.carrier === q.id) continue;
          if (vol && q.id === st.pass.to) continue;   // le RECEVEUR du centre court au point de chute, jamais au poteau (5/17 vs 12/27 mesurés sans l'exemption)
          q.job = 'support';
          const px = offL ? offL.sgn * Math.min(P[k][0] * offL.sgn, offL.adv - 0.15) : P[k][0];
          q.target = [px, 0, P[k][1]];
        }
      }
    }
  }
  marquageCentre(st, cfg, { busy, tac, axe, d2 });   // 133 : le vol du centre adverse met des CORPS sur les corps (phases.js)
  accompagneMontee(st, cfg, { tac, axe, role });     // 137 : la montée du porteur DÉCLENCHE ses courses d'accompagnement (phases.js)
}

// ---------------------------------------------------------------- l'arrêt du gardien
/** LE PRIX RÉEL DU PLONGEON (lot 91, st.full) : keeperDown couvrait 1,15 s quand le corps livré
 *  met chute + sol + relevé par étapes (keeper.keeperRise — l'AGILITÉ en facteur, getupF). Un
 *  gardien lent à se relever = fenêtre de rebond VRAIE ; le BATTU paie aussi (mesuré : down=0,
 *  catapulte — note 132). gk.rise = le contrat que la scène anime. false = le prix d'hier au bit. */
function riseDown(st, gk, cfg, resolved) {
  if (!(st.full && cfg.keeperRise !== false)) { if (resolved) gk.down = Math.max(gk.down, cfg.keeperDown); return; }
  const R = keeperRise(gk.skill?.getupF ?? 1, resolved);
  gk.rise = { ground: R.ground, getup: R.getup };
  gk.down = Math.max(gk.down, resolved ? cfg.keeperDown : 0, R.total);
}

/** LE CONTACT DU PLONGEON — la géométrie du CONTACT décide : gants (≤ 1,1 m) → PRISE ;
 *  bout de gants (≤ 1,7) → CLAQUETTE ; sinon BATTU. Le gardien paie toujours (keeperDown). */
function onDive(st, gk, cfg) {
  // appelé CHAQUE IMAGE de la détente (rondo-sim, skillFollowStep) : renvoie true quand le gant a résolu le ballon (prise ou claquette) — false tant qu'il passe hors de portée
  const d = Math.hypot(gk.p[0] - st.ball.p[0], gk.p[2] - st.ball.p[2]);
  const y = st.ball.p[1] ?? 0;
  if (d > 1.7 || y > 2.1) { if (gk.act?.payload) gk.act.payload._pd = d; return false; }
  // LE GANT TOUCHE AU PLUS PRÈS (le premier franchissement claquait à 1,5-1,7 m des mains) : tant que le ballon SE RAPPROCHE, le contact attend l'approche minimale ; le warp du gant fait le visuel.
  const pd = gk.act?.payload?._pd ?? Infinity;
  const closing = d < pd - 1e-4;
  if (gk.act?.payload) gk.act.payload._pd = d;
  if (closing && d > 0.35) return false;
  // …la détente de prise (plongeonPrise, lot 93) retombe SUR SES APPUIS : pas de gk.rise.
  if (gk.act?.id === 'plongeonPrise') gk.down = Math.max(gk.down, 0.5);
  else riseDown(st, gk, cfg, true);
  const spdT = Math.hypot(st.ball.v[0], st.ball.v[1], st.ball.v[2]);   // …ET LE MISSILE NE SE PREND PAS (lot 101, cfg.corner) : ≥ priseV loin du buste → il se DÉVIE (les gants ne le tiennent pas) — la claquette-corner s'en charge. Clé absente : hier.
  const handF = gk.skill?.handF ?? 1;   // L'ISSUE DE L'ARRÊT (147, note handling) : le bon CAPTE des tirs plus lourds (priseV × handF) et SÉCURISE en corner plus tôt (claqueV / handF) — 1 exact à 50, le monde nu au bit
  if (d <= 1.1 && y <= 1.9 && !(st.full && cfg.corner && spdT >= (cfg.corner.priseV ?? 16) * handF && d > 0.75)) {
    if (st.ball.owner != null) st.ball.release('perte');
    st.ball.impulse([-st.ball.v[0], -st.ball.v[1] * 0.9, -st.ball.v[2]],      // mort dans les gants —
      st.full && cfg.amortiSpin !== false ? [-st.ball.w[0], -st.ball.w[1], -st.ball.w[2]] : null);  // rotation comprise (lot 54, st.full : le réduit au bit près)
    st.ball.possess(gk.id);
    st.possession = { team: gk.team, carrier: gk.id };
    st.phase = 'carry'; st.pass = null; st.hold = 0; st.pressure = 0;
    st.lastTouch = gk.team;
    // …la prise se NOMME entière (lot 90, contrat d'animation) : aérienne > 1,2 m ou au sol.
    st.events.push({ t: +st.t.toFixed(2), type: 'arrêt', by: gk.id, mode: 'prise', aerienne: y > 1.2 });
    return true;
  } else {
    const side = Math.sign(gk.p[2] - 0) || 1;
    // LA CLAQUETTE EN CORNER (lot 101 — mesuré : 1 corner/8 matchs) : le tir FORT au bout de l'envergure OU trop vif pour les gants se DÉVIE derrière la ligne (« en corner ! », outRule juge). Clé absente : hier au bit.
    if (st.full && cfg.corner && spdT >= (cfg.corner.claqueV ?? 13) / handF && (d > 1.35 || spdT >= (cfg.corner.priseV ?? 16) * handF))
      st.ball.impulse([-st.ball.v[0] * 0.45, -st.ball.v[1] * 0.4 + 2.2, -st.ball.v[2] * 0.3 + side * 6]);
    else st.ball.impulse([-st.ball.v[0] * 1.4, -st.ball.v[1] * 0.6 + 1.5, -st.ball.v[2] * 0.6 + side * 3.5]);
    st.lastTouch = gk.team;
    // APRÈS LE GANT, LE BALLON EST NEUF : st.pass gardait l'origine du tir — la porte anti-auto-interception gelait tout (111 s mesuré).
    st.pass = null;
    // …et la claquette dit SES MAINS (lot 90) : deux dans l'envergure courte (≤ 1,35), une au bout.
    st.events.push({ t: +st.t.toFixed(2), type: 'arrêt', by: gk.id, mode: 'claquette', mains: d <= 1.35 ? 2 : 1, cote: side });
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
  return Math.max(-3, Math.min(3, gain * 0.22 * axe(tac(st, c.team).mentalite, 0.75, 1.25)));   // LA MENTALITÉ (149) : le risque global pèse la progression — 0,5 = ×1
}

export function matchCfg(overrides = {}) {
  return {
    ...MATCH, assignJobs: assignMatchJobs, tryShot, tryCross, tryClear, onOut, onDive, canTake, passBias, ballFetch,
    // l'accrochage MODULÉ par la tactique du camp défendant (axe pressing — lot 97, duel.js)
    accrocheMod: (st, c, cfg) => accrocheStep(st, c, cfg, axe(tac(st, 1 - c.team).pressing, 0.7, 1.3)),
    // LA PRISE A UN MÉTIER (hook onTake du loop) : la touche du plein format se LANCE (Loi 15)
    onTake: (st, id, type, cfg) => {
      if (type === 'touche' && cfg.loi15 && st.full) remiseEnTouche(st, id, cfg);
      // …le COUP FRANC a un prix (lot 97) : à portée il se TIRE, lointain il se LANCE — et le CORNER se TRAVAILLE (lot 101)
      else if (type === 'coup-franc' && cfg.cfDirect !== false && st.full) coupFrancDirect(st, id, cfg) || coupFrancLance(st, id, cfg);
      else if (type === 'corner' && cfg.corner && st.full) cornerTrav(st, id, cfg);
      // LA SORTIE DE BUT EST UNE DISTRIBUTION (lot 150, tac.cpa.sortieBut && st.full) : le
      // preneur passe par relancerGardien (main courte / longue directe / le barème d'hier) —
      // sans style, RIEN ne change : la remise générique d'hier joue, au bit
      else if (type === 'sortie-de-but' && st.full && st.tactics?.[st.players[id]?.team]?.cpa?.sortieBut)
        relancerGardien(st, id >= 0 ? st.players[id] : null, cfg, { beginPass: simInternals.beginPass });
    },
    // le plongeon BATTU paie sa chute au bout du geste (hook onDiveEnd du loop — lot 91)
    onDiveEnd: (st, gk, A, cfg) => { if (!A.resolved) riseDown(st, gk, cfg, false); },
    // le ballon PRIS reste aux GANTS pendant le relevé (hook heldBall du loop — lot 91, keeperHold:false = le ballon gelé d'hier) : intouchable tenu, posé une fois debout
    heldBall: (st, c, dt, cfg) => {
      if (!(st.full && cfg.keeperHold !== false) || !c.keeper || c.down <= 0 || st.ball.owner !== c.id) return false;
      st.ball.hold(keeperHoldPoint(c), dt);
      return true;
    },
    ...overrides,
  };
}

/** Avance le match d'un pas — le game-loop du rondo, configuré match. */
export function matchStep(st, dt, cfg = matchCfg()) {
  if (st.full && (cfg.filet || cfg.bordure)) bordFiletStep(st, dt, cfg);   // la cage et les panneaux sont un matériau (lot 116)
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

/** CONTRAT DU MATCH — par-dessus checkRondo (téléports/essaims) : personne ne tire, score ≠ buts,
 *  sorties sans remise nommée, gardien errant, remises volées, un jeu qui ne progresse jamais. */
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
  // un 0 tir sur une tranche courte est du VRAI football — le défaut, ce sont des OCCASIONS sans tir ; l'occasion = le ballon dans la zone QUE JE VISE pendant que JE l'ai (ni chez soi, ni les remises).
  const thirdVisits = trace.filter((s) => !s.restart && s.team >= 0
    && s.ball[0] * (s.team === 0 ? 1 : -1) > st.pitch.hx - st.pitch.dims.box.depth - 1).length;
  // …et l'attaquant MURÉ n'est pas l'attaquant MUET : celui qui DEMANDE le tir et se voit refuser le couloir (refus nommé au registre) a appuyé — c'est le silence sans demande qu'on interdit
  const denied = (st.deny?.['tir-couloir-fermé'] ?? 0) > 0;
  if (!shots.length && !denied && thirdVisits > 25) issues.push(`PERSONNE NE TIRE malgré ${thirdVisits} passages dans le dernier tiers — un rondo décoré`);
  for (const s of shots) {
    const okLob = st.full && cfg.lob && s.kind === 'lob' && s.range <= (cfg.lob.max ?? 38) + 0.6;   // le lob du gardien avancé (120) vit AU-DELÀ de la grise
    if (!okLob && s.range > cfg.shotRange * (st.full && cfg.menace?.grise ? cfg.menace.grise : 1) + 0.6) issues.push(`tir hors de portée déclarée (${s.range} m > ${cfg.shotRange})`);
    // la clause connaît LA MÊME loi que le déclencheur : à bout portant (< 9 m) on tire dans le trafic (0,25 m) — juger tous les tirs au couloir de loin re-créerait l'attaquant muet
    const need = (s.range ?? 99) < 9 ? 0.25 : cfg.shotClear - 0.05;
    if (s.clear != null && s.clear < need) issues.push(`tir à travers un mur (couloir ${s.clear} m < ${need})`);
  }
  // chaque sortie SUIVIE d'une reprise (6 s) ; coupée par la fin ≠ perdue (inFlight — sinon le contrat dépend du chrono).
  const lastT = trace.length ? trace[trace.length - 1].t : 0;
  // …la fenêtre suit L'ÉCHELLE DU TERRAIN : 6 s au réduit ; un corner du 105 m se PORTE sur ~27 m (7,4 s mesurés, graine 7) — la borne plate accusait un porté légal de gel
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
    const bLib = st.full && cfg.libero ? (cfg.libero.max ?? 10) + 2 : 6;   // le libéro (120) POSSÈDE sa hauteur — la clause borne au plafond de la loi
    if (med > bLib) issues.push(`le gardien ${team} erre (médiane à ${med.toFixed(1)} m de son but)`);
  }
  // le jeu PROGRESSE : les deux tiers offensifs se visitent — vise le rond-central-perpétuel, pas l'équilibre (0-0 dominé légal) ; seuil au TIERS.
  const third = st.pitch.hx / 3;
  const visits = [trace.some((s) => s.ball[0] > third), trace.some((s) => s.ball[0] < -third)];
  if (!visits[0] || !visits[1]) issues.push(`le ballon ne visite pas les deux camps (au-delà de ±${third.toFixed(0)} m : +x ${visits[0]}, −x ${visits[1]})`);
  // LE BALLON NE SE TÉLÉPORTE JAMAIS EN MATCH : toute remise est PORTÉE (ballFetch) — le registre ne contient que LA pose du coup d'envoi. Mesuré avant : 12 sauts de 4,7-23 m / 4 matchs.
  const led = st.ball.ledger;
  if (cfg.restartCarried !== false && led && led.restarts && led.restarts.length > 1) {
    issues.push(`${led.restarts.length - 1} remise(s) posée(s) par écriture — la remise se PORTE (ballFetch), elle ne se téléporte pas`);
  }
  // …ET LES CORPS NON PLUS : à l'échantillon de trace (0,1 s), aucun joueur ne franchit 1,6 m (16 m/s apparents — le sprint plafonne à 8). placeKickoff écrivait les douze corps à chaque but.
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
