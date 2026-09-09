# Plan de route — comment on se sert de ce dépôt pour avancer

*Rédigé le 9/09 sur 8168051 (SCEAU 256). C'est le plan que le PLAN_DOCTRINE ne dit pas : non pas « quel est le
prochain lot », mais « à quoi sert ce dépôt, pour qui, et dans quel ordre on le fait grandir ». Le PLAN_DOCTRINE reste
le journal des lots ; NOTES.md reste la mémoire ; ce document est la carte.*

## 1. Ce que ce dépôt est devenu, et ce qu'il n'est pas encore

**Ce qu'il est.** Un moteur de football en JavaScript (127 modules, ~30 000 lignes) qui possède les LOIS du jeu et
se paramètre par des DONNÉES : 37 notes joueur (`attributes.js`, des facteurs, identité 1 à 50), 48 rôles sur onze
axes (`roles.js`, identité 0,5, interdits binaires), 31 formations (`formation.js`), des tactiques en axes
(`tactics.js`), et une configuration de lois (`match-config.js`) où toute clé absente rend l'hier au bit. Autour :
un banc de 151 blocs et 72 annexes (~17 000 lignes) qui PROUVE chaque loi sur fixture et mesure son flux ; 126
entrées de journal ; un mode de fabrication (sonde avant → loi à clé → jumeau au bit → clause → banc complet →
sceau) qui a tenu 256 lots sans casser l'identité au bit. Trois consommateurs le lisent déjà : la scène Three.js
(Rondo, showcase), l'agent animation (branche A1-A12), et un jeu aval de gestion (le « directeur sportif ») qui
injecte ses effectifs, ses tactiques et ses rôles et lit `st.events`.

**Ce qu'il n'est pas encore.** Un PRODUIT. Le moteur vit en trois photocopies synchronisées par `cp` ; il n'a ni
version, ni paquet, ni schéma public du journal ; le banc tourne à la main (62 minutes) ; le contrat de données
existe (catalogues) mais s'est déjà troué une fois (`scanning` lue sans être déclarée). Et le jeu qu'il produit,
laissé à lui-même, est du vrai football (3,0 buts par match) — mais nourri de vraies données il en fait 10, parce
que son échelle de finition tient dans 7,5 % de la largeur du but, que son carton est un compteur, et que personne
ne joue sur l'épaule du dernier défenseur (retour aval du 7/09).

## 2. Le produit qu'on vise : « Unity/Unreal du football »

Un moteur réutilisable, ça veut dire quatre choses concrètes, et chacune est un chantier :

1. **Un contrat d'entrée** : `makeMatch({ squads, tactics, roles })`, `matchStep`, `matchCfg` — trois portes, et
   des catalogues où « si une note n'y est pas, elle n'existe pas ».
2. **Un contrat de sortie** : le journal `st.events` avec un vocabulaire documenté et stable (un seul nom d'auteur,
   un seul événement de frappe, le lieu sur les événements de lieu), et les états lisibles par le rendu (`p.scan`,
   `pick.foot`, `payload`) — gelés dans `docs/Interface_Campagne_V.md` et `MOTEUR.md`.
3. **Une garantie** : le banc, qui dit ce que le moteur exprime (le test d'identification 249) et ce qu'il garantit
   (les clauses), et les empreintes qui datent chaque monde.
4. **Un vrai football** : les nombres du réel comme cibles publiques — ~25 tirs, ~33 % cadrées, ~11 % de
   conversion, ~2,7 buts, ~22 fautes, ~4 cartons, 4-8 hors-jeu, 40-50 touches, ~10 corners — mesurés à chaque
   sceau, sans les forcer.

## 3. Les cinq chantiers, et pourquoi dans cet ordre

### Chantier A — Le vrai score (Campagne VI, d'abord)

C'est le retour aval qui l'impose : tout le reste se mesure sur un monde où chaque perte devient une frappe cadrée
à 63 %. Trois lots, chacun avec sonde, jumeau, banc complet, épingles datées :

- **258 — l'échelle de finition.** `shotSigma` de 0,10-0,55 m à un ordre de grandeur comparable à la cage (grand
  buteur ~0,4 m, maladroit 1,5-2 m), le terme de pression du 145 gardé. Derrière : cadrées, conversion, arrêts,
  buts re-mesurés ; les sept notes défensives et les sept leviers de gardien re-mesurés (leur t de 2,02 sur
  `command`) ; les clauses du banc qui vivent sur ces nombres re-datées. Le plus lourd et le plus rentable.
- **257 — le carton juge la nature.** `prometteur`, le tacle par derrière, l'arraché → jaune ; le tally à 4-5 ; et
  d'abord faire exister la faute d'anti-jeu (prometteur vrai une fois en trois matchs).
- **259 — l'épaule du dernier défenseur.** Quand part l'appel et d'où ; 0 hors-jeu en 270 minutes, la profondeur
  reçue 18 m derrière la ligne — c'est la même dette que l'appel muet du 249.

Sortie attendue : la table du réel ci-dessus avec chaque ligne à moins de ×1,5, publiée dans MOTEUR.md, et le monde
aval sous 4 buts par match avec leurs données.

### Chantier B — Le paquet (en parallèle, sans loi)

Faire du moteur un paquet qu'un projet installe au lieu de le photocopier :

- une seule source (`packages/football-engine/`), les trois copies remplacées par un import ; `verify-sync`
  devient inutile et disparaît ;
- un `package.json` versionné (0.x tant que le journal a des alias ; 1.0 quand `pass.from` et `turnover.to`
  sont retirés — 257) ; NOTES.md est le changelog, l'empreinte de chaque version est dans la release ;
- un schéma du journal (`docs/Journal.md` : type par type, champs, unités, qui l'émet, ce qu'il n'est pas) et un
  schéma des catalogues (la table des leviers avec leurs amplitudes — celle que l'aval a calculée : passing ×12,
  finishing ×5,5, défense ×1,35) ;
- le banc en CI : `bancs.mjs` en GitHub Actions, huit shards en parallèle (62 → ~10 minutes), le tally lu après
  `final.done` (règle du 256), une empreinte vérifiée par commit — le sceau cesse d'être un rituel manuel ;
- un guide du consommateur (le MOTEUR.md recentré) : injecter un effectif, des tactiques, des rôles ; lire le
  journal ; faire tourner sans rendu ; ce qui est stable et ce qui ne l'est pas.

### Chantier C — La Campagne V finie (les rôles individuels)

253 la pausa, 255 le preset ligne haute, 254 les mécanismes relationnels — après 258 pour qu'ils se mesurent dans un
monde qui compte. Et les dettes nommées de la campagne, chacune un lot quand elle est mûre : les touches (40 c. 70,
le service de la craie), la transition du repli (8-9 sous la ligne 65 c. 90 %), le 9 qui décroche sous le pivot (le
bloc de 30 m), le teamwork sans second lecteur, les 43 signatures muettes du 249.

### Chantier D — Le banc comme garantie (continu)

- La volumétrie : chaque clause au bord de Poisson (celles qu'on épingle à chaque loi qui bouge la défense — 189,
  l'aimant du porté, la course traverse la frappe, la roulette, les contres à l'entrée) passe à 24 graines ou à
  l'ordinal par graine ; les deux rouges hérités (246d, contres à l'entrée) sont instruits, pas épinglés.
- Les épingles datées ont une durée de vie : à chaque campagne close, on relit les `DATÉ` et on retire celles dont
  le monde a rattrapé la clause.
- Le test d'identification se regèle à chaque monde scellé, et le journal nomme les pertes.

### Chantier E — Les interfaces avec les autres agents (gouvernance)

Trois agents travaillent sur ce moteur : moteur (ce dépôt), animation (branche A*), aval (le jeu et les agents du
« book »). Ce qui a marché et qu'on garde : les interfaces GELÉES avant le travail (Interface_Campagne_V), les
retours de référence datés sur une photocopie (`docs/Retour_Reference_*`), et une réponse écrite point par point
avec un verdict (exact / réfuté / mesuré) et un lot. Ce qu'on ajoute : un fichier `docs/Interfaces.md` unique qui
liste ce qui est gelé et depuis quand ; A13, le second canal d'animation (`burst`, `touche`, `control`, `windup` =
58 % du journal), instruit avec l'agent animation ; et la règle qu'un consommateur mesure sur une VERSION, jamais
sur une branche vivante.

### Chantier F — Le book comme cahier des charges (c'est celui que la première version de ce plan oubliait)

Le dépôt `JulienDelquignies/book` n'est plus un document : c'est **48 chapitres audités (~475 000 mots) en quatre
couches** — la doctrine (ce qu'un entraîneur veut), la Bible comportementale (ce que font les 22, seconde par
seconde, 16 chapitres du gardien au contexte de match), le modèle computationnel (les maths et l'architecture,
16 chapitres) et le référentiel du réel (les nombres et le protocole de validation, 16 chapitres), plus les
invariants partagés qui font foi quand deux chapitres se contredisent. Chaque chapitre porte un bloc « traduction
moteur » et un bloc « tests de réfutation par la mesure ». Le brief qui l'accompagne cartographie l'autre moteur
(celui du jeu aval, en TypeScript) — pas celui-ci. **Il manque donc la cartographie du book contre CE moteur**, et
c'est le premier livrable du chantier :

1. **`docs/Book_vers_Moteur/` — la cartographie chapitre par chapitre** (FAIT le 9/09 : 48 fiches + README, journal 330), sur le modèle du brief : pour chaque
   chapitre, ce que le moteur modélise déjà (avec le numéro de lot et la clé), ce qu'il modélise partiellement, ce
   qui est absent, et — surtout — **chacun de ses tests de réfutation** classé en *mesurable aujourd'hui* /
   *loi existante, cible fausse* / *absent*. Le gardien est traité le premier ci-dessous, en exemple complet :
   27 tests, dont le tout premier (distance moyenne à la ligne 13,1 m) réfute le moteur d'aujourd'hui (profondeur
   plafonnée à 2,6 m, libéro à 10 m). C'est un travail de lecture, pas de loi : il se fait en parallèle du chantier
   A, un chapitre par jour, et il PRODUIT les lots suivants au lieu de les deviner.
2. **Les tests de réfutation deviennent une annexe du banc** (`verify-book.mjs` — EXISTE, 25 sondes dans `scripts/book/`, informatif), informatifs d'abord (amendement 2 :
   un banc ne naît pas rouge), un test à la fois promu en clause quand la loi qui le fait tenir est scellée. Le
   chapitre 15 du référentiel donne en plus les 48 tests V01-V48 du protocole de validation, avec leur budget
   statistique et leur cadence : les onze P0 « à chaque PR » (déterminisme, buts 2,85 ±0,25, tirs 25 ±2,5, passes
   890 ±70 à 83 %, sortie de balle sous pressing, bloc bas, contre 3v2, détecteurs d'artefacts) sont le noyau de la
   CI du chantier B — c'est là que « la table du réel » de la décision 4 trouve sa forme.
3. **Le référentiel remplace nos cibles à la main.** Là où NOTES dit « réel ~25 tirs » de mémoire, le référentiel
   donne la valeur, sa source, sa tolérance et ses pièges de définition (quatre définitions de la passe progressive,
   deux conventions de duel à facteur 4). Chaque clause de flux cite désormais son numéro de référentiel.
4. **Les invariants partagés deviennent des clauses de contrat** (`checkBloc`) : I1-I7 — longueur du bloc ≤ 25 m en
   défense établie, distribution bimodale (28 / 42 m), largeur des milieux ≥ largeur des défenseurs, ligne ≥ 18 m
   hors état de siège. Ce sont des invariants, pas des cibles : leur violation est un bug.
5. **Les désaccords d'école restent des axes.** Le book expose les curseurs (recul-frein / jaillissement, faute
   tactique, piège du hors-jeu, devoir de repli) sans trancher : c'est exactement la place des axes tactiques et de
   rôle du moteur (identité 0,5), et la règle « une note est un facteur, une consigne est un axe, un interdit est
   binaire » reste la nôtre.

Ce que ça change à l'ordre : rien pour le chantier A (le book confirme les trois lots — Vol. III ch. 03 pour la
finition, ch. 04 et ch. 10 pour les cartons, Vol. II ch. 12 pour le hors-jeu), tout pour la suite : après 259, les
lots ne viennent plus des retours mais de la cartographie, chapitre par chapitre, dans l'ordre que le book propose
lui-même (le second ballon, la perception non omnisciente, la chorégraphie des 22, le gardien en machine à états).

#### L'exemple complet : le chapitre 02, le gardien, contre keeper.js

Ce que le moteur a : le placement sur la bissectrice et la profondeur (lot 94, `KEEPER.depthMin/Max/Gain`, le mode
libéro `cfg.libero` à 10 m max), le plongeon à portée réelle (lot 39, `diveReach` 2,95 m, `reflex` 0,12 s, la
flottante lue tard), le relevé qui coûte (lot 91), la sortie au 1v1 (lot 104 `sortie1v1`, note `oneOnOnes` 163), la
prise haute et la claquette (147 `handF`, 163 `aerialF`, corners 101), la distribution au pied et à la main (150,
A9 `remisesMain`/`remisesPied`, 136 `sortieGardien`, 190 `gkAuDevant`, 179 `gkPied`), la garde par tiers (238), la
tenue et le lâcher (171 `gkTenue`, `gkRelease` 3 s).

Ce que le chapitre en dit, test par test (27 tests, ≥ 200 matchs chacun) :

| Tests | Statut contre le moteur | Ce qu'il faudrait |
|---|---|---|
| 1 distance moyenne à la ligne 13,1 m ; 2-3b couplage à la ligne défensive (20,4 m, coefficient 0,57) | **loi existante, cible fausse** : profondeur 0,45-2,6 m, libéro 10 m — le gardien du moteur vit à moins de 3 m de sa ligne | un lot « le gardien couplé à sa ligne » : `gapToBackline`, le plafond de lob, le point de non-retour ; les 2018/2022 comme presets |
| 4-5 actions hors surface (0,4-2,0 / 90, à 14-17 m) | mesurable aujourd'hui (le libéro, la sortie 1v1) | la sonde, puis les profils Neuer / Ederson / Buffon comme rôles de gardien (les axes `garde`, `ressort` existent) |
| 6 set position à 85-90 % des tirs | **absent** (aucune notion d'appuis figés) | `setQuality` : un temps, pas une amplitude — lié au scan (250) |
| 7-8 save % 68-72, dedans/dehors 60/85 | mesurable (les épingles arrêts/buts d'A10) — aujourd'hui 63 % de cadrées, le chiffre est faux par la finition (258) | se re-mesure après 258 |
| 9-9c portée du plongeon bornée par le temps disponible (< 0,31 m sous 0,25 s), le bloc majoritaire à moins de 11 m, 2,3 % de tirs déviés | **loi existante, cible fausse** : `diveReach` 2,95 m quel que soit `tAvail` ; le contre du champ (176) existe, son effet sur l'arrêt non | la portée comme fonction du temps, le BLOCK avant le DIVE |
| 10-12 sorties sur centre (64-71 %, capter/boxer/dévier 55/30/15, le coût de la sortie ratée xG 0,55-0,85) | partiel (101, 147, 163) ; le coût jamais mesuré | sonde, puis le geste choisi à la note et à la pression |
| 13-14 le 1v1 (42-50 % d'arrêt, 1 par 60 min) | mesurable (104, 163) | sonde |
| 15-19 la distribution (six mètres courts 50-80 %, précision par distance 90-95 / 45-60 %, rétention des longs 30-40 %) | mesurable (le 249 imprime déjà « passes courtes du gardien 67 % sur 6 ») — le volume est trop faible, il faut 200 matchs | l'arbre de décision §7.4 comme loi à clé, `footShort`/`footLong` comme notes |
| 20 tenue < 8 s (IFAB 2025/26), corner dès la première infraction | **loi existante, règle périmée** : `gkRelease` 3 s à l'échelle des six secondes | mettre la Loi 12 à jour |
| 21-23b penalty (93,7 % de plongeons, 15-21 % d'arrêts, posture sans effet) | mesurable (217) | sonde |
| 24 distance parcourue 4,8-5,6 km, marche 68-73 % | mesurable (les allures du 57) | sonde |
| 25-26 corners selon marquage et trajectoire | partiel (101, 225 `marquageSurface`) | sonde |
| 27 cohérence des états (pas d'aller-retour sous 0,4 s) | **différence d'architecture** : keeper.js décide par lois, pas par machine à états ; l'engagement `T_commit` existe sous d'autres noms (`diveTime`, `gkTenue`) | ne pas réécrire ; mesurer les flaps, et seulement s'il y en a, poser un `commitUntil` |

Le lot qui en sort en premier n'est pas le plus gros : c'est **le gardien couplé à sa ligne** (tests 1-3b), parce
que tout le reste du chapitre — le plafond de lob, le point de non-retour, le coût de la sortie — n'existe qu'à
partir d'un gardien qui vit à 13 m de sa ligne et non à 2.

## 4. La cadence

- **Un sceau = un lot**, jamais deux lois dans un sceau ; le banc complet avant, le tally après `final.done`, le
  déploiement vérifié par le chunk servi.
- **Une campagne = 4-8 lots et une table de nombres avant/après**, publiée dans MOTEUR.md.
- **Une version = une campagne close** : empreintes, changelog, alias retirés, interfaces relues.
- Jalons proposés : **v0.9** à la fin du chantier A (le vrai score, journal sans alias) ; **v1.0** à la fin du
  chantier B (le paquet, la CI avec les onze P0 du protocole, le schéma du journal) ; **v1.1** à la fin de la
  Campagne V ; ensuite une version par volume du book cartographié.

## 5. Ce qui est à décider (par le propriétaire du dépôt, pas par l'agent)

0. **Le book est-il le cahier des charges ?** Si oui, la cartographie (chantier F) devient le générateur des lots
   après 259, et chaque chapitre coûte un jour de lecture avant le premier lot qu'il produit.
1. **Le paquet ou la photocopie ?** Le chantier B suppose que le jeu aval consomme une version publiée. Si l'aval
   préfère continuer à photocopier, B se réduit au schéma du journal et à la CI.
2. **Le vrai score avant les rôles ?** L'ordre A → C est un choix : la Campagne V a été demandée avant, le retour
   aval l'a dépassée en importance. L'inverse est défendable si l'animation attend 253.
3. **Où vit le banc ?** Un banc de 62 minutes en CI coûte des minutes machine à chaque commit ; l'alternative est
   un banc court par commit (annexes, ~5 min) et le banc complet au sceau.
4. **Les cibles du réel** : la table du §2.4 devient-elle une clause (rouge si un nombre s'éloigne de ×1,5) ou reste-
   t-elle informative ? Une clause force la discipline ; elle force aussi des épingles.
