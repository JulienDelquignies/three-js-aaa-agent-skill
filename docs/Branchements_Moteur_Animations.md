# Les branchements moteur à faire pour les animations existantes

Document de travail (16/09, après les lots A7 bis, A2, A9 ter, A10 quater). Il liste ce que les
MESURES de cette session ont mis à nu du côté moteur : des animations générées qui existent et
que la sim ne déclenche pas, déclenche trop tard, ou place mal. Chaque entrée dit le symptôme
mesuré, où il vit, le mécanisme, le branchement proposé, sa clé, son banc, son risque. L'ordre est
celui de la valeur visuelle. Le document jumeau : `docs/Animations_A_Faire.md` (les animations qui
manquent et les branchements qu'elles exigeront).

## 0. Comment on branche (la recette de tous les lots)

1. **Sonde d'abord.** Un script node sur le moteur (`makeMatch({ full: true, seed })`, `matchStep`)
   ou une `play_eval` dans la page (`window.__scene`, `S.state`, `S.update(1/60)`) qui mesure le
   fait avant de le corriger : distributions (p50/p90), comptes d'événements, positions à l'image du
   tir. Le chiffre va dans la note et dans le libellé de la clause.
2. **Une loi, une clé.** Toute règle nouvelle vit sous une clé de `match-config.js` (ou une sous-clé),
   `null` = le monde d'hier au bit — vérifié par le jumeau d'empreinte (`scratchpad/empreinte.mjs`
   contre `empreinte-base.mjs` sur l'archive `git archive HEAD` du starter). Les objets imbriqués sont
   REMPLACÉS par `matchCfg(over)` : pour épingler une sous-clé, on passe l'objet d'hier entier.
3. **Des événements pour la scène.** La sim parle par `st.events` (`windup` avec `move`/`foot`/
   `skill`/`anticipation`, `élan`, `saut`, `aide`, `tête`…) ; la scène (`Rondo.js`) joue les gestes
   sur ces événements (`_playTech`, `strikeSpec`, la couche `GestureLayer`) et lit l'état
   (`p.down`, `p._chute`, `st.arbitre.geste`, `act.payload`). Un windup DOIT précéder son contact :
   un geste démarré « from contact » a perdu son armé (c'était le bug des passes, c'est encore celui
   des têtes — § 2).
4. **Le geste, son contrat.** Générateur anatomique (`motion-*.js`, une espèce dans une table,
   `poseAt(t)` → `emitSpec`), enregistré dans `motion-cast.GENERATORS` (MOVES et MOVE_TIMING
   suivent tout seuls), un contrat `checkXGen` avec ses sabotages, une planche-contact
   (`contact-sheet.mjs --move <kind> --variant after`).
5. **Le banc.** Clauses dans `verify-*.mjs` (une forcée par graine, jamais le hasard), inscrit dans
   `bancs.mjs` ; les clauses de FLUX qui mesurent le monde d'hier reçoivent une épingle datée
   (`clé: null /* DATÉ … */`) quand une clé nouvelle les déplace. La suite complète dure 40-60 min
   (lancée détachée : `setsid nohup node bancs.mjs > log &`).
6. **Le monde composé.** `audit-membres.mjs` (3 gestes de la scène Rondo, build requis) et une
   instrumentation en page à l'image du tir : c'est là que se jugent la vitesse du pied, l'appui
   posé, la distance au ballon.
7. **Les plafonds.** 1 249 lignes par module (`verify-sync`) : `match-sim.js`, `match-config.js`,
   `Rondo.js` y sont ; `referee.js` à 1 165. On extrait (`elan.js`, `aide.js`, `rondo-fusion.js`,
   `rondo-remises.js`) au lieu de gonfler. Trois copies du moteur synchronisées par `cp`
   (showcase → starter → soldier-volley), `verify-sync.mjs` 9/0.

## 1. Le pied sur le ballon (A2 bis) — LIVRÉ (16/09, note 371, reference/51 § B1)

- **Livré, scène seule** : `scenes/rondo-warp.js` (le warp de frappe en deux phases autour du verrou
  des pieds) — l'amorce de calibration par le clip généré, la calibration à l'image du tir, la fente
  du bassin (`hipsNudge`, ≤ 15 cm + 6 cm d'assise, avant le verrou). Mesuré à l'image du tir, ballon
  d'avant le coup : creux pied→surface 0,9 / 4,4 / 5,7 cm (13 frappes ; sans la fente 7,0 / 7,8 /
  10,8), cheville→centre 0,164 m (hier 0,30), 0 image non calibrée, 1 écrêtée ; clause dure dans
  audit-membres (18/0). Le mécanisme était (b) — la portée — plus la calibration biaisée d'hier
  (interpolée à l'instant sim, 8-10 cm en arrière du contact composé), pas (a) : le corps EST à sa
  stance au tir (0,53-0,57 m du ballon sur 50 frappes, stance 0,58) ; la loi sim « le tir attend le
  pied » n'est pas écrite, faute de preuve (à re-mesurer sur les rigs du mode plein). Reste : la
  queue (3 frappes sur 13 à 7-9 cm), la passePivot sans plan.
- *(le plan d'origine, gardé pour mémoire)*

- **Mesuré** (match11, graine 3, 21 frappes instrumentées à l'image du tir, lot A2) : l'orteil est à
  30 cm du centre du ballon en médiane, 4-11 cm sur les bonnes, 48 sur les mauvaises ; le warp est
  engagé sur 14/21. La vitesse du pied est désormais celle du clip (11,3 m/s médian) ; c'est la
  géométrie qui manque. Visuellement : le ballon part alors que le pied passe à côté.
- **Où.** `scenes/Rondo.js` `_applyStrikeWarp` (calibration en ligne du point de contact par
  clip × pied × rig, `planWarp` chaque image avant le tir, enveloppe `warpEnvelope`, portée
  `warpReach` « écrêtée, pas refusée ») ; `engine/strike-warp.js` (`planWarp` standoff 0,13,
  warpMax 0,42, `WARP`) ; côté sim `strike-sim.beginPass` (stance/ancre, `approach.planStrike`) et
  `strikeNow` (le tir part À L'HEURE de l'acte, où que soit le corps).
- **Mécanisme probable** (à départager par l'instrument) : (a) le plan dépasse warpMax — le corps
  n'est pas à sa stance quand l'acte tire (le tir n'attend pas le corps, contrairement à la course
  d'élan qui attend l'arrivée) ; (b) la portée écrête au contact (mesuré déjà : 62 % des passes
  avec un refus à ±0,05 s) ; (c) l'enveloppe est fermée ou le poids des jambes trop bas sur les
  gestes courts (passe rapide 0,22 s : wLegs 0,94 au tir) ; (d) le ballon en conduite bouge
  entre le plan et le tir.
- **Branchement.** D'abord l'INSTRUMENT : à l'image du tir, journaliser par frappe `plan.mag`,
  `plan.denied`, `s`, le ratio d'écrêtage de portée, la distance orteil→ballon — et classer les 21.
  Puis, selon la classe : (a) une loi sim « le tir attend le pied » — comme `elanStep` étire
  l'anticipation quand le preneur est loin, `strikeNow` peut attendre (≤ 0,15 s) que le corps soit à
  ≤ stance.dist + marge du ballon, clé `cfg.tirAttendLePied` ; (b) une portée plus longue par le
  bassin (le corps se penche/le bassin glisse vers le ballon de quelques cm — un canal hips comme
  celui du plongeon) ; (c) l'enveloppe et le poids : `rondo-fusion` `ramp` 0,8 → 0,7 sur les
  gestes < 0,3 s ; (d) le plan re-visé sur le ballon PRÉDIT au contact (sa vitesse × temps restant).
- **Clé / banc.** Côté scène, pas de clé (le rendu). Côté sim (a) : clé, empreinte. Banc : une clause
  DURE dans `audit-membres` (orteil ≤ 0,15 m de la surface du ballon à l'image du tir sur les trois
  épisodes) et une clause de page dans le rapport (médiane ≤ 0,15 m sur 20 frappes).
- **Risque.** Retarder le tir change la sim (interceptions, tacles) : épingles à prévoir sur les
  clauses de flux de verify-match11. Taille : 1 lot (sonde ½ j, loi ½ j, bancs/docs ½ j).

## 2. La reprise aérienne ARMÉE (tête, volée, poitrine) — LA TÊTE LIVRÉE (16/09, note 373, reference/51-motion-strike § B3)

- **Livré** : `cfg.tete.armee { marge: 0.25 }` (tete.js, null = hier au bit) — `teteArmerStep` prédit le
  ballon à τ = le contact du clip (tete 0,42 s sautée, teteDebout 0,22 s debout), arme l'acte sur le
  corps qui y sera (`payload.mobile` : il court sous son armé), `teteContact` résout la tête à l'heure de
  l'acte (`tête-manquée` sinon). verify-tete-armee 6/0 (nouveau, dans bancs.mjs). Restent la volée et la
  poitrine (même patron ; le clip `frappe` de la volée à remplacer par une espèce `volee`).
- *(le plan d'origine, gardé pour mémoire)*

- **Mesuré.** Le ciel existe (`tete.js`, lot 34 : événements `tête` mode but/dégagement/remise,
  `duel` aérien, `volée`, `control poitrine`) mais la scène joue le clip généré `tete`/`teteDebout`
  À SON CONTACT (`Rondo.js` : `_playTech(pl, { ...e, move }, from = 'contact')`) : tout l'armé et
  l'impulsion sont perdus, on voit la seconde moitié du geste. Zéro `windup` tech `tete` en 480 s
  sur deux graines. Les clips existent depuis A3 (motion-aerial : la détente est dedans).
- **Où.** `tete.js` `teteStep` décide à l'image où le ballon est à sa hauteur ; pas d'acte, pas
  d'anticipation. `rondo-sim.js` 1030 (`if (cfg.tete) teteStep`).
- **Branchement.** Prédire le contact : le vol est déterministe (`st.pass.flight`, la trajectoire
  balistique) — quand un joueur est le candidat d'une reprise (la loi actuelle de `teteStep`,
  évaluée `antic` s AVANT : la position du ballon dans `antic` s à hauteur de tête, le joueur qui y
  sera), armer un acte `tete`/`teteDebout` (`startGesture` avec `anticipation = MOVE_TIMING.tete.
  contact`, payload `{ kind: 'tete', saut, ownsBody }`, événement `windup` skill `tete`), et laisser
  `teteStep` RÉSOUDRE au contact de l'acte (le hook `elanNow` est le patron : la remise se prend au
  contact du geste). Le time-warp du plongeon (`rate` borné 0,8-2,2, `_diveStart`) donne la même
  chose pour la détente : le sommet du saut sur l'heure du ballon. Clé `cfg.tete.armee` (null : la
  reprise réactive d'hier). Même chose pour la volée (`voleeStep`, clip `frappe` aujourd'hui ; une
  espèce `volee` de motion-strike serait mieux) et la poitrine (`chestStep`, clip `amorti`).
- **Banc.** verify-match11 (ou un `verify-ciel.mjs`) : un centre forcé sur un attaquant → windup
  `tete` AVANT l'événement `tête`, écart = anticipation ± 1 tick, le ballon repris à l'heure du
  contact ; page : la tête du modèle à ≤ 0,25 m du ballon à l'image de l'événement.
- **Risque.** L'anticipation fige le corps (`winding`) : un joueur qui s'arme pour une tête que le
  vent (une déviation) lui retire reste planté 0,4 s — prévoir l'abandon (`abortGesture`) quand la
  prédiction meurt. Taille : 1 lot.

## 3. Le double geste des remises lancées (coup franc lancé, corner) — LIVRÉ (16/09, note 372, reference/56 § B2)

- **Livré** : `remisesPied.elan.tirImmediat { cone: 40 }` (elan.js, null = hier au bit) — le double geste
  n'était PAS le lancé ni le corner joué (ils partent dans l'image de la prise) mais le coup franc LOIN
  (> 55 m : ni direct ni lancement, 9 remises sur 20 en 12 matchs) et le corner de possession. Le plan
  se prend à la pose (le coéquipier le plus libre du demi-plan avant, la course orientée vers lui, relue
  toutes les 0,5 s, la course attend qu'il se soit écarté — la protestation rassemble les corps), la
  passe s'arme au contact d'élan en urgence (`opts.elan` : pas de porte d'ancre ; `payload.tirImmediat` :
  pas de porte de stance au tir), tir au tick suivant ; la scène ne joue qu'un geste (`remiseSkip`
  généralisé, `elanTake` : pas de clip de contrôle sur le clip d'élan). verify-remises 47/0.
- *(le plan d'origine, gardé pour mémoire)*

- **Mesuré.** Au contact de la course d'élan, `coupFrancLance` / `cornerTrav` → `beginPass` arme
  une SECONDE passe : refusée par la porte de timing (`st.hold` ≈ 0 : 'timing' × 5 mesuré), puis
  rejouée par le cerveau 0,4-1,5 s plus tard. Le clip d'élan frappe un ballon qui ne part pas, puis
  un clip de passe le fait partir. Corrigé pour la sortie de but seulement (elan.js : la course
  compte comme porté, le tir au tick suivant, la scène garde le clip d'élan — `rondo-remises.
  remiseSkip`).
- **Branchement.** Généraliser dans `elanNow` : après `onTake`, si le preneur a un acte 'pass' frais
  (`A.t < A.anticipation`) → `st.hold` compté, `A.anticipation ← A.t` ; dans `remiseSkip`, accepter
  `remise === 'coup-franc' | 'corner'`. Vérifier que le plan de passe « avec le temps » (stance à
  rejoindre) ne s'applique pas à un corps déjà lancé : passer `forceUrgent` depuis le hook.
- **Clé / banc.** La sous-clé `remisesPied.elan.tirImmediat` (null : le double geste d'hier) ;
  verify-remises : `memeImage` durci (passe ≤ 0,05 s après 'élan' pour le lancé et le corner).
  Taille : ½ lot.

## 4. Le mur : sa formation, et le ballon contre lui — LIVRÉ (16/09, note 374, reference/56 § B4)

- **Livré** : (a) la formation — `loi12.murTrot 1.6` (match-sim, la branche mur) : les deux hommes du mur sont choisis par
  la DISTANCE À LEUR POINT (le temps d'arrivée à vitesse égale ; hier les deux plus profonds) et y TROTTENT (`_walkF`) ;
  (b) le corps — `remisesPied.mur.corps 2.2` (elan.js `murCorps`) : au départ du ballon, une fenêtre d'une seconde
  (`st._murCorps`) pendant laquelle un ballon qui passe à ≤ `rayon 0.6` m d'un homme du mur (la façade des deux corps),
  sous sa hauteur (`debout 1.85` planté, `corps 2.2` en l'air pendant la détente) et, en l'air, au-dessus de ses pieds
  (`pieds 0.25` : le rasant passe SOUS le mur qui saute) est DÉVIÉ — renvoi × `frein 0.4`, relevé, phase loose, passe
  nulle, toucher au mur, événement `dévié-mur { by, h, air, vitesse }` ; et `canTake` (referee) ferme le contrôle aux
  hommes du mur pendant la fenêtre (mesuré à la sonde : l'homme du mur CONTRÔLAIT le coup franc qui le frappait, un
  turnover à 1 m/s dans l'image du choc). verify-remises 53/0 : le mur trotte et arrive à ≤ 1,5 m de son point à la
  prise (à 50 s de jeu) ; le ballon à mi-hauteur (élévation 0,2) rencontre le mur (dévié-mur h 0,74 m en l'air à
  16,1 m/s, il repart vers le tireur à 6,4 m/s) ; le rasant (0,12) passe sous le mur qui saute sans être contrôlé ; le
  haut (0,45) passe au-dessus ; sabotages corps:null (traversé) et murTrot:null (au pas : 0,59 / 4,63 m de leur point à
  la prise). null : hier au bit (empreinte jumelle identique, les clés B4-B6 absentes). En match : note 374.
- *(le plan d'origine, gardé pour mémoire)*

- **Mesuré.** À 50 s de jeu, les deux hommes du mur (`r._mur` : les deux plus près de leur but)
  partent de 56 m et arrivent à 8-13 m du ballon à la prise (16 s de pose) ; en page, l'un a sauté
  à 1 m du ballon. Ils MARCHENT (job `walk`, sans `_walkF`) alors que les monteurs trottent
  (`cfSpots` : `_walkF = trot 1,6`). Et le ballon TRAVERSE le mur qui saute : la déviation corps ne
  prend que les ballons lents (`match-sim` ~347 : `bSpd < 8`).
- **Branchement.** (a) Formation : dans le tour des métiers (`match-sim` ~222, branche mur),
  `p._walkF = trot` pour les hommes du mur et un choix du mur par TEMPS D'ARRIVÉE (les deux qui
  peuvent y être avant `r.at`, pas les deux plus profonds). (b) Le corps du mur : dans `ball.js` ou
  un `mur.js`, pendant `_murSaut`/l'acte `sautMur` (et 0,3 s avant), un ballon dont la trajectoire
  passe à ≤ 0,35 m d'un homme du mur sous sa hauteur de saut (2,2 m ; 1,85 debout) est DÉVIÉ
  (`release('mur')`, vitesse × 0,4, élévation relevée, événement `dévié-mur`). Le tireur vise déjà
  ≥ 2,35 m à 9,15 m (`referee` 231-255) : seuls les tirs bas et les lancés tendus paieront.
- **Clé / banc.** `remisesPied.mur.corps: 2.2` (null : le mur traversé) ; `loi12.murTrot`.
  verify-remises : coup franc forcé bas (élévation 0,15) → `dévié-mur` ; haut → passe ; formation :
  distance des hommes du mur à leur point ≤ 1,5 m à la prise, à 50 s de jeu. Taille : 1 lot.

## 5. Les changements de cap francs (le lacet lissé) — LIVRÉ (16/09, note 374, reference/52 § B5)

- **Livré** : `cfg.viragesLisses { taux 6, tau 0.15, des 2.0, frein 0.2, arrivee 1.5 }` (movement.js) — le cap demandé filtré
  puis borné par la vitesse, le cap loin du voulu freine, libre sous 2 m/s et à moins de 1,5 m de la cible ; inversions de
  l'accélération latérale ÷ 2 (press 7,1 → 3,9/s, cover 8,5 → 3,7, receive 6,0 → 3,0, support 3,7 → 1,6), latérale
  médiane cover 5,9 → 2,4 m/s² (press reste au taquet : 5,8). null : hier au bit.
- *(le plan d'origine, gardé pour mémoire)*

- **Mesuré.** L'accélération latérale du modèle (repère corps, lissée 0,15 s) : p50 0,55, p90
  5,7 m/s², max 7,9 sur 40 s — des zigzags de décision, pas des courbes. Depuis A7 bis le corps
  ROULE dans ces virages (13° à 4,5 m/s²), donc le bruit devient visible.
- **Où.** `movement.js` : le slew du lacet (rate = turnAccel / speed, ~446-490) et la cible de
  course réécrite par le cerveau à 60 Hz (`cfg.engagement` calme support/cover/walk, pas
  press/receive/intercept).
- **Branchement.** Un taux de virage borné par la vitesse pour TOUTES les courses (une hystérésis
  de cap : la cible ne tourne pas de plus de k·dt/v rad par image), clé `cfg.viragesLisses`
  `{ taux: 2.5 }` (null : les cassures d'hier). Sonde d'abord : la distribution du changement de
  cap par tick et par métier.
- **Banc.** verify-match11 (flux, épingles) + une clause A7 : p90 de |aL| ≤ 4 m/s² sur 40 s de page.
  Risque : les interceptions se jouent au cap ; mesurer les pertes/interceptions avant-après.
  Taille : ½-1 lot.

## 6. La vitesse figée sous un acte — LIVRÉ (16/09, note 374, reference/52 § B6)

- **Livré** : `cfg.plantVitesse` (movement.js) — p.v = 0 sous l'acte qui plante (hors élan, tête armée, mains). La mesure
  a corrigé le plan : 81 % des images plantées lisaient > 1 m/s, mais l'armé de passe (9 sur 10) GLISSE vraiment sur son
  ancre et `stepGestures` écrit ce rapport chaque image — pas un fossile. Le fossile était celui des gestes sans ancre
  (feinte, tacle debout, semelle, râteau… : 470 images hors passe sur 6 matchs → 110, dont 75 écrites par le geste
  lui-même : plongeon, roulette). null : hier au bit.
- *(le plan d'origine, gardé pour mémoire)*

- **Mesuré.** Sous un geste (`winding` ou `ownsBody`), `movePlayers` saute l'intégration mais laisse
  `p.v` à sa dernière valeur (0,8-0,9 m/s lus sur un mur planté ; 3 m/s sur un frappeur en course).
  Qui lit `p.v` d'un corps planté voit un corps qui bouge : `beginPass` (le couple porteur-ballon,
  `relV`), l'effort, les cerveaux adverses (poursuite).
- **Branchement.** `p.v = [0, 0]` sous l'acte, sauf `payload.elan` (qui court) — clé
  `cfg.plantVitesse` (null : hier). Sonde : combien d'images par match avec `p.v` > 1 sous un acte,
  et quelles décisions changent (empreinte + verify-match11 avec/sans).
- Taille : ¼ lot, mais des épingles.

## 7. La frappe en miroir (l'audit des membres, épisode 2) — RÉSOLU AU B1 (l'instrument)

- **Résolu** : l'épisode « posé » à l'appui en l'air et au pied frappeur à 0,3 m/s jugeait une `feintePasse` TIRÉE dans le
  tampon d'avant l'armé, pas la passe — `audit-membres` cherche désormais `iStart`/`iFire` depuis l'image de l'armé, sur le
  geste de l'épisode (note 371) ; les trois épisodes du rondo passent (18/0), aucune frappe en miroir mesurée.

- **Mesuré.** Un épisode `passeRapide` « posée » où l'appui déclaré (LeftFoot) est en l'air à
  0,21-0,31 m et le pied frappeur déclaré à 0,3 m/s : le clip joue avec l'AUTRE pied que
  l'événement, ou l'épisode colle deux windups. Pré-existant, 1 épisode sur 3, reproductible
  (Rondo, graine 3).
- **Branchement.** Instrument en page : à chaque windup de frappe, comparer `e.foot`, `act.payload.
  pick.foot`, et le suffixe `-gauche` du spec de la couche ; compter les désaccords. Si la sim
  change de pied entre le windup et le tir (re-décision), le second windup doit ANNULER le premier
  dans la scène (`_playTech` rejoue depuis 0) — vérifier aussi `useMirror = e.foot === 'left'`.
- Taille : ½ lot (surtout de l'instrument).

## 8. La touche longue et la sortie de but longue chez le coach — LA TOUCHE LIVRÉE (16/09, B6)

- **Livré** : le preset `direct` de tactics.js porte `cpa: { touche: 'longue' }` — le jeu direct lance ses touches du tiers
  offensif longues (le trébuchet du 165, la course d'élan du lanceur d'A9 ter) ; la sortie de but longue reste à la loi de
  pression de `keeper.styleSortieBut` (déjà vivante).

- **Mesuré.** `cpa.touche 'longue'` n'existe dans aucun preset (`tactics.js`), la course d'élan de
  la touche longue (A9 ter) ne vit donc qu'aux bancs ; la sortie de but longue dépend de la loi de
  pression (`keeper.styleSortieBut`) — elle vit.
- **Branchement.** `coach.js`/`tactics.js` : `cpa.touche = 'longue'` quand l'équipe a un lanceur
  long (`skill.throwF ≥ 1.15`) et joue direct ; clé `cfg.toucheLongueAuto` (null : les presets
  d'hier). Le lanceur élu doit être CE joueur (`elireTaker` : le spécialiste).
- Taille : ¼ lot.

## 9. Le tir un tick après le contact (option, la scène compense déjà) — NON RETENU

- La scène re-cadence déjà le swing sur le tick du tir (A2, rondo-fusion) et la calibration se prend à l'image du tir (B1) :
  aucune raison de déplacer le tir de la sim.

- La sim tire au premier tick où `act.t ≥ anticipation` (0-17 ms après la clé de contact). La scène
  re-cadence le swing sur ce tick (A2). Une version sim : tirer au tick le plus proche
  (`act.t + dt/2 ≥ anticipation`) — clé `cfg.tirAuPlusPres`. Sans urgence.

## 10. Les prises aériennes du gardien

- **Mesuré.** `plongeonPrise` existe (`match-sim` 376-378 : cross.y ≥ 1,35 → prise), l'événement
  `arrêt` mode prise porte `aerienne` ; aucune prise aérienne filmée en 380 s sur trois graines
  (dette A6). Sonde à faire : la hauteur des centres à l'arrivée sur le gardien (les centres
  arrivent-ils ≥ 1,35 m ? sinon la loi ne s'ouvre jamais) et la sortie sur les centres (le gardien
  ne vient pas au-devant : `keeperSpot` le garde sur sa ligne).
- **Branchement.** Une loi de SORTIE sur centre (`keeper.js` : intercepter le vol quand il passe
  dans la surface de but à ≥ 1,6 m avec un temps d'arrivée suffisant), clé `cfg.sortieAerienne`.
  Taille : 1 lot (voir `docs/Animations_A_Faire.md` § la sortie aérienne / le poing).

## L'ordre proposé

1 (le pied sur le ballon) → 3 (le double geste, ½ lot) → 2 (la tête armée) → 4 (le mur) →
5 (le lacet) → 6 (la vitesse figée) → 8, 7, 10, 9. Les trois premiers touchent chaque match ;
le mur et le lacet, chaque coup franc et chaque virage.
