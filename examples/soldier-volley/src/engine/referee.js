// referee.js — L'ARBITRAGE ET LES CÉRÉMONIES DU MATCH, sortis de match-sim (lot 16 : la
// volumétrie est une dette comme une autre — 1 575 lignes accrétées en six lots). La FAMILLE
// est cohésive : tout ce qui ARRÊTE et REMET le jeu — sorties (onOut), droit de prise
// (canTake), porté de remise (ballFetch), coup franc du hors-jeu (administerWhistle), chrono
// des périodes (chronoStep), feuille de match, engagements (placeKickoff/kickoffSpots).
// AUCUN comportement ne change : la batterie des 295 clauses au bit près est LA preuve.
import { BALL } from './ball.js';
import { outRule } from './pitch.js';
import { winding } from './gesture.js';
import { keeperSpot } from './keeper.js';
import { makeProfile } from './attributes.js';
import { resoudreRole } from './roles.js';

const d2 = (a, b) => Math.hypot(a[0] - b[0], (a[2] ?? a[1]) - (b[2] ?? b[1]));

/** Un refus a une cause nommée (copie locale du registre du loop). */
const deny = (st, cause) => { (st.deny ??= {})[cause] = (st.deny[cause] ?? 0) + 1; return false; };

export function placeKickoff(st, kickTeam, cfg) {
  const { pitch } = st;
  for (const team of [0, 1]) {
    const sign = pitch.ownGoal(team).sign;                        // le côté DÉFENDU
    // …et l'EXPULSÉ ne revient pas des vestiaires (Loi 12), le REMPLACÉ en chemin non plus
    // (Loi 3) : l'écriture des corps les saute
    const field = st.players.filter((p) => p.team === team && !p.keeper && !p.expulse && !p._sub);
    field.forEach((p, i) => {
      const rows = [[0.28, 0], [0.42, -0.28], [0.42, 0.28], [0.62, -0.14], [0.62, 0.14], [0.75, 0]];
      const [fx, fz] = rows[i % rows.length];
      p.p = [sign * pitch.hx * fx, 0, fz * pitch.dims.width];
      // l'engageur : le premier joueur de l'équipe qui engage, au ballon
      if (team === kickTeam && i === 0) p.p = [sign * 1.2, 0, 0.4];
      // LE COUP D'ENVOI SE JOUE À DEUX (lot 72, même clé que la fenêtre « l'engagement est une
      // passe ») : le second homme au bord du rond, dans son camp — la première passe EXISTE
      // toujours (3,5 m, dans passRange [2,5-13]). Sans lui le preneur était seul : plus proche
      // soutien 14,7 m HORS enveloppe, choosePass NULL toute la fenêtre (graine 5 mesurée).
      if (st.full && cfg?.engagementPasse !== false && team === kickTeam && i === 1) p.p = [sign * 2.6, 0, -2.4];
      p.v = [0, 0]; p.yaw = Math.atan2(0 - p.p[2], 0 - p.p[0]);
      p.act = null; p.intent = null; p.down = 0;
    });
    const gk = st.players.find((p) => p.team === team && p.keeper);
    const g = pitch.ownGoal(team);
    if (gk && !gk.expulse && !gk._sub) { gk.p = [g.x - g.sign * 0.8, 0, 0]; gk.v = [0, 0]; gk.act = null; gk.down = 0; }
  }
}

/** Les positions d'engagement à REJOINDRE EN MARCHANT — le retour au calme après un but.
 *  placeKickoff écrivait les douze corps (jusqu'à 20 m en une image) ; ici on ne pose que des
 *  CIBLES, et movePlayers fait le trajet. Le preneur — parti chercher le ballon dans le filet —
 *  reçoit la place de l'engageur. */
export function kickoffSpots(st, kickTeam, takerId = -1, cfg) {
  const { pitch } = st;
  const spots = {};
  for (const team of [0, 1]) {
    const sign = pitch.ownGoal(team).sign;
    const rows = [[0.28, 0], [0.42, -0.28], [0.42, 0.28], [0.62, -0.14], [0.62, 0.14], [0.75, 0]];
    let i = 0;
    for (const p of st.players.filter((q) => q.team === team && !q.expulse && !q._sub)) {
      if (p.keeper) { const g = pitch.ownGoal(team); spots[p.id] = [g.x - g.sign * 0.8, 0]; continue; }
      if (team === kickTeam && p.id === takerId) { spots[p.id] = [sign * 1.2, 0.4]; continue; }
      // le second homme du rond (voir placeKickoff) CONSOMME sa rangée : le reste garde ses places
      if (st.full && cfg?.engagementPasse !== false && team === kickTeam && i === 0) { i++; spots[p.id] = [sign * 2.6, -2.4]; continue; }
      const [fx, fz] = rows[i++ % rows.length];
      spots[p.id] = [sign * pitch.hx * fx, fz * pitch.dims.width];
    }
  }
  return spots;
}

/**
 * LA LOI 3 — LES REMPLACEMENTS. La LOI est le mécanisme, la POLITIQUE est au projet (le
 * moteur ne décide pas QUI sort — un manager, une UI, une IA de banc appellent l'API,
 * comme Unity ne substitue pas à votre place) :
 *   — `remplacer(st, cfg, team, outId, inSpec)` FILE le changement (refus nommés : limite
 *     loi3.changements, expulsé irremplaçable, déjà en cours) ;
 *   — il s'exécute À L'ARRÊT DE JEU (st.restart vivant — on ne change pas pendant que le
 *     ballon roule, Loi 3.10) : le sortant marche vers la touche par le levier de
 *     l'expulsion (down géant — les cerveaux l'oublient), et à la ligne, L'IDENTITÉ CHANGE
 *     (ratings→makeProfile, nom, numéro, rôle — l'ardoise disciplinaire du sortant PART
 *     AVEC LUI : le carton appartient à l'homme, pas au maillot) ; le corps revient sur le
 *     terrain et les cerveaux le reprennent.
 * Dettes nommées : le banc INCARNÉ (des corps assis qui s'échauffent — aujourd'hui l'entrant
 * naît à la ligne), la fenêtre de remplacements comptée (3 fenêtres + mi-temps).
 */
export function remplacer(st, cfg, team, outId, inSpec = null) {
  if (!cfg?.loi3 || !st.full) return false;                        // la porte de la loi
  const q = st.players[outId];
  if (!q || q.team !== team || q.expulse || q._sub) return false;
  const S = (st._subs ??= [[], []]);
  const faits = st.events.filter((e) => e.type === 'remplacement' && e.team === team).length;
  if (faits + S[team].length >= (cfg.loi3.changements ?? 5)) return false;
  if (S[team].some((s) => s.out === outId)) return false;
  S[team].push({ out: outId, spec: inSpec });
  return true;
}

/** Le tick des remplacements (appelé par matchStep sous cfg.loi3 && st.full) : l'exécution
 *  à l'arrêt de jeu, la marche du sortant, l'échange d'identité à la ligne, le retour. */
export function stepRemplacements(st, cfg) {
  const S = st._subs;
  if (S && st.restart) {
    for (const team of [0, 1]) {
      for (const sub of S[team].splice(0)) {
        const q = st.players[sub.out];
        if (!q || q.expulse || q._sub) continue;
        q._sub = { phase: 'out', spec: sub.spec };
        q.down = 9e9;                                              // le levier natif : les cerveaux l'oublient
        q._exit = [Math.max(-st.pitch.hx + 2, Math.min(st.pitch.hx - 2, q.p[0])),
          (q.p[2] >= 0 ? 1 : -1) * (st.pitch.hz + 2.0)];
        q.act = null; q.intent = null;
      }
    }
  }
  for (const q of st.players) {
    if (!q._sub) continue;
    if (q._sub.phase === 'out') {
      if (Math.hypot(q.p[0] - q._exit[0], q.p[2] - q._exit[1]) < 1.2) {
        const spec = q._sub.spec ?? {};
        q.ratings = spec.ratings ?? null;
        q.skill = spec.ratings ? makeProfile(spec.ratings) : null;
        q.look = spec.look ?? null;
        q.name = spec.name ?? q.name;
        q.number = spec.number ?? null;
        if (spec.role != null) q.role = resoudreRole(spec.role);
        q._fautes = 0; q._jaunes = 0;                              // l'ardoise part avec l'homme
        q.stam = 1; q._fatEv = null;                               // …et l'entrant a des JAMBES NEUVES (lot 31)
        st.events.push({ t: +st.t.toFixed(2), type: 'remplacement', team: q.team, id: q.id, minute: Math.floor(st.t / 60) + 1 });
        q._sub = { phase: 'in', entry: [q._exit[0], Math.sign(q.p[2]) * (st.pitch.hz - 3)] };
      }
    } else if (q._sub.phase === 'in' && Math.abs(q.p[2]) < st.pitch.hz - 2.5) {
      q.down = 0; q._sub = null; q._exit = null;                   // les cerveaux le reprennent
    }
  }
}

/**
 * LA LOI 15 — LA RENTRÉE DE TOUCHE SE LANCE À LA MAIN (cfg.onTake, prise d'une remise
 * 'touche'). Le lanceur choisit un coéquipier À PORTÉE DE BRAS (loi15.range) et le ballon
 * part EN CLOCHE (release('touche') nommé au grand livre, puis strike balistique — l'angle
 * fait l'arc, ~32°). Et l'EXEMPTION DE LA LOI 11 EST STRUCTURELLE : pas de photo de
 * hors-jeu (st.pass sans .off), pas de veto de cerveau — « il n'y a pas de hors-jeu sur
 * une rentrée de touche » n'est pas un cas spécial du sifflet, c'est une photo qui n'a
 * jamais été prise. Dettes nommées : le geste des deux mains (clip d'animation), le
 * double-toucher du lanceur, la touche foireuse (foul throw).
 */
export function remiseEnTouche(st, id, cfg) {
  const q = st.players[id];
  const R = cfg.loi15?.range ?? 18;
  const mates = st.players.filter((m) => m.team === q.team && m.id !== id && !m.keeper && m.down <= 0);
  if (!mates.length) return;
  const foes = st.players.filter((m) => m.team !== q.team && m.down <= 0);
  const dOf = (m) => Math.hypot(m.p[0] - q.p[0], m.p[2] - q.p[2]);
  let best = null, bestS = -Infinity;
  for (const m of mates) {
    const d = dOf(m);
    if (d < 2 || d > R) continue;
    const guard = Math.min(...foes.map((f) => Math.hypot(f.p[0] - m.p[0], f.p[2] - m.p[2])), 99);
    const s = Math.min(guard, 8) - d * 0.08;                      // le plus démarqué, à portée
    if (s > bestS) { bestS = s; best = m; }
  }
  best ??= mates.sort((a, b) => dOf(a) - dOf(b))[0];              // à défaut : le plus proche, court
  const dx = best.p[0] - q.p[0], dz = best.p[2] - q.p[2];
  const Rr = Math.min(Math.hypot(dx, dz), R);
  const theta = 0.55;                                             // ~32° : la cloche de la touche
  const speed = Math.sqrt(Math.max(4, Rr) * 9.81 / Math.sin(2 * theta));
  st.ball.release('touche');                                      // la cause VRAIE au grand livre
  st.ball.strike({ speed, dirYaw: Math.atan2(dz, dx), elevation: theta, spinAxis: [0, 1, 0], spinRev: 0 });
  st.phase = 'flight';
  st.possession.carrier = -1; st.hold = 0; st.pressure = 0;
  const T = 2 * speed * Math.sin(theta) / 9.81;
  st.pass = { from: id, to: best.id, lead: [best.p[0], 0, best.p[2]], style: 'touche', t: st.t, flight: T, origin: [q.p[0], q.p[2]] };
  // 'rentrée', pas 'touche' : l'événement 'touche' est le TOUCHER de balle (conduite) — un
  // même mot, deux faits ; le registre les sépare
  st.events.push({ t: +st.t.toFixed(2), type: 'rentrée', by: id, to: best.id, range: +Rr.toFixed(1) });
}

/**
 * LE COUP FRANC DIRECT (lot 97, cfg.cfDirect && st.full — la SANCTION qui manquait : mesuré,
 * l'accrochage rendait 42 fautes / 20 matchs mais les coups francs joués en passe ne rendaient
 * RIEN — la faute ne coûtait pas, A/B 18 → 14). À la PRISE d'un coup franc à portée (< 30 m du
 * but, angle raisonnable — v montée à 19,5 au-delà de 27 m, la fenêtre balistique l'exige), le
 * preneur ENROULE PAR-DESSUS LE MUR : l'élévation se RÉSOUT (petit balayage : passer ≥ 2,35 m
 * à 9,15 m — le mur saute à 2,2 —, retomber sous la barre au but), le Magnus signé ramène au
 * poteau (la lecture linéaire du gardien sous-estime l'arrivée — l'avantage du curler, lot
 * 39). Hors fenêtre : le LANCEMENT (ci-dessous) ou la remise en passe d'hier. La CONVERSION
 * sort de la PHYSIQUE (mur réel, gardien lot 94 posté côté ouvert, poteaux).
 */
export function coupFrancDirect(st, id, cfg) {
  const q = st.players[id];
  const { pitch } = st;
  const goal = pitch.attackGoal(q.team);
  const dx = goal.x - q.p[0], dzB = 0 - q.p[2];
  const d = Math.hypot(dx, dzB);
  if (d > 30 || d < 14 || Math.abs(q.p[2]) > 15) return false;     // trop loin, trop près (mur infranchissable), trop excentré
  const gk = st.players.find((p) => p.keeper && p.team !== q.team);
  const tz = (gk ? -Math.sign(gk.p[2] || 1) : (st.rnd2 ?? st.rnd ?? (() => 0.5))() < 0.5 ? -1 : 1) * (pitch.goalHalf - 0.7);
  const yaw = Math.atan2(tz - q.p[2], goal.x - q.p[0]);
  const dT = Math.hypot(goal.x - q.p[0], tz - q.p[2]);
  const v = d > 27 ? 19.5 : 18.5;
  let theta = null;
  for (let t = 0.30; t <= 0.52; t += 0.02) {                       // le balayage : mur passé, barre respectée
    const y = (x) => x * Math.tan(t) - (9.81 * x * x) / (2 * v * v * Math.cos(t) * Math.cos(t));
    if (y(9.15) >= 2.35 && y(dT) <= 2.05 && y(dT) >= 0.2) { theta = t; break; }
  }
  if (theta == null) return false;                                 // pas de fenêtre balistique : on joue
  st.ball.release('frappe');
  st.ball.strike({ speed: v, dirYaw: yaw, elevation: theta,
    spinAxis: [0, 1, 0], spinRev: -Math.sign(goal.x || 1) * Math.sign(tz) * 6 });
  st.phase = 'flight';
  st.possession.carrier = -1; st.hold = 0; st.pressure = 0;
  st.pass = { from: id, to: -2, lead: [goal.x, 0, tz], style: 'cf-direct', t: st.t, flight: dT / (v * Math.cos(theta)), origin: [q.p[0], q.p[2]] };
  st.lastPasser = id;
  st.events.push({ t: +st.t.toFixed(2), type: 'shot', by: id, foot: q.foot ?? 'right', kind: 'coup-franc-direct',
    range: +d.toFixed(1), tz: +tz.toFixed(2), speed: v, elev: +theta.toFixed(2), z: +q.p[2].toFixed(1), clear: null, gkZ: gk ? +gk.p[2].toFixed(2) : null });
  return true;
}

/**
 * LE LANCEMENT DE COUP FRANC (lot 97, même clé cfg.cfDirect — le CF LOINTAIN met le ballon
 * DANS LA BOÎTE). Mesuré : 10 des 11 coups francs naissent au-delà de 30 m (l'accrochage vit
 * au milieu — sonde 8 × 300 s) et la remise courte d'hier ne rendait RIEN : la faute ne
 * coûtait pas. Au réel, la vraie sanction d'une faute à 35-55 m est un COUP DE PIED ARRÊTÉ :
 * le ballon lobé vers la surface, le duel aérien. Le tireur vise l'ESPACE devant le but
 * (~10,5 m, ±z seedé rnd2) ; le coéquipier le plus proche du point de chute finit sa course
 * (lot 59), la cloche se calcule (portée → v à θ 0,62, backspin des passes levées lot 54), le
 * reste est PHYSIQUE : l'aimant du premier toucher, le gardien du corner (lot 94), les têtes
 * (lot 34). Dette nommée : pas de photo Loi 11 sur la remise (comme la rentrée de touche).
 */
export function coupFrancLance(st, id, cfg) {
  const q = st.players[id];
  const { pitch } = st;
  const goal = pitch.attackGoal(q.team);
  const d = Math.hypot(goal.x - q.p[0], 0 - q.p[2]);
  if (d > 55 || d <= 30) return false;                             // trop loin pour la boîte ; à portée, le direct s'en charge
  const rnd = st.rnd2 ?? st.rnd ?? (() => 0.5);
  const sg = Math.sign(goal.x || 1);
  const tx = goal.x - sg * 10.5, tz = (rnd() < 0.5 ? -1 : 1) * (2 + 5 * rnd());
  const mates = st.players.filter((m) => m.team === q.team && m.id !== id && !m.keeper && m.down <= 0);
  if (!mates.length) return false;
  const best = mates.sort((a, b) => Math.hypot(a.p[0] - tx, a.p[2] - tz) - Math.hypot(b.p[0] - tx, b.p[2] - tz))[0];
  const R = Math.hypot(tx - q.p[0], tz - q.p[2]);
  const theta = 0.62, v = Math.sqrt(R * 9.81 / Math.sin(2 * theta));
  const yaw = Math.atan2(tz - q.p[2], tx - q.p[0]);
  st.ball.release('coup-franc');                                   // la cause VRAIE au grand livre
  st.ball.strike({ speed: v, dirYaw: yaw, elevation: theta, spinAxis: [-Math.sin(yaw), 0, Math.cos(yaw)], spinRev: 3.5 });
  st.phase = 'flight';
  st.possession.carrier = -1; st.hold = 0; st.pressure = 0;
  st.pass = { from: id, to: best.id, lead: [tx, 0, tz], style: 'cf-lancement', t: st.t, flight: 2 * v * Math.sin(theta) / 9.81, origin: [q.p[0], q.p[2]] };
  st.lastPasser = id;
  st.events.push({ t: +st.t.toFixed(2), type: 'lancement', by: id, to: best.id, range: +d.toFixed(1), lead: [+tx.toFixed(1), +tz.toFixed(1)] });
  return true;
}

/**
 * LE CORNER TRAVAILLÉ (lot 101, cfg.corner && st.full — hook onTake, le patron du lancement
 * lot 97). Mesuré avant : 1 corner sur 8 × 220 s (la naissance manquait — la claquette-corner
 * du même lot la répare) et la prise se jouait en passe courte ordinaire : aucun danger. Au
 * réel le corner MET LE BALLON DANS LA BOÎTE : cible seedée rnd2 (premier poteau 40 %,
 * point de penalty 30 %, second poteau 30 %), cloche tendue (θ 0,45, v par la portée), et LA
 * PATTE DU TIREUR fait le genre (le patron des lots 87/100) : pied fort opposé au côté =
 * RENTRANT (la courbe fuit VERS le but — le corner dangereux, spin 5), pied du côté =
 * SORTANT (elle s'éloigne vers la reprise, spin 3), both = tendu. La branche COURTE vit à
 * l'axe style (possession 35 % — le tiki-taka joue court —, direct 5 %) : return false = la
 * remise courte d'hier. La CONVERSION sort de la PHYSIQUE : têtes lot 34, volées lot 40,
 * gardien du corner lot 94 (posté moitié lointaine). Événement 'corner-joué' {genre, cible}.
 */
export function cornerTrav(st, id, cfg) {
  const q = st.players[id];
  const { pitch } = st;
  const goal = pitch.attackGoal(q.team);
  const sg = Math.sign(goal.x || 1);
  if (Math.abs(Math.abs(q.p[0]) - pitch.hx) > 4) return false;     // pas un vrai coin (sécurité)
  const rnd = st.rnd2 ?? st.rnd ?? (() => 0.5);
  const sty = st.tactics ? (st.tactics[q.team]?.style ?? 0.5) : 0.5;
  if (rnd() < 0.35 - Math.max(0, Math.min(1, sty)) * 0.30) return false;   // le CORT du style : possession 35 %, direct 5 %
  const cz = Math.sign(q.p[2] || 1);
  const u = rnd();
  const cible = u < 0.4 ? [goal.x - sg * 5.5, cz * (pitch.goalHalf - 1)]        // premier poteau
    : u < 0.7 ? [goal.x - sg * 11, 0]                                            // point de penalty
    : [goal.x - sg * 5.5, -cz * (pitch.goalHalf - 1)];                           // second poteau
  const sf = cfg.patte !== false ? (q.strongFoot ?? 'right') : 'both';
  const rentrant = sf === 'both' ? 0 : ((Math.sign(q.p[2] * -(goal.x || 1)) > 0) === (sf === 'right') ? 1 : -1);
  const R = Math.hypot(cible[0] - q.p[0], cible[1] - q.p[2]);
  const theta = 0.45, v = Math.sqrt(Math.max(10, R) * 9.81 / Math.sin(2 * theta));
  const yaw = Math.atan2(cible[1] - q.p[2], cible[0] - q.p[0]);
  st.ball.release('coup-franc');                                   // la cause des coups de pied arrêtés au grand livre
  st.ball.strike({ speed: v, dirYaw: yaw, elevation: theta, spinAxis: [0, 1, 0],
    spinRev: rentrant === 0 ? 0 : -sg * cz * (rentrant > 0 ? 5 : -3) });
  st.phase = 'flight';
  st.possession.carrier = -1; st.hold = 0; st.pressure = 0;
  const mates = st.players.filter((m) => m.team === q.team && m.id !== id && !m.keeper && m.down <= 0);
  const best = mates.length ? mates.sort((a, b) => Math.hypot(a.p[0] - cible[0], a.p[2] - cible[1]) - Math.hypot(b.p[0] - cible[0], b.p[2] - cible[1]))[0] : null;
  st.pass = { from: id, to: best?.id ?? -2, lead: [cible[0], 0, cible[1]], style: 'corner', t: st.t, flight: 2 * v * Math.sin(theta) / 9.81, origin: [q.p[0], q.p[2]] };
  st.lastPasser = id;
  st.events.push({ t: +st.t.toFixed(2), type: 'corner-joué', by: id, genre: rentrant > 0 ? 'rentrant' : rentrant < 0 ? 'sortant' : 'tendu', cible: u < 0.4 ? 'premier' : u < 0.7 ? 'penalty' : 'second' });
  return true;
}

/**
 * LE PLACEMENT DU CORNER (lot 102, cfg.corner && st.full — la dette du lot 101 : mesuré sur
 * corner posé, 0 attaquant en boîte et le premier poteau gardé à 24-27 m — la branche
 * générique faisait marcher TOUTE l'attaque vers le coin). Le PLAN se calcule UNE fois par
 * remise (r.at la date) : les GRANDS de l'attaque (chargeF — l'attribut du duel aérien lot
 * 34) montent aux POSTES de la boîte (premier poteau, point de penalty, second poteau,
 * axe 9 m, retrait 16,5 m — les cibles mêmes de cornerTrav) ; la défense répond HOMME :
 * chaque monteur a son marqueur GOAL-SIDE (le plus proche, greedy), un défenseur garde le
 * PREMIER POTEAU (le poste classique). Le reste des corps garde les lois d'hier (le rayon,
 * la couverture). Les corps COURENT en place (pas de téléport) — la POSE du corner s'allonge
 * (corner.pose, onOut) : le vrai corner prend 20-40 s à se poser. Clé absente : hier au bit.
 */
export function cornerSpots(st, r, p, cfg) {
  const P = st._cornerPlan?.at === r.at ? st._cornerPlan : (st._cornerPlan = (() => {
    const g = st.pitch.attackGoal(r.team), sg = Math.sign(g.x || 1), cz = Math.sign(r.p[1] || 1);
    const gh = st.pitch.goalHalf, spot = st.pitch.dims.spot ?? 11;
    const posts = [[g.x - sg * 5.5, cz * (gh - 1)], [g.x - sg * spot, 0], [g.x - sg * 5.5, -cz * (gh - 1)], [g.x - sg * 9, cz * 5], [g.x - sg * 16.5, -cz * 2]];
    const atk = st.players.filter((q) => q.team === r.team && !q.keeper && q.id !== r.taker && q.down <= 0 && !q.expulse && !q._sub)
      .sort((a, b) => (b.skill?.chargeF ?? 1) - (a.skill?.chargeF ?? 1)).slice(0, posts.length);
    const map = {};
    atk.forEach((q, i) => { map[q.id] = posts[i]; });
    const defs = st.players.filter((q) => q.team !== r.team && !q.keeper && q.down <= 0 && !q.expulse && !q._sub);
    const pris = new Set();
    atk.forEach((q, i) => {
      const m = defs.filter((d) => !pris.has(d.id)).sort((a, b) => d2(a.p, posts[i]) - d2(b.p, posts[i]))[0];
      if (m) { pris.add(m.id); map[m.id] = [posts[i][0] + sg * 0.9, posts[i][1] * 0.92]; }   // goal-side, un demi-pas vers l'axe
    });
    const pot = defs.filter((d) => !pris.has(d.id)).sort((a, b) => Math.hypot(a.p[0] - g.x, a.p[2] - cz * gh) - Math.hypot(b.p[0] - g.x, b.p[2] - cz * gh))[0];
    if (pot) map[pot.id] = [g.x - sg * 0.6, cz * (gh - 0.4)];
    return { at: r.at, map };
  })());
  return P.map[p.id] ?? null;
}

// ---------------------------------------------------------------- la sortie et les remises
/**
 * LA SORTIE DE BALLE, par la RÈGLE (pitch.outRule au point de franchissement interpolé).
 * But → score + engagement ; touche/corner/sortie de but → remise placée, adversaires au rayon.
 */
export function onOut(st, cfg) {
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
      st.restart.spots = kickoffSpots(st, r.team, st.restart.taker, cfg);
    } else {
      placeKickoff(st, r.team, cfg);
      st.ball.restart([0, BALL.radius, 0], { cause: 'engagement' });
    }
  } else {
    st.events.push({ t: +st.t.toFixed(2), type: 'sortie', out: r.type, team: r.team, p: [+r.x.toFixed(1), +r.z.toFixed(1)] });
    st.restart = { type: r.type, p: [r.x, r.z], team: r.team, at: st.t + cfg.restartWait };
    // LA POSE DU CORNER S'ALLONGE (lot 102, cfg.corner.pose — le vrai corner prend 20-40 s) :
    // les monteurs partent de 30-40 m, la marche de remise demande son temps (cornerSpots)
    if (r.type === 'corner' && st.full && cfg.corner) st.restart.at = st.t + (cfg.corner.pose ?? 10);
    if (carried) { brake(0.35); st.restart.placed = false; st.restart.taker = nearTaker(r.team); }
    else st.ball.restart([r.x, BALL.radius, r.z], { cause: r.type });
  }
  st.phase = 'loose'; st.possession.carrier = -1; st.pass = null; st.hold = 0; st.pressure = 0;
  for (const p of st.players) if (p.act && winding(p)) p.act = null;   // une remise annule les armés
  return true;
}

/** Qui a le droit de prendre le ballon ? Pendant une remise : l'équipe de la remise, à l'heure,
 *  et JAMAIS avant que le ballon soit POSÉ au point de remise (la remise portée a son trajet). */
export function canTake(st, takerId) {
  if (!st.restart) return true;
  const p = st.players[takerId];
  if (st.restart.placed === false) return false;
  if (st.t < st.restart.at - 0.25) return false;
  if (p.team !== st.restart.team) return false;
  const ty = st.restart.type;
  // L'ARBITRE TIENT LE COUP D'ENVOI (Loi 8, lot 72) : la reprise ATTEND que le rond central
  // soit vide d'adversaires — l'expulsé du rond (l'attaquant du but d'avant) traversait le
  // preneur à 1,1 m et CONTESTAIT la première passe : release en ping-pong, 63 refus
  // ballon-vif, 14 s avant que l'engagement parte (mesuré graine 1, engagement de la 64e s).
  if (ty === 'engagement' && st.full) {
    const R = (st.pitch?.dims?.circle ?? 9.15) * 0.9;
    for (const q of st.players) {
      if (q.team === p.team || q._sub || q.expulse || q.keeper || q.down > 0) continue;
      if (Math.hypot(q.p[0] - st.restart.p[0], q.p[2] - st.restart.p[1]) < R) return false;
    }
  }
  st.restart = null;                                               // la remise est PRISE — le jeu reprend
  st.events.push({ t: +st.t.toFixed(2), type: 'restart-pris', by: takerId });
  // L'ENGAGEMENT EST UNE PASSE (lot 45, retour utilisateur « sur l'engagement le joueur part
  // en dribble ») : le monde ENTIER est devant le preneur — la barre calme (4,8) refusait la
  // passe courte de l'engagement et il partait en conduite. Le mémo est lu par la décision
  // (rondo-sim : barre abaissée + tenue dispensée pendant la fenêtre).
  if (ty === 'engagement') st._engagement = { t: st.t, by: takerId };
  return true;
}

/**
 * LE CYCLE DE MATCH (cfg.chrono) : les sifflets de période. Coupe PROPRE (mêmes soins que le
 * coup franc : ballon arrêté par l'arbitre, armés annulés, phase neutre), puis la mi-temps
 * (l'équipe qui n'a PAS engagé la période 1 engage — Loi 8, et les périodes supplémentaires
 * alternent) ou le sifflet FINAL (st.fini + restart 'fin' : un moteur rend un état terminal
 * propre, pas un gel). La possession s'accumule ici en TEMPS DE SIM (delta d'horloge — aucun
 * dt à faire transiter par les hooks).
 */
export function chronoStep(st, cfg) {
  const ch = cfg.chrono;
  const C = (st._chrono ??= { periode: 1, poss: [0, 0], _pt: st.t });
  const dt = st.t - C._pt; C._pt = st.t;
  if (st.fini) return;
  if (st.possession.team >= 0 && !st.restart && dt > 0) C.poss[st.possession.team] += dt;
  const duree = ch.duree ?? 180, pause = ch.pause ?? 6, periodes = ch.periodes ?? 2;
  // LE TEMPS ADDITIONNEL (ch.additionnel !== false) : les arrêts de jeu de LA période
  // s'accumulent, l'arbitre en rend une fraction (×0,35, plafonnée à 12 % de la période) —
  // et l'annonce est un événement quand la période nominale expire. false : la montre truquée
  // (sabotage nommé — la période coupe pile, les remises ont mangé du jeu).
  if (st.restart && dt > 0 && !st.fini) C.arrets = (C.arrets ?? 0) + dt;
  const add = ch.additionnel !== false ? Math.min(duree * 0.12, (C.arrets ?? 0) * 0.35) : 0;
  const finNominale = C.periode * duree + (C.periode - 1) * pause;
  if (ch.additionnel !== false && !C.annonce && st.t >= finNominale) {
    C.annonce = true;
    st.events.push({ t: +st.t.toFixed(2), type: 'temps-additionnel', periode: C.periode, sec: +add.toFixed(1) });
  }
  if (st.t < finNominale + add) return;
  st.ball.release('arrêt-de-jeu');
  st.ball.impulse([-st.ball.v[0] * 0.8, 0, -st.ball.v[2] * 0.8]);
  st.phase = 'loose'; st.possession.carrier = -1; st.pass = null; st.hold = 0; st.pressure = 0;
  for (const p of st.players) if (p.act && winding(p)) p.act = null;
  if (C.periode >= periodes) {
    st.fini = true;
    st.restart = { type: 'fin', p: [0, 0], team: -1, at: Infinity };
    st.events.push({ t: +st.t.toFixed(2), type: 'fin-de-match', score: [...st.score] });
    return;
  }
  C.periode += 1;
  C.arrets = 0; C.annonce = false;
  const team = C.periode % 2 === 0 ? 1 : 0;
  st.events.push({ t: +st.t.toFixed(2), type: 'mi-temps', periode: C.periode, score: [...st.score] });
  // L'ÉCHANGE DE CAMPS (ch.echangeCamps !== false — Loi 8) : une bascule, TOUT suit (ownGoal
  // est la source unique). La mi-temps est LA discontinuité légitime des CORPS — ils passent
  // aux vestiaires, ils ne marchent pas 50 m en 6 s : placeKickoff les pose côté neuf, le
  // ballon repart par une remise à cause nommée. (Le ballon, lui, ne se téléporte JAMAIS
  // hors remise — sa loi ne bouge pas.)
  if (ch.echangeCamps !== false && st.pitch?.echangerCamps) st.pitch.echangerCamps();
  // …et les VESTIAIRES RENDENT DES JAMBES (cfg.fatigue, lot 31) : la pause récupère une
  // fraction d'essence — pas tout (un match se gère, la seconde période se joue plus bas)
  if (cfg.fatigue && st.full) for (const p of st.players) { p.stam = Math.min(1, (p.stam ?? 1) + (cfg.fatigue.pause ?? 0.25)); p._fatEv = p.stam < 0.35 ? p._fatEv : null; }
  st.restart = { type: 'engagement', p: [0, 0], team, at: st.t + pause };
  placeKickoff(st, team, cfg);
  st.ball.restart([0, BALL.radius, 0], { cause: 'engagement' });
}

/**
 * LA LOI 12 S'ADJUGE ICI (lot 25) : L'AVANTAGE D'ABORD — on ne siffle pas une équipe qui a gardé
 * le ballon (fenêtre cfg.loi12.avantage ; à 0, le sifflet est immédiat : le sabotage « avantage
 * myope »). Perdu, ou fenêtre close sans le ballon : le SIFFLET — penalty si la faute vit dans
 * la SURFACE DU FAUTIF (restart 'penalty' au point, la cause existe depuis ball-body), coup
 * franc au point de la faute sinon — même cérémonie portée que la Loi 11. Cartons et cérémonie
 * stricte du penalty (tous hors surface) : dettes nommées v1.
 */
export function adjugeFaute(st, cfg) {
  const F = st._faute;
  const fen = cfg.loi12.avantage ?? 1.8;
  const holder = st.possession.team;
  const fin = st.t - F.t >= fen;
  const perdu = holder != null && holder >= 0 && holder !== F.team && st.phase === 'carry';
  if (!fin && !perdu && fen > 0) return;
  st._faute = null;
  // LE CARTON (discipline Loi 12) — dans les DEUX branches : le carton SURVIT à l'avantage
  // (l'arbitre le montre, avantage joué ou pas). La faute est comptée à son HOMME ; la
  // récidive (cfg.loi12.jaune fautes) vaut JAUNE, le second jaune vaut ROUGE — deux
  // événements, comme les deux gestes de l'arbitre. L'expulsion PHYSIQUE est une dette
  // nommée : le corps qui sort touche la formation (à 10), la ligne de hors-jeu et tous
  // les cerveaux d'équipe — un chantier propre, pas un flag jeté ici.
  const seuil = cfg.loi12.jaune ?? 2;
  const fautif = st.players[F.par];
  if (seuil > 0 && fautif) {
    // …et l'IMPRUDENCE compte DOUBLE (F.grave — le tacle glissé par derrière, lot 33) : le
    // jaune vient vite sans être automatique, comme la vraie échelle des sanctions
    fautif._fautes = (fautif._fautes ?? 0) + (F.grave ? 2 : 1);
    if (fautif._fautes % seuil === 0) {
      fautif._jaunes = (fautif._jaunes ?? 0) + 1;
      st.events.push({ t: +st.t.toFixed(2), type: 'carton', couleur: 'jaune', by: F.par, cumul: fautif._jaunes });
      if (fautif._jaunes === 2) {
        st.events.push({ t: +st.t.toFixed(2), type: 'carton', couleur: 'rouge', by: F.par });
        // L'EXPULSION PHYSIQUE (lot 28) : le rouge SORT le corps. Il marche vers la ligne la
        // plus proche et y RESTE — et il CESSE D'EXISTER pour les cerveaux par le levier natif :
        // down géant (les ~30 filtres down<=0 du moteur le couvrent sans être touchés — une
        // autorité, zéro seconde vérité) ; movement le laisse MARCHER (l'expulsé n'est pas un
        // corps au sol), la Loi 11, placeKickoff/kickoffSpots et la boucle de jobs le sautent
        // NOMMÉMENT. L'équipe joue à 10. Gardien expulsé : dette nommée (pas de remplaçant aux
        // gants — le poste reste vide).
        fautif.expulse = true;
        fautif.down = 9e9;
        fautif._exit = [Math.max(-st.pitch.hx + 2, Math.min(st.pitch.hx - 2, fautif.p[0])),
          (fautif.p[2] >= 0 ? 1 : -1) * (st.pitch.hz + 2.5)];
        fautif.job = 'walk'; fautif.target = [fautif._exit[0], 0, fautif._exit[1]];
        fautif.act = null; fautif.intent = null;
        st.events.push({ t: +st.t.toFixed(2), type: 'expulsion', by: F.par });
      }
    }
  }
  if (fen > 0 && fin && !perdu && holder === F.team && st.possession.carrier >= 0) {
    st.events.push({ t: +st.t.toFixed(2), type: 'avantage', team: F.team });
    return;
  }
  const { pitch } = st;
  const own = pitch.ownGoal(1 - F.team);                            // le camp du FAUTIF
  const dansSurface = pitch.inBox(F.p[0], F.p[1], Math.sign(own.x));
  st.ball.release('arrêt-de-jeu');
  st.ball.impulse([-st.ball.v[0] * 0.65, 0, -st.ball.v[2] * 0.65]);
  const p = dansSurface ? [own.x - Math.sign(own.x) * pitch.dims.spot, 0]
    : [Math.max(-pitch.hx + 1.2, Math.min(pitch.hx - 1.2, F.p[0])), Math.max(-pitch.hz + 1.2, Math.min(pitch.hz - 1.2, F.p[1]))];
  const type = dansSurface ? 'penalty' : 'coup-franc';
  st.events.push({ t: +st.t.toFixed(2), type: 'sortie', out: type, team: F.team, p: [+p[0].toFixed(1), +p[1].toFixed(1)] });
  st.restart = { type, p, team: F.team, at: st.t + cfg.restartWait + (dansSurface ? 1 : 0) };
  if (cfg.restartCarried !== false) {
    st.restart.placed = false;
    const tk = st.players.filter((q) => q.team === F.team && !q.keeper && q.down <= 0)
      .sort((a, b) => d2(a.p, st.ball.p) - d2(b.p, st.ball.p))[0];
    st.restart.taker = tk ? tk.id : -1;
  } else st.ball.restart([p[0], BALL.radius, p[1]], { cause: type });
  st.phase = 'loose'; st.possession.carrier = -1; st.pass = null; st.hold = 0; st.pressure = 0;
  for (const q of st.players) if (q.act && winding(q)) q.act = null;
}

/**
 * LA FEUILLE DE MATCH — l'export PRODUIT : tout se lit des ÉVÉNEMENTS et des accumulateurs du
 * chrono, rien ne se recompte ailleurs (une stat qui vivrait dans la scène serait une seconde
 * vérité). Pure : un état entre, des chiffres sortent — benchable (verify-chrono).
 */
export function feuilleDeMatch(st) {
  const evs = st.events;
  const teamOf = (e) => e.team ?? (e.by != null ? st.players[e.by]?.team : (e.from != null ? st.players[e.from]?.team : null));
  const paire = (type) => { const r = [0, 0]; for (const e of evs) if (e.type === type) { const t = teamOf(e); if (t === 0 || t === 1) r[t]++; } return r; };
  const poss = st._chrono?.poss ?? [0, 0];
  const tot = poss[0] + poss[1];
  return {
    score: [...st.score],
    buts: evs.filter((e) => e.type === 'but').map((e) => ({ minute: Math.floor(e.t / 60) + 1, equipe: e.team })),
    tirs: paire('shot'), arrets: paire('arrêt'), passes: paire('pass'), centres: paire('centre'),
    horsJeu: paire('hors-jeu'),
    coupsFrancs: (() => { const r = [0, 0]; for (const e of evs) if (e.type === 'sortie' && e.out === 'coup-franc' && (e.team === 0 || e.team === 1)) r[e.team]++; return r; })(),
    fautes: paire('faute'),
    remplacements: (() => { const r = [0, 0]; for (const e of evs) if (e.type === 'remplacement' && (e.team === 0 || e.team === 1)) r[e.team]++; return r; })(),
    cartons: (() => {
      const j = [0, 0], r = [0, 0];
      for (const e of evs) if (e.type === 'carton') { const t = st.players[e.by]?.team; if (t === 0 || t === 1) (e.couleur === 'rouge' ? r : j)[t]++; }
      return { jaunes: j, rouges: r };
    })(),
    pressing: paire('press'),
    possession: tot > 0 ? [Math.round((100 * poss[0]) / tot), Math.round((100 * poss[1]) / tot)] : [50, 50],
    periode: st._chrono?.periode ?? 1,
    fini: !!st.fini,
  };
}

/**
 * LE COUP FRANC DU HORS-JEU (Loi 11) : le drapeau s'est levé au toucher (receive → st._whistle) ;
 * ici on ADMINISTRE, à l'image suivante — même cérémonie qu'une sortie : le ballon est arrêté par
 * l'arbitre (freiné, pas écrit), le preneur ADVERSE vient le chercher et le porte au point de
 * l'infraction (ballFetch). Un sifflet pendant une remise déjà en cours est caduc.
 */
export function administerWhistle(st, cfg) {
  const w = st._whistle; st._whistle = null;
  if (st.restart) return;
  const { pitch } = st;
  const x = Math.max(-pitch.hx + 1.2, Math.min(pitch.hx - 1.2, w.p[0]));
  const z = Math.max(-pitch.hz + 1.2, Math.min(pitch.hz - 1.2, w.p[1]));
  st.events.push({ t: +st.t.toFixed(2), type: 'sortie', out: 'coup-franc', team: w.team, p: [+x.toFixed(1), +z.toFixed(1)] });
  st.restart = { type: 'coup-franc', p: [x, z], team: w.team, at: st.t + cfg.restartWait };
  st.ball.release('arrêt-de-jeu');
  st.ball.impulse([-st.ball.v[0] * 0.65, 0, -st.ball.v[2] * 0.65]);
  if (cfg.restartCarried !== false) {
    st.restart.placed = false;
    const t = st.players.filter((p) => p.team === w.team && !p.keeper && p.down <= 0)
      .sort((a, b) => d2(a.p, st.ball.p) - d2(b.p, st.ball.p))[0];
    st.restart.taker = t ? t.id : -1;
  } else st.ball.restart([x, BALL.radius, z], { cause: 'coup-franc' });
  st.phase = 'loose'; st.possession.carrier = -1; st.pass = null; st.hold = 0; st.pressure = 0;
  for (const p of st.players) if (p.act && winding(p)) p.act = null;   // le sifflet annule les armés
}

/**
 * LE PORTÉ DE LA REMISE — le pas du ballon libre, délégué par le loop (hook ballFetch, no-op au
 * rondo). Tant que la remise n'est pas posée : le preneur RAMASSE le ballon là où il a fini de
 * rouler (possession déclarée au corps du ballon), le porte AU PIED jusqu'au point de remise,
 * et le POSE (release à cause nommée + rest) — zéro discontinuité, le registre du BallBody en
 * témoigne. Renvoie true quand le porté a fait avancer le ballon (le loop ne double-intègre pas).
 */
export function ballFetch(st, dt) {
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
