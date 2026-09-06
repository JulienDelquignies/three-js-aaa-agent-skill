# 57 — Le ballon oublié : le porté qui anticipe (`cfg.porteAnticipe`)

Retour utilisateur : « parfois le joueur oublie le ballon quand il court ou quand il contrôle la balle, ça
fait foirer beaucoup d'actions ». Mesuré dans la sim (3 graines × 300 s, la cfg de la scène) :

- pendant l'armé d'une passe, le corps GLISSE sur son ancre (approach.glide + la foulée de frappe) et
  accélère jusqu'à 7,5 m/s ; le ballon, porté au servo (tau 0,035) vers le point de stance du corps
  D'AVANT le pas de glissement, traînait 0,38 m derrière (une image de corps + v·tau) ;
- au contact, `strikeNow` compare la géométrie à la stance (0,22 m / 22°) et REFUSAIT : 65 refus
  `stance-au-contact` par 900 s — un armé sur cinq (313 armés pour 243 passes et tirs) ; le ballon est
  alors « vendangé » (−40 %, libre) et le corps file sur l'élan du glissement : 2,2 m, 0,5 s, avant de
  se retourner. C'est l'image que l'œil lit : un joueur qui abandonne son ballon en pleine course, ou
  qui contrôle puis repart sans lui (le contrôle est suivi d'un armé refusé) ;
- 32 des 35 épisodes « le porteur lancé s'éloigne de son ballon » (≥ 0,2 s) suivent un tel refus.

## La loi (`cfg.porteAnticipe = { tau: 0.015, frein: 0.4, reprise: 0.8 }`, allumée ; absente = l'hier au bit)

- `rondo-sim.stepGestures` : le ballon se porte au point de stance du corps APRÈS son pas de glissement,
  au servo serré (`tau`) — il reste au pied du corps qui glisse, la géométrie tient au contact.
- `strike-sim.strikeNow` : le vendangé qui reste FREINE (`frein` × la vitesse : le pied qui manque son
  ballon coupe l'élan) et se REPREND pendant `reprise` s (`movement.js` : le porteur vise son ballon, sans
  poussée ni pointe, à l'allure de conduite).

Mesuré (3 × 300 s, verify-porte.mjs) : refus au contact 65 → 20 ; armés 312 → 269 pour 243 → 263 passes
et tirs (l'armé porte) ; épisodes « il court sans son ballon » 35 → 2 ; le ballon derrière un porteur
lancé 927 → 64 images sur 26 000 de porté ; le vendangé repris en moins de 1,5 s : 38/65 → 20/20 ;
distance porteur-ballon en conduite p90 1,31 → 1,18 m. Le contrôle lui-même n'était pas en cause : le
ballon est au pied 0,17 s après (p50 et p90), avec ou sans la clé.

L'équilibre (24 graines × 600 s, clé allumée / absente) : passes 3 768 / 3 470, armés 3 964 / 4 532,
pertes 1 043 / 1 121, tirs 79 / 86, buts 16 / 16 — et les DUELS 194 / 338, glissés 181 / 264, fautes 64 / 74 :
les ballons vendangés étaient une source de 50/50 (un tiers des duels). C'est un artefact qui tombe, pas
une loi de football ; le tronc peut re-calibrer ses flux de duel sur le monde propre.

## Le contrat (verify-porte.mjs, 4 clauses)

Les refus au contact ≤ 35 % d'hier, les épisodes ≤ 50 %, le vendangé repris (≥ 60 %), la clé absente
rend l'hier (≥ 40 refus).
