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
import { laneClearance } from './ball-predict.js';
import { RONDO, makeRondo, evadeSpot } from './rondo.js';
import { rondoStep, checkRondo, simInternals } from './rondo-sim.js';
import { makePitch, outRule, REDUIT } from './pitch.js';
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
  restartWait: 4.0,       // s — une remise se POSE (était 1,1 : le jeu ne respirait jamais)
  restartClear: 3.0,      // m — les adversaires tiennent ce rayon à la remise (futsal Loi 15 : 5 m ; réduit ici à l'échelle)
  keeperDown: 0.75,       // s — le prix d'un plongeon (au sol après, gagné ou perdu)
  // LA CIRCULATION D'UN MATCH N'EST PAS LA TENUE D'UN RONDO. Mesuré avant : 53 % des images en
  // conduite, tenue p90 3,6 s, 84 passes pour 18 reçues (21 %) — « trop de conduite, des passes
  // qui ne suivent pas l'appel » (retour utilisateur, mot pour mot ce que les chiffres disaient).
  holdCalm: [1.0, 2.2],   // s — on FIXE vraiment avant de donner (0,83 s de tenue mesurée : le
                          // flipper, pas FM) — la conduite et le dribble y gagnent leur place
  intentBarCalm: 4.8,     // la barre d'adoption au calme — assez haute pour qu'on VOIE la tenue
  appelBonus: 2.6,        // le coureur en rupture est SERVI — relevé avec intentBarCalm (4,8) :
                          // au tempo posé, la course doit encore battre la barre d'adoption
  // la mène suit la course : temps d'arrivée estimé (0,4 + d/9, borné 1 s), amorti à 85 % — un
  // ballon DANS la course, pas sur les talons
  leadTime: (d, rec) => Math.min(0.4 + d / 9, 1.0) * ((rec && Math.hypot(rec.v?.[0] ?? 0, rec.v?.[1] ?? 0) > 1.6) ? 0.85 : 0.3),
  speeds: { ...RONDO.speeds, support: 4.9, mark: 5.6, keeper: 6.4 },  // le soutien OFFENSIF économise
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
export function makeMatch({ perTeam = 5, seed = 1, pitch = makePitch(), squads = null } = {}) {
  const st = makeRondo({ perTeam: perTeam + 1, seed, area: [pitch.dims.length, pitch.dims.width] });
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
  st.restart = { type: 'engagement', p: [0, 0], team: 0, at: 0.4 };
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

  // ---- LA REMISE EN JEU : un monde à part, court et légal
  if (st.restart) {
    const r = st.restart;
    for (const p of st.players) {
      if (p.keeper) { const s = keeperSpot(pitch, p.team, [r.p[0], 0, r.p[1]]); p.job = 'keeper'; p.target = [s.x, 0, s.z]; continue; }
      if (r.type === 'engagement') {
        // chacun DANS SA MOITIÉ (Loi 8) — les positions d'engagement ont été posées ; on les tient
        const sign = pitch.ownGoal(p.team).sign;
        const tx = Math.abs(p.p[0]) < 1 && p.team !== r.team ? sign * 4 : p.p[0];
        p.job = 'mark'; p.target = [tx, 0, p.p[2]];
      } else if (p.team === r.team) {
        p.job = 'support'; p.target = [r.p[0], 0, r.p[1]];
      } else {
        // l'adversaire TIENT LE RAYON de la remise (Loi 15/16/17 à l'échelle du format)
        const dx = p.p[0] - r.p[0], dz = p.p[2] - r.p[1];
        const d = Math.hypot(dx, dz);
        p.job = 'mark';
        p.target = d < cfg.restartClear ? [r.p[0] + (dx / (d || 1)) * cfg.restartClear, 0, r.p[1] + (dz / (d || 1)) * cfg.restartClear] : [p.p[0], 0, p.p[2]];
      }
    }
    // le preneur : le joueur de l'équipe de remise le plus proche
    const taker = st.players.filter((p) => p.team === r.team && !p.keeper && p.down <= 0)
      .sort((a, b) => Math.hypot(a.p[0] - r.p[0], a.p[2] - r.p[1]) - Math.hypot(b.p[0] - r.p[0], b.p[2] - r.p[1]))[0];
    if (taker) { taker.job = 'receive'; taker.target = [r.p[0], 0, r.p[1]]; st.restart.taker = taker.id; }
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
      gk.job = 'carry';
      gk.push = [-g.sign, 0];
      gk.target = [g.x - g.sign * 5, 0, gk.p[2] * 0.5];
      continue;
    }
    if (busy(gk)) continue;                                        // un plongeon possède son corps
    const shotAge = st.pass ? st.t - st.pass.t : Infinity;
    // le GARDIEN NOTÉ : son envergure et son réflexe viennent de sa note (keeping) — sinon le métier moyen
    const K = gk.skill ? { ...KEEPER, diveReach: gk.skill.keeperReach, reflex: gk.skill.keeperReflex } : KEEPER;
    const dec = keeperDecide(pitch, gk.team, [gk.p[0], 0, gk.p[2]], st.ball.p, st.ball.v, shotAge, K);
    if (dec.mode === 'dive' && gk.down <= 0) {
      const cross = dec.cross;
      const move = { id: 'plongeon', duration: MOVES.plongeon.duration, contact: MOVES.plongeon.contact };
      const lunge = [(pitch.ownGoal(gk.team).x - gk.p[0]) * 0.2, cross.z - gk.p[2]];
      const L = Math.hypot(lunge[0], lunge[1]) || 1;
      startGesture(gk, move, {
        payload: { kind: 'skill', skill: 'plongeon', ownsBody: true, pick: { foot: cross.z > gk.p[2] ? 'left' : 'right' },
          lunge: [lunge[0] / L, lunge[1] / L], speed: Math.min(6.5, (Math.abs(cross.z - gk.p[2]) / Math.max(0.15, cross.t)) * 1.1), cross },
        log: st.gestures,
      });
      gk.yawWant = Math.atan2(st.ball.p[2] - gk.p[2], st.ball.p[0] - gk.p[0]);
      st.events.push({ t: +st.t.toFixed(2), type: 'windup', by: gk.id, move: 'plongeon', foot: cross.z > gk.p[2] ? 'left' : 'right', skill: 'plongeon', anticipation: move.contact });
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

  // ---- l'attaque : porteur poussé VERS LE BUT, couloirs orientés
  for (const p of attackers) {
    if (carrier && p.id === carrier.id) {
      p.job = 'carry';
      const ev = evadeSpot(st, p, cfg);
      const gx = goal.x - p.p[0], gz = 0 - p.p[2];
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
      p.target = [p.p[0] + p.push[0] * 3, 0, p.p[2] + p.push[1] * 3];
      continue;
    }
    p.push = null;
  }
  // couloirs : deux lanceurs devant-large, une sécurité derrière, le reste en largeur
  if (flightRec && !flightRec.keeper && flightRec.team === atk) {
    flightRec.job = 'receive';
    flightRec.target = [st.pass.lead[0], 0, st.pass.lead[2]];
  }
  {
    const sgn = Math.sign(goal.x || 1);
    const slots = [
      [anchor[0] + sgn * 8, anchor[2] < 0 ? anchor[2] + 6 : anchor[2] - 6],   // lanceur intérieur
      [anchor[0] + sgn * 7, anchor[2] < 0 ? anchor[2] - 5 : anchor[2] + 5],   // lanceur opposé
      [anchor[0] - sgn * 6, anchor[2] * 0.5],                                  // la sécurité
      [anchor[0] + sgn * 2, anchor[2] > 0 ? -pitch.hz * 0.55 : pitch.hz * 0.55], // la largeur
      [anchor[0] + sgn * 4, anchor[2] * -0.6],                                 // second rideau
    ].map(([x, z]) => [Math.max(-pitch.hx + 1.2, Math.min(pitch.hx - 1.2, x)), Math.max(-pitch.hz + 1.2, Math.min(pitch.hz - 1.2, z))]);
    const free = attackers.filter((p) => (!carrier || p.id !== carrier.id) && p !== flightRec);
    const taken = new Set();
    for (const p of free) {
      let best = -1, bd = Infinity;
      for (let i = 0; i < slots.length; i++) {
        if (taken.has(i)) continue;
        const dd = Math.hypot(p.p[0] - slots[i][0], p.p[2] - slots[i][1]);
        if (dd < bd) { bd = dd; best = i; }
      }
      if (best < 0) { p.job = 'support'; p.target = [p.p[0], 0, p.p[2]]; continue; }
      taken.add(best);
      p.job = 'support';
      p.target = [slots[best][0], 0, slots[best][1]];
    }
  }

  // ---- la défense : press sur le ballon, cover CÔTÉ BUT, marquage goal-side
  {
    const defGoal = pitch.ownGoal(atk === 0 ? 1 : 0);
    const byDist = [...defenders].sort((a, b) => d2(a.p, anchor) - d2(b.p, anchor));
    byDist.forEach((p, i) => {
      if (i === 0) { p.job = 'press'; p.target = [anchor[0], 0, anchor[2]]; return; }
      if (i === 1) {
        // le cover coupe la ligne ballon → but défendu, au plancher radial du rondo
        const gx = defGoal.x - anchor[0], gz = 0 - anchor[2];
        const gl = Math.hypot(gx, gz) || 1;
        const dd = Math.max(cfg.coverMinDist, Math.min(6, gl * 0.35));
        p.job = 'cover'; p.target = [anchor[0] + (gx / gl) * dd, 0, anchor[2] + (gz / gl) * dd];
        return;
      }
      // marquage : l'attaquant libre le plus proche, un pas CÔTÉ BUT
      const marks = attackers.filter((a) => !carrier || a.id !== carrier.id);
      const m = marks.sort((a, b) => d2(a.p, p.p) - d2(b.p, p.p))[i - 2 < marks.length ? Math.min(i - 2, marks.length - 1) : 0] ?? null;
      if (!m) { p.job = 'mark'; p.target = [p.p[0], 0, p.p[2]]; return; }
      const gx = defGoal.x - m.p[0], gz = 0 - m.p[2];
      const gl = Math.hypot(gx, gz) || 1;
      p.job = 'mark'; p.target = [m.p[0] + (gx / gl) * 1.4, 0, m.p[2] + (gz / gl) * 1.4];
    });
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
  const choice = {
    to: { id: -2 }, lead: [goal.x, 0, tz], style: 'ground', shot: true,
    lane: { margin: +margin.toFixed(2) },
    shotInfo: { range: +dGoal.toFixed(2), tz: +tz.toFixed(2), gkZ: gk ? +gk.p[2].toFixed(2) : null },
  };
  return simInternals.beginPass(st, choice, cfg, { shot: true });
}

/** Un refus a une cause nommée (copie locale du registre du loop). */
function deny(st, cause) { (st.deny ??= {})[cause] = (st.deny[cause] ?? 0) + 1; return false; }

// ---------------------------------------------------------------- la sortie et les remises
/**
 * LA SORTIE DE BALLE, par la RÈGLE (pitch.outRule au point de franchissement interpolé).
 * But → score + engagement ; touche/corner/sortie de but → remise placée, adversaires au rayon.
 */
function onOut(st, cfg) {
  const { pitch } = st;
  const p0 = st._ballPrev ?? st.ball.p;
  const r = outRule(pitch, p0, st.ball.p, st.lastTouch);
  if (!r) {
    // sécurité : ballon dehors sans franchissement lisible (segment dégénéré) — remise en touche
    // au point le plus proche, et le cas se COMPTE au registre (il doit rester exceptionnel)
    deny(st, 'sortie-illisible');
    const x = Math.max(-pitch.hx + 1, Math.min(pitch.hx - 1, st.ball.p[0]));
    const z = Math.sign(st.ball.p[2] || 1) * (pitch.hz - 0.15);
    st.restart = { type: 'touche', p: [x, z], team: 1 - st.lastTouch, at: st.t + cfg.restartWait };
    st.ball.restart([x, BALL.radius, z], { cause: 'touche' });
    st.phase = 'loose'; st.possession.carrier = -1; st.pass = null; st.hold = 0; st.pressure = 0;
    return true;
  }
  if (r.type === 'but') {
    st.score[r.scorer] += 1;
    st.events.push({ t: +st.t.toFixed(2), type: 'but', team: r.scorer, score: [...st.score] });
    placeKickoff(st, r.team);
    st.restart = { type: 'engagement', p: [0, 0], team: r.team, at: st.t + cfg.restartWait + 0.6 };
    st.ball.restart([0, BALL.radius, 0], { cause: 'engagement' });
  } else {
    st.events.push({ t: +st.t.toFixed(2), type: 'sortie', out: r.type, team: r.team, p: [+r.x.toFixed(1), +r.z.toFixed(1)] });
    st.restart = { type: r.type, p: [r.x, r.z], team: r.team, at: st.t + cfg.restartWait };
    st.ball.restart([r.x, BALL.radius, r.z], { cause: r.type });
  }
  st.phase = 'loose'; st.possession.carrier = -1; st.pass = null; st.hold = 0; st.pressure = 0;
  for (const p of st.players) if (p.act && winding(p)) p.act = null;   // une remise annule les armés
  return true;
}

/** Qui a le droit de prendre le ballon ? Pendant une remise : l'équipe de la remise, à l'heure. */
function canTake(st, takerId) {
  if (!st.restart) return true;
  const p = st.players[takerId];
  if (st.t < st.restart.at - 0.25) return false;
  if (p.team !== st.restart.team) return false;
  st.restart = null;                                               // la remise est PRISE — le jeu reprend
  st.events.push({ t: +st.t.toFixed(2), type: 'restart-pris', by: takerId });
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
  if (d > 1.7 || y > 2.1) return false;
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
  return { ...MATCH, assignJobs: assignMatchJobs, tryShot, tryClear, onOut, onDive, canTake, passBias, ...overrides };
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
  const thirdVisits = trace.filter((s) => Math.abs(s.ball[0]) > st.pitch.hx - st.pitch.dims.box.depth - 1).length;
  if (!shots.length && thirdVisits > 25) issues.push(`PERSONNE NE TIRE malgré ${thirdVisits} passages dans le dernier tiers — un rondo décoré`);
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
  return { ok: issues.length === 0, issues, stats: { shots: shots.length, buts: buts.length, arrets: evs.filter((e) => e.type === 'arrêt').length, sorties: sorties.length, score: [...st.score] } };
}

export const matchInternals = { assignMatchJobs, tryShot, onOut, onDive, canTake, placeKickoff };
export { checkRondo };
