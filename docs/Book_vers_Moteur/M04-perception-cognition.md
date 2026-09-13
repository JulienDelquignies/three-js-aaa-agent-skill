# Modèle 04 — Perception et cognition, contre le moteur

*Fiche du 9/09, moteur fbc9369 (SCEAU 256). Mesures : reprises des sondes Bible 14 (scan) et 01 (re-décision) ; pas de sonde propre — le chapitre décrit une couche qui n'existe pas.*

## 1. Ce que le chapitre demande

- **Une architecture C** : cône gradué à deux canaux (détail ± 30°, mouvement ± 75°, coupure 100°, décroissance
  à 45 m), **filtre de Kalman scalaire par entité** (croyance datée : position, vitesse, σ qui croît 0,62 / 1,15 /
  3,03 / 10,26 m à 0,5 / 1 / 2 / 4 s, plafond 12 m, repli vers l'ancre de rôle à 2,5 s), trois niveaux
  d'information (identité < 20 m, équipe, présence ; `NONE` à > 40 m dos tourné) — contre A (omniscience + bruit de
  sortie, « FM-like »), B (cône booléen), D (particules), E (RNN).
- **Le balayage** : cadence 0,44 ± 0,30 /s en fenêtre pré-réception (3,0 ± 2,1 balayages), base 0,35 ailleurs, facteur
  de rôle 1,19 → 0,81, d'attributs 0,6 + 0,8 vision, de pression 0,67 au contact (plateau 4 m), durée log-normale
  0,34 s médiane, 0-3 entités identifiées (mode 0), tête ± 80° à 400 °/s, flou de mouvement.
- **Latence** ex-gaussienne (moyenne 0,22 s, p90 0,32), anticipation et prédiction, **attention** (jetons : 4,8 → 3,4
  entités suivies de 8 m à 1 m, effet tunnel), **tromperie** (signal honnête / trompeur, inférence, `anticipation`
  qui retarde l'engagement), **communication** sans télépathie (fusion des messages comme observations à σ),
  coût et LOD, modes de défaillance.
- **Le test 1** (omniscience résiduelle : l'erreur sur le receveur choisi doit être non nulle, corrélée à l'âge de
  la croyance) et le **test 7** (invariance par permutation des indices).

## 2. Où en est le code

**Existant.** Le **scan** (250, scan.js) : saccades seedées, premier regard en vol 0,25-0,75 s ÷ scanF, cadence en
vol 0,4-0,6 /s, hors ballon toutes les 1,5-4 s, cible presseur / espace / coéquipier, règle de Jordet — consommé
par **un** effet (le corps ouvert sous `scan.corps`) ; la **politique de regard** de la scène (gaze.js, 65 % des
hors-ballon les yeux sur le ballon) qui nourrit la **latence de surprise** (rondo-sim : le défenseur surpris garde
l'ancienne cible le temps de sa réaction résiduelle, part hachée joueur × passe) ; la **réaction** de l'interception
(`interceptPoint` 0,18 s) ; les notes `vision`, `anticipation`, `scanning` comme **facteurs** (visionF sur le choix,
anticipF sur la ligne, scanF sur la cadence).

**Partiel.** L'architecture est **A** au sens du chapitre : chaque décision lit `st.players` (l'état vrai) ; le
bruit vient de la sortie (passSigma, dispersion, mordu) et des facteurs, jamais d'une croyance ; la latence existe
en deux endroits (surprise, interception) mais pas comme loi ex-gaussienne de chaque décision ; le regard existe
mais ne filtre rien.

**Absent.** Le cône à deux canaux, les niveaux d'information, la croyance datée par entité et sa croissance, le
repli sur l'ancre, la capacité d'attention, l'effet tunnel, la tromperie comme inférence, la communication comme
fusion, l'invariance par permutation (non prouvée), l'ablation (test 6).

## 3. Les tests de réfutation, un par un

| # | Cible (book) | Statut | Mesuré |
|---|---|---|---|
| 1 omniscience résiduelle | erreur non nulle, corrélée à l'âge | **réfuté par construction** : erreur 0, âge 0 |
| 2 cadence de balayage | 0,44 ± 0,30 ; 3,0 ± 2,1 par fenêtre | Bible 14 T1-T3 : **0,33 /s plat** (poste, pression, zone) |
| 3 effet du balayage sur la passe | OR 1,13 par + 0,1 /s ; pression 1,64 | sans objet (le scan ne touche que le corps ouvert) |
| 4 croissance de l'incertitude | 0,62 / 1,15 / 3,03 / 10,26 m | absent |
| 5 tromperie et `anticipation` | contre-pied décroissant, engagement retardé | absent (Bible 14 T16-T19) |
| 6 ablation de la communication | ≥ 15 % relatif | sans objet (pas de canal) |
| 7 invariance par permutation | hash identique | non prouvé — le jumeau d'empreinte ne permute pas |
| 8 charge attentionnelle | 4,8 → 3,4 entités | absent |
| 9 fusion des messages | | absent |
| 10 zones perceptives | `NONE` à > 40 m dos tourné | absent |

## 4. Les lots que la fiche appelle

1. **La couche de croyance** (tests 1, 4, 10 ; Bible 10 lot 1, 13 lot 1, 14 lot 1) : `view` par joueur — cône à
   deux canaux, Kalman scalaire par entité, niveaux d'information, repli sur l'ancre ; **les décisions lisent la
   croyance, jamais `st.players`** (le test d'import). C'est le lot qui fabrique l'intervalle, la fenêtre de
   renversement, le décalage entre lignes, le mauvais sens du défenseur.
   Le 262 — SCELLÉ 340 : `p.vue` par corps (croyance.js — les deux canaux, les niveaux, Kalman scalaire à 10 Hz, la
   croissance en τ⁴, le repli sur l'ancre), deux consommateurs (le passeur — avec le regard de passe —, le marqueur). Test 4
   tenu (la table de §2.2 et la croissance recalculées au banc) ; test 1 tenu à la fixture et, sans le regard de passe, en
   flux (0,36 / 0,81 / 2,83 / 5,65 m par âge, le σ cru la prédit) — avec le regard, l'erreur est le bruit d'observation
   (0,25 m) : la corrélation à l'âge reviendra en flux quand la DÉCISION lira la croyance (le test d'import, lot suivant).
   Le 266 (SCELLÉ 344) branche deux lecteurs de plus sur la croyance : le défenseur qui vise le ballon cru pendant un vol
   et le passeur qui projette les défenseurs crus dans sa course de refus.
2. **Le balayage comme prérequis de poste** (test 2 ; Bible 14) : cadence de rôle × attributs × pression × zone,
   durée log-normale, 0-3 entités rafraîchies — le scan 250 devient la source des observations.
3. **La latence ex-gaussienne par décision** (§5 ; Bible 13 test 8, Modèle 01 τ_p) : 0,22 s moyen, p90 0,32,
   généralisant la surprise du rondo.
4. **L'attention et la tromperie** (tests 5, 8) — après 1.
5. **La communication comme observation** (tests 6, 9 ; Bible 12 lot 2) — après 1.
6. **L'invariance par permutation** (test 7 ; Modèle 01 test 1) : une clause au banc.
