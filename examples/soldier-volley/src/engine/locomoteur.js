// LE PROFIL LOCOMOTEUR ET LE BUDGET DE COURSE (260, cfg.locomoteur && st.full — la carte du book, Modèle 02, Référentiel
// 05, Bibles 07-09, 16 : le constat n° 1 des trois volumes — le moteur court 1,6 × trop, à haute intensité 6 × trop,
// accélère 40 × trop souvent, ne freine pas plus qu'il n'accélère). Une seule loi porte tout :
//  (1) LE PROFIL mono-exponentiel (Furusawa 1927, Samozino-Morin) : a = (V_eff − v∥) / τ — V₀ = v0 × topF (la pointe),
//      τ = tau ÷ accelF (le démarrage), F₀ = V₀/τ borné [5 ; 10,2] (le garde-fou : pace 20 / acceleration 20 ne fait pas
//      un surhomme) ; t₉₀ = 2,3 τ, la pointe se prend à 30-40 m, pas à 4.
//  (2) L'INTENTION D'EFFORT ε ∈ [0,35 ; 1] portée par le métier, jamais par le profil : le repositionnement 0,45, le
//      coulissement / soutien / marquage 0,55, le pressing déclenché / la chasse / la réception 0,85, la rupture (burst),
//      la course de but, le porteur lancé 1,0 — « LA poignée de calibration du volume d'accélérations ».
//  (3) LE FREINAGE saturé : −D_max × min(1, v / v_brk), D_max 6,0 > a(v) : on freine plus fort qu'on n'accélère (ratio
//      décélérations / accélérations > 1,15 au réel).
//  (4) LE BUDGET W′ (le réservoir anaérobie, D′ ≈ 250 m au-delà de la vitesse critique vCP 5,5 m/s ; τ_rec 280 s) :
//      p.wp ∈ [0 ; 1] se vide au-dessus de vCP, se remplit dessous ; la fatigue dégrade l'ACCÉLÉRATION et le freinage
//      avant la pointe (λτ 0,22 > λD 0,18 > λV 0,07 — l'épuisé court encore vite en ligne droite, il ne démarre plus) ;
//      une POINTE (burst) exige wp ≥ wBurst, sinon elle se REFUSE (p._paceRefus++ : la course non servie par le corps).
// L'endurance NOTÉE module la vidange (stamF), l'explosivité le démarrage (accelF), la vitesse la pointe (topF) ; le 50
// partout rend le profil élite (8,8 m/s, 1,17 s). Clé absente : l'accélération constante et les pointes gratuites d'hier
// au bit.
export function profilDe(p, K) {
  const v0 = (K.v0 ?? 8.8) * (p.skill?.topF ?? p.persona?.paceBias ?? 1);
  let tau = (K.tau ?? 1.17) / (p.skill?.accelF ?? 1);
  const f0 = Math.max(K.f0Min ?? 5.0, Math.min(K.f0Max ?? 10.2, v0 / tau));
  tau = v0 / f0;
  return { v0, tau, f0 };
}

export function epsilonDe(p, st, K) {
  if (p._effort != null) return p._effort;   // (261) l'intention d'effort posée par le cerveau (effort.js) — absente : la table des métiers
  if ((p._pace?.until ?? -1) > st.t) return K.epsRupture ?? 1.0;
  if (p.job === 'carry' && st.possession?.carrier === p.id) return K.epsPorteur ?? 0.85;
  if (p.job === 'press' || p.job === 'intercept' || p.job === 'receive' || p.job === 'gkBall') return K.epsPress ?? 0.85;
  if (p.job === 'keeper') return K.epsGardien ?? 0.85;
  if (p.job === 'walk') return K.epsMarche ?? 0.45;
  if (p.job === 'support' && st.possession?.team === p.team && st.pitch && (p.p[0] * -st.pitch.ownGoal(p.team).sign) > (K.attaqueX ?? 0)) return K.epsAttaque ?? 0.75;   // le soutien OFFENSIF dans la moitié adverse : la course vers le but (le book : 1,0 pour la course de but)
  return K.epsBloc ?? 0.55;   // support, mark, cover : le coulissement
}

/** La fraction de réservoir η = W′/W′max → les trois retro-actions (l'ordre λτ > λD > λV est la signature du book). */
export function fatigueDe(wp, K) {
  const x = 1 - Math.max(0, Math.min(1, wp ?? 1));
  return { kV: 1 - (K.lamV ?? 0.07) * x, kTau: 1 + (K.lamTau ?? 0.22) * x, kD: 1 - (K.lamD ?? 0.18) * x };
}

/** Le pas de vitesse le long de la course : propulsion mono-exponentielle × ε, freinage saturé. Pur. */
export function pasLoco(p, st, K, vAlong, vWant, dt) {
  const { v0, tau } = profilDe(p, K), F = fatigueDe(p.wp, K);
  const dv = vWant - vAlong;
  if (dv >= 0 && vWant < (K.vLent ?? 1.5)) return Math.min(dv, (K.aLent ?? 4) * dt);   // la petite demande (le pas vers un ballon à portée, le recalage) n'est pas un sprint : le mono-exponentiel y tend vers zéro et clouait le gardien à 0,8 m de son ballon
  if (dv >= 0) {
    const eps = epsilonDe(p, st, K), vEff = Math.min(v0 * F.kV, Math.max(vWant, 0));
    // (2026-09-25, K.sortie — le duel) LA SORTIE D'UN GESTE EST UN DÉMARRAGE : toute la capacité force-vitesse jusqu'à la vitesse voulue
    // (a = (V₀ − v)/τ : 4,6 m/s² à 2,9 m/s ; Taga et al. 2026 mesurent ≈ 4,7 à la sortie du passement), pas l'approche exponentielle de
    // l'allure voulue ((4,2 − v)/τ : 1,6 m/s² à 2,3 m/s — mesuré 2,7 à la sortie, le porteur ne partait pas). Absente : hier au bit.
    const vCap = K.sortie && p._pace?.kind === 'sortie' && (p._pace.until ?? -1) > st.t ? v0 * F.kV : vEff;
    const a = eps * Math.max(0, vCap - Math.max(0, vAlong)) / (tau * F.kTau);
    return Math.min(dv, a * dt);
  }
  // le freinage est une INTENTION aussi : sous seuilFrein m/s d'écart on ROULE (−roule m/s²), au-delà on freine fort
  const d = -dv < (K.seuilFrein ?? 1.5) ? (K.roule ?? 1.5) : (K.dMax ?? 6.0) * F.kD * Math.min(1, Math.max(0, vAlong) / (K.vBrk ?? 2.0));
  return Math.max(dv, -d * dt);
}

/** Le budget : vidange au-dessus de la vitesse critique (D′ m), récupération dessous (τ_rec s). */
export function budgetStep(p, st, K, dt) {
  p.wp ??= 1;
  const v = p.speed ?? 0, vcp = K.vCP ?? 5.5;
  if (v > vcp) p.wp -= (v - vcp) * dt / ((K.dPrime ?? 250) / (p.skill?.stamF ?? 1));
  else p.wp += (1 - p.wp) * dt / (K.tauRec ?? 280);
  p.wp = Math.max(0, Math.min(1, p.wp));
  if (p.wp < (K.seuilEv ?? 0.2) && !p._wpEv) { p._wpEv = 1; st.events.push({ t: +st.t.toFixed(2), type: 'budget', by: p.id, wp: +p.wp.toFixed(2) }); }
}

/** La pointe se paie : un burst sans réservoir se refuse (la course reste au métier, sans le ×1,28). */
export function pointePermise(p, K) { return (p.wp ?? 1) >= (K.wBurst ?? 0.2); }
