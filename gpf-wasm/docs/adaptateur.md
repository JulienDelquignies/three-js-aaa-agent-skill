# L'adaptateur : notre cerveau aux commandes du corps

*`cerveau.mjs`, 547 lignes, avec `contrat.mjs` et `corps.mjs`. État du 2 octobre 2026, branche `feat/l2-cerveau-corps` (e39edb2).*

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
| `cerveau.mjs` | l'adaptateur : `creerCerveau({ graine, tactiques, equipes, options })` rend `{ st, decider(etat), observer(journal), stats() }` |
| `contrat.mjs` | le contrat du corps, sans dépendance : les constantes (`INTENTION`, `PASSE`, `EV`, `GESTE`), `lireEtat`, `lireJournal`, `poserIntention`, `poserFautes`, `poserLesArrets`, `ARRETS_REELS`, `CHRONO_REEL` |
| `corps.mjs` | la couche JavaScript du module : `chargerLeCorps()` puis `lancer`, `avancer`, `etat`, `journal`, `intention`, `fautes`, `miTemps` |
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
- la mi-temps à 45:00 (`gf_mi_temps`), la fin à 90:00.

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

**Les gardes** :
- intentions actives mais aucune posée : le match du corps est identique au bit (empreinte 1616609301, graine 7, 2 000 pas) ;
- le paquet joue le même match que les sources (− 2094044079, 1 min, graine 7) ;
- la page joue le même match que Node (6 010 pas, graine 7).

## 12. Ce que l'adaptateur ne fait pas encore

- **Il n'appelle pas le pas du cerveau** (`matchStep`, `rondoStep`). 114 des 155 gestes du cerveau y sont décidés, et le corps ne les reçoit donc pas (`inventaire-moteur.md`, §7) :
  - les dribbles et les feintes ;
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
- **Il ne transmet ni le regard voulu, ni le nom du geste.** Le corps choisit son animation seul. Le mécanisme pour lui demander un geste précis existe déjà (`animations.md`, partie 3).
- **Il ne transmet pas les attributs des joueurs**, ni au cerveau ni au corps : `attributs.md`.
- **Il ne reçoit pas d'ordres en cours de match** : ni remplacement, ni correctif tactique (les Ordres v1 du cadrage).
- **Il ferme la ligne vers les gardiens.** Le gardien du corps ne sait pas jouer une passe en retrait au pied : 4 buts contre son camp sur 32 passes au gardien, mesuré avant le veto.
- **Le réglage des résultats est suspendu** tant que le moteur n'est pas définitif (décision du 2 octobre au soir). Ce sont les buts (3,9 par match pour 2,75), les buts amenés par une passe, l'avantage du domicile.

L'histoire de chaque correction, mesure à l'appui, est dans le `README.md` de `gpf-wasm`, par date.
