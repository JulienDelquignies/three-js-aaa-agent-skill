// skills-sim — LES GESTES TECHNIQUES DU PORTEUR, sortis de rondo-sim (lot 21 : la volumétrie
// du CŒUR — 1 885 lignes — se découpe avec le même soin bit-près que match-sim au lot 16a).
// La FAMILLE est cohésive : les déclencheurs (maybeRateau / feinte / semelle / passement /
// crochet / feinte de frappe), le contact (skillContactNow), l'accompagnement image par image
// (skillFollowStep), l'événement de touche (touchEvent) et l'horloge des clips (MOVE_TIMING —
// lue de l'animation, jamais ré-écrite à la main). AUCUN comportement ne change : la batterie
// (308 clauses, rondo 40/40 au bit près) est LA preuve.
import { BALL } from './ball.js';
import { MOVES } from './animkit.js';
import { situation, footFor } from './technique.js';
import { startGesture, abortGesture } from './gesture.js';
import { byId } from './technique.js';

const d2 = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

export const footPoint = (st, p, cfg) => {
  const fx = Math.cos(p.yaw), fz = Math.sin(p.yaw);
  const lat = p.foot === 'left' ? 1 : -1;
  const m = BALL.radius + 0.02;
  return [Math.max(-st.area[0] / 2 + m, Math.min(st.area[0] / 2 - m, p.p[0] + fx * cfg.controlSettle + fz * lat * cfg.footSide)),
          Math.max(-st.area[1] / 2 + m, Math.min(st.area[1] / 2 - m, p.p[2] + fz * cfg.controlSettle - fx * lat * cfg.footSide))];
};

/** Le POINT DE STANCE : où le geste veut le ballon relativement à CE corps (l'inverse exact
 *  d'anchorFor — ballon = corps + R(yaw + β·côté)·dist, même convention de signe). */
export const stanceBallPoint = (p, stance, foot) => {
  const side = foot === 'left' ? 1 : -1;
  const a = p.yaw + stance.bearing * side * (Math.PI / 180);
  return [p.p[0] + Math.cos(a) * stance.dist, p.p[2] + Math.sin(a) * stance.dist];
};

/** Un refus a une cause nommée (copie locale du registre du loop). */
const deny = (st, cause) => { (st.deny ??= {})[cause] = (st.deny[cause] ?? 0) + 1; return false; };

/**
 * LE PRÉDICAT DU DUEL — qui a le droit de faire courir la minuterie de vol. L'ancien prédicat
 * (« 1,45 m du CORPS pendant tackleTime ») a produit le chiffre fondateur de la sonde duels-tacles :
 * 54 % des pertes étaient un flip d'étiquette, gagnant jusqu'à 2,33 m du ballon, 29 % au-delà du
 * rayon de jeu. Le vrai prédicat est celui de carrier-owns-the-ball, ENFIN consommé côté attaque du
 * ballon : à portée de jeu du BALLON (contestRadius) ET plus près de lui que le porteur de plus que
 * shieldSlack — la protection de balle (le corps entre défenseur et ballon) devient une défense
 * réelle, parce que le prédicat la regarde.
 */
export function pressPredicate(st, c, cfg) {
  const dc = d2(c.p, st.ball.p);
  return st.players.filter((q) => q.team !== c.team && q.down <= 0 && !q.act
    && (q.tackleCd ?? -1) <= st.t
    && d2(q.p, st.ball.p) < cfg.contestRadius
    && d2(q.p, st.ball.p) < dc - cfg.shieldSlack)
    .sort((a, b) => d2(a.p, st.ball.p) - d2(b.p, st.ball.p));
}


// THE TIMING OF EVERY GESTURE, taken from the animation itself. `contact` is the frame at which the
// boot meets the ball, so it IS the anticipation: the swing before the strike. Reading it from the
// clip rather than restating it here is what keeps the simulation and the picture the same event —
// re-authoring these numbers by hand is how a ball starts leaving before the leg moves.
export const MOVE_TIMING = Object.fromEntries(Object.entries(MOVES)
  .filter(([, m]) => m.contact != null)
  .map(([k, m]) => [k, { duration: m.duration, contact: m.contact }]));

export const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/** Le râteau : presseur FRONTAL qui ferme → la semelle tire le ballon en arrière, le corps se
 *  retourne par-dessus (le lacet appartient au geste pendant TOUT l'accompagnement — ownsBody). */
export function maybeRateau(st, c, cfg) {
  const K = cfg.skill; if (!K) return false;
  if (c.keeper) return false;                                      // un gardien distribue, il ne dribble pas (champ absent au rondo — neutre)
  if ((c._skillCd?.rateau ?? -1) > st.t) return false;
  if (d2(c.p, st.ball.p) > 0.55) return false;                    // sur SON ballon, au pied
  let foe = null, fd = Infinity;
  for (const q of st.players) {
    if (q.team === c.team || q.down > 0) continue;
    const d = d2(q.p, c.p); if (d < fd) { fd = d; foe = q; }
  }
  if (!foe || fd > K.rateauFoe) return false;
  const bear = situation(c.p, c.yaw, foe.p, [0, 0], 0.11).bearing;
  if (bear > K.rateauFront) return false;                         // il presse la FACE, pas le dos
  const closing = ((c.p[0] - foe.p[0]) * foe.v[0] + (c.p[2] - foe.p[2]) * foe.v[1]) / Math.max(1e-4, fd);
  if (closing < 1.5) return false;                                // il ARRIVE lancé (une dérive n'est pas une charge)
  // la sortie ARRIÈRE est libre — se retourner dans un second duel n'est pas une sortie
  const exitYaw = c.yaw + Math.PI;
  const ex = c.p[0] + Math.cos(exitYaw) * 1.2, ez = c.p[2] + Math.sin(exitYaw) * 1.2;
  for (const q of st.players) {
    if (q.team === c.team || q.down > 0) continue;
    if (Math.hypot(q.p[0] - ex, q.p[2] - ez) < K.rateauClear) return deny(st, 'rateau-sans-issue');
  }
  if (Math.abs(ex) > st.area[0] / 2 - 0.6 || Math.abs(ez) > st.area[1] / 2 - 0.6) return deny(st, 'rateau-hors-carré');
  // QUI tente : le flair (tirage seedé) — un refus de tempérament re-tire dans 2 s, pas à 60 Hz
  if ((st.rnd ? st.rnd() : 0.5) > 0.12 + 0.3 * (c.persona?.flair ?? 0.5)) {
    (c._skillCd ??= {}).rateau = st.t + 2; return false;
  }
  const sit = situation(c.p, c.yaw, st.ball.p, [0, 0], st.ball.p[1]);
  const foot = footFor(byId.rateau, sit);
  const move = MOVE_TIMING.rateau;
  if (st.ball.owner !== c.id) st.ball.possess(c.id);              // la semelle exige le couple soudé
  startGesture(c, { id: 'rateau', ...move }, {
    payload: { kind: 'skill', skill: 'rateau', pick: { foot }, ownsBody: true, yaw0: c.yaw, exitYaw, ballMax: 0 },
    log: st.gestures,
  });
  (c._skillCd ??= {}).rateau = st.t + K.rateauCd;
  c.intent = null;
  st.events.push({ t: +st.t.toFixed(2), type: 'windup', by: c.id, move: 'rateau', foot, skill: 'rateau', anticipation: move.contact });
  st.events.push({ t: +st.t.toFixed(2), type: 'skill', kind: 'rateau', by: c.id, foe: +fd.toFixed(2), bearing: +bear.toFixed(0) });
  return true;
}

/** La feinte de passe : l'intention EXISTE (une vraie passe est prête), un défenseur est dans le
 *  cône de la fausse direction — tout l'armé se joue, le ballon ne part pas, le mordu s'assoit. */
export function maybeFeinte(st, c, cfg, contested) {
  const K = cfg.skill; if (!K || contested) return false;         // feinter sous conteste = offrir le ballon
  if (c.keeper) return false;
  if ((c._skillCd?.feinte ?? -1) > st.t) return false;
  if (!c.intent || c.intent.feinted) return false;                // UNE feinte par intention
  const rec = st.players[c.intent.choice.to.id]; if (!rec) return false;
  const fakeYaw = Math.atan2(rec.p[2] - c.p[2], rec.p[0] - c.p[0]);
  let mark = null;
  for (const q of st.players) {
    if (q.team === c.team || q.down > 0) continue;
    const d = d2(q.p, c.p);
    if (d < K.feinteFoe[0] || d > K.feinteFoe[1]) continue;
    if (situation(c.p, fakeYaw, q.p, [0, 0], 0.11).bearing <= K.feinteCone) { mark = q; break; }
  }
  if (!mark) return false;                                        // personne à tromper : on joue simple
  // …et PERSONNE en duel vivant sur le ballon : se figer 0,4 s avec un homme à portée de vol,
  // c'est offrir le tacle — la sonde des graines 2/4 a mesuré le temps « collé » gonfler de 10 %
  if (pressPredicate(st, c, cfg).length) return false;
  if ((st.rnd ? st.rnd() : 0.5) > 0.15 + 0.45 * (c.persona?.flair ?? 0.5)) { c.intent.feinted = true; return false; }
  if (st.ball.owner !== c.id) {
    if (d2(c.p, st.ball.p) > cfg.captureRadius) return false;
    st.ball.possess(c.id);
  }
  const sit = situation(c.p, c.yaw, st.ball.p, [0, 0], st.ball.p[1]);
  const foot = footFor(byId['feinte-passe'], sit);
  const move = MOVE_TIMING.feintePasse;
  startGesture(c, { id: 'feintePasse', ...move }, {
    // outYaw : le REGARD vend la feinte (la scène fait regarder la fausse cible pendant l'armé)
    payload: { kind: 'skill', skill: 'feinte', pick: { foot }, fakeYaw, outYaw: fakeYaw },
    log: st.gestures,
  });
  c.intent.feinted = true;                                        // l'intention SURVIT : la vraie passe suit
  (c._skillCd ??= {}).feinte = st.t + K.feinteCd;
  st.events.push({ t: +st.t.toFixed(2), type: 'windup', by: c.id, move: 'feintePasse', foot, skill: 'feinte', anticipation: move.contact });
  return true;
}

/** L'arrêt semelle : porteur au calme, champ libre — le pied se pose SUR le ballon et la tête se
 *  lève. La ponctuation du jeu posé ; persona.calm et flair décident QUI la joue. */
export function maybeSemelle(st, c, cfg, calm, foeBody) {
  const K = cfg.skill; if (!K || !calm) return false;
  if (c.keeper) return false;
  if ((c._skillCd?.semelle ?? -1) > st.t) return false;
  if (foeBody < K.semelleFoe) return false;
  // …dans la tenue délibérée, pas à sa toute fin (première version : fenêtre [0,35 ; calmHold−0,6]
  // → pour une tenue de 1,0 s la fenêtre faisait 5 centièmes — 0 semelle en 6 minutes mesurées ;
  // et le ballon de CONDUITE vit à 0,5-0,9 m entre deux touches — 0,6 m est le rayon du porté)
  if (st.hold < 0.3 || st.hold > Math.max(0.5, (st._calmHold ?? 1) - 0.35)) return false;
  if (d2(c.p, st.ball.p) > 0.6) return false;
  if ((st.rnd ? st.rnd() : 0.5) > 0.2 + 0.5 * Math.max(0, (c.persona?.calm ?? 1) - 0.85) + 0.25 * (c.persona?.flair ?? 0.5)) {
    (c._skillCd ??= {}).semelle = st.t + 1.2; return false;       // pas cette fois — on re-tire plus tard
  }
  const sit = situation(c.p, c.yaw, st.ball.p, [0, 0], st.ball.p[1]);
  const foot = footFor(byId['arret-semelle'], sit);
  const move = MOVE_TIMING.arretSemelle;
  if (st.ball.owner !== c.id) st.ball.possess(c.id);
  startGesture(c, { id: 'arretSemelle', ...move }, {
    payload: { kind: 'skill', skill: 'semelle', pick: { foot }, ownsBody: true, maxV: 0 },
    log: st.gestures,
  });
  (c._skillCd ??= {}).semelle = st.t + K.semelleCd;
  st.events.push({ t: +st.t.toFixed(2), type: 'windup', by: c.id, move: 'arretSemelle', foot, skill: 'semelle', anticipation: move.contact });
  st.events.push({ t: +st.t.toFixed(2), type: 'skill', kind: 'semelle', by: c.id, foe: +foeBody.toFixed(2) });
  return true;
}

/** Le passement de jambes : un jockey POSTÉ en face (pas une charge — le râteau possède la
 *  charge), du champ d'un côté au moins — la jambe cercle par-dessus un ballon immobile, le
 *  buste vend le mensonge, le jockey mord. Les clés K.passement* n'existent qu'au MATCH : sans
 *  elles, refus immédiat AVANT tout tirage — le rondo est inchangé au bit près. */
export function maybePassement(st, c, cfg) {
  const K = cfg.skill; if (!K || !K.passementFoe) return false;
  if (c.keeper) return false;
  if ((c._skillCd?.passement ?? -1) > st.t) return false;
  // LE PASSEMENT LANCÉ (l'espèce qui manquait à l'œil — « je n'ai toujours pas vu de passement ») :
  // en course sur un jockey qui RECULE devant, le cercle se joue PAR-DESSUS le ballon qui roule
  // (pas de pin) ; à l'arrêt, le cercle classique sur ballon calé. Au-delà de 6 m/s : sprint, non.
  const enCourse = c.speed > 2.5;
  if (c.speed > 6.0) return false;
  if (d2(c.p, st.ball.p) > 0.6) return false;
  let foe = null, fd = Infinity;
  for (const q of st.players) {
    if (q.team === c.team || q.down > 0) continue;
    const d = d2(q.p, c.p); if (d < fd) { fd = d; foe = q; }
  }
  if (!foe || fd < K.passementFoe[0] || fd > K.passementFoe[1]) return false;
  const bear = situation(c.p, c.yaw, foe.p, [0, 0], 0.11).bearing;
  if (bear > 70) return false;                                    // il jockeye le DEMI-FRONT (l'évasion fait
  //                                                                 regarder un peu ailleurs — 55° ne laissait
  //                                                                 que 6 images alignées en 120 s, mesuré)
  const closing = ((c.p[0] - foe.p[0]) * foe.v[0] + (c.p[2] - foe.p[2]) * foe.v[1]) / Math.max(1e-4, fd);
  if (closing > 1.5) return false;                                // il charge : c'est l'affaire du râteau
  // une sortie latérale au moins est libre (le passement PRÉPARE un départ de côté)
  const sides = [c.yaw + 0.9, c.yaw - 0.9].filter((a) => {
    const ex = c.p[0] + Math.cos(a) * 1.5, ez = c.p[2] + Math.sin(a) * 1.5;
    if (Math.abs(ex) > st.area[0] / 2 - 0.6 || Math.abs(ez) > st.area[1] / 2 - 0.6) return false;
    return !st.players.some((q) => q.team !== c.team && q.down <= 0 && Math.hypot(q.p[0] - ex, q.p[2] - ez) < 1.2);
  });
  if (!sides.length) return deny(st, 'passement-sans-issue');
  if (enCourse && closing > 0.6) return false;                    // lancé : le jockey RECULE devant, il ne charge pas
  if ((st.rnd ? st.rnd() : 0.5) > (0.32 + 0.42 * (c.persona?.flair ?? 0.5)) * (c.skill?.gesteF ?? 1)) {
    (c._skillCd ??= {}).passement = st.t + 0.8; return false;     // la fenêtre est fugace : on re-tire vite
  }
  // LES TOURS ET LA SORTIE (la variété demandée : « Mancini, Reveillère… un nombre de tours
  // variable, une sortie tout droit pour fixer, en diagonale pour le contre-pied, ou derrière
  // pour temporiser ») : DEUX tours quand le jockey est posté loin (le temps du second
  // mensonge) ; la sortie lit la situation — il AVANCE → contre-pied (diagonale libre) ; il
  // COLLE → temporiser (retour, protéger) ; il est POSTÉ loin → le fixer (tout droit) ou le
  // contre-pied, au tirage.
  const uT = st.rnd ? st.rnd() : 0.5;
  const tours = fd >= 1.55 && uT < 0.3 + 0.35 * (c.persona?.flair ?? 0.5) ? 2 : 1;
  const cross = Math.sin(Math.atan2(foe.p[2] - c.p[2], foe.p[0] - c.p[0]) - c.yaw);
  const awaySide = c.yaw + (cross > 0 ? -0.9 : 0.9);              // la diagonale OPPOSÉE au foe
  const diag = sides.reduce((b, a) => Math.abs(wrapA(a - awaySide)) < Math.abs(wrapA(b - awaySide)) ? a : b, sides[0]);
  let sortie, exitYaw;
  if (closing > 0.35) { sortie = 'contre-pied'; exitYaw = diag; }
  else if (fd < 1.25) { sortie = 'temporise'; exitYaw = c.yaw + (diag > c.yaw ? 2.4 : -2.4); }
  else if (fd >= 1.5 && uT > 0.62) { sortie = 'fixe'; exitYaw = c.yaw; }
  else { sortie = 'contre-pied'; exitYaw = diag; }
  const clip = tours === 2 && !enCourse ? 'passementJambes2' : 'passementJambes';   // le double exige le ballon calé
  const sit = situation(c.p, c.yaw, st.ball.p, [0, 0], st.ball.p[1]);
  const foot = footFor(byId['passement-jambes'], sit);
  const move = MOVE_TIMING[clip];
  if (st.ball.owner !== c.id) st.ball.possess(c.id);
  startGesture(c, { id: clip, ...move }, {
    payload: { kind: 'skill', skill: 'passement', pick: { foot }, ownsBody: true, exitYaw, sortie, tours: enCourse ? 1 : tours, enCourse, v0: c.speed, foeId: foe.id, ballMax: 0 },
    log: st.gestures,
  });
  (c._skillCd ??= {}).passement = st.t + K.passementCd;
  st.events.push({ t: +st.t.toFixed(2), type: 'windup', by: c.id, move: clip, foot, skill: 'passement', anticipation: move.contact });
  st.events.push({ t: +st.t.toFixed(2), type: 'skill', kind: 'passement', by: c.id, tours: enCourse ? 1 : tours, sortie, enCourse, foe: +fd.toFixed(2), bearing: +bear.toFixed(0) });
  return true;
}

/** Le crochet : porteur LANCÉ, un défenseur qui ferme la course en avant-latéral — l'intérieur
 *  du pied coupe le ballon à travers la course (70-95°), le lancé continue tout droit. Même
 *  régime que le râteau (ownsBody, le lacet appartient au geste) mais LATÉRAL, en mouvement. */
export function maybeCrochet(st, c, cfg) {
  const K = cfg.skill; if (!K || !K.crochetFoe) return false;
  if (c.keeper) return false;
  if ((c._skillCd?.crochet ?? -1) > st.t) return false;
  if (c.speed < 1.2) return false;                                // un crochet REDIRIGE une course
  if (d2(c.p, st.ball.p) > 0.65) return false;
  let foe = null, fd = Infinity;
  for (const q of st.players) {
    if (q.team === c.team || q.down > 0) continue;
    const d = d2(q.p, c.p); if (d < fd) { fd = d; foe = q; }
  }
  if (!foe || fd < K.crochetFoe[0] || fd > K.crochetFoe[1]) return false;
  // L'AILE SERT D'ABORD (même doctrine que le repique : LA BOÎTE COMMANDE L'AILE) : des coureurs
  // dans la surface → le couloir appartient au CENTRE — le crochet vit dans l'axe et sur l'aile
  // vide (mesuré : 23-27 crochets par lot mangeaient tous les duels d'aile, centres 6 → 1)
  if (st.pitch?.attackGoal) {
    const goalC = st.pitch.attackGoal(c.team); const sgnC = Math.sign(goalC.x || 1);
    const wideDeepC = Math.abs(c.p[2]) > st.pitch.hz * 0.38 && c.p[0] * sgnC > st.pitch.hx - st.pitch.dims.box.depth - 9;
    if (wideDeepC && st.players.some((q) => q.team === c.team && !q.keeper && q.id !== c.id && q.down <= 0
      && q.p[0] * sgnC > st.pitch.hx - st.pitch.dims.box.depth - 1.5 && Math.abs(q.p[2]) < st.pitch.dims.box.width / 2 + 1.5)) return false;
  }
  const sitFoe = situation(c.p, c.yaw, foe.p, [0, 0], 0.11);
  if (sitFoe.bearing > 75) return false;                          // il ferme DEVANT, pas dans le dos
  // …et il FERME vraiment (vitesse de rapprochement) : le jockey posté appartient au passement
  const closingC = ((c.p[0] - foe.p[0]) * foe.v[0] + (c.p[2] - foe.p[2]) * foe.v[1]) / Math.max(1e-4, fd);
  if (closingC < 0.8) return false;
  // on coupe DU CÔTÉ OPPOSÉ au défenseur ; la sortie doit être libre
  const away = sitFoe.side === 'left' ? -1 : 1;                   // side = côté du foe → on part à l'opposé
  const exitYaw = c.yaw + away * (K.crochetTurn ?? 1.4);
  const ex = c.p[0] + Math.cos(exitYaw) * 1.5, ez = c.p[2] + Math.sin(exitYaw) * 1.5;
  if (Math.abs(ex) > st.area[0] / 2 - 0.6 || Math.abs(ez) > st.area[1] / 2 - 0.6) return deny(st, 'crochet-hors-carré');
  for (const q of st.players) {
    if (q.team === c.team || q.down > 0) continue;
    if (Math.hypot(q.p[0] - ex, q.p[2] - ez) < (K.crochetClear ?? 1.2)) return deny(st, 'crochet-sans-issue');
  }
  if ((st.rnd ? st.rnd() : 0.5) > (0.15 + 0.4 * (c.persona?.flair ?? 0.5)) * (c.skill?.gesteF ?? 1)) {
    (c._skillCd ??= {}).crochet = st.t + 2; return false;
  }
  // L'ESPÈCE (la variété demandée : « du Dembélé, du Yamal ») : le CHALOUPÉ veut du TEMPS — le
  // buste ment 0,42 s avant la coupe, il faut un défenseur à ≥ 1,45 m et de l'allure ; le COURT
  // (chop sec, 0,14 s) vit près du contact ; le standard entre les deux. Un tirage seedé + le
  // flair départagent quand la situation autorise plusieurs espèces.
  const uE = st.rnd ? st.rnd() : 0.5;
  const espece = fd >= 1.45 && c.speed >= 2.0 && uE < 0.4 + 0.35 * (c.persona?.flair ?? 0.5) ? 'crochetChaloupe'
    : fd < 1.45 || uE > 0.75 ? 'crochetCourt' : 'crochet';
  const turn = espece === 'crochetChaloupe' ? 1.7 : espece === 'crochetCourt' ? 0.9 : (K.crochetTurn ?? 1.4);
  const exitYawE = c.yaw + away * turn;
  const sit = situation(c.p, c.yaw, st.ball.p, [0, 0], st.ball.p[1]);
  const foot = footFor(byId.crochet, sit);
  const move = MOVE_TIMING[espece];
  if (st.ball.owner !== c.id) st.ball.possess(c.id);
  startGesture(c, { id: espece, ...move }, {
    payload: { kind: 'skill', skill: 'crochet', espece, pick: { foot }, ownsBody: true, yaw0: c.yaw, exitYaw: exitYawE, foeId: foe.id, ballMax: 0 },
    log: st.gestures,
  });
  (c._skillCd ??= {}).crochet = st.t + K.crochetCd;
  c.intent = null;
  st.events.push({ t: +st.t.toFixed(2), type: 'windup', by: c.id, move: espece, foot, skill: 'crochet', anticipation: move.contact });
  st.events.push({ t: +st.t.toFixed(2), type: 'skill', kind: 'crochet', espece, by: c.id, foe: +fd.toFixed(2), dYaw: +((exitYawE - c.yaw) * 180 / Math.PI).toFixed(0) });
  return true;
}

/** LE DOUBLE CONTACT — la croqueta (lot 114, retour utilisateur). Sa niche, disjointe des
 *  frères : le défenseur SE JETTE (closing ≥ doubleClosing — plus franc que la charge du
 *  râteau, 1,5, et que la fermeture du crochet, 0,8), de FACE (≤ doubleCone), dans la fenêtre
 *  courte — et le porteur GARDE SON CAP : le ballon TRANSFÈRE d'un pied à l'autre sous le
 *  corps (le jeté traverse là où il était), la sortie est à peine diagonale (doubleTurn
 *  ~26°, pas la coupe à 80° du crochet). Mesuré avant : 27,2 fenêtres du jeté par match,
 *  94 % sans AUCUNE réponse du répertoire. Iniesta la sortait à l'arrêt comme lancé :
 *  aucune exigence de vitesse. Clés au match seulement (doubleFoe absent : le rondo d'hier). */
export function maybeDoubleContact(st, c, cfg) {
  const K = cfg.skill; if (!K || !K.doubleFoe) return false;
  if (c.keeper) return false;
  if ((c._skillCd?.double ?? -1) > st.t) return false;
  if (d2(c.p, st.ball.p) > 0.6) return false;                     // sur SON ballon
  let foe = null, fd = Infinity;
  for (const q of st.players) {
    if (q.team === c.team || q.down > 0) continue;
    const d = d2(q.p, c.p); if (d < fd) { fd = d; foe = q; }
  }
  if (!foe || fd < K.doubleFoe[0] || fd > K.doubleFoe[1]) return false;
  const closing = ((c.p[0] - foe.p[0]) * foe.v[0] + (c.p[2] - foe.p[2]) * foe.v[1]) / Math.max(1e-4, fd);
  if (closing < (K.doubleClosing ?? 2.2)) return false;           // il SE JETTE — pas une dérive, pas un jockey
  const sitFoe = situation(c.p, c.yaw, foe.p, [0, 0], 0.11);
  if (sitFoe.bearing > (K.doubleCone ?? 55)) return false;        // de FACE (le dos appartient à la tenure)
  // la sortie garde le cap, à peine décalée du CÔTÉ OPPOSÉ au foe — et elle doit être libre
  const away = sitFoe.side === 'left' ? -1 : 1;
  const exitYaw = c.yaw + away * (K.doubleTurn ?? 0.45);
  const ex = c.p[0] + Math.cos(exitYaw) * 1.6, ez = c.p[2] + Math.sin(exitYaw) * 1.6;
  if (Math.abs(ex) > st.area[0] / 2 - 0.6 || Math.abs(ez) > st.area[1] / 2 - 0.6) return deny(st, 'double-hors-carré');
  for (const q of st.players) {
    if (q.team === c.team || q.down > 0 || q === foe) continue;   // le jeté lui-même sera mordu, pas un mur
    if (Math.hypot(q.p[0] - ex, q.p[2] - ez) < (K.doubleClear ?? 1.1)) return deny(st, 'double-sans-issue');
  }
  // QUI le tente : flair × la note de dribble AU CARRÉ — un geste de RISQUE (le 50/50 du
  // duel nivelle les notes : mesuré, les faibles tentaient autant que l'élite car les
  // fenêtres leur arrivent plus souvent, et la part de tirs élite tombait de 49 à 33 % sur
  // un jeu de graines ; le joueur limité ne tente pas la croqueta, il dégage)
  if ((st.rnd ? st.rnd() : 0.5) > (0.2 + 0.4 * (c.persona?.flair ?? 0.5)) * ((c.skill?.gesteF ?? 1) ** 2)) {
    (c._skillCd ??= {}).double = st.t + 2; return false;
  }
  const sit = situation(c.p, c.yaw, st.ball.p, [0, 0], st.ball.p[1]);
  const foot = footFor(byId.crochet, sit);                        // le même choix de patte que la coupe
  const move = MOVE_TIMING.doubleContact;
  if (st.ball.owner !== c.id) st.ball.possess(c.id);
  startGesture(c, { id: 'doubleContact', ...move }, {
    payload: { kind: 'skill', skill: 'doubleContact', pick: { foot }, ownsBody: true, yaw0: c.yaw, exitYaw, away, v0: c.speed, foeId: foe.id, ballMax: 0 },
    log: st.gestures,
  });
  (c._skillCd ??= {}).double = st.t + (K.doubleCd ?? 8);
  c.intent = null;
  st.events.push({ t: +st.t.toFixed(2), type: 'windup', by: c.id, move: 'doubleContact', foot, skill: 'doubleContact', anticipation: move.contact });
  st.events.push({ t: +st.t.toFixed(2), type: 'skill', kind: 'doubleContact', by: c.id, foe: +fd.toFixed(2), closing: +closing.toFixed(1) });
  return true;
}

/** LE PETIT PONT (lot 115, suite foot validée). Le SEUL geste qui joue À TRAVERS le
 *  défenseur — tous les autres l'évitent. Sa niche : le GLISSEUR — le jockey en pas chassés
 *  (vitesse PERPENDICULAIRE à l'axe du duel ≥ pontLatV : les appuis sont ouverts par
 *  biomécanique), de face, avec l'espace DERRIÈRE lui libre. Mesuré avant : 18,5 fenêtres
 *  du glisseur par match, 89 % sans réponse. Le ballon est POUSSÉ entre les jambes (strike
 *  doux — le vol est physique, interceptable), le porteur CONTOURNE côté CONTRE l'élan du
 *  glisseur (il ne peut pas se retourner contre son pas chassé) et rechasse ; le RISQUE est
 *  réel : la réussite se tire AU CONTACT — gesteF du ponteur CONTRE reactions du fermeur
 *  (l'attribut des deux côtés, jamais une branche) ; raté, le ballon TAPE LA JAMBE et
 *  revient en 50/50. Clés au match seulement (pontFoe absent : le rondo d'hier). */
export function maybePetitPont(st, c, cfg) {
  const K = cfg.skill; if (!K || !K.pontFoe) return false;
  if (c.keeper) return false;
  if ((c._skillCd?.pont ?? -1) > st.t) return false;
  if (d2(c.p, st.ball.p) > 0.6) return false;
  let foe = null, fd = Infinity, ux = 0, uz = 0, latS = 0;
  for (const q of st.players) {
    if (q.team === c.team || q.down > 0) continue;
    const d = d2(q.p, c.p);
    if (d < K.pontFoe[0] || d > K.pontFoe[1] || d >= fd) continue;
    const vx = (q.p[0] - c.p[0]) / d, vz = (q.p[2] - c.p[2]) / d;
    const lat = -vz * q.v[0] + vx * q.v[1];                       // sa vitesse PERPENDICULAIRE, signée
    if (Math.abs(lat) < (K.pontLatV ?? 1.2)) continue;            // il glisse — les appuis ouverts
    const bear = situation(c.p, c.yaw, q.p, [0, 0], 0.11).bearing;
    if (bear > (K.pontCone ?? 40)) continue;
    foe = q; fd = d; ux = vx; uz = vz; latS = Math.sign(lat);
  }
  if (!foe) return false;
  // l'espace DERRIÈRE le glisseur (le ballon doit avoir où aller — pas un 2e rideau)
  const bx = foe.p[0] + ux * (K.pontDepth ?? 2.5), bz = foe.p[2] + uz * (K.pontDepth ?? 2.5);
  if (Math.abs(bx) > st.area[0] / 2 - 0.8 || Math.abs(bz) > st.area[1] / 2 - 0.8) return deny(st, 'pont-hors-carré');
  for (const q of st.players) {
    if (q.team === c.team || q.down > 0 || q === foe) continue;
    if (Math.hypot(q.p[0] - bx, q.p[2] - bz) < (K.pontClear ?? 1.5)) return deny(st, 'pont-second-rideau');
  }
  // QUI le tente : flair × la note AU CARRÉ — le pont est le PARI le plus cher du
  // répertoire (47 % de réussite) : la note filtre fort (le même contrat de risque que la
  // croqueta — les gestes de contrôle restent en gesteF simple)
  if ((st.rnd ? st.rnd() : 0.5) > (0.15 + 0.35 * (c.persona?.flair ?? 0.5)) * ((c.skill?.gesteF ?? 1) ** 2)) {
    (c._skillCd ??= {}).pont = st.t + 2.5; return false;
  }
  const sit = situation(c.p, c.yaw, st.ball.p, [0, 0], st.ball.p[1]);
  const foot = footFor(byId.crochet, sit);
  const move = MOVE_TIMING.petitPont;
  if (st.ball.owner !== c.id) st.ball.possess(c.id);
  // le contournement va CONTRE l'élan du glisseur (latS > 0 = son élan vers la GAUCHE du
  // porteur, convention (fz,−fx) — le porteur passe à droite : exitYaw NÉGATIF… le signe
  // suit la même algèbre que la croqueta : yaw + d tourne vers −(fz,−fx))
  const exitYaw = c.yaw + latS * (K.pontTurn ?? 0.85);
  startGesture(c, { id: 'petitPont', ...move }, {
    payload: { kind: 'skill', skill: 'petitPont', pick: { foot }, ownsBody: true, yaw0: c.yaw, exitYaw, foeId: foe.id, through: [bx, bz], v0: c.speed, ballMax: 0 },
    log: st.gestures,
  });
  (c._skillCd ??= {}).pont = st.t + (K.pontCd ?? 10);
  c.intent = null;
  st.events.push({ t: +st.t.toFixed(2), type: 'windup', by: c.id, move: 'petitPont', foot, skill: 'petitPont', anticipation: move.contact });
  return true;
}

/** LA ROULETTE (lot 117, liste utilisateur) — le 360 qui PROTÈGE. Sa niche, disjointe des
 *  frères : le POURSUIVANT en diagonale-dos (bearing 55-140° — le frontal appartient au
 *  râteau/à la croqueta, le plein dos à la tenure) qui ferme sur un porteur LANCÉ. Le corps
 *  ENROULE : le ballon sous la semelle, 360° autour, le corps s'interpose TOUT le tour — le
 *  poursuivant prend l'épaule, pas le ballon. Mesuré avant : 52,3 fenêtres/match (le monde
 *  le plus fréquent des cinq niches), 95 % sans geste. La roulette réelle est RARE : le
 *  tirage est le plus sobre du répertoire, et l'AGILITÉ filtre (× (2 − getupF) : le souple
 *  roule, le raide s'abstient — l'attribut est un facteur, jamais une branche). Clés au
 *  match seulement (rouletteFoe absent : le rondo d'hier). */
export function maybeRoulette(st, c, cfg) {
  const K = cfg.skill; if (!K || !K.rouletteFoe) return false;
  if (c.keeper) return false;
  if ((c._skillCd?.roulette ?? -1) > st.t) return false;
  if (c.speed < (K.rouletteV ?? 1.5)) return false;               // un 360 s'enroule sur un élan
  if (d2(c.p, st.ball.p) > 0.6) return false;
  let foe = null, fd = Infinity, side = 1;
  for (const q of st.players) {
    if (q.team === c.team || q.down > 0) continue;
    const d = d2(q.p, c.p);
    if (d < K.rouletteFoe[0] || d > K.rouletteFoe[1] || d >= fd) continue;
    const closing = ((c.p[0] - q.p[0]) * q.v[0] + (c.p[2] - q.p[2]) * q.v[1]) / Math.max(1e-4, d);
    if (closing < (K.rouletteClosing ?? 0.8)) continue;
    const sit = situation(c.p, c.yaw, q.p, [0, 0], 0.11);
    if (sit.bearing < (K.rouletteBear?.[0] ?? 55) || sit.bearing > (K.rouletteBear?.[1] ?? 140)) continue;
    foe = q; fd = d; side = sit.side === 'left' ? 1 : -1;         // on tourne du côté OPPOSÉ au poursuivant
  }
  if (!foe) return false;
  // …tirage re-calibré au lot 121 (0,05 → 0,032) : la Zidane TRAVERSE désormais (rouletteRoule
  // 0,5, sortie 0,75 — retour utilisateur « ça manque d'envergure ») et l'A/B à tirage constant
  // crevait la bande (34 buts > 33) — l'envergure se paie en RARETÉ, pas en toupie : la
  // roulette réelle est un éclair (~1-2/match), et chacune qui part GAGNE ses mètres.
  if ((st.rnd ? st.rnd() : 0.5) > (0.032 + 0.1 * (c.persona?.flair ?? 0.5)) * (c.skill?.gesteF ?? 1) * (2 - (c.skill?.getupF ?? 1))) {
    (c._skillCd ??= {}).roulette = st.t + 3; return false;
  }
  const sit2 = situation(c.p, c.yaw, st.ball.p, [0, 0], st.ball.p[1]);
  const foot = footFor(byId.rateau, sit2);                        // la semelle — la patte du râteau
  const move = MOVE_TIMING.roulette;
  if (st.ball.owner !== c.id) st.ball.possess(c.id);
  startGesture(c, { id: 'roulette', ...move }, {
    payload: { kind: 'skill', skill: 'roulette', pick: { foot }, ownsBody: true, yaw0: c.yaw, exitYaw: c.yaw, spin: side, v0: c.speed, foeId: foe.id, ballMax: 0 },
    log: st.gestures,
  });
  (c._skillCd ??= {}).roulette = st.t + (K.rouletteCd ?? 12);
  c.intent = null;
  st.events.push({ t: +st.t.toFixed(2), type: 'windup', by: c.id, move: 'roulette', foot, skill: 'roulette', anticipation: move.contact });
  st.events.push({ t: +st.t.toFixed(2), type: 'skill', kind: 'roulette', by: c.id, foe: +fd.toFixed(2) });
  return true;
}

/** La feinte de frappe : à portée de tir, un CONTREUR dans le cône du but — tout l'armé d'une
 *  frappe, la retenue au contact, le contreur s'assoit LONGTEMPS (on ne se jette pas devant une
 *  demi-frappe) — et la demi-seconde payée est l'angle qui manquait au tir. Match seulement
 *  (st.pitch.attackGoal) ; le refus de situation ne consomme aucun tirage. */
export function maybeFeinteFrappe(st, c, cfg, contested) {
  const K = cfg.skill; if (!K || !K.frappeFeinteCd || contested) return false;
  if (!st.pitch?.attackGoal || c.keeper) return false;
  if ((c._skillCd?.frappeFeinte ?? -1) > st.t) return false;
  if (st.hold < 0.3 || d2(c.p, st.ball.p) > 0.65) return false;
  const goal = st.pitch.attackGoal(c.team);
  const dGoal = Math.hypot(goal.x - c.p[0], 0 - c.p[2]);
  if (dGoal > (cfg.shotRange ?? 15) + 1) return false;            // hors zone : feinter quoi ?
  const gYaw = Math.atan2(0 - c.p[2], goal.x - c.p[0]);
  let blocker = null;
  for (const q of st.players) {
    if (q.team === c.team || q.keeper || q.down > 0) continue;
    const d = d2(q.p, c.p);
    if (d < K.frappeFeinteFoe[0] || d > K.frappeFeinteFoe[1]) continue;
    if (situation(c.p, gYaw, q.p, [0, 0], 0.11).bearing <= K.frappeFeinteCone) { blocker = q; break; }
  }
  if (!blocker) return false;                                     // pas de contreur : on tire, on ne mime pas
  if (pressPredicate(st, c, cfg).length) return false;            // en duel vivant, pas de pantomime
  if ((st.rnd ? st.rnd() : 0.5) > 0.18 + 0.4 * (c.persona?.flair ?? 0.5)) {
    (c._skillCd ??= {}).frappeFeinte = st.t + 2.5; return false;
  }
  if (st.ball.owner !== c.id) st.ball.possess(c.id);
  const sit = situation(c.p, c.yaw, st.ball.p, [0, 0], st.ball.p[1]);
  const foot = footFor(byId['feinte-frappe'], sit);
  const move = MOVE_TIMING.feinteFrappe;
  startGesture(c, { id: 'feinteFrappe', ...move }, {
    // outYaw : le REGARD vise le but — c'est lui qui vend la frappe
    payload: { kind: 'skill', skill: 'frappeFeinte', pick: { foot }, fakeYaw: gYaw, outYaw: gYaw },
    log: st.gestures,
  });
  (c._skillCd ??= {}).frappeFeinte = st.t + K.frappeFeinteCd;
  st.events.push({ t: +st.t.toFixed(2), type: 'windup', by: c.id, move: 'feinteFrappe', foot, skill: 'frappeFeinte', anticipation: move.contact });
  return true;
}

/** LE CONTACT D'UN GESTE TECHNIQUE — rien ne part : la semelle AGRIPPE (le point de départ du
 *  raclage se fige ici), la feinte SE VEND (les défenseurs lancés dans le cône mordent — leur
 *  ralenti est la loi de movePlayers), la plante SE POSE (le point de parking se fige). */
export function skillContactNow(st, p, cfg) {
  const A = p.act.payload;
  if (A.skill === 'feinte') {
    const K = cfg.skill;
    const bitten = [];
    for (const q of st.players) {
      if (q.team === p.team || q.down > 0) continue;
      const d = d2(q.p, p.p);
      if (d < K.feinteFoe[0] - 0.2 || d > K.feinteFoe[1] + 0.6) continue;
      if (situation(p.p, A.fakeYaw, q.p, [0, 0], 0.11).bearing > K.feinteCone) continue;
      q._bite = st.t + K.feinteBite;
      bitten.push(q.id);
    }
    st.events.push({ t: +st.t.toFixed(2), type: 'skill', kind: 'feinte', by: p.id, bitten, foot: A.pick.foot });
  } else if (A.skill === 'rateau') {
    A.from = [st.ball.p[0], st.ball.p[2]];
  } else if (A.skill === 'semelle') {
    A.pin = [st.ball.p[0], st.ball.p[2]];
  } else if (A.skill === 'passement') {
    // la jambe passe PAR-DESSUS : le ballon se fige (calé) ou ROULE (lancé — on n'épingle pas un
    // ballon en course), le jockey d'en face mord (le buste a vendu)
    if (!A.enCourse) A.pin = [st.ball.p[0], st.ball.p[2]];
    const K = cfg.skill;
    const foe = st.players[A.foeId ?? -1];
    const bitten = [];
    if (foe && foe.down <= 0) { foe._bite = st.t + (K.passementBite ?? 0.4) * (p.skill?.gesteF ?? 1); bitten.push(foe.id); }
    st.events.push({ t: +st.t.toFixed(2), type: 'skill', kind: 'passement-vendu', by: p.id, bitten, foot: A.pick.foot });
    // la sortie est un DÉPART… selon son MODE : le contre-pied et le fixer partent en burst
    // nommé (le fixer PLUS fort — on fige puis on perce tout droit) ; TEMPORISER protège — pas
    // de burst, on ressort en marchant, ballon sous la semelle
    if (A.sortie !== 'temporise') p._pace = { ...(p._pace ?? { next: 3 }), until: st.t + (A.sortie === 'fixe' ? 0.65 : 0.5) };
  } else if (A.skill === 'crochet') {
    A.from = [st.ball.p[0], st.ball.p[2]];
    // le CHALOUPÉ a menti pendant 0,42 s : le défenseur qui fermait s'assoit sur la feinte de
    // buste (même loi que le passement — sans coût pour lui, la chaloupe serait une pantomime)
    if (A.espece === 'crochetChaloupe') {
      const K = cfg.skill;
      const foe = st.players[A.foeId ?? -1];
      const bitten = [];
      if (foe && foe.down <= 0) { foe._bite = st.t + 0.35 * (p.skill?.gesteF ?? 1); bitten.push(foe.id); }
      st.events.push({ t: +st.t.toFixed(2), type: 'skill', kind: 'crochet-vendu', by: p.id, bitten, foot: A.pick.foot });
    }
  } else if (A.skill === 'petitPont') {
    // LA RÉUSSITE SE TIRE AU CONTACT (le windup a laissé au fermeur sa chance) : la note du
    // ponteur CONTRE les réflexes du fermeur — le lent se fait ponter, le vif ferme
    const K = cfg.skill;
    const foe = st.players[A.foeId ?? -1];
    const pOk = Math.max(0.25, Math.min(0.85,
      (K.pontP ?? 0.55) * (p.skill?.gesteF ?? 1) + (((foe?.skill?.reaction ?? 0.22) - 0.22) * 1.2)));
    const reussi = (st.rnd ? st.rnd() : 0.5) < pOk;
    if (reussi && foe && foe.down <= 0) {
      // le ballon TRAVERSE (strike doux — release intégré, le vol est physique) ; le fermeur
      // MORD (se retourner contre son pas chassé coûte) ; le contournement est LANCÉ
      st.ball.strike({ speed: K.pontV ?? 6.5, dirYaw: Math.atan2(A.through[1] - st.ball.p[2], A.through[0] - st.ball.p[0]), elevation: 0.01, spinAxis: [0, 1, 0], spinRev: 0 });
      st.pass = null;
      foe._bite = st.t + (K.pontBite ?? 0.7) * (p.skill?.gesteF ?? 1);
      p._pace = { ...(p._pace ?? { next: 3 }), until: st.t + 0.9, kind: 'sortie' };
      A.reussi = true;
      st.events.push({ t: +st.t.toFixed(2), type: 'skill', kind: 'petitPont', by: p.id, reussi: true, bitten: [foe.id], foot: A.pick.foot });
    } else {
      // FERMÉ : le ballon tape la jambe et revient court, à hauteur du duel — le 50/50 du pari
      const back = Math.atan2(p.p[2] - (foe?.p[2] ?? p.p[2]), p.p[0] - (foe?.p[0] ?? p.p[0]));
      st.ball.strike({ speed: 3.5, dirYaw: back + ((st.rnd ? st.rnd() : 0.5) - 0.5) * 1.4, elevation: 0.05, spinAxis: [0, 1, 0], spinRev: 0 });
      st.pass = null;
      A.reussi = false;
      st.events.push({ t: +st.t.toFixed(2), type: 'skill', kind: 'petitPont', by: p.id, reussi: false, foot: A.pick.foot });
    }
  } else if (A.skill === 'roulette') {
    // le poursuivant PREND L'ÉPAULE : le corps s'interpose tout le tour — sa course se casse
    const K = cfg.skill;
    const foe = st.players[A.foeId ?? -1];
    const bitten = [];
    if (foe && foe.down <= 0) { foe._bite = st.t + (K.rouletteBite ?? 0.3) * (p.skill?.gesteF ?? 1); bitten.push(foe.id); }
    st.events.push({ t: +st.t.toFixed(2), type: 'skill', kind: 'roulette-vendu', by: p.id, bitten, foot: A.pick.foot });
  } else if (A.skill === 'doubleContact') {
    // le TRANSFERT échappe au tacle : le jeté traverse l'endroit où le ballon N'EST PLUS —
    // il paie sa morsure (même loi que le mordu de feinte), × la note du dribbleur
    const K = cfg.skill;
    const foe = st.players[A.foeId ?? -1];
    const bitten = [];
    if (foe && foe.down <= 0) { foe._bite = st.t + (K.doubleBite ?? 0.55) * (p.skill?.gesteF ?? 1); bitten.push(foe.id); }
    // …et LA SORTIE EST LANCÉE (le même burst que le passement) : l'élimination réelle est
    // l'accélération — sans elle, le porteur freiné restait dans la zone du duel et le
    // ballon jaillissait en 50/50 (mesuré : 32/45 ballons libres à +1,5 s)
    p._pace = { ...(p._pace ?? { next: 3 }), until: st.t + 0.55, kind: 'sortie' };
    st.events.push({ t: +st.t.toFixed(2), type: 'skill', kind: 'doubleContact-vendu', by: p.id, bitten, foot: A.pick.foot });
  } else if (A.skill === 'frappeFeinte') {
    const K = cfg.skill;
    const bitten = [];
    for (const q of st.players) {
      if (q.team === p.team || q.down > 0 || q.keeper) continue;
      const d = d2(q.p, p.p);
      if (d < K.frappeFeinteFoe[0] - 0.2 || d > K.frappeFeinteFoe[1] + 0.6) continue;
      if (situation(p.p, A.fakeYaw, q.p, [0, 0], 0.11).bearing > K.frappeFeinteCone) continue;
      q._bite = st.t + K.frappeFeinteBite;                        // on ne se jette pas devant une demi-frappe
      bitten.push(q.id);
    }
    st.events.push({ t: +st.t.toFixed(2), type: 'skill', kind: 'frappeFeinte', by: p.id, bitten, foot: A.pick.foot });
    p._pace = { ...(p._pace ?? { next: 3 }), until: st.t + 0.45 };  // le pas de côté qui ouvre l'angle
  }
}

/** La touche de conduite S'INSCRIT (type 'touche') : le rendu dessine le pied qui joue, les
 *  sondes comptent les vraies touches — un contact que personne ne voit était lu « il ne touche
 *  jamais le ballon » (retour utilisateur, captures). Une par foulée : dribbleStep cadence. */
export function touchEvent(st, c, ev = null) {
  // …la touche PORTE SA GÉOMÉTRIE (lot 55) : dev = cassure entrant→sortant en degrés, spd = la
  // vitesse du kick — la scène en fait un geste (crochet court au demi-tour), un projet aval
  // n'a rien à recalculer. Champs additifs : les mondes d'hier lisent les mêmes types, au bit près.
  st.events.push({ t: +st.t.toFixed(2), type: 'touche', by: c.id,
    ...(ev ? { dev: +ev.dev.toFixed(0), spd: +ev.spd.toFixed(1) } : {}) });
}

/** L'ACCOMPAGNEMENT POSSÉDÉ (ownsBody) — la seule écriture du corps pendant qu'il dure.
 *  Râteau : le lacet balaie vers exitYaw (ease), le ballon RACLE tout droit en arrière le long de
 *  l'ancien regard — 0,32 m devant → 0,45 m derrière, qui est 0,45 m DEVANT le nouveau regard.
 *  Semelle : corps immobile, ballon garé au point d'agrippage. */
const c_yaw = (p) => p.yaw;

export function skillFollowStep(st, p, dt, cfg) {
  const A = p.act.payload;
  if (A.skill === 'rateau') {
    if (st.ball.owner !== p.id) { abortGesture(p, 'ballon-souffle-pendant-rateau', { log: st.gestures }); return; }
    const u = Math.min(1, (p.act.t - p.act.anticipation) / Math.max(1e-4, p.act.follow));
    const e = u * u * (3 - 2 * u);
    p.yaw = A.yaw0 + wrapA(A.exitYaw - A.yaw0) * e;
    p.yawWant = null;
    p.v[0] = 0; p.v[1] = 0; p.speed = 0.5;                        // le pivot n'est pas une course
    // les cibles de carry sont 2D [x, z] — la sonde du premier essai a vu le [x, y, z] à trois
    // termes envoyer le ballon vers la ligne z = 0,11 à la vMax du servo (3,99 m de « raclage »)
    const drag = 0.32 - 0.77 * e;
    st.ball.carry([p.p[0] + Math.cos(A.yaw0) * drag, p.p[2] + Math.sin(A.yaw0) * drag], dt, { tau: 0.05 });
    A.ballMax = Math.max(A.ballMax ?? 0, d2(p.p, st.ball.p));
  } else if (A.skill === 'plongeon') {
    // LE PLONGEON EST UNE DÉTENTE : le corps part vers le point d'interception dès l'armé et
    // glisse encore un peu après le contact — la seule écriture du corps pendant qu'il dure.
    // …et LE TOUCHER EST CONTINU : tester le ballon à la frame de contact du clip (0,55 s) rate
    // tout vol plus prompt — 2 arrêts sur 15 plongeons mesurés. Le gant rencontre le ballon à
    // l'image où il PASSE, le clip n'est que le dessin de la détente.
    if (!A.resolved && cfg.onDive && cfg.onDive(st, p, cfg)) A.resolved = true;
    // …et la PRISE TIENT (hook heldBall — match, lot 91) : le ballon résolu aux gants suit le
    // corps qui tombe et se relève — mesuré avant : il FLOTTAIT à 1,34 m, gelé, personne n'écrivait
    if (A.resolved) cfg.heldBall?.(st, p, dt, cfg);
    // …ET LA DÉTENTE S'ARRÊTE AU POINT : la vitesse était calée pour couvrir l'écart dans
    // cross.t mais courait la durée PLEINE de l'armé — le corps TRAVERSAIT le point
    // d'interception (voyage p50 2,37 m, p90 4,01 pour un écart de ~1,9 : le ballon finissait
    // DERRIÈRE le gardien, de l'autre côté — « il se déplace plus loin que le ballon pour
    // plonger à sa gauche », retour utilisateur). La détente couvre SA distance, puis s'éteint.
    const T = p.act.anticipation + 0.25;
    const k = p.act.t < p.act.anticipation ? 1 : Math.max(0, 1 - (p.act.t - p.act.anticipation) / 0.25);
    A.lungeMax = A.lungeMax ?? Math.min(1.35, Math.hypot((A.cross?.z ?? p.p[2]) - p.p[2], (A.cross ? 0.35 : 0)) + 0.2);
    A.lungeRun = A.lungeRun ?? 0;
    if (p.act.t < T && A.lunge && A.lungeRun < A.lungeMax) {
      const step = Math.min(A.speed * k * dt, A.lungeMax - A.lungeRun);
      A.lungeRun += step;
      p.p[0] += A.lunge[0] * step;
      p.p[2] += A.lunge[1] * step;
      p.p[0] = Math.max(-st.area[0] / 2, Math.min(st.area[0] / 2, p.p[0]));
      p.p[2] = Math.max(-st.area[1] / 2, Math.min(st.area[1] / 2, p.p[2]));
      p.v[0] = A.lunge[0] * (step / dt); p.v[1] = A.lunge[1] * (step / dt);
      p.speed = Math.hypot(p.v[0], p.v[1]);
    } else { p.v[0] = 0; p.v[1] = 0; p.speed = 0; }
  } else if (A.skill === 'passement') {
    // le corps reste PLANTÉ sur son appui, le ballon est FIGÉ sous le cercle de la jambe — la
    // sortie se joue après le geste (le burst posé au contact rend la première touche lancée)
    if (st.ball.owner !== p.id) { abortGesture(p, 'ballon-souffle-pendant-passement', { log: st.gestures }); return; }
    if (A.enCourse) {
      // LANCÉ : le corps glisse sur son élan (freiné à 45 %), le ballon roule libre sous le
      // cercle — sa friction le garde devant le pied (conduite protégée en amont)
      const vG = (A.v0 ?? 3) * 0.45;
      p.v[0] = Math.cos(A.yaw0 ?? c_yaw(p)) * vG; p.v[1] = Math.sin(A.yaw0 ?? c_yaw(p)) * vG;
      p.p[0] += p.v[0] * dt; p.p[2] += p.v[1] * dt;
      p.speed = vG;
    } else {
      p.v[0] = 0; p.v[1] = 0; p.speed = 0;
      if (A.pin) st.ball.carry([A.pin[0], A.pin[1]], dt, { tau: 0.04 });
    }
    A.ballMax = Math.max(A.ballMax ?? 0, d2(p.p, st.ball.p));
    // …et le geste s'ABANDONNE si on vient le presser pendant le cercle (même loi que la semelle)
    let foe = Infinity;
    for (const q of st.players) if (q.team !== p.team && q.down <= 0) foe = Math.min(foe, d2(q.p, p.p));
    if (foe < 0.9) {
      st.events.push({ t: +st.t.toFixed(2), type: 'skill-end', kind: 'passement', by: p.id, broke: 'pressé' });
      abortGesture(p, 'pressé-pendant-passement', { log: st.gestures });
      return;
    }
  } else if (A.skill === 'crochet') {
    // …et si le ballon a été soufflé pendant la coupe (duel, rebond), le geste MEURT nommé —
    // balayer un ballon qui n'est plus à soi serait un carry() sur ballon libre (garde BallBody)
    if (st.ball.owner !== p.id) { abortGesture(p, 'ballon-souffle-pendant-crochet', { log: st.gestures }); return; }
    // le lacet BALAIE vers la sortie (ease), le ballon suit L'ARC — de 0,35 m devant l'ancien
    // regard à 0,5 m devant le nouveau : la coupe à travers la course, jamais un téléport
    const u = Math.min(1, (p.act.t - p.act.anticipation) / Math.max(1e-4, p.act.follow));
    const e = u * u * (3 - 2 * u);
    p.yaw = A.yaw0 + wrapA(A.exitYaw - A.yaw0) * e;
    p.yawWant = null;
    p.v[0] = 0; p.v[1] = 0; p.speed = 0.5;
    const ang = A.yaw0 + wrapA(A.exitYaw - A.yaw0) * e;
    const dist = 0.35 + 0.15 * e;
    st.ball.carry([p.p[0] + Math.cos(ang) * dist, p.p[2] + Math.sin(ang) * dist], dt, { tau: 0.05 });
    A.ballMax = Math.max(A.ballMax ?? 0, d2(p.p, st.ball.p));
  } else if (A.skill === 'roulette') {
    if (st.ball.owner !== p.id) { abortGesture(p, 'ballon-souffle-pendant-roulette', { log: st.gestures }); return; }
    // LA ZIDANE (121) : le 360 TRAVERSE — le corps roule sur ~la moitié de son élan pendant
    // le tour (la marseillaise avance, elle ne toupille pas : retour utilisateur « plutôt
    // Zidane qu'Antony, ça manque d'envergure ») et la SORTIE REMONTE vers 75 % de l'élan
    // dans le dernier quart du geste — le porteur sort LANCÉ, le poursuivant mordu est
    // derrière. Mesuré avant : sortie p50 2,5 m/s (des cas plantés à 0,4), gain 1,9 m,
    // re-collé 28 %. Le ballon reste SOUS la semelle (0,18 m devant le cap COURANT — le
    // petit cercle roulé en marchant, la Zidane exacte) ; le cap de sortie = l'entrée.
    const u = Math.min(1, p.act.t / Math.max(1e-4, p.act.anticipation + p.act.follow));
    const e3 = u * u * (3 - 2 * u);
    p.yaw = wrapA(A.yaw0 + (A.spin ?? 1) * 2 * Math.PI * e3);
    p.yawWant = null;
    const roule = cfg.skill?.rouletteRoule ?? 0.5;
    const vG = (A.v0 ?? 2) * (roule + (0.75 - roule) * Math.max(0, (u - 0.7) / 0.3));
    p.v[0] = Math.cos(A.yaw0) * vG; p.v[1] = Math.sin(A.yaw0) * vG;
    p.p[0] += p.v[0] * dt; p.p[2] += p.v[1] * dt;
    p.speed = vG;
    st.ball.carry([p.p[0] + Math.cos(p.yaw) * 0.18, p.p[2] + Math.sin(p.yaw) * 0.18], dt, { tau: 0.05 });
    A.ballMax = Math.max(A.ballMax ?? 0, d2(p.p, st.ball.p));
  } else if (A.skill === 'roulette') {
    if (st.ball.owner !== p.id) { abortGesture(p, 'ballon-souffle-pendant-roulette', { log: st.gestures }); return; }
    // LA ZIDANE (121) : le 360 TRAVERSE — le corps roule sur ~la moitié de son élan pendant
    // le tour (la marseillaise avance, elle ne toupille pas : retour utilisateur « plutôt
    // Zidane qu'Antony, ça manque d'envergure ») et la SORTIE REMONTE vers 75 % de l'élan
    // dans le dernier quart du geste — le porteur sort LANCÉ, le poursuivant mordu est
    // derrière. Mesuré avant : sortie p50 2,5 m/s (des cas plantés à 0,4), gain 1,9 m,
    // re-collé 28 %. Le ballon reste SOUS la semelle (0,18 m devant le cap COURANT — le
    // petit cercle roulé en marchant, la Zidane exacte) ; le cap de sortie = l'entrée.
    const u = Math.min(1, p.act.t / Math.max(1e-4, p.act.anticipation + p.act.follow));
    const e3 = u * u * (3 - 2 * u);
    p.yaw = wrapA(A.yaw0 + (A.spin ?? 1) * 2 * Math.PI * e3);
    p.yawWant = null;
    const roule = cfg.skill?.rouletteRoule ?? 0.5;
    const vG = (A.v0 ?? 2) * (roule + (0.75 - roule) * Math.max(0, (u - 0.7) / 0.3));
    p.v[0] = Math.cos(A.yaw0) * vG; p.v[1] = Math.sin(A.yaw0) * vG;
    p.p[0] += p.v[0] * dt; p.p[2] += p.v[1] * dt;
    p.speed = vG;
    st.ball.carry([p.p[0] + Math.cos(p.yaw) * 0.18, p.p[2] + Math.sin(p.yaw) * 0.18], dt, { tau: 0.05 });
    A.ballMax = Math.max(A.ballMax ?? 0, d2(p.p, st.ball.p));
  } else if (A.skill === 'petitPont') {
    // avant le contact : le corps se cale (le ballon est à lui) ; APRÈS : le ballon est
    // PARTI (strike au contact — pas d'abort-souffle : c'est le geste qui l'a lâché), le
    // corps s'oriente au contournement et son burst l'emmène — la chasse standard reprend
    if (p.act.t < p.act.anticipation) {
      if (st.ball.owner !== p.id) { abortGesture(p, 'ballon-souffle-pendant-pont', { log: st.gestures }); return; }
      p.v[0] *= 0.8; p.v[1] *= 0.8; p.speed = Math.hypot(p.v[0], p.v[1]);
    } else if (A.reussi) {
      const u = Math.min(1, (p.act.t - p.act.anticipation) / Math.max(1e-4, p.act.follow));
      const e2 = u * u * (3 - 2 * u);
      p.yaw = A.yaw0 + wrapA(A.exitYaw - A.yaw0) * e2;
      p.yawWant = null;
      const vC = Math.max(2.5, (A.v0 ?? 2)) * (0.7 + 0.5 * e2);
      p.v[0] = Math.cos(p.yaw) * vC; p.v[1] = Math.sin(p.yaw) * vC;
      p.p[0] += p.v[0] * dt; p.p[2] += p.v[1] * dt;
      p.speed = vC;
    } else { p.v[0] *= 0.7; p.v[1] *= 0.7; p.speed = Math.hypot(p.v[0], p.v[1]); }
  } else if (A.skill === 'doubleContact') {
    if (st.ball.owner !== p.id) { abortGesture(p, 'ballon-souffle-pendant-double', { log: st.gestures }); return; }
    // le corps GLISSE sur son élan freiné et le cap TOURNE À PEINE vers la sortie (ease —
    // ~26°, pas la coupe à 80° du crochet) ; le ballon TRANSFÈRE d'un pied à l'autre (cos :
    // deux touches sèches, jamais un téléport) et FINIT DEVANT LE NOUVEAU CAP — la première
    // version le déposait latéral à 0,53 m sur l'ANCIEN cap : 37/43 ballons orphelins,
    // le geste réussissait sa feinte et perdait son ballon
    const u = Math.min(1, p.act.t / Math.max(1e-4, p.act.anticipation + p.act.follow));
    const e = u * u * (3 - 2 * u);
    p.yaw = A.yaw0 + wrapA(A.exitYaw - A.yaw0) * e;
    p.yawWant = null;
    const vG = (A.v0 ?? 2) * 0.55;
    p.v[0] = Math.cos(p.yaw) * vG; p.v[1] = Math.sin(p.yaw) * vG;
    p.p[0] += p.v[0] * dt; p.p[2] += p.v[1] * dt;
    p.speed = vG;
    // signe : yaw + away tourne vers −(fz,−fx) — lat POSITIF au départ = le côté du jeté
    // (le ballon exposé) ; l'amplitude MEURT avec u : à la fin lat = 0, le ballon pile
    // devant le cap de sortie (la conduite le reprend sans un pas de plus)
    const lat = (A.away ?? 1) * 0.32 * Math.cos(Math.PI * u) * (1 - e);
    const fx = Math.cos(p.yaw), fz = Math.sin(p.yaw);
    st.ball.carry([p.p[0] + fx * (0.35 + 0.1 * e) + fz * lat, p.p[2] + fz * (0.35 + 0.1 * e) - fx * lat], dt, { tau: 0.045 });
    A.ballMax = Math.max(A.ballMax ?? 0, d2(p.p, st.ball.p));
  } else if (A.skill === 'roulette') {
    if (st.ball.owner !== p.id) { abortGesture(p, 'ballon-souffle-pendant-roulette', { log: st.gestures }); return; }
    // LA ZIDANE (121) : le 360 TRAVERSE — le corps roule sur ~la moitié de son élan pendant
    // le tour (la marseillaise avance, elle ne toupille pas : retour utilisateur « plutôt
    // Zidane qu'Antony, ça manque d'envergure ») et la SORTIE REMONTE vers 75 % de l'élan
    // dans le dernier quart du geste — le porteur sort LANCÉ, le poursuivant mordu est
    // derrière. Mesuré avant : sortie p50 2,5 m/s (des cas plantés à 0,4), gain 1,9 m,
    // re-collé 28 %. Le ballon reste SOUS la semelle (0,18 m devant le cap COURANT — le
    // petit cercle roulé en marchant, la Zidane exacte) ; le cap de sortie = l'entrée.
    const u = Math.min(1, p.act.t / Math.max(1e-4, p.act.anticipation + p.act.follow));
    const e3 = u * u * (3 - 2 * u);
    p.yaw = wrapA(A.yaw0 + (A.spin ?? 1) * 2 * Math.PI * e3);
    p.yawWant = null;
    const roule = cfg.skill?.rouletteRoule ?? 0.5;
    const vG = (A.v0 ?? 2) * (roule + (0.75 - roule) * Math.max(0, (u - 0.7) / 0.3));
    p.v[0] = Math.cos(A.yaw0) * vG; p.v[1] = Math.sin(A.yaw0) * vG;
    p.p[0] += p.v[0] * dt; p.p[2] += p.v[1] * dt;
    p.speed = vG;
    st.ball.carry([p.p[0] + Math.cos(p.yaw) * 0.18, p.p[2] + Math.sin(p.yaw) * 0.18], dt, { tau: 0.05 });
    A.ballMax = Math.max(A.ballMax ?? 0, d2(p.p, st.ball.p));
  } else if (A.skill === 'petitPont') {
    // avant le contact : le corps se cale (le ballon est à lui) ; APRÈS : le ballon est
    // PARTI (strike au contact — pas d'abort-souffle : c'est le geste qui l'a lâché), le
    // corps s'oriente au contournement et son burst l'emmène — la chasse standard reprend
    if (p.act.t < p.act.anticipation) {
      if (st.ball.owner !== p.id) { abortGesture(p, 'ballon-souffle-pendant-pont', { log: st.gestures }); return; }
      p.v[0] *= 0.8; p.v[1] *= 0.8; p.speed = Math.hypot(p.v[0], p.v[1]);
    } else if (A.reussi) {
      const u = Math.min(1, (p.act.t - p.act.anticipation) / Math.max(1e-4, p.act.follow));
      const e2 = u * u * (3 - 2 * u);
      p.yaw = A.yaw0 + wrapA(A.exitYaw - A.yaw0) * e2;
      p.yawWant = null;
      const vC = Math.max(2.5, (A.v0 ?? 2)) * (0.7 + 0.5 * e2);
      p.v[0] = Math.cos(p.yaw) * vC; p.v[1] = Math.sin(p.yaw) * vC;
      p.p[0] += p.v[0] * dt; p.p[2] += p.v[1] * dt;
      p.speed = vC;
    } else { p.v[0] *= 0.7; p.v[1] *= 0.7; p.speed = Math.hypot(p.v[0], p.v[1]); }
  } else if (A.skill === 'doubleContact') {
    if (st.ball.owner !== p.id) { abortGesture(p, 'ballon-souffle-pendant-double', { log: st.gestures }); return; }
    // le corps GLISSE sur son élan freiné et le cap TOURNE À PEINE vers la sortie (ease —
    // ~26°, pas la coupe à 80° du crochet) ; le ballon TRANSFÈRE d'un pied à l'autre (cos :
    // deux touches sèches, jamais un téléport) et FINIT DEVANT LE NOUVEAU CAP — la première
    // version le déposait latéral à 0,53 m sur l'ANCIEN cap : 37/43 ballons orphelins,
    // le geste réussissait sa feinte et perdait son ballon
    const u = Math.min(1, p.act.t / Math.max(1e-4, p.act.anticipation + p.act.follow));
    const e = u * u * (3 - 2 * u);
    p.yaw = A.yaw0 + wrapA(A.exitYaw - A.yaw0) * e;
    p.yawWant = null;
    const vG = (A.v0 ?? 2) * 0.55;
    p.v[0] = Math.cos(p.yaw) * vG; p.v[1] = Math.sin(p.yaw) * vG;
    p.p[0] += p.v[0] * dt; p.p[2] += p.v[1] * dt;
    p.speed = vG;
    // signe : yaw + away tourne vers −(fz,−fx) — lat POSITIF au départ = le côté du jeté
    // (le ballon exposé) ; l'amplitude MEURT avec u : à la fin lat = 0, le ballon pile
    // devant le cap de sortie (la conduite le reprend sans un pas de plus)
    const lat = (A.away ?? 1) * 0.32 * Math.cos(Math.PI * u) * (1 - e);
    const fx = Math.cos(p.yaw), fz = Math.sin(p.yaw);
    st.ball.carry([p.p[0] + fx * (0.35 + 0.1 * e) + fz * lat, p.p[2] + fz * (0.35 + 0.1 * e) - fx * lat], dt, { tau: 0.045 });
    A.ballMax = Math.max(A.ballMax ?? 0, d2(p.p, st.ball.p));
  } else if (A.skill === 'semelle') {
    if (st.ball.owner !== p.id) { abortGesture(p, 'ballon-souffle-pendant-semelle', { log: st.gestures }); return; }
    // LA SEMELLE SE DÉCOLLE QUAND ON VIENT LA PRESSER. Tenue quoi qu'il arrive, elle offrait le
    // temps « collé » mesuré (58 % — un presseur à 2,4 m couvre l'écart en 0,4 s et la tenue
    // durait 1,0 s) : le vrai joueur relâche la pose et REJOUE dès que quelqu'un ferme. L'abandon
    // est un abort NOMMÉ — le contrat des gestes le lit, rien ne s'évapore.
    let foe = Infinity;
    for (const q of st.players) if (q.team !== p.team && q.down <= 0) foe = Math.min(foe, d2(q.p, p.p));
    if (foe < 2.0) {
      st.events.push({ t: +st.t.toFixed(2), type: 'skill-end', kind: 'semelle', by: p.id, maxV: +(A.maxV ?? 0).toFixed(2), broke: 'pressé' });
      abortGesture(p, 'pressé-sous-semelle', { log: st.gestures });
      return;
    }
    p.v[0] = 0; p.v[1] = 0; p.speed = 0;
    if (A.pin) st.ball.carry([A.pin[0], A.pin[1]], dt, { tau: 0.04 });
    A.maxV = Math.max(A.maxV ?? 0, Math.hypot(st.ball.v[0], st.ball.v[2]));
  }
}
