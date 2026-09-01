// LE REGARD — la couche qui manquait au réalisme plus que toute autre (sonde du sweep : angle
// tête→ballon MÉDIAN 49-65° dans TOUS les rôles, 27 030 échantillons ; le receveur ne regarde le
// ballon que 5,2 % du vol, le porteur 0,0 %, zéro scanning hors ballon — des mannequins qui
// fixent l'horizon pendant que le ballon circule).
//
// Deux moitiés, séparées comme partout dans ce moteur :
//   LE MÉCANISME (class Gaze) — pur, par acteur : une cible MONDE → (lacet, tangage) en repère
//   corps, clampés (±70° / [−55°, +25°] : au-delà on tourne les épaules, pas le cou), rate-limités
//   (saccade rapide vers une NOUVELLE cible, poursuite lente sur cible continue — l'œil humain :
//   300-600°/s de saccade, ~30-120°/s de poursuite), répartis Cou 40 % / Tête 60 % (le split déjà
//   établi par gait.js), appliqués APRÈS la couche de geste. La cible étant tenue EN MONDE, un
//   pivot du corps est ABSORBÉ par l'offset tête-corps : la tête reste posée sur le ballon pendant
//   que le corps tourne dessous (réflexe vestibulo-oculaire gratuit — la sonde mesurait des têtes
//   claquées à 1 148°/s avec le lacet sim).
//   LA POLITIQUE (pickGazeTarget) — pure elle aussi : qui regarde quoi. Receveur → le ballon en
//   continu (+0,3 s après la réception, le temps de l'amorti). Porteur → alternance ballon/cible
//   (0,4-1,2 s), et pendant l'armé : la cible d'abord, le ballon dans le dernier tiers. Presseur →
//   le ballon. Hors ballon → le ballon ~65 % du temps, coupé de SCANS (0,3-0,6/s chez les pros)
//   vers l'adversaire marqué ou le porteur. Le hasard est un LCG par acteur (déterministe, seedé
//   par id) — les têtes se désynchronisent sans casser la reproductibilité.
//
// Les axes locaux Cou/Tête sont SONDÉS, pas crus (la leçon des bras) : sur ce rig, +x local
// incline la tête VERS LE BAS (les clips l'utilisent : Head [13,0,0] au contact = regard au sol,
// tangage mesuré −38°) et −y la tourne vers la GAUCHE du personnage.

/** Bornes et cadences — des actionneurs, pas des vœux. */
export const GAZE = {
  yawMax: 70,        // ° — au-delà, un humain tourne les épaules
  pitchMin: -55,     // ° — menton à la poitrine (assez pour « lire » le ballon au pied avec le buste)
  pitchMax: 25,
  saccade: 600,      // °/s vers une cible fraîchement changée
  pursuit: 200,      // °/s en poursuite continue (large : couvre les pivots absorbés)
  neckShare: 0.4,    // le cou porte 40 %, la tête 60 (gait.js, même loi)
  holdAfterReceive: 0.3,   // s — les yeux restent sur le ballon le temps de l'amorti
  scanEvery: [1.5, 4.0],   // s — cadence des scans hors ballon (pros : 0,3-0,6 scan/s)
  scanFor: 0.45,     // s — durée d'un scan avant retour ballon
  alternate: [0.4, 1.2],   // s — alternance ballon/cible du porteur
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrapD = (a) => { while (a > 180) a -= 360; while (a < -180) a += 360; return a; };

/** LCG déterministe par acteur — le visuel n'a pas le droit de casser la reproductibilité. */
export const gazeRng = (seed) => { let s = (seed * 2654435761 + 1013904223) >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };

/**
 * LA POLITIQUE : qui regarde quoi. Pure — état du scan porté par `st` (l'appelant le garde).
 * @param view { id, t, ball:[x,y,z], ownerId, flightTo, justReceivedAt, act:{t,antic,targetP}|null,
 *               job, markP, carrierP } — la photo sim que la scène possède déjà
 * @param st   { nextScanAt, scanUntil, scanP, altAt, altOnBall } — mutable, par acteur
 * @param rng  () => [0,1) — le LCG de l'acteur
 * @returns [x,y,z] la cible MONDE du regard
 */
export function pickGazeTarget(view, st, rng) {
  const { id, t, ball, ownerId, flightTo, justReceivedAt, act, job, markP, carrierP } = view;
  // receveur : le ballon, en continu, du départ de la passe à l'amorti compris — LE geste de
  // regard le plus universel du football (mesuré avant : 0,7 % des réceptions regardées)
  if (flightTo === id || (justReceivedAt != null && t - justReceivedAt < GAZE.holdAfterReceive)) return ball;
  if (ownerId === id) {
    // porteur en armé : la cible d'abord (on vise), le ballon dans le dernier tiers (on frappe)
    if (act && act.antic > 0) return (act.t < act.antic * 0.66 && act.targetP) ? act.targetP : ball;
    // porteur libre : alternance ballon ↔ cible pressentie
    if (t >= (st.altAt ?? 0)) { st.altAt = t + GAZE.alternate[0] + rng() * (GAZE.alternate[1] - GAZE.alternate[0]); st.altOnBall = !st.altOnBall; }
    return st.altOnBall || !act?.targetP ? ball : act.targetP;
  }
  if (job === 'chase' || job === 'press') return ball;   // le presseur a les yeux verrouillés dessus
  // hors ballon : le ballon, coupé de scans vers le marqué / le porteur / l'espace
  if (st.scanUntil != null && t < st.scanUntil) return st.scanP ?? ball;
  if (t >= (st.nextScanAt ?? 0)) {
    st.nextScanAt = t + GAZE.scanEvery[0] + rng() * (GAZE.scanEvery[1] - GAZE.scanEvery[0]);
    st.scanUntil = t + GAZE.scanFor;
    st.scanP = (rng() < 0.5 && markP) ? markP : carrierP ?? ball;
    return st.scanP;
  }
  return ball;
}

/**
 * LE MÉCANISME. Les os viennent du clone joué, le rest du TEMPLATE jamais animé (même règle que
 * la couche de geste — un rest contaminé décale tout). Application : q = q_courant ⊗ delta local
 * (par-dessus mixer + gait + couche de geste, comme le stabilisateur de gait).
 */
export class Gaze {
  constructor({ neck, head }) {
    this.neck = neck; this.head = head;
    this.yaw = 0; this.pitch = 0;            // l'état — en ° repère corps
    this._lastTarget = null;
  }

  /**
   * @param dt     pas de temps
   * @param p      position MONDE de la tête (l'appelant la lit sur l'os avant application)
   * @param target cible MONDE du regard
   * @param bodyYaw lacet sim du corps (convention sim : avant = [cos, sin] sur x/z)
   * @param w      poids (0..1) — fondu quand un clip possède la tête (amorti tête baissée…)
   */
  update(dt, p, target, bodyYaw, w = 1) {
    if (!this.neck || !this.head || w <= 1e-3) return;
    const dx = target[0] - p[0], dy = target[1] - p[1], dz = target[2] - p[2];
    const horiz = hyp(dx, dz) || 1e-6;
    // L'ÉTAT EST EN MONDE, et c'est toute la physiologie : le réflexe vestibulo-oculaire compense
    // la rotation du CORPS sans délai (le regard reste posé sur la cible pendant que le corps
    // tourne dessous) — seule la POURSUITE DE CIBLE est limitée en vitesse. Rate-limiter le repère
    // corps ferait « claquer » la tête avec chaque pivot (mesuré avant : 1 148°/s p99).
    const bodyDeg = bodyYaw * 180 / Math.PI;
    const wantYawW = Math.atan2(dz, dx) * 180 / Math.PI;
    const wantPitch = clamp(Math.atan2(dy, horiz) * 180 / Math.PI, GAZE.pitchMin, GAZE.pitchMax);
    // saccade vers une cible neuve, poursuite sinon — la tête ne se téléporte jamais
    const fresh = !this._lastTarget || hyp(target[0] - this._lastTarget[0], target[2] - this._lastTarget[2]) > 0.6;
    this._lastTarget = [target[0], target[1], target[2]];
    const rate = (fresh ? GAZE.saccade : GAZE.pursuit) * dt;
    if (this.worldYaw == null) this.worldYaw = bodyDeg;
    this.worldYaw += clamp(wrapD(wantYawW - this.worldYaw), -rate, rate);
    this.pitch += clamp(wantPitch - this.pitch, -rate, rate);
    // le repère corps est une PROJECTION clampée de l'état monde ; au-delà du clamp (cible dans le
    // dos), l'état monde est ramené au bord — pas d'enroulement, la tête « lâche » la cible comme
    // un humain qui devrait tourner les épaules
    this.yaw = clamp(wrapD(this.worldYaw - bodyDeg), -GAZE.yawMax, GAZE.yawMax);
    this.worldYaw = bodyDeg + this.yaw;
    // application : cou 40 %, tête 60 % — axes SONDÉS (+x = bas, −y = gauche personnage) ;
    // le lacet sim tourne vers +y monde quand yaw croît → le −y local suit le signe du désiré
    const put = (bone, share) => {
      const px = -this.pitch * share * Math.PI / 360, yy = -this.yaw * share * Math.PI / 360;  // demi-angles
      const cx = Math.cos(px), sx = Math.sin(px), cy = Math.cos(yy), sy = Math.sin(yy);
      // euler XYZ (x puis y) en quaternion, multiplié À DROITE du local courant
      const q = [sx * cy, cx * sy, -sx * sy, cx * cy];
      const b = bone.quaternion;
      const r = [
        b.w * q[0] + b.x * q[3] + b.y * q[2] - b.z * q[1],
        b.w * q[1] - b.x * q[2] + b.y * q[3] + b.z * q[0],
        b.w * q[2] + b.x * q[1] - b.y * q[0] + b.z * q[3],
        b.w * q[3] - b.x * q[0] - b.y * q[1] - b.z * q[2],
      ];
      b.set(r[0] * w + b.x * (1 - w), r[1] * w + b.y * (1 - w), r[2] * w + b.z * (1 - w), r[3] * w + b.w * (1 - w));
      const n = hyp(b.x, b.y, b.z, b.w) || 1; b.set(b.x / n, b.y / n, b.z / n, b.w / n);
    };
    put(this.neck, GAZE.neckShare);
    put(this.head, 1 - GAZE.neckShare);
  }
}

/**
 * CONTRAT — le mécanisme seul, prouvable sans rig : clamps qui mordent, rate-limit qui interdit la
 * téléportation, l'absorption du pivot (la clause vestibulaire : cible fixe + corps qui tourne à
 * 500°/s ⇒ le regard CORPS-relatif compense exactement), et la politique qui scanne.
 */
export function checkGaze() {
  const issues = [];
  const mk = () => ({ quaternion: { x: 0, y: 0, z: 0, w: 1, set(x, y, z, w) { this.x = x; this.y = y; this.z = z; this.w = w; } } });
  // 1. clamp : une cible DERRIÈRE ne fait pas tourner la tête en chouette
  const g = new Gaze({ neck: mk(), head: mk() });
  for (let i = 0; i < 200; i++) g.update(1 / 60, [0, 1.6, 0], [-10, 1.6, 0.01], 0);  // cible plein dos (corps regarde +x)
  if (Math.abs(g.yaw) > GAZE.yawMax + 1e-6) issues.push(`chouette : lacet ${g.yaw.toFixed(0)}° hors clamp ±${GAZE.yawMax}`);
  // 2. rate-limit : premier pas borné par la saccade
  const g2 = new Gaze({ neck: mk(), head: mk() });
  g2.update(1 / 60, [0, 1.6, 0], [0, 1.6, 5], 0);
  if (Math.abs(g2.yaw) > GAZE.saccade / 60 + 1e-6) issues.push('téléportation : le premier pas dépasse la saccade');
  // 3. la clause vestibulaire : cible fixe, corps qui pivote → le regard CORPS-relatif compense
  const g3 = new Gaze({ neck: mk(), head: mk() });
  let body = 0;
  for (let i = 0; i < 120; i++) g3.update(1 / 60, [0, 1.6, 0], [3, 1.6, 0], body);
  // pivot de 45° à 500°/s (dans le clamp ±70) : le regard MONDE ne doit pas bouger — au-delà du
  // clamp, lâcher la cible est le comportement humain (on tourne les épaules), pas un bug
  for (let i = 0; i < 6; i++) { body += (500 * Math.PI / 180) / 60; g3.update(1 / 60, [0, 1.6, 0], [3, 1.6, 0], body); }
  const worldGaze = wrapD(g3.worldYaw ?? 0);
  if (Math.abs(worldGaze) > 8) issues.push(`le pivot n'est pas absorbé : regard monde à ${worldGaze.toFixed(0)}° de la cible`);
  // 4. la politique scanne (hors ballon, deux scans en 8 s au moins)
  const st = {}, rng = gazeRng(7);
  let scans = 0, last = null;
  for (let t = 0; t < 8; t += 1 / 30) {
    const tgt = pickGazeTarget({ id: 1, t, ball: [0, 0, 0], ownerId: 2, flightTo: null, justReceivedAt: null, act: null, job: 'support', markP: [4, 0, 4], carrierP: [2, 0, 2] }, st, rng);
    const k = tgt.join(',');
    if (last && k !== last) scans++;
    last = k;
  }
  if (scans < 2) issues.push(`hors ballon la tête ne scanne pas (${scans} changements en 8 s)`);
  return { ok: issues.length === 0, issues };
}
import { hyp } from './hyp.js';
