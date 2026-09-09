# Bible 11 — Les transitions, contre le moteur

*Fiche du 9/09, moteur 8411879 (SCEAU 256). Mesures : 2 matchs de 90 min (graines 3, 7), 4-3-3 contre 4-3-3.*

## 1. Ce que le chapitre demande

- **Quatre définitions emboîtées** à ne jamais mélanger : D1 changement de possession (121 par équipe et par
  match), D2 transition significative (≈ 50), D3 but issu d'une transition offensive (47-53 % des buts), D4
  contre-attaque codée (7 % des buts, 9,5 % des possessions). X23 et X24 doivent passer **ensemble**.
- **Le socle temporel** : 242 possessions nées d'une perte en jeu par match, reprise médiane 9,0 s (p10 3,2, p90
  28,6), 24 % ≤ 5 s ; deux buts de transition sur trois dans les dix premières secondes ; **pas de bonus intrinsèque
  au contre** : son rendement doit sortir du terme « défense déséquilibrée » (Tenga : 28,5 % contre 6,5 %).
- **Le gradient de zone** : récupération à 84-94,5 m → 3,0 % de but, à 0-10,5 → 0,16 % ; perte à 10-21 m → ≥ 25 %
  de tir adverse ≤ 10 s.
- **La première seconde** : latence 0,7 s (Spearman), `tti ≤ 1,5 s`, `v ≥ 2 m/s` pour presser, puis le **tri
  instantané** en cinq rôles (`PRESS`, `CUT`, `SEAL`, `DEPTH`, `REBAL`) décidé localement par cinq critères
  (`tti`, vitesse, `d_ball`, `goalSide`, `nFreeBehind`, `deficit`) ; `pressSlots` 1-5 et `counterpressWindow` 3-12 s
  comme axes d'école ; quatre orientations (`SPACE`, `MAN`, `LANE`, `BALL`) ; l'interdit de la faute et son
  contre-argument (`tacticalFoulPolicy`).
- **Le repli** : on ne court pas vers le ballon mais vers l'axe ballon-but (`retreatTarget`), temps d'arrivée par
  poste (central 1,4-3,4 s … ailier opposé 5,4-9,0 s, avant-centre jamais) — **la fenêtre de transition est un
  résultat** (`transitionWindow` = l'instant où le 8ᵉ est rentré), pas un paramètre ; le `SEAL` (recul-frein,
  −15 à −35 % sur le porteur) ; le coût physique facturé.
- **La rest defense** avant la perte (3,7 corps / 43,6 m / 28,2 m / +1,7), indexée sur la menace, et son pendant
  la rest attack ; le gardien 22ᵉ joueur (`sweeperGamble`).
- **Les trois secondes d'or** : `VERTICALIZE` / `ESCAPE` / `SECURE`, `hasLaunchedRunner` prioritaire dans la fenêtre
  de 3 s, la première passe qui avance (Elsner) ; le profil cinématique du contre (5,55 m/s médian, 10,3 s, 2,7
  passes), les trois zones d'entrée de surface, le second ballon (Leipzig).
- **Le déséquilibre lu, jamais injecté** (`disorderScore` : `shapeError`, `lineIntegrity`, `behindBall`,
  `polarisation`), résorption émergente (bloc reformé en 8-12 s), usage dans trois utilités seulement.
- **Transition-transition** : reperdre dans les 3 s multiplie par 6,6 le tir adverse ; `regainFragility`, la
  machine à états avec verrous, le rôle `TRAIL`.

## 2. Où en est le code

**Existant.** Les **quatre moments** (phases.js `momentDuJeu`, fenêtre `moments.win` 5 s, événements 'moment') ;
le **contre-pressing chronométré** (229 contrepress.js : à la perte en bloc compact, les 3 plus proches hors ligne
arrière ferment les sorties pendant 5,5 s × axe pressing × workF, puis recul-frein) ; la **verticalité du regain**
(111 : la passe qui avance pèse pendant la fenêtre, cooldown d'appel profond relâché) ; les **trois zones d'entrée
de surface en contre** (242 `contreZones`) ; le **repli** (251 repli.js : tri par axe, doses) ; le **recul-frein**
(couvert.js, `frein`) ; la **rest defense implicite** (bloc.soutien, le latéral faible qui rentre 68, la pousse 141) ;
le **premier pas** au 50/50 (153) ; le pressing à déclencheurs avec la perte haute < 2,5 s comme 3ᵉ signal ; l'axe
tactique `transition`.

**Partiel.** La transition est une **fenêtre fixe** (5 s de moment, 5,5 s de contre-press) — le chapitre la veut
dérivée des temps d'arrivée ; le contre-press engage **toujours** les 3 plus proches (mesuré : 177 pertes sur 182
avec ≥ 2 corps en course — réel 20-30) ; le repli est une course vers le spot, pas vers l'axe ballon-but ; la rest
defense n'est pas assignée à la menace ; le déséquilibre n'est pas lu (pas de `disorderScore`), mais le rendement
du contre est déjà surpayé (15 % de but sur récupération haute — réel 3).

**Absent.** Les cinq rôles de transition et leur tri local ; `tti` et le seuil de vitesse 2 m/s ; `pressSlots` et
`counterpressWindow` comme axes d'école ; les orientations ; `transitionWindow` ; le `SEAL` comme rôle (distance
6-10 m, −25 % sur le porteur) ; `retreatTarget` ; le gardien de transition ; l'arbre `DECIDE_ON_REGAIN` avec
`hasLaunchedRunner` ; `disorderScore` ; `regainFragility` ; `TRAIL` ; `tacticalFoulPolicy` ; la facture physique.

## 3. Les tests de réfutation, un par un

| # | Cible (book) | Statut | Mesuré (2 × 90 min) |
|---|---|---|---|
| X1 possessions nées d'une perte en jeu | 242 ± 15 % | mesurable, **réfuté** | **364** / match (400 possessions en tout) — le jeu haché du ch. 01 |
| X2 temps de reprise | p50 9,0 ; p10 3,2 ; p90 28,6 ; ≤ 5 s 24 % | mesurable, **partiel** | p50 **8,8** ✓, p10 **1,3** (repertes immédiates), p90 29,3 ✓, ≤ 5 s **31 %**, ≤ 10 s 56 % ✓ |
| X3 tirs ≤ 5 / 10 s après récupération | 44 / 62 % | mesurable, **proche** | **38 / 54 %** (37 tirs) |
| X4 buts ≤ 10 s | 65 % | mesurable, **tenu** | **64 %** (11 buts) |
| X5 gradient de récupération | 84-94,5 m : 3,0 % ; 0-10,5 : 0,16 % | mesurable, **surpayé** | **15,4 %** de but sur récupération haute (26 possessions) ; **2,9 %** sur récupération basse — le gradient existe mais le contre paie 5 × trop, et la récupération basse 18 × trop |
| X6 gradient de perte | 10-21 m : ≥ 25 % ; 84-94,5 : ≤ 0,5 % | mesurable, **tenu** | **34,6 %** / **0,0 %** |
| X7 transition-transition | ≤ 3 s : 8,0 % ; > 12 s : 1,2 % ; rapport ≥ 5 | mesurable, **tenu** | **7,5 % / 1,2 %**, rapport 6,3 — l'état le plus dangereux du jeu existe sans être codé |
| X8 vitesse du contre | 5,55 / 8,1 m/s | 2 contres seulement — 5,85 |
| X10 passes avant tir | 2,7 ; 0 passe 29 % ; ≤ 2 59 % | mesurable, **tenu** | **2,9 / 34 % / 69 %** |
| X13 corps à < 10 m à t₀ + 1,5 s | 3-5 (Red Bull) | mesurable | **2,8** |
| X14 premier contact d'un contre-presseur | 0,9-1,6 s | mesurable, **réfuté** | p50 **1,9 s**, et un contact < 5 s dans **38 %** des pertes seulement |
| X15 dispersion des départs en repli | ≥ 120 ms | mesurable, **tenu** | **677 ms** |
| X16 ordre d'arrivée | DC 1,3 / 6 2,4 / ailier 5,6 | à instrumenter |
| X17 reformation (`shapeScore` > 0,75) | 8-12 s | à instrumenter (pas de `shapeScore`) |
| X19 rest defense | 3,7 / 43,6 m / 28,2 m | ch. 10 T15 : **5,9 / 55 m / 35 m** |
| X22 part du temps en transition | 15-30 % | mesurable, **réfuté** | **35 %** avec la fenêtre fixe de 5 s |
| X23 origine des buts | transition 47-53 %, CPA 15-25 % | mesurable, **déséquilibré** | 11 buts sur 12 nés d'une perte en jeu, **58 %** ≤ 10 s ; CPA **8 %** (1 but) |
| X24 contre codé (D4) | 6-10 % des buts | 7 buts sur 12 en ≤ 10 s d'une récupération : **58 %** — le jumeau échoue par excès |
| X25 contre-pressings | 20-30 / match / équipe | mesurable, **réfuté** | **177** sur 182 pertes — chaque perte est un contre-pressing |
| X26 durée des transitions | 9-11 s, max 22-27 | sans objet : fenêtre fixe |

## 4. Les lots que la fiche appelle

1. **La transition comme résultat** (X22, X25, X26, X14) : `transitionWindow` dérivée des temps d'arrivée, le
   contre-press sur **signal** avec jetons (`pressSlots`) et non à chaque perte, le contact à 0,9-1,6 s.
2. **Le rendement du contre par le déséquilibre lu** (X5, X23/X24) : pas de bonus — `disorderScore` dans le choix
   du porteur et la valeur de la course ; la finition (258) d'abord, qui surpaye tout.
3. **Les cinq rôles de transition défensive** (X13, X16 ; le 251 comme socle) : `PRESS / CUT / SEAL / DEPTH /
   REBAL` tri local, `retreatTarget` vers l'axe ballon-but, le `SEAL` qui ralentit le porteur.
4. **La reperte immédiate** (X2 p10, X7) : le moteur la produit déjà (7,5 % / 1,2 %) — à nommer (`regainFragility`)
   et à conserver au banc comme invariant.
5. **Le socle de possession** (X1 ; ch. 01 T6/T7) : 364 pertes par match — le temps de contrôle incompressible.
6. **Les CPA qui comptent** (X23 : 8 % des buts) — avec le ch. 12 lot 5.
