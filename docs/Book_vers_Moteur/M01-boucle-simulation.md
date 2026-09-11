# Modèle 01 — La boucle de simulation, contre le moteur

*Fiche du 9/09, moteur fbc9369 (SCEAU 256). Mesures : 4 × 600 s à dt 1/60 et 1/30 (graines 3, 7, 11, 13). Mise à jour au 263 (le pas de décision séparé).*

## 1. Ce que le chapitre demande

- **Un pas de décision à 10 Hz** (Δt_dec 0,10 s) et un **sous-pas physique du ballon** à 0,02 s (K = 5), la phase
  arrêtée à 2 Hz ; **latence de perception** τ_p 0,25 s et bruit σ_p 0,8 m à 20 m lus par un anneau de snapshots
  (le bloc lit une copie datée, jamais l'état courant) ; hystérésis d'intention 0,15, engagement 0,5 s, softmax T 0,25.
- **Architecture du tick** : phases nommées, double tampon (aucune phase ne lit un état déjà mis à jour au même
  tick), simultanéité par construction — d'où le **test 1** (invariance par permutation de l'ordre des agents).
- **Déterminisme et rejouabilité** : flux RNG nommés et indépendants (`RngStream.PassError`, `ShotError`,
  `DuelOutcome`…), transcendantes tabulées, hachage d'état périodique, rejeu bit à bit multi-plateforme.
- **Niveaux de détail** (LOD0 22 agents, LOD1 chaîne de Markov à 192 zones, promotion mi-match), **budget** 52 µs
  par tick (2 s par match), zéro allocation dans la boucle chaude, **gestion du temps de jeu** (fraction en jeu
  0,547, arrêts 45 min 35 s, temps additionnel ≈ 700 s), modes de défaillance.
- **Insensibilité au pas** : D_KS < 0,03 entre Δt 0,05 et 0,10 sur buts, tirs, passes, possessions.

## 2. Où en est le code

**Existant.** `matchStep(st, dt, cfg)` à **60 Hz** (dt 1/60, `playMatch`) : contre-tir, jambe tendue, arbitre, puis
`rondoStep` (assignation, latence de surprise, locomotion, ballon) ; le ballon **sous-pas** à un demi-rayon par pas
(`stepBall`) ; le RNG **seedé** (`mulberry32`, `xmur3`, `subRng(master, name)` : flux nommés pour les styles
d'animation ; `st.rnd`, `st.rnd2` pour la partie) — jamais `Math.random` hors particules de la scène ; le **jumeau
d'empreinte** (hash des positions, du score et du nombre d'événements : le contrat du sceau) ; le **chrono**
(périodes, pause, temps additionnel `min(12 % de la durée, 0,35 × arrêts)`), les cérémonies (217) ; `checkBallBody`,
`temporal-validate`, `match-check` comme contrats ; la carrière (`career.js`) comme enveloppe.

**Partiel.** ~~Le pas est **un seul pas** (décision, locomotion, ballon au même 60 Hz — pas de Δt_dec distinct)~~ → **263** :
`cadence.js`, le cerveau aux ticks de 0,1 s, le corps / ballon / gestes / arbitre au pas physique, l'intention adoptée au tick
et exécutée à la porte du ballon au pied, les constantes en images dites en secondes (`hzDecision`) ; la
latence existe par endroits (surprise, interception) sans anneau de snapshots ; le RNG est un flux **séquentiel
partagé** par partie (un tirage ajouté décale tout — le test 8 échouerait par construction) ; le déterminisme est
prouvé sur Node seulement ; ~~des constantes sont **câblées au pas** (`1 − exp(−(1/60)/0,35)` dans match-sim, les
seuils de frames) — d'où l'échec du test 3~~ (dites en secondes au 263 par `hzDecision`).

**Absent.** Le double tampon et l'invariance d'ordre (test 1), les flux RNG nommés par sous-système, les LOD
(pas de LOD1, pas de promotion), le budget (251 µs par tick, 5 × la cible à 10 Hz — 130 s par match à 60 Hz), le temps
de jeu réel (fraction 0,83).

## 3. Les tests de réfutation, un par un

| # | Cible (book) | Statut | Mesuré |
|---|---|---|---|
| 1 invariance par permutation | hash identique | non prouvé (pas de permutation possible sans code) |
| 2 rejeu multi-plateforme | hash identique | Node seulement (jumeau d'empreinte) |
| 3 insensibilité au pas | D_KS < 0,03, moyenne < 5 % | mesurable, ~~réfuté~~ → **263 : non réfuté** | avant : dt 1/60 **40,5 tirs / 90**, dt 1/30 **22,5**, D_KS(possession) **0,173** ; au 263 (sonde-263, 8 × 45 min, pas physique 1/60) : dec 0,05 → 0,10 : 35,3 → 37,0 tirs, 1 039 → 997 passes, 63,6 → 65,2 % conservées, **D_KS(possession d'équipe) 0,034** (bruit 0,052 à n ≈ 1 340), moyennes −4,0 / +5,0 % (les buts 6,3 → 3,8 dans les petits nombres) ; le pas PHYSIQUE reste sensible (1/60 → 1/30 : 980 → 1 150 passes — le contact par image) |
| 4 spectre des accélérations | | à faire sur tracking |
| 5 autocorrélation des vitesses | écart < 0,05 au tracking | mesurable | 0,99 / 0,96 / 0,84 / 0,62 / 0,32 à 0,1 / 0,2 / 0,5 / 1 / 2 s — à confronter |
| 6 sensibilité à la perception | pente monotone | sans objet (τ_p, σ_p absents) |
| 7 cohérence inter-LOD | | absent (un seul LOD) |
| 8 neutralité du flux RNG | D_KS < 0,01 | **réfuté par construction** (flux séquentiel partagé) |
| 9 budget CPU | p50 < 40 µs, p99 < 120 | mesurable, **réfuté** | p50 **251 µs**, p99 **2 492 µs** (60 Hz : 130 s par match) ; au 262 p50 436 ; au 263 (le cerveau à 10 Hz) **p50 192 µs**, p99 2 267 (121 s par match) — le corps à 60 Hz coûte le reste |
| 10 conservation du temps | identité dure ; fraction 0,547 | mesurable, **partiel** | 1 997 + 403 = 2 400 ✓ ; fraction **0,832** |
| 11 bornage aérodynamique | | tenu par `checkBallFlight` (énergie, tunnel) |
| 12 promotion mi-match | | absent |

## 4. Les lots que la fiche appelle

1. **Le pas de décision séparé du pas physique** (test 3) : Δt_dec 0,10 s, K sous-pas ballon, et l'inventaire des
   constantes câblées au 60 Hz (`exp(−(1/60)/τ)`, seuils de frames) réécrites en secondes — sans quoi le moteur
   ment sur la précision de tout ce qu'il mesure. → **SCELLÉ 263** (`cadence.js`, `cfg.cadence`, NOTES 341) : l'inventaire
   a trouvé trois constantes (l'EMA de la poussée, le tour, le vol mort à 18 images), le K du ballon était déjà tenu
   (`stepBall` : ≤ ½ rayon par sous-pas) ; la porte d'exécution (choisir au tick, exécuter au ballon au pied) est la
   découverte du lot ; le gardien, les remises et l'administration restent au pas physique (le gardien au tick : 2 buts de
   plus par match). Reste nommé : le contact balayé (le pas physique reste sensible), les tirs de loin sous la cadence.
2. **Les flux RNG nommés** (test 8) : `subRng` par sous-système (passe, tir, duel, perception, arbitre) ; un tirage
   ajouté ne déplace plus le monde.
3. **Le double tampon et l'invariance d'ordre** (test 1 ; Modèle 04 test 7) : une clause au banc qui permute.
4. **Le budget** (test 9) : 251 → 52 µs — grille spatiale, zéro allocation, décision à 10 Hz ; c'est la condition
   de la saison simulée.
5. **Le temps de jeu** (test 10 ; Bible 14, 16) : fraction 0,83 → 0,547.
6. **Le LOD1** (tests 7, 12 ; chantier A du Plan) — après 1 et 4.
