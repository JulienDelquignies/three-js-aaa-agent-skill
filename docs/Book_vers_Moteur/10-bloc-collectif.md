# Bible 10 — Le bloc collectif hors ballon, contre le moteur

*Fiche du 9/09, moteur 8411879 (SCEAU 256). Mesures : 2 matchs de 90 min (graines 3, 7), 4-3-3 contre 4-3-3, tactique `equilibre`.*

## 1. Ce que le chapitre demande

- **Le bloc comme corps déformable**, pas comme formation à ressort : longueur bimodale (26-32 m en défense
  organisée, 38-46 en possession), aire ≈ 900 m², stretch 7-10 m hors possession ; `block.lineX` = le **2ᵉ** joueur le
  plus reculé ; l'échelle des hauteurs qui fait foi est celle du Brief (18-26 / 34-44 / 48-56 m).
- **L'interligne dérivé des attributs** (`interlineTarget` : 10 m joueur limité → 15 m joueur puissant, × 0,55 en bloc
  bas), le **point de rupture calculé** (`INTERLINE_WARN` 16 m, `INTERLINE_BREAK` 19 m : le presseur arrive après la
  médiane de la possession individuelle, Gamma(2,29 ; 1,09)), l'asymétrie DEF↔MID (5-8 bas, 10-15 médian) et
  MID↔ATT (distance d'enfermement).
- **Le coulissement longitudinal** à deux régimes (`k_x = 0` libre, `k_x = 1` accroché, `marge_profondeur` signée par
  `BallCoverState`) et l'asymétrie montée 4,0-5,5 m/s / recul 3,5-4,4.
- **Le coulissement latéral** : gain `k` par ligne (`k_max = (34 − W/2)/34`, MID 0,55-0,75 > DEF 0,35-0,50), trois
  régimes de vitesse, le **décalage temporel entre lignes** (0,6-1,2 s, l'origine physique de l'intervalle), la zone
  abandonnée côté opposé (14 m de chaque côté ballon axial), l'**oblique** (`phi` 0-12°, `obliqueDepth`) et son
  coût sur la ligne de hors-jeu.
- **La bascule** : fenêtre `W = t_bloc − t_ballon` (1,5-2,5 s après un renversement depuis un bloc coulissé), 7 s pour
  basculer, 150-300 m de course collective, et la **dégradation par la fatigue** (`kMul`, `interlineAdd` +4 m, `scanMul`).
- **La densité** `N_def(10)` dérivée (4,9 médian / 6,3 bas / 4,2 haut / 3,1 passif), la touche comme douzième défenseur
  (`1/b` = 1,60 à 2 m, 2,57 dans le coin), `pressOrientation`.
- **Douze déclencheurs** de pressing avec fenêtre et contre-déclencheur, le **bus d'événements** (`PressEvent`, TTL,
  portée, jetons 2 → 4 en contre-press, verrou de non-régression), les **pièges** (`SHOW` / `JUMP` / `CUT_BACK` /
  `COVER`, `TrapState`, cible `dyT ≤ 4 m`), le step-up simultané au piège.
- **La montée après dégagement** (+10-18 m en 2,5-3,5 s, `lineCommander`), le **hors-jeu comme problème d'équipe**
  (`desync` induit par le coulissement, « on retient les avancés », 1,5 → 4,8 par match à hauteur constante,
  `offsideAggression`, `farSideFullbackMode`).
- **Onze agents non omniscients** : un référent public (le ballon), `blockAnchor()` fonction pure de la croyance,
  l'erreur de croyance, la parole pour trois choses seulement (boîte à 1 message), trois horloges ; le **test 16**
  (rendre les agents omniscients doit faire disparaître les défauts).

## 2. Où en est le code

**Existant.** `cfg.bloc` (formation.js, lot 42/47/51) : l'équipe sans ballon est chaînée au ballon — la ligne à
`ligne` 27 m derrière lui (plafond au rond central), le bloc tient en `long` 30 m par compression uniforme des
interlignes, il **coulisse** de `lateral` 0,35 × z-ballon (borné `slideMax` 8 m), le côté faible **pince** ; l'équipe
en possession étire à `longAtk` 42 et sa ligne suit à `soutien` 20 m (`pousse` 141). Les axes tactiques
`hauteurBloc`, `compacite`, `piege`, `largeur` composent par-dessus (`blocFor`). **Ballon couvert / découvert**
(236, couvert.js) : porteur cadré ≤ 2 m ou dos au jeu → la ligne monte de 3 m × axe ; libre > 3,5 m face au jeu →
recul-frein de 5 m ; lissé à `tau` 0,2 s, « le bloc qui lit monte plus tôt » (246b). La **compression** (162) : en
fenêtre de pressing, le pas de montée croît avec la profondeur, × workF. **Pressing à déclencheurs**
(`pressTriggers` : prise dos au but, passe en retrait, perte haute ; fenêtre 4,5 s, bloc qui monte de `step` 3,5 m),
l'**ombre de couverture** (`coverShadow`), la **garde par tiers** (238, garde.js), la **ligne qui se referme** (228,
« un qui sort, trois qui couvrent »), le **contre-pressing chronométré** (229, `n` 3 hors ligne arrière, `chaise`).
La ligne de hors-jeu est bien le **2ᵉ** plus reculé toutes lignes (offside.js). Le **scan** (250) et le corps ouvert.

**Partiel.** Le coulissement existe mais avec **un seul gain pour tout le bloc** (`lateral` 0,35 : mesuré MID 0,40,
DEF 0,33 — la barre de baby-foot que le chapitre récuse) ; l'interligne est une **compression uniforme** de la
formation, pas une fonction des attributs ni un point de rupture ; la montée/recul est une **cible de spot** (le
joueur y va à sa vitesse de placement, 1,9 m/s — pas un régime locomoteur) ; le pressing a **trois** déclencheurs sur
douze, sans TTL, sans jetons, sans contre-déclencheur explicite ; le piège n'existe que comme axe `piege` (hauteur
de ligne) ; la fatigue touche la vitesse (workF) mais **pas** `k`, l'interligne ou le scan.

**Absent.** Le point de rupture (`INTERLINE_BREAK`, `blockIntegrity`) ; les deux régimes de `k_x` ; l'oblique de
ligne ; le décalage de déclenchement entre lignes (la latence de perception du chapitre 1) ; `N_def(10)` et
`edgeFactor` dans une utilité ; les `PressEvent` et le marché de jetons ; `TrapState` ; la montée après dégagement
comme séquence ; la contrainte « on retient les avancés » ; `offsideAggression`, `farSideFullbackMode`,
`abandonFarSide` ; la croyance sur le ballon et la parole (le bloc lit l'état vrai).

## 3. Les tests de réfutation, un par un

| # | Cible (book) | Statut | Mesuré (2 × 90 min) |
|---|---|---|---|
| 1 bimodalité de la longueur | 26-32 / 38-46, écart ≥ 8 | mesurable, **tenu** | **27,8 / 40,6 m**, écart 12,8 ; 52 % des images défensives entre 25 et 30 m |
| 2 interligne DEF↔MID | 10-15, P95 ≤ 19, > 16 m < 8 % | mesurable, **dégradé au 273** | moyenne 10,9 → **13,8 m**, P95 19,0 → 21,9 ; > 16 m 16 → **36 %** : la ligne arrière tenue ensemble ne porte plus ses latéraux hauts, le barycentre DEF descend et le milieu ne suit pas — l'interligne dérivé (lot 4) est le lot suivant |
| 3 gain `k` par ligne | MID 0,55-0,75 > DEF 0,35-0,50 | mesurable, **réfuté** | MID **0,40**, DEF **0,33** — un bloc rigide qui glisse peu (`lateral` 0,35, `slideMax` 8) |
| 4 signature angulaire | DEF 90 / MID 78 / ATT 69 (± 8) | mesurable, **tenu** | **97 / 77 / 72°** — les défenseurs coulissent, les attaquants convergent |
| 5 décalage inter-lignes | 0,6-1,2 s, > 0,3 obligatoire | mesurable, **hors définition** | **91 %** des défenseurs sont déjà à > 1 m/s à l'instant de la passe (le bloc ne s'arrête jamais) ; décalage 1ᵉʳ → dernier **changement de cap** 1,62 s p50 — un bloc qui vibre, pas un bloc qui perçoit avec retard |
| 6 fenêtre `W` de renversement | 1,5-2,5 s | mesurable, **réfuté** | **0,15 s** (19 renversements > 35 m) : le bloc est omniscient, le receveur opposé est pressé à l'instant |
| 7 densité à 10 m | 4,9 médian | mesurable, **réfuté** | **3,0** (bloc passif du modèle : 3,1) |
| 8 effet de bord | 1,34-2,00 | mesurable, **inversé** | **0,71** — la touche fait fuir la densité au lieu de la concentrer |
| 9-10 rendement des déclencheurs, pressings avortés | | à instrumenter (pas de `PressEvent`) |
| 11 hors-jeu par équipe | 1,5 → 4,8 | tenu au 255 | **0,5** → **1,75** (piege 0) → **5,25** (piege 1) provoqués par match, le preset ligneHaute 4,5 |
| 12 ligne cassée | 1-3 / match | mesurable, **réfuté** (273 : en baisse) | 606 → **398** épisodes / match / équipe (273, 2 × 90 min) — la mesure compte chaque épisode > 0,5 s toutes transitions comprises ; la desync p50 en défense placée 7,5 → 3,2 (ch. 03 T8) |
| 13 dérive de l'interligne | +3 à +6 m, ≥ +2 | mesurable, **réfuté** | 9,8 → **10,9 m** (+1,1) : la fatigue ne touche pas le bloc |
| 14 montée après dégagement | +10-18 m en 2,5-3,5 s | à instrumenter (pas d'événement de dégagement) |
| 15 rest defense | 3,7 corps / 43,6 m / 28,2 m | mesurable, **réfuté** | **5,9 corps** derrière le ballon, à **55 m**, largeur **35 m** (ch. 04 : 7,4 / 27 m / 61 m avec la définition du plus proche) |
| 16 invariant de croyance | défauts → 0 quand omniscient | **sans objet** : le bloc lit déjà l'état vrai — ses défauts sont donc tous « décoratifs » au sens du chapitre |
| 17 asymétrie montée / recul | 4,0-5,5 / 3,5-4,4, ratio 0,50-0,65 | mesurable, **partiel** (273) | montée p50 **1,78 → 2,07 m/s** (cible 4,0-5,5), recul **2,07 → 3,15** (3,5-4,4), ratio 1,17 → 1,52 — le régime de la hauteur (montée 4,8 / recul 3,9) ne parle que hors de la bande (tol 2 m) ; la montée reste au trot du bloc chaîné |
| 18 régime de `k_x` | ≈ 0 libre, ≈ 1 accroché | mesurable, **réfuté** | libre 0,10 → 0,27 → **0,41** (273), accroché 0,21 → 0,38 → **0,41** — la ligne suit son 2ᵉ plus reculé, lui-même chaîné au ballon par le spot ; les deux régimes de k_x restent à poser |
| 19 coût de l'oblique | | absent (pas d'oblique) |
| 20 loi de possession | Gamma forme 1,8-2,8, moyenne 1,1-2,5 s | mesurable, **réfuté** | moyenne **0,65 s**, forme **1,01** — exponentielle : pas de temps de contrôle incompressible |

## 4. Les lots que la fiche appelle

1. **Le bloc qui perçoit** (tests 5, 6, 16 ; Modèle 04) : la cible de bloc de chaque joueur dérivée de **sa croyance**
   sur le ballon (latence de déclenchement 0,22 s en vision centrale, 0,8-1,6 s dos au ballon), pas de l'état vrai.
   C'est ce qui fabrique l'intervalle, le renversement qui paie (W 1,5-2,5 s), et le décalage entre lignes.
   Le 262 — SCELLÉ 340 — a posé la croyance (croyance.js) et l'a branchée sur le marqueur (il suit sa croyance de son
   homme : 8,9 → 9,5 m p50, pris dans le dos) ; la cible de bloc depuis la croyance du ballon reste CE lot.
2. **Le coulissement par ligne** (test 3, 8) : `k` par ligne (MID > DEF), `k_max` de la largeur, `abandonFarSide`,
   et la touche comme douzième défenseur (`edgeFactor` dans l'utilité d'orientation, cible `dyT ≤ 4 m`).
   Le 261 — SCELLÉ 339 — a posé les TROIS RÉGIMES du §4.3 (entretien 1,4-1,8 m/s, coulissement actif 4,2, récupération
   au plafond du métier), déclenchés par le SAUT du slot ; il a mesuré que les slots sautent 54-60 fois par minute (p50 3,5 m)
   et que le corps vit à 6-11 m d'eux : le gain `k` par ligne et le pas du bloc restent CE lot.
3. **La ligne est une ligne** (tests 12, 17, 18, ch. 03) — **SCELLÉ 351 (273, ligne.js)** : l'unité à 4 Hz, la bande, le retard_i, « on retient les avancés », la hauteur comme régime locomoteur (montée 4,8 / recul 3,9 hors de la bande). Mesuré : desync p50 7,5 → 3,2 (ch. 03 T8), ligne cassée 606 → 398, recul 2,1 → 3,2 m/s ; coût : l'interligne DEF↔MID 10,9 → 13,8 (le milieu ne suit pas la ligne tenue — lot 4). Reste : `k_x` à deux régimes (test 18), la montée au régime (2,1 m/s), la plage 0,8-1,8.
4. **L'interligne dérivé et son point de rupture** (test 2, 20) : `interlineTarget` des attributs, `INTERLINE_BREAK`
   qui publie `blockIntegrity`, et la loi de possession individuelle Gamma (le temps de contrôle incompressible,
   ch. 01 T6).
5. **Le bloc fatigable** (test 13, Référentiel 07) : `blockDegradation` — `k` −30 %, interligne +4 m, scan −35 %.
6. **Les déclencheurs comme événements** (tests 9, 10, 14 ; ch. 09 PT1-8) : `PressEvent` avec TTL, portée,
   jetons contextuels 2 → 4, contre-déclencheur, verrou ; `TrapState` ; la montée après dégagement.
