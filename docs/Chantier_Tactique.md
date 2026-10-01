# Cahier de chantier — le réalisme tactique

Ouvert le 01/10, à la demande : « avoir le côté réaliste du foot à travers les tactiques des coachs en paramètre et les attributs des
joueurs avec leur poste et leur rôle dans les formations ».

## Le principe

- **Les consignes du coach sont les entrées**, réglées par équipe dans `tactics.js` : hauteur de bloc, largeur, pressing, style,
  tempo, mentalité, transition, compacité, relation, marquage, piège, repli. Chaque chantier BRANCHE ces entrées sur les décisions du
  moteur ; il ne crée pas de constante magique.
- **Les attributs et les rôles sont les modulateurs individuels** : à consigne égale, la note et le rôle du joueur changent ce qu'il
  fait et comment il le réussit.
- **Chaque loi vit derrière une clé** de `match-config.js` : à `null`, le jeu d'hier au bit (le jumeau). Au neutre (0,5 partout),
  l'identité.
- **Les sorties (buts, tirs, xG) ne sont PAS un critère pendant le chantier** (01/10 : « ce serait intéressant de se fier à ces chiffres
  quand on aura un moteur définitif ») : un lot se juge sur la STRUCTURE du jeu (les indicateurs tactiques des livres) ; les sorties sont
  notées au journal pour la calibration finale.
- **La preuve vient de la télémétrie** : `engine/stats.js` (les stats du match) et `engine/tactique.js` (la télémétrie tactique),
  rejouées par `scripts/stats-match.mjs --tactiques A,B`. Les cibles sont celles des livres `docs/Book_vers_Moteur` (B = bible
  01-16, M = modèle, R = référentiel). Chaque chantier doit faire entrer ses indicateurs dans la bande des livres ET faire varier
  chaque style dans le bon sens.
- **Le protocole d'un lot** : sonde (mesurer avant) → loi derrière une clé → audit des 7 presets c. `equilibre` (4 × 90 min) →
  bloc de vérification → banc rapide (jumeau, budget, blocs, synchronisation) → NOTES et registre → commit.

## L'état de départ (audit du 01/10, registre sections 9 et 10)

| Famille | Moteur | Livres |
|---|---|---|
| Hauteur de ligne | 23,8 (bloc bas) à 39,6 m (gegenpressing) | 18-26 bas · 34-44 médian · 48-56 haut |
| Récupérations dans le camp adverse | 40 (bloc bas) à 85 (ligne haute) | l'ordre est juste |
| Marquage des défenseurs (LAT / DC) | 11-14 m | 6,4 / 5,5 m |
| Défenseurs à < 10 m du ballon | ≈ 2 | 4,9 · bloc bas 6,3 · haut 4,2 |
| Interligne du bloc bas | 12,9 m | 5-8 m |
| Rest defense | 7,2 | 3,7 |
| Réceptions face au jeu | 45 % | 20-35 % |
| Conservation après réception pressée | 80 % | 67 % |
| Appels | ≈ 450 par équipe, 13 % servis | ≈ 100 sprints, 15-40 % servis |
| Renversements | 0-3 | ≈ 10-20 par équipe |
| Direct speed | 1,6-1,8 m/s pour tous | 1,4 possession · 2,1 direct |
| Possessions par équipe | 160-180 | 105 ± 25 |
| Ballons longs / passes vers l'arrière | 12-16 % / ≈ 30 % pour tous | 8-20 % / 24-28 direct · 40-42 possession |
| Possession | 48-51 % pour tous | 39,6-65 % |
| Duels aériens | 4-7 par match | 38-50 |
| PPDA | 4,5-7,7 | 7 (gegenpress) à 17 (bloc bas) |
| Ballon en jeu / touches / corners | 65-71 % / 20-24 / 2-4,5 | 54-58 % / 35-44 / 10 |

## Tableau de bord — audit des 7 presets après les lots 368-376 (contre-press décidé, avant le repli de consigne)

| Indicateur | Avant (audit du 01/10 matin) | Maintenant | Livres |
|---|---|---|---|
| Marquage LAT / DC (m du plus proche adversaire) | 12,2 / 12,4 | 8,5 / 10,7 | 6,4 / 5,5 |
| N_def(10) | 1,9 | 2,4-2,7 | 4,9 |
| Interligne bloc bas | 12,9 | 14,7 | 5-8 |
| Pointe → ligne adverse | 9-11 | 4-6,5 | 0-3 |
| Duels aériens par match | 4-7 | 10-14,5 | 38-50 |
| Renversements par équipe | 0-3 | 6-12 | ~10-20 |
| Passes par équipe | 545-620 | 455-535 | 420-475 |
| Ballons longs direct / possession | 15,8 / 15,9 % | 18,1 / 13,7 % | 8-20 % |
| Direct speed direct / possession | 1,7 / 1,7 | 2,1 / 1,8 | 2,1 / 1,4 |
| Contre-pressings bloc bas / équilibre / gegenpress | ~60 / 62 / 84 | 12 / 57 / 100 | 20-30 |
| Repli du perdant en 3 s | — | 0,2-1,9 m | (DC 1,3 s, 6 en 2,4 s) |
| Centres par équipe | 8,4 | 21-33 | 9-14 |
| Ballon en jeu | 68 % | 59-66 % | 54-58 % |
| Touches / corners par match | 19 / 3 | 13-22 / 2,5-5,8 | 35-44 / 10 |

## Les chantiers

### T1 — Le bloc qui se resserre vers le ballon *(en cours)*
- **But** : la défense serre les hommes près du ballon et coulisse en bloc ; le bloc bas est compact et dense.
- **Indicateurs** : N_def(10) 4,9 (bloc bas 6,3, haut 4,2) ; marquage LAT 6,4 > MIL 5,6 > DC 5,5 > ATT 5,1 ; interligne 10-15 m (bloc
  bas 5-8) ; coulissement k milieux 0,55-0,75, défenseurs 0,35-0,50 ; largeur défensive ; PPDA du bloc bas qui monte vers 15-17.
- **Entrées** : hauteurBloc, compacite, marquage (zone ↔ homme), pressing ; attributs positioning / concentration / workRate.
- **Leviers** : `formation.js` (blocFor, les postes défensifs), `marquage.js`, `interligne.js`, le coulissement côté ballon.
- **Lot 368 (scellé)** : `blocCoulisse` (chaque ligne : largeur 34 / 28 / 30 m × compacité, gain 0,42 / 0,65 / 0,5, borné par la
  touche) et `marquageElastique` (distance au porteur potentiel 0,5 m à 6 m du ballon → 12 m à 30 m ; le posté prend l'homme de sa zone).
  Mesuré : largeur défensive 40 → 34 m ; centraux 12,4 → 10,8 m du plus proche adversaire ; N_def(10) 1,9 → 2,1.
- **Ce que la mesure a appris** : la distance des défenseurs venait surtout de l'ATTAQUE adverse — ses pointes vivaient 9-13 m devant
  la ligne, personne n'entrait dans la zone des centraux. D'où le lot 369 (T2).
- **Lot 370 (scellé)** : trois causes trouvées par sonde. (1) La cible des défenseurs CLIGNOTAIT : 117-128 sauts de plus de 3 m par
  défenseur et par minute (livre : 12-25 changements par minute) — cinq couches la réécrivent après le slot ; `cibleLissee` (0,15 s,
  14 m/s ; 0,35 s faisait traîner le bloc à 36 m) : 31 sauts par minute. (2) Le corps ne rattrapait pas un retard de 6-12 m (l'entretien à
  la marche) : `effortRattrape`. (3) Les dix défenseurs s'étageaient UNIFORMÉMENT autour du ballon (un tous les ~3,5 m) quelle que soit
  la hauteur de ligne : `compressionBallon` (marqueurs et couvreurs à < 20 m se rapprochent du ballon, × compacité). N_def(10) des corps
  2,1 → 2,5 (bloc 239).
- **Reste** : N_def(10) 2,3-2,7 contre 4,9 ; marquage des défenseurs 9-13 m contre 5,5-6,4 ; interligne du bloc bas 13,5 contre 5-8.

### T2 — L'attaque qui s'engage *(en cours)*
- **Lot 369 (scellé)** : `fixeLigne` (hors appel, la pointe tient la hauteur de la ligne adverse, × rôle et mentalité) et
  `monteeOffensive` (en possession, le soutien à plus de 8 m de son poste offensif court le rejoindre : 4,2 m/s en possession posée →
  6,6 m/s en contre direct, selon transition et style). Mesuré : l'attaquant le plus avancé 7,6 → 4,7 m de la ligne de hors-jeu
  adverse ; centres 8,4 → 18,3 par équipe ; buts 1,5 → 1,9.
- **Lot 372 (scellé)** : deux règles bloquantes trouvées par sonde. (1) Le centre (tryCross ET l'arbitre menaceCentre) exigeait un
  coéquipier DÉJÀ dans la surface — hors-jeu tant que la ligne adverse tient ~20 m de son but : 2 centres en 30 min ; `centreArrivee` : le
  coureur à moins de 8 m de la surface compte, le centre vise le point utile. (2) Centre parti, seul le receveur visé courait ;
  `attaqueSurface` : dès que le porteur entre en zone de centre, 2 → 4 coureurs (× mentalité) sont désignés vers des zones distinctes
  (second poteau, premier poteau, penalty, entrée de surface), tenus en deçà de la ligne, et attaquent la zone à la frappe. Mesuré (2 × 45
  min) : premier toucher sur centre attaque 17 → 23 / défense 14 → 9 ; duels aériens gagnés attaque 1 → 10 / défense 6 → 3 (bloc 241).
- **Lot 373 (scellé)** : `restDefense` — la formation en possession plafonnait (ballon à 79 ou 88 m : centraux 53, latéraux 55, milieux
  68-72 ; 9 joueurs derrière le ballon). En attaque (possession > 1,5 s, ballon au-delà de la médiane), les gardes (centraux, sentinelle,
  le latéral opposé si la mentalité est prudente) tiennent, latéraux à 5 m et milieux à 9 m du ballon × mentalité. Latéraux en attaque
  44 → 70 m de leur but (bloc 242) ; marquage des latéraux adverses 12 → 8,4 m ; N_def(10) 2,2 → 2,7 ; centres 6,5 → 24,9 par équipe.
- **Reste** : la rest defense à la PERTE reste 7,1 (les pertes ont lieu surtout au milieu et chez soi : c'est la géographie des pertes,
  pas la montée) ; centres 25 par équipe (livre 9-14) et contre-pressings 79 (livre 20-30) à recadrer ; le jeu aérien hors centres (T7).
- **But** : à la possession installée, les latéraux et les milieux montent, la surface se remplit, les centres arrivent sur des
  attaquants lancés ; la rest defense tombe à ~4.
- **Indicateurs** : rest defense 3,7 (4-5 en attaque placée) ; arrivées dans la surface au centre (≤ 3-4 dans 90 % des cas, lancées
  ≥ 4 m/s 70 %) ; centres 9-14 par équipe à 19-24 % ; cutbacks 1,5-2 ; duels aériens 38-50 par match ; corners 10, touches 35-44.
- **Entrées** : mentalite, largeur, rôles (piston, latéral offensif, box-to-box, neuf de surface) ; attributs offTheBall, stamina,
  crossing, heading, jumping.

### T3 — Le style qui change le rythme (style, tempo, mentalité, transition) *(en cours)*
- **Lot 371 (scellé)** : `stylePasse` (terme additif du choix de passe, nul au neutre : longueur idéale 8 → 18 m, coût de la passe en
  l'air, verticalité, jeu long sur la pointe — selon style et mentalité) ; les presets règlent enfin tempo et mentalité. Bloc 240 :
  ballons longs direct 25,5 % c. possession 11,1 % ; direct speed 2,25 c. 1,50 m/s (livre 2,1 / 1,4). Audit des 7 presets : séquences
  de 10+ passes possession 8 c. direct 3,8 ; renversements 0-3 → 5-11 par équipe.
- **Reste** : la possession du preset possession 53 % (cible 55-65) avec autant de passes que les autres ; les passes vers l'arrière
  (40-42 % c. 24-28) à mesurer ; le soutien qui suit l'action en direct (vitesse, nombre d'arrivées).
- **But** : le choix de passe lit le style (longueur, verticalité, jeu long vers l'avant-centre, renversements), le tempo (temps de
  tenue, une-touche) et la mentalité (risque) ; le soutien sans ballon SUIT l'action en jeu direct ; les presets règlent tempo et
  mentalité de façon cohérente.
- **Indicateurs** : direct speed 1,4 (possession) → 2,1 (direct) ; ballons longs 8-20 % selon l'école ; passes vers l'arrière 40-42 %
  (possession) / 24-28 % (direct) ; possession 39,6-65 % ; séquences 105 ± 25 à 3,5-5,1 passes, séquences de 10+ passes 7 ± 3 ;
  renversements 1 toutes les 8-14 possessions ; R_fwd au tiers propre 0,20-0,30 (possession) / 0,45-0,60 (direct).
- **Entrées** : style, tempo, mentalite, transition, relation ; attributs vision, passing, longShots (passe longue), decisions.

### T4 — Les transitions et le replacement
- **But** : le contre-pressing dépend du pressing et de la transition ; le bloc se reforme plus ou moins vite selon la consigne ; la
  contre-attaque va vite à 3-5 joueurs.
- **Indicateurs** : contre-pressing 20-30 par équipe, premier contact 0,9-1,6 s, 3-5 joueurs à < 10 m à t₀ + 1,5 s ; bloc reformé
  8-12 s (shapeScore > 0,75 — critère à affiner) ; contre 5,55 m/s médian, 10,3 s, 2,7 passes ; tirs à ≤ 10 s du regain 62 %.
- **Entrées** : pressing, transition, repli ; attributs workRate, stamina, anticipation.

### T5 — Les courses sans ballon et les combinaisons
- **But** : moins de courses, mieux synchronisées avec le porteur prêt (tête levée ≥ 0,2 s, temps avant pression ≥ 0,8 s), plus
  souvent servies ; une-deux, troisième homme et renversements qui naissent du jeu.
- **Indicateurs** : courses servies 15-40 % (profondeur pure 12-20 %, décrochage 35-50 %) ; départ 1,5-3 s avant la passe ; sprints
  ≈ 10 par joueur ; leurres 20-35 % des courses ; remises dos au but 78-90 %.
- **Entrées** : relation, style, rôles (appel, profondeur) ; attributs offTheBall, anticipation, acceleration.

### T6 — La réception et la pression réalistes
- **But** : la pression du presseur et l'orientation du receveur rendent les réceptions plus dures.
- **Indicateurs** : réceptions face au jeu 20-35 %, dos 15-30 % (35-55 % sous forte pression) ; conservation 76,5 % sans pression,
  66,8 % sous pression ; scan 0,44 /s.
- **Entrées** : pressing, marquage ; attributs firstTouch, composure, anticipation, strength.

### T7 — Les duels et les seconds ballons *(en cours)*
- **Lot 374 (scellé)** : `disputeAerienne` — l'intercepteur du match ne lisait que les passes basses (< 1,4 m) : 35 ballons en l'air sur
  56 atterris sans adversaire à moins de 3 m, contrôlés tranquillement. Le défenseur le plus proche (≤ 20 m) attaque le RECEVEUR côté but,
  même en retard (il dispute le second ballon) — viser le point de chute le laissait à 6 m : le receveur va au-devant. Duels aériens 7,5
  → 13,8 par match (4 × 90 min, livre 38-50) ; bloc 243.
- **Reste** : les autres sources de jeu aérien (sorties de but longues, dégagements de la tête) ; le marquage serré qui rend le duel
  possible dès la passe (T1).
- **Essai annulé (375, centreDosage)** : compter pour moitié le coureur qui arrive dans la note du centre (menaceCentre) ne bouge pas les
  centres (23 → 22,4 par équipe, livre 9-14) — le choix en valeur attendue (choix.js, cfg.choix) pèse le centre par `centreP` /
  `centreXg`, à peine par le nombre de cibles. Le volume de centres se règle là, à la CALIBRATION FINALE (les constantes de valeur).
- **But** : le jeu aérien existe (duels sur ballons longs, centres, dégagements) ; le second ballon se dispute selon le placement.
- **Indicateurs** : duels aériens 38-50 par match, défenseurs 55,7 % de réussite ; le vainqueur récupère 45 % au milieu (67 % sur
  centre) ; tacles réussis 9,3 par équipe ; glissés 5-7.
- **Entrées** : style (jeu long), compacite (le placement au second ballon) ; attributs heading, jumping, strength, bravery, aggression.

### T8 — Les attributs par poste et par rôle
- **But** : chaque rôle a sa signature statistique, et la note la module (l'ailier rapide dribble et centre, le DC grand gagne les
  airs, le 6 récupère, le meneur fait les passes clés).
- **Indicateurs** : take-ons ailier 4,3 ± 3,7 à 40-50 % ; DC 65-70 % dans les airs ; ratio interceptions / tacles du 6 ; ≥ 5 × les
  tentatives de dribble du médian pour les spécialistes ; rapport rôles / formes 1,8-3,5 (M14).
- **Méthode** : audit par rôle (effectifs notés, rôles variés), comme l'audit tactique.

### T9 — Les arrêts de jeu en conséquence
- **But** : vérifier que touches, corners et sorties de but REVIENNENT avec T1-T7 (l'hypothèse du 30/09) ; corriger ce qui reste.
- **Indicateurs** : ballon en jeu 54-58 % ; touches 35-44 ; corners 10 ; sorties de but 16 ; coups francs.

### T10 — La télémétrie à affiner
- La distance d'intervention selon la définition des livres (la distance où le défenseur S'ENGAGE) ; le troisième homme compté au motif
  (A → B → C, C lancé) ; le bloc reformé par un vrai shapeScore ; le coulissement k ; le PPDA en 4 définitions nommées (M16) ; la
  séquence Opta (≠ possession).
- Le panneau de la page du match affiche la télémétrie tactique.

## Journal

| Date | Chantier | Lot | Ce qui a bougé |
|---|---|---|---|
| 01/10 | — | — | Audit des 7 presets ; télémétrie `tactique.js` ; ce cahier |
| 01/10 | T1 | 368 | Largeur défensive 40 → 34 m ; centraux 12,4 → 10,8 m de l'adversaire |
| 01/10 | T2 | 369 | Pointe à 7,6 → 4,7 m de la ligne ; centres 8,4 → 18,3 |
| 01/10 | T1 | 370 | Sauts de cible 117 → 31 par minute ; N_def(10) des corps 2,1 → 2,5. Sorties (non critère) : buts ~4 par équipe, tirs ~19, xG ~3 |
| 01/10 | T2 | 372 | Centres ×2-4 ; sur centre, duels aériens gagnés par l'attaque 1 → 10 |
| 01/10 | T2 | 373 | Latéraux en attaque 44 → 70 m ; LAT 12 → 8,4 m de l'adversaire ; N_def(10) 2,7 ; centres 25 (trop) |
| 01/10 | T7 | 374 | Duels aériens 7,5 → 13,8 par match |
| 01/10 | T3 | 371 | Longues direct 25,5 % c. possession 11,1 % ; direct speed 2,25 c. 1,50 ; passes 440-465 ; ballon en jeu 57-65 % ; sorties de but 16-21 |
