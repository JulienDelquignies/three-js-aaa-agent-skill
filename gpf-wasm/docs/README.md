# La documentation du match « notre cerveau, leurs corps »

*État du 3 octobre 2026, branche `feat/l2-cerveau-corps` du dépôt de la skill. Le cadrage, le plan et l'avancement des lots sont dans le dépôt foot : `Cadrage_Moteur_Match_V1.md` (PR #42).*

## En une page

Le match se joue à trois pièces :

```
 la carrière (foot)          ─ effectif, tactique, attributs : MatchSetupV1 (lot L1) ─┐
                                                                                       ▼
 LE CERVEAU   le moteur de match de la skill three.js AAA (JavaScript)            moteur.md
              décide, toutes les 100 ms, sur le monde que le corps lui prête
       ▲ le monde du corps                       │ une intention par joueur
       │ (positions, ballon, journal)            ▼ (aller, presser, passer, tirer, conduire)
 L'ADAPTATEUR cerveau.mjs : prête le monde, lit les décisions, les traduit      adaptateur.md
       ▲                                         │
       │                                         ▼
 LE CORPS     Gameplay Football (Google Research Football 2.10.2, C++)            corps.md
              compilé en WebAssembly : physique, animations, touches, arbitre, gardiens
                                                                                       │
 la carrière (foot)          ◄─ le journal du match : MatchResultV1 ───────────────────┘
 la page /match11            ◄─ les poses des 22 corps, dessinées avec nos humains (Rocketbox)
```

- **Le cerveau décide** l'action : où aller, qui presser, quand tacler, à qui passer, où tirer, quand reprendre en une touche, quand siffler une faute — et, pour le porteur, quel geste tenter en course (la croqueta, le crochet, la feinte de corps, le passement), selon ses attributs.
- **Le corps exécute** : il choisit l'animation qui réalise l'action, frappe le ballon, résout les contacts, et arbitre le jeu arrêté.
- **Il garde pour lui** les gardiens, les coups de pied arrêtés, les contrôles et les tacles eux-mêmes.
- **Même graine, même match**, au bit près : dans Node (les bancs) comme dans le navigateur (la page).

## Les documents

| Document | Ce qu'il dit |
|---|---|
| [`corps.md`](corps.md) | le corps : le pas de simulation, les joueurs, le contrôleur et nos points d'entrée, les animations et leur choix, les touches et le ballon, l'arbitre et le jeu arrêté, les gardiens, les attributs, nos correctifs et l'API |
| [`moteur.md`](moteur.md) | le cerveau : son monde, sa configuration, son pas de match, ses décisions module par module, les joueurs (attributs, persona, tactique), le hasard, le face-à-face « Taarabt » du duel |
| [`adaptateur.md`](adaptateur.md) | l'adaptateur : un tick dans l'ordre, les repères, le monde prêté, le journal, chaque décision, les réglages recalés sur le corps, les options, le contrat, la page, les bancs, les gardes |
| [`attributs.md`](attributs.md) | les attributs : ceux de la carrière, du cerveau et du corps ; qui lit quoi ; les effectifs générés par poste (en attendant la carrière) ; ce qu'il faut transmettre (lot L3) |
| [`gestes-en-course.md`](gestes-en-course.md) | les gestes en course (voir un Olmo dans la 3D) : qui (les attributs, les archétypes), quand (les fenêtres du cerveau), comment (le studio qui cuit la foulée du duel pour le corps), les mesures, comment ajouter un geste ; le face-à-face réservé aux anomalies |
| [`../animations.md`](../animations.md) | les animations : celles du corps qui sont jouées ou non, et pourquoi ; nos gestes face au corps ; comment ajouter une animation |
| [`../inventaire-moteur.md`](../inventaire-moteur.md) | les 155 gestes du cerveau : source, ce qu'ils font, ce qui les déclenche, ce que l'adaptateur en décide |
| [`../carte-cpp.md`](../carte-cpp.md) | quatre correctifs C++ préparés : la hauteur du tir, la talonnade sur demande, les coups de pied arrêtés, la passe en retrait ; le piège des en-têtes |
| [`../animations-releve.md`](../animations-releve.md) | le relevé brut : 284 fichiers d'animation, quatre étages, deux cerveaux |
| [`../README.md`](../README.md) | la construction, les mesures et l'histoire de chaque correction, par date |

## Construire et vérifier

```sh
source ~/emsdk/emsdk_env.sh
./fetch.sh && ./build.sh              # le moteur : sources, correctifs, module WebAssembly
./empaqueter.sh                       # le cerveau empaqueté pour la page, et sa garde
node determinisme.mjs                 # l'empreinte du corps seul
node bancs/match-cerveau.mjs 90 7     # un match complet, notre cerveau des deux côtés
node bancs/serie.mjs                  # une série courte ; --complet pour 8 × 90 min
```

Un correctif du moteur ne doit rien changer quand l'intention n'est pas posée. Avant de pousser :
- la garde au bit près (intentions actives, aucune posée : 1616609301) ;
- la garde du paquet ;
- la page contre les bancs.
