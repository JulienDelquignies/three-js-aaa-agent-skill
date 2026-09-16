# 56 — Les remises au pied (lot A9 bis, `cfg.remisesPied`)

Le coup franc et le corner se frappaient À L'INSTANT de la prise, du point où le preneur venait de poser
le ballon : aucun geste, aucune course (mesuré : `restart-pris` et `corner-joué` à la même image, le corps
planté). Le gardien qui tenait le ballon le dégageait « de volée » depuis le SOL : à la frappe le ballon
tenu se téléportait de la poitrine (1,09 m) au sol (0,11). Le lanceur de touche se tenait SUR la ligne,
les deux pieds dedans (Loi 15 : sur ou derrière). Et la prise aérienne du gardien sautait des gants au
point de tenue de la sim pendant que les bras étaient encore en l'air (dette A6).

Quatre habillages, tous sous une clé, tous lus de la sim.

## La sim (`cfg.remisesPied`, allumée ; absente = l'hier au bit)

```
remisesPied: { elan: { recul: 3.5, lat: 1.5, vitesse: 4.0, patience: 4 },
               volee: { h: 1.0, avance: 0.45, lacher: 0.72 },
               touche: { recul: 0.4 } }
```

- **La course d'élan** (`referee.poserElan / elanJob / elanStep / elanNow`, coup franc et corner). Le
  ballon posé, le preneur RECULE à son point de départ — `recul` m derrière le ballon sur la ligne
  ballon-cible (le but, le point de penalty), `lat` m du côté de son pied faible : le droitier vient de la
  gauche ; le tablier borne le départ, le corner part de derrière le poteau —, ATTEND face au ballon
  l'heure de la reprise, puis COURT (≤ `vitesse` m/s, `movement.js` laisse le corps courir sous l'armé
  `elan` et vise AU-DELÀ du ballon : l'amorti d'arrivée ne le freine pas sur le point de contact). Le
  geste `frappe` s'arme sur la durée de la course (`windup` tech `elan`) et la remise se prend AU CONTACT
  du geste, à l'arrivée (`élan` → `canTake` → `receive` → `onTake` : la frappe d'hier, du point d'arrivée,
  dans la même image). En avance, le contact vient à l'arrivée ; en retard, l'armé s'étire d'une image ;
  1,5 s sans arriver, l'armé s'abandonne (refus `élan-sans-ballon`) et la prise d'hier prend au ballon ;
  `patience` s sans partir (depuis que le preneur est au ballon), la prise d'hier.
- **Le dégagement de volée** (`keeper.relancerGardien` → `beginPass` mains `volee`, `keeper.gkHeldBall`,
  `strike-sim`). Le ballon AUX GANTS (y > 0,6) qui se joue long (la longue directe, le barème lofté, le
  punt) arme le geste `voleeGardien` (technique `volee-gardien`, intent `mains`). Les gants descendent de
  la poitrine au point de lâcher (`avance` m devant, `h` m) jusqu'à `lacher` × l'armé, puis le ballon
  TOMBE de la main — la chute libre tenue au servo (y = h − ½ g t², tau 0,03), jamais posée par écriture,
  jamais téléportée au sol — et le pied le prend au contact, là où il est : `strikeNow` part de sa hauteur
  (mesuré : ballY 0,76 à la passe, la balistique honnête). Un ballon lâché qu'un autre a pris ne se frappe
  pas dans le vide (refus `volée-volée`).
- **Le lanceur derrière la ligne** (`referee.elanJob`, `onOut`). Le ballon posé sur la ligne, le lanceur se
  tient `recul` m dehors (les pieds sur ou derrière la ligne) ; la règle de sortie ignore le ballon TENU
  d'un lanceur qui arme et le ballon lancé qui rentre (il part de derrière la ligne : quelques images
  dehors, en vol vers le terrain — hier une seconde sortie, une seconde touche). La patience de la face
  (A9) court depuis la POSE : le lanceur arrivé tard se posait dos au jeu.

## Le geste généré : `voleeGardien` (motion-restart)

| durée | lâcher | contact | corps |
|---|---|---|---|
| 1,3 s | 0,65 s | 0,90 s | un pas d'appui du pied gauche (le corps avance de 12 cm), le tronc se penche sur le ballon tenu devant (16° — la portée du bras : 0,49 m de l'épaule) ; les mains portent le ballon de la poitrine au point de lâcher (1,0 m, 42 cm devant) et s'ouvrent ; la jambe droite s'arme (talon vers la fesse, 35 cm), le cou-de-pied prend le ballon tombé à 0,60 m, 50 cm devant, à 6,4 m/s ; l'accompagnement monte à la hanche (0,70 m, 78 cm devant), le pied se pose devant ; le tronc se cambre de 12° au contact |

Mesuré en construisant : la vitesse du pied au contact se règle avec le pic de vitesse de la rampe SUR le
contact et un accompagnement PROPORTIONNÉ (même vitesse de part et d'autre : avec un accompagnement court
le pied freinait à 2,5 m/s au contact) ; le pôle du genou SUIT la jambe (la loi A10 : hanche→pied tourné
de 90° — un pôle fixe devant était parallèle à la jambe tendue à l'accompagnement, vrille de 180°) ; le
point de lâcher doit rester à portée de bras (l'épaule à 1,43 m, 0,49 m de bras : à 1,0 m devant, le
coude claquait à 27 rad/s à l'extension — le tronc se penche) ; les mains s'ouvrent LENTEMENT après le
lâcher (0,25 s : plus vite, l'avant-bras dépassait 14 rad/s).

Côté droit ; le miroir d'animkit fait la gauche. Le style borné [0,85 ; 1,2] × [0,9 ; 1,1].

## La scène (`rondo-remises.js`)

- **L'horloge du clip d'élan** : la sim arme `frappe` sur la DURÉE de la course (anticipation 0,8-1,3 s) ; le
  clip généré a SON contact (~0,35 s). `remiseClock` cale le contact du clip sur celui de la sim — avant, t < 0 :
  la couche tient sa première pose à poids nul (le haut et les jambes restent à la foulée générée, le corps
  COURT), puis le geste monte dans le dernier tiers de seconde ; au contact la sim frappe, le clip aussi. Le
  poids de contact lit le contact du clip, pas l'armé de la sim.
- **Le ballon en mains** (`remiseHands`) : la volée porte le ballon aux gants jusqu'au lâcher (`payload.lache`),
  puis la scène le dessine où la sim le fait tomber ; la PRISE AÉRIENNE tenue : le ballon reste dans les gants
  du clip `plongeonPrise` tant que le gardien le possède.

## Le contrat (verify-remises.mjs, 36 clauses — 53 avec A9 ter, B2 et B4)

Le geste `voleeGardien` sous `checkRestartGen` (mains ensemble jusqu'au lâcher, lâcher devant à hauteur de
main, pied à 0,45-0,8 m devant à > 5 m/s, l'appui au sol, le tronc cambré, les mains ouvertes, rien sous
la pelouse, retour debout) et `checkClip`, 20 styles × 4 ; la technique `volee-gardien` ; la sim : la volée
forcée (armée aux gants, le ballon vit aux mains puis TOMBE, la frappe part de sa hauteur, aucune pose au
registre), six coups de pied arrêtés forcés sur deux graines (armé `elan` sur chacun, départ derrière le
ballon, la remise prise au contact à l'arrivée le corps lancé ≥ 2 m/s, la frappe d'hier dans la même
image), le lanceur derrière la ligne (le bassin à 0,1-0,7 m dehors sur 8 touches), la clé absente qui rend
l'hier (aucun armé ni course, la volée redevient la frappe du sol) ; les sabotages : la volée frappée au
sol, lâchée derrière le corps, le preneur EMPORTÉ dès l'armé (aucun contact dans le vide, l'armé abandonné,
la remise prise quand même). Une remise FORCÉE attend le calme (un armé de touche naturel pendant la pose
forcée envoyait le ballon de l'autre ligne — un artefact du banc, pas du moteur).

## Mesuré en jeu (match11)

- Graine 5, t = 18,6 s : le gardien tient le ballon, style long → `voleeGardien` : le pas d'appui, le
  ballon lâché devant, la jambe qui monte, le ballon parti à 20 m/s (captures `a9bis-volee-lacher`,
  `a9bis-volee-contact`).
- Graine 3, t = 46,3 s : corner, le preneur (gaucher : `frappe-gauche`) court de derrière le poteau de coin
  (1,9 m) à 3,95 m/s, le contact vient à l'arrivée (`a9bis-corner-course`, `a9bis-corner-contact`) ;
  t = 61,2 s : la touche lancée de derrière la ligne, les pieds dehors (`a9bis-touche-derriere-ligne`) ;
  t = 142,9 s : coup franc direct à 24 m, 3,55 m de course à 3,8 m/s, la frappe et le contact dans la même
  image (`a9bis-cf-course`, `a9bis-cf-contact`).

## Le banc du match (bancs.mjs, 8 shards)

535 ✓ / 7 ✗ sur le moteur A9 bis final (A10 : 532 / 10, A9 bis : 536 / 6). La première passe (537 / 5) a
précédé la sonde d'équilibre, qui a trouvé la BOUCLE DE TOUCHES : le lanceur posté derrière la ligne y
restait, la remise de la tête de son coéquipier lui revenait dehors, une seconde touche pour l'adversaire
(57 rentrées c. 28 sur 24 × 600 s). Le retour dans le terrain (3 m, au jeu courant seulement — pendant une
remise les rayons du règlement font foi, 171d) l'a ramenée à 45 c. 28 ; le pattern existe aussi sans la clé
(4 boucles sur 14 touches ; 8 sur 23 avec).

Les sept rouges, relus clé allumée contre clé absente :

- l'économie de course (2 graines) est rouge SANS la clé aussi (p50 7 ≤ 6 absente, 9 allumée) ;
- la gradation rung 30 et le FLUX des contres : rouges depuis A9 bis ;
- lot 189 (recule 8 ≤ 5,6, rouge à A10 aussi), lot 170 (pivot médian 59 ≤ 53 sur 2 graines, rouge aux deux
  bancs A9 bis), lot 245 (85 % ≥ 90 sur 3 × 300 s), lot 124 (passements 2 ≥ 3 sur 6 × 300 s) : des lames de
  couteau à petits comptes.

L'équilibre, mesuré à 24 graines × 600 s (quatre heures de jeu par monde) :

| monde | tirs | dans la surface | passes | pertes | buts | remises prises | rentrées | corners joués |
|---|---|---|---|---|---|---|---|---|
| clé allumée | 86 | 62 | 3 470 | 1 121 | 16 | 163 | 45 | 14 |
| clé absente (le tronc) | 73 | 58 | 3 651 | 1 090 | 15 | 143 | 28 | 8 |

62 courses d'élan et 34 volées par quatre heures de jeu. La clé fait plus de coups de pied arrêtés (chaque
frappe à l'arrêt devient une course, le ballon repart plus tard et plus haut) et plus de touches (le lanceur
derrière la ligne) — le réel en a 40 par match, le tronc 1,2 par 10 min. L'écart-type d'une graine est de
2 tirs : l'écart (+13 sur 24 graines) tient dans 1,3 sigma. Verdict : la clé re-tire les trajectoires comme
A9 et A10, l'équilibre tient, l'hier au bit sans la clé. Nommé au tronc : la remise de la tête au lanceur
qui vise un corps près de la ligne (une loi de `tete.js`, pas de ce lot).

## La sortie de but longue, la touche longue, le mur qui saute (A9 ter — `elan.js`)

La course d'élan (A9 bis) vit dans `engine/elan.js` (referee.js, au plafond de lignes, ré-exporte
`poserElan / elanJob / elanStep / elanNow`). Trois sous-clés, chacune `null` = l'hier au bit :

- **`remisesPied.elan.sortieBut`** `{ recul 3, lat 1.2, vitesse 3.5 }` : quand le style de la sortie de
  but est LONG (`keeper.styleSortieBut` — la décision à la pression de `relancerGardien`, sortie dans
  sa propre fonction et lue aussi À LA POSE), le gardien recule derrière le ballon sur la ligne
  ballon-but, attend, court : le geste `frappe` s'arme sur la course et la remise se prend au contact
  (mesuré : départ 3,4 m, 2,6 m/s au contact). Au contact, sa relance (style long forcé par
  `gk._elanLong`) arme la passe et le tir se prend au tick suivant — la porte de timing de `beginPass`
  refusait (`timing`) : la course COMPTE comme porté (`st.hold ← holdMin + 0,1`). La scène
  (`rondo-remises.remiseSkip`) n'arme pas ce second geste : le clip d'élan garde son accompagnement
  sur une horloge locale (`pl._elanTail`). Style court : la pose d'hier.
- **`remisesPied.elan.toucheLongue`** `{ recul 4 }` : la touche longue (tactique `cpa.touche 'longue'`,
  tiers offensif — la porte de `remiseEnTouche`) : le lanceur recule derrière la ligne (borné par le
  tablier : 1,45 m de gazon), court AU ballon sans geste (événement `élan` remise `touche` à
  l'arrivée : 1,9 m/s après 0,75 s), le lancer d'hier s'arme à la ligne. Une pose venue du ramasseur
  n'avait pas de preneur à l'heure de `poserElan` : `elanJob` pose la course dès qu'il est connu.
- **`remisesPied.mur`** `{ retard 0.12 }` : à la PRISE du coup franc (`onTakeMatch`, la voie de l'élan
  comme la prise d'hier), les deux hommes du mur (`r._mur`, mémorisé chaque image par `elanStep`) sont armés ; ils partent quand le ballon QUITTE le preneur (direct : cette image ; lancé :
  au contact de la passe — `murStep`, chaque image depuis `arbitreStep`) : l'acte `sautMur` possède le
  corps (planté) et porte le retard de réaction (`payload.retard` : `remiseClock` décale l'horloge du
  clip, le corps tient sa pose). Un homme du mur parti marquer en boîte (cfSpots passe avant le mur)
  ne saute pas à 30 m du ballon (≤ 13 m). Le geste (`motion-emotion`, famille emotion, possède les
  jambes) : accroupi (bassin −11 cm), détente, les deux pieds décollés (+58 cm) au sommet (0,34 s,
  bassin +36), les mains croisées devant le bas-ventre (2 cm l'une de l'autre), réception.
- Bancs : `verify-remises` § 7 ter (sortie de but longue : course puis passe lofted +0,02 s ; touche
  longue : course puis lancer ; mur : deux sauts armés au départ du ballon, plantés à 0,00 m/s ;
  sous-clés absentes = hier ; style court = pas de course), `verify-emotion` (le saut, ses sabotages).

## Le tir immédiat des remises lancées (B2 — `elan.js`, `remisesPied.elan.tirImmediat`)

Mesuré (12 matchs × 300 s, 20 remises à course d'élan) : le coup franc à portée se tire ou se lance
DANS l'image du contact (`coupFrancDirect` / `coupFrancLance`, `st.ball.strike` à la prise), le corner
se joue de même (`cornerTrav`) — mais 9 remises sur 20 restaient AU PIED du preneur : toutes des coups
francs à 56-101 m du but (au-delà de la portée du lancement, 55 m), où la prise ne fait rien et le
cerveau rejouait une passe 0,4-1,5 s plus tard (porte de timing : hold ≈ 0, 'timing' × 5 ; puis
'ancre' à 0,74 m sous l'urgence). Le clip d'élan frappait un ballon qui ne partait pas, un clip de
passe le faisait partir : le double geste. Quatre lois, sous la sous-clé `tirImmediat { cone: 40 }`
(`null` : le double geste d'hier, empreinte jumelle identique) :

1. **Le plan se prend à la pose.** Le coup franc loin (> 55 m) et le corner de possession (le CORT
   du style, `cornerTrav` 35 % − 0,30 × style — le tirage se prend à la pose, même flux 'cpa', une
   fois ; `tk._cornerCort` le porte à la prise) choisissent leur coéquipier AVANT la course : le plus
   libre du demi-plan avant à 4-30 m (`planCourt`), la course s'oriente vers lui (recul court 2,5 m).
2. **La course attend son homme.** Pendant l'attente le plan se relit toutes les 0,5 s (les
   coéquipiers se replacent pendant la remise) et le point de départ suit — le preneur y retourne ;
   sans personne à ≥ 4 m (mesuré graine 1 : la protestation, A11, rassemble les neuf coéquipiers à
   0-2 m du preneur à l'heure de la remise), la course ne part pas — la patience (4 s) garde le
   garde-fou.
3. **Le tir dans l'image du contact.** `elanNow` : la course compte comme porté (`st.hold`), la passe
   s'arme en urgence vers le plan (relu : à 3-32 m, ≤ 60° de la course), sinon le choix du cerveau
   s'il est dans le cône de la course (40°), sinon le court de la course — `beginPass` avec `opts.elan`
   (pas de porte d'ancre : le corps EST au ballon) ; l'acte rembobiné au tick suivant, `payload.
   tirImmediat` (pas de porte de stance au tir : la course EST le geste). Événement `tir-immédiat
   { to, bearing, court }` ; refus nommés `tir-immédiat-cône` / `-armé`.
4. **La scène ne joue qu'un geste.** `remiseSkip` accepte le coup franc et le corner (le clip d'élan
   garde son accompagnement, horloge locale) et la prise au contact d'élan n'est pas une réception
   (`elanTake` : pas de clip de contrôle par-dessus le clip d'élan — mesuré en page : 'controleInterieur'
   à l'image du tir).

Banc (verify-remises, 47 clauses) : le coup franc à 60 m part au tick suivant le contact (0,01 s, vers
le court de la course, 30° de relèvement), le sabotage `tirImmediat:null` rend le double geste, la
clause « même image » durcie à ≤ 0,05 s pour la passe aussi. Capture : b2-coup-franc-loin-un-seul-geste.

## Le mur au trot et le ballon contre lui (B4 — `elan.js`, `match-sim.js`, `referee.canTake` ; `loi12.murTrot`, `remisesPied.mur.corps`)

Mesuré avant (doc Branchements § 4) : les deux hommes du mur, choisis comme les deux plus près de leur but, partaient
de loin et MARCHAIENT (job `walk`, sans `_walkF`, les monteurs trottant à côté) ; et le ballon TRAVERSAIT le mur qui
saute — la déviation corps du tronc ne prend que les ballons lents (< 8 m/s). À la sonde du banc, pire : l'homme du
mur CONTRÔLAIT le coup franc qui le frappait (un `control` + `turnover` à 1 m/s dans l'image même du choc).

- **`loi12.murTrot`** `1.6` (match-sim, la branche mur du tour des métiers) : les deux hommes du mur sont choisis par
  la DISTANCE À LEUR POINT — à 9,15 m du ballon sur l'axe ballon-but, ± 0,35 m de large — (le temps d'arrivée à vitesse
  égale ; `null` : les deux plus profonds d'hier) et y vont au trot (`_walkF = murTrot`, la convention de cpa.js).
- **`remisesPied.mur.corps`** `2.2` (`{ retard 0.12, corps 2.2, debout 1.85, pieds 0.25, rayon 0.6, frein 0.4 }`) :
  `murStep` ouvre au DÉPART du ballon (le même instant que les sauts) une fenêtre d'une seconde, `st._murCorps
  { ids, until }` — le vol jusqu'au mur dure 0,4-0,6 s. `murCorps` (chaque image, avant les sauts) : un ballon libre à
  plus de 3 m/s qui passe à ≤ `rayon` d'un homme du mur (0,6 m : les deux corps côte à côte font 1,2 m de façade, et
  le ballon avance de 0,3 m par image), sous sa hauteur — `debout` planté, `corps` pendant la détente (l'acte `sautMur`
  entre 0,19 et 0,52 s après son retard) — et, en l'air, AU-DESSUS de ses pieds (`pieds` : le rasant passe SOUS le mur
  qui saute, le classique) est DÉVIÉ : `impulse` renvoie la composante horizontale × `frein` vers le tireur et relève
  à max(2,5 m/s, v/4) ; phase `loose`, passe nulle, `lastTouch`/`lastPasser` au mur, événement `dévié-mur { by, h,
  air, vitesse }`. La fenêtre reste ouverte après la déviation (`done`) parce que **`canTake`** (referee) la lit : un
  homme du mur ne contrôle pas le coup franc qui le frappe ni son rebond pendant la fenêtre — le ballon est loose,
  au premier venu.
- Le tireur vise déjà ≥ 2,35 m à 9,15 m (`referee`, le coup franc direct) : ce sont les tirs bas et les lancés tendus
  qui paient, et le rasant sous le mur qui saute reste une arme.
- **`remisesPied.elan.attente`** `{ marche 4 }` : la course d'élan du coup franc et du corner se POSE dès la place
  connue même sans preneur (la pose tardive d'un porté, le ramasseur — hier seules la touche et la sortie de but), et
  la patience de l'élan court depuis l'ARRIVÉE au point (ou `marche` s de marche après la pose) — mesuré au banc B4 :
  le preneur marchait 25 m et la patience tombait en chemin, la remise partait sans course. `null` : la pose et la
  patience d'hier — la clé existe parce que ces deux lignes changeaient le monde des clauses de flux épinglées
  (suite sur 0746dbd 761/7 c. 806/19 avant la porte).

Contrat (verify-remises, bloc B4 — le coup franc FORCÉ : le monde vidé à 50 s de jeu, le coup franc à 22 m posé,
la prise, puis `ball.strike` à 18 m/s vers le premier homme du mur avec la tenue de livre d'un vrai départ) : le mur
trotte (`_walkF` = murTrot) et arrive à ≤ 1,5 m de son point à la prise ; le ballon à mi-hauteur (élévation 0,2)
rencontre le mur (dévié-mur h 0,74 m, en l'air, 16,1 m/s ; il repart vers le tireur à 6,4 m/s < 0,6 × 17,6, relevé,
`lastTouch` au mur) ; le rasant (0,12 : au sol à 9 m) passe SOUS le mur qui saute (aucun dévié-mur, deux sauts,
personne du mur ne le contrôle) ; le haut (0,45) passe au-dessus ; sabotages `corps:null` (le mur traversé d'hier)
et `murTrot:null` (au pas : 0,59 / 4,63 m de leur point à la prise, plus loin qu'avec). 53 clauses au banc. Les
deux clés `null` : hier au bit — l'empreinte jumelle des trois graines est identique avec les clés B4, B5 et B6
absentes. En match (12 × 300 s) : note 374.

## Les dettes nommées

- ~~Le ballon ne rencontre pas encore le mur qui saute : la déviation corps ne prend que les ballons
  lents (< 8 m/s) — le saut est un corps, pas encore une hauteur d'interception.~~ — livré au B4 (`mur.corps`).
- La sortie de but COURTE et la touche courte restent posées (c'est le réel) ; la touche longue ne
  vit qu'avec la tactique `cpa.touche 'longue'` — le preset `direct` la porte depuis le B6 § 8 (les équipes
  par défaut jouent `équilibre` : l'empreinte n'en sait rien).
- ~~Le corner court rend le ballon au pied du preneur au contact~~ — livré au B2 (le plan à la pose,
  le tir dans l'image) ; reste le coup franc loin d'un LONG arrêt (32 s : le fauché, la cérémonie),
  pendant lequel les dix joueurs de champ marchent au ballon et s'entassent à 0-2 m (walk × 10, identique
  dans le monde d'hier — un fait du tronc) : personne à ≥ 4 m, la course ne part pas, la prise d'hier
  (9 prises sur 19 en 12 matchs, sans double geste).
- La remise de la tête au lanceur vise un corps près de la ligne et sort parfois (la boucle de touches,
  4 sur 14 sans la clé, 8 sur 23 avec) : une loi de `tete.js`, nommée au tronc.
- La prise aérienne tenue n'a pas été filmée (aucune prise aérienne en 380 s sur trois graines).
