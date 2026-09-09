# Modèle 06 — Les modèles de valeur, contre le moteur

*Fiche du 9/09, moteur bc35ebb (SCEAU 256). Mesures : sonde espace / valeur (2 × 90 min ; les presets `possession` / `direct` passés par la sonde n'ont pas été appliqués — même chiffre au dixième — à refaire avec l'API de tactics).*

## 1. Ce que le chapitre demande

- **Une fonction de valeur** V(état) calibrée (ECE < 0,01-0,02 : la fréquence du prochain but par bin), les cinq
  familles (xT en grille 12 × 8 interpolée, EPV, VAEP comme étalon, OBSO pour la position sans ballon, packing comme
  prédicteur), **la fonction d'utilité** (ΔV × P_succ − coût physique − β_cons − β_role, normalisation : aucun
  terme > 40 % de l'écart-type inter-candidats), **la sur-optimalité** (softmax T 0,25 ; argmax < 80 % au tiers
  médian ; T → 0 fait bondir la réussite au-dessus de 82,5 %), **l'attitude au risque** (w± par score, temps,
  mentalité : ≥ 15 % d'écart de passes vers l'avant mené c. 0-0), coût et LOD, **calibration à trois niveaux**
  (V ; distribution des types d'action par zone : passes arrière 36,5 % moyenne, 40-42 possession, 24-28 direct ;
  ballons longs 10,5-11,7 % ; réussite 82,5 % ; incréments VAEP), **non-omniscience** (`value/**` n'importe pas
  `WorldState`), variété inter-joueurs (JSD ≥ 0,05 entre `flair` 18 et 6), frontière de grille.

## 2. Où en est le code

**Existant.** `menace.js` : quatre menaces (tir, centre, passe, conduite) avec un **arbitre** pondéré par style
et rôle (`arbitre`), `qualiteTir` / `selectiviteTir` (232), le barème de passe (avance 111, style 36, relation,
troisième homme, renversement, `visionF`), le curseur de risque et la mentalité (149, 185-186), la première
intention (44), le pausa de l'axe tempo (211 `tenueCalme`), les facteurs d'attributs (`decisions`, `vision`,
`flair` via persona), le tirage seedé dans le choix (`st.rnd2` pour la lecture).

**Partiel.** La valeur est un **score par action** (menaces) sans V(état) calibrée ni ΔV — l'utilité est un
empilement de bonus ; pas de softmax explicite (des tirages seedés localisés) ; l'attitude au risque existe par
axes mais **ne déplace rien** de mesurable : passes vers l'avant 39,0 % mené c. 40,1 % à 0-0 (cible ≥ 15 % d'écart) ;
la distribution des types est **loin** : passes vers l'arrière **49,3 %** (réel 36,5 ; 24-42 selon l'équipe),
réussite **71,9 %** (82,5), ballons longs **1,6 %** (10,5-11,7), 1 545 passes par match (≈ 900) ; l'arbitre lit
l'état vrai.

**Absent.** V(état) et sa calibration (ECE), xT / EPV / OBSO comme objets, la fonction d'utilité normalisée, la
température, w± mesurables, la variété inter-joueurs mesurée, le test d'import, la grille interpolée.

## 3. Les tests de réfutation, un par un

| # | Cible (book) | Statut | Mesuré |
|---|---|---|---|
| 1 calibration de V | ECE < 0,02 | sans objet (pas de V) |
| 2 passes vers l'arrière | 40-42 % possession, 24-28 direct | mesurable, **réfuté** | **49,3 %** (les trois tactiques identiques — preset non appliqué par la sonde) |
| 3 incréments VAEP | | sans objet |
| 4 anti-sur-optimalité | argmax < 80 % | à instrumenter |
| 5 effet de score | ≥ 15 % d'écart | mesurable, **réfuté** | avant mené **39,0 %** c. 0-0 **40,1 %** |
| 6 packing | | sans objet |
| 7 ablation de température | | sans objet |
| 8 non-omniscience | test d'import | **réfuté par construction** |
| 9 variété inter-joueurs | JSD ≥ 0,05 | à mesurer (flair via persona) |
| 10 frontière de grille | | sans objet |
| cal réussite / longs / passes | 82,5 % ; 10,5-11,7 % ; ≈ 900 | **71,9 % ; 1,6 % ; 1 545** |

## 4. Les lots que la fiche appelle

1. **Une valeur d'état calibrée** (tests 1, 3 ; Modèle 10 lot 3) : xT en grille interpolée d'abord (public,
   auditable), V calée sur la fréquence du prochain but — l'utilité devient ΔV × P_succ.
2. **La direction et la longueur des passes comme distribution** (test 2, cal ; Bible 05 « le renversement qui
   existe », Bible 15 lot 3) : 49 → 36,5 % vers l'arrière, 1,6 → 11 % de ballons longs, 1 545 → 900 passes.
3. **L'attitude au risque qui déplace** (test 5 ; Bible 16 lot 2) : w± par score et temps, mesuré au banc.
4. **La température et l'anti-sur-optimalité** (tests 4, 7 ; Modèle 08 lot 3).
5. **Le test d'import** (test 8 ; Modèle 04 lot 1) et **la variété** (test 9 ; Modèle 14 lot 5).
