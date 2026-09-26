// face.js — LE FACE-À-FACE AU PAS (cfg.face && st.full — le duel, 2026-09-26 : « lancer le chantier face-à-face au pas façon Taarabt »).
// Mesuré avant (sonde duel-face, 8 graines × 120 s) : le duel face à face durait 0,7 s (p50), le ballon à 0,81 m du défenseur, le
// porteur à 2,1 m/s ; 64 % des duels sans aucun geste, 57 % perdus, le défenseur jamais au sol. Les cibles : Headrick (thèse QUT, 1c1 —
// distance ballon-défenseur au face-à-face stable 1,15-1,69 m ; 1c1 de 3,3 s (risque) à 5,0 s (prudent)) et la vidéo de référence
// (Taarabt, image par image : planté à 1,5-2 m du défenseur, semelle sur le ballon, une feinte toutes les 0,3-0,6 s, 2 à 4 par duel,
// le défenseur qui se jette et finit au sol, puis le départ).
// LA LOI. ENTRÉE : le porteur de champ, ballon au pied, le défenseur de champ DEVANT lui (entre lui et le but, cône ± cone°) à portée,
// hors de la zone de tir (≥ but m du but) — au tirage de l'envie (flair) ; un refus re-tire dans cd s (le dribble dans la foulée vit
// toujours) — quand la conduite l'a mené à foe m du défenseur (freinage compris), ballon au pied devant lui : il le BLOQUE sous la
// semelle (l'arrêt semelle ; mesuré, une approche freinée ballon libre le laissait filer vers le défenseur : 27 % de pertes). LA TENUE : planté, le regard sur le défenseur, la semelle sur le ballon (le rendu
// pose le pied sur le ballon réel — la pausa) ; toutes les pause s un ROULÉ DE SEMELLE (motion-skill.semelleRoule) passe le ballon
// d'un pied à l'autre devant le corps — le buste vend le côté du roulé : c'est la feinte, et le défenseur MORD au tirage (la note de
// geste contre son anticipation, chaque feinte vue l'use) — mordu, il glisse du côté vendu (decale m) et s'assoit (_bite). LE
// DÉFENSEUR tient sa GARDE (garde m du ballon sur la ligne ballon → son but) puis SE JETTE — à bout de patience, ou mordu (vers le
// côté vendu) : il CHARGE son appui charge s (la fente s'annonce), puis la fente — un tacle-debout dont le corps glisse jusqu'à portée
// du ballon d'alors ; le porteur LIT la charge au tirage (son anticipation contre le tempo du tacleur) et TIRE le ballon à la semelle
// (motion-skill.tireSemelle — la semelle est déjà dessus, pas d'armé) : le contact juge (standTackleNow, la géométrie). La fente dans
// le vide peut finir au SOL (chuter). SORTIE : le mordu décalé, la fente manquée ou le défenseur au sol → la croqueta plantée du côté
// ouvert, la sortie explose à sa fin ; au bout de max s de tenue il y va quand même. Événement 'face' (entre / charge / fin : issue,
// durée, roulés, morsures, fente). LE DÉFENSEUR N'EST JAMAIS FIGÉ : à sa garde il montre la fente (le jab) toutes les jab.cadence s. Clé absente : l'hier au bit.
import { hyp } from './hyp.js';
import { tirage } from './rng.js';
import { startGesture, abortGesture, busy } from './gesture.js';
import { MOVE_TIMING } from './skills-sim.js';
import { SKILL_KINDS } from './motion-skill.js';
import { situation, footFor, byId } from './technique.js';
import { chuter } from './duel.js';

const rnd = (st, id) => tirage(st, 'geste', id, st.rnd ?? (() => 0.5))();
const tir = (a, u) => a[0] + (a[1] - a[0]) * u;
const ROULE = SKILL_KINDS.semelleRoule, ROULE_OUT = SKILL_KINDS.semelleRouleOut, TIRE = SKILL_KINDS.tireSemelle, TIRE_IN = SKILL_KINDS.tireSemelleIn;
const DEV = 0.28;   // m — le ballon sous la semelle, devant le corps (le point du clip : ball[2])

/** Le défenseur de champ DEVANT le porteur : côté but, dans le cône, à portée ; null sinon. */
function devant(st, c, E) {
  const g = st.pitch.attackGoal(c.team), gx = g.x - c.p[0], gz = -c.p[2], gl = hyp(gx, gz) || 1, cos = Math.cos((E.cone ?? 50) * Math.PI / 180);
  let best = null;
  for (const q of st.players) {
    if (q.team === c.team || q.keeper || q.down > 0 || q._sub || q.expulse) continue;
    const dx = q.p[0] - c.p[0], dz = q.p[2] - c.p[2], d = hyp(dx, dz);
    if (d < E.foe[0] || d > E.foe[1] || (dx * gx + dz * gz) / (d * gl) < cos) continue;
    if (!best || d < best.d) best = { q, d };
  }
  return best;
}

function fin(st, c, issue, K) {
  const F = c._face;
  st.events.push({ t: +st.t.toFixed(2), type: 'face', phase: 'fin', by: c.id, par: F.par, issue, duree: +(st.t - F.t0).toFixed(2), feintes: F.feintes, mords: F.mords, fente: F.fente ? (F.fente.lu ? 'lue' : F.fente.mordue ? 'mordue' : 'franche') : null });
  c._face = null; c._faceCap = null; c._faceCd = st.t + (K.entree.cd ?? 2.5); c._regard = null; c._regardUntil = null;
}

/** Un geste de semelle du face-à-face (le roulé, le tiré) : le ballon suit le chemin du clip en repère personnage (x : la droite, z : devant). */
function semelle(st, c, kind, S, x1, z1) {
  const F = c._face, foot = F.pied;   // LE MÊME PIED tout le face-à-face : la semelle ne quitte pas le ballon (aller en travers, retour dehors)
  startGesture(c, { id: kind, duration: S.duration, contact: S.contact }, { payload: { kind: 'skill', skill: kind, pick: { foot }, ownsBody: true, pin: [st.ball.p[0], st.ball.p[2]], face: { x0: F.x, x1, z0: DEV, z1, fin: S.dragEnd }, ballMax: 0 }, log: st.gestures });
  st.events.push({ t: +st.t.toFixed(2), type: 'windup', by: c.id, move: kind, foot, skill: kind, anticipation: S.contact });
  F.x = x1;
}

/** LA SORTIE : la croqueta PLANTÉE du côté `cote` (+1 = la droite du porteur face au défenseur) — en diagonale devant (≈ 37° de l'axe),
 *  le ballon part du côté opposé et traverse (skillFollowStep 'doubleContact'), la sortie explose à sa fin (rondo-sim, sortieBurst). */
function sortir(st, c, q, cote, issue, K) {
  const F = c._face;
  // LA SORTIE VISE LE CÔTÉ OUVERT DU DÉFENSEUR, VERS LE BUT : un point à cote.lat m de son flanc et cote.au m au-delà de lui (côté but) —
  // tirée de l'axe porteur-défenseur seul, la croqueta partait de biais et la conduite qui suivait (vers le but) laissait le ballon (capture)
  const g = st.pitch.attackGoal(c.team), gx = g.x - q.p[0], gz = -q.p[2], gl = hyp(gx, gz) || 1;
  const ax = q.p[0] + F.n[0] * cote * K.sortie.lat + (gx / gl) * K.sortie.au, az = q.p[2] + F.n[1] * cote * K.sortie.lat + (gz / gl) * K.sortie.au;
  const exitYaw = Math.atan2(az - c.p[2], ax - c.p[0]);
  c._faceSortie = { dir: [Math.cos(exitYaw), Math.sin(exitYaw)], t: st.t + MOVE_TIMING.doubleContact.duration };
  if (busy(c)) abortGesture(c, 'face-sortie', { log: st.gestures });
  const foot = footFor(byId.crochet, situation(c.p, c.yaw, st.ball.p, [0, 0], st.ball.p[1])), move = MOVE_TIMING.doubleContact;
  startGesture(c, { id: 'doubleContact', ...move }, { payload: { kind: 'skill', skill: 'doubleContact', pick: { foot }, ownsBody: true, yaw0: c.yaw, exitYaw, away: cote, v0: Math.max(1.2, c.speed), foeId: q.id, ballMax: 0, face: true }, log: st.gestures });
  (c._skillCd ??= {}).double = st.t + 2; c._dribAt = st.t;
  st.events.push({ t: +st.t.toFixed(2), type: 'windup', by: c.id, move: 'doubleContact', foot, skill: 'doubleContact', anticipation: move.contact });
  st.events.push({ t: +st.t.toFixed(2), type: 'skill', kind: 'doubleContact', by: c.id, foe: +hyp(q.p[0] - c.p[0], q.p[2] - c.p[2]).toFixed(2), face: issue });
  fin(st, c, issue, K);
}

/** LA FENTE qui s'annonce : le défenseur CHARGE son appui (charge s), vers `cible` (fixée maintenant — il s'engage sur le ballon d'alors) ;
 *  le porteur la lit (ou pas) pendant la charge. */
function fente(st, q, c, cible, mordue, K) {
  const F = c._face;
  const pLu = mordue ? 0 : Math.min(0.9, K.lecture * (c.skill?.anticipF ?? 1) * (2 - (q.skill?.tacleTempoF ?? 1)));   // la fente mordue part déjà du mauvais côté : rien à lire
  F.fente = { t: st.t, cible, mordue, lu: rnd(st, c.id) < pLu ? st.t + (c.skill?.reaction ?? 0.18) * 0.7 : null, tire: false, part: st.t + K.fente.charge, contact: null, juge: false };
  st.events.push({ t: +st.t.toFixed(2), type: 'face', phase: 'charge', by: c.id, par: q.id, fente: mordue ? 'mordue' : 'patience', lue: F.fente.lu != null });
}

function lancerFente(st, q, c, K, cfg) {
  const Fn = c._face.fente, move = MOVE_TIMING.tacleDebout, dx = Fn.cible[0] - q.p[0], dz = Fn.cible[1] - q.p[2], d = hyp(dx, dz) || 1;
  q.tackleCd = st.t + (cfg.standCooldown ?? 1.5); q.yawWant = Math.atan2(dz, dx);
  startGesture(q, { id: 'tacleDebout', ...move }, { payload: { kind: 'tacle-debout', victim: c.id, fente: { u: [dx / d, dz / d], v: Math.min(K.fente.glisse, Math.max(0, d - K.fente.portee)) / Math.max(0.05, move.contact), reste: Math.min(K.fente.glisse, Math.max(0, d - K.fente.portee)), chute: K.fente.chute * (Fn.mordue ? 1.5 : 1), juge: false } }, log: st.gestures });
  st.events.push({ t: +st.t.toFixed(2), type: 'windup', by: q.id, move: 'tacleDebout', anticipation: move.contact, fente: Fn.mordue ? 'mordue' : Fn.lu ? 'lue' : 'franche' });
  Fn.contact = st.t + move.contact;
}

/** L'APPROCHE (le porteur VA le chercher) : le défenseur de champ côté but à app.d m, hors de la zone de tir, ballon au pied — au tirage de
 *  l'envie (une fois par rencontre), la conduite se tourne VERS lui et freine en approchant (app.cap m/s de loin → cap proche) ; la
 *  tenue s'ouvre quand il est à portée de pose (l'entrée). Mesuré : défenseur côté but à ≤ 4,5 m, le porteur lui tournait le DOS 55 % du
 *  temps (l'évasion le fuyait) — le face-à-face ne naissait jamais. Le ballon reste celui de la conduite (libre, touché au pied). */
function approche(st, c, K) {
  const A = K.approche, E = K.entree; if (!A || st.phase !== 'carry' || st.restart || busy(c) || c.down > 0 || (c._faceCd ?? -1) > st.t) { c._faceApp = null; return; }
  const g = st.pitch.attackGoal(c.team), D = devant(st, c, { foe: [E.foe[0], A.d[1]], cone: E.cone });
  if (!D || hyp(g.x - c.p[0], c.p[2]) < (E.but ?? 6.5) || hyp(st.ball.p[0] - c.p[0], st.ball.p[2] - c.p[2]) > (A.ballon ?? 1.4) || (st.ball.owner != null && st.ball.owner !== c.id)) { c._faceApp = null; return; }
  if (!c._faceApp || c._faceApp.par !== D.q.id) {
    if (D.d < A.d[0]) return;   // on ne s'engage dans l'approche que de loin
    const ux0 = (D.q.p[0] - c.p[0]) / D.d, uz0 = (D.q.p[2] - c.p[2]) / D.d, hx = c.speed > 0.5 ? c.v[0] / c.speed : Math.cos(c.yaw), hz = c.speed > 0.5 ? c.v[1] / c.speed : Math.sin(c.yaw);
    if (-(D.q.v[0] * ux0 + D.q.v[1] * uz0) > (A.ferme ?? 2) || ux0 * hx + uz0 * hz < Math.cos((A.dos ?? 110) * Math.PI / 180)) return;   // un défenseur qui TIENT (pas une poursuite : mesuré, il fermait à 4,2 m/s dans le dos du porteur qui fuyait), un porteur qui ne le fuit pas
    c._faceApp = { par: D.q.id, t0: st.t, go: rnd(st, c.id) < E.envie[0] + E.envie[1] * (c.persona?.flair ?? 0.5) };
  }
  if (!c._faceApp.go || st.t - c._faceApp.t0 > (A.max ?? 3.5)) return;
  const ux = (D.q.p[0] - c.p[0]) / D.d, uz = (D.q.p[2] - c.p[2]) / D.d;
  c.push = [ux, uz]; c.target = [c.p[0] + ux * 3, 0, c.p[2] + uz * 3];
  c._faceCap = Math.max(A.cap[0], Math.min(A.cap[1], A.cap[0] + (A.pente ?? 0.35) * (D.d - A.d[0])));
}

/** Une image, AVANT le mouvement (cfg.avantMouvement, après les cibles d'assignJobs) : l'entrée, l'approche, la tenue, les roulés, la
 *  garde, la fente (la charge, le glissé de l'armé), la lecture, la sortie. */
export function faceAvant(st, cfg) {
  const K = cfg.face, E = K.entree, dt = Math.max(0, Math.min(0.05, st.t - (st._faceT ?? st.t))); st._faceT = st.t;
  for (const q of st.players) {   // LA FENTE : le glissé de l'armé (movePlayers se tait, ce pas l'écrit), puis au contact passé — manquée — la CHUTE au tirage
    const G = q.act?.payload?.fente; if (!G) continue;
    if (!q.act.fired) { if (G.reste > 0) { const s = Math.min(G.v * dt, G.reste); q.p[0] += G.u[0] * s; q.p[2] += G.u[1] * s; G.reste -= s; } continue; }
    if (G.juge) continue; G.juge = true;
    if (st.possession?.carrier === q.act.payload.victim) { if (rnd(st, q.id) < G.chute) chuter(st, q, null, cfg, 'fente', 1.2); else q._bite = Math.max(q._bite ?? -1, st.t + 0.45); }
  }
  const car = st.players[st.possession?.carrier ?? -1];
  for (const p of st.players) { if (p._face && p !== car) fin(st, p, 'perdu', K); if (p !== car) { p._faceApp = null; p._faceCap = null; p._faceSortie = null; } }
  if (car?._faceSortie && (!busy(car) || st.t > car._faceSortie.t + 0.1)) {   // LA SORTIE TIENT SA DIRECTION (pas.sortieFoulee) : la croqueta finie, la poussée reste sur la sortie sortie.duree s, en accélération
    const S = car._faceSortie; car._faceSortie = null; car.push = [S.dir[0], S.dir[1]];
    car._pace = { ...(car._pace ?? { next: 3 }), until: Math.max(car._pace?.until ?? 0, st.t + K.sortie.duree), kind: 'sortie', dir: [S.dir[0], S.dir[1]] };
  }
  if (!car || car.keeper) return;
  const c = car, F = c._face;
  if (!F) { c._faceCap = null; approche(st, c, K); }
  if (!F) {   // L'ENTRÉE : la conduite l'a mené à portée de pose (freinage compris), ballon au pied devant lui — il le BLOQUE sous la semelle
    if (st.phase !== 'carry' || st.restart || busy(c) || c.down > 0 || (c._faceCd ?? -1) > st.t || c.speed > (E.vMax ?? 3.5)) return;
    const bx = st.ball.p[0] - c.p[0], bz = st.ball.p[2] - c.p[2], dB = hyp(bx, bz), vB = hyp(st.ball.v[0], st.ball.v[2]);
    if ((st.ball.owner != null && st.ball.owner !== c.id) || st.ball.p[1] > 0.3 || dB > (E.ballon ?? 0.5) + (E.frein ?? 0.25) * c.speed || vB > (E.vBallon ?? 3.5) || bx * Math.cos(c.yaw) + bz * Math.sin(c.yaw) < 0.05) return;
    const g = st.pitch.attackGoal(c.team); if (hyp(g.x - c.p[0], c.p[2]) < (E.but ?? 6.5)) return;
    const D = devant(st, c, E); if (!D || D.q.act || (D.q._bite ?? -1) > st.t) return;
    { const hx = c.speed > 0.5 ? c.v[0] / c.speed : Math.cos(c.yaw), hz = c.speed > 0.5 ? c.v[1] / c.speed : Math.sin(c.yaw), ux = (D.q.p[0] - c.p[0]) / D.d, uz = (D.q.p[2] - c.p[2]) / D.d;
      if (ux * hx + uz * hz < Math.cos((E.face ?? 55) * Math.PI / 180) || -(D.q.v[0] * ux + D.q.v[1] * uz) > (E.charge ?? 3)) return; }   // FACE à lui (sa course le mène au défenseur — capture : le porteur qui revenait vers son camp, le défenseur dans le dos, se retournait et le corps traversait l'autre) ; le défenseur qui CHARGE lancé est l'affaire du râteau
    const dFrein = D.d - (E.frein ?? 0.25) * c.speed; if (dFrein < E.foe[0] || dFrein > E.foe[1]) return;   // la pose se prend à foe m, freinage compris
    if (c._faceApp ? !c._faceApp.go : rnd(st, c.id) > E.envie[0] + E.envie[1] * (c.persona?.flair ?? 0.5)) { c._faceCd = st.t + (E.cd ?? 2.5); return; }   // (l'envie tirée à l'approche vaut pour l'entrée)
    c._faceApp = null;
    const u = [(D.q.p[0] - c.p[0]) / D.d, (D.q.p[2] - c.p[2]) / D.d], foot = c.foot === 'left' ? 'left' : 'right', S = SKILL_KINDS.arretSemelle;
    c._face = { t0: st.t, par: D.q.id, u, n: [-u[1], u[0]], pied: foot, m: foot === 'right' ? 1 : -1, x: foot === 'right' ? S.ball[0] : -S.ball[0], prochain: st.t + S.hold, feintes: 0, mords: 0, mordu: null, roule: null, fente: null, ballon: null, jab: st.t + tir(K.jab.cadence, rnd(st, D.q.id)),
      patience: st.t + tir(K.patience, rnd(st, D.q.id)) * (2 - (D.q.skill?.aggrF ?? 1)) };
    c.intent = null; c._faceCap = 0.3;
    if (st.ball.owner !== c.id) st.ball.possess(c.id);
    // L'ARRÊT SEMELLE est un GESTE (le clip arretSemelle) : le corps freine dessous (mobile, movePlayers au plafond _faceCap), le ballon au point du
    // pied devant lui (pinRel pendant l'armé, le chemin du clip après) — soudé sans geste, le ballon suivait un corps à 4 m/s sans pied (verify-pas)
    startGesture(c, { id: 'arretSemelle', duration: S.duration, contact: S.contact }, { payload: { kind: 'skill', skill: 'semelleFace', pick: { foot }, ownsBody: true, mobile: true, pinRel: -S.ball[2], face: { x0: c._face.x, x1: c._face.x, z0: -S.ball[2], z1: DEV, fin: S.hold }, ballMax: 0 }, log: st.gestures });
    st.events.push({ t: +st.t.toFixed(2), type: 'windup', by: c.id, move: 'arretSemelle', foot, skill: 'semelleFace', anticipation: S.contact, vBallon: +vB.toFixed(1) });
    st.events.push({ t: +st.t.toFixed(2), type: 'face', phase: 'entre', by: c.id, par: D.q.id, d: +D.d.toFixed(2), v: +c.speed.toFixed(1) });
    return;
  }
  const q = st.players[F.par];
  if (!q || st.phase !== 'carry' || st.restart || c.down > 0 || st.ball.owner !== c.id) return fin(st, c, 'perdu', K);
  const dx = q.p[0] - c.p[0], dz = q.p[2] - c.p[2], dq = hyp(dx, dz) || 1, g = st.pitch.attackGoal(c.team), gx = g.x - c.p[0], gz = -c.p[2], gl = hyp(gx, gz) || 1;
  if (q.down > 0) return sortir(st, c, q, ((st.ball.p[0] - q.p[0]) * F.n[0] + (st.ball.p[2] - q.p[2]) * F.n[1]) >= 0 ? 1 : -1, 'au-sol', K);   // la fente a fini au SOL : on l'enjambe
  if ((dx * gx + dz * gz) / gl < -0.3) return fin(st, c, 'depasse', K);
  if (dq > (K.lache ?? 4.8)) return fin(st, c, 'relache', K);
  if (!busy(q)) { F.u = [dx / dq, dz / dq]; F.n = [-F.u[1], F.u[0]]; }   // (pendant la fente, l'axe reste celui de la charge)
  c._regard = Math.atan2(dz, dx); c._regardUntil = st.t + 0.15;
  const fx = Math.cos(c.yaw), fz = Math.sin(c.yaw);
  const age = st.t - F.t0, Fn = F.fente, A = c.act?.payload;
  // LA FENTE : la charge, la lecture (le tiré de semelle), le départ, puis le jugement du contact
  if (Fn) {
    if (Fn.lu != null && !Fn.tire && st.t >= Fn.lu) { Fn.tire = true; if (busy(c)) abortGesture(c, 'face-tire', { log: st.gestures }); const dehors = F.x * F.m > -0.02, S = dehors ? TIRE : TIRE_IN; semelle(st, c, dehors ? 'tireSemelle' : 'tireSemelleIn', S, F.m * S.dragX, -S.dragTo); }   // le clip tire le ballon de (ball[0], ball[2]) à (dragX, dragTo) — z < 0 devant ; depuis le ballon dehors ou croisé
    if (!Fn.contact && st.t >= Fn.part && q.down <= 0 && !busy(q)) lancerFente(st, q, c, K, cfg);
    if (Fn.contact && !Fn.juge && st.t > Fn.contact + 0.02) {   // le ballon toujours à lui : manquée — au SOL (tirage) ou déséquilibré, puis la sortie
      Fn.juge = true;   // (la chute s'est jugée sur la fente elle-même, en tête d'image)
      return sortir(st, c, q, ((st.ball.p[0] - c.p[0]) * F.n[0] + (st.ball.p[2] - c.p[2]) * F.n[1]) >= 0 ? 1 : -1, Fn.lu ? 'fente-lue' : Fn.mordue ? 'fente-mordue' : 'fente-manquee', K);
    }
  }
  // LA MORSURE : au contact du roulé, le défenseur mord (ou non) du côté du roulé ; mordu, il peut se jeter de ce côté-là
  if (/^semelleRoule/.test(A?.skill ?? '') && c.act.fired && F.roule && !F.roule.juge) {
    F.roule.juge = true;
    const pM = Math.min(0.85, (K.morsure.base + K.morsure.cumul * (F.feintes - 1)) * (c.skill?.gesteF ?? 1) * (2 - (q.skill?.anticipF ?? 1)));
    if (!Fn && !busy(q) && q.down <= 0 && rnd(st, q.id) < pM) {
      F.mords++; q._bite = st.t + K.morsure.duree * (c.skill?.gesteF ?? 1); F.mordu = { t: st.t, cote: F.roule.cote, until: q._bite };
      q.v[0] = F.n[0] * F.roule.cote * K.morsure.elan; q.v[1] = F.n[1] * F.roule.cote * K.morsure.elan;   // LE PAS DU MAUVAIS CÔTÉ : le mordu lance son appui vers le côté vendu (l'élan s'amortit sous le ralenti de la morsure) — assis sur place, il se lisait figé (verify-duel : 1,43 s)
      if (rnd(st, q.id) < K.fente.surMorsure) fente(st, q, c, [st.ball.p[0] + F.n[0] * F.roule.cote * K.fente.suite, st.ball.p[2] + F.n[1] * F.roule.cote * K.fente.suite], true, K);   // il se jette sur la SUITE vendue (le ballon qui continuerait du côté du roulé)
    }
  }
  // LA SORTIE SUR LA MORSURE : le roulé a fini de rouler, le mordu glisse du côté vendu → de l'autre côté
  const rouleFini = !busy(c) || (/^semelleRoule/.test(A?.skill ?? '') && c.act.t >= ROULE.dragEnd);
  if ((!F.fente || F.fente.mordue) && F.mordu && (rouleFini || F.fente) && st.t - F.mordu.t > (c.skill?.reaction ?? 0.18) * 0.7 && st.t < F.mordu.until) return sortir(st, c, q, -F.mordu.cote, F.fente ? 'fente-mordue' : 'mordu', K);   // la fente MORDUE se punit tout de suite : il part de l'autre côté pendant qu'elle s'engage (attendre son contact la laissait gagner 5 fois sur 5)
  if (!F.fente && !busy(c) && age > K.max) return sortir(st, c, q, ((st.ball.p[0] - q.p[0]) * F.n[0] + (st.ball.p[2] - q.p[2]) * F.n[1]) >= 0 ? 1 : -1, 'expire', K);
  // LE ROULÉ SUIVANT (la feinte) : planté, toutes les pause s — le ballon passe devant le corps, d'un pied à l'autre
  if ((!busy(c) || (A?.skill === 'semelleFace' && c.act.t >= SKILL_KINDS.arretSemelle.hold)) && !F.fente && st.t >= F.prochain) {   // (le premier enchaîne sur la tenue de l'arrêt semelle, le pied encore dessus)
    if (busy(c)) abortGesture(c, 'face-roule', { log: st.gestures });
    const dehors = F.x * F.m > -0.02, S = dehors ? ROULE : ROULE_OUT, x1 = F.m * S.dragX;
    F.feintes++; F.roule = { cote: Math.sign(x1 - F.x), t: st.t, juge: false };
    semelle(st, c, dehors ? 'semelleRoule' : 'semelleRouleOut', S, x1, DEV);
    F.prochain = st.t + S.duration + tir(K.pause, rnd(st, c.id));
    st.events.push({ t: +st.t.toFixed(2), type: 'skill', kind: 'semelleRoule', by: c.id, foe: +dq.toFixed(2), face: F.feintes });
  }
  // LA FENTE À BOUT DE PATIENCE (le défenseur posé à sa garde, pas mordu)
  if (!F.fente && age > 0.4 && st.t >= F.patience && !busy(q) && q.down <= 0 && !((q._bite ?? -1) > st.t) && hyp(q.p[0] - st.ball.p[0], q.p[2] - st.ball.p[2]) < K.garde + 0.6)
    fente(st, q, c, [st.ball.p[0] + c.v[0] * 0.3, st.ball.p[2] + c.v[1] * 0.3], false, K);
  // LA TENUE : planté (la cible est sa place), le ballon sous la semelle au point du clip
  c.target = [c.p[0], 0, c.p[2]]; c.push = null; c._faceCap = 0.5;
  const m0 = 0.13, bx = c.p[0] + fx * DEV - fz * F.x, bz = c.p[2] + fz * DEV + fx * F.x;
  F.ballon = [Math.max(-st.area[0] / 2 + m0, Math.min(st.area[0] / 2 - m0, bx)), Math.max(-st.area[1] / 2 + m0, Math.min(st.area[1] / 2 - m0, bz))];
  garde(st, c, q, F, K);
}

/** LA GARDE DU DÉFENSEUR : garde m du ballon sur la ligne ballon → son but ; mordu, décalé du côté vendu ; pendant la charge, il s'arrête. */
function garde(st, c, q, F, K) {
  if (busy(q) || q.down > 0) return;
  if (F.fente && !F.fente.contact) { q.job = 'press'; q.target = [q.p[0], 0, q.p[2]]; return; }
  // LE JAB : le défenseur qui jockeye n'est jamais immobile — toutes les cadence s il MONTRE la fente (un pas vers le ballon de jab.pas m,
  // tenu jab.duree s) puis revient à sa garde ; une garde statique était un joueur gelé (verify-duel : 1,2-1,6 s sous 0,25 m/s)
  if (st.t >= F.jab + K.jab.duree) F.jab = st.t + tir(K.jab.cadence, rnd(st, q.id));
  const og = st.pitch.ownGoal(q.team), wx = og.x - st.ball.p[0], wz = -st.ball.p[2], wl = hyp(wx, wz) || 1, gd = Math.max(1.1, Math.min(1.8, K.garde * (2 - (q.skill?.aggrF ?? 1)))) - (st.t >= F.jab ? K.jab.pas : 0);
  let tx = st.ball.p[0] + (wx / wl) * gd, tz = st.ball.p[2] + (wz / wl) * gd;
  if (F.mordu && st.t < F.mordu.until) { tx += F.n[0] * F.mordu.cote * K.morsure.decale; tz += F.n[1] * F.mordu.cote * K.morsure.decale; }
  q.job = 'press'; q.target = [tx, 0, tz];
}
