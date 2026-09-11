// croyance.js — LA COUCHE DE CROYANCE (262, cfg.croyance && st.full — le transversal n° 3 de la carte du book : Modèle 04 §2
// le champ visuel à deux canaux, §4 l'état de croyance, Bibles 10, 13, 14). Le moteur était « FM-like » (architecture A) :
// chaque décision lisait st.players, l'état VRAI ; le bruit venait de la sortie (σ de passe, dispersion), jamais de ce que
// le joueur SAIT. Ici chaque corps tient une CROYANCE datée par entité (p.vue : 21 corps + le ballon) :
//  (1) LE CHAMP VISUEL à deux canaux (§2.2) : le regard θ = le buste ± la tête (tete °) tourné vers le ballon, ou vers la
//      cible de la saccade en cours (scan.js, 250) ; le canal DÉTAIL q_det = D(r) / (1 + e^{kDet (φ − phiDet)}) (identité,
//      vitesse fine), le canal MOUVEMENT q_mot large et plat jusqu'à la coupure, conditionné à la vitesse relative EN
//      TRAVERS du regard (u⊥ / uRef : l'immobile dans le dos est invisible, celui qui démarre devient perceptible), D(r) =
//      e^{−r / r0} avec r0 × visionF (la vision NOTÉE porte plus loin) ; les NIVEAUX du book : identité (q_det ≥ qId et
//      r ≤ rId), équipe (qEq, rEq), présence (q ≥ qMin), rien — « un joueur sait qu'il y a du monde derrière lui bien
//      avant de savoir qui ».
//  (2) L'OBSERVATION bruitée en distance (§2.3) : σ_obs = s0 + κ r (2 − q) (2-4 % de la distance), la vitesse à
//      sv0 + svK r ; le tirage vient du flux PERCEPTION propre à chaque corps (LCG seedé par p.id — aucun st.rnd
//      consommé, l'empreinte au bit) à la cadence dtObs (le tick du book, 10 Hz) ; la CORRECTION est un gain de Kalman
//      scalaire (§4.3) sur une variance isotrope.
//  (3) LA PRÉDICTION à la lecture (§4.2, paresseuse — jamais une écriture par image) : p̂ = p_obs + v̂ T_v (1 − e^{−τ/T_v})
//      (l'extrapolation sature à 8,4 m), σ² = σ_obs² + σ_v² τ² + ¼ σ_a² τ⁴ (0,62 / 1,15 / 3,03 / 10,26 m à 0,5 / 1 / 2 / 4 s),
//      écrêtée à sMax ; σ_a ÷ anticipF (l'anticipateur devine mieux ce qu'il ne voit plus).
//  (4) L'OUBLI N'EST PAS L'EFFACEMENT (§4.4) : au-delà de Tprior sans observation, la croyance se rabat sur l'ANCRE
//      tactique de l'entité (son slot) en Tblend, la variance plafonnée à sTac — « un défenseur qui n'a pas vu son latéral
//      depuis 6 s ne le croit pas nulle part : il le croit à sa place ».
// Les CONSOMMATEURS (chacun sous la clé, à sa ligne) : le PASSEUR vise sa croyance du receveur (strike-sim : la mène depuis
// p̂ + v̂ t — « la passe vers un fantôme », test 1 : l'erreur non nulle, corrélée à l'âge ; décider de servir X, c'est le
// REGARDER : une saccade vers lui à l'adoption, regardPasse s, dans la portée de la tête) ; le MARQUEUR suit sa croyance
// de son homme (match-sim : « le défenseur pris dans le dos »). Le reste des décisions lit encore l'état vrai — la dette
// nommée du lot (l'attention, la tromperie, la communication, l'invariance par permutation : Modèle 04 lots 4-6). Les
// attributs : vision → la portée du détail, anticipation → l'accélération imprévue, scanning → la cadence des saccades
// (250) ; identité à 50. Clé absente : l'omniscience d'hier au bit.
import { hyp } from './hyp.js';
const DEG = 180 / Math.PI;

/** La direction du regard (rad) : la saccade en cours, sinon la tête tournée vers le ballon dans ± tete °. Pure. */
export function regardDe(p, st, K) {
  const S = p.scan, sac = S && S.until > st.t && S.cible;
  const aV = sac ? Math.atan2(S.cible[1] - p.p[2], S.cible[0] - p.p[0]) : Math.atan2(st.ball.p[2] - p.p[2], st.ball.p[0] - p.p[0]);
  let d = aV - (p.yaw ?? 0); while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
  const cap = (K.tete ?? 80) / DEG;   // la tête tourne de ± tete ° sur le buste — la saccade aussi (une saccade ne retourne pas le corps)
  return (p.yaw ?? 0) + Math.max(-cap, Math.min(cap, d));
}

/** La qualité perceptive d'une entité (les deux canaux, §2.2) et son niveau d'information. Pure. */
export function qualiteDe(p, theta, ex, ez, K, evx = 0, evz = 0) {
  const dx = ex - p.p[0], dz = ez - p.p[2], r = hyp(dx, dz) || 1e-6;
  let phi = Math.abs(Math.atan2(dz, dx) - theta); if (phi > Math.PI) phi = 2 * Math.PI - phi; phi *= DEG;
  const D = Math.exp(-r / ((K.r0 ?? 45) * (p.skill?.visionF ?? 1)));
  const coupe = phi > (K.coupure ?? 100);
  const qDet = coupe ? 0 : D / (1 + Math.exp((K.kDet ?? 0.15) * (phi - (K.phiDet ?? 30))));
  // le canal mouvement ne voit que ce qui BOUGE en travers du regard (u⊥ relatif) : « un joueur immobile dans le dos est invisible, le même qui démarre devient perceptible »
  const uPerp = Math.abs(((evx - (p.v?.[0] ?? 0)) * -dz + (evz - (p.v?.[1] ?? 0)) * dx) / r);
  const qMot = coupe ? 0 : D / (1 + Math.exp((K.kMot ?? 0.10) * (phi - (K.phiMot ?? 75)))) * Math.min(1, uPerp / (K.uRef ?? 2));
  const q = Math.max(qDet, qMot);
  const niveau = qDet >= (K.qId ?? 0.35) && r <= (K.rId ?? 20) ? 'identite' : qDet >= (K.qEq ?? 0.15) && r <= (K.rEq ?? 40) ? 'equipe' : q >= (K.qMin ?? 0.10) ? 'presence' : 'none';
  return { qDet, qMot, q, r, phi, niveau };
}

/** Le σ d'observation en distance (§2.3). Pure. */
export function sigmaObs(r, q, K) { return (K.s0 ?? 0.15) + (K.kappa ?? 0.02) * r * (2 - q); }

/** La croissance de l'incertitude à τ s d'une observation de σ_obs (§4.2), écrêtée. Pure. */
export function sigmaDe(sObs2, tau, K, anticipF = 1) {
  const sa = (K.sigA ?? 1.2) / anticipF, sv = K.sigV ?? 0.9;
  return Math.min(K.sMax ?? 12, Math.sqrt(sObs2 + sv * sv * tau * tau + 0.25 * sa * sa * tau * tau * tau * tau));
}

const gaussDe = (rnd) => (rnd() + rnd() + rnd() + rnd() - 2) * 1.7320508;

/** Une observation : la correction de Kalman scalaire sur l'enregistrement (§4.3). Écrit V. */
export function observer(p, V, id, ex, ez, evx, evz, qual, st, K, rnd) {
  const sO = sigmaObs(qual.r, qual.q, K), sO2 = sO * sO, sV = (K.sv0 ?? 0.25) + (K.svK ?? 0.015) * qual.r;
  const zx = ex + sO * gaussDe(rnd), zz = ez + sO * gaussDe(rnd);
  const rec = V.get(id);
  if (!rec) { V.set(id, { x: zx, z: zz, vx: evx + sV * gaussDe(rnd), vz: evz + sV * gaussDe(rnd), t: st.t, s2: sO2, niveau: qual.niveau }); return; }
  const P = predit(rec, st.t, K, null, p.skill?.anticipF ?? 1), s2p = P.sigma * P.sigma, g = s2p / (s2p + sO2);
  rec.x = P.p[0] + g * (zx - P.p[0]); rec.z = P.p[1] + g * (zz - P.p[1]);
  rec.vx = evx + sV * gaussDe(rnd); rec.vz = evz + sV * gaussDe(rnd);
  rec.t = st.t; rec.s2 = Math.max(1e-6, (1 - g) * s2p); rec.niveau = qual.niveau;
}

/** La prédiction paresseuse à t (§4.2) et le repli sur l'ancre (§4.4). Pure. Rend { p: [x, z], v: [vx, vz], sigma, age }. */
export function predit(rec, t, K, ancre, anticipF = 1) {
  const tau = Math.max(0, t - rec.t), Tv = K.Tv ?? 1.2, f = Tv * (1 - Math.exp(-tau / Tv));
  let x = rec.x + rec.vx * f, z = rec.z + rec.vz * f, sigma = sigmaDe(rec.s2, tau, K, anticipF);
  if (ancre && tau > (K.Tprior ?? 2.5)) {
    const w = 1 - Math.exp(-(tau - (K.Tprior ?? 2.5)) / (K.Tblend ?? 3));
    x = (1 - w) * x + w * ancre[0]; z = (1 - w) * z + w * ancre[1]; sigma = Math.min(sigma, K.sTac ?? 7);   // la variance plafonnée par la dispersion du poste autour de son ancre
  }
  return { p: [x, z], v: [rec.vx, rec.vz], sigma, age: tau };
}

const ancreDe = (ent) => ent._slotT ? [ent._slotT[0], ent._slotT[1]] : ent.target ? [ent.target[0], ent.target[2]] : null;

/** Ce que p CROIT de l'entité ent (un corps ou st.ball) : { p: [x, 0, z], v: [vx, vz], sigma, age, niveau }. Clé absente ou
 *  jamais observée : l'état vrai (σ 0, âge 0 — l'omniscience d'hier). */
export function croyanceDe(p, ent, st, cfg) {
  const K = st.full ? cfg.croyance : null, isBall = ent === st.ball, id = isBall ? 'b' : ent.id;
  const vrai = { p: [ent.p[0], 0, ent.p[2]], v: [ent.v[0], isBall ? ent.v[2] : ent.v[1]], sigma: 0, age: 0, niveau: 'vrai' };
  if (!K || !p.vue) return vrai;
  const rec = p.vue.get(id); if (!rec) return vrai;
  const P = predit(rec, st.t, K, isBall ? null : ancreDe(ent), p.skill?.anticipF ?? 1);
  return { p: [P.p[0], 0, P.p[1]], v: P.v, sigma: P.sigma, age: P.age, niveau: rec.niveau };
}

/** Le pas de perception : chaque corps observe ce que son champ lui rend (appelé en tête de matchStep). */
export function croyanceStep(st, cfg) {
  const K = st.full ? cfg.croyance : null; if (!K) return;
  for (const p of st.players) {
    if (p.down > 0 || p.expulse || p._sub || st.t < (p._percAt ?? -1)) continue;   // la perception a SA cadence (dtObs, le tick du book à 10 Hz) : à 60 Hz les bruits indépendants s'annuleraient en moyenne — l'œil ne rend pas soixante mesures par seconde
    p._percAt = st.t + (K.dtObs ?? 0.1) - 1e-6;
    const V = p.vue ??= new Map();
    if (p._perc == null) p._perc = ((p.id + 1) * 2246822519 + 7919) >>> 0;
    const rnd = () => { p._perc = (p._perc * 1664525 + 1013904223) >>> 0; return p._perc / 4294967296; };
    const theta = regardDe(p, st, K);
    for (const q of st.players) {
      if (q === p || q.expulse || q._sub) continue;
      const qu = qualiteDe(p, theta, q.p[0], q.p[2], K, q.v[0], q.v[1]);
      if (qu.q >= (K.qMin ?? 0.10)) observer(p, V, q.id, q.p[0], q.p[2], q.v[0], q.v[1], qu, st, K, rnd);
    }
    const qb = qualiteDe(p, theta, st.ball.p[0], st.ball.p[2], K, st.ball.v[0], st.ball.v[2]);
    if (qb.q >= (K.qMin ?? 0.10)) observer(p, V, 'b', st.ball.p[0], st.ball.p[2], st.ball.v[0], st.ball.v[2], qb, st, K, rnd);
  }
}
