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
  // LE CATALOGUE COMPLET (lot 127, demande utilisateur : « les différentes formations
  // possibles ») — chaque formation reste une DONNÉE : dix postes, trois lignes, et les
  // rôles par défaut (ROLES_FORMATION) qu'un projet pose ou remplace. Le bloc, la
  // largeur, la hauteur, la Loi 11 : les mêmes lois coulissent tous ces mondes.
  4231: [
    [0.15, -0.62], [0.12, -0.22], [0.12, 0.22], [0.15, 0.62],   // la ligne de quatre
    [0.27, -0.20], [0.27, 0.20],                                 // le double pivot
    [0.44, -0.70], [0.46, 0.0], [0.44, 0.70],                    // le 10 et ses ailiers
    [0.58, 0.0],                                                 // la pointe
  ],
  4321: [
    [0.15, -0.62], [0.12, -0.22], [0.12, 0.22], [0.15, 0.62],   // la ligne de quatre
    [0.30, -0.40], [0.27, 0.0], [0.30, 0.40],                    // le milieu à trois
    [0.46, -0.25], [0.46, 0.25],                                 // les deux dix (le sapin)
    [0.58, 0.0],                                                 // la pointe
  ],
  343: [
    [0.13, -0.33], [0.11, 0.0], [0.13, 0.33],                    // la ligne de trois
    [0.34, -0.70], [0.30, -0.22], [0.30, 0.22], [0.34, 0.70],    // le milieu à quatre
    [0.52, -0.75], [0.56, 0.0], [0.52, 0.75],                    // le trio offensif
  ],
  3421: [
    [0.13, -0.33], [0.11, 0.0], [0.13, 0.33],                    // la ligne de trois
    [0.34, -0.75], [0.29, -0.22], [0.29, 0.22], [0.34, 0.75],    // le milieu à pistons
    [0.48, -0.30], [0.48, 0.30],                                 // les deux dix
    [0.58, 0.0],                                                 // la pointe
  ],
  532: [
    [0.16, -0.72], [0.13, -0.36], [0.11, 0.0], [0.13, 0.36], [0.16, 0.72],   // la ligne de cinq
    [0.32, -0.40], [0.28, 0.0], [0.32, 0.40],                    // le milieu à trois
    [0.54, -0.18], [0.54, 0.18],                                 // le duo de pointes
  ],
  541: [
    [0.16, -0.72], [0.13, -0.36], [0.11, 0.0], [0.13, 0.36], [0.16, 0.72],   // la ligne de cinq (le bus)
    [0.33, -0.62], [0.29, -0.20], [0.29, 0.20], [0.33, 0.62],    // le milieu à quatre
    [0.55, 0.0],                                                 // la pointe seule
  ],
  4141: [
    [0.15, -0.62], [0.12, -0.22], [0.12, 0.22], [0.15, 0.62],   // la ligne de quatre
    [0.24, 0.0],                                                 // la sentinelle
    [0.38, -0.65], [0.34, -0.22], [0.34, 0.22], [0.38, 0.65],    // la ligne de quatre haute
    [0.56, 0.0],                                                 // la pointe
  ],
  4222: [
    [0.15, -0.62], [0.12, -0.22], [0.12, 0.22], [0.15, 0.62],   // la ligne de quatre
    [0.27, -0.20], [0.27, 0.20],                                 // le double pivot
    [0.44, -0.50], [0.44, 0.50],                                 // les deux dix larges
    [0.56, -0.15], [0.56, 0.15],                                 // le duo de pointes
  ],
  4411: [
    [0.15, -0.62], [0.12, -0.22], [0.12, 0.22], [0.15, 0.62],   // la ligne de quatre
    [0.36, -0.68], [0.30, -0.22], [0.30, 0.22], [0.36, 0.68],    // le milieu à quatre
    [0.48, 0.0],                                                 // le dix en soutien
    [0.58, 0.0],                                                 // la pointe
  ],
  3142: [
    [0.13, -0.33], [0.11, 0.0], [0.13, 0.33],                    // la ligne de trois
    [0.23, 0.0],                                                 // la sentinelle
    [0.37, -0.70], [0.33, -0.22], [0.33, 0.22], [0.37, 0.70],    // la ligne de quatre haute
    [0.55, -0.16], [0.55, 0.16],                                 // le duo de pointes
  ],
  451: [
    [0.15, -0.62], [0.12, -0.22], [0.12, 0.22], [0.15, 0.62],   // la ligne de quatre
    [0.35, -0.72], [0.30, -0.28], [0.27, 0.0], [0.30, 0.28], [0.35, 0.72],   // le milieu à cinq
    [0.56, 0.0],                                                 // la pointe seule
  ],
  5212: [
    [0.16, -0.72], [0.13, -0.36], [0.11, 0.0], [0.13, 0.36], [0.16, 0.72],   // la ligne de cinq
    [0.28, -0.20], [0.28, 0.20],                                 // le double pivot
    [0.44, 0.0],                                                 // le dix
    [0.56, -0.16], [0.56, 0.16],                                 // le duo de pointes
  ],
};

/** LA FORMATION SE RÉSOUT PAR PHASE (lot 129, demande utilisateur : « une formation onball
 *  et offball ») : un nom simple vaut dans les deux mondes ; { on, off } bascule à la
 *  possession — le 433 qui défend en 451 est LA modernité tactique, et les corps convergent
 *  par servo (l'ancre lente lisse la transition : aucun téléport, aucune loi nouvelle). */
export function formationPour(f, attacking) {
  if (f && typeof f === 'object') return String(attacking ? (f.on ?? 433) : (f.off ?? f.on ?? 433));
  return String(f ?? 433);
}

/** Les RÔLES PAR DÉFAUT de chaque formation (data — un projet les passe à makeMatch({roles})
 *  tels quels ou les remplace ; absents : polyvalent partout, l'identité). Le 4231 vit de son
 *  10 (meneur), le 532/541 de ses pistons, le 4141 de sa sentinelle (récupérateur). */
export const ROLES_FORMATION = {
  433: { 5: 'meneur', 7: 'ailierDePercussion', 8: 'neufDeSurface', 9: 'ailierDePercussion' },
  442: { 4: 'piston', 7: 'piston', 8: 'neufDeSurface', 9: 'neufDeSurface' },
  352: { 3: 'piston', 5: 'meneur', 7: 'piston', 8: 'neufDeSurface', 9: 'neufDeSurface' },
  4231: { 4: 'recuperateur', 5: 'recuperateur', 6: 'ailierDePercussion', 7: 'meneur', 8: 'ailierDePercussion', 9: 'neufDeSurface' },
  4321: { 4: 'recuperateur', 7: 'meneur', 8: 'meneur', 9: 'neufDeSurface' },
  343: { 3: 'piston', 6: 'piston', 7: 'ailierDePercussion', 8: 'neufDeSurface', 9: 'ailierDePercussion' },
  3421: { 3: 'piston', 6: 'piston', 7: 'meneur', 8: 'meneur', 9: 'neufDeSurface' },
  532: { 5: 'recuperateur', 8: 'neufDeSurface', 9: 'neufDeSurface' },
  541: { 5: 'piston', 8: 'piston', 9: 'neufDeSurface' },
  4141: { 4: 'recuperateur', 5: 'piston', 8: 'piston', 9: 'neufDeSurface' },
  4222: { 4: 'recuperateur', 5: 'recuperateur', 6: 'meneur', 7: 'meneur', 8: 'neufDeSurface', 9: 'neufDeSurface' },
  4411: { 4: 'piston', 7: 'piston', 8: 'meneur', 9: 'neufDeSurface' },
  3142: { 3: 'recuperateur', 4: 'piston', 7: 'piston', 8: 'neufDeSurface', 9: 'neufDeSurface' },
  451: { 4: 'piston', 6: 'meneur', 8: 'piston', 9: 'neufDeSurface' },
  5212: { 5: 'recuperateur', 6: 'recuperateur', 7: 'meneur', 8: 'neufDeSurface', 9: 'neufDeSurface' },
};

/** LES LIGNES sont une DONNÉE (défense, milieu, attaque) : c'est ce qui généralise le calage
 *  Loi 11 (« postes ≥ 7 » n'était vrai qu'en 4-3-3), les clauses du contrat, et demain les
 *  rôles par ligne. La somme fait toujours 10 (Loi 3 : onze joueurs, un gardien). */
export const LIGNES = { 433: [4, 3, 3], 442: [4, 4, 2], 352: [3, 5, 2],
  4231: [4, 2, 4], 4321: [4, 3, 3], 343: [3, 4, 3], 3421: [3, 4, 3],
  532: [5, 3, 2], 541: [5, 4, 1], 4141: [4, 5, 1], 4222: [4, 4, 2], 4411: [4, 4, 2],
  3142: [3, 5, 2], 451: [4, 5, 1], 5212: [5, 3, 2] };

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
export function formationSpots(pitch, team, anchorX, attacking, name = 433, bloc = null, anchorZ = 0, out = null) {
  const g = pitch.ownGoal(team);
  const sgn = -g.sign;                                            // vers l'avant
  const L = pitch.dims.length;
  const F = FORMATIONS[name] ?? FORMATIONS[433];
  // `out` (lot 69 — le GC du téléphone) : un buffer fourni est RÉUTILISÉ (10 paires mutées en
  // place, zéro allocation par frame — le moteur appelle 2×/frame) ; sans lui, des tableaux
  // neufs aux mêmes valeurs (les bancs et les appels ponctuels ne changent pas d'un bit).
  const res = out ?? [];
  const emit = (i, x, z) => { const s = res[i] ??= [0, 0]; s[0] = x; s[1] = z; };
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
    // …ET LE BLOC COULISSE LATÉRALEMENT (lot 47, bloc.lateral — la v2 nommée au lot 42) :
    // le bloc entier GLISSE vers le côté ballon (réel : 6-10 m) — sans lui, le couloir d'aile
    // restait indéfendu et la perce du wingDrive convertissait à 73 % (mesuré : 38 buts sur
    // 20 × 300 s, bande 17-30 — l'ailier passait dans un couloir vide).
    const zShift = Math.max(-(bloc.slideMax ?? 8), Math.min(bloc.slideMax ?? 8, anchorZ * (bloc.lateral ?? 0.35)));
    for (let i = 0; i < F.length; i++) {
      const [f, fz] = F[i];
      const fx = Math.max(0.04, Math.min(0.96, ligneF + (f - fMin) * squeeze));
      // …ET LE CÔTÉ FAIBLE PINCE (lot 96, bloc.pince — l'axe tactics.marquage via blocFor,
      // gate cfg.zone au call-site) : ballon large → le slot du côté OPPOSÉ rentre vers l'axe
      // (réel : le latéral faible vit à 8-14 m de l'axe, mesuré avant à 17,3). Absent : 1, hier.
      let pz = fz * pitch.hz * 0.92;
      if (bloc.pince != null && Math.abs(anchorZ) > 6 && Math.sign(fz || 1) !== Math.sign(anchorZ)) pz *= bloc.pince;
      emit(i, g.x + sgn * fx * L, Math.max(-pitch.hz + 1.5, Math.min(pitch.hz - 1.5, pz + zShift)));
    }
    res.length = F.length;
    return res;
  }
  // LA LIGNE ARRIÈRE ATTAQUANTE EST CHAÎNÉE AU BALLON AUSSI (lot 51, bloc.soutien — retour
  // utilisateur « des défenseurs bien trop bas par rapport à l'équipe, sans sens tactique ») :
  // mesuré avant, la ligne arrière de l'équipe EN POSSESSION campait p10 à 6 m de son but
  // (traînard p90 25,5 m derrière la ligne p25 de sa propre équipe) — le slide ±18 % d'origine
  // clampait fx à 0,04 en construction basse. La loi du vrai football : quand l'équipe a le
  // ballon, sa ligne arrière MONTE en soutien (~`soutien` m derrière le ballon, réel 15-25),
  // plancher 0,12·L (jamais campée), plafond au rond central — et le bloc attaquant garde sa
  // LONGUEUR étirée (`longAtk` m, réel 35-50 : la respiration offensive d'hier, en mieux tenu).
  // `soutien` absent : le monde d'hier, au bit près (la clé gate la greffe).
  if (attacking && bloc && bloc.soutien != null) {
    const ballF = Math.max(0, Math.min(1, (anchorX * sgn) / L + 0.5));
    const fMin = Math.min(...F.map(([f]) => f));
    const span = Math.max(0.01, Math.max(...F.map(([f]) => f)) - fMin);
    const ligneF = Math.max(0.12, Math.min(0.5, ballF - bloc.soutien / L));
    const stretch = ((bloc.longAtk ?? 42) / L) / span;
    // LE LATÉRAL CÔTÉ FAIBLE RENTRE ET MONTE (lot 68, bloc.rentre — retour utilisateur « je vois
    // toujours le latéral opposé de l'équipe en possession des dizaines de mètres derrière les
    // autres joueurs » : mesuré, retard sur la médiane d'équipe p50 10,4 / p90 22,0 m, 3 graines
    // × 300 s — large ET bas, isolé de tous). Le vrai football en possession : le latéral côté
    // ballon vit haut dans son couloir, le latéral OPPOSÉ referme la « ligne de 3 » — il rentre
    // vers l'axe (z × ~0,5) et monte de ~rentre m vers le milieu (jamais au-dessus : sa ligne
    // reste ordonnée sous les milieux à stretch réel). Ne touche que les ARRIÈRES LARGES
    // (|fz| ≥ 0,5 de la ligne basse — un 3-5-2 n'en a pas, ses pistons sont des milieux) du côté
    // opposé au ballon (fz·anchorZ < 0), montée progressive dès |z ballon| > 6 m (pleine à 14).
    // `rentre` absent : le latéral abandonné d'hier, au bit près (sabotage nommé).
    const lgD = (LIGNES[name] ?? LIGNES[433])[0];
    const wFar = bloc.rentre != null ? Math.max(0, Math.min(1, (Math.abs(anchorZ) - 6) / 8)) : 0;
    // LA SURCHARGE CÔTÉ BALLON (lot 98, bloc.surcharge — retour utilisateur « il faut fixer du
    // côté ballon » : mesuré, 57 possessions sur 96 meurent au médian, offre courte p50 2).
    // Le vrai football EN possession SURNOMBRE le côté ballon : les postes INTÉRIEURS
    // (|fz| < 0,5 — relayeurs, pointe axiale) glissent vers le couloir du ballon (≤ surMax) ;
    // les LARGES tiennent leur rôle structurel — l'ailier côté ballon EST déjà le couloir,
    // l'ailier faible garde la largeur (la sortie du renversement GAGNÉ, lot 98a ; l'arrière
    // faible rentre déjà par `rentre`). L'axe relation surcharge plus (les triangles), l'axe
    // largeur moins (l'amplitude d'abord) — via blocFor. Absent : les postes d'hier, au bit.
    const zSur = bloc.surcharge != null
      ? Math.max(-(bloc.surMax ?? 6), Math.min(bloc.surMax ?? 6, anchorZ * bloc.surcharge)) : 0;
    for (let i = 0; i < F.length; i++) {
      const [f, fz] = F[i];
      const rentre = i < lgD && Math.abs(fz) >= 0.5 && fz * anchorZ < 0 ? wFar : 0;
      // …le FRONT reste LIBRE (0,96 comme partout) : un plafond à 0,80 essayé exilait les
      // pointes à 31 m du but — tirs effondrés (13 sur 8 × 180 s, deux graines à zéro). Les
      // pointes DANSENT sur la ligne (calage Loi 11 sur les postes) — le temps illicite
      // transitoire monte à 4-6 % (borne re-fondée), c'est le prix du bloc haut du vrai
      // football, pas du camping injouable.
      const fx = Math.max(0.04, Math.min(0.96, ligneF + (f - fMin) * stretch + rentre * (bloc.rentre ?? 9) / L));
      const sur = Math.abs(fz) < 0.5 ? zSur : 0;                  // les intérieurs convergent, les larges tiennent
      emit(i, g.x + sgn * fx * L, Math.max(-pitch.hz + 1.5, Math.min(pitch.hz - 1.5, fz * pitch.hz * 0.92 * (1 - 0.5 * rentre) + sur)));
    }
    res.length = F.length;
    return res;
  }
  const slide = Math.max(-0.18, Math.min(0.18, (anchorX * sgn) / L));
  const breathe = attacking ? 1.05 : 0.85;
  for (let i = 0; i < F.length; i++) {
    const [f, fz] = F[i];
    const fx = Math.max(0.04, Math.min(0.96, f * breathe + slide + (attacking ? 0.05 : 0)));
    emit(i, g.x + sgn * fx * L, Math.max(-pitch.hz + 1.5, Math.min(pitch.hz - 1.5, fz * pitch.hz * 0.92)));
  }
  res.length = F.length;
  return res;
}

/** LE BLOC DE CETTE ÉQUIPE (lot 43 — réponse à « les blocs sont bien liés à la tactique ?
 *  c'est pas les mêmes pour tout le monde ? ») : la base moteur (cfg.bloc) modulée par SA
 *  tactique — `compacite` serre la longueur (±4 m : 1 = étau 26 m, 0 = relâché 34), et
 *  `hauteurBloc` rapproche la ligne du ballon (±4 m : presse haute = ligne courte 23,
 *  bloc bas = ligne longue 31 — le décalage ±6 m du bloc posté compose par-dessus).
 *  À 0,5 EXACTEMENT : la base, pas un bit (l'identité au défaut). UNE vérité, partagée
 *  moteur/banc — pur. */
export function blocFor(bloc, tq, zone = false) {
  if (!bloc) return null;
  const ax = (v, lo, hi) => lo + Math.max(0, Math.min(1, v ?? 0.5)) * (hi - lo);
  return {
    ...bloc,                                                       // lateral/slideMax passent tels quels
    long: (bloc.long ?? 30) + ax(tq?.compacite, 4, -4),
    ligne: (bloc.ligne ?? 27) + ax(tq?.hauteurBloc, 4, -4),
    // la PINCE du côté faible (lot 96) ne vit que sous cfg.zone (le call-site la gate) —
    // l'axe marquage : la zone pince fort (0,62), l'homme-à-homme tient sa craie (1,0)
    ...(zone ? { pince: ax(tq?.marquage, 0.62, 1.0) } : {}),
    // la SURCHARGE côté ballon (lot 98) : le jeu de relation surnombre (×1,4), l'équipe
    // d'amplitude garde ses postes (×0,7) — à 0,5/0,5 : la base exactement
    ...(bloc.surcharge != null ? { surcharge: bloc.surcharge * ax(tq?.relation, 0.6, 1.4) * ax(tq?.largeur, 1.3, 0.7) } : {}),
  };
}

/** LE POINT DE COUVERTURE (lots 11/96) : sur l'axe ballon → but défendu, borné [coverMinDist ; 6]
 *  à 35 % du chemin — la cible du cover ET de l'assurance de pressing (i===2, lot 96). */
export function coverSpot(defGoal, anchor, cfg) {
  const gx = defGoal.x - anchor[0], gz = 0 - anchor[2];
  const gl = Math.hypot(gx, gz) || 1;
  const dd = Math.max(cfg.coverMinDist, Math.min(6, gl * 0.35));
  return [anchor[0] + (gx / gl) * dd, 0, anchor[2] + (gz / gl) * dd];
}

/** LE MARQUAGE BALLSIDE (lot 96, cfg.zone — l'axe tactics.marquage) : retire des marques les
 *  hommes du CÔTÉ FAIBLE (écart latéral au ballon > bLim, HORS surface) — la ZONE les couvre
 *  (slots pincés + coulissement). Mesuré avant : 80 % du bloc en homme-à-homme intégral,
 *  coulissement 0,08, ligne arrière à 13,5 m d'écart. Le renversement est l'arme honnête contre. */
export function ballsideTrim(marks, anchorZ, pitch, sgnDef, bLim) {
  for (let k = marks.length - 1; k >= 0; k--) {
    const a = marks[k];
    const enSurface = a.p[0] * sgnDef > pitch.hx - pitch.dims.box.depth - 2 && Math.abs(a.p[2]) < pitch.dims.box.width / 2 + 3;
    if (!enSurface && Math.abs(a.p[2] - anchorZ) > bLim) marks.splice(k, 1);
  }
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
