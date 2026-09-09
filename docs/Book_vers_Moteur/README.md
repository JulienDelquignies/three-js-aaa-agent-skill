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
| Bible 05 → 16 | à faire | | |
| Modèle 01 → 16 | à faire | | |
| Référentiel 01 → 16 | à faire | | |
