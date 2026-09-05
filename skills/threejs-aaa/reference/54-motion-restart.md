# 54 — Les remises à la main (motion-restart, lot A9)

La touche était un crochet de la sim : à la prise, `remiseEnTouche` lançait le ballon DU SOL (ballY
0,11) à l'instant même — le preneur restait dans son clip d'attente, dos au jeu, et le ballon
partait par-dessus sa tête. La relance à la main du gardien dessinait une passe DU PIED (la table
des techniques ne connaissait pas les mains). Le ramassage d'un ballon au sol s'habillait de la
prise aérienne. Trois gestes qui n'existaient pas.

`engine/motion-restart.js` génère les trois — des fonctions pures du temps, du rig et du style —
et la sim les JOUE : la touche s'arme, le ballon quitte les mains au contact du geste, le gardien
distribue à la main par le roulé, le lanceur attend face au terrain et se tourne sur sa cible.

## Les espèces (RESTART_KINDS)

| espèce | situation | corps | contact |
|---|---|---|---|
| `touche` | la rentrée de touche (Loi 15) | ballon des deux mains à la poitrine, passé DERRIÈRE la tête (18 cm derrière, 1,70 m), le tronc s'arque (20°) puis fouette (30°), lâcher à 1,76 m, 22 cm devant, mains écartées de 32 cm ; pieds décalés de 30 cm, TOUS DEUX AU SOL ; retour debout | 0,62 s / 1,15 s |
| `rouleMain` | la relance à la main du gardien | il se penche (60°) et s'assied (bassin −38 cm) en fente ; le bras arme derrière (24 cm), balaie vers l'avant bas, lâche à 0,36 m, 45 cm devant ; il se relève | 0,52 s / 1,05 s |
| `ramassage` | la prise d'un ballon au sol | fente, tronc à 84°, les deux mains cueillent à 0,33 m (36 cm devant), le ballon monte à la poitrine (1,06 m) en se relevant | 0,42 s / 1,12 s |

Le style du joueur (`styleFromSeed`) ne touche que la touche (arche, fouetté, inclinaison —
bornée [0,85 ; 1,2]) : le roulé et le ramassage ont une géométrie de PORTÉE (la main doit être
là), un accent les casserait (mesuré : 20 styles rouges avant la borne).

## L'IK de bras (armIK)

Ce qui manquait à `armJoints` (un port de bras) et à `armPose` (une vrille) : un POIGNET À UN
POINT. `armIK(P, side, épauleW, Rpar, poignet, pôle)` résout le coude par IK à deux os
(`procedural.twoBoneIK`), le plan du coude vient du PÔLE (`cross(pôle, dir)` — lu sur la géométrie
il sautait de signe quand le bras se tendait), et la rotation de chaque os est la matrice des
repères `R = F1 · F0ᵀ` (Shepperd) — unique et continue tant que les repères le sont. Le
plus-court-arc + vrille d'hier sautait de 44° quand le bras se repliait. Contrat : poignet à
0,00 mm de cinq cibles atteignables, 4,3° de saut max par pas sur 160° d'arc autour de l'épaule
(la sphère de la touche, à 34 cm). Ce que l'IK refuse : les cibles hors portée (épaule de shanon
à 1,43 m + 0,49 m de bras : le lâcher de la touche est à 1,76, pas à 2,0).

## La sim (ce qui a changé au moteur, localisé)

- `referee.remiseEnTouche` ARME le geste (`startGesture` 'touche', payload `{ kind: 'touche', to,
  target, longue, Rr, mains }`, événement `windup` tech 'touche') au lieu de lancer ; le preneur
  POSSÈDE le ballon pendant l'armé.
- `strike-sim.throwNow` — appelé par l'horloge du geste au contact (dispatch `rondo-sim`) : le
  ballon quitte les MAINS (`ball.restart(from, { cause: 'touche' })` à TOUCHE_H 1,8 m, 0,3 m devant
  — la discontinuité nommée du ballon), balistique honnête (`solvePass` depuis la hauteur des mains,
  élévation 0,24 / 0,40 pour la touche longue), événement `rentrée` avec `ballY`, `speed`, `face`.
- `strike-sim.beginPass(…, { mains: true })` : la distribution à la main du gardien prend la
  technique `roule-main` (clip `rouleMain`), sans ancre ni stance, EXEMPTE de la porte 'timing'
  (le holdMin conditionnel de la conduite — 2,2 s au calme — refusait CHAQUE relance à la main :
  0 en 7 graines × 240 s). `keeper.gkHeldBall` fait DESCENDRE les gants avec l'armé (de la
  poitrine au point de lâcher, 0,45 m devant, 0,35 m de haut) ; `strikeNow` lit le ballon où il est
  (ballY 0,46 au contact ; avant : 1,09, la passe partait de la poitrine).
- `technique.js` : rangées `touche` et `roule-main`, intent 'mains' — jamais candidates au plan du
  pied. `motion-cast` : les trois espèces sont des MOVES générés, `MOVE_TIMING` les lit.
- LE LANCEUR FAIT FACE. Mesuré avant : pris en course à 4 m/s, dos au jeu, face à la lisse (171°
  de la cible au lâcher). `referee.canTake` : la touche se prend À L'ARRÊT, face au terrain (± 20°,
  patience 3 s — jamais de gel) ; `ballFetch` tourne le lanceur qui attend par le slew borné
  (`yawWant`) ; `movement.js` laisse les remises à la MAIN pivoter sous le geste (« a swing owns
  the body » vaut pour un ballon au pied : le lanceur tourne le corps AVEC son ballon en mains, au
  taux d'un homme debout — `enPorte` les exempte du retournement du porteur) et le porteur d'une
  remise à la main vise sa CIBLE, pas le ballon posé derrière lui sur la ligne. Écart corps-cible
  au lâcher : 0-5° sur sept touches.

## La scène

- `idleCtx.toucheTaker` → espèce d'attente `ballonMains` (motion-idle) : le ballon à hauteur de
  ventre, deux mains (poignets résolus par `armIK`), tête baissée de 3° ; `_holdHands` dessine le
  ballon ENTRE LES MAINS pendant l'attente et l'armé (la sim le laisse posé sur la ligne : le visuel
  le tient, la sim le lance des mains au contact — un ballon, deux autorités NOMMÉES par phase).
- `_playTech` : la prise du gardien sur un ballon < 0,5 m devient `ramassage` ; l'armé de la
  relance à la main s'habille du `rouleMain` ; `_applyStrikeWarp` s'efface pour les mains (pas de
  pied de frappe à corriger).

## Le contrat (verify-remises.mjs — 21 clauses)

- trois gestes sous `checkRestartGen` (ballon entre les mains jusqu'au lâcher, mains au bon endroit
  au contact, derrière la tête pour la touche, tronc qui s'arque puis fouette, pieds au sol, roulé
  lâché bas devant après un armé, ramassage qui se baisse) et `checkClip` ; 20 styles × 3 gestes ;
- `armIK` exacte et continue ; registre (MOVES, MOVE_TIMING, techniques 'mains') ;
- LA SIM : six touches FORCÉES (le hasard n'en garantit aucune en 2 × 180 s) + une naturelle sur
  deux matchs : 7 armés pour 7 rentrées, 7/7 à ballY ≥ 1,7, le ballon part 0,63-0,64 s après
  l'armé (contact 0,62), 7/7 premiers contacts pour l'équipe du preneur, lanceur face à sa cible
  (0-5°) ; la relance à la main du gardien prise sur pièce (`beginPass` mains, le ballon aux gants
  descendu : windup 'roule-main', passe à ballY 0,46, 0,53 s après l'armé) ;
- six sabotages nommés (touche lâchée bas, sans armé, sans fouetté ; roulé lâché haut, sans armé ;
  ramassage qui ne se baisse pas).

## Mesuré en jeu (match11, graine 7, touches forcées)

- L'attente : le lanceur debout sur la ligne, le ballon à deux mains devant lui, l'assistant dans
  son dos ; il se tourne vers le terrain avant que la touche s'ouvre (capture `a9-touche-attente`).
- L'armé : ballon derrière la tête, tronc arqué, pieds au sol, face au terrain (captures
  `a9-touche-arme-face`, `-profil`) ; le lâcher devant lui, bras qui accompagnent
  (`a9-touche-lacher`) ; rentrée à 1,8 m, 9-20 m/s selon la portée.
- Le roulé du gardien : forcé (le gardien tient le ballon, un appui à 8 m) — il se penche, arme
  derrière, roule bas devant ; observable naturellement seulement quand la sim relance court à la
  main, ce qui n'est jamais tombé en 12 min de jeu sur deux graines (2 prises aux gants, toutes
  deux des retraits joués au pied).

## Les dettes nommées

- Le lanceur se tient 0,2-0,8 m DANS le terrain (la sim le pose au point de remise, pas derrière la
  ligne) ; les pieds ne « traînent » pas sur la ligne au lâcher.
- La touche longue n'a pas de course d'élan (Loi 15 la permet) ; le jet ne module pas sa force au
  style du joueur (la portée est celle de `loi15.range`).
- Le dégagement de volée du gardien, la prise aérienne tenue (dette A6) et le coup de pied de but
  restent au pied et aux clips.
- Les planches de contact dessinent le ballon aux mains sur tout le clip (le ballon ne part pas
  dans la planche) — une convention de l'instrument, pas du jeu.
