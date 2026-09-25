// pas — L'HORLOGE DE FOULÉE VIT DANS LA SIMULATION (2026-09-24, cfg.pas && st.full ; absente : le monde d'hier au bit).
//
// Mesuré dans le duel (sonde conduite-rendu, 60 s) : la sim décidait ses touches de conduite à la DISTANCE (le ballon « au pied »
// à < prise, une foulée de 0,55 m entre deux), sans savoir où étaient les pieds rendus — deux touches par pas (45 touches pour 23
// appuis), le pied qui « jouait » à 0,7 m du ballon (p50 ; 1,1 m au p90) à l'instant de la touche, en milieu de vol et DERRIÈRE
// l'autre pied 28 fois sur 44 ; le rendu tirait le pied vers le ballon sur 0,2 s (au plus 42 cm) : le contact ne se voyait jamais,
// et le ballon traversait les pieds (188 images). La cause n'est pas un réglage : deux horloges. Ici UNE : la sim tient la phase
// de foulée de chaque joueur avec les lois mêmes du rendu (gait.js, motion-gait : cadence de la vitesse, de la direction, de la
// jambe, du frein, du virage, du pivot), la scène la donne au contrôleur (pasFinal, comme rootFinal pour la position et le lacet)
// et la conduite ne touche le ballon QU'AVEC le pied qui l'atteint en vol (pasContact : les pieds mêmes du générateur, tabulés ; dribble.js).
import { strideLaw } from './gait.js';
import { gaitCadenceFactor, gaitLegFactor, gaitBrakeCadence, gaitTurnCadence, gaitPivotCadence, gaitPortrait, LEG_REF } from './motion-gait.js';
import { SHANON_PROFILE } from './motion-profile-shanon.js';
import { hyp } from './hyp.js';

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/** Avance l'horloge de foulée de chaque joueur d'un pas de temps — sur le DÉPLACEMENT RÉEL du corps (celui que le rendu verra :
 *  les contraintes du monde, la séparation, le glissement d'un geste compris), mesuré comme le contrôleur le mesure
 *  (_measureAccel : frein et virage lissés τ 0,15 s en repère corps, lacet lissé τ 0,1 s). Phase initiale décalée par joueur. */
export function pasStep(st, dt) {
  for (const p of st.players) {
    pasTouchePorte(st, p);   // la touche du porté, sur la phase de ce pas de temps (avant qu'elle n'avance)
    const P = p._pas ??= { phi: (p.id * 0.37) % 1, brake: 0, turn: 0, yawRate: 0, prev: [p.p[0], p.p[2]], vPrev: [0, 0], yawPrev: p.yaw, T: 1, f: 1, vF: 0, vR: 0, v: 0 };
    const dtc = Math.max(1e-3, dt);
    let vx = (p.p[0] - P.prev[0]) / dtc, vz = (p.p[2] - P.prev[1]) / dtc;
    if (hyp(vx, vz) > 14) { vx = p.v[0]; vz = p.v[1]; }                 // un téléport de scène (remise en place) n'est pas une course
    P.prev = [p.p[0], p.p[2]];
    const ax = (vx - P.vPrev[0]) / dtc, az = (vz - P.vPrev[1]) / dtc; P.vPrev = [vx, vz];
    const dy = wrap(p.yaw - P.yawPrev); P.yawPrev = p.yaw;
    P.yawRate += (dy / dtc - P.yawRate) * (1 - Math.exp(-dtc / 0.1));
    const fx = Math.cos(p.yaw), fz = Math.sin(p.yaw), vF = vx * fx + vz * fz, vR = -vx * fz + vz * fx, v = hyp(vx, vz);
    const fwd = vF > 1.5 && Math.abs(vR) < vF && hyp(ax, az) < 40, aF = ax * fx + az * fz, aR = -ax * fz + az * fx, k = 1 - Math.exp(-dtc / 0.15);
    P.brake += ((fwd ? Math.max(0, Math.min(1, -aF / 6)) : 0) - P.brake) * k;
    P.turn += ((fwd ? Math.max(-9, Math.min(9, aR)) : 0) - P.turn) * k;
    let f = strideLaw(v) * gaitCadenceFactor(vF, vR) * gaitLegFactor(p.legK ?? 1, v) * gaitBrakeCadence(P.brake) * gaitTurnCadence(P.turn);
    const fp = gaitPivotCadence(P.yawRate); if (fp > f) f = fp;
    P.phiPrev = P.phi; P.phi = (P.phi + f * dt) % 1; P.f = f; P.T = 1 / Math.max(0.05, f); P.vF = vF; P.vR = vR; P.v = v;
    // LE REGISTRE DES TOUCHES (une par VOL) se rouvre quand un vol COMMENCE — pas quand le pied « est au sol » à l'échantillon le plus proche :
    // à la pose, la touche balayée sur la fin du vol et la remise à zéro se chevauchaient (60 doublons sur 219 touches, même pied à 0,02-0,12 s)
    { const g = geo(P.v), i = Math.floor(P.phi * N_GEO) % N_GEO; P.joue ??= {}; P.volAvant ??= {};
      for (const k of ['left', 'right']) { const vol = g[i][k].vol; if (vol && P.volAvant[k] === false) P.joue[k] = false; P.volAvant[k] = vol; } }
    // (2026-09-25) LE PIED QUI VISE : le porteur en course nomme le pied qui va jouer le ballon — celui du rendez-vous planifié tant qu'il court,
    // sinon (première touche après le porté ou une prise, ballon à portée) le prochain pied à se poser — et le rendu l'AMÈNE au ballon sur la fin
    // de son vol (gaitPose, opts.vise) : sans lui, 47 des 57 touches de rattrapage (sans plan) se jouaient pied à ~0,35 m du ballon, surtout en virage
    if (P.rdv) { P.rdv.reste -= dt; if (P.rdv.reste < -0.15) P.rdv = null; }
    P.vise = null;
    if (st.phase === 'carry' && st.possession?.carrier === p.id && !p.act && P.v >= 1.0) {
      if (P.rdv) P.vise = P.rdv.pied;
      else if (Math.hypot(st.ball.p[0] - p.p[0], st.ball.p[2] - p.p[2]) < 0.8) {
        const g = geo(P.v), i = Math.floor(P.phi * N_GEO) % N_GEO, fin = (k) => { for (let j = 1; j <= N_GEO; j++) if (!g[(i + j) % N_GEO][k].vol) return g[i][k].vol ? j : 99; return 99; };
        const fl = fin('left'), fr = fin('right'); if (Math.min(fl, fr) < 99) P.vise = fl <= fr ? 'left' : 'right';
      }
    }
  }
}

/** LES PIEDS DU GÉNÉRATEUR, tabulés (2026-09-24) : où sont la cheville et la tête des métatarses de chaque pied, par phase, relativement à la
 *  racine (avant, droite), en longueurs de jambe — le portrait même de la foulée rendue (gaitPortrait, profil de référence, griffé), par
 *  pas de 0,25 m/s, calculé une fois. Un chemin de vol cartésien (la cloche horizontale) plaçait le pied 0,2-0,3 m trop en avant en
 *  milieu de vol : le vol articulaire laisse le pied DERRIÈRE (genou plié) et ne le ramène qu'à la fin — la sim touchait un ballon que le
 *  pied rendu n'atteignait pas. Mis à l'échelle de la jambe du joueur (LEG_REF / legK : la jambe que la cadence suppose). */
const N_GEO = 48, GEO = new Map(), L0 = SHANON_PROFILE.lengths.thigh + SHANON_PROFILE.lengths.shank, H0 = SHANON_PROFILE.bones.LeftFoot.bindP[1];
function geo(v) {
  const k = Math.round(Math.max(0.5, Math.min(9, v)) * 4) / 4;
  let g = GEO.get(k); if (g) return g;
  const pr = gaitPortrait(SHANON_PROFILE, { vF: k, vR: 0, opts: { griffe: 1 }, n: N_GEO });
  const pied = (F, ft) => ({ vol: ft.phase === 'swing', ch: [-F.ankle[2] / L0, F.ankle[0] / L0], or: [-F.toe[2] / L0, F.toe[0] / L0], h: (F.ankle[1] - H0) / L0 });
  g = pr.frames.map((f) => ({ left: pied(f.L, f.feet.Left), right: pied(f.R, f.feet.Right) }));
  GEO.set(k, g); return g;
}
/** (2026-09-25) LA POSTURE DE VIRAGE dans le repère du corps : en virage le générateur fait glisser le bassin vers l'intérieur (0,07·a/g) et
 *  écarte le pied extérieur (cL, cR de gaitPose) — la table, tirée en ligne droite, l'ignorait. Décalage latéral (m, + = droite) de ce pied. */
export function pasVirage(P, cote) {
  const inG = Math.max(-9, Math.min(9, P.turn ?? 0)) / 9.81;
  return 0.07 * inG + (cote === 'left' ? 0.05 * inG - 0.04 * Math.max(0, inG) : 0.05 * inG + 0.04 * Math.max(0, -inG));
}
/** Le pied qui ATTEINT le ballon à ce pas de temps : pour chaque pied EN VOL, la distance du centre du ballon (repère corps : avant bA, droite bD)
 *  au cou-de-pied (le segment cheville → métatarses), balayée entre la phase précédente et celle-ci (un pied de fin de vol file à 2·v :
 *  une image l'aurait fait sauter par-dessus), le pied assez BAS pour toucher (cheville à moins de `bas` au-dessus de sa hauteur debout).
 *  Renvoie { pied, d } — le plus proche — ou null. */
export function pasContact(p, bA, bD, { bas = 0.16 } = {}) {
  const P = p._pas; if (!P || P.phiPrev == null) return null;
  const g = geo(P.v), Lp = LEG_REF / (p.legK ?? 1), dph = ((P.phi - P.phiPrev) % 1 + 1) % 1;
  const seg = (a, b) => { const ux = b[0] - a[0], uz = b[1] - a[1], l2 = ux * ux + uz * uz || 1e-9, t = Math.max(0, Math.min(1, ((bA - a[0]) * ux + (bD - a[1]) * uz) / l2)); return Math.hypot(bA - a[0] - ux * t, bD - a[1] - uz * t); };
  let best = null;
  for (let k = 0; k <= 4; k++) {
    const ph = (P.phiPrev + dph * k / 4) % 1, x = ph * N_GEO, i0 = Math.floor(x) % N_GEO, i1 = (i0 + 1) % N_GEO, f = x - Math.floor(x);
    for (const cote of ['left', 'right']) {
      const A = g[i0][cote], B = g[i1][cote]; if (!A.vol || !B.vol) continue;
      const dv = pasVirage(P, cote), lerp2 = (u, v2) => [(u[0] + (v2[0] - u[0]) * f) * Lp, (u[1] + (v2[1] - u[1]) * f) * Lp + dv];   // (virage) la posture
      if ((A.h + (B.h - A.h) * f) * Lp > bas) continue;
      const d = seg(lerp2(A.ch, B.ch), lerp2(A.or, B.or));
      if (!best || d < best.d) best = { pied: cote, d };
    }
  }
  return best;
}
/** L'état des pieds à cet instant : au sol (appui ou pelage — leur vol suivant pourra de nouveau toucher) et EN FIN DE VOL (le pied qui va se
 *  poser dans moins de `fin` de cycle : le plus en avant, celui qui joue le ballon quand aucun pied ne l'a rejoint exactement). */
export function pasEtat(p, { fin = 0.07 } = {}) {
  const P = p._pas; if (!P) return null;
  const g = geo(P.v), i = Math.round(P.phi * N_GEO) % N_GEO, j = Math.round((P.phi + fin) * N_GEO) % N_GEO;
  return { appui: { left: !g[i].left.vol, right: !g[i].right.vol }, finVol: { left: g[i].left.vol && !g[j].left.vol, right: g[i].right.vol && !g[j].right.vol } };
}
/** LA TOUCHE PLANIFIÉE SUR LA FOULÉE (2026-09-24) : les prochains instants où chaque pied FINIT son vol (le point de contact d'une touche —
 *  le cou-de-pied juste avant la pose), sur `cycles` cycles, et où il sera alors dans le repère du corps (avant, droite, m) — le vrai
 *  dribbleur envoie son ballon là où son pied va se poser. [{ pied, t (s), avant, droite }], triés par t. */
export function pasProchains(p, { cycles = 3, avantPose = 0.04 } = {}) {
  const P = p._pas; if (!P) return [];
  const g = geo(P.v), Lp = LEG_REF / (p.legK ?? 1), out = [];
  for (const cote of ['left', 'right']) {
    // la phase de pose de ce pied dans le tableau (vol → appui), le contact un peu avant (avantPose de cycle)
    let iPose = -1; for (let i = 0; i < N_GEO; i++) if (g[i][cote].vol && !g[(i + 1) % N_GEO][cote].vol) { iPose = (i + 1) % N_GEO; break; }
    if (iPose < 0) continue;
    const phC = ((iPose / N_GEO - avantPose) % 1 + 1) % 1, x = phC * N_GEO, i0 = Math.floor(x) % N_GEO, i1 = (i0 + 1) % N_GEO, f = x - Math.floor(x), A = g[i0][cote], B = g[i1][cote];
    const pt = [((A.ch[0] + A.or[0]) / 2 + ((B.ch[0] + B.or[0]) / 2 - (A.ch[0] + A.or[0]) / 2) * f) * Lp, ((A.ch[1] + A.or[1]) / 2 + ((B.ch[1] + B.or[1]) / 2 - (A.ch[1] + A.or[1]) / 2) * f) * Lp];
    let dphi = ((phC - P.phi) % 1 + 1) % 1; if (dphi < 0.02) dphi += 1;
    for (let c = 0; c < cycles; c++) out.push({ pied: cote, t: (dphi + c) * P.T, avant: pt[0], droite: pt[1] + pasVirage(P, cote) });
  }
  return out.sort((a, b) => a.t - b.t);
}
/** (instrument) Les pieds prédits à la phase courante, repère corps (avant, droite, m) : cheville et métatarses, en vol ou non. */
export function pasPositions(p) {
  const P = p._pas; if (!P) return null;
  const g = geo(P.v), Lp = LEG_REF / (p.legK ?? 1), i = Math.round(P.phi * N_GEO) % N_GEO, m = (u) => [u[0] * Lp, u[1] * Lp];
  return { left: { vol: g[i].left.vol, ch: m(g[i].left.ch), or: m(g[i].left.or) }, right: { vol: g[i].right.vol, ch: m(g[i].right.ch), or: m(g[i].right.or) } };
}
/** (2026-09-24) LE PORTÉ EN COURSE (cfg.pas) : le ballon tenu au servo va au point où le pied PRÉFÉRÉ se pose — le cou-de-pied à la pose, plus
 *  un rayon devant, dans son couloir un peu dehors — et non à un point fixe devant le corps (controlSettle) que les DEUX pieds traversaient :
 *  mesuré au rendu, 79 des 132 images où le ballon était DANS un pied venaient du porté. L'autre pied passe à côté ; le préféré le
 *  rejoint à chaque pose (pasStep l'inscrit comme une touche). [x, z] monde, ou null (pas d'horloge, allure lente). */
export function pasPointPorte(st, p, { vMin = 1.0 } = {}) {
  const P = p._pas; if (!P || P.v < vMin) return null;
  const cote = p.foot === 'left' ? 'left' : 'right', r = pasProchains(p, { cycles: 1 }).find((x) => x.pied === cote); if (!r) return null;
  const fx = Math.cos(p.yaw), fz = Math.sin(p.yaw), av = r.avant + 0.09, dr = r.droite * 1.25, m = 0.13;
  return [Math.max(-st.area[0] / 2 + m, Math.min(st.area[0] / 2 - m, p.p[0] + fx * av - fz * dr)), Math.max(-st.area[1] / 2 + m, Math.min(st.area[1] / 2 - m, p.p[2] + fz * av + fx * dr))];
}
/** …et LA TOUCHE DU PORTÉ S'INSCRIT : le ballon tenu que le cou-de-pied d'un pied en vol atteint (pasContact) — une par vol — devient un
 *  événement 'touche' (pas: 'porté') : le rendu montre le pied qui le joue au lieu d'un ballon qui glisse seul devant le corps. */
export function pasTouchePorte(st, p) {
  const P = p._pas; if (!P || P.v < 1.0 || st.ball.owner !== p.id || p.act) return;
  P.joue ??= {};
  const bx = st.ball.p[0] - p.p[0], bz = st.ball.p[2] - p.p[2], fx = Math.cos(p.yaw), fz = Math.sin(p.yaw);
  const ct = pasContact(p, bx * fx + bz * fz, -bx * fz + bz * fx);
  if (ct && ct.d <= 0.16 && !P.joue[ct.pied]) { P.joue[ct.pied] = true; st.events.push({ t: +st.t.toFixed(2), type: 'touche', by: p.id, dev: 0, spd: +P.v.toFixed(1), foot: ct.pied, pas: 'porté' }); }
}
/** Les PROCHAINS VOLS de chaque pied (depuis maintenant, s) : [{ pied, t0 (décollage), t1 (pose) }], triés par t0 — le calendrier d'un geste
 *  fait DANS la foulée (le passement lancé : la jambe qui cercle le ballon est un vol de la foulée, pas un clip joué sur un corps arrêté). */
export function pasVols(p, n = 6) {
  const P = p._pas; if (!P) return [];
  const g = geo(P.v), out = [];
  for (const cote of ['left', 'right']) {
    let i0 = -1, i1 = -1;
    for (let i = 0; i < N_GEO; i++) { const a = g[i][cote].vol, b = g[(i + 1) % N_GEO][cote].vol; if (!a && b) i0 = (i + 1) % N_GEO; if (a && !b) i1 = (i + 1) % N_GEO; }
    if (i0 < 0 || i1 < 0) continue;
    const ph0 = i0 / N_GEO, dur = (((i1 - i0) % N_GEO + N_GEO) % N_GEO) / N_GEO;
    const d0 = ((ph0 - P.phi) % 1 + 1) % 1;                            // le PROCHAIN décollage (un vol en cours est ignoré)
    for (let c = 0; c < n; c++) out.push({ pied: cote, t0: (d0 + c) * P.T, t1: (d0 + c + dur) * P.T });
  }
  return out.sort((a, b) => a.t0 - b.t0).slice(0, n);
}
/** La distance devant le corps où se pose le pied (le cou-de-pied à la pose, m) — où le ballon attend la jambe qui le cercle. */
export function pasPose(p) { const r = pasProchains(p, { cycles: 1 }); return r.length ? Math.max(...r.map((x) => x.avant)) : 0.35; }
