# Bible 07 — Le joueur entre les lignes (n°10), contre le moteur

*Fiche du 9/09, moteur 767de25 (SCEAU 256). Mesures : 2 matchs de 90 min (graines 3, 7) en 4-2-3-1 (le 10 = AM(C)),
contre un adversaire par défaut puis en bloc bas.*

## 1. Ce que le chapitre demande

- **La poche** comme polygone dérivé de l'adversaire seul (`xFront` la ligne des D, `xBack` la ligne des milieux,
  `h` 10-15 m en bloc médian, 5-8 en bloc bas, lobes, `ttc`, propriétaire avec hystérésis) — jamais une case fixe.
- **Le placement dynamique** : dans l'ombre du 6 adverse (hors de son regard, 3,5-9 m derrière), le décalage de
  2-5 m, **bouger quand le porteur est prêt** (`carrierReady` : contrôle, première touche faite, tête levée ≥ 0,2 s,
  temps de pression ≥ 0,8 s, dans son secteur, vu récemment), deux populations de mouvement (micro 2-5 m ×6-10, HI).
- **La réception** : trois classes d'orientation (ouvert ≤ 45° 20-35 %, trois-quarts 45-60 %, dos > 110° 15-30 %),
  la règle Dall'Oglio en court-circuit, cinq régimes de possession (`ONE_TOUCH` 0,15-0,45 s … `PAUSA` 1,5-3,5 s).
- **La passe en profondeur** : un arbre ordonné (coureur, hanches des centraux, ligne haute ou déchirée ≥ 4 m,
  intervalle ≥ 8 m, gardien < 12 m), la fenêtre de hors-jeu par régime de ligne, **le déclencheur du côté des
  attaquants** (`carrierFacingFree`), > 92 % des profondeurs précédées d'un départ.
- **Le pressing** : trois doctrines (première ligne / prend le 6 / exonéré), l'argument chiffré de Cruyff, la règle
  Mauricio du demi-engagement puni ; sa propre perte comme événement défensif le plus fréquent (14-24 % récupérées).
- **Les infiltrations** (arrivée lancée ≥ 4 m/s, non-duplication de slot ≤ 17 %), **la pausa** définie mesurablement
  (ballon < 1 m/s, joueur < 1,5, 0,6-2,5 s, un scan, et de la valeur produite), le faux 9 comme dilemme produit.

## 2. Où en est le code

**Existant.** L'homme libre entre les lignes (`hommeLibre` : seuil 2,5, malus 4 — un malus de passe, pas une poche) ;
la passe en profondeur au sol (128 `throughBall`, 213 `throughRisque` en temps) et la piquée ; les appels (41, 125,
144, 210) et l'appel anticipé (213d) ; la remise dos au but (240) ; l'attaque du centre (182b), les zones de contre
(242) ; les rôles trequartista / shadow_striker / free_role_creator / false_9 (axes ancrage, tenue, press, repli) ;
le scan (250) ; la tenue calme (211) ; le contre-press (229) ; les interdits (`decrochage` pour le poacher).

**Partiel.** Le 10 est posté à son spot (formation coulissée) puis « se montre » (67) : il n'a pas de poche dérivée de
l'adversaire ; la passe en profondeur est décidée côté passeur (le coureur existe : 75-89 % des profondeurs ont un
appel dans les 2 s — mais le déclencheur est le passeur) ; l'orientation à la réception est produite par le corps
ouvert (170) : trop d'« ouvert » et de « dos », pas assez de trois-quarts ; le pressing du 10 est celui de tout le
monde (byDist) ; la pausa est le lot 253 (interface gelée), absente aujourd'hui.

**Absent.** `InterlinePocket`, `carrierReady`, `HOLD` (l'immobilité active), la règle Mauricio, les régimes de
possession, la fraîcheur mutuelle (`mutualAwareness`), le faux 9 comme dilemme du marqueur.

## 3. Les tests de réfutation, un par un

| # | Cible (book) | Statut | Mesuré (2 × 90 min) |
|---|---|---|---|
| T1 `h` de la poche adverse, médian / bas | 10-15 / 5-8 m | mesurable, **inversé** | adversaire par défaut **0,1 m** (la ligne des milieux adverses est SUR la ligne des D : pas d'interligne), bloc bas **11,0 m** |
| T2 réceptions dans la poche, médian / bas | ≥ 3 : 1 | mesurable | **4 / match** c. **0** — sur 56 et 100 réceptions : le 10 ne reçoit presque jamais entre les lignes |
| T3-T4 micro-repositionnements 2-5 m, ratio 6-10 : 1 | | à re-mesurer (sonde) |
| T5 courses HI | 15-25 / match | mesurable, **réfuté** | **492** (634 contre bloc bas) — le 10 sprinte vingt fois trop : les bursts (appel, contre-zone, chasse) sont des sprints sans budget |
| T6 distance | 11 494 ±765 | mesurable | **11 659** ✓ (15 113 contre bloc bas) |
| T7 orientation | 20-35 / 45-60 / 15-30 % | mesurable | **36 / 31 / 33 %** (25 / 42 / 33 contre bloc bas) — pas assez de trois-quarts, trop de dos |
| T8 Dall'Oglio désactivé | | absent (pas de court-circuit) |
| T9 réussite sous pression | −2 à −5 pts élite | mesurable — à mesurer |
| T10 fenêtre de hors-jeu par régime de ligne | | absent (1 hors-jeu / match) |
| T11 profondeurs précédées d'un départ | > 92 % | mesurable | **75 %** (89 contre bloc bas) |
| T12 vitesse à l'arrivée du centre ≥ 4 m/s | 70 % | mesurable — à mesurer |
| T13 duplication de slot | ≤ 17 % | mesurable | **9 %** ✓ (182b : un corps par rai) |
| T14 pausa 0,6-2,5 s | | **absent** : 0 / match — le lot 253 |
| T15-T19 tests causaux (Mauricio, faux 9, Cruyff, `pressParticipation`, `roamAt`) | | absents (les curseurs n'existent pas) ; le faux 9 est un rôle (interdit `tete`, ancrage 0,8) |
| T20 scan élite / moyen | écart < 0,10 | loi existante (250 : 0,88 c. 0,72 par vol — l'écart est dans la tolérance) |
| T21 bloc adverse ≤ 25 m | > 90 % | mesurable | **45 %** par défaut, **100 %** en bloc bas — le bloc par défaut est étiré |
| T22 contre un marquage individuel | | partiel (axe marquage) — à mesurer |
| T23 pertes du 10 récupérées ≤ 5 s | 14-24 % | mesurable | **20 %** ✓ (13 % contre bloc bas) |

## 4. Les lots que la fiche appelle

1. **La poche dérivée de l'adversaire** (T1, T2) : `InterlinePocket` calculée sur les deux lignes adverses, le 10
   ancré dessus — aujourd'hui l'interligne adverse n'existe pas par défaut (0,1 m) et le 10 y reçoit 4 fois par match.
   Il dépend de « la ligne est une ligne » (ch. 03) côté défense.
2. **Le sprint a un budget** (T5) : 492 courses HI par match — les bursts sont gratuits ; c'est le profil locomoteur
   (ch. 01 T22) et la fatigue à compartiments (Réf. 07).
3. **La pausa** (T14) — le 253, déjà gelé.
4. **Le déclencheur côté attaquants** (T11, T8) — le 259 (SCELLÉ 334) : la pointe part sur le porteur prêt (posé, ≤ 28 m).
5. **L'orientation de trois-quarts** (T7) : la réception de trois-quarts (A12b) lit `pick.foot` ; le corps ouvert
   (170) doit produire 45-60 % de trois-quarts, pas 31.
