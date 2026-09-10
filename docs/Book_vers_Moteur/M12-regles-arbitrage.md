# Modèle 12 — Les règles et l'arbitrage, contre le moteur

*Fiche du 9/09, moteur d9720d4 (SCEAU 256). Mesures : sonde duels / arbitrage / CPA (2 × 90 min), Bibles 03, 14, 15, 16.*

## 1. Ce que le chapitre demande

- **Loi 11** en trois prédicats (position à t*, infraction IP / IO / GA résolue plus tard, exonérations), **le point
  du corps sans squelette** (capsule + extension du pied avant par la phase de foulée, piège de Nyquist),
  l'auto-limitation de l'attaquant (non-collage à la ligne : σ ≥ 0,8 m) ; **Loi 12** (fautes, avantage non
  oraculaire ≤ 85 %, cartons : 5-7 fautes par jaune, 3-5 jaunes par match, retenue post-avertissement 0,30-0,85) ;
  penalty ; **sorties** (85-105 arrêts de 26-32 s) ; **temps additionnel** bouclé sur le registre (+2′10″,
  +3′16″ si écart > 1) ; **VAR** (+0,10-0,20 but annulé, +1-1,5 min) ; **l'arbitre comme agent** (erreurs selon la
  distance 11-15 m, asymétrie 8:1 non-signalements / signalements erronés, charge en fin de match × 1,4).
- **Test 1** : le nombre de hors-jeu ne doit pas varier de plus de 2 % avec la cadence.

## 2. Où en est le code

**Existant.** `offside.js` (ligne = 2ᵉ plus reculé toutes lignes, ballon compris ; tolérance 5 cm au bénéfice
de l'attaquant ; refus 'hors-jeu' au départ de la passe ; `checkOffside`) ; l'**arbitre incarné** (185 : la
diagonale, le rond, le sifflet, les assistants) ; la **Loi 12** (avantage 1,8 s, contact 0,9 m, mur 9,15, jaune à
la récidive 2, rouge au second jaune, l'expulsion physique = dette) ; le **penalty** (Loi 14, cérémonie) ; les
**sorties** (touche 217-219, corner, six mètres, coup franc, `tempsMort` par espèce × tempo × contexte) ; le
**chrono** (temps additionnel `min(12 %, 0,35 × arrêts)`, mi-temps) ; les cartons au banc (`verify-cartons`,
`verify-loi12`, `verify-expulsion`).

**Partiel.** Le hors-jeu est **une photo au départ** de la passe sur le centre du corps (pas de capsule, pas de
IP / IO / GA différés) et il ne siffle presque jamais (0,5-1,0 par match, Bible 03/10 — la ligne n'est pas une
ligne) ; l'avantage est un délai fixe ; les cartons **pleuvent** (8,5 jaunes, 1 rouge par match ; 2,7 fautes par
jaune) parce que la récidive est à 2 et le tacle glissé ordinaire ; les arrêts sont trop rares et trop courts
(49 par match de 17,5 s, réel 85-105 de 26-32) ; le temps additionnel est constant (Bible 16 T23).

**Absent.** La capsule et la phase de foulée ; l'auto-limitation ; l'infraction différée ; l'avantage non
oraculaire (`PULL_BACK`) ; la retenue post-avertissement ; le VAR et `GOAL_PENDING_REVIEW` ; le registre du temps
additionnel ; l'arbitre faillible (erreurs selon la distance, asymétrie, charge).

## 3. Les tests de réfutation, un par un

| # | Cible (book) | Statut | Mesuré |
|---|---|---|---|
| 1 indépendance à la cadence | hors-jeu ± 2 % | à mesurer (Modèle 01 test 3 réfute déjà les tirs) |
| 2-3 marge et non-collage | R² ≥ 0,02 ; σ ≥ 0,8 m | mesurable au 259 : le coureur servi de l'épaule à +2,5 m (p10 0, p90 +4,8) — la marge disperse |
| 4-6 erreurs de l'arbitre | 8:1 ; minimum 11-15 m ; × 1,4 | absents (arbitre infaillible) |
| 7 sur-dispersion des fautes | | à mesurer |
| 8 bouclage fautes / cartons | 5-7 par jaune ; 3-5 jaunes | tenu au 257 | **2,7** → **5,0** par jaune ; **8,5** → **4,0** jaunes / match |
| 9 retenue post-avertissement | 0,30-0,85 | absent |
| 10 ablation du VAR | | absent |
| 11 temps additionnel selon le score | coefficient significatif | Bible 16 T23 : **161 / 157 s** quel que soit l'écart |
| 12 structure des arrêts | 85-105 de 26-32 s | mesurable, **réfuté** | **49** arrêts de **17,5 s** |
| 13 avantage non oraculaire | ≤ 85 % | à mesurer |
| 14 non-oscillation des verdicts | 0 | tenu (refus au départ) |
| 15 ATE sur le registre | +2′10″ ± 2′24″ | absent (pas de registre) |

## 4. Les lots que la fiche appelle

1. **Le carton qui juge la nature** (le 257 — SCELLÉ 333 : S de nature, prometteur, DOGSO, ardoise, retenue ; test 8 ; Bible 15 lot 2) : la récidive n'est pas le seul critère, le
   tacle glissé rare, 3-5 jaunes par match.
2. **Le hors-jeu comme capsule et comme infraction différée** (tests 1-3 ; Bible 03 « la ligne est une ligne »,
   le 259 — SCELLÉ 334 : la capsule à l'orteil, la course qui traverse, l'appel de l'épaule, la tentative sifflée ; 0,75 → ~4 hors-jeu par match) : la marge, l'auto-limitation, IP / IO / GA (IO/GA et l'interpolation sub-tick restent à faire).
3. **Le temps du match** (tests 11, 12, 15 ; Bible 14 lot 3, 16 lot 4) : 85-105 arrêts, le registre, le temps
   additionnel qui lit le score.
4. **L'arbitre faillible** (tests 4-6, 9, 13) : erreurs par distance, avantage `PULL_BACK`, retenue.
5. **Le VAR** (tests 8 du Modèle 10, 10) — après 2.
