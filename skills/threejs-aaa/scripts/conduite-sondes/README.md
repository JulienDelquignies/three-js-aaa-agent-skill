# Sondes de la conduite et des dribbles (chantier « les dribbles ça va pas ni la conduite de balle », 2026-09-25)

Les instruments qui ont trouvé pourquoi la conduite et les dribbles du duel ne se lisaient pas, et qui ont vérifié `engine/pas.js`
(l'horloge de foulée dans la sim) et le passement DANS la foulée. Le contrat est `verify-pas.mjs` ; ceci sert à regarder.

Page servie en local : `npx vite build` puis `python3 -m http.server PORT` dans `examples/showcase/dist`, URL
`http://127.0.0.1:PORT/duel.html?duel=1&webgl&capture&seed=3`.

## Ce qu'elles ont mesuré (duel, avant)
- `conduite-rendu.mjs <url> [s]` : à chaque touche de la sim, le pied RENDU qui joue — sa phase, sa distance au ballon, le ballon dans le
  repère du corps, le ballon qui traverse un pied (par régime : porté, conduite, geste). Avant : le pied à 0,7 m du ballon (p50) à l'instant
  de la touche, deux touches par pas, 188 images de ballon DANS un pied.
- `gestes-duel.mjs <url> [s]` et `refus.mjs` : les gestes joués (4 passements en 120 s, tous PLANTÉS : 0 m/s), les refus nommés — seuls
  passement et crochet se déclenchent dans la cage.

## Ce qui a vérifié le remède
- `pieds-compare.mjs <url>` : les pieds prédits par la sim (pasPositions — le portrait tabulé du générateur) contre les pieds rendus :
  3 cm (p50) en ligne droite, 15-30 cm en virage serré ou au-delà de 4 m/s.
- `contact-debug.mjs <url>` : la touche lue À L'IMAGE du contact (le piège : une touche balayée sur la fin du vol se joue dans l'image où
  le pied se pose — le pied nommé y est « au sol », une sonde qui prend alors l'autre pied lit 0,46 m). Contact exact : 0,15 m (p50).
- `rdv.mjs`, `doublons.mjs`, `jeu-stats.mjs`, `passe-foulee.mjs` (sans navigateur) : les modes de touche (contact / fin / porté / lent), les
  enchaînements (le rendez-vous tenu), les doublons par vol, le jeu (buts, tirs, pertes, porté), le passement dans la foulée (vitesse du
  corps pendant, ballon au plus loin).
- `arc-probe.mjs <url>` : pendant un passement dans la foulée, le pied qui cercle relativement au ballon (devant, dedans → dehors, hauteur).
- Films : `capture-face.mjs <url> <dossier> <t0> <durée> [joueur]` (caméra de trois-quarts face qui suit), `tapis-video.mjs` (un joueur
  mené en ligne droite à vitesse fixe, sans la sim).
