# Bible 16 — Le contexte de match, contre le moteur

*Fiche du 9/09, moteur 5b10d6b (SCEAU 256). Mesures : 2 matchs de 90 min (graines 3, 7), 4-3-3 contre 4-3-3. Les tests sur les buts (T1, T2) demandent des centaines de matchs : indicatifs ici.*

## 1. Ce que le chapitre demande

- **Un vecteur de contexte** (`MatchContext` : score, minute, temps additionnel attendu, effectifs, lieu, public,
  enjeu, momentum, météo) que **une seule couche de modulateurs** compose (neuf sources pondérées, saturation
  douce, anti-cumul) — jamais des règles éparses.
- **L'effet du score** : multiplicateurs comportementaux (mener × 0,57-0,91 de tirs, être mené × 1,11-1,43 ; à dix
  × 0,53-0,59 ; à onze contre dix × 1,33), sept phases de statut pour la course (D→W 123 m/min, W→D 105).
- **L'effet du temps** : 22-25 % des buts après la 76ᵉ, rapport 1,6-1,9 avec le premier quart d'heure ; le jeu
  effectif 66 → 56 %.
- **Trois fatigues** : mécanique (−14 % de distance nominal, −6,6 effectif, plateau final = pacing), technique
  (le volume −30 %, pas la qualité), cognitive (le CV du temps de décision +34 %).
- **Supériorité / infériorité** asymétriques ; **domicile** (0,35-0,45 point, dont ≈ 20 % par l'arbitre, huis clos
  0,20-0,25) ; **enjeu** (variance, pas biais) ; **fin de match** comme machine à états (`MANAGE / CHASE / ALL_IN /
  PARK`), remplacements ; **momentum** sans superstition ; **météo et terrain**.
- **Enveloppe physique** : 108,1 ± 3,6 km par équipe, 9,0 km > 20 km/h, 2,3 km > 25 km/h ; pointe −2 à −5 % en fin
  de match ; passes tentées −12 à −20 % ; temps additionnel ≥ +60 s quand l'écart ≤ 1.

## 2. Où en est le code

**Existant.** Le **coach** (149, 175, coach.js : posture base / pousse / gère selon score × urgence du chrono, l'orage
= ≥ 3 tirs subis dans la fenêtre → un cran de recul, `each` 20 s), l'axe **mentalité** (149, 185-186 : mentalité
du tir et du choix), la **fatigue** (31 : `stam` drainé par l'effort au carré, la pointe plie × cap 0,15, la pause
rend 0,25, l'entrant naît frais, `stamF`), le **chrono** (temps additionnel calculé, mi-temps, `temps-additionnel`
événement), les **remplacements** (Loi 3), les **cérémonies** contextuelles (217 : celui qui mène traîne), la Loi 12.

**Partiel.** Le score module par **posture** (deux crans) et non par multiplicateurs mesurés — et dans le mauvais
sens (le menant tire × 1,30 de l'égalité, réel 0,57-0,91 ; le mené × 2,39, réel 1,11-1,43) ; la fatigue est **une**
variable qui plie la pointe (−14 % de vitesse de pointe, réel −2 à −5) et fait s'effondrer le sprint (−66 %, réel
−28 nominal / −14 effectif) sans toucher ni la compacité (ch. 10 T13) ni le volume technique ni la variance de
décision ; le temps additionnel est **constant** (161 s / 157 s quel que soit l'écart) ; le jeu effectif ne dérive
pas (84 → 85 %).

**Absent.** `MatchContext` et la couche de modulateurs ; les sept phases de statut ; les trois fatigues séparées
(technique en volume, cognitive en variance) ; l'infériorité numérique comme dynamique (le rouge expulse mais la
formation à 10 est une dette nommée) ; domicile / public / arbitre biaisé ; l'enjeu ; la machine `EndgameMode` (le
coach en approche) ; le momentum mesuré ; la météo et le terrain.

## 3. Les tests de réfutation, un par un

| # | Cible (book) | Statut | Mesuré (2 × 90 min, indicatif pour les buts) |
|---|---|---|---|
| T1-T2 buts 76-90 | 22-25 %, rapport 1,6-1,9 | indicatif | 2/2/1/3/3/1 (12 buts) : 8 %, rapport 0,5 |
| T3-T4 course par phase de statut | HI 7,3 c. 10,8 ; étendue 18 m/min | à instrumenter (pas de phases de statut) |
| T5 tirs mené / égalité | 1,11-1,43 | mesurable, **surjoué** | **2,39** |
| T6 tirs menant / égalité | 0,57-0,91 | mesurable, **inversé** | **1,30** |
| T7-T9 à dix | 0,53-0,59 ; 1,33 ; −30 % | à mesurer (1 rouge par match mesuré au ch. 15, mais la formation à 10 est une dette) |
| T10 jeu effectif Q1 → Q6 | 66 → 56 % | mesurable, **réfuté** | **84 → 85 %** |
| T11 distance Q6 / Q1 | −21 nominal / −6,6 effectif | mesurable | **−7 %** (le match n'a presque pas de temps mort : lire comme effectif ✓) |
| T12b sprint Q6 / Q1 | −27,6 / −13,6 % | mesurable, **excessif** | **−66 %** |
| T13 distance par équipe | 108,1 ± 3,6 km | mesurable, **réfuté** | **165 km** (10 de champ, sans gardien) |
| T14 > 20 / > 25 km/h | 9,0 / 2,3 km | mesurable, **réfuté** | **37,9 / 8,3 km** — quatre fois trop d'intensité |
| T15 pointe Q6 / Q1 | −2 à −5 % | mesurable, **excessif** | **−14 %** (cap 0,15 × (1 − stam)) |
| T16-T17 passes réussies / tentées | −1 à −3 pts / −12 à −20 % | tentées **−7 %** ; réussies à instrumenter |
| T18 variance du temps de décision | +34 % CV | absent (pas de temps de décision) |
| T19 désynchronisation 85' c. 20' | +0,4-0,7 s | mesurable en mètres : 10,8 → 10,9 — plate, mais déjà cassée (ch. 03) |
| T20-T22 domicile, public, arbitre | 0,35-0,45 / 0,20-0,25 / 20 % | absents |
| T23 temps additionnel selon l'écart | ≥ +60 s si écart ≤ 1 | mesurable, **réfuté** | **161 s / 157 s** |

## 4. Les lots que la fiche appelle

1. **Le profil locomoteur et le budget** (T12b-T15, T13-T14 ; le constat n° 1 des Bibles 01-09) : 165 km par équipe,
   38 km à haute intensité — le sprint a un prix et un plateau (pacing), la pointe ne plie que de 2-5 %.
2. **La couche de contexte** (T5, T6, T3-T4) : `MatchContext` + modulateurs composés ; le score par multiplicateurs
   mesurés (le menant tire **moins**), les sept phases de statut pour la course.
   Le 261 — SCELLÉ 339 — tient le postulat du chapitre : l'intention d'effort (effort.js) ne lit ni le score ni la minute,
   elle lit les axes (pressing, marquage, transition) que le coach déplace ; le repli n'est un sprint qu'en transition.
3. **Les trois fatigues** (T10, T16-T18 ; ch. 10 T13, ch. 12 T3) : mécanique (volume), technique (le nombre de
   passes, pas leur qualité), cognitive (la variance du temps de décision) — et la compacité qui se relâche.
4. **Le temps du match** (T10, T23 ; ch. 14 lot 3) : le jeu effectif qui dérive, le temps additionnel qui lit le
   contexte, les cérémonies dans la bande.
5. **L'infériorité et le lieu** (T7-T9, T20-T22) : la formation à dix (dette nommée), domicile / public / arbitre
   comme facteurs séparés.
