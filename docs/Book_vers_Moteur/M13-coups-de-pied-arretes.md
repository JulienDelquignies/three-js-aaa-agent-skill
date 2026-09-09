# Modèle 13 — Les coups de pied arrêtés, contre le moteur

*Fiche du 9/09, moteur d9720d4 (SCEAU 256). Mesures : sonde duels / arbitrage / CPA (2 × 90 min), Bible 12 T10.*

## 1. Ce que le chapitre demande

- **Ce que vaut un CPA** (corner xG 0,030, plancher de ligue 0,016 ; 10 corners par match ; conversion 2,8-4,2 % ;
  1,1 coup franc direct par match, médiane 28 m, conversion 12,1 → 1,2 % par bande de 15 à 40 m ; penalty 0,78,
  matrice 3 × 3 tireur × gardien ; touches 94 / 93 / 86 / 76 % de rétention par bande, 2,5-4 touches longues
  dans la surface).
- **Machine à états** intégrée à la boucle ; **playbook paramétré** (chorégraphie + résolution physique au LOD0,
  Markov calibré au LOD1 ; repère local au CPA, `SetPlaySlot`, entropie ≥ 0,6, décroissance de la valeur d'une
  routine répétée) ; corners offensifs (profil de chute 27,0 / 45,5 / 12,6 / 14,8 % en profondeur, 47,9 / 27,1 /
  24,9 % en latéralité ; premier contact attaque 45 % / défense 55 % dont gardien 7,5 %) et défensifs ; dégagement,
  second ballon (4,6 % de tirs en 25 s), contre (2,0 % en 30 s) ; coups francs et mur (+13 pts d'interception sur
  les vols < 1,1 s) ; touches ; penalties ; engagement ; **lisibilité** ; le coach de CPA.

## 2. Où en est le code

**Existant.** Corners typés (referee `cornerTrav` : rentrant / sortant / tendu, cible premier / penalty / second à
40 / 30 / 30 %, `cornerSpots`, cérémonie `corner.pose`), corner court, coups francs directs (`coupFrancDirect` :
lucarne, mur 9,15) et lancés, touches courtes / longues (`toucheSpots`, `toucheLonguePrête`), penalty (Loi 14),
engagement (Loi 8, l'engagement est une passe), `preneurCPA`, `elireTaker` / `poserElan`, le marquage de surface
sur centre (133), l'affectation homme par homme (225), la tête (34, 112), le second ballon physique.

**Partiel.** Le corner existe mais **rare** (3,5 par match, réel 10 : le tir contré et le centre repoussé manquent —
Modèle 10 lot 2) et **stérile** (0 but sur 7, tir ≤ 25 s dans 14 %, premier contact attaque 29 %, gardien 0 %) ; la
cible est un tirage à trois valeurs sans profil de chute ; les coups francs directs sont deux fois trop nombreux
(2,0 par match) et sans but ; un penalty en deux matchs, raté ; les touches trois fois trop rares (14).

**Absent.** La machine à états et le playbook (`SetPlaySlot`, repère local, entropie, lisibilité) ; les corners
défensifs comme dispositif (Bible 12 §8) ; la matrice de penalty ; la rétention de touche par bande ; le second
ballon et le contre de CPA comme mesures ; le mur comme géométrie d'interception ; le coach de CPA ; le LOD1.

## 3. Les tests de réfutation, un par un

| # | Cible (book) | Statut | Mesuré (2 × 90 min) |
|---|---|---|---|
| 1 profil de chute | 27,0 / 45,5 / 12,6 / 14,8 ; 47,9 / 27,1 / 24,9 | mesurable (cible tirée) | premier 43 % / penalty 29 / second 29 (7 corners) ; profondeur à instrumenter |
| 2 premier contact | attaque 45, défense 55 dont gardien 7,5 | mesurable, **réfuté** | attaque **29 %**, défense 71, gardien **0** |
| 3 variance inter-équipes | | sans objet (pas de playbook) |
| 4 ablation de la chorégraphie | 0,030 → 0,016 | sans objet |
| 5 coup franc par bande | 1,1 / match, p50 28 m, 12,1 → 1,2 % | mesurable | **2,0 / match**, p50 26 m, 0 but |
| 6 ablation du mur | +13 pts sur vols < 1,1 s | à mesurer |
| 7-8 penalty | 0,78 ; matrice 3 × 3 | 1 penalty, 0 transformé — à mesurer en protocole |
| 9 entropie du playbook | ≥ 0,6 | sans objet |
| 10 rétention de touche | 94 / 93 / 86 / 76 | mesurable (par tiers) | déf 78 % (9), méd 69 (13), off 100 (7) ; **14 touches / match** (37-44) |
| 11 second ballon et contre de CPA | 4,6 % / 2,0 % | à instrumenter |
| 12 LOD0 / LOD1 | | absent |
| 13 lisibilité | | sans objet |
| corners / match, conversion | 10 ; 2,8-4,2 % | **3,5** ; **0 %** |

## 4. Les lots que la fiche appelle

1. **Le volume des CPA** (cibles ; Bible 15 lot 3, Modèle 10 lot 2) : 3,5 → 10 corners (le tir contré, le centre
   repoussé), 14 → 40 touches (le ballon qui sort), 2,0 → 1,1 coups francs directs.
2. **Le corner comme chorégraphie** (tests 1, 2, 4 ; Bible 12 lot 5) : `SetPlaySlot`, profil de chute, premier
   contact 45 / 55, le gardien qui revendique (7,5 %), la conversion 2,8-4,2 %.
3. **Le penalty et la matrice** (tests 7, 8 ; Bible 02) : 0,78, tireur × gardien.
4. **La touche contestée** (test 10 ; Bible 15 D29) : rétention par bande, la touche longue dans la surface.
5. **Le playbook et sa lisibilité** (tests 3, 9, 13) — après 2.
