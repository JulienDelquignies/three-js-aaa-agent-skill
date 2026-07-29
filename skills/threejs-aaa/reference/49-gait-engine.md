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
