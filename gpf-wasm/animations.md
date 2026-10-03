# Les animations du corps et celles de notre moteur

Deux questions, mesurées le 2 octobre 2026 :
1. Toutes les animations du corps (Gameplay Football) sont-elles appelées ? Sinon, pourquoi ?
2. Chaque animation de notre moteur (la skill three.js AAA) a-t-elle son animation dans le corps ? Sinon, que faut-il faire côté C++ pour l'ajouter ?

## 1. Les animations du corps sont-elles toutes appelées ?

### La mesure

Le C++ compte chaque choix d'animation (`patch.py`, étape 10), à quatre étages :
1. **candidate** au premier tri (`CrudeSelection`) : la bonne famille de geste, la bonne vitesse, le bon angle ;
2. **gardée** après les filtres de direction (`_KeepBestDirectionAnims`, `_KeepBestBodyDirectionAnims`) ;
3. **jouée** par un joueur ;
4. **jouée** par un officiel.

C'est un compteur : le match n'en dépend pas, et la garde au bit près tient.

Le relevé couvre 16 matchs de 90 minutes, graines 3 à 29 : 8 avec notre cerveau des deux côtés, 8 avec leur IA (`bancs/animations.mjs`, bilan par `bancs/animations-bilan.mjs`).

Le corps a 293 fichiers d'animation. En mémoire, cela fait 1 452 animations :
- chaque geste et son miroir ;
- les 443 courses que le moteur génère au chargement à partir de ses 10 modèles, et leurs miroirs.

On compte par fichier (miroir compris), les 10 modèles de course comme un seul : 284 fichiers.

### Le résultat

| Dossier | Fichiers | Joués avec notre cerveau | Joués avec leur IA |
|---|---|---|---|
| ballcontrol (conduite, contrôles en mouvement) | 45 | 43 | 44 |
| celebration | 3 | **0** | **0** |
| deflect (parades du gardien) | 28 | 21 | 26 |
| highpass (passes levées, lancers du gardien) | 15 | 14 | 14 |
| interfere (interventions, contres) | 7 | 6 | 7 |
| movement (déplacements) | 50 | 48 | 48 |
| movement_special (gardien ballon en main, se relever) | 16 | 7 | 6 |
| pass (passes au sol, têtes, lancers) | 37 | 29 | 36 |
| shot (tirs) | 17 | 14 | 15 |
| sliding (tacles glissés) | 6 | 4 | 5 |
| special (le carton de l'arbitre) | 1 | 1 | 1 |
| trap (réceptions) | 40 | 38 | 39 |
| trip (chutes) | 19 | 15 | 16 |
| **Total** | **284** | **240 (85 %)** | **257 (90 %)** |

Les animations jouées se répartissent ainsi, avec notre cerveau : 67 % de courses générées, 31 % d'autres déplacements, 2 % de gestes de ballon (conduite, réceptions, passes, tirs, parades).

### Celles que personne ne joue (22), et pourquoi

| Animations | Pourquoi |
|---|---|
| **Les 3 célébrations** | La version Google du moteur a ramené l'après-but à 1 s pour accélérer l'apprentissage de ses IA : le coup d'envoi se prépare 0,5 s après le but (`referee.cpp`, « Number of ms for replay »). Or leur IA ne lance la célébration que 2 à 4 s après le but (`elizacontroller.cpp`, `_AddCelebration`). La fenêtre n'arrive jamais. Le jeu d'origine avait ce temps. |
| **Le gardien qui marche ballon en main** (9 déplacements, et le lancer en marchant) | Ses déplacements ballon en main à 135°, en freinant, en se retournant. Le gardien du corps relance vite et de l'arrêt : ces situations n'arrivent pas, ou sont écartées par les filtres de direction. |
| **Toujours devancées ou trop rares** (10) | La retournée, la tête au but de biais, une parade haute, deux courses, un tacle glissé de l'arrêt, une réception de dernier recours, deux chutes. Elles sont candidates, mais une autre animation passe toujours devant : le classement préfère les animations « de base », puis celle qui demande le moins de correction pour atteindre le ballon. |

### Celles que leur IA joue et pas notre cerveau (22), et pourquoi

| Animations | Pourquoi |
|---|---|
| **Les têtes** : 7 passes de la tête et 1 tête défensive en sprint (leur IA : 4 à 33 fois chacune en 8 matchs) | Notre cerveau ne demande jamais de jouer un ballon aérien en première intention. Sa une-touche refuse le ballon au-dessus de 0,5 m, et le receveur garde l'ordre de conserver le ballon : le corps contrôle (poitrine, cuisse) au lieu de remettre de la tête. Leur IA décide au contact. Les têtes au but existent (la reprise), mais restent rares. Le manque est **dans le cerveau, pas dans le C++** : la remise et le dégagement de la tête du cerveau (`tete.js`) sont à décider au contact, comme la reprise. |
| **La passe de volée** (`highpass/walk/045_air_left`) | La même cause. |
| **Six parades du gardien**, hautes et à hauteur de genou | Elles sont rares même chez leur IA : 1 à 10 fois en 8 matchs. Nos tirs sont trois fois moins nombreux (46 contre 155 sur 4 graines × 30 min) et plus bas : à la ligne de but, 0,33 m de hauteur médiane contre 1,07 m. Le corps vise toujours à 2,9° au-dessus du sol (`humanoid_utils.cpp`, `desiredHeight` à 0,05) ; la hauteur ne vient que de son erreur. Et notre adaptateur transforme un tir que le cerveau envoie au-dessus en tir à côté. Le correctif est la hauteur du tir (`carte-cpp.md`, point 1). |
| **Rares** (7) | Deux touches de conduite serrées, un tir de biais en dribble, un tacle glissé, une réception de dernier recours, deux chutes : 1 à 9 fois en 8 matchs chez leur IA. |

### Celles que seul notre cerveau joue (5)

Le contrôle à l'arrêt (`ballcontrol/idle/000`, 898 fois) : notre porteur s'arrête avec le ballon, quand il se tourne avant de passer ou qu'il tient le ballon. Les quatre autres sont rares : une parade du buste, un lancer, un déplacement ballon en main, une chute.

### À noter en passant : les bousculades

Le corps fait tomber ou trébucher les joueurs qui se heurtent (`match.cpp`, la sensibilité au contact). Avec notre cerveau : 694 trébuchements légers par match, contre 317 avec leur IA. Nos joueurs se heurtent deux fois plus.

## 2. Les animations de notre moteur ont-elles leur animation dans le corps ?

### L'inventaire

Notre moteur, la skill three.js AAA, sait faire jouer 155 gestes à ses joueurs, à ses gardiens et à ses officiels. Ils se répartissent en 14 familles. L'inventaire complet, avec pour chaque geste sa source, ce qu'il fait, ce qui le déclenche et sa ligne de code, est dans `inventaire-moteur.md`.

Il y a trois sources :
- la plupart sont **générés** par ses modules `motion-*.js` ;
- deux sont **écrits à la main** (`MOVES`) ;
- les officiels courent avec trois **clips de capture**.

Treize lignes ne sont pas des gestes, mais des couches de correction du rendu : le regard, les mains, les coudes, le pied tiré vers le ballon, la posture du porteur. Elles sont mises à part.

### La correspondance, famille par famille

Trois réponses possibles :
- **oui** : le corps a l'animation et la joue dans cette situation ;
- **approchant** : le corps fait l'action, avec sa propre variante, et on ne peut pas lui demander la nôtre ;
- **non** : le corps n'a rien d'équivalent.

| Famille | Gestes | Oui | Approchant | Non | Ce qui manque dans le corps |
|---|---|---|---|---|---|
| Locomotion | 14 | 10 | 2 | 2 | la boiterie ; la marche mains sur les hanches. Il ne court pas à reculons (il marche à reculons), et notre cap n'est pas transmis |
| Conduite | 5 | 1 | 4 | 0 | le choix de la surface (intérieur, extérieur, cou-de-pied) : le corps choisit ses touches seul |
| Dribble ou feinte | 16 | 0 | 4 | 12 | **tout le répertoire** : râteau, roulette, passements (1 à 6), crochet chaloupé, Cruyff, croqueta, petit pont, grand pont, feintes de passe, de frappe et d'appel. Le crochet et ses variantes ne sont qu'approchés par ses virages balle au pied |
| Passe | 24 | 17 | 3 | 4 | la passe « protégée » (bras écarté vers l'adversaire), la remise prolongée de l'extérieur ; l'extérieur du pied n'est pas demandable |
| Tir | 6 | 2 | 2 | 2 | l'enroulé et le pointu (et le piqué) : le corps ne règle ni l'effet ni la hauteur. Une seule volée |
| Contrôle | 13 | 10 | 2 | 1 | le contrôle « protection » (bras vers l'adversaire). Poitrine, cuisse et tête existent |
| Jeu aérien | 4 | 4 | 0 | 0 | rien ; la retournée existe mais n'est jamais choisie |
| Gardien | 12 | 7 | 1 | 4 | la sortie aux poings, la parade du pied, la relance roulée, le dégagement de volée (son gardien ne fait que lancer) ; pas de garde de gardien |
| Défense ou duel | 10 | 3 | 2 | 5 | la charge à l'épaule, la protection du ballon par le bras, le duel de corps, la garde du défenseur, le contre d'un tir |
| Chute ou relevé | 6 | 4 | 1 | 1 | la main tendue au coéquipier tombé |
| Coup de pied arrêté | 8 | 1 | 2 | 5 | la course d'élan, la touche longue avec course, le mur et son saut, le signal du tireur de corner. La touche, elle, se lance bien à deux mains : le preneur reçoit le ballon en main (`teamAIcontroller.cpp:1163`), et seuls ses gestes « ballon en main » restent possibles |
| Célébration ou émotion | 9 | 0 | 2 | 7 | le poing, l'oreille, le calme, la glissade, l'accolade, les applaudissements, la protestation. Ses 3 célébrations (joie, joie du buteur, abattement) ne sont jamais jouées (§ 1) |
| Arbitre ou officiel | 10 | 2 | 0 | 8 | le coup de sifflet, le bras qui désigne, l'avantage, les 4 drapeaux des assistants, les ramasseurs. Seul le carton existe |
| Vie hors du jeu | 5 | 1 | 0 | 4 | les mains sur les hanches, le sautillement, la poignée de main, le salut |
| **Total** | **142** | **62 (44 %)** | **25 (18 %)** | **55 (39 %)** | |

Les manques sont groupés :
- **le dribble et les feintes**, notre point fort au duel ;
- **les gestes autour des coups de pied arrêtés** : l'élan, le mur, le signal (la touche, elle, se lance à la main) ;
- **la vie autour du jeu** : célébrations, émotions, arbitre, poignées de main ;
- **les duels de corps** ;
- quelques **tirs** et **gestes de gardien**.

### Avant le C++ : le cerveau ne décide pas encore ces gestes

L'adaptateur L2 n'appelle qu'une partie du cerveau (voir `inventaire-moteur.md`, §7). Sur les 155 gestes, 114 sont décidés dans des parties qu'il n'appelle pas :
- le pas du porteur et de la réception (`rondoStep`) : tous les dribbles et toutes les feintes, les contrôles, le jeu aérien hors tête au but ;
- le pas du match (`matchStep`) : l'arbitre, les contres ;
- le jeu arrêté : les coups de pied arrêtés ;
- le rendu : le choix du contrôle et de la variante de passe, la protection, les célébrations, l'attente.

Même quand le corps a l'animation, rien ne lui demande aujourd'hui ce geste-là. Il choisit seul, ou ne le joue pas. Ajouter une animation au corps ne suffit donc pas : il faut aussi que l'adaptateur décide le geste et l'envoie.

## 3. Ajouter une animation au corps : ce qu'il faut faire

### Le format

Une animation du corps est un fichier texte `.anim` :
- **15 lignes d'images clés à 100 Hz** : la racine (`player` : position en mètres), puis 14 articulations en quaternions locaux (`body`, `middle`, `neck`, épaules, coudes, hanches, genoux, chevilles) ;
- **la touche** : `extension,football,<image du contact>,<x>,<y>,<z>`, la position du ballon au contact, dans le repère du joueur ;
- **des balises** :
  - `<type>` : la famille (movement, ballcontrol, trap, shortpass, highpass, shot, deflect, interfere, sliding, trip, special) ;
  - `<balldirection>` et `<outgoingballdirection_maxdeviation>` : où part le ballon, et la tolérance, en fraction de π ;
  - `<incomingballdirection>` pour les réceptions et les parades ;
  - `<specialvar1>` et `<specialvar2>` ;
  - le ballon en main (`incoming_retain_state`, `outgoing_retain_state`) ;
  - au sol (`incoming_special_state`) ;
  - `<lastditch>`, `<baseanim>`, `<touch_maxpowerfactor>`, `<triptype>`.

Au chargement, le moteur calcule seul les vitesses d'entrée et de sortie, les directions du corps et le pied (`_PrepareAnim`), et crée le miroir.

### Le chargement : rien à coder

Tout fichier `.anim` déposé sous `media/animations/` est chargé au démarrage (`animcollection.cpp`). Deux exceptions : les noms contenant « luxury », et le dossier des modèles de course. `data.sh` emballe tout le dossier dans `gpf.data`.

### Demander un geste précis : le mécanisme existe déjà

C'est celui des célébrations et du carton de l'arbitre :
- l'animation porte `<specialvar1>N</specialvar1>` ;
- le premier tri ne la garde que si la commande demande `specialVar1 = N` (`animcollection.cpp`, `CrudeSelection`). Le corps ne la joue donc jamais de lui-même.

Côté C++, environ 15 lignes dans `api/intents.cpp` :
- l'intention porte le numéro du geste ;
- `_GfOnBall` (porteur) ou `_GfPlacement` (sans ballon) pose `useSpecialVar1 = true` et `specialVar1 = N` sur la commande, avec la bonne famille.

Le numéro passe dans les bits hauts du champ `flags` de l'intention. On ne touche pas à la structure : c'est le piège des en-têtes (`carte-cpp.md`).

**Fait le 3 octobre, pour le face-à-face** (`docs/adaptateur.md` § 7.10). C'est l'intention GESTE (6) : le numéro passe dans le champ `target`, la famille (contrôle ou déplacement) dans `flags`. Deux surprises, corrigées en C++ :
- à l'arrêt, `NeedTouch` refusait la touche (étape 11) ;
- le cerveau doit savoir quand le geste part vraiment : c'est le journal, `GF_EV_GESTE` (étape 12).

Ces gestes ont une racine immobile : ils ne partent que d'un porteur sous 1,8 m/s. Une animation ne se coupe jamais : la suite se pose dès que le geste est lancé (`docs/corps.md` § 5.6).

Cela suffit pour les gestes à **une seule touche de balle ou sans touche** :
- les crochets ;
- le râteau ;
- le petit pont ;
- les feintes ;
- le passement simple ;
- la passe protégée ;
- les variantes de contrôle ;
- la relance roulée ;
- les poings du gardien ;
- les attentes ;
- les célébrations.

### Ce que le corps ne sait pas faire du tout : du C++ en plus

| Besoin | Gestes concernés | Où | Taille |
|---|---|---|---|
| **Plusieurs touches de balle dans un même geste.** ~~Une animation n'a qu'une touche.~~ **Fait le 3 octobre** (`patch.py`, étape 14 ; `docs/corps.md` § 5.7) : ses touches étaient des instants candidats, le corps en retenait un ; un geste `<gfserie>` les joue l'une après l'autre, chacune envoyant le ballon là où la suivante l'attend (1 à 5 cm d'écart mesuré), et sa racine est suivie telle quelle | roulette (4 touches, le tour, le pivot sur chaque appui), croqueta (2), râteau (2) ; restent le grand pont, le passement suivi de sa sortie | `humanoid.cpp`, `humanoidbase.cpp`, `api/intents.cpp` | fait |
| **La trajectoire propre au geste.** Le corps calcule la frappe sans regarder le geste : hauteur fixe à 2,9°, son propre effet, un plancher de vitesse qui interdit le lob. Il faut lire dans l'animation sa hauteur, son effet et sa puissance | enroulé, pointu, piqué, extérieur du pied | `humanoid_utils.cpp`, `humanoid.cpp` (le point 1 de la carte, élargi) | petit à moyen |
| **Les gestes autour des coups de pied arrêtés.** La touche se lance déjà à la main : le corps donne le ballon en main au preneur (`SelectRetainAnim`, `teamAIcontroller.cpp:1163`). Manquent l'élan du tireur, la touche longue avec course, le mur et son saut, le signal du corner | les 5 gestes manquants | `elizacontroller.cpp` (la branche du tireur), `PrepareSetPiece` (le point 4 de la carte) | moyen |
| **Le pied après les mains.** Le gardien lâche le ballon et le frappe de volée : aujourd'hui, ballon en main, il ne fait que lancer | dégagement de volée | la touche (`humanoid.cpp`), la relance du gardien | moyen |
| **Les gestes que le jeu demande au bon moment.** Rien de neuf dans la sélection, seulement l'appel au bon moment, sur le modèle du carton (`refereecontroller.cpp`) | coup de sifflet, bras qui désigne, avantage, drapeaux des assistants, protestation, poignée de main, salut | `refereecontroller.cpp`, le contrôleur des joueurs | petit par geste |
| **Les célébrations.** Il faut rallonger l'après-but simulé, aujourd'hui 1 s, pour que la célébration ait lieu. Notre horloge compte déjà la vraie minute | les 3 célébrations du corps, puis les nôtres | `referee.cpp` (l'après-but), `_AddCelebration` (le choix selon le joueur) | petit |
| **Les contacts entre joueurs.** Le corps ne résout que des bousculades, qui finissent en trébuchement ou en chute. Il faut le contact voulu lui-même | charge à l'épaule, protection du ballon par le bras, duel de corps, maillot tiré | `match.cpp` (les collisions), une intention de duel | gros |
| **La boiterie.** Une variante de course choisie quand le joueur est touché | boiterie | le contrôleur, un état « blessé » | petit |

### Fabriquer l'animation à partir de nos gestes

**L'outil existe depuis le 3 octobre** : `outils/vers-gpf.mjs`, prouvé exact à l'aller-retour (0,0000°, 0,00 mm). Il a produit les 16 gestes du face-à-face (`gestes/*.anim`, n° 101 à 116, cheville à 24-25 cm du ballon au contact). En match, 89 % des gestes demandés partent (4 graines × 20 min) ; le râteau et la roulette ratent le plus, et la cause est à mesurer.

Nos gestes vivent sur notre squelette de 22 os. Le portage du lot L0 (`gpf-anim.js`) traduit une animation du corps vers nos humains. L'outil inverse :
- échantillonne notre geste à 100 Hz ;
- ramène chaque rotation dans le repère des 14 articulations du corps ;
- donne la trajectoire de la racine en mètres ;
- place l'instant et la position de la touche.

Un banc valide chaque animation produite : il la fait jouer au corps et mesure le pied au ballon, le critère du §6 étant 20 cm au plus. Le relevé de la partie 1 montre ensuite si elle est jouée, et à quel étage elle tombe sinon.

### Les rejouer

```
node bancs/animations.mjs 90 7 cerveau releve.json     # un match (leur IA : mode ia ; ARRETS=0 sans l'horloge du match)
node bancs/animations-bilan.mjs <dossier des relevés> bilan.md
```
