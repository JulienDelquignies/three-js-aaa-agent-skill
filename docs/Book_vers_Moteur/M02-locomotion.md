# Modèle 02 — La locomotion, contre le moteur

*Fiche du 9/09, moteur fbc9369 (SCEAU 256). Mesures : 2 matchs de 90 min (graines 3, 7), échantillon 10 Hz.*

## 1. Ce que le chapitre demande

- **Trois couches** : intention, pilotage, intégration ; le **modèle longitudinal mono-exponentiel** v(t) = V₀(1 −
  e^(−t/τ)) avec V₀ 8,8 m/s (6,6-10,4 par attributs), τ 1,17 s (0,95-1,55), F₀ = V₀/τ **clampé** 5-10,2 N/kg, a_max
  7,5 (enveloppe match 6,0 départ arrêté), **intention d'effort** ε 0,55 en déplacement courant, D_max 6,0 (arrêt
  6,5 m depuis 8 m/s).
- **Le changement de direction** : accélération latérale 5,5, seuil de virage continu 40°, temps de plant 0,13 +
  0,125 θ, vitesse retenue plancher 0,40, v_allow(180°) 4,5 ; course arrière × 0,65, pas chassés × 0,58 ; rotation
  du buste 7 rad/s dégradée avec la vitesse.
- **La conduite** : pénalité de vitesse 0,85-0,95, de τ 1,06-1,18, latérale 0,60-0,78, distance entre touches.
- **Les courses arquées** (86 % des sprints sont courbes), l'orientation, **collisions et amas** (rayon 0,30,
  confort 0,75, ORCA, restitution 0,15, stagger), **coût énergétique** (Minetti 4,65 J/kg/m, coût latéral, plant,
  CP 22 W/kg, W′ 350 J/kg, récupération 280 s) couplé à la fatigue (λ_τ > λ_D > λ_V : c'est l'accélération qui
  s'effondre, pas la pointe), budget et LOD.

## 2. Où en est le code

**Existant.** `movement.js` : accélération **bornée** (`accel` 7,5 m/s² le long de la course, `turnAccel` 6,0
perpendiculaire — donc le taux de virage = turnAccel / vitesse), plafond `sprintMax` 8,0 après burst × 1,28,
vitesses par job (`speeds` : chase 6,4, mark 5,6, support 4,9, walk 2,6, keeper 6,4), `topF`/`accelF` comme facteurs,
le **mordu** (× 0,35 sur accel et virage), le yaw en slew borné (139, 9,4 rad/s × accelF ; le porteur 4 rad/s), la
**conduite** (`carrySurge` 6,2 après touche poussée, le déficit de conduite existe : −15 %), la glisse du tacle
(freinée), la fatigue sur la pointe (× 1 − 0,15 (1 − stam)), le premier pas (153).

**Partiel.** Le modèle est un **clamp d'accélération** (pas d'exponentielle, pas de τ) : les sprints atteignent
90 % de la pointe en **1,0 s** (réel 2,2-3,2) avec τ ajusté 0,85 ; l'intention d'effort n'existe pas (tout
déplacement est à pleine accélération : **8,5 accélérations > 3 m/s² par joueur et par minute**, réel 0,8-1,0) ;
la pointe dépasse le plafond (9,4 m/s au milieu — glisses et rattrapages) ; la fatigue plie la pointe (−12,8 %,
réel > −8) et non l'accélération ; le déficit de conduite est juste (15 %).

**Absent.** V₀/τ/F₀ par attributs avec clamp ; l'intention d'effort ε ; le freinage comme régime (D_max, plant,
vitesse retenue) ; la course arrière et les pas chassés comme ratios ; les courses arquées comme trajectoires (les
100 % « courbes » mesurés sont du bruit de cap, pas des arcs) ; l'évitement (11,5 interpénétrations par minute,
réel < 0,5) ; le coût énergétique (puissance métabolique, CP/W′) — la fatigue est un drain d'effort au carré.

## 3. Les tests de réfutation, un par un

| # | Cible (book) | Statut | Mesuré |
|---|---|---|---|
| 1 pointe par poste | ailiers/latéraux 8,3-9,2 ; milieux 7,5-8,4 | mesurable, **partiel** | LAT 8,70 ✓, AIL 8,81 ✓, DC 8,86, **MC 9,43**, ATT 8,36 — les milieux les plus rapides |
| 2 courbe d'accélération | τ 0,95-1,40, t90 2,2-3,2, R² ≥ 0,95 | mesurable, **réfuté** | τ **0,85**, t90 **1,00 s**, R² 0,85 (1 238 sprints) |
| 3 accélérations / décélérations | 0,81-0,97 / 0,86-1,17 par min | mesurable, **réfuté × 10** | **8,51 / 8,27** |
| 4 test 505 | 2,10-2,45 s | à faire en protocole isolé |
| 5 curve sprint | 6,2-7,0 m/s | à faire en protocole isolé |
| 6 part de sprints courbes | ≥ 70 % (réel 86) | mesurable, **hors définition** | 100 % (bruit de cap à 10 Hz) |
| 7 amorce du sprint | face 55-72 %, dos ≥ 8 % | à instrumenter (yaw) |
| 8 déficit de conduite | 4-16 % | mesurable, **tenu** | **15 %** (3,97 c. 4,67 m/s) |
| 9-10 puissance métabolique, CoD | 10-13 W/kg ; +15 / +25 % | absents |
| 11 dégradation Q6 / Q1 | HI ≤ −10 % ; pointe > −8 % | mesurable, **partiel** | HI **−31 %** ✓ ; pointe **−12,8 %** ✗ |
| 12 interpénétration | < 0,5 / min | mesurable, **réfuté** | **11,5 / min** |
| 13 non-oscillation | ≤ 2,5 inversions / s | mesurable, **tenu** | p50 1 |
| 14 cohérence `timeToReach` | erreur < 0,25 s | à instrumenter (`etaCourse` c. arrivée) |
| 15-16 discrimination de profils, garde-fou | | absents (pas de V₀/τ) |

## 4. Les lots que la fiche appelle

1. **Le profil locomoteur mono-exponentiel et l'intention d'effort** (tests 2, 3, 15, 16 ; le constat n° 1 des
   Bibles) : V₀/τ par attributs, ε 0,55 en déplacement courant, plafond dur — 8,5 accélérations par minute
   deviennent 0,9, et le budget de course existe.
2. **Le freinage et le changement de direction** (tests 4, 11) : D_max, plant, vitesse retenue, course arrière
   0,65 — la ligne qui recule (Bible 10 T17) en dépend.
3. **L'évitement** (test 12) : 11,5 interpénétrations par minute — rayon 0,30, confort 0,75, ORCA à 4 voisins.
4. **La fatigue sur l'accélération, pas sur la pointe** (test 11 ; Bible 16) : λ_τ > λ_D > λ_V, CP/W′.
5. **Les courses arquées** (tests 5, 6) et la **cohérence cinématique / décision** (test 14 ; Modèle 05 test 3).
