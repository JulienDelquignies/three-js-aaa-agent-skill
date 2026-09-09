# Bible 05 — Le milieu défensif et le double pivot, contre le moteur

*Fiche du 9/09, moteur 767de25 (SCEAU 256). Mesures : 2 matchs de 90 min (graines 3, 7) en 4-3-3, en 4-2-3-1
(double pivot) et en 4-3-3 bloc bas.*

## 1. Ce que le chapitre demande

- **Trois fonctions** séparables (écran, relais, organisateur), pas un poste ; **l'ancre** en défense placée comme
  barycentre à quatre termes (ligne + interligne, glissement amorti côté ballon `K_BALL_Y` 0,30-0,45, attraction vers
  l'adversaire d'interligne plafonnée, couloir de danger) ; **l'interligne 6 → ligne** piloté par le bloc : 10-15 m
  médian, **5-8 m bas**, 2-5 m en défense de surface ; l'ombre de couverture géométrique (largeur utile ≈ 1,5-2,5 m) et
  sa valeur d'interception.
- **Le décrochage** (salida) par un arbre à seuils (surnombre = relanceurs + gardien − première ligne adverse ; SPLIT_CB
  seulement si nécessaire ; jamais « par habitude »), et ce qu'il impose aux 21 autres.
- **La réception dos au jeu** : la fraîcheur de l'information sur son dos (`confidence`, τ 1,2 s), la règle Dall'Oglio
  (confiance < 0,45 → remise obligatoire), l'orientation avant réception, l'arbre à `ttp`.
- **Le tempo** comme état d'équipe : `ACCEL` (≤ 0,6 s), `SETTLE` (1,2-2,5 s, la pausa), `SWITCH` ; `R_fwd` par zone
  (0,20-0,30 possession, 0,45-0,60 direct) ; 1 renversement toutes les 8-14 possessions.
- **Défendre** : interception d'abord (valeur 1,0), tacle en dernier (0,55) ; le saut du 6 au départ de la passe avec
  couverture garantie ; la faute tactique comme utilité avec le débat Guardiola / Zeidler exposé en politique.
- **Le double pivot** : une seule variable d'état (`advancedId`, 25-70 bascules, hystérésis), jamais les deux devant le
  ballon (< 4 %), `dSep` 9-13 m.
- **La transition** : la première seconde (contre-presser à ≤ 8 m ou bloquer l'axe), le coût physique ; les six
  erreurs canoniques comme conséquences d'état ; ≤ 10,6 km.

## 2. Où en est le code

**Existant.** Le pivot est le 6 de la grille (244b `pivotDe`) ; la salida (**239 `salida`** : ballon au central ou au
gardien à < 30 m, ≥ 3 presseurs, le 6 décroche à −1 m — un déclencheur, pas l'arbre) ; l'ombre de couverture (42
`coverShadow` : le presseur arrive par le couloir du soutien dangereux) ; l'intercepteur du vol (134) ; le tacle
qui vient après (157 tempo, 166 contesté) ; l'appui-remise dos au but (240 `appuiRemise` : presseur derrière →
remise) ; la une-touche (160/225) et la tenue calme (211 : 2,2 s pour le porteur libre) ; le renversement (98
`renversement` : dense 6, fixation d'abord, respire 45 s) ; le contre-press chronométré (229 : meute, chaise à
quatre pieds) ; la faute tactique (A10 : l'accrochage qui fauche le contre) ; la passation au pivot (252) ; le
tempo comme axe (`tempo`, 164/211/235) ; la mentalité (coach.js).

**Partiel.** L'interligne 6 → ligne est le bloc chaîné (42) : il ne se resserre pas en bloc bas (T1 : 17 m à
hauteurBloc 0,1, l'inverse des 5-8 attendus) ; le décrochage n'a ni surnombre ni « jamais par habitude » ; la
remise dos au jeu lit la pression (240), pas la fraîcheur d'une information ; le tempo est un axe sans régimes
(pas de SETTLE : la tenue du 6 est 0,43 s p50) ; le renversement existe mais ne se déclenche quasiment jamais (1
toutes les 160 possessions) ; l'interception est préférée au tacle **de fait** (1,24 à 2,0) sans curseur d'école ;
le double pivot n'a pas de variable d'unité (265 bascules, 13 % les deux devant).

**Absent.** `advancedId` et sa règle de non-simultanéité ; la `confidence` sur son dos (perception non
omnisciente) ; la politique de faute tactique (`FORBIDDEN / ENCOURAGED`) — le 6 du moteur ne fait **aucune** faute
lue (0,0 / 90, à instrumenter : l'événement `faute` porte `par`) ; le saut du 6 avec couverture garantie ; les
régimes de tempo ; le budget locomoteur (17,8 km !).

## 3. Les tests de réfutation, un par un

| # | Cible (book) | Statut | Mesuré (2 × 90 min) |
|---|---|---|---|
| T1 `dLine` médian / bas | 10-15 / **5-8** | mesurable, **cible fausse en bloc bas** | 4-3-3 **13,2 m** ✓, 4-2-3-1 12,4 ✓, **bloc bas 17,0** — le 6 s'éloigne de sa ligne quand le bloc recule |
| T2 pente y(6) / y(ballon) | 0,30-0,45 | mesurable | **0,47** (borne haute, stable sur les trois mondes) |
| T3 interligne axial selon `interlineWeightDef` | | absent (pas de curseur) |
| T4 interceptions / tacles | Alonso > 1,2 / destructeur < 0,7 | mesurable | **1,24** (4-3-3), 1,84 (4-2-3-1), 2,0 (bas) — toujours l'école Alonso, sans curseur ; la définition « interception = contrôle après un ballon adverse » est large |
| T5a-b conservation sous pression (76,5 %) ; réussite < 2 m (87,3 %) | | mesurables — à mesurer (définitions CIES / Opta séparées) |
| T6 pressions subies | 12,3 / match | mesurable (proxy : 240 images à < 2 m ≈ 60 s) — à redéfinir en épisodes |
| T7 orientation forcée à 0° | | absent (pas de commande d'orientation à la réception) |
| T8 tenue `ACCEL` ≤ 0,6 / `SETTLE` 1,2-2,5 | | **absent** : p50 **0,43 s**, p90 1,27 — un seul régime, le vif |
| T9 `R_fwd` tiers propre | possession 0,20-0,30 / direct 0,45-0,60 | mesurable | **0,45** (0,40 en 4-2-3-1, 0,53 en bloc bas) — le monde par défaut relance en direct |
| T10-T11 SPLIT_CB selon la première ligne adverse ; écart des centraux | | partiel (239 : seuil de presseurs, pas de nFirst) — à mesurer |
| T12 bascules du pivot avancé | 25-70, > 200 échec | mesurable, **réfuté** | **265** par équipe |
| T13 les deux pivots devant le ballon | < 4 % | mesurable, **réfuté** | **13,1 %** |
| T14 `dSep` | 9-13 m | mesurable | **12,3 m** ✓ |
| T15 fautes du 6 | encouragée 1,3-2,0 / interdite 0,4-0,9 | à instrumenter (0 lu) |
| T16 jaune / faute | 0,10-0,20 | mesurable après 257 (le carton compteur : 0,5 aujourd'hui) |
| T17 fautes totales | PL 20,9 … Liga 27,0 | mesurable | **23,0** (26,0 / 28,5) ✓ |
| T18 distance du 6 ; surcroît hors possession | ≤ 10,6 km ; +300-450 m | mesurable, **réfuté** | **17,8 km**, dont 9,6 hors possession — le 6 est le presseur permanent (`byDist` i = 0) |
| T19 intensité en transition | | mesurable — à mesurer |
| T20-T22 tests causaux (scan arrière, `advancedId`, rest defense) | | absents (les variables n'existent pas) |
| T23 éliminé par une passe | 3-8 / match | mesurable — à mesurer (passes traversant l'ombre) |
| T24 sorties trop hautes selon `aggression` | | partiel (`aggrF` existe au mord 159) — à mesurer |
| T25-T26 récupérations, passes contournant ≥ 2 | | absent (Opta) |
| T27 renversements | 1 / 8-14 possessions | mesurable, **réfuté** | **1 / 160** (4-3-3), 1 / 184, 1 / 713 en bloc bas — le 98 exige une fixation de 3-5 passes et respire 45 s |
| T28 `jumpBravery` | | absent |

## 4. Les lots que la fiche appelle

1. **Le renversement qui existe** (T27) : 1 toutes les 160 possessions contre 8-14 — le 98 est trop verrouillé
   (fixation, respiration 45 s, densité 6) ; le régime `SWITCH` du tempo. Il se mesure aussi au ch. 04 (déficit de
   re-coulissement).
2. **Le double pivot comme unité** (T12, T13) : `advancedId` avec hystérésis, jamais les deux devant — le même patron
   que la passation (252) et que stoppeur/couvreur (ch. 03).
3. **L'interligne piloté par le bloc** (T1 bas) : le 6 à 5-8 m de sa ligne en bloc bas — avec « la ligne est une
   ligne » (ch. 03).
4. **Le budget locomoteur du 6** (T18) : 17,8 km ; il presse toujours parce qu'il est le plus proche — le token de
   pressing (ch. 01 § 8.2) et la distance d'intervention.
5. **Les régimes de tempo** (T8, T9) : `SETTLE` = la pausa (253, déjà au plan) ; `R_fwd` par zone comme signature de
   l'axe style.
6. **La faute tactique comme politique** (T15, T16) : avec le carton (257) et l'axe `faute` de la Campagne IV.
7. **La fraîcheur de l'information sur son dos** (§ 4, T20) : la campagne perception (Modèle 04).
