# Modèle 07 — Pression et lignes de passe, contre le moteur

*Fiche du 9/09, moteur d9720d4 (SCEAU 256). Mesures : sonde passe/tir (2 × 90 min) et reprises des Bibles 10, 12.*

## 1. Ce que le chapitre demande

- **Une seule définition de la pression** (Bekkers : temps d'arrivée `T = τ_r + d/v_max + pénalité d'orientation`,
  logistique σ 0,45 à T 1,5 s, `P = 1 − Π(1 − p_i)`, seuil de vitesse 2 m/s) contre trois fausses (distance seule,
  cône, compteur de corps) ; ce que la pression fait mesurablement (réussite de passe, orientation, temps de
  contrôle).
- **L'ombre de couverture** en géométrie exacte (frontière Λ = 0,5 : demi-angle qui décroît avec la distance et
  croît avec la vitesse de passe), la **probabilité d'interception** dérivée du pitch control (intégration couplée
  le long de la trajectoire, pas le produit S × PPCF — test 11), **l'énumération des options de passe**
  (échantillonnage, scoring), **le pressing comme affectation** (hongrois, hystérésis β_hys, 6-14 changements de
  créneau par minute), **le déclenchement synchronisé** sans télépathie (Δt médian 0,30-0,45 s entre premier et
  dernier départ, corrélé à la distance), **densité et compacité** (L, W, S, A à 2 Hz), **le piège** à 3-4
  (`TOUCHLINE_TRAP` : regain 28-40 %), non-transférabilité de σ et λ.

## 2. Où en est le code

**Existant.** `pression.js` (`presseurArrive` : le presseur lit sa cible), `coverShadow` (l'ombre : le presseur
arrive par le couloir du soutien le plus dangereux), `laneClearance` (corridor 1,15 m sur la ligne de passe),
`interceptPoint` / `rendezVous` (réaction 0,18, allonge 0,9 — un test cinématique), la garde par tiers (238),
`pressTriggers` (trois signaux, fenêtre 4,5 s), le contre-press (229 : 3 corps, rayon 20), `hommeRemis` /
`bandeDuCentral` (252), la ligne qui se referme (228), la tenue de marquage (238), `contreTir` (176 : le corps
encaisse la frappe), `jambeTendue` (181).

**Partiel.** La pression est **une distance** (`pres` 2 m / `libre` 3,5 m dans couvert.js, `pressRadius` 9) — pas un
temps d'arrivée ni une probabilité ; l'interception est un **test géométrique dur** (`laneClearance` puis
`rendezVous`), sans σ : la passe est bloquée en vol dans **1,6 %** des cas (réel 3,1) mais la passe courte échoue
à **20-33 %** (réel 8-12) — le tirage d'interception est court-circuité par le contact ; l'affectation est un
glouton par distance à hystérésis de coût (29 commutations / min, Bible 12 T7 — réel 6-14 créneaux) ; le
déclenchement est **simultané** (Bible 10 T5 : 91 % déjà en mouvement, décalage de cap 1,6 s) ; la compacité est
mesurée (Bible 10 T1-T2 : longueur 27,8 m ✓, interligne 11,1 ✓) mais non publiée par le moteur.

**Absent.** Le temps d'arrivée logistique et le seuil 2 m/s ; la loi d'ombre exacte et sa frontière ; l'intégration
couplée de l'interception ; l'énumération scorée des options ; l'affectation hongroise et β_hys ; le déclenchement
par événement à latence ; le piège comme plan à quatre rôles (Bible 10 §8).

## 3. Les tests de réfutation, un par un

| # | Cible (book) | Statut | Mesuré |
|---|---|---|---|
| 1 loi d'ombre | frontière Λ = 0,5 par distance × vitesse | à faire en protocole isolé (`laneClearance` est un corridor fixe) |
| 2 étalonnage de la réussite | 0,85 ± 0,01 ; blocages 3,1 % | mesurable, **réfuté** | réussite **≈ 73 %** (5-15 yd 67-80, 15-30 yd 70-82, 30+ yd 61-71) ; blocages **1,6 %** |
| 3 non-télépathie | Δt médian 0,30-0,45 s, P95 < 0,70 | Bible 10 T5 : simultané (91 % en mouvement), décalage de cap 1,6 s |
| 4 non-omniscience de l'interception | écart 0,05-0,15 | **tenu au 266** (la latence et le ballon cru : les interceptions des courtes 10 → 5 %, bloquées 4 → 3 %) | avant : réfuté par construction |
| 5 stabilité de l'affectation | 6-14 / min, pas de pic > 1 Hz | Bible 12 T7 : **29 / min** |
| 6 piège | regain 28-40 % | absent |
| 7 compacité dynamique | L 26-32 m médian ; −4-8 m bas → haut | Bible 10 T1 : **27,8 m** ✓ ; par zone à mesurer |
| 8 pression / possession (Narizuka) | | à instrumenter |
| 9 budget | ≤ 12 µs | à profiler |
| 10 non-transférabilité de σ, λ | | sans objet (pas de σ, λ) |
| 11 double comptage S × PPCF | | sans objet |

## 4. Les lots que la fiche appelle

1. **La pression comme temps d'arrivée** (tests 2, 4, 10 ; Bible 09 T4, Bible 01 T12) : Bekkers (τ_r, v_max,
   orientation, logistique σ 0,45 à 1,5 s, seuil 2 m/s) — une seule définition lue par le porteur, le presseur,
   le journal.
2. **L'interception probabiliste couplée** (tests 1, 2, 11 ; Modèle 03 lot 4, Modèle 09) : l'ombre exacte, σ 0,45 /
   λ 4,30 recalés sur la cinématique du moteur — la passe courte à 88-92 %, la longue à 55-65.
   Le 265 (la réception, SCELLÉ 343) a mesuré que l'interception en vol porte le déficit de la tranche 15-30 yd
   (14-15 % des passes prises par un adversaire à ≥ 1,5 m du receveur) : c'est CE lot, le suivant.
   → **SCELLÉ 266** (`interception.js`, `cfg.interception`, NOTES 344) : la latence de lecture, le ballon cru, le
   passeur qui lit ses croyances — bloquées 4 → 3 % (réel 3,1), courtes 87 → 91, longues 56 → 61 ; la tranche 15-30 yd
   tient à la sélection du passeur (Modèle 09 lot 2). Reste : la logistique σ / λ comme lecture du passeur (Λ), l'ombre
   en forme fermée, le pré-élagage.
3. **L'affectation avec hystérésis** (test 5 ; Bible 12 lot 3, Modèle 08 lot 1) : hongrois à ordre fixe, β_hys.
4. **Le déclenchement par événement** (test 3 ; Bible 10 lot 6, Modèle 04) : `PressEvent`, latence, portée.
5. **Le piège** (test 6 ; Bible 10 §8) — après 3 et 4.
