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

## Le contrat (verify-remises.mjs, 36 clauses)

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

## Les dettes nommées

- Le ballon ne rencontre pas encore le mur qui saute : la déviation corps ne prend que les ballons
  lents (< 8 m/s) — le saut est un corps, pas encore une hauteur d'interception.
- La sortie de but COURTE et la touche courte restent posées (c'est le réel) ; la touche longue ne
  vit qu'avec la tactique `cpa.touche 'longue'` (aucune dans les presets par défaut).
- Le corner court (35 % au style possession) rend le ballon au pied du preneur au contact : la course
  finit sur une conduite, pas une frappe.
- La remise de la tête au lanceur vise un corps près de la ligne et sort parfois (la boucle de touches,
  4 sur 14 sans la clé, 8 sur 23 avec) : une loi de `tete.js`, nommée au tronc.
- La prise aérienne tenue n'a pas été filmée (aucune prise aérienne en 380 s sur trois graines).
