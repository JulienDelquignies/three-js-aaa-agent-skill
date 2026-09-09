# Bible 04 — Latéraux et pistons, contre le moteur

*Fiche du 9/09, moteur 767de25 (SCEAU 256). Mesures : 2 matchs de 90 min (graines 3, 7), monde par défaut.*

## 1. Ce que le chapitre demande

- **Côté ballon, en défense** : le cadrage déclenché à `ballReleased` (pas à l'arrivée), `d_engage` paramètre
  d'école [1,8 ; 4,6] m selon la réception de l'ailier ; l'angle de fermeture (dehors / dedans, un désaccord
  d'école) ; **la règle 1+3** (au plus un sortant dans la ligne, verrou d'unité, coût de sortie avec pénalité
  latéral) ; le rayon d'intervention **attribut du joueur** (10-15 m) qui borne la maille de la ligne ; le duel et la
  ligne plancher ; `MATCH_RUN`, l'accompagnement épaule contre épaule de l'appel dans le dos.
- **Côté faible** : rentrer dans l'axe (`k_narrow` 0,3-0,75 : 17-27 m de sa touche selon le bloc, 5-11 m de son
  central) au prix d'une largeur concédée (16-26 m) ; le re-coulissement sur renversement calculé avec un profil
  **mono-exponentiel** (`τ ≈ 0,8 s`, vmax 8-9,5) et un déficit de 6-10 m ; le second poteau sur centre.
- **La montée** : un arbre ordonné (vetos rest defense, latéral opposé haut, score, fatigue locale ; puis overlap /
  underlap / largeur / soutien), l'overlap probabiliste conditionné (pied de l'ailier, intervalle adverse, demi-espace
  occupé) ; le latéral qui donne la largeur ; le latéral inversé avec compensateur de largeur.
- **Le centre** : typologie, zone préférentielle comme objet de première classe, ≈ 11 centres du jeu par équipe,
  20-24 % de réussite, 1,1-1,8 % de but par centre, le cutback (1,56 par match) 3-5 × plus rentable.
- **Rest defense** : 4 (Dall'Oglio) ou 5 (2-3 / 3-2), la géométrie du latéral bloqué (12-18 m de son central), la
  hauteur combinée des deux latéraux bornée (**corrélation négative**), le contre-marquage.
- **Le piston** à cinq (+5 à +12 m d'amplitude), la fatigue **locale** d'un côté, les signatures individuelles.

## 2. Où en est le code

**Existant.** Le dédoublement (88 `deborde`, rôle `deborde`, interdit `deborde` 248 : le latéral inversé ne
déborde pas) ; la craie et l'ancre par côté (177/178/249b : l'ancre s'élit au rôle — l'ailier meneur cède la craie
au latéral qui monte, § 4.4) ; les couloirs (241 : deux corps par couloir, le demi-espace) ; le centre (34 `tryCross`,
87 patte, 100 sigma du centreur, 147 `crossF`, le **cutback** existe : `bas` sur le centre) ; le marquage sur centre
(133) et de surface (225) ; le bloc chaîné au ballon et son latéral (42 `bloc.lateral` 0,35, `rentre` 9 : le côté
faible rentre) ; l'orientation vers le pied faible (196 `orienteFaible` = `showDirection`) ; le pied fort (147, 100) ;
la fatigue globale (31 `stam`) ; les pistons par formation (352, 532, 3421) ; l'oblique de sortie (237/245) et la
bande (96) — la règle 1+3 **est là par construction** (un presseur, les autres en bande : test 14 à 0 %).

**Partiel.** Le cadrage part quand le ballon est là (jockey 95 sur le porteur), pas à `ballReleased` ; `d_engage`
n'est pas un paramètre d'école (jockey 1,0 m, mord 1,6) ; le côté faible rentre par le bloc (`rentre` 9 m) sans
`k_narrow` ni prix mesuré ; le renversement existe (98) mais le re-coulissement est une course à plafond dur (pas
d'exponentielle, ch. 01 T22) ; la montée est le dédoublement + la craie, sans arbre ni vetos ; le centre a une zone
implicite (couloir 0,30, −13 m) mais pas d'objet « zone préférentielle » ; la fatigue est globale, pas locale.

**Absent.** **La rest defense** (aucune loi ne garde 4-5 joueurs derrière le ballon par consigne : le test 23 le
montre, les deux latéraux montent ensemble) ; `MATCH_RUN` ; l'overlap / underlap comme décision conditionnée (le
dédoublement est géométrique) ; le compensateur de largeur du latéral inversé ; le contre-marquage.

## 3. Les tests de réfutation, un par un

| # | Cible (book) | Statut | Mesuré (2 × 90 min) |
|---|---|---|---|
| 1 distance d'un latéral | 10-11 km | mesurable, **réfuté** | **14,8 km** (centraux 14,2) — la même chasse que la charnière |
| 2-7 haute intensité, sprints, récupération, déclin | | mesurables — à instrumenter (zones de vitesse) |
| 8 côté faible ↔ central, bloc bas | 5-11 m | mesurable | **10,3 m** ✓ (le `rentre` 9 m du bloc) |
| 9 corrélation y latéral faible / y ballon | > 0,6 | à re-mesurer (la sonde changeait de latéral avec le côté : −0,69 par construction — mesurer un latéral fixe) |
| 10 largeur concédée côté faible | 16-26 m | mesurable | **16,7 m** ✓ (borne basse) |
| 11-12 déficit de re-coulissement 6-10 m, `TRANSIT` 2-4 s | | mesurables — à mesurer sur renversements (98) |
| 13 sprint de récupération 18-30 m | | mesurable — à mesurer |
| 14 sorties simultanées | ≤ 1 | mesurable | **0,0 %** ✓ (la bande du 96 : un seul sort) |
| 15 centres du jeu / équipe | ≈ 11 | mesurable, **réfuté** | **23** — le double ; 15 bis tous centres à mesurer |
| 16 réussite des centres | 20-24 % | mesurable, **réfuté** | **58 %** — le centre servo (le 100 disperse le mauvais pied ×1,9, pas assez : le centre vise un corps et le trouve) |
| 17-18 buts par centre ; part des buts | 1,1-1,8 % ; ≈ 23 % | mesurable | **4,3 %** par centre (×3) ; **33 %** des buts (12 buts, 4 sur centre) |
| 19-20 conversion zone premium, xG cutback / centre aérien | | absent (pas de xG dans le journal) |
| 21 cutbacks / équipe | 1,56 | mesurable | **1,75** ✓ |
| 22 rendement retrait-au-sol c. aérien | ×2 | mesurable — à mesurer sur `bas` |
| 23 corrélation hauteur latéral / opposé | r < −0,25 | mesurable, **réfuté** | **r = +0,82** — les deux montent ensemble : pas de rest defense |
| 24 derrière le ballon à la perte, attaque placée | 4-5 | mesurable | **7,4** (465 pertes) — l'inverse : le bloc chaîné (42, `longAtk` 42 m) garde trop de monde derrière, et perd le ballon devant (les centres) |
| 25 latéral bloqué ↔ central | 12-18 m | absent (pas de latéral bloqué) |
| 26 latéral inversé sans compensateur | | absent |
| 27-28 piston à cinq | +5 à +12 m ; plus d'intensité | mesurable (352/532) — à mesurer |
| 29 `showDirection` | pertes sur la touche ↑ | loi existante (196) — à mesurer sur cette signature |
| 30 faux pied +0,15-0,35 s | | partiel (pied fort sans coût de temps) |
| 31 temps sans ballon | ≈ 95 % | mesurable | **98,5 %** — le latéral touche peu (ch. 01 T7 : LAT 15 possessions / 10 min ✓, mais courtes) |

## 4. Les lots que la fiche appelle

1. **La rest defense** (23, 24, 25) : 4 ou 5 derrière le ballon par consigne (2-3 / 3-2 / 4-1), le latéral bloqué,
   la hauteur combinée des latéraux bornée. Aujourd'hui l'équipe garde 7,4 corps derrière ET ses latéraux montent
   ensemble : la structure de sécurité n'est pas choisie, elle est subie par le bloc chaîné.
2. **Le centre qui se manque** (15-18) : le double de centres, 58 % de réussite, 4,3 % de but par centre — le même
   front que la finition (258) et la passe servo : le centre est une passe longue, il doit se disperser en distance et
   en hauteur, et le défenseur de surface doit le dégager (133 dégage 0 sur 17 centres à sa naissance).
3. **Le cadrage à `ballReleased` et `d_engage` d'école** (2.1) : avec la distance d'intervention (ch. 01/03).
4. **Le profil locomoteur mono-exponentiel** (3.4, 11-13) : le même lot que ch. 01 T22 — il décide du re-coulissement.
5. **La fatigue locale** (§ 9) — après la fatigue à compartiments du Référentiel 07.
6. **L'overlap conditionné et le compensateur du latéral inversé** (4.3, 5) — après la rest defense.
