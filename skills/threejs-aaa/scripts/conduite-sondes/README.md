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

## Les virages serrés (2026-09-25)
- `virages.mjs` (sans navigateur) : les touches par lacet du corps — au-delà de 2,5 rad/s, 11 % se jouaient au contact d'un pied, 46 % au
  rattrapage de fin de vol (pied prédit à 0,35 m du ballon) ; `fin-cause.mjs` : d'où viennent ces rattrapages — 47 sur 57 SANS plan (la
  première touche après le porté ou une prise : le ballon est où il est, personne ne l'a envoyé à un pied).
- `virage-fenetres.mjs <url> [s]` : les fenêtres de conduite en virage de la page (à filmer) ; `capture-face.mjs` avec `SAB=vise` filme la
  même action SANS le pied qui va au ballon (A/B).
- `contact-debug.mjs` (SECS=…) : le cou-de-pied rendu contre le ballon à l'image de la touche, par mode, en virage / droit, et si le pied
  qui joue est celui que la sim avait VISÉ. Après : toutes les touches à 0,14-0,15 m (p50), p90 0,28-0,38 (hier 0,37-0,51) ; en virage 0,09-0,18.

## Le répertoire du 1c1 dans la foulée (2026-09-25)
- `geo-1c1.mjs` (sans navigateur) : la géométrie de la cage aux instants de décision du porteur — le défenseur est DERRIÈRE ou de côté 70 %
  du temps (relèvement p50 130°), de face à < 3 m 11 % ; les fenêtres des gestes d'hier (réglées pour le 11c11) ouvertes 0,6-12 % du temps.
- `repertoire.mjs` : quels gestes partent, dans la foulée ou non, la vitesse du corps pendant, la durée, gardé ou tir à +1,5 s (et ce qui
  s'est passé quand c'est perdu). Hier : 23 passements, 8 crochets en 12 min, rien d'autre, passements plantés ; après : passement 11,
  crochet 9 (+ 7 sur chasseur), feinte de corps 9, croqueta 5 en 16 min, tous en courant (1,7-2,4 m/s au plus bas), 57-100 % gardés ou tirés.
- `gestes-duel.mjs <url> [s]` : les gestes de la page (à filmer : `capture-face.mjs`).
- `bouclier-tenue.mjs [moteur] [graines]` (sans navigateur) : la tenue dos au presseur — issues, durées, vitesse du porteur pendant (plantée
  elle gelait le duel 1-1,7 s ; au pas, cfg.bouclier.pas, il tourne autour du presseur en pas chassés), distance presseur-ballon.

## Les gestes contre les mesures, les corps qui ne se traversent pas (2026-09-25)
- `gestes-mesure.mjs <url> [s] [graines] [sortie.json]` (CFG='{json}' : une clé du duel changée, A/B) : dans le RENDU, image par image.
  (1) LE CONTACT : chaque corps en capsules AJUSTÉES sur son maillage (axe principal des sommets de chaque os ; le torse en trois capsules
  verticales — plus large que profond) ; pénétration, paires, contexte (acts), phases des jambes. Avant : > 5 cm sur 4,5 % des images de jeu
  (têtes, avant-bras dans le ventre, pieds) ; après contact-corps.js : 1,0 % (> 10 cm : 2,3 → 0,3 %). Piège : un rayon unique autour du
  segment os → os gonflait le pied (la semelle est 12 cm sous la cheville) et l'avant-bras (la main au-delà) ; le torse en une capsule, 20 cm.
  (2) LES GESTES contre leurs RÉFÉRENCES : passement — Taga et al. 2026 (vente 0,65 s, 2,2 → 2,9 → 4,3 m/s, pointe 0,24 m, tronc ≈ 41° en
  avant et ≈ 18° de côté à la sortie, genou ≈ 67°) ; feinte de corps — Brault et al. 2010 (épaules ≈ 25°, bassin ≈ 5°, roulis ≈ 15°, pied
  extérieur ≈ 0,6 m, centre de masse ≈ ±0,10 m) ; crochet — Dos'Santos et al. 2021 (sans ballon, 45/90/180°). Seuls les gestes allés jusqu'à
  leur touche de sortie sont jugés (les autres, le duel les a tranchés au contact — noyau).
- `capture-geste.mjs <url> <dossier> <graine> <t0> <durée> [joueur] [lent] [dist]` : un geste filmé CORPS ENTIERS (caméra latérale à 4 m),
  au ralenti si `lent` < 1 ; l'image au sol gris du rendu logiciel est refaite (le GPU n'a pas ce défaut).

## La conduite : le ballon mené par les pieds, pas par une force (2026-09-25)
- `conduite-ballon.mjs <url> [s] [graines] [sortie.json]` : dans le rendu, le porteur en course — le ballon TENU au servo ou LIBRE, sa place
  devant le bassin, son pied le plus proche, la FORCE INVISIBLE (le ballon qui accélère au-delà du roulement sans pied à 0,2 m), les touches
  (intervalle, par foulée, par mètre), pourquoi le porté, le ballon libre derrière le porteur. Avant : tenu 30 % du temps (force invisible
  17 % — « le contrôle qui se pose » 74 % du porté), libre derrière 23 % (le porteur lancé à 5 m/s dépassait un ballon qui ralentissait, et
  orbitait 5 s autour d'un ballon mort). Après (cfg.conduite, cfg.surface, pasPortee 0,4) : tenu 2-4 % (la tenue dos au presseur), force
  invisible 1-2 %, derrière 8-10 %, une touche toutes les 1,3-1,5 foulée.
- `capture-geste.mjs … porteur` : la caméra suit le porteur du moment. Filmer depuis un BUILD servi à part (le serveur de dev recharge la page à
  chaque édition d'une source : la capture meurt — « __seekFrame is not a function »).
- `recuperation.mjs <url> [s] [graines] [sortie.json]` : la prise d'un ballon LIBRE — l'approche, le ballon au pied RENDU à l'instant de la prise,
  le ballon tenu sans pied dans les 0,6 s qui suivent, et pourquoi. Avant : prise au rayon du corps (0,85 m), ballon à 0,53 m du pied rendu
  (6 % à ≤ 0,2 m), puis tiré au pied par le servo (glissé > 0,1 m sur 37 % des prises). Après (cfg.recup) : prise quand un pied l'atteint,
  ballon à 0,20-0,25 m du pied rendu, la prise en course joue une touche PLANIFIÉE vers le pied qui se pose (rendez-vous déclaré). Reste :
  l'armé de passe et la feinte de corps tiennent le ballon au servo pendant leur geste.
- `capture-geste.mjs … recup[:k] …` : filme la k-ième prise d'un ballon libre par un joueur lancé, trouvée dans la partie de la page même.
