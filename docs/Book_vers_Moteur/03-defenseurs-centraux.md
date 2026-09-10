# Bible 03 — Les défenseurs centraux, contre le moteur

*Fiche du 9/09, moteur 767de25 (SCEAU 256). Mesures : 2 matchs de 90 min (graines 3, 7), monde par défaut, puis
`hauteurBloc` 0,9 et 0,1.*

## 1. Ce que le chapitre demande

- **Trois distances**, pas une : `dLat` (écart latéral des centraux, piloté par la position du ballon : 8-12 m ballon
  axial à 30 m, **5-8 m ballon en centre**, 14-20 m sur relance basse adverse), `dLong` (le couvreur plus bas, **−3 à −6 m
  côté opposé au ballon** sur l'aile : l'oblique), `dGap_FB`.
- **Ballon couvert / découvert** comme loi motrice de la ligne : presseur ≤ 2,0 m, orientation, contrôle stabilisé →
  COUVERT ; > 3,5 m et face au jeu → DÉCOUVERT ; bande morte 2-3,5 m = gel. Step-up +2 à +4 m en 1,2-2,0 s, recul-frein
  −4 à −8 m en 1,0-2,0 s, facturé (vitesse arrière ≈ 0,55 × avant) ; **le retard** par joueur produit une
  désynchronisation `lineDesync` de 0,8-1,8 m en régime établi, ≤ 3,5 m en pic — et c'est elle, pas la hauteur, qui
  fait le hors-jeu (Real plus haut que Barcelone et 46 hors-jeu de moins).
- **Le duel** : un curseur `duelAggression` (dissuasion à 1,5-2,5 m / jaillissement dès 4-6 m), une séquence d'approche
  chiffrée, un modèle de probabilité.
- **La profondeur** : lire le passeur avant la passe ; `dSafe` déterminé par la hauteur du gardien (`x_ligne ≈ x_GK +
  20,4 m`, élastique) ; le hors-jeu évalué à `t_pass`.
- **La surface** : trois régimes de marquage et leur bascule, voir ballon et homme, les bloqueurs ; le duel aérien avec
  élan, taille, distance de contact (65-70 % gagnés, jamais > 80 %) ; le dégagement orienté (jamais devant son but).
- **La relance** : sécurité → conducción (8-20 m, fixation) → courte latérale → verticale entre les lignes → longue ;
  le +1 permanent ; le risque selon pression et score.
- **Le pilotage** : six appels (`LINE_UP, DROP, HOLD, TAKE, SQUEEZE, AWAY`) avec portée et latence 0,22-0,60 s.
- **Le bruit** : les erreurs comme conséquences d'état (croyance périmée, conflit ballon/homme), 0-2 erreurs menant à un
  but par saison, 0,7-1,2 éliminations /90.

## 2. Où en est le code

**Existant.** Ballon couvert / découvert (**236, `cfg.couvert`** : `pres` 2, `libre` 3,5 — les seuils exacts du
chapitre —, `monte` 3, `recule` 5, `tau` 0,2 s, × hauteurBloc, × l'anticipation moyenne de la ligne comme TEMPS,
246b) ; l'oblique quand un défenseur sort (**237/245 `referme`** : le voisin recule de 1,5 m, le second de 0,75, sur
sortie vraie ≥ 2 m et ballon à < 40 m) ; la bande de la ligne arrière (**96 `zone`**, 6 m, tactique et rôle depuis
252) ; la Loi 11 **à la photo du départ** (149 `offside.js` : « l'instant : le départ du ballon, pas la réception »
— le T21 est satisfait par construction) et ses assistants (186) ; le piège de hors-jeu (149 axe `piege`) ; la
salida (**239 `salida`** : ballon au central ou au gardien à < 30 m, le 6 décroche) ; la sortie au gardien (136) ; le
duel (152/157/158/166 : tacle tempo, garde, contesté), le jockey (95) et le contain (78) ; le duel aérien (34, 112
`sautF`, 147 `headF`, « le plus vif prend » 246d) ; le marquage de surface homme par homme (225) et sur centre (133) ;
le bruit du placement (246 `placement.bruit` 10 m × (1 − posF)) et le laps d'attention (246c) — des erreurs
**d'état**, comme le chapitre le veut ; le pied fort (147 `weakFoot`, 100 `patte`) ; les défenses à trois (352, 532,
343 en formations).

**Partiel.** L'oblique n'existe qu'à la sortie d'un défenseur, pas sur le centre (le central opposé ne descend pas) ;
`dSafe` n'est pas lu sur le gardien (le couplage existe dans l'autre sens, le libéro suit la ligne) ; le duel aérien
n'a ni élan, ni distance de contact, ni « non contesté » ; le dégagement vise le flanc (131 `clearServi`) mais sans la
règle hauteur-profondeur-largeur ; la relance basse a la salida et la passe au gardien, pas l'arbre (pas de
conducción de fixation, pas de sortie verticale entre les lignes nommée) ; le pilotage est un delta collectif
(`st._bCouvertDx`), pas des appels avec portée et latence ; stoppeur/couvreur est « le plus proche presse, le second
couvre » (`byDist`), sans hystérésis.

**Absent.** La ligne comme **unité** (les quatre défenseurs ne sont pas tenus ensemble : voir T8) ; `dLat` piloté par
la zone du ballon ; `duelAggression` par joueur ; la vitesse arrière et son coût ; les erreurs menant à un but comme
statistique.

## 3. Les tests de réfutation, un par un

| # | Cible (book) | Statut | Mesuré (2 × 90 min) |
|---|---|---|---|
| T1 hauteur de ligne selon `lineHeightBase` | 33-35 haut / 24-27 bas | mesurable, **l'axe marche** | défaut **26,4 m** (p50 23), hauteurBloc 0,9 → **31,8**, 0,1 → **22,6** : l'amplitude de l'axe (−6/+6 m) rend 9 m d'écart ; le monde par défaut est un bloc bas-médian |
| T2 gardien ↔ ligne | 20,4 m ±3 | mesuré au ch. 02 | **30,3 m** |
| T3 hors-jeu provoqués | 1,5-2,5 ordinaire, 4,8 Barcelone | tenu au 255 | **1,0** → équilibre 3,0 (259 : la Loi 11 existe), hauteur 0,9 sans piège **1,75**, avec piège **5,25**, preset ligneHaute **4,5** (4 × 90 min) |
| T3b anticorrélation hauteur / désync | | **tenu au 255** : à hauteurBloc 0,9 égal, piege 0 → **1,75** hors-jeu provoqués, piege 1 → **5,25** (4 × 90 min) — la synchronie, pas la hauteur |
| T4 `dLat` axial / centre | 8-12 / **5-8** | mesurable, **cible fausse en centre** | axial **12,8 m** (juste au-dessus), **centre 16,7 m** : les centraux ne se resserrent pas quand le ballon est sur l'aile — ils marquent chacun leur homme (225, 133) là où il est |
| T5 `dLong` sur l'aile, signe | −3 à −6, correct > 80 % | **absent sur le centre** | **−0,9 m, signe correct 56 %** (0,1 m et 49 % à bloc haut ; −2,5 m et 75 % à bloc bas — le bloc bas approche) |
| T6 réponse impulsionnelle 3 m en 1,2-2,0 s | | loi existante (236 : monte 3 m, tau 0,2 s + lecture) — à mesurer sur film |
| T7 bascules de stoppeur | 40-90 (> 250 échec) | mesurable (proxy : le central le plus proche du porteur) | **300 par équipe** (368 haut, 241 bas) — le rôle change de tête quatre fois par minute |
| T8 `lineDesync` | 0,8-1,8 ; pic ≤ 3,5 | mesurable, **réfuté** | **p50 7,5 m, p90 18,4** (bas : 9,2 / 22,4) — la ligne arrière n'est pas une ligne : latéraux montés ou en marquage, centraux à leur homme ; c'est le constat le plus lourd de la fiche |
| T9 éliminations subies /90 | 0,7-1,2 | mesurable (skill events sur le central) — à mesurer |
| T10 duels aériens gagnés | 65-70 %, jamais > 80 | mesurable après instrumentation (l'événement `tête` ne dit pas l'issue) — 7 têtes de centraux par match, un volume faible |
| T11 erreurs menant à un but | 0-2 / saison | absent (pas de définition « erreur » dans le journal) |
| T12-T14 relance : issue des longs, `buildUpBravery`, conducción 8-20 m | | partiel : les longs se conservent trop (ch. 02 test 18) ; pas de curseur de bravoure ; pas de conducción |
| T15 buts sur corner selon schéma | zone 3,3 / homme 3,1 / hybride 5,9 | mesurable (225 `marquageSurface`, 101) — volume : 200 matchs |
| T16 distance d'un central | 9-11 km ; +550 m en défense | mesurable, **réfuté** | **14,1 km**, dont 7,6 en phase défensive — le central du moteur court 40 % de trop : il chasse (T7, T8) |
| T17 pic d'accélérations en transition défensive | | mesurable — à mesurer |
| T18 bloqueur sur corner | | absent (omniscience) |
| T19 abaisser le gardien de 6 m → la ligne descend de 3-5 m | | **absent dans ce sens** (le libéro suit la ligne, la ligne ne lit pas le gardien) |
| T20 ignorer 30 % des `LINE_UP` | | absent (pas d'appels) |
| T21 hors-jeu à `t_pass` | 100 % | **satisfait par construction** (149) |
| T22 transitions défensives sans sprint majoritaires | | mesurable — à mesurer |
| T23 latéralité des centraux | | partiel (pied fort existe, pas de politique d'affectation) |

## 4. Les lots que la fiche appelle

1. **La ligne est une ligne** (T8, puis T3, T7, T16) : les quatre défenseurs tenus comme une unité (la cadence
   d'unité du ch. 01 : 4 Hz), la bande de 6 m appliquée aux latéraux aussi, le retard par joueur comme seule source de
   désynchronisation (0,8-1,8 m), stoppeur/couvreur avec hystérésis. C'est le lot qui rend le piège de hors-jeu
   possible et qui fait cesser la chasse (14 km).
2. **La charnière sur le centre** (T4, T5) : `dLat` piloté par la zone du ballon (5-8 m en centre), le central opposé
   qui descend et rentre (l'oblique du centre, différente de celle de la sortie 237).
3. **La distance d'intervention** (ch. 01, T12) et **`duelAggression`** (§ 3.1) : le même chantier — le défenseur du
   moteur est toujours en jaillissement à 3 m.
4. **Le gardien lu par la ligne** (T19, `dSafe`) : le pendant du « gardien couplé à sa ligne » du ch. 02 — un seul lot
   pour les deux sens.
5. **La relance du central** (T12-T14, et ch. 01 T7 : DC ÷ 2) : l'arbre, la conducción, `buildUpBravery` comme axe.
6. **Le duel aérien instrumenté** (T10) : l'issue dans l'événement, puis élan / distance de contact / non contesté.
