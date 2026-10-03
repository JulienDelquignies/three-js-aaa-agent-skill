# Le corps — le moteur de match de Gameplay Football, en WebAssembly, piloté par notre cerveau

Référence pour qui doit modifier le corps. Rédigée le 3 octobre 2026 par lecture du code seule : rien n'a été compilé ni exécuté.

- **Chemins.** Un nom court (`match.cpp`) est sous `~/DelkIT/skill-l2/gpf-wasm/upstream/src/`, l'arbre corrigé par `patch.py` (carte au § 0). `api/…`, `patch.py`, `build.sh`, `contrat.mjs`, `corps.mjs`, `bancs/…` sont sous `~/DelkIT/skill-l2/gpf-wasm/`.
- **Lignes.** Celles de l'arbre corrigé au 3 octobre ; tout nouveau correctif les décale.
- **Statut.** « mesuré » renvoie au document qui l'a mesuré. « calculé » : fait à la main depuis les constantes du code. « non vérifié » : lu, à confirmer par une sonde.
- **À lire à côté, sans doublon ici :** `README.md` (l'historique des mesures), `carte-cpp.md` (quatre correctifs C++ prévus, le piège des en-têtes), `animations.md` (quelles animations sont jouées, et pourquoi), `animations-releve.md` (le relevé fichier par fichier), `inventaire-moteur.md` (les gestes de notre moteur three.js).

**Sommaire.** 0. Lexique et carte des fichiers · 1. En bref · 2. Le pas de simulation · 3. Les joueurs · 4. Le contrôleur (`ElizaController`) · 5. Les animations · 6. Les touches et le ballon · 7. L'arbitre et le jeu arrêté · 8. Les gardiens · 9. Les attributs · 10. Notre couche · 11. Ce que le corps ne sait pas faire

## 0. Lexique et carte des fichiers

| Mot | Sens ici |
|---|---|
| corps | le moteur de match de Google Research Football 2.10.2 (C++, issu de Gameplay Football), compilé en WebAssembly sans rendu |
| cerveau | notre moteur de décision JavaScript (`cerveau.mjs`), qui pilote le corps par intentions |
| pas | un appel de simulation : 10 ms de jeu |
| intention | l'ordre que le cerveau pose pour un joueur (aller, presser, passer, tirer, conduire) ; elle est **tenue** : elle vaut jusqu'à la suivante |
| porteur | le joueur qui a, ou va avoir, le ballon |
| désigné | le joueur que le corps envoie au ballon : un pour le match, un par équipe (§ 2.4) |
| image mentale | un instantané des joueurs et du ballon, pris toutes les 100 ms ; chacun décide sur une image un peu ancienne |
| commande | ce que le contrôleur demande au corps : un geste, une course, un regard, une touche (`PlayerCommand`) |
| animation, geste | un fichier `.anim` de capture de mouvement, joué tel quel ou corrigé |
| re-file | un instant où le corps peut couper l'animation en cours pour une nouvelle commande |
| triche | le glissement du corps vers le ballon qui rend une touche exacte |
| ballon en main | le gardien qui tient le ballon, ou le tireur de touche (« retainer » dans le code) |
| CPA | coup de pied arrêté : engagement, six-mètres, coup franc, corner, touche, penalty |
| id stable | le numéro d'un joueur dans le corps ; c'est lui que l'API attend |
| garde au bit près | sans intention posée, le match doit rester identique, bit pour bit, à celui de Google |

**Carte.** À la racine : `game_env.cpp`, `gametask.cpp`, `gamedefines.hpp`, `defines.hpp`, `utils.hpp`, `utils.cpp`, `main.hpp`. Sous `onthepitch/` : `match.cpp`, `team.cpp`, `teamAIcontroller.cpp`, `referee.cpp`, `ball.cpp`, `officials.cpp` ; sous `onthepitch/player/` : `player.cpp`, `playerbase.cpp`, `playerofficial.cpp`, puis `humanoid/` (`humanoid.cpp`, `humanoidbase.cpp`, `humanoid_utils.cpp`, `animcollection.cpp`) et `controller/` (`elizacontroller.cpp`, `playercontroller.cpp`, `icontroller.cpp`, `refereecontroller.cpp` ; `strategies/offtheball/goalie_default.cpp`, `default_def/mid/off.cpp`). Sous `onthepitch/AIsupport/` : `AIfunctions.cpp`, `mentalimage.cpp`. Sous `utils/` : `animation.cpp`, `animationextensions/footballanimationextension.cpp`. Sous `data/` : `playerdata.cpp`, `teamdata.cpp`. Sous `base/math/` : `bluntmath.cpp`.

## 1. En bref

- Le corps est le moteur de match de Google Research Football 2.10.2 (licence Unlicense), compilé en WebAssembly sans son rendu.
- Il simule 22 joueurs et 3 arbitres par pas de 10 ms : animations capturées, course, ballon, touches, collisions, arbitrage, coups de pied arrêtés.
- Il nous rend l'état (`gf_frame`), la pose de 13 articulations par joueur pour nos humains three.js (`gf_pose`) et un journal d'événements (`gf_events`).
- Notre cerveau pose une intention par joueur ; le contrôleur du corps la lit à trois endroits : le placement, la décision du porteur, le pressing.
- Sans intention posée, le match est celui de Google, au bit près.
- Nous avons ajouté (`patch.py`, 14 étapes) ce que le navigateur n'a pas, le chrono réglable, les intentions, le journal, les attributs réglables, l'horloge du match, les fautes du cerveau, le relevé des animations, nos gestes sur demande (la touche à l'arrêt, leur départ au journal), la garde du face-à-face et les gestes à plusieurs touches.
- Mesuré (`README.md`, « Mesures ») : 0,63-0,66 ms par pas dans Node (p95 1,2 ms) ; 354 s pour 90 vraies minutes ; le même match au bit près dans Node et dans Chromium.
- Restent au corps : les gardiens, les coups de pied arrêtés, les gestes de contact (contrôle, amorti, tacle) et l'arbitrage de ses propres contacts.

## 2. Le pas de simulation

### 2.1 L'ordre d'un pas

`gf_step(n)` appelle n fois `GameEnv::step` (`game_env.cpp:304-349`). Nous démarrons avec `gf_init(1, …)` : un appel = un pas = 10 ms (`api/gf_api.cpp:63`) ; Google en enchaîne 10 par appel. Chaque pas, `GameTask::ProcessPhase` (`gametask.cpp:55-63`) lance `Match::Process` (`match.cpp:848-1023`), puis, si le monde a bougé, calcule la pose (couches procédurales, animation appliquée au squelette).

| # | Étape | Lignes de `match.cpp` | Ce qui se passe |
|---|---|---|---|
| 1 | ballon contre les corps | 856, 1599-1727 | en jeu seulement, au plus une fois par 150 ms |
| 2 | arbitre | 860 → `referee.cpp:94-276` | sorties, fautes, hors-jeu, mi-temps, chronologie des arrêts |
| 3 | gel | 864-868 | ballon mort et placement passé : +10 ms à l'horloge, rien d'autre |
| 4 | ballon | 870 → `ball.cpp:572-583` | la physique ; sa position devient la prédiction à +10 ms |
| 5 | image mentale | 874-881 | une nouvelle toutes les 100 ms ; trois gardées |
| 6 | équipes | 887-891 | l'une après l'autre : l'IA d'équipe, puis chaque joueur, contrôleur puis corps (`player.cpp:296-339`) |
| 7 | arbitres | 894 | trois corps simplifiés (`officials.cpp`) |
| 8 | possession | 898-903 | temps jusqu'au ballon de chaque joueur, meilleure équipe |
| 9 | désigné | 905-923 | qui va au ballon |
| 10 | collisions entre joueurs | 926 → 1181-1597 | poussées, chutes, tacles |
| 11 | horloge | 928 → 1844-1856 | +10 ms |
| 12 | but | 931-983 | ballon passé sous la barre, entre les poteaux ; buteur, contre-son-camp |

Un joueur touche le ballon pendant l'étape 6 ; `Ball::Touch` recalcule aussitôt sa trajectoire (`ball.cpp:90-103`), et les joueurs traités ensuite voient le nouveau ballon.

### 2.2 Le miroir

- Chaque équipe est traitée dans un monde où elle défend le but x = −55 et attaque vers +x. L'équipe 0 voit le monde tel quel ; l'équipe 1 le voit retourné, x et y niés (`match.cpp:887-891`).
- Au repos, l'équipe 1 est rangée retournée ; `gf_frame` et `gf_pose` la remettent à l'endroit (`api/gf_api.cpp:114, 144-148`).
- L'arbitre voit le monde tel quel pour une graine paire, tout retourné pour une graine impaire (`match.cpp:853`). Non vérifié par une sonde (`carte-cpp.md` § 0). Une graine impaire inverse aussi l'ordre de traitement des équipes (`api/gf_api.cpp:80`).
- Les intentions sont données dans le monde ; `api/intents.cpp:89-91` les retourne pour l'équipe 1.

### 2.3 L'image mentale : le délai de perception

- Toutes les 100 ms, le corps photographie les joueurs (position, direction, mouvement, classe de vitesse, rôle) et 3 s de trajectoire du ballon (`mentalimage.cpp:23-48`). Il en garde trois : maintenant, −100 ms, −200 ms.
- Un joueur décide sur l'image vieille de son temps de réaction : `80 − 40 × réaction` ms (`icontroller.cpp:30-33`), plus `100 × (1 − difficulté)` (`playercontroller.cpp:61-66`).
- Ce temps est arrondi à la centaine (`match.cpp:450-456`). En pratique (calculé) : réaction > 0,75, l'image la plus récente ; sinon celle d'avant, 100 ms plus vieille. La fatigue baisse la réaction : un joueur fatigué peut changer d'image.
- Qui vient de toucher le ballon (touche voulue) voit le présent (`playercontroller.cpp:39`). Le corps aussi, pour choisir son geste, quand son équipe a touché en dernier (`humanoid.cpp:96-98`).
- L'image est prolongée par le mouvement, puis rapprochée du réel : 2,5 m et 5 m/s d'écart au plus (`mentalimage.cpp:96-108`). Le ballon imaginé reste à 2,5 m au plus du réel (`mentalimage.cpp:133-151`).

### 2.4 Le joueur désigné

- **Temps jusqu'au ballon** : calculé à chaque pas pour chaque joueur, sur 3 s de trajectoire (ballon sous 1,5 m), à sa vitesse de pointe (`player.cpp:169-289`). La **meilleure équipe** est celle du plus court temps (`match.cpp:1161-1179`).
- **Désigné de l'équipe** : son joueur le plus rapide au ballon. Il ne change que pour un joueur nettement plus rapide (≈ 20 % ; avoir le ballon compte double) (`team.cpp:476-511`).
- **Désigné du match** : un seul sur 22. Le joueur ballon en main s'il y en a un ; sinon le désigné de la meilleure équipe, s'il arrive en moins de 85 % du temps du désigné actuel (`match.cpp:905-923`).
- Le désigné du match reçoit la branche du porteur (§ 4.2), les re-files les plus fréquentes (§ 4.1) et un bonus dans les contacts (`match.cpp:1290-1291`). `gf_frame` : colonnes 16 (match) et 17 (équipe).

### 2.5 Les tirages au sort

- Un seul générateur pseudo-aléatoire (Mersenne Twister) sert tous les tirages : `boostrandom` (`bluntmath.cpp:72-82`, `main.hpp:266-275`). Il est semé avec la graine au lancement du match (`gametask.cpp:37`), puis **ressemé avec la même graine à chaque arrêt de jeu**, au placement (`referee.cpp:240`). Pas d'horloge système, libm compilée dans le module : même match dans Node et Chromium (mesuré, `README.md`).
- Règle pour tout correctif : sur le chemin par défaut, n'ajouter ni retirer aucun tirage (`carte-cpp.md` § 0). `ResetPosition` tire au sort (`humanoidbase.cpp:853-854`).

## 3. Les joueurs

### 3.1 Les classes

| Classe | Fichier | Porte |
|---|---|---|
| `PlayerBase` | `playerbase.cpp` | id stable, fatigue, dernière touche, vitesse de pointe ; commun aux joueurs et aux arbitres |
| `Player` | `player.cpp` | possession, temps jusqu'au ballon, cartons |
| `PlayerOfficial` | `playerofficial.cpp` | l'arbitre et les deux juges de touche |
| `HumanoidBase` | `humanoidbase.cpp` | le corps animé : état spatial, course, choix simple d'animation (arbitres) |
| `Humanoid` | `humanoid.cpp` | le corps d'un joueur : re-files, touches, triche |
| `ElizaController` | `elizacontroller.cpp` | leur IA de joueur, où se branchent nos crochets |
| `TeamAIController` | `teamAIcontroller.cpp` | l'IA d'équipe : tactique, rôles dynamiques, marquage, placement aux CPA |

### 3.2 Identité et rôle

- L'id stable est le rang de création (`playerbase.cpp:33`), remis à zéro à chaque match (`match.cpp:61`). L'équipe traitée en premier reçoit 0 à 10 : l'équipe 1 pour une graine impaire (`match.cpp:52, 128`). Les arbitres ont 22 à 24. Lire toujours la colonne 10 de `gf_frame`.
- 11 joueurs par équipe, sans banc (`teamdata.cpp:288`). Le rôle vient du scénario `11_vs_11_stochastic` (`api/gf_api.cpp:38-50`).
- La position tactique de base et le profil d'attributs viennent, eux, d'une formation 4-3-3 codée en dur, par rang (`teamdata.cpp:78-89, 184-185, 277-287`, `AIfunctions.cpp:47-52`).
- Les deux ne concordent pas : le rang 2 est avant-centre dans le scénario, défenseur central dans la formation, avec un profil de défenseur (§ 9). Effet en jeu non vérifié ; notre cerveau place lui-même ses joueurs.

### 3.3 L'état spatial (`humanoidbase.cpp:1321-1431`)

- **Position** (m) au sol, z = 0 ; la hauteur d'un saut n'existe que dans la pose. **Mouvement** (m/s) : la trajectoire de l'animation, corrigée par la physique de course, sans la triche.
- **Direction** : celle du mouvement ; à l'arrêt, celle du corps.
- **Direction du corps**, relative au mouvement, ramenée à 0°, ±45° ou ±135° (`humanoidbase.cpp:39-53, 1393-1428`). Au sprint, elle reste droit devant ; en course, à 45° au plus ; dos tourné (±135°) seulement au trot (calculé).

| Classe de vitesse | Vitesse | Valeur type | Nom du code |
|---|---|---|---|
| arrêt | < 1,8 m/s | 0 | idle |
| trot | 1,8 à 4,2 m/s | 3,5 | dribble (avec ou sans ballon) |
| course | 4,2 à 6 m/s | 5 | walk |
| sprint | ≥ 6 m/s | 8 (animations à 7) | sprint |

- Seuils : `gamedefines.hpp:29-38`, `animcollection.hpp:43-80`. Vitesse de pointe : `8 × (0,9 + 0,1 × vitesse)`, soit 7,2 à 8 m/s (`playerbase.cpp:128-136`).
- **La course** (`humanoidbase.cpp:1672-2235`). L'animation donne la trajectoire ; une physique simple la tire vers la course voulue, sous trois plafonds (calculé) :
  - l'accélération : 11 m/s² à l'arrêt, nulle à la vitesse de pointe, × (0,7 + 0,3 × accélération) (2107-2152) ;
  - le virage : ≈ 270°/s au sprint sans ballon, 180°/s ballon au pied, × (0,7 + 0,3 × agilité) ; au-delà, le joueur freine (2031-2065) ;
  - la variation de vitesse par pas (2067-2103).
- Pendant une passe, un tir, une parade ou un geste spécial, la physique est coupée : le corps suit l'animation (1790-1810).

### 3.4 La possession

- **Posséder** : ballon à moins d'1 m d'un point juste devant le joueur, sous 0,5 m de haut, à moins de 6 m/s d'écart de vitesse (`AIfunctions.cpp:843-864`). Après la touche d'une passe ou d'un tir, plus de possession jusqu'à la fin du geste (`player.cpp:261-270`).
- **Ballon en main** : le ballon est collé à la main (`humanoid.cpp:624-650`), la possession forcée (`player.cpp:275-288`).
- **Possession d'équipe** : `(temps adverse + 1,5 s) / (temps de l'équipe + 1,5 s)`, plus une version lissée qui bouge de 0,005 par pas au plus (`team.cpp:364-386`). Leur IA s'en sert partout.
- `gf_frame`, en-tête 9-10 : l'équipe qui a le ballon, et le **rang** du joueur dans son équipe, pas son id stable (`match.cpp:799-804`).

### 3.5 La fatigue, les cartons

- La fraîcheur vaut 1 au départ, 0,01 au plus bas (`playerbase.cpp:37`, `player.cpp:330`). À chaque pas en jeu, elle perd `distance × 0,00003 × (2 − endurance) / facteur` (`player.cpp:329`).
- Le facteur vaut `match_duration × 0,2 + 0,05` (`match.cpp:56-57`) : 0,0554 au réglage de Google (0,027), d'où une fatigue 18 fois trop rapide ; 1 avec notre `CHRONO_REEL` de 4,75.
- Effet : un attribut lu vaut `base × (0,3 + 0,7 × difficulté) × (0,7 + 0,3 × fraîcheur)` (`player.cpp:452-457`) ; endurance et vitesse de pointe sont lues brutes. Fatiguée, leur IA chasse moins loin et flâne plus (`elizacontroller.cpp:429, 559-560`).
- Mesuré (`README.md`) : à 0,027, épuisé vers la 12ᵉ minute, attributs à 70 % ; à 4,75, environ 60 % de fraîcheur après 10,5 km.
- **La mi-temps rend toute la fraîcheur** : `SetMatchPhase` appelle `RelaxFatigue(1)` (`match.cpp:489-493`, `referee.cpp:119`). `gf_frame` n'exporte pas la fraîcheur.
- **Cartons** : jaune +1, rouge +3. Au-delà de 1, l'expulsion tombe 6 s après le carton, sauf pour le dernier joueur d'une équipe (`player.hpp:107-111`, `player.cpp:333-337`). L'expulsé reste dans `gf_frame`, « actif » à 0 ; un gardien expulsé passe son rôle à un joueur de champ (`player.cpp:436-443`).

## 4. Le contrôleur (`ElizaController`)

### 4.1 Quand il décide

Le corps ne demande une file de commandes qu'à une interruption (`humanoid.cpp:216-264`) : la fin de l'animation en cours (116-120), une chute (la file est alors faite de chutes, sans le contrôleur), ou un créneau de re-file (144-214).

| Joueur | Créneau de re-file |
|---|---|
| désigné du match, à moins de 3 m du ballon ; plus loin | toutes les 20 ms ; 30 ms |
| désigné de son équipe | 40 ms |
| à moins de 5 m du ballon ; de 10 m | 50 ms ; 80 ms |
| les autres | jamais : fin d'animation seulement |

- La re-file ne part que d'une course (ballon à moins de 16 m, ou au pied) ou d'un contrôle/amorti avant sa touche ; jamais d'un état au sol (`humanoid.cpp:182-207`). `SelectAnim` refuse ensuite beaucoup de re-files : trop semblable, trop tard dans le geste, même sortie (`humanoid.cpp:1160-1220, 1575-1602`). Entre deux interruptions, le contrôleur ne fait que fixer l'âge de son image mentale (`playercontroller.cpp:36-41`) : un ordre posé entre-temps attend la prochaine.

### 4.2 `RequestCommand` : les branches et la file (`elizacontroller.cpp:40-534`)

| # | Condition | Branche | Effet | Lignes |
|---|---|---|---|---|
| 1 | ballon mort après un but | célébration | course de célébration ; le geste seulement 2 à 4 s après l'arrêt | 70-74, 1167-1244 |
| 2 | ballon mort, faute à carton, entre l'arrêt + 1 s et le placement | regard | à l'arrêt, tourné vers l'arbitre | 78-100 |
| 3 | ballon mort | planté | ralentir (tirage au sort), regarder le ballon | 103-135 |
| 4 | tireur d'un CPA, ou ballon en main | tireur | son action (§ 7.6), puis aller au ballon ou s'orienter | 139-304 |
| 5 | en jeu, ni désigné du match ni gardien | placement | stratégie du rôle, puis **A** | 309-337 |
| 6 | en jeu, désigné du match, pas gardien | porteur | à moins d'1 s du ballon : **B**, sinon leur décision | 340-352 |
| 7 | en jeu, gardien | gardien | placement, parade, jeu au pied (§ 8) | 354-379 |
| puis | en jeu, hors CPA | réflexes | contrôle, amorti, intervention, tacle glissé | 401-416 |
| puis | en jeu, hors CPA | mouvement | chasse (**C**), aimant, course | 419-521 |
| sinon | CPA, gardien en interception | course imposée | immobile, ou la cible du gardien | 522-533 |

- La file est refaite à chaque appel. Pour un porteur : [passe ou tir, parfois la triple passe de panique] [contrôle] [amorti] [intervention] [tacle glissé] [course].
- Le corps prend la première commande pour laquelle une animation convient (`humanoid.cpp:233-247`). Une passe sans animation possible laisse la place au contrôle ; elle est redemandée à l'interruption suivante, tant que l'intention tient (`carte-cpp.md` § 3).
- Une passe ou un tir dans la file rend les contrôles et amortis qui suivent plus durs à jouer (rayon × 0,3, `humanoid.cpp:2017-2022`).

### 4.3 Les champs d'une commande (`PlayerCommand`, `gamedefines.hpp:163-238`)

| Champ | Sens |
|---|---|
| `desiredFunctionType` | le geste (`e_FunctionType`, `gamedefines.hpp:95-111`) : 1 course, 2 contrôle, 3 amorti, 4 passe courte, 5 longue, 6 haute, 7 tête, 8 tir, 9 parade, 10 prise, 11 intervention, 12 chute, 13 tacle glissé, 14 spécial |
| `useDesiredMovement`, `desiredDirection`, `desiredVelocityFloat` | la course voulue : direction, m/s |
| `strictMovement` | la rigueur du filtre de direction (intervention) |
| `useDesiredLookAt`, `desiredLookAt` | le point regardé |
| `touchInfo` | la touche : entrée « manette » (`inputDirection`, `inputPower`), part d'aide automatique (`autoDirectionBias`, `autoPowerBias`), résultat (`desiredDirection`, `desiredPower`), destinataire calculé (`targetPlayer`) ou imposé (`forcedTargetPlayer`) |
| `onlyDeflectAnimsThatPickupBall` | gardien : seulement les parades qui captent |
| `useTripType`, `tripType`, `desiredTripDirection` | la chute |
| `useSpecialVar1/2`, `specialVar1/2` | demander une animation précise (§ 5.5) |
| `modifier` | bit 1 `KnockOn` : pousser le ballon plus loin ; les autres bits sont libres (`carte-cpp.md` § 0) |

### 4.4 Leur IA, sans intention

- **Placement** (`default_def/mid/off.cpp`) : la position de formation adaptée par l'équipe (`teamAIcontroller.cpp:321-476`), un champ de forces de soutien quand l'équipe a le ballon (`elizacontroller.cpp:591-806`), une composante défensive côté but (`playercontroller.cpp:84-160`), le piège du hors-jeu, la flânerie (`elizacontroller.cpp:551-589`).
- **Porteur** (`GetOnTheBallCommands`, `elizacontroller.cpp:822-1045`) : il note chaque partenaire (gain tactique, chances de passe), panique s'il est défenseur près de son but, tire si `chances + U(0 ; 0,5) > 0,5` près du but adverse, conduit par champ de forces.
- **Chasse** (`elizacontroller.cpp:446-512`) : quand l'équipe n'a pas le ballon, l'un des deux joueurs les plus proches du porteur adverse, à moins de 10 à 20 m, va à sa garde côté but, aimanté.
- **Aimant** (`_MovementCommand`, `playercontroller.cpp:531-738`) : mélange la course voulue et une course automatique au ballon. Le désigné du match y va pleinement ; qui a touché le ballon depuis moins de 2 s, en partie.

### 4.5 Nos crochets (`api/intents.cpp`)

| Crochet | Appelé à | Lit | Fait |
|---|---|---|---|
| `_GfPlacement` (A) | `elizacontroller.cpp:335`, après la stratégie du rôle | ALLER, PRESSER | remplace sa course : vers (x, y), à `min(vitesse, 2,6 × distance)`, bornée à 0-8 m/s ; à moins de 0,5 m, arrêt face au ballon (95-112) |
| `_GfOnBall` (B) | `elizacontroller.cpp:348`, à la place de leur décision | PASSER, TIRER, CONDUIRE, ALLER, PRESSER | rend « décidé », sinon leur IA décide (117-166) |
| `_GfPressMode` (C) | `elizacontroller.cpp:444, 446` | PRESSER, ALLER | 2 chasse forcée ; 1 jamais de chasse ; 0 la chasse du corps (171-178) |
| `_GfPress` (C) | `elizacontroller.cpp:445` | — | vers le désigné adverse anticipé de 0,3 s, au sprint, aimant et hâte (183-192) |
| `_GfGarde` (D) | `elizacontroller.cpp:401`, devant les réflexes | ALLER drapeau 1 | vrai : ni contrôle, ni amorti, ni intervention, ni tacle glissé ne sont mis en file — la garde du face-à-face (`patch.py`, étape 13) |
| `_GfToucheEnSerie` (F) | `humanoid.cpp:624`, après la touche du corps, à chaque image | un geste `<gfserie>` en cours | joue ses touches suivantes à leur image, puis arrête le ballon (`<gfarret>`) — § 5.7 (`patch.py`, étape 14) |
| `gf_serie` (F) | `GetBestCheatableAnimID` (`humanoid.cpp:1862`), `CalculatePhysicsVector` (`humanoidbase.cpp:1676`) | l'animation | un geste en série : sa première touche seule est candidate ; sa racine est suivie telle quelle, sans la physique des déplacements |

### 4.6 Ce que change chaque intention

| Intention (`kind`) | Champs | Joueur sans ballon | Porteur (B) |
|---|---|---|---|
| IA (0) | — | leur IA | leur IA |
| ALLER (1) | x, y, vitesse | va au point (A), ne chasse jamais (C = 1) | garde le ballon et le conduit vers (x, y), à 3,5 m/s au plus |
| PRESSER (2), drapeau 0 | x, y | fond sur le désigné adverse, aimanté (C = 2) ; (x, y) n'est pas suivi | comme ALLER |
| PRESSER (2), drapeau 1 | x, y | va au point, puis la chasse du corps s'il est parmi les deux plus proches (C = 0) | comme ALLER |
| PASSER (3) | cible (id stable), drapeau 0 courte, 1 longue, 2 haute | leur IA (A et C ne lisent pas PASSER) | `_AddPass`, destinataire imposé ; cible hors de son équipe ou soi-même : leur IA |
| TIRER (4) | x, y (point visé), puissance | leur IA | tir vers (x, y), puissance bornée à 0,3-1 |
| CONDUIRE (5) | x, y, vitesse | leur IA | conduite vers (x, y), 0 à 8 m/s |
| ALLER (1), drapeau 1 | x, y, vitesse | comme ALLER, sans ses réflexes de duel (D) : la garde du face-à-face | comme ALLER |
| GESTE (6) | cible (le n° du geste), x, y, vitesse ; drapeau 0 avec touche (contrôle), 1 sans (déplacement) | leur IA | le geste de notre répertoire (`specialvar1` = son n°), tourné vers (x, y) ; s'il ne peut pas partir, le reste de la file (le contrôle réflexe, à la vitesse demandée) |

- B n'est atteint que pour le désigné du match, à moins d'1 s du ballon (`elizacontroller.cpp:346`). Ni le gardien, ni le tireur d'un CPA, ni le joueur ballon en main n'y passent (139-304, 354-379) ; l'engagement fait exception, il se joue en jeu courant (§ 7.4).
- Ballon mort ou CPA : aucune lecture ; les intentions restent posées et reprennent au coup de sifflet.
- Pendant PASSER ou TIRER, la course demandée est l'arrêt : le contrôle freine le porteur en attendant le geste (`carte-cpp.md` § 3).
- Les réflexes restent dans la file : nos intentions n'empêchent ni les contrôles ni les tacles du corps (401-416) — sauf la garde (ALLER drapeau 1). Ils jugent un duel sur la seule géométrie (`CouldWinABallDuelLikeliness`, `playercontroller.cpp:262-291` : l'adversaire est-il entre le ballon et moi ?) : face à un porteur planté, le ballon devant lui, toujours gagnable — sans la garde, le défenseur d'un face-à-face piquait le ballon au premier pas (mesuré : 14 face-à-face sur 27). L'aimant reste actif pour le désigné du match et pour qui vient de toucher le ballon (`playercontroller.cpp:587-664`).
- Mesuré (`README.md`, « Obéissance ») : placement à 0,3 m de la cible ; 64 % des passes reçues par le destinataire imposé.

## 5. Les animations

### 5.1 Le format `.anim` (`animation.cpp:1001-1151`)

- Un fichier texte, en trois parties. D'abord **14 lignes d'images clés**, numérotées à 100 images par seconde, clés espacées :
  - `player,image,x,y,z,…` : la racine, position en mètres ;
  - 13 articulations `nom,image,qx,qy,qz,qw,…`, en quaternions locaux (une rotation codée sur 4 nombres) : `body, middle, neck, left_shoulder, left_elbow, right_shoulder, right_elbow, left_thigh, left_knee, left_ankle, right_thigh, right_knee, right_ankle`.
  - Entre deux clés, la position est interpolée en ligne droite, la rotation sur la sphère (`animation.cpp:200-314`).
- **La ligne de touche**, dans 195 fichiers sur 293 : `extension,football,image,x,y,z`, l'image du contact et la position du ballon dans le repère du joueur (`footballanimationextension.cpp:157-174`). Le lecteur accepte plusieurs contacts ; chaque fichier n'en a qu'un (compté). Les « 15 lignes » d'`animations.md` sont les 14 lignes plus celle-ci.
- **Des balises** :

| Balise | Sens |
|---|---|
| `type` | la famille : movement, ballcontrol, trap, shortpass, highpass, shot, deflect, interfere, sliding, trip, special |
| `balldirection`, `outgoingballdirection_maxdeviation` | où part le ballon, et la tolérance en fraction de π (0,25 par défaut) |
| `incomingballdirection` (et sa tolérance) | d'où arrive le ballon : amortis, interventions, parades |
| `touch_maxpowerfactor`, `touch_difficultyfactor` | la force possible, la difficulté de la touche |
| `baseanim`, `lastditch`, `idlelevel`, `priority` | les préférences du tri (§ 5.3) |
| `specialvar1`, `specialvar2` | le numéro d'un geste joué seulement sur demande (§ 5.5) |
| `incoming/outgoing_special_state` | au sol (`lay_back`, `lay_front`) : il faut se relever d'abord |
| `incoming/outgoing_retain_state` | ballon en main (`right_elbow`) |
| `triptype`, `bumpdirection`, `steps` | la chute ; le nombre de pas, d'où le pied d'appui à la sortie |

- Calculés au chargement (`_PrepareAnim`, `animcollection.cpp:1043-1078`) : la difficulté du geste, l'image de touche, la partie du corps au contact (`touch_bodypart`), le quadrant (la sortie quantifiée : arrêt, ou 3 vitesses × 10 angles, 42-95). `AddExtraTouches` devait ajouter des contacts autour du principal ; il sort avant (921). Une animation qui part de l'arrêt est tournée pour partir face à l'avant (`animation.cpp:316-365`).
- Les 283 fichiers hors modèles, par type (compté) : course 65, contrôle 45, amorti 40, passe courte 37, parade 28, chute 19, tir 17, passe haute 15, intervention 7, tacle glissé 6, spécial 4 (3 célébrations, le carton).
- Il n'existe ni type passe longue, ni tête, ni prise : la passe longue joue les passes courtes (`humanoid.cpp:1241`) ; une commande « tête » ou « prise » ne trouve rien. Aucun fichier n'a de balise `priority` ; les courses générées ont la priorité 1, donc les fichiers passent devant à égalité du reste.

### 5.2 Le chargement (`animcollection.cpp:370-497`)

- Une seule fois, au premier match ; la collection survit à `gf_reset` (`match.cpp:77-103`), et les numéros d'animation restent stables.
- **Les courses générées** : les 10 modèles de `templates/` sont croisés deux à deux, dans 9 directions, filtrés par des règles (au plus une classe d'accélération, pas de virage serré au sprint…), sur 25 images (151-368). Il en sort 443 (mesuré, `animations.md`).
- Chaque course générée entre en miroir puis telle quelle ; puis chaque autre fichier, trié par chemin, tel quel puis en miroir. Les noms contenant « luxury » sont exclus ; il n'y en a aucun (419-492).
- **Le miroir** échange gauche et droite, nie x des positions, nie y et z des quaternions, ajoute « _mirror » au nom (`animation.cpp:1153-1216`).
- Total : 2 × 443 + 2 × 283 = 1 452 animations (mesuré, `animations.md`). `gf_anim_nom(id)` rend le chemin.

### 5.3 Choisir une animation (`Humanoid::SelectAnim`, `humanoid.cpp:1110-1640`)

1. **Optimisations** (1117-1156). Pour un geste qui touche le ballon : refus si le ballon imaginé sera à plus de 10 m dans 200 ms, s'il s'éloigne, ou si l'image s'écarte du réel de plus de 2 m à 1 s (un adversaire vient de le dévier). Puis les contrôles de re-file (1160-1220).
2. **La requête** (1229-1344) : le type ; la direction de départ du ballon, relative à la direction de course (passes, tirs) ; la classe de vitesse et l'orientation du corps à l'entrée ; le côté du regard ; la direction d'arrivée du ballon ; les états, la main, les `specialvar`.
3. **Le tri grossier** (`CrudeSelection`, `animcollection.cpp:503-848`), étage 0 du relevé :

| Filtre | Lignes | Règle |
|---|---|---|
| type | 519-522 | la même famille |
| vitesse d'entrée | 526-574 | exacte pour la course et le contrôle ; ailleurs souple (jamais de l'arrêt vers un geste lancé) |
| sens de rotation | 591-619 | ne pas tourner en passant par l'opposé du regard voulu |
| prise du ballon | 623-632 | gardien : seulement les parades qui captent, si demandé |
| dernier recours | 636-642 | interdit hors urgence (`Player::AllowLastDitch`, `player.cpp:145-148`) |
| orientation du corps à l'entrée | 646-743 | ±0,06π (strict) ou ±0,5π |
| direction d'arrivée du ballon | 747-779 | ±0,25π (parades : 0,4π) |
| direction de départ du ballon | 783-799 | ±`maxdeviation` × π (0,25π par défaut) |
| états, main, `specialvar`, type de chute | 803-816 | égalité |

4. **Rien ?** Une course prend l'animation d'attente ; tout autre geste échoue (1349-1356).
5. **Les meilleures directions** (1360-1465), étage 1 du relevé : `_KeepBestDirectionAnims` garde la sortie (le quadrant) la plus proche de la course voulue (`humanoidbase.cpp:984-1054`) ; `_KeepBestBodyDirectionAnims` garde les regards à 0,06π du meilleur (1057-1111). Un amorti à plus de 0,375π de la course voulue est refusé (1419-1450).
6. **Les tris** (1469-1508) : des tris stables, dont le dernier fait la clé principale. Du plus important au moins important : parade qui capte d'abord › animation « de base » (hors course) › direction de chute › vitesse d'entrée la plus proche › orientation d'entrée la plus proche (sauf contrôle) › même pied › niveau d'attente (0 en jeu, 1 en CPA ou ballon à plus de 16 m, 2 ballon mort) › priorité.
7. **Le choix** (1529-1571) : course, chute, spécial, la première ; geste de touche, la première qui atteint le ballon (§ 5.4). Une re-file vers le même quadrant est annulée (1575-1602).
8. **Jouer** (1606-1637) : étage 2 du relevé ; étage 3 pour les arbitres (`humanoidbase.cpp:1271`), qui ont une version simple, sans touche ni re-file (`humanoidbase.cpp:610-754, 1113-1297`).

### 5.4 Atteindre le ballon : la triche (`GetBestCheatableAnimID`, `humanoid.cpp:1799-2156`)

- Pour chaque candidate, dans l'ordre du tri, le corps simule sa course, puis compare la position du ballon dans l'animation, à l'image de touche, au ballon imaginé à cet instant.
- **En hauteur** : moins de 0,22 m d'écart, avec des tolérances (ballon bas et animation de base : −0,15 m ; au-dessus de 1,8 m puis 2,6 m : pénalisé) (1939-1953).
- **Au sol** : un rayon de base de 0,3 m, qui grandit avec le délai avant la touche (1967-1977). `GetBodyBallDistanceAdvantage` (1678-1797) l'élargit selon l'aisance du geste, l'aplatit en ellipse en vitesse, le recule un peu, puis le divise par deux.
- Multiplicateurs (1979-2042) : passe et tir ×1,3 et +0,15 m ; intervention ×1,4 et +0,2 m ; parade ×1,8 et +0,4 m ; tacle glissé ×0,2 ; contrôle ou amorti derrière une passe ou un tir ×0,3 ; juste après sa propre touche (600 ms), réduit. La première qui passe gagne : pas de score global (`carte-cpp.md` § 3).
- Le corps glisse alors vers le ballon avant la touche, en n'affichant qu'une partie du glissement (2066-2148). Le désigné glisse aussi en course pour arriver au ballon (2158-2234).
- Le corps touche parfois le ballon sans geste de touche : quand le ballon file sous le nez du désigné (à moins de 0,6 m, en s'éloignant) et que personne ne l'a touché depuis un moment, un amorti part pendant sa course (`humanoid.cpp:313-356`).
- Après un tacle glissé ou une chute (`lay_back`, `lay_front`), le geste suivant doit se relever ; le joueur compte comme arrêté (`humanoid.cpp:1339`, `humanoidbase.cpp:1433-1444`).

### 5.5 Un geste sur demande, la pose, le relevé

- Une animation qui porte `specialvar1` ou `specialvar2` n'est candidate que si la commande demande la même valeur (`animcollection.cpp:807-808`). Les autres commandes demandent 0 : le corps ne la joue jamais de lui-même.
- Usages : les célébrations (`specialvar1` 1 joie, 2 abattement ; `specialvar2` 2 pour le buteur, `elizacontroller.cpp:1221-1229`) ; le carton de l'arbitre (3, `refereecontroller.cpp:103-112`). C'est la porte pour nos gestes ; `animations.md` § 3 dit comment la brancher sans toucher aux en-têtes.
- `gf_pose` lit les nœuds après l'animation et ses couches procédurales (`humanoid.cpp:787-1056`) : jambes accordées à la vraie vitesse, buste et tête tournés vers le ballon, un bras levé contre un adversaire à moins de 1,4 m, un « maillot tiré » s'il est devant. Ces bras sont décoratifs : ils ne changent rien au jeu.
- Pendant les secondes gelées d'un arrêt (§ 7.4), la pose ne change pas.
- Le relevé (`patch.py`, étape 10) compte chaque choix aux quatre étages. Résultats et causes : `animations.md` (240 fichiers sur 284 joués avec notre cerveau) et `animations-releve.md`.
- **Nos gestes** (`gestes/*.anim`, n° 101 à 116, convertis du duel par `outils/vers-gpf.mjs`) portent `specialvar1` = leur n° : seule l'intention GESTE les demande. À l'arrêt, `NeedTouch` refusait leur touche (« when idle, don't want to touch the ball every frame ») ; l'étape 11 la rend à toute commande `specialVar1 ≥ 100`. Le journal note le départ de chacun (`GF_EV_GESTE`, étape 12) : le cerveau juge la morsure au contact de la feinte vraiment jouée.
- Ils partent de l'arrêt : leur classe de vitesse d'entrée est l'arrêt (`incomingVelocity_Strict`). Ils ne partent que d'un porteur sous 1,8 m/s ; demandés plus vite, le contrôle réflexe freine d'abord (à la vitesse demandée). Les gestes plantés ont une racine immobile ; les sorties en série (la roulette, le râteau) finissent lancées, à 2,2-2,4 m/s (§ 5.7).

### 5.6 Quand une animation peut être coupée : la remise en file

- **Le joueur remet en file** (`Humanoid::Process`, `humanoid.cpp:100-216`, `allowReQueue = true`) : à certaines images seulement — toutes les 20 ms pour le désigné du match près du ballon, jusqu'à 80 ms pour un joueur loin —, il réévalue sa file de commandes et peut couper :
  - un **déplacement**, à tout moment ;
  - un **contrôle ou un amorti**, tant que sa touche n'a pas eu lieu (`TouchPending`).

  Après sa touche, un contrôle va au bout ; la suivante se choisit à sa dernière image, avec l'intention posée à cet instant. La remise en file ne repart pas vers une animation du même quadrant : la même commande ne coupe pas le geste qu'elle a lancé. (`HumanoidBase::Process`, `humanoidbase.cpp:625-715`, n'a pas de remise en file : `mayReQueue` y est éteint. La première version de cette page l'avait prise pour la règle du joueur.)
- Pour le cerveau :
  - **tenir l'intention d'un geste jusqu'à sa touche** (jusqu'à sa fin pour un déplacement) : l'intention qui change avant, et le corps le coupe (mesuré : la conduite lancée posée au départ de la croqueta la coupait avant sa première touche) ;
  - **poser la suite après la touche** : il la prend en finissant le geste ; laissé en GESTE jusqu'à sa fin, le corps le rejoue (mesuré : six croquetas d'affilée) ;
  - le geste suivant se pose un tick avant la fin du courant : le corps l'enchaîne sans trou.
- Un pas est une animation de sa classe de vitesse. Sous 1,8 m/s (`idleDribbleSwitch`), le joueur pivote sur place ; au-dessus, c'est une foulée de la classe « conduite » (≈ 3,5 m/s), avec l'inertie de la physique des déplacements (`CalculatePhysicsVector` : bornes d'accélération, résistance de l'air). Un défenseur ne fait donc pas un pas de 0,35 m : un jab devenait un aller-retour d'un mètre (mesuré : de 1,2 à 2,45 m du porteur). La garde du face-à-face reste plantée sous 0,45 m d'écart ; elle bouge pour la morsure et quand le ballon bouge.

### 5.7 Plusieurs touches dans un geste (`patch.py`, étape 14)

- **Ce que le corps savait.** Les touches d'une animation (sa ligne `football`, des groupes image-x-y-z) sont des instants **candidats** : `GetBestCheatableAnimID` les essaie (le milieu d'abord) et en retient un, la touche du geste. Une animation ne touchait donc le ballon qu'une fois.
- **Un geste en série** (`<gfserie>`, `specialvar1 ≥ 100`) porte toutes ses touches dans sa ligne `football`, puis la **destination** du ballon (sa dernière entrée : pas une touche). Les transformations du corps les suivent sans rien coder : le miroir (`Mirror`), la remise face à l'avant d'une animation qui part de l'arrêt (`Rotate2D`).
  - **Le tri** ne considère que la première touche (le patch de `GetBestCheatableAnimID`) : c'est la touche du corps, triche comprise.
  - **Les suivantes** sont jouées par `_GfToucheEnSerie` (`api/intents.cpp`, F) à leur image. La touche k envoie le ballon là où l'animation met le pied de la touche k + 1, à son image. Le point se calcule comme le corps calcule une touche : sa racine au monde (`startPos + positions[f]`, décalages de la triche compris), tournée du cap de départ et de la rotation ajoutée. La vitesse se trouve par dichotomie sur la prédiction du ballon par le corps lui-même (`SetMomentum`, `Predict`) : exacte, frottements de l'herbe compris. Mesuré : le ballon arrive à 1-5 cm de l'attendu (`bancs/serie-essai.mjs`).
  - Le ballon à plus de 0,4 m de l'attendu (pris, dévié) : la série s'arrête, le corps reprend la main.
  - **Un geste planté** (`<gfarret>`) range le ballon : à sa destination, la semelle l'arrête (vitesse nulle). Le geste suivant l'y trouve.
  - **Sa racine est suivie telle quelle** (le patch de `CalculatePhysicsVector`) : le pivot sur l'appui de la roulette, la course de sortie. La physique des déplacements l'aurait lissée (bornes d'accélération, résistance de l'air), et l'appui aurait glissé.
- **Le journal** note chaque touche d'une série (`GF_EV_SERIE`, 8 : son rang, son image, l'écart du ballon à l'attendu, la vitesse posée ; −1 si la série s'arrête). Le journal des touches, lui, ne répète pas le même toucheur au même geste (`gf_event`) : les touches d'une série n'y apparaissent qu'une fois.
- **Les gestes** (`gestes/`, `outils/vers-gpf.mjs`) :
  - la roulette (114 : quatre touches, deux semelles, le tour de 330° et le pivot sur chaque appui), le râteau (112, 113 : la semelle prend le ballon puis le lâche au bout du ratissage), la croqueta (115 : l'intérieur du pied droit, puis le gauche) ;
  - les gestes plantés (101-105, 110, 111) : la touche, puis le ballon rangé (sous la semelle, au bout du roulé, du tiré) ;
  - les **tenues** (117, 118) : la semelle posée sur le ballon, sans touche (un déplacement) — jouées entre deux gestes du face-à-face. Le contrôle du corps au repos, lui, replaçait le ballon à sa distance à lui (0,36-0,40 m devant, centré), et nos touches précoces le manquaient : 95 % des gestes demandés joués au lieu de 89 %.


### 5.8 La taille des joueurs (`patch.py`, étape 15)

Le corps connaît la taille de chaque joueur (`PlayerData::height` : les 11 profils de la version Google, de 1,69 à 1,93 m, les mêmes pour les deux équipes, sans rapport avec le poste — un latéral à 1,93 m, des centraux à 1,71-1,72 m). Il ne s'en sert qu'à un endroit : la hauteur du ballon au moment de la touche d'une animation (`Humanoid::CalculateTouch…` : × taille / 1,92 m, `humanoid.cpp:1818-1929`) — une tête, un contrôle haut. Le reste (`zMultiplier`) n'étire que son propre maillage, que nous ne dessinons pas.

L'étape 15 ajoute `PlayerData::SetHeight` et deux exports, `gf_set_hauteur(id, m)` et `gf_get_hauteur(id)`. Le contrat (`contrat.mjs morphologiesDe`) tire tailles et poids par la loi de la carrière (foot, `gabarit.ts`) ; `corps.lancer()` et la page les posent (`poserLesTailles`), la page dessine les deux. Sans appel, rien ne change : la garde du corps seul tient (h = 1616609301).
### 5.8 Un geste en course (`gestes/course/`, `outils/foulee-gpf.mjs`)

Nos gestes en course (les crochets, la croqueta, la feinte de corps, le passement, les ponts, joués par un porteur lancé : `docs/gestes-en-course.md`) ont dû se plier aux conventions du corps — chacune lue dans son code, puis mesurée :
- **Le pied courant.** À l'image 0 de ses animations, le pied gauche est posé, le droit en vol (mesuré sur `ballcontrol/walk/000`, `045`, `090_strongfoot`, `movement/walk/045`, `ballcontrol/sprint/000`). C'est le « pied courant » d'un fichier (`Animation::currentFoot`, toujours droit ; gauche pour son miroir, `animation.cpp:1156`). Le joueur garde le pied de sortie de son animation (`GetOutgoingFoot` : le pied courant changé si `steps` est impair, `animation.cpp:956-975`) et le tri préfère, à direction égale, une animation dont le pied courant est le sien (`CompareFootSimilarity`, `humanoidbase.cpp:1494-1502`). Nos gestes partent donc le pied droit en vol, et `<steps>` compte leurs poses.
- **La classe de vitesse d'entrée**, lue sur les deux premières clés de la racine (`Animation::GetIncomingVelocity`, `animation.cpp:733-752`) : arrêt sous 1,8 m/s, conduite 1,8-4,2, marche 4,2-6, sprint au-delà. Pour un contrôle, la conduite du joueur est cherchée en classe marche (`humanoid.cpp:1254`) et au sens strict (`animcollection.cpp:565`) — le corps n'a d'ailleurs aucun contrôle d'entrée conduite (ses fichiers partent de l'arrêt, de la marche ou du sprint). Nos variantes à 2,5 et 3,5 m/s reculent leur première clé de quelques millimètres pour lire 4,3 m/s ; au sprint, aucune variante : le corps n'aurait pas de candidate.
- **Le côté** : le fichier et son miroir, gardés au quadrant de sortie le plus proche de la course voulue (`_KeepBestDirectionAnims`) — la direction de l'intention GESTE.
- **La première touche** est celle du corps, sa triche comprise ; sa portée croît avec l'image de la touche ((f/24)^0,7). Mesuré (`bancs/course-essai.mjs`, demandes à des porteurs lancés) : une touche à l'image 11 ne partait que 3 à 6 fois sur 15, vers l'image 20-23, 10 à 15 fois. Le départ dépend aussi du geste en cours du porteur : après un contrôle ou un amorti, 66-95 % ; pendant une passe ou une intervention, jamais.
- **L'orientation du corps à l'entrée** n'est pas stricte pour un contrôle (±0,5π, `humanoid.cpp:1286-1300`) : nos gestes partent face à la course, comme le porteur.
- **Le relevé** (`gf_anim_releve`) dit où le corps perd un geste : candidate (le tri grossier), gardée (la direction), jouée. Le passement à 3,5 m/s y passait 204 fois en 10 min, joué 57 fois ; en match, demandé à des porteurs qui ralentissent devant un défenseur posté (1,8-3 m/s), sa touche tombait trop loin devant : d'où la variante à 2,5 m/s.
- **Ajoutées au paquet** (`data.sh` : `gestes/course/`), ces animations ne changent rien sans leur `specialvar1` : le corps seul joue le même match au bit près (`l2-intents-off`, h = 1616609301).

## 6. Les touches et le ballon

### 6.1 Le contact (`humanoid.cpp:359-622`)

- À l'image de touche, le ballon doit être à moins de 0,4 m du point prévu (1 m ballon en main) et à moins d'1 m en hauteur (366-385).
- Un contact imparfait mélange le nouveau vecteur et la course d'arrivée du ballon (`bumpyRideBias`, 376-379).

| Geste | Vecteur donné au ballon | Lignes | Touche |
|---|---|---|---|
| amorti ; contrôle sans possession | `GetTrapVector` : le contrôle, plus des erreurs de rebond ; ×1,35 en KnockOn | 389-409 | selon la partie du corps |
| contrôle, conduite | `GetBallControlVector` (§ 6.4) | 411-428 | idem |
| passe ; tir | § 6.2 ; § 6.3 | 430-515 ; 517-547 | idem |
| intervention (tacle debout) | la moitié de l'amorti, + 4 m/s dans le prolongement joueur-ballon, + 0,5 à 1,5 m/s vers le haut | 549-566 | accidentelle |
| parade | prise ou renvoi (§ 8.2) | 568-607 | accidentelle |
| tacle glissé | 6 m/s dans la direction du geste, + 6 m/s vers le haut, − 28 % de la vitesse du ballon | 609-620 | accidentelle |

Les types de touche (`gamedefines.hpp:113-119`) : 0 voulue au pied (pied ou bas de jambe, `humanoid_utils.cpp:32-39`), 1 voulue sans le pied (tête, poitrine, main), 2 accidentelle. Ils décident des mains du gardien (§ 8.4), du contre-son-camp (`match.cpp:959`) et de la colonne `a` du journal.

### 6.2 La passe

1. **Au contact, le corps révise la passe** : il relance `AI_GetPass` et peut changer de destinataire à 0,15π près, en partie jusqu'à 0,3π (449-473). Le journal donne le destinataire final (`b`) et l'imposé (`d`).
2. **La cible** (`AIfunctions.cpp:1019-1171`) : le destinataire, plus son mouvement pendant la durée estimée de la passe (0,7 s au plus) ; pour la longue, 20 % de la distance en plus vers l'avant (1158-1166).
3. **La force** (`AI_GetAutoPass`, `AIfunctions.cpp:1001-1017`) : pente 0,11 au sol, `0,45 − 0,15 × d/60` en haute ; puissance `p = (d/60)^1,4 × 1,8` (haute : × 1,15). **La vitesse** : `36 × (p + 0,3)` m/s (480) ; plancher 10,8 m/s ; une courte de 24 m part à 28,8 m/s (calculé, `carte-cpp.md` § 2).
4. **La touche possible** (`GetBestPossibleTouch`, 2236-2306) :
   - plafond 30 m/s (haute : 42) × `(0,3 + 0,7 × touch_maxpowerfactor)`, jusqu'à −25 % si le joueur est bousculé, plus la moitié de la vitesse du ballon qui arrive ; l'excès part en hauteur, 0,25 m/s par m/s de trop ;
   - l'erreur : difficulté du geste × `(1 − 0,5 × passe)`, qui tire le ballon vers la direction propre au geste ;
   - ballon loin du corps, haut, rapide ou juste joué par l'adversaire : plus de hauteur, moins de force (`GetDifficultyFactors`, `humanoid_utils.cpp:154-218`) ; enfin `difficulté × 5 × U(0,2 ; 1)` m/s vers le haut (2303).
5. Une légère courbe selon l'angle du corps, et de l'effet (482-508).

### 6.3 Le tir (`GetShotVector`, `humanoid_utils.cpp:377-530`)

- La direction est celle de la commande ; la visée recalculée au contact (`humanoid.cpp:521-535`) n'est jamais transmise (`carte-cpp.md` § 1).
- **La force** : `45 × (0,7 + 0,3 × √puissance)`, soit 31,5 à 45 m/s, × un facteur d'aisance (angle, vitesse du tireur, bousculade), plafonnée à `(32 + 13 × frappe) × (0,2 + 0,8 × touch_maxpowerfactor)`, puis × `(1 + 0,2 × écart de vitesse pied-ballon / 10)` (426-441).
- **Le tir idéal** monte à 2,9° (pente 0,05), toujours (470). **Le pire cas** (475-493) : direction en retard sur la course, bruit de ±0,5 × difficulté, jusqu'à 35° de hauteur, force −50 %.
- **Le mélange** : le pire cas pèse `w = U^(0,7 × tir)`, en moyenne `1 / (1 + 0,7 × tir)` (497-502 ; calculé, `carte-cpp.md` § 1).
- **L'effet** : rétro ou lifté au hasard, plus une courbe latérale selon l'angle du corps (505-525).

### 6.4 Le contrôle et la conduite (`GetBallControlVector`, `humanoid_utils.cpp:220-350`)

- Le corps place le ballon là où le joueur sera après ce geste, plus 0,25 à 0,85 s de course selon la vitesse, devant le pied (0,34 m + 0,08 s de course, 104-118). Élévation : `0,1 + 1,5 × (p/10)^1,6` m/s (323).
- Le dribble le place un peu plus près (312) ; le contrôle le garde plus près en sprint (327-329). Un adversaire à moins de 1,5 m le fait partir plus loin ; le calme et l'équilibre réduisent l'effet (272).
- Mesuré (`README.md`) : décalage latéral du ballon en conduite, 0,11 m.

### 6.5 La physique du ballon (`ball.cpp`)

| Effet | Valeur | Lignes |
|---|---|---|
| gravité | −9,81 m/s² | 34, 184 |
| traînée de l'air | `0,015 × v²` | 31, 189-192 |
| rebond | vitesse verticale × 0,62, puis −0,06 m/s | 29-30, 205-215 |
| frottement au sol, dans 2,5 cm d'herbe | `0,04 × v² + 1,6` m/s² | 32-35, 219-237 |
| poteaux, barre | rayon 0,07 m, renvoi à 80 % (ballon : 0,11 m) | 242-339 |
| filets | seulement quand le ballon est dans le but | 344-425 |
| roulement | la rotation se couple au sol | 429-502 |
| effet Magnus | force la plus grande vers 37 m/s (calculé) | 506-522 |

- La trajectoire est prédite sur 3 s, à 10 ms près ; recalculée à chaque touche, décalée d'un cran sinon (135-176). Tous lisent cette prédiction (`Predict(ms)`, `ball.hpp:50-56`) ; à chaque pas, le ballon prend sa position à +10 ms (572-583).
- Au sol, le freinage `0,055 × v² + 1,6` tue les ballons rapides (calculé, tableau de `carte-cpp.md` § 2).

### 6.6 Les collisions et les chutes

- **Ballon contre un corps** (`match.cpp:1599-1727`) : seulement si l'adversaire a touché le ballon depuis moins de 200 ms, et pas ce joueur ; au plus une fois par 150 ms. Le ballon rebondit sur la boîte d'une partie du corps (vitesse × 0,7 au plus, effet au hasard). Touche accidentelle.
- **Joueur contre joueur** (`match.cpp:1233-1411`) : contact sous 0,72 m. Qui pousse qui : l'orientation (de dos, on perd), la vitesse, un tacle en cours (+0,1 + 0,4 × tacle), le désigné du match (+0,4), la proximité du ballon, l'équilibre. Le défenseur se colle au flanc du porteur ; sous 1,87 m, les mouvements se partagent un peu.
- **La sensibilité à la chute** (`match.cpp:1415-1492`) additionne : de dos, vitesse, avoir le ballon, `3 × (1 − équilibre)`, bousculade récente, `6 × pénétration`, ballon proche ; le tout sur 14. Au-dessus de 0,48 : trébucher (type 1) ; de 0,58 : tomber (type 2).
- **Les tacles** (`match.cpp:1497-1596`) : tacle glissé ou debout entre ses images 5 et 28, à moins de 2 m. Si une boîte du tacleur touche un pied ou un bas de jambe de l'autre (images 10 à fin − 6) : chute de type 3 (glissé) ou 1 (debout). Mesuré (`animations.md` § 1) : 694 trébuchements légers par match avec notre cerveau, 317 avec leur IA.

| Chute | Animations | Origine |
|---|---|---|
| 1 trébucher | 9 | contact léger ; tacle debout |
| 2 tomber | 8 (dont `trip_t3/sprint/000.anim`, balisé 2) | contact fort |
| 3 fauché | 2 | tacle glissé |

- Pour un type 2 ou 3, le corps essaie aussi l'autre, puis le 1 (`humanoidbase.cpp:1446-1461`). Pas de chute ballon en main, au sol, pendant une chute en cours (sauf de 1 vers 2 ou 3) ni pendant un tacle glissé (`humanoidbase.cpp:912-931`).

## 7. L'arbitre et le jeu arrêté

### 7.1 Les fautes du corps (`referee.cpp:385-452, 482-585`)

Le corps ne siffle que deux contacts :
- **un joueur en train de tacler fait tomber (type 2) un adversaire** dont l'équipe a le ballon (possession lissée > 1,1), à moins de 2 m du ballon : faute avec avantage (390-407) ;
- **un tacle glissé fauche (type 3)** alors que le tacleur n'a pas touché le ballon depuis 600 ms, ballon à moins de 8 m. Gravité = retard sur le ballon + distance au ballon + par derrière : au-dessus de 1, faute ; de 1,4, jaune ; de 2, rouge (409-451).

Le contact d'un tacle debout donne un type 1 : jamais de faute.

- **L'avantage** (495-519) : seulement le premier cas, hors surface. Après 0,6 s, il tombe si l'équipe fautée a perdu le ballon ; la faute est oubliée après 3 s.
- **Le penalty** : faute à moins de 20,09 m de l'axe et à moins de 16,44 m de la ligne de but (calculé, 488-492).
- **Le coup de sifflet** (521-582) : arrêt, coup franc au lieu de la faute (penalty à 11 m), 10 s de jeu simulé en plus s'il y a carton, carton effectif 6 s plus tard, `GF_EV_FOUL`.
- Mesuré (`README.md`) : 7 fautes par match, le corps seul ; 21,8 avec la Loi 12 du cerveau.

### 7.2 Nos fautes : `gf_faute` et `gf_carton`

- `gf_faute(fautif, victime, gravité, x, y)` (`api/gf_api.cpp:216-222`) pose une faute sans avantage, au lieu donné dans le monde (`referee.cpp:457-466`) ; `CheckFoul` la siffle au pas suivant, comme une faute du corps. Gravité bornée à 1-3 : faute, jaune, rouge.
- Elle rend 1 si les joueurs existent, sont adverses, et si le ballon est en jeu hors CPA. L'arbitre peut encore la refuser sans bruit si un arrêt est déjà armé (`referee.cpp:458`).
- `gf_carton(joueur, couleur)` montre le carton sans arrêter le jeu (l'avantage a été joué) : expulsion 6 s plus tard au second jaune ; journal avec `b = c = −1` ; aucun contrôle « en jeu » (`api/gf_api.cpp:225-232`).

### 7.3 Le hors-jeu (`referee.cpp:315-383`, `AIfunctions.cpp:193-236`)

- À chaque touche, l'arbitre note les partenaires du toucheur au-delà de la ligne : l'avant-dernier adversaire (gardien compris), ou le ballon s'il est plus loin ; jamais dans leur propre moitié.
- Le porteur touche le ballon à chaque pas de conduite : la liste se refait sans cesse ; à la passe, elle fige la photo. À la touche suivante, si le toucheur est dans la liste : hors-jeu, coup franc à sa position pour l'autre équipe, `GF_EV_OFFSIDE`. Seul toucher le ballon compte ; gêner un adversaire, non.
- Pas de liste à la remise d'une touche ni d'un corner ; il y en a une sur six-mètres. Le corps peut donc siffler un hors-jeu sur six-mètres, que la règle interdit (non vérifié en match).
- Mesuré (`README.md`) : 0,4 hors-jeu par match, contre environ 4 en vrai.

### 7.4 La chronologie d'un arrêt

| Instant | Ce qui se passe | Code |
|---|---|---|
| l'arrêt | `StopPlay`, le tampon de l'arbitre est rempli, notre saut d'horloge (§ 7.7) | `referee.cpp:139-219, 340-350, 524-562` |
| 2 s simulées | joueurs plantés, tournés vers l'arbitre (carton) ou en célébration (but) ; le ballon roule encore | `elizacontroller.cpp:70-135` |
| le placement | `randomize(graine)`, puis `PrepareSetPiece` : téléporte tout le monde, choisit le tireur, émet `GF_EV_SETPIECE` | `referee.cpp:231-243, 278-304` |
| 2 s gelées | rien n'est simulé ; l'horloge avance de 10 ms par pas | `match.cpp:864-868` |
| le coup de sifflet | `StartPlay`, `StartSetPiece` | `referee.cpp:245-250` |
| l'exécution | le tireur marche au ballon et joue ; les autres restent immobiles | `elizacontroller.cpp:139-304, 522-533` |
| la fin | dès que la touche du tireur est passée : jeu normal ; 400 ms sans détection de sortie en touche | `referee.cpp:254-275` |

| Arrêt | jusqu'au placement | puis jusqu'au sifflet |
|---|---|---|
| but | 0,5 s | 0,5 s |
| corner, six-mètres, touche, hors-jeu, faute, penalty | 2 s (12 s avec carton) | 2 s |
| mi-temps (`gf_mi_temps`) | 0,1 s | 0,2 s |

- Avec un carton, l'arbitre marche vers le fautif et montre le carton (`refereecontroller.cpp:80-127`). Dès que le geste joue, le placement est ramené à +1 s (`match.cpp:999-1017`, `referee.cpp:306-313`).
- **L'engagement** : le drapeau de CPA est levé et baissé dans le même appel de l'arbitre (`referee.cpp:257-258`). L'engagement se joue donc en jeu courant, et B y est atteint (`carte-cpp.md` § 4).
- Après un but, `GF_EV_SETPIECE` annonce l'équipe traitée en premier (`buffer.teamID = FirstTeam()`, `referee.cpp:159`), pas forcément celle qui engage. Non vérifié par une sonde.

### 7.5 Le placement (`TeamAIController::PrepareSetPiece`, `teamAIcontroller.cpp:739-1176`)

Tous les joueurs sont téléportés par `ResetPosition` (`humanoidbase.cpp:815-895`). Le gardien va sur sa ligne (750-767).

| CPA | Placement | Lignes |
|---|---|---|
| engagement | les positions de départ du scénario ; l'équipe qui engage prend celles de l'équipe qui avait engagé | 780-819, 1104-1130 |
| six-mètres | des bornes larges par camp ; ballon à 4,4 m de la ligne, au centre (`referee.cpp:186`) | 821-841 |
| corner | attaquants dans la surface, défenseurs plus bas | 843-882 |
| touche | autour du ballon, 30 m derrière, 15 à 20 m devant | 884-927 |
| coup franc | selon la distance au but ; adversaires à 9,15 m ; mur de 3 joueurs à moins de 40 m du but | 929-1028 |
| penalty | hors de la surface et de l'arc | 1030-1088 |

- **Le tireur** est le plus proche du ballon, gardien compris (1136-1138). Il est replacé à 2,3 m derrière le ballon (coup franc, corner, six-mètres), 3 m (penalty), ou 0,3 m ballon en main (touche) (1139-1172).
- La légalité n'est pas vérifiée, hormis les 9,15 m du coup franc et l'arc du penalty.

### 7.6 La décision du tireur (`elizacontroller.cpp:144-268`)

| CPA | Choix, tiré au sort |
|---|---|
| penalty | tir vers le but, y dans ±5 m, puissance U(0,4 ; 1) |
| six-mètres | 60 % passe haute vers 11 m dans la moitié adverse (y au hasard) ; sinon passe courte (y au hasard) |
| coup franc | 50 % passe haute vers la ligne de but adverse (y ±10 m) ; sinon passe courte 10 m devant |
| corner | 70 % passe haute à 0,6-7 m du but (y ±10 m) ; sinon passe courte vers un point à 11 m de la ligne, côté corner |
| touche | passe courte au plus proche |
| gardien ballon en main | § 8.3 |

- Les passes passent par `AI_GetPass`, destinataire imposé : le partenaire le plus proche du point tiré (262-266).
- **La touche est lancée.** Le tireur tient le ballon (`SelectRetainAnim`, `teamAIcontroller.cpp:1163-1166`) ; seules les animations ballon en main restent candidates (`humanoid.cpp:1340`, `animcollection.cpp:805-806`) : les lancers, à ±90° du regard.
- Le geste joué : `pass/idle/special/000_throw`, contact à 1,83 m de haut, 281 fois en 8 matchs avec notre cerveau (`animations-releve.md`). La trajectoire, elle, est calculée comme une passe courte (§ 6.2).
- Le code et le relevé disent un lancer à deux mains. `animations.md` disait « au pied » : corrigé le 3 octobre.

### 7.7 Les horloges

| Horloge | Avance | Sert à | Lue par |
|---|---|---|---|
| `actualTime_ms`, l'horloge continue | +10 ms par pas, toujours ; + nos suppléments aux arrêts | toute la logique de temps du corps | `gf_frame[0]`, notre horloge du match |
| `matchTime_ms`, le chrono du corps | +10 ms ÷ facteur, ballon en jeu seulement | la mi-temps de Google ; l'urgence de fin de match de leur tactique (`teamAIcontroller.cpp:1235`) | personne chez nous |
| `step` | +1 par appel ballon en jeu ; −1 après `gf_reset` | l'environnement Python de Google | `gf_frame[11]` |

- Le facteur est celui de la fatigue (§ 3.5) : à 0,027, chrono et fatigue filent 18 fois trop vite. `match_duration` est lu une fois, au `gf_init` (`game_env.cpp:108`, `match.cpp:56-57`) ; pour le changer, il faut un nouveau module.
- **Nos suppléments** (`patch.py`, étape 8) : à chaque arrêt, l'horloge continue saute de `gf_arret_ms(mode)`. Sept accroches : but, corner, six-mètres, touche, hors-jeu, faute, penalty ; pas la mi-temps. Le saut a lieu au coup de sifflet, ballon mort : seul `actualTime_ms` bouge (`match.cpp:1844-1850`).
- Les valeurs (`contrat.mjs:39-45`) : la vraie durée moins le temps simulé. Touche 10 s, six-mètres 20 s, coup franc 25 s, corner 28 s, but 60 s, penalty 60 s ; simulé 4 s, 1 s après un but.

### 7.8 La mi-temps, la fin, l'après-but

- La mi-temps de Google tombe quand le chrono dépasse `1800 × second_half` (`referee.cpp:101`) ; `second_half` vaut 999 999 999 par défaut (`main.hpp:201`) : jamais chez nous.
- `gf_mi_temps()` met `second_half` à 0 (`api/gf_api.cpp:211`). Au pas suivant en jeu, l'arbitre arrête le jeu et donne l'engagement à l'équipe qui n'avait pas engagé (`referee.cpp:101-120`). Seconde période, fraîcheur rendue, pas de changement de côté.
- **La fin** : aucune. `game_duration` n'est lu que par l'environnement Python ; le corps joue sans fin, nos bancs et la page cessent d'appeler `gf_step`.
- **L'après-but** dure 1 s : placement 0,5 s après le but, coup d'envoi 0,5 s plus tard (`referee.cpp:152-157`). La célébration ne part que 2 à 4 s après l'arrêt (`elizacontroller.cpp:1216-1219`) : jamais (`animations.md` § 1). Avec notre horloge, le saut de 59 s dépasse déjà la fenêtre (calculé).
- **Le buteur** : le dernier toucheur de l'équipe qui marque. Contre-son-camp, sauf si la dernière touche voulue au pied, ou sans le pied, est de cette équipe (`match.cpp:957-981`).

## 8. Les gardiens

### 8.1 Le placement (`goalie_default.cpp:25-300`)

- Ballon dans l'autre moitié : 10 m devant son but. Ballon dans sa moitié, tir non cadré : sur la bissectrice de l'angle ballon-poteaux, à 0,7 m de sa ligne au moins, plus haut quand son équipe a le ballon ; il sort si un adversaire file seul vers le but.
- Tir cadré : il se met sur la ligne du ballon ; ballon à plus de 2,5 m de haut à son niveau, il recule sur sa ligne (190-229).
- **« Cadré » ?** La ligne du ballon sur 0,8 s coupe la ligne de but à moins de `3,7 × panique` m de l'axe (237-300), avec `panique = 1,02 + (1 − (0,6 × placement défensif + 0,4 × vision)) × 0,5` : 3,77 m pour des attributs à 1, 5,6 m à 0 (calculé). Un gardien faible réagit aussi à des tirs qui partent à côté.

### 8.2 Les parades (`playercontroller.cpp:299-323`, `humanoid.cpp:568-607`)

- La parade n'est demandée que si le ballon sera à moins de 20 m dans 400 ms, que personne ne le tient, qu'il sera dans la surface dans 160 ms, et que ce n'est pas une passe en retrait (§ 8.4). Le corps a 28 parades, dont 15 qui captent le ballon.
- **Prise** si le geste capte, que personne ne tient le ballon, et que `(1 − écart de vitesse / 40) × (1 − difficulté de réaction) ≥ 0,3`. La difficulté de réaction mesure la fraîcheur de la frappe adverse, sur `1200 − 400 × réaction` ms (581).
- Sinon **renvoi** vers le camp adverse, avec son élan : 0,3 × la vitesse du ballon + 2,5 × la sienne, +1,2 m/s vers le haut.

### 8.3 Ballon en main

- Le ballon colle à la main droite, gauche en miroir (`humanoid.cpp:624-650`). Le gardien est ramené dans sa surface (`humanoid.cpp:733-767`).
- Il ne fait que lancer : 3 lancers hauts. Aucun geste du pied depuis les mains, pas de dégagement de volée (`animations.md` § 2).
- **La relance** (`elizacontroller.cpp:233-260`) : passe haute au partenaire le plus proche d'un point tiré au hasard sur sa propre ligne de but, dès que ce partenaire n'a pas d'adversaire à 10 m, ou après 4 s.
- Lecture : `pitchHalfW × GetDynamicSide()` désigne son propre but (`carte-cpp.md` § 4 corrigé le 3 octobre). Non vérifié par une sonde.

### 8.4 La passe en retrait, et notre couche

- Pas de mains si le dernier toucheur est un partenaire et que la dernière touche au pied est de son équipe (`playercontroller.cpp:306-307`). Aucune sanction : pas de coup franc indirect.
- Le gardien n'a alors que les gestes génériques au pied ; souvent il reste planté devant une passe chaude (`carte-cpp.md` § 2). Mesuré (`README.md`) : 9 buts sur 15 étaient des contre-son-camp sur passe en retrait ; le cerveau a fermé la ligne vers les gardiens.
- A et B excluent le gardien (`elizacontroller.cpp:312, 344`) : il n'est pas piloté, et le cerveau lui pose IA (`inventaire-moteur.md` § 2).
- Ballon au pied, leur IA joue pour lui : passe de panique tant qu'un adversaire approche (`possessionAmount < 3`), sinon passe ou conduite (`elizacontroller.cpp:374-378, 968-972`).

## 9. Les attributs

### 9.1 Le mécanisme

- 22 attributs, de 0 à 1 (`utils.hpp:38-62`). Le corps garde une valeur de base et la lit par `Player::GetStat` : `base × (0,3 + 0,7 × difficulté) × (0,7 + 0,3 × fraîcheur)` (`player.cpp:452-457`). Endurance et vitesse sont lues brutes.
- Nos matchs ont une difficulté de 1 des deux côtés (`corps.mjs:19`) : seule la fatigue joue.
- **Défauts** : 11 profils fixes (`playerdata.cpp:67-487`), dans l'ordre des rangs (`teamdata.cpp:277-287`). Valeur = `profil × 2 × base × (0,5 + 0,5 × âge) × 1,2`, bornée à 0,01-1 (`utils.cpp:124-140`).
- Les deux équipes sont identiques : mêmes profils, seuls les noms changent. Les profils suivent le rang, pas le rôle (§ 3.2) : l'avant-centre du scénario (rang 2) a des tacles à 1,0, un défenseur central (rang 5) une frappe à 1,0 (calculé).
- `gf_set_stat` écrit la base, arrondie au millionième (`playerdata.hpp:37-38`), et met à jour la vitesse (`playerdata.cpp:542-545`). `gf_reset` recrée les joueurs : il faut tout reposer.

### 9.2 Les 22, un par un

Défauts calculés depuis les profils, non mesurés : minimum-maximum sur les 11 rangs, G = gardien.

| # | Attribut | Ce qu'il change | Où | Défaut |
|---|---|---|---|---|
| 0 | équilibre | gagne les contacts, tombe moins, perd moins d'élan bousculé, garde le ballon près sous pression | `match.cpp:1303-1304, 1334, 1345, 1387-1388, 1434-1435` ; `humanoidbase.cpp:1749` ; `humanoid_utils.cpp:272` | 0,60-1,00 (G 0,94) |
| 1 | réaction | voit 100 ms plus tôt au-dessus de 0,75 ; contrôle mieux un ballon que l'adversaire vient de jouer ; gardien : capte plus tôt après une frappe | `icontroller.cpp:32` ; `humanoid_utils.cpp:199` ; `humanoid.cpp:581` | 0,73-1,00 (G 1,00) |
| 2 | accélération | accélère plus fort (× 0,7 à × 1), pâtit moins des gestes difficiles | `humanoidbase.cpp:1680` (lue en 1743, 2144) | 0,69-1,00 (G 0,80) |
| 3 | vitesse | vitesse de pointe 7,2 à 8 m/s, sans effet de la fatigue | `playerbase.cpp:135` ; `humanoidbase.cpp:1681` (lue, jamais utilisée) | 0,65-1,00 (G 0,65) |
| 4 | endurance | se fatigue moins : × (2 − endurance) par mètre | `player.cpp:449` (329) | 0,64-0,83 (G 0,80) |
| 5 | agilité | tourne plus sec (× 0,7 à × 1), pâtit moins des gestes difficiles | `humanoidbase.cpp:1679` (lue en 1743, 1898, 2040) | 0,65-1,00 (G 0,94) |
| 6 | puissance de frappe | plafond du tir de 32 à 45 m/s | `humanoid_utils.cpp:435` | 0,73-1,00 (G 0,94) |
| 7 | tacle debout | gagne le contact pendant son tacle debout | `match.cpp:1281, 1283` | 0,29-1,00 (G 0,36) |
| 8 | tacle glissé | gagne le contact pendant son tacle glissé | `match.cpp:1282, 1284` | 0,21-1,00 (G 0,36) |
| 9 | contrôle | amortit plus propre, plie plus sa course en touchant, garde le ballon près en sprint, retouche un peu plus tôt | `humanoid_utils.cpp:210, 327` ; `humanoidbase.cpp:1778` ; `humanoid.cpp:2039` ; `humanoid_utils.cpp:326` est un commentaire | 0,51-0,93 (G 0,51) |
| 10 | dribble | garde sa liberté d'accélérer et de tourner juste après une touche ; pousse le ballon moins loin | `humanoidbase.cpp:1682` (lue en 1748 ; 2008 est du code mort) ; `humanoid_utils.cpp:312` | 0,35-1,00 (G 0,36) |
| 11 | passe courte | passe au sol (et longue) plus juste, moins levée ; leur IA ose plus la passe en une touche | `humanoid.cpp:2270` ; `elizacontroller.cpp:829` (leur IA) | 0,65-1,00 (G 0,94) |
| 12 | passe haute | passe haute plus juste | `humanoid.cpp:2271` | 0,65-1,00 (G 1,00) |
| 13 | tête | **rien** | — | 0,36-0,88 |
| 14 | tir | tir plus près du point visé ; leur IA vise plus juste | `humanoid_utils.cpp:499` ; `elizacontroller.cpp:1028-1029` (leur IA) | 0,35-1,00 (G 0,51) |
| 15 | volée | moins d'erreur sur un ballon qui arrive vite | `humanoid_utils.cpp:455` | 0,28-0,77 |
| 16 | calme | garde le ballon près quand un adversaire colle | `humanoid_utils.cpp:272` | 0,64-0,83 |
| 17 | activité | leur IA sans ballon s'essouffle moins ; sans effet sous ALLER | `elizacontroller.cpp:582` | 0,64-0,83 |
| 18 | résilience | **rien** | — | 0,64-0,83 |
| 19 | placement défensif | gardien : juge mieux si un tir est cadré | `goalie_default.cpp:247` | 0,40-1,00 (G 1,00) |
| 20 | placement offensif | **rien** | — | 0,22-1,00 |
| 21 | vision | gardien : idem, poids 0,4 | `goalie_default.cpp:247` | 0,61-0,87 (G 0,80) |

- Trois attributs ne servent à rien : tête, résilience, placement offensif. Sous nos intentions, trois lectures tombent : la passe courte et le tir de leur IA (B les remplace), l'activité (A remplace la course).
- Mesuré (`README.md`) : un effectif par défaut d'« élite synthétique », gardien à 1,00 en réaction, quatre tireurs à 1,00 ; le tableau le retrouve.

## 10. Notre couche

### 10.1 Les fichiers

| Fichier | Rôle |
|---|---|
| `fetch.sh` | télécharge gfootball 2.10.2 (PyPI), copie `src/`, `data/` et la licence dans `upstream/`, applique `patch.py` |
| `patch.py` | 10 correctifs idempotents (le relancer ne change rien) |
| `api/gf_api.cpp` ; `api/intents.hpp`, `api/intents.cpp` | l'API exportée ; intentions, journal, horloge, relevé, et les méthodes `_Gf*` d'`ElizaController` |
| `api/SDL2/SDL2_rotozoom.h` | remplace SDL2_gfx (seul `zoomSurface` est appelé) |
| `data.sh`, `data-files.txt` | les données : toutes les animations, les fichiers ouverts sans rendu (relevés par strace), les .bmp réduits à 2×2, une police ; 6 Mo |
| `build.sh` | compile les objets en parallèle, puis lie : `out/gpf.mjs`, `gpf.wasm`, `gpf.data` |
| `contrat.mjs` ; `corps.mjs` | constantes (`INTENTION`, `PASSE`, `EV`, `GESTE`, `ARRETS_REELS`, `CHRONO_REEL`) et lectures, sans dépendance ; `chargerLeCorps()` : `lancer`, `avancer`, `miTemps`, `etat`, `intention`, `fautes`, `journal` |
| `determinisme.mjs`, `bench-node.mjs` | l'empreinte ; la vitesse |
| `empaqueter.sh`, `paquet.mjs` ; `bancs/` | le cerveau en un module ; obéissance, matchs, autopsies, relevés, séries |

### 10.2 `patch.py`, étape par étape

Chaque étape remplace un texte exact : elle échoue si le motif manque, et passe si le nouveau texte est déjà là (`patch.py:9-16`).

| # | Fichiers | Change | Pourquoi |
|---|---|---|---|
| 1 | `cmake/file.h`, `cmake/file.cpp`, `base/utils.cpp` | `boost::filesystem` → `std::filesystem` | le système de fichiers en mémoire d'Emscripten (le compilateur C++ vers WebAssembly) |
| 2 | `types/messagequeue.hpp`, `types/command.hpp`, `defines.hpp` | `boost::condition` → `std::condition_variable_any` | un seul fil d'exécution |
| 3 | `systems/graphics/graphics_system.cpp` | toujours `MockRenderer3D`, l'en-tête OpenGL écarté | pas d'OpenGL |
| 4 | `cmake/backtrace.cpp` | traces de pile vides | pas d'`execinfo` |
| 5 | `game_env.cpp:108` | `match_duration` lu dans `GFOOTBALL_MATCH_DURATION` (0,027 par défaut) | chrono et fatigue réglables |
| 6 | `elizacontroller.hpp/.cpp`, `team.cpp`, `match.cpp`, `referee.cpp`, `humanoid.cpp` | déclarations `_Gf*`, crochets A, B, C ; journal (touche, but, faute, hors-jeu, CPA, passe) | le cerveau externe (lot L2) |
| 7 | `data/playerdata.hpp` | `PlayerData::SetStat` | les attributs réglables (lot L3) |
| 8 | `referee.cpp` | 7 sauts `BumpActualTime_ms(gf_arret_ms(mode))` | l'horloge du match |
| 9 | `referee.hpp`, `referee.cpp` | `Referee::GfFaute` | la Loi 12 du cerveau |
| 10 | `humanoid.cpp`, `humanoidbase.cpp` | `gf_anim_compte` aux 4 étages | le relevé des animations |

- Les étapes 1 à 5 ne changent rien au jeu (`README.md`). Les étapes 6 à 14 ne changent rien sans intention ni appel : chaque lecture rend la main au code d'origine (11 ne joue que pour `specialVar1 ≥ 100`, que seule l'intention GESTE pose ; 13 que pour ALLER au drapeau 1 ; 14 que pour nos gestes `<gfserie>`). Leurs ajouts aux en-têtes (6, 7, 9, 13, 14) sont des méthodes non virtuelles : la disposition en mémoire des objets ne bouge pas.

### 10.3 Les fonctions (`api/gf_api.cpp`, toutes dans `extern "C"`)

| Fonction | Rôle (lignes) |
|---|---|
| `gf_init(pasParAppel, matchDuration)` | démarre le moteur, données sous `/data` ; une fois par module, rend 0 ensuite (56-68) |
| `gf_reset(graine, diffG, diffD, durée)` | un 11 contre 11 neuf, IA des deux côtés ; graine impaire : ordre de traitement inversé ; suppléments remis à 0 ; `durée` ignorée par le C++ (71-86) |
| `gf_step(n)` | n pas (89) |
| `gf_frame()`, `gf_pose()` ; `gf_frame_head()`, `gf_frame_per()`, `gf_pose_per()` | l'état (§ 10.4), les poses (§ 10.5) (95-155) ; 16, 19, 55 (234-236) |
| `gf_intents(on)` | active ou coupe le mode intentions ; vide intentions et journal ; à appeler après `gf_reset` (160) |
| `gf_set_intent(id, kind, x, y, vitesse, cible, puissance, drapeaux)` | l'intention tenue d'un joueur ; monde, m, m/s (165-169) |
| `gf_events()`, `gf_events_n()` | le journal depuis la dernière lecture ; `gf_events` d'abord (173-174) |
| `gf_set_stat(id, n, v)`, `gf_get_stat(id, n)` | la base d'un attribut (190-200) |
| `gf_set_arrets(engagement, sixMetres, coupFranc, corner, touche, penalty)` | les suppléments d'horloge, en ms (204-207) |
| `gf_mi_temps()` ; `gf_faute(…)`, `gf_carton(…)` | la mi-temps au prochain pas en jeu (211) ; § 7.2 (216-232) |
| `gf_anims_n()`, `gf_anim_nom(id)`, `gf_anim_releve(étage)`, `gf_anim_raz()` | le relevé : nombre, chemin, compteurs, remise à zéro (241-251) |

`build.sh:26` exporte aussi `malloc` et `free`.

### 10.4 La trame `gf_frame` (16 + 22 × 19 nombres, `api/gf_api.cpp:95-128`)

| En-tête | Contenu |
|---|---|
| 0 ; 1 ; 2 | horloge continue, ms ; ballon en jeu ; CPA en cours |
| 3 | mode (`e_GameMode`, `defines.hpp:227-235`) : 0 normal, 1 engagement, 2 six-mètres, 3 coup franc, 4 corner, 5 touche, 6 penalty ; 0 tant que le CPA n'a pas commencé |
| 4 ; 5 | score gauche ; droite |
| 6-8 | ballon x, y, z (m, monde) |
| 9 ; 10 | équipe en possession (−1 sinon) ; rang du possesseur dans son équipe |
| 11 ; 12 | pas de l'environnement (§ 7.7) ; nombre de joueurs |
| 13-15 | vitesse du ballon x, y, z (m/s) |

| Par joueur (équipe 0 puis 1, dans l'ordre de l'équipe) | Contenu |
|---|---|
| 0 ; 1 | équipe ; rôle (`e_PlayerRole`, `defines.hpp:214-225` : 0 G, 1 DC, 2 DG, 3 DD, 4 MDC, 5 MC, 6 MG, 7 MD, 8 MOC, 9 AC) |
| 2-4 | position x, y, z (m, monde) |
| 5-6 ; 7-8 | direction (de course, à l'arrêt celle du corps) ; direction du corps |
| 9 ; 10 ; 11 | vitesse (m/s) ; id stable ; actif |
| 12-13 ; 14 | vitesse x, y (m/s) ; geste en cours (`e_FunctionType`, § 4.3) |
| 15 ; 16 ; 17 ; 18 | possède le ballon ; désigné du match ; désigné de l'équipe ; ballon en main |

### 10.5 La pose `gf_pose` (22 × 55 nombres, `api/gf_api.cpp:132-155`)

- Par joueur : la racine x, y, z (le nœud `player`, en mètres, z porté par l'animation), puis 13 quaternions locaux (x, y, z, w) dans l'ordre des fichiers `.anim` (29-30). Équipe 1 : racine niée en x et y, corps tourné de 180° autour de z (144-148). `gpf-anim.jointsFromSample` porte cette pose sur nos humains (`README.md`).

### 10.6 Le journal (`gf_events`, 8 nombres par événement)

`[type, horloge ms, équipe, joueur (id stable), a, b, c, d]` (`api/intents.hpp:51-61`).

| Type | Émis à | a | b | c | d |
|---|---|---|---|---|---|
| 1 TOUCHE | chaque touche, sauf même joueur et même geste (`team.cpp:267`, `intents.cpp:52-55`) | type de touche | geste en cours | — | — |
| 2 BUT | `match.cpp:981` ; équipe créditée, buteur ou −1 | 1 si contre son camp | — | — | — |
| 3 FAUTE | `referee.cpp:576-577` ; `gf_carton` ; équipe et joueur du fautif | gravité 1-3 | victime, ou −1 | 1 si penalty ; −1 pour un carton seul | — |
| 4 HORS-JEU | `referee.cpp:352` ; le joueur hors-jeu | — | — | — | — |
| 5 CPA | `referee.cpp:301`, au placement ; équipe qui reprend, tireur ou −1 | `e_GameMode` | — | — | — |
| 6 PASSE | `humanoid.cpp:510-513`, au contact ; le passeur | geste (4, 5, 6) | destinataire final | vitesse de la touche (m/s) | destinataire imposé, ou −1 |

Le journal n'est rempli que si le mode intentions est actif (`intents.cpp:51`). Un tir n'a pas d'événement propre : c'est une TOUCHE de geste 8.

### 10.7 Construire

```sh
source ~/emsdk/emsdk_env.sh
./fetch.sh          # upstream/ puis patch.py
./build.sh          # objets en parallèle (JOBS=6), puis édition de liens → out/
node determinisme.mjs
```

- Drapeaux (`build.sh:9-11`) : C++17, `-O3`, exceptions WebAssembly natives (forme « legacy ») ; `EH=js` reconstruit l'émulation JavaScript dans `out-js/`. Sources (13-14) : tout le moteur sauf le rendu OpenGL et le client réseau, plus `api/*.cpp`.
- Édition de liens (23-29) : module ES `GpfModule` pour le web, un Worker ou Node ; mémoire extensible, 128 Mo au départ, pile de 4 Mo ; données préchargées sous `/data`. Mesuré (`README.md`) : `gpf.wasm` 2,45 Mo, `gpf.data` 5 Mo, `gpf.mjs` 0,13 Mo ; construction complète ≈ 2 min sur 6 cœurs.

### 10.8 Les gardes

- **Intentions coupées, au bit près.** `determinisme.mjs` : graine 7, 2 000 pas, empreinte des positions et du ballon. Même empreinte dans Node, dans Chromium et pour les deux formes d'exceptions (mesuré, `README.md`).
- **Intentions actives, aucune posée, au bit près** (mesuré, `README.md`, ligne « IA »). Le script ne le fait pas seul : ajouter `M._gf_intents(1)` après `gf_reset` (`carte-cpp.md`, « Résumé classé »).
- **Le paquet** : `bancs/paquet.mjs` joue 1 min, graine 7, avec le cerveau des sources puis le cerveau empaqueté ; les deux doivent finir identiques. `empaqueter.sh` le lance.
- **La page = le banc** : la page charge les mêmes `out/gpf.mjs` et `out/cerveau.mjs` ; même graine, même match. Non vérifié ici : la page n'est pas dans ce dépôt de travail.
- **Le banc de match** (`bancs/match-cerveau.mjs`) se garde lui-même : le journal doit retrouver le score du corps ; une empreinte finale dit si deux bancs ont joué le même match.
- **Pour un correctif neuf** : l'armer par une marque que seul le cerveau pose ; n'ajouter ni retirer aucun tirage sur le chemin par défaut ; refaire les deux empreintes (`carte-cpp.md` § 0).

### 10.9 Les pièges

1. **`build.sh` ne suit pas les en-têtes** : sa ligne 16 compare seulement le `.cpp` à son `.o`. Changer une structure d'un en-tête (`PlayerCommand`, `TouchInfo` de `gamedefines.hpp`, une classe) laisse des objets périmés : corruption de mémoire silencieuse. Cela vaut aussi pour `api/intents.hpp`, inclus par six fichiers du moteur et nos deux `.cpp`. Après un tel changement : `rm -rf build/obj`, puis tout reconstruire. Ajouter une méthode non virtuelle est sans risque.
2. **`extern "C"`** : une fonction de l'API doit être dans `extern "C"` (sinon son nom C++ est décoré), marquée `EMSCRIPTEN_KEEPALIVE`, et listée dans `EXPORTED_FUNCTIONS` (`build.sh:26`). Sinon `M._gf_x` n'existe pas.
3. **`match_duration`** : 0,027, le réglage de Google, accélère chrono et fatigue 18 fois ; 4,75 colle au temps réel. Il est fixé au premier `gf_init`, et `corps.mjs:18` n'appelle `gf_init` qu'au premier `lancer()`. `determinisme.mjs` et `bench-node.mjs` (par défaut) tournent à 0,027.
4. **Les vues mémoire** : Emscripten n'expose une vue que si elle figure dans `EXPORTED_RUNTIME_METHODS` (`build.sh:27` : `HEAPF32`, `HEAP32`, `HEAPU8`). Les noms d'animation se lisent dans `HEAPU8`, les compteurs dans `HEAP32`. La mémoire peut grandir : recréer la vue après chaque appel, comme `contrat.mjs`.
5. **Le journal** : appeler `gf_events()` avant `gf_events_n()` ; le pointeur vaut jusqu'à l'appel suivant ; rien n'est noté si le mode intentions est coupé.
6. **Les id stables** dépendent de la parité de la graine (§ 3.2).
7. **`gf_reset` recrée les joueurs** : les attributs sont à reposer. Les intentions, elles, survivent jusqu'au prochain `gf_intents` ; sans lui, celles du match précédent s'appliquent aux nouveaux joueurs de même id.
8. **L'en-tête de `gf_frame`** : la colonne 10 est un rang dans l'équipe ; la colonne 11 ne compte que les pas en jeu.
9. **Les secondes gelées** : `gf_step` avance l'horloge, mais ni le monde ni la pose ne bougent.

## 11. Ce que le corps ne sait pas faire

- **Tirer à la hauteur voulue** : le tir idéal monte à 2,9°, la hauteur ne vient que de l'erreur ; ni lob, ni piqué (plancher de 31,5 m/s), ni effet demandé → `carte-cpp.md` § 1.
- **Jouer une passe en retrait au sol, et la contrôler au gardien** → `carte-cpp.md` § 2.
- **Refuser la talonnade** : le corps la choisit seul pour une passe vers l'arrière → `carte-cpp.md` § 3.
- **Laisser le cerveau décider d'un CPA** : le tireur tire au sort, le placement est imposé, la légalité n'est pas vérifiée → `carte-cpp.md` § 4.
- **Plusieurs touches dans un geste** : une touche par animation ; ni roulette, ni croqueta, ni série de passements → `animations.md` § 3.
- **Jouer un geste précis sur demande** : le mécanisme `specialVar` existe, il n'est pas branché → `animations.md` § 3.
- **Le répertoire qui manque** : dribbles et feintes, gestes de CPA (touche longue, élan, mur qui saute), vie autour du jeu (célébrations, gestes de l'arbitre, drapeaux) → `animations.md` § 2. Ses trois célébrations ne sont jamais jouées : l'après-but dure 1 s (§ 7.8).
- **Le gardien complet** : ni poings, ni parade du pied, ni relance roulée, ni dégagement de volée ; il ne fait que lancer.
- **Décider une tête** : il n'y a pas de geste « tête », seulement la tête comme partie du corps au contact.
- **Le contact voulu** : ni charge, ni maillot tiré, ni duel de corps ; les bras de la pose sont décoratifs → `animations.md` § 3.
- **Les fautes ordinaires** : seulement les tacles ; ni tacle debout fautif, ni main, ni coup franc indirect, ni sanction de la passe en retrait.
- **Le hors-jeu juste** : jugé seulement à la touche du ballon, et aussi sur six-mètres.
- **Un vrai match** : ni changement de côté, ni fin, ni remplacement, ni blessure ou boiterie ; la mi-temps efface la fatigue ; pas d'avantage du domicile, les deux équipes sont identiques.
- **Courir à reculons** : il marche à reculons, au trot (§ 3.3, `animations.md` § 2).
- **Un regard choisi** : ALLER ne tourne le joueur vers le ballon qu'à l'arrivée ; aucune intention ne fixe le regard.
