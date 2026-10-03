# Les gestes en course : voir un Olmo dans la 3D

*État du 3 octobre 2026.*

## En bref

- **La demande** (retour du 3 octobre, après le face-à-face Taarabt) : « je ne veux pas qu'un central commence à vouloir faire un 1v1 ; je serais déçu si on ne peut pas voir un Dani Olmo dans la 3D. Ce ne sont pas que des gestes arrêtés : des mouvements smooth qui suivent les joueurs, peu importe le contexte, peu importe la zone. Taarabt, Ben Arfa, Kevin-Prince Boateng, Saint-Maximin sont des anomalies ; mais si un joueur a les attributs, on doit le voir faire des choses différentes des autres. Tout doit être documenté pour être maintenu. »
- **Ce qui est fait.**
  - **Qui** : les deux effectifs sont notés par poste (le générateur du moteur), le flair et la nature de dribbleur en découlent ; deux archétypes (l'artiste, le technicien) se posent sur un joueur pour les voir.
  - **Quand** : le cerveau décide les gestes en course dans ses propres fenêtres — le défenseur qui se jette, la course fermée, le jockey posté, le poursuivant… —, avec ses attributs.
  - **Comment** : le corps joue neuf gestes en pleine course (crochet court, crochet, crochet chaloupé, crochet de l'extérieur, croqueta, feinte de corps, passement, grand pont, petit pont), cuits depuis la foulée du duel, et le passement, la croqueta et le râteau à l'arrêt.
  - **Le face-à-face planté** devient l'affaire des seules anomalies.
- **La morsure** : au contact, le défenseur franchi (le noyau de duel du cerveau) mord, le temps que le geste lui coûte.
- **Le partage des fichiers** :

| Fichier | Rôle |
|---|---|
| `cerveau.mjs` | les effectifs notés, les archétypes ; la décision (`gesteDuCerveau`, les niches du cerveau) ; les planchers d'appétit levés |
| `gestes-course.mjs` | la décision jouée par le corps : l'animation, la variante d'allure, l'intention tenue, la sortie |
| `outils/foulee-gpf.mjs` | le studio : la foulée du duel rejouée hors ligne, cuite en animations du corps (`gestes/course/`) |
| `face.mjs` | le face-à-face planté, réservé aux anomalies |
| `bancs/gestes-match.mjs`, `bancs/course-essai.mjs`, `bancs/face-match.mjs` | les mesures |

## 1. La référence : Dani Olmo

La vidéo envoyée (LaLigaPuls, « The guy's technical level is a total mess », 60 s, une quinzaine d'actions de Barcelone et de Leipzig) montre, image par image (2 puis 5 images/s) :
- **le slalom en pleine course dans la foule** : trois défenseurs de Valladolid à l'entrée de la surface, des changements de direction à chaque appui, le ballon jamais à plus d'un pas ;
- **le ballon retiré d'un tacle glissé** (Rayo, Séville : le défenseur se jette, le ballon passe de l'autre côté, il repart) ;
- **la conduite serrée lancée**, une touche par pas, le buste qui vend avant de couper ;
- **le demi-tour sous pression** dans le rond central (Betis), le gardien contourné (Rayo).

Ce sont des gestes **en course**, joués partout sur le terrain, jamais un face-à-face planté. Olmo n'est pas une anomalie : c'est un technicien (technique, contrôle, agilité, décision), pas un showman.

## 2. Qui : les attributs

### 2.1 Les effectifs notés par poste

- Sans effectif, le cerveau jouait 22 joueurs notés 50 partout. Seul le flair de la persona variait, tiré au hasard entre 0,15 et 1, sans regard au poste : avec la graine 7, le défenseur central droit de l'équipe 0 avait 0,97 de flair.
- **Désormais** (`creerCerveau`, paramètre `effectifs`) : absent, un effectif est GÉNÉRÉ pour chaque équipe par le générateur du moteur (`effectif.js`, `genererEffectif` : le niveau 60 de l'équipe, la qualité du joueur ±6, le profil de son poste, un bruit ±7 par note). Le flair y est une note : `makeMatch` la change en `persona.flair` (0,15 + 0,85 × note / 100).
  - Les profils de poste du moteur : le central −15 de flair et −12 de dribble, l'ailier et le 10 +15 de flair et +12-15 de dribble.
  - Un effectif donné (la carrière, lot L3) remplace le généré ; `effectifs: null` (ou l'option `effectifs: false`) rend le monde d'avant, pour l'A/B.
- **La nature de dribbleur** (`nature.js`, `specialisteF`) : exp(1,6 × (le flair centré + l'attribut composite du dribbleur)) ÷ sinh(1,6)/1,6, bornée de 0,1 à 6 — la fréquence de tentative rapportée au joueur médian. Mesurée sur les effectifs générés (graine 7) : les centraux à 0,4-0,7, les milieux à 0,7-2,4, les ailiers et le 10 à 0,8-2,3, et parfois une anomalie naturelle (un ailier à 97 de flair : 4,7-5,0).

### 2.2 Les archétypes

`options.archetypes` : `[{ equipe, poste, type }]` pose un profil de notes (`ARCHETYPES`, `cerveau.mjs`) sur un joueur généré ; les notes listées remplacent les siennes.

| Archétype | Les notes | Ce qu'il fait |
|---|---|---|
| artiste (Taarabt, Ben Arfa) | flair 96, dribble 92, technique 90, agilité 88, contrôle 88, accélération 84 ; jeu collectif 48, activité 45, décision 58 | nature 6 (la borne) : le seul à entrer dans le face-à-face planté |
| technicien (Olmo, Iniesta) | technique 91, dribble 88, contrôle 91, agilité 88, vision 86, passe 84, flair 80, sang-froid 86, décision 84 | nature ≈ 4,7 : les gestes en course, pas le spectacle |

Sur la page : `?artiste=0:7`, `?technicien=0:9` (équipe : poste de la formation — 0-3 la défense, 4-6 le milieu, 7 et 9 les côtés, 8 l'avant-centre).

### 2.3 Le face-à-face planté, réservé aux anomalies

`face.mjs`, la porte d'entrée (`FACE.entree.artiste`, `envie`, `zone`) :
- **qui** : le flair ≥ 0,9 (une note ≥ 88) ET la nature ≥ 3 — un défenseur central n'y entre jamais ; un technicien au flair de 80 non plus (il dribble en course) ;
- **l'envie** : de 0,4 (nature 3) à 0,85 (nature 6) ;
- **où** : × 0 à moins de 25 m de son but, × 0,3 dans son tiers, × 0,7 au milieu, × 1 dans le tiers adverse.

Mesuré (`bancs/face-match.mjs`, 20 min, graine 7) : aucune entrée avec les effectifs générés (les fenêtres géométriques, rares en 11 contre 11 — 3 en 20 min —, refusées « hors nature ») ; avec un artiste sur l'ailier gauche, une fenêtre, refusée au tirage. Le face-à-face devient un événement d'anomalie, pas un réflexe de porteur.

## 3. Quand : les fenêtres du cerveau

`cerveau.mjs`, `gesteDuCerveau`, à chaque tick du porteur (avant l'arbitrage passe-tir-conduite, comme dans le pas du cerveau), dans l'ordre de ses « niches du 1c1 » (`skills-sim.js`) :

| Niche | La fenêtre | Le geste |
|---|---|---|
| `maybeDoubleContact` | le défenseur qui SE JETTE de face (rapprochement ≥ 2,2 m/s, ≤ 55°) à 0,9-2,1 m | la croqueta |
| `maybePetitPont` | le glisseur en pas chassés, l'espace libre derrière lui | le petit pont |
| `maybeGrandPontSk` | lancé, le défenseur de face qui s'engage | le grand pont |
| `maybeRoulette` | le poursuivant qui arrive de côté | la roulette |
| `maybeRateau` | la charge de face (≥ 1,5 m/s), la sortie arrière libre | le râteau |
| `maybePassement` | le jockey posté devant, une sortie latérale libre | le passement (ses tours, sa sortie : contre-pied, fixer, temporiser) |
| `maybeFeinteCorps` (adaptateur) | le défenseur de face à 1,1-3 m, le porteur lancé | la feinte de corps |
| `maybeCrochet` | la course fermée devant (rapprochement ≥ 1 m/s), la sortie libre | le crochet : court, standard, chaloupé |

- **Qui les tente** : dribM — le rôle, le lieu (×1,3 sur l'aile, ×0,85 dans l'axe, ×0,5 dans son tiers, ×1,15 dans le tiers adverse, ×0,1 devant son but), la cadence, la nature du spécialiste, la lucidité du grand dribbleur (`dribble-lucide.js`) — × le flair × la technique au carré ou au cube, selon le risque du geste.
- **La feinte de corps** vient du duel (`skills-sim.js` de `feat/1v1-maquette`, `maybeFeinteCorps`) : le cerveau du 11 contre 11 n'a qu'une feinte de PASSE. Elle est portée dans l'adaptateur, sans le plancher d'envie du duel.
- **Les planchers d'appétit levés.** Le cerveau donne au passement et au crochet une envie minimale, quel que soit le joueur (`passements.plancher` 0,35, `decalage.plancher` 0,3) : dans son monde, leurs fenêtres étaient rares. Dans celui du corps elles s'ouvrent souvent, et le plancher faisait dribbler tout le monde. L'adaptateur les met à 0 : l'envie suit dribM.
- **Le volume et la pente, calés sur le réel par poste.** Planchers levés, mesuré sur 3 × 30 min : 186-219 gestes décidés par match, les centraux à 0,5-3,6 par minute de ballon (≈ 7 par match chacun, surtout des râteaux), les ailiers et le 10 à 7,8-10,5. La référence (les dribbles tentés par 90 min dans les grands championnats) : un central 0,3-0,6, un latéral 1-1,5, un milieu 1-2, un ailier ou un 10 4-5, l'élite du dribble 7-10 ; nos gestes comptent aussi ceux qui ne dépassent personne (le râteau qui se retourne, le passement qui fixe) — on vise environ le double. Deux leviers du cerveau, qui ne servent qu'aux gestes : son volume (`dribble.volume` × 0,4, l'option `volumeGestes`) et la pente de la nature (`nature.specialiste.k` 1,6 → 2,2, `penteNature` : le central à 0,28 de la fréquence médiane, l'ailier à 2,5). Après : 72-108 gestes décidés par match, les centraux à 0-1,2 par minute de ballon, les ailiers et le 10 à 4,3-6,5, une anomalie jusqu'à 12.
- **Le monde est prêté** : on lit le geste que le cerveau lance (`c.act` : l'espèce, le pied, la sortie, les tours), puis on l'efface — c'est le corps qui le joue. Ses mémoires restent : les recharges (`c._skillCd`), la cadence du dribble (`c._dribAt`), les refus nommés (`st.deny`).

## 4. Comment : le corps joue

### 4.1 Le studio (`outils/foulee-gpf.mjs`)

Un geste « dans la foulée » du duel n'est pas un clip : ce sont des TEMPS posés sur les vols des pieds d'un joueur qui court (`pas.js`, `gesteFouleeStep`). Le studio rejoue hors ligne, à 100 images/s, ce que le contrôleur du duel (`character-controller.js`) fait image par image :
- **l'horloge de foulée** (`pasStep`) : la phase avance de `strideLaw(v)` × les facteurs de cadence, mesurés sur le déplacement réel du corps ;
- **les temps du geste** : chacun s'arme au décollage de son pied ; `touche` (le pied vise le ballon, `opts.geste.vise`, et le joue aux 85 % de son vol), `arc` (la jambe cercle le ballon, `arcPassement`), `vend` (le pied se pose large, le buste vend — Brault et al. 2010) ;
- **le pied par pied** (`_gesteFouleeOpts`), **l'appui ancré** (`_anchorStance`), **l'inclinaison** (`_applyLean` : le tronc penche dans l'accélération, roule dans le virage — Dos'Santos et al. 2021) ;
- **le corps** : un départ type à l'allure v0 ; la touche de coupe freine (`freinCoupe` : × 0,97 à 45°, × 0,76 à 90°) ; la sortie tourne à accélération latérale bornée (12 m/s²) et relance (τ 0,35 s) ; le regard suit la course.

Puis il cuit le rejeu en animation du corps : une clé toutes les 2 images, la racine dans le repère du départ, le cap dans le bassin, la ligne football (les touches, puis la destination du ballon), `<gfserie>`, `<steps>`, `ballcontrol`, `specialvar1`.

```
node outils/foulee-gpf.mjs crochet 3.5        # le bilan d'un geste (touches, glissement des appuis, allure, cap)
node outils/foulee-gpf.mjs crochet 3.5 x.anim # …et son fichier
node outils/foulee-gpf.mjs tous               # tout le répertoire → gestes/course/
```

### 4.2 Les conventions du corps (mesurées)

- **Le pied courant.** À l'image 0 d'une animation du corps, le pied GAUCHE est posé et le DROIT en vol (mesuré sur ses fichiers : `ballcontrol/walk/000`, `045`, `090_strongfoot`, `movement/walk/045`, `sprint/000`) ; c'est le « pied courant » du fichier (`Animation::currentFoot`, droit). Son miroir, chargé d'office, part du gauche. Le corps trie ses candidates par ce pied (`CompareFootSimilarity`) après la direction. Nos gestes sont donc écrits le pied droit en vol au départ ; `<steps>` compte leurs poses (le corps en tire le pied de sortie).
- **La classe de vitesse d'entrée** se lit sur les deux premières clés de la racine (`Animation::GetIncomingVelocity`). Pour un contrôle (`ballcontrol`), un porteur à l'allure de conduite (1,8-4,2 m/s) cherche la classe de la MARCHE (4,2-6, `humanoid.cpp:1254`), au sens strict ; le corps n'a d'ailleurs aucun contrôle d'entrée « conduite ». La variante à 3,5 m/s recule donc sa première clé de quelques millimètres pour lire ≥ 4,3 m/s. Au sprint (≥ 6 m/s), aucune variante : le corps n'a pas de candidate.
- **La direction de sortie** décide entre le fichier et son miroir (`_KeepBestDirectionAnims` : le quadrant le plus proche de la course voulue) : l'intention GESTE vise un point à 6 m dans la direction de sortie du cerveau.
- **Les touches** : la première est celle du corps (sa triche l'amène au ballon) ; les suivantes sont jouées en série (`patch.py`, étape 14), chacune envoyant le ballon là où le pied de la suivante l'attend ; la dernière entrée est la destination du ballon à la dernière image.
- **La racine est suivie telle quelle** (étape 14) : la foulée et la coupe ne sont pas lissées par la physique du corps.

### 4.3 Le répertoire en course

| Geste | N° (2,5 · 3,5 · 5 m/s) | Les temps | Sortie | Durée |
|---|---|---|---|---|
| crochet court | 200-202 | le pied droit touche de l'intérieur | 52° à gauche | 0,62-0,63 s |
| crochet | 210-212 | le pied droit touche de l'intérieur, le corps freine | 80° à gauche | 0,67-0,68 s |
| crochet chaloupé | 220-222 | le pied droit vend (posé large), le gauche coupe de l'extérieur | 90° à gauche | 0,87-0,91 s |
| crochet de l'extérieur | 230-232 | le pied droit pousse de l'extérieur | 60° à droite | 0,62-0,63 s |
| croqueta | 240-242 | l'intérieur droit passe le ballon au gauche, qui le pousse | 26° à gauche | 0,92-0,98 s |
| feinte de corps | 250-252 | le pied droit vend, le gauche pousse de l'extérieur | 40° à gauche | 0,82-0,87 s |
| passement | 260-262 | la jambe droite cercle le ballon, le gauche le pousse de l'extérieur | 52° à gauche | 0,82-0,87 s |
| grand pont | 270-272 | l'extérieur droit pousse le ballon à droite (14°, plus vite que lui) ; le corps contourne à gauche (−26°, 0,42 s), puis revient chercher son ballon (+25°) en accélérant jusqu'au sprint | finit à 25° à droite | 1,17-1,18 s |
| petit pont | 280-282 | l'intérieur droit pousse droit devant, entre les jambes ; le corps s'écarte à gauche (−32°), puis revient sur la ligne derrière le défenseur (+22°) | finit à 22° à droite | 1,02-1,03 s |
| passement à l'arrêt | 106-109 | le passement planté du face-à-face (1 à 4 tours), sans touche | — | 0,66-1,68 s |
| croqueta, râteau à l'arrêt | 115, 116 | la croqueta du face-à-face, le râteau du duel | — | 0,36 s, 0,7 s |

Le miroir de chaque fichier fait l'autre pied et l'autre côté. Les trois allures : 2,5 m/s (le porteur qui ralentit devant un défenseur posté — le cerveau y décide ses passements ; la variante à 3,5 y touchait trop loin devant : 0 passement parti sur 35), 3,5 (la conduite du corps) et 5 (sa marche). Le premier temps qui touche part aux 35 % du vol de son pied (sa touche vers l'image 22 : la triche du corps y a presque toute sa portée) ; celui qui vend ou cercle, aux 60 % (la touche vers l'image 45). Le grand pont et le petit pont suivent un **chemin du corps** après leur touche (`corps` : des segments de direction et d'allure) ; leur sortie, pour le choix du fichier ou de son miroir, est la direction FINALE de la course — le cerveau la demande vers le ballon poussé (le grand pont) ou du côté opposé à son contournement (le petit pont).

Le studio mesure chaque geste sur notre squelette : le cou-de-pied rejoint le ballon visé (4 cm dans sa peau) à 16-17 cm du sol ; les appuis glissent de 0,1 à 1,9 cm au p90 (le duel tient 2,9 cm). Côté corps (le fichier relu, sa FK) : la cheville à 16 cm du ballon à la touche de l'intérieur, 22 cm à celle de l'extérieur ; l'entrée lue en classe marche.

### 4.4 La vie d'un geste (`gestes-course.mjs`)

1. **La demande** : le cerveau a décidé ; l'animation de son espèce, à la variante de l'allure du porteur (à l'arrêt sous 1,8 m/s — le passement, la croqueta, le râteau plantés —, 2,5 sous 3, 3,5 sous 4,2, 5 au-delà ; rien au sprint) ; la direction de sortie (celle du geste ; pour les ponts, la direction finale de la course) ; l'intention GESTE (le point de sortie, l'allure, le n°) tenue au plus 0,7 s. Le corps la lance quand la touche est à sa portée.
2. **Jusqu'à la touche** : l'intention tenue (un contrôle dont la touche n'a pas eu lieu est coupé par une intention qui change). Un geste sans touche (le passement planté) est tenu jusqu'à un tick de sa fin.
3. **La sortie** : la conduite vers la sortie du geste, à son allure, jusqu'à sa fin (+ 0,2 s).
4. **La fin** : un autre joueur touche le ballon, le porteur passe, ou le geste est fini ; la suite (le ballon gardé) se juge 1,5 s plus tard.

### 4.5 La morsure du défenseur

Dans le monde du cerveau, une feinte réussie fait mordre le défenseur : il s'engage du côté vendu, le temps que le geste lui coûte. Sans cela, le défenseur du corps suivait son placement et ses réflexes, et une feinte ne valait que par sa géométrie.
- **Le contact se juge par le noyau de duel du cerveau** (`noyau.js`, `noyauAuContact`), à la première touche du geste (le journal : `GF_EV_SERIE` de rang 0), sur le monde prêté : les attributs du porteur (le dribble, l'agilité, le flair…) contre ceux du défenseur visé, la géométrie ; huit issues, « franchi » dans 59 % des cas pour deux joueurs moyens (le book du moteur). Les gestes qu'il ne connaît pas (la feinte de corps, le grand pont) sont jugés comme un passement.
- **Franchi, le défenseur mord** le temps que le cerveau donne au geste (`skillContactNow`) : la croqueta 0,55 s, le passement et le crochet 0,6 s au moins, le petit pont 0,7, le grand pont 0,55, la roulette 0,3, la feinte de corps 0,5 (la loi du duel) — × la technique du porteur. Il part sur la ligne que le porteur a quittée (3 m devant, sur sa course d'entrée), sans réflexes de duel (ALLER au drapeau 1, la garde du face-à-face).
- **Les autres issues** (la dépossession, la faute) restent au corps : c'est lui qui joue les contacts.
- **Mesuré** (3 graines × 30 min, A/B) : 23 défenseurs franchis sur 30 contacts ; le ballon gardé 1,5 s après le geste 25 fois sur 40 avec la morsure, 21 sur 40 sans ; les touches adverses pendant le geste, 17 contre 21. L'option `gestesMorsure: false` l'éteint.

## 5. Mesures

### 5.1 Qui dribble (`bancs/gestes-match.mjs`, 30 min, graines 7 et 11, effectifs générés)

| Poste | Gestes décidés par minute de ballon | Par demi-heure |
|---|---|---|
| centraux | 0-0,5 | 0 ou 1 pour les quatre |
| latéraux | 0,4-2,9 | 1-6 |
| milieux | 1,4-4,0 | 5-14 |
| ailiers et le 10 | 2,8-6,1 | 9-16 |
| avant-centre | 0-2,8 | 0-2 |

- 63-87 gestes décidés par match (186-219 avant le calage du volume et de la pente).
- Les archétypes (graine 7) : l'artiste sur l'ailier gauche, 6 gestes en 69 s de ballon (roulette, passements, croqueta, râteau, grand pont) ; le technicien sur l'ailier droit, 6 en 39 s (crochets court, standard et chaloupé, feinte de corps, petits ponts, grand pont) ; une anomalie naturelle (un ailier à 96 de flair, nature 5,3) jusqu'à 11,9 par minute de ballon.

### 5.2 Le corps les joue (en match, les décisions du cerveau ; 4 × 30 min)

- **Partis** : 72-81 % des gestes demandés (57 sur 76), dans les 0,7 s — une demande tenue 1,1 s n'en fait pas partir plus (74 % contre 76 %).
- **Le ballon gardé** 1,5 s après : 34 sur 57 (60 %), l'ordre d'un dribble réussi au réel (45-55 % pour l'élite) — mesuré avant la morsure ; avec elle, 62 % contre 52 % sur les mêmes graines (§ 4.5).
- **Par geste** (4 matchs) : le passement part 18 fois sur 18, ballon gardé 14 fois ; la croqueta 5 sur 6, gardé 5 ; le crochet chaloupé 9 sur 12, gardé 5 ; le crochet court 4 sur 6, gardé 3 ; la feinte de corps 4 sur 5, gardé 2. Les ponts partent (grand pont 4 sur 5, petit pont 4 sur 8) mais ne gardaient pas le ballon (0 sur 8) : la poussée du grand pont frôlait le défenseur (14° : 0,6 m de lui à 2,5 m devant) — ouverte à 24° depuis, à remesurer.
- **Demandés au hasard** à des porteurs lancés (`bancs/course-essai.mjs`, hors des fenêtres du cerveau) : 50-60 % partent ; après un contrôle ou un amorti, 66-95 % ; pendant une passe ou une intervention, aucun. La seconde touche de la croqueta tombe à 3-4 cm de l'attendu.

### 5.3 Le match autour (`bancs/serie.mjs`, série courte : 8 graines × 20 min, ramenée à 90 min)

| Variante | Buts | Buts/xG | Tirs | Fautes | Jaunes | Pén. | Passes réussies | Buts sur passe |
|---|---|---|---|---|---|---|---|---|
| sans effectif, sans geste (le monde d'avant) | 5,6 | 1,84 | 25,9 | 17,4 | 4,5 | 0 | 78 % | 40 % |
| effectifs notés, sans geste | 5,1 | 1,18 | 28,7 | 24,8 | 3,9 | 0 | 77 % | 67 % |
| effectifs notés, gestes en course (défaut) | 5,6 | 1,66 | 30,9 | 25,3 | 5,1 | 0,6 | 79 % | 80 % |

- **Les attributs pèsent** : avec les effectifs notés, les fautes passent de 17,4 à 24,8 par match (le tacle, l'agressivité des défenseurs), les tirs de 25,9 à 28,7. Les buts restent dans le bruit d'une série courte (≈ 1 but par match).
- **Les gestes** ne changent le match qu'au bord du bruit : 0,5 but et 1,2 jaune de plus (le geste raté se paie d'une faute, parfois). Comme décidé le 2 octobre, rien n'est réglé sur les résultats tant que le moteur n'est pas définitif : ces chiffres sont consignés, pas corrigés.
- La page joue le même match que les bancs au bit près, gestes en course compris (graine 11, 15 999 pas).

## 6. Ce qui manque

- **La morsure** (§ 4.5) n'envoie le mordu que sur la ligne quittée par le porteur ; le côté vendu d'une feinte de corps (la jambe posée large) mériterait sa propre direction, et la dépossession ou la faute du noyau pourraient être rendues au corps.
- **Le râteau et la roulette lancés** : décidés 2 à 7 fois par demi-heure (le râteau surtout : son poids × 8 chez le cerveau), joués seulement à l'arrêt. Ce ne sont pas des temps de foulée : il faudra fondre les clips du duel (`rouletteCourse`, `rateau`) dans la course.
- **Le sprint** (≥ 6 m/s) : aucune variante — le corps n'aurait pas de candidate.
- **Le pied** : chaque côté se joue d'un seul fichier (ou de son miroir) ; à contre-pied du porteur, le corps fond le départ. Les crochets de l'intérieur et de l'extérieur pourraient partager leur n° pour que le corps prenne celui du bon pied (son tri par pied courant).
- **Les ponts** : ils partent, ils ne gardaient pas le ballon — à remesurer avec la poussée élargie.
- **Les attributs du corps** (`gf_set_stat` : agilité, dribble, contrôle) : le technicien a encore le corps de tout le monde (`attributs.md` § 4.2).
- **Les effectifs de la carrière** (lot L3) remplaceront les générés.
- **Une vitrine** : chaque geste joué seul, au ralenti, pour le juger hors du match.

## 7. Maintenir

- **Ajouter un geste en course** :
  1. ses temps dans `COURSE` (`outils/foulee-gpf.mjs`) — écrit le pied droit en vol au départ ; il prend ses numéros dans `NUMEROS` ;
  2. `node outils/foulee-gpf.mjs <geste> 3.5` jusqu'à un bilan propre (le cou-de-pied au ballon, les appuis), puis `tous` ;
  3. sa ligne dans `COURSE` de `gestes-course.mjs` (n°, sortie, durée) et sa règle dans `animationPour` ;
  4. `./data.sh && ./build.sh` (le paquet du corps : `gestes/course/` y entre), `./empaqueter.sh` (le cerveau empaqueté) ;
  5. les bancs : `bancs/course-essai.mjs <geste>` (part-il, ses touches, le ballon gardé), `bancs/gestes-match.mjs` (qui, combien).
- **Les gardes** : le corps seul au bit près (`l2-intents-off`, h = 1616609301 : les animations ajoutées ne sont jamais choisies sans leur `specialvar1`) ; le paquet contre les sources (`bancs/paquet.mjs`) ; la page contre les bancs.
- **Les modules du duel** (`motion-gait.js`, `gait.js`, `motion-rig.js`) sont lus dans le dépôt du duel (`STARTER`, en lecture). Le cuit est reproductible : `gestes/course/` se régénère de ses sources.
