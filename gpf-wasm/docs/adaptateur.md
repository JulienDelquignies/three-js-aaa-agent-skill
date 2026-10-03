# L'adaptateur : notre cerveau aux commandes du corps

*`cerveau.mjs`, `face.mjs` (le face-à-face des anomalies) et `gestes-course.mjs` (les gestes en course), avec `contrat.mjs` et `corps.mjs`. État du 3 octobre 2026, branche `feat/l2-cerveau-corps`.*

## Sommaire

1. [En bref](#1-en-bref)
2. [Les fichiers](#2-les-fichiers)
3. [Un tick de décision, dans l'ordre](#3-un-tick-de-décision-dans-lordre)
4. [Les repères et l'appariement](#4-les-repères-et-lappariement)
5. [Le monde prêté au cerveau](#5-le-monde-prêté-au-cerveau)
6. [Ce que le journal apprend au cerveau](#6-ce-que-le-journal-apprend-au-cerveau)
7. [Les décisions, une par une](#7-les-décisions-une-par-une)
8. [Les réglages recalés sur le corps](#8-les-réglages-recalés-sur-le-corps)
9. [Les options](#9-les-options)
10. [Le contrat avec le corps](#10-le-contrat-avec-le-corps)
11. [La page, les bancs, les gardes](#11-la-page-les-bancs-les-gardes)
12. [Ce que l'adaptateur ne fait pas encore](#12-ce-que-ladaptateur-ne-fait-pas-encore)

## 1. En bref

- **Le cerveau** est le moteur de match de la skill three.js AAA (`moteur.md`). Il sait jouer, mais il n'a pas de mode « décision seule » : il décide sur son propre monde, qu'il fait ensuite bouger.
- **Le corps** est Gameplay Football compilé en WebAssembly (`corps.md`). Il fait courir les joueurs, joue les animations, frappe le ballon, arbitre.
- **L'adaptateur** prête au cerveau, toutes les 100 ms, le monde du corps : positions, vitesses, regards, ballon, possession, passe en vol. Il laisse le cerveau décider, lit ses décisions et les rend au corps sous forme d'**intentions** (aller, presser, passer, tirer, conduire). Ce que le cerveau fait bouger dans son monde est jeté : le tick suivant repart du monde du corps.
- **Ce qu'il décide** : le placement de chacun, le presseur et ses tacles, et pour le porteur la passe, le tir ou la conduite. Il décide aussi la passe et la reprise en première intention, et les fautes de la Loi 12.
- **Ce qui reste au corps** : les gardiens, le jeu arrêté (coups de pied arrêtés, engagements), les gestes de contact (contrôle, amorti, tacle), et le choix de chaque animation.
- **Déterministe** : même graine, même match. La page et les bancs jouent le même match au bit près.

## 2. Les fichiers

| Fichier | Rôle |
|---|---|
| `cerveau.mjs` | l'adaptateur : `creerCerveau({ graine, tactiques, equipes, options })` rend `{ st, decider(etat), observer(journal), stats(), face, faceDerniere }` |
| `contrat.mjs` | le contrat du corps, sans dépendance : les constantes (`INTENTION`, `PASSE`, `EV`, `GESTE`), `lireEtat`, `lireJournal`, `poserIntention`, `poserFautes`, `poserLesArrets`, `ARRETS_REELS`, `CHRONO_REEL` |
| `corps.mjs` | la couche JavaScript du module : `chargerLeCorps()` puis `lancer`, `avancer`, `etat`, `journal`, `intention`, `fautes`, `miTemps` |
| `face.mjs` | le face-à-face « Taarabt » (§ 7.10) : `creerFace({ tirage, attributs, equipes, K, trace })` rend `{ observer, tick, actif, derniere, stats() }` ; `FACE` (sa configuration), `GESTES` (le répertoire) |
| `gestes/*.anim`, `outils/vers-gpf.mjs` | les 18 gestes du face-à-face, convertis du duel pour le corps (n° 101-118) ; le convertisseur, prouvé à l'aller-retour (0,0000°, 0,00 mm) |
| `gestes-course.mjs` | les gestes en course (§ 7.11) : `creerGestesCourse({ equipes, trace })` rend `{ proposer, observer, tick, actif, derniere, stats() }` ; `COURSE` (le répertoire du corps), `animationPour` |
| `gestes/course/*.anim`, `outils/foulee-gpf.mjs` | les 27 gestes en course (9 gestes × 3 allures, n° 200-282) ; le studio qui les cuit depuis la foulée du duel (`docs/gestes-en-course.md`) |
| `paquet.mjs`, `empaqueter.sh` | le cerveau empaqueté pour la page (`out/cerveau.mjs`, esbuild, ≈ 550 Ko) ; `bancs/paquet.mjs` vérifie qu'il joue le même match que les sources |
| `bancs/` | les mesures (§ 11) |

Le cerveau importe directement les modules du moteur de la skill (`../skills/threejs-aaa/assets/starter/src/engine/`) : `match-sim.js`, `movement.js`, `menace.js`, `rondo.js`, `strike-sim.js`, `premiere-intention.js`, `duel.js`, `skills-sim.js`, `passe-faisable.js`, `reprise-physique.js`, `tactics.js`, `reception.js`, `rng.js`, `ball-body.js`, `attributes.js`, `dribble.js`. Il ne modifie aucun de ces modules : tout passe par leurs clés de configuration et par l'adaptateur.

## 3. Un tick de décision, dans l'ordre

Le banc (ou la page) fait, toutes les 100 ms :

```
const d = cerveau.decider(corps.etat());     // si le jeu est en cours, hors coup de pied arrêté
for (const i of d) corps.intention(i.id, i); // une intention tenue par joueur
corps.fautes(d.fautes);                      // la Loi 12 du cerveau, à l'arbitre du corps
corps.avancer(10);                           // 10 pas de 10 ms
cerveau.observer(corps.journal());           // ce qui s'est passé
```

`decider(etat)` (`cerveau.mjs:238`) :
1. **L'appariement**, une fois, au premier appel (`apparier`, :124).
2. **Le prêt du monde** (`preter`, :164).
3. **Les rôles et la Loi 12** : `assignMatchJobs` du cerveau. La faute qu'il adjuge pendant cet appel est lue autour de lui (:245).
4. **Le tacle** du cerveau (`decideTacle`, :336).
5. **Le placement** : `movePlayers` écrit pour chacun sa cible et sa vitesse voulue. Le pas qu'il fait faire au monde prêté est jeté.
6. **Une intention par joueur** des équipes pilotées (§ 7).
7. **L'accrochage** du défenseur battu (`accrocheStep`), une fois le tick décidé.
8. **La première intention** du receveur d'une passe en vol (§ 7.6).

## 4. Les repères et l'appariement

| | Le corps (Gameplay Football) | Le cerveau (la skill) |
|---|---|---|
| Le long du terrain | x, ± 55 m | x, ± 52,5 m |
| En travers | y, ± 36 m | z, ± 34 m |
| En haut | z | y |
| L'équipe 0 attaque | + x | + x |

- On passe de l'un à l'autre par une mise à l'échelle et z = − y (`versCerveau`, `versCorps`, :81-82). Le repère reste direct, et les regards gardent leur sens.
- Le regard : `q.yaw = atan2(− dir.y, dir.x)`, depuis la direction du corps.

**L'appariement** (`apparier`, :124), une fois, au coup d'envoi :
- les gardiens ensemble ;
- chaque joueur de champ du corps au poste du cerveau le plus proche (les deux moteurs posent un 4-3-3 dans leur moitié).

Il pose aussi le **veto des gardiens** (`vetoGardiens`) : le cerveau ne passe jamais à un gardien, parce que le gardien du corps ne sait pas jouer une passe en retrait au pied (§ 12).

## 5. Le monde prêté au cerveau

`preter(etat)` (:164) recopie dans le monde du cerveau (`st`), à chaque tick :

| Ce qui est recopié | Comment |
|---|---|
| Positions, vitesses, regards | par joueur, dans le repère du cerveau |
| L'expulsé | `down` géant (le levier du cerveau pour « il n'existe plus ») et une sortie vers la touche la plus proche (`_exit`) |
| Le ballon | un `BallBody` neuf : position et vitesse du ballon du corps |
| La possession | le porteur que le corps déclare : la phase est **carry** (conduite) |
| La passe en vol | reconstruite depuis le journal (`volDuCerveau`, :147) : d'où elle part, où le corps la joue, son style, sa durée. La phase est **flight** |
| Sinon | ballon libre : la phase est **loose**, la possession au dernier toucheur |
| La tenue du porteur | depuis sa première touche (le journal), pas depuis le dernier clignotement de la possession du corps |
| La faute ouverte | gardée d'un tick à l'autre (la fenêtre d'avantage, Loi 5), sauf ballon mort |
| Le veto des gardiens | `st.laneVeto` |
| Les tirages nommés du cerveau | armés sur le tick physique (`st._flux`) : sans eux, le hasard d'une décision dépendrait de tous les tirages faits avant elle |

Le cerveau ne voit pas les coups de pied arrêtés : `st.restart` est effacé, et le banc n'appelle `decider` qu'en jeu.

## 6. Ce que le journal apprend au cerveau

`observer(evenements)` (:219) lit le journal du corps (`corps.md`, le journal) :

| Événement | Ce qu'il change |
|---|---|
| Touche | le dernier toucheur ; le teneur (qui a le ballon, depuis quand) ; une première intention en attente est oubliée si un autre a joué le ballon ; la passe en vol finit à la touche d'un autre joueur |
| Touche de tir du receveur qui devait reprendre | compte la reprise jouée |
| Passe (au contact) | ouvre la passe en vol : passeur, destinataire visé par le corps, geste, instant ; compte la une-touche jouée |
| But, faute, hors-jeu, coup de pied arrêté | ferment la passe en vol |

## 7. Les décisions, une par une

### 7.1 Le placement : ALLER

`assignMatchJobs` donne à chacun son rôle du moment (presseur, couvreur, soutien, appel…). `movePlayers` écrit sa cible et sa vitesse voulue. L'intention ALLER porte cette cible et cette vitesse, bornée entre 1,5 et 8 m/s (:299).

### 7.2 Le presseur

Le presseur élu par le cerveau suit la logique du cerveau, pas la chasse aimantée du corps. Mesuré : la chasse permanente faisait partir 60 % de nos passes avec un adversaire à moins d'un mètre (au réel, environ un quart sous pression).

| Situation | Intention |
|---|---|
| Par défaut | ALLER vers sa garde (la cible du cerveau, côté but), à la vitesse du cerveau |
| À moins de 3 m du porteur (`rayonCharge`) | PRESSER : il charge (aimant au ballon) |
| Près de son but (porteur à moins de 30 m) | l'**ombre** : ALLER vers sa garde à la vitesse du porteur + 1 m/s, sans plonger |
| Sa cible est le ballon à moins de 0,6 m (la « morsure » du cerveau) | PRESSER |

### 7.3 Le tacle

`decideTacle` (:336) recopie la décision du pas du porteur du cerveau :
- la pression monte de 0,1 par tick tant qu'un défenseur conteste le ballon (`pressPredicate`) ;
- quand elle passe l'horloge du tacle (`horlogeTacle`, plus longue dans sa surface) et que le ballon est prenable (`tackleWindow`), le défenseur s'engage ;
- il reçoit PRESSER pendant 0,7 s, la durée du geste de tacle debout du cerveau.

Le tacle lui-même reste aux réflexes du corps.

### 7.4 Le porteur

`porteurDecide` (:428), à chaque tick où un joueur piloté a le ballon :
1. **La tenue.** Le cerveau ne décide qu'après un temps minimal (0,4 s × l'axe tempo), ou après une tenue tirée au sort quand il est au calme (1,2 à 3 s, plafond 2,5 s). En attendant, il conduit.
2. **Le calme se juge à la frappe.** Le corps met 0,4 s à armer une passe (`LATENCE`). L'adversaire le plus proche est donc projeté de 0,4 s à sa vitesse. Mesuré avant : le cerveau décidait avec l'adversaire à 1,7 m qui fonçait à 5 m/s.
3. **L'intention adoptée** vit 0,9 s : le destinataire ne change pas à chaque tick.
4. **L'arbitrage** du cerveau (`arbitre` : tir, centre, passe ou conduite) est mémorisé 0,25 s.
5. **La passe ou le centre** : `choosePass`. Le gardien est exclu. Puis la règle de la passe dans le corps (§ 7.5). Le type de passe vient du cerveau : « through » devient la passe dans la course du corps, « lofted » ou un centre devient la passe haute, et le reste la passe courte.
6. **Le tir** : `tirDuCerveau` (§ 7.7), tenu 0,9 s.
7. **Sinon** : la conduite. C'est la poussée lissée du cerveau, prolongée à 8 m, à sa vitesse voulue, entre 2 et 6 m/s (`conduite`, :539).

### 7.5 La passe dans le corps : la fin des talonnades

Mesuré le 2 octobre : 9 % des passes partaient à plus de 150° du regard du passeur (au réel, 0,2 à 0,5 %), à 16 m/s, le passeur lancé. À la décision, 35 % des passes du cerveau étaient à plus de 100° de son regard. Le corps n'a pour elles que ses deux talonnades pures.

- **Hors du corps** (`horsDuCorps`, :519) : la passe est à plus de 100° du regard (le seuil du cerveau, `passeFaisable.contact`).
- **La talonnade permise** (courte, au sol, à 10 m au plus : `talonReel`) n'est jouée que par un tirage rare (`pTalon` = 2 %). Ce tirage est fait une fois par possession et par destinataire.
- **Sinon le joueur se tourne d'abord** (`seTourner`, :532) : conduite au pas, 2 m/s, vers sa passe. La passe part quand elle est dans le corps.

Résultat sur 8 matchs complets : 1 % de talonnades.

### 7.6 La première intention : la une-touche et la reprise au but

Le corps ne joue en une touche que si on le lui a demandé avant le contact, au moins une latence plus tôt. L'adaptateur tranche donc **une fois par passe**, quand le ballon est à moins de 0,5 s du receveur (`AVANCE_UNE_TOUCHE`).

Il projette d'abord le monde à l'instant du contact (`premiereIntention`, :372) : chacun avance de sa vitesse, et le receveur se place au point où le ballon l'atteint. Puis, dans l'ordre :

1. **La reprise au but** (`repriseAuBut`, :398), avec les lois du cerveau :

   | Hauteur du ballon au contact | Reprise si |
   |---|---|
   | entre 1,5 m et le front sauté | la **tête** : dans la surface, à moins de 12 m du but, le but dans le corps (120°) |
   | entre 0,25 et 1,15 m | la **volée** : dans la surface, à moins de 14 m, le but dans le corps (100°) |
   | au sol | ce que l'arbitrage du cerveau choisirait le ballon au pied : le tir s'il vaut plus que la passe, le centre ou la conduite |

   Le tir garde la loi de finition du cerveau, calculée au point de contact.
2. **Sinon, la passe en une touche** : la fonction `uneTouche` du cerveau. Le seuil du ballon jouable est celui du corps : 15 m/s au lieu de 9,5.
3. **L'intention tenue** jusqu'au contact (+ 0,8 s).

### 7.7 Le tir

`tirDuCerveau` (:492) applique l'échelle de finition du cerveau (`finitionSigma`, lot 258 de la skill) :
- **le point visé** : le côté ouvert, à 0,9 m du poteau ;
- **la hauteur** est tirée dans le mélange du cerveau : ras de terre, mi-hauteur, lucarne ;
- **les écarts de cap et d'élévation** dépendent de la pression du défenseur le plus proche, de la distance, de la vitesse de frappe, de la fatigue et de la finition du tireur ;
- **la frappe est sous-dosée** sous pression.

Le corps ne pilote pas la hauteur d'une frappe : un tir que le cerveau envoie au-dessus devient un tir à côté, du même côté. Le cadrage reste celui du cerveau.

### 7.8 La Loi 12

- **L'accrochage du défenseur battu** est la loi du cerveau (`duel.js`, lot 97). Sa probabilité est recalée sur le corps (§ 8).
- **L'avantage puis le sifflet** s'adjugent dans l'administration du cerveau (`assignMatchJobs` → `adjugeFaute`).
- **L'adaptateur lit la décision** autour de cet appel, puis la transmet :
  - le sifflet part à l'arbitre du corps (`gf_faute`) : coup franc ou penalty, au lieu de la faute et non là où se trouve la victime au coup de sifflet (mesuré avant : 7 penalties en 8 matchs) ;
  - ou bien le carton seul, quand l'avantage a été joué (`gf_carton`).

### 7.9 Les gardiens

Ils reçoivent l'intention IA : le gardien du corps décide seul (placement, arrêts, relances).

### 7.10 Le face-à-face « Taarabt » (`face.mjs`, option `face`)

**La référence** : Taarabt, image par image, et Headrick (thèse QUT). Le porteur est planté à 1,5-2 m du défenseur, la semelle sur le ballon. Il enchaîne 2 à 4 feintes ; le défenseur garde, montre la fente, puis mord ou se jette ; le porteur part. Un face-à-face dure de 3,3 à 5 s.

**La loi** est celle du duel (`face.js`, branche `feat/1v1-maquette`), avec ses seuils. Elle tourne à chaque tick, après les décisions du cerveau, et remplace celles du porteur et de son défenseur. Tant que le face-à-face vit, elle pose leurs deux intentions à chaque tick (`poserTout`).

| Phase | Le porteur | Le défenseur |
|---|---|---|
| Entrée | Le cerveau a choisi CONDUIRE ; il conduit (pas de passe ni de tir en cours) et a touché le ballon le dernier. Un défenseur est devant, à 1-2,6 m freinage compris, face à lui, hors de la zone de tir. Personne d'autre ne peut arriver à 2,5 m avant 2 s. **Le porteur est une anomalie** : flair ≥ 0,9 et nature de dribbleur ≥ 3 (ci-dessous). Au tirage de l'envie : de 0,4 à 0,85 selon la nature, × la zone (0 à moins de 25 m de son but, 0,3 dans son tiers, 0,7 au milieu, 1 dans le tiers adverse). | — |
| Tenue | l'arrêt de semelle (GESTE 101), puis la tenue : la semelle posée sur le ballon, sans le toucher (GESTE 117 ou 118, du côté où il est). Le ballon a quitté la semelle : l'arrêt de semelle le reprend (deux fois au plus). | la garde (ALLER au drapeau 1 : ni contrôle, ni intervention, ni tacle glissé de lui-même), à 1,1-1,8 m du ballon sur la ligne ballon → son but |
| Feintes | Une feinte au tirage : le passement (parfois une série de 2 à 4), la feinte de corps semelle dessus, ou le roulé de semelle (GESTE 102-109). Demandée un tick avant la fin du geste en cours. | Au contact de la feinte vraiment jouée (`GF_EV_GESTE`), il mord avec p = (0,15 + 0,12 × feintes vues) × vente × gesteF × (2 − anticipF). Mordu, il glisse de 0,6 m du côté vendu, sans réflexes. |
| Fente | Il la lit avec p = 0,5 × anticipF × (2 − tempo du tacleur), au temps de réaction du duel : le tiré de semelle, la roulette ou le râteau (GESTE 110-114). | À bout de patience (1,6-3,2 s), ou mordu (35 %) : la charge (0,2 s). Puis la jambe part sur sa ligne, vers le ballon d'alors anticipé de 0,3 s ; le corps glisse jusqu'à 0,7 m, au sprint. Ses réflexes ne s'ouvrent qu'à l'instant de la jambe du duel (0,28 s après la charge), si le ballon est resté dans son couloir (0,35 m) et à sa portée (0,7 m). Manquée : déséquilibré 0,45 s, ou au sol 1,2 s (au tirage : 0,3, × 1,5 mordu). |
| Sortie | Le mordu décalé, la fente passée, ou au bout de 5 s : la croqueta, le râteau (seulement du côté où il ratisse) ou la roulette vers le côté ouvert (GESTE 112-115). Ce sont des gestes **en série** : plusieurs touches, le corps qui tourne et part (`corps.md` § 5.7). Puis CONDUIRE lancé à 7 m/s pendant 0,8 s. Déjà lancé, la conduite tout de suite. | Ses réflexes lui reviennent, sauf mordu, déséquilibré ou au sol. |

**Réservé aux anomalies (3 octobre).** Le retour : « je ne veux pas qu'un central commence à vouloir faire un 1v1 ; Taarabt, Ben Arfa, Kevin-Prince Boateng, Saint-Maximin, ce sont des anomalies ». L'envie d'hier (0,7 + 0,3 × flair) faisait entrer n'importe quel porteur, et sans effectif noté le flair était tiré au hasard, poste ignoré : un défenseur central à 0,97 de flair. Désormais, l'entrée demande le flair hors norme (≥ 0,9, une note ≥ 88) ET la nature de dribbleur du cerveau (`nature.js`, `specialisteF` : le flair et l'attribut composite du dribbleur, bornée de 0,1 à 6) ≥ 3. Le technicien (Olmo, flair 80) n'y entre pas : il dribble en course (§ 7.11). Mesuré (20 min, graine 7) : 3 fenêtres géométriques en 20 min, toutes refusées « hors nature » avec les effectifs générés ; avec un artiste posé sur l'ailier gauche, une, refusée au tirage. Les mesures ci-dessous datent d'avant cette porte : le face-à-face ouvert à tous.

**La fin** se lit au journal, pas à la possession que déclare le corps (elle clignote). Le face-à-face finit :
- sur une passe ou un tir du porteur ;
- sur la touche d'un partenaire, d'un autre adversaire, ou du défenseur ;
- quand le ballon est à plus de 1,3 m du porteur planté (3 m dans sa sortie lancée) ;
- quand un second adversaire arrive à 2,5 m ;
- quand le défenseur est dépassé ou décroche, ou que le jeu s'arrête.

Un ballon disputé rend la main au cerveau tout de suite. L'issue, elle, se lit à la touche suivante (moins de 0,6 s) : `fente-gagnee` ou `fente-contree`, `sortie-coupee` ou la sortie, `echappe` ou `echappe-repris`.

**Ce que le corps a imposé au portage**, chaque point mesuré (`bancs/face-match.mjs`, chronique `faceTrace`) :
- **La garde muette.** Les réflexes de duel du corps jugent le ballon gagnable sur la seule géométrie ; face à un porteur planté, toujours. Le défenseur le piquait au premier pas : 14 face-à-face sur 27. La garde est donc ALLER au drapeau 1 : le corps ne met plus ces réflexes en file (`patch.py`, étape 13).
- **La fente engagée.** Sous PRESSER, la chasse aimantée du corps, le défenseur suivait le ballon où qu'il aille. Il le touchait presque à chaque fente, et n'était jamais battu (0 fois sur 14). La fente du duel ne gagne que le ballon resté sur sa ligne : c'est la porte de ses réflexes. Résultat : battu 5 fois sur 14.
- **La fin à la touche du défenseur.** Après sa touche, le corps ne tient plus le porteur pour possesseur : notre « conduire à l'arrêt » n'est plus lu, et leur IA le fait courir après le ballon. La loi qui continuait demandait alors un râteau à l'arrêt à un porteur lancé à 6 m/s.
- **L'issue à la touche suivante.** Sur 9 fentes « gagnées » à la touche, le porteur avait encore le ballon 2 s plus tard 8 fois.
- **Les deux intentions à chaque tick.** Un geste raté, ou une sortie décidée, sautaient la pose. Le porteur reprenait alors pour un tick l'intention du cerveau, parfois une passe, et la jouait.
- **Le geste tenu jusqu'à sa touche.** Le joueur du corps remet en file un contrôle tant que sa touche n'a pas eu lieu, un déplacement à tout moment (`corps.md` § 5.6). L'intention d'un geste est donc tenue jusqu'à sa première touche (jusqu'à sa fin s'il n'en a pas) : la conduite lancée posée au départ de la croqueta la coupait. La suite se pose après la touche, sinon le corps le rejoue : six croquetas d'affilée.
- **Le ballon sous la semelle.** Entre deux gestes, « conduire à l'arrêt » laissait le contrôle du corps replacer le ballon à sa distance à lui (0,36-0,40 m devant, centré). Nos gestes semelle touchent tôt (0,04 s) et l'attendent sous la semelle (0,28 m) : le corps refusait de les lancer, faute de pouvoir rattraper l'écart à la première touche. D'où la tenue, la semelle posée sans toucher, et le ballon rangé par chaque geste planté (`corps.md` § 5.7). Les gestes demandés joués passent de 89 à 95 % ; la roulette, de 0 à 4 sur 8 contre une fente lue.
- **La jambe à son instant.** Ouverts dès la charge, les réflexes du défenseur touchaient le ballon 0,11-0,21 s plus tard, avant la jambe du duel (0,28 s) et avant toute réponse du porteur. Ils s'ouvrent 0,16 s avant l'instant du duel (leur délai mesuré).
- **La lecture au rythme du duel.** La loi tourne tous les 100 ms, le duel à chaque image : la lecture attendait en moyenne un demi-tick de plus. Elle part au temps de réaction du duel, moins ce demi-tick.
- **Le râteau de son côté.** Il ratisse le ballon à travers le corps (ballon à droite, sortie à gauche) ; le duel ne le tire que si le côté ouvert est le sien. Le portage le tirait de n'importe quel côté.
- **Le pas du corps.** Sous 1,8 m/s, il pivote ; au-dessus, une foulée couvre près d'un mètre. Le jab de 0,35 m devenait un aller-retour de 1,2 à 2,45 m du porteur. La garde reste donc plantée sous 0,45 m d'écart. Elle vise au-delà de la bande morte du placement (0,5 m), à 2 m/s au moins. Le jab, lui, ne se voit pas.
- **Le vrai un-contre-un.** Avec la seule règle « personne à moins de 4 m », un face-à-face sur quatre finissait en 1,2-1,6 s, à l'arrivée du second presseur.
- **Ni fautes, ni surface.** 22 face-à-face sur 8 graines × 20 min : aucun dans la surface, aucune faute liée à l'un d'eux. Les écarts de fautes entre séries viennent de la divergence des trajectoires.

**Mesuré** (`bancs/face-match.mjs`, loi finale, 8 graines × 20 min) :

| | Mesure | Référence |
|---|---|---|
| Face-à-face | 20 en 160 min, ≈ 11 par 90 min (16,4 par match sur 8 × 90 min) | — |
| Durée moyenne | 2,9 s | 3,3-5 s |
| Feintes | 1,4 par face-à-face | 2-4 |
| Gestes demandés, joués | 95 % (54 sur 57) | — |
| Issues | fente contrée 9, fente gagnée 6, sortie coupée 2, sortie sur la fente mordue 1, second défenseur 1, piqué puis repris 1 | — |
| 2 s après | ballon à l'équipe du porteur 12 fois sur 20, défenseur battu 2 fois | dribbles réussis ≈ 45-55 % (élite) |

**Ce qui reste : l'équilibre du duel.** La fente touche le ballon dans 15 face-à-face sur 20, et le défenseur n'est battu que 2 fois. Les sorties lues partent, mais la jambe les rattrape encore : le ratissage, la roulette quittent le couloir de la fente plus lentement que dans le duel. Avec une configuration de mesure (toutes les fentes lues, sorties forcées : `CERVEAU_OPTIONS='{"faceK":{"lecture":2,"sorties":{"rateau":0.5,"roulette":0.5}}}'`), 29 face-à-face : la croqueta part 5 fois sur 5, la roulette 4 sur 10, et la fente touche le ballon 22 fois.

### 7.11 Les gestes en course (`gestes-course.mjs`, option `gestes`)

Le détail, la référence (Dani Olmo) et le studio : `docs/gestes-en-course.md`. En bref :
- **Le cerveau décide** (`gesteDuCerveau`, à chaque tick du porteur, avant l'arbitrage) : ses « niches du 1c1 » dans l'ordre de son pas — la croqueta contre le défenseur qui se jette, le petit et le grand pont, la roulette contre le poursuivant, le râteau contre la charge, le passement contre le jockey posté, la feinte de corps (portée du duel), le crochet contre la course fermée. Son monde est prêté : on lit le geste qu'il lance (`c.act`), puis on l'efface.
- **Qui les tente** : dribM (le rôle, le lieu, la cadence, la nature, la lucidité) × le flair × la technique — les centraux presque jamais, les ailiers et le 10 souvent, les anomalies le plus.
- **Le corps les joue** : l'animation du répertoire en course de l'espèce, à la variante de l'allure du porteur (2,5 m/s sous 3, 3,5 sous 4,2, 5 au-delà ; le passement, la croqueta et le râteau plantés sous 1,8 m/s) ; l'intention GESTE tenue jusqu'à sa première touche (0,7 s au plus pour partir), puis la conduite de sortie. Le côté, le corps le prend (le fichier ou son miroir, au plus près de la sortie demandée).
- **La morsure** (`jugerContact`) : à la première touche du geste, le noyau de duel du cerveau (`noyauAuContact`) juge le take-on contre le défenseur visé ; franchi, il mord le temps que le cerveau donne au geste — il part sur la ligne que le porteur a quittée, sans réflexes de duel (ALLER au drapeau 1). Mesuré : le ballon gardé 1,5 s après le geste dans 62 % des cas, 52 % sans (3 × 30 min).
- **Pas encore dans le corps** (comptés, le porteur conduit) : le râteau et la roulette lancés ; tout geste au sprint (≥ 6 m/s).
- **Mesuré** (4 × 30 min) : 72-81 % des gestes demandés partent, le ballon gardé 1,5 s après dans 60 % des cas ; les centraux font 0 ou 1 geste par demi-heure, les ailiers et le 10 3 à 6 par minute de ballon. Le détail : `docs/gestes-en-course.md` § 5.

## 8. Les réglages recalés sur le corps

Le cerveau a été réglé, lot après lot, dans son propre monde. Ces réglages sont recalés sur le corps, chacun mesuré :

| Réglage | Valeur | Pourquoi, mesuré |
|---|---|---|
| `chrono`, `loi3` | coupés | le temps, les Lois du jeu arrêté et les remplacements appartiennent au corps ; un chrono vivant ferait changer de camp le cerveau seul |
| `uneTouche.vmax` | 15 m/s (9,5 dans son monde) | les passes du corps arrivent à 9,5-15 m/s dans 75 % des réceptions, et leur IA y joue en une touche à 67-86 % de réussite |
| `accrocheMod` | × 17 / 35,9 × 1,7 | environ 17 accrochages par match, comme dans son monde |
| `retenueSurface.accro` | × 0,27 | 1 penalty par match mesuré, pour environ 0,27 au réel |
| `selection.bloc` et le calage par classe | 0,45 (0,06 dans son monde) | il prévoyait 81 % de passes réussies et en obtenait 72 % ; réajustés sur les issues du corps, par log-vraisemblance (`bancs/autopsie-passes.mjs`) |
| `LATENCE` | 0,4 s | le temps du corps entre l'ordre de passer et la frappe (médiane ; p25 0,3, p75 0,5) |
| `AVANCE_UNE_TOUCHE` | 0,5 s | la latence et un tick |
| `DUREE_TACLE` | 0,7 s | la durée du tacle debout du cerveau |
| `passements.plancher`, `decalage.plancher` | 0 (0,35 et 0,3 dans son monde) | les planchers d'appétit du passement et du crochet faisaient dribbler tout porteur, central compris : les centraux à 4,1 gestes par minute de ballon, les ailiers à 10,6 (30 min, graine 7) |
| `dribble.volume` | × 0,4 (`volumeGestes`) | le volume des gestes calé sur le réel par poste : 186-219 décidés par 90 min avant, 72-108 après |
| `nature.specialiste.k` | 2,2 (1,6 dans son monde, `penteNature`) | la pente de la nature : le central à 0,28 de la fréquence médiane au lieu de 0,43, l'ailier à 2,5 au lieu de 2,2 ; les centraux à 0-1,2 geste par minute de ballon, les ailiers et le 10 à 4,3-6,5 |

## 9. Les options

Chaque réglage de l'adaptateur se débraye, pour la mesure A/B : `creerCerveau({ options })`, ou `CERVEAU_OPTIONS='{…}'` pour les bancs.

| Option | Défaut | Effet |
|---|---|---|
| `flux` | oui | les tirages nommés du cerveau, armés sur le tick physique |
| `uneTouche` | oui | la première intention posée avant le contact |
| `fautes` | oui | la Loi 12 du cerveau transmise à l'arbitre du corps |
| `accroche` | 1,7 | le facteur de l'accrochage sous le pressing à la garde |
| `presseGarde` | oui | le presseur va à sa garde au lieu de charger en permanence |
| `tacle` | oui | la décision de tacle du cerveau |
| `mord` | oui | la morsure : PRESSER quand la cible du presseur est le ballon |
| `rayonCharge` | 3 m | la distance où le presseur charge |
| `ombre` | oui | le presseur fait l'ombre près de son but |
| `rayonSurface` | 2,2 | le facteur de charge près du but, sans l'ombre |
| `presse` | aucun | `'corps'` : la chasse native du corps, pour comparer |
| `jockeyCap` | aucun | le plafond du jockey, à l'essai |
| `finition` | oui | la loi de finition du cerveau sur le tir |
| `talon` | `'tourne'` | la passe hors du corps : se tourner d'abord ; `'autre'` : une autre passe ; aucun : telle quelle |
| `pTalon` | 0,02 | la part des talonnades permises jouées |
| `seuilCorps` | aucun (100°) | l'écart au regard au-delà duquel la passe est hors du corps |
| `reprise` | oui | la reprise au but en première intention |
| `face` | oui | le face-à-face « Taarabt » (§ 7.10) |
| `faceK` | aucun | la configuration du face-à-face, à l'essai (par clé de premier niveau) |
| `faceTrace` | aucun | `(t, quoi, détail)` : la chronique du face-à-face, pour les bancs |
| `gestes` | oui | les gestes en course (§ 7.11) : `true` le corps les joue ; `'mesure'` comptés sans rien changer au match ; `false` muets |
| `gestesTrace` | aucun | `(t, quoi, détail)` : la chronique des gestes en course |
| `volumeGestes` | 0,4 | × le volume des gestes du cerveau (`dribble.volume`) ; `null` : le sien |
| `penteNature` | 2,2 | la pente de la nature du spécialiste (`nature.specialiste.k`) ; `null` : la sienne (1,6) |
| `gestesAttente` | 0,7 s | la vie d'une demande de geste avant qu'elle tombe (1,1 s n'en fait pas partir plus) |
| `gestesMorsure` | oui | la morsure du défenseur franchi au contact d'un geste en course (le noyau du cerveau) |
| `effectifs` | (générés) | `false` : aucun effectif (tous notés 50, le flair au hasard) — aussi le paramètre `effectifs` de `creerCerveau` : les deux effectifs notés de la carrière |
| `niveau` | 60 | la note moyenne des effectifs générés |
| `archetypes` | aucun | `[{ equipe, poste, type }]` : un profil (`ARCHETYPES` : `artiste`, `technicien`) posé sur un joueur généré |

## 10. Le contrat avec le corps

**Une intention** : `{ id, genre, x, y, vitesse, cible, puissance, drapeaux }` (`poserIntention`, `contrat.mjs`).

| Genre | Champs lus | Effet dans le corps |
|---|---|---|
| IA (0) | — | leur contrôleur décide |
| ALLER (1) | x, y (monde du corps), vitesse | va au point, ralentit à l'approche ; s'il reçoit le ballon, le garde et conduit vers ce point |
| PRESSER (2) | x, y, vitesse ; drapeaux 1 = la chasse du corps | fond sur le porteur adverse, aimant au ballon |
| PASSER (3) | cible (id du corps), drapeaux 0 courte, 1 dans la course, 2 haute | la passe du corps, destinataire imposé |
| TIRER (4) | x, y (le point visé sur la ligne de but), puissance | la frappe du corps vers ce point |
| CONDUIRE (5) | x, y, vitesse | la conduite du corps vers ce point |
| ALLER (1), drapeau 1 | x, y, vitesse | la garde du face-à-face : va au point, sans réflexes de duel |
| GESTE (6) | cible (le n° du geste, 101-116), x, y (le regard), vitesse ; drapeau 0 avec touche, 1 sans | le geste de notre répertoire, au porteur ; s'il ne peut pas partir, le corps freine (son contrôle réflexe) |

**Le journal** ajoute `GESTE` (7) : un geste de notre répertoire démarre, `a` = son numéro ; et `SERIE` (8) : une touche d'un geste en série, `a` = son rang, `b` = son image, `c` = l'écart du ballon à l'attendu, `d` = la vitesse posée (`a` = −1 : la série s'arrête).

**Une faute** : `{ fautif, victime, gravite, x, y }` pour le sifflet (1 faute, 2 jaune, 3 rouge), ou `{ carton, couleur }` pour le carton seul (`poserFautes`).

**Ce qui n'est pas transmis** : `reprise`, `uneTouche`, `job` et `trace` sont des marques pour les bancs. Le regard voulu, le nom du geste et la variante de la une-touche ne passent pas (§ 12).

**Les compteurs** (`stats()`) :
- les premières intentions décidées et jouées ;
- les fautes et les tacles du cerveau ;
- les passes tournées, reportées et les talonnades permises ;
- les angles des passes à la décision ;
- les reprises décidées et jouées ;
- les tirs et les tirs cadrés ;
- les refus nommés du cerveau (`st.deny`).

## 11. La page, les bancs, les gardes

**La page** (`feat/l2-regardable`, `examples/showcase/src/scenes/GpfMatch.js`) :
- elle charge `gpf.mjs` puis `cerveau.mjs`, et pose les vraies durées des remises (sauf `?arrets=0`) ;
- trois modes : notre cerveau des deux côtés (par défaut), `?ia` (leur IA), `?contre=ia` (notre cerveau à gauche) ;
- elle décide tous les 10 pas, comme les bancs, et lit le journal après chaque avance ;
- la mi-temps à 45:00 (`gf_mi_temps`), la fin à 90:00, jugées au début du tick comme dans les bancs ;
- le face-à-face (`?face=0` l'éteint) : la caméra se rapproche sur le duel (9 m, 3,8 m de haut) et y reste 1,5 s après sa fin ; l'état dit son issue en clair ; la touche F, ou `?face=saut`, avance le match à toute vitesse jusqu'au prochain.

Le cockpit la sert sur /match11.

**Les bancs** (`bancs/`) :

| Banc | Mesure |
|---|---|
| `match-cerveau.mjs` | un match à l'horloge, avec sa feuille et les critères du §6 du cadrage : buts et leur origine, tirs et xG, passes et réussite, fautes et cartons, une-touche, talonnades, « copains avec le ballon », téléportations, empreinte finale |
| `serie.mjs` | la règle de mesure : série courte (8 graines × 20 min, un match par cœur, cache par empreinte du code) pour trancher, série complète (`--complet`, 8 × 90 min) pour valider |
| `autopsie-passes.mjs` | chaque passe : la prévision du cerveau (brute, calée, classe, pression), l'issue dans le corps |
| `autopsie-tirs.mjs` | chaque tir : position, xG de référence, pression, gardien, hauteur, issue |
| `autopsie-buts.mjs` | chaque but : sa chaîne de touches |
| `obeissance.mjs` | le corps obéit-il : la cible atteinte, le destinataire imposé, le presseur collé |
| `animations.mjs`, `animations-bilan.mjs` | le relevé des animations du corps (`animations.md`) |
| `paquet.mjs` | la garde du paquet : il joue le même match que les sources |
| `face-match.mjs` | le face-à-face : combien, sa durée, ses feintes, ses morsures et ses fentes, les gestes joués, ses issues, la suite à 2 s |

**Les gardes** :
- intentions actives mais aucune posée : le match du corps est identique au bit (empreinte 1616609301, graine 7, 2 000 pas) ;
- le paquet joue le même match que les sources (− 2094044079, 1 min, graine 7) ;
- la page joue le même match que Node (6 010 pas, graine 7 ; 16 010 pas, graine 11, un face-à-face compris).

## 12. Ce que l'adaptateur ne fait pas encore

- **Il n'appelle pas le pas du cerveau** (`matchStep`, `rondoStep`). 114 des 155 gestes du cerveau y sont décidés, et le corps ne les reçoit donc pas (`inventaire-moteur.md`, §7) :
  - les dribbles et les feintes autres que ceux des niches du porteur (§ 7.11) et du face-à-face (§ 7.10) — la feinte de passe, la feinte de frappe, l'arrêt de semelle au calme ;
  - le choix du contrôle ;
  - le jeu aérien, hors tête au but ;
  - les décisions des gardiens ;
  - les coups de pied arrêtés ;
  - les gestes de l'arbitre ;
  - les célébrations.
- **Il ne joue pas le porteur tout à fait comme le moteur.**
  - Dans la boucle du moteur (`rondo-sim.js:885-971`), l'arbitrage ne décide lui-même que le tir et le centre.
  - Une passe n'y est adoptée que si son score dépasse une barre : haute au calme, réglée par le tempo ; basse sous pression.
  - Des appels l'abaissent : le coureur lancé, l'homme libre dans l'espace, le défenseur qui se jette, le presseur qui arrive.
  - L'adaptateur, lui, suit l'arbitrage tel quel : « passe » donne une passe dès la tenue passée, sans barre ; « conduite » donne une conduite (`porteurDecide`, § 7.4). C'est un écart de structure, relevé par la documentation du moteur (`moteur.md`, § 4.5 et § 9).
- **Ses joueurs voient tout.** La perception de chacun (`croyanceStep`, le bruit d'observation du moteur) n'est jamais calculée : marqueurs et passeurs du cerveau lisent la vérité (`moteur.md`, §9).
- **Il ne transmet ni le regard voulu, ni le nom du geste**, hors face-à-face et gestes en course : le corps choisit son animation seul. Les 18 gestes du face-à-face et les 27 gestes en course passent par l'intention GESTE (§ 7.10, § 7.11).
- **Les gestes en course ne sont pas tous dans le corps** (§ 7.11, `docs/gestes-en-course.md`) : le râteau et la roulette lancés, et tout geste au sprint, sont décidés et comptés, pas joués. Un geste demandé sur quatre ne part pas dans les 0,7 s (le porteur pris dans un autre geste, ou le ballon hors de portée).
- **Le face-à-face n'est pas encore tout à fait celui du duel.**
  - La fente gagne trop : elle touche le ballon dans 3 face-à-face sur 4, le défenseur n'est battu qu'une fois sur 10 (§ 7.10).
  - Le jab ne se voit pas : le corps n'a pas de pas plus court qu'un mètre.
  - Un geste demandé sur vingt ne part pas encore.
  - Réservé aux anomalies, il est rare : une fenêtre par demi-heure, au tirage.
  - Les face-à-face durent 2,9 s, pour 3,3 à 5 au réel : la fente vient tôt.
- **Il ne transmet pas les attributs au corps**, et ceux du cerveau sont générés par poste tant que la carrière ne lui passe pas ses effectifs (`attributs.md`, lot L3).
- **Il ne reçoit pas d'ordres en cours de match** : ni remplacement, ni correctif tactique (les Ordres v1 du cadrage).
- **Il ferme la ligne vers les gardiens.** Le gardien du corps ne sait pas jouer une passe en retrait au pied : 4 buts contre son camp sur 32 passes au gardien, mesuré avant le veto.
- **Le réglage des résultats est suspendu** tant que le moteur n'est pas définitif (décision du 2 octobre au soir). Ce sont les buts (3,9 par match pour 2,75), les buts amenés par une passe, l'avantage du domicile.

L'histoire de chaque correction, mesure à l'appui, est dans le `README.md` de `gpf-wasm`, par date.
