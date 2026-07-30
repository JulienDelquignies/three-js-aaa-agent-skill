# 49 — L'horloge de foulée et le corps accordé (`engine/gait.js`)

> « Les mouvements sont tous horribles. Cherchez comment réaliser la locomotion et les actions de
> football réalistes, à tout niveau du corps, que tout soit accordé — en lien avec le ballon et le jeu. »

Cinq recherches parallèles (locomotion, contact-ballon, corps entier, sans-mocap, three.js), une
synthèse d'architecture, trois réfuteurs. Les réfuteurs ont fait leur travail : **ils sont allés relire
les papiers cités et ont corrigé les chiffres** — les valeurs de Dorn 2012 et Pontzer 2009 citées de
mémoire par la recherche étaient fausses (mauvaise table, mauvaise condition expérimentale).

## La cause n°1, mesurée : chaque clip avait sa propre horloge

`anim-state-machine._apply` donnait à chaque ancre du blend `timeScale = v/strideᵢ` : à 3,7 m/s la
marche tournait à 2,467 cycles/s et la course à 1,423. **Dérive 1,044 cycle/s** — le déphasage faisait
un tour complet en 0,96 s et traversait l'opposition stricte des pieds dix fois en dix secondes. Un
mélange 50/50 moyenne les deux poses : un pied planté moyenné avec un pied en vol donne une jambe qui
flotte, et **aucun foot-lock ne rattrape une pose physiquement impossible**.

La règle de l'industrie (sync groups d'Unreal) tient en une phrase : **la phase appartient à l'état de
locomotion, jamais aux clips.** Un seul φ ∈ [0,1) avance à la cadence f(v) ; chaque clip porteur de
foulée est esclave (`action.time = (φ+offset)·durée`, `timeScale = 0`). L'idle n'a pas de foulée et
garde sa propre horloge — un idle asservi à φ se FIGE à l'arrêt (attrapé par les réfuteurs avant
d'être écrit ; c'est un sabotage du harnais).

Et φ = 0 est défini : **le contact du pied gauche**. Chaque clip pose ce contact où son auteur l'a mis,
donc l'offset de chaque ancre est **mesuré sur le rig au chargement** (minimum de hauteur du pied
gauche, `phaseOffset`). Deux horloges synchronisées ne servent à rien si l'une lit « gauche » où
l'autre lit « droite ».

## La cadence n'est plus devinée

`stride: 2.6` était une constante inventée : les jambes tournaient 12 à 28 % trop lentement. La loi
vient de Dorn, Schache & Pandy 2012 (J Exp Biol 215:1944, **table 2 relue dans le papier**) :

| v (m/s) | f (Hz, cycle complet) | foulée (m) | f·S |
|---|---|---|---|
| 3,5 | 1,88 | 1,86 | 3,50 |
| 5,2 | 2,21 | 2,35 | 5,19 |
| 7,0 | 2,63 | 2,67 | 7,02 |

La vitesse qui alimente cette loi est la **vitesse vraie** : le delta de position du modèle entre deux
frames, lu en début d'update. Dans le rondo, la simulation écrase la position APRÈS `ctrl.update` —
`this.dist` n'accumulait donc pas le mouvement réellement affiché, et la cadence suivait une fiction
(trouvé par un réfuteur, pas par moi).

## Le corps accordé : ce que les nombres disaient

Mesures sur les 20 moves d'animkit : **9 os sur 22 jamais animés** (Spine2, Neck, clavicules, mains,
orteils), bassin keyé dans 3 moves et à 0° sur toutes les frappes, bras à 36°, tronc à 10°. Le
personnage n'avait littéralement ni cou, ni thorax, ni bassin.

`gaitLayer(φ, v)` — fonction pure, nulle à l'arrêt — dérive de la phase : lacet du bassin, contre-
rotation de la ceinture scapulaire répartie Spine 20 / Spine1 35 / Spine2 45, **déphasage
bassin/épaules ψ(v) = 149,2° (marche, 1,5 m/s) → 93,9° (course, 3,0 m/s)** — Pontzer et al. 2009,
*condition contrôle* (la recherche citait 157,6°/74,1°, qui sont la condition « poids sanglés aux
coudes », une perturbation expérimentale) —, bras en antiphase avec leur jambe, coudes qui se fléchissent
avec la vitesse, **tête stabilisée à ≤ 6°** (le regard est stable, pas le cou), et deux rebonds de
bassin par cycle. Application additive après le mixer : les clips de locomotion réécrivent chaque os à
chaque frame, donc rien ne s'accumule — l'idempotence est structurelle.

Au passage, la veille : `BASE_POSE` n'était pas symétrique (les deux bras à `[0,0,60]`) — mains à
z = +0,41/−0,47, 9,3 cm d'écart de hauteur, bras figés en torsion permanente. Et `mirrorMove` était
**exact** (la conjugaison quaternion, dérivée du rig : `A = PL⁻¹·M·PR ≈ M` sur les sept paires d'os) ;
la « correction » proposée se trompait de 1,37. Les deux sont des clauses de verify-animkit désormais.

## Résultats négatifs, écrits pour ne pas y revenir

- **Le motion matching, sous toutes ses formes.** C'est un algorithme de *sélection*, pas de synthèse :
  sans base (Epic : 500–900 clips mocap ; EA : 180 matchs capturés pour EA FC), il dégénère en machine
  à états en plus cher. Hors d'atteinte à coût zéro, définitivement.
- **La génération par modèle (text-to-motion)** n'est pas au niveau d'un contact pied-ballon précis.
- **Nuance utile trouvée par un réfuteur : 100STYLE est CC-BY 4.0** et contient marche/course arrière
  et pas chassés — une vraie course arrière est donc *possible* un jour via retarget BVH. Noté, non fait.

## Ce qui reste dans l'architecture (ordre validé par les réfuteurs)

`approach.js` (le solveur de foulée avec parité : arriver sur le BON pied au bon endroit — LA technique
FIFA), `warp.js`/`gesture-warp.js` (motion warping vers le point de contact pendant l'anticipation de
gesture.js), `pose-warp.js` (stride/orientation warping : un clip avant → toutes les directions),
`foot-plant.js` (alpha lissé), `inertialize.js` (transitions ressort, demi-vie 0,05–0,25 s — attention :
avec le ressort critique de Holden, x(h)/x(0) = 0,597, PAS 0,5 ; la clause naïve était fausse),
`lean.js` (banking par accélération). Chacun avec contrat + sabotages, dans cet ordre.

---

# Deuxième passe : les gestes réécrits contre la biomécanique publiée

Les 20 moves passaient le contrat anatomique — et restaient faux. Trois mesures le disaient :

- **9 os sur 22 n'étaient animés dans AUCUN geste** (Spine2, Neck, clavicules, mains, orteils) ; le
  bassin était à 0° sur toutes les frappes ; 6,7 os animés par geste sur 65 disponibles.
- **La séquence proximo-distale de `frappe` était nulle** : cuisse et tibia atteignaient leur extrême
  sur la même clé, là où la biomécanique exige cuisse PUIS tibia PUIS pied (Kellis & Katis) — le pic
  du tibia tombe AU contact.
- **Le contrat lui-même interdisait une frappe réaliste** : plafond uniforme de 14 rad/s (802°/s),
  contre 19,8–28 rad/s (1134–1604°/s) mesurés au genou chez l'élite (Petrolo et al., revue
  systématique). Nos frappes plafonnaient à 7,5 rad/s : 3,5 à 5 fois trop lent, une part directe du
  rendu « mou ». Le plafond est désormais PAR CHAÎNE : jambes 30 rad/s, tout le reste 14 — un bras à
  20 rad/s reste un bug.

Chaque frappe porte maintenant : le bassin qui tourne tôt puis **se fige** (≤ 2° entre l'appui et le
contact — c'est ce que fait l'élite), le buste en arrière de 13–17° à l'armé puis en rotation ~22°
vers le côté non frappeur, la **tête sur le ballon** jusqu'au contact (quiet eye : la fixation finale
dépasse 1 s chez ceux qui marquent) puis vers la cible, le **bras opposé** en équilibre, la **jambe
d'appui** plantée genou fléchi ~26° qui s'étend au contact, et le genou frappeur à ~15 rad/s en phase
d'accélération.

`checkStrike` rend un geste plat impossible à livrer, en trois régimes — frappe armée (proximo-distale
exigée), pivot, pichenette (extérieur/déviation : la jambe reste sous le corps PAR mécanique, le seuil
suit le geste). La **talonnade est l'exception littérale** : bassin carré, tête HAUTE — la tromperie
est le geste — et elle a ses propres clauses. Sabotages : l'ancienne `frappe` plate (condamnée sur
5 clauses), et le **piège du bras homolatéral** trouvé par un réfuteur — tous les moves étant pied
droit, une clause qui mesurerait le bras droit validerait un bras d'équilibre mort ; celle-ci mesure
le gauche, et le piège est soudé dans le harnais.

Piège de format rencontré : un os absent d'une clé retombe sur la POSE DE BASE, pas sur
l'interpolation — le bras droit a fait 12° → −60° → −18° en 0,1 s (19 rad/s) au premier essai, attrapé
par le contrat. Chaque os animé est donc keyé à chaque clé.

---

# Troisième passe : la leçon de la silhouette (l'utilisateur a vu ce que le contrat ne voyait pas)

La capture montrait un bras tendu à la VERTICALE au-dessus de la tête pour une passe de huit mètres —
et tous les contrats étaient verts. `checkStrike` mesurait des DEGRÉS par os (« le bras opposé a une
excursion ≥ 25° ») : une clause-ombre, exactement celle que le réfuteur « contrat » avait dit de
chercher. Elle vérifiait que le bras BOUGE, jamais OÙ IL FINIT. Un moulin à vent la passait.

Trois causes empilées, toutes mesurées après coup :

1. **Les axes étaient authorés à l'aveugle.** Sur ce rig, balayer chaque axe en FK donne : épaule
   y = ±0,2 m sur la main (le grand leveur), épaule x = ±0,1, et surtout **le coude en −x MONTE la
   main de 0,15 m** — je croyais plier le coude, je levais la main — pendant que **la flexion
   visuelle du coude est z** (la base tient d'ailleurs le coude à z = 12). Mes « coudes pliés » en +x
   étaient des torsions : bras tendu à l'écran, main basse en chiffre. Un auteur de poses doit balayer
   les axes du rig AVANT d'écrire des angles.
2. **La clause mesurait l'ombre.** La bonne clause fait la FK du vrai squelette (GLB parsé brut, sans
   three) et borne le RÉSULTAT MONDE : aucune main au-dessus du cou sur un geste de football. Posée,
   elle a immédiatement attrapé DEUX gestes de plus que personne n'avait regardés (`amortiCuisse`
   +14 cm, `tacleDebout` +7 cm). Son sabotage est la version livrée la veille (+22 cm).
3. **Trois sources de bras s'empilaient** : les bras du clip de course + le delta additif du geste +
   le balancer de `gaitLayer`. Pendant un geste, le haut du corps appartient AU GESTE : la scène lève
   `gestureHold` et la couche de course rend bras, cou et tête (elle garde jambes et bassin — la
   course continue).

La règle générale, ajoutée à la discipline du dépôt : **une clause d'animation qui ne regarde pas le
résultat monde composé mesure une ombre.** Les degrés par os sont un moyen ; la silhouette est le fait.

---

# Quatrième passe : le régime de composition on-ball

« On-ball, aucun membre n'est cohérent » — exact, et la cause n'était plus les poses (validées en FK)
mais le RÉGIME DE COMPOSITION à l'exécution. Trois régimes essayés, chacun vu à l'écran :

1. **Delta additif sur les jambes de course** (l'existant) : jambe de marche + delta de frappe = un
   membre qui n'est ni l'un ni l'autre. C'est la chimère signalée.
2. **Clip absolu plein-corps, locomotion à zéro** : personnage plié en deux au-dessus du sol. Les
   quaternions absolus d'animkit supposent un rig au repos en T-pose ; un rig piloté par des clips
   RETARGETÉS a d'autres rotations de repos. La règle écrite dans animkit-builder — « un clip additif
   ne se transporte pas de bind en bind » — vaut dans les deux sens : un clip absolu non plus.
3. **Delta additif sur l'IDLE FORCÉ** (retenu) : pendant le geste, la vitesse d'animation est lissée
   vers 0 (~80 ms) — le blend traverse walk sans échelon et se pose sur l'ancre idle, un clip
   retargeté donc juste pour ce rig, quasi immobile. La somme idle + delta EST la pose authorée,
   transportée par delta. Et des jambes plantées sont la vérité biomécanique d'une frappe — le
   frappeur plante son appui, il ne court pas pendant son geste.

Le foot-lock est coupé pendant le geste (l'IK n'a pas à disputer des jambes authorées), et la couche
de foulée rend déjà le haut du corps (`gestureHold`). `toClip({ cover: true })` reste disponible et
documenté pour les rigs NATIVEMENT à la convention animkit — il est faux sur un rig retargeté.


## Post-scriptum mesuré : le régime « idle forcé » était un patin à glace

L'audit membre par membre (l'instrument est désormais officiel : `scripts/audit-membres.mjs`) a
mesuré ce que le régime « geste additif sur idle forcé » faisait au monde composé : le glissement
d'approche translate le corps jusqu'à 5,2 m/s pendant l'armé, et sur des jambes d'idle c'est une
GLISSADE — pied d'appui « au sol » en translation 100 % des images de l'armé, pics à 7,5 m/s. Le
régime final a trois pièces, chacune une loi :

1. **La vitesse d'animation suit le corps RÉEL** (`vTarget = min(groundSpeed, vGait)` pendant un
   geste — jamais un zéro forcé) : les pas portent l'approche, et quand le glissement s'assied
   (ease-out → 0) les jambes s'arrêtent d'elles-mêmes. Le plant émerge de la mesure.
2. **Le geste est SCINDÉ en deux étages** (`toClip { only }`) : haut du corps (épaules → mains,
   colonne, tête) à poids plein dès l'engagement — les bras s'arment pendant les pas — et JAMBES
   fondues par `max(arrivée, approche du contact)` : `1 − v/2,5` d'un côté, `(t/antic)^1,5` de
   l'autre, parce que le dernier pas EST le plant (sans le second terme, l'ease-out gardait la
   vitesse au-dessus du seuil presque tout l'armé des gestes courts et l'appui restait à 0,4-0,7 m
   de sa stance au contact).
3. **Le glissement ne couvre que les derniers décimètres** (hardMax 0,6 — mesuré : 0,9 permettait
   un sprint sous l'armé, 0,5 faisait ramper l'engagement derrière l'amorti d'arrivée, +0,17 de
   taux de perte) — et la marche pilotée TRAVERSE le point de plant (cible décalée de 0,35 m) pour
   que l'amorti générique ne morde pas avant l'arrivée.

Résultat (audit-membres, 13 clauses) : GLISSADE 0 fenêtre sur tous les épisodes, modèle sur la sim
(≤ 0,08 m), appui posé au contact (0,09-0,11 m), genou frappeur 69-75° d'amplitude. Les chiffres
restants sont imprimés en INFO par l'instrument et appartiennent aux CLIPS (chantier « re-calage du
swing ») : vitesse du pied au contact 1-1,8 m/s (réel : 15-25), mains du `passe` composé au-dessus
du cou 41 % (le contrat silhouette juge le clip seul — composé sur l'idle, il ment : une ombre de
plus au tableau de la loi 8), appui de l'exterieur à 0,71 m de sa stance.
