# gpf-wasm — le moteur de match de Gameplay Football dans le navigateur

Lot **L0** du cadrage « Football Manager ++ » (dépôt foot, `Cadrage_Moteur_Match_V1.md`, PR #42), puis le lot **L2** : notre cerveau aux commandes de ses corps.

**La documentation de référence est dans [`docs/`](docs/README.md)** : le corps, le moteur, l'adaptateur, les attributs. Ce README garde la construction, les mesures et l'histoire de chaque correction, par date.

On compile en WebAssembly, **sans son rendu**, le moteur de match de Google Research Football 2.10.2 (`third_party/gfootball_engine`, licence **Unlicense**, issu de Gameplay Football de Bastiaan Konings Schuiling). Ses 22 joueurs sont ensuite dessinés par notre three.js avec nos humains : la page `examples/showcase/gpf-match.html`.

## Construire

```sh
source ~/emsdk/emsdk_env.sh      # Emscripten 6.0.10 (emsdk « latest », le 2 octobre 2026)
./fetch.sh                       # récupère gfootball 2.10.2 (PyPI) dans upstream/ et applique patch.py
./build.sh                       # 108 sources en parallèle (le moteur + l'API ; ≈ 2 min sur 6 cœurs), puis l'édition de liens → out/
node bench-node.mjs 60 7         # banc : un match IA contre IA, ms par pas (p50, p95, p99), preuves de vie
node determinisme.mjs            # l'empreinte après 2 000 pas, graine 7 — la même dans le navigateur
cp out/* LICENCES.txt ../examples/showcase/public/gpf/   # le module et ses licences, servis par la page
```

### Les correctifs (`patch.py`, idempotent)

Ils ne changent rien au comportement du jeu ; ils remplacent seulement ce que le navigateur n'a pas.

| Pièce | Remplacée par |
|---|---|
| `boost::filesystem` | `std::filesystem` (le système de fichiers en mémoire d'Emscripten) |
| `boost::condition` | `std::condition_variable_any` (le moteur tourne sur un seul fil sans rendu) |
| rendu OpenGL | `MockRenderer3D`, toujours (le fichier OpenGL n'est pas compilé) |
| traces de pile (execinfo) | rien |
| chrono figé à 0,027 (×18) | réglable par la variable `GFOOTBALL_MATCH_DURATION` (4,75 = 90 vraies minutes) |

Les exceptions C++ sont compilées en instructions WebAssembly natives (forme « legacy », lue par Chrome 95, Firefox 100 et Safari 15.2), plutôt qu'émulées en JavaScript. Mesuré en A/B entrelacé sur la même charge : −12 % par pas, −28 % au démarrage, un module de 2,45 Mo au lieu de 2,66 Mo, et le même match au bit près. `EH=js ./build.sh` reconstruit l'émulation dans `out-js/`.

S'y ajoute `api/SDL2/SDL2_rotozoom.h`, un remplaçant de SDL2_gfx : seul `zoomSurface` est appelé, par l'interface jamais affichée.

### Les données (`data.sh`, `data-files.txt`)

- **La liste** : les fichiers que le moteur ouvre réellement sans rendu, relevés par `strace` sur la version native. Ce sont les animations, les maillages des corps (leurs boîtes servent aux collisions), les buts, le ballon et la police.
- **Les images .bmp** sont remplacées par un BMP 2×2 du même nom : le rendu factice ne les dessine pas.
- **Volume : 6 Mo** au lieu de 88.
- **Une police** est exigée au démarrage, car le moteur construit ses pages d'interface même sans les afficher. On embarque DejaVu Sans Mono, prise au système (licence Bitstream Vera et domaine public, jointe), plutôt que l'Alegreya de leur dépôt.

## L'API (`api/gf_api.cpp`)

| Fonction | Rôle |
|---|---|
| `gf_init(pasPhysiquesParAppel, matchDuration)` | démarre le moteur (données sous `/data`) |
| `gf_reset(graine, difficultéGauche, difficultéDroite, durée)` | un 11 contre 11 (le scénario de `11_vs_11_stochastic`), l'IA du jeu des deux côtés |
| `gf_step(n)` | avance de n appels (1 appel = 10 ms si `pasPhysiquesParAppel` = 1) |
| `gf_frame()` → `Float32Array` | en-tête (temps, en jeu, mode, score, ballon, possession) puis, par joueur : équipe, rôle, position, directions, vitesse, id, actif |
| `gf_pose()` → `Float32Array` | par joueur : la racine (nœud `player`) et les **13 quaternions locaux** dans l'ordre des fichiers .anim — ce que `gpf-anim.jointsFromSample` porte sur le rig canonique. L'équipe 2, traitée en miroir par le moteur, est rétablie (racine niée en x, y ; corps tourné de 180°) |

## La page

`examples/showcase/gpf-match.html` montre le 11 contre 11, IA contre IA, avec les Rocketbox du duel. En bas à gauche s'affichent les images par seconde, le coût de la simulation et celui des poses.

| Paramètre | Effet |
|---|---|
| `?seed=7` | la graine du match |
| `?cam=pres` | la caméra rapprochée |
| `?vitesse=2` | le jeu accéléré |
| `?md=4.75` | le chrono à l'heure (90 vraies minutes) |
| `?ombres=0`, `?bloom=0` | sans ombres, sans bloom, pour diagnostiquer un téléphone |
| `?orbit` | la caméra libre |
| `?webgl` | WebGL 2 au lieu de WebGPU |

## Mesures (2 octobre 2026, i7-8559U)

| | |
|---|---|
| Module | `gpf.wasm` 2,45 Mo + `gpf.data` 5 Mo + `gpf.mjs` 0,13 Mo |
| Démarrage | 0,6-0,8 s (Node) ; 1,5 s dans la page (Chromium, données comprises) |
| Un pas de 10 ms, Node | **0,63-0,66 ms** (×15 le temps réel) ; p50 0,60 · p95 1,2 · p99 1,8 · max 22 ms sur un match entier |
| Un pas de 10 ms, Chromium | 0,6-0,7 ms |
| Un pas, natif (même machine) | 0,6 ms |
| Un match de 90 vraies minutes, d'une traite | **354 s** (540 000 pas, `match_duration` 4,75) — le natif : 325 s |
| Regardé en temps réel | ≈ 6,6 % d'un cœur |
| Les poses des 22 humains dans la page | 0,85 ms par image (lecture, port des articulations, écriture des os), hors rendu |
| Déterminisme | même empreinte au bit après 2 000 pas, graine 7 : Node, Chromium, et les deux variantes d'exceptions (`determinisme.mjs`) |
| Téléphone Pixel 10 Pro Fold (page du cockpit) | **61 images/s** ; simulation 1,19 ms par pas ; poses 1,03 ms par image ; démarrage 0,66 s |

**Leur IA sur 90 vraies minutes n'est pas du football.** Le match entier, IA contre IA, finit 14-21, et chaque joueur court 23 km (le réel : 10 à 12). Leur IA est réglée pour des matchs de 5 minutes de jeu effectif. Le cadrage le prévoyait : leur corps, notre cerveau.

## Le cerveau externe (lot L2)

Le moteur garde ses corps. Un cerveau externe pose, joueur par joueur, une **intention tenue** que le contrôleur du moteur (`ElizaController`) lit à trois endroits (`api/intents.hpp`, `api/intents.cpp`, et 7 correctifs de `patch.py`) :

| Intention | Lue où | Effet |
|---|---|---|
| `ALLER` (x, y, vitesse) | A. le placement sans ballon | va au point, à la vitesse demandée ; ne chasse pas le porteur |
| `PRESSER` | C. la chasse | fond sur le porteur adverse (aimant au ballon, hâte) |
| `PASSER` (destinataire, courte / longue / haute) | B. la décision du porteur | la passe du moteur, destinataire forcé |
| `TIRER` (point visé, puissance) | B | la frappe du moteur, direction imposée |
| `CONDUIRE` (point, vitesse) | B | la conduite du moteur, orientée |
| `IA` | — | le contrôleur décide : **sans intention posée, le match est identique au bit près** (`determinisme.mjs`, même empreinte) |

Restent au moteur, en v1 : les gardiens, les coups de pied arrêtés et tout le jeu arrêté, les gestes de contact (contrôle, amorti, tacle).

Un porteur que le cerveau n'a pas encore vu (le ballon vient d'arriver, son intention est encore `ALLER` ou `PRESSER`) **garde le ballon** et le conduit vers son placement jusqu'au tick suivant (≤ 100 ms) : laisser le contrôleur décider à cet instant, c'était lui laisser la passe en une touche — 45 % des passes de nos matchs venaient de lui.

Le **journal** (`gf_events`) note chaque touche (dédoublonnée : le porteur « touche » le ballon à chaque pas), but (buteur, contre son camp), faute (gravité, victime, penalty), hors-jeu, coup de pied arrêté, et chaque **passe au contact** (le destinataire que le corps vise vraiment, la force de la touche).

- `contrat.mjs` : le contrat du corps, sans dépendance — les constantes (intentions, passes, événements, gestes), la lecture de l'état et du journal, la pose d'une intention. La page et le cerveau empaqueté le partagent.
- `corps.mjs` : la couche JavaScript du module : lancer, poser les intentions, avancer, lire l'état et le journal.
- `cerveau.mjs` : **notre cerveau** (le moteur de match de la skill) aux commandes.
  - À chaque tick de 100 ms, il reçoit le monde du corps : positions, vitesses, regards, ballon, possession.
  - Il décide avec `assignMatchJobs`, les couches de `movePlayers`, `arbitre` et `choosePass`, en respectant ses portes de tenue du ballon.
  - Ses décisions repartent en intentions. Elles lui coûtent 0,9 ms par tick.
  - Il lit le journal du corps (`observer`). Il en tire la passe en vol (le cerveau fait attaquer sa passe au receveur et y fait réagir la défense) et la tenue du porteur (`st.hold`, comptée depuis sa première touche : la possession déclarée par le corps clignote quand le ballon s'écarte d'un pas).
  - Il respecte les limites du corps : la ligne vers les gardiens est fermée, car leur gardien ne sait pas jouer une passe en retrait.
  - Il parle les gestes du corps : la « longue » est la passe dans la course, la « haute » le ballon levé.
- `empaqueter.sh` : le cerveau en un seul module ES (`out/cerveau.mjs`, 539 Ko), sans le module WebAssembly, pour la page. `bancs/paquet.mjs` garde le paquet : il joue le même match que les sources, au bit près.
- `bancs/obeissance.mjs` : le corps obéit-il ? Chaque intention est comparée au même match sans elle.
- `bancs/match-cerveau.mjs` : un match, avec la feuille de match et les critères du cadrage : copains avec le ballon, téléportations, temps de jeu effectif. Il se garde lui-même : le journal doit retrouver le score du moteur, et une empreinte de l'état final dit si deux bancs ont joué le même match.
- `bancs/autopsie-tirs.mjs` : chaque tir. Le banc mesure l'xG de référence de la skill, la pression, les défenseurs dans le triangle, le gardien, la vitesse et le cadrage, puis l'issue. Il sépare ainsi les occasions, la frappe et le gardien.
- `bancs/autopsie-buts.mjs` : les touches des 6 secondes qui précèdent chaque but.
- `bancs/autopsie-passes.mjs` : chaque passe, de la frappe (au pas de 10 ms) à la touche suivante. Pour chacune, le banc mesure le dégagement de la ligne, la pression sur le passeur et sur le receveur, la vitesse du ballon, puis l'issue. Pour une passe du cerveau, il note aussi l'instant de la décision et le délai jusqu'à la frappe. Il sépare ainsi le **choix** de la passe de son **exécution**.

### Mesures du 2 octobre (graine 7 pour l'obéissance ; 3 graines × 15 min pour le match)

| Obéissance (180 s) | sans intention | avec |
|---|---|---|
| distance à la cible de placement (médiane) | 41,3 m | **0,3 m** |
| passes reçues par le destinataire imposé (un anneau arbitraire) | 17 % | **64 %** |
| tirs de l'équipe | 2 | **18** |
| défenseur le plus proche du porteur (médiane) | 3,3 m | **1,4 m** |

| Match (par 90 min, 3 graines × 15 min) | notre cerveau | leur IA | réel visé |
|---|---|---|---|
| buts | 8 | 34 | 2,75 |
| tirs | 20 | 116 | 26 ± 7 |
| passes | 1 550 | 1 390 | ≈ 1 000 |
| temps de jeu effectif | **91 %** | 85 % | ≈ 64 % (58 min) |
| passes par minute de jeu effectif | **18,8** | 18,0 | ≈ 17 |
| passes réussies | ≈ 75 % | ≈ 77 % | 80-85 % |
| ballon à plus de 1,5 m pendant les conduites | 14-17 % | 4-5 % | < 10 % |
| décalage latéral du ballon en conduite | 0,11 m | 0,08 m | < 0,15 m |
| téléportations (> 3 m en 100 ms, jeu en cours) | 0 | 0 | 0 |

Le volume de passes « par 90 min » trompe : notre ballon est en jeu 91 % du temps (le corps reprend vite les coups de pied arrêtés, il siffle peu), contre 64 % en vrai. Par minute de jeu effectif, le rythme est le bon. Les buts, non : 8 pour 20 tirs, soit 40 % de conversion, contre 11 % en vrai.

**Pourquoi nos passes se perdaient** (`autopsie-passes.mjs`, 3 graines, 681 passes du cerveau, 614 de leur IA) :

- **Ce n'est pas l'exécution.** À pression égale sur le passeur, la réussite est la même dans les deux modes : 63 % contre 68 % à moins d'1 m, puis 82-85 % contre 77-84 % au-delà.
- **C'était le moment.** 57 % de nos passes partaient avec un adversaire à moins d'1 m, contre 18 % chez eux, et 161 de nos 185 passes perdues étaient de celles-là.
- Le cerveau décidait avec l'adversaire à 1,7 m, qui arrivait à 5 m/s. Le corps met 0,4 s à armer la frappe.
- Le cerveau de la skill juge le calme sur l'instant, à 1,8 m, réglage fait pour ses propres corps. `cerveau.mjs` le juge désormais **à la frappe** : chacun est projeté de 0,4 s.
- Résultat : décision à 2,4 m, frappe à 1,3 m, réussite de 71 % à 75 %.

**D'où venaient les buts** (`autopsie-tirs.mjs` et `autopsie-buts.mjs`, 4 graines × 45 min) :

- **Nos tirs étaient réalistes.** 42 tirs, xG de référence ≈ 0,10 par tir, 6 buts pour 5,2 attendus. Leur gardien arrête 70 % des tirs cadrés, comme en vrai.
- **9 buts sur 15 étaient contre notre camp.** C'étaient des passes en retrait au gardien. La « courte » de 24 m part à 29 m/s et monte à 2 m. Le gardien est planté : la règle lui interdit les mains, et son moteur ne sait pas la jouer du pied.
- Avec la ligne vers les gardiens fermée et la passe en vol rendue au cerveau : **0 contre-son-camp** sur 180 min.

| Match, notre cerveau (4 graines × 45 min) | avant | après | réel visé |
|---|---|---|---|
| buts par 90 min | 7,5, dont 4,5 contre son camp | 7, dont 0 | 2,75 |
| tirs par 90 min | 23 | 21,5 | 26 ± 7 |
| buts venus d'un tir | 40 % | 93 % | — |
| buts sur passe | — | 25 % | ≈ 75 % |
| passes par minute de jeu effectif | 18,8 | 19,5 | ≈ 17 |
| passes réussies | 75 % | 76 % | 80-85 % |

### Le match à l'horloge (2 octobre, 8 matchs de 90 min, graines 3 à 29)

**La fatigue était accélérée 18 fois.** Le corps accumule la fatigue divisée par le facteur de son chrono (`player.cpp`) :
- au réglage de GRF (`match_duration` 0,027), un joueur était épuisé vers la 12ᵉ minute, attributs ramenés à 70 % ;
- à 4,75 (`CHRONO_REEL`), l'horloge du match colle au temps simulé, et un joueur qui court 10,5 km finit à environ 60 % de fraîcheur.

Toutes les mesures L2 précédentes (et la page) voyaient donc des joueurs épuisés. Le « 2,4 fois l'xG » en venait.

**L'horloge du match.**
- Une remise en jeu dure ce qu'elle dure en vrai : touche 10 s, six-mètres 20 s, coup franc 25 s, corner 28 s, but 60 s, penalty 60 s.
- Le corps en simule environ 4 s ; l'horloge avance du reste (`gf_set_arrets`, 7 points d'accroche dans l'arbitre), et l'écran coupe le temps mort.
- La mi-temps est sifflée à 45:00 de l'horloge continue (`gf_mi_temps`), pas à celle du corps, qui s'arrête ballon mort.
- `match-cerveau.mjs` joue désormais un match à l'horloge (`HORLOGE=0` : les bancs d'avant).

**Les attributs du corps se règlent de l'extérieur** (`gf_set_stat`, `gf_get_stat`). C'est la porte du lot L3. Leur effectif par défaut est une élite synthétique : gardien à 1,00 en réaction, quatre tireurs à 1,00.

**La passe en une touche est décidée par notre cerveau** (`premiere-intention.js`).
- Il tranche une fois par passe, environ 0,5 s avant l'arrivée, sur le monde projeté au contact. L'ordre de passe est tenu jusqu'à la frappe.
- Le seuil du ballon jouable est celui du corps : 15 m/s. Leur IA joue en une touche entre 9,5 et 15 m/s avec 67-86 % de réussite.
- Les tirages du cerveau passent par ses flux nommés, comme dans son propre pas.

| Par match (moyenne des 8) | mesuré | réel |
|---|---|---|
| buts | **2,9** | 2,75 ✓ |
| buts / xG de référence | **1,11** (conversion 12 %) | ≈ 1 (11 %) ✓ |
| cartons jaunes | **3,75** | 3,9 ✓ |
| touches | **49** | 40-45 ✓ |
| tirs | 18,6 | 26 ± 7 |
| nuls | 3 sur 8 | ≈ 25 % |
| passes réussies | 73 % | 80-85 % |
| passes par minute de jeu effectif | 21 | ≈ 17 |
| temps de jeu effectif | 79 % | ≈ 64 % |
| six-mètres / coups francs | 6 / 7 | 17 / 22 |
| fautes | 7 | 21,5 ✗ |
| hors-jeu | 0,4 | ≈ 4 |
| passes en une touche | 11 % | 15-25 % |
| buts amenés par une passe | ≈ 20 % | ≈ 75 % ✗ |
| contre-son-camp | 2 en 8 matchs | ≈ 0,1 par match |
| téléportations | 0 | 0 ✓ |
| décalage latéral en conduite | 0,11 m | < 0,15 m ✓ |

### La Loi 12 du cerveau (2 octobre, 8 matchs de 90 min)

Le corps ne sifflait que les contacts de ses tacles glissés, en retard : 7 fautes par match, mais 3,8 jaunes. Il manquait les petites fautes du vrai football. Le cerveau a la sienne, complète.
- **L'accrochage du battu** (`duel.js`) : le défenseur dépassé retient le porteur lancé. La probabilité dépend de la composure, de l'agressivité, du rôle, du pressing et de la faute tactique.
- **L'arbitrage** (`referee.js`, dans l'administration d'`assignMatchJobs`) : l'avantage d'abord (1,8 s), puis le coup de sifflet, avec un carton jugé sur la nature de la faute.

L'adaptateur lit sa décision autour d'`assignMatchJobs` et la transmet à l'arbitre du corps :
- le coup de sifflet, au lieu de la faute (`gf_faute` : coup franc ou penalty, carton) ;
- le carton seul, quand l'avantage a été joué (`gf_carton`).

Deux réglages calés sur le corps :
- **La fréquence des accrochages.** Le cerveau la règle pour environ 17 par match dans son monde. L'épisode revient deux fois plus dans celui du corps : 35,9 accrochages par match à sa probabilité, d'où un facteur 17/35,9.
- **La retenue dans sa surface**, ×0,27.

Deux défauts trouvés en route :
- **Le lieu de la faute.** C'était d'abord celui de la victime au coup de sifflet, qui avait pu entrer dans la surface pendant l'avantage : 7 penalties en 8 matchs.
- **Les expulsés.** Un joueur expulsé par le corps n'avait pas de sortie dans le cerveau, et son administration plantait.

| Par match (8 matchs de 90 min) | sans | avec | réel |
|---|---|---|---|
| fautes | 7 | **21,3** | 21,5 ✓ |
| coups francs | 7 | 20,9 | ≈ 22 |
| temps de jeu effectif | 78 % | **72 %** | ≈ 64 % |
| buts | 2,9 | 3,3 | 2,75 |
| penalties | — | 0,6 | ≈ 0,27 |
| jaunes | 3,8 | 6,0 | 3,9 ✗ |
| rouges | 0 | 0 à 0,1 | ≈ 0,1-0,2 |

### La passe, la défense et la finition (2 octobre, suite)

**La passe : prévoir avec la physique du corps.** On a mesuré la prévision du cerveau passe par passe (`selection.js`, `bancs/autopsie-passes.mjs`).
- Il prévoyait 81 % de réussite, et en obtenait 72 %.
- L'écart vivait sous pression : 59 % des passes partaient avec un adversaire à moins d'1 m, réussies à 65 % pour 80 % prévus.
- Le terme « bloc » du cerveau (la pression du porteur fait baisser la réussite : 0,06 dans son monde) et son calage par classe sont réajustés ensemble sur les issues du corps, par log-vraisemblance : bloc 0,45.
- Son choix en valeur attendue (`choix.js`) lit cette réussite.

**La racine : le presseur.** L'ordre PRESSER faisait foncer le presseur, aimanté, droit sur le porteur. Le presseur du cerveau, lui :
- va à sa garde côté but, sous contrôle ;
- mord le ballon à moins de 1,6 m ;
- tacle à son horloge de pression.

Mesuré, chaque fois sur 8 graines :

| Pressing | Buts par match | Passes réussies |
|---|---|---|
| chasse permanente | 3,3 | 72 % |
| à sa garde seulement | 12,3 | 85 % |
| + les tacles du cerveau | 12,8 | 85 % |
| + sa morsure | 10 à 12 | 85 % |
| + la chasse native du corps | 9 | 78 % |
| **à sa garde, engagement à 3 m, ombre côté but près de son but** | **3,0** | **79 %** |

Les choix retenus :
- **La garde.** Le presseur va à la cible et à la vitesse du cerveau.
- **L'engagement.** À moins de 3 m du porteur, il charge (aimant au ballon). Le tacle reste aux réflexes du corps, et la décision de tacle du cerveau (`pressPredicate`, `tackleWindow`, son horloge) l'engage aussi.
- **L'ombre.** Près de son but, il suit sa garde à la vitesse du porteur + 1 m/s, sans plonger. Le plafond de 2,9 m/s du jockey est fait pour les conduites du monde du cerveau. Charger dès 6,6 m faisait des mêlées : 75 % de buts sur ballons traînants.

**La finition du cerveau** (`strike-sim.js`, `finitionSigma`, lot 258), appliquée à son tir :
- le côté ouvert, une hauteur tirée au sort (ras de terre, mi-hauteur, lucarne) ;
- les écarts de cap et d'élévation selon la pression, la distance, la vitesse et la fatigue ;
- la frappe sous-dosée sous pression.

Le corps ne pilote pas la hauteur : un tir que le cerveau envoie au-dessus devient un tir à côté. Sans la finition, les tirs étaient cadrés à 58 %, et ceux sans défenseur à 3 m convertis à 55 %.

**Le banc de cohérence** : `autopsie-passes.mjs` note la prévision du cerveau pour chaque passe (brute, calée, classe, pression du porteur). `autopsie-tirs.mjs` donne la conversion par pression du tireur.

| 8 matchs de 90 min (réglages par défaut) | avant ce lot | après | réel |
|---|---|---|---|
| buts | 3,3 | **2,9** (contre-son-camp 0,4) | 2,75 ✓ |
| buts / xG de référence | 1,33 | **0,98** | ≈ 1 ✓ |
| passes réussies | 72 % | **80 %** | 80-85 % ✓ |
| fautes | 21,3 | **19,4** | 21,5 ✓ |
| jaunes | 6,0 | **4,3** | 3,9 ✓ |
| penalties | 0,6 | 0,5 | ≈ 0,3 |
| tirs | 16,1 | 18,4 | 26 ± 7 (bas) |
| buts amenés par une passe | 20 % | 40 % | ≈ 75 % |
| temps de jeu effectif | 72 % | 74,5 % | ≈ 64 % |
| passes en une touche | 12 % | 8 % | 15-25 % |
| téléportations | 0 | 0 | 0 ✓ |
- **Les buts amenés par une passe.**
- **La réussite des passes.**
- **Les arrêts de jeu.** Trop peu de six-mètres et de coups francs, d'où le temps effectif.
- **Le hors-jeu.**
- **L'avantage du domicile.** Rien ne le modélise : les deux équipes sont identiques.

### Les séries de mesure, la passe dans le corps, la reprise au but (2 octobre, suite)

**La règle de mesure : trier court, valider complet** (`bancs/serie.mjs`).
- **La série courte** joue 8 graines × 20 min d'horloge, un match par cœur : environ 7 min pour deux variantes. Elle sert à trancher entre variantes.
- **La série complète** joue 8 × 90 min (environ 17 min). Elle valide la variante retenue.
- **Le cache.** Un match déjà joué avec le même code (cerveau, contrat, corps, module WebAssembly, banc), les mêmes options, la même graine et la même durée n'est pas rejoué : le moteur est déterministe.
- **Le tableau** ramène tout à 90 min, à côté du réel visé. Les buts sont bruités (± 1,7 par match) : une série courte ne lit un écart de buts qu'au-delà d'environ 1 but par match.

```
node bancs/serie.mjs --variantes '{"base":{},"essai":{"rayonCharge":4}}'   # courte
node bancs/serie.mjs --complet                                              # complète, réglages par défaut
```

**Les talonnades.** Le banc lit le journal à chaque pas de 10 ms. À chaque passe, il mesure l'écart entre le regard du passeur et le départ du ballon, au contact.
- 9 % des passes partaient à plus de 150° du regard (réel : 0,2 à 0,5 %), à 16 m/s, le passeur lancé à 5,6 m/s.
- La cause : à la décision, 35 % des passes du cerveau étaient à plus de 100° de son regard. Le coût d'angle de son choix (`coutAngle`) ne suffit pas.
- La porte au contact de la skill (`horsCorps` : la frappe refusée) vit dans sa propre frappe, que le corps remplace. Or le corps de Gameplay Football n'a pour ces passes que ses gestes « 180 » : la talonnade, à l'arrêt comme en plein sprint.

La règle (`talon`, `pTalon`) : au-delà de 100° (`passeFaisable.contact`), le joueur **se tourne d'abord**, au pas, ballon au pied, vers sa passe. Elle part quand elle est dans le corps. La talonnade permise (`talonReel` : au sol, 10 m au plus) reste rare : un tirage par possession et par destinataire, calé sur le réel.

| 8 × 20 min | talonnades | passes réussies | tirs par 90 min |
|---|---|---|---|
| sans règle | 9 % | 79 % | 15,8 |
| une autre passe, dans le corps | 4 % | 76 % | 20,3 |
| se tourner d'abord | 5 % | 79 % | 25,3 |
| **se tourner d'abord, talonnade rare** | **1 %** | **78 %** | **24,8** |

Le seuil vient du cerveau (100°). Essayé à 135°, là où le corps a ses passes en se tournant (reprise ci-dessous comprise) : 3 % de talonnades au lieu de 1 %, 7 % de tirs en une touche au lieu de 21 %.

**Les têtes, une erreur de mesure.** Aucune animation du corps ne déclare le geste « tête » : ses 13 têtes sont des passes, des tirs et des interventions dont la partie du corps au contact est la tête. Le journal porte le type de touche (`e_TouchType` 1 : intentionnelle, pas du pied), et le banc compte désormais les têtes ainsi. Le « 0 tête » d'avant était faux.

**La reprise au but en première intention** (`reprise`). Le cerveau de la skill reprend ses vols au contact, dans son monde (`tete.js`, `voleeStep`). Le corps, lui, ne reprend que si on le lui a demandé avant, au moins une latence plus tôt. L'adaptateur décide donc au contact projeté, une fois par passe :
- **la tête** si le ballon arrive entre 1,5 m et le front sauté, à moins de 12 m du but, dans la surface, le but dans le corps (120°) ;
- **la volée** si le ballon arrive entre 0,25 et 1,15 m, à moins de 14 m du but, dans la surface, le but dans le corps (100°) ;
- **au sol**, ce que l'arbitrage du cerveau (`arbitre`) choisirait le ballon au pied : le tir s'il vaut plus que la passe, le centre ou la conduite.

Le tir garde la loi de finition du cerveau, calculée au point de contact.

| 8 × 20 min | tirs en une touche | buts amenés par une passe | têtes par 90 min |
|---|---|---|---|
| sans | 5 % | 22 % | 35 |
| avec | 21 % | 40 % | 48 |

**La validation : 8 matchs de 90 min** (réglages par défaut : se tourner d'abord, talonnade rare, reprise au but).

| | avant | après | réel |
|---|---|---|---|
| talonnades | ≈ 9 % | **1 %** | < 1 % ✓ |
| tirs | 18,4 | **24,1** | 26 ± 7 ✓ |
| fautes | 19,4 | **21,8** | 21,5 ✓ |
| jaunes | 4,3 | **3,9** | 3,9 ✓ |
| passes réussies | 80 % | 79 % | 80-85 % |
| buts amenés par une passe | 40 % | **48 %** | ≈ 75 % |
| buts marqués en une touche | 1 sur 20 | **11 sur 29** | environ la moitié |
| tirs en une touche | ≈ 5 % | 20 % | ≈ 30 % (ordre de grandeur) |
| buts | 2,9 | **3,9** ✗ | 2,75 |
| buts / xG de référence | 0,98 | 1,17 | ≈ 1 |
| téléportations | 0 | 0 | 0 ✓ |

Le prix est le nombre de buts. Les tirs en une touche convertissent à 28 % (11 sur environ 39), les autres à 12 %. C'est le prochain point à disséquer : le placement du gardien du corps et la distance de ces tirs. Les têtes au but restent sans but (0 sur 29).

**La carte du C++** (`carte-cpp.md`, une lecture du code, rien de compilé) propose quatre correctifs, chacun armé par une marque que seule l'intention pose (la garde au bit près tient) :
- **la hauteur du tir**, aujourd'hui fixe à 2,9° (`humanoid_utils.cpp`) ;
- **la talonnade sur demande** : une ligne après la sélection du geste retire les quatre talonnades ;
- **les coups de pied arrêtés**, que leur IA tire au hasard ;
- **la passe en retrait au gardien**, à mesurer d'abord.

Le piège de construction : `build.sh` ne suit pas les en-têtes. Changer une structure du moteur (`gamedefines.hpp`) sans tout recompiler corromprait la mémoire sans erreur visible. Les correctifs passent donc par des champs que le moteur ignore déjà.

### Les animations du corps et celles de notre moteur (2 octobre, nuit)

`animations.md` répond à deux questions, mesurées :
- **Les animations du corps sont-elles toutes appelées ?** Sur 284 fichiers (16 matchs de 90 min), notre cerveau en fait jouer 240, leur IA 257.
  - 22 ne sont jouées par personne : les célébrations (l'après-but de la version Google dure 1 s, la célébration commence à 2 s), le gardien qui marche ballon en main, et des gestes toujours devancés.
  - 22 ne sont jouées que par leur IA : les têtes (notre cerveau ne joue jamais un ballon aérien en première intention) et des parades hautes (nos tirs sont plus bas et moins nombreux).
- **Nos gestes ont-ils leur animation dans le corps ?** Sur 142 gestes de notre moteur (`inventaire-moteur.md`) : 62 oui, 25 approchants, 55 non. Il manque surtout les dribbles et les feintes, les gestes autour des coups de pied arrêtés (l'élan, le mur ; la touche se lance bien à la main), la vie autour du jeu, les duels de corps, quelques tirs et gestes de gardien. La partie 3 dit ce qu'il faut faire côté C++.

**Le relevé** (`patch.py`, étape 10) : chaque choix d'animation compte à quatre étages. Ce sont la candidate au premier tri, la gardée après les filtres de direction, la jouée par un joueur et la jouée par un officiel. C'est un compteur, la garde au bit près tient. L'API : `gf_anims_n`, `gf_anim_nom`, `gf_anim_releve`, `gf_anim_raz`. Les bancs : `bancs/animations.mjs`, `bancs/animations-bilan.mjs` ; le tableau complet est dans `animations-releve.md`.

### Le face-à-face « Taarabt » dans le 11 contre 11 (3 octobre)

La loi du duel (`face.js`), portée sur les corps : `face.mjs`, actif par défaut (option `face`). Le détail est dans `docs/adaptateur.md` § 7.10.
- **Les gestes.** Les 16 gestes du face-à-face du duel sont convertis pour le corps (`outils/vers-gpf.mjs`, `gestes/*.anim`, n° 101 à 116). Ce sont l'arrêt et les roulés de semelle, la feinte de corps, le passement et ses séries, le tiré de semelle, le râteau, la roulette et la croqueta. L'intention GESTE les demande (`specialVar1`) ; le journal dit quand chacun démarre (`GF_EV_GESTE`).
- **Le C++** (`patch.py`) :
  - étape 11 : la touche à l'arrêt, que `NeedTouch` refusait ;
  - étape 12 : le départ du geste au journal ;
  - étape 13 : la garde du défenseur (ALLER au drapeau 1, sans réflexes de duel).

  Chacune n'est armée que par l'intention : la garde au bit près tient (1616609301).
- **Ce que le corps a imposé**, chaque point mesuré : la garde muette (le défenseur piquait le ballon au premier pas, 14 fois sur 27) ; la fente engagée sur sa ligne (sous PRESSER il n'était jamais battu, 0 sur 14) ; la fin lue au journal et l'issue à la touche suivante ; les deux intentions posées à chaque tick ; le geste qui va au bout ; la garde plantée (un pas du corps couvre un mètre) ; le vrai un-contre-un, mesuré en temps.
- **Mesuré** (loi finale, graines 3, 7, 11 et 13 × 20 min, `bancs/face-match.mjs`) :
  - 14 face-à-face, ≈ 16 par 90 min (15,0 par match sur 8 × 90 min) ;
  - 2,8 s et 1,8 feinte par face-à-face (réel : 3,3-5 s, 2-4 feintes) ;
  - 89 % des gestes demandés joués ;
  - 2 s après : ballon gardé 10 fois sur 14, défenseur battu 5 fois.
- **Le match autour ne bouge pas.** Sur 8 × 90 min, la variante sans face-à-face retrouve la référence (3,9 buts, 21,8 fautes, 3,9 jaunes) ; avec, les écarts restent dans le bruit d'un match (3,4 buts contre 3,9 ; 24,0 fautes contre 21,8 ; 4,1 jaunes contre 3,9 ; 0,4 penalty contre 0,5 ; 79 % de passes réussies des deux côtés). Aucun face-à-face dans la surface, aucune faute liée à l'un d'eux (8 graines × 20 min).
- **La page** : la caméra se rapproche sur le duel ; la touche F, ou `?face=saut`, avance jusqu'au prochain ; `?face=0` l'éteint. Elle joue le même match que Node au bit près, face-à-face compris (graine 11, 16 010 pas).

### Les gestes à plusieurs touches (3 octobre)

Le corps ne touchait le ballon qu'une fois par animation : les touches de sa ligne `football` sont des instants candidats, il en retient un. Le détail est dans `docs/corps.md` § 5.7.
- **L'étape 14 du C++.** Un geste marqué `<gfserie>` joue ses touches l'une après l'autre, chacune envoyant le ballon là où l'animation met le pied de la suivante, à son image. La vitesse se cherche sur la prédiction du ballon par le corps lui-même. Mesuré (`bancs/serie-essai.mjs`) : 1 à 5 cm d'écart à la touche suivante. Sa racine est suivie telle quelle (le pivot, la course de sortie). La garde au bit près tient (1616609301).
- **Les gestes** (`outils/vers-gpf.mjs`). La roulette, le râteau et la croqueta portent ce que la sim du duel écrivait pendant le geste : le cap qui tourne (330° pour la roulette), le corps qui pivote sur son appui puis part, le ballon sur son chemin. Les gestes plantés rangent le ballon (`<gfarret>`) ; les tenues (117, 118) posent la semelle sur le ballon entre deux gestes, sans le toucher.
- **Dans le face-à-face.** 95 % des gestes demandés partent (89 % avant). La fente du défenseur gagne encore trop : c'est le chantier suivant.

### Les gestes en course, les effectifs notés, le face-à-face des anomalies (3 octobre, suite)

Le retour du 3 octobre : « je ne veux pas qu'un central commence à vouloir faire un 1v1 ; je serais déçu si on ne peut pas voir un Dani Olmo dans la 3D — des mouvements smooth qui suivent les joueurs, peu importe le contexte et la zone ; Taarabt, Ben Arfa, Boateng, Saint-Maximin sont des anomalies, mais un joueur qui a les attributs doit faire des choses différentes ». La référence et le détail : `docs/gestes-en-course.md`.
- **Les effectifs notés** (`cerveau.mjs`) : sans eux, le flair était tiré au hasard, poste ignoré — un défenseur central à 0,97. Deux effectifs générés par poste (`effectif.js`), et deux archétypes à poser pour les voir : l'artiste et le technicien (`docs/attributs.md` § 0).
- **Le face-à-face réservé aux anomalies** (`face.mjs`) : flair ≥ 0,9 et nature de dribbleur ≥ 3, l'envie selon la nature et la zone. Mesuré : plus aucun central n'y entre ; il devient rare (une fenêtre par demi-heure pour un artiste).
- **Le cerveau décide les gestes en course** (`gesteDuCerveau`) : ses « niches du 1c1 » — la croqueta, les ponts, la roulette, le râteau, le passement, la feinte de corps (portée du duel), le crochet — sur le monde prêté, avec ses attributs. Ses planchers d'appétit sont levés (ils faisaient dribbler les centraux), son volume × 0,4 et la pente de la nature 2,2 : les centraux à 0-1,2 geste par minute de ballon, les ailiers et le 10 à 4,3-6,5, une anomalie jusqu'à 12 ; 72-108 gestes décidés par match (186-219 avant).
- **Le corps les joue** (`gestes-course.mjs`) : 27 animations en course (9 gestes × 2,5, 3,5 et 5 m/s, n° 200-282), cuites par le studio `outils/foulee-gpf.mjs` depuis la foulée du duel — l'horloge de foulée, les temps du geste (arc, vente, touche), l'appui ancré, l'inclinaison. Le cou-de-pied rejoint le ballon visé, les appuis glissent de 0,1 à 2,3 cm au p90. Les conventions du corps qu'il a fallu suivre (le pied courant, la classe d'entrée « marche » d'un contrôle, l'image de la première touche) : `docs/corps.md` § 5.8.
- **Mesuré dans le corps** (`bancs/course-essai.mjs`, `bancs/gestes-match.mjs`) : demandés à des porteurs lancés, deux gestes sur trois partent dans les 0,7 s (après un contrôle ou un amorti, 66-95 %) ; la seconde touche de la croqueta tombe à 3-4 cm de l'attendu ; le ballon gardé 1,5 s après le geste dans un cas sur deux, comme un dribble réel. En match, le passement part 10 fois sur 11 (0 sur 35 avant la variante à 2,5 m/s).
- **Pas encore dans le corps** : le râteau et la roulette lancés, et tout geste au sprint — décidés, comptés, pas joués ; le défenseur ne mord pas encore à nos feintes en course (la morsure du cerveau, que le face-à-face applique).
- **La page** : la touche G (ou `?gestes=saut`, le bouton « Prochain geste ») avance jusqu'au prochain geste, la caméra se met sur le flanc dégagé du porteur ; `?artiste=0:7`, `?technicien=0:9` posent les archétypes ; `?gestes=0` les éteint.
- **Les ponts** (le grand pont, la référence d'Olmo dans le cerveau lui-même ; le petit pont) suivent un chemin du corps après leur touche : ils partent, mais ne gardaient pas le ballon (0 sur 8) — la poussée du grand pont, ouverte de 14 à 24°, est à remesurer.
- **En match, avec les décisions du cerveau** (4 × 30 min) : 72-81 % des gestes demandés partent, le ballon est gardé 1,5 s après dans 60 % des cas ; les centraux font 0 ou 1 geste par demi-heure.
- **Le match autour** (série courte, 8 × 20 min) : les effectifs notés font peser les attributs — les fautes de 17,4 à 24,8 par match, les tirs de 25,9 à 28,7 ; les gestes ajoutent 0,5 but et 1,2 jaune, au bord du bruit. Rien n'est réglé sur les résultats (décision du 2 octobre).
- **Les gardes** : le corps seul au bit près (1616609301) — les animations ajoutées ne sont jamais choisies sans leur `specialvar1` ; le paquet contre les sources ; la page contre les bancs, gestes compris (graine 11, 15 999 pas).

## Licences

`LICENCES.txt`, copié à côté du module, réunit les avis : l'Unlicense du moteur, la licence Apache 2.0 de ses fichiers, la police et les bibliothèques compilées dedans (SDL2, FreeType, HarfBuzz, zlib, Boost).

- Le moteur (`third_party/gfootball_engine`) est sous Unlicense (domaine public).
- Les fichiers modifiés par Google portent un en-tête Apache 2.0, conservé dans `upstream/` (non versionné, reconstruit par `fetch.sh`).
- Aucune police du dépôt de Gameplay Football n'est embarquée : la police exigée par le moteur est DejaVu Sans Mono, dont la licence est jointe aux données.
- Les personnages Rocketbox sont sous MIT.
- Aucune texture (les .bmp sont des remplaçants 2×2), aucun son ni aucun nom d'équipe du jeu n'est repris. Seules leurs animations et les maillages des corps, qui sont des entrées de la simulation, sont embarqués, sous Unlicense.
