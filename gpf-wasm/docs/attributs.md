# Les attributs des joueurs : qui les lit, et ce qu'il faut transmettre

*État du 2 octobre 2026.*

## En bref

- **Aujourd'hui, ni le corps ni le cerveau ne voient les joueurs de la carrière.**
- **Le corps** joue avec les 22 profils par poste de la version Google. Les deux équipes sont identiques : leurs deux gardiens ont exactement les mêmes chiffres.
- **Le cerveau** joue avec ses attributs par défaut : `creerCerveau` ne reçoit pas d'effectif.
- **Il faut donc les transmettre aux deux.**
  - Le cerveau décide : tenter un dribble, voir une passe, garder son sang-froid.
  - Le corps exécute : courir vite, accélérer, toucher juste, frapper fort.
  - Beaucoup d'attributs servent aux deux. Le dribble, par exemple : le cerveau décide de tenter, le corps réussit plus ou moins sa touche.
- **C'est le lot L3** du cadrage, « les données entrent toutes ». La porte du corps existe déjà : `gf_set_stat` et `gf_get_stat`, joueur par joueur.

## 1. La carrière (foot) : 34 attributs

De 0 à 100, 50 étant neutre (`DbAttrs`, `src/test/attrsFixture.ts` du dépôt foot) :

| Famille | Attributs |
|---|---|
| Physiques | pace, acceleration, agility, stamina, strength, jumping |
| Techniques | passing, finishing, dribbling, firstTouch, crossing, technique, longShots, heading, tackling |
| Mentaux | vision, composure, anticipation, decisions, offTheBall, positioning, workRate, aggression, concentration, bravery, flair |
| Gardien | reflexes, handling, kicking, throwing, oneOnOnes, aerialReach, command |
| Pied faible | weakFoot |

Le contrat d'entrée du match (`MatchSetupV1`, lot L1) les porte déjà.

## 2. Le cerveau : des facteurs, presque les mêmes noms

Le moteur de la skill (`attributes.js`) lit des attributs bruts aux mêmes noms que la carrière, pour la plupart. Il les change en **facteurs** autour de 1 :

| Attribut | Facteur, et ce qu'il change |
|---|---|
| pace, acceleration | la vitesse de pointe × [0,90 ; 1,10], le démarrage × [0,88 ; 1,12] |
| passing | le bruit d'angle de la passe, de 6° à 0,5° |
| control (la carrière dit `firstTouch`) | la fermeté du contrôle |
| dribbling | la longueur de touche ; l'engagement et la vente des gestes ; l'esquive du duel |
| technique | `gesteF` [0,55 ; 1,10] : savoir faire le geste. C'est le flair (la persona) qui décide de tenter |
| finishing | le bruit du point visé ; `finF` dans la loi de finition |
| longShots, shotPower | l'audace de loin ; la puissance du geste |
| tackling | la portée du duel, l'horloge du tacle |
| vision, decisions, composure, concentration | la passe vue, le seuil de panique, l'erreur de passe pressée, l'erreur qui gonfle avec la fatigue |
| anticipation, teamwork, positioning, marking, workRate, offTheBall, movement, scanning | la lecture du bloc, la cohésion du pressing, le placement, le marquage, le contre-pressing, les appels, le regard |
| aggression, strength, jumping, heading | l'accrochage (donc les fautes), la charge d'épaule, la détente, la tête |
| agility, stamina | le relevé après une chute, le drain de fatigue |
| reactions (la carrière dit `reflexes`), keeping, handling, kicking, throwing, aerialReach, oneOnOnes, command | les réflexes et le métier du gardien, ses relances, ses sorties |
| weakFoot, crossing | le malus du mauvais pied, la précision du centre |

Le cerveau en a une poignée que la carrière n'a pas (`shotPower`, `teamwork`, `keeping`, `scanning`, `movement`, `marking`). Il n'a pas `bravery`, et lit `flair` dans la persona. Le détail est dans `moteur.md`.

## 3. Le corps : 22 attributs, de 0 à 1

Le corps lit 19 de ses 22 attributs (`utils.hpp`, `PlayerStat`). Ses valeurs par défaut, dans nos matchs, vont de 0,2 à 1.

| Attribut du corps | Ce qu'il change dans le corps | Où |
|---|---|---|
| `physical_velocity` | la vitesse de pointe (facteur 0,9 + 0,1 × l'attribut) | `playerbase.cpp:135` |
| `physical_acceleration` | l'accélération (× 0,7 + 0,3 × l'attribut) ; avec l'agilité, la pénalité des gestes difficiles | `humanoidbase.cpp:2144, 1743` |
| `physical_agility` | la vivacité : il freine et relance plus vite, tourne plus sec, et les gestes difficiles lui coûtent moins | `humanoidbase.cpp:1743, 1863, 1898, 2040` |
| `physical_balance` | qui l'emporte dans une bousculade, et qui tombe | `match.cpp:1303-1345` |
| `physical_reaction` | le retard de perception (80 − 40 × l'attribut, en ms) ; le temps pour réagir à une touche adverse | `icontroller.cpp:32`, `humanoid.cpp:581`, `humanoid_utils.cpp:199` |
| `physical_stamina` | la fatigue | `player.cpp:449` |
| `physical_shotpower` | la puissance maximale d'une frappe (32 + 13 × l'attribut m/s) | `humanoid_utils.cpp:435` |
| `technical_ballcontrol` | la précision des touches et des contrôles, et l'angle qu'une touche peut corriger | `humanoid_utils.cpp:210, 327`, `humanoidbase.cpp:1778` |
| `technical_dribble` | le ballon tenu près du pied en conduite, la difficulté d'une touche, la relance après une touche | `humanoid_utils.cpp:312`, `humanoidbase.cpp:1748, 2008` |
| `technical_shortpass`, `technical_highpass` | la difficulté (l'erreur) de la passe courte, de la passe haute | `humanoid.cpp:2270-2271` |
| `technical_shot` | l'erreur de la frappe : le « pire cas » pèse moins | `humanoid_utils.cpp:499` |
| `technical_volley` | la volée : la frappe d'un ballon qui arrive vite | `humanoid_utils.cpp:455` |
| `technical_standingtackle`, `technical_slidingtackle` | qui gagne le ballon dans un tacle debout, glissé | `match.cpp:1281-1284` |
| `mental_calmness` | l'erreur sous la gêne d'un adversaire proche | `humanoid_utils.cpp:272` |
| `mental_workrate` | l'effort de leur IA : sans effet quand notre cerveau pilote | `elizacontroller.cpp:582` |
| `mental_defensivepositioning`, `mental_vision` | le placement de leur gardien | `goalie_default.cpp:247` |
| `technical_header`, `mental_resilience`, `mental_offensivepositioning` | **rien** : jamais lus | — |

## 4. Ce qu'il faut faire (lot L3)

1. **Transmettre l'effectif au cerveau.** `creerCerveau` doit recevoir les deux effectifs et poser les attributs bruts de chaque joueur dans le monde du cerveau. La carrière et le cerveau parlent presque la même langue : il suffit d'une table de noms (`firstTouch` → `control`, `reflexes` → `reactions`, …) et de valeurs pour ses attributs propres.
2. **Transmettre au corps ce qu'il exécute.** Au coup d'envoi, `gf_set_stat` pour chaque joueur, avec une table carrière → corps :

   | Corps | Depuis la carrière |
   |---|---|
   | `physical_velocity` | pace |
   | `physical_acceleration` | acceleration |
   | `physical_agility` | agility |
   | `physical_balance` | strength |
   | `physical_reaction` | reflexes pour le gardien ; anticipation pour les autres (à trancher) |
   | `physical_stamina` | stamina |
   | `physical_shotpower` | à dériver : finishing, longShots, strength |
   | `technical_ballcontrol` | firstTouch |
   | `technical_dribble` | dribbling |
   | `technical_shortpass` | passing |
   | `technical_highpass` | passing et crossing |
   | `technical_shot` | finishing |
   | `technical_volley` | technique |
   | `technical_standingtackle`, `technical_slidingtackle` | tackling |
   | `mental_calmness` | composure |
   | `mental_defensivepositioning`, `mental_vision` (gardien) | command, oneOnOnes |
3. **Caler l'échelle.** La carrière va de 0 à 100. Le corps a été réglé pour ses propres profils (0,2 à 1), et certains attributs y pèsent peu : la vitesse de pointe ne varie que de 10 %. L'échelle se cale par la mesure, pas à l'œil.
4. **Apparier les joueurs.** Aujourd'hui, l'adaptateur apparie les joueurs du corps et ceux du cerveau par la position, au coup d'envoi. Avec un effectif, il faut l'appariement de la carrière : qui joue où. Le corps place ses joueurs selon le 4-3-3 de la version Google. Lui donner la formation de la carrière demande une porte de plus dans l'API, non écrite.
5. **Vérifier qu'aucun réglage n'est mort.** C'est le critère du §6 : chaque attribut doit changer une mesure, un attribut à la fois, sur une série de matchs (`bancs/serie.mjs`).

## 5. Et pour voir un Taarabt ?

Les attributs n'y suffisent pas.
- **Dans le cerveau**, `flair` et `technique` décident de tenter le geste.
- **Dans le corps**, l'agilité, le dribble et le contrôle le font réussir.
- **Mais le face-à-face « Taarabt »** n'existe aujourd'hui que dans le duel 1 contre 1 : planté face au défenseur, la semelle sur le ballon, des feintes enchaînées jusqu'à ce que le défenseur s'engage. C'est `face.js`, sur la branche `feat/1v1-maquette`.
- **Le corps n'a aucun de ces gestes** (`animations.md`, partie 2).

Il faut donc, dans l'ordre :
1. porter la décision du face-à-face dans le cerveau du 11 contre 11, et la faire appeler par l'adaptateur ;
2. fabriquer ses gestes en animations du corps, avec le convertisseur à écrire ;
3. les demander au corps par le mécanisme qui existe déjà (`specialVar1`, environ 15 lignes de C++) ;
4. apprendre au corps plusieurs touches de balle par geste, pour la roulette et la croqueta.
