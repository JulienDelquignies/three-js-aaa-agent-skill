# Bible 06 — Les relayeurs (n°8), contre le moteur

*Fiche du 9/09, moteur 767de25 (SCEAU 256). Mesures : 2 matchs de 90 min (graines 3, 7) en 4-3-3, les 8 = M(CG) et M(CD).*

## 1. Ce que le chapitre demande

- **Le demi-espace** avec ses trois définitions (cinquièmes 13,6 m, lignes de surface, ancre dynamique de Casanova) ; la
  hauteur dans l'interligne **dérivée** de la structure adverse ; **la règle des lignes et des couloirs** comme contrainte
  d'unité à 4 Hz (au moins 1 et au plus 2 par couloir vertical, au plus 3 par bande horizontale de 8 m) ; l'ombre.
- **Le soutien** : distance décroissante avec la densité (BU1 10-18 m > BU2 8-15 > CRE 7-12 > FIN 6-11 > CPRESS ≤ 5),
  l'angle d'offre, le démarquage court (1-3 m, 25-45 par match).
- **Neuf familles de courses** avec déclencheur, cinématique, **avance sur `ballReleased`** (la rupture part 1,5-3 s
  avant la passe, calculée par la cinématique, sur l'état « porteur prêt » de Dall'Oglio).
- **La surface** : le quota dérivé de la rest defense (`maxInBox` 3-4), l'alternance des deux 8 par jeton, l'arrivée
  retardée calée sur le centre.
- **En défense** : le pressing médian, le premier sprint de contre-pressing (contact à 1,0-2,5 s, à 0,3-0,8 m, 6-12 %
  de fautes), le retour axial, la prise en charge entre les lignes avec **handoff** explicite et hystérésis.
- **Le volume** : 10,5-11,5 km, hors possession × 1,16 en distance et × 2,16 en haute intensité, 16,5 possessions par
  10 min, ≈ 0,9 s chacune.

## 2. Où en est le code

**Existant.** Les cinq couloirs et le demi-espace (**241 `couloirs`** : max 2 par couloir DANS la structure d'attaque,
`demi` 0,6, `remplir` le demi-espace vide, `relais` et `ligne` éteints ; cinquièmes égaux — la définition A) ; le comité
de soutien (103 `soutienN` 2) et le se-montrer (67, l'offre 241b éteinte) ; les courses : appel (41, 125 répertoire de
l'ailier, 144 le jeté, 210 `appelNote`), troisième homme (`troisieme` 6-16 m, p 0,5), une-deux (218), course servie
(`courseServie`), zones de contre (242), l'attaque du centre (182b `boxCrash`, un corps par rai) ; le contre-press
chronométré (229 : meute de 3, rayon 20, frein) ; la passation (252) ; les rôles mezzala / box_to_box / carrilero
(axes appel, press, largeurR, repli) ; le renversement (98) ; la fatigue globale (31).

**Partiel.** La règle des couloirs ne tient que la structure d'attaque (les défenseurs relanceurs comptent dans les
couloirs du réel) ; la règle des lignes est éteinte (`ligne: null`) ; le soutien est un comité à distance fixe
(`ancre` + se-montrer), pas une distance par sous-phase ; les courses partent au signal (porteur posé, couloir
ouvert : 41) mais **après** l'armement, jamais avant `ballReleased` (le ch. 01 T22 et le retour aval D disent la même
chose) ; la surface n'a ni quota ni jeton (boxCrash prend un corps par rai) ; le contre-press est une meute par
distance, sans l'arrivée « dans le joueur » (1,45 m mesuré) ; la prise en charge entre les lignes est le marquage
par distance (51b) + la passation (252) : sans zone de responsabilité ni hystérésis générale (double marquage 10 %).

**Absent.** `restDefenseTarget` (le quota de surface n'a rien dont dériver) ; le jeton d'alternance ; l'ancre
dynamique de Casanova ; la fatigue par phase ; le handoff en unité.

## 3. Les tests de réfutation, un par un

| # | Cible (book) | Statut | Mesuré (2 × 90 min) |
|---|---|---|---|
| 1 distance du 8 | 10,5-11,5 km | mesurable, **réfuté** | **17,2 km** — le poste le plus coureur du moteur avec le 6 (17,8) |
| 2 HI hors / en possession | × 2,16 | à instrumenter (zones de vitesse) |
| 3 distance hors / en possession | × 1,16 | mesurable | **1,19** ✓ |
| 4-7 pics, sprints, efforts sans ballon | | à instrumenter |
| 8 les deux demi-espaces occupés en progression | ≥ 80 % | mesurable | **97 %** ✓ (le `remplir` du 241) |
| 9 ≤ 2 par couloir | ≥ 95 % des images | mesurable, **réfuté tel que défini** | **1 %** — avec les dix joueurs de champ (le 241 ne tient que la structure d'attaque, et dix corps en cinq couloirs à deux par couloir est une géométrie exacte) ; à re-mesurer sur les postés |
| 10 ≤ 3 par bande de 8 m | ≥ 95 % | mesurable | **73 %** — la règle des lignes est éteinte (`ligne: null`) |
| 11-13 rest defense à la perte | 3,7 déf. / +1,7 / 28 × 7,4 m / à 43,6 m | mesurable, **réfuté** | **7,4 derrière, +3,1, 40 × 27 m, à 61 m** — la structure de sécurité n'est pas une structure : c'est tout le bloc chaîné, long de 27 m, loin devant |
| 14 attaquants dans la surface au centre | ≤ 3-4 dans 90 % | mesurable | **p50 1, p90 3** — trop peu (un seul corps de boîte : le 182b prend un corps par rai) |
| 15 répartition des arrivées entre les deux 8 | 40/60 | à instrumenter |
| 16 les deux 8 à x > 88 | ≤ 3 / match | mesurable | 22 s / match (borne) |
| 17 scan du 8 | 0,55-0,75/s, chute sous pression | loi existante (250), cible fausse (pas de chute) |
| 18 possessions / 10 min | 16,5 ±8,6 | mesurable | **20,2** ✓ |
| 19 durée | ≈ 0,9 s | mesurable | **0,43 p50, 0,63 moyenne** — courtes (ch. 01 T6) |
| 20 soutien décroissant BU1 > BU2 > CRE > FIN | monotone | mesurable, **inversé** | **17,4 < 19,1 < 20,3 < 24,2 m** — le 8 s'éloigne du porteur en approchant du but : il reste derrière (le bloc chaîné) |
| 21 retournement sous `D_TURN` | ≤ 15 % | à instrumenter (240 : la remise dos au but existe) |
| 22-23 avance de la rupture sur `ballReleased` ; hors-jeu des ruptures 8-18 % | | **absent** (les courses partent après le signal) ; hors-jeu 1/match au total |
| 24 délai perte → contact | 1,0-2,5 s | mesurable | **0,58 s** — trop tôt : la meute (229) part à la perte même, ou le 8 était déjà au contact |
| 25 distance d'arrivée | 0,3-0,8 m | mesurable, **réfuté** | **1,45 m** — la meute ferme des sorties, elle ne rentre pas dans le joueur (Zeidler) |
| 26 fautes sur contre-press | 6-12 % | à instrumenter |
| 27 durée des contres subis | 10,9 ±0,6 s | à re-mesurer (sonde à corriger) |
| 28 double marquage entre les lignes | ≤ 5 % | mesurable, **réfuté** | **10,1 %** |

## 4. Les lots que la fiche appelle

1. **La rest defense comme structure** (11-13 ; ch. 04 lot 1) : 4-5 corps, 28 × 7 m, à 44 m — aujourd'hui 7,4 corps
   sur 27 m à 61 m : le même lot que les latéraux, et il libère le quota de surface (14).
2. **La course avant le ballon** (22-23 ; ch. 01 T7, ch. 03 T3, retour aval D) : l'appel part sur « porteur prêt »,
   1,5-3 s avant `ballReleased`, calculé par la cinématique — c'est le 259 du plan, il se précise ici.
3. **Le soutien par sous-phase** (20) : 10-18 m en sortie, 6-11 m en finition, la décroissance non négociable ; le 8
   monte avec le jeu au lieu de rester au bloc.
4. **La règle des lignes** (10) : `couloirs.ligne` mesuré et allumé (le 241 l'avait laissé à null, non mesuré).
5. **Le contre-press dans le joueur** (24-26) : l'arrivée à 0,3-0,8 m, le délai 1-2,5 s, les fautes.
6. **Le handoff en unité** (28) : la passation (252) généralisée aux trois milieux et à la charnière, avec zones de
   responsabilité et hystérésis.
7. **Le budget locomoteur** (1) : 17 km — le même constat que 03, 04, 05 : tout le monde chasse.
