// coach.js — LE CERVEAU DE COACH (lot 113, plan validé). Mesuré avant : st.tactics est écrit
// UNE fois (makeMatch) puis GELÉ — le mené à la 200e (11/20 matchs) ne change RIEN et ne tire
// que 0,64 fois dans le dernier tiers. Ici vit la lecture du MATCH : score, chrono, momentum
// → le coach DÉPLACE les axes tactiques de son équipe (tactics.js — les lois les lisent en
// continu), par PALIERS cadencés (un vrai coach gesticule toutes les ~20 s, pas par frame).
//
// Le patron moteur/projet, encore : la LOI est ici (deltas bornés ±0,3 par clé, appliqués sur
// la BASE du projet — jamais une dérive cumulée —, axes rendus dans [0,05 ; 0,95], événement
// 'coach' au changement de posture) ; la POLITIQUE est injectable (cfg.coach.decide(ctx, K)
// — le pattern de menace.js : le projet aval remplace le cerveau, le moteur garde le contrat)
// et la politique NATIVE est paramétrée (postures/facteurs dans cfg.coach). L'horizon suit le
// FORMAT (le motif de la fatigue : chrono s'il existe, sinon 360 s — jamais « 90 min » en
// dur). Gardé cfg.coach && st.full : le réduit et le rondo d'hier, au bit. Clé absente :
// aucun axe ne bouge jamais — hier au bit.
//
// Dettes nommées : la lecture de la POSSESSION dans le momentum (le chrono la compte déjà),
// les CONSIGNES individuelles (le coach qui change un rôle, pas un axe — la Loi 3 y gagnera
// ses remplacements tactiques).

/** La politique NATIVE — quatre postures, du plus urgent au plus calme. Les deltas et
 *  facteurs vivent dans K.postures (le projet cale son coach sans le remplacer). */
export function decideNatif(ctx, K) {
  const P = K.postures ?? {};
  if (ctx.ecart < 0 && ctx.urgence > 0) {
    // MENÉ après la mi-temps : POUSSER — pressing et bloc montent, le jeu se verticalise et
    // s'élargit, proportionnel à l'urgence (et +0,35 d'intensité dès 2 buts d'écart)
    const k = Math.min(1, ctx.urgence + (ctx.ecart <= -2 ? 0.35 : 0)) * (P.pousseF ?? 1);
    return { posture: 'pousse', axes: echelle(P.pousse ?? { pressing: 0.2, hauteurBloc: 0.15, style: 0.15, transition: 0.1, largeur: 0.1 }, k) };
  }
  if (ctx.ecart > 0 && ctx.urgence > 0.4) {
    // MENANT dans le dernier quart d'heure : GÉRER — le bloc descend, le pressing se calme,
    // le jeu garde (style vers possession), d'autant plus que l'avance est courte
    const k = Math.min(1, (ctx.urgence - 0.4) / 0.6 + (ctx.ecart === 1 ? 0.25 : 0)) * (P.gereF ?? 1);
    return { posture: 'gere', axes: echelle(P.gere ?? { pressing: -0.15, hauteurBloc: -0.15, style: -0.1, transition: -0.1 }, k) };
  }
  if (ctx.tirsContre >= (K.orage ?? 3)) {
    // L'ORAGE (momentum contre : ≥ orage tirs subis dans la fenêtre) : RECULER d'un cran —
    // le bloc descend et se compacte le temps que ça passe
    return { posture: 'recule', axes: P.recule ?? { hauteurBloc: -0.12, compacite: 0.12 } };
  }
  return { posture: 'base', axes: {} };
}

const echelle = (o, k) => Object.fromEntries(Object.entries(o).map(([a, v]) => [a, v * k]));

export function coachStep(st, cfg) {
  const K = cfg.coach;
  if ((st._coachAt ?? -1e9) > st.t - (K.each ?? 20)) return;      // le palier, pas la frame
  st._coachAt = st.t;
  const horizon = K.horizon ?? ((cfg.chrono?.periodes ?? 2) * (cfg.chrono?.duree ?? 180));
  const C = (st._coach ??= { base: [null, null], posture: ['base', 'base'] });
  for (let team = 0; team < 2; team++) {
    C.base[team] ??= { ...st.tactics[team] };                     // la BASE du projet, une fois
    const base = C.base[team];
    const fen = K.fenetre ?? 60;
    const ctx = {
      team, score: st.score, t: st.t, horizon,
      ecart: st.score[team] - st.score[1 - team],
      urgence: Math.max(0, Math.min(1, (st.t / horizon - 0.5) * 2)),   // 0 à la mi-temps → 1 au bout
      tirsContre: st.events.filter((e) => e.type === 'shot' && e.t > st.t - fen
        && st.players[e.by]?.team !== team).length,
    };
    const d = (K.decide ?? decideNatif)(ctx, K);
    const next = { ...base };                                     // roles/formation/nom préservés
    for (const [k, v] of Object.entries(d.axes ?? {})) {
      if (typeof base[k] !== 'number') continue;
      next[k] = Math.max(0.05, Math.min(0.95, base[k] + Math.max(-0.3, Math.min(0.3, v))));
    }
    st.tactics[team] = next;
    if (d.posture !== C.posture[team]) {
      C.posture[team] = d.posture;
      st.events.push({ t: +st.t.toFixed(2), type: 'coach', team, posture: d.posture, ecart: ctx.ecart });
    }
  }
}

/** Le contrat, testable à sec : les postures natives réagissent au bon monde, les deltas
 *  restent bornés, la base est l'identité du calme. */
export function checkCoach() {
  const issues = [];
  const K = { postures: {} };
  const calme = decideNatif({ ecart: 0, urgence: 0.8, tirsContre: 0 }, K);
  if (calme.posture !== 'base' || Object.keys(calme.axes).length) issues.push('un match nul sans orage doit rendre la base');
  const pousse = decideNatif({ ecart: -1, urgence: 0.9, tirsContre: 0 }, K);
  if (pousse.posture !== 'pousse' || !(pousse.axes.pressing > 0)) issues.push('le mené en fin de match doit pousser (pressing +)');
  const avant = decideNatif({ ecart: -1, urgence: 0, tirsContre: 0 }, K);
  if (avant.posture !== 'base') issues.push('mené AVANT la mi-temps : on ne panique pas encore');
  const gere = decideNatif({ ecart: 1, urgence: 0.8, tirsContre: 0 }, K);
  if (gere.posture !== 'gere' || !(gere.axes.hauteurBloc < 0)) issues.push('le menant en fin de match doit gérer (bloc −)');
  const orage = decideNatif({ ecart: 0, urgence: 0.2, tirsContre: 4 }, K);
  if (orage.posture !== 'recule') issues.push('l\'orage (4 tirs subis/60 s) doit faire reculer');
  const fort = decideNatif({ ecart: -3, urgence: 1, tirsContre: 0 }, K);
  for (const v of Object.values(fort.axes)) if (Math.abs(v) > 0.3 + 1e-9) issues.push('un delta natif dépasse ±0,3');
  return { ok: issues.length === 0, issues };
}
