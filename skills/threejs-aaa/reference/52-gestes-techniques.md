# 52 — Les gestes techniques : râteau, feinte de passe, arrêt semelle

La demande fondatrice : « des râteaux pour se retourner, des feintes de passes, le ballon sous la
semelle — tout ce qui fait le foot ». Trois gestes qui manipulent le ballon **sans le libérer** :
un nouvel intent dans la table (`carry`), la même machine de gestes que les frappes, et un banc
dédié (`verify-gestes.mjs`, 26 clauses).

## Les lois (chacune est une clause quelque part)

1. **Le vocabulaire vit dans la table.** `technique.js` gagne trois lignes d'intent `carry`
   (`rateau`, `feinte-passe`, `arret-semelle`) : préconditions géométriques, pied, surface, clip.
   Le « contact » d'un geste carry est l'instant où la manœuvre s'exécute (la semelle agrippe, la
   feinte se vend, la plante se pose) — le ballon reste au porteur du début à la fin.
2. **Un geste technique est SITUÉ, et ses refus se nomment.** Le râteau exige un presseur FRONTAL
   (≤ 1,45 m, relèvement ≤ 60°) qui ARRIVE lancé (fermeture ≥ 1,5 m/s) et une sortie arrière
   LIBRE (1,35 m — 2,0 m ne se trouvait jamais dans un carré de rondo : 0 râteau, le refus
   `rateau-sans-issue` mangeait tout). La feinte exige une intention formée, un défenseur dans le
   cône de la fausse direction ([1,2 ; 2,6] m, ± 55°) et PERSONNE en duel vivant sur le ballon
   (se figer 0,4 s avec un homme à portée de vol = offrir le tacle — mesuré : +10 pts de temps
   « collé »). La semelle exige le champ libre (≥ 2,4 m) et la tenue délibérée en cours.
3. **La même machine que les frappes — et la fenêtre de duel reste ouverte du début à la fin.**
   startGesture/stepGesture, armé volable, abort nommé. Sans l'extension de fenêtre, la semelle
   (0,85 s) était un sanctuaire : un défenseur à 2,4 m couvre l'écart en 0,4 s et devait regarder.
   Et la semelle **se décolle quand on vient la presser** (abort nommé `pressé-sous-semelle` à
   2,0 m) — tenue quoi qu'il arrive, elle gonflait le temps collé à 58 %.
4. **Le couple corps-ballon reste soudé, et le corps appartient au geste** (`ownsBody`).
   L'accompagnement du râteau écrit lacet + ballon dans `skillFollowStep` : le ballon RACLE tout
   droit le long de l'ancien regard (0,32 m devant → 0,45 m derrière = devant le nouveau regard),
   le lacet balaie en ease vers `exitYaw`. movePlayers et la branche busy se taisent — une
   autorité. Mesuré au banc : retournement 179°, ballon ≤ 0,9 m (pire mesuré 0,61 m). Piège
   documenté : les cibles de `ball.carry` sont **2D [x, z]** — un [x, y, z] à trois termes envoie
   le ballon vers la ligne z = 0,11 à la vMax du servo (3,99 m de « raclage » mesurés).
5. **La morsure est une loi, pas un récit.** Au contact de la feinte, les défenseurs lancés dans
   le cône prennent `_bite` (0,55 s) : pointe, accélération et virage × 0,35 — l'appui est parti
   du mauvais côté, et le modèle d'inertie (« with no momentum to beat, a feint cannot pay »)
   fait le reste. Prouvé comme la loi du paceBias : un coureur, deux états, rapport des vitesses
   de régime = biteSlow ± 3 pts. La rétraction du clip est COURTE (0,14 s) : à 0,26 s, la morsure
   expirait AVANT que la vraie passe parte — l'avantage s'évaporait pile au moment de servir.
6. **La feinte VIT de sa ressemblance.** L'armé de `feintePasse` est celui de `passe` (clause :
   backswing jambe à ≤ 12°, mesuré 2°) et au « contact » le geste SE RETIENT (cuisse 6° vs 46° —
   l'anti-overshoot est la signature mécanique du geste retenu). Le regard vend la feinte
   gratuitement : `payload.outYaw` = la fausse cible, la politique de regard porteur fait le reste.
7. **La fréquence est une identité sous cooldowns.** `persona.flair` (0,15–1,0) module QUI tente ;
   cooldowns 9/8/9 s + re-tirage espacé (pas de tirage à 60 Hz). Mesuré : ~2,5 râteaux, ~7
   feintes, ~0,8 semelle par partie de 90 s — visible sans cirque (1,45 m → 1,8 m de rayon
   presseur = 12,5 râteaux/partie, le cirque mesuré).
8. **Le seuil suit le monde qu'il juge.** L'arrivée du jeu de rétention a déplacé le temps
   « collé » de 38 ± 10 % à 44 ± 10 % (10 graines × 90 s) — tenir SOUS pression est le sens même
   de ces gestes. `harriedMax` 0,55 → 0,62, sabotage inchangé (~100 %) : la clause garde ses
   dents. Même mouvement pour la bande tempo 2-5 s (plafond 45 → 55 %) et le verrou de balance
   (les ACTIONS comptent : frappées + gestes ≥ 42, plancher frappées ≥ 34).

## Le visuel

Rien de nouveau à câbler : l'événement windup porte `move` + `foot` (+ `skill` pour que l'audit
membre ne prenne pas un râteau pour une frappe), `_playTech` joue le clip (miroir par pied), le
lacet du retournement est COPIÉ de la sim (loi 12), le warp est gardé (`kind !== 'pass'`), la
jambe du geste est masquée du verrou de pieds via `payload.pick.foot`. Le clip `arretSemelle` est
le seul du répertoire dont le sens est l'immobilité — et la tête s'y LÈVE (le ballon est garé,
les yeux sont libres).

## Vérification

- `verify-gestes.mjs` (26) : vocabulaire, ressemblance/retenue de la feinte, situation de chaque
  geste exécuté (géométrie portée par l'événement), couple soudé, morsure-loi, cooldowns, refus
  nommés, sabotages (sans presseur / sans issue → nommé / sortie libre → s'exécute / spam /
  sous conteste).
- `verify-rondo` 40/40 (seuils recalibrés consignés), `verify-animkit` 96/96 (les trois clips +
  miroirs), audit composé 15/0, verrou de balance : record 9,1, 52,8 actions/partie.

## Les passements nourris (`cfg.passements`, note 385 — verify-passements 6/0)

Diagnostic du 16/09 (« tu peux corriger les passements ? ») : le CERCLE du générateur est bon — planche et page (LOD coupé), la
cheville passe à 25-30 cm au-dessus du ballon, le pied qui cercle est masqué du verrou par `pick.foot` —, mais le geste était
AFFAMÉ (1 passement en 15 min de match sur 3 graines) et le ballon était CALÉ LÀ OÙ IL TRAÎNAIT au contact, pas au point que le
clip attend ([0,05 ; −0,40] dans le repère du corps) : le pied d'appui finissait dans le ballon (mesuré en page : 7 cm du centre).
L'entonnoir mesuré sur 300 s (600-1 000 appels de `maybePassement` aux ticks de décision) : le ballon à plus de 0,6 m (256-541 refus —
le porteur conduit ballon devant), aucun jockey à 0,9-2,6 m (176-319), le jockey hors du demi-front de 70° (95-151 — le porteur
reçoit hors du presseur, § 10 : il lui tourne le dos), la charge au-delà de 1,5 m/s (5-31 — les défenseurs du moteur pressent plus
qu'ils ne jockeyent), 5-10 tirages restants à un appétit de dribble de 0,03-0,48 (la cadence et le tiers propre l'éteignent).

- **La loi** (`passements { spot 0,40, lat 0,05, face 100, foe 3,5, fixe 0,45, charge 2,6, ballon 0,75, envie 2, plancher 0,35 }`) :
  le jockey jusqu'à `foe` m ; le porteur POSÉ (< 2,5 m/s) dont le jockey est au demi-front large (70-`face` °) le FIXE — le regard
  tenu (`p._regard`, à terme `p._regardUntil` : la voie du § 7, relâchée seule par `movement`) pendant `fixe` s — et le passement part
  une fois face (mesuré : 0,10 s après le regard, relèvement 62°) ; une charge jusqu'à `charge` m/s se fige quand même (au-delà : le
  râteau) ; le ballon jusqu'à `ballon` m ; le tirage sur `max(plancher, dribM) × (0,32 + 0,42 flair) × gesteF² × envie` ; et LE BALLON
  RAMENÉ AU POINT DU CLIP dès l'entrée (`payload.pin` = spot devant, lat du côté du pied ; `stepGestures` le porte pendant l'armé, vite (tau 0,04) —
  l'escorte le laissait où il traînait —, `skillFollowStep` le cale ensuite) : à 0,6 cm du point au contact (8,1 cm avant).
- **Mesuré** : 3 passements par match de 300 s sur 4 graines (1, 2 et 3 tours, 10 posés sur 12, 4 jockeys qui mordent) contre 1 par
  15 min hier ; graine 3 : 5 (2 posés, 2 morsures) c. 1.
- **`passements: null`** = hier au bit (les portes d'hier, le ballon calé au contact, aucun regard tenu) ; épinglé sur les bancs datés.
- **Dettes** : le ballon à plus de 0,75 m reste refusé (le porteur conduit loin devant : une touche de rappel serait le vrai geste) ;
  les défenseurs chargent plus qu'ils ne jockeyent (la posture jockey est du moteur) ; le passement lancé garde ses lois d'hier.

## La conduite nommée (`cfg.conduiteNommee`, note 388 — verify-conduite 9/0)

Retour : « enchaîne sur les touches de conduite pour gérer pied droit pied gauche extérieur intérieur, en faisant le nécessaire dans
le moteur ». Hier chaque touche de conduite était un événement `touche` muet (`dev`, `spd`) : la scène tendait le pied LE PLUS PROCHE
vers le ballon (le warp de touche) et jouait « passe extérieur » sur toute cassure ≥ 60°, quel que soit le pied ou la surface.

- **Le moteur nomme** (`skills-sim.conduiteNommee`, appelé par `touchEvent` après la poussée du dribble) : le PIED est le côté du
  ballon dans le regard (lat > 0 = gauche, la convention de la scène) ; la SURFACE se lit sur la direction de la poussée que
  `dribbleStep` vient d'écrire (`st.ball.v`) par rapport au regard : vers le dehors du pied qui touche (à droite pour le droit) c'est
  l'EXTÉRIEUR, vers le dedans l'INTÉRIEUR, droit devant (± `droit` 12°) le COU-DE-PIED en course (≥ `vite` 3 m/s) et l'intérieur au
  trot, presque arrêté (< `lent` 1 m/s) la SEMELLE. Champs additifs sur l'événement (`tech`, `foot`, `surface`, `virage` signé,
  > 0 = à droite) : la clé absente rend la touche muette d'hier, au bit.
- **Quatre techniques** de la table (`conduite-interieur`, `-exterieur`, `-laces`, `-semelle`, intent `conduite` : la table ne les
  choisit pas) et **quatre clips générés** (motion-control `conduiteInterieur`, `conduiteExterieur`, `conduiteLaces`, `conduiteSemelle`,
  0,4 s, contact 0,14) : le pied va au ballon et le POUSSE (contrat `pousse` : le pied continue devant de ≥ 5 cm après le contact —
  mesuré +21 à +29 cm), la surface se présente (turn : intérieur en rotation externe, extérieur en inversion, cou-de-pied pointe basse),
  la semelle se pose et retient. 40 styles sous contrat et checkClip.
- **La scène** : le warp de touche suit le pied NOMMÉ ; la touche qui vire (≥ 20°), l'extérieur et la semelle jouent leur clip par
  technique, miroir au pied nommé, cadencées 0,35 s comme la touche forte ; la touche droite du cou-de-pied reste au warp seul (la
  foulée la joue déjà) ; le demi-tour ≥ 110° garde le crochet court.
- **Mesuré** (300 s, graine 3, les clés du jour à null) : 142 touches, toutes nommées, le pied cohérent avec le côté du ballon 142/142 ;
  surfaces : cou-de-pied 87, intérieur 35, extérieur 20, semelle 0 (2 sur le monde complet) ; pieds : droit 63, gauche 79. Sur 2 × 300 s : 73 % des touches virent de moins de 6°, 7 %
  de plus de 20° ; au trot l'intérieur domine (86/90), en course le cou-de-pied (187/216, 13 extérieurs).
- **Dettes** : l'extérieur reste rare (la conduite du moteur vire peu : 5 %) ; le pied ne change pas au fil des touches (le ballon
  vit devant le pied de contrôle `p.foot`) ; les prises de ballon libre (`control` sans technique) restent au contrôle intérieur.

## La passe dans le sens du geste (`cfg.orientationPasse`, note 395 — verify-orientation 8/0 avec la clause (f) du 401)

Mesuré le 17/09 : 10 des 42 passes planifiées partaient à plus de 60° du regard au contact (passe-rapide à 64-110°, pivots
à 60-130°) — le plan de frappe ne jugeait que l'ancre, jamais la sortie, et le porteur qui avait adopté une passe arrière
courait encore une seconde vers l'avant. La loi : à l'adoption au-delà de `tourner` ° le porteur se retourne avec le ballon
(le `_retour` du 240b) ; `beginPass` choisit la technique pour le tour qu'elle doit faire (fenêtre `turn` plafonnée à
`fenetre` 40°, plus `marge` × retournement.rate × anticipation) ; libre et rien ne tient, il s'ouvre sur place (regard tenu,
pointe capée `vTour`, refus nommé `orientation`), pressé et rien ne tient il prend le geste qui tourne le plus parmi les
prompts (armé ≤ `anticPresse` : la passe posée, 87° en 0,38 s) ; l'engagement part au `holdMin` d'origine. Résultat : 3
passes planifiées sur 55 à plus de 60° du regard sur 4 graines (des posées pressées à 150-165° de tour ; hier 19 sur 94),
l'engagement à 27° en 1,1 s ; +12 % de pertes sur 8 graines (le pressé qui tourne se fait prendre plus que la rapide).

## La verticalité (`cfg.verticalite`, note 396 — verify-verticalite 6/0 avec la clause (c) du 400)

Les occasions de profondeur (un coéquipier en jeu à ≥ `profond` m devant, dans les `zone` m avant la ligne, libre à
`rayon` m, rien à `devant` m devant lui) vivaient à 27-64 m, hors du vocabulaire (passRange 13 m). La loi dans
`choosePass` : la passe qui avance rend le point doux 10 m (`avance`, `plafond`), l'espace devant vaut `espace` et a sa
portée (`portee` 30 m), le retrait du porteur libre se paie (`retrait`, `libre`, `dos`, `dosPlein`), le long retrait se paie
même pressé (`dosLong`, `retraitLong`). Jamais la sortie au gardien, le relais du une-deux, la bascule ni la course servie.

## La conduite qui décale (`cfg.decalage`, note 397 — verify-decalage 9/0 avec la clause (e) du 402)

L'épaule : le porteur lancé (≥ `v`) avec un défenseur devant (< `fixe` m, < `lat` m) vise son épaule (`cote` m) du côté
libre, l'évasion ne dilue plus (`tenir`). Le crochet en course : le défenseur devant (≤ 75°), jusqu'à `foe` m, le ballon
jusqu'à `ballon` m ramené devant le pied pendant l'armé (`pinRel`), la fermeture relative (`closing`), un plancher d'appétit
(`plancher`), le corps qui court sous l'armé (`mobile`). Le passement en course jusqu'à `chargeCourse` m/s de charge. La scène
n'a rien à faire de plus : les clips `crochet*` et `passementJambes` jouent comme avant, le corps bouge sous eux.

## Le receveur ouvert — essai retiré (note 398)

Le receveur qui court à l'opposé du ballon se présentait pendant le vol : à 8 graines, rien (67 → 65 % de coureurs servis
dans le dos) — le job de réception le tourne déjà vers le ballon. Clé retirée ; la touche orientée (399) règle la prise dos
au jeu.

## La touche orientée en course (`cfg.toucheOrientee`, note 399 — verify-touche-orientee 6/0)

Le receveur libre (personne à `libre` m), en course (≥ `v`) ou dos au jeu (`dos`), ne capture pas le ballon : sa première
touche l'emmène du côté ouvert — douze directions notées par le sens du jeu (`sens`), l'élan (`elan`), le champ devant
(`champ` m dans les `devant` m), jamais vers la craie — à `lead` m (entre `leadMin` et `leadMax` selon l'allure), et il tourne
sur sa touche ; la conduite reprend à la touche suivante. Le pressé garde la capture protégée du 265. Porté soudé 49 → 38 %.

## L'espace devant casse la tenue (`cfg.verticalite.appel`, note 400)

L'élu dans l'espace (`esp`) vaut un appel : la tenue calme est dispensée, la porte du timing s'ouvre au `holdMin`
d'origine. Passes 145 → 151, pertes 76 → 67 sur 4 graines.
Banc : verify-verticalite (c) — l'avant libre à 16 m, la ligne 12 m derrière, la tenue calme d'origine : la passe part en
0,42 s avec l'appel contre 2,52 s sans. La fixture épingle `croyance: null` : elle téléporte la défense et la couche de
croyance du porteur mettait 1,5 s à la voir (la course de `beginPass` refusait la passe sur des fantômes).

## La talonnade honnête (`cfg.orientationPasse.talon`, note 401)

L'ancre du talon regarde à l'opposé de la sortie (`anchorFor` avec `dos`), le taux borné du glissement s'applique, et le
pressé dont la sortie est derrière (≥ 115°) talonne — le corps ne claque plus vers la cible. 14-17 talonnades par 4 × 300 s,
la sortie à 135-180° du regard, le tour pendant l'armé ≤ 40°.

## La sortie menée au bout (`cfg.decalage.sortie`, note 402)

Le défenseur mordu par un geste vendu s'assoit au moins `bite` s. Effet mesuré faible (défenseurs battus 1/7 → 2/14) : le
1c1 gagné au bout de la course reste une loi de duel (dette).

## Dettes connues

- La semelle des graines très pressées casse toujours (`broke: 'pressé'`) — la tenue complète
  n'existe que sur les graines calmes ; un jour, le porteur devrait CHOISIR un endroit calme.
- ~~Pas encore de roulette, passement de jambes, petit pont~~ — livrés (A4), et les passements nourris le 16/09 (ci-dessus).
- ~~Le porté soudé vient de la fenêtre de contrôle de la réception~~ — la touche orientée en course (399) l'a réglé pour le
  receveur libre (49 → 38 % d'images soudées) ; le pressé capture encore (la touche protégée du 265), l'armé porte le ballon
  au point de frappe (physique).
- Le 1c1 gagné au bout de la course (« battus » 0 malgré l'épaule attaquée et les crochets) : le duel se règle par le tacle,
  la charge ou la passe — une loi de duel (duel.js, tronc).
- L'audit membre ignore les gestes techniques (filtre `!x.skill`) : leurs clauses composées
  propres (semelle SUR le ballon en monde, pied du râteau au contact) restent à écrire.
