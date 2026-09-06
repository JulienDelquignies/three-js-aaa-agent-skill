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

## Le contrat (verify-foulee.mjs — 45 clauses)

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

## Les dettes nommées

- **La jambe courte de shanon** (0,76 m pour une hanche à 0,875) contre la foulée de Dorn (1,5 m à
  1,4 m/s) : atteindre le point de pose force un affaissement de 7 cm en marche, 10-12 cm en course
  (genou ≥ 16-20° à mi-appui — un coureur légèrement « assis »). Une cadence à l'échelle de la jambe
  (×(0,86/L)^½) ou un pas plus court le résoudrait ; à trancher avec `verify-gait`.
- **La course arrière ne se déclenche presque jamais** : la sim demande aux défenseurs de regarder
  où ils courent (yawWant ≈ vitesse ; 150 s de jeu sans un seul (vF < −1,8)). Le régime existe et
  est sous contrat ; il attend une consigne de face « jockey » côté moteur (A10/A11).
- **Le virage et le freinage** ne sont que l'inclinaison (lean) : pas de pas croisé, pas d'appui
  long de freinage.
- **L'idle** est toujours celui du Soldier (A8) ; la transition idle → foulée est un fondu de 0,35 m/s.
- **Le verrou de pieds** re-capture parfois une image pendant le pelage (cheville à 0,15 m, sous
  sa bande de 5 cm au-dessus d'un plancher calibré sur le clip de course) — un tressaillement de
  5 cm, à régler dans `foot-lock.js` (plancher calibré sur la foulée générée, bande plus étroite).
- **Le port des bras** en course est bas et fermé (coude 85°, balancier 36°) ; les sheets
  montrent un bras qui pourrait monter (mains à hauteur de poitrine) — un réglage de `GAIT_REGIMES`.
