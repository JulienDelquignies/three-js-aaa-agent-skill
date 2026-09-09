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
| Bible 10 — bloc collectif | [10-bloc-collectif.md](10-bloc-collectif.md) | 1-8, 11-13, 15, 17, 18, 20 mesurés | le bloc qui perçoit ; le coulissement par ligne ; la ligne est une ligne ; l'interligne dérivé et son point de rupture ; le bloc fatigable ; les déclencheurs comme événements |
| Bible 11 — transitions | [11-transitions.md](11-transitions.md) | X1-X7, X10, X13-X15, X22-X25 mesurés | la transition comme résultat ; le rendement du contre par le déséquilibre lu ; les cinq rôles de transition ; la reperte immédiate (tenue) ; le socle de possession |
| Bible 12 — marquage et passation | [12-marquage-passations.md](12-marquage-passations.md) | T1-T5, T7, T10, T17, T18 mesurés | la distance d'intervention ; la passation comme état et comme parole ; le clignotement (29/min) ; l'entre-lignes et le décrochage ; les corners comme protocole |
| Bible 13 — chorégraphie | [13-choregraphie-zonale.md](13-choregraphie-zonale.md) | 1-7, 13-18, 22, 23 mesurés | le repère d'équipe daté ; longueur et largeur par bande ; la répulsion entre partenaires ; l'immobilité active ; le gardien dans le repère ; la respiration asymétrique |
| Bible 14 — micro-comportements | [14-micro-comportements.md](14-micro-comportements.md) | T1-T3, T12, T15, T24, T25 mesurés | la perception non omnisciente ; la tromperie ; le temps du match ; la communication comme canal ; la première touche typée et la pausa |
| Bible 15 — duels et seconds ballons | [15-duels-seconds-ballons.md](15-duels-seconds-ballons.md) | D1-D3, D10, D12, D14, D15, D17, D20-D24, D30, D33 mesurés | le duel comme vecteur ; le tacle glissé comme dernier recours (82/match) ; le jeu long qui se manque et le ballon qui sort ; la tête comme volume ; les redistributions contestées |
| Bible 16 — contexte de match | [16-contexte-de-match.md](16-contexte-de-match.md) | T5, T6, T10-T15, T17, T19, T23 mesurés | le profil locomoteur et le budget (165 km / équipe) ; la couche de contexte ; les trois fatigues ; le temps du match ; l'infériorité et le lieu |
| Modèle 01 — boucle | [M01-boucle-simulation.md](M01-boucle-simulation.md) | 3, 5, 9, 10 mesurés | le pas de décision séparé du pas physique (40 tirs à 1/60, 22 à 1/30) ; les flux RNG nommés ; le double tampon ; le budget (251 µs / tick) ; le temps de jeu ; le LOD1 |
| Modèle 02 — locomotion | [M02-locomotion.md](M02-locomotion.md) | 1-3, 6, 8, 11-13 mesurés | le profil mono-exponentiel et l'intention d'effort (8,5 accélérations / min, réel 0,9) ; le freinage ; l'évitement (11,5 interpénétrations / min) ; la fatigue sur l'accélération ; les courses arquées |
| Modèle 03 — ballon | [M03-physique-ballon.md](M03-physique-ballon.md) | 2-5, 14 mesurés | la portance calée (C_L à la moitié) ; le roulement DIN ; l'erreur anisotrope ; l'interception probabiliste ; le knuckleball |
| Modèle 04 — perception | [M04-perception-cognition.md](M04-perception-cognition.md) | inventaire (architecture A) | la couche de croyance ; le balayage comme prérequis de poste ; la latence par décision ; l'attention et la tromperie ; la communication ; l'invariance par permutation |
| Modèle 05 → 06 | en cours (sonde lancée) | | |
| Modèle 07 — pression | [M07-pression-lignes-de-passe.md](M07-pression-lignes-de-passe.md) | 2, 3, 5, 7 mesurés | la pression comme temps d'arrivée ; l'interception probabiliste couplée ; l'affectation avec hystérésis ; le déclenchement par événement ; le piège |
| Modèle 08 — architecture décisionnelle | [M08-architecture-decisionnelle.md](M08-architecture-decisionnelle.md) | inventaire | la couche unité ; le blackboard à trois zones ; les verrous nommés ; les revendications spatiales ; le journal des intentions |
| Modèle 09 — passe | [M09-modele-passe.md](M09-modele-passe.md) | 1, cal mesurés | la passe qui se manque à la bonne distance (courtes 67-80 %, longues 61-71) ; le type somme calibré ; le rendez-vous ; la comptabilité des pertes ; le sous-dosage |
| Modèle 10 — tir | [M10-modele-tir.md](M10-modele-tir.md) | 5 bis, 7, 9 bis, cibles mesurés | l'échelle de finition (24,5 % de buts par tir, 6 buts / match) ; le blocage (2 % contrés) ; le xG et PSxG ; le gardien à enveloppe continue ; tête, penalty, VAR |
| Modèle 11 — duels | [M11-duels-stochastiques.md](M11-duels-stochastiques.md) | 1, 2, 4 mesurés | le noyau commun de duel (dribble plat à 18-24 %, 0,8 % de fautes obtenues) ; le volume des gestes ; la tromperie |
| Modèle 12 — règles et arbitrage | [M12-regles-arbitrage.md](M12-regles-arbitrage.md) | 8, 11, 12 mesurés | le carton qui juge la nature (2,7 fautes par jaune) ; le hors-jeu comme capsule ; le temps du match (49 arrêts de 17,5 s) ; l'arbitre faillible ; le VAR |
| Modèle 13 — coups de pied arrêtés | [M13-coups-de-pied-arretes.md](M13-coups-de-pied-arretes.md) | 1, 2, 5, 10 mesurés | le volume des CPA (3,5 corners, 14 touches) ; le corner comme chorégraphie (0 but, attaque 29 % au premier contact) ; le penalty ; la touche contestée ; le playbook |
| Modèle 14 — consignes et formations | [M14-consignes-et-formations.md](M14-consignes-et-formations.md) | inventaire | le certificat par consigne ; les deux formes étiquetées ; la familiarité et le plan adverse ; la formation à dix ; le vecteur de joueur |
| Modèle 15 — IA entraîneur | [M15-ia-entraineur.md](M15-ia-entraineur.md) | inventaire | le coach qui observe des agrégats bruités ; les remplacements comme politique ; la bibliothèque et l'attente ; l'ablation au banc ; la perte de temps |
| Modèle 16 — télémétrie | [M16-telemetrie-outils.md](M16-telemetrie-outils.md) | inventaire | le journal en vocabulaire SPADL ; la table du réel au banc ; les détecteurs d'artefacts ; le journal de décision ; l'en-tête de session |
| Référentiel de calibration 01 → 16 | à faire | | |
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
