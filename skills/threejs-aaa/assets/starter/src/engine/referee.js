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

const d2 = (a, b) => Math.hypot(a[0] - b[0], (a[2] ?? a[1]) - (b[2] ?? b[1]));

/** Un refus a une cause nommée (copie locale du registre du loop). */
const deny = (st, cause) => { (st.deny ??= {})[cause] = (st.deny[cause] ?? 0) + 1; return false; };

export function placeKickoff(st, kickTeam) {
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
export function kickoffSpots(st, kickTeam, takerId = -1) {
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
export function canTake(st, takerId) {
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
  if (st.t < C.periode * duree + (C.periode - 1) * pause) return;
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
  const team = C.periode % 2 === 0 ? 1 : 0;
  st.events.push({ t: +st.t.toFixed(2), type: 'mi-temps', periode: C.periode, score: [...st.score] });
  st.restart = { type: 'engagement', p: [0, 0], team, at: st.t + pause };
  if (cfg.restartCarried !== false) {
    st.restart.placed = false;
    const taker = st.players.filter((p) => p.team === team && !p.keeper && p.down <= 0)
      .sort((a, b) => d2(a.p, st.ball.p) - d2(b.p, st.ball.p))[0];
    st.restart.taker = taker ? taker.id : -1;
    st.restart.spots = kickoffSpots(st, team, st.restart.taker);
  } else {
    placeKickoff(st, team);
    st.ball.restart([0, BALL.radius, 0], { cause: 'engagement' });
  }
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
