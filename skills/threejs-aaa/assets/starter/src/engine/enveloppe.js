// enveloppe.js — LE GARDIEN À ENVELOPPE CONTINUE ET PSxG (276, cfg.enveloppe && st.full — Modèle 10 §6.2-6.4, lot 4 de la
// fiche ; Bible 02 §02.3). Le gardien d'hier décidait son plongeon sur un SEUIL DUR d'envergure (diveReach 2,95 m : « des
// gardiens omniscients et des murs à la limite exacte de portée », § 6.3) et le temps de vol au facteur. Ici le budget
// temps SE CALCULE : t_f = (e^{k_D D} − 1) / (k_D v_0) (la traînée quadratique du ch. 03, forme close exacte — 0,97 du
// linéaire à 6 m, 0,85 à 30), t_disp = t_f − τ_r (1 − 0,5 x̂_anticipation) − Δt_occl (la latence pré-motrice 0,20 s, arXiv
// 2211.00374) ; L'ENVELOPPE ATTEIGNABLE PART DE VITESSE NULLE : R(t) = R_0 + min(v_d [t − τ_a (1 − e^{−t/τ_a})], R_max) —
// ½ (v_d/τ_a) t² aux temps courts (22 m/s², une détente latérale), saturée à R_0 + R_max (2,70 m au book : R_0 1,0 implicite ; ici
// R_0 1,5 — le demi-corps et le bras tendu — et R_max 1,9, le haut de la plage, × marge 1,25 le gant : mesuré, le tireur du
// moteur vise le poteau loin du gardien à ρ 3,9 m p50, et le point visé du § 3.4 est la dette nommée) ; bouclée sur Monteiro
// 2022 (1,44 m en 0,512 s, 1,68 en 0,571). Elle est ELLIPTIQUE et non centrée (b = 0,8 a, centre à 0,95 m : on plonge moins
// haut que loin — le ras-de-terre côté opposé est le plus dur). LE RÉGIME RÉFLEXE : sous t_disp 0,25 s on ne plonge plus, on
// BLOQUE (R_0 seul) — « toute frappe cadrée à pleine puissance depuis l'intérieur de la surface est sous le seuil de
// plongeon utile » ; c'est de là que doit ÉMERGER le contraste dedans 60 % / dehors 85 % (§ 6.3, jamais codé). La
// PROBABILITÉ D'ARRÊT est une sigmoïde en R − ρ (β_1 3,2 m⁻¹ : 0,63 m de transition), + réflexes, + handling, − vitesse,
// − dévié : ici elle n'est PAS tirée — la physique du gant résout (onDive) —, elle est JOURNALISÉE comme PSxG = 1 − p_save
// sur chaque tir cadré (l'événement 'enveloppe', st.psxg[team]) : « goals prevented = Σ PSxG − buts ». Attributs en
// facteurs : keeping → R_max (keeperReach / 2,9, 1 au 50), anticipation → τ_r, réflexes (keeperReflex) → β_2, handling → β_3.
// Clé absente : le seuil dur d'hier au bit.

export const sig = (l) => 1 / (1 + Math.exp(-l));

/** Le temps de vol sous traînée quadratique (s) : (e^{k_D D} − 1) / (k_D v_0). Pure. */
export function tempsDeVol(D, v0, K) { const kD = K.kD ?? 0.0108; return (Math.exp(kD * D) - 1) / (kD * Math.max(1, v0)); }

/** L'enveloppe atteignable R(t) (m), de vitesse nulle à l'origine, saturée. rF : le facteur d'envergure (keeping). Pure. */
export function porteeDe(t, K, rF = 1) {
  const ta = K.tauA ?? 0.2, vd = K.vd ?? 4.4, tt = Math.max(0, t);
  return (K.r0 ?? 1.0) + Math.min(vd * (tt - ta * (1 - Math.exp(-tt / ta))), (K.rMax ?? 1.7) * rF);
}

/** Le temps disponible : t_f − τ_r (1 − 0,5 x̂_anticipation) − Δt_occl (plafonné). Pure. */
export function tDispDe(tf, K, anticipF = 1, occl = 0) {
  const x = Math.max(0, Math.min(1, (anticipF - 0.85) / 0.3));
  return tf - (K.tauR ?? 0.2) * (1 - 0.5 * x) - Math.min(K.occlMax ?? 0.25, occl * (K.dtOccl ?? 0.12));
}

/** La distance elliptique du point d'impact (z latéral, y hauteur) au centre de l'enveloppe (cz, zc), b = ellipse × a. Pure. */
export function rhoDe(z, y, cz, K) { return Math.hypot(z - cz, (y - (K.zc ?? 0.95)) / (K.ellipse ?? 0.8)); }

/** La probabilité d'arrêt (§ 6.3) : σ(β0 + β1 (R − ρ) + β2 x̂_réflexes + β3 x̂_handling − β4 v/30 − β5 dévié). Pure. */
export function pSaveDe(R, rho, K, { reflex = 0.125, handF = 1 } = {}, vImp = 20, devie = false) {
  const b = K.beta ?? {}, xR = Math.max(0, Math.min(1, (0.16 - reflex) / 0.07)), xH = Math.max(0, Math.min(1, (handF - 0.85) / 0.3));
  return sig((b.b0 ?? 0) + (b.b1 ?? 3.2) * (R - rho) + (b.b2 ?? 1.1) * xR + (b.b3 ?? 0.4) * xH - (b.b4 ?? 1.0) * (vImp / 30) - (b.b5 ?? 1.6) * (devie ? 1 : 0));
}

/** LA DÉCISION À L'ENVELOPPE : le vol (cross : t restant, z, y), l'âge du tir, le gardien (me z, ses facteurs), la vitesse du
 *  ballon, la distance restante ; rend { mode: 'bloc' | 'plongeon' | 'battu', regime, tf, tDisp, R, rho, pSave }. Pure. */
export function decisionEnveloppe(cross, shotAge, me, gk, D, v0, K, { occl = 0, devie = false, u = null } = {}) {
  const tf = Math.max(cross.t, tempsDeVol(D, v0, K)) + Math.max(0, shotAge);   // depuis la frappe : le vol restant (la physique) ou la forme close, le plus long
  const tDisp = tDispDe(tf, K, gk.skill?.anticipF ?? 1, occl);
  const rF = gk.skill?.keeperReach ? gk.skill.keeperReach / 2.9 : 1;
  const regime = tDisp < (K.seuilBloc ?? 0.25) ? 'bloc' : 'plongeon';
  const R = regime === 'bloc' ? (K.r0 ?? 1.0) * (K.blocF ?? 1) : porteeDe(tDisp, K, rF);
  const rho = rhoDe(cross.z, cross.y ?? 0.5, me[2], K);
  const pSave = pSaveDe(R, rho, K, { reflex: gk.skill?.keeperReflex ?? 0.125, handF: gk.skill?.handF ?? 1 }, v0, devie);
  // LE TIRAGE UNIQUE (§ 6.4, étape 3) : « le seul endroit aléatoire non physique de toute la chaîne » — u < p_save : le gardien y
  // est (la physique du gant résout), sinon battu ; sans tirage (u null) : la géométrie seule (ρ ≤ R × marge)
  const atteint = u != null ? u < pSave : rho <= R * (K.marge ?? 1.05);
  const mode = atteint ? (regime === 'bloc' ? 'bloc' : 'plongeon') : 'battu';
  return { mode, regime, tf, tDisp, R, rho, pSave, u };
}
