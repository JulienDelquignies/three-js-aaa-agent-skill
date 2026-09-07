import { POSTES_FORMATION, litPoste, lignesFines, estLateral, formationPour } from './formation.js';
// roles.js — LES RÔLES PAR POSTE : le poste dit OÙ (formation.js), le rôle dit QUOI (les biais
// de comportement), l'attribut dit COMMENT ça réussit (attributes.js) — trois couches qui se
// COMPOSENT sans se confondre. Même grammaire que la tactique (lot 15) : des axes à identité
// par défaut, un catalogue de points nommés par la culture football, et un projet aval qui pose
// les siens sans toucher au moteur.
//
// Un rôle est un PETIT objet de biais, consommé par des lois DÉJÀ prouvées :
//   profondeur [0..1] — le poste se tient plus haut (le 9 sur la ligne) ou décroche (le 10
//                        entre les lignes) : ±2,5 m sur la cible de poste (le calage Loi 11
//                        GARDE le dernier mot — un 9 haut reste calé sur la ligne)
//   largeurR   [0..1] — le poste se tient plus large (l'ailier qui craie la ligne) ou rentre
//                        (l'ailier repiqueur) : ×0,9…1,1 sur le z de poste, COMPOSE avec la
//                        largeur d'équipe (tactics)
//   appel      [0..1] — la cadence des appels profonds PERSONNELS (cooldown 14…6 s — le 9
//                        vit de ses courses, le meneur vit du ballon)
//   arbitre            — les poids {tir, centre, passe, conduite} du joueur (±15 %), composés
//                        avec le style d'ÉQUIPE dans menace.js : un 9 direct dans une équipe
//                        possession reste un 9 — nuancé, pas écrasé
//
// LE DÉFAUT EST L'IDENTITÉ : polyvalent = 0,5 / ×1 partout — aucun rôle posé, pas un bit ne
// bouge (la batterie le prouve). Dettes nommées : les rôles de PRESSING (qui déclenche, qui
// couvre) et le catalogue de formations 4-4-2 / 3-5-2 (généraliser « postes ≥ 7 » en lignes).

export const ROLES = {
  polyvalent:          { profondeur: 0.5, largeurR: 0.5, appel: 0.5, press: 0.5, garde: 0.5, dribble: 0.5, arbitre: { tir: 1, centre: 1, passe: 1, conduite: 1 } },
  neufDeSurface:       { profondeur: 0.9, largeurR: 0.4, appel: 0.9, press: 0.65, arbitre: { tir: 1.15, centre: 0.95, passe: 0.9, conduite: 0.95 } },
  ailierDePercussion:  { profondeur: 0.55, largeurR: 0.9, appel: 0.6, press: 0.6, arbitre: { tir: 0.95, centre: 1.12, passe: 0.9, conduite: 1.15 } },
  meneur:              { profondeur: 0.15, largeurR: 0.45, appel: 0.2, press: 0.25, arbitre: { tir: 0.9, centre: 0.95, passe: 1.15, conduite: 1 } },
  ailierInterieur:     { profondeur: 0.6, largeurR: 0.15, appel: 0.7, press: 0.5, arbitre: { tir: 1.18, centre: 0.8, passe: 1, conduite: 1.1 } },   // 178 : le FAUX AILIER — il rentre dans le demi-espace et frappe ; la craie ÉCHOIT au latéral (ancresCraie)
  piston:              { profondeur: 0.75, largeurR: 0.95, appel: 0.75, press: 0.7, arbitre: { tir: 0.9, centre: 1.15, passe: 1, conduite: 1.05 } },
  // le 6 — le métier DÉFENSIF de la couche rôles (lot 19) : il colle son marquage, il saute
  // en second presseur, il ne dérape pas en appels profonds
  recuperateur:        { profondeur: 0.35, largeurR: 0.45, appel: 0.25, press: 0.95, arbitre: { tir: 0.85, centre: 0.9, passe: 1.08, conduite: 0.92 } },
  // LES STYLES DE GARDIEN (lot 94) — l'axe `garde` [0..1], identité 0,5 : la profondeur max de
  // position (keeper.keeperSpot ×[0,7 ; 1,3] via gardeF). Le LIBÉRO vit haut (couvrir la
  // profondeur d'un bloc haut), le gardien DE LIGNE reste chez lui — le rôle se pose sur le
  // POSTE du gardien (le dernier) comme tout rôle : makeMatch({ roles: [{ 10: 'gardienLibero' }] }).
  gardienDeLigne:      { garde: 0.15, arbitre: { tir: 1, centre: 1, passe: 1, conduite: 1 } },
  gardienLibero:       { garde: 0.9, arbitre: { tir: 1, centre: 1, passe: 1, conduite: 1 } },
  // ======================================================== LE CATALOGUE DES RÔLES (lot 244c,
  // fourni par le projet aval « FM » — l'utilisateur : « ils utilisent ça eux ») : 34 rôles
  // écrits SUR NOS ONZE AXES (profondeur, largeurR, appel, press, garde, ancrage, tenue, duel,
  // marqueSerre, ressort, orienteFaible) + arbitre. Le moteur possède les LOIS et les axes ; le
  // rôle est une DONNÉE — ce catalogue en est la preuve : pas une loi n'a bougé pour l'accueillir,
  // et les onze axes sont tous lus par une loi (vérifié, 244c). Les identifiants sont ceux du
  // projet aval (snake_case), les libellés dans LIBELLES_ROLES. Les neuf rôles d'hier restent
  // (les bancs et les projets qui les posent : au bit). Aucun rôle posé par défaut : polyvalent.
  // les gardiens (2)
  goalkeeper:            { garde: 0.15, ancrage: 0.05, tenue: 0.15, ressort: 0.3 },
  keeper_libero:         { garde: 0.9, ancrage: 0.25, tenue: 0.3, ressort: 0.85, arbitre: { passe: 1.07 } , interdits: ['resterChezLui'] },
  // les défenseurs centraux (5)
  centre_back:           { profondeur: 0.1, largeurR: 0.25, appel: 0.1, press: 0.5, ancrage: 0.2, tenue: 0.3, duel: 0.55, marqueSerre: 0.55, ressort: 0.4, orienteFaible: 0.55 },
  stopper:               { profondeur: 0.12, largeurR: 0.22, appel: 0.1, press: 0.7, ancrage: 0.3, tenue: 0.2, duel: 0.8, marqueSerre: 0.8, ressort: 0.25, orienteFaible: 0.6 },
  cover:                 { profondeur: 0.06, largeurR: 0.25, appel: 0.08, press: 0.3, ancrage: 0.15, tenue: 0.3, duel: 0.25, marqueSerre: 0.25, ressort: 0.45, orienteFaible: 0.65 , interdits: ['tacleGlisse'] },
  playmaker_defender:    { profondeur: 0.12, largeurR: 0.28, appel: 0.12, press: 0.45, ancrage: 0.3, tenue: 0.6, duel: 0.4, marqueSerre: 0.45, ressort: 0.85, orienteFaible: 0.55, arbitre: { passe: 1.21, conduite: 1.06, tir: 0.83 } },
  libero:                { profondeur: 0.18, largeurR: 0.25, appel: 0.15, press: 0.4, ancrage: 0.45, tenue: 0.55, duel: 0.35, marqueSerre: 0.3, ressort: 0.8, orienteFaible: 0.5, arbitre: { passe: 1.16, conduite: 1.18 } },
  // les latéraux et pistons (4)
  full_back:             { profondeur: 0.25, largeurR: 0.8, appel: 0.25, press: 0.55, ancrage: 0.35, tenue: 0.35, duel: 0.55, marqueSerre: 0.65, ressort: 0.45, orienteFaible: 0.6, arbitre: { centre: 1.1 } },
  wing_back:             { profondeur: 0.45, largeurR: 0.95, appel: 0.45, press: 0.6, ancrage: 0.5, tenue: 0.35, duel: 0.5, marqueSerre: 0.55, ressort: 0.5, orienteFaible: 0.5, arbitre: { centre: 1.25, conduite: 1.06 } , repli: 0.3 },
  inverted_fullback:     { profondeur: 0.28, largeurR: 0.3, appel: 0.2, press: 0.55, ancrage: 0.45, tenue: 0.5, duel: 0.5, marqueSerre: 0.6, ressort: 0.7, orienteFaible: 0.6, arbitre: { passe: 1.12, centre: 0.7 } , interdits: ['deborde'] },
  modern_wingback:       { profondeur: 0.5, largeurR: 0.88, appel: 0.55, press: 0.65, ancrage: 0.55, tenue: 0.4, duel: 0.55, marqueSerre: 0.6, ressort: 0.6, orienteFaible: 0.55, arbitre: { centre: 1.2, conduite: 1.12 } , repli: 0.35 },
  // les milieux défensifs (4)
  anchor:                { profondeur: 0.15, largeurR: 0.3, appel: 0.05, press: 0.45, ancrage: 0.1, tenue: 0.35, duel: 0.55, marqueSerre: 0.55, ressort: 0.65, orienteFaible: 0.6, arbitre: { passe: 1.02, tir: 0.77 } , interdits: ['tirLoin', 'projection'] },
  half_back:             { profondeur: 0.1, largeurR: 0.28, appel: 0.05, press: 0.5, ancrage: 0.15, tenue: 0.4, duel: 0.5, marqueSerre: 0.5, ressort: 0.75, orienteFaible: 0.6, arbitre: { passe: 1.12, tir: 0.73 } },
  regista:               { profondeur: 0.25, largeurR: 0.3, appel: 0.2, press: 0.35, ancrage: 0.3, tenue: 0.75, duel: 0.3, marqueSerre: 0.35, ressort: 0.9, orienteFaible: 0.45, arbitre: { passe: 1.3, tir: 0.83, conduite: 0.82 } , interdits: ['tacleGlisse'] },
  destroyer:             { profondeur: 0.18, largeurR: 0.35, appel: 0.08, press: 0.9, ancrage: 0.4, tenue: 0.2, duel: 0.9, marqueSerre: 0.75, ressort: 0.3, orienteFaible: 0.7, arbitre: { passe: 0.79, tir: 0.7, conduite: 0.7 } },
  // les milieux centraux (5)
  box_to_box:            { profondeur: 0.45, largeurR: 0.45, appel: 0.55, press: 0.7, ancrage: 0.65, tenue: 0.45, duel: 0.65, marqueSerre: 0.55, ressort: 0.5, orienteFaible: 0.5, arbitre: { tir: 1.1 } , repli: 0.2 },
  deep_lying_playmaker:  { profondeur: 0.28, largeurR: 0.35, appel: 0.2, press: 0.4, ancrage: 0.3, tenue: 0.7, duel: 0.35, marqueSerre: 0.4, ressort: 0.85, orienteFaible: 0.45, arbitre: { passe: 1.25, tir: 0.87 } },
  mezzala:               { profondeur: 0.55, largeurR: 0.6, appel: 0.6, press: 0.55, ancrage: 0.6, tenue: 0.55, duel: 0.5, marqueSerre: 0.45, ressort: 0.6, orienteFaible: 0.45, arbitre: { conduite: 1.18, tir: 1.1 } , repli: 0.35 },
  carrilero:             { profondeur: 0.38, largeurR: 0.65, appel: 0.35, press: 0.65, ancrage: 0.35, tenue: 0.4, duel: 0.6, marqueSerre: 0.6, ressort: 0.55, orienteFaible: 0.55, arbitre: { passe: 1.02, tir: 0.9 } , repli: 0.15 },
  free_role_creator:     { profondeur: 0.55, largeurR: 0.4, appel: 0.55, press: 0.35, ancrage: 0.95, tenue: 0.85, duel: 0.3, marqueSerre: 0.25, ressort: 0.7, orienteFaible: 0.35, arbitre: { passe: 1.21, conduite: 1.24, tir: 1.1 } , repli: 0.6 },
  // les milieux offensifs (3)
  attacking_midfielder:  { profondeur: 0.62, largeurR: 0.4, appel: 0.65, press: 0.45, ancrage: 0.6, tenue: 0.65, duel: 0.4, marqueSerre: 0.35, ressort: 0.6, orienteFaible: 0.4, arbitre: { passe: 1.12, tir: 1.13 } , repli: 0.45 },
  trequartista:          { profondeur: 0.6, largeurR: 0.35, appel: 0.55, press: 0.2, ancrage: 0.85, tenue: 0.85, duel: 0.2, marqueSerre: 0.15, ressort: 0.65, orienteFaible: 0.3, arbitre: { passe: 1.21, conduite: 1.3, tir: 1.1 } , interdits: ['tirDesespere'] , repli: 0.7 },
  shadow_striker:        { profondeur: 0.72, largeurR: 0.35, appel: 0.85, press: 0.5, ancrage: 0.7, tenue: 0.4, duel: 0.4, marqueSerre: 0.3, ressort: 0.5, orienteFaible: 0.35, arbitre: { tir: 1.23, passe: 0.84 } , repli: 0.7 },
  // les ailiers (5)
  winger:                { profondeur: 0.6, largeurR: 0.95, appel: 0.6, press: 0.45, ancrage: 0.4, tenue: 0.55, duel: 0.35, marqueSerre: 0.3, ressort: 0.5, orienteFaible: 0.35, arbitre: { centre: 1.3, conduite: 1.18, tir: 0.97 } , repli: 0.5 },
  inside_forward:        { profondeur: 0.68, largeurR: 0.45, appel: 0.75, press: 0.45, ancrage: 0.6, tenue: 0.6, duel: 0.35, marqueSerre: 0.3, ressort: 0.5, orienteFaible: 0.35, arbitre: { tir: 1.27, conduite: 1.24, centre: 0.7 } , repli: 0.6 },
  wide_creator:          { profondeur: 0.55, largeurR: 0.75, appel: 0.45, press: 0.4, ancrage: 0.55, tenue: 0.7, duel: 0.3, marqueSerre: 0.3, ressort: 0.65, orienteFaible: 0.35, arbitre: { passe: 1.21, centre: 1.15, conduite: 1.12 } , interdits: ['repli'] , repli: 0.9 },
  raumdeuter:            { profondeur: 0.7, largeurR: 0.55, appel: 0.95, press: 0.35, ancrage: 0.9, tenue: 0.2, duel: 0.25, marqueSerre: 0.2, ressort: 0.45, orienteFaible: 0.3, arbitre: { tir: 1.23, conduite: 0.7, centre: 0.8 } , repli: 0.8 },
  tracking_winger:       { profondeur: 0.5, largeurR: 0.85, appel: 0.4, press: 0.85, ancrage: 0.3, tenue: 0.35, duel: 0.7, marqueSerre: 0.8, ressort: 0.45, orienteFaible: 0.65, arbitre: { centre: 1.1, conduite: 0.88 } , interdits: ['relacherPress'] , repli: 0.1 },
  // les attaquants (6)
  forward:               { profondeur: 0.78, largeurR: 0.35, appel: 0.75, press: 0.45, ancrage: 0.55, tenue: 0.45, duel: 0.4, marqueSerre: 0.3, ressort: 0.45, orienteFaible: 0.35, arbitre: { tir: 1.2 } , repli: 0.85 },
  target_man:            { profondeur: 0.72, largeurR: 0.25, appel: 0.35, press: 0.35, ancrage: 0.25, tenue: 0.6, duel: 0.45, marqueSerre: 0.25, ressort: 0.3, orienteFaible: 0.3, arbitre: { tir: 1.17, passe: 1.02, conduite: 0.7 } , repli: 0.85 },
  poacher:               { profondeur: 0.85, largeurR: 0.28, appel: 0.9, press: 0.25, ancrage: 0.35, tenue: 0.15, duel: 0.2, marqueSerre: 0.15, ressort: 0.3, orienteFaible: 0.25, arbitre: { tir: 1.3, passe: 0.7, conduite: 0.7 } , interdits: ['decrochage'] , repli: 0.9 },
  all_around_striker:    { profondeur: 0.72, largeurR: 0.4, appel: 0.7, press: 0.55, ancrage: 0.6, tenue: 0.45, duel: 0.55, marqueSerre: 0.4, ressort: 0.55, orienteFaible: 0.45, arbitre: { tir: 1.17, passe: 1.07, conduite: 1.06 } , repli: 0.7 },
  pressing_striker:      { profondeur: 0.7, largeurR: 0.4, appel: 0.65, press: 0.95, ancrage: 0.55, tenue: 0.25, duel: 0.8, marqueSerre: 0.55, ressort: 0.4, orienteFaible: 0.7, arbitre: { tir: 1.13 } , repli: 0.6 },
  false_9:               { profondeur: 0.52, largeurR: 0.32, appel: 0.6, press: 0.45, ancrage: 0.8, tenue: 0.75, duel: 0.35, marqueSerre: 0.3, ressort: 0.7, orienteFaible: 0.4, arbitre: { passe: 1.21, conduite: 1.18, tir: 1.1 } , interdits: ['tete'] , repli: 0.75 },
  // ======================================================== LES RÔLES DU DOCUMENT (lot 248, Campagne V —
  // Recherche_Tactique_Individuelle §3 : 8 postes × 2-4 rôles = 25 rôles). Vingt existaient dans le catalogue aval
  // (ROLES_DOCUMENT les apparie) ; cinq manquaient — vecteurs [CONVENTION] posés dans la bande d'arbitre [0,7 ; 1,3],
  // à dater sur fixture. Les INTERDITS (« ce qu'il lui est formellement interdit ») sont une DONNÉE BINAIRE du rôle,
  // hors de la bande d'arbitre : une loi les consulte AVANT d'agir (interdit(p, 'deborde') — le dédoublement le lit).
  fullback_third_cb:     { profondeur: 0.12, largeurR: 0.5, appel: 0.1, press: 0.5, ancrage: 0.2, tenue: 0.35, duel: 0.6, marqueSerre: 0.65, ressort: 0.4, orienteFaible: 0.6, arbitre: { centre: 0.8 }, interdits: ['deborde', 'projection'] },
  wide_playmaker_fullback: { profondeur: 0.3, largeurR: 0.75, appel: 0.2, press: 0.45, ancrage: 0.35, tenue: 0.6, duel: 0.35, marqueSerre: 0.5, ressort: 0.8, orienteFaible: 0.5, arbitre: { passe: 1.3, centre: 1.2, conduite: 0.85 }, interdits: ['dribbleElimination'] },
  half_space_playmaker:  { profondeur: 0.5, largeurR: 0.55, appel: 0.45, press: 0.5, ancrage: 0.45, tenue: 0.85, duel: 0.4, marqueSerre: 0.4, ressort: 0.7, orienteFaible: 0.45, arbitre: { passe: 1.25, centre: 0.7, tir: 0.95 }, interdits: ['centreAerien'] , repli: 0.4 },
  vertical_creator:      { profondeur: 0.55, largeurR: 0.6, appel: 0.55, press: 0.55, ancrage: 0.6, tenue: 0.2, duel: 0.45, marqueSerre: 0.45, ressort: 0.55, orienteFaible: 0.5, arbitre: { passe: 1.2, centre: 1.3, tir: 1.05 }, interdits: ['possessionSterile'] , repli: 0.4 },
  deep_lying_forward:    { profondeur: 0.6, largeurR: 0.35, appel: 0.45, press: 0.5, ancrage: 0.6, tenue: 0.7, duel: 0.55, marqueSerre: 0.35, ressort: 0.55, orienteFaible: 0.4, arbitre: { passe: 1.2, tir: 1.05, conduite: 0.9 }, interdits: ['plante'] , repli: 0.75 },
};

/** Résout un nom ou un objet partiel en rôle complet (absent = polyvalent, l'identité). */
export function resoudreRole(r, refus = null) {
  // LE RÔLE PAR PHASE (lot 130, demande utilisateur : « ça implique un rôle offball
  // onball ? » — OUI, composé par NATURE D'AXE) : les axes OFFENSIFS (profondeur, largeurR,
  // appel, arbitre) viennent du rôle ON, les axes DÉFENSIFS (press, garde) du rôle OFF —
  // composé UNE fois à la création, aucun call-site ne change, zéro coût runtime. Un rôle
  // simple vaut dans les deux phases (l'identité d'hier au bit).
  if (r && typeof r === 'object' && (r.on != null || r.off != null)) {
    const on = resoudreRole(r.on, refus), off = resoudreRole(r.off ?? r.on, refus);
    return { ...on, press: off.press, garde: off.garde, duel: off.duel, marqueSerre: off.marqueSerre, ressort: off.ressort, orienteFaible: off.orienteFaible, repli: off.repli, interdits: new Set([...on.interdits, ...off.interdits]), nom: on.nom + '/' + off.nom };
  }
  const base = typeof r === 'string' ? (ROLES[r] ?? ROLES.polyvalent) : (r ?? {});
  return {
    profondeur: base.profondeur ?? 0.5, largeurR: base.largeurR ?? 0.5, appel: base.appel ?? 0.5, press: base.press ?? 0.5,
    garde: base.garde ?? 0.5,
    // LES CONSIGNES DÉFENSIVES PAR JOUEUR (lot 196, demande projet aval — l'attribut est la
    // capacité, la consigne est le CHOIX du coach ; quatre axes continus, identité 0,5) :
    // duel (se jeter/rester debout), marqueSerre (coller/laisser respirer), ressort (dégager
    // ou ressortir sous pression — le bloc bas de Simeone c. celui de Guardiola),
    // orienteFaible (l'angle d'approche qui force le pied faible du porteur).
    duel: base.duel ?? 0.5, marqueSerre: base.marqueSerre ?? 0.5, ressort: base.ressort ?? 0.5, orienteFaible: base.orienteFaible ?? 0.5,
    // L'ANCRAGE (200, demande aval) : 0 = colle à son poste, 1 = vagabonde — l'axe qui sépare
    // le meneur libre du carrilero (élection du comité + mou du recalage, match-sim). ON-phase.
    ancrage: base.ancrage ?? 0.5,
    // LA TENUE (211) : 0 = joue vite (le relayeur), 1 = garde le ballon (le meneur qui fixe) —
    // la cadence de la tenue calme du porteur (rondo-sim, × axe(0,7, 1,4)). ON-phase.
    tenue: base.tenue ?? 0.5,
    // LE REPLI (251, Campagne V — débat 3 : Simeone/Conte c. Mourinho) : 0 = rentre toujours, 1 = dispensé ; identité 0,5 = l'élection positionnelle d'hier (le plus devant garde son poste). L'équipe dit COMBIEN (tactics.repli), le rôle dit QUI. OFF-phase.
    repli: base.repli ?? 0.5,
    // LE DRIBBLE (219, rappelé au 244e par le projet aval) : l'axe existait au catalogue et skills-sim le lit, mais la résolution le perdait (undefined) — reporté, identité 0,5
    dribble: base.dribble ?? 0.5,
    arbitre: { tir: 1, centre: 1, passe: 1, conduite: 1, ...(base.arbitre ?? {}) },
    // LES INTERDITS (248) : ceux du rôle ∪ les REFUS du joueur (squads[i].refus) — binaires, hors de la bande d'arbitre ; vide par défaut
    interdits: new Set([...(base.interdits ?? []), ...(refus ?? [])]),
    nom: typeof r === 'string' ? r : (base.nom ?? 'personnalisé'),
  };
}
/** Le rôle du joueur interdit-il ce geste ? (248) — vocabulaire gelé : docs/Interface_Campagne_V.md */
export function interdit(p, nom) { return !!p?.role?.interdits?.has(nom); }

/** Le rôle d'un joueur — TOUJOURS résolu (aucun rôle posé : polyvalent). */
export function role(p) { return p?.role ?? ROLES.polyvalent; }

/** Le contrat : catalogue borné, polyvalent identitaire, résolution honnête. */
export function checkRoles() {
  const issues = [];
  for (const [nom, r] of Object.entries(ROLES)) {
    for (const k of ['profondeur', 'largeurR', 'appel', 'press', 'garde', 'dribble']) {
      if (r[k] < 0 || r[k] > 1) issues.push(`${nom}.${k} hors [0;1]`);
    }
    // l'arbitre ABSENT est l'identité (244e — resoudreRole le remplit) ; la bande [0,7 ; 1,3] est la LOI : le catalogue aval y est re-échelonné, pas la bande élargie (244b l'avait fait, 244e le défait : « un rôle nuance, il n'écrase pas » redevient vrai)
    for (const [o, v] of Object.entries(r.arbitre ?? {})) if (v < 0.7 || v > 1.3) issues.push(`${nom}.arbitre.${o} = ${v} hors [0,7;1,3] — un rôle nuance, il n'écrase pas`);
  }
  for (const nom of Object.keys(ROLES)) {   // 244e (retour aval) : tout rôle du catalogue SE RÉSOUT, et le résolu respecte les bornes
    const q = resoudreRole(nom);
    for (const [o, v] of Object.entries(q.arbitre)) if (!(v >= 0.7 && v <= 1.3)) issues.push(`${nom} résolu : arbitre.${o} = ${v}`);
    if (!(q.dribble >= 0 && q.dribble <= 1)) issues.push(`${nom} résolu : dribble ${q.dribble} — l'axe se perd à la résolution`);
  }
  const p = ROLES.polyvalent;
  if (p.profondeur !== 0.5 || p.largeurR !== 0.5 || p.appel !== 0.5 || p.press !== 0.5 || p.garde !== 0.5 || (p.dribble ?? 0.5) !== 0.5
    || Object.values(p.arbitre).some((v) => v !== 1)) issues.push('polyvalent n\'est pas l\'identité');
  const d = resoudreRole(undefined);
  if (d.profondeur !== 0.5 || d.garde !== 0.5 || d.arbitre.tir !== 1) issues.push('un rôle absent ne résout pas en identité');
  if (resoudreRole('meneur').arbitre.passe !== 1.15) issues.push('resoudreRole ne résout pas un nom');
  return { ok: issues.length === 0, issues };
}

/** LE DÉDOUBLEMENT (lot 88, cfg.deborde — la course de rôle du couloir) : porteur LARGE et
 *  offensif → son LATÉRAL (posts 0/3, même côté) dépasse par l'extérieur, par le canal des
 *  appels (_pace 'deborde' : le porteur voit les coureurs). La cadence est le RÔLE (piston
 *  souvent, récupérateur presque jamais) ; l'ailier INVERSÉ (lot 87) qui repique LIBÈRE ce
 *  couloir. Retourne la cible de course ou null. false : le latéral qui reste chez lui. */
export function deborde(st, p, carrier, pitch, atk, cfg, axe) {
  if (!st.full || cfg.deborde === false || !carrier || carrier.keeper || interdit(p, 'deborde')) return null;   // (248) le latéral inversé ou bloqué ne déborde pas : un INTERDIT de rôle, pas un multiplicateur
  if (cfg.postesNommes ? !estLateral(formationPour(st.tactics?.[atk]?.formation, true), p.post ?? 0) : (p.post !== 0 && p.post !== 3)) return null;   // 244b : le latéral DE LA GRILLE (WB ou D large) — hier les indices 0/3
  const sg = -pitch.ownGoal(atk).sign;
  if ((p._ovT ?? -1) <= st.t
    && Math.abs(carrier.p[2]) > pitch.hz * 0.42
    && Math.sign(p.p[2] || 1) === Math.sign(carrier.p[2] || 1)
    && carrier.p[0] * sg > pitch.hx * 0.1) {
    p._ovT = st.t + 8 / Math.max(0.3, axe(role(p).appel, 0.4, 1.6));
    p._ovUntil = st.t + 1.6;
    p._pace = { until: st.t + 1.5, kind: 'deborde', next: p._pace?.next ?? st.t + 8 };
    st.events.push({ t: +st.t.toFixed(2), type: 'burst', kind: 'deborde', by: p.id });
  }
  if ((p._ovUntil ?? -1) > st.t) return [
    Math.max(-pitch.hx + 1.5, Math.min(pitch.hx - 1.5, carrier.p[0] + sg * 9)),
    Math.sign(carrier.p[2] || 1) * Math.min(pitch.hz - 1.5, Math.abs(carrier.p[2]) + 4)];
  return null;
}

/** L'HÉRITAGE DE LA CRAIE (lot 178 — retour utilisateur : « ça peut être le latéral qui colle
 *  la ligne haut si l'ailier a un rôle de meneur ou d'intérieur »). La largeur d'un côté est
 *  une RESPONSABILITÉ d'équipe : par côté, l'ancre s'ÉLIT au rôle — argmax(|z du slot brut| ×
 *  largeurR) parmi les postes assez larges (|z| > hz × 0,25). L'ailier de percussion
 *  (largeurR 0,9) gagne d'office ; un ailier-meneur (0,45) CÈDE la craie au latéral qui monte
 *  — le pattern moderne du faux ailier. Rend { 1: id, -1: id } par signe de z. */
export function ancresCraie(st, atk, axe, role, cfg = null) {
  const hz = st.pitch?.hz ?? 34;
  const cote = {};
  // LA CRAIE EST UNE CHAISE TENUE (249b, cfg.craie.tenue — mesuré avant : l'ancre changeait de mains 35 fois par minute de
  // possession, le slot de l'ancré 139 fois, sa cible en z sautait de > 4 m 51 fois : personne ne peut tenir une ligne qu'on
  // lui reprend toutes les deux secondes — l'ancré vivait à 13,6 m de la craie pour une cible à 5). L'élu GARDE sa craie
  // tant qu'il est éligible (vivant, de son côté, assez large DE CORPS — pas de slot, qui flotte) : tenue s au moins, puis
  // seulement un rival qui le bat de marge (25 %). Absente : la ré-élection à 0,8 s d'hier, au bit.
  const T = cfg?.craie?.tenue, prev = T && st._ancre?.team === atk ? st._ancre : null;
  for (const s of [1, -1]) {
    let best = null, bs = -1;
    for (const q of st.players) {
      if (q.team !== atk || q.keeper || q.down > 0 || !q._slotT) continue;
      const z = q._slotT[1];
      if (Math.abs(z) < hz * 0.25 || Math.sign(z || 1) !== s) continue;
      const sc = Math.abs(z) * axe(role(q).largeurR, 0.7, 1.3);
      if (sc > bs) { bs = sc; best = q.id; }
    }
    if (prev && prev.cote[s] != null && prev.cote[s] !== best) {
      const p = st.players[prev.cote[s]];
      const eligible = p && p.team === atk && !p.keeper && p.down <= 0 && !p._sub && Math.sign(p.p[2] || 1) === s && Math.abs(p.p[2]) >= hz * 0.25;
      const scP = eligible ? Math.max(Math.abs(p.p[2]), Math.abs(p._slotT?.[1] ?? 0)) * axe(role(p).largeurR, 0.7, 1.3) : -1;
      if (eligible && (st.t - (prev.since?.[s] ?? -99) < T || bs < scP * (1 + (cfg.craie.marge ?? 0.25)))) best = prev.cote[s];
    }
    cote[s] = best;
  }
  if (T) cote.since = { 1: prev && prev.cote[1] === cote[1] ? prev.since?.[1] ?? st.t : st.t, [-1]: prev && prev.cote[-1] === cote[-1] ? prev.since?.[-1] ?? st.t : st.t };
  return cote;
}

// LA DÉFORMATION DE LIGNE (200, cfg.roleStructure — appelée de match-sim ; role/axe passés
// pour éviter le cycle) : l'INTRUS = slot déplacé de ≥ seuil m par sa profondeur de rôle ;
// ses voisins de bande s'écartent de son z (falloff linéaire sur portee).
export function intrusDe(posted, spots, cfg, role, axe, sgnA) {
  let l = null;
  const rMs = cfg.role?.profondeurM ?? 2.5;
  for (const p of posted) {
    const pv = role(p).profondeur ?? 0.5;
    if (pv === 0.5) continue;
    const off = axe(pv, -rMs, rMs);
    if (Math.abs(off) < (cfg.roleStructure.seuil ?? 4)) continue;
    const w = spots[p.post ?? 0];
    if (w) (l ??= []).push({ id: p.id, x: w[0] + sgnA * off, z: w[1] });
  }
  return l;
}
export function ecarteLigne(intrus, p, tx, tz, cfg, hz) {
  for (const it of intrus) if (it.id !== p.id && Math.abs(tx - it.x) < (cfg.roleStructure.bande ?? 4)) {
    const dz = tz - it.z, ad = Math.abs(dz), po = cfg.roleStructure.portee ?? 12;
    if (ad < po) tz = Math.max(-hz + 1.5, Math.min(hz - 1.5, tz + (dz >= 0 ? 1 : -1) * (cfg.roleStructure.ecarte ?? 4) * (1 - ad / po)));
  }
  return tz;
}

/** Les libellés du catalogue aval (244c) — pour l'UI d'un projet, jamais lus par une loi. */
export const LIBELLES_ROLES = { fullback_third_cb: 'Latéral bloqué (3e central)', wide_playmaker_fullback: 'Latéral meneur excentré', half_space_playmaker: 'Manipulateur du demi-espace', vertical_creator: 'Créateur de rupture verticale', deep_lying_forward: "Neuf d'appui", goalkeeper: 'Gardien', keeper_libero: 'Gardien libero', centre_back: 'Défenseur central', stopper: 'Stoppeur', cover: 'Couvreur', playmaker_defender: 'Défenseur constructeur', libero: 'Libero', full_back: 'Latéral', wing_back: 'Piston', inverted_fullback: 'Latéral inversé', modern_wingback: 'Piston moderne', anchor: 'Sentinelle', half_back: 'Décrocheur', regista: 'Regista', destroyer: 'Destructeur', box_to_box: 'Box-to-box', deep_lying_playmaker: 'Meneur reculé', mezzala: 'Mezzala', carrilero: 'Carrilero (navette)', free_role_creator: 'Créateur libre', attacking_midfielder: 'Milieu offensif', trequartista: 'Trequartista', shadow_striker: 'Attaquant fantôme', winger: 'Ailier', inside_forward: 'Inside forward', wide_creator: 'Créateur côté', raumdeuter: 'Raumdeuter', tracking_winger: 'Ailier défensif', forward: 'Attaquant', target_man: 'Pivot', poacher: 'Renard des surfaces', all_around_striker: 'Attaquant complet', pressing_striker: 'Attaquant pressing', false_9: 'Faux 9' };

/** LE RÔLE PAR DÉFAUT DE CHAQUE POSTE NOMMÉ (244c — la grille 244a rencontre le catalogue) :
 *  rolesGrille(formation) → { indice: rôle } pour les dix postes (le gardien : goalkeeper, posé
 *  sur l'indice 10). Les règles, en football : D large = latéral, WB = piston, D axial = central,
 *  DM(C) = sentinelle, un double pivot = meneur reculé à gauche + sentinelle à droite, M(C) =
 *  meneur reculé sans DM derrière lui (box-to-box sinon), les intérieurs d'un trio = mezzalas
 *  (box-to-box dans un milieu à deux), M large = ailier, AM axial = milieu offensif, AM large =
 *  ailier, ST = attaquant. Un projet pose ce qu'il veut par-dessus (makeMatch({ roles })). */
export function rolesGrille(name = 433) {
  const noms = POSTES_FORMATION[name] ?? POSTES_FORMATION[433];
  const L = lignesFines(name), axiaux = noms.filter((n) => /^M\((CG|C|CD)\)$/.test(n)).length;   // les intérieurs, pas les M larges
  const out = { 10: 'goalkeeper' };
  noms.forEach((nom, k) => {
    const p = litPoste(nom); if (!p) return;
    const { strate: S, cote: c } = p, large = c === 'G' || c === 'D';
    if (S === 'D') out[k] = large ? 'full_back' : 'centre_back';
    else if (S === 'WB') out[k] = 'wing_back';
    else if (S === 'DM') out[k] = c === 'C' ? 'anchor' : (c === 'CG' ? 'deep_lying_playmaker' : 'anchor');
    else if (S === 'M') out[k] = large ? 'winger' : c === 'C' ? (L.DM ? 'box_to_box' : 'deep_lying_playmaker') : (axiaux >= 3 || L.DM ? 'mezzala' : 'box_to_box');
    else if (S === 'AM') out[k] = large ? 'winger' : 'attacking_midfielder';
    else if (S === 'ST') out[k] = 'forward';
  });
  return out;
}

/** LES 25 RÔLES DU DOCUMENT (248) → le catalogue : poste, lettre, identifiant, et ce que le rôle exige de la tactique. */
export const ROLES_DOCUMENT = {
  'GK A': 'keeper_libero', 'GK B': 'goalkeeper',
  'DC A': 'cover', 'DC B': 'stopper', 'DC C': 'libero',
  'LAT A': 'inverted_fullback', 'LAT B': 'wing_back', 'LAT C': 'fullback_third_cb', 'LAT D': 'wide_playmaker_fullback',
  'MDC A': 'anchor', 'MDC B': 'destroyer', 'MDC C': 'regista',
  'MIL A': 'half_space_playmaker', 'MIL B': 'vertical_creator', 'MIL C': 'box_to_box',
  'MO A': 'trequartista', 'MO B': 'shadow_striker', 'MO C': 'free_role_creator',
  'AIL A': 'winger', 'AIL B': 'inside_forward', 'AIL C': 'tracking_winger', 'AIL D': 'wide_creator',
  'AV A': 'poacher', 'AV B': 'deep_lying_forward', 'AV C': 'false_9',
};

/** LA COMPATIBILITÉ DU ONZE (248 — « ce qu'il coûte à l'équipe », §3) : une table PURE qui avertit, ne bloque pas.
 *  roles : onze identifiants (indice = poste, 10 = gardien, null = polyvalent) ; tactics : { hauteurBloc, … } ;
 *  formation : le nom (pour les côtés). Rend [{ regle, gravite: 'avertit', joueurs }]. */
export function compatibiliteOnze(roles = [], tactics = {}, formation = 433) {
  const out = [], id = (k) => (typeof roles[k] === 'string' ? roles[k] : roles[k]?.nom ?? roles[k]?.on ?? null);
  const noms = POSTES_FORMATION[formation] ?? POSTES_FORMATION[433];
  const est = (k, ...ids) => ids.includes(id(k)), qui = (...ids) => [...Array(10).keys()].filter((k) => est(k, ...ids));
  const cote = (k) => litPoste(noms[k])?.cote ?? 'C', strate = (k) => litPoste(noms[k])?.strate ?? 'M';
  const relayeurs = qui('mezzala', 'box_to_box', 'half_space_playmaker', 'carrilero');
  if (qui('regista').length && relayeurs.length < 2) out.push({ regle: 'le regista exige deux relayeurs qui courent pour lui', gravite: 'avertit', joueurs: qui('regista') });
  if (qui('false_9').length && !qui('inside_forward', 'shadow_striker', 'raumdeuter').length) out.push({ regle: "le faux 9 vide l'axe : il faut un ailier ou un dix qui plonge dedans", gravite: 'avertit', joueurs: qui('false_9') });
  for (const k of qui('wide_creator')) { const lat = [...Array(10).keys()].find((j) => (strate(j) === 'D' || strate(j) === 'WB') && cote(j)[cote(j).length - 1] === cote(k)[cote(k).length - 1] && cote(j) !== 'C'); if (lat != null && est(lat, 'wing_back', 'modern_wingback', 'inverted_fullback')) out.push({ regle: "l'ailier marchant ne replie pas : son latéral doit rester (pas de piston ni d'inversé sur son côté)", gravite: 'avertit', joueurs: [k, lat] }); }
  if (qui('inverted_fullback').length >= 2 && !qui('anchor', 'half_back', 'destroyer').length) out.push({ regle: "deux latéraux inversés sans sentinelle : l'entrejeu est encombré, les couloirs déserts", gravite: 'avertit', joueurs: qui('inverted_fullback') });
  if (qui('free_role_creator').length && !qui('anchor', 'half_back', 'destroyer', 'regista').length) out.push({ regle: "l'électron libre exige un 6 qui tient la maison", gravite: 'avertit', joueurs: qui('free_role_creator') });
  if (qui('poacher').length >= 2) out.push({ regle: 'deux renards : personne ne fait le lien', gravite: 'avertit', joueurs: qui('poacher') });
  if (qui('libero').length && (tactics.hauteurBloc ?? 0.5) < 0.7) out.push({ regle: 'le libéro de ligne haute veut une ligne haute (hauteurBloc ≥ 0,7)', gravite: 'avertit', joueurs: qui('libero') });
  if (id(10) === 'keeper_libero' && (tactics.hauteurBloc ?? 0.5) < 0.6) out.push({ regle: 'le gardien libéro sans ligne haute sort pour rien', gravite: 'avertit', joueurs: [10] });
  if (qui('wing_back', 'modern_wingback').length >= 2 && !qui('anchor', 'half_back', 'fullback_third_cb').length) out.push({ regle: 'deux pistons hauts sans sentinelle ni troisième central : le dos est ouvert', gravite: 'avertit', joueurs: qui('wing_back', 'modern_wingback') });
  return out;
}

/** SIX PERSONAS DE FIXTURE (248 → le test d'identification 249) : attributs + rôle + refus — des signatures, pas des noms de loi. */
export const PERSONAS_FIXTURE = {
  busquets: { role: 'anchor', ratings: { passing: 92, vision: 90, decisions: 94, positioning: 92, anticipation: 90, composure: 95, pace: 45, finishing: 40, longShots: 35 }, refus: ['tirLoin', 'dribbleElimination'] },
  kane: { role: 'deep_lying_forward', ratings: { finishing: 93, passing: 85, vision: 84, control: 88, strength: 82, pace: 60, decisions: 88 }, refus: ['dribbleElimination'] },
  yamal: { role: 'inside_forward', ratings: { dribbling: 94, technique: 92, pace: 86, acceleration: 90, vision: 85, finishing: 78, crossing: 80, tackling: 30 }, refus: ['repli'] },
  haaland: { role: 'poacher', ratings: { finishing: 96, pace: 90, acceleration: 88, strength: 92, offTheBall: 93, passing: 60, dribbling: 65 }, refus: ['decrochage', 'passeLongue'] },
  pedri: { role: 'half_space_playmaker', ratings: { passing: 90, vision: 91, control: 92, technique: 90, decisions: 90, composure: 92, pace: 65, finishing: 62 }, refus: ['centreAerien', 'tirLoin'] },
  vandijk: { role: 'cover', ratings: { positioning: 94, anticipation: 92, tackling: 88, heading: 93, strength: 92, composure: 94, passing: 84, pace: 72 }, refus: ['tacleGlisse'] },
};
