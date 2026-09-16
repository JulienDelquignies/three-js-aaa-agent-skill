# 52 — La foulée générée (motion-gait, lot A7)

La locomotion est 97 % du temps d'écran d'un match 11c11 (mesuré : la couche de geste possède 3,2 %
des images des joueurs de champ). Jusqu'au lot A7 cette locomotion était **trois clips du donneur
Soldier** (idle, walk, run) cadencés par `gait.js` : pas de sprint (un trot accéléré, buste droit),
pas de course arrière (un défenseur sur trois court dos au ballon), pas de pas chassés (le gardien
glisse de côté sur un cycle de marche de face, 43 % de son temps), pas de virage ni de freinage.

`engine/motion-gait.js` remplace ces clips par une **foulée calculée**, avec la méthode des gestes
(reference/51) : des chemins de pied et des courbes articulaires anatomiques en repère personnage,
résolus par l'IK de jambe sur la hanche de l'instant, posés ABSOLUS par os (`rest ⊗ q_spec`) par
le contrôleur après le mixer — l'écrivain de la couche de geste. La différence avec un geste : la
foulée est une **fonction pure de (φ, v→)** — la phase de l'horloge unique et la vitesse en repère
corps (avant, droite) — sans clé ni durée. N'importe quelle vitesse, n'importe quelle direction,
sans blend tree.

## Le cycle d'un pied

`u ∈ [0,1)`, `u = 0` au contact ; φ = 0 est le contact GAUCHE (convention `gait.js`), le pied droit
vit à φ + ½. Trois temps :

| temps | ce qui se passe | loi |
|---|---|---|
| **appui fixe** `[0, s·(1−peel))` | la cheville est immobile au monde : elle recule sous le bassin exactement à −v→ | `pos = c0 − D·u/s`, `D = v→·s·T` |
| **pelage** `[s·(1−peel), s)` | le talon décolle, la cheville monte en pivotant sur l'orteil (`Lpied·sin(pointe)`) et avance de `roll` — le déroulé talon-pointe (0,2 m par appui en marche) | orteils en extension `toeUp` |
| **vol** `[s, 1)` | de c1 (décollage) à c0 (prochaine pose) : transfert horizontal retardé (`w^swingK`, le talon monte d'abord), cloche de hauteur `swingH` au pic `swingPeak` | `bump(w, 0, swingPeak, 1)` |

Le point de pose est `c0 = c + D·(0,5 − bias)`, le décollage `c1 = c − D·(0,5 + bias) + roll` :
le pied se pose plus près du bassin qu'il ne le quitte (Winter : +0,3 m devant, −0,4 m derrière).
Le bassin s'affaisse de ce qu'il faut pour que la jambe ATTEIGNE les deux extrêmes (portée 0,99 ·
(cuisse + tibia), calculée sur les deux pieds, marge 5 mm) — l'affaissement se calcule, il ne se
devine pas : une portée saturée est le patin silencieux des jambes IK.

Par-dessus : le rebond du bassin (2 par cycle — haut à mi-appui en marche, bas à mi-appui en course),
son roulis vers le pied d'appui, son lacet (hanche gauche devant au contact gauche), son tangage ;
le tronc qui penche avec l'allure et contre-tourne les épaules avec le déphasage de Pontzer (149°
marche → 94° course), la tête stabilisée (≤ 6°) ; les bras opposés à leur jambe (gauche derrière au
contact gauche), coude qui se ferme en avant.

## Les régimes

Un jeu de paramètres nommés par allure (`GAIT_REGIMES`), interpolé par la vitesse en avant
(marche 1,4 → trot 2,8 → course 5,5 → sprint 8,5 m/s — la transition marche-course est celle où
l'appui passe de 62 à 44 % : le double appui devient vol), puis fondu par la DIRECTION avec les
régimes arrière (appui sur l'avant-pied, genou devant, buste droit, bras courts) et latéral (pas
chassés : larges, bas, tronc penché, bras ouverts).

| régime | appui | cycle | bassin | tronc | genou max | source |
|---|---|---|---|---|---|---|
| marche 1,4 | 62 % | 1,08 s | −7 cm | 1° | 75° | Winter 2009 |
| trot 2,8 | 44 % | 0,64 s | −10 cm | 5° | 107° | Novacheck 1998 |
| course 4,5 | 39 % | 0,48 s | −11 cm | 7° | 117° | Novacheck 1998 |
| sprint 8 | 29 % | 0,35 s | −11 cm | 11° | 132° | Mann & Hagy 1980 |
| arrière 2,5 | 40 % | 0,54 s | −6 cm | −2° | 93° | Flynn 1994 |
| chassés 2 | 50 % | 0,44 s | −13 cm | 11° | 92° | la pratique |

**La cadence suit la direction** (`gaitCadenceFactor`) : la loi de Dorn est celle de la course avant
(1,5 m de foulée à 1,4 m/s) ; à reculons on trottine plus court (×1,3), en pas chassés on double
presque (×1,9) — sans quoi un chassé à 2 m/s demanderait des pieds à 1,8 m l'un de l'autre. Le
contrôleur avance l'horloge avec le même facteur : une phase, une durée, le chemin de pied et
l'horloge sont UN. En pas chassés la demi-largeur suit la vitesse latérale pour que les pieds ne se
croisent JAMAIS (le pied qui se pose au plus à droite contre celui qui décolle au plus à gauche).

## La signature d'un joueur

`gaitStyleFromSeed(graine)` (même patron que le style de frappe) : port du coude ±12°, amplitude
du balancier ×0,85-1,15 (la persona ajoute son `armSwingF`), écartement des bras, inclinaison du
tronc ×0,75-1,25, hauteur du vol ×0,85-1,15, ouverture des pieds 3-14°, largeur de pas, rebond,
lacet/roulis du bassin, point de pose, pointe au pelage, affaissement. Reconnaissable, pas
caricatural : 40 graines × 6 régimes sont sous contrat.

## Le contrat (verify-foulee.mjs — 81 clauses)

- 13 régimes (marche lente → sprint, arrière, chassés, diagonales) sous `checkGaitGen` : pied
  d'appui immobile au monde (≤ 0,06 m/s), pied d'appui au sol (point le plus bas ≤ 1,2 cm), vol qui
  dégage (orteil ≥ 4 cm à mi-vol en course, 1,2 cm en marche) sans traverser (≥ −1,5 cm), genou ≤
  140° et qui plie DEVANT, hanche dans [−30, 80]°, jamais hors de portée, symétrie gauche/droite
  ≤ 2 cm, pas = v·T/2 (±5 %), bras opposés à leur jambe, tronc qui penche en course (jamais > 30°),
  chassés sans croisement (genoux fléchis, bassin bas), course arrière posée derrière et levée devant.
- 40 signatures × 6 régimes sous contrat, et distinctes (coude sur 21°, pieds sur 8°).
- pure ; le cycle se ferme (0,00°) ; les cycles passent `checkClip` (membres ≤ 30 rad/s).
- les lois entre régimes : l'appui raccourcit (62 → 44 → 36 → 27 %), le talon monte (14 → 29 →
  44 cm), le tronc penche (1 → 7 → 11°), le balancier grandit, le coude se ferme (24 → 81°).
- la bande du verrou de pieds (cheville ≤ 5 cm sur l'appui fixe : 2,9 cm au pire).
- cadence ×1 / ×1,3 / ×1,9, continue en direction ; à 0,1 m/s la pose est debout (pied à 5 cm).
- huit sabotages nommés, chacun attrapé par sa clause : appui qui glisse (`slip`), vol qui rase
  (`swingH 0`), genou à l'envers (`pole` arrière), bras en phase (`armPhase π`), chassés qui croisent
  (`hw 0,04`), tronc raide (`lean 0, pTilt 0`), course arrière qui lève derrière, pas trop long.

## L'intégration

- `CharacterController({ locomotion: 'generee', gaitStyle: graine })` : le profil du rig et le rest
  sont pris sur le clone AU BIND (jamais animé à la construction — le repère exact du banc), le
  repère personnage est celui du modèle (parent des hanches relatif au modèle × échelle squad +
  persona). La pose est écrite après le mixer, `os = slerp(mixer, rest ⊗ q_spec, w)` avec w qui
  monte de 0,25 à 0,6 m/s (en dessous : l'idle du mixer) ; pendant un geste le haut du corps
  appartient au geste ; le bassin rebondit en mètres personnage sur l'axe haut du parent.
  L'inclinaison dans l'accélération et la signature de silhouette (persona) restent additives.
- `ctrl.locomotion = 'clips'` rend les trois clips du donneur — commutable à chaud (l'avant/après
  au même instant : `sc.update(0)`), et `?foulee=clips` sur match11.html.
- `contact-sheet.mjs --gait <vF> [--lat <vR>] [--seed N] [--variant before|after|both]` : huit phases
  d'un cycle, avant (clips) / après (générée), posées par le contrôleur — l'écrivain du jeu.

## Mesuré en jeu (match11, graine 7, LOD d'animation coupé)

- Trace d'un coureur à 4,53 m/s : la cheville gauche reste EXACTEMENT au même point monde pendant
  les 8 images de l'appui fixe (0,13 s) pendant que le corps avance de 7,5 cm par image ; pelage
  (+6 cm, déroulé 5 cm), vol à +26 cm, pose sans à-coup — le verrou de pieds capture au premier
  point immobile.
- Vitesse monde du pied pendant l'appui fixe du générateur (4 083 échantillons, tous joueurs de
  champ > 1 m/s) : médiane 0,13 m/s, p90 0,99 m/s — la queue est le virage (le corps pivote autour
  de son origine) et le fondu du verrou.
- Pied « bas » (≤ 3 cm du plancher) : immobile (< 0,1 m/s) 23-29 % des images contre 10-12 % avec
  les clips ; en patin (> 0,5 m/s) 46-51 % contre 54-63 % — le reste est la pose (le pied arrive
  bas et vite, comme un vrai) et le déroulé talon-pointe.

## Le virage, le frein et la cadence à l'échelle de la jambe (A7 bis)

- **La cadence à l'échelle de la jambe** — `gaitLegK(P) = 0,90 m / (cuisse + tibia)`, borné [0,85 ; 1,35] :
  la loi de Dorn est celle d'une jambe de 0,90 m ; une jambe plus courte fait des foulées plus courtes
  à la même vitesse (S ∝ L), donc une cadence plus haute. shanon (0,76 m) courait avec les foulées d'un
  grand : ×1,18, le cycle à 4,5 m/s passe de 0,482 à 0,407 s et l'affaissement du bassin de −10,7 à
  −8,4 cm (3 m/s : −9,7 → −7,8). `gaitLegFactor(legK, v)` fond le facteur à ×1 entre 4,5 et 5,5 m/s :
  au sprint la loi touche déjà le plafond des articulations de `checkClip` (genou 30 rad/s, bras
  14 rad/s entre deux clés à 60 Hz — le genou presque tendu à la pose est le plus sensible : 36 rad/s
  au premier centième d'appui à 5,5 m/s), une cadence plus haute encore les téléporterait. Le
  contrôleur avance son horloge du même facteur (une phase, une durée) ; `gaitCycleSpec` et la
  planche-contact lisent la durée dans la pose (`meta.T`). `legK: 1` = la cadence d'hier.
- **Le frein** (`opts.brake` 0..1) : le tronc se RETIENT en arrière (−3,7° contre +7,3 en course), le
  pied de frein se pose plus loin devant le bassin (bias −0,16), la base s'élargit (20 contre 12 cm),
  talon d'abord (+10° de tangage), les pas raccourcissent (cycle × 0,75 — `gaitBrakeCadence`,
  l'horloge suit), le vol rase (× 0,8), les bras viennent devant et s'ouvrent. L'appui de frein se
  raccourcit au sprint ((6/v)²) et en plein virage (la jambe sature sinon).
- **Le virage** (`opts.turn`, accélération latérale en m/s², + = vers la droite du corps, borné ±9) :
  le bassin et le tronc ROULENT dans le virage (atan(a/g) × 0,55 : 13° à 4,5 m/s², 17° à 6, 18° au
  plus), le bassin glisse vers l'intérieur (7 cm par g), le pied extérieur se pose plus large, la tête
  reste d'aplomb (contre-roulis 0,4 cou + 0,6 tête), la jambe intérieure passe plus ras. La hanche
  extérieure qui MONTE avec le roulis et le bassin glissé sont dans le calcul d'affaissement — sans
  cela la jambe extérieure saturait (« le pied d'appui flotte à 1,3 cm et glisse à 0,7 m/s ») ; sous
  frein ou virage, tout le cycle est échantillonné (la fin du vol du pied de frein saturait à 8 m/s),
  marge 1,2 cm. Le miroir gauche/droite du contrat est débrayé sous virage (asymétrique par
  construction), « ne penche pas en avant » sous frein.
- **Le contrôleur** (`_measureAccel`) mesure sur le déplacement réel du modèle, en repère corps
  (`WORLD.facingDir(yaw, fa)` — la convention de `_bodyVelocity`), lissé τ 0,15 s, et seulement
  quand le corps avance (> 1,5 m/s, plus vite devant que de côté) : `brake = −aF / 6 m/s²`,
  `turn = aR`. En match (graine 3, 40 s) : frein p90 0,25, p99 0,82 (décélération 4,9 m/s²) ;
  virage p50 0,55, p90 5,7 m/s² (les changements de cap de la sim sont francs).
- **Trouvé en passant** : `_applyLean` lisait le repère corps par (sin yaw, cos yaw) alors que le rig
  regarde selon son axe de face `fa` (π pour shanon) — 395 images sur 405 penchaient à l'envers
  (buste en arrière à l'accélération, roulis hors du virage). Même repère que `_bodyVelocity`
  désormais : 94 % d'accord avec l'accélération de la sim (le reste, le retard du lissage).
- Absents (`brake`, `turn` à 0 ou absents) : la foulée à la cadence de la jambe, au bit.

## Le cap lissé (B5 — `movement.js`, `cfg.viragesLisses`) et le corps planté immobile (B6 — `cfg.plantVitesse`)

Mesuré (sonde b5, 4 graines × 120 s, l'accélération latérale du corps sim |Δv⊥|/dt par métier) : le
corps pressait en BANG-BANG latéral — press/cover à la saturation en médiane (p50 5,9 m/s² = turnAccel
6), 7-8 inversions de signe par seconde ; la cible elle-même tremblait (press : 5,6°/image à p90, 4,2
inversions/s ; intercept 12/s). Depuis A7 bis le corps ROULE dans ces virages (13° à 4,5 m/s²) : le
bruit était devenu visible. `viragesLisses { taux 6, tau 0.15, des 2.0, frein 0.2 }` (`null` : les
cassures d'hier, empreinte jumelle) : le cap demandé (la direction de la vitesse voulue, après le
lissage des rôles calmes) passe par un filtre (tau) puis un slew borné par la vitesse (taux/v rad/s —
le corps ne demande jamais plus vite qu'il ne peut tourner), et le cap loin du voulu FREINE (× cos,
plancher frein : on ne fait pas le tour à pleine vitesse — sans le frein, le receveur en arc saturait
6 m/s² à p50). Sous des m/s (l'arrêt, le pivot) : libre. Après (la mesure finale, les clés B4-B6
allumées contre `viragesLisses:null`) : inversions/s press 7,1 → 3,9, cover 8,5 → 3,7, mark 4,4 → 2,0,
support 3,7 → 1,6, receive 6,0 → 3,0, carry 5,6 → 2,9, walk 0,9 → 0,1 ; latérale p50 cover 5,9 → 2,4,
receive 1,7 → 2,1, press 5,9 → 5,8 (le presseur reste au taquet en médiane : c'est sa nature, il ne
tremble plus) ; le corps suit sa cible avec un peu plus de retard (écart cap cible − corps p50 :
press 5,9 → 12,9°, receive 0,3 → 6,6°). Le flux (interceptions, pressing) se juge au banc complet,
avec ses épingles.

B6 § 6 — `plantVitesse` (`null` : hier) : sous un acte qui plante le corps (`winding` ou `ownsBody`,
hors course d'élan, tête armée et mains), `movePlayers` sautait l'intégration mais laissait `p.v` à
sa dernière valeur. Mesuré (6 graines × 300 s) : 81 % des images plantées à > 1 m/s — mais la part
du lion (3 900 sur 4 370) est l'ARMÉ DE PASSE, dont `p.v` n'est pas fossile : c'est le RAPPORT du
glissement réel sur l'ancre que `stepGestures` écrit chaque image (borné par `glideMax`, 4,7 m/s en
médiane, 7,5 max) — un corps qui bouge vraiment, et qui le dit. La vitesse fossile, c'est celle des
gestes qui n'ont pas d'ancre : feinte (96 images), tacle debout (85), semelle (64), râteau (45),
passement (40), crochet (27), double contact (22), roulette (13) — 470 images hors passe à > 1 m/s
sur 6 matchs. Ici `p.v = [0, 0]`, la poussée nulle, et la vitesse repart de zéro à l'accompagnement
(le modèle d'inertie, 9,5 m/s²) : après, 110 images hors passe, dont 39 de plongeon (6,5 m/s : la
glisse du gardien, écrite par le geste) et 36 de roulette (le tour du ballon, écrit par le geste) —
le fossile est parti (feinte 7, tacle debout 5, semelle 5, râteau 0, passement 1, crochet 2). Petit
lot, petit effet : l'armé de passe glisse, il ne se fige pas.

## Le pas croisé, le port des bras, le verrou calibré (A7 ter — Animations_A_Faire § 6, note 380)

- **Le pas croisé du virage serré** (`gaitPose`, `opts.turn`) : au-delà de 7 m/s² d'accélération latérale et de 3 m/s de course
  (kX : 0 → 1 de 7 à 9 m/s², fondu 3 → 4 m/s, atténué au sprint — ×0,4 à 9,5 m/s : la foulée longue sature la hanche), la jambe
  EXTÉRIEURE croise devant l'intérieure : son couloir passe la ligne médiane et se pose à `0,03·kX` m À L'INTÉRIEUR du couloir de
  l'intérieure (qui s'écarte de `0,05·kX` vers l'intérieur) ; le bassin TOURNE dans le virage (`pYawTurn` 6°·kX, la hanche extérieure
  devant) et le tronc CONTRE-TOURNE en entier (les épaules restent dans l'axe de la course — à 25 % de contre-tour, 6 signatures
  perdaient l'opposition bras-jambe au sprint freiné) ; le vol rase un peu plus (swingH ×(1 − 0,12·kX) : le genou reste sous 140°).
  Mesuré (6 m/s, 9 m/s²) : le pied gauche se pose 3,0 cm à l'intérieur du couloir du droit (en course droite 10,9 cm d'écart), le
  bassin tourné de +6,1° au contact gauche, les épaules à −0,4°, les genoux à 10,2 cm au plus près ; sous 7 m/s² et sous 3 m/s :
  aucun croisement (13,4 et 18,9 cm d'écart) ; les chassés ne croisent jamais. `contact-sheet.mjs --gait 6 --turn 9` le montre.
- **Le port des bras en course** (`GAIT_REGIMES.run` : coude 85 → 90°, armOff 8 → 10 ; le sprint garde 92/10) : la main avant
  monte à hauteur de poitrine (−2 cm du sternum à 4,5 m/s, hier −4 ; +2,6 au sprint), le coude fléchi 89-102° en course
  (hier 86-99), 96-114 au sprint. Le frein ferme le coude de +6° (hier +10) : avec le coude de course monté, la main avant repliée
  perdait l'opposition bras-jambe au sprint freiné (marges 2,2 → 1,8 cm sur 5 signatures ; 2,5-3,1 aujourd'hui).
- **Le verrou de pieds calibré sur la foulée générée** (`foot-lock.calibrate`, `character-controller._poseGait`) : le plancher de
  chaque pied est le minimum de sa cheville sur un cycle de course à 4,5 m/s POSÉ PAR LE GÉNÉRATEUR (pas le clip du donneur — les
  deux valent 0,116 m sur shanon) et la bande de contact descend de 5 à 2,5 cm : la foulée générée tient sa cheville à ≤ 1,2 cm du
  plancher sur l'appui plat et le pelage la monte de 6 cm — à 5 cm le verrou re-capturait la cheville en plein pelage. Mesuré en
  page (match11, LOD coupé, le même coureur à 3,8-4,4 m/s, 7 s par bande, le pic d'accélération de la cheville autour de la relâche) :
  bande 5 cm → pics p50 4,7 cm/image², p90 6,2, maxi 6,7, 1 recapture, 4 reculs ; bande 2,5 cm → p50 2,5, p90 4,0, maxi 4,2-5,5,
  0 recapture, 0-2 reculs. Les relâches qui restent sont l'étirement (le fondu part à 92 % de la portée) — la loi d'hier. Le mode
  `?foulee=clips` garde sa bande de 5 cm et son plancher de clip, au bit.

## Les dettes nommées

- **Deux signatures sur quarante** (graines 3 et 35) passent sous le plafond `checkClip` entre 4,75 et
  5,25 m/s avec la cadence de la jambe (elles y étaient déjà à 5,5 hier) — les specs de cycle
  exportées, pas la page, qui évalue `gaitPose` image par image. Le genou presque tendu à la pose
  (portée 0,99 R) est ce qui claque ; un peu plus de genou aux extrêmes le résoudrait, au prix d'un
  centimètre d'affaissement.
- **La course arrière ne se déclenche presque jamais** : la sim demande aux défenseurs de regarder
  où ils courent (yawWant ≈ vitesse ; 150 s de jeu sans un seul (vF < −1,8)). Le régime existe et
  est sous contrat ; il attend une consigne de face « jockey » côté moteur (A10/A11).
- ~~Le pas croisé du virage serré n'existe pas~~ — livré (A7 ter) ; reste : le pas croisé ne se voit en match que dans un virage à
  plus de 7 m/s² lancé à plus de 3 m/s (rare : le cap lissé de B5 borne le taux de virage).
- **L'idle** est toujours celui du Soldier (A8) ; la transition idle → foulée est un fondu de 0,35 m/s.
- ~~Le verrou de pieds re-capture parfois une image pendant le pelage~~ — calibré sur la foulée générée (A7 ter : bande
  2,5 cm, plancher du générateur) ; reste le pic de l'étirement (le fondu à 92 % de la portée pendant que le corps avance).
- **Le port des bras** en course est bas et fermé (coude 85°, balancier 36°) ; les sheets
  montrent un bras qui pourrait monter (mains à hauteur de poitrine) — un réglage de `GAIT_REGIMES`.
