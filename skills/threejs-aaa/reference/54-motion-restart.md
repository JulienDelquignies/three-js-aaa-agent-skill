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

## La sim (ce qui a changé au moteur, localisé — sous la clé `cfg.remisesMain`)

Le contrat du moteur (retour `docs/Retour_Reference_A9_Remises.md`) : toute clé absente rend le
moteur d'hier AU BIT. `cfg.remisesMain` (`{ toucheH: 1.8, elev: 0.55, elevLongue: 0.42, face: 0.35,
patience: 3 }`, allumée dans match-config) gate la touche armée, le ballon porté, la pose du lanceur
et le roulé du gardien ; `null` = la rentrée instantanée du sol et la relance au pied d'hier — vérifié
au bit sur 6 graines × 300 s × deux mondes contre le tronc du moteur (mêmes 430 passes, 581 armés,
140 pertes, 10 041 refus timing…), et par la clause « la clé absente rend l'hier » de verify-remises.

- `referee.remiseEnTouche` ARME le geste (`startGesture` 'touche', payload `{ kind: 'touche', to,
  target, longue, Rr, mains }`, événement `windup` tech 'touche') au lieu de lancer ; le preneur
  POSSÈDE le ballon pendant l'armé. Clé absente : le code d'hier, à la ligne.
- `strike-sim.holdMains` (appelé par `stepGestures` pendant l'armé d'une remise à la main) : le
  ballon est TENU (`ball.hold` — un déplacement, jamais une pose par écriture : le registre du ballon
  ne voit aucune remise, `checkMatch` « la remise se PORTE » tient). Pour la touche il monte du sol à
  la poitrine (0,25 m devant, 1,35 m), passe derrière la tête (−0,12 m, 1,74 m) et revient au point de
  lâcher (0,30 m devant, toucheH) — le chemin des mains du geste généré ; pour le roulé ce sont les
  gants qui descendent (`keeper.gkHeldBall`). Mesuré en jeu : 0,13 → 1,11 m à 0,22 s → 1,78 à 0,52 →
  1,82 au contact. Avant : `ball.restart` écrivait le ballon aux mains — 5 poses par écriture en
  300 s au registre, le contrat de checkMatch rompu (le retour du moteur).
- `strike-sim.throwNow` — appelé par l'horloge du geste au contact (dispatch `rondo-sim`) : le
  ballon quitte les MAINS là où holdMains l'a porté (`release('touche')` puis `strike`, aucune
  écriture de position), balistique honnête (`solvePass` depuis la hauteur réelle du ballon,
  élévation `elev` 0,55 / `elevLongue` 0,42 pour la touche longue — la CLOCHE d'hier : tendue à
  0,24 le jet filait à 17,7 m/s p50 et arrivait en 1,0 s, la possession tenait 5 s ; en cloche
  13,1 m/s, 2,25 s, 18,8 s, comme hier (2,13 s, 12 s) — le réel lance à 10-15 m/s), événement `rentrée` avec
  `ballY`, `speed`, `face`.
- `strike-sim.beginPass(…, { mains: true })` : la distribution à la main du gardien prend la
  technique `roule-main` (clip `rouleMain`), sans ancre ni stance, EXEMPTE de la porte 'timing'
  (le holdMin conditionnel de la conduite — 2,2 s au calme — refusait CHAQUE relance à la main :
  0 en 7 graines × 240 s). `keeper.gkHeldBall` fait DESCENDRE les gants avec l'armé (de la
  poitrine au point de lâcher, 0,45 m devant, 0,35 m de haut) ; `strikeNow` lit le ballon où il est
  (ballY 0,46 au contact ; avant : 1,09, la passe partait de la poitrine).
- `technique.js` : rangées `touche` et `roule-main`, intent 'mains' — jamais candidates au plan du
  pied. `motion-cast` : les trois espèces sont des MOVES générés, `MOVE_TIMING` les lit.
- LE LANCEUR FAIT FACE. Mesuré avant : pris en course à 4 m/s, dos au jeu, face à la lisse (171°
  de la cible au lâcher). `referee.canTake` : la touche se prend À L'ARRÊT, face au terrain (± `face`
  0,35 rad, `patience` 3 s — jamais de gel) ; `ballFetch` tourne le lanceur qui attend par le slew borné
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

## Le contrat (verify-remises.mjs — 23 clauses)

- trois gestes sous `checkRestartGen` (ballon entre les mains jusqu'au lâcher, mains au bon endroit
  au contact, derrière la tête pour la touche, tronc qui s'arque puis fouette, pieds au sol, roulé
  lâché bas devant après un armé, ramassage qui se baisse) et `checkClip` ; 20 styles × 3 gestes ;
- `armIK` exacte et continue ; registre (MOVES, MOVE_TIMING, techniques 'mains') ;
- LA SIM : six touches FORCÉES (le hasard n'en garantit aucune en 2 × 180 s) + une naturelle sur
  deux matchs : 7 armés pour 7 rentrées, 7/7 à ballY ≥ 1,7, le ballon part 0,63-0,64 s après
  l'armé (contact 0,62), 7/7 premiers contacts pour l'équipe du preneur, lanceur face à sa cible
  (0-5°) ; la relance à la main du gardien prise sur pièce (`beginPass` mains, le ballon aux gants
  descendu : windup 'roule-main', passe à ballY 0,46, 0,53 s après l'armé) ;
- le registre du ballon : par match, les seules poses sont le coup d'envoi et les trois touches
  forcées par le banc — la touche jouée est portée, jamais écrite ; la clé absente rend l'hier
  (remisesMain:null → rentrées instantanées du sol, aucun armé, aucun ballY) ;
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

## Le banc du match (verify-match11)

260/6 sur le moteur A9 contre 266/0 sur main. Les six rouges sont des clauses SUR LE FIL
(gelé 2,21 pour ≤ 2,19 ; 0 bascule pour ≥ 1 ; chaîne de passements 2 pour ≥ 3 ; 5/9 passes en
profondeur conservées pour ≥ 65 % ; p50 des courses 1,50 pour ≥ 1,55 s ; deuxième latéral 2
pour ≤ 1), aucune ne mesure une remise. Contrôle : main avec 0,01 rad de plus (0,6°) sur l'élévation de
l'ancienne touche (0,55 → 0,56 rad, aucune loi changée) donne 262/4 — les mêmes foulée et
renversement, plus le dosage des passes en profondeur et le troisième homme. Main intact est à
l'exact bord (gelé 2,19 ≤ 2,19, 1 bascule pour un minimum de 1, chaîne 3 pour un minimum de 3).
Une remise qui dure 0,6-2 s de plus change la trajectoire du match dès la première touche ; les
statistiques d'un monde sans touche sont identiques entre A9 et main au bit (2 × 300 s : 192
passes, 213 contrôles, 57 pertes). Dette pour le moteur : ces clauses mesurent au fil du rasoir.

## Les dettes nommées

- Le lanceur se tient 0,2-0,8 m DANS le terrain (la sim le pose au point de remise, pas derrière la
  ligne) ; les pieds ne « traînent » pas sur la ligne au lâcher.
- La touche longue n'a pas de course d'élan (Loi 15 la permet) ; le jet ne module pas sa force au
  style du joueur (la portée est celle de `loi15.range`).
- Le dégagement de volée du gardien, la prise aérienne tenue (dette A6) et le coup de pied de but
  restent au pied et aux clips.
- Les planches de contact dessinent le ballon aux mains sur tout le clip (le ballon ne part pas
  dans la planche) — une convention de l'instrument, pas du jeu.
