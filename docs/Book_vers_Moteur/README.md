# Le book contre le moteur — cartographie chapitre par chapitre

*Commencée le 9/09 sur 767de25. Le book (`JulienDelquignies/book`, 48 chapitres audités) est le cahier des charges ;
ce dossier dit, chapitre par chapitre, où le code se situe par rapport à lui.*

## La fiche (la même pour chaque chapitre)

1. **Ce que le chapitre demande**, dans ses grandeurs — pas une paraphrase, les nombres et les structures qu'il pose.
2. **Où en est le code** : la loi existante (lot, clé, fichier), le partiel, l'absent, et les différences d'architecture
   à NOMMER sans réécrire (le moteur décide par lois à clé, pas par machines à états ; on ne le refait pas pour un
   vocabulaire).
3. **Les tests de réfutation du chapitre, un par un**, classés *mesurable aujourd'hui* (avec le chiffre mesuré à côté
   de la cible), *loi existante, cible fausse*, *absent*. Une fiche sans chiffres n'est pas une fiche.
4. **Les lots que la fiche appelle**, dans l'ordre où ils se conditionnent.

Règles : les invariants partagés du book font foi sur un désaccord entre chapitres ; une cible `[A CALIBRER]` reste un
garde-fou, pas une réfutation ; les mesures ici sont faites sur 2 matchs de 90 min (le book en demande 50 à 200 — les
ordres de grandeur sont sûrs, les décimales non) ; les sondes vivent dans le scratchpad et seront versées dans
`verify-book.mjs` (informatif) à la fin du volume.

## État

| Chapitre | Fiche | Mesures | Lots appelés |
|---|---|---|---|
| Bible 01 — cadre général | [01-cadre-general.md](01-cadre-general.md) | T1, T6, T6b, T7, T10, T11, T12, T21 mesurés ; T15, T22 partiels | la distance d'intervention ; LOOSE au premier rang ; la fenêtre de transition comme école ; le profil locomoteur ; les touches par poste |
| Bible 02 — gardien | [02-gardien.md](02-gardien.md) | 1, 2, 4-5, 7, 15, 18, 20, 24 mesurés | le gardien couplé à sa ligne ; la portée bornée par le temps ; la règle des 8 s ; les longs du gardien qui manquent |
| Bible 03 — défenseurs centraux | [03-defenseurs-centraux.md](03-defenseurs-centraux.md) | T1, T3, T4, T5, T7, T8, T16 mesurés (défaut, bloc haut, bloc bas) | la ligne est une ligne ; la charnière sur le centre ; l'intervention et duelAggression ; le gardien lu par la ligne ; la relance du central ; l'aérien instrumenté |
| Bible 04 — latéraux et pistons | [04-lateraux.md](04-lateraux.md) | 1, 8, 10, 14, 15-18, 21, 23, 24, 31 mesurés | la rest defense ; le centre qui se manque ; le cadrage à ballReleased ; le profil locomoteur ; la fatigue locale |
| Bible 05 — milieu défensif | [05-milieu-defensif.md](05-milieu-defensif.md) | T1, T2, T4, T8, T9, T12-14, T17, T18, T27 mesurés (4-3-3, 4-2-3-1, bloc bas) | le renversement qui existe ; le double pivot comme unité ; l'interligne piloté par le bloc ; le budget du 6 ; les régimes de tempo ; la faute tactique |
| Bible 06 — relayeurs | [06-relayeurs.md](06-relayeurs.md) | 1, 3, 8-14, 16, 18-20, 24-25, 28 mesurés | la rest defense comme structure ; la course avant le ballon ; le soutien par sous-phase ; la règle des lignes ; le contre-press dans le joueur ; le handoff en unité |
| Bible 07 — entre les lignes | [07-meneur-entre-les-lignes.md](07-meneur-entre-les-lignes.md) | T1, T2, T5-T7, T11, T13, T14, T21, T23 mesurés (adversaire défaut / bloc bas) | la poche dérivée de l'adversaire ; le sprint a un budget ; la pausa ; le déclencheur côté attaquants ; l'orientation de trois-quarts |
| Bible 08 — ailiers | [08-ailiers.md](08-ailiers.md) | 1-6, 10, 12-15, 17, 21, 23 mesurés | dyT par phase et la conservation ; le dribble à sa fréquence ; le budget de sprint ; le pressing arqué ; les rôles de touche |
| Bible 09 — avant-centre | [09-avant-centre.md](09-avant-centre.md) | T1, T4, T7, T8, T13-T14, T17, T19, T24 mesurés | le budget de course ; l'épaule et le service ; la finition ; le pressing comme suppression d'option ; le ballon qui ne vit pas avec le 9 |
| Bible 10 → 16 | à faire | | |
| Modèle 01 → 16 | à faire | | |
| Référentiel 01 → 16 | à faire | | |

## Ce que les neuf premières fiches disent ensemble

Les mêmes constats reviennent de poste en poste, et ce sont eux qui font les lots — pas les postes :

1. **Tout le monde chasse.** Centraux 14 km, latéraux 14,8, 6 17,8, 8 17,2, ailiers 17,9 (réel 9-11,5) ; le 9 fait 1 090
   bursts par match, le 10 492 courses HI (réel 15-25), les ailiers 217 sprints (réel 13). Le sprint n'a pas de budget et
   la vitesse maximale s'atteint à 4 m. → **le profil locomoteur et le budget de course** (ch. 01 T22, 07, 08, 09).
2. **La défense est au contact, pas à distance.** Intervention à 3,2 m (réel 10-15), la ligne désynchronisée de 7,5 m
   (réel 0,8-1,8), le stoppeur change 300 fois, le 6 presse toujours, 900 bascules de moment. → **la ligne est une
   ligne, la distance d'intervention, LOOSE au premier rang** (ch. 01, 03, 05).
3. **Le ballon vit devant.** Centraux à 8 possessions par 10 min (réel 15), 9 à 23 (réel 10), 422 touches ; 7,4 corps
   derrière le ballon à la perte sur 27 m à 61 m (réel 3,7 sur 7 m à 44) ; les deux latéraux montent ensemble
   (r = +0,82). → **la sortie de balle par derrière et la rest defense comme structure** (ch. 03, 04, 06).
4. **La largeur n'est pas jouée par phase.** L'ailier côté ballon à 11 m de sa touche en sortie basse (réel 1-2,5), le
   second poteau atteint 3 % du temps, le renversement 1 fois sur 160 possessions (réel 8-14). → **dyT par phase, le
   renversement qui existe** (ch. 05, 08).
5. **Rien ne se manque.** Centres réussis à 58 % (réel 20-24), longs du gardien à 83 % (réel 45-60), conversion dans la
   surface 33 % (réel 15), dribbles à 20 % (réel 40-50) mais trois fois trop nombreux. → **la finition et la passe qui
   se manquent** (258, ch. 02, 04, 08, 09).
6. **Personne ne regarde ni ne retarde.** Aucune latence de décision, aucune croyance périmée, le scan sans effet sous
   pression, le pausa absent, le 10 sans poche. → **la perception non omnisciente** (Modèle 04) et **la pausa** (253).
