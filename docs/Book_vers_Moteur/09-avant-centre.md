# Bible 09 — L'avant-centre, contre le moteur

*Fiche du 9/09, moteur 767de25 (SCEAU 256). Mesures : 2 matchs de 90 min (graines 3, 7) en 4-3-3, le 9 = ST(C).*

## 1. Ce que le chapitre demande

- **Le budget physique d'abord** : un `RunLedger` (énergie, drain, récupération, courses servies / non servies,
  `serviceRate` 15-40 %, `refusalStreak` qui éteint l'engagement) — le 9 ne décide pas un appel, il amortit un budget.
- **Premier défenseur** : il ne prend pas le ballon, il supprime une option (l'ombre projetée, la course courbe à
  +3-16 %), huit déclencheurs `PT1-PT8` (le retour au gardien, la passe entre centraux, le contrôle raté, le porteur
  dos au jeu, la perte à < 30 m → contre-press 3-4 s ; et deux « non » : central face au jeu, bloc replié), la
  coordination obligatoire, une machine à états ; l'ancre sur le 6 adverse en bloc médian et bas, `pinCount` 1,5-2,4.
- **Dix appels** (`R-01` profondeur pure 12-25 m servi 12-20 %, `R-02` décrochage 35-50 %, `R-03` contre-appel à
  trois appuis, `R-05` leurre qui déplace le marqueur de 4-9 m, `R-07/R-08` poteaux 1,6-2,4 s avant l'arrivée du
  centre, `R-09` step-back de 0,8-2,5 m…), la fenêtre de départ **référencée à la levée de tête du porteur**, jamais
  deux appels identiques, cinq modes sans ballon.
- **Dos au but** : quatre issues avec durées et probabilités (remise 78-90 %, troisième homme, retournement 25-40 %,
  faute), la règle Dall'Oglio, le pied et la protection.
- **La surface** : 85,7 % des buts dedans, conversion 15 / 3,7 %, la Golden Zone (`x ≥ 88,5`, `dy ≤ 9,16` : ≈ 50 % des
  tirs, ≈ 82 % des buts), 69,8 % des buts en une touche, les slots et la non-duplication, l'arrivée lancée.
- **La finition** : la table xG par zone, l'arbre (première intention si xG ≥ 0,20 et < 0,5 s ; le coût du contrôle
  ; `minShootXG` par mentalité), 2-4 tirs par match pour le 9 ; le faux 9 et son seuil de rupture 11-18 m ; le contre
  (premier appui, fixer ou servir à 3-5 m du défenseur).

## 2. Où en est le code

**Existant.** Les appels (41 : timé sur le passeur, servi en urgence ; 125 ; 144 le contre-appel ; 213d l'appel
anticipé ; `profondeurAvants` diagonale et cadence 3,5 s ; `appelNote` 210), l'attaque du centre (182b : un corps par
rai, la porte 2,5), la remise dos au but (240 `appuiRemise`, A10 le contact), le troisième homme (`troisieme`), la
tête (34 `tete`, 112, 147), la zone de vérité et la qualité de tir (232 `menace`, `qualiteTir` : seuils boîte 0,14 /
loin 0,05, pression ×0,6, la première intention), la dispersion (145), l'axe mentalité (149, coach), le pressing par
tiers (238 `garde`) et ses déclencheurs (`pressTriggers`, 161 la lecture), le contre-press (229), le faux 9 comme rôle
(interdit `tete`, ancrage 0,8), le poacher (interdit `decrochage`, repli 0,9).

**Partiel.** Les appels existent mais **sans budget** (1 090 bursts par match pour le 9, servis à 11 %) et sans
référence à la levée de tête ; la première intention existe mais 33 % des buts en une touche (c. 50-75) ; la Golden
Zone n'est pas nommée mais le tir y est concentré (71 % des tirs, 100 % des buts — trop) ; la conversion dedans est
33 % (c. 15) : la finition (258) ; le pressing du 9 est celui de tout le monde, à 4,6 m mais sans ombre ni courbe.

**Absent.** `RunLedger`, `serviceRate`, `refusalStreak` ; les `PT` comme déclencheurs nommés (« non » compris) ;
`R-05` le leurre, `R-09` le step-back ; le seuil de rupture du faux 9 ; la table xG comme objet.

## 3. Les tests de réfutation, un par un

| # | Cible (book) | Statut | Mesuré (2 × 90 min) |
|---|---|---|---|
| T1 `serviceRate` | 15-40 % | mesurable, **réfuté par le volume** | **11 %** de 2 180 bursts (appel-profond 498, contre-appel 778, chasse 430, appel 261) — dix fois trop de courses |
| T2-T2bis part de leurres ; distribution des types | 20-35 % ; 32/23/22/8/15 | absent (pas de leurre) ; distribution à recoder sur les kinds |
| T3 déplacement du marqueur par un leurre | 4-9 m | absent |
| T4 distance au porteur en pressing | 3-5 m dans ≥ 70 % | mesurable | **27 %**, p50 4,6 m — il colle ou il est loin : pas d'ombre projetée |
| T5 surcoût de la courbe | +3-16 % | absent (course droite) |
| T6 CV de la distance à ≥ 25 km/h | 50-80 % | à instrumenter |
| T7 récupérations hautes ; → tir | 7-8,5 ; 12-22 % | mesurable | **76,5 / match** (définition : tout changement de possession à < 40 m — le monde bascule 900 fois, ch. 01) ; **18 %** → tir ✓ |
| T8 hors-jeu du 9 | 0,3-1,2 / 90 | tenu au 259 | **0,0** → ~0,5-1 pour la pointe (3,75 pour les deux équipes au 259) |
| T9-T10 marge de la frontière ; séparation du contre-appel | | T9 mesuré au 259 : le coureur servi de l'épaule à +2,5 m au départ (p10 0 ; élite −0,3 à +0,3 — le passeur sert tôt) ; T10 à instrumenter |
| T11 duplication de slot | ≤ 17 % | mesuré ch. 07 | 9 % ✓ |
| T12 vitesse à l'arrivée du centre | ≥ 4 m/s dans 70 % | à mesurer |
| T13 buts dedans / dehors ; conversion | 84-88 % ; 14-16 / 3-5 % | mesurable | **100 %** dedans ; **33 %** / **0 %** — la finition (258) |
| T13bis Golden Zone | ≈ 50 % des tirs, ≈ 82 % des buts | mesurable | **71 %** des tirs, **100 %** des buts |
| T14 buts en une touche | 50-75 % | mesurable | **33 %** |
| T15-T16 tests causaux pression / ligne | 8 c. 15 % ; > 22 c. < 8 % | mesurables après 258 |
| T17 corps à la finition d'un contre | 3-5 | mesurable | **3,2** ✓ (6 contres) |
| T18 Dall'Oglio | | absent (pas de court-circuit) |
| T19 `pinCount` en bloc bas | 1,5-2,4 | mesurable | **1,33** (borne basse) |
| T20-T21 faux 9 | | partiel (rôle) — à mesurer avec false_9 |
| T22-T23 sensibilités `pressParticipation`, `pressOrientation` | | absents / 196 à mesurer |
| T24 touches du 9 | 18-28 surface, 45-65 liaison | mesurable, **réfuté** | **422 / 90** (chaque changement de propriétaire compté ; ch. 01 : 23 possessions par 10 min c. 10) |
| T25 `refusalStreak` | | absent |

## 4. Les lots que la fiche appelle

1. **Le budget de course** (T1, T6, ch. 07 T5, ch. 08 T17) : `RunLedger` — le 9 fait 1 090 bursts par match ; le
   sprint a un prix, la course non servie éteint l'engagement. C'est le lot transversal des attaquants, avec le profil
   locomoteur.
2. **L'épaule et le service** (T8, T9, T1 ; le 259 — SCELLÉ 334 : l'appel de l'épaule sur le porteur prêt, la course qui traverse, l'orteil) : les appels référencés à la levée de tête, la marge sur la
   ligne, 12-20 % de service en profondeur pure, 0,3-1,2 hors-jeu par 90 pour le 9.
3. **La finition** (T13-T16 ; le 258) : conversion 33 → 15 %, 3,7 % hors surface, 50-75 % en une touche.
4. **Le pressing du 9 comme suppression d'option** (T4, T5, PT1-8) : l'ombre projetée, la course courbe, les « non ».
5. **Le ballon qui ne vit pas avec le 9** (T24 ; ch. 01 T7) : 422 touches — la sortie de balle par derrière (ch. 03).
6. **Le leurre et le step-back** (T2, T3, R-09) — après le budget.
