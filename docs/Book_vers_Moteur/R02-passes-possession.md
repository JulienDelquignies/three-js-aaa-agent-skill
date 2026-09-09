# Référentiel 02 — Passes, possession et progression, contre le moteur

*Fiche du 9/09, moteur bc35ebb (SCEAU 256). Mesures : sondes Modèle 06 / 09 (2 × 90 min), Bibles 05, 08, 15. Les 38 cibles du chapitre, une par ligne ; « — » = non mesuré.*

| # | Cible | Réel | Moteur | Statut |
|---|---|---|---|---|
| 1 | Passes tentées / équipe / match | 420-475 | **≈ 770** (1 545 / match) | réfuté × 1,7 |
| 2 | Réussite globale | 82,5 % ± 1,5 | **71,9 %** | réfuté |
| 3 | Écart haut / bas de tableau | 4,5 pts | — (une seule qualité d'équipe testée) | à mesurer |
| 4-5 | Passes par possession | 6,2 / 5,2 | **≈ 3,8** (1 545 / 400 possessions) | réfuté par le bas |
| 6 | Réussite au sol, élite | 90-95 % | **78 %** | réfuté |
| 7 | Réussite ballon long ≥ 32 m | 47 % ± 5 | **66 %** | réfuté par le haut |
| 8 | Ballons longs / équipe / match | 45-50 | **≈ 12** (1,6 %) | réfuté × 4 |
| 9-10 | Passes vers l'arrière, possession / direct | 40-42 / 24-28 % | **49,3 %** (preset non appliqué par la sonde) | réfuté ; amplitude à refaire |
| 11-13 | Conservation sous pression par poste | 76,5 / 66,8 %, MD > MO > DC > AT | — | à instrumenter |
| 14 | **Réussite des centres en jeu ouvert** | **19-21 %** | **58 %** (Bible 04) | **réfuté × 3** |
| 15 | Centres / équipe / match | 9-14 | **23** (Bible 04) | réfuté × 2 |
| 16-17 | Buts par centre ; part des buts sur centre | 0,011 ; ≈ 15 % | **4,3 %** par centre (Bible 04) | réfuté × 4 |
| 18-21 | **Cutbacks** : 1,5-2,0 / match, 32 % complétés, 25 % → tir, 3-5 × la valeur du centre aérien | | Bible 08 : cutbacks comptés — à ventiler | à mesurer |
| 22 | Part des buts assistés | ≈ 56 % | — | à instrumenter (`pass` → `but`) |
| 23 | Buts sur phase arrêtée hors penalty | 20-28 % | **8 %** (Bible 11 X23) | réfuté |
| 24 | Durée de séquence | 9,5-10,4 s | sonde macro C15 | voir R01 |
| 25 | Progression par séquence | 12,1-12,6 m | sonde macro C16 | voir R01 |
| 26 | **Direct speed, amplitude inter-équipes** | **1,4-2,1 m/s** | — (une tactique) | à mesurer sur les presets |
| 27 | Passes par séquence, amplitude | 3,5-5,1 | sonde macro C14 | voir R01 |
| 28-29 | Séquences 10+ passes / saison | 650-920 / ≈ 190 | sonde macro C18 | voir R01 |
| 30 | Départ de séquence / propre but | 38-47 m | — | à instrumenter |
| 31-32 | **PPDA** amplitude 7,3-17, médiane 11-12 | | Bible 01 T21 : approximation ≈ 7-8 (une définition) | à définir (Modèle 16 lot 1) |
| 33-34 | Field tilt 20-80 %, couplage possession | | — | à instrumenter |
| 35 | High turnovers / équipe / match | 5,8-7,3 | **76,5** récupérations hautes (Bible 09 T7, définition large) ; **26** récupérations à 84-94,5 m sur 2 matchs (Bible 11 X5) | réfuté × 2-10 selon la définition |
| 36-38 | Part des high turnovers → tir 16 % ; rendement 1,5-2,5 × | | Bible 09 T7 : **18 %** ✓ ; Bible 11 X5 : 15,4 % de **buts** (réel 3,0) | tir ✓, but × 5 |

## Ce que le référentiel ajoute aux lots déjà nommés

1. **Le centre se manque** (14-17 ; Bible 04 lot centres, Bible 08) : 58 → 20 % de réussite, 23 → 12 par match,
   4,3 → 1,1 % de buts par centre — c'est le même lot que la passe qui se manque (Modèle 09 lot 1), avec le corps
   qui repousse (Modèle 10 lot 2) et le corner qui en découle (Modèle 13 lot 1).
2. **Le ballon long qui existe** (7-8 ; Bible 15 lot 3) : 12 → 45-50 par équipe, à 47 %.
3. **Les définitions nommées** (31-34 ; Modèle 16 lot 1) : PPDA × 4, field tilt × 3, high turnover à 40 m, cutback.
4. **L'amplitude inter-équipes** (9-10, 26-29 ; Modèle 14 lot 1, Référentiel 14) : les presets doivent produire des
   styles distincts — la sonde de ce jour n'a pas su les appliquer ; c'est une dette de sonde, à refaire avec
   l'API de `tactics`.
