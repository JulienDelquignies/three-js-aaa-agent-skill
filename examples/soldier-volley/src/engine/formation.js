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
  // LE CATALOGUE EXHAUSTIF (lot 244, demande utilisateur : « ajoute toutes les formations
  // possibles ») — seize formations de plus, toujours des DONNÉES : les fractions d'hier ne
  // bougent pas d'un bit, les nouvelles s'ajoutent. Chaque poste a son NOM de la grille
  // (POSTES_FORMATION) : c'est la grille qui dit qui est piston, sentinelle, dix ou pointe.
  4312: [
    [0.15, -0.62], [0.12, -0.22], [0.12, 0.22], [0.15, 0.62],   // la ligne de quatre
    [0.30, -0.46], [0.27, 0.0], [0.30, 0.46],                    // le milieu à trois
    [0.44, 0.0],                                                 // le dix
    [0.56, -0.16], [0.56, 0.16],                                 // le duo de pointes
  ],
  41212: [
    [0.15, -0.62], [0.12, -0.22], [0.12, 0.22], [0.15, 0.62],   // la ligne de quatre
    [0.24, 0.0],                                                 // la sentinelle (le losange)
    [0.32, -0.46], [0.32, 0.46],                                 // les deux relayeurs
    [0.44, 0.0],                                                 // le dix
    [0.56, -0.16], [0.56, 0.16],                                 // le duo de pointes
  ],
  4132: [
    [0.15, -0.62], [0.12, -0.22], [0.12, 0.22], [0.15, 0.62],   // la ligne de quatre
    [0.24, 0.0],                                                 // la sentinelle
    [0.36, -0.65], [0.34, 0.0], [0.36, 0.65],                    // le milieu à trois large
    [0.55, -0.16], [0.55, 0.16],                                 // le duo de pointes
  ],
  4123: [
    [0.15, -0.62], [0.12, -0.22], [0.12, 0.22], [0.15, 0.62],   // la ligne de quatre
    [0.24, 0.0],                                                 // la sentinelle (4-3-3 pointe basse)
    [0.33, -0.38], [0.33, 0.38],                                 // les deux relayeurs
    [0.52, -0.78], [0.56, 0.0], [0.52, 0.78],                    // le trio offensif
  ],
  4213: [
    [0.15, -0.62], [0.12, -0.22], [0.12, 0.22], [0.15, 0.62],   // la ligne de quatre
    [0.27, -0.20], [0.27, 0.20],                                 // le double pivot
    [0.50, -0.78], [0.42, 0.0], [0.50, 0.78],                    // les ailiers hauts et le dix
    [0.58, 0.0],                                                 // la pointe
  ],
  424: [
    [0.15, -0.62], [0.12, -0.22], [0.12, 0.22], [0.15, 0.62],   // la ligne de quatre
    [0.30, -0.22], [0.30, 0.22],                                 // le duo de milieux
    [0.50, -0.78], [0.56, -0.16], [0.56, 0.16], [0.50, 0.78],    // deux ailiers, deux pointes
  ],
  460: [
    [0.15, -0.62], [0.12, -0.22], [0.12, 0.22], [0.15, 0.62],   // la ligne de quatre
    [0.27, -0.20], [0.27, 0.20],                                 // le double pivot
    [0.46, -0.72], [0.50, -0.20], [0.50, 0.20], [0.46, 0.72],    // quatre dix, pas de pointe (le faux neuf)
  ],
  3412: [
    [0.13, -0.33], [0.11, 0.0], [0.13, 0.33],                    // la ligne de trois
    [0.34, -0.78], [0.29, -0.22], [0.29, 0.22], [0.34, 0.78],    // le milieu à pistons
    [0.44, 0.0],                                                 // le dix
    [0.56, -0.16], [0.56, 0.16],                                 // le duo de pointes
  ],
  3511: [
    [0.13, -0.33], [0.11, 0.0], [0.13, 0.33],                    // la ligne de trois
    [0.34, -0.80], [0.30, -0.30], [0.26, 0.0], [0.30, 0.30], [0.34, 0.80],   // le milieu à cinq
    [0.44, 0.0],                                                 // le dix
    [0.58, 0.0],                                                 // la pointe
  ],
  3241: [
    [0.13, -0.33], [0.11, 0.0], [0.13, 0.33],                    // la ligne de trois
    [0.26, -0.20], [0.26, 0.20],                                 // le double pivot
    [0.44, -0.72], [0.46, -0.22], [0.46, 0.22], [0.44, 0.72],    // la ligne de quatre haute
    [0.58, 0.0],                                                 // la pointe
  ],
  31213: [
    [0.13, -0.33], [0.11, 0.0], [0.13, 0.33],                    // la ligne de trois
    [0.23, 0.0],                                                 // la sentinelle (le losange du 3-4-3)
    [0.31, -0.46], [0.31, 0.46],                                 // les deux relayeurs
    [0.42, 0.0],                                                 // le dix
    [0.52, -0.75], [0.56, 0.0], [0.52, 0.75],                    // le trio offensif
  ],
  3331: [
    [0.13, -0.33], [0.11, 0.0], [0.13, 0.33],                    // la ligne de trois
    [0.30, -0.75], [0.24, 0.0], [0.30, 0.75],                    // deux pistons autour de la sentinelle
    [0.46, -0.60], [0.48, 0.0], [0.46, 0.60],                    // trois dix
    [0.58, 0.0],                                                 // la pointe
  ],
  361: [
    [0.13, -0.33], [0.11, 0.0], [0.13, 0.33],                    // la ligne de trois
    [0.36, -0.80], [0.26, -0.20], [0.26, 0.20], [0.36, 0.80],    // pistons et double pivot
    [0.46, -0.31], [0.46, 0.31],                                 // les deux dix
    [0.58, 0.0],                                                 // la pointe
  ],
  5311: [
    [0.16, -0.72], [0.13, -0.36], [0.11, 0.0], [0.13, 0.36], [0.16, 0.72],   // la ligne de cinq
    [0.31, -0.46], [0.28, 0.0], [0.31, 0.46],                    // le milieu à trois
    [0.44, 0.0],                                                 // le dix
    [0.58, 0.0],                                                 // la pointe
  ],
  5221: [
    [0.16, -0.72], [0.13, -0.36], [0.11, 0.0], [0.13, 0.36], [0.16, 0.72],   // la ligne de cinq
    [0.27, -0.20], [0.27, 0.20],                                 // le double pivot
    [0.45, -0.31], [0.45, 0.31],                                 // les deux dix
    [0.58, 0.0],                                                 // la pointe
  ],
  523: [
    [0.16, -0.72], [0.13, -0.36], [0.11, 0.0], [0.13, 0.36], [0.16, 0.72],   // la ligne de cinq
    [0.30, -0.22], [0.30, 0.22],                                 // le duo de milieux
    [0.50, -0.75], [0.56, 0.0], [0.50, 0.75],                    // le trio offensif
  ],
};

/** LA FORMATION SE RÉSOUT PAR PHASE (lot 129, demande utilisateur : « une formation onball
 *  et offball ») : un nom simple vaut dans les deux mondes ; { on, off } bascule à la
 *  possession — le 433 qui défend en 451 est LA modernité tactique, et les corps convergent
 *  par servo (l'ancre lente lisse la transition : aucun téléport, aucune loi nouvelle). */
/** LE MAPPING DES POSTES on→off (lot 130, configurable — « n'importe quel poste avec
 *  n'importe quel autre ») : formation { on, off, map } — map[posteOn] = posteOff, le corps
 *  du poste k (formation ON) tient le poste map[k] du bloc défensif ; absent : l'identité
 *  (le comportement 129 au bit). Ex. 433→541 : { 6: 4, 8: 8 } — l'ailier devient piston. */
export function mapPostes(f) {
  const id = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  if (f && typeof f === 'object' && f.map) return id.map((k) => f.map[k] ?? k);
  return id;
}

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
  4321: { 5: 'recuperateur', 7: 'meneur', 8: 'meneur', 9: 'neufDeSurface' },   // 244c : le 6 est le M(C), pas l'intérieur gauche
  343: { 3: 'piston', 6: 'piston', 7: 'ailierDePercussion', 8: 'neufDeSurface', 9: 'ailierDePercussion' },
  3421: { 3: 'piston', 6: 'piston', 7: 'meneur', 8: 'meneur', 9: 'neufDeSurface' },
  532: { 6: 'recuperateur', 8: 'neufDeSurface', 9: 'neufDeSurface' },   // 244c : idem
  541: { 5: 'piston', 8: 'piston', 9: 'neufDeSurface' },
  4141: { 4: 'recuperateur', 5: 'piston', 8: 'piston', 9: 'neufDeSurface' },
  4222: { 4: 'recuperateur', 5: 'recuperateur', 6: 'meneur', 7: 'meneur', 8: 'neufDeSurface', 9: 'neufDeSurface' },
  4411: { 4: 'piston', 7: 'piston', 8: 'meneur', 9: 'neufDeSurface' },
  3142: { 3: 'recuperateur', 4: 'piston', 7: 'piston', 8: 'neufDeSurface', 9: 'neufDeSurface' },
  451: { 4: 'piston', 6: 'meneur', 8: 'piston', 9: 'neufDeSurface' },
  5212: { 5: 'recuperateur', 6: 'recuperateur', 7: 'meneur', 8: 'neufDeSurface', 9: 'neufDeSurface' },
  // 244 — dérivés de la grille (WB → piston, DM → récupérateur, AM axial → meneur, AM large →
  // ailier de percussion, ST → neuf de surface ; D et M : polyvalent, l'identité)
  4312: { 7: 'meneur', 8: 'neufDeSurface', 9: 'neufDeSurface' },
  41212: { 4: 'recuperateur', 7: 'meneur', 8: 'neufDeSurface', 9: 'neufDeSurface' },
  4132: { 4: 'recuperateur', 8: 'neufDeSurface', 9: 'neufDeSurface' },
  4123: { 4: 'recuperateur', 7: 'ailierDePercussion', 8: 'neufDeSurface', 9: 'ailierDePercussion' },
  4213: { 4: 'recuperateur', 5: 'recuperateur', 6: 'ailierDePercussion', 7: 'meneur', 8: 'ailierDePercussion', 9: 'neufDeSurface' },
  424: { 6: 'ailierDePercussion', 7: 'neufDeSurface', 8: 'neufDeSurface', 9: 'ailierDePercussion' },
  460: { 4: 'recuperateur', 5: 'recuperateur', 6: 'ailierDePercussion', 7: 'meneur', 8: 'meneur', 9: 'ailierDePercussion' },
  3412: { 3: 'piston', 6: 'piston', 7: 'meneur', 8: 'neufDeSurface', 9: 'neufDeSurface' },
  3511: { 3: 'piston', 7: 'piston', 8: 'meneur', 9: 'neufDeSurface' },
  3241: { 3: 'recuperateur', 4: 'recuperateur', 5: 'ailierDePercussion', 6: 'meneur', 7: 'meneur', 8: 'ailierDePercussion', 9: 'neufDeSurface' },
  31213: { 3: 'recuperateur', 6: 'meneur', 7: 'ailierDePercussion', 8: 'neufDeSurface', 9: 'ailierDePercussion' },
  3331: { 3: 'piston', 4: 'recuperateur', 5: 'piston', 6: 'ailierDePercussion', 7: 'meneur', 8: 'ailierDePercussion', 9: 'neufDeSurface' },
  361: { 3: 'piston', 4: 'recuperateur', 5: 'recuperateur', 6: 'piston', 7: 'meneur', 8: 'meneur', 9: 'neufDeSurface' },
  5311: { 0: 'piston', 4: 'piston', 8: 'meneur', 9: 'neufDeSurface' },
  5221: { 0: 'piston', 4: 'piston', 5: 'recuperateur', 6: 'recuperateur', 7: 'meneur', 8: 'meneur', 9: 'neufDeSurface' },
  523: { 0: 'piston', 4: 'piston', 7: 'ailierDePercussion', 8: 'neufDeSurface', 9: 'ailierDePercussion' },
};

// ======================================================================= LES POSTES NOMMÉS
// (lot 244, demande utilisateur : « est-ce que le moteur gère bien tous les postes attendus ? »
// — la grille GK / D / WB / DM / M / AM / ST, côtés G · CG · C · CD · D). Hier, un poste était
// un INDICE (0-9) et le moteur ne connaissait que trois strates (LIGNES) : le dix comptait
// parmi les pointes, la sentinelle parmi les milieux, le piston tantôt défenseur tantôt milieu.
// La grille est la DONNÉE qui manquait : chaque indice de chaque formation porte son NOM, et
// les strates fines en découlent (lignesFines). Le repère : G = fz négatif, D = fz positif,
// vus de son propre but ; C = l'axe, CG/CD = |fz| ≤ 0,5, G/D = plus large ; pour les pointes,
// G/D nomment simplement la gauche et la droite d'un duo (la grille n'a pas de ST(CG)).
// Aucune LOI ne lit encore la grille (244a = la donnée ; 244b = les lois : dédoublement par le
// nom, pointes = strates AM+ST, familiarité de poste côté joueur) — au bit près, hier.
export const STRATES = ['GK', 'D', 'WB', 'DM', 'M', 'AM', 'ST'];
export const COTES = ['G', 'CG', 'C', 'CD', 'D'];
/** La grille des 24 postes (+ le gardien) : strate → côtés admis. */
export const GRILLE = { GK: ['C'], D: ['G', 'CG', 'C', 'CD', 'D'], WB: ['G', 'D'], DM: ['CG', 'C', 'CD'],
  M: ['G', 'CG', 'C', 'CD', 'D'], AM: ['G', 'CG', 'C', 'CD', 'D'], ST: ['G', 'C', 'D'] };
const D4 = ['D(G)', 'D(CG)', 'D(CD)', 'D(D)'], D3 = ['D(CG)', 'D(C)', 'D(CD)'], D5 = ['WB(G)', 'D(CG)', 'D(C)', 'D(CD)', 'WB(D)'];
export const POSTES_FORMATION = {
  433: [...D4, 'M(CG)', 'M(C)', 'M(CD)', 'AM(G)', 'ST(C)', 'AM(D)'],
  442: [...D4, 'M(G)', 'M(CG)', 'M(CD)', 'M(D)', 'ST(G)', 'ST(D)'],
  352: [...D3, 'WB(G)', 'M(CG)', 'M(C)', 'M(CD)', 'WB(D)', 'ST(G)', 'ST(D)'],
  4231: [...D4, 'DM(CG)', 'DM(CD)', 'AM(G)', 'AM(C)', 'AM(D)', 'ST(C)'],
  4321: [...D4, 'M(CG)', 'M(C)', 'M(CD)', 'AM(CG)', 'AM(CD)', 'ST(C)'],
  343: [...D3, 'WB(G)', 'M(CG)', 'M(CD)', 'WB(D)', 'AM(G)', 'ST(C)', 'AM(D)'],
  3421: [...D3, 'WB(G)', 'M(CG)', 'M(CD)', 'WB(D)', 'AM(CG)', 'AM(CD)', 'ST(C)'],
  532: [...D5, 'M(CG)', 'M(C)', 'M(CD)', 'ST(G)', 'ST(D)'],
  541: [...D5, 'M(G)', 'M(CG)', 'M(CD)', 'M(D)', 'ST(C)'],
  4141: [...D4, 'DM(C)', 'M(G)', 'M(CG)', 'M(CD)', 'M(D)', 'ST(C)'],
  4222: [...D4, 'DM(CG)', 'DM(CD)', 'AM(CG)', 'AM(CD)', 'ST(G)', 'ST(D)'],
  4411: [...D4, 'M(G)', 'M(CG)', 'M(CD)', 'M(D)', 'AM(C)', 'ST(C)'],
  3142: [...D3, 'DM(C)', 'WB(G)', 'M(CG)', 'M(CD)', 'WB(D)', 'ST(G)', 'ST(D)'],
  451: [...D4, 'M(G)', 'M(CG)', 'M(C)', 'M(CD)', 'M(D)', 'ST(C)'],
  5212: [...D5, 'DM(CG)', 'DM(CD)', 'AM(C)', 'ST(G)', 'ST(D)'],
  4312: [...D4, 'M(CG)', 'M(C)', 'M(CD)', 'AM(C)', 'ST(G)', 'ST(D)'],
  41212: [...D4, 'DM(C)', 'M(CG)', 'M(CD)', 'AM(C)', 'ST(G)', 'ST(D)'],
  4132: [...D4, 'DM(C)', 'M(G)', 'M(C)', 'M(D)', 'ST(G)', 'ST(D)'],
  4123: [...D4, 'DM(C)', 'M(CG)', 'M(CD)', 'AM(G)', 'ST(C)', 'AM(D)'],
  4213: [...D4, 'DM(CG)', 'DM(CD)', 'AM(G)', 'AM(C)', 'AM(D)', 'ST(C)'],
  424: [...D4, 'M(CG)', 'M(CD)', 'AM(G)', 'ST(G)', 'ST(D)', 'AM(D)'],
  460: [...D4, 'DM(CG)', 'DM(CD)', 'AM(G)', 'AM(CG)', 'AM(CD)', 'AM(D)'],
  3412: [...D3, 'WB(G)', 'M(CG)', 'M(CD)', 'WB(D)', 'AM(C)', 'ST(G)', 'ST(D)'],
  3511: [...D3, 'WB(G)', 'M(CG)', 'M(C)', 'M(CD)', 'WB(D)', 'AM(C)', 'ST(C)'],
  3241: [...D3, 'DM(CG)', 'DM(CD)', 'AM(G)', 'AM(CG)', 'AM(CD)', 'AM(D)', 'ST(C)'],
  31213: [...D3, 'DM(C)', 'M(CG)', 'M(CD)', 'AM(C)', 'AM(G)', 'ST(C)', 'AM(D)'],
  3331: [...D3, 'WB(G)', 'DM(C)', 'WB(D)', 'AM(G)', 'AM(C)', 'AM(D)', 'ST(C)'],
  361: [...D3, 'WB(G)', 'DM(CG)', 'DM(CD)', 'WB(D)', 'AM(CG)', 'AM(CD)', 'ST(C)'],
  5311: [...D5, 'M(CG)', 'M(C)', 'M(CD)', 'AM(C)', 'ST(C)'],
  5221: [...D5, 'DM(CG)', 'DM(CD)', 'AM(CG)', 'AM(CD)', 'ST(C)'],
  523: [...D5, 'M(CG)', 'M(CD)', 'AM(G)', 'ST(C)', 'AM(D)'],
};

/** « D(CG) » → { strate: 'D', cote: 'CG' } ; le gardien → GK(C) ; inconnu → null. */
export function litPoste(nom) {
  const m = /^(GK|D|WB|DM|M|AM|ST)\((G|CG|C|CD|D)\)$/.exec(nom ?? '');
  return m ? { strate: m[1], cote: m[2] } : null;
}
/** Le nom du poste k (0-9) de la formation, le gardien pour k ≥ 10 ; formation inconnue → 433. */
export function posteNom(name = 433, k = 0) {
  if (k >= 10 || k == null) return 'GK(C)';
  return (POSTES_FORMATION[name] ?? POSTES_FORMATION[433])[k] ?? null;
}
/** Les STRATES FINES d'une formation : { D, WB, DM, M, AM, ST } comptés (GK = 1 toujours). */
export function lignesFines(name = 433) {
  const out = { GK: 1, D: 0, WB: 0, DM: 0, M: 0, AM: 0, ST: 0 };
  for (const n of POSTES_FORMATION[name] ?? POSTES_FORMATION[433]) { const p = litPoste(n); if (p) out[p.strate]++; }
  return out;
}
/** La grille est-elle SAINE pour cette formation ? Dix noms de la grille, le côté qui suit le
 *  signe de fz (et sa largeur), les strates ordonnées en profondeur (D < DM < M < AM < ST en
 *  moyenne, WB devant D), la strate WB/D et la strate M à la largeur d'une LIGNE (les dix, les
 *  sentinelles et les pointes ont le droit d'être étroits — le sapin, le losange), et les
 *  strates GROSSIÈRES (LIGNES) qui recomptent la grille (défense = D + WB de la ligne basse). */
export function checkPostes(name = 433) {
  const issues = [], F = FORMATIONS[name], N = POSTES_FORMATION[name], lg = LIGNES[name];
  if (!F || !N || !lg) return { ok: false, issues: [`formation ${name} : catalogue incomplet (spots ${!!F}, postes ${!!N}, lignes ${!!lg})`] };
  if (N.length !== 10) issues.push(`${N.length} noms (≠ 10)`);
  const par = {}, seen = new Set();
  N.forEach((nom, k) => {
    const p = litPoste(nom), [f, fz] = F[k] ?? [0, 0];
    if (!p || !GRILLE[p.strate].includes(p.cote)) { issues.push(`poste ${k} : « ${nom} » hors grille`); return; }
    if (seen.has(nom)) issues.push(`poste ${k} : « ${nom} » en double`); seen.add(nom);
    const c = p.cote, g = c === 'G' || c === 'CG', d = c === 'D' || c === 'CD';
    if (c === 'C' ? fz !== 0 : g ? fz >= 0 : fz <= 0) issues.push(`poste ${k} : « ${nom} » du mauvais côté (fz ${fz})`);
    if (p.strate !== 'ST' && p.strate !== 'WB' && (c === 'CG' || c === 'CD') && Math.abs(fz) > 0.5) issues.push(`poste ${k} : « ${nom} » trop large pour un intérieur (fz ${fz})`);
    if (p.strate !== 'ST' && (c === 'G' || c === 'D') && Math.abs(fz) <= 0.5) issues.push(`poste ${k} : « ${nom} » trop étroit pour un large (fz ${fz})`);
    (par[p.strate] ??= []).push({ k, f, fz });
  });
  const moy = (s) => par[s] ? par[s].reduce((a, q) => a + q.f, 0) / par[s].length : null;
  let prev = null;
  for (const s of ['D', 'DM', 'M', 'AM', 'ST']) { const m = moy(s); if (m == null) continue; if (prev != null && m <= prev.m) issues.push(`strate ${s} (${m.toFixed(2)}) pas devant ${prev.s} (${prev.m.toFixed(2)})`); prev = { s, m }; }
  if (moy('WB') != null && moy('WB') <= moy('D')) issues.push('les pistons ne sont pas devant les centraux');
  const largeur = (s, n) => { const zs = (par[s] ?? []).map((q) => q.fz); return zs.length ? (Math.max(...zs) - Math.min(...zs)) * 0.92 * 34 / (0.42 * 68 * ((n - 1) / 3) || 1) : 1; };
  const nDef = (par.D?.length ?? 0) + (par.WB ?? []).filter((q) => q.f < 0.2).length;
  if (largeur('D', par.D?.length ?? 1) < 1 && (par.D?.length ?? 0) >= 4) issues.push('ligne D étroite');
  if ((par.M?.length ?? 0) >= 3 && largeur('M', par.M.length) < 0.85) issues.push('strate M étroite');
  if (nDef !== lg[0]) issues.push(`LIGNES[0] = ${lg[0]} mais la grille compte ${nDef} défenseurs (D + WB bas)`);
  if (lg[0] + lg[1] + lg[2] !== 10) issues.push(`LIGNES ${lg.join('-')} ne somme pas 10`);
  return { ok: issues.length === 0, issues };
}

/** LES LIGNES sont une DONNÉE (défense, milieu, attaque) : c'est ce qui généralise le calage
 *  Loi 11 (« postes ≥ 7 » n'était vrai qu'en 4-3-3), les clauses du contrat, et demain les
 *  rôles par ligne. La somme fait toujours 10 (Loi 3 : onze joueurs, un gardien). */
export const LIGNES = { 433: [4, 3, 3], 442: [4, 4, 2], 352: [3, 5, 2],
  4231: [4, 2, 4], 4321: [4, 3, 3], 343: [3, 4, 3], 3421: [3, 4, 3],
  532: [5, 3, 2], 541: [5, 4, 1], 4141: [4, 5, 1], 4222: [4, 4, 2], 4411: [4, 4, 2],
  3142: [3, 5, 2], 451: [4, 5, 1], 5212: [5, 3, 2],
  // 244 — les seize du catalogue exhaustif (trois strates : la géométrie des lois d'hier)
  4312: [4, 4, 2], 41212: [4, 4, 2], 4132: [4, 4, 2], 4123: [4, 3, 3], 4213: [4, 2, 4], 424: [4, 2, 4], 460: [4, 2, 4],
  3412: [3, 5, 2], 3511: [3, 6, 1], 3241: [3, 2, 5], 31213: [3, 4, 3], 3331: [3, 3, 4], 361: [3, 4, 3],
  5311: [5, 4, 1], 5221: [5, 2, 3], 523: [5, 2, 3] };

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
    // LA POUSSE (lot 141, bloc.pousse — retour utilisateur : « la défense a tendance à trop
    // reculer sans être proactive ») : mesuré, la ligne arrière de l'équipe QUI ATTAQUE
    // plafonnait au rond central (p50 +0,7 m en attaque installée ; réel +5…+12 — les
    // centraux de possession VIVENT dans le camp adverse, c'est eux qui compriment le jeu
    // et rendent le contre-press possible). Le plafond se LÈVE continûment quand le ballon
    // est profond (dès `des`, gain × la profondeur, max ~12 m au-delà du rond) — le gain
    // porte l'axe hauteurBloc au call-site (le prudent reste au rond). Absent : hier au bit.
    const pou = bloc.pousse;
    const capA = 0.5 + (pou ? Math.min((pou.max ?? 12) / L, Math.max(0, ballF - (pou.des ?? 0.62)) * (pou.gain ?? 0.8)) : 0);
    const ligneF = Math.max(0.12, Math.min(capA, ballF - bloc.soutien / L));
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
    ligne: (bloc.ligne ?? 27) + ax(tq?.hauteurBloc, 4, -4) + ax(tq?.piege, 3, -3),   // LE PIÈGE (149) : l'agressivité du hors-jeu tient la ligne haute — 0,5 = +0
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
  const gl = hyp(gx, gz) || 1;
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
import { hyp } from './hyp.js';
