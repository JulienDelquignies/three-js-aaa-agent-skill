# Modèle 05 — Le contrôle de l'espace, contre le moteur

*Fiche du 9/09, moteur bc35ebb (SCEAU 256). Mesures : sonde espace / valeur (2 × 90 min).*

## 1. Ce que le chapitre demande

- **Trois objets** distincts (région dominante, zone atteignable, probabilité de contrôle) ; Voronoï ment ; la zone
  atteignable exacte sous le modèle mono-exponentiel (`R(t) = V_max [t − τ(1 − e^(−t/τ))]`, décentrée par la
  vitesse) ; **Spearman** (σ 0,45 s, λ 4,30, κ_def 1, λ_gk 12,9) et **Fernández & Bornn** (gaussienne orientée,
  rayon 4-10 m, δt 0,5 s, v_ref 13) ; le calcul temps réel (LOD A/B/D, grille 2 m, ≤ 7 µs / tick), **où cela se
  branche** (options de passe, pressing θ 0,55, couverture min 0,55, garde des lignes 8 m, horizon d'appel
  1,5 s), la carte **espace × valeur**, pourquoi les champs de potentiel cassent (oscillation), les heuristiques
  calibrées sur le modèle complet.
- **Tests** : fidélité LOD (r > 0,93, Kendall τ > 0,92 sur le classement des 12 options), forme de la zone
  atteignable, cohérence décision / physique (|T_prédit − T_observé| < 0,15 s), **oscillation** (12-25 changements
  de cible par joueur et par minute, aucun pic > 1,5 Hz), poteau de corner, omniscience spatiale, aire contrôlée,
  budget.

## 2. Où en est le code

**Existant.** `laneClearance` (corridor 1,15 m sur la ligne de passe), `interceptPoint` / `etaCourse` /
`rendezVous` / `flightRace` (accel 7,5, top 6,4, réaction 0,18, allonge 0,9 — la zone atteignable comme test
cinématique), `ecartCouloir`, `courseServie`, `menace.js` (menace par action), la garde par tiers (238), les
couloirs (241), le comité des soutiens, `coverSpot`, `keeperCouvert` ; les cibles de placement avec hystérésis par
loi.

**Partiel.** Le contrôle de l'espace est **binaire et géométrique** (un corridor libre ou non, une course qui
arrive ou non) — jamais une probabilité (σ, λ) ni un champ ; la zone atteignable ne suit pas le modèle
mono-exponentiel (Modèle 02) ; les cibles hors ballon **oscillent** : **96 changements de cible par joueur et par
minute** (réel 12-25 ; ch. 01 T15 mesurait déjà une re-décision toutes les 2-3 images) — le symptôme du champ de
potentiel que le chapitre nomme.

**Absent.** PPCF / Spearman et le modèle de Fernández & Bornn ; la carte espace × valeur ; le LOD spatial et la
grille ; le seuil de pressing sur PC ; la couverture minimale derrière le presseur ; l'horizon d'appel ; le calcul
sur les croyances (test 6).

## 3. Les tests de réfutation, un par un

| # | Cible (book) | Statut | Mesuré |
|---|---|---|---|
| 1 fidélité LOD | r > 0,93, τ > 0,92 | sans objet (pas de PC) |
| 2 forme de la zone atteignable | R(1) = 2,9 m (intention pleine) | mesurable | distance 1,0 s après le départ de l'arrêt : p50 **1,91 m**, p90 3,86 — sous le modèle (l'accel 7,5 donnerait 3,75) : les cibles sont proches et changent |
| 3 cohérence décision / physique | < 0,15 s | à instrumenter (`etaCourse` c. arrivée) |
| 4 oscillation | 12-25 / min, pas de pic > 1,5 Hz | mesurable, **réfuté** | **96 / joueur / min** |
| 5 poteau de corner | PC ↔ V positif | sans objet |
| 6 omniscience spatiale | écart 0,04-0,12 | **réfuté par construction** |
| 7 aire contrôlée par phase | | à instrumenter |
| 8 budget | ≤ 7 µs | à profiler (Modèle 01 : 251 µs par tick en tout) |

## 4. Les lots que la fiche appelle

1. **L'engagement de cible et la zone morte** (test 4 ; Bible 13 lot 4, Modèle 08 lot 3) : 96 → 12-25 changements
   par minute — hystérésis d'ensemble, `commitTicks`, zone morte ; sans quoi tout champ de valeur oscillera.
2. **La probabilité de contrôle** (tests 1, 3, 5 ; Modèle 07 lot 2, Modèle 09 lot 1) : Spearman sur la cinématique
   du moteur (σ, λ recalés), le classement des options de passe par PC × valeur.
3. **La zone atteignable mono-exponentielle** (test 2 ; Modèle 02 lot 1).
4. **Le calcul sur les croyances** (test 6 ; Modèle 04 lot 1).
5. **La carte espace × valeur et le LOD** (§8, §6) — après 2.
