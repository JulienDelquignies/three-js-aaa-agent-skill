// ceremonie.js — L'AVANT-MATCH ET LES GESTES SOCIAUX (Animations_A_Faire § 7 = A11 ter ; cfg.ceremonie && st.full ; note 381).
import { tirage } from './rng.js';
// LA FILE DES POIGNÉES avant le premier engagement (cfg.ceremonie.poignee) : l'équipe qui n'engage pas se range en LIGNE le long de
// la médiane, dans sa moitié (à rang m de la ligne, pas m entre les hommes, le regard vers l'adversaire) ; l'équipe qui engage DÉFILE
// de l'autre côté de la ligne, à son pas : chaque homme qui défile serre la main de celui d'en face À L'ARRIVÉE (tenue s) —
// l'événement 'poignee' (by : celui qui défile, avec : celui de la rangée), les deux se regardent (yawWant) — puis marche jusqu'au
// suivant, sans doubler celui de devant ; au bout de la rangée il trotte à sa place d'engagement (marche × trot) ; les
// hommes de la rangée partent quand le dernier est passé. Les corps sont POSÉS en cérémonie au premier pas (le match n'a pas
// commencé : la seule pose écrite après la construction). L'engagement (r.at) attend que tous soient à ≤ marge m de leur place, ou
// patience s. L'HORLOGE (referee.chronoStep) : la période part au coup d'envoi (st._ceremonie.fin) et la cérémonie n'est pas un arrêt
// de jeu. LE SALUT (cfg.ceremonie.salut) : au coup de sifflet final chaque joueur se tourne vers la tribune (tribune : +1 = z > 0) et
// salue ('salut'), échelonné de pas s. Clé absente : l'hier au bit (st._ceremonie n'existe pas).
import { hyp } from './hyp.js';

const ordre = (st, team) => st.players.filter((q) => q.team === team && !q.expulse && !q._sub).sort((a, b) => a.id - b.id);

/** true tant que la cérémonie POSSÈDE la remise (les postes et les cibles sont les siens ; match-sim saute le bloc de remise). */
export function ceremonieStep(st, cfg) {
  const K = cfg.ceremonie?.poignee, r = st.restart, C = st._ceremonie;
  if (!C) {
    if (!K || !r || r.type !== 'engagement' || st.t > 1.5 || st._ceremonieDone || st._chrono?.periode > 1) return false;
    const R = 1 - r.team, F = r.team, sR = st.pitch.ownGoal(R).sign, rangee = ordre(st, R), file = ordre(st, F), n = rangee.length;
    const pas = K.pas ?? 0.8, rang = K.rang ?? 0.42, espace = K.espace ?? 0.75, decale = K.decale ?? 2.6, zR = (i) => (i - (n - 1) / 2) * pas + decale;   // la rangée décalée du point central : le ballon reste dégagé
    const spots = {}; for (const q of st.players) spots[q.id] = [q.p[0], q.p[2]];
    rangee.forEach((q, i) => { q.p[0] = sR * rang; q.p[2] = zR(i); q.v[0] = 0; q.v[1] = 0; q.yaw = Math.atan2(0, -sR); q.yawWant = null; });
    file.forEach((q, k) => { q.p[0] = -sR * rang; q.p[2] = zR(n - 1) + 0.9 + k * espace; q.v[0] = 0; q.v[1] = 0; q.yaw = -Math.PI / 2; q.yawWant = null; });
    st._ceremonie = { actif: true, t0: st.t, R, F, sR, n, rangee: rangee.map((q) => q.id), file: file.map((q) => q.id), spots, pas, rang, espace, decale, fin: null, nFile: file.length };
    st.events.push({ t: +st.t.toFixed(2), type: 'ceremonie', kind: 'file', rangee: R, file: F, n });
    return ceremonieStep(st, cfg);
  }
  if (!C.actif) return false;
  const { sR, n, pas, rang, espace, decale } = C, tenue = K?.tenue ?? 0.35, zR = (i) => (i - (n - 1) / 2) * pas + decale, xR = sR * rang, xF = -sR * rang, t = st.t - C.t0;
  const aPlace = (q, f) => { q.job = 'walk'; q.target = [C.spots[q.id][0], 0, C.spots[q.id][1]]; q._walkF = f; return hyp(q.p[0] - C.spots[q.id][0], q.p[2] - C.spots[q.id][1]) <= (K?.marge ?? 1.2); };
  C.idx ??= C.file.map(() => n - 1); C.until ??= C.file.map(() => -1); C.done ??= {};
  let tousPlaces = true;
  // LA FILE À SON PAS : chacun serre la main de l'homme d'en face À L'ARRIVÉE (tenue s), puis marche au suivant ; on ne double
  // pas l'homme de devant (on attend à un homme derrière lui) ; au bout de la rangée, trot vers la place d'engagement.
  C.file.forEach((id, k) => {
    const q = st.players[id]; q._walkF = null;
    const i = C.idx[k];
    if (i < 0) { q._regard = null; if (!aPlace(q, K?.trot ?? 2.4)) tousPlaces = false; return; }
    tousPlaces = false; q._regard = Math.atan2(0, sR);                               // le regard tenu vers la rangée : il défile de côté, face à chaque homme
    const iT = k > 0 ? Math.max(i, C.idx[k - 1] + 1) : i;                       // l'homme visé : jamais au-delà de celui de devant
    if (iT > n - 1) { q.job = 'walk'; q.target = [xF, 0, zR(n - 1) + 0.9 + (iT - n) * espace]; return; }   // la queue, qui avance
    const face = st.players[C.rangee[i]], la = iT === i && Math.abs(q.p[2] - zR(i)) < (K?.arrive ?? 0.3) && Math.abs(q.p[0] - xF) < 0.6;
    q.job = 'walk'; q.target = [xF, 0, zR(iT)];
    if (la && !C.done[`${k}_${i}`]) { C.done[`${k}_${i}`] = true; C.until[k] = st.t + tenue; st.events.push({ t: +st.t.toFixed(2), type: 'poignee', by: q.id, avec: face.id, rang: i }); }
    if (C.done[`${k}_${i}`]) { face.yawWant = Math.atan2(0, -sR); if (st.t >= C.until[k]) C.idx[k] = i - 1; }
  });
  C.rangee.forEach((id, i) => {
    const q = st.players[id]; q._walkF = null;
    if (C.idx[C.nFile - 1] < i) { if (!aPlace(q, K?.trot ?? 2.4)) tousPlaces = false; }                 // le dernier de la file est passé : à sa place
    else { q.job = 'walk'; q.target = [xR, 0, zR(i)]; q.yawWant = Math.atan2(0, -sR); tousPlaces = false; }   // en rangée, le regard vers l'adversaire
  });
  if (tousPlaces || t > (K?.patience ?? 60)) {
    C.actif = false; C.fin = st.t; st._ceremonieDone = true; r.at = st.t + (K?.avant ?? 1.2);
    for (const q of st.players) { q._walkF = null; q.yawWant = null; q._regard = null; }
    st.events.push({ t: +st.t.toFixed(2), type: 'ceremonie', kind: 'places', duree: +t.toFixed(1), poignees: Object.keys(C.done).length });
    return false;
  }
  r.at = st.t + 0.5;                                          // l'engagement attend la fin de la cérémonie
  return true;
}

/** LE SALUT AU PUBLIC au coup de sifflet final (cfg.ceremonie.salut) : chacun se tourne vers la tribune et salue, échelonné. */
export function salutStep(st, cfg) {
  const S = cfg.ceremonie?.salut; if (!S) return;
  const Z = st._salut ??= { t0: st.t, done: {} };
  const tribune = S.tribune ?? 1, pas = S.pas ?? 0.15;
  st.players.filter((q) => !q.expulse && !q._sub).forEach((q, k) => {
    if (Z.done[q.id]) { if (st.t > Z.done[q.id] + (S.duree ?? 2.8) + 1) q._regard = null; return; }
    if (st.t < Z.t0 + (S.attente ?? 0.6) + k * pas) return;
    Z.done[q.id] = st.t; q._regard = Math.atan2(tribune, 0);                          // le regard tenu vers la tribune, rendu après le salut
    st.events.push({ t: +st.t.toFixed(2), type: 'salut', by: q.id, tribune, geste: S.applaudir && tirage(st, 'geste', q.id, st.rnd ?? (() => 0.5))() < (S.applaudir === true ? 0.5 : S.applaudir) ? 'applaudir' : 'saluer' });   // (notes 387, 389) certains APPLAUDISSENT la tribune au lieu de saluer — tirés au sort (S.applaudir = la part), pas un sur deux
  });
}
