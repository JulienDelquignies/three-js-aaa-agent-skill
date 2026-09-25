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
import { profilDe } from './locomoteur.js';

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
      P.evt = { left: null, right: null };   // le vol qui COMMENCE ('debut') ou FINIT ('fin') à ce pas de temps — les temps d'un geste dans la foulée
      for (const k of ['left', 'right']) { const vol = g[i][k].vol; if (vol && P.volAvant[k] === false) { P.joue[k] = false; P.evt[k] = 'debut'; } else if (!vol && P.volAvant[k] === true) P.evt[k] = 'fin'; P.volAvant[k] = vol; } }
    // (2026-09-25) LE PIED QUI VISE : le porteur en course nomme le pied qui va jouer le ballon — celui du rendez-vous planifié tant qu'il court,
    // sinon (première touche après le porté ou une prise, ballon à portée) le prochain pied à se poser — et le rendu l'AMÈNE au ballon sur la fin
    // de son vol (gaitPose, opts.vise) : sans lui, 47 des 57 touches de rattrapage (sans plan) se jouaient pied à ~0,35 m du ballon, surtout en virage
    if (P.rdv) { P.rdv.reste -= dt; if (P.rdv.reste < -0.15) P.rdv = null; }
    P.vise = null;
    // (2026-09-25) …et le RÉCUPÉRATEUR d'un ballon libre au sol (le plus près, ballon devant à < 0,8 m) nomme aussi son pied : le rendu l'amène au ballon
    const recup = st._recupPied && st.phase === 'loose' && !p.act && P.v >= 1.0 && st.ball.p[1] < 0.4 && p.id === st._recupPied;
    if ((st.phase === 'carry' && st.possession?.carrier === p.id && !p.act && P.v >= 1.0) || recup) {
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
/** (2026-09-25, cfg.dribble1c1.sortie) LA SORTIE D'UN GESTE TIENT SA DIRECTION : la touche de sortie fixe la poussée du porteur pour `duree` s
 *  (_pace 'sortie' avec dir — match-sim la tient contre l'intention, locomoteur y ouvre la capacité force-vitesse). Mesuré avant (rendu,
 *  gestes-mesure, 12 graines) : après la feinte de corps le corps ne tournait que de 8° (médiane) — la conduite le ramenait à son cap dès
 *  la fin du geste ; la vraie réorientation part 0,15-0,22 s après la pose et s'engage (Brault et al. 2010). Clé absente : la poussée seule. */
export function sortieFoulee(st, p, cfg, yaw) {
  p.push = [Math.cos(yaw), Math.sin(yaw)];
  const K = cfg?.dribble1c1?.sortie; if (!st.full || !K) return;
  p._pace = { ...(p._pace ?? { next: 3 }), until: st.t + (K.duree ?? 0.6), kind: 'sortie', dir: [Math.cos(yaw), Math.sin(yaw)] };
}
/** La vitesse du ballon de SORTIE : celle que le porteur aura dans `dt` s en démarrant à pleine capacité (profil force-vitesse, locomoteur :
 *  v + (V₀ − v)(1 − e^(−dt/τ)), plafonnée à son allure de conduite) — le ballon part là où le corps le rattrape. Taga et al. 2026 : 2,9 → 4,3 m/s
 *  en 0,3 s à la sortie du passement. */
export function vSortie(p, cfg, dt = 0.5) {
  const L = cfg?.locomoteur; if (!L) return Math.max(2.6, p.speed + 0.8);
  const { v0, tau } = profilDe(p, L), top = (cfg.speeds?.carry ?? 4.2) * (p.skill?.topF ?? p.persona?.paceBias ?? 1);
  return Math.max(2.6, Math.min(top, p.speed + (v0 - p.speed) * (1 - Math.exp(-dt / tau))));
}

/** (2026-09-25) LE FREIN D'UNE COUPE selon son angle (°) : la vitesse à la POSE rapportée à l'approche, mesurée par Dos'Santos et al. 2021
 *  (J Sports Sci, 27 hommes, sans ballon, tableau 1) — 45° : 5,06/5,22 = 0,97 ; 90° : 3,43/4,51 = 0,76 ; 180° : 2,68/4,00 = 0,67 (linéaire
 *  entre, 0,97 en deçà de 45°). Le crochet freinait hier à 0,45-0,6 quel que soit l'angle : 1,9 m/s mesurés à la sortie. */
export function freinCoupe(deg) {
  const a = Math.abs(deg); return a <= 45 ? 0.97 : a <= 90 ? 0.97 + (0.76 - 0.97) * (a - 45) / 45 : Math.max(0.67, 0.76 + (0.67 - 0.76) * (a - 90) / 90);
}

/** (2026-09-25, cfg.recup) LE BALLON LIBRE SE PREND AU PIED : un ballon au sol n'est pris que si un pied l'ATTEINT — la cheville ou la pointe d'un pied
 *  (là où l'horloge de foulée les met, pasPositions) à ≤ K.pied m, ou le cou-de-pied d'un pied en vol qui le balaie ; quasi arrêté (< K.lent m/s), le
 *  ballon juste devant (≤ K.semelle m) — la semelle se pose. Mesuré avant (recuperation.mjs, 8 × 120 s) : la prise tombait au RAYON du corps (0,85 m),
 *  le ballon à 0,53 m du pied rendu le plus proche (p50), 6 % seulement à ≤ 0,2 m — le joueur aspirait le ballon. */
export function pasPiedAtteint(p, bp, K = {}) {
  const dx = bp[0] - p.p[0], dz = bp[2] - p.p[2], c = Math.cos(p.yaw), s = Math.sin(p.yaw), av = dx * c + dz * s, dr = -dx * s + dz * c, v = hyp(p.v[0], p.v[1]);
  if (!p._pas || v < (K.lent ?? 0.8)) return hyp(dx, dz) <= (K.semelle ?? 0.45) && av > -0.05;
  const F = pasPositions(p); let m = 9;
  for (const k of ['left', 'right']) for (const q of [F[k].ch, F[k].or]) m = Math.min(m, hyp(av - q[0], dr - q[1]));
  const ct = pasContact(p, av, dr);
  return m <= (K.pied ?? 0.25) || (ct && ct.d <= (K.contact ?? 0.2));
}
/** …et LA PRISE N'EST PAS UN AIMANT : pris en course, le ballon amorti est lâché au pied (il roule, la conduite le
 *  reprend : la touche suivante est planifiée sur le pied qui se pose) ; pris au pas, il s'arrête sous la semelle LÀ OÙ IL EST. Hier le contrôle le déclarait possédé et le servo le tirait jusqu'au point du pied
 *  (glissé sans pied > 0,1 m sur 37 % des récupérations, jusqu'à 0,84 m). */
export function recupTouche(st, p, K = {}) {
  const v = hyp(p.v[0], p.v[1]), bv = st.ball.v;
  if (v < (K.lent ?? 0.8)) { st.ball.impulse([-bv[0], 0, -bv[2]]); return; }
  // en course la prise JOUE UNE TOUCHE PLANIFIÉE, comme la conduite : le ballon part au point où se posera le pied qui atterrit dans ~0,4 s (freiné par le
  // sol : v₀ = d/t + a·t/2) et le rendez-vous est déclaré (P.rdv — dribble.js le reconnaît, le rendu y amène ce pied). Une poussée maison hors plan
  // faisait de la touche suivante un rattrapage (53 % au cou-de-pied) ; le ballon amorti lâché tel quel finissait derrière le porteur (15 %).
  const P = p._pas, R = P ? pasProchains(p, { cycles: 2 }).filter((x) => x.t > 0.2 && x.t < 0.8) : [];
  const r = R.reduce((b, x) => (!b || Math.abs(x.t - 0.4) < Math.abs(b.t - 0.4) ? x : b), null);
  if (r) {
    const c = Math.cos(p.yaw), sn = Math.sin(p.yaw), tx = p.p[0] + p.v[0] * r.t + c * r.avant - sn * r.droite * 1.2, tz = p.p[2] + p.v[1] * r.t + sn * r.avant + c * r.droite * 1.2;
    const ex = tx - st.ball.p[0], ez = tz - st.ball.p[2], el = hyp(ex, ez) || 1e-3, sol = st.ball.sol, a = sol ? sol.dec0 + sol.decV * Math.min(2, sol.vMax ?? 3.2) : 1.2;
    const v0 = Math.max(0.3, el / r.t + a * r.t / 2);
    st.ball.impulse([ex / el * v0 - bv[0], 0, ez / el * v0 - bv[2]]); P.rdv = { pied: r.pied, reste: r.t };
  }
  if (st.ball.owner === p.id) st.ball.release('conduite');
}

export function pasPose(p) { const r = pasProchains(p, { cycles: 1 }); return r.length ? Math.max(...r.map((x) => x.avant)) : 0.35; }

/** (2026-09-25) LES GESTES DANS LA FOULÉE — un geste est une suite de TEMPS posés sur les prochains vols du porteur, un par vol (pieds dans
 *  leur ordre naturel). Un temps est :
 *    'arc'    la jambe cercle le ballon (le passement) — le rendu dessine l'arc (arcPassement) ;
 *    'vend'   le pied se pose large, le buste penche de son côté, le ballon n'est pas touché (la feinte de corps) ;
 *    'touche' le pied qui ATTEINT le ballon le joue : vers `dir` (lacet monde) à `v` m/s, ou vers la pose du pied du temps suivant (`cible:
 *             'suivant'`, la croqueta) ; `frein` : le corps freine (× la vitesse) et part vers `dir` (le crochet).
 *  `vend: true` sur un temps : la MORSURE du défenseur (le contact du geste, skillContactNow) tombe à son milieu. Le ballon est tenu devant
 *  le pied du temps en cours tant qu'il n'est pas joué ; joué, il roule libre. La sim d'un geste de la couche (un clip sur un corps
 *  arrêté) devient une affaire de foulée — le rendu ne joue plus de clip. Appelé à chaque pas de temps pendant l'acte (stepGestures). */
export function gesteFouleeStep(st, p, dt, cfg, contactNow) {
  const A = p.act?.payload, F = A?.foulee, P = p._pas; if (!F || !P) return;
  const fx = Math.cos(p.yaw), fz = Math.sin(p.yaw), Bs = F.beats;
  for (const b of Bs) b.etat ??= 'attente';
  const vendre = () => { if (!F.vendu) { F.vendu = true; if (!p.act.fired) p.act.anticipation = p.act.t; } };
  // LES TEMPS SE CHEVAUCHENT : en course, le pied suivant décolle AVANT que le précédent ne se pose (le vol) — un temps s'arme au décollage de SON
  // pied dès que le temps d'avant a COMMENCÉ (hier : quand il avait fini — le décollage était manqué, un cycle perdu, la feinte durait 1,5 s)
  for (const k of ['left', 'right']) if (P.evt?.[k] === 'debut') {
    const i = Bs.findIndex((b) => b.etat === 'attente'); if (i >= 0 && Bs[i].pied === k && (i === 0 || Bs[i - 1].etat !== 'attente')) { Bs[i].etat = 'vol'; Bs[i].t0 = st.t; }
  }
  P.vise = null;
  for (let i = 0; i < Bs.length; i++) {
    const B = Bs[i]; if (B.etat !== 'vol') continue;
    if (B.type === 'touche' && !B.joue) P.vise = B.pied;                // le rendu amène ce pied au ballon
    if (B.vend && B.type !== 'touche' && st.t - B.t0 >= 0.22 * P.T) vendre();   // la morsure au milieu du vol (≈ ¼ de cycle après le décollage)
    if (B.type === 'touche' && !B.joue) {
      const bx = st.ball.p[0] - p.p[0], bz = st.ball.p[2] - p.p[2], ct = pasContact(p, bx * fx + bz * fz, -bx * fz + bz * fx);
      const fin = P.evt?.[B.pied] === 'fin';
      if ((ct && ct.pied === B.pied && ct.d <= 0.2) || (fin && Math.hypot(bx, bz) < 0.9)) {   // au cou-de-pied, sinon à la pose (ballon à portée)
        let dirX, dirZ, v; const suiv = Bs[i + 1];
        if (B.cible === 'suivant' && suiv) {                             // la croqueta : le ballon va se poser devant le pied suivant
          const r = pasProchains(p, { cycles: 2 }).find((x) => x.pied === suiv.pied && x.t > 0.08);
          const tx = r ? p.p[0] + p.v[0] * r.t + fx * r.avant - fz * r.droite * 1.2 : p.p[0] + fx * 0.5, tz = r ? p.p[2] + p.v[1] * r.t + fz * r.avant + fx * r.droite * 1.2 : p.p[2] + fz * 0.5;
          const ex = tx - st.ball.p[0], ez = tz - st.ball.p[2], el = Math.hypot(ex, ez) || 1, tt = r?.t ?? 0.3, a = 1.2;
          dirX = ex / el; dirZ = ez / el; v = Math.max(0.8, el / tt + a * tt / 2);
        } else { dirX = Math.cos(B.dir); dirZ = Math.sin(B.dir);
          if (B.v === 'sortie' && B.frein != null) { p.v = [p.v[0] * B.frein, p.v[1] * B.frein]; p.speed = Math.hypot(p.v[0], p.v[1]); B.freine = true; }   // le frein de la pose d'abord…
          v = B.v === 'sortie' ? vSortie(p, cfg) : (B.v ?? 3); }                                                                                          // …puis le ballon là où le démarrage mène
        if (st.ball.owner === p.id) st.ball.release('conduite');   // une touche de geste est une touche de conduite (le ballon libre, interceptable)
        st.ball.impulse([dirX * v - st.ball.v[0], 0, dirZ * v - st.ball.v[2]]);
        st.lastTouch = p.team; B.joue = true; P.joue[B.pied] = true;
        st.events.push({ t: +st.t.toFixed(2), type: 'touche', by: p.id, dev: 0, spd: +v.toFixed(1), foot: B.pied, pas: 'geste', geste: A.skill, contact: !!(ct && ct.pied === B.pied && ct.d <= 0.2) });   // contact : au cou-de-pied (sinon à la pose)
        if (B.frein != null && !B.freine) { p.v = [p.v[0] * B.frein, p.v[1] * B.frein]; p.speed = Math.hypot(p.v[0], p.v[1]); }
        if (B.dir != null) sortieFoulee(st, p, cfg, B.dir);
        if (B.vend) vendre();
      }
    }
    if (P.evt?.[B.pied] === 'fin' && (B.type !== 'touche' || B.joue || st.t - B.t0 > 0.6)) B.etat = 'fait';
  }
  if (p.act.t > 2.5 || P.v < 0.4) for (const b of Bs) b.etat = 'fait';   // le porteur arrêté (l'horloge ne tourne plus) ou un geste qui traîne : il se termine
  if (Bs.every((b) => b.etat === 'fait')) { vendre(); if (p.act.fired) p.act.total = Math.min(p.act.total, p.act.t + 1e-3); }
  const B = Bs.find((b) => b.etat !== 'fait');
  // LE BALLON TANT QU'IL N'EST PAS JOUÉ : tenu devant le pied qui va le jouer (sa pose, dans son couloir), ou droit devant à la pose (l'arc,
  // la vente) ; joué, il roule — personne d'autre ne l'écrit pendant l'acte (la branche occupée de la sim s'efface devant un geste en foulée)
  if (st.ball.owner === p.id) {
    const Bc = Bs.find((b) => b.type === 'touche' && !b.joue && b.etat !== 'fait') ?? B, r = Bc && pasProchains(p, { cycles: 1 }).find((x) => x.pied === Bc.pied);
    const av = (r ? r.avant : 0.4) + 0.08, dr = Bc?.type === 'touche' && r ? r.droite * 1.1 : 0;
    st.ball.carry([p.p[0] + fx * av - fz * dr, p.p[2] + fz * av + fx * dr], dt, { tau: 0.08, vMax: 7 });
  } else st.ball.integrate(dt);
}
