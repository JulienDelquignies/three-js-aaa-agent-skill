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

## Tableau de bord — audit tac5 après les lots 377-384 (7 presets × 4 graines × 90 min, équipe A ; entre parenthèses : tac4)

| Indicateur | équilibre | gegenpr. | possession | bloc bas | direct | large/centres | ligne haute | Livre |
|---|---|---|---|---|---|---|---|---|
| Marquage DC (match) | 8,3 (10,7) | 6,8 (9,1) | 7,2 (9,6) | 9,7 (13,4) | 8,0 (10,3) | 7,7 (10,4) | 6,8 (8,7) | 5,5 |
| Marquage DC, défense installée | 5,1 | 4,6 | 5,2 | 5,9 | 5,0 | 4,9 | 4,8 | 5,5 |
| Marquage LAT, défense installée | 5,8 | 4,8 | 5,8 | 6,7 | 5,9 | 5,6 | 5,2 | 6,4 |
| N_def(10) | 2,0 (2,6) | 2,2 (2,7) | 2,1 (2,7) | 2,0 (2,4) | 2,0 (2,6) | 2,0 (2,5) | 2,2 (2,7) | 4,9 (bloc bas 6,3) |
| Interligne | 15,4 (12,0) | 12,3 (10,6) | 12,3 (11,7) | 17,5 (14,7) | 15,1 (11,6) | 14,9 (11,7) | 11,6 (10,1) | 10-15 (bloc bas 5-8) |
| Interligne, défense installée | 8,0 | 6,4 | 7,8 | 10,0 | 8,1 | 7,6 | 6,7 | — |
| Séquences de 10+ passes | 9,5 (7,3) | 10,0 (6,8) | 11,3 (6,5) | 6,8 (6,5) | 4,0 (4,8) | 5,3 (5,5) | 7,3 (10,5) | 7 ± 3 |
| Passes par séquence : p90 / max | 7 / 16 | 7 / 18 | 8 / 22 | 6 / 16 | 5,5 / 14 | 7 / 17 | 7 / 17 | — |
| Direct speed (m/s) | 1,8 | 2,1 | 1,5 | 2,0 | 2,1 | 1,8 | 1,8 | 1,4 poss. · 2,1 direct |
| Contre-pressings | 22 (58) | 99 (100) | 55 (64) | 6 (12) | 27 (62) | 27 (56) | 71 (95) | 20-30 |
| Repli en 3 s (m) | 2,0 (1,1) | 1,2 (0,6) | 1,3 (0,4) | 3,4 (1,9) | 2,6 (1,3) | 2,2 (1,4) | 1,5 (0,2) | — |
| Bloc reformé (s) | 2,3 (3,5) | 1,7 | 3,4 | 3,3 (6,5) | 1,8 | 2,5 | 2,0 | 8-12 |
| Renversements | 5,5 (8,5) | 2,8 | 1,0 (6,0) | 3,0 | 4,0 (11,0) | 2,3 | 4,8 (12,0) | 1 / 8-14 possessions |
| Touches / corners / sorties de but | 13/7,5/8 | 20/7/15 | 15/5/12 | 18/8/9,5 | 19/5/15 | 17,5/8/12 | 13/10/14,5 | 35-44 / 10 / 15-18 |

Lecture : le marquage par phase est au livre (installé 4,6-5,9 m) ; la possession se distingue (11,3 séquences de 10+, direct speed 1,5)
et le direct aussi (4,0 ; 2,1 m/s) ; contre-press et repli suivent la consigne. **Régressions** : la densité au ballon N_def(10) tombe
2,6 → 2,0 (livre 4,9) — chaque défenseur suit son homme, plus personne ne serre le porteur ; l'interligne s'ouvre (bloc bas 14,7 → 17,5,
livre 5-8) ; les renversements baissent (possession 6 → 1). Le rôle du passeur change le VOLUME (centraux relanceurs 133 passes c.
stoppeurs 96 ; regista 76 c. destroyer 61) mais pas le profil (36-39 % vers l'avant pour tous) ; le destroyer tente plus risqué (P̂ 0,67
c. 0,80) — à reprendre.

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
- **Essai 377, non scellé : la consigne et les qualités pilotent le marquage** (le 01/10 : « c'est des choix tactiques et des qualités
  de joueur ça aussi »). Sonde de sensibilité (2 × 30 min, centraux de l'équipe A) : consigne marquage 0,1 c. 0,9 → 10,7 c. 10,4 m ;
  compacité 0,1 c. 0,9 → 10,3 c. 10,4 ; défense notée 30 c. 80 → 10,3 c. 10,6. Aucun levier ne mordait. Essayé, sous clés :
  - `marquageConsigne` : la distance loin du ballon (zone 10 m … homme 3 m), le rayon où l'on prend l'homme, la laisse, le rayon du
    marquage à l'homme, la zone loin et le nombre de marqueurs (3 … 6) suivent l'axe marquage ; × la hauteur du bloc, × le rôle
    (marqueSerre), × la note (2 − markF), le posté compris ;
  - `pointeComite` : la pointe devant le ballon ne siège plus au comité de soutien (× la profondeur de son rôle : le faux 9 décroche)
    et tient la ligne à un recul fixé par son rôle, plus par une fraction.
  Jumeau au bit, mais la mesure ne bouge pas (dans le bruit de ± 1 m). **Pourquoi, vu par l'image** (instantanés bloc bas c. équilibre) :
  la cible du central posté est elle-même à 12,5-13,5 m de tout adversaire. Le plus proche adversaire est à 17,9 m de son slot en
  moyenne. Ballon dans la moitié du bloc et attaque installée, l'équipe qui attaque n'a que 4 joueurs à moins de 15 m de la ligne
  et 6 sur 10 derrière le ballon (livre : 3,7). Ses centraux restent à 33 m derrière le ballon ; contre un bloc bas, l'avant-centre vit à
  10 m devant la ligne (il siège au comité de soutien). **Le marquage serré n'a personne à serrer.** La consigne de marquage ne pourra
  mordre qu'une fois l'OCCUPATION offensive réaliste (T2 : latéraux hauts, intérieurs dans les demi-espaces, pointe sur la ligne,
  rest defense 2 + 1). Le correctif est gardé hors du dépôt, à rejouer après T2.
- **Lot 377 (scellé) — tout dépend des rôles** : `occupationRole`, `retourPoste`, `marquageConsigne` (le correctif ci-dessus, rejoué).
  Bloc 245 : latéraux installés − 3,9 m du ballon (pistons) c. − 10,3 (prudents) ; centraux du bloc bas 12,4 → 9,6 m à l'entrée dans
  leur moitié, **6,5 → 5,3 m en défense installée (livre 5,5)**. Par phase, le marquage installé est au livre ; la moyenne de match
  mélange les phases (le ballon dans la moitié adverse : DC 14-16 m). Télémétrie : `marquageInstalle`, `densiteInstalle`,
  `interligneInstalle`. Reste : la consigne zone ↔ homme et les notes défensives mordent à peine ; N_def(10) 2,5.

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
- **Mesuré avant le 378** (possession c. direct, 2 × 30 min) : les possessions sont au livre (19,7 par équipe et par 10 min, 15 s ;
  ~535 passes par 90 min en possession, ~400 en direct) ; les styles se distinguent (possession 56 %, 3,0 c. 2,15 passes par séquence,
  direct speed 1,75 c. 2,35) mais trop peu. Premières causes de perte de l'équipe de possession : la passe CONTESTÉE (24 sur 116, le
  receveur qui attaque une passe disputée) et la passe courte perdue (18). Elle servait plus de receveurs marqués à < 3 m que l'équipe
  directe (18 % c. 10 %, gardées à 63 %).
- **Lot 378 (scellé)** : `liberteStyle` (style-passe.malusLiberteStyle, terme de rondo.choosePass) — plus le style penche vers la
  possession, plus le passeur exige d'espace au receveur (seuil 2,5 → 6 m), × vision × décisions × le RÔLE (axe tenue : regista ×1,2,
  destroyer ×0,76) ; nul au neutre et en direct (l'empreinte par défaut ne bouge pas). Bloc 246 : receveurs marqués 18,0 → 9,2 % ; à
  tactique égale, milieu regista / meneur reculé / mezzala 3,25 passes par séquence c. destroyers / box-to-box 2,65. Aussi : possession
  56 → 59 %, durée 15,5 → 17,7 s, passes vers l'arrière 38 → 44 % (livre 40-42).
- **Distribution des séquences (01/10, 4 affiches × 2 × 90 min, définition Opta : coupée à la perte, à l'arrêt de jeu, au tir)** : tous
  presets confondus, moyenne 3,0-3,35, médiane 2-3, p90 6-7, **maximum 12-17** (une seule à 24), séquences de 10+ passes 1,5-6 par
  équipe et par match (livre R01 C18 : 17-24 en possession, ~5 en direct) ; aucune de 20+. Possession et direct ont presque la même
  distribution (max 15 c. 13, 10+ : 4 c. 2,5 par match). La queue manque : avec 87 % de passes gardées, une loi géométrique donnerait
  ~28 % de séquences de 10+ — on en compte ~2,5 %. Les séquences meurent d'autre chose que la passe (réception sous pression, duel,
  conduite, sortie). Télémétrie : `passesParSequenceMediane`, `passesParSequenceP90`, `passesParSequenceMax`.
- **Qui joue avec qui (01/10, possession c. direct et équilibre c. équilibre, 2 × 90 min chacun)** — la structure est INVERSÉE :
  - ballons reçus par joueur et par 10 min : ailiers 8-9, avant-centre 7,6-8,5, milieux 3,6-6,7 (le MIL C, sentinelle, le moins servi
    des milieux : 3,6-4,5), latéraux 4,4-6,1, centraux 2,4-3,5, gardien 2,2-3,1 (livre B01 T7 : MC 16,5 > DC 15,5 > LAT 14,8 > AIL
    11,9 > CF 10,1 > GB 9,8 — l'ordre est l'inverse) ;
  - paires dominantes : ailier ↔ avant-centre (17-28 par match chacune), milieu latéral → ailier ; aucune paire DC ↔ DC, DC ↔ sentinelle
    ou gardien ↔ DC dans le top 14 (une seule : GB → DC G, 8) ; passes entre défenseurs (gardien compris) 5-13 % (livre 38 %) ;
    passes de la ligne d'attaque à elle-même 21-24 % ;
  - séquences de 6+ passes : l'avant-centre et les ailiers y participent à 73-95 %, les centraux à 25-43 % ;
  - fin des séquences : la passe interceptée ou coupée 34 % (possession) à 44 % (direct), le ballon libre disputé 12-13 %, le tir 7-11 %,
    perdu en conduite ou duel 5-10 %, perdu à la réception 4-8 %, les sorties (touche, but, corner) 10-14 % ;
  - réseau (R13 F1-F6) : 90-99 dyades (livre 103), 1ʳᵉ dyade 4,9-6,9 % (4,3), 5 premières 21-25 % (17), 10 premières 33-39 % (28,9),
    Herfindahl 0,019-0,023 (0,0168) : trop concentré, sur le trio offensif.
  Lecture : le ballon file vers le trio offensif et y meurt (passes coupées entre ailiers et avant-centre, dans la zone la plus dense) ;
  la circulation de relance (centraux, sentinelle, gardien, latéraux), qui fait les longues séquences réelles et 38 % des passes,
  n'existe presque pas — d'où la queue de distribution coupée. Leviers à sonder : le sens de jeu (`passBias`), la garde de l'occupation
  (377 : centraux à 26 m derrière le ballon, hors de portée de la passe de recyclage), le rôle des centraux et de la sentinelle comme
  relais (playmaker_defender, regista), le style (la possession recycle par l'arrière).
- **Lot 379 (scellé) — la relance est une circulation** : `recyclage` (style-passe.termeRecyclage : la passe vers l'arrière à un
  coéquipier libre de rôle GARDE reçoit un bonus × style × pression sur le porteur × axe ressort du rôle receveur, la longueur au-delà de
  10 m en partie remise) et `sensJeuStyle` (match-sim.passBias : la prime de progression × le style, possession × 0,5 … direct × 1,3,
  inchangée au neutre). Suspects sondés d'abord (équilibre, 2 × 45 min) : sans la garde du 377, sans passBias, sans les deux — les
  passes entre défenseurs restent à 9-12 % ; la longueur idéale de 10 m bloquait le recyclage. Bloc 247 : passes reçues par centraux et
  sentinelle 96 → 166, séquences de 10+ passes 4 → 12 (2 × 45 min). Défaut `0eaf73e09f28381c / 984f21325acece53`.
- **Lot 384 (scellé) — le risque a un rôle et un style** : `selection.risqueRole` (selection.termeDe). Sondé (équilibre, 2 × 45 min) :
  centraux et sentinelle DISPONIBLES (≤ 25 m, libres ≥ 5 m, ligne ouverte) 34 % du temps et choisis alors 13-15 % ; l'avant-centre
  disponible 13 %, choisi 22,6 % (60 % de ses ballons partent quand il ne l'est pas). La sélection calibrée (267) voyait le risque
  (P̂ 0,72 c. 0,83) mais son calage (pente 0,26-0,47) l'écrasait en 0,4 point de barème face à une prime de progression de 3. Le ρ par
  rôle que l'en-tête du 267 nommait : ρ × 3 × le style (possession 1,3 … direct 0,7) × le rôle du passeur (garde 1,3 … pointe 0,6), en
  plus de la mentalité, des décisions et de la zone. Bloc 250 (possession c. direct) : séquences de 10+ passes possession 6 → 13, direct
  2 → 0 ; centraux et sentinelle servis + 12 % (contrat ramené de 15 à 10 %). Équilibre : passes entre défenseurs 12 → 18 %, séquences
  10+ 2,5 → 8 par équipe et par match, max 11-17 → 19-20, l'avant-centre choisi 22,6 → 17 %. Bloc 1 : clause DATÉE 384 (la graine 7 sur
  la dette du 334). Défaut `ca52f2952dc5000a / a8f474d564e54ed4`.
- **Reste après 379** : l'avant-centre reste le plus servi (7-10 ballons par 10 min, réel ~3) même sans prime de progression — le trio
  offensif est LIBRE (à sonder : le marquage des attaquants par la ligne défensive, l'espace entre les lignes) ; passes entre défenseurs
  9-13 % (livre 38) ; gardien peu servi (0,4-1,2).
- **Pourquoi le trio offensif est libre (01/10, équilibre, 2 × 45 min ; essai 380 non scellé)** : à la réception, les AILIERS
  (les plus servis, 180-222 réceptions c. 71-85 pour les centraux) sont à 9,1-9,8 m du plus proche adversaire, libres à 5 m dans
  67-73 % des cas, 52-58 % ENTRE LES LIGNES ; l'avant-centre est marqué (4,5-5,2 m, libre 34-48 %) mais servi quand même (85-117).
  Au départ de la passe vers l'ailier, le latéral adverse de ce côté est à 16-17 m de lui, en « mark » dans 80 % des cas — sur un
  autre homme ou posté : l'ailier n'est MARQUABLE que 33 % du temps (hors du rayon de marquage autour du ballon, ou zone loin), et
  l'affectation donne les hommes par danger (le plus près du but d'abord). Trois essais : (1) une loi de mouvement tirant le latéral
  vers l'ailier côté ballon — se battait contre l'affectation (16,3 → 17,3 m), retirée ; (2) le latéral éligible marqueur et l'ailier
  de son couloir à coût réduit dans l'affectation — sans effet (l'ailier n'est pas marquable) ; (3) le coulissement LATÉRAL à l'allure
  du rôle (les joueurs à > 5 m de leur cible en étaient à 14 m sur le côté, au trot 3,6 m/s) — effort 0,47 → 0,72 mais vitesse 3,6 →
  4,1 m/s, écart 14 → 12 m, ailiers libres 9,8 → 9,1 m : dans le bruit. Correctif gardé hors du dépôt. En moyenne la cible d'un
  défenseur bouge à 3,2 m/s et le corps à 3,3 ; 16 % du temps la cible saute à plus de 6 m/s (changement de côté, de métier).
  Lecture : le défaut n'est pas une loi isolée mais l'ARCHITECTURE du marquage — qui est marquable (rayon autour du ballon, zone loin),
  l'ordre de l'affectation (danger), et le bloc chaîné au ballon dont les slots sautent avec lui. À reprendre comme un chantier
  dédié (T1 bis : « une zone, un homme » — chaque défenseur responsable de l'attaquant qui entre dans sa zone, l'affectation par
  couloirs et par lignes avant le danger, la passation entre zones), plutôt que par retouches.
- **T1 bis — une zone, un homme. Lot 381 (scellé, étape 1)** : `zoneHomme` (zone-homme.js). Chaque défenseur en « mark » a une ZONE
  (son slot du bloc, qui COULISSE : premier ordre 0,8 s, ≤ 5 m/s × workRate — mesuré, les slots du bloc chaîné au ballon sautaient à
  8,7 m/s) ; l'attaquant revient au défenseur dont la zone est la plus proche (coût : distance à la zone, 40 % au corps, × markF × posF ;
  la paire d'hier × 0,4 : la passation), personne au-delà du rayon (12 → 22 m selon la consigne) ; cible côté but de l'homme à la
  distance élastique × rôle × note, part 0,75 → 1, laisse 8 → 18 m. Le défenseur affecté à plus de 4 m de sa cible y COURT à l'allure de
  son rôle (6 → 4 m/s × workRate) et pousse plein (locomoteur : hier la poussée mourait en approchant de l'allure voulue — 3,3 m/s à
  16 m de sa cible). Bloc 248 : l'ailier reçoit à 7,4 m du plus proche adversaire (hier 9,8), libre à 5 m 57 % (hier 73 %), entre les
  lignes 58 → 41 % ; centraux du bloc à l'entrée dans leur moitié 8,5 → 7,5 m, ballon dans la moitié adverse 13,8 → 11,2 ; sentinelle et
  centraux plus servis (5,5 et 4,2 ballons par 10 min). Bloc 1 : deux clauses DATÉES (la sortie de but au bout de sa bande, 33,3 s de
  silence → borne 34 ; la graine 7 sur la dette nommée du 334). Défaut `220aa0b5c3838f09 / 8d2648867cbe9b87`.
- **Lot 382 (scellé, étape 2)** : sondé sous le 381, quand le défenseur affecté est à plus de 8 m de sa cible (35 % du temps), 47 % des
  cas sont une zone restée à 14,5 m de son corps (revenu au marquage après la presse, la couverture, l'interception) et 41 % une paire
  neuve. Deux sous-clés de `zoneHomme` : `reprise` (la zone repart du corps au retour au marquage) et `versLigne` (le couloir est à la
  zone extérieure : du slot excentré vers la touche, la distance × 0,4). Bloc 249 : affectés à > 8 m 35 → 26 %, ailier servi libre à
  5 m 57 → 52 % ; quand l'ailier est pris, son défenseur à 7,7 m (10,7), le latéral le prend 27 % du temps (16). Effet de bord :
  l'avant-centre est serré (3,2 m, libre 18 %) mais reste le plus servi (11 ballons par 10 min) — le choix de passe le force.
  Défaut `c2fac22265fc1ab6 / e77839af959063ac`.
- **Essai 383, annulé — l'appel marqué** : 57 % des passes vers l'avant-centre partent alors qu'il est à < 4,5 m d'un défenseur ; la passe
  SERVIE vers un coureur en appel est exemptée du malus du marqué (240a). Essai `appelMarque` (le malus × part ÷ la protection du rôle et
  la force) : les appels marqués servis ne baissent pas (3 × 45 min : hier 76, part 0,7 → 79, part 2 → 84) — le malus, jugé sur la liberté
  projetée à l'ARRIVÉE, pèse peu face au bonus de l'appel ; point d'appui c. renard 18 c. 17. Annulé. Correction du diagnostic du 382 :
  le volume de l'avant-centre (8-11 ballons par 10 min) est proche du livre (B01 T7 : 10,1) ; l'écart est que centraux et milieux en
  reçoivent trop peu. Piste : la décision de lancer l'appel (le coureur qui sait qu'il est collé n'appelle pas, ou appelle dans le dos),
  plutôt que le choix du passeur.
- **Reste de T1 bis** : l'ailier sans responsable 42-47 % du temps (hors de toute zone) ; quand pris, le défenseur reste à 10-16 m (la zone
  suit des slots qui sautent) ; paires de 1,5 s p50. Étapes suivantes : (2) des zones qui ne dépendent plus d'un bloc chaîné au ballon
  mais d'une forme qui glisse (hauteur et largeur par ligne, selon la consigne) ; (3) la couverture de l'homme sans zone (le latéral côté
  ballon élargit sa zone, le milieu côté faible resserre) ; (4) la passation explicite entre lignes (le milieu suit, le central prend).
- **Reste** : 3,1-3,3 passes par séquence (livre possession 5-6) ; trop de séquences (~170 par équipe par 90 min c. 105 ± 25) ;
  61 % des passes partent d'un porteur pressé à < 3 m ; le direct garde 36 % de passes vers l'arrière (livre 24-28).
- **But** : le choix de passe lit le style (longueur, verticalité, jeu long vers l'avant-centre, renversements), le tempo (temps de
  tenue, une-touche) et la mentalité (risque) ; le soutien sans ballon SUIT l'action en jeu direct ; les presets règlent tempo et
  mentalité de façon cohérente.
- **Indicateurs** : direct speed 1,4 (possession) → 2,1 (direct) ; ballons longs 8-20 % selon l'école ; passes vers l'arrière 40-42 %
  (possession) / 24-28 % (direct) ; possession 39,6-65 % ; séquences 105 ± 25 à 3,5-5,1 passes, séquences de 10+ passes 7 ± 3 ;
  renversements 1 toutes les 8-14 possessions ; R_fwd au tiers propre 0,20-0,30 (possession) / 0,45-0,60 (direct).
- **Entrées** : style, tempo, mentalite, transition, relation ; attributs vision, passing, longShots (passe longue), decisions.

### T4 — Les transitions et le replacement *(en cours)*
- **Lot 376 (scellé)** : `contrePressChoix` (le contre-press est une DÉCISION : assez de siens près du ballon, 7 → 4, et le plus proche à
  portée de contact, 3 → 7 m, × pressing — hier l'horloge partait à chaque perte en bloc compact) et `repliConsigne` (après la perte, qui ne
  chasse pas et a sa cible derrière lui y court : pressing faible → sprint 6,6 m/s, fort → trot 3,6). Mesuré (2 × 90 min par preset) :
  contre-pressings bloc bas 14,5 → 3, équilibre 61,5 → 32,5, gegenpressing 100 (inchangé) ; recul du bloc bas en 3 s 1,8 → 2,6 m (bloc 244).
- **Reste** : la meute à +1,5 s 2,2-2,8 (livre 3-5 pour qui contre-presse) ; le gegenpressing à 100 contre-pressings ; le replacement
  encore lent (le « rejoint au trot » 338 et l'entretien gouvernent hors de la fenêtre).
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
| 01/10 | T4 | 376 | Contre-pressings bloc bas 14,5 → 3, équilibre 61,5 → 32,5 ; repli bloc bas 1,8 → 2,6 m en 3 s |
| 01/10 | T3 | 384 | Le risque a un rôle et un style : possession 13 séquences de 10+ passes (6), direct 0 ; entre défenseurs 12 → 18 % |
| 01/10 | T1 bis | 382 | La zone se reprend d'où l'on est, le couloir est à la zone extérieure : affectés loin de leur cible 35 → 26 %, ailier libre 57 → 52 % |
| 01/10 | T1 bis | 381 | Une zone, un homme (zones qui coulissent, affectation géographique, la prise court) : ailier servi à 7,4 m (9,8), libre 57 % (73) |
| 01/10 | T3 | 379 | La relance est une circulation (style × pression × rôle) ; sens de jeu selon le style : centraux + sentinelle servis 96 → 166, séquences 10+ 4 → 12 (2 × 45 min) |
| 01/10 | T3 | 378 | La possession cherche l'homme libre (style × vision × décisions × rôle) : marqués servis 18 → 9 % ; meneurs c. destroyers 3,25 c. 2,65 passes par séquence |
| 01/10 | T1/T2 | 377 | Occupation et retour selon les rôles ; marquage par consigne : DC en défense installée 6,5 → 5,3 m (livre 5,5), à l'entrée 12,4 → 9,6 ; latéraux pistons c. prudents − 3,9 c. − 10,3 m |
| 01/10 | T1 | 377 (essai) | Consigne et notes branchées sur le marquage : sans effet mesurable — l'attaque adverse n'occupe pas la zone des centraux (4 joueurs à < 15 m de la ligne, 6 derrière le ballon) ; retour à T2 |
| 01/10 | T3 | 371 | Longues direct 25,5 % c. possession 11,1 % ; direct speed 2,25 c. 1,50 ; passes 440-465 ; ballon en jeu 57-65 % ; sorties de but 16-21 |
