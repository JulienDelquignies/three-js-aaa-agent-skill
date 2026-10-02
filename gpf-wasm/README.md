# gpf-wasm — le moteur de match de Gameplay Football dans le navigateur

Lot **L0** du cadrage « Football Manager ++ » (dépôt foot, `Cadrage_Moteur_Match_V1.md`, PR #42).

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

Restent ouverts :
- **Les fautes.** Le corps ne siffle que les contacts des tacles, et le tacle reste un réflexe du corps. Le cerveau a un répertoire de duels (tacle glissé, charge, maillot tiré, `duel.js`) que l'adaptateur n'utilise pas encore.
- **Les buts amenés par une passe.**
- **La réussite des passes.**
- **Les arrêts de jeu.** Trop peu de six-mètres et de coups francs, d'où le temps effectif.
- **Le hors-jeu.**
- **L'avantage du domicile.** Rien ne le modélise : les deux équipes sont identiques.

## Licences

`LICENCES.txt`, copié à côté du module, réunit les avis : l'Unlicense du moteur, la licence Apache 2.0 de ses fichiers, la police et les bibliothèques compilées dedans (SDL2, FreeType, HarfBuzz, zlib, Boost).

- Le moteur (`third_party/gfootball_engine`) est sous Unlicense (domaine public).
- Les fichiers modifiés par Google portent un en-tête Apache 2.0, conservé dans `upstream/` (non versionné, reconstruit par `fetch.sh`).
- Aucune police du dépôt de Gameplay Football n'est embarquée : la police exigée par le moteur est DejaVu Sans Mono, dont la licence est jointe aux données.
- Les personnages Rocketbox sont sous MIT.
- Aucune texture (les .bmp sont des remplaçants 2×2), aucun son ni aucun nom d'équipe du jeu n'est repris. Seules leurs animations et les maillages des corps, qui sont des entrées de la simulation, sont embarqués, sous Unlicense.
