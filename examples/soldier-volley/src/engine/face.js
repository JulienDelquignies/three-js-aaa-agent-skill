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
// pose le pied sur le ballon réel — la pausa) ; toutes les pause s une FEINTE : le ROULÉ DE SEMELLE (motion-skill.semelleRoule) passe le ballon
// d'un pied à l'autre devant le corps — le buste vend le côté du roulé (au tirage, la feinte de corps semelle dessus ou le passement de la tenue), et le défenseur MORD au tirage (la note de
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
import { ARRIVEE } from './movement.js';

const rnd = (st, id) => tirage(st, 'geste', id, st.rnd ?? (() => 0.5))();
const tir = (a, u) => a[0] + (a[1] - a[0]) * u;
const ROULE = SKILL_KINDS.semelleRoule, ROULE_OUT = SKILL_KINDS.semelleRouleOut, TIRE = SKILL_KINDS.tireSemelle, TIRE_IN = SKILL_KINDS.tireSemelleIn;
const DEV = 0.28;   // m — le ballon sous la semelle, devant le corps (le point du clip : ball[2])
// L'instant où la feinte LAISSE le pied libre pour la sortie : le roulé a fini de rouler (dragEnd) ; le passement a reposé son pied (le cercle
// fini + plant) ; la feinte de corps a passé sa vente (contact + 0,1 s) — la croqueta avant cet instant partirait d'un pied en l'air
const libre = (S) => S.dragEnd ?? (S.circle ? S.entry + S.tour * (S.tours - 0.5) + S.plant : S.contact + 0.1);

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
  st.events.push({ t: +st.t.toFixed(2), type: 'face', phase: 'fin', by: c.id, par: F.par, issue, duree: +(st.t - F.t0).toFixed(2), feintes: F.feintes, mords: F.mords, fente: F.fente ? (F.fente.lu ? 'lue' : F.fente.mordue ? 'mordue' : 'franche') : null, sortie: F.sortie ?? null });
  c._face = null; c._faceCap = null; c._faceCd = st.t + (K.entree.cd ?? 2.5); c._regard = null; c._regardUntil = null;
}

/** Un geste de semelle du face-à-face (le roulé, le tiré) : le ballon suit le chemin du clip en repère personnage (x : la droite, z : devant). */
function semelle(st, c, kind, S, x1, z1, fin = S.dragEnd) {
  const F = c._face, foot = F.pied;   // LE MÊME PIED tout le face-à-face : la semelle ne quitte pas le ballon (aller en travers, retour dehors)
  startGesture(c, { id: kind, duration: S.duration, contact: S.contact }, { payload: { kind: 'skill', skill: kind, pick: { foot }, ownsBody: true, pin: [st.ball.p[0], st.ball.p[2]], face: { x0: F.x, x1, z0: DEV, z1, fin }, ballMax: 0 }, log: st.gestures });
  st.events.push({ t: +st.t.toFixed(2), type: 'windup', by: c.id, move: kind, foot, skill: kind, anticipation: S.contact });
  F.x = x1;
}

/** LA SÉRIE DE PASSEMENTS ALTERNÉS (Mancini contre Réveillère, Roma-Lyon 2007 : un passement toutes les 0,30 s, les jambes alternées, le ballon
 *  quasi immobile entre les pieds) : la semelle roule le ballon au milieu devant le corps, n passements alternés — l'autre pied d'abord (côté −m),
 *  puis celui de la semelle, … —, la semelle le reprend et le ramène à la tenue. Chaque passage se juge (la morsure du côté que la jambe vend). */
function serie(st, c, q, n, dq) {
  const F = c._face, kind = `passementSerie${n}`, S = SKILL_KINDS[kind], T = S.duration, tA = S.entry + n * S.tour + S.lift, bx = F.m * S.ball[0], bz = -S.ball[2];
  startGesture(c, { id: kind, duration: T, contact: S.contact }, { payload: { kind: 'skill', skill: kind, pick: { foot: F.pied }, ownsBody: true, foeId: q.id, ballMax: 0,
    face: { plante: true, chemin: [[0, F.x, DEV], [S.roll, bx, bz], [tA, bx, bz], [T, F.x, DEV]], yaw0: c.yaw, tour: 0, cap: [0, T], dir: [Math.cos(c.yaw), Math.sin(c.yaw)], v: 0 } }, log: st.gestures });
  F.serie = { kind, n, j: 0 }; F.roule = null;
  st.events.push({ t: +st.t.toFixed(2), type: 'windup', by: c.id, move: kind, foot: F.pied, skill: kind, anticipation: S.contact });
  return S;
}

/** Le côté où la semelle RATISSE depuis la tenue : du ballon dehors, en travers devant le corps (−m) ; du ballon croisé, vers l'extérieur (+m). */
const coteRateau = (F) => (F.x * F.m > -0.02 ? -F.m : F.m);

/** LA SORTIE du côté `cote` (+1 = la droite du porteur face au défenseur), vers le côté ouvert du défenseur, en diagonale devant — par
 *  la CROQUETA plantée (le ballon part du côté opposé et traverse, skillFollowStep 'doubleContact'), le RÂTEAU (la semelle ratisse le ballon
 *  de ce côté-là, possible quand c'est le côté où elle ratisse depuis le ballon d'alors) ou la ROULETTE (les deux semelles, le tour complet,
 *  sortie du côté `cote`) ; la sortie explose à sa fin (rondo-sim, sortieBurst). Sans geste nommé : le râteau au tirage (sorties.rateau)
 *  quand le côté s'y prête, la croqueta sinon. */
function sortir(st, c, q, cote, issue, K, geste = null) {
  const F = c._face;
  // LA SORTIE VISE LE CÔTÉ OUVERT DU DÉFENSEUR, VERS LE BUT : un point à cote.lat m de son flanc et cote.au m au-delà de lui (côté but) —
  // tirée de l'axe porteur-défenseur seul, la croqueta partait de biais et la conduite qui suivait (vers le but) laissait le ballon (capture)
  const g = st.pitch.attackGoal(c.team), gx = g.x - q.p[0], gz = -q.p[2], gl = hyp(gx, gz) || 1;
  const ax = q.p[0] + F.n[0] * cote * K.sortie.lat + (gx / gl) * K.sortie.au, az = q.p[2] + F.n[1] * cote * K.sortie.lat + (gz / gl) * K.sortie.au;
  const exitYaw = Math.atan2(az - c.p[2], ax - c.p[0]), SK = K.sorties;
  if (F.serie) geste = 'croqueta';   // (la série) le ballon au milieu, la semelle loin de lui : ni râteau ni roulette, la croqueta le prend où il est
  if (!geste) geste = SK && cote === coteRateau(F) && rnd(st, c.id) < SK.rateau ? 'rateau' : 'croqueta';
  if (busy(c)) abortGesture(c, 'face-sortie', { log: st.gestures });
  if (geste !== 'croqueta') {   // LE RÂTEAU, LA ROULETTE : le chemin du ballon en repère personnage (les points des clips : x la droite, z devant), le cap, l'élan
    const m = F.m, d = ((exitYaw - c.yaw + 3 * Math.PI) % (2 * Math.PI)) - Math.PI, fx = Math.cos(c.yaw), fz = Math.sin(c.yaw);
    const bx = (st.ball.p[0] - c.p[0]) * -fz + (st.ball.p[2] - c.p[2]) * fx, bz = (st.ball.p[0] - c.p[0]) * fx + (st.ball.p[2] - c.p[2]) * fz, dehors = bx * m > -0.02;   // le ballon RÉEL en repère personnage (un roulé coupé l'a laissé en chemin)
    const kind = geste === 'roulette' ? 'rouletteFace' : dehors ? 'rateauFace' : 'rateauFaceIn', S = SKILL_KINDS[kind], T = S.duration;
    const chemin = geste === 'roulette'
      ? [[0, bx, bz], [S.contact, dehors ? m * S.ball[0] : F.x, DEV], [S.drag1End, m * S.drag1[0], -S.drag1[1]], [(S.drag1End + S.on2) / 2, m * (S.drag1[0] + S.ball2[0]) / 2, -S.drag1[1] - 0.04], [S.on2, m * S.ball2[0], -S.ball2[1]], [S.drag2End, m * S.drag2[0], -S.drag2[1]], [T, 0, 0.38]]
      : [[0, bx, bz], [S.contact, m * S.ball[0], DEV], [S.dragEnd, m * S.dragX, -S.dragTo], [T, 0, 0.4]];
    const tour = geste === 'roulette' ? -Math.sign(d || cote) * (2 * Math.PI - Math.abs(d)) : d;   // la roulette tourne d'abord à l'opposé de la sortie (le dos au défenseur au demi-tour), finit face à elle
    c._faceSortie = { dir: [Math.cos(exitYaw), Math.sin(exitYaw)], t: st.t + T };
    startGesture(c, { id: kind, duration: T, contact: S.contact }, { payload: { kind: 'skill', skill: kind, pick: { foot: F.pied }, ownsBody: true, foeId: q.id, ballMax: 0,
      face: { chemin, yaw0: c.yaw, tour, cap: geste === 'roulette' ? [S.drag1End - 0.06, T] : [S.contact, T], dir: [Math.cos(exitYaw), Math.sin(exitYaw)], v: K.sortie.v?.[geste] ?? 2.2,
        ...(geste === 'roulette' ? { pivots: [[0, -0.175 * m, 0.07], [S.plantR, 0.215 * m, 0.11]], libre: S.drag2End } : {}) } }, log: st.gestures });
    (c._skillCd ??= {}).double = st.t + 2; c._dribAt = st.t;
    st.events.push({ t: +st.t.toFixed(2), type: 'windup', by: c.id, move: kind, foot: F.pied, skill: kind, anticipation: S.contact });
    st.events.push({ t: +st.t.toFixed(2), type: 'skill', kind, by: c.id, foe: +hyp(q.p[0] - c.p[0], q.p[2] - c.p[2]).toFixed(2), face: issue });
    if (F.fente && !F.fente.contact) q._fenteDue = { Fn: F.fente, c: c.id };   // le défenseur qui CHARGE est engagé : sa fente part quand même (dans le vide que la sortie laisse)
    F.sortie = geste; return fin(st, c, issue, K);
  }
  c._faceSortie = { dir: [Math.cos(exitYaw), Math.sin(exitYaw)], t: st.t + MOVE_TIMING.doubleContact.duration };
  const foot = footFor(byId.crochet, situation(c.p, c.yaw, st.ball.p, [0, 0], st.ball.p[1])), move = MOVE_TIMING.doubleContact;
  startGesture(c, { id: 'doubleContact', ...move }, { payload: { kind: 'skill', skill: 'doubleContact', pick: { foot }, ownsBody: true, yaw0: c.yaw, exitYaw, away: cote, v0: Math.max(1.2, c.speed), foeId: q.id, ballMax: 0, face: true }, log: st.gestures });
  (c._skillCd ??= {}).double = st.t + 2; c._dribAt = st.t;
  st.events.push({ t: +st.t.toFixed(2), type: 'windup', by: c.id, move: 'doubleContact', foot, skill: 'doubleContact', anticipation: move.contact });
  st.events.push({ t: +st.t.toFixed(2), type: 'skill', kind: 'doubleContact', by: c.id, foe: +hyp(q.p[0] - c.p[0], q.p[2] - c.p[2]).toFixed(2), face: issue });
  F.sortie = 'croqueta'; fin(st, c, issue, K);
}

/** LA FENTE qui s'annonce : le défenseur CHARGE son appui (charge s), vers `cible` (fixée maintenant — il s'engage sur le ballon d'alors) ;
 *  le porteur la lit (ou pas) pendant la charge. */
function fente(st, q, c, cible, mordue, K) {
  const F = c._face;
  const pLu = mordue ? 0 : Math.min(0.9, K.lecture * (c.skill?.anticipF ?? 1) * (2 - (q.skill?.tacleTempoF ?? 1)));   // la fente mordue part déjà du mauvais côté : rien à lire
  F.fente = { t: st.t, cible, mordue, lu: rnd(st, c.id) < pLu ? st.t + (c.skill?.reaction ?? 0.18) * 0.7 : null, tire: false, part: st.t + K.fente.charge, contact: null, juge: false };
  st.events.push({ t: +st.t.toFixed(2), type: 'face', phase: 'charge', by: c.id, par: q.id, fente: mordue ? 'mordue' : 'patience', lue: F.fente.lu != null });
}

function lancerFente(st, q, c, K, cfg, Fn = c._face.fente) {
  const move = MOVE_TIMING.tacleDebout, dx = Fn.cible[0] - q.p[0], dz = Fn.cible[1] - q.p[2], d = hyp(dx, dz) || 1;
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
    // IL VA LE CHERCHER : le porteur qui va à peu près vers lui (≤ dos °) l'attaque même s'il monte presser (attaqué de face, le défenseur se remet
    // en garde : cfg.jockeyConduite) ; DOS à lui, il se RETOURNE pour lui faire face s'il en a le temps — le défenseur à ≥ tourne m, à ≥ temps s
    // de son arrivée. Mesuré avant : défenseur côté but dans 76 % des possessions de champ, le porteur lui tournait le dos 42 % du temps (52 % à
    // 2-4 m — l'évasion du 11c11) ; la porte « il tient » (fermeture < 2 m/s) refusait 41 % des départs : 1,2 face-à-face/min
    const ferme = -(D.q.v[0] * ux0 + D.q.v[1] * uz0), vers = ux0 * hx + uz0 * hz >= Math.cos((A.dos ?? 110) * Math.PI / 180);
    if (!vers && !(D.d >= (A.tourne ?? 3.5) && (D.d - 1.5) / Math.max(0.5, ferme) >= (A.temps ?? 0.8))) return;
    c._faceApp = { par: D.q.id, t0: st.t, tourne: !vers, go: rnd(st, c.id) < E.envie[0] + E.envie[1] * (c.persona?.flair ?? 0.5) };
  }
  if (!c._faceApp.go || st.t - c._faceApp.t0 > (A.max ?? 3.5)) return;
  const ux = (D.q.p[0] - c.p[0]) / D.d, uz = (D.q.p[2] - c.p[2]) / D.d;
  // LE DEMI-TOUR SEMELLE : dos à lui, le ballon DANS sa course (≤ demiBallon m devant), assez lent (≤ demiV m/s) et le temps de se retourner avant
  // son arrivée — la semelle tire le ballon et le corps pivote FACE à lui (le râteau : motion-skill.rateau, skillFollowStep) ; le face-à-face
  // s'enchaîne. Mesuré (dos-debut) : dos au défenseur, la poussée tournée vers lui ne suffisait pas — lancé, chaque touche renvoyait le ballon
  // dans sa course (le cône du porté), il fuyait malgré lui, le défenseur aux trousses (57 % du temps à 2-4 m)
  if (c._faceApp.tourne) {
    const bx = st.ball.p[0] - c.p[0], bz = st.ball.p[2] - c.p[2], db = hyp(bx, bz), sp = Math.max(0.3, c.speed), dans = (bx * c.v[0] + bz * c.v[1]) / (db * sp || 1);
    const arrive = (D.d - 1.2) / Math.max(0.5, -(D.q.v[0] * ux + D.q.v[1] * uz));
    if (db <= (A.demiBallon ?? 0.8) && dans > 0.5 && c.speed <= (A.demiV ?? 2.8) && arrive >= (A.temps ?? 0.65) && st.ball.p[1] < 0.3) {
      const foot = footFor(byId.rateau, situation(c.p, c.yaw, st.ball.p, [0, 0], st.ball.p[1])), move = MOVE_TIMING.rateau, exitYaw = Math.atan2(uz, ux);
      if (st.ball.owner !== c.id) st.ball.possess(c.id);
      startGesture(c, { id: 'rateau', ...move }, { payload: { kind: 'skill', skill: 'rateau', pick: { foot }, ownsBody: true, yaw0: c.yaw, exitYaw, ballMax: 0, pinRel: 0.32, demiTour: true }, log: st.gestures });
      (c._skillCd ??= {}).rateau = st.t + 2; c.intent = null; c._dribAt = st.t; c._faceApp.tourne = false;
      st.events.push({ t: +st.t.toFixed(2), type: 'windup', by: c.id, move: 'rateau', foot, skill: 'rateau', anticipation: move.contact });
      st.events.push({ t: +st.t.toFixed(2), type: 'skill', kind: 'rateau', by: c.id, foe: +D.d.toFixed(2), demiTour: true });
      return;
    }
    c._faceCap = Math.max(1.2, Math.min(c._faceCap ?? 9, A.demiV ?? 2.8)); return;   // dos à lui : on lève le pied pour pouvoir se retourner (la conduite garde son ballon)
  }
  c.push = [ux, uz]; c.target = [c.p[0] + ux * 3, 0, c.p[2] + uz * 3];
  c._faceCap = Math.max(A.cap[0], Math.min(A.cap[1], A.cap[0] + (A.pente ?? 0.35) * (D.d - A.d[0])));
}

/** Une image, AVANT le mouvement (cfg.avantMouvement, après les cibles d'assignJobs) : l'entrée, l'approche, la tenue, les roulés, la
 *  garde, la fente (la charge, le glissé de l'armé), la lecture, la sortie. */
export function faceAvant(st, cfg) {
  const K = cfg.face, E = K.entree, dt = Math.max(0, Math.min(0.05, st.t - (st._faceT ?? st.t))); st._faceT = st.t;
  for (const q of st.players) {   // LA FENTE : le glissé de l'armé (movePlayers se tait, ce pas l'écrit), puis au contact passé — manquée — la CHUTE au tirage
    const G = q.act?.payload?.fente; if (!G) continue;
    if (!q.act.fired) {
      if (G.reste > 0) { const s = Math.min(G.v * dt, G.reste); q.p[0] += G.u[0] * s; q.p[2] += G.u[1] * s; G.reste -= s; }
      // LA FENTE EST ENGAGÉE : la jambe part sur sa ligne (vers le ballon d'alors) — elle ne gagne que le ballon resté dans son COULOIR (fente.couloir m
      // de part et d'autre, pas derrière le tacleur) ; hors couloir, le contact est dans le vide (rondo-sim.standTackleNow lit fente.vide). La portée
      // RADIALE seule gagnait le ballon que la semelle venait de ratisser à 0,5 m sur le côté (face-feintes : 3 râteaux sur 24 repris ainsi, à +0,35 s)
      if (K.fente.couloir != null) { const bx = st.ball.p[0] - q.p[0], bz = st.ball.p[2] - q.p[2]; G.vide = Math.abs(bx * G.u[1] - bz * G.u[0]) > K.fente.couloir || bx * G.u[0] + bz * G.u[1] < -0.2; }
      continue;
    }
    if (G.juge) continue; G.juge = true;
    if (st.possession?.carrier === q.act.payload.victim) { if (rnd(st, q.id) < G.chute) chuter(st, q, null, cfg, 'fente', 1.2); else q._bite = Math.max(q._bite ?? -1, st.t + 0.45); }
  }
  for (const q of st.players) if (q._fenteDue && st.t >= q._fenteDue.Fn.part) { const D = q._fenteDue; q._fenteDue = null; if (!busy(q) && q.down <= 0) lancerFente(st, q, st.players[D.c], K, cfg, D.Fn); }
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
  // LA SÉRIE : au milieu de chaque passement (le pied par-dessus le ballon), une morsure s'arme du côté que la jambe vend — l'autre pied d'abord (−m),
  // puis alterné ; la dernière vente plus appuyée. Le pied se repose à la fin du passement (libre) : la sortie sur la morsure l'attend
  if (F.serie && A?.skill !== F.serie.kind) F.serie = null;
  if (F.serie) { const S = SKILL_KINDS[F.serie.kind], j = F.serie.j, FS = K.feintes.serie;
    if (j < F.serie.n && c.act.t >= S.entry + (j + 0.5) * S.tour) {
      F.serie.j++; F.feintes++;
      F.roule = { cote: F.m * (j % 2 === 0 ? -1 : 1), t: st.t, juge: false, kind: F.serie.kind, vente: j === F.serie.n - 1 ? FS.venteFin : FS.vente, libre: S.entry + (j + 1) * S.tour, serie: true };
      st.events.push({ t: +st.t.toFixed(2), type: 'skill', kind: 'passementSerie', n: F.serie.n, passage: j + 1, by: c.id, foe: +hyp(q.p[0] - c.p[0], q.p[2] - c.p[2]).toFixed(2), face: F.feintes });   // (une feinte par passage)
    } }
  // LA FENTE : la charge, la lecture (le tiré de semelle), le départ, puis le jugement du contact
  if (Fn) {
    const piedLibre = !busy(c) || !F.roule || A?.skill !== F.roule.kind || c.act.t >= F.roule.libre;   // (une semelle en plein roulé ne ratisse pas : la réponse attend la fin du roulé — trop tard, la fente gagne)
    if (F.serie && Fn.lu != null && !Fn.tire && st.t >= Fn.lu && piedLibre && !Fn.repondu) { Fn.repondu = true; return sortir(st, c, q, (dx * F.n[0] + dz * F.n[1]) > 0 ? -1 : 1, 'fente-lue', K, 'croqueta'); }   // (la série) la semelle loin du ballon : la croqueta du côté ouvert, dès que le pied se repose
    if (Fn.lu != null && !Fn.tire && st.t >= Fn.lu && K.sorties && piedLibre && !Fn.repondu) {   // LA FENTE LUE, trois réponses au tirage, chacune du côté OUVERT (à l'opposé du flanc du défenseur) : la ROULETTE (geste de flair ; pivot sur le pied de semelle → elle sort de SON côté, +m), le RÂTEAU (la semelle ratisse le ballon hors du couloir de la fente et part avec), le TIRÉ (plus bas)
      Fn.repondu = true; const u = rnd(st, c.id), ouvert = (dx * F.n[0] + dz * F.n[1]) > 0 ? -1 : 1, pR = ouvert === F.m ? K.sorties.roulette * (0.6 + 0.8 * (c.persona?.flair ?? 0.5)) : 0, pA = coteRateau(F) === ouvert ? K.sorties.rateau : 0;
      if (u < pR) return sortir(st, c, q, F.m, 'roulette-fente', K, 'roulette');
      if (u < pR + pA) return sortir(st, c, q, ouvert, 'rateau-fente', K, 'rateau');
    }
    if (Fn.lu != null && !Fn.tire && st.t >= Fn.lu && !F.serie) { Fn.tire = true; if (busy(c)) abortGesture(c, 'face-tire', { log: st.gestures }); const dehors = F.x * F.m > -0.02, S = dehors ? TIRE : TIRE_IN; semelle(st, c, dehors ? 'tireSemelle' : 'tireSemelleIn', S, F.m * S.dragX, -S.dragTo); }   // le clip tire le ballon de (ball[0], ball[2]) à (dragX, dragTo) — z < 0 devant ; depuis le ballon dehors ou croisé
    if (!Fn.contact && st.t >= Fn.part && q.down <= 0 && !busy(q)) lancerFente(st, q, c, K, cfg);
    if (Fn.contact && !Fn.juge && st.t > Fn.contact + 0.02) {   // le ballon toujours à lui : manquée — au SOL (tirage) ou déséquilibré, puis la sortie
      Fn.juge = true;   // (la chute s'est jugée sur la fente elle-même, en tête d'image)
      return sortir(st, c, q, ((st.ball.p[0] - c.p[0]) * F.n[0] + (st.ball.p[2] - c.p[2]) * F.n[1]) >= 0 ? 1 : -1, Fn.lu ? 'fente-lue' : Fn.mordue ? 'fente-mordue' : 'fente-manquee', K);
    }
  }
  // LA MORSURE : au contact de la feinte (le roulé, la vente de la feinte de corps, le passage du passement), le défenseur mord (ou non) du côté
  // VENDU ; mordu, il peut se jeter de ce côté-là
  if (F.roule && !F.roule.juge && A?.skill === F.roule.kind && (c.act.fired || F.roule.serie)) {
    F.roule.juge = true;
    const pM = Math.min(0.85, (K.morsure.base + K.morsure.cumul * (F.feintes - 1)) * F.roule.vente * (c.skill?.gesteF ?? 1) * (2 - (q.skill?.anticipF ?? 1)));
    if (!Fn && !busy(q) && q.down <= 0 && rnd(st, q.id) < pM) {
      F.mords++; q._bite = st.t + K.morsure.duree * (c.skill?.gesteF ?? 1); F.mordu = { t: st.t, cote: F.roule.cote, until: q._bite };
      q.v[0] = F.n[0] * F.roule.cote * K.morsure.elan; q.v[1] = F.n[1] * F.roule.cote * K.morsure.elan;   // LE PAS DU MAUVAIS CÔTÉ : le mordu lance son appui vers le côté vendu (l'élan s'amortit sous le ralenti de la morsure) — assis sur place, il se lisait figé (verify-duel : 1,43 s)
      if (rnd(st, q.id) < K.fente.surMorsure) fente(st, q, c, [st.ball.p[0] + F.n[0] * F.roule.cote * K.fente.suite, st.ball.p[2] + F.n[1] * F.roule.cote * K.fente.suite], true, K);   // il se jette sur la SUITE vendue (le ballon qui continuerait du côté du roulé)
    }
  }
  // LA SORTIE SUR LA MORSURE : la feinte a laissé le pied libre, le mordu glisse du côté vendu → de l'autre côté
  const rouleFini = !busy(c) || (F.roule && A?.skill === F.roule.kind && c.act.t >= F.roule.libre);
  if ((!F.fente || F.fente.mordue) && F.mordu && (rouleFini || F.fente) && st.t - F.mordu.t > (c.skill?.reaction ?? 0.18) * 0.7 && st.t < F.mordu.until) return sortir(st, c, q, -F.mordu.cote, F.fente ? 'fente-mordue' : 'mordu', K);   // la fente MORDUE se punit tout de suite : il part de l'autre côté pendant qu'elle s'engage (attendre son contact la laissait gagner 5 fois sur 5)
  if (!F.fente && !busy(c) && age > K.max) return sortir(st, c, q, ((st.ball.p[0] - q.p[0]) * F.n[0] + (st.ball.p[2] - q.p[2]) * F.n[1]) >= 0 ? 1 : -1, 'expire', K);
  // LA FEINTE SUIVANTE : planté, toutes les pause s — au tirage (feintes : la part de chacune ; le passement, geste de flair, selon le flair) :
  // le ROULÉ (le ballon passe devant le corps, d'un pied à l'autre — vendu du côté où il roule), la FEINTE DE CORPS semelle dessus (le ballon
  // ne bouge pas, le corps vend un départ du côté de l'appui : −m), le PASSEMENT de la tenue (la jambe cercle par-dessus le ballon immobile,
  // depuis le ballon dehors — le corps se penche et tourne du côté du pied qui passe : +m). Clé feintes absente : les roulés seuls (l'hier)
  if ((!busy(c) || (A?.skill === 'semelleFace' && c.act.t >= SKILL_KINDS.arretSemelle.hold)) && !F.fente && st.t >= F.prochain) {   // (le premier enchaîne sur la tenue de l'arrêt semelle, le pied encore dessus)
    if (busy(c)) abortGesture(c, 'face-roule', { log: st.gestures });
    const dehors = F.x * F.m > -0.02, FK = K.feintes, u = FK ? rnd(st, c.id) : 1;
    const pP = FK && dehors ? FK.passement.p * (0.6 + 0.8 * (c.persona?.flair ?? 0.5)) : 0, pC = FK ? FK.corps.p : 0;
    let kind, S, x1 = F.x, cote, vente = 1;
    const fl = c.persona?.flair ?? 0.5;
    if (u < pP && FK.serie && rnd(st, c.id) < FK.serie.part * (0.5 + fl)) {   // LA SÉRIE (Mancini) : le passement du flair se répète, 2 à 4 passements alternés selon le flair
      const nS = Math.min(4, 2 + Math.floor(rnd(st, c.id) * (1 + 2 * fl))), S2 = serie(st, c, q, FK.serie.n ?? nS, dq);   // (serie.n : un nombre fixé — la démonstration) F.prochain = st.t + S2.duration + tir(K.pause, rnd(st, c.id));
    } else {
      if (u < pP) { kind = 'passementFace'; S = SKILL_KINDS.passementFace; cote = F.m; vente = FK.passement.vente; }
      else if (u < pP + pC) { kind = dehors ? 'feinteSemelle' : 'feinteSemelleIn'; S = SKILL_KINDS[kind]; cote = -F.m; vente = FK.corps.vente; }
      else { kind = dehors ? 'semelleRoule' : 'semelleRouleOut'; S = dehors ? ROULE : ROULE_OUT; x1 = F.m * S.dragX; cote = Math.sign(x1 - F.x); }
      F.feintes++; F.roule = { cote, t: st.t, juge: false, kind, vente, libre: libre(S) };
      semelle(st, c, kind, S, x1, DEV, S.dragEnd ?? S.duration);
      F.prochain = st.t + S.duration + tir(K.pause, rnd(st, c.id));
      st.events.push({ t: +st.t.toFixed(2), type: 'skill', kind: /^semelleRoule/.test(kind) ? 'semelleRoule' : kind, by: c.id, foe: +dq.toFixed(2), face: F.feintes });
    }
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
  // LE PAS VISE AU-DELÀ DE LA BANDE MORTE (movement.ARRIVEE) : une cible à moins de 0,18 m ne met pas le corps en marche — le jab (0,35 m) laissait le
  // défenseur arrêté à mi-chemin, à 0,17 m de la garde ET du jab : immobile jusqu'à la fente (verify-duel, graine 5 : 0,9 s), les jabs suivants invisibles
  const ex = tx - q.p[0], ez = tz - q.p[2], ed = hyp(ex, ez); if (ed > 0.06) { tx += ex / ed * ARRIVEE; tz += ez / ed * ARRIVEE; }
  q.job = 'press'; q.target = [tx, 0, tz];
}
