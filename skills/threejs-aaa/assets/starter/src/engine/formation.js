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
};

/**
 * Les dix postes de `team` en coordonnées monde, pour un ballon à `anchorX` et un état de
 * possession. Le bloc coulisse (± 18 % du terrain), la profondeur respire (× 1,05 en attaque,
 * × 0,85 sans le ballon — un bloc défensif est un bloc COURT).
 */
export function formationSpots(pitch, team, anchorX, attacking, name = 433) {
  const g = pitch.ownGoal(team);
  const sgn = -g.sign;                                            // vers l'avant
  const slide = Math.max(-0.18, Math.min(0.18, (anchorX * sgn) / pitch.dims.length));
  const breathe = attacking ? 1.05 : 0.85;
  return (FORMATIONS[name] ?? FORMATIONS[433]).map(([f, fz]) => {
    const fx = Math.max(0.04, Math.min(0.96, f * breathe + slide + (attacking ? 0.05 : 0)));
    const z = Math.max(-pitch.hz + 1.5, Math.min(pitch.hz - 1.5, fz * pitch.hz * 0.92));
    return [g.x + sgn * fx * pitch.dims.length, z];
  });
}

/** Le contrat de la formation — un bloc est un bloc, pas un nuage. */
export function checkFormation(pitch, team, name = 433) {
  const issues = [];
  for (const [label, ax, atk] of [['repli', -pitch.hx * 0.3 * (team === 0 ? 1 : -1), false], ['projection', pitch.hx * 0.3 * (team === 0 ? 1 : -1), true]]) {
    const spots = formationSpots(pitch, team, ax, atk, name);
    if (spots.length !== 10) { issues.push(`${label} : ${spots.length} postes (≠ 10)`); continue; }
    for (const [x, z] of spots) {
      if (Math.abs(x) > pitch.hx - 1 || Math.abs(z) > pitch.hz - 1) issues.push(`${label} : poste hors terrain (${x.toFixed(1)}, ${z.toFixed(1)})`);
    }
    // les LIGNES restent ordonnées en profondeur (défense < milieu < attaque, vers l'avant)
    const sgn = -pitch.ownGoal(team).sign;
    const depth = (i) => spots[i][0] * sgn;
    const dMax = Math.max(depth(0), depth(1), depth(2), depth(3));
    const mMin = Math.min(depth(4), depth(5), depth(6)), mMax = Math.max(depth(4), depth(5), depth(6));
    const aMin = Math.min(depth(7), depth(8), depth(9));
    if (!(dMax < mMin && mMax < aMin)) issues.push(`${label} : lignes croisées (déf ${dMax.toFixed(1)} / mil ${mMin.toFixed(1)}-${mMax.toFixed(1)} / att ${aMin.toFixed(1)})`);
    // la LARGEUR existe (la ligne de 4 couvre ≥ 55 % de la largeur ; le trio ≥ 65 %)
    const span = (a, b) => Math.abs(spots[a][1] - spots[b][1]);
    if (span(0, 3) < pitch.dims.width * 0.5) issues.push(`${label} : ligne de 4 étroite (${span(0, 3).toFixed(1)} m)`);
    if (span(7, 9) < pitch.dims.width * 0.55) issues.push(`${label} : trio offensif étroit (${span(7, 9).toFixed(1)} m)`);
  }
  // le BLOC COULISSE : l'ancre avancée pousse la ligne de 4 plus haut qu'en repli
  const sgn = -pitch.ownGoal(team).sign;
  const repli = formationSpots(pitch, team, -sgn * pitch.hx * 0.4, false, name);
  const proj = formationSpots(pitch, team, sgn * pitch.hx * 0.4, true, name);
  if (!(proj[0][0] * sgn > repli[0][0] * sgn + 3)) issues.push('le bloc ne coulisse pas (ligne de 4 immobile)');
  return { ok: issues.length === 0, issues };
}
