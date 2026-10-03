# Le moteur — référence du cerveau de match (skill three.js AAA, 11 contre 11)

Date : 2026-10-02. Lecture seule du code : rien n'a été exécuté (ni build, ni banc, ni script, ni git).

**Pour qui.** Pour le développeur qui devra faire appeler à l'adaptateur L2 une plus grande part de ce moteur. Le document dit ce que fait chaque partie, où elle vit dans le code, et ce que L2 en fait aujourd'hui.

**Conventions.**
- Le moteur vit dans `~/DelkIT/skill-l2/skills/threejs-aaa/assets/starter/src/engine/`. Ses fichiers sont cités par leur nom seul : `match-sim.js:79` veut dire « fichier match-sim.js, ligne 79 ».
- L'adaptateur est `~/DelkIT/skill-l2/gpf-wasm/cerveau.mjs`, cité `cerveau.mjs:245`. Il a son propre document : [adaptateur.md](adaptateur.md).
- La branche duel est `~/DelkIT/skill-1v1/skills/threejs-aaa/assets/starter/src/engine/` (branche `feat/1v1-maquette`). Ses fichiers sont cités avec le préfixe « (1v1) », par exemple (1v1) `face.js:184`.
- Les 155 gestes du moteur, leurs déclencheurs et ce que L2 en décide : [inventaire-moteur.md](../inventaire-moteur.md). Les animations du corps : [animations.md](../animations.md). Ces deux fichiers sont dans `~/DelkIT/skill-l2/gpf-wasm/` ; les liens supposent ce dossier `docs/` posé dans `gpf-wasm/`.
- « non vérifié » marque ce que j'ai déduit sans le lire ligne à ligne.
- Deux mots reviennent partout. Une **image** est un pas physique de la simulation (1/60 s). Un **tick** est un pas de décision du cerveau (0,1 s).

## Sommaire

1. [En bref](#1-en-bref)
2. [Le monde (`st`)](#2-le-monde-st) — makeMatch, le repère, le joueur, le ballon, la possession, la passe en vol, les remises, les journaux, la mémoire entre deux ticks
3. [La configuration (`cfg`)](#3-la-configuration-cfg) — les trois couches, la règle « clé absente = hier au bit », les crochets, les clés de base, les clés que L2 surcharge
4. [Le pas du match](#4-le-pas-du-match) — deux horloges, `matchStep`, `rondoStep`, `assignMatchJobs`, le bloc du porteur, la réception, l'horloge des gestes
5. [Les décisions, module par module](#5-les-décisions-module-par-module) — métiers, placement, porteur, première intention, jeu aérien, dribbles, duels, gardien, Loi 12, remises, tir
6. [Les joueurs](#6-les-joueurs) — attributs, profil au poste, persona, rôles, tactique, ce que L2 en a
7. [Le hasard et le déterminisme](#7-le-hasard-et-le-déterminisme)
8. [Le face-à-face Taarabt (branche duel)](#8-le-face-à-face-taarabt-branche-duel)
9. [Ce que L2 appelle et ce qu'il n'appelle pas](#9-ce-que-l2-appelle-et-ce-quil-nappelle-pas)

## 1. En bref

- Le moteur est une simulation de football en JavaScript pur, sans rendu : un match de 11 contre 11 sur un terrain de 105 × 68 m.
- C'est la boucle d'un **rondo** (le jeu de passes à dix, `rondo-sim.js`), configurée en match par des **crochets** : des fonctions branchées dans la configuration (`matchCfg`, `match-sim.js:1198`).
- Il a son propre monde, l'objet `st` : joueurs, ballon, possession, journal. `makeMatch` le construit (`match-sim.js:17`).
- Il avance par `matchStep(st, dt, cfg)` (`match-sim.js:1214`) : le corps et le ballon à chaque image, le cerveau à chaque tick. Tout son hasard est seedé : même graine, même match.
- L2 ne fait pas tourner ce match. Toutes les 100 ms, l'adaptateur recopie le monde de Gameplay Football (GPF, « le corps ») dans `st`, appelle quelques fonctions de décision, lit leurs résultats et les rend au corps sous forme d'intentions (`cerveau.mjs:1-13`).
- Il n'appelle jamais `matchStep` ni `rondoStep`. Ce que le moteur fait bouger dans son monde est jeté au tick suivant, qui repart du monde GPF.
- Tout ce qui ne vit que dans ces deux pas (gestes, dribbles, réception, tacles joués, arbitre incarné, jeu arrêté) n'existe donc pas dans L2 (§9).

## 2. Le monde (`st`)

### 2.1 Ce que construit `makeMatch`

`makeMatch({ perTeam, seed, pitch, full, squads, tactics, roles })` (`match-sim.js:17-73`), dans l'ordre :

1. **Le terrain.** `makePitch(FULL)` si `full` : 105 × 68 m (`pitch.js:16`). Sinon le format réduit 46 × 30 m (`pitch.js:25`). `full` passe aussi `perTeam` de 5 à 10.
2. **L'état de base.** `makeRondo` (`rondo.js:33`) crée 2 × 11 joueurs, le ballon, la possession et le journal. Les ids vont de 0 à 10 (équipe 0) et de 11 à 21 (équipe 1).
3. **Le plein format.** `st.full = true` dès que le terrain dépasse 60 m (`match-sim.js:21`). C'est l'interrupteur de presque toutes les lois de match (§3.2).
4. **La graine** (`st.seed`) et un second générateur `st.rnd2` (`match-sim.js:23`).
5. **La tactique** des deux équipes, résolue par `resoudreTactique` (`match-sim.js:24`, `tactics.js:75`). Absente, c'est « équilibre » : 0,5 sur tous les axes.
6. **Le poste** de chaque joueur (`q.post`, son index dans la formation), puis **son rôle** s'il en a un (`match-sim.js:26-31`).
7. **Le pied fort**, tiré d'un hachage de la graine et de l'id : 72 % droit, 23 % gauche, 5 % les deux (`match-sim.js:33-36`).
8. **Les effectifs notés**, seulement si `squads` est fourni : `q.skill = makeProfile(ratings)` (`match-sim.js:38-55`). Sans `squads`, aucun joueur n'a de `skill`.
9. **Les gardiens.** Le dernier joueur de chaque équipe devient gardien, `q.keeper = true` (`match-sim.js:60-66`).
10. **L'engagement.** Les joueurs sont posés dans leur moitié et une remise `engagement` est créée (`match-sim.js:68-71`).

L2 appelle `makeMatch({ full: true, seed: graine, tactics })` (`cerveau.mjs:50`). Pas de `squads` : aucun attribut (§6.6).

### 2.2 Le repère et le terrain

- `x` court le long du terrain (buts à ±52,5 m), `z` en travers (±34 m), `y` vers le haut.
- Une position est un triplet `[x, y, z]`. La vitesse d'un joueur est une paire `[vx, vz]`.
- L'équipe 0 attaque vers +x. On lit toujours les côtés par `pitch.attackGoal(team)` et `pitch.ownGoal(team)` (`pitch.js:56-58`) : elles suivent l'échange de camps.
- `pitch.inBox(x, z, sign)` dit si un point est dans une surface de réparation (`pitch.js:48`). `pitch.hx` et `pitch.hz` sont les demi-dimensions.
- Le repère GPF est différent : x ±55 m, y ±36 m en travers, z en haut. L'adaptateur passe de l'un à l'autre par une mise à l'échelle et `z = −y` (`cerveau.mjs:15-17`, `:80-82`).

### 2.3 Le joueur

| champ | sens | écrit par | lu par |
|---|---|---|---|
| `id`, `team` | identité, équipe 0 ou 1 | `makeRondo` | partout |
| `p` | position `[x, 0, z]` | `movePlayers` ; dans L2 : `preter` (`cerveau.mjs:169`) | partout |
| `v`, `speed` | vitesse `[vx, vz]` et sa norme | `movePlayers` ; L2 (`cerveau.mjs:170-171`) | duels, choix, prédictions |
| `yaw`, `yawWant` | cap du corps (radians), cap voulu | `movePlayers` (rotation bornée) ; L2 (`cerveau.mjs:172`) | passe « dans le corps », duels |
| `job` | le **métier** du moment (§5.1) | `assignMatchJobs` | `movePlayers` (vitesse par métier) |
| `target` | le point visé `[x, 0, z]` | `assignMatchJobs`, couches de `movePlayers` | `movePlayers` ; L2 l'envoie au corps |
| `_wx`, `_wz` | la vitesse voulue vers la cible, lissée | `movePlayers` (`movement.js:399-404`) | L2 (`cerveau.mjs:277`) |
| `push` | la direction où le porteur pousse son ballon | `assignMatchJobs` (`match-sim.js:509`) | la conduite ; L2 (`cerveau.mjs:540`) |
| `act` | le **geste** en cours (§4.7) | `startGesture` (`gesture.js:46`) | `busy()` : un geste « possède » le joueur |
| `intent` | l'intention de passe adoptée `{ choice, until }` | `rondo-sim.js:970` | `beginPass` |
| `down` | secondes au sol ; 9e9 = expulsé | chutes, tacles ; L2 (`cerveau.mjs:177-179`) | une trentaine de filtres `down <= 0` |
| `keeper`, `post`, `role` | gardien, poste, rôle | `makeMatch` | `assignMatchJobs`, `roles.js` |
| `skill`, `ratings` | facteurs d'attributs, notes brutes | `makeMatch` (si `squads`) | §6.1 |
| `persona` | identité de mouvement seedée | `makePersona` (`persona.js:25`) | §6.3 |
| `strongFoot`, `foot` | pied fort, pied du geste en cours | `makeMatch`, gestes | technique, finition |
| `_pace` | la **rupture de rythme** en cours : appel, chasse, attaque… | `movement.js:176-208`, `match-sim.js` | vitesse (× 1,28), choix de passe |
| `stam` | l'endurance restante, de 0 à 1 | `movement.js:471-479` | plafond de vitesse, finition |
| `tackleCd`, `slideCd`, `_skillCd`, `_accCd` | les recharges (temps avant de retenter) | duels, gestes | les portes des duels et gestes |
| `_bite` | « mordu » par une feinte jusqu'à cet instant | feintes, duels | `movement.js:169` (vitesse × 0,35) |
| `_slotT`, `_markT` | la cible de poste et de marquage tenue | `assignMatchJobs` | l'hystérésis du placement |
| `expulse`, `_sub` | expulsé (Loi 12), remplacé (Loi 3) | `referee.js` | filtres |

### 2.4 Le ballon (`BallBody`)

- `st.ball` est un objet `BallBody` (`ball-body.js:69`). Sa position est en lecture seule : écrire `ball.p` lève une erreur (`ball-body.js:64`).
- On le déplace par des verbes : `impulse`, `strike`, `escort`, `integrate`, `carry`, `hold`, `rest`. Une remise en jeu passe par `restart(to, { cause })`, avec une cause nommée (`ball-body.js:122-255`).
- Il a un propriétaire, `owner` : `possess(id)` le donne, `release(cause)` le lâche (`ball-body.js:93-104`). **Porté**, il converge vers le point du pied du porteur ; **en conduite**, il est libre entre deux touches.
- L2 recrée un `BallBody` neuf à chaque tick depuis le ballon GPF (`cerveau.mjs:182`) et le donne au porteur déclaré par le corps (`:189`).

### 2.5 Possession et phase

- `st.possession = { team, carrier }` ; `carrier = -1` quand personne n'a le ballon. `st.phase` vaut `'carry'` (un porteur), `'flight'` (une passe en vol) ou `'loose'` (ballon libre).
- `st.hold` : depuis combien de temps le porteur tient le ballon. `st.pressure` : le temps de pression accumulé sur lui (§5.7).
- `st.lastTouch` (une équipe) et `st.lastPasser` (un joueur) : le dernier contact, lu par les Lois 9 à 17. L2 pose tous ces champs depuis l'état et le journal du corps (`cerveau.mjs:184-204`).

### 2.6 La passe en vol (`st.pass`)

Elle est écrite au contact de la frappe (`strike-sim.js:665`) ou par la une-touche (`premiere-intention.js:142`) :
`{ from, to, lead, style, t, flight, origin, cross?, through?, error }`.

- `lead` est la **mène** : le point de rendez-vous visé, en avant du receveur. `flight` est la durée de vol prévue ; `origin` le point de départ `[x, z]`.
- `style` vaut `'ground'`, `'driven'`, `'lofted'`, `'chip'`, `'une-touche'` ou `'touche'`. `to = -2` désigne un dégagement vers une zone (`shooting.js:351`).
- Le receveur « attaque sa passe » en lisant `st.pass` (`match-sim.js:533-637`). La défense aussi : le presseur peut courir au point de chute (`match-sim.js:938`).
- L2 reconstruit une `st.pass` depuis le journal GPF (`volDuCerveau`, `cerveau.mjs:147-161`). Sans elle, le receveur voyait un ballon libre et rentrait à son poste.

### 2.7 Les remises, la faute, le sifflet

- `st.restart = { type, p, team, at, placed, taker, … }` : une remise en attente (`engagement`, `touche`, `corner`, `sortie-de-but`, `coup-franc`, `penalty`, `fin`). Tant qu'elle existe, `assignMatchJobs` joue la branche des remises (§5.10).
- `st._faute = { t, par, sur, team, p, kind, grave?, arrache? }` : une faute posée, pas encore jugée (§5.9). `st._whistle` : un hors-jeu sifflé, administré à l'image suivante (`rondo-sim.js:236-239`).
- L2 efface `st.restart` et `st._whistle` à chaque tick (`cerveau.mjs:205`) : le jeu arrêté appartient au corps.

### 2.8 Les journaux

- `st.events` : tout ce qui arrive, sous la forme `{ t, type, by, … }`. Types fréquents : `pass`, `receive`, `control`, `shot`, `arrêt`, `dive`, `windup`, `skill`, `duel`, `slide`, `tacle-pique`, `faute`, `carton`, `avantage`, `sortie`, `but`, `hors-jeu`, `press`, `burst`, `arbitre`, `chute`, `contre`, `moment`.
- `st.deny` : les **refus nommés**, comptés par cause (`rondo-sim.js:28`). C'est le premier chiffre à lire quand un comportement disparaît. L2 les expose à ses bancs (`cerveau.mjs:326`).
- `st.gestures` : le journal des gestes (début, contact, fin, interruption ; `gesture.js:46-93`).

### 2.9 Ce qui survit d'un tick à l'autre dans L2

- `preter` (`cerveau.mjs:164-214`) réécrit : le temps ; `p`, `v`, `speed`, `yaw`, `down` des joueurs ; le ballon ; la possession, la phase, `hold` ; `st.pass` ; `lastTouch` ; `st.restart`, `st._whistle` ; `st.laneVeto` ; `st._flux` ; `st._decide`.
- Tout le reste persiste sur les joueurs et sur `st` : les cibles tenues (`_slotT`, `_markT`), les recharges, `_pace`, la fenêtre de pressing `st._press`, les ancres lentes, `act`, le journal.
- C'est voulu : les hystérésis du moteur (tenir une cible 0,7 à 1,6 s) ont besoin de cette mémoire. C'est aussi un piège : un `act` posé par une fonction appelée ne s'efface jamais, faute de `stepGestures` (inventaire-moteur.md §9, observation 5).

## 3. La configuration (`cfg`)

### 3.1 Trois couches

1. **`RONDO`** (`rondo-config.js`) : les constantes du jeu de passes (rayons de contrôle, tenue, tacle, vitesses).
2. **`MATCH`** (`match-config.js:7`) : `...RONDO`, puis les clés du match. Le fichier fait 200 Ko, surtout des commentaires : chaque clé est une loi, avec sa mesure et son histoire. Environ 250 lignes commencent par une clé de premier niveau, et quelques lignes très longues en portent des dizaines d'autres (`match-config.js:801`, `:837`).
3. **`matchCfg(overrides)`** (`match-sim.js:1198-1211`) : `MATCH`, plus les crochets du match, plus les surcharges de l'appelant.

### 3.2 La règle : « clé absente = hier au bit »

- Presque toutes les lois de match s'écrivent `if (st.full && cfg.cle) …`. Clé absente ou `null` : le code d'avant cette loi s'exécute, identique au bit près. Les commentaires le disent ainsi : « Clé absente : hier au bit ».
- `false` sur une clé allumée par défaut est un **sabotage nommé** : on éteint la loi pour la mesurer (exemple : `cfg.jockey === false`, `duel.js:288`).
- Les sous-clés ont leur valeur par défaut dans le code (`cfg.uneTouche.vmax ?? 9.5`) : une sous-clé absente ne casse rien. `st.full` protège le plein format : le rondo et le format réduit ne voient pas ces lois.
- Pour trouver une clé : `grep -n "nomDeClé:" match-config.js`, puis lire son commentaire. Piège : une clé peut être écrite deux fois dans l'objet ; en JavaScript, la dernière gagne. Exemple : `interception` à `match-config.js:363` puis à `:802`. Conséquence exacte : non vérifié.

### 3.3 Les crochets de `matchCfg`

| crochet | fonction branchée | rôle |
|---|---|---|
| `assignJobs` | `assignMatchJobs` (`match-sim.js:79`) | le cerveau de placement (§4.4) |
| `avantMouvement` | `piegeApply` (`piege.js`) | la ligne de hors-jeu qui monte ensemble, avant le mouvement |
| `tryShot`, `tryCross`, `tryClear` | `shooting.js:21`, `:208`, `:292` | le tir, le centre, le dégagement |
| `onOut` | `referee.js:507` | les sorties de balle et les buts |
| `onDive`, `onDiveEnd` | `match-sim.js:1138`, `:1206` | le contact du plongeon, puis son prix (le relevé) |
| `canTake`, `onTake` | `referee.js:638`, `:1036` | qui peut prendre une remise, et comment |
| `passBias` | `match-sim.js:1192` | le sens du jeu dans le choix de passe |
| `ballFetch`, `elanNow` | `referee.js:958`, `referee.js` | le preneur porte le ballon au point de remise ; la course d'élan |
| `heldBall` | `keeper.js:486` | le ballon tenu aux gants pendant le relevé |
| `accrocheMod` | `match-sim.js:1202` | l'accrochage modulé par l'axe pressing de l'équipe qui défend |
| `decide` (absent par défaut) | — | remplace en entier l'arbitre du porteur (`menace.js:9-10`, `rondo-sim.js:871`) |

`cfg.decide` est le point d'injection prévu pour « amener son propre cerveau » en gardant l'exécution du moteur. Il ne sert que dans `rondoStep`, donc pas dans L2.

### 3.4 Les clés de base à connaître

| clé | valeur | sens | où |
|---|---|---|---|
| `cadence` | `{ dec: 0.1 }` | le cerveau décide toutes les 0,1 s | `match-config.js:827` |
| `flux` | `true` | les tirages nommés (§7) | `match-config.js:810` |
| `holdMin`, `holdMax` | 0,4 s ; 3,0 s | tenue minimale ; au-delà, passe forcée | `rondo-config.js:32`, `:46` |
| `tenueCalme` | `{ plafond: 2.5, calm: [1.2, 3.0] }` | la tenue délibérée au calme | `match-config.js:235` |
| `calmFoe` | 1,8 m | au-delà, le porteur est « au calme » | `match-config.js:1247` |
| `intentBarCalm` | 4,8 | la barre de score pour adopter une passe au calme (3,2 pressé) | `match-config.js:1219` |
| `intentTtl`, `windupBudget` | 0,9 s ; 0,55 s | durée de vie d'une intention ; budget d'armé | `rondo-config.js:164`, `:155` |
| `contestRadius`, `shieldSlack`, `receiveRadius` | 0,9 ; 0,15 ; 0,85 m | portée de jeu ; avance à prendre sur le porteur ; rayon de prise | `rondo-config.js:171`, `:123`, `:26` |
| `tackleTime`, `standCooldown`, `tacleVif` | 0,9 s ; 1,5 s ; `{}` | l'horloge du tacle debout (× 0,25 sous `tacleVif`) | `rondo-config.js:24-25`, `match-config.js:518` |
| `speeds` | press 6,6 ; support 4,9 ; carry 4,2 ; chase 6,4 ; mark 5,6 ; keeper 6,4 ; walk 2,6 m/s | la vitesse de pointe par métier | `match-config.js:1238` |
| `menace` | `{ tir 1, centre 1, passe 1, conduite 1, grise 1.35, muteD 10, mur 0.35 }` | poids et seuils de l'arbitre du porteur | `match-config.js:788` |
| `choix` | `{ centreP: 0.4 }` | allume le choix en valeur attendue (§5.3) | `match-config.js:174` |
| `selection` | `{ bloc 0.06, p0 0.8, poids 2, calage {…} }` | la réussite prédite des passes | `match-config.js:801` |
| `loi12` | `{ avantage 1.8, contact 0.9, mur 9.15, jaune 2, murTrot 1.6 }` | fautes, avantage, mur | `match-config.js:60` |
| `chrono`, `loi3` | `null` ; `{ changements: 5 }` | durée du match ; remplacements | `match-config.js:780`, `:734` |

### 3.5 Les clés que L2 surcharge

| clé | défaut | dans L2 | pourquoi | ligne |
|---|---|---|---|---|
| `chrono` | `null` | `null` | le temps appartient au corps | `cerveau.mjs:53` |
| `loi3` | `{ changements: 5 }` | `null` | les remplacements appartiennent au corps | `cerveau.mjs:53` |
| `uneTouche.vmax` | 9,5 m/s | 15 m/s | les passes du corps arrivent à 9,5-15 m/s ; sa propre IA y joue en une touche | `cerveau.mjs:54-58` |
| `jockey.cap` | 2,9 m/s | inchangé (option `jockeyCap`, à l'essai) | les porteurs du corps conduisent à 3,3-3,8 m/s | `cerveau.mjs:59-60` |
| `accrocheMod` | axe pressing × [0,7 ; 1,3] | × (17 / 35,9) × 1,7 | ≈ 17 accrochages par match mesurés dans le monde du corps | `cerveau.mjs:61-66` |
| `retenueSurface.accro` | 0,4 | 0,4 × 0,27 | 1 penalty par match mesuré, pour ≈ 0,27 au réel | `cerveau.mjs:67-70` |
| `selection.bloc` | 0,06 | 0,45 | la passe sous pression réussit moins chez le corps (65 % pour 80 % prévus) | `cerveau.mjs:71-77` |
| `selection.calage` | ex. BACK_SAFE [1,77 ; 0,4] | 6 classes recalées, ex. BACK_SAFE [1,731 ; 1,265] | ajusté sur les issues des passes du corps | `cerveau.mjs:77-79` |

L2 pose aussi un état, pas une clé : `st.laneVeto` ferme les lignes vers les gardiens (`cerveau.mjs:103-107`, `:141`, `:208`).

## 4. Le pas du match

### 4.1 Deux horloges

- **Le pas physique** est le `dt` de l'appelant, 1/60 s en pratique (`playMatch`, `match-sim.js:1229`).
- **Le pas de décision** vaut `cfg.cadence.dec` = 0,1 s. `pasDecision` accumule le temps et rend vrai toutes les 0,1 s (`cadence.js:32-39`). `rondoStep` le range dans `st._decide` (`rondo-sim.js:517`).
- Quand `st._decide` est faux, `assignMatchJobs` rend la main après l'administration, les remises et les gardiens (`match-sim.js:414`). Le corps, le ballon, les gestes, l'arbitre et le gardien vivent à chaque image ; le cerveau de champ ne parle qu'au tick. Ses constantes de temps se disent en secondes grâce à `hzDecision` (`cadence.js:42`).
- L2 appelle le cerveau toutes les 100 ms et force `st._decide = true` (`cerveau.mjs:213`). Chacun de ses appels est donc un tick.

### 4.2 `matchStep` (`match-sim.js:1214-1226`)

| ordre | couche | ce qu'elle fait | dans L2 ? |
|---|---|---|---|
| 1 | arme `st._flux` | la graine, le tick physique, les compteurs à zéro (§7) | oui, copié (`cerveau.mjs:212`) |
| 2 | `bordFiletStep` | le filet et les panneaux, comme matériaux | non |
| 3 | `lastTouch` | le dernier contact d'équipe (`:1217-1218`) | posé depuis le journal (`cerveau.mjs:204`) |
| 4 | `croyanceStep` | chaque joueur observe le monde et tient une croyance de chacun (`croyance.js:104`) | non |
| 5 | `familiariteStep` | l'automatisme collectif, la synchronie de la ligne (`familiarite.js`) | non |
| 6 | `horsJeuTente` | le hors-jeu sifflé à la tentative (`offside.js:90`) | non |
| 7 | `piegeStep` | la ligne de hors-jeu qui monte ensemble (`piege.js`) | non |
| 8 | `contreEngage`, `contreTir` | le défenseur se jette sur la ligne de tir ; un corps contre la frappe (`duel.js:387`, `:421`) | non |
| 9 | `jambeTendue` | le receveur touche la passe qui allait le dépasser (`duel.js:469`) | non |
| 10 | `arbitreStep` | l'arbitre incarné, ses gestes, les assistants, le mur (`referee.js:1057`) | non |
| 11 | `rondoStep` | tout le reste (§4.3) | non |

### 4.3 `rondoStep` (`rondo-sim.js:515-1074`)

| ordre | étape | lignes |
|---|---|---|
| 1 | `st.t += dt` ; le tick de décision ; `cfg.assignJobs`, c'est-à-dire `assignMatchJobs` | 516-517 |
| 2 | la latence de perception : après une surprise, l'adversaire garde son ancienne cible le temps de sa réaction | 522-538 |
| 3 | `cfg.avantMouvement` (`piegeApply`), l'interception non omnisciente, puis `movePlayers` | 539 |
| 4 | `slideResolve`, `resolveSlideL` : le contact des tacles glissés | 540-541 |
| 5 | `stepGestures` : l'horloge de tous les gestes (§4.7) | 542 |
| 6 | `separatePlayers` : les corps ne s'interpénètrent pas | 544 |
| 7 | la mesure du contrôle, quand le ballon est vraiment arrivé | 548-563 |
| 8 | phase `carry` : le bloc du porteur (§4.5) | 565-1011 |
| 9 | sinon : ballon libre ou en vol ; le coach ; le jeu aérien (tête, poitrine, volée, retournée) ; l'élection du preneur ; `receive` ; `onTake` | 1012-1056 |
| 10 | le ballon sorti → `cfg.onOut` | 1061-1072 |

### 4.4 `assignMatchJobs` (`match-sim.js:79-1122`)

| ordre | bloc | lignes |
|---|---|---|
| 1 | l'administration : le sifflet de hors-jeu, le chrono, la Loi 12 (`adjugeFaute`), la Loi 3 | 85-88 |
| 2 | l'horloge des moments : « transition » puis « placée » 5 s après un changement de possession | 91-102 |
| 3 | le vol mort (passe arrêtée au sol) devient un ballon libre | 105-113 |
| 4 | la mémoire du dépossédé (pour le contre-press) | 115-123 |
| 5 | LA REMISE : chacun à sa place légale, le preneur élu, puis `return` (§5.10) | 126-253 |
| 6 | l'expulsé et le remplacé marchent vers leur sortie | 256-259 |
| 7 | les gardiens, à chaque image (§5.8) | 262-404 |
| 8 | **la frontière du tick** : sans décision, `return` | 414 |
| 9 | le ballon libre : le chasseur le plus proche de chaque camp | 416-448 |
| 10 | l'attaque : le cap et la poussée du porteur | 451-531 |
| 11 | le receveur de la passe en vol | 533-637 |
| 12 | les soutiens : le comité au ballon et les postés (formation, couloirs, appels) | 638-889 |
| 13 | le pressing à déclencheurs | 891-918 |
| 14 | la défense : presseur, couvreur, marqueurs, bloc | 921-1111 |
| 15 | les couches de phase : repli, sortie de balle, intercepteur, duel aérien, contre-press, box crash, suivi d'appel… | 1113-1121 |

### 4.5 Le bloc du porteur (`rondo-sim.js:565-1011`)

À chaque image où un porteur existe, dans cet ordre :

1. Un geste en cours le possède : il ne redécide rien (578-585).
2. Le gardien qui tient le ballon aux gants (`heldBall`, 588).
3. La conduite : touches réelles, ballon libre entre elles ; porté, contesté ou repris (591-668).
4. Le pique : un adversaire qui atteint le ballon avant le porteur le dévie (676-702).
5. Le tacle glissé sur un ballon échappé (`trySlide`, 704).
6. Un ballon trop loin du porteur devient libre (720-736).
7. La pression et le tacle debout (748-750), la charge d'épaule (756-759), l'accrochage (761), le glissé sur le porteur (766-769).
8. La tenue délibérée, tirée une fois par possession (810-821).
9. Au tick, les niches du 1 contre 1 : double contact, petit pont, grand pont, roulette, râteau, passement, crochet (827-836).
10. La porte de décision : la tenue minimale, et le ballon au pied ou la gâchette près du but ou du point de centre (837).
11. L'arbitre de menace, mémorisé 0,25 s (870-881).
12. Le tir s'il gagne l'arbitrage (885), la feinte de frappe (887), le centre s'il gagne (889), le dégagement (893).
13. Ballon contesté : la passe d'urgence (894-911). Sinon, au tick : `choosePass`, puis l'adoption d'une intention si son score passe la barre (912-971), ou la semelle (975).
14. L'exécution de l'intention adoptée : la touche de préparation, la mène rafraîchie, la feinte de passe, puis `beginPass` (977-1010).

**À retenir.** Dans le moteur, l'arbitre ne garde que le tir et le centre. Une passe s'adopte quand son score passe la barre, même si l'arbitre préférait la conduite (885-971). L2 suit `meilleure` à la lettre : « passe » ou « centre » → `choosePass` sans barre ; « conduite » → conduite (`cerveau.mjs:446-481`). C'est une différence de comportement.

### 4.6 La réception (`receive`, `rondo-sim.js:230-376`)

- Le hors-jeu se siffle au premier toucher (236-239). Le receveur coéquipier tente d'abord la une-touche (`uneTouche`, 246 ; §5.4).
- Le gardien prend à deux mains, ou encaisse du buste (257-264).
- Sinon, la table des techniques choisit le contrôle selon la géométrie (269-270). Un ballon rapide peut échapper : le contrôle manqué, ou les quatre issues de `reception.js` (317-334).
- Un adversaire qui touche le ballon fait une perte de balle : interception, récupération ou tacle (374).

### 4.7 L'horloge des gestes (`stepGestures`, `rondo-sim.js:31-143`)

- Un geste a trois temps : l'**armé** (anticipation), le **contact**, l'**accompagnement** (`gesture.js:13-17`). Le ballon part au contact, pas à la décision ; pendant l'armé, le porteur peut perdre le ballon (`rondo-sim.js:35-38`, `:97`).
- Les durées et les instants de contact viennent des clips d'animation (`MOVE_TIMING`, `skills-sim.js:95-97`). La simulation et le dessin partagent le même horaire.
- Au contact, l'exécuteur part : `strikeNow` (passe, tir), `throwNow` (touche), `teteContact`, `retourneeContact`, `standTackleNow`, `skillContactNow` (`rondo-sim.js:108-112`).
- Un joueur dont l'armé n'avance pas est sauté par `movePlayers` (`movement.js:78-83`). Le gardien occupé est sauté par `assignMatchJobs` (`match-sim.js:323`).

## 5. Les décisions, module par module

### 5.1 Les métiers et leur attribution (`assignMatchJobs`)

| métier (`job`) | qui | vitesse de pointe | où il est posé |
|---|---|---|---|
| `carry` | le porteur | carry 4,2 m/s (plus vite pour rattraper sa touche) | `match-sim.js:453` |
| `receive` | le receveur ; le chasseur d'un vrai 50/50 ; le preneur d'une remise | chase 6,4 | `:445`, `:534`, `:248` |
| `support` | les soutiens offensifs, au ballon ou postés | support 4,9 | `:705`, `:870` |
| `press` | le presseur élu, le second qui saute sur le pivot | chase 6,4 | `:975-1035` |
| `cover` | le couvreur, sur la ligne ballon-but | press 6,6 | `:1037`, `:1041` |
| `mark` | les marqueurs et le bloc défensif | mark 5,6 | `:1062`, `:1085` |
| `keeper` | les gardiens | keeper 6,4 | `:264`, `:402` |
| `walk` | remises, expulsés, célébrations | walk 2,6 | `:126-253` |
| `intercept` | le lecteur de trajectoire d'une passe en profondeur | chase 6,4 | `movement.js:229` |
| `contre` | le défenseur qui se jette sur une frappe | — | `match-sim.js:973` |

**Le presseur et le couvreur** (921-1111) :
- Les défenseurs sont triés par distance au ballon (`byDist`, 943-944).
- `pressZone` pénalise celui qui sortirait loin de sa zone, selon la note teamwork (946-953). `pressLead` fait courir au point de chute d'une passe de bande (938-961). `tenueRoles` garde le même presseur et le même couvreur pendant une possession (962).
- Le premier (i = 0) presse. Contre le gardien qui tient le ballon, il garde le bord de la surface (977-983). Sinon : l'ombre de couverture dans la ligne de passe (985-996), la filature d'un porteur lancé (998-1006), puis le **jockey** : une cible entre le ballon et son but, à la **garde** (2, 4 ou 6 m selon le tiers ; 1008-1023). À moins de 1,6 m × agressivité, la cible devient le ballon : il **mord** (1010).
- Le second (i = 1) couvre sur l'axe ballon-but (`coverSpot`, `formation.js:587`). En fenêtre de pressing, il saute sur le relais le plus proche du porteur, « le pivot » (1029-1034).
- Les quatre suivants marquent. Chacun reçoit un attaquant dangereux par l'affectation homme par homme (`affecterMarquage`, `marquage.js`) et se place un pas côté but, sans quitter sa bande ; sans homme affecté, il tient sa zone (1070-1109).
- Les autres tiennent le **bloc** : les postes de la formation défensive, chaînés au ballon, décalés par la hauteur de bloc (1045-1068). Le nombre de marqueurs suit l'axe marquage (1045).

**Le pressing à déclencheurs** (891-918) : une équipe presse sur signal, dans une fenêtre bornée (4,5 s ± l'axe pressing). Trois signaux : la prise dos au but, la passe en retrait, la perte toute fraîche (contre-press). En fenêtre, le bloc monte de 3,5 m.

**L'attaque** :
- Le porteur reçoit un cap et une poussée `push` : vers le but si devant est dégagé, sinon vers l'évasion (`evadeSpot`, `rondo.js:711`). S'y ajoutent le couloir tenu, l'épaule du défenseur, la chaloupe, la poussée lissée (τ 0,35 s) et l'évasion qui ne traverse pas sa propre surface (451-531).
- Le receveur attaque sa passe : rendez-vous dans la foulée, course au ballon réel s'il est menacé, chute prédite du ballon long (533-637).
- Les soutiens : un petit comité au ballon, 2 joueurs à l'axe relation neutre (de 1 à 3, `soutienN`, `match-sim.js:680`), sur cinq couloirs autour d'une ancre lente. Les autres tiennent leur poste de formation, nuancé par le rôle (profondeur ±2,5 m, largeur) et calé sur la ligne de hors-jeu. Les pointes lancent les appels en profondeur quand le porteur est posé (638-889). « Se montrer » décale un soutien hors d'une ligne coupée (826-859).

**Les couches de phase** (1113-1121) : le repli (`repli.js`), la sortie de balle (`cpa.js:60`), l'intercepteur de vol (`phases.js`), le duel aérien, le retournement du dépossédé et le contre-press (`contrepress.js`), le box crash et le marquage de centre, la montée d'accompagnement.

### 5.2 Le placement (`movePlayers`, `movement.js:21-605`)

`movePlayers` transforme la cible en mouvement. Pour chaque joueur :

| étape | ce qu'elle fait | lignes |
|---|---|---|
| 1 | des couches réécrivent la cible : zone-homme, attaque de la surface, rest-defense, occupation par rôle, compression autour du ballon, cible lissée | 22-30 |
| 2 | le scan (le regard, pour le rendu) | 31 |
| 3 | au sol : il glisse (tacle) ou s'arrête | 36-66 |
| 4 | un geste possède le corps : il ne bouge pas, sauf aux mains | 78-83 |
| 5 | la course engagée : la cible ne change que si elle dérive de plus de 2,5 m, après 1,4 s | 91-102 |
| 6 | la vitesse de pointe par métier (`cfg.speeds`) × `topF` (ou `paceBias`) | 110-115 |
| 7 | plafonds et boosts : pointe de conduite, fatigue, ruptures de rythme (appel, chasse, lecture × 1,28), premier pas, marche du soutien posé, jockey 2,9 m/s, intention d'effort, économie de course, boiterie, retour au poste | 116-374 |
| 8 | la vitesse voulue vers la cible, avec freinage anticipé | 375-390 |
| 9 | la demande des soutiens et des marqueurs est lissée (τ 0,12 s) → `_wx`, `_wz` | 399-404 |
| 10 | l'appui planté au-delà de 40°, ou le virage lissé | 410-425 |
| 11 | l'accélération : 7,5 m/s² dans l'axe, 6 m/s² en travers ; plus on va vite, plus on tourne large | 426-453 |
| 12 | l'intégration, le budget d'effort, le drain de fatigue | 454-479 |
| 13 | le cap du corps : verrouillé par un geste ; le receveur se présente ; le gardien regarde le ballon ; le jockey fait face ; rotation bornée | 480-597 |

L2 lit `target` et `_wx/_wz` après l'appel (`cerveau.mjs:261`, `:275-277`). Le pas fait au monde prêté est jeté. L'appui planté et le cap du jockey ne sont donc pas transmis (inventaire-moteur.md §8).

### 5.3 Le porteur : tenir, arbitrer, choisir la passe

**La tenue.**
- Le moteur tire une tenue délibérée par possession : dans `tenueCalme.calm` (1,2 à 3,0 s), × `persona.calm`, × l'axe tempo (× 1,5 posé à × 0,5 vif), × la note decisions et le rôle (`rondo-sim.js:810-815`).
- Le porteur est « au calme » si personne n'arrive sur lui (`presseLue`, `rondo-sim.js:819`). Au calme, il tient ; pressé, la tenue minimale (0,4 s) reprend.
- L2 recopie cette porte, en jugeant le calme 0,4 s plus tard (la latence du corps) (`cerveau.mjs:428-443`).

**L'arbitre de menace** (`arbitre`, `menace.js:277-309`) note quatre options :
- le tir (`menaceTir`, 26) : portée, couloir vers le meilleur coin, mur de défenseurs, qualité ou xG ;
- le centre (`menaceCentre`, 197) : position haute et large, cibles dans la surface ;
- la passe (`menacePasse`, 218) : la valeur de l'élu de `choosePass` ;
- la conduite (`menaceConduite`, 245) : l'espace libre devant, vers le but.

**Le choix en valeur attendue** (`cfg.choix`, `choix.js`), allumé par défaut :
- Une seule échelle : la probabilité que l'action finisse en but (`valeursDe`, `choix.js:25-47`). Le tir vaut son xG ; la passe vaut pSucc × V(arrivée) − λ (1 − pSucc) × V_adverse ; la conduite et le centre suivent le même patron. V est la carte **xT** (menace attendue par zone, `xt.js`).
- λ, le prix de la perte, suit l'axe mentalité : 1,3 prudent, 0,7 audacieux.
- Les préférences (`cfg.menace` × style d'équipe × rôle) pèsent la valeur (`menace.js:301`).
- Le choix est un **softmax** : chaque option a une chance qui croît avec sa valeur. La température vaut T = 0,005 × e^(0,7 (1 − decF) / 0,15) × (1 + 0,8 P (2 − composureF)) : le joueur lucide prend presque toujours la meilleure, le fébrile se trompe plus sous pression (`choix.js:53-54`).
- Le bruit est un **Gumbel** (le bruit qui rend un softmax tirable) fixé par un hachage de (graine, porteur, époque de 1,2 s, option) : aucun tirage n'est consommé, et le joueur ne change pas d'avis à chaque image (`choix.js:55-62`).
- Retour : `{ tir, centre, passe, conduite, meilleure, score, ev, T }`.

**Le choix de passe** (`choosePass`, `rondo.js:131-597`). Pour chaque coéquipier :
- il écarte le veto de ligne (`st.laneVeto`, 238), le joueur au sol ou expulsé, le hors-jeu, le receveur hors de portée ;
- il calcule une mène, un style et le **couloir** (la marge libre le long de la passe, `laneClearance`) ;
- il additionne un **barème** en mètres : progression (`passBias`), appel servi, renversement après fixation, passe en profondeur (`through`), homme libre, coût d'angle du corps, styles… ;
- sous `cfg.selection`, il ajoute le terme de réussite : poids × ρ × (logit P̂ − logit 0,8) (`selection.js:70-83`) ;
- il rend le meilleur : `{ to, lead, style, score, lane, dist, through?, cls, pSucc, pBrut, … }` (586-596). Le `score` gardé est celui du barème nu : « la sélection réordonne, elle ne retient pas » (594).

**La réussite prédite** (`selection.js`) :
- Douze **classes** nommées : SHORT_GROUND, MID_GROUND, LONG_GROUND, CHANNEL, THROUGH, CHIP_THROUGH, SWITCH, CROSS, CUTBACK, LAY_OFF, ONE_TWO_RETURN, BACK_SAFE (`selection.js:22`, `:27-35`).
- p = pRel × S × PPCF × pCtrl (`selection.js:54-67`) : la sortie sous pression (1 − bloc × P), la survie du ballon en vol face à chaque défenseur (38-51), la course au point de chute (**PPCF**, qui arrive le premier), le contrôle à l'arrivée.
- P̂ = σ(α + β × logit p) : le **calage** par classe (65-66). C'est là que L2 recale (§3.5).

**La passe « dans le corps »** (`passe-faisable.js`) :
- `ecartCorps` : l'écart entre une direction et le cap (16) ; `coutAngle` : la passe coûte au-delà de 45° (19-27) ;
- `porteContact` : au contact, au-delà de 100° du regard, la passe devient une « touche de fortune » (42-48) ;
- `talonPermis` : la talonnade n'est permise qu'au sol, à 10 m au plus (76).
- L2 s'en sert pour « se tourner d'abord » quand la passe choisie est hors du corps (`cerveau.mjs:454-461`, `:519-536`).

### 5.4 La première intention (`uneTouche`, `premiere-intention.js:31-163`)

- Seul le receveur attitré d'une passe joue en une touche, et jamais le gardien (32-33).
- Trois envies : un adversaire à moins de 3,4 m (40) ; dos au but et pressé, la remise est forcée (46-49) ; au calme, une chance = 0,5 × max(0,35 ; 1 − 2 × style) × vision, × 2,2 si un troisième homme court (56).
- Trois portes : ballon à 9,5 m/s au plus (15 dans L2), sous 0,5 m de haut, et un tirage à 0,65 × tempo × contrôle × rôle (58-61).
- Les candidats : coéquipiers entre 2,5 et 14 m, dans le corps (110°), couloir d'au moins 0,9 m, dosage faisable par la balistique (83-106). Le relais en course passe d'abord, puis la plus grande marge (109-113).
- Elle frappe tout de suite, sans armé, pose `st.pass` et un événement `pass` qui nomme le geste d'orientation (132-152). Elle rend `true`.
- L2 l'appelle une fois par passe, avant le contact, sur un monde projeté à l'instant de l'arrivée, puis lit `st.pass.to` (`cerveau.mjs:311-322`, `:372-388`).

### 5.5 Le jeu aérien (`tete.js`, `reprise-physique.js`)

- Ces fonctions tournent dans la phase libre ou en vol de `rondoStep` (`rondo-sim.js:1027`).
- `teteArmerStep` (`tete.js:158`) : si le ballon sera à hauteur de tête au contact du clip (0,42 s en sautant, 0,22 s debout) et qu'un joueur y sera, le geste s'arme (`tete`, `teteDebout`, `teteDefensive`, `amortiTete`).
- `teteStep` (`tete.js:25`) : au contact, la tête au but, le dégagement ou la remise. À deux, le duel aérien, à la note strength.
- `voleeStep` (`tete.js:242`) : ballon entre 0,25 et 1,15 m — la volée au but dans la surface, sinon le dégagement.
- `chestStep` (`tete.js:315`) : la poitrine entre 1,15 et 1,55 m, pour le coéquipier du dernier toucheur. `retourneeArmerStep` (`tete.js:195`) : la retournée, dos au but dans la surface.
- `reprise-physique.js` : un ballon de plus de 12 m/s, frappé il y a moins de 0,3 s, qui vient sur un joueur est subi : il rebondit mou (`repriseSubie`, 15). La reprise au but doit partir dans le corps : 100° du regard au plus pour la volée, 120° pour la tête (`butDansCorps`, 49 ; `match-config.js:837`).
- L2 n'en garde que la reprise au but en première intention : il refait les portes avec `cfg.tete`, `cfg.volee`, `butDansCorps`, et `arbitre` pour le ballon au sol (`cerveau.mjs:398-417`).

### 5.6 Dribbles et feintes (`skills-sim.js`)

- Chaque geste a son déclencheur `maybe*` : râteau (103), feinte de passe (148), semelle (187), passement (238), crochet (327), double contact (401), petit pont (458), grand pont (517), roulette (519), feinte de frappe (564).
- Le patron commun : les seuils de `cfg.skill` ; une recharge par geste (`c._skillCd`) ; une situation précise (presseur de face qui charge, jockey posté, sortie libre…) ; un refus nommé ; puis un tirage `'geste'` contre une envie = `dribM` × poids du geste × flair × gesteF^n.
- `dribM` (62-79) : le rôle (axe dribble, × 0,4 à × 1,6), le volume (0,35), l'aile × 1,3, son propre tiers × 0,5, la cadence (une tentative toutes les 60 s pour un rôle neutre, de 30 à 90 s selon le rôle), la lucidité. La loi « pas de dribble devant son but » (sous-clé `devantBut`) est absente de la config, donc éteinte.
- Le geste accepté : `startGesture`, événements `windup` et `skill`. Au contact, `skillContactNow` (602) ; l'accompagnement écrit le corps et le ballon (`skillFollowStep`, 752).
- Les conditions de chaque geste : inventaire-moteur.md §3.3. Aucun n'est appelé par L2.

### 5.7 Duels et tacles (`duel.js`, `rondo-sim.js`)

| mécanisme | déclencheur | issue | lignes |
|---|---|---|---|
| tacle debout | `pressPredicate` : un adversaire à moins de 0,9 m du ballon, plus près que le porteur de 0,15 m, sans geste ni recharge. La pression s'accumule ; à l'horloge (0,9 × 0,25 × (2 − tacleTempoF) ≈ 0,23 s, × 1,9 ÷ agressivité dans sa surface) et si le ballon est prenable (`tackleWindow`), le tacle s'arme (contact à 0,28 s) | gagné si le ballon est à portée (0,85 m + tackleReach − esquiveF) ; sinon faute si la fente touche le corps | `skills-sim.js:81-88` ; `rondo-sim.js:153-218`, `:748-750` ; `duel.js:287-291` |
| tacle qui dégage | un tacle gagné | prise propre à 55 % × tacleGardeF, sinon le ballon file | `duel.js:360-371` |
| pique | un adversaire atteint le ballon libre de conduite avant le porteur | réussite à la note ; le ballon dévié | `rondo-sim.js:676-702` |
| charge d'épaule | un adversaire à moins de 0,85 m pendant 0,4 s | par derrière en percutant : faute ; sinon gagnée à 40 % + écart de force et d'élan, ballon contesté | `duel.js:226-276` |
| accrochage | le **battu** dans le dos d'un porteur lancé (≥ 2,6 m/s) le retient. p ≈ 0,065 × composure × axe pressing (× 1,8 si faute tactique, × 0,15 dans sa surface), × rôle, × agressivité | faute posée ; la course continue une fois sur deux | `duel.js:303-351` |
| glissé sur porteur | porteur ≥ 4,4 m/s, défenseur lancé ≥ 4,4 m/s, à 1,35-2,5 m (`match-config.js:594`) | ballon pris, jambes fauchées (faute) ou glissade dans le vide | `duel.js:45` |
| glissé sur ballon libre | dernier recours : le défenseur qui perd nettement la course | contact différé, joué au pied | `rondo-sim.js:438-509` |
| contre | à l'armé d'un tir, le défenseur devant se jette sur la ligne | renvoi, amorti, sortie ou déviation | `duel.js:387-458` |
| jambe tendue | la passe dépasse son receveur de peu | touche dégradée, ballon libre | `duel.js:469-486` |

Dans L2 :
- L'adaptateur refait la décision du tacle debout (`decideTacle`, `cerveau.mjs:336-346`) avec `pressPredicate` et `tackleWindow`. L'horloge est copiée, car `tacleHorloge` n'est pas exportée (`:348-359`). La pression monte de 0,1 s par tick.
- Le défenseur engagé reçoit PRESSER pendant 0,7 s ; le tacle lui-même reste aux réflexes du corps (`:270`).
- L'accrochage est appelé tel quel par `cfg.accrocheMod`, après les décisions du tick (`:305-308`). La faute part au corps aux ticks suivants (§5.9).

### 5.8 Le gardien

- **La position** (`keeperSpot`, `keeper.js:95`) : sur la ligne ballon-centre du but, à une profondeur de 0,45 à 2,6 m selon la distance du ballon (`KEEPER`, `keeper.js:20-49`).
- **La décision** (`keeperDecide`, `keeper.js:185`) rend `poste`, `gather` (se saisir), `dive` (plonger) ou `battu`. Elle lit la balistique : où et quand le vol coupe le plan du but. Une passe d'un coéquipier n'est jamais un tir.
- **Dans `assignMatchJobs`** (`match-sim.js:262-404`) : le gardien porteur distribue (au coin des six mètres, règle des six secondes, `relancerGardien`, `keeper.js:307`) ; il ramasse le ballon dans ses pieds ; il vient au-devant d'un retrait ; il sort sur un centre ; il plonge, avec l'espèce du plongeon (`plongeonPrise`, `plongeonBas`, `plongeonUneMain`, 373-398) ; sinon il gagne son spot.
- **Le contact du plongeon** (`onDive`, `match-sim.js:1138-1186`) : prise si le ballon est à 1,35 m au plus, claquette sinon, corner si le tir est trop fort, poing sur une sortie aérienne.
- **Dans L2**, les gardiens sont à l'IA du corps (`INTENTION.IA`, `cerveau.mjs:267`). La branche gardien tourne quand même dans `assignMatchJobs` ; son résultat est jeté (inventaire-moteur.md §8).

### 5.9 La Loi 12 et l'arbitre

- **Les fautes** se posent dans `st._faute` : la fente du tacle debout qui trouve le corps (`rondo-sim.js:200-202`), la charge par derrière (`duel.js:249-251`), l'accrochage (`duel.js:337`), les glissés (`duel.js:45`, `nature.js` — non vérifié). Une seule faute à la fois.
- **`adjugeFaute`** (`referee.js:778-892`), appelée dans l'administration d'`assignMatchJobs` :
  - elle attend la fin de la fenêtre d'**avantage** (1,8 s) ou la perte du ballon par l'équipe fautée (780-784) ;
  - **le carton** : un score de nature S (espèce de faute, vitesse de la victime, agressivité, transition prometteuse) ; le **DOGSO** (occasion de but manifeste annihilée) vaut rouge, sauf tacle dans la surface (jaune + penalty) ; P(jaune) = σ((S − τ) / s) ; une ardoise cumule ; deux jaunes font un rouge ; l'expulsé sort (`down` 9e9) (811-869) ;
  - avantage joué : événement `avantage`, pas de sifflet (870-873) ;
  - sinon : coup franc au lieu de la faute, ou penalty dans la surface du fautif, avec `st.restart` (874-891).
- **`loi12.js` n'est pas la Loi 12 des fautes.** Il contient `retraitAuPied` (la passe en retrait se joue au pied, Loi 12.2, ligne 10), `murTaille` (la taille du mur, 25) et `loi13Cibles` (les adversaires à 9,15 m, 32).
- **Le hors-jeu** : la photo au départ du ballon, le sifflet au premier toucher (`receive`), le coup franc par `administerWhistle` (`referee.js:931`).
- **L'arbitre incarné** (`arbitreStep`, `referee.js:1057`) et ses assistants ne vivent que dans `matchStep`.
- **Dans L2**, l'adaptateur lit `st._faute` avant et après `assignMatchJobs`. Si elle a été jugée, il envoie au corps `gf_faute` (coup franc ou penalty, au lieu de la faute, avec la gravité) ou `gf_carton` (carton seul quand l'avantage a été joué) (`cerveau.mjs:244-258`).

### 5.10 Les remises et les coups de pied arrêtés

- `onOut` (`referee.js:507`) juge la sortie par la géométrie du franchissement (`outRule`, `pitch.js:73`) et pose `st.restart`.
- La branche des remises d'`assignMatchJobs` (`match-sim.js:126-253`) place chacun : rayons du règlement, mur (taille selon distance et angle, les deux plus proches au trot), cérémonie du penalty (Loi 14), montées sur corner et coup franc (`cornerSpots`, `toucheSpots`, `cfSpots`), les autres à leur poste.
- Le preneur est élu (`elireTaker`, `referee.js:1159`). Il va chercher le ballon et le porte (`ballFetch`, `referee.js:958`), avec sa course d'élan (`elan.js`). `canTake` (`referee.js:638`) dit quand la remise peut partir ; `onTakeMatch` (`referee.js:1036`) dit comment : touche à la main, coup franc direct ou joué, corner, relance du gardien.
- `cpa.js` : `cfSpots` (21), `sortieBalle` (60), `remiseCible` (94), `placementEvent` (113). Les styles par équipe vivent dans `tactique.cpa` : `{ corner, coupFranc, marquage, touche, sortieBut }` (`tactics.js:101-107`).
- **Dans L2**, `st.restart` est effacé à chaque tick : rien de cela ne tourne (`cerveau.mjs:205`).

### 5.11 Le tir

- `tryShot` (`shooting.js:21-192`), seulement si l'arbitre choisit le tir : portée, angle, lob sur gardien sorti, pré-filtre ; le coin opposé au gardien ; si le ballon n'est pas au pied, une **touche de préparation** de 0,9 s (`_prepShot`, 79-81) ; puis `beginPass` avec `shot` (192).
- `beginPass` (`strike-sim.js:85`) choisit la technique et arme le geste ; `strikeNow` (`strike-sim.js:375`) frappe au contact et applique la dispersion.
- **L'échelle de finition** (`finitionSigma`, `strike-sim.js:365-373`) est une loi pure, sans tirage :
  - l'écart de cap σψ = 1,4° × finF × (pied faible) × (1 + κ P) × (fatigue) × (v / vMax)^1,2 × (distance), et l'écart d'élévation σθ = 2 × σψ ;
  - la vitesse est log-normale (σ 0,08), sous-dosée sous pression et avec la fatigue.
- L2 la réutilise pour son tir (`tirDuCerveau`, `cerveau.mjs:492-515`) : côté ouvert à 0,9 m du poteau, hauteur tirée (ras de terre 62 %, mi-hauteur 30 %, lucarne), écarts de `finitionSigma`. Un tir au-dessus devient un tir à côté, du même côté.
- `xg.js` porte l'xG du moteur (`xgDe`, 78), celui qui guide le tireur. `stats.js:23` porte `xgRef`, un xG de référence indépendant, pour les bancs. `stats.js` et `tactique.js` sont des modules de mesure en lecture seule.

## 6. Les joueurs

### 6.1 Attributs → facteurs (`attributes.js`)

- Les notes vont de 0 à 100. 50 est le joueur moyen ; une note absente vaut 50 (`makeProfile`, 78). Trois principes (8-16) : une note module dans la bande humaine ; sans notes, rien ne change au bit ; la note agit sur l'exécution, pas sur la physique.
- Une note `flair` fournie remplace le flair de la persona : 0,15 + 0,85 × flair/100 (`match-sim.js:51-52`).

| note | facteur | de 0 à 100 | lu par (exemples) |
|---|---|---|---|
| pace | `topF` | 0,90 → 1,10 | `movement.js:115` (vitesse de pointe) |
| acceleration | `accelF` | 0,88 → 1,12 | `movement.js:439`, `selection.js:45` |
| passing | `passSigma` | 6,0° → 0,5° (écart d'angle) | `premiere-intention.js:119` ; dispersion des passes |
| vision (sinon passing) | `visionF` | 0,85 → 1,15 | `premiere-intention.js:56`, `choosePass` |
| control | `controlF` | 0,7 → 1,6 | `rondo-sim.js:318`, `duel.js:481`, `strike-sim.js:132` |
| dribbling | `dribbleLeadF` ; `esquiveF` | 1,08 → 0,94 ; −0,08 → +0,08 m | `rondo-sim.js:625-629` ; `rondo-sim.js:189` |
| technique (sinon dribbling) | `gesteF` | 0,55 → 1,10 | `skills-sim.js:127`, `passe-faisable.js:22`, `match-sim.js:498` |
| finishing | `shotSigma` ; `finF` | 0,55 → 0,10 m ; 2,24 → 0,45 | `menace.js:113` ; `strike-sim.js:368` |
| longShots | `longF` | 0,75 → 1,25 | `menace.js:51`, `:126` |
| technique (sinon control / agility) | `layoffF` ; `pivotF` | 1,15 → 0,85 ; 0,85 → 1,15 | `premiere-intention.js:119` ; pré-filtre du tir (non vérifié) |
| shotPower | `powF`, `vMaxF` | 0,90 → 1,10 ; 33 → 38 m/s | répertoire des frappes (non vérifié) |
| tackling | `tackleReach` ; `tacleTempoF` ; `tacleGardeF` | −0,10 → +0,10 m ; 0,85 → 1,15 ; 0,85 → 1,15 | `rondo-sim.js:189`, `:155` ; `duel.js:363` |
| teamwork | `teamF` | 0,8 → 1,2 | `match-sim.js:949` (élection du presseur) |
| anticipation | `anticipF` | 0,85 → 1,15 | `match-sim.js:910`, `:1024` ; `selection.js:44` |
| aerialReach, oneOnOnes, command | `aerialF`, `oooF`, `commandF` | 0,85 → 1,15 | `match-sim.js:1142`, `:337` ; commandF non vérifié |
| reactions | `reaction` | 0,30 → 0,14 s | `rondo-sim.js:532`, `match-sim.js:559`, `movement.js:194` |
| composure | `composureF` | 1,30 → 0,85 (1,075 à 50) | `duel.js:290`, `:304` ; `menace.js:174` ; `choix.js:53` ; `strike-sim.js:367` |
| keeping | `keeperReach`, `keeperReflex`, `posMixF`, `depthKF` | 2,55 → 3,25 m ; 0,16 → 0,09 s ; … | `match-sim.js:325-329` |
| agility | `appuiF`, `appuiRhoF`, `getupF` | 1,15 → 0,85 ; 0,93 → 1,07 ; 1,28 → 0,72 | `appui.js` ; `match-sim.js:395` ; `movement.js:291` |
| stamina | `stamF` | 1,25 → 0,75 (drain de fatigue) | `movement.js:475` |
| strength | `chargeF` | 0,85 → 1,15 | `duel.js:261` |
| jumping | `sautF` | 0,75 → 1,25 | `tete.js:162` |
| handling | `handF` | 0,85 → 1,15 | `match-sim.js:1154`, `:1175` |
| heading | `headF` | 0,8 → 1,2 | `tete.js` (non vérifié) |
| crossing | `crossF` | 1,25 → 0,75 | `choix.js:44` ; `tryCross` |
| weakFoot | `weakF` | 1,5 → 0,5 | `strike-sim.js:366` |
| kicking, throwing | `kickF`, `throwF` | 0,85 → 1,15 | `relancerGardien` (non vérifié) |
| decisions | `decF` | 0,85 → 1,15 | `rondo-sim.js:814`, `:908` ; `choix.js:53` ; `selection.js:71` |
| scanning (sinon vision) | `scanF` | 0,85 → 1,15 | `scan.js` (non vérifié) |
| offTheBall ; movement | `otbF` ; `offBallF` | 0,85 → 1,15 | `match-sim.js:743`, `:784` ; `:850` |
| positioning | `posF` | 0,85 → 1,15 | `match-sim.js:1062-1064` |
| workRate | `workF` | 0,85 → 1,15 | `match-sim.js:1059`, `movement.js:116` |
| aggression | `aggrF` | 0,8 → 1,2 | `match-sim.js:1010` ; `duel.js:336` ; `rondo-sim.js:162` ; `referee.js:826` |
| concentration | `concF` | 0,7 → 1,3 | `match-sim.js:1067`, `:1079`, `:1109` |
| marking | `markF` | 0,85 → 1,15 | `match-sim.js:974`, `:1089` |

### 6.2 Le profil au poste

- `profilAuPoste(skill, fam)` (`attributes.js:166`) : hors de ses postes naturels, un joueur garde sa technique mais lit moins bien le jeu.
- Décisions, placement, anticipation, appels, déplacement, cohésion, marquage et concentration sont multipliés par un facteur entre 0,7-0,75 et 1 selon la familiarité ; la réaction est ralentie jusqu'à × 1,3 (`POSTE_MALUS`, `attributes.js:164-165`). `makeMatch` le pose quand le squad donne une liste de postes (`match-sim.js:46`).

### 6.3 La persona (`persona.js`)

Une **persona** est l'identité de mouvement d'un joueur : une fonction pure de (id, graine), bornée serrée (`makePersona`, `persona.js:25-48`).

| champ | plage | sert à |
|---|---|---|
| `paceBias` | 0,94 → 1,06 | vitesse de pointe, si le joueur n'a pas de note (`movement.js:115`) |
| `burstiness` | 0,7 → 1,4 | fréquence des ruptures de rythme (`movement.js:179`, `:186`) |
| `calm` | 0,85 → 1,25 | longueur de la tenue délibérée (`rondo-sim.js:814` ; `cerveau.mjs:433`) |
| `flair` | 0,15 → 1,0 | l'envie de tenter un geste (`skills-sim.js:127`, `:166`, `:216` ; (1v1) `face.js:156`) |
| `reaction` | 0,16 → 0,26 s | latence sur une balle surprise, sans note (`rondo-sim.js:532`) |
| `scale`, `gaitPhase`, `armSwingF`, `posture`, `bras` | bornes serrées | le rendu seulement |

### 6.4 Les rôles (`roles.js`)

Le poste dit **où** (`formation.js`), le rôle dit **quoi**, l'attribut dit **comment ça réussit** (`roles.js:2-4`). Un rôle est un petit objet de biais, à identité 0,5 (`resoudreRole`, `roles.js:104-139`) :

| axe | sens | lu par |
|---|---|---|
| `profondeur` | se tenir haut ou décrocher (±2,5 m) | `match-sim.js:719-721` |
| `largeurR` | se tenir large ou rentrer (× 0,9 à × 1,1) | `match-sim.js:722-724` |
| `appel` | cadence des appels profonds (recharge 14 s à 6 s) | `match-sim.js:784` |
| `press` | jambes de pressing, serrage du marquage | `match-sim.js:1002`, `:1029`, `:1089` ; `duel.js:336` |
| `garde` | profondeur du gardien (libéro ou de ligne) | `match-sim.js:330` |
| `ancrage` | coller à son poste ou vagabonder | `match-sim.js:677`, `:708` |
| `tenue` | jouer vite ou garder le ballon | `rondo-sim.js:814` ; `premiere-intention.js:61` |
| `dribble` | fréquence des tentatives de dribble | `skills-sim.js:63` |
| `marqueSerre`, `orienteFaible` | coller son homme ; forcer le pied faible du porteur | `match-sim.js:1089`, `:1016` |
| `duel`, `ressort`, `repli` | se jeter ou rester debout ; dégager ou ressortir ; dispense de repli | non vérifié ; `repli.js:16-20` |
| `arbitre` | poids tir / centre / passe / conduite (±15 % environ) | `menace.js:299-305` |
| `interdits` | gestes interdits (`deborde`, `tacleGlisse`, `tete`…) | `interdit(p, nom)`, `roles.js:141` |

- Le catalogue `ROLES` (`roles.js:25-101`) compte 48 rôles : 9 historiques (polyvalent, neufDeSurface, ailierDePercussion, meneur, ailierInterieur, piston, recuperateur, gardienDeLigne, gardienLibero), 34 du projet aval (centre_back, regista, false_9…) et 5 du document de campagne.
- Un rôle peut se donner par phase, `{ on, off }` : les axes offensifs viennent du rôle ON, les défensifs du rôle OFF (`roles.js:110-113`). `role(p)` rend toujours un rôle : polyvalent par défaut (`roles.js:144`).

### 6.5 La tactique d'équipe (`tactics.js`, `formation.js`)

- Une tactique est un ensemble d'axes de 0 à 1. À 0,5, chaque axe vaut exactement les constantes mesurées : c'est l'identité (`tactics.js:34-50`). `axe(t, bas, haut)` interpole (`tactics.js:44`).

| axe | sens (0 ↔ 1) | effet, exemples |
|---|---|---|
| `hauteurBloc` | bas ↔ haut | bloc posté décalé de −6 à +6 m (`match-sim.js:1051`) ; ligne du bloc ±4 m (`formation.js:575`) |
| `largeur` | jeu intérieur ↔ jeu large | z des postes × 0,85 à 1,15 (`match-sim.js:716`) |
| `pressing` | attentiste ↔ agressif | fenêtres de pressing (`match-sim.js:896-914`) ; garde ; accrochage (`match-sim.js:1202`) |
| `style` | possession ↔ direct | poids de l'arbitre (`menace.js:293-296`) ; cadence des appels (`match-sim.js:785`) ; une-touche ; semelle |
| `tempo` | posé ↔ vif | tenue × 1,5 à 0,5, barre d'adoption, une-touche (`rondo-sim.js:814`, `:821`, `:925`) |
| `transition` | conservation ↔ contre | verticalité après le regain (`match-sim.js:743`) |
| `marquage` | zone ↔ homme | rayon et nombre de marqueurs, côté faible (`match-sim.js:963-969`, `:1045`) |
| `relation` | positionnel ↔ relationnel | écartement et nombre des soutiens (`match-sim.js:658`, `:680`) |
| `mentalite` | prudent ↔ audacieux | prix de la perte λ (`choix.js:28`) ; aversion au risque ρ (`selection.js:71`) |
| `compacite`, `piege` | longueur du bloc ; ligne haute et synchrone | `blocFor` (`formation.js:569-584`) ; `piege.js` |
| `repli`, `gestionTemps`, `shotDoctrine` | pointes dispensées de repli ; gestion du temps ; tirer à vue | `repli.js` ; `temps.js` ; `xg.js` (non vérifié) |
| `formation`, `roles`, `cpa` | système ; rôles par poste ; styles de coups de pied arrêtés | `formation.js` ; `makeMatch` ; `cpa.js` |

- Sept préréglages (`TACTIQUES`, `tactics.js:53-72`) : equilibre, gegenpressing, possession, blocBas, direct, largeEtCentres, ligneHaute. Chacun porte ses rôles par poste.
- Les formations : 31 entrées dans `LIGNES` (`formation.js:410`), 4-3-3 par défaut. `formationSpots` construit les postes ancrés sur le ballon (`formation.js:431`) ; `blocFor` y applique compacité, hauteur et piège (`formation.js:569`). Attention : `tactique.js` n'est pas une tactique, c'est la télémétrie tactique en lecture seule, pour les bancs (`tactique.js:1-12`).

### 6.6 Ce que L2 en a

- Pas de `squads` : aucun `q.skill`. Chaque facteur prend sa valeur neutre au point de lecture (`?? 1`, ou 1,075 pour composureF). La persona, elle, existe : flair, calm, burstiness, reaction et paceBias agissent.
- La tactique est celle passée à `creerCerveau`, sinon « équilibre ». Les préréglages apportent leurs rôles par poste ; sans eux, tout le monde est polyvalent.
- Au coup d'envoi, chaque joueur GPF reçoit le poste du cerveau le plus proche (`apparier`, `cerveau.mjs:124-142`).

## 7. Le hasard et le déterminisme

| source | nature | où | sert à |
|---|---|---|---|
| `st.rnd` | générateur séquentiel seedé (LCG) | `rondo.js:34-35` | repli de tous les tirages quand le flux n'est pas armé |
| `st.rnd2` | second LCG (graine × 7919 + 13) | `match-sim.js:23` | accrochage, cartons, sans décaler `st.rnd` |
| `tirage(st, nom, entité, hier)` | fonction pure de (graine, flux, tick, entité, index) si `st._flux` existe ; sinon `hier` | `rng.js:59-63` | les flux `passe`, `tir`, `duel`, `perception`, `geste`, `arbitre`, `intention`, `cpa` (`rng.js:42`) |
| `makePersona` | LCG par (id, graine) | `persona.js:22-26` | l'identité de mouvement |
| pied fort | hachage (graine, id) | `match-sim.js:33-36` | la patte |
| `choixEV` | Gumbel par hachage (graine, porteur, époque de 1,2 s, option) | `choix.js:22`, `:55-59` | le choix du porteur, sans consommer de tirage |
| placement, attention, regard surpris | hachages (id × tranche de temps) | `match-sim.js:1062`, `:1067` ; `rondo-sim.js:530` | bruits sans tirage |
| croyance | LCG par joueur | `croyance.js:111-112` | le bruit d'observation |
| L2 | hachage sans état (graine, porteur, instant) | `cerveau.mjs:120` | tenue calme, talonnade permise |

**Le flux nommé** (`cfg.flux`, `rng.js:36-63`) :
- Un tirage est une fonction pure : u = draw(graine, sous-système, tick, entité, k). k compte les tirages de ce couple (flux, entité) pendant le pas ; il repart de 0 à chaque pas.
- Ajouter un tirage dans le module de tir ne décale donc plus le module de passe : les rejeux et les comparaisons A/B tiennent. `matchStep` arme `st._flux` à chaque pas : graine, tick = round(t / dt), compteurs vidés (`match-sim.js:1215`).

**Pourquoi l'adaptateur doit l'armer** :
- L2 n'appelle pas `matchStep`. Sans lui, `st._flux` resterait nul et `tirage` rendrait `hier`, le générateur séquentiel `st.rnd`. Le hasard d'une décision dépendrait alors de tous les tirages faits avant elle, dans ce tick et dans les précédents ; un appel ajouté ailleurs décalerait tout (`cerveau.mjs:209-211`).
- L2 l'arme donc à chaque tick, comme `matchStep`, avec tick = round(st.t × 60) (`cerveau.mjs:212`).
- Le compteur k vit un tick. Deux appels de la même décision pour le même joueur dans un tick tirent deux nombres différents. L2 évite de redécider : arbitrage mémorisé 0,25 s, intention tenue 0,9 s, première intention une seule fois par passe (`cerveau.mjs:114-118`, `:445`, `:471`).

**Le déterminisme de L2** : à monde GPF identique et à historique identique, le cerveau rend les mêmes décisions. Mais l'état qui persiste entre deux ticks (§2.9) fait dépendre une décision de l'historique, pas seulement du monde courant.

## 8. Le face-à-face Taarabt (branche duel)

**Où.** (1v1) `face.js` (328 lignes), sur la branche `feat/1v1-maquette`. La configuration `face` vit dans (1v1) `duel-1v1.js:104-105`. Le branchement est dans (1v1) `match-sim.js:1200` : `avantMouvement` appelle `piegeApply`, puis `faceAvant` si `cfg.face`.

**Pourquoi** ((1v1) `face.js:1-6`). Mesuré avant : le duel face à face durait 0,7 s, 64 % des duels sans aucun geste. La référence est Taarabt, image par image : planté à 1,5-2 m du défenseur, semelle sur le ballon, une feinte toutes les 0,3-0,6 s, 2 à 4 par duel, le défenseur qui se jette et finit au sol, puis le départ. La thèse de Headrick donne 1,15-1,69 m entre ballon et défenseur, et des duels de 3,3 à 5 s.

**Déroulé.** `faceAvant` ((1v1) `face.js:184-312`) tourne à chaque image, avant le mouvement :
1. **L'approche** (143-180). Un défenseur côté but entre 2 et 7 m. Au tirage de l'envie (0,7 + 0,3 × flair), le porteur va le chercher et freine. S'il lui tourne le dos, il se retourne d'un râteau.
2. **L'entrée** (209-230). Le défenseur est devant (cône de 50°), à 1-2,6 m freinage compris, le ballon au pied, à plus de 6,5 m du but : l'arrêt semelle bloque le ballon. Événement `face` / `entre`.
3. **La tenue** (307-311). Le porteur est planté, le regard sur le défenseur, le ballon sous la semelle.
4. **Les feintes** (282-303), à la fin de la précédente plus une pause de 0,1 à 0,35 s : le roulé de semelle, la feinte de corps semelle dessus, le passement de la tenue, ou une série de 2 à 4 passements alternés « à la Mancini » (65-75).
5. **La morsure** (267-277). Au contact de chaque feinte, le défenseur mord avec p = (0,15 + 0,12 × feintes déjà vues) × vente × gesteF × (2 − anticipF), au plus 0,85. Mordu, il glisse du côté vendu et s'assoit 0,6 s (`_bite`).
6. **La garde du défenseur** (315-328). À 1,4 m du ballon (× (2 − agressivité), entre 1,1 et 1,8 m) sur la ligne ballon-but. Toutes les 0,45-0,85 s, il montre la fente : le « jab ».
7. **La fente** (122-137, 304-306). À bout de patience (1,6-3,2 s, moins si agressif) ou mordu, il charge 0,2 s puis se fend : un tacle debout qui glisse jusqu'au ballon. Le porteur la lit avec p = 0,5 × anticipF × (2 − tacleTempoF) et répond : roulette, râteau ou tiré de semelle (252-266). Manquée, la fente finit au sol trois fois sur dix, une fois et demie plus souvent si elle était mordue (134, 197).
8. **La sortie** (85-120, 278-281). Sur la morsure, la fente manquée ou le défenseur au sol, vers son côté ouvert : la croqueta (double contact), le râteau ou la roulette. La sortie accélère 0,8 s. Au bout de 5 s, le porteur y va quand même.
9. **La fin** (51-55). Événement `face` / `fin` : l'issue, la durée, les feintes, les morsures, la fente.

**Les gestes utilisés** (les `SKILL_KINDS` de (1v1) `motion-skill.js`) : `arretSemelle` (en mode `semelleFace`), `semelleRoule` / `semelleRouleOut`, `feinteSemelle` / `feinteSemelleIn`, `passementFace`, `passementSerie2` à `passementSerie4`, `tireSemelle` / `tireSemelleIn`, `rateauFace` / `rateauFaceIn`, `rouletteFace`, `doubleContact` (la croqueta), `rateau` (le demi-tour) et `tacleDebout` (la fente).

**Ce qui manque au starter 11 contre 11** (vérifié par recherche dans les deux arbres, sauf mention) :

| pièce | branche duel | starter 11c11 |
|---|---|---|
| `face.js` | présent | absent |
| les gestes de semelle du face-à-face (`semelleRoule`, `tireSemelle`, `rateauFace`, `rouletteFace`, `passementFace`, `feinteSemelle`…) | (1v1) `motion-skill.js` | aucun de ces noms dans `motion-skill.js` |
| le chemin du ballon en repère du clip (`payload.face`) dans `skillFollowStep` | (1v1) `skills-sim.js` (9 occurrences) | 1 occurrence ; support complet non vérifié |
| le plafond de vitesse `_faceCap` | (1v1) `movement.js:153` | absent |
| l'export `ARRIVEE` (bande morte de la cible, 0,18 m) | (1v1) `movement.js:15` | absent ; la valeur est écrite en dur (`movement.js:379`) |
| la fente « dans le vide » (`fente.vide`) au contact du tacle | (1v1) `rondo-sim.js:186` | absente |
| `avantMouvement` qui enchaîne `faceAvant` | (1v1) `match-sim.js:1200` | `piegeApply` seul (`match-sim.js:1200`) |
| la config `face` et la garde à l'échelle du duel (jockey à 1,4 m, morsure à 1,1 m, gardes 1,4 / 1,6 / 3 m) | (1v1) `duel-1v1.js:101-105` | les gardes du 105 m (2 / 4 / 6 m, `match-config.js:661-663`) |

**Ce qu'il faudrait pour le 11 contre 11** (non vérifié) :
- Porter les pièces du tableau, puis réserver l'entrée aux vrais 1 contre 1 : pas de soutien proche, pas de second défenseur. Sinon une tenue de 3 à 5 s fige une attaque à onze. Garder deux gardes : celle du duel pendant le face-à-face, celle du 105 m ailleurs.
- Dans L2, `faceAvant` ne tourne que dans `rondoStep`. L'adaptateur devrait l'appeler lui-même, avancer les gestes qu'il arme (sinon `act` reste posé et `movePlayers` saute le joueur), et traduire chaque geste en intention du corps.
- Or le contrat n'a pas d'intention « feinte » ni « semelle » (`contrat.mjs:6`), et le corps GPF n'a pas d'animation de dribble évidente (inventaire-moteur.md §10 ; animations.md).

## 9. Ce que L2 appelle et ce qu'il n'appelle pas

Les gestes concernés, ligne par ligne : inventaire-moteur.md §7 (décidés dans des parties que L2 n'appelle pas) et §8 (calculés dans le code que L2 appelle, puis jetés). L'adaptateur lui-même : [adaptateur.md](adaptateur.md).

### 9.1 Appelé par L2

| fonction | où dans L2 | ce que L2 en lit | ce que fait le corps ensuite |
|---|---|---|---|
| `makeMatch`, `matchCfg` | `cerveau.mjs:50`, `:53` | le monde et la configuration du cerveau | — |
| `matchInternals.assignMatchJobs` | `:245` | `job`, `target`, `push` ; la faute jugée | ALLER ou PRESSER vers la cible ; `gf_faute` ou `gf_carton` |
| `movePlayers` (dt = 0,1 s) | `:261` | `target`, `_wx/_wz` (vitesse voulue) | ALLER à la vitesse voulue (1,5 à 8 m/s) |
| `pressPredicate`, `tackleWindow` (+ `balPrenable`) | `:339`, `:342` | le défenseur qui s'engage | PRESSER « tacle » 0,7 s ; le tacle reste aux réflexes du corps |
| `accrocheStep` (par `cfg.accrocheMod`) | `:66`, `:305-308` | `st._faute` posée | le sifflet ou l'avantage aux ticks suivants |
| `arbitre` | `:445`, `:410` | `meilleure` : passe, centre, tir ou conduite | PASSER, TIRER ou CONDUIRE |
| `choosePass` | `:449`, `:458` | `to`, `lead`, `style`, `through`, `pSucc` | PASSER COURTE, LONGUE ou HAUTE vers le joueur |
| `ecartCorps`, `talonPermis` | `:465`, `:522`, `:526` | la passe hors du corps | CONDUIRE à 2 m/s pour se tourner d'abord |
| `uneTouche` | `:384` | `st.pass.to` | PASSER COURTE avant le contact |
| `butDansCorps` (+ `cfg.tete`, `cfg.volee`) | `:403-405` | la reprise au but possible | TIRER (reprise de la tête, de volée ou au sol) |
| `finitionSigma` (+ `gauss`, `tirage`) | `:499-512` | les écarts de cap, d'élévation, de vitesse | TIRER vers le point visé, à la puissance tirée |
| `tac`, `axe` ; `pressionDe` ; `BallBody` | `:66` ; `:470` ; `:182` | l'axe pressing ; la pression (trace) ; le ballon prêté | — |

### 9.2 Jamais appelé par L2 (ou calculé puis jeté)

| fonction | ce qu'elle décide | ce qu'il faudrait pour l'appeler | voir |
|---|---|---|---|
| `matchStep` | toutes les couches du pas | un monde que le cerveau possède entre deux ticks ; L2 le réécrit à chaque tick | §4.2 |
| `rondoStep` | le porteur complet, la réception, le jeu aérien, les glissés, les sorties | appeler ses morceaux un par un, comme aujourd'hui | §4.3 ; inventaire §7 |
| `stepGestures` | l'horloge des gestes | avancer `act`, ou l'effacer à chaque prêt ; sinon un geste armé fige son joueur | §4.7 ; inventaire §9 |
| `maybe*` (dribbles, feintes) | les gestes techniques du porteur | des intentions de geste dans le contrat, des animations dans le corps | §5.6 ; animations.md |
| `beginPass`, `strikeNow` | la technique de passe, l'armé, la dispersion | le corps choisit son geste ; le contrat ne dit que COURTE, LONGUE, HAUTE | inventaire §3.4 |
| `tryShot`, `tryCross`, `tryClear` | l'espèce et la préparation du tir ; le centre vers le coureur ; le dégagement | L2 refait le tir (`tirDuCerveau`) ; le centre passe par `choosePass` ; pas d'intention « dégager » | §5.11 |
| `receive` | le contrôle et son espèce | le corps contrôle seul | inventaire §3.6 |
| `teteStep`, `voleeStep`, `chestStep`, retournée | le jeu aérien hors reprise au but | — | §5.5 |
| `chargeStep`, `slideTackleStep`, `trySlide`, pique, `standTackleNow` | les duels joués | le corps a ses propres réflexes de tacle | §5.7 |
| `contreEngage`, `contreTir`, `jambeTendue` | les contres, la jambe tendue | à jouer au pas physique, avant le corps | §4.2 |
| `croyanceStep` | la perception de chacun | l'appeler à 10 Hz avant `assignMatchJobs`. Sans elle, `croyanceDe` rend la vérité : les cerveaux de L2 sont omniscients (`croyance.js:94-99`) | §4.2 |
| `piegeStep`, `piegeApply`, `horsJeuTente`, `familiariteStep` | la ligne synchrone, le hors-jeu tenté, l'automatisme | — | §4.2 |
| `arbitreStep`, `administerWhistle`, `onOut`, `ballFetch`, `canTake`, `onTakeMatch`, `chronoStep`, `stepRemplacements` | l'arbitre, le jeu arrêté, le temps, la Loi 3 | le jeu arrêté et le temps appartiennent au corps (`st.restart` effacé ; `chrono`, `loi3` à `null`) | §5.9, §5.10 |
| `keeperDecide`, `relancerGardien`, `onDive` | le gardien | calculé dans `assignMatchJobs` puis jeté : le gardien est à l'IA du corps | §5.8 ; inventaire §8 |
| `separatePlayers` | la séparation des corps | le corps GPF gère ses collisions | — |
| (1v1) `faceAvant` | le face-à-face | §8 | §8 |

### 9.3 Recettes pour appeler davantage

- **Prêter, appeler, lire, jeter.** Une fonction du moteur peut modifier `st` librement si son résultat est lu dans le même tick : le monde est reprêté au suivant. L2 le fait déjà pour la première intention (`cerveau.mjs:309-322`).
- **Armer le flux avant tout tirage** (`cerveau.mjs:212`) et ne pas redécider dans un même tick (§7). **Garder `st._decide = true`** : sinon `assignMatchJobs` s'arrête à la frontière du tick (`match-sim.js:414`).
- **Les gestes.** Toute fonction qui appelle `startGesture` (les `maybe*`, `beginPass`, la tête armée) laisse un `act` qui ne s'avance jamais. Il faut soit avancer le geste (`stepGesture`, `gesture.js:66`) et traduire son contact en action du corps, soit effacer `act` au prêt suivant.
- **Les durées.** `movePlayers` est appelé avec dt = 0,1 s : ses lissages et ses plafonds lisent ce dt. À un autre rythme d'appel, il faut les revoir.
- **Le calage.** Les lois du moteur sont calées sur son monde. Dès qu'une décision s'applique au corps, il faut la recaler sur les issues du corps, comme `selection`, `accrocheMod` et `retenueSurface` (§3.5).
- **L'omniscience.** Tant que `croyanceStep` n'est pas appelé, marqueurs et passeurs voient la vérité.
- **La politique du porteur.** Pour changer le cerveau du porteur dans la boucle complète du moteur, le crochet prévu est `cfg.decide` (§3.3). Dans L2, c'est `porteurDecide` qui joue ce rôle (`cerveau.mjs:428-482`).
