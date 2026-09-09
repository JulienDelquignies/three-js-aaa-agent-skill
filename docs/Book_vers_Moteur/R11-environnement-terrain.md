# Référentiel 11 — Environnement et terrain, contre le moteur

*Fiche du 9/09, moteur bc35ebb (SCEAU 256). Mesures : Modèle 03 (roulement, vol). Le moteur n'a ni météo, ni altitude, ni preset de pelouse, ni horaire, ni voyage.*

| # | Cible | Réel | Moteur | Statut |
|---|---|---|---|---|
| E1-E6 | Chaleur : sprints −25 %, HI −24 %, distance conservée, pointe en hausse, pauses fraîcheur | | — | absent |
| E7 | **BRD gazon standard sec** | **4,6 m** [4 ; 8] | **3,9 m** | réfuté par le bas (Modèle 03 test 3) |
| E8-E9 | BRD pluie 6,8 ; détrempé 2,6 | | — (un seul terrain) | absent |
| E10 | Portée d'un dégagement 30 m/s / 35° au niveau de la mer | 55,0 m ± 2 | à mesurer avec `kick` (traînée existe) | à mesurer |
| E11-E13 | Altitude (+3,8 / +6,2 m), vent 38-59 m | | — (ρ fixe, pas de vent) | absent |
| E14-E16 | Altitude et résultat (+0,50 but / 1 000 m) | | — | absent |
| — | Dimensions du terrain (§5) | 105 × 68, variantes | 105 × 68 et réduit 46 × 30 (`pitch.js`) — pas de variante de dimension de stade | partiel |
| — | Stade, public, horaire, calendrier (§6-§9) | | — | absent |

## Ce que le référentiel ajoute aux lots déjà nommés

1. **Le roulement DIN et ses presets** (E7-E9 ; Modèle 03 lot 2) : la même loi (a0 + b v) avec quatre terrains
   (sec 4,6 m, pluie 6,8, détrempé 2,6, synthétique) — la météo change `abandonFarSide` (Bible 10 §5).
2. **La densité de l'air comme paramètre** (E10-E13) : ρ dans `aeroAccel`, le vent comme vecteur — la portée du
   dégagement comme clause (55,0 m).
3. **La chaleur** (E1-E6 ; Référentiel 07 lot 1) : par le pool anaérobie (sprints −25 %), pas par la distance.
4. **Les dimensions** (§5) : le terrain comme variable de club (chantier A).
