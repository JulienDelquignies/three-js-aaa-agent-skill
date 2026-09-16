# Modèle 03 — La physique du ballon, contre le moteur

*Fiche du 9/09, moteur fbc9369 (SCEAU 256). Mesures : sondes de vol et de roulement sur `ball.js` (pas de match nécessaire).*

## 1. Ce que le chapitre demande

- **Les paramètres physiques** : masse 0,430, rayon 0,110, `C_D` sous-critique 0,474 / supercritique 0,17-0,21, vitesse
  critique 12,9 m/s (dépend du ballon), dispersion d'orientation ± 0,02, pente de `C_D` en spin ; **la portance en loi
  de puissance** (`C_L = κ Sp^n`, 0,83 / 0,63, plafond 0,33) calée sur trois points mesurés (Sp 0,06 → 0,14 ; 0,19 →
  0,29 ; 0,31 → 0,33) ; décroissance de l'effet 20 s ; le **knuckleball** (Ornstein-Uhlenbeck, λ 13,5 m, amplitude
  1,7 D).
- **Le roulement** en loi DIN (`a0 + b v + c v²`), avec la référence mesurée (0,40 ; 0,17) et la **norme UEFA** (lâcher
  à 3,20 m/s → BRD 4-8 m) ; la table maîtresse (20 m/s : 30 m en 2,33 s, arrêt à 47,2 m) ; les presets de terrain.
- **Rebonds** : COR sol 0,68 (2 m → 0,89-0,99), viscoélastique, frottement 0,45, poteau 0,80, corps 0,42-0,65.
- **Frappes** : distributions de vitesse par geste — **279** (repertoire.js) : placé 20, instep 28, enroulé 24, pointu 16, volée 26, tête 13 × powF, vMax [33 ; 38] par attribut ; **l'erreur d'exécution** anisotrope (tir σ_θ/σ_ψ 2,0 ; passe au
  sol 0,7), pied faible × 1,29, exposant vitesse-précision 1,2, fatigue → précision + 0,20 (1 − stamina) et
  → vitesse (deux fois plus), sous-dosage sous pression.
- **L'interception** comme brique commune (Spearman : σ 0,45 s, λ 4,30 s⁻¹, τ_r 0,20) et **la non-omniscience**
  (trajectoire perçue : v₀ bruité 8 %, ω inconnu pendant τ_p) ; le contrôle (2-4 % de réceptions perdues) ; le budget
  de déviations (25-30 % de tirs bloqués, 8-12 % déviés > 5°) ; la météo.

## 2. Où en est le code

**Existant.** `ball.js` : traînée avec **crise** (sigmoïde autour de 13 m/s, 0,47 → 0,17, remontée douce > 24),
**Magnus** `C_L = 1/(2 + v/(ω r))` plafonné 0,35, décroissance du spin 20 s, **sous-pas** à un demi-rayon,
**rebond avec couplage de spin** (friction de Coulomb, restitution 0,62, `grassSpin` 0,7), **roulement** (résistance
0,12 + traînée), contrat `checkBallFlight` (énergie, tunnel, spin) ; `ball-predict.js` : `solvePass` (styles), `interceptPoint`
(réaction 0,18, allonge 0,9), `etaCourse` / `rendezVous` (accel 7,5, top 6,4), `laneClearance` ; `ball-body.js`
le grand livre de continuité ; la dispersion (145 `dispersion`, `passSigma` × composure × sigmaF), le pied faible comme
note (147 `weakF`), la fatigue sur la pointe (31).

**Partiel.** La portance est une **droite hyperbolique** trop basse (0,054 / 0,138 / 0,191 aux trois points mesurés —
la moitié) : le coup franc tourne de 2,4 m au lieu de 4,5-6 ; le roulement va **trop loin** à haute vitesse (58 m à
20 m/s, réel 47 ; 77 à 25, réel ≈ 70) et **pas assez** au lâcher lent (BRD 3,9 m, norme 4-8) : la loi est
quadratique sans le terme linéaire DIN ; la crise de traînée existe mais **sans saturation** de la vitesse à la ligne
(35 m/s → 28,4 ; réel plafond 17-21) ; l'erreur d'exécution est isotrope (une seule `passSigma`) ; l'interception est
un test cinématique (`rendezVous`) et non un tirage à σ 0,45 s.

**Absent.** La loi de puissance de portance et sa calibration ; le knuckleball ; la dispersion d'orientation de
`C_D` ; la loi DIN de roulement et les presets ; le COR viscoélastique et le poteau ; l'anisotropie des erreurs et
l'exposant vitesse-précision ; le sous-dosage sous pression ; l'interception probabiliste et la trajectoire perçue ;
la météo.

## 3. Les tests de réfutation, un par un

| # | Cible (book) | Statut | Mesuré |
|---|---|---|---|
| 1 superposition de trajectoires réelles | | à faire sur tracking |
| 2 distance d'arrêt | 20 m/s → 47,2 m ; 25 → ≈ 70 | mesurable, **réfuté par excès** | 4 → 5,8 ; 8 → 17,1 ; 12 → 28,8 ; 16 → 42,3 ; **20 → 58,1** ; **25 → 77,1 m** |
| 3 BRD à 3,20 m/s | 4-8 m | mesurable, **réfuté par défaut** | **3,9 m** |
| 4 crise de traînée | inflexion 16-20, saturation 17-21 m/s à la ligne | mesurable, **partiel** | v à 20 m : 14 → 16,7 ; 16 → 16,7 ; 18 → 17,4 ; 20 → 18,5 ; 22 → 19,7 ; 26 → 22,4 ; 30 → 25,1 ; **35 → 28,4** — l'inflexion existe, pas la saturation ; `C_D` 0,45 / 0,32 / 0,17 à 8 / 13 / 25 m/s |
| 5a `C_L` aux trois points | 0,14 / 0,29 / 0,33 | mesurable, **réfuté** | **0,054 / 0,138 / 0,191** — la moitié |
| 5b déviation d'un coup franc à 25 m | 4,5-6,0 m | mesurable, **réfuté** | p50 **2,40 m** (1,7-3,0) |
| 6 anisotropie du tir | σ_vert/σ_horiz 1,6-2,5 | **278** (ellipse.js) : mesuré au plan du but sur le point visé, 8 × 45 min — brut 1,10-1,45 (le sol tronque le bas : les tirs visent à 0,35 m), côté haut (demi-normale) **1,7-2,4** ; AVANT (258) 0,64-0,74 avec un gauss à σ 0,707 et sans queue ; l'anisotropie de départ est 4,5 (la sensibilité verticale du ballon à 16-19 m/s n'est que 7-9 m/rad) |
| 7 ellipse pied fort / faible | × 1,29 | partiel (`weakF` × 0,29 sur σψ et σθ, le 258 ; l'ellipse du 278 le porte — aires à mesurer sur le protocole à 11 m) |
| 8-9 interception, sensibilité à σ | 78-84 % équipe ; pente ≥ 6 pts | absent (pas de σ) |
| 10 budget de déviations | 25-30 % bloqués | `contreTir` 176 existe — à instrumenter |
| 11 non-omniscience | 4-9 pts | absent |
| 12 rejeu bit à bit | | tenu en Node (jumeau d'empreinte du sceau) ; multi-plateforme non prouvé |
| 13 positivité des facteurs | | tenu par construction (278 : facteurs multiplicatifs, identité 1 à 50 — finF, composureF, weakF ; f_corps ∈ [1 ; 2,8], f_press ≥ 1) |
| 14 knuckleball | ≤ 0,45 m, λ 12-15 m | **absent** : excursion 0,000 m |

## 4. Les lots que la fiche appelle

1. **La portance calée** (5a, 5b) : loi de puissance `0,83 Sp^0,63` plafonnée 0,33 — le coup franc, le centre
   enroulé et la passe brossée doublent leur courbe.
2. **Le roulement DIN** (2, 3) : `a0 + b v` (0,40 ; 0,17) avec la norme UEFA comme clause — la passe au sol meurt
   là où elle meurt.
3. **L'erreur anisotrope et l'exposant vitesse-précision** (6, 7, 13 ; le 258) — **SCELLÉ 390 (278, ellipse.js)** : la
   normale bivariée corrélée (ρψθ 0,2, ρθv −0,35), la vraie normale par inversion (Acklam, §5.3), la queue basse, la troncature, le
   pied qui s'ouvre, f_corps, la nominale intégrée ; au plan 1,7-2,4. Reste : σ 0,7 sur la passe (le 265 vit encore au gauss du moteur).
4. **L'interception probabiliste** (8, 9, 11 ; Modèle 04) : Spearman σ 0,45 s, λ 4,30, sur la trajectoire **perçue**.
5. **Le knuckleball et la dispersion de `C_D`** (14) — après 1 et 3.
