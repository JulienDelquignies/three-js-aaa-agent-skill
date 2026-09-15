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
| 2 optimum puissance / placement | non monotone | partiel (258 : (v/vMax)^1,2 existe ; les vitesses restent fixes par geste) |
| 3 anisotropie des manqués | ratio ≥ 1,1, ≈ 1,5 | **258** : σθ = 2 σψ existe ; mesuré 0-1 au-dessus / 12-14 à côté — les visées du moteur restent basses (lucarne 8 %) |
| 4 xG / PSxG | distinguables | **272 / 276** : xG_dec porte la finition ; PSxG = 1 − p_save journalisé sur chaque tir cadré (enveloppe.js, événement 'enveloppe', st.psxg) — jamais tiré par défaut (tirage: false) |  |
| 5 sensibilité au gardien | ≥ 3 pts sur R_dive | **276** : mesurable | R_dive à 1,4 → 1,9 : le levier existe (rMax × keeping) ; balayage 4 × 900 s : r0 1,3 / rMax 1,7 → 33 % d'arrêts, r0 1,5 / rMax 1,9 → 63 % — la sensibilité est là (≥ 3 pts) |
| 5 bis arrêt dedans / dehors | ≈ 60 / 85 / 69 | **276** : le contraste émerge | **77 / 74 / 96 → 55 / 47 / 92 %** (8 × 45 min : total / dedans / dehors) — le régime réflexe et le budget temps font le gradient (45 pts pour 25 réels) ; le dedans trop bas : le tireur vise le poteau loin du gardien (ρ 3,9 m p50), le point visé § 3.4 est la dette |
| 7 rebonds | 10 % des tirs, 9 % des buts | mesurable, **proche** | **6 % / 8 %** |
| 8 latence VAR | > 0 | absent |
| 9 non-oscillation SHOOT | < 0,5 / match | à instrumenter |
| 9 bis tête | 9,6 % de conversion, 15 % des buts | **6 %** des tirs, **0** but |
| 10 ablation de la doctrine | 6-9 tirs à 0,13 c. 16-22 à 0,06 | **272** : l'axe `shotDoctrine` existe (Θ ∓ 0,015) ; l'A/B 200 matchs reste à courir |
| cibles | 25,3 tirs ; 64 % dedans ; p50 16 m ; cadrés 33 ; contrés 27,5 ; buts / tirs 0,11 ; 2,85 buts | | **24,5** ✓ ; **73 %** ; **12,8 m** ; **55 %** ; **2 %** ; **0,245** ; **6,0** |

## 4. Les lots que la fiche appelle

1. **L'échelle de finition** (le 258 — **SCELLÉ 331** : σ d'angle anisotrope, attributs en facteurs, sous-dosage, hauteur visée ; cadrés 60 → 48 % à graines égales, conversion inchangée ; tests 3, 5 bis, cibles) : l'erreur anisotrope avec exposant vitesse-précision
   (Modèle 03 lot 3), la vitesse qui coûte la précision — la conversion 24,5 → 11 %, dehors 0 → 15 % d'arrêts en
   moins, 6 → 2,85 buts.
2. **Le blocage** (cible 27,5 % ; le 258b — **SCELLÉ 332** : l'engagement à l'armé, la jambe qui s'allonge, le tireur dans le trafic, les issues §5.2 ; contrés 4-7 → 24 % à 8 × 45 min) : `contreTir` à 2 % — le corps entre le tireur et le but (Bible 03, 15).
3. **Le xG en forme close et PSxG** (tests 1, 4 ; Modèle 06) — **SCELLÉ 350 (272, xg.js)** : la porte xG_dec > EV_cont + Θ_i, le noyau de Sumpter clampé, les corrections en log-odds, Ω, Θ_i, l'axe shotDoctrine, le xG sur chaque tir ; mesuré 8 × 45 min : xG moyen 0,16 → 0,14, buts / tirs 15,6 → 11 %, le volume (35 / match) et la surface (77 %) restent l'affaire du bloc. Reste : EV_cont sur le panier, PSxG (lot 4), le verrou 0,30 s, le test 9.
4. **Le gardien à enveloppe continue** (tests 5, 5 ter ; Bible 02) — **SCELLÉ 354 (276, enveloppe.js)** : t_f en forme close, t_disp, R(t) de vitesse nulle (5 ter tenu : 0,025 m à 0,05 s), l'ellipse, le régime réflexe, p_save en sigmoïde et le tirage unique optionnel, PSxG journalisé ; le seuil dur d'envergure (diveReach) ne décide plus, le gant hors enveloppe ne résout pas. Mesuré 8 × 45 min : arrêts / cadrés 77 → 55 % (dedans 74 → 47, dehors 96 → 92), buts 4,9 → 7,3 / match — l'envergure d'hier était impossible, la précision du tireur reste la dette (§ 3.4). Reste : ± 5 buts par saison, β0 comme levier (le tirage), le point visé.
5. **La tête et le penalty recentrés** (9 bis, cibles) ; **le VAR** (test 8) et **les deux conventions** (test 12 ;
   Modèle 16 lot 1).
