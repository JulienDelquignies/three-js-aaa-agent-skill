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
//   marquage     [0..1] — zone ↔ homme-à-homme (lot 96, cfg.zone) : jusqu'où on SUIT son
//                          homme loin du ballon (ballLim 8…30 m — à 1, l'homme se suit partout :
//                          le monde d'hier) et combien le côté FAIBLE pince vers l'axe
//                          (slots ×0,55…1,0 — la zone pince, l'homme tient sa craie)
//   relation     [0..1] — positionnel ↔ relationnel (lot 83) : l'ESPACEMENT des soutiens est
//                          une expression tactique, pas une constante — le jeu de position
//                          écarte les slots (rayons ×1,35 à 0), le jeu relationnel les
//                          resserre en triangles courts autour du porteur (×0,65 à 1 — le
//                          Barça des trois milieux collés). La triangulation par ANGLES
//                          (les proches doivent OFFRIR des lignes) : dette nommée lot 84.
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
  gegenpressing: { hauteurBloc: 0.85, largeur: 0.45, pressing: 1.0, style: 0.6, transition: 0.9, compacite: 0.7, relation: 0.55, marquage: 0.65,
    roles: { 5: 'recuperateur', 7: 'ailierDePercussion', 8: 'neufDeSurface', 9: 'ailierDePercussion' } },
  possession:    { hauteurBloc: 0.75, largeur: 0.7, pressing: 0.7, style: 0.1, transition: 0.15, compacite: 0.45, relation: 0.7,
    roles: { 5: 'meneur', 8: 'neufDeSurface' } },
  blocBas:       { hauteurBloc: 0.08, largeur: 0.35, pressing: 0.15, style: 0.8, transition: 1.0, compacite: 0.8, relation: 0.35, marquage: 0.35,
    roles: { 4: 'recuperateur', 5: 'recuperateur', 8: 'neufDeSurface' } },
  direct:        { hauteurBloc: 0.5, largeur: 0.55, pressing: 0.45, style: 1.0, transition: 0.7, relation: 0.3,
    roles: { 7: 'ailierDePercussion', 8: 'neufDeSurface' } },
  largeEtCentres: { hauteurBloc: 0.55, largeur: 1.0, pressing: 0.5, style: 0.55, transition: 0.5, relation: 0.25,
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
    // LE RELATIONNEL (lot 83) : l'espacement des soutiens est un CHOIX de tactique — 0,5 = identité.
    relation: base.relation ?? 0.5,
    // ZONE ↔ HOMME (lot 96) : le rayon de suivi du marquage et la pince du côté faible — 0,5 = le
    // ballside standard du moteur (cfg.zone:false rend le marquage intégral d'hier, au bit).
    marquage: base.marquage ?? 0.5,
    // LA FORMATION est une donnée de la tactique (lot 17 — le catalogue : 433, 442, 352 ;
    // formation.js/LIGNES généralise le calage Loi 11 et les clauses). Inconnue : 433.
    formation: base.formation ?? '433',
    roles: base.roles ?? null,
    // LES TROIS AXES DU CONSOMMATEUR (lot 149) — tempo : la vitesse de circulation (les
    // tenues calmes se raccourcissent, la barre d'adoption s'abaisse) ; mentalite : le
    // curseur de risque (la pente de progression du choix de passe) ; piege : l'agressivité
    // du hors-jeu (la ligne du bloc défendant monte). 0,5 = l'identité, pas un bit.
    tempo: base.tempo ?? 0.5, mentalite: base.mentalite ?? 0.5, piege: base.piege ?? 0.5,
    // LES COUPS DE PIED ARRÊTÉS PAR ÉQUIPE (lot 148 — la demande MESURÉE du consommateur
    // carrière : « un corner est deux constantes globales ») : un CPA n'est pas un axe,
    // c'est une SITUATION — il a son espace. { corner: 'court'|'premier'|'second'|'mixte',
    // coupFranc: 'direct'|'centre'|'mixte', marquage: 'homme'|'zone' }. Absent : les
    // tirages du moteur d'aujourd'hui, au bit (l'opt-in pur, le patron squads).
    cpa: base.cpa ?? null,
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

/** LA TRIANGULATION (lot 84) : être proche doit vouloir dire OFFRIR UN ANGLE — la proximité
 *  sans ligne de passe est la seule vraie fourmilière. v3 : SEULES les paires de slots
 *  PROCHES de l'ancre (r < 10 m) se contraignent, par écartement SYMÉTRIQUE (chacun ±(min−d)/2,
 *  point fixe à min°) — pas de recentrage global, les slots écartés (largeur, sécurité)
 *  intouchés. TROIS versions mesurées, TROIS échecs (pics ≥ 7 corps : v1 pivot-par-paires
 *  11,8 %, v2 éventail recentré 6,4 %, v3 paires proches 8,4 % — base 4,6) : toute contrainte
 *  géométrique PAR FRAME fait bouger les cibles, et des cibles mobiles créent plus de densité
 *  qu'elles n'en retirent (les corps convergent en transit). ÉTEINTE (cfg.triangle: false) —
 *  la v4 vivra dans l'ASSIGNATION slot→joueur avec hystérésis, pas en post-traitement. */
export function triangule(slots, anchor, minDeg = 35, hx = 1e9, hz = 1e9) {
  const min = (minDeg * Math.PI) / 180;
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const ri = Math.hypot(slots[i][0] - anchor[0], slots[i][1] - anchor[2]);
      const rj = Math.hypot(slots[j][0] - anchor[0], slots[j][1] - anchor[2]);
      if (ri >= 10 || rj >= 10) continue;                      // la largeur et la sécurité ne bougent pas
      const ai = Math.atan2(slots[i][1] - anchor[2], slots[i][0] - anchor[0]);
      const aj = Math.atan2(slots[j][1] - anchor[2], slots[j][0] - anchor[0]);
      let d = aj - ai; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      if (Math.abs(d) >= min) continue;
      const h = (min - Math.abs(d)) / 2, s = d >= 0 ? 1 : -1;
      const a2i = ai - s * h, a2j = aj + s * h;
      slots[i][0] = Math.max(-hx + 1.2, Math.min(hx - 1.2, anchor[0] + Math.cos(a2i) * ri));
      slots[i][1] = Math.max(-hz + 1.2, Math.min(hz - 1.2, anchor[2] + Math.sin(a2i) * ri));
      slots[j][0] = Math.max(-hx + 1.2, Math.min(hx - 1.2, anchor[0] + Math.cos(a2j) * rj));
      slots[j][1] = Math.max(-hz + 1.2, Math.min(hz - 1.2, anchor[2] + Math.sin(a2j) * rj));
    }
  }
  return slots;
}
