# Référentiel 15 — Le protocole de validation, contre le banc du moteur

*Fiche du 9/09, moteur bc35ebb (SCEAU 256). C'est le chapitre qui juge ce dossier et le banc existant (`verify-match11` à 150 blocs, 70 bancs, le sceau).*

| # | Cible | Réel | Banc actuel | Statut |
|---|---|---|---|---|
| Q1 | Noyau bloquant | 11 tests P0 | le sceau : jumeau d'empreinte + tous les blocs verts ou rouges nommés | autre logique (invariants d'un monde, pas P0 du réel) |
| Q2 | Durée du noyau | ≤ 10 min | **≈ 62 min** (8 shards + annexes) | réfuté × 6 |
| Q3 | Faux positifs | ≤ 5 % | non mesuré (rouges hérités 246d, contres à l'entrée) | à mesurer (100 exécutions) |
| Q4-Q5 | α 0,001 ; puissance 0,90 | | clauses à seuil, sans α ni puissance | absent |
| Q6-Q7 | 500 matchs par verdict ; 956 pour corner → but | | 2 × 90 min par sonde de ce dossier ; 6-20 graines × 300 s au banc | sous-dimensionné × 25-250 |
| Q8-Q9 | n_sim / N_réel 5 ; D_KS max 0,070 à N 380 | | — | absent |
| Q10-Q12 | Saisons pour σ_points ; σ 18,9 ; intra-équipe 7,5 | | — (pas de saison) | chantier A |
| — | Six niveaux (marginales, structure, spatio-temporel, scénarios, artefacts, juge) | | niveau 4 (scénarios : fixtures du banc) et 1 (clauses) partiels ; 2, 3, 5, 6 absents | partiel |
| — | Gouvernance (§10) : versionnement, traçabilité, tableau de bord | | NOTES / PLAN / SCEAU par lot, jumeau d'empreinte | tenu, à formaliser |

## Ce que le référentiel ajoute aux lots déjà nommés

1. **Le banc du réel** (Q1-Q7 ; décision 4 du Plan, Modèle 16 lot 2) : les sondes de ce dossier → `verify-book.mjs`
   informatif, puis les cibles P0 (une douzaine : buts / match, tirs, conversion, passes, réussite, corners,
   fautes, jaunes, hors-jeu, distance, ballon en jeu) comme noyau bloquant à ≥ 200 matchs de 90 min — ce qui
   exige le budget CPU (Modèle 01 lot 4 : 130 s → 2 s par match).
2. **La statistique** (Q3-Q5, Q8-Q9) : α, puissance, KS, faux positifs mesurés — le banc actuel prouve des
   invariants au bit, pas des distributions.
3. **Les six niveaux** : les niveaux 5 (artefacts : oscillation, interpénétration) et 6 (juge) avant le 2.
