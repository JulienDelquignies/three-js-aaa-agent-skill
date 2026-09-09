# Référentiel 12 — Football Manager comme borne, contre le moteur

*Fiche du 9/09, moteur bc35ebb (SCEAU 256). Mesures : Modèle 01 (CPU), bancs `verify-attributes` / `verify-identification`, Bible 03-09 (attributs).*

| # | Cible | Réel / borne | Moteur | Statut |
|---|---|---|---|---|
| C1 | Effet de `pace` 8 → 20 sur les points / 38 | ≤ +25 (FM +64) | — (pas de saison) | chantier A |
| C2-C3 | Effet de `offBall` ≥ +12 ; rapport intelligence / vitesse ≥ 0,45 (FM 0) | | les notes sont des **facteurs** (attributes.js), `otbF`, `visionF`, `decisions` existent — effet sur les points non mesuré | à mesurer |
| C4 | Écart attributs −1 / +1 | ≤ 18 pts | — | chantier A |
| C5 | Meilleure tactique − médiane, squads clonées | ≤ 15 pts / 38 | — (une tactique testée ce jour ; presets existent) | à mesurer |
| C6 | Buts de la meilleure tactique / 38 | ≤ 78 | 6 buts / match ⇒ **228 / 38** | réfuté (finition) |
| C7 | Σ buts c. Σ xG | ± 3 % | — (pas de xG) | Modèle 10 lot 3 |
| C8 | Effet de la maîtrise du rôle hors possession | ≥ +10 pts | rôles = axes + interdits ; effet non mesuré | à mesurer |
| C9 | Gain en pilotant les CPA | ≤ +3 | — | absent (pas de playbook) |
| C10 | Étendue sur 100 répétitions | 8-13 pts | — | chantier A |
| C11 | Coût d'un changement de système | +15-30 % de xG concédé sur 3 min | — (0 %) | absent (Modèle 14 lot 3) |
| C12 | QME c. FME | ≤ 5 % | — (un seul LOD) | Modèle 01 lot 6 |
| C13 | **CPU par match LOD0** | **≤ 2 s** | **≈ 130 s** (251 µs × 60 Hz × 5 400 s) | **réfuté × 65** |

## Ce que le référentiel ajoute aux lots déjà nommés

1. **Le budget CPU** (C13 ; Modèle 01 lot 1, 4) : 130 → 2 s par match — la décision à 10 Hz, la grille, zéro
   allocation ; sans lui, C1-C5, C10 (la saison comme instrument de mesure) sont hors de portée.
2. **L'intelligence qui pèse autant que la vitesse** (C2-C3, C8 ; le mantra : attributs = facteurs) : à mesurer
   au banc sur des matchs entiers (l'ordre de grandeur des effets de `pace` c. `offBall` / `vision` / `decisions`)
   — c'est la clause qui interdit l'imitation de FM.
3. **La saison comme banc** (C1, C4, C5, C10 ; chantier A du Plan, Référentiel 15) : points / 38, étendue sur
   100 répétitions.
