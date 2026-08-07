// tactics.js — LA TACTIQUE D'ÉQUIPE EST UN CONTRAT DE DONNÉES. « Penser à tous les styles »
// ne se fait pas par une liste (une liste est toujours incomplète) : par des AXES ORTHOGONAUX
// qui GÉNÈRENT l'espace des styles — les presets ne sont que des points nommés dedans, et un
// projet aval en pose d'autres sans toucher au moteur. Le patron Unity/Unreal, encore : le
// moteur possède les LOIS (formation, pressing, Loi 11, arbitre de menace, moments), la
// tactique les PARAMÈTRE par équipe.
//
// Les cinq axes, chacun branché sur des lois DÉJÀ prouvées (aucune mécanique neuve ici) :
//   hauteurBloc  [0..1] — où le bloc défend (postes défensifs décalés −6…+6 m ; la ligne de
//                          hors-jeu suit, la Loi 11 fait le reste)
//   largeur      [0..1] — l'amplitude des postes offensifs (z × 0,85…1,15)
//   pressing     [0..1] — l'agressivité des fenêtres du lot 11 (durée, cooldown, sévérité des
//                          trois signaux — dos-au-but, retrait, contre-press)
//   style        [0..1] — possession ↔ direct : les poids de l'arbitre de menace par ÉQUIPE
//                          et la cadence des appels profonds
//   transition   [0..1] — conservation ↔ contre : la verticalité du regain (relaxation des
//                          appels pendant la transition offensive, lot 14)
//
// LE DÉFAUT EST L'IDENTITÉ : à 0,5 partout, chaque modulation vaut exactement les constantes
// mesurées des lots 10-14 — le monde d'aujourd'hui au bit près (clause du banc). Les
// formations restent 4-3-3 (le catalogue 4-4-2 / 3-5-2 est la dette nommée de la couche
// RÔLES : le calage et les appels lisent « postes ≥ 7 », généraliser demande les lignes).
//
// Pur : des nombres entrent, des nombres sortent — testable au banc (checkTactics).

/** L'interpolation d'axe : t ∈ [0..1], identité garantie à 0,5 (le milieu = le monde mesuré
 *  des lots 10-14 — chaque paire (bas, haut) est choisie pour que son milieu SOIT l'ancienne
 *  constante). */
export const axe = (t, bas, haut) => {
  const u = Math.max(0, Math.min(1, t ?? 0.5));
  // le milieu se calcule EXACT (bas+haut)/2 : la forme bas + 0,5·(haut−bas) rend
  // 1,0000000000000002 sur certaines paires — et l'identité au bit près meurt d'un ulp
  if (u === 0.5) return (bas + haut) / 2;
  return bas + u * (haut - bas);
};

/** Les presets — des POINTS de l'espace, nommés par la culture football. */
export const TACTIQUES = {
  equilibre:     { hauteurBloc: 0.5, largeur: 0.5, pressing: 0.5, style: 0.5, transition: 0.5 },
  // …chaque preset PORTE SES RÔLES par défaut (lot 20 — un système est des axes ET des hommes) ;
  // les rôles explicites du projet aval GAGNENT toujours, poste par poste
  gegenpressing: { hauteurBloc: 0.85, largeur: 0.45, pressing: 1.0, style: 0.6, transition: 0.9, compacite: 0.7,
    roles: { 5: 'recuperateur', 7: 'ailierDePercussion', 8: 'neufDeSurface', 9: 'ailierDePercussion' } },
  possession:    { hauteurBloc: 0.75, largeur: 0.7, pressing: 0.7, style: 0.1, transition: 0.15, compacite: 0.45,
    roles: { 5: 'meneur', 8: 'neufDeSurface' } },
  blocBas:       { hauteurBloc: 0.08, largeur: 0.35, pressing: 0.15, style: 0.8, transition: 1.0, compacite: 0.8,
    roles: { 4: 'recuperateur', 5: 'recuperateur', 8: 'neufDeSurface' } },
  direct:        { hauteurBloc: 0.5, largeur: 0.55, pressing: 0.45, style: 1.0, transition: 0.7,
    roles: { 7: 'ailierDePercussion', 8: 'neufDeSurface' } },
  largeEtCentres: { hauteurBloc: 0.55, largeur: 1.0, pressing: 0.5, style: 0.55, transition: 0.5,
    roles: { 0: 'piston', 3: 'piston', 7: 'ailierDePercussion', 9: 'ailierDePercussion' } },
};

/** Résout un nom de preset ou un objet partiel en tactique complète (les axes absents = 0,5). */
export function resoudreTactique(t) {
  const base = typeof t === 'string' ? (TACTIQUES[t] ?? TACTIQUES.equilibre) : (t ?? {});
  return {
    hauteurBloc: base.hauteurBloc ?? 0.5, largeur: base.largeur ?? 0.5,
    pressing: base.pressing ?? 0.5, style: base.style ?? 0.5, transition: base.transition ?? 0.5,
    // LA COMPACITÉ (lot 43) : la longueur du bloc défendant est CELLE DE SA TACTIQUE
    // (blocFor, formation.js — ±4 m autour de la base moteur). 0,5 = la base, pas un bit.
    compacite: base.compacite ?? 0.5,
    // LA FORMATION est une donnée de la tactique (lot 17 — le catalogue : 433, 442, 352 ;
    // formation.js/LIGNES généralise le calage Loi 11 et les clauses). Inconnue : 433.
    formation: base.formation ?? '433',
    roles: base.roles ?? null,
    nom: typeof t === 'string' ? t : (base.nom ?? 'personnalisée'),
  };
}

/** La tactique de `team` — TOUJOURS résolue (défaut : équilibre = identité). */
export function tac(st, team) {
  return st.tactics?.[team] ?? TACTIQUES.equilibre;
}

/** Le contrat : presets bornés, défaut identitaire, axe() honnête. */
export function checkTactics() {
  const issues = [];
  for (const [nom, t] of Object.entries(TACTIQUES)) {
    for (const [k, v] of Object.entries(t)) {
      if (typeof v === 'number' && (v < 0 || v > 1)) issues.push(`${nom}.${k} = ${v} hors [0;1]`);
    }
  }
  if (Math.abs(axe(0.5, 4, 8) - 6) > 1e-9) issues.push('axe(0,5) n\'est pas le milieu — l\'identité du défaut est cassée');
  if (axe(0, 4, 8) !== 4 || axe(1, 4, 8) !== 8) issues.push('axe() ne tient pas ses bornes');
  if (axe(undefined, 2, 10) !== 6) issues.push('un axe absent ne vaut pas le défaut');
  const r = resoudreTactique('gegenpressing');
  if (r.pressing !== 1.0 || r.nom !== 'gegenpressing') issues.push('resoudreTactique ne résout pas un preset');
  const d = resoudreTactique(undefined);
  if (Object.entries(d).some(([k, v]) => typeof v === 'number' && v !== 0.5)) issues.push('la tactique par défaut n\'est pas l\'identité (0,5 partout)');
  return { ok: issues.length === 0, issues };
}
