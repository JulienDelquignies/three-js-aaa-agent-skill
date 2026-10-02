# Inventaire des gestes du moteur de match (skill threejs-aaa, 11c11) — pour la comparaison avec le corps Gameplay Football

Date : 2026-10-02. Lecture seule du code (aucune exécution, aucun build, aucune commande git).

## 1. Périmètre et conventions

- **Moteur** : `~/DelkIT/skill-l2/skills/threejs-aaa/assets/starter/src/engine/`. La copie `examples/showcase/src/engine/` est identique (`diff -rq` vide). Les fichiers du moteur sont cités par leur nom seul (`skills-sim.js:103`).
- **Scène du match** : le 11c11 est la scène `Rondo` en mode `?match&full` (`examples/showcase/src/entry-match11.js`). Ses fichiers sont cités `scenes/…` ; `Rondo.js` est la scène elle-même.
- **Adaptateur L2** : `~/DelkIT/skill-l2/gpf-wasm/cerveau.mjs` (et `contrat.mjs`).
- **Corps rendu** : `shanon.glb` (Rondo.js:174) ; donneur de clips mocap `Soldier.glb` (Idle, Walk, Run, plus une piste TPose pour la liaison, squad.js:47-81). Aucun autre fichier d'animation `.glb` n'est chargé par le match.
- **Sources** :
  - *généré* : geste calculé par un générateur `motion-*.js`, enregistré dans `GENERATORS` (motion-cast.js:31-42). Il remplace l'authored du même nom (animkit-data.js:1014-1015) ;
  - *authored* : spec de keyframes de `MOVES` (animkit-data.js) qui reste en usage (seuls `amortiTete` et `retournee` en match) ;
  - *mocap* : clips de Soldier.glb ;
  - *procédural* : couche calculée à chaque image (foulée, attente, regard, posture, warp) ou logique de la sim sans clip propre.
- Chaque geste a son miroir pour le pied gauche (`mirrorMove`, nom suffixé `-gauche`), non compté à part.
- **Colonne « décidé par L2 ? »** :
  - **partiel** : L2 prend la décision de jeu dont ce geste est l'exécution et l'envoie en intention, mais pas le geste ; le corps choisit sa propre animation ;
  - **jeté** : calculé dans une fonction que L2 appelle, mais le résultat n'est pas transmis au corps ;
  - **non** : décidé dans une partie que L2 n'appelle pas. Les raisons sont abrégées ainsi :
    - `rondoStep` : le pas de jeu (rondo-sim.js:515), appelé seulement par `matchStep` (match-sim.js:1223) ;
    - `matchStep` : les couches du pas de match (match-sim.js:1214-1226) ;
    - `jeu arrêté` : L2 efface `st.restart` (cerveau.mjs:205), et les bancs n'appellent `decider` qu'en jeu, hors CPA (bancs/match-cerveau.mjs:57) ;
    - `rendu` : le geste est choisi par la scène, hors moteur ;
    - `gardien IA` : cerveau.mjs:267.

## 2. Ce que L2 appelle et transmet (rappel, avec lignes)

- **Ce que L2 appelle** :
  - `assignMatchJobs` (cerveau.mjs:245) ;
  - sa copie de la décision de tacle (`decideTacle`, :336-346, avec `pressPredicate` et `tackleWindow`) ;
  - `movePlayers` (:261) ;
  - pour le porteur, `arbitre` puis `choosePass` (:445-473) ;
  - le tir avec `finitionSigma` (:492-515) ;
  - `uneTouche` et la reprise au but avec `butDansCorps` (:372-417) ;
  - `accrocheStep` (:66, :305-308) ;
  - `talonPermis` et `ecartCorps` (:519-529).
- **Ce qui est transmis au corps** :
  - les intentions ALLER, PRESSER, PASSER (COURTE, LONGUE, HAUTE), TIRER, CONDUIRE, et IA pour les gardiens (contrat.mjs:6-7) ;
  - `poserIntention` ne transmet que `genre, x, y, vitesse, cible, puissance, drapeaux` (contrat.mjs:58-59). Les champs `reprise`, `uneTouche` et `job` restent des traces pour les bancs ;
  - les fautes et cartons (`gf_faute`, `gf_carton`, cerveau.mjs:248-258, contrat.mjs:53-55).
- **Jamais appelés** : `matchStep`, donc ni `rondoStep` (et `stepGestures`, rondo-sim.js:542), ni les couches de match (match-sim.js:1220-1222 : croyance, contre, jambe tendue, `arbitreStep`).

## 3. Le tableau des gestes

### 3.1 Locomotion

| nom | famille | source | ce que fait le corps | touche le ballon ? | déclenché par | décidé par L2 ? |
|---|---|---|---|---|---|---|
| `walk` | locomotion | généré (motion-gait.js:78) | marche : appui 62 %, déroulé talon-pointe, bassin et épaules en contre-rotation | non | foulée générée du contrôleur (`locomotion:'generee'`, Rondo.js:228), allure sol ≤ 1,4 m/s | partiel : L2 envoie cible + vitesse (ALLER/PRESSER/CONDUIRE, cerveau.mjs:290-299, 539-546) ; joueurs de champ seulement |
| `jog` | locomotion | généré (motion-gait.js:79) | trot : appui 34 %, phase de vol, buste 6° | non | allure ~2,5 m/s (interpolée, motion-gait.js:92-110) | partiel (idem) |
| `run` | locomotion | généré (motion-gait.js:80) | course : appui 27,5 %, talon vers la fesse, coudes à 90° | non | allure ~4,5 m/s | partiel (idem) |
| `sprint` | locomotion | généré (motion-gait.js:81) | sprint mesuré (Dorn 2012) : appui 26 %, buste 10°, bras amples | non | allure jusqu'à 9,5 m/s | partiel (idem ; L2 plafonne à 8 m/s) |
| `back` (course arrière) | locomotion | généré (motion-gait.js:83) | à reculons : sur l'avant-pied, genou devant en vol, buste droit, bras courts | non | vitesse vers l'arrière du regard (fondu de direction, gaitParams motion-gait.js:136-170) | non : le cap n'est pas transmis (contrat.mjs:58-59) |
| `lat` (pas chassés) | locomotion | généré (motion-gait.js:85) | pas chassés larges et bas, jamais croisés, buste penché, bras ouverts | non | vitesse latérale au regard (gardien, défenseur) | non (idem) |
| frein (`opts.brake`) | locomotion | généré (motion-gait.js:460, 470) | buste retenu en arrière, pied posé loin devant talon d'abord, base élargie, pas raccourcis | non | décélération mesurée / 6 m/s² (character-controller.js:362) | non : rendu |
| virage (`opts.turn`) | locomotion | généré (motion-gait.js:460, 476-479) | bassin et tronc roulent dans le virage (≤ 18°), pied extérieur plus large, tête d'aplomb | non | accélération latérale mesurée (character-controller.js) | non : rendu |
| départ (`opts.depart`) | locomotion | généré (motion-gait.js:471-475) | corps couché dans l'accélération (+13°), bassin plus bas, bras qui pompent, pas courts | non | accélération avant / 4,5 m/s² (character-controller.js:367) | non : rendu |
| pivot / piétinement (`pivotHz`, `pietine`) | locomotion | généré (motion-gait.js:126, 449, 477) | qui tourne sur place piétine : pas rapides et courts, un appui par ~60° de rotation | non | vitesse de lacet (character-controller.js:269-272) | non : rendu |
| receveur (`opts.receveur`) | locomotion | généré (motion-gait.js:450) | course de réception : bras calmes, un peu ouverts, balancier réduit | non | le ballon vole vers lui (idleCtx.receveur, Rondo.js:932) | non : rendu |
| boiterie (`opts.boite`) | locomotion | généré (motion-gait.js:465-469) | appui du côté touché raccourci, vol plus ras, bassin qui plonge de ce côté | non | fauché d'une faute grave : `_boite` 25 s (referee.js:823, dans adjugeFaute) | jeté : adjugeFaute tourne dans assignMatchJobs, `_boite` n'est pas transmis |
| marche mains sur les hanches (`opts.mainsHanches`) | locomotion | généré (motion-gait.js:595) | marche bras posés sur les hanches, sans balancier | non | rôle « marcheur » à > 25 m du ballon et v < 1,7, ou équipe abattue (character-controller.js:394) | non : rendu |
| griffé (`opts.griffe`) | locomotion | généré (motion-gait.js:461-463) | le pied griffe le sol avant l'appui (foulée de sprinteur) | non | coupé en 11c11 (Rondo.js:288 : `?griffe` ou mode duel seulement) | non : hors 11c11 |
| appui planté | locomotion | procédural : sim `appuiPas` (appui.js:36, movement.js:410) + rendu `appuiPose` (scenes/rondo-appui.js:28, Rondo.js:1114) | au-delà de 40° de changement de cap, le joueur plante : bassin −4 à −10 cm, buste incliné dans l'accélération (≤ 24°) | non | changement de direction ≥ 40° (appui.js) | jeté : movePlayers l'exécute, mais la vitesse voulue transmise est posée avant (movement.js:401-404) |
| `Idle` / `Walk` / `Run` (Soldier) | locomotion | mocap (Soldier.glb, retargeté, squad.js:47-81) | l'ancienne locomotion : trois clips mélangés par la vitesse | non | joueurs : seulement `?foulee=clips` (Rondo.js:228) ; officiels et ramasseurs : toujours (arbitre.js:29-31, contrôleur par défaut `'clips'`, character-controller.js:22, 28) | non : rendu |

### 3.2 Conduite

| nom | famille | source | ce que fait le corps | touche le ballon ? | déclenché par | décidé par L2 ? |
|---|---|---|---|---|---|---|
| `conduiteInterieur` | conduite | généré (motion-control.js:36) | touche courte de l'intérieur : le pied va au ballon et le pousse vers le dedans, la jambe continue devant | oui, intérieur | événement 'touche' nommé `conduite-interieur` (skills-sim.js:730-743), joué si le virage ≥ 20° (Rondo.js:875) | partiel : L2 décide la conduite (CONDUIRE : direction de la poussée, 2-6 m/s, cerveau.mjs:539-546) ; les touches sont celles du corps (dribbleStep vit dans rondoStep, rondo-sim.js:646-667) |
| `conduiteExterieur` | conduite | généré (motion-control.js:37) | touche de l'extérieur, cheville en inversion, ballon poussé vers le dehors | oui, extérieur | poussée > 12° vers le dehors du pied (skills-sim.js:739) → Rondo.js:875 | partiel (idem) |
| `conduiteLaces` | conduite | généré (motion-control.js:38) | touche du cou-de-pied en course, pointe basse | oui, cou-de-pied | nommée si v ≥ 3 m/s et poussée à ±12° (skills-sim.js:741) ; **jamais jouée** à la lecture : Rondo.js:875 exige un virage ≥ 20° ou une touche extérieur/semelle (non vérifié à l'exécution) | partiel (idem) |
| `conduiteSemelle` | conduite | généré (motion-control.js:39) | presque arrêté, la semelle se pose sur le ballon et le retient | oui, semelle | porteur < 1 m/s (skills-sim.js:738) → Rondo.js:875 | partiel (idem) |
| touche droite (warp de touche) | conduite | procédural (scenes/rondo-touche.js ; Rondo.js:725, 867-873) | sur la foulée, le pied libre est tiré vers le ballon (IK deux os) à l'instant prévu de la touche | oui, pied qui joue | chaque 'touche' de la sim, prévue ≤ 0,1-0,2 s avant | partiel (idem) |
| posture du porteur (`conduitePose`) | conduite | procédural (scenes/rondo-porteur.js:30 ; Rondo.js:1114) | bassin −2 cm, buste penché de 11° sur le ballon ; sous pression (< 3 m) −4 cm, pivote de 12° pour mettre le corps entre l'adversaire et le ballon, bras écarté | non | porteur sans geste en cours | non : rendu |
| foulée réglée sur la touche (`fouleeSteer`) | conduite | procédural (scenes/rondo-foulee.js ; Rondo.js:951) | les derniers pas sont accélérés ou retenus pour arriver au ballon avec le pied en fin de vol | non | touche prévue par la sim (≤ 0,2 s) | non : rendu |
| `pausa` | conduite | généré, attente (motion-idle.js:61) | le porteur s'arrête net, semelle sur le ballon réel, poids sur l'autre jambe, mains sur les hanches | oui, semelle posée | `pausaStep` (pausa.js:40, appelé rondo-sim.js:965) pose `_pausa` → attente forcée (Rondo.js:934) | non : rondoStep |

### 3.3 Dribble ou feinte

| nom | famille | source | ce que fait le corps | touche le ballon ? | déclenché par | décidé par L2 ? |
|---|---|---|---|---|---|---|
| `rateau` | dribble ou feinte | généré (motion-skill.js:29) | la semelle agrippe le ballon puis la hanche balaie en arrière : le ballon raclé sous le corps qui se retourne (lacet écrit par la sim) | oui, semelle | `maybeRateau` (skills-sim.js:103-144, appelé rondo-sim.js:831) : presseur de face qui charge ≥ 1,5 m/s, sortie arrière libre, tirage flair × gesteF² ; au rendu, virage 110-150° lent ou ≥ 150° (scenes/rondo-virage.js:29, 33, 35) | non : rondoStep / rendu |
| `arretSemelle` | dribble ou feinte | généré (motion-skill.js:30) | la plante se pose sur le ballon et y reste, la tête se lève | oui, semelle | `maybeSemelle` (skills-sim.js:187-232, rondo-sim.js:975) : porteur au calme, adversaire loin, jamais dans le dernier tiers ; preneur d'une sortie de but (petits-gestes.js:12-22, referee.js:646) → 'geste' (Rondo.js:851) | non : rondoStep / jeu arrêté |
| `roulette` | dribble ou feinte | généré (motion-skill.js:31) | 360° sur le ballon : la semelle le tire, le corps tourne autour en restant entre le poursuivant et le ballon | oui, semelle | `maybeRoulette` (skills-sim.js:519-558, rondo-sim.js:829) : porteur ≥ 1,5 m/s, poursuivant en diagonale-dos (55-140°) qui ferme, tirage rare × gesteF³ × agilité ; virage ≥ 150° si gesteF ≥ 1 (scenes/rondo-virage.js:34) | non |
| `passementJambes` | dribble ou feinte | généré (motion-skill.js:35) | la jambe décrit un cercle par-dessus le ballon immobile, le buste plonge du côté vendu, le pied se plante à côté, départ de l'autre bord | non (le pied passe au-dessus) | `maybePassement` (skills-sim.js:238-322, rondo-sim.js:835) : jockey posté de face (≤ 70°) qui ne charge pas, une sortie latérale libre, v ≤ 6 m/s ; sortie contre-pied, fixe ou temporise (:300-304) | non |
| `passementJambes2` … `passementJambes6` (5 gestes) | dribble ou feinte | généré (motion-skill.js:57-60, le cercle répété) | 2 à 6 passements enchaînés (Mancini) | non | même déclencheur, tours tirés (skills-sim.js:286-296 : jockey ≥ 1,4 m, enchaînement × gesteF²) | non |
| `crochet` | dribble ou feinte | généré (motion-skill.js:37) | l'intérieur du pied va chercher le ballon de l'autre côté du corps et le coupe à 70-95° derrière la jambe d'appui | oui, intérieur | `maybeCrochet` (skills-sim.js:327-391, rondo-sim.js:836) : porteur ≥ 1,2 m/s, défenseur devant (≤ 75°) qui ferme, sortie libre ; espèce standard (:372-375) ; virage 60-150° (scenes/rondo-virage.js:26, 30) | non |
| `crochetCourt` | dribble ou feinte | généré (motion-skill.js:40) | le chop sec : le pied croise vite, coupe de 50-75° en une demi-foulée | oui, intérieur | `maybeCrochet` si défenseur < 1,45 m ou tirage (skills-sim.js:374) ; virage 60-110° lancé ≥ 3 m/s (rondo-virage.js:26) ; touche forte cassée ≥ 110° (Rondo.js:881-886) | non |
| `crochetChaloupe` | dribble ou feinte | généré (motion-skill.js:41) | le buste ment d'abord du mauvais côté, puis l'intérieur coupe large (~95°) | oui, intérieur | `maybeCrochet` si défenseur ≥ 1,45 m, v ≥ 2 m/s, tirage × flair (skills-sim.js:373) ; virage 60-110° face à un adversaire < 3 m, gesteF ≥ 0,9 (rondo-virage.js:25) | non |
| `crochetExterieur` | dribble ou feinte | généré (motion-skill.js:43) | le pied passe à côté du ballon et le pousse de l'extérieur, du côté du pied | oui, extérieur | rendu seul : virage 60-150° avec le ballon du côté du virage (scenes/rondo-virage.js:24, 30) | non : rendu |
| `cruyff` | dribble ou feinte | généré (motion-skill.js:46) | armé et fausse frappe à côté du ballon, puis l'intérieur le tire derrière la jambe d'appui (demi-tour) | oui, intérieur | rendu seul : virage ≥ 150° face à un adversaire < 4 m, ou en alternance avec le râteau (rondo-virage.js:32, 35) | non : rendu |
| `doubleContact` (croqueta) | dribble ou feinte | généré (motion-skill.js:50) | deux touches sèches qui passent le ballon d'un pied à l'autre sous le corps, le bassin glisse avec | oui, intérieur des deux pieds | `maybeDoubleContact` (skills-sim.js:401-446, rondo-sim.js:827) : défenseur de face (≤ 55°) qui se jette (≥ 2,2 m/s), tirage × gesteF³ | non |
| `petitPont` | dribble ou feinte | généré (motion-skill.js:53) | pichenette sèche entre les jambes du défenseur, corps déjà bas, puis contournement | oui, pied (pichenette) | `maybePetitPont` (skills-sim.js:458-505, rondo-sim.js:828) : défenseur de face qui glisse en pas chassés (≥ 1,2 m/s), espace libre derrière lui | non |
| `grandPont` | dribble ou feinte | généré (motion-skill.js:54) | poussée sèche d'un côté du défenseur, le porteur le contourne de l'autre et repart | oui, pied (poussée) | `maybeGrandPont` (grand-pont.js:26-72, appelé rondo-sim.js:828) : porteur ≥ 2 m/s, défenseur de face (≤ 35°) qui s'engage, espace derrière lui | non |
| `feintePasse` | dribble ou feinte | généré (motion-strike.js:72) | tout l'armé d'une passe, le swing se retient sur le ballon | non (le ballon ne part pas) | `maybeFeinte` (skills-sim.js:148-183, rondo-sim.js:1000) : une vraie passe prête, un défenseur dans le cône de la fausse direction, pas de duel sur le ballon | non |
| `feinteFrappe` | dribble ou feinte | généré (motion-strike.js:73) | tout l'armé d'une frappe, la jambe meurt sur le ballon ; le contreur s'assoit | non | `maybeFeinteFrappe` (skills-sim.js:564-597, rondo-sim.js:887) : à ≤ 25 m du but, un contreur dans le cône du but | non |
| `feinteAppel` | dribble ou feinte | généré, haut du corps (motion-skill.js:52) | sans ballon : le buste vend un départ d'un côté (épaule, lacet) puis repart de l'autre | non | `feinteAppelAt` (petits-gestes.js:72-77) au départ d'un appel (movement.js:183-184), soutien ≤ 2,2 m/s, une fois par 20 s → 'geste' (Rondo.js:851) | jeté : movePlayers pousse l'événement, L2 ne le transmet pas |
| variante basse `@bas` (`specBas`) | dribble ou feinte | procédural sur généré (scenes/rondo-corps.js:142 ; Rondo.js:482) | sous pression, le geste technique est re-généré bassin plus bas (≤ 14 cm), jambes ré-résolues | selon le geste | tout geste de la famille skill joué à ≤ 2,5 m d'un adversaire | non : rendu |

### 3.4 Passe

| nom | famille | source | ce que fait le corps | touche le ballon ? | déclenché par | décidé par L2 ? |
|---|---|---|---|---|---|---|
| `passe` | passe | généré (motion-strike.js:58 ; technique.js:65-68) | passe de l'intérieur : pendule depuis la hanche, hanche ouverte, buste droit, tête sur le ballon | oui, intérieur | `beginPass` (strike-sim.js:85-351) : technique planifiée par atteignabilité (`planStrike`, :219-235), lancée par le bloc porteur (rondo-sim.js:910, 1009) | partiel : L2 décide la passe, sa cible et son type (arbitre + choosePass, cerveau.mjs:445-473 ; COURTE/LONGUE/HAUTE :468) ; le geste n'est pas choisi (beginPass non appelé) |
| `passe_course` | passe | généré (variante, motion-strike.js:94, 104-110) | passe dans la foulée : buste devant, sans assise, bras de course bas | oui, intérieur | rendu : passeur ≥ 3 m/s (scenes/rondo-passe.js:40) sur l'armé 'windup' (Rondo.js:835) | non : rendu |
| `passe_ouverte` | passe | généré (variante, motion-strike.js:95) | le bassin pivote vers la cible au contact (24°) | oui, intérieur | cible à 50-135° du côté naturel (rondo-passe.js:38) | non : rendu |
| `passe_levee` | passe | généré (variante, motion-strike.js:96) | buste en arrière, pied sous le ballon, accompagnement haut | oui, intérieur (dessous) | passe 'lofted' (rondo-passe.js:36) | non : rendu |
| `passe_tendue` | passe | généré (variante, motion-strike.js:97) | genou sur le ballon, pointe basse, accompagnement court | oui, intérieur | passe 'driven' ≥ 18 m (rondo-passe.js:41) | non : rendu |
| `passe_protegee` | passe | généré (variante, motion-strike.js:98) | bras côté appui écarté vers l'adversaire, appuis bas, armé court | oui, intérieur | adversaire < 1,5 m (rondo-passe.js:37) | non : rendu |
| `passe_exterieur` | passe | généré (variante, motion-strike.js:102) | passe de l'extérieur vers le côté non naturel | oui, extérieur | cible à 40-120° du côté non naturel (rondo-passe.js:39) | non : rendu |
| `passeRapide` | passe | généré (motion-strike.js:74 ; technique.js:70-76) | même surface que la passe, armé de poussée court (0,22 s) | oui, intérieur | `beginPass` sous pression ou urgence (armé le plus prompt, strike-sim.js:257-263) | partiel (comme `passe`) |
| `passeRapide_course` | passe | généré (variante) | passe pressée dans la foulée | oui, intérieur | rondo-passe.js:40 | non : rendu |
| `passeRapide_ouverte` | passe | généré (variante) | passe pressée, bassin ouvert vers la cible | oui, intérieur | rondo-passe.js:38 | non : rendu |
| `passeRapide_tendue` | passe | généré (variante) | passe pressée tendue | oui, intérieur | rondo-passe.js:41 | non : rendu |
| `passeRapide_protegee` | passe | généré (variante) | passe pressée, bras vers l'adversaire | oui, intérieur | rondo-passe.js:37 (pas de `_levee` ni de `_exterieur` : motion-strike.js:106-107) | non : rendu |
| `passeExterieur` | passe | généré (motion-strike.js:67 ; technique.js:78-81) | extérieur du pied opposé, jambe sous le corps, presque une pichenette | oui, extérieur | `beginPass` quand le ballon est du mauvais côté ; touche forte cassée de 60-110° (Rondo.js:881-886) | partiel (comme `passe`) ; la touche forte : non (rondoStep) |
| `passePivot` | passe | généré (motion-strike.js:70 ; technique.js:93-97) | se retourner avec le ballon : le bassin mène, frappe de l'intérieur en fin de tour | oui, intérieur | `beginPass`, passe vers l'arrière avec un tour à faire (orientationPasse, strike-sim.js:190-207) | partiel : L2 ne choisit pas le geste ; il fait d'abord tourner le porteur avec le ballon (CONDUIRE à 2 m/s, cerveau.mjs:454-461, 531-536) |
| `talonnade` | passe | généré (motion-strike.js:71 ; technique.js:88-91) | fouetté du talon vers l'arrière, bassin carré, tête haute | oui, talon | `beginPass` pressé de face, cible derrière (> 130°), camp adverse (strike-sim.js:150-159, 200-201) ; une-touche qui repart derrière (une-touche-geste.js:32, 34) | partiel : L2 laisse partir une passe hors du corps avec p = 2 % quand la talonnade est permise (cerveau.mjs:519-529) ; le geste est le « 180 » du corps |
| `deviation` | passe | généré (motion-strike.js:68 ; technique.js:99-103) | remise de première : rien ne s'arme, le pied se pose sur la trajectoire et redirige | oui, intérieur | `beginPass` en improvisation (urgence, strike-sim.js:241-263) ; parent des gestes de une-touche | partiel : L2 décide la une-touche (uneTouche → PASSER COURTE, cerveau.mjs:384-387) ; le geste n'est pas transmis |
| `deviation_course` | passe | généré (variante, motion-strike.js:104-110) | une-touche dans la course | oui, intérieur | une-touche ≥ 3 m/s (une-touche-geste.js:39) ; armée : rondo-passe.js:40 | jeté : `gesteUneTouche` tourne dans `uneTouche` (premiere-intention.js:132), son nom part dans l'événement 'pass' (:152) |
| `deviation_ouverte` | passe | généré (variante) | une-touche de côté, le bassin s'ouvre vers l'intérieur | oui, intérieur | sortie ≥ 50° du côté de l'intérieur (une-touche-geste.js:38) | jeté |
| `deviation_protegee` | passe | généré (variante) | une-touche, le bras écarté vers l'adversaire collé | oui, intérieur | adversaire ≤ 1,5 m (une-touche-geste.js:39) | jeté |
| `deviation_remise` | passe | généré (motion-strike.js:120, 125) | rendue d'où elle vient : plat du pied bloqué, sans armé | oui, intérieur bloqué | déviation > 140° (une-touche-geste.js:32) | jeté |
| `deviation_exterieur` | passe | généré (motion-strike.js:121, 125) | le pied se retourne, la jambe ne croise pas | oui, extérieur | sortie de côté, du côté du pied qui joue (une-touche-geste.js:37) | jeté |
| `deviation_prolonge` | passe | généré (motion-strike.js:122, 125) | pichenette de l'extérieur qui laisse filer le ballon dans sa ligne | oui, extérieur | déviation < 35°, ou < 80° derrière (une-touche-geste.js:33) | jeté |
| centre (action) | passe | pas de clip propre : le geste du plan (passe, frappe…), puis la variante levée | passe levée ou rasante vers la surface | oui | `tryCross` (shooting.js:208-290 → beginPass :282), appelé rondo-sim.js:889 | partiel : L2 décide « centre » puis choosePass → PASSER HAUTE (cerveau.mjs:448-468) ; tryCross non appelé |
| dégagement (action) | passe | pas de clip propre : la ligne `degagement` (technique.js:194-197, clip `frappe`) n'est jamais candidate (beginPass ne garde que l'intent 'pass', strike-sim.js:139 ; filtre strict, technique.js:314) | le ballon mis loin avec le geste du plan | oui | `tryClear` (shooting.js:292-352), rondo-sim.js:893 | non : rondoStep (L2 n'a pas d'intention « dégager ») |

### 3.5 Tir

| nom | famille | source | ce que fait le corps | touche le ballon ? | déclenché par | décidé par L2 ? |
|---|---|---|---|---|---|---|
| `frappe` | tir | généré (motion-strike.js:55) | frappe du cou-de-pied : séquence proximo-distale, bassin figé à l'appui, buste en arrière, tête sur le ballon | oui, cou-de-pied | tir ras-de-terre, flottant ou mi-hauteur (défaut de `shotKind`, strike-sim.js:165-169 ; tryShot shooting.js:21-195, appelé rondo-sim.js:885) ; aussi la passe longue `passe-laces` (technique.js:83-86), la volée (Rondo.js:901) et la course d'élan des CPA (elan.js:141-145) | partiel : L2 décide le tir (TIRER : point visé, puissance, cerveau.mjs:475-479, 492-515), pas son espèce ; le geste est celui du corps |
| `frappePuissante` | tir | généré (motion-strike.js:56) | élan ample : armé profond, buste plus en arrière, la traversée emmène le corps | oui, cou-de-pied | `shotKind` puissance ou lucarne (strike-sim.js:166) | non : l'espèce vient de tryShot (rondoStep) |
| `frappeEnroulee` | tir | généré (motion-strike.js:57) | l'intérieur enveloppe : corps ouvert, jambe en travers, traversée croisée | oui, intérieur | enroulée, placé ou croisé (strike-sim.js:166) | non (idem) |
| `frappePointu` | tir | généré (motion-strike.js:69) | bout du pied sans élan lisible, extension sèche du genou | oui, pointe | pointu, piqué ou lob (strike-sim.js:166) | non (idem) |
| volée / demi-volée (action) | tir | clip `frappe` joué depuis son contact (Rondo.js:894-905) | reprise du pied d'un ballon entre 0,25 et 1,15 m | oui, cou-de-pied | `voleeStep` (tete.js:242-305) : au but à < 14 m dans la surface, le but dans le corps ; sinon dégagement (:279) ; appelé rondo-sim.js:1027 | partiel : L2 décide la reprise au but en première intention (`repriseAuBut` 'volee' ou 'sol', cerveau.mjs:398-417 → TIRER) ; le tag `reprise` n'est pas transmis |
| penalty (action) | tir | pas de geste propre trouvé (tir ordinaire) — non vérifié | — | oui | remise 'penalty' puis tir | non : jeu arrêté |

### 3.6 Contrôle

Au rendu, l'espèce de contrôle est re-choisie par la situation (`choisirControle`, controle-situation.js:19-39, via scenes/rondo-pied.js:38-62). Seules la semelle et la prise du gardien gardent le nom donné par la sim (rondo-pied.js:15, 41).

| nom | famille | source | ce que fait le corps | touche le ballon ? | déclenché par | décidé par L2 ? |
|---|---|---|---|---|---|---|
| `controleInterieur` | contrôle | généré (motion-control.js:29) | le pied va chercher le ballon (intérieur) puis recule avec lui pour l'amortir | oui, intérieur | réception 'control' ou 'receive' (`receive`, rondo-sim.js:230-387 ; Rondo.js:842-866) ; défaut au sol (controle-situation.js:39 ; repli Rondo.js:477) | non : receive vit dans rondoStep ; sans première intention, L2 laisse le corps contrôler (cerveau.mjs:369-388) |
| `controleExterieur` | contrôle | généré (motion-control.js:30) | contrôle de l'extérieur : corps ouvert, ballon emmené sur le côté | oui, extérieur | orienté du côté du ballon (controle-situation.js:37) | non |
| `controleOriente` | contrôle | généré (motion-control.js:31) | l'intérieur reçoit pendant que hanches et regard s'ouvrent vers la course | oui, intérieur | virage voulu ≥ 45° (controle-situation.js:36 ; Rondo.js:849) | non |
| `controleSemelle` | contrôle | généré (motion-control.js:40) | la semelle se pose sur le ballon et l'arrête net | oui, semelle | technique `controle-semelle` choisie par la sim (rondo-sim.js:271-272) | non |
| `amortiCuisse` | contrôle | généré (motion-control.js:41) | la cuisse monte à l'horizontale, buste en arrière, le ballon retombe devant | oui, cuisse | ballon entre 0,5 et 1,05 m (controle-situation.js:27) ; amorti de la retombée (tete.js:283-300) | non |
| `amorti` (poitrine) | contrôle | généré (motion-control.js:44) | la poitrine s'offre, cambré modéré, genoux qui plient | oui, poitrine | ballon ≥ 1,05 m (controle-situation.js:26) ; poitrine en vol (`chestStep`, tete.js:315-372) ; repli > 0,55 m (Rondo.js:477) | non |
| `controleCourse` | contrôle | généré (motion-control.js:57) | dans la course : le pied reçoit et pousse devant, sans arrêt | oui, intérieur | receveur ≥ 3 m/s, virage < 45° (controle-situation.js:33) | non |
| `controlePivot` | contrôle | généré (motion-control.js:58) | ballon de dos ou demi-tour : intérieur très ouvert, bassin et regard qui tournent | oui, intérieur | arrivée de dos ≥ 110° ou virage ≥ 100° (controle-situation.js:32) | non |
| `controleProtection` | contrôle | généré (motion-control.js:59) | adversaire collé : bassin bas, bras vers lui, ballon sur le pied loin de lui | oui, intérieur | adversaire < 1,5 m (controle-situation.js:30) | non |
| `controleAmortiFort` | contrôle | généré (motion-control.js:60) | ballon appuyé : la jambe va loin et recule franchement avec lui | oui, intérieur | ballon ≥ 9 m/s (controle-situation.js:34) | non |
| `priseSimple` | contrôle | généré (motion-control.js:61) | ballon mort : petit geste, sans théâtre, tête basse | oui, intérieur | ballon < 2 m/s (controle-situation.js:31) | non |
| `controleRebond` | contrôle | généré (motion-control.js:62) | pied levé au-dessus du rebond, qui l'écrase au sol | oui, semelle | ballon entre 0,2 et 0,5 m (controle-situation.js:28) | non |
| `amortiTete` | contrôle | authored (animkit-data.js:583-592) | la tête monte chercher le ballon, cède au contact, puis s'abaisse vers les pieds | oui, tête | ballon ≥ 1,55 m (controle-situation.js:25) ; armé si `amortiTetePossible` (tete.js:177 ; amorti-oriente.js:41) ; contrôle 'amorti-tete' (tete.js:132) | non : tete.js vit dans rondoStep (rondo-sim.js:1027) |
| `reception` (attente) | contrôle | généré, attente (motion-idle.js:57) | le receveur attend le ballon en vol : pieds larges, genoux fléchis, bras calmes, tête haute | non | ballon en vol vers lui (idlePolicy motion-idle.js:211 ; Rondo.js:932) | non : rendu |

### 3.7 Jeu aérien

| nom | famille | source | ce que fait le corps | touche le ballon ? | déclenché par | décidé par L2 ? |
|---|---|---|---|---|---|---|
| `tete` | jeu aérien | généré (motion-aerial.js:20) | saut de tête : accroupi, détente, buste cambré qui fouette au contact, réception fléchie | oui, front | `teteArmerStep` (tete.js:158-185) : ballon prédit au-dessus de la tête debout, joueur à portée ; réactif `teteStep` au but, en dégagement ou en remise (tete.js:25-150) → Rondo.js:894-905 | partiel : seule la tête AU BUT en première intention vient de L2 (`repriseAuBut` 'tete', cerveau.mjs:403 → TIRER) ; dégagement et remise : non |
| `teteDebout` | jeu aérien | généré (motion-aerial.js:21) | tête debout : le buste se cambre court, le cou fouette, jambes à la locomotion | oui, front | idem, ballon sous le front debout (tete.js:166-169) | partiel (idem) |
| `teteDefensive` | jeu aérien | généré (motion-aerial.js:22) | dégagement de la tête : même saut, armé plus en arrière, le front passe sous le ballon vers le haut | oui, front | tête sautée à < 24 m de son but, hors tête au but (petits-gestes.js:64-70 ; tete.js:178 ; Rondo.js:901) | non |
| `retournee` | jeu aérien | authored (animkit-data.js:500-509) | ciseau retourné : détente, corps couché en l'air, la jambe droite par-dessus la tête, retombée | oui, cou-de-pied | `retourneeArmerStep` (tete.js:195-214) : ballon à 1,5-2,1 m, attaquant dos au but dans la surface à < 16 m, personne à 1,5 m | non |
| duel aérien (action) | jeu aérien | pas de clip propre (les deux corps jouent `tete` ou `teteDebout`) | — | oui, front | 'duel' de type aérien (tete.js:70, 87) ; la scène ne traite que le duel d'épaule (Rondo.js:852) | non |

### 3.8 Gardien

| nom | famille | source | ce que fait le corps | touche le ballon ? | déclenché par | décidé par L2 ? |
|---|---|---|---|---|---|---|
| `plongeon` | gardien | généré (motion-keeper.js:25) | détente latérale à deux mains (1,35 m de root motion), couché, relevé par étapes | oui, mains | `keeperDecide` 'dive' (keeper.js:185) → espèce (match-sim.js:373-398) | jeté : assignMatchJobs arme le plongeon, le gardien reçoit INTENTION.IA (cerveau.mjs:267) |
| `plongeonBas` | gardien | généré (motion-keeper.js:26) | plongeon ras : hanches qui descendent, bras au ras du sol | oui, mains | croisement à < 0,85 m de haut (match-sim.js:378) | jeté |
| `plongeonUneMain` | gardien | généré (motion-keeper.js:27) | plongeon loin : seul le bras du dessus est tendu | oui, main | croisement à > 1,35 m de côté (match-sim.js:379) | jeté |
| `plongeonPrise` | gardien | généré (motion-keeper.js:28) | prise aérienne : détente verticale, bras au-dessus de la tête avant le contact, retombée sur les appuis | oui, mains | croisement ≥ 1,35 m de haut (match-sim.js:377) ; sortie aérienne sur centre (sortie-aerienne.js:23-66) | jeté |
| `sortiePoing` | gardien | généré (motion-keeper.js:29) | saut, un genou levé, les deux poings frappent à travers le ballon | oui, poings | sortie aérienne quand l'attaquant arrive avec le ballon (sortie-aerienne.js:50-59) | jeté |
| `paradePieds` | gardien | généré (motion-keeper.js:30) | la jambe claque, latérale et tendue, le corps contre-penche | oui, pied | 'arrêt' du pied : ballon au sol à < 0,8 m dans la surface (match-sim.js:345-349) → Rondo.js:853-857 | jeté |
| `paradeBuste` | gardien | généré (motion-keeper.js:31) | la poitrine encaisse le tir, les avant-bras devant | oui, poitrine | `busteBlock` (keeper.js:62-78) à la réception (rondo-sim.js:258) | non : receive dans rondoStep (aussi atteignable par la prise au pied, match-sim.js:347 — non vérifié) |
| `ramassage` | gardien | généré (motion-restart.js:36) | il se baisse en fente, cuillère à deux mains au sol, se relève ballon à la poitrine | oui, mains | prise 'prise-gardien' d'un ballon < 0,5 m (Rondo.js:849 ; décision match-sim.js:338-350) ; ramasseurs (ramasseurs.js:39) | jeté (la prise est décidée dans assignMatchJobs) |
| `rouleMain` | gardien | généré (motion-restart.js:34) | relance roulée à deux mains par en dessous, en fente avant | oui, mains | `relancerGardien` en style court (keeper.js:314-327), appelé match-sim.js:319 ; ramasseur qui renvoie le ballon (ramasseurs.js:43) | jeté |
| `voleeGardien` | gardien | généré (motion-restart.js:39) | dégagement de volée : le ballon lâché tombe, le cou-de-pied le prend à mi-hauteur | oui, mains puis cou-de-pied | `relancerGardien`, ballon aux gants > 0,6 m (keeper.js:312, 342, 363, 368) | jeté |
| `pretGardien` | gardien | généré, attente (motion-idle.js:50) | attente du gardien : bas, large, gants devant | non | gardien, ballon à < 32 m (motion-idle.js:205-207) | non : rendu |
| prise debout (composite) | gardien | réemploi `amorti` (> 0,55 m) ou `controleInterieur`, avec un warp procédural des gants (Rondo.js:477, 713) | les mains vont au ballon sur un corps qui amortit | oui, mains | 'control' de technique `prise-gardien` (rondo-sim.js:261) ; la technique n'existe pas dans la table → repli de `_playTech` | non : rondoStep |

### 3.9 Défense ou duel

| nom | famille | source | ce que fait le corps | touche le ballon ? | déclenché par | décidé par L2 ? |
|---|---|---|---|---|---|---|
| `tacleDebout` | défense ou duel | généré (motion-control.js:63) | on reste sur ses appuis, fente, le bassin descend, la jambe la plus proche se tend vers le ballon | oui, intérieur | `beginStandTackle` (rondo-sim.js:167-173), quand la pression atteint l'horloge du tacle et que le ballon est prenable (rondo-sim.js:748-750) | partiel : L2 refait la décision (`decideTacle`, cerveau.mjs:336-346) et envoie PRESSER `tacle` pendant 0,7 s (:270) ; le geste reste au corps |
| `tacle` (glissé) | défense ou duel | généré (motion-ground.js:24) | glissé pieds devant : assis sur la hanche, jambe tendue au ras du sol, l'autre repliée, couché puis relevé | oui, semelle | `slideTackleStep` (duel.js:45-160, rondo-sim.js:767) : porteur ≥ 4 m/s, défenseur ≥ 4,2 m/s à 1,3-2,6 m ; `trySlide` sur ballon libre (rondo-sim.js:438-514, appelé :704) ; 'slide' → Rondo.js:842-849 | non : rondoStep. Voir l'observation 9.1 : le clip n'est peut-être jamais dessiné |
| tacle-pique (action) | défense ou duel | pas de clip | le bout du pied pique le ballon libre entre deux touches | oui, pointe | rondo-sim.js:676-699 → 'tacle-pique' (aucune branche de rendu, Rondo.js:829-905) | non |
| `epaule` | défense ou duel | généré (motion-contact.js:60) | duel d'épaule : le corps se penche et s'appuie, coude rentré, appui large | non | `chargeStep` (duel.js:226-285, rondo-sim.js:757) → 'duel' d'épaule (:265) → scenes/rondo-contact.js:26-30 | non : rondoStep |
| `protection` | défense ou duel | généré (motion-contact.js:61) | le bouclier : bras tendu vers l'adversaire, tronc tourné à l'opposé, ballon sous l'autre pied ; tenu | non (ballon gardé) | rendu : porteur avec un adversaire à ≤ 1,4 m sur le flanc ou dans le dos (scenes/rondo-contact.js:66-89, Rondo.js:967) ; tenue dos au but de la sim (`bouclierStep`, bouclier.js:50, rondo-sim.js:965) | non : rendu / rondoStep |
| `duelCorps` | défense ou duel | généré (motion-contact.js:65) | épaule engagée, penché vers l'adversaire, bras sur lui ; haut du corps, tenu | non | rendu : joueur debout avec un adversaire à ≤ 0,95 m devant ou de côté, hors porteur (scenes/rondo-corps.js:13-35, Rondo.js:967) | non : rendu |
| `pret` (attente) | défense ou duel | généré (motion-idle.js:49) | la garde du défenseur : pieds larges, genoux fléchis, buste penché, bras devant | non | défenseur à < 5,5 m du porteur, à l'arrêt (motion-idle.js:213) | non : rendu |
| jockey (`opts.jockey`) | défense ou duel | généré (motion-gait.js:452-454) | recul-frein face au porteur : bassin plus bas, buste penché, pieds larges, bras ouverts | non | défenseur à 2-4,5 m du porteur qui recule ou se décale (idleCtx.jockey, Rondo.js:932) ; sim : plafond 2,9 m/s et face au porteur (movement.js:287-291, 498-504) | partiel : L2 envoie l'approche sous contrôle (garde côté but, vitesse du porteur + 1, ou la vitesse voulue plafonnée, cerveau.mjs:278-299), pas la posture ni le regard |
| posture basse du duel (`duelPose`) | défense ou duel | procédural (scenes/rondo-corps.js:102 ; Rondo.js:1114) | à < 1,8 m d'un adversaire : bassin −3 à −9 cm, buste +6 à +18°, bras d'équilibre ouverts | non | tout joueur de champ debout près d'un adversaire debout | non : rendu |
| contre, bloc de tir (action) | défense ou duel | pas de clip | le corps sur la ligne encaisse la frappe | oui, corps | `contreEngage` / `contreTir` (duel.js:387-466), appelés par matchStep (match-sim.js:1220) | non : matchStep |
| jambe tendue (action) | défense ou duel | redessinée au rendu en espèce de contrôle | le receveur attitré touche la passe qui allait le déborder | oui, pied | `jambeTendue` (duel.js:469-487, match-sim.js:1221) → 'control' (Rondo.js:842-849) | non : matchStep |
| défenseur mordu (action) | défense ou duel | pas de clip | le défenseur qui mord la feinte est ralenti, « assis » | non | `_bite` posé au contact du geste (skills-sim.js:602 et suivantes, :632) | non |

### 3.10 Chute ou relevé

| nom | famille | source | ce que fait le corps | touche le ballon ? | déclenché par | décidé par L2 ? |
|---|---|---|---|---|---|---|
| `chuteAvant` | chute ou relevé | généré (motion-contact.js:56) | trébuche, part en avant, mains au sol, poitrine posée ; pose couchée ; relevé mains, genou, debout | non | `chuter` (duel.js:208-224) : jambes prises ou percuté dans le dos (glissé duel.js:145 ; charge par derrière :252 ; nature.js:43) → scenes/rondo-contact.js:20-25 | non : rondoStep |
| `chuteCote` | chute ou relevé | généré (motion-contact.js:57) | bousculé de côté : tombe sur la hanche puis l'épaule, la main amortit | non | `chuter`, coup venu du flanc (duel.js:219) | non |
| `chuteArriere` | chute ou relevé | généré (motion-contact.js:58) | accroché, tiré en arrière : s'assied, part sur le dos, relevé par un roulé | non | `chuter` de cause 'accrochage' (duel.js:347) | jeté : `accrocheStep` est appelé par L2 (cerveau.mjs:66, 305-308) ; la faute est transmise (gf_faute, :248-258), la chute non |
| `trebuche` | chute ou relevé | généré (motion-contact.js:59) | course cassée sans chute : deux appuis courts, le buste plonge et se rattrape | non | perdant du duel d'épaule ; accrochage ni arraché ni dangereux (scenes/rondo-contact.js:29-34) | non (pour un accrochage décidé par L2, seule la faute est transmise) |
| `mainTendue` | chute ou relevé | généré (motion-emotion.js:37) | le coéquipier se penche, tend la main au fauché et le tire | non | `aideStep` (aide.js:12-44, appelé movement.js:22) : jeu arrêté ou ballon > 15 m, coéquipier libre à < 10 m | jeté : appelé dans movePlayers mais inerte dans le monde prêté (down = 0, cerveau.mjs:179) |
| vie au sol et relevé à l'heure de la sim | chute ou relevé | procédural (`contactClock`, scenes/rondo-contact.js:40-63) | la pose couchée vit (main, tête, jambe), puis le relevé se termine quand la sim relève | non | toute chute ou glissade (down > 0) | non : rendu |

### 3.11 Coup de pied arrêté

| nom | famille | source | ce que fait le corps | touche le ballon ? | déclenché par | décidé par L2 ? |
|---|---|---|---|---|---|---|
| `touche` | coup de pied arrêté | généré (motion-restart.js:32) | rentrée de touche : ballon à deux mains derrière la tête, tronc arqué, fouetté, lâcher à 2 m, pieds au sol | oui, mains | `remiseEnTouche` (referee.js:163-215, via onTakeMatch :1038) | non : jeu arrêté |
| `ballonMains` (attente) | coup de pied arrêté | généré (motion-idle.js:52) | le preneur attend, ballon tenu devant la poitrine | oui, mains | preneur de touche au point (motion-idle.js:204 ; Rondo.js:931-932) | non : jeu arrêté |
| course d'élan (frappe étirée) | coup de pied arrêté | sim (elan.js:109-160) + clip `frappe` | recule derrière le ballon, attend, court ; l'armé de la frappe s'étire sur la course, contact à l'arrivée | oui, cou-de-pied | coup franc, corner (poserElan elan.js:27-85), sortie de but longue (:31-37) ; elanStep (referee.js:964) | non : jeu arrêté |
| touche longue avec course | coup de pied arrêté | sim (elan.js:41-47, 140) + `touche` | le lanceur recule perpendiculairement à la ligne, court, puis lance | oui, mains | tactique `cpa.touche` 'longue' au tiers offensif | non : jeu arrêté |
| `sautMur` | coup de pied arrêté | généré (motion-emotion.js:39) | le mur saute : accroupi, détente, pieds décollés, mains croisées devant le bas-ventre | non | `murStep` (elan.js:252-270, referee.js:1058) au départ du coup franc | non : jeu arrêté |
| `mur` (attente) | coup de pied arrêté | généré (motion-idle.js:53) | dans le mur : pieds serrés, mains croisées devant, menton rentré | non | joueur à 9,15 m ± 1,3 m d'un coup franc adverse (Rondo.js:932 ; motion-idle.js:203) | non : jeu arrêté |
| `signal` (attente) | coup de pied arrêté | généré (motion-idle.js:64) | le tireur de corner lève le bras droit, la main gauche sur la hanche | non | corner, élan en attente (Rondo.js:934) | non : jeu arrêté |
| attente vivante | coup de pied arrêté | procédural sim (attente-vivante.js:30, match-sim.js:252) | micro-déplacements lissés autour du poste pendant l'attente d'une remise | non | remise en attente (hors engagement et penalty) | non : jeu arrêté |

### 3.12 Célébration ou émotion

| nom | famille | source | ce que fait le corps | touche le ballon ? | déclenché par | décidé par L2 ? |
|---|---|---|---|---|---|---|
| `poing` | célébration ou émotion | généré (motion-emotion.js:31) | le poing serré pompé deux fois, en courant | non | but : `onOut` choisit par la persona (burstiness ≥ 1,05, referee.js:578-579) → scenes/rondo-fete.js:19-24 | non : onOut dans rondoStep ; le but appartient au corps |
| `brasLeves` | célébration ou émotion | généré (motion-emotion.js:32) | les deux bras au ciel en V, la tête en arrière, tenus | non | geste par défaut de la persona (referee.js:578), ou sans `cfg.fete` (rondo-fete.js:21) | non |
| `oreille` | célébration ou émotion | généré (motion-emotion.js:33) | arrêté face à la tribune, la main en cornet à l'oreille | non | flair ≥ 0,45 et calm ≥ 1,02 (referee.js:578), joué à l'arrivée au coin (rondo-fete.js:47) | non |
| `calme` | célébration ou émotion | généré (motion-emotion.js:34) | mains levées paumes devant, tête basse ; le buteur marche | non | calm ≥ 1,15 (referee.js:578 ; match-sim.js:154) | non |
| `glissade` | célébration ou émotion | généré (motion-emotion.js:35) | glissade sur les genoux, buste cambré, bras ouverts, puis relevé | non | flair ≥ 0,7, lancée à v > 2,5 m/s (match-sim.js:154) → 'glissade' (rondo-fete.js:25-27) | non |
| `accolade` | célébration ou émotion | généré (motion-emotion.js:40) | les deux bras enveloppent, buste penché, tête sur l'épaule | non | compagnons du buteur au contact (< 1,6 m, < 2,2 m/s, rondo-fete.js:48-53) | non |
| `applaudir` | célébration ou émotion | généré (motion-emotion.js:45 ; remplace l'authored animkit-data.js:63) | trois claquements des mains devant la poitrine | non | encouragement après une occasion (arrêt, tir manqué, duel gagné…) (petits-gestes.js:39-61, dans arbitreStep referee.js:1100) ; salut final tiré au sort (ceremonie.js:90 → rondo-fete.js:31) | non : matchStep / jeu arrêté |
| `proteste` | célébration ou émotion | généré (motion-emotion.js:46) | avant-bras ouverts paumes au ciel, épaules qui montent, la tête dit non | non | le fautif peu calme (calm < 1,08), ou tout carton (rondo-fete.js:32-36) | non : rendu |
| `abattu` (attente et marche) | célébration ou émotion | généré (motion-idle.js:47 + foulée mains sur les hanches et tête basse) | l'équipe qui encaisse : mains sur les hanches, tête basse | non | pendant la fête adverse (`feteStep`, rondo-fete.js:41-57 ; motion-idle.js:209 ; character-controller.js:394) | non |

### 3.13 Arbitre ou officiel

| nom | famille | source | ce que fait le corps | touche le ballon ? | déclenché par | décidé par L2 ? |
|---|---|---|---|---|---|---|
| `siffler` | arbitre ou officiel | généré (motion-arbitre.js:20) | la main droite porte le sifflet à la bouche, coude haut, tenu | non | `poserGeste` (referee.js:1057) : faute sifflée (adjugeFaute :882), coup franc (administerWhistle :937) → scenes/arbitre.js:83-97 | non : `st.arbitre` n'existe pas sans arbitreStep, donc poserGeste sort aussitôt (referee.js:1057) ; la faute décidée par L2 est sifflée par l'arbitre du corps |
| `carton` | arbitre ou officiel | généré (motion-arbitre.js:21) | le bras tendu au-dessus de la tête, la carte en main, face au fautif | non | jaune ou rouge (referee.js:795, 857, 866) | non (le carton part au corps : gf_carton, cerveau.mjs:249-256) |
| `designer` | arbitre ou officiel | généré (motion-arbitre.js:22) | le bras tendu à l'horizontale vers la direction du coup franc | non | après le sifflet (referee.js:882, 937) ; aussi le gardien qui replace son mur (petits-gestes.js:27-38 → Rondo.js:851) | non : matchStep / jeu arrêté |
| `avantage` | arbitre ou officiel | généré (motion-arbitre.js:23) | les deux bras tendus devant, bas, qui balaient (« jouez »), en courant | non | avantage joué (referee.js:871) | non |
| `drapeauLeve` | arbitre ou officiel | généré (motion-arbitre.js:29) | l'assistant tend le bras au-dessus de la tête, hampe dressée, tenu ; hors geste, la hampe pend ou se dresse (arbitre.js:74) | non | hors-jeu sifflé (assistantsStep, referee.js:1111-1140) | non : matchStep |
| `drapeauIncline` | arbitre ou officiel | généré (motion-arbitre.js:30) | hampe à ~45° vers sa droite (touche) | non | sortie en touche sur sa ligne (referee.js:1123) | non |
| `drapeauInclineG` | arbitre ou officiel | généré (motion-arbitre.js:31) | hampe vers sa gauche, le bras croise devant | non | idem, dans l'autre sens (referee.js:1123) | non |
| `drapeauHorizontal` | arbitre ou officiel | généré (motion-arbitre.js:32) | la hampe tenue à deux mains au-dessus de la tête, à l'horizontale (remplacement) | non | remplacement (referee.js:1124) | non |
| course des officiels | arbitre ou officiel | mocap Soldier (arbitre.js:29-31) + sim (referee.js:1059-1099) | l'arbitre suit en diagonale (marche, trot, sprint), accourt à la faute ; les assistants longent la touche et font face au terrain à l'arrêt | non | `arbitreStep` (match-sim.js:1222) | non : matchStep |
| ramasseur de balle | arbitre ou officiel | sim (ramasseurs.js:15-) + réemploi de `ramassage` et `rouleMain` + mocap | trotte au ballon sorti, le ramasse, le roule au point de remise, revient | oui, mains | ballon hors d'atteinte (`ramasseurPrend`, ramasseurs.js:15-24, via ballFetch) | non : jeu arrêté |

### 3.14 Vie hors du jeu

| nom | famille | source | ce que fait le corps | touche le ballon ? | déclenché par | décidé par L2 ? |
|---|---|---|---|---|---|---|
| `repos` (attente) | vie hors du jeu | généré (motion-idle.js:45) | debout, bras le long du corps, poids qui passe d'un pied à l'autre, respiration | non | défaut sous 0,6 m/s (motion-idle.js:214 ; character-controller.js:379) | non : rendu |
| `mainsHanches` (attente) | vie hors du jeu | généré (motion-idle.js:46) | mains sur les hanches, coudes dehors | non | temps mort et persona calme ; marcheur loin du ballon (motion-idle.js:206, 210, 212) | non : rendu |
| `sautillement` (attente) | vie hors du jeu | généré (motion-idle.js:48) | sur la pointe des pieds, genoux qui pompent (nervosité) | non | temps mort et burstiness > 1,18 (motion-idle.js:210) | non : rendu |
| `serrerMain` | vie hors du jeu | généré (motion-emotion.js:42) | le bras droit tendu à hauteur de ceinture, tenu ; la scène joint les deux mains | non | file des poignées de main avant l'engagement (ceremonie.js:18-72, 'poignee' :49 ; match-sim.js:133) → rondo-fete.js:28-29 | non : jeu arrêté |
| `saluer` | vie hors du jeu | généré (motion-emotion.js:44) | le bras droit levé haut, l'avant-bras qui balance | non | coup de sifflet final (salutStep ceremonie.js:82-92 ; match-sim.js:129) → rondo-fete.js:30-31 | non : jeu arrêté |
| regard / scan | vie hors du jeu | procédural (gaze.js ; Rondo.js:293, 1105) | la tête suit le ballon, scanne le jeu, regarde le receveur avant la passe | non | toujours (cible choisie par pickGazeTarget, gaze.js:59) | non : rendu |
| mains relâchées | vie hors du jeu | procédural (mains.js:16, 66 ; Rondo.js:1106) | doigts fléchis de 30 à 55°, pouce replié (moins serrés chez le gardien) | non | toujours | non : rendu |
| coudes dehors | vie hors du jeu | procédural (coudes.js:21 ; Rondo.js:965) | écart minimal des bras : 18° à l'arrêt, 28° en course | non | hors geste | non : rendu |

## 4. Hors football et hors match (exclus du tableau)

| nom | source | usage |
|---|---|---|
| `salut` (signe de la main, en boucle) | authored (animkit-data.js:30) | n'est pas joué par le match (le salut final joue `saluer`) |
| `poignee` | authored (animkit-data.js:41) | Carriere.js:493, 544 ; le match joue `serrerMain` |
| `celebration` | authored (animkit-data.js:52) | Carriere.js:858 (record au tour) ; le match joue les gestes de `motion-emotion` |
| `consulter` (ordinateur portable) | authored (animkit-data.js:595) | vie de bureau (Carriere) |
| `applaudir` authored | animkit-data.js:63 | remplacé par le généré du même nom ; gardé dans `AUTHORED` pour les bancs |
| 41 autres specs authored remplacées par le généré du même nom | animkit-data.js:1014-1015 (`AUTHORED`) | gardées pour la comparaison et les bancs, jamais jouées par le match |
| véhicules, mobilier, laptop, ville | vehicle.js, furnish.js, laptop*.js, city*.js… | scènes autres que le match |

## 5. Couches procédurales correctives (elles ne sont pas des gestes)

| couche | où | rôle |
|---|---|---|
| verrou des pieds | foot-lock.js ; Rondo.js, fin de pile | tient le pied d'appui au sol |
| warp de frappe | scenes/rondo-warp.js ; Rondo.js:729 | amène le pied frappeur au ballon pendant l'armé ; fente du bassin si le ballon est hors de portée |
| warp de touche et fente | scenes/rondo-touche.js ; Rondo.js:724-725, 1114 | pied au ballon à la touche, corps qui va au contact |
| warp des gants | Rondo.js:713 (`_applyCatchWarp`) | mains du gardien au ballon |
| mains au ballon | Rondo.js:645 (`_armTo`) ; scenes/rondo-remises.js | ballon tenu à deux mains (touche, relance, ramassage) |
| semelle sur le ballon, mains jointes | scenes/rondo-fete.js (`semelleWarp`, `poigneeWarp`) ; Rondo.js:1132 | — |
| pied d'appui ancré pendant un geste qui avance | scenes/rondo-appui-geste.js ; Rondo.js:1134 | — |
| le pied contourne le ballon | scenes/rondo-evite.js ; Rondo.js:1134, 1162 | — |
| pas d'interpénétration des bras et des jambes, séparation des corps | scenes/rondo-corps.js (`brasContact`, `jambesContact`) ; scenes/rondo-separe.js ; Rondo.js:944, 1137 | — |
| lissage des os, loi de fusion des jambes, fondu de 0,15 s entre gestes | scenes/rondo-lisse.js ; scenes/rondo-fusion.js ; Rondo.js:503 | — |
| miroir du pied gauche | animkit.js (`mirrorMove`) | — |

## 6. Comptes par famille (lignes du tableau 3)

« partiel », « jeté » et « non » se lisent comme en §1.

| famille | lignes | généré | authored | mocap | procédural ou sim | actions sans clip propre | L2 partiel | L2 jeté | L2 non |
|---|---|---|---|---|---|---|---|---|---|
| locomotion | 16 | 14 | 0 | 1 (3 clips) | 1 | 0 | 4 | 2 | 10 |
| conduite | 8 | 5 | 0 | 0 | 3 | 0 | 5 | 0 | 3 |
| dribble ou feinte | 17 (20 identifiants) | 16 | 0 | 0 | 1 | 0 | 0 | 1 | 16 |
| passe | 24 | 22 | 0 | 0 | 0 | 2 | 7 | 6 | 11 |
| tir | 6 | 4 | 0 | 0 | 0 | 2 | 2 | 0 | 4 |
| contrôle | 14 | 13 | 1 | 0 | 0 | 0 | 0 | 0 | 14 |
| jeu aérien | 5 | 3 | 1 | 0 | 0 | 1 | 2 | 0 | 3 |
| gardien | 12 | 11 | 0 | 0 | 0 | 1 (composite) | 0 | 9 | 3 |
| défense ou duel | 12 | 7 | 0 | 0 | 1 | 4 | 2 | 0 | 10 |
| chute ou relevé | 6 | 5 | 0 | 0 | 1 | 0 | 0 | 2 | 4 |
| coup de pied arrêté | 8 | 5 | 0 | 0 | 3 | 0 | 0 | 0 | 8 |
| célébration ou émotion | 9 | 9 | 0 | 0 | 0 | 0 | 0 | 0 | 9 |
| arbitre ou officiel | 10 | 8 | 0 | 1 | 1 | 0 | 0 | 0 | 10 |
| vie hors du jeu | 8 | 5 | 0 | 0 | 3 | 0 | 0 | 0 | 8 |
| **total** | **155** | **127** | **2** | **2** | **14** | **10** | **22** | **20** | **113** |

Dans aucune ligne L2 ne choisit l'animation. Au mieux (22 lignes), il prend la décision de jeu et le corps choisit son geste.

## 7. Gestes décidés dans des parties du moteur que L2 n'appelle pas

**`rondoStep`, bloc du porteur** (rondo-sim.js:565-1011) :
- tous les dribbles et feintes : `rateau`, `arretSemelle`, `roulette`, `passementJambes` 1 à 6, `crochet`, `crochetCourt`, `crochetChaloupe`, `doubleContact`, `petitPont`, `grandPont`, `feintePasse`, `feinteFrappe` ;
- la `pausa` et la tenue dos au but (bouclier) ;
- le choix du geste de passe : `beginPass` choisit entre `passe`, `passeRapide`, `passeExterieur`, `frappe` en passe longue, `talonnade`, `passePivot`, `deviation` et les deux gestes de main (`rouleMain`, `voleeGardien`) ;
- l'espèce du tir (`frappePuissante`, `frappeEnroulee`, `frappePointu`, `tryShot`) ;
- `tryCross` et `tryClear` ;
- les touches de conduite (dribbleStep : `conduite*`, touche forte → `crochetCourt` ou `passeExterieur`) ;
- `tacleDebout` (le geste ; L2 ne copie que sa décision) ;
- le tacle glissé (`tacle`), le tacle-pique, la charge d'épaule (`epaule`), donc les chutes et `trebuche` qui en découlent.

**`rondoStep`, réception et jeu aérien** (rondo-sim.js:230-387, 1027) :
- la réception (`receive`), dont `controleSemelle`, la prise du gardien et `paradeBuste` ;
- tete.js : `tete`, `teteDebout`, `teteDefensive` en dégagement et en remise, `amortiTete`, `retournee`, volée en dégagement, `amortiCuisse` et `amorti` en vol ; les duels aériens.

**`onOut`, le but** (referee.js:507-603) : `poing`, `brasLeves`, `oreille`, `calme`, `glissade`, `accolade` ; côté adverse, `abattu`.

**Jeu arrêté** (branche remise d'assignMatchJobs, neutralisée par `st.restart = null` ; ballFetch, elan, onTakeMatch, ceremonie) :
- `touche`, `ballonMains`, course d'élan + `frappe`, touche longue, `sautMur`, `mur`, `signal`, attente vivante ;
- `arretSemelle` du preneur, `designer` du gardien qui place son mur ;
- `serrerMain`, `saluer`, `applaudir` final ;
- la marche du buteur et de ses compagnons.

**`matchStep`, hors rondoStep** (match-sim.js:1220-1222) :
- `arbitreStep` : tous les gestes du central (`siffler`, `carton`, `designer`, `avantage`) et des assistants (4 drapeaux), les ramasseurs, `applaudir` d'encouragement, `designer` du gardien ;
- `contreEngage`, `contreTir`, `jambeTendue`.

**Le rendu** (scènes, aucun équivalent dans le moteur appelé) :
- les 12 espèces de contrôle (controle-situation.js via rondo-pied.js) ;
- les variantes de passe `passe_*`, `passeRapide_*` et les variantes armées `deviation_*` (rondo-passe.js) ;
- les gestes de virage `crochetExterieur` et `cruyff`, plus `crochet`, `crochetCourt`, `crochetChaloupe`, `rateau` et `roulette` en virage (rondo-virage.js) ;
- `protection`, `duelCorps`, la posture basse du duel, la variante `@bas` ;
- l'habillage des chutes, la vie au sol, `proteste` ;
- l'attente (`repos`, `mainsHanches`, `sautillement`, `pret`, `pretGardien`, `reception`) et tous les modificateurs de foulée (frein, virage, départ, pivot, receveur, jockey, mains sur les hanches) ;
- le regard, les mains, les coudes.

## 8. Calculés dans le code que L2 appelle, mais jetés

- **`assignMatchJobs`, branche gardien** (match-sim.js:262-400) : plongeons (`plongeon`, `plongeonBas`, `plongeonUneMain`, `plongeonPrise`), sortie aérienne (`plongeonPrise`, `sortiePoing`, sortie-aerienne.js), prise au pied (`paradePieds`, `ramassage`), relance (`rouleMain`, `voleeGardien`, relancerGardien match-sim.js:319). Le gardien reçoit INTENTION.IA (cerveau.mjs:267).
- **`adjugeFaute`** (referee.js:778-898, appelé par assignMatchJobs) : la faute et le carton sont transmis ; la boiterie (`_boite`, :823) et les gestes de l'arbitre (`poserGeste`, sans arbitre incarné) ne le sont pas.
- **`uneTouche`** (premiere-intention.js:31) : le geste par orientation (`gesteUneTouche`, une-touche-geste.js:17-40 : `deviation_remise`, `_prolonge`, `_exterieur`, `_ouverte`, `_protegee`, `_course`, `talonnade`) part dans un événement 'pass' que L2 ne lit pas ; seule la passe courte est transmise (cerveau.mjs:384-387).
- **`movePlayers`** :
  - `feinteAppelAt` (movement.js:184) pousse un événement 'geste' qui n'est pas transmis ;
  - `aideStep` (`mainTendue`, movement.js:22) est inerte, car le monde prêté a down = 0 ;
  - `appuiPas` (l'appui planté) et le cap du jockey (movement.js:410, 498-504) : la vitesse transmise est lue avant l'appui, le cap n'est jamais transmis.
- **`accrocheStep`** (duel.js:318-358) : la faute est transmise, la chute (`chuteArriere`) ne l'est pas.

## 9. Observations de lecture (non vérifiées à l'exécution)

1. **Le tacle glissé n'est peut-être jamais dessiné.** L'événement 'slide' (`tech: 'tacle-glisse'`, clip `tacle` dans technique.js:188-191) passe par la branche contrôle de la scène (Rondo.js:842-849), puis par `piedDuControle` (scenes/rondo-pied.js:38-62). Celui-ci ne reconnaît pas `tacle-glisse` (`NOMMEES`, :15) et remplace le geste par une espèce de contrôle, sauf avec `?controles-hier`.
2. **`conduiteLaces` n'est jamais jouée.** La scène ne joue un clip de conduite que si le virage est ≥ 20° ou si la touche est de l'extérieur ou de la semelle (Rondo.js:875). Or une touche n'est nommée « laces » qu'à ±12° (skills-sim.js:738-741).
3. **Les officiels et les ramasseurs courent avec les clips mocap Soldier**, pas avec la foulée générée : le contrôleur sans option `locomotion` reste en `'clips'` (arbitre.js:29-31 ; character-controller.js:22).
4. **La ligne `degagement` de la table des techniques est morte** : son intent est `clear`, et beginPass ne retient que `pass`.
5. **Dans le monde prêté par L2, les actes ne sont jamais avancés.** `stepGestures` n'existe que dans rondoStep (rondo-sim.js:542) et cerveau.mjs ne remet jamais `act` à zéro. Un plongeon ou une relance armés par assignMatchJobs restent donc « en cours », et `busy(gk)` saute ensuite le gardien (match-sim.js:323). Sans effet sur le corps, puisque le gardien est en IA.
6. **Les choix de geste vivent au rendu.** L'espèce de contrôle, la variante de passe, le geste de virage, le bouclier, le duel de corps et les gestes de fête sont choisis par la scène, pas par la sim. Même un portage de `matchStep` ne les nommerait pas : il faudrait aussi reprendre controle-situation.js, rondo-passe.js, rondo-virage.js, rondo-contact.js, rondo-corps.js et rondo-fete.js.

## 10. Repères pour la comparaison avec Gameplay Football (non vérifié côté GPF)

- **Ce que le contrat sait déjà** : les types de fonction du corps (`GESTE`, contrat.mjs:10) sont MOUVEMENT, CONTROLE, AMORTI, PASSE_COURTE, PASSE_LONGUE, PASSE_HAUTE, TETE, TIR, DEVIATION, PRISE, INTERVENTION, CROCHE_PIED, TACLE et SPECIAL.
- **Un relevé GPF existe déjà** : celui des animations du corps, `bancs/animations.mjs` et `animations-bilan.mjs`, dont la sortie est `scratchpad/anims-cerveau/bilan.md`. Ses dossiers : ballcontrol, celebration, deflect, highpass, interfere, movement, movement_special, pass, shot, sliding, special, trap, trip.
- **Correspondances naturelles, à confirmer** :

| famille du moteur | dossiers GPF candidats |
|---|---|
| locomotion | movement, movement_special |
| conduite | ballcontrol |
| contrôle | trap, ballcontrol |
| passe | pass, highpass ; deflect pour la une-touche |
| tir | shot |
| tacle glissé | sliding |
| fautes et chutes | trip |
| tacle debout | interfere ? |
| célébration | celebration (3 fichiers) |
| dribble, feinte et gardien | aucun dossier évident — non vérifié |
