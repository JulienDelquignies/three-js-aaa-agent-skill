# 53 — Le terrain, le gardien, le match réduit

Le pas « agrandir le terrain » : du carré d'entraînement au MATCH — deux buts, des gardiens, des
tirs, des remises en règle, un score. Trois modules (`pitch.js`, `keeper.js`, `match-sim.js`) et
une décision d'architecture qui est tout le chapitre.

## L'architecture : le match est une CONFIGURATION, pas un fork

Il n'y a QU'UN game-loop (rondo-sim, 40 clauses). `match-sim` le configure par cinq points
d'accroche posés là où le rondo disait « carré abstrait » :

| hook | ce qu'il remplace | ce que le match y met |
|---|---|---|
| `cfg.assignJobs` | l'attribution anti-essaim du rondo | la même grammaire, DIRECTIONNELLE (porteur vers le but, couloirs orientés, défense goal-side, gardiens) |
| `cfg.tryShot` | — (le rondo n'a pas de but) | le tir : portée, couloir, coin choisi CONTRE le gardien réel |
| `cfg.onOut` | la remise unique du carré | `pitch.outRule` : but / touche / corner / sortie de but |
| `cfg.onDive` | — | le toucher du plongeon, par image |
| `cfg.canTake` | premier arrivé prend | l'ayant droit et l'heure d'une remise |
| `cfg.passBias` | conservation pure | la PROGRESSION (0,22/m vers le but, plafond ±3, la sécurité reste reine) |

Duels, gestes techniques, personas, tempo, balistique : le MÊME code — mesuré, 49 gestes
techniques en 4 matchs. Le rondo sans ces hooks est inchangé (40/40).

## Les lois (chacune une clause)

1. **Le terrain est une donnée** (`pitch.js`) : RÉDUIT (46 × 30, buts 5 × 2) et PLEIN FORMAT
   (105 × 68, Loi 1) déjà défini. La sortie se juge au point de franchissement INTERPOLÉ et à la
   PREMIÈRE ligne croisée (un tir sorti en coin est une sortie de but, pas une touche) ; en
   format réduit la touche se joue au pied — une loi du FORMAT (futsal), écrite, pas honteuse.
2. **Le gardien a deux lois** (`keeper.js`) : la POSITION (sur la ligne ballon-centre, profondeur
   qui coupe l'angle : 0,45 m à 24 m, 1,97 m à 12 m, re-recul sous 7 m) et l'ARRÊT (le vol lu en
   balistique ; réflexe 0,12 s — pas d'oracle ; petit périmètre → prise ; envergure 2,1 m →
   plongeon ; au-delà → BATTU, un état honnête). Le plongeon est un skill de la machine de gestes
   (clip existant + contact 0,55) : armé, détente `ownsBody`, prix (au sol 0,75 s).
3. **Le toucher du plongeon est CONTINU** : testé à la frame de contact du clip, il ratait tout
   vol plus prompt — 2 arrêts sur 15 détentes. Le gant rencontre le ballon à l'image où il PASSE
   (16/19 après). Prise ≤ 1,1 m, claquette ≤ 1,7 m, sinon `plongeon-battu` au registre.
4. **Un tir est un geste d'opportunité et de puissance.** La tenue calme ne s'y applique pas
   (27 refus 'timing', 0 tir mesuré avant) ; la course ne le refuse pas (le défenseur qui coupe
   EST le duel du tir) ; solvePass rend une vitesse d'arrivée — le tir prend un plancher
   (17 m/s) ; à bout portant on tire dans le trafic (couloir 0,25 m contre 0,45 au-delà de 9 m).
5. **Le gardien porteur est un distributeur.** Sa loi de position l'a fait marcher vers sa ligne
   EN PORTANT le ballon — CSC mesuré (graine 3, t=73,95). Ballon en mains : il s'écarte et le
   cerveau de passe distribue. Et il REVIENT en pressant le pas (bucket de vitesse `keeper`,
   6,4 m/s — mesuré à z=−4, hors cadre, sur 4 des 5 buts sans plongeon).
6. **Une équipe PROGRESSE.** Sans le terme de progression, le match était un rondo dans sa
   moitié : possession dominante (191 c. 140) entièrement à x = −15, toutes les pertes entre −9
   et −23, zéro sortie de camp en 120 s.

## Les chiffres (4 graines × 120 s)

33 tirs, 8 buts (conversion 24 % — bande réelle du format réduit), 16 arrêts sur 19 détentes,
remises en plusieurs espèces, 4/4 contrats complets. Scores : 2-1, 3-0*, 0-1, 1-2 (*graine 7).

## La scène

`match.html` — la MÊME scène Rondo en mode `?match` (une scène, deux configurations) : buts de
`goal.js` aux lignes, gardien en maillot jaune, cadrage terrain, HUD au score, `check()` bascule
sur checkMatch.

## La sortie aérienne (B10 — `sortie-aerienne.js`, `cfg.sortieAerienne` ; doc Branchements § 10)

Mesuré avant (12 matchs × 300 s) : 1 prise aérienne, 7 ballons hauts passés à moins de 2 m du gardien — il ne
VENAIT pas au-devant des centres : `keeperSpot` le tient sur sa bissectrice, `keeperDecide` ne lit que le vol
qui coupe le plan du but (le tir), et la prise à deux mains (`receive` → 'prise-gardien') attend un ballon sous
1,9 m à portée de bras. Le centre qui retombait dans la surface de but se jouait à la tête ou au rebond.

La loi (le vol est déterministe — `predictPath`, comme la tête armée B3) : sur un ballon LIBRE qui monte ou qui
est haut (à ≤ `portee` 40 m de son but, hors remise, hors tir cadré IMMINENT — `shotCross` à < 0,9 s : le réflexe
de `keeperDecide` garde le tir), le gardien cherche le premier point où le vol REDESCEND entre `bas` 1,6 et
`haut` 2,3 m dans SA zone (à ≤ `zone` 8 m de sa ligne — la surface de but et deux pas ; |z| ≤ goalHalf +
`large` 3) qu'il atteint avant le ballon (`reaction` 0,2 s + la course : l'accélération du pas mesurée
`accel` 2,6 m/s² depuis l'arrêt puis la pointe `vitesse` 5,5, moins la `detente` 1 m, avec `marge` 0,1 s) et
sur lequel aucun attaquant n'arrive avant lui (`duel` 7 m/s : le ciel disputé se joue à la tête, tete.js). Il y
COURT (job keeper, la cible AU point ; `p._sortieAerienne` fait de la course une course CHAUDE pour la loi
d'économie de movement.js — le point de chute est loin du ballon encore haut, elle le mettait au trot) et se
nomme une fois par vol (événement `sortie-aerienne { h, dans, d }`). Quand le ballon arrive dans le temps de
contact du clip (0,5 s) et que le point est à portée de détente, il ARME `plongeonPrise` — le saut à deux mains
généré A6 (`payload.aerienne`, windup `sortie:true`), et le contact du plongeon (`onDive`, chaque image de la
détente) résout la prise avec la portée du saut en plus (`saut` 0,5 m : 1,9 → 2,4 m ; il ATTEND le ballon dans
les gants tant qu'il descend au-dessus des mains — sans ça la première image à portée claquait) ; le missile ou
le ballon hors des gants se claque (le poing d'aujourd'hui : l'impulsion, pas encore un clip). Sous 1,9 m le
point se prend debout — mais un vol qui redescend si bas dans la zone finit au but : c'est un tir, le réflexe.

Contrat (verify-sortie-aerienne, 7 clauses — le monde vidé, le gardien à 1 m de sa ligne, un lob raide depuis
l'aile recalé de la traînée pour retomber à 2,5 m de la ligne) : la sortie se décide à l'image du départ (point
à 2,23 m, dans 1,97 s, à 2,76 m ; la cible EST le point) ; le windup plongeonPrise part 0,53 s avant le ballon
et la prise aérienne suit 0,52 s après, le ballon aux gants ; le gardien décalé de 9 m sur sa ligne ne sort pas
(2,5 s de course pour 1,97 s de vol) ; un attaquant posé au point de chute : aucune sortie, la tête, puis le
plongeon-prise du réflexe sur la tête cadrée ; la retombée à 9 m : aucune sortie ; `sortieAerienne:null` : le
gardien tient sa bissectrice et le lob retombe sans lui ; sabotage `saut:0` : il sort, saute, et claque au lieu
de prendre. En match (12 × 300 s) : 1 sortie décidée, 1 saut, 1 prise aérienne (2 c. 1) — la loi existe, le jeu
la sollicite peu : sur 6 matchs, 35 vols hauts redescendent entre 1,6 et 2,3 m devant un but, 23 à plus de
16,5 m de la ligne, 4 à moins de 8 m dont 2 prenables (le gardien à temps, personne dessus). Les centres de ce
moteur sont tendus ; la sortie attend des centres lobés. Clé `null` : hier au bit (empreinte jumelle).

## Le poing (C3 — `motion-keeper` sortiePoing, `sortie-aerienne.js` poing, `match-sim` onDive ; Animations_A_Faire § 3)

La sortie aérienne (B10) prenait à deux mains ou claquait ; elle ne SORTAIT pas dans la foule. Ici :

- **Le geste généré** `sortiePoing` (motion-keeper, `jump` + `punch` : 1,32 s, contact 0,62, saut 0,5 m, un genou (gauche) levé à
  72° dans la détente — la jambe de protection —, les deux bras montés serrés à 186° d'élévation dès l'impulsion (les poings
  à 13 cm l'un de l'autre au contact, 29 cm au-dessus de la tête), le COUP : les bras basculent de 50° à −20° d'avant sur
  0,16 s autour du contact (les poings traversent le ballon de 36 cm vers l'avant), les coudes tenus à 30°, la retombée sur
  les appuis, les bras qui redescendent lentement (178° en 0,3 s faisaient 14 rad/s au bras : mesuré, refusé par checkClip).
  Contrat (`checkKeeperGen`, K.punch) : poings serrés ≤ 34 cm, le coup à travers ≥ 8 cm, le genou ≥ +25 cm, plus les règles du
  saut (bassin ≥ +45 cm, la retombée sur les appuis, la fin debout sur place) ; verify-motion (toutes les espèces × 40
  graines) le tient.
- **La décision** (`sortie-aerienne.js`) : le premier attaquant au point se calcule à chaque point du vol (`duel` 7 m/s) ;
  s'il y sera avant le ballon ET avant le gardien, le balayage s'arrête là (au-delà, le vol prédit est une fiction : le
  rebond après la tête ne se réclame pas — mesuré : le gardien réclamait le rebond derrière la tête de l'attaquant) ; une
  sortie DÉCIDÉE tient (on ne lâche que si l'attaquant est nettement premier, −0,3 s — l'hésitation image par image laissait
  le gardien à mi-chemin) ; et si l'attaquant arrive AVEC le ballon (à moins de `poing` 0,4 s après lui), l'acte armé est
  `sortiePoing` (payload.poing) au lieu de plongeonPrise.
- **Le contact** (`onDive`) : sous `payload.poing` la prise est refusée, le ballon est DÉGAGÉ du poing (l'impulsion : 0,7 × la
  vitesse renversée + `poingV` 12 m/s vers le terrain, + 4,5 m/s de haut, 3 m/s de côté) — événement `arrêt` mode 'poing',
  mains 2 — et le gardien retombe sur ses appuis (down 0,5 comme la prise).
- **La scène** (Rondo.js `_applyDiveWarp`) : sous payload.poing, les DEUX poings vont sous le ballon (`_armsToBall` ±7 cm, −12 cm) avec
  l'enveloppe du gant d'hier (mesuré en page : poing droit à 17 cm du centre du ballon à l'image de l'arrêt ; avant : 0,5 m).

Contrat (verify-sortie-aerienne, clause c bis) : un attaquant lancé à 6 m/s depuis 10 m du point (il y arrive après le
gardien, avec le ballon) — la sortie se décide, l'acte est sortiePoing, 'arrêt' poing à deux mains, le ballon repart vers le
terrain à 8,9 m/s (v·x) et en l'air, jamais tenu ; l'attaquant posé AU point : aucune sortie (la tête) ; sans attaquant : la
prise à deux mains d'hier (clause a). Clé `sortieAerienne` null : hier au bit (le poing vit sous elle).

## Dettes nommées

- Corner encore rare (0 sur les graines de banc — la clause demande ≥ 2 ESPÈCES de remise) ;
  drapeaux de corner et cônes d'entraînement encore aux coins (cosmétique).
- Pas de hors-jeu (loi du format 5+1) ; il viendra avec le 11c11 et `FULL`.
- ~~Le gardien ne sort jamais (depthMax 2,6) : pas de libéro, pas de un-contre-un sorti.~~ — le libéro (cfg.libero), le
  un-contre-un (keeperDecide 'sortie', lot 104) et la sortie aérienne (B10) sont venus depuis.
- ~~La sortie aérienne n'a pas de POING~~ — livré au C3 (`sortiePoing`) ; le saut manqué retombe encore par `onDiveEnd` comme
  un plongeon, et le poing n'a pas de `prisePlanante` (la prise à deux mains sur un pied) : le clip de prise reste plongeonPrise.
- Remise de touche au pied sans cérémonie (placement + rayon + ayant droit seulement).
- Pas encore de mi-temps/fixtures (game-state) ni de formations nommées (le 11c11 les exigera).
