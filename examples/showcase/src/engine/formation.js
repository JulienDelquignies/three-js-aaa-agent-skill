// formation.js — LES POSTES DU 11C11 (le chemin balisé de MOTEUR.md, maintenant PROUVÉ).
//
// Une formation est une DONNÉE : dix postes en fractions du terrain [profondeur f (0 = ma ligne
// de but, 1 = la ligne adverse), largeur fz ∈ [−1 ; 1]], et une loi de BLOC : les postes
// coulissent avec le ballon (l'ancre x, bornée — un bloc suit, il ne colle pas) et respirent
// avec la possession (étiré quand on a le ballon, compact sans lui). Le match réduit garde ses
// couloirs dynamiques ; le 11c11 les RÉSERVE au soutien rapproché du porteur et tient le reste
// du monde à ses postes — c'est ce qui fait qu'un 22-corps reste un BLOC lisible, pas un essaim.
//
// Pur : des nombres entrent, des positions sortent — testable au banc sans navigateur.

export const FORMATIONS = {
  433: [
    // la ligne de quatre
    [0.15, -0.62], [0.12, -0.22], [0.12, 0.22], [0.15, 0.62],
    // le milieu à trois
    [0.32, -0.44], [0.28, 0.0], [0.32, 0.44],
    // le trio offensif
    [0.52, -0.78], [0.56, 0.0], [0.52, 0.78],
  ],
  442: [
    // la ligne de quatre
    [0.15, -0.62], [0.12, -0.22], [0.12, 0.22], [0.15, 0.62],
    // le milieu à quatre (ailiers hauts et larges)
    [0.36, -0.68], [0.30, -0.22], [0.30, 0.22], [0.36, 0.68],
    // le duo de pointes
    [0.55, -0.16], [0.55, 0.16],
  ],
  352: [
    // la ligne de trois
    [0.13, -0.33], [0.11, 0.0], [0.13, 0.33],
    // le milieu à cinq (pistons très larges)
    [0.34, -0.80], [0.30, -0.30], [0.26, 0.0], [0.30, 0.30], [0.34, 0.80],
    // le duo de pointes
    [0.54, -0.18], [0.54, 0.18],
  ],
};

/** LES LIGNES sont une DONNÉE (défense, milieu, attaque) : c'est ce qui généralise le calage
 *  Loi 11 (« postes ≥ 7 » n'était vrai qu'en 4-3-3), les clauses du contrat, et demain les
 *  rôles par ligne. La somme fait toujours 10 (Loi 3 : onze joueurs, un gardien). */
export const LIGNES = { 433: [4, 3, 3], 442: [4, 4, 2], 352: [3, 5, 2] };

/** Le premier poste OFFENSIF de la formation (433 → 7, 442/352 → 8) — le calage Loi 11 et les
 *  appels profonds s'adressent aux pointes, quelle que soit la formation. */
export function premierOffensif(name = 433) {
  const l = LIGNES[name] ?? LIGNES[433];
  return 10 - l[2];
}

/**
 * Les dix postes de `team` en coordonnées monde, pour un ballon à `anchorX` et un état de
 * possession. Le bloc coulisse (± 18 % du terrain), la profondeur respire (× 1,05 en attaque,
 * × 0,85 sans le ballon — un bloc défensif est un bloc COURT).
 */
export function formationSpots(pitch, team, anchorX, attacking, name = 433, bloc = null) {
  const g = pitch.ownGoal(team);
  const sgn = -g.sign;                                            // vers l'avant
  const L = pitch.dims.length;
  const F = FORMATIONS[name] ?? FORMATIONS[433];
  // LE BLOC DÉFENSIF EST CHAÎNÉ AU BALLON (lot 42, cfg.bloc — retour utilisateur « les lignes
  // sont trop espacées, les matchs ne sont pas réalistes ») : mesuré avant, bloc défendant
  // p50 43 m / p90 58 (réel 25-40), 25,5 m entre défense et milieu (réel 10-15), et AUCUNE
  // asymétrie attaque/défense — la ligne vivait à ses POSTES (11 m de son but, ballon au
  // centre), pas au ballon. La loi du vrai football : la LIGNE tient ~`ligne` m derrière le
  // ballon (« on pousse ! » — elle monte quand le ballon recule, jamais au-delà du rond
  // central), et le bloc défendant a une LONGUEUR bornée (`long` m) : les lignes s'empilent
  // depuis la ligne basse, interlignes comprimées d'un même facteur. L'équipe qui ATTAQUE
  // garde la respiration d'hier (étirée) — l'asymétrie est le réalisme. `bloc` absent :
  // le monde d'hier, au bit près (sabotage nommé « bloc élastique »).
  if (!attacking && bloc) {
    const ballF = Math.max(0, Math.min(1, (anchorX * sgn) / L + 0.5));
    const fMin = Math.min(...F.map(([f]) => f));
    const span = Math.max(0.01, Math.max(...F.map(([f]) => f)) - fMin);
    const ligneF = Math.max(0.05, Math.min(0.5, ballF - (bloc.ligne ?? 27) / L));
    const squeeze = ((bloc.long ?? 30) / L) / span;
    return F.map(([f, fz]) => {
      const fx = Math.max(0.04, Math.min(0.96, ligneF + (f - fMin) * squeeze));
      const z = Math.max(-pitch.hz + 1.5, Math.min(pitch.hz - 1.5, fz * pitch.hz * 0.92));
      return [g.x + sgn * fx * L, z];
    });
  }
  const slide = Math.max(-0.18, Math.min(0.18, (anchorX * sgn) / L));
  const breathe = attacking ? 1.05 : 0.85;
  return F.map(([f, fz]) => {
    const fx = Math.max(0.04, Math.min(0.96, f * breathe + slide + (attacking ? 0.05 : 0)));
    const z = Math.max(-pitch.hz + 1.5, Math.min(pitch.hz - 1.5, fz * pitch.hz * 0.92));
    return [g.x + sgn * fx * L, z];
  });
}

/** Le contrat de la formation — un bloc est un bloc, pas un nuage. GÉNÉRIQUE : les lignes
 *  viennent de LIGNES (la première version câblait 0-3/4-6/7-9 — vrai du seul 4-3-3). */
export function checkFormation(pitch, team, name = 433) {
  const issues = [];
  const lg = LIGNES[name] ?? LIGNES[433];
  const idx = [[0, lg[0] - 1], [lg[0], lg[0] + lg[1] - 1], [lg[0] + lg[1], 9]];   // [début, fin] par ligne
  if (lg[0] + lg[1] + lg[2] !== 10) issues.push(`lignes ${lg.join('-')} : la somme ne fait pas 10`);
  for (const [label, ax, atk] of [['repli', -pitch.hx * 0.3 * (team === 0 ? 1 : -1), false], ['projection', pitch.hx * 0.3 * (team === 0 ? 1 : -1), true]]) {
    const spots = formationSpots(pitch, team, ax, atk, name);
    if (spots.length !== 10) { issues.push(`${label} : ${spots.length} postes (≠ 10)`); continue; }
    for (const [x, z] of spots) {
      if (Math.abs(x) > pitch.hx - 1 || Math.abs(z) > pitch.hz - 1) issues.push(`${label} : poste hors terrain (${x.toFixed(1)}, ${z.toFixed(1)})`);
    }
    // les LIGNES restent ordonnées en profondeur (défense < milieu < attaque, vers l'avant)
    const sgn = -pitch.ownGoal(team).sign;
    const depth = (i) => spots[i][0] * sgn;
    const rg = ([a, b]) => spots.slice(a, b + 1).map((_, k) => depth(a + k));
    const [D, M, A] = idx.map(rg);
    if (!(Math.max(...D) < Math.min(...M) && Math.max(...M) < Math.min(...A))) {
      issues.push(`${label} : lignes croisées (déf ${Math.max(...D).toFixed(1)} / mil ${Math.min(...M).toFixed(1)}-${Math.max(...M).toFixed(1)} / att ${Math.min(...A).toFixed(1)})`);
    }
    // la LARGEUR existe, à l'échelle de la ligne : (n−1)/3 · 42 % de la largeur — calibré
    // contre le catalogue RÉEL (0,5 exigeait 22,7 m d'un trois arrière qui en couvre 20 : son
    // étroitesse est un CHOIX, les pistons donnent la largeur ; et 11,3 m d'un duo de pointes
    // qui en couvre 10 — deux 9 vivent à dix mètres, pas en siamois)
    for (const [li, [a, b]] of idx.entries()) {
      const zs = spots.slice(a, b + 1).map((s) => s[1]);
      const span = Math.max(...zs) - Math.min(...zs);
      const need = pitch.dims.width * 0.42 * ((b - a) / 3);
      if (span < need) issues.push(`${label} : ligne ${li} étroite (${span.toFixed(1)} m < ${need.toFixed(1)})`);
    }
  }
  // le BLOC COULISSE : l'ancre avancée pousse la ligne arrière plus haut qu'en repli
  const sgn = -pitch.ownGoal(team).sign;
  const repli = formationSpots(pitch, team, -sgn * pitch.hx * 0.4, false, name);
  const proj = formationSpots(pitch, team, sgn * pitch.hx * 0.4, true, name);
  if (!(proj[0][0] * sgn > repli[0][0] * sgn + 3)) issues.push('le bloc ne coulisse pas (ligne arrière immobile)');
  return { ok: issues.length === 0, issues };
}
