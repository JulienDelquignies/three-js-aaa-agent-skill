# Modèle 09 — Le modèle de passe, contre le moteur

*Fiche du 9/09, moteur d9720d4 (SCEAU 256). Mesures : sonde passe/tir (2 × 90 min ; complétion = même équipe propriétaire 0,15 s après la passe).*

## 1. Ce que le chapitre demande

- **La passe est un type somme** (`SHORT_GROUND`, `THROUGH`, `CHANNEL`, `CHIP_THROUGH`, `SWITCH`, `CROSS`,
  `CLEAR`…), pas un vecteur ; **sélection de la cible** par valeur × probabilité, **la passe au rendez-vous**
  (fenêtre t⁻, t*, t⁺ ; largeur 0,4-0,9 s ; le receveur part 0,25-0,40 s **avant** la frappe ; 25-40 % de courses
  jamais servies), **exécution** : erreur de choix contre erreur de geste (σ_ψ par attributs, sous-dosage 60-70 %
  trop courtes, fatigue), **étalonnage** (global 0,80-0,83 ; 5-15 yd 0,88-0,92 ; 15-30 yd 0,82-0,87 ; 30+ yd
  0,55-0,65 ; ≥ 32 m 0,473 ; sol 0,90-0,95 > aérien ; arrière 36,5 %, 24-42 % selon l'équipe ; bloquées 3,1 %),
  **la réception** (masque dos-au-but → `LAY_OFF` > 90 %, contrôle raté 2-4 %), **comptabilité des pertes**
  (`LossCause` : causes-passe 46-57 %, `MISCONTROL` 9-13 %, blocages 10-12 %, hors-jeu 4-6 %), **passes
  progressives** (20-45 ruptures par équipe, ratio ligne 2 / ligne 3 de 4:1 à 8:1), **ne pas passer**.

## 2. Où en est le code

**Existant.** `solvePass` (balistique inverse par style : ground / driven / lofted / chip, arrivée 6,5 m/s,
spin), les **circuits par style** (36), le **service du coureur** (41 : timé sur le passeur, `courseServie`), la
passe qui avance (111), le renversement (35, 98), le troisième homme, le une-deux, la remise (240), la
**dispersion** (`passSigma` × composure × sigmaF, visionF sur le choix), le pied faible (147), les **causes de
refus** (`deny` : hors-jeu, contre-recule…), `turnover.why`, l'intention engagée (TTL), `premiere-intention`.

**Partiel.** La complétion est **inversée par distance** (courtes 67-80 %, longues 61-71 % — réel 88-92 / 55-65) :
la passe courte se perd au contact (le presseur à 3 m, Bible 01 T12), la longue ne se manque pas (Bible 15
D14) ; le rendez-vous existe pour l'appel profond mais sans fenêtre publiée ni non-télépathie mesurée ; l'erreur
de geste est isotrope et sans sous-dosage ; pas de `LossCause` (le `turnover.why` en approche) ; 1 509 passes de
champ par match (réel ≈ 900 pour les deux équipes) — le jeu haché du chapitre 01.

**Absent.** Le type somme et ses classes ; la sélection valeur × probabilité calibrée (log-odds α_c, β_c) ; la
fenêtre de rendez-vous et la course avant la frappe (259) ; le sous-dosage ; le masque dos-au-but ; le contrôle
raté comme taux nominal 2-4 % ; la comptabilité des pertes ; les ruptures de ligne comptées.

## 3. Les tests de réfutation, un par un

| # | Cible (book) | Statut | Mesuré (2 × 90 min) |
|---|---|---|---|
| 1 étalonnage distance × direction | 5-15 yd 88-92 ; 15-30 82-87 ; 30+ 55-65 ; arrière 30-42 % | mesurable, **partiel au 265** (en complétion événementielle : 87 / 84 / 75 / 56 — la tranche moyenne manque) ; **au 267** (4 × 45 min) : 88 / 83 / 77 / 60 — la tranche moyenne monte de 4 points, le reste du déficit est la discrimination de P_succ (β_c 0,26-0,47) ; l'ancien « réfuté » tenait à la métrique « gardée 2 s » | 5-15 yd **67 / 71 / 80 %** (avant / latéral / arrière) ; 15-30 yd 71 / 70 / 82 ; 30+ yd 61 / 64 / 71 — le gradient est **inversé** ; arrière : sonde Modèle 06 |
| 2 fiabilité | ECE < 0,025 | **mesurable au 267** : ECE **0,020** (< 0,025), log-loss 0,414 (< 0,545 de la constante ; 0,39 non atteint), diagonale à ± 0,05 sur les bacs 0,6-0,9 (4 × 45 min, 1 460 passes) ; β_c 0,26-0,47 < 0,85 — la factorisation crue est omnisciente (le book : « un football omniscient »), dette nommée |
| 3 causes d'échec | causes-passe 46-57 %, contrôle 9-13, blocages 10-12, hors-jeu 4-6 | à instrumenter (`turnover.why`) |
| 3 bis contrôle raté nominal | 2-4 % | à instrumenter |
| 4 sous-dosage | 60-70 % trop courtes | absent (isotrope) |
| 5-6 fenêtre et non-télépathie du rendez-vous | 0,4-0,9 s ; +0,25-0,40 s ; 25-40 % non servies | Bible 09 T1 : 11 % servies (89 % non servies) ; fenêtre à instrumenter |
| 7 ruptures de ligne | 20-45 par équipe | à instrumenter |
| 8 masque dos-au-but | > 90 % `LAY_OFF` | partiel (240 remise) — à mesurer |
| 8 bis monotonie des attributs | | tenu par construction (facteurs) — à balayer |
| 8 ter hors-jeu au rendez-vous | 100 % licites à la frappe | tenu (`deny` hors-jeu au départ) |
| cal sol / aérien | 90-95 > aérien | **78 %** / 66 % (ordre ✓, niveau ✗) |
| cal ≥ 32 m | 0,473 | **66 %** (50 passes) |
| cal bloquées | 3,1 % | **1,6 %** |

## 4. Les lots que la fiche appelle

1. **La passe qui se manque à la bonne distance** (test 1, cal ; Modèle 07 lot 2, Modèle 03 lot 3) : l'interception
   probabiliste et l'erreur de geste par distance — la courte à 90 %, la longue à 50.
   → **SCELLÉ 265** (`reception.js`, `cfg.passe`, NOTES 343) : la réception à quatre issues et σ_ψ par classe et
   distance. LEÇON DE MÉTRIQUE : le gradient « inversé » du test 1 ci-dessus était mesuré en « gardée 2 s » ; en
   complétion événementielle (première touche d'un coéquipier) le moteur rendait déjà 87 / 80 / 74 / 64 % par tranche
   (79 % global) — monotone ; après le 265 : 87 / 84 / 75 / 56 (80 %). Le déficit de la tranche 15-30 yd est
   l'interception (Modèle 07 lot 2). Le sous-dosage attend le receveur qui vient au-devant.
2. **Le type somme et la sélection calibrée** (tests 2, 9) : classes nommées, P_succ prédit et calé (log-odds), le
   journal les porte.
   → **SCELLÉ 267** (`selection.js`, `cfg.selection`, NOTES 345) : les douze classes nommées, P_succ = P_rel × S × PPCF_r ×
   P_ctrl (la factorisation physique avec ce que le moteur possède), le calage log-odds par classe ajusté sur 1 469 passes
   du monde d'hier, le terme au barème (ρ par la consigne mentalité × decF) qui réordonne sans retenir, le journal
   (cls, pSucc). Test 9 tenu (calage null = l'identité, l'ordre des classes conservé) ; test 2 : ECE 0,020, log-loss 0,414 ; le monde : 80 → 81 %, 88 / 83 / 77 / 60 par tranche.
3. **Le rendez-vous et la course avant la frappe** (tests 5, 6, 8 ter ; le 259 — SCELLÉ 334 pour l'appel de l'épaule et la course qui traverse ; le rendez-vous derrière la ligne reste à faire, Bible 09 lot 2).
4. **La comptabilité des pertes** (tests 3, 3 bis ; Modèle 16 lot 1) : `LossCause` en vocabulaire Opta.
5. **Le sous-dosage et le masque dos-au-but** (tests 4, 8 ; Bible 14 lot 5).
