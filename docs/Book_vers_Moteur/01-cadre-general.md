# Bible 01 — Le cadre de lecture du jeu, contre le moteur

*Fiche du 9/09, moteur 767de25 (SCEAU 256). Mesures : 2 matchs de 90 min (graines 3, 7), monde par défaut.*

## 1. Ce que le chapitre demande

- **Six moments par équipe** (`ORG_OFF, TRANS_DEF, ORG_DEF, TRANS_OFF, SET_PIECE, LOOSE`), une machine à états par
  équipe, avec `LOOSE` au **premier rang** (le second ballon est le principal générateur de désordre des 22) ; la
  transition est une **fenêtre paramétrée par école** (`W_TRANS` ∈ [3 ; 10] s : González-Ródenas 3, City 5,
  Guardiola 6, Rangnick 8-10) qui se ferme à l'horloge OU sur 3 événements consécutifs OU quand le bloc est reformé
  (`shapeScore ≥ 0,75`) ; le curseur Denoueix `attackEndsOnRegain`.
- **Vingt sous-phases** (BU1/BU2/BU3/CRE/FIN/SETTLE/SWITCH/LONG ; PRESS_HIGH/MID_BLOCK/LOW_BLOCK/RECOVER/BOX_DEF/
  SECOND_PHASE/OFFSIDE_TRAP ; CATT_DIRECT/FAST_ATT/REBUILD/CPRESS/DROP ; 8 codes de balle arrêtée), en vocabulaire Opta
  (séquence ≠ possession, direct speed, high turnover à 40 m, PPDA à 60 ou 66,7 %).
- **Huit référentiels de décision** (ballon, adversaire, partenaire, espace, ligne, but, consigne, score/temps) avec un
  coût cognitif chacun ; en défense un **simplexe à quatre écoles** (POSITION / MAN / SPACE / BALL) sur les mêmes termes
  d'utilité ; **la distance d'intervention** comme seule grandeur partagée par les écoles : **10-15 m en bloc médian,
  ≈ 6 m en bloc bas** (Gourcuff), fonction de la puissance du joueur ; un budget de décision qui se **réduit** dans le
  dernier tiers ; une hystérésis de référentiel (`T_lock ≈ 0,45 s`).
- **La boucle perception → décision → exécution** avec ses durées : chaîne visuomotrice 235 ms chez l'athlète, latence
  totale d'un joueur frais dans [0,24 ; 0,55] s, scan 0,44/s (élite 0,61-0,83) qui **s'effondre sous pression**
  (ratio 0,67, plateau à 4 m) ; un `PlayerBelief` daté par joueur (personne ne voit l'état vrai) ; l'action engagée
  (verrou moteur pendant l'exécution).
- **Cinq échelles de temps** (frame 25-100 Hz, action, séquence, bloc de jeu, match) et un **ordonnancement** : la
  perception par joueur à sa cadence, la décision à `T_DEC = 0,45 s` **déphasée** par joueur (`offset_i = 137·i mod
  450 ms`, écart-type ≥ 120 ms sinon « banc de poissons »), l'unité à 4 Hz, l'équipe à 1 Hz, le staff à 0,05 Hz.
- **L'intention d'équipe** publiée à 1 Hz (`TeamIntent` : hauteur, compacité, distance d'intervention, intensité
  étalonnée sur le PPDA, déclencheurs, côté, couloirs, rest defense, appétit de risque, simplexe défensif) que le joueur
  **ajoute** à son utilité avec une confiance dégradée par la fraîcheur et la discipline — jamais suivie aveuglément.
- **Le profil locomoteur** : `V_MAX` atteinte vers **50 m**, 30 m en **4,0 s** départ arrêté, accélérations ≥ 3 m/s²
  40-75 par match.

## 2. Où en est le code

**Existant.** Les moments : `phases.momentDuJeu(st, team, win)` rend `attaque-placée / défense-placée /
transition-off / transition-def / arrêt` — quatre moments plus l'arrêt, **par équipe**, sur une fenêtre `win`
(5 s par défaut, un paramètre d'appel — les lois qui l'appellent passent 5 ; le contre-press 229 a sa propre horloge
`cfg.contrePress.dur` 6 s, les zones de contre 242 `win` 10 s). Le ballon libre existe (`st.phase = 'loose'`, 21
sites) mais comme **état du ballon**, pas comme moment d'équipe. Les balles arrêtées sont `st.restart` (type, équipe,
zone implicite). Le simplexe défensif est un **axe à deux écoles** (`tactics.marquage` 0 zone ↔ 1 homme, lot 96 : le
rayon de suivi et la bande de 6 m) — POSITION et SPACE n'ont pas de curseur. Les référentiels vivent dans les lois
sans être nommés : ballon (jockey 95, contain 78, ombre 42), adversaire (marquage 51b/225/252), partenaire (soutien
103, offre 241b, troisième homme), espace (couloirs 241, craie 249b), ligne (Loi 11 149/186), but (menace), consigne
(les axes tactiques lus en continu + coach.js 113 qui les déplace par paliers de ~20 s = le staff à 0,05 Hz), score/
temps (coach.js, mentalité). L'hystérésis existe par loi : `assignTenue` (135 : slot 1,2 s, marquage 1,6 s), couloirs
`tenue` 2 s, craie `tenue` 6 s, passation 0,6 s. L'intention d'équipe : la fenêtre de pressing `st._press`
(pressTriggers), la fixation `st._fix`, la meute du contre-press, le bloc chaîné au ballon (42) et sa compression
(162), la hauteur/compacité/largeur en axes. Les « tokens » : `byDist` (i = 0 presseur, 1 couverture, 2-5 marqueurs,
≥ 6 bloc) est un marché d'enchères implicite par distance. La perception : le laps d'attention (246c), le scan (250,
horloge sans effet de jeu), le départ vu (155), les lectures (`anticipF` sur la fenêtre 204, `couvert.lecture`
246b). La latence : `pressLead.delai` 0,25 × (2 − anticipF) pour le presseur ; les bursts et `_pace` sont des
engagements ; `holdMax` borne la tenue. Locomotion : `accel` 7,5 m/s², `sprintMax` 8,0, allures 57 (marche 2,1,
trot 3,4-3,9) ; le profil vitesse-distance est un plafond dur.

**Partiel.** La fenêtre de transition est un nombre d'appel, pas une école ; aucune fin par « bloc reformé » ni par
événements ; pas de curseur Denoueix. Les sous-phases n'existent que par les zones que chaque loi lit (salida 191,
tiers, x du bloc) — pas de classificateur commun, donc pas de vocabulaire Opta (séquence, direct speed, high
turnover) dans le journal. La réduction du budget de décision dans le dernier tiers : implicite (shotRange, menace),
pas de `nOptions`. La confiance/compliance à la consigne : absente (les axes sont suivis à 100 %). La cadence de
décision par joueur existe (0,7 s slot, 0,5/0,35 marquage, 0,25 lecture) avec un déphasage **naturel** (chaque joueur
porte sa propre échéance) mais non conçu.

**Absent.** `LOOSE` comme moment d'équipe avec ses comportements ; `PlayerBelief` (les cerveaux lisent les vraies
positions : toute erreur est une erreur de vitesse, jamais de lecture — le chapitre 04 du modèle le reprend) ; la
latence de décision générale ; les écoles POSITION et SPACE ; le PPDA comme grandeur journalisée ; `shapeScore`.

**Différence d'architecture à nommer.** Le moteur n'a pas d'utilité additive (`argmax` sur une somme pondérée) : chaque
loi décide dans son ordre, avec ses portes. Le simplexe « quatre jeux de poids sur les mêmes termes » n'est donc pas
transposable tel quel ; ce qui l'est, c'est **l'effet observable par école** (T14 : ratio duels/interceptions), et
c'est ce qu'il faut viser.

## 3. Les tests de réfutation, un par un

| # | Cible (book) | Statut | Mesuré (2 × 90 min) |
|---|---|---|---|
| T1 temps de ballon en jeu | 3 419 s ±10 % | mesurable | **4 551 s** — trop de jeu : les arrêts manquent (16 touches, 6 corners, 8 sorties de but par match c. 45/10/15 — la dette 249b) |
| T2-T5 séquences (durée 15,7 s, 5,1 passes, 12,5 m, direct speed 1,4-2,1) | Opta | **absent** : pas de classificateur de séquence dans le journal — à construire avant de mesurer |
| T6 possession individuelle | ≈ 1,1 s ±0,25 | mesurable | **0,66 s moyenne, p50 0,43** — trop court : les touches d'une seconde (une-touche 340/90, 240 remise) ; T6b contrôle total 78 s/joueur ✓ (81 ±73) mais **2 596 intervalles/match** c. 836 : trois fois trop de possessions, chacune trois fois trop courte |
| T7 possessions / joueur / 10 min | 13,3 ; CM 16,5, DC 15,5, LAT 14,8, AIL 11,9, CF 10,1, GK 9,8 | mesurable | **DC 7,8, LAT 15,0, M 20,2, MC 19,1, AIL 19,8, CF 23,4, GK 2,8** — le ballon vit avec les attaquants (CF ×2,3) et fuit les centraux (÷2) et le gardien (÷3,5) : **pas de sortie de balle par derrière** |
| T8 scan 0,44/s, chute sous pression ratio 0,67 | | loi existante (250), **cible fausse** : 0,73 scan/s de vol, aucune chute sous pression (ratio 1,0) |
| T9-T9b high turnovers → tir | 10,7-21,3 % | absent (Opta) |
| T10 part du temps en transition | 15-30 % `[A CALIBRER]` | mesurable | **41 %** à W = 6 s — les changements de possession sont trop fréquents (voir T11) |
| T11 bascules de moment / match / équipe | 90-160 `[A CALIBRER]` | mesurable | **900** — six fois trop : chaque ballon libre bascule les deux équipes ; sans `LOOSE` ni hystérésis de moment la machine oscille (c'est exactement ce que le test prédit) |
| T12 distance d'intervention | 10-15 m médian, ≈ 6 m bas | mesurable, **loi existante, cible fausse** | **3,2 m en bloc médian, 2,2 m près du but** — les défenseurs du moteur sont AU CONTACT du porteur (jockey 1,0 m, marquage 1,4 m, zone rouge 192) : c'est le « défenseur à 1,7 m » du retour aval, et ça dit que le bloc ne défend pas à distance |
| T13 départ de séquence 39,5-46,2 m | Opta | absent |
| T14 signature BALL c. MAN (ratio duels/interceptions ±35 %) | | partiel : l'axe marquage existe, jamais mesuré sur cette signature |
| T15 écart-type des instants de re-décision | ≥ 120 ms | à re-mesurer (la sonde exigeait 6 joueurs par fenêtre de 1 s) — le déphasage existe par construction |
| T16 latence intention → 8 joueurs sur 11 | 0,3-0,8 s | mesurable (la fenêtre de pressing) — à mesurer |
| T17 faux 9 contre POSITION / MAN | | absent (pas d'école POSITION) |
| T18 accélérations ≥ 3 m/s² | 40-75 / match | mesurable — à mesurer |
| T19 curseur Denoueix | | absent |
| T20 latence de décision totale | [0,24 ; 0,55] s | **absent** (0 pour tous sauf le presseur 0,21-0,29) |
| T21 PPDA | 7,3 → 17 | mesurable (approx. : passes hors tiers / duels+tacles) | **8,7** — un monde qui presse comme le plus pressant de la ligue, par défaut |
| T22 sprint 30 m en 4,0 s, `V_MAX` vers 50 m | | **loi existante, cible fausse** : accel 7,5 et sprintMax 8,0 → 30 m en ≈ 4,3 s ✓ mais `V_MAX` atteinte à ≈ 4 m : toutes les courses de rattrapage sont fausses |

## 4. Les lots que la fiche appelle

1. **La distance d'intervention** (T12) — la grandeur commune aux quatre écoles, 10-15 m en bloc médian, 6 m en bloc bas,
   × la puissance du joueur : le défenseur du moteur colle à 3 m. C'est un lot de défense qui touche jockey, marquage,
   zone rouge et la bande ; il se mesure au ratio duels/interceptions (T14) et il donne enfin au placement défensif
   « quelque chose à peser » (retour aval B). Après 258.
2. **`LOOSE` au premier rang et l'hystérésis de moment** (T10, T11) — avant le second ballon (Bible 15).
3. **La sortie de balle par les centraux** (T7) — DC ÷2, CF ×2,3 : le ballon ne part pas de derrière (Bible 03, salida).
4. **Les possessions trop courtes** (T6) — 0,66 s c. 1,1 : la une-touche à 340/90 et la remise systématique (211 avait
   relevé la tenue calme à 2,2 s ; la moyenne dit autre chose : mesurer par sous-phase).
5. **La fenêtre de transition comme école** (`W_TRANS` 3-10, fin par horloge / événements / bloc reformé, Denoueix).
6. **Le profil locomoteur** (T22) — `V_MAX` à 50 m, pas à 4 : une courbe vitesse-distance (Modèle 02).
7. **Le journal en vocabulaire Opta** (T2-T5, T9, T13, T21) — le classificateur de séquence, à mettre dans le chantier B.
8. **La perception non omnisciente et la latence** (T8, T20) — la campagne du Modèle 04, pas un lot.
