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

## Licences

`LICENCES.txt`, copié à côté du module, réunit les avis : l'Unlicense du moteur, la licence Apache 2.0 de ses fichiers, la police et les bibliothèques compilées dedans (SDL2, FreeType, HarfBuzz, zlib, Boost).

- Le moteur (`third_party/gfootball_engine`) est sous Unlicense (domaine public).
- Les fichiers modifiés par Google portent un en-tête Apache 2.0, conservé dans `upstream/` (non versionné, reconstruit par `fetch.sh`).
- Aucune police du dépôt de Gameplay Football n'est embarquée : la police exigée par le moteur est DejaVu Sans Mono, dont la licence est jointe aux données.
- Les personnages Rocketbox sont sous MIT.
- Aucune texture (les .bmp sont des remplaçants 2×2), aucun son ni aucun nom d'équipe du jeu n'est repris. Seules leurs animations et les maillages des corps, qui sont des entrées de la simulation, sont embarqués, sous Unlicense.
