# Bible 08 — Ailiers et attaquants excentrés, contre le moteur

*Fiche du 9/09, moteur 767de25 (SCEAU 256). Mesures : 2 matchs de 90 min (graines 3, 7) en 4-3-3, ailiers = AM(G) et
AM(D).*

## 1. Ce que le chapitre demande

- **La largeur tenue** : `dyT` (distance à la touche) de l'ailier côté ballon **0,5-2 m** en sortie basse, 1-3 m en
  progression ; l'opposé à 8-16 m ; deux relations non négociables (`dyT` côté ballon < opposé ; la largeur d'équipe
  41-47 m de moyenne, P90 ≥ 58, P10 ≤ 34) ; l'arbre ordonné de la rentrée (rupture, relais, finition…) ; qui possède
  la largeur (ailier / latéral) ; le coût perceptif de la craie ; la défense à cinq.
- **Cinq courses** (profondeur extérieure, intérieure, soutien en L, décrochage, contre-appel à trois appuis) avec
  déclencheurs et la contrainte du hors-jeu.
- **Le un-contre-un** : 4,3 ±3,7 dribbles par match, 40-50 % de réussite, corrélation vitesse-réussite négative, AUC
  0,65-0,75 (un moteur qui prédit mieux triche), intérieur/extérieur en table, le dribble raté.
- **L'ailier opposé** : sa position se calcule (au second poteau il faut partir de `dyT` 10-18 m, 0,3-0,8 s avant la
  frappe) ; l'attaquant intérieur et la loi de conservation avec le latéral.
- **Le repli** : trois écoles chiffrées (A 46-58 m par cycle, C 0-20), surcoût A − C 320-640 m par match, 3-6 % du
  volume — le devoir de repli ne doit pas être un curseur de « courage » qui double le kilométrage.
- **Le pressing** : déclenché à la passe vers le latéral adverse (0-0,25 s), la course **arquée** (1,05-1,12 × la
  corde), l'orientation extérieure / intérieure ; **la touche** (35-45 par match) et les cinq rôles de l'ailier dessus.
- **Fatigue** : −15 % de distance et −19 % de HIR au dernier quart d'heure, −2 à −5 % de vitesse de pointe.

## 2. Où en est le code

**Existant.** La craie et son ancre (177/178/249b : une chaise tenue par côté, l'élection au rôle), le dédoublement
(88), le répertoire de courses de l'ailier (125 : déborde / banane / croise, `courseAilier`), l'appel et le contre-
appel (41, 144), le dribble comme rôle, lieu et cadence (219 : volume 0,30, aile > axe), les gestes (râteau,
passement, semelle — 118/142), le duel dribble c. tackling (152), le centre et la patte (34/87/100), le cutback
(`bas`), le repli par rôle (251 : le marchant exempté, l'interdit), le pressing par le couloir (42 `coverShadow`),
l'orientation vers le pied faible (196), la touche (A9 `remisesMain`), la fatigue globale (31).

**Partiel.** La craie est tenue par UN ancré par côté (249b) : l'ailier côté ballon dérive vers le ballon (test 2 :
11 m de sa touche en sortie basse) et l'opposé est plus près de sa ligne que lui (test 3 inversé) — la table des
`dyT` par phase n'existe pas ; le second poteau n'est pas calculé (test 10 : 3 %) ; le dribble est trois fois trop
fréquent et deux fois moins réussi ; la course de pressing est droite ; la touche existe sans rôles de plan.

**Absent.** L'arbre de rentrée, la loi de conservation ailier/latéral, l'école de repli en surcoût borné, la fatigue
par quart d'heure, l'apprentissage intra-match du défenseur.

## 3. Les tests de réfutation, un par un

| # | Cible (book) | Statut | Mesuré (2 × 90 min) |
|---|---|---|---|
| 1 largeur d'équipe en possession | 41-47 m ; P10 ≤ 34, P90 ≥ 58 | mesurable | **48,5 m**, P10 36,1, P90 61,2 — un peu large, la distribution est là |
| 2 `dyT` ailier côté ballon, sortie basse | 1-2,5 m (> 6 dérive) | mesurable, **réfuté** | **11,2 m** — il dérive vers le ballon |
| 3 opposé − côté ballon | +8 à +16 m | mesurable, **inversé** | **−4,2 m** |
| 4 ≥ 3 à 18 m du ballon au couloir haut | ≥ 70 % | mesurable | **85 %** ✓ |
| 5-6 dribbles par ailier ; réussite | 4,3 ±3,7 ; 40-50 % | mesurable, **réfuté** | **14,4** / match, **20 %** gardés à +1,5 s (219 avait mesuré 58 → 28 dribbles vrais / 30 min ; ici les gestes `skill`, définition large) |
| 7-9 vitesse × réussite, AUC, réussite selon `dyT` | | à instrumenter (l'issue du duel dans le journal) |
| 10 ailier opposé au second poteau à la frappe | ≥ 60 % | mesurable, **réfuté** | **3 %** |
| 11 départ de l'opposé 0,3-0,8 s avant la frappe | | absent |
| 12-13 centres par ailier ; complétion / conversion | 3,8 ; 23 % / 1,8 % | mesurable | **6,4** par ailier ; 58 % / 4,3 % (ch. 04) |
| 14 cutbacks | 1,5 ±0,8 | mesurable | **1,8** ✓ |
| 15 distance | 10,0-10,9 km | mesurable, **réfuté** | **17,9 km** |
| 16 école de repli A c. C | +320-640 m | mesurable (251 : wide_creator c. tracking_winger) — à mesurer en mètres |
| 17 sprints > 7 m/s | 13 ±5 | mesurable, **réfuté** | **217** par ailier — les bursts sans budget (ch. 07 T5) |
| 18-19 fatigue par quart d'heure | −15 % / −19 % ; vitesse −2 à −5 % | mesurable (31) — à mesurer |
| 20 `pressShowDirection` | −20 à −40 % de ballons reçus | loi existante (196) — à mesurer |
| 21 délai de pressing sur passe au latéral | 0-0,25 s | mesurable | **0,27 s** ✓ (borne) |
| 22 course arquée 1,05-1,12 | | absent (course droite) — à mesurer |
| 23 deux à `dyT` < 4 m | < 3 % | mesurable | **0 %** ✓ (la chaise unique) |
| 24 apprentissage intra-match | | absent |
| 25 entrée en repli ≤ 0,5 s | ≥ 90 % | mesurable — à mesurer (repli 221/251 : delai 0,4 × (2 − workF)) |
| 26 contre une ligne de 5 | | mesurable (532) — à mesurer |
| 27 touches par match | 35-45 | mesuré au 249b | **16-19** (la sonde de cette fiche les a manquées : à corriger) |

## 4. Les lots que la fiche appelle

1. **`dyT` par phase et la loi de conservation** (2, 3, 10) : l'ailier côté ballon à la craie en sortie basse, l'opposé
   à 8-16 m puis au second poteau à la frappe — le 249b tenait UNE chaise par côté ; la table du chapitre est la
   suite, et elle conditionne le centre (ch. 04).
2. **Le dribble à sa fréquence** (5-6) : 14 tentatives à 20 % ; le 219 avait la cadence, il manque l'économie du geste
   (4-6 par match, 40-50 %) et l'issue dans le journal.
3. **Le sprint a un budget** (15, 17) — le même lot que ch. 07.
4. **La course de pressing arquée et le déclenchement à `ballReleased`** (21-22) — avec le cadrage des latéraux (ch. 04).
5. **Les rôles de touche** (27) — après la touche qui existe assez (249b : 16-19 c. 35-45).
