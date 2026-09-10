# Modèle 14 — Consignes et formations, contre le moteur

*Fiche du 9/09, moteur 0735d1f (SCEAU 256). Inventaire ; les mesures citées viennent du banc `verify-identification` (22 clés exprimées) et des sondes Bible.*

## 1. Ce que le chapitre demande

- **Un contrat de traduction** : chaque consigne d'entraîneur devient un poids continu avec un **certificat**
  (métrique cible, sens, amplitude minimale, bande réelle : PPDA 6-20, direct speed 1,4-2,1 m/s…) — jamais une
  consigne morte (test 5 : zéro lecture) ni un couplage caché (tempo ⟂ verticalité).
- **La formation** comme deux formes (en possession / sans ballon, `labelFormation` toutes les 5 s), rôles, devoirs,
  **signatures** (Decroos & Davis, 18 composantes) ; changements de rôle / de forme dans un rapport 1,8-3,5
  (SoccerCPD 2,49).
- **Instructions d'équipe** (table complète) et **individuelles** ; **cohérence, conflits, dégradation** (bloc bas +
  contre-pressing max se dégrade, ne lève pas d'exception) ; **familiarité tactique** (η, temps d'apprentissage,
  effet local après un changement) ; **plan de match adverse** non omniscient (contre-adaptation ≥ 6 min) ;
  coût ≤ 2 µs par tick ; permutation de rôles sous perturbation (expulsion, remplacement).

## 2. Où en est le code

**Existant.** `tactics.js` : les **axes** continus (hauteurBloc, largeur, pressing, style, transition, compacité,
relation, zone/marquage, tempo, mentalité, piège, curseur de risque) et les **presets** (équilibre, gegenpressing,
possession, bloc bas, direct, large et centres) ; `formation.js` : le catalogue (4-3-3, 4-4-2, 3-5-2…, strates ×
côtés, `ROLES_FORMATION`, `LIGNES`), les deux formes implicites (bloc défensif chaîné au ballon / attaque étirée) ;
`roles.js` : les **rôles comme axes** (profondeur, largeurR, appel, press, repli, marqueSerre…) et **interdits**
binaires, les archétypes (busquets, kane, yamal, haaland, pedri, vandijk) ; les **attributs comme facteurs**
(attributes.js) ; le banc **`verify-identification`** (chaque clé de tactique déplace une mesure — 22 clés
exprimées au 252) et **`verify-tactics`** ; la Loi 3 (remplacements) et l'expulsion physique (dette nommée).

**Partiel.** Le certificat existe sous la forme « clé absente = hier au bit » et « chaque clé exprimée » — mais sans
bande réelle ni monotonie par cran (le test 1) ; hauteurBloc ne déplace pas le hors-jeu (Bible 03) ; la formation
n'a pas d'**étiquetage** ni de forme déclarée par phase (les deux formes émergent des lois) ; les rôles sont des
axes sans **devoirs** ni signatures mesurées ; la dégradation des combinaisons pathologiques n'est pas testée (au 255, la première l'est : ligne haute → ballons reçus derrière la ligne × 2,8, le book dit × 1,9 — la sonde des presets, `sonde-255.mjs`).

**Absent.** `labelFormation`, le rapport rôles / formes, la familiarité tactique η, le plan de match adverse et sa
contre-adaptation, les instructions individuelles comme table, le vecteur de joueur (test 9), le coût mesuré.

## 3. Les tests de réfutation, un par un

| # | Cible (book) | Statut | Mesuré |
|---|---|---|---|
| 1 monotonie et bornitude par consigne | 5 crans × 200 matchs, bandes réelles | partiel | `verify-identification` prouve l'effet, pas la monotonie ni la bande |
| 2 orthogonalité tempo / verticalité | ρ < 0,5 | à mesurer |
| 3 deux formes, une équipe | étiquettes différentes | à instrumenter (pas de `labelFormation`) |
| 4 rôles / formes | 1,8-3,5 | à instrumenter |
| 5 consigne cosmétique | zéro lecture | tenu par doctrine (placebo → clé null) ; à automatiser |
| 6 familiarité | | absent |
| 7 dégradation et non-rejet | | à tester (six combinaisons) |
| 8 non-omniscience de l'adversaire | ≥ 6 min | absent (pas de plan adverse) |
| 9 individualité | vecteur à 18 composantes | à mesurer (roles + attributs existent) |
| 10 budget | ≤ 2 µs | à profiler |
| 12 permutation sous perturbation | | partiel (Loi 3 ; formation à 10 = dette) |

## 4. Les lots que la fiche appelle

1. **Le certificat par consigne** (tests 1, 5, 11 ; chantier D du Plan) : pour chaque axe et chaque clé, la
   métrique, le sens, l'amplitude, la bande réelle — `verify-identification` devient un banc de monotonie.
2. **Les deux formes étiquetées** (tests 3, 4 ; Bible 13) : `labelFormation` à 5 s, forme en possession / sans
   ballon déclarées, rôles / formes.
3. **La familiarité et le plan adverse** (tests 6, 8 ; Bible 16, Référentiel 13) — la familiarité SCELLÉE 337 (254 : η par équipe, Φ de la paire, la synchronie de la ligne) ; le plan adverse reste à faire.
4. **La formation à dix** (test 12 ; Bible 16 T7-T9) : la dette nommée.
5. **Le vecteur de joueur** (test 9 ; Référentiel 12) : la signature mesurée d'un rôle × attributs.
