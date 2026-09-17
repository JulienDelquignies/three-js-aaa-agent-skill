# Modèle 10 — Le modèle de tir, contre le moteur

*Fiche du 9/09, moteur d9720d4 (SCEAU 256). Mesures : sonde passe/tir (2 × 90 min), reprises des Bibles 02 et 09.*

## 1. Ce que le chapitre demande

- **La porte de décision** (xG ≥ seuil par mentalité, κ_i pénalise les occasions moyennes, verrou 0,30 s), **le
  modèle xG** en forme close sur la grille (X, C) (test 1 : RMS < 0,020 contre la chaîne physique), **le geste**
  (puissance / placement : optimum intérieur, test 2), **la résolution** (anisotropie au-dessus / à côté ≈ 1,5,
  PSxG séparé de xG par la finition), **le blocage** (27,5 % contrés), **le gardien** (enveloppe atteignable
  continue à l'origine, R_dive 1,4-1,9 m, taux d'arrêt ≈ 60 % dedans / 85 % dehors / 69 % total, amplitude ± 5
  buts par saison), **rebonds** (10 % des tirs, 9 % des buts), **hors-jeu et VAR** (`GOAL_PENDING_REVIEW`).
- **Cibles** : 25,3 tirs par match, 64 % dans la surface, distance médiane 16 m / moyenne 14,8, cadrés 33 %,
  contrés 27,5 %, buts / tirs 0,110, buts / cadrés 0,32, 2,85 buts par match, 88 % des buts dans la surface, 15 %
  de la tête (16,9 % des tirs à 9,6 %), penalties 78 %, tête / pied recentrés.

## 2. Où en est le code

**Existant.** `shooting.js` (`tryShot` : portée `shotRange`, gris `menace.grise`, répertoire des frappes 39 :
placé 16,5-17,5 m/s, enroulée 18,5 avec curl, tendu, lob, volée ; le pied faible 147), `menace.js` (`menaceTir`,
`qualiteTir` 232 : seuils boîte 0,14 / loin 0,05, pression × 0,6 ; `selectiviteTir`), la mentalité (149,
185-186), la dispersion 145 (hors-cadre), `contreTir` (176), le gardien (keeper.js : `diveReach` 2,95 m,
`diveTime` 0,9, `gatherHalf`, buste, pieds, prise, claquette ; le relevé qui coûte), le rebond (le second ballon
après arrêt existe physiquement), la tête (34, 112), la Loi 11 à la passe, le penalty (Loi 14), la première
intention.

**Partiel.** `qualiteTir` est un **seuil de menace** (0,14 / 0,05), pas un xG en forme close ; la porte n'a pas de
verrou nommé ; l'erreur est isotrope et sans exposant vitesse-précision (Modèle 03) ; le gardien arrête **44 %
des cadrés** (réel 68 %) — dedans 52 % (≈ 60 ✓), **dehors 100 %** (≈ 85) : la frappe de loin ne rentre jamais, celle
de près trop ; le blocage existe mais rare (**2 %** contrés, réel 27,5) ; 24,5 tirs par match ✓ mais **24,5 % de
buts par tir** (réel 11) et 6 buts par match (réel 2,85) ; distance p50 12,8 m (réel 16) ; têtes 6 % des tirs, 0 but.

**Absent.** Le xG en forme close et le test de cohérence physique ; PSxG ; l'optimum puissance / placement ;
l'anisotropie ; l'enveloppe du gardien continue à l'origine et le budget temps ; `GOAL_PENDING_REVIEW` ; les deux
conventions de comptage ; le recentrage tête / pied.

## 3. Les tests de réfutation, un par un

| # | Cible (book) | Statut | Mesuré (2 × 90 min) |
|---|---|---|---|
| 1 cohérence xG / physique | RMS < 0,020 | **272** : le xG de Sumpter existe (xg.js, table à 0,0004 près) ; ΣxG 5,3 / match c. 5,1 buts AVANT, 5,0 c. 3,9 APRÈS (8 × 45 min) — la cohérence tient au global, la grille par cellule reste à mesurer |
| 2 optimum puissance / placement | non monotone | **279** : les vitesses du book par geste × powF, vMax par attribut ; fixture à 16 m (200 frappes par vitesse) : P(but) **2 / 4 / 16 / 10 / 12 %** à 15 / 18 / 22 / 26 / 29 m/s — non monotone ✓ ; à 24 m 0 / 2 / 1 / 8 / 2 (le gardien du 276 y prend presque tout) |
| 3 anisotropie des manqués | ratio ≥ 1,1, ≈ 1,5 | **258 / 277 / 278** : l'ellipse de finition sur le point visé (ellipse.js : vraie normale, anisotropie 4,5 de départ, nominale intégrée) | **278** (8 × 45 min, plan nominal sans obstacle) : au-dessus 11-16 % / à côté 14-17 % → **0,83-0,93** (AVANT 0 / 9-12 → 0) ; sous 1,1 : les modes du book vivent à 0,4-0,8 m des poteaux et la pression du 258 tient un tir sur deux à P ≈ 1 (σhoriz 1,3-1,5 m) — dette nommée |
| 4 xG / PSxG | distinguables | **272 / 276** : xG_dec porte la finition ; PSxG = 1 − p_save journalisé sur chaque tir cadré (enveloppe.js, événement 'enveloppe', st.psxg) — jamais tiré par défaut (tirage: false) |  |
| 5 sensibilité au gardien | ≥ 3 pts sur R_dive | **276** : mesurable | R_dive à 1,4 → 1,9 : le levier existe (rMax × keeping) ; balayage 4 × 900 s : r0 1,3 / rMax 1,7 → 33 % d'arrêts, r0 1,5 / rMax 1,9 → 63 % — la sensibilité est là (≥ 3 pts) |
| 5 bis arrêt dedans / dehors | ≈ 60 / 85 / 69 | **276 / 277** : le contraste émerge et se cale | 276 : 77 / 74 / 96 → 55 / 47 / 92 % ; **277 (le point visé) : 69-71 / 65-67 / 87-92 %** (8 × 45 min : total / dedans / dehors — cible 69 / 60 / 85) |
| 7 rebonds | 10 % des tirs, 9 % des buts | mesurable, **proche** | **6 % / 8 %** |
| 8 latence VAR | > 0 | absent |
| 9 non-oscillation SHOOT | < 0,5 / match | à instrumenter |
| 9 bis tête | 9,6 % de conversion, 15 % des buts | **6 %** des tirs, **0** but |
| 10 ablation de la doctrine | 6-9 tirs à 0,13 c. 16-22 à 0,06 | **272** : l'axe `shotDoctrine` existe (Θ ∓ 0,015) ; l'A/B 200 matchs reste à courir |
| cibles | 25,3 tirs ; 64 % dedans ; p50 16 m ; cadrés 33 ; contrés 27,5 ; buts / tirs 0,11 ; 2,85 buts | **280** | **35-44** tirs (25,3 — la ligne accrochée ferme la surface : touches 76 → 59 ; reste la porte dans la surface, 0,5 tir par touche pour 0,32) ; **68-75 %** dedans ; p50 **13,3-14,0 m** ; cadrés **48-53** (le contrôle du gardien compte cadré) ; contrés **13-15** ; buts / tirs **0,13-0,16** ; **5,6** buts (2,85) ; arrêts / cadrés **70-73** (dedans 66-73, dehors 73-84) |

## 4. Les lots que la fiche appelle

1. **L'échelle de finition** (le 258 — **SCELLÉ 331** : σ d'angle anisotrope, attributs en facteurs, sous-dosage, hauteur visée ; cadrés 60 → 48 % à graines égales, conversion inchangée ; tests 3, 5 bis, cibles) : l'erreur anisotrope avec exposant vitesse-précision
   (Modèle 03 lot 3), la vitesse qui coûte la précision — la conversion 24,5 → 11 %, dehors 0 → 15 % d'arrêts en
   moins, 6 → 2,85 buts.
2. **Le blocage** (cible 27,5 % ; le 258b — **SCELLÉ 332** : l'engagement à l'armé, la jambe qui s'allonge, le tireur dans le trafic, les issues §5.2 ; contrés 4-7 → 24 % à 8 × 45 min) : `contreTir` à 2 % — le corps entre le tireur et le but (Bible 03, 15).
3. **Le xG en forme close et PSxG** (tests 1, 4 ; Modèle 06) — **SCELLÉ 350 (272, xg.js)** : la porte xG_dec > EV_cont + Θ_i, le noyau de Sumpter clampé, les corrections en log-odds, Ω, Θ_i, l'axe shotDoctrine, le xG sur chaque tir ; mesuré 8 × 45 min : xG moyen 0,16 → 0,14, buts / tirs 15,6 → 11 %, le volume (35 / match) et la surface (77 %) restent l'affaire du bloc. Reste : EV_cont sur le panier, PSxG (lot 4), le verrou 0,30 s, le test 9.
4. **Le gardien à enveloppe continue** (tests 5, 5 ter ; Bible 02) — **SCELLÉ 360 (276, enveloppe.js)** : t_f en forme close, t_disp, R(t) de vitesse nulle (5 ter tenu : 0,025 m à 0,05 s), l'ellipse, le régime réflexe, p_save en sigmoïde et le tirage unique optionnel, PSxG journalisé ; le seuil dur d'envergure (diveReach) ne décide plus, le gant hors enveloppe ne résout pas. Mesuré 8 × 45 min : arrêts / cadrés 77 → 55 % (dedans 74 → 47, dehors 96 → 92), buts 4,9 → 7,3 / match — l'envergure d'hier était impossible, la précision du tireur reste la dette (§ 3.4). Reste : ± 5 buts par saison, β0 comme levier (le tirage), le point visé.
5. **La tête et le penalty recentrés** (9 bis, cibles) ; **le VAR** (test 8) et **les deux conventions** (test 12 ;
   Modèle 16 lot 1).
6. **Le point visé** (§ 3.4, Miss It Like Messi) — **SCELLÉ 362 (277, visee.js)** : le mélange à neuf modes, le côté ouvert par η, les poids conditionnés (composure, flair, gardien avancé / engagé, angle fermé, bout portant), l'effondrement sous pression vers « le cadre » (P ≥ 0,7). Mesuré 8 × 45 min : arrêts / cadrés 52-55 → 69-71 % (dedans 39-48 → 65-67, dehors 93-100 → 87-92 : les cibles 69 / 60 / 85 du § 6.3 tenues avec le gardien du 276), buts 8,1 → 6,1 / match, xG moyen 0,157 → 0,15. Reste : les modes tirés (cadre 25 % pour 7, bas-ouvert 12 pour 26 — la pression du moteur reste haute : 45-55 % des tirs à < 2 m d'un corps), les cadrés 45 % (la dispersion du 258 à recalibrer sur le point visé), le hors-cadre au-dessus (0 pour 1,5×), le volume (42-46 tirs).
7. **L'ellipse de finition sur le point visé** (§ 3.4 « la trajectoire perturbée est intégrée », Modèle 03 §5) — **SCELLÉ 390 (278, ellipse.js)** : (Δψ, Δθ) bivariée corrélée à vraies queues, ln v corrélé à Δθ, la queue basse, le pied qui s'ouvre, f_corps, la nominale intégrée jusqu'au plan (bissection de θ, cap corrigé sur le z franchi), σ0 2,0 / anisotropie 4,5 de départ. Mesuré 8 × 45 min : cadrés 45-46 → 32-37 %, au-dessus / à côté 0 → 0,83-0,93, σvert / σhoriz au plan 0,7 → 1,7-2,4, buts 6,1 → 5,25. Reste : le ratio sous 1,1, les vitesses du book (28 / 20), les montants traversés.
8. **Le répertoire du book** (§ 3.1, ch. 3 §4) — **SCELLÉ 391 (279, repertoire.js)** : les vitesses sourcées par geste × powF (shotPower), vMax par attribut, les colonnes de dispersion par geste sur l'ellipse, la bride du bout portant, l'arrêt au journal (arretControle). Mesuré 8 × 45 min : instep 24 m/s, tf 0,7 s, arrêts / cadrés 67-71 (dedans 60-64, dehors 90-94 — sans recaler l'enveloppe), l'optimum du test 2 non monotone. Reste : la sélection du geste par P_but (§ 3.2, softmax T 0,35), le coup franc direct, le volume.
9. **Le pré-filtre de la porte** (§ 1.4) — **SCELLÉ 395 (282, prefiltre.js)** : contrôle, distance < 35 m, angle visible > 4°, corps orienté < 110° × pivotF (technique / agilité) — le candidat tir fermé avant toute évaluation ; dos au but 4,2 → 0 % des tirs contrôlés en surface, touches en surface 50 → 63 ; le volume (0,63 → 0,55 tir par touche pour 0,32) tient à EV_cont petit (p50 0,024), nommé.
