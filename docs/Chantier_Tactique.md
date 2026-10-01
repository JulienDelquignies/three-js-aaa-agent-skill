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

## Les chantiers

### T1 — Le bloc qui se resserre vers le ballon *(en cours)*
- **But** : la défense serre les hommes près du ballon et coulisse en bloc ; le bloc bas est compact et dense.
- **Indicateurs** : N_def(10) 4,9 (bloc bas 6,3, haut 4,2) ; marquage LAT 6,4 > MIL 5,6 > DC 5,5 > ATT 5,1 ; interligne 10-15 m (bloc
  bas 5-8) ; coulissement k milieux 0,55-0,75, défenseurs 0,35-0,50 ; largeur défensive ; PPDA du bloc bas qui monte vers 15-17.
- **Entrées** : hauteurBloc, compacite, marquage (zone ↔ homme), pressing ; attributs positioning / concentration / workRate.
- **Leviers** : `formation.js` (blocFor, les postes défensifs), `marquage.js`, `interligne.js`, le coulissement côté ballon.
- **Mesuré à la fin** : *à remplir*.

### T2 — L'attaque qui s'engage
- **But** : à la possession installée, les latéraux et les milieux montent, la surface se remplit, les centres arrivent sur des
  attaquants lancés ; la rest defense tombe à ~4.
- **Indicateurs** : rest defense 3,7 (4-5 en attaque placée) ; arrivées dans la surface au centre (≤ 3-4 dans 90 % des cas, lancées
  ≥ 4 m/s 70 %) ; centres 9-14 par équipe à 19-24 % ; cutbacks 1,5-2 ; duels aériens 38-50 par match ; corners 10, touches 35-44.
- **Entrées** : mentalite, largeur, rôles (piston, latéral offensif, box-to-box, neuf de surface) ; attributs offTheBall, stamina,
  crossing, heading, jumping.

### T3 — Le style qui change le rythme (style, tempo, mentalité, transition)
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

### T7 — Les duels et les seconds ballons
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
