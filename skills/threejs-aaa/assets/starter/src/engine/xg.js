// xg.js — LE xG EN FORME CLOSE ET LA PORTE DE DÉCISION (272, cfg.xg — Modèle 10 §1-§2 : le tir n'est pas un
// seuil de menace, c'est une comparaison « xG > EV_cont + Θ_i »). Le noyau logistique de Sumpter (8 451 tirs
// PL 2017/18, Wyscout — l'intercept et sept coefficients recopiés à la ligne, § 2.2), clampé à X ≤ 35, C ≤ 20 et
// décroissant au-delà (le noyau DIVERGE : minimum à X ≈ 56 m puis remontée — un moteur sans garde-fou voit ses
// gardiens tenter le but adverse) ; les corrections ENTRENT EN LOG-ODDS (§ 2.3 : tête / pied recentrés −0,71 /
// +0,14, occlusion du cône −2,2·Ω, pression −1,1·P) ; le xG DE DÉCISION ajoute ce que le tireur voit et ce qu'il
// est (gardien avancé +1,3·g/D, décentré +0,9·η, finition ±0,45 — UNIQUEMENT dans xG_dec, jamais dans le xG de
// référence : Davis & Robberechts 2024, le biais de finition). Le biais de tempérament Θ_i (§ 1.3) module la
// porte : score × temps (mené tard : on tire de partout), la doctrine de tir (l'AXE tactique shotDoctrine —
// test n° 10), la fatigue, la pression, le rôle (arbitre.tir). Le moteur possède la loi ; les attributs sont des
// facteurs (finF lu à l'identité 1 = 50 → δ 0), la tactique un axe (0,5 = l'identité), le rôle un axe (1). Pure.
import { hyp } from './hyp.js';
import { pressionDe } from './reception.js';

export const SUMPTER = { b0: 0.5103, a: 0.6338, d: -0.2798, x: 0.1243, c: -0.03, x2: 0.0014, c2: 0.0041, ax: -0.1251 };
export const sig = (l) => 1 / (1 + Math.exp(-l));
export const logit = (p) => Math.log(p / (1 - p));

/** L'angle visible du but (rad, § 2.1) — atan2 obligatoire : sous 3,66 m le dénominateur devient négatif. Pure. */
export function angleVisible(X, C, W = 7.32) { return Math.atan2(W * X, X * X + C * C - (W / 2) * (W / 2)); }

/** Le noyau de Sumpter en logit, SANS clamp (le test 9 ter le mesure hors domaine). Pure. */
export function logitGeo(X, C, B = SUMPTER) {
  const A = angleVisible(X, C), D = hyp(X, C);
  return B.b0 + B.a * A + B.d * D + B.x * X + B.c * C + B.x2 * X * X + B.c2 * C * C + B.ax * A * X;
}

/** Le xG géométrique borné (§ 2.2, le garde-fou) : X ≤ xMax, C ≤ cMax ; au-delà de xMax, xG(xMax, C) · e^(−λ_far (D − D_clamp)). Pure. */
export function xgGeo(X, C, K) {
  const Xc = Math.min(X, K.xMax ?? 35), Cc = Math.min(C, K.cMax ?? 20);
  let p = sig(logitGeo(Xc, Cc));
  if (X > Xc) p *= Math.exp(-(K.lambdaFar ?? 0.09) * (hyp(X, Cc) - hyp(Xc, Cc)));
  return p;
}

/** L'OCCLUSION DU CÔNE Ω ∈ [0 ; 1] (§ 2.4) : chaque adversaire de champ debout ENTRE le tireur et la ligne projette sa
 *  capsule (r_eff = r0 + rEng si engagé au contre) sur l'angle du but ; les intervalles fusionnés (tri, balayage),
 *  chacun pesé 1 − d_j/D (le corps collé au tireur occulte moins — Ensum, Pollard & Taylor 2004). Rend aussi le
 *  décentrage du gardien η (la part de l'angle laissée du côté ouvert) et sa sortie g (m de la ligne). Pure. */
export function coneDe(st, c, goal, K) {
  const s = Math.sign(goal.x || 1), X = Math.max(0.3, (goal.x - c.p[0]) * s), cz = c.p[2], D = hyp(X, cz);
  const W2 = st.pitch.goalHalf ?? 3.66, lo = Math.atan2(-W2 - cz, X), hi = Math.atan2(W2 - cz, X), A = hi - lo;
  const iv = [];
  let gk = null;
  for (const q of st.players) {
    if (q.team === c.team || q.down > 0 || q.expulse || q._sub) continue;
    if (q.keeper) { gk = q; continue; }
    const dx = (q.p[0] - c.p[0]) * s, dz = q.p[2] - cz;
    if (dx <= 0.2 || dx >= X) continue;
    const dq = hyp(dx, dz), r = (K.r0 ?? 0.3) + ((q._contre && q._contre.until > st.t) ? (K.rEng ?? 0.55) : 0);
    const th = Math.atan2(dz, dx), h = Math.asin(Math.min(1, r / dq));
    const a = Math.max(lo, th - h), b = Math.min(hi, th + h);
    if (b > a) iv.push([a, b, 1 - dq / D]);
  }
  iv.sort((u, v) => u[0] - v[0]);
  let omega = 0, ca = null, cb = null, cw = 0, cn = 0;
  const flush = () => { if (ca != null) omega += (cb - ca) * (cw / cn); };
  for (const [a, b, w] of iv) {
    if (ca == null || a > cb) { flush(); ca = a; cb = b; cw = w; cn = 1; }
    else { cb = Math.max(cb, b); cw += w; cn++; }
  }
  flush();
  omega = A > 0 ? Math.min(1, omega / A) : 0;
  // le gardien : sa sortie g (m de la ligne) et son décentrage η (l'écart à la bissectrice du cône, en demi-buts)
  let g = 0, eta = 0;
  if (gk) {
    g = Math.abs(gk.p[0] - goal.x);
    const zb = cz + X * Math.tan((lo + hi) / 2);
    eta = Math.min(1, Math.abs(gk.p[2] - zb) / W2);
  }
  return { omega, g, eta, A, X, C: Math.abs(cz), D };
}

/** LE xG D'UN TIREUR (§ 2.2-2.3) : { geo, ref, dec, omega, P, g, eta } — ref = géométrie + tête/pied + occlusion +
 *  pression (la télémétrie, la même pour tous) ; dec = ref + gardien avancé + décentré + finition (ce que le tireur
 *  voit et ce qu'il est — la décision). La finition entre par finF (identité 1 → δ 0 : le 50 exact). Pure.
 *  Les sites : tryShot (pied), la tête (tete = true), la volée (pied), le coup franc direct (delta = d.cf, hors ajustement Wyscout). */
export function xgDe(st, c, cfg, tete = false, delta = 0) {
  const K = cfg.xg, goal = st.pitch.attackGoal(c.team), d = K.d ?? {};
  const cone = coneDe(st, c, goal, K);
  const geo = xgGeo(cone.X, cone.C, K);
  const P = pressionDe(st, c, { pressT: K.pressT ?? 1.5 }, cfg).P;
  const lRef = logit(geo) + (tete ? (d.tete ?? -0.71) : (d.pied ?? 0.14)) + (d.omega ?? -2.2) * cone.omega + (d.press ?? -1.1) * P + delta;   // delta : la correction du site (coup franc direct −0,55, § 2.3)
  const finR = c.skill?.finF ? Math.log(c.skill.finF) / Math.log(0.2) : 0;   // = r(finishing) − 0,5 ∈ [−0,5 ; 0,5]
  const lDec = lRef + (d.gk ?? 1.3) * Math.min(1, cone.g / Math.max(1, cone.D)) + (d.eta ?? 0.9) * cone.eta + (d.fin ?? 0.9) * finR;   // g/D borné à 1 : la cage vide est la cage vide
  return { geo, ref: sig(lRef), dec: sig(lDec), omega: cone.omega, P, g: cone.g, eta: cone.eta, X: cone.X, C: cone.C };
}

/** LE BIAIS DE TEMPÉRAMENT Θ_i (§ 1.3) : base − temps·ln κ_ctx (mené tard : κ > 1, on tire de partout ; devant :
 *  on porte) − doctrine·(shotDoctrine − 0,5) + fatigue·(1 − stamina) + pression·P − rôle·(arbitre.tir − 1). Pure. */
export function thetaDe(st, c, cfg, P) {
  const K = cfg.xg.theta ?? {}, T = st.tactics?.[c.team];
  const lead = st.score ? (st.score[c.team] ?? 0) - (st.score[1 - c.team] ?? 0) : 0;
  const dur = (cfg.chrono?.periodes ?? 2) * (cfg.chrono?.duree ?? 2700), frac = Math.min(1, (st.t ?? 0) / Math.max(1, dur));
  const lnK = Math.max(-2, Math.min(2, -lead * 2 * frac * frac));
  return (K.base ?? 0.025) - (K.temps ?? 0.012) * lnK - (K.doctrine ?? 0.03) * ((T?.shotDoctrine ?? 0.5) - 0.5)
    + (K.fatigue ?? 0.01) * (1 - (c.stam ?? 1)) + (K.pression ?? 0.02) * P - (K.role ?? 0.012) * ((c.role?.arbitre?.tir ?? 1) - 1);
}

/** LA VALEUR DE CONTINUATION (§ 1.2) : le xG géométrique du point de réception de la meilleure passe × sa réussite
 *  attendue (pSucc de la sélection 267, sinon p0) × la part qui devient un tir (evCont). Pure. */
export function evContDe(st, c, cfg, best) {
  if (!best?.lead) return 0;
  const K = cfg.xg, goal = st.pitch.attackGoal(c.team), s = Math.sign(goal.x || 1);
  const X = Math.max(0.3, (goal.x - best.lead[0]) * s), C = Math.abs(best.lead[2]);
  return xgGeo(X, C, K) * (best.pSucc ?? K.p0 ?? 0.8) * (K.evCont ?? 0.6);
}

/** LA PORTE (§ 1.2) : u = xG_dec / max(seuilMin, EV_cont + Θ_i), lissé entre 0,5 et 1,5 (la sélectivité du 232 garde sa forme) ;
 *  rend { f, sel, seuil } — f multiplie le score du tir (plancher + (1 − plancher)·sel). Pure. */
export function porteDe(xgDec, ev, theta, K) {
  const seuil = Math.max(K.seuilMin ?? 0.01, ev + theta), u = xgDec / seuil, t = Math.max(0, Math.min(1, (u - 0.5) / 1));   // seuilMin : Θ peut devenir négatif (mené tard, doctrine 1 — « on tire de partout ») ; le plancher est le xG du rond central
  const sel = t * t * (3 - 2 * t), pl = K.plancher ?? 0.15;
  return { f: pl + (1 - pl) * sel, sel, seuil };
}
