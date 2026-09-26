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

## L'armé au pied : le ballon roule, le corps règle ses appuis (2026-09-26)
- `arme-ballon.mjs <url> [s] [graines] [sortie.json]` : pendant l'armé d'une frappe (engagement → contact), le ballon qui bouge sans pied,
  sa vitesse au plus fort, l'ACCÉLÉRATION INEXPLIQUÉE (la force sans pied) ; à l'image du contact le pied qui frappe contre le ballon d'AVANT
  la frappe (la dernière image d'armé est 25-30 cm trop tôt à 60 Hz, l'image du contact a déjà lancé le ballon : lire l'un contre l'autre),
  la stance réalisée (écart de distance, de relèvement, lacet contre la sortie) et les refus stance-au-contact. Avant : le ballon porté au
  POINT DE STANCE (porteAnticipe, jusqu'à 9 m/s — 13 images de force sans pied par armé, 6,3 m/s au plus fort), pied au contact 0,18 m
  [p90 0,39], 8 refus / 16 min. Après (cfg.armePied, approach.glideRelatif, cfg.murCorps) : 0 image de force, le ballon roule (2,5 m/s),
  pied au contact 0,17 [p90 0,22], 2 refus. Les pièges trouvés en route : plantVitesse nule p.v avant le glissement (l'élan se lit à
  l'engagement, A.v0/vYaw) ; le lacet tourne à taux borné (l'ancre se règle sur le regard réel) ; le chemin cartésien traversait le ballon
  (polaire autour de lui) ; ballon qui file dans la grille et ballon collé à la grille (refus ballon-mur / ancre-mur, l'intention et
  l'ancre tombent — tenues, elles rendaient le porté au servo).
- `recuperation.mjs` compte désormais la FORCE sans pied (l'accélération que le roulement n'explique pas), plus le ballon possédé qui roule.
  Base : poussé sans pied > 0,1 m sur 122/296 prises, p90 1,19 m (armé de passe 1 204 images, feinte 250). Après : 47/295, p90 0,38 m
  (armé 0, feinte 44). Reste : le bouclier (la tenue dos au presseur), la semelle qui pose au pas, le crochet (le ballon au point du clip).
- `capture-geste.mjs … recup[:k] …` suit le RÉCUPÉRATEUR dès la première image (hier l'ancien porteur jusqu'à la prise).

## Le joueur et le ballon ne font qu'un (2026-09-26)
- Référence : Zago et al. 2016 (J Sports Sci 34:411) — 2,3-3,0 contacts/s en conduite de slalom, 1,4-2,3/s en conduite droite à 5,7 m/s.
- `conduite-ballon.mjs` imprime désormais l'UNITÉ : touches par seconde de conduite en course, ballon au pied rendu (p50/p90, > 0,5 / > 0,8 m),
  respiration (p90 − p10 du ballon devant le bassin), louvoiement (p90 − p10 de côté). Base : 0,98 touche/s, pied 0,53 / 1,11 m, respiration
  1,07 m, louvoiement 0,99 m, 71 % du temps de conduite dans des trous > 0,8 s sans touche.
- `rdv-tenu.mjs` (sans navigateur) : chaque rendez-vous de touche est-il tenu par le pied prévu à son échéance, sinon pourquoi ; les trous de
  conduite et ce que fait le ballon pendant. A trouvé : la touche visait le pied à l'intervalle de ROULEMENT (touchInterval, ≈ 2 s à 3,5 m/s) ;
  le contact exact du cou-de-pied (0,16 m) laissait passer la moitié des rendez-vous ; le porteur visait 3 m devant SOI (le ballon à 0,75 m de
  côté, hors du couloir des pieds) ; la chasse du ballon reprenait la main pendant un rendez-vous (47 % des images) ; des rendez-vous prédits
  au-delà de la grille. `rdv-erreur.mjs` : à l'échéance, le ballon contre sa cible (le roulement — exact depuis dribble.vitesseRdv) et le corps
  contre le corps prédit (lire en excluant tirs, ballons possédés et rebonds).
- Après (cfg.conduite.cadence, dribble.toucheCadenceT/vitesseRdv, rendez-vous tenu à 0,25 m, la ligne tenue entre deux touches, la cage) :
  2,33 touches/s, pied 0,32 / 0,89 m, respiration 0,68 m, louvoiement 0,37 m, trous 20 % ; touches au cou-de-pied 84 % (verify-pas, 16 graines).
- `capture-geste.mjs` : la caméra prend le côté qui a de la place (borne de la cage), soleil dans le dos en second, jamais au-dessus de 2,2 m.

## Le terrain de futsal, les gardiens, le tir qui se mérite (2026-09-26)
- Retour : « trop de tir pas assez de dribble — agrandis le terrain et mets des gardiens — réduis le volume de tir ».
- `jeu-format.mjs` (sans navigateur) : par minute — tirs, buts, arrêts du gardien, gestes de dribble, duels, pertes, passes (par rôle :
  champ/gardien ; `to` −2 = le but : tirs et dégagements), joueurs de champ figés ; conduite en course, conversion, portée et xG des tirs.
  Base (cage 24 × 14 sans gardien) : 5,38 tirs/min, conversion 62 %, conduite 24 % du temps, 3,3 duels/min.
- `geo-1c1.mjs` a trouvé la course-poursuite : le défenseur DERRIÈRE le porteur 75 % des instants (de face à < 3 m : 4,6 %) — d'où le
  repli (duel-1v1.repliDuel : entre le ballon et son but avant de défier) → derrière 39 %, de face à < 3 m 8,2 %, 8,6 duels/min.
- Le tir comparé au DRIBBLE (xg.evDribbleDe) : sans coéquipier de champ la continuation d'un tir est le ballon mené plus près (la passe,
  nulle, laissait frapper dès la portée) ; la conduite ne s'use plus (menace.muteD) ; pas de passe « facile » à son gardien (× 0,35), pas
  de dégagement du joueur de champ ; l'appel de balle quand son gardien a le ballon (figé au poste du 11c11 avant).
- Après : ≈ 2 tirs/min (tirs de près, xG 0,18-0,27), 2,3 arrêts/min, conduite 46 % du temps ; verify-duel réécrit pour le format (le gel
  hors gardien et hors relance du gardien, 1-3 tirs/min, des arrêts), verify-pas : dribbles gardés ≥ 50 % (face à un défenseur replacé).
- `capture-geste.mjs` : CAM=page (la régie de la page) et T0 = 'arret[:k]' (le k-ième arrêt, 3 s avant).

## Tenter plus de gestes dans les face-à-face (2026-09-26)
- `face-a-face.mjs` (sans navigateur) : les épisodes où le porteur de champ, ballon au pied, a le défenseur DEVANT lui (≤ 55°, 1,1-3,5 m) —
  leur issue (geste, tir, dépassé, perdu, éteint : au contact / hors cône / distance / acte) et, image par image, la porte de la feinte de
  corps qui bloque (allure, ballon, distance, délai, fenêtre ouverte). Avant : 29 % des face-à-face finissaient sur un geste, 32 % au contact
  sans rien tenter ; portes : allure < 1,4 m/s 43 % (le porteur RALENTIT face au défenseur : 1,2 m/s p50), délai de feinte 21 %, fenêtre
  ouverte 15 % (le tirage d'un joueur moyen ≈ 0,19, puis 1,5 s d'attente).
- Remède (skills-sim.envieFace, cfg.dribble1c1 : envieFace 0,8, face 3,5, feinteV 1,0, refusCd 0,5, feinteCd 3 ; passementV 1,3 pour que
  le passement reste dans la course) : 74 % des face-à-face finissent sur un geste, 5 % au contact ; 1,75 → 3,4 gestes/min ; verify-pas :
  111 gestes / 16 min (54 avant), 56 % gardés ou tirés.
- `capture-geste.mjs` : T0 = 'geste[:k]' (le k-ième geste dans la foulée, 1,5 s avant).

## Le gardien : le bloc du corps, les sorties à l'échelle du futsal (2026-09-26)
- `gardien-tirs.mjs` (sans navigateur) : pour chaque tir, le gardien à l'instant du tir (profondeur, écart à la bissectrice, distance au
  tireur, au sol) et l'issue ; ses sorties (hors surface, profondeur, coins, pourquoi) et les buts but vide. Référence : en futsal d'élite
  76,5 % des tirs cadrés finissent sur une intervention du gardien. Avant : il en arrêtait 45 %, conversion 39 %, sous 5 m 8 buts sur 11 —
  le vol arrivait avant le réflexe (0,12 s) et PASSAIT AU TRAVERS du corps (keeperDecide rend 'poste' avant le réflexe, aucun bloc passif) ;
  hors surface 11 % du temps jusqu'à 17 m (le libéro, le retrait et le soutien du 105 m), 3 buts but vide / 16 min.
- Remède : keeper.blocCorps (cfg.blocCorps : w0 0,35, vMembre 4,5, max 1,2, h 2 ; le segment du ballon contre le corps), libéro / retrait /
  soutien à l'échelle (duelCfg), les 4 s du futsal au gardien porteur (menace.arbitre, cfg.duel.gardien4s), l'urgence sans geste qui garde le
  plan d'approche (strike-sim, cfg.duel.urgencePlan — le gardien refusé 'technique' à chaque image portait le ballon jusqu'aux coins).
- Après : 75-76 % des cadrés arrêtés, conversion ≈ 20 %, hors surface 3 %, profondeur max 8,6-9,5 m, 1 but but vide / 16 min.
- `capture-geste.mjs` : T0 = 'arret:bloc:k' (la k-ième parade de cette espèce).

## Le bloc du gardien s'anime (2026-09-26)
- motion-keeper.blocCroix : le bloc en croix du futsal (« parada en cruz ») — genou arrière au tapis, la jambe du côté du ballon glisse
  tendue au ras du sol (0,89 m, 10 cm du sol), bassin −44 cm, bras en croix ; contact 0,24 s (0,18 dépassait le plafond de checkClip :
  37 rad/s > 30), relevé à 1,25 s ; les pieds suivent des trajectoires (IK par image — le mélange d'angles passait l'orteil sous la pelouse).
- keeper.blocGeste : le geste ANTICIPÉ (passage au plus près prévu dans la couverture d'ici 0,25 s → le clip calé sur ce passage :
  payload.decalage, l'horloge de la scène act.t + decalage) ; bas → blocCroix du côté du ballon (le miroir du plongeon), haut dans l'axe →
  paradeBuste ; à bout portant (avant le réflexe) la scène habille le bloc à son contact (l'événement porte hauteur et côté).
- keeper.blocCorps bloque au PLAN du corps face au tir (plus un cercle : le ballon arrêté jusqu'à 0,8 m devant le gardien).
- `bloc-rendu.mjs <url>` : au rendu, le ballon contre le membre le plus proche à chaque bloc — 0,45 → 0,31 m (anticipés 1,01 → 0,27 m).
