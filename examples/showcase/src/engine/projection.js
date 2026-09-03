// projection.js — L'ENTRE-LIGNES (231). La bibliothèque : « la recherche permanente du jeu entre les lignes »
// (Comment regarder, l. 559-571), « s'intercaler entre les lignes, toucher beaucoup de ballons entre les lignes »
// (Comment gagner, l. 3376, 3509), « le troisième homme, l'homme libre » (l. 6664-6737). Mesuré AVANT (possession
// installée en camp adverse, 6 × 300 s) : ligne arrière −16,9 m du ballon (réel 15-25, bon), MILIEU −5,2 m, avant
// +9,0 ; corps devant le ballon : milieu 0,70, avant 2,07 ; entre-lignes milieu → avant 15,6 m — les 8 vivaient
// derrière le ballon, personne entre les lignes ; l'attaque gardait 6,5 corps derrière le ballon (réel 4-5).
// La loi : en possession INSTALLÉE (≥ installe s après le regain) et ballon à x ≥ depuis, les INTÉRIEURS postés
// (la ligne du milieu sans son premier poste, le pivot — il reste la sécurité) voient leur spot ON tiré (part)
// vers x = ballon + entre × axe(hauteurBloc, 0,6, 1,4) × axe(rôle profondeur, 0,4, 1,6), jamais derrière leur spot,
// borné par la ligne de hors-jeu − marge (entre les lignes, pas derrière la dernière). La largeur est celle du spot
// (le demi-espace de la formation). Le patron Unity/Unreal : la loi ici, les nombres dans cfg.projection, l'équipe
// par son axe, l'homme par son rôle. Absente : le monde 229/230 au bit.
import { LIGNES, mapPostes, formationPour } from './formation.js';

/** @returns Map poste → [x, z, part] (monde), ou null. `exclude` : les postes déjà pris (compensateurs). */
export function projeterMilieux(st, cfg, { atk, posted, spots, sg, formation, off, role, tac, axe, exclude }) {
  const P = cfg.projection; if (!P || !st.full) return null;
  if (st.t - (st._possChangeAt ?? -99) < (P.installe ?? 3)) return null;
  const bx = st.ball.p[0] * sg; if (bx < (P.depuis ?? 0)) return null;
  const ids = mapPostes(formation), L = LIGNES[formationPour(formation, true)] ?? [4, 3, 3], nD = L[0], nM = L[1];
  const hb = axe(tac(st, atk).hauteurBloc, 0.6, 1.4);
  const ligne = off ? off.adv - (P.marge ?? 3) : Infinity;
  let out = null;
  for (const m of ids.slice(nD + 1, nD + nM)) {
    if (exclude?.has(m)) continue;
    const q = posted.find((p) => p.post === m), sp = spots[m]; if (!q || !sp) continue;
    const entre = (P.entre ?? 6) * hb * axe(role(q).profondeur, 0.4, 1.6);
    const x = Math.min(bx + entre, ligne);
    if (x <= sp[0] * sg) continue;
    (out ??= new Map()).set(m, [x * sg, sp[1], P.part ?? 0.7]);
  }
  return out;
}

/** Les postes « entre les lignes » du moment (les intérieurs sous les conditions de la projection) — lus par
 *  l'ÉLECTION des soutiens : à −5 m du ballon ils étaient élus soutiens et jamais postés, la boucle qui les gardait
 *  derrière. Dispensés du comité, ils sont postés — et projetés. null : rien à dispenser. */
export function postesEntreLignes(st, cfg, { atk, sg, formation }) {
  const P = cfg.projection; if (!P || !st.full || P.dispense === false) return null;
  if (st.t - (st._possChangeAt ?? -99) < (P.installe ?? 3) || st.ball.p[0] * sg < (P.depuis ?? 0)) { if (st._entreL?.[atk]) st._entreL[atk] = null; return null; }
  const ids = mapPostes(formation), L = LIGNES[formationPour(formation, true)] ?? [4, 3, 3];
  return ((st._entreL ??= {})[atk] = new Set(ids.slice(L[0] + 1, L[0] + L[1])));
}

/** Le poste vit-il entre les lignes en ce moment ? Lu par l'accompagnement (phases.js) : l'intérieur projeté OFFRE la
 *  ligne, il ne sprinte pas accompagner le porteur — élu « un par côté » il volait le débordement du latéral (36 → 16). */
export function estEntreLignes(st, team, post) {
  const S = st._entreL?.[team]; return !!S && S.has(post) && st.t - (st._possChangeAt ?? -99) >= (st._entreLT ?? 0);
}
