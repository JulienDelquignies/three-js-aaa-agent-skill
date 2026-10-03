# Reprendre le travail, sur une autre machine

*État du 3 octobre 2026, fin de journée. À lire en premier par la session qui reprend le lot L2 (« notre cerveau pilote leurs corps »).*

## 1. Où on en est

- **Le projet** : le moteur de match « Football Manager ++ » du dépôt foot, piloté par le cadrage `Cadrage_Moteur_Match_V1.md` (PR #42, le tableau de bord de l'utilisateur). Le lot **L2** est en cours : notre cerveau (le moteur de match de la skill three.js AAA, JavaScript) pilote les corps de Gameplay Football (GRF 2.10.2 compilé en WebAssembly), le match se regarde sur le cockpit, /match11.
- **Le dernier chantier, fini et déployé** (3 octobre) : les **gestes en course** — le retour de l'utilisateur : « je ne veux pas qu'un central commence à vouloir faire un 1v1 ; je serais déçu si on ne peut pas voir un Dani Olmo dans la 3D ; Taarabt, Ben Arfa, Boateng, Saint-Maximin sont des anomalies, mais un joueur qui a les attributs doit faire des choses différentes ; tout doit être documenté ». La référence complète : `docs/gestes-en-course.md`. En bref :
  - les effectifs notés par poste (générés en attendant la carrière) décident qui dribble ; deux archétypes (artiste, technicien) ;
  - le cerveau décide ses gestes dans ses fenêtres (croqueta, crochets, feinte de corps, passement, ponts…), le corps joue 27 animations en course cuites depuis la foulée du duel (`outils/foulee-gpf.mjs`) ; le défenseur franchi au contact mord (le noyau du cerveau) ;
  - le face-à-face planté (Taarabt) n'est plus que celui des anomalies (flair ≥ 0,9) ;
  - mesuré : 72-81 % des gestes demandés partent, le ballon gardé 62 % (52 sans la morsure), les centraux à 0-1 geste par demi-heure.
- **Le chantier en cours** (3 octobre au soir) : **le lot L5, l'image** — l'utilisateur : « avancer sur le rendu, on reviendra au jeu plus tard ; les stades, les joueurs, les terrains, les stats, les caméras, les paramètres de visualisation, un scoreboard réaliste, pour rendre mon expérience de test plus intéressante ». Fait sur /match11 (page `feat/l2-regardable`, `src/scenes/gpf-stade.js`, `gpf-habillage.js`, `gpf-magneto.js`, `GpfMatch.js`) :
  - le stade de la skill autour du terrain du corps (huit modèles, jour/soir/nuit, le public), changeable en plein match ;
  - l'habillage télé et la régie (pause, ×½ à ×8, prochain temps fort, 10 s en arrière, six caméras, réglages) ;
  - la feuille de match (`feuille.mjs`, `docs/feuille.md`, garde `bancs/feuille.mjs`) : le rapport de `stats.js`, les notes ;
  - le magnétoscope : les ralentis des buts sous deux angles, le différé ; le corps attend pendant la lecture (le match ne change pas).
  L'essai dans Chromium sans écran : `examples/showcase/tools/essai-l5.mjs`. L'état et ce qui reste : le cadrage § 14 (les maillots, l'apparence par joueur, le réalisateur complet, les résumés).
- **Ce qui reste du jeu** (les options proposées le 3 octobre, avant L5, dans l'ordre) :
  1. le râteau et la roulette **en course** (les demi-tours d'Olmo sous pression : décidés 2 à 7 fois par demi-heure, joués seulement à l'arrêt) — des clips du duel (`rouletteCourse`, `rateau`) à fondre dans la foulée ;
  2. les **attributs dans le corps** (`gf_set_stat` : agilité, dribble, contrôle…, `docs/attributs.md` § 4.2) ;
  3. une **vitrine** : chaque geste joué seul, au ralenti ;
  4. une **série complète** (8 × 90 min) pour valider le match autour.
  Les autres manques : `docs/gestes-en-course.md` § 6 (le sprint, le pied, les ponts à remesurer) ; ceux du lot L2 : le cadrage § 12 (« Ce qui reste pour clore L2 »).

## 2. Les dépôts et leurs copies de travail

Les chemins sont ceux de l'ancienne machine (`/home/delkit/DelkIT`). **Garder les mêmes chemins** : les copies de travail git (worktrees) y renvoient en absolu, et la mémoire de Claude Code est rangée sous la clé du dossier de travail (`~/.claude/projects/-home-delkit-DelkIT-cockpit/`).

| Copie | Dépôt | Branche (dernier commit) | Rôle | À nous ? |
|---|---|---|---|---|
| `~/DelkIT/skill-l2` | `JulienDelquignies/three-js-aaa-agent-skill` | `feat/l2-cerveau-corps` (le cerveau 4b3eea2, la doc après) | `gpf-wasm/` : le corps (C++ patché, WebAssembly), l'adaptateur (`cerveau.mjs`, `face.mjs`, `gestes-course.mjs`), les outils, les bancs, la doc | **oui** |
| `~/DelkIT/skill-l2page` | même dépôt | `feat/l2-regardable` (6bd5e2f, puis les outils de reprise) | la page /match11 (`examples/showcase/gpf-match.html`, `src/scenes/GpfMatch.js`) | **oui** |
| `~/DelkIT/skill-1v1` | même dépôt | `feat/1v1-maquette` (4687c01) | le duel 1 contre 1 — **en lecture seule** : le studio et le convertisseur y lisent les modules de mouvement (`STARTER`) | non (lecture) |
| `~/DelkIT/skill-gpf` | même dépôt | `feat/gpf-anims` | le portage de trois gestes GPF dans le duel (antérieur) | à ne pas toucher sans raison |
| `~/DelkIT/three-js-aaa-agent-skill` | même dépôt | `pause/basket-2026-09-04` | la copie principale, d'une autre session | **non** |
| `~/DelkIT/cockpit` | `JulienDelquignies/cockpit` | `main` (a8c7e96) | le cockpit (Next.js) ; /match11 sert `public/duel-1v1/gpf-match.html`, `assets/`, `gpf/` ; déploiement `./scripts/deploy.sh` | **oui** |
| (à recréer) | `JulienDelquignies/foot` | `docs/cadrage-moteur-match` (68766131) | le cadrage, PR #42 — sur l'ancienne machine, une copie de travail temporaire dans `/tmp` | **oui** |
| `~/DelkIT/FootballEcosystemLifeSim-l1` | foot | `feat/l1-contrats-arbitre` | le lot L1, PR #43 (empilée sur la #41) | oui (fait) |
| `~/DelkIT/FootballEcosystemLifeSim` | foot | `3d/personnages` | la copie principale du dépôt foot, **d'une autre session** | **non** |
| `~/DelkIT/FootballEcosystemLifeSim-garage` | foot | `3d/garage-piste-b` | la piste B, **d'une autre session** | **non** |

Recréer la copie du cadrage : `git -C ~/DelkIT/FootballEcosystemLifeSim-l1 worktree add ~/DelkIT/foot-cadrage docs/cadrage-moteur-match` (ou un clone à part).

## 3. Installer la machine

- **Node 22** (22.22.1 sur l'ancienne), **python3**, **ffmpeg**, **git**, **gh** (`gh auth login`), **rtk** (0.38.0, `~/.cargo/bin/rtk` : les instructions globales de Claude Code et le crochet `~/.claude/hooks/rtk-rewrite.sh` réécrivent les commandes vers lui — l'installer, ou retirer le crochet de `~/.claude/settings.json`).
- **Emscripten** : `git clone https://github.com/emscripten-core/emsdk ~/emsdk && cd ~/emsdk && ./emsdk install latest && ./emsdk activate latest` (le corps a été compilé avec Emscripten 6.0.10, « latest » du 2 octobre). Voir § 5 sur le déterminisme.
- **Playwright** (les captures, la garde de la page) : dans `~/DelkIT/skill-l2page/examples/showcase`, `npm ci` puis `npx playwright install chromium`.
- **SSH** : l'alias `vps` du déploiement du cockpit (`~/.ssh/config` : `vps-644472fd.vps.ovh.net`, utilisateur root, port 5522, et sa clé) ; l'accès GitHub.
- **Claude Code** : copier `~/.claude/CLAUDE.md`, `~/.claude/RTK.md`, `~/.claude/settings.json` (mode `bypassPermissions` : l'utilisateur a autorisé l'autonomie complète), `~/.claude/hooks/`, `~/.claude/skills/` (dont `threejs-aaa`), et **la mémoire** `~/.claude/projects/-home-delkit-DelkIT-cockpit/memory/`. Les transcriptions (`*.jsonl`, ≈ 350 Mo) sont facultatives.

## 4. Rapatrier depuis l'ancienne machine (elle reste joignable en SSH)

L'ancienne machine : **`delkit@192.168.1.5`** sur le réseau local (SSH sur les ports 22 et 2222 ; aussi `100.103.7.118`, son adresse Tailscale). Poser d'abord la clé de la nouvelle machine : `ssh-copy-id delkit@192.168.1.5` (le mot de passe une fois).

```sh
ANCIEN=delkit@192.168.1.5
rsync -a $ANCIEN:DelkIT/ ~/DelkIT/                    # les dépôts et leurs copies de travail (chemins identiques : les worktrees restent valides)
rsync -a $ANCIEN:.claude/ ~/.claude/ --exclude 'projects/*/*.jsonl'   # instructions, réglages, crochets, skills, mémoire
rsync -a $ANCIEN:.ssh/ ~/.ssh/                        # si les mêmes clés servent (vps, GitHub)
```
- Si les chemins changent : `git worktree repair` dans chaque copie, et recopier la mémoire sous la nouvelle clé du dossier de travail.
- `gpf-wasm/upstream/` (les sources GRF téléchargées et patchées, 278 Mo) et `gpf-wasm/build/` viennent avec le rsync ; sinon `./fetch.sh` les recrée. `gpf-wasm/out/` (le module, ses données, le cerveau empaqueté) est dans git.
- `node_modules` : copiés par le rsync (même système, Linux x86-64) ou réinstallés (`npm ci`).

## 5. Vérifier que tout rejoue au bit près

```sh
cd ~/DelkIT/skill-l2/gpf-wasm
node bancs/garde-corps.mjs        # le corps seul : h = 1616609301 → « LA GARDE TIENT »
node bancs/paquet.mjs             # le cerveau empaqueté contre les sources : « paquet IDENTIQUE aux sources » (-1573909388 à la graine 7)

# la page contre les bancs : la construire avec le paquet, la servir, comparer
cd ~/DelkIT/skill-l2page/examples/showcase
cp ~/DelkIT/skill-l2/gpf-wasm/out/{gpf.mjs,gpf.wasm,gpf.data,cerveau.mjs} public/gpf/
SORTIE=/tmp/l2/l2page-dist npx vite build --config vite.gpf-match.config.mjs
(cd /tmp/l2 && python3 -m http.server 8792 --bind 127.0.0.1 &)
cd ~/DelkIT/skill-l2/gpf-wasm
node bancs/page-determinisme.mjs 'http://127.0.0.1:8792/l2page-dist/gpf-match.html?capture&webgl&seed=11' '' 3200
#   → graine 11, 15 999 pas, h = −1908051876, « MÊME MATCH AU BIT »
```
- Le module WebAssembly est déterministe d'une machine à l'autre ; **le recompiler avec une autre version d'Emscripten peut changer les flottants** (et donc les empreintes). Garder `out/gpf.wasm` tant qu'aucun correctif C++ n'est nécessaire ; après une recompilation, refaire les trois gardes et noter les nouvelles valeurs de référence (et la raison).
- Pour arrêter le serveur : `pkill -f '[h]ttp.server 8792'` (le motif entre crochets : un `pkill -f` dont le motif apparaît dans sa propre ligne de commande tue le shell qui le lance).

## 6. Les commandes de travail

| Quoi | Commande (depuis `~/DelkIT/skill-l2/gpf-wasm` sauf mention) | Durée |
|---|---|---|
| un geste en course, son bilan | `node outils/foulee-gpf.mjs crochet 3.5` (`… x.anim` : son fichier) | secondes |
| tout le répertoire en course | `node outils/foulee-gpf.mjs tous` → `gestes/course/` + `repertoire.json` ; recopier sa table dans `gestes-course.mjs` (le banc `course-essai` vérifie) | secondes |
| les gestes du face-à-face | `node outils/vers-gpf.mjs tous` | secondes |
| reconstruire le paquet du corps | `source ~/emsdk/emsdk_env.sh && ./data.sh && ./build.sh` (les objets en cache : 20 s ; tout : ≈ 2 min sur 6 cœurs) | |
| empaqueter le cerveau | `./empaqueter.sh` (lance aussi `bancs/paquet.mjs`) | 1 min |
| qui dribble, en match | `node bancs/gestes-match.mjs 30 7` (`CERVEAU_OPTIONS='{"archetypes":[{"equipe":0,"poste":9,"type":"technicien"}]}'`) | 3-5 min |
| un geste demandé au corps | `node bancs/course-essai.mjs <geste\|tous> 12 7` | 5-10 min |
| où le corps perd un geste | `node bancs/releve-course.mjs passement 10 7` | 5 min |
| le face-à-face | `node bancs/face-match.mjs 20 7` | 2-3 min |
| la série courte A/B | `node bancs/serie.mjs --variantes '{"base":{},"essai":{…}}'` (8 graines × 20 min, un match par cœur ; `--complet` : 8 × 90) | 10-20 min |
| la page, la vidéo | `vite.gpf-match.config.mjs`, puis `node tools/capture-geste.mjs '<url>?capture&webgl&seed=7&technicien=0:9' <dossier> 3 2 8` (dans la vitrine), puis ffmpeg | 30-60 min (rendu logiciel) |
| déployer le cockpit | copier la page construite dans `~/DelkIT/cockpit/public/duel-1v1/` (recette dans `vite.gpf-match.config.mjs`), commit, push, `./scripts/deploy.sh` | 3 min |
| le cadrage et la PR #42 | éditer `Cadrage_Moteur_Match_V1.md` (§ 0 « Où on en est », § 7, § 12…), commit, push ; la description de la PR : `gh api -X PATCH repos/JulienDelquignies/foot/pulls/42 -F body=@fichier` (`gh pr edit` est cassé) | |

**Une règle des bancs** : `serie.mjs` met ses matchs en cache selon une empreinte du code (`cerveau.mjs`, `face.mjs`, `gestes-course.mjs`, `contrat.mjs`, `corps.mjs`, `out/gpf.wasm`, `out/gpf.data`, son banc) — ne pas modifier ces fichiers pendant qu'une série tourne.

## 7. Les règles de la maison (la mémoire de Claude Code les porte aussi)

- **Répondre en français**, et finir par un bloc `<options>` (les suites possibles, une par ligne).
- **L'autonomie** : l'utilisateur a dit « autorise-toi tout » — pousser, déployer, agir sans demander ; ne s'arrêter que devant une destruction irréversible.
- **Ne jamais toucher les copies de travail des autres sessions** (tableau du § 2) ; travailler dans les nôtres, ou dans une copie de travail neuve.
- **Mesurer avant de régler** ; tenir les gardes au bit près.
- **Pas de réglage des résultats** (buts, xG, domicile…) tant que le moteur n'est pas définitif (décision du 2 octobre) : on consigne, on ne corrige pas.
- **Le cadrage est le tableau de bord** : le § 0, les colonnes d'état (§ 6, § 8), les lots (§ 7), le § 12 et la PR #42 à jour à chaque lot.
- **Les commits** finissent par :
  ```
  Generated with [Claude Code](https://claude.ai/code)
  via [Happy](https://happy.engineering)

  Co-Authored-By: Happy <yesreply@happy.engineering>
  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  ```
  et les descriptions de PR par « 🤖 Generated with [Claude Code](https://claude.com/claude-code) ».
- **Tout documenter** : la doc de référence est dans `gpf-wasm/docs/` (le corps, le moteur, l'adaptateur, les attributs, les gestes en course) ; l'histoire datée de chaque correction dans `gpf-wasm/README.md`.
